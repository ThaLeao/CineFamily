"use strict";

/* =========================================================
   CINEFAMILY — SCRIPT.JS
   PARTE 1/4
   Compatível com o index.html e worker.js atuais
   ========================================================= */

const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";

const STORAGE_KEYS = {
    FAVORITOS: "cinefamily_favoritos",
    HISTORICO: "cinefamily_historico",
    PERFIL: "cinefamily_perfil"
};

const CONFIG = {
    HOME_LIMIT: 20,
    SEARCH_LIMIT: 20,
    CATEGORY_LIMIT: 20,
    HISTORY_LIMIT: 30,
    FAVORITES_LIMIT: 30,
    HERO_INTERVAL: 7000
};

const state = {
    homeLoaded: false,
    loadingHome: false,
    searchLoading: false,
    currentSearch: "",
    currentDetails: null,
    currentHero: 0,
    heroItems: [],
    heroTimer: null,
    categoryPage: 1,
    categoryTotalPages: 1,
    currentCategory: null,
    selectedAvatar: "😀"
};


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

function normalizeType(item) {
    if (!item) {
        return "movie";
    }

    if (item.type === "tv") {
        return "tv";
    }

    if (item.media_type === "tv") {
        return "tv";
    }

    if (item.first_air_date && !item.release_date) {
        return "tv";
    }

    return "movie";
}

function getItemId(item) {
    if (!item) {
        return null;
    }

    const id = Number(item.id);

    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    return id;
}

function getItemTitle(item) {
    if (!item) {
        return "Sem título";
    }

    return (
        item.title ||
        item.name ||
        item.original_title ||
        item.original_name ||
        "Sem título"
    );
}

function getItemDate(item) {
    if (!item) {
        return "";
    }

    return (
        item.release_date ||
        item.first_air_date ||
        ""
    );
}

function getYear(item) {
    const date = getItemDate(item);

    if (!date || date.length < 4) {
        return "";
    }

    return date.substring(0, 4);
}

function getPoster(item) {
    if (!item) {
        return "";
    }

    return (
        item.poster_path ||
        item.poster ||
        ""
    );
}

function getBackdrop(item) {
    if (!item) {
        return "";
    }

    return (
        item.backdrop_path ||
        item.backdrop ||
        getPoster(item) ||
        ""
    );
}

function getRating(item) {
    if (!item) {
        return "0.0";
    }

    const rating = Number(
        item.vote_average ??
        item.rating ??
        0
    );

    if (!Number.isFinite(rating)) {
        return "0.0";
    }

    return rating.toFixed(1);
}

function isAdult(item) {
    return item && item.adult === true;
}

function isValidItem(item) {
    return Boolean(
        item &&
        getItemId(item) &&
        !isAdult(item) &&
        getItemTitle(item)
    );
}

function cleanItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    const seen = new Set();
    const result = [];

    for (const item of items) {
        if (!isValidItem(item)) {
            continue;
        }

        const type = normalizeType(item);
        const id = getItemId(item);
        const key = `${type}-${id}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        result.push({
            ...item,
            id,
            type,
            title: getItemTitle(item),
            poster_path: getPoster(item),
            backdrop_path: getBackdrop(item)
        });
    }

    return result;
}

function formatDate(date) {
    if (!date) {
        return "";
    }

    const parts = String(date).split("-");

    if (parts.length !== 3) {
        return String(date);
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatRuntime(minutes) {
    const value = Number(minutes);

    if (!Number.isFinite(value) || value <= 0) {
        return "";
    }

    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours > 0) {
        return `${hours}h ${mins}min`;
    }

    return `${mins}min`;
}

function getTypeLabel(type) {
    return type === "tv" ? "Série" : "Filme";
}

function getStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);

        if (!raw) {
            return fallback;
        }

        const parsed = JSON.parse(raw);

        return parsed ?? fallback;
    } catch (error) {
        console.warn("Erro ao ler localStorage:", error);
        return fallback;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn("Erro ao salvar localStorage:", error);
        return false;
    }
}

function getFavorites() {
    const favorites = getStorage(
        STORAGE_KEYS.FAVORITOS,
        []
    );

    return Array.isArray(favorites)
        ? cleanItems(favorites)
        : [];
}

function saveFavorites(items) {
    setStorage(
        STORAGE_KEYS.FAVORITOS,
        cleanItems(items)
    );
}

function getHistory() {
    const history = getStorage(
        STORAGE_KEYS.HISTORICO,
        []
    );

    return Array.isArray(history)
        ? cleanItems(history)
        : [];
}

function saveHistory(items) {
    setStorage(
        STORAGE_KEYS.HISTORICO,
        cleanItems(items).slice(
            0,
            CONFIG.HISTORY_LIMIT
        )
    );
}

function getProfile() {
    const profile = getStorage(
        STORAGE_KEYS.PERFIL,
        {}
    );

    if (!profile || typeof profile !== "object") {
        return {
            name: "Visitante",
            avatar: "😀"
        };
    }

    return {
        name: profile.name || "Visitante",
        avatar: profile.avatar || "😀"
    };
}

function saveProfile(profile) {
    setStorage(
        STORAGE_KEYS.PERFIL,
        {
            name: profile.name || "Visitante",
            avatar: profile.avatar || "😀"
        }
    );
}

function createKey(item) {
    if (!item) {
        return "";
    }

    return `${normalizeType(item)}-${getItemId(item)}`;
}

function isFavorite(item) {
    const key = createKey(item);

    if (!key) {
        return false;
    }

    return getFavorites().some(
        favorite => createKey(favorite) === key
    );
}


/* =========================================================
   API DO WORKER
   ========================================================= */

async function apiFetch(path, options = {}) {
    const cleanPath = String(path || "");

    const url = cleanPath.startsWith("http")
        ? cleanPath
        : `${TMDB_WORKER}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 20000);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store",
            signal: controller.signal,
            ...options
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(
                `Erro HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (data && data.ok === false) {
            throw new Error(
                data.error ||
                data.message ||
                "Erro retornado pelo servidor."
            );
        }

        return data;
    } catch (error) {
        clearTimeout(timeout);

        console.error(
            "Erro na API CineFamily:",
            error
        );

        throw error;
    }
}

async function apiHome() {
    return apiFetch("/api/home");
}

async function apiSearch(query, page = 1) {
    const params = new URLSearchParams();

    params.set("q", query);
    params.set("page", String(page));

    return apiFetch(
        `/api/search?${params.toString()}`
    );
}

async function apiMovies(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(
        ([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                query.set(key, String(value));
            }
        }
    );

    const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

    return apiFetch(
        `/api/movies${suffix}`
    );
}

async function apiSeries(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(
        ([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                query.set(key, String(value));
            }
        }
    );

    const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

    return apiFetch(
        `/api/series${suffix}`
    );
}

async function apiDiscoverMovie(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(
        ([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                query.set(key, String(value));
            }
        }
    );

    const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

    return apiFetch(
        `/api/discover/movie${suffix}`
    );
}

async function apiDiscoverTV(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(
        ([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                query.set(key, String(value));
            }
        }
    );

    const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

    return apiFetch(
        `/api/discover/tv${suffix}`
    );
}

async function apiDetails(type, id) {
    const safeType =
        type === "tv" ? "tv" : "movie";

    const safeId = Number(id);

    if (!Number.isFinite(safeId)) {
        throw new Error("ID inválido.");
    }

    return apiFetch(
        `/api/details/${safeType}/${safeId}`
    );
}

async function apiSeason(id, season) {
    const safeId = Number(id);
    const safeSeason = Number(season);

    if (
        !Number.isFinite(safeId) ||
        !Number.isFinite(safeSeason)
    ) {
        throw new Error(
            "Temporada inválida."
        );
    }

    return apiFetch(
        `/api/tv/${safeId}/season/${safeSeason}`
    );
}


/* =========================================================
   TOAST / LOADING
   ========================================================= */

function showToast(message, type = "normal") {
    const container =
        $("#toast-container");

    if (!container) {
        return;
    }

    const toast =
        document.createElement("div");

    toast.className =
        `toast toast-${type}`;

    toast.textContent =
        String(message || "");

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2800);
}

function setLoading(show) {
    const overlay =
        $("#loading-overlay");

    if (!overlay) {
        return;
    }

    if (show) {
        overlay.classList.add("active");
        overlay.setAttribute(
            "aria-hidden",
            "false"
        );
    } else {
        overlay.classList.remove("active");
        overlay.setAttribute(
            "aria-hidden",
            "true"
        );
    }
}


/* =========================================================
   CARDS
   ========================================================= */

function createCard(item) {
    if (!isValidItem(item)) {
        return null;
    }

    const type = normalizeType(item);
    const id = getItemId(item);
    const title = getItemTitle(item);
    const poster = getPoster(item);
    const rating = getRating(item);
    const year = getYear(item);
    const favorite = isFavorite(item);

    const card =
        document.createElement("article");

    card.className = "movie-card";

    card.dataset.id = String(id);
    card.dataset.type = type;
    card.dataset.title = title;

    card.tabIndex = 0;

    const posterHTML = poster
        ? `
            <img
                class="movie-card-poster"
                src="${escapeAttribute(poster)}"
                alt="${escapeAttribute(title)}"
                loading="lazy"
                onerror="this.style.display='none';"
            >
        `
        : `
            <div class="movie-card-no-poster">
                <span>🎬</span>
                <strong>${escapeHTML(title)}</strong>
            </div>
        `;

    card.innerHTML = `
        <div class="movie-card-image">
            ${posterHTML}

            <div class="movie-card-gradient"></div>

            <div class="movie-card-rating">
                ⭐ ${escapeHTML(rating)}
            </div>

            <button
                type="button"
                class="card-favorite-button ${favorite ? "is-favorite" : ""}"
                data-action="favorite"
                aria-label="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                title="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
            >
                ${favorite ? "★" : "☆"}
            </button>

            <div class="movie-card-overlay">
                <button
                    type="button"
                    class="card-play-button"
                    data-action="details"
                    aria-label="Abrir ${escapeAttribute(title)}"
                >
                    ▶
                </button>
            </div>
        </div>

        <div class="movie-card-info">
            <h3 class="movie-card-title">
                ${escapeHTML(title)}
            </h3>

            <div class="movie-card-meta">
                <span>${escapeHTML(type === "tv" ? "Série" : "Filme")}</span>
                ${
                    year
                        ? `<span>•</span><span>${escapeHTML(year)}</span>`
                        : ""
                }
            </div>
        </div>
    `;

    return card;
}

function renderRow(selector, items, emptyText = "") {
    const row = $(selector);

    if (!row) {
        return;
    }

    row.innerHTML = "";

    const clean = cleanItems(items);

    if (!clean.length) {
        if (emptyText) {
            row.innerHTML = `
                <div class="row-empty">
                    ${escapeHTML(emptyText)}
                </div>
            `;
        }

        return;
    }

    const fragment =
        document.createDocumentFragment();

    clean.forEach(item => {
        const card = createCard(item);

        if (card) {
            fragment.appendChild(card);
        }
    });

    row.appendChild(fragment);
}

function appendItemsToRow(selector, items) {
    const row = $(selector);

    if (!row) {
        return;
    }

    const clean = cleanItems(items);

    clean.forEach(item => {
        const card = createCard(item);

        if (card) {
            row.appendChild(card);
        }
    });
}

function showSection(selector, show = true) {
    const section = $(selector);

    if (!section) {
        return;
    }

    if (show) {
        section.hidden = false;
        section.style.display = "";
    } else {
        section.hidden = true;
    }
}


/* =========================================================
   NAVEGAÇÃO HORIZONTAL DOS CARDS
   ========================================================= */

function setupRowNavigation() {
    document.addEventListener(
        "click",
        event => {
            const button =
                event.target.closest(
                    "[data-row-scroll]"
                );

            if (!button) {
                return;
            }

            const targetSelector =
                button.dataset.rowScroll;

            if (!targetSelector) {
                return;
            }

            const row =
                $(targetSelector);

            if (!row) {
                return;
            }

            const direction =
                button.dataset.direction === "left"
                    ? -1
                    : 1;

            const amount =
                Math.max(
                    280,
                    row.clientWidth * 0.8
                );

            row.scrollBy({
                left: amount * direction,
                behavior: "smooth"
            });
        }
    );
}


/* =========================================================
   FAVORITOS
   ========================================================= */

function toggleFavorite(item) {
    if (!isValidItem(item)) {
        return false;
    }

    const favorites =
        getFavorites();

    const key =
        createKey(item);

    const index =
        favorites.findIndex(
            favorite =>
                createKey(favorite) === key
        );

    let added = false;

    if (index >= 0) {
        favorites.splice(index, 1);
        added = false;
    } else {
        favorites.unshift({
            ...item,
            type: normalizeType(item)
        });

        added = true;
    }

    saveFavorites(favorites);

    refreshFavoriteButtons(item);

    renderFavoritesIfNeeded();

    showToast(
        added
            ? "Adicionado aos favoritos ⭐"
            : "Removido dos favoritos",
        added ? "success" : "normal"
    );

    return added;
}

function refreshFavoriteButtons(item) {
    const key =
        createKey(item);

    if (!key) {
        return;
    }

    const favorite =
        isFavorite(item);

    $all(
        `[data-id="${CSS.escape(String(getItemId(item)))}"][data-type="${CSS.escape(normalizeType(item))}"] .card-favorite-button`
    ).forEach(button => {
        button.classList.toggle(
            "is-favorite",
            favorite
        );

        button.textContent =
            favorite ? "★" : "☆";

        button.setAttribute(
            "aria-label",
            favorite
                ? "Remover dos favoritos"
                : "Adicionar aos favoritos"
        );
    });

    const detailsButton =
        $("#details-favorite-button");

    if (
        detailsButton &&
        state.currentDetails &&
        createKey(state.currentDetails) === key
    ) {
        detailsButton.classList.toggle(
            "is-favorite",
            favorite
        );

        detailsButton.textContent =
            favorite
                ? "★ Favoritado"
                : "☆ Favoritar";
    }
}

function renderFavoritesIfNeeded() {
    const row =
        $("#favorites-row");

    if (!row) {
        return;
    }

    const favorites =
        getFavorites();

    renderRow(
        "#favorites-row",
        favorites,
        "Você ainda não adicionou nenhum favorito."
    );

    const section =
        $("#favorites-section");

    if (section) {
        section.hidden =
            favorites.length === 0;
    }
}


/* =========================================================
   HISTÓRICO
   ========================================================= */

function addToHistory(item) {
    if (!isValidItem(item)) {
        return;
    }

    const history =
        getHistory();

    const key =
        createKey(item);

    const filtered =
        history.filter(
            oldItem =>
                createKey(oldItem) !== key
        );

    const historyItem = {
        ...item,
        type: normalizeType(item),
        watched_at: Date.now()
    };

    filtered.unshift(historyItem);

    saveHistory(filtered);

    renderHistoryIfNeeded();
}

function clearHistory() {
    saveHistory([]);

    renderHistoryIfNeeded();

    showToast(
        "Histórico apagado.",
        "normal"
    );
}

function renderHistoryIfNeeded() {
    const row =
        $("#history-row");

    if (!row) {
        return;
    }

    const history =
        getHistory();

    renderRow(
        "#history-row",
        history,
        "Seu histórico está vazio."
    );

    const section =
        $("#historico-section");

    if (section) {
        section.hidden =
            history.length === 0;
    }
}


/* =========================================================
   PERFIL
   ========================================================= */

function updateProfileUI() {
    const profile =
        getProfile();

    const name =
        profile.name || "Visitante";

    const avatar =
        profile.avatar || "😀";

    const elements = [
        "#header-profile-avatar",
        "#user-menu-avatar",
        "#profile-avatar-large"
    ];

    elements.forEach(selector => {
        const element = $(selector);

        if (element) {
            element.textContent = avatar;
        }
    });

    const userName =
        $("#user-menu-name");

    if (userName) {
        userName.textContent = name;
    }

    const profileName =
        $("#profile-name");

    if (profileName) {
        profileName.value = name;
    }

    state.selectedAvatar = avatar;

    $all(
        ".avatar-options [data-avatar]"
    ).forEach(button => {
        button.classList.toggle(
            "selected",
            button.dataset.avatar === avatar
        );
    });
}

function openProfile() {
    updateProfileUI();

    const modal =
        $("#profile-modal");

    if (!modal) {
        return;
    }

    modal.classList.add("open");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}

function closeProfile() {
    const modal =
        $("#profile-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}

function saveProfileFromForm() {
    const input =
        $("#profile-name");

    const name =
        input
            ? input.value.trim()
            : "";

    const avatar =
        state.selectedAvatar || "😀";

    saveProfile({
        name:
            name || "Visitante",
        avatar
    });

    updateProfileUI();
    closeProfile();

    showToast(
        "Perfil salvo com sucesso! 👤",
        "success"
    );
}
/* =========================================================
   RENDERIZAÇÃO DA HOME
   ========================================================= */

async function carregarHome() {
    if (state.homeLoaded || state.loadingHome) {
        return;
    }

    state.loadingHome = true;
    setLoading(true);

    try {
        const data = await apiHome();

        if (!data) {
            throw new Error("Resposta vazia da API.");
        }

        const destaque = cleanItems(
            data.destaque || []
        );

        const filmes = cleanItems(
            data.filmes || []
        );

        const series = cleanItems(
            data.series || []
        );

        const filmesPopulares = cleanItems(
            data.filmes_populares || []
        );

        const seriesPopulares = cleanItems(
            data.series_populares || []
        );

        renderRow(
            "#movies-row",
            filmes,
            "Nenhum filme encontrado."
        );

        renderRow(
            "#series-row",
            series,
            "Nenhuma série encontrada."
        );

        renderRow(
            "#top-rated-row",
            [
                ...filmesPopulares,
                ...seriesPopulares
            ],
            "Nenhum conteúdo encontrado."
        );

        state.heroItems =
            destaque.length
                ? destaque
                : [
                    ...filmes.slice(0, 5),
                    ...series.slice(0, 5)
                ];

        renderHero();

        await carregarSecoesExtras();

        state.homeLoaded = true;

        renderContinueWatching();
        renderFavoritesIfNeeded();
        renderHistoryIfNeeded();
        renderRecommended();

    } catch (error) {
        console.error(
            "Erro ao carregar a página inicial:",
            error
        );

        showToast(
            "Não foi possível carregar os conteúdos.",
            "error"
        );

        showEmptyHome();

    } finally {
        state.loadingHome = false;
        setLoading(false);
    }
}

function showEmptyHome() {
    const empty =
        $("#empty-state");

    if (empty) {
        empty.hidden = false;
    }

    const homeRows = [
        "#movies-row",
        "#series-row",
        "#top-rated-row",
        "#latest-row",
        "#doramas-row",
        "#gl-row",
        "#kids-row"
    ];

    homeRows.forEach(selector => {
        const row = $(selector);

        if (row) {
            row.innerHTML = "";
        }
    });
}


/* =========================================================
   SEÇÕES EXTRAS DA HOME
   ========================================================= */

async function carregarSecoesExtras() {
    const tarefas = [
        carregarLancamentos(),
        carregarDoramas(),
        carregarKids(),
        carregarGenerosHome(),
        carregarGL()
    ];

    const resultados =
        await Promise.allSettled(tarefas);

    resultados.forEach(resultado => {
        if (resultado.status === "rejected") {
            console.warn(
                "Uma seção não pôde ser carregada:",
                resultado.reason
            );
        }
    });
}

async function carregarLancamentos() {
    try {
        const [moviesData, seriesData] =
            await Promise.all([
                apiMovies({
                    sort_by: "release_date.desc",
                    page: 1
                }),
                apiSeries({
                    sort_by: "first_air_date.desc",
                    page: 1
                })
            ]);

        const movies =
            cleanItems(
                moviesData.results ||
                moviesData.movies ||
                []
            );

        const series =
            cleanItems(
                seriesData.results ||
                seriesData.series ||
                []
            );

        const combined =
            [...movies, ...series]
                .sort(
                    (a, b) =>
                        String(
                            getItemDate(b)
                        ).localeCompare(
                            String(
                                getItemDate(a)
                            )
                        )
                )
                .slice(
                    0,
                    CONFIG.HOME_LIMIT
                );

        renderRow(
            "#latest-row",
            combined,
            "Nenhum lançamento encontrado."
        );

    } catch (error) {
        console.warn(
            "Erro ao carregar lançamentos:",
            error
        );
    }
}

async function carregarDoramas() {
    try {
        const data =
            await apiSeries({
                original_language: "ko",
                sort_by: "popularity.desc",
                page: 1
            });

        const items =
            cleanItems(
                data.results ||
                data.series ||
                []
            );

        renderRow(
            "#doramas-row",
            items,
            "Nenhum dorama encontrado."
        );

    } catch (error) {
        console.warn(
            "Erro ao carregar doramas:",
            error
        );
    }
}

async function carregarKids() {
    try {
        const [moviesData, seriesData] =
            await Promise.all([
                apiDiscoverMovie({
                    genre: 16,
                    sort_by: "popularity.desc",
                    page: 1
                }),
                apiDiscoverTV({
                    genre: 16,
                    sort_by: "popularity.desc",
                    page: 1
                })
            ]);

        const movies =
            cleanItems(
                moviesData.results ||
                moviesData.movies ||
                []
            );

        const series =
            cleanItems(
                seriesData.results ||
                seriesData.series ||
                []
            );

        const items =
            [...movies, ...series]
                .filter(item => !isAdult(item))
                .slice(
                    0,
                    CONFIG.HOME_LIMIT
                );

        renderRow(
            "#kids-row",
            items,
            "Nenhum conteúdo infantil encontrado."
        );

    } catch (error) {
        console.warn(
            "Erro ao carregar Kids:",
            error
        );
    }
}


/* =========================================================
   GL — BUSCA ESPECÍFICA
   ========================================================= */

async function carregarGL() {
    const row =
        $("#gl-row");

    if (!row) {
        return;
    }

    try {
        const queries = [
            "girls love",
            "girl love",
            "GL romance",
            "women love women"
        ];

        const responses =
            await Promise.allSettled(
                queries.map(query =>
                    apiSearch(query, 1)
                )
            );

        let items = [];

        responses.forEach(result => {
            if (
                result.status !==
                "fulfilled"
            ) {
                return;
            }

            const data =
                result.value;

            const results =
                data.results ||
                data.items ||
                data.data ||
                [];

            items.push(
                ...cleanItems(results)
            );
        });

        items = uniqueItems(items);

        renderRow(
            "#gl-row",
            items.slice(
                0,
                CONFIG.HOME_LIMIT
            ),
            "Nenhum conteúdo GL encontrado."
        );

    } catch (error) {
        console.warn(
            "Erro ao carregar GL:",
            error
        );

        renderRow(
            "#gl-row",
            [],
            "Nenhum conteúdo GL encontrado."
        );
    }
}

function uniqueItems(items) {
    const result = [];
    const seen = new Set();

    cleanItems(items).forEach(item => {
        const key =
            createKey(item);

        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    });

    return result;
}


/* =========================================================
   GÊNEROS DA HOME
   ========================================================= */

async function carregarGenerosHome() {
    const genreMap = {
        acao: 28,
        aventura: 12,
        comedia: 35,
        drama: 18,
        romance: 10749,
        fantasia: 14,
        terror: 27,
        ficcao: 878
    };

    const entries =
        Object.entries(genreMap);

    await Promise.all(
        entries.map(
            async ([name, genre]) => {
                try {
                    const data =
                        await apiDiscoverMovie({
                            genre,
                            sort_by:
                                "popularity.desc",
                            page: 1
                        });

                    const items =
                        cleanItems(
                            data.results ||
                            data.movies ||
                            []
                        );

                    renderRow(
                        `#${name}-row`,
                        items,
                        `Nenhum conteúdo de ${name} encontrado.`
                    );

                } catch (error) {
                    console.warn(
                        `Erro no gênero ${name}:`,
                        error
                    );
                }
            }
        )
    );
}


/* =========================================================
   HERO / DESTAQUES
   ========================================================= */

function renderHero() {
    const slider =
        $("#hero-slider");

    if (!slider) {
        return;
    }

    const items =
        cleanItems(
            state.heroItems
        ).slice(0, 10);

    if (!items.length) {
        return;
    }

    state.heroItems = items;

    slider.innerHTML = "";

    items.forEach(
        (item, index) => {
            const slide =
                document.createElement("article");

            slide.className =
                "hero-slide";

            slide.dataset.index =
                String(index);

            const backdrop =
                getBackdrop(item);

            const poster =
                getPoster(item);

            const title =
                getItemTitle(item);

            const overview =
                item.overview ||
                "Descubra este conteúdo no CineFamily.";

            const year =
                getYear(item);

            const type =
                getTypeLabel(
                    normalizeType(item)
                );

            slide.innerHTML = `
                <div
                    class="hero-background"
                    style="background-image:url('${escapeAttribute(backdrop || poster)}')"
                ></div>

                <div class="hero-overlay"></div>

                <div class="hero-content">
                    <span class="hero-kicker">
                        ${escapeHTML(type)}
                        ${
                            year
                                ? ` • ${escapeHTML(year)}`
                                : ""
                        }
                    </span>

                    <h1 class="hero-title">
                        ${escapeHTML(title)}
                    </h1>

                    <p class="hero-overview">
                        ${escapeHTML(
                            truncateText(
                                overview,
                                280
                            )
                        )}
                    </p>

                    <div class="hero-actions">
                        <button
                            type="button"
                            class="hero-watch-button"
                            data-action="watch"
                            data-id="${escapeAttribute(item.id)}"
                            data-type="${escapeAttribute(normalizeType(item))}"
                        >
                            ▶ Assistir agora
                        </button>

                        <button
                            type="button"
                            class="hero-info-button"
                            data-action="details"
                            data-id="${escapeAttribute(item.id)}"
                            data-type="${escapeAttribute(normalizeType(item))}"
                        >
                            ⓘ Mais informações
                        </button>
                    </div>
                </div>
            `;

            slider.appendChild(slide);
        }
    );

    state.currentHero = 0;

    renderHeroIndicators();
    updateHero();

    startHeroTimer();
}

function truncateText(text, maxLength) {
    const value =
        String(text || "").trim();

    if (value.length <= maxLength) {
        return value;
    }

    return (
        value.substring(
            0,
            maxLength
        ).trim() + "..."
    );
}

function renderHeroIndicators() {
    const container =
        $("#hero-indicators");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    state.heroItems.forEach(
        (_, index) => {
            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "hero-indicator";

            button.dataset.heroIndex =
                String(index);

            button.setAttribute(
                "aria-label",
                `Ir para destaque ${index + 1}`
            );

            if (
                index ===
                state.currentHero
            ) {
                button.classList.add(
                    "active"
                );
            }

            container.appendChild(
                button
            );
        }
    );
}

function updateHero() {
    const slides =
        $all(".hero-slide");

    if (!slides.length) {
        return;
    }

    const total =
        slides.length;

    if (
        state.currentHero < 0
    ) {
        state.currentHero =
            total - 1;
    }

    if (
        state.currentHero >= total
    ) {
        state.currentHero = 0;
    }

    slides.forEach(
        (slide, index) => {
            slide.classList.toggle(
                "active",
                index ===
                state.currentHero
            );
        }
    );

    $all(
        ".hero-indicator"
    ).forEach(
        (indicator, index) => {
            indicator.classList.toggle(
                "active",
                index ===
                state.currentHero
            );
        }
    );
}

function changeHero(direction) {
    const total =
        state.heroItems.length;

    if (total <= 1) {
        return;
    }

    state.currentHero +=
        Number(direction) || 0;

    if (
        state.currentHero < 0
    ) {
        state.currentHero =
            total - 1;
    }

    if (
        state.currentHero >= total
    ) {
        state.currentHero = 0;
    }

    updateHero();
    restartHeroTimer();
}

function goToHero(index) {
    const value =
        Number(index);

    if (
        !Number.isFinite(value) ||
        !state.heroItems.length
    ) {
        return;
    }

    state.currentHero =
        Math.max(
            0,
            Math.min(
                value,
                state.heroItems.length - 1
            )
        );

    updateHero();
    restartHeroTimer();
}

function startHeroTimer() {
    stopHeroTimer();

    if (
        state.heroItems.length <= 1
    ) {
        return;
    }

    state.heroTimer =
        setInterval(() => {
            changeHero(1);
        }, CONFIG.HERO_INTERVAL);
}

function stopHeroTimer() {
    if (state.heroTimer) {
        clearInterval(
            state.heroTimer
        );

        state.heroTimer = null;
    }
}

function restartHeroTimer() {
    startHeroTimer();
}


/* =========================================================
   CONTINUE ASSISTINDO
   ========================================================= */

function renderContinueWatching() {
    const section =
        $("#continue-section");

    const row =
        $("#continue-row");

    if (!section || !row) {
        return;
    }

    const history =
        getHistory();

    if (!history.length) {
        section.hidden = true;
        row.innerHTML = "";
        return;
    }

    section.hidden = false;

    renderRow(
        "#continue-row",
        history.slice(
            0,
            CONFIG.HISTORY_LIMIT
        )
    );
}


/* =========================================================
   RECOMENDADOS
   ========================================================= */

function renderRecommended() {
    const row =
        $("#recommended-row");

    if (!row) {
        return;
    }

    const favorites =
        getFavorites();

    const history =
        getHistory();

    const source =
        uniqueItems([
            ...favorites,
            ...history
        ]);

    if (source.length) {
        renderRow(
            "#recommended-row",
            source.slice(
                0,
                CONFIG.HOME_LIMIT
            )
        );

        return;
    }

    const homeItems =
        uniqueItems([
            ...state.heroItems
        ]);

    renderRow(
        "#recommended-row",
        homeItems
    );
}


/* =========================================================
   BUSCA
   ========================================================= */

function openSearch() {
    const area =
        $("#search-area");

    if (!area) {
        return;
    }

    area.classList.add("open");
    area.hidden = false;

    const input =
        $("#search-input");

    if (input) {
        setTimeout(() => {
            input.focus();
        }, 100);
    }
}

function closeSearch() {
    const area =
        $("#search-area");

    if (!area) {
        return;
    }

    area.classList.remove("open");

    setTimeout(() => {
        if (
            !area.classList.contains("open")
        ) {
            area.hidden = true;
        }
    }, 250);
}

function clearSearch() {
    const input =
        $("#search-input");

    if (input) {
        input.value = "";
        input.focus();
    }

    state.currentSearch = "";

    const section =
        $("#search-results-section");

    const row =
        $("#search-results-row");

    if (section) {
        section.hidden = true;
    }

    if (row) {
        row.innerHTML = "";
    }
}

async function realizarBusca(query) {
    const value =
        String(query || "")
            .trim();

    if (!value) {
        clearSearch();
        return;
    }

    if (state.searchLoading) {
        return;
    }

    state.currentSearch =
        value;

    state.searchLoading = true;

    const section =
        $("#search-results-section");

    const row =
        $("#search-results-row");

    if (section) {
        section.hidden = false;
    }

    if (row) {
        row.innerHTML = `
            <div class="row-loading">
                Buscando conteúdos...
            </div>
        `;
    }

    try {
        const data =
            await apiSearch(
                value,
                1
            );

        const results =
            cleanItems(
                data.results ||
                data.items ||
                data.data ||
                []
            );

        if (row) {
            renderRow(
                "#search-results-row",
                results,
                "Nenhum resultado encontrado."
            );
        }

        if (section) {
            section.hidden = false;
        }

        const resultsHeading =
            section
                ? section.querySelector(
                    ".section-title"
                )
                : null;

        if (resultsHeading) {
            resultsHeading.textContent =
                `Resultados para "${value}"`;
        }

        if (!results.length) {
            showToast(
                "Nenhum conteúdo encontrado.",
                "normal"
            );
        }

    } catch (error) {
        console.error(
            "Erro na busca:",
            error
        );

        if (row) {
            row.innerHTML = `
                <div class="row-empty">
                    Não foi possível realizar a busca.
                </div>
            `;
        }

        showToast(
            "Erro ao realizar a busca.",
            "error"
        );

    } finally {
        state.searchLoading = false;
    }
}
/* =========================================================
   DETALHES DO FILME / SÉRIE
   ========================================================= */

async function abrirDetalhes(itemOuId, tipo) {
    let item = itemOuId;

    if (
        typeof itemOuId === "number" ||
        typeof itemOuId === "string"
    ) {
        item = {
            id: Number(itemOuId),
            type: tipo === "tv" ? "tv" : "movie"
        };
    }

    if (!item || !getItemId(item)) {
        showToast(
            "Não foi possível identificar este conteúdo.",
            "error"
        );
        return;
    }

    const id = getItemId(item);
    const type = normalizeType(item);

    const modal = $("#details-modal");

    if (!modal) {
        return;
    }

    state.currentDetails = {
        ...item,
        id,
        type
    };

    preencherDetalhesBasicos(state.currentDetails);

    modal.classList.add("open");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    const extra = $("#details-extra");

    if (extra) {
        extra.innerHTML = `
            <div class="details-loading">
                Carregando informações...
            </div>
        `;
    }

    try {
        const data =
            await apiDetails(type, id);

        const details =
            normalizeDetails(
                data,
                state.currentDetails
            );

        state.currentDetails =
            details;

        preencherDetalhes(details);

        addToHistory(details);

    } catch (error) {
        console.error(
            "Erro ao carregar detalhes:",
            error
        );

        const extraElement =
            $("#details-extra");

        if (extraElement) {
            extraElement.innerHTML = `
                <div class="details-error">
                    Não foi possível carregar todos os detalhes deste conteúdo.
                </div>
            `;
        }

        showToast(
            "Algumas informações não puderam ser carregadas.",
            "error"
        );
    }
}

function normalizeDetails(data, fallback) {
    const source =
        data && typeof data === "object"
            ? data
            : {};

    const base =
        fallback || {};

    const type =
        source.type ||
        base.type ||
        "movie";

    const normalized = {
        ...base,
        ...source,
        id:
            Number(
                source.id ??
                base.id
            ),
        type:
            type === "tv"
                ? "tv"
                : "movie",
        title:
            getItemTitle(source) ||
            getItemTitle(base),
        overview:
            source.overview ||
            base.overview ||
            "",
        poster_path:
            source.poster_path ||
            base.poster_path ||
            "",
        backdrop_path:
            source.backdrop_path ||
            base.backdrop_path ||
            "",
        vote_average:
            source.vote_average ??
            base.vote_average ??
            0,
        release_date:
            source.release_date ||
            source.first_air_date ||
            base.release_date ||
            base.first_air_date ||
            ""
    };

    return normalized;
}

function preencherDetalhesBasicos(item) {
    const title =
        getItemTitle(item);

    const type =
        normalizeType(item);

    const poster =
        getPoster(item);

    const backdrop =
        getBackdrop(item);

    const titleElement =
        $("#details-title");

    if (titleElement) {
        titleElement.textContent =
            title;
    }

    const typeElement =
        $("#details-type");

    if (typeElement) {
        typeElement.textContent =
            getTypeLabel(type);
    }

    const posterElement =
        $("#details-poster");

    if (posterElement) {
        if (poster) {
            posterElement.src =
                poster;

            posterElement.alt =
                title;

            posterElement.style.display =
                "";
        } else {
            posterElement.removeAttribute(
                "src"
            );

            posterElement.style.display =
                "none";
        }
    }

    const backdropElement =
        $("#details-backdrop");

    if (backdropElement) {
        if (backdrop) {
            backdropElement.style.backgroundImage =
                `url("${escapeAttribute(backdrop)}")`;
        } else {
            backdropElement.style.backgroundImage =
                "none";
        }
    }

    const overview =
        $("#details-overview");

    if (overview) {
        overview.textContent =
            item.overview ||
            "Sinopse não disponível.";
    }

    const meta =
        $("#details-meta");

    if (meta) {
        meta.innerHTML = buildMetaHTML(
            item
        );
    }

    updateDetailsFavoriteButton();
}

function preencherDetalhes(item) {
    preencherDetalhesBasicos(
        item
    );

    const extra =
        $("#details-extra");

    if (extra) {
        extra.innerHTML =
            buildDetailsExtraHTML(
                item
            );
    }

    configurarEpisodios(
        item
    );

    updateDetailsFavoriteButton();
}

function buildMetaHTML(item) {
    const type =
        normalizeType(item);

    const year =
        getYear(item);

    const rating =
        getRating(item);

    const runtime =
        formatRuntime(
            item.runtime ||
            (
                Array.isArray(
                    item.episode_run_time
                )
                    ? item.episode_run_time[0]
                    : 0
            )
        );

    const genres =
        Array.isArray(item.genres)
            ? item.genres
                .map(
                    genre =>
                        typeof genre === "string"
                            ? genre
                            : genre?.name
                )
                .filter(Boolean)
                .slice(0, 4)
            : [];

    const parts = [];

    parts.push(
        `<span>${escapeHTML(getTypeLabel(type))}</span>`
    );

    if (year) {
        parts.push(
            `<span>${escapeHTML(year)}</span>`
        );
    }

    if (rating !== "0.0") {
        parts.push(
            `<span>⭐ ${escapeHTML(rating)}</span>`
        );
    }

    if (runtime) {
        parts.push(
            `<span>${escapeHTML(runtime)}</span>`
        );
    }

    genres.forEach(genre => {
        parts.push(
            `<span>${escapeHTML(genre)}</span>`
        );
    });

    return parts.join(
        '<span class="meta-separator">•</span>'
    );
}

function buildDetailsExtraHTML(item) {
    const sections = [];

    const genres =
        Array.isArray(item.genres)
            ? item.genres
                .map(
                    genre =>
                        typeof genre === "string"
                            ? genre
                            : genre?.name
                )
                .filter(Boolean)
            : [];

    if (genres.length) {
        sections.push(`
            <div class="details-extra-block">
                <strong>Gêneros</strong>
                <div class="details-tags">
                    ${genres
                        .map(
                            genre =>
                                `<span>${escapeHTML(genre)}</span>`
                        )
                        .join("")}
                </div>
            </div>
        `);
    }

    if (
        item.original_language
    ) {
        sections.push(`
            <div class="details-extra-block">
                <strong>Idioma original</strong>
                <span>${escapeHTML(
                    String(
                        item.original_language
                    ).toUpperCase()
                )}</span>
            </div>
        `);
    }

    if (
        item.vote_count
    ) {
        sections.push(`
            <div class="details-extra-block">
                <strong>Avaliações</strong>
                <span>${escapeHTML(
                    String(
                        item.vote_count
                    )
                )}</span>
            </div>
        `);
    }

    const cast =
        Array.isArray(item.cast)
            ? item.cast
            : [];

    if (cast.length) {
        const names =
            cast
                .map(person => {
                    if (
                        typeof person ===
                        "string"
                    ) {
                        return person;
                    }

                    return (
                        person?.name ||
                        person?.character ||
                        ""
                    );
                })
                .filter(Boolean)
                .slice(0, 10);

        if (names.length) {
            sections.push(`
                <div class="details-extra-block">
                    <strong>Elenco</strong>
                    <div class="details-cast">
                        ${names
                            .map(
                                name =>
                                    `<span>${escapeHTML(name)}</span>`
                            )
                            .join("")}
                    </div>
                </div>
            `);
        }
    }

    const trailer =
        getTrailer(item);

    if (trailer) {
        sections.push(`
            <div class="details-extra-block trailer-block">
                <strong>Trailer</strong>

                <button
                    type="button"
                    class="details-trailer-button"
                    data-action="trailer"
                >
                    ▶ Assistir trailer
                </button>
            </div>
        `);
    }

    return sections.length
        ? sections.join("")
        : `
            <div class="details-extra-block">
                <span>Informações adicionais não disponíveis.</span>
            </div>
        `;
}


/* =========================================================
   TRAILER
   ========================================================= */

function getTrailer(item) {
    if (!item) {
        return null;
    }

    if (
        item.trailer &&
        typeof item.trailer === "object"
    ) {
        return item.trailer;
    }

    const videos =
        Array.isArray(item.videos)
            ? item.videos
            : (
                item.videos &&
                Array.isArray(
                    item.videos.results
                )
                    ? item.videos.results
                    : []
            );

    const youtubeVideos =
        videos.filter(video => {
            const site =
                String(
                    video?.site || ""
                ).toLowerCase();

            const type =
                String(
                    video?.type || ""
                ).toLowerCase();

            return (
                site === "youtube" &&
                (
                    type === "trailer" ||
                    type === "teaser"
                ) &&
                video?.key
            );
        });

    if (!youtubeVideos.length) {
        return null;
    }

    const official =
        youtubeVideos.find(
            video =>
                video.official === true
        );

    return (
        official ||
        youtubeVideos[0]
    );
}

function openTrailer() {
    const item =
        state.currentDetails;

    if (!item) {
        return;
    }

    const trailer =
        getTrailer(item);

    if (!trailer) {
        showToast(
            "Trailer não disponível.",
            "normal"
        );
        return;
    }

    const key =
        trailer.key;

    if (!key) {
        showToast(
            "Trailer indisponível.",
            "normal"
        );
        return;
    }

    openPlayer({
        title:
            `${getItemTitle(item)} — Trailer`,
        url:
            `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`,
        type:
            "youtube"
    });
}


/* =========================================================
   FAVORITO NO MODAL
   ========================================================= */

function updateDetailsFavoriteButton() {
    const button =
        $("#details-favorite-button");

    const item =
        state.currentDetails;

    if (!button || !item) {
        return;
    }

    const favorite =
        isFavorite(item);

    button.classList.toggle(
        "is-favorite",
        favorite
    );

    button.textContent =
        favorite
            ? "★ Favoritado"
            : "☆ Favoritar";

    button.setAttribute(
        "aria-label",
        favorite
            ? "Remover dos favoritos"
            : "Adicionar aos favoritos"
    );
}

function toggleCurrentFavorite() {
    if (!state.currentDetails) {
        return;
    }

    toggleFavorite(
        state.currentDetails
    );

    updateDetailsFavoriteButton();
}


/* =========================================================
   EPISÓDIOS E TEMPORADAS
   ========================================================= */

function configurarEpisodios(item) {
    const container =
        $("#episodes-container");

    const list =
        $("#episodes-list");

    if (!container || !list) {
        return;
    }

    if (
        normalizeType(item) !==
        "tv"
    ) {
        container.hidden = true;
        list.innerHTML = "";
        return;
    }

    const seasons =
        Array.isArray(item.seasons)
            ? item.seasons
            : [];

    const validSeasons =
        seasons.filter(
            season =>
                season &&
                Number(
                    season.season_number
                ) >= 0
        );

    if (!validSeasons.length) {
        container.hidden = true;
        list.innerHTML = "";
        return;
    }

    container.hidden = false;

    const firstSeason =
        validSeasons.find(
            season =>
                Number(
                    season.season_number
                ) > 0
        ) ||
        validSeasons[0];

    renderSeasonSelector(
        validSeasons,
        firstSeason.season_number
    );

    carregarTemporada(
        item.id,
        firstSeason.season_number
    );
}

function renderSeasonSelector(
    seasons,
    selectedSeason
) {
    const list =
        $("#episodes-list");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "season-selector";

    seasons.forEach(season => {
        const number =
            Number(
                season.season_number
            );

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "season-button";

        if (
            number ===
            Number(selectedSeason)
        ) {
            button.classList.add(
                "active"
            );
        }

        button.dataset.action =
            "season";

        button.dataset.season =
            String(number);

        button.textContent =
            season.name ||
            `Temporada ${number}`;

        wrapper.appendChild(
            button
        );
    });

    list.appendChild(
        wrapper
    );

    const episodes =
        document.createElement(
            "div"
        );

    episodes.className =
        "episodes-results";

    episodes.id =
        "episodes-results";

    list.appendChild(
        episodes
    );
}

async function carregarTemporada(
    tvId,
    seasonNumber
) {
    const results =
        $("#episodes-results");

    if (!results) {
        return;
    }

    results.innerHTML = `
        <div class="episodes-loading">
            Carregando episódios...
        </div>
    `;

    try {
        const data =
            await apiSeason(
                tvId,
                seasonNumber
            );

        const episodes =
            Array.isArray(
                data.episodes
            )
                ? data.episodes
                : [];

        if (!episodes.length) {
            results.innerHTML = `
                <div class="episodes-empty">
                    Nenhum episódio encontrado.
                </div>
            `;

            return;
        }

        results.innerHTML =
            episodes
                .map(
                    episode =>
                        buildEpisodeHTML(
                            episode,
                            tvId,
                            seasonNumber
                        )
                )
                .join("");

    } catch (error) {
        console.error(
            "Erro ao carregar temporada:",
            error
        );

        results.innerHTML = `
            <div class="episodes-error">
                Não foi possível carregar os episódios.
            </div>
        `;
    }
}

function buildEpisodeHTML(
    episode,
    tvId,
    seasonNumber
) {
    const number =
        Number(
            episode.episode_number
        );

    const name =
        episode.name ||
        `Episódio ${number}`;

    const overview =
        episode.overview ||
        "";

    const still =
        episode.still_path ||
        episode.still ||
        "";

    const runtime =
        formatRuntime(
            episode.runtime
        );

    return `
        <article
            class="episode-card"
            data-episode="${escapeAttribute(number)}"
        >
            ${
                still
                    ? `
                        <img
                            class="episode-image"
                            src="${escapeAttribute(still)}"
                            alt="${escapeAttribute(name)}"
                            loading="lazy"
                        >
                    `
                    : `
                        <div class="episode-no-image">
                            🎬
                        </div>
                    `
            }

            <div class="episode-info">
                <div class="episode-number">
                    Episódio ${escapeHTML(number)}
                </div>

                <h4>
                    ${escapeHTML(name)}
                </h4>

                ${
                    overview
                        ? `
                            <p>
                                ${escapeHTML(
                                    truncateText(
                                        overview,
                                        160
                                    )
                                )}
                            </p>
                        `
                        : ""
                }

                ${
                    runtime
                        ? `
                            <span class="episode-runtime">
                                ${escapeHTML(runtime)}
                            </span>
                        `
                        : ""
                }

                <button
                    type="button"
                    class="episode-watch-button"
                    data-action="episode"
                    data-id="${escapeAttribute(tvId)}"
                    data-season="${escapeAttribute(seasonNumber)}"
                    data-episode="${escapeAttribute(number)}"
                >
                    ▶ Assistir episódio
                </button>
            </div>
        </article>
    `;
}


/* =========================================================
   PLAYER
   ========================================================= */

function openPlayer(config = {}) {
    const modal =
        $("#player-modal");

    const body =
        $("#player-body");

    const title =
        $("#player-title");

    const status =
        $("#player-status");

    if (!modal || !body) {
        return;
    }

    const playerTitle =
        config.title ||
        "CineFamily";

    if (title) {
        title.textContent =
            playerTitle;
    }

    body.innerHTML = "";

    if (status) {
        status.textContent = "";
    }

    if (
        config.type === "youtube" &&
        config.url
    ) {
        const iframe =
            document.createElement(
                "iframe"
            );

        iframe.src =
            config.url;

        iframe.title =
            playerTitle;

        iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

        iframe.allowFullscreen =
            true;

        iframe.referrerPolicy =
            "strict-origin-when-cross-origin";

        iframe.className =
            "player-iframe";

        body.appendChild(
            iframe
        );

    } else {
        body.innerHTML = `
            <div class="player-placeholder">
                <div class="player-placeholder-icon">
                    ▶
                </div>

                <h3>
                    Conteúdo pronto para reprodução
                </h3>

                <p>
                    O CineFamily não possui uma fonte de vídeo própria configurada para este conteúdo.
                </p>
            </div>
        `;
    }

    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}

function closePlayer() {
    const modal =
        $("#player-modal");

    const body =
        $("#player-body");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "open"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (body) {
        body.innerHTML = "";
    }

    document.body.classList.remove(
        "modal-open"
    );
}

async function assistirConteudo(
    item
) {
    if (!item) {
        return;
    }

    const type =
        normalizeType(item);

    const id =
        getItemId(item);

    if (!id) {
        return;
    }

    addToHistory(item);

    if (type === "tv") {
        await abrirDetalhes(
            item
        );

        return;
    }

    try {
        const data =
            await apiDetails(
                type,
                id
            );

        const details =
            normalizeDetails(
                data,
                item
            );

        state.currentDetails =
            details;

        const trailer =
            getTrailer(details);

        if (trailer?.key) {
            openPlayer({
                title:
                    `${getItemTitle(details)} — Trailer`,
                url:
                    `https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`,
                type:
                    "youtube"
            });

            return;
        }

        await abrirDetalhes(
            details
        );

    } catch (error) {
        console.error(
            "Erro ao iniciar reprodução:",
            error
        );

        await abrirDetalhes(
            item
        );
    }
}

async function assistirEpisodio(
    tvId,
    season,
    episode
) {
    const id =
        Number(tvId);

    const seasonNumber =
        Number(season);

    const episodeNumber =
        Number(episode);

    if (
        !Number.isFinite(id) ||
        !Number.isFinite(seasonNumber) ||
        !Number.isFinite(episodeNumber)
    ) {
        return;
    }

    try {
        const data =
            await apiFetch(
                `/api/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`
            );

        const title =
            data.name ||
            `Episódio ${episodeNumber}`;

        const trailer =
            getTrailer(data);

        if (trailer?.key) {
            openPlayer({
                title,
                url:
                    `https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`,
                type:
                    "youtube"
            });

            return;
        }

        showToast(
            "Este episódio não possui vídeo disponível.",
            "normal"
        );

    } catch (error) {
        console.error(
            "Erro ao carregar episódio:",
            error
        );

        showToast(
            "Não foi possível abrir este episódio.",
            "error"
        );
    }
}
/* =========================================================
   FECHAR MODAIS
   ========================================================= */

function closeDetails() {
    const modal =
        $("#details-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    state.currentDetails = null;
}

function closeCategoryModal() {
    const modal =
        $("#category-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    state.currentCategory = null;
}

function closeAllModals() {
    closeDetails();
    closePlayer();
    closeProfile();
    closeCategoryModal();
}


/* =========================================================
   MENU DO USUÁRIO
   ========================================================= */

function toggleUserMenu() {
    const menu =
        $("#user-menu");

    if (!menu) {
        return;
    }

    const isOpen =
        menu.classList.contains("open");

    if (isOpen) {
        closeUserMenu();
    } else {
        openUserMenu();
    }
}

function openUserMenu() {
    const menu =
        $("#user-menu");

    if (!menu) {
        return;
    }

    updateProfileUI();

    menu.classList.add("open");

    menu.setAttribute(
        "aria-hidden",
        "false"
    );
}

function closeUserMenu() {
    const menu =
        $("#user-menu");

    if (!menu) {
        return;
    }

    menu.classList.remove("open");

    menu.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function scrollToSection(id) {
    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    closeUserMenu();
}

function setupNavigation() {
    $all(
        ".main-nav a"
    ).forEach(link => {
        link.addEventListener(
            "click",
            event => {
                const href =
                    link.getAttribute("href");

                if (
                    !href ||
                    !href.startsWith("#")
                ) {
                    return;
                }

                const id =
                    href.substring(1);

                if (!id) {
                    return;
                }

                const target =
                    document.getElementById(id);

                if (!target) {
                    return;
                }

                event.preventDefault();

                scrollToSection(id);
            }
        );
    });
}


/* =========================================================
   MODAL DE CATEGORIA
   ========================================================= */

const CATEGORY_CONFIG = {
    acao: {
        title: "Ação",
        type: "movie",
        genre: 28
    },
    aventura: {
        title: "Aventura",
        type: "movie",
        genre: 12
    },
    comedia: {
        title: "Comédia",
        type: "movie",
        genre: 35
    },
    drama: {
        title: "Drama",
        type: "movie",
        genre: 18
    },
    romance: {
        title: "Romance",
        type: "movie",
        genre: 10749
    },
    fantasia: {
        title: "Fantasia",
        type: "movie",
        genre: 14
    },
    terror: {
        title: "Terror",
        type: "movie",
        genre: 27
    },
    ficcao: {
        title: "Ficção científica",
        type: "movie",
        genre: 878
    }
};

async function openCategory(category) {
    const config =
        CATEGORY_CONFIG[category];

    if (!config) {
        return;
    }

    const modal =
        $("#category-modal");

    if (!modal) {
        return;
    }

    state.currentCategory =
        category;

    state.categoryPage = 1;
    state.categoryTotalPages = 1;

    const kicker =
        $("#category-kicker");

    const title =
        $("#category-title");

    const results =
        $("#category-results");

    const loading =
        $("#category-loading");

    const empty =
        $("#category-empty");

    const page =
        $("#category-page");

    if (kicker) {
        kicker.textContent =
            "Explorar";
    }

    if (title) {
        title.textContent =
            config.title;
    }

    if (results) {
        results.innerHTML = "";
    }

    if (empty) {
        empty.hidden = true;
    }

    if (loading) {
        loading.hidden = false;
    }

    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    await loadCategoryPage();

    if (page) {
        page.textContent =
            String(state.categoryPage);
    }
}

async function loadCategoryPage() {
    const category =
        state.currentCategory;

    const config =
        CATEGORY_CONFIG[category];

    if (!config) {
        return;
    }

    const results =
        $("#category-results");

    const loading =
        $("#category-loading");

    const empty =
        $("#category-empty");

    if (loading) {
        loading.hidden = false;
    }

    if (empty) {
        empty.hidden = true;
    }

    try {
        const data =
            await apiDiscoverMovie({
                genre: config.genre,
                sort_by: "popularity.desc",
                page: state.categoryPage
            });

        const items =
            cleanItems(
                data.results ||
                data.movies ||
                []
            );

        state.categoryTotalPages =
            Math.max(
                1,
                Number(
                    data.total_pages ||
                    1
                )
            );

        if (results) {
            results.innerHTML = "";

            if (!items.length) {
                if (empty) {
                    empty.hidden = false;
                }
            } else {
                items.forEach(item => {
                    const card =
                        createCard(item);

                    if (card) {
                        results.appendChild(
                            card
                        );
                    }
                });
            }
        }

        updateCategoryPagination();

    } catch (error) {
        console.error(
            "Erro ao carregar categoria:",
            error
        );

        if (results) {
            results.innerHTML = `
                <div class="category-error">
                    Não foi possível carregar esta categoria.
                </div>
            `;
        }

    } finally {
        if (loading) {
            loading.hidden = true;
        }
    }
}

function updateCategoryPagination() {
    const page =
        $("#category-page");

    const previous =
        $("#category-prev");

    const next =
        $("#category-next");

    if (page) {
        page.textContent =
            `${state.categoryPage}`;
    }

    if (previous) {
        previous.disabled =
            state.categoryPage <= 1;
    }

    if (next) {
        next.disabled =
            state.categoryPage >=
            state.categoryTotalPages;
    }
}

async function changeCategoryPage(
    direction
) {
    const newPage =
        state.categoryPage +
        Number(direction);

    if (
        newPage < 1 ||
        newPage >
            state.categoryTotalPages
    ) {
        return;
    }

    state.categoryPage =
        newPage;

    await loadCategoryPage();
}


/* =========================================================
   BOTÃO HOME / LOGO
   ========================================================= */

function goHome() {
    closeAllModals();
    closeUserMenu();

    const searchSection =
        $("#search-results-section");

    if (searchSection) {
        searchSection.hidden = true;
    }

    const inicio =
        $("#inicio");

    if (inicio) {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
}


/* =========================================================
   EVENTOS DOS CARDS
   ========================================================= */

async function handleAction(
    actionElement,
    card
) {
    if (!actionElement) {
        return;
    }

    const action =
        actionElement.dataset.action;

    if (!action) {
        return;
    }

    if (action === "favorite") {
        let item = null;

        if (card) {
            item = {
                id:
                    Number(
                        card.dataset.id
                    ),
                type:
                    card.dataset.type,
                title:
                    card.dataset.title
            };
        }

        if (
            !item ||
            !item.id
        ) {
            return;
        }

        const button =
            actionElement;

        button.disabled = true;

        try {
            let fullItem =
                item;

            try {
                const data =
                    await apiDetails(
                        item.type,
                        item.id
                    );

                fullItem =
                    normalizeDetails(
                        data,
                        item
                    );
            } catch (error) {
                console.warn(
                    "Não foi possível obter detalhes para favorito:",
                    error
                );
            }

            toggleFavorite(
                fullItem
            );

            refreshFavoriteButtons(
                fullItem
            );

        } finally {
            button.disabled = false;
        }

        return;
    }

    if (action === "details") {
        if (
            card &&
            card.dataset.id
        ) {
            await abrirDetalhes(
                Number(
                    card.dataset.id
                ),
                card.dataset.type
            );
        }

        return;
    }

    if (action === "watch") {
        if (
            actionElement.dataset.id
        ) {
            await assistirConteudo({
                id:
                    Number(
                        actionElement.dataset.id
                    ),
                type:
                    actionElement.dataset.type
            });

            return;
        }

        if (
            card &&
            card.dataset.id
        ) {
            await assistirConteudo({
                id:
                    Number(
                        card.dataset.id
                    ),
                type:
                    card.dataset.type,
                title:
                    card.dataset.title
            });
        }

        return;
    }

    if (action === "trailer") {
        openTrailer();
        return;
    }

    if (action === "episode") {
        await assistirEpisodio(
            actionElement.dataset.id,
            actionElement.dataset.season,
            actionElement.dataset.episode
        );

        return;
    }

    if (action === "season") {
        const item =
            state.currentDetails;

        if (!item) {
            return;
        }

        $all(
            ".season-button"
        ).forEach(button => {
            button.classList.toggle(
                "active",
                button ===
                actionElement
            );
        });

        await carregarTemporada(
            item.id,
            Number(
                actionElement.dataset.season
            )
        );

        return;
    }
}


/* =========================================================
   EVENTO CENTRAL DE CLIQUES
   ========================================================= */

function setupGlobalClickHandler() {
    document.addEventListener(
        "click",
        async event => {
            const actionElement =
                event.target.closest(
                    "[data-action]"
                );

            if (actionElement) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    actionElement.closest(
                        ".movie-card"
                    );

                await handleAction(
                    actionElement,
                    card
                );

                return;
            }

            const card =
                event.target.closest(
                    ".movie-card"
                );

            if (card) {
                if (
                    event.target.closest(
                        "button"
                    )
                ) {
                    return;
                }

                const id =
                    Number(
                        card.dataset.id
                    );

                const type =
                    card.dataset.type;

                if (id) {
                    await abrirDetalhes(
                        id,
                        type
                    );
                }

                return;
            }

            const categoryButton =
                event.target.closest(
                    "[data-category]"
                );

            if (categoryButton) {
                event.preventDefault();

                const category =
                    categoryButton.dataset.category;

                await openCategory(
                    category
                );

                return;
            }

            const heroIndicator =
                event.target.closest(
                    "[data-hero-index]"
                );

            if (heroIndicator) {
                event.preventDefault();

                goToHero(
                    heroIndicator.dataset.heroIndex
                );

                return;
            }

            const rowScroll =
                event.target.closest(
                    "[data-row-scroll]"
                );

            if (rowScroll) {
                return;
            }
        }
    );
}


/* =========================================================
   BOTÕES DO HEADER / MODAIS
   ========================================================= */

function setupInterfaceButtons() {
    const logo =
        $(".site-logo");

    if (logo) {
        logo.addEventListener(
            "click",
            event => {
                event.preventDefault();
                goHome();
            }
        );
    }

    const searchToggle =
        $("#search-toggle");

    if (searchToggle) {
        searchToggle.addEventListener(
            "click",
            event => {
                event.preventDefault();
                openSearch();
            }
        );
    }

    const searchClose =
        $("#search-close");

    if (searchClose) {
        searchClose.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeSearch();
            }
        );
    }

    const searchClear =
        $("#search-clear");

    if (searchClear) {
        searchClear.addEventListener(
            "click",
            event => {
                event.preventDefault();
                clearSearch();
            }
        );
    }

    const searchButton =
        $("#search-button");

    if (searchButton) {
        searchButton.addEventListener(
            "click",
            async event => {
                event.preventDefault();

                const input =
                    $("#search-input");

                await realizarBusca(
                    input
                        ? input.value
                        : ""
                );
            }
        );
    }

    const searchInput =
        $("#search-input");

    if (searchInput) {
        searchInput.addEventListener(
            "keydown",
            async event => {
                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();

                    await realizarBusca(
                        searchInput.value
                    );
                }

                if (
                    event.key ===
                    "Escape"
                ) {
                    closeSearch();
                }
            }
        );

        searchInput.addEventListener(
            "input",
            () => {
                const value =
                    searchInput.value.trim();

                const clear =
                    $("#search-clear");

                if (clear) {
                    clear.style.visibility =
                        value
                            ? "visible"
                            : "hidden";
                }
            }
        );
    }

    const profileButton =
        $("#profile-button");

    if (profileButton) {
        profileButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                toggleUserMenu();
            }
        );
    }

    const footerProfile =
        $("#footer-profile-button");

    if (footerProfile) {
        footerProfile.addEventListener(
            "click",
            event => {
                event.preventDefault();
                openProfile();
            }
        );
    }

    const editProfile =
        $("#user-profile-edit");

    if (editProfile) {
        editProfile.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeUserMenu();
                openProfile();
            }
        );
    }

    const userFavorites =
        $("#user-favorites-button");

    if (userFavorites) {
        userFavorites.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeUserMenu();

                const section =
                    $("#favorites-section");

                if (section) {
                    section.hidden = false;

                    section.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }
        );
    }

    const userHistory =
        $("#user-history-button");

    if (userHistory) {
        userHistory.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeUserMenu();

                const section =
                    $("#historico-section");

                if (section) {
                    section.hidden = false;

                    section.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }
        );
    }

    const profileClose =
        $("#profile-close");

    if (profileClose) {
        profileClose.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeProfile();
            }
        );
    }

    const detailsClose =
        $("#details-close");

    if (detailsClose) {
        detailsClose.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeDetails();
            }
        );
    }

    const playerClose =
        $("#player-close");

    if (playerClose) {
        playerClose.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closePlayer();
            }
        );
    }

    const categoryClose =
        $("#category-close");

    if (categoryClose) {
        categoryClose.addEventListener(
            "click",
            event => {
                event.preventDefault();
                closeCategoryModal();
            }
        );
    }

    const detailsFavorite =
        $("#details-favorite-button");

    if (detailsFavorite) {
        detailsFavorite.addEventListener(
            "click",
            event => {
                event.preventDefault();
                toggleCurrentFavorite();
            }
        );
    }

    const detailsWatch =
        $("#details-watch-button");

    if (detailsWatch) {
        detailsWatch.addEventListener(
            "click",
            async event => {
                event.preventDefault();

                if (
                    state.currentDetails
                ) {
                    await assistirConteudo(
                        state.currentDetails
                    );
                }
            }
        );
    }

    const playerFullscreen =
        $("#player-fullscreen");

    if (playerFullscreen) {
        playerFullscreen.addEventListener(
            "click",
            event => {
                event.preventDefault();

                const body =
                    $("#player-body");

                if (!body) {
                    return;
                }

                const iframe =
                    body.querySelector(
                        "iframe"
                    );

                const target =
                    iframe || body;

                if (
                    document.fullscreenElement
                ) {
                    document.exitFullscreen();
                } else if (
                    target.requestFullscreen
                ) {
                    target.requestFullscreen();
                }
            }
        );
    }

    const profileForm =
        $("#profile-form");

    if (profileForm) {
        profileForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();
                saveProfileFromForm();
            }
        );
    }

    $all(
        ".avatar-options [data-avatar]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            event => {
                event.preventDefault();

                state.selectedAvatar =
                    button.dataset.avatar ||
                    button.textContent.trim();

                $all(
                    ".avatar-options [data-avatar]"
                ).forEach(option => {
                    option.classList.toggle(
                        "selected",
                        option === button
                    );
                });
            }
        );
    });

    const heroPrev =
        $("#hero-prev");

    if (heroPrev) {
        heroPrev.addEventListener(
            "click",
            event => {
                event.preventDefault();
                changeHero(-1);
            }
        );
    }

    const heroNext =
        $("#hero-next");

    if (heroNext) {
        heroNext.addEventListener(
            "click",
            event => {
                event.preventDefault();
                changeHero(1);
            }
        );
    }

    const categoryPrev =
        $("#category-prev");

    if (categoryPrev) {
        categoryPrev.addEventListener(
            "click",
            async event => {
                event.preventDefault();
                await changeCategoryPage(-1);
            }
        );
    }

    const categoryNext =
        $("#category-next");

    if (categoryNext) {
        categoryNext.addEventListener(
            "click",
            async event => {
                event.preventDefault();
                await changeCategoryPage(1);
            }
        );
    }
}


/* =========================================================
   CLIQUE NO BACKDROP DOS MODAIS
   ========================================================= */

function setupModalBackdrops() {
    $all(
        ".modal-backdrop[data-close-modal]"
    ).forEach(backdrop => {
        backdrop.addEventListener(
            "click",
            event => {
                if (
                    event.target !==
                    backdrop
                ) {
                    return;
                }

                const type =
                    backdrop.dataset.closeModal;

                if (type === "details") {
                    closeDetails();
                }

                if (type === "player") {
                    closePlayer();
                }

                if (type === "profile") {
                    closeProfile();
                }

                if (type === "category") {
                    closeCategoryModal();
                }
            }
        );
    });
}


/* =========================================================
   TECLADO
   ========================================================= */

function setupKeyboard() {
    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Escape"
            ) {
                closeAllModals();
                closeUserMenu();
                return;
            }

            const active =
                document.activeElement;

            if (
                event.key ===
                "Enter" &&
                active &&
                active.classList.contains(
                    "movie-card"
                )
            ) {
                event.preventDefault();

                const id =
                    Number(
                        active.dataset.id
                    );

                const type =
                    active.dataset.type;

                if (id) {
                    abrirDetalhes(
                        id,
                        type
                    );
                }
            }
        }
    );
}


/* =========================================================
   FECHAR MENU CLICANDO FORA
   ========================================================= */

function setupOutsideUserMenu() {
    document.addEventListener(
        "click",
        event => {
            const menu =
                $("#user-menu");

            const button =
                $("#profile-button");

            if (!menu) {
                return;
            }

            if (
                menu.contains(
                    event.target
                )
            ) {
                return;
            }

            if (
                button &&
                button.contains(
                    event.target
                )
            ) {
                return;
            }

            closeUserMenu();
        }
    );
}


/* =========================================================
   PAUSAR HERO QUANDO O MOUSE ESTÁ SOBRE ELE
   ========================================================= */

function setupHeroHover() {
    const slider =
        $("#hero-slider");

    if (!slider) {
        return;
    }

    slider.addEventListener(
        "mouseenter",
        () => {
            stopHeroTimer();
        }
    );

    slider.addEventListener(
        "mouseleave",
        () => {
            startHeroTimer();
        }
    );
}


/* =========================================================
   ERROS GLOBAIS DE IMAGEM
   ========================================================= */

function setupImageFallback() {
    document.addEventListener(
        "error",
        event => {
            const image =
                event.target;

            if (
                !image ||
                image.tagName !==
                    "IMG"
            ) {
                return;
            }

            if (
                image.dataset.fallbackApplied
            ) {
                return;
            }

            image.dataset.fallbackApplied =
                "true";

            if (
                image.classList.contains(
                    "movie-card-poster"
                )
            ) {
                image.style.display =
                    "none";
            }
        },
        true
    );
}


/* =========================================================
   PÁGINAS FAVORITOS / HISTÓRICO
   ========================================================= */

function renderStandaloneFavorites() {
    const possibleRows = [
        "#favorites-row",
        "#favoritos-row",
        "#movies-row",
        "#content-row"
    ];

    const favorites =
        getFavorites();

    for (const selector of possibleRows) {
        const row = $(selector);

        if (!row) {
            continue;
        }

        if (
            selector ===
            "#favorites-row"
        ) {
            renderRow(
                selector,
                favorites,
                "Você ainda não possui favoritos."
            );

            return;
        }
    }
}

function renderStandaloneHistory() {
    const possibleRows = [
        "#history-row",
        "#historico-row",
        "#movies-row",
        "#content-row"
    ];

    const history =
        getHistory();

    for (const selector of possibleRows) {
        const row = $(selector);

        if (!row) {
            continue;
        }

        if (
            selector ===
            "#history-row"
        ) {
            renderRow(
                selector,
                history,
                "Seu histórico está vazio."
            );

            return;
        }
    }
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initCineFamily() {
    try {
        updateProfileUI();

        setupNavigation();
        setupRowNavigation();
        setupGlobalClickHandler();
        setupInterfaceButtons();
        setupModalBackdrops();
        setupKeyboard();
        setupOutsideUserMenu();
        setupHeroHover();
        setupImageFallback();

        renderFavoritesIfNeeded();
        renderHistoryIfNeeded();
        renderContinueWatching();
        renderRecommended();

        const empty =
            $("#empty-state");

        if (empty) {
            empty.hidden = true;
        }

        await carregarHome();

    } catch (error) {
        console.error(
            "Erro na inicialização do CineFamily:",
            error
        );

        setLoading(false);

        showToast(
            "O CineFamily encontrou um erro ao iniciar.",
            "error"
        );
    }
}


/* =========================================================
   GARANTIR UMA ÚNICA INICIALIZAÇÃO
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initCineFamily,
        {
            once: true
        }
    );
} else {
    initCineFamily();
}
