// Fixture-only UI smoke test; all non-local network requests are intercepted.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const project={id:'project1',name:'測試啦啦隊專案',approverId:'owner',approverName:'專案同學',active:true};
const students=[{id:'applicant',name:'申請同學',email:'applicant@example.test'},{id:'owner',name:'專案同學',email:'owner@example.test'},{id:'finance',name:'財務同學',email:'finance@example.test'}];
const groupMemberships=[{personId:'applicant',personName:'申請同學',groupId:'D',roleInGroup:'deputy'},{personId:'finance',personName:'財務同學',groupId:'D',roleInGroup:'lead'},{personId:'owner',personName:'專案同學',groupId:'B',roleInGroup:'member'}];
const request={id:'r1',type:'payment',title:'測試專案請款',amountActual:1000,status:'pending_project',applicantId:'applicant',applicantName:'申請同學',applicantDepartment:'D',applicantRole:'deputy',projectId:project.id,projectName:project.name,projectApproverId:'owner',projectApproverName:'專案同學',projectNextStatus:'pending_lead',revisionNo:1,createdAt:new Date().toISOString(),attachments:[]};
const calls=[];const errors=[];
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
 if(action==='listApprovalsOverview') data={pending:1,inProgress:0,completed:0,returned:0};
 return route.fulfill({json:{ok:true,data,error:null},headers:{'access-control-allow-origin':'*'}});
 }
 return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 return {page,context};
}
try {
 const {page,context}=await setup('finance',{width:390,height:844});
 await page.goto('http://127.0.0.1:4178/admin/finance');
 await page.getByRole('button',{name:'專案項目',exact:true}).click({timeout:15000});
 await page.getByRole('button',{name:'編輯',exact:true}).click();
 await page.getByLabel('專案名稱',{exact:true}).fill('測試啦啦隊專案更新');
 await page.getByRole('button',{name:'儲存修改',exact:true}).click();
 await page.getByText('專案設定已儲存',{exact:true}).waitFor();
 assert(calls.some(c=>c.action==='upsertFinanceProject'&&c.body.data.name==='測試啦啦隊專案更新'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:'/tmp/finance-project-admin-mobile.png',fullPage:true});
 console.log('PASS mobile finance project edit/save and no horizontal overflow');await context.close();
 const a=await setup('owner',{width:390,height:844});
 await a.page.goto('http://127.0.0.1:4178/approvals');
 await a.page.getByRole('button',{name:'檢視',exact:true}).first().click({timeout:15000});
 await a.page.getByRole('button',{name:'核准',exact:true}).click();
 await a.page.waitForTimeout(400);
 assert(calls.some(c=>c.action==='updateFinanceRequest'&&c.body.actorRole==='project'));
 console.log('PASS ordinary project owner sees pending request and sends project approval');await a.context.close();
 const b=await setup('applicant',{width:1280,height:900});
 await b.page.goto('http://127.0.0.1:4178/finance');
 await b.page.getByRole('button').filter({hasText:'建立請購案'}).first().click({timeout:15000});
 await b.page.getByLabel('專案項目',{exact:true}).selectOption('project1');
 assert.equal(await b.page.getByLabel('專案項目',{exact:true}).inputValue(),'project1');
 await b.page.screenshot({path:'/tmp/finance-project-applicant-desktop.png',fullPage:true});
 console.log('PASS applicant project dropdown selection');await b.context.close();
 assert.deepEqual(errors,[]);console.log('PASS no page errors');
} catch(e) {console.log('UI FAILURE',e.message);console.log('recent actions',calls.slice(-12).map(c=>c.action));throw e;}
finally{await browser.close()}
