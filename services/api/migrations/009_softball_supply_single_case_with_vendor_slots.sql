-- 009_softball_supply_single_case_with_vendor_slots.sql

alter table if exists softball_supply_cases
  add column if not exists vendor_ids jsonb not null default '[]'::jsonb;

update softball_supply_cases
set vendor_ids = case
  when jsonb_typeof(vendor_ids) = 'array' and jsonb_array_length(vendor_ids) > 0 then vendor_ids
  when coalesce(vendor_id, '') <> '' then jsonb_build_array(vendor_id)
  else '[]'::jsonb
end;

with ranked as (
  select id,
         practice_id,
         row_number() over (
           partition by practice_id
           order by coalesce(updated_at, '') desc, id desc
         ) as rn
  from softball_supply_cases
)
delete from softball_supply_cases
where id in (select id from ranked where rn > 1);

drop index if exists idx_softball_supply_cases_practice_id;
drop index if exists uniq_softball_supply_cases_practice_id;
create unique index if not exists uniq_softball_supply_cases_practice_id on softball_supply_cases (practice_id);
