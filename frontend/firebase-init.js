import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlHILUFjZBpiYgL59OFKljrrsAkXrc2oo",
  authDomain: "medassist-1bb76.firebaseapp.com",
  projectId: "medassist-1bb76",
  storageBucket: "medassist-1bb76.firebasestorage.app",
  messagingSenderId: "436423244912",
  appId: "1:436423244912:web:02bf59ec36d60ffed4c8b5",
  measurementId: "G-8J8C1VMTHL",
};

const app = initializeApp(firebaseConfig);

void isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {
    // Analytics is optional; keep the app usable if the browser blocks it.
  });
