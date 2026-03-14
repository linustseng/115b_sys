-- 011_softball_supply_vendor_ids_array_constraint.sql

alter table if exists softball_supply_cases
  drop constraint if exists chk_softball_supply_cases_vendor_ids_array;

alter table if exists softball_supply_cases
  add constraint chk_softball_supply_cases_vendor_ids_array
  check (jsonb_typeof(vendor_ids) = 'array');
