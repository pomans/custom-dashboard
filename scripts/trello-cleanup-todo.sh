#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.trello; set +a

WAIT_TEST=6a02d8bdb60ebe8e38d1aa78
SPRINT2=6a13cfe02a00bf0fa1b13305

# ── Cards ทำเสร็จแล้ว → ย้าย Wait For Test ─────────────────────────────────
DONE_CARDS=(
  "6a142d2bb4235b5d1039add4|Execution - surface owner/profile context in dashboard list|Card แสดง 'แชร์ให้ฉัน' badge เมื่อ isOwner=false + 'แชร์กับ N คน' บนการ์ดของเจ้าของ. API คืน isOwner + permission + shareCount."
  "6a142d01752d04560eb53f80|Execution - separate detail view|Share link /custom-dashboard/share/{slug} เปิดเป็นหน้า detail แยกแบบ read-only เข้ม (ซ่อน save/edit/import/export/share). sharedView state แยกจาก viewMode='detail'."
  "6a142de76226277a6aeba270|Execution - เปิดแสดงผลในแท็บใหม่และแยกหน้า Dashboard|Share link เปิดในแท็บใหม่/เบราว์เซอร์อื่นได้ — รองรับ login flow + restore route (RequireLoginRoute + Callback restore pageState)."
  "6a1422ca96dc06fdf227fd16|Frontend - public render of chart/table widgets|Shared viewer render widgets ทุกชนิด (chart, table, KPI, treemap) แบบ read-only ผ่าน WidgetRenderer เดิม + ใช้ filter ได้แต่ไม่ persist."
  "6a142d0eadaf79ea5668eaea|Execution - public render of chart/table widgets|Backend GET /share/{slug} คืน definition เต็ม + auto-grant view share. Frontend bootstrap detect path /share/{slug} แล้วโหลด read-only."
  "6a142296348700eb2a216475|Frontend - show user profile linked to dashboards|Card meta แสดง 'แชร์ให้ฉัน' badge สำหรับ shared dashboards + owner เห็น share count. Dropdown โปรไฟล์ Nav แสดง role name fallback 'ผู้ใช้งาน'."
)

GENERIC_FOOTER="

Package: tceb-dashboard-builder@1.0.22 (deployed)
Status: ✅ Implemented. Awaiting tceb-core-api redeploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

echo "=== Moving completed cards → Wait For Test ==="
for entry in "${DONE_CARDS[@]}"; do
  IFS='|' read -r ID TITLE DESC <<< "$entry"
  echo "→ $TITLE"
  curl -s -o /dev/null -w "  comment: HTTP %{http_code}\n" -X POST "https://api.trello.com/1/cards/$ID/actions/comments" \
    --data-urlencode "text=**Implementation update**

$DESC$GENERIC_FOOTER" \
    -d "key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
  curl -s -o /dev/null -w "  move:    HTTP %{http_code}\n" -X PUT "https://api.trello.com/1/cards/$ID" \
    -d "idList=$WAIT_TEST&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
  curl -s -o /dev/null -X POST "https://api.trello.com/1/cards/$ID/idLabels" \
    -d "value=$SPRINT2&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
  echo "  label:   Sprint 2"
done

# ── Cards ซ้ำซ้อน/typo → archive (closed=true, reversible) ─────────────────
DUPLICATE_CARDS=(
  "6a142da9c9b4c9a7ca063427|Execution - ] - Create Canvas Editor (typo template; ใช้ Frontend - canvas/editor and card arrangement UI แทน)"
  "6a142da635c97c598715f5ec|Frontend - ] - Create Canvas Editor (typo template; ใช้ Frontend - canvas/editor and card arrangement UI แทน)"
)

echo
echo "=== Archiving duplicate/typo cards ==="
for entry in "${DUPLICATE_CARDS[@]}"; do
  IFS='|' read -r ID REASON <<< "$entry"
  echo "→ $REASON"
  curl -s -o /dev/null -w "  comment: HTTP %{http_code}\n" -X POST "https://api.trello.com/1/cards/$ID/actions/comments" \
    --data-urlencode "text=**Archived as duplicate**

ใบนี้เป็น typo template (มี '] -' เกินมาในชื่อ) ซ้ำซ้อนกับ card หลัก:
- Frontend - canvas/editor and card arrangement UI

Canvas editor มีอยู่แล้วใน App.jsx (drag & drop widgets + resize + arrange)

🤖 Auto-cleanup by Claude Code" \
    -d "key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
  curl -s -o /dev/null -w "  archive: HTTP %{http_code}\n" -X PUT "https://api.trello.com/1/cards/$ID" \
    -d "closed=true&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
done

echo
echo "Done."
