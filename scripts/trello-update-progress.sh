#!/usr/bin/env bash
# Update Trello cards with current session progress
# Usage: bash scripts/trello-update-progress.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.trello; set +a

WAIT_DEPLOY_LIST=6a02d8bdb60ebe8e38d1aa79

# Card list: id|short description for log
CARDS=(
  "6a1422768efb93c7ba2bdd5f|Backend - persist dashboard layout/files/data-source links"
  "6a1422eda3a847ac35e1d970|Backend - enforce access by dashboard slug"
  "6a142272aa33643a8dd46f78|Backend - create/update dashboard payloads"
  "6a1422b9799e995c32ab440a|Backend - create/update/save-bulk endpoints for wizard"
  "6a1422833e41a81371a13808|Frontend - consume dashboard/tag/insight endpoints"
)

COMMENT_FILE=$(mktemp)
cat > "$COMMENT_FILE" <<'EOF'
**Progress update — Custom Dashboard persistence + sharing**

**Backend (tceb-core-api):**
- ✅ ตาราง `custom_dashboard` + `custom_dashboard_share` (DDL ใน `Scripts/custom_dashboard.sql`)
- ✅ Entities + EF mapping (partial DbContext) + Repository + Service
- ✅ `CustomDashboardController` — 11 endpoints (CRUD + visibility/share/me)
- ✅ Auth ผ่าน `UserClaimsUtil.GetClaimUserId()` + access rules (owner/edit/view)
- ✅ Share by slug `/share/{slug}` — auto-grant view ให้ผู้ที่ login + เปิดลิงก์
- ✅ ผู้รับแชร์ลบ view ออกจากรายการตัวเองได้ผ่าน `DELETE /{id}/share/me`
- ✅ Definition ใช้ `System.Text.Json.JsonElement` (เลี่ยง model-binding error)
- ✅ MailKit 4.4.0 → 4.17.0 (แก้ GHSA-9j88-vvj5-vhgr)
- ✅ Auth fixes: default role `User`, self-scope guard `/users` GET/PUT/DELETE
- ✅ Build 0 errors

**Frontend (tceb-dashboard-builder 1.0.21):**
- ✅ `dashboardApi.js` — list/get/save/delete + share/removeSelfShare
- ✅ DB เป็น source เดียว 100% (ตัด localStorage ออก)
- ✅ Bootstrap โหลด list จาก API + รองรับ share link `/share/{slug}` (path variable)
- ✅ Save confirmation dialog + ปุ่ม "บันทึก" → POST/PUT (fallback PUT 404 → POST)
- ✅ Share dialog + auto-persist ก่อนสร้างลิงก์
- ✅ Empty state ตาม Figma + Loading spinner ตอน bootstrap
- ✅ Badge "แชร์ให้ฉัน" + แสดงจำนวนคนที่แชร์ ("แชร์กับ N คน")
- ✅ Shared viewer = read-only เข้ม (ซ่อน save/edit/import/export/share)
- ✅ ปุ่มลบในการ์ดทำงานตามสิทธิ์: owner → ลบ dashboard, shared → นำออกจากรายการ

**Frontend (tceb-web):**
- ✅ `RequireLoginRoute` guard เก็บ `pathname + search + hash` กลับ
- ✅ `Callback.js` (SSO) restore pageState หลัง login
- ✅ Route `custom-dashboard/share/:slug` + แสดงปุ่ม back ใน topbar
- ✅ Bumped npm package → `tceb-dashboard-builder@1.0.21`

**ขั้นต่อไป (Wait for Deploy):**
1. รัน `Scripts/custom_dashboard.sql` บน TcebPortalDb
2. Redeploy tceb-core-api (มี endpoint ใหม่ + Auto-grant + MailKit 4.17.0)
3. ทดสอบ end-to-end บน tceb-web จริง

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF

COMMENT=$(cat "$COMMENT_FILE")
rm "$COMMENT_FILE"

for entry in "${CARDS[@]}"; do
  CARD_ID="${entry%%|*}"
  DESC="${entry#*|}"
  echo "→ $DESC"
  # post comment
  curl -s -X POST "https://api.trello.com/1/cards/$CARD_ID/actions/comments" \
    --data-urlencode "text=$COMMENT" \
    -d "key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
    -o /dev/null -w "  comment: HTTP %{http_code}\n"
  # move to Wait For Deploy
  curl -s -X PUT "https://api.trello.com/1/cards/$CARD_ID" \
    -d "idList=$WAIT_DEPLOY_LIST&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
    -o /dev/null -w "  move:    HTTP %{http_code}\n"
done

echo "Done."
