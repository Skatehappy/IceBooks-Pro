// ROOT CAUSE: the "must set a new password" state was derived only from transient signals (the
// #type=recovery URL hash at first render and the one-shot PASSWORD_RECOVERY event) and kept in React
// memory, while the recovery link creates a REAL persisted session. Any reload, back button, deep link
// or new tab restores that session as an ordinary login with no hash/event, so the lock was gone and the
// full app + data loaded. FIX: persist the lock (localStorage, synced across tabs via 'storage') and back
// it with server truth (the access token's amr claim says 'recovery'); fail closed when unsure.
//
// AMR note: GoTrue issues a recovery session with amr [{method:'recovery'}] and the claim belongs to the
// session, so it stays 'recovery' for that session's whole life (updateUser({password}) and token refresh
// do not rewrite it; auth-js only passes the claim through). So "completed" cannot be read from the token:
// on a successful password save we store a 'done' marker keyed by the JWT session_id, and that marker wins
// over the amr claim for that one session. A new recovery link = new session_id = locked again.

export const RECOVERY_LOCK_KEY = 'icebooks.recovery.v1';
/** Returned by readLock when storage is blocked/throws (as opposed to null = readable but empty). */
export const UNREADABLE = 'UNREADABLE';
/** Session auth methods / landing hash types that must set a password before using the app. */
export const LOCKING_METHODS = ['recovery', 'invite'];

/** window.localStorage, or null when unavailable (accessing it can itself throw a SecurityError). */
export function browserStorage() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

/** Decode a JWT payload without verifying it (client-side hint only). Returns null when undecodable. */
export function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bin = atob(b64);
    const json = decodeURIComponent(Array.from(bin, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Facts about a supabase-js session used by the gate. amr is an array of method names, or null when the
 * token cannot be decoded / has no amr (unknown, not "no recovery").
 */
export function sessionFacts(session) {
  if (!session || !session.user) return { userId: null, sessionId: null, amr: null };
  const payload = decodeJwtPayload(session.access_token);
  let amr = null;
  if (payload && Array.isArray(payload.amr)) {
    amr = payload.amr.map((e) => (typeof e === 'string' ? e : e && e.method)).filter(Boolean);
  }
  return { userId: session.user.id, sessionId: (payload && payload.session_id) || null, amr };
}

/** Read the persisted lock record: object, null (none), or UNREADABLE. */
export function readLock(storage) {
  if (!storage) return UNREADABLE;
  try {
    const raw = storage.getItem(RECOVERY_LOCK_KEY);
    if (raw == null) return null;
    const rec = JSON.parse(raw);
    return rec && typeof rec === 'object' && rec.userId && (rec.status === 'locked' || rec.status === 'done') ? rec : null;
  } catch {
    return UNREADABLE;
  }
}

/** Write (record) or remove (null) the lock record. Returns false when storage is unavailable. */
export function writeLock(storage, record) {
  if (!storage) return false;
  try {
    if (record) storage.setItem(RECOVERY_LOCK_KEY, JSON.stringify(record));
    else storage.removeItem(RECOVERY_LOCK_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure decision: is this session locked to the "Set a new password" screen?
 * @param {{userId?: string|null, sessionId?: string|null, amr?: string[]|null, signal?: boolean, stored?: object|null|string}} f
 *   signal = a fresh recovery/invite signal (PASSWORD_RECOVERY event, or the landing hash for this exact token)
 *   stored = readLock() result (record | null | UNREADABLE)
 * @returns {{locked: boolean, write?: object|null}}  write: record to persist, null = clear, undefined = leave
 */
export function decideAuthGate({ userId = null, sessionId = null, amr = null, signal = false, stored = null } = {}) {
  const hasRecord = stored && stored !== UNREADABLE;
  // No session (signed out / expired): never locked; drop any lock record.
  if (!userId) return { locked: false, write: hasRecord ? null : undefined };
  const lockRecord = { v: 1, status: 'locked', userId, sessionId };
  const amrLocks = amr == null ? null : amr.some((m) => LOCKING_METHODS.includes(m));
  if (signal) return { locked: true, write: lockRecord };
  // Storage blocked/cleared-by-throw: server truth decides; unknown amr fails closed.
  if (stored === UNREADABLE) return { locked: amrLocks !== false };
  const mine = hasRecord && stored.userId === userId ? stored : null;
  if (mine && mine.status === 'done' && mine.sessionId === sessionId) return { locked: false };
  if (mine && mine.status === 'locked' && (!mine.sessionId || !sessionId || mine.sessionId === sessionId)) {
    return { locked: true };
  }
  if (amrLocks) return { locked: true, write: lockRecord };
  // No evidence of a recovery session: unlocked; drop a stale / other-user record.
  return { locked: false, write: hasRecord ? null : undefined };
}

/** Data (profile, reload, settings, tables) may load only for a session that is not locked. */
export function shouldLoadData({ session, locked }) {
  return !!(session && session.user && !locked);
}

/** Parse an auth landing hash: { type, accessToken } (both may be null). */
export function parseAuthHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (!h || h.startsWith('/')) return { type: null, accessToken: null };
  const p = new URLSearchParams(h);
  return { type: p.get('type'), accessToken: p.get('access_token') };
}

/**
 * Stateful per-tab gate around decideAuthGate. All lock state lives in storage (shared by tabs); the only
 * memory is a mirror used when storage is unwritable, and the one-shot landing-hash signal.
 * @param {{getStorage?: () => Storage|null, landing?: {type: string|null, accessToken: string|null}}} opts
 */
export function createRecoveryGate({ getStorage = browserStorage, landing = null } = {}) {
  let pendingLanding = landing && LOCKING_METHODS.includes(landing.type) && landing.accessToken ? landing.accessToken : null;
  let mem = null; // mirror of the last record we wrote (used only when storage can't be read)
  let locked = false;

  const persist = (record) => { mem = record || null; writeLock(getStorage(), record); };
  const read = () => {
    const stored = readLock(getStorage());
    return stored === UNREADABLE && mem ? mem : stored;
  };

  return {
    /** Re-evaluate for an auth event (or 'INITIAL' / 'STORAGE') and the current session. */
    evaluate(evt, session) {
      const facts = sessionFacts(session);
      let signal = evt === 'PASSWORD_RECOVERY' && !!facts.userId;
      // The landing hash counts only for the session it actually carried, and only once.
      if (pendingLanding && session && session.access_token === pendingLanding) { signal = true; pendingLanding = null; }
      const d = decideAuthGate({ ...facts, signal, stored: read() });
      if (d.write !== undefined) persist(d.write);
      locked = d.locked;
      return { locked };
    },
    /** updateUser({password}) succeeded: mark this session done (wins over its amr) and unlock. */
    complete(session) {
      const { userId, sessionId } = sessionFacts(session);
      if (userId) persist({ v: 1, status: 'done', userId, sessionId });
      locked = false;
      return { locked };
    },
    /** Sign-out: drop the lock record. */
    clear() { pendingLanding = null; persist(null); locked = false; },
    isLocked() { return locked; },
  };
}

/** Call cb when another tab changes the lock key (or clears storage). Returns an unsubscribe fn. */
export function subscribeLockChanges(target, cb) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const onStorage = (e) => { if (!e || e.key === RECOVERY_LOCK_KEY || e.key === null) cb(); };
  target.addEventListener('storage', onStorage);
  return () => target.removeEventListener('storage', onStorage);
}

// ---- Auth-link error landings (#error=access_denied&error_code=otp_expired&error_description=...) ----

const ERROR_KEYS = ['error', 'error_code', 'error_description', 'sb'];

/** Parse an auth error from a URL's hash or query string; null when none. */
export function parseAuthError(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, '').startsWith('/') ? '' : url.hash.replace(/^#/, ''));
  for (const p of [hashParams, url.searchParams]) {
    if (p.has('error') || p.has('error_code') || p.has('error_description')) {
      const code = p.get('error_code') || p.get('error') || 'unknown';
      return { code, message: authErrorMessage(code, p.get('error_description')) };
    }
  }
  return null;
}

/** User-facing text for an auth-link error. */
export function authErrorMessage(code, description) {
  if (code === 'otp_expired') return 'That email link is invalid or has expired. Please request a new one.';
  if (code === 'access_denied') return 'That email link could not be used. Please request a new one.';
  return description ? `Sign-in link error: ${description}` : 'That email link could not be used. Please request a new one.';
}

/**
 * The URL with auth error params removed (hash and query) and a bare trailing '#' dropped; returns null when
 * nothing needs cleaning. Success tokens are left for supabase-js (it clears those itself).
 */
export function cleanAuthUrl(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  let changed = false;
  const rawHash = url.hash.replace(/^#/, '');
  if (rawHash && !rawHash.startsWith('/')) {
    const hp = new URLSearchParams(rawHash);
    if (hp.has('error') || hp.has('error_code') || hp.has('error_description')) {
      ERROR_KEYS.forEach((k) => hp.delete(k));
      hp.delete('type');
      const rest = hp.toString();
      url.hash = rest ? `#${rest}` : '';
      changed = true;
    }
  }
  if (url.searchParams.has('error') || url.searchParams.has('error_code') || url.searchParams.has('error_description')) {
    ERROR_KEYS.forEach((k) => url.searchParams.delete(k));
    changed = true;
  }
  let out = url.toString();
  if (out.endsWith('#')) { out = out.slice(0, -1); changed = true; }
  return changed ? out : null;
}
