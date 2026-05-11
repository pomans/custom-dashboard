import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis
} from 'recharts';

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
const SERIES_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatCellValue = (value) => {
  if (typeof value === 'number' && Math.abs(value) >= 1000) {
    return currencyFormatter.format(value);
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

const formatPercentValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${compactNumberFormatter.format(value)}%`;
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

export default function WidgetRenderer({ widget, dataset }) {
  if (widget.type === 'textbox' || widget.type === 'label' || widget.type === 'date') {
    const fallback =
      widget.type === 'date' ? '${format_date(current_date)}' : widget.title || 'Text';
    const textStyle = widget.textStyle || {};

    return (
      <div
        className="label-widget"
        style={{
          fontSize: `${widget.fontSize || 28}px`,
          fontWeight: textStyle.fontWeight || 600,
          fontStyle: textStyle.fontStyle || 'normal',
          textDecoration: textStyle.textDecoration || 'none',
          textAlign: widget.textAlign || 'center',
          justifyContent:
            widget.textAlign === 'left' ? 'flex-start' : widget.textAlign === 'right' ? 'flex-end' : 'center'
        }}
      >
        {renderTextExpression(widget.expression, fallback)}
      </div>
    );
  }

  if (!dataset?.records?.length) {
    return <p className="empty-note">Drop one datasource into this widget.</p>;
  }

  const records = dataset.records;
  const fieldsByKey = Object.fromEntries((dataset.fields || []).map((field) => [field.key, field]));

  if (widget.type === 'line' || widget.type === 'bar') {
    const xField = widget.mapping?.xField;
    const yFields = widget.mapping?.yFields || [];

    if (!xField || !yFields.length) {
      return <p className="empty-note">Configure x-axis and y-axis fields.</p>;
    }

    const Chart = widget.type === 'line' ? LineChart : BarChart;
    const SeriesComponent = widget.type === 'line' ? Line : Bar;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={records}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xField} />
          <YAxis />
          <Tooltip />
          <Legend />
          {yFields.map((fieldKey, index) => (
            <SeriesComponent
              key={fieldKey}
              type={widget.type === 'line' ? 'monotone' : undefined}
              dataKey={fieldKey}
              name={fieldsByKey[fieldKey]?.label || fieldKey}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={widget.type === 'line' ? 3 : undefined}
            />
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
        <div className="ranking-list-header">
          <strong>{widget.title || 'Ranking'}</strong>
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

  return <p className="empty-note">Unsupported widget type.</p>;
}
