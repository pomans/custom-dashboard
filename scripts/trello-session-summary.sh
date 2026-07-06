#!/usr/bin/env bash
# Post consolidated session progress summary to primary Custom Dashboard cards in Wait For Deploy
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.trello; set +a

CARDS=(
  "6a1422768efb93c7ba2bdd5f"  # Backend - persist dashboard layout/files/data-source links
  "6a1422eda3a847ac35e1d970"  # Backend - enforce access by dashboard slug
  "6a142272aa33643a8dd46f78"  # Backend - create/update dashboard payloads
  "6a1422b9799e995c32ab440a"  # Backend - create/update/save-bulk endpoints for wizard
  "6a1422833e41a81371a13808"  # Frontend - consume dashboard/tag/insight endpoints
)

COMMENT=$(cat <<'EOF'
**Session progress update — v1.0.31 landed (committed)**

Latest package: `tceb-dashboard-builder@1.0.31` — bumped on tceb-web

**Cloud persistence & sharing:**
- DB is single source of truth (localStorage workspace cache removed)
- Save confirmation dialog + optimistic save flow (PUT→404→POST fallback)
- Share dialog with copyable link + auto-persist on share
- Path variable share link (`/custom-dashboard/share/{slug}`, not `#`)
- Shared viewer strict read-only (save/edit/import/export/share hidden)
- Auto-grant view share on first open + owner share-count badge
- Self-share removal endpoint (`DELETE /{id}/share/me`)

**UX & polish:**
- Empty state per Figma + loading spinner during bootstrap
- Forms/validation on New Dashboard dialog (required, 2–80 chars, unique)
- Unsaved-change guard: `beforeunload` + confirm dialog on back navigation
- Toolbar hides mode-only buttons in view mode (instead of disabling)
- Language toggle button (TH/EN) in both list header and detail topbar
- i18n runtime toggle (~150 keys) — list, toolbar, dialogs, filter panel, wizard

**PDF export revamp:**
- Portrait A4 with dark blue header + MICE/TCEB logo SVG + copyright
- Filter summary as readable text (replaces interactive panel snapshot)
- Cropped dashboard image (removes filter-panel gap)

**Host integration self-sync:**
- useHostOffsetSync moved from tceb-web → package
- ResizeObserver + MutationObserver for reload/resize/late-mount edge cases
- tceb-web CustomDashboardPage.js is now trivial

**Backend fixes bundled:**
- MailKit 4.4.0 → 4.17.0 (GHSA-9j88-vvj5-vhgr)
- Default `User` role for all authenticated users
- /users GET/PUT/DELETE: policy widened + self-scope guard
- Public dashboard NRE fix (null Content deref)
- Registration email is now non-fatal (SMTP disconnect no longer 500s)

**Git status:**
- custom-dashboard @ main: 1 commit ahead (feat: cloud persistence, sharing, i18n, PDF header, host-offset self-sync)
- tceb-web @ development: 1 commit ahead (feat(custom-dashboard): embed native Dashboard Builder component)

Still requires tceb-core-api redeploy (custom_dashboard.sql + auth patches + JsonElement DTOs).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

for ID in "${CARDS[@]}"; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://api.trello.com/1/cards/$ID/actions/comments" \
    --data-urlencode "text=$COMMENT" \
    -d "key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | sed "s/^/  $ID → HTTP /"
done
echo "Done."
