const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";

const IMG = "https://image.tmdb.org/t/p/w500";

// ===============================
// CARREGAR FILMES DO TMDB
// ===============================

async function carregarFilmes() {
    try {
        console.log("CineFamily TMDB Worker online!");

        const resposta = await fetch(`${TMDB_WORKER}/filmes`);

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o TMDB");
        }

        const dados = await resposta.json();

        console.log("Filmes recebidos do TMDB:", dados);

        const filmes = dados.results || [];

        mostrarFilmes(filmes);

    } catch (erro) {
        console.error("Erro CineFamily:", erro);
    }
}


// ===============================
// MOSTRAR FILMES NA TELA
// ===============================

function mostrarFilmes(filmes) {

    const secoes = document.querySelectorAll(".categoria-secao");

    if (!secoes.length) {
        console.warn("Nenhuma seção encontrada.");
        return;
    }

    // A primeira seção de categoria é FILMES
    const secaoFilmes = secoes[0];

    const cards = secaoFilmes.querySelector(".cards");

    if (!cards) {
        console.warn("Área de cards não encontrada.");
        return;
    }

    // Limpa os filmes antigos
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
                        ? `<img src="${imagem}" alt="${filme.title || "Filme"}">`
                        : "🎬"
                }
            </div>

            <h3>${filme.title || "Sem título"}</h3>

            <p>
                ⭐ ${
                    filme.vote_average
                        ? filme.vote_average.toFixed(1)
                        : "N/A"
                }
            </p>
        `;

        cards.appendChild(card);
    });
}


// ===============================
// INICIAR CINEFAMILY
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    carregarFilmes();

});
