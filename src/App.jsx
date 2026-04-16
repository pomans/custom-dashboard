import React, { useEffect, useMemo, useRef, useState } from 'react';
import WidgetRenderer from './components/WidgetRenderer';
import { datasetLibrary, relationalKeys, widgetCatalog } from './data/sampleData';

const MIN_GRID_COLS = 12;
const GRID_ROW_HEIGHT = 72;
const GRID_COL_WIDTH = 96;
const MIN_W = 2;
const MIN_H = 2;
const MIN_CANVAS_ROWS = 20;
const CANVAS_GROWTH_PADDING = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const getFieldGroups = (dataset) => {
  const fields = dataset?.fields || [];
  const numericFields = fields.filter((field) => field.type === 'number');
  const dimensionFields = fields.filter((field) => field.type !== 'number');

  return { numericFields, dimensionFields };
};

const getFieldMap = (dataset) => Object.fromEntries((dataset?.fields || []).map((field) => [field.key, field]));

const getJoinableFields = (dataset) =>
  (dataset?.fields || []).filter((field) => relationalKeys.includes(field.key));

const getRelatableFields = (dataset) =>
  (dataset?.fields || []).filter((field) => field.type !== 'number');

const isDatasetCompatible = (widgetType, dataset) => {
  if (!dataset) return false;

  const { numericFields, dimensionFields } = getFieldGroups(dataset);

  if (widgetType === 'line' || widgetType === 'bar' || widgetType === 'pie' || widgetType === 'treemap') {
    return numericFields.length > 0 && dimensionFields.length > 0;
  }

  if (widgetType === 'table') {
    return dataset.fields.length > 0;
  }

  return false;
};

const buildDefaultMapping = (widgetType, dataset) => {
  if (!dataset) return {};

  const { numericFields, dimensionFields } = getFieldGroups(dataset);
  const primaryDimension = dimensionFields[0]?.key || '';
  const secondaryDimension = dimensionFields[1]?.key || '';
  const yFields = numericFields.slice(0, 2).map((field) => field.key);

  if (widgetType === 'line' || widgetType === 'bar') {
    return {
      xField: primaryDimension,
      yFields: yFields.length ? yFields : numericFields.slice(0, 1).map((field) => field.key)
    };
  }

  if (widgetType === 'pie') {
    return {
      labelField: primaryDimension,
      valueField: numericFields[0]?.key || ''
    };
  }

  if (widgetType === 'treemap') {
    return {
      groupField: secondaryDimension ? primaryDimension : '',
      labelField: secondaryDimension || primaryDimension,
      valueField: numericFields[0]?.key || ''
    };
  }

  if (widgetType === 'table') {
    return {
      columns: dataset.fields.slice(0, 4).map((field) => field.key)
    };
  }

  return {};
};

const buildDefaultRelation = (baseDatasetId, targetDatasetId) => {
  const baseDataset = datasetLibrary[baseDatasetId];
  const targetDataset = datasetLibrary[targetDatasetId];

  const baseRelatable = getRelatableFields(baseDataset);
  const targetRelatableMap = getFieldMap(targetDataset);
  const matchedField = baseRelatable.find((field) => targetRelatableMap[field.key]);

  return {
    baseField: matchedField?.key || '',
    targetField: matchedField?.key || '',
    sourceRole: matchedField?.key || '',
    targetRole: matchedField?.key || ''
  };
};

const buildDefaultSemanticMapping = (dataset) => {
  const datasetFieldMap = getFieldMap(dataset);

  return relationalKeys.reduce((acc, relationKey) => {
    acc[relationKey] = datasetFieldMap[relationKey] ? relationKey : '';
    return acc;
  }, {});
};

const createSourceAssignment = (widgetType, datasetId) => {
  const dataset = datasetLibrary[datasetId];

  return {
    sourceId: crypto.randomUUID(),
    datasetId,
    semanticMap: buildDefaultSemanticMapping(dataset),
    mapping: {
      ...buildDefaultMapping(widgetType, dataset),
      relations: []
    }
  };
};

const createWidget = (prev, template, x, y, overrides = {}) => {
  const index = prev.filter((item) => item.type === template.type).length + 1;
  const isTextWidget = template.type === 'label' || template.type === 'date';
  const datasetId = overrides.dataset ?? template.dataset ?? '';
  const sources = overrides.sources || (datasetId ? [createSourceAssignment(template.type, datasetId)] : []);

  return {
    id: crypto.randomUUID(),
    type: template.type,
    title: overrides.titleLabel?.trim() || `${template.title} ${index}`,
    sources,
    preview: overrides.preview || false,
    fontSize: overrides.fontSize || 28,
    x,
    y,
    w: overrides.w || 4,
    h: overrides.h || (isTextWidget ? 2 : 5)
  };
};

const lineTemplate = widgetCatalog.find((w) => w.type === 'line');
const barTemplate = widgetCatalog.find((w) => w.type === 'bar');
const tableTemplate = widgetCatalog.find((w) => w.type === 'table');

const initialWidgets = [
  createWidget([], lineTemplate, 0, 0, {
    titleLabel: 'Revenue Trend 1',
    dataset: 'monthlyBusiness',
    w: 6,
    h: 5
  }),
  createWidget([{ type: 'line' }], barTemplate, 6, 0, {
    titleLabel: 'Regional Performance 1',
    dataset: 'regionalPerformance',
    w: 6,
    h: 5
  }),
  createWidget([{ type: 'line' }, { type: 'bar' }], tableTemplate, 0, 5, {
    titleLabel: 'Order Records 1',
    dataset: 'orderRecords',
    w: 8,
    h: 5
  })
];

const hasDatasetTarget = (type) => !['label', 'date'].includes(type);

export default function App() {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [action, setAction] = useState(null);
  const [hoverGrid, setHoverGrid] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [dropTargetWidgetId, setDropTargetWidgetId] = useState(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [datasourceCollapsed, setDatasourceCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [activeConfigWidgetId, setActiveConfigWidgetId] = useState(null);
  const canvasRef = useRef(null);

  const cellWidth = GRID_COL_WIDTH;
  const datasourceList = useMemo(() => Object.values(datasetLibrary), []);
  const maxOccupiedCol = useMemo(() => {
    if (!widgets.length) return MIN_GRID_COLS;
    return Math.max(...widgets.map((widget) => widget.x + widget.w), MIN_GRID_COLS);
  }, [widgets]);
  const maxOccupiedRow = useMemo(() => {
    if (!widgets.length) return MIN_CANVAS_ROWS;
    return Math.max(...widgets.map((widget) => widget.y + widget.h), MIN_CANVAS_ROWS);
  }, [widgets]);
  const canvasCols = maxOccupiedCol + CANVAS_GROWTH_PADDING;
  const canvasRows = maxOccupiedRow + CANVAS_GROWTH_PADDING;
  const canvasContentWidth = canvasCols * cellWidth;
  const canvasHeight = canvasRows * GRID_ROW_HEIGHT;
  const activeConfigWidget = widgets.find((widget) => widget.id === activeConfigWidgetId) || null;
  const activeConfigSources = activeConfigWidget
    ? activeConfigWidget.sources.map((source) => ({
        ...source,
        dataset: datasetLibrary[source.datasetId]
      }))
    : [];
  const activeConfigBaseSource = activeConfigSources[0] || null;

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setCanvasWidth(width);
    });

    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!action || readOnly) return undefined;

    const onMove = (event) => {
      const deltaX = event.clientX - action.startX;
      const deltaY = event.clientY - action.startY;
      const snapX = Math.round(deltaX / cellWidth);
      const snapY = Math.round(deltaY / GRID_ROW_HEIGHT);

      setWidgets((prev) =>
        prev.map((item) => {
          if (item.id !== action.id) return item;

          if (action.kind === 'move') {
            const x = Math.max(0, action.origin.x + snapX);
            const y = Math.max(0, action.origin.y + snapY);
            return { ...item, x, y };
          }

          const nextW = Math.max(MIN_W, action.origin.w + snapX);
          const nextH = Math.max(MIN_H, action.origin.h + snapY);
          return { ...item, w: nextW, h: nextH };
        })
      );
    };

    const onUp = () => setAction(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [action, cellWidth, readOnly]);

  const getCompatibleDatasets = (widgetType) =>
    datasourceList.filter((dataset) => isDatasetCompatible(widgetType, dataset));

  const onPaletteDragStart = (event, type) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('widget/type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onDatasourceDragStart = (event, datasetId) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('datasource/id', datasetId);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onCanvasDragOver = (event) => {
    if (readOnly) return;
    if (!Array.from(event.dataTransfer.types).includes('widget/type')) return;

    event.preventDefault();

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.floor((event.clientX - rect.left) / cellWidth));
    const y = Math.max(0, Math.floor((event.clientY - rect.top) / GRID_ROW_HEIGHT));
    setHoverGrid({ x, y });
  };

  const onCanvasDrop = (event) => {
    if (readOnly) return;
    event.preventDefault();

    const type = event.dataTransfer.getData('widget/type');
    const template = widgetCatalog.find((item) => item.type === type);
    if (!template || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const droppedX = Math.max(0, Math.floor((event.clientX - rect.left) / cellWidth));
    const droppedY = Math.max(0, Math.floor((event.clientY - rect.top) / GRID_ROW_HEIGHT));

    setWidgets((prev) => [...prev, createWidget(prev, template, droppedX, droppedY)]);
    setHoverGrid(null);
  };

  const updateWidgetField = (id, field, value) => {
    if (readOnly) return;
    setWidgets((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const updateWidgetSourceMapping = (widgetId, sourceId, patch) => {
    if (readOnly) return;

    setWidgets((prev) =>
      prev.map((item) =>
        item.id === widgetId
          ? {
              ...item,
              sources: item.sources.map((source) =>
                source.sourceId === sourceId
                  ? {
                      ...source,
                      mapping: {
                        ...source.mapping,
                        ...patch
                      }
                    }
                  : source
              )
            }
          : item
      )
    );
  };

  const updateWidgetSourceSemanticMap = (widgetId, sourceId, semanticKey, fieldKey) => {
    if (readOnly) return;

    setWidgets((prev) =>
      prev.map((item) =>
        item.id === widgetId
          ? {
              ...item,
              sources: item.sources.map((source) =>
                source.sourceId === sourceId
                  ? {
                      ...source,
                      semanticMap: {
                        ...(source.semanticMap || {}),
                        [semanticKey]: fieldKey
                      }
                    }
                  : source
              )
            }
          : item
      )
    );
  };

  const updateWidgetSourceRelations = (widgetId, sourceId, relations) => {
    if (readOnly) return;

    setWidgets((prev) =>
      prev.map((item) =>
        item.id === widgetId
          ? {
              ...item,
              sources: item.sources.map((source) =>
                source.sourceId === sourceId
                  ? {
                      ...source,
                      mapping: {
                        ...source.mapping,
                        relations
                      }
                    }
                  : source
              )
            }
          : item
      )
    );
  };

  const addDatasourceToWidget = (widgetId, datasetId) => {
    const dataset = datasetLibrary[datasetId];

    setWidgets((prev) =>
      prev.map((item) => {
        if (item.id !== widgetId) return item;
        if (!isDatasetCompatible(item.type, dataset)) return item;

        const baseDatasetId = item.sources[0]?.datasetId;
        const defaultRelation = baseDatasetId
          ? buildDefaultRelation(baseDatasetId, datasetId)
          : null;
        const nextSource = createSourceAssignment(item.type, datasetId);
        nextSource.mapping.relations =
          defaultRelation?.baseField && defaultRelation?.targetField ? [defaultRelation] : [];

        return {
          ...item,
          sources: [...item.sources, nextSource]
        };
      })
    );
  };

  const removeWidgetSource = (widgetId, sourceId) => {
    if (readOnly) return;

    setWidgets((prev) =>
      prev.map((item) =>
        item.id === widgetId
          ? {
              ...item,
              sources: item.sources.filter((source) => source.sourceId !== sourceId)
            }
          : item
      )
    );
  };

  const toggleWidgetPreview = (id) => {
    if (readOnly) return;

    setWidgets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, preview: !item.preview } : item))
    );
  };

  const removeWidget = (id) => {
    if (readOnly) return;
    setWidgets((prev) => prev.filter((item) => item.id !== id));
  };

  const renderSourceMappingControls = (widget, source, baseSource) => {
    const dataset = datasetLibrary[source.datasetId];
    if (!dataset || !hasDatasetTarget(widget.type)) return null;

    const { numericFields, dimensionFields } = getFieldGroups(dataset);
    const semanticMap = source.semanticMap || {};
    const baseSemanticMap = baseSource?.semanticMap || {};
    const baseDataset = baseSource ? datasetLibrary[baseSource.datasetId] : null;
    const baseRelatableFields = getRelatableFields(baseDataset);
    const targetRelatableFields = getRelatableFields(dataset);
    const relationDefaults =
      baseSource && baseSource.sourceId !== source.sourceId
        ? buildDefaultRelation(baseSource.datasetId, source.datasetId)
        : null;

    const semanticSection = (
      <div className="semantic-grid">
        {relationalKeys.map((semanticKey) => (
          <label key={semanticKey}>
            <span>{semanticKey}</span>
            <select
              value={semanticMap[semanticKey] || ''}
              onChange={(event) =>
                updateWidgetSourceSemanticMap(widget.id, source.sourceId, semanticKey, event.target.value)
              }
            >
              <option value="">Not mapped</option>
              {dimensionFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );

    const relationBlock =
      baseSource && baseSource.sourceId !== source.sourceId ? (
        (() => {
          const relations = source.mapping?.relations?.length
            ? source.mapping.relations
            : relationDefaults?.baseField
              ? [relationDefaults]
              : [];
          const boardHeight = Math.max(baseRelatableFields.length, targetRelatableFields.length) * 38 + 68;

          const assignRelationFields = (baseField, targetField) => {
            const matchedRole = relationalKeys.find(
              (role) => baseSemanticMap[role] === baseField && semanticMap[role] === targetField
            );

            const currentRelations = source.mapping?.relations || [];
            const exists = currentRelations.some(
              (relation) => relation.baseField === baseField && relation.targetField === targetField
            );
            if (exists) return;

            updateWidgetSourceRelations(widget.id, source.sourceId, [
              ...currentRelations,
              {
                baseField,
                targetField,
                sourceRole: matchedRole || '',
                targetRole: matchedRole || ''
              }
            ]);
          };

          const onFieldDragStart = (event, side, fieldKey) => {
            event.dataTransfer.setData(
              'relation/field',
              JSON.stringify({ widgetId: widget.id, sourceId: source.sourceId, side, fieldKey })
            );
            event.dataTransfer.effectAllowed = 'move';
          };

          const onFieldDrop = (event, side, fieldKey) => {
            const raw = event.dataTransfer.getData('relation/field');
            if (!raw) return;

            const payload = JSON.parse(raw);
            if (payload.widgetId !== widget.id || payload.sourceId !== source.sourceId) return;

            event.preventDefault();

            if (payload.side === side) return;

            if (side === 'base') {
              assignRelationFields(fieldKey, payload.fieldKey);
            } else {
              assignRelationFields(payload.fieldKey, fieldKey);
            }
          };

          return (
            <>
              <div className="relation-grid">
                <label>
                  <span>Composite Relationship</span>
                  <select value="" disabled>
                    <option value="">Drag multiple column pairs to create AND conditions</option>
                  </select>
                </label>
                <label>
                  <span>Match Rule</span>
                  <select value="" disabled>
                    <option value="">All linked pairs must match</option>
                  </select>
                </label>
              </div>

              <div className="er-board" style={{ height: `${boardHeight}px` }}>
                {relations.length ? (
                  <svg className="er-connector" viewBox={`0 0 600 ${boardHeight}`} preserveAspectRatio="none">
                    {relations.map((relation) => {
                      const baseIndex = baseRelatableFields.findIndex((field) => field.key === relation.baseField);
                      const targetIndex = targetRelatableFields.findIndex((field) => field.key === relation.targetField);
                      if (baseIndex < 0 || targetIndex < 0) return null;

                      return (
                        <path
                          key={`${relation.baseField}:${relation.targetField}`}
                          d={`M 225 ${58 + baseIndex * 38} C 290 ${58 + baseIndex * 38}, 310 ${58 + targetIndex * 38}, 375 ${58 + targetIndex * 38}`}
                          fill="none"
                          stroke="#0ea5e9"
                          strokeWidth="3"
                          strokeDasharray="6 4"
                        />
                      );
                    })}
                  </svg>
                ) : null}

                <div className="er-card">
                  <div className="er-card-header">
                    <strong>{baseSource.dataset?.label}</strong>
                    <span>Base datasource</span>
                  </div>
                  <div className="er-field-list">
                    {baseRelatableFields.map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        className={`er-field ${
                          relations.some((relation) => relation.baseField === field.key) ? 'active' : ''
                        }`}
                        draggable
                        onDragStart={(event) => onFieldDragStart(event, 'base', field.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onFieldDrop(event, 'base', field.key)}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="er-center-label">
                  <span>ER Relation Builder</span>
                  <small>Drag a column from one side to the matching column on the other side</small>
                </div>

                <div className="er-card">
                  <div className="er-card-header">
                    <strong>{dataset.label}</strong>
                    <span>Linked datasource</span>
                  </div>
                  <div className="er-field-list">
                    {targetRelatableFields.map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        className={`er-field ${
                          relations.some((relation) => relation.targetField === field.key) ? 'active' : ''
                        }`}
                        draggable
                        onDragStart={(event) => onFieldDragStart(event, 'target', field.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onFieldDrop(event, 'target', field.key)}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {relations.length ? (
                <div className="relation-pair-list">
                  {relations.map((relation) => (
                    <div key={`${relation.baseField}:${relation.targetField}`} className="relation-pair-item">
                      <span>
                        {relation.baseField} = {relation.targetField}
                      </span>
                      <button
                        type="button"
                        className="remove-source-button"
                        onClick={() =>
                          updateWidgetSourceRelations(
                            widget.id,
                            source.sourceId,
                            relations.filter(
                              (item) =>
                                !(
                                  item.baseField === relation.baseField &&
                                  item.targetField === relation.targetField
                                )
                            )
                          )
                        }
                      >
                        Remove Link
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          );
        })()
      ) : null;

    if (widget.type === 'line' || widget.type === 'bar') {
      const yFields = source.mapping?.yFields || [];

      return (
        <>
          {semanticSection}
          {relationBlock}

          <div className="mapping-grid">
            <label>
              <span>X-Axis</span>
              <select
                value={source.mapping?.xField || ''}
                onChange={(event) =>
                  updateWidgetSourceMapping(widget.id, source.sourceId, { xField: event.target.value })
                }
              >
                {dimensionFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mapping-group">
              <span>Y-Axis Series</span>
              <div className="checkbox-list">
                {numericFields.map((field) => {
                  const checked = yFields.includes(field.key);

                  return (
                    <label key={field.key} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const nextFields = event.target.checked
                            ? [...yFields, field.key]
                            : yFields.filter((key) => key !== field.key);

                          updateWidgetSourceMapping(widget.id, source.sourceId, {
                            yFields: nextFields.length ? nextFields : [field.key]
                          });
                        }}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      );
    }

    if (widget.type === 'pie' || widget.type === 'treemap' || widget.type === 'table') {
      if (widget.type === 'pie') {
        return (
          <>
            {semanticSection}
            {relationBlock}
            <div className="mapping-grid">
              <label>
                <span>Label Field</span>
                <select
                  value={source.mapping?.labelField || ''}
                  onChange={(event) =>
                    updateWidgetSourceMapping(widget.id, source.sourceId, { labelField: event.target.value })
                  }
                >
                  {dimensionFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Value Field</span>
                <select
                  value={source.mapping?.valueField || ''}
                  onChange={(event) =>
                    updateWidgetSourceMapping(widget.id, source.sourceId, { valueField: event.target.value })
                  }
                >
                  {numericFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        );
      }

      if (widget.type === 'treemap') {
        return (
          <>
            {semanticSection}
            {relationBlock}
            <div className="mapping-grid">
              <label>
                <span>Group Field</span>
                <select
                  value={source.mapping?.groupField || ''}
                  onChange={(event) =>
                    updateWidgetSourceMapping(widget.id, source.sourceId, { groupField: event.target.value })
                  }
                >
                  <option value="">No Group</option>
                  {dimensionFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Label Field</span>
                <select
                  value={source.mapping?.labelField || ''}
                  onChange={(event) =>
                    updateWidgetSourceMapping(widget.id, source.sourceId, { labelField: event.target.value })
                  }
                >
                  {dimensionFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Value Field</span>
                <select
                  value={source.mapping?.valueField || ''}
                  onChange={(event) =>
                    updateWidgetSourceMapping(widget.id, source.sourceId, { valueField: event.target.value })
                  }
                >
                  {numericFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        );
      }

      return (
        <>
          {semanticSection}
          {relationBlock}
          <div className="mapping-grid">
            <div className="mapping-group">
              <span>Visible Columns</span>
              <div className="checkbox-list">
                {dataset.fields.map((field) => {
                  const visibleColumns = source.mapping?.columns || [];
                  const checked = visibleColumns.includes(field.key);

                  return (
                    <label key={field.key} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const nextColumns = event.target.checked
                            ? [...visibleColumns, field.key]
                            : visibleColumns.filter((key) => key !== field.key);

                          updateWidgetSourceMapping(widget.id, source.sourceId, {
                            columns: nextColumns.length ? nextColumns : [field.key]
                          });
                        }}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Dashboard Builder Prototype</h1>
          <p>ลาก widget ลง canvas แล้วลาก datasource หลายชุดเข้า widget พร้อมตั้ง relation ด้วย customer, department หรือ salesOwner</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="sidebar-toggle topbar-toggle"
            onClick={() => setSidebarHidden((prev) => !prev)}
          >
            {sidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
          </button>
          <button type="button" className="mode-toggle" onClick={() => setReadOnly((prev) => !prev)}>
            {readOnly ? 'Exit Read Only' : 'Read Only Preview'}
          </button>
        </div>
      </header>

      <div className={`builder-layout ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
        <aside className={`palette ${readOnly ? 'read-only' : ''} ${sidebarHidden ? 'hidden' : ''}`}>
          <section className={`palette-section ${paletteCollapsed ? 'collapsed' : ''}`}>
            <div className="palette-section-header">
              <div>
                <h3>Widget Palette</h3>
                {!paletteCollapsed ? <p>ลาก widget ไปวางบน canvas</p> : null}
              </div>
              <button
                type="button"
                className="section-toggle"
                onClick={() => setPaletteCollapsed((prev) => !prev)}
              >
                {paletteCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
            {!paletteCollapsed ? (
              <div className="palette-list">
                {widgetCatalog.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className="palette-item"
                    draggable={!readOnly}
                    disabled={readOnly}
                    onDragStart={(event) => onPaletteDragStart(event, item.type)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section
            className={`palette-section datasource-section ${paletteCollapsed ? 'priority' : ''} ${
              datasourceCollapsed ? 'collapsed' : ''
            }`}
          >
            <div className="palette-section-header">
              <div>
                <h3>Datasources</h3>
                {!datasourceCollapsed ? <p>ลาก datasource ไปใส่ widget แล้วเชื่อมด้วย field ร่วม</p> : null}
              </div>
              <button
                type="button"
                className="section-toggle"
                onClick={() => setDatasourceCollapsed((prev) => !prev)}
              >
                {datasourceCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
            {!datasourceCollapsed ? (
              <div className="datasource-list">
                {datasourceList.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="datasource-card"
                    draggable={!readOnly}
                    onDragStart={(event) => onDatasourceDragStart(event, dataset.id)}
                  >
                    <strong>{dataset.label}</strong>
                    <span>{dataset.description}</span>
                    <div className="datasource-meta">
                      <span>{dataset.records.length} rows</span>
                      <span>{dataset.fields.length} fields</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </aside>

        <main
          ref={canvasRef}
          className={`dashboard-canvas ${readOnly ? 'read-only' : ''}`}
          style={{
            '--grid-cols': canvasCols,
            '--row-size': `${GRID_ROW_HEIGHT}px`,
            '--canvas-height': `${canvasHeight}px`,
            '--canvas-width': `${canvasContentWidth}px`
          }}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
          onDragLeave={() => setHoverGrid(null)}
        >
          {!readOnly && hoverGrid ? (
            <div
              className="drop-preview"
              style={{
                left: hoverGrid.x * cellWidth,
                top: hoverGrid.y * GRID_ROW_HEIGHT,
                width: cellWidth * 4,
                height: GRID_ROW_HEIGHT * 4
              }}
            />
          ) : null}

          {widgets.map((widget) => {
            const compatibleDatasets = getCompatibleDatasets(widget.type);
            const isWidgetPreview = readOnly || widget.preview;
            const assignedSources = widget.sources.map((source) => ({
              ...source,
              dataset: datasetLibrary[source.datasetId]
            }));
            const baseSource = assignedSources[0] || null;
            const enrichedSources = assignedSources.map((source) => ({
              ...source,
              baseSemanticMap: baseSource?.semanticMap || {}
            }));

            return (
              <section
                key={widget.id}
                className={`widget-card ${readOnly ? 'read-only' : ''} ${
                  isWidgetPreview && (widget.type === 'label' || widget.type === 'date') ? 'no-chrome' : ''
                } ${dropTargetWidgetId === widget.id ? 'drop-target' : ''}`}
                style={{
                  left: widget.x * cellWidth,
                  top: widget.y * GRID_ROW_HEIGHT,
                  width: widget.w * cellWidth,
                  height: widget.h * GRID_ROW_HEIGHT
                }}
                onDragOver={(event) => {
                  if (readOnly || !hasDatasetTarget(widget.type)) return;
                  if (!Array.from(event.dataTransfer.types).includes('datasource/id')) return;

                  event.preventDefault();
                  setDropTargetWidgetId(widget.id);
                }}
                onDragLeave={() => {
                  if (dropTargetWidgetId === widget.id) setDropTargetWidgetId(null);
                }}
                onDrop={(event) => {
                  if (readOnly || !hasDatasetTarget(widget.type)) return;

                  const datasourceId = event.dataTransfer.getData('datasource/id');
                  const droppedDataset = datasetLibrary[datasourceId];
                  if (!droppedDataset || !isDatasetCompatible(widget.type, droppedDataset)) return;

                  event.preventDefault();
                  addDatasourceToWidget(widget.id, datasourceId);
                  setDropTargetWidgetId(null);
                }}
              >
                {isWidgetPreview && (widget.type === 'label' || widget.type === 'date') ? null : (
                  <div
                    className="widget-header drag-handle"
                    onMouseDown={(event) => {
                      if (readOnly) return;
                      if (
                        event.target.closest('select') ||
                        event.target.closest('button') ||
                        event.target.closest('input') ||
                        event.target.closest('.checkbox-item')
                      ) {
                        return;
                      }

                      setAction({
                        kind: 'move',
                        id: widget.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { x: widget.x, y: widget.y }
                      });
                    }}
                  >
                    {readOnly ? (
                      <div className="widget-title-block">
                        <small>{widget.type.toUpperCase()}</small>
                        <strong>{widget.title}</strong>
                        <span className="widget-dataset-badge">{assignedSources.length} datasource(s)</span>
                      </div>
                    ) : (
                      <>
                        <div className="widget-title-block">
                          <small>{widget.type.toUpperCase()}</small>
                          <input
                            type="text"
                            value={widget.title}
                            onChange={(e) => updateWidgetField(widget.id, 'title', e.target.value)}
                          />
                          {hasDatasetTarget(widget.type) ? (
                            <div className="widget-dataset-dropzone">
                              <span>
                                {assignedSources.length
                                  ? `${assignedSources.length} datasource(s) attached`
                                  : 'Drop datasource here'}
                              </span>
                              <small>
                                {assignedSources.length
                                  ? assignedSources.map((source) => source.dataset?.label).filter(Boolean).join(', ')
                                  : 'You can add more than one datasource'}
                              </small>
                            </div>
                          ) : null}
                        </div>
                        <div className="widget-controls">
                          {hasDatasetTarget(widget.type) ? (
                            <button
                              type="button"
                              className="config-toggle"
                              onClick={() => setActiveConfigWidgetId(widget.id)}
                            >
                              Configure
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="preview-toggle"
                            onClick={() => toggleWidgetPreview(widget.id)}
                          >
                            {widget.preview ? 'Edit' : 'Preview'}
                          </button>
                          {widget.type === 'label' || widget.type === 'date' ? (
                            <input
                              type="number"
                              min="10"
                              max="96"
                              value={widget.fontSize || 28}
                              onChange={(e) =>
                                updateWidgetField(widget.id, 'fontSize', Number(e.target.value) || 10)
                              }
                            />
                          ) : null}
                          <button type="button" onClick={() => removeWidget(widget.id)}>
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="widget-content">
                  {!isWidgetPreview && hasDatasetTarget(widget.type) ? (
                    <div className="widget-assignment-hint compact">
                      <span>Compatible datasources:</span>
                      <div className="hint-chip-list">
                        {compatibleDatasets.slice(0, 4).map((item) => (
                          <span key={item.id} className="hint-chip">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="widget-visual">
                    <WidgetRenderer widget={widget} sources={enrichedSources} />
                  </div>
                </div>

                {!readOnly ? (
                  <button
                    type="button"
                    aria-label="Resize widget"
                    className="resize-handle"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setAction({
                        kind: 'resize',
                        id: widget.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { w: widget.w, h: widget.h }
                      });
                    }}
                  />
                ) : null}
              </section>
            );
          })}
        </main>
      </div>

      {activeConfigWidget ? (
        <div className="modal-backdrop" onClick={() => setActiveConfigWidgetId(null)}>
          <div className="config-modal" onClick={(event) => event.stopPropagation()}>
            <div className="config-modal-header">
              <div>
                <h2>{activeConfigWidget.title}</h2>
                <p>Configure datasources, column mapping, and relationships for this widget.</p>
              </div>
              <button type="button" className="section-toggle" onClick={() => setActiveConfigWidgetId(null)}>
                Close
              </button>
            </div>

            <div className="config-modal-body">
              <div className="widget-assignment-hint">
                <span>Compatible datasources:</span>
                <div className="hint-chip-list">
                  {getCompatibleDatasets(activeConfigWidget.type).map((item) => (
                    <span key={item.id} className="hint-chip">
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {activeConfigSources.map((source, index) => (
                <section key={source.sourceId} className="source-config-card">
                  <div className="source-config-header">
                    <div>
                      <strong>
                        Source {index + 1}: {source.dataset?.label || source.datasetId}
                      </strong>
                      <span>
                        {index === 0
                          ? 'Base source for relationship matching'
                          : 'Linked to base source using shared fields'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="remove-source-button"
                      onClick={() => removeWidgetSource(activeConfigWidget.id, source.sourceId)}
                    >
                      Remove Source
                    </button>
                  </div>
                  {renderSourceMappingControls(activeConfigWidget, source, activeConfigBaseSource)}
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
