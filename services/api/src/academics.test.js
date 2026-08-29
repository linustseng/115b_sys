import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";

import { loadAcademicSessionsFromIcs } from "./academics.js";

const DETACHED_EXAM_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//115B//Academics Test//EN
BEGIN:VEVENT
UID:enterprise-decisions@example.com
DTSTART;TZID=Asia/Taipei:20260606T090000
DTEND;TZID=Asia/Taipei:20260606T124000
RRULE:FREQ=WEEKLY;COUNT=2
SUMMARY:[核必] 企業決策 02
LOCATION:玉山廳
END:VEVENT
BEGIN:VEVENT
UID:enterprise-decisions@example.com
RECURRENCE-ID;TZID=Asia/Taipei:20260613T090000
DTSTART;TZID=Asia/Taipei:20260912T090000
DTEND;TZID=Asia/Taipei:20260912T124000
SUMMARY:[期末考] 企業決策 02
LOCATION:玉山廳
END:VEVENT
END:VCALENDAR`;

test("includes a detached final-exam override as a session of its parent course", async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/calendar; charset=utf-8" });
    response.end(DETACHED_EXAM_ICS);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  const rows = await loadAcademicSessionsFromIcs(`http://127.0.0.1:${address.port}/calendar.ics`, {
    rangeStart: "2026-09-01",
    rangeEnd: "2026-09-30",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionDate, "2026-09-12");
  assert.equal(rows[0].title, "[核必] 企業決策");
  assert.equal(rows[0].location, "玉山廳");
});
