/**
 * DashboardBuilderComponent
 * ─────────────────────────
 * Exportable React component สำหรับ embed ใน host app (เช่น tceb-web)
 * โดยไม่ต้องใช้ iframe — ใช้ CSS scoped ผ่าน .dashboard-builder-root
 *
 * Usage ใน tceb-web:
 *   import DashboardBuilder from '@custom-dashboard/DashboardBuilderComponent';
 *
 *   // ปกติไม่ต้องส่ง token — component อ่านจาก sessionStorage['accessToken'] เอง (tceb-web)
 *   <DashboardBuilder apiBaseUrl="https://..." />
 *
 *   // host อื่นที่เก็บ token คนละ key:
 *   <DashboardBuilder apiBaseUrl="https://..." authTokenKey="myAccessToken" />
 */
import React, { useEffect } from 'react';
import App from './App';
import { LangProvider } from './i18n';
import './styles/app-scoped.css';

// ── Host offset sync ─────────────────────────────────────────────────
// ปกติเมื่อ embed ใน host app (เช่น tceb-web) topbar + palette เป็น position:fixed
// จะเจอทับกับ nav ของ host หรือ overflow ตอน resize/reload/mobile menu
// hook นี้ตรวจ host header/footer แล้ว set CSS variables ใน root
// (--cd-topbar-top, --cd-palette-top, --cd-palette-maxh) — CSS scoped ของ builder
// ใช้ค่านี้เป็น top/max-height โดยอัตโนมัติ
//
// props: hostHeaderSelector, hostFooterSelector (default ตรงกับ tceb-web แต่ override ได้)
const TOPBAR_GAP = 12;
const PALETTE_OFFSET = 88;

function useHostOffsetSync({ hostHeaderSelector, hostFooterSelector }) {
  useEffect(() => {
    // standalone (window.top === window.self && no host header selector) → CSS default ทำงานปกติ
    // แต่ก็ยังรันได้ปลอดภัย (query ไม่เจอ → navBottom=0 → เท่ากับ default)
    let rafId = null;
    let resizeObserver = null;
    let mutationObserver = null;

    const update = () => {
      const nav = hostHeaderSelector ? document.querySelector(hostHeaderSelector) : null;
      const footer = hostFooterSelector ? document.querySelector(hostFooterSelector) : null;
      const root = document.documentElement;

      const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
      const paletteBottom = Math.min(window.innerHeight - 16, footerTop - 16);
      const paletteTop = navBottom + PALETTE_OFFSET;
      const paletteMaxH = Math.max(120, paletteBottom - paletteTop);

      root.style.setProperty('--cd-topbar-top', `${navBottom + TOPBAR_GAP}px`);
      root.style.setProperty('--cd-palette-top', `${paletteTop}px`);
      root.style.setProperty('--cd-palette-maxh', `${paletteMaxH}px`);
    };

    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    // scroll + resize
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    // ResizeObserver: nav/footer เปลี่ยนขนาดโดยไม่ resize window (mobile menu, sticky toggle)
    const attachRO = () => {
      if (!resizeObserver) return;
      const nav = hostHeaderSelector ? document.querySelector(hostHeaderSelector) : null;
      const footer = hostFooterSelector ? document.querySelector(hostFooterSelector) : null;
      try { if (nav) resizeObserver.observe(nav); } catch (_) { /* already */ }
      try { if (footer) resizeObserver.observe(footer); } catch (_) { /* already */ }
    };
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      attachRO();
    }

    // MutationObserver: nav/footer เกิดหลัง Suspense/route change → re-attach + re-measure
    mutationObserver = new MutationObserver(() => {
      attachRO();
      scheduleUpdate();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Initial: หลาย frame เพื่อรอ layout stabilize (Suspense fallback → real content)
    update();
    requestAnimationFrame(update);
    requestAnimationFrame(() => requestAnimationFrame(update));
    if (document.fonts?.ready) document.fonts.ready.then(scheduleUpdate).catch(() => {});
    window.addEventListener('load', scheduleUpdate, { once: true });

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('load', scheduleUpdate);
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, [hostHeaderSelector, hostFooterSelector]);
}

/**
 * @param {object} props
 * @param {string} [props.apiBaseUrl]     - override API endpoint (optional)
 * @param {string} [props.authToken]      - inject Bearer token ตรงๆ (optional; ปกติไม่ต้อง — อ่านจาก storage เอง)
 * @param {string} [props.authTokenKey]   - sessionStorage/localStorage key ของ token (default 'accessToken')
 * @param {boolean} [props.useSampleData] - force sample data mode (optional)
 * @param {string} [props.hostHeaderSelector] - CSS selector ของ host nav ที่ topbar/palette ต้องเลี่ยง (default '.main-header' สำหรับ tceb-web)
 * @param {string} [props.hostFooterSelector] - CSS selector ของ host footer ที่ palette ต้องไม่ทับ (default '.footer-contact' สำหรับ tceb-web)
 */
export default function DashboardBuilder({
  apiBaseUrl,
  authToken,
  authTokenKey,
  useSampleData,
  hostHeaderSelector = '.main-header',
  hostFooterSelector = '.footer-contact',
}) {
  // ── Inject runtime config overrides so App's apiConfig.js / dashboardApi.js pick them up ──
  useEffect(() => {
    if (apiBaseUrl) {
      window.__DASHBOARD_API_BASE_URL__ = apiBaseUrl;
    }
    // ปกติไม่ต้อง inject token — dashboardApi.getAuthToken() อ่านจาก storage เอง (fresh ทุก request)
    // ส่ง authToken มาเฉพาะกรณีต้อง override เท่านั้น
    if (authToken) {
      window.__DASHBOARD_AUTH_TOKEN__ = authToken;
    }
    if (authTokenKey) {
      window.__DASHBOARD_AUTH_TOKEN_KEY__ = authTokenKey;
    }
    if (useSampleData !== undefined) {
      window.__DASHBOARD_USE_SAMPLE_DATA__ = useSampleData;
    }
    return () => {
      delete window.__DASHBOARD_API_BASE_URL__;
      delete window.__DASHBOARD_AUTH_TOKEN__;
      delete window.__DASHBOARD_AUTH_TOKEN_KEY__;
      delete window.__DASHBOARD_USE_SAMPLE_DATA__;
    };
  }, [apiBaseUrl, authToken, authTokenKey, useSampleData]);

  // sync topbar/palette กับ host nav/footer อัตโนมัติ (embedded mode — standalone จะไม่เจอ selector, ค่าเป็น 0 = ok)
  useHostOffsetSync({ hostHeaderSelector, hostFooterSelector });

  return (
    <div className="dashboard-builder-root">
      <LangProvider>
        <App />
      </LangProvider>
    </div>
  );
}
