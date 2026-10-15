# Upload audit — 2026-10-15

Scope: all seven file-input upload surfaces in 115B frontend, their transport and terminal state handling, plus service-worker non-JSON upload bypass.

- Event reference attachment: already repaired by d2d1952; no remaining iframe/form-submit/uploadResult path.
- Documents, Finance self-service, Finance admin, Academics admin: authenticated multipart endpoint is correct; catch/finally or explicit error paths release busy state, but fetch had no deadline. All four now use bounded transport.
- Activity albums and cheerleading videos: signed PUT design is correct; intent/completion JSON calls and XHR had no deadline. JSON waits now end after 90 seconds (including response body); signed transfers abort after 90 seconds without byte progress. A continuously progressing large video is not cut off by a short fixed total duration. Final response wait is also bounded.
- Existing session fallback remains unchanged. Silent Google refresh immediately rejects by design; the shared apiRequest used for subsequent academic saves already has a timeout.
- No permission, storage limit, database, time-setting or notification change. No production file upload was performed.

Verification: 58 frontend tests, production build. `tools/verifyUploadTimeoutUi.mjs` uses a local Vite server on 4178 and an isolated component harness; all API and signed upload requests are intercepted. Six browser scenarios cover album/video intent, transfer and completion stalls, followed by successful retry. Supports PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE overrides. Transport unit tests cover stalled headers/body, HTTP errors, network failure, stalled PUT, progress resets, response wait and timer cleanup. The four multipart page UIs were source-audited; their shared transport is unit-tested, not individually real-cloud tested.

Hotfix: deploy frontend only. Revert this commit to roll back. An aborted browser request cannot prove the server did not finish; timeout text asks users to check completion before retrying.
