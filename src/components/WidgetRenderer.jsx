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

  return value;
};

const sumBy = (records, field) =>
  records.reduce((sum, record) => sum + (Number(record[field]) || 0), 0);

const getRelatedRecords = (baseRecord, source, isBaseSource) => {
  const dataset = source.dataset;
  if (!dataset?.records?.length) return [];

  if (isBaseSource) return [baseRecord];

  const relations = source.mapping?.relations || [];

  if (!relations.length) return [];

  return dataset.records.filter((record) =>
    relations.every((relation) => {
      const directBaseField = relation.baseField;
      const directTargetField = relation.targetField;
      const sourceRole = relation.sourceRole;
      const targetRole = relation.targetRole;
      const baseField = directBaseField || source.baseSemanticMap?.[sourceRole];
      const targetField = directTargetField || source.semanticMap?.[targetRole];

      if (!baseField || !targetField) return false;
      return record[targetField] === baseRecord[baseField];
    })
  );
};

const buildJoinedSeriesModel = (sources) => {
  const baseSource = sources[0];
  if (!baseSource?.dataset?.records?.length) return { rows: [], seriesDefinitions: [] };

  const rowsByLabel = new Map();
  const seriesDefinitions = [];
  const baseXField = baseSource.mapping?.xField;

  if (!baseXField) return { rows: [], seriesDefinitions: [] };

  baseSource.dataset.records.forEach((baseRecord) => {
    const label = String(baseRecord[baseXField] ?? '');
    if (!rowsByLabel.has(label)) rowsByLabel.set(label, { category: label });

    const row = rowsByLabel.get(label);

    sources.forEach((source, sourceIndex) => {
      const yFields = source.mapping?.yFields || [];
      const matchedRecords = getRelatedRecords(baseRecord, source, sourceIndex === 0);

      yFields.forEach((fieldKey) => {
        const seriesKey = `${source.sourceId}:${fieldKey}`;
        row[seriesKey] = (row[seriesKey] || 0) + sumBy(matchedRecords, fieldKey);
      });
    });
  });

  sources.forEach((source) => {
    const yFields = source.mapping?.yFields || [];
    yFields.forEach((fieldKey) => {
      const fieldLabel = source.dataset?.fields.find((field) => field.key === fieldKey)?.label || fieldKey;
      seriesDefinitions.push({
        key: `${source.sourceId}:${fieldKey}`,
        label: `${source.dataset?.label || source.datasetId} - ${fieldLabel}`
      });
    });
  });

  return {
    rows: Array.from(rowsByLabel.values()),
    seriesDefinitions
  };
};

const buildJoinedPieRows = (sources) => {
  const baseSource = sources[0];
  if (!baseSource?.dataset?.records?.length) return [];

  const baseLabelField = baseSource.mapping?.labelField;
  const baseValueField = baseSource.mapping?.valueField;
  if (!baseLabelField || !baseValueField) return [];

  return baseSource.dataset.records.flatMap((baseRecord) => {
    const rows = [
      {
        name: `${baseSource.dataset.label} - ${baseRecord[baseLabelField]}`,
        value: Number(baseRecord[baseValueField]) || 0
      }
    ];

    sources.slice(1).forEach((source) => {
      const labelField = source.mapping?.labelField;
      const valueField = source.mapping?.valueField;
      const relatedRecords = getRelatedRecords(baseRecord, source, false);

      if (!labelField || !valueField || !relatedRecords.length) return;

      relatedRecords.forEach((record) => {
        rows.push({
          name: `${source.dataset.label} - ${record[labelField]}`,
          value: Number(record[valueField]) || 0
        });
      });
    });

    return rows;
  });
};

const buildJoinedTreemapRows = (sources) => {
  const baseSource = sources[0];
  if (!baseSource?.dataset?.records?.length) return [];

  const baseLabelField = baseSource.mapping?.labelField;
  const baseValueField = baseSource.mapping?.valueField;
  if (!baseLabelField || !baseValueField) return [];

  return baseSource.dataset.records.map((baseRecord) => {
    const children = [
      {
        name: `${baseSource.dataset.label} - ${baseRecord[baseLabelField]}`,
        size: Number(baseRecord[baseValueField]) || 0
      }
    ];

    sources.slice(1).forEach((source) => {
      const labelField = source.mapping?.labelField;
      const valueField = source.mapping?.valueField;
      const relatedRecords = getRelatedRecords(baseRecord, source, false);

      if (!labelField || !valueField || !relatedRecords.length) return;

      relatedRecords.forEach((record) => {
        children.push({
          name: `${source.dataset.label} - ${record[labelField]}`,
          size: Number(record[valueField]) || 0
        });
      });
    });

    return {
      name: String(baseRecord[baseLabelField]),
      children
    };
  });
};

const buildJoinedTableModel = (sources) => {
  const baseSource = sources[0];
  if (!baseSource?.dataset?.records?.length) return { columns: [], rows: [] };

  const columns = [];
  const rows = [];

  sources.forEach((source) => {
    const visibleColumns = source.mapping?.columns || [];
    visibleColumns.forEach((columnKey) => {
      const fieldLabel = source.dataset?.fields.find((field) => field.key === columnKey)?.label || columnKey;
      columns.push({
        key: `${source.sourceId}:${columnKey}`,
        sourceId: source.sourceId,
        columnKey,
        label: `${source.dataset.label} - ${fieldLabel}`
      });
    });
  });

  baseSource.dataset.records.forEach((baseRecord, index) => {
    const rowValues = {};

    sources.forEach((source, sourceIndex) => {
      const visibleColumns = source.mapping?.columns || [];
      const relatedRecords = getRelatedRecords(baseRecord, source, sourceIndex === 0);
      const firstMatch = relatedRecords[0] || {};

      visibleColumns.forEach((columnKey) => {
        const value =
          typeof firstMatch[columnKey] === 'number'
            ? sumBy(relatedRecords, columnKey)
            : firstMatch[columnKey] || '-';

        rowValues[`${source.sourceId}:${columnKey}`] = value;
      });
    });

    rows.push({
      id: baseRecord.id || baseRecord.orderId || index,
      relationLabel:
        baseRecord.customer || baseRecord.department || baseRecord.salesOwner || `Row ${index + 1}`,
      values: rowValues
    });
  });

  return { columns, rows };
};

export default function WidgetRenderer({ widget, sources }) {
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

  const readySources = (sources || []).filter((source) => source.dataset?.records?.length);

  if (!readySources.length) {
    return <p className="empty-note">Drop one or more datasources into this widget.</p>;
  }

  if (widget.type === 'line' || widget.type === 'bar') {
    const { rows, seriesDefinitions } = buildJoinedSeriesModel(readySources);

    if (!rows.length || !seriesDefinitions.length) {
      return <p className="empty-note">Configure axes and relation fields for the joined datasources.</p>;
    }

    const Chart = widget.type === 'line' ? LineChart : BarChart;
    const SeriesComponent = widget.type === 'line' ? Line : Bar;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Legend />
          {seriesDefinitions.map((series, index) => (
            <SeriesComponent
              key={series.key}
              type={widget.type === 'line' ? 'monotone' : undefined}
              dataKey={series.key}
              name={series.label}
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
    const pieRows = buildJoinedPieRows(readySources);

    if (!pieRows.length) {
      return <p className="empty-note">Choose label/value fields and relation fields to build the linked pie chart.</p>;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={pieRows} dataKey="value" nameKey="name" outerRadius={90} label>
            {pieRows.map((entry, index) => (
              <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'treemap') {
    const treemapRows = buildJoinedTreemapRows(readySources);

    if (!treemapRows.length) {
      return <p className="empty-note">Choose label/value fields and relation fields to build the linked treemap.</p>;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={treemapRows} dataKey="size" nameKey="name" stroke="#e2e8f0" fill="#22c55e" />
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'table') {
    const { columns, rows } = buildJoinedTableModel(readySources);

    if (!columns.length || !rows.length) {
      return <p className="empty-note">Choose visible columns and relation fields to build the linked table.</p>;
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Linked By</th>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.relationLabel}</td>
                {columns.map((column) => (
                  <td key={column.key}>{formatCellValue(row.values[column.key])}</td>
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
