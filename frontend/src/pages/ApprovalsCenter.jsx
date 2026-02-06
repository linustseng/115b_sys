import React, { useEffect, useState } from "react";

function ApprovalsCenter({ shared, embedded = false, requestId = "" }) {
  const {
    apiRequest,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    normalizeGroupId_,
    isFinanceRequestRelevantToRole_,
    parseFinanceAmount_,
    parseFinanceAttachments_,
    formatFinanceAmount_,
    formatDisplayDate_,
    FINANCE_TYPES,
    FINANCE_STATUS_LABELS,
    FINANCE_ROLE_LABELS,
    CLASS_GROUPS,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [requests, setRequests] = useState([]);
  const [actions, setActions] = useState([]);
  const [actionsByActor, setActionsByActor] = useState([]);
  const [actionsSummary, setActionsSummary] = useState({});
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [financeRoles, setFinanceRoles] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [completedView, setCompletedView] = useState("relevant");
  const [actorName, setActorName] = useState("");
  const [actorNote, setActorNote] = useState("");
  const [acting, setActing] = useState(false);
  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    (googleLinkedStudent && googleLinkedStudent.email) ||
    "";

  useEffect(() => {
    if (displayName && !actorName) {
      setActorName(displayName);
    }
  }, [displayName, actorName]);

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email || googleLinkedStudent.id) {
      return;
    }
    let ignore = false;
    const enrichStudent = async () => {
      try {
        const { result } = await apiRequest({
          action: "lookupStudent",
          email: String(googleLinkedStudent.email || "").trim().toLowerCase(),
        });
        if (!result.ok || !result.data || !result.data.student) {
          return;
        }
        if (!ignore) {
          const enriched = result.data.student;
          setGoogleLinkedStudent(enriched);
          storeGoogleStudent_(enriched);
        }
      } catch (error) {
        // Ignore lookup failures; fall back to email matching.
      }
    };
    enrichStudent();
    return () => {
      ignore = true;
    };
  }, [googleLinkedStudent]);

  const loadBootstrap = async () => {
    const { result } = await apiRequest({ action: "listFinanceAdminBootstrap" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    const data = result.data || {};
    setStudents(data.students || []);
    setGroupMemberships(data.groupMemberships || []);
    setFinanceRoles(data.roles || []);
  };

  const loadRequests = async () => {
    const { result } = await apiRequest({ action: "listFinanceRequests" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setRequests(result.data && result.data.requests ? result.data.requests : []);
  };

  const loadActionsByActor = async () => {
    if (!displayName) {
      setActionsByActor([]);
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listFinanceActionsByActor",
        actorNames: [displayName],
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setActionsByActor(result.data && result.data.actions ? result.data.actions : []);
    } catch (err) {
      // Backward-compatible: backend not deployed yet.
      setActionsByActor([]);
    }
  };

  const loadActionsSummary = async (requestIds) => {
    const ids = (requestIds || []).map((id) => String(id || "").trim()).filter(Boolean);
    if (!ids.length) {
      setActionsSummary({});
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listFinanceActionsSummary",
        requestIds: ids,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setActionsSummary(result.data && result.data.summary ? result.data.summary : {});
    } catch (err) {
      setActionsSummary({});
    }
  };

  const loadActions = async (targetId) => {
    if (!targetId) {
      setActions([]);
      return;
    }
    const { result } = await apiRequest({ action: "listFinanceActions", requestId: targetId });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setActions(result.data && result.data.actions ? result.data.actions : []);
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    let ignore = false;
    setLoading(true);
    setError("");
    Promise.all([loadBootstrap(), loadRequests(), loadActionsByActor()])
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "載入失敗");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [googleLinkedStudent]);

  useEffect(() => {
    if (!requestId) {
      setActions([]);
      return;
    }
    loadActions(requestId).catch(() => {});
  }, [requestId]);

  const normalizedEmail = String((googleLinkedStudent && googleLinkedStudent.email) || "")
    .trim()
    .toLowerCase();
  const studentMatch =
    students.find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail) ||
    null;
  const personId = String(
    ((googleLinkedStudent && googleLinkedStudent.id) || (studentMatch && studentMatch.id) || "")
  ).trim();
  const memberships = groupMemberships.filter((item) => {
    if (personId && String(item.personId || "").trim() === personId) {
      return true;
    }
    return false;
  });
  const financeRoleItems = financeRoles.filter((item) => {
    if (personId && String(item.personId || "").trim() === personId) {
      return true;
    }
    return String(item.personEmail || "").trim().toLowerCase() === normalizedEmail;
  });

  const adminLeadGroups = memberships
    .filter((item) => String(item.roleInGroup || "").trim() === "lead")
    .map((item) => normalizeGroupId_(item.groupId))
    .filter(Boolean);
  const adminDeputyGroups = memberships
    .filter((item) => String(item.roleInGroup || "").trim() === "deputy")
    .map((item) => normalizeGroupId_(item.groupId))
    .filter(Boolean);
  const adminRoles = financeRoleItems
    .map((item) => String(item.role || "").trim())
    .filter(Boolean);

  const hasLeadPrivilege = adminLeadGroups.length || adminDeputyGroups.length;
  const hasRepPrivilege = adminLeadGroups.includes("A");
  const hasCommitteePrivilege = hasLeadPrivilege || hasRepPrivilege || adminDeputyGroups.includes("A");
  const hasAccountingPrivilege = adminRoles.includes("accounting");
  const hasCashierPrivilege = adminRoles.includes("cashier");
  const hasAuditorPrivilege = adminRoles.includes("auditor");

  const roleStatusMap = {
    lead: "pending_lead",
    rep: "pending_rep",
    committee: "pending_committee",
    accounting: "pending_accounting",
    cashier: "pending_cashier",
    auditor: "auditor",
  };

  const availableRoles = [
    hasLeadPrivilege ? "lead" : null,
    hasRepPrivilege ? "rep" : null,
    hasCommitteePrivilege ? "committee" : null,
    hasAccountingPrivilege ? "accounting" : null,
    hasCashierPrivilege ? "cashier" : null,
    hasAuditorPrivilege ? "auditor" : null,
  ].filter((value) => value);

  const resolveRequestRole_ = (item) => {
    if (!item) {
      return "";
    }
    for (let i = 0; i < availableRoles.length; i += 1) {
      const role = availableRoles[i];
      if (role === "auditor") {
        continue;
      }
      const targetStatus = roleStatusMap[role];
      if (String(item.status || "").trim() !== targetStatus) {
        continue;
      }
      if (role === "lead") {
        const group = normalizeGroupId_(item.applicantDepartment);
        if (
          !adminLeadGroups.includes(group) &&
          !adminDeputyGroups.includes(group)
        ) {
          continue;
        }
      }
      return role;
    }
    return "";
  };

  const isPendingStatus = (status) => String(status || "").trim().startsWith("pending_");

  const pendingItems = requests
    .map((item) => ({ request: item, role: resolveRequestRole_(item) }))
    .filter((item) => item.role)
    .sort((a, b) => String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || "")));

  const signedByMeIdSet = new Set(
    actionsByActor.map((item) => String(item.requestId || "").trim()).filter(Boolean)
  );
  const pendingIdSet = new Set(pendingItems.map((item) => String(item.request.id || "").trim()));
  const inProgressItems = requests
    .filter((item) => isPendingStatus(item.status))
    .filter((item) => !pendingIdSet.has(String(item.id || "").trim()))
    .filter((item) => {
      const requestId = String(item.id || "").trim();
      const applicantId = String(item.applicantId || "").trim();
      const applicantEmail = String(item.applicantEmail || "").trim().toLowerCase();
      const isMine =
        (personId && applicantId && applicantId === personId) ||
        (normalizedEmail && applicantEmail && applicantEmail === normalizedEmail);
      const signedByMe = requestId && signedByMeIdSet.has(requestId);
      return isMine || signedByMe;
    })
    .map((item) => ({ request: item }))
    .sort((a, b) => String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || "")));

  const showAllCompleted = completedView === "all";
  const completedRequests = requests.filter(
    (item) => String(item.status || "").trim() === "closed"
  );
  const relevantCompletedRequests = completedRequests.filter((item) =>
    availableRoles.some((role) =>
      isFinanceRequestRelevantToRole_(item, role, { adminLeadGroups, adminDeputyGroups })
    )
  );
  const completedItems = (showAllCompleted ? completedRequests : relevantCompletedRequests)
    .map((item) => ({ request: item }))
    .sort((a, b) => String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || "")));

  const returnedItems = requests
    .filter((item) => String(item.status || "").trim() === "returned")
    .filter((item) => {
      const applicantId = String(item.applicantId || "").trim();
      const applicantEmail = String(item.applicantEmail || "").trim().toLowerCase();
      return (
        (personId && applicantId && applicantId === personId) ||
        (normalizedEmail && applicantEmail && applicantEmail === normalizedEmail)
      );
    })
    .map((item) => ({ request: item }))
    .sort((a, b) => String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || "")));

  useEffect(() => {
    const ids = inProgressItems.map((item) => item.request.id);
    loadActionsSummary(ids).catch(() => {});
  }, [requests, googleLinkedStudent]);

  const actionByRequestId = actionsByActor.reduce((acc, item) => {
    const id = String(item.requestId || "").trim();
    if (!id) {
      return acc;
    }
    if (!acc[id]) {
      acc[id] = item;
    }
    return acc;
  }, {});

  const selectedRequest = requestId
    ? requests.find((item) => String(item.id || "").trim() === String(requestId || "").trim())
    : null;
  const selectedRole = selectedRequest ? resolveRequestRole_(selectedRequest) : "";
  const canAct = Boolean(selectedRequest && selectedRole);

  const statusLabel = (status) => FINANCE_STATUS_LABELS[status] || status || "-";

  const resolvedActorName = displayName || actorName || "";

  const handleAction = async (actionType) => {
    if (!selectedRequest || !selectedRequest.id || !selectedRole) {
      return;
    }
    setActing(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "updateFinanceRequest",
        id: selectedRequest.id,
        requestAction: actionType,
        actorRole: selectedRole,
        actorName: resolvedActorName,
        actorNote: actorNote,
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setActorNote("");
      await loadRequests();
      await loadActions(selectedRequest.id);
      await loadActionsByActor();
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setActing(false);
    }
  };

  const renderRequestRow = (item, extra) => {
    const request = item.request || item;
    const amount = request.type === "purchase" ? request.amountEstimated : request.amountActual;
    return (
      <div
        key={request.id}
        className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{request.title || "未命名"}</p>
            <p className="text-xs text-slate-500">
              {FINANCE_TYPES.find((type) => type.value === request.type)?.label || "申請"} ·{" "}
              {formatFinanceAmount_(amount)} ·{" "}
              {FINANCE_STATUS_LABELS[request.status] || request.status || "-"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{formatDisplayDate_(request.createdAt, { withTime: true })}</span>
            {extra ? extra : null}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          目前：{statusLabel(String(request.status || "").trim())}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.href = `/approvals/${request.id}`;
            }}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
          >
            檢視
          </button>
        </div>
      </div>
    );
  };

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className={embedded ? "" : "mt-6"}>
        <GoogleSigninPanel
          title="Google 登入"
          helperText="登入後即可查看待簽與已簽清單。"
          onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
        />
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "mt-6"}>
      <div className={embedded ? "" : "card p-6 sm:p-8"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">簽核中心</h2>
            <p className="mt-1 text-xs text-slate-500">待簽核、簽核中與結案清單。</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            {
              id: "pending",
              label: "待簽核",
              count: pendingItems.length,
              theme: "badge-warning",
              active: "border-amber-500 bg-amber-500 text-white",
            },
            {
              id: "inprogress",
              label: "簽核中",
              count: inProgressItems.length,
              theme: "border-sky-200 bg-sky-50 text-sky-700",
              active: "border-sky-500 bg-sky-500 text-white",
            },
            {
              id: "completed",
              label: "已結案",
              count: completedItems.length,
              theme: "badge-success",
              active: "border-emerald-500 bg-emerald-500 text-white",
            },
            {
              id: "returned",
              label: "已退回",
              count: returnedItems.length,
              theme: "badge-error",
              active: "border-rose-500 bg-rose-500 text-white",
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-2xl border px-4 py-3 text-left ${
                tab === item.id ? item.active : item.theme
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{item.count}</div>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-slate-400">載入中...</p>
        ) : null}
        {error ? (
          <div className="mt-4 alert alert-error text-xs">
            {error}
          </div>
        ) : null}

        {tab === "pending" ? (
          <div className="mt-4 space-y-3">
            {pendingItems.length ? (
              pendingItems.map((item) => renderRequestRow(item))
            ) : (
              <p className="text-sm text-slate-500">目前沒有待簽案件。</p>
            )}
          </div>
        ) : tab === "inprogress" ? (
          <div className="mt-4 space-y-3">
            {inProgressItems.length ? (
              inProgressItems.map((item) => {
                const action = actionsSummary[String(item.request.id || "").trim()] || null;
                return renderRequestRow(item, action ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-600">
                    已簽：{action.actorName || "-"}
                  </span>
                ) : null);
              })
            ) : (
              <p className="text-sm text-slate-500">目前沒有簽核中的案件。</p>
            )}
          </div>
        ) : tab === "completed" ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">顯示範圍</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompletedView("relevant")}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    completedView === "relevant"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  與我相關
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedView("all")}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    completedView === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  全部
                </button>
              </div>
            </div>
            {completedItems.length ? (
              completedItems.map((item) =>
                renderRequestRow(item, (
                  <span className="badge-success text-[11px] font-medium">
                    已結案
                  </span>
                ))
              )
            ) : (
              <p className="text-sm text-slate-500">尚未有已結案的案件。</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {returnedItems.length ? (
              returnedItems.map((item) =>
                renderRequestRow(item, (
                  <span className="badge-error text-[11px] font-medium">
                    已退回
                  </span>
                ))
              )
            ) : (
              <p className="text-sm text-slate-500">尚未有退回的案件。</p>
            )}
          </div>
        )}
      </div>

      {requestId ? (
        <section className="mt-6 card p-6 sm:p-8">
          {selectedRequest ? (
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedRequest.title || "未命名"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedRequest.id} ·{" "}
                  {FINANCE_STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                </p>
              </div>
              <div className="grid gap-2 text-xs text-slate-500">
                <div>
                  申請人：{selectedRequest.applicantName || "-"} ·{" "}
                  {CLASS_GROUPS.find((item) => item.id === selectedRequest.applicantDepartment)?.label ||
                    selectedRequest.applicantDepartment ||
                    "-"}
                </div>
                <div>
                  類型：
                  {FINANCE_TYPES.find((type) => type.value === selectedRequest.type)?.label || "-"}
                </div>
                <div>
                  金額：
                  {formatFinanceAmount_(
                    selectedRequest.type === "purchase"
                      ? selectedRequest.amountEstimated
                      : selectedRequest.amountActual
                  )}
                </div>
                <div>說明：{selectedRequest.description || "-"}</div>
              </div>
              {selectedRequest.attachments ? (
                <div>
                  <p className="text-xs font-semibold text-slate-600">附件</p>
                  <div className="mt-2 space-y-2">
                    {parseFinanceAttachments_(selectedRequest.attachments).map((item, index) => (
                      <a
                        key={`${item.url}-${index}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
                      >
                        {item.name || item.url}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-slate-600">審核人</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
                  {resolvedActorName || "—"}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold text-slate-600">備註</label>
                <textarea
                  value={actorNote}
                  onChange={(event) => setActorNote(event.target.value)}
                  rows="2"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700"
                />
              </div>

              {canAct ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction("approve")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    核准
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction("return")}
                    className="badge-error px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    退回
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">目前無可簽核權限或案件已處理。</p>
              )}

              {actions.length ? (
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">流程紀錄</p>
                  <div className="mt-2 space-y-2">
                    {actions.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {item.action} · {FINANCE_ROLE_LABELS[item.actorRole] || item.actorRole || "-"}{" "}
                          {item.actorName || ""}
                        </span>
                        <span className="text-slate-400">
                          {formatDisplayDate_(item.createdAt, { withTime: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">找不到這筆簽核案件。</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default ApprovalsCenter;
