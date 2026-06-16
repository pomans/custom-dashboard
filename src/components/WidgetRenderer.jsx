import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { fetchWidgetDirect, fetchMasterSectors, fetchMasterCountries, transformDrillFlow } from '../services/widgetApi';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  ReferenceArea,
  XAxis,
  YAxis
} from 'recharts';

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
const SERIES_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6'];

const axisValueFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatCellValue = (value) => {
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000000) {
      return axisValueFormatter.format(value);
    }

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 1
    }).format(value);
  }

  return value ?? '-';
};

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatMetricValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return compactNumberFormatter.format(value);
};

const formatAxisTickValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  return compactNumberFormatter.format(value);
};

const formatPercentValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${compactNumberFormatter.format(value)}%`;
};

const fullNumberFormatter = new Intl.NumberFormat('en-US');

const formatYAxisTickFull = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  return fullNumberFormatter.format(value);
};

const formatYAxisTickMillions = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  return `${(value / 1000000).toFixed(1)}M`;
};

const formatYAxisTickThousands = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  if (value === 0) return '0K';
  return value >= 1000 ? `${Math.round(value / 1000)}K` : value;
};

const getExpressionContext = () => ({
  current_date: new Date()
});

const expressionFunctions = {
  year: (date) => date.getFullYear(),
  buddhist_year: (date) => date.getFullYear() + 543,
  month: (date) => date.getMonth() + 1,
  month_name: (date) => date.toLocaleDateString('th-TH', { month: 'long' }),
  day: (date) => date.getDate(),
  format_date: (date) =>
    date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
};

const resolveExpressionArgument = (argument, context) => {
  const trimmed = argument.trim();

  if (context[trimmed] instanceof Date) return context[trimmed];
  if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);

  return trimmed;
};

const normalizeExpression = (expression) => {
  let depth = 0;

  return expression
    .split('')
    .filter((char) => {
      if (char === '(') {
        depth += 1;
        return true;
      }

      if (char === ')') {
        if (depth === 0) return false;
        depth -= 1;
        return true;
      }

      return true;
    })
    .join('');
};

const parseNumericExpression = (expression) => {
  const source = expression.replace(/\s+/g, '');
  let index = 0;

  const parseNumber = () => {
    const start = index;

    while (/\d|\./.test(source[index] || '')) {
      index += 1;
    }

    if (start === index) return null;

    const value = Number(source.slice(start, index));
    return Number.isNaN(value) ? null : value;
  };

  const parseFactor = () => {
    if (source[index] === '+') {
      index += 1;
      return parseFactor();
    }

    if (source[index] === '-') {
      index += 1;
      const value = parseFactor();
      return value === null ? null : -value;
    }

    if (source[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (source[index] !== ')') return null;
      index += 1;
      return value;
    }

    return parseNumber();
  };

  const parseTerm = () => {
    let value = parseFactor();
    if (value === null) return null;

    while (source[index] === '*' || source[index] === '/') {
      const operator = source[index];
      index += 1;
      const nextValue = parseFactor();
      if (nextValue === null) return null;

      value = operator === '*' ? value * nextValue : value / nextValue;
    }

    return value;
  };

  function parseExpression() {
    let value = parseTerm();
    if (value === null) return null;

    while (source[index] === '+' || source[index] === '-') {
      const operator = source[index];
      index += 1;
      const nextValue = parseTerm();
      if (nextValue === null) return null;

      value = operator === '+' ? value + nextValue : value - nextValue;
    }

    return value;
  }

  const result = parseExpression();
  if (result === null || index !== source.length || !Number.isFinite(result)) return null;

  return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(2)));
};

const evaluateExpressionToken = (token, context) => {
  const expression = normalizeExpression(token.trim());
  if (context[expression] instanceof Date) return expressionFunctions.format_date(context[expression]);

  const hydratedExpression = expression.replace(
    /([a-z_][a-z0-9_]*)\(([^()]*)\)/gi,
    (fullMatch, functionName, rawArgument) => {
      const expressionFunction = expressionFunctions[functionName];
      if (!expressionFunction) return fullMatch;

      const argument = resolveExpressionArgument(rawArgument, context);
      if (!(argument instanceof Date)) return fullMatch;

      return String(expressionFunction(argument));
    }
  );

  if (hydratedExpression !== expression && /^[\d+\-*/().\s]+$/.test(hydratedExpression)) {
    return parseNumericExpression(hydratedExpression) ?? '';
  }

  if (hydratedExpression !== expression) return hydratedExpression;

  if (/^[\d+\-*/().\s]+$/.test(expression)) {
    return parseNumericExpression(expression) ?? '';
  }

  return '';
};

const renderTextExpression = (expression, fallback) => {
  const template = expression || fallback || '';
  const context = getExpressionContext();

  return template.replace(/\$\{([^}]+)\}/g, (_, token) =>
    String(evaluateExpressionToken(token, context))
  );
};

const aggregateRecords = (records, fieldKey, aggregation = 'sum') => {
  if (aggregation === 'count') return records.length;

  const values = records.map((record) => Number(record[fieldKey])).filter((value) => !Number.isNaN(value));
  if (!values.length) return 0;

  if (aggregation === 'avg') {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  if (aggregation === 'min') return Math.min(...values);
  if (aggregation === 'max') return Math.max(...values);

  return values.reduce((sum, value) => sum + value, 0);
};

const buildAnnualSeries = (records, metricField, aggregation = 'sum') => {
  const grouped = records.reduce((acc, record) => {
    const year = Number(record.year);
    if (!year) return acc;
    if (!acc[year]) acc[year] = [];
    acc[year].push(record);
    return acc;
  }, {});

  const years = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const actualSeries = years.map((year) => ({
    year,
    value: aggregateRecords(grouped[year], metricField, aggregation)
  }));

  const recent = actualSeries.slice(-3);
  const deltas = recent.slice(1).map((item, index) => item.value - recent[index].value);
  const slope = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  const lastValue = actualSeries[actualSeries.length - 1]?.value || 0;
  const lastYear = actualSeries[actualSeries.length - 1]?.year || years[years.length - 1] || 2026;
  const forecastSeries = Array.from({ length: 4 }, (_, index) => {
    const year = lastYear + index + 1;
    const decay = Math.max(0.18, 1 - index * 0.14);
    return {
      year,
      value: Math.max(0, Math.round(lastValue + slope * (index + 1) * decay)),
      forecast: true
    };
  });

  const yoy = actualSeries.map((item, index) => {
    const previous = actualSeries[index - 1]?.value;
    const delta = typeof previous === 'number' && previous !== 0 ? ((item.value - previous) / Math.abs(previous)) * 100 : null;
    return {
      ...item,
      yoy: delta
    };
  });

  return { actualSeries: yoy, forecastSeries };
};

const buildForecastSeries = (actualSeries, futureYears = 4) => {
  const recent = actualSeries.slice(-3);
  const deltas = recent.slice(1).map((item, index) => item.value - recent[index].value);
  const slope = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  const lastValue = actualSeries[actualSeries.length - 1]?.value || 0;
  const lastYear = actualSeries[actualSeries.length - 1]?.year || 2026;

  return Array.from({ length: futureYears }, (_, index) => {
    const year = lastYear + index + 1;
    const decay = Math.max(0.18, 1 - index * 0.14);
    return {
      year,
      value: Math.max(0, Math.round(lastValue + slope * (index + 1) * decay)),
      forecast: true
    };
  });
};

/* ─── Holt's damped-trend exponential smoothing ──────────────────
 * Forecast method PBI uses for non-seasonal annual time series.
 * State update:
 *   L_t = α·y_t + (1-α)·(L_{t-1} + φ·T_{t-1})
 *   T_t = β·(L_t - L_{t-1}) + (1-β)·φ·T_{t-1}
 * Forecast h steps ahead:
 *   F_{n+h} = L_n + (φ + φ² + … + φ^h)·T_n
 * α, β, φ: smoothing/damping factors. Defaults work well for annual MICE data.
 * ──────────────────────────────────────────────────────────────── */
// Fit Holt's damped-trend model with parameters (α, β, φ) and return SSE + final state.
const _fitHolt = (data, alpha, beta, phi) => {
  let level = data[0].value;
  let trend = data[1].value - data[0].value;
  let sse = 0;
  const residuals = [];
  for (let i = 1; i < data.length; i++) {
    const y = data[i].value;
    const yhat = level + phi * trend;
    const r = y - yhat;
    residuals.push(r);
    sse += r * r;
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }
  return { level, trend, sse, residuals };
};

const holtForecast = (series, horizon = 5) => {
  const data = series.filter(p => Number.isFinite(p.value));
  if (data.length < 3) return [];

  // Grid search optimal (α, β, φ) by minimizing SSE — emulates PBI's ETS MLE.
  const alphas = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const betas  = [0.05, 0.1, 0.15, 0.2, 0.3];
  const phis   = [0.80, 0.85, 0.90, 0.95, 0.98];
  let best = { sse: Infinity, alpha: 0.2, beta: 0.1, phi: 0.9, state: null };
  for (const a of alphas) for (const b of betas) for (const p of phis) {
    const fit = _fitHolt(data, a, b, p);
    if (fit.sse < best.sse) best = { sse: fit.sse, alpha: a, beta: b, phi: p, state: fit };
  }
  const { alpha, phi, state: { level, trend, residuals } } = best;

  // σ from in-sample residuals — PBI's ETS uses MAD-based scale which is robust to outliers
  // (the COVID years 2020-2022 create huge residuals that would inflate raw stdev).
  // We use MAD * 1.4826 (consistent estimator for σ under normal assumption).
  const absRes = residuals.map(r => Math.abs(r)).sort((a, b) => a - b);
  const mad = absRes[Math.floor(absRes.length / 2)] || 0;
  const sigma = mad * 1.4826;
  const Z95 = 1.96;
  const lastYear = data[data.length - 1].year;
  const lastVal  = data[data.length - 1].value;
  const out = [];
  // Damped-trend cumulative factor: (φ + φ² + ... + φ^h)
  let phiSum = 0;
  // Forecast variance for damped trend (Hyndman et al., 2008):
  //   Var(F_{n+h}) = σ² · Σ_{j=0}^{h-1} c_j²
  //   where c_j = α + (α·(φ + ... + φ^j)) · (β·(1+...) / (1-?))
  // Simpler approximation used in PBI-style display: variance grows roughly linearly in h.
  let varSum = 1;
  for (let h = 1; h <= horizon; h++) {
    phiSum += Math.pow(phi, h);
    const value = Math.max(0, Math.round(level + phiSum * trend));
    if (h > 1) varSum += 1 + (h - 1) * alpha * alpha;
    const sigmaH = sigma * Math.sqrt(varSum);
    const upper  = Math.round(value + Z95 * sigmaH);
    const lower  = Math.max(0, Math.round(value - Z95 * sigmaH));
    out.push({ year: lastYear + h, value, upper, lower, forecast: true });
  }
  return [{ year: lastYear, value: lastVal, upper: lastVal, lower: lastVal, forecast: true }, ...out];
};

const computeYoY = (currentValue, previousValue) => {
  if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) return null;
  if (typeof previousValue !== 'number' || Number.isNaN(previousValue)) return null;
  if (previousValue === 0) {
    if (currentValue === 0) return 0;
    return currentValue > 0 ? 100 : -100;
  }

  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
};

const buildCategorySeries = (records, categoryField, metricField, aggregation = 'sum') => {
  const grouped = records.reduce((acc, record) => {
    const key = record[categoryField] || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([label, groupRecords]) => ({
      label,
      value: aggregateRecords(groupRecords, metricField, aggregation)
    }))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
};

const formatAnnualTick = (value) => `'${String(value).slice(2)}`;

const renderQuarterlyLegend = () => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 13, color: '#374151', marginBottom: 4 }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="28" height="12"><line x1="0" y1="6" x2="28" y2="6" stroke="#081f68" strokeWidth="2.5" /><circle cx="14" cy="6" r="4" fill="#081f68" /></svg>
      This Year
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="28" height="12"><line x1="0" y1="6" x2="28" y2="6" stroke="#7ec8e3" strokeWidth="2" strokeDasharray="5 3" /><circle cx="14" cy="6" r="4" fill="#7ec8e3" /></svg>
      Last Year
    </span>
  </div>
);

function QuarterlyChartPanel({ title, color, yLabel, yTickFormatter, widgetKey, globalFilter, defaultData, valueKey, lyKey }) {
  const showGeoFilter = widgetKey === 'miceVisitorsQuarterlyChart';
  // All filters come from the global filter panel
  const gContinent  = showGeoFilter ? (globalFilter?.continent || 'all') : 'all';
  const gCountry    = showGeoFilter ? (globalFilter?.country   || 'all') : 'all';
  const gQuarters   = (globalFilter?.quarters || 'Q1,Q2,Q3,Q4').split(',').map(s => s.trim()).filter(Boolean);
  const gIndustry   = globalFilter?.industry || 'all';
  const selectedYear = globalFilter?.yearMax ?? globalFilter?.year ?? 2025;

  const [localData, setLocalData] = useState(null);
  const [loading,   setLoading]   = useState(false);

  // Always fetch with only the params relevant to this chart — no yearMin/yearMax
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const filter = {
      market:   globalFilter?.market   || 'International',
      yearMode: globalFilter?.yearMode || 'calendar',
      year:     selectedYear,
      quarters: gQuarters.join(','),
      industry: gIndustry,
      ...(gContinent !== 'all' ? { continent: gContinent } : {}),
      ...(gCountry   !== 'all' ? { country:   gCountry   } : {}),
    };
    fetchWidgetDirect(widgetKey, filter, ac.signal)
      .then((rows) => {
        if (ac.signal.aborted) return;
        const toNum = (v) => Number(v) || 0;
        const transformed = (rows || [])
          .sort((a, b) => String(a.quarter).localeCompare(String(b.quarter)))
          .map((r) => ({
            quarter:  String(r.quarter),
            thisYear: toNum(r[valueKey]),
            lastYear: lyKey ? toNum(r[lyKey]) : 0,
          }));
        setLocalData(transformed);
        setLoading(false);
      })
      .catch(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [selectedYear, globalFilter?.quarters, globalFilter?.industry, gContinent, gCountry, widgetKey, globalFilter?.market, globalFilter?.yearMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // quarter อนาคต: thisYear = null (ไม่ plot) แต่ lastYear ยังแสดงอยู่
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentQ = currentMonth <= 3 ? 'Q1' : currentMonth <= 6 ? 'Q2' : currentMonth <= 9 ? 'Q3' : 'Q4';
  const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4'];
  const rawData = localData ?? defaultData ?? [];
  const data = rawData.map((row) => {
    const isFuture = selectedYear >= currentYear &&
      QUARTER_ORDER.indexOf(row.quarter) > QUARTER_ORDER.indexOf(currentQ);
    return isFuture ? { ...row, thisYear: null } : row;
  });
  const withYoy = data.map((row) => ({
    ...row,
    yoy: (row.thisYear != null && row.lastYear)
      ? ((row.thisYear - row.lastYear) / Math.abs(row.lastYear)) * 100
      : null,
  }));

  return (
    <div className="fixed-mice-chart">
      <div className="fixed-mice-chart-header">
        <div className="fixed-mice-chart-title" style={{ background: color }}>{title}</div>
        <div className="fixed-mice-chart-rule" />
      </div>
      {loading ? (
        <div className="fixed-mice-chart-body">
          <WidgetSkeleton type="miceEventsQuarterlyChart" />
        </div>
      ) : (
        <>
          {renderQuarterlyLegend()}
          <div className="fixed-mice-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={withYoy} margin={{ top: 28, right: 24, bottom: 28, left: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eaf2" />
                <XAxis dataKey="quarter" tick={{ fontSize: 13 }} tickMargin={8} />
                <YAxis tickFormatter={yTickFormatter || formatAxisTickValue} width={72} tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(quarter) => `Quarter ${quarter}`}
                  formatter={(value, name) => [formatMetricValue(Number(value)), name]}
                />
                <Line type="monotone" dataKey="thisYear" name="This Year" stroke="#081f68" strokeWidth={3} dot={{ r: 5, fill: '#081f68', stroke: '#081f68' }} activeDot={{ r: 7 }}>
                  <LabelList dataKey="yoy" content={renderYoyBadge} />
                </Line>
                <Line type="monotone" dataKey="lastYear" name="Last Year" stroke="#7ec8e3" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: '#7ec8e3', stroke: '#7ec8e3' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="fixed-mice-chart-axis-label">{yLabel}</div>
        </>
      )}
    </div>
  );
}

const renderYoyBadge = ({ x, y, value }) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  const positive = value >= 0;
  const text = `${positive ? '▲' : '▼'} ${positive ? '' : '-'}${Math.abs(value).toFixed(1)}%`;
  const fill = positive ? '#1faa2f' : '#ff3b1f';
  const boxWidth = Math.max(72, text.length * 7.2);
  const boxX = x - boxWidth / 2;
  const boxY = positive ? y - 34 : y + 10;

  return (
    <g>
      <rect x={boxX} y={boxY} width={boxWidth} height={24} rx="5" fill="#f3efec" opacity="0.8" />
      <text x={x} y={boxY + 16} textAnchor="middle" fill={fill} fontSize="14" fontWeight="600">
        {text}
      </text>
    </g>
  );
};

function FixedChartPanel({ widgetKey, title, color, yLabel, actualSeries, forecastSeries, yTickFormatter, valueKey, lyKey, yoyKey, globalFilter }) {
  const series = actualSeries;
  // Forecast computation kept for tooltip values, but excluded from chart x-domain.
  const forecast = [];

  // Merge into single data array with separate keys so Recharts renders two distinct lines
  // (one solid for actual, one dashed for forecast). Bridge point at boundary gets both.
  const merged = (() => {
    const lastActual = series[series.length - 1];
    const out = series.map(s => ({
      year: s.year, actualValue: s.value, forecastValue: null,
      forecastUpper: null, forecastLower: null, forecastRange: null,
      yoy: s.yoy,
    }));
    forecast.forEach((f) => {
      const range = (f.upper != null && f.lower != null) ? f.upper - f.lower : null;
      if (lastActual && f.year === lastActual.year) {
        const idx = out.findIndex(p => p.year === f.year);
        if (idx >= 0) {
          out[idx].forecastValue = f.value;
          out[idx].forecastLower = f.lower ?? f.value;
          out[idx].forecastRange = range ?? 0;
        }
      } else {
        out.push({
          year: f.year, actualValue: null, forecastValue: f.value,
          forecastUpper: f.upper, forecastLower: f.lower, forecastRange: range,
          yoy: null,
        });
      }
    });
    return out;
  })();

  const renderForecastTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    const isForecast = row.forecastValue != null && row.actualValue == null;
    if (isForecast) {
      return (
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 16, rowGap: 2 }}>
            <span style={{ color: '#5fb0c4' }}>● Forecast</span><span style={{ textAlign: 'right' }}>{formatMetricValue(row.forecastValue)}</span>
            {row.forecastUpper != null && (<><span style={{ color: '#64748b' }}>Upper bound</span><span style={{ textAlign: 'right' }}>{formatMetricValue(row.forecastUpper)}</span></>)}
            {row.forecastLower != null && (<><span style={{ color: '#64748b' }}>Lower bound</span><span style={{ textAlign: 'right' }}>{formatMetricValue(row.forecastLower)}</span></>)}
          </div>
        </div>
      );
    }
    return (
      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
        <div>{yLabel}: <strong>{formatMetricValue(row.actualValue)}</strong></div>
      </div>
    );
  };

  return (
    <div className="fixed-mice-chart">
      <div className="fixed-mice-chart-header">
        <div className="fixed-mice-chart-title" style={{ background: color }}>{title}</div>
        <div className="fixed-mice-chart-rule" />
      </div>
      <div className="fixed-mice-chart-body">
        <div className="fixed-mice-chart-axis-label">{yLabel}</div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 42, right: 18, bottom: 10, left: 3 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            {series.map((entry) =>
              entry.year % 2 === 0 ? (
                <ReferenceArea key={`band-${entry.year}`} x1={entry.year-0.5} x2={entry.year+0.5} fill="#d9d9d9" fillOpacity={0.35} ifOverflow="extendDomain" />
              ) : null
            )}
            <XAxis dataKey="year" tickFormatter={formatAnnualTick} interval={0} height={44} tick={{ angle: -45, textAnchor: 'end', fontSize: 10 }} tickMargin={4} />
            <YAxis tickFormatter={yTickFormatter || formatAxisTickValue} width={82} />
            <Tooltip content={renderForecastTooltip} />
            <Line
              type="monotone"
              dataKey="actualValue"
              name={yLabel}
              stroke="#0f1f68"
              strokeWidth={3.5}
              dot={{ r: 5, fill: '#0f1f68' }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            >
              <LabelList dataKey="yoy" content={renderYoyBadge} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const buildChartRows = (records, widget) => {
  const xField = widget.mapping?.xField;
  const yFields = widget.mapping?.yFields || [];
  const aggregation = widget.mapping?.aggregation || 'sum';

  if (!xField || !yFields.length) return [];

  const grouped = records.reduce((acc, record) => {
    const key = record[xField] ?? 'Other';
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(record);
    return acc;
  }, {});

  return Object.entries(grouped).map(([groupKey, groupRecords]) => {
    const row = { [xField]: groupKey };

    yFields.forEach((fieldKey) => {
      row[fieldKey] = aggregateRecords(groupRecords, fieldKey, aggregation);
    });

    return row;
  });
};

const buildRankingRows = (records, mapping) => {
  const labelField = mapping?.labelField;
  const valueField = mapping?.valueField;
  const sortDirection = mapping?.sortDirection || 'desc';
  const limit = Math.max(1, Number(mapping?.limit) || 5);

  if (!labelField || !valueField) return [];

  const grouped = records.reduce((acc, record) => {
    const label = record[labelField] || 'Other';
    acc[label] = (acc[label] || 0) + (Number(record[valueField]) || 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => (sortDirection === 'asc' ? a.value - b.value : b.value - a.value))
    .slice(0, limit);
};

const summarizeTrend = (metricValue, comparisonValue) => {
  if (typeof comparisonValue !== 'number') {
    return { direction: 'neutral', delta: null, deltaPercent: null };
  }

  const delta = metricValue - comparisonValue;
  const deltaPercent = comparisonValue === 0 ? null : (delta / Math.abs(comparisonValue)) * 100;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';

  return { direction, delta, deltaPercent };
};

const resolveSummaryTheme = (theme, direction) => {
  if (theme && theme !== 'auto') return theme;

  if (direction === 'up') return 'emerald';
  if (direction === 'down') return 'rose';

  return 'slate';
};

const buildTreemapRows = (records, mapping) => {
  const labelField = mapping?.labelField;
  const valueField = mapping?.valueField;
  const groupField = mapping?.groupField;

  if (!labelField || !valueField) return [];

  if (!groupField) {
    return records.map((record) => ({
      name: record[labelField],
      size: Number(record[valueField]) || 0
    }));
  }

  const groups = records.reduce((acc, record) => {
    const groupName = record[groupField] || 'Other';
    if (!acc[groupName]) acc[groupName] = [];

    acc[groupName].push({
      name: record[labelField],
      size: Number(record[valueField]) || 0
    });

    return acc;
  }, {});

  return Object.entries(groups).map(([name, children]) => ({ name, children }));
};

const buildTopLabelRow = (records, mapping) => {
  const groupField = mapping?.groupField;
  const valueField = mapping?.valueField;
  const sortDirection = mapping?.sortDirection || 'desc';
  const limit = Math.max(1, Number(mapping?.limit) || 1);
  const rows = buildRankingRows(records, {
    labelField: groupField,
    valueField,
    sortDirection,
    limit
  });

  return rows[0] || null;
};

const aggregateByKey = (records, groupField, valueField, aggregation = 'sum') => {
  if (!groupField || !valueField) return [];

  const grouped = records.reduce((acc, record) => {
    const key = record[groupField] || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return Object.entries(grouped).map(([label, groupRecords]) => ({
    label,
    value: aggregateRecords(groupRecords, valueField, aggregation)
  }));
};

const buildPerformanceRows = (records, fields, options = {}) => {
  const {
    periodField = 'quarterLabel',
    metricField,
    comparisonField,
    labelField = 'country',
    aggregation = 'sum',
    sortBy = metricField,
    limit = 15
  } = options;

  const grouped = records.reduce((acc, record) => {
    const key = record[periodField] || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const seriesRows = Object.entries(grouped).map(([label, groupRecords]) => ({
    label,
    thisYear: aggregateRecords(groupRecords, metricField, aggregation),
    lastYear: comparisonField ? aggregateRecords(groupRecords, comparisonField, aggregation) : null
  }));

  const tableRows = aggregateByKey(records, labelField, metricField, aggregation)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, limit);

  return { seriesRows, tableRows, labelFieldName: fields?.[labelField]?.label || labelField, metricLabel: fields?.[metricField]?.label || metricField };
};

const formatYoY = (currentValue, previousValue) => {
  if (typeof currentValue !== 'number' || typeof previousValue !== 'number') return null;
  if (previousValue === 0) return null;
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
};

/* ─────────────────────────────────────────────
   MiceNationalityMatrixView
   Industry / Period toggle matrix
───────────────────────────────────────────── */
const fmt = new Intl.NumberFormat('en-US');

/* ─── Widget inline filter chip bar ─────────────────────────── */
function WidgetFilterBar({ label, options, value, onChange }) {
  return (
    <div className="wfb-wrap">
      {label && <span className="wfb-label">{label}</span>}
      <div className="wfb-chips">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`wfb-chip${value === opt.value ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── useChartLocalFilter: per-widget quarter/industry filter + fetch ───── */
const ALL_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Fallback sectors ใช้ขณะ API ยังไม่ตอบ
const FALLBACK_SECTORS = [
  { name: 'Meeting',     short: 'Meeting'     },
  { name: 'Incentives',  short: 'Incentives'  },
  { name: 'Conventions', short: 'Conventions' },
  { name: 'Exhibitions', short: 'Exhibitions' },
  { name: 'Mega Events', short: 'Mega Events' },
];

// Module-level sector cache — โหลดครั้งเดียว แชร์ทุก instance
let _cachedSectors = null;

function useSectors() {
  const [sectors, setSectors] = useState(() => _cachedSectors || FALLBACK_SECTORS);
  useEffect(() => {
    if (_cachedSectors) return;
    fetchMasterSectors().then((data) => {
      if (data) { _cachedSectors = data; setSectors(data); }
    });
  }, []);
  return sectors;
}

let _cachedCountries = null;
function useCountries() {
  const [countries, setCountries] = useState(() => _cachedCountries || []);
  useEffect(() => {
    if (_cachedCountries) return;
    fetchMasterCountries().then((data) => {
      if (data) { _cachedCountries = data; setCountries(data); }
    });
  }, []);
  return countries;
}

function useChartLocalFilter(widgetKey, globalFilter, transformFn) {
  const sectors    = useSectors();
  const allIndNames = sectors.map((s) => s.name);

  const [quarters,   setQuarters]   = useState(ALL_QUARTERS);
  const [industries, setIndustries] = useState(allIndNames);
  const [localData,  setLocalData]  = useState(null);
  const [loading,    setLoading]    = useState(false);

  // เมื่อ sectors โหลดใหม่จาก API และ user ยังไม่ได้ filter → sync ให้ครบ
  const prevAllRef = React.useRef(allIndNames);
  useEffect(() => {
    const prev = prevAllRef.current;
    if (JSON.stringify(prev) !== JSON.stringify(allIndNames)) {
      prevAllRef.current = allIndNames;
      setIndustries((cur) =>
        cur.length === prev.length && prev.every((n) => cur.includes(n))
          ? allIndNames
          : cur
      );
    }
  }, [JSON.stringify(allIndNames)]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAllInds  = industries.length === allIndNames.length && allIndNames.every((n) => industries.includes(n));
  const isDefault  = quarters.length === ALL_QUARTERS.length && isAllInds;

  useEffect(() => {
    if (isDefault) { setLocalData(null); return; }
    const ac = new AbortController();
    setLoading(true);
    const filter = {
      ...(globalFilter || {}),
      quarters: quarters.join(','),
      industry: isAllInds ? 'all' : industries.join(','),
      nocache:  true,
    };
    fetchWidgetDirect(widgetKey, filter, ac.signal)
      .then((rows) => { if (!ac.signal.aborted) { setLocalData(transformFn(rows)); setLoading(false); } })
      .catch(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [quarters, industries, widgetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { quarters, setQuarters, industries, setIndustries, localData, loading, isDefault };
}

/* Compact filter toolbar ภายใน chart widget */
function ChartLocalFilter({ quarters, setQuarters, industries, setIndustries, year, setYear, yearOptions }) {
  const sectors = useSectors();

  const toggleQ = (q) => setQuarters((prev) =>
    prev.includes(q) ? (prev.length > 1 ? prev.filter((x) => x !== q) : prev) : [...prev, q].sort()
  );
  const toggleInd = (ind) => setIndustries((prev) =>
    prev.includes(ind) ? (prev.length > 1 ? prev.filter((x) => x !== ind) : prev) : [...prev, ind]
  );

  return (
    <div className="chart-local-filter">
      {year != null && setYear && yearOptions?.length > 0 && (
        <div className="clf-group">
          <span className="clf-label">Year</span>
          <select
            className="clf-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}
      <div className="clf-group">
        <span className="clf-label">Quarter</span>
        <div className="clf-chips">
          {ALL_QUARTERS.map((q) => (
            <button key={q} type="button" className={quarters.includes(q) ? 'active' : ''} onClick={() => toggleQ(q)}>{q}</button>
          ))}
        </div>
      </div>
      <div className="clf-group">
        <span className="clf-label">Type</span>
        <div className="clf-chips">
          {sectors.map((s) => (
            <button
              key={s.name}
              type="button"
              title={s.name}
              className={industries.includes(s.name) ? 'active' : ''}
              onClick={() => toggleInd(s.name)}
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── WidgetSkeleton: shimmer placeholder ขณะ loading API data ─────────── */
const CHART_WIDGET_TYPES = new Set([
  'miceEventsChart', 'miceRevenueChart', 'miceVisitorsChart',
  'miceEventsQuarterlyChart', 'miceVisitorsQuarterlyChart',
]);
const TABLE_WIDGET_TYPES = new Set([
  'miceNationalityPerformance', 'miceNationalityIndustryMatrix',
  'miceNationalityMatrixView', 'miceDrillFlow',
]);

function WidgetSkeleton({ type }) {
  /* KPI card */
  if (type === 'miceStatCard' || type === 'miceKpis') {
    return (
      <div className="sk-kpi">
        <div className="sk sk-kpi-value" />
        <div className="sk sk-kpi-label" />
      </div>
    );
  }

  /* Line / bar charts */
  if (CHART_WIDGET_TYPES.has(type)) {
    // quarterly: 4 labels (Q1-Q4), annual: 10 labels
    const isQuarterly = type === 'miceEventsQuarterlyChart' || type === 'miceVisitorsQuarterlyChart';
    const labelCount  = isQuarterly ? 4 : 10;
    return (
      <div className="sk-chart">
        <div className="sk sk-chart-title" />
        <div className="sk-chart-area">
          <div className="sk-chart-line" />
        </div>
        {/* x-axis label placeholders — แยกออกจาก chart area เพื่อไม่ให้โดน clip */}
        <div className="sk-chart-labels">
          {Array.from({ length: labelCount }).map((_, i) => (
            <div key={i} className="sk sk-chart-label" />
          ))}
        </div>
      </div>
    );
  }

  /* Table / matrix / flow */
  if (TABLE_WIDGET_TYPES.has(type)) {
    const rows = [100, 80, 60, 45, 70, 55, 85];
    return (
      <div className="sk-table">
        <div className="sk sk-table-title" />
        {rows.map((w, i) => (
          <div key={i} className="sk-table-row">
            <div className="sk sk-table-cell" style={{ width: '30%' }} />
            <div className="sk sk-table-cell" style={{ width: `${w * 0.55}%` }} />
            <div className="sk sk-table-cell" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    );
  }

  /* Generic */
  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="sk" style={{ width: '50%', height: 14 }} />
      <div className="sk" style={{ flex: 1 }} />
    </div>
  );
}

/* ─── ShrinkText: font ใหญ่สุดเท่าที่พอดี container ──────────────────────── */
const CHAR_WIDTH_RATIO = 0.62; // อัตราส่วน char width / font-size สำหรับ bold font

function ShrinkText({ text, maxPx = 56, minPx = 10, style = {}, className = '' }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxPx);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // rAF เพื่อให้ flex layout complete ก่อนวัด clientWidth
    const raf = requestAnimationFrame(() => {
      const cw = container.clientWidth;
      if (!cw) return;

      const str = String(text);
      const hasSpace = str.includes(' ');

      let fitted;
      if (hasSpace) {
        // มีเว้นวรรค → คำนวณจาก longest word
        const longestWord = str.split(/\s+/).reduce((a, b) => a.length > b.length ? a : b, '');
        fitted = Math.floor(cw / (longestWord.length * CHAR_WIDTH_RATIO));
      } else {
        // ไม่มีเว้นวรรค → คำนวณจาก full string (single line)
        fitted = Math.floor(cw / (str.length * CHAR_WIDTH_RATIO));
      }

      setFontSize(Math.max(minPx, Math.min(maxPx, fitted)));
    });

    return () => cancelAnimationFrame(raf);
  }, [text, maxPx, minPx]);

  const hasSpace = String(text).includes(' ');

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <strong
        className={className}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.2,
          textAlign: 'center',
          display: 'block',
          width: '100%',
          whiteSpace: hasSpace ? 'normal' : 'nowrap',
          wordBreak: hasSpace ? 'normal' : 'keep-all',
          ...style,
        }}
      >
        {text}
      </strong>
    </div>
  );
}

/* ─── Nationality Performance — PBI-style heatmap table ─────────── */
function MiceNationalityPerformanceWidget({ fixedProfile }) {
  const allRows = (fixedProfile.nationalityPerformance || [])
    .filter(r => r.nationality && String(r.nationality).trim());
  // sortKey: 'nationality' | 'current' | 'previous' | 'yoy'
  const [sortKey, setSortKey] = useState('current');
  const [sortDir, setSortDir] = useState('desc');

  const rows = [...allRows].sort((a, b) => {
    if (sortKey === 'nationality') {
      const cmp = (a.nationality || '').localeCompare(b.nationality || '');
      return sortDir === 'desc' ? -cmp : cmp;
    }
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const requestSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'nationality' ? 'asc' : 'desc'); }
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  const maxCur = Math.max(...rows.map(r => r.current), 1);
  const maxPrv = Math.max(...rows.map(r => r.previous), 1);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
  const totalPrev    = rows.reduce((s, r) => s + r.previous, 0);
  const totalYoy     = totalPrev ? ((totalCurrent - totalPrev) / Math.abs(totalPrev)) * 100 : (totalCurrent > 0 ? 100 : 0);

  const renderYoy = (yoy) => {
    if (yoy == null || !isFinite(yoy)) return <span style={{ color: '#94a3b8' }}>—</span>;
    if (Math.abs(yoy) < 0.05) return <span style={{ color: '#94a3b8' }}>—</span>;
    const up = yoy >= 0;
    return (
      <span style={{ color: up ? '#16a34a' : '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {up ? '▲' : '▼'} {Math.abs(yoy).toFixed(1)}%
      </span>
    );
  };

  const heatBg = (v, max) => {
    if (!v) return 'transparent';
    const intensity = v / max;
    return `rgba(36, 87, 207, ${0.08 + intensity * 0.72})`;
  };
  const heatFg = (v, max) => (v && v / max > 0.55) ? '#fff' : '#1e293b';

  return (
    <div className="fixed-mice-table-shell">
      <div className="fixed-mice-chart-title fixed-mice-chart-title-matrix">Nationality Performance</div>
      <div className="fixed-mice-table-wrap fixed-mice-table-shell-main">
        <table className="mice-matrix-table mice-matrix-heatmap">
          <thead>
            <tr>
              <th
                onClick={() => requestSort('nationality')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Nationality<span className="sort-arrow">{sortArrow('nationality')}</span>
              </th>
              <th
                onClick={() => requestSort('current')}
                style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                No. of Visitors<span className="sort-arrow">{sortArrow('current')}</span>
              </th>
              <th
                onClick={() => requestSort('previous')}
                style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                Last Year<span className="sort-arrow">{sortArrow('previous')}</span>
              </th>
              <th
                onClick={() => requestSort('yoy')}
                style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                %YoY<span className="sort-arrow">{sortArrow('yoy')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.nationality}>
                <td className="cell-nationality">{row.nationality}</td>
                <td style={{ background: heatBg(row.current, maxCur), color: heatFg(row.current, maxCur), textAlign: 'right' }}>
                  {fmt.format(row.current)}
                </td>
                <td style={{ background: heatBg(row.previous, maxPrv), color: heatFg(row.previous, maxPrv), textAlign: 'right' }}>
                  {fmt.format(row.previous)}
                </td>
                <td style={{ textAlign: 'right' }}>{renderYoy(row.yoy)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td style={{ textAlign: 'right' }}><strong>{fmt.format(totalCurrent)}</strong></td>
              <td style={{ textAlign: 'right' }}><strong>{fmt.format(totalPrev)}</strong></td>
              <td style={{ textAlign: 'right' }}><strong>{renderYoy(totalYoy)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─── Nationality × Industry Matrix with Industry filter ──────── */
function MiceNationalityIndustryMatrixWidget({ fixedProfile }) {
  const [selInd, setSelInd] = useState('all');
  const rowData = fixedProfile.nationalityIndustryMatrix || [];
  const industries = ['Meetings', 'Incentives', 'Conventions', 'Exhibitions'];
  const indOptions = [
    { value: 'all', label: 'All' },
    ...industries.map(i => ({ value: i, label: i }))
  ];
  // When industry selected: keep only rows that have visitors in that industry
  const filteredRows = selInd === 'all'
    ? rowData
    : rowData.filter(r => (r[selInd] || 0) > 0);
  const visibleCols = selInd === 'all' ? industries : [selInd];
  const columnTotals = Object.fromEntries(
    [...industries, 'Total'].map(key => [key, filteredRows.reduce((s, r) => s + (r[key] || 0), 0)])
  );
  const maxCell = Math.max(...filteredRows.flatMap(r => industries.map(i => r[i] || 0)), 1);

  return (
    <div className="fixed-mice-table-shell">
      <div className="fixed-mice-chart-title fixed-mice-chart-title-matrix">Nationality by MICE Industry</div>
      <WidgetFilterBar
        label="Industry"
        options={indOptions}
        value={selInd}
        onChange={setSelInd}
      />
      <div className="fixed-mice-table-wrap fixed-mice-table-shell-main">
        <table className="fixed-mice-table fixed-mice-table-matrix">
          <thead>
            <tr>
              <th>Nationality</th>
              {visibleCols.map(i => <th key={i}>{i}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.nationality}>
                <td>{row.nationality}</td>
                {visibleCols.map(i => (
                  <td key={i} className={row[i] ? 'filled' : 'empty'}>
                    <div className="matrix-cell">
                      <span style={{ width: `${Math.max(0, (row[i] / maxCell) * 100)}%` }} />
                      <strong>{row[i] ? formatMetricValue(row[i]) : ''}</strong>
                    </div>
                  </td>
                ))}
                <td className="total-cell">{formatMetricValue(row.Total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              {visibleCols.map(i => <td key={i}>{formatMetricValue(columnTotals[i] || 0)}</td>)}
              <td>{formatMetricValue(columnTotals.Total || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MiceNationalityMatrixView({ fixedProfile }) {
  const [view, setView]           = useState('industry');
  // sortKey: 'Total' | <col name> | 'nationality'; sortDir: 'desc' | 'asc'
  const [sortKey, setSortKey]     = useState('Total');
  const [sortDir, setSortDir]     = useState('desc');

  const industryRows = fixedProfile.nationalityIndustryMatrix2025 || [];
  const periodRows   = fixedProfile.nationalityQuarterMatrix || [];

  const industryCols  = ['Meetings', 'Incentives', 'Conventions', 'Exhibitions', 'Mega Events'];
  const periodCols    = ['Q1', 'Q2', 'Q3', 'Q4'];

  const cols = view === 'industry' ? industryCols : periodCols;
  const baseRows = view === 'industry' ? industryRows : periodRows;
  const rows = [...baseRows].sort((a, b) => {
    if (sortKey === 'nationality') {
      const cmp = (a.nationality || '').localeCompare(b.nationality || '');
      return sortDir === 'desc' ? -cmp : cmp;
    }
    const av = a[sortKey] || 0;
    const bv = b[sortKey] || 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const requestSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'nationality' ? 'asc' : 'desc'); }
  };
  const sortArrow = (key) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
  const isPeriod = view === 'period';

  // YoY formatter: ▲/▼ with green/red color
  const renderYoy = (yoy) => {
    if (yoy == null || !isFinite(yoy)) return <span style={{ color: '#94a3b8' }}>—</span>;
    if (Math.abs(yoy) < 0.05) return <span style={{ color: '#94a3b8' }}>—</span>;
    const up = yoy >= 0;
    return (
      <span style={{ color: up ? '#16a34a' : '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {up ? '▲' : '▼'} {Math.abs(yoy).toFixed(1)}%
      </span>
    );
  };

  // Totals computed once for footer (incl. YoY across all rows)
  const footerTotals = {};
  cols.forEach((c) => {
    const sum   = rows.reduce((s, r) => s + (r[c]   || 0), 0);
    const sumLy = rows.reduce((s, r) => s + (r._ly?.[c] || 0), 0);
    footerTotals[c] = { sum, yoy: sumLy ? ((sum - sumLy) / Math.abs(sumLy)) * 100 : (sum > 0 ? 100 : 0) };
  });
  const grandSum   = rows.reduce((s, r) => s + r.Total, 0);
  const grandSumLy = rows.reduce((s, r) => s + (r.TotalLy || 0), 0);
  const grandYoy   = grandSumLy ? ((grandSum - grandSumLy) / Math.abs(grandSumLy)) * 100 : (grandSum > 0 ? 100 : 0);

  return (
    <div className="mice-matrix-view">
      <div className="mice-matrix-toolbar">
        <div className="fixed-mice-chart-title fixed-mice-chart-title-matrix">
          Nationality by {isPeriod ? 'Period' : 'MICE Industry'}
        </div>
        <span className="mice-matrix-toolbar-label" style={{ marginLeft: 'auto' }}>View :</span>
        <div className="mice-matrix-toggle">
          {['industry', 'period'].map(mode => (
            <button
              key={mode}
              type="button"
              className={`mice-matrix-toggle-btn${view === mode ? ' active' : ''}`}
              onClick={() => setView(mode)}
            >
              {mode === 'industry' ? 'Industry' : 'Period'}
            </button>
          ))}
        </div>
      </div>

      <div className="mice-matrix-table-wrap">
        <table className="mice-matrix-table mice-matrix-heatmap">
          <thead>
            <tr>
              <th
                rowSpan={isPeriod ? 2 : 1}
                onClick={() => requestSort('nationality')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click to sort"
              >
                Nationality<span className="sort-arrow">{sortArrow('nationality')}</span>
              </th>
              {cols.map(c => (
                <th
                  key={c}
                  colSpan={isPeriod ? 2 : 1}
                  onClick={() => !isPeriod && requestSort(c)}
                  style={{ textAlign: 'center', cursor: isPeriod ? 'default' : 'pointer', userSelect: 'none' }}
                  title={isPeriod ? '' : 'Click to sort'}
                >
                  {c}{!isPeriod && <span className="sort-arrow">{sortArrow(c)}</span>}
                </th>
              ))}
              {isPeriod ? (
                <th colSpan={2} className="col-total" style={{ textAlign: 'center' }}>Total</th>
              ) : (
                <th
                  className="col-total col-total-sortable"
                  onClick={() => requestSort('Total')}
                  style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                  title="Click to sort"
                >
                  Total<span className="sort-arrow">{sortArrow('Total')}</span>
                </th>
              )}
            </tr>
            {isPeriod && (
              <tr>
                {cols.flatMap((c) => [
                  <th
                    key={`${c}-v`}
                    onClick={() => requestSort(c)}
                    style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort"
                  >
                    #Visitors<span className="sort-arrow">{sortArrow(c)}</span>
                  </th>,
                  <th
                    key={`${c}-g`}
                    onClick={() => requestSort(`${c}__yoy`)}
                    style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort"
                  >
                    %Growth<span className="sort-arrow">{sortArrow(`${c}__yoy`)}</span>
                  </th>,
                ])}
                <th
                  onClick={() => requestSort('Total')}
                  className="col-total"
                  style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort"
                >
                  #Visitors<span className="sort-arrow">{sortArrow('Total')}</span>
                </th>
                <th
                  onClick={() => requestSort('TotalYoy')}
                  className="col-total"
                  style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort"
                >
                  %Growth<span className="sort-arrow">{sortArrow('TotalYoy')}</span>
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              const colMax = {};
              cols.forEach(c => { colMax[c] = Math.max(...rows.map(r => r[c] || 0), 1); });
              return rows.map(row => (
                <tr key={row.nationality}>
                  <td className="cell-nationality">{row.nationality}</td>
                  {cols.flatMap((c) => {
                    const v = row[c] || 0;
                    const intensity = v ? (v / colMax[c]) : 0;
                    const bg = v ? `rgba(36, 87, 207, ${0.08 + intensity * 0.72})` : 'transparent';
                    const fg = intensity > 0.55 ? '#fff' : '#1e293b';
                    const cells = [
                      <td
                        key={`${c}-v`}
                        className={`cell-val${v ? ' has-val' : ''}`}
                        style={{ background: bg, color: fg, textAlign: 'right' }}
                      >
                        {fmt.format(v)}
                      </td>,
                    ];
                    if (isPeriod) {
                      cells.push(
                        <td key={`${c}-g`} style={{ textAlign: 'right' }}>
                          {renderYoy(row[`${c}__yoy`])}
                        </td>
                      );
                    }
                    return cells;
                  })}
                  <td className="cell-total" style={{ textAlign: 'right' }}>
                    <strong>{fmt.format(row.Total)}</strong>
                  </td>
                  {isPeriod && (
                    <td className="cell-total" style={{ textAlign: 'right' }}>
                      {renderYoy(row.TotalYoy)}
                    </td>
                  )}
                </tr>
              ));
            })()}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              {cols.flatMap((c) => {
                const cells = [
                  <td key={`${c}-v`} style={{ textAlign: 'right' }}>
                    <strong>{fmt.format(footerTotals[c].sum)}</strong>
                  </td>,
                ];
                if (isPeriod) {
                  cells.push(
                    <td key={`${c}-g`} style={{ textAlign: 'right' }}>
                      <strong>{renderYoy(footerTotals[c].yoy)}</strong>
                    </td>
                  );
                }
                return cells;
              })}
              <td className="cell-total" style={{ textAlign: 'right' }}>
                <strong>{fmt.format(grandSum)}</strong>
              </td>
              {isPeriod && (
                <td className="cell-total" style={{ textAlign: 'right' }}>
                  <strong>{renderYoy(grandYoy)}</strong>
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MiceDrillFlow  v2
   Sankey-style drill-down with SVG bezier connectors
   Total → Nationality → Industry → Quarter
───────────────────────────────────────────── */
function MiceDrillFlow({ fixedProfile, globalFilter }) {
  const [localData, setLocalData] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setFetchLoading(true);
    const filter = {
      ...(globalFilter || {}),
      nocache: true,
    };
    fetchWidgetDirect('miceDrillFlow', filter, ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) {
          setLocalData(transformDrillFlow(rows || []));
          setFetchLoading(false);
        }
      })
      .catch(() => { if (!ac.signal.aborted) setFetchLoading(false); });
    return () => ac.abort();
  }, [globalFilter?.market, globalFilter?.yearMin, globalFilter?.yearMax, globalFilter?.yearMode, globalFilter?.continent, globalFilter?.country]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = (localData ?? fixedProfile.sankeyFlow) || { total: 0, nationality: [] };
  const [selNat, setSelNat] = useState(null);
  const [selInd, setSelInd] = useState(null);
  const [showAllNat, setShowAllNat] = useState(false);
  const INIT_SHOW = 7;

  const containerRef   = useRef(null);
  const columnsRef     = useRef(null);   // scrollable columns wrapper
  // Track refs — bezier y-position anchors at bar track center
  const totalTrackRef  = useRef(null);
  const natTrackRefs   = useRef({});
  const indTrackRefs   = useRef({});
  const qTrackRefs     = useRef({});
  // Node refs — used for x-position (column edge)
  const totalNodeRef   = useRef(null);
  const natNodeRefs    = useRef({});
  const indNodeRefs    = useRef({});
  const qNodeRefs      = useRef({});
  const [paths, setPaths]               = useState([]);
  const [indColOffset, setIndColOffset] = useState(0);
  const [qColOffset,   setQColOffset]   = useState(0);
  const [scrollTick,   setScrollTick]   = useState(0);

  /* ── Re-trigger calculations on scroll ── */
  useEffect(() => {
    const el = columnsRef.current;
    if (!el) return;
    const onScroll = () => setScrollTick(t => t + 1);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const natRows   = data.nationality || [];
  const visNat    = showAllNat ? natRows : natRows.slice(0, INIT_SHOW);
  const selNatRow = natRows.find(n => n.label === selNat);
  const indRows   = selNatRow?.industry || [];
  const selIndRow = indRows.find(i => i.label === selInd);
  const qRows     = selIndRow?.quarter || [];

  const maxNat = Math.max(...natRows.map(n => n.value), 1);
  const maxInd = Math.max(...indRows.map(i => i.value), 1);
  const maxQ   = Math.max(...qRows.map(q => q.value), 1);

  /* ── Recompute SVG bezier paths after DOM settles ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) { setPaths([]); return; }

    const cr = container.getBoundingClientRect();
    const scaleX = cr.width  > 0 ? container.offsetWidth  / cr.width  : 1;
    const scaleY = cr.height > 0 ? container.offsetHeight / cr.height : 1;

    // x from node edge, y from track vertical center
    const pt = (nodeEl, trackEl, side) => {
      if (!nodeEl || !trackEl) return null;
      const nr = nodeEl.getBoundingClientRect();
      const tr = trackEl.getBoundingClientRect();
      const x = side === 'right'
        ? (nr.right - cr.left) * scaleX
        : (nr.left  - cr.left) * scaleX;
      const y = ((tr.top + tr.bottom) / 2 - cr.top) * scaleY;
      return { x, y };
    };

    // S-curve bezier via horizontal midpoint
    const bez = (x1, y1, x2, y2) => {
      const mx = (x1 + x2) / 2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    };

    const newPaths = [];
    const totPt = pt(totalNodeRef.current, totalTrackRef.current, 'right');

    /* ── Total → each visible nationality ── */
    visNat.forEach(row => {
      const nPt = pt(natNodeRefs.current[row.label], natTrackRefs.current[row.label], 'left');
      if (!totPt || !nPt) return;
      const isSel = selNat === row.label;
      newPaths.push({
        key: `tot-${row.label}`,
        d: bez(totPt.x, totPt.y, nPt.x, nPt.y),
        stroke: isSel ? '#2457cf' : '#dde5f0',
        strokeWidth: isSel ? 2.5 : 0.8,
        opacity: isSel ? 1 : (selNat ? 0.5 : 0.65),
      });
    });

    /* ── Selected nat → industries ── */
    if (selNat) {
      const nPt = pt(natNodeRefs.current[selNat], natTrackRefs.current[selNat], 'right');
      indRows.forEach(row => {
        const iPt = pt(indNodeRefs.current[row.label], indTrackRefs.current[row.label], 'left');
        if (!nPt || !iPt) return;
        const isSel = selInd === row.label;
        newPaths.push({
          key: `nat-${row.label}`,
          d: bez(nPt.x, nPt.y, iPt.x, iPt.y),
          stroke: isSel ? '#2457cf' : '#93c5fd',
          strokeWidth: isSel ? 2.5 : 1,
          opacity: isSel ? 1 : 0.5,
        });
      });
    }

    /* ── Selected industry → quarters ── */
    if (selInd) {
      const iPt = pt(indNodeRefs.current[selInd], indTrackRefs.current[selInd], 'right');
      qRows.forEach(row => {
        const qPt = pt(qNodeRefs.current[row.label], qTrackRefs.current[row.label], 'left');
        if (!iPt || !qPt) return;
        newPaths.push({
          key: `q-${row.label}`,
          d: bez(iPt.x, iPt.y, qPt.x, qPt.y),
          stroke: '#2457cf',
          strokeWidth: 2,
          opacity: 0.75,
        });
      });
    }

    setPaths(newPaths);
  }, [selNat, selInd, showAllNat, visNat.length, indRows.length, qRows.length, indColOffset, qColOffset, scrollTick]);

  /* ── Industry column offset: align with selected nationality ── */
  useEffect(() => {
    if (!selNat || !visNat.length) { setIndColOffset(0); return; }
    const container = containerRef.current;
    if (!container) return;
    const cr   = container.getBoundingClientRect();
    const scaleY = cr.height > 0 ? container.offsetHeight / cr.height : 1;
    const firstT = natTrackRefs.current[visNat[0].label];
    const selT   = natTrackRefs.current[selNat];
    if (!firstT || !selT) return;
    setIndColOffset(Math.max(0, (selT.getBoundingClientRect().top - firstT.getBoundingClientRect().top) * scaleY));
  }, [selNat, visNat.length, showAllNat, scrollTick]);

  /* ── Quarter column offset: align with selected industry ── */
  useEffect(() => {
    if (!selInd || !indRows.length) { setQColOffset(indColOffset); return; }
    const container = containerRef.current;
    if (!container) return;
    const cr   = container.getBoundingClientRect();
    const scaleY = cr.height > 0 ? container.offsetHeight / cr.height : 1;
    const firstT = indTrackRefs.current[indRows[0].label];
    const selT   = indTrackRefs.current[selInd];
    if (!firstT || !selT) return;
    setQColOffset(indColOffset + Math.max(0, (selT.getBoundingClientRect().top - firstT.getBoundingClientRect().top) * scaleY));
  }, [selInd, indRows.length, indColOffset, scrollTick]);

  const handleNatClick = (label) => {
    if (selNat === label) { setSelNat(null); setSelInd(null); }
    else {
      const row = natRows.find(n => n.label === label);
      setSelNat(label);
      setSelInd(row?.industry?.[0]?.label || null);
    }
  };
  const handleIndClick = (label) => setSelInd(selInd === label ? null : label);
  const clearNat = () => { setSelNat(null); setSelInd(null); };
  const clearInd = () => setSelInd(null);

  return (
    <div className="df2-shell" ref={containerRef} style={fetchLoading ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
      {/* SVG overlay */}
      <svg className="df2-svg" aria-hidden="true">
        {paths.map(p => (
          <path key={p.key} d={p.d} fill="none"
            stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />
        ))}
      </svg>

      {/* Filter chips */}
      <div className="df2-chips">
        <div className={`df2-chip${selNat ? ' df2-chip-active' : ''}`}>
          <div className="df2-chip-top">
            <span className="df2-chip-field">Nationality</span>
            {selNat && <button type="button" className="df2-chip-clear" onClick={clearNat}>×</button>}
          </div>
          <span className="df2-chip-val">{selNat || '—'}</span>
        </div>
        <div className={`df2-chip${selInd ? ' df2-chip-active' : ''}`}>
          <div className="df2-chip-top">
            <span className="df2-chip-field">Industry</span>
            {selInd && <button type="button" className="df2-chip-clear" onClick={clearInd}>×</button>}
          </div>
          <span className="df2-chip-val">{selInd || '—'}</span>
        </div>
      </div>

      {/* Flow columns */}
      <div className="df2-columns" ref={columnsRef}>

        {/* ── Col 0: Total ── */}
        <div className="df2-col df2-col-total">
          <div className="df2-col-hd">Total</div>
          <div className="df2-node" ref={totalNodeRef}>
            <div className="df2-track" ref={totalTrackRef}>
              <div className="df2-fill df2-fill-total" style={{ width: '100%' }} />
            </div>
            <strong className="df2-name">This Year</strong>
            <span className="df2-val">{fmt.format(data.total)}</span>
          </div>
        </div>

        {/* ── Col 1: Nationality ── */}
        <div className="df2-col">
          <div className="df2-col-hd">Nationality</div>
          {visNat.map(row => (
            <button
              type="button"
              key={row.label}
              className={`df2-node df2-node-btn${selNat === row.label ? ' df2-sel' : ''}`}
              ref={el => { natNodeRefs.current[row.label] = el; }}
              onClick={() => handleNatClick(row.label)}
            >
              <div className="df2-track" ref={el => { natTrackRefs.current[row.label] = el; }}>
                <div className="df2-fill" style={{ width: `${Math.max(4, (row.value / maxNat) * 100)}%` }} />
              </div>
              <strong className="df2-name">{row.label}</strong>
              <span className="df2-val">{fmt.format(row.value)}</span>
            </button>
          ))}
          {!showAllNat && natRows.length > INIT_SHOW && (
            <button type="button" className="df2-more" onClick={() => setShowAllNat(true)}>
              ∨ show {natRows.length - INIT_SHOW} more
            </button>
          )}
        </div>

        {/* ── Col 2: Industry — offset to align with selected nationality ── */}
        {selNat && (
          <div className="df2-col" style={{ marginTop: `${indColOffset}px` }}>
            <div className="df2-col-hd">Industry</div>
            {indRows.map(row => (
              <button
                type="button"
                key={row.label}
                className={`df2-node df2-node-btn${selInd === row.label ? ' df2-sel' : ''}`}
                ref={el => { indNodeRefs.current[row.label] = el; }}
                onClick={() => handleIndClick(row.label)}
              >
                <div className="df2-track" ref={el => { indTrackRefs.current[row.label] = el; }}>
                  <div className="df2-fill" style={{ width: `${Math.max(4, (row.value / maxInd) * 100)}%` }} />
                </div>
                <strong className="df2-name">{row.label}</strong>
                <span className="df2-val">{fmt.format(row.value)}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Col 3: Quarter — offset to align with selected industry ── */}
        {selInd && (
          <div className="df2-col" style={{ marginTop: `${qColOffset}px` }}>
            <div className="df2-col-hd">Quarter</div>
            {qRows.map(row => (
              <div
                key={row.label}
                className="df2-node"
                ref={el => { qNodeRefs.current[row.label] = el; }}
              >
                <div className="df2-track" ref={el => { qTrackRefs.current[row.label] = el; }}>
                  <div className="df2-fill" style={{ width: `${Math.max(4, (row.value / maxQ) * 100)}%` }} />
                </div>
                <strong className="df2-name">{row.label}</strong>
                <span className="df2-val">{fmt.format(row.value)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── MiceDataTableWidget: ตาราง MICE Statistics รายปี / ไตรมาส ─────────── */
function MiceDataTableWidget({ rows, globalFilter }) {
  // quarters + industry now come from global filter — use pre-fetched rows
  const displayRows = rows;
  const fmt  = new Intl.NumberFormat('en-US');
  const fmtM = (v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : fmt.format(v);

  // Group by year, then by quarter
  const byYear = {};
  displayRows.forEach((r) => {
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(r);
  });

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const grandTotal = displayRows.reduce((s, r) => ({
    events:   s.events   + r.events,
    visitors: s.visitors + r.visitors,
    revenue:  s.revenue  + r.revenue,
  }), { events: 0, visitors: 0, revenue: 0 });
  const totals = (arr) => arr.reduce((s, r) => ({
    events:   s.events   + r.events,
    visitors: s.visitors + r.visitors,
    revenue:  s.revenue  + r.revenue,
  }), { events: 0, visitors: 0, revenue: 0 });

  const [expanded, setExpanded] = useState({});
  const toggleYear = (y) => setExpanded((p) => ({ ...p, [y]: !p[y] }));

  return (
    <div className="fixed-mice-table-shell">
      <div className="fixed-mice-chart-title" style={{ background: '#1e3a5f', margin: '8px 12px 0', borderRadius: 8, fontSize: '0.85rem', padding: '6px 14px' }}>
        MICE Statistics
      </div>
      <div className="fixed-mice-table-shell-main" style={{ position: 'relative' }}>
        <table className="fixed-mice-table-heavy" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '28%', textAlign: 'left' }}>Calendar Year</th>
              <th style={{ textAlign: 'right' }}>MICE Events</th>
              <th style={{ textAlign: 'right' }}>MICE Visitors</th>
              <th style={{ textAlign: 'right' }}>Revenue (MB)</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const qRows = byYear[y];
              const t = totals(qRows);
              const isExp = expanded[y];
              return (
                <React.Fragment key={y}>
                  <tr
                    onClick={() => toggleYear(y)}
                    style={{ cursor: 'pointer', background: isExp ? '#f0f4ff' : undefined }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: 6, opacity: 0.5, fontSize: '0.75rem' }}>{isExp ? '▾' : '⊕'}</span>
                      {y}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt.format(t.events)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt.format(t.visitors)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt.format(Math.round(t.revenue))}</td>
                  </tr>
                  {isExp && qRows.map((r) => (
                    <tr key={`${y}-${r.quarter}`} style={{ background: '#f8faff', fontSize: '0.82rem' }}>
                      <td style={{ paddingLeft: 28, color: '#64748b' }}>{r.quarter}</td>
                      <td style={{ textAlign: 'right', color: '#475569' }}>{fmt.format(r.events)}</td>
                      <td style={{ textAlign: 'right', color: '#475569' }}>{fmt.format(r.visitors)}</td>
                      <td style={{ textAlign: 'right', color: '#475569' }}>{fmt.format(Math.round(r.revenue))}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #cbd5e1', background: '#f8faff' }}>
              <td>Total</td>
              <td style={{ textAlign: 'right' }}>{fmt.format(grandTotal.events)}</td>
              <td style={{ textAlign: 'right' }}>{fmt.format(grandTotal.visitors)}</td>
              <td style={{ textAlign: 'right' }}>{fmt.format(Math.round(grandTotal.revenue))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── MICE Statistics Performance ───────────────────────────────────────────────

const STAT_PERF_SECTOR_COLORS = {
  Meetings:      '#5b9bd5',
  Incentives:    '#8064a2',
  Conventions:   '#f79646',
  Exhibitions:   '#c0504d',
  'Mega Events': '#9bbb59',
};
const STAT_PERF_SECTOR_ORDER = ['Meetings', 'Incentives', 'Conventions', 'Exhibitions', 'Mega Events'];

const fmtInt   = new Intl.NumberFormat('en-US');
const fmtDec2  = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MiceStatPerfKpiCard({ fixedProfile, metric }) {
  const kpi = fixedProfile.statPerfKpi || {};
  const CONFIGS = {
    visitors:          { value: kpi.visitors,          fmt: (v) => fmtInt.format(v),  label: 'MICE Travelers (persons)',         yoy: kpi.yoyVisitors },
    revenue:           { value: kpi.revenue,            fmt: (v) => fmtDec2.format(v), label: 'Revenue Generated (MB)',           yoy: kpi.yoyRevenue },
    events:            { value: kpi.events,             fmt: (v) => fmtInt.format(v),  label: 'MICE Events',                      yoy: kpi.yoyEvents },
    revenuePerEvent:   { value: kpi.revenuePerEvent,    fmt: (v) => fmtDec2.format(v), label: 'Avg Revenue per Event (THB)',      yoy: null },
    revenuePerVisitor: { value: kpi.revenuePerVisitor,  fmt: (v) => fmtDec2.format(v), label: 'Avg Revenue per Person (THB)',     yoy: null },
    visitorsPerEvent:  { value: kpi.visitorsPerEvent,   fmt: (v) => fmtDec2.format(v), label: 'Travelers per Event (persons)',    yoy: null },
  };
  const cfg = CONFIGS[metric] || CONFIGS.visitors;
  const hasYoy = cfg.yoy != null && isFinite(cfg.yoy);
  const yoyUp  = cfg.yoy >= 0;

  return (
    <div className="stat-perf-kpi-card">
      <div className="stat-perf-kpi-value">
        {cfg.value != null ? cfg.fmt(cfg.value) : '—'}
      </div>
      {hasYoy && (
        <div className={`stat-perf-kpi-yoy ${yoyUp ? 'up' : 'down'}`}>
          %Growth (YoY) {yoyUp ? '▲' : '▼'} {Math.abs(cfg.yoy).toFixed(1)}%
        </div>
      )}
      <div className="stat-perf-kpi-label">{cfg.label}</div>
    </div>
  );
}

function MiceStatPerfSectorBar({ fixedProfile, metric }) {
  const rows = fixedProfile.statPerfSector || [];
  const METRIC_CFG = {
    visitors: { key: 'no_of_visitors',    title: 'MICE Travelers by Sector' },
    revenue:  { key: 'revenue_generated', title: 'MICE Revenue by Sector' },
    events:   { key: 'no_of_events',      title: 'MICE Events by Sector' },
  };
  const cfg    = METRIC_CFG[metric] || METRIC_CFG.visitors;
  const total  = rows.reduce((s, r) => s + (r[cfg.key] || 0), 0);
  const sorted = [...rows].sort((a, b) => (b[cfg.key] || 0) - (a[cfg.key] || 0));

  return (
    <div className="stat-perf-sector-bar">
      <div className="stat-perf-sector-bar-title">{cfg.title}</div>
      <div className="stat-perf-sector-bar-rows">
        {sorted.map((row) => {
          const val   = row[cfg.key] || 0;
          const pct   = total > 0 ? (val / total) * 100 : 0;
          const color = STAT_PERF_SECTOR_COLORS[row.sector_name] || '#94a3b8';
          return (
            <div key={row.sector_name} className="stat-perf-sector-bar-row">
              <div className="stat-perf-sector-bar-label">{row.sector_name}</div>
              <div className="stat-perf-sector-bar-with-pct">
                <div className="stat-perf-sector-bar-track">
                  <div className="stat-perf-sector-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="stat-perf-sector-bar-pct">{pct.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiceStatPerfSectorTable({ fixedProfile }) {
  const rows   = [...(fixedProfile.statPerfSector || [])].sort(
    (a, b) => STAT_PERF_SECTOR_ORDER.indexOf(a.sector_name) - STAT_PERF_SECTOR_ORDER.indexOf(b.sector_name)
  );
  const totals = rows.reduce(
    (s, r) => ({ visitors: s.visitors + (r.no_of_visitors || 0), revenue: s.revenue + (r.revenue_generated || 0), events: s.events + (r.no_of_events || 0) }),
    { visitors: 0, revenue: 0, events: 0 }
  );

  return (
    <div className="stat-perf-sector-table">
      <table>
        <thead>
          <tr>
            <th>Sector</th>
            <th style={{ textAlign: 'right' }}>#Visitors</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
            <th style={{ textAlign: 'right' }}>#Events</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sector_name}>
              <td>{row.sector_name}</td>
              <td style={{ textAlign: 'right' }}>{fmtInt.format(row.no_of_visitors)}</td>
              <td style={{ textAlign: 'right' }}>{fmtInt.format(row.revenue_generated)}</td>
              <td style={{ textAlign: 'right' }}>{fmtInt.format(row.no_of_events)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td style={{ textAlign: 'right' }}><strong>{fmtInt.format(totals.visitors)}</strong></td>
            <td style={{ textAlign: 'right' }}><strong>{fmtInt.format(totals.revenue)}</strong></td>
            <td style={{ textAlign: 'right' }}><strong>{fmtInt.format(totals.events)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MiceStatPerfHistoricalChart({ fixedProfile }) {
  const rawRows = fixedProfile.statPerfHistorical || [];

  // Pivot: year → { sector: value, ... }
  const yearMap = {};
  rawRows.forEach((r) => {
    if (!yearMap[r.year]) yearMap[r.year] = { year: r.year };
    yearMap[r.year][r.sector_name] = r.revenue_generated;
  });

  const activeSectors = STAT_PERF_SECTOR_ORDER.filter((s) =>
    rawRows.some((r) => r.sector_name === s && r.revenue_generated > 0)
  );

  const data = Object.values(yearMap)
    .sort((a, b) => a.year - b.year)
    .map((row) => {
      const yearTotal = activeSectors.reduce((s, sec) => s + (row[sec] || 0), 0);
      const result = { year: row.year, _total: yearTotal };
      activeSectors.forEach((sec) => {
        result[sec] = yearTotal > 0 ? ((row[sec] || 0) / yearTotal) * 100 : 0;
      });
      return result;
    });

  return (
    <div className="stat-perf-historical">
      <div className="stat-perf-historical-title">MICE Revenue Share by Industry</div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eaf2" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={45} />
          <YAxis tickFormatter={(v) => `${Math.round(v)}%`} domain={[0, 100]} width={36} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
            labelFormatter={(label) => `Year ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {activeSectors.map((sec) => {
            const makeLabel = ({ x, y, width, height, index }) => {
              const pct = data[index]?.[sec] || 0;
              if (pct < 5 || height < 10) return null;
              return (
                <text key={`${sec}-${index}`} x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600}>
                  {pct.toFixed(1)}%
                </text>
              );
            };
            return (
              <Bar key={sec} dataKey={sec} stackId="stack" fill={STAT_PERF_SECTOR_COLORS[sec] || '#94a3b8'} isAnimationActive={false}>
                <LabelList content={makeLabel} />
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const fmtDec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function MiceStatPerfFyKpiCard({ fixedProfile, metric }) {
  const kpi = fixedProfile.statPerfFyKpi || {};
  const CONFIGS = {
    stayingPeriod:  { value: kpi.stayingPeriod,  fmt: (v) => fmtDec2.format(v), label: 'Avg Staying Period (days)',              yoy: kpi.yoyStaying   },
    spendingPerDay: { value: kpi.spendingPerDay,  fmt: (v) => fmtDec2.format(v), label: 'Avg Spending per Head per Day (THB)',    yoy: kpi.yoySpendDay  },
    spendingPerTrip:{ value: kpi.spendingPerTrip, fmt: (v) => fmtDec2.format(v), label: 'Avg Spending per Head per Trip (THB)',   yoy: kpi.yoySpendTrip },
  };
  const cfg = CONFIGS[metric] || CONFIGS.stayingPeriod;
  const hasYoy = cfg.yoy != null && isFinite(cfg.yoy);
  const yoyUp  = cfg.yoy >= 0;
  return (
    <div className="stat-perf-kpi-card">
      <div className="stat-perf-kpi-value">
        {cfg.value != null ? cfg.fmt(cfg.value) : '—'}
      </div>
      {hasYoy && (
        <div className={`stat-perf-kpi-yoy ${yoyUp ? 'up' : 'down'}`}>
          %Growth (YoY) {yoyUp ? '▲' : '▼'} {Math.abs(cfg.yoy).toFixed(1)}%
        </div>
      )}
      <div className="stat-perf-kpi-label">{cfg.label}</div>
    </div>
  );
}

function MiceStatPerfFySectorBar({ fixedProfile, metric }) {
  const rows = [...(fixedProfile.statPerfFySector || [])].sort(
    (a, b) => (b[metric] || 0) - (a[metric] || 0)
  );
  const METRIC_CFG = {
    stayingPeriod:  { key: 'staying_period',              title: 'Avg Staying Period by Industry (days)',        fmt: (v) => fmtDec1.format(v) },
    spendingPerDay: { key: 'spending_per_head_per_day',   title: 'Spending per Head per Day by Industry (THB)',  fmt: (v) => fmtInt.format(Math.round(v)) },
    spendingPerTrip:{ key: 'spending_per_head_per_trip',  title: 'Spending per Head per Trip by Industry (THB)', fmt: (v) => fmtInt.format(Math.round(v)) },
  };
  const cfg   = METRIC_CFG[metric] || METRIC_CFG.stayingPeriod;
  const max   = rows.reduce((m, r) => Math.max(m, r[cfg.key] || 0), 0);
  return (
    <div className="stat-perf-sector-bar">
      <div className="stat-perf-sector-bar-title">{cfg.title}</div>
      <div className="stat-perf-sector-bar-rows">
        {rows.map((row) => {
          const val   = row[cfg.key] || 0;
          const pct   = max > 0 ? (val / max) * 100 : 0;
          const color = STAT_PERF_SECTOR_COLORS[row.sector_name] || '#94a3b8';
          return (
            <div key={row.sector_name} className="stat-perf-sector-bar-row">
              <div className="stat-perf-sector-bar-label">{row.sector_name}</div>
              <div className="stat-perf-sector-bar-with-pct">
                <div className="stat-perf-sector-bar-track">
                  <div className="stat-perf-sector-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="stat-perf-sector-bar-pct">{cfg.fmt(val)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WidgetRenderer({ widget, dataset, records: overrideRecords, isPreview, isSkeleton = false, apiStatus, apiError, globalFilter }) {
  const isMiceBound = typeof widget.dataset === 'string' && /^mice/i.test(widget.dataset);
  const hasData = (dataset?.records && dataset.records.length > 0)
    || (dataset?.fixedProfile && Object.keys(dataset.fixedProfile).length > 0);

  // 1) Loading state — show skeleton shimmer while API is fetching and widget has no data yet
  if (widget.type !== 'textbox' && isMiceBound && apiStatus === 'loading' && !hasData) {
    return <WidgetSkeleton type={widget.type} />;
  }

  // 2) Error state — API failed and no data to fall back on
  if (widget.type !== 'textbox' && apiStatus === 'error' && !hasData) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 16, height: '100%', textAlign: 'center',
          color: '#b91c1c', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: 8,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <strong>Failed to load data</strong>
        <span style={{ fontSize: 12, color: '#7f1d1d', maxWidth: '90%', wordBreak: 'break-word' }}>
          {apiError || 'Unable to fetch data from API'}
        </span>
      </div>
    );
  }

  if (isSkeleton) return <WidgetSkeleton type={widget.type} />;
  if (widget.type === 'textbox' || widget.type === 'label' || widget.type === 'date') {
    const fallback =
      widget.type === 'date' ? '${format_date(current_date)}' : widget.title || 'Text';
    const textStyle = widget.textStyle || {};
    const isTextbox = widget.type === 'textbox';
    const resolvedFontSize = isTextbox ? widget.fontSize || 20 : widget.fontSize || 28;

    return (
      <div
        className={`label-widget ${isTextbox ? 'textbox-widget' : ''}`}
        style={{
          '--textbox-align-items':
            isTextbox && widget.textAlign === 'right'
              ? 'flex-end'
              : isTextbox && widget.textAlign === 'center'
                ? 'center'
                : 'flex-start',
          '--textbox-justify-content':
            isTextbox && widget.textAlign === 'right'
              ? 'flex-end'
              : isTextbox && widget.textAlign === 'center'
                ? 'center'
                : 'flex-start',
          '--textbox-text-align':
            isTextbox && widget.textAlign === 'right'
              ? 'right'
              : isTextbox && widget.textAlign === 'center'
                ? 'center'
                : 'left',
          fontSize: `${resolvedFontSize}px`,
          fontWeight: textStyle.fontWeight || 600,
          fontStyle: textStyle.fontStyle || 'normal',
          textDecoration: textStyle.textDecoration || 'none',
          textAlign: isTextbox ? widget.textAlign || 'left' : widget.textAlign || 'center',
          justifyContent:
            isTextbox
              ? widget.textAlign === 'right'
                ? 'flex-end'
                : widget.textAlign === 'center'
                  ? 'center'
                  : 'flex-start'
              : widget.textAlign === 'left'
                ? 'flex-start'
                : widget.textAlign === 'right'
                  ? 'flex-end'
                  : 'center'
          ,
          whiteSpace: isTextbox ? 'pre-wrap' : undefined,
          overflowWrap: isTextbox ? 'anywhere' : undefined,
          wordBreak: isTextbox ? 'break-word' : undefined,
          lineHeight: isTextbox ? 1.22 : undefined,
          maxWidth: '100%'
        }}
      >
        {renderTextExpression(widget.expression, fallback)}
      </div>
    );
  }

  const fixedProfile = dataset?.fixedProfile || {};

  if (widget.type === 'miceStatPerfKpiCard') {
    return <MiceStatPerfKpiCard fixedProfile={fixedProfile} metric={widget.metric || 'visitors'} />;
  }

  if (widget.type === 'miceStatPerfSectorBar') {
    return <MiceStatPerfSectorBar fixedProfile={fixedProfile} metric={widget.metric || 'visitors'} />;
  }

  if (widget.type === 'miceStatPerfSectorTable') {
    return <MiceStatPerfSectorTable fixedProfile={fixedProfile} />;
  }

  if (widget.type === 'miceStatPerfHistoricalChart') {
    return <MiceStatPerfHistoricalChart fixedProfile={fixedProfile} />;
  }

  if (widget.type === 'miceStatPerfFyKpiCard') {
    return <MiceStatPerfFyKpiCard fixedProfile={fixedProfile} metric={widget.metric || 'stayingPeriod'} />;
  }

  if (widget.type === 'miceStatPerfFySectorBar') {
    return <MiceStatPerfFySectorBar fixedProfile={fixedProfile} metric={widget.metric || 'stayingPeriod'} />;
  }

  // MICE widgets render from fixedProfile (not dataset.records) and dispatch by
  // type below; their loading/error states are handled earlier. Only the generic
  // record-based widgets need this "no data" guard.
  if (!dataset?.records?.length && !isMiceBound) {
    if (apiStatus === 'loading') {
      return <WidgetSkeleton type={widget.type} />;
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 16, color: '#64748b', fontSize: 13 }}>
        No data found for the selected filters
      </div>
    );
  }

  const records = overrideRecords || dataset.records;
  const fieldsByKey = Object.fromEntries((dataset.fields || []).map((field) => [field.key, field]));

  if (widget.type === 'miceStatCard') {
    const profile = fixedProfile.kpis || {};
    const metric = widget.metric || 'events';
    const STAT_CONFIGS = {
      events:         { value: formatMetricValue(profile.events),   label: 'MICE Events' },
      visitors:       { value: formatMetricValue(profile.visitors), label: 'MICE Inter Visitors' },
      topNationality: { value: profile.topNationality || '-',       label: 'Top Nationality' },
      topIndustry:    { value: profile.topIndustry    || '-',       label: 'Top Industry' },
    };
    const cfg = STAT_CONFIGS[metric] || STAT_CONFIGS.events;
    return (
      <div className="mice-stat-card">
        <ShrinkText text={cfg.value} maxPx={56} minPx={10} />
        <span>{cfg.label}</span>
      </div>
    );
  }

  if (widget.type === 'miceEventsChart') {
    const annual = fixedProfile.charts?.events || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceEventsChart" title="MICE Events" color="#081f68" yLabel="MICE Events" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatYAxisTickThousands} valueKey="no_of_events" lyKey="no_of_events_ly" yoyKey="yoy_event" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceRevenueChart') {
    const annual = fixedProfile.charts?.revenue || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceRevenueChart" title="MICE Revenue Generated" color="#1d4fb3" yLabel="MB" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatYAxisTickFull} valueKey="revenue_generated" lyKey="revenue_generated_ly" yoyKey="yoy_revenue" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceVisitorsChart') {
    const annual = fixedProfile.charts?.visitors || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceVisitorsChart" title="MICE Visitors" color="#4098b9" yLabel="MICE Visitors" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatYAxisTickMillions} valueKey="no_of_visitors" lyKey="no_of_visitors_ly" yoyKey="yoy_visitors" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceStayingPeriodChart') {
    const annual = fixedProfile.charts?.stayingPeriod || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceStayingPeriodChart" title="Average Staying Period" color="#c08a2e" yLabel="Days" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatAxisTickValue} valueKey="staying_period" lyKey="staying_period_ly" yoyKey="yoy_staying" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceSpendingPerDayChart') {
    const annual = fixedProfile.charts?.spendingPerDay || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceSpendingPerDayChart" title="Spending per Head per Day" color="#d29933" yLabel="THB/person/day" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatYAxisTickFull} valueKey="spending_per_head_per_day" lyKey="spending_per_head_per_day_ly" yoyKey="yoy_spend_day" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceSpendingPerTripChart') {
    const annual = fixedProfile.charts?.spendingPerTrip || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year, value: item.value, yoy: item.yoy ?? (index > 0 ? computeYoY(item.value, annual[index - 1].value) : null)
    }));
    return <FixedChartPanel widgetKey="miceSpendingPerTripChart" title="Spending per Head per Trip" color="#d29933" yLabel="THB/person/trip" actualSeries={actualSeries} forecastSeries={[]} yTickFormatter={formatYAxisTickFull} valueKey="spending_per_head_per_trip" lyKey="spending_per_head_per_trip_ly" yoyKey="yoy_spend_trip" globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceEventsQuarterlyChart') {
    return (
      <QuarterlyChartPanel
        title="MICE Events Performance Over Time"
        color="#081f68"
        yLabel="No. of Events"
        yTickFormatter={formatYAxisTickThousands}
        widgetKey="miceEventsQuarterlyChart"
        globalFilter={globalFilter}
        defaultData={fixedProfile.chartsQuarterly?.events || []}
        valueKey="no_of_events"
        lyKey="no_of_events_ly"
      />
    );
  }

  if (widget.type === 'miceVisitorsQuarterlyChart') {
    return (
      <QuarterlyChartPanel
        title="MICE International Visitors Performance Over Time"
        color="#1d6fe8"
        yLabel="No. of Visitors"
        yTickFormatter={formatYAxisTickThousands}
        widgetKey="miceVisitorsQuarterlyChart"
        globalFilter={globalFilter}
        defaultData={fixedProfile.chartsQuarterly?.visitors || []}
        valueKey="no_of_visitors"
        lyKey="no_of_visitors_ly"
      />
    );
  }

  if (widget.type === 'miceKpis') {
    const profile = fixedProfile.kpis || {};
    const cards = [
      { value: formatMetricValue(profile.events), label: 'MICE Events' },
      { value: `${profile.eventsGrowth >= 0 ? '▲' : '▼'} ${profile.eventsGrowth >= 0 ? '' : '-'}${Math.abs(profile.eventsGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.eventsGrowth >= 0 ? 'up' : 'down' },
      { value: formatMetricValue(profile.visitors), label: 'MICE Inter Visitors' },
      { value: `${profile.visitorsGrowth >= 0 ? '▲' : '▼'} ${profile.visitorsGrowth >= 0 ? '' : '-'}${Math.abs(profile.visitorsGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.visitorsGrowth >= 0 ? 'up' : 'down' },
      { value: profile.topNationality || '-', label: 'Top Nationality' },
      { value: `${profile.topNationalityGrowth >= 0 ? '▲' : '▼'} ${profile.topNationalityGrowth >= 0 ? '' : '-'}${Math.abs(profile.topNationalityGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.topNationalityGrowth >= 0 ? 'up' : 'down' },
      { value: profile.topIndustry || '-', label: 'Top Industry' }
    ];

    return (
      <div className="fixed-mice-kpi-strip">
        {cards.map((card, index) => (
          <div key={`${card.label}-${index}`} className={`fixed-mice-kpi-card ${card.accent || ''}`}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'miceNationalityPerformance') {
    return <MiceNationalityPerformanceWidget fixedProfile={fixedProfile} />;
  }

  if (widget.type === 'miceNationalityIndustryMatrix') {
    return <MiceNationalityIndustryMatrixWidget fixedProfile={fixedProfile} />;
  }

  // miceVisitorsBreakdown — ยกเลิกแล้ว ใช้ miceDrillFlow แทน
  if (widget.type === 'miceVisitorsBreakdown') return null;

  if (widget.type === 'line' || widget.type === 'bar' || widget.type === 'chart') {
    const xField = widget.mapping?.xField;
    const yFields = widget.mapping?.yFields || [];
    const chartKind = widget.type === 'chart' ? widget.mapping?.chartKind || 'line' : widget.type;
    const chartRows = buildChartRows(records, widget);

    if (!xField || !yFields.length) {
      return <p className="empty-note">Configure x-axis and y-axis fields.</p>;
    }

    if (!chartRows.length) {
      return <p className="empty-note">No data available for the selected configuration.</p>;
    }

    const Chart =
      chartKind === 'area'
        ? AreaChart
        : chartKind === 'line'
          ? LineChart
          : BarChart;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={chartRows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xField} />
          <YAxis tickFormatter={formatAxisTickValue} />
          <Tooltip formatter={(value) => formatMetricValue(Number(value))} />
          <Legend />
          {yFields.map((fieldKey, index) => (
            chartKind === 'area' ? (
              <Area
                key={fieldKey}
                type="monotone"
                dataKey={fieldKey}
                name={fieldsByKey[fieldKey]?.label || fieldKey}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                fillOpacity={0.18}
                strokeWidth={3}
              />
            ) : chartKind === 'line' ? (
              <Line
                key={fieldKey}
                type="monotone"
                dataKey={fieldKey}
                name={fieldsByKey[fieldKey]?.label || fieldKey}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            ) : (
              <Bar
                key={fieldKey}
                dataKey={fieldKey}
                name={fieldsByKey[fieldKey]?.label || fieldKey}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                stackId={chartKind === 'stackedBar' ? 'stack' : undefined}
                radius={chartKind === 'stackedBar' ? [4, 4, 0, 0] : [4, 4, 0, 0]}
              />
            )
          ))}
        </Chart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'summaryCard') {
    const metricField = widget.mapping?.metricField;
    const aggregation = widget.mapping?.aggregation || 'sum';

    if (!metricField && aggregation !== 'count') {
      return <p className="empty-note">Configure metric field.</p>;
    }

    const metricValue = aggregateRecords(records, metricField, aggregation);
    const comparisonField = widget.mapping?.comparisonField;
    const comparisonValue = comparisonField
      ? aggregateRecords(records, comparisonField, aggregation)
      : null;
    const trend = summarizeTrend(metricValue, comparisonValue);
    const tone = resolveSummaryTheme(widget.mapping?.colorTheme, trend.direction);
    const deltaLabel =
      trend.delta === null
        ? null
        : `${trend.direction === 'down' ? 'Down' : trend.direction === 'up' ? 'Up' : 'Flat'} ${
            trend.deltaPercent === null ? formatMetricValue(Math.abs(trend.delta)) : formatPercentValue(Math.abs(trend.deltaPercent))
          }`;

    return (
      <div className={`summary-card summary-card-${tone} summary-card-trend-${trend.direction}`}>
        <div className="summary-card-header">
          <span>{widget.title || 'Summary'}</span>
          <span className="summary-card-link" aria-hidden="true">
            ↗
          </span>
        </div>
        <strong>{formatMetricValue(metricValue)}</strong>
        <div className="summary-card-footer">
          {trend.delta !== null ? (
            <span className={`summary-delta summary-delta-${trend.direction}`}>
              {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '•'} {deltaLabel}
            </span>
          ) : null}
          <span>{widget.mapping?.helperText || fieldsByKey[metricField]?.label || 'Total'}</span>
        </div>
      </div>
    );
  }

  if (widget.type === 'kpiCard') {
    const displayMode = widget.mapping?.displayMode || 'metric';
    const tone = resolveSummaryTheme(widget.mapping?.colorTheme, 'neutral');

    if (displayMode === 'label') {
      const topRow = buildTopLabelRow(records, widget.mapping);
      const helperText = widget.mapping?.helperText || fieldsByKey[widget.mapping?.groupField]?.label || 'Top label';

      return (
        <div className={`summary-card summary-card-${tone} kpi-card kpi-card-label`}>
          <div className="summary-card-header">
            <span>{widget.title || 'KPI'}</span>
            <span className="summary-card-link" aria-hidden="true">
              ↗
            </span>
          </div>
          <strong>{topRow?.label || '-'}</strong>
          <div className="summary-card-footer">
            <span>{helperText}</span>
            {topRow ? <span className="kpi-card-subvalue">{formatMetricValue(topRow.value)}</span> : null}
          </div>
        </div>
      );
    }

    const metricField = widget.mapping?.metricField;
    const aggregation = widget.mapping?.aggregation || 'sum';

    if (!metricField && aggregation !== 'count') {
      return <p className="empty-note">Configure metric field.</p>;
    }

    const metricValue = aggregateRecords(records, metricField, aggregation);
    const helperText = widget.mapping?.helperText || fieldsByKey[metricField]?.label || 'Total';

    return (
      <div className={`summary-card summary-card-${tone} kpi-card`}>
        <div className="summary-card-header">
          <span>{widget.title || 'KPI'}</span>
          <span className="summary-card-link" aria-hidden="true">
            ↗
          </span>
        </div>
        <strong>{formatMetricValue(metricValue)}</strong>
        <div className="summary-card-footer">
          <span>{helperText}</span>
        </div>
      </div>
    );
  }

  if (widget.type === 'pie') {
    const labelField = widget.mapping?.labelField;
    const valueField = widget.mapping?.valueField;

    if (!labelField || !valueField) {
      return <p className="empty-note">Configure label and value fields.</p>;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={records} dataKey={valueField} nameKey={labelField} outerRadius={90} label>
            {records.map((record, index) => (
              <Cell key={`${record[labelField]}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'treemap') {
    const rows = buildTreemapRows(records, widget.mapping);

    if (!rows.length) {
      return <p className="empty-note">Configure label and value fields.</p>;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={rows} dataKey="size" nameKey="name" stroke="#e2e8f0" fill="#22c55e" />
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'rankingList') {
    const rows = buildRankingRows(records, widget.mapping);
    const valueField = widget.mapping?.valueField;
    const maxValue = Math.max(...rows.map((row) => row.value), 1);

    if (!rows.length) {
      return <p className="empty-note">Configure label, value, and top N fields.</p>;
    }

    return (
      <div className="ranking-list">
        <div className="ranking-list-header" style={isPreview ? { justifyContent: 'flex-end' } : undefined}>
          {!isPreview && <strong>{widget.title || 'Ranking'}</strong>}
          <span>{fieldsByKey[valueField]?.label || valueField}</span>
        </div>
        <ol>
          {rows.map((row, index) => (
            <li key={row.label}>
              <span className="ranking-index">{index + 1}</span>
              <div className="ranking-main">
                <div className="ranking-row-label">
                  <span>{row.label}</span>
                  <strong>{formatCellValue(row.value)}</strong>
                </div>
                <div className="ranking-bar-track">
                  <span style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (widget.type === 'table') {
    const columns = widget.mapping?.columns || [];

    if (!columns.length) {
      return <p className="empty-note">Choose at least one visible column.</p>;
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((columnKey) => (
                <th key={columnKey}>{fieldsByKey[columnKey]?.label || columnKey}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id || row.orderId || index}>
                {columns.map((columnKey) => {
                  // Year-like fields display as plain integer (no thousands separator)
                  const isYearLike = /year/i.test(columnKey) || /year/i.test(fieldsByKey[columnKey]?.label || '');
                  const raw = row[columnKey];
                  return (
                    <td key={columnKey}>
                      {isYearLike && raw != null && raw !== '' ? String(Math.trunc(Number(raw))) : formatCellValue(raw)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.type === 'miceNationalityMatrixView') {
    return <MiceNationalityMatrixView fixedProfile={fixedProfile} />;
  }

  if (widget.type === 'miceDrillFlow') {
    return <MiceDrillFlow fixedProfile={fixedProfile} globalFilter={globalFilter} />;
  }

  if (widget.type === 'miceDataTable') {
    return <MiceDataTableWidget rows={fixedProfile.dataTable || []} globalFilter={globalFilter} />;
  }

  return <p className="empty-note">Unsupported widget type.</p>;
}
