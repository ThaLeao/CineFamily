const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";

const STORAGE_FAVORITES = "cinefamily_favoritos";
const STORAGE_HISTORY = "cinefamily_historico";
const STORAGE_PROFILE = "cinefamily_perfil";

const IMAGE_FALLBACK =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
      <rect width="500" height="750" fill="#14141b"/>
      <text x="250" y="360" text-anchor="middle" fill="#d4af37" font-size="34" font-family="Arial">
        CineFamily
      </text>
      <text x="250" y="405" text-anchor="middle" fill="#aaa" font-size="20" font-family="Arial">
        Sem imagem
      </text>
    </svg>
  `);

const BACKDROP_FALLBACK =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <rect width="1280" height="720" fill="#08080b"/>
      <text x="640" y="340" text-anchor="middle" fill="#d4af37" font-size="58" font-family="Arial">
        CineFamily
      </text>
      <text x="640" y="400" text-anchor="middle" fill="#aaa" font-size="26" font-family="Arial">
        Filme e séries para toda a família
      </text>
    </svg>
  `);

const DEFAULT_PROFILE = {
  name: "CineFamily",
  avatar: "👤"
};

let appState = {
  home: null,
  heroItems: [],
  heroIndex: 0,
  heroTimer: null,
  favorites: [],
  history: [],
  profile: loadProfile(),
  currentDetails: null,
  currentPlayer: null,
  searchTimeout: null
};

document.addEventListener("DOMContentLoaded", initializeCineFamily);


async function initializeCineFamily() {
  loadLocalData();
  setupGlobalEvents();
  setupSearch();
  setupHeroControls();
  setupModalControls();
  setupProfileControls();
  setupUserMenu();
  setupNavigation();
  renderProfile();
  renderFavoritesRow();
  renderContinueRow();

  await loadHome();
}


function loadLocalData() {
  appState.favorites = readStorage(
    STORAGE_FAVORITES,
    []
  );

  appState.history = readStorage(
    STORAGE_HISTORY,
    []
  );

  appState.profile = loadProfile();
}


function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error(
      "Erro ao ler armazenamento:",
      key,
      error
    );

    return fallback;
  }
}


function saveStorage(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;
  } catch (error) {
    console.error(
      "Erro ao salvar armazenamento:",
      key,
      error
    );

    return false;
  }
}


function loadProfile() {
  const profile = readStorage(
    STORAGE_PROFILE,
    DEFAULT_PROFILE
  );

  if (!profile || typeof profile !== "object") {
    return {
      ...DEFAULT_PROFILE
    };
  }

  return {
    ...DEFAULT_PROFILE,
    ...profile
  };
}


function setupGlobalEvents() {
  document.addEventListener(
    "click",
    handleDocumentClick
  );

  document.addEventListener(
    "keydown",
    handleGlobalKeydown
  );
}


function handleDocumentClick(event) {
  const card = event.target.closest(
    "[data-media-id]"
  );

  if (card) {
    const id = Number(
      card.dataset.mediaId
    );

    const type =
      card.dataset.mediaType ||
      "movie";

    if (id) {
      openDetails(id, type);
      return;
    }
  }

  const favoriteButton =
    event.target.closest(
      "[data-action='favorite']"
    );

  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();

    const id = Number(
      favoriteButton.dataset.mediaId
    );

    const type =
      favoriteButton.dataset.mediaType ||
      "movie";

    const item =
      findItemByIdAndType(id, type);

    if (item) {
      toggleFavorite(item);
    }

    return;
  }

  const watchButton =
    event.target.closest(
      "[data-action='watch']"
    );

  if (watchButton) {
    event.preventDefault();
    event.stopPropagation();

    const id = Number(
      watchButton.dataset.mediaId
    );

    const type =
      watchButton.dataset.mediaType ||
      "movie";

    if (id) {
      openDetails(id, type);
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

    const id = Number(
      detailsButton.dataset.mediaId
    );

    const type =
      detailsButton.dataset.mediaType ||
      "movie";

    if (id) {
      openDetails(id, type);
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

    const id = Number(
      removeFavorite.dataset.mediaId
    );

    const type =
      removeFavorite.dataset.mediaType ||
      "movie";

    removeFavoriteItem(id, type);
    return;
  }

  const removeHistory =
    event.target.closest(
      "[data-action='remove-history']"
    );

  if (removeHistory) {
    event.preventDefault();
    event.stopPropagation();

    const id = Number(
      removeHistory.dataset.mediaId
    );

    const type =
      removeHistory.dataset.mediaType ||
      "movie";

    removeHistoryItem(id, type);
  }
}


function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    closeAllModals();
    closeUserMenu();
    return;
  }

  if (
    event.key === "/" &&
    !isTypingInField(event.target)
  ) {
    event.preventDefault();
    toggleSearch(true);
    return;
  }

  if (
    event.key === "Enter" &&
    event.target &&
    event.target.matches(
      ".content-card, .hero-slide, [role='button']"
    )
  ) {
    event.target.click();
  }
}


function isTypingInField(element) {
  if (!element) {
    return false;
  }

  const tag = element.tagName;

  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.isContentEditable
  );
}


async function api(path, options = {}) {
  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const response = await fetch(
    `${TMDB_WORKER}${cleanPath}`,
    {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      "O Worker retornou uma resposta inválida."
    );
  }

  if (!response.ok || data.ok === false) {
    const message =
      data.erro ||
      data.error ||
      "Não foi possível carregar os dados.";

    throw new Error(message);
  }

  return data;
}


async function loadHome() {
  try {
    showInitialLoading();

    const data = await api("/api/home");

    appState.home = data;

    appState.heroItems =
      Array.isArray(data.destaque)
        ? data.destaque
        : [];

    renderHero();
    renderRow(
      "movies-row",
      data.filmes || [],
      "Filmes"
    );

    renderRow(
      "series-row",
      data.series || [],
      "Séries"
    );

    renderRow(
      "top-rated-row",
      [
        ...(data.filmes_populares || []),
        ...(data.series_populares || [])
      ]
        .sort(
          (a, b) =>
            Number(b.vote_average || 0) -
            Number(a.vote_average || 0)
        )
        .slice(0, 20),
      "Mais bem avaliados"
    );

    renderLatestRow();
    renderSpecialCategories();
    renderFavoritesRow();
    renderContinueRow();

    hideInitialLoading();
  } catch (error) {
    console.error(
      "Erro ao carregar CineFamily:",
      error
    );

    hideInitialLoading();
    showToast(
      "Não foi possível carregar o CineFamily.",
      "error"
    );

    showGlobalError(
      error.message
    );
  }
}


function showInitialLoading() {
  const rows = [
    "movies-row",
    "series-row",
    "top-rated-row",
    "latest-row",
    "doramas-row",
    "gl-row",
    "kids-row"
  ];

  rows.forEach(id => {
    const row = document.getElementById(id);

    if (!row) {
      return;
    }

    row.innerHTML = `
      <div class="loading-card">
        <div class="loading-card-pulse"></div>
      </div>
      <div class="loading-card">
        <div class="loading-card-pulse"></div>
      </div>
      <div class="loading-card">
        <div class="loading-card-pulse"></div>
      </div>
      <div class="loading-card">
        <div class="loading-card-pulse"></div>
      </div>
      <div class="loading-card">
        <div class="loading-card-pulse"></div>
      </div>
    `;
  });
}


function hideInitialLoading() {
  document
    .querySelectorAll(".loading-card")
    .forEach(card => {
      card.remove();
    });
}


function showGlobalError(message) {
  const existing =
    document.getElementById(
      "cinefamily-global-error"
    );

  if (existing) {
    existing.remove();
  }

  const container =
    document.createElement("div");

  container.id =
    "cinefamily-global-error";

  container.className =
    "cinefamily-global-error";

  container.innerHTML = `
    <div class="error-icon">⚠️</div>
    <h3>Não foi possível carregar o conteúdo</h3>
    <p>${escapeHtml(
      message ||
      "Verifique sua conexão e tente novamente."
    )}</p>
    <button
      type="button"
      class="btn btn-primary"
      id="cinefamily-retry"
    >
      Tentar novamente
    </button>
  `;

  document.body.appendChild(container);

  const retry =
    document.getElementById(
      "cinefamily-retry"
    );

  if (retry) {
    retry.addEventListener(
      "click",
      async () => {
        container.remove();
        await loadHome();
      }
    );
  }
}


function renderHero() {
  const slides =
    document.querySelectorAll(
      ".hero-slide"
    );

  if (!slides.length) {
    return;
  }

  const items =
    appState.heroItems.slice(0, 3);

  slides.forEach((slide, index) => {
    const item = items[index];

    if (!item) {
      slide.classList.add("is-hidden");
      return;
    }

    slide.classList.remove("is-hidden");

    slide.dataset.mediaId = item.id;
    slide.dataset.mediaType = item.type;

    const background =
      slide.querySelector(
        ".hero-background"
      );

    const kicker =
      slide.querySelector(
        ".hero-kicker"
      );

    const title =
      slide.querySelector(
        ".hero-title"
      );

    const overview =
      slide.querySelector(
        ".hero-overview"
      );

    if (background) {
      background.style.backgroundImage =
        `linear-gradient(90deg, rgba(5,5,7,0.98) 0%, rgba(5,5,7,0.82) 42%, rgba(5,5,7,0.25) 100%), url("${item.backdrop_path || BACKDROP_FALLBACK}")`;
    }

    if (kicker) {
      kicker.textContent =
        item.type === "tv"
          ? "SÉRIE EM DESTAQUE"
          : "FILME EM DESTAQUE";
    }

    if (title) {
      title.textContent =
        item.title || "Sem título";
    }

    if (overview) {
      overview.textContent =
        item.overview ||
        "Descubra este conteúdo no CineFamily.";
    }

    const watch =
      slide.querySelector(
        "[data-action='watch']"
      );

    if (watch) {
      watch.dataset.mediaId =
        item.id;

      watch.dataset.mediaType =
        item.type;
    }

    const details =
      slide.querySelector(
        "[data-action='details']"
      );

    if (details) {
      details.dataset.mediaId =
        item.id;

      details.dataset.mediaType =
        item.type;
    }
  });

  setHeroSlide(0);
}


function setHeroSlide(index) {
  const slides =
    document.querySelectorAll(
      ".hero-slide"
    );

  const items =
    appState.heroItems.slice(0, slides.length);

  if (!slides.length || !items.length) {
    return;
  }

  let nextIndex = Number(index);

  if (nextIndex < 0) {
    nextIndex =
      items.length - 1;
  }

  if (nextIndex >= items.length) {
    nextIndex = 0;
  }

  appState.heroIndex = nextIndex;

  slides.forEach(
    (slide, slideIndex) => {
      slide.classList.toggle(
        "active",
        slideIndex === nextIndex
      );
    }
  );

  updateHeroIndicators();
}


function updateHeroIndicators() {
  const container =
    document.getElementById(
      "hero-indicators"
    );

  if (!container) {
    return;
  }

  const total =
    Math.min(
      appState.heroItems.length,
      3
    );

  container.innerHTML = "";

  for (let index = 0; index < total; index++) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "hero-indicator";

    button.dataset.heroIndex =
      index;

    button.setAttribute(
      "aria-label",
      `Ir para destaque ${index + 1}`
    );

    if (
      index === appState.heroIndex
    ) {
      button.classList.add("active");
    }

    button.addEventListener(
      "click",
      () => {
        setHeroSlide(index);
        restartHeroTimer();
      }
    );

    container.appendChild(button);
  }
}


function setupHeroControls() {
  const previous =
    document.getElementById(
      "hero-prev"
    );

  const next =
    document.getElementById(
      "hero-next"
    );

  const previousNew =
    document.querySelector(
      ".hero-arrow-left"
    );

  const nextNew =
    document.querySelector(
      ".hero-arrow-right"
    );

  const previousButton =
    previous || previousNew;

  const nextButton =
    next || nextNew;

  if (previousButton) {
    previousButton.addEventListener(
      "click",
      () => {
        setHeroSlide(
          appState.heroIndex - 1
        );

        restartHeroTimer();
      }
    );
  }

  if (nextButton) {
    nextButton.addEventListener(
      "click",
      () => {
        setHeroSlide(
          appState.heroIndex + 1
        );

        restartHeroTimer();
      }
    );
  }

  startHeroTimer();
}


function startHeroTimer() {
  stopHeroTimer();

  appState.heroTimer =
    window.setInterval(
      () => {
        if (
          appState.heroItems.length > 1
        ) {
          setHeroSlide(
            appState.heroIndex + 1
          );
        }
      },
      8000
    );
}


function stopHeroTimer() {
  if (appState.heroTimer) {
    window.clearInterval(
      appState.heroTimer
    );

    appState.heroTimer = null;
  }
}


function restartHeroTimer() {
  startHeroTimer();
}


function renderRow(
  rowId,
  items,
  sectionName
) {
  const row =
    document.getElementById(rowId);

  if (!row) {
    return;
  }

  row.innerHTML = "";

  const validItems =
    Array.isArray(items)
      ? items.filter(item => {
          return (
            item &&
            item.id &&
            item.adult !== true
          );
        })
      : [];

  if (!validItems.length) {
    row.innerHTML = `
      <div class="empty-row-message">
        Nenhum conteúdo disponível no momento.
      </div>
    `;

    return;
  }

  validItems.forEach(item => {
    row.appendChild(
      createContentCard(item)
    );
  });
}


function createContentCard(item) {
  const article =
    document.createElement("article");

  article.className =
    "content-card";

  article.tabIndex = 0;

  article.dataset.mediaId =
    item.id;

  article.dataset.mediaType =
    item.type;

  const image =
    item.poster_path ||
    IMAGE_FALLBACK;

  const title =
    item.title ||
    "Sem título";

  const year =
    getYear(
      item.release_date
    );

  const rating =
    formatRating(
      item.vote_average
    );

  article.innerHTML = `
    <div class="content-card-poster">
      <img
        src="${escapeAttribute(image)}"
        alt="${escapeAttribute(title)}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${escapeAttribute(IMAGE_FALLBACK)}';"
      >

      <div class="content-card-overlay">
        <button
          type="button"
          class="card-play-button"
          data-action="watch"
          data-media-id="${item.id}"
          data-media-type="${escapeAttribute(item.type)}"
          aria-label="Abrir ${escapeAttribute(title)}"
        >
          ▶
        </button>
      </div>

      <button
        type="button"
        class="card-favorite-button ${isFavorite(item.id, item.type) ? "active" : ""}"
        data-action="favorite"
        data-media-id="${item.id}"
        data-media-type="${escapeAttribute(item.type)}"
        aria-label="${isFavorite(item.id, item.type) ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
      >
        ${isFavorite(item.id, item.type) ? "★" : "☆"}
      </button>
    </div>

    <div class="content-card-info">
      <h3 class="content-card-title">
        ${escapeHtml(title)}
      </h3>

      <div class="content-card-meta">
        ${
          year
            ? `<span>${escapeHtml(year)}</span>`
            : ""
        }

        ${
          rating
            ? `<span>★ ${escapeHtml(rating)}</span>`
            : ""
        }

        <span>
          ${item.type === "tv" ? "Série" : "Filme"}
        </span>
      </div>
    </div>
  `;

  return article;
}


function getYear(date) {
  if (!date) {
    return "";
  }

  const value =
    String(date).slice(0, 4);

  return /^\d{4}$/.test(value)
    ? value
    : "";
}


function formatRating(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "";
  }

  return number.toFixed(1);
}


function escapeHtml(value) {
  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
  return escapeHtml(value);
}
async function renderLatestRow() {
  try {
    const data = await api(
      "/api/movies?sort_by=primary_release_date.desc&page=1"
    );

    renderRow(
      "latest-row",
      data.results || [],
      "Lançamentos"
    );
  } catch (error) {
    console.error(
      "Erro ao carregar lançamentos:",
      error
    );
  }
}


async function renderSpecialCategories() {
  await Promise.all([
    loadDoramas(),
    loadGL(),
    loadKids()
  ]);
}


async function loadDoramas() {
  try {
    const data = await api(
      "/api/series?original_language=ko&sort_by=popularity.desc&page=1"
    );

    const items =
      (data.results || [])
        .filter(item => {
          return (
            item.adult !== true &&
            item.original_language === "ko"
          );
        })
        .slice(0, 20);

    renderRow(
      "doramas-row",
      items,
      "Doramas"
    );
  } catch (error) {
    console.error(
      "Erro ao carregar doramas:",
      error
    );

    renderEmptyRow(
      "doramas-row",
      "Não foi possível carregar os doramas."
    );
  }
}


async function loadGL() {
  try {
    const queries = [
      "girls love",
      "girl love",
      "girls' love",
      "yuri"
    ];

    const responses =
      await Promise.all(
        queries.map(query =>
          api(
            `/api/search?q=${encodeURIComponent(query)}&page=1`
          )
        )
      );

    const collected = [];

    responses.forEach(data => {
      if (
        data &&
        Array.isArray(data.results)
      ) {
        data.results.forEach(item => {
          if (
            item &&
            item.type === "tv" &&
            item.adult !== true
          ) {
            collected.push(item);
          }
        });
      }
    });

    const unique =
      removeDuplicateItems(collected);

    renderRow(
      "gl-row",
      unique.slice(0, 20),
      "GL"
    );
  } catch (error) {
    console.error(
      "Erro ao carregar GL:",
      error
    );

    renderEmptyRow(
      "gl-row",
      "Não foi possível carregar os conteúdos GL."
    );
  }
}


async function loadKids() {
  try {
    const data = await api(
      "/api/discover/movie?genre=16&sort_by=popularity.desc&page=1"
    );

    const items =
      (data.results || [])
        .filter(item => {
          return item.adult !== true;
        })
        .slice(0, 20);

    renderRow(
      "kids-row",
      items,
      "Kids"
    );
  } catch (error) {
    console.error(
      "Erro ao carregar Kids:",
      error
    );

    renderEmptyRow(
      "kids-row",
      "Não foi possível carregar a categoria Kids."
    );
  }
}


function removeDuplicateItems(items) {
  const map = new Map();

  items.forEach(item => {
    if (!item || !item.id) {
      return;
    }

    const key =
      `${item.type}-${item.id}`;

    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}


function renderEmptyRow(
  rowId,
  message
) {
  const row =
    document.getElementById(rowId);

  if (!row) {
    return;
  }

  row.innerHTML = `
    <div class="empty-row-message">
      ${escapeHtml(message)}
    </div>
  `;
}


function setupSearch() {
  const toggle =
    document.getElementById(
      "search-toggle"
    );

  const close =
    document.getElementById(
      "search-close"
    );

  const searchButton =
    document.getElementById(
      "search-button"
    );

  const input =
    document.getElementById(
      "search-input"
    );

  if (toggle) {
    toggle.addEventListener(
      "click",
      () => {
        toggleSearch(true);
      }
    );
  }

  if (close) {
    close.addEventListener(
      "click",
      () => {
        toggleSearch(false);
      }
    );
  }

  if (searchButton) {
    searchButton.addEventListener(
      "click",
      () => {
        performSearch();
      }
    );
  }

  if (input) {
    input.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          performSearch();
        }
      }
    );

    input.addEventListener(
      "input",
      () => {
        clearTimeout(
          appState.searchTimeout
        );

        const value =
          input.value.trim();

        if (!value) {
          clearSearchResults();
          return;
        }

        appState.searchTimeout =
          window.setTimeout(
            () => {
              performSearch(
                value
              );
            },
            450
          );
      }
    );
  }
}


function toggleSearch(open) {
  const area =
    document.getElementById(
      "search-area"
    );

  if (!area) {
    return;
  }

  area.classList.toggle(
    "active",
    Boolean(open)
  );

  area.classList.toggle(
    "is-open",
    Boolean(open)
  );

  if (open) {
    const input =
      document.getElementById(
        "search-input"
      );

    if (input) {
      window.setTimeout(
        () => input.focus(),
        100
      );
    }
  } else {
    clearSearchResults();
  }
}


async function performSearch(
  providedQuery
) {
  const input =
    document.getElementById(
      "search-input"
    );

  const query =
    String(
      providedQuery !== undefined
        ? providedQuery
        : input
          ? input.value
          : ""
    ).trim();

  if (!query) {
    clearSearchResults();
    return;
  }

  const section =
    document.getElementById(
      "search-results-section"
    );

  const row =
    document.getElementById(
      "search-results-row"
    );

  if (!row) {
    return;
  }

  if (section) {
    section.classList.remove(
      "is-hidden"
    );

    section.classList.add(
      "active"
    );
  }

  row.innerHTML = `
    <div class="search-loading">
      <span>Buscando...</span>
    </div>
  `;

  try {
    const data =
      await api(
        `/api/search?q=${encodeURIComponent(query)}&page=1`
      );

    const results =
      Array.isArray(data.results)
        ? data.results
        : [];

    if (!results.length) {
      row.innerHTML = `
        <div class="empty-row-message">
          Nenhum resultado encontrado para
          <strong>${escapeHtml(query)}</strong>.
        </div>
      `;

      return;
    }

    row.innerHTML = "";

    results
      .filter(item => {
        return (
          item &&
          (
            item.type === "movie" ||
            item.type === "tv"
          ) &&
          item.adult !== true
        );
      })
      .slice(0, 30)
      .forEach(item => {
        row.appendChild(
          createContentCard(item)
        );
      });
  } catch (error) {
    console.error(
      "Erro na busca:",
      error
    );

    row.innerHTML = `
      <div class="empty-row-message">
        Não foi possível realizar a busca.
      </div>
    `;
  }
}


function clearSearchResults() {
  const section =
    document.getElementById(
      "search-results-section"
    );

  const row =
    document.getElementById(
      "search-results-row"
    );

  if (row) {
    row.innerHTML = "";
  }

  if (section) {
    section.classList.add(
      "is-hidden"
    );

    section.classList.remove(
      "active"
    );
  }
}


async function openDetails(
  id,
  type
) {
  if (!id) {
    return;
  }

  const modal =
    document.getElementById(
      "details-modal"
    );

  if (!modal) {
    return;
  }

  modal.classList.add("active");
  modal.classList.remove("is-hidden");

  document.body.classList.add(
    "modal-open"
  );

  setDetailsLoading();

  try {
    const data =
      await api(
        `/api/details/${type}/${id}`
      );

    appState.currentDetails =
      data;

    renderDetails(data);

    addToHistory(
      normalizeHistoryItem(
        data
      )
    );
  } catch (error) {
    console.error(
      "Erro ao abrir detalhes:",
      error
    );

    showDetailsError(
      error.message
    );
  }
}


function setDetailsLoading() {
  const title =
    document.getElementById(
      "details-title"
    );

  const overview =
    document.getElementById(
      "details-overview"
    );

  const poster =
    document.getElementById(
      "details-poster"
    );

  const type =
    document.getElementById(
      "details-type"
    );

  const meta =
    document.getElementById(
      "details-meta"
    );

  const episodes =
    document.getElementById(
      "episodes-container"
    );

  if (title) {
    title.textContent =
      "Carregando...";
  }

  if (type) {
    type.textContent =
      "CINEFAMILY";
  }

  if (meta) {
    meta.textContent =
      "";
  }

  if (overview) {
    overview.textContent =
      "Carregando informações...";
  }

  if (poster) {
    poster.src =
      IMAGE_FALLBACK;
  }

  if (episodes) {
    episodes.innerHTML = "";
    episodes.classList.add(
      "is-hidden"
    );
  }
}


function showDetailsError(
  message
) {
  const overview =
    document.getElementById(
      "details-overview"
    );

  if (overview) {
    overview.innerHTML = `
      <span class="error-text">
        ${escapeHtml(
          message ||
          "Não foi possível carregar os detalhes."
        )}
      </span>
    `;
  }
}


function renderDetails(data) {
  const title =
    document.getElementById(
      "details-title"
    );

  const type =
    document.getElementById(
      "details-type"
    );

  const meta =
    document.getElementById(
      "details-meta"
    );

  const overview =
    document.getElementById(
      "details-overview"
    );

  const poster =
    document.getElementById(
      "details-poster"
    );

  const backdrop =
    document.getElementById(
      "details-backdrop"
    );

  const favoriteButton =
    document.getElementById(
      "details-favorite-button"
    );

  const watchButton =
    document.getElementById(
      "details-watch-button"
    );

  if (title) {
    title.textContent =
      data.title ||
      "Sem título";
  }

  if (type) {
    type.textContent =
      data.type === "tv"
        ? "SÉRIE"
        : "FILME";
  }

  if (meta) {
    meta.innerHTML =
      buildDetailsMeta(data);
  }

  if (overview) {
    overview.textContent =
      data.overview ||
      "Sinopse não disponível.";
  }

  if (poster) {
    poster.src =
      data.poster_path ||
      IMAGE_FALLBACK;

    poster.alt =
      data.title ||
      "CineFamily";
  }

  if (backdrop) {
    const image =
      data.backdrop_path ||
      data.poster_path ||
      BACKDROP_FALLBACK;

    backdrop.style.backgroundImage =
      `linear-gradient(90deg, rgba(5,5,7,0.98) 0%, rgba(5,5,7,0.76) 48%, rgba(5,5,7,0.35) 100%), url("${escapeAttribute(image)}")`;
  }

  if (favoriteButton) {
    favoriteButton.dataset.mediaId =
      data.id;

    favoriteButton.dataset.mediaType =
      data.type;

    updateFavoriteButton(
      favoriteButton,
      data
    );
  }

  if (watchButton) {
    watchButton.dataset.mediaId =
      data.id;

    watchButton.dataset.mediaType =
      data.type;
  }

  renderEpisodes(data);
  renderDetailsTrailer(data);
}


function buildDetailsMeta(data) {
  const parts = [];

  const year =
    getYear(
      data.release_date
    );

  if (year) {
    parts.push(
      `<span>${escapeHtml(year)}</span>`
    );
  }

  if (data.vote_average) {
    parts.push(
      `<span>★ ${escapeHtml(formatRating(data.vote_average))}</span>`
    );
  }

  if (data.runtime) {
    parts.push(
      `<span>${escapeHtml(formatRuntime(data.runtime))}</span>`
    );
  }

  if (
    Array.isArray(data.genres) &&
    data.genres.length
  ) {
    parts.push(
      `<span>${escapeHtml(
        data.genres
          .slice(0, 3)
          .map(genre => genre.name)
          .join(" • ")
      )}</span>`
    );
  }

  return parts.join("");
}


function formatRuntime(minutes) {
  const value =
    Number(minutes);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "";
  }

  const hours =
    Math.floor(value / 60);

  const remaining =
    value % 60;

  if (hours <= 0) {
    return `${remaining} min`;
  }

  if (remaining <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remaining}min`;
}


function renderDetailsTrailer(data) {
  const container =
    document.getElementById(
      "details-modal"
    );

  if (!container) {
    return;
  }

  const existing =
    container.querySelector(
      ".details-trailer"
    );

  if (existing) {
    existing.remove();
  }

  if (
    !data.trailer ||
    data.trailer.site !== "YouTube" ||
    !data.trailer.key
  ) {
    return;
  }

  const target =
    container.querySelector(
      ".details-content"
    ) ||
    container.querySelector(
      ".details-body"
    ) ||
    container;

  const trailer =
    document.createElement("div");

  trailer.className =
    "details-trailer";

  trailer.innerHTML = `
    <h3>Trailer</h3>
    <div class="details-trailer-frame">
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(data.trailer.key)}"
        title="${escapeAttribute(data.trailer.name || "Trailer")}"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>
  `;

  target.appendChild(trailer);
}


function renderEpisodes(data) {
  const container =
    document.getElementById(
      "episodes-container"
    );

  const list =
    document.getElementById(
      "episodes-list"
    );

  if (!container) {
    return;
  }

  if (data.type !== "tv") {
    container.classList.add(
      "is-hidden"
    );

    if (list) {
      list.innerHTML = "";
    }

    return;
  }

  container.classList.remove(
    "is-hidden"
  );

  if (!list) {
    return;
  }

  const seasons =
    Array.isArray(data.seasons)
      ? data.seasons.filter(
          season =>
            season.season_number >= 0
        )
      : [];

  if (!seasons.length) {
    list.innerHTML = `
      <div class="empty-row-message">
        Temporadas não disponíveis.
      </div>
    `;

    return;
  }

  list.innerHTML = "";

  seasons.forEach(season => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "episode-season-button";

    button.innerHTML = `
      <span>
        ${escapeHtml(
          season.name ||
          `Temporada ${season.season_number}`
        )}
      </span>
      <span>
        ${escapeHtml(
          String(
            season.episode_count || 0
          )
        )} episódios
      </span>
    `;

    button.addEventListener(
      "click",
      () => {
        loadSeasonEpisodes(
          data.id,
          season.season_number
        );
      }
    );

    list.appendChild(button);
  });
}


async function loadSeasonEpisodes(
  tvId,
  seasonNumber
) {
  const list =
    document.getElementById(
      "episodes-list"
    );

  if (!list) {
    return;
  }

  list.innerHTML = `
    <div class="search-loading">
      <span>Carregando episódios...</span>
    </div>
  `;

  try {
    const data =
      await api(
        `/api/tv/${tvId}/season/${seasonNumber}`
      );

    const episodes =
      Array.isArray(data.episodes)
        ? data.episodes
        : [];

    if (!episodes.length) {
      list.innerHTML = `
        <div class="empty-row-message">
          Nenhum episódio disponível.
        </div>
      `;

      return;
    }

    list.innerHTML = "";

    episodes.forEach(
      episode => {
        const button =
          document.createElement(
            "button"
          );

        button.type = "button";
        button.className =
          "episode-item";

        button.dataset.episodeId =
          episode.id;

        button.innerHTML = `
          <span class="episode-number">
            ${escapeHtml(
              String(
                episode.episode_number
              ).padStart(2, "0")
            )}
          </span>

          <span class="episode-info">
            <strong>
              ${escapeHtml(
                episode.name ||
                `Episódio ${episode.episode_number}`
              )}
            </strong>

            <small>
              ${escapeHtml(
                episode.air_date ||
                ""
              )}
            </small>
          </span>

          <span class="episode-play">
            ▶
          </span>
        `;

        button.addEventListener(
          "click",
          () => {
            openEpisode(
              tvId,
              seasonNumber,
              episode.episode_number,
              episode.name
            );
          }
        );

        list.appendChild(
          button
        );
      }
    );
  } catch (error) {
    console.error(
      "Erro ao carregar episódios:",
      error
    );

    list.innerHTML = `
      <div class="empty-row-message">
        Não foi possível carregar os episódios.
      </div>
    `;
  }
}


async function openEpisode(
  tvId,
  seasonNumber,
  episodeNumber,
  episodeName
) {
  try {
    const data =
      await api(
        `/api/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
      );

    appState.currentPlayer = {
      type: "episode",
      tvId,
      seasonNumber,
      episodeNumber,
      title:
        episodeName ||
        data.name ||
        `Episódio ${episodeNumber}`,
      data
    };

    openPlayer(
      appState.currentPlayer
    );
  } catch (error) {
    console.error(
      "Erro ao abrir episódio:",
      error
    );

    showToast(
      "Não foi possível abrir o episódio.",
      "error"
    );
  }
}
function setupModalControls() {
  const detailsClose =
    document.getElementById(
      "details-close"
    );

  const playerClose =
    document.getElementById(
      "player-close"
    );

  const profileClose =
    document.getElementById(
      "profile-close"
    );

  const detailsModal =
    document.getElementById(
      "details-modal"
    );

  const playerModal =
    document.getElementById(
      "player-modal"
    );

  const profileModal =
    document.getElementById(
      "profile-modal"
    );

  if (detailsClose) {
    detailsClose.addEventListener(
      "click",
      closeDetails
    );
  }

  if (playerClose) {
    playerClose.addEventListener(
      "click",
      closePlayer
    );
  }

  if (profileClose) {
    profileClose.addEventListener(
      "click",
      closeProfile
    );
  }

  if (detailsModal) {
    detailsModal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          detailsModal
        ) {
          closeDetails();
        }
      }
    );
  }

  if (playerModal) {
    playerModal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          playerModal
        ) {
          closePlayer();
        }
      }
    );
  }

  if (profileModal) {
    profileModal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          profileModal
        ) {
          closeProfile();
        }
      }
    );
  }
}


function closeDetails() {
  const modal =
    document.getElementById(
      "details-modal"
    );

  if (modal) {
    modal.classList.remove(
      "active"
    );

    modal.classList.add(
      "is-hidden"
    );
  }

  const trailer =
    document.querySelector(
      ".details-trailer"
    );

  if (trailer) {
    trailer.remove();
  }

  if (
    !document.querySelector(
      ".modal.active"
    )
  ) {
    document.body.classList.remove(
      "modal-open"
    );
  }
}


function openPlayer(player) {
  const modal =
    document.getElementById(
      "player-modal"
    );

  const title =
    document.getElementById(
      "player-title"
    );

  const body =
    document.getElementById(
      "player-body"
    );

  const status =
    document.getElementById(
      "player-status"
    );

  if (!modal || !body) {
    return;
  }

  if (title) {
    title.textContent =
      player.title ||
      "CineFamily";
  }

  body.innerHTML = "";

  const trailer =
    player.data &&
    player.data.trailer
      ? player.data.trailer
      : null;

  if (
    trailer &&
    trailer.site === "YouTube" &&
    trailer.key
  ) {
    const frame =
      document.createElement(
        "iframe"
      );

    frame.className =
      "player-video";

    frame.src =
      `https://www.youtube.com/embed/${encodeURIComponent(
        trailer.key
      )}?autoplay=1`;

    frame.title =
      escapeAttribute(
        trailer.name ||
        player.title ||
        "CineFamily"
      );

    frame.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

    frame.allowFullscreen =
      true;

    body.appendChild(
      frame
    );

    if (status) {
      status.textContent =
        "Trailer oficial";
    }
  } else {
    const message =
      document.createElement(
        "div"
      );

    message.className =
      "player-unavailable";

    message.innerHTML = `
      <div class="player-unavailable-icon">
        ▶
      </div>

      <h3>
        Reprodução não disponível
      </h3>

      <p>
        O CineFamily encontrou as informações
        deste conteúdo, mas não possui uma fonte
        de reprodução licenciada para este título.
      </p>

      <p>
        Você pode consultar o trailer ou voltar
        para os detalhes do conteúdo.
      </p>

      <button
        type="button"
        class="btn btn-primary"
        id="player-back-details"
      >
        Voltar aos detalhes
      </button>
    `;

    body.appendChild(
      message
    );

    const backButton =
      document.getElementById(
        "player-back-details"
      );

    if (backButton) {
      backButton.addEventListener(
        "click",
        () => {
          closePlayer();
        }
      );
    }

    if (status) {
      status.textContent =
        "Fonte de reprodução não disponível";
    }
  }

  modal.classList.remove(
    "is-hidden"
  );

  modal.classList.add(
    "active"
  );

  document.body.classList.add(
    "modal-open"
  );
}


function closePlayer() {
  const modal =
    document.getElementById(
      "player-modal"
    );

  const body =
    document.getElementById(
      "player-body"
    );

  if (body) {
    body.innerHTML = "";
  }

  if (modal) {
    modal.classList.remove(
      "active"
    );

    modal.classList.add(
      "is-hidden"
    );
  }

  if (
    !document.querySelector(
      ".modal.active"
    )
  ) {
    document.body.classList.remove(
      "modal-open"
    );
  }
}


function closeAllModals() {
  closeDetails();
  closePlayer();
  closeProfile();
}


function setupProfileControls() {
  const form =
    document.getElementById(
      "profile-form"
    );

  const editButton =
    document.getElementById(
      "user-profile-edit"
    );

  if (form) {
    form.addEventListener(
      "submit",
      saveProfileFromForm
    );
  }

  if (editButton) {
    editButton.addEventListener(
      "click",
      () => {
        closeUserMenu();
        openProfile();
      }
    );
  }
}


function openProfile() {
  const modal =
    document.getElementById(
      "profile-modal"
    );

  if (!modal) {
    return;
  }

  const nameInput =
    document.getElementById(
      "profile-name"
    );

  if (nameInput) {
    nameInput.value =
      appState.profile.name ||
      "";
  }

  const avatar =
    document.getElementById(
      "profile-avatar-large"
    );

  if (avatar) {
    avatar.textContent =
      appState.profile.avatar ||
      "👤";
  }

  modal.classList.remove(
    "is-hidden"
  );

  modal.classList.add(
    "active"
  );

  document.body.classList.add(
    "modal-open"
  );
}


function closeProfile() {
  const modal =
    document.getElementById(
      "profile-modal"
    );

  if (modal) {
    modal.classList.remove(
      "active"
    );

    modal.classList.add(
      "is-hidden"
    );
  }

  if (
    !document.querySelector(
      ".modal.active"
    )
  ) {
    document.body.classList.remove(
      "modal-open"
    );
  }
}


function saveProfileFromForm(
  event
) {
  event.preventDefault();

  const nameInput =
    document.getElementById(
      "profile-name"
    );

  const name =
    nameInput
      ? nameInput.value.trim()
      : "";

  const avatar =
    getSelectedAvatar();

  appState.profile = {
    name:
      name ||
      DEFAULT_PROFILE.name,
    avatar:
      avatar ||
      DEFAULT_PROFILE.avatar
  };

  saveStorage(
    STORAGE_PROFILE,
    appState.profile
  );

  renderProfile();
  closeProfile();

  showToast(
    "Perfil salvo com sucesso.",
    "success"
  );
}


function getSelectedAvatar() {
  const selected =
    document.querySelector(
      ".avatar-option.selected, " +
      ".avatar-option.active, " +
      "[data-avatar].selected, " +
      "[data-avatar].active"
    );

  if (selected) {
    return (
      selected.dataset.avatar ||
      selected.textContent.trim() ||
      DEFAULT_PROFILE.avatar
    );
  }

  const current =
    document.getElementById(
      "profile-avatar-large"
    );

  if (
    current &&
    current.textContent.trim()
  ) {
    return current.textContent.trim();
  }

  return DEFAULT_PROFILE.avatar;
}


function renderProfile() {
  const avatarLarge =
    document.getElementById(
      "profile-avatar-large"
    );

  const menuAvatar =
    document.getElementById(
      "user-menu-avatar"
    );

  const menuName =
    document.getElementById(
      "user-menu-name"
    );

  if (avatarLarge) {
    avatarLarge.textContent =
      appState.profile.avatar ||
      DEFAULT_PROFILE.avatar;
  }

  if (menuAvatar) {
    menuAvatar.textContent =
      appState.profile.avatar ||
      DEFAULT_PROFILE.avatar;
  }

  if (menuName) {
    menuName.textContent =
      appState.profile.name ||
      DEFAULT_PROFILE.name;
  }

  setupAvatarOptions();
}


function setupAvatarOptions() {
  const options =
    document.querySelectorAll(
      "[data-avatar]"
    );

  if (!options.length) {
    return;
  }

  options.forEach(option => {
    const value =
      option.dataset.avatar ||
      option.textContent.trim();

    if (
      value ===
      appState.profile.avatar
    ) {
      option.classList.add(
        "selected"
      );

      option.classList.add(
        "active"
      );
    }

    option.addEventListener(
      "click",
      () => {
        options.forEach(
          item => {
            item.classList.remove(
              "selected"
            );

            item.classList.remove(
              "active"
            );
          }
        );

        option.classList.add(
          "selected"
        );

        option.classList.add(
          "active"
        );

        const avatar =
          document.getElementById(
            "profile-avatar-large"
          );

        if (avatar) {
          avatar.textContent =
            value;
        }
      }
    );
  });
}


function setupUserMenu() {
  const menu =
    document.getElementById(
      "user-menu"
    );

  const avatarButton =
    document.querySelector(
      "[data-user-menu-toggle]"
    );

  const profileButton =
    document.getElementById(
      "user-profile-edit"
    );

  const favoritesButton =
    document.getElementById(
      "user-favorites-button"
    );

  const historyButton =
    document.getElementById(
      "user-history-button"
    );

  if (avatarButton) {
    avatarButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        toggleUserMenu();
      }
    );
  }

  if (favoritesButton) {
    favoritesButton.addEventListener(
      "click",
      () => {
        window.location.href =
          "favoritos.html";
      }
    );
  }

  if (historyButton) {
    historyButton.addEventListener(
      "click",
      () => {
        window.location.href =
          "historico.html";
      }
    );
  }

  if (profileButton) {
    profileButton.addEventListener(
      "click",
      () => {
        closeUserMenu();
        openProfile();
      }
    );
  }

  document.addEventListener(
    "click",
    event => {
      if (
        menu &&
        !menu.contains(event.target) &&
        !event.target.closest(
          "[data-user-menu-toggle]"
        )
      ) {
        closeUserMenu();
      }
    }
  );
}


function toggleUserMenu() {
  const menu =
    document.getElementById(
      "user-menu"
    );

  if (!menu) {
    return;
  }

  const hidden =
    menu.classList.contains(
      "is-hidden"
    );

  menu.classList.toggle(
    "is-hidden",
    !hidden
  );

  menu.classList.toggle(
    "active",
    hidden
  );
}


function closeUserMenu() {
  const menu =
    document.getElementById(
      "user-menu"
    );

  if (!menu) {
    return;
  }

  menu.classList.add(
    "is-hidden"
  );

  menu.classList.remove(
    "active"
  );
}


function setupNavigation() {
  const links =
    document.querySelectorAll(
      ".main-nav a"
    );

  links.forEach(link => {
    link.addEventListener(
      "click",
      event => {
        const href =
          link.getAttribute(
            "href"
          );

        if (
          !href ||
          href === "#"
        ) {
          return;
        }

        if (
          href.startsWith("#")
        ) {
          event.preventDefault();

          const target =
            document.querySelector(
              href
            );

          if (target) {
            target.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        }
      }
    );
  });
}


function isFavorite(
  id,
  type
) {
  return appState.favorites.some(
    item =>
      Number(item.id) === Number(id) &&
      item.type === type
  );
}


function toggleFavorite(item) {
  if (!item || !item.id) {
    return;
  }

  if (
    isFavorite(
      item.id,
      item.type
    )
  ) {
    removeFavoriteItem(
      item.id,
      item.type
    );

    showToast(
      "Removido dos favoritos.",
      "info"
    );

    return;
  }

  const favorite = {
    id: item.id,
    type: item.type,
    title:
      item.title ||
      "Sem título",
    poster_path:
      item.poster_path ||
      "",
    backdrop_path:
      item.backdrop_path ||
      "",
    overview:
      item.overview ||
      "",
    vote_average:
      Number(
        item.vote_average || 0
      ),
    release_date:
      item.release_date ||
      "",
    added_at:
      Date.now()
  };

  appState.favorites.unshift(
    favorite
  );

  appState.favorites =
    removeDuplicateItems(
      appState.favorites
    );

  saveStorage(
    STORAGE_FAVORITES,
    appState.favorites
  );

  refreshFavoriteVisuals(
    item.id,
    item.type
  );

  renderFavoritesRow();

  showToast(
    "Adicionado aos favoritos.",
    "success"
  );
}


function removeFavoriteItem(
  id,
  type
) {
  appState.favorites =
    appState.favorites.filter(
      item =>
        !(
          Number(item.id) ===
            Number(id) &&
          item.type === type
        )
    );

  saveStorage(
    STORAGE_FAVORITES,
    appState.favorites
  );

  refreshFavoriteVisuals(
    id,
    type
  );

  renderFavoritesRow();
}


function refreshFavoriteVisuals(
  id,
  type
) {
  document
    .querySelectorAll(
      `[data-action='favorite'][data-media-id='${id}'][data-media-type='${type}']`
    )
    .forEach(button => {
      const active =
        isFavorite(
          id,
          type
        );

      button.classList.toggle(
        "active",
        active
      );

      button.textContent =
        active ? "★" : "☆";

      button.setAttribute(
        "aria-label",
        active
          ? "Remover dos favoritos"
          : "Adicionar aos favoritos"
      );
    });

  const detailsButton =
    document.getElementById(
      "details-favorite-button"
    );

  if (
    detailsButton &&
    Number(
      detailsButton.dataset.mediaId
    ) === Number(id) &&
    detailsButton.dataset.mediaType ===
      type
  ) {
    const item =
      findItemByIdAndType(
        id,
        type
      );

    if (item) {
      updateFavoriteButton(
        detailsButton,
        item
      );
    }
  }
}


function updateFavoriteButton(
  button,
  item
) {
  const active =
    isFavorite(
      item.id,
      item.type
    );

  button.classList.toggle(
    "active",
    active
  );

  button.textContent =
    active
      ? "★ Favorito"
      : "☆ Favoritar";

  button.setAttribute(
    "aria-label",
    active
      ? "Remover dos favoritos"
      : "Adicionar aos favoritos"
  );
}


function findItemByIdAndType(
  id,
  type
) {
  const collections = [
    appState.heroItems,
    appState.home
      ? appState.home.filmes
      : [],
    appState.home
      ? appState.home.series
      : [],
    appState.home
      ? appState.home.filmes_populares
      : [],
    appState.home
      ? appState.home.series_populares
      : [],
    appState.favorites,
    appState.history
  ];

  for (
    const collection of collections
  ) {
    if (
      !Array.isArray(collection)
    ) {
      continue;
    }

    const found =
      collection.find(
        item =>
          Number(item.id) ===
            Number(id) &&
          item.type === type
      );

    if (found) {
      return found;
    }
  }

  return null;
}


function normalizeHistoryItem(
  item
) {
  return {
    id: item.id,
    type: item.type,
    title:
      item.title ||
      "Sem título",
    poster_path:
      item.poster_path ||
      "",
    backdrop_path:
      item.backdrop_path ||
      "",
    overview:
      item.overview ||
      "",
    vote_average:
      Number(
        item.vote_average || 0
      ),
    release_date:
      item.release_date ||
      "",
    watched_at:
      Date.now()
  };
}


function addToHistory(item) {
  if (!item || !item.id) {
    return;
  }

  const filtered =
    appState.history.filter(
      entry =>
        !(
          Number(entry.id) ===
            Number(item.id) &&
          entry.type === item.type
        )
    );

  appState.history = [
    {
      ...item,
      watched_at:
        Date.now()
    },
    ...filtered
  ].slice(0, 50);

  saveStorage(
    STORAGE_HISTORY,
    appState.history
  );

  renderContinueRow();
}


function removeHistoryItem(
  id,
  type
) {
  appState.history =
    appState.history.filter(
      item =>
        !(
          Number(item.id) ===
            Number(id) &&
          item.type === type
        )
    );

  saveStorage(
    STORAGE_HISTORY,
    appState.history
  );

  renderContinueRow();

  showToast(
    "Item removido do histórico.",
    "info"
  );
}


function clearHistory() {
  appState.history = [];

  saveStorage(
    STORAGE_HISTORY,
    appState.history
  );

  renderContinueRow();

  showToast(
    "Histórico limpo.",
    "success"
  );
}


function renderFavoritesRow() {
  const row =
    document.getElementById(
      "favorites-row"
    );

  if (!row) {
    return;
  }

  if (
    !appState.favorites.length
  ) {
    row.innerHTML = `
      <div class="empty-row-message">
        Você ainda não adicionou favoritos.
      </div>
    `;

    return;
  }

  row.innerHTML = "";

  appState.favorites
    .slice(0, 20)
    .forEach(item => {
      row.appendChild(
        createContentCard(item)
      );
    });
}


function renderContinueRow() {
  const row =
    document.getElementById(
      "continue-row"
    );

  if (!row) {
    return;
  }

  if (
    !appState.history.length
  ) {
    row.innerHTML = `
      <div class="empty-row-message">
        Seu histórico de conteúdos aparecerá aqui.
      </div>
    `;

    return;
  }

  row.innerHTML = "";

  appState.history
    .slice(0, 20)
    .forEach(item => {
      const card =
        createHistoryCard(item);

      row.appendChild(card);
    });
}


function createHistoryCard(item) {
  const article =
    createContentCard(item);

  const removeButton =
    document.createElement(
      "button"
    );

  removeButton.type = "button";
  removeButton.className =
    "history-remove-button";

  removeButton.dataset.action =
    "remove-history";

  removeButton.dataset.mediaId =
    item.id;

  removeButton.dataset.mediaType =
    item.type;

  removeButton.textContent =
    "×";

  removeButton.title =
    "Remover do histórico";

  const poster =
    article.querySelector(
      ".content-card-poster"
    );

  if (poster) {
    poster.appendChild(
      removeButton
    );
  }

  return article;
}


function showToast(
  message,
  type = "info"
) {
  const container =
    document.getElementById(
      "toast-container"
    );

  if (!container) {
    return;
  }

  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    `toast toast-${type}`;

  toast.innerHTML = `
    <span class="toast-icon">
      ${
        type === "success"
          ? "✓"
          : type === "error"
            ? "!"
            : "i"
      }
    </span>

    <span class="toast-message">
      ${escapeHtml(message)}
    </span>
  `;

  container.appendChild(
    toast
  );

  window.setTimeout(
    () => {
      toast.classList.add(
        "leaving"
      );

      window.setTimeout(
        () => {
          toast.remove();
        },
        300
      );
    },
    3200
  );
}


function setupPlayerFullscreen() {
  const button =
    document.getElementById(
      "player-fullscreen"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {
      const body =
        document.getElementById(
          "player-body"
        );

      if (!body) {
        return;
      }

      try {
        if (
          document.fullscreenElement
        ) {
          await document.exitFullscreen();
        } else {
          await body.requestFullscreen();
        }
      } catch (error) {
        console.error(
          "Erro ao ativar tela cheia:",
          error
        );
      }
    }
  );
}
function setupKeyboardNavigation() {
  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }

      const activeElement =
        document.activeElement;

      if (
        isTypingInField(activeElement)
      ) {
        return;
      }

      const cards =
        Array.from(
          document.querySelectorAll(
            ".content-card"
          )
        );

      if (!cards.length) {
        return;
      }

      const currentIndex =
        cards.indexOf(
          activeElement
        );

      if (currentIndex < 0) {
        return;
      }

      let nextIndex =
        event.key === "ArrowRight"
          ? currentIndex + 1
          : currentIndex - 1;

      if (nextIndex < 0) {
        nextIndex =
          cards.length - 1;
      }

      if (
        nextIndex >= cards.length
      ) {
        nextIndex = 0;
      }

      event.preventDefault();

      cards[nextIndex].focus({
        preventScroll: false
      });
    }
  );
}


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

      const targetId =
        button.dataset.scroll;

      const direction =
        button.dataset.direction ===
        "left"
          ? -1
          : 1;

      const row =
        document.getElementById(
          targetId
        );

      if (!row) {
        return;
      }

      const amount =
        Math.max(
          row.clientWidth * 0.8,
          400
        );

      row.scrollBy({
        left:
          amount * direction,
        behavior: "smooth"
      });
    }
  );
}


function setupImageFallbacks() {
  document.addEventListener(
    "error",
    event => {
      const target =
        event.target;

      if (
        target &&
        target.tagName === "IMG"
      ) {
        if (
          target.dataset.fallbackApplied
        ) {
          return;
        }

        target.dataset.fallbackApplied =
          "true";

        target.src =
          IMAGE_FALLBACK;
      }
    },
    true
  );
}


function setupAvatarFallback() {
  const avatarButtons =
    document.querySelectorAll(
      "[data-avatar]"
    );

  avatarButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          const value =
            button.dataset.avatar ||
            button.textContent.trim();

          if (!value) {
            return;
          }

          appState.profile.avatar =
            value;

          const avatarLarge =
            document.getElementById(
              "profile-avatar-large"
            );

          if (avatarLarge) {
            avatarLarge.textContent =
              value;
          }

          document
            .querySelectorAll(
              "[data-avatar]"
            )
            .forEach(item => {
              item.classList.remove(
                "selected"
              );

              item.classList.remove(
                "active"
              );
            });

          button.classList.add(
            "selected"
          );

          button.classList.add(
            "active"
          );
        }
      );
    }
  );
}


function setupHeaderUserButton() {
  const buttons =
    document.querySelectorAll(
      "[data-user-menu-toggle]"
    );

  buttons.forEach(button => {
    button.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          toggleUserMenu();
        }
      }
    );
  });
}


function setupFavoriteDetailsButton() {
  const button =
    document.getElementById(
      "details-favorite-button"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    () => {
      const id =
        Number(
          button.dataset.mediaId
        );

      const type =
        button.dataset.mediaType ||
        "movie";

      if (!id) {
        return;
      }

      let item =
        appState.currentDetails;

      if (
        !item ||
        Number(item.id) !== id ||
        item.type !== type
      ) {
        item =
          findItemByIdAndType(
            id,
            type
          );
      }

      if (item) {
        toggleFavorite(item);
      }
    }
  );
}


function setupWatchButtons() {
  const buttons =
    document.querySelectorAll(
      "#details-watch-button"
    );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const id =
          Number(
            button.dataset.mediaId
          );

        const type =
          button.dataset.mediaType ||
          "movie";

        if (!id) {
          return;
        }

        if (type === "tv") {
          const details =
            appState.currentDetails;

          if (
            details &&
            Array.isArray(
              details.seasons
            ) &&
            details.seasons.length
          ) {
            const firstSeason =
              details.seasons.find(
                season =>
                  Number(
                    season.season_number
                  ) > 0
              ) ||
              details.seasons[0];

            if (firstSeason) {
              loadSeasonEpisodes(
                id,
                firstSeason.season_number
              );

              showToast(
                "Escolha um episódio para assistir.",
                "info"
              );

              return;
            }
          }
        }

        openPlayer({
          type,
          id,
          title:
            detailsTitleForPlayer(),
          data:
            appState.currentDetails ||
            {}
        });
      }
    );
  });
}


function detailsTitleForPlayer() {
  const title =
    document.getElementById(
      "details-title"
    );

  if (
    title &&
    title.textContent.trim()
  ) {
    return title.textContent.trim();
  }

  if (
    appState.currentDetails &&
    appState.currentDetails.title
  ) {
    return appState.currentDetails.title;
  }

  return "CineFamily";
}


function setupCloseButtons() {
  const buttons =
    document.querySelectorAll(
      "[data-close-modal]"
    );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const target =
          button.dataset.closeModal;

        if (
          target === "details"
        ) {
          closeDetails();
        } else if (
          target === "player"
        ) {
          closePlayer();
        } else if (
          target === "profile"
        ) {
          closeProfile();
        } else {
          closeAllModals();
        }
      }
    );
  });
}


function setupHistoryPage() {
  const clearButton =
    document.getElementById(
      "limpar-historico"
    );

  if (!clearButton) {
    return;
  }

  clearButton.addEventListener(
    "click",
    () => {
      const confirmed =
        window.confirm(
          "Tem certeza que deseja limpar todo o histórico?"
        );

      if (!confirmed) {
        return;
      }

      clearHistory();

      const list =
        document.getElementById(
          "lista-historico"
        );

      if (list) {
        list.innerHTML = "";
      }
    }
  );
}


function setupFavoritesPage() {
  const list =
    document.getElementById(
      "lista-favoritos"
    );

  const empty =
    document.getElementById(
      "nenhum-favorito"
    );

  if (!list) {
    return;
  }

  renderFavoritesPage(
    list,
    empty
  );
}


function renderFavoritesPage(
  list,
  empty
) {
  list.innerHTML = "";

  if (
    !appState.favorites.length
  ) {
    if (empty) {
      empty.classList.remove(
        "is-hidden"
      );

      empty.style.display =
        "block";
    }

    return;
  }

  if (empty) {
    empty.classList.add(
      "is-hidden"
    );

    empty.style.display =
      "none";
  }

  appState.favorites.forEach(
    item => {
      const card =
        createContentCard(item);

      const remove =
        document.createElement(
          "button"
        );

      remove.type = "button";
      remove.className =
        "page-remove-button";

      remove.dataset.action =
        "remove-favorite";

      remove.dataset.mediaId =
        item.id;

      remove.dataset.mediaType =
        item.type;

      remove.textContent =
        "Remover";

      card.appendChild(
        remove
      );

      list.appendChild(
        card
      );
    }
  );
}


function setupStandalonePages() {
  setupFavoritesPage();
  setupHistoryStandalonePage();
}


function setupHistoryStandalonePage() {
  const list =
    document.getElementById(
      "lista-historico"
    );

  const empty =
    document.getElementById(
      "nenhum-historico"
    );

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (
    !appState.history.length
  ) {
    if (empty) {
      empty.classList.remove(
        "is-hidden"
      );

      empty.style.display =
        "block";
    }

    return;
  }

  if (empty) {
    empty.classList.add(
      "is-hidden"
    );

    empty.style.display =
      "none";
  }

  appState.history.forEach(
    item => {
      const card =
        createHistoryCard(item);

      list.appendChild(
        card
      );
    }
  );
}


function detectCurrentPage() {
  const path =
    window.location.pathname
      .toLowerCase();

  if (
    path.endsWith(
      "favoritos.html"
    )
  ) {
    return "favorites";
  }

  if (
    path.endsWith(
      "historico.html"
    )
  ) {
    return "history";
  }

  return "home";
}


function initializeAdditionalFeatures() {
  setupKeyboardNavigation();
  setupScrollButtons();
  setupImageFallbacks();
  setupAvatarFallback();
  setupHeaderUserButton();
  setupFavoriteDetailsButton();
  setupWatchButtons();
  setupCloseButtons();
  setupHistoryPage();

  const page =
    detectCurrentPage();

  if (
    page === "favorites" ||
    page === "history"
  ) {
    setupStandalonePages();
  }
}


function initializeAfterDOM() {
  initializeAdditionalFeatures();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAfterDOM,
    {
      once: true
    }
  );
} else {
  initializeAfterDOM();
}


window.CineFamily = {
  openDetails,
  closeDetails,
  openPlayer,
  closePlayer,
  toggleFavorite,
  addToHistory,
  clearHistory,
  loadHome,
  performSearch,
  toggleSearch,
  openProfile,
  closeProfile
};
