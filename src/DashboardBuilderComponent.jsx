/**
 * DashboardBuilderComponent
 * ─────────────────────────
 * Exportable React component สำหรับ embed ใน host app (เช่น tceb-web)
 * โดยไม่ต้องใช้ iframe — ใช้ CSS scoped ผ่าน .dashboard-builder-root
 *
 * Usage ใน tceb-web:
 *   import DashboardBuilder from '@custom-dashboard/DashboardBuilderComponent';
 *   <DashboardBuilder apiBaseUrl="https://..." />
 */
import React, { useEffect } from 'react';
import App from './App';
import './styles/app-scoped.css';

/**
 * @param {object} props
 * @param {string} [props.apiBaseUrl]     - override API endpoint (optional)
 * @param {boolean} [props.useSampleData] - force sample data mode (optional)
 */
export default function DashboardBuilder({ apiBaseUrl, useSampleData }) {
  // ── Inject runtime config overrides so App's apiConfig.js picks them up ──
  useEffect(() => {
    if (apiBaseUrl) {
      window.__DASHBOARD_API_BASE_URL__ = apiBaseUrl;
    }
    if (useSampleData !== undefined) {
      window.__DASHBOARD_USE_SAMPLE_DATA__ = useSampleData;
    }
    return () => {
      delete window.__DASHBOARD_API_BASE_URL__;
      delete window.__DASHBOARD_USE_SAMPLE_DATA__;
    };
  }, [apiBaseUrl, useSampleData]);

  return (
    <div className="dashboard-builder-root">
      <App />
    </div>
  );
}
