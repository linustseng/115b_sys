import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dispatchNativeAction } from './nativeActions.js';
for (const role of ['member', '', 'lead', 'deputy']) {
  test(`information ${role || 'missing role'} administration and projects`, async () => {
    const allowed = ['lead', 'deputy'].includes(role);
    for (const action of ['listQuickLinks', 'upsertFinanceProject']) {
      let queried = false;
      const request = dispatchNativeAction({ action,
        payload: { includeArchived: true, data: { name: 'test', approverId: 'owner' } },
        auth: { studentId: 'test-user' },
        listMembershipsByStudentId: async () => [{ groupId: 'E', roleInGroup: role }],
        query: async () => { queried = true; return { rows: [{ id: 'owner', name: 'Owner' }] }; },
      });
      if (allowed) assert.equal((await request).ok, true);
      else await assert.rejects(request, /Forbidden/);
      assert.equal(queried, allowed);
    }
  });
}
const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
const start = source.indexOf('async function canAccessAttachmentEntity_(');
const end = source.indexOf('\n}', start) + 2;
for (const role of ['member', '', 'lead', 'deputy']) {
  test(`information ${role || 'missing role'} attachment access`, async () => {
    const fn = vm.runInNewContext(`(${source.slice(start, end)})`, {
      listMembershipsByStudentId: async () => [{ groupId: 'E', roleInGroup: role }],
      query: async () => ({ rows: [{ applicant_id: 'someone-else', owner_group_id: 'F', raw: {} }] }),
      isDocumentDraftEntity_: () => false, isFinanceDraftEntity_: () => false,
    });
    for (const entity of ['finance_request', 'academic_session_note', 'document_version', 'cheerleading_video']) {
      const access = await fn({ studentId: 'test-user' }, entity, 'existing');
      assert.equal(access.canUpload, ['lead', 'deputy'].includes(role), entity);
      assert.equal(access.canDelete, ['lead', 'deputy'].includes(role), entity);
    }
  });
}
const nativeSource = readFileSync(new URL('./nativeActions.js', import.meta.url), 'utf8');
function extract(text, name, context = {}) {
  const start = text.indexOf(`function ${name}(`);
  return vm.runInNewContext(`(${text.slice(start, text.indexOf('\n}', start) + 2)})`, context);
}
test('all backoffice group combinations restrict only information membership', () => {
  const canAccess = extract(nativeSource, 'canAccessByGroups', { asArray: x => x });
  for (const groups of [['E'], ['C','E'], ['I','E'], ['D','E'], ['E','F'], ['E','H'], ['E','L']]) {
    for (const role of ['member', '', 'lead', 'deputy']) {
      assert.equal(canAccess([{ groupId: 'E', roleInGroup: role }], groups), ['lead','deputy'].includes(role));
    }
    for (const groupId of groups.filter(x => x !== 'E')) {
      assert.equal(canAccess([{ groupId, roleInGroup: 'member' }], groups), true);
      assert.equal(canAccess([{ groupId: 'E', roleInGroup: 'member' }, { groupId, roleInGroup: 'member' }], groups), true);
    }
  }
});
test('document editing no longer permits ordinary information members', () => {
  const editable = extract(nativeSource, 'getEditableDocumentGroupIds_', { asArray: x => x, firstText: x => x || '' });
  assert.equal(editable([{ groupId: 'E', roleInGroup: 'member' }]).length, 0);
  for (const roleInGroup of ['lead','deputy']) assert.equal(editable([{ groupId: 'E', roleInGroup }])[0], 'E');
});
