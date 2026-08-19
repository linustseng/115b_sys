-- 029 may already have been applied in a running environment before this
-- repository change was committed. Reassert the private-table boundary for
-- both that environment and clean installs.
alter table if exists activity_albums enable row level security;
alter table if exists activity_photos enable row level security;
