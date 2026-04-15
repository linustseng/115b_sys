// 115b_sys auth P0 console snippets
// Usage: copy needed block into browser DevTools console on 115b-sys site.

window.__authP0 = {
  mockStudentA: {
    id: 'B123',
    email: 'linus@example.com',
    name: 'Linus Tseng',
    preferredName: 'Linus',
    nameZh: '曾立穎',
    company: 'Test Co',
    title: 'CEO',
  },
  mockStudentB: {
    id: 'B999',
    email: 'other@example.com',
    name: 'Other User',
    preferredName: 'Other',
    nameZh: '其他同學',
    company: 'Other Co',
    title: 'Manager',
  },
  mockSessionGood: {
    token: 'session-token-demo',
    refreshToken: 'refresh-token-demo',
    studentId: 'B123',
    memberships: [],
  },
  mockSessionExpired: {
    token: 'expired-session-token',
    refreshToken: 'expired-refresh-token',
    studentId: 'B123',
    memberships: [],
  },
  clear() {
    localStorage.removeItem('emba115b.googleStudent');
    localStorage.removeItem('emba115b.adminSession');
    sessionStorage.removeItem('emba115b.googleIdToken');
    sessionStorage.removeItem('emba115b.reauth_reason');
  },
  tc002() {
    this.clear();
    localStorage.setItem('emba115b.googleStudent', JSON.stringify(this.mockStudentA));
    localStorage.setItem('emba115b.adminSession', JSON.stringify(this.mockSessionGood));
    location.href = '/';
  },
  tc003() {
    this.clear();
    localStorage.setItem('emba115b.googleStudent', JSON.stringify(this.mockStudentA));
    location.href = '/';
  },
  tc005() {
    this.clear();
    localStorage.setItem('emba115b.googleStudent', JSON.stringify(this.mockStudentA));
    localStorage.setItem('emba115b.adminSession', JSON.stringify(this.mockSessionGood));
    location.href = '/';
  },
  tc010() {
    this.clear();
    location.href = '/home';
  },
  tc011(eventId = '') {
    this.clear();
    location.href = eventId ? `/registration?eventId=${encodeURIComponent(eventId)}` : '/registration';
  },
};

console.log('Loaded __authP0 helpers:', Object.keys(window.__authP0));
