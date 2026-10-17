/* =========================================================================
Pagina inicial — Raio-X do Quadro de Pessoal
v9: Top 15 secretarias (gráfico) + variação real 12m + KPIs animados +
    toggle Total↔Recorrente sem flash
========================================================================= */
const estadoInicial = {
  folhaMensalTotal: [], folhaMensalRecorrente: [], folhaMensalIPCA: [],
  visaoAtual: "total", graficos: {}, kpis: null, eventos: [], serie: null,
};
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
function temPaletas() { return window.Paletas && typeof Paletas.porPosicao === "function"; }

function calcularVariacaoNominal() {
  const d = estadoInicial.folhaMensalTotal;
  if (!d || d.length < 2) return 0;
  const p = num(d[0].folha_total), u = num(d[d.length - 1].folha_total);
  return p > 0 ? ((u / p) - 1) * 100 : 0;
}
function calcularVariacaoReal() {
  const d = estadoInicial.folhaMensalIPCA;
  if (!d || d.length < 2) return 0;
  const p = num(d[0].folha_real), u = num(d[d.length - 1].folha_real);
  return p > 0 ? ((u / p) - 1) * 100 : 0;
}

function renderizarCabecalhoPeriodo(kpis) {
  const el = document.getElementById("cabecalho-periodo");
  if (!el || !kpis) return;
  const p = kpis.periodo || {};
  const fmt = (s) => { const [a, m] = String(s).split("-").map(Number); return a && m ? rotuloPeriodo(a, m) : s; };
  el.innerHTML = `<strong>Período:</strong> ${fmt(p.inicio)} a ${fmt(p.fim)} &nbsp;·&nbsp; <strong>${p.meses_cobertos || 0} meses</strong>`;
}

function renderizarKPIs(kpis) {
  renderizarCabecalhoPeriodo(kpis);
  const ultimo = kpis.ultimo_mes || {}, totais = kpis.totais || {}, periodo = kpis.periodo || {};
  animarNumero(document.getElementById("kpi-folha-ultimo"), 0, num(ultimo.folha_bruta), (v) => fmtBRLCompacto(v));
  const elFolhaDet = document.getElementById("kpi-folha-ultimo-detalhe");
  if (elFolhaDet) elFolhaDet.textContent = (ultimo.ano && ultimo.mes) ? rotuloPeriodo(ultimo.ano, ultimo.mes) : "";
  animarNumero(document.getElementById("kpi-matriculas-ultimo"), 0, num(ultimo.matriculas), (v) => fmtNum.format(Math.round(v)));
  animarNumero(document.getElementById("kpi-ticket-medio"), 0, num(ultimo.ticket_medio), (v) => fmtBRL.format(v));
  animarNumero(document.getElementById("kpi-folha-total"), 0, num(totais.folha_bruta_total), (v) => fmtBRLCompacto(v));
  const elFolhaTotDet = document.getElementById("kpi-folha-total-detalhe");
  if (elFolhaTotDet) elFolhaTotDet.textContent = (periodo.meses_cobertos || 0) + " meses cobertos";
  const elVar = document.getElementById("kpi-variacao");
  if (elVar) elVar.textContent = calcularVariacaoNominal().toFixed(2).replace(".", ",") + "%";
  const elVarDet = document.getElementById("kpi-variacao-detalhe");
  if (elVarDet) elVarDet.textContent = "Nominal. Descontada a inflação (IPCA): +" + calcularVariacaoReal().toFixed(1).replace(".", ",") + "%";
  const elSec = document.getElementById("kpi-secretarias");
  if (elSec) elSec.textContent = fmtNum.format(num(totais.secretarias_unicas));
}

function renderizarGraficoMensal() {
  const ctx = document.getElementById("grafico-folha-mensal");
  if (!ctx || !window.SerieInterativa) return;
  const linhas = estadoInicial.visaoAtual === "total" ? estadoInicial.folhaMensalTotal : estadoInicial.folhaMensalRecorrente;
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

function atualizarSerieMensal() {
  // v9: toggle sem flash — só atualiza .data das séries existentes
  const linhas = estadoInicial.visaoAtual === "total" ? estadoInicial.folhaMensalTotal : estadoInicial.folhaMensalRecorrente;
  if (!linhas || !linhas.length || !estadoInicial.serie) return;
  const series = SerieInterativa.montarSeries(linhas, estadoInicial.folhaMensalIPCA);
  estadoInicial.serie.atualizarSeries(series);
}

function inicializarToggle() {
  const botoes = document.querySelectorAll("[data-modo]");
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modo = btn.getAttribute("data-modo");
      if (modo === estadoInicial.visaoAtual) return;
      estadoInicial.visaoAtual = modo;
      botoes.forEach((b) => { b.classList.toggle("ativo", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
      if (estadoInicial.serie && estadoInicial.serie.atualizarSeries) {
        atualizarSerieMensal();
      } else {
        renderizarGraficoMensal();
      }
      const ativo = document.querySelector("[data-periodo].ativo");
      if (ativo && estadoInicial.serie) estadoInicial.serie.periodo(Number(ativo.getAttribute("data-periodo")));
    });
  });
}

function renderizarComposicaoCategoria(dados) {
  if (!dados || !dados.length) return;
  const ultimoAno = Math.max(...dados.map((d) => num(d.ano)));
  const mesesUltimoAno = dados.filter((d) => num(d.ano) === ultimoAno).map((d) => num(d.mes));
  const ultimoMes = Math.max(...mesesUltimoAno);
  const ultimoSnapshot = dados.filter((d) => num(d.ano) === ultimoAno && num(d.mes) === ultimoMes)
    .map((d) => ({ ...d, folha_total: num(d.folha_total) })).sort((a, b) => b.folha_total - a.folha_total);
  const ctxRosca = document.getElementById("grafico-composicao-rosca");
  if (ctxRosca && ultimoSnapshot.length) {
    graficoRosca(ctxRosca, ultimoSnapshot.map((d) => window.ROTULOS_GRUPO[d.regime_subgrupo] || d.regime_subgrupo),
      ultimoSnapshot.map((d) => d.folha_total), ultimoSnapshot.map((d) => CORES_GRUPO[d.regime_subgrupo] || CORES.cinzaTexto));
  }
  const ctxLinha = document.getElementById("grafico-composicao-evolucao");
  if (!ctxLinha) return;
  const subgrupos = [...new Set(dados.map((d) => d.regime_subgrupo))];
  const periodos = [...new Set(dados.map((d) => `${num(d.ano)}-${String(num(d.mes)).padStart(2, "0")}`))].sort();
  const datasets = subgrupos.map((sg) => ({
    label: window.ROTULOS_GRUPO[sg] || sg,
    data: periodos.map((p) => { const [ano, mes] = p.split("-").map(Number); const l = dados.find((d) => num(d.ano) === ano && num(d.mes) === mes && d.regime_subgrupo === sg); return l ? num(l.folha_total) / 1e6 : 0; }),
    borderColor: CORES_GRUPO[sg] || CORES.cinzaTexto, backgroundColor: (CORES_GRUPO[sg] || CORES.cinzaTexto) + "22",
    borderWidth: 2, fill: false, tension: 0.25, pointRadius: 0, pointHoverRadius: 5,
  }));
  new Chart(ctxLinha, {
    type: "line", data: { labels: periodos.map((p) => { const [a, m] = p.split("-").map(Number); return rotuloPeriodo(a, m); }), datasets },
    options: { responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12, padding: 8 }},
        tooltip: { callbacks: { label: (i) => `${i.dataset.label}: R$ ${i.parsed.y.toFixed(1).replace(".", ",")} mi`}}},
      scales: { x: { grid: { display: false }, ticks: { color: CORES.cinzaTexto, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 }},
                y: { beginAtZero: true, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => "R$ " + v.toFixed(0) + " mi" }}},
    },
  });
}

function renderizarTopSecretariasGrafico(topSec, top = 15) {
  const ctx = document.getElementById("grafico-top-secretarias");
  if (!ctx || !topSec || !topSec.length) return;
  const recorte = topSec.slice(0, top);
  const labels = recorte.map((s) => s.secretaria.replace(/^Secretaria (d[aeo]s?) /, ""));
  const valores = recorte.map((s) => num(s.folha_total));
  const cores = temPaletas() ? Paletas.porPosicao(recorte.length) : recorte.map(() => CORES.azulClaro);
  if (estadoInicial.graficos.topSec) estadoInicial.graficos.topSec.destroy();
  estadoInicial.graficos.topSec = graficoBarras(ctx, labels, valores, {
    label: "Folha acumulada", horizontal: true, cor: cores,
    formatador: (v) => fmtBRLCompacto(v), eixoFormatador: (v) => fmtBRLCompacto(v),
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoInicial.graficos.topSec, (i) => {
      const s = recorte[i];
      return [s.secretaria, `Folha acumulada: ${fmtBRL.format(num(s.folha_total))}`, `Matrículas: ${fmtNum.format(num(s.num_matriculas))}`];
    });
    Paletas.nota(ctx, "Cor = posição no ranking. Barras mais escuras = maior folha acumulada. Toque numa barra para o detalhe.");
  }
}

function renderizarTopSecretariasTabela(topSec, top = 15) {
  if (!topSec || !topSec.length) return;
  const recorte = topSec.slice(0, top).map((s) => ({ ...s, folha_total: num(s.folha_total), folha_media_mensal: num(s.folha_media_mensal), percentual_folha: num(s.percentual_folha), num_matriculas: num(s.num_matriculas) }));
  const tbody = document.querySelector("#tabela-secretarias tbody");
  if (!tbody) return;
  tbody.innerHTML = recorte.map((s) => `<tr><td>${s.secretaria}</td><td class="numerico">${fmtBRL.format(s.folha_total)}</td><td class="numerico">${fmtBRL.format(s.folha_media_mensal)}</td><td class="numerico">${fmtPct(s.percentual_folha)}</td><td class="numerico">${fmtNum.format(s.num_matriculas)}</td></tr>`).join("");
}

function renderizarVariacaoReal() {
  const ctx = document.getElementById("grafico-variacao-real");
  if (!ctx) return;
  const ipca = estadoInicial.folhaMensalIPCA;
  if (!ipca || ipca.length < 13) return;
  const linhas = [];
  for (let i = 12; i < ipca.length; i++) {
    const atual = num(ipca[i].folha_real);
    const anterior = num(ipca[i - 12].folha_real);
    if (anterior > 0) {
      linhas.push({ ano: num(ipca[i].ano), mes: num(ipca[i].mes), variacao: ((atual / anterior) - 1) * 100 });
    }
  }
  const labels = linhas.map((l) => rotuloPeriodo(l.ano, l.mes));
  const valores = linhas.map((l) => l.variacao);
  const cores = valores.map((v) => temPaletas() ? Paletas.variacao(v) : (v >= 0 ? CORES.azulClaro : "#cc0000"));
  if (estadoInicial.graficos.varReal) estadoInicial.graficos.varReal.destroy();
  estadoInicial.graficos.varReal = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Variação real 12m", data: valores, backgroundColor: cores, borderColor: "rgba(26,26,26,0.2)", borderWidth: 1, borderRadius: 3 }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => (i.parsed.y >= 0 ? "+" : "") + i.parsed.y.toFixed(1).replace(".", ",") + "% ao ano" }}},
      scales: { x: { grid: { display: false }, ticks: { color: CORES.cinzaTexto, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 }},
                y: { grid: { color: CORES.cinzaBorda }, title: { display: true, text: "Variação real em 12 meses (%)", color: CORES.cinzaTexto },
                     ticks: { color: CORES.cinzaTexto, callback: (v) => v.toFixed(0) + "%" }}},
    },
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoInicial.graficos.varReal, (i) => {
      const l = linhas[i];
      return [rotuloPeriodo(l.ano, l.mes), `Variação real: ${(l.variacao >= 0 ? "+" : "") + l.variacao.toFixed(1).replace(".", ",")}% vs ${rotuloPeriodo(l.ano - 1, l.mes)}`];
    });
    Paletas.nota(ctx, "Azul = folha cresceu acima da inflação; laranja = encolheu em termos reais. Cada barra compara o mês com o mesmo mês do ano anterior.");
  }
}

async function inicializar() {
  try {
    const [kpis, auditoria, mensalTotal, mensalRecorrente, mensalIPCA, categoria, topSec, eventos] = await Promise.all([
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
      carregarCSV("dados/folha_mensal.csv"),
      carregarCSV("dados/folha_mensal_recorrente.csv"),
      carregarCSV("dados/folha_mensal_ipca.csv"),
      carregarCSV("dados/composicao_categoria_mes.csv"),
      carregarCSV("dados/top_secretarias.csv"),
      fetch("dados/eventos.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    const camposNum = ["folha_total","folha_liquida","num_registros","num_matriculas","ticket_medio","percentual"];
    [mensalTotal, mensalRecorrente].forEach((arr) => { arr.forEach((r) => camposNum.forEach((c) => { if (c in r) r[c] = num(r[c]); })); });
    mensalIPCA.forEach((r) => { ["folha_nominal","indice_ipca","fator_correcao","folha_real"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    estadoInicial.folhaMensalTotal = mensalTotal;
    estadoInicial.folhaMensalRecorrente = mensalRecorrente;
    estadoInicial.folhaMensalIPCA = mensalIPCA;
    estadoInicial.kpis = kpis;
    estadoInicial.eventos = Array.isArray(eventos) ? eventos : [];
    renderizarKPIs(kpis);
    renderizarGraficoMensal();
    inicializarToggle();
    renderizarComposicaoCategoria(categoria);
    renderizarTopSecretariasGrafico(topSec);
    renderizarTopSecretariasTabela(topSec);
    renderizarVariacaoReal();
    renderizarSelo(auditoria);
  } catch (e) {
    console.error("[inicial] Erro:", e);
    const main = document.querySelector("main");
    if (main) main.innerHTML = `<div class="erro" role="alert"><strong>Não foi possível carregar os dados.</strong><br><small>${e.message}</small></div>`;
  }
}

document.addEventListener("DOMContentLoaded", inicializar);