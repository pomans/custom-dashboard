import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import WidgetRenderer from './components/WidgetRenderer';
import WizardOnboarding, { useWizard } from './components/WizardOnboarding';
import { datasetLibrary, widgetCatalog } from './data/sampleData';
import { fetchWidgetsOnDashboard, activeMiceWidgetKey } from './services/widgetApi';
import { USE_SAMPLE_DATA } from './config/apiConfig';

const MIN_GRID_COLS = 12;
const GRID_ROW_HEIGHT = 72;
const GRID_COL_WIDTH = 96;
const MIN_W = 2;
const MIN_H = 2;
const MIN_CANVAS_ROWS = 20;
const CANVAS_GROWTH_PADDING = 8;
const GRID_SUBDIVISIONS = 8;
const WIDGET_VISUAL_INSET = 6;
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.0;
const PRINT_PAGE_MARGIN_MM = 12;
const PX_PER_MM = 96 / 25.4;
const MM_PER_PX = 25.4 / 96;
const LOCAL_STORAGE_KEY = 'bi-dashboard.workspace.v1';
const TEXT_WIDGET_TYPES = ['textbox'];
const toKebabLabel = (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
const NO_CONFIG_WIDGET_TYPES = [
  'miceStatCard',
  'miceEventsChart',
  'miceRevenueChart',
  'miceVisitorsChart',
  'miceEventsQuarterlyChart',      // ← เพิ่ม: ต้องอยู่ในนี้เพื่อให้ fetchWidgetsOnDashboard fetch data
  'miceVisitorsQuarterlyChart',    // ← เพิ่ม: เดียวกัน
  'miceKpis',
  'miceNationalityPerformance',
  'miceNationalityIndustryMatrix',
  'miceNationalityMatrixView',
  'miceVisitorsBreakdown',
  'miceDrillFlow',
  'miceDataTable'
];
const CHROMELESS_PREVIEW_TYPES = ['textbox', 'summaryCard', 'kpiCard'];
const MICE_FILTER_DEFAULTS = {
  market: 'International',
  yearMode: 'calendar',
  year: 2025,
  yearMin: 2007,
  yearMax: 2025,
  industry: 'all',
  country: 'all',
  continent: 'all',       // Asia | Europe | … | all  — filters nationality-related widgets
  visitorType: 'All',     // All | Thai | International — Tourism widgets
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
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  switch (name) {
    /* ── New dashboard: layout grid + plus badge ── */
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...c} x="3" y="3" width="7" height="7" rx="1.5" />
          <rect {...c} x="14" y="3" width="7" height="7" rx="1.5" />
          <rect {...c} x="3" y="14" width="7" height="7" rx="1.5" />
          <path {...c} d="M17 14v6M14 17h6" strokeWidth="2.2" />
        </svg>
      );

    /* ── Duplicate: two stacked pages, top offset ── */
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...c} x="8" y="8" width="11" height="13" rx="2" />
          <path {...c} d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
          <path {...c} d="M11 12h5M11 15h3" />
        </svg>
      );

    /* ── Delete: trash with warning lines ── */
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M3 6h18" />
          <path {...c} d="M8 6V4h8v2" />
          <path {...c} d="M19 6l-1 14H6L5 6" />
          <path {...c} d="M10 10v7M14 10v7" />
        </svg>
      );

    /* ── Export JSON: file with arrow exiting right ── */
    case 'save':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path {...c} d="M14 3v6h6" />
          <path {...c} d="M9 17l3 3 3-3M12 12v8" strokeWidth="1.8" />
        </svg>
      );

    /* ── Import JSON: file with arrow entering ── */
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path {...c} d="M14 3v6h6" />
          <path {...c} d="M12 20v-8M9 15l3-3 3 3" strokeWidth="1.8" />
        </svg>
      );

    /* ── Print: printer with paper coming out ── */
    case 'print':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M6 9V3h12v6" />
          <rect {...c} x="4" y="9" width="16" height="9" rx="2" />
          <path {...c} d="M8 14h8M8 17h5" />
          <circle fill="currentColor" stroke="none" cx="17" cy="13" r="1" />
        </svg>
      );

    /* ── PDF Export: document with PDF badge + down arrow ── */
    case 'download':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
          <path {...c} d="M13 3v6h6" />
          <path {...c} d="M8 13h1.5a1.5 1.5 0 0 1 0 3H8v-3z" strokeWidth="1.5" />
          <path {...c} d="M13 13v3M16 13v3" strokeWidth="1.5" />
          <path {...c} d="M16 13h-1.5a1 1 0 0 0 0 2H16" strokeWidth="1.5" />
        </svg>
      );

    /* ── Panel toggle: layout with left panel open/close arrow ── */
    case 'sidebar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...c} x="3" y="3" width="24" height="24" rx="2" />
          <path {...c} d="M9 3v18" />
          <path {...c} d="M5.5 9l-2 3 2 3" strokeWidth="1.8" />
        </svg>
      );

    /* ── Preview mode: eye with sparkle ── */
    case 'preview':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle {...c} cx="12" cy="12" r="3" />
          <path {...c} d="M19 4l1.5-1.5M20.5 6H22M20.5 4.5l-1.5 1.5" strokeWidth="1.5" />
        </svg>
      );

    /* ── Edit mode: pencil with grid dots ── */
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M4 20h4l9.5-9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
          <path {...c} d="M14 6l3 3" />
          <circle fill="currentColor" stroke="none" cx="19" cy="5" r="1.2" />
          <circle fill="currentColor" stroke="none" cx="5" cy="5" r="1.2" />
          <circle fill="currentColor" stroke="none" cx="5" cy="9" r="1.2" />
        </svg>
      );

    case 'align-left':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M4 6h16M4 10h10M4 14h16M4 18h10" />
        </svg>
      );
    case 'align-center':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M4 6h16M7 10h10M4 14h16M7 18h10" />
        </svg>
      );
    case 'align-right':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M4 6h16M10 10h10M4 14h16M10 18h10" />
        </svg>
      );

    /* ── Help: question mark in circle ── */
    case 'help':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...c} cx="12" cy="12" r="9" />
          <path {...c} d="M9.5 9.5a2.5 2.5 0 0 1 4.9.8c0 1.6-2.4 2.2-2.4 4" />
          <circle fill="currentColor" stroke="none" cx="12" cy="17.5" r="1" />
        </svg>
      );

    /* ── Fit to screen: arrows pointing inward to a rectangle ── */
    case 'fitScreen':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...c} d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          <rect {...c} x="8" y="8" width="8" height="8" rx="1" />
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


const DashboardMiniMap = () => (
  <svg
    className="dashboard-list-card-thumb-svg"
    viewBox="0 0 200 110"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Background */}
    <rect width="200" height="110" rx="10" fill="#eef0f4" />
    {/* Top-left cell */}
    <rect x="10" y="10" width="84" height="40" rx="6" fill="#ffffff" />
    {/* Top-right cell */}
    <rect x="106" y="10" width="84" height="40" rx="6" fill="#ffffff" />
    {/* Bottom-left cell */}
    <rect x="10" y="60" width="84" height="40" rx="6" fill="#ffffff" />
    {/* Bottom-right cell */}
    <rect x="106" y="60" width="84" height="40" rx="6" fill="#ffffff" />
  </svg>
);

const PaletteWidgetThumbnail = ({ type }) => {
  const B = '#2457cf';   // brand blue
  const LB = '#93c5fd';  // light blue
  const BG = '#eef2f8';  // background
  const LG = '#dde3ee';  // light gray
  const GY = '#94a3b8';  // gray text

  const Wrap = ({ children }) => (
    <svg viewBox="0 0 80 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="80" height="54" rx="5" fill={BG} />
      {children}
    </svg>
  );

  /* ── KPI / Stat card ─────────────────────────── */
  if (type === 'miceStatCard' || type === 'kpiCard' || type === 'summaryCard') {
    return (
      <Wrap>
        <rect x="0" y="0" width="80" height="3" rx="1.5" fill={B} />
        <text x="40" y="30" textAnchor="middle" fill={B} fontSize="18" fontWeight="bold" fontFamily="sans-serif">201K</text>
        <rect x="18" y="35" width="44" height="3" rx="1.5" fill={LG} />
        <rect x="26" y="42" width="28" height="3" rx="1.5" fill={LG} />
      </Wrap>
    );
  }

  /* ── Annual line chart ───────────────────────── */
  if (type === 'miceEventsChart' || type === 'miceRevenueChart' || type === 'miceVisitorsChart' || type === 'line' || type === 'chart') {
    const pts = [[10,40],[18,34],[26,29],[34,31],[42,20],[50,15],[58,17],[66,13]];
    const d = pts.map(([x,y],i) => `${i===0?'M':'L'}${x},${y}`).join(' ');
    const fd = pts.slice(-3).map(([x,y]) => `L${x},${y}`).join(' ').replace('L','M') + ' L72,11';
    return (
      <Wrap>
        <line x1="8" y1="45" x2="74" y2="45" stroke={LG} strokeWidth="1" />
        <line x1="8" y1="10" x2="8" y2="45" stroke={LG} strokeWidth="1" />
        {[10,18,26,34,42,50].map((x,i) => (
          <line key={i} x1={x+8} y1="45" x2={x+8} y2="43" stroke={LG} strokeWidth="1" />
        ))}
        <path d={d} fill="none" stroke={B} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={`M50,15 L58,17 L66,13 L72,11`} fill="none" stroke={B} strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" />
        {pts.slice(0,5).map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2" fill={B} />)}
      </Wrap>
    );
  }

  /* ── Bar chart ───────────────────────────────── */
  if (type === 'bar') {
    const bars = [{x:12,h:18},{x:22,h:28},{x:32,h:14},{x:42,h:34},{x:52,h:22},{x:62,h:30}];
    return (
      <Wrap>
        <line x1="8" y1="45" x2="74" y2="45" stroke={LG} strokeWidth="1" />
        {bars.map((b,i) => (
          <rect key={i} x={b.x} y={45-b.h} width="7" height={b.h} rx="1.5" fill={i===3 ? B : LB} />
        ))}
      </Wrap>
    );
  }

  /* ── Quarterly dual-line chart ───────────────── */
  if (type === 'miceEventsQuarterlyChart' || type === 'miceVisitorsQuarterlyChart') {
    return (
      <Wrap>
        <line x1="8" y1="45" x2="74" y2="45" stroke={LG} strokeWidth="1" />
        {['Q1','Q2','Q3','Q4'].map((q,i) => (
          <text key={q} x={17+i*16} y="50" textAnchor="middle" fill={GY} fontSize="6" fontFamily="sans-serif">{q}</text>
        ))}
        <polyline points="17,36 33,26 49,30 65,16" fill="none" stroke={B} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {[[17,36],[33,26],[49,30],[65,16]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2.5" fill={B} />)}
        <polyline points="17,40 33,37 49,38 65,32" fill="none" stroke={LB} strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round" />
        {[[17,40],[33,37],[49,38],[65,32]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2" fill={LB} />)}
      </Wrap>
    );
  }

  /* ── Table / Performance table ───────────────── */
  if (type === 'table' || type === 'miceNationalityPerformance') {
    return (
      <Wrap>
        <rect x="6" y="7" width="68" height="7" rx="2" fill={B} opacity="0.85" />
        {[18,27,36,45].map((y,i) => (
          <React.Fragment key={y}>
            <rect x="6" y={y} width="68" height="7" rx="1" fill={i%2===0 ? '#fff' : LG} opacity="0.9" />
            <rect x="8" y={y+2} width={[30,24,36,20][i]} height="3" rx="1" fill={LG} />
            <rect x={55} y={y+2} width={[16,20,12,24][i]} height="3" rx="1" fill={LB} />
          </React.Fragment>
        ))}
      </Wrap>
    );
  }

  /* ── Matrix / heatmap ────────────────────────── */
  if (type === 'miceNationalityIndustryMatrix' || type === 'miceNationalityMatrixView' || type === 'rankingList') {
    if (type === 'rankingList') {
      return (
        <Wrap>
          {[8,17,26,35,44].map((y,i) => (
            <React.Fragment key={y}>
              <text x="9" y={y+7} fill={GY} fontSize="7" fontFamily="sans-serif" fontWeight="bold">{i+1}</text>
              <rect x="16" y={y+1} width={[54,44,34,28,20][i]} height="6" rx="2" fill={i===0 ? B : LB} opacity={1-i*0.1} />
            </React.Fragment>
          ))}
        </Wrap>
      );
    }
    const cells = [[0.9,0.3,0.6],[0.4,0.8,0.2],[0.7,0.2,0.9],[0.3,0.6,0.4]];
    return (
      <Wrap>
        {[28,42,56].map((x,i) => (
          <rect key={i} x={x} y="6" width="12" height="5" rx="1" fill={GY} opacity="0.5" />
        ))}
        {cells.map((row,ri) =>
          row.map((v,ci) => (
            <rect key={`${ri}-${ci}`} x={28+ci*14} y={16+ri*9} width="12" height="7" rx="1.5"
              fill={B} opacity={0.15 + v * 0.85} />
          ))
        )}
        {[16,25,34,43].map((y,i) => (
          <rect key={i} x="6" y={y} width="18" height="3" rx="1" fill={LG} />
        ))}
      </Wrap>
    );
  }

  /* ── Breakdown columns ───────────────────────── */
  if (type === 'miceVisitorsBreakdown') {
    return (
      <Wrap>
        <rect x="4" y="19" width="13" height="18" rx="3" fill={B} />
        {[[22,9],[22,22],[22,35]].map(([x,y],i) => (
          <React.Fragment key={i}>
            <path d={`M17,28 C19,28 20,${y+7} ${x},${y+7}`} fill="none" stroke={LB} strokeWidth="1.5" />
            <rect x={x} y={y} width="13" height="12" rx="2.5" fill={LB} opacity={0.9-i*0.1} />
          </React.Fragment>
        ))}
        {[[40,12],[40,24],[40,36]].map(([x,y],i) => (
          <React.Fragment key={i}>
            <path d={`M35,15 C37,15 38,${y+6} ${x},${y+6}`} fill="none" stroke={LB} strokeWidth="1" opacity="0.5" />
            <rect x={x} y={y} width="13" height="10" rx="2.5" fill={LB} opacity={0.5-i*0.08} />
          </React.Fragment>
        ))}
      </Wrap>
    );
  }

  /* ── Drill-down flow (Sankey) ────────────────── */
  if (type === 'miceDrillFlow') {
    return (
      <Wrap>
        {/* Total */}
        <rect x="4" y="22" width="12" height="12" rx="2.5" fill={B} />
        {/* Nationality bars */}
        {[[22,9,14],[22,19,11],[22,29,9],[22,38,6]].map(([x,y,w],i) => (
          <rect key={i} x={x} y={y} width={w} height="6" rx="1.5" fill={i===2 ? B : LB} opacity={i===2?1:0.75} />
        ))}
        {/* Industry bars */}
        {[[44,14,16],[44,24,10]].map(([x,y,w],i) => (
          <rect key={i} x={x} y={y} width={w} height="6" rx="1.5" fill={i===0 ? B : LB} opacity={i===0?1:0.7} />
        ))}
        {/* Quarters */}
        {[[64,10,12],[64,18,11],[64,26,10],[64,34,9]].map(([x,y,w],i) => (
          <rect key={i} x={x} y={y} width={w} height="6" rx="1.5" fill={LB} opacity={0.85-i*0.05} />
        ))}
        {/* Bezier lines: total → nats */}
        <path d="M16,28 C19,28 19,12 22,12" fill="none" stroke={LB} strokeWidth="1.5" opacity="0.6" />
        <path d="M16,28 C19,28 19,22 22,22" fill="none" stroke={LB} strokeWidth="1" opacity="0.4" />
        <path d="M16,28 C19,28 19,32 22,32" fill="none" stroke={B} strokeWidth="2" opacity="0.9" />
        <path d="M16,28 C19,28 19,41 22,41" fill="none" stroke={LB} strokeWidth="1" opacity="0.3" />
        {/* nat→ind */}
        <path d="M36,32 C40,32 40,17 44,17" fill="none" stroke={B} strokeWidth="1.5" opacity="0.9" />
        <path d="M36,32 C40,32 40,27 44,27" fill="none" stroke={LB} strokeWidth="1" opacity="0.4" />
        {/* ind→quarters */}
        <path d="M60,17 C62,17 62,13 64,13" fill="none" stroke={B} strokeWidth="1.5" opacity="0.85" />
        <path d="M60,17 C62,17 62,21 64,21" fill="none" stroke={B} strokeWidth="1.2" opacity="0.7" />
        <path d="M60,17 C62,17 62,29 64,29" fill="none" stroke={B} strokeWidth="1" opacity="0.55" />
        <path d="M60,17 C62,17 62,37 64,37" fill="none" stroke={B} strokeWidth="0.8" opacity="0.4" />
      </Wrap>
    );
  }

  /* ── Pie / donut ─────────────────────────────── */
  if (type === 'pie') {
    return (
      <Wrap>
        <circle cx="40" cy="27" r="20" fill={LG} />
        <path d="M40,27 L40,7 A20,20 0 0,1 57.3,37 Z" fill={B} />
        <path d="M40,27 L57.3,37 A20,20 0 0,1 22.7,37 Z" fill={LB} />
        <path d="M40,27 L22.7,37 A20,20 0 0,1 40,7 Z" fill="#bfdbfe" />
        <circle cx="40" cy="27" r="10" fill={BG} />
      </Wrap>
    );
  }

  /* ── Treemap ─────────────────────────────────── */
  if (type === 'treemap') {
    return (
      <Wrap>
        <rect x="5" y="6" width="38" height="30" rx="3" fill={B} opacity="0.9" />
        <rect x="47" y="6" width="28" height="14" rx="3" fill={LB} opacity="0.85" />
        <rect x="47" y="24" width="28" height="12" rx="3" fill={LB} opacity="0.55" />
        <rect x="5" y="40" width="22" height="9" rx="3" fill={LB} opacity="0.45" />
        <rect x="31" y="40" width="16" height="9" rx="3" fill={LB} opacity="0.35" />
        <rect x="51" y="40" width="24" height="9" rx="3" fill={LB} opacity="0.25" />
      </Wrap>
    );
  }

  /* ── Textbox / label / date ──────────────────── */
  if (type === 'textbox' || type === 'label' || type === 'date') {
    return (
      <Wrap>
        <rect x="14" y="10" width="38" height="7" rx="2.5" fill={GY} opacity="0.45" />
        <rect x="8" y="23" width="64" height="4" rx="2" fill={LG} />
        <rect x="8" y="31" width="56" height="4" rx="2" fill={LG} />
        <rect x="8" y="39" width="44" height="4" rx="2" fill={LG} />
      </Wrap>
    );
  }

  /* ── Generic fallback ────────────────────────── */
  return (
    <Wrap>
      <rect x="10" y="10" width="60" height="34" rx="4" fill={LG} />
    </Wrap>
  );
};

/* ─────────────────────────────────────────────────────────
   YearRangeSlider — dual-thumb range input for year filter
───────────────────────────────────────────────────────── */
const YearRangeSlider = ({ minYear, maxYear, valueMin, valueMax, onChange }) => {
  const trackRef = useRef(null);

  const pct = (v) => ((v - minYear) / (maxYear - minYear)) * 100;
  const leftPct  = pct(valueMin);
  const rightPct = pct(valueMax);

  const handleMin = (e) => {
    const v = Math.min(Number(e.target.value), valueMax);
    onChange(v, valueMax);
  };
  const handleMax = (e) => {
    const v = Math.max(Number(e.target.value), valueMin);
    onChange(valueMin, v);
  };

  return (
    <div className="yr-range-wrap">
      <div className="yr-range-labels">
        <span className="yr-range-val">{valueMin}</span>
        <span className="yr-range-val">{valueMax}</span>
      </div>
      <div className="yr-range-track-wrap" ref={trackRef}>
        {/* Filled track between thumbs */}
        <div
          className="yr-range-fill"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          className="yr-range-input yr-range-min"
          min={minYear}
          max={maxYear}
          value={valueMin}
          onChange={handleMin}
        />
        {/* Max thumb */}
        <input
          type="range"
          className="yr-range-input yr-range-max"
          min={minYear}
          max={maxYear}
          value={valueMax}
          onChange={handleMax}
        />
      </div>
      <div className="yr-range-ticks">
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
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
    heightPx: isTextWidget ? overrides.heightPx || null : undefined,
    ...(template.metric !== undefined ? { metric: template.metric } : {})
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
  filters: options.filters ? { ...options.filters } : undefined,
  filterPanel: options.filterPanel ? { ...options.filterPanel }
    : (options.filters ? { x: 0, y: 0, w: 12, h: 3 } : undefined)
});

const cloneDashboard = (dashboard) => ({
  ...dashboard,
  widgets: cloneWidgets(dashboard.widgets || []),
  filters: dashboard.filters ? { ...dashboard.filters } : undefined,
  filterPanel: dashboard.filterPanel ? { ...dashboard.filterPanel } : undefined
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
    filters: dashboardValue.filters ? { ...dashboardValue.filters } : undefined,
    filterPanel: dashboardValue.filterPanel ? { ...dashboardValue.filterPanel } : undefined
  };
};

const miceEventsChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceEventsChart');
const miceRevenueChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceRevenueChart');
const miceVisitorsChartTemplate = widgetCatalog.find((widget) => widget.type === 'miceVisitorsChart');
const miceNationalityPerformanceTemplate = widgetCatalog.find((widget) => widget.type === 'miceNationalityPerformance');
const miceNationalityIndustryMatrixTemplate = widgetCatalog.find((widget) => widget.type === 'miceNationalityIndustryMatrix');
const miceVisitorsBreakdownTemplate = widgetCatalog.find((widget) => widget.type === 'miceVisitorsBreakdown');

const initialWidgets = [
  createWidget([], miceEventsChartTemplate, 0, 3),
  createWidget([{ type: 'miceEventsChart' }], miceRevenueChartTemplate, 0, 10),
  createWidget([{ type: 'miceRevenueChart' }], miceVisitorsChartTemplate, 0, 17),
  createWidget([{ type: 'miceVisitorsChart' }], miceNationalityPerformanceTemplate, 0, 24),
  createWidget([{ type: 'miceNationalityPerformance' }], miceNationalityIndustryMatrixTemplate, 0, 33),
  createWidget([{ type: 'miceNationalityIndustryMatrix' }], miceVisitorsBreakdownTemplate, 0, 42)
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
          filters: dashboard.filters ? { ...dashboard.filters } : undefined,
          filterPanel: dashboard.filterPanel ? { ...dashboard.filterPanel } : undefined
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
  const market  = options.forceInternationalOnly ? 'International' : filters.market;
  const yearMode = filters.yearMode;
  const industry = filters.industry;
  const country  = filters.country;
  // Support both single-year (legacy) and range (yearMin/yearMax)
  const yearMin = filters.yearMin != null ? Number(filters.yearMin) : (filters.year ? Number(filters.year) : null);
  const yearMax = filters.yearMax != null ? Number(filters.yearMax) : (filters.year ? Number(filters.year) : null);

  return (records || []).filter((record) => {
    if (market && market !== 'all' && record.market !== market) return false;
    if (yearMode && yearMode !== 'all' && record.yearMode !== yearMode) return false;
    if (yearMin != null && !Number.isNaN(yearMin) && Number(record.year) < yearMin) return false;
    if (yearMax != null && !Number.isNaN(yearMax) && Number(record.year) > yearMax) return false;
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
  // ── Embedded mode: running inside an iframe (e.g. tceb-web) ──
  const isEmbedded = window.self !== window.top;

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
  const [stageViewportWidth, setStageViewportWidth] = useState(null);
  const [stageViewportHeight, setStageViewportHeight] = useState(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [newDashboardDialog, setNewDashboardDialog] = useState(false);
  const [newDashboardDraftName, setNewDashboardDraftName] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimerRef = useRef(null);
  const [dashboardListLayout, setDashboardListLayout] = useState('card');
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { wizardOpen, openWizard, closeWizard } = useWizard();
  const canvasRef = useRef(null);
  const stageWrapRef = useRef(null);
  const importFileInputRef = useRef(null);
  const listImportRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const gestureSnapshotRef = useRef(null);
  const gestureChangedRef = useRef(false);
  const filterPanelRef = useRef(null);
  const [filterPanelActualPx, setFilterPanelActualPx] = useState(null);

  // ── API data state ─────────────────────────────────────────────────────────
  const [miceApiFixedProfile, setMiceApiFixedProfile] = useState(null);
  const [miceApiStatus, setMiceApiStatus] = useState('idle'); // idle | loading | loaded | error
  const [refreshKey, setRefreshKey] = useState(0);            // increment → force reload (nocache)

  const dashboards = workspace.dashboards;
  const dashboardsRef = useRef(dashboards);
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
  const canvasContentWidth = canvasCols * cellWidth;
  const activeDashboardFilters = activeDashboard?.filters || { ...MICE_FILTER_DEFAULTS };
  const shouldRenderDashboardFilters = Boolean(activeDashboardFilters);

  // ── Fetch only the widgets currently on the dashboard, with Spark concurrency guard ──
  // Re-runs when: filter values change OR the set of MICE widget types on the dashboard changes
  const activeMiceKey = activeMiceWidgetKey(widgets);
  useEffect(() => {
    const miceWidgets = widgets.filter((w) => NO_CONFIG_WIDGET_TYPES.includes(w.type));
    if (!miceWidgets.length) return undefined;

    // Sample-data mode: ข้าม API fetch ทั้งหมด ใช้ sampleData fixedProfile โดยตรง
    if (USE_SAMPLE_DATA) {
      setMiceApiFixedProfile(null);
      setMiceApiStatus('loaded');
      return undefined;
    }

    // AbortController ยกเลิก fetch เก่าทันทีเมื่อ filter เปลี่ยน
    // ป้องกัน pending requests ค้างอยู่เมื่อ user เปลี่ยน filter เร็ว
    const abortController = new AbortController();
    const { signal } = abortController;

    setMiceApiStatus('loading');
    // refreshKey > 0 → force reload: ส่ง nocache=true เพื่อ bypass server MemoryCache
    const filterForFetch = refreshKey > 0
      ? { ...activeDashboardFilters, nocache: true }
      : activeDashboardFilters;
    fetchWidgetsOnDashboard(miceWidgets, filterForFetch, signal)
      .then((profile) => {
        if (!signal.aborted && profile) {
          setMiceApiFixedProfile(profile);
          setMiceApiStatus('loaded');
        }
      })
      .catch((err) => {
        if (!signal.aborted) setMiceApiStatus('error');
      });
    return () => { abortController.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeMiceKey,                           // widget types on dashboard changed
    activeDashboardFilters?.market,
    activeDashboardFilters?.yearMode,
    activeDashboardFilters?.year,
    activeDashboardFilters?.yearMin,
    activeDashboardFilters?.yearMax,
    activeDashboardFilters?.industry,
    activeDashboardFilters?.country,
    activeDashboardFilters?.continent,
    activeDashboardFilters?.visitorType,
    refreshKey,   // force reload trigger
  ]);
  const filterPanelLayout = shouldRenderDashboardFilters
    ? (activeDashboard?.filterPanel || { x: 0, y: 0, w: 12, h: 3 })
    : null;
  // In read-only mode expand the occupied range to include the filter panel
  const effectiveMinCol = filterPanelLayout ? Math.min(minOccupiedCol, filterPanelLayout.x) : minOccupiedCol;
  const effectiveMaxCol = filterPanelLayout ? Math.max(maxOccupiedCol, filterPanelLayout.x + filterPanelLayout.w) : maxOccupiedCol;
  const occupiedContentWidth = readOnly
    ? Math.max(cellWidth, (effectiveMaxCol - effectiveMinCol) * cellWidth)
    : Math.max(MIN_GRID_COLS * cellWidth, (maxOccupiedCol - minOccupiedCol) * cellWidth);
  const canvasShiftX = readOnly
    ? -effectiveMinCol * cellWidth
    : 0;

  // In read-only mode on narrow screens, reflow widgets into a vertical stack
  const NARROW_BREAKPOINT = 860;
  const isNarrowView = readOnly && stageViewportWidth !== null && stageViewportWidth < NARROW_BREAKPOINT;

  // Sort widgets top-to-bottom, left-to-right for narrow reflow
  const displayWidgets = isNarrowView
    ? [...widgets].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
    : widgets;

  const activeConfigWidget = widgets.find((widget) => widget.id === activeConfigWidgetId) || null;
  const activeConfigDataset = activeConfigWidget ? datasetLibrary[activeConfigWidget.dataset] : null;
  const selectedWidgets = widgets.filter((widget) => selectedWidgetIds.includes(widget.id));
  const filterPanelGridH = filterPanelLayout ? Math.max(2, filterPanelLayout.h ?? 3) : 0;
  const effectiveMaxRow = filterPanelLayout
    ? Math.max(maxOccupiedRow, filterPanelLayout.y + filterPanelGridH)
    : maxOccupiedRow;
  const canvasRows = readOnly ? effectiveMaxRow : effectiveMaxRow + CANVAS_GROWTH_PADDING;
  const canvasHeight = canvasRows * GRID_ROW_HEIGHT;
  const dashboardCards = dashboards.map((dashboard) => {
    const dashboardWidgetCount = dashboard.widgets?.length || 0;
    const previewWidgets = (dashboard.widgets || []).slice(0, 3).map((widget) => widget.title || widget.type);
    const hasFilters = Boolean(dashboard.filters || dashboard.filterPanel);
    return {
      ...dashboard,
      widgetCount: dashboardWidgetCount,
      previewWidgets,
      hasFilters
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
      x: Math.max(0, (event.clientX - rect.left) / canvasZoom - canvasShiftX),
      y: Math.max(0, (event.clientY - rect.top) / canvasZoom)
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

  const saveDashboardFile = (dashboard) => {
    if (!dashboard) return;

    const exportPayload = {
      type: 'bi-dashboard.dashboard',
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: cloneDashboard(dashboard)
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${createSafeFileName(dashboard.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const saveActiveDashboardFile = () => saveDashboardFile(activeDashboard);

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
    if (!stageWrapRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setStageViewportWidth(rect.width);
      if (rect?.height) setStageViewportHeight(rect.height);
    });

    observer.observe(stageWrapRef.current);
    return () => observer.disconnect();
  }, [readOnly, viewMode]);

  const fitToScreen = useCallback(() => {
    if (!widgets.length || !stageWrapRef.current) return;
    const rect = stageWrapRef.current.getBoundingClientRect();
    const vw = stageViewportWidth ?? rect.width;
    if (!vw) return;
    const PADDING = 32;
    const zoom = (vw - PADDING) / occupiedContentWidth;
    setCanvasZoom(Math.max(ZOOM_MIN, Math.min(1, Math.round(zoom * 100) / 100)));
  }, [stageViewportWidth, occupiedContentWidth, widgets.length]);

  // Auto Resize — ปรับขนาดทุก widget ให้พอดีกับ viewport (MIN_GRID_COLS columns)

  useEffect(() => {
    if (viewMode !== 'detail') return;
    if (isNarrowView) return;
    fitToScreen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboardId, viewMode, isNarrowView]);

  // Keep dashboardsRef current for hashchange handler (avoids stale closure)
  useEffect(() => { dashboardsRef.current = dashboards; }, [dashboards]);

  // Track filter panel actual rendered height so canvas can accommodate it
  useEffect(() => {
    const el = filterPanelRef.current;
    if (!el) { setFilterPanelActualPx(null); return; }
    const ro = new ResizeObserver(([entry]) => {
      setFilterPanelActualPx(entry.contentRect.height + WIDGET_VISUAL_INSET * 2);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [filterPanelLayout ? filterPanelLayout.w : null, filterPanelLayout?.orientation]);

  // Init from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#\/([^/]+?)(\/edit)?$/);
    if (!match) return;
    const dashboardId = decodeURIComponent(match[1]);
    const isEdit = !!match[2];
    if (dashboards.find((d) => d.id === dashboardId)) {
      selectDashboard(dashboardId);
      setReadOnly(!isEdit);
      setViewMode('detail');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state → URL hash
  useEffect(() => {
    if (viewMode === 'list') {
      const clean = window.location.pathname + window.location.search;
      if (window.location.hash) window.history.replaceState(null, '', clean);
    } else if (activeDashboardId) {
      const newHash = `#/${encodeURIComponent(activeDashboardId)}${readOnly ? '' : '/edit'}`;
      if (window.location.hash !== newHash) window.history.replaceState(null, '', newHash);
    }
  }, [viewMode, activeDashboardId, readOnly]);

  // Browser back/forward → sync URL hash → state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#') { setViewMode('list'); return; }
      const match = hash.match(/^#\/([^/]+?)(\/edit)?$/);
      if (!match) return;
      const dashboardId = decodeURIComponent(match[1]);
      const isEdit = !!match[2];
      if (dashboardsRef.current.find((d) => d.id === dashboardId)) {
        selectDashboard(dashboardId);
        setReadOnly(!isEdit);
        setViewMode('detail');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return;
      }

      if (key === '=' || key === '+') {
        event.preventDefault();
        setCanvasZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 4) / 4));
        return;
      }

      if (key === '-') {
        event.preventDefault();
        setCanvasZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 4) / 4));
        return;
      }

      if (key === '0') {
        event.preventDefault();
        setCanvasZoom(1);
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

  // Auto Resize — ย้ายมาหลัง setWidgets เพื่อหลีกเลี่ยง "before initialization" error
  const autoResize = useCallback(() => {
    if (!widgets.length || !stageWrapRef.current) return;
    const rect = stageWrapRef.current.getBoundingClientRect();
    const vw = stageViewportWidth ?? rect.width;
    if (!vw) return;
    const viewportCols = Math.floor(vw / GRID_COL_WIDTH) || MIN_GRID_COLS;
    const currentMaxCol = Math.max(...widgets.map((w) => w.x + w.w), 1);
    const scale = Math.min(1, viewportCols / currentMaxCol);
    setWidgets((prev) =>
      prev.map((w) => ({
        ...w,
        x: Math.round(w.x * scale),
        y: w.y,
        w: Math.max(MIN_W, Math.round(w.w * scale)),
        h: w.h,
      }))
    );
    setCanvasZoom(1);
  }, [widgets, stageViewportWidth]);

  // Auto Arrange — bin-packing pack-top
  const autoArrange = useCallback(() => {
    if (!widgets.length || !stageWrapRef.current) return;
    const rect = stageWrapRef.current.getBoundingClientRect();
    const vw = stageViewportWidth ?? rect.width;
    const viewportCols = Math.floor((vw || MIN_GRID_COLS * GRID_COL_WIDTH) / GRID_COL_WIDTH);

    // Filter panel: pin ไว้ที่ (0, 0) เสมอ — widgets จะอยู่ใต้มัน
    const hasFp = Boolean(filterPanelLayout);
    const fpW   = hasFp ? Math.min(filterPanelLayout.w ?? viewportCols, viewportCols) : 0;
    const fpH   = hasFp ? Math.max(2, filterPanelLayout.h ?? 3) : 0;

    // colHeight: บล็อก columns ที่ filter panel ครอง (x=0..fpW, y=0..fpH)
    const colHeight = new Array(viewportCols).fill(0);
    for (let c = 0; c < fpW; c++) colHeight[c] = fpH;

    // Sort ตาม area ใหญ่ก่อน → large widgets ถูกวางก่อน ลด wasted space
    const sorted = [...widgets].sort((a, b) => (b.w * b.h) - (a.w * a.h) || (a.y - b.y));

    // Pass 1: top-left bin-packing
    let packed = sorted.map((w) => {
      const ww = Math.min(w.w, viewportCols);
      let bestX = 0, bestY = Infinity;
      for (let x = 0; x <= viewportCols - ww; x++) {
        const y = Math.max(...colHeight.slice(x, x + ww));
        if (y < bestY) { bestY = y; bestX = x; }
      }
      for (let c = bestX; c < bestX + ww; c++) colHeight[c] = bestY + w.h;
      return { ...w, x: bestX, y: bestY, w: ww };
    });

    // Pass 2: multi-pass iterative gravity (up + left) จนกว่า stable
    // Mutate in-place เพื่อให้แต่ละ widget check overlap กับ positions ล่าสุด
    const hits = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const fpRect = hasFp ? { x: 0, y: 0, w: fpW, h: fpH } : null;

    let changed = true;
    let pass = 0;
    while (changed && pass++ < 40) {
      changed = false;
      for (let i = 0; i < packed.length; i++) {
        const w = packed[i];

        // Pull up
        let ny = w.y;
        while (ny > 0) {
          const c = { ...w, y: ny - 1 };
          if ((fpRect && hits(c, fpRect)) || packed.some((o, j) => j !== i && hits(c, o))) break;
          ny--;
        }

        // Pull left (from already-pulled-up position)
        let nx = w.x;
        while (nx > 0) {
          const c = { ...w, x: nx - 1, y: ny };
          if ((fpRect && hits(c, fpRect)) || packed.some((o, j) => j !== i && hits(c, o))) break;
          nx--;
        }

        if (ny !== w.y || nx !== w.x) {
          packed[i] = { ...w, x: nx, y: ny };
          changed = true;
        }
      }
    }

    const arranged = packed;

    // Update widgets + filter panel position ใน workspace transaction เดียว
    updateWorkspace((prev) => {
      const id = prev.activeDashboardId;
      return {
        ...prev,
        dashboards: prev.dashboards.map((dash) => {
          if (dash.id !== id) return dash;
          return {
            ...dash,
            widgets: arranged,
            ...(hasFp && dash.filterPanel
              ? { filterPanel: { ...dash.filterPanel, x: 0, y: 0, w: fpW, h: fpH } }
              : {})
          };
        })
      };
    });

    setCanvasZoom(1);
  }, [widgets, stageViewportWidth, filterPanelLayout, updateWorkspace]);

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
      const deltaX = (event.clientX - action.startX) / canvasZoom;
      const deltaY = (event.clientY - action.startY) / canvasZoom;
      const snapX = Math.round(deltaX / (cellWidth / GRID_SUBDIVISIONS)) / GRID_SUBDIVISIONS;
      const snapY = Math.round(deltaY / (GRID_ROW_HEIGHT / GRID_SUBDIVISIONS)) / GRID_SUBDIVISIONS;

      if (action.kind === 'marquee') {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const nextBox = normalizeRect({
          x1: (action.startX - rect.left) / canvasZoom - canvasShiftX,
          y1: (action.startY - rect.top) / canvasZoom,
          x2: (event.clientX - rect.left) / canvasZoom - canvasShiftX,
          y2: (event.clientY - rect.top) / canvasZoom
        });
        selectionBoxRef.current = nextBox;
        setSelectionBox(nextBox);
        return;
      }

      if (action.kind === 'move-filter') {
        updateActiveDashboard((dash) => ({
          ...dash,
          filterPanel: {
            ...(dash.filterPanel || { x: 0, y: 0, w: 12, h: 3 }),
            x: Math.max(0, action.origin.x + snapX),
            y: Math.max(0, action.origin.y + snapY)
          }
        }), { recordHistory: false });
        if (snapX !== 0 || snapY !== 0) gestureChangedRef.current = true;
        return;
      }

      if (action.kind === 'resize-filter') {
        updateActiveDashboard((dash) => ({
          ...dash,
          filterPanel: {
            ...(dash.filterPanel || { x: 0, y: 0, w: 12, h: 3 }),
            w: Math.max(5, action.origin.w + snapX),
          }
        }), { recordHistory: false });
        if (snapX !== 0) gestureChangedRef.current = true;
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
              const dir = action.dir || 'se';
              const wDelta = dir.includes('e') ? snapX : dir.includes('w') ? -snapX : 0;
              const xDelta = dir.includes('w') ? snapX : 0;
              const baseHeightPx = action.origin.heightPx || action.origin.h * GRID_ROW_HEIGHT;
              const heightDelta = dir.includes('s') ? deltaY : dir.includes('n') ? -deltaY : 0;
              const nextHeightPx = Math.max(56, baseHeightPx + heightDelta);
              return {
                ...item,
                autoHeight: false,
                x: Math.max(0, action.origin.x + xDelta),
                w: Math.max(MIN_W, action.origin.w + wDelta),
                heightPx: nextHeightPx,
                h: Math.max(MIN_H, Math.ceil(nextHeightPx / GRID_ROW_HEIGHT))
              };
            }

            {
              const dir = action.dir || 'se';
              const wDelta = dir.includes('e') ? snapX : dir.includes('w') ? -snapX : 0;
              const hDelta = dir.includes('s') ? snapY : dir.includes('n') ? -snapY : 0;
              const xDelta = dir.includes('w') ? snapX : 0;
              const yDelta = dir.includes('n') ? snapY : 0;
              const newW = Math.max(MIN_W, action.origin.w + wDelta);
              const newH = Math.max(MIN_H, action.origin.h + hDelta);
              const newX = Math.max(0, action.origin.x + xDelta);
              const newY = Math.max(0, action.origin.y + yDelta);
              return {
                ...item,
                x: newX,
                y: newY,
                w: newW,
                h: newH
              };
            }
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
        (action.kind === 'move' || action.kind === 'move-selection' || action.kind === 'resize' ||
         action.kind === 'move-filter' || action.kind === 'resize-filter')
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

  const onPaletteDragStart = (event, paletteKey) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('widget/type', paletteKey);
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

    const paletteKey = event.dataTransfer.getData('widget/type');
    const template = widgetCatalog.find((item) => (item.paletteKey || item.type) === paletteKey);
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
    setReadOnly(true);
    setViewMode('detail');
    if (window.innerWidth <= 768) setSidebarHidden(true);
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

  const showToast = (message) => {
    setToastMsg(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const activeIsEmpty = !activeDashboard || (activeDashboard.widgets || []).length === 0;

  const createNewDashboard = () => {
    if (readOnly) return;
    if (activeIsEmpty) {
      showToast('ไม่สามารถสร้าง Dashboard ใหม่ได้ — กรุณาเพิ่ม widget ใน canvas ปัจจุบันก่อน');
      return;
    }
    const newDashboard = createDashboard(`Dashboard ${dashboards.length + 1}`, []);
    updateWorkspace((prev) => ({
      dashboards: [...prev.dashboards, newDashboard],
      activeDashboardId: newDashboard.id
    }));
    clearTransientSelectionState();
    setViewMode('detail');
    setReadOnly(false);
  };

  const openNewDashboardDialog = () => {
    if (activeIsEmpty) {
      showToast('ไม่สามารถสร้าง Dashboard ใหม่ได้ — กรุณาเพิ่ม widget ใน canvas ปัจจุบันก่อน');
      return;
    }
    setNewDashboardDraftName(`Dashboard ${dashboards.length + 1}`);
    setNewDashboardDialog(true);
  };

  const confirmNewDashboard = () => {
    const name = newDashboardDraftName.trim() || `Dashboard ${dashboards.length + 1}`;
    const newDb = createDashboard(name, []);
    updateWorkspace((prev) => ({
      dashboards: [...prev.dashboards, newDb],
      activeDashboardId: newDb.id
    }));
    clearTransientSelectionState();
    setNewDashboardDialog(false);
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

  const deleteDashboard = (dashboardId) => {
    if (dashboards.length <= 1) return;

    updateWorkspace((prev) => {
      const remainingDashboards = prev.dashboards.filter((d) => d.id !== dashboardId);
      const nextActiveId = prev.activeDashboardId === dashboardId
        ? remainingDashboards[0].id
        : prev.activeDashboardId;
      return { dashboards: remainingDashboards, activeDashboardId: nextActiveId };
    });
    clearTransientSelectionState();
  };

  const deleteActiveDashboard = () => {
    if (readOnly || dashboards.length <= 1 || !activeDashboard) return;
    deleteDashboard(activeDashboard.id);
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
      <header className="dashboard-list-topbar">
        <div className="dashboard-list-topbar-bg" aria-hidden="true">
          <svg className="dashboard-list-topbar-deco" viewBox="0 0 600 90" fill="none" preserveAspectRatio="xMaxYMid slice">
            <circle cx="520" cy="-10" r="110" fill="rgba(255,255,255,0.07)" />
            <circle cx="420" cy="80" r="70" fill="rgba(255,255,255,0.05)" />
            <circle cx="580" cy="60" r="50" fill="rgba(255,255,255,0.06)" />
          </svg>
        </div>
        <div className="dashboard-list-heading">
          <div className="dashboard-list-heading-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" opacity="0.9"/>
              <rect x="13" y="2" width="9" height="9" rx="2" fill="currentColor" opacity="0.6"/>
              <rect x="2" y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.6"/>
              <rect x="13" y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
          <div>
            <h1>Dashboard List</h1>
            <p>เลือก dashboard เพื่อดูหรือแก้ไข</p>
          </div>
        </div>
        <div className="dashboard-list-header-actions">
          <button type="button" className="dashboard-list-header-btn" onClick={() => listImportRef.current?.click()}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{width:14,height:14,flexShrink:0}}>
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Import
          </button>
          <input ref={listImportRef} type="file" accept="application/json,.json" style={{display:'none'}} onChange={importDashboardFile} />
          <button type="button" className="dashboard-list-header-btn primary" onClick={openNewDashboardDialog}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{width:14,height:14,flexShrink:0}}>
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            New Dashboard
          </button>
        </div>
      </header>

      <main className="dashboard-list-content">
        <section className="dashboard-list-summary">
          <strong>{dashboards.length} dashboards</strong>
          <span>Select a dashboard card to open its detail view.</span>
          <div className="dashboard-list-layout-toggle">
            <button
              type="button"
              className={`layout-toggle-btn${dashboardListLayout === 'card' ? ' active' : ''}`}
              onClick={() => setDashboardListLayout('card')}
              aria-label="Card view"
              title="Card view"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
              </svg>
            </button>
            <button
              type="button"
              className={`layout-toggle-btn${dashboardListLayout === 'list' ? ' active' : ''}`}
              onClick={() => setDashboardListLayout('list')}
              aria-label="List view"
              title="List view"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor"/>
                <rect x="1" y="7" width="14" height="3" rx="1.5" fill="currentColor"/>
                <rect x="1" y="12" width="14" height="3" rx="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </section>

        <div className={`dashboard-list-grid${dashboardListLayout === 'list' ? ' list-view' : ''}`}>
          {dashboardCards.map((dashboard) => (
            <div
              key={dashboard.id}
              className={`dashboard-list-card${dashboard.id === activeDashboardId ? ' active' : ''}`}
              onClick={() => openDashboardDetail(dashboard.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openDashboardDetail(dashboard.id)}
            >
              <div className="dashboard-list-card-thumb-wrap">
                <DashboardMiniMap widgets={dashboard.widgets} />
              </div>
              <div className="dashboard-list-card-body">
                <div className="dashboard-list-card-header">
                  <strong className="dashboard-list-card-name">{dashboard.name}</strong>
                  <span className="dashboard-list-badge">Active</span>
                </div>
                <div className="dashboard-list-meta">
                  <span>{dashboard.widgetCount} widgets{dashboard.hasFilters ? ' · Has filters' : ''}</span>
                </div>
                <div className="dashboard-list-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="dashboard-list-card-action-btn"
                    onClick={() => saveDashboardFile(dashboard)}
                    title="Export JSON"
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Export
                  </button>
                  <button
                    type="button"
                    className="dashboard-list-card-action-btn danger"
                    onClick={() => setConfirmDeleteId(dashboard.id)}
                    disabled={dashboards.length <= 1}
                    title="Remove Dashboard"
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                      <path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Remove
                  </button>
                  <button
                    type="button"
                    className="dashboard-list-card-action-btn icon-only"
                    title="Copy link"
                    onClick={() => {
                      const url = window.location.origin + window.location.pathname + '#/' + encodeURIComponent(dashboard.id);
                      navigator.clipboard?.writeText(url);
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4.5 7l7-3.5M4.5 9l7 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* New Dashboard card */}
          <button type="button" className="dashboard-list-card new-card" onClick={openNewDashboardDialog}>
            <div className="new-card-icon">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M20 12v16M12 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="new-card-label">
              <strong>New Dashboard</strong>
              <span>สร้าง dashboard ใหม่</span>
            </div>
          </button>
        </div>
      </main>

      {/* New Dashboard Dialog */}
      {newDashboardDialog && (
        <div className="new-dashboard-overlay" onClick={() => setNewDashboardDialog(false)}>
          <div className="new-dashboard-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="new-dashboard-dialog-header">
              <div className="new-dashboard-dialog-icon" aria-hidden="true">
                <svg viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.9"/>
                  <rect x="16" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.6"/>
                  <rect x="2" y="16" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.6"/>
                  <rect x="16" y="16" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.3"/>
                </svg>
              </div>
              <div>
                <h2>New Dashboard</h2>
                <p>ตั้งชื่อ dashboard ใหม่ของคุณ</p>
              </div>
              <button type="button" className="new-dashboard-dialog-close" onClick={() => setNewDashboardDialog(false)} aria-label="ปิด">✕</button>
            </div>

            <div className="new-dashboard-dialog-body">
              <label className="new-dashboard-name-label">
                <span>ชื่อ Dashboard</span>
                <input
                  type="text"
                  className="new-dashboard-name-input"
                  value={newDashboardDraftName}
                  onChange={(e) => setNewDashboardDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmNewDashboard(); if (e.key === 'Escape') setNewDashboardDialog(false); }}
                  placeholder="ชื่อ dashboard…"
                  autoFocus
                  maxLength={80}
                />
              </label>
            </div>

            <div className="new-dashboard-dialog-footer">
              <button type="button" className="dashboard-action" onClick={() => setNewDashboardDialog(false)}>ยกเลิก</button>
              <button
                type="button"
                className="dashboard-action primary"
                onClick={confirmNewDashboard}
                disabled={!newDashboardDraftName.trim()}
              >
                สร้าง Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (() => {
        const target = dashboards.find((d) => d.id === confirmDeleteId);
        return (
          <div className="new-dashboard-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="confirm-delete-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-delete-icon" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="20" fill="#fee2e2"/>
                  <path d="M12 14h16M16 14v-2h8v2M14 14v14a2 2 0 002 2h8a2 2 0 002-2V14" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 19v6M23 19v6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="confirm-delete-body">
                <h3>Remove Dashboard</h3>
                <p>ต้องการลบ <strong>"{target?.name}"</strong> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <div className="confirm-delete-footer">
                <button type="button" className="dashboard-action" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                <button
                  type="button"
                  className="dashboard-action danger"
                  onClick={() => { deleteDashboard(confirmDeleteId); setConfirmDeleteId(null); }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  if (viewMode === 'list') {
    return <div className={`app-shell${isEmbedded ? ' embedded' : ''}`}>{renderDashboardListPage()}</div>;
  }

  return (
    <div className={`app-shell${isEmbedded ? ' embedded' : ''}`}>
      <header className={`topbar ${readOnly ? 'read-only' : ''}`}>

        {/* ── Zone 1: Brand ── */}
        <div className="topbar-brand">
          <div className="topbar-brand-logo" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.9"/>
              <rect x="16" y="2" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.6"/>
              <rect x="2" y="16" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.6"/>
              <rect x="16" y="16" width="10" height="10" rx="2.5" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
          <div className="topbar-brand-text">
            <button type="button" className="topbar-back-link" onClick={openDashboardList}>
              ← รายการ Dashboard
            </button>
            <span className="topbar-brand-name">Data Hub Dashboard Builder</span>
          </div>
        </div>

        <div className="topbar-divider" />

        {/* ── Zone 2: Dashboard Selector ── */}
        <div className="topbar-selector">
          <select
            className="dashboard-switcher"
            value={activeDashboardId}
            onChange={(event) => selectDashboard(event.target.value)}
            aria-label="เลือก Dashboard"
            data-tooltip="เลือก Dashboard"
            data-tooltip-dir="down"
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
            placeholder="ชื่อ Dashboard…"
            aria-label="ชื่อ Dashboard"
            data-tooltip="แก้ไขชื่อ Dashboard"
            data-tooltip-dir="down"
            onChange={(event) => renameActiveDashboard(event.target.value)}
          />
        </div>

        <div className="topbar-divider" />

        {/* ── Zone 3: Action Button Groups ── */}
        <div className="topbar-zone3">
          {/* Hamburger button — visible only at narrow viewport */}
          <button
            type="button"
            className={`topbar-hamburger${hamburgerOpen ? ' open' : ''}`}
            onClick={() => setHamburgerOpen((v) => !v)}
            aria-label="เมนู"
            aria-expanded={hamburgerOpen}
          >
            <span /><span /><span />
          </button>

          {/* Dropdown menu — shown when hamburger open (narrow) */}
          {hamburgerOpen && (
            <div className="topbar-hamburger-menu" onClick={() => setHamburgerOpen(false)}>
              <div className="hamburger-menu-group">
                <span className="hamburger-menu-label">Dashboard</span>
                <button type="button" className="hamburger-menu-item" onClick={createNewDashboard}><ToolbarIcon name="plus" /> สร้างใหม่</button>
                <button type="button" className="hamburger-menu-item" onClick={duplicateActiveDashboard}><ToolbarIcon name="copy" /> ทำสำเนา</button>
                <button type="button" className="hamburger-menu-item danger" onClick={deleteActiveDashboard} disabled={dashboards.length <= 1}><ToolbarIcon name="trash" /> ลบ Dashboard</button>
              </div>
              <div className="hamburger-menu-divider" />
              <div className="hamburger-menu-group">
                <span className="hamburger-menu-label">ไฟล์</span>
                <button type="button" className="hamburger-menu-item" onClick={saveActiveDashboardFile}><ToolbarIcon name="save" /> Export JSON</button>
                <button type="button" className="hamburger-menu-item" onClick={openDashboardImportPicker}><ToolbarIcon name="upload" /> Import JSON</button>
              </div>
              <div className="hamburger-menu-divider" />
              <div className="hamburger-menu-group">
                <span className="hamburger-menu-label">ส่งออก</span>
                <button type="button" className="hamburger-menu-item" onClick={printActiveDashboard}><ToolbarIcon name="print" /> พิมพ์</button>
                <button type="button" className="hamburger-menu-item" onClick={downloadActiveDashboardPdf}><ToolbarIcon name="download" /> ดาวน์โหลด PDF</button>
              </div>
            </div>
          )}

          {/* Full button groups — visible at wide viewport */}
          <div className="topbar-btn-groups">
            {/* Group A: Manage */}
            <div className="topbar-btn-group">
              <button type="button" className="dashboard-action icon-only" onClick={createNewDashboard} aria-label="สร้าง Dashboard ใหม่" data-tooltip="สร้างใหม่" data-tooltip-dir="down">
                <ToolbarIcon name="plus" />
              </button>
              <button type="button" className="dashboard-action icon-only" onClick={duplicateActiveDashboard} aria-label="ทำสำเนา" data-tooltip="ทำสำเนา" data-tooltip-dir="down">
                <ToolbarIcon name="copy" />
              </button>
              <button
                type="button"
                className="dashboard-action danger icon-only"
                onClick={deleteActiveDashboard}
                disabled={dashboards.length <= 1}
                aria-label="ลบ Dashboard"
                data-tooltip="ลบ Dashboard"
                data-tooltip-dir="down"
              >
                <ToolbarIcon name="trash" />
              </button>
            </div>

            <div className="topbar-btn-sep" />

            {/* Group B: File I/O */}
            <div className="topbar-btn-group">
              <button type="button" className="dashboard-action icon-only" onClick={saveActiveDashboardFile} aria-label="Export JSON" data-tooltip="Export JSON" data-tooltip-dir="down">
                <ToolbarIcon name="save" />
              </button>
              <button type="button" className="dashboard-action icon-only" onClick={openDashboardImportPicker} aria-label="Import JSON" data-tooltip="Import JSON" data-tooltip-dir="down">
                <ToolbarIcon name="upload" />
              </button>
              <input ref={importFileInputRef} className="dashboard-file-input" type="file" accept="application/json,.json" onChange={importDashboardFile} />
            </div>

            <div className="topbar-btn-sep" />

            {/* Group C: Output */}
            <div className="topbar-btn-group">
              <button type="button" className="dashboard-action icon-only" onClick={printActiveDashboard} aria-label="พิมพ์" data-tooltip="พิมพ์ (Print)" data-tooltip-dir="down">
                <ToolbarIcon name="print" />
              </button>
              <button type="button" className="dashboard-action icon-only" onClick={downloadActiveDashboardPdf} aria-label="ดาวน์โหลด PDF" data-tooltip="ดาวน์โหลด PDF" data-tooltip-dir="down">
                <ToolbarIcon name="download" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Zone 4: View Controls (right) ── */}
        <div className="topbar-view-controls">
          {readOnly && (
            <>
              <div className="topbar-btn-group">
                <button type="button" className="dashboard-action icon-only" onClick={saveActiveDashboardFile} aria-label="Export JSON" data-tooltip="Export JSON" data-tooltip-dir="down">
                  <ToolbarIcon name="save" />
                </button>
                <button type="button" className="dashboard-action icon-only" onClick={openDashboardImportPicker} aria-label="Import JSON" data-tooltip="Import JSON" data-tooltip-dir="down">
                  <ToolbarIcon name="upload" />
                </button>
                <input ref={importFileInputRef} className="dashboard-file-input" type="file" accept="application/json,.json" onChange={importDashboardFile} />
                <button type="button" className="dashboard-action icon-only" onClick={downloadActiveDashboardPdf} aria-label="Save as PDF" data-tooltip="Save as PDF" data-tooltip-dir="down">
                  <ToolbarIcon name="download" />
                </button>
              </div>
              <div className="topbar-divider" />
            </>
          )}
          {!isNarrowView && (
            <>
              <div className="zoom-controls" data-tooltip="Ctrl+Scroll หรือ Ctrl+/−" data-tooltip-dir="down">
                <button
                  type="button"
                  className="zoom-btn"
                  onClick={() => setCanvasZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 4) / 4))}
                  disabled={canvasZoom <= ZOOM_MIN}
                  aria-label="Zoom out"
                >−</button>
                <button
                  type="button"
                  className="zoom-level"
                  onClick={() => setCanvasZoom(1)}
                  aria-label="Reset zoom"
                  data-tooltip="คลิกเพื่อ Reset เป็น 100%"
                  data-tooltip-dir="down"
                >{Math.round(canvasZoom * 100)}%</button>
                <button
                  type="button"
                  className="zoom-btn"
                  onClick={() => setCanvasZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 4) / 4))}
                  disabled={canvasZoom >= ZOOM_MAX}
                  aria-label="Zoom in"
                >+</button>
              </div>
              <button
                type="button"
                className="zoom-btn fit-screen-btn"
                onClick={fitToScreen}
                aria-label="Fit to Screen"
                data-tooltip="Fit to Screen"
                data-tooltip-dir="down"
              >
                <ToolbarIcon name="fitScreen" />
              </button>
              {/* Auto Resize */}
              <button
                type="button"
                className="zoom-btn fit-screen-btn"
                onClick={autoResize}
                aria-label="Auto Resize"
                data-tooltip="Auto Resize — ปรับขนาด widget ให้พอดีหน้าจอ"
                data-tooltip-dir="down"
                disabled={readOnly}
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="7" height="7" rx="1.5"/>
                  <rect x="11" y="2" width="7" height="7" rx="1.5"/>
                  <rect x="2" y="11" width="7" height="7" rx="1.5"/>
                  <rect x="11" y="11" width="7" height="7" rx="1.5"/>
                  <path d="M5.5 5.5h1M13.5 5.5h1M5.5 14.5h1M13.5 14.5h1" strokeWidth="2"/>
                </svg>
              </button>
              {/* Auto Arrange */}
              <button
                type="button"
                className="zoom-btn fit-screen-btn"
                onClick={autoArrange}
                aria-label="Auto Arrange"
                data-tooltip="Auto Arrange — จัดเรียง widget อัตโนมัติไม่ให้ overlap"
                data-tooltip-dir="down"
                disabled={readOnly}
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="7" height="4" rx="1"/>
                  <rect x="11" y="2" width="7" height="4" rx="1"/>
                  <rect x="2" y="8" width="16" height="4" rx="1"/>
                  <rect x="2" y="14" width="10" height="4" rx="1"/>
                  <rect x="14" y="14" width="4" height="4" rx="1"/>
                </svg>
              </button>
              <div className="topbar-divider" />
            </>
          )}
          <button
            type="button"
            className="sidebar-toggle icon-only"
            onClick={() => setSidebarHidden((prev) => !prev)}
            aria-label={sidebarHidden ? 'แสดง Palette' : 'ซ่อน Palette'}
            data-tooltip={sidebarHidden ? 'แสดง Palette' : 'ซ่อน Palette'}
            data-tooltip-dir="down"
            disabled={readOnly}
          >
            <ToolbarIcon name="sidebar" />
          </button>
          <button
            type="button"
            className={`mode-toggle icon-only ${readOnly ? '' : 'active-edit'}`}
            onClick={() => {
              const goingToEdit = readOnly;
              setReadOnly((prev) => !prev);
              if (goingToEdit && window.innerWidth <= 768) setSidebarHidden(true);
            }}
            aria-label={readOnly ? 'เข้าสู่โหมดแก้ไข' : 'ดูตัวอย่าง'}
            data-tooltip={readOnly ? 'เข้าสู่โหมดแก้ไข' : 'ดูตัวอย่าง'}
            data-tooltip-dir="down"
          >
            <ToolbarIcon name={readOnly ? 'edit' : 'preview'} />
          </button>
          <button
            type="button"
            className="wizard-help-btn"
            onClick={openWizard}
            aria-label="คู่มือการใช้งาน"
            data-tooltip="คู่มือการใช้งาน"
            data-tooltip-dir="down"
          >
            <ToolbarIcon name="help" />
          </button>
        </div>

      </header>

      {wizardOpen && <WizardOnboarding onClose={closeWizard} />}

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
                            key={item.paletteKey || item.type}
                            type="button"
                            className="palette-item palette-item-ready"
                            draggable={!readOnly}
                            disabled={readOnly}
                            onDragStart={(event) => onPaletteDragStart(event, item.paletteKey || item.type)}
                          >
                            <span className="palette-item-thumb" aria-hidden="true">
                              <PaletteWidgetThumbnail type={item.type} />
                            </span>
                            <span className="palette-item-text">
                              <strong>{item.label}</strong>
                              {item.description ? <small>{item.description}</small> : null}
                            </span>
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
                            key={item.paletteKey || item.type}
                            type="button"
                            className="palette-item"
                            draggable={!readOnly}
                            disabled={readOnly}
                            onDragStart={(event) => onPaletteDragStart(event, item.paletteKey || item.type)}
                          >
                            <span className="palette-item-thumb" aria-hidden="true">
                              <PaletteWidgetThumbnail type={item.type} />
                            </span>
                            <span className="palette-item-text">
                              <strong>{item.label}</strong>
                              {item.description ? <small>{item.description}</small> : null}
                            </span>
                          </button>
                      ))}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </aside>

        <div
          ref={stageWrapRef}
          className={`dashboard-stage-wrap ${readOnly ? 'read-only' : ''} ${isNarrowView ? 'narrow-wrap' : ''}`}
          style={readOnly ? { width: '100%' } : undefined}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setCanvasZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round((z + delta) * 4) / 4)));
          }}
        >
        <div
          className={`dashboard-stage ${readOnly ? 'read-only' : ''} ${isNarrowView ? 'narrow' : ''}`}
          style={{
            width: readOnly && !isNarrowView ? `${occupiedContentWidth * canvasZoom}px` : undefined,
            height: readOnly && !isNarrowView ? `${canvasHeight * canvasZoom}px` : undefined,
          }}
        >
          <div
            className="canvas-zoom-wrap"
            style={isNarrowView ? undefined : {
              width: readOnly ? `${occupiedContentWidth * canvasZoom}px` : `${canvasContentWidth * canvasZoom}px`,
              height: `${canvasHeight * canvasZoom}px`,
              flexShrink: 0,
            }}
          >
          <main
            ref={canvasRef}
            className={`dashboard-canvas ${readOnly ? 'read-only' : ''} ${isNarrowView ? 'narrow-flow' : ''}`}
            style={isNarrowView ? {
              position: 'relative',
              height: 'auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              backgroundImage: 'none',
              overflow: 'visible',
            } : {
              '--grid-cols': canvasCols,
              '--row-size': `${GRID_ROW_HEIGHT}px`,
              '--canvas-height': `${canvasHeight}px`,
              '--canvas-width': `${canvasContentWidth}px`,
              '--canvas-side-pad': `${canvasShiftX}px`,
              '--print-scale': printScale,
              transform: canvasZoom !== 1 ? `scale(${canvasZoom})` : undefined,
              transformOrigin: '0 0',
              width: readOnly ? `${occupiedContentWidth}px` : undefined,
              justifySelf: readOnly ? 'start' : undefined,
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
                  left: hoverGrid.x * cellWidth + canvasShiftX + WIDGET_VISUAL_INSET,
                  top: hoverGrid.y * GRID_ROW_HEIGHT + WIDGET_VISUAL_INSET,
                  width: cellWidth * 4 - WIDGET_VISUAL_INSET * 2,
                  height: GRID_ROW_HEIGHT * 4 - WIDGET_VISUAL_INSET * 2
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

            {displayWidgets.map((widget) => {
              const baseDataset = datasetLibrary[widget.dataset];
              // Inject API-fetched fixedProfile into miceStatistics dataset,
              // merging only the keys that were successfully fetched (non-null).
              const dataset = (widget.dataset === 'miceStatistics' && miceApiFixedProfile)
                ? {
                    ...baseDataset,
                    fixedProfile: (() => {
                      const merged = {
                        ...(baseDataset?.fixedProfile || {}),
                        ...miceApiFixedProfile,
                        charts: {
                          ...(baseDataset?.fixedProfile?.charts || {}),
                          ...(miceApiFixedProfile.charts || {}),
                        },
                        chartsQuarterly: {
                          ...(baseDataset?.fixedProfile?.chartsQuarterly || {}),
                          ...(miceApiFixedProfile.chartsQuarterly || {}),
                        },
                      };
                      // Keep sampleData fallback for any key the API returned null for
                      Object.keys(merged).forEach((k) => {
                        if (merged[k] === null) merged[k] = baseDataset?.fixedProfile?.[k];
                      });
                      return merged;
                    })()
                  }
                : baseDataset;
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
                  {!TEXT_WIDGET_TYPES.includes(widget.type) ? (
                    <button
                      type="button"
                      className="icon-button config-toggle"
                      aria-label="Widget settings"
                      title="Settings"
                      onClick={() => setActiveConfigWidgetId(widget.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{width:16,height:16}}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
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
                  style={isNarrowView ? {
                    position: 'relative',
                    left: 'auto',
                    top: 'auto',
                    width: '100%',
                    height: isTextboxWidget ? 'auto' : `${Math.max(200, widget.h * GRID_ROW_HEIGHT)}px`,
                    minHeight: isTextboxWidget ? undefined : `${Math.max(200, widget.h * GRID_ROW_HEIGHT)}px`,
                    flexShrink: 0,
                  } : {
                    left: widget.x * cellWidth + canvasShiftX + WIDGET_VISUAL_INSET,
                    top: widget.y * GRID_ROW_HEIGHT + WIDGET_VISUAL_INSET,
                    width: widget.w * cellWidth - WIDGET_VISUAL_INSET * 2,
                    height:
                      (widget.type === 'textbox'
                        ? widget.heightPx ?? widget.h * GRID_ROW_HEIGHT
                        : widget.h * GRID_ROW_HEIGHT) - WIDGET_VISUAL_INSET * 2
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
                          <strong className="widget-title-label">{widget.title}</strong>
                          <small className="widget-type-label">{toKebabLabel(widget.type)}</small>
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
                    <WidgetRenderer
                      widget={widget}
                      dataset={dataset}
                      records={widgetRecords}
                      isPreview={isWidgetPreview}
                      isSkeleton={NO_CONFIG_WIDGET_TYPES.includes(widget.type) && miceApiStatus === 'loading'}
                      globalFilter={activeDashboardFilters}
                    />
                  </div>
                </div>

                {!readOnly ? (['n','ne','e','se','s','sw','w','nw']).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    aria-label={`Resize widget ${dir}`}
                    className="resize-handle"
                    data-dir={dir}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      gestureSnapshotRef.current = cloneWorkspace(workspace);
                      gestureChangedRef.current = false;
                      setAction({
                        kind: 'resize',
                        dir,
                        id: widget.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: {
                          x: widget.x,
                          y: widget.y,
                          w: widget.w,
                          h: widget.h,
                          heightPx: widget.heightPx || widget.h * GRID_ROW_HEIGHT
                        }
                      });
                    }}
                  />
                )) : null}
              </section>
            );
          })}

          {filterPanelLayout && activeDashboardFilters ? (() => {
            const fp = filterPanelLayout;
            const fpOrientation = fp.orientation || 'horizontal';
            const fpStyle = isNarrowView ? {
              position: 'relative',
              order: -1,
              borderRadius: '16px',
            } : {
              position: 'absolute',
              left: fp.x * cellWidth + canvasShiftX + WIDGET_VISUAL_INSET,
              top: fp.y * GRID_ROW_HEIGHT + WIDGET_VISUAL_INSET,
              width: fp.w * cellWidth - WIDGET_VISUAL_INSET * 2,
              zIndex: 10,
            };
            return (
              <section
                ref={filterPanelRef}
                className={`dashboard-filters on-canvas ${fpOrientation} ${!readOnly ? 'editable' : ''}`}
                style={fpStyle}
              >
                {!readOnly ? (
                  <div
                    className="filter-drag-handle drag-handle"
                    onMouseDown={(event) => {
                      if (isInteractiveTarget(event.target)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      gestureSnapshotRef.current = cloneWorkspace(workspace);
                      gestureChangedRef.current = false;
                      setAction({
                        kind: 'move-filter',
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { x: fp.x, y: fp.y }
                      });
                    }}
                  >
                    <div className="filter-drag-handle-text">
                      <strong>Filters</strong>
                      <span>ควบคุม market และช่วงปีสำหรับทุก widget</span>
                    </div>
                    <button
                      type="button"
                      className="filter-orientation-btn"
                      title={fpOrientation === 'horizontal' ? 'เปลี่ยนเป็น vertical' : 'เปลี่ยนเป็น horizontal'}
                      onClick={(event) => {
                        event.stopPropagation();
                        updateActiveDashboard((dash) => ({
                          ...dash,
                          filterPanel: {
                            ...(dash.filterPanel || { x: 0, y: 0, w: 12, h: 3 }),
                            orientation: fpOrientation === 'horizontal' ? 'vertical' : 'horizontal'
                          }
                        }));
                      }}
                    >
                      {fpOrientation === 'horizontal' ? (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <line x1="4" y1="2" x2="4" y2="14"/><line x1="8" y1="2" x2="8" y2="14"/><line x1="12" y1="2" x2="12" y2="14"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="dashboard-filters-header">
                    <div className="filter-header-label">
                      <strong>Filters</strong>
                      <span>ควบคุม market และช่วงปีสำหรับทุก widget</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {/* Reload — ⟳ */}
                      <button
                        type="button"
                        className="filter-icon-btn"
                        title="Reload widget data (bypass cache)"
                        onClick={() => {
                          setMiceApiFixedProfile(null);
                          setRefreshKey((k) => k + 1);
                        }}
                      >
                        <svg viewBox="0 0 20 20" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16.5 10A6.5 6.5 0 1 1 12 4.07" />
                          <path d="M12 1v4.5h4.5" />
                        </svg>
                      </button>
                      {/* Clear Filters — eraser */}
                      <button
                        type="button"
                        className="filter-icon-btn"
                        title="Clear filters"
                        onClick={clearActiveDashboardFilters}
                      >
                        <svg viewBox="0 0 20 20" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 16h14" />
                          <path d="M9 16 4.5 11.5a1.4 1.4 0 0 1 0-2L12 2l5.5 5.5-7 7-1.5.5z" />
                          <path d="M12 2l5.5 5.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                <div className="dashboard-filters-grid">
                  {/* Market + Year Basis — side by side 2 columns */}
                  <div className="filter-row-two-col">
                    <div className="filter-button-group">
                      <span>Market</span>
                      <div className="filter-toggle-row">
                        {['International', 'Domestic'].map((option) => {
                          const cur = activeDashboardFilters.market;
                          const isActive = cur === option || cur === 'all';
                          return (
                            <button
                              key={option}
                              type="button"
                              className={isActive ? 'active' : ''}
                              onClick={() => {
                                if (cur === 'all') {
                                  // ยกเลิก option นี้ → เหลืออีกตัว
                                  updateActiveDashboardFilters({ market: option === 'International' ? 'Domestic' : 'International' });
                                } else if (cur === option) {
                                  // คลิกซ้ำตัวเดิม → เลือกทั้งคู่ (all)
                                  updateActiveDashboardFilters({ market: 'all' });
                                } else {
                                  // เลือก option ใหม่ขณะอีกตัวแอคทีฟ → เลือกทั้งคู่
                                  updateActiveDashboardFilters({ market: 'all' });
                                }
                              }}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="filter-button-group">
                      <span>Year Basis</span>
                      <div className="filter-toggle-row">
                        {[
                          { value: 'calendar', label: 'Calendar' },
                          { value: 'fiscal', label: 'Fiscal' }
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
                  </div>
                  {/* Year Range */}
                  <div className="filter-button-group" style={{ flex: '2' }}>
                    <span>Year Range</span>
                    <YearRangeSlider
                      minYear={MICE_FILTER_OPTIONS.years[0] || 2007}
                      maxYear={MICE_FILTER_OPTIONS.years[MICE_FILTER_OPTIONS.years.length - 1] || 2025}
                      valueMin={activeDashboardFilters.yearMin ?? 2007}
                      valueMax={activeDashboardFilters.yearMax ?? 2025}
                      onChange={(min, max) => updateActiveDashboardFilters({ yearMin: min, yearMax: max })}
                    />
                  </div>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label="Resize filter panel"
                    className="resize-handle"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      gestureSnapshotRef.current = cloneWorkspace(workspace);
                      gestureChangedRef.current = false;
                      setAction({
                        kind: 'resize-filter',
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { w: fp.w }
                      });
                    }}
                  />
                ) : null}
              </section>
            );
          })() : null}
        </main>
          </div>
      </div>
      </div>
      </div>

      {activeConfigWidget ? (
        <div className="modal-backdrop" onClick={() => setActiveConfigWidgetId(null)}>
          <div className="config-modal" onClick={(event) => event.stopPropagation()}>
            <div className="config-modal-header">
              <div>
                <h2>Widget Settings</h2>
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
                ×
              </button>
            </div>

            <div className="config-modal-body">
              {TEXT_WIDGET_TYPES.includes(activeConfigWidget.type) ? (
                renderTextWidgetControls(activeConfigWidget)
              ) : (
                <>
                  <div className="config-title-row">
                    <label className="config-title-label" htmlFor="cfg-widget-title">Widget Name</label>
                    <input
                      id="cfg-widget-title"
                      type="text"
                      className="config-title-input"
                      value={activeConfigWidget.title}
                      onChange={(e) => updateWidgetField(activeConfigWidget.id, 'title', e.target.value)}
                      autoFocus
                    />
                  </div>
                  {hasConfigPopup(activeConfigWidget.type) ? renderMappingControls(activeConfigWidget, activeConfigDataset) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Toast notification ── */}
      {toastMsg && (
        <div className="app-toast" role="alert">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="10" cy="10" r="8"/>
            <line x1="10" y1="6" x2="10" y2="10.5"/>
            <circle cx="10" cy="14" r="0.5" fill="currentColor" stroke="none"/>
          </svg>
          <span>{toastMsg}</span>
          <button type="button" className="app-toast-close" onClick={() => setToastMsg(null)}>×</button>
        </div>
      )}
    </div>
  );
}
