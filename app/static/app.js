const searchInput = document.getElementById("searchInput");
const resultsDiv = document.getElementById("results");
const statsDiv = document.getElementById("stats");
const paginationDiv = document.getElementById("pagination");

const inputHint = document.getElementById("inputHint");

const GREEK_RE = /^[Ͱ-Ͽἀ-῿\s]*$/;
const NON_GREEK_RE = /[^Ͱ-Ͽἀ-῿\s]/g;

let debounceTimer = null;
let hintTimer = null;
let currentPage = 1;
let currentQuery = "";

searchInput.addEventListener("input", () => {
    var raw = searchInput.value;
    if (!GREEK_RE.test(raw)) {
        searchInput.value = raw.replace(NON_GREEK_RE, "");
        searchInput.classList.add("input-reject");
        inputHint.textContent = "Επιτρέπονται μόνο ελληνικοί χαρακτήρες";
        inputHint.classList.add("visible");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () {
            inputHint.classList.remove("visible");
            searchInput.classList.remove("input-reject");
        }, 2000);
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
