import { initializeApp } from 'firebase/app';

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
} from 'firebase/auth';

import {
    getFirestore,
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    where,
} from 'firebase/firestore';


const firebaseConfig = {
    apiKey: "AIzaSyCxTII7lrjTrcqq-HBaOEHBz7uqg5Zl9T8",
    authDomain: "undangan-ihsan-syarifah.firebaseapp.com",
    projectId: "undangan-ihsan-syarifah",
    storageBucket: "undangan-ihsan-syarifah.firebasestorage.app",
    messagingSenderId: "877091672086",
    appId: "1:877091672086:web:9758a37f0c575cc1b3a537",
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/**
 * Login menggunakan Firebase Anonymous Authentication.
 *
 * @returns {Promise<import('firebase/auth').User>}
 */
const loginAnonymously = async () => {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const credential = await signInAnonymously(auth);

    console.info(
        '[Firebase] Anonymous login berhasil:',
        credential.user.uid
    );

    return credential.user;
};


/**
 * Menunggu Firebase Authentication siap.
 *
 * @returns {Promise<import('firebase/auth').User>}
 */
const waitForAuth = () => new Promise((resolve, reject) => {
    if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
    }

    let finished = false;

    const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
            if (finished) {
                return;
            }

            if (user) {
                finished = true;
                unsubscribe();

                console.info(
                    '[Firebase] User siap:',
                    user.uid
                );

                resolve(user);
                return;
            }

            loginAnonymously()
                .then((anonymousUser) => {
                    if (finished) {
                        return;
                    }

                    finished = true;
                    unsubscribe();

                    resolve(anonymousUser);
                })
                .catch((error) => {
                    if (finished) {
                        return;
                    }

                    finished = true;
                    unsubscribe();

                    reject(error);
                });
        },
        (error) => {
            if (finished) {
                return;
            }

            finished = true;
            unsubscribe();

            reject(error);
        }
    );
});


/**
 * Collection komentar.
 *
 * @returns {import('firebase/firestore').CollectionReference}
 */
const commentsCollection = () => {
    return collection(db, 'comments');
};


/**
 * Membuat komentar baru.
 *
 * @param {object} data
 * @returns {Promise<import('firebase/firestore').DocumentReference>}
 */
const createComment = async (data) => {
    const user = await waitForAuth();

    return addDoc(
        commentsCollection(),
        {
            ...data,

            ownerUid: user.uid,

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp(),
        }
    );
};


/**
 * Mengambil satu komentar berdasarkan ID.
 *
 * @param {string} id
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot>}
 */
const getComment = (id) => {
    return getDoc(
        doc(db, 'comments', id)
    );
};


/**
 * Mengubah komentar.
 *
 * Hanya pemilik komentar yang boleh mengubahnya.
 *
 * @param {string} id
 * @param {object} data
 * @returns {Promise<void>}
 */
const updateComment = async (id, data) => {
    const user = await waitForAuth();

    const reference =
        doc(db, 'comments', id);

    const snapshot =
        await getDoc(reference);

    if (!snapshot.exists()) {
        throw new Error(
            'Comment not found.'
        );
    }

    if (
        snapshot.data().ownerUid !==
        user.uid
    ) {
        throw new Error(
            'You can only edit your own comment.'
        );
    }

    return updateDoc(
        reference,
        {
            ...data,
            updatedAt:
                serverTimestamp(),
        }
    );
};


/**
 * Menghapus komentar.
 *
 * Hanya pemilik komentar yang boleh menghapusnya.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
const removeComment = async (id) => {
    const user = await waitForAuth();

    const reference =
        doc(db, 'comments', id);

    const snapshot =
        await getDoc(reference);

    if (!snapshot.exists()) {
        throw new Error(
            'Comment not found.'
        );
    }

    if (
        snapshot.data().ownerUid !==
        user.uid
    ) {
        throw new Error(
            'You can only delete your own comment.'
        );
    }

    return deleteDoc(reference);
};


/**
 * Mengambil komentar terbaru.
 *
 * @param {object} options
 * @param {number} [options.maxResults=20]
 * @returns {Promise<import('firebase/firestore').QuerySnapshot>}
 */
const getComments = async ({
    maxResults = 20,
} = {}) => {

    const commentsQuery = query(
        commentsCollection(),

        orderBy(
            'createdAt',
            'desc'
        ),

        limit(maxResults)
    );

    return getDocs(
        commentsQuery
    );
};


export {
    app,
    auth,
    db,

    loginAnonymously,
    waitForAuth,

    commentsCollection,
    createComment,
    getComment,
    getComments,
    updateComment,
    removeComment,

    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,

    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    where,
};
