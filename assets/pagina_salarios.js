/* =========================================================================
Pagina Salarios — Raio-X do Quadro de Pessoal da Prefeitura de Sorocaba
v9

Mudanças v9 (Fase 2, gráficos temporais):
  - Percentis: banda preenchida entre p10 e p90 (mostra a faixa salarial
    da "metade do quadro" sem precisar ler as linhas)
  - Gini: linha de referência em 0,50 + bandas de fundo (verde/amarelo/vermelho)
    que dão o "estado" do Gini sem repetir o eixo Y

Mudanças v8 (mantidas):
  - Histograma Viridis, painel de detalhe, nota
  - Salário por escolaridade e por tempo com Viridis

Depende de: app.js v8, serie_interativa.js v4, paletas.js v1
========================================================================= */

const estadoSal = {
  distribuicao: [],
  gini: [],
  histograma: [],
  salariosPerfil: [],
  kpis: null,
  auditoria: null,
  graficos: {},
};

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

function temPaletas() {
  return window.Paletas && typeof Paletas.porPosicao === "function";
}

function agregarPorDimensao(linhas, campoChave, nomeDimensao) {
  const mapa = {};
  linhas.forEach((r) => {
    const categoria = String(r[campoChave] || "").trim();
    if (!categoria) return;
    if (!mapa[categoria]) mapa[categoria] = { n: 0, somaPonderadaMedia: 0, somaPonderadaMediana: 0 };
    const n = num(r.n);
    mapa[categoria].n += n;
    mapa[categoria].somaPonderadaMedia += num(r.folha_media) * n;
    mapa[categoria].somaPonderadaMediana += num(r.folha_mediana) * n;
  });
  return Object.entries(mapa).map(([categoria, agg]) => ({
    dimensao: nomeDimensao, categoria, n: agg.n,
    folha_media: agg.n > 0 ? agg.somaPonderadaMedia / agg.n : 0,
    folha_mediana: agg.n > 0 ? agg.somaPonderadaMediana / agg.n : 0,
  }));
}

async function inicializar() {
  try {
    const [distribuicao, gini, histograma, salariosPerfil, kpis, auditoria] = await Promise.all([
      carregarCSV("dados/distribuicao_salarial.csv"),
      carregarCSV("dados/gini_mensal.csv"),
      carregarCSV("dados/histograma_salarial.csv"),
      carregarCSV("dados/salarios_por_perfil.csv"),
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
    ]);

    distribuicao.forEach((r) => {
      ["ano","mes","n","media","p10","p25","p50","p75","p90","p95","p99"]
        .forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    gini.forEach((r) => {
      ["ano","mes","n","gini"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    histograma.forEach((r) => {
      ["n","folha","ano","mes","largura_faixa"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    salariosPerfil.forEach((r) => {
      ["n","folha_media","folha_mediana"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });

    const perfisNormalizados = [
      ...agregarPorDimensao(salariosPerfil, "escolaridade_canonica", "escolaridade"),
      ...agregarPorDimensao(salariosPerfil, "faixa_tempo", "tempo_casa"),
    ];

    estadoSal.distribuicao = distribuicao.sort((a,b) => a.ano - b.ano || a.mes - b.mes);
    estadoSal.gini = gini.sort((a,b) => a.ano - b.ano || a.mes - b.mes);
    estadoSal.histograma = histograma;
    estadoSal.salariosPerfil = perfisNormalizados;
    estadoSal.kpis = kpis;
    estadoSal.auditoria = auditoria;

    renderizarCabecalhoPeriodo(kpis);
    renderizarPanorama();
    renderizarGraficoPercentis();
    renderizarGraficoGini();
    renderizarHistograma();
    renderizarSalariosPerfil();
    renderizarTabelaPercentis();
    renderizarSelo(auditoria);
  } catch (e) {
    console.error("[salarios] Erro ao carregar:", e);
    const main = document.querySelector("main");
    if (main) main.innerHTML = `<div class="erro" role="alert"><strong>Não foi possível carregar os dados de salários.</strong><br><small>${e.message}</small></div>`;
  }
}

function renderizarCabecalhoPeriodo(kpis) {
  const el = document.getElementById("cabecalho-periodo");
  if (!el || !kpis) return;
  const p = kpis.periodo || {};
  el.innerHTML = `<strong>Período:</strong> ${p.inicio || "-"} a ${p.fim || "-"} &nbsp;·&nbsp; <strong>${p.meses_cobertos || 0} meses</strong>`;
}

function renderizarPanorama() {
  const el = document.getElementById("kpis-salarios");
  if (!el) return;
  const dist = estadoSal.distribuicao;
  const gin = estadoSal.gini;
  if (!dist.length || !gin.length) return;
  const ultDist = dist[dist.length - 1];
  const ultGini = gin[gin.length - 1];
  const mesRef = rotuloPeriodo(ultDist.ano, ultDist.mes);

  el.innerHTML = `
    <div class="kpi">
      <div class="rotulo">Matrículas c/ Pagamento Mensal</div>
      <div class="valor">${fmtNum.format(ultDist.n)}</div>
      <div class="detalhe">${mesRef}</div>
    </div>
    <div class="kpi">
      <div class="rotulo">p10 (base 10%)</div>
      <div class="valor">${fmtBRL.format(ultDist.p10)}</div>
      <div class="detalhe">10% ganham abaixo deste valor</div>
    </div>
    <div class="kpi destaque">
      <div class="rotulo">Mediana (p50)</div>
      <div class="valor">${fmtBRL.format(ultDist.p50)}</div>
      <div class="detalhe">Metade ganha até aqui</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Média</div>
      <div class="valor">${fmtBRL.format(ultDist.media)}</div>
      <div class="detalhe">Soma dividida pelo número de matrículas</div>
    </div>
    <div class="kpi">
      <div class="rotulo">p90 (topo 10%)</div>
      <div class="valor">${fmtBRL.format(ultDist.p90)}</div>
      <div class="detalhe">Valor mínimo recebido pelos 10% mais bem remunerados</div>
    </div>
    <div class="kpi positivo">
      <div class="rotulo">Gini do mês</div>
      <div class="valor">${ultGini.gini.toFixed(3).replace(".", ",")}</div>
      <div class="detalhe">0 = igual; 1 = concentrado</div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
Percentis com banda p10→p90 (v9)
------------------------------------------------------------------------- */
function renderizarGraficoPercentis() {
  const ctx = document.getElementById("grafico-percentis");
  if (!ctx || !window.SerieInterativa) return;
  const dist = estadoSal.distribuicao;
  if (!dist.length) return;

  const ctrl = SerieInterativa.criarGenerica(ctx, {
    valFormat: (v) => fmtBRL.format(v),
    tickFormat: (v) => fmtBRLCompacto(v),
    beginAtZero: true,
    sombrear: (m) => m.mes === 1,
    notaSombra: "Faixas cinza = janeiro: as férias saem da rubrica Pagamento Mensal e puxam os percentis baixos para baixo.",
    extra: (i, d) => (d.periodos[i].mes === 1 ? "Janeiro: efeito férias" : null),
    // NOVO v9: banda translúcida entre p10 e p90
    fillBetween: [
      { serie: "p90 (topo 10%)", fillTo: "p10 (base 10%)", cor: "rgba(46,125,50,0.10)" },
    ],
  });
  estadoSal.graficos.percentis = ctrl.chart;
  ctrl.definir({
    periodos: dist.map((d) => ({ ano: d.ano, mes: d.mes })),
    series: [
      { label: "p90 (topo 10%)", dados: dist.map((d) => d.p90), cor: SerieInterativa.CATEGORICAS[1], fill: true, largura: 1.8 },
      { label: "Mediana (p50)", dados: dist.map((d) => d.p50), cor: SerieInterativa.CATEGORICAS[0], largura: 2.8 },
      { label: "p10 (base 10%)", dados: dist.map((d) => d.p10), cor: SerieInterativa.CATEGORICAS[2], largura: 1.8 },
    ],
    ariaLabel: "Evolução mensal dos percentis p10, mediana e p90 da folha recorrente. A área verde entre p10 e p90 mostra a faixa salarial da metade central do quadro.",
  });

  if (temPaletas()) {
    Paletas.ligarDetalhe(ctrl.chart, (i) => {
      const d = dist[i];
      return [
        rotuloPeriodo(d.ano, d.mes),
        `p10: ${fmtBRL.format(d.p10)} · mediana: ${fmtBRL.format(d.p50)} · p90: ${fmtBRL.format(d.p90)}`,
        `Faixa p10–p90: ${fmtBRL.format(d.p90 - d.p10)} de amplitude`,
      ];
    });
    Paletas.nota(ctx, "A faixa verde entre p10 e p90 mostra a amplitude salarial da metade central do quadro. Quanto mais larga, maior a dispersão interna naquele mês.");
  }
}

/* -------------------------------------------------------------------------
Gini com referência 0,50 + bandas de fundo (v9)
------------------------------------------------------------------------- */
function renderizarGraficoGini() {
  const ctx = document.getElementById("grafico-gini");
  if (!ctx || !window.SerieInterativa) return;
  const gin = estadoSal.gini;
  if (!gin.length) return;

  const ctrl = SerieInterativa.criarGenerica(ctx, {
    valFormat: (v) => v.toFixed(3).replace(".", ","),
    tickFormat: (v) => v.toFixed(2).replace(".", ","),
    beginAtZero: false, yMax: 0.7,
    sombrear: (m) => m.mes === 1,
    notaSombra: "Faixas cinza = janeiro: o Gini sobe porque quem está de férias não recebe na rubrica, sem piora estrutural.",
    extra: (i, d) => (d.periodos[i].mes === 1 ? "Janeiro: valor inflado pelo efeito férias" : null),
    // NOVO v9: linha de referência
    referencia: { valor: 0.50, rotulo: "Limiar de atenção (0,50)", cor: "#cc0000" },
    // NOVO v9: zonas de fundo (verde/amarelo/vermelho)
    bandaFundo: [
      { ate: 0.40, cor: "rgba(46,125,50,0.06)" },
      { ate: 0.50, cor: "rgba(212,169,0,0.06)" },
      { ate: 0.70, cor: "rgba(204,0,0,0.05)" },
    ],
  });
  estadoSal.graficos.gini = ctrl.chart;
  ctrl.definir({
    periodos: gin.map((d) => ({ ano: d.ano, mes: d.mes })),
    series: [{ label: "Índice de Gini", dados: gin.map((d) => d.gini), cor: SerieInterativa.CATEGORICAS[0] }],
    ariaLabel: "Evolução mensal do índice de Gini. A linha tracejada marca 0,50, limiar comum de alta desigualdade.",
  });

  if (temPaletas()) {
    Paletas.ligarDetalhe(ctrl.chart, (i) => {
      const d = gin[i];
      const estado = d.gini < 0.40 ? "baixa" : d.gini < 0.50 ? "moderada" : "alta";
      return [
        rotuloPeriodo(d.ano, d.mes),
        `Gini: ${d.gini.toFixed(3).replace(".", ",")} (${estado} desigualdade)`,
        `n = ${fmtNum.format(d.n)} servidores`,
      ];
    });
    Paletas.nota(ctx, "O fundo verde indica Gini abaixo de 0,40 (baixa desigualdade), amarelo entre 0,40 e 0,50 (moderada) e vermelho acima de 0,50 (alta). A linha tracejada marca o limiar de atenção.");
  }
}

/* -------------------------------------------------------------------------
Histograma (mantido do v8)
------------------------------------------------------------------------- */
function renderizarHistograma() {
  const ctx = document.getElementById("grafico-histograma");
  if (!ctx) return;
  const dados = estadoSal.histograma;
  if (!dados || !dados.length) return;
  const ultimo = dados.reduce((acc, d) => {
    const chave = num(d.ano) * 100 + num(d.mes);
    const accChave = acc ? num(acc.ano) * 100 + num(acc.mes) : -1;
    return chave > accChave ? d : acc;
  }, null);
  if (!ultimo) return;
  const anoRef = num(ultimo.ano);
  const mesRef = num(ultimo.mes);
  const dadosMes = dados.filter((d) => num(d.ano) === anoRef && num(d.mes) === mesRef);
  if (!dadosMes.length) return;

  const titulo = document.getElementById("titulo-histograma");
  if (titulo) titulo.textContent = `Servidores por faixa de remuneração mensal — ${rotuloPeriodo(anoRef, mesRef)}`;

  const ORDEM_FAIXAS = ["ate_2k","2k_4k","4k_6k","6k_8k","8k_10k","10k_12k","12k_14k","14k_16k","16k_18k","18k_20k","20k_25k","25k_30k","acima_30k"];
  const ROTULOS_FAIXA = { "ate_2k": "Até 2", "acima_30k": "Acima de 30" };
  ORDEM_FAIXAS.slice(1, -1).forEach((fx) => {
    const [a, b] = fx.replace(/k/g, "").split("_");
    ROTULOS_FAIXA[fx] = `${a}–${b}`;
  });
  const ordenadas = ORDEM_FAIXAS.map((fx) => dadosMes.find((d) => d.faixa === fx)).filter(Boolean);
  dadosMes.forEach((d) => { if (!ORDEM_FAIXAS.includes(d.faixa)) ordenadas.push(d); });
  if (!ordenadas.length) return;

  const labels = ordenadas.map((d) => ROTULOS_FAIXA[d.faixa] || d.faixa);
  const alturas = ordenadas.map((d) => {
    const larg = num(d.largura_faixa) || 2000;
    return (num(d.n) * 2000) / larg;
  });
  const totalFaixa = ordenadas.reduce((s, x) => s + num(x.n), 0);
  const cores = temPaletas() ? Paletas.porPosicao(ordenadas.length) : ordenadas.map(() => "#2a788e");

  if (estadoSal.graficos.histograma) estadoSal.graficos.histograma.destroy();
  estadoSal.graficos.histograma = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Servidores", data: alturas, backgroundColor: cores,
        borderColor: "rgba(26,26,26,0.35)", borderWidth: 1, borderRadius: 4, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const r = items[0].label;
              return /^Até/.test(r) ? "Até R$ 2 mil" : /^Acima/.test(r) ? "Acima de R$ 30 mil" : `R$ ${r} mil`;
            },
            label: (item) => {
              const d = ordenadas[item.dataIndex];
              const pct = totalFaixa > 0 ? ((num(d.n) / totalFaixa) * 100).toFixed(1).replace(".", ",") : "0,0";
              return `${fmtNum.format(d.n)} servidores (${pct}%) — ${fmtBRLCompacto(d.folha)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: "Remuneração mensal (R$ mil)", color: CORES.cinzaTexto },
             ticks: { color: CORES.cinzaTexto, maxRotation: 60, minRotation: 0, autoSkip: false, font: { size: 11 } } },
        y: { beginAtZero: true, title: { display: true, text: "Servidores por faixa de R$ 2 mil", color: CORES.cinzaTexto },
             grid: { color: CORES.cinzaBorda }, ticks: { color: CORES.cinzaTexto, callback: (v) => fmtNumCompacto(v) } },
      },
    },
  });

  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoSal.graficos.histograma, (i) => {
      const d = ordenadas[i];
      const pct = totalFaixa > 0 ? ((num(d.n) / totalFaixa) * 100).toFixed(1).replace(".", ",") : "0,0";
      return [`R$ ${labels[i]} mil — ${fmtNum.format(d.n)} servidores (${pct}%)`, `Folha total da faixa: ${fmtBRLCompacto(num(d.folha))}`];
    });
    Paletas.nota(ctx, "Cor = posição da faixa salarial, do roxo (menor) ao amarelo (maior). Altura = servidores por faixa de R$ 2 mil. Toque numa barra para ver o número exato.");
  }
}

/* -------------------------------------------------------------------------
Remuneração por perfil (mantido do v8)
------------------------------------------------------------------------- */
function renderizarSalariosPerfil() {
  const dados = estadoSal.salariosPerfil || [];
  if (!dados.length) return;
  renderizarGraficoSalarioEscolaridade(dados);
  renderizarGraficoSalarioTempo(dados);
  renderizarTabelaSalarioPerfil(dados);
}

function renderizarGraficoSalarioEscolaridade(dados) {
  const ctx = document.getElementById("grafico-salario-escolaridade");
  if (!ctx) return;
  const escolaridade = dados.filter((d) => d.dimensao === "escolaridade").sort((a,b) => a.folha_media - b.folha_media);
  if (!escolaridade.length) return;
  if (estadoSal.graficos.salEsc) estadoSal.graficos.salEsc.destroy();
  const cores = temPaletas() ? Paletas.porPosicao(escolaridade.length) : escolaridade.map(() => CORES.azulClaro);
  estadoSal.graficos.salEsc = graficoBarras(ctx, escolaridade.map((d) => d.categoria), escolaridade.map((d) => d.folha_media), {
    label: "Folha média", horizontal: true, cor: cores,
    formatador: (v) => fmtBRL.format(v), eixoFormatador: (v) => fmtBRLCompacto(v),
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoSal.graficos.salEsc, (i) => {
      const d = escolaridade[i];
      return [d.categoria, `Folha média: ${fmtBRL.format(d.folha_media)}`, `Folha mediana: ${fmtBRL.format(d.folha_mediana)} (n=${fmtNum.format(d.n)})`];
    });
    Paletas.nota(ctx, "Cor = nível de instrução, do fundamental (roxo) ao doutorado (amarelo).");
  }
}

function renderizarGraficoSalarioTempo(dados) {
  const ctx = document.getElementById("grafico-salario-tempo");
  if (!ctx) return;
  const tempo = dados.filter((d) => d.dimensao === "tempo_casa");
  if (!tempo.length) return;
  if (estadoSal.graficos.salTempo) estadoSal.graficos.salTempo.destroy();
  const cores = temPaletas() ? Paletas.porPosicao(tempo.length) : tempo.map(() => CORES.verdeClaro);
  estadoSal.graficos.salTempo = graficoBarras(ctx, tempo.map((d) => d.categoria), tempo.map((d) => d.folha_media), {
    label: "Folha média", cor: cores,
    formatador: (v) => fmtBRL.format(v), eixoFormatador: (v) => fmtBRLCompacto(v),
  });
  if (temPaletas()) {
    Paletas.ligarDetalhe(estadoSal.graficos.salTempo, (i) => {
      const d = tempo[i];
      return [d.categoria, `Folha média: ${fmtBRL.format(d.folha_media)}`, `Folha mediana: ${fmtBRL.format(d.folha_mediana)} (n=${fmtNum.format(d.n)})`];
    });
    Paletas.nota(ctx, "Cor = faixa de tempo de casa, da mais recente (roxo) à mais antiga (amarelo).");
  }
}

function renderizarTabelaSalarioPerfil(dados) {
  const tbody = document.querySelector("#tabela-salario-perfil tbody");
  if (!tbody) return;
  const rotuloDim = { escolaridade: "Escolaridade", tempo_casa: "Tempo de casa" };
  const escolaridade = dados.filter((d) => d.dimensao === "escolaridade").sort((a,b) => a.folha_media - b.folha_media);
  const tempo = dados.filter((d) => d.dimensao === "tempo_casa").sort((a,b) => a.folha_media - b.folha_media);
  tbody.innerHTML = [...escolaridade, ...tempo].map((d) => `<tr>
    <td>${rotuloDim[d.dimensao] || d.dimensao}</td>
    <td>${d.categoria}</td>
    <td class="numerico">${fmtNum.format(d.n)}</td>
    <td class="numerico">${fmtBRL.format(d.folha_media)}</td>
    <td class="numerico">${fmtBRL.format(d.folha_mediana)}</td>
  </tr>`).join("");
}

function renderizarTabelaPercentis() {
  const tbody = document.querySelector("#tabela-percentis tbody");
  if (!tbody) return;
  const dados = [...estadoSal.distribuicao].sort((a,b) => b.ano - a.ano || b.mes - a.mes);
  tbody.innerHTML = dados.map((d) => `<tr>
    <td>${rotuloPeriodo(d.ano, d.mes)}</td>
    <td class="numerico">${fmtNum.format(d.n)}</td>
    <td class="numerico">${fmtBRL.format(d.media)}</td>
    <td class="numerico">${fmtBRL.format(d.p10)}</td>
    <td class="numerico">${fmtBRL.format(d.p25)}</td>
    <td class="numerico"><strong>${fmtBRL.format(d.p50)}</strong></td>
    <td class="numerico">${fmtBRL.format(d.p75)}</td>
    <td class="numerico">${fmtBRL.format(d.p90)}</td>
    <td class="numerico">${fmtBRL.format(d.p99)}</td>
  </tr>`).join("");
}

document.addEventListener("DOMContentLoaded", inicializar);