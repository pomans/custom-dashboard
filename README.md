# tceb-dashboard-builder

MICE Data Hub Dashboard Builder — React component สำหรับสร้างและแสดงผล dashboard แบบ drag-and-drop
ใช้งานได้สองแบบ: (1) Standalone SPA และ (2) Embedded npm package ใน host app

---

## สารบัญ

- [ติดตั้ง](#ติดตั้ง)
- [การใช้งานเบื้องต้น](#การใช้งานเบื้องต้น)
- [Props](#props)
- [การตั้งค่า API URL](#การตั้งค่า-api-url)
- [การตั้งค่า CSS](#การตั้งค่า-css)
- [Z-index Reference](#z-index-reference)
- [Local Development](#local-development)
- [Build & Pack](#build--pack)
- [Project Ecosystem](#project-ecosystem)

---

## ติดตั้ง

```bash
# จาก .tgz file ที่ได้รับมา (เปลี่ยน x.x.x เป็น version ล่าสุด)
npm install ./tceb-dashboard-builder-1.0.2.tgz
```

### Peer Dependencies (ต้องมีใน host app)

```json
{ "react": ">=18", "react-dom": ">=18" }
```

`recharts`, `jspdf`, `html2canvas` — **bundled แล้วใน package** ไม่ต้องติดตั้งแยก

---

## การใช้งานเบื้องต้น

```jsx
import React, { Suspense, lazy } from 'react';

const DashboardBuilder = lazy(() => import('tceb-dashboard-builder'));

function MyPage() {
  return (
    <div className="my-dashboard-page">
      <Suspense fallback={<div>กำลังโหลด...</div>}>
        <DashboardBuilder
          apiBaseUrl="https://your-api.example.com"
          useSampleData={false}
        />
      </Suspense>
    </div>
  );
}
```

---

## Props

| Prop | Type | Default | คำอธิบาย |
|------|------|---------|----------|
| `apiBaseUrl` | `string` | `https://localhost:7139` | URL ของ backend API |
| `useSampleData` | `boolean` | `false` | ใช้ sample data แทน API จริง (dev/demo) |

---

## การตั้งค่า API URL

Package อ่าน API URL จากหลายแหล่ง โดยมี **priority** ดังนี้:

```
1. window.__DASHBOARD_API_BASE_URL__         ← runtime override (สูงสุด)
2. VITE_API_BASE_URL                         ← Vite .env (ใช้ตอน dev standalone)
3. REACT_APP_CUSTOM_DASHBOARD_API_URL        ← CRA/webpack .env (tceb-web ใช้อันนี้)
4. 'https://localhost:7139'                  ← hardcoded fallback
```

### วิธีที่ 1 — `.env` file (แนะนำสำหรับ CRA / webpack)

ค่าถูก bake เข้า bundle ตอน build — เหมาะกับ environment ที่แน่นอน

**.env.development**
```env
REACT_APP_CUSTOM_DASHBOARD_API_URL=https://localhost:7139
```

**.env.production**
```env
REACT_APP_CUSTOM_DASHBOARD_API_URL=https://your-api.example.com
```

ส่งผ่าน prop ใน Page component:

```jsx
const API_BASE_URL = process.env.REACT_APP_CUSTOM_DASHBOARD_API_URL;

<DashboardBuilder apiBaseUrl={API_BASE_URL} />
```

### วิธีที่ 2 — `window` global (runtime, ไม่ต้อง rebuild)

เหมาะกับ deploy หลาย environment โดยไม่ต้อง build ใหม่

```html
<!-- index.html หรือ server-rendered HTML -->
<script>
  window.__DASHBOARD_API_BASE_URL__ = "https://your-api.example.com";
  window.__DASHBOARD_USE_SAMPLE_DATA__ = false;
</script>
```

หรือสร้าง `/public/config.js` แยกต่อ environment แล้ว include ใน `index.html`:

```html
<script src="/config.js"></script>
```

```js
// config.js (สร้างต่างกันต่อ environment โดย CI/CD)
window.__DASHBOARD_API_BASE_URL__ = "https://prod-api.example.com";
```

### ตัวแปรทั้งหมดที่ config ได้

| ค่า | `.env` (CRA) | `window` global | Default |
|-----|-------------|-----------------|---------|
| API base URL | `REACT_APP_CUSTOM_DASHBOARD_API_URL` | `window.__DASHBOARD_API_BASE_URL__` | `https://localhost:7139` |
| ใช้ sample data | `REACT_APP_CUSTOM_DASHBOARD_SAMPLE_DATA=true` | `window.__DASHBOARD_USE_SAMPLE_DATA__ = true` | `false` |
| Spark concurrency | `REACT_APP_SPARK_CONCURRENCY=2` | — | `2` |

---

## การตั้งค่า CSS

Dashboard Builder มี **topbar** และ **Widget Palette sidebar** เป็น `position: fixed` ซึ่งอาจทับกับ nav ของ host app หากไม่ได้ตั้งค่า offset

### กรณีที่ 1 — ไม่มี nav (standalone / full-page)

ไม่ต้อง config CSS เพิ่มเติม — dashboard ใช้ค่า default ของตัวเองทั้งหมด

### กรณีที่ 2 — Host app มี nav ความสูงคงที่

แก้ `top` ของ topbar และ palette ให้เลื่อนลงมาต่ำกว่า nav:

```css
/* wrapper ของหน้า dashboard */
.my-dashboard-page .topbar {
  position: fixed !important;
  top: 122px !important;    /* NAV_HEIGHT (110) + 12px = 122px  ← ปรับตาม nav จริง */
  left: 0 !important;
  right: 0 !important;
  width: auto !important;
  margin: 0 !important;
  border-radius: 0 !important;
  z-index: 950 !important;  /* ต่ำกว่า nav ของ host */
}

/* ซ่อน brand/logo ของ dashboard (host มี nav ของตัวเองอยู่แล้ว) */
.my-dashboard-page .topbar-brand {
  display: none !important;
}

/* เว้นพื้นที่ให้ topbar */
.my-dashboard-page .app-shell {
  padding-top: 88px !important;
}

/* Widget Palette sidebar */
.my-dashboard-page .palette {
  top: 198px !important;            /* NAV_HEIGHT (110) + 88px = 198px  ← ปรับตาม nav จริง */
  max-height: calc(100vh - 218px) !important;
  z-index: 1000 !important;
}
```

**สูตรคำนวณ:**

```
topbar top  = NAV_HEIGHT + 12
palette top = NAV_HEIGHT + 88
```

### กรณีที่ 3 — Nav เลื่อนตาม scroll (dynamic offset)

เมื่อ nav ไม่ได้ fixed ตลอดเวลา ให้ใช้ JavaScript hook คำนวณ offset แบบ real-time
และตรวจ footer ด้วยเพื่อไม่ให้ sidebar ทับ:

**CSS (ใช้ CSS variables):**

```css
.my-dashboard-page .topbar {
  position: fixed !important;
  top: var(--cd-topbar-top, 122px) !important;  /* fallback = nav เต็มสูง */
  left: 0 !important;
  right: 0 !important;
  width: auto !important;
  margin: 0 !important;
  border-radius: 0 !important;
  z-index: 950 !important;
}

.my-dashboard-page .topbar-brand { display: none !important; }

.my-dashboard-page .app-shell { padding-top: 88px !important; }

.my-dashboard-page .palette {
  top: var(--cd-palette-top, 198px) !important;
  max-height: var(--cd-palette-maxh, calc(100vh - 218px)) !important;
  z-index: 1000 !important;
}
```

**JavaScript hook (ใส่ใน Page component):**

```jsx
import { useEffect } from 'react';

const NAV_SELECTOR    = '.your-nav-class';     // ← selector ของ nav host app
const FOOTER_SELECTOR = '.your-footer-class';  // ← selector ของ footer host app

function useDashboardOffset() {
  useEffect(() => {
    let rafId = null;

    const update = () => {
      const nav    = document.querySelector(NAV_SELECTOR);
      const footer = document.querySelector(FOOTER_SELECTOR);
      const root   = document.documentElement;

      // nav bottom: 0 ถ้า scroll พ้นจอแล้ว
      const navBottom  = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;

      // palette หยุดก่อนถึง footer 16px เสมอ
      const footerTop  = footer ? footer.getBoundingClientRect().top : window.innerHeight;
      const paletteTop = navBottom + 88;
      const paletteMaxH = Math.max(
        120,
        Math.min(window.innerHeight - 16, footerTop - 16) - paletteTop
      );

      root.style.setProperty('--cd-topbar-top',   `${navBottom + 12}px`);
      root.style.setProperty('--cd-palette-top',  `${paletteTop}px`);
      root.style.setProperty('--cd-palette-maxh', `${paletteMaxH}px`);
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // initial
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
}

// ใช้งาน
function MyDashboardPage() {
  useDashboardOffset();
  return (
    <div className="my-dashboard-page">
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardBuilder apiBaseUrl={API_BASE_URL} />
      </Suspense>
    </div>
  );
}
```

**ตัวอย่าง behavior:**

| สถานะ scroll | navBottom | topbar top | palette top |
|---|---|---|---|
| ไม่ได้ scroll (nav เต็ม 110px) | 110px | 122px | 198px |
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
