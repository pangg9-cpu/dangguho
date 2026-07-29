import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAuuOUwXj4Cn9jHqmYWm6kUgp6YsxwFCH8",
  authDomain: "deanguho.firebaseapp.com",
  projectId: "deanguho",
  storageBucket: "deanguho.firebasestorage.app",
  messagingSenderId: "40066298281",
  appId: "1:40066298281:web:116d2ffc2fd52de77ad4b8",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

window.__migrateFamilyData = async (jsonString) => {
  await setDoc(doc(db, "shared", "family-hub-data"), JSON.parse(jsonString));
  console.log("이전 완료!");
};
