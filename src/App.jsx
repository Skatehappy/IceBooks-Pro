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
  const { styles: l, toast } = useApp();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
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
        <div style={l.authTabs}>
          <button type="button" style={{ ...l.authTab, ...(mode === 'signin' ? l.authTabActive : {}) }} onClick={() => setMode('signin')}>Sign In</button>
          <button type="button" style={{ ...l.authTab, ...(mode === 'signup' ? l.authTabActive : {}) }} onClick={() => setMode('signup')}>Sign Up</button>
        </div>
        {error && <div style={l.error}>{error}</div>}
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
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { styles: l, session, profile, booting, isCoach, tab, setTab, signOut } = useApp();

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
