import { initializeApp, getApps } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updatePassword,
    updateProfile,
    type User as FirebaseUser
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDuErXMmZvRByhm5xyb02kMWkBAwaDC-Jg",
    authDomain: "opstack-79d62.firebaseapp.com",
    projectId: "opstack-79d62",
    storageBucket: "opstack-79d62.firebasestorage.app",
    messagingSenderId: "1077905031956",
    appId: "1:1077905031956:web:4e2ea21fad9844f74a3801",
    measurementId: "G-B4DF543Y0E"
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

const API_BASE = 'http://localhost:5000/api';

export {
    API_BASE,

    auth,
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    firebaseSignOut,
    onAuthStateChanged,
    updatePassword,
    updateProfile,
    // Firestore exports
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
};

export type { FirebaseUser };
