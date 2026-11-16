import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { makeStyles } from './ui/styles.js';
import { toISODate } from './lib/format.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_MILEAGE_RATE, DEFAULT_LATE_CANCEL_HOURS } from './lib/constants.js';
import { isRecoveryHash } from './lib/passwordReset.js';

// Captured at module load, before supabase-js finishes processing (and clears) the URL hash, so a
// recovery landing shows the "Set a new password" screen from the first render.
const LANDED_ON_RECOVERY = typeof window !== 'undefined' && isRecoveryHash(window.location.hash);

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
  const [recovering, setRecovering] = useState(LANDED_ON_RECOVERY);
  const toastTimer = useRef(null);
  const profileRef = useRef(null);
  profileRef.current = profile;

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
    if (!p) return;
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
    let { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!p) {
      await new Promise((r) => setTimeout(r, 700));
      ({ data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
    }
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
    let loadedFor = null;
    const ensureProfile = (userId) => {
      if (loadedFor === userId) return;
      loadedFor = userId;
      // No profile yet (trigger lag) or an error: allow a later SIGNED_IN to retry.
      loadProfile(userId).then((p) => { if (!p && loadedFor === userId) loadedFor = null; }, () => { if (loadedFor === userId) loadedFor = null; });
    };
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) ensureProfile(s.user.id); else { setBooting(false); setRecovering(false); }
      // supabase-js clears the token hash via location.hash = '', which leaves a bare '#'; drop it.
      if (typeof window !== 'undefined' && window.location.href.endsWith('#')) {
        window.history.replaceState(window.history.state, '', window.location.href.slice(0, -1));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      // PASSWORD_RECOVERY carries a real session: load the profile as for SIGNED_IN (deduped per user id)
      // but keep the user on the reset screen until they set a new password or sign out.
      if (evt === 'PASSWORD_RECOVERY') setRecovering(true);
      if ((evt === 'SIGNED_IN' || evt === 'PASSWORD_RECOVERY') && s) { const id = s.user.id; setTimeout(() => ensureProfile(id), 0); }
      if (evt === 'SIGNED_OUT') { loadedFor = null; setRecovering(false); setProfile(null); setData(EMPTY); setSettings(DEFAULT_SETTINGS); setBooting(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

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

  const signOut = useCallback(async () => { setRecovering(false); await supabase.auth.signOut(); }, []);
  const finishRecovery = useCallback(() => setRecovering(false), []);
  const styles = useMemo(() => makeStyles(isMobile), [isMobile]);

  const value = {
    supabase, session, profile, isCoach, booting, data, settings, saveSettings,
    reload: () => reload(), toast, notify, nav, consumeNavParams, tab, setTab, isMobile, styles, signOut,
    recovering, finishRecovery,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div style={styles.toast}>{toastMsg}</div>}
    </Ctx.Provider>
  );
}
