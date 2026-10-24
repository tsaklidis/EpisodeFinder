const searchInput = document.getElementById("searchInput");
const resultsDiv = document.getElementById("results");
const statsDiv = document.getElementById("stats");
const paginationDiv = document.getElementById("pagination");

const inputHint = document.getElementById("inputHint");
const librarySection = document.getElementById("library");
const seasonsDiv = document.getElementById("seasons");
const episodeCaption = document.getElementById("episodeCaption");

const GREEK_RE = /^[Ͱ-Ͽἀ-῿\s]*$/;
const NON_GREEK_RE = /[^Ͱ-Ͽἀ-῿\s]/g;

let debounceTimer = null;
let hintTimer = null;
let currentPage = 1;
let currentQuery = "";

function showGreekOnlyWarning() {
    inputHint.textContent =
        "Μόνο ελληνικά. Γράψτε «Μαρούσι», όχι «marousi».";
    inputHint.classList.add("visible");
    searchInput.classList.add("input-reject");
    clearTimeout(hintTimer);
    // Long enough to actually read, and it also clears as soon as the next
    // keystroke is valid Greek.
    hintTimer = setTimeout(hideGreekOnlyWarning, 6000);
}

function hideGreekOnlyWarning() {
    clearTimeout(hintTimer);
    inputHint.classList.remove("visible");
    searchInput.classList.remove("input-reject");
}

searchInput.addEventListener("input", () => {
    const raw = searchInput.value;
    if (!GREEK_RE.test(raw)) {
        searchInput.value = raw.replace(NON_GREEK_RE, "");
        showGreekOnlyWarning();
    } else if (raw.length > 0) {
        hideGreekOnlyWarning();
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentPage = 1;
        currentQuery = searchInput.value.trim();
        doSearch();
    }, 300);
});

resultsDiv.addEventListener("click", (e) => {
    const card = e.target.closest(".result-card");
    if (!card) return;
    const id = parseInt(card.dataset.id, 10);
    if (id) toggleContext(card, id);
});

paginationDiv.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (btn && !btn.disabled) {
        goPage(parseInt(btn.dataset.page, 10));
    }
});

async function doSearch() {
    librarySection.hidden = !!currentQuery || !librarySection.dataset.ready;
    if (!currentQuery) {
        resultsDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">📺</div><div>Πληκτρολογήστε μια φράση για αναζήτηση</div><div class="empty-hint">π.χ. «αποχετευτικό», «δεσποινίς Βλαχάκη», «Μαρούσι»</div></div>';
        statsDiv.textContent = "";
        paginationDiv.innerHTML = "";
        return;
    }

    resultsDiv.innerHTML = '<div class="loading">Αναζήτηση...</div>';
    statsDiv.textContent = "";
    paginationDiv.innerHTML = "";

    try {
        const params = new URLSearchParams({
            q: currentQuery,
            page: currentPage,
        });
        const resp = await fetch("/api/search?" + params);
        const data = await resp.json();

        if (resp.status === 429) {
            resultsDiv.innerHTML = '<div class="empty-state">Πολλά αιτήματα — περιμένετε λίγο</div>';
            return;
        }
        if (!resp.ok) {
            resultsDiv.innerHTML = '<div class="empty-state">Σφάλμα αναζήτησης</div>';
            return;
        }

        renderResults(data);
    } catch {
        resultsDiv.innerHTML = '<div class="empty-state">Σφάλμα σύνδεσης</div>';
    }
}

function renderResults(data) {
    if (data.total === 0) {
        resultsDiv.innerHTML = '<div class="empty-state">Δεν βρέθηκαν αποτελέσματα</div>';
        statsDiv.textContent = "";
        paginationDiv.innerHTML = "";
        return;
    }

    const totalPages = Math.ceil(data.total / data.per_page);
    statsDiv.textContent = data.total + " αποτελέσματα — σελίδα " + data.page + " / " + totalPages;

    resultsDiv.innerHTML = data.results
        .map((r) => {
            const speakerHtml = r.speaker
                ? '<div class="speaker-tag">' + r.speaker + "</div>"
                : "";
            return '<div class="result-card" data-id="' + r.id + '">'
                + '<div class="card-side"><span class="ep-number">' + r.episode_number + "</span></div>"
                + '<div class="card-body">'
                + '<div class="card-meta"><span class="episode-title">' + r.title + "</span>"
                + '<span class="timestamp">' + r.timestamp + "</span></div>"
                + '<div class="card-divider"></div>'
                + speakerHtml
                + '<div class="result-text">' + r.text + "</div>"
                + '<div class="context-panel"></div>'
                + "</div></div>";
        })
        .join("");

    let pagHtml = "";
    if (totalPages > 1) {
        pagHtml += '<button data-page="' + (data.page - 1) + '"' + (data.page <= 1 ? " disabled" : "") + ">← Προηγούμενη</button>";
        pagHtml += '<button data-page="' + (data.page + 1) + '"' + (data.page >= totalPages ? " disabled" : "") + ">Επόμενη →</button>";
    }
    paginationDiv.innerHTML = pagHtml;
}

async function toggleContext(card, subtitleId) {
    var panel = card.querySelector(".context-panel");

    if (card.classList.contains("expanded")) {
        card.classList.remove("expanded");
        panel.innerHTML = "";
        return;
    }

    panel.innerHTML = '<div class="context-loading">...</div>';
    card.classList.add("expanded");

    try {
        var resp = await fetch("/api/context/" + subtitleId);
        if (!resp.ok) {
            panel.innerHTML = '<div class="context-loading">Σφάλμα</div>';
            return;
        }
        var data = await resp.json();

        panel.innerHTML = data.lines
            .map(function (line) {
                var cls = line.is_match ? "context-line context-match" : "context-line";
                var speaker = line.speaker
                    ? '<span class="context-speaker">' + line.speaker + "</span> "
                    : "";
                return '<div class="' + cls + '">'
                    + '<span class="context-ts">' + line.timestamp + "</span>"
                    + '<span class="context-text">' + speaker + line.text + "</span>"
                    + "</div>";
            })
            .join("");
    } catch {
        panel.innerHTML = '<div class="context-loading">Σφάλμα</div>';
    }
}

function goPage(page) {
    currentPage = page;
    doSearch();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Library: what is indexed ───────────────────────────────────────────────

const CAPTION_DEFAULT = episodeCaption.textContent;

seasonsDiv.addEventListener("click", (e) => {
    const chip = e.target.closest(".ep-chip");
    if (!chip) return;
    seasonsDiv.querySelectorAll(".ep-chip.selected").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    episodeCaption.innerHTML = chip.dataset.caption;
});

async function loadLibrary() {
    try {
        const resp = await fetch("/api/stats");
        if (!resp.ok) return;
        renderLibrary(await resp.json());
    } catch {
        // Stats are decoration; the search still works without them.
    }
}

function renderLibrary(data) {
    const byNumber = new Map(data.episodes.map((ep) => [ep.episode_number, ep]));
    const fmt = new Intl.NumberFormat("el-GR");

    document.getElementById("statEpisodes").innerHTML =
        data.episodes.length + '<span class="plate-of"> / ' + data.total_episodes + "</span>";
    document.getElementById("statLines").textContent = fmt.format(data.subtitle_count);
    document.getElementById("statHours").textContent = fmt.format(Math.round(data.dialogue_minutes / 60));

    seasonsDiv.innerHTML = data.seasons
        .map((season) => {
            let chips = "";
            let available = 0;
            for (let n = season.first; n <= season.last; n++) {
                const ep = byNumber.get(n);
                if (ep) available++;
                // Titles arrive HTML-escaped from the API, so they are safe
                // to drop into markup and attributes as-is.
                const caption = ep
                    ? '<span class="caption-num">' + n + "</span>" + ep.title
                        + '<span class="caption-meta">' + fmt.format(ep.lines) + " ατάκες</span>"
                    : '<span class="caption-num">' + n + "</span>Δεν έχει προστεθεί ακόμα";
                chips += '<button type="button" class="ep-chip' + (ep ? " on" : "") + '"'
                    + ' data-caption="' + caption.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"'
                    + ' aria-label="Επεισόδιο ' + n + (ep ? ": " + ep.title : ", μη διαθέσιμο") + '">'
                    + n + "</button>";
            }
            return '<div class="season">'
                + '<div class="season-head"><span class="season-label">' + season.label + "</span>"
                + '<span class="season-years">' + season.years + "</span>"
                + '<span class="season-count">' + available + " / " + (season.last - season.first + 1) + "</span></div>"
                + '<div class="ep-grid">' + chips + "</div>"
                + "</div>";
        })
        .join("");

    episodeCaption.textContent = CAPTION_DEFAULT;
    librarySection.dataset.ready = "1";
    librarySection.hidden = !!currentQuery;
}

loadLibrary();
