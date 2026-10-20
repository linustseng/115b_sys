# Finance list attachment loading — 2026-10-20

User reported finance admin startup stalls both in Taiwan and US. Location is not established as a cause.

Observed implementation: listFinanceRequests reads the authorized full list, retains existing workflow repair checks, then formerly fetched metadata separately per request and created signed storage URLs sequentially per attachment. Both finance pages already request a fresh authorized getAttachmentAccessUrl on click, making eager signing redundant.

Fix: batch authorized attachment IDs into one metadata query, preserve grouping/order and legacy/missing/deleted behavior, and defer signing to the existing click-time endpoint. No permissions, workflow, financial writes, time windows or notification rules changed. This is not pagination; the full list remains available for totals/filtering.

Read-only production count: 83 requests, 71 closed, 83 raw attachment entries; aggregate count query 227ms from maintenance host. This is not an authenticated production endpoint timing.

Verification: API suite 67 passed; regression cases include 500 attachments/one metadata query, 200-request admin/applicant scopes, legacy URLs, missing/deleted items and empty lists. Actual affected-device response time and attachment opening require separate production verification.

Rollback: revert the scoped performance commit. No migration or config change.
