import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    increment,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyCxTII7lrjTrcqq-HBaOEHBz7uqg5Zl9T8',
    authDomain: 'undangan-ihsan-syarifah.firebaseapp.com',
    projectId: 'undangan-ihsan-syarifah',
    storageBucket: 'undangan-ihsan-syarifah.firebasestorage.app',
    messagingSenderId: '877091672086',
    appId: '1:877091672086:web:9758a37f0c575cc1b3a537',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const commentsCollection = collection(db, 'comments');

export {
    db,
    commentsCollection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    increment,
};
