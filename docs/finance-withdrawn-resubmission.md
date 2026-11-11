# Withdrawn finance requests: edit and resubmit

2026-11-12: Both portal and API previously allowed only draft/returned edits.
Withdrawn requests now reuse the existing editor and original request ID.
Explicit “編輯並重送” buttons are shown on eligible request cards.

Backend preserves existing owner/manual-creator/admin authorization and optimistic
revision locking. Pending/closed cases remain locked against full edits.
Submission recomputes initial status and refreshes project approval configuration.
submittedAt is generated server-side for each submission; the portal timeline
ignores approval events before that submission. Historical audit records remain.
This does not resubmit or approve any production request on behalf of its owner.

Verification: finance API tests include withdrawn owner resubmission, new amount,
same ID, incremented revision, renewed timestamp, first applicable approval stage,
pending/closed edit rejection and unrelated-member rejection. Existing project
snapshot/approval transition tests are retained.
