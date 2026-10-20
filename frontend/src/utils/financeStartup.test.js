import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
const source = readFileSync(new URL('../pages/FinanceAdminPage.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  useEffect(() => {\n    let active = true;'.replace('\\n', '\n'));
const end = source.indexOf('  }, []);', start);
const body = source.slice(start + '  useEffect(() => {'.length, end);
function run(apiRequest) {
  const setters = Object.fromEntries(['setInitialLoading', 'setInitialError', 'setRequests', 'setGroupMemberships', 'setFinanceRoles', 'setFinanceProjects', 'loadFinanceCategories', 'loadStudents', 'loadFundEvents', 'loadFundSummary'].map(k => [k, vi.fn()]));
  const names = ['apiRequest', 'normalizeFinanceRole_', 'mapAppErrorMessage', ...Object.keys(setters)];
  const cleanup = new Function(...names, body)(apiRequest, x => x, x => x, ...Object.values(setters));
  return { ...setters, cleanup };
}
afterEach(() => vi.useRealTimers());
describe('finance startup effect', () => {
  it('extracts the mounted startup effect', () => expect(start).toBeGreaterThan(0));
  it('times out stalled reads without false permission denial or late data', async () => {
    vi.useFakeTimers(); let resolve;
    const state = run(() => new Promise(r => { resolve = r; }));
    await vi.advanceTimersByTimeAsync(20001);
    expect(state.setInitialError).toHaveBeenCalledWith(expect.stringContaining('20 秒'));
    expect(state.setInitialLoading).toHaveBeenLastCalledWith(false);
    expect(state.setRequests).not.toHaveBeenCalled();
    resolve({ result: { ok: true, data: {} } });
    await vi.advanceTimersByTimeAsync(1);
    expect(state.setRequests).not.toHaveBeenCalled();
  });
  it('loads required data and defers optional reads until success', async () => {
    vi.useFakeTimers();
    const state = run(async () => ({ result: { ok: true, data: {} } }));
    await vi.advanceTimersByTimeAsync(1);
    expect(state.setRequests).toHaveBeenCalledWith([]);
    expect(state.loadStudents).toHaveBeenCalledOnce();
    expect(state.setInitialError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('surfaces server failure without publishing partial role data', async () => {
    vi.useFakeTimers();
    const state = run(async () => ({ result: { ok: false, error: 'Unauthorized' } }));
    await vi.advanceTimersByTimeAsync(1);
    expect(state.setInitialError).toHaveBeenCalledWith('Unauthorized');
    expect(state.setFinanceRoles).not.toHaveBeenCalled();
    expect(state.setInitialLoading).toHaveBeenLastCalledWith(false);
  });
  it('ignores completion after unmount', async () => {
    vi.useFakeTimers();
    const state = run(async () => ({ result: { ok: true, data: {} } }));
    state.cleanup(); await vi.advanceTimersByTimeAsync(1);
    expect(state.setRequests).not.toHaveBeenCalled();
  });
});
