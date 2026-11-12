# Large album read recovery

The prior read signed every object before returning the list. A single failed batch failed the entire album. New clients request metadataOnly=1, preserving membership/status filtering but issuing no Storage requests (including cover signing) for that read. Existing clients retain bulk signatures.

Cards mount in increments of 40 with a load-more button. IntersectionObserver obtains fresh authorized URLs near the viewport through the existing three-lane queue. Viewer reads immediately. Missing signatures do not emit empty img src requests. One automatic image-error retry and explicit manual recovery remain. Originals are unchanged; this is NOT thumbnail generation or server-side pagination.

Validation: 65 frontend unit tests, Vite build, four API read/auth tests (DATABASE_URL=postgres://localhost/test node --test services/api/src/activityAlbumReadUrls.test.js services/api/src/activityAlbumRoutes.test.js). Browser fixture uses 677 rows at 390 and 1280 widths, checks 40/80 cards, on-demand reads and viewer navigation. Start Vite at 4178, run tools/verifyAlbumLargeReadUi.mjs with PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE pointing to installed Playwright/Chromium. No production data writes. Real affected album and physical devices still require authenticated verification.
