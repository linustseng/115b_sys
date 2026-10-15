# Registration timezone hotfix — 2026-10-15

The active event 26112016 stores registration_open_at as `2026-10-15T19:00` (datetime-local). Node's Date.parse interpreted this in the host timezone, shifting opening eight hours on UTC hosts. Explicitly interpret offset-free event window values as Asia/Taipei (+08:00), preserving Z/offset values. Both registration create/update and the existing shared check-in window use this parser. No database values or registration records were changed.

The registration page now retains registrationOpenAt and derives its badge from actual opening/closing bounds rather than status=open alone. No notification schedule or admin time settings changed. This patch does not change the separate notification todo date parser.

Verification: existing 60 API tests, 2 timezone regression tests across UTC/Asia-Taipei/America-New_York with opening/closing boundary assertions and UI/API agreement; 60 frontend tests; production build and server syntax check. No real registration submitted. The visible label is unit-tested/build-verified, not a new browser interaction test.
