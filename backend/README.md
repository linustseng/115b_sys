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
- Events: id, title, description, startAt, endAt, location, registrationOpenAt, registrationCloseAt, checkinOpenAt, checkinCloseAt, capacity, status, category, formSchema
- Registrations: id, eventId, userName, userEmail, userPhone, classYear, customFields, status, createdAt, updatedAt
- Students: id, name, googleSub, googleEmail
- Checkins: id, eventId, registrationId, checkinAt, checkinMethod
- ShortLinks: id, eventId, type, slug, targetUrl, createdAt
- Directory: id, group, email, nameZh, nameEn, preferredName, company, title, socialUrl, mobile, backupPhone, emergencyContact, emergencyPhone, dietaryRestrictions
- AdminUsers: id, name, email, role, passwordHash

`Students.id` should match `Directory.id` so the login can resolve profile details.

## Apps Script
Deploy as Web App and copy the URL into `frontend/.env` as `VITE_API_URL`.

## Google OAuth
Set Script Properties:
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID (comma-separated if multiple).

`searchStudents`, `verifyGoogle`, `linkGoogleStudent` require Google ID token (`idToken`) from the frontend.

## Short Links
- 報名連結: `/?eventId=EVT-...&slug=reg-...`
- 簽到連結: `/checkin?eventId=EVT-...&slug=chk-...`
ShortLinks 的 `type` 必須為 `register` 或 `checkin`，`slug` 需唯一。

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
