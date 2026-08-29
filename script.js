const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

/* =========================================================
CARROSSEL
========================================================= */

let slideAtual = 0;

function mostrarSlide(numero) {

const slides = document.querySelectorAll(".slide");
const indicadores = document.querySelectorAll(".indicador");

if (!slides.length) {
    return;
}

if (numero >= slides.length) {
    slideAtual = 0;
}

if (numero < 0) {
    slideAtual = slides.length - 1;
}

slides.forEach((slide, indice) => {
    slide.classList.toggle(
        "ativo",
        indice === slideAtual
    );
});

indicadores.forEach((indicador, indice) => {
    indicador.classList.toggle(
        "ativo",
        indice === slideAtual
    );
});

}

function proximoSlide() {

slideAtual++;

mostrarSlide(slideAtual);

}

function slideAnterior() {

slideAtual--;

mostrarSlide(slideAtual);

}

function irParaSlide(numero) {

slideAtual = numero;

mostrarSlide(slideAtual);

}

/* =========================================================
CARREGAR FILMES DO TMDB
========================================================= */

async function carregarFilmes() {

const secoes =
    document.querySelectorAll(".categoria-secao");

if (!secoes.length) {
    console.warn(
        "CineFamily: nenhuma seção de filmes encontrada."
    );
    return;
}

const secaoFilmes = secoes[0];

const cards =
    secaoFilmes.querySelector(".cards");

if (!cards) {
    console.warn(
        "CineFamily: área de cards não encontrada."
    );
    return;
}

try {

    console.log(
        "🎬 CineFamily: conectando ao TMDB..."
    );

    const resposta =
        await fetch(
            `${TMDB_WORKER}/filmes`
        );

    console.log(
        "📡 Resposta do Worker:",
        resposta.status
    );

    if (!resposta.ok) {

        throw new Error(
            `Worker respondeu HTTP ${resposta.status}`
        );

    }

    const dados =
        await resposta.json();

    console.log(
        "📦 Dados recebidos do TMDB:",
        dados
    );

    const filmes =
        Array.isArray(dados.results)
            ? dados.results
            : [];

    console.log(
        `🎬 ${filmes.length} filmes recebidos.`
    );

    if (!filmes.length) {

        console.warn(
            "O TMDB não retornou filmes."
        );

        return;
    }

    mostrarFilmes(filmes);

} catch (erro) {

    console.error(
        "❌ ERRO AO CARREGAR FILMES:",
        erro
    );

    /*
       IMPORTANTE:
       Não apagamos os filmes originais
       da página caso o Worker esteja
       indisponível.
    */

}

}

/* =========================================================
MOSTRAR FILMES
========================================================= */

function mostrarFilmes(filmes) {

const secoes =
    document.querySelectorAll(
        ".categoria-secao"
    );

if (!secoes.length) {
    return;
}

const secaoFilmes = secoes[0];

const cards =
    secaoFilmes.querySelector(".cards");

if (!cards) {
    return;
}

cards.innerHTML = "";

filmes
    .filter(filme => filme.poster_path)
    .slice(0, 10)
    .forEach(filme => {

        const card =
            document.createElement("div");

        card.className = "card";

        const imagem =
            `${IMG}${filme.poster_path}`;

        const nota =
            filme.vote_average
                ? Number(
                    filme.vote_average
                ).toFixed(1)
                : "N/A";

        card.innerHTML = `

            <div class="imagem-card">

                <img
                    src="${imagem}"
                    alt="${filme.title || "Filme"}"
                    loading="lazy"
                >

            </div>

            <h3>
                ${filme.title || "Sem título"}
            </h3>

            <p>
                ⭐ ${nota}
            </p>

        `;

        card.addEventListener(
            "click",
            () => {

                abrirDetalhes(filme);

            }
        );

        cards.appendChild(card);

    });

}

/* =========================================================
DETALHES DO FILME
========================================================= */

function abrirDetalhes(filme) {

registrarHistorico(filme);

fecharDetalhes();

const imagem =
    filme.poster_path
        ? `${IMG}${filme.poster_path}`
        : "";

const nota =
    filme.vote_average
        ? Number(
            filme.vote_average
        ).toFixed(1)
        : "N/A";

const data =
    filme.release_date
        ? filme.release_date
            .split("-")
            .reverse()
            .join("/")
        : "Não informada";

const modal =
    document.createElement("div");

modal.id =
    "cinefamily-modal";

modal.innerHTML = `

    <div class="detalhes-filme">

        <button
            class="fechar-detalhes"
            type="button">

            ✕

        </button>

        <div class="detalhes-conteudo">

            <div class="detalhes-poster">

                ${
                    imagem
                        ? `
                            <img
                                src="${imagem}"
                                alt="${filme.title || "Filme"}"
                            >
                          `
                        : "🎬"
                }

            </div>

            <div class="detalhes-info">

                <span class="categoria">
                    FILME
                </span>

                <h1>
                    ${filme.title || "Sem título"}
                </h1>

                <p class="nota">
                    ⭐ ${nota}
                </p>

                <p class="data">
                    📅 ${data}
                </p>

                <p class="sinopse">

                    ${
                        filme.overview ||
                        "Sinopse não disponível."
                    }

                </p>

                <div class="botoes-detalhes">

                    <button
                        class="assistir"
                        type="button">

                        ▶ Assistir agora

                    </button>

                    <button
                        class="favorito"
                        type="button">

                        ⭐ Favoritar

                    </button>

                </div>

            </div>

        </div>

    </div>

`;

document.body.appendChild(modal);


/* FECHAR */

const botaoFechar =
    modal.querySelector(
        ".fechar-detalhes"
    );

botaoFechar.addEventListener(
    "click",
    fecharDetalhes
);


/* FAVORITO */

const botaoFavorito =
    modal.querySelector(
        ".favorito"
    );

const favoritos =
    obterFavoritos();

const jaFavoritado =
    favoritos.some(
        item =>
            Number(item.id) ===
            Number(filme.id)
    );

if (jaFavoritado) {

    botaoFavorito.textContent =
        "⭐ Favoritado";

}


botaoFavorito.addEventListener(
    "click",
    () => {

        adicionarFavorito(filme);

        botaoFavorito.textContent =
            "⭐ Favoritado";

    }
);


/* ASSISTIR */

const botaoAssistir =
    modal.querySelector(
        ".assistir"
    );

botaoAssistir.addEventListener(
    "click",
    () => {

        registrarHistorico(filme);

        alert(
            "🎬 O CineFamily ainda não possui o vídeo deste filme. O catálogo está sendo preparado."
        );

    }
);

}

/* =========================================================
HISTÓRICO
========================================================= */

function obterHistorico() {

try {

    const dados =
        localStorage.getItem(
            "cinefamilyHistorico"
        );

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
        "❌ Erro ao ler histórico:",
        erro
    );

    return [];

}

}

function registrarHistorico(filme) {

let historico =
    obterHistorico();

historico =
    historico.filter(
        item =>
            Number(item.id) !==
            Number(filme.id)
    );

historico.unshift({

    id: filme.id,

    title: filme.title,

    poster_path:
        filme.poster_path,

    vote_average:
        filme.vote_average,

    release_date:
        filme.release_date,

    overview:
        filme.overview,

    dataVisualizacao:
        new Date().toISOString()

});

historico =
    historico.slice(0, 20);

localStorage.setItem(
    "cinefamilyHistorico",
    JSON.stringify(historico)
);

console.log(
    "🕘 Filme salvo no histórico:",
    filme.title
);

console.log(
    "📚 Histórico atual:",
    historico
);

}

/* =========================================================
FAVORITOS
========================================================= */

function obterFavoritos() {

try {

    const dados =
        localStorage.getItem(
            "cinefamilyFavoritos"
        );

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
        "❌ Erro ao ler favoritos:",
        erro
    );

    return [];

}

}

function adicionarFavorito(filme) {

let favoritos =
    obterFavoritos();

const jaExiste =
    favoritos.some(
        item =>
            Number(item.id) ===
            Number(filme.id)
    );

if (jaExiste) {

    console.log(
        "⭐ Filme já está nos favoritos."
    );

    return;

}

favoritos.push({

    id: filme.id,

    title: filme.title,

    poster_path:
        filme.poster_path,

    vote_average:
        filme.vote_average,

    release_date:
        filme.release_date,

    overview:
        filme.overview

});

localStorage.setItem(
    "cinefamilyFavoritos",
    JSON.stringify(favoritos)
);

console.log(
    "⭐ Favorito salvo:",
    filme.title
);

alert(
    "⭐ Filme adicionado aos favoritos!"
);

}

/* =========================================================
FECHAR DETALHES
========================================================= */

function fecharDetalhes() {

const modal =
    document.getElementById(
        "cinefamily-modal"
    );

if (modal) {

    modal.remove();

}

}

/* =========================================================
CLICAR FORA DO MODAL
========================================================= */

document.addEventListener(
"click",
event => {

    const modal =
        document.getElementById(
            "cinefamily-modal"
        );

    if (
        modal &&
        event.target === modal
    ) {

        fecharDetalhes();

    }

}

);

/* =========================================================
INICIAR CINEFAMILY
========================================================= */

document.addEventListener(
"DOMContentLoaded",
() => {

    console.log(
        "🚀 CineFamily iniciado."
    );

    mostrarSlide(0);

    carregarFilmes();

}

);
