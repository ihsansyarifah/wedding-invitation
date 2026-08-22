import { initializeApp } from 'firebase/app';

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';

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

const commentsCollection = collection(
    db,
    'comments'
);

const getOwnerId = () => {

    const key = 'ihsan_syarifah_owner_id';

    let ownerId =
        localStorage.getItem(key);

    if (!ownerId) {

        ownerId =
            crypto.randomUUID();

        localStorage.setItem(
            key,
            ownerId
        );
    }

    return ownerId;
};

export {
    db,
    commentsCollection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    getOwnerId,
};
