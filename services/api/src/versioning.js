import crypto from "node:crypto";
import { jsonbParam } from "./jsonb.js";

function nowIso() {
  return new Date().toISOString();
}

function firstText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback || "").trim();
}

function safeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function stableStringify(value) {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function diffObjects(before = {}, after = {}) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((a, b) => a.localeCompare(b, "en"));
  const diff = {};
  const changedFields = [];
  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (stableStringify(beforeValue) === stableStringify(afterValue)) {
      continue;
    }
    changedFields.push(key);
    diff[key] = { before: beforeValue ?? null, after: afterValue ?? null };
  }
  return { changedFields, diff };
}

function defaultSummary(entityType, action, entityId, changedFields = []) {
  const label = firstText(entityType, "entity");
  if (action === "create") {
    return `建立 ${label} ${entityId}`;
  }
  if (action === "delete") {
    return `刪除 ${label} ${entityId}`;
  }
  if (action === "restore") {
    return `回復 ${label} ${entityId}`;
  }
  if (!changedFields.length) {
    return `更新 ${label} ${entityId}`;
  }
  return `更新 ${label} ${entityId}（${changedFields.join(", ")}）`;
}

function createConflictError(message, details = {}) {
  const error = new Error(message || "Revision conflict");
  error.statusCode = 409;
  error.code = "REVISION_CONFLICT";
  error.details = details;
  return error;
}

export function getActorInfo(actor) {
  const profile = safeObject(actor && actor.profile);
  return {
    actorId: firstText(actor && actor.studentId),
    actorName: firstText(profile.name, actor && actor.studentId ? actor.studentId : "system"),
    actorEmail: firstText(profile.email),
  };
}

export async function applyVersionedMutation({
  withTransaction,
  actor,
  source = "system",
  reason = "",
  entityType,
  entityId,
  expectedRevision = null,
  parentEntityType = "",
  parentEntityId = "",
  loadCurrent,
  mutate,
  loadAfter,
  buildSnapshot,
  buildEvent,
}) {
  if (typeof withTransaction !== "function") {
    throw new Error("withTransaction is required");
  }
  if (typeof loadCurrent !== "function" || typeof mutate !== "function") {
    throw new Error("loadCurrent and mutate are required");
  }
  const actorInfo = getActorInfo(actor);
  const batchId = `audit_batch:${crypto.randomUUID()}`;
  const batchCreatedAt = nowIso();

  return withTransaction(async (client) => {
    const txQuery = (text, params = []) => client.query(text, params);

    await txQuery(
      `insert into audit_change_batches (id, source, actor_id, actor_name, actor_email, reason, status, created_at, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        batchId,
        source,
        actorInfo.actorId,
        actorInfo.actorName,
        actorInfo.actorEmail,
        reason,
        "pending",
        batchCreatedAt,
        jsonbParam({ source, reason }, {}),
      ]
    );

    const current = await loadCurrent(txQuery);
    const currentRevision = current ? Number(current.revision_no || 1) || 1 : 0;
    const normalizedExpected = expectedRevision == null || expectedRevision === "" ? null : Number(expectedRevision);

    if (normalizedExpected != null && normalizedExpected !== currentRevision) {
      throw createConflictError("資料已被其他人更新，請重新整理後再試一次", {
        entityType,
        entityId,
        expectedRevision: normalizedExpected,
        currentRevision,
      });
    }

    const nextRevision = current ? currentRevision + 1 : 1;
    const mutationResult =
      (await mutate({
        txQuery,
        current,
        currentRevision,
        nextRevision,
        batchId,
        actor: actorInfo,
      })) || {};

    const after = Object.prototype.hasOwnProperty.call(mutationResult, "after")
      ? mutationResult.after
      : typeof loadAfter === "function"
      ? await loadAfter(txQuery)
      : null;

    const action = firstText(
      mutationResult.action,
      !current && after ? "create" : current && after ? "update" : current && !after ? "delete" : "update"
    );

    const beforeSnapshot = current ? (typeof buildSnapshot === "function" ? buildSnapshot(current) : current) : null;
    const afterSnapshot = after ? (typeof buildSnapshot === "function" ? buildSnapshot(after) : after) : null;
    const { changedFields, diff } = diffObjects(safeObject(beforeSnapshot), safeObject(afterSnapshot));

    const eventPayload =
      typeof buildEvent === "function"
        ? buildEvent({
            entityType,
            entityId,
            action,
            beforeSnapshot,
            afterSnapshot,
            current,
            after,
            changedFields,
            diff,
            actor: actorInfo,
            batchId,
            nextRevision,
          }) || {}
        : {};

    const versionId = `audit_version:${crypto.randomUUID()}`;
    const eventId = `audit_event:${crypto.randomUUID()}`;
    const committedAt = nowIso();

    await txQuery(
      `insert into audit_entity_versions (
         id, batch_id, entity_type, entity_id, parent_entity_type, parent_entity_id,
         action, revision_no, before_data, after_data, changed_fields, source_updated_at,
         actor_id, actor_name, created_at, raw
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16::jsonb)`,
      [
        versionId,
        batchId,
        entityType,
        entityId,
        firstText(eventPayload.parentEntityType, parentEntityType),
        firstText(eventPayload.parentEntityId, parentEntityId),
        action,
        nextRevision,
        jsonbParam(beforeSnapshot, null),
        jsonbParam(afterSnapshot, null),
        changedFields,
        firstText((after && after.updated_at) || (afterSnapshot && afterSnapshot.updatedAt), committedAt),
        actorInfo.actorId,
        actorInfo.actorName,
        committedAt,
        jsonbParam({ reason, source, diff }, {}),
      ]
    );

    await txQuery(
      `insert into audit_events (
         id, batch_id, entity_type, entity_id, parent_entity_type, parent_entity_id,
         action, actor_id, actor_name, summary, diff, severity, created_at, raw
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb)`,
      [
        eventId,
        batchId,
        entityType,
        entityId,
        firstText(eventPayload.parentEntityType, parentEntityType),
        firstText(eventPayload.parentEntityId, parentEntityId),
        action,
        actorInfo.actorId,
        actorInfo.actorName,
        firstText(eventPayload.summary, defaultSummary(entityType, action, entityId, changedFields)),
        jsonbParam(eventPayload.diff || diff, {}),
        firstText(eventPayload.severity, changedFields.includes("date") ? "warning" : "info"),
        committedAt,
        jsonbParam({ reason, source, changedFields }, {}),
      ]
    );

    await txQuery(
      `update audit_change_batches
          set status = 'committed', committed_at = $2,
              raw = coalesce(raw, '{}'::jsonb) || $3::jsonb
        where id = $1`,
      [batchId, committedAt, jsonbParam({ entityType, entityId, action }, {})]
    );

    return {
      ...(mutationResult.returnValue && typeof mutationResult.returnValue === "object" ? mutationResult.returnValue : {}),
      batchId,
      revisionNo: nextRevision,
      after,
      current,
    };
  });
}
