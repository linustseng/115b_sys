-- 010_finance_workflow_created_by_role.sql

with vars as (
  select to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now_iso
), accounting_created as (
  select fr.id
  from finance_requests fr
  join finance_roles ar
    on coalesce(fr.raw->>'manualCreatedBy', '') = coalesce(ar.student_id, '')
  where lower(coalesce(ar.role, ar.raw->>'role', '')) = 'accounting'
), backfilled as (
  update finance_requests fr
     set raw = jsonb_set(coalesce(fr.raw, '{}'::jsonb), '{workflowCreatedByRole}', to_jsonb('accounting'::text), true),
         synced_at = now()
    from accounting_created ac
   where fr.id = ac.id
     and coalesce(fr.raw->>'workflowCreatedByRole', '') = ''
  returning fr.id
), targets as (
  select fr.id,
         fr.title,
         fr.status as from_status,
         v.now_iso
    from finance_requests fr
    join finance_roles ar
      on coalesce(fr.raw->>'manualCreatedBy', '') = coalesce(ar.student_id, '')
    cross join vars v
   where lower(coalesce(ar.role, ar.raw->>'role', '')) = 'accounting'
     and coalesce(fr.status, '') = 'pending_accounting'
     and lower(coalesce(fr.type, fr.raw->>'type', '')) <> 'purchase'
     and lower(coalesce(fr.type, fr.raw->>'type', '')) <> 'pettycash'
     and lower(coalesce(fr.payment_method, fr.raw->>'paymentMethod', '')) <> 'pettycash'
), corrected as (
  update finance_requests fr
     set status = 'pending_cashier',
         updated_at = t.now_iso,
         raw = jsonb_set(
                 jsonb_set(
                   coalesce(fr.raw, '{}'::jsonb),
                   '{status}',
                   to_jsonb('pending_cashier'::text),
                   true
                 ),
                 '{updatedAt}',
                 to_jsonb(t.now_iso),
                 true
               ),
         synced_at = now()
    from targets t
   where fr.id = t.id
  returning fr.id, t.title, t.from_status, 'pending_cashier'::text as to_status, t.now_iso
)
insert into finance_actions (id, request_id, actor_id, actor_name, action_type, from_status, to_status, notes, created_at, raw)
select 'sys-fix-finance-workflow-' || c.id,
       c.id,
       null,
       'system',
       'system_fix',
       c.from_status,
       c.to_status,
       'Backfill workflowCreatedByRole=accounting and corrected next approver to cashier',
       c.now_iso,
       jsonb_build_object(
         'id', 'sys-fix-finance-workflow-' || c.id,
         'requestId', c.id,
         'actorName', 'system',
         'actionType', 'system_fix',
         'fromStatus', c.from_status,
         'toStatus', c.to_status,
         'notes', 'Backfill workflowCreatedByRole=accounting and corrected next approver to cashier',
         'createdAt', c.now_iso
       )
from corrected c
on conflict (id) do nothing;
