// ONE place to rename the app or change the version.
// Every update: raise APP.version (the service worker reads this file, so phones refresh automatically).
const APP = { name: "FrostRoute", version: "0.1.0", date: "2026-10-24" };

// Paste your Firebase web app config (Firebase console > Project settings > Your apps)
const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID"
};

// Admin settings (saved in Firestore settings/app). Members cannot change them.
const DEFAULTS = {
  vatPercent: 15, pinLockSeconds: 90, passwordDays: 30,
  gpsRadius: 150, checkinMode: "warn", loadBuffer: 10,
  dailyVisitLimit: 20, scanDuplicate: "highlight"
};
const SETTING_LABELS = {
  vatPercent: "VAT %", pinLockSeconds: "Ask PIN after background (seconds)", passwordDays: "Ask email password again after (days)",
  gpsRadius: "GPS check-in distance (m)", loadBuffer: "Load list buffer %", dailyVisitLimit: "Daily visit limit"
};

// Every permission is OFF for members until the admin switches it on.
const PERMS = {
  visitPlan: "Visit plan and reminders", manageCustomers: "Customers (add, search, camera)",
  viewProducts: "View products", createOrders: "Create orders", editRate: "Edit rate in order",
  addProducts: "Add / edit products", cancelSent: "Cancel sent orders", makeReturns: "Sales returns",
  collectPayments: "Collect payments", dayClosing: "Day closing", moneyCounter: "Money counter + WhatsApp share",
  loadList: "Night load list", viewRanking: "Customer ranking", viewReports: "Reports"
};
