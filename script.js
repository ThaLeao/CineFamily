const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

let slideAtual = 0;


/* =====================================================
   CARROSSEL
===================================================== */

function mostrarSlide(numero) {

    const slides = document.querySelectorAll(".slide");
    const indicadores = document.querySelectorAll(".indicador");

    if (!slides.length) return;

    if (numero >= slides.length) {
        slideAtual = 0;
    }

    if (numero < 0) {
        slideAtual = slides.length - 1;
    }

    slides.forEach(function(slide, indice) {

        slide.classList.toggle(
            "ativo",
            indice === slideAtual
        );

    });

    indicadores.forEach(function(indicador, indice) {

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


/* =====================================================
   TMDB
===================================================== */

async function buscarTMDB(endpoint) {

    const resposta =
        await fetch(TMDB_WORKER + endpoint);

    console.log(
        "📡 Worker:",
        endpoint,
        resposta.status
    );

    if (!resposta.ok) {

        throw new Error(
            "Erro HTTP " + resposta.status
        );

    }

    return await resposta.json();
}


/* =====================================================
   CRIAR CARD
===================================================== */

function criarCard(filme) {

    const card =
        document.createElement("div");

    card.className = "card";


    const imagem =
        filme.poster_path
            ? IMG + filme.poster_path
            : "";


    const titulo =
        filme.title ||
        filme.name ||
        "Sem título";


    const nota =
        filme.vote_average
            ? Number(filme.vote_average).toFixed(1)
            : "N/A";


    card.innerHTML =

        '<div class="imagem-card">' +

            (
                imagem

                    ? '<img src="' +
                        imagem +
                        '" alt="' +
                        titulo +
                        '" loading="lazy">'

                    : "🎬"
            ) +

        '</div>' +

        '<h3>' +
            titulo +
        '</h3>' +

        '<p>⭐ ' +
            nota +
        '</p>';


    card.addEventListener(
        "click",
        function() {

            abrirDetalhes(filme);

        }
    );


    return card;
}


/* =====================================================
   MOSTRAR FILMES NA SEÇÃO
===================================================== */

function mostrarNaSecao(secao, filmes) {

    if (!secao) return;


    const cards =
        secao.querySelector(".cards");


    if (!cards) return;


    cards.innerHTML = "";


    filmes

        .filter(function(filme) {

            return filme.poster_path;

        })

        .slice(0, 10)

        .forEach(function(filme) {

            cards.appendChild(
                criarCard(filme)
            );

        });
}


/* =====================================================
   CARREGAR FILMES
===================================================== */

async function carregarFilmes() {

    const secoes =
        document.querySelectorAll(
            ".categoria-secao"
        );


    if (!secoes.length) return;


    console.log(
        "🎬 Carregando catálogo CineFamily..."
    );


    try {

        const destaque =
            await buscarTMDB("/filmes");


        mostrarNaSecao(

            secoes[0],

            Array.isArray(
                destaque.results
            )
                ? destaque.results
                : []

        );


        if (secoes[1]) {

            const avaliados =
                await buscarTMDB(
                    "/filmes?sort_by=vote_average.desc"
                );


            mostrarNaSecao(

                secoes[1],

                Array.isArray(
                    avaliados.results
                )
                    ? avaliados.results
                    : []

            );

        }


        if (secoes[2]) {

            const lancamentos =
                await buscarTMDB(
                    "/filmes?sort_by=primary_release_date.desc"
                );


            mostrarNaSecao(

                secoes[2],

                Array.isArray(
                    lancamentos.results
                )
                    ? lancamentos.results
                    : []

            );

        }


        console.log(
            "✅ Filmes carregados!"
        );


    } catch (erro) {

        console.error(
            "❌ Erro ao carregar filmes:",
            erro
        );

    }
}


/* =====================================================
   BUSCA
===================================================== */

async function realizarBusca() {

    const campo =
        document.getElementById(
            "campo-busca"
        );


    const resultados =
        document.getElementById(
            "resultados-busca"
        );


    const buscaCards =
        resultados
            ? resultados.querySelector(".cards")
            : null;


    if (
        !campo ||
        !resultados ||
        !buscaCards
    ) {

        return;

    }


    const texto =
        campo.value.trim();


    if (!texto) {

        resultados.style.display =
            "none";

        return;

    }


    console.log(
        "🔎 Buscando:",
        texto
    );


    resultados.style.display =
        "block";


    buscaCards.innerHTML =
        "<p>🔎 Buscando...</p>";


    try {

        const dados =
            await buscarTMDB(

                "/buscar?query=" +
                encodeURIComponent(texto)

            );


        const resultadosTMDB =
            Array.isArray(
                dados.results
            )
                ? dados.results
                : [];


        buscaCards.innerHTML =
            "";


        const comCapa =
            resultadosTMDB.filter(
                function(item) {

                    return item.poster_path;

                }
            );


        if (!comCapa.length) {

            buscaCards.innerHTML =
                '<p id="busca-vazia">' +
                'Nenhum resultado encontrado.' +
                '</p>';

            return;

        }


        comCapa
            .slice(0, 20)
            .forEach(function(item) {

                buscaCards.appendChild(
                    criarCard(item)
                );

            });


        resultados.scrollIntoView({

            behavior: "smooth",

            block: "start"

        });


    } catch (erro) {

        console.error(
            "❌ Erro na busca:",
            erro
        );


        buscaCards.innerHTML =
            '<p id="busca-vazia">' +
            'Não foi possível realizar a busca.' +
            '</p>';

    }
}


/* =====================================================
   CONFIGURAR BUSCA
===================================================== */

function configurarBusca() {

    const botaoBusca =
        document.getElementById(
            "botao-busca"
        );


    const areaBusca =
        document.getElementById(
            "area-busca"
        );


    const campoBusca =
        document.getElementById(
            "campo-busca"
        );


    const fecharBusca =
        document.getElementById(
            "fechar-busca"
        );


    if (
        !botaoBusca ||
        !areaBusca ||
        !campoBusca
    ) {

        return;

    }


    botaoBusca.addEventListener(
        "click",
        function() {

            areaBusca.style.display =
                "block";

            campoBusca.focus();

        }
    );


    if (fecharBusca) {

        fecharBusca.addEventListener(
            "click",
            function() {

                areaBusca.style.display =
                    "none";

                campoBusca.value =
                    "";


                const resultados =
                    document.getElementById(
                        "resultados-busca"
                    );


                if (resultados) {

                    resultados.style.display =
                        "none";

                }

            }
        );

    }


    campoBusca.addEventListener(
        "keydown",
        function(event) {

            if (event.key === "Enter") {

                realizarBusca();

            }

        }
    );
}


/* =====================================================
   DETALHES
===================================================== */

function abrirDetalhes(conteudo) {

    registrarHistorico(conteudo);

    fecharDetalhes();


    const imagem =
        conteudo.poster_path
            ? IMG + conteudo.poster_path
            : "";


    const titulo =
        conteudo.title ||
        conteudo.name ||
        "Sem título";


    const nota =
        conteudo.vote_average
            ? Number(
                conteudo.vote_average
              ).toFixed(1)
            : "N/A";


    /*
       IDENTIFICA FILME OU SÉRIE
    */

    const ehSerie =
        conteudo.media_type === "tv" ||
        !!conteudo.name ||
        !!conteudo.first_air_date;


    const tipo =
        ehSerie
            ? "📺 SÉRIE"
            : "🎬 FILME";


    /*
       DATA
    */

    const dataOriginal =
        ehSerie
            ? conteudo.first_air_date
            : conteudo.release_date;


    const data =
        dataOriginal
            ? dataOriginal
                .split("-")
                .reverse()
                .join("/")
            : "Não informada";


    /*
       SINOPSE
    */

    const sinopse =
        conteudo.overview ||
        "Sinopse não disponível.";


    /*
       CRIA MODAL
    */

    const modal =
        document.createElement("div");


    modal.id =
        "cinefamily-modal";


    modal.innerHTML =

        '<div class="detalhes-filme">' +

            '<button ' +
                'class="fechar-detalhes" ' +
                'type="button">' +
                '✕' +
            '</button>' +


            '<div class="detalhes-conteudo">' +


                '<div class="detalhes-poster">' +

                    (
                        imagem

                            ? '<img src="' +
                                imagem +
                                '" alt="' +
                                titulo +
                                '">'

                            : "🎬"
                    ) +

                '</div>' +


                '<div class="detalhes-info">' +


                    '<span class="categoria">' +
                        tipo +
                    '</span>' +


                    '<h1>' +
                        titulo +
                    '</h1>' +


                    '<p class="nota">' +
                        '⭐ ' +
                        nota +
                    '</p>' +


                    '<p class="data">' +
                        '📅 Estreia: ' +
                        data +
                    '</p>' +


                    '<p class="sinopse">' +
                        sinopse +
                    '</p>' +


                    '<div class="botoes-detalhes">' +


                        '<button ' +
                            'class="assistir" ' +
                            'type="button">' +

                            '▶ Assistir agora' +

                        '</button>' +


                        '<button ' +
                            'class="favorito" ' +
                            'type="button">' +

                            '⭐ Favoritar' +

                        '</button>' +


                    '</div>' +


                '</div>' +


            '</div>' +


        '</div>';


    document.body.appendChild(
        modal
    );


    /*
       BOTÃO FECHAR
    */

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


    /*
       FAVORITOS
    */

    const botaoFavorito =
        modal.querySelector(
            ".favorito"
        );


    const favoritos =
        obterFavoritos();


    const jaFavoritado =
        favoritos.some(
            function(item) {

                return Number(item.id) ===
                    Number(conteudo.id);

            }
        );


    if (jaFavoritado) {

        botaoFavorito.textContent =
            "⭐ Favoritado";

    }


    botaoFavorito.addEventListener(
        "click",
        function() {

            adicionarFavorito(
                conteudo
            );


            botaoFavorito.textContent =
                "⭐ Favoritado";

        }
    );


    /*
       BOTÃO ASSISTIR
    */

    const botaoAssistir =
        modal.querySelector(
            ".assistir"
        );


    botaoAssistir.addEventListener(
        "click",
        function() {

            registrarHistorico(
                conteudo
            );


            alert(
                "🎬 O vídeo deste conteúdo ainda não está disponível."
            );

        }
    );

}


/* =====================================================
   FECHAR DETALHES
===================================================== */

function fecharDetalhes() {

    const modal =
        document.getElementById(
            "cinefamily-modal"
        );


    if (modal) {

        modal.remove();

    }
}


/* =====================================================
   CLICAR FORA DO MODAL
===================================================== */

document.addEventListener(
    "click",
    function(event) {

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


/* =====================================================
   HISTÓRICO
===================================================== */

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
            "❌ Erro no histórico:",
            erro
        );


        return [];

    }
}


/* =====================================================
   REGISTRAR HISTÓRICO
===================================================== */

function registrarHistorico(conteudo) {

    let historico =
        obterHistorico();


    historico =
        historico.filter(
            function(item) {

                return Number(item.id) !==
                    Number(conteudo.id);

            }
        );


    historico.unshift({

        id: conteudo.id,

        title:
            conteudo.title ||
            conteudo.name,

        name:
            conteudo.name,

        poster_path:
            conteudo.poster_path,

        vote_average:
            conteudo.vote_average,

        release_date:
            conteudo.release_date,

        first_air_date:
            conteudo.first_air_date,

        overview:
            conteudo.overview,

        media_type:
            conteudo.media_type,

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
        "🕘 Histórico atualizado."
    );
}


/* =====================================================
   FAVORITOS
===================================================== */

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
            "❌ Erro nos favoritos:",
            erro
        );


        return [];

    }
}


/* =====================================================
   ADICIONAR FAVORITO
===================================================== */

function adicionarFavorito(conteudo) {

    let favoritos =
        obterFavoritos();


    const jaExiste =
        favoritos.some(
            function(item) {

                return Number(item.id) ===
                    Number(conteudo.id);

            }
        );


    if (jaExiste) {

        return;

    }


    favoritos.push({

        id:
            conteudo.id,

        title:
            conteudo.title ||
            conteudo.name,

        name:
            conteudo.name,

        poster_path:
            conteudo.poster_path,

        vote_average:
            conteudo.vote_average,

        release_date:
            conteudo.release_date,

        first_air_date:
            conteudo.first_air_date,

        overview:
            conteudo.overview,

        media_type:
            conteudo.media_type

    });


    localStorage.setItem(

        "cinefamilyFavoritos",

        JSON.stringify(favoritos)

    );


    alert(
        "⭐ Conteúdo adicionado aos favoritos!"
    );


    console.log(
        "⭐ Favorito salvo:",
        conteudo.title ||
        conteudo.name
    );
}


/* =====================================================
   INICIAR CINEFAMILY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "🚀 CineFamily iniciado."
        );


        mostrarSlide(0);


        configurarBusca();


        carregarFilmes();

    }
);
