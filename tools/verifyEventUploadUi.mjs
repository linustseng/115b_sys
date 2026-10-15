// Fixture-only UI smoke test; all non-local network requests are intercepted.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const project={id:'project1',name:'測試啦啦隊專案',approverId:'owner',approverName:'專案同學',active:true};
const students=[{id:'applicant',name:'申請同學',email:'applicant@example.test'},{id:'owner',name:'專案同學',email:'owner@example.test'},{id:'finance',name:'財務同學',email:'finance@example.test'}];
const groupMemberships=[{personId:'applicant',personName:'申請同學',groupId:'D',roleInGroup:'deputy'},{personId:'finance',personName:'財務同學',groupId:'C',roleInGroup:'lead'},{personId:'owner',personName:'專案同學',groupId:'B',roleInGroup:'member'}];
const request={id:'r1',type:'payment',title:'測試專案請款',amountActual:1000,status:'pending_project',applicantId:'applicant',applicantName:'申請同學',applicantDepartment:'D',applicantRole:'deputy',projectId:project.id,projectName:project.name,projectApproverId:'owner',projectApproverName:'專案同學',projectNextStatus:'pending_lead',revisionNo:1,createdAt:new Date().toISOString(),attachments:[]};
const calls=[];const errors=[];let uploadFail=false;
async function setup(id,viewport) {
 const context=await browser.newContext({viewport});
 const student=students.find(s=>s.id===id);
 await context.addInitScript(({student,groupMemberships})=>{
 localStorage.setItem('emba115b.googleStudent',JSON.stringify({student}));
 localStorage.setItem('emba115b.adminSession',JSON.stringify({token:'test-only',savedAt:Date.now(),studentId:student.id,studentEmail:student.email,memberships:groupMemberships.filter(m=>m.personId===student.id)}));
 },{student,groupMemberships});
 await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.hostname==='127.0.0.1') return route.continue();
 if(url.pathname === '/v1/attachments/upload') {
   assert.equal(req.headers().authorization, 'Bearer test-only');
   assert(req.postDataBuffer().toString().includes('name="entityType"\r\n\r\nevent'));
   if (uploadFail) return route.fulfill({status:500,json:{ok:false,error:'測試上傳失敗'}});
   return route.fulfill({json:{ok:true,data:{item:{attachmentId:'file1',name:'參考.pdf',url:'https://example.test/file.pdf',source:'attachment'}}}});
 }
 if(url.pathname.includes('/v1/') || url.pathname.includes('/health')) {
 let action=url.pathname.split('/').pop(),body={};try{body=req.postDataJSON()||{}}catch{}
 if(body.action) action=body.action;
 calls.push({action,body,id});
 let data={};
 if(action.includes('Bootstrap')) data={students,groupMemberships,projects:[project],categories:[{id:'general',label:'一般'}],roles:[],fundEvents:[],requests:id==='applicant'?[]:[request],fundSummary:{income:{},expense:{},balance:{}}};
 if(action==='listMyMemberships'||action==='group-memberships') data={memberships:groupMemberships.filter(m=>m.personId===id)};
 if(action==='students'||action==='listStudents') data={students};
 if(action==='listFinanceProjects') data={projects:[project]};
 if(action==='upsertFinanceProject') Object.assign(project,body.data);
 if(action==='updateFinanceRequest') {request.status='pending_lead'; data={id:request.id,status:request.status};}
 if(action==='listFinanceRequests') data={requests:[request]};
 if(action==='lookupStudent'||action==='createSession') data={student,token:'test-only',sessionToken:'test-only',memberships:groupMemberships.filter(m=>m.personId===id)};
 if(action==='getAttachmentAccessUrl') data={url:'https://example.test/fresh.pdf',name:'參考.pdf'};
 if(action==='listApprovalsOverview') data={pending:1,inProgress:0,completed:0,returned:0};
 return route.fulfill({json:{ok:true,data,error:null},headers:{'access-control-allow-origin':'*'}});
 }
 return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 return {page,context};
}

try {
 for (const viewport of [{width:390,height:844},{width:1280,height:900}]) {
  const {page,context}=await setup('finance',viewport);
  await page.goto('http://127.0.0.1:4178/admin/events');
  await page.getByRole('button',{name:'新增活動',exact:true}).first().click();
  const file={name:'參考.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')};
  uploadFail=true;
  await page.locator('#event-upload-file').setInputFiles(file);
  await page.getByText('測試上傳失敗',{exact:true}).waitFor();
  assert.equal(await page.getByText('上傳中...',{exact:true}).count(),0);
  uploadFail=false;
  await page.locator('#event-upload-file').setInputFiles(file);
  await page.getByRole('button',{name:'參考.pdf',exact:true}).waitFor();
  assert.equal(await page.getByText('上傳中...',{exact:true}).count(),0);
  assert.equal(await page.locator('iframe[name="upload-frame"]').count(),0);
  await page.getByRole('button',{name:'參考.pdf',exact:true}).click();
  await page.waitForTimeout(100);
  assert(calls.some(c=>c.action==='getAttachmentAccessUrl' && c.body.attachmentId==='file1'));
  await page.locator('form').filter({has:page.locator('button[type="submit"]')}).locator('input').evaluateAll(inputs => {
    // Activity name is the first editable text input after the read-only activity ID.
    const input=inputs.find(i=>!i.readOnly && i.type==='text');
    if(input) { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'附件測試活動'); input.dispatchEvent(new Event('input',{bubbles:true})); }
  });
  await page.getByRole('button',{name:'新增活動',exact:true}).last().click();
  await page.waitForTimeout(200);
  assert(calls.some(c=>c.action==='createEvent' && JSON.parse(c.body.data.attachments).some(a=>a.attachmentId==='file1')));
  await page.screenshot({path:`/tmp/event-upload-${viewport.width}.png`,fullPage:true});
  console.log(`PASS ${viewport.width}: failed upload releases state, same-file retry succeeds with authenticated multipart`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
} finally { await browser.close(); }
