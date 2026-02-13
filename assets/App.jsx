/**
 * IceBooks Pro v4.5.2
 * Complete Figure Skating Coach Business Management
 * © 2026 The Super Simple Software Company
 * Distributed by BuyAppsOnce | https://buyappsonce.com
 * 
 * FEATURES:
 * - Coach & Client authentication (first user = coach)
 * - Calendar with Month/Week/Day view toggle
 * - Day view shows all bookings with student details and parent contact
 * - Print Day Schedule button for easy roster printing
 * - Venue-specific colors (small dot indicator on calendar lessons)
 * - ICS Export/Import for Google/Outlook/Apple Calendar
 * - Live Sync subscription URL
 * - Copy Day / Copy Week scheduling
 * - Client/Student management with full contact info
 * - Student email for self-login (auto-links on signup)
 * - ISI and USFSA levels (separate fields)
 * - Booking system (clients book via month calendar)
 * - Competition registration (visible in client Events tab)
 * - Notifications for coach (bookings, registrations) with unread count
 * - Late cancellation tracking (24hr policy)
 * - Invoice generation from lessons + late cancels
 * - Email invoices via Resend
 * - Custom lesson types via "Add New" option
 * - Multiple payment methods (Cash, Check, Venmo, PayPal, Zelle, CashApp)
 * - Expense tracking
 * - Mileage logging (manual + odometer)
 * - Publish for booking defaults to OFF
 * - Mobile responsive
 */
import React, { useState, useEffect } from 'react';
const { createClient } = window.supabase || { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }, from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [] }), eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }), single: () => Promise.resolve({ data: null }) }) }) }) };

// Runtime config (from config.js) or build-time env vars
const supabaseUrl = window.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = window.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MILEAGE_RATE = 0.70; // 2025 IRS rate
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CANCELLATION_WINDOW_HOURS = 24;

const LESSON_TYPES = [
  { id: 'private', name: 'Private', icon: '👤', color: '#3b82f6', max: 1, rate: 75 },
  { id: 'shared', name: 'Shared', icon: '👥', color: '#8b5cf6', max: 2, rate: 50 },
  { id: 'group', name: 'Group', icon: '👨‍👩‍👧‍👦', color: '#10b981', max: 8, rate: 35 }
];

const EVENT_TYPES = [
  { id: 'competition', name: 'Competition', icon: '🏆', color: '#f59e0b' },
  { id: 'show', name: 'Ice Show', icon: '⭐', color: '#ec4899' },
  { id: 'testing', name: 'Testing', icon: '📋', color: '#14b8a6' },
  { id: 'personal', name: 'Personal', icon: '📅', color: '#6366f1' },
  { id: 'blocked', name: 'Blocked', icon: '🚫', color: '#ef4444' }
];

const EXPENSE_CATEGORIES = [
  'Ice Time', 'Music/Choreography', 'Costumes', 'Equipment', 'Travel', 
  'Training/Seminars', 'Coaching Fees', 'Membership Dues', 'Insurance', 'Other'
];

const PAYMENT_METHODS = ['Cash', 'Check', 'Venmo', 'PayPal', 'Zelle', 'Credit Card', 'Bank Transfer'];

// ISI Levels - Primary Freestyle Progression
const ISI_FREESTYLE_LEVELS = [
  'Tots', 'Pre-Alpha', 'Alpha', 'Beta', 'Gamma', 'Delta',
  'Freestyle 1', 'Freestyle 2', 'Freestyle 3', 'Freestyle 4', 'Freestyle 5', 
  'Freestyle 6', 'Freestyle 7', 'Freestyle 8', 'Freestyle 9', 'Freestyle 10',
  'Open Freestyle Bronze', 'Open Freestyle Silver', 'Open Freestyle Gold', 'Open Freestyle Platinum'
];

// ISI Figures (1-10)
const ISI_FIGURES_LEVELS = Array.from({length: 10}, (_, i) => `Figures ${i + 1}`);

// ISI Couples (1-10)
const ISI_COUPLES_LEVELS = Array.from({length: 10}, (_, i) => `Couples ${i + 1}`);

// ISI Pairs (1-10)
const ISI_PAIRS_LEVELS = Array.from({length: 10}, (_, i) => `Pairs ${i + 1}`);

// ISI Ice Dance (1-10)
const ISI_ICEDANCE_LEVELS = Array.from({length: 10}, (_, i) => `Ice Dance ${i + 1}`);

// ISI International Dance (USFSA Pattern Dances in proper order)
const ISI_INTERNATIONAL_DANCE_PRELIMINARY = ['Dutch Waltz', 'Canasta Tango', 'Rhythm Blues'];
const ISI_INTERNATIONAL_DANCE_PREBRONZE = ['Swing Dance', 'Cha Cha', 'Fiesta Tango'];
const ISI_INTERNATIONAL_DANCE_BRONZE = ['Hickory Hoedown', 'Willow Waltz', 'Ten-Fox'];
const ISI_INTERNATIONAL_DANCE_PRESILVER = ['Fourteenstep', 'European Waltz', 'Foxtrot'];
const ISI_INTERNATIONAL_DANCE_SILVER = ['American Waltz', 'Tango', 'Rocker Foxtrot'];
const ISI_INTERNATIONAL_DANCE_PREGOLD = ['Kilian', 'Blues', 'Paso Doble', 'Starlight Waltz'];
const ISI_INTERNATIONAL_DANCE_GOLD = ['Viennese Waltz', 'Westminster Waltz', 'Quickstep', 'Argentine Tango'];
const ISI_INTERNATIONAL_DANCE_INTERNATIONAL = [
  'Austrian Waltz', 'Cha Cha Congelado', 'Finnstep', 'Golden Waltz', 
  'Midnight Blues', 'Ravensburger Waltz', 'Rhumba', 'Silver Samba', 
  'Tango Romantica', 'Yankee Polka'
];

// ISI Free Dance Partnered (1-10)
const ISI_FREEDANCE_PARTNERED_LEVELS = Array.from({length: 10}, (_, i) => `Free Dance Partnered ${i + 1}`);

// ISI Open Solo Free Dance (Bronze through Diamond)
const ISI_SOLO_FREEDANCE_LEVELS = [
  'Open Solo Free Dance Bronze',
  'Open Solo Free Dance Silver', 
  'Open Solo Free Dance Gold',
  'Open Solo Free Dance Platinum',
  'Open Solo Free Dance Diamond'
];

// ISI Synchronized Skating (1-4)
const ISI_SYNCHRO_LEVELS = Array.from({length: 4}, (_, i) => `Synchro ${i + 1}`);

// ISI Special Skater (1-10)
const ISI_SPECIAL_SKATER_LEVELS = Array.from({length: 10}, (_, i) => `Special Skater ${i + 1}`);

// USFSA Test Levels - Skating Skills (Moves in the Field)
const USFSA_SKATING_SKILLS = [
  'Pre-Preliminary', 'Preliminary', 'Pre-Juvenile', 'Juvenile', 
  'Intermediate', 'Novice', 'Junior', 'Senior'
];

// USFSA Test Levels - Singles (Free Skate)
const USFSA_SINGLES = [
  'Pre-Preliminary', 'Preliminary', 'Pre-Juvenile', 'Juvenile', 
  'Intermediate', 'Novice', 'Junior', 'Senior'
];

// USFSA Pattern Dance Levels
const USFSA_PATTERN_DANCE = [
  'Preliminary', 'Pre-Bronze', 'Bronze', 'Pre-Silver', 
  'Silver', 'Pre-Gold', 'Gold', 'International'
];

// USFSA Free Dance Levels
const USFSA_FREE_DANCE = [
  'Juvenile/Bronze', 'Intermediate/Pre-Silver', 'Novice/Silver', 
  'Junior/Pre-Gold', 'Senior/Gold'
];

// USFSA Pairs Levels
const USFSA_PAIRS = [
  'Preliminary', 'Juvenile', 'Intermediate', 
  'Novice', 'Junior', 'Senior'
];

// Adult Track Options
const USFSA_ADULT_LEVELS = [
  'Adult Pre-Bronze', 'Adult Bronze', 'Adult Silver', 'Adult Gold',
  'Adult Intermediate', 'Adult Novice', 'Adult Junior', 'Adult Senior'
];

// USFSA / Learn to Skate USA Levels
const USFSA_LEVELS = [
  '-- Snowplow Sam --', 'Snowplow 1', 'Snowplow 2', 'Snowplow 3', 'Snowplow 4',
  '-- Basic Skills --', 'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6',
  '-- Free Skate --', 'Pre-Free Skate', 'Free Skate 1', 'Free Skate 2', 'Free Skate 3', 'Free Skate 4', 'Free Skate 5', 'Free Skate 6',
  '-- Test Track --', 'Pre-Preliminary', 'Preliminary', 'Pre-Juvenile', 'Juvenile', 'Intermediate', 'Novice', 'Junior', 'Senior'
];

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function App() {
  // Auth & Profile State
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState('calendar');
  const [toast, setToast] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Data State
  const [lessons, setLessons] = useState([]);
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [venues, setVenues] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [rates, setRates] = useState([]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState(isMobile ? 'day' : 'week');
  const [selectedDate, setSelectedDate] = useState(isMobile ? new Date() : null); // For day view
  
  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Custom Lesson Types State
  const [customLessonTypes, setCustomLessonTypes] = useState([]);
  const [showAddLessonType, setShowAddLessonType] = useState(false);
  const [newLessonType, setNewLessonType] = useState({ name: '', icon: '📚', color: '#3b82f6', max: 1, rate: 50 });

  // Modal State
  const [showModal, setShowModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Lesson Form State
  const [lessonForm, setLessonForm] = useState({
    date: '', start_time: '09:00', end_time: '09:30', lesson_type: 'private',
    venue_id: '', max_students: 1, is_published: false, notes: '', rate: 75
  });

  // Event Form State
  const [eventForm, setEventForm] = useState({
    name: '', event_type: 'competition', start_date: '', end_date: '',
    venue_id: '', notes: '', is_registrable: false
  });

  // Client Form State
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', state: '', zip: '',
    parent2_name: '', parent2_email: '', parent2_phone: '', notes: '',
    // Child fields for auto-creating student - NO skill levels (those go on student form only)
    child_name: '', child_email: '', child_birthdate: ''
  });

  // Student Form State
  const [studentForm, setStudentForm] = useState({
    client_id: '', name: '', email: '', birthdate: '',
    // ISI Disciplines
    isi_freestyle: '',
    isi_figures: '',
    isi_couples: '',
    isi_pairs: '',
    isi_icedance: '',
    isi_international_dance_level: '',  // Stores which level (Preliminary, Pre-Bronze, etc.)
    isi_international_dances: '',       // Stores specific dances passed
    isi_freedance_partnered: '',
    isi_solo_freedance: '',
    isi_synchro: '',
    isi_special_skater: '',
    isi_number: '',
    // USFSA Disciplines
    usfsa_skating_skills: '',
    usfsa_singles: '',
    usfsa_pattern_dance_level: '',      // Stores which level
    usfsa_pattern_dances: '',           // Stores specific dances passed
    usfsa_free_dance: '',
    usfsa_pairs: '',
    usfsa_number: '',
    notes: ''
  });

  // Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: '', lessons: [], lateCancellations: [], amount: 0, tax_rate: 0, notes: '', due_date: '',
    payment_cash: false, payment_check: false, payment_venmo: '', payment_paypal: '', payment_zelle: '', payment_cashapp: ''
  });

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    date: '', category: 'Ice Time', description: '', amount: '', vendor: '', payment_method: 'Credit Card'
  });

  // Mileage Form State
  const [mileageForm, setMileageForm] = useState({
    date: '', description: '', miles: '', rate: DEFAULT_MILEAGE_RATE,
    odometer_start: '', odometer_end: '', entry_type: 'manual'
  });

  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState({
    cash: false, check: false, venmo: '', paypal: '', zelle: '', cashapp: ''
  });

  // Copy Day/Week State
  const [copySource, setCopySource] = useState(null);
  const [copyTargetDays, setCopyTargetDays] = useState([]);
  const [copyWeeks, setCopyWeeks] = useState(1);

  // Competition Registration State
  const [registerCompetition, setRegisterCompetition] = useState(null);
  const [registerStudentId, setRegisterStudentId] = useState('');

  // Client Booking State
  const [bookingLesson, setBookingLesson] = useState(null);

  // Computed
  const isCoach = profile?.role === 'coach';

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ============================================
  // AUTH FUNCTIONS
  // ============================================

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      if (error) throw error;
      setProfile(data);
      loadData(data);
    } catch (err) {
      console.error('Profile load error:', err);
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { name: authName } }
      });
      if (error) throw error;
      notify('Check your email to confirm your account!');
      setAuthMode('signin');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthError('');
    setActiveTab('calendar');
  };

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = async (prof) => {
    try {
      setLoading(true);
      const promises = [
        supabase.from('lessons').select('*').order('date'),
        supabase.from('events').select('*').order('start_date'),
        supabase.from('venues').select('*').order('name'),
        supabase.from('rates').select('*')
      ];

      if (prof.role === 'coach') {
        promises.push(
          supabase.from('clients').select('*').order('name'),
          supabase.from('students').select('*').order('name'),
          supabase.from('bookings').select('*'),
          supabase.from('invoices').select('*').order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').order('date', { ascending: false }),
          supabase.from('mileage').select('*').order('date', { ascending: false })
        );
      } else {
        // Client: load their own clients/students
        const { data: clientsData } = await supabase.from('clients').select('*').eq('profile_id', prof.id);
        const clientIds = (clientsData || []).map(c => c.id);
        
        let studentsData = [];
        if (clientIds.length > 0) {
          const { data } = await supabase.from('students').select('*').in('client_id', clientIds);
          studentsData = data || [];
        }
        
        promises.push(
          Promise.resolve({ data: clientsData }),
          Promise.resolve({ data: studentsData }),
          supabase.from('bookings').select('*')
        );
      }

      const results = await Promise.all(promises);
      setLessons(results[0].data || []);
      setEvents(results[1].data || []);
      setVenues(results[2].data || []);
      setRates(results[3].data || []);

      if (prof.role === 'coach') {
        setClients(results[4].data || []);
        setStudents(results[5].data || []);
        setBookings(results[6].data || []);
        setInvoices(results[7].data || []);
        setExpenses(results[8].data || []);
        setMileage(results[9].data || []);
        
        // Load payment settings for coach
        const { data: settings } = await supabase.from('settings').select('*').single();
        if (settings) {
          setPaymentSettings({
            cash: settings.payment_cash || false,
            check: settings.payment_check || false,
            venmo: settings.payment_venmo || '',
            paypal: settings.payment_paypal || '',
            zelle: settings.payment_zelle || '',
            cashapp: settings.payment_cashapp || ''
          });
          
          // Load custom lesson types
          if (settings.custom_lesson_types) {
            try {
              setCustomLessonTypes(JSON.parse(settings.custom_lesson_types));
            } catch (e) {
              console.error('Error parsing custom lesson types:', e);
            }
          }
        }
        
        // Load notifications
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        setNotifications(notifs || []);
      } else {
        setClients(results[4].data || []);
        setStudents(results[5].data || []);
        setBookings(results[6].data || []);
      }
    } catch (err) {
      console.error('Load error:', err);
      notify('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const formatDate = (d) => new Date(d).toLocaleDateString();
  
  // Timezone-safe date string (YYYY-MM-DD) - avoids UTC conversion issues
  const toDateStr = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  const getWeekDates = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      return dt;
    });
  };

  const getDays = (month) => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const days = [];
    // Previous month days
    for (let i = firstDay.getDay() - 1; i >= 0; i--) {
      days.push({ date: new Date(year, m, -i), outside: true });
    }
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, m, i), outside: false });
    }
    // Next month days (fill to 42 for 6 rows)
    while (days.length < 42) {
      days.push({ date: new Date(year, m + 1, days.length - lastDay.getDate() - firstDay.getDay() + 1), outside: true });
    }
    return days;
  };

  const getLessonType = (id) => {
    const custom = customLessonTypes.find(t => t.id === id);
    if (custom) return custom;
    return LESSON_TYPES.find(t => t.id === id) || LESSON_TYPES[0];
  };
  const getEventType = (id) => EVENT_TYPES.find(t => t.id === id) || EVENT_TYPES[0];
  
  // Get all lesson types (built-in + custom)
  const getAllLessonTypes = () => [...LESSON_TYPES, ...customLessonTypes];
  
  // Notification helpers
  const createNotification = async (type, message, lessonId = null, eventId = null, studentId = null) => {
    try {
      const { error } = await supabase.from('notifications').insert({
        type, message, lesson_id: lessonId, event_id: eventId, student_id: studentId, read: false
      });
      if (!error) loadData(profile); // Reload to get new notification
    } catch (err) {
      console.error('Notification error:', err);
    }
  };
  
  const markNotificationRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    loadData(profile);
  };
  
  const markAllNotificationsRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    loadData(profile);
  };
  
  // Save custom lesson types to settings
  const saveCustomLessonTypes = async (types) => {
    try {
      const { error } = await supabase.from('settings').update({
        custom_lesson_types: JSON.stringify(types)
      }).eq('id', 1);
      if (error) throw error;
      setCustomLessonTypes(types);
      notify('Custom lesson types saved');
    } catch (err) {
      notify('Error saving: ' + err.message);
    }
  };
  
  // Add new custom lesson type
  const addCustomLessonType = async () => {
    if (!newLessonType.name.trim()) {
      notify('Please enter a name');
      return;
    }
    const newType = {
      ...newLessonType,
      id: 'custom_' + Date.now()
    };
    const updated = [...customLessonTypes, newType];
    await saveCustomLessonTypes(updated);
    setNewLessonType({ name: '', icon: '📚', color: '#3b82f6', max: 1, rate: 50 });
    setShowAddLessonType(false);
  };
  
  // Print day schedule
  const printDaySchedule = () => {
    if (!selectedDate) return;
    const dateStr = selectedDate.toLocaleDateString();
    const dayLessons = lessons.filter(l => l.date === selectedDate.toISOString().split('T')[0]).sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    let html = `<!DOCTYPE html><html><head><title>Schedule - ${dateStr}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 20px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background: #f3f4f6; font-weight: 600; }
      .no-lessons { color: #6b7280; padding: 20px; }
    </style></head><body>
    <h1>IceBooks Pro - Schedule for ${dateStr}</h1>
    <table><thead><tr><th>Time</th><th>Lesson</th><th>Venue</th><th>Students</th><th>Parent Contact</th><th>Level</th></tr></thead><tbody>`;
    
    if (dayLessons.length === 0) {
      html += '<tr><td colspan="6" class="no-lessons">No lessons scheduled</td></tr>';
    } else {
      dayLessons.forEach(lesson => {
        const lt = getLessonType(lesson.lesson_type);
        const venue = venues.find(v => v.id === lesson.venue_id);
        const lessonBookings = bookings.filter(b => b.lesson_id === lesson.id && b.status !== 'cancelled');
        
        if (lessonBookings.length === 0) {
          html += `<tr><td>${lesson.start_time} - ${lesson.end_time}</td><td>${lt.icon} ${lt.name}</td><td>${venue?.name || ''}</td><td colspan="3" style="color: #9ca3af;">No bookings</td></tr>`;
        } else {
          lessonBookings.forEach((booking, idx) => {
            const student = students.find(s => s.id === booking.student_id);
            const client = clients.find(c => c.id === student?.client_id);
            if (idx === 0) {
              html += `<tr><td rowspan="${lessonBookings.length}">${lesson.start_time} - ${lesson.end_time}</td><td rowspan="${lessonBookings.length}">${lt.icon} ${lt.name}</td><td rowspan="${lessonBookings.length}">${venue?.name || ''}</td>`;
            } else {
              html += '<tr>';
            }
            html += `<td>${student?.name || 'Unknown'}</td><td>${client?.name || ''}<br/>${client?.phone || ''}</td><td>${student?.isi_level || student?.usfsa_level || ''}</td></tr>`;
          });
        }
      });
    }
    
    html += '</tbody></table></body></html>';
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  // ============================================
  // ICS CALENDAR FUNCTIONS
  // ============================================

  const generateICS = () => {
    const items = [];
    
    // Add lessons
    lessons.forEach(l => {
      const lt = getLessonType(l.lesson_type);
      const venue = venues.find(v => v.id === l.venue_id);
      const lessonBookings = bookings.filter(b => b.lesson_id === l.id && b.status !== 'cancelled');
      const bookedNames = lessonBookings.map(b => students.find(s => s.id === b.student_id)?.name).filter(Boolean).join(', ');
      const dateStr = l.date.replace(/-/g, '');
      const startStr = l.start_time.replace(/:/g, '') + '00';
      const endStr = l.end_time.replace(/:/g, '') + '00';
      
      items.push([
        'BEGIN:VEVENT',
        `UID:icebooks-lesson-${l.id}@icebooks`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dateStr}T${startStr}`,
        `DTEND:${dateStr}T${endStr}`,
        `SUMMARY:${lt.icon} ${lt.name}${bookedNames ? ` - ${bookedNames}` : ''}`,
        `LOCATION:${venue?.name || ''}`,
        `STATUS:${l.is_published ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT'
      ].join('\r\n'));
    });
    
    // Add events
    events.forEach(e => {
      const et = getEventType(e.event_type);
      const dateStr = e.start_date.replace(/-/g, '');
      const endDateStr = (e.end_date || e.start_date).replace(/-/g, '');
      
      items.push([
        'BEGIN:VEVENT',
        `UID:icebooks-event-${e.id}@icebooks`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${endDateStr}`,
        `SUMMARY:${et.icon} ${e.name}`,
        `DESCRIPTION:${e.notes || ''}`,
        'END:VEVENT'
      ].join('\r\n'));
    });
    
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//IceBooks Pro//EN',
      'X-WR-CALNAME:IceBooks Schedule',
      'METHOD:PUBLISH',
      ...items,
      'END:VCALENDAR'
    ].join('\r\n');
  };

  const exportICS = () => {
    const ics = generateICS();
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icebooks-${new Date().toISOString().split('T')[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Calendar exported! Import into Google/Outlook/Apple Calendar.');
  };

  const importICS = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const content = await file.text();
    const importedEvents = [];
    let curr = null;
    
    content.split(/\r?\n/).forEach(line => {
      if (line.startsWith('BEGIN:VEVENT')) {
        curr = {};
      } else if (line.startsWith('END:VEVENT') && curr?.date) {
        importedEvents.push(curr);
        curr = null;
      } else if (curr) {
        if (line.startsWith('SUMMARY:')) {
          curr.name = line.slice(8).replace(/\\,/g, ',').replace(/\\n/g, ' ');
        } else if (line.startsWith('DTSTART')) {
          const v = line.split(':').pop().replace(/[^0-9T]/g, '');
          if (v.length >= 8) {
            curr.date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
            if (v.includes('T') && v.length >= 13) {
              curr.start_time = `${v.split('T')[1].slice(0, 2)}:${v.split('T')[1].slice(2, 4)}`;
            }
          }
        } else if (line.startsWith('DTEND') && line.includes('T')) {
          const v = line.split(':').pop().replace(/[^0-9T]/g, '');
          if (v.length >= 13) {
            curr.end_time = `${v.split('T')[1].slice(0, 2)}:${v.split('T')[1].slice(2, 4)}`;
          }
        } else if (line.startsWith('LOCATION:')) {
          curr.location = line.slice(9).replace(/\\,/g, ',');
        }
      }
    });
    
    // Import as events (user can convert to lessons manually)
    let imported = 0;
    for (const ev of importedEvents) {
      if (ev.name && ev.date) {
        const { error } = await supabase.from('events').insert({
          name: ev.name.slice(0, 100),
          event_type: 'personal',
          start_date: ev.date,
          end_date: ev.date,
          notes: `Imported from ICS${ev.location ? ` - Location: ${ev.location}` : ''}`
        });
        if (!error) imported++;
      }
    }
    
    if (imported > 0) {
      notify(`Imported ${imported} events! Check the Events tab.`);
      loadData();
    } else {
      notify('No events found in file.');
    }
    
    e.target.value = '';
  };

  const getLiveSyncUrl = () => {
    // Generate a subscription URL for external calendars
    const baseUrl = window.location.origin + window.location.pathname;
    const token = session?.access_token?.slice(0, 20) || 'demo';
    return `${supabaseUrl}/functions/v1/calendar-feed?token=${token}`;
  };

  const copyLiveSyncUrl = () => {
    const url = getLiveSyncUrl();
    navigator.clipboard.writeText(url).then(() => {
      notify('Live Sync URL copied! Paste into Google Calendar or Outlook.');
    }).catch(() => {
      prompt('Copy this URL:', url);
    });
  };

  // ============================================
  // LESSON CRUD
  // ============================================

  const openLessonModal = (lesson = null, date = null) => {
    if (lesson) {
      setEditingItem(lesson);
      setLessonForm({
        date: lesson.date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        lesson_type: lesson.lesson_type,
        venue_id: lesson.venue_id || '',
        max_students: lesson.max_students,
        is_published: lesson.is_published,
        notes: lesson.notes || '',
        rate: lesson.rate || getLessonType(lesson.lesson_type).rate
      });
    } else {
      setEditingItem(null);
      const dateStr = date ? toDateStr(date) : toDateStr(new Date());
      setLessonForm({
        date: dateStr,
        start_time: '09:00',
        end_time: '09:30',
        lesson_type: 'private',
        venue_id: venues[0]?.id || '',
        max_students: 1,
        is_published: true,
        notes: '',
        rate: 75
      });
    }
    setShowModal('lesson');
  };

  const saveLesson = async () => {
    try {
      const data = { ...lessonForm, venue_id: lessonForm.venue_id || null };
      if (editingItem) {
        const { error } = await supabase.from('lessons').update(data).eq('id', editingItem.id);
        if (error) throw error;
        notify('Lesson updated');
      } else {
        const { error } = await supabase.from('lessons').insert(data);
        if (error) throw error;
        notify('Lesson created');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteLesson = async (id) => {
    if (!confirm('Delete this lesson?')) return;
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
      notify('Lesson deleted');
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // COPY DAY / COPY WEEK
  // ============================================

  const openCopyDay = (date) => {
    setCopySource(date);
    setCopyTargetDays([]);
    setShowModal('copyDay');
  };

  const executeCopyDay = async () => {
    if (!copySource || copyTargetDays.length === 0) return;
    try {
      const sourceStr = toDateStr(copySource);
      const sourceLessons = lessons.filter(l => l.date === sourceStr);
      
      if (sourceLessons.length === 0) {
        notify('No lessons to copy');
        return;
      }

      const weekDates = getWeekDates(copySource);
      let copied = 0, skipped = 0;

      for (const dayIdx of copyTargetDays) {
        const targetDate = toDateStr(weekDates[dayIdx]);
        const existingTimes = lessons.filter(l => l.date === targetDate).map(l => `${l.start_time}-${l.end_time}`);

        for (const lesson of sourceLessons) {
          const timeKey = `${lesson.start_time}-${lesson.end_time}`;
          if (existingTimes.includes(timeKey)) {
            skipped++;
            continue;
          }
          const { id, created_at, ...lessonData } = lesson;
          await supabase.from('lessons').insert({ ...lessonData, date: targetDate, is_published: false });
          copied++;
        }
      }

      notify(`Copied ${copied} lessons${skipped > 0 ? `, skipped ${skipped} conflicts` : ''}`);
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const openCopyWeek = () => {
    setCopyWeeks(1);
    setShowModal('copyWeek');
  };

  const executeCopyWeek = async () => {
    try {
      const weekDates = getWeekDates(currentDate);
      const startStr = toDateStr(weekDates[0]);
      const endStr = toDateStr(weekDates[6]);
      const weekLessons = lessons.filter(l => l.date >= startStr && l.date <= endStr);

      if (weekLessons.length === 0) {
        notify('No lessons to copy');
        return;
      }

      let copied = 0, skipped = 0;

      for (let week = 1; week <= copyWeeks; week++) {
        for (const lesson of weekLessons) {
          const lessonDate = new Date(lesson.date + 'T00:00:00');
          const newDate = new Date(lessonDate);
          newDate.setDate(lessonDate.getDate() + (week * 7));
          const newDateStr = toDateStr(newDate);

          // Check for conflicts
          const conflict = lessons.find(l => 
            l.date === newDateStr && 
            l.start_time === lesson.start_time && 
            l.end_time === lesson.end_time
          );

          if (conflict) {
            skipped++;
            continue;
          }

          const { id, created_at, ...lessonData } = lesson;
          await supabase.from('lessons').insert({ ...lessonData, date: newDateStr, is_published: false });
          copied++;
        }
      }

      notify(`Copied ${copied} lessons to ${copyWeeks} week(s)${skipped > 0 ? `, skipped ${skipped} conflicts` : ''}`);
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // EVENT CRUD
  // ============================================

  const openEventModal = (event = null) => {
    if (event) {
      setEditingItem(event);
      setEventForm({
        name: event.name,
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date || event.start_date,
        venue_id: event.venue_id || '',
        notes: event.notes || '',
        is_registrable: event.is_registrable || false
      });
    } else {
      setEditingItem(null);
      const today = toDateStr(new Date());
      setEventForm({
        name: '',
        event_type: 'competition',
        start_date: today,
        end_date: today,
        venue_id: '',
        notes: '',
        is_registrable: false
      });
    }
    setShowModal('event');
  };

  const saveEvent = async () => {
    try {
      const data = { ...eventForm, venue_id: eventForm.venue_id || null };
      if (editingItem) {
        const { error } = await supabase.from('events').update(data).eq('id', editingItem.id);
        if (error) throw error;
        notify('Event updated');
      } else {
        const { error } = await supabase.from('events').insert(data);
        if (error) throw error;
        notify('Event created');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      notify('Event deleted');
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // CLIENT CRUD
  // ============================================

  const openClientModal = (client = null) => {
    if (client) {
      setEditingItem(client);
      setClientForm({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        zip: client.zip || '',
        parent2_name: client.parent2_name || '',
        parent2_email: client.parent2_email || '',
        parent2_phone: client.parent2_phone || '',
        notes: client.notes || ''
      });
    } else {
      setEditingItem(null);
      setClientForm({
        name: '', email: '', phone: '', address: '', city: '', state: '', zip: '',
        parent2_name: '', parent2_email: '', parent2_phone: '', notes: '',
        child_name: '', child_email: '', child_birthdate: ''
      });
    }
    setShowModal('client');
  };

  const saveClient = async () => {
    try {
      // Separate child fields from client data
      const { child_name, child_email, child_birthdate, ...clientData } = clientForm;
      if (!isCoach) clientData.profile_id = profile.id;
      
      let clientId = editingItem?.id;
      
      if (editingItem) {
        const { error } = await supabase.from('clients').update(clientData).eq('id', editingItem.id);
        if (error) throw error;
        notify('Client updated');
      } else {
        const { data: newClient, error } = await supabase.from('clients').insert(clientData).select().single();
        if (error) throw error;
        clientId = newClient.id;
        notify('Client added');
      }
      
      // Auto-create student if child name provided (NO skill levels - those are added on student form)
      const childName = child_name || '';
      const childEmail = child_email || '';
      if (!editingItem && childName.trim()) {
        const studentData = {
          client_id: clientId,
          name: childName.trim(),
          email: childEmail.trim() || null,
          birthdate: child_birthdate || null,
          notes: ''
        };
        await supabase.from('students').insert(studentData);
        notify('Student created for ' + childName + ' - Edit student to add skill levels');
      } else if (!editingItem && !childName.trim()) {
        // No child name = client IS the student (adult)
        const studentData = {
          client_id: clientId,
          name: clientForm.name,
          email: clientForm.email || null,
          birthdate: null,
          notes: 'Adult student'
        };
        const { error: studentError } = await supabase.from('students').insert(studentData);
        if (studentError) {
          console.error('Student insert error:', studentError);
          notify('Client saved but student creation failed: ' + studentError.message);
        } else {
          notify('Student record created - Edit to add skill levels');
        }
      }
      
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteClient = async (id) => {
    if (!confirm('Delete this client and all their students?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      notify('Client deleted');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // STUDENT CRUD
  // ============================================

  const openStudentModal = (student = null, clientId = null) => {
    if (student) {
      setEditingItem(student);
      setStudentForm({
        client_id: student.client_id,
        name: student.name || '',
        email: student.email || '',
        birthdate: student.birthdate || '',
        // ISI
        isi_freestyle: student.isi_freestyle || '',
        isi_figures: student.isi_figures || '',
        isi_couples: student.isi_couples || '',
        isi_pairs: student.isi_pairs || '',
        isi_icedance: student.isi_icedance || '',
        isi_international_dance_level: student.isi_international_dance_level || '',
        isi_international_dances: student.isi_international_dances || '',
        isi_freedance_partnered: student.isi_freedance_partnered || '',
        isi_solo_freedance: student.isi_solo_freedance || '',
        isi_synchro: student.isi_synchro || '',
        isi_special_skater: student.isi_special_skater || '',
        isi_number: student.isi_number || '',
        // USFSA
        usfsa_skating_skills: student.usfsa_skating_skills || '',
        usfsa_singles: student.usfsa_singles || '',
        usfsa_pattern_dance_level: student.usfsa_pattern_dance_level || '',
        usfsa_pattern_dances: student.usfsa_pattern_dances || '',
        usfsa_free_dance: student.usfsa_free_dance || '',
        usfsa_pairs: student.usfsa_pairs || '',
        usfsa_number: student.usfsa_number || '',
        notes: student.notes || ''
      });
    } else {
      setEditingItem(null);
      setStudentForm({
        client_id: clientId || (clients[0]?.id || ''),
        name: '', email: '', birthdate: '',
        // ISI
        isi_freestyle: '',
        isi_figures: '',
        isi_couples: '',
        isi_pairs: '',
        isi_icedance: '',
        isi_international_dance_level: '',
        isi_international_dances: '',
        isi_freedance_partnered: '',
        isi_solo_freedance: '',
        isi_synchro: '',
        isi_special_skater: '',
        isi_number: '',
        // USFSA
        usfsa_skating_skills: '',
        usfsa_singles: '',
        usfsa_pattern_dance_level: '',
        usfsa_pattern_dances: '',
        usfsa_free_dance: '',
        usfsa_pairs: '',
        usfsa_number: '',
        notes: ''
      });
    }
    setShowModal('student');
  };

  const saveStudent = async () => {
    try {
      const data = { ...studentForm };
      
      // If name is blank, default to parent's name
      if (!data.name || !data.name.trim()) {
        const parentClient = clients.find(c => c.id === data.client_id);
        if (parentClient) {
          data.name = parentClient.name;
          // Also default email to parent's email if student email is blank
          if (!data.email || !data.email.trim()) {
            data.email = parentClient.email || null;
          }
        }
      }
      
      // Ensure we have a name
      if (!data.name || !data.name.trim()) {
        notify('Please enter a student name');
        return;
      }
      
      if (editingItem) {
        const { error } = await supabase.from('students').update(data).eq('id', editingItem.id);
        if (error) throw error;
        notify('Student updated');
      } else {
        const { error } = await supabase.from('students').insert(data);
        if (error) throw error;
        notify('Student added');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteStudent = async (id) => {
    if (!confirm('Delete this student?')) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      notify('Student deleted');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // BOOKING FUNCTIONS
  // ============================================

  const bookLesson = async (lessonId, studentId) => {
    try {
      const lesson = lessons.find(l => l.id === lessonId);
      if (!lesson) throw new Error('Lesson not found');

      // Fetch fresh booking count from database to prevent race conditions
      const { data: freshBookings, error: fetchError } = await supabase
        .from('bookings')
        .select('id, student_id')
        .eq('lesson_id', lessonId)
        .neq('status', 'cancelled');
      
      if (fetchError) throw fetchError;
      
      if (freshBookings.length >= lesson.max_students) {
        notify('Lesson is full');
        loadData(profile); // Refresh UI
        return;
      }

      const alreadyBooked = freshBookings.find(b => b.student_id === studentId);
      if (alreadyBooked) {
        notify('Student already booked');
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        lesson_id: lessonId,
        student_id: studentId,
        booked_by: profile.id,
        status: 'confirmed'
      });
      if (error) throw error;
      
      // Create notification for coach
      if (isCoach) {
        const student = students.find(s => s.id === studentId);
        const lt = getLessonType(lesson.lesson_type);
        await createNotification('booking', `${student?.name} booked ${lt.name} on ${lesson.date}`, lessonId, null, studentId);
      }
      
      notify('Lesson booked!');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      const lesson = lessons.find(l => l.id === booking.lesson_id);
      let isLateCancellation = false;

      if (lesson) {
        const lessonDateTime = new Date(`${lesson.date}T${lesson.start_time}`);
        const now = new Date();
        const hoursUntil = (lessonDateTime - now) / (1000 * 60 * 60);
        isLateCancellation = hoursUntil < CANCELLATION_WINDOW_HOURS && hoursUntil > 0;
      }

      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        is_late_cancellation: isLateCancellation
      }).eq('id', bookingId);

      if (error) throw error;
      notify(isLateCancellation ? 'Cancelled (late - may be billed)' : 'Booking cancelled');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // COMPETITION REGISTRATION
  // ============================================

  const openCompetitionRegister = (event) => {
    setRegisterCompetition(event);
    setRegisterStudentId('');
    setShowModal('registerCompetition');
  };

  const registerForCompetition = async () => {
    if (!registerCompetition || !registerStudentId) {
      notify('Please select a student');
      return;
    }
    try {
      // Check if already registered
      const existing = bookings.find(b => 
        b.event_id === registerCompetition.id && 
        b.student_id === parseInt(registerStudentId) &&
        b.status !== 'cancelled'
      );
      if (existing) {
        notify('Student already registered');
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        event_id: registerCompetition.id,
        student_id: parseInt(registerStudentId),
        booked_by: profile.id,
        status: 'confirmed'
      });
      if (error) throw error;
      
      // Create notification for coach
      if (isCoach) {
        const student = students.find(s => s.id === parseInt(registerStudentId));
        await createNotification('registration', `${student?.name} registered for ${registerCompetition.name}`, null, registerCompetition.id, parseInt(registerStudentId));
      }
      
      notify('Registered for competition!');
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const cancelCompetitionRegistration = async (bookingId) => {
    if (!confirm('Cancel this registration?')) return;
    try {
      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      }).eq('id', bookingId);
      if (error) throw error;
      notify('Registration cancelled');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // VENUE CRUD
  // ============================================

  const [venueForm, setVenueForm] = useState({ name: '', address: '', color: '#6366f1' });

  const openVenueModal = (venue = null) => {
    if (venue) {
      setEditingItem(venue);
      setVenueForm({ name: venue.name, address: venue.address || '', color: venue.color || '#6366f1' });
    } else {
      setEditingItem(null);
      setVenueForm({ name: '', address: '', color: '#6366f1' });
    }
    setShowModal('venue');
  };

  const saveVenue = async () => {
    try {
      if (editingItem) {
        const { error } = await supabase.from('venues').update(venueForm).eq('id', editingItem.id);
        if (error) throw error;
        notify('Venue updated');
      } else {
        const { error } = await supabase.from('venues').insert(venueForm);
        if (error) throw error;
        notify('Venue added');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteVenue = async (id) => {
    if (!confirm('Delete this venue?')) return;
    try {
      const { error } = await supabase.from('venues').delete().eq('id', id);
      if (error) throw error;
      notify('Venue deleted');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // INVOICE FUNCTIONS
  // ============================================

  const openInvoiceModal = (clientId = null) => {
    const { lessons: unbilledLessons, lateCancellations } = getUnbilledLessons(clientId);
    const lessonsTotal = unbilledLessons.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
    const lateCancelTotal = lateCancellations.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
    const total = lessonsTotal + lateCancelTotal;
    
    setInvoiceForm({
      client_id: clientId || '',
      lessons: unbilledLessons.map(l => l.id),
      lateCancellations: lateCancellations.map(l => l.id),
      amount: total,
      tax_rate: 0,
      notes: '',
      due_date: toDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      payment_cash: paymentSettings.cash || false,
      payment_check: paymentSettings.check || false,
      payment_venmo: paymentSettings.venmo || '',
      payment_paypal: paymentSettings.paypal || '',
      payment_zelle: paymentSettings.zelle || '',
      payment_cashapp: paymentSettings.cashapp || ''
    });
    setShowModal('invoice');
  };

  const getUnbilledLessons = (clientId) => {
    if (!clientId) return { lessons: [], lateCancellations: [] };
    const clientStudentIds = students.filter(s => s.client_id === parseInt(clientId)).map(s => s.id);
    
    // Completed lessons that haven't been invoiced
    const completedBookings = bookings.filter(b => 
      clientStudentIds.includes(b.student_id) && 
      b.status === 'completed' &&
      !b.invoice_id
    );
    const unbilledLessons = lessons.filter(l => completedBookings.some(b => b.lesson_id === l.id));
    
    // Late cancellations that haven't been billed
    const lateCancelBookings = bookings.filter(b => 
      clientStudentIds.includes(b.student_id) && 
      b.status === 'cancelled' &&
      b.is_late_cancellation &&
      !b.invoice_id
    );
    const lateCancellations = lessons.filter(l => lateCancelBookings.some(b => b.lesson_id === l.id));
    
    return { lessons: unbilledLessons, lateCancellations };
  };

  const saveInvoice = async () => {
    try {
      const { data: invoice, error } = await supabase.from('invoices').insert({
        client_id: invoiceForm.client_id,
        amount: invoiceForm.amount,
        tax_rate: invoiceForm.tax_rate,
        total: invoiceForm.amount * (1 + invoiceForm.tax_rate / 100),
        notes: invoiceForm.notes,
        due_date: invoiceForm.due_date,
        status: 'draft',
        payment_cash: invoiceForm.payment_cash,
        payment_check: invoiceForm.payment_check,
        payment_venmo: invoiceForm.payment_venmo,
        payment_paypal: invoiceForm.payment_paypal,
        payment_zelle: invoiceForm.payment_zelle,
        payment_cashapp: invoiceForm.payment_cashapp
      }).select().single();

      if (error) throw error;

      // Link completed lesson bookings to invoice
      if (invoiceForm.lessons.length > 0) {
        const bookingIds = bookings
          .filter(b => invoiceForm.lessons.includes(b.lesson_id) && b.status === 'completed')
          .map(b => b.id);
        
        if (bookingIds.length > 0) {
          await supabase.from('bookings').update({ invoice_id: invoice.id }).in('id', bookingIds);
        }
      }

      // Link late cancellation bookings to invoice
      if (invoiceForm.lateCancellations.length > 0) {
        const lateCancelBookingIds = bookings
          .filter(b => invoiceForm.lateCancellations.includes(b.lesson_id) && b.is_late_cancellation)
          .map(b => b.id);
        
        if (lateCancelBookingIds.length > 0) {
          await supabase.from('bookings').update({ invoice_id: invoice.id }).in('id', lateCancelBookingIds);
        }
      }

      notify('Invoice created');
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const updateInvoiceStatus = async (id, status) => {
    try {
      const updates = { status };
      if (status === 'paid') updates.paid_at = new Date().toISOString();
      
      const { error } = await supabase.from('invoices').update(updates).eq('id', id);
      if (error) throw error;
      notify(`Invoice marked as ${status}`);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // Send invoice via Resend edge function
  const sendInvoiceEmail = async (invoiceId) => {
    try {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      
      const client = clients.find(c => c.id === invoice.client_id);
      if (!client?.email) {
        notify('Client has no email address');
        return;
      }
      
      // Build payment methods text
      const paymentMethods = [];
      if (invoice.payment_cash) paymentMethods.push('Cash');
      if (invoice.payment_check) paymentMethods.push('Check');
      if (invoice.payment_venmo) paymentMethods.push(`Venmo: ${invoice.payment_venmo}`);
      if (invoice.payment_paypal) paymentMethods.push(`PayPal: ${invoice.payment_paypal}`);
      if (invoice.payment_zelle) paymentMethods.push(`Zelle: ${invoice.payment_zelle}`);
      if (invoice.payment_cashapp) paymentMethods.push(`Cash App: ${invoice.payment_cashapp}`);
      
      const { error } = await supabase.functions.invoke('send-invoice', {
        body: {
          to: client.email,
          clientName: client.name,
          invoiceId: invoice.id,
          amount: invoice.total,
          dueDate: invoice.due_date,
          notes: invoice.notes,
          paymentMethods: paymentMethods.join('\n'),
          coachName: profile?.name || 'Your Coach'
        }
      });
      
      if (error) throw error;
      
      // Mark invoice as sent
      await updateInvoiceStatus(invoiceId, 'sent');
      notify('Invoice emailed to ' + client.email);
    } catch (err) {
      notify('Error sending email: ' + err.message);
    }
  };

  // Load payment settings
  const loadPaymentSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').single();
      if (data) {
        setPaymentSettings({
          cash: data.payment_cash || false,
          check: data.payment_check || false,
          venmo: data.payment_venmo || '',
          paypal: data.payment_paypal || '',
          zelle: data.payment_zelle || '',
          cashapp: data.payment_cashapp || ''
        });
      }
    } catch (err) {
      // Settings might not exist yet
    }
  };

  // Save payment settings
  const savePaymentSettings = async () => {
    try {
      const { data: existing } = await supabase.from('settings').select('id').single();
      
      const settingsData = {
        payment_cash: paymentSettings.cash,
        payment_check: paymentSettings.check,
        payment_venmo: paymentSettings.venmo,
        payment_paypal: paymentSettings.paypal,
        payment_zelle: paymentSettings.zelle,
        payment_cashapp: paymentSettings.cashapp
      };
      
      if (existing) {
        const { error } = await supabase.from('settings').update(settingsData).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('settings').insert(settingsData);
        if (error) throw error;
      }
      
      notify('Payment settings saved');
      setShowModal(null);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // EXPENSE FUNCTIONS
  // ============================================

  const openExpenseModal = (expense = null) => {
    if (expense) {
      setEditingItem(expense);
      setExpenseForm({
        date: expense.date,
        category: expense.category,
        description: expense.description || '',
        amount: expense.amount,
        vendor: expense.vendor || '',
        payment_method: expense.payment_method || 'Credit Card'
      });
    } else {
      setEditingItem(null);
      setExpenseForm({
        date: toDateStr(new Date()),
        category: 'Ice Time',
        description: '',
        amount: '',
        vendor: '',
        payment_method: 'Credit Card'
      });
    }
    setShowModal('expense');
  };

  const saveExpense = async () => {
    try {
      const data = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
      if (editingItem) {
        const { error } = await supabase.from('expenses').update(data).eq('id', editingItem.id);
        if (error) throw error;
        notify('Expense updated');
      } else {
        const { error } = await supabase.from('expenses').insert(data);
        if (error) throw error;
        notify('Expense added');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      notify('Expense deleted');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // MILEAGE FUNCTIONS
  // ============================================

  const openMileageModal = (entry = null) => {
    if (entry) {
      setEditingItem(entry);
      setMileageForm({
        date: entry.date,
        description: entry.description || '',
        miles: entry.miles,
        rate: entry.rate || DEFAULT_MILEAGE_RATE,
        odometer_start: entry.odometer_start || '',
        odometer_end: entry.odometer_end || '',
        entry_type: entry.odometer_start ? 'odometer' : 'manual'
      });
    } else {
      setEditingItem(null);
      setMileageForm({
        date: toDateStr(new Date()),
        description: '',
        miles: '',
        rate: DEFAULT_MILEAGE_RATE,
        odometer_start: '',
        odometer_end: '',
        entry_type: 'manual'
      });
    }
    setShowModal('mileage');
  };

  const saveMileage = async () => {
    try {
      let miles = parseFloat(mileageForm.miles);
      
      // Calculate miles from odometer if using odometer entry
      if (mileageForm.entry_type === 'odometer' && mileageForm.odometer_start && mileageForm.odometer_end) {
        miles = parseFloat(mileageForm.odometer_end) - parseFloat(mileageForm.odometer_start);
        if (miles < 0) {
          notify('End odometer must be greater than start');
          return;
        }
      }
      
      if (!miles || miles <= 0) {
        notify('Please enter valid mileage');
        return;
      }
      
      const data = {
        date: mileageForm.date,
        description: mileageForm.description,
        miles: miles,
        rate: parseFloat(mileageForm.rate),
        amount: miles * parseFloat(mileageForm.rate),
        odometer_start: mileageForm.entry_type === 'odometer' ? parseFloat(mileageForm.odometer_start) : null,
        odometer_end: mileageForm.entry_type === 'odometer' ? parseFloat(mileageForm.odometer_end) : null
      };
      
      if (editingItem) {
        const { error } = await supabase.from('mileage').update(data).eq('id', editingItem.id);
        if (error) throw error;
        notify('Mileage updated');
      } else {
        const { error } = await supabase.from('mileage').insert(data);
        if (error) throw error;
        notify('Mileage logged');
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  const deleteMileage = async (id) => {
    if (!confirm('Delete this mileage entry?')) return;
    try {
      const { error } = await supabase.from('mileage').delete().eq('id', id);
      if (error) throw error;
      notify('Mileage deleted');
      loadData(profile);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  };

  // ============================================
  // STYLES
  // ============================================

  const styles = {
    // Layout
    container: { minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', color: 'white', padding: '16px 20px', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' },
    headerContent: { maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    logo: { fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
    userInfo: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 },
    main: { maxWidth: 1200, margin: '0 auto', padding: 20 },

    // Navigation
    nav: { display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    navBtn: { padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap', transition: 'all 0.2s' },
    navBtnActive: { background: '#7c3aed', color: 'white' },

    // Cards
    card: { background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    cardTitle: { fontSize: 18, fontWeight: 600, color: '#0f172a' },

    // Buttons
    btn: { padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 14, transition: 'all 0.2s' },
    btnPrimary: { background: '#7c3aed', color: 'white' },
    btnSecondary: { background: '#f1f5f9', color: '#475569' },
    btnDanger: { background: '#ef4444', color: 'white' },
    btnSuccess: { background: '#10b981', color: 'white' },
    btnSmall: { padding: '6px 12px', fontSize: 13 },

    // Forms
    formGroup: { marginBottom: 16 },
    label: { display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151', fontSize: 14 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
    select: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: 'white' },
    textarea: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 80, resize: 'vertical' },
    checkbox: { marginRight: 8 },
    row: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 },

    // Modal
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 },
    modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' },
    modalHeader: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 600 },
    modalBody: { padding: 20 },
    modalFooter: { padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 },

    // Calendar
    calendarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    calendarNav: { display: 'flex', alignItems: 'center', gap: 12 },
    calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
    calendarDayHeader: { padding: 8, textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: 12 },
    calendarDay: { minHeight: isMobile ? 60 : 100, padding: 8, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' },
    calendarDayToday: { border: '2px solid #7c3aed' },
    calendarDayNum: { fontWeight: 600, fontSize: 14, marginBottom: 4 },
    calendarLesson: { fontSize: 11, padding: '2px 4px', marginBottom: 2, borderRadius: 4, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

    // Table
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: 13 },
    td: { padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 14 },

    // List
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #e2e8f0' },
    listItemLast: { borderBottom: 'none' },

    // Auth
    authContainer: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', padding: 20 },
    authCard: { background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
    authLogo: { textAlign: 'center', fontSize: 32, marginBottom: 8 },
    authTitle: { textAlign: 'center', fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
    authSub: { textAlign: 'center', color: '#64748b', marginBottom: 24 },
    authTabs: { display: 'flex', marginBottom: 24, background: '#f1f5f9', borderRadius: 8, padding: 4 },
    authTab: { flex: 1, padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, fontWeight: 500, color: '#64748b', transition: 'all 0.2s' },
    authTabActive: { background: 'white', color: '#0f172a', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

    // Badges
    badge: { display: 'inline-block', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 },
    badgeSuccess: { background: '#dcfce7', color: '#166534' },
    badgeWarning: { background: '#fef3c7', color: '#92400e' },
    badgeDanger: { background: '#fee2e2', color: '#991b1b' },
    badgeInfo: { background: '#dbeafe', color: '#1e40af' },

    // Dashboard
    statsGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
    statCard: { background: 'white', borderRadius: 12, padding: 20, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    statValue: { fontSize: 28, fontWeight: 700, color: '#7c3aed' },
    statLabel: { color: '#64748b', fontSize: 14, marginTop: 4 },

    // Misc
    loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' },
    spinner: { fontSize: 48, animation: 'spin 1s linear infinite' },
    toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '12px 24px', borderRadius: 8, fontSize: 14, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    error: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 },
    empty: { textAlign: 'center', color: '#64748b', padding: 40 }
  };

  // ============================================
  // RENDER: AUTH
  // ============================================

  if (!session) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>⛸️</div>
          <h1 style={styles.authTitle}>IceBooks Pro</h1>
          <p style={styles.authSub}>Figure Skating Coach Management</p>
          
          <div style={styles.authTabs}>
            <button 
              style={{ ...styles.authTab, ...(authMode === 'signin' ? styles.authTabActive : {}) }}
              onClick={() => setAuthMode('signin')}
            >
              Sign In
            </button>
            <button 
              style={{ ...styles.authTab, ...(authMode === 'signup' ? styles.authTabActive : {}) }}
              onClick={() => setAuthMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {authError && <div style={styles.error}>{authError}</div>}

          <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp}>
            {authMode === 'signup' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, width: '100%' }}>
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: LOADING
  // ============================================

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}>⛸️</div>
        <div>Loading...</div>
      </div>
    );
  }

  // ============================================
  // RENDER: CALENDAR
  // ============================================

  const renderCalendar = () => {
    const weekDates = getWeekDates(currentDate);
    const monthDays = getDays(currentDate);
    const today = toDateStr(new Date());

    const getLessonsForDate = (date) => {
      const dateStr = toDateStr(date);
      return lessons.filter(l => l.date === dateStr);
    };

    const getEventsForDate = (date) => {
      const dateStr = toDateStr(date);
      return events.filter(e => dateStr >= e.start_date && dateStr <= (e.end_date || e.start_date));
    };

    const renderDayCell = (date, isOutside = false) => {
      const dateStr = toDateStr(date);
      const dayLessons = getLessonsForDate(date);
      const dayEvents = getEventsForDate(date);
      const isToday = dateStr === today;
      const isCompact = calendarView === 'month' && isMobile;

      return (
        <div 
          key={dateStr}
          style={{ 
            ...styles.calendarDay, 
            ...(isToday ? styles.calendarDayToday : {}),
            opacity: isOutside ? 0.4 : 1,
            minHeight: calendarView === 'month' ? (isMobile ? 40 : 80) : 120
          }}
          onClick={() => isCoach && openLessonModal(null, date)}
        >
          <div style={styles.calendarDayNum}>{date.getDate()}</div>
          {isCompact ? (
            // Mobile month view: just show dots
            (dayLessons.length > 0 || dayEvents.length > 0) && (
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                {dayEvents.slice(0, 2).map(e => (
                  <span key={`e-${e.id}`} style={{ width: 6, height: 6, borderRadius: '50%', background: getEventType(e.event_type).color }}></span>
                ))}
                {dayLessons.slice(0, 3).map(l => (
                  <span key={`l-${l.id}`} style={{ width: 6, height: 6, borderRadius: '50%', background: getLessonType(l.lesson_type).color }}></span>
                ))}
              </div>
            )
          ) : (
            // Desktop or week view: show full items
            <>
              {dayEvents.map(e => {
                const et = getEventType(e.event_type);
                return (
                  <div 
                    key={`e-${e.id}`} 
                    style={{ ...styles.calendarLesson, background: et.color }}
                    onClick={(ev) => { ev.stopPropagation(); isCoach && openEventModal(e); }}
                  >
                    {et.icon} {calendarView === 'month' ? '' : e.name}
                  </div>
                );
              })}
              {dayLessons.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(l => {
                const lt = getLessonType(l.lesson_type);
                const venue = venues.find(v => v.id === l.venue_id);
                const lessonBookings = bookings.filter(b => b.lesson_id === l.id && b.status !== 'cancelled');
                const booked = lessonBookings.length;
                const bookedNames = lessonBookings.map(b => students.find(s => s.id === b.student_id)?.name).filter(Boolean);
                return (
                  <div 
                    key={`l-${l.id}`} 
                    style={{ 
                      ...styles.calendarLesson, 
                      background: lt.color, 
                      opacity: l.is_published ? 1 : 0.5,
                      position: 'relative'
                    }}
                    onClick={(ev) => { ev.stopPropagation(); openLessonModal(l); }}
                  >
                    {formatTime(l.start_time)} {lt.icon} {booked}/{l.max_students}
                    {bookedNames.length > 0 && (
                      <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2, fontWeight: 400 }}>
                        {bookedNames.join(', ')}
                      </div>
                    )}
                    {venue?.color && (
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: venue.color,
                        border: '1px solid rgba(255,255,255,0.5)'
                      }}></span>
                    )}
                  </div>
                );
              })}
              {isCoach && dayLessons.length > 0 && (
                <button 
                  style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginTop: 4, width: '100%', fontSize: 10 }}
                  onClick={(ev) => { ev.stopPropagation(); openCopyDay(date); }}
                >
                  Copy Day
                </button>
              )}
            </>
          )}
        </div>
      );
    };

    return (
      <div style={styles.card}>
        {/* Calendar Header */}
        <div style={styles.calendarHeader}>
          <div style={styles.calendarNav}>
            <button 
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => {
                const d = new Date(currentDate);
                if (calendarView === 'month') {
                  d.setMonth(d.getMonth() - 1);
                } else {
                  d.setDate(d.getDate() - 7);
                }
                setCurrentDate(d);
              }}
            >
              ← Prev
            </button>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {calendarView === 'month' 
                ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </h2>
            <button 
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => {
                const d = new Date(currentDate);
                if (calendarView === 'month') {
                  d.setMonth(d.getMonth() + 1);
                } else {
                  d.setDate(d.getDate() + 7);
                }
                setCurrentDate(d);
              }}
            >
              Next →
            </button>
          </div>
          
          {/* View Toggle & Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <button 
                style={{ ...styles.btn, padding: '6px 12px', borderRadius: 0, background: calendarView === 'month' ? '#7c3aed' : '#f8fafc', color: calendarView === 'month' ? 'white' : '#64748b', border: 'none' }}
                onClick={() => setCalendarView('month')}
              >
                Month
              </button>
              <button 
                style={{ ...styles.btn, padding: '6px 12px', borderRadius: 0, background: calendarView === 'week' ? '#7c3aed' : '#f8fafc', color: calendarView === 'week' ? 'white' : '#64748b', border: 'none' }}
                onClick={() => setCalendarView('week')}
              >
                Week
              </button>
              {isCoach && (
                <button 
                  style={{ ...styles.btn, padding: '6px 12px', borderRadius: 0, background: calendarView === 'day' ? '#7c3aed' : '#f8fafc', color: calendarView === 'day' ? 'white' : '#64748b', border: 'none' }}
                  onClick={() => { setCalendarView('day'); if (!selectedDate) setSelectedDate(new Date()); }}
                >
                  Day
                </button>
              )}
            </div>
            {isCoach && (
              <>
                {/* Notifications Bell */}
                <div style={{ position: 'relative' }}>
                  <button 
                    style={{ ...styles.btn, ...styles.btnSecondary, position: 'relative' }}
                    onClick={() => setShowNotifications(!showNotifications)}
                  >
                    🔔
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span style={{
                        position: 'absolute', top: -5, right: -5, background: '#ef4444',
                        color: 'white', borderRadius: '50%', width: 20, height: 20,
                        fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 8,
                      background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', width: 320, maxHeight: 400,
                      overflow: 'auto', zIndex: 1000
                    }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Notifications</strong>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <button style={{ ...styles.btn, padding: '4px 8px', fontSize: 12 }} onClick={markAllNotificationsRead}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No notifications</div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} style={{
                            padding: 12, borderBottom: '1px solid #f1f5f9',
                            background: n.read ? 'white' : '#f0f9ff', cursor: 'pointer'
                          }} onClick={() => !n.read && markNotificationRead(n.id)}>
                            <div style={{ fontSize: 14, marginBottom: 4 }}>{n.message}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openLessonModal()}>+ Lesson</button>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => openEventModal()}>+ Event</button>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={openCopyWeek}>Copy Week</button>
              </>
            )}
          </div>
        </div>

        {/* Calendar Sync Buttons */}
        {isCoach && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={exportICS}>
              📤 Export .ics
            </button>
            <label style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall, cursor: 'pointer', margin: 0 }}>
              📥 Import .ics
              <input type="file" accept=".ics,.ical" onChange={importICS} style={{ display: 'none' }} />
            </label>
            <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={copyLiveSyncUrl}>
              🔗 Live Sync URL
            </button>
          </div>
        )}

        {/* Calendar Grid */}
        <div style={styles.calendarGrid}>
          {DAY_NAMES.map(d => (
            <div key={d} style={styles.calendarDayHeader}>{d}</div>
          ))}
          {calendarView === 'month' 
            ? monthDays.map(({ date, outside }) => renderDayCell(date, outside))
            : calendarView === 'week'
            ? weekDates.map(date => renderDayCell(date))
            : null
          }
        </div>
        
        {/* Day View */}
        {calendarView === 'day' && selectedDate && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                Schedule for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {isMobile && (
                  <button 
                    style={{ ...styles.btn, ...styles.btnPrimary }} 
                    onClick={() => {
                      setMileageForm({ 
                        ...mileageForm, 
                        date: selectedDate.toISOString().split('T')[0] 
                      });
                      setShowModal('mileage');
                    }}
                  >
                    ⛽ Add Mileage
                  </button>
                )}
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={printDaySchedule}>
                  🖨️ Print
                </button>
              </div>
            </div>
            {(() => {
              const dayLessons = lessons
                .filter(l => l.date === selectedDate.toISOString().split('T')[0])
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              
              if (dayLessons.length === 0) {
                return <div style={styles.empty}>No lessons scheduled for this day</div>;
              }
              
              return dayLessons.map(lesson => {
                const lt = getLessonType(lesson.lesson_type);
                const venue = venues.find(v => v.id === lesson.venue_id);
                const lessonBookings = bookings.filter(b => b.lesson_id === lesson.id && b.status !== 'cancelled');
                
                return (
                  <div key={lesson.id} style={{ 
                    ...styles.card, 
                    marginBottom: 16, 
                    borderLeft: `4px solid ${lt.color}` 
                  }}>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                            {lt.icon} {lt.name}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 14 }}>
                            {lesson.start_time} - {lesson.end_time}
                            {venue && (
                              <span style={{ marginLeft: 12 }}>
                                📍 {venue.name}
                                {venue.color && (
                                  <span style={{
                                    display: 'inline-block',
                                    width: 8, height: 8,
                                    borderRadius: '50%',
                                    background: venue.color,
                                    marginLeft: 6
                                  }}></span>
                                )}
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                            Rate: ${lesson.rate} | Max: {lesson.max_students} | Published: {lesson.is_published ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Booked Students */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                          Booked Students ({lessonBookings.length}/{lesson.max_students})
                        </div>
                        {lessonBookings.length === 0 ? (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            {lesson.is_published ? 'No bookings yet' : 'Not published for booking'}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 12 }}>
                            {lessonBookings.map(booking => {
                              const student = students.find(s => s.id === booking.student_id);
                              const client = clients.find(c => c.id === student?.client_id);
                              return (
                                <div key={booking.id} style={{
                                  background: '#f8fafc',
                                  padding: 12,
                                  borderRadius: 6,
                                  display: 'grid',
                                  gridTemplateColumns: isMobile ? '1fr' : '2fr 2fr 1fr',
                                  gap: 12
                                }}>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{student?.name || 'Unknown'}</div>
                                    <div style={{ fontSize: 13, color: '#64748b' }}>
                                      {student?.isi_level && `ISI: ${student.isi_level}`}
                                      {student?.isi_level && student?.usfsa_level && ' | '}
                                      {student?.usfsa_level && `USFSA: ${student.usfsa_level}`}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 13 }}>
                                    <div style={{ fontWeight: 500 }}>{client?.name}</div>
                                    <div style={{ color: '#64748b' }}>{client?.phone}</div>
                                    <div style={{ color: '#64748b' }}>{client?.email}</div>
                                  </div>
                                  <div style={{ fontSize: 13, color: '#64748b' }}>
                                    Booked: {new Date(booking.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: CLIENTS
  // ============================================

  const renderClients = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Clients</h2>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openClientModal()}>+ Add Client</button>
      </div>
      {clients.length === 0 ? (
        <div style={styles.empty}>No clients yet. Add your first client!</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Students</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const clientStudents = students.filter(s => s.client_id === c.id);
                return (
                  <tr key={c.id}>
                    <td style={styles.td}><strong>{c.name}</strong></td>
                    <td style={styles.td}>{c.email}</td>
                    <td style={styles.td}>{c.phone}</td>
                    <td style={styles.td}>{clientStudents.length}</td>
                    <td style={styles.td}>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openClientModal(c)}>Edit</button>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openStudentModal(null, c.id)}>+ Student</button>
                      {isCoach && (
                        <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSuccess }} onClick={() => openInvoiceModal(c.id)}>Invoice</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: STUDENTS
  // ============================================

  const renderStudents = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Students</h2>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openStudentModal()}>+ Add Student</button>
      </div>
      {students.length === 0 ? (
        <div style={styles.empty}>No students yet. Add students to your clients!</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Parent/Client</th>
                <th style={styles.th}>ISI Level</th>
                <th style={styles.th}>USFSA Level</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const client = clients.find(c => c.id === s.client_id);
                return (
                  <tr key={s.id}>
                    <td style={styles.td}><strong>{s.name}</strong></td>
                    <td style={styles.td}>{client?.name || '-'}</td>
                    <td style={styles.td}>{s.isi_level || '-'}</td>
                    <td style={styles.td}>{s.usfsa_level || '-'}</td>
                    <td style={styles.td}>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openStudentModal(s)}>Edit</button>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }} onClick={() => deleteStudent(s.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: VENUES
  // ============================================

  const renderVenues = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Venues / Rinks</h2>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openVenueModal()}>+ Add Venue</button>
      </div>
      {venues.length === 0 ? (
        <div style={styles.empty}>No venues yet. Add your rinks!</div>
      ) : (
        <div>
          {venues.map(v => (
            <div key={v.id} style={styles.listItem}>
              <div>
                <strong>{v.name}</strong>
                {v.address && <div style={{ color: '#64748b', fontSize: 13 }}>{v.address}</div>}
              </div>
              <div>
                <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openVenueModal(v)}>Edit</button>
                <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }} onClick={() => deleteVenue(v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: INVOICES
  // ============================================

  const renderInvoices = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Invoices</h2>
      </div>
      {invoices.length === 0 ? (
        <div style={styles.empty}>No invoices yet. Create one from the Clients tab!</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const client = clients.find(c => c.id === inv.client_id);
                return (
                  <tr key={inv.id}>
                    <td style={styles.td}>{formatDate(inv.created_at)}</td>
                    <td style={styles.td}>{client?.name || '-'}</td>
                    <td style={styles.td}>{formatCurrency(inv.total || inv.amount)}</td>
                    <td style={styles.td}>
                      <span style={{ 
                        ...styles.badge, 
                        ...(inv.status === 'paid' ? styles.badgeSuccess : inv.status === 'overdue' ? styles.badgeDanger : styles.badgeWarning) 
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {inv.status === 'draft' && (
                        <button 
                          style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnPrimary, marginRight: 8 }} 
                          onClick={() => sendInvoiceEmail(inv.id)}
                          title="Send invoice via email"
                        >
                          📧 Send
                        </button>
                      )}
                      {inv.status !== 'paid' && (
                        <>
                          <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => updateInvoiceStatus(inv.id, 'sent')}>Mark Sent</button>
                          <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSuccess }} onClick={() => updateInvoiceStatus(inv.id, 'paid')}>Mark Paid</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: EXPENSES
  // ============================================

  const renderExpenses = () => {
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Expenses</h2>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openExpenseModal()}>+ Add Expense</button>
        </div>
        
        <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
          <strong>Total Expenses:</strong> {formatCurrency(totalExpenses)}
        </div>

        {expenses.length === 0 ? (
          <div style={styles.empty}>No expenses recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td style={styles.td}>{formatDate(e.date)}</td>
                    <td style={styles.td}>{e.category}</td>
                    <td style={styles.td}>{e.description}</td>
                    <td style={styles.td}>{formatCurrency(e.amount)}</td>
                    <td style={styles.td}>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openExpenseModal(e)}>Edit</button>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }} onClick={() => deleteExpense(e.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: MILEAGE
  // ============================================

  const renderMileage = () => {
    const totalMiles = mileage.reduce((sum, m) => sum + (m.miles || 0), 0);
    const totalDeduction = mileage.reduce((sum, m) => sum + (m.amount || 0), 0);

    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Mileage Log</h2>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openMileageModal()}>+ Log Mileage</button>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><strong>Total Miles:</strong> {totalMiles.toFixed(1)}</div>
          <div><strong>Tax Deduction:</strong> {formatCurrency(totalDeduction)}</div>
        </div>

        {mileage.length === 0 ? (
          <div style={styles.empty}>No mileage logged yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Miles</th>
                  <th style={styles.th}>Rate</th>
                  <th style={styles.th}>Deduction</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mileage.map(m => (
                  <tr key={m.id}>
                    <td style={styles.td}>{formatDate(m.date)}</td>
                    <td style={styles.td}>{m.description}</td>
                    <td style={styles.td}>{m.miles}</td>
                    <td style={styles.td}>${m.rate}/mi</td>
                    <td style={styles.td}>{formatCurrency(m.amount)}</td>
                    <td style={styles.td}>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openMileageModal(m)}>Edit</button>
                      <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }} onClick={() => deleteMileage(m.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: SETTINGS
  // ============================================

  const renderSettings = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Settings</h2>
      </div>
      
      {/* Payment Methods */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>💳 Payment Methods</h3>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
          Configure your accepted payment methods. These will be included on invoices.
        </p>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={paymentSettings.cash} 
              onChange={e => setPaymentSettings({ ...paymentSettings, cash: e.target.checked })} 
              style={{ marginRight: 8 }} 
            />
            Accept Cash
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={paymentSettings.check} 
              onChange={e => setPaymentSettings({ ...paymentSettings, check: e.target.checked })} 
              style={{ marginRight: 8 }} 
            />
            Accept Check
          </label>
        </div>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Venmo Username</label>
            <input 
              type="text" 
              style={styles.input} 
              value={paymentSettings.venmo} 
              onChange={e => setPaymentSettings({ ...paymentSettings, venmo: e.target.value })} 
              placeholder="@username" 
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>PayPal Email</label>
            <input 
              type="text" 
              style={styles.input} 
              value={paymentSettings.paypal} 
              onChange={e => setPaymentSettings({ ...paymentSettings, paypal: e.target.value })} 
              placeholder="email@example.com" 
            />
          </div>
        </div>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Zelle (phone or email)</label>
            <input 
              type="text" 
              style={styles.input} 
              value={paymentSettings.zelle} 
              onChange={e => setPaymentSettings({ ...paymentSettings, zelle: e.target.value })} 
              placeholder="phone or email" 
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Cash App Tag</label>
            <input 
              type="text" 
              style={styles.input} 
              value={paymentSettings.cashapp} 
              onChange={e => setPaymentSettings({ ...paymentSettings, cashapp: e.target.value })} 
              placeholder="$cashtag" 
            />
          </div>
        </div>
        
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={savePaymentSettings}>
          Save Payment Settings
        </button>
      </div>
      
      {/* Email Settings Info */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📧 Email Invoices</h3>
        <p style={{ fontSize: 14, color: '#64748b' }}>
          To send invoices via email, you'll need to set up a Resend API key in your Supabase Edge Function.
          See the README for setup instructions.
        </p>
      </div>
    </div>
  );

  // ============================================
  // RENDER: EVENTS / COMPETITIONS
  // ============================================

  const renderEvents = () => {
    const upcomingEvents = events.filter(e => e.start_date >= toDateStr(new Date()));
    const pastEvents = events.filter(e => e.start_date < toDateStr(new Date()));

    const getRegistrations = (eventId) => {
      return bookings.filter(b => b.event_id === eventId && b.status !== 'cancelled');
    };

    return (
      <div>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Upcoming Events & Competitions</h2>
            {isCoach && <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openEventModal()}>+ Add Event</button>}
          </div>
          {upcomingEvents.length === 0 ? (
            <div style={styles.empty}>No upcoming events.</div>
          ) : (
            <div>
              {upcomingEvents.map(e => {
                const et = getEventType(e.event_type);
                const registrations = getRegistrations(e.id);
                const venue = venues.find(v => v.id === e.venue_id);
                const myStudentIds = students.map(s => s.id);
                const myRegistrations = registrations.filter(r => myStudentIds.includes(r.student_id));

                return (
                  <div key={e.id} style={{ ...styles.listItem, flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 24 }}>{et.icon}</span>
                          <strong style={{ fontSize: 16 }}>{e.name}</strong>
                          <span style={{ ...styles.badge, background: et.color, color: 'white' }}>{et.name}</span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                          {formatDate(e.start_date)}{e.end_date && e.end_date !== e.start_date && ` - ${formatDate(e.end_date)}`}
                          {venue && ` • ${venue.name}`}
                        </div>
                        {e.notes && <div style={{ marginTop: 4, fontSize: 13 }}>{e.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {e.is_registrable && students.length > 0 && (
                          <button style={{ ...styles.btn, ...styles.btnSuccess }} onClick={() => openCompetitionRegister(e)}>
                            Register Student
                          </button>
                        )}
                        {isCoach && (
                          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => openEventModal(e)}>Edit</button>
                        )}
                      </div>
                    </div>
                    
                    {registrations.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                        <strong style={{ fontSize: 13 }}>Registered ({registrations.length}):</strong>
                        <div style={{ marginTop: 8 }}>
                          {registrations.map(r => {
                            const student = students.find(s => s.id === r.student_id);
                            const isMine = myStudentIds.includes(r.student_id);
                            return (
                              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                <span>{student?.name || 'Unknown'}</span>
                                {(isCoach || isMine) && (
                                  <button 
                                    style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }}
                                    onClick={() => cancelCompetitionRegistration(r.id)}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pastEvents.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Past Events</h2>
            <div>
              {pastEvents.slice(0, 10).map(e => {
                const et = getEventType(e.event_type);
                return (
                  <div key={e.id} style={styles.listItem}>
                    <div>
                      <span style={{ marginRight: 8 }}>{et.icon}</span>
                      <strong>{e.name}</strong>
                      <span style={{ color: '#64748b', marginLeft: 8 }}>{formatDate(e.start_date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: CLIENT BOOKING VIEW
  // ============================================

  const renderClientBooking = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(today);
    const myStudentIds = students.map(s => s.id);
    const days = getDays(currentDate);

    const getLessonsForDate = (date) => {
      const dateStr = toDateStr(date);
      return lessons.filter(l => l.date === dateStr && l.is_published);
    };

    const getMyBookingForLesson = (lessonId) => {
      return bookings.find(b => 
        b.lesson_id === lessonId && 
        myStudentIds.includes(b.student_id) && 
        b.status !== 'cancelled'
      );
    };

    const getLessonStatus = (lesson) => {
      const lessonDateTime = new Date(`${lesson.date}T${lesson.start_time}`);
      const now = new Date();
      const hoursUntil = (lessonDateTime - now) / (1000 * 60 * 60);
      const isPast = lessonDateTime < now;
      const myBooking = getMyBookingForLesson(lesson.id);
      const totalBooked = bookings.filter(b => b.lesson_id === lesson.id && b.status !== 'cancelled').length;
      const isFull = totalBooked >= lesson.max_students;
      const isLateWindow = hoursUntil < CANCELLATION_WINDOW_HOURS && hoursUntil > 0;

      if (isPast) return { status: 'past', color: '#9ca3af', myBooking };
      if (myBooking) return { status: 'booked', color: '#22c55e', myBooking, isLateWindow };
      if (isFull) return { status: 'full', color: '#9ca3af', myBooking };
      return { status: 'available', color: '#3b82f6', myBooking };
    };

    const getDayIndicator = (date) => {
      const dayLessons = getLessonsForDate(date);
      if (dayLessons.length === 0) return null;
      
      let hasBooked = false, hasAvailable = false;
      for (const l of dayLessons) {
        const status = getLessonStatus(l);
        if (status.status === 'booked') hasBooked = true;
        if (status.status === 'available') hasAvailable = true;
      }
      if (hasBooked) return '#22c55e'; // green
      if (hasAvailable) return '#3b82f6'; // blue
      return '#9ca3af'; // gray
    };

    if (students.length === 0) {
      return (
        <div style={styles.card}>
          <div style={styles.empty}>
            <p>Add a student first before booking lessons.</p>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setActiveTab('mystudents')}>Add Student</button>
          </div>
        </div>
      );
    }

    const selectedDateLessons = selectedDate ? getLessonsForDate(selectedDate) : [];

    return (
      <div>
        <div style={styles.card}>
          {/* Calendar Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button 
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() - 1);
                setCurrentDate(d);
                setSelectedDate(null);
              }}
            >
              ← Prev
            </button>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button 
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() + 1);
                setCurrentDate(d);
                setSelectedDate(null);
              }}
            >
              Next →
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#22c55e', marginRight: 4 }}></span> Your Booking</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', marginRight: 4 }}></span> Available</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#9ca3af', marginRight: 4 }}></span> Full/Past</span>
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e2e8f0' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ background: '#f1f5f9', padding: 8, textAlign: 'center', fontWeight: 600, fontSize: 12 }}>{d}</div>
            ))}
            {days.map(({ date, outside }, idx) => {
              const dateStr = toDateStr(date);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDate && toDateStr(date) === toDateStr(selectedDate);
              const indicator = getDayIndicator(date);

              return (
                <div 
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    background: isSelected ? '#ede9fe' : isToday ? '#fef3c7' : 'white',
                    padding: 8,
                    minHeight: 60,
                    cursor: 'pointer',
                    opacity: outside ? 0.4 : 1,
                    border: isSelected ? '2px solid #7c3aed' : '1px solid transparent'
                  }}
                >
                  <div style={{ fontWeight: isToday ? 700 : 400, fontSize: 14 }}>{date.getDate()}</div>
                  {indicator && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: indicator }}></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        {selectedDate && (
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 16px 0' }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedDateLessons.length === 0 ? (
              <div style={styles.empty}>No lessons available on this day.</div>
            ) : (
              <div>
                {selectedDateLessons.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(lesson => {
                  const lt = getLessonType(lesson.lesson_type);
                  const venue = venues.find(v => v.id === lesson.venue_id);
                  const status = getLessonStatus(lesson);
                  const totalBooked = bookings.filter(b => b.lesson_id === lesson.id && b.status !== 'cancelled').length;
                  const spotsLeft = lesson.max_students - totalBooked;

                  return (
                    <div 
                      key={lesson.id} 
                      style={{ 
                        ...styles.listItem, 
                        borderLeft: `4px solid ${status.color}`,
                        background: status.status === 'booked' ? '#f0fdf4' : status.status === 'available' ? '#eff6ff' : '#f9fafb'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</span>
                          <span style={{ ...styles.badge, background: lt.color, color: 'white' }}>{lt.icon} {lt.name}</span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                          {venue?.name || 'TBD'}
                          {status.status === 'booked' && status.myBooking && (
                            <span> • Booked: {students.find(s => s.id === status.myBooking.student_id)?.name}</span>
                          )}
                          {status.status === 'available' && <span> • {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} available</span>}
                          {status.status === 'full' && <span> • Full</span>}
                          {status.status === 'past' && <span> • Past</span>}
                        </div>
                      </div>
                      <div>
                        {status.status === 'available' && (
                          <button 
                            style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }}
                            onClick={() => setBookingLesson(lesson)}
                          >
                            Book
                          </button>
                        )}
                        {status.status === 'booked' && (
                          <button 
                            style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }}
                            onClick={() => cancelBooking(status.myBooking.id)}
                          >
                            {status.isLateWindow ? '⚠️ Cancel (Late)' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Booking Modal */}
        {bookingLesson && (
          <div style={styles.modalOverlay} onClick={() => setBookingLesson(null)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Book Lesson</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setBookingLesson(null)}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <strong>{formatDate(bookingLesson.date)}</strong><br />
                  {formatTime(bookingLesson.start_time)} - {formatTime(bookingLesson.end_time)}<br />
                  {venues.find(v => v.id === bookingLesson.venue_id)?.name || 'TBD'}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Student</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(() => {
                      const lessonBookings = bookings.filter(b => b.lesson_id === bookingLesson.id && b.status !== 'cancelled');
                      const bookedStudentIds = lessonBookings.map(b => b.student_id);
                      const spotsRemaining = bookingLesson.max_students - lessonBookings.length;
                      const availableStudents = students.filter(s => !bookedStudentIds.includes(s.id));
                      
                      if (spotsRemaining <= 0) {
                        return (
                          <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, color: '#92400e' }}>
                            This lesson is now full. Please select a different time.
                          </div>
                        );
                      }
                      
                      if (availableStudents.length === 0) {
                        return (
                          <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#166534' }}>
                            All your students are already booked for this lesson.
                          </div>
                        );
                      }
                      
                      return availableStudents.map(s => (
                        <button
                          key={s.id}
                          style={{ ...styles.btn, ...styles.btnPrimary, textAlign: 'left' }}
                          onClick={() => {
                            bookLesson(bookingLesson.id, s.id);
                            setBookingLesson(null);
                          }}
                        >
                          {s.name}
                        </button>
                      ));
                    })()}
                  </div>
                  {(() => {
                    const lessonBookings = bookings.filter(b => b.lesson_id === bookingLesson.id && b.status !== 'cancelled');
                    const spotsRemaining = bookingLesson.max_students - lessonBookings.length;
                    return (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                        {spotsRemaining} of {bookingLesson.max_students} spot{bookingLesson.max_students !== 1 ? 's' : ''} available
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: CLIENT STUDENTS VIEW
  // ============================================

  const renderMyStudents = () => (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>My Students</h2>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openStudentModal()}>+ Add Student</button>
      </div>
      
      {clients.length === 0 && (
        <div style={{ marginBottom: 16, padding: 16, background: '#fef3c7', borderRadius: 8 }}>
          <strong>First, add your contact info:</strong>
          <button style={{ ...styles.btn, ...styles.btnPrimary, marginLeft: 12 }} onClick={() => openClientModal()}>Add My Info</button>
        </div>
      )}

      {students.length === 0 ? (
        <div style={styles.empty}>No students added yet.</div>
      ) : (
        <div>
          {students.map(s => (
            <div key={s.id} style={styles.listItem}>
              <div>
                <strong>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  {s.isi_level && `ISI: ${s.isi_level}`}
                  {s.isi_level && s.usfsa_level && ' • '}
                  {s.usfsa_level && `USFSA: ${s.usfsa_level}`}
                </div>
              </div>
              <div>
                <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }} onClick={() => openStudentModal(s)}>Edit</button>
                <button style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }} onClick={() => deleteStudent(s.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: MODALS
  // ============================================

  const renderModal = () => {
    if (!showModal) return null;

    const closeModal = () => { setShowModal(null); setEditingItem(null); };

    return (
      <div style={styles.modalOverlay} onClick={closeModal}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          
          {/* LESSON MODAL */}
          {showModal === 'lesson' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Lesson' : 'New Lesson'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date</label>
                  <input type="date" style={styles.input} value={lessonForm.date} onChange={e => setLessonForm({ ...lessonForm, date: e.target.value })} />
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Start Time</label>
                    <input type="time" style={styles.input} value={lessonForm.start_time} onChange={e => setLessonForm({ ...lessonForm, start_time: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>End Time</label>
                    <input type="time" style={styles.input} value={lessonForm.end_time} onChange={e => setLessonForm({ ...lessonForm, end_time: e.target.value })} />
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lesson Type</label>
                    <select style={styles.select} value={lessonForm.lesson_type} onChange={e => {
                      if (e.target.value === '__add_new__') {
                        setShowAddLessonType(true);
                      } else {
                        const lt = getLessonType(e.target.value);
                        setLessonForm({ ...lessonForm, lesson_type: e.target.value, max_students: lt.max, rate: lt.rate });
                      }
                    }}>
                      {LESSON_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                      {customLessonTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                      {isCoach && <option value="__add_new__">➕ Add New Type...</option>}
                    </select>
                    
                    {/* Inline Add Custom Type Form */}
                    {showAddLessonType && (
                      <div style={{ 
                        marginTop: 12, 
                        padding: 12, 
                        background: '#f8fafc', 
                        borderRadius: 6, 
                        border: '1px solid #e2e8f0' 
                      }}>
                        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Add Custom Lesson Type</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <input 
                            type="text" 
                            placeholder="Name" 
                            style={{ ...styles.input, fontSize: 13, padding: '6px 10px' }}
                            value={newLessonType.name}
                            onChange={e => setNewLessonType({ ...newLessonType, name: e.target.value })}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8 }}>
                            <input 
                              type="text" 
                              placeholder="📚" 
                              style={{ ...styles.input, fontSize: 13, padding: '6px 10px', textAlign: 'center' }}
                              value={newLessonType.icon}
                              onChange={e => setNewLessonType({ ...newLessonType, icon: e.target.value })}
                            />
                            <input 
                              type="color" 
                              style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 4 }}
                              value={newLessonType.color}
                              onChange={e => setNewLessonType({ ...newLessonType, color: e.target.value })}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input 
                              type="number" 
                              placeholder="Max students" 
                              min={1}
                              style={{ ...styles.input, fontSize: 13, padding: '6px 10px' }}
                              value={newLessonType.max}
                              onChange={e => setNewLessonType({ ...newLessonType, max: parseInt(e.target.value) })}
                            />
                            <input 
                              type="number" 
                              placeholder="Rate" 
                              step="0.01"
                              style={{ ...styles.input, fontSize: 13, padding: '6px 10px' }}
                              value={newLessonType.rate}
                              onChange={e => setNewLessonType({ ...newLessonType, rate: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button 
                              style={{ ...styles.btn, ...styles.btnPrimary, flex: 1, padding: '6px 12px', fontSize: 13 }}
                              onClick={addCustomLessonType}
                            >
                              Add Type
                            </button>
                            <button 
                              style={{ ...styles.btn, ...styles.btnSecondary, flex: 1, padding: '6px 12px', fontSize: 13 }}
                              onClick={() => {
                                setShowAddLessonType(false);
                                setNewLessonType({ name: '', icon: '📚', color: '#3b82f6', max: 1, rate: 50 });
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Max Students</label>
                    <input type="number" style={styles.input} min={1} value={lessonForm.max_students} onChange={e => setLessonForm({ ...lessonForm, max_students: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Venue</label>
                    <select style={styles.select} value={lessonForm.venue_id} onChange={e => setLessonForm({ ...lessonForm, venue_id: e.target.value })}>
                      <option value="">Select venue...</option>
                      {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Rate ($)</label>
                    <input type="number" style={styles.input} step="0.01" value={lessonForm.rate} onChange={e => setLessonForm({ ...lessonForm, rate: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={{ ...styles.label, display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" style={styles.checkbox} checked={lessonForm.is_published} onChange={e => setLessonForm({ ...lessonForm, is_published: e.target.checked })} />
                    Published (visible for booking)
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={lessonForm.notes} onChange={e => setLessonForm({ ...lessonForm, notes: e.target.value })} />
                </div>
              </div>
              <div style={styles.modalFooter}>
                {editingItem && <button style={{ ...styles.btn, ...styles.btnDanger, marginRight: 'auto' }} onClick={() => deleteLesson(editingItem.id)}>Delete</button>}
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveLesson}>Save</button>
              </div>
            </>
          )}

          {/* EVENT MODAL */}
          {showModal === 'event' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Event' : 'New Event'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Event Name</label>
                  <input type="text" style={styles.input} value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="e.g., Winter Classic" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Event Type</label>
                  <select style={styles.select} value={eventForm.event_type} onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                  </select>
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Start Date</label>
                    <input type="date" style={styles.input} value={eventForm.start_date} onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>End Date</label>
                    <input type="date" style={styles.input} value={eventForm.end_date} onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Venue</label>
                  <select style={styles.select} value={eventForm.venue_id} onChange={e => setEventForm({ ...eventForm, venue_id: e.target.value })}>
                    <option value="">Select venue...</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={{ ...styles.label, display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" style={styles.checkbox} checked={eventForm.is_registrable} onChange={e => setEventForm({ ...eventForm, is_registrable: e.target.checked })} />
                    Allow student registration
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} />
                </div>
              </div>
              <div style={styles.modalFooter}>
                {editingItem && <button style={{ ...styles.btn, ...styles.btnDanger, marginRight: 'auto' }} onClick={() => deleteEvent(editingItem.id)}>Delete</button>}
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveEvent}>Save</button>
              </div>
            </>
          )}

          {/* CLIENT MODAL */}
          {showModal === 'client' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Client' : 'New Client'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input type="text" style={styles.input} value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} required />
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input type="email" style={styles.input} value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Phone</label>
                    <input type="tel" style={styles.input} value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Address</label>
                  <input type="text" style={styles.input} value={clientForm.address} onChange={e => setClientForm({ ...clientForm, address: e.target.value })} />
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>City</label>
                    <input type="text" style={styles.input} value={clientForm.city} onChange={e => setClientForm({ ...clientForm, city: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>State</label>
                    <input type="text" style={styles.input} value={clientForm.state} onChange={e => setClientForm({ ...clientForm, state: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>ZIP</label>
                  <input type="text" style={styles.input} value={clientForm.zip} onChange={e => setClientForm({ ...clientForm, zip: e.target.value })} />
                </div>
                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                <h4 style={{ marginBottom: 12 }}>Second Parent/Guardian (Optional)</h4>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name</label>
                  <input type="text" style={styles.input} value={clientForm.parent2_name} onChange={e => setClientForm({ ...clientForm, parent2_name: e.target.value })} />
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input type="email" style={styles.input} value={clientForm.parent2_email} onChange={e => setClientForm({ ...clientForm, parent2_email: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Phone</label>
                    <input type="tel" style={styles.input} value={clientForm.parent2_phone} onChange={e => setClientForm({ ...clientForm, parent2_phone: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} />
                </div>
                
                {/* Child/Student Information (only for new clients) */}
                {!editingItem && (
                  <>
                    <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    <h4 style={{ marginBottom: 8 }}>Student Information (Optional)</h4>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                      Add child's name to auto-create student record. Leave blank if client is the student (adult).
                    </p>
                    <div style={styles.row}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Child/Student Name</label>
                        <input 
                          type="text" 
                          style={styles.input} 
                          value={clientForm.child_name} 
                          onChange={e => setClientForm({ ...clientForm, child_name: e.target.value })} 
                          placeholder="Leave blank if client is the student"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Child Birthdate</label>
                        <input type="date" style={styles.input} value={clientForm.child_birthdate} onChange={e => setClientForm({ ...clientForm, child_birthdate: e.target.value })} />
                      </div>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Child Email (for self-login)</label>
                      <input type="email" style={styles.input} value={clientForm.child_email} onChange={e => setClientForm({ ...clientForm, child_email: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
              <div style={styles.modalFooter}>
                {editingItem && isCoach && <button style={{ ...styles.btn, ...styles.btnDanger, marginRight: 'auto' }} onClick={() => deleteClient(editingItem.id)}>Delete</button>}
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveClient}>Save</button>
              </div>
            </>
          )}

          {/* STUDENT MODAL */}
          {showModal === 'student' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Student' : 'New Student'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Parent/Client *</label>
                  <select style={styles.select} value={studentForm.client_id} onChange={e => setStudentForm({ ...studentForm, client_id: e.target.value })} required>
                    <option value="">Select parent...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Student Name {isCoach ? '*' : ''}</label>
                    <input 
                      type="text" 
                      style={styles.input} 
                      value={studentForm.name} 
                      onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} 
                      placeholder={isCoach ? '' : 'Leave blank to add yourself'}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input 
                      type="email" 
                      style={styles.input} 
                      value={studentForm.email} 
                      onChange={e => setStudentForm({ ...studentForm, email: e.target.value })} 
                      placeholder={isCoach ? 'Optional' : 'Optional (uses yours if blank)'}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Birthdate</label>
                  <input type="date" style={styles.input} value={studentForm.birthdate} onChange={e => setStudentForm({ ...studentForm, birthdate: e.target.value })} />
                </div>

                {/* ========== ISI SKILL LEVELS ========== */}
                <hr style={{ margin: '20px 0', border: 'none', borderTop: '2px solid #3b82f6' }} />
                <h3 style={{ marginBottom: 16, color: '#1e40af' }}>ISI Skill Levels</h3>

                {/* Row 1: Freestyle & Figures */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Freestyle Level</label>
                    <select style={styles.select} value={studentForm.isi_freestyle} onChange={e => setStudentForm({ ...studentForm, isi_freestyle: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_FREESTYLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Figures</label>
                    <select style={styles.select} value={studentForm.isi_figures} onChange={e => setStudentForm({ ...studentForm, isi_figures: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_FIGURES_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Couples & Pairs */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Couples</label>
                    <select style={styles.select} value={studentForm.isi_couples} onChange={e => setStudentForm({ ...studentForm, isi_couples: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_COUPLES_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Pairs</label>
                    <select style={styles.select} value={studentForm.isi_pairs} onChange={e => setStudentForm({ ...studentForm, isi_pairs: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_PAIRS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 3: Ice Dance & Pattern Dance Level */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Ice Dance</label>
                    <select style={styles.select} value={studentForm.isi_icedance} onChange={e => setStudentForm({ ...studentForm, isi_icedance: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_ICEDANCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Pattern Dance Level</label>
                    <select style={styles.select} value={studentForm.isi_international_dance_level} onChange={e => setStudentForm({ ...studentForm, isi_international_dance_level: e.target.value })}>
                      <option value="">Select level...</option>
                      <option value="Preliminary">Preliminary</option>
                      <option value="Pre-Bronze">Pre-Bronze</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Pre-Silver">Pre-Silver</option>
                      <option value="Silver">Silver</option>
                      <option value="Pre-Gold">Pre-Gold</option>
                      <option value="Gold">Gold</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                </div>

                {/* Pattern Dance - Dances Passed (conditional based on level selected) */}
                {studentForm.isi_international_dance_level && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      Pattern Dances Passed ({studentForm.isi_international_dance_level})
                    </label>
                    <input 
                      type="text" 
                      style={styles.input} 
                      value={studentForm.isi_international_dances} 
                      onChange={e => setStudentForm({ ...studentForm, isi_international_dances: e.target.value })}
                      placeholder={
                        studentForm.isi_international_dance_level === 'Preliminary' ? 'e.g., Dutch Waltz, Canasta Tango' :
                        studentForm.isi_international_dance_level === 'Pre-Bronze' ? 'e.g., Swing Dance, Cha Cha' :
                        studentForm.isi_international_dance_level === 'Bronze' ? 'e.g., Hickory Hoedown, Ten-Fox' :
                        studentForm.isi_international_dance_level === 'Pre-Silver' ? 'e.g., Fourteenstep, Foxtrot' :
                        studentForm.isi_international_dance_level === 'Silver' ? 'e.g., American Waltz, Tango' :
                        studentForm.isi_international_dance_level === 'Pre-Gold' ? 'e.g., Kilian, Blues, Paso Doble' :
                        studentForm.isi_international_dance_level === 'Gold' ? 'e.g., Viennese Waltz, Westminster Waltz' :
                        'e.g., Austrian Waltz, Finnstep'
                      }
                    />
                  </div>
                )}

                {/* Row 4: Free Dance Partnered & Solo Free Dance */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Free Dance Partnered</label>
                    <select style={styles.select} value={studentForm.isi_freedance_partnered} onChange={e => setStudentForm({ ...studentForm, isi_freedance_partnered: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_FREEDANCE_PARTNERED_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Open Solo Free Dance</label>
                    <select style={styles.select} value={studentForm.isi_solo_freedance} onChange={e => setStudentForm({ ...studentForm, isi_solo_freedance: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_SOLO_FREEDANCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 5: Synchro & Special Skater */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Synchro</label>
                    <select style={styles.select} value={studentForm.isi_synchro} onChange={e => setStudentForm({ ...studentForm, isi_synchro: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_SYNCHRO_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ISI Special Skater</label>
                    <select style={styles.select} value={studentForm.isi_special_skater} onChange={e => setStudentForm({ ...studentForm, isi_special_skater: e.target.value })}>
                      <option value="">Select level...</option>
                      {ISI_SPECIAL_SKATER_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* ISI Membership Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>ISI Membership Number</label>
                  <input type="text" style={styles.input} value={studentForm.isi_number} onChange={e => setStudentForm({ ...studentForm, isi_number: e.target.value })} />
                </div>

                {/* ========== USFSA TEST LEVELS ========== */}
                <hr style={{ margin: '20px 0', border: 'none', borderTop: '2px solid #10b981' }} />
                <h3 style={{ marginBottom: 16, color: '#047857' }}>USFSA Test Levels</h3>

                {/* Row 1: Skating Skills & Singles */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Skating Skills (Moves)</label>
                    <select style={styles.select} value={studentForm.usfsa_skating_skills} onChange={e => setStudentForm({ ...studentForm, usfsa_skating_skills: e.target.value })}>
                      <option value="">Select level...</option>
                      {USFSA_SKATING_SKILLS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Singles (Free Skate)</label>
                    <select style={styles.select} value={studentForm.usfsa_singles} onChange={e => setStudentForm({ ...studentForm, usfsa_singles: e.target.value })}>
                      <option value="">Select level...</option>
                      {USFSA_SINGLES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Pattern Dance Level & Pairs */}
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Pattern Dance Level</label>
                    <select style={styles.select} value={studentForm.usfsa_pattern_dance_level} onChange={e => setStudentForm({ ...studentForm, usfsa_pattern_dance_level: e.target.value })}>
                      <option value="">Select level...</option>
                      {USFSA_PATTERN_DANCE.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Pairs</label>
                    <select style={styles.select} value={studentForm.usfsa_pairs} onChange={e => setStudentForm({ ...studentForm, usfsa_pairs: e.target.value })}>
                      <option value="">Select level...</option>
                      {USFSA_PAIRS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Pattern Dances Passed (conditional) */}
                {studentForm.usfsa_pattern_dance_level && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      Pattern Dances Passed ({studentForm.usfsa_pattern_dance_level})
                    </label>
                    <input 
                      type="text" 
                      style={styles.input} 
                      value={studentForm.usfsa_pattern_dances} 
                      onChange={e => setStudentForm({ ...studentForm, usfsa_pattern_dances: e.target.value })}
                      placeholder={
                        studentForm.usfsa_pattern_dance_level === 'Preliminary' ? 'e.g., Dutch Waltz, Canasta Tango, Rhythm Blues' :
                        studentForm.usfsa_pattern_dance_level === 'Pre-Bronze' ? 'e.g., Swing Dance, Cha Cha, Fiesta Tango' :
                        studentForm.usfsa_pattern_dance_level === 'Bronze' ? 'e.g., Hickory Hoedown, Willow Waltz, Ten-Fox' :
                        studentForm.usfsa_pattern_dance_level === 'Pre-Silver' ? 'e.g., Fourteenstep, European Waltz, Foxtrot' :
                        studentForm.usfsa_pattern_dance_level === 'Silver' ? 'e.g., American Waltz, Tango, Rocker Foxtrot' :
                        studentForm.usfsa_pattern_dance_level === 'Pre-Gold' ? 'e.g., Kilian, Blues, Paso Doble, Starlight Waltz' :
                        studentForm.usfsa_pattern_dance_level === 'Gold' ? 'e.g., Viennese Waltz, Westminster Waltz, Quickstep, Argentine Tango' :
                        'e.g., Austrian Waltz, Cha Cha Congelado, Finnstep'
                      }
                    />
                  </div>
                )}

                {/* Free Dance */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Free Dance</label>
                  <select style={styles.select} value={studentForm.usfsa_free_dance} onChange={e => setStudentForm({ ...studentForm, usfsa_free_dance: e.target.value })}>
                    <option value="">Select level...</option>
                    {USFSA_FREE_DANCE.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* USFSA Membership Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>USFSA Membership Number</label>
                  <input type="text" style={styles.input} value={studentForm.usfsa_number} onChange={e => setStudentForm({ ...studentForm, usfsa_number: e.target.value })} />
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={studentForm.notes} onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })} />
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveStudent}>Save</button>
              </div>
            </>
          )}

          {/* VENUE MODAL */}
          {showModal === 'venue' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Venue' : 'New Venue'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Venue Name *</label>
                  <input type="text" style={styles.input} value={venueForm.name} onChange={e => setVenueForm({ ...venueForm, name: e.target.value })} placeholder="e.g., Winterland Ice Arena" required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Address</label>
                  <input type="text" style={styles.input} value={venueForm.address} onChange={e => setVenueForm({ ...venueForm, address: e.target.value })} placeholder="123 Ice Way, Skating City, ST 12345" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Color (for calendar dot)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input 
                      type="color" 
                      style={{ width: 60, height: 40, border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer' }}
                      value={venueForm.color} 
                      onChange={e => setVenueForm({ ...venueForm, color: e.target.value })} 
                    />
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      A small dot in this color will appear on lessons at this venue
                    </span>
                  </div>
                </div>
              </div>
              <div style={styles.modalFooter}>
                {editingItem && <button style={{ ...styles.btn, ...styles.btnDanger, marginRight: 'auto' }} onClick={() => deleteVenue(editingItem.id)}>Delete</button>}
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveVenue}>Save</button>
              </div>
            </>
          )}

          {/* EXPENSE MODAL */}
          {showModal === 'expense' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Expense' : 'New Expense'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Date *</label>
                    <input type="date" style={styles.input} value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Amount *</label>
                    <input type="number" style={styles.input} step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
                  <select style={styles.select} value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Description</label>
                  <input type="text" style={styles.input} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Vendor</label>
                    <input type="text" style={styles.input} value={expenseForm.vendor} onChange={e => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Payment Method</label>
                    <select style={styles.select} value={expenseForm.payment_method} onChange={e => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveExpense}>Save</button>
              </div>
            </>
          )}

          {/* MILEAGE MODAL */}
          {showModal === 'mileage' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{editingItem ? 'Edit Mileage' : 'Log Mileage'}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Entry Type</label>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="radio" name="entry_type" value="manual" checked={mileageForm.entry_type === 'manual'} onChange={e => setMileageForm({ ...mileageForm, entry_type: e.target.value, miles: '', odometer_start: '', odometer_end: '' })} style={{ marginRight: 6 }} />
                      Manual Entry
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="radio" name="entry_type" value="odometer" checked={mileageForm.entry_type === 'odometer'} onChange={e => setMileageForm({ ...mileageForm, entry_type: e.target.value, miles: '', odometer_start: '', odometer_end: '' })} style={{ marginRight: 6 }} />
                      Odometer Reading
                    </label>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date *</label>
                  <input type="date" style={styles.input} value={mileageForm.date} onChange={e => setMileageForm({ ...mileageForm, date: e.target.value })} required />
                </div>
                
                {mileageForm.entry_type === 'manual' ? (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Miles *</label>
                    <input type="number" style={styles.input} step="0.1" value={mileageForm.miles} onChange={e => setMileageForm({ ...mileageForm, miles: e.target.value })} required placeholder="e.g., 25.5" />
                  </div>
                ) : (
                  <div style={styles.row}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Start Odometer *</label>
                      <input type="number" style={styles.input} step="0.1" value={mileageForm.odometer_start} onChange={e => setMileageForm({ ...mileageForm, odometer_start: e.target.value })} required placeholder="e.g., 45230.5" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>End Odometer *</label>
                      <input type="number" style={styles.input} step="0.1" value={mileageForm.odometer_end} onChange={e => setMileageForm({ ...mileageForm, odometer_end: e.target.value })} required placeholder="e.g., 45256.0" />
                    </div>
                  </div>
                )}
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Description</label>
                  <input type="text" style={styles.input} value={mileageForm.description} onChange={e => setMileageForm({ ...mileageForm, description: e.target.value })} placeholder="e.g., Round trip to Winterland Arena" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>IRS Rate ($/mile)</label>
                  <input type="number" style={styles.input} step="0.01" value={mileageForm.rate} onChange={e => setMileageForm({ ...mileageForm, rate: e.target.value })} />
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>2025 IRS standard rate: $0.70/mile</div>
                </div>
                {(() => {
                  const miles = mileageForm.entry_type === 'odometer' && mileageForm.odometer_start && mileageForm.odometer_end
                    ? parseFloat(mileageForm.odometer_end) - parseFloat(mileageForm.odometer_start)
                    : parseFloat(mileageForm.miles) || 0;
                  return miles > 0 && mileageForm.rate ? (
                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginTop: 8 }}>
                      <strong>Miles:</strong> {miles.toFixed(1)}<br />
                      <strong>Deduction:</strong> {formatCurrency(miles * parseFloat(mileageForm.rate))}
                    </div>
                  ) : null;
                })()}
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveMileage}>Save</button>
              </div>
            </>
          )}

          {/* INVOICE MODAL */}
          {showModal === 'invoice' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Create Invoice</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Client *</label>
                  <select style={styles.select} value={invoiceForm.client_id} onChange={e => {
                    const { lessons: unbilled, lateCancellations } = getUnbilledLessons(e.target.value);
                    const lessonsTotal = unbilled.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
                    const lateCancelTotal = lateCancellations.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
                    setInvoiceForm({ 
                      ...invoiceForm, 
                      client_id: e.target.value, 
                      lessons: unbilled.map(l => l.id), 
                      lateCancellations: lateCancellations.map(l => l.id),
                      amount: lessonsTotal + lateCancelTotal 
                    });
                  }}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
                  <strong>Completed Lessons:</strong> {invoiceForm.lessons.length}<br />
                  {invoiceForm.lateCancellations?.length > 0 && (
                    <><strong style={{ color: '#ef4444' }}>Late Cancellations:</strong> {invoiceForm.lateCancellations.length}<br /></>
                  )}
                  <strong>Subtotal:</strong> {formatCurrency(invoiceForm.amount)}
                </div>
                <div style={styles.row}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Tax Rate (%)</label>
                    <input type="number" style={styles.input} step="0.01" value={invoiceForm.tax_rate} onChange={e => setInvoiceForm({ ...invoiceForm, tax_rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Due Date</label>
                    <input type="date" style={styles.input} value={invoiceForm.due_date} onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                  </div>
                </div>
                
                {/* Payment Methods */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Accepted Payment Methods</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      <input type="checkbox" checked={invoiceForm.payment_cash} onChange={e => setInvoiceForm({ ...invoiceForm, payment_cash: e.target.checked })} style={{ marginRight: 6 }} />
                      Cash
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      <input type="checkbox" checked={invoiceForm.payment_check} onChange={e => setInvoiceForm({ ...invoiceForm, payment_check: e.target.checked })} style={{ marginRight: 6 }} />
                      Check
                    </label>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Venmo</label>
                      <input type="text" style={styles.input} value={invoiceForm.payment_venmo} onChange={e => setInvoiceForm({ ...invoiceForm, payment_venmo: e.target.value })} placeholder="@username" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>PayPal</label>
                      <input type="text" style={styles.input} value={invoiceForm.payment_paypal} onChange={e => setInvoiceForm({ ...invoiceForm, payment_paypal: e.target.value })} placeholder="email@example.com" />
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Zelle</label>
                      <input type="text" style={styles.input} value={invoiceForm.payment_zelle} onChange={e => setInvoiceForm({ ...invoiceForm, payment_zelle: e.target.value })} placeholder="phone or email" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Cash App</label>
                      <input type="text" style={styles.input} value={invoiceForm.payment_cashapp} onChange={e => setInvoiceForm({ ...invoiceForm, payment_cashapp: e.target.value })} placeholder="$cashtag" />
                    </div>
                  </div>
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={styles.textarea} value={invoiceForm.notes} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
                </div>
                <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8 }}>
                  <strong>Total:</strong> {formatCurrency(invoiceForm.amount * (1 + invoiceForm.tax_rate / 100))}
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveInvoice} disabled={!invoiceForm.client_id}>Create Invoice</button>
              </div>
            </>
          )}

          {/* COPY DAY MODAL */}
          {showModal === 'copyDay' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Copy Day</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <p style={{ marginBottom: 16 }}>
                  Copy all lessons from <strong>{copySource?.toLocaleDateString()}</strong> to:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {getWeekDates(copySource || currentDate).map((date, idx) => {
                    const isCopySource = copySource && date.toDateString() === copySource.toDateString();
                    const isSelected = copyTargetDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        style={{
                          ...styles.btn,
                          ...(isSelected ? styles.btnPrimary : styles.btnSecondary),
                          opacity: isCopySource ? 0.5 : 1
                        }}
                        disabled={isCopySource}
                        onClick={() => {
                          if (isSelected) {
                            setCopyTargetDays(copyTargetDays.filter(d => d !== idx));
                          } else {
                            setCopyTargetDays([...copyTargetDays, idx]);
                          }
                        }}
                      >
                        {DAY_NAMES[idx]}
                        <br />
                        <span style={{ fontSize: 12 }}>{date.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
                  Copied lessons will be unpublished (drafts). Conflicts will be skipped.
                </p>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={executeCopyDay} disabled={copyTargetDays.length === 0}>
                  Copy to {copyTargetDays.length} Day{copyTargetDays.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {/* COPY WEEK MODAL */}
          {showModal === 'copyWeek' && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Copy Week</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <p style={{ marginBottom: 16 }}>
                  Copy this week's schedule to future weeks:
                </p>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of weeks to copy ahead</label>
                  <select style={styles.select} value={copyWeeks} onChange={e => setCopyWeeks(parseInt(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <option key={n} value={n}>{n} week{n !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Copied lessons will be unpublished (drafts). Conflicts will be skipped.
                </p>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={executeCopyWeek}>
                  Copy to {copyWeeks} Week{copyWeeks !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {/* COMPETITION REGISTRATION MODAL */}
          {showModal === 'registerCompetition' && registerCompetition && (
            <>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Register for {registerCompetition.name}</h3>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>✕</button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Student</label>
                  <select style={styles.select} value={registerStudentId} onChange={e => setRegisterStudentId(e.target.value)}>
                    <option value="">Choose a student...</option>
                    {students.map(s => {
                      const alreadyRegistered = bookings.some(b => 
                        b.event_id === registerCompetition.id && 
                        b.student_id === s.id && 
                        b.status !== 'cancelled'
                      );
                      return (
                        <option key={s.id} value={s.id} disabled={alreadyRegistered}>
                          {s.name} {alreadyRegistered ? '(already registered)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <strong>Event:</strong> {registerCompetition.name}<br />
                  <strong>Date:</strong> {formatDate(registerCompetition.start_date)}
                  {registerCompetition.end_date && registerCompetition.end_date !== registerCompetition.start_date && ` - ${formatDate(registerCompetition.end_date)}`}
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeModal}>Cancel</button>
                <button style={{ ...styles.btn, ...styles.btnSuccess }} onClick={registerForCompetition} disabled={!registerStudentId}>
                  Register
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  const coachTabs = [
    { id: 'calendar', label: '📅 Calendar' },
    { id: 'clients', label: '👥 Clients' },
    { id: 'students', label: '⛸️ Students' },
    { id: 'events', label: '🏆 Events' },
    { id: 'venues', label: '🏟️ Venues' },
    { id: 'invoices', label: '💵 Invoices' },
    { id: 'expenses', label: '📊 Expenses' },
    { id: 'mileage', label: '🚗 Mileage' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  const clientTabs = [
    { id: 'booking', label: '📅 Book Lessons' },
    { id: 'mystudents', label: '⛸️ My Students' },
    { id: 'events', label: '🏆 Events' }
  ];

  const tabs = isCoach ? coachTabs : clientTabs;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>⛸️ IceBooks Pro</div>
          <div style={styles.userInfo}>
            <span>{profile?.name}</span>
            <span style={{ ...styles.badge, ...styles.badgeInfo }}>{isCoach ? 'Coach' : 'Client'}</span>
            <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <nav style={styles.nav}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{ ...styles.navBtn, ...(activeTab === tab.id ? styles.navBtnActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {isCoach ? (
          <>
            {activeTab === 'calendar' && renderCalendar()}
            {activeTab === 'clients' && renderClients()}
            {activeTab === 'students' && renderStudents()}
            {activeTab === 'events' && renderEvents()}
            {activeTab === 'venues' && renderVenues()}
            {activeTab === 'invoices' && renderInvoices()}
            {activeTab === 'expenses' && renderExpenses()}
            {activeTab === 'mileage' && renderMileage()}
            {activeTab === 'settings' && renderSettings()}
          </>
        ) : (
          <>
            {activeTab === 'booking' && renderClientBooking()}
            {activeTab === 'mystudents' && renderMyStudents()}
            {activeTab === 'events' && renderEvents()}
          </>
        )}
      </main>

      {renderModal()}

      {toast && <div style={styles.toast}>{toast}</div>}

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
