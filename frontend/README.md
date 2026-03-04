# Frontend

## Environment
- `VITE_API_URL`: Apps Script Web App URL
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `VITE_API_TIMEOUT_MS`: API timeout in milliseconds (optional, default `15000`)
- `VITE_API_READ_RETRY_LIMIT`: Retry count for read-only actions on timeout/network errors (optional, default `1`)
- `VITE_API_ENABLE_POST`: Enable POST transport for selected admin read actions with JSONP fallback (optional, set `1` to enable)
- `VITE_API_V2_URL`: Node API base URL for migration read path (optional)
- `VITE_API_V2_READ_ENABLED`: Enable selected read actions (`listEvents`, `listHomeBootstrap`, `listStudents`, `listGroupMemberships`, `lookupStudent`, `listMyMemberships`) to try Node API first and fallback to Apps Script (optional, set `1`)
- `VITE_API_V2_WRITE_ENABLED`: Enable selected write actions (`register`, `checkin`) to go through Node API write-through proxy first and fallback to Apps Script on transport failure (optional, set `1`)
- `VITE_API_V2_TIMEOUT_MS`: Timeout for Node API path (optional, default same as `VITE_API_TIMEOUT_MS`)

## Local Dev
```bash
npm install
npm run dev
```
