"use strict";

/* =========================================================
   CINEFAMILY - SCRIPT.JS
   PARTE 1/4
   ========================================================= */

const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";

const STORAGE_KEYS = {
  favorites: "cinefamily_favoritos",
  history: "cinefamily_historico",
  profile: "cinefamily_perfil"
};

const appState = {
  initialized: false,
  currentPage: "home",
  currentSection: "home",
  currentDetails: null,
  currentPlayer: null,
  currentHero: 0,
  heroTimer: null,
  searchTimer: null,
  heroItems: [],
  popularMovies: [],
  popularSeries: [],
  latestMovies: [],
  latestSeries: [],
  doramas: [],
  gl: [],
  kids: [],
  favorites: [],
  history: [],
  searchResults: [],
  catalog: new Map()
};

/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
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

function normalizeType(type) {
  return type === "tv" || type === "series" ? "tv" : "movie";
}

function itemKey(id, type) {
  return `${normalizeType(type)}-${Number(id)}`;
}

function registerItem(item) {
  if (!item || item.id === undefined || item.id === null) {
    return;
  }

  const normalized = {
    ...item,
    id: Number(item.id),
    type: normalizeType(item.type)
  };

  appState.catalog.set(
    itemKey(normalized.id, normalized.type),
    normalized
  );
}

function registerItems(items) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach(registerItem);
}

function getItemFromCatalog(id, type) {
  return appState.catalog.get(itemKey(id, type)) || null;
}

function getTitle(item) {
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

function getYear(item) {
  if (!item) {
    return "";
  }

  const date =
    item.release_date ||
    item.first_air_date ||
    item.air_date ||
    "";

  if (!date) {
    return "";
  }

  return String(date).slice(0, 4);
}

function getPoster(item) {
  if (!item) {
    return "";
  }

  return (
    item.poster_url ||
    item.poster_path ||
    item.poster ||
    item.image ||
    item.thumbnail ||
    ""
  );
}

function getBackdrop(item) {
  if (!item) {
    return "";
  }

  return (
    item.backdrop_url ||
    item.backdrop_path ||
    item.backdrop ||
    item.poster_url ||
    item.poster_path ||
    getPoster(item) ||
    ""
  );
}

function isAdult(item) {
  return item && item.adult === true;
}

function isValidItem(item) {
  return Boolean(
    item &&
    item.id !== undefined &&
    item.id !== null &&
    !isAdult(item)
  );
}

function removeDuplicateItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  items.forEach(item => {
    if (!isValidItem(item)) {
      return;
    }

    const key = itemKey(item.id, item.type);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(item);
  });

  return result;
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("pt-BR").format(number);
}

function formatRating(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "N/A";
  }

  return number.toFixed(1);
}

function formatRuntime(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (hours > 0 && remaining > 0) {
    return `${hours}h ${remaining}min`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remaining}min`;
}

function getRuntime(data) {
  if (!data) {
    return "";
  }

  if (data.runtime) {
    return formatRuntime(data.runtime);
  }

  if (
    Array.isArray(data.episode_run_time) &&
    data.episode_run_time.length > 0
  ) {
    return formatRuntime(data.episode_run_time[0]);
  }

  return "";
}

function getMediaTypeLabel(type) {
  return normalizeType(type) === "tv" ? "Série" : "Filme";
}

function createFallbackImage(element) {
  if (!element) {
    return;
  }

  element.onerror = null;
  element.src =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
        <rect width="600" height="900" fill="#111"/>
        <text x="300" y="430" text-anchor="middle" fill="#d4af37" font-size="34" font-family="Arial">CineFamily</text>
        <text x="300" y="480" text-anchor="middle" fill="#aaa" font-size="20" font-family="Arial">Imagem indisponível</text>
      </svg>`
    );
}

function safeImageUrl(url) {
  if (!url) {
    return "";
  }

  return String(url).trim();
}

/* =========================================================
   STORAGE
   ========================================================= */

function getStorageArray(key) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler armazenamento:", error);
    return [];
  }
}

function setStorageArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Erro ao salvar armazenamento:", error);
  }
}

function getProfile() {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.profile);

    if (!value) {
      return {
        name: "Família",
        avatar: "👤"
      };
    }

    const parsed = JSON.parse(value);

    return {
      name: parsed.name || "Família",
      avatar: parsed.avatar || "👤"
    };
  } catch (error) {
    return {
      name: "Família",
      avatar: "👤"
    };
  }
}

function saveProfile(profile) {
  const data = {
    name: profile.name || "Família",
    avatar: profile.avatar || "👤"
  };

  try {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify(data)
    );
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
  }

  renderProfile();
}

/* =========================================================
   FAVORITOS
   ========================================================= */

function getFavorites() {
  const favorites = getStorageArray(STORAGE_KEYS.favorites);

  appState.favorites = removeDuplicateItems(favorites);
  registerItems(appState.favorites);

  return appState.favorites;
}

function saveFavorites(favorites) {
  appState.favorites = removeDuplicateItems(favorites);

  registerItems(appState.favorites);

  setStorageArray(
    STORAGE_KEYS.favorites,
    appState.favorites
  );
}

function isFavorite(id, type) {
  const normalizedType = normalizeType(type);

  return appState.favorites.some(item => {
    return (
      Number(item.id) === Number(id) &&
      normalizeType(item.type) === normalizedType
    );
  });
}

function findFavorite(id, type) {
  const normalizedType = normalizeType(type);

  return (
    appState.favorites.find(item => {
      return (
        Number(item.id) === Number(id) &&
        normalizeType(item.type) === normalizedType
      );
    }) || null
  );
}

function toggleFavorite(item) {
  if (!item || item.id === undefined) {
    return;
  }

  const normalized = {
    ...item,
    id: Number(item.id),
    type: normalizeType(item.type),
    title: getTitle(item),
    poster_path: getPoster(item),
    backdrop_path: getBackdrop(item),
    release_date: item.release_date || "",
    first_air_date: item.first_air_date || "",
    vote_average: item.vote_average || 0
  };

  registerItem(normalized);

  const favorites = getFavorites();

  const index = favorites.findIndex(favorite => {
    return (
      Number(favorite.id) === Number(normalized.id) &&
      normalizeType(favorite.type) === normalized.type
    );
  });

  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.unshift(normalized);
  }

  saveFavorites(favorites);
  refreshFavoriteVisuals();
  renderFavoritesRow();

  const currentPage = detectCurrentPage();

  if (currentPage === "favorites") {
    renderFavoritesPage();
  }
}

function removeFavoriteItem(id, type) {
  const normalizedType = normalizeType(type);

  const favorites = getFavorites().filter(item => {
    return !(
      Number(item.id) === Number(id) &&
      normalizeType(item.type) === normalizedType
    );
  });

  saveFavorites(favorites);
  refreshFavoriteVisuals();
  renderFavoritesRow();

  if (detectCurrentPage() === "favorites") {
    renderFavoritesPage();
  }
}

/* =========================================================
   HISTÓRICO
   ========================================================= */

function getHistory() {
  const history = getStorageArray(STORAGE_KEYS.history);

  appState.history = removeDuplicateItems(history);
  registerItems(appState.history);

  return appState.history;
}

function saveHistory(history) {
  appState.history = removeDuplicateItems(history).slice(0, 50);

  registerItems(appState.history);

  setStorageArray(
    STORAGE_KEYS.history,
    appState.history
  );
}

function addToHistory(item) {
  if (!item || item.id === undefined) {
    return;
  }

  const normalized = {
    ...item,
    id: Number(item.id),
    type: normalizeType(item.type),
    title: getTitle(item),
    poster_path: getPoster(item),
    backdrop_path: getBackdrop(item),
    release_date: item.release_date || "",
    first_air_date: item.first_air_date || "",
    vote_average: item.vote_average || 0
  };

  registerItem(normalized);

  let history = getHistory();

  history = history.filter(historyItem => {
    return !(
      Number(historyItem.id) === Number(normalized.id) &&
      normalizeType(historyItem.type) === normalized.type
    );
  });

  history.unshift(normalized);

  saveHistory(history);
  renderContinueRow();
}

function removeHistoryItem(id, type) {
  const normalizedType = normalizeType(type);

  const history = getHistory().filter(item => {
    return !(
      Number(item.id) === Number(id) &&
      normalizeType(item.type) === normalizedType
    );
  });

  saveHistory(history);
  renderContinueRow();

  if (detectCurrentPage() === "history") {
    renderHistoryPage();
  }
}

function clearHistory() {
  saveHistory([]);
  renderContinueRow();

  if (detectCurrentPage() === "history") {
    renderHistoryPage();
  }
}

/* =========================================================
   BUSCA NO CATÁLOGO LOCAL
   ========================================================= */

function findItemByIdAndType(id, type) {
  const normalizedType = normalizeType(type);

  const catalogItem = getItemFromCatalog(id, normalizedType);

  if (catalogItem) {
    return catalogItem;
  }

  const collections = [
    appState.heroItems,
    appState.popularMovies,
    appState.popularSeries,
    appState.latestMovies,
    appState.latestSeries,
    appState.doramas,
    appState.gl,
    appState.kids,
    appState.favorites,
    appState.history,
    appState.searchResults
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    const found = collection.find(item => {
      return (
        Number(item.id) === Number(id) &&
        normalizeType(item.type) === normalizedType
      );
    });

    if (found) {
      registerItem(found);
      return found;
    }
  }

  return null;
}

/* =========================================================
   API DO WORKER
   ========================================================= */

async function workerFetch(path, options = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");

  const url = `${TMDB_WORKER}/${cleanPath}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });

  if (!response.ok) {
    throw new Error(
      `Worker respondeu com HTTP ${response.status}`
    );
  }

  const data = await response.json();

  return data;
}

async function fetchJSON(path) {
  return workerFetch(path);
}

function extractResults(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function normalizeResults(items, type) {
  if (!Array.isArray(items)) {
    return [];
  }

  return removeDuplicateItems(
    items.map(item => ({
      ...item,
      id: Number(item.id),
      type: normalizeType(item.type || type),
      title: getTitle(item)
    }))
  );
}

/* =========================================================
   CARREGAMENTO GENÉRICO
   ========================================================= */

async function loadEndpoint(path, type = null) {
  try {
    const data = await fetchJSON(path);
    const results = extractResults(data);

    return normalizeResults(results, type);
  } catch (error) {
    console.error(
      `Erro ao carregar ${path}:`,
      error
    );

    return [];
  }
}

async function loadHome() {
  showLoadingState();

  try {
    const [
      movies,
      series,
      latestMovies,
      latestSeries,
      doramas,
      gl,
      kids
    ] = await Promise.all([
      loadEndpoint(
        "api/discover/movie?sort_by=popularity.desc&page=1",
        "movie"
      ),
      loadEndpoint(
        "api/discover/tv?sort_by=popularity.desc&page=1",
        "tv"
      ),
      loadEndpoint(
        "api/movies?sort_by=release_date.desc&page=1",
        "movie"
      ),
      loadEndpoint(
        "api/series?sort_by=first_air_date.desc&page=1",
        "tv"
      ),
      loadEndpoint(
        "api/series?original_language=ko&sort_by=popularity.desc&page=1",
        "tv"
      ),
      loadEndpoint(
        "api/series?query=girls%20love&page=1",
        "tv"
      ),
      loadEndpoint(
        "api/discover/movie?genre=16&sort_by=popularity.desc&page=1",
        "movie"
      )
    ]);

    appState.popularMovies = movies.filter(
      item => normalizeType(item.type) === "movie"
    );

    appState.popularSeries = series.filter(
      item => normalizeType(item.type) === "tv"
    );

    appState.latestMovies = latestMovies.filter(
      item => normalizeType(item.type) === "movie"
    );

    appState.latestSeries = latestSeries.filter(
      item => normalizeType(item.type) === "tv"
    );

    appState.doramas = doramas.filter(item => {
      return (
        normalizeType(item.type) === "tv" &&
        (
          item.original_language === "ko" ||
          item.language === "ko"
        ) &&
        !isAdult(item)
      );
    });

    appState.gl = gl.filter(item => {
      return (
        normalizeType(item.type) === "tv" &&
        !isAdult(item)
      );
    });

    appState.kids = kids.filter(item => {
      return (
        !isAdult(item) &&
        (
          item.genre_ids?.includes(16) ||
          item.genre_id === 16
        )
      );
    });

    registerItems(appState.popularMovies);
    registerItems(appState.popularSeries);
    registerItems(appState.latestMovies);
    registerItems(appState.latestSeries);
    registerItems(appState.doramas);
    registerItems(appState.gl);
    registerItems(appState.kids);

    appState.heroItems = buildHeroItems();

    registerItems(appState.heroItems);

    renderHero();
    renderHomeRows();

    hideLoadingState();
  } catch (error) {
    console.error(
      "Erro ao carregar página inicial:",
      error
    );

    hideLoadingState();
    showGlobalMessage(
      "Não foi possível carregar os conteúdos agora."
    );
  }
}

function buildHeroItems() {
  const source = [
    ...appState.popularMovies.slice(0, 4),
    ...appState.popularSeries.slice(0, 4),
    ...appState.latestMovies.slice(0, 3),
    ...appState.latestSeries.slice(0, 3)
  ];

  return removeDuplicateItems(source)
    .filter(item => {
      return (
        !isAdult(item) &&
        Boolean(getBackdrop(item) || getPoster(item))
      );
    })
    .slice(0, 4);
}
/* =========================================================
   RENDERIZAÇÃO DOS CARDS
   ========================================================= */

function createContentCard(item, options = {}) {
  if (!isValidItem(item)) {
    return "";
  }

  registerItem(item);

  const id = Number(item.id);
  const type = normalizeType(item.type);
  const title = getTitle(item);
  const poster = safeImageUrl(getPoster(item));
  const year = getYear(item);
  const rating = formatRating(item.vote_average);
  const favorite = isFavorite(id, type);

  const removableFavorite = options.removableFavorite === true;
  const removableHistory = options.removableHistory === true;

  const favoriteAction = removableFavorite
    ? "remove-favorite"
    : "favorite";

  const favoriteIcon = removableFavorite
    ? "✕"
    : favorite
      ? "★"
      : "☆";

  const favoriteLabel = removableFavorite
    ? "Remover dos favoritos"
    : favorite
      ? "Remover dos favoritos"
      : "Adicionar aos favoritos";

  const historyButton = removableHistory
    ? `
      <button
        class="content-card-action history-remove"
        type="button"
        data-action="remove-history"
        data-media-id="${id}"
        data-media-type="${type}"
        aria-label="Remover do histórico"
        title="Remover do histórico"
      >✕</button>
    `
    : "";

  return `
    <article
      class="content-card"
      data-media-id="${id}"
      data-media-type="${type}"
      tabindex="0"
      role="button"
      aria-label="Abrir ${escapeHTML(title)}"
    >
      <div class="content-card-poster">
        ${
          poster
            ? `
              <img
                class="content-card-image"
                src="${escapeHTML(poster)}"
                alt="${escapeHTML(title)}"
                loading="lazy"
              >
            `
            : `
              <div class="content-card-image content-card-placeholder">
                <span>CineFamily</span>
              </div>
            `
        }

        <div class="content-card-gradient"></div>

        <div class="content-card-top-actions">
          <button
            class="content-card-action favorite-action"
            type="button"
            data-action="${favoriteAction}"
            data-media-id="${id}"
            data-media-type="${type}"
            aria-label="${escapeHTML(favoriteLabel)}"
            title="${escapeHTML(favoriteLabel)}"
          >${favoriteIcon}</button>

          ${historyButton}
        </div>

        <div class="content-card-overlay">
          <button
            class="content-card-watch"
            type="button"
            data-action="watch"
            data-media-id="${id}"
            data-media-type="${type}"
          >
            ▶ Assistir
          </button>
        </div>

        <div class="content-card-info">
          <h3 class="content-card-title">
            ${escapeHTML(title)}
          </h3>

          <div class="content-card-meta">
            ${
              year
                ? `<span>${escapeHTML(year)}</span>`
                : ""
            }

            ${
              rating !== "N/A"
                ? `<span>★ ${escapeHTML(rating)}</span>`
                : ""
            }

            <span>${escapeHTML(getMediaTypeLabel(type))}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function createHeroSlide(item, index) {
  if (!isValidItem(item)) {
    return "";
  }

  registerItem(item);

  const id = Number(item.id);
  const type = normalizeType(item.type);
  const title = getTitle(item);
  const backdrop = safeImageUrl(getBackdrop(item));
  const year = getYear(item);
  const rating = formatRating(item.vote_average);

  const overview =
    item.overview ||
    item.description ||
    "Confira este conteúdo no CineFamily.";

  const favorite = isFavorite(id, type);

  return `
    <article
      class="hero-slide ${index === 0 ? "active" : ""}"
      data-hero-index="${index}"
      data-media-id="${id}"
      data-media-type="${type}"
      style="${
        backdrop
          ? `background-image: url("${escapeHTML(backdrop)}");`
          : ""
      }"
    >
      <div class="hero-overlay"></div>

      <div class="hero-content">
        <span class="hero-badge">
          ${escapeHTML(getMediaTypeLabel(type))}
        </span>

        <h1 class="hero-title">
          ${escapeHTML(title)}
        </h1>

        <div class="hero-meta">
          ${
            year
              ? `<span>${escapeHTML(year)}</span>`
              : ""
          }

          ${
            rating !== "N/A"
              ? `<span>★ ${escapeHTML(rating)}</span>`
              : ""
          }
        </div>

        <p class="hero-description">
          ${escapeHTML(overview)}
        </p>

        <div class="hero-actions">
          <button
            class="hero-watch-button"
            type="button"
            data-action="watch"
            data-media-id="${id}"
            data-media-type="${type}"
          >
            ▶ Assistir agora
          </button>

          <button
            class="hero-details-button"
            type="button"
            data-action="details"
            data-media-id="${id}"
            data-media-type="${type}"
          >
            ⓘ Detalhes
          </button>

          <button
            class="hero-favorite-button"
            type="button"
            data-action="favorite"
            data-media-id="${id}"
            data-media-type="${type}"
            aria-label="${
              favorite
                ? "Remover dos favoritos"
                : "Adicionar aos favoritos"
            }"
          >
            ${favorite ? "★" : "☆"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderHero() {
  const hero = qs("#hero");

  if (!hero) {
    return;
  }

  const items = appState.heroItems
    .filter(isValidItem)
    .slice(0, 4);

  if (!items.length) {
    hero.innerHTML = `
      <div class="hero-empty">
        <h2>Bem-vindo ao CineFamily</h2>
        <p>Carregando seus conteúdos...</p>
      </div>
    `;

    return;
  }

  registerItems(items);

  appState.heroItems = items;
  appState.currentHero = 0;

  hero.innerHTML = `
    <div class="hero-slides">
      ${items.map(createHeroSlide).join("")}
    </div>

    <button
      class="hero-control hero-prev"
      type="button"
      data-hero-control="prev"
      aria-label="Anterior"
    >
      ‹
    </button>

    <button
      class="hero-control hero-next"
      type="button"
      data-hero-control="next"
      aria-label="Próximo"
    >
      ›
    </button>

    <div class="hero-indicators">
      ${items
        .map(
          (_, index) => `
            <button
              class="hero-indicator ${
                index === 0 ? "active" : ""
              }"
              type="button"
              data-hero-indicator="${index}"
              aria-label="Ir para destaque ${index + 1}"
            ></button>
          `
        )
        .join("")}
    </div>
  `;

  setHeroSlide(0);
  startHeroAutoPlay();
}

function setHeroSlide(index) {
  const slides = qsa(".hero-slide");

  if (!slides.length) {
    return;
  }

  if (index < 0) {
    index = slides.length - 1;
  }

  if (index >= slides.length) {
    index = 0;
  }

  appState.currentHero = index;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle(
      "active",
      slideIndex === index
    );
  });

  const indicators = qsa(".hero-indicator");

  indicators.forEach((indicator, indicatorIndex) => {
    indicator.classList.toggle(
      "active",
      indicatorIndex === index
    );
  });
}

function nextHero() {
  const slides = qsa(".hero-slide");

  if (!slides.length) {
    return;
  }

  setHeroSlide(appState.currentHero + 1);
}

function previousHero() {
  const slides = qsa(".hero-slide");

  if (!slides.length) {
    return;
  }

  setHeroSlide(appState.currentHero - 1);
}

function startHeroAutoPlay() {
  stopHeroAutoPlay();

  if (appState.heroItems.length <= 1) {
    return;
  }

  appState.heroTimer = setInterval(() => {
    nextHero();
  }, 7000);
}

function stopHeroAutoPlay() {
  if (appState.heroTimer) {
    clearInterval(appState.heroTimer);
    appState.heroTimer = null;
  }
}

function renderRow(container, items, options = {}) {
  if (!container) {
    return;
  }

  const validItems = removeDuplicateItems(
    Array.isArray(items) ? items : []
  );

  registerItems(validItems);

  if (!validItems.length) {
    container.innerHTML = `
      <div class="empty-row">
        Nenhum conteúdo disponível no momento.
      </div>
    `;

    return;
  }

  container.innerHTML = validItems
    .map(item =>
      createContentCard(item, options)
    )
    .join("");
}

function renderHomeRows() {
  renderSectionByPossibleSelectors(
    [
      "#filmes-lista",
      "#movies-list",
      "#filmes-container",
      "#movies-container"
    ],
    appState.popularMovies
  );

  renderSectionByPossibleSelectors(
    [
      "#series-lista",
      "#series-list",
      "#series-container",
      "#tv-series-container"
    ],
    appState.popularSeries
  );

  renderSectionByPossibleSelectors(
    [
      "#lancamentos-filmes",
      "#latest-movies-list",
      "#latest-movies-container"
    ],
    appState.latestMovies
  );

  renderSectionByPossibleSelectors(
    [
      "#lancamentos-series",
      "#latest-series-list",
      "#latest-series-container"
    ],
    appState.latestSeries
  );

  renderSectionByPossibleSelectors(
    [
      "#doramas-lista",
      "#doramas-list",
      "#doramas-container"
    ],
    appState.doramas
  );

  renderSectionByPossibleSelectors(
    [
      "#gl-lista",
      "#gl-list",
      "#gl-container"
    ],
    appState.gl
  );

  renderSectionByPossibleSelectors(
    [
      "#kids-lista",
      "#kids-list",
      "#kids-container"
    ],
    appState.kids
  );

  renderFavoritesRow();
  renderContinueRow();
}

function renderSectionByPossibleSelectors(
  selectors,
  items
) {
  for (const selector of selectors) {
    const container = qs(selector);

    if (container) {
      renderRow(container, items);
      return;
    }
  }
}

function renderFavoritesRow() {
  const favorites = getFavorites();

  const selectors = [
    "#favoritos-lista",
    "#favorites-list",
    "#favorites-container",
    "#home-favorites-list"
  ];

  for (const selector of selectors) {
    const container = qs(selector);

    if (container) {
      renderRow(container, favorites, {
        removableFavorite: true
      });
      return;
    }
  }
}

function renderContinueRow() {
  const history = getHistory();

  const selectors = [
    "#continuar-lista",
    "#continue-list",
    "#continue-container",
    "#historico-lista-home",
    "#home-history-list"
  ];

  for (const selector of selectors) {
    const container = qs(selector);

    if (container) {
      renderRow(container, history, {
        removableHistory: true
      });
      return;
    }
  }
}

/* =========================================================
   BUSCA
   ========================================================= */

async function searchContent(query) {
  const term = String(query || "").trim();

  if (term.length < 2) {
    appState.searchResults = [];
    clearSearchResults();
    return;
  }

  showSearchLoading();

  try {
    const encoded = encodeURIComponent(term);

    const data = await fetchJSON(
      `api/search?query=${encoded}&page=1`
    );

    let results = extractResults(data);

    results = results
      .map(item => ({
        ...item,
        title: getTitle(item),
        id: Number(item.id),
        type: normalizeType(item.type)
      }))
      .filter(item => !isAdult(item));

    appState.searchResults =
      removeDuplicateItems(results);

    registerItems(appState.searchResults);

    renderSearchResults(appState.searchResults);
  } catch (error) {
    console.error("Erro na busca:", error);

    appState.searchResults = [];

    renderSearchResults([]);
  }
}

function realizarBusca(query) {
  clearTimeout(appState.searchTimer);

  appState.searchTimer = setTimeout(() => {
    searchContent(query);
  }, 350);
}

function renderSearchResults(items) {
  const container =
    qs("#search-results") ||
    qs("#resultados-busca") ||
    qs("#search-container");

  if (!container) {
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="search-empty">
        <div class="search-empty-icon">🔎</div>
        <h3>Nenhum resultado encontrado</h3>
        <p>Tente pesquisar por outro título.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="search-results-grid">
      ${items.map(item =>
        createContentCard(item)
      ).join("")}
    </div>
  `;
}

function clearSearchResults() {
  const container =
    qs("#search-results") ||
    qs("#resultados-busca") ||
    qs("#search-container");

  if (!container) {
    return;
  }

  container.innerHTML = "";
}

function showSearchLoading() {
  const container =
    qs("#search-results") ||
    qs("#resultados-busca") ||
    qs("#search-container");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="search-loading">
      <div class="loading-spinner"></div>
      <p>Pesquisando...</p>
    </div>
  `;
}

function setupSearch() {
  const inputs = qsa(
    "#search-input, #search, .search-input, [data-search-input]"
  );

  inputs.forEach(input => {
    input.addEventListener("input", event => {
      realizarBusca(event.target.value);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();

        searchContent(event.target.value);
      }

      if (event.key === "Escape") {
        event.target.value = "";
        clearSearchResults();
      }
    });
  });
}

/* =========================================================
   MODAL DE DETALHES
   ========================================================= */

function getDetailsModal() {
  return (
    qs("#details-modal") ||
    qs("#modal-detalhes") ||
    qs("#movie-modal")
  );
}

function openDetails(id, type) {
  const numericId = Number(id);

  if (!numericId) {
    return;
  }

  const normalizedType = normalizeType(type);

  const item = findItemByIdAndType(
    numericId,
    normalizedType
  );

  appState.currentDetails = item || {
    id: numericId,
    type: normalizedType
  };

  const modal = getDetailsModal();

  if (!modal) {
    console.warn(
      "Modal de detalhes não encontrado no HTML."
    );
    return;
  }

  modal.classList.add("active");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  showDetailsLoading(modal);

  loadDetails(numericId, normalizedType);
}

async function loadDetails(id, type) {
  try {
    const data = await fetchJSON(
      `api/${type}/${id}`
    );

    if (!data || data.adult === true) {
      throw new Error(
        "Conteúdo não disponível."
      );
    }

    const normalized = {
      ...data,
      id: Number(data.id || id),
      type: normalizeType(data.type || type),
      title: getTitle(data)
    };

    registerItem(normalized);

    appState.currentDetails = normalized;

    renderDetails(normalized);
    loadDetailsTrailer(normalized);

    addToHistory(normalized);
  } catch (error) {
    console.error(
      "Erro ao carregar detalhes:",
      error
    );

    renderDetailsError();
  }
}

function showDetailsLoading(modal) {
  const content =
    qs(".details-content", modal) ||
    qs(".details-body", modal) ||
    qs(".modal-content", modal);

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="details-loading">
      <div class="loading-spinner"></div>
      <p>Carregando informações...</p>
    </div>
  `;
}

function renderDetailsError() {
  const modal = getDetailsModal();

  if (!modal) {
    return;
  }

  const content =
    qs(".details-content", modal) ||
    qs(".details-body", modal) ||
    qs(".modal-content", modal);

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="details-error">
      <div class="details-error-icon">⚠</div>
      <h2>Não foi possível carregar</h2>
      <p>Verifique sua conexão e tente novamente.</p>

      <button
        type="button"
        class="details-close-button"
        data-action="close-details"
      >
        Fechar
      </button>
    </div>
  `;
}

function renderDetails(data) {
  const modal = getDetailsModal();

  if (!modal) {
    return;
  }

  const content =
    qs(".details-content", modal) ||
    qs(".details-body", modal) ||
    qs(".modal-content", modal);

  if (!content) {
    return;
  }

  const id = Number(data.id);
  const type = normalizeType(data.type);
  const title = getTitle(data);
  const poster = safeImageUrl(getPoster(data));
  const backdrop = safeImageUrl(getBackdrop(data));
  const year = getYear(data);
  const rating = formatRating(data.vote_average);
  const runtime = getRuntime(data);

  const genres = Array.isArray(data.genres)
    ? data.genres
        .map(genre => {
          if (typeof genre === "string") {
            return genre;
          }

          return genre.name || "";
        })
        .filter(Boolean)
    : [];

  const overview =
    data.overview ||
    data.description ||
    "Sinopse não disponível.";

  const favorite = isFavorite(id, type);

  const cast =
    Array.isArray(data.cast)
      ? data.cast.slice(0, 8)
      : Array.isArray(data.credits?.cast)
        ? data.credits.cast.slice(0, 8)
        : [];

  content.innerHTML = `
    <div
      class="details-backdrop"
      style="${
        backdrop
          ? `background-image: url("${escapeHTML(backdrop)}");`
          : ""
      }"
    >
      <div class="details-backdrop-overlay"></div>
    </div>

    <button
      type="button"
      class="details-close-button"
      data-action="close-details"
      aria-label="Fechar"
      title="Fechar"
    >
      ×
    </button>

    <div class="details-main">
      <div class="details-poster">
        ${
          poster
            ? `
              <img
                src="${escapeHTML(poster)}"
                alt="${escapeHTML(title)}"
              >
            `
            : `
              <div class="details-poster-placeholder">
                CineFamily
              </div>
            `
        }
      </div>

      <div class="details-info">
        <span class="details-type">
          ${escapeHTML(getMediaTypeLabel(type))}
        </span>

        <h2 class="details-title">
          ${escapeHTML(title)}
        </h2>

        <div class="details-meta">
          ${
            year
              ? `<span>${escapeHTML(year)}</span>`
              : ""
          }

          ${
            rating !== "N/A"
              ? `<span>★ ${escapeHTML(rating)}</span>`
              : ""
          }

          ${
            runtime
              ? `<span>${escapeHTML(runtime)}</span>`
              : ""
          }
        </div>

        ${
          genres.length
            ? `
              <div class="details-genres">
                ${genres
                  .map(
                    genre =>
                      `<span>${escapeHTML(
                        genre
                      )}</span>`
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        <p class="details-overview">
          ${escapeHTML(overview)}
        </p>

        <div class="details-actions">
          <button
            type="button"
            class="details-watch-button"
            id="details-watch-button"
            data-action="watch"
            data-media-id="${id}"
            data-media-type="${type}"
          >
            ▶ Assistir
          </button>

          <button
            type="button"
            class="details-favorite-button"
            data-action="favorite"
            data-media-id="${id}"
            data-media-type="${type}"
          >
            ${
              favorite
                ? "★ Remover dos favoritos"
                : "☆ Adicionar aos favoritos"
            }
          </button>
        </div>
      </div>
    </div>

    ${
      cast.length
        ? `
          <section class="details-cast">
            <h3>Elenco</h3>

            <div class="cast-list">
              ${cast
                .map(person => {
                  const personName =
                    person.name || "Ator";

                  const character =
                    person.character || "";

                  const profile =
                    person.profile_path ||
                    person.profile_url ||
                    "";

                  return `
                    <div class="cast-item">
                      ${
                        profile
                          ? `
                            <img
                              src="${escapeHTML(
                                profile
                              )}"
                              alt="${escapeHTML(
                                personName
                              )}"
                              loading="lazy"
                            >
                          `
                          : `
                            <div class="cast-placeholder">
                              👤
                            </div>
                          `
                      }

                      <strong>
                        ${escapeHTML(personName)}
                      </strong>

                      ${
                        character
                          ? `
                            <span>
                              ${escapeHTML(
                                character
                              )}
                            </span>
                          `
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
        `
        : ""
    }

    <div class="details-trailer-container"></div>
  `;

  setupDetailsImageFallbacks();
}

function setupDetailsImageFallbacks() {
  const modal = getDetailsModal();

  if (!modal) {
    return;
  }

  qsa("img", modal).forEach(image => {
    image.addEventListener(
      "error",
      () => {
        createFallbackImage(image);
      },
      {
        once: true
      }
    );
  });
}

function closeDetails() {
  const modal = getDetailsModal();

  if (!modal) {
    return;
  }

  modal.classList.remove("active");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  const trailer = qs(
    ".details-trailer",
    modal
  );

  if (trailer) {
    trailer.remove();
  }

  appState.currentDetails = null;
}

/* =========================================================
   TRAILER
   ========================================================= */

async function loadDetailsTrailer(data) {
  if (!data) {
    return;
  }

  try {
    const type = normalizeType(data.type);
    const id = Number(data.id);

    const response = await fetchJSON(
      `api/${type}/${id}/videos`
    );

    const videos = extractResults(response);

    const trailer =
      videos.find(video => {
        return (
          video.site === "YouTube" &&
          (
            String(video.type).toLowerCase() ===
              "trailer" ||
            String(video.type).toLowerCase() ===
              "teaser"
          ) &&
          video.key
        );
      }) ||
      videos.find(video => {
        return (
          video.site === "YouTube" &&
          video.key
        );
      });

    if (trailer) {
      renderDetailsTrailer(trailer);
    }
  } catch (error) {
    console.warn(
      "Trailer não disponível:",
      error
    );
  }
}

function renderDetailsTrailer(video) {
  const modal = getDetailsModal();

  if (!modal || !video || !video.key) {
    return;
  }

  const container =
    qs(".details-trailer-container", modal) ||
    qs(".details-content", modal) ||
    qs(".details-body", modal);

  if (!container) {
    return;
  }

  const oldTrailer =
    qs(".details-trailer", modal);

  if (oldTrailer) {
    oldTrailer.remove();
  }

  const trailer = document.createElement("section");

  trailer.className = "details-trailer";

  trailer.innerHTML = `
    <div class="details-trailer-header">
      <h3>Trailer</h3>
    </div>

    <div class="details-trailer-video">
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(
          video.key
        )}"
        title="Trailer"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>
  `;

  container.appendChild(trailer);
}

/* =========================================================
   MENSAGENS E LOADING
   ========================================================= */

function showLoadingState() {
  qsa(
    ".home-loading, #home-loading, [data-home-loading]"
  ).forEach(element => {
    element.classList.add("active");
    element.style.display = "";
  });
}

function hideLoadingState() {
  qsa(
    ".home-loading, #home-loading, [data-home-loading]"
  ).forEach(element => {
    element.classList.remove("active");
    element.style.display = "none";
  });
}

function showGlobalMessage(message) {
  let element = qs("#cinefamily-message");

  if (!element) {
    element = document.createElement("div");
    element.id = "cinefamily-message";
    element.className = "cinefamily-message";

    document.body.appendChild(element);
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(
    element._hideTimer
  );

  element._hideTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3500);
}
/* =========================================================
   PLAYER
   ========================================================= */

function getPlayerModal() {
  return (
    qs("#player-modal") ||
    qs("#video-modal") ||
    qs("#modal-player")
  );
}

function openPlayer(item) {
  if (!item || item.id === undefined) {
    return;
  }

  const normalized = {
    ...item,
    id: Number(item.id),
    type: normalizeType(item.type),
    title: getTitle(item)
  };

  registerItem(normalized);

  appState.currentPlayer = normalized;

  const modal = getPlayerModal();

  if (!modal) {
    showGlobalMessage(
      "Player não encontrado no HTML."
    );
    return;
  }

  const content =
    qs(".player-content", modal) ||
    qs(".video-content", modal) ||
    qs(".modal-content", modal);

  if (!content) {
    return;
  }

  modal.classList.add("active");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  renderPlayerContent(content, normalized);
}

function renderPlayerContent(container, item) {
  const title = getTitle(item);

  const trailerKey =
    item.trailer_key ||
    item.youtube_key ||
    item.video_key ||
    "";

  if (trailerKey) {
    renderYouTubePlayer(
      container,
      trailerKey,
      title
    );

    return;
  }

  container.innerHTML = `
    <div class="player-unavailable">
      <div class="player-unavailable-icon">▶</div>

      <h2>Reprodução não disponível</h2>

      <p>
        Não encontramos um vídeo autorizado para
        este conteúdo.
      </p>

      <p class="player-note">
        O CineFamily não fornece links de reprodução
        não autorizados.
      </p>

      <button
        type="button"
        class="player-close-button"
        data-action="close-player"
      >
        Fechar
      </button>
    </div>
  `;
}

function renderYouTubePlayer(
  container,
  key,
  title
) {
  container.innerHTML = `
    <div class="player-header">
      <h2>${escapeHTML(title)}</h2>

      <button
        type="button"
        class="player-close-button"
        data-action="close-player"
        aria-label="Fechar player"
      >
        ×
      </button>
    </div>

    <div class="player-video-wrapper">
      <iframe
        class="player-video"
        src="https://www.youtube.com/embed/${encodeURIComponent(
          key
        )}?autoplay=1&rel=0"
        title="${escapeHTML(title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>
  `;
}

function closePlayer() {
  const modal = getPlayerModal();

  if (!modal) {
    return;
  }

  const iframe = qs(
    "iframe",
    modal
  );

  if (iframe) {
    iframe.src = "about:blank";
  }

  modal.classList.remove("active");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  appState.currentPlayer = null;
}

function setupPlayerFullscreen() {
  const modal = getPlayerModal();

  if (!modal) {
    return;
  }

  modal.addEventListener(
    "dblclick",
    event => {
      const videoWrapper =
        event.target.closest(
          ".player-video-wrapper"
        );

      if (!videoWrapper) {
        return;
      }

      if (!document.fullscreenElement) {
        if (
          videoWrapper.requestFullscreen
        ) {
          videoWrapper.requestFullscreen();
        }
      } else if (
        document.exitFullscreen
      ) {
        document.exitFullscreen();
      }
    }
  );
}

/* =========================================================
   EPISÓDIOS E TEMPORADAS
   ========================================================= */

async function loadSeasons(id) {
  try {
    const data = await fetchJSON(
      `api/tv/${Number(id)}/seasons`
    );

    const seasons =
      Array.isArray(data)
        ? data
        : Array.isArray(data.seasons)
          ? data.seasons
          : extractResults(data);

    return seasons;
  } catch (error) {
    console.error(
      "Erro ao carregar temporadas:",
      error
    );

    return [];
  }
}

async function loadEpisodes(
  id,
  seasonNumber
) {
  try {
    const data = await fetchJSON(
      `api/tv/${Number(id)}/season/${Number(
        seasonNumber
      )}`
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.episodes)) {
      return data.episodes;
    }

    return extractResults(data);
  } catch (error) {
    console.error(
      "Erro ao carregar episódios:",
      error
    );

    return [];
  }
}

function renderSeasons(
  container,
  seasons
) {
  if (!container) {
    return;
  }

  if (!seasons.length) {
    container.innerHTML = `
      <div class="seasons-empty">
        Temporadas não disponíveis.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="season-selector">
      <label for="season-select">
        Temporada
      </label>

      <select id="season-select">
        ${seasons
          .map(season => {
            const number =
              Number(
                season.season_number
              );

            const name =
              season.name ||
              `Temporada ${number}`;

            return `
              <option value="${number}">
                ${escapeHTML(name)}
              </option>
            `;
          })
          .join("")}
      </select>
    </div>

    <div
      class="episodes-list"
      id="episodes-list"
    ></div>
  `;

  const select =
    qs("#season-select", container);

  if (select) {
    select.addEventListener(
      "change",
      async event => {
        const season =
          Number(event.target.value);

        const episodes =
          await loadEpisodes(
            appState.currentDetails.id,
            season
          );

        renderEpisodes(
          qs(
            "#episodes-list",
            container
          ),
          episodes
        );
      }
    );

    loadEpisodes(
      appState.currentDetails.id,
      Number(select.value)
    ).then(episodes => {
      renderEpisodes(
        qs(
          "#episodes-list",
          container
        ),
        episodes
      );
    });
  }
}

function renderEpisodes(
  container,
  episodes
) {
  if (!container) {
    return;
  }

  if (!Array.isArray(episodes) || !episodes.length) {
    container.innerHTML = `
      <div class="episodes-empty">
        Nenhum episódio encontrado.
      </div>
    `;

    return;
  }

  container.innerHTML = episodes
    .map(episode => {
      const number =
        Number(
          episode.episode_number
        );

      const name =
        episode.name ||
        `Episódio ${number}`;

      const overview =
        episode.overview ||
        "Sem descrição.";

      const still =
        episode.still_url ||
        episode.still_path ||
        "";

      return `
        <article
          class="episode-card"
          data-episode-number="${number}"
        >
          ${
            still
              ? `
                <img
                  src="${escapeHTML(still)}"
                  alt="${escapeHTML(name)}"
                  loading="lazy"
                >
              `
              : `
                <div class="episode-placeholder">
                  ${number}
                </div>
              `
          }

          <div class="episode-info">
            <span class="episode-number">
              Episódio ${number}
            </span>

            <h4>
              ${escapeHTML(name)}
            </h4>

            <p>
              ${escapeHTML(overview)}
            </p>

            <button
              type="button"
              data-action="episode"
              data-episode-id="${
                episode.id || ""
              }"
              data-episode-number="${number}"
            >
              ▶ Assistir
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   PERFIL
   ========================================================= */

function renderProfile() {
  const profile = getProfile();

  qsa(
    "#profile-name, [data-profile-name]"
  ).forEach(element => {
    element.textContent = profile.name;
  });

  qsa(
    "#profile-avatar, [data-profile-avatar]"
  ).forEach(element => {
    element.textContent = profile.avatar;
  });

  qsa(
    ".user-name, #user-name"
  ).forEach(element => {
    element.textContent = profile.name;
  });

  qsa(
    ".user-avatar, #user-avatar"
  ).forEach(element => {
    element.textContent = profile.avatar;
  });

  qsa(
    "[data-current-avatar]"
  ).forEach(element => {
    element.textContent = profile.avatar;
  });
}

function openProfile() {
  const modal =
    qs("#profile-modal") ||
    qs("#modal-profile") ||
    qs("#perfil-modal");

  if (!modal) {
    return;
  }

  const profile = getProfile();

  const nameInput =
    qs(
      "#profile-name-input",
      modal
    ) ||
    qs(
      "[data-profile-name-input]",
      modal
    );

  if (nameInput) {
    nameInput.value = profile.name;
  }

  qsa(
    "[data-avatar]",
    modal
  ).forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.avatar ===
        profile.avatar
    );
  });

  modal.classList.add("active");
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
    qs("#profile-modal") ||
    qs("#modal-profile") ||
    qs("#perfil-modal");

  if (!modal) {
    return;
  }

  modal.classList.remove("active");
  modal.classList.remove("open");
  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "modal-open"
  );
}

function saveProfileFromModal() {
  const modal =
    qs("#profile-modal") ||
    qs("#modal-profile") ||
    qs("#perfil-modal");

  if (!modal) {
    return;
  }

  const nameInput =
    qs(
      "#profile-name-input",
      modal
    ) ||
    qs(
      "[data-profile-name-input]",
      modal
    );

  const selectedAvatar =
    qs(
      "[data-avatar].selected",
      modal
    );

  const currentProfile =
    getProfile();

  const name =
    nameInput &&
    nameInput.value.trim()
      ? nameInput.value.trim()
      : currentProfile.name;

  const avatar =
    selectedAvatar?.dataset.avatar ||
    currentProfile.avatar;

  saveProfile({
    name,
    avatar
  });

  closeProfile();

  showGlobalMessage(
    "Perfil atualizado."
  );
}

function setupProfileControls() {
  qsa(
    "#profile-form, [data-profile-form]"
  ).forEach(form => {
    form.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        saveProfileFromModal();
      }
    );
  });
}

function setupAvatarOptions() {
  qsa(
    "[data-avatar]"
  ).forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();

        qsa(
          "[data-avatar]"
        ).forEach(item => {
          item.classList.remove(
            "selected"
          );
        });

        button.classList.add(
          "selected"
        );
      }
    );
  });
}

/* =========================================================
   MENU DO USUÁRIO
   ========================================================= */

function setupUserMenu() {
  const profileButton =
    qs("#user-profile") ||
    qs("#profile-button") ||
    qs("[data-profile-button]");

  if (profileButton) {
    profileButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        openProfile();
      }
    );
  }

  const editButton =
    qs("#user-profile-edit") ||
    qs("[data-action='edit-profile']");

  if (editButton) {
    editButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        openProfile();
      }
    );
  }

  const menu =
    qs("#user-menu") ||
    qs(".user-menu");

  if (menu) {
    document.addEventListener(
      "click",
      event => {
        if (
          !menu.contains(event.target) &&
          !profileButton?.contains(
            event.target
          )
        ) {
          menu.classList.remove(
            "active"
          );
          menu.classList.remove(
            "open"
          );
        }
      }
    );
  }
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function setupNavigation() {
  qsa(
    "[data-nav], .nav-link, .menu-link"
  ).forEach(link => {
    link.addEventListener(
      "click",
      event => {
        const href =
          link.getAttribute("href");

        if (
          href &&
          href !== "#" &&
          !href.startsWith(
            "javascript:"
          )
        ) {
          return;
        }

        const target =
          link.dataset.nav ||
          link.dataset.target;

        if (!target) {
          return;
        }

        event.preventDefault();

        navigateToSection(target);
      }
    );
  });
}

function navigateToSection(section) {
  const normalized =
    String(section || "")
      .toLowerCase()
      .trim();

  appState.currentSection =
    normalized;

  const element =
    qs(
      `#${CSS.escape(normalized)}`
    ) ||
    qs(
      `[data-section="${CSS.escape(
        normalized
      )}"]`
    );

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  qsa(
    "[data-nav], .nav-link, .menu-link"
  ).forEach(link => {
    const target =
      link.dataset.nav ||
      link.dataset.target ||
      "";

    link.classList.toggle(
      "active",
      target.toLowerCase() ===
        normalized
    );
  });
}

/* =========================================================
   CONTROLES DO HERO
   ========================================================= */

function setupHeroControls() {
  const hero = qs("#hero");

  if (!hero) {
    return;
  }

  hero.addEventListener(
    "mouseenter",
    () => {
      stopHeroAutoPlay();
    }
  );

  hero.addEventListener(
    "mouseleave",
    () => {
      startHeroAutoPlay();
    }
  );

  hero.addEventListener(
    "click",
    event => {
      const control =
        event.target.closest(
          "[data-hero-control]"
        );

      if (control) {
        const action =
          control.dataset.heroControl;

        if (action === "next") {
          nextHero();
        } else if (
          action === "prev"
        ) {
          previousHero();
        }

        return;
      }

      const indicator =
        event.target.closest(
          "[data-hero-indicator]"
        );

      if (indicator) {
        const index =
          Number(
            indicator.dataset.heroIndicator
          );

        if (
          Number.isFinite(index)
        ) {
          setHeroSlide(index);
          startHeroAutoPlay();
        }
      }
    }
  );
}

/* =========================================================
   BOTÕES DE SCROLL DAS FILEIRAS
   ========================================================= */

function setupScrollButtons() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-scroll]"
        );

      if (!button) {
        return;
      }

      const direction =
        button.dataset.scroll;

      const targetSelector =
        button.dataset.target;

      let container = null;

      if (targetSelector) {
        try {
          container =
            qs(targetSelector);
        } catch (error) {
          container = null;
        }
      }

      if (!container) {
        container =
          button.parentElement?.querySelector(
            ".content-row, .cards-row, .movies-row, .series-row"
          );
      }

      if (!container) {
        return;
      }

      const amount =
        Math.max(
          container.clientWidth * 0.8,
          300
        );

      container.scrollBy({
        left:
          direction === "left"
            ? -amount
            : amount,
        behavior: "smooth"
      });
    }
  );
}

/* =========================================================
   FALLBACKS DE IMAGENS
   ========================================================= */

function setupImageFallbacks() {
  qsa("img").forEach(image => {
    if (
      image.dataset.fallbackConfigured
    ) {
      return;
    }

    image.dataset.fallbackConfigured =
      "true";

    image.addEventListener(
      "error",
      () => {
        createFallbackImage(image);
      },
      {
        once: true
      }
    );
  });
}

/* =========================================================
   BOTÃO DO USUÁRIO NO HEADER
   ========================================================= */

function setupHeaderUserButton() {
  const buttons = qsa(
    "#header-user-button, [data-header-user]"
  );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        openProfile();
      }
    );
  });
}

/* =========================================================
   BOTÕES DE FECHAR
   ========================================================= */

function setupCloseButtons() {
  document.addEventListener(
    "click",
    event => {
      const closeDetails =
        event.target.closest(
          "[data-action='close-details']"
        );

      if (closeDetails) {
        event.preventDefault();
        closeDetailsModalSafely();
        return;
      }

      const closePlayerButton =
        event.target.closest(
          "[data-action='close-player']"
        );

      if (closePlayerButton) {
        event.preventDefault();
        closePlayer();
        return;
      }

      const closeProfileButton =
        event.target.closest(
          "[data-action='close-profile']"
        );

      if (closeProfileButton) {
        event.preventDefault();
        closeProfile();
        return;
      }
    }
  );
}

function closeDetailsModalSafely() {
  closeDetails();
}

/* =========================================================
   BOTÕES DE FAVORITOS NOS DETALHES
   ========================================================= */

function setupFavoriteDetailsButton() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          ".details-favorite-button"
        );

      if (!button) {
        return;
      }

      const id =
        Number(
          button.dataset.mediaId
        );

      const type =
        normalizeType(
          button.dataset.mediaType
        );

      const item =
        findItemByIdAndType(
          id,
          type
        );

      if (item) {
        toggleFavorite(item);
      }
    }
  );
}

/* =========================================================
   BOTÕES ASSISTIR
   ========================================================= */

function setupWatchButtons() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-action='watch']"
        );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const id =
        Number(
          button.dataset.mediaId
        );

      const type =
        normalizeType(
          button.dataset.mediaType
        );

      if (!id) {
        return;
      }

      openDetails(
        id,
        type
      );
    }
  );
}

/* =========================================================
   HISTÓRICO PAGE
   ========================================================= */

function renderHistoryPage() {
  const container =
    qs("#historico-lista") ||
    qs("#history-list") ||
    qs("#history-container");

  if (!container) {
    return;
  }

  const history =
    getHistory();

  if (!history.length) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">
          🕘
        </div>

        <h2>Seu histórico está vazio</h2>

        <p>
          Os conteúdos que você abrir
          aparecerão aqui.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="page-actions">
      <button
        type="button"
        class="clear-history-button"
        data-action="clear-history"
      >
        🗑 Limpar histórico
      </button>
    </div>

    <div class="history-grid">
      ${history
        .map(item =>
          createContentCard(
            item,
            {
              removableHistory: true
            }
          )
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   FAVORITOS PAGE
   ========================================================= */

function renderFavoritesPage() {
  const container =
    qs("#favoritos-lista") ||
    qs("#favorites-list") ||
    qs("#favorites-container");

  if (!container) {
    return;
  }

  const favorites =
    getFavorites();

  if (!favorites.length) {
    container.innerHTML = `
      <div class="favorites-empty">
        <div class="favorites-empty-icon">
          ☆
        </div>

        <h2>Você ainda não tem favoritos</h2>

        <p>
          Clique na estrela dos conteúdos
          que deseja guardar.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="favorites-grid">
      ${favorites
        .map(item =>
          createContentCard(
            item,
            {
              removableFavorite: true
            }
          )
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   EVENTO CENTRAL DOS CARDS
   ========================================================= */

function handleDocumentClick(event) {
  const favoriteButton =
    event.target.closest(
      "[data-action='favorite']"
    );

  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      Number(
        favoriteButton.dataset.mediaId
      );

    const type =
      normalizeType(
        favoriteButton.dataset.mediaType
      );

    let item =
      findItemByIdAndType(
        id,
        type
      );

    if (!item) {
      const card =
        favoriteButton.closest(
          "[data-media-id]"
        );

      if (card) {
        item = {
          id: Number(
            card.dataset.mediaId
          ),
          type:
            card.dataset.mediaType ||
            type,
          title:
            qs(
              ".content-card-title",
              card
            )?.textContent.trim() ||
            "Sem título",
          poster_path:
            qs(
              ".content-card-image",
              card
            )?.getAttribute("src") ||
            ""
        };
      }
    }

    if (item) {
      toggleFavorite(item);
    }

    return;
  }

  const removeFavorite =
    event.target.closest(
      "[data-action='remove-favorite']"
    );

  if (removeFavorite) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      Number(
        removeFavorite.dataset.mediaId
      );

    const type =
      normalizeType(
        removeFavorite.dataset.mediaType
      );

    removeFavoriteItem(
      id,
      type
    );

    return;
  }

  const removeHistory =
    event.target.closest(
      "[data-action='remove-history']"
    );

  if (removeHistory) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      Number(
        removeHistory.dataset.mediaId
      );

    const type =
      normalizeType(
        removeHistory.dataset.mediaType
      );

    removeHistoryItem(
      id,
      type
    );

    return;
  }

  const watchButton =
    event.target.closest(
      "[data-action='watch']"
    );

  if (watchButton) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      Number(
        watchButton.dataset.mediaId
      );

    const type =
      normalizeType(
        watchButton.dataset.mediaType
      );

    if (id) {
      openDetails(
        id,
        type
      );
    }

    return;
  }

  const detailsButton =
    event.target.closest(
      "[data-action='details']"
    );

  if (detailsButton) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      Number(
        detailsButton.dataset.mediaId
      );

    const type =
      normalizeType(
        detailsButton.dataset.mediaType
      );

    if (id) {
      openDetails(
        id,
        type
      );
    }

    return;
  }

  const clearHistoryButton =
    event.target.closest(
      "[data-action='clear-history']"
    );

  if (clearHistoryButton) {
    event.preventDefault();

    const confirmed =
      window.confirm(
        "Deseja realmente limpar todo o histórico?"
      );

    if (confirmed) {
      clearHistory();
    }

    return;
  }

  const closePlayerAction =
    event.target.closest(
      "[data-action='close-player']"
    );

  if (closePlayerAction) {
    event.preventDefault();
    closePlayer();
    return;
  }

  const episodeButton =
    event.target.closest(
      "[data-action='episode']"
    );

  if (episodeButton) {
    event.preventDefault();

    showGlobalMessage(
      "Episódio selecionado. A reprodução depende de uma fonte autorizada."
    );

    return;
  }

  const avatar =
    event.target.closest(
      "[data-avatar]"
    );

  if (
    avatar &&
    !avatar.closest(
      "#profile-modal, #modal-profile, #perfil-modal"
    )
  ) {
    return;
  }

  const card =
    event.target.closest(
      "[data-media-id]"
    );

  if (card) {
    event.preventDefault();

    const id =
      Number(
        card.dataset.mediaId
      );

    const type =
      normalizeType(
        card.dataset.mediaType
      );

    if (id) {
      openDetails(
        id,
        type
      );
    }

    return;
  }
}

/* =========================================================
   TECLADO
   ========================================================= */

function setupKeyboardNavigation() {
  document.addEventListener(
    "keydown",
    event => {
      const activeElement =
        document.activeElement;

      const tag =
        activeElement?.tagName;

      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";

      if (
        event.key === "Escape"
      ) {
        closeDetails();
        closePlayer();
        closeProfile();

        return;
      }

      if (typing) {
        return;
      }

      if (
        event.key === "ArrowRight"
      ) {
        const focusedCard =
          document.activeElement?.closest(
            "[data-media-id]"
          );

        if (focusedCard) {
          const cards =
            qsa(
              "[data-media-id]"
            ).filter(
              element =>
                element.offsetParent !==
                null
            );

          const index =
            cards.indexOf(
              focusedCard
            );

          if (
            index >= 0 &&
            cards[index + 1]
          ) {
            cards[index + 1].focus();
          }
        }
      }

      if (
        event.key === "ArrowLeft"
      ) {
        const focusedCard =
          document.activeElement?.closest(
            "[data-media-id]"
          );

        if (focusedCard) {
          const cards =
            qsa(
              "[data-media-id]"
            ).filter(
              element =>
                element.offsetParent !==
                null
            );

          const index =
            cards.indexOf(
              focusedCard
            );

          if (
            index > 0 &&
            cards[index - 1]
          ) {
            cards[index - 1].focus();
          }
        }
      }

      if (
        event.key === "Enter"
      ) {
        const focused =
          document.activeElement;

        if (
          focused?.matches(
            "[data-media-id]"
          )
        ) {
          const id =
            Number(
              focused.dataset.mediaId
            );

          const type =
            normalizeType(
              focused.dataset.mediaType
            );

          if (id) {
            openDetails(
              id,
              type
            );
          }
        }
      }
    }
  );
}

/* =========================================================
   DETECÇÃO DE PÁGINA
   ========================================================= */

function detectCurrentPage() {
  const path =
    window.location.pathname
      .toLowerCase();

  if (
    path.endsWith(
      "/favoritos.html"
    ) ||
    path.endsWith(
      "favoritos.html"
    )
  ) {
    return "favorites";
  }

  if (
    path.endsWith(
      "/historico.html"
    ) ||
    path.endsWith(
      "historico.html"
    )
  ) {
    return "history";
  }

  return "home";
}

/* =========================================================
   PÁGINAS SEPARADAS
   ========================================================= */

function setupStandalonePages() {
  appState.currentPage =
    detectCurrentPage();

  if (
    appState.currentPage ===
    "favorites"
  ) {
    renderFavoritesPage();
  }

  if (
    appState.currentPage ===
    "history"
  ) {
    renderHistoryPage();
  }
}

/* =========================================================
   MODAL BACKDROP
   ========================================================= */

function setupModalBackdrop() {
  document.addEventListener(
    "click",
    event => {
      const detailsModal =
        getDetailsModal();

      if (
        detailsModal &&
        event.target ===
          detailsModal
      ) {
        closeDetails();
      }

      const playerModal =
        getPlayerModal();

      if (
        playerModal &&
        event.target ===
          playerModal
      ) {
        closePlayer();
      }

      const profileModal =
        qs("#profile-modal") ||
        qs("#modal-profile") ||
        qs("#perfil-modal");

      if (
        profileModal &&
        event.target ===
          profileModal
      ) {
        closeProfile();
      }
    }
  );
}

/* =========================================================
   CONTROLE DO FORMULÁRIO DE PERFIL
   ========================================================= */

function setupProfileModalButtons() {
  document.addEventListener(
    "click",
    event => {
      const saveButton =
        event.target.closest(
          "[data-action='save-profile']"
        );

      if (saveButton) {
        event.preventDefault();
        saveProfileFromModal();
        return;
      }

      const closeButton =
        event.target.closest(
          "[data-action='close-profile']"
        );

      if (closeButton) {
        event.preventDefault();
        closeProfile();
      }
    }
  );
}

/* =========================================================
   DETALHES DE SÉRIES
   ========================================================= */

async function setupSeriesDetails(data) {
  if (!data) {
    return;
  }

  if (
    normalizeType(data.type) !==
    "tv"
  ) {
    return;
  }

  const modal =
    getDetailsModal();

  if (!modal) {
    return;
  }

  const container =
    qs(
      ".details-seasons",
      modal
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="seasons-loading">
      Carregando temporadas...
    </div>
  `;

  const seasons =
    await loadSeasons(
      Number(data.id)
    );

  renderSeasons(
    container,
    seasons
  );
}

/* =========================================================
   ATUALIZAÇÃO VISUAL DOS FAVORITOS
   ========================================================= */

function refreshFavoriteVisuals() {
  const favorites =
    getFavorites();

  qsa(
    "[data-action='favorite']"
  ).forEach(button => {
    const id =
      Number(
        button.dataset.mediaId
      );

    const type =
      normalizeType(
        button.dataset.mediaType
      );

    const favorite =
      favorites.some(item => {
        return (
          Number(item.id) === id &&
          normalizeType(
            item.type
          ) === type
        );
      });

    if (
      button.classList.contains(
        "hero-favorite-button"
      )
    ) {
      button.textContent =
        favorite
          ? "★"
          : "☆";
    } else if (
      button.classList.contains(
        "details-favorite-button"
      )
    ) {
      button.textContent =
        favorite
          ? "★ Remover dos favoritos"
          : "☆ Adicionar aos favoritos";
    } else {
      button.textContent =
        favorite
          ? "★"
          : "☆";
    }

    button.setAttribute(
      "aria-label",
      favorite
        ? "Remover dos favoritos"
        : "Adicionar aos favoritos"
    );
  });
}
/* =========================================================
   FAVORITOS E HISTÓRICO - ATUALIZAÇÃO
   ========================================================= */

function updatePageCounters() {
  const favorites = getFavorites();
  const history = getHistory();

  qsa(
    "[data-favorites-count], #favorites-count"
  ).forEach(element => {
    element.textContent =
      String(favorites.length);
  });

  qsa(
    "[data-history-count], #history-count"
  ).forEach(element => {
    element.textContent =
      String(history.length);
  });
}

/* =========================================================
   MENU MOBILE
   ========================================================= */

function setupMobileMenu() {
  const buttons = qsa(
    "#menu-toggle, .menu-toggle, [data-menu-toggle]"
  );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();

        const menu =
          qs("#main-menu") ||
          qs(".main-menu") ||
          qs(".nav-menu") ||
          qs("nav");

        if (!menu) {
          return;
        }

        menu.classList.toggle(
          "active"
        );

        menu.classList.toggle(
          "open"
        );

        button.classList.toggle(
          "active"
        );
      }
    );
  });

  qsa(
    ".nav-link, .menu-link, [data-nav]"
  ).forEach(link => {
    link.addEventListener(
      "click",
      () => {
        const menu =
          qs("#main-menu") ||
          qs(".main-menu") ||
          qs(".nav-menu");

        if (!menu) {
          return;
        }

        menu.classList.remove(
          "active"
        );

        menu.classList.remove(
          "open"
        );
      }
    );
  });
}

/* =========================================================
   TOUCH / SWIPE NO HERO
   ========================================================= */

function setupHeroTouch() {
  const hero = qs("#hero");

  if (!hero) {
    return;
  }

  let startX = 0;
  let startY = 0;

  hero.addEventListener(
    "touchstart",
    event => {
      const touch =
        event.touches[0];

      if (!touch) {
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
    },
    {
      passive: true
    }
  );

  hero.addEventListener(
    "touchend",
    event => {
      const touch =
        event.changedTouches[0];

      if (!touch) {
        return;
      }

      const deltaX =
        touch.clientX - startX;

      const deltaY =
        touch.clientY - startY;

      if (
        Math.abs(deltaX) < 50 ||
        Math.abs(deltaX) <
          Math.abs(deltaY)
      ) {
        return;
      }

      if (deltaX < 0) {
        nextHero();
      } else {
        previousHero();
      }

      startHeroAutoPlay();
    },
    {
      passive: true
    }
  );
}

/* =========================================================
   PESQUISA ABERTA PELO BOTÃO
   ========================================================= */

function setupSearchButton() {
  const buttons = qsa(
    "#search-button, .search-button, [data-search-button]"
  );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();

        const input =
          qs(
            "#search-input"
          ) ||
          qs(
            "#search"
          ) ||
          qs(
            ".search-input"
          ) ||
          qs(
            "[data-search-input]"
          );

        if (input) {
          input.focus();

          input.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }
    );
  });
}

/* =========================================================
   BOTÃO DE FAVORITOS DO HEADER
   ========================================================= */

function setupFavoritesButton() {
  const buttons = qsa(
    "#favorites-button, [data-favorites-button]"
  );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        const href =
          button.getAttribute(
            "href"
          );

        if (
          href &&
          href !== "#"
        ) {
          return;
        }

        event.preventDefault();

        window.location.href =
          "favoritos.html";
      }
    );
  });
}

/* =========================================================
   BOTÃO DE HISTÓRICO DO HEADER
   ========================================================= */

function setupHistoryButton() {
  const buttons = qsa(
    "#history-button, [data-history-button]"
  );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        const href =
          button.getAttribute(
            "href"
          );

        if (
          href &&
          href !== "#"
        ) {
          return;
        }

        event.preventDefault();

        window.location.href =
          "historico.html";
      }
    );
  });
}

/* =========================================================
   BOTÃO VOLTAR
   ========================================================= */

function setupBackButtons() {
  qsa(
    "[data-action='back'], .back-button"
  ).forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();

        if (
          window.history.length >
          1
        ) {
          window.history.back();
        } else {
          window.location.href =
            "index.html";
        }
      }
    );
  });
}

/* =========================================================
   FAVORITOS - LINK DA NAVEGAÇÃO
   ========================================================= */

function setupFavoriteLinks() {
  qsa(
    "a[href='favoritos.html'], a[href='./favoritos.html']"
  ).forEach(link => {
    link.addEventListener(
      "click",
      () => {
        getFavorites();
      }
    );
  });
}

/* =========================================================
   HISTÓRICO - LINK DA NAVEGAÇÃO
   ========================================================= */

function setupHistoryLinks() {
  qsa(
    "a[href='historico.html'], a[href='./historico.html']"
  ).forEach(link => {
    link.addEventListener(
      "click",
      () => {
        getHistory();
      }
    );
  });
}

/* =========================================================
   FECHAR MODAIS COM ESC
   ========================================================= */

function setupEscapeKey() {
  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      closeDetails();
      closePlayer();
      closeProfile();
    }
  );
}

/* =========================================================
   PREVENIR CLIQUE DUPLO INDESEJADO
   ========================================================= */

function setupButtonProtection() {
  qsa(
    "button"
  ).forEach(button => {
    button.addEventListener(
      "click",
      event => {
        if (
          button.disabled
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    );
  });
}

/* =========================================================
   CARREGAMENTO DE DETALHES DE SÉRIE
   ========================================================= */

function renderSeriesSeasonsIfNeeded() {
  const data =
    appState.currentDetails;

  if (!data) {
    return;
  }

  if (
    normalizeType(data.type) !==
    "tv"
  ) {
    return;
  }

  setupSeriesDetails(data);
}

/* =========================================================
   OBSERVADOR DO MODAL DE DETALHES
   ========================================================= */

function setupDetailsObserver() {
  const modal =
    getDetailsModal();

  if (!modal) {
    return;
  }

  const observer =
    new MutationObserver(() => {
      if (
        !modal.classList.contains(
          "active"
        ) &&
        !modal.classList.contains(
          "open"
        )
      ) {
        return;
      }

      const data =
        appState.currentDetails;

      if (!data) {
        return;
      }

      if (
        normalizeType(
          data.type
        ) !== "tv"
      ) {
        return;
      }

      const container =
        qs(
          ".details-seasons",
          modal
        );

      if (
        container &&
        !container.dataset.loaded
      ) {
        container.dataset.loaded =
          "true";

        setupSeriesDetails(
          data
        );
      }
    });

  observer.observe(
    modal,
    {
      childList: true,
      subtree: true
    }
  );
}

/* =========================================================
   ATUALIZAÇÃO DOS BOTÕES DO CARD
   ========================================================= */

function updateCardFavoriteState(
  id,
  type
) {
  const favorite =
    isFavorite(id, type);

  qsa(
    `[data-media-id="${Number(
      id
    )}"][data-media-type="${normalizeType(
      type
    )}"]`
  ).forEach(element => {
    const button =
      element.matches(
        "button"
      )
        ? element
        : qs(
            "[data-action='favorite']",
            element
          );

    if (!button) {
      return;
    }

    if (
      button.dataset.action ===
      "remove-favorite"
    ) {
      button.textContent =
        "✕";

      return;
    }

    button.textContent =
      favorite
        ? "★"
        : "☆";
  });
}

/* =========================================================
   CORREÇÃO VISUAL DOS CARDS
   ========================================================= */

function ensureRowsHaveHorizontalClass() {
  const selectors = [
    ".content-row",
    ".cards-row",
    ".movies-row",
    ".series-row",
    ".content-list",
    ".movie-list",
    ".series-list",
    ".cards-container"
  ];

  selectors.forEach(selector => {
    qsa(selector).forEach(row => {
      row.classList.add(
        "cinefamily-horizontal-row"
      );
    });
  });
}

/* =========================================================
   OBSERVADOR PARA NOVOS CARDS
   ========================================================= */

function setupContentObserver() {
  const observer =
    new MutationObserver(
      mutations => {
        let changed = false;

        mutations.forEach(
          mutation => {
            if (
              mutation.addedNodes &&
              mutation.addedNodes.length
            ) {
              changed = true;
            }
          }
        );

        if (!changed) {
          return;
        }

        ensureRowsHaveHorizontalClass();
        setupImageFallbacks();
        refreshFavoriteVisuals();
      }
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );
}

/* =========================================================
   INICIALIZAÇÃO ÚNICA
   ========================================================= */

async function initializeCineFamily() {
  if (appState.initialized) {
    return;
  }

  appState.initialized =
    true;

  appState.currentPage =
    detectCurrentPage();

  getFavorites();
  getHistory();

  setupSearch();
  setupSearchButton();

  setupHeroControls();
  setupHeroTouch();

  setupProfileControls();
  setupAvatarOptions();
  setupUserMenu();
  setupHeaderUserButton();

  setupNavigation();

  setupScrollButtons();

  setupImageFallbacks();

  setupCloseButtons();
  setupModalBackdrop();

  setupFavoriteDetailsButton();
  setupWatchButtons();

  setupKeyboardNavigation();
  setupEscapeKey();

  setupPlayerFullscreen();

  setupProfileModalButtons();

  setupMobileMenu();

  setupFavoritesButton();
  setupHistoryButton();

  setupBackButtons();

  setupFavoriteLinks();
  setupHistoryLinks();

  setupStandalonePages();

  setupDetailsObserver();

  setupContentObserver();

  ensureRowsHaveHorizontalClass();

  updatePageCounters();

  renderProfile();
  renderFavoritesRow();
  renderContinueRow();

  if (
    appState.currentPage ===
    "home"
  ) {
    await loadHome();
  }

  if (
    appState.currentPage ===
    "favorites"
  ) {
    renderFavoritesPage();
  }

  if (
    appState.currentPage ===
    "history"
  ) {
    renderHistoryPage();
  }
}

/* =========================================================
   EVENTO CENTRAL
   ========================================================= */

function setupCentralClickHandler() {
  document.addEventListener(
    "click",
    handleDocumentClick
  );
}

/* =========================================================
   INICIALIZAÇÃO QUANDO O HTML ESTIVER PRONTO
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setupCentralClickHandler();
      initializeCineFamily();
    },
    {
      once: true
    }
  );
} else {
  setupCentralClickHandler();
  initializeCineFamily();
}

/* =========================================================
   API PÚBLICA DO CINEFAMILY
   ========================================================= */

window.CineFamily = {
  openDetails,
  closeDetails,
  openPlayer,
  closePlayer,
  openProfile,
  closeProfile,
  toggleFavorite,
  removeFavoriteItem,
  removeHistoryItem,
  clearHistory,
  getFavorites,
  getHistory,
  searchContent,
  realizarBusca,
  nextHero,
  previousHero,
  setHeroSlide,
  loadHome
};

/* =========================================================
   COMPATIBILIDADE COM NOMES ANTIGOS
   ========================================================= */

window.abrirDetalhes =
  openDetails;

window.fecharDetalhes =
  closeDetails;

window.adicionarFavorito =
  toggleFavorite;

window.obterFavoritos =
  getFavorites;

window.obterHistorico =
  getHistory;

window.registrarHistorico =
  addToHistory;

window.realizarBusca =
  realizarBusca;

window.buscarTMDB =
  searchContent;

/* =========================================================
   FINAL DO SCRIPT
   ========================================================= */
