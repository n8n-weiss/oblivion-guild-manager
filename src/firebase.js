// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8kmm-j_gsvSCflgAfXjFEIn_pOcr8Zs0",
  authDomain: "oblivion-guild-46b26.firebaseapp.com",
  projectId: "oblivion-guild-46b26",
  storageBucket: "oblivion-guild-46b26.firebasestorage.app",
  messagingSenderId: "120843884638",
  appId: "1:120843884638:web:cc4f81d2151ae972b2fccf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "default");