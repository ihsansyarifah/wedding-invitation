import { util } from '../../common/util.js';
import { storage } from '../../common/storage.js';

export const card = (() => {

    const maxCommentLength = 300;

    let owns = null;

    /**
     * Loading card.
     */
    const renderLoading = () => {
        return `
        <div class="bg-theme-auto shadow p-3 mx-0 mt-0 mb-3 rounded-4">
            <div class="placeholder-glow">
                <span class="placeholder col-5 rounded-3"></span>
                <span class="placeholder col-3 rounded-3 float-end"></span>
            </div>
            <hr class="my-1">
            <p class="placeholder-glow m-0">
                <span class="placeholder col-10 rounded-3"></span>
                <span class="placeholder col-7 rounded-3"></span>
            </p>
        </div>`;
    };

    /**
     * Tombol delete.
     *
     * Hanya muncul kalau komentar dibuat
     * dari browser yang sama.
     */
    const renderAction = (c) => {

        if (!owns || !owns.has(c.uuid)) {
            return '<div></div>';
        }

        return `
        <div
            class="d-flex justify-content-start align-items-center"
            data-button-action="${util.escapeHtml(c.uuid)}"
        >
            <button
                style="font-size: 0.8rem;"
                onclick="undangan.comment.remove(this)"
                data-uuid="${util.escapeHtml(c.uuid)}"
                class="btn btn-sm btn-outline-auto rounded-4 py-0 me-1 shadow-sm"
                data-offline-disabled="false"
            >
                Hapus
            </button>
        </div>`;
    };

    /**
     * Judul komentar.
     */
    const renderTitle = (c) => {

        const name = util.escapeHtml(
            c.name ?? 'Tamu'
        );

        if (c.presence) {
            return `
            <strong class="me-1">
                ${name}
            </strong>
            <i
                id="badge-${util.escapeHtml(c.uuid)}"
                class="fa-solid fa-circle-check text-success"
                aria-label="Hadir"
            ></i>`;
        }

        return `
        <strong class="me-1">
            ${name}
        </strong>
        <i
            id="badge-${util.escapeHtml(c.uuid)}"
            class="fa-solid fa-circle-xmark text-danger"
            aria-label="Berhalangan"
        ></i>`;
    };

    /**
     * Isi komentar.
     */
    const renderBody = (c) => {

        const comment = String(
            c.comment ?? ''
        );

        const encoded =
            util.base64Encode(comment);

        const isLong =
            comment.length > maxCommentLength;

        const visibleText =
            isLong
                ? `${comment.slice(0, maxCommentLength)}...`
                : comment;

        const html =
            util.convertMarkdownToHTML(
                util.escapeHtml(visibleText)
            );

        return `
        <div class="d-flex justify-content-between align-items-center">
            <p
                class="text-theme-auto text-truncate m-0 p-0"
                style="font-size: 0.95rem;"
            >
                ${renderTitle(c)}
            </p>

            <small
                class="text-theme-auto m-0 p-0"
                style="font-size: 0.75rem;"
            >
                ${util.escapeHtml(
                    c.created_at ?? ''
                )}
            </small>
        </div>

        <hr class="my-1">

        <p
            dir="auto"
            class="text-theme-auto my-1 mx-0 p-0"
            style="
                white-space: pre-wrap !important;
                font-size: 0.95rem;
            "
            data-comment="${encoded}"
            id="content-${util.escapeHtml(c.uuid)}"
        >
            ${html}
        </p>

        ${
            isLong
                ? `
                <p
                    class="d-block mb-2 mt-0 mx-0 p-0"
                >
                    <a
                        class="text-theme-auto"
                        role="button"
                        style="font-size: 0.85rem;"
                        data-show="false"
                        onclick="undangan.comment.showMore(this, '${util.escapeHtml(c.uuid)}')"
                    >
                        Selengkapnya
                    </a>
                </p>
                `
                : ''
        }`;
    };

    /**
     * Satu komentar.
     */
    const renderContent = (c) => {

        const body =
            renderBody(c);

        return `
        <div
            class="bg-theme-auto shadow p-3 mx-0 mt-0 mb-3 rounded-4"
            id="${util.escapeHtml(c.uuid)}"
            style="overflow-wrap: break-word !important;"
        >
            <div
                id="body-content-${util.escapeHtml(c.uuid)}"
                tabindex="0"
            >
                ${body}
            </div>

            ${renderAction(c)}
        </div>`;
    };

    /**
     * Banyak komentar.
     */
    const renderContentMany = (comments) => {

        return Promise.resolve(
            comments
                .map((comment) =>
                    renderContent(comment)
                )
                .join('')
        );
    };

    /**
     * Satu komentar.
     */
    const renderContentSingle = (comment) => {
        return Promise.resolve(
            renderContent(comment)
        );
    };

    /**
     * Inisialisasi.
     */
    const init = () => {
        owns = storage('owns');
    };

    return {
        init,
        renderLoading,
        renderContentMany,
        renderContentSingle,
        maxCommentLength,
    };
})();
