insert into events (
  id, title, description, start_at, end_at, registration_open_at, registration_close_at,
  capacity, status, category, form_schema, raw
) values (
  'world-cup-final-2026',
  '世界盃冠軍賽預測：西班牙 vs 阿根廷',
  '115B 限定預測賽。無金流；最後一名請第一名吃飯。比分以 90 分鐘正規時間為準，冠軍以加時／PK 後的正式結果為準。',
  '2026-07-20T03:00:00+08:00', '2026-07-20T05:30:00+08:00',
  '2026-07-18T00:00:00+08:00', '2026-07-20T02:30:00+08:00',
  0, 'open', 'meeting',
  '{"type":"world_cup_prediction","homeTeam":"西班牙","awayTeam":"阿根廷"}'::jsonb,
  '{"predictionContest":true}'::jsonb
) on conflict (id) do nothing;
