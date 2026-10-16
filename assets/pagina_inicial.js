/* =========================================================================
Pagina inicial — Raio-X do Quadro de Pessoal da Prefeitura de Sorocaba
v5 — Casa com os IDs do index.html atual
- KPIs individuais por ID (não recria o container)
- Toggle usa [data-modo] (não [data-visao])
- Gráfico de composição por categoria: rosca + evolução em linhas
- Tabela Top 15 secretarias
- Selo de auditoria
========================================================================= */

const estadoInicial = {
  folhaMensalTotal: [],
  folhaMensalRecorrente: [],
  folhaMensalIPCA: [],
  visaoAtual: "total",
  graficos: {},
  kpis: null,
  eventos: [],
  serie: null,
};

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/* -------------------------------------------------------------------------
Variações no período
------------------------------------------------------------------------- */
function calcularVariacaoNominal() {
  const dados = estadoInicial.folhaMensalTotal;
  if (!dados || dados.length < 2) return "—";
  const primeiro = num(dados[0].folha_total);
  const ultimo = num(dados[dados.length - 1].folha_total);
  if (primeiro === 0) return "—";
  return ((ultimo / primeiro - 1) * 100).toFixed(2).replace(".", ",");
}

function calcularVariacaoReal() {
  const dados = estadoInicial.folhaMensalIPCA;
  if (!dados || dados.length < 2) return "—";
  const primeiro = num(dados[0].folha_real);
  const ultimo = num(dados[dados.length - 1].folha_real);
  if (primeiro === 0) return "—";
  return ((ultimo / primeiro - 1) * 100).toFixed(1).replace(".", ",");
}

/* -------------------------------------------------------------------------
KPIs — preenche cada card pelo seu ID
------------------------------------------------------------------------- */
function renderizarCabecalhoPeriodo(kpis) {
  const el = document.getElementById("cabecalho-periodo");
  const p = kpis && kpis.periodo;
  if (!el || !p) return;
  const fmt = (s) => { const [a, m] = String(s).split("-").map(Number); return a && m ? rotuloPeriodo(a, m) : s; };
  el.innerHTML = `<strong>Período:</strong> ${fmt(p.inicio)} a ${fmt(p.fim)} &nbsp;·&nbsp; <strong>${p.meses_cobertos || 0} meses</strong>`;
}

function renderizarKPIs(kpis) {
  renderizarCabecalhoPeriodo(kpis);
  const ultimo = kpis.ultimo_mes || {};
  const totais = kpis.totais || {};
  const periodo = kpis.periodo || {};

  const elFolha = document.getElementById("kpi-folha-ultimo");
  if (elFolha) elFolha.textContent = fmtBRLCompacto(num(ultimo.folha_bruta));

  const elFolhaDet = document.getElementById("kpi-folha-ultimo-detalhe");
  if (elFolhaDet) {
    elFolhaDet.textContent = (ultimo.ano && ultimo.mes)
      ? rotuloPeriodo(ultimo.ano, ultimo.mes)
      : "";
  }

  const elMat = document.getElementById("kpi-matriculas-ultimo");
  if (elMat) elMat.textContent = fmtNum.format(num(ultimo.matriculas));

  const elTicket = document.getElementById("kpi-ticket-medio");
  if (elTicket) elTicket.textContent = fmtBRL.format(num(ultimo.ticket_medio));

  const elFolhaTot = document.getElementById("kpi-folha-total");
  if (elFolhaTot) elFolhaTot.textContent = fmtBRLCompacto(num(totais.folha_bruta_total));

  const elFolhaTotDet = document.getElementById("kpi-folha-total-detalhe");
  if (elFolhaTotDet) {
    elFolhaTotDet.textContent = (periodo.meses_cobertos || 0) + " meses cobertos";
  }

  const elVar = document.getElementById("kpi-variacao");
  if (elVar) elVar.textContent = calcularVariacaoNominal() + "%";
  const elVarDet = document.getElementById("kpi-variacao-detalhe");
  if (elVarDet) elVarDet.textContent = "Nominal. Descontada a inflação (IPCA): +" + calcularVariacaoReal() + "%";

  const elSec = document.getElementById("kpi-secretarias");
  if (elSec) elSec.textContent = fmtNum.format(num(totais.secretarias_unicas));
}

/* -------------------------------------------------------------------------
Gráfico mensal (Total x Recorrente)
------------------------------------------------------------------------- */
function renderizarGraficoMensal() {
  const ctx = document.getElementById("grafico-folha-mensal");
  if (!ctx || !window.SerieInterativa) return;
  const linhas = estadoInicial.visaoAtual === "total"
    ? estadoInicial.folhaMensalTotal
    : estadoInicial.folhaMensalRecorrente;
  if (!linhas || !linhas.length || !estadoInicial.folhaMensalIPCA.length) return;

  if (!estadoInicial.serie) {
    estadoInicial.serie = SerieInterativa.criar(ctx, {
      eventos: estadoInicial.eventos,
      elEventos: document.getElementById("serie-eventos"),
      elResumo: document.getElementById("serie-resumo"),
      elTabela: document.getElementById("serie-tabela"),
    });
    const botoesPeriodo = document.querySelectorAll("[data-periodo]");
    botoesPeriodo.forEach((btn) => btn.addEventListener("click", () => {
      botoesPeriodo.forEach((b) => { b.classList.toggle("ativo", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
      estadoInicial.serie.periodo(Number(btn.getAttribute("data-periodo")));
    }));
    const reset = document.getElementById("serie-reset");
    if (reset) reset.addEventListener("click", () => {
      botoesPeriodo.forEach((b) => { const t = b.getAttribute("data-periodo") === "0"; b.classList.toggle("ativo", t); b.setAttribute("aria-pressed", String(t)); });
      estadoInicial.serie.resetar();
    });
  }
  const series = SerieInterativa.montarSeries(linhas, estadoInicial.folhaMensalIPCA);
  estadoInicial.serie.definir(series, estadoInicial.visaoAtual === "total" ? "total" : "recorrente");
}

/* -------------------------------------------------------------------------
Alternância Total / Recorrente
------------------------------------------------------------------------- */
function inicializarToggle() {
  const botoes = document.querySelectorAll("[data-modo]");
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modo = btn.getAttribute("data-modo");
      if (modo === estadoInicial.visaoAtual) return;
      estadoInicial.visaoAtual = modo;
      botoes.forEach((b) => { b.classList.toggle("ativo", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
      renderizarGraficoMensal();
      const ativo = document.querySelector("[data-periodo].ativo");
      if (ativo) estadoInicial.serie.periodo(Number(ativo.getAttribute("data-periodo")));
    });
  });
}

/* -------------------------------------------------------------------------
Composição por categoria — rosca (último mês) + linhas (evolução)
------------------------------------------------------------------------- */
function renderizarComposicaoCategoria(dados) {
  if (!dados || !dados.length) return;

  // --- Snapshot do último mês (rosca) ---
  const ultimoAno = Math.max(...dados.map((d) => num(d.ano)));
  const mesesUltimoAno = dados
    .filter((d) => num(d.ano) === ultimoAno)
    .map((d) => num(d.mes));
  const ultimoMes = Math.max(...mesesUltimoAno);

  const ultimoSnapshot = dados
    .filter((d) => num(d.ano) === ultimoAno && num(d.mes) === ultimoMes)
    .map((d) => ({ ...d, folha_total: num(d.folha_total) }))
    .sort((a, b) => b.folha_total - a.folha_total);

  const ctxRosca = document.getElementById("grafico-composicao-rosca");
  if (ctxRosca && ultimoSnapshot.length) {
    graficoRosca(
      ctxRosca,
      ultimoSnapshot.map((d) => window.ROTULOS_GRUPO[d.regime_subgrupo] || d.regime_subgrupo),
      ultimoSnapshot.map((d) => d.folha_total),
      ultimoSnapshot.map((d) => CORES_GRUPO[d.regime_subgrupo] || CORES.cinzaTexto)
    );
  }

  // --- Evolução mensal por categoria (linhas) ---
  const ctxLinha = document.getElementById("grafico-composicao-evolucao");
  if (!ctxLinha) return;

  const subgrupos = [...new Set(dados.map((d) => d.regime_subgrupo))];
  const periodos = [...new Set(
    dados.map((d) => `${num(d.ano)}-${String(num(d.mes)).padStart(2, "0")}`)
  )].sort();

  const datasets = subgrupos.map((sg) => ({
    label: window.ROTULOS_GRUPO[sg] || sg,
    data: periodos.map((p) => {
      const [ano, mes] = p.split("-").map(Number);
      const linha = dados.find(
        (d) => num(d.ano) === ano && num(d.mes) === mes && d.regime_subgrupo === sg
      );
      return linha ? num(linha.folha_total) / 1e6 : 0;
    }),
    borderColor: CORES_GRUPO[sg] || CORES.cinzaTexto,
    backgroundColor: (CORES_GRUPO[sg] || CORES.cinzaTexto) + "22",
    borderWidth: 2,
    fill: false,
    tension: 0.25,
    pointRadius: 0,
    pointHoverRadius: 5,
  }));

  new Chart(ctxLinha, {
    type: "line",
    data: {
      labels: periodos.map((p) => {
        const [a, m] = p.split("-").map(Number);
        return rotuloPeriodo(a, m);
      }),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: (item) =>
              `${item.dataset.label}: R$ ${item.parsed.y.toFixed(1).replace(".", ",")} mi`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: CORES.cinzaTexto,
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 14,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: CORES.cinzaBorda },
          ticks: {
            color: CORES.cinzaTexto,
            callback: (v) => "R$ " + v.toFixed(0) + " mi",
          },
        },
      },
    },
  });
}

/* -------------------------------------------------------------------------
Tabela Top 15 secretarias
------------------------------------------------------------------------- */
function renderizarTopSecretarias(topSec, top = 15) {
  if (!topSec || !topSec.length) return;

  const recorte = topSec.slice(0, top).map((s) => ({
    ...s,
    folha_total: num(s.folha_total),
    folha_media_mensal: num(s.folha_media_mensal),
    percentual_folha: num(s.percentual_folha),
    num_matriculas: num(s.num_matriculas),
  }));

  const tbody = document.querySelector("#tabela-secretarias tbody");
  if (!tbody) return;

  tbody.innerHTML = recorte.map((s) =>
    `<tr>` +
      `<td>${s.secretaria}</td>` +
      `<td class="numerico">${fmtBRL.format(s.folha_total)}</td>` +
      `<td class="numerico">${fmtBRL.format(s.folha_media_mensal)}</td>` +
      `<td class="numerico">${fmtPct(s.percentual_folha)}</td>` +
      `<td class="numerico">${fmtNum.format(s.num_matriculas)}</td>` +
    `</tr>`
  ).join("");
}

/* -------------------------------------------------------------------------
Inicialização
------------------------------------------------------------------------- */
async function inicializar() {
  try {
    const [
      kpis,
      auditoria,
      mensalTotal,
      mensalRecorrente,
      mensalIPCA,
      categoria,
      topSec,
      eventos,
    ] = await Promise.all([
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
      carregarCSV("dados/folha_mensal.csv"),
      carregarCSV("dados/folha_mensal_recorrente.csv"),
      carregarCSV("dados/folha_mensal_ipca.csv"),
      carregarCSV("dados/composicao_categoria_mes.csv"),
      carregarCSV("dados/top_secretarias.csv"),
      fetch("dados/eventos.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);

    // Normalização numérica
    const camposNum = [
      "folha_total", "folha_liquida", "num_registros",
      "num_matriculas", "ticket_medio", "percentual",
    ];
    [mensalTotal, mensalRecorrente].forEach((arr) => {
      arr.forEach((r) => {
        camposNum.forEach((c) => { if (c in r) r[c] = num(r[c]); });
      });
    });
    mensalIPCA.forEach((r) => {
      r.folha_nominal = num(r.folha_nominal);
      r.indice_ipca = num(r.indice_ipca);
      r.fator_correcao = num(r.fator_correcao);
      r.folha_real = num(r.folha_real);
    });

    estadoInicial.folhaMensalTotal = mensalTotal;
    estadoInicial.folhaMensalRecorrente = mensalRecorrente;
    estadoInicial.folhaMensalIPCA = mensalIPCA;
    estadoInicial.kpis = kpis;
    estadoInicial.eventos = Array.isArray(eventos) ? eventos : [];

    // Renderização
    renderizarKPIs(kpis);
    renderizarGraficoMensal();
    inicializarToggle();
    renderizarComposicaoCategoria(categoria);
    renderizarTopSecretarias(topSec);
    renderizarSelo(auditoria);
  } catch (e) {
    console.error("[inicial] Erro ao carregar:", e);
    const main = document.querySelector("main");
    if (main) {
      main.innerHTML =
        `<div class="erro" role="alert">` +
        `<strong>Não foi possível carregar os dados.</strong><br>` +
        `Verifique se a pasta <code>dados/</code> existe e contém os arquivos do pipeline.<br>` +
        `<small>${e.message}</small>` +
        `</div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", inicializar);