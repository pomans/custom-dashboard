# custom-dashboard — CLAUDE.md

## Project Overview

**tceb-dashboard-builder** — React component สำหรับสร้างและแสดงผล MICE Data Hub dashboard แบบ drag-and-drop
รองรับสองโหมด: Standalone SPA และ Embedded npm package ใน host app (tceb-web)

## Tech Stack

- **Frontend:** React 18 + Vite
- **Build output:** ES module (`dist/`) + Standalone SPA (`dist-app/`)
- **Charting:** Recharts (bundled)
- **PDF export:** jsPDF + html2canvas (bundled)

## API Source: tceb-core-api

Project นี้ดึงข้อมูลทั้งหมดจาก **tceb-core-api** ซึ่งเป็น .NET 8 / ASP.NET Core REST API

### Request Flow

```
DashboardBuilder (this repo)
      │  REST  /datasource/widget/{key}
      ▼
tceb-core-api  ──►  Ocelot Gateway  ──►  Blendata (Spark SQL data warehouse)
```

### API Base URL Configuration

API URL อ่านตาม priority ดังนี้:

| Priority | Source | ค่า |
|----------|--------|-----|
| 1 (สูงสุด) | `window.__DASHBOARD_API_BASE_URL__` | runtime override |
| 2 | `VITE_API_BASE_URL` | Vite `.env` (dev standalone) |
| 3 | `REACT_APP_CUSTOM_DASHBOARD_API_URL` | CRA/webpack `.env` (tceb-web) |
| 4 (fallback) | hardcoded | `https://localhost:7139` |

Default local dev URL: **`https://localhost:7139`**

### Environment Variables

```env
# สำหรับ dev standalone (ไฟล์ .env.local)
VITE_API_BASE_URL=https://localhost:7139

# สำหรับ tceb-web (CRA)
REACT_APP_CUSTOM_DASHBOARD_API_URL=https://your-api.example.com

# เปิดใช้ sample data (ไม่ต้องต่อ API จริง)
VITE_USE_SAMPLE_DATA=true
```

### useSampleData Mode

เมื่อ `useSampleData={true}` หรือ `VITE_USE_SAMPLE_DATA=true` — component ใช้ข้อมูล mock แทน
เหมาะสำหรับ dev/demo โดยไม่ต้อง run tceb-core-api

## Project Ecosystem

| Component | Role | Tech |
|-----------|------|------|
| **tceb-core-api** | Backend REST API ที่ project นี้เรียกใช้ | .NET 8 / ASP.NET Core |
| **custom-dashboard** ← this repo | Dashboard builder component | React + Vite |
| **tceb-web** | Main web portal ที่ embed component นี้ | React (CRA) |
| **Ocelot Gateway** | API Gateway → Blendata | Ocelot (.NET) |
| **Blendata** | Data warehouse | Spark SQL |

## Pattern: เพิ่ม Widget ใหม่ (Frontend + Backend)

การเพิ่ม widget ใหม่ 1 ตัวต้องแก้ **4 ไฟล์ใน custom-dashboard** และ **1 ไฟล์ใน tceb-core-api**

### ภาพรวม

```
tceb-core-api/Repositories/TcebPortalDb/BlendataRepository.cs
    └── เพิ่ม SQL builder method + ลงทะเบียน widget key

custom-dashboard/src/services/widgetApi.js
    └── เพิ่ม API key mapping + transformer function + applyToProfile case

custom-dashboard/src/components/WidgetRenderer.jsx
    └── เพิ่ม React component + rendering branch

custom-dashboard/src/data/sampleData.js
    └── เพิ่ม sample data ใน MICE_FIXED_PROFILE + catalog entry

custom-dashboard/src/App.jsx
    └── เพิ่ม widget type ใน NO_CONFIG_WIDGET_TYPES
```

---

### Step 1 — tceb-core-api: เพิ่ม SQL builder

**ไฟล์:** `tceb-core-api/Repositories/TcebPortalDb/BlendataRepository.cs`

**1a) ลงทะเบียน widget key** ใน `_widgets` dictionary:

```csharp
// เพิ่มในกลุ่ม MICE Stats หลัง miceDataTable
["myNewWidget"] = new(OcelotMiceStats, MyNewWidgetSql),
```

**1b) เพิ่ม SQL builder method:**

```csharp
private static string MyNewWidgetSql(WidgetFilter f) => $@"
SELECT {VYearCol(f)} AS year,
    sector_name,
    sum(no_of_visitors) AS no_of_visitors
FROM vw_adhoc_mice_stats_cy_fy
WHERE {VSingleYear(f)}          -- ใช้ปีที่เลือก (single year KPI/breakdown)
    AND {VQuarterList(f)}       -- calendar_quarter IN ('Q1','Q2','Q3','Q4') หรือ subset
    {VMarketWhere(f)}           -- AND domestic_international IN (...)
    {VIndustryWhere(f)}         -- AND sector_name IN (...) หรือ ละไว้ถ้า industry='all'
GROUP BY {VYearCol(f)}, sector_name
ORDER BY no_of_visitors DESC";
```

**SQL Helper functions ที่ใช้บ่อย:**

| Helper | ผลลัพธ์ | เมื่อไหร่ใช้ |
|--------|---------|------------|
| `VSingleYear(f)` | `calendar_year_en = 2025` | KPI / breakdown ปีเดียว |
| `VYearRange(f)` | `calendar_year_en BETWEEN 2007 AND 2025` | Chart หลายปี |
| `VYearCol(f)` | `calendar_year_en` หรือ `fiscal_year_en` | GROUP BY / SELECT year |
| `VQuarterList(f)` | `calendar_quarter IN ('Q1','Q2')` | กรอง quarter เสมอ |
| `VMarketWhere(f)` | `AND domestic_international IN (...)` | กรอง Int/Dom |
| `VIndustryWhere(f)` | `AND sector_name IN (...)` | กรอง sector |
| `NULLIF(..., 0)` | ป้องกัน division by zero | สูตร YoY / per-metric |

**Views หลัก:**

| View | ข้อมูล |
|------|--------|
| `vw_adhoc_mice_stats_cy_fy` | MICE stats รายปี/quarter พร้อม last_year columns |
| `vw_adhoc_mice_stats_fy` | MICE stats Fiscal Year (staying/spending) |
| `fact_mice_statistics` | ข้อมูล nationality drill-down |

**Build ตรวจ:** `cd /Volumes/ExtremeSSD/Project/tceb-core-api && dotnet build`

---

### Step 2 — widgetApi.js: เพิ่ม API key + transformer

**ไฟล์:** `src/services/widgetApi.js`

**2a) เพิ่มใน `WIDGET_API_KEYS`:**
```javascript
myNewWidget: ['myNewWidget'],
```

**2b) เพิ่มใน `FETCH_PRIORITY`** (เรียงจาก query เล็ก→ใหญ่):
```javascript
'myNewWidget',
```

**2c) เพิ่ม transformer function:**
```javascript
function transformMyNewWidget(rows) {
  return rows.map((r) => ({
    year:        num(r.year),
    sector_name: String(r.sector_name || ''),
    visitors:    num(r.no_of_visitors),
  }));
}
```

**2d) เพิ่มใน `applyToProfile` switch:**
```javascript
case 'myNewWidget':
  profile.myNewWidget = transformMyNewWidget(rows);
  break;
```

**Special cases:**
- Widget ที่ต้องการ **ปีเดียว** (quarterly) → เพิ่มใน `QUARTERLY_WIDGET_KEYS`
- Widget ที่ดึง **ทุกปี** (historical) → เพิ่มใน `HISTORICAL_WIDGET_KEYS` (frontend จะส่ง `yearMin=2008&yearMax=2025` เสมอ)

---

### Step 3 — WidgetRenderer.jsx: เพิ่ม component + rendering branch

**ไฟล์:** `src/components/WidgetRenderer.jsx`

**3a) เพิ่ม React component** ก่อน `export default function WidgetRenderer`:
```jsx
function MyNewWidget({ fixedProfile, globalFilter }) {
  const rows = fixedProfile.myNewWidget || [];
  // ... render logic
  return <div className="my-new-widget">...</div>;
}
```

**3b) เพิ่ม rendering branch** ภายใน `export default function WidgetRenderer` (ก่อน `miceNationalityMatrixView`):
```jsx
if (widget.type === 'myNewWidget') {
  return <MyNewWidget fixedProfile={fixedProfile} globalFilter={globalFilter} />;
}
```

---

### Step 4 — sampleData.js: เพิ่ม sample data + catalog entry

**ไฟล์:** `src/data/sampleData.js`

**4a) เพิ่ม sample data** ใน `MICE_FIXED_PROFILE`:
```javascript
myNewWidget: [
  { year: 2025, sector_name: 'Meetings',   visitors: 279575 },
  { year: 2025, sector_name: 'Incentives', visitors: 329961 },
],
```

**4b) เพิ่มใน `widgetCatalog`** (group: `'ready'` สำหรับ fixed MICE widgets):
```javascript
{
  type: 'myNewWidget',
  group: 'ready',
  fixed: true,
  defaultW: 6,
  defaultH: 5,
  label: 'My New Widget',
  dataset: 'miceStatistics',
  title: 'My New Widget',
  description: 'คำอธิบาย widget'
},
```

---

### Step 5 — App.jsx: ลงทะเบียน type

**ไฟล์:** `src/App.jsx`

เพิ่มใน `NO_CONFIG_WIDGET_TYPES` array:
```javascript
'myNewWidget',
```

---

### ตัวอย่าง: miceStatPerfKpiCard (สร้างแล้ว)

Widget นี้แสดง KPI card สำหรับ "สถิติอุตสาหกรรมไมซ์ของประเทศไทย" (PBI report) มี 6 variants ควบคุมด้วย `metric` prop:

| `metric` | ข้อมูล | แสดง YoY |
|----------|--------|----------|
| `visitors` | จำนวนนักเดินทางไมซ์ (คน) | ✓ |
| `revenue` | รายได้จากการจัดงาน (ล้านบาท) | ✓ |
| `events` | จำนวนงานไมซ์ (งาน) | ✓ |
| `revenuePerEvent` | รายได้เฉลี่ยต่อ 1 งาน (บาท) | — |
| `revenuePerVisitor` | รายได้เฉลี่ยต่อ 1 คน (บาท) | — |
| `visitorsPerEvent` | นักเดินทางต่อ 1 งาน (คน) | — |

API key: `miceStatPerfKpi` → SQL ใน `MiceStatPerfKpiSql()` — `VSingleYear` + GROUP BY year

---

## Common Commands

```bash
npm run dev          # Dev server → http://localhost:5173/custom-dashboard/
npm run build        # Standalone SPA → dist-app/
npm run build:lib    # npm package → dist/
npm run build:all    # Build ทั้งสองแบบ
npm run pack         # build:lib + สร้าง .tgz
```
