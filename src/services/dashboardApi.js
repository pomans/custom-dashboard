// ─────────────────────────────────────────────────────────────────────────────
// dashboardApi.js — บันทึก/โหลด/แชร์ custom dashboard ผ่าน tceb-core-api
//   endpoint: /custom-dashboard   (ดู docs/dashboard-persistence-design.md)
//   auth: Bearer token จาก window.__DASHBOARD_AUTH_TOKEN__ (set โดย DashboardBuilderComponent)
// ─────────────────────────────────────────────────────────────────────────────
import { API_BASE_URL } from '../config/apiConfig';

const BASE = `${API_BASE_URL}/custom-dashboard`;

// tceb-web เก็บ token ที่ sessionStorage['accessToken'] + mirror localStorage['tceb.auth.accessToken']
const AUTH_STORAGE_PREFIX = 'tceb.auth.';

/**
 * อ่าน Bearer token แบบ fresh ทุกครั้ง (รองรับ token refresh อัตโนมัติ)
 * ลำดับ priority:
 *   1. window.__DASHBOARD_AUTH_TOKEN__       — inject ตรง (override, optional)
 *   2. sessionStorage[key]                   — host app (tceb-web) เก็บไว้
 *   3. localStorage[`tceb.auth.${key}`]      — mirror ของ tceb-web
 * key อ่านจาก window.__DASHBOARD_AUTH_TOKEN_KEY__ (default 'accessToken')
 */
export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  if (window.__DASHBOARD_AUTH_TOKEN__) return window.__DASHBOARD_AUTH_TOKEN__;

  const key = window.__DASHBOARD_AUTH_TOKEN_KEY__ || 'accessToken';
  try {
    return (
      window.sessionStorage?.getItem(key) ||
      window.localStorage?.getItem(`${AUTH_STORAGE_PREFIX}${key}`) ||
      null
    );
  } catch {
    return null;
  }
}

function authHeaders() {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(url, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json', ...(auth ? authHeaders() : {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.messageTh || (await res.text()); } catch (_) { /* noop */ }
    const err = new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── definition <-> dashboard mapping ─────────────────────────────────────────
// 1 record API  ⇄  1 dashboard ใน workspace ({ id, name, widgets, filters, filterPanel })
function toDefinition(dashboard) {
  return {
    widgets: dashboard.widgets || [],
    filters: dashboard.filters,
    filterPanel: dashboard.filterPanel,
  };
}

function fromApi(dto) {
  const def = dto.definition || {};
  return {
    id: dto.id,
    name: dto.name,
    widgets: def.widgets || [],
    filters: def.filters,
    filterPanel: def.filterPanel,
    // metadata (ใช้แสดงสถานะแชร์ / สิทธิ์ — ไม่กระทบ render เดิม)
    visibility: dto.visibility,
    shareSlug: dto.shareSlug,
    widgetCount: dto.widgetCount,
    shareCount: dto.shareCount,
    isOwner: dto.isOwner,
    permission: dto.permission,
    updatedDate: dto.updatedDate,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** list ของฉัน + ที่ถูกแชร์ให้ฉัน (รายการย่อ ไม่มี definition) */
export function listDashboards() {
  return request(BASE);
}

/** โหลด dashboard เต็ม (พร้อม definition) → workspace shape */
export async function getDashboard(id) {
  return fromApi(await request(`${BASE}/${id}`));
}

/** โหลดผ่าน share link slug (ต้อง login — ส่ง Bearer token) → workspace shape */
export async function getSharedDashboard(slug) {
  return fromApi(await request(`${BASE}/share/${encodeURIComponent(slug)}`, { auth: true }));
}

/** สร้างใหม่ → workspace shape (มี id ที่ server gen) */
export async function createDashboard(dashboard) {
  const dto = await request(BASE, {
    method: 'POST',
    body: { name: dashboard.name, definition: toDefinition(dashboard), thumbnail: dashboard.thumbnail },
  });
  return fromApi(dto);
}

/** บันทึก/แก้ (owner หรือ edit grant) → workspace shape */
export async function updateDashboard(id, dashboard) {
  const dto = await request(`${BASE}/${id}`, {
    method: 'PUT',
    body: { name: dashboard.name, definition: toDefinition(dashboard), thumbnail: dashboard.thumbnail },
  });
  return fromApi(dto);
}

/**
 * บันทึก: ไม่มี id → create
 *          มี id → ลอง update; ถ้า 404 (id เป็น client-gen ยังไม่เคย persist) → create ใหม่
 * (server gen id ใหม่ตอน create → caller ต้อง sync id กลับเข้า workspace)
 */
export async function saveDashboard(dashboard) {
  if (!dashboard.id) return createDashboard(dashboard);
  try {
    return await updateDashboard(dashboard.id, dashboard);
  } catch (err) {
    if (err?.status === 404) return createDashboard(dashboard);
    throw err;
  }
}

/** ลบ (soft delete, owner) */
export function deleteDashboard(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' });
}

/** ผู้รับแชร์ลบ view ออกจากรายการตัวเอง (ไม่กระทบ dashboard จริง) */
export function removeSelfShare(id) {
  return request(`${BASE}/${id}/share/me`, { method: 'DELETE' });
}

// ── Sharing ──────────────────────────────────────────────────────────────────

/** ตั้ง visibility: 'private' | 'link' | 'public' → คืน { shareSlug, ... } */
export function setVisibility(id, visibility) {
  return request(`${BASE}/${id}/visibility`, { method: 'PATCH', body: { visibility } });
}

/** เปิด link share แล้วคืน URL เต็มสำหรับ copy (ใช้ path variable /share/{slug} ไม่ใช้ # หรือ query) */
export async function createShareLink(id) {
  const dto = await request(`${BASE}/${id}/visibility`, { method: 'PATCH', body: { visibility: 'link' } });
  const slug = dto?.shareSlug;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // base path ปัจจุบัน ตัด trailing slash และ /share/{slug} เดิมออก ก่อนต่อ segment ใหม่
  const basePath = (typeof window !== 'undefined' ? window.location.pathname : '')
    .replace(/\/share\/[^/]+\/?$/, '')
    .replace(/\/+$/, '');
  return { slug, url: slug ? `${origin}${basePath}/share/${encodeURIComponent(slug)}` : null };
}

/** แชร์ให้ user เจาะจง (view) */
export function shareToUser(id, sharedWithUserId, permission = 'view') {
  return request(`${BASE}/${id}/share`, { method: 'POST', body: { sharedWithUserId, permission } });
}

/** ถอนสิทธิ์แชร์ */
export function revokeShare(id, userId) {
  return request(`${BASE}/${id}/share/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

/** list สิทธิ์แชร์ทั้งหมด (owner) */
export function listShares(id) {
  return request(`${BASE}/${id}/share`);
}
