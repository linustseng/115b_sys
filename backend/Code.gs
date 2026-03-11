const SHEETS = {
  events: "Events",
  registrations: "Registrations",
  students: "Students",
  checkins: "Checkins",
  directory: "Directory",
  directoryLogs: "DirectoryLogs",
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
  announcements: "Announcements",
  notificationReads: "NotificationReads",
  lineBindings: "LineBindings",
  agentAudit: "AgentAudit",
};

const ACTION_GROUP_POLICIES = {
  listAdminBootstrap: ["C", "E"],
  createEvent: ["C", "E"],
  updateEvent: ["C", "E"],
  deleteEvent: ["C", "E"],
  deleteRegistration: ["C", "E"],
  adminCreateRegistration: ["C", "E"],
  listCheckins: ["C", "E"],
  uploadBase64: ["C", "E"],
  createOrderPlan: ["I", "E"],
  updateOrderPlan: ["I", "E"],
  listOrderResponses: ["I", "E"],
  createStudent: ["E"],
  updateStudent: ["E"],
  deleteStudent: ["E"],
  batchUpdateGroupMemberships: ["E"],
  upsertGroupMembership: ["E"],
  deleteGroupMembership: ["E"],
  upsertAnnouncement: ["E"],
  deleteAnnouncement: ["E"],
  listSoftballBootstrap: ["E", "H"],
  updateSoftballConfig: ["E", "H"],
  createSoftballPlayer: ["E", "H"],
  updateSoftballPlayer: ["E", "H"],
  deleteSoftballPlayer: ["E", "H"],
  createSoftballPractice: ["E", "H"],
  updateSoftballPractice: ["E", "H"],
  deleteSoftballPractice: ["E", "H"],
  createSoftballField: ["E", "H"],
  updateSoftballField: ["E", "H"],
  deleteSoftballField: ["E", "H"],
  createSoftballGear: ["E", "H"],
  updateSoftballGear: ["E", "H"],
  deleteSoftballGear: ["E", "H"],
};

const SOFTBALL_JERSEY_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2L", "3L", "5L", "6L"];

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = {
  pdf: true,
  jpg: true,
  jpeg: true,
  png: true,
  webp: true,
  doc: true,
  docx: true,
  xls: true,
  xlsx: true,
  ppt: true,
  pptx: true,
};

const CACHE_KEYS = {
  students: "students:list:v1",
  groupMemberships: "groupMemberships:list:v1",
  financeRoles: "financeRoles:list:v1",
  financeCategoryTypes: "financeCategoryTypes:list:v1",
  fundEvents: "fundEvents:list:v1",
  events: "events:list:v1",
  registrations: "registrations:list:v1",
  checkins: "checkins:list:v1",
  softballPlayers: "softballPlayers:list:v1",
  softballPractices: "softballPractices:list:v1",
  softballFields: "softballFields:list:v1",
  softballGear: "softballGear:list:v1",
  softballConfig: "softballConfig:list:v1",
  softballAttendance: "softballAttendance:list:v1",
  directory: "directory:list:v1",
  orderPlans: "orderPlans:list:v1",
  orderResponses: "orderResponses:list:v1",
  financeRequests: "financeRequests:list:v1",
  financeActions: "financeActions:list:v1",
  fundPayments: "fundPayments:list:v1",
  announcements: "announcements:list:v1",
  notificationReads: "notificationReads:list:v1",
  fundSummary: "fundSummary:v1",
  notificationsPayloadPrefix: "notificationsPayload:v1",
  checkinStatusMapPrefix: "checkinStatusMap:v1",
  approvalsOverviewPrefix: "approvalsOverview:v1",
  lineBindings: "lineBindings:list:v1",
  birthdays: "birthdays:list:v3",
};

const GOOGLE_SESSION_CACHE_PREFIX = "googleSession:v1:";
const GOOGLE_SESSION_TTL_SECONDS = 60 * 60 * 12;

let REQUEST_MEMO_ = {};

function resetRequestMemo_() {
  REQUEST_MEMO_ = {};
}

function doPost(e) {
  try {
    resetRequestMemo_();
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
    resetRequestMemo_();
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
  var cacheKey = String(key || "").trim();

  // CacheService key length limit is strict (<= 250 chars). Some callers may
  // accidentally pass long keys (e.g. derived from request payload). When that
  // happens Apps Script throws: 「以下引數過大：key」.
  if (cacheKey.length > 200) {
    cacheKey = buildDynamicCacheKey_("cache", cacheKey);
  }

  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // fall through and refresh
    }
  }
  const data = loader();
  cache.put(cacheKey, JSON.stringify(data || null), ttlSeconds);
  return data;
}

function hashString_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
    Utilities.Charset.UTF_8
  );
  return digest
    .map(function (byte) {
      const raw = (byte < 0 ? byte + 256 : byte).toString(16);
      return raw.length === 1 ? "0" + raw : raw;
    })
    .join("");
}

function buildDynamicCacheKey_(prefix, value) {
  return String(prefix || "cache") + ":" + hashString_(value);
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
  return getCachedJson_(CACHE_KEYS.students, 300, listStudents_);
}

function listGroupMembershipsCached_() {
  return getCachedJson_(CACHE_KEYS.groupMemberships, 300, listGroupMemberships_);
}

function listFinanceRolesCached_() {
  return getCachedJson_(CACHE_KEYS.financeRoles, 90, listFinanceRoles_);
}

function listFinanceCategoryTypesCached_() {
  return getCachedJson_(CACHE_KEYS.financeCategoryTypes, 120, listFinanceCategoryTypes_);
}

function listFundEventsCached_() {
  return getCachedJson_(CACHE_KEYS.fundEvents, 90, listFundEvents_);
}

function listEventsCached_() {
  return getCachedJson_(CACHE_KEYS.events, 300, listEvents_);
}

function listRegistrationsCached_() {
  return getCachedJson_(CACHE_KEYS.registrations, 180, listRegistrations_);
}

function listCheckinsCached_() {
  return getCachedJson_(CACHE_KEYS.checkins, 120, listCheckins_);
}

function listSoftballPlayersCached_() {
  return getCachedJson_(CACHE_KEYS.softballPlayers, 90, listSoftballPlayers_);
}

function listSoftballPracticesCached_() {
  return getCachedJson_(CACHE_KEYS.softballPractices, 90, listSoftballPractices_);
}

function listSoftballFieldsCached_() {
  return getCachedJson_(CACHE_KEYS.softballFields, 90, listSoftballFields_);
}

function listSoftballGearCached_() {
  return getCachedJson_(CACHE_KEYS.softballGear, 90, listSoftballGear_);
}

function listSoftballConfigCached_() {
  return getCachedJson_(CACHE_KEYS.softballConfig, 90, getSoftballConfig_);
}

function listSoftballAttendanceCached_() {
  return getCachedJson_(CACHE_KEYS.softballAttendance, 60, listSoftballAttendanceCore_);
}

function listDirectoryCached_() {
  return getCachedJson_(CACHE_KEYS.directory, 300, listDirectory_);
}

function listOrderPlansCached_() {
  return getCachedJson_(CACHE_KEYS.orderPlans, 90, listOrderPlans_);
}

function listOrderResponsesCached_() {
  return getCachedJson_(CACHE_KEYS.orderResponses, 90, function () {
    return listOrderResponsesCore_();
  });
}

function listFinanceRequestsCached_() {
  return getCachedJson_(CACHE_KEYS.financeRequests, 90, function () {
    return listFinanceRequestsCore_();
  });
}

function listFinanceActionsCached_() {
  return getCachedJson_(CACHE_KEYS.financeActions, 90, listFinanceActionsCore_);
}

function listFundPaymentsCached_() {
  return getCachedJson_(CACHE_KEYS.fundPayments, 90, function () {
    return listFundPaymentsCore_();
  });
}

function listAnnouncementsCached_() {
  return getCachedJson_(CACHE_KEYS.announcements, 90, listAnnouncements_);
}

function listNotificationReadsCached_() {
  return getCachedJson_(CACHE_KEYS.notificationReads, 90, listNotificationReads_);
}

function listBirthdaysCached_() {
  return getCachedJson_(CACHE_KEYS.birthdays, 300, listBirthdays_);
}

function listLineBindingsCached_() {
  return getCachedJson_(CACHE_KEYS.lineBindings, 120, listLineBindings_);
}

function buildFundSummaryCached_() {
  return getCachedJson_(CACHE_KEYS.fundSummary, 90, buildFundSummary_);
}

function handleAction_(payload) {
  const result = handleActionPayload_(payload);
  return jsonResponse(result.ok ? 200 : 400, result.data, result.error);
}

function handleActionPayload_(payload) {
  const requiredGroups = ACTION_GROUP_POLICIES[String(payload.action || "").trim()];
  if (requiredGroups) {
    const auth = requireGoogleGroupAccess_(payload, requiredGroups);
    if (!auth.ok) {
      return auth;
    }
  }

  if (payload.action === "syncPullSnapshot") {
    const syncAuth = requireSyncPullAccess_(payload || {});
    if (!syncAuth.ok) {
      return syncAuth;
    }
    return {
      ok: true,
      data: {
        pulledAt: new Date().toISOString(),
        events: listEventsCached_(),
        students: listStudentsCached_(),
        registrations: listRegistrationsCached_(),
        checkins: listCheckinsCached_(),
        directory: listDirectoryCached_(),
        groupMemberships: listGroupMembershipsCached_(),
        financeCategoryTypes: listFinanceCategoryTypesCached_(),
        financeRoles: listFinanceRolesCached_(),
      },
      error: null,
    };
  }

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

  if (payload.action === "listHomeBootstrap") {
    const email = normalizeEmail_(payload.email);
    const events = listEventsCached_();
    const registrations = email
      ? listRegistrationsCached_().filter(function (item) {
          const rowEmail = normalizeEmail_(item.userEmail);
          const status = String(item.status || "").trim().toLowerCase();
          return rowEmail === email && status !== "cancelled";
        })
      : [];
    const eventIds = registrations
      .map(function (item) {
        return String(item.eventId || "").trim();
      })
      .filter(function (id) {
        return id;
      });
    const statuses = email ? buildCheckinStatusMapByEmail_(email, eventIds) : {};
    return {
      ok: true,
      data: {
        events: events,
        registrations: registrations,
        checkinStatuses: statuses,
      },
      error: null,
    };
  }

  if (payload.action === "listLandingBootstrap") {
    const studentId = String(payload.studentId || "").trim();
    const email = normalizeEmail_(payload.email);
    const memberships = studentId
      ? listGroupMembershipsCached_().filter(function (item) {
          return String(item.personId || "").trim() === studentId;
        })
      : [];
    const notificationsData = buildNotificationsPayload_(studentId, email);
    return {
      ok: true,
      data: {
        memberships: memberships,
        notifications: notificationsData.notifications,
        unreadCount: notificationsData.unreadCount,
      },
      error: null,
    };
  }

  if (payload.action === "listBirthdays") {
    return { ok: true, data: listBirthdaysCached_(), error: null };
  }

  if (payload.action === "listApprovalsOverview") {
    const studentId = String(payload.studentId || "").trim();
    const email = normalizeEmail_(payload.email);
    const overview = buildApprovalsOverviewPayload_(studentId, email);
    return { ok: true, data: overview, error: null };
  }

  if (payload.action === "listNotifications") {
    const studentId = String(payload.studentId || "").trim();
    const email = normalizeEmail_(payload.email);
    const payloadData = buildNotificationsPayload_(studentId, email);
    return {
      ok: true,
      data: { notifications: payloadData.notifications, unreadCount: payloadData.unreadCount },
      error: null,
    };
  }

  if (payload.action === "markNotificationRead") {
    const notificationId = String(payload.notificationId || "").trim();
    const studentId = String(payload.studentId || "").trim();
    const email = normalizeEmail_(payload.email);
    if (!notificationId || (!studentId && !email)) {
      return { ok: false, data: null, error: "Missing notificationId or user identity" };
    }
    const read = upsertNotificationRead_(notificationId, studentId, email);
    invalidateCacheKeys_([CACHE_KEYS.notificationReads]);
    return { ok: true, data: { read: read }, error: null };
  }

  if (payload.action === "markAllNotificationsRead") {
    const studentId = String(payload.studentId || "").trim();
    const email = normalizeEmail_(payload.email);
    const ids = Array.isArray(payload.notificationIds)
      ? payload.notificationIds
          .map(function (id) {
            return String(id || "").trim();
          })
          .filter(function (id) {
            return id;
          })
      : [];
    if ((!studentId && !email) || !ids.length) {
      return { ok: false, data: null, error: "Missing user identity or notificationIds" };
    }
    const reads = ids.map(function (notificationId) {
      return upsertNotificationRead_(notificationId, studentId, email);
    });
    invalidateCacheKeys_([CACHE_KEYS.notificationReads]);
    return { ok: true, data: { reads: reads }, error: null };
  }

  if (payload.action === "upsertAnnouncement") {
    const data = payload.data || {};
    const updated = upsertAnnouncement_(data);
    invalidateCacheKeys_([CACHE_KEYS.announcements]);
    return { ok: true, data: { announcement: updated }, error: null };
  }

  if (payload.action === "deleteAnnouncement") {
    const announcementId = String(payload.id || "").trim();
    if (!announcementId) {
      return { ok: false, data: null, error: "Missing announcement id" };
    }
    const removed = deleteAnnouncement_(announcementId);
    if (!removed) {
      return { ok: false, data: null, error: "Announcement not found" };
    }
    invalidateCacheKeys_([CACHE_KEYS.announcements]);
    return { ok: true, data: { id: announcementId }, error: null };
  }

  if (payload.action === "listAdminBootstrap") {
    const includeRegistrations = payload.includeRegistrations === true;
    const includeCheckins = payload.includeCheckins === true;
    const data = {
      events: listEventsCached_(),
      students: listStudentsCached_(),
      groupMemberships: listGroupMembershipsCached_(),
    };
    if (includeRegistrations) {
      data.registrations = listRegistrationsCached_();
    }
    if (includeCheckins) {
      data.checkins = listCheckinsCached_();
    }
    return {
      ok: true,
      data: data,
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

  if (payload.action === "listFinanceApplicantBootstrap") {
    const applicantEmail = normalizeEmail_(payload.applicantEmail || payload.email);
    const requests = applicantEmail ? listFinanceRequests_({ applicantEmail: applicantEmail }) : [];
    return {
      ok: true,
      data: {
        requests: requests,
        students: listStudentsCached_(),
        groupMemberships: listGroupMembershipsCached_(),
        categories: listFinanceCategoryTypesCached_(),
        fundEvents: listFundEventsCached_(),
      },
      error: null,
    };
  }

  if (payload.action === "listFinanceAdminBootstrap") {
    const includeRequests = payload.includeRequests === true;
    return {
      ok: true,
      data: {
        requests: includeRequests ? listFinanceRequests_(payload) : undefined,
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

  if (payload.action === "listSoftballPlayerBootstrap") {
    const studentId = String(payload.studentId || "").trim();
    return {
      ok: true,
      data: {
        players: listSoftballPlayersCached_(),
        practices: listSoftballPracticesCached_(),
        fields: listSoftballFieldsCached_(),
        config: listSoftballConfigCached_(),
        attendance: listSoftballAttendance_("", studentId),
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
    invalidateCacheKeys_([CACHE_KEYS.financeRequests, CACHE_KEYS.financeActions, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { request: created }, error: null };
  }

  if (payload.action === "updateFinanceRequest") {
    const requestId = String(payload.id || "").trim();
    if (!requestId) {
      return { ok: false, data: null, error: "Missing request id" };
    }
    const updated = updateFinanceRequestFlow_(requestId, payload);
    invalidateCacheKeys_([CACHE_KEYS.financeRequests, CACHE_KEYS.financeActions, CACHE_KEYS.fundSummary]);
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
    return { ok: true, data: { memberships: listGroupMembershipsCached_() }, error: null };
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
    return { ok: true, data: { roles: listFinanceRolesCached_() }, error: null };
  }

  if (payload.action === "listFinanceCategoryTypes") {
    return { ok: true, data: { categories: listFinanceCategoryTypesCached_() }, error: null };
  }

  if (payload.action === "upsertFinanceCategoryType") {
    const data = payload.data || {};
    const updated = upsertFinanceCategoryType_(data);
    invalidateCacheKeys_([CACHE_KEYS.financeCategoryTypes]);
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
    invalidateCacheKeys_([CACHE_KEYS.financeCategoryTypes]);
    return { ok: true, data: { id: categoryId }, error: null };
  }

  if (payload.action === "upsertFinanceRole") {
    const data = payload.data || {};
    const updated = upsertFinanceRole_(data);
    invalidateCacheKeys_([CACHE_KEYS.financeRoles]);
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
    invalidateCacheKeys_([CACHE_KEYS.financeRoles]);
    return { ok: true, data: { id: roleId }, error: null };
  }

  if (payload.action === "listFundEvents") {
    return { ok: true, data: { events: listFundEventsCached_() }, error: null };
  }

  if (payload.action === "listFundPayments") {
    const eventId = String(payload.eventId || "").trim();
    return { ok: true, data: { payments: listFundPayments_(eventId) }, error: null };
  }

  if (payload.action === "upsertFundEvent") {
    const data = payload.data || {};
    const updated = upsertFundEvent_(data);
    invalidateCacheKeys_([CACHE_KEYS.fundEvents, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { event: updated }, error: null };
  }

  if (payload.action === "upsertFundPayment") {
    const data = payload.data || {};
    const updated = upsertFundPayment_(data);
    invalidateCacheKeys_([CACHE_KEYS.fundPayments, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { payment: updated }, error: null };
  }

  if (payload.action === "markFundPaymentAccounted") {
    const paymentId = String(payload.id || "").trim();
    if (!paymentId) {
      return { ok: false, data: null, error: "Missing payment id" };
    }
    const accountedAt = String(payload.accountedAt || "").trim();
    const actorId = String(payload.actorId || "").trim() || getAdminActorInfo_(payload).studentId;
    const updated = markFundPaymentAccounted_(paymentId, accountedAt || new Date().toISOString(), actorId);
    invalidateCacheKeys_([CACHE_KEYS.fundPayments, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { payment: updated }, error: null };
  }

  if (payload.action === "unmarkFundPaymentAccounted") {
    const paymentId = String(payload.id || "").trim();
    if (!paymentId) {
      return { ok: false, data: null, error: "Missing payment id" };
    }
    const actorId = String(payload.actorId || "").trim() || getAdminActorInfo_(payload).studentId;
    const updated = markFundPaymentAccounted_(paymentId, "", actorId);
    invalidateCacheKeys_([CACHE_KEYS.fundPayments, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { payment: updated }, error: null };
  }

  if (payload.action === "batchMarkFundPaymentsAccounted") {
    const eventId = String(payload.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing event id" };
    }
    const accountedAt = String(payload.accountedAt || "").trim();
    if (!accountedAt) {
      return { ok: false, data: null, error: "Missing accountedAt" };
    }
    const actorId = String(payload.actorId || "").trim() || getAdminActorInfo_(payload).studentId;
    const stats = batchMarkFundPaymentsAccounted_(eventId, accountedAt, actorId);
    invalidateCacheKeys_([CACHE_KEYS.fundPayments, CACHE_KEYS.fundSummary]);
    return { ok: true, data: stats, error: null };
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
    invalidateCacheKeys_([CACHE_KEYS.fundEvents, CACHE_KEYS.fundSummary]);
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
    invalidateCacheKeys_([CACHE_KEYS.fundPayments, CACHE_KEYS.fundSummary]);
    return { ok: true, data: { id: paymentId }, error: null };
  }

  if (payload.action === "getFundSummary") {
    return { ok: true, data: buildFundSummaryCached_(), error: null };
  }

  if (payload.action === "createSession") {
    const auth = requireGoogleIdentity_(payload || {});
    if (!auth.ok) {
      return auth;
    }
    const studentId = String((auth.data && auth.data.studentId) || "").trim();
    return {
      ok: true,
      data: {
        sessionToken: String((auth.data && auth.data.sessionToken) || "").trim(),
        studentId: studentId,
        memberships: listMembershipsByStudentId_(studentId),
      },
      error: null,
    };
  }

  if (payload.action === "listMyMemberships") {
    const auth = requireGoogleIdentity_(payload || {});
    if (!auth.ok) {
      return auth;
    }
    const studentId = String((auth.data && auth.data.studentId) || "").trim();
    return {
      ok: true,
      data: {
        memberships: listMembershipsByStudentId_(studentId),
        sessionToken: String((auth.data && auth.data.sessionToken) || "").trim(),
      },
      error: null,
    };
  }

  if (payload.action === "bindLineUser") {
    const data = payload.data || {};
    const lineUserId = String(payload.lineUserId || data.lineUserId || "").trim();
    const studentId = String(payload.studentId || data.studentId || "").trim();
    if (!lineUserId || !studentId) {
      return { ok: false, data: null, error: "Missing lineUserId or studentId" };
    }

    let authorized = false;
    let boundByType = "system";
    let boundByStudentId = "";

    const googleAdminAuth = requireGoogleGroupAccess_(payload || {}, ["A", "E"]);
    if (googleAdminAuth && googleAdminAuth.ok) {
      authorized = true;
      boundByType = "google";
      boundByStudentId = String((googleAdminAuth.data && googleAdminAuth.data.studentId) || "").trim();
    }

    if (!authorized) {
      const actorLineUserId = String(payload.actorLineUserId || data.actorLineUserId || "").trim();
      if (actorLineUserId) {
        const actorAuth = resolveLineActorPayload_({ lineUserId: actorLineUserId });
        if (actorAuth.ok && lineActorHasGroupAccess_(actorAuth.data, ["A", "E"])) {
          authorized = true;
          boundByType = "line";
          boundByStudentId = String((actorAuth.data && actorAuth.data.studentId) || "").trim();
        }
      }
    }

    if (!authorized) {
      return { ok: false, data: null, error: "Unauthorized" };
    }

    const student = findStudentById_(studentId);
    if (!student) {
      return { ok: false, data: null, error: "Student not found" };
    }
    const directory = findDirectoryById_(studentId);
    const binding = upsertLineBinding_({
      lineUserId: lineUserId,
      studentId: studentId,
      status: String(payload.status || data.status || "active").trim(),
      role: String(payload.role || data.role || "").trim(),
      groupId: String(payload.groupId || data.groupId || "").trim(),
      displayName: String(
        payload.displayName ||
          data.displayName ||
          (directory && (directory.preferredName || directory.nameZh || directory.nameEn)) ||
          student.name ||
          ""
      ).trim(),
      pictureUrl: String(payload.pictureUrl || data.pictureUrl || "").trim(),
      source: String(payload.source || data.source || "line").trim(),
      note: String(payload.note || data.note || "").trim(),
      boundByType: boundByType,
      boundByStudentId: boundByStudentId,
      metadata:
        data.metadata !== undefined
          ? data.metadata
          : payload.metadata !== undefined
          ? payload.metadata
          : "",
    });
    invalidateCacheKeys_([CACHE_KEYS.lineBindings]);

    const actor = buildLineActor_(binding);
    appendAgentAudit_({
      action: "bindLineUser",
      channel: "line",
      lineUserId: lineUserId,
      studentId: studentId,
      status: "ok",
      payload: { lineUserId: lineUserId, studentId: studentId, boundByType: boundByType },
      result: { bindingId: String(binding.id || "").trim() },
    });

    return {
      ok: true,
      data: {
        binding: binding,
        actor: actor,
      },
      error: null,
    };
  }

  if (payload.action === "resolveLineActor") {
    const data = payload.data || {};
    const lineUserId = String(
      payload.lineUserId || payload.actorLineUserId || data.lineUserId || data.actorLineUserId || ""
    ).trim();
    const resolved = resolveLineActorPayload_({ lineUserId: lineUserId });
    if (!resolved.ok) {
      appendAgentAudit_({
        action: "resolveLineActor",
        channel: "line",
        lineUserId: lineUserId,
        status: "error",
        error: resolved.error || "Unauthorized",
      });
      return resolved;
    }
    appendAgentAudit_({
      action: "resolveLineActor",
      channel: "line",
      lineUserId: lineUserId,
      studentId: String((resolved.data && resolved.data.studentId) || "").trim(),
      status: "ok",
    });
    return { ok: true, data: { actor: resolved.data }, error: null };
  }

  if (payload.action === "lineRegisterEvent") {
    const actorAuth = resolveLineActorPayload_(payload || {});
    if (!actorAuth.ok) {
      appendAgentAudit_({
        action: "lineRegisterEvent",
        channel: "line",
        lineUserId: String(payload.lineUserId || payload.actorLineUserId || "").trim(),
        status: "error",
        error: actorAuth.error || "Unauthorized",
      });
      return actorAuth;
    }

    const actor = actorAuth.data;
    const data = payload.data || {};
    const eventId = String(payload.eventId || data.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    if (!actor.email) {
      return { ok: false, data: null, error: "Actor email missing" };
    }

    const customFields = parseCustomFields_(data.customFields);
    customFields._line = {
      lineUserId: actor.lineUserId,
      studentId: actor.studentId,
      at: new Date().toISOString(),
    };
    if (!customFields.studentId) {
      customFields.studentId = actor.studentId;
    }

    const registerPayload = {
      action: "register",
      data: Object.assign({}, data, {
        eventId: eventId,
        userEmail: actor.email,
        userName: String(data.userName || actor.name || "").trim(),
        userPhone: String(data.userPhone || actor.phone || "").trim(),
        studentId: actor.studentId,
        customFields: customFields,
      }),
    };

    const registerResult = handleActionPayload_(registerPayload);
    appendAgentAudit_({
      action: "lineRegisterEvent",
      channel: "line",
      lineUserId: actor.lineUserId,
      studentId: actor.studentId,
      eventId: eventId,
      status: registerResult.ok ? "ok" : "error",
      error: registerResult.ok ? "" : registerResult.error || "Register failed",
      payload: { eventId: eventId },
      result: registerResult,
    });
    if (!registerResult.ok) {
      return registerResult;
    }

    const registrationId = String((registerResult.data && registerResult.data.registrationId) || "").trim();
    const registration = registrationId ? findRegistrationById_(registrationId) : null;
    return {
      ok: true,
      data: {
        registrationId: registrationId,
        registration: registration,
        actor: {
          lineUserId: actor.lineUserId,
          studentId: actor.studentId,
          email: actor.email,
          name: actor.name,
        },
      },
      error: null,
    };
  }

  if (payload.action === "lineCheckinEvent") {
    const actorAuth = resolveLineActorPayload_(payload || {});
    if (!actorAuth.ok) {
      appendAgentAudit_({
        action: "lineCheckinEvent",
        channel: "line",
        lineUserId: String(payload.lineUserId || payload.actorLineUserId || "").trim(),
        status: "error",
        error: actorAuth.error || "Unauthorized",
      });
      return actorAuth;
    }

    const actor = actorAuth.data;
    const data = payload.data || {};
    const eventId = String(payload.eventId || data.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    if (!actor.email) {
      return { ok: false, data: null, error: "Actor email missing" };
    }

    const checkinPayload = {
      action: "checkin",
      data: Object.assign({}, data, {
        eventId: eventId,
        userEmail: actor.email,
      }),
    };
    const checkinResult = handleActionPayload_(checkinPayload);
    appendAgentAudit_({
      action: "lineCheckinEvent",
      channel: "line",
      lineUserId: actor.lineUserId,
      studentId: actor.studentId,
      eventId: eventId,
      status: checkinResult.ok ? "ok" : "error",
      error: checkinResult.ok ? "" : checkinResult.error || "Check-in failed",
      payload: { eventId: eventId },
      result: checkinResult,
    });
    if (!checkinResult.ok) {
      return checkinResult;
    }

    return {
      ok: true,
      data: Object.assign({}, checkinResult.data || {}, {
        actor: {
          lineUserId: actor.lineUserId,
          studentId: actor.studentId,
          email: actor.email,
          name: actor.name,
        },
      }),
      error: null,
    };
  }

  if (payload.action === "lineApprovalAction") {
    const actorAuth = resolveLineActorPayload_(payload || {});
    if (!actorAuth.ok) {
      appendAgentAudit_({
        action: "lineApprovalAction",
        channel: "line",
        lineUserId: String(payload.lineUserId || payload.actorLineUserId || "").trim(),
        status: "error",
        error: actorAuth.error || "Unauthorized",
      });
      return actorAuth;
    }

    const actor = actorAuth.data;
    const data = payload.data || {};
    const requestId = String(payload.requestId || data.requestId || payload.id || data.id || "").trim();
    if (!requestId) {
      return { ok: false, data: null, error: "Missing requestId" };
    }

    const existing = findFinanceRequestById_(requestId);
    if (!existing) {
      return { ok: false, data: null, error: "Finance request not found" };
    }

    const decision = normalizeLineApprovalAction_(
      payload.decision || payload.requestAction || payload.flowAction || payload.actionType || data.decision || ""
    );
    if (!decision) {
      return { ok: false, data: null, error: "Invalid approval action" };
    }

    const actorRole =
      String(payload.actorRole || data.actorRole || "").trim().toLowerCase() ||
      resolveFinanceActorRoleForStatus_(existing.status);
    if (!actorRole) {
      return { ok: false, data: null, error: "Cannot resolve actorRole" };
    }

    const updateResult = handleActionPayload_({
      action: "updateFinanceRequest",
      id: requestId,
      requestAction: decision,
      actorRole: actorRole,
      actorName: String(actor.name || "").trim(),
      actorNote: String(payload.note || payload.actorNote || data.note || data.actorNote || "").trim(),
      actorId: actor.studentId,
      actorEmail: actor.email,
      data: data.patch || data.data || {},
    });

    appendAgentAudit_({
      action: "lineApprovalAction",
      channel: "line",
      lineUserId: actor.lineUserId,
      studentId: actor.studentId,
      requestId: requestId,
      status: updateResult.ok ? "ok" : "error",
      error: updateResult.ok ? "" : updateResult.error || "Approval failed",
      payload: { requestId: requestId, decision: decision, actorRole: actorRole },
      result: updateResult,
    });

    if (!updateResult.ok) {
      return updateResult;
    }

    return {
      ok: true,
      data: {
        decision: decision,
        actorRole: actorRole,
        request: (updateResult.data && updateResult.data.request) || null,
      },
      error: null,
    };
  }

  if (payload.action === "lineListMyUpcoming") {
    const actorAuth = resolveLineActorPayload_(payload || {});
    if (!actorAuth.ok) {
      appendAgentAudit_({
        action: "lineListMyUpcoming",
        channel: "line",
        lineUserId: String(payload.lineUserId || payload.actorLineUserId || "").trim(),
        status: "error",
        error: actorAuth.error || "Unauthorized",
      });
      return actorAuth;
    }

    const actor = actorAuth.data;
    const data = payload.data || {};
    const days = normalizePositiveInt_(payload.days || data.days, 14, 1, 60);
    const limit = normalizePositiveInt_(payload.limit || data.limit, 10, 1, 50);
    const upcoming = buildLineUpcomingPayload_(actor, days, limit);

    appendAgentAudit_({
      action: "lineListMyUpcoming",
      channel: "line",
      lineUserId: actor.lineUserId,
      studentId: actor.studentId,
      status: "ok",
      payload: { days: days, limit: limit },
      result: {
        events: {
          registered: (upcoming.events && upcoming.events.registered
            ? upcoming.events.registered.length
            : 0),
          openForRegistration: (upcoming.events && upcoming.events.openForRegistration
            ? upcoming.events.openForRegistration.length
            : 0),
        },
        approvals: {
          pending: (upcoming.approvals && upcoming.approvals.pending
            ? upcoming.approvals.pending.length
            : 0),
        },
      },
    });

    return { ok: true, data: upcoming, error: null };
  }

  if (payload.action === "verifyGoogle") {
    const idToken = String(payload.idToken || "").trim();
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    const profile = verifyGoogleIdTokenCached_(idToken);
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
    let sessionToken = "";
    let memberships = [];
    if (linkedStudent && String(linkedStudent.id || "").trim()) {
      const linkedStudentId = String(linkedStudent.id || "").trim();
      sessionToken = writeGoogleSession_(normalizeGoogleSessionToken_(payload), profile, linkedStudentId);
      memberships = listMembershipsByStudentId_(linkedStudentId);
    }
    return {
      ok: true,
      data: {
        profile: profile,
        student: linkedProfile,
        emailMatch: emailMatch,
        sessionToken: sessionToken,
        memberships: memberships,
      },
      error: null,
    };
  }

  if (payload.action === "linkGoogleStudent") {
    const idToken = String(payload.idToken || "").trim();
    const studentId = String(payload.studentId || "").trim();
    if (!idToken || !studentId) {
      return { ok: false, data: null, error: "Missing idToken or studentId" };
    }
    const profile = verifyGoogleIdTokenCached_(idToken);
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
    invalidateCacheKeys_([CACHE_KEYS.students]);
    const directory = findDirectoryById_(studentId);
    if (!directory || !directory.email) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    const combined = buildStudentProfile_(updated || target, directory, profile.email);
    const sessionToken = writeGoogleSession_(normalizeGoogleSessionToken_(payload), profile, studentId);
    return {
      ok: true,
      data: {
        student: combined,
        sessionToken: sessionToken,
        memberships: listMembershipsByStudentId_(studentId),
      },
      error: null,
    };
  }

  if (payload.action === "getDirectoryProfile") {
    const idToken = String(payload.idToken || "").trim();
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    const profile = verifyGoogleIdTokenCached_(idToken);
    const linkedStudent = findStudentByGoogleSub_(profile.sub);
    const directory = linkedStudent
      ? findDirectoryById_(linkedStudent.id)
      : findDirectoryByEmail_(profile.email);
    if (!directory) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    const student = linkedStudent || (directory.id ? findStudentById_(directory.id) : null);
    return {
      ok: true,
      data: { profile: buildDirectoryProfile_(student, directory, profile.email) },
      error: null,
    };
  }

  if (payload.action === "updateDirectoryProfile") {
    const idToken = String(payload.idToken || "").trim();
    const data = payload.data || {};
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    const profile = verifyGoogleIdTokenCached_(idToken);
    const linkedStudent = findStudentByGoogleSub_(profile.sub);
    const directory = linkedStudent
      ? findDirectoryById_(linkedStudent.id)
      : findDirectoryByEmail_(profile.email);
    if (!directory) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    const normalized = normalizeDirectoryProfileInput_(data);
    if (!normalized.email) {
      normalized.email = normalizeEmail_(directory.email);
    }
    if (!linkedStudent && normalized.email !== normalizeEmail_(directory.email)) {
      return { ok: false, data: null, error: "請先完成學號綁定再修改 Email" };
    }
    const merged = Object.assign({}, directory, normalized);
    const changes = buildDirectoryProfileChanges_(directory, merged);
    const updated = updateDirectoryByIdOrEmail_(directory.id, directory.email, normalized);
    if (!updated) {
      return { ok: false, data: null, error: "Directory profile missing" };
    }
    invalidateCacheKeys_([CACHE_KEYS.directory, CACHE_KEYS.birthdays]);
    if (changes.length) {
      appendDirectoryLog_({
        actorEmail: profile.email,
        targetId: directory.id,
        targetEmail: directory.email,
        action: "profile_update",
        changes: JSON.stringify(changes),
      });
    }
    const student = linkedStudent || (directory.id ? findStudentById_(directory.id) : null);
    return {
      ok: true,
      data: { profile: buildDirectoryProfile_(student, updated, profile.email) },
      error: null,
    };
  }

  if (payload.action === "searchStudents") {
    const idToken = String(payload.idToken || "").trim();
    const query = String(payload.query || "").trim();
    if (!idToken) {
      return { ok: false, data: null, error: "Missing idToken" };
    }
    verifyGoogleIdTokenCached_(idToken);
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

  if (payload.action === "getCheckinBootstrap") {
    const eventId = String(payload.eventId || "").trim();
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }
    const email = normalizeEmail_(payload.email);
    const statusEntry = email ? buildCheckinStatusMapByEmail_(email, [eventId])[eventId] : null;
    return {
      ok: true,
      data: {
        event: event,
        checkinStatus: statusEntry ? String(statusEntry.status || "") : null,
        attendance: statusEntry ? String(statusEntry.attendance || "") : "",
      },
      error: null,
    };
  }

  if (payload.action === "getRegistrationBootstrap") {
    const eventId = String(payload.eventId || "").trim();
    const email = normalizeEmail_(payload.email);
    if (!eventId) {
      return { ok: false, data: null, error: "Missing eventId" };
    }
    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }
    var registration = null;
    if (email) {
      registration = findRegistrationByEmail_(eventId, email);
    }
    var studentProfile = null;
    if (email) {
      const directory = findDirectoryByEmail_(email);
      const student = directory && directory.id ? findStudentById_(directory.id) : null;
      if (student && directory) {
        studentProfile = buildStudentProfile_(student, directory, email);
      }
    }
    return {
      ok: true,
      data: { event: event, registration: registration, student: studentProfile },
      error: null,
    };
  }

  if (payload.action === "listEvents") {
    const events = listEventsCached_();
    return { ok: true, data: { events: events }, error: null };
  }

  if (payload.action === "listOrderPlans") {
    const plans = listOrderPlansCached_();
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
    invalidateCacheKeys_([CACHE_KEYS.orderPlans]);
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
    invalidateCacheKeys_([CACHE_KEYS.orderPlans]);
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
    invalidateCacheKeys_([CACHE_KEYS.orderResponses]);
    return { ok: true, data: { response: response }, error: null };
  }

  if (payload.action === "listSoftballPlayers") {
    return { ok: true, data: { players: listSoftballPlayersCached_() }, error: null };
  }

  if (payload.action === "listSoftballConfig") {
    return { ok: true, data: { config: listSoftballConfigCached_() }, error: null };
  }

  if (payload.action === "updateSoftballConfig") {
    const data = payload.data || {};
    const updated = updateSoftballConfig_(data);
    invalidateCacheKeys_([CACHE_KEYS.softballConfig]);
    return { ok: true, data: { config: updated }, error: null };
  }

  if (payload.action === "upsertMySoftballPlayerProfile") {
    const auth = requireGoogleIdentity_(payload || {});
    if (!auth.ok) {
      return auth;
    }
    const studentId = String((auth.data && auth.data.studentId) || "").trim();
    if (!studentId) {
      return { ok: false, data: null, error: "Unauthorized" };
    }
    const data = payload.data || {};
    const inputId = String(data.id || data.studentId || "").trim();
    if (inputId && inputId !== studentId) {
      return { ok: false, data: null, error: "Unauthorized" };
    }
    const existing = findSoftballPlayerById_(studentId);
    const profilePayload = buildSoftballSelfProfilePayload_(data, studentId, existing || {});
    const saved = upsertSoftballPlayer_(profilePayload, false);
    if (!saved.ok) {
      return { ok: false, data: null, error: saved.error };
    }
    invalidateCacheKeys_([CACHE_KEYS.softballPlayers]);
    return {
      ok: true,
      data: {
        player: saved.player,
        sessionToken: String((auth.data && auth.data.sessionToken) || "").trim(),
        memberships: listMembershipsByStudentId_(studentId),
      },
      error: null,
    };
  }

  if (payload.action === "createSoftballPlayer") {
    const data = payload.data || {};
    const created = upsertSoftballPlayer_(data, false);
    if (!created.ok) {
      return { ok: false, data: null, error: created.error };
    }
    invalidateCacheKeys_([CACHE_KEYS.softballPlayers]);
    return { ok: true, data: { player: created.player }, error: null };
  }

  if (payload.action === "updateSoftballPlayer") {
    const data = payload.data || {};
    const created = upsertSoftballPlayer_(data, true);
    if (!created.ok) {
      return { ok: false, data: null, error: created.error };
    }
    invalidateCacheKeys_([CACHE_KEYS.softballPlayers]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballPlayers]);
    return { ok: true, data: { id: playerId }, error: null };
  }

  if (payload.action === "listSoftballPractices") {
    return { ok: true, data: { practices: listSoftballPracticesCached_() }, error: null };
  }

  if (payload.action === "createSoftballPractice") {
    const data = payload.data || {};
    if (!data.date) {
      return { ok: false, data: null, error: "Missing date" };
    }
    const created = createSoftballPractice_(data);
    invalidateCacheKeys_([CACHE_KEYS.softballPractices]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballPractices]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballPractices]);
    return { ok: true, data: { id: practiceId }, error: null };
  }

  if (payload.action === "listSoftballFields") {
    return { ok: true, data: { fields: listSoftballFieldsCached_() }, error: null };
  }

  if (payload.action === "createSoftballField") {
    const data = payload.data || {};
    if (!data.name) {
      return { ok: false, data: null, error: "Missing field name" };
    }
    const created = createSoftballField_(data);
    invalidateCacheKeys_([CACHE_KEYS.softballFields]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballFields]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballFields]);
    return { ok: true, data: { id: fieldId }, error: null };
  }

  if (payload.action === "listSoftballGear") {
    return { ok: true, data: { gear: listSoftballGearCached_() }, error: null };
  }

  if (payload.action === "createSoftballGear") {
    const data = payload.data || {};
    if (!data.name) {
      return { ok: false, data: null, error: "Missing gear name" };
    }
    const created = createSoftballGear_(data);
    invalidateCacheKeys_([CACHE_KEYS.softballGear]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballGear]);
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
    invalidateCacheKeys_([CACHE_KEYS.softballGear]);
    return { ok: true, data: { id: gearId }, error: null };
  }

  if (payload.action === "listSoftballAttendance") {
    const practiceId = String(payload.practiceId || "").trim();
    const studentId = String(payload.studentId || "").trim();
    const items = listSoftballAttendance_(practiceId, studentId);
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
    invalidateCacheKeys_([CACHE_KEYS.softballAttendance]);
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
    invalidateCacheKeys_(["events:list:v1"]);
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
    invalidateCacheKeys_(["events:list:v1"]);
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
    invalidateCacheKeys_(["events:list:v1", "registrations:list:v1", "checkins:list:v1"]);
    return { ok: true, data: { eventId: eventId }, error: null };
  }

  if (payload.action === "listStudents") {
    return { ok: true, data: { students: listStudentsCached_() }, error: null };
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
    invalidateCacheKeys_(["students:list:v1"]);
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
    invalidateCacheKeys_(["students:list:v1"]);
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
    invalidateCacheKeys_(["students:list:v1"]);
    return { ok: true, data: { id: studentId }, error: null };
  }

  if (payload.action === "listRegistrations") {
    const registrations = listRegistrationsCached_();
    const adminAuth = requireGoogleGroupAccess_(payload, ["C", "E"]);
    if (adminAuth.ok) {
      return { ok: true, data: { registrations: registrations }, error: null };
    }
    const email = normalizeEmail_(payload.email);
    if (!email) {
      return { ok: false, data: null, error: "Unauthorized" };
    }
    const ownRegistrations = registrations.filter(function (item) {
      return normalizeEmail_(item.userEmail) === email;
    });
    return { ok: true, data: { registrations: ownRegistrations }, error: null };
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
    const existing = findRegistrationById_(registrationId);
    if (!existing) {
      return { ok: false, data: null, error: "Registration not found" };
    }
    const adminAuth = requireGoogleGroupAccess_(payload, ["C", "E"]);
    const normalizedInputEmail = normalizeEmail_(data.userEmail || payload.email);
    if (!adminAuth.ok) {
      if (!normalizedInputEmail || normalizeEmail_(existing.userEmail) !== normalizedInputEmail) {
        return { ok: false, data: null, error: "Unauthorized" };
      }
      const event = findEventById_(String(existing.eventId || "").trim());
      if (!event) {
        return { ok: false, data: null, error: "Event not found" };
      }
      const eventStatus = String(event.status || "").trim().toLowerCase();
      if (eventStatus && eventStatus !== "open") {
        return { ok: false, data: null, error: "Event is not open" };
      }
      if (!isWithinWindow_(event.registrationOpenAt, event.registrationCloseAt)) {
        return { ok: false, data: null, error: "Registration window closed" };
      }
    }
    const safeData = adminAuth.ok
      ? data
      : {
          id: existing.id,
          eventId: existing.eventId,
          userEmail: existing.userEmail,
          userName: String(data.userName || existing.userName || "").trim(),
          userPhone: String(data.userPhone || existing.userPhone || "").trim(),
          customFields: data.customFields || existing.customFields || "",
          status: existing.status || "registered",
          classYear: existing.classYear || "",
        };
    const updated = updateRegistration_(registrationId, safeData);
    if (!updated) {
      return { ok: false, data: null, error: "Registration not found" };
    }
    invalidateCacheKeys_(["registrations:list:v1"]);
    return { ok: true, data: { registration: updated }, error: null };
  }

  if (payload.action === "adminCreateRegistration") {
    const data = payload.data || {};
    const eventId = String(data.eventId || "").trim();
    const email = normalizeEmail_(data.userEmail || data.email);
    if (!eventId || !email) {
      return { ok: false, data: null, error: "Missing eventId or email" };
    }
    const event = findEventById_(eventId);
    if (!event) {
      return { ok: false, data: null, error: "Event not found" };
    }
    if (isDuplicateRegistration_(eventId, email)) {
      return { ok: false, data: null, error: "Duplicate registration" };
    }
    const actor = getAdminActorInfo_(payload);
    const customFields = parseCustomFields_(data.customFields);
    const studentId = String(data.studentId || customFields.studentId || "").trim();
    if (studentId && !customFields.studentId) {
      customFields.studentId = studentId;
    }
    if (!customFields.name && data.userName) {
      customFields.name = String(data.userName || "").trim();
    }
    const registrationId = appendRegistration_(
      eventId,
      Object.assign({}, data, {
        studentId: studentId,
        customFields: customFields,
      }),
      email,
      {
        source: "admin_manual",
        actorEmail: actor.email,
        actorName: actor.name,
        actorStudentId: actor.studentId,
      }
    );
    invalidateCacheKeys_(["registrations:list:v1"]);
    return { ok: true, data: { registrationId: registrationId }, error: null };
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
    invalidateCacheKeys_(["registrations:list:v1", "checkins:list:v1"]);
    return { ok: true, data: { id: registrationId }, error: null };
  }

  if (payload.action === "listCheckins") {
    return { ok: true, data: { checkins: listCheckinsCached_() }, error: null };
  }

  if (payload.action === "deleteCheckin") {
    const checkinId = String(payload.id || "").trim();
    if (!checkinId) {
      return { ok: false, data: null, error: "Missing checkin id" };
    }
    const checkin = findCheckinById_(checkinId);
    if (!checkin) {
      return { ok: false, data: null, error: "Checkin not found" };
    }
    const adminAuth = requireGoogleGroupAccess_(payload, ["C", "E"]);
    if (!adminAuth.ok) {
      const email = normalizeEmail_(payload.userEmail || payload.email);
      if (!email) {
        return { ok: false, data: null, error: "Unauthorized" };
      }
      const registration = findRegistrationById_(String(checkin.registrationId || "").trim());
      if (!registration || normalizeEmail_(registration.userEmail) !== email) {
        return { ok: false, data: null, error: "Unauthorized" };
      }
    }
    const removed = deleteCheckin_(checkinId);
    if (!removed) {
      return { ok: false, data: null, error: "Checkin not found" };
    }
    invalidateCacheKeys_(["checkins:list:v1"]);
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
    const hasLegacyAuthToken = String(payload.authToken || "").trim() !== "";
    const auth = hasLegacyAuthToken
      ? requireAuth_(payload)
      : requireDirectoryOrAdminAccess_(payload);
    if (!auth.ok) {
      return auth;
    }
    return { ok: true, data: { directory: listDirectoryCached_() }, error: null };
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
    invalidateCacheKeys_([CACHE_KEYS.directory, CACHE_KEYS.birthdays]);
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
    invalidateCacheKeys_(["registrations:list:v1"]);
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

    const checkin = appendCheckin_(eventId, registration.id, data);
    invalidateCacheKeys_(["checkins:list:v1"]);
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
    const statuses = buildCheckinStatusMapByEmail_(email, eventIds);
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
  const blobName = String(blob.getName() || "").trim();
  const extension = blobName && blobName.indexOf(".") !== -1
    ? String(blobName.split(".").pop() || "").toLowerCase()
    : "";
  if (!extension || !ALLOWED_UPLOAD_EXTENSIONS[extension]) {
    return ContentService.createTextOutput(
      "<script>window.parent.postMessage({type:'uploadResult',payload:{ok:false,error:'Unsupported file type'}},'*');</script>"
    ).setMimeType(ContentService.MimeType.HTML);
  }
  const bytes = blob.getBytes();
  if (!bytes || bytes.length > UPLOAD_MAX_BYTES) {
    return ContentService.createTextOutput(
      "<script>window.parent.postMessage({type:'uploadResult',payload:{ok:false,error:'File exceeds 10MB limit'}},'*');</script>"
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
      attachments.push({
        name: file.getName(),
        url: file.getUrl(),
        fileId: file.getId(),
        size: bytes.length,
        contentType: String(blob.getContentType() || "").trim(),
      });
      updateEvent_(eventId, { attachments: JSON.stringify(attachments) });
    }
  }
  var payload = {
    ok: true,
    data: {
      fileId: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      size: bytes.length,
      contentType: String(blob.getContentType() || "").trim(),
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

function normalizeBirthdayPart_(value, min, max) {
  if (value === null || value === undefined) {
    return "";
  }
  var raw = String(value).trim();
  if (!raw) {
    return "";
  }
  var parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    return "";
  }
  return pad2_(parsed);
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

function ensureSoftballPlayersSchema_(sheet) {
  const targetSheet = sheet || getSheet_(SHEETS.softballPlayers);
  const headers = getHeaders_(targetSheet);
  if (headers.indexOf("jerseySize") === -1) {
    targetSheet.getRange(1, headers.length + 1).setValue("jerseySize");
  }
  return targetSheet;
}

function normalizeSoftballJerseySize_(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }
  const aliasMap = {
    XXL: "2L",
    "2XL": "2L",
    XXXL: "3L",
    "3XL": "3L",
    XXXXXL: "5L",
    "5XL": "5L",
    XXXXXXL: "6L",
    "6XL": "6L",
  };
  const normalized = aliasMap[raw] || raw;
  return SOFTBALL_JERSEY_SIZE_OPTIONS.indexOf(normalized) >= 0 ? normalized : "";
}

function buildSoftballSelfProfilePayload_(data, studentId, existingRecord) {
  const source = data || {};
  const existing = existingRecord || {};
  const jerseyRequest = String(
    source.jerseyRequest === undefined ? existing.jerseyRequest || "" : source.jerseyRequest || ""
  ).trim();
  const positionRequest = String(
    source.positionRequest === undefined ? existing.positionRequest || "" : source.positionRequest || ""
  ).trim();
  const previousStatusRaw = String(existing.requestStatus || "").trim();
  const previousStatus = previousStatusRaw.toLowerCase();
  let requestStatus = previousStatusRaw;
  if (jerseyRequest || positionRequest) {
    requestStatus = "pending";
  } else if (previousStatus === "pending") {
    requestStatus = "";
  }

  return {
    id: String(studentId || "").trim(),
    name: String(source.name === undefined ? existing.name || "" : source.name || "").trim(),
    preferredName: String(
      source.preferredName === undefined ? existing.preferredName || "" : source.preferredName || ""
    ).trim(),
    email: normalizeEmail_(source.email === undefined ? existing.email || "" : source.email || ""),
    phone: String(source.phone === undefined ? existing.phone || "" : source.phone || "").trim(),
    nickname: String(source.nickname === undefined ? existing.nickname || "" : source.nickname || "").trim(),
    bats: String(source.bats === undefined ? existing.bats || "" : source.bats || "").trim(),
    throws: String(source.throws === undefined ? existing.throws || "" : source.throws || "").trim(),
    positions: String(source.positions === undefined ? existing.positions || "" : source.positions || "").trim(),
    jerseyChoices: String(
      source.jerseyChoices === undefined ? existing.jerseyChoices || "" : source.jerseyChoices || ""
    ).trim(),
    jerseySize: normalizeSoftballJerseySize_(
      source.jerseySize === undefined ? existing.jerseySize || "" : source.jerseySize || ""
    ),
    jerseyRequest: jerseyRequest,
    positionRequest: positionRequest,
    requestStatus: requestStatus,
    notes: String(source.notes === undefined ? existing.notes || "" : source.notes || "").trim(),
  };
}

function getMemoValue_(key, loader) {
  if (Object.prototype.hasOwnProperty.call(REQUEST_MEMO_, key)) {
    return REQUEST_MEMO_[key];
  }
  const value = loader();
  REQUEST_MEMO_[key] = value;
  return value;
}

function getStudentsIndex_() {
  return getMemoValue_("index:students", function () {
    const byId = {};
    const byGoogleSub = {};
    listStudentsCached_().forEach(function (item) {
      const id = String(item.id || "").trim();
      if (id) {
        byId[id] = item;
      }
      const sub = String(item.googleSub || "").trim();
      if (sub) {
        byGoogleSub[sub] = item;
      }
    });
    return { byId: byId, byGoogleSub: byGoogleSub };
  });
}

function getDirectoryIndex_() {
  return getMemoValue_("index:directory", function () {
    const byId = {};
    const byEmail = {};
    listDirectoryCached_().forEach(function (item) {
      const id = String(item.id || "").trim();
      if (id) {
        byId[id] = item;
      }
      const email = normalizeEmail_(item.email);
      if (email) {
        byEmail[email] = item;
      }
    });
    return { byId: byId, byEmail: byEmail };
  });
}

function getEventsIndex_() {
  return getMemoValue_("index:events", function () {
    const byId = {};
    listEventsCached_().forEach(function (item) {
      const id = String(item.id || "").trim();
      if (id) {
        byId[id] = item;
      }
    });
    return byId;
  });
}

function getFinanceActionsIndex_() {
  return getMemoValue_("index:financeActions", function () {
    const byRequest = {};
    const byActor = {};
    const latestByRequest = {};
    listFinanceActionsCached_().forEach(function (item) {
      const requestId = String(item.requestId || "").trim();
      if (requestId) {
        if (!byRequest[requestId]) {
          byRequest[requestId] = [];
        }
        byRequest[requestId].push(item);
        const currentLatest = latestByRequest[requestId];
        if (!currentLatest) {
          latestByRequest[requestId] = item;
        } else {
          const currentCreated = String(currentLatest.createdAt || "");
          const nextCreated = String(item.createdAt || "");
          if (nextCreated.localeCompare(currentCreated) > 0) {
            latestByRequest[requestId] = item;
          }
        }
      }
      const actorName = String(item.actorName || "").trim();
      if (actorName) {
        if (!byActor[actorName]) {
          byActor[actorName] = [];
        }
        byActor[actorName].push(item);
      }
    });
    return { byRequest: byRequest, byActor: byActor, latestByRequest: latestByRequest };
  });
}

function getRegistrationsIndex_() {
  return getMemoValue_("index:registrations", function () {
    const byId = {};
    const byEventEmail = {};
    listRegistrationsCached_().forEach(function (item) {
      const id = String(item.id || "").trim();
      if (id) {
        byId[id] = item;
      }
      const eventId = String(item.eventId || "").trim();
      const email = normalizeEmail_(item.userEmail);
      if (!eventId || !email) {
        return;
      }
      const key = eventId + "::" + email;
      if (!Object.prototype.hasOwnProperty.call(byEventEmail, key)) {
        byEventEmail[key] = item;
      }
    });
    return { byId: byId, byEventEmail: byEventEmail };
  });
}

function getCheckinsIndex_() {
  return getMemoValue_("index:checkins", function () {
    const byId = {};
    const byEventRegistration = {};
    listCheckinsCached_().forEach(function (item) {
      const id = String(item.id || "").trim();
      if (id) {
        byId[id] = item;
      }
      const eventId = String(item.eventId || "").trim();
      const registrationId = String(item.registrationId || "").trim();
      if (!eventId || !registrationId) {
        return;
      }
      const key = eventId + "::" + registrationId;
      if (!Object.prototype.hasOwnProperty.call(byEventRegistration, key)) {
        byEventRegistration[key] = item;
      }
    });
    return { byId: byId, byEventRegistration: byEventRegistration };
  });
}

function getLineBindingsIndex_() {
  return getMemoValue_("index:lineBindings", function () {
    const byLineUserId = {};
    const byStudentId = {};
    listLineBindingsCached_().forEach(function (item) {
      const normalized = normalizeLineBindingRecord_(item || {});
      const lineUserId = String(normalized.lineUserId || "").trim();
      const studentId = String(normalized.studentId || "").trim();
      const currentStatus = String(normalized.status || "").trim().toLowerCase();
      const currentIsActive = currentStatus === "" || currentStatus === "active" || currentStatus === "bound";

      if (lineUserId) {
        const previous = byLineUserId[lineUserId];
        if (!previous) {
          byLineUserId[lineUserId] = normalized;
        } else {
          const previousStatus = String(previous.status || "").trim().toLowerCase();
          const previousIsActive =
            previousStatus === "" || previousStatus === "active" || previousStatus === "bound";
          if (currentIsActive && !previousIsActive) {
            byLineUserId[lineUserId] = normalized;
          } else if (currentIsActive === previousIsActive) {
            const prevUpdated = String(previous.updatedAt || previous.boundAt || previous.createdAt || "");
            const nextUpdated = String(
              normalized.updatedAt || normalized.boundAt || normalized.createdAt || ""
            );
            if (nextUpdated.localeCompare(prevUpdated) > 0) {
              byLineUserId[lineUserId] = normalized;
            }
          }
        }
      }

      if (studentId) {
        if (!byStudentId[studentId]) {
          byStudentId[studentId] = [];
        }
        byStudentId[studentId].push(normalized);
      }
    });
    return { byLineUserId: byLineUserId, byStudentId: byStudentId };
  });
}

function findLineBindingByLineUserId_(lineUserId) {
  const id = String(lineUserId || "").trim();
  if (!id) {
    return null;
  }
  const index = getLineBindingsIndex_();
  return index.byLineUserId[id] || null;
}

function findLineBindingByStudentId_(studentId) {
  const id = String(studentId || "").trim();
  if (!id) {
    return [];
  }
  const index = getLineBindingsIndex_();
  return index.byStudentId[id] ? index.byStudentId[id].slice() : [];
}

function findStudentById_(studentId) {
  const id = String(studentId || "").trim();
  if (!id) {
    return null;
  }
  const index = getStudentsIndex_();
  return index.byId[id] || null;
}

function findDirectoryById_(directoryId) {
  const id = String(directoryId || "").trim();
  if (!id) {
    return null;
  }
  const index = getDirectoryIndex_();
  return index.byId[id] || null;
}

function findDirectoryByEmail_(email) {
  const normalized = normalizeEmail_(email);
  if (!normalized) {
    return null;
  }
  const index = getDirectoryIndex_();
  return index.byEmail[normalized] || null;
}

function findStudentByGoogleSub_(googleSub) {
  const sub = String(googleSub || "").trim();
  if (!sub) {
    return null;
  }
  const index = getStudentsIndex_();
  return index.byGoogleSub[sub] || null;
}

function findEventById_(eventId) {
  const id = String(eventId || "").trim();
  if (!id) {
    return null;
  }
  const index = getEventsIndex_();
  return index[id] || null;
}

function findOrderPlanById_(orderId) {
  const target = String(orderId || "").trim();
  if (!target) {
    return null;
  }
  const plans = listOrderPlansCached_();
  for (var i = 0; i < plans.length; i++) {
    if (String(plans[i].id || "").trim() === target) {
      return plans[i];
    }
  }
  return null;
}

function findSoftballPlayerById_(playerId) {
  const sheet = ensureSoftballPlayersSchema_(getSheet_(SHEETS.softballPlayers));
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
  const sheet = ensureSoftballPlayersSchema_(getSheet_(SHEETS.softballPlayers));
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

function listSoftballAttendanceCore_() {
  const sheet = getSheet_(SHEETS.softballAttendance);
  const headerMap = getHeaderMap_(sheet);
  return getDataRows_(sheet).map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listSoftballAttendance_(practiceId, studentId) {
  const rows = listSoftballAttendanceCached_();
  const normalizedPracticeId = String(practiceId || "").trim();
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedPracticeId && !normalizedStudentId) {
    return rows;
  }
  return rows.filter(function (row) {
    if (normalizedPracticeId && String(row.practiceId || "").trim() !== normalizedPracticeId) {
      return false;
    }
    if (normalizedStudentId && String(row.studentId || "").trim() !== normalizedStudentId) {
      return false;
    }
    return true;
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

function listOrderResponsesCore_() {
  const sheet = getSheet_(SHEETS.orderResponses);
  const headerMap = getHeaderMap_(sheet);
  return getDataRows_(sheet).map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listOrderResponses_(orderId) {
  const rows = listOrderResponsesCached_();
  if (!orderId) {
    return rows;
  }
  const targetId = String(orderId).trim();
  return rows.filter(function (row) {
    return String(row.orderId || "").trim() === targetId;
  });
}

function listOrderResponsesByStudent_(studentId) {
  const rows = listOrderResponsesCached_();
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

function listBirthdays_() {
  const months = {};
  for (var month = 1; month <= 12; month += 1) {
    months[String(month)] = [];
  }

  const list = listDirectoryCached_();
  for (var i = 0; i < list.length; i += 1) {
    const item = normalizeDirectoryRecord_(list[i] || {});
    const monthValue = Number(item.birthdayMonth || 0);
    const dayValue = Number(item.birthdayDay || 0);
    if (!monthValue || !dayValue || monthValue < 1 || monthValue > 12 || dayValue < 1 || dayValue > 31) {
      continue;
    }
    const displayName = String(item.preferredName || item.nameZh || item.nameEn || item.id || "").trim();
    const nameZh = String(item.nameZh || "").trim();
    if (!displayName && !nameZh) {
      continue;
    }
    const birthdayName = displayName && nameZh && displayName !== nameZh
      ? displayName + " (" + nameZh + ")"
      : displayName || nameZh;
    months[String(monthValue)].push({
      id: String(item.id || "").trim(),
      name: birthdayName,
      nameZh: nameZh,
      month: monthValue,
      day: dayValue,
    });
  }

  Object.keys(months).forEach(function (key) {
    months[key].sort(function (a, b) {
      const dayA = Number(a.day || 0);
      const dayB = Number(b.day || 0);
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  });

  const currentMonth = new Date().getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  return {
    months: months,
    currentMonth: currentMonth,
    nextMonth: nextMonth,
    updatedAt: new Date().toISOString(),
  };
}

function listFinanceRequestsCore_() {
  const sheet = getSheet_(SHEETS.financeRequests);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listFinanceRequests_(payload) {
  const applicantEmail = normalizeEmail_(payload && payload.applicantEmail);
  const list = listFinanceRequestsCached_();
  const filtered = applicantEmail
    ? list.filter(function (item) {
        return normalizeEmail_(item.applicantEmail) === applicantEmail;
      })
    : list;
  const needsApplicantRoleResolve = filtered.some(function (item) {
    return !String(item.applicantRole || "").trim();
  });
  const memberships = needsApplicantRoleResolve ? listGroupMembershipsCached_() : [];
  const roleByPerson = {};
  const roleByPersonGroup = {};
  if (needsApplicantRoleResolve) {
    for (var i = 0; i < memberships.length; i += 1) {
      const membership = memberships[i] || {};
      const personId = String(membership.personId || "").trim();
      if (!personId) {
        continue;
      }
      const role = String(membership.roleInGroup || "").trim().toLowerCase();
      if (role && !Object.prototype.hasOwnProperty.call(roleByPerson, personId)) {
        roleByPerson[personId] = role;
      }
      const groupId = normalizeGroupId_(membership.groupId || "");
      if (!groupId || !role) {
        continue;
      }
      const personGroupKey = personId + "::" + groupId;
      if (!Object.prototype.hasOwnProperty.call(roleByPersonGroup, personGroupKey)) {
        roleByPersonGroup[personGroupKey] = role;
      }
    }
  }
  const personIdByEmail = {};
  const resolveApplicantRoleFast_ = function (record) {
    const explicitRole = String(record.applicantRole || "").trim().toLowerCase();
    if (explicitRole) {
      return explicitRole;
    }
    var applicantId = String(record.applicantId || "").trim();
    if (!applicantId) {
      const email = normalizeEmail_(record.applicantEmail || "");
      if (email) {
        if (!Object.prototype.hasOwnProperty.call(personIdByEmail, email)) {
          personIdByEmail[email] = resolvePersonIdByEmail_(email);
        }
        applicantId = String(personIdByEmail[email] || "").trim();
      }
    }
    if (!applicantId) {
      return "";
    }
    const groupId = normalizeGroupId_(record.applicantDepartment || "");
    if (groupId) {
      const groupRole = roleByPersonGroup[applicantId + "::" + groupId];
      if (groupRole) {
        return groupRole;
      }
    }
    return roleByPerson[applicantId] || "";
  };
  const enriched = filtered.map(function (item) {
    if (String(item.applicantRole || "").trim()) {
      return item;
    }
    var role = resolveApplicantRoleFast_(item);
    if (!role) {
      return item;
    }
    return Object.assign({}, item, { applicantRole: role });
  });
  return enriched.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function listFinanceActions_(requestId) {
  const id = String(requestId || "").trim();
  if (!id) {
    return [];
  }
  const index = getFinanceActionsIndex_();
  const list = index.byRequest[id] ? index.byRequest[id].slice() : [];
  return list.sort(function (a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function listFinanceActionsCore_() {
  const sheet = getSheet_(SHEETS.financeActions);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return mapRowToObject_(headerMap, row);
  });
}

function listFinanceActionsByActor_(actorNames) {
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
  const actorNameSet = normalized.reduce(function (acc, name) {
    acc[name] = true;
    return acc;
  }, {});
  const index = getFinanceActionsIndex_();
  const list = [];
  const dedupedNames = Object.keys(actorNameSet);
  for (var i = 0; i < dedupedNames.length; i++) {
    const actorName = dedupedNames[i];
    if (!actorName) {
      continue;
    }
    const rows = index.byActor[actorName] || [];
    if (!rows.length) {
      continue;
    }
    for (var j = 0; j < rows.length; j++) {
      list.push(rows[j]);
    }
  }
  return list.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function listFinanceActionsSummary_(requestIds) {
  const index = getFinanceActionsIndex_();
  const idSet = (requestIds || []).reduce(function (acc, id) {
    const key = String(id || "").trim();
    if (key) {
      acc[key] = true;
    }
    return acc;
  }, {});
  const latestById = {};
  const ids = Object.keys(idSet);
  for (var i = 0; i < ids.length; i++) {
    const requestId = ids[i];
    if (!requestId) {
      continue;
    }
    const item = index.latestByRequest[requestId];
    if (item) {
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

function listLineBindings_() {
  const sheet = getSheet_(SHEETS.lineBindings);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows.map(function (row) {
    return normalizeLineBindingRecord_(mapRowToObject_(headerMap, row));
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

function listFundPaymentsCore_() {
  const sheet = getSheet_(SHEETS.fundPayments);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    });
}

function listFundPayments_(eventId) {
  const id = String(eventId || "").trim();
  return listFundPaymentsCached_()
    .filter(function (item) {
      return !id || String(item.eventId || "").trim() === id;
    })
    .sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function listAnnouncements_() {
  const sheet = getSheet_(SHEETS.announcements);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .map(function (item) {
      return normalizeAnnouncementRecord_(item);
    });
}

function listNotificationReads_() {
  const sheet = getSheet_(SHEETS.notificationReads);
  const headerMap = getHeaderMap_(sheet);
  const rows = getDataRows_(sheet);
  return rows
    .map(function (row) {
      return mapRowToObject_(headerMap, row);
    })
    .map(function (item) {
      return normalizeNotificationReadRecord_(item);
    });
}

function listNotificationReadMap_(studentId, email) {
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  const reads = listNotificationReadsCached_().filter(function (item) {
    if (normalizedStudentId && String(item.readerStudentId || "").trim() === normalizedStudentId) {
      return true;
    }
    return !!normalizedEmail && normalizeEmail_(item.readerEmail) === normalizedEmail;
  });
  return reads.reduce(function (acc, item) {
    const id = String(item.notificationId || "").trim();
    if (id) {
      acc[id] = true;
    }
    return acc;
  }, {});
}

function buildNotificationsPayload_(studentId, email) {
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedStudentId && !normalizedEmail) {
    return { notifications: [], unreadCount: 0 };
  }
  const identityKey = normalizedStudentId + "::" + normalizedEmail;
  const cacheKey = buildDynamicCacheKey_(CACHE_KEYS.notificationsPayloadPrefix, identityKey);
  return getCachedJson_(cacheKey, 20, function () {
    const notifications = listNotifications_(normalizedStudentId, normalizedEmail);
    const readMap = listNotificationReadMap_(normalizedStudentId, normalizedEmail);
    const enriched = notifications.map(function (item) {
      const id = String(item.id || "").trim();
      const isRead = !!readMap[id];
      return Object.assign({}, item, { isRead: isRead });
    });
    const sorted = sortNotifications_(enriched);
    const unreadCount = sorted.filter(function (item) {
      return !item.isRead;
    }).length;
    return { notifications: sorted, unreadCount: unreadCount };
  });
}

function canApproveFinanceRequestForIdentity_(record, actorId, actorEmail, memberships, financeRoles) {
  var roles = ["lead", "rep", "committee", "accounting", "cashier"];
  for (var i = 0; i < roles.length; i++) {
    if (canFinanceActorApprove_(record, roles[i], actorId, actorEmail, memberships, financeRoles)) {
      return true;
    }
  }
  return false;
}

function buildApprovalsOverviewPayload_(studentId, email) {
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedStudentId && !normalizedEmail) {
    return {
      pending: 0,
      inProgress: 0,
      completed: 0,
      returned: 0,
      total: 0,
    };
  }

  const identityKey = normalizedStudentId + "::" + normalizedEmail;
  const cacheKey = buildDynamicCacheKey_(CACHE_KEYS.approvalsOverviewPrefix, identityKey);
  return getCachedJson_(cacheKey, 30, function () {
    const actorId = normalizedStudentId || resolvePersonIdByEmail_(normalizedEmail);
    const memberships = listGroupMembershipsCached_();
    const financeRoles = listFinanceRolesCached_();
    const requests = listFinanceRequestsCached_();
    var pending = 0;
    var inProgress = 0;
    var completed = 0;
    var returned = 0;

    requests.forEach(function (record) {
      const status = String(record.status || "").trim().toLowerCase();
      const isMine = isSameApplicant_(record, actorId, normalizedEmail);

      if (status === "closed") {
        if (isMine) {
          completed += 1;
        }
        return;
      }

      if (status === "returned") {
        if (isMine) {
          returned += 1;
        }
        return;
      }

      if (status.indexOf("pending_") !== 0) {
        return;
      }

      const canApprove = canApproveFinanceRequestForIdentity_(
        record,
        actorId,
        normalizedEmail,
        memberships,
        financeRoles
      );
      if (canApprove) {
        pending += 1;
        return;
      }
      if (isMine) {
        inProgress += 1;
      }
    });

    return {
      pending: pending,
      inProgress: inProgress,
      completed: completed,
      returned: returned,
      total: pending + inProgress + completed + returned,
    };
  });
}

function buildCheckinStatusMapByEmail_(email, eventIds) {
  const normalizedEmail = normalizeEmail_(email);
  const ids = Array.isArray(eventIds)
    ? eventIds
        .map(function (id) {
          return String(id || "").trim();
        })
        .filter(function (id) {
          return id;
        })
    : [];
  ids.sort();
  const dedupedIds = ids.filter(function (id, index) {
    return index === 0 || ids[index - 1] !== id;
  });
  if (!normalizedEmail || !dedupedIds.length) {
    return {};
  }
  const cacheInput = normalizedEmail + "::" + dedupedIds.join(",");
  const cacheKey = buildDynamicCacheKey_(CACHE_KEYS.checkinStatusMapPrefix, cacheInput);
  return getCachedJson_(cacheKey, 20, function () {
    const registrations = listRegistrationsCached_();
    const registrationByEventEmail = {};
    for (var i = 0; i < registrations.length; i++) {
      const item = registrations[i];
      const eventId = String(item.eventId || "").trim();
      const rowEmail = normalizeEmail_(item.userEmail);
      if (!eventId || !rowEmail) {
        continue;
      }
      const key = eventId + "::" + rowEmail;
      if (!Object.prototype.hasOwnProperty.call(registrationByEventEmail, key)) {
        registrationByEventEmail[key] = item;
      }
    }

    const checkins = listCheckinsCached_();
    const checkinByEventRegistration = {};
    for (var j = 0; j < checkins.length; j++) {
      const checkinItem = checkins[j];
      const eventId = String(checkinItem.eventId || "").trim();
      const registrationId = String(checkinItem.registrationId || "").trim();
      if (!eventId || !registrationId) {
        continue;
      }
      const key = eventId + "::" + registrationId;
      if (!Object.prototype.hasOwnProperty.call(checkinByEventRegistration, key)) {
        checkinByEventRegistration[key] = checkinItem;
      }
    }

    const statuses = {};
    for (var k = 0; k < dedupedIds.length; k++) {
      const eventId = dedupedIds[k];
      const registrationKey = eventId + "::" + normalizedEmail;
      const registration = registrationByEventEmail[registrationKey];
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
      const checkinKey = eventId + "::" + String(registration.id || "").trim();
      const checkin = checkinByEventRegistration[checkinKey];
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

    return statuses;
  });
}

function upsertNotificationRead_(notificationId, studentId, email) {
  const sheet = getSheet_(SHEETS.notificationReads);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("NotificationReads sheet missing id column");
  }
  const normalizedNotificationId = String(notificationId || "").trim();
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  const readId = normalizedStudentId
    ? normalizedNotificationId + "::" + normalizedStudentId
    : normalizedNotificationId + "::" + normalizedEmail;
  const nowIso = new Date().toISOString();
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex] || "").trim() !== readId) {
      continue;
    }
    const existing = mapRowToObject_(headerMap, rows[i]);
    const record = normalizeNotificationReadRecord_(
      Object.assign({}, existing, {
        id: readId,
        notificationId: normalizedNotificationId,
        readerStudentId: normalizedStudentId,
        readerEmail: normalizedEmail,
        readAt: nowIso,
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
  const created = normalizeNotificationReadRecord_({
    id: readId,
    notificationId: normalizedNotificationId,
    readerStudentId: normalizedStudentId,
    readerEmail: normalizedEmail,
    readAt: nowIso,
  });
  const headers = getHeaders_(sheet);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (created.hasOwnProperty(header)) {
      values[index] = created[header];
    }
  });
  sheet.appendRow(values);
  return created;
}

function upsertAnnouncement_(data) {
  const announcementId = String(data.id || "").trim();
  if (!announcementId) {
    return appendAnnouncement_(data);
  }
  const existing = findAnnouncementById_(announcementId);
  if (!existing) {
    return appendAnnouncement_(Object.assign({}, data, { id: announcementId }));
  }
  return updateAnnouncement_(announcementId, data);
}

function appendAnnouncement_(data) {
  const sheet = getSheet_(SHEETS.announcements);
  const headers = getHeaders_(sheet);
  const nowIso = new Date().toISOString();
  const record = normalizeAnnouncementRecord_(
    Object.assign({}, data, {
      id: String(data.id || generateAnnouncementId_()).trim(),
      createdAt: String(data.createdAt || nowIso).trim(),
      updatedAt: String(data.updatedAt || nowIso).trim(),
    })
  );
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
}

function updateAnnouncement_(announcementId, data) {
  const sheet = getSheet_(SHEETS.announcements);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Announcements sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex] || "").trim() !== announcementId) {
      continue;
    }
    const existing = mapRowToObject_(headerMap, rows[i]);
    const record = normalizeAnnouncementRecord_(
      Object.assign({}, existing, data, {
        id: announcementId,
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
  throw new Error("Announcement not found");
}

function deleteAnnouncement_(announcementId) {
  const sheet = getSheet_(SHEETS.announcements);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Announcements sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex] || "").trim() === announcementId) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function findAnnouncementById_(announcementId) {
  if (!announcementId) {
    return null;
  }
  const sheet = getSheet_(SHEETS.announcements);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  if (idIndex === undefined) {
    throw new Error("Announcements sheet missing id column");
  }
  const rows = getDataRows_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idIndex] || "").trim() === announcementId) {
      return normalizeAnnouncementRecord_(mapRowToObject_(headerMap, rows[i]));
    }
  }
  return null;
}

function listNotifications_(studentId, email) {
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  const now = new Date();
  const groups = normalizedStudentId
    ? listGroupMembershipsCached_()
        .filter(function (item) {
          return String(item.personId || "").trim() === normalizedStudentId;
        })
        .map(function (item) {
          return String(item.groupId || "").trim();
        })
        .filter(function (value) {
          return value;
        })
    : [];
  const groupSet = {};
  groups.forEach(function (groupId) {
    groupSet[groupId] = true;
  });
  const announcements = listAnnouncementsCached_()
    .filter(function (item) {
      return String(item.status || "active").trim().toLowerCase() === "active";
    })
    .filter(function (item) {
      if (!item.startAt && !item.endAt) {
        return true;
      }
      const start = parseDateSafe_(item.startAt);
      const end = parseDateSafe_(item.endAt);
      if (start && start.getTime() > now.getTime()) {
        return false;
      }
      if (end && end.getTime() < now.getTime()) {
        return false;
      }
      return true;
    })
    .filter(function (item) {
      const scope = String(item.scope || "all").trim().toLowerCase();
      const targetKey = String(item.targetKey || "all").trim();
      if (scope === "all") {
        return true;
      }
      if (scope === "person") {
        if (!targetKey) {
          return false;
        }
        if (normalizedStudentId && targetKey === normalizedStudentId) {
          return true;
        }
        return !!normalizedEmail && normalizeEmail_(targetKey) === normalizedEmail;
      }
      if (scope === "group") {
        return !!groupSet[targetKey];
      }
      return false;
    })
    .map(function (item) {
      return {
        id: String(item.id || "").trim(),
        type: "announcement",
        source: "announcement",
        title: String(item.title || "").trim(),
        message: String(item.message || "").trim(),
        level: String(item.level || "info").trim().toLowerCase(),
        ctaLabel: String(item.ctaLabel || "").trim(),
        ctaUrl: String(item.ctaUrl || "").trim(),
        createdAt: String(item.createdAt || "").trim(),
        expiresAt: String(item.endAt || "").trim(),
      };
    });
  const todos = buildTodoNotifications_(normalizedStudentId, normalizedEmail);
  return announcements.concat(todos);
}

function buildTodoNotifications_(studentId, email) {
  if (!studentId && !email) {
    return [];
  }
  const notifications = [];
  const now = new Date();
  const nowTs = now.getTime();
  const normalizeIdKey_ = function (value) {
    return String(value || "").trim().toLowerCase();
  };

  const events = listEventsCached_().filter(function (event) {
    const status = String(event.status || "").trim().toLowerCase();
    if (status && status !== "open") {
      return false;
    }
    const openAt = parseDateSafe_(event.registrationOpenAt);
    const closeAt = parseDateSafe_(event.registrationCloseAt);
    if (openAt && openAt.getTime() > nowTs) {
      return false;
    }
    if (closeAt && closeAt.getTime() < nowTs) {
      return false;
    }
    return true;
  });
  const registrations = listRegistrationsCached_().filter(function (item) {
    return normalizeEmail_(item.userEmail) === email;
  });
  const registeredEventSet = {};
  registrations.forEach(function (item) {
    registeredEventSet[String(item.eventId || "").trim()] = true;
  });
  events.forEach(function (event) {
    const eventId = String(event.id || "").trim();
    if (!eventId || registeredEventSet[eventId]) {
      return;
    }
    notifications.push({
      id: "todo:event:" + eventId,
      type: "todo",
      source: "events",
      title: "有新活動待報名",
      message: String(event.title || eventId) + " 尚未報名。",
      level: "warning",
      ctaLabel: "前往活動",
      ctaUrl: buildTodoCtaUrl_("events", { eventId: eventId }),
      createdAt: String(event.createdAt || event.registrationOpenAt || "").trim(),
      expiresAt: String(event.registrationCloseAt || "").trim(),
    });
  });

  const fundEvents = listFundEventsCached_().filter(function (item) {
    return String(item.status || "").trim().toLowerCase() === "collecting";
  });
  const fundPayments = listFundPaymentsCached_();
  const paidSet = {};
  fundPayments.forEach(function (item) {
    const payerId = String(item.payerId || "").trim();
    const payerEmail = normalizeEmail_(item.payerEmail);
    if (payerId) {
      paidSet["id:" + payerId + "::event:" + String(item.eventId || "").trim()] = true;
    }
    if (payerEmail) {
      paidSet["email:" + payerEmail + "::event:" + String(item.eventId || "").trim()] = true;
    }
  });
  fundEvents.forEach(function (item) {
    const eventId = String(item.id || "").trim();
    const byId = studentId && paidSet["id:" + studentId + "::event:" + eventId];
    const byEmail = email && paidSet["email:" + email + "::event:" + eventId];
    if (byId || byEmail) {
      return;
    }
    notifications.push({
      id: "todo:fund:" + eventId,
      type: "todo",
      source: "fund",
      title: "班費待繳交回報",
      message: String(item.title || eventId) + " 尚未回報繳交。",
      level: "warning",
      ctaLabel: "前往財務",
      ctaUrl: buildTodoCtaUrl_("fund", { eventId: eventId }),
      createdAt: String(item.createdAt || "").trim(),
      expiresAt: String(item.dueDate || "").trim(),
    });
  });

  const players = listSoftballPlayersCached_();
  const player = players.find(function (item) {
    const id = String(item.id || "").trim();
    if (studentId && id && id === studentId) {
      return true;
    }
    return !!email && normalizeEmail_(item.email) === email;
  });
  if (!player || !String(player.name || "").trim()) {
    notifications.push({
      id: "todo:softball:profile:" + (studentId || email),
      type: "todo",
      source: "softball-profile",
      title: "請完成球員資料登錄",
      message: "所有同學都需要完成球員資料。",
      level: "warning",
      ctaLabel: "前往填寫",
      ctaUrl: buildTodoCtaUrl_("softball-profile", {}),
      createdAt: new Date().toISOString(),
      expiresAt: "",
    });
  }

  const candidateStudentIdSet = {};
  const normalizedStudentId = normalizeIdKey_(studentId);
  if (normalizedStudentId) {
    candidateStudentIdSet[normalizedStudentId] = true;
  }
  if (email) {
    players.forEach(function (item) {
      if (normalizeEmail_(item.email) !== email) {
        return;
      }
      const playerIdKey = normalizeIdKey_(item.id);
      if (playerIdKey) {
        candidateStudentIdSet[playerIdKey] = true;
      }
    });
  }
  const hasCandidateStudentId = Object.keys(candidateStudentIdSet).length > 0;
  const attendance = hasCandidateStudentId
    ? listSoftballAttendance_("", "").filter(function (item) {
        const itemStudentIdKey = normalizeIdKey_(item.studentId);
        return !!itemStudentIdKey && !!candidateStudentIdSet[itemStudentIdKey];
      })
    : [];
  const attendanceMap = {};
  const attendanceRespondedSet = {};
  attendance.forEach(function (item) {
    const practiceId = String(item.practiceId || "").trim();
    if (practiceId) {
      attendanceMap[practiceId] = String(item.status || "").trim().toLowerCase();
      attendanceRespondedSet[practiceId] = true;
    }
  });
  const nearestPractice = listSoftballPracticesCached_()
    .map(function (item) {
      const date = parseDateSafe_(item.date || item.startAt);
      return { item: item, date: date };
    })
    .filter(function (entry) {
      return entry.date && entry.date.getTime() >= nowTs;
    })
    .sort(function (a, b) {
      return a.date.getTime() - b.date.getTime();
    })[0];

  if (nearestPractice && nearestPractice.item) {
    const practice = nearestPractice.item;
    const practiceId = String(practice.id || "").trim();
    const hasResponse = !!attendanceRespondedSet[practiceId];
    const status = attendanceMap[practiceId] || "unknown";
    if (!hasResponse || status === "") {
      notifications.push({
        id: "todo:softball:attendance:" + practiceId,
        type: "todo",
        source: "softball-attendance",
        title: "請回覆練習出席狀態",
        message: String(practice.title || "近期練習") + " 尚未回覆出席。",
        level: "warning",
        ctaLabel: "前往回覆",
        ctaUrl: buildTodoCtaUrl_("softball-attendance", { practiceId: practiceId }),
        createdAt: String(practice.createdAt || practice.date || "").trim(),
        expiresAt: String(practice.date || "").trim(),
      });
    }
  }

  return notifications;
}

function buildTodoCtaUrl_(source, payload) {
  const normalizedSource = String(source || "").trim().toLowerCase();
  const data = payload || {};
  const eventId = String(data.eventId || "").trim();
  const practiceId = String(data.practiceId || "").trim();

  if (normalizedSource === "events") {
    return eventId ? "/register?eventId=" + encodeURIComponent(eventId) : "/events";
  }
  if (normalizedSource === "fund") {
    return eventId
      ? "/finance?tab=fund&eventId=" + encodeURIComponent(eventId)
      : "/finance?tab=fund";
  }
  if (normalizedSource === "softball-profile") {
    return "/softball/player?tab=profile";
  }
  if (normalizedSource === "softball-attendance") {
    return practiceId
      ? "/softball/player?tab=attendance&practiceId=" + encodeURIComponent(practiceId)
      : "/softball/player?tab=attendance";
  }
  if (normalizedSource === "checkin") {
    return eventId ? "/checkin?eventId=" + encodeURIComponent(eventId) : "/checkin";
  }
  if (normalizedSource === "finance-requests") {
    return "/finance?tab=requests";
  }
  return "/";
}

function sortNotifications_(items) {
  const levelWeight = { urgent: 0, warning: 1, info: 2 };
  return (items || []).slice().sort(function (a, b) {
    const wA = levelWeight[String(a.level || "info").toLowerCase()];
    const wB = levelWeight[String(b.level || "info").toLowerCase()];
    const weightA = wA === undefined ? 9 : wA;
    const weightB = wB === undefined ? 9 : wB;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function parseDateSafe_(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const buildDate_ = function (year, month, day, hour, minute) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const h = Number(hour || 0);
    const min = Number(minute || 0);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59) {
      return null;
    }
    const date = new Date(y, m - 1, d, h, min, 0, 0);
    if (isNaN(date.getTime())) {
      return null;
    }
    if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
      return null;
    }
    return date;
  };

  // YYYY-MM-DD / YYYY/M/D with optional HH:mm
  var fullMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (fullMatch) {
    return buildDate_(fullMatch[1], fullMatch[2], fullMatch[3], fullMatch[4], fullMatch[5]);
  }

  // M/D or M-D with optional HH:mm. Assume current year.
  var mdMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (mdMatch) {
    var now = new Date();
    var currentYear = now.getFullYear();
    var month = Number(mdMatch[1]);
    var dateThisYear = buildDate_(currentYear, month, mdMatch[2], mdMatch[3], mdMatch[4]);
    if (!dateThisYear) {
      return null;
    }
    // Cross-year fallback for short dates entered without year.
    // Example: now=12/22, target=3/5 should map to next year.
    var nowMonth = now.getMonth() + 1;
    if (dateThisYear.getTime() < now.getTime() && nowMonth >= 10 && month <= 3) {
      var dateNextYear = buildDate_(currentYear + 1, month, mdMatch[2], mdMatch[3], mdMatch[4]);
      if (dateNextYear) {
        return dateNextYear;
      }
    }
    return dateThisYear;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
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
  const normalizedStatus = String(base.status || "").trim();
  const memberships = listGroupMembershipsCached_();
  const applicantRole = resolveApplicantGroupRoleByMemberships_(base, memberships);
  if (!base.applicantRole && applicantRole) {
    base.applicantRole = applicantRole;
  }
  if (!normalizedStatus || normalizedStatus === "pending_lead") {
    base.status = resolveFinanceInitialStatus_(base, memberships);
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

function updateDirectoryByIdOrEmail_(directoryId, email, data) {
  const sheet = getSheet_(SHEETS.directory);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  const emailIndex = headerMap.email;
  if (idIndex === undefined && emailIndex === undefined) {
    throw new Error("Directory sheet missing id/email column");
  }
  const rows = getDataRows_(sheet);
  const normalizedEmail = normalizeEmail_(email);
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = idIndex === undefined ? "" : String(row[idIndex] || "").trim();
    const rowEmail = emailIndex === undefined ? "" : normalizeEmail_(row[emailIndex]);
    if ((directoryId && rowId === directoryId) || (normalizedEmail && rowEmail === normalizedEmail)) {
      const merged = Object.assign({}, mapRowToObject_(headerMap, row), data);
      const record = normalizeDirectoryRecord_(merged);
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
  return null;
}

function buildDirectoryProfileChanges_(before, after) {
  const beforeRecord = normalizeDirectoryRecord_(before || {});
  const afterRecord = normalizeDirectoryRecord_(after || {});
  const fields = [
    "email",
    "mobile",
    "company",
    "title",
    "preferredName",
    "backupPhone",
    "emergencyContact",
    "emergencyPhone",
    "photoUrl",
    "birthdayMonth",
    "birthdayDay",
  ];
  const changes = [];
  fields.forEach(function (field) {
    const beforeValue = beforeRecord[field] || "";
    const afterValue = afterRecord[field] || "";
    if (beforeValue !== afterValue) {
      changes.push({ field: field, from: beforeValue, to: afterValue });
    }
  });
  return changes;
}

function appendDirectoryLog_(payload) {
  const sheet = getSheet_(SHEETS.directoryLogs);
  const headers = getHeaders_(sheet);
  const values = new Array(headers.length).fill("");
  const record = {
    id: Utilities.getUuid(),
    createdAt: payload.createdAt || new Date(),
    actorEmail: normalizeEmail_(payload.actorEmail),
    targetId: String(payload.targetId || "").trim(),
    targetEmail: normalizeEmail_(payload.targetEmail),
    action: String(payload.action || "profile_update").trim(),
    changes: payload.changes || "",
  };
  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });
  sheet.appendRow(values);
  return record;
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
  const sheet = ensureSoftballPlayersSchema_(getSheet_(SHEETS.softballPlayers));
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
  const sheet = ensureSoftballPlayersSchema_(getSheet_(SHEETS.softballPlayers));
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
  const existing = listOrderPlansCached_();
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
  const actorId = String(payload.actorId || "").trim();
  const actorEmail = normalizeEmail_(payload.actorEmail || "");
  const data = payload.data || {};
  const merged = Object.assign({}, existing, data);
  let nextStatus = String(merged.status || existing.status || "").trim();
  if (action === "approve" || action === "return") {
    const memberships = listGroupMembershipsCached_();
    const financeRoles = listFinanceRolesCached_();
    const applicantRole = resolveApplicantGroupRoleByMemberships_(merged, memberships);
    if (!merged.applicantRole && applicantRole) {
      merged.applicantRole = applicantRole;
    }
    if (!canFinanceActorApprove_(merged, actorRole, actorId, actorEmail, memberships, financeRoles)) {
      throw new Error("Unauthorized");
    }
  }
  if (action === "submit") {
    const memberships = listGroupMembershipsCached_();
    const applicantRole = resolveApplicantGroupRoleByMemberships_(merged, memberships);
    if (!merged.applicantRole && applicantRole) {
      merged.applicantRole = applicantRole;
    }
    nextStatus = resolveFinanceInitialStatus_(merged, memberships);
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

function markFundPaymentAccounted_(paymentId, accountedAt, actorId) {
  const targetId = String(paymentId || "").trim();
  if (!targetId) {
    throw new Error("Missing payment id");
  }
  const value = String(accountedAt || "").trim();
  const payload = {
    id: targetId,
    accountedAt: value,
    actorId: String(actorId || "").trim(),
  };
  return updateFundPayment_(targetId, payload);
}

function batchMarkFundPaymentsAccounted_(eventId, accountedAt, actorId) {
  const targetEventId = String(eventId || "").trim();
  if (!targetEventId) {
    throw new Error("Missing event id");
  }
  const dateValue = String(accountedAt || "").trim();
  if (!dateValue) {
    throw new Error("Missing accountedAt");
  }
  const actor = String(actorId || "").trim();

  const sheet = getSheet_(SHEETS.fundPayments);
  const headers = getHeaders_(sheet);
  const headerMap = getHeaderMap_(sheet);
  const idIndex = headerMap.id;
  const eventIndex = headerMap.eventId;
  const accountedIndex = headerMap.accountedAt;
  const updatedAtIndex = headerMap.updatedAt;
  const updatedByIndex = headerMap.updatedById;

  if (idIndex === undefined || eventIndex === undefined || accountedIndex === undefined) {
    throw new Error("FundPayments sheet missing required columns");
  }

  const rows = getDataRows_(sheet);
  var updated = 0;
  var skipped = 0;
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[eventIndex] || "").trim() !== targetEventId) {
      continue;
    }
    const existingAccounted = String(row[accountedIndex] || "").trim();
    if (existingAccounted) {
      skipped += 1;
      continue;
    }
    row[accountedIndex] = dateValue;
    if (updatedAtIndex !== undefined) {
      row[updatedAtIndex] = new Date().toISOString();
    }
    if (updatedByIndex !== undefined && actor) {
      row[updatedByIndex] = actor;
    }
    updated += 1;
  }

  if (updated > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return { updated: updated, skipped: skipped };
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
  const payments = listFundPaymentsCached_();
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

function normalizeLineBindingRecord_(data) {
  const metadata = data && Object.prototype.hasOwnProperty.call(data, "metadata") ? data.metadata : "";
  return {
    id: String((data && data.id) || "").trim(),
    lineUserId: String((data && data.lineUserId) || "").trim(),
    studentId: String((data && data.studentId) || "").trim(),
    status: String((data && data.status) || "active").trim().toLowerCase(),
    role: String((data && data.role) || "").trim(),
    groupId: String((data && data.groupId) || "").trim(),
    displayName: String((data && data.displayName) || "").trim(),
    pictureUrl: String((data && data.pictureUrl) || "").trim(),
    source: String((data && data.source) || "line").trim(),
    boundAt: String((data && data.boundAt) || "").trim(),
    createdAt: String((data && data.createdAt) || "").trim(),
    updatedAt: String((data && data.updatedAt) || "").trim(),
    boundByType: String((data && data.boundByType) || "").trim(),
    boundByStudentId: String((data && data.boundByStudentId) || "").trim(),
    note: String((data && data.note) || "").trim(),
    metadata:
      typeof metadata === "string"
        ? metadata
        : metadata === null || metadata === undefined
        ? ""
        : jsonStringifySafe_(metadata, 4000),
  };
}

function normalizeAgentAuditRecord_(data) {
  return {
    id: String((data && data.id) || "").trim(),
    action: String((data && data.action) || "").trim(),
    channel: String((data && data.channel) || "").trim(),
    lineUserId: String((data && data.lineUserId) || "").trim(),
    studentId: String((data && data.studentId) || "").trim(),
    requestId: String((data && data.requestId) || "").trim(),
    eventId: String((data && data.eventId) || "").trim(),
    status: String((data && data.status) || "").trim(),
    error: String((data && data.error) || "").trim(),
    payload: String((data && data.payload) || "").trim(),
    result: String((data && data.result) || "").trim(),
    createdAt: String((data && data.createdAt) || "").trim(),
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

function normalizeAnnouncementRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    type: String(data.type || "announcement").trim().toLowerCase(),
    scope: String(data.scope || "all").trim().toLowerCase(),
    targetKey: String(data.targetKey || "all").trim(),
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    level: String(data.level || "info").trim().toLowerCase(),
    ctaLabel: String(data.ctaLabel || "").trim(),
    ctaUrl: String(data.ctaUrl || "").trim(),
    status: String(data.status || "active").trim().toLowerCase(),
    startAt: String(data.startAt || "").trim(),
    endAt: String(data.endAt || "").trim(),
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
  };
}

function normalizeNotificationReadRecord_(data) {
  return {
    id: String(data.id || "").trim(),
    notificationId: String(data.notificationId || "").trim(),
    readerStudentId: String(data.readerStudentId || "").trim(),
    readerEmail: normalizeEmail_(data.readerEmail),
    readAt: String(data.readAt || "").trim(),
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
    jerseySize: normalizeSoftballJerseySize_(data.jerseySize || ""),
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

function normalizeGroupId_(value) {
  var raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }
  var match = raw.match(/[A-Z0-9]+/);
  return match ? match[0] : raw;
}

function resolvePersonIdByEmail_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) {
    return "";
  }
  var directory = findDirectoryByEmail_(normalized);
  return directory && directory.id ? String(directory.id || "").trim() : "";
}

function resolveApplicantGroupRoleByMemberships_(record, memberships) {
  var applicantId = String(record.applicantId || "").trim();
  if (!applicantId) {
    applicantId = resolvePersonIdByEmail_(record.applicantEmail || "");
  }
  if (!applicantId) {
    return "";
  }
  var groupId = normalizeGroupId_(record.applicantDepartment || "");
  for (var i = 0; i < memberships.length; i += 1) {
    var item = memberships[i];
    if (String(item.personId || "").trim() !== applicantId) {
      continue;
    }
    if (groupId && normalizeGroupId_(item.groupId || "") !== groupId) {
      continue;
    }
    return String(item.roleInGroup || "").trim().toLowerCase();
  }
  return "";
}

function resolveFinanceInitialStatus_(record, memberships) {
  var applicantRole = String(record.applicantRole || "").trim().toLowerCase();
  if (!applicantRole) {
    applicantRole = resolveApplicantGroupRoleByMemberships_(record, memberships);
  }
  if (applicantRole === "lead") {
    return "pending_rep";
  }
  return "pending_lead";
}

function isSameApplicant_(record, actorId, actorEmail) {
  var applicantId = String(record.applicantId || "").trim();
  var applicantEmail = normalizeEmail_(record.applicantEmail || "");
  if (actorId && applicantId && actorId === applicantId) {
    return true;
  }
  if (actorEmail && applicantEmail && normalizeEmail_(actorEmail) === applicantEmail) {
    return true;
  }
  return false;
}

function actorHasGroupRole_(memberships, actorId, groupId, roleList) {
  var normalizedGroup = normalizeGroupId_(groupId || "");
  var roleSet = (roleList || []).reduce(function (acc, item) {
    acc[String(item || "").trim().toLowerCase()] = true;
    return acc;
  }, {});
  for (var i = 0; i < memberships.length; i += 1) {
    var item = memberships[i];
    if (String(item.personId || "").trim() !== actorId) {
      continue;
    }
    if (normalizedGroup && normalizeGroupId_(item.groupId || "") !== normalizedGroup) {
      continue;
    }
    var roleInGroup = String(item.roleInGroup || "").trim().toLowerCase();
    if (roleSet[roleInGroup] === true) {
      return true;
    }
  }
  return false;
}

function actorHasFinanceRole_(roles, actorId, actorEmail, targetRole) {
  var target = String(targetRole || "").trim().toLowerCase();
  var normalizedEmail = normalizeEmail_(actorEmail || "");
  return (roles || []).some(function (item) {
    var role = String(item.role || "").trim().toLowerCase();
    if (role !== target) {
      return false;
    }
    var personId = String(item.personId || "").trim();
    var personEmail = normalizeEmail_(item.personEmail || "");
    if (actorId && personId && actorId === personId) {
      return true;
    }
    if (normalizedEmail && personEmail && normalizedEmail === personEmail) {
      return true;
    }
    return false;
  });
}

function canFinanceActorApprove_(record, actorRole, actorId, actorEmail, memberships, financeRoles) {
  var status = String(record.status || "").trim().toLowerCase();
  var role = String(actorRole || "").trim().toLowerCase();
  if (!status || status.indexOf("pending_") !== 0) {
    return false;
  }
  if (!actorId) {
    actorId = resolvePersonIdByEmail_(actorEmail || "");
  }
  if (isSameApplicant_(record, actorId, actorEmail)) {
    return false;
  }
  if (status === "pending_lead") {
    if (role !== "lead") {
      return false;
    }
    var applicantRole = String(record.applicantRole || "").trim().toLowerCase();
    if (!applicantRole) {
      applicantRole = resolveApplicantGroupRoleByMemberships_(record, memberships);
    }
    var groupId = String(record.applicantDepartment || "").trim();
    if (applicantRole === "deputy") {
      return actorHasGroupRole_(memberships, actorId, groupId, ["lead"]);
    }
    return actorHasGroupRole_(memberships, actorId, groupId, ["lead", "deputy"]);
  }
  if (status === "pending_rep") {
    if (role !== "rep") {
      return false;
    }
    return actorHasGroupRole_(memberships, actorId, "A", ["lead", "deputy"]);
  }
  if (status === "pending_committee") {
    if (role !== "committee") {
      return false;
    }
    return actorHasGroupRole_(memberships, actorId, "", ["lead", "deputy"]);
  }
  if (status === "pending_accounting") {
    if (role !== "accounting") {
      return false;
    }
    return actorHasFinanceRole_(financeRoles, actorId, actorEmail, "accounting");
  }
  if (status === "pending_cashier") {
    if (role !== "cashier") {
      return false;
    }
    return actorHasFinanceRole_(financeRoles, actorId, actorEmail, "cashier");
  }
  return false;
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

function filterOutApplicantEmail_(emails, request) {
  var applicantEmail = normalizeEmail_(request && request.applicantEmail);
  if (!applicantEmail) {
    return emails || [];
  }
  return (emails || []).filter(function (email) {
    return normalizeEmail_(email || "") !== applicantEmail;
  });
}

function resolveFinanceApprovalRecipients_(request, status) {
  var targetStatus = String(status || request.status || "").trim().toLowerCase();
  if (!targetStatus) {
    return [];
  }
  var memberships = listGroupMembershipsCached_();
  var financeRoles = listFinanceRolesCached_();
  if (targetStatus === "pending_lead") {
    var groupId = String(request.applicantDepartment || "").trim();
    if (!groupId) {
      return [];
    }
    var applicantRole = String(request.applicantRole || "").trim().toLowerCase();
    var roleList = applicantRole === "deputy" ? ["lead"] : ["lead", "deputy"];
    return filterOutApplicantEmail_(
      collectMembershipEmails_(memberships, [groupId], roleList),
      request
    );
  }
  if (targetStatus === "pending_rep") {
    return filterOutApplicantEmail_(
      collectMembershipEmails_(memberships, ["A"], ["lead", "deputy"]),
      request
    );
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
    return filterOutApplicantEmail_(
      collectMembershipEmails_(memberships, leadGroups, ["lead", "deputy"]),
      request
    );
  }
  if (targetStatus === "pending_accounting") {
    return filterOutApplicantEmail_(collectFinanceRoleEmails_(financeRoles, "accounting"), request);
  }
  if (targetStatus === "pending_cashier") {
    return filterOutApplicantEmail_(collectFinanceRoleEmails_(financeRoles, "cashier"), request);
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

function generateAnnouncementId_() {
  var now = new Date();
  return (
    "ANN-" +
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
  const customFieldsValue =
    typeof data.customFields === "string"
      ? data.customFields
      : data.customFields
      ? JSON.stringify(parseCustomFields_(data.customFields))
      : "";
  return {
    id: String(data.id || "").trim(),
    eventId: String(data.eventId || "").trim(),
    studentId: String(data.studentId || "").trim(),
    userName: String(data.userName || "").trim(),
    userEmail: normalizeEmail_(data.userEmail),
    userPhone: data.userPhone || "",
    classYear: data.classYear || "",
    customFields: customFieldsValue,
    status: String(data.status || "registered").trim(),
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || new Date(),
    manualCreatedBy: normalizeEmail_(data.manualCreatedBy),
    manualCreatedByName: String(data.manualCreatedByName || "").trim(),
    manualCreatedAt: data.manualCreatedAt || "",
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
    mobile: normalizePhoneValue_(data.mobile),
    backupPhone: normalizePhoneValue_(data.backupPhone),
    emergencyContact: String(data.emergencyContact || "").trim(),
    emergencyPhone: normalizePhoneValue_(data.emergencyPhone),
    dietaryRestrictions: String(data.dietaryRestrictions || "").trim(),
    photoUrl: String(data.photoUrl || "").trim(),
    birthdayMonth: normalizeBirthdayPart_(data.birthdayMonth, 1, 12),
    birthdayDay: normalizeBirthdayPart_(data.birthdayDay, 1, 31),
  };
}

function normalizeDirectoryProfileInput_(data) {
  return {
    email: normalizeEmail_(data.email),
    mobile: normalizePhoneValue_(data.phone || data.mobile),
    company: String(data.company || "").trim(),
    title: String(data.title || "").trim(),
    preferredName: String(data.displayName || data.preferredName || "").trim(),
    backupPhone: normalizePhoneValue_(data.backupPhone),
    emergencyContact: String(data.emergencyContact || "").trim(),
    emergencyPhone: normalizePhoneValue_(data.emergencyPhone),
    birthdayMonth: normalizeBirthdayPart_(data.birthdayMonth, 1, 12),
    birthdayDay: normalizeBirthdayPart_(data.birthdayDay, 1, 31),
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

function jsonStringifySafe_(value, maxChars) {
  var raw = "";
  try {
    raw = JSON.stringify(value === undefined ? null : value);
  } catch (error) {
    raw = String(value || "");
  }
  const max = normalizePositiveInt_(maxChars, 6000, 100, 40000);
  if (raw.length <= max) {
    return raw;
  }
  return raw.slice(0, max) + "…";
}

function normalizePositiveInt_(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return fallback;
  }
  if (typeof min === "number" && parsed < min) {
    return min;
  }
  if (typeof max === "number" && parsed > max) {
    return max;
  }
  return parsed;
}

function parseDateMillis_(value) {
  if (!value) {
    return NaN;
  }
  const ms = new Date(value).getTime();
  return isNaN(ms) ? NaN : ms;
}

function isLineBindingActive_(binding) {
  const status = String((binding && binding.status) || "").trim().toLowerCase();
  if (!status) {
    return true;
  }
  return status === "active" || status === "bound" || status === "enabled";
}

function lineActorHasGroupAccess_(actor, groupIds) {
  const target = (groupIds || []).reduce(function (acc, value) {
    const id = normalizeGroupId_(value || "");
    if (id) {
      acc[id] = true;
    }
    return acc;
  }, {});
  const memberships = (actor && Array.isArray(actor.memberships) ? actor.memberships : []).slice();
  for (var i = 0; i < memberships.length; i += 1) {
    const item = memberships[i] || {};
    const groupId = normalizeGroupId_(item.groupId || "");
    if (groupId && target[groupId] === true) {
      return true;
    }
  }
  return false;
}

function buildLineActor_(binding) {
  const normalized = normalizeLineBindingRecord_(binding || {});
  const studentId = String(normalized.studentId || "").trim();
  const student = studentId ? findStudentById_(studentId) : null;
  const directory = studentId ? findDirectoryById_(studentId) : null;
  const memberships = studentId ? listMembershipsByStudentId_(studentId) : [];
  const email = normalizeEmail_((directory && directory.email) || (student && student.googleEmail) || "");
  const name = String(
    (directory && (directory.preferredName || directory.nameZh || directory.nameEn)) ||
      (student && student.name) ||
      normalized.displayName ||
      ""
  ).trim();
  return {
    lineUserId: normalized.lineUserId,
    studentId: studentId,
    email: email,
    name: name,
    phone: normalizePhoneValue_(directory && directory.mobile),
    memberships: memberships,
    role: normalized.role,
    groupId: normalized.groupId,
    binding: normalized,
    isActive: isLineBindingActive_(normalized),
  };
}

function resolveLineActorPayload_(payload) {
  const data = (payload && payload.data) || {};
  const lineUserId = String(
    (payload && (payload.lineUserId || payload.actorLineUserId || payload.userId || payload.fromUserId)) ||
      data.lineUserId ||
      data.actorLineUserId ||
      ""
  ).trim();
  if (!lineUserId) {
    return { ok: false, data: null, error: "Missing lineUserId" };
  }
  const binding = findLineBindingByLineUserId_(lineUserId);
  if (!binding) {
    return { ok: false, data: null, error: "LINE user is not bound" };
  }
  if (!isLineBindingActive_(binding)) {
    return { ok: false, data: null, error: "LINE binding is inactive" };
  }
  const actor = buildLineActor_(binding);
  if (!actor || !actor.studentId) {
    return { ok: false, data: null, error: "Bound student not found" };
  }
  return { ok: true, data: actor, error: null };
}

function upsertLineBinding_(data) {
  const lineUserId = String((data && data.lineUserId) || "").trim();
  const studentId = String((data && data.studentId) || "").trim();
  if (!lineUserId || !studentId) {
    throw new Error("Missing lineUserId or studentId");
  }
  const sheet = getSheet_(SHEETS.lineBindings);
  const headerMap = getHeaderMap_(sheet);
  const lineUserIdIndex = headerMap.lineUserId;
  if (lineUserIdIndex === undefined) {
    throw new Error("LineBindings sheet missing lineUserId column");
  }
  const rows = getDataRows_(sheet);
  const nowIso = new Date().toISOString();
  const headers = getHeaders_(sheet);

  var targetRow = -1;
  var existing = null;
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i][lineUserIdIndex] || "").trim() === lineUserId) {
      targetRow = i;
      existing = mapRowToObject_(headerMap, rows[i]);
      break;
    }
  }

  const merged = Object.assign({}, existing || {}, data || {}, {
    id: String(((existing && existing.id) || (data && data.id) || Utilities.getUuid()) || "").trim(),
    lineUserId: lineUserId,
    studentId: studentId,
    status: String((data && data.status) || (existing && existing.status) || "active").trim(),
    source: String((data && data.source) || (existing && existing.source) || "line").trim(),
    boundAt: String((existing && existing.boundAt) || (data && data.boundAt) || nowIso).trim(),
    createdAt: String((existing && existing.createdAt) || (data && data.createdAt) || nowIso).trim(),
    updatedAt: nowIso,
  });

  const record = normalizeLineBindingRecord_(merged);
  const values = new Array(headers.length).fill("");
  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(record, header)) {
      values[index] = record[header];
      return;
    }
    if (Object.prototype.hasOwnProperty.call(merged, header)) {
      values[index] = merged[header];
    }
  });

  if (targetRow >= 0) {
    sheet.getRange(targetRow + 2, 1, 1, headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
  return record;
}

function appendAgentAudit_(data) {
  try {
    const sheet = getSheet_(SHEETS.agentAudit);
    const headers = getHeaders_(sheet);
    const payloadString =
      typeof data.payload === "string" ? data.payload : jsonStringifySafe_(data.payload, 8000);
    const resultString = typeof data.result === "string" ? data.result : jsonStringifySafe_(data.result, 8000);
    const record = normalizeAgentAuditRecord_(
      Object.assign({}, data || {}, {
        id: String((data && data.id) || Utilities.getUuid() || "").trim(),
        payload: payloadString,
        result: resultString,
        createdAt: String((data && data.createdAt) || new Date().toISOString()).trim(),
      })
    );
    const values = new Array(headers.length).fill("");
    headers.forEach(function (header, index) {
      if (Object.prototype.hasOwnProperty.call(record, header)) {
        values[index] = record[header];
      }
    });
    sheet.appendRow(values);
    return record;
  } catch (error) {
    return null;
  }
}

function normalizeLineApprovalAction_(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  if (
    raw === "approve" ||
    raw === "approved" ||
    raw === "ok" ||
    raw === "pass" ||
    raw === "同意" ||
    raw === "核准"
  ) {
    return "approve";
  }
  if (
    raw === "return" ||
    raw === "reject" ||
    raw === "rejected" ||
    raw === "deny" ||
    raw === "退回" ||
    raw === "駁回"
  ) {
    return "return";
  }
  return "";
}

function resolveFinanceActorRoleForStatus_(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending_lead") {
    return "lead";
  }
  if (normalized === "pending_rep") {
    return "rep";
  }
  if (normalized === "pending_committee") {
    return "committee";
  }
  if (normalized === "pending_accounting") {
    return "accounting";
  }
  if (normalized === "pending_cashier") {
    return "cashier";
  }
  return "";
}

function buildLineUpcomingPayload_(actor, days, limit) {
  const windowDays = normalizePositiveInt_(days, 14, 1, 60);
  const itemLimit = normalizePositiveInt_(limit, 10, 1, 50);
  const nowMs = Date.now();
  const startMs = nowMs - 24 * 60 * 60 * 1000;
  const endMs = nowMs + windowDays * 24 * 60 * 60 * 1000;
  const email = normalizeEmail_((actor && actor.email) || "");
  const studentId = String((actor && actor.studentId) || "").trim();

  const registrationByEventId = {};
  if (email) {
    listRegistrationsCached_().forEach(function (item) {
      const status = String(item.status || "").trim().toLowerCase();
      if (status === "cancelled") {
        return;
      }
      if (normalizeEmail_(item.userEmail) !== email) {
        return;
      }
      const eventId = String(item.eventId || "").trim();
      if (eventId && !registrationByEventId[eventId]) {
        registrationByEventId[eventId] = item;
      }
    });
  }

  const upcomingEvents = listEventsCached_()
    .map(function (event) {
      const eventId = String(event.id || "").trim();
      if (!eventId) {
        return null;
      }
      const startAtRaw = String(event.startAt || event.registrationCloseAt || event.endAt || "").trim();
      const eventMs = parseDateMillis_(startAtRaw);
      if (!isNaN(eventMs) && (eventMs < startMs || eventMs > endMs)) {
        return null;
      }
      const registration = registrationByEventId[eventId] || null;
      const checkin = registration ? findCheckinByRegistration_(eventId, registration.id) : null;
      const canRegister =
        !registration &&
        String(event.status || "").trim().toLowerCase() === "open" &&
        isWithinWindow_(event.registrationOpenAt, event.registrationCloseAt);
      return {
        id: eventId,
        title: String(event.title || "").trim(),
        startAt: String(event.startAt || "").trim(),
        endAt: String(event.endAt || "").trim(),
        location: String(event.location || "").trim(),
        status: String(event.status || "").trim(),
        registrationStatus: registration
          ? String(registration.status || "registered").trim().toLowerCase()
          : "none",
        checkinStatus: checkin ? "checked_in" : "not_checked_in",
        canRegister: canRegister,
      };
    })
    .filter(function (item) {
      return item !== null;
    })
    .sort(function (a, b) {
      return String(a.startAt || "").localeCompare(String(b.startAt || ""));
    });

  const financeList = listFinanceRequestsCached_();
  const memberships = listGroupMembershipsCached_();
  const financeRoles = listFinanceRolesCached_();
  const pendingApprovals = financeList
    .filter(function (item) {
      const status = String(item.status || "").trim().toLowerCase();
      if (!status || status.indexOf("pending_") !== 0) {
        return false;
      }
      const actorRole = resolveFinanceActorRoleForStatus_(status);
      if (!actorRole) {
        return false;
      }
      return canFinanceActorApprove_(item, actorRole, studentId, email, memberships, financeRoles);
    })
    .sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    })
    .slice(0, itemLimit)
    .map(function (item) {
      return {
        id: String(item.id || "").trim(),
        title: String(item.title || "").trim(),
        type: String(item.type || "").trim(),
        status: String(item.status || "").trim(),
        amountEstimated: String(item.amountEstimated || "").trim(),
        amountActual: String(item.amountActual || "").trim(),
        applicantName: String(item.applicantName || "").trim(),
        applicantDepartment: String(item.applicantDepartment || "").trim(),
        updatedAt: String(item.updatedAt || item.createdAt || "").trim(),
      };
    });

  const myFinance = email
    ? listFinanceRequests_({ applicantEmail: email })
        .slice(0, itemLimit)
        .map(function (item) {
          return {
            id: String(item.id || "").trim(),
            title: String(item.title || "").trim(),
            type: String(item.type || "").trim(),
            status: String(item.status || "").trim(),
            amountEstimated: String(item.amountEstimated || "").trim(),
            amountActual: String(item.amountActual || "").trim(),
            updatedAt: String(item.updatedAt || item.createdAt || "").trim(),
          };
        })
    : [];

  const responseByOrderId = {};
  if (studentId) {
    listOrderResponsesByStudent_(studentId).forEach(function (item) {
      const orderId = String(item.orderId || "").trim();
      if (orderId && !responseByOrderId[orderId]) {
        responseByOrderId[orderId] = item;
      }
    });
  }

  const pendingOrders = listOrderPlansCached_()
    .filter(function (plan) {
      const planId = String(plan.id || "").trim();
      if (!planId || responseByOrderId[planId]) {
        return false;
      }
      if (isOrderPlanClosed_(plan)) {
        return false;
      }
      const cutoffMs = parseDateMillis_(plan.cutoffAt || plan.date || "");
      if (isNaN(cutoffMs)) {
        return true;
      }
      return cutoffMs >= startMs && cutoffMs <= endMs;
    })
    .sort(function (a, b) {
      return String(a.cutoffAt || a.date || "").localeCompare(String(b.cutoffAt || b.date || ""));
    })
    .slice(0, itemLimit)
    .map(function (plan) {
      return {
        id: String(plan.id || "").trim(),
        title: String(plan.title || "").trim(),
        date: String(plan.date || "").trim(),
        cutoffAt: String(plan.cutoffAt || "").trim(),
        status: String(plan.status || "").trim(),
      };
    });

  const attendanceByPracticeId = {};
  if (studentId) {
    listSoftballAttendance_("", studentId).forEach(function (item) {
      const practiceId = String(item.practiceId || "").trim();
      if (practiceId && !attendanceByPracticeId[practiceId]) {
        attendanceByPracticeId[practiceId] = item;
      }
    });
  }

  const upcomingPractices = listSoftballPracticesCached_()
    .filter(function (practice) {
      const practiceId = String(practice.id || "").trim();
      if (!practiceId) {
        return false;
      }
      const whenMs = parseDateMillis_(practice.startAt || practice.date || "");
      if (isNaN(whenMs)) {
        return false;
      }
      return whenMs >= startMs && whenMs <= endMs;
    })
    .sort(function (a, b) {
      const aKey = String(a.startAt || a.date || "");
      const bKey = String(b.startAt || b.date || "");
      return aKey.localeCompare(bKey);
    })
    .slice(0, itemLimit)
    .map(function (practice) {
      const practiceId = String(practice.id || "").trim();
      const attendance = attendanceByPracticeId[practiceId] || null;
      return {
        id: practiceId,
        title: String(practice.title || "").trim(),
        date: String(practice.date || "").trim(),
        startAt: String(practice.startAt || "").trim(),
        endAt: String(practice.endAt || "").trim(),
        status: String(practice.status || "").trim(),
        attendanceStatus: attendance ? String(attendance.status || "unknown").trim() : "unknown",
      };
    });

  return {
    actor: {
      lineUserId: String((actor && actor.lineUserId) || "").trim(),
      studentId: studentId,
      email: email,
      name: String((actor && actor.name) || "").trim(),
    },
    windowDays: windowDays,
    generatedAt: new Date().toISOString(),
    events: {
      registered: upcomingEvents
        .filter(function (item) {
          return item.registrationStatus !== "none";
        })
        .slice(0, itemLimit),
      openForRegistration: upcomingEvents
        .filter(function (item) {
          return item.canRegister;
        })
        .slice(0, itemLimit),
    },
    approvals: {
      pending: pendingApprovals,
    },
    finance: {
      mine: myFinance,
    },
    orders: {
      pending: pendingOrders,
    },
    softball: {
      upcoming: upcomingPractices,
    },
  };
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

function normalizeGoogleSessionToken_(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  return String(payload.sessionToken || payload.googleSessionToken || "").trim();
}

function buildGoogleSessionCacheKey_(sessionToken) {
  return GOOGLE_SESSION_CACHE_PREFIX + String(sessionToken || "").trim();
}

function writeGoogleSession_(sessionToken, profile, studentId) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) {
    return "";
  }
  const token = String(sessionToken || "").trim() || Utilities.getUuid();
  if (!token) {
    return "";
  }
  const payload = {
    studentId: normalizedStudentId,
    sub: String((profile && profile.sub) || "").trim(),
    email: normalizeEmail_((profile && profile.email) || ""),
    name: String((profile && profile.name) || "").trim(),
    issuedAt: Date.now(),
  };
  const cache = CacheService.getScriptCache();
  cache.put(buildGoogleSessionCacheKey_(token), JSON.stringify(payload), GOOGLE_SESSION_TTL_SECONDS);
  return token;
}

function readGoogleSession_(sessionToken) {
  const normalizedToken = String(sessionToken || "").trim();
  if (!normalizedToken) {
    return null;
  }
  const cache = CacheService.getScriptCache();
  const raw = cache.get(buildGoogleSessionCacheKey_(normalizedToken));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !String(parsed.studentId || "").trim()) {
      return null;
    }
    return {
      studentId: String(parsed.studentId || "").trim(),
      sub: String(parsed.sub || "").trim(),
      email: normalizeEmail_(parsed.email || ""),
      name: String(parsed.name || "").trim(),
      issuedAt: Number(parsed.issuedAt || 0),
    };
  } catch (error) {
    return null;
  }
}

function listMembershipsByStudentId_(studentId) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return [];
  }
  return listGroupMembershipsCached_().filter(function (item) {
    return String(item.personId || "").trim() === targetId;
  });
}

function requireSyncPullAccess_(payload) {
  const providedToken = String(
    payload.syncToken || payload.syncPullToken || payload.internalToken || ""
  ).trim();
  if (!providedToken) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  const expectedToken = String(
    PropertiesService.getScriptProperties().getProperty("SYNC_PULL_TOKEN") || ""
  ).trim();
  if (!expectedToken || providedToken !== expectedToken) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  return { ok: true, data: null, error: null };
}

function requireGoogleIdentity_(payload) {
  const providedSessionToken = normalizeGoogleSessionToken_(payload);
  if (providedSessionToken) {
    const session = readGoogleSession_(providedSessionToken);
    if (session && session.studentId) {
      return {
        ok: true,
        data: {
          studentId: session.studentId,
          sessionToken: providedSessionToken,
          profile: {
            sub: session.sub,
            email: session.email,
            name: session.name,
            picture: "",
          },
        },
        error: null,
      };
    }
  }

  const idToken = String(payload.idToken || "").trim();
  if (!idToken) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  try {
    const profile = verifyGoogleIdTokenCached_(idToken);
    const student = findStudentByGoogleSub_(profile.sub);
    if (!student || !String(student.id || "").trim()) {
      return { ok: false, data: null, error: "Unauthorized" };
    }
    const studentId = String(student.id || "").trim();
    const sessionToken = writeGoogleSession_(providedSessionToken, profile, studentId);
    return {
      ok: true,
      data: {
        studentId: studentId,
        sessionToken: sessionToken,
        profile: profile,
      },
      error: null,
    };
  } catch (error) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
}

function requireGoogleGroupAccess_(payload, allowedGroupIds) {
  const auth = requireGoogleIdentity_(payload);
  if (!auth.ok) {
    return auth;
  }
  const studentId = String((auth.data && auth.data.studentId) || "").trim();
  if (!studentId || !hasGroupAccessForStudent_(studentId, allowedGroupIds)) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  return auth;
}

function getAdminActorInfo_(payload) {
  const auth = requireGoogleIdentity_(payload || {});
  if (!auth.ok) {
    return { email: "", name: "", studentId: "" };
  }
  const studentId = String((auth.data && auth.data.studentId) || "").trim();
  const profile = (auth.data && auth.data.profile) || {};
  const student = studentId ? findStudentById_(studentId) : null;
  return {
    email: normalizeEmail_((profile && profile.email) || ""),
    name: String((student && student.name) || profile.name || "").trim(),
    studentId: studentId,
  };
}

function requireDirectoryLeadAccess_(payload) {
  const auth = requireGoogleIdentity_(payload || {});
  if (!auth.ok) {
    return auth;
  }
  const studentId = String((auth.data && auth.data.studentId) || "").trim();
  if (!studentId || !hasDirectoryLeadAccess_(studentId)) {
    return { ok: false, data: null, error: "Unauthorized" };
  }
  return auth;
}

function requireDirectoryOrAdminAccess_(payload) {
  const strictAccess = requireDirectoryLeadAccess_(payload);
  if (strictAccess && strictAccess.ok) {
    return strictAccess;
  }
  const adminAccess = requireGoogleGroupAccess_(payload, ["E"]);
  if (adminAccess && adminAccess.ok) {
    return adminAccess;
  }
  return { ok: false, data: null, error: "Unauthorized" };
}

function hasDirectoryLeadAccess_(studentId) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return false;
  }
  const normalizeRole_ = function (value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) {
      return "";
    }
    if (raw === "lead" || raw === "組長") {
      return "lead";
    }
    if (raw === "deputy" || raw === "副組長" || raw === "副班代") {
      return "deputy";
    }
    if (raw === "member" || raw === "成員") {
      return "member";
    }
    return raw;
  };
  const memberships = listGroupMembershipsCached_();
  for (var i = 0; i < memberships.length; i++) {
    const item = memberships[i] || {};
    if (String(item.personId || "").trim() !== targetId) {
      continue;
    }
    const roleInGroup = normalizeRole_(item.roleInGroup || "");
    if (roleInGroup !== "lead") {
      continue;
    }
    const groupId = normalizeGroupId_(item.groupId || "");
    if (groupId === "A" || groupId === "E") {
      return true;
    }
  }
  return false;
}

function hasGroupAccessForStudent_(studentId, allowedGroupIds) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return false;
  }
  const memberships = listGroupMembershipsCached_();
  const allowed = Array.isArray(allowedGroupIds) ? allowedGroupIds : [];
  for (var i = 0; i < memberships.length; i++) {
    const membership = memberships[i] || {};
    const personId = String(membership.personId || "").trim();
    if (!personId || personId !== targetId) {
      continue;
    }
    const groupId = String(membership.groupId || "").trim();
    const roleInGroup = String(membership.roleInGroup || "").trim();
    if (groupId === "A" && (roleInGroup === "lead" || roleInGroup === "deputy")) {
      return true;
    }
    if (allowed.indexOf(groupId) !== -1) {
      return true;
    }
  }
  return false;
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

function appendRegistration_(eventId, data, email, options) {
  const sheet = getSheet_(SHEETS.registrations);
  const headers = getHeaders_(sheet);
  const opts = options || {};
  const now = new Date();
  const customFields = parseCustomFields_(data.customFields);
  const manualMeta =
    String(opts.source || "").trim() === "admin_manual"
      ? {
          source: "admin_manual",
          actorEmail: normalizeEmail_(opts.actorEmail),
          actorName: String(opts.actorName || "").trim(),
          actorStudentId: String(opts.actorStudentId || "").trim(),
          at: now.toISOString(),
        }
      : null;
  if (manualMeta) {
    customFields._manualRegistration = manualMeta;
  }
  const studentId = String(data.studentId || customFields.studentId || "").trim();
  if (studentId && !customFields.studentId) {
    customFields.studentId = studentId;
  }
  const preferredId = String(data.id || "").trim();
  const preferredCreatedAt = String(data.createdAt || "").trim();
  const preferredUpdatedAt = String(data.updatedAt || preferredCreatedAt || "").trim();
  const createdAtValue = preferredCreatedAt ? new Date(preferredCreatedAt) : now;
  const updatedAtValue = preferredUpdatedAt ? new Date(preferredUpdatedAt) : now;
  const values = new Array(headers.length).fill("");
  const record = {
    id: preferredId || Utilities.getUuid(),
    eventId: eventId,
    studentId: studentId,
    userName: data.userName || data.name || "",
    userEmail: email,
    userPhone: data.userPhone || data.phone || "",
    classYear: data.classYear || "",
    customFields: JSON.stringify(customFields),
    status: "registered",
    createdAt: createdAtValue,
    updatedAt: updatedAtValue,
    manualCreatedBy: manualMeta ? manualMeta.actorEmail : "",
    manualCreatedByName: manualMeta ? manualMeta.actorName : "",
    manualCreatedAt: manualMeta ? now : "",
  };

  headers.forEach(function (header, index) {
    if (record.hasOwnProperty(header)) {
      values[index] = record[header];
    }
  });

  sheet.appendRow(values);
  return record.id;
}

function appendCheckin_(eventId, registrationId, data) {
  const input = data || {};
  const sheet = getSheet_(SHEETS.checkins);
  const headers = getHeaders_(sheet);
  const now = new Date();
  const preferredId = String(input.checkinId || input.id || "").trim();
  const preferredCheckinAt = String(input.checkinAt || "").trim();
  const checkinAtValue = preferredCheckinAt ? new Date(preferredCheckinAt) : now;
  const record = {
    id: preferredId || Utilities.getUuid(),
    eventId: eventId,
    registrationId: registrationId,
    checkinAt: checkinAtValue,
    checkinMethod: String(input.checkinMethod || "link").trim() || "link",
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
  const normalizedEventId = String(eventId || "").trim();
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEventId || !normalizedEmail) {
    return null;
  }
  const index = getRegistrationsIndex_();
  const key = normalizedEventId + "::" + normalizedEmail;
  return index.byEventEmail[key] || null;
}

function findRegistrationById_(registrationId) {
  const target = String(registrationId || "").trim();
  if (!target) {
    return null;
  }
  const index = getRegistrationsIndex_();
  return index.byId[target] || null;
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
  const normalizedEventId = String(eventId || "").trim();
  const normalizedRegistrationId = String(registrationId || "").trim();
  if (!normalizedEventId || !normalizedRegistrationId) {
    return null;
  }
  const index = getCheckinsIndex_();
  const key = normalizedEventId + "::" + normalizedRegistrationId;
  return index.byEventRegistration[key] || null;
}

function findCheckinById_(checkinId) {
  const target = String(checkinId || "").trim();
  if (!target) {
    return null;
  }
  const index = getCheckinsIndex_();
  return index.byId[target] || null;
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
    photoUrl: String((directory && directory.photoUrl) || "").trim(),
    dietaryPreference: String((directory && directory.dietaryRestrictions) || "").trim(),
    group: String((directory && directory.group) || "").trim(),
  };
}

function buildDirectoryProfile_(student, directory, fallbackEmail) {
  return {
    id: String((student && student.id) || (directory && directory.id) || "").trim(),
    email: normalizeEmail_((directory && directory.email) || fallbackEmail),
    nameZh: String((directory && directory.nameZh) || "").trim(),
    nameEn: String((directory && directory.nameEn) || "").trim(),
    displayName: String((directory && directory.preferredName) || "").trim(),
    company: String((directory && directory.company) || "").trim(),
    title: String((directory && directory.title) || "").trim(),
    phone: normalizePhoneValue_(directory && directory.mobile),
    backupPhone: normalizePhoneValue_(directory && directory.backupPhone),
    emergencyContact: String((directory && directory.emergencyContact) || "").trim(),
    emergencyPhone: normalizePhoneValue_(directory && directory.emergencyPhone),
    photoUrl: String((directory && directory.photoUrl) || "").trim(),
    birthdayMonth: normalizeBirthdayPart_(directory && directory.birthdayMonth, 1, 12),
    birthdayDay: normalizeBirthdayPart_(directory && directory.birthdayDay, 1, 31),
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

function verifyGoogleIdTokenCached_(idToken) {
  const normalized = String(idToken || "").trim();
  if (!normalized) {
    throw new Error("Invalid Google token");
  }
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalized,
    Utilities.Charset.UTF_8
  );
  const tokenHash = digest
    .map(function (byte) {
      const value = (byte < 0 ? byte + 256 : byte).toString(16);
      return value.length === 1 ? "0" + value : value;
    })
    .join("");
  return getCachedJson_("googleToken:profile:" + tokenHash, 1800, function () {
    return verifyGoogleIdToken_(normalized);
  });
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
