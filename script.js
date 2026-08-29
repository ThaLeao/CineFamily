const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

// ======================================================
// CARREGAR FILMES DO TMDB
// ======================================================

async function carregarFilmes() {

    try {

        console.log("CineFamily TMDB Worker online!");

        const resposta = await fetch(`${TMDB_WORKER}/filmes`);

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o TMDB");
        }

        const dados = await resposta.json();

        const filmes = dados.results || [];

        console.log("Filmes recebidos:", filmes);

        mostrarFilmes(filmes);

    } catch (erro) {

        console.error("Erro CineFamily:", erro);

    }

}


// ======================================================
// MOSTRAR FILMES
// ======================================================

function mostrarFilmes(filmes) {

    const secoes = document.querySelectorAll(".categoria-secao");

    if (!secoes.length) {
        console.warn("Nenhuma seção encontrada.");
        return;
    }

    const secaoFilmes = secoes[0];

    const cards = secaoFilmes.querySelector(".cards");

    if (!cards) {
        console.warn("Área de cards não encontrada.");
        return;
    }

    cards.innerHTML = "";

    filmes.slice(0, 10).forEach(filme => {

        const card = document.createElement("div");

        card.className = "card";

        const imagem = filme.poster_path
            ? `${IMG}${filme.poster_path}`
            : "";

        card.innerHTML = `

            <div class="imagem-card">

                ${
                    imagem
                        ? `<img
                            src="${imagem}"
                            alt="${filme.title || "Filme"}">`
                        : "🎬"
                }

            </div>

            <h3>
                ${filme.title || "Sem título"}
            </h3>

            <p>
                ⭐ ${
                    filme.vote_average
                        ? Number(filme.vote_average).toFixed(1)
                        : "N/A"
                }
            </p>

        `;

        // Ao clicar no filme
        card.addEventListener("click", () => {

            abrirDetalhes(filme);

        });

        cards.appendChild(card);

    });

}


// ======================================================
// TELA DE DETALHES
// ======================================================

function abrirDetalhes(filme) {

    // PRIMEIRO: registrar no histórico
    registrarHistorico(filme);

    // Depois abrir os detalhes
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

    const modal = document.createElement("div");

    modal.id = "cinefamily-modal";

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
                            ? `<img
                                src="${imagem}"
                                alt="${filme.title || "Filme"}">`
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


    // ==================================================
    // BOTÃO FECHAR
    // ==================================================

    const botaoFechar =
        modal.querySelector(".fechar-detalhes");

    botaoFechar.addEventListener(
        "click",
        fecharDetalhes
    );


    // ==================================================
    // BOTÃO FAVORITO
    // ==================================================

    const botaoFavorito =
        modal.querySelector(".favorito");

    const favoritosSalvos =
        obterFavoritos();

    const jaFavoritado =
        favoritosSalvos.some(
            item => item.id === filme.id
        );

    if (jaFavoritado) {

        botaoFavorito.textContent =
            "⭐ Favoritado";

    }


    botaoFavorito.addEventListener(
        "click",
        () => {

            const adicionou =
                adicionarFavorito(filme);

            if (adicionou) {

                botaoFavorito.textContent =
                    "⭐ Favoritado";

            } else {

                botaoFavorito.textContent =
                    "⭐ Favoritado";

            }

        }
    );


    // ==================================================
    // BOTÃO ASSISTIR
    // ==================================================

    const botaoAssistir =
        modal.querySelector(".assistir");

    botaoAssistir.addEventListener(
        "click",
        () => {

            alert(
                "O CineFamily ainda não possui o vídeo deste filme. Nesta etapa estamos preparando o catálogo."
            );

        }
    );

}


// ======================================================
// HISTÓRICO
// ======================================================

function registrarHistorico(filme) {

    let historico = [];

    try {

        historico =
            JSON.parse(
                localStorage.getItem(
                    "cinefamilyHistorico"
                )
            ) || [];

    } catch (erro) {

        console.error(
            "Erro ao ler histórico:",
            erro
        );

        historico = [];

    }


    // Remove o filme caso já exista
    historico =
        historico.filter(
            item => item.id !== filme.id
        );


    // Coloca o filme no começo
    historico.unshift({

        id: filme.id,

        title: filme.title,

        poster_path: filme.poster_path,

        vote_average: filme.vote_average,

        release_date: filme.release_date,

        overview: filme.overview,

        dataVisualizacao:
            new Date().toISOString()

    });


    // Guarda somente os 20 últimos
    historico =
        historico.slice(0, 20);


    try {

        localStorage.setItem(
            "cinefamilyHistorico",
            JSON.stringify(historico)
        );

        console.log(
            "Histórico salvo:",
            historico
        );

    } catch (erro) {

        console.error(
            "Erro ao salvar histórico:",
            erro
        );

    }

}


// ======================================================
// OBTER HISTÓRICO
// ======================================================

function obterHistorico() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "cinefamilyHistorico"
            )
        ) || [];

    } catch (erro) {

        console.error(
            "Erro ao carregar histórico:",
            erro
        );

        return [];

    }

}


// ======================================================
// FECHAR DETALHES
// ======================================================

function fecharDetalhes() {

    const modal =
        document.getElementById(
            "cinefamily-modal"
        );

    if (modal) {

        modal.remove();

    }

}


// ======================================================
// FAVORITOS
// ======================================================

function obterFavoritos() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "cinefamilyFavoritos"
            )
        ) || [];

    } catch (erro) {

        console.error(
            "Erro ao carregar favoritos:",
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
            item => item.id === filme.id
        );


    if (jaExiste) {

        return false;

    }


    favoritos.push({

        id: filme.id,

        title: filme.title,

        poster_path: filme.poster_path,

        vote_average: filme.vote_average,

        release_date: filme.release_date,

        overview: filme.overview

    });


    try {

        localStorage.setItem(
            "cinefamilyFavoritos",
            JSON.stringify(favoritos)
        );

        console.log(
            "Favorito salvo:",
            filme.title
        );

        return true;

    } catch (erro) {

        console.error(
            "Erro ao salvar favorito:",
            erro
        );

        return false;

    }

}


// ======================================================
// FECHAR CLICANDO FORA
// ======================================================

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


// ======================================================
// INICIAR CINEFAMILY
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        carregarFilmes();

    }
);
