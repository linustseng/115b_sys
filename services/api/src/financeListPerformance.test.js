import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateAttachmentGroups } from './attachments.js';
import { dispatchNativeAction } from './nativeActions.js';
test('500 finance attachments use one metadata query and no storage signing', async () => {
  let count = 0;
  const groups = Array.from({length:500}, (_, i) => [{attachmentId:'a'+i}]);
  const result = await hydrateAttachmentGroups(async (sql,[ids]) => {
    count++; assert.equal(ids.length,500);
    return {rows:ids.map(id => ({id,original_name:id+'.pdf',status:'ready'}))};
  }, groups);
  assert.equal(count,1); assert.equal(result.length,500);
  assert.equal(result[499][0].attachmentId,'a499'); assert.equal(result[499][0].url,'');
});
test('batch hydration preserves groups, legacy URLs, missing/deleted behavior and deduplicates IDs', async () => {
  const result=await hydrateAttachmentGroups(async (_, [ids]) => {
    assert.deepEqual(ids,['a','deleted','missing']);
    return {rows:[{id:'a',original_name:'receipt.pdf',status:'ready'},{id:'deleted',status:'deleted'}]};
  }, [[{attachmentId:'a'}],[],[{attachmentId:'a'},{url:'https://example.test/legacy'},{attachmentId:'deleted'},{attachmentId:'missing'}]]);
  assert.equal(result[0][0].name,'receipt.pdf'); assert.deepEqual(result[1],[]);
  assert.equal(result[2].length,2); assert.equal(result[2][1].url,'https://example.test/legacy');
});
test('empty groups avoid metadata queries', async () => {
  assert.deepEqual(await hydrateAttachmentGroups(()=>{throw Error('unexpected query')},[[]]),[[]]);
});
for(const admin of [true,false]) test('finance list batches attachments and preserves '+(admin?'admin':'applicant')+' scope',async()=>{
  let attachmentReads=0;
  const result=await dispatchNativeAction({action:'listFinanceRequests',payload:{},auth:{studentId:'person'},
    listMembershipsByStudentId:async()=>admin?[{groupId:'D',roleInGroup:'lead'}]:[],
    query:async(sql,params)=>{
      if(sql.includes('from finance_roles')) return {rows:[]};
      if(sql.includes('from finance_requests')) {
        assert.equal(sql.includes('where applicant_id'),!admin);
        if(!admin) assert.deepEqual(params,['person']);
        return {rows:Array.from({length:200},(_,i)=>({id:'r'+i,status:'closed',raw:{attachments:[{attachmentId:'a'+i}]}}))};
      }
      if(sql.includes('from attachments')){attachmentReads++;return {rows:params[0].map(id=>({id,original_name:'file.pdf',status:'ready'}))};}
      throw Error('unexpected SQL '+sql);
    }});
  assert.equal(result.ok,true);assert.equal(result.data.requests.length,200);
  assert.equal(attachmentReads,1); assert.equal(result.data.requests[0].attachments[0].url,'');
});
