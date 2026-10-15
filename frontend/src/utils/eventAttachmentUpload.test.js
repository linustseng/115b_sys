import { afterEach, describe, it, expect, vi } from 'vitest';
import { uploadEventAttachment } from './eventAttachmentUpload';
const file = Object.assign(new Blob(['sample']), { name: '參考.pdf' });
const options = { file, eventId: '26102401', baseUrl: 'https://api.example/', sessionToken: 'fixture' };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('event reference upload', () => {
  it('uploads authenticated multipart and preserves attachment identity', async () => {
    const item = { attachmentId: 'id', url: 'https://signed.example', name: file.name };
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { item } }) });
    vi.stubGlobal('fetch', fetch);
    expect(await uploadEventAttachment(options)).toEqual(item);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example/v1/attachments/upload');
    expect(init.headers.Authorization).toBe('Bearer fixture');
    expect(init.body.get('entityType')).toBe('event');
    expect(init.body.get('entityId')).toBe(options.eventId);
    expect(init.body.get('file').type).toBe('application/pdf');
  });
  it.each([401,403,500])('surfaces HTTP %s instead of waiting for postMessage', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: 'failed' }) }));
    await expect(uploadEventAttachment(options)).rejects.toThrow();
  });
  it('rejects a missing attachment response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok:true,status:200,json:async()=>({ok:true,data:{}}) }));
    await expect(uploadEventAttachment(options)).rejects.toThrow('回應不完整');
  });
  it('aborts stalled requests and allows retry', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((url, init) => new Promise((resolve,reject) => init.signal.addEventListener('abort',()=>reject(new Error('aborted'))))));
    const result = expect(uploadEventAttachment({...options,timeoutMs:10})).rejects.toThrow('上傳逾時');
    await vi.advanceTimersByTimeAsync(11); await result;
  });
  it('rejects invalid files and absent credentials before sending', async () => {
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(uploadEventAttachment({...options,eventId:''})).rejects.toThrow('活動日期');
    await expect(uploadEventAttachment({...options,sessionToken:''})).rejects.toThrow('登入');
    await expect(uploadEventAttachment({...options,file:{name:'x.exe',size:1}})).rejects.toThrow('格式');
    await expect(uploadEventAttachment({...options,file:{name:'x.pdf',size:11*1024*1024}})).rejects.toThrow('10MB');
    expect(fetch).not.toHaveBeenCalled();
  });
});
