# tceb-dashboard-builder

MICE Data Hub Dashboard Builder — React component สำหรับสร้างและแสดงผล dashboard แบบ drag-and-drop
ใช้งานได้สองแบบ: (1) Standalone SPA และ (2) Embedded npm package ใน host app

---

## สารบัญ

- [ติดตั้งใน Host App](#ติดตั้งใน-host-app)
- [Props](#props)
- [การตั้งค่า API URL](#การตั้งค่า-api-url)
- [การตั้งค่า CSS และ Layout Offset](#การตั้งค่า-css-และ-layout-offset)
- [Z-index Reference](#z-index-reference)
- [Local Development](#local-development)
- [Build & Pack](#build--pack)
- [Project Ecosystem](#project-ecosystem)

---

## ติดตั้งใน Host App

### 1. รับไฟล์ .tgz

ขอไฟล์ `tceb-dashboard-builder-x.x.x.tgz` จากทีม custom-dashboard แล้วนำไปวางใน root ของ host project

### 2. ติดตั้ง package

```bash
# ลบ cache เก่าก่อน (สำคัญเมื่ออัปเดต version)
rm -rf node_modules/tceb-dashboard-builder

npm install ./tceb-dashboard-builder-1.0.2.tgz
```

**Peer dependencies** ที่ host app ต้องมีอยู่แล้ว:

```json
{ "react": ">=18", "react-dom": ">=18" }
```

> `recharts`, `jspdf`, `html2canvas` — bundled มาพร้อม package แล้ว ไม่ต้องติดตั้งแยก

### 3. ตั้งค่า API URL ใน .env

```env
# .env.development
REACT_APP_CUSTOM_DASHBOARD_API_URL=https://localhost:7139

# .env.production
REACT_APP_CUSTOM_DASHBOARD_API_URL=https://your-api.example.com
```

### 4. สร้าง Page component

สร้างไฟล์ `CustomDashboardPage.js` และ `CustomDashboardPage.css`:

**`CustomDashboardPage.js`**

```jsx
import React, { Suspense, lazy, useEffect } from 'react';
import './CustomDashboardPage.css';

const DashboardBuilder = lazy(() => import('tceb-dashboard-builder'));

const API_BASE_URL = process.env.REACT_APP_CUSTOM_DASHBOARD_API_URL;

// ──────────────────────────────────────────────────────────────
// Hook: ติดตาม nav bottom แบบ real-time ผ่าน CSS variables
// ปรับ selector ให้ตรงกับ nav จริงของ host app
// ──────────────────────────────────────────────────────────────
const NAV_SELECTOR    = '.main-header';    // ← ปรับตาม host app
const FOOTER_SELECTOR = '.footer-contact'; // ← ปรับตาม host app (หรือ null)

function useDashboardOffset() {
  useEffect(() => {
    let rafId = null;
    const update = () => {
      const nav    = document.querySelector(NAV_SELECTOR);
      const footer = document.querySelector(FOOTER_SELECTOR);
      const root   = document.documentElement;
      const navBottom    = nav    ? Math.max(0, nav.getBoundingClientRect().bottom)    : 0;
      const footerTop    = footer ? footer.getBoundingClientRect().top                  : window.innerHeight;
      const paletteTop   = navBottom + 88;
      const paletteMaxH  = Math.max(120, Math.min(window.innerHeight - 16, footerTop - 16) - paletteTop);
      root.style.setProperty('--cd-topbar-top',   `${navBottom + 12}px`);
      root.style.setProperty('--cd-palette-top',  `${paletteTop}px`);
      root.style.setProperty('--cd-palette-maxh', `${paletteMaxH}px`);
    };
    const onScroll = () => { if (rafId) cancelAnimationFrame(rafId); rafId = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); if (rafId) cancelAnimationFrame(rafId); };
  }, []);
}

export default function CustomDashboardPage() {
  useDashboardOffset();
  return (
    <div className="custom-dashboard-page">
      <Suspense fallback={
        <div className="custom-dashboard-loading">
          <div className="custom-dashboard-spinner" />
          กำลังโหลด...
        </div>
      }>
        <DashboardBuilder apiBaseUrl={API_BASE_URL} />
      </Suspense>
    </div>
  );
}
```

**`CustomDashboardPage.css`**

```css
.custom-dashboard-page {
  width: 100%;
  background: #f8f8f9;
}

/* ── Topbar: เลื่อนลงใต้ nav ของ host ── */
.custom-dashboard-page .topbar {
  position: fixed !important;
  top: var(--cd-topbar-top, 122px) !important;  /* fallback = nav 110px + 12px */
  left: 0 !important;
  right: 0 !important;
  width: auto !important;
  margin: 0 !important;
  border-radius: 0 !important;
  z-index: 950 !important;
}

/* ซ่อน brand zone — host มี nav ของตัวเองอยู่แล้ว */
.custom-dashboard-page .topbar-brand {
  display: none !important;
}

/* เว้นพื้นที่ให้ topbar */
.custom-dashboard-page .app-shell {
  padding-top: 88px !important;
}

/* ── Widget Palette sidebar ── */
.custom-dashboard-page .palette {
  top: var(--cd-palette-top, 198px) !important;
  max-height: var(--cd-palette-maxh, calc(100vh - 218px)) !important;
  z-index: 1000 !important;
}

/* ── Loading fallback ── */
.custom-dashboard-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 400px;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
}

.custom-dashboard-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #DBE7F5;
  border-top-color: #1B61AA;
  border-radius: 50%;
  animation: cd-spin 0.7s linear infinite;
}

@keyframes cd-spin {
  to { transform: rotate(360deg); }
}
```

### 5. เพิ่ม Route

```jsx
// App.js / router config
import CustomDashboardPage from './pages/CustomDashboard/CustomDashboardPage';

<Route path="/custom-dashboard" element={<CustomDashboardPage />} />
```

### 6. Restart dev server

```bash
npm start
```

---

## Props

| Prop | Type | Default | คำอธิบาย |
|------|------|---------|----------|
| `apiBaseUrl` | `string` | `https://localhost:7139` | URL ของ backend API |
| `useSampleData` | `boolean` | `false` | ใช้ sample data แทน API จริง (dev/demo) |

---

## การตั้งค่า API URL

Package อ่าน API URL จาก priority ดังนี้:

```
1. window.__DASHBOARD_API_BASE_URL__         ← runtime override (สูงสุด)
2. VITE_API_BASE_URL                         ← Vite .env (ใช้ตอน dev standalone)
3. REACT_APP_CUSTOM_DASHBOARD_API_URL        ← CRA/webpack .env  ← แนะนำสำหรับ tceb-web
4. 'https://localhost:7139'                  ← hardcoded fallback
```

| ค่า | `.env` (CRA) | `window` global | Default |
|-----|-------------|-----------------|---------|
| API base URL | `REACT_APP_CUSTOM_DASHBOARD_API_URL` | `window.__DASHBOARD_API_BASE_URL__` | `https://localhost:7139` |
| ใช้ sample data | `REACT_APP_CUSTOM_DASHBOARD_SAMPLE_DATA=true` | `window.__DASHBOARD_USE_SAMPLE_DATA__ = true` | `false` |
| Spark concurrency | `REACT_APP_SPARK_CONCURRENCY=2` | — | `2` |

**Runtime override** (ไม่ต้อง rebuild) — ใส่ใน `public/config.js` แล้ว include ใน `index.html`:

```html
<script src="/config.js"></script>
```
```js
// public/config.js  (สร้างต่างกันต่อ environment โดย CI/CD)
window.__DASHBOARD_API_BASE_URL__ = "https://prod-api.example.com";
```

---

## การตั้งค่า CSS และ Layout Offset

Dashboard Builder มี **topbar** และ **Widget Palette** เป็น `position: fixed` — ต้องปรับ offset ให้ต่ำกว่า nav ของ host app

**สูตรคำนวณ offset:**

```
topbar top  = NAV_HEIGHT + 12px
palette top = NAV_HEIGHT + 88px
```

`useDashboardOffset()` hook ใน Page component จะคำนวณและ set CSS variables อัตโนมัติทุก scroll frame โดยอ่านจาก `nav.getBoundingClientRect().bottom` — ใช้งานได้ทั้ง nav แบบ sticky และ nav ที่ scroll หายไป

**ตัวอย่าง behavior (nav สูง 110px):**

| สถานะ scroll | navBottom | `--cd-topbar-top` | `--cd-palette-top` |
|---|---|---|---|
| nav เต็มสูง | 110px | 122px | 198px |
| scroll ลงครึ่งทาง (nav เหลือ 55px) | 55px | 67px | 143px |
| scroll พ้น nav แล้ว | 0px | 12px | 88px |

---

## Z-index Reference

| Element | Z-index | หมายเหตุ |
|---|---|---|
| Host nav | ≥ 1100 | ต้องสูงกว่าทุกอย่างใน dashboard |
| Widget Palette | 1000 | อยู่เหนือ topbar เสมอ |
| Dashboard Topbar | 950 | อยู่เหนือ content |
| Dashboard Content | default | — |

---

## Local Development

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173/custom-dashboard/
```

---

## Build & Pack

### Commands สรุป

| Command | Output | ใช้เมื่อ |
|---------|--------|---------|
| `npm run build` | `dist-app/` | Deploy Standalone SPA |
| `npm run build:lib` | `dist/` | สร้าง npm package |
| `npm run build:all` | `dist-app/` + `dist/` | Build ทั้งสองแบบพร้อมกัน |
| `npm run pack` | `dist/` + `.tgz` | สร้าง package พร้อมส่งให้ทีมอื่น |

---

### Step-by-step: สร้างและติดตั้ง npm package (.tgz)

**1. ติดตั้ง dependencies (ครั้งแรกเท่านั้น)**

```bash
npm install
```

**2. Build + Pack**

```bash
npm run pack
```

คำสั่งนี้ทำทุกอย่างอัตโนมัติใน sequence เดียว:
1. **bump patch version** — `package.json` version เพิ่มขึ้นเองทุกครั้ง (e.g. `1.0.2` → `1.0.3`)
2. **gen:scoped** — regenerate `app-scoped.css` จาก `app.css` พร้อม `.dashboard-builder-root` prefix
3. **build:lib** — bundle เป็น ES module + CommonJS ใน `dist/`
4. **npm pack** — สร้าง `tceb-dashboard-builder-x.x.x.tgz`

**3. ตรวจสอบ output**

```bash
ls dist/
# dashboard-builder.es.js    ← ES module (Vite / modern bundlers)
# dashboard-builder.cjs.js   ← CommonJS (webpack / CRA)

ls *.tgz
# tceb-dashboard-builder-1.0.3.tgz  ← ชื่อตาม version ที่ bump
```

**4. คัดลอก .tgz ไปยัง host project และติดตั้ง**

```bash
cp tceb-dashboard-builder-1.0.3.tgz /path/to/tceb-web/

# ใน tceb-web:
rm -rf node_modules/tceb-dashboard-builder   # ล้าง cache ก่อน
npm install ./tceb-dashboard-builder-1.0.3.tgz
```

**5. Restart dev server ของ host app**

```bash
npm start
```

---

### Output ที่ได้

**`npm run build:lib` → `dist/`** (npm package)

```
dist/
├── dashboard-builder.es.js    # ES module — ใช้กับ Vite / modern bundlers
├── dashboard-builder.cjs.js   # CommonJS  — ใช้กับ webpack / CRA
└── style.css                  # CSS (inject ผ่าน JS อัตโนมัติแล้ว)
```

Dependencies ที่ **bundled** เข้าไปแล้ว (host app ไม่ต้องติดตั้งเอง):
- `recharts`
- `jspdf`
- `html2canvas`

Dependencies ที่เป็น **peer** (host app ต้องมีอยู่แล้ว):
- `react >= 18`
- `react-dom >= 18`

---

**`npm run build` → `dist-app/`** (Standalone SPA)

```
dist-app/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── ...
```

Deploy ที่ base path `/custom-dashboard/` — ตั้งค่าใน `vite.config.js` (`base: '/custom-dashboard/'`)

---

### Troubleshooting

| ปัญหา | วิธีแก้ |
|-------|---------|
| `vite: command not found` | รัน `npm install` ก่อน |
| `.tgz` ไม่ถูกสร้าง | ตรวจสอบ `"name"` และ `"version"` ใน `package.json` ต้องไม่ว่าง |
| Host app import แล้ว CSS ไม่โหลด | CSS inject ผ่าน JS อัตโนมัติ — ตรวจว่า bundle ไม่ถูก tree-shake ทิ้ง |
| TypeScript error ใน host app | เพิ่ม `declare module 'tceb-dashboard-builder'` ใน `*.d.ts` |

---

## Project Ecosystem

| Component | Role | Tech |
|---|---|---|
| **tceb-core-api** | Backend REST API | .NET 8 / ASP.NET Core |
| **custom-dashboard** ← you are here | Dashboard builder component | React + Vite |
| **tceb-web** | Main web portal | React (CRA) |
| **Ocelot Gateway** | API Gateway → Blendata | Ocelot (.NET) |
| **Blendata** | Data warehouse | Spark SQL |

### Request Flow

```
DashboardBuilder
      │  REST /datasource/widget/{key}
      ▼
tceb-core-api ──► Ocelot Gateway ──► Blendata (data warehouse)
```
