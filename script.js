/* =========================================================
   CINEFAMILY — SCRIPT.JS
   PARTE 1/4
   TMDB + CARDS + CARREGAMENTO DAS CATEGORIAS
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

const STORAGE_FAVORITOS = "cinefamilyFavoritos";
const STORAGE_HISTORICO = "cinefamilyHistorico";

const MAX_ITENS_SECAO = 10;

/* =========================================================
   ESTADO DA APLICAÇÃO
   ========================================================= */

const appState = {
    filmes: [],
    series: [],
    favoritos: [],
    historico: [],
    buscaAtiva: false,
    paginaAtual: "inicio"
};

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */

function obterTitulo(conteudo) {
    if (!conteudo) {
        return "Sem título";
    }

    return conteudo.title || conteudo.name || "Sem título";
}


function obterData(conteudo) {
    if (!conteudo) {
        return "";
    }

    const data =
        conteudo.release_date ||
        conteudo.first_air_date ||
        "";

    if (!data) {
        return "";
    }

    const partes = data.split("-");

    if (partes.length !== 3) {
        return data;
    }

    return partes[2] + "/" + partes[1] + "/" + partes[0];
}


function obterAno(conteudo) {
    if (!conteudo) {
        return "";
    }

    const data =
        conteudo.release_date ||
        conteudo.first_air_date ||
        "";

    if (!data) {
        return "";
    }

    return data.substring(0, 4);
}


function obterNota(conteudo) {
    if (!conteudo) {
        return "0.0";
    }

    const nota = Number(conteudo.vote_average);

    if (Number.isNaN(nota)) {
        return "0.0";
    }

    return nota.toFixed(1);
}


function descobrirTipo(conteudo) {
    if (!conteudo) {
        return "filme";
    }

    if (conteudo.media_type === "tv") {
        return "serie";
    }

    if (conteudo.media_type === "movie") {
        return "filme";
    }

    if (conteudo.first_air_date || conteudo.name) {
        return "serie";
    }

    return "filme";
}


function conteudoPermitido(conteudo) {
    if (!conteudo) {
        return false;
    }

    if (conteudo.adult === true) {
        return false;
    }

    return true;
}


function obterImagem(conteudo) {
    if (!conteudo) {
        return "";
    }

    if (conteudo.poster_path) {
        return IMG + conteudo.poster_path;
    }

    if (conteudo.backdrop_path) {
        return IMG + conteudo.backdrop_path;
    }

    return "";
}


function escaparHTML(valor) {
    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function textoOuPadrao(valor, padrao) {
    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ""
    ) {
        return padrao;
    }

    return valor;
}


/* =========================================================
   COMUNICAÇÃO COM O WORKER / TMDB
   ========================================================= */

async function buscarTMDB(endpoint) {
    try {
        const resposta = await fetch(TMDB_WORKER + endpoint);

        console.log(
            "📡 Worker:",
            endpoint,
            "Status:",
            resposta.status
        );

        if (!resposta.ok) {
            throw new Error(
                "Erro HTTP " + resposta.status
            );
        }

        const dados = await resposta.json();

        return dados;
    } catch (erro) {
        console.error(
            "❌ Erro ao consultar o Worker:",
            endpoint,
            erro
        );

        throw erro;
    }
}


/* =========================================================
   EXTRAÇÃO SEGURA DE RESULTADOS
   ========================================================= */

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


/* =========================================================
   SLIDER / DESTAQUES
   ========================================================= */

let slideAtual = 0;
let intervaloSlider = null;


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
    const indicadores = obterIndicadores();

    if (!slides.length) {
        return;
    }

    if (indice < 0) {
        indice = slides.length - 1;
    }

    if (indice >= slides.length) {
        indice = 0;
    }

    slideAtual = indice;

    slides.forEach(function(slide, index) {
        slide.classList.toggle(
            "ativo",
            index === slideAtual
        );
    });

    indicadores.forEach(function(indicador, index) {
        indicador.classList.toggle(
            "ativo",
            index === slideAtual
        );
    });
}


function proximoSlide() {
    mostrarSlide(slideAtual + 1);
}


function slideAnterior() {
    mostrarSlide(slideAtual - 1);
}


function iniciarSlider() {
    if (intervaloSlider) {
        clearInterval(intervaloSlider);
    }

    const slides = obterSlides();

    if (slides.length <= 1) {
        return;
    }

    intervaloSlider = setInterval(
        function() {
            proximoSlide();
        },
        6000
    );
}


function configurarSlider() {
    const indicadores = obterIndicadores();

    indicadores.forEach(function(indicador, index) {
        indicador.addEventListener(
            "click",
            function() {
                mostrarSlide(index);
            }
        );
    });

    const botaoProximo =
        document.querySelector(
            ".slider-next, .proximo-slide, #proximo-slide"
        );

    const botaoAnterior =
        document.querySelector(
            ".slider-prev, .anterior-slide, #anterior-slide"
        );

    if (botaoProximo) {
        botaoProximo.addEventListener(
            "click",
            proximoSlide
        );
    }

    if (botaoAnterior) {
        botaoAnterior.addEventListener(
            "click",
            slideAnterior
        );
    }

    mostrarSlide(0);
    iniciarSlider();
}


/* =========================================================
   CRIAÇÃO DOS CARDS
   ========================================================= */

function criarCard(conteudo) {
    if (!conteudoPermitido(conteudo)) {
        return null;
    }

    const card = document.createElement("div");

    card.className = "card";

    const titulo = escaparHTML(
        obterTitulo(conteudo)
    );

    const nota = escaparHTML(
        obterNota(conteudo)
    );

    const imagem = obterImagem(conteudo);

    const tipo = descobrirTipo(conteudo);

    const data = escaparHTML(
        obterData(conteudo)
    );

    let imagemHTML = "";

    if (imagem) {
        imagemHTML =
            '<img src="' +
            imagem +
            '" alt="' +
            titulo +
            '" loading="lazy">';
    } else {
        imagemHTML =
            '<div class="sem-poster">🎬</div>';
    }

    card.innerHTML =
        '<div class="imagem-card">' +
            imagemHTML +
        '</div>' +
        '<h3>' +
            titulo +
        '</h3>' +
        '<p class="card-nota">⭐ ' +
            nota +
        '</p>' +
        (
            data
                ? '<p class="card-data">' +
                    data +
                  '</p>'
                : ""
        );

    card.dataset.id =
        conteudo.id || "";

    card.dataset.tipo =
        tipo;

    card.dataset.titulo =
        obterTitulo(conteudo);

    card.setAttribute(
        "tabindex",
        "0"
    );

    card.setAttribute(
        "role",
        "button"
    );

    card.addEventListener(
        "click",
        function() {
            abrirDetalhes(
                conteudo,
                tipo
            );
        }
    );

    card.addEventListener(
        "keydown",
        function(event) {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();

                abrirDetalhes(
                    conteudo,
                    tipo
                );
            }
        }
    );

    return card;
}


/* =========================================================
   MOSTRAR CONTEÚDOS EM UMA SEÇÃO
   ========================================================= */

function mostrarNaSecao(
    secao,
    conteudos,
    limite
) {
    if (!secao) {
        return;
    }

    if (!Array.isArray(conteudos)) {
        conteudos = [];
    }

    if (
        typeof limite !== "number" ||
        limite <= 0
    ) {
        limite = MAX_ITENS_SECAO;
    }

    let cards =
        secao.querySelector(".cards");

    if (!cards) {
        cards =
            secao.querySelector(
                ".movie-grid, .series-grid, .grid"
            );
    }

    if (!cards) {
        cards = document.createElement("div");
        cards.className = "cards";
        secao.appendChild(cards);
    }

    cards.innerHTML = "";

    const permitidos =
        conteudos
            .filter(conteudoPermitido)
            .slice(0, limite);

    if (!permitidos.length) {
        cards.innerHTML =
            '<p class="mensagem-vazia">' +
                "Nenhum conteúdo encontrado." +
            "</p>";

        return;
    }

    permitidos.forEach(function(conteudo) {
        const card =
            criarCard(conteudo);

        if (card) {
            cards.appendChild(card);
        }
    });
}


/* =========================================================
   CARREGAR FILMES
   ========================================================= */

async function carregarFilmes() {
    try {
        const secaoFilmes =
            document.querySelector("#filmes");

        const dados =
            await buscarTMDB("/filmes");

        const filmes =
            extrairResultados(dados)
                .filter(conteudoPermitido);

        appState.filmes =
            filmes;

        mostrarNaSecao(
            secaoFilmes,
            filmes,
            MAX_ITENS_SECAO
        );

        const secaoAvaliados =
            document.querySelector("#avaliados");

        if (secaoAvaliados) {
            try {
                const dadosAvaliados =
                    await buscarTMDB(
                        "/filmes?sort_by=vote_average.desc"
                    );

                const avaliados =
                    extrairResultados(
                        dadosAvaliados
                    ).filter(
                        conteudoPermitido
                    );

                mostrarNaSecao(
                    secaoAvaliados,
                    avaliados,
                    MAX_ITENS_SECAO
                );
            } catch (erroAvaliados) {
                console.error(
                    "Erro ao carregar filmes avaliados:",
                    erroAvaliados
                );
            }
        }

        const secaoLancamentos =
            document.querySelector("#lancamentos");

        if (secaoLancamentos) {
            try {
                const dadosLancamentos =
                    await buscarTMDB(
                        "/filmes?sort_by=primary_release_date.desc"
                    );

                const lancamentos =
                    extrairResultados(
                        dadosLancamentos
                    ).filter(
                        conteudoPermitido
                    );

                mostrarNaSecao(
                    secaoLancamentos,
                    lancamentos,
                    MAX_ITENS_SECAO
                );
            } catch (erroLancamentos) {
                console.error(
                    "Erro ao carregar lançamentos:",
                    erroLancamentos
                );
            }
        }
    } catch (erro) {
        console.error(
            "❌ Erro ao carregar filmes:",
            erro
        );

        const secao =
            document.querySelector("#filmes");

        if (secao) {
            const cards =
                secao.querySelector(".cards");

            if (cards) {
                cards.innerHTML =
                    '<p class="mensagem-erro">' +
                        "Não foi possível carregar os filmes." +
                    "</p>";
            }
        }
    }
}


/* =========================================================
   CARREGAR SÉRIES
   ========================================================= */

async function carregarSeries() {
    try {
        const dados =
            await buscarTMDB("/series");

        const series =
            extrairResultados(dados)
                .filter(conteudoPermitido);

        appState.series =
            series;

        const secaoSeries =
            document.querySelector("#series");

        mostrarNaSecao(
            secaoSeries,
            series,
            MAX_ITENS_SECAO
        );

        const doramas =
            series.filter(function(item) {
                const paises =
                    Array.isArray(
                        item.origin_country
                    )
                        ? item.origin_country
                        : [];

                return paises.includes("KR");
            });

        const secaoDoramas =
            document.querySelector("#doramas");

        mostrarNaSecao(
            secaoDoramas,
            doramas,
            MAX_ITENS_SECAO
        );

        const gl =
            series.filter(function(item) {
                const texto = (
                    obterTitulo(item) +
                    " " +
                    (
                        item.overview || ""
                    )
                ).toLowerCase();

                return (
                    texto.includes("boys love") ||
                    texto.includes("boys-love") ||
                    texto.includes("bl") ||
                    texto.includes("gay")
                );
            });

        const secaoGL =
            document.querySelector("#gl");

        mostrarNaSecao(
            secaoGL,
            gl,
            MAX_ITENS_SECAO
        );

        const kids =
            series.filter(function(item) {
                const texto = (
                    obterTitulo(item) +
                    " " +
                    (
                        item.overview || ""
                    )
                ).toLowerCase();

                return (
                    texto.includes("kids") ||
                    texto.includes("children") ||
                    texto.includes("family") ||
                    texto.includes("infantil")
                );
            });

        const secaoKids =
            document.querySelector("#kids");

        mostrarNaSecao(
            secaoKids,
            kids,
            MAX_ITENS_SECAO
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao carregar séries:",
            erro
        );

        const secao =
            document.querySelector("#series");

        if (secao) {
            const cards =
                secao.querySelector(".cards");

            if (cards) {
                cards.innerHTML =
                    '<p class="mensagem-erro">' +
                        "Não foi possível carregar as séries." +
                    "</p>";
            }
        }
    }
}
/* =========================================================
   CINEFAMILY — SCRIPT.JS
   PARTE 2/4
   BUSCA + MODAL DE DETALHES
   ========================================================= */


/* =========================================================
   SISTEMA DE BUSCA
   ========================================================= */

async function executarBusca() {
    const campo =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search");

    const resultados =
        document.querySelector("#resultados-busca") ||
        document.querySelector("#resultados");

    if (!campo || !resultados) {
        return;
    }

    const termo =
        campo.value.trim();

    if (!termo) {
        resultados.innerHTML = "";
        appState.buscaAtiva = false;
        return;
    }

    appState.buscaAtiva = true;

    resultados.innerHTML =
        '<div class="mensagem-carregando">' +
            "🔎 Procurando filmes e séries..." +
        "</div>";

    try {
        const dados =
            await buscarTMDB(
                "/buscar?query=" +
                encodeURIComponent(termo)
            );

        let encontrados =
            extrairResultados(dados);

        encontrados =
            encontrados.filter(
                conteudoPermitido
            );

        encontrados =
            encontrados.filter(
                function(item) {
                    return (
                        item.media_type === "movie" ||
                        item.media_type === "tv" ||
                        item.title ||
                        item.name
                    );
                }
            );

        encontrados =
            encontrados.filter(
                function(item) {
                    return (
                        item.poster_path ||
                        item.backdrop_path
                    );
                }
            );

        resultados.innerHTML = "";

        if (!encontrados.length) {
            resultados.innerHTML =
                '<div class="mensagem-vazia">' +
                    "Nenhum resultado encontrado para \"" +
                    escaparHTML(termo) +
                    "\"." +
                "</div>";

            return;
        }

        let cards =
            resultados.querySelector(".cards");

        if (!cards) {
            cards =
                document.createElement("div");

            cards.className = "cards";

            resultados.appendChild(cards);
        }

        encontrados.forEach(
            function(item) {
                const card =
                    criarCard(item);

                if (card) {
                    cards.appendChild(card);
                }
            }
        );
    } catch (erro) {
        console.error(
            "❌ Erro na busca:",
            erro
        );

        resultados.innerHTML =
            '<div class="mensagem-erro">' +
                "Não foi possível realizar a busca." +
            "</div>";
    }
}


function abrirAreaBusca() {
    const area =
        document.querySelector("#area-busca") ||
        document.querySelector("#searchArea");

    const campo =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search");

    if (area) {
        area.classList.add("ativo");
        area.classList.add("aberta");
        area.classList.remove("hidden");
    }

    if (campo) {
        setTimeout(
            function() {
                campo.focus();
            },
            100
        );
    }
}


function fecharAreaBusca() {
    const area =
        document.querySelector("#area-busca") ||
        document.querySelector("#searchArea");

    const campo =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search");

    const resultados =
        document.querySelector("#resultados-busca") ||
        document.querySelector("#resultados");

    if (area) {
        area.classList.remove("ativo");
        area.classList.remove("aberta");
    }

    if (campo) {
        campo.value = "";
    }

    if (resultados) {
        resultados.innerHTML = "";
    }

    appState.buscaAtiva = false;
}


function configurarBusca() {
    const botaoBusca =
        document.querySelector("#botao-busca") ||
        document.querySelector("#searchBtn");

    const areaBusca =
        document.querySelector("#area-busca") ||
        document.querySelector("#searchArea");

    const campoBusca =
        document.querySelector("#campo-busca") ||
        document.querySelector("#search");

    const botaoFechar =
        document.querySelector("#fechar-busca") ||
        document.querySelector("#closeSearch");

    if (botaoBusca) {
        botaoBusca.addEventListener(
            "click",
            function(event) {
                event.preventDefault();
                abrirAreaBusca();
            }
        );
    }

    if (botaoFechar) {
        botaoFechar.addEventListener(
            "click",
            function(event) {
                event.preventDefault();
                fecharAreaBusca();
            }
        );
    }

    if (campoBusca) {
        campoBusca.addEventListener(
            "keydown",
            function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    executarBusca();
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    fecharAreaBusca();
                }
            }
        );
    }

    if (areaBusca) {
        areaBusca.addEventListener(
            "keydown",
            function(event) {
                if (event.key === "Escape") {
                    fecharAreaBusca();
                }
            }
        );
    }
}


/* =========================================================
   NORMALIZAÇÃO DOS DADOS
   ========================================================= */

function normalizarConteudo(conteudo, tipo) {
    if (!conteudo) {
        return null;
    }

    const copia =
        Object.assign({}, conteudo);

    if (!copia.media_type) {
        copia.media_type =
            tipo === "serie"
                ? "tv"
                : "movie";
    }

    if (!copia.title && copia.name) {
        copia.title =
            copia.name;
    }

    if (!copia.name && copia.title) {
        copia.name =
            copia.title;
    }

    return copia;
}


function obterIdSeguro(conteudo) {
    if (!conteudo) {
        return null;
    }

    const id =
        Number(conteudo.id);

    if (
        !Number.isFinite(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}


/* =========================================================
   MODAL DE DETALHES
   ========================================================= */

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

    fecharDetalhes();

    registrarHistorico(conteudo);

    const tipoNormalizado =
        tipo === "serie"
            ? "serie"
            : "filme";

    const modal =
        document.createElement("div");

    modal.id =
        "cinefamily-modal";

    modal.className =
        "cinefamily-modal";

    modal.innerHTML =
        '<div class="detalhes-filme">' +
            '<button ' +
                'class="fechar-detalhes" ' +
                'type="button" ' +
                'aria-label="Fechar detalhes">' +
                "✕" +
            "</button>" +

            '<div class="detalhes-conteudo">' +

                '<div class="detalhes-poster">' +
                    '<div class="detalhes-carregando">' +
                        "⏳" +
                    "</div>" +
                "</div>" +

                '<div class="detalhes-info">' +
                    '<p class="carregando-texto">' +
                        "Carregando detalhes..." +
                    "</p>" +
                "</div>" +

            "</div>" +
        "</div>";

    document.body.appendChild(modal);

    document.body.classList.add(
        "modal-aberto"
    );

    const botaoFechar =
        modal.querySelector(
            ".fechar-detalhes"
        );

    if (botaoFechar) {
        botaoFechar.addEventListener(
            "click",
            function(event) {
                event.preventDefault();
                event.stopPropagation();
                fecharDetalhes();
            }
        );
    }

    modal.addEventListener(
        "click",
        function(event) {
            if (event.target === modal) {
                fecharDetalhes();
            }
        }
    );

    try {
        let endpoint = "";

        if (
            tipoNormalizado === "serie"
        ) {
            endpoint =
                "/serie?id=" +
                encodeURIComponent(id);
        } else {
            endpoint =
                "/filme?id=" +
                encodeURIComponent(id);
        }

        const dados =
            await buscarTMDB(endpoint);

        let detalhes =
            dados;

        if (
            dados &&
            dados.data
        ) {
            detalhes =
                dados.data;
        }

        if (
            dados &&
            dados.result
        ) {
            detalhes =
                dados.result;
        }

        if (
            !detalhes ||
            typeof detalhes !== "object"
        ) {
            throw new Error(
                "Detalhes inválidos recebidos do Worker."
            );
        }

        detalhes =
            normalizarConteudo(
                Object.assign(
                    {},
                    conteudo,
                    detalhes
                ),
                tipoNormalizado
            );

        preencherDetalhes(
            modal,
            detalhes,
            tipoNormalizado
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao abrir detalhes:",
            erro
        );

        const info =
            modal.querySelector(
                ".detalhes-info"
            );

        if (info) {
            info.innerHTML =
                '<div class="mensagem-erro">' +
                    '<h2>Não foi possível carregar os detalhes.</h2>' +
                    '<p>Tente novamente em alguns instantes.</p>' +
                    '<button class="botao-recarregar-detalhes" type="button">' +
                        "Tentar novamente" +
                    "</button>" +
                "</div>";

            const botaoRecarregar =
                info.querySelector(
                    ".botao-recarregar-detalhes"
                );

            if (botaoRecarregar) {
                botaoRecarregar.addEventListener(
                    "click",
                    function() {
                        abrirDetalhes(
                            conteudo,
                            tipoNormalizado
                        );
                    }
                );
            }
        }
    }
}


/* =========================================================
   PREENCHIMENTO DO MODAL
   ========================================================= */

function preencherDetalhes(
    modal,
    conteudo,
    tipo
) {
    if (!modal || !conteudo) {
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

    if (!poster || !info) {
        return;
    }

    const titulo =
        textoOuPadrao(
            obterTitulo(conteudo),
            "Sem título"
        );

    const imagem =
        obterImagem(conteudo);

    const nota =
        obterNota(conteudo);

    const data =
        obterData(conteudo);

    const sinopse =
        textoOuPadrao(
            conteudo.overview,
            "Sinopse não disponível."
        );

    const genero =
        Array.isArray(
            conteudo.genres
        )
            ? conteudo.genres
                .map(
                    function(generoItem) {
                        return generoItem.name;
                    }
                )
                .join(", ")
            : "";

    const paises =
        Array.isArray(
            conteudo.origin_country
        )
            ? conteudo.origin_country.join(", ")
            : "";

    if (imagem) {
        poster.innerHTML =
            '<img src="' +
                imagem +
                '" alt="' +
                escaparHTML(titulo) +
                '">';
    } else {
        poster.innerHTML =
            '<div class="sem-poster-grande">' +
                "🎬" +
            "</div>";
    }

    let tipoTexto =
        tipo === "serie"
            ? "Série"
            : "Filme";

    let informacoes =
        '<div class="categoria">' +
            escaparHTML(tipoTexto) +
        "</div>" +

        "<h1>" +
            escaparHTML(titulo) +
        "</h1>" +

        '<div class="detalhes-meta">' +

            '<span class="nota">' +
                "⭐ " +
                escaparHTML(nota) +
            "</span>" +

            (
                data
                    ? '<span class="data">' +
                        escaparHTML(data) +
                      "</span>"
                    : ""
            ) +

            (
                conteudo.runtime
                    ? '<span>' +
                        escaparHTML(
                            String(
                                conteudo.runtime
                            )
                        ) +
                        " min" +
                      "</span>"
                    : ""
            ) +

        "</div>" +

        '<div class="sinopse">' +
            "<h3>Sinopse</h3>" +
            "<p>" +
                escaparHTML(sinopse) +
            "</p>" +
        "</div>";

    if (genero) {
        informacoes +=
            '<div class="detalhes-generos">' +
                "<strong>Gênero:</strong> " +
                escaparHTML(genero) +
            "</div>";
    }

    if (paises) {
        informacoes +=
            '<div class="detalhes-paises">' +
                "<strong>País:</strong> " +
                escaparHTML(paises) +
            "</div>";
    }

    informacoes +=
        '<div class="botoes-detalhes">' +

            '<button ' +
                'type="button" ' +
                'class="favorito" ' +
                'data-favorito-id="' +
                escaparHTML(
                    String(
                        obterIdSeguro(
                            conteudo
                        )
                    )
                ) +
            '">' +
                "♡ Favoritar" +
            "</button>" +

            '<button ' +
                'type="button" ' +
                'class="assistir" ' +
                'data-assistir-id="' +
                escaparHTML(
                    String(
                        obterIdSeguro(
                            conteudo
                        )
                    )
                ) +
            '">' +
                "▶ Assistir" +
            "</button>" +

        "</div>";

    if (tipo === "serie") {
        informacoes +=
            '<div class="informacoes-serie">' +
                '<div class="area-temporadas">' +
                    "<h3>Temporadas</h3>" +
                    '<div class="lista-temporadas"></div>' +
                "</div>" +
                '<div class="episodios"></div>' +
            "</div>";
    }

    info.innerHTML =
        informacoes;

    configurarBotaoFavorito(
        modal,
        conteudo
    );

    configurarBotaoAssistir(
        modal,
        conteudo
    );

    if (tipo === "serie") {
        carregarTemporadas(
            modal,
            conteudo
        );
    }

    carregarElenco(
        modal,
        conteudo,
        tipo
    );
}


/* =========================================================
   BOTÃO DE FAVORITO NO MODAL
   ========================================================= */

function configurarBotaoFavorito(
    modal,
    conteudo
) {
    const botao =
        modal.querySelector(
            ".favorito"
        );

    if (!botao) {
        return;
    }

    atualizarTextoFavorito(
        botao,
        conteudo
    );

    botao.addEventListener(
        "click",
        function(event) {
            event.preventDefault();
            event.stopPropagation();

            alternarFavorito(
                conteudo
            );

            atualizarTextoFavorito(
                botao,
                conteudo
            );

            carregarFavoritos();
        }
    );
}


function atualizarTextoFavorito(
    botao,
    conteudo
) {
    if (!botao) {
        return;
    }

    const favorito =
        estaNosFavoritos(
            conteudo
        );

    if (favorito) {
        botao.textContent =
            "♥ Remover dos favoritos";

        botao.classList.add(
            "ativo"
        );
    } else {
        botao.textContent =
            "♡ Favoritar";

        botao.classList.remove(
            "ativo"
        );
    }
}


/* =========================================================
   BOTÃO ASSISTIR
   ========================================================= */

function configurarBotaoAssistir(
    modal,
    conteudo
) {
    const botao =
        modal.querySelector(
            ".assistir"
        );

    if (!botao) {
        return;
    }

    botao.addEventListener(
        "click",
        function(event) {
            event.preventDefault();
            event.stopPropagation();

            registrarHistorico(
                conteudo
            );

            mostrarToast(
                "Conteúdo registrado no histórico."
            );
        }
    );
}


/* =========================================================
   FECHAR MODAL
   ========================================================= */

function fecharDetalhes() {
    const modal =
        document.querySelector(
            "#cinefamily-modal"
        );

    if (modal) {
        modal.remove();
    }

    document.body.classList.remove(
        "modal-aberto"
    );
}


/* =========================================================
   TOAST / AVISO
   ========================================================= */

function mostrarToast(mensagem) {
    let toast =
        document.querySelector(
            "#cinefamily-toast"
        );

    if (!toast) {
        toast =
            document.createElement("div");

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
        "ativo"
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(
            function() {
                toast.classList.remove(
                    "ativo"
                );
            },
            2500
        );
}
/* =========================================================
   CINEFAMILY — SCRIPT.JS
   PARTE 3/4
   FAVORITOS + HISTÓRICO + TEMPORADAS + ELENCO
   ========================================================= */


/* =========================================================
   FAVORITOS
   ========================================================= */

function obterFavoritos() {
    try {
        const salvo =
            localStorage.getItem(
                STORAGE_FAVORITOS
            );

        if (!salvo) {
            return [];
        }

        const dados =
            JSON.parse(salvo);

        if (!Array.isArray(dados)) {
            return [];
        }

        return dados.filter(
            conteudoPermitido
        );
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
                favoritos
            )
        );

        appState.favoritos =
            favoritos;
    } catch (erro) {
        console.error(
            "Erro ao salvar favoritos:",
            erro
        );
    }
}


function obterChaveConteudo(conteudo) {
    if (!conteudo) {
        return "";
    }

    const id =
        obterIdSeguro(conteudo);

    const tipo =
        descobrirTipo(conteudo);

    if (!id) {
        return "";
    }

    return (
        tipo +
        "-" +
        String(id)
    );
}


function estaNosFavoritos(conteudo) {
    const chave =
        obterChaveConteudo(
            conteudo
        );

    if (!chave) {
        return false;
    }

    const favoritos =
        obterFavoritos();

    return favoritos.some(
        function(item) {
            return (
                obterChaveConteudo(item) ===
                chave
            );
        }
    );
}


function adicionarFavorito(conteudo) {
    if (
        !conteudoPermitido(
            conteudo
        )
    ) {
        return;
    }

    const favoritos =
        obterFavoritos();

    const chave =
        obterChaveConteudo(
            conteudo
        );

    if (!chave) {
        return;
    }

    const jaExiste =
        favoritos.some(
            function(item) {
                return (
                    obterChaveConteudo(item) ===
                    chave
                );
            }
        );

    if (jaExiste) {
        return;
    }

    const copia =
        Object.assign(
            {},
            conteudo
        );

    copia._salvoEm =
        Date.now();

    favoritos.unshift(
        copia
    );

    salvarFavoritos(
        favoritos
    );

    mostrarToast(
        "Adicionado aos favoritos ❤️"
    );
}


function removerFavorito(conteudo) {
    const chave =
        obterChaveConteudo(
            conteudo
        );

    if (!chave) {
        return;
    }

    const favoritos =
        obterFavoritos();

    const filtrados =
        favoritos.filter(
            function(item) {
                return (
                    obterChaveConteudo(item) !==
                    chave
                );
            }
        );

    salvarFavoritos(
        filtrados
    );

    mostrarToast(
        "Removido dos favoritos."
    );
}


function alternarFavorito(conteudo) {
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
}


/* =========================================================
   CARREGAR FAVORITOS NA TELA
   ========================================================= */

function encontrarContainerLista(
    seletorPrincipal,
    seletoresAlternativos
) {
    const principal =
        document.querySelector(
            seletorPrincipal
        );

    if (principal) {
        const cards =
            principal.querySelector(
                ".cards"
            );

        if (cards) {
            return cards;
        }

        const lista =
            principal.querySelector(
                ".lista-favoritos, .lista-historico"
            );

        if (lista) {
            return lista;
        }
    }

    for (
        let i = 0;
        i < seletoresAlternativos.length;
        i++
    ) {
        const elemento =
            document.querySelector(
                seletoresAlternativos[i]
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
        encontrarContainerLista(
            "#favoritos",
            [
                "#lista-favoritos",
                ".lista-favoritos"
            ]
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!favoritos.length) {
        container.innerHTML =
            '<div class="mensagem-vazia">' +
                "<h3>Você ainda não tem favoritos.</h3>" +
                "<p>Abra um filme ou série e clique em Favoritar.</p>" +
            "</div>";

        return;
    }

    favoritos.forEach(
        function(conteudo) {
            const card =
                criarCard(
                    conteudo
                );

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}


/* =========================================================
   HISTÓRICO
   ========================================================= */

function obterHistorico() {
    try {
        const salvo =
            localStorage.getItem(
                STORAGE_HISTORICO
            );

        if (!salvo) {
            return [];
        }

        const dados =
            JSON.parse(salvo);

        if (!Array.isArray(dados)) {
            return [];
        }

        return dados.filter(
            conteudoPermitido
        );
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
                historico
            )
        );

        appState.historico =
            historico;
    } catch (erro) {
        console.error(
            "Erro ao salvar histórico:",
            erro
        );
    }
}


function registrarHistorico(conteudo) {
    if (
        !conteudoPermitido(
            conteudo
        )
    ) {
        return;
    }

    const id =
        obterIdSeguro(
            conteudo
        );

    if (!id) {
        return;
    }

    const chave =
        obterChaveConteudo(
            conteudo
        );

    let historico =
        obterHistorico();

    historico =
        historico.filter(
            function(item) {
                return (
                    obterChaveConteudo(item) !==
                    chave
                );
            }
        );

    const copia =
        Object.assign(
            {},
            conteudo
        );

    copia._vistoEm =
        Date.now();

    historico.unshift(
        copia
    );

    historico =
        historico.slice(
            0,
            50
        );

    salvarHistorico(
        historico
    );
}


function carregarHistorico() {
    const historico =
        obterHistorico();

    appState.historico =
        historico;

    const container =
        encontrarContainerLista(
            "#historico",
            [
                "#lista-historico",
                ".lista-historico"
            ]
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!historico.length) {
        container.innerHTML =
            '<div class="mensagem-vazia">' +
                "<h3>Seu histórico está vazio.</h3>" +
                "<p>Os filmes e séries que você abrir aparecerão aqui.</p>" +
            "</div>";

        return;
    }

    historico.forEach(
        function(conteudo) {
            const card =
                criarCard(
                    conteudo
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
    try {
        localStorage.removeItem(
            STORAGE_HISTORICO
        );
    } catch (erro) {
        console.error(
            "Erro ao limpar histórico:",
            erro
        );
    }

    appState.historico =
        [];

    carregarHistorico();

    mostrarToast(
        "Histórico apagado."
    );
}


/* =========================================================
   TEMPORADAS
   ========================================================= */

async function carregarTemporadas(
    modal,
    serie
) {
    if (!modal || !serie) {
        return;
    }

    const lista =
        modal.querySelector(
            ".lista-temporadas"
        );

    if (!lista) {
        return;
    }

    lista.innerHTML =
        '<p class="carregando-temporadas">' +
            "⏳ Carregando temporadas..." +
        "</p>";

    const id =
        obterIdSeguro(
            serie
        );

    if (!id) {
        lista.innerHTML =
            "<p>Temporadas indisponíveis.</p>";

        return;
    }

    try {
        const dados =
            await buscarTMDB(
                "/serie?id=" +
                encodeURIComponent(id)
            );

        let detalhes =
            dados;

        if (
            dados &&
            dados.data
        ) {
            detalhes =
                dados.data;
        }

        if (
            dados &&
            dados.result
        ) {
            detalhes =
                dados.result;
        }

        const temporadas =
            Array.isArray(
                detalhes.seasons
            )
                ? detalhes.seasons
                : [];

        lista.innerHTML = "";

        if (!temporadas.length) {
            lista.innerHTML =
                "<p>Temporadas não disponíveis.</p>";

            return;
        }

        temporadas.forEach(
            function(temporada) {
                const numero =
                    Number(
                        temporada.season_number
                    );

                if (
                    !Number.isFinite(
                        numero
                    )
                ) {
                    return;
                }

                const botao =
                    document.createElement(
                        "button"
                    );

                botao.type =
                    "button";

                botao.className =
                    "botao-temporada";

                botao.textContent =
                    temporada.name ||
                    (
                        "Temporada " +
                        numero
                    );

                botao.dataset.temporada =
                    String(numero);

                botao.addEventListener(
                    "click",
                    function() {
                        carregarEpisodios(
                            modal,
                            serie,
                            numero
                        );
                    }
                );

                lista.appendChild(
                    botao
                );
            }
        );

        const primeiraTemporada =
            temporadas.find(
                function(item) {
                    return (
                        Number(
                            item.season_number
                        ) === 1
                    );
                }
            ) ||
            temporadas.find(
                function(item) {
                    return (
                        Number(
                            item.season_number
                        ) > 0
                    );
                }
            );

        if (primeiraTemporada) {
            carregarEpisodios(
                modal,
                serie,
                Number(
                    primeiraTemporada.season_number
                )
            );
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar temporadas:",
            erro
        );

        lista.innerHTML =
            '<p class="mensagem-erro">' +
                "Não foi possível carregar as temporadas." +
            "</p>";
    }
}


/* =========================================================
   EPISÓDIOS
   ========================================================= */

async function carregarEpisodios(
    modal,
    serie,
    numeroTemporada
) {
    if (!modal || !serie) {
        return;
    }

    const area =
        modal.querySelector(
            ".episodios"
        );

    if (!area) {
        return;
    }

    area.innerHTML =
        '<p class="carregando-episodios">' +
            "⏳ Carregando episódios..." +
        "</p>";

    const id =
        obterIdSeguro(
            serie
        );

    if (!id) {
        area.innerHTML =
            "<p>Episódios indisponíveis.</p>";

        return;
    }

    try {
        const dados =
            await buscarTMDB(
                "/serie?id=" +
                encodeURIComponent(id) +
                "&season=" +
                encodeURIComponent(
                    numeroTemporada
                )
            );

        let detalhes =
            dados;

        if (
            dados &&
            dados.data
        ) {
            detalhes =
                dados.data;
        }

        if (
            dados &&
            dados.result
        ) {
            detalhes =
                dados.result;
        }

        let episodios =
            Array.isArray(
                detalhes.episodes
            )
                ? detalhes.episodes
                : [];

        if (
            !episodios.length &&
            detalhes.season &&
            Array.isArray(
                detalhes.season.episodes
            )
        ) {
            episodios =
                detalhes.season.episodes;
        }

        area.innerHTML = "";

        if (!episodios.length) {
            area.innerHTML =
                "<p>Nenhum episódio encontrado.</p>";

            return;
        }

        const tituloArea =
            document.createElement(
                "h3"
            );

        tituloArea.textContent =
            "Episódios";

        area.appendChild(
            tituloArea
        );

        episodios.forEach(
            function(episodio) {
                const bloco =
                    document.createElement(
                        "div"
                    );

                bloco.className =
                    "episodio";

                const numero =
                    episodio.episode_number ||
                    "";

                const nome =
                    episodio.name ||
                    (
                        "Episódio " +
                        numero
                    );

                const resumo =
                    episodio.overview ||
                    "Sinopse não disponível.";

                const nota =
                    episodio.vote_average
                        ? Number(
                            episodio.vote_average
                        ).toFixed(1)
                        : "0.0";

                bloco.innerHTML =
                    '<div class="episodio-info">' +

                        '<strong>' +
                            escaparHTML(
                                "E" +
                                numero +
                                " — " +
                                nome
                            ) +
                        "</strong>" +

                        '<p>' +
                            escaparHTML(
                                resumo
                            ) +
                        "</p>" +

                        '<span>' +
                            "⭐ " +
                            escaparHTML(
                                nota
                            ) +
                        "</span>" +

                    "</div>" +

                    '<button ' +
                        'type="button" ' +
                        'class="assistir-episodio">' +
                        "▶ Assistir" +
                    "</button>";

                const botaoAssistir =
                    bloco.querySelector(
                        ".assistir-episodio"
                    );

                if (botaoAssistir) {
                    botaoAssistir.addEventListener(
                        "click",
                        function() {
                            registrarHistorico(
                                serie
                            );

                            mostrarToast(
                                "Episódio selecionado."
                            );
                        }
                    );
                }

                area.appendChild(
                    bloco
                );
            }
        );
    } catch (erro) {
        console.error(
            "Erro ao carregar episódios:",
            erro
        );

        area.innerHTML =
            '<p class="mensagem-erro">' +
                "Não foi possível carregar os episódios." +
            "</p>";
    }
}


/* =========================================================
   ELENCO
   ========================================================= */

async function carregarElenco(
    modal,
    conteudo,
    tipo
) {
    if (!modal || !conteudo) {
        return;
    }

    const info =
        modal.querySelector(
            ".detalhes-info"
        );

    if (!info) {
        return;
    }

    let areaElenco =
        modal.querySelector(
            ".area-elenco"
        );

    if (!areaElenco) {
        areaElenco =
            document.createElement(
                "div"
            );

        areaElenco.className =
            "area-elenco";

        info.appendChild(
            areaElenco
        );
    }

    areaElenco.innerHTML =
        '<h3>Elenco</h3>' +
        '<div class="lista-elenco">' +
            '<p>⏳ Carregando elenco...</p>' +
        "</div>";

    const lista =
        areaElenco.querySelector(
            ".lista-elenco"
        );

    const id =
        obterIdSeguro(
            conteudo
        );

    if (!id) {
        lista.innerHTML =
            "<p>Elenco indisponível.</p>";

        return;
    }

    try {
        const endpoint =
            tipo === "serie"
                ? "/serie?id=" +
                    encodeURIComponent(id)
                : "/filme?id=" +
                    encodeURIComponent(id);

        const dados =
            await buscarTMDB(
                endpoint
            );

        let detalhes =
            dados;

        if (
            dados &&
            dados.data
        ) {
            detalhes =
                dados.data;
        }

        if (
            dados &&
            dados.result
        ) {
            detalhes =
                dados.result;
        }

        let elenco =
            Array.isArray(
                detalhes.cast
            )
                ? detalhes.cast
                : [];

        if (
            !elenco.length &&
            detalhes.credits &&
            Array.isArray(
                detalhes.credits.cast
            )
        ) {
            elenco =
                detalhes.credits.cast;
        }

        lista.innerHTML = "";

        if (!elenco.length) {
            lista.innerHTML =
                "<p>Elenco não disponível.</p>";

            return;
        }

        elenco =
            elenco.slice(
                0,
                12
            );

        elenco.forEach(
            function(pessoa) {
                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "card elenco-card";

                const foto =
                    pessoa.profile_path
                        ? IMG +
                            pessoa.profile_path
                        : "";

                const nome =
                    pessoa.name ||
                    "Nome não informado";

                const personagem =
                    pessoa.character ||
                    "";

                let imagemHTML =
                    '<div class="sem-poster">👤</div>';

                if (foto) {
                    imagemHTML =
                        '<img src="' +
                            foto +
                            '" alt="' +
                            escaparHTML(
                                nome
                            ) +
                            '" loading="lazy">';
                }

                card.innerHTML =
                    '<div class="imagem-card">' +
                        imagemHTML +
                    "</div>" +

                    "<h3>" +
                        escaparHTML(
                            nome
                        ) +
                    "</h3>" +

                    (
                        personagem
                            ? "<p>" +
                                escaparHTML(
                                    personagem
                                ) +
                              "</p>"
                            : ""
                    );

                lista.appendChild(
                    card
                );
            }
        );
    } catch (erro) {
        console.error(
            "Erro ao carregar elenco:",
            erro
        );

        lista.innerHTML =
            '<p class="mensagem-erro">' +
                "Não foi possível carregar o elenco." +
            "</p>";
    }
}


/* =========================================================
   NAVEGAÇÃO PARA FAVORITOS E HISTÓRICO
   ========================================================= */

function mostrarSecaoPorId(id) {
    if (!id) {
        return;
    }

    const alvo =
        document.querySelector(
            id
        );

    if (!alvo) {
        return;
    }

    alvo.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function configurarNavegacaoInterna() {
    const links =
        document.querySelectorAll(
            'a[href^="#"], [data-secao]'
        );

    links.forEach(
        function(link) {
            link.addEventListener(
                "click",
                function(event) {
                    const href =
                        link.getAttribute(
                            "href"
                        );

                    const secao =
                        link.dataset.secao ||
                        href;

                    if (
                        !secao ||
                        secao === "#"
                    ) {
                        return;
                    }

                    const alvo =
                        document.querySelector(
                            secao
                        );

                    if (!alvo) {
                        return;
                    }

                    event.preventDefault();

                    alvo.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    if (
                        secao === "#favoritos"
                    ) {
                        carregarFavoritos();
                    }

                    if (
                        secao === "#historico"
                    ) {
                        carregarHistorico();
                    }
                }
            );
        }
    );
}
/* =========================================================
   CINEFAMILY — SCRIPT.JS
   PARTE 4/4
   BOTÕES + EVENTOS + INICIALIZAÇÃO
   ========================================================= */


/* =========================================================
   BOTÕES GERAIS
   ========================================================= */

function configurarBotoesGerais() {

    /* -----------------------------------------------------
       BOTÃO DE FAVORITOS
       ----------------------------------------------------- */

    const botaoFavoritos =
        document.querySelector(
            "#favBtn"
        );

    if (botaoFavoritos) {
        botaoFavoritos.addEventListener(
            "click",
            function(event) {
                event.preventDefault();

                const favoritos =
                    document.querySelector(
                        "#favoritos"
                    );

                if (favoritos) {
                    favoritos.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    carregarFavoritos();
                } else {
                    mostrarToast(
                        "A seção de favoritos não está disponível."
                    );
                }
            }
        );
    }


    /* -----------------------------------------------------
       BOTÃO DE LIMPAR HISTÓRICO
       ----------------------------------------------------- */

    const botaoLimparHistorico =
        document.querySelector(
            "#limpar-historico"
        ) ||
        document.querySelector(
            "#limparHistorico"
        );

    if (botaoLimparHistorico) {
        botaoLimparHistorico.addEventListener(
            "click",
            function(event) {
                event.preventDefault();

                const confirmar =
                    window.confirm(
                        "Deseja realmente apagar todo o histórico?"
                    );

                if (!confirmar) {
                    return;
                }

                limparHistorico();
            }
        );
    }


    /* -----------------------------------------------------
       BOTÃO VOLTAR AO TOPO
       ----------------------------------------------------- */

    const botoesTopo =
        document.querySelectorAll(
            "#voltar-topo, .voltar-topo, .back-to-top"
        );

    botoesTopo.forEach(
        function(botao) {
            botao.addEventListener(
                "click",
                function(event) {
                    event.preventDefault();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });
                }
            );
        }
    );


    /* -----------------------------------------------------
       BOTÕES DE FECHAR
       ----------------------------------------------------- */

    const botoesFechar =
        document.querySelectorAll(
            ".fechar, .close, .modal-close"
        );

    botoesFechar.forEach(
        function(botao) {
            botao.addEventListener(
                "click",
                function(event) {
                    event.preventDefault();

                    const modal =
                        botao.closest(
                            "#cinefamily-modal, #modal, #details-modal, #movie-modal, #series-modal"
                        );

                    if (modal) {
                        modal.remove();

                        document.body.classList.remove(
                            "modal-aberto"
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   TECLA ESC
   ========================================================= */

function configurarTeclaEscape() {

    document.addEventListener(
        "keydown",
        function(event) {

            if (event.key !== "Escape") {
                return;
            }

            const modal =
                document.querySelector(
                    "#cinefamily-modal"
                );

            if (modal) {
                fecharDetalhes();

                return;
            }

            if (
                appState.buscaAtiva
            ) {
                fecharAreaBusca();
            }
        }
    );
}


/* =========================================================
   FECHAR MODAL AO CLICAR FORA
   ========================================================= */

function configurarFechamentoModal() {

    document.addEventListener(
        "click",
        function(event) {

            const modal =
                document.querySelector(
                    "#cinefamily-modal"
                );

            if (!modal) {
                return;
            }

            if (
                event.target === modal
            ) {
                fecharDetalhes();
            }
        }
    );
}


/* =========================================================
   PROTEÇÃO DE IMAGENS
   ========================================================= */

function configurarImagens() {

    document.addEventListener(
        "error",
        function(event) {

            const elemento =
                event.target;

            if (
                !elemento ||
                elemento.tagName !== "IMG"
            ) {
                return;
            }

            if (
                elemento.dataset.erroTratado ===
                "true"
            ) {
                return;
            }

            elemento.dataset.erroTratado =
                "true";

            const substituto =
                document.createElement(
                    "div"
                );

            substituto.className =
                "sem-poster";

            substituto.textContent =
                "🎬";

            elemento.replaceWith(
                substituto
            );
        },
        true
    );
}


/* =========================================================
   PROTEÇÃO CONTRA LINKS VAZIOS
   ========================================================= */

function configurarLinksVazios() {

    document.addEventListener(
        "click",
        function(event) {

            const link =
                event.target.closest(
                    "a"
                );

            if (!link) {
                return;
            }

            const href =
                link.getAttribute(
                    "href"
                );

            if (
                href === "#" ||
                href === ""
            ) {
                event.preventDefault();
            }
        }
    );
}


/* =========================================================
   BOTÕES DE MENU / NAVEGAÇÃO
   ========================================================= */

function configurarMenu() {

    const botoesMenu =
        document.querySelectorAll(
            "[data-menu], .menu-link, .nav-link"
        );

    botoesMenu.forEach(
        function(botao) {

            botao.addEventListener(
                "click",
                function(event) {

                    const destino =
                        botao.dataset.menu ||
                        botao.dataset.secao ||
                        botao.getAttribute(
                            "href"
                        );

                    if (!destino) {
                        return;
                    }

                    if (
                        destino.charAt(0) !==
                        "#"
                    ) {
                        return;
                    }

                    const alvo =
                        document.querySelector(
                            destino
                        );

                    if (!alvo) {
                        return;
                    }

                    event.preventDefault();

                    alvo.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    if (
                        destino ===
                        "#favoritos"
                    ) {
                        carregarFavoritos();
                    }

                    if (
                        destino ===
                        "#historico"
                    ) {
                        carregarHistorico();
                    }
                }
            );
        }
    );
}


/* =========================================================
   ATUALIZAÇÃO DAS LISTAS AO VOLTAR PARA A PÁGINA
   ========================================================= */

function atualizarListasLocais() {

    carregarFavoritos();

    carregarHistorico();
}


/* =========================================================
   EVENTO STORAGE
   ========================================================= */

function configurarEventoStorage() {

    window.addEventListener(
        "storage",
        function(event) {

            if (
                event.key ===
                STORAGE_FAVORITOS
            ) {
                carregarFavoritos();
            }

            if (
                event.key ===
                STORAGE_HISTORICO
            ) {
                carregarHistorico();
            }
        }
    );
}


/* =========================================================
   EVENTO VISIBILITY
   ========================================================= */

function configurarEventoVisibility() {

    document.addEventListener(
        "visibilitychange",
        function() {

            if (
                document.visibilityState ===
                "visible"
            ) {
                atualizarListasLocais();
            }
        }
    );
}


/* =========================================================
   LIMPEZA DE CARDS ANTIGOS
   ========================================================= */

function limparCardsInvalidos() {

    const cards =
        document.querySelectorAll(
            ".card"
        );

    cards.forEach(
        function(card) {

            const imagem =
                card.querySelector(
                    "img"
                );

            const titulo =
                card.querySelector(
                    "h3"
                );

            if (
                !imagem &&
                !titulo
            ) {
                return;
            }

            if (
                titulo &&
                titulo.textContent.trim() === ""
            ) {
                card.remove();
            }
        }
    );
}


/* =========================================================
   INICIALIZAÇÃO DOS COMPONENTES
   ========================================================= */

function inicializarComponentes() {

    configurarSlider();

    configurarBusca();

    configurarBotoesGerais();

    configurarTeclaEscape();

    configurarFechamentoModal();

    configurarImagens();

    configurarLinksVazios();

    configurarMenu();

    configurarNavegacaoInterna();

    configurarEventoStorage();

    configurarEventoVisibility();

    limparCardsInvalidos();
}


/* =========================================================
   CARREGAMENTO PRINCIPAL
   ========================================================= */

async function iniciarCineFamily() {

    console.log(
        "🎬 CineFamily iniciando..."
    );

    inicializarComponentes();

    mostrarSlide(0);

    try {

        await Promise.all([
            carregarFilmes(),
            carregarSeries()
        ]);

    } catch (erro) {

        console.error(
            "Erro durante o carregamento inicial:",
            erro
        );
    }

    carregarFavoritos();

    carregarHistorico();

    console.log(
        "✅ CineFamily carregado."
    );
}


/* =========================================================
   DOM READY
   ========================================================= */

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


/* =========================================================
   FUNÇÕES DISPONÍVEIS GLOBALMENTE
   ========================================================= */

window.CineFamily = {

    abrirDetalhes:
        abrirDetalhes,

    fecharDetalhes:
        fecharDetalhes,

    executarBusca:
        executarBusca,

    carregarFavoritos:
        carregarFavoritos,

    carregarHistorico:
        carregarHistorico,

    limparHistorico:
        limparHistorico,

    adicionarFavorito:
        adicionarFavorito,

    removerFavorito:
        removerFavorito,

    alternarFavorito:
        alternarFavorito,

    registrarHistorico:
        registrarHistorico,

    obterFavoritos:
        obterFavoritos,

    obterHistorico:
        obterHistorico

};


/* =========================================================
   FIM DO SCRIPT.JS
   ========================================================= */
