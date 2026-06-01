import { WIDGET_ENDPOINT } from '../config/apiConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Spark concurrency — จำนวน Spark jobs ที่รันพร้อมกัน
//
// แต่ละ query มี jobGroupId ใหม่ทุกครั้ง (Ocelot ขอใหม่ต่อ query)
// ดังนั้น "already started" error ไม่เกิด → รัน parallel ได้
//
// Trade-offs:
//   1 → sequential, ปลอดภัย, ~27s สำหรับ 11 widgets
//   2 → 2 Spark jobs คู่กัน, ~15s  ← ค่าที่ใช้ (balance ระหว่างเร็วและ resource)
//   3 → ~10s, ใช้ได้ถ้า Spark cluster มีทรัพยากรพอ
//
// ปรับผ่าน VITE_SPARK_CONCURRENCY ใน .env.local ถ้าต้องการ tuning
// ─────────────────────────────────────────────────────────────────────────────
const SPARK_CONCURRENCY = Number(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SPARK_CONCURRENCY) || 2
);

// ─────────────────────────────────────────────────────────────────────────────
// Widget type → API keys ที่ต้องดึง
// ─────────────────────────────────────────────────────────────────────────────
const WIDGET_API_KEYS = {
  miceStatCard:                ['miceKpis'],
  miceKpis:                    ['miceKpis'],
  miceEventsChart:             ['miceEventsChart'],
  miceRevenueChart:            ['miceRevenueChart'],
  miceVisitorsChart:           ['miceVisitorsChart'],
  miceEventsQuarterlyChart:    ['miceEventsQuarterlyChart'],
  miceVisitorsQuarterlyChart:  ['miceVisitorsQuarterlyChart'],
  miceNationalityPerformance:  ['miceNationalityPerformance'],
  miceNationalityIndustryMatrix: ['miceNationalityIndustryMatrix'],
  miceVisitorsBreakdown:       ['miceVisitorsBreakdown'],
  miceNationalityMatrixView:   ['miceNationalityMatrixView'],
  miceDrillFlow:               ['miceDrillFlow'],
};

// Priority: summary → annual trends → quarterly → heavy cross-tabs
// Spark เริ่ม job เร็วขึ้นเมื่อ query เล็กขึ้น — เรียงจากเล็กไปใหญ่
const FETCH_PRIORITY = [
  'miceKpis',                  // aggregate 2 years — เล็กสุด
  'miceEventsChart',           // 20 rows annual
  'miceRevenueChart',          // 20 rows annual
  'miceVisitorsChart',         // 20 rows annual
  'miceEventsQuarterlyChart',  // 4 rows (Q1–Q4 CASE WHEN)
  'miceVisitorsQuarterlyChart',// 4 rows
  'miceNationalityPerformance',// ~20 nationality rows + country JOIN
  'miceNationalityIndustryMatrix', // nationality × sector pivot
  'miceVisitorsBreakdown',     // UNION ALL 3 groups
  'miceNationalityMatrixView', // UNION ALL industry + quarter views
  'miceDrillFlow',             // full hierarchy — หนักสุด
];

// ─────────────────────────────────────────────────────────────────────────────
// Async pool — limit concurrent promises (Spark concurrency guard)
// ─────────────────────────────────────────────────────────────────────────────
async function asyncPool(tasks, concurrency) {
  const results = new Array(tasks.length).fill(null);
  let cursor = 0;

  async function drain() {
    while (cursor < tasks.length) {
      const i = cursor++;
      try { results[i] = await tasks[i](); }
      catch { results[i] = null; }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, drain);
  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build query string from dashboard filter
// ─────────────────────────────────────────────────────────────────────────────
function buildParams(filter) {
  const f = filter || {};
  const params = {
    // ── Core filters (dashboard-level) ─────────────────────────────────────
    market:      f.market      || 'International',   // International | Domestic | all
    yearMode:    f.yearMode    || 'calendar',         // calendar | fiscal
    year:        f.year        ?? 2025,              // single selected year
    yearMin:     f.yearMin     ?? f.yearFrom ?? 2007,// range start
    yearMax:     f.yearMax     ?? f.yearTo   ?? 2025,// range end
    industry:    f.industry    || 'all',              // Meetings | Incentives | … | all
    country:     f.country     || 'all',              // country name or all
    // ── Segment filters (widget-level, passed when available) ───────────────
    continent:   f.continent   || 'all',              // Asia | Europe | … | all
    visitorType: f.visitorType || 'All',              // All | Thai | International (Tourism)
    iccaSubName: f.iccaSubName || 'Country',          // Country | City (ICCA)
  };
  // gdsDimension is an int — only include when explicitly set (0 is valid)
  if (f.gdsDimension != null) params.gdsDimension = f.gdsDimension;
  return new URLSearchParams(params).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch one widget endpoint → rows array
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRows(widgetKey, filter, signal) {
  const url = `${WIDGET_ENDPOINT(widgetKey)}?${buildParams(filter)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`${widgetKey}: HTTP ${res.status}`);
  const body = await res.json();
  return body?.data?.rows ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Data transformers — rows → fixedProfile sub-objects
// Column names from Blendata response match SQL aliases exactly
// ─────────────────────────────────────────────────────────────────────────────
function yoyPct(cur, prv) { return prv ? ((cur - prv) / Math.abs(prv)) * 100 : 0; }
const sumF = (arr, k) => arr.reduce((s, r) => s + Number(r[k] || 0), 0);
const num  = (v)       => Number(v) || 0;

// transformKpis — ใช้ _ly columns จาก view (pre-computed last year values)
// Fallback: ถ้า year ไม่ match → ใช้ latest year ที่มีใน rows
function transformKpis(rows, year) {
  let cur = rows.filter((r) => Number(r.year) === year);
  if (!cur.length) {
    // fallback: ใช้ latest year ที่ Blendata ส่งมา
    const maxYear = Math.max(...rows.map((r) => Number(r.year)));
    cur = rows.filter((r) => Number(r.year) === maxYear);
  }

  const events     = sumF(cur, 'no_of_events');
  const lastEvents = sumF(cur, 'no_of_events_ly');
  const visitors   = sumF(cur, 'no_of_visitors');
  const lastVis    = sumF(cur, 'no_of_visitors_ly');

  // Top industry by no_of_events (view may or may not have sector_name breakdown)
  const bySector = {};
  cur.forEach((r) => {
    const key = r.sector_name || 'All';
    bySector[key] = (bySector[key] || 0) + num(r.no_of_events);
  });
  const topIndustry = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  // Use pre-computed yoy_event from view when possible (avoids /0 edge cases)
  const eventsGrowth  = lastEvents ? yoyPct(events, lastEvents) : num(cur[0]?.yoy_event);
  const visitorsGrowth = lastVis   ? yoyPct(visitors, lastVis)  : num(cur[0]?.yoy_visitors);

  return {
    events,
    eventsGrowth,
    visitors,
    visitorsGrowth,
    topNationality:       '-',   // from miceNationalityPerformance separately
    topNationalityGrowth: 0,
    topIndustry,
  };
}

// Annual series — {year, value, lastYear, yoy} — widget uses value; lastYear/yoy extra context
function transformAnnualSeries(rows, valueKey, lyKey, yoyKey) {
  return rows
    .sort((a, b) => Number(a.year) - Number(b.year))
    .map((r) => ({
      year:     num(r.year),
      value:    num(r[valueKey]),
      lastYear: lyKey  ? num(r[lyKey])  : undefined,
      yoy:      yoyKey ? num(r[yoyKey]) : undefined,
    }));
}

// Quarterly chart — quarter values are already 'Q1'..'Q4' strings from view
function transformQuarterly(rows, thisYearKey, lastYearKey, yoyKey) {
  return rows
    .slice()
    .sort((a, b) => String(a.quarter).localeCompare(String(b.quarter)))
    .map((r) => ({
      quarter:  String(r.quarter),
      thisYear: num(r[thisYearKey]),
      lastYear: num(r[lastYearKey]),
      yoy:      yoyKey ? num(r[yoyKey]) : yoyPct(num(r[thisYearKey]), num(r[lastYearKey])),
    }));
}

function transformNationalityPerformance(rows) {
  return rows.map((r) => {
    const cur = Number(r.current_visitors || 0);
    const prv = Number(r.last_year_visitors || 0);
    return { continent: r.continent || '', nationality: r.nationality || '', current: cur, previous: prv, yoy: yoyPct(cur, prv) };
  });
}

function transformNationalityIndustryMatrix(rows) {
  const byNat = {};
  rows.forEach((r) => {
    if (!byNat[r.nationality]) byNat[r.nationality] = { nationality: r.nationality, Total: 0 };
    byNat[r.nationality][r.sector_name] = Number(r.visitors || 0);
    byNat[r.nationality].Total += Number(r.visitors || 0);
  });
  return Object.values(byNat).sort((a, b) => b.Total - a.Total);
}

function transformBreakdown(rows) {
  const nat   = rows.filter((r) => r.result_type === 'nationality').map((r) => ({ label: r.label, value: Number(r.visitors || 0) }));
  const ind   = rows.filter((r) => r.result_type === 'industry').map((r) => ({ label: r.label, value: Number(r.visitors || 0) }));
  const qtr   = rows.filter((r) => r.result_type === 'quarter').map((r) => ({ label: r.label, value: Number(r.visitors || 0) }));
  const total = nat.reduce((s, r) => s + r.value, 0);
  return { total, nationality: nat, industry: ind, quarter: qtr };
}

function transformMatrixView(rows) {
  function pivot(arr, dimKey) {
    const m = {};
    arr.forEach((r) => {
      if (!m[r.nationality]) m[r.nationality] = { nationality: r.nationality, Total: 0 };
      m[r.nationality][r[dimKey]] = Number(r.visitors || 0);
      m[r.nationality].Total += Number(r.visitors || 0);
    });
    return Object.values(m).sort((a, b) => b.Total - a.Total);
  }
  return {
    nationalityIndustryMatrix2025: pivot(rows.filter((r) => r.view_type === 'industry'), 'dimension'),
    nationalityQuarterMatrix:      pivot(rows.filter((r) => r.view_type === 'quarter'),  'dimension'),
  };
}

function transformDrillFlow(rows) {
  const natMap = {};
  rows.forEach((r) => {
    const nat = r.nationality;
    const ind = r.sector_name;
    const qtr = String(r.quarter).startsWith('Q') ? r.quarter : `Q${r.quarter}`;
    const val = Number(r.visitors || 0);

    if (!natMap[nat]) natMap[nat] = { label: nat, value: 0, industry: {} };
    natMap[nat].value += val;
    if (!natMap[nat].industry[ind]) natMap[nat].industry[ind] = { label: ind, value: 0, quarter: {} };
    natMap[nat].industry[ind].value += val;
    natMap[nat].industry[ind].quarter[qtr] = (natMap[nat].industry[ind].quarter[qtr] || 0) + val;
  });

  const natList = Object.values(natMap)
    .sort((a, b) => b.value - a.value)
    .map((n) => ({
      label: n.label,
      value: n.value,
      industry: Object.values(n.industry)
        .sort((a, b) => b.value - a.value)
        .map((i) => ({
          label: i.label,
          value: i.value,
          quarter: Object.entries(i.quarter)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, value]) => ({ label, value })),
        })),
    }));

  return { total: natList.reduce((s, n) => s + n.value, 0), nationality: natList };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply fetched rows to the fixedProfile object
// ─────────────────────────────────────────────────────────────────────────────
function applyToProfile(apiKey, rows, filter, profile) {
  const year = filter?.year ?? 2025;
  switch (apiKey) {
    case 'miceKpis':
      profile.kpis = transformKpis(rows, year);
      break;
    case 'miceEventsChart':
      // SQL: year, no_of_events, no_of_events_ly, yoy_event
      profile.charts.events = transformAnnualSeries(rows, 'no_of_events', 'no_of_events_ly', 'yoy_event');
      break;
    case 'miceRevenueChart':
      // SQL: year, revenue_generated, revenue_generated_ly, yoy_revenue
      profile.charts.revenue = transformAnnualSeries(rows, 'revenue_generated', 'revenue_generated_ly', 'yoy_revenue');
      break;
    case 'miceVisitorsChart':
      // SQL: year, no_of_visitors, no_of_visitors_ly, yoy_visitors
      profile.charts.visitors = transformAnnualSeries(rows, 'no_of_visitors', 'no_of_visitors_ly', 'yoy_visitors');
      break;
    case 'miceEventsQuarterlyChart':
      // SQL: year, quarter('Q1'..'Q4'), no_of_events, no_of_events_ly, yoy_event
      profile.chartsQuarterly.events = transformQuarterly(rows, 'no_of_events', 'no_of_events_ly', 'yoy_event');
      break;
    case 'miceVisitorsQuarterlyChart':
      // SQL: year, quarter('Q1'..'Q4'), no_of_visitors, no_of_visitors_ly, yoy_visitors
      profile.chartsQuarterly.visitors = transformQuarterly(rows, 'no_of_visitors', 'no_of_visitors_ly', 'yoy_visitors');
      break;
    case 'miceNationalityPerformance': {
      const natPerf = transformNationalityPerformance(rows);
      profile.nationalityPerformance = natPerf;
      // SQL returns ORDER BY current_visitors DESC → rows[0] = top nationality
      // อัปเดต kpis.topNationality จาก nationality view (miceKpis ใช้ cy_fy ไม่มี nationality)
      if (natPerf.length > 0) {
        const top = natPerf[0];
        if (!profile.kpis) profile.kpis = {};
        profile.kpis.topNationality       = top.nationality || '-';
        profile.kpis.topNationalityGrowth = num(top.yoy);
      }
      break;
    }
    case 'miceNationalityIndustryMatrix':
      profile.nationalityIndustryMatrix = transformNationalityIndustryMatrix(rows);
      break;
    case 'miceVisitorsBreakdown':
      profile.breakdown = transformBreakdown(rows);
      break;
    case 'miceNationalityMatrixView': {
      const mv = transformMatrixView(rows);
      profile.nationalityIndustryMatrix2025 = mv.nationalityIndustryMatrix2025;
      profile.nationalityQuarterMatrix      = mv.nationalityQuarterMatrix;
      break;
    }
    case 'miceDrillFlow':
      profile.sankeyFlow = transformDrillFlow(rows);
      break;
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// activeWidgets = array of { type, ... } from activeDashboard.widgets
// Only fetches API keys needed by widgets currently on the dashboard
// Concurrency capped at SPARK_CONCURRENCY to avoid Spark job overload
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchWidgetsOnDashboard(activeWidgets, filter, signal) {
  // 1. Collect API keys needed (de-duped)
  const neededKeys = new Set();
  activeWidgets.forEach((w) => {
    (WIDGET_API_KEYS[w.type] || []).forEach((k) => neededKeys.add(k));
  });

  if (!neededKeys.size) return null;

  // 2. Order by priority (smaller/faster queries first → warms Spark up quickly)
  const orderedKeys = FETCH_PRIORITY.filter((k) => neededKeys.has(k));

  console.log(
    `[widgetApi] fetching ${orderedKeys.length} widgets: [${orderedKeys.join(', ')}]  concurrency=${SPARK_CONCURRENCY}`
  );
  const t0 = performance.now();

  // 3. Build task list + fetch with concurrency limit
  const rowsByKey = {};
  const tasks = orderedKeys.map((key) => async () => {
    const ts = performance.now();
    rowsByKey[key] = await fetchRows(key, filter, signal);
    const ms = Math.round(performance.now() - ts);
    const rowCount = rowsByKey[key]?.length ?? 'err';
    console.log(`[widgetApi] ${key}  rows=${rowCount}  took=${ms}ms`);
  });

  await asyncPool(tasks, SPARK_CONCURRENCY);

  const totalMs = Math.round(performance.now() - t0);
  console.log(`[widgetApi] all done  total=${totalMs}ms  concurrency=${SPARK_CONCURRENCY}`);

  // 4. Build fixedProfile from successful results
  const profile = { charts: {}, chartsQuarterly: {} };
  orderedKeys.forEach((key) => {
    if (rowsByKey[key] != null) applyToProfile(key, rowsByKey[key], filter, profile);
  });

  return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute stable key representing which MICE widget types are active
// Used as useEffect dependency in App.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function activeMiceWidgetKey(widgets) {
  const types = new Set();
  widgets.forEach((w) => {
    if (WIDGET_API_KEYS[w.type]) types.add(w.type === 'miceStatCard' ? 'miceKpis' : w.type);
  });
  return [...types].sort().join(',');
}
