"use strict";

const TMDB_WORKER =
    "https://cinefamily-tmdb.thabsleao.workers.dev";

const IMG =
    "https://image.tmdb.org/t/p/w500";

const BACKDROP =
    "https://image.tmdb.org/t/p/w1280";

const STORAGE_FAVORITOS =
    "cinefamily_favoritos";

const STORAGE_HISTORICO =
    "cinefamily_historico";

const LEGACY_FAVORITOS =
    "cinefamilyFavoritos";

const LEGACY_HISTORICO =
    "cinefamilyHistorico";

const MAX_ITENS_SECAO = 10;

const appState = {
    filmes: [],
    series: [],
    favoritos: [],
    historico: [],
    buscaAtiva: false,
    slideAtual: 0,
    intervaloSlider: null
};

function textoOuPadrao(valor, padrao = "") {
    if (
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ""
    ) {
        return padrao;
    }

    return String(valor);
}

function obterTitulo(item) {
    if (!item) {
        return "Sem título";
    }

    return textoOuPadrao(
        item.title ||
        item.name ||
        item.original_title ||
        item.original_name,
        "Sem título"
    );
}

function obterTituloOriginal(item) {
    if (!item) {
        return "";
    }

    return textoOuPadrao(
        item.original_title ||
        item.original_name,
        ""
    );
}

function obterData(item) {
    if (!item) {
        return "";
    }

    return textoOuPadrao(
        item.release_date ||
        item.first_air_date,
        ""
    );
}

function obterAno(item) {
    const data = obterData(item);

    if (!data || data.length < 4) {
        return "";
    }

    return data.substring(0, 4);
}

function obterNota(item) {
    const nota = Number(
        item?.vote_average || 0
    );

    if (!Number.isFinite(nota)) {
        return "0.0";
    }

    return nota.toFixed(1);
}

function descobrirTipo(item, tipoForcado) {
    if (tipoForcado === "movie") {
        return "movie";
    }

    if (tipoForcado === "tv") {
        return "tv";
    }

    if (
        item?.type === "tv" ||
        item?.media_type === "tv"
    ) {
        return "tv";
    }

    return "movie";
}

function conteudoPermitido(item) {
    if (!item) {
        return false;
    }

    return item.adult !== true;
}

function filtrarConteudos(lista, tipo) {
    if (!Array.isArray(lista)) {
        return [];
    }

    return lista.filter(function (item) {
        if (!conteudoPermitido(item)) {
            return false;
        }

        if (tipo === "movie") {
            return descobrirTipo(item) === "movie";
        }

        if (tipo === "tv") {
            return descobrirTipo(item) === "tv";
        }

        return true;
    });
}

function obterImagem(item) {
    if (!item) {
        return "";
    }

    if (
        item.poster_path &&
        String(item.poster_path).startsWith("http")
    ) {
        return item.poster_path;
    }

    if (item.poster_path) {
        return IMG + item.poster_path;
    }

    return "";
}

function obterBackdrop(item) {
    if (!item) {
        return "";
    }

    if (
        item.backdrop_path &&
        String(item.backdrop_path).startsWith("http")
    ) {
        return item.backdrop_path;
    }

    if (item.backdrop_path) {
        return BACKDROP + item.backdrop_path;
    }

    return "";
}

function escaparHTML(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escaparAtributo(valor) {
    return escaparHTML(valor);
}

async function buscarTMDB(endpoint) {
    const caminho = String(endpoint || "");

    const url =
        caminho.startsWith("http://") ||
        caminho.startsWith("https://")
            ? caminho
            : TMDB_WORKER +
              (
                  caminho.startsWith("/")
                      ? caminho
                      : "/" + caminho
              );

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        });

        const texto =
            await response.text();

        let dados = {};

        try {
            dados = texto
                ? JSON.parse(texto)
                : {};
        } catch (erro) {
            throw new Error(
                "Resposta inválida do Worker."
            );
        }

        if (!response.ok) {
            throw new Error(
                dados.erro ||
                dados.message ||
                `Erro HTTP ${response.status}`
            );
        }

        return dados;
    } catch (erro) {
        console.error(
            "Erro no Worker:",
            caminho,
            erro
        );

        return {
            ok: false,
            erro:
                erro?.message ||
                "Erro ao acessar o Worker.",
            results: []
        };
    }
}

function extrairResultados(resposta) {
    if (!resposta) {
        return [];
    }

    if (Array.isArray(resposta)) {
        return resposta;
    }

    if (Array.isArray(resposta.results)) {
        return resposta.results;
    }

    if (Array.isArray(resposta.data)) {
        return resposta.data;
    }

    if (Array.isArray(resposta.items)) {
        return resposta.items;
    }

    return [];
}

function encontrarSecao(id) {
    const possibilidades = [
        id,
        `secao-${id}`,
        `${id}-section`,
        `${id}-section-container`
    ];

    for (const valor of possibilidades) {
        const elemento =
            document.getElementById(valor);

        if (elemento) {
            return elemento;
        }
    }

    const seletores = [
        `[data-secao="${id}"]`,
        `[data-section="${id}"]`,
        `section.${id}`,
        `section[data-id="${id}"]`
    ];

    for (const seletor of seletores) {
        const elemento =
            document.querySelector(seletor);

        if (elemento) {
            return elemento;
        }
    }

    return null;
}

function encontrarContainerCards(secao) {
    if (!secao) {
        return null;
    }

    const seletores = [
        ".cards",
        ".cards-container",
        ".card-container",
        ".row-cards",
        ".filmes-row",
        ".series-row",
        ".conteudos",
        ".conteudo-row",
        ".lista",
        ".grid"
    ];

    for (const seletor of seletores) {
        const elemento =
            secao.querySelector(seletor);

        if (elemento) {
            return elemento;
        }
    }

    return secao;
}

function criarCard(conteudo, tipoForcado) {
    if (!conteudoPermitido(conteudo)) {
        return null;
    }

    const id =
        conteudo.id ||
        conteudo.tmdb_id;

    if (!id) {
        return null;
    }

    const tipo =
        descobrirTipo(
            conteudo,
            tipoForcado
        );

    const titulo =
        obterTitulo(conteudo);

    const poster =
        obterImagem(conteudo);

    const ano =
        obterAno(conteudo);

    const nota =
        obterNota(conteudo);

    const card =
        document.createElement("article");

    card.className = "card";

    card.dataset.id = String(id);
    card.dataset.tipo = tipo;
    card.tabIndex = 0;

    const imagem =
        poster ||
        "https://via.placeholder.com/500x750/111111/ffffff?text=CineFamily";

    card.innerHTML = `
        <div class="card-poster">
            <img
                src="${escaparAtributo(imagem)}"
                alt="${escaparAtributo(titulo)}"
                loading="lazy"
            >
            <div class="card-overlay">
                <span class="card-nota">
                    ★ ${escaparHTML(nota)}
                </span>
            </div>
        </div>

        <div class="card-info">
            <h3>${escaparHTML(titulo)}</h3>
            ${
                ano
                    ? `<span>${escaparHTML(ano)}</span>`
                    : ""
            }
        </div>
    `;

    function abrir() {
        abrirDetalhes(
            conteudo,
            tipo
        );
    }

    card.addEventListener(
        "click",
        abrir
    );

    card.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                abrir();
            }
        }
    );

    return card;
}

function mostrarNaSecao(
    lista,
    secaoId,
    tipo
) {
    const secao =
        encontrarSecao(secaoId);

    if (!secao) {
        return;
    }

    const container =
        encontrarContainerCards(secao);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const itens =
        Array.isArray(lista)
            ? lista
            : [];

    itens
        .filter(conteudoPermitido)
        .slice(
            0,
            MAX_ITENS_SECAO
        )
        .forEach(function (item) {
            const card =
                criarCard(item, tipo);

            if (card) {
                container.appendChild(card);
            }
        });
}

async function carregarFilmes() {
    try {
        const resposta =
            await buscarTMDB(
                "/api/movies?page=1&sort_by=popularity.desc"
            );

        if (
            !resposta ||
            resposta.ok === false
        ) {
            console.error(
                "Erro ao carregar filmes:",
                resposta
            );

            return;
        }

        const filmes =
            filtrarConteudos(
                extrairResultados(resposta),
                "movie"
            );

        appState.filmes = filmes;

        mostrarNaSecao(
            filmes,
            "filmes",
            "movie"
        );

        const populares =
            await buscarTMDB(
                "/api/movies?page=1&sort_by=vote_average.desc"
            );

        if (
            populares &&
            populares.ok !== false
        ) {
            mostrarNaSecao(
                filtrarConteudos(
                    extrairResultados(
                        populares
                    ),
                    "movie"
                ),
                "top-rated",
                "movie"
            );
        }

        const recentes =
            await buscarTMDB(
                "/api/movies?page=1&sort_by=primary_release_date.desc"
            );

        if (
            recentes &&
            recentes.ok !== false
        ) {
            mostrarNaSecao(
                filtrarConteudos(
                    extrairResultados(
                        recentes
                    ),
                    "movie"
                ),
                "latest",
                "movie"
            );
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar filmes:",
            erro
        );
    }
}

async function carregarSeries() {
    try {
        const resposta =
            await buscarTMDB(
                "/api/series?page=1&sort_by=popularity.desc"
            );

        if (
            !resposta ||
            resposta.ok === false
        ) {
            console.error(
                "Erro ao carregar séries:",
                resposta
            );

            return;
        }

        const series =
            filtrarConteudos(
                extrairResultados(resposta),
                "tv"
            );

        appState.series = series;

        mostrarNaSecao(
            series,
            "series",
            "tv"
        );

        const populares =
            await buscarTMDB(
                "/api/series?page=1&sort_by=vote_average.desc"
            );

        if (
            populares &&
            populares.ok !== false
        ) {
            mostrarNaSecao(
                filtrarConteudos(
                    extrairResultados(
                        populares
                    ),
                    "tv"
                ),
                "series-populares",
                "tv"
            );
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar séries:",
            erro
        );
    }
}

function iniciarSlider() {
    const slides =
        document.querySelectorAll(
            ".slide, .hero-slide, .destaque-slide"
        );

    if (slides.length <= 1) {
        return;
    }

    appState.slideAtual = 0;

    slides.forEach(
        function (slide, index) {
            slide.classList.toggle(
                "active",
                index === 0
            );
        }
    );

    clearInterval(
        appState.intervaloSlider
    );

    appState.intervaloSlider =
        setInterval(
            function () {
                mostrarProximoSlide(
                    slides
                );
            },
            7000
        );
}

function mostrarProximoSlide(
    slides
) {
    if (!slides || !slides.length) {
        return;
    }

    slides[
        appState.slideAtual
    ].classList.remove("active");

    appState.slideAtual =
        (
            appState.slideAtual + 1
        ) % slides.length;

    slides[
        appState.slideAtual
    ].classList.add("active");
}
async function executarBusca() {
    const campos = [
        "#campo-busca",
        "#search",
        "#search-input",
        ".campo-busca"
    ];

    let campo = null;

    for (const seletor of campos) {
        campo =
            document.querySelector(seletor);

        if (campo) {
            break;
        }
    }

    if (!campo) {
        return;
    }

    const termo =
        String(
            campo.value || ""
        ).trim();

    if (!termo) {
        return;
    }

    const resposta =
        await buscarTMDB(
            "/api/search?q=" +
            encodeURIComponent(termo)
        );

    const resultados =
        filtrarConteudos(
            extrairResultados(resposta)
        );

    let container =
        document.querySelector(
            "#resultados-busca"
        );

    if (!container) {
        container =
            document.querySelector(
                "#resultados"
            );
    }

    if (!container) {
        container =
            document.querySelector(
                ".resultados-busca"
            );
    }

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!resultados.length) {
        container.innerHTML = `
            <div class="mensagem-vazia">
                Nenhum resultado encontrado.
            </div>
        `;

        return;
    }

    resultados.forEach(
        function (item) {
            const tipo =
                descobrirTipo(item);

            const card =
                criarCard(
                    item,
                    tipo
                );

            if (card) {
                container.appendChild(card);
            }
        }
    );

    appState.buscaAtiva = true;
}

function abrirAreaBusca() {
    const elementos = [
        "#area-busca",
        "#busca-area",
        ".area-busca",
        ".busca-container",
        ".search-container"
    ];

    for (const seletor of elementos) {
        const elemento =
            document.querySelector(seletor);

        if (elemento) {
            elemento.classList.add("ativa");
            elemento.classList.add("aberta");
            elemento.style.display = "";
        }
    }

    const campo =
        document.querySelector(
            "#campo-busca, #search, #search-input"
        );

    if (campo) {
        setTimeout(
            function () {
                campo.focus();
            },
            50
        );
    }
}

function fecharAreaBusca() {
    const elementos = [
        "#area-busca",
        "#busca-area",
        ".area-busca",
        ".busca-container",
        ".search-container"
    ];

    for (const seletor of elementos) {
        const elemento =
            document.querySelector(seletor);

        if (elemento) {
            elemento.classList.remove(
                "ativa"
            );

            elemento.classList.remove(
                "aberta"
            );
        }
    }
}

function configurarBusca() {
    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Enter" &&
                document.activeElement &&
                (
                    document.activeElement.matches(
                        "#campo-busca"
                    ) ||
                    document.activeElement.matches(
                        "#search"
                    ) ||
                    document.activeElement.matches(
                        "#search-input"
                    )
                )
            ) {
                event.preventDefault();
                executarBusca();
            }
        }
    );

    document.addEventListener(
        "click",
        function (event) {
            const botao =
                event.target.closest(
                    "#botao-busca, #btn-busca, #btn-search, .botao-busca, .abrir-busca"
                );

            if (botao) {
                event.preventDefault();
                abrirAreaBusca();
            }
        }
    );
}

function normalizarConteudo(
    conteudo,
    tipo
) {
    if (!conteudo) {
        return null;
    }

    const resultado = {
        ...conteudo
    };

    resultado.id =
        Number(
            conteudo.id ||
            conteudo.tmdb_id ||
            0
        );

    resultado.type =
        descobrirTipo(
            conteudo,
            tipo
        );

    resultado.media_type =
        resultado.type;

    resultado.title =
        conteudo.title ||
        conteudo.name ||
        conteudo.original_title ||
        conteudo.original_name ||
        "Sem título";

    resultado.original_title =
        conteudo.original_title ||
        conteudo.original_name ||
        "";

    resultado.poster_path =
        conteudo.poster_path ||
        "";

    resultado.backdrop_path =
        conteudo.backdrop_path ||
        "";

    resultado.overview =
        conteudo.overview ||
        "";

    resultado.vote_average =
        Number(
            conteudo.vote_average || 0
        );

    resultado.release_date =
        conteudo.release_date ||
        conteudo.first_air_date ||
        "";

    resultado.adult =
        conteudo.adult === true;

    return resultado;
}

function obterIdSeguro(conteudo) {
    const id =
        Number(
            conteudo?.id ||
            conteudo?.tmdb_id ||
            0
        );

    if (
        !Number.isFinite(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}

async function abrirDetalhes(
    conteudo,
    tipo
) {
    if (!conteudo) {
        return;
    }

    const id =
        obterIdSeguro(conteudo);

    if (!id) {
        console.error(
            "Conteúdo sem ID válido:",
            conteudo
        );

        return;
    }

    tipo =
        descobrirTipo(
            conteudo,
            tipo
        );

    if (
        tipo !== "movie" &&
        tipo !== "tv"
    ) {
        return;
    }

    registrarHistorico(
        conteudo
    );

    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        criarModalDetalhes();
    }

    const modalFinal =
        document.getElementById(
            "details-modal"
        );

    if (!modalFinal) {
        return;
    }

    modalFinal.hidden = false;

    modalFinal.setAttribute(
        "aria-hidden",
        "false"
    );

    modalFinal.style.display = "flex";
    modalFinal.style.visibility = "visible";
    modalFinal.style.opacity = "1";
    modalFinal.style.pointerEvents = "auto";

    const endpoint =
        tipo === "tv"
            ? `/api/tv/${id}`
            : `/api/movie/${id}`;

    const resposta =
        await buscarTMDB(endpoint);

    if (
        !resposta ||
        resposta.ok === false
    ) {
        preencherDetalhes(
            modalFinal,
            conteudo,
            tipo
        );

        mostrarToast(
            "Não foi possível carregar todos os detalhes."
        );

        return;
    }

    let detalhes =
        resposta.data ||
        resposta.result ||
        resposta.movie ||
        resposta.tv ||
        resposta;

    if (
        detalhes &&
        detalhes.ok === true &&
        detalhes.id
    ) {
        detalhes = detalhes;
    }

    detalhes =
        normalizarConteudo(
            {
                ...conteudo,
                ...detalhes
            },
            tipo
        );

    preencherDetalhes(
        modalFinal,
        detalhes,
        tipo
    );
}

function criarModalDetalhes() {
    if (
        document.getElementById(
            "details-modal"
        )
    ) {
        return;
    }

    const modal =
        document.createElement("div");

    modal.id =
        "details-modal";

    modal.className =
        "modal details-modal";

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.hidden = true;

    modal.innerHTML = `
        <div class="modal-overlay"></div>

        <div class="modal-content detalhes-filme">
            <button
                type="button"
                class="modal-close"
                id="details-close"
                aria-label="Fechar"
            >
                ×
            </button>

            <div class="detalhes-conteudo">
                <div class="detalhes-poster"></div>

                <div class="detalhes-info">
                    <h2 class="detalhes-titulo"></h2>

                    <div class="detalhes-meta"></div>

                    <p class="detalhes-original"></p>

                    <div class="detalhes-generos"></div>

                    <p class="detalhes-sinopse"></p>

                    <div class="detalhes-acoes">
                        <button
                            type="button"
                            class="botao-favorito"
                        >
                            ☆ Favoritar
                        </button>

                        <button
                            type="button"
                            class="botao-assistir"
                        >
                            Marcar como assistido
                        </button>
                    </div>

                    <div class="detalhes-temporadas"></div>

                    <div class="detalhes-elenco"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(
        modal
    );
}

function preencherDetalhes(
    modal,
    detalhes,
    tipo
) {
    if (!modal) {
        return;
    }

    const titulo =
        obterTitulo(detalhes);

    const original =
        obterTituloOriginal(
            detalhes
        );

    const poster =
        obterImagem(detalhes);

    const nota =
        obterNota(detalhes);

    const ano =
        obterAno(detalhes);

    const runtime =
        Number(
            detalhes.runtime || 0
        );

    const tituloElemento =
        modal.querySelector(
            ".detalhes-titulo"
        );

    const originalElemento =
        modal.querySelector(
            ".detalhes-original"
        );

    const metaElemento =
        modal.querySelector(
            ".detalhes-meta"
        );

    const posterElemento =
        modal.querySelector(
            ".detalhes-poster"
        );

    const sinopseElemento =
        modal.querySelector(
            ".detalhes-sinopse"
        );

    const generosElemento =
        modal.querySelector(
            ".detalhes-generos"
        );

    if (tituloElemento) {
        tituloElemento.textContent =
            titulo;
    }

    if (originalElemento) {
        originalElemento.textContent =
            original &&
            original !== titulo
                ? original
                : "";
    }

    if (metaElemento) {
        const partes = [];

        if (ano) {
            partes.push(ano);
        }

        partes.push(
            tipo === "tv"
                ? "Série"
                : "Filme"
        );

        partes.push(
            `★ ${nota}`
        );

        if (runtime > 0) {
            partes.push(
                `${runtime} min`
            );
        }

        metaElemento.textContent =
            partes.join(" • ");
    }

    if (posterElemento) {
        posterElemento.innerHTML =
            poster
                ? `
                    <img
                        src="${escaparAtributo(poster)}"
                        alt="${escaparAtributo(titulo)}"
                    >
                `
                : `
                    <div class="poster-sem-imagem">
                        CineFamily
                    </div>
                `;
    }

    if (sinopseElemento) {
        sinopseElemento.textContent =
            detalhes.overview ||
            "Sinopse não disponível.";
    }

    if (generosElemento) {
        const generos =
            Array.isArray(
                detalhes.genres
            )
                ? detalhes.genres
                : [];

        generosElemento.innerHTML =
            generos
                .map(function (genero) {
                    return `
                        <span class="genero">
                            ${escaparHTML(
                                genero.name
                            )}
                        </span>
                    `;
                })
                .join("");
    }

    const backdrop =
        obterBackdrop(
            detalhes
        );

    if (backdrop) {
        modal.style.setProperty(
            "--detalhes-backdrop",
            `url("${backdrop}")`
        );
    }

    configurarBotaoFavorito(
        modal,
        detalhes
    );

    configurarBotaoAssistir(
        modal,
        detalhes
    );

    const temporadas =
        modal.querySelector(
            ".detalhes-temporadas"
        );

    if (temporadas) {
        temporadas.innerHTML = "";
    }

    if (tipo === "tv") {
        carregarTemporadas(
            detalhes.id,
            modal,
            detalhes
        );
    }

    carregarElenco(
        detalhes.id,
        tipo,
        modal
    );
}
function configurarBotaoFavorito(
    modal,
    conteudo
) {
    const botao =
        modal.querySelector(
            ".botao-favorito"
        );

    if (!botao) {
        return;
    }

    atualizarTextoFavorito(
        botao,
        conteudo
    );

    botao.onclick =
        function () {
            alternarFavorito(
                conteudo
            );

            atualizarTextoFavorito(
                botao,
                conteudo
            );

            carregarFavoritos();
        };
}

function atualizarTextoFavorito(
    botao,
    conteudo
) {
    if (
        estaNosFavoritos(
            conteudo
        )
    ) {
        botao.textContent =
            "★ Remover dos favoritos";

        botao.classList.add(
            "favoritado"
        );
    } else {
        botao.textContent =
            "☆ Favoritar";

        botao.classList.remove(
            "favoritado"
        );
    }
}

function configurarBotaoAssistir(
    modal,
    conteudo
) {
    const botao =
        modal.querySelector(
            ".botao-assistir"
        );

    if (!botao) {
        return;
    }

    botao.onclick =
        function () {
            registrarHistorico(
                conteudo
            );

            botao.textContent =
                "✓ Adicionado ao histórico";

            botao.classList.add(
                "assistido"
            );

            carregarHistorico();

            mostrarToast(
                "Adicionado ao histórico."
            );
        };
}

function obterChaveConteudo(
    conteudo
) {
    if (!conteudo) {
        return "";
    }

    const id =
        obterIdSeguro(
            conteudo
        );

    if (!id) {
        return "";
    }

    const tipo =
        descobrirTipo(conteudo);

    return `${tipo}-${id}`;
}

function obterFavoritos() {
    let dados = [];

    try {
        const atual =
            localStorage.getItem(
                STORAGE_FAVORITOS
            );

        if (atual) {
            dados =
                JSON.parse(atual);
        }

        if (
            !Array.isArray(dados) ||
            dados.length === 0
        ) {
            const antigo =
                localStorage.getItem(
                    LEGACY_FAVORITOS
                );

            if (antigo) {
                dados =
                    JSON.parse(antigo);
            }
        }
    } catch (erro) {
        console.error(
            "Erro ao ler favoritos:",
            erro
        );

        dados = [];
    }

    return Array.isArray(dados)
        ? dados.filter(
              conteudoPermitido
          )
        : [];
}

function salvarFavoritos(
    favoritos
) {
    try {
        localStorage.setItem(
            STORAGE_FAVORITOS,
            JSON.stringify(
                favoritos
            )
        );
    } catch (erro) {
        console.error(
            "Erro ao salvar favoritos:",
            erro
        );
    }
}

function estaNosFavoritos(
    conteudo
) {
    const chave =
        obterChaveConteudo(
            conteudo
        );

    if (!chave) {
        return false;
    }

    return appState.favoritos.some(
        function (item) {
            return (
                obterChaveConteudo(
                    item
                ) === chave
            );
        }
    );
}

function adicionarFavorito(
    conteudo
) {
    if (
        !conteudo ||
        !obterIdSeguro(conteudo)
    ) {
        return;
    }

    if (
        estaNosFavoritos(
            conteudo
        )
    ) {
        return;
    }

    const favorito =
        normalizarConteudo(
            conteudo
        );

    appState.favoritos.unshift(
        favorito
    );

    salvarFavoritos(
        appState.favoritos
    );

    mostrarToast(
        "Adicionado aos favoritos."
    );
}

function removerFavorito(
    conteudo
) {
    const chave =
        obterChaveConteudo(
            conteudo
        );

    if (!chave) {
        return;
    }

    appState.favoritos =
        appState.favoritos.filter(
            function (item) {
                return (
                    obterChaveConteudo(
                        item
                    ) !== chave
                );
            }
        );

    salvarFavoritos(
        appState.favoritos
    );

    mostrarToast(
        "Removido dos favoritos."
    );
}

function alternarFavorito(
    conteudo
) {
    if (
        estaNosFavoritos(
            conteudo
        )
    ) {
        removerFavorito(
            conteudo
        );
    } else {
        adicionarFavorito(
            conteudo
        );
    }

    atualizarListasLocais();
}

function encontrarContainerLista(
    tipo
) {
    const ids =
        tipo === "favoritos"
            ? [
                  "#favoritos",
                  "#lista-favoritos",
                  "#favoritos-container"
              ]
            : [
                  "#historico",
                  "#lista-historico",
                  "#historico-container"
              ];

    for (const id of ids) {
        const elemento =
            document.querySelector(id);

        if (elemento) {
            return elemento;
        }
    }

    const classes =
        tipo === "favoritos"
            ? [
                  ".favoritos-lista",
                  ".lista-favoritos"
              ]
            : [
                  ".historico-lista",
                  ".lista-historico"
              ];

    for (const classe of classes) {
        const elemento =
            document.querySelector(
                classe
            );

        if (elemento) {
            return elemento;
        }
    }

    return null;
}

function carregarFavoritos() {
    appState.favoritos =
        obterFavoritos();

    const container =
        encontrarContainerLista(
            "favoritos"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        !appState.favoritos.length
    ) {
        container.innerHTML = `
            <div class="mensagem-vazia">
                Você ainda não possui favoritos.
            </div>
        `;

        return;
    }

    appState.favoritos.forEach(
        function (item) {
            const card =
                criarCard(
                    item,
                    descobrirTipo(item)
                );

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}

function obterHistorico() {
    let dados = [];

    try {
        const atual =
            localStorage.getItem(
                STORAGE_HISTORICO
            );

        if (atual) {
            dados =
                JSON.parse(atual);
        }

        if (
            !Array.isArray(dados) ||
            dados.length === 0
        ) {
            const antigo =
                localStorage.getItem(
                    LEGACY_HISTORICO
                );

            if (antigo) {
                dados =
                    JSON.parse(antigo);
            }
        }
    } catch (erro) {
        console.error(
            "Erro ao ler histórico:",
            erro
        );

        dados = [];
    }

    return Array.isArray(dados)
        ? dados.filter(
              conteudoPermitido
          )
        : [];
}

function salvarHistorico(
    historico
) {
    try {
        localStorage.setItem(
            STORAGE_HISTORICO,
            JSON.stringify(
                historico
            )
        );
    } catch (erro) {
        console.error(
            "Erro ao salvar histórico:",
            erro
        );
    }
}

function registrarHistorico(
    conteudo
) {
    if (
        !conteudo ||
        !obterIdSeguro(conteudo)
    ) {
        return;
    }

    const chave =
        obterChaveConteudo(
            conteudo
        );

    appState.historico =
        appState.historico.filter(
            function (item) {
                return (
                    obterChaveConteudo(
                        item
                    ) !== chave
                );
            }
        );

    appState.historico.unshift(
        normalizarConteudo(
            conteudo
        )
    );

    appState.historico =
        appState.historico.slice(
            0,
            50
        );

    salvarHistorico(
        appState.historico
    );
}

function carregarHistorico() {
    appState.historico =
        obterHistorico();

    const container =
        encontrarContainerLista(
            "historico"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        !appState.historico.length
    ) {
        container.innerHTML = `
            <div class="mensagem-vazia">
                Seu histórico está vazio.
            </div>
        `;

        return;
    }

    appState.historico.forEach(
        function (item) {
            const card =
                criarCard(
                    item,
                    descobrirTipo(item)
                );

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}

function limparHistorico() {
    appState.historico = [];

    try {
        localStorage.removeItem(
            STORAGE_HISTORICO
        );

        localStorage.removeItem(
            LEGACY_HISTORICO
        );
    } catch (erro) {
        console.error(
            "Erro ao limpar histórico:",
            erro
        );
    }

    carregarHistorico();

    mostrarToast(
        "Histórico apagado."
    );
}

async function carregarTemporadas(
    id,
    modal,
    detalhes
) {
    const container =
        modal.querySelector(
            ".detalhes-temporadas"
        );

    if (!container) {
        return;
    }

    const temporadas =
        Array.isArray(
            detalhes?.seasons
        )
            ? detalhes.seasons
            : [];

    if (!temporadas.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <h3>Temporadas</h3>
        <div class="temporadas-lista"></div>
        <div class="episodios-lista"></div>
    `;

    const lista =
        container.querySelector(
            ".temporadas-lista"
        );

    const episodios =
        container.querySelector(
            ".episodios-lista"
        );

    temporadas
        .filter(function (temporada) {
            return (
                Number(
                    temporada.season_number
                ) >= 0
            );
        })
        .forEach(
            function (temporada) {
                const botao =
                    document.createElement(
                        "button"
                    );

                botao.type = "button";
                botao.className =
                    "botao-temporada";

                botao.textContent =
                    temporada.name ||
                    `Temporada ${temporada.season_number}`;

                botao.addEventListener(
                    "click",
                    function () {
                        carregarEpisodios(
                            id,
                            temporada.season_number,
                            episodios
                        );
                    }
                );

                lista.appendChild(
                    botao
                );
            }
        );

    const primeira =
        temporadas.find(
            function (temporada) {
                return (
                    Number(
                        temporada.season_number
                    ) === 1
                );
            }
        ) ||
        temporadas[0];

    if (primeira) {
        carregarEpisodios(
            id,
            primeira.season_number,
            episodios
        );
    }
}

async function carregarEpisodios(
    id,
    numeroTemporada,
    container
) {
    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>Carregando episódios...</p>";

    const resposta =
        await buscarTMDB(
            `/api/tv/${id}/season/${numeroTemporada}`
        );

    if (
        !resposta ||
        resposta.ok === false
    ) {
        container.innerHTML =
            "<p>Episódios indisponíveis.</p>";

        return;
    }

    const episodios =
        Array.isArray(
            resposta.episodes
        )
            ? resposta.episodes
            : [];

    if (!episodios.length) {
        container.innerHTML =
            "<p>Nenhum episódio encontrado.</p>";

        return;
    }

    container.innerHTML = `
        <h4>
            ${escaparHTML(
                resposta.name ||
                `Temporada ${numeroTemporada}`
            )}
        </h4>
    `;

    episodios.forEach(
        function (episodio) {
            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "episodio";

            const imagem =
                episodio.still_path ||
                "";

            item.innerHTML = `
                ${
                    imagem
                        ? `
                            <img
                                src="${escaparAtributo(
                                    imagem
                                )}"
                                alt=""
                                loading="lazy"
                            >
                        `
                        : ""
                }

                <div class="episodio-info">
                    <strong>
                        ${escaparHTML(
                            episodio.episode_number +
                            ". " +
                            episodio.name
                        )}
                    </strong>

                    <p>
                        ${escaparHTML(
                            episodio.overview ||
                            "Sinopse não disponível."
                        )}
                    </p>
                </div>
            `;

            container.appendChild(
                item
            );
        }
    );
}

async function carregarElenco(
    id,
    tipo,
    modal
) {
    const container =
        modal.querySelector(
            ".detalhes-elenco"
        );

    if (!container) {
        return;
    }

    const endpoint =
        tipo === "tv"
            ? `/api/tv/${id}`
            : `/api/movie/${id}`;

    const resposta =
        await buscarTMDB(endpoint);

    if (
        !resposta ||
        resposta.ok === false
    ) {
        container.innerHTML = "";
        return;
    }

    const detalhes =
        resposta;

    const elenco =
        Array.isArray(
            detalhes.cast
        )
            ? detalhes.cast
            : Array.isArray(
                  detalhes.credits?.cast
              )
            ? detalhes.credits.cast
            : [];

    if (!elenco.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <h3>Elenco</h3>
        <div class="elenco-lista"></div>
    `;

    const lista =
        container.querySelector(
            ".elenco-lista"
        );

    elenco
        .slice(0, 12)
        .forEach(
            function (pessoa) {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "elenco-item";

                const foto =
                    pessoa.profile_path ||
                    "";

                item.innerHTML = `
                    ${
                        foto
                            ? `
                                <img
                                    src="${escaparAtributo(
                                        foto
                                    )}"
                                    alt="${escaparAtributo(
                                        pessoa.name
                                    )}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="elenco-sem-foto">
                                    ?
                                </div>
                            `
                    }

                    <strong>
                        ${escaparHTML(
                            pessoa.name ||
                            "Desconhecido"
                        )}
                    </strong>

                    ${
                        pessoa.character
                            ? `
                                <span>
                                    ${escaparHTML(
                                        pessoa.character
                                    )}
                                </span>
                            `
                            : ""
                    }
                `;

                lista.appendChild(
                    item
                );
            }
        );
}
function fecharDetalhes() {
    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        return;
    }

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.hidden = true;

    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
}

function mostrarToast(
    mensagem
) {
    let toast =
        document.getElementById(
            "cinefamily-toast"
        );

    if (!toast) {
        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "cinefamily-toast";

        toast.className =
            "cinefamily-toast";

        document.body.appendChild(
            toast
        );
    }

    toast.textContent =
        mensagem;

    toast.classList.add(
        "visivel"
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(
            function () {
                toast.classList.remove(
                    "visivel"
                );
            },
            2500
        );
}

function mostrarSecaoPorId(
    id
) {
    const elemento =
        document.getElementById(id);

    if (!elemento) {
        return;
    }

    elemento.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function configurarNavegacaoInterna() {
    document.addEventListener(
        "click",
        function (event) {
            const link =
                event.target.closest(
                    'a[href^="#"]'
                );

            if (!link) {
                return;
            }

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

            const id =
                href.substring(1);

            const destino =
                document.getElementById(
                    id
                );

            if (!destino) {
                return;
            }

            event.preventDefault();

            mostrarSecaoPorId(
                id
            );

            document.body.classList.remove(
                "menu-aberto"
            );
        }
    );

    document.addEventListener(
        "click",
        function (event) {
            const elemento =
                event.target.closest(
                    "[data-secao]"
                );

            if (!elemento) {
                return;
            }

            const id =
                elemento.dataset.secao;

            if (id) {
                event.preventDefault();
                mostrarSecaoPorId(id);
            }
        }
    );
}

function configurarFechamentoModal() {
    document.addEventListener(
        "click",
        function (event) {
            const modal =
                document.getElementById(
                    "details-modal"
                );

            if (!modal) {
                return;
            }

            if (
                event.target === modal ||
                event.target.classList.contains(
                    "modal-overlay"
                )
            ) {
                fecharDetalhes();
                return;
            }

            const fechar =
                event.target.closest(
                    "#details-close, .modal-close, .fechar-modal, .fechar-detalhes"
                );

            if (fechar) {
                event.preventDefault();
                fecharDetalhes();
            }
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Escape"
            ) {
                fecharDetalhes();
                fecharAreaBusca();
            }
        }
    );
}

function configurarMenu() {
    document.addEventListener(
        "click",
        function (event) {
            const botao =
                event.target.closest(
                    ".menu-toggle, .menu-btn, .hamburguer, .botao-menu"
                );

            if (!botao) {
                return;
            }

            event.preventDefault();

            document.body.classList.toggle(
                "menu-aberto"
            );

            const topo =
                document.querySelector(
                    ".topo"
                );

            if (topo) {
                topo.classList.toggle(
                    "menu-aberto"
                );
            }
        }
    );
}

function configurarTeclaBusca() {
    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "/" &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey
            ) {
                const elemento =
                    event.target;

                if (
                    elemento &&
                    (
                        elemento.tagName ===
                            "INPUT" ||
                        elemento.tagName ===
                            "TEXTAREA"
                    )
                ) {
                    return;
                }

                const campo =
                    document.querySelector(
                        "#campo-busca, #search, #search-input"
                    );

                if (campo) {
                    event.preventDefault();
                    abrirAreaBusca();
                    campo.focus();
                }
            }
        }
    );
}

function configurarEventosStorage() {
    window.addEventListener(
        "storage",
        function (event) {
            if (
                event.key ===
                    STORAGE_FAVORITOS ||
                event.key ===
                    STORAGE_HISTORICO ||
                event.key ===
                    LEGACY_FAVORITOS ||
                event.key ===
                    LEGACY_HISTORICO
            ) {
                atualizarListasLocais();
            }
        }
    );
}

function atualizarListasLocais() {
    appState.favoritos =
        obterFavoritos();

    appState.historico =
        obterHistorico();

    carregarFavoritos();
    carregarHistorico();
}

function configurarImagens() {
    document.addEventListener(
        "error",
        function (event) {
            const imagem =
                event.target;

            if (
                !imagem ||
                imagem.tagName !== "IMG"
            ) {
                return;
            }

            if (
                imagem.dataset.fallback ===
                "true"
            ) {
                return;
            }

            imagem.dataset.fallback =
                "true";

            imagem.src =
                "https://via.placeholder.com/500x750/111111/ffffff?text=CineFamily";
        },
        true
    );
}

function fecharModalAntigo() {
    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        return;
    }

    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
}

async function iniciarCineFamily() {
    fecharModalAntigo();

    appState.favoritos =
        obterFavoritos();

    appState.historico =
        obterHistorico();

    configurarBusca();
    configurarNavegacaoInterna();
    configurarFechamentoModal();
    configurarMenu();
    configurarTeclaBusca();
    configurarEventosStorage();
    configurarImagens();

    carregarFavoritos();
    carregarHistorico();

    await Promise.all([
        carregarFilmes(),
        carregarSeries()
    ]);

    iniciarSlider();

    carregarFavoritos();
    carregarHistorico();
}

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarCineFamily
    );
} else {
    iniciarCineFamily();
}

window.CineFamily = {
    abrirDetalhes,
    fecharDetalhes,
    alternarFavorito,
    adicionarFavorito,
    removerFavorito,
    registrarHistorico,
    limparHistorico,
    executarBusca,
    carregarFavoritos,
    carregarHistorico
};
