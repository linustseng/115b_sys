// Isolated component harness. No cloud writes; all /v1 and signed PUT calls intercepted.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const errors=[];
try {
 for(const kind of ['ActivityAlbums','Cheerleading']) for(const stage of ['intent','transfer','complete']) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let fail=true;
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();
  await page.route('**/audit-upload',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/node_modules/.vite/deps/react.js')).default;
const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const Page=(await import('/src/pages/${kind}Page.jsx')).default;
const shared={API_V2_URL:location.origin,loadStoredAdminSession_:()=>({token:'fixture'}),apiRequest:async()=>({result:{ok:true,data:{}}}),pad2_:x=>String(x).padStart(2,'0')};
createRoot(document.getElementById('root')).render(React.createElement(Page,{shared}));</script>`}));
  await page.route('**/v1/**',async r=>{
   const url=r.request().url();
   if(fail&&((stage==='intent'&&url.endsWith('upload-intent'))||(stage==='complete'&&url.endsWith('/complete'))))return;
   let data={};
   if(url.includes('/activity-albums?'))data={albums:[{id:'a',title:'測試相簿',status:'active'}]};
   else if(url.includes('/photos?'))data={album:{id:'a',title:'測試相簿',status:'active'},photos:[]};
   else if(url.endsWith('upload-intent'))data={signedUrl:'http://127.0.0.1:4178/signed-upload',photoId:'p',videoId:'v'};
   else if(url.includes('/videos/')&&url.endsWith('/complete'))data={video:{id:'v',title:'測試影片'}};
   await r.fulfill({json:{ok:true,data}});
  });
  await page.route('**/signed-upload',r=>{if(fail&&stage==='transfer')return;return r.fulfill({status:200,body:''});});
  await page.goto('http://127.0.0.1:4178/audit-upload');
  if(kind==='ActivityAlbums'){await page.getByText('測試相簿',{exact:true}).click();}
  else await page.getByRole('button',{name:'教學影片',exact:true}).click();
  const file={name:kind==='ActivityAlbums'?'test.png':'test.mp4',mimeType:kind==='ActivityAlbums'?'image/png':'video/mp4',buffer:Buffer.from('fixture')};
  async function start(){await page.locator('input[type=file]').setInputFiles(file);if(kind==='Cheerleading')await page.getByRole('button',{name:'上傳並上架',exact:true}).click();}
  const stalled=page.waitForRequest(r=>stage==='intent'?r.url().endsWith('upload-intent'):stage==='transfer'?r.url().endsWith('signed-upload'):r.url().endsWith('/complete'));
  await start();await stalled;await page.clock.fastForward(91000);
  await page.getByText(stage==='transfer'?'檔案傳送已停滯，請檢查網路後重試':'上傳服務回應逾時，請檢查附件是否已完成後再重試',{exact:kind!=='ActivityAlbums'}).waitFor();
  fail=false;await start();
  await page.getByText(kind==='ActivityAlbums'?'test.png — 已完成':'教學影片已上架',{exact:true}).waitFor();
  console.log(`PASS ${kind} ${stage}: timeout releases UI; retry succeeds`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
