import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { makeStyles } from './ui/styles.js';
import { toISODate } from './lib/format.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_MILEAGE_RATE, DEFAULT_LATE_CANCEL_HOURS } from './lib/constants.js';
import {
  createRecoveryGate, browserStorage, parseAuthHash, parseAuthError, cleanAuthUrl, subscribeLockChanges, shouldLoadData,
  LOCKING_METHODS,
} from './lib/recoveryLock.js';

// Captured at module load, before supabase-js finishes processing (and clears) the URL hash. The landing
// hash is only a hint for the first render: the persisted lock + the token's amr claim are what keep a
// recovery session locked across reloads, back/forward, deep links and new tabs (see recoveryLock.js).
const LANDING = typeof window !== 'undefined' ? parseAuthHash(window.location.hash) : { type: null, accessToken: null };
const LANDED_LOCKED = LOCKING_METHODS.includes(LANDING.type) && !!LANDING.accessToken;
// An expired/invalid email link lands as #error=...&error_code=otp_expired; supabase-js leaves it in the URL.
const LANDING_AUTH_ERROR = typeof window !== 'undefined' ? parseAuthError(window.location.href) : null;

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const EMPTY = {
  lessons: [], events: [], venues: [], clients: [], students: [], bookings: [],
  invoices: [], invoicePayments: [], expenses: [], mileage: [], notifications: [],
};

/** Defaults used until/unless a settings row exists (a row is created on signup by the DB trigger). */
export const DEFAULT_SETTINGS = {
  payment_cash: false, payment_check: false, payment_venmo: '', payment_paypal: '', payment_zelle: '', payment_cashapp: '',
  coach_name: '', coach_email: '', coach_phone: '', coach_address: '',
  mileage_rate: DEFAULT_MILEAGE_RATE, vehicle_expense_method: 'standard',
  expense_categories: DEFAULT_EXPENSE_CATEGORIES, custom_lesson_types: [],
  late_cancel_hours: DEFAULT_LATE_CANCEL_HOURS, cancellation_policy: '',
};

const asJSON = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
  return v;
};

const normalizeSettings = (s) => ({
  ...DEFAULT_SETTINGS, ...s,
  expense_categories: asJSON(s?.expense_categories, DEFAULT_EXPENSE_CATEGORIES),
  custom_lesson_types: asJSON(s?.custom_lesson_types, []),
  mileage_rate: s?.mileage_rate != null ? Number(s.mileage_rate) : DEFAULT_MILEAGE_RATE,
});

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState(EMPTY);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toastMsg, setToastMsg] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [tab, setTab] = useState('calendar');
  const [navParams, setNavParams] = useState(null);
  // True while the user arrived via a password-reset link and hasn't set a new password yet.
  // App renders the reset screen instead of the app while this is set (it wins over SIGNED_IN).
  // Derived from the recovery gate (persisted lock + amr), never from the URL alone.
  const [recovering, setRecovering] = useState(LANDED_LOCKED);
  const [authError, setAuthError] = useState(LANDING_AUTH_ERROR ? LANDING_AUTH_ERROR.message : '');
  const toastTimer = useRef(null);
  const profileRef = useRef(null);
  profileRef.current = profile;
  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = createRecoveryGate({ getStorage: browserStorage, landing: LANDING });
  const lockedRef = useRef(LANDED_LOCKED);
  const sessionRef = useRef(null);
  const loadedForRef = useRef(null);
  const applyAuthRef = useRef(() => {});

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3500);
  }, []);

  /** Switch tab; params are read once by the target view via consumeNavParams(). */
  const nav = useCallback((t, params = null) => { setNavParams(params); setTab(t); }, []);
  const consumeNavParams = useCallback(() => {
    const p = navParams;
    if (p) setNavParams(null);
    return p;
  }, [navParams]);

  const isCoach = profile?.role === 'coach';

  const reload = useCallback(async (p = profileRef.current) => {
    if (!p || lockedRef.current) return; // never load data for a locked (recovery) session
    try {
      if (p.role === 'coach') {
        const q = (t, order, asc = true) => supabase.from(t).select('*').order(order, { ascending: asc });
        const [lessons, events, venues, clients, students, bookings, invoices, pays, expenses, mileage, notes, st] = await Promise.all([
          q('lessons', 'date'), q('events', 'start_date'), q('venues', 'name'), q('clients', 'name'), q('students', 'name'),
          supabase.from('bookings').select('*'), q('invoices', 'created_at', false),
          supabase.from('invoice_payments').select('*').order('paid_at'),
          q('expenses', 'date', false), q('mileage', 'date', false),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('settings').select('*').eq('coach_id', p.id).maybeSingle(),
        ]);
        let bk = bookings.data || [];
        // Auto-complete confirmed bookings whose lesson date has passed.
        const today = toISODate(new Date());
        const lessonById = new Map((lessons.data || []).map((l) => [l.id, l]));
        const past = bk.filter((b) => b.status === 'confirmed' && b.lesson_id && lessonById.get(b.lesson_id)?.date < today);
        if (past.length) {
          await supabase.from('bookings').update({ status: 'completed' }).in('id', past.map((b) => b.id));
          bk = bk.map((b) => (past.includes(b) ? { ...b, status: 'completed' } : b));
        }
        if (lockedRef.current) return;
        setData({
          lessons: lessons.data || [], events: events.data || [], venues: venues.data || [], clients: clients.data || [],
          students: students.data || [], bookings: bk, invoices: invoices.data || [], invoicePayments: pays.data || [],
          expenses: expenses.data || [], mileage: mileage.data || [], notifications: notes.data || [],
        });
        setSettings(normalizeSettings(st.data));
      } else {
        const [lessons, events, venues, clients, bookings, st] = await Promise.all([
          supabase.from('lessons').select('*').order('date'),
          supabase.from('events').select('*').order('start_date'),
          supabase.from('venues').select('*').order('name'),
          supabase.from('clients').select('*').eq('profile_id', p.id),
          supabase.from('bookings').select('*'),
          supabase.from('client_settings').select('*').maybeSingle(),
        ]);
        if (lockedRef.current) return;
        const ids = (clients.data || []).map((c) => c.id);
        let students = [];
        if (ids.length) students = (await supabase.from('students').select('*').in('client_id', ids).order('name')).data || [];
        setData({
          ...EMPTY, lessons: lessons.data || [], events: events.data || [], venues: venues.data || [],
          clients: clients.data || [], students, bookings: bookings.data || [],
        });
        setSettings(normalizeSettings(st.data));
      }
    } catch (e) {
      console.error('Load error:', e);
      toast('Error loading data');
    }
  }, [toast]);

  const loadProfile = useCallback(async (userId) => {
    // The DB trigger creates the profile (and, for the first account, the coach + settings rows) at signup.
    if (lockedRef.current) return null;
    let { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!p) {
      await new Promise((r) => setTimeout(r, 700));
      ({ data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
    }
    if (lockedRef.current) return null; // locked while the query was in flight: discard
    if (!p) { setProfile(null); setBooting(false); return null; }
    setProfile(p);
    setTab(p.role === 'coach' ? 'calendar' : 'booking');
    await reload(p);
    setBooting(false);
    return p;
  }, [reload]);

  useEffect(() => {
    // getSession() and the SIGNED_IN event both fire on boot (incl. an email-confirmation landing with
    // #access_token=...), and supabase-js re-emits SIGNED_IN whenever the tab becomes visible again.
    // Load the profile once per user id so those repeats don't re-fetch or reset the current tab.
    const ensureProfile = (userId) => {
      if (loadedForRef.current === userId || lockedRef.current) return;
      loadedForRef.current = userId;
      // No profile yet (trigger lag), an error, or locked mid-flight: allow a later event to retry.
      const retry = () => { if (loadedForRef.current === userId) loadedForRef.current = null; };
      loadProfile(userId).then((p) => { if (!p) retry(); }, retry);
    };
    const resetData = () => { loadedForRef.current = null; setProfile(null); setData(EMPTY); setSettings(DEFAULT_SETTINGS); };
    // Every auth signal (boot, any event, another tab's lock change, a finished reset) goes through the gate.
    const applyAuth = (evt, s) => {
      sessionRef.current = s;
      const { locked } = gateRef.current.evaluate(evt, s);
      lockedRef.current = locked;
      setRecovering(locked);
      setSession(s);
      if (!s) { resetData(); setBooting(false); return; }
      if (locked) { resetData(); setBooting(false); return; } // reset screen only; nothing loads
      if (shouldLoadData({ session: s, locked })) {
        // Just unlocked (or first load): show the spinner, not "couldn't load your profile", while loading.
        if (loadedForRef.current !== s.user.id) setBooting(true);
        setTimeout(() => ensureProfile(s.user.id), 0);
      }
    };
    applyAuthRef.current = applyAuth;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      applyAuth('INITIAL', s);
      if (typeof window !== 'undefined') {
        // Drop error params from an expired/invalid email link, and the bare '#' supabase-js leaves behind.
        const cleaned = cleanAuthUrl(window.location.href);
        if (cleaned) window.history.replaceState(window.history.state, '', cleaned);
        if (LANDING_AUTH_ERROR && s) toast(LANDING_AUTH_ERROR.message);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === 'SIGNED_OUT') gateRef.current.clear();
      applyAuth(evt, s);
    });
    // Another tab locked / finished / signed out: re-evaluate against our current session.
    const unsubscribeLock = subscribeLockChanges(typeof window !== 'undefined' ? window : null, () => {
      if (sessionRef.current) applyAuth('STORAGE', sessionRef.current);
    });
    return () => { subscription.unsubscribe(); unsubscribeLock(); };
  }, [loadProfile, toast]);

  /** Save settings by UPSERT on coach_id (the row exists from signup; upsert also heals a missing row). */
  const saveSettings = useCallback(async (patch) => {
    if (!profile || profile.role !== 'coach') throw new Error('Only the coach can change settings');
    const { data: saved, error } = await supabase
      .from('settings').upsert({ coach_id: profile.id, ...patch }, { onConflict: 'coach_id' }).select().single();
    if (error) throw error;
    setSettings(normalizeSettings(saved));
    return saved;
  }, [profile]);

  /** Create a coach-facing notification (client bookings/registrations). */
  const notify = useCallback(async (type, message, { lessonId = null, eventId = null, studentId = null } = {}) => {
    const { error } = await supabase.from('notifications').insert({
      type, message, lesson_id: lessonId, event_id: eventId, student_id: studentId, read: false,
    });
    if (!error) reload();
  }, [reload]);

  // The lock is cleared by the SIGNED_OUT event (this tab, and other tabs via supabase-js's BroadcastChannel).
  // If sign-out fails the session is still stored, so stay gated on it (re-evaluated, fails closed).
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { toast('Could not sign out. Please try again.'); applyAuthRef.current('SIGNOUT_FAILED', sessionRef.current); }
  }, [toast]);
  /** Call only after updateUser({ password }) succeeded: unlock this session (in every tab) and load the app. */
  const finishRecovery = useCallback(() => {
    const s = sessionRef.current;
    gateRef.current.complete(s);
    applyAuthRef.current('RECOVERY_COMPLETE', s);
  }, []);
  const dismissAuthError = useCallback(() => setAuthError(''), []);
  const styles = useMemo(() => makeStyles(isMobile), [isMobile]);

  const value = {
    supabase, session, profile, isCoach, booting, data, settings, saveSettings,
    reload: () => reload(), toast, notify, nav, consumeNavParams, tab, setTab, isMobile, styles, signOut,
    recovering, finishRecovery, authError, dismissAuthError,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div style={styles.toast}>{toastMsg}</div>}
    </Ctx.Provider>
  );
}
