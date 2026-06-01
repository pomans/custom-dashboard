import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
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

const renderQuarterlyChartPanel = ({ title, color, yLabel, data, yTickFormatter }) => {
  const withYoy = data.map((row) => ({
    ...row,
    yoy: row.lastYear !== 0 ? ((row.thisYear - row.lastYear) / Math.abs(row.lastYear)) * 100 : null
  }));
  return (
    <div className="fixed-mice-chart">
      <div className="fixed-mice-chart-header">
        <div className="fixed-mice-chart-title" style={{ background: color }}>{title}</div>
        <div className="fixed-mice-chart-rule" />
      </div>
      {renderQuarterlyLegend()}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={withYoy} margin={{ top: 32, right: 24, bottom: 24, left: 18 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eaf2" />
          <XAxis dataKey="quarter" tick={{ fontSize: 13 }} tickMargin={8} />
          <YAxis tickFormatter={yTickFormatter || formatAxisTickValue} width={72} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatMetricValue(Number(value))} />
          <Line
            type="monotone"
            dataKey="thisYear"
            name="This Year"
            stroke="#081f68"
            strokeWidth={3}
            dot={{ r: 5, fill: '#081f68', stroke: '#081f68' }}
            activeDot={{ r: 7 }}
          >
            <LabelList dataKey="yoy" content={renderYoyBadge} />
          </Line>
          <Line
            type="monotone"
            dataKey="lastYear"
            name="Last Year"
            stroke="#7ec8e3"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 4, fill: '#7ec8e3', stroke: '#7ec8e3' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="fixed-mice-chart-axis-label">{yLabel}</div>
    </div>
  );
};

const renderYoyBadge = ({ x, y, value }) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  const positive = value >= 0;
  const text = `${positive ? '▲' : '▼'} ${Math.abs(value).toFixed(1)}%`;
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

const renderFixedChartPanel = ({ title, color, yLabel, actualSeries, forecastSeries, yTickFormatter }) => (
  <div className="fixed-mice-chart">
    <div className="fixed-mice-chart-header">
      <div className="fixed-mice-chart-title" style={{ background: color }}>
        {title}
      </div>
      <div className="fixed-mice-chart-rule" />
    </div>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={[...actualSeries, ...forecastSeries]}
        margin={{ top: 18, right: 18, bottom: 42, left: 18 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        {actualSeries.map((entry) =>
          entry.year % 2 === 0 ? (
            <ReferenceArea
              key={`band-${entry.year}`}
              x1={entry.year - 0.5}
              x2={entry.year + 0.5}
              fill="#d9d9d9"
              fillOpacity={0.35}
              ifOverflow="extendDomain"
            />
          ) : null
        )}
        <XAxis
          dataKey="year"
          tickFormatter={formatAnnualTick}
          interval={0}
          height={44}
          tick={{ angle: -45, textAnchor: 'end', fontSize: 10 }}
          tickMargin={4}
        />
        <YAxis tickFormatter={yTickFormatter || formatAxisTickValue} width={82} />
        <Tooltip formatter={(value) => formatMetricValue(Number(value))} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0f1f68"
          strokeWidth={3.5}
          dot={{ r: 5, fill: '#0f1f68' }}
          activeDot={{ r: 6 }}
          data={actualSeries}
        >
          <LabelList dataKey="yoy" content={renderYoyBadge} />
        </Line>
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0f1f68"
          strokeWidth={3}
          dot={false}
          strokeDasharray="6 6"
          data={forecastSeries}
        />
      </LineChart>
    </ResponsiveContainer>
    <div className="fixed-mice-chart-axis-label">{yLabel}</div>
  </div>
);

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

/* ─── ShrinkText: ลด font-size อัตโนมัติเมื่อข้อความล้น container ──────── */
function ShrinkText({ text, maxPx = 28, minPx = 10, style = {}, className = '' }) {
  const containerRef = useRef(null);
  const textRef      = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el        = textRef.current;
    if (!container || !el) return;

    // Reset ก่อนวัด
    el.style.fontSize = `${maxPx}px`;

    let size = maxPx;
    // ลด 1px ต่อรอบจน text ไม่ล้น container ทั้ง width และ height
    while (size > minPx && (el.scrollWidth > container.clientWidth + 2 || el.scrollHeight > container.clientHeight + 2)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [text, maxPx, minPx]);

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <strong
        ref={textRef}
        className={className}
        style={{
          fontSize: `${maxPx}px`,
          lineHeight: 1.15,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          textAlign: 'center',
          display: 'block',
          width: '100%',
          ...style,
        }}
      >
        {text}
      </strong>
    </div>
  );
}

/* ─── Nationality Performance with Continent filter ─────────── */
function MiceNationalityPerformanceWidget({ fixedProfile }) {
  const [selContinent, setSelContinent] = useState('all');
  const allRows = fixedProfile.nationalityPerformance || [];
  const continents = Array.from(new Set(allRows.map(r => r.continent))).sort();
  const continentOptions = [
    { value: 'all', label: 'ทั้งหมด' },
    ...continents.map(c => ({ value: c, label: c }))
  ];
  const rows = selContinent === 'all' ? allRows : allRows.filter(r => r.continent === selContinent);
  const maxValue = Math.max(...rows.map(r => r.current), 1);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
  const totalPrev    = rows.reduce((s, r) => s + r.previous, 0);

  return (
    <div className="fixed-mice-table-shell">
      <div className="fixed-mice-chart-title fixed-mice-chart-title-table">Nationality Performance</div>
      <WidgetFilterBar
        label="ทวีป"
        options={continentOptions}
        value={selContinent}
        onChange={setSelContinent}
      />
      <div className="fixed-mice-table-wrap fixed-mice-table-shell-main">
        <table className="fixed-mice-table fixed-mice-table-heavy">
          <thead>
            <tr>
              <th>Continent</th>
              <th>Nationality</th>
              <th>No. of Visitors</th>
              <th>Last Year</th>
              <th>%YoY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.nationality}>
                <td>{row.continent}</td>
                <td>{row.nationality}</td>
                <td>
                  <div className="table-cell-bar">
                    <span style={{ width: `${Math.max(10, (row.current / maxValue) * 100)}%` }} />
                    <strong>{formatMetricValue(row.current)}</strong>
                  </div>
                </td>
                <td>{formatMetricValue(row.previous)}</td>
                <td className={row.yoy >= 0 ? 'positive' : 'negative'}>
                  {`${row.yoy >= 0 ? '▲' : '▼'} ${Math.abs(row.yoy).toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2">Total</td>
              <td>{formatMetricValue(totalCurrent)}</td>
              <td>{formatMetricValue(totalPrev)}</td>
              <td className={formatYoY(totalCurrent, totalPrev) >= 0 ? 'positive' : 'negative'}>
                {formatYoY(totalCurrent, totalPrev) === null
                  ? '-'
                  : `${formatYoY(totalCurrent, totalPrev) >= 0 ? '▲' : '▼'} ${Math.abs(formatYoY(totalCurrent, totalPrev)).toFixed(1)}%`}
              </td>
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
    { value: 'all', label: 'ทั้งหมด' },
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
        label="อุตสาหกรรม"
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
  const [selQuarter, setSelQuarter] = useState('all');

  const industryRows = fixedProfile.nationalityIndustryMatrix2025 || [];
  const periodRows   = fixedProfile.nationalityQuarterMatrix || [];

  const industryCols  = ['Meetings', 'Conventions'];
  const allPeriodCols = ['Q1', 'Q2', 'Q3', 'Q4'];

  // When a single quarter is selected, show only that column; otherwise all
  const periodCols = selQuarter === 'all' ? allPeriodCols : [selQuarter];
  const cols = view === 'industry' ? industryCols : periodCols;
  const rows = view === 'industry' ? industryRows : periodRows;

  const maxTotal = Math.max(...rows.map(r => r.Total), 1);

  const quarterOptions = [
    { value: 'all', label: 'ทั้งหมด' },
    ...allPeriodCols.map(q => ({ value: q, label: q }))
  ];

  return (
    <div className="mice-matrix-view">
      <div className="mice-matrix-toolbar">
        <span className="mice-matrix-toolbar-label">เลือกมุมมอง :</span>
        <div className="mice-matrix-toggle">
          {['industry', 'period'].map(mode => (
            <button
              key={mode}
              type="button"
              className={`mice-matrix-toggle-btn${view === mode ? ' active' : ''}`}
              onClick={() => { setView(mode); setSelQuarter('all'); }}
            >
              {mode === 'industry' ? 'Industry' : 'Period'}
            </button>
          ))}
        </div>

        {/* Quarter filter — only visible in Period view */}
        {view === 'period' && (
          <WidgetFilterBar
            label="ไตรมาส"
            options={quarterOptions}
            value={selQuarter}
            onChange={setSelQuarter}
          />
        )}
      </div>

      <div className="mice-matrix-table-wrap">
        <table className="mice-matrix-table">
          <thead>
            <tr>
              <th>Nationality</th>
              {cols.map(c => <th key={c}>{c}</th>)}
              <th className="col-total">Total <span className="sort-arrow">▼</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const maxCol = Math.max(...cols.map(c => row[c] || 0), 1);
              return (
                <tr key={row.nationality}>
                  <td className="cell-nationality">{row.nationality}</td>
                  {cols.map(c => {
                    const v = row[c] || 0;
                    const pct = v ? Math.max(8, (v / maxCol) * 100) : 0;
                    return (
                      <td key={c} className={`cell-val${v ? ' has-val' : ''}`}>
                        {v ? (
                          <div className="cell-bar-wrap">
                            <div className="cell-bar-fill" style={{ width: `${pct}%` }} />
                            <span>{fmt.format(v)}</span>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="cell-total">
                    <div className="cell-total-inner">
                      <div className="cell-total-track">
                        <div className="cell-total-fill" style={{ width: `${Math.max(4, (row.Total / maxTotal) * 100)}%` }} />
                      </div>
                      <strong>{fmt.format(row.Total)}</strong>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              {cols.map(c => (
                <td key={c}><strong>{fmt.format(rows.reduce((s, r) => s + (r[c] || 0), 0))}</strong></td>
              ))}
              <td className="cell-total"><strong>{fmt.format(rows.reduce((s, r) => s + r.Total, 0))}</strong></td>
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
function MiceDrillFlow({ fixedProfile }) {
  const data = fixedProfile.sankeyFlow || { total: 0, nationality: [] };
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
    <div className="df2-shell" ref={containerRef}>
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
        <div className="df2-chip">
          <div className="df2-chip-top">
            <span className="df2-chip-field">Quarter</span>
          </div>
          <span className="df2-chip-val">—</span>
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

export default function WidgetRenderer({ widget, dataset, records: overrideRecords, isPreview }) {
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

  if (!dataset?.records?.length) {
    return <p className="empty-note">This widget does not have a fixed datasource configured.</p>;
  }

  const records = overrideRecords || dataset.records;
  const fieldsByKey = Object.fromEntries((dataset.fields || []).map((field) => [field.key, field]));
  const fixedProfile = dataset.fixedProfile || {};

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
        <ShrinkText text={cfg.value} maxPx={28} minPx={10} />
        <span>{cfg.label}</span>
      </div>
    );
  }

  if (widget.type === 'miceEventsChart') {
    const annual = fixedProfile.charts?.events || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year,
      value: item.value,
      yoy: index > 0 ? computeYoY(item.value, annual[index - 1].value) : null
    }));
    const forecastSeries = buildForecastSeries(actualSeries);
    return renderFixedChartPanel({
      title: 'จำนวนงานไมซ์ที่เกิดขึ้น (MICE Events)',
      color: '#081f68',
      yLabel: 'MICE Events',
      actualSeries,
      forecastSeries,
      yTickFormatter: formatYAxisTickThousands
    });
  }

  if (widget.type === 'miceRevenueChart') {
    const annual = fixedProfile.charts?.revenue || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year,
      value: item.value,
      yoy: index > 0 ? computeYoY(item.value, annual[index - 1].value) : null
    }));
    const forecastSeries = buildForecastSeries(actualSeries);
    return renderFixedChartPanel({
      title: 'รายได้จากการจัดงานไมซ์ (MICE Revenue Generated)',
      color: '#1d4fb3',
      yLabel: 'ล้านบาท',
      actualSeries,
      forecastSeries,
      yTickFormatter: formatYAxisTickFull
    });
  }

  if (widget.type === 'miceVisitorsChart') {
    const annual = fixedProfile.charts?.visitors || [];
    const actualSeries = annual.map((item, index) => ({
      year: item.year,
      value: item.value,
      yoy: index > 0 ? computeYoY(item.value, annual[index - 1].value) : null
    }));
    const forecastSeries = buildForecastSeries(actualSeries);
    return renderFixedChartPanel({
      title: 'จำนวนนักเดินทางไมซ์ (MICE Visitors)',
      color: '#4098b9',
      yLabel: 'MICE Visitors',
      actualSeries,
      forecastSeries,
      yTickFormatter: formatYAxisTickMillions
    });
  }

  if (widget.type === 'miceEventsQuarterlyChart') {
    return renderQuarterlyChartPanel({
      title: 'MICE Events Performance Over Time',
      color: '#081f68',
      yLabel: 'No. of Events',
      data: fixedProfile.chartsQuarterly?.events || [],
      yTickFormatter: formatYAxisTickThousands
    });
  }

  if (widget.type === 'miceVisitorsQuarterlyChart') {
    return renderQuarterlyChartPanel({
      title: 'MICE International Visitors Performance Over Time',
      color: '#1d6fe8',
      yLabel: 'No. of Visitors',
      data: fixedProfile.chartsQuarterly?.visitors || [],
      yTickFormatter: formatYAxisTickThousands
    });
  }

  if (widget.type === 'miceKpis') {
    const profile = fixedProfile.kpis || {};
    const cards = [
      { value: formatMetricValue(profile.events), label: 'MICE Events' },
      { value: `${profile.eventsGrowth >= 0 ? '▲' : '▼'} ${Math.abs(profile.eventsGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.eventsGrowth >= 0 ? 'up' : 'down' },
      { value: formatMetricValue(profile.visitors), label: 'MICE Inter Visitors' },
      { value: `${profile.visitorsGrowth >= 0 ? '▲' : '▼'} ${Math.abs(profile.visitorsGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.visitorsGrowth >= 0 ? 'up' : 'down' },
      { value: profile.topNationality || '-', label: 'Top Nationality' },
      { value: `${profile.topNationalityGrowth >= 0 ? '▲' : '▼'} ${Math.abs(profile.topNationalityGrowth).toFixed(1)}%`, label: '%Growth (YoY)', accent: profile.topNationalityGrowth >= 0 ? 'up' : 'down' },
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

  if (widget.type === 'miceVisitorsBreakdown') {
    const breakdown = fixedProfile.breakdown || {};
    const nationalityRows = breakdown.nationality || [];
    const industryRows = breakdown.industry || [];
    const quarterRows = breakdown.quarter || [];
    const total = breakdown.total || 0;

    return (
      <div className="fixed-mice-breakdown">
        <div className="fixed-mice-chart-title fixed-mice-chart-title-breakdown">MICE Visitors Breakdown</div>
        <div className="fixed-mice-breakdown-root">
          <div className="breakdown-root-card">
            <strong>This Year</strong>
            <span>{formatMetricValue(total)}</span>
          </div>
          <div className="breakdown-column">
            <div className="breakdown-column-title">Nationality</div>
            {nationalityRows.map((row) => (
              <div key={row.label} className="breakdown-node">
                <span>{row.label}</span>
                <strong>{formatMetricValue(row.value)}</strong>
                <div className="breakdown-track">
                  <i style={{ width: `${Math.max(6, (row.value / nationalityRows[0].value) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="breakdown-column">
            <div className="breakdown-column-title">Industry</div>
            {industryRows.map((row) => (
              <div key={row.label} className="breakdown-node">
                <span>{row.label}</span>
                <strong>{formatMetricValue(row.value)}</strong>
                <div className="breakdown-track">
                  <i style={{ width: `${Math.max(6, (row.value / industryRows[0].value) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="breakdown-column">
            <div className="breakdown-column-title">Quarter</div>
            {quarterRows.map((row) => (
              <div key={row.label} className="breakdown-node">
                <span>{row.label}</span>
                <strong>{formatMetricValue(row.value)}</strong>
                <div className="breakdown-track">
                  <i style={{ width: `${Math.max(6, (row.value / quarterRows[0].value) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
                {columns.map((columnKey) => (
                  <td key={columnKey}>{formatCellValue(row[columnKey])}</td>
                ))}
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
    return <MiceDrillFlow fixedProfile={fixedProfile} />;
  }

  return <p className="empty-note">Unsupported widget type.</p>;
}
