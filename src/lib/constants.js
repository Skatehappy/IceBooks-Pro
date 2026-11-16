// Constants recovered from the legacy bundle (renamed).

export const DEFAULT_MILEAGE_RATE = 0.725;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_LATE_CANCEL_HOURS = 24;

export const DEFAULT_LESSON_TYPES = [
    {
      id: "private",
      name: "Private",
      icon: "👤",
      color: "#3b82f6",
      max: 1,
      rate: 75,
    },
    {
      id: "shared",
      name: "Shared",
      icon: "👥",
      color: "#8b5cf6",
      max: 2,
      rate: 50,
    },
    {
      id: "group",
      name: "Group",
      icon: "👨‍👩‍👧‍👦",
      color: "#10b981",
      max: 8,
      rate: 35,
    },
  ];

export const EVENT_TYPES = [
    { id: "competition", name: "Competition", icon: "🏆", color: "#f59e0b" },
    { id: "show", name: "Ice Show", icon: "⭐", color: "#ec4899" },
    { id: "testing", name: "Testing", icon: "📋", color: "#14b8a6" },
    { id: "personal", name: "Personal", icon: "📅", color: "#6366f1" },
    { id: "blocked", name: "Blocked", icon: "🚫", color: "#ef4444" },
  ];

export const DEFAULT_EXPENSE_CATEGORIES = [
    "Ice Time",
    "Music/Choreography",
    "Costumes",
    "Equipment",
    "Travel",
    "Training/Seminars",
    "Coaching Fees",
    "Membership Dues",
    "Insurance",
  ];

export const PAYMENT_METHODS = [
    "Cash",
    "Check",
    "Venmo",
    "PayPal",
    "Zelle",
    "Credit Card",
    "Bank Transfer",
  ];
