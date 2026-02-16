// App.jsx
import React, { useState, useEffect } from "react";
var { createClient } = window.supabase || { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {
} } } }) }, from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [] }), eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }), single: () => Promise.resolve({ data: null }) }) }) }) };
var supabaseUrl = window.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
var supabaseKey = window.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);
var DEFAULT_MILEAGE_RATE = 0.7;
var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var CANCELLATION_WINDOW_HOURS = 24;
var LESSON_TYPES = [
  { id: "private", name: "Private", icon: "\u{1F464}", color: "#3b82f6", max: 1, rate: 75 },
  { id: "shared", name: "Shared", icon: "\u{1F465}", color: "#8b5cf6", max: 2, rate: 50 },
  { id: "group", name: "Group", icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}", color: "#10b981", max: 8, rate: 35 }
];
var EVENT_TYPES = [
  { id: "competition", name: "Competition", icon: "\u{1F3C6}", color: "#f59e0b" },
  { id: "show", name: "Ice Show", icon: "\u2B50", color: "#ec4899" },
  { id: "testing", name: "Testing", icon: "\u{1F4CB}", color: "#14b8a6" },
  { id: "personal", name: "Personal", icon: "\u{1F4C5}", color: "#6366f1" },
  { id: "blocked", name: "Blocked", icon: "\u{1F6AB}", color: "#ef4444" }
];
var EXPENSE_CATEGORIES = [
  "Ice Time",
  "Music/Choreography",
  "Costumes",
  "Equipment",
  "Travel",
  "Training/Seminars",
  "Coaching Fees",
  "Membership Dues",
  "Insurance",
  "Other"
];
var PAYMENT_METHODS = ["Cash", "Check", "Venmo", "PayPal", "Zelle", "Credit Card", "Bank Transfer"];
var ISI_FREESTYLE_LEVELS = [
  "Tots",
  "Pre-Alpha",
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Freestyle 1",
  "Freestyle 2",
  "Freestyle 3",
  "Freestyle 4",
  "Freestyle 5",
  "Freestyle 6",
  "Freestyle 7",
  "Freestyle 8",
  "Freestyle 9",
  "Freestyle 10",
  "Open Freestyle Bronze",
  "Open Freestyle Silver",
  "Open Freestyle Gold",
  "Open Freestyle Platinum"
];
var ISI_FIGURES_LEVELS = Array.from({ length: 10 }, (_, i) => `Figures ${i + 1}`);
var ISI_COUPLES_LEVELS = Array.from({ length: 10 }, (_, i) => `Couples ${i + 1}`);
var ISI_PAIRS_LEVELS = Array.from({ length: 10 }, (_, i) => `Pairs ${i + 1}`);
var ISI_ICEDANCE_LEVELS = Array.from({ length: 10 }, (_, i) => `Ice Dance ${i + 1}`);
var ISI_INTERNATIONAL_DANCE_ALL = [
  // Preliminary
  "Dutch Waltz",
  "Canasta Tango",
  "Rhythm Blues",
  // Pre-Bronze
  "Swing Dance",
  "Cha Cha",
  "Fiesta Tango",
  // Bronze
  "Hickory Hoedown",
  "Willow Waltz",
  "Ten-Fox",
  // Pre-Silver
  "Fourteenstep",
  "European Waltz",
  "Foxtrot",
  // Silver
  "American Waltz",
  "Tango",
  "Rocker Foxtrot",
  // Pre-Gold
  "Kilian",
  "Blues",
  "Paso Doble",
  "Starlight Waltz",
  // Gold
  "Viennese Waltz",
  "Westminster Waltz",
  "Quickstep",
  "Argentine Tango",
  // International
  "Austrian Waltz",
  "Cha Cha Congelado",
  "Finnstep",
  "Golden Waltz",
  "Midnight Blues",
  "Ravensburger Waltz",
  "Rhumba",
  "Silver Samba",
  "Tango Romantica",
  "Yankee Polka"
];
var ISI_FREEDANCE_PARTNERED_LEVELS = Array.from({ length: 10 }, (_, i) => `Free Dance Partnered ${i + 1}`);
var ISI_SOLO_FREEDANCE_LEVELS = [
  "Open Solo Free Dance Bronze",
  "Open Solo Free Dance Silver",
  "Open Solo Free Dance Gold",
  "Open Solo Free Dance Platinum",
  "Open Solo Free Dance Diamond"
];
var ISI_SYNCHRO_LEVELS = Array.from({ length: 4 }, (_, i) => `Synchro ${i + 1}`);
var ISI_SPECIAL_SKATER_LEVELS = Array.from({ length: 10 }, (_, i) => `Special Skater ${i + 1}`);
var USFSA_SKATING_SKILLS = [
  "Pre-Preliminary",
  "Preliminary",
  "Pre-Juvenile",
  "Juvenile",
  "Intermediate",
  "Novice",
  "Junior",
  "Senior"
];
var USFSA_SINGLES = [
  "Pre-Preliminary",
  "Preliminary",
  "Pre-Juvenile",
  "Juvenile",
  "Intermediate",
  "Novice",
  "Junior",
  "Senior"
];
var USFSA_FREE_DANCE = [
  "Juvenile/Bronze",
  "Intermediate/Pre-Silver",
  "Novice/Silver",
  "Junior/Pre-Gold",
  "Senior/Gold"
];
var USFSA_PAIRS = [
  "Preliminary",
  "Juvenile",
  "Intermediate",
  "Novice",
  "Junior",
  "Senior"
];
function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState("calendar");
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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
  const [currentDate, setCurrentDate] = useState(/* @__PURE__ */ new Date());
  const [calendarView, setCalendarView] = useState(isMobile ? "day" : "week");
  const [selectedDate, setSelectedDate] = useState(isMobile ? /* @__PURE__ */ new Date() : null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [customLessonTypes, setCustomLessonTypes] = useState([]);
  const [showAddLessonType, setShowAddLessonType] = useState(false);
  const [newLessonType, setNewLessonType] = useState({ name: "", icon: "\u{1F4DA}", color: "#3b82f6", max: 1, rate: 50 });
  const [showModal, setShowModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [lessonForm, setLessonForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "09:30",
    lesson_type: "private",
    venue_id: "",
    max_students: 1,
    is_published: false,
    notes: "",
    rate: 75
  });
  const [eventForm, setEventForm] = useState({
    name: "",
    event_type: "competition",
    start_date: "",
    end_date: "",
    venue_id: "",
    notes: "",
    is_registrable: false
  });
  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    parent2_name: "",
    parent2_email: "",
    parent2_phone: "",
    notes: "",
    // Child fields for auto-creating student - NO skill levels (those go on student form only)
    child_name: "",
    child_email: "",
    child_birthdate: ""
  });
  const [studentForm, setStudentForm] = useState({
    client_id: "",
    name: "",
    email: "",
    birthdate: "",
    // ISI Disciplines (10 dropdowns)
    isi_freestyle: "",
    isi_figures: "",
    isi_couples: "",
    isi_pairs: "",
    isi_icedance: "",
    isi_international_dance: "",
    // Single dropdown with all dances in order
    isi_freedance_partnered: "",
    isi_solo_freedance: "",
    isi_synchro: "",
    isi_special_skater: "",
    isi_number: "",
    // USFSA Disciplines
    usfsa_skating_skills: "",
    usfsa_singles: "",
    usfsa_pattern_dance: "",
    // Single dropdown with all dances in order
    usfsa_free_dance: "",
    usfsa_pairs: "",
    usfsa_number: "",
    notes: ""
  });
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: "",
    lessons: [],
    lateCancellations: [],
    amount: 0,
    tax_rate: 0,
    notes: "",
    due_date: "",
    payment_cash: false,
    payment_check: false,
    payment_venmo: "",
    payment_paypal: "",
    payment_zelle: "",
    payment_cashapp: ""
  });
  const [expenseForm, setExpenseForm] = useState({
    date: "",
    category: "Ice Time",
    description: "",
    amount: "",
    vendor: "",
    payment_method: "Credit Card"
  });
  const [mileageForm, setMileageForm] = useState({
    date: "",
    description: "",
    miles: "",
    rate: DEFAULT_MILEAGE_RATE,
    odometer_start: "",
    odometer_end: "",
    entry_type: "manual"
  });
  const [paymentSettings, setPaymentSettings] = useState({
    cash: false,
    check: false,
    venmo: "",
    paypal: "",
    zelle: "",
    cashapp: ""
  });
  const [reportSettings, setReportSettings] = useState({
    expense_categories: EXPENSE_CATEGORIES,
    mileage_rate: DEFAULT_MILEAGE_RATE,
    vehicle_expense_method: "standard"
  });
  const [reportType, setReportType] = useState("pl");
  const [reportDateRange, setReportDateRange] = useState({
    start: new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0],
    end: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  });
  const [copySource, setCopySource] = useState(null);
  const [copyTargetDays, setCopyTargetDays] = useState([]);
  const [copyWeeks, setCopyWeeks] = useState(1);
  const [registerCompetition, setRegisterCompetition] = useState(null);
  const [registerStudentId, setRegisterStudentId] = useState("");
  const [bookingLesson, setBookingLesson] = useState(null);
  const isCoach = profile?.role === "coach";
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: session2 } }) => {
      setSession(session2);
      if (session2) loadProfile(session2.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session2) => {
      setSession(session2);
      if (session2) loadProfile(session2.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (error) throw error;
      setProfile(data);
      loadData(data);
    } catch (err) {
      console.error("Profile load error:", err);
      setLoading(false);
    }
  };
  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
    }
  };
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { name: authName } }
      });
      if (error) throw error;
      notify("Check your email to confirm your account!");
      setAuthMode("signin");
    } catch (err) {
      setAuthError(err.message);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthError("");
    setActiveTab("calendar");
  };
  const loadData = async (prof) => {
    try {
      setLoading(true);
      const promises = [
        supabase.from("lessons").select("*").order("date"),
        supabase.from("events").select("*").order("start_date"),
        supabase.from("venues").select("*").order("name"),
        supabase.from("rates").select("*")
      ];
      if (prof.role === "coach") {
        promises.push(
          supabase.from("clients").select("*").order("name"),
          supabase.from("students").select("*").order("name"),
          supabase.from("bookings").select("*"),
          supabase.from("invoices").select("*").order("created_at", { ascending: false }),
          supabase.from("expenses").select("*").order("date", { ascending: false }),
          supabase.from("mileage").select("*").order("date", { ascending: false })
        );
      } else {
        const { data: clientsData } = await supabase.from("clients").select("*").eq("profile_id", prof.id);
        const clientIds = (clientsData || []).map((c) => c.id);
        let studentsData = [];
        if (clientIds.length > 0) {
          const { data } = await supabase.from("students").select("*").in("client_id", clientIds);
          studentsData = data || [];
        }
        promises.push(
          Promise.resolve({ data: clientsData }),
          Promise.resolve({ data: studentsData }),
          supabase.from("bookings").select("*")
        );
      }
      const results = await Promise.all(promises);
      setLessons(results[0].data || []);
      setEvents(results[1].data || []);
      setVenues(results[2].data || []);
      setRates(results[3].data || []);
      if (prof.role === "coach") {
        setClients(results[4].data || []);
        setStudents(results[5].data || []);
        setBookings(results[6].data || []);
        setInvoices(results[7].data || []);
        setExpenses(results[8].data || []);
        setMileage(results[9].data || []);
        const { data: settings, error: settingsError } = await supabase.from("settings").select("*").single();
        if (settingsError) {
          console.log("Settings not found, using defaults:", settingsError);
        }
        if (settings) {
          setPaymentSettings({
            cash: settings.payment_cash || false,
            check: settings.payment_check || false,
            venmo: settings.payment_venmo || "",
            paypal: settings.payment_paypal || "",
            zelle: settings.payment_zelle || "",
            cashapp: settings.payment_cashapp || ""
          });
          if (settings.expense_categories) {
            try {
              const categories = typeof settings.expense_categories === "string" ? JSON.parse(settings.expense_categories) : settings.expense_categories;
              setReportSettings((prev) => ({ ...prev, expense_categories: categories }));
            } catch (e) {
              console.error("Error parsing expense categories:", e);
            }
          }
          if (settings.mileage_rate !== void 0 && settings.mileage_rate !== null) {
            setReportSettings((prev) => ({ ...prev, mileage_rate: settings.mileage_rate }));
          }
          if (settings.vehicle_expense_method) {
            setReportSettings((prev) => ({ ...prev, vehicle_expense_method: settings.vehicle_expense_method }));
          }
          if (settings.custom_lesson_types) {
            try {
              setCustomLessonTypes(JSON.parse(settings.custom_lesson_types));
            } catch (e) {
              console.error("Error parsing custom lesson types:", e);
            }
          }
        }
        const { data: notifs } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
        setNotifications(notifs || []);
      } else {
        setClients(results[4].data || []);
        setStudents(results[5].data || []);
        setBookings(results[6].data || []);
      }
    } catch (err) {
      console.error("Load error:", err);
      notify("Error loading data");
    } finally {
      setLoading(false);
    }
  };
  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3e3);
  };
  const formatDate = (d) => new Date(d).toLocaleDateString();
  const toDateStr = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };
  const formatCurrency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
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
    for (let i = firstDay.getDay() - 1; i >= 0; i--) {
      days.push({ date: new Date(year, m, -i), outside: true });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, m, i), outside: false });
    }
    while (days.length < 42) {
      days.push({ date: new Date(year, m + 1, days.length - lastDay.getDate() - firstDay.getDay() + 1), outside: true });
    }
    return days;
  };
  const getLessonType = (id) => {
    const custom = customLessonTypes.find((t) => t.id === id);
    if (custom) return custom;
    return LESSON_TYPES.find((t) => t.id === id) || LESSON_TYPES[0];
  };
  const getEventType = (id) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[0];
  const getAllLessonTypes = () => [...LESSON_TYPES, ...customLessonTypes];
  const createNotification = async (type, message, lessonId = null, eventId = null, studentId = null) => {
    try {
      const { error } = await supabase.from("notifications").insert({
        type,
        message,
        lesson_id: lessonId,
        event_id: eventId,
        student_id: studentId,
        read: false
      });
      if (!error) loadData(profile);
    } catch (err) {
      console.error("Notification error:", err);
    }
  };
  const markNotificationRead = async (id) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    loadData(profile);
  };
  const markAllNotificationsRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    loadData(profile);
  };
  const saveCustomLessonTypes = async (types) => {
    try {
      const { error } = await supabase.from("settings").update({
        custom_lesson_types: JSON.stringify(types)
      }).eq("id", 1);
      if (error) throw error;
      setCustomLessonTypes(types);
      notify("Custom lesson types saved");
    } catch (err) {
      notify("Error saving: " + err.message);
    }
  };
  const addCustomLessonType = async () => {
    if (!newLessonType.name.trim()) {
      notify("Please enter a name");
      return;
    }
    const newType = {
      ...newLessonType,
      id: "custom_" + Date.now()
    };
    const updated = [...customLessonTypes, newType];
    await saveCustomLessonTypes(updated);
    setNewLessonType({ name: "", icon: "\u{1F4DA}", color: "#3b82f6", max: 1, rate: 50 });
    setShowAddLessonType(false);
  };
  const printDaySchedule = () => {
    if (!selectedDate) return;
    const dateStr = selectedDate.toLocaleDateString();
    const dayLessons = lessons.filter((l) => l.date === selectedDate.toISOString().split("T")[0]).sort((a, b) => a.start_time.localeCompare(b.start_time));
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
      dayLessons.forEach((lesson) => {
        const lt = getLessonType(lesson.lesson_type);
        const venue = venues.find((v) => v.id === lesson.venue_id);
        const lessonBookings = bookings.filter((b) => b.lesson_id === lesson.id && b.status !== "cancelled");
        if (lessonBookings.length === 0) {
          html += `<tr><td>${lesson.start_time} - ${lesson.end_time}</td><td>${lt.icon} ${lt.name}</td><td>${venue?.name || ""}</td><td colspan="3" style="color: #9ca3af;">No bookings</td></tr>`;
        } else {
          lessonBookings.forEach((booking, idx) => {
            const student = students.find((s) => s.id === booking.student_id);
            const client = clients.find((c) => c.id === student?.client_id);
            if (idx === 0) {
              html += `<tr><td rowspan="${lessonBookings.length}">${lesson.start_time} - ${lesson.end_time}</td><td rowspan="${lessonBookings.length}">${lt.icon} ${lt.name}</td><td rowspan="${lessonBookings.length}">${venue?.name || ""}</td>`;
            } else {
              html += "<tr>";
            }
            html += `<td>${student?.name || "Unknown"}</td><td>${client?.name || ""}<br/>${client?.phone || ""}</td><td>${student?.isi_level || student?.usfsa_level || ""}</td></tr>`;
          });
        }
      });
    }
    html += "</tbody></table></body></html>";
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };
  const generateICS = () => {
    const items = [];
    lessons.forEach((l) => {
      const lt = getLessonType(l.lesson_type);
      const venue = venues.find((v) => v.id === l.venue_id);
      const lessonBookings = bookings.filter((b) => b.lesson_id === l.id && b.status !== "cancelled");
      const bookedNames = lessonBookings.map((b) => students.find((s) => s.id === b.student_id)?.name).filter(Boolean).join(", ");
      const dateStr = l.date.replace(/-/g, "");
      const startStr = l.start_time.replace(/:/g, "") + "00";
      const endStr = l.end_time.replace(/:/g, "") + "00";
      items.push([
        "BEGIN:VEVENT",
        `UID:icebooks-lesson-${l.id}@icebooks`,
        `DTSTAMP:${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART:${dateStr}T${startStr}`,
        `DTEND:${dateStr}T${endStr}`,
        `SUMMARY:${lt.icon} ${lt.name}${bookedNames ? ` - ${bookedNames}` : ""}`,
        `LOCATION:${venue?.name || ""}`,
        `STATUS:${l.is_published ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT"
      ].join("\r\n"));
    });
    events.forEach((e) => {
      const et = getEventType(e.event_type);
      const dateStr = e.start_date.replace(/-/g, "");
      const endDateStr = (e.end_date || e.start_date).replace(/-/g, "");
      items.push([
        "BEGIN:VEVENT",
        `UID:icebooks-event-${e.id}@icebooks`,
        `DTSTAMP:${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${endDateStr}`,
        `SUMMARY:${et.icon} ${e.name}`,
        `DESCRIPTION:${e.notes || ""}`,
        "END:VEVENT"
      ].join("\r\n"));
    });
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//IceBooks Pro//EN",
      "X-WR-CALNAME:IceBooks Schedule",
      "METHOD:PUBLISH",
      ...items,
      "END:VCALENDAR"
    ].join("\r\n");
  };
  const exportICS = () => {
    const ics = generateICS();
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `icebooks-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Calendar exported! Import into Google/Outlook/Apple Calendar.");
  };
  const importICS = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const importedEvents = [];
    let curr = null;
    content.split(/\r?\n/).forEach((line) => {
      if (line.startsWith("BEGIN:VEVENT")) {
        curr = {};
      } else if (line.startsWith("END:VEVENT") && curr?.date) {
        importedEvents.push(curr);
        curr = null;
      } else if (curr) {
        if (line.startsWith("SUMMARY:")) {
          curr.name = line.slice(8).replace(/\\,/g, ",").replace(/\\n/g, " ");
        } else if (line.startsWith("DTSTART")) {
          const v = line.split(":").pop().replace(/[^0-9T]/g, "");
          if (v.length >= 8) {
            curr.date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
            if (v.includes("T") && v.length >= 13) {
              curr.start_time = `${v.split("T")[1].slice(0, 2)}:${v.split("T")[1].slice(2, 4)}`;
            }
          }
        } else if (line.startsWith("DTEND") && line.includes("T")) {
          const v = line.split(":").pop().replace(/[^0-9T]/g, "");
          if (v.length >= 13) {
            curr.end_time = `${v.split("T")[1].slice(0, 2)}:${v.split("T")[1].slice(2, 4)}`;
          }
        } else if (line.startsWith("LOCATION:")) {
          curr.location = line.slice(9).replace(/\\,/g, ",");
        }
      }
    });
    let imported = 0;
    for (const ev of importedEvents) {
      if (ev.name && ev.date) {
        const { error } = await supabase.from("events").insert({
          name: ev.name.slice(0, 100),
          event_type: "personal",
          start_date: ev.date,
          end_date: ev.date,
          notes: `Imported from ICS${ev.location ? ` - Location: ${ev.location}` : ""}`
        });
        if (!error) imported++;
      }
    }
    if (imported > 0) {
      notify(`Imported ${imported} events! Check the Events tab.`);
      loadData();
    } else {
      notify("No events found in file.");
    }
    e.target.value = "";
  };
  const getLiveSyncUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const token = session?.access_token?.slice(0, 20) || "demo";
    return `${supabaseUrl}/functions/v1/calendar-feed?token=${token}`;
  };
  const copyLiveSyncUrl = () => {
    const url = getLiveSyncUrl();
    navigator.clipboard.writeText(url).then(() => {
      notify("Live Sync URL copied! Paste into Google Calendar or Outlook.");
    }).catch(() => {
      prompt("Copy this URL:", url);
    });
  };
  const openLessonModal = (lesson = null, date = null) => {
    if (lesson) {
      setEditingItem(lesson);
      setLessonForm({
        date: lesson.date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        lesson_type: lesson.lesson_type,
        venue_id: lesson.venue_id || "",
        max_students: lesson.max_students,
        is_published: lesson.is_published,
        notes: lesson.notes || "",
        rate: lesson.rate || getLessonType(lesson.lesson_type).rate
      });
    } else {
      setEditingItem(null);
      const dateStr = date ? toDateStr(date) : toDateStr(/* @__PURE__ */ new Date());
      setLessonForm({
        date: dateStr,
        start_time: "09:00",
        end_time: "09:30",
        lesson_type: "private",
        venue_id: venues[0]?.id || "",
        max_students: 1,
        is_published: true,
        notes: "",
        rate: 75
      });
    }
    setShowModal("lesson");
  };
  const saveLesson = async () => {
    try {
      const data = { ...lessonForm, venue_id: lessonForm.venue_id || null };
      if (editingItem) {
        const { error } = await supabase.from("lessons").update(data).eq("id", editingItem.id);
        if (error) throw error;
        notify("Lesson updated");
      } else {
        const { error } = await supabase.from("lessons").insert(data);
        if (error) throw error;
        notify("Lesson created");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteLesson = async (id) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
      notify("Lesson deleted");
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openCopyDay = (date) => {
    setCopySource(date);
    setCopyTargetDays([]);
    setShowModal("copyDay");
  };
  const executeCopyDay = async () => {
    if (!copySource || copyTargetDays.length === 0) return;
    try {
      const sourceStr = toDateStr(copySource);
      const sourceLessons = lessons.filter((l) => l.date === sourceStr);
      if (sourceLessons.length === 0) {
        notify("No lessons to copy");
        return;
      }
      const weekDates = getWeekDates(copySource);
      let copied = 0, skipped = 0;
      for (const dayIdx of copyTargetDays) {
        const targetDate = toDateStr(weekDates[dayIdx]);
        const existingTimes = lessons.filter((l) => l.date === targetDate).map((l) => `${l.start_time}-${l.end_time}`);
        for (const lesson of sourceLessons) {
          const timeKey = `${lesson.start_time}-${lesson.end_time}`;
          if (existingTimes.includes(timeKey)) {
            skipped++;
            continue;
          }
          const { id, created_at, ...lessonData } = lesson;
          await supabase.from("lessons").insert({ ...lessonData, date: targetDate, is_published: false });
          copied++;
        }
      }
      notify(`Copied ${copied} lessons${skipped > 0 ? `, skipped ${skipped} conflicts` : ""}`);
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openCopyWeek = () => {
    setCopyWeeks(1);
    setShowModal("copyWeek");
  };
  const executeCopyWeek = async () => {
    try {
      const weekDates = getWeekDates(currentDate);
      const startStr = toDateStr(weekDates[0]);
      const endStr = toDateStr(weekDates[6]);
      const weekLessons = lessons.filter((l) => l.date >= startStr && l.date <= endStr);
      if (weekLessons.length === 0) {
        notify("No lessons to copy");
        return;
      }
      let copied = 0, skipped = 0;
      for (let week = 1; week <= copyWeeks; week++) {
        for (const lesson of weekLessons) {
          const lessonDate = /* @__PURE__ */ new Date(lesson.date + "T00:00:00");
          const newDate = new Date(lessonDate);
          newDate.setDate(lessonDate.getDate() + week * 7);
          const newDateStr = toDateStr(newDate);
          const conflict = lessons.find(
            (l) => l.date === newDateStr && l.start_time === lesson.start_time && l.end_time === lesson.end_time
          );
          if (conflict) {
            skipped++;
            continue;
          }
          const { id, created_at, ...lessonData } = lesson;
          await supabase.from("lessons").insert({ ...lessonData, date: newDateStr, is_published: false });
          copied++;
        }
      }
      notify(`Copied ${copied} lessons to ${copyWeeks} week(s)${skipped > 0 ? `, skipped ${skipped} conflicts` : ""}`);
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openEventModal = (event = null) => {
    if (event) {
      setEditingItem(event);
      setEventForm({
        name: event.name,
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date || event.start_date,
        venue_id: event.venue_id || "",
        notes: event.notes || "",
        is_registrable: event.is_registrable || false
      });
    } else {
      setEditingItem(null);
      const today = toDateStr(/* @__PURE__ */ new Date());
      setEventForm({
        name: "",
        event_type: "competition",
        start_date: today,
        end_date: today,
        venue_id: "",
        notes: "",
        is_registrable: false
      });
    }
    setShowModal("event");
  };
  const saveEvent = async () => {
    try {
      const data = { ...eventForm, venue_id: eventForm.venue_id || null };
      if (editingItem) {
        const { error } = await supabase.from("events").update(data).eq("id", editingItem.id);
        if (error) throw error;
        notify("Event updated");
      } else {
        const { error } = await supabase.from("events").insert(data);
        if (error) throw error;
        notify("Event created");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteEvent = async (id) => {
    if (!confirm("Delete this event?")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      notify("Event deleted");
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openClientModal = (client = null) => {
    if (client) {
      setEditingItem(client);
      setClientForm({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        city: client.city || "",
        state: client.state || "",
        zip: client.zip || "",
        parent2_name: client.parent2_name || "",
        parent2_email: client.parent2_email || "",
        parent2_phone: client.parent2_phone || "",
        notes: client.notes || ""
      });
    } else {
      setEditingItem(null);
      setClientForm({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        parent2_name: "",
        parent2_email: "",
        parent2_phone: "",
        notes: "",
        child_name: "",
        child_email: "",
        child_birthdate: ""
      });
    }
    setShowModal("client");
  };
  const saveClient = async () => {
    try {
      const { child_name, child_email, child_birthdate, ...clientData } = clientForm;
      if (!isCoach) clientData.profile_id = profile.id;
      let clientId = editingItem?.id;
      if (editingItem) {
        const { error } = await supabase.from("clients").update(clientData).eq("id", editingItem.id);
        if (error) throw error;
        notify("Client updated");
      } else {
        const { data: newClient, error } = await supabase.from("clients").insert(clientData).select().single();
        if (error) throw error;
        clientId = newClient.id;
        notify("Client added");
      }
      const childName = child_name || "";
      const childEmail = child_email || "";
      if (!editingItem && childName.trim()) {
        const studentData = {
          client_id: clientId,
          name: childName.trim(),
          email: childEmail.trim() || null,
          birthdate: child_birthdate || null,
          notes: ""
        };
        await supabase.from("students").insert(studentData);
        notify("Student created for " + childName + " - Edit student to add skill levels");
      } else if (!editingItem && !childName.trim()) {
        const studentData = {
          client_id: clientId,
          name: clientForm.name,
          email: clientForm.email || null,
          birthdate: null,
          notes: "Adult student"
        };
        const { error: studentError } = await supabase.from("students").insert(studentData);
        if (studentError) {
          console.error("Student insert error:", studentError);
          notify("Client saved but student creation failed: " + studentError.message);
        } else {
          notify("Student record created - Edit to add skill levels");
        }
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteClient = async (id) => {
    if (!confirm("Delete this client and all their students?")) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      notify("Client deleted");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openStudentModal = (student = null, clientId = null) => {
    if (student) {
      setEditingItem(student);
      setStudentForm({
        client_id: student.client_id,
        name: student.name || "",
        email: student.email || "",
        birthdate: student.birthdate || "",
        // ISI (10 dropdowns)
        isi_freestyle: student.isi_freestyle || "",
        isi_figures: student.isi_figures || "",
        isi_couples: student.isi_couples || "",
        isi_pairs: student.isi_pairs || "",
        isi_icedance: student.isi_icedance || "",
        isi_international_dance: student.isi_international_dance || "",
        isi_freedance_partnered: student.isi_freedance_partnered || "",
        isi_solo_freedance: student.isi_solo_freedance || "",
        isi_synchro: student.isi_synchro || "",
        isi_special_skater: student.isi_special_skater || "",
        isi_number: student.isi_number || "",
        // USFSA
        usfsa_skating_skills: student.usfsa_skating_skills || "",
        usfsa_singles: student.usfsa_singles || "",
        usfsa_pattern_dance: student.usfsa_pattern_dance || "",
        usfsa_free_dance: student.usfsa_free_dance || "",
        usfsa_pairs: student.usfsa_pairs || "",
        usfsa_number: student.usfsa_number || "",
        notes: student.notes || ""
      });
    } else {
      setEditingItem(null);
      setStudentForm({
        client_id: clientId || (clients[0]?.id || ""),
        name: "",
        email: "",
        birthdate: "",
        // ISI (10 dropdowns)
        isi_freestyle: "",
        isi_figures: "",
        isi_couples: "",
        isi_pairs: "",
        isi_icedance: "",
        isi_international_dance: "",
        isi_freedance_partnered: "",
        isi_solo_freedance: "",
        isi_synchro: "",
        isi_special_skater: "",
        isi_number: "",
        // USFSA
        usfsa_skating_skills: "",
        usfsa_singles: "",
        usfsa_pattern_dance: "",
        usfsa_free_dance: "",
        usfsa_pairs: "",
        usfsa_number: "",
        notes: ""
      });
    }
    setShowModal("student");
  };
  const saveStudent = async () => {
    try {
      const data = { ...studentForm };
      if (!data.name || !data.name.trim()) {
        const parentClient = clients.find((c) => c.id === data.client_id);
        if (parentClient) {
          data.name = parentClient.name;
          if (!data.email || !data.email.trim()) {
            data.email = parentClient.email || null;
          }
        }
      }
      if (!data.name || !data.name.trim()) {
        notify("Please enter a student name");
        return;
      }
      if (editingItem) {
        const { error } = await supabase.from("students").update(data).eq("id", editingItem.id);
        if (error) throw error;
        notify("Student updated");
      } else {
        const { error } = await supabase.from("students").insert(data);
        if (error) throw error;
        notify("Student added");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteStudent = async (id) => {
    if (!confirm("Delete this student?")) return;
    try {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
      notify("Student deleted");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const bookLesson = async (lessonId, studentId) => {
    try {
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new Error("Lesson not found");
      const { data: freshBookings, error: fetchError } = await supabase.from("bookings").select("id, student_id").eq("lesson_id", lessonId).neq("status", "cancelled");
      if (fetchError) throw fetchError;
      if (freshBookings.length >= lesson.max_students) {
        notify("Lesson is full");
        loadData(profile);
        return;
      }
      const alreadyBooked = freshBookings.find((b) => b.student_id === studentId);
      if (alreadyBooked) {
        notify("Student already booked");
        return;
      }
      const { error } = await supabase.from("bookings").insert({
        lesson_id: lessonId,
        student_id: studentId,
        booked_by: profile.id,
        status: "confirmed"
      });
      if (error) throw error;
      if (isCoach) {
        const student = students.find((s) => s.id === studentId);
        const lt = getLessonType(lesson.lesson_type);
        await createNotification("booking", `${student?.name} booked ${lt.name} on ${lesson.date}`, lessonId, null, studentId);
      }
      notify("Lesson booked!");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const cancelBooking = async (bookingId) => {
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Booking not found");
      const lesson = lessons.find((l) => l.id === booking.lesson_id);
      let isLateCancellation = false;
      if (lesson) {
        const lessonDateTime = /* @__PURE__ */ new Date(`${lesson.date}T${lesson.start_time}`);
        const now = /* @__PURE__ */ new Date();
        const hoursUntil = (lessonDateTime - now) / (1e3 * 60 * 60);
        isLateCancellation = hoursUntil < CANCELLATION_WINDOW_HOURS && hoursUntil > 0;
      }
      const { error } = await supabase.from("bookings").update({
        status: "cancelled",
        cancelled_at: (/* @__PURE__ */ new Date()).toISOString(),
        is_late_cancellation: isLateCancellation
      }).eq("id", bookingId);
      if (error) throw error;
      notify(isLateCancellation ? "Cancelled (late - may be billed)" : "Booking cancelled");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openCompetitionRegister = (event) => {
    setRegisterCompetition(event);
    setRegisterStudentId("");
    setShowModal("registerCompetition");
  };
  const registerForCompetition = async () => {
    if (!registerCompetition || !registerStudentId) {
      notify("Please select a student");
      return;
    }
    try {
      const existing = bookings.find(
        (b) => b.event_id === registerCompetition.id && b.student_id === parseInt(registerStudentId) && b.status !== "cancelled"
      );
      if (existing) {
        notify("Student already registered");
        return;
      }
      const { error } = await supabase.from("bookings").insert({
        event_id: registerCompetition.id,
        student_id: parseInt(registerStudentId),
        booked_by: profile.id,
        status: "confirmed"
      });
      if (error) throw error;
      if (isCoach) {
        const student = students.find((s) => s.id === parseInt(registerStudentId));
        await createNotification("registration", `${student?.name} registered for ${registerCompetition.name}`, null, registerCompetition.id, parseInt(registerStudentId));
      }
      notify("Registered for competition!");
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const cancelCompetitionRegistration = async (bookingId) => {
    if (!confirm("Cancel this registration?")) return;
    try {
      const { error } = await supabase.from("bookings").update({
        status: "cancelled",
        cancelled_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", bookingId);
      if (error) throw error;
      notify("Registration cancelled");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const [venueForm, setVenueForm] = useState({ name: "", address: "", color: "#6366f1" });
  const openVenueModal = (venue = null) => {
    if (venue) {
      setEditingItem(venue);
      setVenueForm({ name: venue.name, address: venue.address || "", color: venue.color || "#6366f1" });
    } else {
      setEditingItem(null);
      setVenueForm({ name: "", address: "", color: "#6366f1" });
    }
    setShowModal("venue");
  };
  const saveVenue = async () => {
    try {
      if (editingItem) {
        const { error } = await supabase.from("venues").update(venueForm).eq("id", editingItem.id);
        if (error) throw error;
        notify("Venue updated");
      } else {
        const { error } = await supabase.from("venues").insert(venueForm);
        if (error) throw error;
        notify("Venue added");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteVenue = async (id) => {
    if (!confirm("Delete this venue?")) return;
    try {
      const { error } = await supabase.from("venues").delete().eq("id", id);
      if (error) throw error;
      notify("Venue deleted");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openInvoiceModal = (clientId = null) => {
    const { lessons: unbilledLessons, lateCancellations } = getUnbilledLessons(clientId);
    const lessonsTotal = unbilledLessons.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
    const lateCancelTotal = lateCancellations.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
    const total = lessonsTotal + lateCancelTotal;
    setInvoiceForm({
      client_id: clientId || "",
      lessons: unbilledLessons.map((l) => l.id),
      lateCancellations: lateCancellations.map((l) => l.id),
      amount: total,
      tax_rate: 0,
      notes: "",
      due_date: toDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)),
      payment_cash: paymentSettings.cash || false,
      payment_check: paymentSettings.check || false,
      payment_venmo: paymentSettings.venmo || "",
      payment_paypal: paymentSettings.paypal || "",
      payment_zelle: paymentSettings.zelle || "",
      payment_cashapp: paymentSettings.cashapp || ""
    });
    setShowModal("invoice");
  };
  const getUnbilledLessons = (clientId) => {
    if (!clientId) return { lessons: [], lateCancellations: [] };
    const clientStudentIds = students.filter((s) => s.client_id === parseInt(clientId)).map((s) => s.id);
    const completedBookings = bookings.filter(
      (b) => clientStudentIds.includes(b.student_id) && b.status === "completed" && !b.invoice_id
    );
    const unbilledLessons = lessons.filter((l) => completedBookings.some((b) => b.lesson_id === l.id));
    const lateCancelBookings = bookings.filter(
      (b) => clientStudentIds.includes(b.student_id) && b.status === "cancelled" && b.is_late_cancellation && !b.invoice_id
    );
    const lateCancellations = lessons.filter((l) => lateCancelBookings.some((b) => b.lesson_id === l.id));
    return { lessons: unbilledLessons, lateCancellations };
  };
  const saveInvoice = async () => {
    try {
      const { data: invoice, error } = await supabase.from("invoices").insert({
        client_id: invoiceForm.client_id,
        amount: invoiceForm.amount,
        tax_rate: invoiceForm.tax_rate,
        total: invoiceForm.amount * (1 + invoiceForm.tax_rate / 100),
        notes: invoiceForm.notes,
        due_date: invoiceForm.due_date,
        status: "draft",
        payment_cash: invoiceForm.payment_cash,
        payment_check: invoiceForm.payment_check,
        payment_venmo: invoiceForm.payment_venmo,
        payment_paypal: invoiceForm.payment_paypal,
        payment_zelle: invoiceForm.payment_zelle,
        payment_cashapp: invoiceForm.payment_cashapp
      }).select().single();
      if (error) throw error;
      if (invoiceForm.lessons.length > 0) {
        const bookingIds = bookings.filter((b) => invoiceForm.lessons.includes(b.lesson_id) && b.status === "completed").map((b) => b.id);
        if (bookingIds.length > 0) {
          await supabase.from("bookings").update({ invoice_id: invoice.id }).in("id", bookingIds);
        }
      }
      if (invoiceForm.lateCancellations.length > 0) {
        const lateCancelBookingIds = bookings.filter((b) => invoiceForm.lateCancellations.includes(b.lesson_id) && b.is_late_cancellation).map((b) => b.id);
        if (lateCancelBookingIds.length > 0) {
          await supabase.from("bookings").update({ invoice_id: invoice.id }).in("id", lateCancelBookingIds);
        }
      }
      notify("Invoice created");
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const updateInvoiceStatus = async (id, status) => {
    try {
      const updates = { status };
      if (status === "paid") updates.paid_at = (/* @__PURE__ */ new Date()).toISOString();
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
      notify(`Invoice marked as ${status}`);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const sendInvoiceEmail = async (invoiceId) => {
    try {
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) throw new Error("Invoice not found");
      const client = clients.find((c) => c.id === invoice.client_id);
      if (!client?.email) {
        notify("Client has no email address");
        return;
      }
      const paymentMethods = [];
      if (invoice.payment_cash) paymentMethods.push("Cash");
      if (invoice.payment_check) paymentMethods.push("Check");
      if (invoice.payment_venmo) paymentMethods.push(`Venmo: ${invoice.payment_venmo}`);
      if (invoice.payment_paypal) paymentMethods.push(`PayPal: ${invoice.payment_paypal}`);
      if (invoice.payment_zelle) paymentMethods.push(`Zelle: ${invoice.payment_zelle}`);
      if (invoice.payment_cashapp) paymentMethods.push(`Cash App: ${invoice.payment_cashapp}`);
      const { error } = await supabase.functions.invoke("send-invoice", {
        body: {
          to: client.email,
          clientName: client.name,
          invoiceId: invoice.id,
          amount: invoice.total,
          dueDate: invoice.due_date,
          notes: invoice.notes,
          paymentMethods: paymentMethods.join("\n"),
          coachName: profile?.name || "Your Coach"
        }
      });
      if (error) throw error;
      await updateInvoiceStatus(invoiceId, "sent");
      notify("Invoice emailed to " + client.email);
    } catch (err) {
      notify("Error sending email: " + err.message);
    }
  };
  const loadPaymentSettings = async () => {
    try {
      const { data, error } = await supabase.from("settings").select("*").single();
      if (data) {
        setPaymentSettings({
          cash: data.payment_cash || false,
          check: data.payment_check || false,
          venmo: data.payment_venmo || "",
          paypal: data.payment_paypal || "",
          zelle: data.payment_zelle || "",
          cashapp: data.payment_cashapp || ""
        });
      }
    } catch (err) {
    }
  };
  const savePaymentSettings = async () => {
    try {
      const { data: existing } = await supabase.from("settings").select("id").single();
      const settingsData = {
        payment_cash: paymentSettings.cash,
        payment_check: paymentSettings.check,
        payment_venmo: paymentSettings.venmo,
        payment_paypal: paymentSettings.paypal,
        payment_zelle: paymentSettings.zelle,
        payment_cashapp: paymentSettings.cashapp
      };
      if (existing) {
        const { error } = await supabase.from("settings").update(settingsData).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert(settingsData);
        if (error) throw error;
      }
      notify("Payment settings saved");
      setShowModal(null);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openExpenseModal = (expense = null) => {
    if (expense) {
      setEditingItem(expense);
      setExpenseForm({
        date: expense.date,
        category: expense.category,
        description: expense.description || "",
        amount: expense.amount,
        vendor: expense.vendor || "",
        payment_method: expense.payment_method || "Credit Card"
      });
    } else {
      setEditingItem(null);
      setExpenseForm({
        date: toDateStr(/* @__PURE__ */ new Date()),
        category: "Ice Time",
        description: "",
        amount: "",
        vendor: "",
        payment_method: "Credit Card"
      });
    }
    setShowModal("expense");
  };
  const saveExpense = async () => {
    try {
      const data = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
      if (editingItem) {
        const { error } = await supabase.from("expenses").update(data).eq("id", editingItem.id);
        if (error) throw error;
        notify("Expense updated");
      } else {
        const { error } = await supabase.from("expenses").insert(data);
        if (error) throw error;
        notify("Expense added");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      notify("Expense deleted");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const openMileageModal = (entry = null) => {
    if (entry) {
      setEditingItem(entry);
      setMileageForm({
        date: entry.date,
        description: entry.description || "",
        miles: entry.miles,
        rate: entry.rate || DEFAULT_MILEAGE_RATE,
        odometer_start: entry.odometer_start || "",
        odometer_end: entry.odometer_end || "",
        entry_type: entry.odometer_start ? "odometer" : "manual"
      });
    } else {
      setEditingItem(null);
      setMileageForm({
        date: toDateStr(/* @__PURE__ */ new Date()),
        description: "",
        miles: "",
        rate: DEFAULT_MILEAGE_RATE,
        odometer_start: "",
        odometer_end: "",
        entry_type: "manual"
      });
    }
    setShowModal("mileage");
  };
  const saveMileage = async () => {
    try {
      let miles = parseFloat(mileageForm.miles);
      if (mileageForm.entry_type === "odometer" && mileageForm.odometer_start && mileageForm.odometer_end) {
        miles = parseFloat(mileageForm.odometer_end) - parseFloat(mileageForm.odometer_start);
        if (miles < 0) {
          notify("End odometer must be greater than start");
          return;
        }
      }
      if (!miles || miles <= 0) {
        notify("Please enter valid mileage");
        return;
      }
      const data = {
        date: mileageForm.date,
        description: mileageForm.description,
        miles,
        rate: parseFloat(mileageForm.rate),
        amount: miles * parseFloat(mileageForm.rate),
        odometer_start: mileageForm.entry_type === "odometer" ? parseFloat(mileageForm.odometer_start) : null,
        odometer_end: mileageForm.entry_type === "odometer" ? parseFloat(mileageForm.odometer_end) : null
      };
      if (editingItem) {
        const { error } = await supabase.from("mileage").update(data).eq("id", editingItem.id);
        if (error) throw error;
        notify("Mileage updated");
      } else {
        const { error } = await supabase.from("mileage").insert(data);
        if (error) throw error;
        notify("Mileage logged");
      }
      setShowModal(null);
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const deleteMileage = async (id) => {
    if (!confirm("Delete this mileage entry?")) return;
    try {
      const { error } = await supabase.from("mileage").delete().eq("id", id);
      if (error) throw error;
      notify("Mileage deleted");
      loadData(profile);
    } catch (err) {
      notify("Error: " + err.message);
    }
  };
  const styles = {
    // Layout
    container: { minHeight: "100vh", background: "#f8fafc", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", color: "white", padding: "16px 20px", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" },
    headerContent: { maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
    logo: { fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 },
    userInfo: { display: "flex", alignItems: "center", gap: 12, fontSize: 14 },
    main: { maxWidth: 1200, margin: "0 auto", padding: 20 },
    // Navigation
    nav: { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, marginBottom: 20, borderBottom: "1px solid #e2e8f0" },
    navBtn: { padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, fontWeight: 500, color: "#64748b", whiteSpace: "nowrap", transition: "all 0.2s" },
    navBtnActive: { background: "#7c3aed", color: "white" },
    // Cards
    card: { background: "white", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 },
    cardTitle: { fontSize: 18, fontWeight: 600, color: "#0f172a" },
    // Buttons
    btn: { padding: "10px 20px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14, transition: "all 0.2s" },
    btnPrimary: { background: "#7c3aed", color: "white" },
    btnSecondary: { background: "#f1f5f9", color: "#475569" },
    btnDanger: { background: "#ef4444", color: "white" },
    btnSuccess: { background: "#10b981", color: "white" },
    btnSmall: { padding: "6px 12px", fontSize: 13 },
    // Forms
    formGroup: { marginBottom: 16 },
    label: { display: "block", marginBottom: 6, fontWeight: 500, color: "#374151", fontSize: 14 },
    input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
    select: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "white" },
    textarea: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box", minHeight: 80, resize: "vertical" },
    checkbox: { marginRight: 8 },
    row: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 },
    // Modal
    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1e3 },
    modal: { background: "white", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto" },
    modalHeader: { padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { fontSize: 18, fontWeight: 600 },
    modalBody: { padding: 20 },
    modalFooter: { padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 12 },
    // Calendar
    calendarHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 },
    calendarNav: { display: "flex", alignItems: "center", gap: 12 },
    calendarGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
    calendarDayHeader: { padding: 8, textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: 12 },
    calendarDay: { minHeight: isMobile ? 60 : 100, padding: 8, background: "white", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" },
    calendarDayToday: { border: "2px solid #7c3aed" },
    calendarDayNum: { fontWeight: 600, fontSize: 14, marginBottom: 4 },
    calendarLesson: { fontSize: 11, padding: "2px 4px", marginBottom: 2, borderRadius: 4, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    // Table
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#64748b", fontSize: 13 },
    td: { padding: "12px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 14 },
    // List
    listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0" },
    listItemLast: { borderBottom: "none" },
    // Auth
    authContainer: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", padding: 20 },
    authCard: { background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" },
    authLogo: { textAlign: "center", fontSize: 32, marginBottom: 8 },
    authTitle: { textAlign: "center", fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4 },
    authSub: { textAlign: "center", color: "#64748b", marginBottom: 24 },
    authTabs: { display: "flex", marginBottom: 24, background: "#f1f5f9", borderRadius: 8, padding: 4 },
    authTab: { flex: 1, padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 6, fontWeight: 500, color: "#64748b", transition: "all 0.2s" },
    authTabActive: { background: "white", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
    // Badges
    badge: { display: "inline-block", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 500 },
    badgeSuccess: { background: "#dcfce7", color: "#166534" },
    badgeWarning: { background: "#fef3c7", color: "#92400e" },
    badgeDanger: { background: "#fee2e2", color: "#991b1b" },
    badgeInfo: { background: "#dbeafe", color: "#1e40af" },
    // Dashboard
    statsGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 20 },
    statCard: { background: "white", borderRadius: 12, padding: 20, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
    statValue: { fontSize: 28, fontWeight: 700, color: "#7c3aed" },
    statLabel: { color: "#64748b", fontSize: 14, marginTop: 4 },
    // Misc
    loading: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" },
    spinner: { fontSize: 48, animation: "spin 1s linear infinite" },
    toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, zIndex: 2e3, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
    error: { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 },
    empty: { textAlign: "center", color: "#64748b", padding: 40 }
  };
  if (!session) {
    return /* @__PURE__ */ React.createElement("div", { style: styles.authContainer }, /* @__PURE__ */ React.createElement("div", { style: styles.authCard }, /* @__PURE__ */ React.createElement("div", { style: styles.authLogo }, "\u26F8\uFE0F"), /* @__PURE__ */ React.createElement("h1", { style: styles.authTitle }, "IceBooks Pro"), /* @__PURE__ */ React.createElement("p", { style: styles.authSub }, "Figure Skating Coach Management"), /* @__PURE__ */ React.createElement("div", { style: styles.authTabs }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.authTab, ...authMode === "signin" ? styles.authTabActive : {} },
        onClick: () => setAuthMode("signin")
      },
      "Sign In"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.authTab, ...authMode === "signup" ? styles.authTabActive : {} },
        onClick: () => setAuthMode("signup")
      },
      "Sign Up"
    )), authError && /* @__PURE__ */ React.createElement("div", { style: styles.error }, authError), /* @__PURE__ */ React.createElement("form", { onSubmit: authMode === "signin" ? handleSignIn : handleSignUp }, authMode === "signup" && /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        style: styles.input,
        type: "text",
        value: authName,
        onChange: (e) => setAuthName(e.target.value),
        placeholder: "Your name",
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Email"), /* @__PURE__ */ React.createElement(
      "input",
      {
        style: styles.input,
        type: "email",
        value: authEmail,
        onChange: (e) => setAuthEmail(e.target.value),
        placeholder: "you@example.com",
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Password"), /* @__PURE__ */ React.createElement(
      "input",
      {
        style: styles.input,
        type: "password",
        value: authPassword,
        onChange: (e) => setAuthPassword(e.target.value),
        placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
        required: true,
        minLength: 6
      }
    )), /* @__PURE__ */ React.createElement("button", { type: "submit", style: { ...styles.btn, ...styles.btnPrimary, width: "100%" } }, authMode === "signin" ? "Sign In" : "Create Account"))));
  }
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", { style: styles.loading }, /* @__PURE__ */ React.createElement("div", { style: styles.spinner }, "\u26F8\uFE0F"), /* @__PURE__ */ React.createElement("div", null, "Loading..."));
  }
  const renderCalendar = () => {
    const weekDates = getWeekDates(currentDate);
    const monthDays = getDays(currentDate);
    const today = toDateStr(/* @__PURE__ */ new Date());
    const getLessonsForDate = (date) => {
      const dateStr = toDateStr(date);
      return lessons.filter((l) => l.date === dateStr);
    };
    const getEventsForDate = (date) => {
      const dateStr = toDateStr(date);
      return events.filter((e) => dateStr >= e.start_date && dateStr <= (e.end_date || e.start_date));
    };
    const renderDayCell = (date, isOutside = false) => {
      const dateStr = toDateStr(date);
      const dayLessons = getLessonsForDate(date);
      const dayEvents = getEventsForDate(date);
      const isToday = dateStr === today;
      const isCompact = calendarView === "month" && isMobile;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: dateStr,
          style: {
            ...styles.calendarDay,
            ...isToday ? styles.calendarDayToday : {},
            opacity: isOutside ? 0.4 : 1,
            minHeight: calendarView === "month" ? isMobile ? 40 : 80 : 120
          },
          onClick: () => isCoach && openLessonModal(null, date)
        },
        /* @__PURE__ */ React.createElement("div", { style: styles.calendarDayNum }, date.getDate()),
        isCompact ? (
          // Mobile month view: just show dots
          (dayLessons.length > 0 || dayEvents.length > 0) && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 2, flexWrap: "wrap", marginTop: 2 } }, dayEvents.slice(0, 2).map((e) => /* @__PURE__ */ React.createElement("span", { key: `e-${e.id}`, style: { width: 6, height: 6, borderRadius: "50%", background: getEventType(e.event_type).color } })), dayLessons.slice(0, 3).map((l) => /* @__PURE__ */ React.createElement("span", { key: `l-${l.id}`, style: { width: 6, height: 6, borderRadius: "50%", background: getLessonType(l.lesson_type).color } })))
        ) : (
          // Desktop or week view: show full items
          /* @__PURE__ */ React.createElement(React.Fragment, null, dayEvents.map((e) => {
            const et = getEventType(e.event_type);
            return /* @__PURE__ */ React.createElement(
              "div",
              {
                key: `e-${e.id}`,
                style: { ...styles.calendarLesson, background: et.color },
                onClick: (ev) => {
                  ev.stopPropagation();
                  isCoach && openEventModal(e);
                }
              },
              et.icon,
              " ",
              calendarView === "month" ? "" : e.name
            );
          }), dayLessons.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((l) => {
            const lt = getLessonType(l.lesson_type);
            const venue = venues.find((v) => v.id === l.venue_id);
            const lessonBookings = bookings.filter((b) => b.lesson_id === l.id && b.status !== "cancelled");
            const booked = lessonBookings.length;
            const bookedNames = lessonBookings.map((b) => students.find((s) => s.id === b.student_id)?.name).filter(Boolean);
            return /* @__PURE__ */ React.createElement(
              "div",
              {
                key: `l-${l.id}`,
                style: {
                  ...styles.calendarLesson,
                  background: lt.color,
                  opacity: l.is_published ? 1 : 0.5,
                  position: "relative"
                },
                onClick: (ev) => {
                  ev.stopPropagation();
                  openLessonModal(l);
                }
              },
              formatTime(l.start_time),
              " ",
              lt.icon,
              " ",
              booked,
              "/",
              l.max_students,
              bookedNames.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, opacity: 0.9, marginTop: 2, fontWeight: 400 } }, bookedNames.join(", ")),
              venue?.color && /* @__PURE__ */ React.createElement("span", { style: {
                position: "absolute",
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: venue.color,
                border: "1px solid rgba(255,255,255,0.5)"
              } })
            );
          }), isCoach && dayLessons.length > 0 && /* @__PURE__ */ React.createElement(
            "button",
            {
              style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginTop: 4, width: "100%", fontSize: 10 },
              onClick: (ev) => {
                ev.stopPropagation();
                openCopyDay(date);
              }
            },
            "Copy Day"
          ))
        )
      );
    };
    return /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.calendarHeader }, /* @__PURE__ */ React.createElement("div", { style: styles.calendarNav }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary },
        onClick: () => {
          const d = new Date(currentDate);
          if (calendarView === "month") {
            d.setMonth(d.getMonth() - 1);
          } else {
            d.setDate(d.getDate() - 7);
          }
          setCurrentDate(d);
        }
      },
      "\u2190 Prev"
    ), /* @__PURE__ */ React.createElement("h2", { style: { margin: 0, fontSize: 18 } }, calendarView === "month" ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary },
        onClick: () => {
          const d = new Date(currentDate);
          if (calendarView === "month") {
            d.setMonth(d.getMonth() + 1);
          } else {
            d.setDate(d.getDate() + 7);
          }
          setCurrentDate(d);
        }
      },
      "Next \u2192"
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #e2e8f0" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, padding: "6px 12px", borderRadius: 0, background: calendarView === "month" ? "#7c3aed" : "#f8fafc", color: calendarView === "month" ? "white" : "#64748b", border: "none" },
        onClick: () => setCalendarView("month")
      },
      "Month"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, padding: "6px 12px", borderRadius: 0, background: calendarView === "week" ? "#7c3aed" : "#f8fafc", color: calendarView === "week" ? "white" : "#64748b", border: "none" },
        onClick: () => setCalendarView("week")
      },
      "Week"
    ), isCoach && /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, padding: "6px 12px", borderRadius: 0, background: calendarView === "day" ? "#7c3aed" : "#f8fafc", color: calendarView === "day" ? "white" : "#64748b", border: "none" },
        onClick: () => {
          setCalendarView("day");
          if (!selectedDate) setSelectedDate(/* @__PURE__ */ new Date());
        }
      },
      "Day"
    )), isCoach && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary, position: "relative" },
        onClick: () => setShowNotifications(!showNotifications)
      },
      "\u{1F514}",
      notifications.filter((n) => !n.read).length > 0 && /* @__PURE__ */ React.createElement("span", { style: {
        position: "absolute",
        top: -5,
        right: -5,
        background: "#ef4444",
        color: "white",
        borderRadius: "50%",
        width: 20,
        height: 20,
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      } }, notifications.filter((n) => !n.read).length)
    ), showNotifications && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: "100%",
      right: 0,
      marginTop: 8,
      background: "white",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      width: 320,
      maxHeight: 400,
      overflow: "auto",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("strong", null, "Notifications"), notifications.filter((n) => !n.read).length > 0 && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, padding: "4px 8px", fontSize: 12 }, onClick: markAllNotificationsRead }, "Mark all read")), notifications.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: 20, textAlign: "center", color: "#94a3b8" } }, "No notifications") : notifications.map((n) => /* @__PURE__ */ React.createElement("div", { key: n.id, style: {
      padding: 12,
      borderBottom: "1px solid #f1f5f9",
      background: n.read ? "white" : "#f0f9ff",
      cursor: "pointer"
    }, onClick: () => !n.read && markNotificationRead(n.id) }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, marginBottom: 4 } }, n.message), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#64748b" } }, new Date(n.created_at).toLocaleString()))))), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openLessonModal() }, "+ Lesson"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: () => openEventModal() }, "+ Event"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: openCopyWeek }, "Copy Week")))), isCoach && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }, onClick: exportICS }, "\u{1F4E4} Export .ics"), /* @__PURE__ */ React.createElement("label", { style: { ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall, cursor: "pointer", margin: 0 } }, "\u{1F4E5} Import .ics", /* @__PURE__ */ React.createElement("input", { type: "file", accept: ".ics,.ical", onChange: importICS, style: { display: "none" } })), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }, onClick: copyLiveSyncUrl }, "\u{1F517} Live Sync URL")), /* @__PURE__ */ React.createElement("div", { style: styles.calendarGrid }, DAY_NAMES.map((d) => /* @__PURE__ */ React.createElement("div", { key: d, style: styles.calendarDayHeader }, d)), calendarView === "month" ? monthDays.map(({ date, outside }) => renderDayCell(date, outside)) : calendarView === "week" ? weekDates.map((date) => renderDayCell(date)) : null), calendarView === "day" && selectedDate && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 18, fontWeight: 600 } }, "Schedule for ", selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, isMobile && /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnPrimary },
        onClick: () => {
          setMileageForm({
            ...mileageForm,
            date: selectedDate.toISOString().split("T")[0]
          });
          setShowModal("mileage");
        }
      },
      "\u26FD Add Mileage"
    ), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: printDaySchedule }, "\u{1F5A8}\uFE0F Print"))), (() => {
      const dayLessons = lessons.filter((l) => l.date === selectedDate.toISOString().split("T")[0]).sort((a, b) => a.start_time.localeCompare(b.start_time));
      if (dayLessons.length === 0) {
        return /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No lessons scheduled for this day");
      }
      return dayLessons.map((lesson) => {
        const lt = getLessonType(lesson.lesson_type);
        const venue = venues.find((v) => v.id === lesson.venue_id);
        const lessonBookings = bookings.filter((b) => b.lesson_id === lesson.id && b.status !== "cancelled");
        return /* @__PURE__ */ React.createElement("div", { key: lesson.id, style: {
          ...styles.card,
          marginBottom: 16,
          borderLeft: `4px solid ${lt.color}`
        } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 600, marginBottom: 4 } }, lt.icon, " ", lt.name), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 14 } }, lesson.start_time, " - ", lesson.end_time, venue && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: 12 } }, "\u{1F4CD} ", venue.name, venue.color && /* @__PURE__ */ React.createElement("span", { style: {
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: venue.color,
          marginLeft: 6
        } }))), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 14, marginTop: 4 } }, "Rate: $", lesson.rate, " | Max: ", lesson.max_students, " | Published: ", lesson.is_published ? "Yes" : "No"))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "Booked Students (", lessonBookings.length, "/", lesson.max_students, ")"), lessonBookings.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { color: "#94a3b8", fontStyle: "italic" } }, lesson.is_published ? "No bookings yet" : "Not published for booking") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12 } }, lessonBookings.map((booking) => {
          const student = students.find((s) => s.id === booking.student_id);
          const client = clients.find((c) => c.id === student?.client_id);
          return /* @__PURE__ */ React.createElement("div", { key: booking.id, style: {
            background: "#f8fafc",
            padding: 12,
            borderRadius: 6,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "2fr 2fr 1fr",
            gap: 12
          } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600 } }, student?.name || "Unknown"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#64748b" } }, student?.isi_level && `ISI: ${student.isi_level}`, student?.isi_level && student?.usfsa_level && " | ", student?.usfsa_level && `USFSA: ${student.usfsa_level}`)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, client?.name), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b" } }, client?.phone), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b" } }, client?.email)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#64748b" } }, "Booked: ", new Date(booking.created_at).toLocaleDateString()));
        })))));
      });
    })()));
  };
  const renderClients = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Clients"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openClientModal() }, "+ Add Client")), clients.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No clients yet. Add your first client!") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Name"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Email"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Phone"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Students"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, clients.map((c) => {
    const clientStudents = students.filter((s) => s.client_id === c.id);
    return /* @__PURE__ */ React.createElement("tr", { key: c.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("strong", null, c.name)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, c.email), /* @__PURE__ */ React.createElement("td", { style: styles.td }, c.phone), /* @__PURE__ */ React.createElement("td", { style: styles.td }, clientStudents.length), /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openClientModal(c) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openStudentModal(null, c.id) }, "+ Student"), isCoach && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSuccess }, onClick: () => openInvoiceModal(c.id) }, "Invoice")));
  })))));
  const renderStudents = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Students"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openStudentModal() }, "+ Add Student")), students.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No students yet. Add students to your clients!") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Name"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Parent/Client"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "ISI Level"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "USFSA Level"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, students.map((s) => {
    const client = clients.find((c) => c.id === s.client_id);
    return /* @__PURE__ */ React.createElement("tr", { key: s.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("strong", null, s.name)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, client?.name || "-"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, s.isi_level || "-"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, s.usfsa_level || "-"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openStudentModal(s) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }, onClick: () => deleteStudent(s.id) }, "Delete")));
  })))));
  const renderVenues = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Venues / Rinks"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openVenueModal() }, "+ Add Venue")), venues.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No venues yet. Add your rinks!") : /* @__PURE__ */ React.createElement("div", null, venues.map((v) => /* @__PURE__ */ React.createElement("div", { key: v.id, style: styles.listItem }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, v.name), v.address && /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 13 } }, v.address)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openVenueModal(v) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }, onClick: () => deleteVenue(v.id) }, "Delete"))))));
  const renderInvoices = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Invoices")), invoices.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No invoices yet. Create one from the Clients tab!") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Date"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Client"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Amount"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Status"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, invoices.map((inv) => {
    const client = clients.find((c) => c.id === inv.client_id);
    return /* @__PURE__ */ React.createElement("tr", { key: inv.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatDate(inv.created_at)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, client?.name || "-"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatCurrency(inv.total || inv.amount)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("span", { style: {
      ...styles.badge,
      ...inv.status === "paid" ? styles.badgeSuccess : inv.status === "overdue" ? styles.badgeDanger : styles.badgeWarning
    } }, inv.status)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, inv.status === "draft" && /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSmall, ...styles.btnPrimary, marginRight: 8 },
        onClick: () => sendInvoiceEmail(inv.id),
        title: "Send invoice via email"
      },
      "\u{1F4E7} Send"
    ), inv.status !== "paid" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => updateInvoiceStatus(inv.id, "sent") }, "Mark Sent"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSuccess }, onClick: () => updateInvoiceStatus(inv.id, "paid") }, "Mark Paid"))));
  })))));
  const renderExpenses = () => {
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Expenses"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openExpenseModal() }, "+ Add Expense")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", null, "Total Expenses:"), " ", formatCurrency(totalExpenses)), expenses.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No expenses recorded yet.") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Date"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Category"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Description"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Amount"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, expenses.map((e) => /* @__PURE__ */ React.createElement("tr", { key: e.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatDate(e.date)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, e.category), /* @__PURE__ */ React.createElement("td", { style: styles.td }, e.description), /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatCurrency(e.amount)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openExpenseModal(e) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }, onClick: () => deleteExpense(e.id) }, "Delete"))))))));
  };
  const renderMileage = () => {
    const totalMiles = mileage.reduce((sum, m) => sum + (m.miles || 0), 0);
    const totalDeduction = mileage.reduce((sum, m) => sum + (m.amount || 0), 0);
    return /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Mileage Log"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openMileageModal() }, "+ Log Mileage")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: 8, display: "flex", gap: 24, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Total Miles:"), " ", totalMiles.toFixed(1)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Tax Deduction:"), " ", formatCurrency(totalDeduction))), mileage.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No mileage logged yet.") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Date"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Description"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Miles"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Rate"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Deduction"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, mileage.map((m) => /* @__PURE__ */ React.createElement("tr", { key: m.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatDate(m.date)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, m.description), /* @__PURE__ */ React.createElement("td", { style: styles.td }, m.miles), /* @__PURE__ */ React.createElement("td", { style: styles.td }, "$", m.rate, "/mi"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatCurrency(m.amount)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openMileageModal(m) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }, onClick: () => deleteMileage(m.id) }, "Delete"))))))));
  };
  const renderReports = () => {
    return /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Reports")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: {
          ...styles.btn,
          ...reportType === "pl" ? styles.btnPrimary : styles.btnSecondary
        },
        onClick: () => setReportType("pl")
      },
      "\u{1F4CA} Profit & Loss"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: {
          ...styles.btn,
          ...reportType === "mileage" ? styles.btnPrimary : styles.btnSecondary
        },
        onClick: () => setReportType("mileage")
      },
      "\u{1F697} Mileage Log"
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 200px" } }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Start Date"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        style: styles.input,
        value: reportDateRange.start,
        onChange: (e) => setReportDateRange({ ...reportDateRange, start: e.target.value })
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 200px" } }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "End Date"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        style: styles.input,
        value: reportDateRange.end,
        onChange: (e) => setReportDateRange({ ...reportDateRange, end: e.target.value })
      }
    )))), reportType === "pl" && renderProfitLoss(reportDateRange), reportType === "mileage" && renderMileageReport(reportDateRange));
  };
  const renderProfitLoss = (dateRange) => {
    const filteredLessons = lessons.filter((l) => {
      const lessonDate = l.date;
      return lessonDate >= dateRange.start && lessonDate <= dateRange.end;
    });
    const totalIncome = filteredLessons.reduce((sum, l) => sum + (l.rate || 0), 0);
    const filteredExpenses = expenses.filter((e) => {
      const expDate = e.date;
      return expDate >= dateRange.start && expDate <= dateRange.end;
    });
    const expensesByCategory = {};
    filteredExpenses.forEach((e) => {
      if (!expensesByCategory[e.category]) {
        expensesByCategory[e.category] = 0;
      }
      expensesByCategory[e.category] += e.amount || 0;
    });
    const filteredMileage = mileage.filter((m) => {
      const mileDate = m.date;
      return mileDate >= dateRange.start && mileDate <= dateRange.end;
    });
    const totalMiles = filteredMileage.reduce((sum, m) => sum + (m.miles || 0), 0);
    const totalMileageExpense = filteredMileage.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0) + totalMileageExpense;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome * 100).toFixed(1) : 0;
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#64748b", marginBottom: 4 } }, "Report Period"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 600 } }, new Date(dateRange.start).toLocaleDateString(), " - ", new Date(dateRange.end).toLocaleDateString())), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 32 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 18, fontWeight: 600, marginBottom: 16, borderBottom: "2px solid #e2e8f0", paddingBottom: 8 } }, "Income"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#64748b" } }, "Coaching Revenue (", filteredLessons.length, " lessons)"), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, formatCurrency(totalIncome))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #e2e8f0", fontWeight: 700 } }, /* @__PURE__ */ React.createElement("span", null, "Total Income"), /* @__PURE__ */ React.createElement("span", null, formatCurrency(totalIncome)))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 32 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 18, fontWeight: 600, marginBottom: 16, borderBottom: "2px solid #e2e8f0", paddingBottom: 8 } }, "Expenses"), Object.entries(expensesByCategory).map(([category, amount]) => /* @__PURE__ */ React.createElement("div", { key: category, style: { display: "flex", justifyContent: "space-between", padding: "12px 0" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#64748b" } }, category), /* @__PURE__ */ React.createElement("span", null, formatCurrency(amount)))), totalMileageExpense > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#64748b" } }, "Vehicle/Mileage \u{1F697} (", totalMiles.toFixed(1), " miles)"), /* @__PURE__ */ React.createElement("span", null, formatCurrency(totalMileageExpense))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #e2e8f0", fontWeight: 700 } }, /* @__PURE__ */ React.createElement("span", null, "Total Expenses"), /* @__PURE__ */ React.createElement("span", null, formatCurrency(totalExpenses)))), /* @__PURE__ */ React.createElement("div", { style: { padding: 20, background: netProfit >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 8, border: `2px solid ${netProfit >= 0 ? "#22c55e" : "#ef4444"}` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#64748b", marginBottom: 4 } }, "Net Profit"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: netProfit >= 0 ? "#22c55e" : "#ef4444" } }, formatCurrency(netProfit))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#64748b", marginBottom: 4 } }, "Profit Margin"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 28, fontWeight: 700 } }, profitMargin, "%")))));
  };
  const renderMileageReport = (dateRange) => {
    const filteredMileage = mileage.filter((m) => {
      const mileDate = m.date;
      return mileDate >= dateRange.start && mileDate <= dateRange.end;
    });
    const totalMiles = filteredMileage.reduce((sum, m) => sum + (m.miles || 0), 0);
    const totalAmount = filteredMileage.reduce((sum, m) => sum + (m.amount || 0), 0);
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#64748b", marginBottom: 4 } }, "Report Period"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 600 } }, new Date(dateRange.start).toLocaleDateString(), " - ", new Date(dateRange.end).toLocaleDateString())), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 16, background: "#eff6ff", borderRadius: 8, border: "1px solid #3b82f6" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#3b82f6", marginBottom: 4 } }, "Total Miles"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 24, fontWeight: 700, color: "#1e40af" } }, totalMiles.toFixed(1))), /* @__PURE__ */ React.createElement("div", { style: { padding: 16, background: "#f0fdf4", borderRadius: 8, border: "1px solid #22c55e" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#22c55e", marginBottom: 4 } }, "Total Deduction"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 24, fontWeight: 700, color: "#15803d" } }, formatCurrency(totalAmount))), /* @__PURE__ */ React.createElement("div", { style: { padding: 16, background: "#faf5ff", borderRadius: 8, border: "1px solid #a855f7" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#a855f7", marginBottom: 4 } }, "Method"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: "#7e22ce" } }, reportSettings.vehicle_expense_method === "standard" ? `${formatCurrency(reportSettings.mileage_rate)}/mi` : "Actual Costs"))), filteredMileage.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No mileage entries for the selected date range.") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: styles.table }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Date"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Description"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Entry Type"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Miles"), /* @__PURE__ */ React.createElement("th", { style: styles.th }, "Amount"))), /* @__PURE__ */ React.createElement("tbody", null, filteredMileage.map((m) => /* @__PURE__ */ React.createElement("tr", { key: m.id }, /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatDate(m.date)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, m.description), /* @__PURE__ */ React.createElement("td", { style: styles.td }, m.entry_type === "odometer" ? "\u{1F522} Odometer" : "\u{1F4DD} Manual"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, (m.miles || 0).toFixed(1)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatCurrency(m.amount || 0))))), /* @__PURE__ */ React.createElement("tfoot", null, /* @__PURE__ */ React.createElement("tr", { style: { background: "#f8fafc", fontWeight: 700 } }, /* @__PURE__ */ React.createElement("td", { style: styles.td, colSpan: "3" }, "Total"), /* @__PURE__ */ React.createElement("td", { style: styles.td }, totalMiles.toFixed(1)), /* @__PURE__ */ React.createElement("td", { style: styles.td }, formatCurrency(totalAmount)))))));
  };
  const renderSettings = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Settings")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 24 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 } }, "\u{1F4B3} Payment Methods"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "#64748b", marginBottom: 16 } }, "Configure your accepted payment methods. These will be included on invoices."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: paymentSettings.cash,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, cash: e.target.checked }),
      style: { marginRight: 8 }
    }
  ), "Accept Cash"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: paymentSettings.check,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, check: e.target.checked }),
      style: { marginRight: 8 }
    }
  ), "Accept Check")), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Venmo Username"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      style: styles.input,
      value: paymentSettings.venmo,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, venmo: e.target.value }),
      placeholder: "@username"
    }
  )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "PayPal Email"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      style: styles.input,
      value: paymentSettings.paypal,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, paypal: e.target.value }),
      placeholder: "email@example.com"
    }
  ))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Zelle (phone or email)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      style: styles.input,
      value: paymentSettings.zelle,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, zelle: e.target.value }),
      placeholder: "phone or email"
    }
  )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Cash App Tag"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      style: styles.input,
      value: paymentSettings.cashapp,
      onChange: (e) => setPaymentSettings({ ...paymentSettings, cashapp: e.target.value }),
      placeholder: "$cashtag"
    }
  ))), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: savePaymentSettings }, "Save Payment Settings")), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #e2e8f0", paddingTop: 24, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 } }, "\u{1F4CA} Expense Categories"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "#64748b", marginBottom: 16 } }, "Customize your expense categories for better tracking and reporting."), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, reportSettings.expense_categories.map((cat, idx) => /* @__PURE__ */ React.createElement("div", { key: idx, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 6, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", null, cat), /* @__PURE__ */ React.createElement(
    "button",
    {
      style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger },
      onClick: async () => {
        if (reportSettings.expense_categories.length <= 1) {
          notify("Must have at least one category");
          return;
        }
        const newCats = reportSettings.expense_categories.filter((_, i) => i !== idx);
        setReportSettings({ ...reportSettings, expense_categories: newCats });
        await supabase.from("settings").update({ expense_categories: JSON.stringify(newCats) }).eq("id", 1);
        notify("Category removed");
      }
    },
    "Remove"
  )))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      style: { ...styles.input, flex: 1 },
      placeholder: "New category name...",
      id: "newCategoryInput"
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      style: { ...styles.btn, ...styles.btnPrimary },
      onClick: async () => {
        const input = document.getElementById("newCategoryInput");
        const newCat = input.value.trim();
        if (!newCat) {
          notify("Enter a category name");
          return;
        }
        if (reportSettings.expense_categories.includes(newCat)) {
          notify("Category already exists");
          return;
        }
        const newCats = [...reportSettings.expense_categories, newCat];
        setReportSettings({ ...reportSettings, expense_categories: newCats });
        await supabase.from("settings").update({ expense_categories: JSON.stringify(newCats) }).eq("id", 1);
        input.value = "";
        notify("Category added");
      }
    },
    "Add Category"
  ))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #e2e8f0", paddingTop: 24, marginBottom: 24 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 } }, "\u{1F697} Mileage & Vehicle Settings"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Vehicle Expense Method"), /* @__PURE__ */ React.createElement(
    "select",
    {
      style: styles.input,
      value: reportSettings.vehicle_expense_method,
      onChange: async (e) => {
        setReportSettings({ ...reportSettings, vehicle_expense_method: e.target.value });
        await supabase.from("settings").update({ vehicle_expense_method: e.target.value }).eq("id", 1);
        notify("Settings saved");
      }
    },
    /* @__PURE__ */ React.createElement("option", { value: "standard" }, "Standard Mileage Rate"),
    /* @__PURE__ */ React.createElement("option", { value: "actual" }, "Actual Expenses")
  ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginTop: 4 } }, reportSettings.vehicle_expense_method === "standard" ? "Uses the IRS standard mileage rate to calculate deductions automatically." : "Tracks actual vehicle expenses (gas, maintenance, etc.).")), reportSettings.vehicle_expense_method === "standard" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Standard Mileage Rate (per mile)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 18 } }, "$"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      step: "0.01",
      style: { ...styles.input, maxWidth: 150 },
      value: reportSettings.mileage_rate,
      onChange: async (e) => {
        const rate = parseFloat(e.target.value) || 0;
        setReportSettings({ ...reportSettings, mileage_rate: rate });
        await supabase.from("settings").update({ mileage_rate: rate }).eq("id", 1);
        notify("Mileage rate updated");
      }
    }
  )), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginTop: 4 } }, "Current IRS standard mileage rate for 2025 is $0.70 per mile."))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #e2e8f0", paddingTop: 24 } }, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 } }, "\u{1F4E7} Email Invoices"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "#64748b" } }, "To send invoices via email, you'll need to set up a Resend API key in your Supabase Edge Function. See the README for setup instructions.")));
  const renderEvents = () => {
    const upcomingEvents = events.filter((e) => e.start_date >= toDateStr(/* @__PURE__ */ new Date()));
    const pastEvents = events.filter((e) => e.start_date < toDateStr(/* @__PURE__ */ new Date()));
    const getRegistrations = (eventId) => {
      return bookings.filter((b) => b.event_id === eventId && b.status !== "cancelled");
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Upcoming Events & Competitions"), isCoach && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openEventModal() }, "+ Add Event")), upcomingEvents.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No upcoming events.") : /* @__PURE__ */ React.createElement("div", null, upcomingEvents.map((e) => {
      const et = getEventType(e.event_type);
      const registrations = getRegistrations(e.id);
      const venue = venues.find((v) => v.id === e.venue_id);
      const myStudentIds = students.map((s) => s.id);
      const myRegistrations = registrations.filter((r) => myStudentIds.includes(r.student_id));
      return /* @__PURE__ */ React.createElement("div", { key: e.id, style: { ...styles.listItem, flexDirection: "column", alignItems: "stretch" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 24 } }, et.icon), /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 16 } }, e.name), /* @__PURE__ */ React.createElement("span", { style: { ...styles.badge, background: et.color, color: "white" } }, et.name)), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 13, marginTop: 4 } }, formatDate(e.start_date), e.end_date && e.end_date !== e.start_date && ` - ${formatDate(e.end_date)}`, venue && ` \u2022 ${venue.name}`), e.notes && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4, fontSize: 13 } }, e.notes)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, e.is_registrable && students.length > 0 && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSuccess }, onClick: () => openCompetitionRegister(e) }, "Register Student"), isCoach && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: () => openEventModal(e) }, "Edit"))), registrations.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 13 } }, "Registered (", registrations.length, "):"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8 } }, registrations.map((r) => {
        const student = students.find((s) => s.id === r.student_id);
        const isMine = myStudentIds.includes(r.student_id);
        return /* @__PURE__ */ React.createElement("div", { key: r.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" } }, /* @__PURE__ */ React.createElement("span", null, student?.name || "Unknown"), (isCoach || isMine) && /* @__PURE__ */ React.createElement(
          "button",
          {
            style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger },
            onClick: () => cancelCompetitionRegistration(r.id)
          },
          "Cancel"
        ));
      }))));
    }))), pastEvents.length > 0 && /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "Past Events"), /* @__PURE__ */ React.createElement("div", null, pastEvents.slice(0, 10).map((e) => {
      const et = getEventType(e.event_type);
      return /* @__PURE__ */ React.createElement("div", { key: e.id, style: styles.listItem }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { marginRight: 8 } }, et.icon), /* @__PURE__ */ React.createElement("strong", null, e.name), /* @__PURE__ */ React.createElement("span", { style: { color: "#64748b", marginLeft: 8 } }, formatDate(e.start_date))));
    }))));
  };
  const renderClientBooking = () => {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(today);
    const myStudentIds = students.map((s) => s.id);
    const days = getDays(currentDate);
    const getLessonsForDate = (date) => {
      const dateStr = toDateStr(date);
      return lessons.filter((l) => l.date === dateStr && l.is_published);
    };
    const getMyBookingForLesson = (lessonId) => {
      return bookings.find(
        (b) => b.lesson_id === lessonId && myStudentIds.includes(b.student_id) && b.status !== "cancelled"
      );
    };
    const getLessonStatus = (lesson) => {
      const lessonDateTime = /* @__PURE__ */ new Date(`${lesson.date}T${lesson.start_time}`);
      const now = /* @__PURE__ */ new Date();
      const hoursUntil = (lessonDateTime - now) / (1e3 * 60 * 60);
      const isPast = lessonDateTime < now;
      const myBooking = getMyBookingForLesson(lesson.id);
      const totalBooked = bookings.filter((b) => b.lesson_id === lesson.id && b.status !== "cancelled").length;
      const isFull = totalBooked >= lesson.max_students;
      const isLateWindow = hoursUntil < CANCELLATION_WINDOW_HOURS && hoursUntil > 0;
      if (isPast) return { status: "past", color: "#9ca3af", myBooking };
      if (myBooking) return { status: "booked", color: "#22c55e", myBooking, isLateWindow };
      if (isFull) return { status: "full", color: "#9ca3af", myBooking };
      return { status: "available", color: "#3b82f6", myBooking };
    };
    const getDayIndicator = (date) => {
      const dayLessons = getLessonsForDate(date);
      if (dayLessons.length === 0) return null;
      let hasBooked = false, hasAvailable = false;
      for (const l of dayLessons) {
        const status = getLessonStatus(l);
        if (status.status === "booked") hasBooked = true;
        if (status.status === "available") hasAvailable = true;
      }
      if (hasBooked) return "#22c55e";
      if (hasAvailable) return "#3b82f6";
      return "#9ca3af";
    };
    if (students.length === 0) {
      return /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.empty }, /* @__PURE__ */ React.createElement("p", null, "Add a student first before booking lessons."), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => setActiveTab("mystudents") }, "Add Student")));
    }
    const selectedDateLessons = selectedDate ? getLessonsForDate(selectedDate) : [];
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary },
        onClick: () => {
          const d = new Date(currentDate);
          d.setMonth(d.getMonth() - 1);
          setCurrentDate(d);
          setSelectedDate(null);
        }
      },
      "\u2190 Prev"
    ), /* @__PURE__ */ React.createElement("h2", { style: { margin: 0, fontSize: 18 } }, currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary },
        onClick: () => {
          const d = new Date(currentDate);
          d.setMonth(d.getMonth() + 1);
          setCurrentDate(d);
          setSelectedDate(null);
        }
      },
      "Next \u2192"
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16, marginBottom: 12, fontSize: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#22c55e", marginRight: 4 } }), " Your Booking"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#3b82f6", marginRight: 4 } }), " Available"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#9ca3af", marginRight: 4 } }), " Full/Past")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#e2e8f0" } }, DAY_NAMES.map((d) => /* @__PURE__ */ React.createElement("div", { key: d, style: { background: "#f1f5f9", padding: 8, textAlign: "center", fontWeight: 600, fontSize: 12 } }, d)), days.map(({ date, outside }, idx) => {
      const dateStr = toDateStr(date);
      const isToday = dateStr === todayStr;
      const isSelected = selectedDate && toDateStr(date) === toDateStr(selectedDate);
      const indicator = getDayIndicator(date);
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: idx,
          onClick: () => setSelectedDate(date),
          style: {
            background: isSelected ? "#ede9fe" : isToday ? "#fef3c7" : "white",
            padding: 8,
            minHeight: 60,
            cursor: "pointer",
            opacity: outside ? 0.4 : 1,
            border: isSelected ? "2px solid #7c3aed" : "1px solid transparent"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontWeight: isToday ? 700 : 400, fontSize: 14 } }, date.getDate()),
        indicator && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: indicator } }))
      );
    }))), selectedDate && /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("h3", { style: { margin: "0 0 16px 0" } }, selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })), selectedDateLessons.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No lessons available on this day.") : /* @__PURE__ */ React.createElement("div", null, selectedDateLessons.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((lesson) => {
      const lt = getLessonType(lesson.lesson_type);
      const venue = venues.find((v) => v.id === lesson.venue_id);
      const status = getLessonStatus(lesson);
      const totalBooked = bookings.filter((b) => b.lesson_id === lesson.id && b.status !== "cancelled").length;
      const spotsLeft = lesson.max_students - totalBooked;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: lesson.id,
          style: {
            ...styles.listItem,
            borderLeft: `4px solid ${status.color}`,
            background: status.status === "booked" ? "#f0fdf4" : status.status === "available" ? "#eff6ff" : "#f9fafb"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, formatTime(lesson.start_time), " - ", formatTime(lesson.end_time)), /* @__PURE__ */ React.createElement("span", { style: { ...styles.badge, background: lt.color, color: "white" } }, lt.icon, " ", lt.name)), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 13, marginTop: 4 } }, venue?.name || "TBD", status.status === "booked" && status.myBooking && /* @__PURE__ */ React.createElement("span", null, " \u2022 Booked: ", students.find((s) => s.id === status.myBooking.student_id)?.name), status.status === "available" && /* @__PURE__ */ React.createElement("span", null, " \u2022 ", spotsLeft, " spot", spotsLeft !== 1 ? "s" : "", " available"), status.status === "full" && /* @__PURE__ */ React.createElement("span", null, " \u2022 Full"), status.status === "past" && /* @__PURE__ */ React.createElement("span", null, " \u2022 Past"))),
        /* @__PURE__ */ React.createElement("div", null, status.status === "available" && /* @__PURE__ */ React.createElement(
          "button",
          {
            style: { ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall },
            onClick: () => setBookingLesson(lesson)
          },
          "Book"
        ), status.status === "booked" && /* @__PURE__ */ React.createElement(
          "button",
          {
            style: { ...styles.btn, ...styles.btnDanger, ...styles.btnSmall },
            onClick: () => cancelBooking(status.myBooking.id)
          },
          status.isLateWindow ? "\u26A0\uFE0F Cancel (Late)" : "Cancel"
        ))
      );
    }))), bookingLesson && /* @__PURE__ */ React.createElement("div", { style: styles.modalOverlay, onClick: () => setBookingLesson(null) }, /* @__PURE__ */ React.createElement("div", { style: styles.modal, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, "Book Lesson"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: () => setBookingLesson(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", null, formatDate(bookingLesson.date)), /* @__PURE__ */ React.createElement("br", null), formatTime(bookingLesson.start_time), " - ", formatTime(bookingLesson.end_time), /* @__PURE__ */ React.createElement("br", null), venues.find((v) => v.id === bookingLesson.venue_id)?.name || "TBD"), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Select Student"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, (() => {
      const lessonBookings = bookings.filter((b) => b.lesson_id === bookingLesson.id && b.status !== "cancelled");
      const bookedStudentIds = lessonBookings.map((b) => b.student_id);
      const spotsRemaining = bookingLesson.max_students - lessonBookings.length;
      const availableStudents = students.filter((s) => !bookedStudentIds.includes(s.id));
      if (spotsRemaining <= 0) {
        return /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#fef3c7", borderRadius: 8, color: "#92400e" } }, "This lesson is now full. Please select a different time.");
      }
      if (availableStudents.length === 0) {
        return /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#f0fdf4", borderRadius: 8, color: "#166534" } }, "All your students are already booked for this lesson.");
      }
      return availableStudents.map((s) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: s.id,
          style: { ...styles.btn, ...styles.btnPrimary, textAlign: "left" },
          onClick: () => {
            bookLesson(bookingLesson.id, s.id);
            setBookingLesson(null);
          }
        },
        s.name
      ));
    })()), (() => {
      const lessonBookings = bookings.filter((b) => b.lesson_id === bookingLesson.id && b.status !== "cancelled");
      const spotsRemaining = bookingLesson.max_students - lessonBookings.length;
      return /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 12, color: "#64748b" } }, spotsRemaining, " of ", bookingLesson.max_students, " spot", bookingLesson.max_students !== 1 ? "s" : "", " available");
    })())))));
  };
  const renderMyStudents = () => /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.cardHeader }, /* @__PURE__ */ React.createElement("h2", { style: styles.cardTitle }, "My Students"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: () => openStudentModal() }, "+ Add Student")), clients.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16, padding: 16, background: "#fef3c7", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", null, "First, add your contact info:"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary, marginLeft: 12 }, onClick: () => openClientModal() }, "Add My Info")), students.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: styles.empty }, "No students added yet.") : /* @__PURE__ */ React.createElement("div", null, students.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, style: styles.listItem }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, s.name), /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", fontSize: 13, marginTop: 4 } }, s.isi_level && `ISI: ${s.isi_level}`, s.isi_level && s.usfsa_level && " \u2022 ", s.usfsa_level && `USFSA: ${s.usfsa_level}`)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary, marginRight: 8 }, onClick: () => openStudentModal(s) }, "Edit"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }, onClick: () => deleteStudent(s.id) }, "Delete"))))));
  const renderModal = () => {
    if (!showModal) return null;
    const closeModal = () => {
      setShowModal(null);
      setEditingItem(null);
    };
    return /* @__PURE__ */ React.createElement("div", { style: styles.modalOverlay, onClick: closeModal }, /* @__PURE__ */ React.createElement("div", { style: styles.modal, onClick: (e) => e.stopPropagation() }, showModal === "lesson" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Lesson" : "New Lesson"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Date"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: lessonForm.date, onChange: (e) => setLessonForm({ ...lessonForm, date: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Start Time"), /* @__PURE__ */ React.createElement("input", { type: "time", style: styles.input, value: lessonForm.start_time, onChange: (e) => setLessonForm({ ...lessonForm, start_time: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "End Time"), /* @__PURE__ */ React.createElement("input", { type: "time", style: styles.input, value: lessonForm.end_time, onChange: (e) => setLessonForm({ ...lessonForm, end_time: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Lesson Type"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: lessonForm.lesson_type, onChange: (e) => {
      if (e.target.value === "__add_new__") {
        setShowAddLessonType(true);
      } else {
        const lt = getLessonType(e.target.value);
        setLessonForm({ ...lessonForm, lesson_type: e.target.value, max_students: lt.max, rate: lt.rate });
      }
    } }, LESSON_TYPES.map((t) => /* @__PURE__ */ React.createElement("option", { key: t.id, value: t.id }, t.icon, " ", t.name)), customLessonTypes.map((t) => /* @__PURE__ */ React.createElement("option", { key: t.id, value: t.id }, t.icon, " ", t.name)), isCoach && /* @__PURE__ */ React.createElement("option", { value: "__add_new__" }, "\u2795 Add New Type...")), showAddLessonType && /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: 12,
      padding: 12,
      background: "#f8fafc",
      borderRadius: 6,
      border: "1px solid #e2e8f0"
    } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8, fontWeight: 600, fontSize: 14 } }, "Add Custom Lesson Type"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "Name",
        style: { ...styles.input, fontSize: 13, padding: "6px 10px" },
        value: newLessonType.name,
        onChange: (e) => setNewLessonType({ ...newLessonType, name: e.target.value })
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "60px 1fr", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "\u{1F4DA}",
        style: { ...styles.input, fontSize: 13, padding: "6px 10px", textAlign: "center" },
        value: newLessonType.icon,
        onChange: (e) => setNewLessonType({ ...newLessonType, icon: e.target.value })
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "color",
        style: { width: "100%", height: 32, border: "1px solid #e2e8f0", borderRadius: 4 },
        value: newLessonType.color,
        onChange: (e) => setNewLessonType({ ...newLessonType, color: e.target.value })
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        placeholder: "Max students",
        min: 1,
        style: { ...styles.input, fontSize: 13, padding: "6px 10px" },
        value: newLessonType.max,
        onChange: (e) => setNewLessonType({ ...newLessonType, max: parseInt(e.target.value) })
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        placeholder: "Rate",
        step: "0.01",
        style: { ...styles.input, fontSize: 13, padding: "6px 10px" },
        value: newLessonType.rate,
        onChange: (e) => setNewLessonType({ ...newLessonType, rate: parseFloat(e.target.value) })
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4 } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnPrimary, flex: 1, padding: "6px 12px", fontSize: 13 },
        onClick: addCustomLessonType
      },
      "Add Type"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        style: { ...styles.btn, ...styles.btnSecondary, flex: 1, padding: "6px 12px", fontSize: 13 },
        onClick: () => {
          setShowAddLessonType(false);
          setNewLessonType({ name: "", icon: "\u{1F4DA}", color: "#3b82f6", max: 1, rate: 50 });
        }
      },
      "Cancel"
    ))))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Max Students"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, min: 1, value: lessonForm.max_students, onChange: (e) => setLessonForm({ ...lessonForm, max_students: parseInt(e.target.value) }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Venue"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: lessonForm.venue_id, onChange: (e) => setLessonForm({ ...lessonForm, venue_id: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select venue..."), venues.map((v) => /* @__PURE__ */ React.createElement("option", { key: v.id, value: v.id }, v.name)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Rate ($)"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.01", value: lessonForm.rate, onChange: (e) => setLessonForm({ ...lessonForm, rate: parseFloat(e.target.value) }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: { ...styles.label, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", style: styles.checkbox, checked: lessonForm.is_published, onChange: (e) => setLessonForm({ ...lessonForm, is_published: e.target.checked }) }), "Published (visible for booking)")), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { style: styles.textarea, value: lessonForm.notes, onChange: (e) => setLessonForm({ ...lessonForm, notes: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, editingItem && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnDanger, marginRight: "auto" }, onClick: () => deleteLesson(editingItem.id) }, "Delete"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveLesson }, "Save"))), showModal === "event" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Event" : "New Event"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Event Name"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: eventForm.name, onChange: (e) => setEventForm({ ...eventForm, name: e.target.value }), placeholder: "e.g., Winter Classic" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Event Type"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: eventForm.event_type, onChange: (e) => setEventForm({ ...eventForm, event_type: e.target.value }) }, EVENT_TYPES.map((t) => /* @__PURE__ */ React.createElement("option", { key: t.id, value: t.id }, t.icon, " ", t.name)))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Start Date"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: eventForm.start_date, onChange: (e) => setEventForm({ ...eventForm, start_date: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "End Date"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: eventForm.end_date, onChange: (e) => setEventForm({ ...eventForm, end_date: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Venue"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: eventForm.venue_id, onChange: (e) => setEventForm({ ...eventForm, venue_id: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select venue..."), venues.map((v) => /* @__PURE__ */ React.createElement("option", { key: v.id, value: v.id }, v.name)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: { ...styles.label, display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", style: styles.checkbox, checked: eventForm.is_registrable, onChange: (e) => setEventForm({ ...eventForm, is_registrable: e.target.checked }) }), "Allow student registration")), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { style: styles.textarea, value: eventForm.notes, onChange: (e) => setEventForm({ ...eventForm, notes: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, editingItem && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnDanger, marginRight: "auto" }, onClick: () => deleteEvent(editingItem.id) }, "Delete"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveEvent }, "Save"))), showModal === "client" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Client" : "New Client"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Name *"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.name, onChange: (e) => setClientForm({ ...clientForm, name: e.target.value }), required: true })), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Email"), /* @__PURE__ */ React.createElement("input", { type: "email", style: styles.input, value: clientForm.email, onChange: (e) => setClientForm({ ...clientForm, email: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Phone"), /* @__PURE__ */ React.createElement("input", { type: "tel", style: styles.input, value: clientForm.phone, onChange: (e) => setClientForm({ ...clientForm, phone: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Address"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.address, onChange: (e) => setClientForm({ ...clientForm, address: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "City"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.city, onChange: (e) => setClientForm({ ...clientForm, city: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "State"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.state, onChange: (e) => setClientForm({ ...clientForm, state: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ZIP"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.zip, onChange: (e) => setClientForm({ ...clientForm, zip: e.target.value }) })), /* @__PURE__ */ React.createElement("hr", { style: { margin: "16px 0", border: "none", borderTop: "1px solid #e2e8f0" } }), /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: 12 } }, "Second Parent/Guardian (Optional)"), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Name"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: clientForm.parent2_name, onChange: (e) => setClientForm({ ...clientForm, parent2_name: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Email"), /* @__PURE__ */ React.createElement("input", { type: "email", style: styles.input, value: clientForm.parent2_email, onChange: (e) => setClientForm({ ...clientForm, parent2_email: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Phone"), /* @__PURE__ */ React.createElement("input", { type: "tel", style: styles.input, value: clientForm.parent2_phone, onChange: (e) => setClientForm({ ...clientForm, parent2_phone: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { style: styles.textarea, value: clientForm.notes, onChange: (e) => setClientForm({ ...clientForm, notes: e.target.value }) })), !editingItem && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("hr", { style: { margin: "16px 0", border: "none", borderTop: "1px solid #e2e8f0" } }), /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: 8 } }, "Student Information (Optional)"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "#64748b", marginBottom: 12 } }, "Add child's name to auto-create student record. Leave blank if client is the student (adult)."), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Child/Student Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        style: styles.input,
        value: clientForm.child_name,
        onChange: (e) => setClientForm({ ...clientForm, child_name: e.target.value }),
        placeholder: "Leave blank if client is the student"
      }
    )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Child Birthdate"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: clientForm.child_birthdate, onChange: (e) => setClientForm({ ...clientForm, child_birthdate: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Child Email (for self-login)"), /* @__PURE__ */ React.createElement("input", { type: "email", style: styles.input, value: clientForm.child_email, onChange: (e) => setClientForm({ ...clientForm, child_email: e.target.value }) })))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, editingItem && isCoach && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnDanger, marginRight: "auto" }, onClick: () => deleteClient(editingItem.id) }, "Delete"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveClient }, "Save"))), showModal === "student" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Student" : "New Student"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Parent/Client *"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.client_id, onChange: (e) => setStudentForm({ ...studentForm, client_id: e.target.value }), required: true }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select parent..."), clients.map((c) => /* @__PURE__ */ React.createElement("option", { key: c.id, value: c.id }, c.name)))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Student Name ", isCoach ? "*" : ""), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        style: styles.input,
        value: studentForm.name,
        onChange: (e) => setStudentForm({ ...studentForm, name: e.target.value }),
        placeholder: isCoach ? "" : "Leave blank to add yourself"
      }
    )), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Email"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        style: styles.input,
        value: studentForm.email,
        onChange: (e) => setStudentForm({ ...studentForm, email: e.target.value }),
        placeholder: isCoach ? "Optional" : "Optional (uses yours if blank)"
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Birthdate"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: studentForm.birthdate, onChange: (e) => setStudentForm({ ...studentForm, birthdate: e.target.value }) })), /* @__PURE__ */ React.createElement("hr", { style: { margin: "20px 0", border: "none", borderTop: "2px solid #3b82f6" } }), /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: 16, color: "#1e40af" } }, "ISI Skill Levels"), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Freestyle Level"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_freestyle, onChange: (e) => setStudentForm({ ...studentForm, isi_freestyle: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_FREESTYLE_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Figures"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_figures, onChange: (e) => setStudentForm({ ...studentForm, isi_figures: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_FIGURES_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Couples"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_couples, onChange: (e) => setStudentForm({ ...studentForm, isi_couples: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_COUPLES_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Pairs"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_pairs, onChange: (e) => setStudentForm({ ...studentForm, isi_pairs: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_PAIRS_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Ice Dance"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_icedance, onChange: (e) => setStudentForm({ ...studentForm, isi_icedance: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_ICEDANCE_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI International Dance"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_international_dance, onChange: (e) => setStudentForm({ ...studentForm, isi_international_dance: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select dance..."), ISI_INTERNATIONAL_DANCE_ALL.map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d))))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Free Dance Partnered"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_freedance_partnered, onChange: (e) => setStudentForm({ ...studentForm, isi_freedance_partnered: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_FREEDANCE_PARTNERED_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Open Solo Free Dance"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_solo_freedance, onChange: (e) => setStudentForm({ ...studentForm, isi_solo_freedance: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_SOLO_FREEDANCE_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Synchro"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_synchro, onChange: (e) => setStudentForm({ ...studentForm, isi_synchro: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_SYNCHRO_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Special Skater"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.isi_special_skater, onChange: (e) => setStudentForm({ ...studentForm, isi_special_skater: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), ISI_SPECIAL_SKATER_LEVELS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "ISI Membership Number"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: studentForm.isi_number, onChange: (e) => setStudentForm({ ...studentForm, isi_number: e.target.value }) })), /* @__PURE__ */ React.createElement("hr", { style: { margin: "20px 0", border: "none", borderTop: "2px solid #10b981" } }), /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: 16, color: "#047857" } }, "USFSA Test Levels"), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Skating Skills (Moves)"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.usfsa_skating_skills, onChange: (e) => setStudentForm({ ...studentForm, usfsa_skating_skills: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), USFSA_SKATING_SKILLS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Singles (Free Skate)"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.usfsa_singles, onChange: (e) => setStudentForm({ ...studentForm, usfsa_singles: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), USFSA_SINGLES.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Pattern Dance"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.usfsa_pattern_dance, onChange: (e) => setStudentForm({ ...studentForm, usfsa_pattern_dance: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select dance..."), ISI_INTERNATIONAL_DANCE_ALL.map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Free Dance"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.usfsa_free_dance, onChange: (e) => setStudentForm({ ...studentForm, usfsa_free_dance: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), USFSA_FREE_DANCE.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l))))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Pairs"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: studentForm.usfsa_pairs, onChange: (e) => setStudentForm({ ...studentForm, usfsa_pairs: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select level..."), USFSA_PAIRS.map((l) => /* @__PURE__ */ React.createElement("option", { key: l, value: l }, l)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "USFSA Membership Number"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: studentForm.usfsa_number, onChange: (e) => setStudentForm({ ...studentForm, usfsa_number: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { style: styles.textarea, value: studentForm.notes, onChange: (e) => setStudentForm({ ...studentForm, notes: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveStudent }, "Save"))), showModal === "venue" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Venue" : "New Venue"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Venue Name *"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: venueForm.name, onChange: (e) => setVenueForm({ ...venueForm, name: e.target.value }), placeholder: "e.g., Winterland Ice Arena", required: true })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Address"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: venueForm.address, onChange: (e) => setVenueForm({ ...venueForm, address: e.target.value }), placeholder: "123 Ice Way, Skating City, ST 12345" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Color (for calendar dot)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "color",
        style: { width: 60, height: 40, border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer" },
        value: venueForm.color,
        onChange: (e) => setVenueForm({ ...venueForm, color: e.target.value })
      }
    ), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "#64748b" } }, "A small dot in this color will appear on lessons at this venue")))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, editingItem && /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnDanger, marginRight: "auto" }, onClick: () => deleteVenue(editingItem.id) }, "Delete"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveVenue }, "Save"))), showModal === "expense" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Expense" : "New Expense"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Date *"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: expenseForm.date, onChange: (e) => setExpenseForm({ ...expenseForm, date: e.target.value }), required: true })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Amount *"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.01", value: expenseForm.amount, onChange: (e) => setExpenseForm({ ...expenseForm, amount: e.target.value }), required: true }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Category"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: expenseForm.category, onChange: (e) => setExpenseForm({ ...expenseForm, category: e.target.value }) }, reportSettings.expense_categories.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, c)))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Description"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: expenseForm.description, onChange: (e) => setExpenseForm({ ...expenseForm, description: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Vendor"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: expenseForm.vendor, onChange: (e) => setExpenseForm({ ...expenseForm, vendor: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Payment Method"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: expenseForm.payment_method, onChange: (e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value }) }, PAYMENT_METHODS.map((m) => /* @__PURE__ */ React.createElement("option", { key: m, value: m }, m)))))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveExpense }, "Save"))), showModal === "mileage" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, editingItem ? "Edit Mileage" : "Log Mileage"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Entry Type"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "entry_type", value: "manual", checked: mileageForm.entry_type === "manual", onChange: (e) => setMileageForm({ ...mileageForm, entry_type: e.target.value, miles: "", odometer_start: "", odometer_end: "" }), style: { marginRight: 6 } }), "Manual Entry"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "entry_type", value: "odometer", checked: mileageForm.entry_type === "odometer", onChange: (e) => setMileageForm({ ...mileageForm, entry_type: e.target.value, miles: "", odometer_start: "", odometer_end: "" }), style: { marginRight: 6 } }), "Odometer Reading"))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Date *"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: mileageForm.date, onChange: (e) => setMileageForm({ ...mileageForm, date: e.target.value }), required: true })), mileageForm.entry_type === "manual" ? /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Miles *"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.1", value: mileageForm.miles, onChange: (e) => setMileageForm({ ...mileageForm, miles: e.target.value }), required: true, placeholder: "e.g., 25.5" })) : /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Start Odometer *"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.1", value: mileageForm.odometer_start, onChange: (e) => setMileageForm({ ...mileageForm, odometer_start: e.target.value }), required: true, placeholder: "e.g., 45230.5" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "End Odometer *"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.1", value: mileageForm.odometer_end, onChange: (e) => setMileageForm({ ...mileageForm, odometer_end: e.target.value }), required: true, placeholder: "e.g., 45256.0" }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Description"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: mileageForm.description, onChange: (e) => setMileageForm({ ...mileageForm, description: e.target.value }), placeholder: "e.g., Round trip to Winterland Arena" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "IRS Rate ($/mile)"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.01", value: mileageForm.rate, onChange: (e) => setMileageForm({ ...mileageForm, rate: e.target.value }) }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginTop: 4 } }, "2025 IRS standard rate: $0.70/mile")), (() => {
      const miles = mileageForm.entry_type === "odometer" && mileageForm.odometer_start && mileageForm.odometer_end ? parseFloat(mileageForm.odometer_end) - parseFloat(mileageForm.odometer_start) : parseFloat(mileageForm.miles) || 0;
      return miles > 0 && mileageForm.rate ? /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#f8fafc", borderRadius: 8, marginTop: 8 } }, /* @__PURE__ */ React.createElement("strong", null, "Miles:"), " ", miles.toFixed(1), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", null, "Deduction:"), " ", formatCurrency(miles * parseFloat(mileageForm.rate))) : null;
    })()), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveMileage }, "Save"))), showModal === "invoice" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, "Create Invoice"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Client *"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: invoiceForm.client_id, onChange: (e) => {
      const { lessons: unbilled, lateCancellations } = getUnbilledLessons(e.target.value);
      const lessonsTotal = unbilled.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
      const lateCancelTotal = lateCancellations.reduce((sum, l) => sum + (l.rate || getLessonType(l.lesson_type).rate), 0);
      setInvoiceForm({
        ...invoiceForm,
        client_id: e.target.value,
        lessons: unbilled.map((l) => l.id),
        lateCancellations: lateCancellations.map((l) => l.id),
        amount: lessonsTotal + lateCancelTotal
      });
    } }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Select client..."), clients.map((c) => /* @__PURE__ */ React.createElement("option", { key: c.id, value: c.id }, c.name)))), /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#f8fafc", borderRadius: 8, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("strong", null, "Completed Lessons:"), " ", invoiceForm.lessons.length, /* @__PURE__ */ React.createElement("br", null), invoiceForm.lateCancellations?.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("strong", { style: { color: "#ef4444" } }, "Late Cancellations:"), " ", invoiceForm.lateCancellations.length, /* @__PURE__ */ React.createElement("br", null)), /* @__PURE__ */ React.createElement("strong", null, "Subtotal:"), " ", formatCurrency(invoiceForm.amount)), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Tax Rate (%)"), /* @__PURE__ */ React.createElement("input", { type: "number", style: styles.input, step: "0.01", value: invoiceForm.tax_rate, onChange: (e) => setInvoiceForm({ ...invoiceForm, tax_rate: parseFloat(e.target.value) || 0 }) })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Due Date"), /* @__PURE__ */ React.createElement("input", { type: "date", style: styles.input, value: invoiceForm.due_date, onChange: (e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Accepted Payment Methods"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: invoiceForm.payment_cash, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_cash: e.target.checked }), style: { marginRight: 6 } }), "Cash"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: invoiceForm.payment_check, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_check: e.target.checked }), style: { marginRight: 6 } }), "Check")), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Venmo"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: invoiceForm.payment_venmo, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_venmo: e.target.value }), placeholder: "@username" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "PayPal"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: invoiceForm.payment_paypal, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_paypal: e.target.value }), placeholder: "email@example.com" }))), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Zelle"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: invoiceForm.payment_zelle, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_zelle: e.target.value }), placeholder: "phone or email" })), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Cash App"), /* @__PURE__ */ React.createElement("input", { type: "text", style: styles.input, value: invoiceForm.payment_cashapp, onChange: (e) => setInvoiceForm({ ...invoiceForm, payment_cashapp: e.target.value }), placeholder: "$cashtag" })))), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Notes"), /* @__PURE__ */ React.createElement("textarea", { style: styles.textarea, value: invoiceForm.notes, onChange: (e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#dcfce7", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", null, "Total:"), " ", formatCurrency(invoiceForm.amount * (1 + invoiceForm.tax_rate / 100)))), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: saveInvoice, disabled: !invoiceForm.client_id }, "Create Invoice"))), showModal === "copyDay" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, "Copy Day"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("p", { style: { marginBottom: 16 } }, "Copy all lessons from ", /* @__PURE__ */ React.createElement("strong", null, copySource?.toLocaleDateString()), " to:"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, getWeekDates(copySource || currentDate).map((date, idx) => {
      const isCopySource = copySource && date.toDateString() === copySource.toDateString();
      const isSelected = copyTargetDays.includes(idx);
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: idx,
          style: {
            ...styles.btn,
            ...isSelected ? styles.btnPrimary : styles.btnSecondary,
            opacity: isCopySource ? 0.5 : 1
          },
          disabled: isCopySource,
          onClick: () => {
            if (isSelected) {
              setCopyTargetDays(copyTargetDays.filter((d) => d !== idx));
            } else {
              setCopyTargetDays([...copyTargetDays, idx]);
            }
          }
        },
        DAY_NAMES[idx],
        /* @__PURE__ */ React.createElement("br", null),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12 } }, date.getDate())
      );
    })), /* @__PURE__ */ React.createElement("p", { style: { marginTop: 16, fontSize: 13, color: "#64748b" } }, "Copied lessons will be unpublished (drafts). Conflicts will be skipped.")), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: executeCopyDay, disabled: copyTargetDays.length === 0 }, "Copy to ", copyTargetDays.length, " Day", copyTargetDays.length !== 1 ? "s" : ""))), showModal === "copyWeek" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, "Copy Week"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("p", { style: { marginBottom: 16 } }, "Copy this week's schedule to future weeks:"), /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Number of weeks to copy ahead"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: copyWeeks, onChange: (e) => setCopyWeeks(parseInt(e.target.value)) }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => /* @__PURE__ */ React.createElement("option", { key: n, value: n }, n, " week", n !== 1 ? "s" : "")))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "#64748b" } }, "Copied lessons will be unpublished (drafts). Conflicts will be skipped.")), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnPrimary }, onClick: executeCopyWeek }, "Copy to ", copyWeeks, " Week", copyWeeks !== 1 ? "s" : ""))), showModal === "registerCompetition" && registerCompetition && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: styles.modalHeader }, /* @__PURE__ */ React.createElement("h3", { style: styles.modalTitle }, "Register for ", registerCompetition.name), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "\u2715")), /* @__PURE__ */ React.createElement("div", { style: styles.modalBody }, /* @__PURE__ */ React.createElement("div", { style: styles.formGroup }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, "Select Student"), /* @__PURE__ */ React.createElement("select", { style: styles.select, value: registerStudentId, onChange: (e) => setRegisterStudentId(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a student..."), students.map((s) => {
      const alreadyRegistered = bookings.some(
        (b) => b.event_id === registerCompetition.id && b.student_id === s.id && b.status !== "cancelled"
      );
      return /* @__PURE__ */ React.createElement("option", { key: s.id, value: s.id, disabled: alreadyRegistered }, s.name, " ", alreadyRegistered ? "(already registered)" : "");
    }))), /* @__PURE__ */ React.createElement("div", { style: { padding: 12, background: "#f8fafc", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("strong", null, "Event:"), " ", registerCompetition.name, /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", null, "Date:"), " ", formatDate(registerCompetition.start_date), registerCompetition.end_date && registerCompetition.end_date !== registerCompetition.start_date && ` - ${formatDate(registerCompetition.end_date)}`)), /* @__PURE__ */ React.createElement("div", { style: styles.modalFooter }, /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary }, onClick: closeModal }, "Cancel"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSuccess }, onClick: registerForCompetition, disabled: !registerStudentId }, "Register")))));
  };
  const coachTabs = [
    { id: "calendar", label: "\u{1F4C5} Calendar" },
    { id: "clients", label: "\u{1F465} Clients" },
    { id: "students", label: "\u26F8\uFE0F Students" },
    { id: "events", label: "\u{1F3C6} Events" },
    { id: "venues", label: "\u{1F3DF}\uFE0F Venues" },
    { id: "invoices", label: "\u{1F4B5} Invoices" },
    { id: "expenses", label: "\u{1F4CA} Expenses" },
    { id: "mileage", label: "\u{1F697} Mileage" },
    { id: "reports", label: "\u{1F4C8} Reports" },
    { id: "settings", label: "\u2699\uFE0F Settings" }
  ];
  const clientTabs = [
    { id: "booking", label: "\u{1F4C5} Book Lessons" },
    { id: "mystudents", label: "\u26F8\uFE0F My Students" },
    { id: "events", label: "\u{1F3C6} Events" }
  ];
  const tabs = isCoach ? coachTabs : clientTabs;
  return /* @__PURE__ */ React.createElement("div", { style: styles.container }, /* @__PURE__ */ React.createElement("header", { style: styles.header }, /* @__PURE__ */ React.createElement("div", { style: styles.headerContent }, /* @__PURE__ */ React.createElement("div", { style: styles.logo }, "\u26F8\uFE0F IceBooks Pro"), /* @__PURE__ */ React.createElement("div", { style: styles.userInfo }, /* @__PURE__ */ React.createElement("span", null, profile?.name), /* @__PURE__ */ React.createElement("span", { style: { ...styles.badge, ...styles.badgeInfo } }, isCoach ? "Coach" : "Client"), /* @__PURE__ */ React.createElement("button", { style: { ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }, onClick: handleSignOut }, "Sign Out")))), /* @__PURE__ */ React.createElement("main", { style: styles.main }, /* @__PURE__ */ React.createElement("nav", { style: styles.nav }, tabs.map((tab) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: tab.id,
      style: { ...styles.navBtn, ...activeTab === tab.id ? styles.navBtnActive : {} },
      onClick: () => setActiveTab(tab.id)
    },
    tab.label
  ))), isCoach ? /* @__PURE__ */ React.createElement(React.Fragment, null, activeTab === "calendar" && renderCalendar(), activeTab === "clients" && renderClients(), activeTab === "students" && renderStudents(), activeTab === "events" && renderEvents(), activeTab === "venues" && renderVenues(), activeTab === "invoices" && renderInvoices(), activeTab === "expenses" && renderExpenses(), activeTab === "mileage" && renderMileage(), activeTab === "reports" && renderReports(), activeTab === "settings" && renderSettings()) : /* @__PURE__ */ React.createElement(React.Fragment, null, activeTab === "booking" && renderClientBooking(), activeTab === "mystudents" && renderMyStudents(), activeTab === "events" && renderEvents())), renderModal(), toast && /* @__PURE__ */ React.createElement("div", { style: styles.toast }, toast), /* @__PURE__ */ React.createElement("style", null, `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:hover { opacity: 0.9; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #7c3aed; }
      `));
}
export {
  App as default
};
