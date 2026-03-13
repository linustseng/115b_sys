-- 008_softball_supply_multi_cases.sql

alter table if exists softball_supply_cases
  add column if not exists title text;

update softball_supply_cases
set title = coalesce(nullif(title, ''), nullif(raw->>'title', ''), nullif(raw->>'vendorName', ''), '補給單')
where coalesce(title, '') = '';

drop index if exists uniq_softball_supply_cases_practice_id;
create index if not exists idx_softball_supply_cases_practice_id on softball_supply_cases (practice_id);
