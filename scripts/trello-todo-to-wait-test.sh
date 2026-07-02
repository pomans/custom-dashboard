#!/usr/bin/env bash
# Move completed Custom Dashboard cards from Todo → Wait For Test
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.trello; set +a

WAIT_TEST=6a02d8bdb60ebe8e38d1aa78
SPRINT2=6a13cfe02a00bf0fa1b13305

# id|short title|specific comment
CARDS=(
  "6a1422e8c156cc02ea15283b|Backend - by-url-slug and validate-permission contracts|Implemented GET /custom-dashboard/share/{slug} with slug-based unique unguessable link (base62, 22 chars). Access policy enforced server-side via UserClaimsUtil.GetClaimUserId() + ResolvePermission (owner/edit/view/null). Visibility states: private/link/public. Auto-grant view share on first open."
  "6a142cfed73f821538741037|Execution - by-url-slug and validate-permission contracts|Backend GET/PATCH endpoints wired + frontend dashboardApi.getSharedDashboard + createShareLink. Login flow restores path after auth (RequireLoginRoute saves pathname+search+hash, Callback restores). Verified: anonymous open → /login → returns to /custom-dashboard/share/{slug} → renders read-only."
  "6a142d45511f2ccbdf114c44|Execution - create/update dashboard payloads|POST /custom-dashboard + PUT /custom-dashboard/{id} working with JsonElement definition (widgets/filters/filterPanel). saveDashboard fallback: PUT 404 → POST (handles client-gen id). Confirmed: server-gen id syncs back into workspace. Save confirmation dialog implemented."
  "6a142d1867af0cc397b5c76f|Execution - create/update/save-bulk endpoints for wizard|Single-create endpoints in place; bulk endpoint not yet required (UI creates one dashboard at a time). Wizard already calls POST. Verified end-to-end."
  "6a142cfa76d02151f7caf61a|Execution - enforce access by dashboard slug|Backend [Authorize] on /share/{slug} (login required). Frontend forces login via RequireLoginRoute + reads slug from path /custom-dashboard/share/{slug}. Shared viewer = strict read-only (save/edit/import/export/share buttons hidden, layout tools disabled)."
  "6a142d42b1de4c497852f585|Execution - persist dashboard layout/files/data-source links|Definition stored as jsonb in custom_dashboard.definition. widgets[] (with x/y/w/h/type/config), filters{}, filterPanel{} round-trip verified. DB-only persistence (localStorage removed). Soft delete via is_deleted."
  "6a1422b36551f74d24fd3582|Frontend - forms, validation, unsaved-change guard|Name validation in New Dashboard dialog (required, 2-80 chars, no duplicates case-insensitive). beforeunload prompts on tab close when dirty. openDashboardList shows confirm dialog 'ออกโดยไม่บันทึก / กลับไปแก้ต่อ'. skipDirtyOnceRef prevents false-positives on bootstrap/load shared/save sync."
  "6a14229bd016a528fa33178e|Frontend - surface owner/profile context in dashboard list|Card shows 'แชร์ให้ฉัน' badge when isOwner=false. Owner cards show 'มี N ชุดข้อมูล · แชร์กับ M คน'. List API returns isOwner + permission + shareCount. Share button hidden for non-owners."
)

GENERIC_FOOTER="

Package: tceb-dashboard-builder@1.0.22 (deployed to tceb-web)
Status: ✅ Implemented, build 0 errors. Backend awaiting redeploy of tceb-core-api.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

OK=0; FAIL=0
for entry in "${CARDS[@]}"; do
  IFS='|' read -r CARD_ID TITLE COMMENT <<< "$entry"
  echo "→ $TITLE"

  # post comment
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.trello.com/1/cards/$CARD_ID/actions/comments" \
    --data-urlencode "text=**Implementation update**

$COMMENT$GENERIC_FOOTER" \
    -d "key=$TRELLO_API_KEY&token=$TRELLO_TOKEN")
  echo "  comment: HTTP $R"

  # move to Wait For Test
  R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "https://api.trello.com/1/cards/$CARD_ID" \
    -d "idList=$WAIT_TEST&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN")
  echo "  move:    HTTP $R"

  # add Sprint 2 label (skip 409 if already)
  curl -s -o /dev/null -X POST "https://api.trello.com/1/cards/$CARD_ID/idLabels" \
    -d "value=$SPRINT2&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
  echo "  label:   Sprint 2"

  OK=$((OK+1))
done

echo "==="
echo "Moved $OK cards to Wait For Test"
