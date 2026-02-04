const SHEETS = {
  events: "Events",
  registrations: "Registrations",
  students: "Students",
  checkins: "Checkins",
  directory: "Directory",
  admins: "AdminUsers",
  orderPlans: "OrderPlans",
  orderResponses: "OrderResponses",
  financeRequests: "FinanceRequests",
  financeActions: "FinanceActions",
  groupMemberships: "GroupMemberships",
  financeRoles: "FinanceRoles",
  financeCategoryTypes: "FinanceCategoryTypes",
  fundEvents: "FundEvents",
  fundPayments: "FundPayments",
  softballPlayers: "SoftballPlayers",
  softballPractices: "SoftballPractices",
  softballAttendance: "SoftballAttendance",
  softballFields: "SoftballFields",
  softballGear: "SoftballGear",
  softballConfig: "SoftballConfig",
};

function doPost(e) {
  try {
    if (e && e.postData && e.postData.type && e.postData.type.indexOf("multipart/form-data") === 0) {
      return handleUpload_(e);
    }
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

function getCachedJson_(key, ttlSeconds, loader) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // fall through and refresh
    }
  }
  const data = loader();
  cache.put(key, JSON.stringify(data || null), ttlSeconds);
  return data;
}

function invalidateCacheKeys_(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const sanitized = list
    .map(function (key) {
      return String(key || "").trim();
    })
    .filter(function (key) {
      return key;
    });
  if (!sanitized.length) {
    return;
  }
  const cache = CacheService.getScriptCache();
  sanitized.forEach(function (key) {
    cache.remove(key);
  });
}

function listStudentsCached_() {
  return getCachedJson_("students:list:v1", 60, listStudents_);
}

function listGroupMembershipsCached_() {
  return getCachedJson_("groupMemberships:list:v1", 60, listGroupMemberships_);
}

function listFinanceRolesCached_() {
  return getCachedJson_("financeRoles:list:v1", 60, listFinanceRoles_);
}

function listFinanceCategoryTypesCached_() {
  return getCachedJson_("financeCategoryTypes:list:v1", 120, listFinanceCategoryTypes_);
}

function listFundEventsCached_() {
  return getCachedJson_("fundEvents:list:v1", 60, listFundEvents_);
}

function listEventsCached_() {
  return getCachedJson_("events:list:v1", 60, listEvents_);
}

function listSoftballPlayersCached_() {
  return getCachedJson_("softballPlayers:list:v1", 60, listSoftballPlayers_);
}

function listSoftballPracticesCached_() {
  return getCachedJson_("softballPractices:list:v1", 60, listSoftballPractices_);
}

function listSoftballFieldsCached_() {
  return getCachedJson_("softballFields:list:v1", 60, listSoftballFields_);
}

function listSoftballGearCached_() {
  return getCachedJson_("softballGear:list:v1", 60, listSoftballGear_);
}

function listSoftballConfigCached_() {
  return getCachedJson_("softballConfig:list:v1", 60, listSoftballConfig_);
}

function buildFundSummaryCached_() {
  return getCachedJson_("fundSummary:v1", 60, buildFundSummary_);
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

  if (payload.action === "listFinanceRequests") {
    return { ok: true, data: { requests: listFinanceRequests_(payload) }, error: null };
  }

  if (payload.action === "listAdminBootstrap") {
    return {
      ok: true,
      data: {
        events: listEventsCached_(),
        students: listStudentsCached_(),
        groupMemberships: listGroupMembershipsCached_(),
      },
      error: null,
    };
  }

  if (payload.action === "listFinanceBootstrap") {
    return {
      ok: true,
      data: {
        students: listStudentsCached_(),
        groupMemberships: listGroupMembershipsCached_(),
        categories: listFinanceCategoryTypesCached_(),
        fundEvents: listFundEventsCached_(),
      },
      error: null,
    };
  }

  if (payload.action === "listFinanceAdminBootstrap") {
    return {
      ok: true,
      data: {
        students: listStudentsCached_(),
        groupMemberships: listGroupMembershipsCached_(),
        roles: listFinanceRolesCached_(),
        categories: listFinanceCategoryTypesCached_(),
        fundEvents: listFundEventsCached_(),
        fundSummary: buildFundSummaryCached_(),
      },
      error: null,
    };
  }

  if (payload.action === "listSoftballBootstrap") {
    return {
      ok: true,
      data: {
        players: listSoftballPlayersCached_(),
        practices: listSoftballPracticesCached_(),
        fields: listSoftballFieldsCached_(),
        gear: listSoftballGearCached_(),
        config: listSoftballConfigCached_(),
      },
      error: null,
    };
  }

  if (payload.action === "createFinanceRequest") {
    const data = payload.data || {};
    const created = appendFinanceRequest_(data);
    if (created.status !== "draft") {
      appendFinanceAction_({
        requestId: created.id,
        action: "submit",
        actorRole: String(data.actorRole || "applicant"),
        actorName: String(data.actorName || created.applicantName || "").trim(),
        note: String(data.actorNote || "").trim(),
        fromStatus: "",
        toStatus: created.status,
      });
      sendFinanceApprovalEmail_(created);
    }
    return { ok: true, data: { request: created }, error: null };
  }

  if (payload.action === "updateFinanceRequest") {
    const requestId = String(payload.id || "").trim();
    if (!requestId) {
      return { ok: false, data: null, error: "Missing request id" };
    }
    const updated = updateFinanceRequestFlow_(requestId, payload);
    return { ok: true, data: { request: updated }, error: null };
  }

  if (payload.action === "listFinanceActions") {
    const requestId = String(payload.requestId || "").trim();
    if (!requestId) {
      return { ok: false, data: null, error: "Missing request id" };
    }
    return { ok: true, data: { actions: listFinanceActions_(requestId) }, error: null };
  }

  if (payload.action === "listFinanceActionsByActor") {
    const actorNames = Array.isArray(payload.actorNames)
      ? payload.actorNames
      : String(payload.actorName || "").trim()
      ? [String(payload.actorName || "").trim()]
      : [];
    if (!actorNames.length) {
      return { ok: false, data: null, error: "Missing actor names" };
    }
    return { ok: true, data: { actions: listFinanceActionsByActor_(actorNames) }, error: null };
  }

  if (payload.action === "listFinanceActionsSummary") {
    const requestIds = Array.isArray(payload.requestIds) ? payload.requestIds : [];
    if (!requestIds.length) {
      return { ok: false, data: null, error: "Missing request ids" };
    }
    return {
      ok: true,
      data: { summary: listFinanceActionsSummary_(requestIds) },
      error: null,
    };
  }

  if (payload.action === "listGroupMemberships") {
    return { ok: true, data: { memberships: listGroupMemberships_() }, error: null };
  }

  if (payload.action === "batchUpdateGroupMemberships") {
    const data = payload.data || {};
    const updated = batchUpdateGroupMemberships_(data);
    return { ok: true, data: { memberships: updated }, error: null };
  }

  if (payload.action === "upsertGroupMembership") {
    const data = payload.data || {};
    const updated = upsertGroupMembership_(data);
    return { ok: true, data: { membership: updated }, error: null };
  }

  if (payload.action === "deleteGroupMembership") {
    const membershipId = String(payload.id || "").trim();
    if (!membershipId) {
      return { ok: false, data: null, error: "Missing membership id" };
    }
    const removed = deleteGroupMembership_(membershipId);
    if (!removed) {
      return { ok: false, data: null, error: "Membership not found" };
    }
    return { ok: true, data: { id: membershipId }, error: null };
  }

  if (payload.action === "listFinanceRoles") {
    return { ok: true, data: { roles: listFinanceRoles_() }, error: null };
  }

  if (payload.action === "listFinanceCategoryTypes") {
    return { ok: true, data: { categories: listFinanceCategoryTypes_() }, error: null };
  }

  if (payload.action === "upsertFinanceCategoryType") {
    const data = payload.data || {};
    const updated = upsertFinanceCategoryType_(data);
    return { ok: true, data: { category: updated }, error: null };
  }

  if (payload.action === "deleteFinanceCategoryType") {
    const categoryId = String(payload.id || "").trim();
    if (!categoryId) {
      return { ok: false, data: null, error: "Missing category id" };
    }
    const removed = deleteFinanceCategoryType_(categoryId);
    if (!removed) {
      return { ok: false, data: null, error: "Category not found" };
    }
    return { ok: true, data: { id: categoryId }, error: null };
  }

  if (payload.action === "upsertFinanceRole") {
    const data = payload.data || {};
    const updated = upsertFinanceRole_(data);
    return { ok: true, data: { role: updated }, error: null };
  }

  if (payload.action === "deleteFinanceRole") {
    const roleId = String(payload.id || "").trim();
    if (!roleId) {
      return { ok: false, data: null, error: "Missing role id" };
    }
    const removed = deleteFinanceRole_(roleId);
    if (!removed) {
      return { ok: false, data: null, error: "Role not found" };
    }
    return { ok: true, data: { id: roleId }, error: null };
  }

  if (payload.action === "listFundEvents") {
    return { ok: true, data: { events: listFundEvents_() }, error: null };
  }

  if (payload.action === "listFundPayments") {
    const eventId = String(payload.eventId || "").trim();
    return { ok: true, data: { payments: listFundPayments_(eventId) }, error: null };
  }

  if (payload.action === "upsertFundEvent") {
    const data = payload.data || {};
    const updated = upsertFundEvent_(data);
    return { ok: true, data: { event: updated }, error: null };
  }

  if (payload.action === "upsertFundPayment") {
    const data = payload.data || {};
    const updated = upsertFundPayment_(data);
    return { ok: true, data: { payment: updated }, error: null };
  }

  if (payload.action === "deleteFundEvent") {
    const eventId = String(payload.id || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing event id" };
    }
    const removed = deleteFundEvent_(eventId);
    if (!removed) {
      return { ok: false, data: null, error: "Event not found" };
    }
    return { ok: true, data: { id: eventId }, error: null };
  }

  if (payload.action === "deleteFundPayment") {
    const paymentId = String(payload.id || "").trim();
    if (!paymentId) {
      return { ok: false, data: null, error: "Missing payment id" };
    }
    const removed = deleteFundPayment_(paymentId);
    if (!removed) {
      return { ok: false, data: null, error: "Payment not found" };
    }
    return { ok: true, data: { id: paymentId }, error: null };
  }

  if (payload.action === "getFundSummary") {
    return { ok: true, data: buildFundSummary_(), error: null };
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

  if (payload.action === "listOrderPlans") {
    const plans = listOrderPlans_();
    return { ok: true, data: { plans: plans }, error: null };
  }

  if (payload.action === "createOrderPlan") {
    const data = payload.data || {};
    if (!data.date) {
      return { ok: false, data: null, error: "Missing date" };
    }
    const created = createOrderPlan_(data);
    if (!created) {
      return { ok: false, data: null, error: "Order plan already exists" };
    }
    return { ok: true, data: { plan: created }, error: null };
  }

  if (payload.action === "updateOrderPlan") {
    const planId = String(payload.id || payload.orderId || "").trim();
    if (!planId) {
      return { ok: false, data: null, error: "Missing order plan id" };
    }
    const updated = updateOrderPlan_(planId, payload.data || {});
    if (!updated) {
      return { ok: false, data: null, error: "Order plan not found" };
    }
    return { ok: true, data: { plan: updated }, error: null };
  }

  if (payload.action === "listOrderResponses") {
    const orderId = String(payload.orderId || "").trim();
    const responses = listOrderResponses_(orderId);
    return { ok: true, data: { responses: responses }, error: null };
  }

  if (payload.action === "listOrderResponsesByStudent") {
    const studentId = String(payload.studentId || "").trim();
    if (!studentId) {
      return { ok: false, data: null, error: "Missing student id" };
    }
    const responses = listOrderResponsesByStudent_(studentId);
    return { ok: true, data: { responses: responses }, error: null };
  }

  if (payload.action === "submitOrderResponse") {
    const data = payload.data || {};
    const orderId = String(data.orderId || "").trim();
    const studentId = String(data.studentId || "").trim();
    const choice = String(data.choice || "").trim();
    if (!orderId || !studentId || !choice) {
      return { ok: false, data: null, error: "Missing orderId/studentId/choice" };
    }
    const plan = findOrderPlanById_(orderId);
    if (!plan) {
      return { ok: false, data: null, error: "Order plan not found" };
    }
    if (isOrderPlanClosed_(plan)) {
      return { ok: false, data: null, error: "Order plan closed" };
    }
    const response = upsertOrderResponse_(orderId, data);
    return { ok: true, data: { response: response }, error: null };
  }

  if (payload.action === "listSoftballPlayers") {
    return { ok: true, data: { players: listSoftballPlayers_() }, error: null };
  }

  if (payload.action === "listSoftballConfig") {
    return { ok: true, data: { config: getSoftballConfig_() }, error: null };
  }

  if (payload.action === "updateSoftballConfig") {
    const data = payload.data || {};
    const updated = updateSoftballConfig_(data);
    return { ok: true, data: { config: updated }, error: null };
  }

  if (payload.action === "createSoftballPlayer") {
    const data = payload.data || {};
    const created = upsertSoftballPlayer_(data, false);
    if (!created.ok) {
      return { ok: false, data: null, error: created.error };
    }
    return { ok: true, data: { player: created.player }, error: null };
  }

  if (payload.action === "updateSoftballPlayer") {
    const data = payload.data || {};
    const created = upsertSoftballPlayer_(data, true);
    if (!created.ok) {
      return { ok: false, data: null, error: created.error };
    }
    return { ok: true, data: { player: created.player }, error: null };
  }

  if (payload.action === "deleteSoftballPlayer") {
    const playerId = String(payload.id || "").trim();
    if (!playerId) {
      return { ok: false, data: null, error: "Missing player id" };
    }
    const removed = deleteSoftballPlayer_(playerId);
    if (!removed) {
      return { ok: false, data: null, error: "Player not found" };
    }
    return { ok: true, data: { id: playerId }, error: null };
  }

  if (payload.action === "listSoftballPractices") {
    return { ok: true, data: { practices: listSoftballPractices_() }, error: null };
  }

  if (payload.action === "createSoftballPractice") {
    const data = payload.data || {};
    if (!data.date) {
      return { ok: false, data: null, error: "Missing date" };
    }
    const created = createSoftballPractice_(data);
    return { ok: true, data: { practice: created }, error: null };
  }

  if (payload.action === "updateSoftballPractice") {
    const practiceId = String(payload.id || payload.practiceId || "").trim();
    if (!practiceId) {
      return { ok: false, data: null, error: "Missing practice id" };
    }
    const updated = updateSoftballPractice_(practiceId, payload.data || {});
    if (!updated) {
      return { ok: false, data: null, error: "Practice not found" };
    }
    return { ok: true, data: { practice: updated }, error: null };
  }

  if (payload.action === "deleteSoftballPractice") {
    const practiceId = String(payload.id || "").trim();
    if (!practiceId) {
      return { ok: false, data: null, error: "Missing practice id" };
    }
    const removed = deleteSoftballPractice_(practiceId);
    if (!removed) {
      return { ok: false, data: null, error: "Practice not found" };
    }
    return { ok: true, data: { id: practiceId }, error: null };
  }

  if (payload.action === "listSoftballFields") {
    return { ok: true, data: { fields: listSoftballFields_() }, error: null };
  }

  if (payload.action === "createSoftballField") {
    const data = payload.data || {};
    if (!data.name) {
      return { ok: false, data: null, error: "Missing field name" };
    }
    const created = createSoftballField_(data);
    return { ok: true, data: { field: created }, error: null };
  }

  if (payload.action === "updateSoftballField") {
    const fieldId = String(payload.id || "").trim();
    if (!fieldId) {
      return { ok: false, data: null, error: "Missing field id" };
    }
    const updated = updateSoftballField_(fieldId, payload.data || {});
    if (!updated) {
      return { ok: false, data: null, error: "Field not found" };
    }
    return { ok: true, data: { field: updated }, error: null };
  }

  if (payload.action === "deleteSoftballField") {
    const fieldId = String(payload.id || "").trim();
    if (!fieldId) {
      return { ok: false, data: null, error: "Missing field id" };
    }
    const removed = deleteSoftballField_(fieldId);
    if (!removed) {
      return { ok: false, data: null, error: "Field not found" };
    }
    return { ok: true, data: { id: fieldId }, error: null };
  }

  if (payload.action === "listSoftballGear") {
    return { ok: true, data: { gear: listSoftballGear_() }, error: null };
  }

  if (payload.action === "createSoftballGear") {
    const data = payload.data || {};
    if (!data.name) {
      return { ok: false, data: null, error: "Missing gear name" };
    }
    const created = createSoftballGear_(data);
    return { ok: true, data: { gear: created }, error: null };
  }

  if (payload.action === "updateSoftballGear") {
    const gearId = String(payload.id || "").trim();
    if (!gearId) {
      return { ok: false, data: null, error: "Missing gear id" };
    }
    const updated = updateSoftballGear_(gearId, payload.data || {});
    if (!updated) {
      return { ok: false, data: null, error: "Gear not found" };
    }
    return { ok: true, data: { gear: updated }, error: null };
  }

  if (payload.action === "deleteSoftballGear") {
    const gearId = String(payload.id || "").trim();
    if (!gearId) {
      return { ok: false, data: null, error: "Missing gear id" };
    }
    const removed = deleteSoftballGear_(gearId);
    if (!removed) {
      return { ok: false, data: null, error: "Gear not found" };
    }
    return { ok: true, data: { id: gearId }, error: null };
  }

  if (payload.action === "listSoftballAttendance") {
    const practiceId = String(payload.practiceId || "").trim();
    const items = listSoftballAttendance_(practiceId);
    return { ok: true, data: { attendance: items }, error: null };
  }

  if (payload.action === "submitSoftballAttendance") {
    const data = payload.data || {};
    const practiceId = String(data.practiceId || "").trim();
    const studentId = String(data.studentId || "").trim();
    if (!practiceId || !studentId) {
      return { ok: false, data: null, error: "Missing practiceId/studentId" };
    }
    const record = upsertSoftballAttendance_(data);
    return { ok: true, data: { attendance: record }, error: null };
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

  if (payload.action === "uploadBase64") {
    const eventId = String(payload.eventId || "").trim();
    const fileName = String(payload.fileName || "file").trim();
    const fileData = String(payload.fileData || "").trim();
    if (!eventId || !fileData) {
      return { ok: false, data: null, error: "Missing eventId or fileData" };
    }
    const bytes = Utilities.base64Decode(fileData);
    if (bytes.length > 5 * 1024 * 1024) {
      return { ok: false, data: null, error: "File exceeds 5MB limit" };
    }
    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }
    const file = DriveApp.createFile(bytes, fileName);
    file.setName(eventId + "-" + file.getName());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const attachment = {
      name: file.getName(),
      url: file.getUrl(),
      fileId: file.getId(),
    };
    const attachments = parseAttachments_(event.attachments);
    attachments.push(attachment);
    updateEvent_(eventId, { attachments: JSON.stringify(attachments) });
    return { ok: true, data: { attachment: attachment }, error: null };
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

function handleUpload_(e) {
  const blob = e && e.parameter ? e.parameter.file : null;
  if (!blob) {
    return ContentService.createTextOutput(
      "<script>window.parent.postMessage({type:'uploadResult',payload:{ok:false,error:'Missing file'}},'*');</script>"
    ).setMimeType(ContentService.MimeType.HTML);
  }
  const eventId = String((e && e.parameter && e.parameter.eventId) || "").trim();
  const folderId = String((e && e.parameter && e.parameter.folderId) || "").trim();
  var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
  var file = folder.createFile(blob);
  if (eventId) {
    file.setName(eventId + "-" + file.getName());
  }
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (eventId) {
    var eventRecord = findEventById_(eventId);
    if (eventRecord) {
      var attachments = parseAttachments_(eventRecord.attachments);
      attachments.push({ name: file.getName(), url: file.getUrl(), fileId: file.getId() });
      updateEvent_(eventId, { attachments: JSON.stringify(attachments) });
    }
  }
  var payload = {
    ok: true,
    data: {
      fileId: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
    },
    error: null,
  };
  var html =
    "<script>window.parent.postMessage({type:'uploadResult',payload:" +
    JSON.stringify(payload) +
    "},'*');</script>";
  return ContentService.createTextOutput(html).setMimeType(ContentService.MimeType.HTML);
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

function findOrderPlanById_(orderId) {
  const sheet = getSheet_(SHEETS.orderPlans);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("OrderPlans sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === orderId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findSoftballPlayerById_(playerId) {
  const sheet = getSheet_(SHEETS.softballPlayers);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPlayers sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === playerId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findSoftballPracticeById_(practiceId) {
  const sheet = getSheet_(SHEETS.softballPractices);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPractices sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === practiceId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findSoftballFieldById_(fieldId) {
  const sheet = getSheet_(SHEETS.softballFields);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballFields sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === fieldId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findSoftballGearById_(gearId) {
  const sheet = getSheet_(SHEETS.softballGear);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballGear sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === gearId) {
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

function listOrderPlans_() {
  const sheet = getSheet_(SHEETS.orderPlans);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listSoftballPlayers_() {
  const sheet = getSheet_(SHEETS.softballPlayers);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listSoftballPractices_() {
  const sheet = getSheet_(SHEETS.softballPractices);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listSoftballAttendance_(practiceId) {
  const sheet = getSheet_(SHEETS.softballAttendance);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet).map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  if (!practiceId) {
    return rows;
  }
  const target = String(practiceId).trim();
  return rows.filter(function (row) {
    return String(row.practiceId || "").trim() === target;
  });
}

function listSoftballFields_() {
  const sheet = getSheet_(SHEETS.softballFields);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listSoftballGear_() {
  const sheet = getSheet_(SHEETS.softballGear);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function getSoftballConfig_() {
  const sheet = getSheet_(SHEETS.softballConfig);
  const rows = getDataRows_(sheet);
  const config = {};
  rows.forEach(function (row) {
    const key = String(row[0] || "").trim();
    if (!key) {
      return;
    }
    config[key] = String(row[1] || "").trim();
  });
  return config;
}

function updateSoftballConfig_(data) {
  const sheet = getSheet_(SHEETS.softballConfig);
  const headers = getHeaders_(sheet);
  if (headers.length < 2) {
    throw new Error("SoftballConfig sheet missing key/value columns");
  }
  const rows = getDataRows_(sheet);
  const indexByKey = {};
  rows.forEach(function (row, index) {
    const key = String(row[0] || "").trim();
    if (key) {
      indexByKey[key] = index;
    }
  });
  Object.keys(data || {}).forEach(function (key) {
    const value = String(data[key] || "").trim();
    if (!key) {
      return;
    }
    if (indexByKey.hasOwnProperty(key)) {
      const rowIndex = indexByKey[key] + 2;
      sheet.getRange(rowIndex, 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });
  return getSoftballConfig_();
}

function listOrderResponses_(orderId) {
  const sheet = getSheet_(SHEETS.orderResponses);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet).map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  if (!orderId) {
    return rows;
  }
  const targetId = String(orderId).trim();
  return rows.filter(function (row) {
    return String(row.orderId || "").trim() === targetId;
  });
}

function listOrderResponsesByStudent_(studentId) {
  const sheet = getSheet_(SHEETS.orderResponses);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet).map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  const targetId = String(studentId || "").trim();
  return rows.filter(function (row) {
    return String(row.studentId || "").trim() === targetId;
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

function listDirectory_() {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listFinanceRequests_(payload) {
  const sheet = getSheet_(SHEETS.financeRequests);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const applicantEmail = normalizeEmail_(payload && payload.applicantEmail);
  const list = rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  const filtered = applicantEmail
    ? list.filter(function (item) {
        return normalizeEmail_(item.applicantEmail) === applicantEmail;
      })
    : list;
  return filtered.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function listFinanceActions_(requestId) {
  const sheet = getSheet_(SHEETS.financeActions);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const id = String(requestId || "").trim();
  const list = rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .filter(function (item) {
      return String(item.requestId || "").trim() === id;
    });
  return list.sort(function (a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function listFinanceActionsByActor_(actorNames) {
  const sheet = getSheet_(SHEETS.financeActions);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const nameIndex = headerMap.actorName;
  if (nameIndex === undefined) {
    throw new Error("FinanceActions sheet missing actorName column");
  }
  const normalized = (actorNames || [])
    .map(function (name) {
      return String(name || "").trim();
    })
    .filter(function (name) {
      return name;
    });
  if (!normalized.length) {
    return [];
  }
  const list = [];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const actorName = String(row[nameIndex] || "").trim();
    if (!actorName) {
      continue;
    }
    if (normalized.indexOf(actorName) === -1) {
      continue;
    }
    list.push(mapRowToObject_(headerMap, row));
  }
  return list.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function listFinanceActionsSummary_(requestIds) {
  const sheet = getSheet_(SHEETS.financeActions);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const idIndex = headerMap.requestId;
  if (idIndex === undefined) {
    throw new Error("FinanceActions sheet missing requestId column");
  }
  const idSet = (requestIds || []).reduce(function (acc, id) {
    const key = String(id || "").trim();
    if (key) {
      acc[key] = true;
    }
    return acc;
  }, {});
  const latestById = {};
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const requestId = String(row[idIndex] || "").trim();
    if (!requestId || !idSet[requestId]) {
      continue;
    }
    const item = mapRowToObject_(headerMap, row);
    const current = latestById[requestId];
    if (!current) {
      latestById[requestId] = item;
      continue;
    }
    const currentCreated = String(current.createdAt || "");
    const nextCreated = String(item.createdAt || "");
    if (nextCreated.localeCompare(currentCreated) > 0) {
      latestById[requestId] = item;
    }
  }
  return latestById;
}

function listGroupMemberships_() {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      var item = mapRowToObject_(headerMap, row);
      if (item && Object.prototype.hasOwnProperty.call(item, "personEmail")) {
        delete item.personEmail;
      }
      return item;
    })
    .sort(function (a, b) {
      return String(a.personName || "").localeCompare(String(b.personName || ""));
    });
}

function listFinanceRoles_() {
  const sheet = getSheet_(SHEETS.financeRoles);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .sort(function (a, b) {
      return String(a.personName || "").localeCompare(String(b.personName || ""));
    });
}

function listFinanceCategoryTypes_() {
  const sheet = getSheet_(SHEETS.financeCategoryTypes);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const list = rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  return list.sort(function (a, b) {
    const orderA = parseInt(a.sortOrder, 10);
    const orderB = parseInt(b.sortOrder, 10);
    if (!isNaN(orderA) || !isNaN(orderB)) {
      if (isNaN(orderA)) {
        return 1;
      }
      if (isNaN(orderB)) {
        return -1;
      }
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }
    return String(a.label || "").localeCompare(String(b.label || ""));
  });
}

function listFundEvents_() {
  const sheet = getSheet_(SHEETS.fundEvents);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .sort(function (a, b) {
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

function listFundPayments_(eventId) {
  const sheet = getSheet_(SHEETS.fundPayments);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const id = String(eventId || "").trim();
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .filter(function (item) {
      return !id || String(item.eventId || "").trim() === id;
    })
    .sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
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

function appendOrderPlan_(data) {
  const sheet = getSheet_(SHEETS.orderPlans);
  const headers = getHeaders_(sheet);
  const record = normalizeOrderPlanRecord_(data);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFinanceRequest_(data) {
  const sheet = getSheet_(SHEETS.financeRequests);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFinanceId_();
  }
  if (!base.status || String(base.status).trim() === "") {
    base.status = "pending_lead";
  }
  if (String(base.status) !== "draft" && !base.submittedAt) {
    base.submittedAt = nowIso;
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeFinanceRequestRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFinanceAction_(data) {
  const sheet = getSheet_(SHEETS.financeActions);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFinanceActionId_();
  }
  base.createdAt = base.createdAt || nowIso;
  const record = normalizeFinanceActionRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendGroupMembership_(data) {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateGroupMembershipId_(base.personId, base.groupId, base.roleInGroup);
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeGroupMembershipRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFinanceRole_(data) {
  const sheet = getSheet_(SHEETS.financeRoles);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFinanceRoleId_(base.personId, base.role);
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeFinanceRoleRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFinanceCategoryType_(data) {
  const sheet = getSheet_(SHEETS.financeCategoryTypes);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFinanceCategoryTypeId_();
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeFinanceCategoryTypeRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFundEvent_(data) {
  const sheet = getSheet_(SHEETS.fundEvents);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFundEventId_();
  }
  if (!base.createdById && base.actorId) {
    base.createdById = base.actorId;
  }
  if (!base.updatedById && base.actorId) {
    base.updatedById = base.actorId;
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeFundEventRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendFundPayment_(data) {
  const sheet = getSheet_(SHEETS.fundPayments);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const base = Object.assign({}, data);
  if (!base.id) {
    base.id = generateFundPaymentId_();
  }
  if (!base.createdById && base.actorId) {
    base.createdById = base.actorId;
  }
  if (!base.updatedById && base.actorId) {
    base.updatedById = base.actorId;
  }
  base.createdAt = base.createdAt || nowIso;
  base.updatedAt = nowIso;
  const record = normalizeFundPaymentRecord_(base);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function appendSoftballRecord_(sheetName, data, normalizer) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const record = normalizer(data);
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

function upsertSoftballPlayer_(data, mustExist) {
  const sheet = getSheet_(SHEETS.softballPlayers);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPlayers sheet missing id column");
  }
  const playerId = String(data.id || data.studentId || "").trim();
  if (!playerId) {
    return { ok: false, error: "Missing player id" };
  }
  const existingRows = getDataRows_(sheet);
  const jerseyNumber = String(data.jerseyNumber || "").trim();
  if (jerseyNumber) {
    for (var j = 0; j < existingRows.length; j++) {
      const row = existingRows[j];
      const rowId = String(row[idIndex] || "").trim();
      if (rowId === playerId) {
        continue;
      }
      const rowRecord = mapRowToObject_(headerMap, row);
      if (String(rowRecord.jerseyNumber || "").trim() === jerseyNumber) {
        return { ok: false, error: "Jersey number already used" };
      }
    }
  }
  const nowIso = new Date().toISOString();
  for (var i = 0; i < existingRows.length; i++) {
    const row = existingRows[i];
    if (String(row[idIndex]).trim() !== playerId) {
      continue;
    }
    const record = normalizeSoftballPlayerRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, { id: playerId, updatedAt: nowIso })
    );
    const headers = getHeaders_(sheet);
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (record.hasOwnProperty(header)) {
        values[index] = record[header];
      }
    });
    sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
    return { ok: true, player: record };
  }
  if (mustExist) {
    return { ok: false, error: "Player not found" };
  }
  const record = normalizeSoftballPlayerRecord_(
    Object.assign({}, data, { id: playerId, createdAt: nowIso, updatedAt: nowIso })
  );
  const created = appendSoftballRecord_(SHEETS.softballPlayers, record, normalizeSoftballPlayerRecord_);
  return { ok: true, player: created };
}

function deleteSoftballPlayer_(playerId) {
  const sheet = getSheet_(SHEETS.softballPlayers);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPlayers sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === playerId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function createSoftballPractice_(data) {
  const existing = listSoftballPractices_();
  const practiceId = String(data.id || generateSoftballPracticeId_(data.date, existing)).trim();
  if (findSoftballPracticeById_(practiceId)) {
    return null;
  }
  const nowIso = new Date().toISOString();
  return appendSoftballRecord_(
    SHEETS.softballPractices,
    Object.assign({}, data, { id: practiceId, createdAt: nowIso, updatedAt: nowIso }),
    normalizeSoftballPracticeRecord_
  );
}

function updateSoftballPractice_(practiceId, data) {
  const sheet = getSheet_(SHEETS.softballPractices);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPractices sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== practiceId) {
      continue;
    }
    const record = normalizeSoftballPracticeRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, { id: practiceId, updatedAt: new Date().toISOString() })
    );
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

function deleteSoftballPractice_(practiceId) {
  const sheet = getSheet_(SHEETS.softballPractices);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballPractices sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === practiceId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function createSoftballField_(data) {
  const nowIso = new Date().toISOString();
  return appendSoftballRecord_(
    SHEETS.softballFields,
    Object.assign({}, data, { id: generateSoftballId_("FIELD"), createdAt: nowIso, updatedAt: nowIso }),
    normalizeSoftballFieldRecord_
  );
}

function updateSoftballField_(fieldId, data) {
  const sheet = getSheet_(SHEETS.softballFields);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballFields sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() !== fieldId) {
      continue;
    }
    const record = normalizeSoftballFieldRecord_(
      Object.assign({}, mapRowToObject_(headerMap, rows[i]), data, { id: fieldId, updatedAt: new Date().toISOString() })
    );
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

function deleteSoftballField_(fieldId) {
  const sheet = getSheet_(SHEETS.softballFields);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballFields sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === fieldId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function createSoftballGear_(data) {
  const nowIso = new Date().toISOString();
  return appendSoftballRecord_(
    SHEETS.softballGear,
    Object.assign({}, data, { id: generateSoftballId_("GEAR"), createdAt: nowIso, updatedAt: nowIso }),
    normalizeSoftballGearRecord_
  );
}

function updateSoftballGear_(gearId, data) {
  const sheet = getSheet_(SHEETS.softballGear);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballGear sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() !== gearId) {
      continue;
    }
    const record = normalizeSoftballGearRecord_(
      Object.assign({}, mapRowToObject_(headerMap, rows[i]), data, { id: gearId, updatedAt: new Date().toISOString() })
    );
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

function deleteSoftballGear_(gearId) {
  const sheet = getSheet_(SHEETS.softballGear);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("SoftballGear sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === gearId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function upsertSoftballAttendance_(data) {
  const sheet = getSheet_(SHEETS.softballAttendance);
  const headerMap = getHeaderMap_(sheet);
  const practiceIndex = headerMap.practiceId;
  const studentIndex = headerMap.studentId;
  if (practiceIndex === undefined || studentIndex === undefined) {
    throw new Error("SoftballAttendance sheet missing practiceId/studentId");
  }
  const rows = getDataRows_(sheet);
  const practiceId = String(data.practiceId || "").trim();
  const studentId = String(data.studentId || "").trim();
  const nowIso = new Date().toISOString();
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (
      String(row[practiceIndex] || "").trim() === practiceId &&
      String(row[studentIndex] || "").trim() === studentId
    ) {
      const record = normalizeSoftballAttendanceRecord_(
        Object.assign({}, mapRowToObject_(headerMap, row), data, { updatedAt: nowIso })
      );
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
  }
  const record = normalizeSoftballAttendanceRecord_(
    Object.assign({}, data, { id: practiceId + "-" + studentId, createdAt: nowIso, updatedAt: nowIso })
  );
  const headers = getHeaders_(sheet);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function createOrderPlan_(data) {
  const existing = listOrderPlans_();
  const orderId = String(data.id || generateOrderPlanId_(data.date, existing)).trim();
  if (findOrderPlanById_(orderId)) {
    return null;
  }
  const nowIso = new Date().toISOString();
  return appendOrderPlan_(Object.assign({}, data, { id: orderId, createdAt: nowIso, updatedAt: nowIso }));
}

function updateOrderPlan_(orderId, data) {
  const sheet = getSheet_(SHEETS.orderPlans);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("OrderPlans sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== orderId) {
      continue;
    }
    const nextData = Object.assign({}, mapRowToObject_(headerMap, row), data, {
      updatedAt: new Date().toISOString(),
    });
    const record = normalizeOrderPlanRecord_(nextData);
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

function findFinanceRequestById_(requestId) {
  if (!requestId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.financeRequests);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceRequests sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === requestId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function updateFinanceRequest_(requestId, data) {
  const sheet = getSheet_(SHEETS.financeRequests);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceRequests sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== requestId) {
      continue;
    }
    const record = normalizeFinanceRequestRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, { id: requestId })
    );
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
  throw new Error("Finance request not found");
}

function updateFinanceRequestFlow_(requestId, payload) {
  const existing = findFinanceRequestById_(requestId);
  if (!existing) {
    throw new Error("Finance request not found");
  }
  const nowIso = new Date().toISOString();
  const action = String(payload.requestAction || payload.flowAction || payload.actionType || "")
    .trim()
    .toLowerCase();
  const actorRole = String(payload.actorRole || "").trim();
  const actorName = String(payload.actorName || "").trim();
  const actorNote = String(payload.actorNote || "").trim();
  const data = payload.data || {};
  const merged = Object.assign({}, existing, data);
  let nextStatus = String(merged.status || existing.status || "").trim();
  if (action === "submit") {
    nextStatus = "pending_lead";
    merged.submittedAt = nowIso;
  } else if (action === "withdraw") {
    nextStatus = "withdrawn";
  } else if (action === "return") {
    nextStatus = "returned";
  } else if (action === "approve") {
    nextStatus = resolveFinanceNextStatus_(merged, actorRole);
  }
  merged.status = nextStatus || merged.status || existing.status;
  merged.updatedAt = nowIso;
  const updated = updateFinanceRequest_(requestId, merged);
  if (action) {
    appendFinanceAction_({
      requestId: requestId,
      action: action,
      actorRole: actorRole,
      actorName: actorName,
      note: actorNote,
      fromStatus: existing.status || "",
      toStatus: updated.status || "",
    });
  }
  if (action === "submit" || action === "approve") {
    sendFinanceApprovalEmail_(updated);
  } else if (action === "return") {
    sendFinanceReturnEmail_(updated, actorName, actorNote);
  }
  return updated;
}

function upsertGroupMembership_(data) {
  const membershipId = String(data.id || "").trim();
  const groupId = String(data.groupId || "").trim();
  const roleInGroup = String(data.roleInGroup || "").trim();
  if (groupId === "A" && roleInGroup === "lead") {
    const existingLead = findGroupLead_("A", membershipId);
    if (existingLead) {
      throw new Error("班代組只能有一位班代");
    }
  }
  if (membershipId) {
    const existing = findGroupMembershipById_(membershipId);
    if (existing) {
      const updated = updateGroupMembership_(membershipId, data);
      invalidateCacheKeys_(["groupMemberships:list:v1"]);
      return updated;
    }
  }
  const created = appendGroupMembership_(data);
  invalidateCacheKeys_(["groupMemberships:list:v1"]);
  return created;
}

function batchUpdateGroupMemberships_(data) {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headers = getHeaders_(sheet);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("GroupMemberships sheet missing id column");
  }

  const rows = getDataRows_(sheet);
  const nowIso = new Date().toISOString();
  const deleteIds = (data && data.toDeleteIds ? data.toDeleteIds : [])
    .map(function (id) {
      return String(id || "").trim();
    })
    .filter(function (id) {
      return id;
    });
  const deleteSet = {};
  deleteIds.forEach(function (id) {
    deleteSet[id] = true;
  });

  const existingList = rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
  const existingById = {};
  existingList.forEach(function (item) {
    const id = String(item.id || "").trim();
    if (id) {
      existingById[id] = item;
    }
  });

  const keepList = existingList.filter(function (item) {
    const id = String(item.id || "").trim();
    return !id || !deleteSet[id];
  });

  const upsertList = Array.isArray(data && data.toUpsert) ? data.toUpsert : [];
  const upsertById = {};
  upsertList.forEach(function (item) {
    const personId = String(item.personId || "").trim();
    const groupId = String(item.groupId || "").trim();
    const roleInGroup = String(item.roleInGroup || "").trim();
    const id =
      String(item.id || "").trim() || generateGroupMembershipId_(personId, groupId, roleInGroup);
    const base = Object.assign({}, existingById[id] || {}, item, {
      id: id,
      updatedAt: nowIso,
    });
    if (!base.createdAt) {
      base.createdAt = nowIso;
    }
    upsertById[id] = normalizeGroupMembershipRecord_(base);
  });

  const finalList = [];
  keepList.forEach(function (item) {
    const id = String(item.id || "").trim();
    if (id && upsertById[id]) {
      finalList.push(upsertById[id]);
      delete upsertById[id];
      return;
    }
    finalList.push(item);
  });
  Object.keys(upsertById).forEach(function (id) {
    finalList.push(upsertById[id]);
  });

  const groupALeads = finalList.filter(function (item) {
    return String(item.groupId || "").trim() === "A" && String(item.roleInGroup || "") === "lead";
  });
  if (groupALeads.length > 1) {
    throw new Error("班代組只能有一位班代");
  }

  if (!finalList.length) {
    if (rows.length) {
      sheet.getRange(2, 1, rows.length, headers.length).clearContent();
    }
    return [];
  }

  const values = finalList.map(function (record) {
    const normalized = normalizeGroupMembershipRecord_(record);
    const rowValues = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (normalized.hasOwnProperty(header)) {
        rowValues[index] = normalized[header];
      }
    });
    return rowValues;
  });

  sheet.getRange(2, 1, finalList.length, headers.length).setValues(values);
  if (rows.length > finalList.length) {
    sheet
      .getRange(2 + finalList.length, 1, rows.length - finalList.length, headers.length)
      .clearContent();
  }
  invalidateCacheKeys_(["groupMemberships:list:v1"]);
  return finalList;
}

function updateGroupMembership_(membershipId, data) {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("GroupMemberships sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== membershipId) {
      continue;
    }
    const record = normalizeGroupMembershipRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, {
        id: membershipId,
        updatedAt: new Date().toISOString(),
      })
    );
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
  throw new Error("Membership not found");
}

function deleteGroupMembership_(membershipId) {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("GroupMemberships sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === membershipId) {
      sheet.deleteRow(i + 2);
      invalidateCacheKeys_(["groupMemberships:list:v1"]);
      return true;
    }
  }
  return false;
}

function upsertFinanceRole_(data) {
  const roleId = String(data.id || "").trim();
  if (roleId) {
    const existing = findFinanceRoleById_(roleId);
    if (existing) {
      return updateFinanceRole_(roleId, data);
    }
  }
  return appendFinanceRole_(data);
}

function upsertFinanceCategoryType_(data) {
  const categoryId = String(data.id || "").trim();
  if (categoryId) {
    const existing = findFinanceCategoryTypeById_(categoryId);
    if (existing) {
      return updateFinanceCategoryType_(categoryId, data);
    }
  }
  return appendFinanceCategoryType_(data);
}

function updateFinanceRole_(roleId, data) {
  const sheet = getSheet_(SHEETS.financeRoles);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceRoles sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== roleId) {
      continue;
    }
    const record = normalizeFinanceRoleRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, {
        id: roleId,
        updatedAt: new Date().toISOString(),
      })
    );
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
  throw new Error("Finance role not found");
}

function updateFinanceCategoryType_(categoryId, data) {
  const sheet = getSheet_(SHEETS.financeCategoryTypes);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceCategoryTypes sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== categoryId) {
      continue;
    }
    const record = normalizeFinanceCategoryTypeRecord_(
      Object.assign({}, mapRowToObject_(headerMap, row), data, {
        id: categoryId,
        updatedAt: new Date().toISOString(),
      })
    );
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
  throw new Error("Finance category not found");
}

function deleteFinanceRole_(roleId) {
  const sheet = getSheet_(SHEETS.financeRoles);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceRoles sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === roleId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function deleteFinanceCategoryType_(categoryId) {
  const sheet = getSheet_(SHEETS.financeCategoryTypes);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceCategoryTypes sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === categoryId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function upsertFundEvent_(data) {
  const eventId = String(data.id || "").trim();
  if (!eventId) {
    return appendFundEvent_(data);
  }
  const existing = findFundEventById_(eventId);
  if (!existing) {
    return appendFundEvent_(data);
  }
  return updateFundEvent_(eventId, data);
}

function updateFundEvent_(eventId, data) {
  const sheet = getSheet_(SHEETS.fundEvents);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundEvents sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== eventId) {
      continue;
    }
    const existing = mapRowToObject_(headerMap, row);
    const merged = Object.assign({}, existing, data, {
      id: eventId,
      updatedAt: new Date().toISOString(),
    });
    if (!merged.createdById && data.actorId) {
      merged.createdById = data.actorId;
    }
    if (data.actorId) {
      merged.updatedById = data.actorId;
    }
    const record = normalizeFundEventRecord_(merged);
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
  throw new Error("Fund event not found");
}

function deleteFundEvent_(eventId) {
  const sheet = getSheet_(SHEETS.fundEvents);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundEvents sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === eventId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function findFundEventById_(eventId) {
  if (!eventId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.fundEvents);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundEvents sheet missing id column");
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

function upsertFundPayment_(data) {
  const paymentId = String(data.id || "").trim();
  if (!paymentId) {
    return appendFundPayment_(data);
  }
  const existing = findFundPaymentById_(paymentId);
  if (!existing) {
    return appendFundPayment_(data);
  }
  return updateFundPayment_(paymentId, data);
}

function updateFundPayment_(paymentId, data) {
  const sheet = getSheet_(SHEETS.fundPayments);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundPayments sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() !== paymentId) {
      continue;
    }
    const existing = mapRowToObject_(headerMap, row);
    const merged = Object.assign({}, existing, data, {
      id: paymentId,
      updatedAt: new Date().toISOString(),
    });
    if (!merged.createdById && data.actorId) {
      merged.createdById = data.actorId;
    }
    if (data.actorId) {
      merged.updatedById = data.actorId;
    }
    const record = normalizeFundPaymentRecord_(merged);
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
  throw new Error("Fund payment not found");
}

function deleteFundPayment_(paymentId) {
  const sheet = getSheet_(SHEETS.fundPayments);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundPayments sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex]).trim() === paymentId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function findFundPaymentById_(paymentId) {
  if (!paymentId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.fundPayments);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FundPayments sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === paymentId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function buildFundSummary_() {
  const payments = listFundPayments_("");
  const requests = listFinanceRequests_({});
  var totalReceived = 0;
  var totalAccounted = 0;
  var totalConfirmed = 0;
  payments.forEach(function (item) {
    var amount = parseFinanceAmount_(item.amount || 0);
    if (item.receivedAt || item.createdAt) {
      totalReceived += amount;
    }
    if (item.accountedAt) {
      totalAccounted += amount;
    }
    if (item.confirmedAt) {
      totalConfirmed += amount;
    }
  });
  var totalExpenses = 0;
  requests.forEach(function (item) {
    if (String(item.status || "").trim().toLowerCase() !== "closed") {
      return;
    }
    var type = String(item.type || "").trim().toLowerCase();
    if (type !== "payment" && type !== "pettycash") {
      return;
    }
    totalExpenses += parseFinanceAmount_(item.amountActual || 0);
  });
  return {
    income: {
      received: totalReceived,
      accounted: totalAccounted,
      confirmed: totalConfirmed,
    },
    expense: {
      total: totalExpenses,
    },
    balance: {
      received: totalReceived - totalExpenses,
      accounted: totalAccounted - totalExpenses,
      confirmed: totalConfirmed - totalExpenses,
    },
  };
}

function findGroupLead_(groupId, excludeId) {
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  const groupIndex = headerMap.groupId;
  const roleIndex = headerMap.roleInGroup;
  const idIndex = headerMap.id;
  if (groupIndex === undefined || roleIndex === undefined || idIndex === undefined) {
    throw new Error("GroupMemberships sheet missing columns");
  }
  const targetGroup = String(groupId || "").trim();
  const excluded = String(excludeId || "").trim();
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[groupIndex]).trim() !== targetGroup) {
      continue;
    }
    if (String(row[roleIndex]).trim() !== "lead") {
      continue;
    }
    if (excluded && String(row[idIndex]).trim() === excluded) {
      continue;
    }
    return mapRowToObject_(headerMap, row);
  }
  return null;
}

function findGroupMembershipById_(membershipId) {
  if (!membershipId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.groupMemberships);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("GroupMemberships sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === membershipId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findFinanceRoleById_(roleId) {
  if (!roleId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.financeRoles);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceRoles sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === roleId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function findFinanceCategoryTypeById_(categoryId) {
  if (!categoryId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.financeCategoryTypes);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("FinanceCategoryTypes sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idIndex]).trim() === categoryId) {
      return mapRowToObject_(headerMap, row);
    }
  }
  return null;
}

function upsertOrderResponse_(orderId, data) {
  const sheet = getSheet_(SHEETS.orderResponses);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  const orderIdIndex = headerMap.orderId;
  const studentIdIndex = headerMap.studentId;
  if (orderIdIndex === undefined || studentIdIndex === undefined) {
    throw new Error("OrderResponses sheet missing orderId or studentId column");
  }
  const rows = getDataRows_(sheet);
  const nowIso = new Date().toISOString();
  const studentId = String(data.studentId || "").trim();
  let studentName = String(data.studentName || "").trim();
  let studentEmail = String(data.studentEmail || "").trim();
  if (!studentName || !studentEmail) {
    const directory = findDirectoryById_(studentId);
    const student = findStudentById_(studentId);
    if (!studentName) {
      studentName = String((directory && (directory.nameZh || directory.nameEn)) || (student && student.name) || "").trim();
    }
    if (!studentEmail) {
      studentEmail = String((directory && directory.email) || "").trim();
    }
  }
  const payload = Object.assign({}, data, {
    id: String(data.id || orderId + "-" + studentId).trim(),
    orderId: orderId,
    studentId: studentId,
    studentName: studentName,
    studentEmail: studentEmail,
    updatedAt: nowIso,
  });
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowOrderId = String(row[orderIdIndex] || "").trim();
    const rowStudentId = String(row[studentIdIndex] || "").trim();
    if (rowOrderId !== orderId || rowStudentId !== studentId) {
      continue;
    }
    const record = normalizeOrderResponseRecord_(Object.assign({}, mapRowToObject_(headerMap, row), payload));
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
  if (idIndex !== undefined) {
    payload.createdAt = payload.createdAt || nowIso;
  }
  const record = normalizeOrderResponseRecord_(Object.assign({}, payload, { createdAt: nowIso }));
  const headers = getHeaders_(sheet);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
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
    allowCompanions: String(data.allowCompanions || "").trim(),
    allowBringDrinks: String(data.allowBringDrinks || "").trim(),
    attachments: data.attachments || "",
    formSchema: data.formSchema || "",
  };
}

function normalizeOrderPlanRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    date: String(data.date || "").trim(),
    title: String(data.title || "").trim(),
    optionA: String(data.optionA || "").trim(),
    optionB: String(data.optionB || "").trim(),
    optionAImage: String(data.optionAImage || "").trim(),
    optionBImage: String(data.optionBImage || "").trim(),
    cutoffAt: String(data.cutoffAt || "").trim(),
    status: String(data.status || "open").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeOrderResponseRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    orderId: String(data.orderId || "").trim(),
    studentId: String(data.studentId || "").trim(),
    studentName: String(data.studentName || "").trim(),
    studentEmail: normalizeEmail_(data.studentEmail),
    choice: String(data.choice || "").trim().toUpperCase(),
    comment: String(data.comment || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeFinanceRequestRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    type: String(data.type || "").trim(),
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    categoryType: String(data.categoryType || "").trim(),
    amountEstimated: String(data.amountEstimated || "").trim(),
    amountActual: String(data.amountActual || "").trim(),
    currency: String(data.currency || "TWD").trim(),
    paymentMethod: String(data.paymentMethod || "").trim(),
    vendorName: String(data.vendorName || "").trim(),
    payeeName: String(data.payeeName || "").trim(),
    payeeBank: String(data.payeeBank || "").trim(),
    payeeAccount: String(data.payeeAccount || "").trim(),
    relatedPurchaseId: String(data.relatedPurchaseId || "").trim(),
    noPurchaseReason: String(data.noPurchaseReason || "").trim(),
    expectedClearDate: String(data.expectedClearDate || "").trim(),
    attachments: String(data.attachments || "").trim(),
    status: String(data.status || "").trim(),
    applicantId: String(data.applicantId || "").trim(),
    applicantName: String(data.applicantName || "").trim(),
    applicantRole: String(data.applicantRole || "").trim(),
    applicantDepartment: String(data.applicantDepartment || "").trim(),
    applicantEmail: normalizeEmail_(data.applicantEmail),
    submittedAt: String(data.submittedAt || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeFinanceActionRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    requestId: String(data.requestId || "").trim(),
    action: String(data.action || "").trim(),
    actorRole: String(data.actorRole || "").trim(),
    actorName: String(data.actorName || "").trim(),
    note: String(data.note || "").trim(),
    fromStatus: String(data.fromStatus || "").trim(),
    toStatus: String(data.toStatus || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
  };
}

function normalizeGroupMembershipRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    personId: String(data.personId || "").trim(),
    personName: String(data.personName || "").trim(),
    groupId: String(data.groupId || "").trim(),
    roleInGroup: String(data.roleInGroup || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeFinanceRoleRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    personId: String(data.personId || "").trim(),
    personName: String(data.personName || "").trim(),
    personEmail: normalizeEmail_(data.personEmail),
    role: String(data.role || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeFinanceCategoryTypeRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    label: String(data.label || "").trim(),
    sortOrder: String(data.sortOrder || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeFundEventRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    dueDate: String(data.dueDate || "").trim(),
    amountGeneral: String(data.amountGeneral || "").trim(),
    amountSponsor: String(data.amountSponsor || "").trim(),
    expectedGeneralCount: String(data.expectedGeneralCount || "").trim(),
    expectedSponsorCount: String(data.expectedSponsorCount || "").trim(),
    status: String(data.status || "collecting").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
    createdById: String(data.createdById || "").trim(),
    updatedById: String(data.updatedById || "").trim(),
  };
}

function normalizeFundPaymentRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    eventId: String(data.eventId || "").trim(),
    payerId: String(data.payerId || "").trim(),
    payerName: String(data.payerName || "").trim(),
    payerEmail: normalizeEmail_(data.payerEmail),
    payerType: String(data.payerType || "").trim(),
    amount: String(data.amount || "").trim(),
    method: String(data.method || "").trim(),
    transferLast5: String(data.transferLast5 || "").trim(),
    receivedAt: String(data.receivedAt || "").trim(),
    accountedAt: String(data.accountedAt || "").trim(),
    confirmedAt: String(data.confirmedAt || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
    createdById: String(data.createdById || "").trim(),
    updatedById: String(data.updatedById || "").trim(),
  };
}

function normalizeSoftballPlayerRecord_(data) {
  return {
    id: String(data.id || data.studentId || "").trim(),
    name: String(data.name || "").trim(),
    nameEn: String(data.nameEn || "").trim(),
    preferredName: String(data.preferredName || "").trim(),
    nickname: String(data.nickname || "").trim(),
    email: normalizeEmail_(data.email),
    phone: String(data.phone || "").trim(),
    jerseyNumber: String(data.jerseyNumber || "").trim(),
    jerseyChoices: String(data.jerseyChoices || "").trim(),
    positions: String(data.positions || "").trim(),
    bats: String(data.bats || "").trim(),
    throws: String(data.throws || "").trim(),
    role: String(data.role || "").trim(),
    status: String(data.status || "active").trim(),
    jerseyRequest: String(data.jerseyRequest || "").trim(),
    positionRequest: String(data.positionRequest || "").trim(),
    requestStatus: String(data.requestStatus || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeSoftballPracticeRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    date: String(data.date || "").trim(),
    startAt: String(data.startAt || "").trim(),
    endAt: String(data.endAt || "").trim(),
    fieldId: String(data.fieldId || "").trim(),
    title: String(data.title || "").trim(),
    focus: String(data.focus || "").trim(),
    logSummary: String(data.logSummary || "").trim(),
    nextPlan: String(data.nextPlan || "").trim(),
    status: String(data.status || "scheduled").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeSoftballAttendanceRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    practiceId: String(data.practiceId || "").trim(),
    studentId: String(data.studentId || "").trim(),
    status: String(data.status || "unknown").trim(),
    note: String(data.note || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeSoftballFieldRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    name: String(data.name || "").trim(),
    address: String(data.address || "").trim(),
    mapUrl: String(data.mapUrl || "").trim(),
    parking: String(data.parking || "").trim(),
    fee: String(data.fee || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeSoftballGearRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    name: String(data.name || "").trim(),
    category: String(data.category || "").trim(),
    quantity: String(data.quantity || "").trim(),
    owner: String(data.owner || "").trim(),
    status: String(data.status || "available").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function parseFinanceAmount_(value) {
  var raw = String(value || "").replace(/,/g, "").trim();
  var parsed = parseFloat(raw);
  return isNaN(parsed) ? 0 : parsed;
}

function isPettyCashRequest_(record) {
  var type = String(record.type || "").trim().toLowerCase();
  var method = String(record.paymentMethod || "").trim().toLowerCase();
  return type === "pettycash" || method === "pettycash";
}

function isPurchaseRequest_(record) {
  return String(record.type || "").trim().toLowerCase() === "purchase";
}

function requiresRepresentative_(record) {
  return parseFinanceAmount_(record.amountActual || record.amountEstimated) > 50000;
}

function requiresCommittee_(record) {
  var amount = parseFinanceAmount_(record.amountActual || record.amountEstimated);
  var categoryType = String(record.categoryType || "").trim().toLowerCase();
  return amount >= 200000 || categoryType === "special";
}

function resolveFinanceNextStatus_(record, actorRole) {
  var role = String(actorRole || "").trim().toLowerCase();
  var status = String(record.status || "").trim().toLowerCase();
  var needsRep = requiresRepresentative_(record);
  var needsCommittee = requiresCommittee_(record);
  var isPettyCash = isPettyCashRequest_(record);
  var isPurchase = isPurchaseRequest_(record);

  if (role === "lead") {
    if (needsRep || needsCommittee) {
      return "pending_rep";
    }
    if (isPurchase) {
      return "closed";
    }
    return isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "rep") {
    if (needsCommittee) {
      return "pending_committee";
    }
    if (isPurchase) {
      return "closed";
    }
    return isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "committee") {
    if (isPurchase) {
      return "closed";
    }
    return isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "accounting") {
    return isPettyCash ? "closed" : "pending_cashier";
  }

  if (role === "cashier") {
    if (status === "pending_cashier" && isPettyCash) {
      return "pending_accounting";
    }
    return "closed";
  }

  return record.status || "";
}

function getAppBaseUrl_() {
  var base = String(getScriptProperty_("APP_BASE_URL") || "").trim();
  if (!base) {
    return "";
  }
  return base.replace(/\/+$/, "");
}

function buildFinanceApprovalLink_(requestId) {
  var base = getAppBaseUrl_();
  if (!base) {
    return "";
  }
  return base + "/approvals/" + encodeURIComponent(String(requestId || "").trim());
}

function resolveDirectoryEmailByPersonId_(personId) {
  var id = String(personId || "").trim();
  if (!id) {
    return "";
  }
  var directory = findDirectoryById_(id);
  return normalizeEmail_((directory && directory.email) || "");
}

function collectMembershipEmails_(memberships, groupIdList, roleList) {
  var groupSet = (groupIdList || []).reduce(function (acc, item) {
    acc[String(item || "").trim()] = true;
    return acc;
  }, {});
  var roleSet = (roleList || []).reduce(function (acc, item) {
    acc[String(item || "").trim()] = true;
    return acc;
  }, {});
  return (memberships || [])
    .filter(function (item) {
      var groupId = String(item.groupId || "").trim();
      var roleInGroup = String(item.roleInGroup || "").trim();
      if (groupSet[groupId] !== true) {
        return false;
      }
      if (roleSet[roleInGroup] !== true) {
        return false;
      }
      return true;
    })
    .map(function (item) {
      return resolveDirectoryEmailByPersonId_(item.personId);
    })
    .filter(function (email) {
      return email;
    });
}

function collectFinanceRoleEmails_(roles, targetRole) {
  var target = String(targetRole || "").trim().toLowerCase();
  return (roles || [])
    .filter(function (item) {
      return String(item.role || "").trim().toLowerCase() === target;
    })
    .map(function (item) {
      return normalizeEmail_(item.personEmail || "");
    })
    .filter(function (email) {
      return email;
    });
}

function resolveFinanceApprovalRecipients_(request, status) {
  var targetStatus = String(status || request.status || "").trim().toLowerCase();
  if (!targetStatus) {
    return [];
  }
  var memberships = listGroupMemberships_();
  var financeRoles = listFinanceRoles_();
  if (targetStatus === "pending_lead") {
    var groupId = String(request.applicantDepartment || "").trim();
    if (!groupId) {
      return [];
    }
    return collectMembershipEmails_(memberships, [groupId], ["lead", "deputy"]);
  }
  if (targetStatus === "pending_rep") {
    return collectMembershipEmails_(memberships, ["A"], ["lead", "deputy"]);
  }
  if (targetStatus === "pending_committee") {
    var leadGroups = memberships
      .filter(function (item) {
        var roleInGroup = String(item.roleInGroup || "").trim();
        return roleInGroup === "lead" || roleInGroup === "deputy";
      })
      .map(function (item) {
        return String(item.groupId || "").trim();
      })
      .filter(function (value) {
        return value;
      });
    return collectMembershipEmails_(memberships, leadGroups, ["lead", "deputy"]);
  }
  if (targetStatus === "pending_accounting") {
    return collectFinanceRoleEmails_(financeRoles, "accounting");
  }
  if (targetStatus === "pending_cashier") {
    return collectFinanceRoleEmails_(financeRoles, "cashier");
  }
  return [];
}

function sendFinanceApprovalEmail_(request) {
  if (!request) {
    return;
  }
  var status = String(request.status || "").trim().toLowerCase();
  if (!status || status.indexOf("pending_") !== 0) {
    return;
  }
  var recipients = resolveFinanceApprovalRecipients_(request, status);
  if (!recipients.length) {
    return;
  }
  var link = buildFinanceApprovalLink_(request.id || "");
  var amount = parseFinanceAmount_(request.amountActual || request.amountEstimated || 0);
  var title = String(request.title || "請款/請購");
  var applicant = String(request.applicantName || "");
  var subject =
    "【簽核通知】" +
    title +
    " · " +
    (amount ? "NT$ " + amount.toLocaleString("en-US") : "金額待補");
  var lines = [];
  lines.push("有新的簽核待處理：");
  lines.push("申請人：" + (applicant || "未填"));
  lines.push("項目：" + title);
  lines.push("金額：" + (amount ? "NT$ " + amount.toLocaleString("en-US") : "待補"));
  lines.push("狀態：" + status);
  if (link) {
    lines.push("");
    lines.push("請點此進入簽核頁：");
    lines.push(link);
  } else {
    lines.push("");
    lines.push("請登入系統後到「簽核中心」查看。");
  }
  try {
    MailApp.sendEmail({
      to: recipients.join(","),
      subject: subject,
      body: lines.join("\n"),
    });
  } catch (error) {
    Logger.log("sendFinanceApprovalEmail failed: " + error);
  }
}

function buildFinanceApplicantLink_() {
  var base = getAppBaseUrl_();
  if (!base) {
    return "";
  }
  return base + "/finance";
}

function sendFinanceReturnEmail_(request, actorName, actorNote) {
  if (!request) {
    return;
  }
  var recipient = normalizeEmail_(request.applicantEmail || "");
  if (!recipient) {
    return;
  }
  var link = buildFinanceApplicantLink_();
  var amount = parseFinanceAmount_(request.amountActual || request.amountEstimated || 0);
  var title = String(request.title || "請款/請購");
  var applicant = String(request.applicantName || "");
  var reviewer = String(actorName || "");
  var subject =
    "【退回通知】" +
    title +
    " · " +
    (amount ? "NT$ " + amount.toLocaleString("en-US") : "金額待補");
  var lines = [];
  lines.push("你的請款/請購已被退回，請補充資料後重新提交。");
  lines.push("申請人：" + (applicant || "未填"));
  lines.push("項目：" + title);
  lines.push("金額：" + (amount ? "NT$ " + amount.toLocaleString("en-US") : "待補"));
  lines.push("退回人：" + (reviewer || "未填"));
  if (actorNote) {
    lines.push("退回原因：" + actorNote);
  }
  if (link) {
    lines.push("");
    lines.push("請到系統查看並修正：");
    lines.push(link);
  }
  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: lines.join("\n"),
    });
  } catch (error) {
    Logger.log("sendFinanceReturnEmail failed: " + error);
  }
}

function generateFinanceId_() {
  var now = new Date();
  return (
    "FIN-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function generateFinanceActionId_() {
  var now = new Date();
  return (
    "FIN-ACT-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function generateFundEventId_() {
  var now = new Date();
  return (
    "FUND-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function generateFundPaymentId_() {
  var now = new Date();
  return (
    "FUND-PAY-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function generateGroupMembershipId_(personId, groupId, roleInGroup) {
  var cleanPerson = String(personId || "").trim();
  var cleanGroup = String(groupId || "").trim();
  var cleanRole = String(roleInGroup || "").trim();
  return cleanPerson + "-" + cleanGroup + "-" + cleanRole;
}

function generateFinanceRoleId_(personId, role) {
  var cleanPerson = String(personId || "").trim();
  var cleanRole = String(role || "").trim();
  return cleanPerson + "-" + cleanRole;
}

function generateFinanceCategoryTypeId_() {
  var now = new Date();
  return (
    "FIN-CAT-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function generateOrderPlanId_(dateValue, existingPlans) {
  var date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  var base =
    pad2_(date.getFullYear() % 100) + pad2_(date.getMonth() + 1) + pad2_(date.getDate());
  var seq = 1;
  if (existingPlans && existingPlans.length) {
    var count = 0;
    existingPlans.forEach(function (plan) {
      if (String(plan.id || "").indexOf(base) === 0) {
        count += 1;
      }
    });
    seq = count + 1;
  }
  return base + pad2_(seq);
}

function generateSoftballPracticeId_(dateValue, existing) {
  var date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  var base =
    pad2_(date.getFullYear() % 100) + pad2_(date.getMonth() + 1) + pad2_(date.getDate());
  var count = 0;
  (existing || []).forEach(function (item) {
    if (String(item.id || "").indexOf(base) === 0) {
      count += 1;
    }
  });
  return base + pad2_(count + 1);
}

function generateSoftballId_(prefix) {
  var now = new Date();
  return (
    String(prefix || "SB") +
    "-" +
    pad2_(now.getFullYear() % 100) +
    pad2_(now.getMonth() + 1) +
    pad2_(now.getDate()) +
    pad2_(now.getHours()) +
    pad2_(now.getMinutes()) +
    pad2_(now.getSeconds())
  );
}

function pad2_(value) {
  var text = String(value || "");
  return text.length < 2 ? "0" + text : text;
}

function isOrderPlanClosed_(plan) {
  if (!plan) {
    return true;
  }
  var status = String(plan.status || "").trim().toLowerCase();
  if (status === "closed") {
    return true;
  }
  if (plan.cutoffAt) {
    var cutoff = new Date(String(plan.cutoffAt));
    if (!isNaN(cutoff.getTime()) && new Date() > cutoff) {
      return true;
    }
  }
  return false;
}

function normalizeStudentRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    name: String(data.name || "").trim(),
    googleSub: String(data.googleSub || "").trim(),
    googleEmail: normalizeEmail_(data.googleEmail),
  };
}

function parseAttachments_(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeRegistrationRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    eventId: String(data.eventId || "").trim(),
    studentId: String(data.studentId || "").trim(),
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
