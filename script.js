const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

let slideAtual = 0;

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

    slides.forEach((slide, indice) => {
        slide.classList.toggle("ativo", indice === slideAtual);
    });

    indicadores.forEach((indicador, indice) => {
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
    try {
        const resposta = await fetch(TMDB_WORKER + endpoint);

        console.log("📡 Worker:", endpoint, resposta.status);

        if (!resposta.ok) {
            throw new Error("Erro HTTP " + resposta.status);
        }

        return await resposta.json();

    } catch (erro) {
        console.error("❌ Erro ao acessar o Worker:", erro);
        throw erro;
    }
}

function escaparHTML(texto) {
    if (texto === null || texto === undefined) {
        return "";
    }

    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obterTitulo(conteudo) {
    if (!conteudo) {
        return "Sem título";
    }

    return conteudo.title ||
        conteudo.name ||
        "Sem título";
}

function obterData(conteudo) {
    if (!conteudo) {
        return "Não informada";
    }

    const data =
        conteudo.release_date ||
        conteudo.first_air_date;

    if (!data) {
        return "Não informada";
    }

    const partes = data.split("-");

    if (partes.length !== 3) {
        return data;
    }

    return partes.reverse().join("/");
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

    if (
        conteudo.first_air_date ||
        conteudo.name
    ) {
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

function criarCard(conteudo) {
    if (!conteudoPermitido(conteudo)) {
        return null;
    }

    const card = document.createElement("div");

    card.className = "card";

    const imagem = conteudo.poster_path
        ? IMG + conteudo.poster_path
        : "";

    const titulo = obterTitulo(conteudo);

    const nota = conteudo.vote_average
        ? Number(conteudo.vote_average).toFixed(1)
        : "N/A";

    const tipo = descobrirTipo(conteudo);

    card.innerHTML =
        '<div class="imagem-card">' +

            (
                imagem
                    ? '<img src="' +
                        imagem +
                        '" alt="' +
                        escaparHTML(titulo) +
                        '" loading="lazy">'
                    : '<div class="sem-poster">🎬</div>'
            ) +

        '</div>' +

        '<h3>' +
            escaparHTML(titulo) +
        '</h3>' +

        '<p>⭐ ' +
            nota +
        '</p>';

    card.addEventListener("click", function() {
        abrirDetalhes(conteudo, tipo);
    });

    return card;
}

function mostrarNaSecao(
    secao,
    conteudos,
    limite = 10
) {
    if (!secao) {
        return;
    }

    const cards = secao.querySelector(".cards");

    if (!cards) {
        return;
    }

    cards.innerHTML = "";

    const lista = Array.isArray(conteudos)
        ? conteudos
            .filter(conteudoPermitido)
            .filter(conteudo => conteudo.poster_path)
            .slice(0, limite)
        : [];

    if (!lista.length) {
        cards.innerHTML =
            "<p>Nenhum conteúdo encontrado.</p>";

        return;
    }

    lista.forEach(conteudo => {
        const card = criarCard(conteudo);

        if (card) {
            cards.appendChild(card);
        }
    });
}

async function carregarFilmes() {
    const secaoFilmes =
        document.querySelector("#filmes");

    if (!secaoFilmes) {
        return;
    }

    console.log("🎬 Carregando filmes...");

    try {
        const destaque =
            await buscarTMDB("/filmes");

        mostrarNaSecao(
            secaoFilmes,
            Array.isArray(destaque.results)
                ? destaque.results
                : []
        );

        const avaliados =
            document.querySelector("#avaliados");

        if (avaliados) {
            const dados =
                await buscarTMDB(
                    "/filmes?sort_by=vote_average.desc"
                );

            mostrarNaSecao(
                avaliados,
                Array.isArray(dados.results)
                    ? dados.results
                    : []
            );
        }

        const lancamentos =
            document.querySelector("#lancamentos");

        if (lancamentos) {
            const dados =
                await buscarTMDB(
                    "/filmes?sort_by=primary_release_date.desc"
                );

            mostrarNaSecao(
                lancamentos,
                Array.isArray(dados.results)
                    ? dados.results
                    : []
            );
        }

        console.log("✅ Filmes carregados!");

    } catch (erro) {
        console.error(
            "❌ Erro ao carregar filmes:",
            erro
        );
    }
}
async function carregarSeries() {
    const secaoSeries =
        document.querySelector("#series");

    if (!secaoSeries) {
        return;
    }

    console.log("📺 Carregando séries...");

    try {
        const dados =
            await buscarTMDB("/series");

        const resultados =
            Array.isArray(dados.results)
                ? dados.results
                : [];

        mostrarNaSecao(
            secaoSeries,
            resultados
        );

        const secaoDoramas =
            document.querySelector("#doramas");

        if (secaoDoramas) {
            const doramas = resultados.filter(item => {
                const texto =
                    (
                        obterTitulo(item) +
                        " " +
                        (item.overview || "")
                    ).toLowerCase();

                return (
                    texto.includes("korea") ||
                    texto.includes("coreia") ||
                    texto.includes("korean") ||
                    texto.includes("doraman")
                );
            });

            mostrarNaSecao(
                secaoDoramas,
                doramas
            );
        }

        const secaoGL =
            document.querySelector("#gl");

        if (secaoGL) {
            const gl = resultados.filter(item => {
                const texto =
                    (
                        obterTitulo(item) +
                        " " +
                        (item.overview || "")
                    ).toLowerCase();

                return (
                    texto.includes("girls love") ||
                    texto.includes("girls' love") ||
                    texto.includes("girl love") ||
                    texto.includes("yuri")
                );
            });

            mostrarNaSecao(
                secaoGL,
                gl
            );
        }

        const secaoKids =
            document.querySelector("#kids");

        if (secaoKids) {
            const kids = resultados.filter(item => {
                const texto =
                    (
                        obterTitulo(item) +
                        " " +
                        (item.overview || "")
                    ).toLowerCase();

                return (
                    texto.includes("infantil") ||
                    texto.includes("children") ||
                    texto.includes("kids") ||
                    texto.includes("family")
                );
            });

            mostrarNaSecao(
                secaoKids,
                kids
            );
        }

        console.log("✅ Séries carregadas!");

    } catch (erro) {
        console.error(
            "❌ Erro ao carregar séries:",
            erro
        );
    }
}


/* =========================
   BUSCA
========================= */

let ultimaBusca = "";

async function realizarBusca(termo) {
    termo = String(termo || "").trim();

    if (!termo) {
        return;
    }

    ultimaBusca = termo;

    console.log(
        "🔎 Buscando:",
        termo
    );

    try {
        const dados =
            await buscarTMDB(
                "/buscar?query=" +
                encodeURIComponent(termo)
            );

        const resultados =
            Array.isArray(dados.results)
                ? dados.results
                : [];

        mostrarResultadosBusca(
            resultados
        );

    } catch (erro) {
        console.error(
            "❌ Erro na busca:",
            erro
        );

        mostrarMensagemBusca(
            "Não foi possível realizar a busca."
        );
    }
}


function mostrarResultadosBusca(resultados) {
    let container =
        document.querySelector("#resultados-busca");

    if (!container) {
        container =
            document.querySelector("#resultados");

    }

    if (!container) {
        console.warn(
            "⚠️ Container de resultados não encontrado."
        );

        return;
    }

    container.innerHTML = "";

    const lista =
        Array.isArray(resultados)
            ? resultados
                .filter(conteudoPermitido)
                .filter(item => item.poster_path)
            : [];

    if (!lista.length) {
        container.innerHTML =
            "<p>Nenhum resultado encontrado.</p>";

        return;
    }

    lista.forEach(conteudo => {
        const card =
            criarCard(conteudo);

        if (card) {
            container.appendChild(card);
        }
    });
}


function mostrarMensagemBusca(mensagem) {
    const container =
        document.querySelector(
            "#resultados-busca"
        ) ||
        document.querySelector(
            "#resultados"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>" +
        escaparHTML(mensagem) +
        "</p>";
}


function configurarBusca() {
    const campos =
        document.querySelectorAll(
            'input[type="search"], #campo-busca, #searchInput'
        );

    campos.forEach(campo => {
        campo.addEventListener(
            "keydown",
            function(evento) {
                if (
                    evento.key === "Enter"
                ) {
                    evento.preventDefault();

                    realizarBusca(
                        campo.value
                    );
                }
            }
        );
    });

    const botoes =
        document.querySelectorAll(
            "#botao-buscar, #btnBuscar, .botao-busca, .search-button"
        );

    botoes.forEach(botao => {
        botao.addEventListener(
            "click",
            function() {
                const campo =
                    document.querySelector(
                        'input[type="search"], #campo-busca, #searchInput'
                    );

                if (campo) {
                    realizarBusca(
                        campo.value
                    );
                }
            }
        );
    });
}


/* =========================
   MODAL DE DETALHES
========================= */

let conteudoAtual = null;
let tipoConteudoAtual = null;


async function abrirDetalhes(
    conteudo,
    tipo
) {
    if (!conteudo || !conteudo.id) {
        return;
    }

    conteudoAtual = conteudo;
    tipoConteudoAtual = tipo;

    console.log(
        "📖 Abrindo detalhes:",
        conteudo.id,
        tipo
    );

    try {
        const endpoint =
            tipo === "serie"
                ? "/serie?id=" + conteudo.id
                : "/filme?id=" + conteudo.id;

        const detalhes =
            await buscarTMDB(endpoint);

        mostrarModalDetalhes(
            detalhes,
            tipo
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao carregar detalhes:",
            erro
        );

        mostrarModalDetalhes(
            conteudo,
            tipo
        );
    }
}


function encontrarModal() {
    return (
        document.querySelector(
            "#modal-detalhes"
        ) ||
        document.querySelector(
            "#modalDetalhes"
        ) ||
        document.querySelector(
            ".modal-detalhes"
        )
    );
}


function mostrarModalDetalhes(
    dados,
    tipo
) {
    let modal =
        encontrarModal();

    if (!modal) {
        modal =
            document.createElement("div");

        modal.id =
            "modal-detalhes";

        modal.className =
            "modal-detalhes";

        document.body.appendChild(
            modal
        );
    }

    const titulo =
        obterTitulo(dados);

    const descricao =
        dados.overview ||
        "Sinopse não disponível.";

    const imagem =
        dados.backdrop_path
            ? "https://image.tmdb.org/t/p/original" +
              dados.backdrop_path
            : (
                dados.poster_path
                    ? "https://image.tmdb.org/t/p/w780" +
                      dados.poster_path
                    : ""
            );

    const nota =
        dados.vote_average
            ? Number(
                dados.vote_average
            ).toFixed(1)
            : "N/A";

    const data =
        obterData(dados);

    const favoritos =
        obterFavoritos();

    const favoritado =
        favoritos.some(
            item =>
                String(item.id) ===
                String(dados.id)
        );

    modal.innerHTML =
        '<div class="modal-conteudo">' +

            '<button class="fechar-modal" ' +
            'onclick="fecharModalDetalhes()">' +
                '✕' +
            '</button>' +

            (
                imagem
                    ? '<div class="modal-capa">' +
                        '<img src="' +
                        imagem +
                        '" alt="' +
                        escaparHTML(titulo) +
                        '">' +
                      '</div>'
                    : ""
            ) +

            '<div class="modal-info">' +

                '<h2>' +
                    escaparHTML(titulo) +
                '</h2>' +

                '<p class="modal-meta">' +
                    '⭐ ' +
                    nota +
                    ' &nbsp; • &nbsp; ' +
                    escaparHTML(data) +
                '</p>' +

                '<p class="modal-sinopse">' +
                    escaparHTML(descricao) +
                '</p>' +

                '<div class="modal-botoes">' +

                    (
                        tipo === "serie"
                            ? '<button ' +
                                'class="botao-assistir" ' +
                                'onclick="mostrarTemporadas(' +
                                    dados.id +
                                ')">' +
                                '▶ Temporadas' +
                              '</button>'
                            : '<button ' +
                                'class="botao-assistir" ' +
                                'onclick="tentarAssistir()">' +
                                '▶ Assistir agora' +
                              '</button>'
                    ) +

                    '<button ' +
                        'class="botao-favorito" ' +
                        'onclick="alternarFavoritoDoDetalhe(' +
                            dados.id +
                        ')">' +
                        (
                            favoritado
                                ? "⭐ Remover dos favoritos"
                                : "☆ Adicionar aos favoritos"
                        ) +
                    '</button>' +

                '</div>' +

                '<div id="detalhes-elenco">' +
                    '<h3>Elenco</h3>' +
                    '<p>Carregando...</p>' +
                '</div>' +

                (
                    tipo === "serie"
                        ? '<div id="lista-temporadas"></div>'
                        : ""
                ) +

            '</div>' +

        '</div>';

    modal.classList.add("ativo");

    document.body.classList.add(
        "modal-aberto"
    );

    adicionarAoHistorico(
        dados
    );

    carregarElenco(
        dados,
        tipo
    );

    if (tipo === "serie") {
        carregarListaTemporadas(
            dados
        );
    }
}


function fecharModalDetalhes() {
    const modal =
        encontrarModal();

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "ativo"
    );

    document.body.classList.remove(
        "modal-aberto"
    );
}


function tentarAssistir() {
    alert(
        "🎬 A reprodução do vídeo será adicionada ao CineFamily quando a fonte de vídeo estiver disponível."
    );
}
/* =========================
   ELENCO
========================= */

async function carregarElenco(dados, tipo) {
    const container =
        document.querySelector("#detalhes-elenco");

    if (!container || !dados || !dados.id) {
        return;
    }

    try {
        let elenco = [];

        if (
            dados.credits &&
            Array.isArray(dados.credits.cast)
        ) {
            elenco = dados.credits.cast;
        }

        if (
            dados.aggregate_credits &&
            Array.isArray(
                dados.aggregate_credits.cast
            )
        ) {
            elenco =
                dados.aggregate_credits.cast;
        }

        if (!elenco.length) {
            container.innerHTML =
                "<h3>Elenco</h3>" +
                "<p>Elenco não disponível.</p>";

            return;
        }

        elenco = elenco
            .filter(pessoa => pessoa && pessoa.name)
            .slice(0, 12);

        let html =
            "<h3>Elenco</h3>" +
            '<div class="elenco-lista">';

        elenco.forEach(pessoa => {
            const nome =
                pessoa.name || "Desconhecido";

            const personagem =
                pessoa.character ||
                (
                    Array.isArray(
                        pessoa.roles
                    ) &&
                    pessoa.roles.length
                        ? pessoa.roles[0].character
                        : ""
                );

            const foto =
                pessoa.profile_path
                    ? "https://image.tmdb.org/t/p/w185" +
                      pessoa.profile_path
                    : "";

            html +=
                '<div class="ator">' +

                    (
                        foto
                            ? '<img src="' +
                                foto +
                                '" alt="' +
                                escaparHTML(nome) +
                                '" loading="lazy">'
                            : '<div class="sem-foto">👤</div>'
                    ) +

                    '<strong>' +
                        escaparHTML(nome) +
                    '</strong>' +

                    (
                        personagem
                            ? '<span>' +
                                escaparHTML(
                                    personagem
                                ) +
                              '</span>'
                            : ""
                    ) +

                '</div>';
        });

        html += "</div>";

        container.innerHTML = html;

    } catch (erro) {
        console.error(
            "❌ Erro ao carregar elenco:",
            erro
        );

        container.innerHTML =
            "<h3>Elenco</h3>" +
            "<p>Não foi possível carregar o elenco.</p>";
    }
}


/* =========================
   TEMPORADAS
========================= */

async function carregarListaTemporadas(
    serie
) {
    const container =
        document.querySelector(
            "#lista-temporadas"
        );

    if (!container || !serie) {
        return;
    }

    const temporadas =
        Array.isArray(serie.seasons)
            ? serie.seasons
            : [];

    if (!temporadas.length) {
        container.innerHTML =
            "<h3>Temporadas</h3>" +
            "<p>Temporadas não disponíveis.</p>";

        return;
    }

    const temporadasValidas =
        temporadas.filter(
            temporada =>
                temporada &&
                temporada.season_number >= 0
        );

    let html =
        "<h3>Temporadas</h3>" +
        '<div class="temporadas-lista">';

    temporadasValidas.forEach(
        temporada => {
            const numero =
                temporada.season_number;

            const nome =
                temporada.name ||
                (
                    numero === 0
                        ? "Especiais"
                        : "Temporada " +
                          numero
                );

            const episodios =
                temporada.episode_count ||
                0;

            html +=
                '<button ' +
                    'class="botao-temporada" ' +
                    'onclick="carregarEpisodios(' +
                        serie.id +
                        ',' +
                        numero +
                    ')">' +

                    escaparHTML(nome) +

                    ' <span>(' +
                        episodios +
                        ' episódios)</span>' +

                '</button>';
        }
    );

    html += "</div>";

    html +=
        '<div id="lista-episodios"></div>';

    container.innerHTML = html;
}


async function mostrarTemporadas(
    serieId
) {
    if (!serieId) {
        return;
    }

    try {
        const dados =
            await buscarTMDB(
                "/serie?id=" +
                serieId
            );

        mostrarModalDetalhes(
            dados,
            "serie"
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao abrir temporadas:",
            erro
        );
    }
}


async function carregarEpisodios(
    serieId,
    temporadaNumero
) {
    const container =
        document.querySelector(
            "#lista-episodios"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>⏳ Carregando episódios...</p>";

    try {
        const dados =
            await buscarTMDB(
                "/temporada?id=" +
                serieId +
                "&temporada=" +
                temporadaNumero
            );

        const episodios =
            Array.isArray(dados.episodes)
                ? dados.episodes
                : [];

        if (!episodios.length) {
            container.innerHTML =
                "<p>Nenhum episódio encontrado.</p>";

            return;
        }

        let html =
            '<div class="episodios-lista">' +
            "<h3>" +
                (
                    temporadaNumero === 0
                        ? "Especiais"
                        : "Temporada " +
                          temporadaNumero
                ) +
            "</h3>";

        episodios.forEach(
            episodio => {
                const numero =
                    episodio.episode_number ||
                    0;

                const titulo =
                    episodio.name ||
                    "Episódio " +
                    numero;

                const descricao =
                    episodio.overview ||
                    "Sinopse não disponível.";

                const imagem =
                    episodio.still_path
                        ? "https://image.tmdb.org/t/p/w500" +
                          episodio.still_path
                        : "";

                html +=
                    '<div class="episodio">' +

                        (
                            imagem
                                ? '<img src="' +
                                    imagem +
                                    '" alt="' +
                                    escaparHTML(
                                        titulo
                                    ) +
                                    '" loading="lazy">'
                                : '<div class="episodio-sem-imagem">🎬</div>'
                        ) +

                        '<div class="episodio-info">' +

                            '<h4>' +
                                numero +
                                ". " +
                                escaparHTML(
                                    titulo
                                ) +
                            '</h4>' +

                            '<p>' +
                                escaparHTML(
                                    descricao
                                ) +
                            '</p>' +

                            '<button ' +
                                'class="botao-episodio" ' +
                                'onclick="assistirEpisodio(' +
                                    serieId +
                                    ',' +
                                    temporadaNumero +
                                    ',' +
                                    numero +
                                ')">' +
                                '▶ Assistir episódio' +
                            '</button>' +

                        '</div>' +

                    '</div>';
            }
        );

        html += "</div>";

        container.innerHTML = html;

    } catch (erro) {
        console.error(
            "❌ Erro ao carregar episódios:",
            erro
        );

        container.innerHTML =
            "<p>Não foi possível carregar os episódios.</p>";
    }
}


function assistirEpisodio(
    serieId,
    temporada,
    episodio
) {
    alert(
        "▶ Episódio " +
        episodio +
        " da temporada " +
        temporada +
        ".\n\nA reprodução será conectada quando a fonte de vídeo estiver disponível."
    );
}


/* =========================
   FAVORITOS
========================= */

function obterFavoritos() {
    try {
        const dados =
            localStorage.getItem(
                "cinefamily_favoritos"
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


function salvarFavoritos(favoritos) {
    try {
        localStorage.setItem(
            "cinefamily_favoritos",
            JSON.stringify(favoritos)
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao salvar favoritos:",
            erro
        );
    }
}


function alternarFavorito(
    conteudo
) {
    if (!conteudo || !conteudo.id) {
        return;
    }

    let favoritos =
        obterFavoritos();

    const indice =
        favoritos.findIndex(
            item =>
                String(item.id) ===
                String(conteudo.id)
        );

    if (indice >= 0) {
        favoritos.splice(
            indice,
            1
        );

        console.log(
            "⭐ Removido dos favoritos:",
            obterTitulo(conteudo)
        );

    } else {
        favoritos.push({
            ...conteudo,
            adicionado_em:
                new Date().toISOString()
        });

        console.log(
            "⭐ Adicionado aos favoritos:",
            obterTitulo(conteudo)
        );
    }

    salvarFavoritos(
        favoritos
    );
}


function alternarFavoritoDoDetalhe(
    id
) {
    if (!id) {
        return;
    }

    let favoritos =
        obterFavoritos();

    const indice =
        favoritos.findIndex(
            item =>
                String(item.id) ===
                String(id)
        );

    if (indice >= 0) {
        favoritos.splice(
            indice,
            1
        );
    } else {
        if (
            conteudoAtual &&
            String(conteudoAtual.id) ===
            String(id)
        ) {
            favoritos.push({
                ...conteudoAtual,
                adicionado_em:
                    new Date().toISOString()
            });
        }
    }

    salvarFavoritos(
        favoritos
    );

    if (
        conteudoAtual &&
        String(conteudoAtual.id) ===
        String(id)
    ) {
        mostrarModalDetalhes(
            conteudoAtual,
            tipoConteudoAtual
        );
    }

    atualizarTelaFavoritos();
}


function atualizarTelaFavoritos() {
    const container =
        document.querySelector(
            "#lista-favoritos"
        );

    if (!container) {
        return;
    }

    const favoritos =
        obterFavoritos();

    container.innerHTML = "";

    if (!favoritos.length) {
        container.innerHTML =
            "<p>Você ainda não adicionou favoritos.</p>";

        return;
    }

    favoritos.forEach(
        conteudo => {
            const card =
                criarCard(conteudo);

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}


/* =========================
   HISTÓRICO
========================= */

function obterHistorico() {
    try {
        const dados =
            localStorage.getItem(
                "cinefamily_historico"
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


function salvarHistorico(
    historico
) {
    try {
        localStorage.setItem(
            "cinefamily_historico",
            JSON.stringify(historico)
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao salvar histórico:",
            erro
        );
    }
}


function adicionarAoHistorico(
    conteudo
) {
    if (!conteudo || !conteudo.id) {
        return;
    }

    let historico =
        obterHistorico();

    historico =
        historico.filter(
            item =>
                String(item.id) !==
                String(conteudo.id)
        );

    historico.unshift({
        ...conteudo,
        visto_em:
            new Date().toISOString()
    });

    historico =
        historico.slice(0, 50);

    salvarHistorico(
        historico
    );

    atualizarTelaHistorico();
}


function limparHistorico() {
    const confirmar =
        confirm(
            "Tem certeza que deseja limpar todo o histórico?"
        );

    if (!confirmar) {
        return;
    }

    localStorage.removeItem(
        "cinefamily_historico"
    );

    atualizarTelaHistorico();
}


function atualizarTelaHistorico() {
    const container =
        document.querySelector(
            "#lista-historico"
        );

    if (!container) {
        return;
    }

    const historico =
        obterHistorico();

    container.innerHTML = "";

    if (!historico.length) {
        container.innerHTML =
            "<p>Seu histórico está vazio.</p>";

        return;
    }

    historico.forEach(
        conteudo => {
            const card =
                criarCard(conteudo);

            if (card) {
                container.appendChild(
                    card
                );
            }
        }
    );
}
/* =========================
   BOTÕES E NAVEGAÇÃO
========================= */

function configurarBotoes() {
    const botoesFavoritos =
        document.querySelectorAll(
            "[data-favorito]"
        );

    botoesFavoritos.forEach(
        botao => {
            botao.addEventListener(
                "click",
                function(evento) {
                    evento.preventDefault();

                    const id =
                        botao.getAttribute(
                            "data-favorito"
                        );

                    if (
                        conteudoAtual &&
                        String(
                            conteudoAtual.id
                        ) === String(id)
                    ) {
                        alternarFavoritoDoDetalhe(
                            id
                        );
                    }
                }
            );
        }
    );


    const botoesFechar =
        document.querySelectorAll(
            ".fechar-modal, [data-fechar-modal]"
        );

    botoesFechar.forEach(
        botao => {
            botao.addEventListener(
                "click",
                fecharModalDetalhes
            );
        }
    );


    const modal =
        encontrarModal();

    if (modal) {
        modal.addEventListener(
            "click",
            function(evento) {
                if (
                    evento.target === modal
                ) {
                    fecharModalDetalhes();
                }
            }
        );
    }
}


function configurarMenu() {
    const links =
        document.querySelectorAll(
            "a[href]"
        );

    links.forEach(
        link => {
            link.addEventListener(
                "click",
                function() {
                    const href =
                        link.getAttribute(
                            "href"
                        );

                    if (
                        !href ||
                        href === "#" ||
                        href.startsWith(
                            "javascript:"
                        )
                    ) {
                        return;
                    }

                    console.log(
                        "🔗 Navegando para:",
                        href
                    );
                }
            );
        }
    );
}


/* =========================
   PÁGINA DE FAVORITOS
========================= */

function carregarPaginaFavoritos() {
    const container =
        document.querySelector(
            "#lista-favoritos"
        );

    if (!container) {
        return;
    }

    atualizarTelaFavoritos();
}


/* =========================
   PÁGINA DE HISTÓRICO
========================= */

function carregarPaginaHistorico() {
    const container =
        document.querySelector(
            "#lista-historico"
        );

    if (!container) {
        return;
    }

    atualizarTelaHistorico();

    const botaoLimpar =
        document.querySelector(
            "#limpar-historico"
        );

    if (botaoLimpar) {
        botaoLimpar.addEventListener(
            "click",
            limparHistorico
        );
    }
}


/* =========================
   CARREGAMENTO INICIAL
========================= */

async function iniciarCineFamily() {
    console.log(
        "🎬 CineFamily iniciando..."
    );

    try {
        await carregarFilmes();
    } catch (erro) {
        console.error(
            "❌ Falha ao iniciar filmes:",
            erro
        );
    }

    try {
        await carregarSeries();
    } catch (erro) {
        console.error(
            "❌ Falha ao iniciar séries:",
            erro
        );
    }

    configurarBusca();
    configurarBotoes();
    configurarMenu();

    carregarPaginaFavoritos();
    carregarPaginaHistorico();

    mostrarSlide(0);

    console.log(
        "✅ CineFamily carregado com sucesso!"
    );
}


/* =========================
   TECLADO
========================= */

document.addEventListener(
    "keydown",
    function(evento) {
        const modal =
            encontrarModal();

        if (
            evento.key === "Escape" &&
            modal &&
            modal.classList.contains(
                "ativo"
            )
        ) {
            fecharModalDetalhes();
        }

        if (
            evento.key === "ArrowRight"
        ) {
            const slides =
                document.querySelectorAll(
                    ".slide"
                );

            if (
                slides.length &&
                !(
                    modal &&
                    modal.classList.contains(
                        "ativo"
                    )
                )
            ) {
                proximoSlide();
            }
        }

        if (
            evento.key === "ArrowLeft"
        ) {
            const slides =
                document.querySelectorAll(
                    ".slide"
                );

            if (
                slides.length &&
                !(
                    modal &&
                    modal.classList.contains(
                        "ativo"
                    )
                )
            ) {
                slideAnterior();
            }
        }
    }
);


/* =========================
   INICIAR
========================= */

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
