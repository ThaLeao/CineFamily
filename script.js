const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

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

    slides.forEach(function(slide, indice) {
        slide.classList.toggle("ativo", indice === slideAtual);
    });

    indicadores.forEach(function(indicador, indice) {
        indicador.classList.toggle("ativo", indice === slideAtual);
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

async function buscarTMDB(endpoint) {
    const resposta = await fetch(TMDB_WORKER + endpoint);

    console.log("Worker " + endpoint + ":", resposta.status);

    if (!resposta.ok) {
        throw new Error("Erro HTTP " + resposta.status);
    }

    return await resposta.json();
}

function criarCard(filme) {
    const card = document.createElement("div");

    card.className = "card";

    const imagem = filme.poster_path
        ? IMG + filme.poster_path
        : "";

    const nota = filme.vote_average
        ? Number(filme.vote_average).toFixed(1)
        : "N/A";

    card.innerHTML =
        '<div class="imagem-card">' +
            (
                imagem
                    ? '<img src="' + imagem + '" alt="' + (filme.title || "Filme") + '" loading="lazy">'
                    : "🎬"
            ) +
        '</div>' +
        '<h3>' + (filme.title || "Sem título") + '</h3>' +
        '<p>⭐ ' + nota + '</p>';

    card.addEventListener("click", function() {
        abrirDetalhes(filme);
    });

    return card;
}

function mostrarNaSecao(secao, filmes) {
    if (!secao) {
        return;
    }

    const cards = secao.querySelector(".cards");

    if (!cards) {
        return;
    }

    cards.innerHTML = "";

    filmes
        .filter(function(filme) {
            return filme.poster_path;
        })
        .slice(0, 10)
        .forEach(function(filme) {
            cards.appendChild(criarCard(filme));
        });
}

async function carregarFilmes() {
    const secaoFilmes = document.getElementById("filmes");
    const secaoAvaliados = document.getElementById("avaliados");
    const secaoLancamentos = document.getElementById("lancamentos");

    console.log("CineFamily: carregando catálogo...");

    try {
        const destaque = await buscarTMDB("/filmes");

        const filmesDestaque = Array.isArray(destaque.results)
            ? destaque.results
            : [];

        mostrarNaSecao(secaoFilmes, filmesDestaque);

        const avaliados = await buscarTMDB(
            "/filmes?sort_by=vote_average.desc"
        );

        const filmesAvaliados = Array.isArray(avaliados.results)
            ? avaliados.results
            : [];

        mostrarNaSecao(secaoAvaliados, filmesAvaliados);

        const lancamentos = await buscarTMDB(
            "/filmes?sort_by=primary_release_date.desc"
        );

        const filmesLancamentos = Array.isArray(lancamentos.results)
            ? lancamentos.results
            : [];

        mostrarNaSecao(secaoLancamentos, filmesLancamentos);

        console.log("Catálogo carregado com sucesso.");

    } catch (erro) {
        console.error("Erro ao carregar catálogo:", erro);
    }
}

function abrirDetalhes(filme) {
    registrarHistorico(filme);

    fecharDetalhes();

    const imagem = filme.poster_path
        ? IMG + filme.poster_path
        : "";

    const nota = filme.vote_average
        ? Number(filme.vote_average).toFixed(1)
        : "N/A";

    const data = filme.release_date
        ? filme.release_date.split("-").reverse().join("/")
        : "Não informada";

    const modal = document.createElement("div");

    modal.id = "cinefamily-modal";

    modal.innerHTML =
        '<div class="detalhes-filme">' +

            '<button class="fechar-detalhes" type="button">✕</button>' +

            '<div class="detalhes-conteudo">' +

                '<div class="detalhes-poster">' +
                    (
                        imagem
                            ? '<img src="' + imagem + '" alt="' + (filme.title || "Filme") + '">'
                            : "🎬"
                    ) +
                '</div>' +

                '<div class="detalhes-info">' +

                    '<span class="categoria">🎬 FILME</span>' +

                    '<h1>' +
                        (filme.title || "Sem título") +
                    '</h1>' +

                    '<p class="nota">⭐ ' +
                        nota +
                    '</p>' +

                    '<p class="data">📅 ' +
                        data +
                    '</p>' +

                    '<p class="sinopse">' +
                        (filme.overview || "Sinopse não disponível.") +
                    '</p>' +

                    '<div class="botoes-detalhes">' +

                        '<button class="assistir" type="button">' +
                            '▶ Assistir agora' +
                        '</button>' +

                        '<button class="favorito" type="button">' +
                            '⭐ Favoritar' +
                        '</button>' +

                    '</div>' +

                '</div>' +

            '</div>' +

        '</div>';

    document.body.appendChild(modal);

    const botaoFechar = modal.querySelector(".fechar-detalhes");

    botaoFechar.addEventListener("click", fecharDetalhes);

    const botaoFavorito = modal.querySelector(".favorito");

    const favoritos = obterFavoritos();

    const jaFavoritado = favoritos.some(function(item) {
        return Number(item.id) === Number(filme.id);
    });

    if (jaFavoritado) {
        botaoFavorito.textContent = "⭐ Favoritado";
    }

    botaoFavorito.addEventListener("click", function() {
        adicionarFavorito(filme);
        botaoFavorito.textContent = "⭐ Favoritado";
    });

    const botaoAssistir = modal.querySelector(".assistir");

    botaoAssistir.addEventListener("click", function() {
        registrarHistorico(filme);

        alert(
            "🎬 O vídeo deste conteúdo ainda não está disponível."
        );
    });
}

function obterHistorico() {
    try {
        const dados = localStorage.getItem("cinefamilyHistorico");

        if (!dados) {
            return [];
        }

        const historico = JSON.parse(dados);

        return Array.isArray(historico)
            ? historico
            : [];

    } catch (erro) {
        console.error("Erro ao ler histórico:", erro);
        return [];
    }
}

function registrarHistorico(filme) {
    let historico = obterHistorico();

    historico = historico.filter(function(item) {
        return Number(item.id) !== Number(filme.id);
    });

    historico.unshift({
        id: filme.id,
        title: filme.title,
        poster_path: filme.poster_path,
        vote_average: filme.vote_average,
        release_date: filme.release_date,
        overview: filme.overview,
        dataVisualizacao: new Date().toISOString()
    });

    historico = historico.slice(0, 20);

    localStorage.setItem(
        "cinefamilyHistorico",
        JSON.stringify(historico)
    );

    console.log("Histórico atualizado:", historico);
}

function obterFavoritos() {
    try {
        const dados = localStorage.getItem("cinefamilyFavoritos");

        if (!dados) {
            return [];
        }

        const favoritos = JSON.parse(dados);

        return Array.isArray(favoritos)
            ? favoritos
            : [];

    } catch (erro) {
        console.error("Erro ao ler favoritos:", erro);
        return [];
    }
}

function adicionarFavorito(filme) {
    let favoritos = obterFavoritos();

    const jaExiste = favoritos.some(function(item) {
        return Number(item.id) === Number(filme.id);
    });

    if (jaExiste) {
        return;
    }

    favoritos.push({
        id: filme.id,
        title: filme.title,
        poster_path: filme.poster_path,
        vote_average: filme.vote_average,
        release_date: filme.release_date,
        overview: filme.overview
    });

    localStorage.setItem(
        "cinefamilyFavoritos",
        JSON.stringify(favoritos)
    );

    console.log("Favorito salvo:", filme.title);

    alert("⭐ Filme adicionado aos favoritos!");
}

function fecharDetalhes() {
    const modal = document.getElementById("cinefamily-modal");

    if (modal) {
        modal.remove();
    }
}

document.addEventListener("click", function(event) {
    const modal = document.getElementById("cinefamily-modal");

    if (modal && event.target === modal) {
        fecharDetalhes();
    }
});

async function pesquisarFilmes() {
    const campo = document.getElementById("campo-busca");
    const resultados = document.getElementById("resultados-busca");
    const cards = resultados
        ? resultados.querySelector(".cards")
        : null;

    const mensagem = document.getElementById("busca-vazia");

    if (!campo || !resultados || !cards) {
        return;
    }

    const termo = campo.value.trim();

    if (!termo) {
        resultados.style.display = "none";
        cards.innerHTML = "";

        if (mensagem) {
            mensagem.style.display = "block";
        }

        return;
    }

    resultados.style.display = "block";
    cards.innerHTML = "";

    if (mensagem) {
        mensagem.style.display = "none";
    }

    try {
        const dados = await buscarTMDB(
            "/buscar?query=" + encodeURIComponent(termo)
        );

        const filmes = Array.isArray(dados.results)
            ? dados.results
            : [];

        const filmesComCapa = filmes.filter(function(filme) {
            return filme.poster_path;
        });

        if (!filmesComCapa.length) {
            if (mensagem) {
                mensagem.textContent = "Nenhum filme encontrado.";
                mensagem.style.display = "block";
            }

            return;
        }

        filmesComCapa.slice(0, 20).forEach(function(filme) {
            cards.appendChild(criarCard(filme));
        });

        resultados.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (erro) {
        console.error("Erro na busca:", erro);

        if (mensagem) {
            mensagem.textContent =
                "Não foi possível realizar a busca.";
            mensagem.style.display = "block";
        }
    }
}

function configurarBusca() {
    const botaoBusca = document.getElementById("botao-busca");
    const areaBusca = document.getElementById("area-busca");
    const campoBusca = document.getElementById("campo-busca");
    const fecharBusca = document.getElementById("fechar-busca");

    if (!botaoBusca || !areaBusca || !campoBusca) {
        return;
    }

    botaoBusca.addEventListener("click", function() {
        areaBusca.classList.add("aberta");

        campoBusca.focus();
    });

    if (fecharBusca) {
        fecharBusca.addEventListener("click", function() {
            areaBusca.classList.remove("aberta");
            campoBusca.value = "";

            const resultados =
                document.getElementById("resultados-busca");

            if (resultados) {
                resultados.style.display = "none";
            }
        });
    }

    campoBusca.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            pesquisarFilmes();
        }

        if (event.key === "Escape") {
            areaBusca.classList.remove("aberta");
            campoBusca.value = "";
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    console.log("CineFamily iniciado.");

    mostrarSlide(0);

    carregarFilmes();

    configurarBusca();
});
