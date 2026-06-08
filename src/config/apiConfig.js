// API configuration
// Priority order:
//   1. window.__DASHBOARD_API_BASE_URL__  — runtime override จาก host app (tceb-web)
//   2. import.meta.env.VITE_API_BASE_URL  — Vite dev/build (.env.local)
//   3. process.env.REACT_APP_CUSTOM_DASHBOARD_API_URL — CRA/webpack host (tceb-web)
//   4. fallback localhost

// ── Helper: อ่าน Vite env โดยไม่ให้ webpack หรือ babel throw ──────────────
// webpack 5 เข้าใจ import.meta แต่ไม่ set .env → ค่าเป็น undefined (ไม่ error)
// guard ด้วย try/catch เป็น extra safety สำหรับ bundler รุ่นเก่า
function _viteEnv(key) {
  try {
    // eslint-disable-next-line no-undef
    return typeof import.meta !== 'undefined' ? import.meta.env?.[key] : undefined;
  } catch (_) {
    return undefined;
  }
}

export const API_BASE_URL =
  (typeof window !== 'undefined' && window.__DASHBOARD_API_BASE_URL__) ||
  _viteEnv('VITE_API_BASE_URL') ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_CUSTOM_DASHBOARD_API_URL) ||
  'https://localhost:7139';

export const WIDGET_ENDPOINT = (widgetKey) =>
  `${API_BASE_URL}/datasource/widget/${widgetKey}`;

// Data source flag — set VITE_USE_SAMPLE_DATA=true in .env.local to skip API calls
export const USE_SAMPLE_DATA =
  (typeof window !== 'undefined' && window.__DASHBOARD_USE_SAMPLE_DATA__ === true) ||
  _viteEnv('VITE_USE_SAMPLE_DATA') === 'true' ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_CUSTOM_DASHBOARD_SAMPLE_DATA === 'true');

// Spark concurrency limit (protect backend)
export const SPARK_CONCURRENCY =
  parseInt(
    _viteEnv('VITE_SPARK_CONCURRENCY') ||
    (typeof process !== 'undefined' && process.env?.REACT_APP_SPARK_CONCURRENCY) ||
    '2',
    10
  );
