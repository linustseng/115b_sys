import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {fetchUploadResponse,uploadSignedFile} from './uploadTransport';
import CheerleadingPage from '../pages/CheerleadingPage';
import ActivityAlbumsPage from '../pages/ActivityAlbumsPage';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('bounded upload JSON transport',()=>{
 it('retains success and HTTP error payloads',async()=>{
  for(const status of [200,401,403,500]){
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:status===200,status,json:async()=>({ok:status===200,error:'reason'})}));
   const r=await fetchUploadResponse('/upload',{headers:{Authorization:'fixture'}});
   expect(r.status).toBe(status);expect((await r.json()).error).toBe('reason');
  }
 });
 it.each(['headers','body'])('times out stalled %s and aborts the request',async stage=>{
  vi.useFakeTimers();let signal;
  vi.stubGlobal('fetch',vi.fn((url,opts)=>{signal=opts.signal;return stage==='headers'?new Promise(()=>{}):Promise.resolve({ok:true,status:200,json:()=>new Promise(()=>{})});}));
  const result=expect(fetchUploadResponse('/upload',{},90)).rejects.toThrow('逾時');
  await vi.advanceTimersByTimeAsync(91);await result;expect(signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it('does not keep a timeout alive after network failure',async()=>{
  vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  await expect(fetchUploadResponse('/upload')).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);
 });
});
describe('signed transfer idle deadline',()=>{
 let xhr;
 beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('XMLHttpRequest',class{constructor(){xhr=this;this.upload={};this.headers={};}open(...args){this.args=args;}setRequestHeader(k,v){this.headers[k]=v;}send(file){this.file=file;}abort(){this.aborted=true;this.onabort?.();}});});
 it('aborts a stalled transfer and can start a new successful attempt',async()=>{
  const pending=expect(uploadSignedFile('https://signed',{},'video/mp4',()=>{},90)).rejects.toThrow('停滯');
  await vi.advanceTimersByTimeAsync(91);await pending;expect(xhr.aborted).toBe(true);
  const next=uploadSignedFile('https://signed',{},'video/mp4',()=>{},90);xhr.status=200;xhr.onload();await next;expect(vi.getTimerCount()).toBe(0);
 });
 it('keeps a progressing large file alive but bounds final response wait',async()=>{
  const progress=vi.fn();const pending=expect(uploadSignedFile('https://signed',{},'video/mp4',progress,90)).rejects.toThrow('停滯');
  for(let loaded=10;loaded<=100;loaded+=10){await vi.advanceTimersByTimeAsync(80);xhr.upload.onprogress({loaded,total:100,lengthComputable:true});expect(xhr.aborted).not.toBe(true);}
  expect(progress).toHaveBeenLastCalledWith(100);await vi.advanceTimersByTimeAsync(91);await pending;
 });
 it.each(['onerror','onabort','ontimeout','onload'])('releases timer on %s failure',async handler=>{
  const pending=expect(uploadSignedFile('https://signed',{},'image/png',()=>{},90)).rejects.toThrow();xhr.status=503;xhr[handler]();await pending;expect(vi.getTimerCount()).toBe(0);
 });
 it('loads both real upload pages',()=>{expect(typeof CheerleadingPage).toBe('function');expect(typeof ActivityAlbumsPage).toBe('function');});
});
