import { initializeApp, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Safely probe if credentials are valid production credentials or placeholder
export const isRealFirebaseConfig = 
  firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes("FakeKey") && 
  firebaseConfig.projectId && 
  !firebaseConfig.projectId.includes("mock");

let appInstance;
let authInstance;
let dbInstance;

if (isRealFirebaseConfig) {
  try {
    appInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    // Explicitly associate databaseId if configured
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || "(default)");
    console.log("RewardGateway: Cleanly connected to real Firebase instance.");
  } catch (err) {
    console.error("RewardGateway: Real Firebase credentials error. Falling back to simulations:", err);
  }
} else {
  console.log("RewardGateway: Using isolated client-side mock/simulator engine.");
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;
