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
  if (widget.type === 'date') {
    return (
      <div className="label-widget" style={{ fontSize: `${widget.fontSize || 28}px` }}>
        {new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </div>
    );
  }

  if (widget.type === 'label') {
    return (
      <div className="label-widget" style={{ fontSize: `${widget.fontSize || 28}px` }}>
        {widget.title || 'Label'}
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
