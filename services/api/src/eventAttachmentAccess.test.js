import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageEventAttachments } from './eventAttachmentAccess.js';
test('event attachments mirror event edit memberships', () => {
  for (const groupId of ['A','B','C','D','E','F']) {
    for (const roleInGroup of ['lead','deputy','member','']) {
      assert.equal(canManageEventAttachments([{groupId,roleInGroup}]), groupId==='C'||(['A','E'].includes(groupId)&&['lead','deputy'].includes(roleInGroup)), `${groupId}/${roleInGroup}`);
    }
  }
  assert.equal(canManageEventAttachments([]),false);
  assert.equal(canManageEventAttachments([{group_id:'C',role_in_group:'member'}]),true);
});
