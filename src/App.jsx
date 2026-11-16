import { useState } from 'react';
import { useApp } from './context.jsx';
import CalendarView from './views/CalendarView.jsx';
import ClientsView from './views/ClientsView.jsx';
import StudentsView from './views/StudentsView.jsx';
import MyStudentsView from './views/MyStudentsView.jsx';
import EventsView from './views/EventsView.jsx';
import VenuesView from './views/VenuesView.jsx';
import InvoicesView from './views/InvoicesView.jsx';
import ExpensesView from './views/ExpensesView.jsx';
import MileageView from './views/MileageView.jsx';
import ReportsView from './views/ReportsView.jsx';
import SettingsView from './views/SettingsView.jsx';
import Notifications from './ui/Notifications.jsx';
import { supabase } from './lib/supabase.js';
import { appBaseUrl } from './lib/authRedirect.js';
import { validateNewPassword, isRateLimitError, MIN_PASSWORD_LENGTH, RESET_SENT_MESSAGE } from './lib/passwordReset.js';

// Text-style button for in-card links ("Forgot password?", "Back to sign in").
const LINK_BTN = { background: 'none', border: 'none', padding: 0, color: '#7c3aed', cursor: 'pointer', fontSize: 14, fontWeight: 500 };

const COACH_TABS = [
  { id: 'calendar', label: '📅 Calendar', View: CalendarView },
  { id: 'clients', label: '👥 Clients', View: ClientsView },
  { id: 'students', label: '⛸️ Students', View: StudentsView },
  { id: 'events', label: '🏆 Events', View: EventsView },
  { id: 'venues', label: '🏟️ Venues', View: VenuesView },
  { id: 'invoices', label: '💵 Invoices', View: InvoicesView },
  { id: 'expenses', label: '📊 Expenses', View: ExpensesView },
  { id: 'mileage', label: '🚗 Mileage', View: MileageView },
  { id: 'reports', label: '📈 Reports', View: ReportsView },
  { id: 'settings', label: '⚙️ Settings', View: SettingsView },
];
const CLIENT_TABS = [
  { id: 'booking', label: '📅 Book Lessons', View: CalendarView },
  { id: 'mystudents', label: '⛸️ My Students', View: MyStudentsView },
  { id: 'events', label: '🏆 Events', View: EventsView },
];

function AuthScreen() {
  const { styles: l, toast, authError, dismissAuthError } = useApp();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m) => { setMode(m); setError(''); setNotice(''); dismissAuthError(); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    dismissAuthError();
    setBusy(true);
    try {
      if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appBaseUrl(window.location) });
        // Only a rate limit is surfaced; every other outcome gets the same neutral message (no account enumeration).
        if (err && isRateLimitError(err)) throw err;
        setNotice(RESET_SENT_MESSAGE);
      } else if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email, password, options: { data: { name }, emailRedirectTo: appBaseUrl(window.location) },
        });
        if (err) throw err;
        if (!data.session) {
          toast('Check your email to confirm your account!');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={l.authContainer}>
      <div style={l.authCard}>
        <div style={l.authLogo}>⛸️</div>
        <h1 style={l.authTitle}>IceBooks Pro</h1>
        <p style={l.authSub}>Figure Skating Coach Management</p>
        {mode !== 'reset' && (
          <div style={l.authTabs}>
            <button type="button" style={{ ...l.authTab, ...(mode === 'signin' ? l.authTabActive : {}) }} onClick={() => switchMode('signin')}>Sign In</button>
            <button type="button" style={{ ...l.authTab, ...(mode === 'signup' ? l.authTabActive : {}) }} onClick={() => switchMode('signup')}>Sign Up</button>
          </div>
        )}
        {mode === 'reset' && <h2 style={{ ...l.cardTitle, marginTop: 0, marginBottom: 8 }}>Reset your password</h2>}
        {!error && authError && <div style={l.error} role="alert">{authError}</div>}
        {error && <div style={l.error}>{error}</div>}
        {notice && <div style={{ ...l.error, ...l.badgeInfo }}>{notice}</div>}
        {mode === 'reset' ? (
          <form onSubmit={submit}>
            <p style={{ ...l.authSub, textAlign: 'left', marginTop: 0 }}>Enter your account email and we'll send you a link to set a new password.</p>
            <div style={l.formGroup}>
              <label style={l.label}>Email</label>
              <input style={l.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button type="submit" disabled={busy} style={{ ...l.btn, ...l.btnPrimary, width: '100%' }}>
              {busy ? 'Sending...' : 'Send reset link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" style={LINK_BTN} onClick={() => switchMode('signin')}>Back to sign in</button>
            </div>
          </form>
        ) : (
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div style={l.formGroup}>
              <label style={l.label}>Name</label>
              <input style={l.input} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </div>
          )}
          <div style={l.formGroup}>
            <label style={l.label}>Email</label>
            <input style={l.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>Password</label>
            <input style={l.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          <button type="submit" disabled={busy} style={{ ...l.btn, ...l.btnPrimary, width: '100%' }}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
          {mode === 'signin' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" style={LINK_BTN} onClick={() => switchMode('reset')}>Forgot password?</button>
            </div>
          )}
        </form>
        )}
      </div>
    </div>
  );
}

/** Shown instead of the app after landing from a password-reset email (the recovery session is live). */
function SetNewPasswordScreen() {
  const { styles: l, toast, finishRecovery, signOut } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const invalid = validateNewPassword(password, confirm);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      toast('Password updated');
      finishRecovery();
    } catch (err) {
      setError(err.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={l.authContainer}>
      <div style={l.authCard}>
        <div style={l.authLogo}>⛸️</div>
        <h1 style={l.authTitle}>IceBooks Pro</h1>
        <p style={l.authSub}>Set a new password</p>
        {error && <div style={l.error}>{error}</div>}
        <form onSubmit={submit}>
          <div style={l.formGroup}>
            <label style={l.label}>New password</label>
            <input style={l.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>Confirm new password</label>
            <input style={l.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </div>
          <button type="submit" disabled={busy} style={{ ...l.btn, ...l.btnPrimary, width: '100%' }}>
            {busy ? 'Saving...' : 'Set new password'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" style={LINK_BTN} onClick={signOut}>Cancel and sign out</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { styles: l, session, profile, booting, isCoach, tab, setTab, signOut, recovering } = useApp();

  // A recovery session is locked to the reset screen until the new password is saved (or sign-out).
  // Nothing else renders and nothing loads while locked (see recoveryLock.js / context.jsx).
  if (recovering) {
    if (session) return <SetNewPasswordScreen />;
    return <div style={l.loading}><div style={l.spinner}>⛸️</div><div>Loading...</div></div>;
  }
  if (booting) {
    return (
      <div style={l.loading}>
        <div style={l.spinner}>⛸️</div>
        <div>Loading...</div>
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  if (!profile) {
    return (
      <div style={l.loading}>
        <div>
          <p>We couldn't load your profile. Please sign out and try again.</p>
          <button style={{ ...l.btn, ...l.btnSecondary, marginTop: 12 }} onClick={signOut}>Sign Out</button>
        </div>
      </div>
    );
  }

  const tabs = isCoach ? COACH_TABS : CLIENT_TABS;
  const Active = (tabs.find((t) => t.id === tab) || tabs[0]).View;

  return (
    <div style={l.container}>
      <header style={l.header}>
        <div style={l.headerContent}>
          <div style={l.logo}>⛸️ IceBooks Pro</div>
          <div style={l.userInfo}>
            {isCoach && <Notifications />}
            <span>{profile.name}</span>
            <span style={{ ...l.badge, ...l.badgeInfo }}>{isCoach ? 'Coach' : 'Client'}</span>
            <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={signOut}>Sign Out</button>
          </div>
        </div>
      </header>
      <main style={l.main}>
        <nav style={l.nav}>
          {tabs.map((t) => (
            <button key={t.id} style={{ ...l.navBtn, ...(tab === t.id ? l.navBtnActive : {}) }} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <Active key={tab} />
      </main>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:hover { opacity: 0.9; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #7c3aed; }
      `}</style>
    </div>
  );
}
