"use strict";

const TMDB_WORKER =
    "https://cinefamily-tmdb.thabsleao.workers.dev";

const IMG =
    "https://image.tmdb.org/t/p/w500";

const BACKDROP =
    "https://image.tmdb.org/t/p/w1280";

const STORAGE_KEYS = {
    FAVORITOS: "cinefamily_favoritos",
    HISTORICO: "cinefamily_historico",
    PERFIL: "cinefamily_perfil"
};

const LEGACY_STORAGE_KEYS = {
    FAVORITOS: "cinefamilyFavoritos",
    HISTORICO: "cinefamilyHistorico"
};

const MAX_ITENS_SECAO = 20;

const appState = {
    filmes: [],
    series: [],
    favoritos: [],
    historico: [],
    buscaAtiva: false,
    sliderIndex: 0,
    sliderTimer: null,
    detalhesAtual: null
};


function obterValorSeguro(valor, padrao = "") {
    if (
        valor === null ||
        valor === undefined
    ) {
        return padrao;
    }

    return valor;
}


function obterTitulo(conteudo) {
    if (!conteudo) {
        return "Sem título";
    }

    return (
        conteudo.title ||
        conteudo.name ||
        conteudo.original_title ||
        conteudo.original_name ||
        "Sem título"
    );
}


function obterData(conteudo) {
    if (!conteudo) {
        return "";
    }

    return (
        conteudo.release_date ||
        conteudo.first_air_date ||
        ""
    );
}


function obterAno(conteudo) {
    const data = obterData(conteudo);

    if (!data) {
        return "";
    }

    return String(data).slice(0, 4);
}


function obterNota(conteudo) {
    if (!conteudo) {
        return 0;
    }

    const nota = Number(
        conteudo.vote_average || 0
    );

    if (!Number.isFinite(nota)) {
        return 0;
    }

    return nota;
}


function obterTipo(conteudo, tipoForcado = "") {
    if (tipoForcado === "movie") {
        return "movie";
    }

    if (tipoForcado === "tv") {
        return "tv";
    }

    if (!conteudo) {
        return "movie";
    }

    if (
        conteudo.type === "movie" ||
        conteudo.media_type === "movie"
    ) {
        return "movie";
    }

    if (
        conteudo.type === "tv" ||
        conteudo.media_type === "tv"
    ) {
        return "tv";
    }

    if (
        conteudo.first_air_date ||
        conteudo.name ||
        conteudo.original_name
    ) {
        return "tv";
    }

    return "movie";
}


function ehAdulto(conteudo) {
    return (
        !!conteudo &&
        conteudo.adult === true
    );
}


function conteudoPermitido(conteudo) {
    if (!conteudo) {
        return false;
    }

    if (ehAdulto(conteudo)) {
        return false;
    }

    const id = Number(
        conteudo.id || 0
    );

    return Number.isFinite(id) && id > 0;
}


function obterPoster(conteudo) {
    if (!conteudo) {
        return "";
    }

    return (
        conteudo.poster_path ||
        conteudo.poster ||
        conteudo.posterUrl ||
        conteudo.image ||
        ""
    );
}


function obterBackdrop(conteudo) {
    if (!conteudo) {
        return "";
    }

    return (
        conteudo.backdrop_path ||
        conteudo.backdrop ||
        ""
    );
}


function escaparHTML(valor) {
    return String(
        valor === null ||
        valor === undefined
            ? ""
            : valor
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatarData(data) {
    if (!data) {
        return "";
    }

    const partes =
        String(data).split("-");

    if (partes.length !== 3) {
        return String(data);
    }

    return (
        partes[2] +
        "/" +
        partes[1] +
        "/" +
        partes[0]
    );
}


function formatarNota(nota) {
    const valor = Number(nota || 0);

    if (!Number.isFinite(valor) || valor <= 0) {
        return "";
    }

    return valor.toFixed(1);
}


function formatarDuracao(minutos) {
    const valor = Number(
        minutos || 0
    );

    if (!Number.isFinite(valor) || valor <= 0) {
        return "";
    }

    const horas =
        Math.floor(valor / 60);

    const restantes =
        valor % 60;

    if (horas <= 0) {
        return `${restantes} min`;
    }

    if (restantes <= 0) {
        return `${horas}h`;
    }

    return `${horas}h ${restantes}min`;
}


async function buscarTMDB(endpoint) {
    try {
        const resposta = await fetch(
            `${TMDB_WORKER}${endpoint}`,
            {
                method: "GET",
                headers: {
                    Accept:
                        "application/json"
                }
            }
        );

        const texto =
            await resposta.text();

        let dados = {};

        try {
            dados = texto
                ? JSON.parse(texto)
                : {};
        } catch (erro) {
            console.error(
                "Resposta inválida do Worker:",
                erro
            );

            return {
                ok: false,
                erro:
                    "Resposta inválida do servidor.",
                results: []
            };
        }

        if (!resposta.ok) {
            console.error(
                "Erro do Worker:",
                resposta.status,
                dados
            );

            return {
                ok: false,
                erro:
                    dados.erro ||
                    "Erro ao consultar o servidor.",
                results: []
            };
        }

        return dados;

    } catch (erro) {
        console.error(
            "Erro de conexão com o Worker:",
            erro
        );

        return {
            ok: false,
            erro:
                "Não foi possível conectar ao servidor.",
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

    return [];
}


function encontrarSecao(id) {
    if (!id) {
        return null;
    }

    const elemento =
        document.getElementById(id);

    if (elemento) {
        return elemento;
    }

    const alternativas = [
        `[data-section-id="${id}"]`,
        `[data-section="${id}"]`
    ];

    for (
        const seletor of alternativas
    ) {
        const encontrado =
            document.querySelector(seletor);

        if (encontrado) {
            return encontrado;
        }
    }

    return null;
}


function encontrarContainerCards(secao) {
    if (!secao) {
        return null;
    }

    if (
        secao.classList &&
        secao.classList.contains(
            "content-row"
        )
    ) {
        return secao;
    }

    const rowDireto =
        secao.querySelector(
            ":scope > .content-row"
        );

    if (rowDireto) {
        return rowDireto;
    }

    const rowInterno =
        secao.querySelector(
            ".content-row"
        );

    if (rowInterno) {
        return rowInterno;
    }

    const seletoresAntigos = [
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

    for (
        const seletor of seletoresAntigos
    ) {
        const encontrado =
            secao.querySelector(seletor);

        if (encontrado) {
            return encontrado;
        }
    }

    return null;
}


function criarCard(
    conteudo,
    tipoForcado = ""
) {
    if (!conteudoPermitido(conteudo)) {
        return null;
    }

    const id =
        Number(conteudo.id);

    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const tipo =
        obterTipo(
            conteudo,
            tipoForcado
        );

    const titulo =
        obterTitulo(conteudo);

    const poster =
        obterPoster(conteudo);

    const ano =
        obterAno(conteudo);

    const nota =
        obterNota(conteudo);

    const card =
        document.createElement("article");

    card.className = "card";

    card.dataset.id =
        String(id);

    card.dataset.type =
        tipo;

    card.tabIndex = 0;

    const posterWrapper =
        document.createElement("div");

    posterWrapper.className =
        "card-poster";

    const imagem =
        document.createElement("img");

    imagem.alt =
        titulo;

    imagem.loading =
        "lazy";

    imagem.decoding =
        "async";

    if (poster) {
        imagem.src =
            poster;
    } else {
        imagem.classList.add(
            "no-image"
        );
    }

    imagem.addEventListener(
        "error",
        function () {
            imagem.removeAttribute(
                "src"
            );

            imagem.classList.add(
                "no-image"
            );
        }
    );

    posterWrapper.appendChild(
        imagem
    );

    const overlay =
        document.createElement("div");

    overlay.className =
        "card-overlay";

    const tipoBadge =
        document.createElement("span");

    tipoBadge.className =
        "card-tipo";

    tipoBadge.textContent =
        tipo === "tv"
            ? "SÉRIE"
            : "FILME";

    overlay.appendChild(
        tipoBadge
    );

    if (nota > 0) {
        const notaElemento =
            document.createElement("span");

        notaElemento.className =
            "card-nota";

        notaElemento.textContent =
            `⭐ ${formatarNota(nota)}`;

        overlay.appendChild(
            notaElemento
        );
    }

    posterWrapper.appendChild(
        overlay
    );

    const info =
        document.createElement("div");

    info.className =
        "card-info";

    const tituloElemento =
        document.createElement("h3");

    tituloElemento.className =
        "card-title";

    tituloElemento.textContent =
        titulo;

    info.appendChild(
        tituloElemento
    );

    const meta =
        document.createElement("div");

    meta.className =
        "card-meta";

    if (ano) {
        const anoElemento =
            document.createElement("span");

        anoElemento.textContent =
            ano;

        meta.appendChild(
            anoElemento
        );
    }

    if (nota > 0) {
        const notaMeta =
            document.createElement("span");

        notaMeta.textContent =
            `⭐ ${formatarNota(nota)}`;

        meta.appendChild(
            notaMeta
        );
    }

    info.appendChild(
        meta
    );

    card.appendChild(
        posterWrapper
    );

    card.appendChild(
        info
    );

    function abrirCard() {
        abrirDetalhes(
            conteudo,
            tipo
        );
    }

    card.addEventListener(
        "click",
        abrirCard
    );

    card.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                abrirCard();
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
        console.warn(
            `Seção não encontrada: ${secaoId}`
        );

        return;
    }

    const container =
        encontrarContainerCards(secao);

    if (!container) {
        console.warn(
            `Container de cards não encontrado: ${secaoId}`
        );

        return;
    }

    container.innerHTML = "";

    const itens =
        Array.isArray(lista)
            ? lista
                .filter(
                    conteudoPermitido
                )
                .slice(
                    0,
                    MAX_ITENS_SECAO
                )
            : [];

    itens.forEach(
        function (conteudo) {
            const card =
                criarCard(
                    conteudo,
                    tipo
                );

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}


async function carregarFilmes() {
    const resposta =
        await buscarTMDB(
            "/api/movies?page=1&sort_by=popularity.desc"
        );

    if (!resposta.ok) {
        console.error(
            "Não foi possível carregar filmes:",
            resposta.erro
        );

        return;
    }

    appState.filmes =
        extrairResultados(
            resposta
        ).filter(
            conteudoPermitido
        );

    mostrarNaSecao(
        appState.filmes,
        "filmes",
        "movie"
    );

    const populares =
        await buscarTMDB(
            "/api/movies?page=1&sort_by=vote_average.desc"
        );

    if (populares.ok) {
        mostrarNaSecao(
            extrairResultados(
                populares
            ),
            "mais-avaliados",
            "movie"
        );
    }

    const lancamentos =
        await buscarTMDB(
            "/api/movies?page=1&sort_by=primary_release_date.desc"
        );

    if (lancamentos.ok) {
        mostrarNaSecao(
            extrairResultados(
                lancamentos
            ),
            "lancamentos",
            "movie"
        );
    }
}


async function carregarSeries() {
    const resposta =
        await buscarTMDB(
            "/api/series?page=1&sort_by=popularity.desc"
        );

    if (!resposta.ok) {
        console.error(
            "Não foi possível carregar séries:",
            resposta.erro
        );

        return;
    }

    appState.series =
        extrairResultados(
            resposta
        ).filter(
            conteudoPermitido
        );

    mostrarNaSecao(
        appState.series,
        "series",
        "tv"
    );
}


function iniciarSlider() {
    const slides =
        Array.from(
            document.querySelectorAll(
                ".slide, .hero-slide, .destaque-slide"
            )
        );

    if (!slides.length) {
        return;
    }

    let indice = 0;

    function mostrarSlide(numero) {
        slides.forEach(
            function (slide, index) {
                slide.classList.toggle(
                    "active",
                    index === numero
                );
            }
        );
    }

    mostrarSlide(indice);

    if (appState.sliderTimer) {
        clearInterval(
            appState.sliderTimer
        );
    }

    appState.sliderTimer =
        setInterval(
            function () {
                indice =
                    (indice + 1) %
                    slides.length;

                appState.sliderIndex =
                    indice;

                mostrarSlide(
                    indice
                );
            },
            6000
        );
}


function obterIdSeguro(conteudo) {
    if (!conteudo) {
        return 0;
    }

    const id =
        Number(conteudo.id);

    if (!Number.isFinite(id)) {
        return 0;
    }

    if (id <= 0) {
        return 0;
    }

    return id;
}


function normalizarConteudo(
    conteudo,
    tipoForcado = ""
) {
    if (!conteudo) {
        return null;
    }

    const id =
        obterIdSeguro(conteudo);

    if (!id) {
        return null;
    }

    const tipo =
        obterTipo(
            conteudo,
            tipoForcado
        );

    const titulo =
        obterTitulo(conteudo);

    const poster =
        obterPoster(conteudo);

    const backdrop =
        obterBackdrop(conteudo);

    return {
        id,
        type: tipo,
        media_type: tipo,
        title: titulo,
        name:
            tipo === "tv"
                ? (
                    conteudo.name ||
                    titulo
                )
                : undefined,
        original_title:
            conteudo.original_title ||
            conteudo.original_name ||
            "",
        poster_path: poster,
        backdrop_path: backdrop,
        poster,
        backdrop,
        overview:
            conteudo.overview || "",
        vote_average:
            obterNota(conteudo),
        release_date:
            obterData(conteudo),
        first_air_date:
            tipo === "tv"
                ? obterData(conteudo)
                : "",
        adult:
            conteudo.adult === true,
        genre_ids:
            Array.isArray(
                conteudo.genre_ids
            )
                ? conteudo.genre_ids
                : []
    };
}
function lerStorage(chave, chaveAntiga = "") {
    try {
        let salvo =
            localStorage.getItem(chave);

        if (!salvo && chaveAntiga) {
            salvo =
                localStorage.getItem(
                    chaveAntiga
                );
        }

        if (!salvo) {
            return [];
        }

        const dados =
            JSON.parse(salvo);

        return Array.isArray(dados)
            ? dados
            : [];

    } catch (erro) {
        console.error(
            `Erro ao ler ${chave}:`,
            erro
        );

        return [];
    }
}


function salvarStorage(chave, dados) {
    try {
        localStorage.setItem(
            chave,
            JSON.stringify(dados)
        );

        return true;

    } catch (erro) {
        console.error(
            `Erro ao salvar ${chave}:`,
            erro
        );

        return false;
    }
}


function carregarStorage() {
    appState.favoritos =
        lerStorage(
            STORAGE_KEYS.FAVORITOS,
            LEGACY_STORAGE_KEYS.FAVORITOS
        ).filter(
            conteudoPermitido
        );

    appState.historico =
        lerStorage(
            STORAGE_KEYS.HISTORICO,
            LEGACY_STORAGE_KEYS.HISTORICO
        ).filter(
            conteudoPermitido
        );

    salvarStorage(
        STORAGE_KEYS.FAVORITOS,
        appState.favoritos
    );

    salvarStorage(
        STORAGE_KEYS.HISTORICO,
        appState.historico
    );
}


function isFavorito(conteudo) {
    const id =
        obterIdSeguro(conteudo);

    const tipo =
        obterTipo(conteudo);

    if (!id) {
        return false;
    }

    return appState.favoritos.some(
        function (item) {
            return (
                obterIdSeguro(item) === id &&
                obterTipo(item) === tipo
            );
        }
    );
}


function adicionarFavorito(conteudo) {
    const normalizado =
        normalizarConteudo(
            conteudo
        );

    if (!normalizado) {
        return false;
    }

    const existe =
        isFavorito(
            normalizado
        );

    if (existe) {
        return false;
    }

    appState.favoritos.unshift(
        normalizado
    );

    salvarStorage(
        STORAGE_KEYS.FAVORITOS,
        appState.favoritos
    );

    return true;
}


function removerFavorito(conteudo) {
    const id =
        obterIdSeguro(conteudo);

    const tipo =
        obterTipo(conteudo);

    if (!id) {
        return false;
    }

    const antes =
        appState.favoritos.length;

    appState.favoritos =
        appState.favoritos.filter(
            function (item) {
                return !(
                    obterIdSeguro(item) === id &&
                    obterTipo(item) === tipo
                );
            }
        );

    if (
        appState.favoritos.length ===
        antes
    ) {
        return false;
    }

    salvarStorage(
        STORAGE_KEYS.FAVORITOS,
        appState.favoritos
    );

    return true;
}


function alternarFavorito(conteudo) {
    if (
        isFavorito(conteudo)
    ) {
        removerFavorito(
            conteudo
        );

        mostrarToast(
            "Removido dos favoritos."
        );

        return false;
    }

    adicionarFavorito(
        conteudo
    );

    mostrarToast(
        "Adicionado aos favoritos."
    );

    return true;
}


function registrarHistorico(conteudo) {
    const normalizado =
        normalizarConteudo(
            conteudo
        );

    if (!normalizado) {
        return;
    }

    appState.historico =
        appState.historico.filter(
            function (item) {
                return !(
                    obterIdSeguro(item) ===
                        normalizado.id &&
                    obterTipo(item) ===
                        normalizado.type
                );
            }
        );

    normalizado.visto_em =
        Date.now();

    appState.historico.unshift(
        normalizado
    );

    appState.historico =
        appState.historico.slice(
            0,
            50
        );

    salvarStorage(
        STORAGE_KEYS.HISTORICO,
        appState.historico
    );
}


function mostrarToast(
    mensagem,
    tipo = "normal"
) {
    let container =
        document.getElementById(
            "toast-container"
        );

    if (!container) {
        container =
            document.createElement(
                "div"
            );

        container.id =
            "toast-container";

        document.body.appendChild(
            container
        );
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "toast";

    if (tipo) {
        toast.classList.add(
            `toast-${tipo}`
        );
    }

    toast.textContent =
        mensagem;

    container.appendChild(
        toast
    );

    requestAnimationFrame(
        function () {
            toast.classList.add(
                "show"
            );
        }
    );

    setTimeout(
        function () {
            toast.classList.remove(
                "show"
            );

            setTimeout(
                function () {
                    if (
                        toast.parentNode
                    ) {
                        toast.parentNode.removeChild(
                            toast
                        );
                    }
                },
                300
            );
        },
        2500
    );
}


function obterImagemFallback(
    elemento,
    imagem
) {
    if (!elemento) {
        return;
    }

    if (!imagem) {
        elemento.classList.add(
            "no-image"
        );

        return;
    }

    elemento.src =
        imagem;

    elemento.onerror =
        function () {
            elemento.removeAttribute(
                "src"
            );

            elemento.classList.add(
                "no-image"
            );
        };
}


function preencherElemento(
    seletor,
    valor,
    esconderSeVazio = false
) {
    const elemento =
        typeof seletor === "string"
            ? document.querySelector(
                seletor
            )
            : seletor;

    if (!elemento) {
        return;
    }

    const texto =
        valor === null ||
        valor === undefined
            ? ""
            : String(valor);

    elemento.textContent =
        texto;

    if (esconderSeVazio) {
        elemento.hidden =
            texto.trim() === "";
    }
}


function configurarBotaoFavorito(
    conteudo
) {
    const botao =
        document.getElementById(
            "details-favorite-button"
        );

    if (!botao) {
        return;
    }

    const atualizado =
        normalizarConteudo(
            conteudo
        );

    if (!atualizado) {
        return;
    }

    function atualizarTexto() {
        const favorito =
            isFavorito(
                atualizado
            );

        botao.textContent =
            favorito
                ? "⭐ Remover dos favoritos"
                : "☆ Adicionar aos favoritos";

        botao.classList.toggle(
            "is-favorite",
            favorito
        );

        botao.setAttribute(
            "aria-pressed",
            favorito
                ? "true"
                : "false"
        );
    }

    botao.onclick =
        function () {
            alternarFavorito(
                atualizado
            );

            atualizarTexto();
        };

    atualizarTexto();
}


function configurarBotaoAssistir(
    conteudo,
    tipo
) {
    const botao =
        document.getElementById(
            "details-watch-button"
        );

    if (!botao) {
        return;
    }

    const atualizado =
        normalizarConteudo(
            conteudo,
            tipo
        );

    if (!atualizado) {
        botao.hidden =
            true;

        return;
    }

    const trailer =
        conteudo &&
        conteudo.trailer
            ? conteudo.trailer
            : null;

    if (
        trailer &&
        trailer.key
    ) {
        botao.hidden =
            false;

        botao.textContent =
            "▶ Assistir trailer";

        botao.onclick =
            function () {
                abrirTrailer(
                    trailer.key
                );
            };

        return;
    }

    botao.hidden =
        true;
}


function abrirTrailer(
    chave
) {
    if (!chave) {
        mostrarToast(
            "Trailer não disponível."
        );

        return;
    }

    const url =
        `https://www.youtube.com/watch?v=${encodeURIComponent(
            chave
        )}`;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


function preencherDetalhes(
    detalhes,
    tipo
) {
    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        return;
    }

    const conteudo =
        normalizarConteudo(
            detalhes,
            tipo
        );

    if (!conteudo) {
        return;
    }

    appState.detalhesAtual =
        detalhes;

    const titulo =
        obterTitulo(detalhes);

    const tituloOriginal =
        detalhes.original_title ||
        detalhes.original_name ||
        "";

    const poster =
        obterPoster(detalhes);

    const backdrop =
        obterBackdrop(detalhes);

    const tipoElemento =
        document.getElementById(
            "details-type"
        );

    const tituloElemento =
        document.getElementById(
            "details-title"
        );

    const metaElemento =
        document.getElementById(
            "details-meta"
        );

    const overviewElemento =
        document.getElementById(
            "details-overview"
        );

    const posterElemento =
        document.getElementById(
            "details-poster"
        );

    const backdropElemento =
        document.getElementById(
            "details-backdrop"
        );

    if (tipoElemento) {
        tipoElemento.textContent =
            tipo === "tv"
                ? "SÉRIE"
                : "FILME";
    }

    if (tituloElemento) {
        tituloElemento.textContent =
            titulo;
    }

    if (metaElemento) {
        const meta = [];

        const ano =
            obterAno(detalhes);

        if (ano) {
            meta.push(
                ano
            );
        }

        const nota =
            formatarNota(
                detalhes.vote_average
            );

        if (nota) {
            meta.push(
                `⭐ ${nota}`
            );
        }

        if (
            tipo === "movie" &&
            detalhes.runtime
        ) {
            const duracao =
                formatarDuracao(
                    detalhes.runtime
                );

            if (duracao) {
                meta.push(
                    duracao
                );
            }
        }

        if (
            tipo === "tv" &&
            detalhes.number_of_seasons
        ) {
            const temporadas =
                Number(
                    detalhes.number_of_seasons
                );

            meta.push(
                temporadas === 1
                    ? "1 temporada"
                    : `${temporadas} temporadas`
            );
        }

        metaElemento.textContent =
            meta.join(" • ");
    }

    if (overviewElemento) {
        overviewElemento.textContent =
            detalhes.overview ||
            "Sinopse não disponível.";
    }

    if (posterElemento) {
        posterElemento.alt =
            titulo;

        obterImagemFallback(
            posterElemento,
            poster
        );
    }

    if (
        backdropElemento &&
        backdrop
    ) {
        backdropElemento.style.backgroundImage =
            `url("${backdrop}")`;
    }

    const originalElemento =
        document.getElementById(
            "details-original-title"
        );

    if (originalElemento) {
        originalElemento.textContent =
            tituloOriginal;

        originalElemento.hidden =
            !tituloOriginal ||
            tituloOriginal === titulo;
    }

    preencherGeneros(
        detalhes
    );

    preencherExtraDetalhes(
        detalhes,
        tipo
    );

    configurarBotaoFavorito(
        detalhes
    );

    configurarBotaoAssistir(
        detalhes,
        tipo
    );

    configurarTemporadas(
        detalhes,
        tipo
    );

    configurarElenco(
        detalhes
    );
}


function preencherGeneros(
    detalhes
) {
    const container =
        document.getElementById(
            "details-genres"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    const generos =
        Array.isArray(
            detalhes.genres
        )
            ? detalhes.genres
            : [];

    if (!generos.length) {
        container.hidden =
            true;

        return;
    }

    container.hidden =
        false;

    generos.forEach(
        function (genero) {
            const elemento =
                document.createElement(
                    "span"
                );

            elemento.className =
                "genre-tag";

            elemento.textContent =
                genero.name ||
                "";

            container.appendChild(
                elemento
            );
        }
    );
}


function preencherExtraDetalhes(
    detalhes,
    tipo
) {
    const container =
        document.getElementById(
            "details-extra"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    const dados = [];

    if (
        detalhes.status
    ) {
        dados.push(
            `Status: ${detalhes.status}`
        );
    }

    if (
        detalhes.original_language
    ) {
        dados.push(
            `Idioma original: ${String(
                detalhes.original_language
            ).toUpperCase()}`
        );
    }

    if (
        tipo === "movie" &&
        detalhes.release_date
    ) {
        dados.push(
            `Lançamento: ${formatarData(
                detalhes.release_date
            )}`
        );
    }

    if (
        tipo === "tv" &&
        detalhes.first_air_date
    ) {
        dados.push(
            `Estreia: ${formatarData(
                detalhes.first_air_date
            )}`
        );
    }

    dados.forEach(
        function (texto) {
            const elemento =
                document.createElement(
                    "span"
                );

            elemento.className =
                "details-extra-item";

            elemento.textContent =
                texto;

            container.appendChild(
                elemento
            );
        }
    );
}
function configurarTemporadas(
    detalhes,
    tipo
) {
    const container =
        document.getElementById(
            "episodes-container"
        );

    const lista =
        document.getElementById(
            "episodes-list"
        );

    if (!container || !lista) {
        return;
    }

    lista.innerHTML = "";

    if (
        tipo !== "tv" ||
        !Array.isArray(
            detalhes.seasons
        ) ||
        !detalhes.seasons.length
    ) {
        container.hidden =
            true;

        return;
    }

    const temporadas =
        detalhes.seasons.filter(
            function (temporada) {
                return (
                    temporada &&
                    Number(
                        temporada.season_number
                    ) >= 0
                );
            }
        );

    if (!temporadas.length) {
        container.hidden =
            true;

        return;
    }

    container.hidden =
        false;

    temporadas.forEach(
        function (temporada) {
            const item =
                document.createElement(
                    "button"
                );

            item.type =
                "button";

            item.className =
                "season-button";

            const numero =
                Number(
                    temporada.season_number
                );

            const nome =
                temporada.name ||
                `Temporada ${numero}`;

            const quantidade =
                Number(
                    temporada.episode_count ||
                    0
                );

            item.textContent =
                quantidade > 0
                    ? `${nome} • ${quantidade} episódios`
                    : nome;

            item.addEventListener(
                "click",
                function () {
                    carregarEpisodios(
                        detalhes.id,
                        numero
                    );
                }
            );

            lista.appendChild(
                item
            );
        }
    );
}


async function carregarEpisodios(
    id,
    temporada
) {
    const container =
        document.getElementById(
            "episodes-container"
        );

    const lista =
        document.getElementById(
            "episodes-list"
        );

    if (!container || !lista) {
        return;
    }

    if (
        !id ||
        Number(
            temporada
        ) < 0
    ) {
        return;
    }

    lista.innerHTML =
        "<p class=\"episodes-loading\">Carregando episódios...</p>";

    const resposta =
        await buscarTMDB(
            `/api/tv/${id}/season/${temporada}`
        );

    if (!resposta.ok) {
        lista.innerHTML =
            "<p class=\"episodes-empty\">Não foi possível carregar os episódios.</p>";

        return;
    }

    const episodios =
        Array.isArray(
            resposta.episodes
        )
            ? resposta.episodes
            : [];

    lista.innerHTML =
        "";

    if (!episodios.length) {
        lista.innerHTML =
            "<p class=\"episodes-empty\">Nenhum episódio encontrado.</p>";

        return;
    }

    episodios.forEach(
        function (episodio) {
            const item =
                document.createElement(
                    "article"
                );

            item.className =
                "episode-item";

            const imagem =
                document.createElement(
                    "img"
                );

            imagem.className =
                "episode-image";

            imagem.alt =
                episodio.name ||
                "Episódio";

            imagem.loading =
                "lazy";

            if (
                episodio.still_path
            ) {
                imagem.src =
                    episodio.still_path.startsWith(
                        "http"
                    )
                        ? episodio.still_path
                        : `${IMG}${episodio.still_path}`;
            }

            imagem.onerror =
                function () {
                    imagem.removeAttribute(
                        "src"
                    );

                    imagem.classList.add(
                        "no-image"
                    );
                };

            const informacoes =
                document.createElement(
                    "div"
                );

            informacoes.className =
                "episode-info";

            const titulo =
                document.createElement(
                    "h4"
                );

            titulo.textContent =
                episodio.episode_number
                    ? `E${episodio.episode_number} — ${episodio.name || "Episódio"}`
                    : (
                        episodio.name ||
                        "Episódio"
                    );

            const sinopse =
                document.createElement(
                    "p"
                );

            sinopse.textContent =
                episodio.overview ||
                "Sinopse não disponível.";

            const nota =
                Number(
                    episodio.vote_average ||
                    0
                );

            const meta =
                document.createElement(
                    "span"
                );

            meta.className =
                "episode-meta";

            if (
                nota > 0
            ) {
                meta.textContent =
                    `⭐ ${nota.toFixed(1)}`;
            }

            informacoes.appendChild(
                titulo
            );

            informacoes.appendChild(
                sinopse
            );

            if (
                meta.textContent
            ) {
                informacoes.appendChild(
                    meta
                );
            }

            item.appendChild(
                imagem
            );

            item.appendChild(
                informacoes
            );

            lista.appendChild(
                item
            );
        }
    );
}


function configurarElenco(
    detalhes
) {
    const container =
        document.getElementById(
            "details-cast"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    const elenco =
        Array.isArray(
            detalhes.cast
        )
            ? detalhes.cast
            : [];

    if (!elenco.length) {
        container.hidden =
            true;

        return;
    }

    container.hidden =
        false;

    elenco
        .slice(
            0,
            12
        )
        .forEach(
            function (ator) {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "cast-item";

                const imagem =
                    document.createElement(
                        "img"
                    );

                imagem.className =
                    "cast-image";

                imagem.alt =
                    ator.name ||
                    "Ator";

                imagem.loading =
                    "lazy";

                const foto =
                    ator.profile_path ||
                    "";

                if (foto) {
                    imagem.src =
                        foto.startsWith(
                            "http"
                        )
                            ? foto
                            : `${IMG}${foto}`;
                }

                imagem.onerror =
                    function () {
                        imagem.removeAttribute(
                            "src"
                        );

                        imagem.classList.add(
                            "no-image"
                        );
                    };

                const nome =
                    document.createElement(
                        "span"
                    );

                nome.className =
                    "cast-name";

                nome.textContent =
                    ator.name ||
                    "Nome não disponível";

                item.appendChild(
                    imagem
                );

                item.appendChild(
                    nome
                );

                if (
                    ator.character
                ) {
                    const personagem =
                        document.createElement(
                            "small"
                        );

                    personagem.className =
                        "cast-character";

                    personagem.textContent =
                        ator.character;

                    item.appendChild(
                        personagem
                    );
                }

                container.appendChild(
                    item
                );
            }
        );
}


async function abrirDetalhes(
    conteudo,
    tipo
) {
    if (!conteudo) {
        return;
    }

    const id =
        obterIdSeguro(
            conteudo
        );

    if (!id) {
        console.error(
            "Conteúdo sem ID válido:",
            conteudo
        );

        return;
    }

    const tipoFinal =
        obterTipo(
            conteudo,
            tipo
        );

    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        console.error(
            "Modal de detalhes não encontrado."
        );

        return;
    }

    modal.hidden =
        false;

    modal.classList.add(
        "is-open"
    );

    document.body.classList.add(
        "modal-open"
    );

    const conteudoInicial =
        normalizarConteudo(
            conteudo,
            tipoFinal
        );

    preencherDetalhes(
        conteudoInicial,
        tipoFinal
    );

    registrarHistorico(
        conteudoInicial
    );

    const resposta =
        await buscarTMDB(
            `/api/details/${tipoFinal}/${id}`
        );

    if (!resposta.ok) {
        console.error(
            "Erro ao carregar detalhes:",
            resposta.erro
        );

        preencherDetalhes(
            conteudoInicial,
            tipoFinal
        );

        return;
    }

    const detalhes =
        resposta;

    preencherDetalhes(
        detalhes,
        tipoFinal
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

    modal.classList.remove(
        "is-open"
    );

    modal.hidden =
        true;

    document.body.classList.remove(
        "modal-open"
    );

    appState.detalhesAtual =
        null;
}


function configurarModalDetalhes() {
    const modal =
        document.getElementById(
            "details-modal"
        );

    if (!modal) {
        return;
    }

    const botoesFechar =
        modal.querySelectorAll(
            "[data-close-modal], .modal-close, .details-close, #details-close"
        );

    botoesFechar.forEach(
        function (botao) {
            botao.addEventListener(
                "click",
                fecharDetalhes
            );
        }
    );

    const backdrop =
        modal.querySelector(
            ".modal-backdrop"
        );

    if (backdrop) {
        backdrop.addEventListener(
            "click",
            function (event) {
                if (
                    event.target ===
                    backdrop
                ) {
                    fecharDetalhes();
                }
            }
        );
    }

    modal.addEventListener(
        "click",
        function (event) {
            if (
                event.target === modal
            ) {
                fecharDetalhes();
            }
        }
    );
}


function configurarTeclaEscape() {
    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key !== "Escape"
            ) {
                return;
            }

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

            if (
                detailsModal &&
                !detailsModal.hidden
            ) {
                fecharDetalhes();
                return;
            }

            if (
                playerModal &&
                !playerModal.hidden
            ) {
                fecharModalPlayer();
                return;
            }

            if (
                profileModal &&
                !profileModal.hidden
            ) {
                fecharModalPerfil();
            }
        }
    );
}


function configurarBusca() {
    const area =
        document.getElementById(
            "search-area"
        );

    const input =
        document.getElementById(
            "search-input"
        );

    const botao =
        document.getElementById(
            "search-button"
        );

    const fechar =
        document.getElementById(
            "search-close"
        );

    const toggle =
        document.getElementById(
            "search-toggle"
        );

    const secao =
        document.getElementById(
            "search-results-section"
        );

    const resultados =
        document.getElementById(
            "search-results-row"
        );

    if (
        !input ||
        !resultados
    ) {
        return;
    }

    async function executarBusca() {
        const termo =
            input.value.trim();

        if (
            termo.length < 2
        ) {
            resultados.innerHTML =
                "";

            if (secao) {
                secao.hidden =
                    true;
            }

            appState.buscaAtiva =
                false;

            return;
        }

        if (secao) {
            secao.hidden =
                false;
        }

        resultados.innerHTML =
            "<div class=\"search-loading\">Buscando...</div>";

        const resposta =
            await buscarTMDB(
                `/api/search?query=${encodeURIComponent(
                    termo
                )}&page=1`
            );

        const lista =
            extrairResultados(
                resposta
            ).filter(
                conteudoPermitido
            );

        resultados.innerHTML =
            "";

        if (!lista.length) {
            resultados.innerHTML =
                "<p class=\"search-empty\">Nenhum resultado encontrado.</p>";

            appState.buscaAtiva =
                true;

            return;
        }

        lista
            .slice(
                0,
                MAX_ITENS_SECAO
            )
            .forEach(
                function (item) {
                    const card =
                        criarCard(
                            item,
                            obterTipo(item)
                        );

                    if (card) {
                        resultados.appendChild(
                            card
                        );
                    }
                }
            );

        appState.buscaAtiva =
            true;

        if (secao) {
            secao.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    let timerBusca =
        null;

    function iniciarBuscaComAtraso() {
        clearTimeout(
            timerBusca
        );

        timerBusca =
            setTimeout(
                executarBusca,
                350
            );
    }

    input.addEventListener(
        "input",
        iniciarBuscaComAtraso
    );

    input.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Enter"
            ) {
                event.preventDefault();

                clearTimeout(
                    timerBusca
                );

                executarBusca();
            }
        }
    );

    if (botao) {
        botao.addEventListener(
            "click",
            executarBusca
        );
    }

    if (toggle) {
        toggle.addEventListener(
            "click",
            function () {
                if (!area) {
                    return;
                }

                area.hidden =
                    !area.hidden;

                if (!area.hidden) {
                    input.focus();
                }
            }
        );
    }

    if (fechar) {
        fechar.addEventListener(
            "click",
            function () {
                input.value =
                    "";

                if (area) {
                    area.hidden =
                        true;
                }

                resultados.innerHTML =
                    "";

                if (secao) {
                    secao.hidden =
                        true;
                }

                appState.buscaAtiva =
                    false;
            }
        );
    }
}


function configurarMenuUsuario() {
    const botao =
        document.getElementById(
            "profile-button"
        );

    const menu =
        document.getElementById(
            "user-menu"
        );

    if (
        !botao ||
        !menu
    ) {
        return;
    }

    botao.addEventListener(
        "click",
        function (event) {
            event.stopPropagation();

            menu.hidden =
                !menu.hidden;
        }
    );

    document.addEventListener(
        "click",
        function (event) {
            if (
                event.target === botao ||
                menu.contains(
                    event.target
                )
            ) {
                return;
            }

            menu.hidden =
                true;
        }
    );
}


function abrirModalPerfil() {
    const modal =
        document.getElementById(
            "profile-modal"
        );

    if (!modal) {
        return;
    }

    modal.hidden =
        false;

    modal.classList.add(
        "is-open"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function fecharModalPerfil() {
    const modal =
        document.getElementById(
            "profile-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "is-open"
    );

    modal.hidden =
        true;

    document.body.classList.remove(
        "modal-open"
    );
}


function configurarPerfil() {
    const abrir =
        document.getElementById(
            "profile-button"
        );

    const fechar =
        document.getElementById(
            "profile-close"
        );

    if (abrir) {
        abrir.addEventListener(
            "dblclick",
            abrirModalPerfil
        );
    }

    if (fechar) {
        fechar.addEventListener(
            "click",
            fecharModalPerfil
        );
    }
}


function fecharModalPlayer() {
    const modal =
        document.getElementById(
            "player-modal"
        );

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    modal.classList.remove(
        "is-open"
    );

    document.body.classList.remove(
        "modal-open"
    );

    const frame =
        document.getElementById(
            "player-iframe"
        );

    if (frame) {
        frame.src =
            "about:blank";
    }
}


function configurarPlayer() {
    const fechar =
        document.getElementById(
            "player-close"
        );

    if (fechar) {
        fechar.addEventListener(
            "click",
            fecharModalPlayer
        );
    }
}


function atualizarAnoRodape() {
    const elemento =
        document.getElementById(
            "current-year"
        );

    if (elemento) {
        elemento.textContent =
            new Date().getFullYear();
    }
}


function inicializarApp() {
    carregarStorage();

    configurarModalDetalhes();

    configurarTeclaEscape();

    configurarBusca();

    configurarMenuUsuario();

    configurarPerfil();

    configurarPlayer();

    atualizarAnoRodape();

    iniciarSlider();

    carregarFilmes();

    carregarSeries();
}


if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        inicializarApp
    );
} else {
    inicializarApp();
}


window.CineFamily = {
    openDetails:
        abrirDetalhes,

    closeDetails:
        fecharDetalhes,

    addFavorite:
        adicionarFavorito,

    removeFavorite:
        removerFavorito,

    toggleFavorite:
        alternarFavorito,

    getFavorites:
        function () {
            return appState.favoritos;
        },

    getHistory:
        function () {
            return appState.historico;
        },

    reloadStorage:
        carregarStorage
};
function configurarNavegacao() {
    const links =
        document.querySelectorAll(
            'a[href^="#"]'
        );

    links.forEach(
        function (link) {
            link.addEventListener(
                "click",
                function (event) {
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

                    const destino =
                        document.querySelector(
                            href
                        );

                    if (!destino) {
                        return;
                    }

                    event.preventDefault();

                    destino.scrollIntoView({
                        behavior:
                            "smooth",
                        block:
                            "start"
                    });

                    const menu =
                        document.getElementById(
                            "user-menu"
                        );

                    if (menu) {
                        menu.hidden =
                            true;
                    }
                }
            );
        }
    );
}


function configurarBotoesGerais() {
    const botoes =
        document.querySelectorAll(
            "[data-action]"
        );

    botoes.forEach(
        function (botao) {
            const acao =
                botao.dataset.action;

            if (
                acao ===
                "open-profile"
            ) {
                botao.addEventListener(
                    "click",
                    abrirModalPerfil
                );
            }

            if (
                acao ===
                "close-profile"
            ) {
                botao.addEventListener(
                    "click",
                    fecharModalPerfil
                );
            }

            if (
                acao ===
                "close-details"
            ) {
                botao.addEventListener(
                    "click",
                    fecharDetalhes
                );
            }

            if (
                acao ===
                "close-player"
            ) {
                botao.addEventListener(
                    "click",
                    fecharModalPlayer
                );
            }
        }
    );
}


function configurarFechamentoModais() {
    const modais =
        document.querySelectorAll(
            ".modal"
        );

    modais.forEach(
        function (modal) {
            modal.addEventListener(
                "click",
                function (event) {
                    if (
                        event.target !==
                        modal
                    ) {
                        return;
                    }

                    if (
                        modal.id ===
                        "details-modal"
                    ) {
                        fecharDetalhes();
                    }

                    if (
                        modal.id ===
                        "profile-modal"
                    ) {
                        fecharModalPerfil();
                    }

                    if (
                        modal.id ===
                        "player-modal"
                    ) {
                        fecharModalPlayer();
                    }
                }
            );
        }
    );
}


function configurarLinksCards() {
    document.addEventListener(
        "click",
        function (event) {
            const card =
                event.target.closest(
                    ".card"
                );

            if (!card) {
                return;
            }

            if (
                event.target.closest(
                    "button, a"
                )
            ) {
                return;
            }

            const id =
                Number(
                    card.dataset.id
                );

            const tipo =
                card.dataset.type ||
                "movie";

            if (!id) {
                return;
            }

            const lista =
                tipo === "tv"
                    ? appState.series
                    : appState.filmes;

            const encontrado =
                lista.find(
                    function (item) {
                        return (
                            Number(
                                item.id
                            ) === id
                        );
                    }
                );

            if (encontrado) {
                abrirDetalhes(
                    encontrado,
                    tipo
                );
            }
        }
    );
}


function corrigirImagensExistentes() {
    const imagens =
        document.querySelectorAll(
            "img"
        );

    imagens.forEach(
        function (imagem) {
            if (
                imagem.dataset.cinefamilyReady ===
                "true"
            ) {
                return;
            }

            imagem.dataset.cinefamilyReady =
                "true";

            imagem.addEventListener(
                "error",
                function () {
                    imagem.classList.add(
                        "no-image"
                    );
                }
            );
        }
    );
}


function observarMudancasDOM() {
    if (
        typeof MutationObserver ===
        "undefined"
    ) {
        return;
    }

    const observer =
        new MutationObserver(
            function () {
                corrigirImagensExistentes();
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


function prepararSecoes() {
    const ids =
        [
            "filmes",
            "series",
            "doramas",
            "gl",
            "kids",
            "mais-avaliados",
            "lancamentos",
            "tv",
            "explorar",
            "recomendados"
        ];

    ids.forEach(
        function (id) {
            const secao =
                document.getElementById(
                    id
                );

            if (!secao) {
                return;
            }

            const row =
                encontrarContainerCards(
                    secao
                );

            if (!row) {
                return;
            }

            row.classList.add(
                "content-row"
            );
        }
    );
}


async function carregarCategoriasExtras() {
    const doramas =
        await buscarTMDB(
            "/api/discover/tv?with_original_language=ko&page=1"
        );

    if (doramas.ok) {
        mostrarNaSecao(
            extrairResultados(
                doramas
            ),
            "doramas",
            "tv"
        );
    }

    const gl =
        await buscarTMDB(
            "/api/discover/tv?page=1"
        );

    if (gl.ok) {
        const lista =
            extrairResultados(
                gl
            );

        mostrarNaSecao(
            lista,
            "gl",
            "tv"
        );
    }

    const kids =
        await buscarTMDB(
            "/api/discover/movie?certification_country=BR&certification.lte=12&page=1"
        );

    if (kids.ok) {
        mostrarNaSecao(
            extrairResultados(
                kids
            ),
            "kids",
            "movie"
        );
    }
}


function atualizarEstadoPagina() {
    const body =
        document.body;

    if (!body) {
        return;
    }

    if (
        appState.buscaAtiva
    ) {
        body.classList.add(
            "search-active"
        );
    } else {
        body.classList.remove(
            "search-active"
        );
    }
}


function configurarObservacaoBusca() {
    const input =
        document.getElementById(
            "search-input"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        atualizarEstadoPagina
    );
}


function mostrarErroInicial(
    mensagem
) {
    const secoes =
        [
            "filmes",
            "series"
        ];

    secoes.forEach(
        function (id) {
            const secao =
                document.getElementById(
                    id
                );

            if (!secao) {
                return;
            }

            const container =
                encontrarContainerCards(
                    secao
                );

            if (!container) {
                return;
            }

            if (
                container.children.length ===
                0
            ) {
                const aviso =
                    document.createElement(
                        "p"
                    );

                aviso.className =
                    "content-empty";

                aviso.textContent =
                    mensagem;

                container.appendChild(
                    aviso
                );
            }
        }
    );
}


async function iniciarConteudo() {
    prepararSecoes();

    const resultados =
        await Promise.allSettled(
            [
                carregarFilmes(),
                carregarSeries(),
                carregarCategoriasExtras()
            ]
        );

    const houveErro =
        resultados.some(
            function (resultado) {
                return (
                    resultado.status ===
                    "rejected"
                );
            }
        );

    if (houveErro) {
        console.warn(
            "Uma ou mais categorias não puderam ser carregadas."
        );
    }

    mostrarErroInicial(
        "Nenhum conteúdo disponível no momento."
    );
}


function iniciarRecursosFinais() {
    configurarNavegacao();

    configurarBotoesGerais();

    configurarFechamentoModais();

    configurarLinksCards();

    configurarObservacaoBusca();

    corrigirImagensExistentes();

    observarMudancasDOM();
}


const inicializacaoOriginal =
    inicializarApp;


inicializarApp =
    function () {
        carregarStorage();

        configurarModalDetalhes();

        configurarTeclaEscape();

        configurarBusca();

        configurarMenuUsuario();

        configurarPerfil();

        configurarPlayer();

        atualizarAnoRodape();

        iniciarSlider();

        iniciarRecursosFinais();

        iniciarConteudo();
    };


if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        inicializarApp,
        {
            once: true
        }
    );
} else {
    inicializarApp();
}


window.CineFamily =
    window.CineFamily ||
    {};


window.CineFamily.openDetails =
    abrirDetalhes;

window.CineFamily.closeDetails =
    fecharDetalhes;

window.CineFamily.addFavorite =
    adicionarFavorito;

window.CineFamily.removeFavorite =
    removerFavorito;

window.CineFamily.toggleFavorite =
    alternarFavorito;

window.CineFamily.getFavorites =
    function () {
        return appState.favoritos;
    };

window.CineFamily.getHistory =
    function () {
        return appState.historico;
    };

window.CineFamily.reloadStorage =
    carregarStorage;
