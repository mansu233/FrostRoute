// ONE place to rename the app or change the version.
// Every update: raise APP.version (the service worker reads this file, so phones refresh automatically).
const APP = { name: "FrostRoute", version: "0.12.0", date: "2026-10-24" };

// Paste your Firebase web app config (Firebase console > Project settings > Your apps)
const firebaseConfig = {
  apiKey: "AIzaSyBCh9FE6wrLYEVvhLew_YVpGbmGG0nLr2Q",
  authDomain: "frostroute-a6983.firebaseapp.com",
  projectId: "frostroute-a6983",
  storageBucket: "frostroute-a6983.firebasestorage.app",
  messagingSenderId: "126874365711",
  appId: "1:126874365711:web:8f1f1a6c68e14e2fde187a"
};

// Admin settings (saved in Firestore settings/app). Members cannot change them.
const DEFAULTS = {
  vatPercent: 15, pinLockSeconds: 90, passwordDays: 30,
  gpsRadius: 150, checkinMode: "warn", loadBuffer: 10,
  dailyVisitLimit: 20, manualTotal: 0, qPerVisit: 3, openDays: 3, holiday: 5, font: +(localStorage.getItem("font")||1), navAdmin: ["home","users","prod","cust","ord","cash"], navMember: ["home","cust","ord","cash","prod"], returnLimit: 0, dormantDays: 45, scanDuplicate: "highlight"
};
const SETTING_LABELS = {
  vatPercent: "VAT %", pinLockSeconds: "Ask PIN after background (seconds)", passwordDays: "Ask email password again after (days)",
  gpsRadius: "GPS check-in distance (m)", loadBuffer: "Load list buffer %", dailyVisitLimit: "Daily visit limit", dormantDays: "Dormant customer after (days without order)", returnLimit: "Returns above this amount need admin approval (0 = off)", openDays: "Open order reminder after (days)", holiday: "Holiday weekday (0 = Sunday, 5 = Friday)", qPerVisit: "Customer questions per visit (1 to 3)", manualTotal: "Allow typed cash total without counter (1 = yes)"
};

// Every permission is OFF for members until the admin switches it on.
const PERMS = {
  visitPlan: "Visit plan and reminders", manageCustomers: "Customers (add, search, camera)",
  viewProducts: "View products", createOrders: "Create orders", editRate: "Edit rate in order",
  addProducts: "Add / edit products", cancelSent: "Cancel sent orders", makeReturns: "Sales returns",
  collectPayments: "Collect payments", dayClosing: "Day closing", moneyCounter: "Money counter + WhatsApp share",
  loadList: "Night load list", skillPlan: "30-day skill plan (private)", custQ: "Customer questions (private answers)", viewRanking: "Customer ranking", viewReports: "Reports"
};

// Fonts the admin can choose in Settings (English and Arabic).
const FONTS = [
  { id: 1, name: "System default", css: "system-ui,-apple-system,'Segoe UI',Roboto", gf: "" },
  { id: 2, name: "Cairo", css: "Cairo", gf: "family=Cairo:wght@400;600;700" },
  { id: 3, name: "Tajawal", css: "Tajawal", gf: "family=Tajawal:wght@400;500;700" },
  { id: 4, name: "IBM Plex Sans Arabic", css: "'IBM Plex Sans Arabic'", gf: "family=IBM+Plex+Sans+Arabic:wght@400;600;700" },
  { id: 5, name: "Almarai", css: "Almarai", gf: "family=Almarai:wght@400;700" },
  { id: 6, name: "Readex Pro", css: "'Readex Pro'", gf: "family=Readex+Pro:wght@400;600;700" },
  { id: 7, name: "Inter (English only)", css: "Inter", gf: "family=Inter:wght@400;600;700" },
  { id: 8, name: "Poppins (English only)", css: "Poppins", gf: "family=Poppins:wght@400;600;700" },
  { id: 9, name: "Inter English + Cairo Arabic", css: "Inter,Cairo", gf: "family=Inter:wght@400;600;700&family=Cairo:wght@400;600;700" }
];
