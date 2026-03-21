import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8kmm-j_gsvSCflgAfXjFEIn_pOcr8Zs0",
  authDomain: "oblivion-guild-46b26.firebaseapp.com",
  projectId: "oblivion-guild-46b26",
  storageBucket: "xxxoblivion-guild-46b26.firebasestorage.app",
  messagingSenderId: "120843884638",
  appId: "1:120843884638:web:cc4f81d2151ae972b2fccf"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);