/* =========================================================================
Pagina Salarios — Raio-X do Quadro de Pessoal da Prefeitura de Sorocaba
v6 — Compatível com salarios_por_perfil.csv (colunas escolaridade_canonica
      e faixa_tempo) + salarios.html atual + app.js v6
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

/* -------------------------------------------------------------------------
Inicialização
------------------------------------------------------------------------- */
async function inicializar() {
  try {
    const [
      distribuicao,
      gini,
      histograma,
      salariosPerfil,
      kpis,
      auditoria,
    ] = await Promise.all([
      carregarCSV("dados/distribuicao_salarial.csv"),
      carregarCSV("dados/gini_mensal.csv"),
      carregarCSV("dados/histograma_salarial.csv"),
      carregarCSV("dados/salarios_por_perfil.csv"),
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
    ]);

    // Normalização numérica
    distribuicao.forEach((r) => {
      ["ano", "mes", "n", "media", "p10", "p25", "p50", "p75", "p90", "p95", "p99"]
        .forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    gini.forEach((r) => {
      ["ano", "mes", "n", "gini"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    histograma.forEach((r) => {
      ["n", "folha", "ano", "mes"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });
    salariosPerfil.forEach((r) => {
      ["n", "folha_media", "folha_mediana"].forEach((c) => { if (c in r) r[c] = num(r[c]); });
    });

    // -----------------------------------------------------------------------
    // CORREÇÃO CRÍTICA: normalizar colunas do CSV salarios_por_perfil
    // O CSV tem: escolaridade_canonica, faixa_tempo, n, folha_media, folha_mediana
    // O código espera: dimensao, categoria, n, folha_media, folha_mediana
    // -----------------------------------------------------------------------
    const perfisNormalizados = [];
    salariosPerfil.forEach((r) => {
      // Escolaridade
      if (r.escolaridade_canonica) {
        perfisNormalizados.push({
          dimensao: "escolaridade",
          categoria: r.escolaridade_canonica,
          n: num(r.n),
          folha_media: num(r.folha_media),
          folha_mediana: num(r.folha_mediana),
        });
      }
      // Tempo de casa (faixa_tempo) — só inclui se tiver valor
      if (r.faixa_tempo) {
        perfisNormalizados.push({
          dimensao: "tempo_casa",
          categoria: r.faixa_tempo,
          n: num(r.n),
          folha_media: num(r.folha_media),
          folha_mediana: num(r.folha_mediana),
        });
      }
    });

    estadoSal.distribuicao = distribuicao.sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    estadoSal.gini = gini.sort((a, b) => a.ano - b.ano || a.mes - b.mes);
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
    if (main) {
      main.innerHTML = `<div class="erro" role="alert">
        <strong>Não foi possível carregar os dados de salários.</strong><br>
        <small>${e.message}</small>
      </div>`;
    }
  }
}

/* -------------------------------------------------------------------------
Cabeçalho de período
------------------------------------------------------------------------- */
function renderizarCabecalhoPeriodo(kpis) {
  const el = document.getElementById("cabecalho-periodo");
  if (!el || !kpis) return;
  const p = kpis.periodo || {};
  el.innerHTML = `<strong>Período:</strong> ${p.inicio || "-"} a ${p.fim || "-"} &nbsp;·&nbsp; <strong>${p.meses_cobertos || 0} meses</strong>`;
}

/* -------------------------------------------------------------------------
KPIs — Panorama do último mês
------------------------------------------------------------------------- */
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
Gráfico — Evolução dos percentis (p10, p50, p90)
------------------------------------------------------------------------- */
function renderizarGraficoPercentis() {
  const ctx = document.getElementById("grafico-percentis");
  if (!ctx) return;

  const dist = estadoSal.distribuicao;
  if (!dist.length) return;

  const labels = dist.map((d) => rotuloPeriodo(d.ano, d.mes));

  if (estadoSal.graficos.percentis) estadoSal.graficos.percentis.destroy();

  estadoSal.graficos.percentis = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "p90 (topo 10%)",
          data: dist.map((d) => d.p90),
          borderColor: CORES.azulClaro,
          backgroundColor: "rgba(78,140,58,0.10)",
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: "Mediana (p50)",
          data: dist.map((d) => d.p50),
          borderColor: CORES.verdeClaro,
          backgroundColor: "rgba(122,182,72,0.12)",
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: "p10 (base 10%)",
          data: dist.map((d) => d.p10),
          borderColor: CORES.azulEscuro,
          backgroundColor: "rgba(29,64,35,0.10)",
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CORES.pretoSuave, font: { size: 11 }, boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${fmtBRL.format(item.parsed.y)}`,
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
            callback: (v) => fmtBRLCompacto(v),
          },
        },
      },
    },
  });
}

/* -------------------------------------------------------------------------
Gráfico — Evolução do índice de Gini
------------------------------------------------------------------------- */
function renderizarGraficoGini() {
  const ctx = document.getElementById("grafico-gini");
  if (!ctx) return;

  const gin = estadoSal.gini;
  if (!gin.length) return;

  const labels = gin.map((d) => rotuloPeriodo(d.ano, d.mes));

  if (estadoSal.graficos.gini) estadoSal.graficos.gini.destroy();

  estadoSal.graficos.gini = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Gini",
        data: gin.map((d) => d.gini),
        borderColor: CORES.azulClaro,
        backgroundColor: "rgba(78,140,58,0.10)",
        borderWidth: 2,
        fill: true,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `Gini: ${item.parsed.y.toFixed(3).replace(".", ",")}`,
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
          max: 1,
          grid: { color: CORES.cinzaBorda },
          ticks: {
            color: CORES.cinzaTexto,
            callback: (v) => v.toFixed(2).replace(".", ","),
          },
        },
      },
    },
  });
}

/* -------------------------------------------------------------------------
Gráfico — Histograma por faixa salarial (último mês)
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
  if (titulo) {
    titulo.textContent = `Servidores por faixa de remuneração mensal — ${rotuloPeriodo(anoRef, mesRef)}`;
  }

  const ORDEM_FAIXAS = [
    "ate_2k", "2k_4k", "4k_6k", "6k_8k", "8k_10k",
    "10k_15k", "15k_20k", "20k_30k", "acima_30k",
  ];
  const ROTULOS_FAIXA = {
    "ate_2k": "Até R$ 2 mil",
    "2k_4k": "R$ 2-4 mil",
    "4k_6k": "R$ 4-6 mil",
    "6k_8k": "R$ 6-8 mil",
    "8k_10k": "R$ 8-10 mil",
    "10k_15k": "R$ 10-15 mil",
    "15k_20k": "R$ 15-20 mil",
    "20k_30k": "R$ 20-30 mil",
    "acima_30k": "Acima de R$ 30 mil",
  };
  const CORES_FAIXA = {
    "ate_2k": "#2a788e",
    "2k_4k": "#2a788e",
    "4k_6k": "#2a788e",
    "6k_8k": "#5c9c2a",
    "8k_10k": "#5c9c2a",
    "10k_15k": "#414487",
    "15k_20k": "#414487",
    "20k_30k": "#d4a900",
    "acima_30k": "#cc0000",
  };

  const ordenadas = ORDEM_FAIXAS
    .map((fx) => dadosMes.find((d) => d.faixa === fx))
    .filter(Boolean);

  dadosMes.forEach((d) => {
    if (!ORDEM_FAIXAS.includes(d.faixa)) ordenadas.push(d);
  });

  if (!ordenadas.length) return;

  const labels = ordenadas.map((d) => ROTULOS_FAIXA[d.faixa] || d.faixa);
  const valores = ordenadas.map((d) => num(d.n));
  const cores = ordenadas.map((d) => CORES_FAIXA[d.faixa] || CORES.cinzaTexto);
  const totalFaixa = ordenadas.reduce((s, x) => s + num(x.n), 0);

  if (estadoSal.graficos.histograma) estadoSal.graficos.histograma.destroy();

  estadoSal.graficos.histograma = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Servidores",
        data: valores,
        backgroundColor: cores,
        borderColor: "rgba(26,26,26,0.35)",
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const d = ordenadas[item.dataIndex];
              const pct = totalFaixa > 0
                ? ((num(d.n) / totalFaixa) * 100).toFixed(1).replace(".", ",")
                : "0,0";
              return `${fmtNum.format(d.n)} servidores (${pct}%) — ${fmtBRLCompacto(d.folha)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: CORES.cinzaTexto,
            maxRotation: 45,
            autoSkip: false,
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: CORES.cinzaBorda },
          ticks: {
            color: CORES.cinzaTexto,
            callback: (v) => fmtNumCompacto(v),
          },
        },
      },
    },
  });
}

/* -------------------------------------------------------------------------
Remuneração por perfil (escolaridade + tempo de casa) — CORRIGIDO
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

  const escolaridade = dados.filter((d) => d.dimensao === "escolaridade");
  if (!escolaridade.length) return;

  if (estadoSal.graficos.salEsc) estadoSal.graficos.salEsc.destroy();

  estadoSal.graficos.salEsc = graficoBarras(
    ctx,
    escolaridade.map((d) => d.categoria),
    escolaridade.map((d) => d.folha_media),
    {
      label: "Folha média",
      horizontal: true,
      cor: CORES.azulClaro,
      formatador: (v) => fmtBRL.format(v),
      eixoFormatador: (v) => fmtBRLCompacto(v),
    }
  );
}

function renderizarGraficoSalarioTempo(dados) {
  const ctx = document.getElementById("grafico-salario-tempo");
  if (!ctx) return;

  const tempo = dados.filter((d) => d.dimensao === "tempo_casa");
  if (!tempo.length) return;

  if (estadoSal.graficos.salTempo) estadoSal.graficos.salTempo.destroy();

  estadoSal.graficos.salTempo = graficoBarras(
    ctx,
    tempo.map((d) => d.categoria),
    tempo.map((d) => d.folha_media),
    {
      label: "Folha média",
      cor: CORES.verdeClaro,
      formatador: (v) => fmtBRL.format(v),
      eixoFormatador: (v) => fmtBRLCompacto(v),
    }
  );
}

function renderizarTabelaSalarioPerfil(dados) {
  const tbody = document.querySelector("#tabela-salario-perfil tbody");
  if (!tbody) return;

  const rotuloDim = { escolaridade: "Escolaridade", tempo_casa: "Tempo de casa" };

  tbody.innerHTML = dados.map((d) => `<tr>
    <td>${rotuloDim[d.dimensao] || d.dimensao}</td>
    <td>${d.categoria}</td>
    <td class="numerico">${fmtNum.format(d.n)}</td>
    <td class="numerico">${fmtBRL.format(d.folha_media)}</td>
    <td class="numerico">${fmtBRL.format(d.folha_mediana)}</td>
  </tr>`).join("");
}

/* -------------------------------------------------------------------------
Série detalhada de percentis (tabela)
------------------------------------------------------------------------- */
function renderizarTabelaPercentis() {
  const tbody = document.querySelector("#tabela-percentis tbody");
  if (!tbody) return;

  const dados = [...estadoSal.distribuicao].sort((a, b) => b.ano - a.ano || b.mes - a.mes);

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

/* -------------------------------------------------------------------------
Bootstrap
------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", inicializar);