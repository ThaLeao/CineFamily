const TMDB_WORKER = "https://cinefamily-tmdb.thabsleao.workers.dev";
const IMG = "https://image.tmdb.org/t/p/w500";

let slideAtual = 0;

function mostrarSlide(numero) {
const slides = document.querySelectorAll(".slide");
const indicadores = document.querySelectorAll(".indicador");

```
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

async function buscarTMDB(endpoint) {
const resposta = await fetch(TMDB_WORKER + endpoint);

```
console.log("📡 Worker:", endpoint, resposta.status);

if (!resposta.ok) {
    throw new Error("Erro HTTP " + resposta.status);
}

return await resposta.json();
```

}

function escaparHTML(texto) {
if (!texto) {
return "";
}

```
return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
```

}

function obterTitulo(conteudo) {
return conteudo.title || conteudo.name || "Sem título";
}

function obterData(conteudo) {
const data = conteudo.release_date || conteudo.first_air_date;

```
if (!data) {
    return "Não informada";
}

const partes = data.split("-");

if (partes.length !== 3) {
    return data;
}

return partes.reverse().join("/");
```

}

function criarCard(conteudo) {
const card = document.createElement("div");

```
card.className = "card";

const imagem = conteudo.poster_path
    ? IMG + conteudo.poster_path
    : "";

const titulo = obterTitulo(conteudo);

const nota = conteudo.vote_average
    ? Number(conteudo.vote_average).toFixed(1)
    : "N/A";

const tipo = conteudo.media_type === "tv" || conteudo.name
    ? "serie"
    : "filme";

card.innerHTML =
    '<div class="imagem-card">' +
        (
            imagem
                ? '<img src="' +
                    imagem +
                    '" alt="' +
                    escaparHTML(titulo) +
                    '" loading="lazy">'
                : "🎬"
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
```

}

function mostrarNaSecao(secao, conteudos) {
if (!secao) {
return;
}

```
const cards = secao.querySelector(".cards");

if (!cards) {
    return;
}

cards.innerHTML = "";

conteudos
    .filter(function(conteudo) {
        return conteudo.poster_path;
    })
    .slice(0, 10)
    .forEach(function(conteudo) {
        cards.appendChild(criarCard(conteudo));
    });
```

}

async function carregarFilmes() {
const secoes = document.querySelectorAll(".categoria-secao");

```
if (!secoes.length) {
    return;
}

console.log("🎬 Carregando catálogo CineFamily...");

try {
    const destaque = await buscarTMDB("/filmes");

    if (secoes[0]) {
        mostrarNaSecao(
            secoes[0],
            Array.isArray(destaque.results)
                ? destaque.results
                : []
        );
    }

    if (secoes[1]) {
        const avaliados = await buscarTMDB(
            "/filmes?sort_by=vote_average.desc"
        );

        mostrarNaSecao(
            secoes[1],
            Array.isArray(avaliados.results)
                ? avaliados.results
                : []
        );
    }

    if (secoes[2]) {
        const lancamentos = await buscarTMDB(
            "/filmes?sort_by=primary_release_date.desc"
        );

        mostrarNaSecao(
            secoes[2],
            Array.isArray(lancamentos.results)
                ? lancamentos.results
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
```

}

async function realizarBusca() {
const campo = document.getElementById("campo-busca");
const resultados = document.getElementById("resultados-busca");

```
if (!campo || !resultados) {
    return;
}

const buscaCards = resultados.querySelector(".cards");

if (!buscaCards) {
    return;
}

const texto = campo.value.trim();

if (!texto) {
    resultados.style.display = "none";
    return;
}

console.log("🔎 Buscando:", texto);

resultados.style.display = "block";

buscaCards.innerHTML =
    "<p>🔎 Buscando...</p>";

try {
    const dados = await buscarTMDB(
        "/buscar?query=" +
        encodeURIComponent(texto)
    );

    const resultadosTMDB =
        Array.isArray(dados.results)
            ? dados.results
            : [];

    const conteudos = resultadosTMDB.filter(
        function(conteudo) {
            return (
                conteudo.media_type === "movie" ||
                conteudo.media_type === "tv"
            );
        }
    );

    buscaCards.innerHTML = "";

    const comCapa = conteudos.filter(
        function(conteudo) {
            return conteudo.poster_path;
        }
    );

    if (!comCapa.length) {
        buscaCards.innerHTML =
            '<p>Nenhum filme ou série encontrado.</p>';

        return;
    }

    comCapa
        .slice(0, 20)
        .forEach(function(conteudo) {
            buscaCards.appendChild(
                criarCard(conteudo)
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
        "<p>❌ Não foi possível realizar a busca.</p>";
}
```

}

function configurarBusca() {
const botaoBusca =
document.getElementById("botao-busca");

```
const areaBusca =
    document.getElementById("area-busca");

const campoBusca =
    document.getElementById("campo-busca");

const fecharBusca =
    document.getElementById("fechar-busca");

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
        areaBusca.style.display = "block";
        campoBusca.focus();
    }
);

if (fecharBusca) {
    fecharBusca.addEventListener(
        "click",
        function() {

            areaBusca.style.display = "none";

            campoBusca.value = "";

            const resultados =
                document.getElementById(
                    "resultados-busca"
                );

            if (resultados) {
                resultados.style.display = "none";
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
```

}

async function abrirDetalhes(conteudo, tipo) {
fecharDetalhes();

```
registrarHistorico(conteudo);

const modal = document.createElement("div");

modal.id = "cinefamily-modal";

modal.innerHTML =
    '<div class="detalhes-filme">' +

        '<button class="fechar-detalhes" type="button">' +
            "✕" +
        "</button>" +

        '<div class="detalhes-conteudo">' +

            '<div class="detalhes-poster">' +
                '<div style="padding:40px;text-align:center;">' +
                    "⏳" +
                "</div>" +
            "</div>" +

            '<div class="detalhes-info">' +

                '<p>Carregando detalhes...</p>' +

            "</div>" +

        "</div>" +

    "</div>";

document.body.appendChild(modal);

modal.querySelector(
    ".fechar-detalhes"
).addEventListener(
    "click",
    fecharDetalhes
);

try {

    let detalhes;

    if (tipo === "serie") {
        detalhes = await buscarTMDB(
            "/serie?id=" +
            encodeURIComponent(conteudo.id)
        );
    } else {
        detalhes = await buscarTMDB(
            "/filme?id=" +
            encodeURIComponent(conteudo.id)
        );
    }

    preencherDetalhes(
        modal,
        detalhes,
        tipo
    );

} catch (erro) {

    console.error(
        "❌ Erro nos detalhes:",
        erro
    );

    const info =
        modal.querySelector(
            ".detalhes-info"
        );

    if (info) {
        info.innerHTML =
            "<p>❌ Não foi possível carregar os detalhes.</p>";
    }
}
```

}

function preencherDetalhes(
modal,
detalhes,
tipo
) {

```
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

const imagem =
    detalhes.poster_path
        ? IMG + detalhes.poster_path
        : "";

const nota =
    detalhes.vote_average
        ? Number(
            detalhes.vote_average
        ).toFixed(1)
        : "N/A";

const data =
    obterData(detalhes);

const sinopse =
    detalhes.overview ||
    "Sinopse não disponível.";

const categoria =
    tipo === "serie"
        ? "📺 SÉRIE"
        : "🎬 FILME";

if (poster) {

    poster.innerHTML =
        imagem
            ? '<img src="' +
                imagem +
                '" alt="' +
                escaparHTML(titulo) +
                '">'
            : "🎬";
}

let html =
    '<span class="categoria">' +
        categoria +
    "</span>" +

    "<h1>" +
        escaparHTML(titulo) +
    "</h1>" +

    '<p class="nota">' +
        "⭐ " +
        nota +
    "</p>" +

    '<p class="data">' +
        "📅 " +
        data +
    "</p>" +

    '<p class="sinopse">' +
        escaparHTML(sinopse) +
    "</p>";

if (tipo === "serie") {

    const temporadas =
        detalhes.number_of_seasons || 0;

    const episodios =
        detalhes.number_of_episodes || 0;

    html +=
        '<div class="informacoes-serie">' +

            "<p>📺 <strong>" +
                temporadas +
            "</strong> temporada(s)</p>" +

            "<p>🎞️ <strong>" +
                episodios +
            "</strong> episódio(s)</p>" +

        "</div>";
}

html +=
    '<div class="botoes-detalhes">' +

        '<button class="assistir" type="button">' +
            "▶ Assistir agora" +
        "</button>" +

        '<button class="favorito" type="button">' +
            "⭐ Favoritar" +
        "</button>" +

    "</div>";

if (tipo === "serie") {

    html +=
        '<div class="area-temporadas">' +

            "<h2>🎞️ Temporadas</h2>" +

            '<div class="lista-temporadas"></div>' +

            '<div class="episodios"></div>' +

        "</div>";
}

html +=
    '<div class="area-elenco">' +

        "<h2>🎭 Elenco</h2>" +

        '<div class="lista-elenco"></div>' +

    "</div>";

info.innerHTML = html;

configurarFavorito(
    modal,
    detalhes
);

const botaoAssistir =
    modal.querySelector(
        ".assistir"
    );

if (botaoAssistir) {

    botaoAssistir.addEventListener(
        "click",
        function() {

            registrarHistorico(
                detalhes
            );

            alert(
                "🎬 O vídeo deste conteúdo ainda não está disponível."
            );
        }
    );
}

carregarElenco(
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
```

}

function configurarFavorito(
modal,
conteudo
) {

```
const botao =
    modal.querySelector(
        ".favorito"
    );

if (!botao) {
    return;
}

const favoritos =
    obterFavoritos();

const existe =
    favoritos.some(
        function(item) {
            return Number(item.id) ===
                Number(conteudo.id);
        }
    );

if (existe) {
    botao.textContent =
        "⭐ Favoritado";
}

botao.addEventListener(
    "click",
    function() {

        adicionarFavorito(
            conteudo
        );

        botao.textContent =
            "⭐ Favoritado";
    }
);
```

}

async function carregarElenco(
modal,
detalhes,
tipo
) {

```
const area =
    modal.querySelector(
        ".lista-elenco"
    );

if (!area) {
    return;
}

let elenco = [];

if (tipo === "serie") {

    if (
        detalhes.aggregate_credits &&
        Array.isArray(
            detalhes.aggregate_credits.cast
        )
    ) {
        elenco =
            detalhes.aggregate_credits.cast;
    }

} else {

    if (
        detalhes.credits &&
        Array.isArray(
            detalhes.credits.cast
        )
    ) {
        elenco =
            detalhes.credits.cast;
    }
}

elenco = elenco
    .filter(function(pessoa) {
        return pessoa.profile_path;
    })
    .slice(0, 12);

if (!elenco.length) {

    area.innerHTML =
        "<p>Elenco não disponível.</p>";

    return;
}

area.innerHTML = "";

elenco.forEach(
    function(pessoa) {

        const nome =
            pessoa.name ||
            "Ator";

        const personagem =
            pessoa.character ||
            (
                Array.isArray(
                    pessoa.roles
                ) &&
                pessoa.roles[0]
                    ? pessoa.roles[0].character
                    : ""
            );

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "card elenco-card";

        card.innerHTML =
            '<div class="imagem-card">' +

                '<img src="' +
                    IMG +
                    pessoa.profile_path +
                    '" alt="' +
                    escaparHTML(nome) +
                '">' +

            "</div>" +

            "<h3>" +
                escaparHTML(nome) +
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

        area.appendChild(card);
    }
);
```

}

async function carregarTemporadas(
modal,
serie
) {

```
const lista =
    modal.querySelector(
        ".lista-temporadas"
    );

const episodios =
    modal.querySelector(
        ".episodios"
    );

if (!lista || !episodios) {
    return;
}

const temporadas =
    Array.isArray(
        serie.seasons
    )
        ? serie.seasons
        : [];

if (!temporadas.length) {

    lista.innerHTML =
        "<p>Temporadas não disponíveis.</p>";

    return;
}

lista.innerHTML = "";

temporadas.forEach(
    function(temporada) {

        const numero =
            temporada.season_number;

        const botao =
            document.createElement(
                "button"
            );

        botao.type = "button";

        botao.className =
            "botao-temporada";

        botao.textContent =
            "Temporada " +
            numero;

        botao.addEventListener(
            "click",
            function() {

                carregarEpisodios(
                    serie.id,
                    numero,
                    episodios
                );
            }
        );

        lista.appendChild(
            botao
        );
    }
);

const temporadaValida =
    temporadas.find(
        function(temporada) {
            return temporada.season_number > 0;
        }
    );

if (temporadaValida) {

    carregarEpisodios(
        serie.id,
        temporadaValida.season_number,
        episodios
    );
}
```

}

async function carregarEpisodios(
serieId,
numeroTemporada,
area
) {

```
area.innerHTML =
    "<p>⏳ Carregando episódios...</p>";

try {

    const dados =
        await buscarTMDB(
            "/temporada?id=" +
            encodeURIComponent(
                serieId
            ) +
            "&temporada=" +
            encodeURIComponent(
                numeroTemporada
            )
        );

    const episodios =
        Array.isArray(
            dados.episodes
        )
            ? dados.episodes
            : [];

    if (!episodios.length) {

        area.innerHTML =
            "<p>Nenhum episódio encontrado.</p>";

        return;
    }

    area.innerHTML =
        "<h3>📋 Episódios</h3>";

    episodios.forEach(
        function(episodio) {

            const numero =
                episodio.episode_number;

            const titulo =
                episodio.name ||
                "Episódio";

            const sinopse =
                episodio.overview ||
                "Sinopse não disponível.";

            const data =
                episodio.air_date
                    ? episodio.air_date
                        .split("-")
                        .reverse()
                        .join("/")
                    : "Data não informada";

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "episodio";

            item.innerHTML =
                "<h4>" +
                    "Episódio " +
                    numero +
                    " — " +
                    escaparHTML(titulo) +
                "</h4>" +

                "<p>" +
                    "📅 " +
                    data +
                "</p>" +

                "<p>" +
                    escaparHTML(
                        sinopse
                    ) +
                "</p>";

            area.appendChild(
                item
            );
        }
    );

} catch (erro) {

    console.error(
        "❌ Erro nos episódios:",
        erro
    );

    area.innerHTML =
        "<p>❌ Não foi possível carregar os episódios.</p>";
}
```

}

function obterHistorico() {

```
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

    return Array.isArray(
        historico
    )
        ? historico
        : [];

} catch (erro) {

    console.error(
        "❌ Erro no histórico:",
        erro
    );

    return [];
}
```

}

function registrarHistorico(conteudo) {

```
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
    JSON.stringify(
        historico
    )
);
```

}

function obterFavoritos() {

```
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

    return Array.isArray(
        favoritos
    )
        ? favoritos
        : [];

} catch (erro) {

    console.error(
        "❌ Erro nos favoritos:",
        erro
    );

    return [];
}
```

}

function adicionarFavorito(
conteudo
) {

```
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

    id: conteudo.id,

    title:
        conteudo.title,

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
    JSON.stringify(
        favoritos
    )
);

alert(
    "⭐ Conteúdo adicionado aos favoritos!"
);
```

}

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

document.addEventListener(
"click",
function(event) {

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

document.addEventListener(
"DOMContentLoaded",
function() {

```
    console.log(
        "🚀 CineFamily iniciado."
    );

    mostrarSlide(0);

    configurarBusca();

    carregarFilmes();
}
```

);
