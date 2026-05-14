import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import WidgetRenderer from './components/WidgetRenderer';
import { datasetLibrary, widgetCatalog } from './data/sampleData';

const MIN_GRID_COLS = 12;
const GRID_ROW_HEIGHT = 72;
const GRID_COL_WIDTH = 96;
const MIN_W = 2;
const MIN_H = 2;
const MIN_CANVAS_ROWS = 20;
const CANVAS_GROWTH_PADDING = 8;
const GRID_SUBDIVISIONS = 8;
const PRINT_PAGE_MARGIN_MM = 12;
const PX_PER_MM = 96 / 25.4;
const MM_PER_PX = 25.4 / 96;
const LOCAL_STORAGE_KEY = 'bi-dashboard.workspace.v1';
const TEXT_WIDGET_TYPES = ['textbox'];
const NO_CONFIG_WIDGET_TYPES = [
  'miceEventsChart',
  'miceRevenueChart',
  'miceVisitorsChart',
  'miceKpis',
  'miceNationalityPerformance',
  'miceNationalityIndustryMatrix',
  'miceVisitorsBreakdown'
];
const CHROMELESS_PREVIEW_TYPES = ['textbox', 'summaryCard', 'kpiCard'];
const MICE_FILTER_DEFAULTS = {
  market: 'International',
  yearMode: 'calendar',
  year: 2025,
  industry: 'all',
  country: 'all'
};
const hasConfigPopup = (type) => !NO_CONFIG_WIDGET_TYPES.includes(type) && (hasDatasetTarget(type) || TEXT_WIDGET_TYPES.includes(type));
const isInteractiveTarget = (target) =>
  Boolean(target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea') || target.closest('.checkbox-item'));
const EXPRESSION_SNIPPETS = [
  '${year(current_date)}',
  '${buddhist_year(current_date)}',
  '${month(current_date)}',
  '${month_name(current_date)}',
  '${day(current_date)}',
  '${format_date(current_date)}',
  '${year(current_date) + 543}'
];

const ToolbarIcon = ({ name }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  switch (name) {
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 5v14" />
          <path {...common} d="M5 12h14" />
        </svg>
      );
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="9" y="9" width="10" height="10" rx="2" />
          <path {...common} d="M7 15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M3 6h18" />
          <path {...common} d="M8 6V4h8v2" />
          <path {...common} d="M6 6l1 14h10l1-14" />
          <path {...common} d="M10 11v6" />
          <path {...common} d="M14 11v6" />
        </svg>
      );
    case 'print':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 9V4h10v5" />
          <rect {...common} x="6" y="13" width="12" height="7" rx="2" />
          <path {...common} d="M7 17h10" />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 3v12" />
          <path {...common} d="M7 10l5 5 5-5" />
          <path {...common} d="M5 20h14" />
        </svg>
      );
    case 'save':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 4h12l2 2v14H5Z" />
          <path {...common} d="M8 4v6h8V4" />
          <path {...common} d="M8 20v-6h8v6" />
        </svg>
      );
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 21V9" />
          <path {...common} d="M7 14l5-5 5 5" />
          <path {...common} d="M5 4h14" />
        </svg>
      );
    case 'sidebar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
          <path {...common} d="M9 4v16" />
        </svg>
      );
    case 'preview':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle {...common} cx="12" cy="12" r="3" />
        </svg>
      );
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 20h4l10-10a2.1 2.1 0 0 0-4-4L4 16v4Z" />
          <path {...common} d="M13.5 6.5l4 4" />
        </svg>
      );
    case 'align-left':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 6h16" />
          <path {...common} d="M4 10h10" />
          <path {...common} d="M4 14h16" />
          <path {...common} d="M4 18h10" />
        </svg>
      );
    case 'align-center':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 6h16" />
          <path {...common} d="M7 10h10" />
          <path {...common} d="M4 14h16" />
          <path {...common} d="M7 18h10" />
        </svg>
      );
    case 'align-right':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 6h16" />
          <path {...common} d="M10 10h10" />
          <path {...common} d="M4 14h16" />
          <path {...common} d="M10 18h10" />
        </svg>
      );
    default:
      return null;
  }
};

const WidgetThumbnail = ({ type }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

  switch (type) {
    case 'miceEventsChart':
    case 'miceRevenueChart':
    case 'miceVisitorsChart':
    case 'chart':
    case 'line':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <path {...common} d="M6 19l4-4 4 2 6-7 2 1" />
          <circle cx="10" cy="15" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="14" cy="17" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="10" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'bar':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <rect x="7" y="14" width="3" height="6" rx="1" fill="currentColor" stroke="none" />
          <rect x="12" y="10" width="3" height="10" rx="1" fill="currentColor" stroke="none" />
          <rect x="17" y="7" width="3" height="13" rx="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'pie':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <path {...common} d="M14 8a6 6 0 1 0 6 6h-6Z" />
          <path {...common} d="M14 8v6h6" />
        </svg>
      );
    case 'miceKpis':
    case 'kpiCard':
    case 'summaryCard':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <rect x="6" y="7" width="6" height="6" rx="1.5" fill="currentColor" stroke="none" />
          <rect x="16" y="7" width="6" height="6" rx="1.5" fill="currentColor" stroke="none" opacity="0.7" />
          <rect x="6" y="15" width="16" height="5" rx="1.5" fill="currentColor" stroke="none" opacity="0.4" />
        </svg>
      );
    case 'miceNationalityPerformance':
    case 'miceNationalityIndustryMatrix':
    case 'table':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <path {...common} d="M6 10h16" />
          <path {...common} d="M6 15h16" />
          <path {...common} d="M11 7v14" />
          <path {...common} d="M18 7v14" />
        </svg>
      );
    case 'miceVisitorsBreakdown':
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <path {...common} d="M6 18c3-8 6-8 9-3s6 5 7 1" />
          <circle cx="9" cy="16" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="15" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="4" width="22" height="20" rx="4" />
          <path {...common} d="M7 10h14M7 15h10M7 20h7" />
        </svg>
      );
  }
};

const PaletteWidgetThumbnail = ({ type }) => {
  if (type === 'miceEventsChart' || type === 'miceRevenueChart' || type === 'miceVisitorsChart' || type === 'chart' || type === 'line' || type === 'bar') {
    return (
      <div className="palette-thumb palette-thumb-chart" aria-hidden="true">
        <span className="palette-thumb-bars">
          <i />
          <i />
          <i />
          <i />
        </span>
        <svg viewBox="0 0 40 24" aria-hidden="true">
          <path d="M2 18L10 15L18 9L26 11L34 5L38 7" />
        </svg>
      </div>
    );
  }

  if (type === 'miceKpis' || type === 'kpiCard' || type === 'summaryCard') {
    return (
      <div className="palette-thumb palette-thumb-kpi" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (type === 'miceNationalityPerformance' || type === 'miceNationalityIndustryMatrix' || type === 'table') {
    return (
      <div className="palette-thumb palette-thumb-table" aria-hidden="true">
        <span className="row" />
        <span className="row" />
        <span className="row" />
        <span className="row" />
      </div>
    );
  }

  if (type === 'miceVisitorsBreakdown') {
    return (
      <div className="palette-thumb palette-thumb-breakdown" aria-hidden="true">
        <span className="root" />
        <span className="branch a" />
        <span className="branch b" />
        <span className="branch c" />
      </div>
    );
  }

  return (
    <div className="palette-thumb palette-thumb-generic" aria-hidden="true">
      <span />
    </div>
  );
};

const getFieldGroups = (dataset) => {
  const fields = dataset?.fields || [];
  const numericFields = fields.filter((field) => field.type === 'number');
  const dimensionFields = fields.filter((field) => field.type !== 'number');

  return { numericFields, dimensionFields };
};

const buildDefaultMapping = (widgetType, dataset) => {
  if (!dataset) return {};

  if (NO_CONFIG_WIDGET_TYPES.includes(widgetType)) {
    return {};
  }

  const { numericFields, dimensionFields } = getFieldGroups(dataset);
  const primaryDimension = dimensionFields[0]?.key || '';
  const secondaryDimension = dimensionFields[1]?.key || '';
  const yFields = numericFields.slice(0, 2).map((field) => field.key);
  const metricFields = numericFields.filter((field) => !['year', 'quarter'].includes(field.key));
  const firstMetric = metricFields[0]?.key || numericFields[0]?.key || '';
  const secondMetric = metricFields[1]?.key || numericFields[1]?.key || '';
  const isMiceDataset = dataset.id === 'miceStatistics';
  const isAverageMetric = ['avgStayDays', 'avgSpendPerTrip', 'avgSpendPerDay'].includes(firstMetric);

  if (widgetType === 'chart') {
    return {
      chartKind: 'line',
      xField: isMiceDataset ? 'quarterLabel' : primaryDimension,
      yFields: isMiceDataset ? [firstMetric || 'miceEvents'] : yFields.length ? yFields : [firstMetric],
      aggregation: isAverageMetric ? 'avg' : 'sum'
    };
  }

  if (widgetType === 'line' || widgetType === 'bar') {
    return {
      xField: isMiceDataset ? 'quarterLabel' : primaryDimension,
      yFields: isMiceDataset ? [firstMetric || 'miceEvents'] : yFields.length ? yFields : [firstMetric],
      aggregation: isAverageMetric ? 'avg' : 'sum'
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

  if (widgetType === 'summaryCard') {
    return {
      metricField: firstMetric,
      aggregation: 'sum',
      comparisonField: secondMetric,
      helperText: 'Increased from last month',
      colorTheme: 'auto'
    };
  }

  if (widgetType === 'kpiCard') {
    return {
      displayMode: 'metric',
      metricField: firstMetric,
      aggregation: isAverageMetric ? 'avg' : 'sum',
      helperText: metricFields[0]?.label || numericFields[0]?.label || 'Total',
      colorTheme: 'auto',
      groupField: isMiceDataset ? 'country' : primaryDimension,
      valueField: firstMetric
    };
  }

  if (widgetType === 'rankingList') {
    return {
      labelField: primaryDimension,
      valueField: numericFields[0]?.key || '',
      sortDirection: 'desc',
      limit: 5
    };
  }

  if (widgetType === 'table') {
    return {
      columns: dataset.fields.slice(0, 4).map((field) => field.key)
    };
  }

  return {};
};

const widgetTemplateMap = Object.fromEntries(widgetCatalog.map((widget) => [widget.type, widget]));

const getFixedDatasetId = (widgetType) => widgetTemplateMap[widgetType]?.dataset || '';

const normalizeWidget = (widget) => {
  const template = widgetTemplateMap[widget.type];
  const fixedDatasetId = template?.dataset || '';
  const shouldDisablePreview = NO_CONFIG_WIDGET_TYPES.includes(widget.type);

  if (TEXT_WIDGET_TYPES.includes(widget.type) || !template) {
    return {
      ...widget,
      dataset: widget.dataset || '',
      mapping: widget.mapping ? { ...widget.mapping } : {},
      textStyle: widget.textStyle ? { ...widget.textStyle } : {},
      preview: shouldDisablePreview ? false : Boolean(widget.preview)
    };
  }

  const fixedDataset = datasetLibrary[fixedDatasetId];
  const shouldResetMapping = widget.dataset !== fixedDatasetId || !widget.mapping;
  const defaultMapping = buildDefaultMapping(widget.type, fixedDataset);

  return {
    ...widget,
    dataset: fixedDatasetId,
    mapping: shouldResetMapping ? defaultMapping : { ...defaultMapping, ...widget.mapping },
    textStyle: widget.textStyle ? { ...widget.textStyle } : {},
    preview: shouldDisablePreview ? false : Boolean(widget.preview),
    autoHeight: TEXT_WIDGET_TYPES.includes(widget.type) ? widget.autoHeight !== false : widget.autoHeight,
    heightPx: TEXT_WIDGET_TYPES.includes(widget.type) ? widget.heightPx ?? null : widget.heightPx
  };
};

const createWidget = (prev, template, x, y, overrides = {}) => {
  const index = prev.filter((item) => item.type === template.type).length + 1;
  const isTextWidget = TEXT_WIDGET_TYPES.includes(template.type);
  const isSummaryWidget = template.type === 'summaryCard';
  const isKpiWidget = template.type === 'kpiCard';
  const isChartWidget = template.type === 'chart' || template.type === 'line' || template.type === 'bar';
  const datasetId = isTextWidget ? '' : template.dataset || '';
  const dataset = datasetLibrary[datasetId];
  const shouldDisablePreview = NO_CONFIG_WIDGET_TYPES.includes(template.type);
  const title = overrides.titleLabel?.trim() || `${template.title} ${index}`;
  const defaultMapping = overrides.mapping || buildDefaultMapping(template.type, dataset);

  return {
    id: crypto.randomUUID(),
    type: template.type,
    title,
    dataset: datasetId,
    mapping: defaultMapping,
    preview: shouldDisablePreview ? false : overrides.preview || false,
    fontSize: overrides.fontSize || 28,
    expression: overrides.expression || (isTextWidget ? title : ''),
    textStyle: overrides.textStyle || {
      fontWeight: 600,
      fontStyle: 'normal',
      textDecoration: 'none'
    },
    textAlign: overrides.textAlign || 'center',
    x,
    y,
    w: overrides.w || template.defaultW || (isKpiWidget ? 3 : isSummaryWidget ? 3 : isChartWidget ? 6 : 4),
    h: overrides.h || template.defaultH || (isTextWidget || isSummaryWidget || isKpiWidget ? 2 : isChartWidget ? 5 : 5),
    autoHeight: isTextWidget ? overrides.autoHeight !== false : undefined,
    heightPx: isTextWidget ? overrides.heightPx || null : undefined
  };
};

const cloneWidget = (widget) => ({
  ...normalizeWidget(widget)
});

const cloneWidgets = (widgets) => widgets.map((widget) => cloneWidget(widget));

const createDashboard = (name, widgets = [], options = {}) => ({
  id: crypto.randomUUID(),
  name,
  widgets: cloneWidgets(widgets),
  filters: options.filters ? { ...options.filters } : undefined
});

const cloneDashboard = (dashboard) => ({
  ...dashboard,
  widgets: cloneWidgets(dashboard.widgets || []),
  filters: dashboard.filters ? { ...dashboard.filters } : undefined
});

const cloneWorkspace = (workspace) => ({
  activeDashboardId: workspace.activeDashboardId,
  dashboards: Array.isArray(workspace.dashboards) ? workspace.dashboards.map((dashboard) => cloneDashboard(dashboard)) : []
});

const createSafeFileName = (value, fallback = 'dashboard') =>
  (value || fallback).trim().replace(/[^\w\-]+/g, '_') || fallback;

const normalizeImportedDashboard = (value) => {
  const dashboardValue = value?.dashboard || value;

  if (Array.isArray(dashboardValue)) {
    return createDashboard('Imported Dashboard', dashboardValue);
  }

  if (!dashboardValue || !Array.isArray(dashboardValue.widgets)) {
    throw new Error('The selected file does not contain a dashboard.');
  }

  return {
    id: crypto.randomUUID(),
    name:
      typeof dashboardValue.name === 'string' && dashboardValue.name.trim()
        ? dashboardValue.name.trim()
        : 'Imported Dashboard',
    widgets: cloneWidgets(dashboardValue.widgets),
    filters: dashboardValue.filters ? { ...dashboardValue.filters } : undefined
  };
};

const miceEventsChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceEventsChart');
const miceRevenueChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceRevenueChart');
const miceVisitorsChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceVisitorsChart');
const miceKpisTemplate = widgetCatalog.find((widget) => widget.type === 'miceKpis');
const miceNationalityPerformanceTemplate = widgetCatalog.find((widget) => widget.type === 'miceNationalityPerformance');
const miceNationalityIndustryMatrixTemplate = widgetCatalog.find((widget) => widget.type === 'miceNationalityIndustryMatrix');
const miceVisitorsBreakdownTemplate = widgetCatalog.find((widget) => widget.type === 'miceVisitorsBreakdown');

const initialWidgets = [
  createWidget([], miceEventsChartTemplate, 0, 0),
  createWidget([{ type: 'miceEventsChart' }], miceRevenueChartTemplate, 0, 7),
  createWidget([{ type: 'miceRevenueChart' }], miceVisitorsChartTemplate, 0, 14),
  createWidget([{ type: 'miceVisitorsChart' }], miceKpisTemplate, 0, 21),
  createWidget([{ type: 'miceKpis' }], miceNationalityPerformanceTemplate, 0, 24),
  createWidget([{ type: 'miceNationalityPerformance' }], miceNationalityIndustryMatrixTemplate, 0, 33),
  createWidget([{ type: 'miceNationalityIndustryMatrix' }], miceVisitorsBreakdownTemplate, 0, 41)
];

const createDefaultWorkspace = () => {
  const dashboard = createDashboard('MICE Statistics', initialWidgets, {
    filters: { ...MICE_FILTER_DEFAULTS }
  });

  return {
    dashboards: [dashboard],
    activeDashboardId: dashboard.id
  };
};

const normalizeWorkspace = (value) => {
  if (Array.isArray(value)) {
    const dashboard = createDashboard('Dashboard 1', value);
    return {
      dashboards: [dashboard],
      activeDashboardId: dashboard.id
    };
  }

  const dashboards = Array.isArray(value?.dashboards)
    ? value.dashboards
        .filter(Boolean)
        .map((dashboard, index) => ({
          id: typeof dashboard.id === 'string' && dashboard.id ? dashboard.id : crypto.randomUUID(),
          name:
            typeof dashboard.name === 'string' && dashboard.name.trim()
              ? dashboard.name.trim()
              : `Dashboard ${index + 1}`,
          widgets: Array.isArray(dashboard.widgets) ? cloneWidgets(dashboard.widgets) : [],
          filters: dashboard.filters ? { ...dashboard.filters } : undefined
        }))
    : [];

  if (!dashboards.length) return createDefaultWorkspace();

  const activeDashboardId =
    typeof value?.activeDashboardId === 'string' &&
    dashboards.some((dashboard) => dashboard.id === value.activeDashboardId)
      ? value.activeDashboardId
      : dashboards[0].id;

  return { dashboards, activeDashboardId };
};

const loadWorkspaceFromStorage = () => {
  if (typeof window === 'undefined') return createDefaultWorkspace();

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return createDefaultWorkspace();

    return normalizeWorkspace(JSON.parse(stored));
  } catch {
    return createDefaultWorkspace();
  }
};

const hasDatasetTarget = (type) => !TEXT_WIDGET_TYPES.includes(type);
const MAX_HISTORY_ENTRIES = 50;

const MICE_DATASET = datasetLibrary.miceStatistics;
const MICE_FILTER_OPTIONS = {
  years: Array.from(new Set((MICE_DATASET?.records || []).map((record) => record.year))).sort((a, b) => a - b),
  industries: Array.from(new Set((MICE_DATASET?.records || []).map((record) => record.industry))).sort(),
  countries: Array.from(new Set((MICE_DATASET?.records || []).map((record) => record.country))).sort()
};

const applyMiceFilters = (records, filters = {}, options = {}) => {
  const market = options.forceInternationalOnly ? 'International' : filters.market;
  const yearMode = filters.yearMode;
  const year = Number(filters.year);
  const industry = filters.industry;
  const country = filters.country;

  return (records || []).filter((record) => {
    if (market && market !== 'all' && record.market !== market) return false;
    if (yearMode && yearMode !== 'all' && record.yearMode !== yearMode) return false;
    if (!Number.isNaN(year) && year && Number(record.year) !== year) return false;
    if (industry && industry !== 'all' && record.industry !== industry) return false;
    if (country && country !== 'all' && record.country !== country) return false;

    return true;
  });
};

const getA4LandscapeFitScale = (contentWidthPx, contentHeightPx) => {
  const pageWidthPx = (297 - PRINT_PAGE_MARGIN_MM * 2) * PX_PER_MM;
  const pageHeightPx = (210 - PRINT_PAGE_MARGIN_MM * 2) * PX_PER_MM;

  if (!contentWidthPx || !contentHeightPx) {
    return {
      scale: 1,
      pageWidthPx,
      pageHeightPx
    };
  }

  return {
    scale: Math.min(1, pageWidthPx / contentWidthPx, pageHeightPx / contentHeightPx),
    pageWidthPx,
    pageHeightPx
  };
};

export default function App() {
  const [workspace, setWorkspace] = useState(loadWorkspaceFromStorage);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [action, setAction] = useState(null);
  const [hoverGrid, setHoverGrid] = useState(null);
  const [readOnly, setReadOnly] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [activeConfigWidgetId, setActiveConfigWidgetId] = useState(null);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [printScale, setPrintScale] = useState(1);
  const canvasRef = useRef(null);
  const importFileInputRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const gestureSnapshotRef = useRef(null);
  const gestureChangedRef = useRef(false);

  const dashboards = workspace.dashboards;
  const activeDashboardId = workspace.activeDashboardId;
  const activeDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboardId) || dashboards[0];
  const widgets = activeDashboard?.widgets || [];
  const effectiveSidebarHidden = readOnly || sidebarHidden;
  const cellWidth = GRID_COL_WIDTH;
  const maxOccupiedCol = useMemo(() => {
    if (!widgets.length) return MIN_GRID_COLS;
    return Math.max(...widgets.map((widget) => widget.x + widget.w), MIN_GRID_COLS);
  }, [widgets]);
  const minOccupiedCol = useMemo(() => {
    if (!widgets.length) return 0;
    return Math.min(...widgets.map((widget) => widget.x));
  }, [widgets]);
  const maxOccupiedRow = useMemo(() => {
    if (!widgets.length) return MIN_CANVAS_ROWS;
    return Math.max(...widgets.map((widget) => widget.y + widget.h), MIN_CANVAS_ROWS);
  }, [widgets]);
  const canvasCols = maxOccupiedCol + CANVAS_GROWTH_PADDING;
  const canvasRows = readOnly ? maxOccupiedRow : maxOccupiedRow + CANVAS_GROWTH_PADDING;
  const canvasContentWidth = canvasCols * cellWidth;
  const canvasHeight = canvasRows * GRID_ROW_HEIGHT;
  const occupiedContentWidth = readOnly
    ? Math.max(cellWidth, (maxOccupiedCol - minOccupiedCol) * cellWidth)
    : Math.max(MIN_GRID_COLS * cellWidth, (maxOccupiedCol - minOccupiedCol) * cellWidth);
  const canvasShiftX = readOnly
    ? -minOccupiedCol * cellWidth
    : sidebarHidden
      ? Math.max(0, Math.floor((canvasWidth - occupiedContentWidth) / 2) - minOccupiedCol * cellWidth)
      : 0;
  const activeConfigWidget = widgets.find((widget) => widget.id === activeConfigWidgetId) || null;
  const activeConfigDataset = activeConfigWidget ? datasetLibrary[activeConfigWidget.dataset] : null;
  const selectedWidgets = widgets.filter((widget) => selectedWidgetIds.includes(widget.id));
  const activeDashboardFilters = activeDashboard?.filters || null;
  const shouldRenderDashboardFilters = Boolean(activeDashboardFilters);
  const dashboardFiltersHeight = shouldRenderDashboardFilters ? 168 : 0;
  const dashboardCards = dashboards.map((dashboard) => {
    const dashboardWidgetCount = dashboard.widgets?.length || 0;
    const previewWidgets = (dashboard.widgets || []).slice(0, 3).map((widget) => widget.title || widget.type);
    return {
      ...dashboard,
      widgetCount: dashboardWidgetCount,
      previewWidgets
    };
  });

  const getWidgetRect = (widget) => ({
    x: widget.x * cellWidth + canvasShiftX,
    y: widget.y * GRID_ROW_HEIGHT,
    width: widget.w * cellWidth,
    height: widget.h * GRID_ROW_HEIGHT
  });

  const normalizeRect = (rect) => {
    const x = Math.min(rect.x1, rect.x2);
    const y = Math.min(rect.y1, rect.y2);
    const width = Math.abs(rect.x2 - rect.x1);
    const height = Math.abs(rect.y2 - rect.y1);

    return { x, y, width, height };
  };

  const clearTransientSelectionState = () => {
    setActiveConfigWidgetId(null);
    setSelectedWidgetIds([]);
    setSelectionBox(null);
    setHoverGrid(null);
    setAction(null);
    selectionBoxRef.current = null;
    gestureSnapshotRef.current = null;
    gestureChangedRef.current = false;
  };

  const pushHistorySnapshot = (snapshot) => {
    if (!snapshot) return;

    setUndoStack((prev) => [...prev, cloneWorkspace(snapshot)].slice(-MAX_HISTORY_ENTRIES));
    setRedoStack([]);
  };

  const updateWorkspace = (updater, { recordHistory = true } = {}) => {
    setWorkspace((prev) => {
      const nextWorkspace = typeof updater === 'function' ? updater(prev) : updater;

      if (recordHistory && JSON.stringify(prev) !== JSON.stringify(nextWorkspace)) {
        setUndoStack((prevHistory) => [...prevHistory, cloneWorkspace(prev)].slice(-MAX_HISTORY_ENTRIES));
        setRedoStack([]);
      }

      return nextWorkspace;
    });
  };

  const undoWorkspace = () => {
    if (!undoStack.length) return;

    const snapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = cloneWorkspace(workspace);

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, currentSnapshot].slice(-MAX_HISTORY_ENTRIES));
    setWorkspace(cloneWorkspace(snapshot));
    clearTransientSelectionState();
  };

  const redoWorkspace = () => {
    if (!redoStack.length) return;

    const snapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = cloneWorkspace(workspace);

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, currentSnapshot].slice(-MAX_HISTORY_ENTRIES));
    setWorkspace(cloneWorkspace(snapshot));
    clearTransientSelectionState();
  };

  const rectsIntersect = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const getCanvasLocalPoint = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: Math.max(0, event.clientX - rect.left - canvasShiftX),
      y: Math.max(0, event.clientY - rect.top)
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          dashboards,
          activeDashboardId
        })
      );
    } catch {
      // Ignore quota or storage failures.
    }
  }, [dashboards, activeDashboardId]);

  const printActiveDashboard = async () => {
    if (!activeDashboard) return;

    const shouldRestoreReadOnly = !readOnly;

    if (shouldRestoreReadOnly) {
      setReadOnly(true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    const canvasNode = canvasRef.current;
    const canvasBounds = canvasNode?.getBoundingClientRect();
    const fitMetrics = canvasBounds
      ? getA4LandscapeFitScale(canvasBounds.width, canvasBounds.height)
      : { scale: 1 };

    setPrintScale(fitMetrics.scale);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const restoreReadOnly = () => {
      setPrintScale(1);
      if (shouldRestoreReadOnly) {
        setReadOnly(false);
      }
      window.removeEventListener('afterprint', restoreReadOnly);
    };

    window.addEventListener('afterprint', restoreReadOnly);

    try {
      window.print();
    } catch {
      restoreReadOnly();
    }
  };

  const downloadActiveDashboardPdf = async () => {
    if (!canvasRef.current || !activeDashboard) return;

    const shouldRestoreReadOnly = !readOnly;

    if (shouldRestoreReadOnly) {
      setReadOnly(true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    try {
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true
      });

      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pageWidth - PRINT_PAGE_MARGIN_MM * 2;
      const usableHeight = pageHeight - PRINT_PAGE_MARGIN_MM * 2;
      const imageWidthMm = canvas.width * MM_PER_PX;
      const imageHeightMm = canvas.height * MM_PER_PX;
      const fitScale = Math.min(1, usableWidth / imageWidthMm, usableHeight / imageHeightMm);
      const finalWidth = imageWidthMm * fitScale;
      const finalHeight = imageHeightMm * fitScale;
      const offsetX = (pageWidth - finalWidth) / 2;
      const offsetY = (pageHeight - finalHeight) / 2;

      pdf.addImage(imageData, 'PNG', offsetX, offsetY, finalWidth, finalHeight);
      const fileName = `${(activeDashboard.name || 'dashboard').trim().replace(/[^\w\-]+/g, '_') || 'dashboard'}.pdf`;
      pdf.save(fileName);
    } finally {
      if (shouldRestoreReadOnly) {
        setReadOnly(false);
      }
    }
  };

  const saveActiveDashboardFile = () => {
    if (!activeDashboard) return;

    const exportPayload = {
      type: 'bi-dashboard.dashboard',
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: cloneDashboard(activeDashboard)
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${createSafeFileName(activeDashboard.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openDashboardImportPicker = () => {
    importFileInputRef.current?.click();
  };

  const importDashboardFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      const importedDashboard = normalizeImportedDashboard(JSON.parse(await file.text()));

      updateWorkspace((prev) => ({
        dashboards: [...prev.dashboards, importedDashboard],
        activeDashboardId: importedDashboard.id
      }));
      clearTransientSelectionState();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to import dashboard file.');
    }
  };

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
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed || event.altKey) return;

      const target = event.target;
      const isTypingSurface =
        target instanceof HTMLElement &&
        Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

      if (isTypingSurface) return;

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoWorkspace();
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoWorkspace();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redoStack, undoStack, workspace]);

  const setWidgets = (updater, options = {}) => {
    updateWorkspace(
      (prev) => {
        const currentDashboardId = prev.activeDashboardId;

        return {
          ...prev,
          dashboards: prev.dashboards.map((dashboard) => {
            if (dashboard.id !== currentDashboardId) return dashboard;

            const nextWidgets = typeof updater === 'function' ? updater(dashboard.widgets) : updater;

            return {
              ...dashboard,
              widgets: nextWidgets
            };
          })
        };
      },
      options
    );
  };

  const updateActiveDashboard = (updater, options = {}) => {
    updateWorkspace(
      (prev) => {
        const currentDashboardId = prev.activeDashboardId;

        return {
          ...prev,
          dashboards: prev.dashboards.map((dashboard) => {
            if (dashboard.id !== currentDashboardId) return dashboard;

            return typeof updater === 'function' ? updater(dashboard) : { ...dashboard, ...updater };
          })
        };
      },
      options
    );
  };

  const updateActiveDashboardFilters = (patch) => {
    if (!activeDashboardFilters) return;

    updateActiveDashboard((dashboard) => ({
      ...dashboard,
      filters: {
        ...MICE_FILTER_DEFAULTS,
        ...(dashboard.filters || {}),
        ...patch
      }
    }));
  };

  const clearActiveDashboardFilters = () => {
    if (!activeDashboardFilters) return;

    updateActiveDashboard((dashboard) => ({
      ...dashboard,
      filters: { ...MICE_FILTER_DEFAULTS }
    }));
  };

  const getWidgetRecords = (widget, dataset) => {
    if (!dataset?.records?.length) return [];
    if (dataset.id !== 'miceStatistics') return dataset.records;

    const filteredRecords = applyMiceFilters(dataset.records, activeDashboardFilters || MICE_FILTER_DEFAULTS, {
      forceInternationalOnly: Boolean(widget.mapping?.forceInternationalOnly)
    });

    return filteredRecords;
  };

  useLayoutEffect(() => {
    if (!canvasRef.current) return undefined;

    const textboxUpdates = {};

    widgets.forEach((widget) => {
      if (widget.type !== 'textbox' || widget.autoHeight === false) return;

      const card = canvasRef.current.querySelector(`.widget-card[data-widget-id="${widget.id}"]`);
      if (!(card instanceof HTMLElement)) return;

      const label = card.querySelector('.label-widget.textbox-widget');
      if (!(label instanceof HTMLElement)) return;

      const visual = card.querySelector('.widget-visual');
      const content = card.querySelector('.widget-content');
      const visualPadding =
        visual instanceof HTMLElement
          ? 0
          : 0;
      const contentPadding = content instanceof HTMLElement ? 14 : 14;
      const desiredHeight = Math.max(56, Math.ceil(label.scrollHeight + contentPadding + visualPadding));

      if (!widget.heightPx || Math.abs(widget.heightPx - desiredHeight) > 1) {
        textboxUpdates[widget.id] = {
          heightPx: desiredHeight,
          h: Math.max(MIN_H, Math.ceil(desiredHeight / GRID_ROW_HEIGHT))
        };
      }
    });

    const updateIds = Object.keys(textboxUpdates);
    if (!updateIds.length) return undefined;

    setWidgets(
      (prev) =>
        prev.map((widget) =>
          textboxUpdates[widget.id]
            ? {
                ...widget,
                ...textboxUpdates[widget.id]
              }
            : widget
        ),
      { recordHistory: false }
    );

    return undefined;
  }, [widgets, canvasWidth, canvasShiftX, readOnly]);

  useEffect(() => {
    if (!action || readOnly) return undefined;

    const onMove = (event) => {
      const deltaX = event.clientX - action.startX;
      const deltaY = event.clientY - action.startY;
      const snapX = Math.round(deltaX / (cellWidth / GRID_SUBDIVISIONS)) / GRID_SUBDIVISIONS;
      const snapY = Math.round(deltaY / (GRID_ROW_HEIGHT / GRID_SUBDIVISIONS)) / GRID_SUBDIVISIONS;

      if (action.kind === 'marquee') {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const nextBox = normalizeRect({
          x1: action.startX - rect.left - canvasShiftX,
          y1: action.startY - rect.top,
          x2: event.clientX - rect.left - canvasShiftX,
          y2: event.clientY - rect.top
        });
        selectionBoxRef.current = nextBox;
        setSelectionBox(nextBox);
        return;
      }

      setWidgets(
        (prev) =>
          prev.map((item) => {
            if (action.kind === 'move-selection') {
              const origin = action.originMap[item.id];
              if (!origin) return item;

              return {
                ...item,
                x: Math.max(0, origin.x + snapX),
                y: Math.max(0, origin.y + snapY)
              };
            }

            if (item.id !== action.id) return item;

            if (action.kind === 'move') {
              return {
                ...item,
                x: Math.max(0, action.origin.x + snapX),
                y: Math.max(0, action.origin.y + snapY)
              };
            }

            if (item.type === 'textbox') {
              const baseHeightPx = action.origin.heightPx || action.origin.h * GRID_ROW_HEIGHT;
              const nextHeightPx = Math.max(56, baseHeightPx + deltaY);

              return {
                ...item,
                autoHeight: false,
                w: Math.max(MIN_W, action.origin.w + snapX),
                heightPx: nextHeightPx,
                h: Math.max(MIN_H, Math.ceil(nextHeightPx / GRID_ROW_HEIGHT))
              };
            }

            return {
              ...item,
              w: Math.max(MIN_W, action.origin.w + snapX),
              h: Math.max(MIN_H, action.origin.h + snapY)
            };
          }),
        { recordHistory: false }
      );

      if (
        (action.kind === 'move' || action.kind === 'move-selection' || action.kind === 'resize') &&
        (snapX !== 0 || snapY !== 0)
      ) {
        gestureChangedRef.current = true;
      }
    };

    const onUp = () => {
      if (action.kind === 'marquee' && canvasRef.current && selectionBoxRef.current) {
        const nextSelection = widgets
          .filter((widget) => rectsIntersect(getWidgetRect(widget), selectionBoxRef.current))
          .map((widget) => widget.id);

        setSelectedWidgetIds(nextSelection);
      }

      if (action.kind === 'marquee' && !selectionBoxRef.current) {
        setSelectedWidgetIds([]);
      }

      if (
        gestureChangedRef.current &&
        gestureSnapshotRef.current &&
        (action.kind === 'move' || action.kind === 'move-selection' || action.kind === 'resize')
      ) {
        pushHistorySnapshot(gestureSnapshotRef.current);
      }

      setAction(null);
      setSelectionBox(null);
      selectionBoxRef.current = null;
      gestureSnapshotRef.current = null;
      gestureChangedRef.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [action, cellWidth, readOnly, widgets]);

  const onPaletteDragStart = (event, type) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('widget/type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onCanvasDragOver = (event) => {
    if (readOnly) return;
    if (!Array.from(event.dataTransfer.types).includes('widget/type')) return;

    event.preventDefault();

    const point = getCanvasLocalPoint(event);
    if (!point) return;
    setHoverGrid({
      x: Math.max(0, Math.floor(point.x / cellWidth)),
      y: Math.max(0, Math.floor(point.y / GRID_ROW_HEIGHT))
    });
  };

  const onCanvasDrop = (event) => {
    if (readOnly) return;
    event.preventDefault();

    const type = event.dataTransfer.getData('widget/type');
    const template = widgetCatalog.find((item) => item.type === type);
    if (!template || !canvasRef.current) return;

    const point = getCanvasLocalPoint(event);
    if (!point) return;
    const droppedX = Math.max(0, Math.floor(point.x / cellWidth));
    const droppedY = Math.max(0, Math.floor(point.y / GRID_ROW_HEIGHT));

    setWidgets((prev) => [...prev, createWidget(prev, template, droppedX, droppedY)]);
    setHoverGrid(null);
  };

  const updateWidgetField = (id, field, value) => {
    if (readOnly) return;
    setWidgets((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const insertWidgetExpressionSnippet = (id, snippet, start = null, end = null) => {
    if (readOnly || !snippet) return;

    setWidgets((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const expression = item.expression || '';
        const insertStart = Number.isInteger(start) ? start : expression.length;
        const insertEnd = Number.isInteger(end) ? end : insertStart;

        return {
          ...item,
          expression: `${expression.slice(0, insertStart)}${snippet}${expression.slice(insertEnd)}`
        };
      })
    );
  };

  const updateWidgetTextStyle = (id, patch) => {
    if (readOnly) return;
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              textStyle: {
                fontWeight: 600,
                fontStyle: 'normal',
                textDecoration: 'none',
                ...item.textStyle,
                ...patch
              }
            }
          : item
      )
    );
  };

  const updateWidgetTextAlign = (id, textAlign) => {
    if (readOnly) return;
    setWidgets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, textAlign } : item))
    );
  };

  const renderTextWidgetControls = (widget) => (
    <div className="mapping-grid text-widget-config">
      <label>
        <span>Widget Title</span>
        <input
          type="text"
          value={widget.title}
          onChange={(event) => updateWidgetField(widget.id, 'title', event.target.value)}
        />
      </label>

      <div className="text-format-toolbar" aria-label="Text formatting">
        <label className="font-size-control" title="Font size">
          <span>Size</span>
          <input
            type="number"
            min="10"
            max="96"
            value={widget.fontSize || 28}
            onChange={(event) => updateWidgetField(widget.id, 'fontSize', Number(event.target.value) || 10)}
          />
        </label>
        <button
          type="button"
          className={widget.textStyle?.fontWeight === 700 ? 'active' : ''}
          aria-label="Bold text"
          title="Bold"
          onClick={() =>
            updateWidgetTextStyle(widget.id, {
              fontWeight: widget.textStyle?.fontWeight === 700 ? 600 : 700
            })
          }
        >
          B
        </button>
        <button
          type="button"
          className={widget.textStyle?.fontWeight === 300 ? 'active' : ''}
          aria-label="Thin text"
          title="Thin"
          onClick={() =>
            updateWidgetTextStyle(widget.id, {
              fontWeight: widget.textStyle?.fontWeight === 300 ? 600 : 300
            })
          }
        >
          T
        </button>
        <button
          type="button"
          className={widget.textStyle?.fontStyle === 'italic' ? 'active' : ''}
          aria-label="Italic text"
          title="Italic"
          onClick={() =>
            updateWidgetTextStyle(widget.id, {
              fontStyle: widget.textStyle?.fontStyle === 'italic' ? 'normal' : 'italic'
            })
          }
        >
          I
        </button>
        <button
          type="button"
          className={widget.textStyle?.textDecoration === 'underline' ? 'active' : ''}
          aria-label="Underline text"
          title="Underline"
          onClick={() =>
            updateWidgetTextStyle(widget.id, {
              textDecoration: widget.textStyle?.textDecoration === 'underline' ? 'none' : 'underline'
            })
          }
          >
            U
          </button>
        <div className="text-align-group" aria-label="Text alignment">
          <button
            type="button"
            className={widget.textAlign === 'left' ? 'active' : ''}
            aria-label="Align text left"
            title="Align left"
            onClick={() => updateWidgetTextAlign(widget.id, 'left')}
          >
            <ToolbarIcon name="align-left" />
          </button>
          <button
            type="button"
            className={widget.textAlign === 'center' ? 'active' : ''}
            aria-label="Align text center"
            title="Align center"
            onClick={() => updateWidgetTextAlign(widget.id, 'center')}
          >
            <ToolbarIcon name="align-center" />
          </button>
          <button
            type="button"
            className={widget.textAlign === 'right' ? 'active' : ''}
            aria-label="Align text right"
            title="Align right"
            onClick={() => updateWidgetTextAlign(widget.id, 'right')}
          >
            <ToolbarIcon name="align-right" />
          </button>
        </div>
      </div>

      <label>
        <span>Text Expression</span>
        <textarea
          rows="2"
          value={widget.expression || ''}
          onChange={(event) => updateWidgetField(widget.id, 'expression', event.target.value)}
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.types).includes('text/expression-snippet')) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            const snippet = event.dataTransfer.getData('text/expression-snippet');
            if (!snippet) return;

            event.preventDefault();
            insertWidgetExpressionSnippet(widget.id, snippet, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
          }}
        />
      </label>

      <div className="expression-hints">
        <span>Functions:</span>
        {EXPRESSION_SNIPPETS.map((snippet) => (
          <button
            key={snippet}
            type="button"
            className="expression-chip"
            draggable
            title="Drag into the editor"
            onClick={() => insertWidgetExpressionSnippet(widget.id, snippet)}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/expression-snippet', snippet);
              event.dataTransfer.setData('text/plain', snippet);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <code>{snippet}</code>
          </button>
        ))}
      </div>
    </div>
  );

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

  const toggleWidgetPreview = (id) => {
    if (readOnly) return;
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === id && !NO_CONFIG_WIDGET_TYPES.includes(item.type)
          ? { ...item, preview: !item.preview }
          : item
      )
    );
  };

  const removeWidget = (id) => {
    if (readOnly) return;
    setWidgets((prev) => prev.filter((item) => item.id !== id));
    setSelectedWidgetIds((prev) => prev.filter((itemId) => itemId !== id));
    if (activeConfigWidgetId === id) {
      setActiveConfigWidgetId(null);
    }
  };

  const selectDashboard = (dashboardId) => {
    updateWorkspace((prev) => ({
      ...prev,
      activeDashboardId: dashboardId
    }));
    clearTransientSelectionState();
  };

  const openDashboardDetail = (dashboardId) => {
    selectDashboard(dashboardId);
    setReadOnly(false);
    setViewMode('detail');
  };

  const openDashboardList = () => {
    clearTransientSelectionState();
    setViewMode('list');
  };

  const renameActiveDashboard = (name) => {
    const nextName = name.trim();
    if (!nextName) return;

    updateActiveDashboard((dashboard) => ({
      ...dashboard,
      name: nextName
    }));
  };

  const createNewDashboard = () => {
    if (readOnly) return;

    const newDashboard = createDashboard(`Dashboard ${dashboards.length + 1}`, []);
    updateWorkspace((prev) => ({
      dashboards: [...prev.dashboards, newDashboard],
      activeDashboardId: newDashboard.id
    }));
    clearTransientSelectionState();
    setViewMode('detail');
    setReadOnly(false);
  };

  const duplicateActiveDashboard = () => {
    if (readOnly || !activeDashboard) return;

    const duplicatedDashboard = createDashboard(`${activeDashboard.name} Copy`, activeDashboard.widgets, {
      filters: activeDashboard.filters
    });
    updateWorkspace((prev) => ({
      dashboards: [...prev.dashboards, duplicatedDashboard],
      activeDashboardId: duplicatedDashboard.id
    }));
    clearTransientSelectionState();
    setViewMode('detail');
  };

  const deleteActiveDashboard = () => {
    if (readOnly || dashboards.length <= 1 || !activeDashboard) return;

    updateWorkspace((prev) => {
      const remainingDashboards = prev.dashboards.filter((dashboard) => dashboard.id !== prev.activeDashboardId);
      return {
        dashboards: remainingDashboards,
        activeDashboardId: remainingDashboards[0].id
      };
    });
    clearTransientSelectionState();
    setViewMode('detail');
  };

  const renderMappingControls = (widget, dataset) => {
    if (!dataset || !hasDatasetTarget(widget.type)) return null;

    const { numericFields, dimensionFields } = getFieldGroups(dataset);

    if (widget.type === 'line' || widget.type === 'bar' || widget.type === 'chart') {
      const yFields = widget.mapping?.yFields || [];
      const selectedSeriesCount = yFields.length;

      return (
        <div className="mapping-grid">
          {widget.type === 'chart' ? (
            <label>
              <span>Chart Type</span>
              <select
                value={widget.mapping?.chartKind || 'line'}
                onChange={(event) => updateWidgetMapping(widget.id, { chartKind: event.target.value })}
              >
                <option value="line">Line</option>
                <option value="bar">Bar</option>
                <option value="area">Area</option>
                <option value="stackedBar">Stacked Bar</option>
              </select>
            </label>
          ) : null}

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
            <div className="mapping-group-header">
              <span>Y-Axis Series</span>
              <small>{selectedSeriesCount} selected</small>
            </div>
            <p className="mapping-group-note">Choose one or more measures to plot on the same chart.</p>
            <div className="checkbox-list">
              {numericFields.map((field) => {
                const checked = yFields.includes(field.key);

                return (
                  <label key={field.key} className={`checkbox-item ${checked ? 'checked' : ''}`}>
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

          <label>
            <span>Aggregation</span>
            <select
              value={widget.mapping?.aggregation || 'sum'}
              onChange={(event) => updateWidgetMapping(widget.id, { aggregation: event.target.value })}
            >
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="min">Minimum</option>
              <option value="max">Maximum</option>
              <option value="count">Count Rows</option>
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

    if (widget.type === 'summaryCard') {
      return (
        <div className="mapping-grid">
          <label>
            <span>Metric Field</span>
            <select
              value={widget.mapping?.metricField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { metricField: event.target.value })}
            >
              {numericFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Aggregation</span>
            <select
              value={widget.mapping?.aggregation || 'sum'}
              onChange={(event) => updateWidgetMapping(widget.id, { aggregation: event.target.value })}
            >
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="min">Minimum</option>
              <option value="max">Maximum</option>
              <option value="count">Count Rows</option>
            </select>
          </label>

          <label>
            <span>Comparison Field</span>
            <select
              value={widget.mapping?.comparisonField || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { comparisonField: event.target.value })}
            >
              <option value="">No Comparison</option>
              {numericFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Helper Text</span>
            <input
              type="text"
              value={widget.mapping?.helperText || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { helperText: event.target.value })}
            />
          </label>

          <label>
            <span>Color Theme</span>
            <select
              value={widget.mapping?.colorTheme || 'auto'}
              onChange={(event) => updateWidgetMapping(widget.id, { colorTheme: event.target.value })}
            >
              <option value="auto">Auto by Trend</option>
              <option value="emerald">Emerald</option>
              <option value="blue">Blue</option>
              <option value="cyan">Cyan</option>
              <option value="violet">Violet</option>
              <option value="amber">Amber</option>
              <option value="rose">Rose</option>
              <option value="slate">Slate</option>
            </select>
          </label>
        </div>
      );
    }

    if (widget.type === 'kpiCard') {
      return (
        <div className="mapping-grid">
          <label>
            <span>Display Mode</span>
            <select
              value={widget.mapping?.displayMode || 'metric'}
              onChange={(event) => updateWidgetMapping(widget.id, { displayMode: event.target.value })}
            >
              <option value="metric">Metric</option>
              <option value="label">Top Label</option>
            </select>
          </label>

          {widget.mapping?.displayMode === 'label' ? (
            <>
              <label>
                <span>Group Field</span>
                <select
                  value={widget.mapping?.groupField || ''}
                  onChange={(event) => updateWidgetMapping(widget.id, { groupField: event.target.value })}
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

              <label>
                <span>Top N</span>
                <input
                  type="number"
                  min="1"
                  max={dataset.records.length}
                  value={widget.mapping?.limit || 1}
                  onChange={(event) =>
                    updateWidgetMapping(widget.id, {
                      limit: Math.max(1, Math.min(dataset.records.length, Number(event.target.value) || 1))
                    })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Metric Field</span>
                <select
                  value={widget.mapping?.metricField || ''}
                  onChange={(event) => updateWidgetMapping(widget.id, { metricField: event.target.value })}
                >
                  {numericFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Aggregation</span>
                <select
                  value={widget.mapping?.aggregation || 'sum'}
                  onChange={(event) => updateWidgetMapping(widget.id, { aggregation: event.target.value })}
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="count">Count Rows</option>
                </select>
              </label>
            </>
          )}

          <label>
            <span>Helper Text</span>
            <input
              type="text"
              value={widget.mapping?.helperText || ''}
              onChange={(event) => updateWidgetMapping(widget.id, { helperText: event.target.value })}
            />
          </label>

          <label>
            <span>Color Theme</span>
            <select
              value={widget.mapping?.colorTheme || 'auto'}
              onChange={(event) => updateWidgetMapping(widget.id, { colorTheme: event.target.value })}
            >
              <option value="auto">Auto by Trend</option>
              <option value="emerald">Emerald</option>
              <option value="blue">Blue</option>
              <option value="cyan">Cyan</option>
              <option value="violet">Violet</option>
              <option value="amber">Amber</option>
              <option value="rose">Rose</option>
              <option value="slate">Slate</option>
            </select>
          </label>
        </div>
      );
    }

    if (widget.type === 'rankingList') {
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

          <label>
            <span>Sort</span>
            <select
              value={widget.mapping?.sortDirection || 'desc'}
              onChange={(event) => updateWidgetMapping(widget.id, { sortDirection: event.target.value })}
            >
              <option value="desc">Highest First</option>
              <option value="asc">Lowest First</option>
            </select>
          </label>

          <label>
            <span>Top N</span>
            <input
              type="number"
              min="1"
              max={dataset.records.length}
              value={widget.mapping?.limit || 5}
              onChange={(event) =>
                updateWidgetMapping(widget.id, {
                  limit: Math.max(1, Math.min(dataset.records.length, Number(event.target.value) || 1))
                })
              }
            />
          </label>
        </div>
      );
    }

    if (widget.type === 'table') {
      const visibleColumns = widget.mapping?.columns || [];

      return (
        <div className="mapping-grid">
          <div className="mapping-group">
            <div className="mapping-group-header">
              <span>Visible Columns</span>
              <small>{visibleColumns.length} selected</small>
            </div>
            <p className="mapping-group-note">Pick the columns you want to show in the table.</p>
            <div className="checkbox-list">
              {dataset.fields.map((field) => {
                const checked = visibleColumns.includes(field.key);

                return (
                  <label key={field.key} className={`checkbox-item ${checked ? 'checked' : ''}`}>
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

  const renderDashboardListPage = () => (
    <div className="dashboard-list-page">
      <header className="topbar dashboard-list-topbar">
        <div className="dashboard-list-heading">
          <h1>Dashboard List</h1>
          <p>คลิกชื่อ dashboard เพื่อดูรายละเอียด</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="dashboard-action"
            onClick={() => {
              setViewMode('detail');
              setReadOnly(true);
              if (!activeDashboard) return;
              clearTransientSelectionState();
            }}
            disabled={!activeDashboard}
          >
            Open current
          </button>
        </div>
      </header>

      <main className="dashboard-list-content">
        <section className="dashboard-list-summary">
          <strong>{dashboards.length} dashboards</strong>
          <span>Select a dashboard card to open its detail view.</span>
        </section>

        <div className="dashboard-list-grid">
          {dashboardCards.map((dashboard) => (
            <button
              key={dashboard.id}
              type="button"
              className={`dashboard-list-card ${dashboard.id === activeDashboardId ? 'active' : ''}`}
              onClick={() => openDashboardDetail(dashboard.id)}
            >
              <div className="dashboard-list-card-header">
                <strong>{dashboard.name}</strong>
                {dashboard.id === activeDashboardId ? <span>Active</span> : null}
              </div>
              <div className="dashboard-list-meta">
                <span>{dashboard.widgetCount} widgets</span>
                {dashboard.filters ? <span>Has filters</span> : <span>No filters</span>}
              </div>
              <div className="dashboard-list-preview">
                {dashboard.previewWidgets.length ? (
                  dashboard.previewWidgets.map((label) => (
                    <span key={label}>{label}</span>
                  ))
                ) : (
                  <span>Empty dashboard</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );

  if (viewMode === 'list') {
    return <div className="app-shell">{renderDashboardListPage()}</div>;
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${readOnly ? 'read-only' : ''}`}>
        <div className="topbar-heading">
          <div className="topbar-heading-row">
            <button type="button" className="section-toggle topbar-back-button" onClick={openDashboardList}>
              Dashboard List
            </button>
          </div>
          <h1>Dashboard Builder Prototype</h1>
          <p>Drag widgets to the canvas, then configure titles and field mappings for each fixed datasource widget.</p>
        </div>
        <div className="dashboard-bar">
          <select
            className="dashboard-switcher"
            value={activeDashboardId}
            onChange={(event) => selectDashboard(event.target.value)}
            aria-label="Dashboard"
            title="Dashboard"
          >
            {dashboards.map((dashboard) => (
              <option key={dashboard.id} value={dashboard.id}>
                {dashboard.name}
              </option>
            ))}
          </select>
          <input
            className="dashboard-name-input"
            type="text"
            value={activeDashboard?.name || ''}
            aria-label="Dashboard name"
            title="Dashboard name"
            onChange={(event) => renameActiveDashboard(event.target.value)}
          />
          <button type="button" className="dashboard-action icon-only" onClick={createNewDashboard} aria-label="Create new dashboard" title="Create new dashboard">
            <ToolbarIcon name="plus" />
          </button>
          <button type="button" className="dashboard-action icon-only" onClick={duplicateActiveDashboard} aria-label="Duplicate dashboard" title="Duplicate dashboard">
            <ToolbarIcon name="copy" />
          </button>
          <button
            type="button"
            className="dashboard-action danger icon-only"
            onClick={deleteActiveDashboard}
            disabled={dashboards.length <= 1}
            aria-label="Delete dashboard"
            title="Delete dashboard"
          >
            <ToolbarIcon name="trash" />
          </button>
          <button type="button" className="dashboard-action icon-only" onClick={saveActiveDashboardFile} aria-label="Save dashboard as file" title="Save dashboard as file">
            <ToolbarIcon name="save" />
          </button>
          <button type="button" className="dashboard-action icon-only" onClick={openDashboardImportPicker} aria-label="Import dashboard file" title="Import dashboard file">
            <ToolbarIcon name="upload" />
          </button>
          <input
            ref={importFileInputRef}
            className="dashboard-file-input"
            type="file"
            accept="application/json,.json"
            onChange={importDashboardFile}
          />
          <button type="button" className="dashboard-action icon-only" onClick={printActiveDashboard} aria-label="Print dashboard" title="Print dashboard">
            <ToolbarIcon name="print" />
          </button>
          <button type="button" className="dashboard-action icon-only" onClick={downloadActiveDashboardPdf} aria-label="Download dashboard as PDF" title="Download dashboard as PDF">
            <ToolbarIcon name="download" />
          </button>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="sidebar-toggle topbar-toggle icon-only"
            onClick={() => setSidebarHidden((prev) => !prev)}
            aria-label={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
            title={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
            disabled={readOnly}
          >
            <ToolbarIcon name="sidebar" />
          </button>
          <button
            type="button"
            className="mode-toggle icon-only"
            onClick={() => setReadOnly((prev) => !prev)}
            aria-label={readOnly ? 'Exit read only preview' : 'Open read only preview'}
            title={readOnly ? 'Exit read only preview' : 'Open read only preview'}
          >
            <ToolbarIcon name={readOnly ? 'edit' : 'preview'} />
          </button>
        </div>
      </header>

      <div className={`builder-layout ${effectiveSidebarHidden ? 'sidebar-hidden' : ''} ${readOnly ? 'read-only-preview' : ''}`}>
        <aside className={`palette ${readOnly ? 'read-only' : ''} ${effectiveSidebarHidden ? 'hidden' : ''}`}>
          <section className={`palette-section ${paletteCollapsed ? 'collapsed' : ''}`}>
            <div className="palette-section-header">
              <div>
                <h3>Widget Palette</h3>
                {!paletteCollapsed ? <p>ลาก widget พร้อมใช้ หรือ widget ที่ config ได้ไปวางบน canvas</p> : null}
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
              <div className="palette-groups">
                <section className="palette-subgroup">
                  <h4>พร้อมใช้</h4>
                  <div className="palette-list">
                    {widgetCatalog
                      .filter((item) => item.group === 'ready')
                      .map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            className="palette-item palette-item-ready"
                            draggable={!readOnly}
                            disabled={readOnly}
                            onDragStart={(event) => onPaletteDragStart(event, item.type)}
                          >
                            <span className="palette-item-thumb" aria-hidden="true">
                              <PaletteWidgetThumbnail type={item.type} />
                            </span>
                            <strong>{item.label}</strong>
                          </button>
                      ))}
                  </div>
                </section>

                <section className="palette-subgroup">
                  <h4>กำหนดค่าได้</h4>
                  <div className="palette-list">
                    {widgetCatalog
                      .filter((item) => item.group !== 'ready')
                      .map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            className="palette-item"
                            draggable={!readOnly}
                            disabled={readOnly}
                            onDragStart={(event) => onPaletteDragStart(event, item.type)}
                          >
                            <span className="palette-item-thumb" aria-hidden="true">
                              <PaletteWidgetThumbnail type={item.type} />
                            </span>
                            <strong>{item.label}</strong>
                          </button>
                      ))}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </aside>

        <div
          className={`dashboard-stage ${readOnly ? 'read-only' : ''}`}
          style={{
            width: readOnly ? `${occupiedContentWidth}px` : undefined,
            height: readOnly ? `${canvasHeight + dashboardFiltersHeight}px` : undefined
          }}
        >
          {shouldRenderDashboardFilters ? (
            <section className="dashboard-filters">
              <div className="dashboard-filters-header">
                <div>
                  <strong>Filters</strong>
                  <span>ควบคุม market, ปี, อุตสาหกรรม และประเทศ</span>
                </div>
                <button type="button" className="section-toggle" onClick={clearActiveDashboardFilters}>
                  Clear Filters
                </button>
              </div>
              <div className="dashboard-filters-grid">
                <div className="filter-button-group">
                  <span>Market</span>
                  <div className="filter-chip-row">
                    {['International', 'Domestic'].map((market) => (
                      <button
                        key={market}
                        type="button"
                        className={activeDashboardFilters.market === market ? 'active' : ''}
                        onClick={() => updateActiveDashboardFilters({ market })}
                      >
                        {market}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-button-group">
                  <span>Year Basis</span>
                  <div className="filter-chip-row">
                    {[
                      { value: 'calendar', label: 'Calendar Year' },
                      { value: 'fiscal', label: 'Fiscal Year' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={activeDashboardFilters.yearMode === option.value ? 'active' : ''}
                        onClick={() => updateActiveDashboardFilters({ yearMode: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  <span>Year</span>
                  <select
                    value={activeDashboardFilters.year}
                    onChange={(event) => updateActiveDashboardFilters({ year: Number(event.target.value) })}
                  >
                    {MICE_FILTER_OPTIONS.years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Industry</span>
                  <select
                    value={activeDashboardFilters.industry}
                    onChange={(event) => updateActiveDashboardFilters({ industry: event.target.value })}
                  >
                    <option value="all">All Industries</option>
                    {MICE_FILTER_OPTIONS.industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Country</span>
                  <select
                    value={activeDashboardFilters.country}
                    onChange={(event) => updateActiveDashboardFilters({ country: event.target.value })}
                  >
                    <option value="all">All Countries</option>
                    {MICE_FILTER_OPTIONS.countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          <main
            ref={canvasRef}
            className={`dashboard-canvas ${readOnly ? 'read-only' : ''}`}
            style={{
              '--grid-cols': canvasCols,
              '--row-size': `${GRID_ROW_HEIGHT}px`,
              '--canvas-height': `${canvasHeight}px`,
              '--canvas-width': `${canvasContentWidth}px`,
              '--canvas-side-pad': `${canvasShiftX}px`,
              '--print-scale': printScale,
              width: readOnly ? `${occupiedContentWidth}px` : undefined,
              marginLeft: readOnly ? 'auto' : undefined,
              marginRight: readOnly ? 'auto' : undefined
            }}
            onDragOver={onCanvasDragOver}
            onDrop={onCanvasDrop}
            onDragLeave={() => setHoverGrid(null)}
            onMouseDown={(event) => {
              if (readOnly) return;
              if (event.target.closest('.widget-card')) return;
              if (isInteractiveTarget(event.target)) return;

              const point = getCanvasLocalPoint(event);
              if (!point) return;

              setActiveConfigWidgetId(null);
              setAction({
                kind: 'marquee',
                startX: event.clientX,
                startY: event.clientY
              });
              selectionBoxRef.current = null;
              setSelectionBox(null);
              setSelectedWidgetIds([]);
            }}
          >
            {!readOnly && hoverGrid ? (
              <div
                className="drop-preview"
                style={{
                  left: hoverGrid.x * cellWidth + canvasShiftX,
                  top: hoverGrid.y * GRID_ROW_HEIGHT,
                  width: cellWidth * 4,
                  height: GRID_ROW_HEIGHT * 4
                }}
              />
            ) : null}

            {!readOnly && selectionBox ? (
              <div
                className="selection-marquee"
                style={{
                  left: selectionBox.x + canvasShiftX,
                  top: selectionBox.y,
                  width: selectionBox.width,
                  height: selectionBox.height
                }}
              />
            ) : null}

            {widgets.map((widget) => {
              const dataset = datasetLibrary[widget.dataset];
              const widgetRecords = getWidgetRecords(widget, dataset);
              const isWidgetPreview = readOnly || widget.preview;
              const isChromelessPreview =
                isWidgetPreview && CHROMELESS_PREVIEW_TYPES.includes(widget.type);
              const isSelected = selectedWidgetIds.includes(widget.id);
              const isTextboxWidget = widget.type === 'textbox';
              const showWidgetHeader = !isChromelessPreview && !isTextboxWidget;
              const startWidgetMove = (event) => {
                if (readOnly) return;
                if (isInteractiveTarget(event.target) || event.target.closest('.resize-handle')) {
                  return;
                }

                const movingIds =
                  selectedWidgetIds.includes(widget.id) && selectedWidgetIds.length > 1
                    ? selectedWidgetIds
                    : [widget.id];
                const originMap = Object.fromEntries(
                  widgets
                    .filter((item) => movingIds.includes(item.id))
                    .map((item) => [item.id, { x: item.x, y: item.y }])
                );

                setSelectedWidgetIds(movingIds);
                gestureSnapshotRef.current = cloneWorkspace(workspace);
                gestureChangedRef.current = false;
                setAction({
                  kind: movingIds.length > 1 ? 'move-selection' : 'move',
                  id: widget.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  origin: { x: widget.x, y: widget.y },
                  originMap
                });
              };
              const widgetControls = (
                <div className="widget-controls">
                  {hasConfigPopup(widget.type) ? (
                    <button
                      type="button"
                      className="icon-button config-toggle"
                      aria-label="Configure widget"
                      title="Configure"
                      onClick={() => setActiveConfigWidgetId(widget.id)}
                    >
                      ⚙
                    </button>
                  ) : null}
                  {!NO_CONFIG_WIDGET_TYPES.includes(widget.type) ? (
                    <button
                      type="button"
                      className="icon-button preview-toggle"
                      aria-label={widget.preview ? 'Edit widget' : 'Preview widget'}
                      title={widget.preview ? 'Edit' : 'Preview'}
                      onClick={() => toggleWidgetPreview(widget.id)}
                    >
                      {widget.preview ? '✎' : '◐'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button remove-toggle"
                    aria-label="Remove widget"
                    title="Remove"
                    onClick={() => removeWidget(widget.id)}
                  >
                    ×
                  </button>
                </div>
              );

              return (
                <section
                  key={widget.id}
                  className={`widget-card ${readOnly ? 'read-only' : ''} ${
                    isChromelessPreview ? 'no-chrome' : ''
                  } ${isSelected ? 'selected' : ''}`}
                  data-widget-type={widget.type}
                  data-widget-id={widget.id}
                  data-widget-title={widget.title}
                  style={{
                    left: widget.x * cellWidth + canvasShiftX,
                    top: widget.y * GRID_ROW_HEIGHT,
                    width: widget.w * cellWidth,
                    height:
                      widget.type === 'textbox'
                        ? widget.heightPx ?? widget.h * GRID_ROW_HEIGHT
                        : widget.h * GRID_ROW_HEIGHT
                  }}
                  onMouseDown={(event) => {
                    if (readOnly) return;
                    if (
                      isInteractiveTarget(event.target) ||
                      event.target.closest('.drag-handle') ||
                      event.target.closest('.resize-handle')
                    ) {
                      return;
                    }

                    event.stopPropagation();

                    setActiveConfigWidgetId(null);

                    if (event.metaKey || event.ctrlKey) {
                      setSelectedWidgetIds((prev) =>
                        prev.includes(widget.id)
                          ? prev.filter((id) => id !== widget.id)
                          : [...prev, widget.id]
                      );
                      return;
                    }

                    setSelectedWidgetIds([widget.id]);
                  }}
                >
                {showWidgetHeader ? (
                  <div
                    className="widget-header drag-handle"
                    onMouseDown={startWidgetMove}
                    >
                    {readOnly ? (
                      <div className="widget-title-block">
                        <strong>{widget.title}</strong>
                      </div>
                    ) : (
                      <>
                        <div className="widget-title-block">
                          <small>{widget.type.toUpperCase()}</small>
                          {TEXT_WIDGET_TYPES.includes(widget.type) ? (
                            <strong>{widget.title}</strong>
                          ) : (
                            <input
                              type="text"
                              value={widget.title}
                              onChange={(event) => updateWidgetField(widget.id, 'title', event.target.value)}
                            />
                            )}
                        </div>
                        {widgetControls}
                      </>
                    )}
                  </div>
                ) : null}

                {isTextboxWidget && !readOnly ? (
                  <div className="textbox-edit-overlay" aria-hidden="true">
                    <div className="textbox-drag-zone drag-handle" onMouseDown={startWidgetMove} />
                    <div className="textbox-edit-controls">{widgetControls}</div>
                  </div>
                ) : null}

                {!readOnly && isChromelessPreview ? (
                  <button
                    type="button"
                    className="preview-edit-floating"
                    aria-label="Edit widget"
                    title="Edit"
                    onClick={() => toggleWidgetPreview(widget.id)}
                  >
                    ✎
                  </button>
                ) : null}

                <div className="widget-content">
                  <div
                    className={`widget-visual ${
                      !isWidgetPreview && TEXT_WIDGET_TYPES.includes(widget.type) ? 'text-preview-visual' : ''
                    }`}
                  >
                    <WidgetRenderer widget={widget} dataset={dataset} records={widgetRecords} />
                  </div>
                </div>

                {!readOnly ? (
                  <button
                    type="button"
                    aria-label="Resize widget"
                    className="resize-handle"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      gestureSnapshotRef.current = cloneWorkspace(workspace);
                      gestureChangedRef.current = false;
                      setAction({
                        kind: 'resize',
                        id: widget.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: {
                          w: widget.w,
                          h: widget.h,
                          heightPx: widget.heightPx || widget.h * GRID_ROW_HEIGHT
                        }
                      });
                    }}
                  />
                ) : null}
              </section>
            );
          })}
        </main>
      </div>
      </div>

      {activeConfigWidget ? (
        <div className="modal-backdrop" onClick={() => setActiveConfigWidgetId(null)}>
          <div className="config-modal" onClick={(event) => event.stopPropagation()}>
            <div className="config-modal-header">
              <div>
                <h2>{activeConfigWidget.title}</h2>
                <p>
                  {TEXT_WIDGET_TYPES.includes(activeConfigWidget.type)
                    ? 'Configure text content and formatting.'
                    : 'Configure the widget field mapping for its fixed datasource.'}
                </p>
                {!TEXT_WIDGET_TYPES.includes(activeConfigWidget.type) && activeConfigDataset ? (
                  <div className="config-modal-meta">
                    <span className="config-modal-badge">{activeConfigDataset.label}</span>
                    <span className="config-modal-caption">
                      {activeConfigDataset.records.length} rows / {activeConfigDataset.fields.length} fields
                    </span>
                  </div>
                ) : null}
              </div>
              <button type="button" className="section-toggle" onClick={() => setActiveConfigWidgetId(null)}>
                Close
              </button>
            </div>

            <div className="config-modal-body">
              {TEXT_WIDGET_TYPES.includes(activeConfigWidget.type) ? (
                renderTextWidgetControls(activeConfigWidget)
              ) : (
                <>
                  {renderMappingControls(activeConfigWidget, activeConfigDataset)}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
