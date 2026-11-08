-- Preserve legacy audit rows, which cannot distinguish admitted from rejected
-- requests. Start the corrected limiter with a fresh window at rollout.
alter table activity_album_upload_attempts
  add column if not exists admitted boolean not null default false;
