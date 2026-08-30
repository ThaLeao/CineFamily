const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

/* =========================================================
CARROSSEL
========================================================= */

let slideAtual = 0;

function mostrarSlide(numero) {

```
const slides = document.querySelectorAll(".slide");
const indicadores = document.querySelectorAll(".indicador");

if (!slides.length) return;

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
```

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
BUSCAR DADOS DO WORKER
========================================================= */

async function buscarTMDB(endpoint) {

```
const resposta = await fetch(
    `${TMDB_WORKER}${endpoint}`
);

console.log(
    `📡 Worker ${endpoint}:`,
    resposta.status
);

if (!resposta.ok) {
    throw new Error(
        `Erro HTTP ${resposta.status}`
    );
}

return await resposta.json();
```

}

/* =========================================================
CRIAR CARD
========================================================= */

function criarCard(filme) {

```
const card = document.createElement("div");

card.className = "card";

const imagem = filme.poster_path
    ? `${IMG}${filme.poster_path}`
    : "";

const nota = filme.vote_average
    ? Number(filme.vote_average).toFixed(1)
    : "N/A";

card.innerHTML = `

    <div class="imagem-card">

        ${
            imagem
                ? `
                    <img
                        src="${imagem}"
                        alt="${filme.title || "Filme"}"
                        loading="lazy"
                    >
                  `
                : "🎬"
        }

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
    () => abrirDetalhes(filme)
);

return card;
```

}

/* =========================================================
MOSTRAR FILMES EM UMA SEÇÃO
========================================================= */

function mostrarNaSecao(secao, filmes) {

```
if (!secao) return;

const cards = secao.querySelector(".cards");

if (!cards) return;

cards.innerHTML = "";

filmes
    .filter(filme => filme.poster_path)
    .slice(0, 10)
    .forEach(filme => {

        cards.appendChild(
            criarCard(filme)
        );

    });
```

}

/* =========================================================
CARREGAR FILMES
========================================================= */

async function carregarFilmes() {

```
const secoes =
    document.querySelectorAll(
        ".categoria-secao"
    );

if (!secoes.length) return;

console.log(
    "🎬 CineFamily: carregando catálogo..."
);

try {

    /*
    PRIMEIRA SEÇÃO:
    FILMES EM DESTAQUE
    */

    const destaque =
        await buscarTMDB("/filmes");

    const filmesDestaque =
        Array.isArray(destaque.results)
            ? destaque.results
            : [];

    mostrarNaSecao(
        secoes[0],
        filmesDestaque
    );


    /*
    SEGUNDA SEÇÃO:
    MAIS BEM AVALIADOS
    */

    if (secoes[1]) {

        const avaliados =
            await buscarTMDB(
                "/filmes?sort_by=vote_average.desc"
            );

        const filmesAvaliados =
            Array.isArray(avaliados.results)
                ? avaliados.results
                : [];

        mostrarNaSecao(
            secoes[1],
            filmesAvaliados
        );
    }


    /*
    TERCEIRA SEÇÃO:
    LANÇAMENTOS
    */

    if (secoes[2]) {

        const lancamentos =
            await buscarTMDB(
                "/filmes?sort_by=primary_release_date.desc"
            );

        const filmesLancamentos =
            Array.isArray(lancamentos.results)
                ? lancamentos.results
                : [];

        mostrarNaSecao(
            secoes[2],
            filmesLancamentos
        );
    }


    console.log(
        "✅ Catálogo carregado!"
    );

} catch (erro) {

    console.error(
        "❌ Erro ao carregar catálogo:",
        erro
    );

}
```

}

/* =========================================================
DETALHES
========================================================= */

function abrirDetalhes(filme) {

```
registrarHistorico(filme);

fecharDetalhes();

const imagem = filme.poster_path
    ? `${IMG}${filme.poster_path}`
    : "";

const nota = filme.vote_average
    ? Number(filme.vote_average).toFixed(1)
    : "N/A";

const data = filme.release_date
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

modal
    .querySelector(".fechar-detalhes")
    .addEventListener(
        "click",
        fecharDetalhes
    );


/* FAVORITO */

const botaoFavorito =
    modal.querySelector(".favorito");

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

modal
    .querySelector(".assistir")
    .addEventListener(
        "click",
        () => {

            registrarHistorico(filme);

            alert(
                "🎬 O vídeo deste conteúdo ainda não está disponível."
            );

        }
    );
```

}

/* =========================================================
HISTÓRICO
========================================================= */

function obterHistorico() {

```
try {

    const dados =
        localStorage.getItem(
            "cinefamilyHistorico"
        );

    if (!dados) return [];

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
```

}

function registrarHistorico(filme) {

```
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
    "🕘 Histórico atualizado:",
    historico
);
```

}

/* =========================================================
FAVORITOS
========================================================= */

function obterFavoritos() {

```
try {

    const dados =
        localStorage.getItem(
            "cinefamilyFavoritos"
        );

    if (!dados) return [];

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
```

}

function adicionarFavorito(filme) {

```
let favoritos =
    obterFavoritos();

const jaExiste =
    favoritos.some(
        item =>
            Number(item.id) ===
            Number(filme.id)
    );

if (jaExiste) {

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
```

}

/* =========================================================
FECHAR MODAL
========================================================= */

function fecharDetalhes() {

```
const modal =
    document.getElementById(
        "cinefamily-modal"
    );

if (modal) {
    modal.remove();
}
```

}

/* =========================================================
CLICAR FORA DO MODAL
========================================================= */

document.addEventListener(
"click",
event => {

```
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
```

);

/* =========================================================
INICIAR
========================================================= */

document.addEventListener(
"DOMContentLoaded",
() => {

```
    console.log(
        "🚀 CineFamily iniciado."
    );

    mostrarSlide(0);

    carregarFilmes();

}
```

);
