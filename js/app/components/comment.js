import { card } from './card.js';
import { pagination } from './pagination.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { util } from '../../common/util.js';

import {
    commentsCollection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
    getOwnerId,
} from '../../firebase.js';

export const comment = (() => {

    let comments = null;
    let owns = null;

    /**
     * Pesan ketika belum ada komentar.
     */
    const onNullComment = () => {

        const desc = lang
            .on(
                'id',
                '📢 Yuk, tuliskan ucapan dan doa terbaik untuk Ihsan & Syarifah! ❤️'
            )
            .on(
                'en',
                '📢 Leave your best wishes for Ihsan & Syarifah! ❤️'
            )
            .get();

        return `
        <div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow">
            <p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">
                ${desc}
            </p>
        </div>`;
    };

    /**
     * Mengubah dokumen Firestore menjadi
     * format yang dipakai card.js.
     */
    const normalizeComment = (snapshot) => {

        const data = snapshot.data();

        let createdAt = new Date();

        if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
        }

        const ownerId = data.ownerId ?? null;

        /*
         * Kalau komentar ini milik browser sekarang,
         * simpan ID-nya supaya card.js bisa
         * menampilkan tombol Delete.
         */
        if (
            ownerId &&
            ownerId === getOwnerId()
        ) {
            owns.set(snapshot.id, true);
        }

        return {
            uuid: snapshot.id,

            own: ownerId === getOwnerId()
                ? getOwnerId()
                : '',

            name: data.name ?? 'Tamu',

            presence:
                data.attendance === 'Hadir',

            comment:
                data.message ?? '',

            created_at:
                createdAt.toLocaleString(
                    'id-ID',
                    {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    }
                ),

            is_admin: false,
            is_parent: true,
            gif_url: null,
            ip: null,
            user_agent: null,

            comments: [],

            like_count: 0,
        };
    };

    /**
     * Mengambil semua komentar dari Firestore.
     */
    const getFirebaseComments = async () => {

        const q = query(
            commentsCollection,
            orderBy(
                'createdAt',
                'desc'
            )
        );

        const snapshot =
            await getDocs(q);

        return snapshot.docs.map(
            normalizeComment
        );
    };

    /**
     * Menampilkan komentar.
     */
    const show = async () => {

        if (!comments) {
            return {
                data: {
                    count: 0,
                    lists: [],
                },
            };
        }

        comments.setAttribute(
            'data-loading',
            'true'
        );

        comments.innerHTML =
            card.renderLoading()
                .repeat(
                    pagination.getPer()
                );

        try {

            const lists =
                await getFirebaseComments();

            comments.setAttribute(
                'data-loading',
                'false'
            );

            if (lists.length === 0) {

                comments.innerHTML =
                    onNullComment();

                pagination.setTotal(0);

                comments.dispatchEvent(
                    new Event(
                        'undangan.comment.result'
                    )
                );

                comments.dispatchEvent(
                    new Event(
                        'undangan.comment.done'
                    )
                );

                return {
                    data: {
                        count: 0,
                        lists: [],
                    },
                };
            }

            /*
             * Pagination sederhana.
             */
            const per =
                pagination.getPer();

            const page =
                pagination.getCurrent
                    ? pagination.getCurrent()
                    : 1;

            const start =
                Math.max(
                    0,
                    (page - 1) * per
                );

            const visibleLists =
                lists.slice(
                    start,
                    start + per
                );

            /*
             * Pastikan owner map sudah diperbarui
             * sebelum card dirender.
             */
            visibleLists.forEach(
                (item) => {

                    if (
                        item.own &&
                        item.own === getOwnerId()
                    ) {
                        owns.set(
                            item.uuid,
                            true
                        );
                    }
                }
            );

            const html =
                await card.renderContentMany(
                    visibleLists
                );

            util.safeInnerHTML(
                comments,
                html
            );

            pagination.setTotal(
                lists.length
            );

            comments.dispatchEvent(
                new Event(
                    'undangan.comment.result'
                )
            );

            comments.dispatchEvent(
                new Event(
                    'undangan.comment.done'
                )
            );

            return {
                data: {
                    count: lists.length,
                    lists: visibleLists,
                },
            };

        } catch (error) {

            console.error(
                'Firebase comments error:',
                error
            );

            comments.setAttribute(
                'data-loading',
                'false'
            );

            comments.innerHTML = `
            <div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow">
                <p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">
                    Komentar belum dapat dimuat.
                </p>

                <small class="text-muted">
                    Silakan coba lagi beberapa saat.
                </small>
            </div>`;

            throw error;
        }
    };

    /**
     * Mengirim komentar baru.
     */
    const send = async (button) => {

        const name =
            document.getElementById(
                'form-name'
            );

        const presence =
            document.getElementById(
                'form-presence'
            );

        const form =
            document.getElementById(
                'form-comment'
            );

        const nameValue =
            name?.value?.trim() ?? '';

        const messageValue =
            form?.value?.trim() ?? '';

        /*
         * Validasi nama.
         */
        if (!nameValue) {

            util.notify(
                'Nama tidak boleh kosong.'
            ).warning();

            name?.focus();

            return;
        }

        /*
         * Validasi kehadiran.
         */
        if (
            presence &&
            presence.value === '0'
        ) {

            util.notify(
                'Silakan pilih konfirmasi kehadiran.'
            ).warning();

            presence.focus();

            return;
        }

        /*
         * Validasi komentar.
         */
        if (!messageValue) {

            util.notify(
                'Ucapan tidak boleh kosong.'
            ).warning();

            form?.focus();

            return;
        }

        const attendance =
            presence?.value === '1';

        const ownerId =
            getOwnerId();

        const btn =
            util.disableButton(button);

        name.disabled = true;

        if (presence) {
            presence.disabled = true;
        }

        form.disabled = true;

        try {

            const created =
                await addDoc(
                    commentsCollection,
                    {
                        name: nameValue,

                        message:
                            messageValue,

                        attendance:
                            attendance
                                ? 'Hadir'
                                : 'Berhalangan',

                        createdAt:
                            serverTimestamp(),

                        ownerId:
                            ownerId,
                    }
                );

            /*
             * Simpan komentar sebagai milik
             * browser ini.
             */
            owns.set(
                created.id,
                true
            );

            /*
             * Simpan data form di browser.
             */
            const information =
                storage('information');

            information.set(
                'name',
                nameValue
            );

            information.set(
                'presence',
                attendance
            );

            form.value = '';

            /*
             * Kembali ke halaman pertama.
             */
            if (
                typeof pagination.reset ===
                'function'
            ) {
                pagination.reset();
            }

            await show();

            util.notify(
                'Ucapan berhasil dikirim ❤️'
            ).success();

        } catch (error) {

            console.error(
                'Firebase send comment error:',
                error
            );

            util.notify(
                'Ucapan gagal dikirim. Silakan coba lagi.'
            ).danger();

        } finally {

            name.disabled = false;

            if (presence) {
                presence.disabled = false;
            }

            form.disabled = false;

            btn.restore();
        }
    };

    /**
     * Menghapus komentar milik sendiri.
     */
    const remove = async (button) => {

        const uuid =
            button.getAttribute(
                'data-uuid'
            );

        if (!uuid) {
            return;
        }

        /*
         * Pengamanan pertama:
         * browser ini harus mengenali
         * komentar sebagai miliknya.
         */
        if (!owns.has(uuid)) {

            util.notify(
                'Kamu tidak dapat menghapus ucapan ini.'
            ).warning();

            return;
        }

        const confirmDelete =
            window.confirm(
                'Hapus ucapan ini?'
            );

        if (!confirmDelete) {
            return;
        }

        const btn =
            util.disableButton(button);

        try {

            await deleteDoc(
                doc(
                    commentsCollection,
                    uuid
                )
            );

            owns.unset(uuid);

            document
                .getElementById(uuid)
                ?.remove();

            util.notify(
                'Ucapan berhasil dihapus.'
            ).success();

        } catch (error) {

            console.error(
                'Firebase delete comment error:',
                error
            );

            util.notify(
                'Ucapan gagal dihapus.'
            ).danger();

        } finally {

            btn.restore();
        }
    };

    /**
     * Menampilkan teks komentar panjang.
     */
    const showMore = (
        anchor,
        uuid
    ) => {

        const content =
            document.getElementById(
                `content-${uuid}`
            );

        if (!content) {
            return;
        }

        const original =
            util.base64Decode(
                content.getAttribute(
                    'data-comment'
                )
            );

        const isCollapsed =
            anchor.getAttribute(
                'data-show'
            ) === 'false';

        const text =
            isCollapsed
                ? original
                : `${original.slice(
                    0,
                    card.maxCommentLength
                )}...`;

        util.safeInnerHTML(
            content,
            util.convertMarkdownToHTML(
                util.escapeHtml(text)
            )
        );

        anchor.innerText =
            isCollapsed
                ? 'Sebagian'
                : 'Selengkapnya';

        anchor.setAttribute(
            'data-show',
            isCollapsed
                ? 'true'
                : 'false'
        );
    };

    /**
     * Tidak digunakan lagi.
     * Dipertahankan supaya pemanggilan lama
     * tidak menyebabkan error.
     */
    const edit = () => {
        util.notify(
            'Fitur edit tidak tersedia.'
        ).warning();
    };

    const update = () => {
        util.notify(
            'Fitur edit tidak tersedia.'
        ).warning();
    };

    const reply = () => {
        util.notify(
            'Fitur balasan tidak tersedia.'
        ).warning();
    };

    const showOrHide = () => {
        return;
    };

    const cancel = () => {
        return;
    };

    /**
     * Inisialisasi komentar.
     */
    const init = () => {

        card.init();

        pagination.init();

        comments =
            document.getElementById(
                'comments'
            );

        owns =
            storage('owns');

        if (!comments) {
            return;
        }

        /*
         * Bersihkan data ownership lama.
         */
        owns.clear();
    };

    return {
        pagination,

        init,

        send,
        remove,

        edit,
        update,
        reply,
        cancel,

        show,
        showMore,
        showOrHide,
    };
})();
