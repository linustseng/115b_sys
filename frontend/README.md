# Frontend

## Environment
- `VITE_API_URL`: Apps Script Web App URL
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `VITE_API_TIMEOUT_MS`: API timeout in milliseconds (optional, default `15000`)
- `VITE_API_READ_RETRY_LIMIT`: Retry count for read-only actions on timeout/network errors (optional, default `1`)
- `VITE_API_ENABLE_POST`: Enable POST transport for selected admin read actions with JSONP fallback (optional, set `1` to enable)

## Local Dev
```bash
npm install
npm run dev
```
