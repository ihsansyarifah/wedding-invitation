import { storage } from '../../common/storage.js';
import { tapTapAnimation } from '../../libs/confetti.js';

import {
    db,
    waitForAuth,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
} from '../../firebase.js';


export const like = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let likes = null;

    /**
     * @type {Map<string, AbortController>|null}
     */
    let listeners = null;


    /**
     * Mendapatkan referensi collection like
     * untuk sebuah komentar.
     *
     * Struktur:
     *
     * comments/{commentId}/likes/{uid}
     *
     * @param {string} commentId
     * @returns {import('firebase/firestore').CollectionReference}
     */
    const likesCollection = (commentId) => {
        return collection(
            db,
            'comments',
            commentId,
            'likes'
        );
    };


    /**
     * Mendapatkan referensi dokumen like milik
     * user Firebase yang sedang aktif.
     *
     * @param {string} commentId
     * @param {string} uid
     * @returns {import('firebase/firestore').DocumentReference}
     */
    const likeDocument = (
        commentId,
        uid
    ) => {
        return doc(
            db,
            'comments',
            commentId,
            'likes',
            uid
        );
    };


    /**
     * Mengambil jumlah like aktual dari Firestore.
     *
     * @param {string} commentId
     * @returns {Promise<number>}
     */
    const getLikeCount = async (
        commentId
    ) => {
        const snapshot =
            await getDocs(
                likesCollection(
                    commentId
                )
            );

        return snapshot.size;
    };


    /**
     * Mengecek apakah user Firebase saat ini
     * sudah memberikan like.
     *
     * @param {string} commentId
     * @param {string} uid
     * @returns {Promise<boolean>}
     */
    const hasLiked = async (
        commentId,
        uid
    ) => {
        const snapshot =
            await getDoc(
                likeDocument(
                    commentId,
                    uid
                )
            );

        return snapshot.exists();
    };


    /**
     * Mengatur tampilan tombol like.
     *
     * @param {HTMLButtonElement} button
     * @param {boolean} liked
     * @param {number} count
     * @returns {void}
     */
    const renderLike = (
        button,
        liked,
        count
    ) => {
        if (!button) {
            return;
        }

        const info =
            button.firstElementChild;

        const heart =
            button.lastElementChild;

        if (!info || !heart) {
            return;
        }

        info.setAttribute(
            'data-count-like',
            String(count)
        );

        info.innerText =
            String(count);

        if (liked) {
            heart.classList.remove(
                'fa-regular'
            );

            heart.classList.add(
                'fa-solid',
                'text-danger'
            );
        } else {
            heart.classList.remove(
                'fa-solid',
                'text-danger'
            );

            heart.classList.add(
                'fa-regular'
            );
        }
    };


    /**
     * Like / unlike sebuah komentar.
     *
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const love = async (button) => {

        if (!button) {
            return;
        }

        const info =
            button.firstElementChild;

        const id =
            button.getAttribute(
                'data-uuid'
            );

        if (!id || !info) {
            return;
        }

        button.disabled = true;

        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        try {
            const user =
                await waitForAuth();

            const uid =
                user.uid;

            const userLike =
                likeDocument(
                    id,
                    uid
                );

            const liked =
                await hasLiked(
                    id,
                    uid
                );

            if (liked) {

                /*
                 * User sudah like.
                 * Hapus like miliknya.
                 */
                await deleteDoc(
                    userLike
                );

                likes.unset(id);

            } else {

                /*
                 * User belum like.
                 * Buat satu dokumen like.
                 */
                await setDoc(
                    userLike,
                    {
                        uid,
                        createdAt:
                            new Date(),
                    }
                );

                likes.set(
                    id,
                    uid
                );
            }

            /*
             * Ambil jumlah aktual dari Firestore.
             * Jadi angka tidak hanya mengandalkan
             * angka yang ada di HTML.
             */
            const count =
                await getLikeCount(id);

            renderLike(
                button,
                !liked,
                count
            );

        } catch (error) {

            console.error(
                '[Firebase] Gagal mengubah like:',
                error
            );

            /*
             * Kalau gagal, jangan ubah
             * tampilan tombol.
             */
        } finally {
            info.innerText =
                info.getAttribute(
                    'data-count-like'
                ) || '0';

            button.disabled = false;
        }
    };


    /**
     * Mendapatkan tombol like sebuah komentar.
     *
     * @param {string} uuid
     * @returns {HTMLElement|null}
     */
    const getButtonLike = (
        uuid
    ) => {
        return document.querySelector(
            `button[onclick="undangan.comment.like.love(this)"][data-uuid="${uuid}"]`
        );
    };


    /**
     * Double tap pada komentar untuk Like.
     *
     * @param {HTMLElement} div
     * @returns {Promise<void>}
     */
    const tapTap = async (div) => {

        if (!navigator.onLine) {
            return;
        }

        const currentTime =
            Date.now();

        const tapLength =
            currentTime -
            parseInt(
                div.getAttribute(
                    'data-tapTime'
                )
            );

        const uuid =
            div.id.replace(
                'body-content-',
                ''
            );

        const isTapTap =
            tapLength < 300 &&
            tapLength > 0;

        const notLiked =
            !likes.has(uuid) &&
            div.getAttribute(
                'data-liked'
            ) !== 'true';

        if (
            isTapTap &&
            notLiked
        ) {
            tapTapAnimation(div);

            div.setAttribute(
                'data-liked',
                'true'
            );

            await love(
                getButtonLike(uuid)
            );

            div.setAttribute(
                'data-liked',
                'false'
            );
        }

        div.setAttribute(
            'data-tapTime',
            String(currentTime)
        );
    };


    /**
     * Menyiapkan status like sebuah komentar
     * ketika komentar selesai dirender.
     *
     * @param {string} uuid
     * @returns {Promise<void>}
     */
    const sync = async (
        uuid
    ) => {

        const button =
            getButtonLike(uuid);

        if (!button) {
            return;
        }

        try {
            const user =
                await waitForAuth();

            const liked =
                await hasLiked(
                    uuid,
                    user.uid
                );

            const count =
                await getLikeCount(
                    uuid
                );

            if (liked) {
                likes.set(
                    uuid,
                    user.uid
                );
            } else {
                likes.unset(uuid);
            }

            renderLike(
                button,
                liked,
                count
            );

        } catch (error) {

            console.error(
                '[Firebase] Gagal memuat like:',
                error
            );
        }
    };


    /**
     * Menambahkan listener double tap
     * pada body komentar.
     *
     * @param {string} uuid
     * @returns {void}
     */
    const addListener = (
        uuid
    ) => {

        const ac =
            new AbortController();

        const bodyLike =
            document.getElementById(
                `body-content-${uuid}`
            );

        if (!bodyLike) {
            return;
        }

        bodyLike.addEventListener(
            'touchend',
            () => tapTap(bodyLike),
            {
                signal:
                    ac.signal,
            }
        );

        listeners.set(
            uuid,
            ac
        );

        /*
         * Sinkronkan jumlah dan status like
         * dengan Firestore.
         */
        sync(uuid);
    };


    /**
     * Menghapus listener komentar.
     *
     * @param {string} uuid
     * @returns {void}
     */
    const removeListener = (
        uuid
    ) => {

        const ac =
            listeners.get(uuid);

        if (ac) {
            ac.abort();

            listeners.delete(
                uuid
            );
        }
    };


    /**
     * Inisialisasi Like.
     *
     * @returns {void}
     */
    const init = () => {

        listeners =
            new Map();

        likes =
            storage('likes');
    };


    return {
        init,
        love,
        getButtonLike,
        addListener,
        removeListener,
    };
})();
