import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDL9yhI4GiqbcODr-3kx-fVIYgzAyb4wrY",
  authDomain: "creatorzone-trade.firebaseapp.com",
  projectId: "creatorzone-trade",
  storageBucket: "creatorzone-trade.firebasestorage.app",
  messagingSenderId: "280755836418",
  appId: "1:280755836418:web:812559aa57d2eda336f91b",
  measurementId: "G-92W73F44Q7",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);
