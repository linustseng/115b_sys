import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTimeMs, isWithinWindow } from './eventTimeWindow.js';
import { registrationWindowLabel } from '../../../frontend/src/utils/registrationWindow.js';
const open = '2026-10-15T19:00', close = '2026-10-31T20:30';
test('Taiwan registration boundaries agree with UI regardless of server timezone', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Taipei', 'America/New_York']) {
      process.env.TZ = tz;
      assert.equal(eventTimeMs(open), Date.parse('2026-10-15T11:00Z'));
      for (const [now,label] of [['2026-10-15T18:59:59+08:00','報名尚未開始'],['2026-10-15T19:00+08:00','報名進行中'],['2026-10-15T20:15+08:00','報名進行中'],['2026-10-31T20:30+08:00','報名進行中'],['2026-10-31T20:30:01+08:00','報名已截止']]) {
        assert.equal(registrationWindowLabel({status:'open',registrationOpenAt:open,registrationCloseAt:close}, Date.parse(now)), label);
        assert.equal(isWithinWindow(open, close, Date.parse(now)), label === '報名進行中');
      }
    }
  } finally {if (original === undefined) delete process.env.TZ; else process.env.TZ = original;}
});
test('explicit zones, legacy formats, optional bounds and closed status', () => {
  for (const date of ['2026-10-15T19:00+08:00','2026-10-15T11:00:00.000Z','2026/10/15 19:00']) assert.equal(eventTimeMs(date),eventTimeMs(open));
  assert.equal(isWithinWindow('', ''),true);
  assert.equal(isWithinWindow('', close,Date.parse('2026-11-01T00:00+08:00')),false);
  assert.equal(registrationWindowLabel({status:'closed'}),'報名未開放');
});
