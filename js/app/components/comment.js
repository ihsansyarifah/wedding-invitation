import { gif } from './gif.js';
import { card } from './card.js';
import { like } from './like.js';
import { util } from '../../common/util.js';
import { pagination } from './pagination.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';

import {
    db,
    waitForAuth,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
} from '../../firebase.js';

export const comment = (() => {

    /*
     * ============================================================
     * KONFIGURASI
     * ============================================================
     *
     * Semua komentar dari undangan ini akan masuk ke:
     *
     * comments
     *   └── invitationId: "ihsan-syarifah"
     *
     * Jadi komentar template/orang lain tidak akan tercampur.
     */
    const INVITATION_ID = 'ihsan-syarifah';

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let owns = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let showHide = null;

    /**
     * @type {HTMLElement|null}
     */
    let comments = null;

    /**
     * Semua UUID yang sedang dirender.
     *
     * @type {string[]}
     */
    const lastRender = [];

    /**
     * Mengubah Firestore document menjadi format
     * yang dimengerti oleh card.js.
     *
     * @param {import('firebase/firestore').QueryDocumentSnapshot} snapshot
     * @returns {object}
     */
    const normalizeComment = (snapshot) => {
        const data = snapshot.data();

        let createdAt = '';

        if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt.toISOString();
        } else if (typeof data.createdAt === 'string') {
            createdAt = data.createdAt;
        }

        return {
            uuid: snapshot.id,

            /*
             * Untuk kompatibilitas dengan card.js.
             * own sekarang bukan token API Ulems lagi.
             */
            own: snapshot.id,

            name: typeof data.name === 'string'
                ? data.name
                : 'Tamu',

            presence: data.presence === true,

            comment: typeof data.comment === 'string'
                ? data.comment
                : null,

            created_at: createdAt,

            is_admin: false,

            is_parent: !data.parentId,

            /*
             * GIF akan kita sambungkan penuh nanti.
             * Untuk komentar biasa nilainya null.
             */
            gif_url: data.gifUrl ?? null,

            ip: null,

            user_agent: null,

            comments: [],

            like_count: Number(
                data.likeCount ?? 0
            ),
        };
    };

    /**
     * Membangun struktur komentar bertingkat.
     *
     * Firestore menyimpan semua komentar dalam satu collection.
     * Reply dibedakan menggunakan parentId.
     *
     * @param {object[]} items
     * @returns {object[]}
     */
    const buildTree = (items) => {
        const map = new Map();
        const roots = [];

        items.forEach((item) => {
            item.comments = [];
            map.set(item.uuid, item);
        });

        items.forEach((item) => {
            const raw = item.__raw;

            if (
                raw?.parentId &&
                map.has(raw.parentId)
            ) {
                map
                    .get(raw.parentId)
                    .comments
                    .push(item);
            } else {
                roots.push(item);
            }
        });

        const sortNewest = (a, b) => {
            const aTime = a.created_at
                ? new Date(a.created_at).getTime()
                : 0;

            const bTime = b.created_at
                ? new Date(b.created_at).getTime()
                : 0;

            return bTime - aTime;
        };

        roots.sort(sortNewest);

        const sortReplies = (item) => {
            item.comments.sort(sortNewest);

            item.comments.forEach(
                sortReplies
            );
        };

        roots.forEach(sortReplies);

        return roots;
    };

    /**
     * @returns {string}
     */
    const onNullComment = () => {
        const desc = lang
            .on(
                'id',
                '📢 Yuk, share undangan ini biar makin rame komentarnya! 🎉'
            )
            .on(
                'en',
                '📢 Let\'s share this invitation to get more comments! 🎉'
            )
            .get();

        return `
            <div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow">
                <p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">
                    ${desc}
                </p>
            </div>
        `;
    };

    /**
     * @param {string} id
     * @param {boolean} disabled
     * @returns {void}
     */
    const changeActionButton = (
        id,
        disabled
    ) => {
        const element =
            document.querySelector(
                `[data-button-action="${id}"]`
            );

        if (!element) {
            return;
        }

        element.childNodes.forEach((e) => {
            e.disabled = disabled;
        });
    };

    /**
     * @param {string} id
     * @returns {void}
     */
    const removeInnerForm = (id) => {
        changeActionButton(
            id,
            false
        );

        const element =
            document.getElementById(
                `inner-${id}`
            );

        if (element) {
            element.remove();
        }
    };

    /**
     * Menampilkan / menyembunyikan reply.
     *
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const showOrHide = (button) => {
        const rawIds =
            button.getAttribute(
                'data-uuids'
            );

        if (!rawIds) {
            return;
        }

        const ids = rawIds.split(',');

        const isShow =
            button.getAttribute(
                'data-show'
            ) === 'true';

        const uuid =
            button.getAttribute(
                'data-uuid'
            );

        const currentShow =
            showHide.get('show');

        button.setAttribute(
            'data-show',
            isShow
                ? 'false'
                : 'true'
        );

        button.innerText = isShow
            ? `Show replies (${ids.length})`
            : 'Hide replies';

        showHide.set(
            'show',
            isShow
                ? currentShow.filter(
                    (i) => i !== uuid
                )
                : [
                    ...currentShow,
                    uuid,
                ]
        );

        for (const id of ids) {
            const hidden =
                showHide.get('hidden');

            showHide.set(
                'hidden',
                hidden.map((i) => {
                    if (i.uuid === id) {
                        i.show = !isShow;
                    }

                    return i;
                })
            );

            const element =
                document.getElementById(id);

            if (element) {
                element.classList.toggle(
                    'd-none',
                    isShow
                );
            }
        }
    };

    /**
     * @param {HTMLAnchorElement} anchor
     * @param {string} uuid
     * @returns {void}
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

        const encoded =
            content.getAttribute(
                'data-comment'
            );

        if (!encoded) {
            return;
        }

        const original =
            util.base64Decode(
                encoded
            );

        const isCollapsed =
            anchor.getAttribute(
                'data-show'
            ) === 'false';

        const text = isCollapsed
            ? original
            : original.slice(
                0,
                card.maxCommentLength
            ) + '...';

        util.safeInnerHTML(
            content,
            util.convertMarkdownToHTML(
                util.escapeHtml(text)
            )
        );

        anchor.innerText = isCollapsed
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
     * Membuat data komentar dari Firestore.
     *
     * @returns {Promise<object[]>}
     */
    const loadAllComments = async () => {
        await waitForAuth();

        const commentsQuery =
            query(
                collection(
                    db,
                    'comments'
                ),
                where(
                    'invitationId',
                    '==',
                    INVITATION_ID
                )
            );

        const snapshot =
            await getDocs(
                commentsQuery
            );

        const items = [];

        snapshot.forEach((item) => {
            const normalized =
                normalizeComment(item);

            normalized.__raw =
                item.data();

            items.push(normalized);
        });

        return items;
    };

    /**
     * Mencari satu komentar.
     *
     * @param {string} id
     * @returns {Promise<import('firebase/firestore').DocumentSnapshot>}
     */
    const getFirebaseComment = async (id) => {
        await waitForAuth();

        return getDoc(
            doc(
                db,
                'comments',
                id
            )
        );
    };

    /**
     * Memastikan komentar memang milik user Firebase
     * yang sedang aktif.
     *
     * @param {string} id
     * @returns {Promise<import('firebase/firestore').DocumentSnapshot>}
     */
    const getOwnComment = async (id) => {
        const user =
            await waitForAuth();

        const snapshot =
            await getFirebaseComment(id);

        if (!snapshot.exists()) {
            throw new Error(
                'Komentar tidak ditemukan.'
            );
        }

        const data =
            snapshot.data();

        if (
            data.ownerUid !==
            user.uid
        ) {
            throw new Error(
                'Kamu hanya bisa mengubah komentar milikmu sendiri.'
            );
        }

        if (
            data.invitationId !==
            INVITATION_ID
        ) {
            throw new Error(
                'Komentar bukan milik undangan ini.'
            );
        }

        return snapshot;
    };

    /**
     * Mengubah data Firestore menjadi format response
     * yang bisa dipakai card.js.
     *
     * @param {object} item
     * @returns {object}
     */
    const cleanComment = (item) => {
        const copy = {
            ...item,
        };

        delete copy.__raw;

        return copy;
    };

    /**
     * Menelusuri semua komentar untuk menentukan reply
     * mana yang harus disembunyikan.
     *
     * @param {object[]} items
     * @param {ReturnType<typeof dto.commentShowMore>[]} hide
     * @returns {ReturnType<typeof dto.commentShowMore>[]}
     */
    const traverse = (
        items,
        hide = []
    ) => {
        const dataShow =
            showHide.get('show');

        const buildHide = (lists) => {
            lists.forEach((item) => {
                if (
                    hide.find(
                        (i) =>
                            i.uuid === item.uuid
                    )
                ) {
                    buildHide(
                        item.comments
                    );

                    return;
                }

                hide.push({
                    uuid: item.uuid,
                    show: false,
                });

                buildHide(
                    item.comments
                );
            });
        };

        const setVisible = (lists) => {
            lists.forEach((item) => {
                if (
                    !dataShow.includes(
                        item.uuid
                    )
                ) {
                    setVisible(
                        item.comments
                    );

                    return;
                }

                item.comments.forEach((c) => {
                    const i =
                        hide.findIndex(
                            (h) =>
                                h.uuid === c.uuid
                        );

                    if (i !== -1) {
                        hide[i].show =
                            true;
                    }
                });

                setVisible(
                    item.comments
                );
            });
        };

        buildHide(items);
        setVisible(items);

        return hide;
    };

    /**
     * Menampilkan komentar dari Firebase.
     *
     * @returns {Promise<object>}
     */
    const show = async () => {
        lastRender.forEach((uuid) => {
            like.removeListener(uuid);
        });

        if (
            comments.getAttribute(
                'data-loading'
            ) === 'false'
        ) {
            comments.setAttribute(
                'data-loading',
                'true'
            );

            comments.innerHTML =
                card
                    .renderLoading()
                    .repeat(
                        pagination.getPer()
                    );
        }

        try {
            const allItems =
                await loadAllComments();

            const tree =
                buildTree(allItems);

            const total =
                tree.length;

            const per =
                pagination.getPer();

            const next =
                Number(
                    pagination.getNext()
                ) || 0;

            const pageItems =
                tree.slice(
                    next,
                    next + per
                );

            comments.setAttribute(
                'data-loading',
                'false'
            );

            for (
                const uuid of lastRender
            ) {
                await gif.remove(uuid);
            }

            if (
                pageItems.length === 0
            ) {
                comments.innerHTML =
                    onNullComment();

                pagination.setTotal(
                    total
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
                        count: total,
                        lists: [],
                    },
                };
            }

            const flatten = (items) => {
                return items.flatMap(
                    (item) => [
                        item.uuid,
                        ...flatten(
                            item.comments
                        ),
                    ]
                );
            };

            lastRender.splice(
                0,
                lastRender.length,
                ...flatten(pageItems)
            );

            showHide.set(
                'hidden',
                traverse(
                    pageItems,
                    showHide.get(
                        'hidden'
                    )
                )
            );

            const cleanItems =
                pageItems.map(
                    cleanComment
                );

            let data =
                await card.renderContentMany(
                    cleanItems
                );

            if (
                pageItems.length < per ||
                next + per >= total
            ) {
                data += onNullComment();
            }

            util.safeInnerHTML(
                comments,
                data
            );

            lastRender.forEach(
                (uuid) => {
                    like.addListener(uuid);
                }
            );

            pagination.setTotal(
                total
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
                    count: total,
                    lists: cleanItems,
                },
            };

        } catch (error) {
            console.error(
                '[Firebase] Gagal mengambil komentar:',
                error
            );

            comments.setAttribute(
                'data-loading',
                'false'
            );

            comments.innerHTML = `
                <div class="alert alert-danger rounded-4 shadow">
                    Gagal memuat komentar.
                    Silakan refresh halaman.
                </div>
            `;

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
    };

    /**
     * Menghapus komentar milik user aktif.
     *
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const remove = async (button) => {
        if (
            !util.ask(
                'Are you sure?'
            )
        ) {
            return;
        }

        const id =
            button.getAttribute(
                'data-uuid'
            );

        changeActionButton(
            id,
            true
        );

        const btn =
            util.disableButton(
                button
            );

        const likes =
            like.getButtonLike(id);

        if (likes) {
            likes.disabled = true;
        }

        try {
            const snapshot =
                await getOwnComment(id);

            await deleteDoc(
                doc(
                    db,
                    'comments',
                    snapshot.id
                )
            );

            owns.unset(id);

            document
                .querySelectorAll(
                    'a[onclick="undangan.comment.showOrHide(this)"]'
                )
                .forEach((n) => {
                    const raw =
                        n.getAttribute(
                            'data-uuids'
                        );

                    if (!raw) {
                        return;
                    }

                    const oldUuids =
                        raw.split(',');

                    if (
                        oldUuids.includes(id)
                    ) {
                        const uuids =
                            oldUuids
                                .filter(
                                    (i) =>
                                        i !== id
                                )
                                .join(',');

                        if (
                            uuids.length === 0
                        ) {
                            n.remove();
                        } else {
                            n.setAttribute(
                                'data-uuids',
                                uuids
                            );
                        }
                    }
                });

            const element =
                document.getElementById(id);

            if (element) {
                element.remove();
            }

            const replies =
                document.querySelectorAll(
                    `[data-uuid="${id}"]`
                );

            replies.forEach(
                (element) => {
                    element.remove();
                }
            );

            if (
                comments.children.length === 0
            ) {
                comments.innerHTML =
                    onNullComment();
            }

        } catch (error) {
            console.error(
                '[Firebase] Gagal menghapus komentar:',
                error
            );

            util.notify(
                'Komentar tidak bisa dihapus.'
            ).warning();

            if (likes) {
                likes.disabled = false;
            }

            changeActionButton(
                id,
                false
            );

            return;
        }

        btn.restore();

        if (likes) {
            likes.disabled = false;
        }

        changeActionButton(
            id,
            false
        );
    };

    /**
     * Mengupdate komentar milik user aktif.
     *
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const update = async (button) => {
        const id =
            button.getAttribute(
                'data-uuid'
            );

        let isPresent = false;

        const presence =
            document.getElementById(
                `form-inner-presence-${id}`
            );

        if (presence) {
            presence.disabled = true;

            isPresent =
                presence.value === '1';
        }

        const badge =
            document.getElementById(
                `badge-${id}`
            );

        const isChecklist =
            !!badge &&
            badge.getAttribute(
                'data-is-presence'
            ) === 'true';

        const gifIsOpen =
            gif.isOpen(id);

        const gifId =
            gif.getResultId(id);

        const gifCancel =
            gif.buttonCancel(id);

        if (
            gifIsOpen &&
            gifId
        ) {
            gifCancel.hide();
        }

        const form =
            document.getElementById(
                `form-inner-${id}`
            );

        if (!form) {
            return;
        }

        if (
            id &&
            !gifIsOpen &&
            util.base64Encode(
                form.value
            ) === form.getAttribute(
                'data-original'
            ) &&
            isChecklist === isPresent
        ) {
            removeInnerForm(id);
            return;
        }

        if (
            !gifIsOpen &&
            form.value?.trim().length === 0
        ) {
            util.notify(
                'Comments cannot be empty.'
            ).warning();

            return;
        }

        form.disabled = true;

        const cancel =
            document.querySelector(
                `[onclick="undangan.comment.cancel(this, '${id}')"]`
            );

        if (cancel) {
            cancel.disabled = true;
        }

        const btn =
            util.disableButton(
                button
            );

        try {
            const snapshot =
                await getOwnComment(id);

            const updateData = {
                updatedAt:
                    serverTimestamp(),
            };

            if (gifIsOpen) {
                updateData.comment = null;
            } else {
                updateData.comment =
                    form.value;
            }

            if (presence) {
                updateData.presence =
                    isPresent;
            }

            if (
                gifIsOpen &&
                gifId
            ) {
                updateData.gifId =
                    gifId;
            } else if (!gifIsOpen) {
                updateData.gifId =
                    null;

                updateData.gifUrl =
                    null;
            }

            await updateDoc(
                doc(
                    db,
                    'comments',
                    snapshot.id
                ),
                updateData
            );

        } catch (error) {
            console.error(
                '[Firebase] Gagal update komentar:',
                error
            );

            util.notify(
                'Komentar tidak bisa diubah.'
            ).warning();

            form.disabled = false;

            if (cancel) {
                cancel.disabled = false;
            }

            if (presence) {
                presence.disabled = false;
            }

            btn.restore();

            if (
                gifIsOpen &&
                gifId
            ) {
                gifCancel.show();
            }

            return;
        }

        form.disabled = false;

        if (cancel) {
            cancel.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        btn.restore();

        if (
            gifIsOpen &&
            gifId
        ) {
            const image =
                document
                    .getElementById(
                        `gif-result-${id}`
                    )
                    ?.querySelector(
                        'img'
                    );

            if (image) {
                const gifImage =
                    document.getElementById(
                        `img-gif-${id}`
                    );

                if (gifImage) {
                    gifImage.src =
                        image.src;
                }
            }

            gifCancel.click();
        }

        removeInnerForm(id);

        if (!gifIsOpen) {
            const showButton =
                document.querySelector(
                    `[onclick="undangan.comment.showMore(this, '${id}')"]`
                );

            const content =
                document.getElementById(
                    `content-${id}`
                );

            if (content) {
                content.setAttribute(
                    'data-comment',
                    util.base64Encode(
                        form.value
                    )
                );

                const original =
                    util.convertMarkdownToHTML(
                        util.escapeHtml(
                            form.value
                        )
                    );

                if (
                    form.value.length >
                    card.maxCommentLength
                ) {
                    util.safeInnerHTML(
                        content,
                        showButton?.getAttribute(
                            'data-show'
                        ) === 'false'
                            ? original.slice(
                                0,
                                card.maxCommentLength
                            ) + '...'
                            : original
                    );

                    showButton?.classList.replace(
                        'd-none',
                        'd-block'
                    );
                } else {
                    util.safeInnerHTML(
                        content,
                        original
                    );

                    showButton?.classList.replace(
                        'd-block',
                        'd-none'
                    );
                }
            }
        }

        if (presence) {
            document.getElementById(
                'form-presence'
            ).value =
                isPresent
                    ? '1'
                    : '2';

            storage(
                'information'
            ).set(
                'presence',
                isPresent
            );
        }

        if (
            !presence ||
            !badge
        ) {
            return;
        }

        badge.classList.toggle(
            'fa-circle-xmark',
            !isPresent
        );

        badge.classList.toggle(
            'text-danger',
            !isPresent
        );

        badge.classList.toggle(
            'fa-circle-check',
            isPresent
        );

        badge.classList.toggle(
            'text-success',
            isPresent
        );
    };

    /**
     * Mengirim komentar baru atau reply.
     *
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const send = async (button) => {
        const id =
            button.getAttribute(
                'data-uuid'
            );

        const name =
            document.getElementById(
                'form-name'
            );

        const nameValue =
            name?.value?.trim() ?? '';

        if (
            nameValue.length === 0
        ) {
            util.notify(
                'Name cannot be empty.'
            ).warning();

            if (
                id &&
                name
            ) {
                name.scrollIntoView({
                    block: 'center',
                });
            }

            return;
        }

        const presence =
            document.getElementById(
                'form-presence'
            );

        if (
            !id &&
            presence &&
            presence.value === '0'
        ) {
            util.notify(
                'Please select your attendance status.'
            ).warning();

            return;
        }

        const gifIsOpen =
            gif.isOpen(
                id
                    ? id
                    : gif.default
            );

        const gifId =
            gif.getResultId(
                id
                    ? id
                    : gif.default
            );

        const gifCancel =
            gif.buttonCancel(id);

        if (
            gifIsOpen &&
            !gifId
        ) {
            util.notify(
                'Gif cannot be empty.'
            ).warning();

            return;
        }

        if (
            gifIsOpen &&
            gifId
        ) {
            gifCancel.hide();
        }

        const form =
            document.getElementById(
                `form-${
                    id
                        ? `inner-${id}`
                        : 'comment'
                }`
            );

        if (
            !gifIsOpen &&
            (
                !form ||
                form.value?.trim().length === 0
            )
        ) {
            util.notify(
                'Comments cannot be empty.'
            ).warning();

            return;
        }

        if (
            !id &&
            name
        ) {
            name.disabled = true;
        }

        if (
            !id &&
            presence &&
            presence.value !== '0'
        ) {
            presence.disabled = true;
        }

        if (form) {
            form.disabled = true;
        }

        const cancel =
            document.querySelector(
                `[onclick="undangan.comment.cancel(this, '${id}')"]`
            );

        if (cancel) {
            cancel.disabled = true;
        }

        const btn =
            util.disableButton(
                button
            );

        const isPresence =
            presence
                ? presence.value === '1'
                : true;

        const info =
            storage(
                'information'
            );

        info.set(
            'name',
            nameValue
        );

        if (!id) {
            info.set(
                'presence',
                isPresence
            );
        }

        try {
            const user =
                await waitForAuth();

            const payload = {
                invitationId:
                    INVITATION_ID,

                ownerUid:
                    user.uid,

                name:
                    nameValue,

                presence:
                    isPresence,

                comment:
                    gifIsOpen
                        ? null
                        : form.value,

                gifId:
                    gifIsOpen
                        ? gifId
                        : null,

                gifUrl:
                    null,

                parentId:
                    id || null,

                likeCount:
                    0,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp(),
            };

            const reference =
                await addDoc(
                    collection(
                        db,
                        'comments'
                    ),
                    payload
                );

            owns.set(
                reference.id,
                reference.id
            );

            if (form) {
                form.value = '';
            }

            if (
                gifIsOpen &&
                gifId
            ) {
                gifCancel.click();
            }

            if (!id) {
                if (
                    pagination.reset()
                ) {
                    await show();

                    comments.scrollIntoView();

                    return;
                }

                pagination.setTotal(
                    pagination.geTotal() + 1
                );

                await show();

                comments.scrollIntoView();

            } else {
                showHide.set(
                    'hidden',
                    showHide
                        .get('hidden')
                        .concat([
                            {
                                uuid:
                                    reference.id,
                                show: true,
                            },
                        ])
                );

                showHide.set(
                    'show',
                    showHide
                        .get('show')
                        .concat([id])
                );

                removeInnerForm(id);

                await show();

                const parentButton =
                    document.getElementById(
                        `button-${id}`
                    );

                if (parentButton) {
                    const anchorTag =
                        parentButton.querySelector(
                            'a'
                        );

                    if (
                        anchorTag &&
                        anchorTag.getAttribute(
                            'data-show'
                        ) === 'false'
                    ) {
                        showOrHide(
                            anchorTag
                        );
                    }
                }
            }

        } catch (error) {
            console.error(
                '[Firebase] Gagal menyimpan komentar:',
                error
            );

            util.notify(
                'Komentar gagal dikirim. Silakan coba lagi.'
            ).warning();

            if (form) {
                form.disabled = false;
            }

            if (name) {
                name.disabled = false;
            }

            if (presence) {
                presence.disabled = false;
            }

            if (cancel) {
                cancel.disabled = false;
            }

            if (
                gifIsOpen &&
                gifId
            ) {
                gifCancel.show();
            }

            btn.restore();

            return;
        }

        if (name) {
            name.disabled = false;
        }

        if (form) {
            form.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        if (cancel) {
            cancel.disabled = false;
        }

        if (
            gifIsOpen &&
            gifId
        ) {
            gifCancel.show();
        }

        btn.restore();
    };

    /**
     * Membatalkan form reply/edit.
     *
     * @param {HTMLButtonElement} button
     * @param {string} id
     * @returns {Promise<void>}
     */
    const cancel = async (
        button,
        id
    ) => {
        const presence =
            document.getElementById(
                `form-inner-presence-${id}`
            );

        const isPresent =
            presence
                ? presence.value === '1'
                : false;

        const badge =
            document.getElementById(
                `badge-${id}`
            );

        const isChecklist =
            badge &&
            owns.has(id) &&
            presence
                ? badge.getAttribute(
                    'data-is-presence'
                ) === 'true'
                : false;

        const btn =
            util.disableButton(
                button
            );

        if (
            gif.isOpen(id) &&
            (
                (
                    !gif.getResultId(id) &&
                    isChecklist === isPresent
                ) ||
                util.ask(
                    'Are you sure?'
                )
            )
        ) {
            await gif.remove(id);

            removeInnerForm(id);

            return;
        }

        const form =
            document.getElementById(
                `form-inner-${id}`
            );

        if (!form) {
            btn.restore();
            return;
        }

        if (
            form.value.length === 0 ||
            (
                util.base64Encode(
                    form.value
                ) === form.getAttribute(
                    'data-original'
                ) &&
                isChecklist === isPresent
            ) ||
            util.ask(
                'Are you sure?'
            )
        ) {
            removeInnerForm(id);
            return;
        }

        btn.restore();
    };

    /**
     * Membuka form reply.
     *
     * @param {string} uuid
     * @returns {void}
     */
    const reply = (uuid) => {
        changeActionButton(
            uuid,
            true
        );

        gif.remove(uuid).then(() => {
            gif.onOpen(
                uuid,
                () =>
                    gif.removeGifSearch(
                        uuid
                    )
            );

            const button =
                document.getElementById(
                    `button-${uuid}`
                );

            if (!button) {
                changeActionButton(
                    uuid,
                    false
                );

                return;
            }

            button.insertAdjacentElement(
                'afterend',
                card.renderReply(uuid)
            );
        });
    };

    /**
     * Membuka form edit.
     *
     * @param {HTMLButtonElement} button
     * @param {boolean} is_parent
     * @returns {Promise<void>}
     */
    const edit = async (
        button,
        is_parent
    ) => {
        const id =
            button.getAttribute(
                'data-uuid'
            );

        changeActionButton(
            id,
            true
        );

        try {
            await getOwnComment(id);

        } catch (error) {
            console.error(
                '[Firebase] Edit ditolak:',
                error
            );

            util.notify(
                'Kamu hanya bisa mengedit komentar milikmu sendiri.'
            ).warning();

            changeActionButton(
                id,
                false
            );

            return;
        }

        const badge =
            document.getElementById(
                `badge-${id}`
            );

        const isChecklist =
            !!badge &&
            badge.getAttribute(
                'data-is-presence'
            ) === 'true';

        const gifImage =
            document.getElementById(
                `img-gif-${id}`
            );

        if (gifImage) {
            await gif.remove(id);
        }

        const isParent =
            !!is_parent;

        const buttonElement =
            document.getElementById(
                `button-${id}`
            );

        if (!buttonElement) {
            changeActionButton(
                id,
                false
            );

            return;
        }

        buttonElement.insertAdjacentElement(
            'afterend',
            card.renderEdit(
                id,
                isChecklist,
                isParent,
                !!gifImage
            )
        );

        if (gifImage) {
            gif.onOpen(
                id,
                () => {
                    gif.removeGifSearch(
                        id
                    );

                    gif.removeButtonBack(
                        id
                    );
                }
            );

            await gif.open(id);

            return;
        }

        const formInner =
            document.getElementById(
                `form-inner-${id}`
            );

        const content =
            document.getElementById(
                `content-${id}`
            );

        if (
            !formInner ||
            !content
        ) {
            return;
        }

        const encoded =
            content.getAttribute(
                'data-comment'
            );

        const original =
            encoded
                ? util.base64Decode(
                    encoded
                )
                : '';

        formInner.value =
            original;

        formInner.setAttribute(
            'data-original',
            util.base64Encode(
                original
            )
        );
    };

    /**
     * Inisialisasi komentar.
     *
     * @returns {void}
     */
    const init = () => {
        gif.init();
        like.init();
        card.init();
        pagination.init();

        comments =
            document.getElementById(
                'comments'
            );

        comments.addEventListener(
            'undangan.comment.show',
            show
        );

        owns =
            storage('owns');

        showHide =
            storage('comment');

        if (
            !showHide.has('hidden')
        ) {
            showHide.set(
                'hidden',
                []
            );
        }

        if (
            !showHide.has('show')
        ) {
            showHide.set(
                'show',
                []
            );
        }
    };

    return {
        gif,
        like,
        pagination,
        init,
        send,
        edit,
        reply,
        remove,
        update,
        cancel,
        show,
        showMore,
        showOrHide,
    };
})();
