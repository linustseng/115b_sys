const SHEETS = {
  events: "Events",
  registrations: "Registrations",
  students: "Students",
  checkins: "Checkins",
  shortLinks: "ShortLinks",
  directory: "Directory",
  admins: "AdminUsers",
};

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    if (!payload.action) {
      return jsonResponse(400, null, "Missing action");
    }

    return handleAction_(payload);
  } catch (error) {
    return jsonResponse(500, null, error.message || "Unexpected error");
  }
}

function doGet(e) {
  try {
    const payload = parseGetPayload_(e);
    if (!payload.action) {
      return jsonpResponse_(e, { ok: true, data: { service: "ntu-emba-115b" }, error: null });
    }
    return jsonpResponse_(e, handleActionPayload_(payload));
  } catch (error) {
    return jsonpResponse_(e, { ok: false, data: null, error: error.message || "Unexpected error" });
  }
}

function handleAction_(payload) {
  const result = handleActionPayload_(payload);
  return jsonResponse(result.ok ? 200 : 400, result.data, result.error);
}

function handleActionPayload_(payload) {
  if (payload.action === "lookupStudent") {
    const email = normalizeEmail_(payload.email);
    if (!email) {
      return { ok: false, data: null, error: "Missing email" };
    }
    const directory = findDirectoryByEmail_(email);
    if (!directory) {
      return { ok: false, data: null, error: "Student not found" };
    }
    const student = directory.id ? findStudentById_(directory.id) : null;
    if (!student) {
      return { ok: false, data: null, error: "Student not found" };
    }
    return { ok: true, data: { student: buildStudentProfile_(student, directory, email) }, error: null };
  }

  if (payload.action === "verifyGoogle") {
    const idToken = String(payload.idToken || "").trim();
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    const profile = verifyGoogleIdToken_(idToken);
    const linkedStudent = findStudentByGoogleSub_(profile.sub);
    const linkedDirectory = linkedStudent ? findDirectoryById_(linkedStudent.id) : null;
    if (linkedStudent && (!linkedDirectory || !linkedDirectory.email)) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    const linkedProfile = linkedStudent
      ? buildStudentProfile_(linkedStudent, linkedDirectory, profile.email)
      : null;
    let emailMatch = null;
    if (!linkedStudent && profile.email) {
      const directory = findDirectoryByEmail_(profile.email);
      if (directory && directory.id) {
        const student = findStudentById_(directory.id);
        if (student) {
          emailMatch = buildStudentProfile_(student, directory, profile.email);
        }
      }
    }
    return {
      ok: true,
      data: { profile: profile, student: linkedProfile, emailMatch: emailMatch },
      error: null,
    };
  }

  if (payload.action === "linkGoogleStudent") {
    const idToken = String(payload.idToken || "").trim();
    const studentId = String(payload.studentId || "").trim();
    if (!idToken || !studentId) {
      return { ok: false, data: null, error: "Missing idToken or studentId" };
    }
    const profile = verifyGoogleIdToken_(idToken);
    const existingLinked = findStudentByGoogleSub_(profile.sub);
    if (existingLinked && String(existingLinked.id || "").trim() !== studentId) {
      return { ok: false, data: null, error: "Google account already linked" };
    }
    const target = findStudentById_(studentId);
    if (!target) {
      return { ok: false, data: null, error: "Student not found" };
    }
    if (target.googleSub && String(target.googleSub).trim() !== profile.sub) {
      return { ok: false, data: null, error: "Student already linked" };
    }
    const updated = updateStudent_(studentId, {
      googleSub: profile.sub,
      googleEmail: profile.email,
    });
    const directory = findDirectoryById_(studentId);
    if (!directory || !directory.email) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    const combined = buildStudentProfile_(updated || target, directory, profile.email);
    return { ok: true, data: { student: combined }, error: null };
  }

  if (payload.action === "searchStudents") {
    const idToken = String(payload.idToken || "").trim();
    const query = String(payload.query || "").trim();
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    verifyGoogleIdToken_(idToken);
    if (!query || query.length < 2) {
      return { ok: true, data: { students: [] }, error: null };
    }
    return { ok: true, data: { students: searchStudents_(query, 10) }, error: null };
  }

  if (payload.action === "getEvent") {
    const eventId = String(payload.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }
    return { ok: true, data: { event: event }, error: null };
  }

  if (payload.action === "listEvents") {
    const events = listEvents_();
    return { ok: true, data: { events: events }, error: null };
  }

  if (payload.action === "createEvent") {
    const data = payload.data || {};
    const eventId = String(data.id || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing event id" };
    }
    if (findEventById_(eventId)) {
      return { ok: false, data: null, error: "Event already exists" };
    }
    const created = appendEvent_(data);
    return { ok: true, data: { event: created }, error: null };
  }

  if (payload.action === "updateEvent") {
    const data = payload.data || {};
    const eventId = String(data.id || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing event id" };
    }
    const updated = updateEvent_(eventId, data);
    if (!updated) {
      return { ok: false, data: null, error: "Event not found" };
    }
    return { ok: true, data: { event: updated }, error: null };
  }

  if (payload.action === "deleteEvent") {
    const eventId = String(payload.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    const removed = deleteEvent_(eventId);
    if (!removed) {
      return { ok: false, data: null, error: "Event not found" };
    }
    return { ok: true, data: { eventId: eventId }, error: null };
  }

  if (payload.action === "listStudents") {
    return { ok: true, data: { students: listStudents_() }, error: null };
  }

  if (payload.action === "createStudent") {
    const data = payload.data || {};
    const studentId = String(data.id || "").trim();
    if (!studentId) {
      return { ok: false, data: null, error: "Missing id" };
    }
    if (findStudentById_(studentId)) {
      return { ok: false, data: null, error: "Student already exists" };
    }
    const created = appendStudent_(data);
    return { ok: true, data: { student: created }, error: null };
  }

  if (payload.action === "updateStudent") {
    const data = payload.data || {};
    const studentId = String(data.id || "").trim();
    if (!studentId) {
      return { ok: false, data: null, error: "Missing id" };
    }
    const updated = updateStudent_(studentId, data);
    if (!updated) {
      return { ok: false, data: null, error: "Student not found" };
    }
    return { ok: true, data: { student: updated }, error: null };
  }

  if (payload.action === "deleteStudent") {
    const studentId = String(payload.id || "").trim();
    if (!studentId) {
      return { ok: false, data: null, error: "Missing id" };
    }
    const removed = deleteStudent_(studentId);
    if (!removed) {
      return { ok: false, data: null, error: "Student not found" };
    }
    return { ok: true, data: { id: studentId }, error: null };
  }

  if (payload.action === "listRegistrations") {
    return { ok: true, data: { registrations: listRegistrations_() }, error: null };
  }

  if (payload.action === "getRegistrationByEmail") {
    const eventId = String(payload.eventId || "").trim();
    const email = normalizeEmail_(payload.email);
    if (!eventId || !email) {
      return { ok: false, data: null, error: "Missing eventId or email" };
    }
    const registration = findRegistrationByEmail_(eventId, email);
    if (!registration) {
      return { ok: false, data: null, error: "Registration not found" };
    }
    return { ok: true, data: { registration: registration }, error: null };
  }

  if (payload.action === "updateRegistration") {
    const data = payload.data || {};
    const registrationId = String(data.id || "").trim();
    if (!registrationId) {
      return { ok: false, data: null, error: "Missing registration id" };
    }
    const updated = updateRegistration_(registrationId, data);
    if (!updated) {
      return { ok: false, data: null, error: "Registration not found" };
    }
    return { ok: true, data: { registration: updated }, error: null };
  }

  if (payload.action === "deleteRegistration") {
    const registrationId = String(payload.id || "").trim();
    if (!registrationId) {
      return { ok: false, data: null, error: "Missing registration id" };
    }
    const removed = deleteRegistration_(registrationId);
    if (!removed) {
      return { ok: false, data: null, error: "Registration not found" };
    }
    return { ok: true, data: { id: registrationId }, error: null };
  }

  if (payload.action === "listCheckins") {
    return { ok: true, data: { checkins: listCheckins_() }, error: null };
  }

  if (payload.action === "deleteCheckin") {
    const checkinId = String(payload.id || "").trim();
    if (!checkinId) {
      return { ok: false, data: null, error: "Missing checkin id" };
    }
    const removed = deleteCheckin_(checkinId);
    if (!removed) {
      return { ok: false, data: null, error: "Checkin not found" };
    }
    return { ok: true, data: { id: checkinId }, error: null };
  }

  if (payload.action === "listShortLinks") {
    return { ok: true, data: { shortLinks: listShortLinks_() }, error: null };
  }

  if (payload.action === "createShortLink") {
    const data = payload.data || {};
    let slug = String(data.slug || "").trim();
    if (!slug) {
      return { ok: false, data: null, error: "Missing slug" };
    }
    if (findShortLinkBySlug_(slug)) {
      return { ok: false, data: null, error: "ShortLink already exists" };
    }
    const created = appendShortLink_(data);
    return { ok: true, data: { shortLink: created }, error: null };
  }

  if (payload.action === "updateShortLink") {
    const data = payload.data || {};
    const slug = String(data.slug || "").trim();
    if (!slug) {
      return { ok: false, data: null, error: "Missing slug" };
    }
    const updated = updateShortLink_(slug, data);
    if (!updated) {
      return { ok: false, data: null, error: "ShortLink not found" };
    }
    return { ok: true, data: { shortLink: updated }, error: null };
  }

  if (payload.action === "deleteShortLink") {
    const slug = String(payload.slug || "").trim();
    if (!slug) {
      return { ok: false, data: null, error: "Missing slug" };
    }
    const removed = deleteShortLink_(slug);
    if (!removed) {
      return { ok: false, data: null, error: "ShortLink not found" };
    }
    return { ok: true, data: { slug: slug }, error: null };
  }

  if (payload.action === "login") {
    const email = normalizeEmail_(payload.email);
    const password = String(payload.password || "");
    if (!email || !password) {
      return { ok: false, data: null, error: "Missing credentials" };
    }
    const admin = findAdminByEmail_(email);
    if (!admin) {
      return { ok: false, data: null, error: "Invalid credentials" };
    }
    const hash = hashPassword_(password);
    if (String(admin.passwordHash || "") !== hash) {
      return { ok: false, data: null, error: "Invalid credentials" };
    }
    const token = createAuthToken_(email);
    return { ok: true, data: { token: token, email: email }, error: null };
  }

  if (payload.action === "listDirectory") {
    const auth = requireAuth_(payload);
    if (!auth.ok) {
      return auth;
    }
    return { ok: true, data: { directory: listDirectory_() }, error: null };
  }

  if (payload.action === "upsertDirectory") {
    const auth = requireAuth_(payload);
    if (!auth.ok) {
      return auth;
    }
    const items = payload.items || [];
    if (!items.length) {
      return { ok: false, data: null, error: "Empty items" };
    }
    const result = upsertDirectoryBatch_(items);
    return { ok: true, data: result, error: null };
  }

  if (payload.action === "register") {
    const data = payload.data || {};
    const eventId = String(data.eventId || "").trim();
    const email = normalizeEmail_(data.userEmail || data.email);
    if (!eventId || !email) {
      return { ok: false, data: null, error: "Missing eventId or email" };
    }

    const slug = String(data.slug || "").trim();
    if (slug) {
      const link = findShortLinkBySlug_(slug, "register");
      if (!link || String(link.eventId || "").trim() !== eventId) {
        return { ok: false, data: null, error: "Registration link expired" };
      }
    }

    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }

    const status = (event.status || "").toLowerCase();
    if (status && status !== "open") {
      return { ok: false, data: null, error: "Event is not open" };
    }

    if (!isWithinWindow_(event.registrationOpenAt, event.registrationCloseAt)) {
      return { ok: false, data: null, error: "Registration window closed" };
    }

    if (isDuplicateRegistration_(eventId, email)) {
      return { ok: false, data: null, error: "Duplicate registration" };
    }

    const capacity = parseInt(event.capacity || "0", 10);
    if (capacity > 0) {
      const currentCount = countRegistrations_(eventId);
      if (currentCount >= capacity) {
        return { ok: false, data: null, error: "Event is full" };
      }
    }

    const registrationId = appendRegistration_(eventId, data, email);
    return { ok: true, data: { registrationId: registrationId }, error: null };
  }

  if (payload.action === "checkin") {
    const data = payload.data || {};
    const eventId = String(data.eventId || "").trim();
    const email = normalizeEmail_(data.userEmail || data.email);
    if (!eventId || !email) {
      return { ok: false, data: null, error: "Missing eventId or email" };
    }

    const slug = String(data.slug || "").trim();
    if (slug) {
      const link = findShortLinkBySlug_(slug, "checkin");
      if (!link || String(link.eventId || "").trim() !== eventId) {
        return { ok: false, data: null, error: "QRCode expired" };
      }
    }

    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }

    if (!event.checkinUrl) {
      return { ok: false, data: null, error: "Check-in link not configured" };
    }
    if (!isWithinWindow_(event.checkinOpenAt, event.checkinCloseAt)) {
      return { ok: false, data: null, error: "Check-in window closed" };
    }

    const registration = findRegistrationByEmail_(eventId, email);
    if (!registration) {
      return { ok: false, data: null, error: "Registration not found" };
    }

    const customFields = parseCustomFields_(registration.customFields);
    const attendance = String(customFields.attendance || "").trim();
    if (!attendance) {
      return { ok: false, data: null, error: "Attendance not confirmed" };
    }
    if (attendance !== "出席") {
      return { ok: false, data: null, error: "Not attending" };
    }

    if (isDuplicateCheckin_(eventId, registration.id)) {
      return { ok: false, data: null, error: "Already checked in" };
    }

    const checkin = appendCheckin_(eventId, registration.id);
    return {
      ok: true,
      data: {
        userName: registration.userName || "",
        checkinId: checkin.id,
        checkinAt: checkin.checkinAt || "",
      },
      error: null,
    };
  }

  if (payload.action === "listCheckinStatus") {
    const email = normalizeEmail_(payload.email);
    const eventIds = Array.isArray(payload.eventIds) ? payload.eventIds : [];
    if (!email) {
      return { ok: false, data: null, error: "Missing email" };
    }
    if (!eventIds.length) {
      return { ok: true, data: { statuses: {} }, error: null };
    }
    const statuses = {};
    for (var i = 0; i < eventIds.length; i++) {
      const eventId = String(eventIds[i] || "").trim();
      if (!eventId) {
        continue;
      }
      const registration = findRegistrationByEmail_(eventId, email);
      if (!registration) {
        statuses[eventId] = { status: "not_registered" };
        continue;
      }
      const customFields = parseCustomFields_(registration.customFields);
      const attendance = String(customFields.attendance || "").trim();
      if (!attendance) {
        statuses[eventId] = { status: "attendance_unknown", attendance: "" };
        continue;
      }
      if (attendance !== "出席") {
        statuses[eventId] = { status: "not_attending", attendance: attendance };
        continue;
      }
      const checkin = findCheckinByRegistration_(eventId, registration.id);
      if (checkin) {
        statuses[eventId] = {
          status: "checked_in",
          attendance: attendance,
          checkinId: checkin.id || "",
          checkinAt: checkin.checkinAt || "",
        };
      } else {
        statuses[eventId] = { status: "not_checked_in", attendance: attendance };
      }
    }
    return { ok: true, data: { statuses: statuses }, error: null };
  }

  return { ok: false, data: null, error: "Unsupported action" };
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Empty request body");
  }
  return JSON.parse(e.postData.contents);
}

function parseGetPayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return e && e.parameter ? e.parameter : {};
}

function jsonResponse(statusCode, data, errorMessage) {
  const payload = {
    ok: statusCode >= 200 && statusCode < 300,
    data: data || null,
    error: errorMessage || null,
  };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse_(e, payload) {
  const callback = e && e.parameter ? e.parameter.callback : null;
  const body = callback ? callback + "(" + JSON.stringify(payload) + ")" : JSON.stringify(payload);
  return ContentService.createTextOutput(body).setMimeType(
    callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON
  );
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneValue_(value) {
  if (value === null || value === undefined) {
    return "";
  }
  var raw = String(value).trim();
  if (!raw) {
    return "";
  }
  if (/^\d{9}$/.test(raw) && raw.charAt(0) !== "0") {
    return "0" + raw;
  }
  return raw;
}

function parseCustomFields_(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error("Missing sheet: " + name);
  }
  return sheet;
}

function getHeaderMap_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error("Sheet has no header row: " + sheet.getName());
  }
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const map = {};
  headers.forEach(function (header, index) {
    if (header) {
      map[String(header).trim()] = index;
    }
  });
  return map;
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error("Sheet has no header row: " + sheet.getName());
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function findStudentById_(studentId) {
  if (!studentId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.students);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Students sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === studentId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findDirectoryById_(directoryId) {
  if (!directoryId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    return null;
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === directoryId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findDirectoryByEmail_(email) {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const emailIndex = headerMap.email;
  if (emailIndex === undefined) {
    return null;
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = normalizeEmail_(row[emailIndex]);
    if (rowEmail === email) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findStudentByGoogleSub_(googleSub) {
  if (!googleSub) {
    return null;
  }
  const sheet = getSheet_(SHEETS.students);
  const headerMap = getHeaderMap_(sheet);
  const subIndex = headerMap.googleSub;
  if (subIndex === undefined) {
    return null;
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[subIndex] || "").trim() === googleSub) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findEventById_(eventId) {
  const sheet = getSheet_(SHEETS.events);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Events sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === eventId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function listEvents_() {
  const sheet = getSheet_(SHEETS.events);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listStudents_() {
  const sheet = getSheet_(SHEETS.students);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listRegistrations_() {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listCheckins_() {
  const sheet = getSheet_(SHEETS.checkins);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listShortLinks_() {
  const sheet = getSheet_(SHEETS.shortLinks);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listDirectory_() {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function appendEvent_(data) {
  const sheet = getSheet_(SHEETS.events);
  const headers = getHeaders_(sheet);
  const record = normalizeEventRecord_(data);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendStudent_(data) {
  const sheet = getSheet_(SHEETS.students);
  const headers = getHeaders_(sheet);
  const record = normalizeStudentRecord_(data);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function updateStudent_(studentId, data) {
  const sheet = getSheet_(SHEETS.students);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Students sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== studentId) {
      continue;
    }
    const record = normalizeStudentRecord_(Object.assign({}, mapRowToObject_(headerMap, row), data));
    const headers = getHeaders_(sheet);
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
    return record;
  }
  return null;
}

function deleteStudent_(studentId) {
  const sheet = getSheet_(SHEETS.students);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Students sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === studentId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function appendShortLink_(data) {
  const sheet = getSheet_(SHEETS.shortLinks);
  const headers = getHeaders_(sheet);
  const record = normalizeShortLinkRecord_(data);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function updateShortLink_(slug, data) {
  const sheet = getSheet_(SHEETS.shortLinks);
  const headerMap = getHeaderMap_(sheet);
  const slugIndex = headerMap.slug;
  if (slugIndex === undefined) {
    throw new Error("ShortLinks sheet missing slug column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowSlug = String(row[slugIndex]).trim();
    if (rowSlug !== slug) {
      continue;
    }
    const record = normalizeShortLinkRecord_(Object.assign({}, mapRowToObject_(headerMap, row), data));
    const headers = getHeaders_(sheet);
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
    return record;
  }
  return null;
}

function deleteShortLink_(slug) {
  const sheet = getSheet_(SHEETS.shortLinks);
  const headerMap = getHeaderMap_(sheet);
  const slugIndex = headerMap.slug;
  if (slugIndex === undefined) {
    throw new Error("ShortLinks sheet missing slug column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowSlug = String(row[slugIndex]).trim();
    if (rowSlug === slug) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function updateRegistration_(registrationId, data) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Registrations sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== registrationId) {
      continue;
    }
    const record = normalizeRegistrationRecord_(Object.assign({}, mapRowToObject_(headerMap, row), data));
    const headers = getHeaders_(sheet);
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
    return record;
  }
  return null;
}

function deleteRegistration_(registrationId) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Registrations sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === registrationId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function deleteCheckin_(checkinId) {
  const sheet = getSheet_(SHEETS.checkins);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Checkins sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === checkinId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function upsertDirectoryBatch_(items) {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  const emailIndex = headerMap.email;
  if (idIndex === undefined && emailIndex === undefined) {
    throw new Error("Directory sheet missing id/email column");
  }
  const headers = getHeaders_(sheet);
  const rows = getDataRows_(sheet);
  const indexById = {};
  const indexByEmail = {};
  for (var i = 0; i < rows.length; i++) {
    if (idIndex !== undefined) {
      const rowId = String(rows[i][idIndex] || "").trim();
      if (rowId) {
        indexById[rowId] = i;
      }
    }
    if (emailIndex !== undefined) {
      const rowEmail = normalizeEmail_(rows[i][emailIndex]);
      if (rowEmail) {
        indexByEmail[rowEmail] = i;
      }
    }
  }
  var created = 0;
  var updated = 0;
  items.forEach(function (item) {
    const record = normalizeDirectoryRecord_(item);
    if (!record.email) {
      return;
    }
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    var existingIndex = undefined;
    if (record.id && idIndex !== undefined && indexById.hasOwnProperty(record.id)) {
      existingIndex = indexById[record.id];
    } else if (record.email && emailIndex !== undefined && indexByEmail.hasOwnProperty(record.email)) {
      existingIndex = indexByEmail[record.email];
    }
    if (existingIndex !== undefined) {
      sheet.getRange(existingIndex + 2, 1, 1, headers.length).setValues([values]);
      updated += 1;
    } else {
      sheet.appendRow(values);
      created += 1;
    }
  });
  return { created: created, updated: updated };
}

function updateEvent_(eventId, data) {
  const sheet = getSheet_(SHEETS.events);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Events sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== eventId) {
      continue;
    }
    const record = normalizeEventRecord_(Object.assign({}, mapRowToObject_(headerMap, row), data));
    const headers = getHeaders_(sheet);
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
    return record;
  }
  return null;
}

function deleteEvent_(eventId) {
  const sheet = getSheet_(SHEETS.events);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Events sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === eventId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function normalizeEventRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    startAt: data.startAt || "",
    endAt: data.endAt || "",
    location: String(data.location || "").trim(),
    address: String(data.address || "").trim(),
    registrationOpenAt: data.registrationOpenAt || "",
    registrationCloseAt: data.registrationCloseAt || "",
    checkinOpenAt: data.checkinOpenAt || "",
    checkinCloseAt: data.checkinCloseAt || "",
    registerUrl: String(data.registerUrl || "").trim(),
    checkinUrl: String(data.checkinUrl || "").trim(),
    capacity: data.capacity || "",
    status: String(data.status || "draft").trim(),
    category: String(data.category || "gathering").trim(),
    formSchema: data.formSchema || "",
  };
}

function normalizeStudentRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    name: String(data.name || "").trim(),
    googleSub: String(data.googleSub || "").trim(),
    googleEmail: normalizeEmail_(data.googleEmail),
  };
}

function normalizeShortLinkRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    eventId: String(data.eventId || "").trim(),
    type: String(data.type || "").trim(),
    slug: String(data.slug || "").trim(),
    targetUrl: String(data.targetUrl || "").trim(),
    createdAt: data.createdAt || "",
  };
}

function normalizeRegistrationRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    eventId: String(data.eventId || "").trim(),
    userName: String(data.userName || "").trim(),
    userEmail: normalizeEmail_(data.userEmail),
    userPhone: data.userPhone || "",
    classYear: data.classYear || "",
    customFields: data.customFields || "",
    status: String(data.status || "registered").trim(),
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || new Date(),
  };
}

function normalizeDirectoryRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    group: String(data.group || "").trim(),
    email: normalizeEmail_(data.email),
    nameZh: String(data.nameZh || "").trim(),
    nameEn: String(data.nameEn || "").trim(),
    preferredName: String(data.preferredName || "").trim(),
    company: String(data.company || "").trim(),
    title: String(data.title || "").trim(),
    socialUrl: String(data.socialUrl || "").trim(),
    mobile: String(data.mobile || "").trim(),
    backupPhone: String(data.backupPhone || "").trim(),
    emergencyContact: String(data.emergencyContact || "").trim(),
    emergencyPhone: String(data.emergencyPhone || "").trim(),
    dietaryRestrictions: String(data.dietaryRestrictions || "").trim(),
  };
}

function findAdminByEmail_(email) {
  const sheet = getSheet_(SHEETS.admins);
  const headerMap = getHeaderMap_(sheet);
  const emailIndex = headerMap.email;
  if (emailIndex === undefined) {
    throw new Error("AdminUsers sheet missing email column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = normalizeEmail_(row[emailIndex]);
    if (rowEmail === email) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function hashPassword_(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return digest
    .map(function (byte) {
      const value = (byte < 0 ? byte + 256 : byte).toString(16);
      return value.length === 1 ? "0" + value : value;
    })
    .join("");
}

function createAuthToken_(email) {
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put("auth:" + token, email, 60 * 60 * 12);
  return token;
}

function requireAuth_(payload) {
  const token = String(payload.authToken || "").trim();
  if (!token) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  const cache = CacheService.getScriptCache();
  const email = cache.get("auth:" + token);
  if (!email) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  return { ok: true, data: { email: email }, error: null };
}

function findShortLinkBySlug_(slug, type) {
  const sheet = getSheet_(SHEETS.shortLinks);
  const headerMap = getHeaderMap_(sheet);
  const slugIndex = headerMap.slug;
  const typeIndex = headerMap.type;
  if (slugIndex === undefined) {
    throw new Error("ShortLinks sheet missing slug column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowSlug = String(row[slugIndex]).trim();
    if (rowSlug !== slug) {
      continue;
    }
    if (typeIndex !== undefined && type) {
      const rowType = String(row[typeIndex]).trim();
      if (rowType && rowType !== type) {
        continue;
      }
    }
    return mapRowToObject_(headerMap, row);
  }
  return null;
}

function countRegistrations_(eventId) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const eventIndex = headerMap.eventId;
  const statusIndex = headerMap.status;
  if (eventIndex === undefined) {
    throw new Error("Registrations sheet missing eventId column");
  }
  const rows = getDataRows_(sheet);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex]).trim() !== eventId) {
      continue;
    }
    if (statusIndex !== undefined && String(row[statusIndex]).toLowerCase() === "cancelled") {
      continue;
    }
    count += 1;
  }
  return count;
}

function isDuplicateRegistration_(eventId, email) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const eventIndex = headerMap.eventId;
  const emailIndex = headerMap.userEmail;
  const statusIndex = headerMap.status;
  if (eventIndex === undefined || emailIndex === undefined) {
    throw new Error("Registrations sheet missing eventId or userEmail column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex]).trim() !== eventId) {
      continue;
    }
    const rowEmail = normalizeEmail_(row[emailIndex]);
    if (rowEmail === email) {
      if (statusIndex !== undefined && String(row[statusIndex]).toLowerCase() === "cancelled") {
        continue;
      }
      return true;
    }
  }
  return false;
}

function appendRegistration_(eventId, data, email) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const headers = getHeaders_(sheet);
  const now = new Date();
  const values = new Array(headers.length).fill("");
  const record = {
    id: Utilities.getUuid(),
    eventId: eventId,
    userName: data.userName || data.name || "",
    userEmail: email,
    userPhone: data.userPhone || data.phone || "",
    classYear: data.classYear || "",
    customFields: JSON.stringify(data.customFields || {}),
    status: "registered",
    createdAt: now,
    updatedAt: now,
  };

  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });

  sheet.appendRow(values);
  return record.id;
}

function appendCheckin_(eventId, registrationId) {
  const sheet = getSheet_(SHEETS.checkins);
  const headers = getHeaders_(sheet);
  const now = new Date();
  const record = {
    id: Utilities.getUuid(),
    eventId: eventId,
    registrationId: registrationId,
    checkinAt: now,
    checkinMethod: "link",
  };
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function findRegistrationByEmail_(eventId, email) {
  const sheet = getSheet_(SHEETS.registrations);
  const headerMap = getHeaderMap_(sheet);
  const eventIndex = headerMap.eventId;
  const emailIndex = headerMap.userEmail;
  if (eventIndex === undefined || emailIndex === undefined) {
    throw new Error("Registrations sheet missing eventId or userEmail column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex]).trim() !== eventId) {
      continue;
    }
    const rowEmail = normalizeEmail_(row[emailIndex]);
    if (rowEmail === email) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function isDuplicateCheckin_(eventId, registrationId) {
  const sheet = getSheet_(SHEETS.checkins);
  const headerMap = getHeaderMap_(sheet);
  const eventIndex = headerMap.eventId;
  const registrationIndex = headerMap.registrationId;
  if (eventIndex === undefined || registrationIndex === undefined) {
    throw new Error("Checkins sheet missing eventId or registrationId column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex]).trim() !== eventId) {
      continue;
    }
    if (String(row[registrationIndex]).trim() === registrationId) {
      return true;
    }
  }
  return false;
}

function findCheckinByRegistration_(eventId, registrationId) {
  const sheet = getSheet_(SHEETS.checkins);
  const headerMap = getHeaderMap_(sheet);
  const eventIndex = headerMap.eventId;
  const registrationIndex = headerMap.registrationId;
  if (eventIndex === undefined || registrationIndex === undefined) {
    throw new Error("Checkins sheet missing eventId or registrationId column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex]).trim() !== eventId) {
      continue;
    }
    if (String(row[registrationIndex]).trim() === registrationId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function isWithinWindow_(openAt, closeAt) {
  if (!openAt && !closeAt) {
    return true;
  }
  const now = new Date().getTime();
  const openTime = openAt ? new Date(openAt).getTime() : null;
  const closeTime = closeAt ? new Date(closeAt).getTime() : null;
  if (openTime && !isNaN(openTime) && now < openTime) {
    return false;
  }
  if (closeTime && !isNaN(closeTime) && now > closeTime) {
    return false;
  }
  return true;
}

function mapRowToObject_(headerMap, row) {
  const result = {};
  Object.keys(headerMap).forEach(function (key) {
    result[key] = row[headerMap[key]];
  });
  return result;
}

function buildStudentProfile_(student, directory, fallbackEmail) {
  const preferredName = directory ? (directory.preferredName || directory.nameZh || directory.nameEn) : "";
  return {
    id: String((student && student.id) || (directory && directory.id) || "").trim(),
    name: String((student && student.name) || preferredName || "").trim(),
    email: normalizeEmail_((directory && directory.email) || fallbackEmail),
    nameZh: String((directory && directory.nameZh) || "").trim(),
    nameEn: String((directory && directory.nameEn) || "").trim(),
    preferredName: String((directory && directory.preferredName) || "").trim(),
    company: String((directory && directory.company) || "").trim(),
    title: String((directory && directory.title) || "").trim(),
    phone: normalizePhoneValue_(directory && directory.mobile),
    dietaryPreference: String((directory && directory.dietaryRestrictions) || "").trim(),
    group: String((directory && directory.group) || "").trim(),
  };
}

function searchStudents_(query, limit) {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const normalizedQuery = String(query || "").toLowerCase();
  const results = [];
  for (var i = 0; i < rows.length; i++) {
    const row = mapRowToObject_(headerMap, rows[i]);
    const haystack = [
      row.nameZh,
      row.nameEn,
      row.preferredName,
      row.email,
      row.company,
      row.title,
      row.group,
      row.id,
    ]
      .map(function (value) {
        return String(value || "").toLowerCase();
      })
      .join(" ");
    if (haystack.indexOf(normalizedQuery) !== -1) {
      results.push({
        id: String(row.id || "").trim(),
        name: row.preferredName || row.nameZh || row.nameEn || "",
        email: row.email || "",
        company: row.company || "",
        title: row.title || "",
        group: row.group || "",
      });
    }
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function verifyGoogleIdToken_(idToken) {
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("Invalid Google token");
  }
  const data = JSON.parse(response.getContentText());
  const aud = String(data.aud || "").trim();
  if (aud && !isAllowedGoogleClient_(aud)) {
    throw new Error("Invalid Google client");
  }
  const exp = parseInt(data.exp || "0", 10);
  if (exp && exp * 1000 < Date.now()) {
    throw new Error("Google token expired");
  }
  if (String(data.email_verified || "").toLowerCase() !== "true") {
    throw new Error("Google email not verified");
  }
  return {
    sub: String(data.sub || "").trim(),
    email: normalizeEmail_(data.email),
    name: String(data.name || "").trim(),
    picture: String(data.picture || "").trim(),
  };
}

function isAllowedGoogleClient_(aud) {
  const configured = getScriptProperty_("GOOGLE_CLIENT_ID");
  if (!configured) {
    return true;
  }
  const allowed = configured
    .split(",")
    .map(function (value) {
      return String(value || "").trim();
    })
    .filter(function (value) {
      return value;
    });
  if (!allowed.length) {
    return true;
  }
  return allowed.indexOf(aud) !== -1;
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function runBackendSelfTests() {
  const normalized = normalizeEmail_(" Test@Example.Com ");
  if (normalized !== "test@example.com") {
    throw new Error("normalizeEmail_ failed");
  }

  const now = new Date();
  const openAt = new Date(now.getTime() - 60 * 1000);
  const closeAt = new Date(now.getTime() + 60 * 1000);
  if (!isWithinWindow_(openAt, closeAt)) {
    throw new Error("isWithinWindow_ should be true");
  }

  const closedAt = new Date(now.getTime() - 60 * 1000);
  if (isWithinWindow_(openAt, closedAt)) {
    throw new Error("isWithinWindow_ should be false");
  }

  Logger.log("Backend self-tests passed");
}
