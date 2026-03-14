-- 011_softball_supply_vendor_ids_array_constraint.sql

-- Normalize legacy / malformed vendor_ids values before enforcing array-only constraint.
update softball_supply_cases
set vendor_ids = case
  when vendor_ids is null then
    case
      when coalesce(vendor_id, '') <> '' then jsonb_build_array(vendor_id)
      else '[]'::jsonb
    end
  when jsonb_typeof(vendor_ids) = 'array' then vendor_ids
  when jsonb_typeof(vendor_ids) = 'string' then
    case
      when btrim(vendor_ids #>> '{}') <> '' then jsonb_build_array(vendor_ids #>> '{}')
      when coalesce(vendor_id, '') <> '' then jsonb_build_array(vendor_id)
      else '[]'::jsonb
    end
  when jsonb_typeof(vendor_ids) = 'null' then
    case
      when coalesce(vendor_id, '') <> '' then jsonb_build_array(vendor_id)
      else '[]'::jsonb
    end
  else
    case
      when coalesce(vendor_id, '') <> '' then jsonb_build_array(vendor_id)
      else '[]'::jsonb
    end
end;

alter table if exists softball_supply_cases
  drop constraint if exists chk_softball_supply_cases_vendor_ids_array;

alter table if exists softball_supply_cases
  add constraint chk_softball_supply_cases_vendor_ids_array
  check (jsonb_typeof(vendor_ids) = 'array');
