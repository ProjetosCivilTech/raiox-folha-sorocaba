/* =========================================================================
Pagina Sobre — Observatório Social do Brasil — Sorocaba
v6

Compatível com:
  - sobre.html (cabeçalho unificado, dados abertos em XLSX)
  - app.js v6 (helpers, badge, breadcrumb, drawer)

Estrutura: IIFE (evita poluir o escopo global)

Mudanças v6:
  - Fallbacks de erro/vazio apontam para dados/excel/*.xlsx
    (o painel oferece XLSX ao público; CSV continua como bastidor técnico)
  - Texto "Baixar CSV" → "Baixar XLSX" no fallback de cobertura de gênero

Cobre:
  - Período no cabeçalho
  - Selo de auditoria dinâmico (calcula pendências reais)
  - Fonte dos dados (kpis.json)
  - Cobertura da análise de gênero (genero_geral.csv — carregado para
    cálculo interno, mas o fallback de erro aponta para o XLSX público)
  - Mapas públicos: regimes, secretarias, escolaridades
  - Rodapé com data de atualização
========================================================================= */
(function () {
  "use strict";

  const TIMEOUT_MS = 8000;
  const TENTATIVAS = 2;

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* -------------------------------------------------------------------------
  Formatadores locais
  ------------------------------------------------------------------------- */
  function formatarNumero(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "—";
    return Number(n).toLocaleString("pt-BR");
  }

  function formatarData(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  function textoCelula(v) {
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  }

  function escaparHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* -------------------------------------------------------------------------
  Fetch com timeout + retry
  ------------------------------------------------------------------------- */
  function fetchComTimeout(url, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }))
      .finally(() => clearTimeout(timer));
  }

  async function fetchComRetry(url, opts) {
    let ultimoErro;
    for (let i = 1; i <= TENTATIVAS; i++) {
      try {
        const resp = await fetchComTimeout(url, opts);
        if (!resp.ok) throw new Error("HTTP " + resp.status + " em " + url);
        return resp;
      } catch (e) {
        ultimoErro = e;
        if (i < TENTATIVAS) {
          await new Promise((r) => setTimeout(r, 500 * i));
        }
      }
    }
    throw ultimoErro;
  }

  async function carregarJSON(caminho) {
    const resp = await fetchComRetry(caminho, { cache: "no-store" });
    return resp.json();
  }

  async function carregarCSV(caminho) {
    const resp = await fetchComRetry(caminho, { cache: "no-store" });
    let texto = await resp.text();
    if (texto.charCodeAt(0) === 0xFEFF) {
      texto = texto.slice(1);
    }
    return new Promise((resolve, reject) => {
      Papa.parse(texto, {
        header: true,
        delimiter: "",
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (h) => String(h).replace(/^\uFEFF/, "").trim(),
        complete: (res) => {
          if (res.errors && res.errors.length) {
            if (!res.data || res.data.length === 0) {
              return reject(new Error(
                "Falha ao interpretar " + caminho + ": " + res.errors[0].message
              ));
            }
          }
          const dados = (res.data || []).filter((linha) =>
            Object.values(linha).some((v) => v !== null && v !== "" && v !== undefined)
          );
          resolve(dados);
        },
        error: (err) => reject(err),
      });
    });
  }

  /* -------------------------------------------------------------------------
  Helpers de tabela
  ------------------------------------------------------------------------- */
  function colspanDe(tbody) {
    const tabela = tbody.closest("table");
    if (!tabela) return 1;
    const ths = $$("thead th", tabela);
    return ths.length || 1;
  }

  function mostrarCarregando(tbody) {
    if (!tbody) return;
    tbody.innerHTML =
      '<tr class="linha-carregando"><td colspan="' + colspanDe(tbody) +
      '" class="carregando">Carregando…</td></tr>';
  }

  function mostrarErro(tbody, mensagem, arquivo) {
    if (!tbody) return;
    const link = arquivo
      ? ' Você pode baixar o arquivo diretamente: <a href="' +
        escaparHTML(arquivo) + '" download>' + escaparHTML(arquivo) + "</a>."
      : "";
    tbody.innerHTML =
      '<tr><td colspan="' + colspanDe(tbody) + '" class="aviso-erro">⚠️ ' +
      escaparHTML(mensagem) + link + "</td></tr>";
  }

  function mostrarVazio(tbody, arquivo) {
    if (!tbody) return;
    const link = arquivo
      ? ' Baixe o arquivo para conferir: <a href="' +
        escaparHTML(arquivo) + '" download>' + escaparHTML(arquivo) + "</a>."
      : "";
    tbody.innerHTML =
      '<tr><td colspan="' + colspanDe(tbody) + '" class="aviso-vazio">' +
      "Nenhum registro encontrado. " + link + "</td></tr>";
  }

  /* -------------------------------------------------------------------------
  Cabeçalho — período
  ------------------------------------------------------------------------- */
  async function renderizarCabecalhoPeriodo() {
    const el = document.getElementById("cabecalho-periodo");
    if (!el) return;
    try {
      const k = await carregarJSON("dados/kpis.json");
      const d = k.dados || k;
      const p = d.periodo || {};
      el.innerHTML =
        "<strong>Período:</strong> " + (p.inicio || "—") + " a " + (p.fim || "—") +
        " · <strong>" + (p.meses_cobertos || 0) + " meses</strong>";
    } catch (e) {
      el.innerHTML = "<strong>Período:</strong> —";
    }
  }

  /* -------------------------------------------------------------------------
  Selo de auditoria (dinâmico)
  ------------------------------------------------------------------------- */
  async function renderizarSelo() {
    const alvo = $("#selo-conteudo");
    if (!alvo) return;
    try {
      const aud = await carregarJSON("dados/auditoria.json");
      const d = aud.dados || aud;
      const per = d.periodo_coberto || {};
      const q = d.qualidade || {};
      const al = d.alertas || {};

      const regNc = Array.isArray(al.codigos_regime_nao_mapeados) ? al.codigos_regime_nao_mapeados : [];
      const secNc = Array.isArray(al.secretarias_nao_mapeadas) ? al.secretarias_nao_mapeadas : [];
      const escNc = Array.isArray(al.escolaridades_nao_mapeadas) ? al.escolaridades_nao_mapeadas : [];
      const totalPendencias = regNc.length + secNc.length + escNc.length;
      const status = totalPendencias === 0 ? "Auditoria em dia" : "Pendências de classificação";

      const itens = [
        ["Última extração", formatarData(d.gerado_em)],
        ["Período coberto", (per.inicio || "—") + " a " + (per.fim || "—")],
        ["Meses cobertos", formatarNumero(per.total_meses)],
        ["Registros brutos", formatarNumero(q.registros_brutos)],
        ["Múltiplos vínculos", formatarNumero(q.registros_multivinculo)],
        ["Registros únicos", formatarNumero(q.registros_liquidos)],
        ["Matrículas únicas", formatarNumero(q.matriculas_unicas)],
        ["Secretarias canônicas", formatarNumero(q.secretarias)],
        ["Status", status],
      ];

      let blocoAlertas = "";
      if (totalPendencias === 0) {
        blocoAlertas =
          '<div class="ok"><strong>Auditoria em dia.</strong> ' +
          "Todos os códigos de regime, secretarias e escolaridades do portal foram mapeados. " +
          "Nenhuma pendência de classificação.</div>";
      } else {
        const detalhes = [];
        if (regNc.length) detalhes.push(regNc.length + " código(s) de regime");
        if (secNc.length) detalhes.push(secNc.length + " secretaria(s)");
        if (escNc.length) detalhes.push(escNc.length + " escolaridade(s)");
        blocoAlertas =
          '<div class="alerta"><strong>Atenção:</strong> foram detectadas pendências de classificação em ' +
          escaparHTML(detalhes.join(", ")) +
          ". Consulte os mapas públicos abaixo para detalhes.</div>";
      }

      alvo.innerHTML = itens.map(function (par) {
        return "<div><dt>" + escaparHTML(par[0]) + "</dt><dd>" +
          escaparHTML(textoCelula(par[1])) + "</dd></div>";
      }).join("") + blocoAlertas;
    } catch (e) {
      console.error("[sobre] Erro ao carregar auditoria:", e);
      alvo.innerHTML =
        '<div class="carregando">Não foi possível carregar o selo de auditoria. ' +
        '<a href="dados/auditoria.json" download>Baixar JSON</a>.</div>';
    }
  }

  /* -------------------------------------------------------------------------
  Fonte dos dados (kpis.json)
  ------------------------------------------------------------------------- */
  async function renderizarFonte() {
    const alvo = $("#fonte-dados");
    if (!alvo) return;
    try {
      const kpis = await carregarJSON("dados/kpis.json");
      const d = kpis.dados || kpis;
      const per = d.periodo || {};
      const tot = d.totais || {};

      const periodoTexto = (per.inicio || "—") + " a " + (per.fim || "—");
      const mesesTexto = per.meses_cobertos != null
        ? formatarNumero(per.meses_cobertos) + " meses"
        : "—";

      const itens = [
        ["Período coberto", periodoTexto],
        ["Última atualização", formatarData(d.gerado_em)],
        ["Total de meses", mesesTexto],
        ["Registros totais", formatarNumero(tot.registros_totais)],
        ["Matrículas únicas", formatarNumero(tot.matriculas_unicas)],
        ["Fonte", "Portal da Transparência de Sorocaba"],
      ];

      alvo.innerHTML = itens.map(function (par) {
        return "<div><dt>" + escaparHTML(par[0]) + "</dt><dd>" +
          escaparHTML(textoCelula(par[1])) + "</dd></div>";
      }).join("");
    } catch (e) {
      console.error("[sobre] Erro ao carregar kpis:", e);
      alvo.innerHTML =
        '<div class="carregando">Não foi possível carregar os metadados. ' +
        '<a href="dados/kpis.json" download>Baixar JSON</a>.</div>';
    }
  }

  /* -------------------------------------------------------------------------
  Cobertura da análise de gênero
  ------------------------------------------------------------------------- */
  async function renderizarCoberturaGenero() {
    const alvo = $("#cobertura-genero");
    if (!alvo) return;
    try {
      const geral = await carregarCSV("dados/genero_geral.csv");

      let total = 0, definidos = 0, indefinidos = 0, fem = 0, masc = 0;
      geral.forEach((r) => {
        const g = String(r.genero_inferido || "").trim().toLowerCase();
        const n = Number(r.num_matriculas) || 0;
        total += n;
        if (g === "feminino") { fem += n; definidos += n; }
        else if (g === "masculino") { masc += n; definidos += n; }
        else if (g === "indefinido") { indefinidos += n; }
      });

      const cobertura = total > 0 ? (definidos / total) * 100 : 0;
      const pctIndef = total > 0 ? (indefinidos / total) * 100 : 0;

      const itens = [
        ["Matrículas no período", formatarNumero(total)],
        ["Classificadas como F/M", formatarNumero(definidos)],
        ["Indefinidas (excluídas)", formatarNumero(indefinidos)],
        ["Cobertura da análise", cobertura.toFixed(1).replace(".", ",") + "%"],
        ["Feminino", formatarNumero(fem)],
        ["Masculino", formatarNumero(masc)],
      ];

      alvo.innerHTML = itens.map(function (par) {
        return "<div><dt>" + escaparHTML(par[0]) + "</dt><dd>" +
          escaparHTML(textoCelula(par[1])) + "</dd></div>";
      }).join("");

      const pai = alvo.parentElement;
      if (pai) {
        const existente = pai.querySelector(".aviso-metodologico.cobertura-nota");
        if (existente) existente.remove();

        const nota = document.createElement("div");
        nota.className = "aviso-metodologico cobertura-nota";
        nota.style.marginTop = "1rem";
        nota.innerHTML =
          "<strong>Nota:</strong> " + pctIndef.toFixed(1).replace(".", ",") +
          "% das matrículas ficaram como indefinidas. Essas matrículas <strong>não entram</strong> nos cruzamentos. " +
          "A análise cobre " + cobertura.toFixed(1).replace(".", ",") + "% do total.";
        pai.appendChild(nota);
      }
    } catch (e) {
      console.error("[sobre] Erro ao carregar cobertura de gênero:", e);
      alvo.innerHTML =
        '<div class="carregando">Não foi possível carregar a cobertura de gênero. ' +
        '<a href="dados/excel/genero_geral.xlsx" download>Baixar XLSX</a>.</div>';
    }
  }

  /* -------------------------------------------------------------------------
  Mapa de regimes
  ------------------------------------------------------------------------- */
  let regimesDados = [];
  async function carregarRegimes() {
    const tbody = $("#tabela-regimes tbody");
    if (!tbody) return;
    mostrarCarregando(tbody);
    try {
      const dados = await carregarCSV("dados/regime_map.csv");
      if (!dados.length) return mostrarVazio(tbody, "dados/excel/regime_map.xlsx");
      regimesDados = dados;
      renderizarTabelaRegimes(dados);
    } catch (e) {
      console.error("[sobre] Erro regimes:", e);
      mostrarErro(tbody, "Não foi possível carregar o mapa de regimes.", "dados/excel/regime_map.xlsx");
    }
  }

  function renderizarTabelaRegimes(lista) {
    const tbody = $("#tabela-regimes tbody");
    if (!tbody) return;
    if (!lista || lista.length === 0) return mostrarVazio(tbody, "dados/excel/regime_map.xlsx");
    tbody.innerHTML = lista.map(function (r) {
      const cru = r.regime_cru || r.regime || r.codigo || "";
      const base = r.regime_base || r.base || "";
      const sub = r.regime_subgrupo || r.subgrupo || "";
      const fund = r.fundamentacao || r.fundamento || "";
      const obs = r.observacao || r.obs || "";
      return "<tr>" +
        "<td>" + escaparHTML(textoCelula(cru)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(base)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(sub)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(fund)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(obs)) + "</td>" +
        "</tr>";
    }).join("");
  }

  function configurarBuscaRegime() {
    const input = $("#busca-regime");
    if (!input) return;
    input.addEventListener("input", function () {
      const termo = input.value.trim().toLowerCase();
      if (!termo) return renderizarTabelaRegimes(regimesDados);
      const filtrado = regimesDados.filter(function (r) {
        return Object.values(r).join(" ").toLowerCase().indexOf(termo) !== -1;
      });
      renderizarTabelaRegimes(filtrado);
    });
  }

  /* -------------------------------------------------------------------------
  Mapa de secretarias
  ------------------------------------------------------------------------- */
  let secretariasDados = [];
  async function carregarSecretarias() {
    const tbody = $("#tabela-secretarias-mapa tbody");
    if (!tbody) return;
    mostrarCarregando(tbody);
    try {
      const dados = await carregarCSV("dados/secretaria_map.csv");
      if (!dados.length) return mostrarVazio(tbody, "dados/excel/secretaria_map.xlsx");
      secretariasDados = dados;
      renderizarTabelaSecretarias(dados);
    } catch (e) {
      console.error("[sobre] Erro secretarias:", e);
      mostrarErro(tbody, "Não foi possível carregar o mapa de secretarias.", "dados/excel/secretaria_map.xlsx");
    }
  }

  function renderizarTabelaSecretarias(lista) {
    const tbody = $("#tabela-secretarias-mapa tbody");
    if (!tbody) return;
    if (!lista || lista.length === 0) return mostrarVazio(tbody, "dados/excel/secretaria_map.xlsx");
    tbody.innerHTML = lista.map(function (r) {
      const cru = r.secretaria_crua || r.secretaria_cru || r.nome_cru || "";
      const canon = r.secretaria_canonica || r.nome_canonico || "";
      const sigla = r.sigla || "";
      return "<tr>" +
        "<td>" + escaparHTML(textoCelula(cru)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(canon)) + "</td>" +
        "<td>" + escaparHTML(textoCelula(sigla)) + "</td>" +
        "</tr>";
    }).join("");
  }

  function configurarBuscaSecretaria() {
    const input = $("#busca-secretaria");
    if (!input) return;
    input.addEventListener("input", function () {
      const termo = input.value.trim().toLowerCase();
      if (!termo) return renderizarTabelaSecretarias(secretariasDados);
      const filtrado = secretariasDados.filter(function (r) {
        return Object.values(r).join(" ").toLowerCase().indexOf(termo) !== -1;
      });
      renderizarTabelaSecretarias(filtrado);
    });
  }

  /* -------------------------------------------------------------------------
  Mapa de escolaridades
  ------------------------------------------------------------------------- */
  async function carregarEscolaridades() {
    const tbody = $("#tabela-escolaridades tbody");
    if (!tbody) return;
    mostrarCarregando(tbody);
    try {
      const dados = await carregarCSV("dados/escolaridade_map.csv");
      if (!dados.length) return mostrarVazio(tbody, "dados/excel/escolaridade_map.xlsx");

      dados.sort(function (a, b) {
        const oa = Number(a.ordem || a.order || 0);
        const ob = Number(b.ordem || b.order || 0);
        return oa - ob;
      });

      tbody.innerHTML = dados.map(function (r) {
        const cru = r.escolaridade_crua || r.escolaridade_cru || "";
        const canon = r.escolaridade_canonica || r.canonico || "";
        const ordem = r.ordem || r.order || "";
        return "<tr>" +
          "<td>" + escaparHTML(textoCelula(cru)) + "</td>" +
          "<td>" + escaparHTML(textoCelula(canon)) + "</td>" +
          '<td class="numerico">' + escaparHTML(textoCelula(ordem)) + "</td>" +
          "</tr>";
      }).join("");
    } catch (e) {
      console.error("[sobre] Erro escolaridades:", e);
      mostrarErro(tbody, "Não foi possível carregar o mapa de escolaridades.", "dados/excel/escolaridade_map.xlsx");
    }
  }

  /* -------------------------------------------------------------------------
  Rodapé
  ------------------------------------------------------------------------- */
  async function atualizarRodape() {
    const alvo = document.querySelector("#rodape-atualizacao");
    if (!alvo) return;
    try {
      const kpis = await carregarJSON("dados/kpis.json");
      const d = kpis.dados || kpis;
      alvo.textContent = "Atualizado em: " + formatarData(d.gerado_em);
    } catch (e) {
      alvo.textContent = "—";
    }
  }

  /* -------------------------------------------------------------------------
  Bootstrap
  ------------------------------------------------------------------------- */
  function init() {
    renderizarCabecalhoPeriodo();
    renderizarSelo();
    renderizarFonte();
    renderizarCoberturaGenero();
    carregarRegimes().then(configurarBuscaRegime);
    carregarSecretarias().then(configurarBuscaSecretaria);
    carregarEscolaridades();
    atualizarRodape();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();