# Backend Setup

## Google Sheets Templates
Create a Google Sheet with the following tabs and headers. You can copy from `backend/templates/*.csv`:

- Events
- Registrations
- Students
- Checkins
- ShortLinks
- Directory
- AdminUsers

## Required Columns
- Events: id, title, description, startAt, endAt, location, address, registrationOpenAt, registrationCloseAt, checkinOpenAt, checkinCloseAt, registerUrl, checkinUrl, capacity, status, category, formSchema
- Registrations: id, eventId, userName, userEmail, userPhone, classYear, customFields, status, createdAt, updatedAt
- Students: id, name, googleSub, googleEmail
- Checkins: id, eventId, registrationId, checkinAt, checkinMethod
- ShortLinks: id, eventId, type, slug, targetUrl, createdAt
- Directory: id, group, email, nameZh, nameEn, preferredName, company, title, socialUrl, mobile, backupPhone, emergencyContact, emergencyPhone, dietaryRestrictions
- AdminUsers: id, name, email, role, passwordHash

`Students.id` should match `Directory.id` so the login can resolve profile details.

活動簽到需要在 Events 設定 `checkinUrl`，未設定會回傳 `Check-in link not configured`。

## Group Codes
- A: 班代組
- B: 公關組
- C: 活動組
- D: 財會組
- E: 資訊組
- F: 學藝組
- G: 醫療組
- H: 體育主將組
- I: 美食組
- J: 班董
- K: 壘球隊

## Apps Script
Deploy as Web App and copy the URL into `frontend/.env` as `VITE_API_URL`.

## Google OAuth
Set Script Properties:
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID (comma-separated if multiple).
- `APP_BASE_URL`: Frontend base URL used to build approval links in email notifications (e.g. https://your-domain.com).

`searchStudents`, `verifyGoogle`, `linkGoogleStudent` require Google ID token (`idToken`) from the frontend.

## Short Links
- 報名連結: `/?eventId=EVT-...&slug=reg-...`
ShortLinks 目前用於報名連結。報名/簽到也可直接從 `Events.registerUrl` / `Events.checkinUrl` 取得。

## API Actions
- lookupStudent
- getEvent
- listEvents
- createEvent
- updateEvent
- deleteEvent
- listStudents
- createStudent
- updateStudent
- deleteStudent
- listRegistrations
- updateRegistration
- deleteRegistration
- listCheckins
- deleteCheckin
- listShortLinks
- createShortLink
- updateShortLink
- deleteShortLink
- login
- listDirectory
- upsertDirectory
- register
- checkin
- verifyGoogle
- linkGoogleStudent
- searchStudents

## Password Hash
`AdminUsers.passwordHash` uses SHA-256 hex. You can compute it in Apps Script with `hashPassword_` or any SHA-256 tool.
