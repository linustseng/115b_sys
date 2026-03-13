# Frontend

## Environment
- `VITE_API_URL`: Node `/v1/action` endpoint
- `VITE_API_V2_URL`: Node API base URL
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `VITE_API_TIMEOUT_MS`: API timeout in milliseconds (optional, default `15000`)
- `VITE_API_READ_RETRY_LIMIT`: Retry count for read-only actions on timeout/network errors (optional, default `1`)
- `VITE_API_ENABLE_POST`: Enable POST transport for selected admin read actions (optional, set `1` to enable)
- `VITE_API_V2_READ_ENABLED`: Enable selected read actions to use Node API endpoints (optional, set `1`)
- `VITE_API_V2_WRITE_ENABLED`: Enable selected write actions to use Node API endpoints (optional, set `1`)
- `VITE_API_V2_TIMEOUT_MS`: Timeout for Node API path (optional, default same as `VITE_API_TIMEOUT_MS`)

## Local Dev
```bash
npm install
npm run dev
```
