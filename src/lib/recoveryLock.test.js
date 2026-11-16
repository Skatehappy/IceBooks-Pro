import { describe, it, expect, vi } from 'vitest';
import {
  RECOVERY_LOCK_KEY, UNREADABLE, decodeJwtPayload, sessionFacts, readLock, writeLock, decideAuthGate, shouldLoadData,
  parseAuthHash, createRecoveryGate, subscribeLockChanges, parseAuthError, cleanAuthUrl,
} from './recoveryLock.js';

// ---- helpers ----
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
const mkSession = ({ userId = 'u1', sessionId = 's1', amr = [{ method: 'recovery', timestamp: 1 }], token } = {}) => ({
  access_token: token || jwt({ sub: userId, session_id: sessionId, amr }),
  user: { id: userId },
});
const recoverySession = () => mkSession();
const passwordSession = () => mkSession({ sessionId: 's9', amr: [{ method: 'password', timestamp: 1 }] });

/** In-memory Storage shared by "tabs"; setItem/removeItem fire 'storage' on every OTHER tab (like browsers). */
function makeBrowser() {
  const data = new Map();
  const tabs = [];
  const fire = (from, key) => tabs.filter((t) => t !== from).forEach((t) => t.listeners.forEach((fn) => fn({ key })));
  const storageFor = (tab) => ({
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); fire(tab, k); },
    removeItem: (k) => { data.delete(k); fire(tab, k); },
  });
  const openTab = (landing = null) => {
    const tab = { listeners: [] };
    tab.window = { addEventListener: (_t, fn) => tab.listeners.push(fn), removeEventListener: (_t, fn) => { tab.listeners = tab.listeners.filter((f) => f !== fn); } };
    tab.storage = storageFor(tab);
    tab.gate = createRecoveryGate({ getStorage: () => tab.storage, landing });
    tabs.push(tab);
    return tab;
  };
  return { data, openTab };
}
const blockedStorage = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); }, removeItem: () => { throw new Error('SecurityError'); } };

/**
 * Mirror of context.jsx applyAuth: the only path to data loading. Records every data-loading call.
 */
function makeApp(gate) {
  const loads = [];
  const state = { locked: false, session: null };
  const apply = (evt, s) => {
    state.session = s;
    state.locked = gate.evaluate(evt, s).locked;
    if (shouldLoadData({ session: s, locked: state.locked })) loads.push(s.user.id);
    return state.locked;
  };
  return { apply, loads, state };
}

describe('JWT / session facts', () => {
  it('decodes amr methods and session_id (object and string amr forms)', () => {
    expect(sessionFacts(recoverySession())).toEqual({ userId: 'u1', sessionId: 's1', amr: ['recovery'] });
    expect(sessionFacts(mkSession({ amr: ['password'] })).amr).toEqual(['password']);
    expect(decodeJwtPayload(jwt({ name: 'Zoë' })).name).toBe('Zoë');
  });
  it('undecodable token -> amr unknown (null), not "no recovery"', () => {
    expect(sessionFacts(mkSession({ token: 'garbage' })).amr).toBeNull();
    expect(decodeJwtPayload('a.!!!.c')).toBeNull();
    expect(sessionFacts(null)).toEqual({ userId: null, sessionId: null, amr: null });
  });
});

describe('lock storage', () => {
  it('readLock: null when empty, record when valid, UNREADABLE when blocked', () => {
    const b = makeBrowser(); const t = b.openTab();
    expect(readLock(t.storage)).toBeNull();
    writeLock(t.storage, { v: 1, status: 'locked', userId: 'u1', sessionId: 's1' });
    expect(readLock(t.storage).status).toBe('locked');
    expect(readLock(blockedStorage)).toBe(UNREADABLE);
    expect(readLock(null)).toBe(UNREADABLE);
    expect(writeLock(blockedStorage, null)).toBe(false);
    b.data.set(RECOVERY_LOCK_KEY, '{not json');
    expect(readLock(t.storage)).toBe(UNREADABLE);
  });
});

describe('decideAuthGate', () => {
  const base = { userId: 'u1', sessionId: 's1' };
  it('PASSWORD_RECOVERY / landing signal locks and persists', () => {
    const d = decideAuthGate({ ...base, amr: ['password'], signal: true, stored: null });
    expect(d).toEqual({ locked: true, write: { v: 1, status: 'locked', userId: 'u1', sessionId: 's1' } });
  });
  it('amr recovery locks even with no stored record (flag cleared)', () => {
    expect(decideAuthGate({ ...base, amr: ['recovery'], stored: null }).locked).toBe(true);
    expect(decideAuthGate({ ...base, amr: ['invite'], stored: null }).locked).toBe(true);
  });
  it('done marker for THIS session wins over amr recovery', () => {
    expect(decideAuthGate({ ...base, amr: ['recovery'], stored: { status: 'done', userId: 'u1', sessionId: 's1' } }).locked).toBe(false);
  });
  it('done marker for another session does not unlock a new recovery session', () => {
    expect(decideAuthGate({ ...base, sessionId: 's2', amr: ['recovery'], stored: { status: 'done', userId: 'u1', sessionId: 's1' } }).locked).toBe(true);
  });
  it('stored lock keeps an amr-unknown session locked', () => {
    expect(decideAuthGate({ ...base, amr: null, stored: { status: 'locked', userId: 'u1', sessionId: 's1' } }).locked).toBe(true);
  });
  it('storage unavailable: falls back to amr; unknown amr fails closed', () => {
    expect(decideAuthGate({ ...base, amr: ['recovery'], stored: UNREADABLE }).locked).toBe(true);
    expect(decideAuthGate({ ...base, amr: null, stored: UNREADABLE }).locked).toBe(true);
    expect(decideAuthGate({ ...base, amr: ['password'], stored: UNREADABLE }).locked).toBe(false);
  });
  it('no session: unlocked and clears a stale record', () => {
    expect(decideAuthGate({ userId: null, stored: { status: 'locked', userId: 'u1' } })).toEqual({ locked: false, write: null });
  });
  it('ordinary password session: unlocked; another user\'s record is dropped', () => {
    expect(decideAuthGate({ ...base, amr: ['password'], stored: null })).toEqual({ locked: false, write: undefined });
    expect(decideAuthGate({ ...base, amr: ['password'], stored: { status: 'locked', userId: 'other' } })).toEqual({ locked: false, write: null });
  });
});

describe('recovery gate scenarios', () => {
  const landingFor = (s) => ({ type: 'recovery', accessToken: s.access_token });

  it('landing from the email link locks; no data loads', () => {
    const s = recoverySession();
    const tab = makeBrowser().openTab(landingFor(s));
    const app = makeApp(tab.gate);
    expect(app.apply('INITIAL', s)).toBe(true);
    expect(app.apply('PASSWORD_RECOVERY', s)).toBe(true);
    expect(app.apply('SIGNED_IN', s)).toBe(true); // tab-focus re-emit
    expect(app.apply('TOKEN_REFRESHED', s)).toBe(true);
    expect(app.loads).toEqual([]);
  });

  it('refresh: hash gone, lock persists from storage', () => {
    const b = makeBrowser(); const s = recoverySession();
    makeApp(b.openTab(landingFor(s)).gate).apply('PASSWORD_RECOVERY', s);
    const reloaded = makeApp(b.openTab(parseAuthHash('')).gate); // same storage, no hash, no event
    expect(reloaded.apply('INITIAL', s)).toBe(true);
    expect(reloaded.apply('SIGNED_IN', s)).toBe(true);
    expect(reloaded.loads).toEqual([]);
  });

  it('back button (popstate to hash-less URL) and deep link (/?x=1#/foo) stay locked', () => {
    const b = makeBrowser(); const s = recoverySession();
    makeApp(b.openTab(landingFor(s)).gate).apply('PASSWORD_RECOVERY', s);
    const back = makeApp(b.openTab(parseAuthHash('')).gate);
    expect(back.apply('INITIAL', s)).toBe(true);
    const deepHash = new URL('https://app.sk8happy.com/?x=1#/foo').hash;
    expect(parseAuthHash(deepHash)).toEqual({ type: null, accessToken: null });
    const deep = makeApp(b.openTab(parseAuthHash(deepHash)).gate);
    expect(deep.apply('INITIAL', s)).toBe(true);
    expect([...back.loads, ...deep.loads]).toEqual([]);
  });

  it('flag cleared / never written: amr recovery still locks (server truth)', () => {
    const b = makeBrowser(); const s = recoverySession();
    const app = makeApp(b.openTab().gate);
    expect(app.apply('INITIAL', s)).toBe(true);
    expect(JSON.parse(b.data.get(RECOVERY_LOCK_KEY)).status).toBe('locked');
  });

  it('new tab sees the lock; success in tab A unlocks tab B live via the storage event', () => {
    const b = makeBrowser(); const s = recoverySession();
    const a = b.openTab(landingFor(s)); const appA = makeApp(a.gate);
    appA.apply('PASSWORD_RECOVERY', s);
    const tB = b.openTab(); const appB = makeApp(tB.gate);
    expect(appB.apply('INITIAL', s)).toBe(true);
    const onChange = vi.fn(() => appB.apply('STORAGE', appB.state.session));
    subscribeLockChanges(tB.window, onChange);
    a.gate.complete(s); appA.apply('RECOVERY_COMPLETE', s); // updateUser success in tab A
    expect(onChange).toHaveBeenCalled();
    expect(appB.state.locked).toBe(false);
    expect(appA.loads).toEqual(['u1']);
    expect(appB.loads).toEqual(['u1']);
  });

  it('storage event locks an already-open tab live', () => {
    const b = makeBrowser(); const s = recoverySession();
    const tB = b.openTab(); const appB = makeApp(tB.gate);
    // Tab B somehow evaluated with an amr-less token first (unknown) -> unlocked, loads.
    const unknown = mkSession({ token: 'opaque' });
    expect(appB.apply('INITIAL', unknown)).toBe(false);
    subscribeLockChanges(tB.window, () => appB.apply('STORAGE', unknown));
    const a = b.openTab(landingFor(s));
    writeLock(a.storage, { v: 1, status: 'locked', userId: 'u1', sessionId: null });
    expect(appB.state.locked).toBe(true);
  });

  it('completed reset is NOT re-locked after refresh (amr still says recovery)', () => {
    const b = makeBrowser(); const s = recoverySession();
    const a = b.openTab(landingFor(s)); const app = makeApp(a.gate);
    app.apply('PASSWORD_RECOVERY', s);
    app.apply('USER_UPDATED', s); // fires inside updateUser, before success is handled
    a.gate.complete(s);
    expect(app.apply('RECOVERY_COMPLETE', s)).toBe(false);
    expect(app.apply('TOKEN_REFRESHED', s)).toBe(false);
    const reloaded = makeApp(b.openTab().gate);
    expect(reloaded.apply('INITIAL', s)).toBe(false);
    expect(reloaded.loads).toEqual(['u1']);
  });

  it('landing signal is one-shot: it cannot re-lock after completion in the same page', () => {
    const s = recoverySession();
    const t = makeBrowser().openTab(landingFor(s)); const app = makeApp(t.gate);
    app.apply('INITIAL', s); t.gate.complete(s);
    expect(app.apply('SIGNED_IN', s)).toBe(false);
  });

  it('landing hash only applies to the session it carried', () => {
    const t = makeBrowser().openTab({ type: 'recovery', accessToken: 'other-token' });
    expect(makeApp(t.gate).apply('INITIAL', passwordSession())).toBe(false);
  });

  it('a later NEW recovery link locks again', () => {
    const b = makeBrowser(); const s1 = recoverySession();
    const t = b.openTab(); t.gate.evaluate('PASSWORD_RECOVERY', s1); t.gate.complete(s1);
    const s2 = mkSession({ sessionId: 's2' });
    expect(makeApp(b.openTab().gate).apply('INITIAL', s2)).toBe(true);
  });

  it('sign-out clears the lock (and expired session clears it on next boot)', () => {
    const b = makeBrowser(); const s = recoverySession();
    const t = b.openTab(landingFor(s)); const app = makeApp(t.gate);
    app.apply('PASSWORD_RECOVERY', s);
    t.gate.clear(); app.apply('SIGNED_OUT', null);
    expect(b.data.has(RECOVERY_LOCK_KEY)).toBe(false);
    expect(app.state.locked).toBe(false);
    // expired: lock in storage but no session on boot
    writeLock(t.storage, { v: 1, status: 'locked', userId: 'u1', sessionId: 's1' });
    makeApp(b.openTab().gate).apply('INITIAL', null);
    expect(b.data.has(RECOVERY_LOCK_KEY)).toBe(false);
    // the same user then signing in with a password is not locked
    expect(makeApp(b.openTab().gate).apply('SIGNED_IN', passwordSession())).toBe(false);
  });

  it('storage unavailable: amr fallback locks, fails closed, in-memory completion unlocks this tab', () => {
    const s = recoverySession();
    const gate = createRecoveryGate({ getStorage: () => blockedStorage });
    const app = makeApp(gate);
    expect(app.apply('INITIAL', s)).toBe(true);
    expect(app.apply('INITIAL', mkSession({ token: 'opaque' }))).toBe(true); // unknown -> closed
    expect(makeApp(createRecoveryGate({ getStorage: () => null })).apply('INITIAL', s)).toBe(true);
    gate.complete(s);
    expect(app.apply('TOKEN_REFRESHED', s)).toBe(false);
  });

  it('ordinary login (signup confirm / magic link / password) is never locked and loads once per event', () => {
    const s = mkSession({ amr: [{ method: 'email/signup' }] });
    const app = makeApp(makeBrowser().openTab(parseAuthHash('#access_token=x&type=signup')).gate);
    expect(app.apply('INITIAL', s)).toBe(false);
    expect(app.apply('SIGNED_IN', s)).toBe(false);
    expect(app.loads.length).toBe(2); // context dedupes per user id
  });
});

describe('shouldLoadData (data-loading gate)', () => {
  it('blocks profile/reload/settings/table loads while locked or signed out', () => {
    expect(shouldLoadData({ session: recoverySession(), locked: true })).toBe(false);
    expect(shouldLoadData({ session: null, locked: false })).toBe(false);
    expect(shouldLoadData({ session: recoverySession(), locked: false })).toBe(true);
  });
});

describe('auth-link error landings', () => {
  const expired = 'https://app.sk8happy.com/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  it('parses otp_expired into a clear message', () => {
    const e = parseAuthError(expired);
    expect(e.code).toBe('otp_expired');
    expect(e.message).toMatch(/invalid or has expired/);
    expect(parseAuthError('https://app.sk8happy.com/?error=server_error&error_description=Oops').message).toMatch(/Oops/);
    expect(parseAuthError('https://app.sk8happy.com/#/foo')).toBeNull();
    expect(parseAuthError('https://app.sk8happy.com/')).toBeNull();
  });
  it('cleans the error out of the URL, keeps other params, drops a bare #', () => {
    expect(cleanAuthUrl(expired)).toBe('https://app.sk8happy.com/');
    expect(cleanAuthUrl('https://app.sk8happy.com/?x=1&error=a&error_code=b#')).toBe('https://app.sk8happy.com/?x=1');
    expect(cleanAuthUrl('https://app.sk8happy.com/#')).toBe('https://app.sk8happy.com/');
    expect(cleanAuthUrl('https://app.sk8happy.com/?x=1#/foo')).toBeNull();
    expect(cleanAuthUrl('https://app.sk8happy.com/')).toBeNull();
  });
});

describe('parseAuthHash', () => {
  it('reads type + access_token from an implicit-flow landing', () => {
    expect(parseAuthHash('#access_token=t&type=recovery')).toEqual({ type: 'recovery', accessToken: 't' });
    expect(parseAuthHash('#access_token=t&type=magiclink').type).toBe('magiclink');
    expect(parseAuthHash(undefined)).toEqual({ type: null, accessToken: null });
  });
});
