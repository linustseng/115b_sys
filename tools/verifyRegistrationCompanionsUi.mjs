import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const errors=[];
try{
 for(const [category,width,allow] of [['travel',390,'yes'],['meeting',320,'yes'],['gathering',1280,'yes'],['travel',390,'no']]){
  const context=await browser.newContext({viewport:{width,height:900}});let saved=null;
  const student={id:'fixture',name:'測試同學',email:'test@example.test',phone:'0912345678'};
  const event={id:'fixture-event',title:'測試活動',category,status:'open',allowCompanions:allow,allowBringDrinks:'no',startAt:'2026-12-01T09:00:00+08:00',endAt:'2026-12-01T17:00:00+08:00'};
  await context.addInitScript(student=>{localStorage.setItem('emba115b.googleStudent',JSON.stringify({student}));localStorage.setItem('emba115b.adminSession',JSON.stringify({token:'fixture',savedAt:Date.now(),studentId:student.id,studentEmail:student.email}));},student);
  await context.route('**/*',async r=>{
   const req=r.request(),url=new URL(req.url());if(url.hostname==='127.0.0.1')return r.continue();
   if(!url.pathname.includes('/v1/')&&!url.pathname.includes('/health'))return r.abort();
   let body={};try{body=req.postDataJSON()||{}}catch{}
   const action=body.action||url.pathname.split('/').pop();let data={};
   if(action==='getRegistrationBootstrap'||url.pathname.includes('/bootstrap/registration'))data={event,student,registration:saved};
   if(action==='lookupStudent'||action==='createSession')data={student,token:'fixture',memberships:[]};
   if(action==='register'||action==='updateRegistration'||action==='update-registration'){
    const d=body.data||body;const fields=typeof d.customFields==='string'?JSON.parse(d.customFields):d.customFields;
    saved={...d,id:'registration-fixture',customFields:fields,status:'registered'};data={registration:saved};
   }
   return r.fulfill({json:{ok:true,data,error:null}});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4178/register?eventId=fixture-event');
  await page.getByText('活動：測試活動',{exact:true}).waitFor();
  await page.locator('#phone').fill(student.phone);
  if(allow==='yes'){
   await page.getByLabel('攜伴人數',{exact:true}).fill('3');await page.getByLabel('攜伴人數',{exact:true}).clear();assert.equal(await page.locator('#companions').inputValue(),'');
   await page.locator('#companions').pressSequentially('20');assert.equal(await page.locator('#companions').inputValue(),'20');
  }else assert.equal(await page.locator('#companions').count(),0);
  await page.getByLabel('備註 (選填)',{exact:true}).fill('攜伴測試：王同學、素食需求');
  await page.getByRole('button',{name:'送出報名',exact:true}).filter({visible:true}).click();
  await page.getByText('報名成功',{exact:true}).waitFor();
  assert.equal(saved.customFields.notes,'攜伴測試：王同學、素食需求');
  if(allow==='yes')assert.equal(saved.customFields.companions,'20');else assert.equal(saved.customFields.companions,undefined);
  await page.reload();await page.getByLabel('備註 (選填)',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('#notes')?.value==='攜伴測試：王同學、素食需求');
  if(allow==='yes'){
   assert.equal(await page.locator('#companions').inputValue(),'20');await page.locator('#companions').fill('0');
   await page.locator('#notes').fill('改為不攜伴');await page.getByRole('button',{name:'送出報名',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'更新報名',exact:true}).click();await page.getByText('報名資料已更新',{exact:true}).waitFor();
   assert.equal(saved.customFields.companions,'0');assert.equal(saved.customFields.notes,'改為不攜伴');
   await page.waitForFunction(()=>document.querySelector('#companions')?.value==='0'&&document.querySelector('#notes')?.value==='改為不攜伴');
   await page.reload();await page.waitForFunction(()=>document.querySelector('#companions')?.value==='0'&&document.querySelector('#notes')?.value==='改為不攜伴');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/companions-${category}-${allow}.png`,fullPage:true});
  console.log(`PASS ${category}/${allow}/${width}: count and notes save/reload/update`);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
