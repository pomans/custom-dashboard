# Custom Dashboard — Persistence & Sharing Design

ออกแบบการ **บันทึก dashboard ลง database** + **share ให้ผู้อื่นดูได้** โดยอ่าน user จาก Bearer token

> Scope ครอบคลุม 2 repo: **tceb-core-api** (table + REST API) และ **custom-dashboard** (frontend service + UI hook)

---

## 1. หลักการออกแบบ (Design Decisions)

| ประเด็น | ตัดสินใจ | เหตุผล |
|--------|---------|--------|
| ตารางใหม่ vs ใช้ `dashboard` เดิม | **สร้างใหม่** (`custom_dashboard`) | ตาราง `dashboard` เดิมเป็น admin BI dashboard (EmbedSrc/category) — คนละ concept กับ builder ที่เก็บ widgets/filters/layout |
| เก็บ definition แบบไหน | **JSONB blob** (`definition`) + metadata columns | builder serialize เป็น JSON อยู่แล้ว (มี export/import), schema เปลี่ยนบ่อย (widget type ใหม่), ไม่ต้อง query เข้าไปใน widget |
| User id | `UserClaimsUtil.GetClaimUserId()` | pattern เดียวกับ `DashboardService` — แปลง Keycloak `NameIdentifier` → internal `User.Id` |
| Sharing | **Link share** (slug) + **User share** (per-user grant) | รองรับทั้ง "ส่งลิงก์ให้ใครก็ดูได้" และ "แชร์เจาะจงคน + สิทธิ์ view/edit" |
| ลบ | **Soft delete** (`is_deleted`) | กู้คืนได้ + ไม่ทำลาย share history |

---

## 2. Database Schema (PostgreSQL)

### 2.1 `custom_dashboard` — dashboard ที่ user สร้าง

```sql
CREATE TABLE custom_dashboard (
    id              varchar(50)  NOT NULL,
    name            varchar(255) NOT NULL,
    owner_user_id   varchar(50)  NOT NULL,                      -- internal User.Id (GetClaimUserId)
    definition      jsonb        NOT NULL,                      -- { widgets, filters, filterPanel }
    visibility      varchar(20)  NOT NULL DEFAULT 'private',    -- private | link | public
    share_slug      varchar(64),                                -- set เมื่อเปิด link share (unique)
    widget_count    integer      NOT NULL DEFAULT 0,            -- denormalized เพื่อ list เร็ว
    thumbnail       text,                                       -- optional preview (data-url/url)
    is_deleted      boolean      NOT NULL DEFAULT false,
    created_by      varchar(50)  NOT NULL DEFAULT 'SYS',
    created_date    timestamp    NOT NULL DEFAULT now(),
    updated_by      varchar(50),
    updated_date    timestamp,
    CONSTRAINT custom_dashboard_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ux_custom_dashboard_slug
    ON custom_dashboard (share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX ix_custom_dashboard_owner
    ON custom_dashboard (owner_user_id) WHERE is_deleted = false;
```

### 2.2 `custom_dashboard_share` — สิทธิ์แชร์เจาะจงผู้ใช้

```sql
CREATE TABLE custom_dashboard_share (
    id                  varchar(50) NOT NULL,
    dashboard_id        varchar(50) NOT NULL,
    shared_with_user_id varchar(50) NOT NULL,                   -- internal User.Id ผู้รับแชร์
    permission          varchar(20) NOT NULL DEFAULT 'view',    -- view | edit
    created_by          varchar(50) NOT NULL DEFAULT 'SYS',
    created_date        timestamp   NOT NULL DEFAULT now(),
    updated_by          varchar(50),
    updated_date        timestamp,
    CONSTRAINT custom_dashboard_share_pkey PRIMARY KEY (id),
    CONSTRAINT fk_cds_dashboard FOREIGN KEY (dashboard_id)
        REFERENCES custom_dashboard (id) ON DELETE CASCADE,
    CONSTRAINT uq_cds_dashboard_user UNIQUE (dashboard_id, shared_with_user_id)
);

CREATE INDEX ix_cds_shared_user ON custom_dashboard_share (shared_with_user_id);
```

### 2.3 ER

```
custom_dashboard 1 ───< custom_dashboard_share
   (owner_user_id)          (shared_with_user_id, permission)

owner_user_id / shared_with_user_id → users.id  (logical FK, ไม่ผูก hard FK เพื่อความยืดหยุ่น)
```

### 2.4 รูปแบบ `definition` (jsonb)

ตรงกับ workspace shape ของ frontend (1 dashboard ต่อ 1 record):

```json
{
  "widgets":    [ { "id": "...", "type": "miceVisitorsChart", "x": 0, "y": 0, "w": 6, "h": 5, "config": {} } ],
  "filters":    { "market": "International", "yearMode": "calendar", "year": 2025, "quarters": "Q1,Q2,Q3,Q4" },
  "filterPanel":{ "x": 0, "y": 0, "w": 12, "h": 3 }
}
```

---

## 3. Sharing & Access Model

### Mechanisms
1. **Link share** — owner เปิด → `visibility='link'` + generate `share_slug` → ใครมีลิงก์ `/.../share/{slug}` ดูได้ (read-only)
2. **Public** — `visibility='public'` → list ในหน้า public ได้ด้วย (optional)
3. **User share** — owner เพิ่ม grant ใน `custom_dashboard_share` (view/edit) ให้ user เจาะจง

### Access rules (เช็คฝั่ง server ทุก request)

| ผู้ใช้ | สิทธิ์ |
|-------|-------|
| Owner (`owner_user_id == userId`) | อ่าน + แก้ + ลบ + จัดการ share |
| Grant `edit` | อ่าน + แก้ definition |
| Grant `view` | อ่านอย่างเดียว |
| มี slug + `visibility in (link, public)` | อ่านผ่าน slug |
| อื่นๆ | 403 |

---

## 4. REST API (tceb-core-api)

Controller ใหม่ `CustomDashboardController` — route `custom-dashboard` ห่อด้วย `ResponseBase<T>` เหมือน controller อื่น

| Method | Route | Auth | หน้าที่ |
|--------|-------|------|--------|
| `GET`    | `/custom-dashboard`                    | Bearer | list ของฉัน + ที่ถูกแชร์ให้ฉัน |
| `GET`    | `/custom-dashboard/{id}`               | Bearer | ดู 1 อัน (owner/shared) |
| `GET`    | `/custom-dashboard/share/{slug}`       | — / optional | ดูผ่าน public link |
| `POST`   | `/custom-dashboard`                    | Bearer | สร้างใหม่ |
| `PUT`    | `/custom-dashboard/{id}`               | Bearer | บันทึก/แก้ (owner หรือ edit grant) |
| `DELETE` | `/custom-dashboard/{id}`               | Bearer | soft-delete (owner) |
| `PATCH`  | `/custom-dashboard/{id}/visibility`    | Bearer | ตั้ง private/link/public → คืน slug |
| `POST`   | `/custom-dashboard/{id}/share`         | Bearer | เพิ่ม/แก้ grant ราย user |
| `DELETE` | `/custom-dashboard/{id}/share/{userId}`| Bearer | ถอน grant |
| `GET`    | `/custom-dashboard/{id}/share`         | Bearer | list grant ทั้งหมด (owner) |

### Request/Response DTOs (ตัวอย่าง)

```jsonc
// POST /custom-dashboard
{ "name": "แดชบอร์ดของฉัน", "definition": { /* widgets/filters/filterPanel */ } }

// Response
{
  "id": "a1b2...", "name": "แดชบอร์ดของฉัน", "visibility": "private",
  "shareSlug": null, "widgetCount": 6, "isOwner": true, "permission": "owner",
  "definition": { /* ... */ },
  "createdDate": "2026-06-29T10:00:00", "updatedDate": null
}

// PATCH /custom-dashboard/{id}/visibility
{ "visibility": "link" }            // → { "shareSlug": "k7Yh2x..." }

// POST /custom-dashboard/{id}/share
{ "sharedWithUserId": "u-123", "permission": "view" }
```

---

## 5. C# Implementation Skeleton

### 5.1 Entities — `Entities/TcebPortalDb/`

```csharp
// CustomDashboard.cs
namespace TcebCoreApi.Entities.TcebPortalDb;

public partial class CustomDashboard : AuditableEntityBase
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string OwnerUserId { get; set; } = null!;
    public string Definition { get; set; } = null!;      // raw JSON string (jsonb)
    public string Visibility { get; set; } = "private";
    public string? ShareSlug { get; set; }
    public int WidgetCount { get; set; }
    public string? Thumbnail { get; set; }
    public bool IsDeleted { get; set; }

    public virtual ICollection<CustomDashboardShare> Shares { get; set; }
        = new List<CustomDashboardShare>();
}

// CustomDashboardShare.cs
public partial class CustomDashboardShare : AuditableEntityBase
{
    public string Id { get; set; } = null!;
    public string DashboardId { get; set; } = null!;
    public string SharedWithUserId { get; set; } = null!;
    public string Permission { get; set; } = "view";

    public virtual CustomDashboard? Dashboard { get; set; }
}
```

### 5.2 DbContext mapping — `TcebPortalDbContext.OnModelCreating`

```csharp
modelBuilder.Entity<CustomDashboard>(entity =>
{
    entity.HasKey(e => e.Id).HasName("custom_dashboard_pkey");
    entity.ToTable("custom_dashboard");

    entity.Property(e => e.Id).HasMaxLength(50).HasColumnName("id");
    entity.Property(e => e.Name).HasMaxLength(255).HasColumnName("name");
    entity.Property(e => e.OwnerUserId).HasMaxLength(50).HasColumnName("owner_user_id");
    entity.Property(e => e.Definition).HasColumnType("jsonb").HasColumnName("definition");
    entity.Property(e => e.Visibility).HasMaxLength(20)
          .HasDefaultValueSql("'private'::character varying").HasColumnName("visibility");
    entity.Property(e => e.ShareSlug).HasMaxLength(64).HasColumnName("share_slug");
    entity.Property(e => e.WidgetCount).HasColumnName("widget_count");
    entity.Property(e => e.Thumbnail).HasColumnName("thumbnail");
    entity.Property(e => e.IsDeleted).HasColumnName("is_deleted");
    entity.Property(e => e.CreatedBy).HasMaxLength(50)
          .HasDefaultValueSql("'SYS'::character varying").HasColumnName("created_by");
    entity.Property(e => e.CreatedDate).HasDefaultValueSql("now()")
          .HasColumnType("timestamp without time zone").HasColumnName("created_date");
    entity.Property(e => e.UpdatedBy).HasMaxLength(50).HasColumnName("updated_by");
    entity.Property(e => e.UpdatedDate)
          .HasColumnType("timestamp without time zone").HasColumnName("updated_date");
});

modelBuilder.Entity<CustomDashboardShare>(entity =>
{
    entity.HasKey(e => e.Id).HasName("custom_dashboard_share_pkey");
    entity.ToTable("custom_dashboard_share");

    entity.Property(e => e.Id).HasMaxLength(50).HasColumnName("id");
    entity.Property(e => e.DashboardId).HasMaxLength(50).HasColumnName("dashboard_id");
    entity.Property(e => e.SharedWithUserId).HasMaxLength(50).HasColumnName("shared_with_user_id");
    entity.Property(e => e.Permission).HasMaxLength(20)
          .HasDefaultValueSql("'view'::character varying").HasColumnName("permission");
    // + audit columns (เหมือนด้านบน)

    entity.HasOne(d => d.Dashboard).WithMany(p => p.Shares)
          .HasForeignKey(d => d.DashboardId)
          .HasConstraintName("fk_cds_dashboard");
});
```
*(เพิ่ม `public virtual DbSet<CustomDashboard> CustomDashboards { get; set; }` + `CustomDashboardShares` ใน DbContext)*

### 5.3 Service — จุดสำคัญ: ดึง user จาก token + เช็คสิทธิ์

```csharp
public async Task<ResponseBase<CustomDashboardResponse>> CreateAsync(CustomDashboardCreateRequest req)
{
    var userId = UserClaimsUtil.GetClaimUserId();           // ← internal user id จาก Bearer
    if (string.IsNullOrEmpty(userId) || userId == "SYS")
        return Unauthorized();

    var entity = new CustomDashboard
    {
        Id           = Guid.NewGuid().ToString(),
        Name         = req.Name,
        OwnerUserId  = userId,
        Definition   = JsonConvert.SerializeObject(req.Definition),
        WidgetCount  = req.Definition?.Widgets?.Count ?? 0,
        Visibility   = "private",
        CreatedBy    = userId,
        CreatedDate  = DateTime.UtcNow,
    };
    await _repo.AddAsync(entity);
    return Ok(MapToResponse(entity, userId));
}

// helper: หา effective permission ของ user ต่อ dashboard
private string? ResolvePermission(CustomDashboard d, string userId)
{
    if (d.OwnerUserId == userId) return "owner";
    var grant = d.Shares.FirstOrDefault(s => s.SharedWithUserId == userId);
    return grant?.Permission;            // "edit" | "view" | null
}

// PATCH visibility — generate slug เมื่อเปิด link share
public async Task<ResponseBase<object>> SetVisibilityAsync(string id, string visibility)
{
    var userId = UserClaimsUtil.GetClaimUserId();
    var d = await _repo.GetWithSharesAsync(id);
    if (d is null || d.OwnerUserId != userId) return Forbidden();

    d.Visibility = visibility;                                    // private | link | public
    d.ShareSlug  = visibility == "private" ? null
                 : d.ShareSlug ?? GenerateSlug();                 // base62, 22 ตัว
    d.UpdatedBy = userId; d.UpdatedDate = DateTime.UtcNow;
    await _repo.UpdateAsync(d);
    return Ok(new { shareSlug = d.ShareSlug });
}
```

> `GetByShareSlugAsync(slug)` ไม่เช็ค userId แต่เช็คว่า `visibility in ('link','public') && !is_deleted` เท่านั้น → endpoint นี้ไม่ต้อง `[Authorize]`

---

## 6. Frontend Integration (custom-dashboard)

### 6.1 ส่ง Bearer token เข้า component
ตอนนี้ `widgetApi.js` ยังไม่แนบ auth header. เพิ่ม prop `authToken` ใน `DashboardBuilderComponent` → เก็บใน `window.__DASHBOARD_AUTH_TOKEN__` (pattern เดียวกับ `apiBaseUrl`):

```jsx
// DashboardBuilderComponent.jsx
export default function DashboardBuilder({ apiBaseUrl, authToken, useSampleData }) {
  useEffect(() => {
    if (apiBaseUrl) window.__DASHBOARD_API_BASE_URL__ = apiBaseUrl;
    if (authToken)  window.__DASHBOARD_AUTH_TOKEN__   = authToken;
    // ...cleanup
  }, [apiBaseUrl, authToken, useSampleData]);
  // ...
}
```

### 6.2 service ใหม่ `src/services/dashboardApi.js`

```js
import { API_BASE_URL } from '../config/apiConfig';

const authHeaders = () => {
  const t = typeof window !== 'undefined' && window.__DASHBOARD_AUTH_TOKEN__;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export async function listDashboards() {
  const r = await fetch(`${API_BASE_URL}/custom-dashboard`, { headers: { Accept: 'application/json', ...authHeaders() } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function saveDashboard({ id, name, definition }) {
  const url    = id ? `${API_BASE_URL}/custom-dashboard/${id}` : `${API_BASE_URL}/custom-dashboard`;
  const method = id ? 'PUT' : 'POST';
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, definition }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function setVisibility(id, visibility) { /* PATCH .../visibility */ }
export async function shareToUser(id, userId, permission) { /* POST .../share */ }
export async function getSharedDashboard(slug) { /* GET .../share/{slug} — no auth */ }
```

### 6.3 จุดเชื่อมใน `App.jsx`
- `persistWorkspace()` (ตอนนี้เขียน `localStorage`) → เรียก `saveDashboard()` แทน/เพิ่ม (cloud-first, localStorage = offline cache)
- ปุ่ม **แชร์** ในการ์ด (มีอยู่แล้ว) → เรียก `setVisibility(id,'link')` แล้ว copy `/.../share/{slug}`
- หน้า list → merge `listDashboards()` (ของฉัน + แชร์ให้ฉัน) แทนการอ่าน localStorage อย่างเดียว
- map 1 record API = 1 entry ใน `workspace.dashboards` (`definition` กาง flat เป็น `{ widgets, filters, filterPanel }`)

---

## 7. ลำดับงาน (Implementation Checklist)

**tceb-core-api**
1. รัน DDL (§2) สร้าง 2 ตาราง
2. เพิ่ม entities `CustomDashboard`, `CustomDashboardShare` + DbSet + mapping (§5.1–5.2)
3. `Models/TcebPortalDb/CustomDashboard/` — Request/Response/Filter DTOs
4. `ICustomDashboardRepository` + impl (EF, soft-delete aware)
5. `ICustomDashboardService` + impl — auth ผ่าน `UserClaimsUtil.GetClaimUserId()`, access rules §3
6. `CustomDashboardController` (§4) + register DI ใน `Program.cs`
7. `dotnet build` ตรวจ

**custom-dashboard (frontend)**
8. prop `authToken` + `window.__DASHBOARD_AUTH_TOKEN__` (§6.1)
9. `src/services/dashboardApi.js` (§6.2)
10. เชื่อม save/list/share ใน `App.jsx` (§6.3), เก็บ localStorage เป็น fallback

---

## 8. หมายเหตุ / จุดที่ต้องตัดสินใจเพิ่ม
- **Slug ของ public link**: ใช้ base62 22 ตัว (จาก Guid) — เดายาก, ไม่ต้องทำ auth ก็ปลอดภัยพอสำหรับ "unlisted link"
- **edit grant**: ถ้าให้คนอื่นแก้ได้ → ต้องคิดเรื่อง concurrent edit (เวอร์ชันแรกแนะนำ **view-only share** ก่อน, edit ค่อยตามมา)
- **quota**: จำกัดจำนวน dashboard/user หรือขนาด `definition` (jsonb) กันสร้างไม่จำกัด
- **ขนาด definition**: jsonb ใหญ่ได้ถึง ~255MB แต่ควร validate < ~1MB ฝั่ง API
