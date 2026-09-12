"use strict";

const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

const STORAGE_FAVORITOS = "cinefamily_favoritos";
const STORAGE_HISTORICO = "cinefamily_historico";

const LEGACY_FAVORITOS = "cinefamilyFavoritos";
const LEGACY_HISTORICO = "cinefamilyHistorico";

const MAX_ITENS_SECAO = 10;

const appState = {
    filmes: [],
    series: [],
    favoritos: [],
    historico: [],
    buscaAtiva: false,
    paginaAtual: "inicio",
    slideAtual: 0,
    intervaloSlider: null
};

function textoOuPadrao(valor, padrao = "Não informado") {
    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ""
    ) {
        return padrao;
    }

    return String(valor).trim();
}

function obterTitulo(conteudo) {
    if (!conteudo) {
        return "Sem título";
    }

    return textoOuPadrao(
        conteudo.title ||
        conteudo.name ||
        conteudo.original_title ||
        conteudo.original_name,
        "Sem título"
    );
}

function obterTituloOriginal(conteudo) {
    if (!conteudo) {
        return "";
    }

    return textoOuPadrao(
        conteudo.original_title ||
        conteudo.original_name ||
        conteudo.title ||
        conteudo.name,
        ""
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

    return String(data).substring(0, 4);
}

function obterNota(conteudo) {
    if (!conteudo) {
        return "0.0";
    }

    const nota = Number(conteudo.vote_average);

    if (!Number.isFinite(nota)) {
        return "0.0";
    }

    return nota.toFixed(1);
}

function descobrirTipo(conteudo, tipoInformado = "") {
    const tipo = String(tipoInformado || "").toLowerCase();

    if (
        tipo === "serie" ||
        tipo === "tv" ||
        tipo === "series"
    ) {
        return "serie";
    }

    if (
        tipo === "filme" ||
        tipo === "movie" ||
        tipo === "filmes"
    ) {
        return "filme";
    }

    if (conteudo) {
        if (
            conteudo.media_type === "tv" ||
            conteudo.first_air_date ||
            conteudo.name
        ) {
            return "serie";
        }

        if (
            conteudo.media_type === "movie" ||
            conteudo.release_date ||
            conteudo.title
        ) {
            return "filme";
        }
    }

    return "filme";
}

function conteudoPermitido(conteudo) {
    if (!conteudo) {
        return false;
    }

    if (
        conteudo.adult === true ||
        conteudo.adult === "true" ||
        conteudo.adult === 1
    ) {
        return false;
    }

    return true;
}

function filtrarConteudos(lista) {
    if (!Array.isArray(lista)) {
        return [];
    }

    const vistos = new Set();

    return lista.filter((item) => {
        if (!conteudoPermitido(item)) {
            return false;
        }

        const id =
            item.id ||
            item.tmdb_id ||
            "";

        const tipo = descobrirTipo(
            item,
            item.media_type
        );

        const chave = `${tipo}-${id}`;

        if (id && vistos.has(chave)) {
            return false;
        }

        if (id) {
            vistos.add(chave);
        }

        return true;
    });
}

function obterImagem(conteudo) {
    if (!conteudo) {
        return "";
    }

    if (
        conteudo.poster_path &&
        String(conteudo.poster_path).startsWith("http")
    ) {
        return conteudo.poster_path;
    }

    if (conteudo.poster_path) {
        return IMG + conteudo.poster_path;
    }

    if (
        conteudo.backdrop_path &&
        String(conteudo.backdrop_path).startsWith("http")
    ) {
        return conteudo.backdrop_path;
    }

    if (conteudo.backdrop_path) {
        return IMG + conteudo.backdrop_path;
    }

    if (conteudo.poster) {
        return conteudo.poster;
    }

    if (conteudo.image) {
        return conteudo.image;
    }

    return "";
}

function escaparHTML(valor) {
    return String(
        valor === null || valor === undefined
            ? ""
            : valor
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escaparAtributo(valor) {
    return escaparHTML(valor);
}

function escaparCSS(valor) {
    return String(
        valor === null || valor === undefined
            ? ""
            : valor
    )
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");
}

async function buscarTMDB(endpoint) {
    try {
        const resposta = await fetch(
            TMDB_WORKER + endpoint,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        if (!resposta.ok) {
            throw new Error(
                `Erro HTTP ${resposta.status}`
            );
        }

        return await resposta.json();
    } catch (erro) {
        console.error(
            "Erro no Worker:",
            endpoint,
            erro
        );

        return null;
    }
}

function extrairResultados(dados) {
    if (!dados) {
        return [];
    }

    if (Array.isArray(dados)) {
        return dados;
    }

    if (Array.isArray(dados.results)) {
        return dados.results;
    }

    if (Array.isArray(dados.items)) {
        return dados.items;
    }

    if (Array.isArray(dados.data)) {
        return dados.data;
    }

    if (
        dados.data &&
        Array.isArray(dados.data.results)
    ) {
        return dados.data.results;
    }

    return [];
}

function encontrarSecao(id) {
    if (!id) {
        return null;
    }

    return (
        document.getElementById(id) ||
        document.querySelector(
            `[data-secao="${id}"]`
        ) ||
        document.querySelector(
            `section#${id}`
        )
    );
}

function encontrarContainerCards(secao) {
    if (!secao) {
        return null;
    }

    const seletores = [
        ".cards",
        ".cards-container",
        ".movie-row",
        ".movies-row",
        ".series-row",
        ".grid",
        ".conteudos",
        ".lista",
        ".carrossel",
        ".row"
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

function criarCard(conteudo, tipoForcado = "") {
    if (
        !conteudo ||
        !conteudoPermitido(conteudo)
    ) {
        return null;
    }

    const tipo = descobrirTipo(
        conteudo,
        tipoForcado
    );

    const titulo = obterTitulo(conteudo);
    const imagem = obterImagem(conteudo);
    const ano = obterAno(conteudo);
    const nota = obterNota(conteudo);

    const id =
        conteudo.id ||
        conteudo.tmdb_id ||
        "";

    const card =
        document.createElement("article");

    card.className = "card";
    card.dataset.id = String(id);
    card.dataset.tipo = tipo;
    card.dataset.titulo = titulo;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    card.innerHTML = `
        <div class="card-imagem">
            ${
                imagem
                    ? `
                        <img
                            class="card-poster"
                            src="${escaparAtributo(imagem)}"
                            alt="${escaparAtributo(titulo)}"
                            loading="lazy"
                        >
                    `
                    : `
                        <div class="card-poster sem-imagem">
                            <span>Sem imagem</span>
                        </div>
                    `
            }

            <div class="card-nota">
                ★ ${escaparHTML(nota)}
            </div>
        </div>

        <div class="card-info">
            <h3 class="card-titulo">
                ${escaparHTML(titulo)}
            </h3>

            ${
                ano
                    ? `
                        <span class="card-ano">
                            ${escaparHTML(ano)}
                        </span>
                    `
                    : ""
            }
        </div>
    `;

    card.addEventListener("click", () => {
        abrirDetalhes(conteudo, tipo);
    });

    card.addEventListener("keydown", (evento) => {
        if (
            evento.key === "Enter" ||
            evento.key === " "
        ) {
            evento.preventDefault();
            abrirDetalhes(conteudo, tipo);
        }
    });

    return card;
}

function mostrarNaSecao(
    idSecao,
    lista,
    tipoForcado = ""
) {
    const secao = encontrarSecao(idSecao);

    if (!secao) {
        return;
    }

    const container =
        encontrarContainerCards(secao);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const itens = filtrarConteudos(lista).slice(
        0,
        MAX_ITENS_SECAO
    );

    if (!itens.length) {
        return;
    }

    itens.forEach((item) => {
        const card = criarCard(
            item,
            tipoForcado ||
                descobrirTipo(
                    item,
                    item.media_type
                )
        );

        if (card) {
            container.appendChild(card);
        }
    });
}

async function carregarFilmes() {
    const resposta =
        await buscarTMDB("/filmes");

    const filmes =
        filtrarConteudos(
            extrairResultados(resposta)
        );

    appState.filmes =
        filmes.slice(0, MAX_ITENS_SECAO);

    mostrarNaSecao(
        "filmes",
        filmes,
        "filme"
    );

    const avaliadosResposta =
        await buscarTMDB(
            "/filmes?sort_by=vote_average.desc"
        );

    const avaliados =
        filtrarConteudos(
            extrairResultados(
                avaliadosResposta
            )
        );

    mostrarNaSecao(
        "avaliados",
        avaliados,
        "filme"
    );

    mostrarNaSecao(
        "mais-avaliados",
        avaliados,
        "filme"
    );

    const lancamentosResposta =
        await buscarTMDB(
            "/filmes?sort_by=primary_release_date.desc"
        );

    const lancamentos =
        filtrarConteudos(
            extrairResultados(
                lancamentosResposta
            )
        );

    mostrarNaSecao(
        "lancamentos",
        lancamentos,
        "filme"
    );

    mostrarNaSecao(
        "destaques-filmes",
        lancamentos,
        "filme"
    );

    return filmes;
}

function textoConteudo(conteudo) {
    if (!conteudo) {
        return "";
    }

    return [
        conteudo.name,
        conteudo.original_name,
        conteudo.overview,
        conteudo.original_language
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function ehDorama(conteudo) {
    if (!conteudo) {
        return false;
    }

    if (
        Array.isArray(conteudo.origin_country) &&
        conteudo.origin_country.includes("KR")
    ) {
        return true;
    }

    if (
        conteudo.original_language === "ko"
    ) {
        return true;
    }

    const texto =
        textoConteudo(conteudo);

    return (
        texto.includes("k-drama") ||
        texto.includes("kdrama") ||
        texto.includes("dorama")
    );
}

function ehGL(conteudo) {
    if (!conteudo) {
        return false;
    }

    const texto =
        textoConteudo(conteudo);

    return (
        texto.includes("boys love") ||
        texto.includes("boys-love") ||
        texto.includes("yaoi") ||
        texto.includes("shounen-ai") ||
        /\bbl\b/i.test(texto)
    );
}

function ehKids(conteudo) {
    if (!conteudo) {
        return false;
    }

    if (
        Array.isArray(conteudo.genre_ids) &&
        conteudo.genre_ids.includes(10762)
    ) {
        return true;
    }

    const texto =
        textoConteudo(conteudo);

    return (
        texto.includes("kids") ||
        texto.includes("children") ||
        texto.includes("infantil") ||
        texto.includes("family")
    );
}

async function carregarSeries() {
    const resposta =
        await buscarTMDB("/series");

    const series =
        filtrarConteudos(
            extrairResultados(resposta)
        );

    appState.series =
        series.slice(0, MAX_ITENS_SECAO);

    mostrarNaSecao(
        "series",
        series,
        "serie"
    );

    mostrarNaSecao(
        "doramas",
        series.filter(ehDorama),
        "serie"
    );

    mostrarNaSecao(
        "gl",
        series.filter(ehGL),
        "serie"
    );

    mostrarNaSecao(
        "kids",
        series.filter(ehKids),
        "serie"
    );

    mostrarNaSecao(
        "infantil",
        series.filter(ehKids),
        "serie"
    );

    return series;
}

function obterSlides() {
    return Array.from(
        document.querySelectorAll(".slide")
    );
}

function obterIndicadores() {
    return Array.from(
        document.querySelectorAll(".indicador")
    );
}

function mostrarSlide(indice) {
    const slides = obterSlides();

    if (!slides.length) {
        return;
    }

    if (indice < 0) {
        indice = slides.length - 1;
    }

    if (indice >= slides.length) {
        indice = 0;
    }

    appState.slideAtual = indice;

    slides.forEach((slide, i) => {
        slide.classList.toggle(
            "ativo",
            i === indice
        );

        slide.classList.toggle(
            "active",
            i === indice
        );
    });

    obterIndicadores().forEach(
        (indicador, i) => {
            indicador.classList.toggle(
                "ativo",
                i === indice
            );

            indicador.classList.toggle(
                "active",
                i === indice
            );
        }
    );
}

function proximoSlide() {
    mostrarSlide(
        appState.slideAtual + 1
    );
}

function slideAnterior() {
    mostrarSlide(
        appState.slideAtual - 1
    );
}

function iniciarSlider() {
    const slides = obterSlides();

    if (slides.length <= 1) {
        return;
    }

    if (appState.intervaloSlider) {
        clearInterval(
            appState.intervaloSlider
        );
    }

    appState.intervaloSlider =
        setInterval(
            proximoSlide,
            6000
        );
}

function configurarSlider() {
    const slides = obterSlides();

    if (!slides.length) {
        return;
    }

    mostrarSlide(
        appState.slideAtual
    );

    obterIndicadores().forEach(
        (indicador, indice) => {
            indicador.addEventListener(
                "click",
                () => {
                    mostrarSlide(indice);
                }
            );
        }
    );

    iniciarSlider();
}

function configurarControlesSlider() {
    document
        .querySelectorAll(
            ".proximo-slide, .slide-next, [data-slide='next']"
        )
        .forEach((botao) => {
            botao.addEventListener(
                "click",
                (evento) => {
                    evento.preventDefault();
                    proximoSlide();
                }
            );
        });

    document
        .querySelectorAll(
            ".anterior-slide, .slide-prev, [data-slide='prev']"
        )
        .forEach((botao) => {
            botao.addEventListener(
                "click",
                (evento) => {
                    evento.preventDefault();
                    slideAnterior();
                }
            );
        });
}
async function executarBusca() {
    const campo =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search") ||
        document.querySelector("#search-input");

    const resultados =
        document.querySelector("#resultados-busca") ||
        document.querySelector("#resultados") ||
        document.querySelector(".resultados-busca");

    if (!campo) {
        return;
    }

    const termo = String(
        campo.value || ""
    ).trim();

    if (!termo) {
        if (resultados) {
            resultados.innerHTML = "";
        }

        appState.buscaAtiva = false;
        return;
    }

    appState.buscaAtiva = true;

    if (resultados) {
        resultados.innerHTML =
            "<div class='busca-carregando'>Procurando...</div>";
    }

    try {
        const resposta =
            await buscarTMDB(
                "/buscar?query=" +
                encodeURIComponent(termo)
            );

        const lista =
            filtrarConteudos(
                extrairResultados(resposta)
            ).filter((item) => {
                return Boolean(
                    item.id &&
                    obterImagem(item)
                );
            });

        if (!resultados) {
            return;
        }

        resultados.innerHTML = "";

        if (!lista.length) {
            resultados.innerHTML = `
                <div class="sem-conteudo">
                    Nenhum resultado encontrado para
                    "${escaparHTML(termo)}".
                </div>
            `;

            return;
        }

        lista.forEach((item) => {
            const tipo =
                descobrirTipo(
                    item,
                    item.media_type
                );

            const card =
                criarCard(
                    item,
                    tipo
                );

            if (card) {
                resultados.appendChild(card);
            }
        });
    } catch (erro) {
        console.error(
            "Erro na busca:",
            erro
        );

        if (resultados) {
            resultados.innerHTML = `
                <div class="sem-conteudo">
                    Não foi possível realizar a busca.
                </div>
            `;
        }
    }
}

function abrirAreaBusca() {
    const area =
        document.querySelector("#area-busca") ||
        document.querySelector(".area-busca") ||
        document.querySelector(".search-area");

    if (!area) {
        return;
    }

    area.classList.add("ativo");
    area.classList.add("active");

    const campo =
        area.querySelector("input");

    if (campo) {
        setTimeout(() => {
            campo.focus();
        }, 100);
    }
}

function fecharAreaBusca() {
    const area =
        document.querySelector("#area-busca") ||
        document.querySelector(".area-busca") ||
        document.querySelector(".search-area");

    if (!area) {
        return;
    }

    area.classList.remove("ativo");
    area.classList.remove("active");
}

function configurarBusca() {
    const campo =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search") ||
        document.querySelector("#search-input");

    if (!campo) {
        return;
    }

    campo.addEventListener(
        "keydown",
        (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                executarBusca();
            }

            if (evento.key === "Escape") {
                campo.value = "";
                fecharAreaBusca();
            }
        }
    );

    campo.addEventListener(
        "input",
        () => {
            if (
                String(
                    campo.value || ""
                ).trim() === ""
            ) {
                const resultados =
                    document.querySelector(
                        "#resultados-busca"
                    ) ||
                    document.querySelector(
                        "#resultados"
                    );

                if (resultados) {
                    resultados.innerHTML = "";
                }

                appState.buscaAtiva = false;
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

    const tipoNormalizado =
        descobrirTipo(
            conteudo,
            tipo
        );

    const id =
        conteudo.id ||
        conteudo.tmdb_id ||
        conteudo._id ||
        "";

    if (!id) {
        return null;
    }

    return {
        ...conteudo,
        id: id,

        media_type:
            tipoNormalizado === "serie"
                ? "tv"
                : "movie",

        title:
            conteudo.title ||
            conteudo.name ||
            "",

        name:
            conteudo.name ||
            conteudo.title ||
            "",

        original_title:
            conteudo.original_title ||
            conteudo.original_name ||
            conteudo.title ||
            conteudo.name ||
            "",

        original_name:
            conteudo.original_name ||
            conteudo.original_title ||
            conteudo.name ||
            conteudo.title ||
            "",

        poster_path:
            conteudo.poster_path ||
            "",

        backdrop_path:
            conteudo.backdrop_path ||
            "",

        overview:
            conteudo.overview ||
            "",

        vote_average:
            Number(
                conteudo.vote_average
            ) || 0,

        release_date:
            conteudo.release_date ||
            conteudo.first_air_date ||
            "",

        first_air_date:
            conteudo.first_air_date ||
            conteudo.release_date ||
            ""
    };
}

function obterIdSeguro(conteudo) {
    if (!conteudo) {
        return "";
    }

    const id =
        conteudo.id ||
        conteudo.tmdb_id ||
        conteudo._id ||
        "";

    if (
        id === null ||
        id === undefined ||
        String(id).trim() === ""
    ) {
        return "";
    }

    return String(id).trim();
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
            "Conteúdo sem ID:",
            conteudo
        );

        return;
    }

    const tipoNormalizado =
        descobrirTipo(
            conteudo,
            tipo
        );

    registrarHistorico(
        conteudo
    );

    fecharDetalhes();

    const modal =
        document.createElement("div");

    modal.id =
        "cinefamily-modal";

    modal.className =
        "cinefamily-modal";

    modal.setAttribute(
        "role",
        "dialog"
    );

    modal.setAttribute(
        "aria-modal",
        "true"
    );

    modal.innerHTML = `
        <div class="detalhes-filme">

            <button
                class="fechar-detalhes"
                type="button"
                aria-label="Fechar"
            >
                ×
            </button>

            <div class="detalhes-conteudo">

                <div class="detalhes-poster">
                    <div class="detalhes-loading">
                        Carregando...
                    </div>
                </div>

                <div class="detalhes-info">
                    <div class="detalhes-loading">
                        Carregando informações...
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(
        modal
    );

    document.body.classList.add(
        "modal-aberto"
    );

    document.body.classList.add(
        "modal-open"
    );

    const botaoFechar =
        modal.querySelector(
            ".fechar-detalhes"
        );

    if (botaoFechar) {
        botaoFechar.addEventListener(
            "click",
            fecharDetalhes
        );
    }

    modal.addEventListener(
        "click",
        (evento) => {
            if (
                evento.target === modal
            ) {
                fecharDetalhes();
            }
        }
    );

    try {
        const endpoint =
            tipoNormalizado === "serie"
                ? "/serie?id=" +
                  encodeURIComponent(id)
                : "/filme?id=" +
                  encodeURIComponent(id);

        const resposta =
            await buscarTMDB(
                endpoint
            );

        let detalhes = resposta;

        if (
            resposta &&
            resposta.data
        ) {
            detalhes =
                resposta.data;
        }

        if (
            resposta &&
            resposta.result
        ) {
            detalhes =
                resposta.result;
        }

        if (
            resposta &&
            resposta.movie
        ) {
            detalhes =
                resposta.movie;
        }

        if (
            resposta &&
            resposta.tv
        ) {
            detalhes =
                resposta.tv;
        }

        if (
            !detalhes ||
            typeof detalhes !== "object"
        ) {
            detalhes = conteudo;
        }

        detalhes =
            normalizarConteudo(
                {
                    ...conteudo,
                    ...detalhes
                },
                tipoNormalizado
            );

        preencherDetalhes(
            modal,
            detalhes,
            tipoNormalizado
        );
    } catch (erro) {
        console.error(
            "Erro ao carregar detalhes:",
            erro
        );

        const info =
            modal.querySelector(
                ".detalhes-info"
            );

        if (info) {
            info.innerHTML = `
                <h2>
                    ${escaparHTML(
                        obterTitulo(conteudo)
                    )}
                </h2>

                <p>
                    Não foi possível carregar
                    as informações.
                </p>
            `;
        }
    }
}

function preencherDetalhes(
    modal,
    detalhes,
    tipo
) {
    if (
        !modal ||
        !detalhes
    ) {
        return;
    }

    const poster =
        modal.querySelector(
            ".detalhes-poster"
        );

    const info =
        modal.querySelector(
            ".detalhes-info"
        );

    const titulo =
        obterTitulo(detalhes);

    const tituloOriginal =
        obterTituloOriginal(detalhes);

    const imagem =
        obterImagem(detalhes);

    const ano =
        obterAno(detalhes);

    const nota =
        obterNota(detalhes);

    const sinopse =
        textoOuPadrao(
            detalhes.overview,
            "Sinopse não disponível."
        );

    let generos = [];

    if (
        Array.isArray(
            detalhes.genres
        )
    ) {
        generos =
            detalhes.genres
                .map(
                    (genero) =>
                        genero &&
                        genero.name
                            ? genero.name
                            : ""
                )
                .filter(Boolean);
    }

    if (
        !generos.length &&
        Array.isArray(
            detalhes.genre_names
        )
    ) {
        generos =
            detalhes.genre_names
                .filter(Boolean);
    }

    if (poster) {
        poster.innerHTML =
            imagem
                ? `
                    <img
                        class="detalhes-imagem"
                        src="${escaparAtributo(imagem)}"
                        alt="${escaparAtributo(titulo)}"
                    >
                `
                : `
                    <div class="sem-imagem">
                        Sem imagem
                    </div>
                `;
    }

    if (info) {
        info.innerHTML = `
            <span class="detalhes-tipo">
                ${tipo === "serie" ? "Série" : "Filme"}
            </span>

            <h2 class="detalhes-titulo">
                ${escaparHTML(titulo)}
            </h2>

            ${
                tituloOriginal &&
                tituloOriginal !== titulo
                    ? `
                        <p class="detalhes-original">
                            ${escaparHTML(
                                tituloOriginal
                            )}
                        </p>
                    `
                    : ""
            }

            <div class="detalhes-meta">

                ${
                    ano
                        ? `
                            <span>
                                ${escaparHTML(ano)}
                            </span>
                        `
                        : ""
                }

                <span>
                    ★ ${escaparHTML(nota)}
                </span>

                ${
                    generos.length
                        ? `
                            <span>
                                ${escaparHTML(
                                    generos.join(" • ")
                                )}
                            </span>
                        `
                        : ""
                }

            </div>

            <p class="detalhes-sinopse">
                ${escaparHTML(sinopse)}
            </p>

            <div class="detalhes-acoes">

                <button
                    type="button"
                    class="botao-favorito"
                >
                    ♡ Adicionar aos favoritos
                </button>

                <button
                    type="button"
                    class="botao-assistir"
                >
                    ▶ Assistir
                </button>

            </div>

            ${
                tipo === "serie"
                    ? `
                        <div class="detalhes-temporadas">
                            <h3>Temporadas</h3>

                            <div class="temporadas-lista">
                                <div class="detalhes-loading">
                                    Carregando temporadas...
                                </div>
                            </div>
                        </div>
                    `
                    : ""
            }

            <div class="detalhes-elenco">
                <h3>Elenco</h3>

                <div class="elenco-lista">
                    <div class="detalhes-loading">
                        Carregando elenco...
                    </div>
                </div>
            </div>
        `;
    }

    const backdrop =
        detalhes.backdrop_path
            ? (
                String(
                    detalhes.backdrop_path
                ).startsWith("http")
                    ? detalhes.backdrop_path
                    : IMG +
                      detalhes.backdrop_path
            )
            : "";

    if (backdrop) {
        const painel =
            modal.querySelector(
                ".detalhes-filme"
            );

        if (painel) {
            painel.style.setProperty(
                "--detalhes-backdrop",
                `url("${escaparCSS(backdrop)}")`
            );
        }
    }

    configurarBotaoFavorito(
        modal,
        detalhes,
        tipo
    );

    configurarBotaoAssistir(
        modal,
        detalhes,
        tipo
    );

    if (tipo === "serie") {
        carregarTemporadas(
            modal,
            detalhes
        );
    }

    carregarElenco(
        modal,
        detalhes
    );
}

function configurarBotaoFavorito(
    modal,
    conteudo,
    tipo
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
        conteudo,
        tipo
    );

    botao.addEventListener(
        "click",
        () => {
            const mensagem =
                alternarFavorito(
                    conteudo,
                    tipo
                );

            atualizarTextoFavorito(
                botao,
                conteudo,
                tipo
            );

            if (mensagem) {
                mostrarToast(
                    mensagem
                );
            }
        }
    );
}

function atualizarTextoFavorito(
    botao,
    conteudo,
    tipo
) {
    const favorito =
        estaNosFavoritos(
            conteudo,
            tipo
        );

    botao.classList.toggle(
        "favoritado",
        favorito
    );

    botao.innerHTML =
        favorito
            ? "♥ Remover dos favoritos"
            : "♡ Adicionar aos favoritos";
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

    botao.addEventListener(
        "click",
        () => {
            registrarHistorico(
                conteudo
            );

            botao.classList.add(
                "assistido"
            );

            botao.innerHTML =
                "✓ No histórico";

            mostrarToast(
                "Adicionado ao histórico."
            );
        }
    );
}

function fecharDetalhes() {
    const modal =
        document.getElementById(
            "cinefamily-modal"
        );

    if (modal) {
        modal.remove();
    }

    document.body.classList.remove(
        "modal-aberto"
    );

    document.body.classList.remove(
        "modal-open"
    );
}

function mostrarToast(mensagem) {
    if (!mensagem) {
        return;
    }

    const anterior =
        document.querySelector(
            ".cinefamily-toast"
        );

    if (anterior) {
        anterior.remove();
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "cinefamily-toast";

    toast.textContent =
        mensagem;

    document.body.appendChild(
        toast
    );

    setTimeout(() => {
        toast.classList.add(
            "ativo"
        );
    }, 10);

    setTimeout(() => {
        toast.classList.remove(
            "ativo"
        );

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}
function obterFavoritos() {
    try {
        const atual =
            localStorage.getItem(
                STORAGE_FAVORITOS
            );

        const antigo =
            localStorage.getItem(
                LEGACY_FAVORITOS
            );

        const dados =
            atual || antigo;

        if (!dados) {
            return [];
        }

        const favoritos =
            JSON.parse(dados);

        return Array.isArray(favoritos)
            ? favoritos
            : [];
    } catch (erro) {
        console.error(
            "Erro ao ler favoritos:",
            erro
        );

        return [];
    }
}

function salvarFavoritos(favoritos) {
    try {
        localStorage.setItem(
            STORAGE_FAVORITOS,
            JSON.stringify(
                Array.isArray(favoritos)
                    ? favoritos
                    : []
            )
        );
    } catch (erro) {
        console.error(
            "Erro ao salvar favoritos:",
            erro
        );
    }
}

function obterChaveConteudo(
    conteudo,
    tipo
) {
    if (!conteudo) {
        return "";
    }

    const id =
        obterIdSeguro(conteudo);

    if (!id) {
        return "";
    }

    const tipoNormalizado =
        descobrirTipo(
            conteudo,
            tipo
        );

    return `${tipoNormalizado}-${id}`;
}

function estaNosFavoritos(
    conteudo,
    tipo
) {
    const chave =
        obterChaveConteudo(
            conteudo,
            tipo
        );

    if (!chave) {
        return false;
    }

    const favoritos =
        obterFavoritos();

    return favoritos.some(
        (item) => {
            return (
                obterChaveConteudo(
                    item,
                    item.media_type
                ) === chave
            );
        }
    );
}

function adicionarFavorito(
    conteudo,
    tipo
) {
    if (!conteudo) {
        return;
    }

    const favoritos =
        obterFavoritos();

    if (
        estaNosFavoritos(
            conteudo,
            tipo
        )
    ) {
        return;
    }

    const copia = {
        ...conteudo,
        media_type:
            descobrirTipo(
                conteudo,
                tipo
            ) === "serie"
                ? "tv"
                : "movie"
    };

    favoritos.unshift(
        copia
    );

    salvarFavoritos(
        favoritos.slice(
            0,
            100
        )
    );

    appState.favoritos =
        obterFavoritos();
}

function removerFavorito(
    conteudo,
    tipo
) {
    const chave =
        obterChaveConteudo(
            conteudo,
            tipo
        );

    if (!chave) {
        return;
    }

    const favoritos =
        obterFavoritos();

    const restantes =
        favoritos.filter(
            (item) => {
                return (
                    obterChaveConteudo(
                        item,
                        item.media_type
                    ) !== chave
                );
            }
        );

    salvarFavoritos(
        restantes
    );

    appState.favoritos =
        restantes;
}

function alternarFavorito(
    conteudo,
    tipo
) {
    if (
        estaNosFavoritos(
            conteudo,
            tipo
        )
    ) {
        removerFavorito(
            conteudo,
            tipo
        );

        atualizarListasLocais();

        return "Removido dos favoritos.";
    }

    adicionarFavorito(
        conteudo,
        tipo
    );

    atualizarListasLocais();

    return "Adicionado aos favoritos.";
}

function encontrarContainerLista(
    seletores
) {
    for (
        const seletor of seletores
    ) {
        const elemento =
            document.querySelector(
                seletor
            );

        if (elemento) {
            return elemento;
        }
    }

    return null;
}

function carregarFavoritos() {
    const favoritos =
        obterFavoritos();

    appState.favoritos =
        favoritos;

    const container =
        encontrarContainerLista([
            "#favoritos",
            "#lista-favoritos",
            "#favoritos-container",
            ".lista-favoritos"
        ]);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!favoritos.length) {
        container.innerHTML = `
            <div class="sem-conteudo">
                Você ainda não adicionou favoritos.
            </div>
        `;

        return;
    }

    favoritos.forEach(
        (item) => {
            const card =
                criarCard(
                    item,
                    descobrirTipo(
                        item,
                        item.media_type
                    )
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
    try {
        const atual =
            localStorage.getItem(
                STORAGE_HISTORICO
            );

        const antigo =
            localStorage.getItem(
                LEGACY_HISTORICO
            );

        const dados =
            atual || antigo;

        if (!dados) {
            return [];
        }

        const historico =
            JSON.parse(dados);

        return Array.isArray(historico)
            ? historico
            : [];
    } catch (erro) {
        console.error(
            "Erro ao ler histórico:",
            erro
        );

        return [];
    }
}

function salvarHistorico(historico) {
    try {
        localStorage.setItem(
            STORAGE_HISTORICO,
            JSON.stringify(
                Array.isArray(historico)
                    ? historico
                    : []
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
    if (!conteudo) {
        return;
    }

    const id =
        obterIdSeguro(
            conteudo
        );

    if (!id) {
        return;
    }

    const tipo =
        descobrirTipo(
            conteudo,
            conteudo.media_type
        );

    const historico =
        obterHistorico();

    const chave =
        obterChaveConteudo(
            conteudo,
            tipo
        );

    const semDuplicado =
        historico.filter(
            (item) => {
                return (
                    obterChaveConteudo(
                        item,
                        item.media_type
                    ) !== chave
                );
            }
        );

    const registro = {
        ...conteudo,
        id: id,
        media_type:
            tipo === "serie"
                ? "tv"
                : "movie",
        cinefamily_visto_em:
            new Date().toISOString()
    };

    semDuplicado.unshift(
        registro
    );

    salvarHistorico(
        semDuplicado.slice(
            0,
            100
        )
    );

    appState.historico =
        obterHistorico();
}

function carregarHistorico() {
    const historico =
        obterHistorico();

    appState.historico =
        historico;

    const container =
        encontrarContainerLista([
            "#historico",
            "#lista-historico",
            "#historico-container",
            ".lista-historico"
        ]);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!historico.length) {
        container.innerHTML = `
            <div class="sem-conteudo">
                Seu histórico está vazio.
            </div>
        `;

        return;
    }

    historico.forEach(
        (item) => {
            const card =
                criarCard(
                    item,
                    descobrirTipo(
                        item,
                        item.media_type
                    )
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
    localStorage.removeItem(
        STORAGE_HISTORICO
    );

    localStorage.removeItem(
        LEGACY_HISTORICO
    );

    appState.historico = [];

    carregarHistorico();

    mostrarToast(
        "Histórico apagado."
    );
}

async function carregarTemporadas(
    modal,
    detalhes
) {
    if (!modal || !detalhes) {
        return;
    }

    const container =
        modal.querySelector(
            ".temporadas-lista"
        );

    if (!container) {
        return;
    }

    const id =
        obterIdSeguro(
            detalhes
        );

    if (!id) {
        return;
    }

    try {
        const resposta =
            await buscarTMDB(
                "/serie?id=" +
                encodeURIComponent(id)
            );

        let dados =
            resposta;

        if (
            resposta &&
            resposta.data
        ) {
            dados =
                resposta.data;
        }

        const temporadas =
            Array.isArray(
                dados &&
                dados.seasons
            )
                ? dados.seasons
                : Array.isArray(
                    detalhes.seasons
                )
                    ? detalhes.seasons
                    : [];

        container.innerHTML = "";

        if (!temporadas.length) {
            container.innerHTML = `
                <div class="sem-conteudo">
                    Informações de temporadas indisponíveis.
                </div>
            `;

            return;
        }

        temporadas
            .filter(
                (temporada) => {
                    return (
                        temporada &&
                        temporada.season_number >= 0
                    );
                }
            )
            .forEach(
                (temporada) => {
                    const botao =
                        document.createElement(
                            "button"
                        );

                    botao.type =
                        "button";

                    botao.className =
                        "temporada-item";

                    botao.innerHTML = `
                        <span>
                            ${escaparHTML(
                                temporada.name ||
                                `Temporada ${temporada.season_number}`
                            )}
                        </span>

                        <small>
                            ${
                                temporada.episode_count
                                    ? temporada.episode_count +
                                      " episódios"
                                    : ""
                            }
                        </small>
                    `;

                    botao.addEventListener(
                        "click",
                        () => {
                            carregarEpisodios(
                                modal,
                                detalhes,
                                temporada.season_number
                            );
                        }
                    );

                    container.appendChild(
                        botao
                    );
                }
            );
    } catch (erro) {
        console.error(
            "Erro ao carregar temporadas:",
            erro
        );

        container.innerHTML = `
            <div class="sem-conteudo">
                Não foi possível carregar as temporadas.
            </div>
        `;
    }
}

async function carregarEpisodios(
    modal,
    detalhes,
    numeroTemporada
) {
    if (!modal || !detalhes) {
        return;
    }

    const id =
        obterIdSeguro(
            detalhes
        );

    if (!id) {
        return;
    }

    const container =
        modal.querySelector(
            ".temporadas-lista"
        );

    if (!container) {
        return;
    }

    try {
        const resposta =
            await buscarTMDB(
                "/serie?id=" +
                encodeURIComponent(id) +
                "&season=" +
                encodeURIComponent(
                    numeroTemporada
                )
            );

        let dados =
            resposta;

        if (
            resposta &&
            resposta.data
        ) {
            dados =
                resposta.data;
        }

        const episodios =
            Array.isArray(
                dados &&
                dados.episodes
            )
                ? dados.episodes
                : [];

        if (!episodios.length) {
            return;
        }

        container.innerHTML = `
            <button
                type="button"
                class="voltar-temporadas"
            >
                ← Voltar às temporadas
            </button>

            <div class="episodios-lista"></div>
        `;

        const lista =
            container.querySelector(
                ".episodios-lista"
            );

        const voltar =
            container.querySelector(
                ".voltar-temporadas"
            );

        if (voltar) {
            voltar.addEventListener(
                "click",
                () => {
                    carregarTemporadas(
                        modal,
                        detalhes
                    );
                }
            );
        }

        episodios.forEach(
            (episodio) => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "episodio-item";

                const imagem =
                    episodio.still_path
                        ? (
                            String(
                                episodio.still_path
                            ).startsWith("http")
                                ? episodio.still_path
                                : IMG +
                                  episodio.still_path
                        )
                        : "";

                item.innerHTML = `
                    ${
                        imagem
                            ? `
                                <img
                                    src="${escaparAtributo(
                                        imagem
                                    )}"
                                    alt="${escaparAtributo(
                                        episodio.name ||
                                        "Episódio"
                                    )}"
                                >
                            `
                            : ""
                    }

                    <div class="episodio-info">
                        <strong>
                            ${escaparHTML(
                                episodio.episode_number +
                                ". " +
                                (
                                    episodio.name ||
                                    "Episódio"
                                )
                            )}
                        </strong>

                        ${
                            episodio.overview
                                ? `
                                    <p>
                                        ${escaparHTML(
                                            episodio.overview
                                        )}
                                    </p>
                                `
                                : ""
                        }
                    </div>
                `;

                if (lista) {
                    lista.appendChild(
                        item
                    );
                }
            }
        );
    } catch (erro) {
        console.error(
            "Erro ao carregar episódios:",
            erro
        );
    }
}

async function carregarElenco(
    modal,
    detalhes
) {
    if (!modal || !detalhes) {
        return;
    }

    const container =
        modal.querySelector(
            ".elenco-lista"
        );

    if (!container) {
        return;
    }

    const id =
        obterIdSeguro(
            detalhes
        );

    if (!id) {
        return;
    }

    const tipo =
        descobrirTipo(
            detalhes,
            detalhes.media_type
        );

    try {
        const endpoint =
            tipo === "serie"
                ? "/serie?id=" +
                  encodeURIComponent(id)
                : "/filme?id=" +
                  encodeURIComponent(id);

        const resposta =
            await buscarTMDB(
                endpoint
            );

        let dados =
            resposta;

        if (
            resposta &&
            resposta.data
        ) {
            dados =
                resposta.data;
        }

        let elenco = [];

        if (
            dados &&
            dados.credits &&
            Array.isArray(
                dados.credits.cast
            )
        ) {
            elenco =
                dados.credits.cast;
        }

        if (
            !elenco.length &&
            Array.isArray(
                dados &&
                dados.cast
            )
        ) {
            elenco =
                dados.cast;
        }

        if (
            !elenco.length &&
            Array.isArray(
                detalhes.cast
            )
        ) {
            elenco =
                detalhes.cast;
        }

        container.innerHTML = "";

        if (!elenco.length) {
            container.innerHTML = `
                <div class="sem-conteudo">
                    Elenco não disponível.
                </div>
            `;

            return;
        }

        elenco
            .slice(0, 12)
            .forEach(
                (pessoa) => {
                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "ator-item";

                    const foto =
                        pessoa.profile_path
                            ? (
                                String(
                                    pessoa.profile_path
                                ).startsWith("http")
                                    ? pessoa.profile_path
                                    : IMG +
                                      pessoa.profile_path
                            )
                            : "";

                    item.innerHTML = `
                        ${
                            foto
                                ? `
                                    <img
                                        src="${escaparAtributo(
                                            foto
                                        )}"
                                        alt="${escaparAtributo(
                                            pessoa.name ||
                                            "Ator"
                                        )}"
                                    >
                                `
                                : `
                                    <div class="ator-sem-foto">
                                        👤
                                    </div>
                                `
                        }

                        <strong>
                            ${escaparHTML(
                                pessoa.name ||
                                "Nome não informado"
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

                    container.appendChild(
                        item
                    );
                }
            );
    } catch (erro) {
        console.error(
            "Erro ao carregar elenco:",
            erro
        );

        container.innerHTML = `
            <div class="sem-conteudo">
                Elenco não disponível.
            </div>
        `;
    }
}

function mostrarSecaoPorId(
    id
) {
    if (!id) {
        return;
    }

    const secao =
        document.getElementById(id);

    if (!secao) {
        return;
    }

    secao.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    appState.paginaAtual =
        id;
}

function configurarNavegacaoInterna() {
    document.addEventListener(
        "click",
        (evento) => {
            const link =
                evento.target.closest(
                    "[data-secao]"
                );

            if (!link) {
                return;
            }

            const id =
                link.getAttribute(
                    "data-secao"
                );

            if (!id) {
                return;
            }

            evento.preventDefault();

            mostrarSecaoPorId(
                id
            );
        }
    );
}
function configurarBotoesGerais() {
    document.addEventListener("click", function (event) {
        const alvo = event.target;

        const botaoBusca = alvo.closest(
            "#btn-busca, #btn-search, .abrir-busca, .botao-busca, [data-abrir-busca]"
        );

        if (botaoBusca) {
            event.preventDefault();
            abrirAreaBusca();
            return;
        }

        const botaoFecharBusca = alvo.closest(
            "#fechar-busca, .fechar-busca, [data-fechar-busca]"
        );

        if (botaoFecharBusca) {
            event.preventDefault();
            fecharAreaBusca();
            return;
        }

        const botaoFecharModal = alvo.closest(
            ".fechar-modal, .fechar-detalhes, [data-fechar-detalhes]"
        );

        if (botaoFecharModal) {
            event.preventDefault();
            fecharDetalhes();
            return;
        }

        const botaoLimparHistorico = alvo.closest(
            "#limpar-historico, .limpar-historico, [data-limpar-historico]"
        );

        if (botaoLimparHistorico) {
            event.preventDefault();
            limparHistorico();
            return;
        }

        const link = alvo.closest("a[href]");

        if (link) {
            const href = link.getAttribute("href");

            if (href === "#" || href === "") {
                event.preventDefault();
            }
        }
    });
}

function configurarTeclaEscape() {
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }

        fecharDetalhes();
        fecharAreaBusca();
    });
}

function configurarFechamentoModal() {
    document.addEventListener("click", function (event) {
        const modal = event.target.closest(
            "#cinefamily-modal, .cinefamily-modal"
        );

        if (!modal) {
            return;
        }

        if (
            event.target === modal ||
            event.target.classList.contains("modal-overlay")
        ) {
            fecharDetalhes();
        }
    });
}

function configurarImagens() {
    document.addEventListener(
        "error",
        function (event) {
            const imagem = event.target;

            if (!imagem || imagem.tagName !== "IMG") {
                return;
            }

            imagem.classList.add("imagem-sem-conteudo");

            if (
                imagem.dataset.fallbackAplicado === "true"
            ) {
                return;
            }

            imagem.dataset.fallbackAplicado = "true";

            if (
                imagem.classList.contains("poster") ||
                imagem.classList.contains("detalhes-poster")
            ) {
                imagem.src =
                    "https://via.placeholder.com/500x750/111111/ffffff?text=CineFamily";
            } else {
                imagem.src =
                    "https://via.placeholder.com/500x750/111111/ffffff?text=CineFamily";
            }
        },
        true
    );
}

function configurarMenu() {
    const botoesMenu = document.querySelectorAll(
        ".menu-toggle, .menu-btn, .hamburguer, .botao-menu"
    );

    botoesMenu.forEach(function (botao) {
        if (botao.dataset.menuConfigurado === "true") {
            return;
        }

        botao.dataset.menuConfigurado = "true";

        botao.addEventListener("click", function (event) {
            event.preventDefault();

            document.body.classList.toggle(
                "menu-aberto"
            );

            const topo =
                document.querySelector(".topo");

            if (topo) {
                topo.classList.toggle("menu-aberto");
            }

            const menu =
                document.querySelector(
                    ".menu, .menu-principal, .navegacao, nav"
                );

            if (menu) {
                menu.classList.toggle("menu-aberto");
            }
        });
    });
}

function configurarFechamentoMenu() {
    document.addEventListener("click", function (event) {
        const link = event.target.closest(
            "nav a, .menu a, .menu-principal a, .navegacao a"
        );

        if (!link) {
            return;
        }

        document.body.classList.remove(
            "menu-aberto"
        );

        const topo =
            document.querySelector(".topo");

        if (topo) {
            topo.classList.remove("menu-aberto");
        }

        const menus = document.querySelectorAll(
            ".menu, .menu-principal, .navegacao, nav"
        );

        menus.forEach(function (menu) {
            menu.classList.remove("menu-aberto");
        });
    });
}

function configurarNavegacaoPorLinks() {
    document.addEventListener("click", function (event) {
        const link = event.target.closest(
            'a[href^="#"]'
        );

        if (!link) {
            return;
        }

        const href =
            link.getAttribute("href");

        if (
            !href ||
            href === "#" ||
            href.length <= 1
        ) {
            return;
        }

        const id = href.substring(1);

        const destino =
            document.getElementById(id);

        if (!destino) {
            return;
        }

        event.preventDefault();

        destino.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        mostrarSecaoPorId(id);
    });
}

function atualizarListasLocais() {
    appState.favoritos = obterFavoritos();
    appState.historico = obterHistorico();

    carregarFavoritos();
    carregarHistorico();
}

function configurarEventoStorage() {
    window.addEventListener(
        "storage",
        function (event) {
            if (
                event.key === STORAGE_FAVORITOS ||
                event.key === STORAGE_HISTORICO ||
                event.key === LEGACY_FAVORITOS ||
                event.key === LEGACY_HISTORICO
            ) {
                atualizarListasLocais();
            }
        }
    );
}

function configurarEventoVisibilidade() {
    document.addEventListener(
        "visibilitychange",
        function () {
            if (
                document.visibilityState === "visible"
            ) {
                atualizarListasLocais();
            }
        }
    );
}

function configurarCardsExistentes() {
    const cards =
        document.querySelectorAll(".card");

    cards.forEach(function (card) {
        const id =
            card.dataset.id ||
            card.getAttribute("data-id");

        if (!id) {
            card.classList.add(
                "card-sem-identificacao"
            );
        }
    });
}

async function carregarConteudosIniciais() {
    try {
        await Promise.all([
            carregarFilmes(),
            carregarSeries()
        ]);
    } catch (erro) {
        console.error(
            "Erro ao carregar conteúdos iniciais:",
            erro
        );
    }

    configurarSlider();
    configurarCardsExistentes();
}

async function iniciarCineFamily() {
    appState.favoritos = obterFavoritos();
    appState.historico = obterHistorico();

    configurarBotoesGerais();
    configurarTeclaEscape();
    configurarFechamentoModal();
    configurarImagens();
    configurarMenu();
    configurarFechamentoMenu();
    configurarNavegacaoPorLinks();
    configurarBusca();
    configurarNavegacaoInterna();
    configurarEventoStorage();
    configurarEventoVisibilidade();

    carregarFavoritos();
    carregarHistorico();

    await carregarConteudosIniciais();

    carregarFavoritos();
    carregarHistorico();
}

if (
    document.readyState === "loading"
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
    carregarHistorico,
    mostrarSecaoPorId
};
