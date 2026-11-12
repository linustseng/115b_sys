import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try { for(const width of [390,1280]) {
const page=await browser.newPage({viewport:{width,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let reads=0;
  await page.route('**/audit-upload',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/node_modules/.vite/deps/react.js')).default;
const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const Page=(await import('/src/pages/ActivityAlbumsPage.jsx')).default;
const shared={API_V2_URL:location.origin,loadStoredAdminSession_:()=>({token:'fixture'}),apiRequest:async()=>({result:{ok:true,data:{}}}),pad2_:x=>String(x).padStart(2,'0')};
createRoot(document.getElementById('root')).render(React.createElement(Page,{shared}));</script>`}));

await page.route('**/v1/**', async r=>{
 const url=r.request().url();let data={};
 if(url.includes('/activity-albums?'))data={albums:[{id:'a',title:'大相簿',status:'active',photoCount:677}]};
 else if(url.includes('/photos?')){assert.ok(url.includes('metadataOnly=1'));data={album:{id:'a',title:'大相簿',status:'active'},photos:Array.from({length:677},(_,i)=>({id:String(i),originalName:'photo'+i,status:'ready'}))};}
 else if(url.endsWith('/download')) {reads++;data={url:'/image.gif'};}
 await r.fulfill({json:{ok:true,data}});
});
await page.route('**/image.gif',r=>r.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')}));
await page.goto('http://127.0.0.1:4178/audit-upload');
await page.getByText('大相簿',{exact:true}).click();
await page.waitForFunction(()=>document.querySelector('article img')?.naturalWidth>0);
assert.equal(await page.locator('article').count(),40);assert.ok(reads<=40);
await page.getByText(/往下滑會自動載入更多照片/).scrollIntoViewIfNeeded();
await page.waitForFunction(()=>document.querySelectorAll('article').length===80);
assert.equal(await page.locator('article').count(),80);
await page.getByRole('button',{name:'瀏覽照片 1：photo0',exact:true}).click();
await page.getByRole('dialog').waitFor();
await page.getByRole('button',{name:'下一張照片',exact:true}).click();
await page.getByRole('button',{name:'關閉照片瀏覽器'}).click();
for(let count=80;count<677;count=Math.min(count+40,677)){
 await page.getByText(/往下滑會自動載入更多照片/).scrollIntoViewIfNeeded();
 await page.waitForFunction(n=>document.querySelectorAll('article').length===n,Math.min(count+40,677));
}
assert.equal(await page.getByText(/往下滑會自動載入更多照片/).count(),0);
assert.deepEqual(errors,[]); console.log('PASS',width,'677 photos, 40/80 bounded cards, lazy URLs, viewer');
await page.close();
}} finally {await browser.close();}
