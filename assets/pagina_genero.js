/* =========================================================================
Pagina Genero — v8
Novo: painel de detalhe + nota nos 4 gráficos (liderança, categoria,
secretaria, gap)
========================================================================= */
const estadoGen = { geral: [], porCategoria: [], porSecretaria: [], faixaSalarial: [], lideranca: [], evolucao: [], gap: [], kpis: null, auditoria: null, graficos: {} };
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const ROTULOS_GRUPO_GENERO = {
  efetivos: "Efetivos e empregados públicos", funcao_confianca: "Efetivos em função de confiança",
  comissionados: "Cargos em comissão", flexiveis: "Temporários, estagiários e eventuais",
  inativos: "Inativos e pensionistas",
};
const COR_GENERO_FEM = "#2e7d32";
const COR_GENERO_MASC = "#414487";
function temPaletas() { return window.Paletas && typeof Paletas.ligarDetalhe === "function"; }

async function inicializar() {
  try {
    const [geral, porCategoria, porSecretaria, faixaSalarial, lideranca, evolucao, gap, kpis, auditoria] = await Promise.all([
      carregarCSV("dados/genero_geral.csv"),
      carregarCSV("dados/genero_por_categoria.csv"),
      carregarCSV("dados/genero_por_secretaria.csv"),
      carregarCSV("dados/genero_faixa_salarial.csv"),
      carregarCSV("dados/genero_lideranca.csv"),
      carregarCSV("dados/genero_evolucao_mensal.csv"),
      carregarCSV("dados/genero_gap_salarial.csv"),
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
    ]);
    geral.forEach((r) => { ["num_matriculas","num_registros","folha_total","folha_media","folha_mediana","percentual_matriculas","percentual_folha"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    porCategoria.forEach((r) => { ["num_matriculas","num_registros","folha_total","folha_media","total_matriculas","pct_feminino"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    porSecretaria.forEach((r) => { ["num_matriculas","folha_total","folha_media","total_matriculas","pct_feminino"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    faixaSalarial.forEach((r) => { ["num_matriculas","folha_media"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    lideranca.forEach((r) => { ["total","feminino","pct_feminino"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    evolucao.forEach((r) => {
      r.feminino = num(r.feminino); r.masculino = num(r.masculino); r.indefinido = num(r.indefinido);
      r.total = r.feminino + r.masculino + r.indefinido;
      r.pct_feminino = r.total > 0 ? (r.feminino / r.total) * 100 : 0;
    });
    gap.forEach((r) => { ["num_matriculas_feminino","num_matriculas_masculino","folha_media_feminino","folha_media_masculino","gap_absoluto","gap_percentual"].forEach((c) => { if (c in r) r[c] = num(r[c]); }); });
    Object.assign(estadoGen, { geral, porCategoria, porSecretaria, faixaSalarial, lideranca, evolucao, gap, kpis, auditoria });
    renderizarCabecalhoPeriodo(kpis);
    renderizarCoberturaGenero();
    renderizarInsights();
    renderizarGraficoGeral();
    renderizarGraficoEvolucao();
    renderizarTabelaGeral();
    renderizarLideranca();
    renderizarCategoria();
    renderizarSecretaria();
    renderizarGap();
    renderizarFaixaSalarial();
    renderizarSelo(auditoria);
  } catch (e) {
    console.error("[genero] Erro:", e);
    const main = document.querySelector("main");
    if (main) main.innerHTML = `<div class="erro" role="alert"><strong>Não foi possível carregar os dados de gênero.</strong><br><small>${e.message}</small></div>`;
  }
}

function renderizarCabecalhoPeriodo(kpis) {
  const el = document.getElementById("cabecalho-periodo");
  if (!el || !kpis) return;
  const p = kpis.periodo || {};
  el.innerHTML = `<strong>Período:</strong> ${p.inicio || "-"} a ${p.fim || "-"} &nbsp;·&nbsp; <strong>${p.meses_cobertos || 0} meses</strong>`;
}

function renderizarCoberturaGenero() {
  const alvo = document.getElementById("cobertura-genero-conteudo");
  if (!alvo) return;
  try {
    let total = 0, definidos = 0, indefinidos = 0, fem = 0, masc = 0;
    estadoGen.geral.forEach((r) => {
      const g = String(r.genero_inferido || "").trim().toLowerCase();
      const n = num(r.num_matriculas);
      total += n;
      if (g === "feminino") { fem += n; definidos += n; }
      else if (g === "masculino") { masc += n; definidos += n; }
      else if (g === "indefinido") { indefinidos += n; }
    });
    const cobertura = total > 0 ? (definidos / total) * 100 : 0;
    const pctIndef = total > 0 ? (indefinidos / total) * 100 : 0;
    alvo.innerHTML = [
      ["Matrículas únicas no período", fmtNum.format(total)],
      ["Classificadas como F/M", fmtNum.format(definidos)],
      ["Indefinidas (excluídas)", fmtNum.format(indefinidos)],
      ["Cobertura da análise", cobertura.toFixed(1).replace(".", ",") + "%"],
      ["Feminino", fmtNum.format(fem)],
      ["Masculino", fmtNum.format(masc)],
    ].map((p) => `<div><dt>${p[0]}</dt><dd>${p[1]}</dd></div>`).join("");
    let nota = alvo.parentElement.querySelector(".aviso-metodologico.cobertura-nota");
    if (!nota) {
      nota = document.createElement("div");
      nota.className = "aviso-metodologico cobertura-nota";
      nota.style.marginTop = "1rem";
      alvo.parentElement.appendChild(nota);
    }
    nota.innerHTML = `<strong>Nota:</strong> ${pctIndef.toFixed(1).replace(".", ",")}% das matrículas ficaram como indefinidas. A análise cobre ${cobertura.toFixed(1).replace(".", ",")}% do total.`;
  } catch (e) {
    alvo.innerHTML = '<div class="carregando">Não foi possível carregar a cobertura.</div>';
  }
}

function renderizarInsights() {
  const el = document.getElementById("insights");
  if (!el) return;
  const f = estadoGen.geral.find((x) => x.genero_inferido === "feminino") || {};
  const pctFemGeral = num(f.percentual_matriculas);
  const lidLid = estadoGen.lideranca.find((x) => x.categoria === "lideranca") || {};
  const lidNao = estadoGen.lideranca.find((x) => x.categoria === "nao_lideranca") || {};
  const pctLid = num(lidLid.pct_feminino);
  const pctNaoLid = num(lidNao.pct_feminino);
  const comissionados = estadoGen.porCategoria.find((x) => x.regime_subgrupo === "comissionados") || {};
  const flexiveis = estadoGen.porCategoria.find((x) => x.regime_subgrupo === "flexiveis") || {};
  const gaps = estadoGen.gap.filter((x) => x.gap_percentual > 0 && x.num_matriculas_feminino >= 10 && x.num_matriculas_masculino >= 10);
  const gapMedio = gaps.length ? (gaps.reduce((s, x) => s + x.gap_percentual, 0) / gaps.length).toFixed(1).replace(".", ",") : "-";
  el.innerHTML = `
    <div class="kpi destaque"><div class="rotulo">Base do quadro</div><div class="valor">${pctFemGeral.toFixed(1).replace(".", ",")}%</div><div class="detalhe">das matrículas são de mulheres</div></div>
    <div class="kpi alerta"><div class="rotulo">Liderança</div><div class="valor">${pctLid.toFixed(1).replace(".", ",")}%</div><div class="detalhe">na base não-liderança são ${pctNaoLid.toFixed(1).replace(".", ",")}%</div></div>
    <div class="kpi alerta"><div class="rotulo">Comissão</div><div class="valor">${num(comissionados.pct_feminino).toFixed(1).replace(".", ",")}%</div><div class="detalhe">das nomeações políticas</div></div>
    <div class="kpi alerta"><div class="rotulo">Vínculos precários</div><div class="valor">${num(flexiveis.pct_feminino).toFixed(1).replace(".", ",")}%</div><div class="detalhe">de temporários e estagiários</div></div>
    <div class="kpi alerta"><div class="rotulo">Gap salarial médio</div><div class="valor">${gapMedio}%</div><div class="detalhe">diferença por cargo</div></div>
  `;
  const elLid = document.getElementById("insight-lideranca");
  if (elLid) elLid.innerHTML = `As mulheres são <strong>${pctNaoLid.toFixed(1).replace(".", ",")}%</strong> dos servidores em funções não-liderança, mas ocupam apenas <strong>${pctLid.toFixed(1).replace(".", ",")}%</strong> dos cargos de liderança.`;
  const elGap = document.getElementById("insight-gap");
  if (elGap) elGap.innerHTML = `Análise restrita a <strong>${gaps.length}</strong> cargos com pelo menos 10 servidores de cada gênero. Gap médio: <strong>${gapMedio}%</strong> a favor dos homens.`;
}

function renderizarGraficoGeral() {
  const ctx = document.getElementById("grafico-geral");
  if (!ctx) return;
  const dados = estadoGen.geral.filter((x) => x.genero_inferido !== "indefinido");
  const labels = dados.map((x) => x.genero_inferido === "feminino" ? "Feminino" : "Masculino");
  const valores = dados.map((x) => x.num_matriculas);
  const cores = dados.map((x) => x.genero_inferido === "feminino" ? COR_GENERO_FEM : COR_GENERO_MASC);
  if (estadoGen.graficos.geral) estadoGen.graficos.geral.destroy();
  estadoGen.graficos.geral = graficoRosca(ctx, labels, valores, cores);
}

function renderizarGraficoEvolucao() {
  const ctx = document.getElementById("grafico-evolucao");
  if (!ctx || !window.SerieInterativa) return;
  const dados = [...estadoGen.evolucao].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  const ctrl = SerieInterativa.criarGenerica(ctx, {
    valFormat: (v) => v.toFixed(1).replace(".", ",") + "%",
    tickFormat: (v) => v.toFixed(0) + "%",
    yTitle: "% de mulheres", beginAtZero: false,
    referencia: { valor: 50, rotulo: "Paridade (50%)", cor: "#cc0000" },
  });
  estadoGen.graficos.evolucao = ctrl.chart;
  ctrl.definir({
    periodos: dados.map((d) => ({ ano: d.ano, mes: d.mes })),
    series: [{ label: "Mulheres entre as matrículas", dados: dados.map((d) => d.pct_feminino), cor: SerieInterativa.CATEGORICAS[0] }],
    ariaLabel: "Evolução mensal da participação feminina. Linha tracejada marca paridade (50%).",
  });
  if (temPaletas()) {
    Paletas.nota(ctx, "Linha tracejada = paridade de 50%. Acima da linha: mais mulheres que homens; abaixo: menos.");
  }
}

function renderizarTabelaGeral() {
  const tbody = document.querySelector("#tabela-geral tbody");
  if (!tbody) return;
  const dados = [...estadoGen.geral].sort((a, b) => b.num_matriculas - a.num_matriculas);
  tbody.innerHTML = dados.map((d) => {
    const rot = d.genero_inferido === "feminino" ? "Feminino" : d.genero_inferido === "masculino" ? "Masculino" : "Indefinido";
    return `<tr><td>${rot}</td><td class="numerico">${fmtNum.format(d.num_matriculas)}</td><td class="numerico">${fmtPct(d.percentual_matriculas)}</td><td class="numerico">${fmtBRL.format(d.folha_total)}</td><td class="numerico">${fmtPct(d.percentual_folha)}</td><td class="numerico">${fmtBRL.format(d.folha_media)}</td></tr>`;
  }).join("");
}

function renderizarLideranca() {
  const ctx = document.getElementById("grafico-lideranca");
  if (!ctx) return;
  const rotulos = { geral: "Base geral", nao_lideranca: "Não-liderança", lideranca: "Liderança" };
  const dados = estadoGen.lideranca.filter((x) => rotulos[x.categoria])
    .sort((a, b) => ({ geral: 0, nao_lideranca: 1, lideranca: 2 })[a.categoria] - ({ geral: 0, nao_lideranca: 1, lideranca: 2 })[b.categoria]);
  const labels = dados.map((x) => rotulos[x.categoria]);
  const valores = dados.map((x) => x.pct_feminino);
  const cores = dados.map((x) => temPaletas() ? Paletas.paridade(x.pct_feminino) : (x.pct_feminino >= 50 ? COR_GENERO_FEM : CORES.amarelo));
  if (estadoGen.graficos.lideranca) estadoGen.graficos.lideranca.destroy();
  estadoGen.graficos.lideranca = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "% feminino", data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => `${i.parsed.y.toFixed(1).replace(".", ",")}% feminino` }}},
      scales: { y: { beginAtZero: true, max: 100, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => v + "%" }},
                x: { grid: { display: false }, ticks: { color: CORES.cinzaTexto }}},
    },
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoGen.graficos.lideranca, (i) => {
      const d = dados[i];
      return [labels[i], `${valores[i].toFixed(1).replace(".", ",")}% mulheres`, `${fmtNum.format(num(d.feminino))} de ${fmtNum.format(num(d.total))} matrículas`];
    });
    Paletas.nota(ctx, "Azul = acima da paridade (mais mulheres que homens); laranja = abaixo; cinza = perto de 50%.");
  }
}

function renderizarCategoria() {
  const ctx = document.getElementById("grafico-categoria");
  if (!ctx) return;
  const agrupado = {};
  estadoGen.porCategoria.forEach((r) => {
    const k = r.regime_subgrupo;
    if (!agrupado[k]) agrupado[k] = { regime_subgrupo: k, total_matriculas: num(r.total_matriculas), pct_feminino: num(r.pct_feminino), folha_total: 0, folha_media_fem: 0, folha_media_masc: 0 };
    agrupado[k].folha_total += num(r.folha_total);
    if (r.genero_inferido === "feminino") agrupado[k].folha_media_fem = num(r.folha_media);
    if (r.genero_inferido === "masculino") agrupado[k].folha_media_masc = num(r.folha_media);
  });
  const dados = Object.values(agrupado).filter((x) => ROTULOS_GRUPO_GENERO[x.regime_subgrupo]).sort((a, b) => b.pct_feminino - a.pct_feminino);
  const labels = dados.map((x) => ROTULOS_GRUPO_GENERO[x.regime_subgrupo]);
  const valores = dados.map((x) => x.pct_feminino);
  const cores = dados.map((x) => temPaletas() ? Paletas.paridade(x.pct_feminino) : (x.pct_feminino < 50 ? CORES.nc : COR_GENERO_FEM));
  if (estadoGen.graficos.categoria) estadoGen.graficos.categoria.destroy();
  estadoGen.graficos.categoria = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "% feminino", data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }]},
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => `${i.parsed.x.toFixed(1).replace(".", ",")}% feminino` }}},
      scales: { x: { beginAtZero: true, max: 100, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => v + "%" }},
                y: { grid: { display: false }, ticks: { color: CORES.cinzaTexto }}},
    },
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoGen.graficos.categoria, (i) => {
      const d = dados[i];
      return [labels[i], `${d.pct_feminino.toFixed(1).replace(".", ",")}% mulheres`, `${fmtNum.format(d.total_matriculas)} matrículas totais`];
    });
    Paletas.nota(ctx, "Azul = mais mulheres que homens; laranja = menos; cinza = perto da paridade.");
  }
  const tbody = document.querySelector("#tabela-categoria tbody");
  if (tbody) {
    tbody.innerHTML = dados.map((d) => `<tr><td>${ROTULOS_GRUPO_GENERO[d.regime_subgrupo]}</td><td class="numerico">${fmtNum.format(d.total_matriculas)}</td><td class="numerico">${fmtPct(d.pct_feminino)}</td><td class="numerico">${fmtBRLCompacto(d.folha_total)}</td><td class="numerico">${fmtBRL.format(d.folha_media_fem)}</td><td class="numerico">${fmtBRL.format(d.folha_media_masc)}</td></tr>`).join("");
  }
}

function renderizarSecretaria() {
  const ctx = document.getElementById("grafico-secretaria");
  if (!ctx) return;
  const porSec = {};
  estadoGen.porSecretaria.forEach((r) => {
    if (!porSec[r.secretaria]) porSec[r.secretaria] = { total: 0, fem: 0 };
    const n = num(r.num_matriculas);
    if (r.genero_inferido === "feminino") porSec[r.secretaria].fem += n;
    porSec[r.secretaria].total += n;
  });
  const dados = Object.entries(porSec).map(([sec, v]) => ({ secretaria: sec, pct: v.total > 0 ? (v.fem / v.total) * 100 : 0, total: v.total }))
    .filter((x) => x.total >= 20).sort((a, b) => b.pct - a.pct);
  const labels = dados.map((x) => x.secretaria);
  const valores = dados.map((x) => x.pct);
  const cores = dados.map((x) => temPaletas() ? Paletas.paridade(x.pct) : (x.pct < 30 ? CORES.nc : x.pct < 60 ? CORES.amarelo : COR_GENERO_FEM));
  if (estadoGen.graficos.secretaria) estadoGen.graficos.secretaria.destroy();
  estadoGen.graficos.secretaria = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "% feminino", data: valores, backgroundColor: cores, borderRadius: 4, borderSkipped: false }]},
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => { const d = dados[i.dataIndex]; return `${d.pct.toFixed(1).replace(".", ",")}% feminino (n=${fmtNum.format(d.total)})`; }}}},
      scales: { x: { beginAtZero: true, max: 100, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => v + "%" }},
                y: { grid: { display: false }, ticks: { color: CORES.cinzaTexto, font: { size: 10 }}}},
    },
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoGen.graficos.secretaria, (i) => {
      const d = dados[i];
      return [d.secretaria, `${d.pct.toFixed(1).replace(".", ",")}% mulheres`, `${fmtNum.format(d.total)} matrículas com gênero identificado`];
    });
    Paletas.nota(ctx, "Azul = mais mulheres que homens; laranja = menos; cinza = perto de 50%.");
  }
}

function renderizarGap() {
  const ctx = document.getElementById("grafico-gap");
  if (!ctx) return;
  const dados = estadoGen.gap.filter((x) => x.gap_percentual > 0 && x.num_matriculas_feminino >= 20 && x.num_matriculas_masculino >= 20)
    .sort((a, b) => b.gap_percentual - a.gap_percentual).slice(0, 25);
  const labels = dados.map((x) => x.cargo);
  const valores = dados.map((x) => x.gap_percentual);
  const cores = valores.map((v) => temPaletas() ? (v >= 20 ? "#cc0000" : v >= 10 ? "#d4a900" : "#2e7d32") : (v >= 20 ? CORES.nc : v >= 10 ? CORES.amarelo : COR_GENERO_FEM));
  if (estadoGen.graficos.gap) estadoGen.graficos.gap.destroy();
  estadoGen.graficos.gap = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Gap %", data: valores, backgroundColor: cores, borderRadius: 4, borderSkipped: false }]},
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => { const d = dados[i.dataIndex]; return `Gap: ${d.gap_percentual.toFixed(1).replace(".", ",")}% (F: ${fmtBRL.format(d.folha_media_feminino)} | M: ${fmtBRL.format(d.folha_media_masculino)})`; }}}},
      scales: { x: { beginAtZero: true, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => v + "%" }},
                y: { grid: { display: false }, ticks: { color: CORES.cinzaTexto, font: { size: 10 }}}},
    },
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoGen.graficos.gap, (i) => {
      const d = dados[i];
      return [
        d.cargo,
        `Diferença: ${d.gap_percentual.toFixed(1).replace(".", ",")}% a favor dos homens`,
        `Mulheres: ${fmtBRL.format(d.folha_media_feminino)} (${fmtNum.format(d.num_matriculas_feminino)} pessoas)`,
        `Homens: ${fmtBRL.format(d.folha_media_masculino)} (${fmtNum.format(d.num_matriculas_masculino)} pessoas)`,
      ];
    });
    Paletas.nota(ctx, "Cor = magnitude do gap: verde (<10%), amarelo (10-20%), vermelho (>=20%). Amostra: cargos com >= 20 servidores de cada gênero.");
  }
  const tbody = document.querySelector("#tabela-gap tbody");
  if (tbody) {
    const todos = [...estadoGen.gap].filter((x) => x.gap_percentual > 0 && x.num_matriculas_feminino >= 10 && x.num_matriculas_masculino >= 10).sort((a, b) => b.gap_percentual - a.gap_percentual);
    tbody.innerHTML = todos.map((d) => `<tr><td>${d.cargo}</td><td class="numerico">${fmtNum.format(d.num_matriculas_feminino)}</td><td class="numerico">${fmtNum.format(d.num_matriculas_masculino)}</td><td class="numerico">${fmtBRL.format(d.folha_media_feminino)}</td><td class="numerico">${fmtBRL.format(d.folha_media_masculino)}</td><td class="numerico"><strong>${fmtPct(d.gap_percentual)}</strong></td></tr>`).join("");
  }
}

function renderizarFaixaSalarial() {
  const ctx = document.getElementById("grafico-faixa");
  if (!ctx) return;
  const rotulos = { ate_2k: "Até R$ 2 mil", "2k_5k": "R$ 2-5 mil", "5k_10k": "R$ 5-10 mil", "10k_20k": "R$ 10-20 mil", acima_20k: "Acima de R$ 20 mil" };
  const ordem = ["ate_2k", "2k_5k", "5k_10k", "10k_20k", "acima_20k"];
  const fem = ordem.map((f) => { const r = estadoGen.faixaSalarial.find((x) => x.faixa_salarial === f && x.genero_inferido === "feminino"); return r ? num(r.num_matriculas) : 0; });
  const masc = ordem.map((f) => { const r = estadoGen.faixaSalarial.find((x) => x.faixa_salarial === f && x.genero_inferido === "masculino"); return r ? num(r.num_matriculas) : 0; });
  if (estadoGen.graficos.faixa) estadoGen.graficos.faixa.destroy();
  estadoGen.graficos.faixa = new Chart(ctx, {
    type: "bar",
    data: { labels: ordem.map((f) => rotulos[f]), datasets: [
      { label: "Feminino", data: fem, backgroundColor: COR_GENERO_FEM, borderRadius: 4, borderSkipped: false },
      { label: "Masculino", data: masc, backgroundColor: COR_GENERO_MASC, borderRadius: 4, borderSkipped: false },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 }},
                 tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${fmtNum.format(i.parsed.y)}`}}},
      scales: { x: { grid: { display: false }, ticks: { color: CORES.cinzaTexto }},
                y: { beginAtZero: true, grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => fmtNumCompacto(v) }}},
    },
  });
}

document.addEventListener("DOMContentLoaded", inicializar);