import React, { useEffect, useMemo, useRef, useState } from 'react';
import WidgetRenderer from './components/WidgetRenderer';
import { datasetLibrary, widgetCatalog } from './data/sampleData';

const MIN_GRID_COLS = 12;
const GRID_ROW_HEIGHT = 72;
const GRID_COL_WIDTH = 96;
const MIN_W = 2;
const MIN_H = 2;
const MIN_CANVAS_ROWS = 20;
const CANVAS_GROWTH_PADDING = 8;

const getFieldGroups = (dataset) => {
  const fields = dataset?.fields || [];
  const numericFields = fields.filter((field) => field.type === 'number');
  const dimensionFields = fields.filter((field) => field.type !== 'number');

  return { numericFields, dimensionFields };
};

const isDatasetCompatible = (widgetType, dataset) => {
  if (!dataset) return false;

  const { numericFields, dimensionFields } = getFieldGroups(dataset);

  if (['line', 'bar', 'pie', 'treemap'].includes(widgetType)) {
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

const createWidget = (prev, template, x, y, overrides = {}) => {
  const index = prev.filter((item) => item.type === template.type).length + 1;
  const isTextWidget = template.type === 'label' || template.type === 'date';
  const dataset = datasetLibrary[overrides.dataset || template.dataset];

  return {
    id: crypto.randomUUID(),
    type: template.type,
    title: overrides.titleLabel?.trim() || `${template.title} ${index}`,
    dataset: overrides.dataset || template.dataset || '',
    mapping: overrides.mapping || buildDefaultMapping(template.type, dataset),
    preview: overrides.preview || false,
    fontSize: overrides.fontSize || 28,
    x,
    y,
    w: overrides.w || 4,
    h: overrides.h || (isTextWidget ? 2 : 5)
  };
};

const lineTemplate = widgetCatalog.find((widget) => widget.type === 'line');
const barTemplate = widgetCatalog.find((widget) => widget.type === 'bar');
const tableTemplate = widgetCatalog.find((widget) => widget.type === 'table');

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
  const activeConfigDataset = activeConfigWidget ? datasetLibrary[activeConfigWidget.dataset] : null;

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
            return {
              ...item,
              x: Math.max(0, action.origin.x + snapX),
              y: Math.max(0, action.origin.y + snapY)
            };
          }

          return {
            ...item,
            w: Math.max(MIN_W, action.origin.w + snapX),
            h: Math.max(MIN_H, action.origin.h + snapY)
          };
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
    setHoverGrid({
      x: Math.max(0, Math.floor((event.clientX - rect.left) / cellWidth)),
      y: Math.max(0, Math.floor((event.clientY - rect.top) / GRID_ROW_HEIGHT))
    });
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

  const updateWidgetMapping = (id, patch) => {
    if (readOnly) return;
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              mapping: {
                ...item.mapping,
                ...patch
              }
            }
          : item
      )
    );
  };

  const assignDatasourceToWidget = (widgetId, datasetId) => {
    const dataset = datasetLibrary[datasetId];

    setWidgets((prev) =>
      prev.map((item) => {
        if (item.id !== widgetId) return item;
        if (!isDatasetCompatible(item.type, dataset)) return item;

        return {
          ...item,
          dataset: datasetId,
          mapping: buildDefaultMapping(item.type, dataset)
        };
      })
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

  const renderMappingControls = (widget, dataset) => {
    if (!dataset || !hasDatasetTarget(widget.type)) return null;

    const { numericFields, dimensionFields } = getFieldGroups(dataset);

    if (widget.type === 'line' || widget.type === 'bar') {
      const yFields = widget.mapping?.yFields || [];

      return (
        <div className="mapping-grid">
          <label>
            <span>X-Axis</span>
            <select
              value={widget.mapping?.xField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { xField: event.target.value })}
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

                        updateWidgetMapping(widget.id, {
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
      );
    }

    if (widget.type === 'pie') {
      return (
        <div className="mapping-grid">
          <label>
            <span>Label Field</span>
            <select
              value={widget.mapping?.labelField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { labelField: event.target.value })}
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
              value={widget.mapping?.valueField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { valueField: event.target.value })}
            >
              {numericFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (widget.type === 'treemap') {
      return (
        <div className="mapping-grid">
          <label>
            <span>Group Field</span>
            <select
              value={widget.mapping?.groupField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { groupField: event.target.value })}
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
              value={widget.mapping?.labelField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { labelField: event.target.value })}
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
              value={widget.mapping?.valueField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { valueField: event.target.value })}
            >
              {numericFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (widget.type === 'table') {
      const visibleColumns = widget.mapping?.columns || [];

      return (
        <div className="mapping-grid">
          <div className="mapping-group">
            <span>Visible Columns</span>
            <div className="checkbox-list">
              {dataset.fields.map((field) => {
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

                        updateWidgetMapping(widget.id, {
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
      );
    }

    return null;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Dashboard Builder Prototype</h1>
          <p>Drag widgets to the canvas, then attach one datasource and map fields per widget.</p>
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
                {!datasourceCollapsed ? <p>ลาก datasource ไปใส่ widget ได้ 1 ชุดต่อ widget</p> : null}
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
            const dataset = datasetLibrary[widget.dataset];
            const compatibleDatasets = getCompatibleDatasets(widget.type);
            const isWidgetPreview = readOnly || widget.preview;

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

                  const datasourceId = event.dataTransfer.getData('datasource/id');
                  const droppedDataset = datasetLibrary[datasourceId];
                  if (!droppedDataset || !isDatasetCompatible(widget.type, droppedDataset)) return;

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
                  assignDatasourceToWidget(widget.id, datasourceId);
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
                        {dataset ? <span className="widget-dataset-badge">{dataset.label}</span> : null}
                      </div>
                    ) : (
                      <>
                        <div className="widget-title-block">
                          <small>{widget.type.toUpperCase()}</small>
                          <input
                            type="text"
                            value={widget.title}
                            onChange={(event) => updateWidgetField(widget.id, 'title', event.target.value)}
                          />
                          {hasDatasetTarget(widget.type) ? (
                            <div className="widget-dataset-dropzone">
                              <span>{dataset?.label || 'Drop datasource here'}</span>
                              <small>
                                {dataset
                                  ? `${dataset.records.length} rows / ${dataset.fields.length} fields`
                                  : 'Only one datasource per widget'}
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
                              onChange={(event) =>
                                updateWidgetField(widget.id, 'fontSize', Number(event.target.value) || 10)
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
                    <WidgetRenderer widget={widget} dataset={dataset} />
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
                <p>Configure the widget datasource and field mapping.</p>
              </div>
              <button type="button" className="section-toggle" onClick={() => setActiveConfigWidgetId(null)}>
                Close
              </button>
            </div>

            <div className="config-modal-body">
              <div className="mapping-grid">
                <label>
                  <span>Datasource</span>
                  <select
                    value={activeConfigWidget.dataset}
                    onChange={(event) => assignDatasourceToWidget(activeConfigWidget.id, event.target.value)}
                  >
                    {getCompatibleDatasets(activeConfigWidget.type).map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {renderMappingControls(activeConfigWidget, activeConfigDataset)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
