/* =========================================================================
Pagina Secretarias — Raio-X do Quadro de Pessoal da Prefeitura de Sorocaba
v7

Mudança v7: o aviso metodológico do gráfico de composição é anexado
ao .cartao (fora do .grafico-container). Isso evita que o Chart.js infle
a altura do canvas quando há tabela alta ao lado.

Modos de operação:
  "municipio"   (padrão ao abrir): total do município.
  "secretaria"  (após seleção): recorte por secretaria específica.
========================================================================= */

function escaparHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escaparCsv(valor) {
  const s = valor === null || valor === undefined ? "" : String(valor);
  if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

function ticketPeriodo(resumo) {
  if (!resumo) return 0;
  const matriculas = num(resumo.num_matriculas);
  const folha = num(resumo.folha_total);
  return matriculas > 0 ? folha / matriculas : 0;
}

function mediana(valores) {
  const arr = valores.filter((v) => isFinite(v)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

const estado = {
  resumo: [],
  folhaMes: [],
  efetivoMes: [],
  folhaMunicipalMes: [],
  categoriaSecMes: [],
  categoriaMunicipalMes: [],
  secretariaCargo: [],
  secretariaEscolaridade: [],
  secretariaTempo: [],
  secretariaPercentis: [],
  secretariaGini: [],
  municipioCargo: [],
  municipioEscolaridade: [],
  municipioTempo: [],
  municipioPercentis: [],
  municipioGini: [],
  kpis: null,
  auditoria: null,
  secretariaAtual: null,
  metricaAtual: "folha_total",
  modo: "municipio",
  comparar: [],
  valoresReais: false,
  suavizar: false,
  indexar: true,
  graficos: {},
};

/* -------------------------------------------------------------------------
Inicialização
------------------------------------------------------------------------- */
async function inicializar() {
  try {
    const [
      resumo, folhaMes, efetivoMes, folhaMunicipalMes,
      categoriaSecMes, categoriaMunicipalMes,
      secretariaCargo, secretariaEscolaridade, secretariaTempo,
      secretariaPercentis, secretariaGini,
      municipioCargo, municipioEscolaridade, municipioTempo,
      municipioPercentis, municipioGini,
      kpis, auditoria, ipca,
    ] = await Promise.all([
      carregarCSV("dados/resumo_secretaria.csv"),
      carregarCSV("dados/folha_por_secretaria_mes.csv"),
      carregarCSV("dados/efetivo_por_secretaria_mes.csv"),
      carregarCSV("dados/folha_mensal.csv"),
      carregarCSV("dados/composicao_categoria_secretaria_mes.csv"),
      carregarCSV("dados/composicao_categoria_mes.csv"),
      carregarCSV("dados/secretaria_cargo.csv"),
      carregarCSV("dados/secretaria_escolaridade.csv"),
      carregarCSV("dados/secretaria_tempo.csv"),
      carregarCSV("dados/secretaria_percentis.csv"),
      carregarCSV("dados/secretaria_gini.csv"),
      carregarCSV("dados/municipio_cargo.csv"),
      carregarCSV("dados/municipio_escolaridade.csv"),
      carregarCSV("dados/municipio_tempo.csv"),
      carregarCSV("dados/municipio_percentis.csv"),
      carregarCSV("dados/municipio_gini.csv"),
      carregarJSON("dados/kpis.json"),
      carregarJSON("dados/auditoria.json"),
      carregarCSV("dados/folha_mensal_ipca.csv"),
    ]);

    const camposNum = [
      "folha_total", "folha_liquida", "num_registros", "num_matriculas",
      "ticket_medio", "efetivo", "folha_media", "percentual",
      "percentual_na_secretaria",
    ];

    [resumo, folhaMes, efetivoMes, folhaMunicipalMes, categoriaSecMes, categoriaMunicipalMes]
      .forEach((arr) => {
        arr.forEach((r) => {
          camposNum.forEach((c) => { if (c in r) r[c] = num(r[c]); });
        });
      });

    const normalizar = (arr, campos) => arr.forEach((r) =>
      campos.forEach((c) => { if (c in r) r[c] = num(r[c]); })
    );

    normalizar(secretariaCargo, ["n", "folha_total", "folha_media", "folha_mediana", "pct_feminino"]);
    normalizar(secretariaEscolaridade, ["n", "folha_media", "folha_mediana"]);
    normalizar(secretariaTempo, ["n", "folha_media", "folha_mediana"]);
    normalizar(secretariaPercentis, ["n", "media", "p10", "p25", "p50", "p75", "p90", "p99"]);
    normalizar(secretariaGini, ["n", "gini"]);
    normalizar(municipioCargo, ["n", "folha_total", "folha_media", "folha_mediana", "pct_feminino"]);
    normalizar(municipioEscolaridade, ["n", "folha_media", "folha_mediana"]);
    normalizar(municipioTempo, ["n", "folha_media", "folha_mediana"]);
    normalizar(municipioPercentis, ["n", "media", "p10", "p25", "p50", "p75", "p90", "p99"]);
    normalizar(municipioGini, ["n", "gini"]);

    estado.resumo = resumo;
    estado.folhaMes = folhaMes;
    estado.efetivoMes = efetivoMes;
    estado.folhaMunicipalMes = folhaMunicipalMes;
    estado.categoriaSecMes = categoriaSecMes;
    estado.categoriaMunicipalMes = categoriaMunicipalMes;
    estado.secretariaCargo = secretariaCargo;
    estado.secretariaEscolaridade = secretariaEscolaridade;
    estado.secretariaTempo = secretariaTempo;
    estado.secretariaPercentis = secretariaPercentis;
    estado.secretariaGini = secretariaGini;
    estado.municipioCargo = municipioCargo;
    estado.municipioEscolaridade = municipioEscolaridade;
    estado.municipioTempo = municipioTempo;
    estado.municipioPercentis = municipioPercentis;
    estado.municipioGini = municipioGini;
    estado.kpis = kpis;
    estado.auditoria = auditoria;
    estado.ipcaMap = new Map(ipca.map((r) => [`${r.ano}-${r.mes}`, num(r.indice_ipca)]));
    estado.ipcaUlt = ipca.length ? num(ipca[ipca.length - 1].indice_ipca) : 1;
    estado.ipcaRotulo = ipca.length ? rotuloPeriodo(ipca[ipca.length - 1].ano, ipca[ipca.length - 1].mes) : "";

    renderizarCabecalhoPeriodo(kpis);
    popularSeletorSecretarias(resumo);
    renderizarSelo(auditoria);
    registrarEventos();

    const params = new URLSearchParams(location.search);
    const secInicial = params.get("secretaria");

    if (secInicial && resumo.some((s) => s.secretaria === secInicial)) {
      const sel = document.getElementById("seletor-secretaria");
      if (sel) sel.value = secInicial;
      selecionarSecretaria(secInicial);
    } else {
      selecionarMunicipio();
    }
  } catch (e) {
    console.error("[secretaria] Erro ao carregar:", e);
    const main = document.querySelector("main");
    if (main) {
      main.innerHTML = `<div class="erro" role="alert">
        <strong>Não foi possível carregar os dados.</strong><br>
        <small>${e.message}</small>
      </div>`;
    }
  }
}

function renderizarCabecalhoPeriodo(kpis) {
  if (!kpis) return;
  const p = kpis.periodo || {};
  const inicio = p.inicio || "-";
  const fim = p.fim || "-";
  const meses = p.meses_cobertos || 0;

  const elCab = document.getElementById("cabecalho-periodo");
  if (elCab) {
    elCab.innerHTML = `<strong>Período:</strong> ${inicio} a ${fim} &nbsp;·&nbsp; <strong>${meses} meses</strong>`;
  }

  const elPer = document.getElementById("periodo-texto");
  if (elPer) {
    elPer.textContent = `${inicio} a ${fim} · ${meses} meses`;
  }
}

function popularSeletorSecretarias(resumo) {
  const sel = document.getElementById("seletor-secretaria");
  if (!sel) return;
  const ordenado = [...resumo].sort((a, b) => num(b.folha_total) - num(a.folha_total));
  sel.innerHTML = `<option value="">— Total do município (padrão) —</option>`;
  ordenado.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.secretaria;
    opt.textContent = `${s.secretaria} (${fmtBRLCompacto(num(s.folha_total))})`;
    sel.appendChild(opt);
  });
}

function registrarEventos() {
  const sel = document.getElementById("seletor-secretaria");
  const selMetrica = document.getElementById("seletor-metrica");
  const botaoExportar = document.getElementById("botao-exportar");

  if (sel) {
    sel.addEventListener("change", (e) => {
      const nome = e.target.value;
      const url = new URL(location.href);
      if (!nome) {
        url.searchParams.delete("secretaria");
        history.replaceState(null, "", url.toString());
        selecionarMunicipio();
        return;
      }
      selecionarSecretaria(nome);
      url.searchParams.set("secretaria", nome);
      history.replaceState(null, "", url.toString());
    });
  }

  if (selMetrica) {
    selMetrica.addEventListener("change", (e) => {
      estado.metricaAtual = e.target.value;
      if (estado.modo === "municipio") {
        renderizarKPIsMunicipio(estado.kpis);
      } else if (estado.secretariaAtual) {
        const r = estado.resumo.find((s) => s.secretaria === estado.secretariaAtual);
        if (r) renderizarKPIs(r);
      }
      renderizarGraficoMetrica();
    });
  }

  if (botaoExportar) {
    botaoExportar.addEventListener("click", exportarCSV);
  }
}

function selecionarMunicipio() {
  estado.modo = "municipio";
  estado.secretariaAtual = null;

  if (!estado.folhaMunicipalMes || !estado.folhaMunicipalMes.length) {
    console.warn("[secretaria] folhaMunicipalMes vazio — nada a renderizar no modo município.");
  }

  const folha = [...estado.folhaMunicipalMes].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  const efetivo = folha.map((f) => ({
    ano: f.ano,
    mes: f.mes,
    efetivo: num(f.num_matriculas),
  }));

  renderizarKPIsMunicipio(estado.kpis);
  renderizarGraficoMetrica();
  renderizarGraficoEfetivo(efetivo, "municipio");
  renderizarGraficoCategoria(estado.categoriaMunicipalMes, "municipio");
  renderizarTabela(folha);

  const comparadores = document.getElementById("comparadores");
  if (comparadores) {
    const cartao = comparadores.closest(".cartao");
    if (cartao) cartao.style.display = "none";
  }

  renderizarAnatomia(null);
}

function renderizarKPIsMunicipio(kpis) {
  const el = document.getElementById("kpis-secretaria");
  if (!el || !kpis) return;

  const tot = kpis.totais || {};
  const ult = kpis.ultimo_mes || {};
  const per = kpis.periodo || {};

  el.innerHTML = `
    <div class="kpi destaque">
      <div class="rotulo">Folha acumulada no período</div>
      <div class="valor">${fmtBRLCompacto(num(tot.folha_bruta_total))}</div>
      <div class="detalhe">${per.meses_cobertos || 0} meses · total do município</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Folha do último mês</div>
      <div class="valor">${fmtBRLCompacto(num(ult.folha_bruta))}</div>
      <div class="detalhe">${rotuloPeriodo(ult.ano, ult.mes)}</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Matrículas únicas (último mês)</div>
      <div class="valor">${fmtNum.format(num(ult.matriculas))}</div>
      <div class="detalhe">Identificadores distintos no mês</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Ticket médio por matrícula</div>
      <div class="valor">${fmtBRL.format(num(ult.ticket_medio))}</div>
      <div class="detalhe">Folha bruta ÷ matrículas (último mês)</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Secretarias canônicas</div>
      <div class="valor">${fmtNum.format(num(tot.secretarias_unicas))}</div>
      <div class="detalhe">Secretarias após canonização</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Servidores únicos (período)</div>
      <div class="valor">${fmtNum.format(num(tot.matriculas_unicas))}</div>
      <div class="detalhe">Distintos ao longo do período</div>
    </div>
  `;
}

function selecionarSecretaria(nome) {
  estado.modo = "secretaria";
  estado.secretariaAtual = nome;

  const comparadores = document.getElementById("comparadores");
  if (comparadores) {
    const cartao = comparadores.closest(".cartao");
    if (cartao) cartao.style.display = "";
  }

  const resumo = estado.resumo.find((s) => s.secretaria === nome);
  if (!resumo) {
    console.warn("[secretaria] Secretaria não encontrada em resumo:", nome);
    return;
  }

  const folhaSec = estado.folhaMes
    .filter((f) => f.secretaria === nome)
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  const efetivoSec = estado.efetivoMes
    .filter((e) => e.secretaria === nome)
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  const categoriaSec = estado.categoriaSecMes
    .filter((c) => c.secretaria === nome)
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  renderizarKPIs(resumo);
  renderizarGraficoMetrica();
  renderizarGraficoEfetivo(efetivoSec, "secretaria");
  renderizarGraficoCategoria(categoriaSec, nome);
  renderizarComparadores(resumo);
  renderizarTabela(folhaSec);
  renderizarAnatomia(nome);
}

function renderizarKPIs(resumo) {
  const el = document.getElementById("kpis-secretaria");
  if (!el || !resumo) return;

  const ultimoMesFolha = estado.folhaMes
    .filter((f) => f.secretaria === estado.secretariaAtual)
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    .slice(-1)[0] || {};

  const efetivos = estado.efetivoMes.filter((e) => e.secretaria === estado.secretariaAtual);
  const efetivoMedio = efetivos.length
    ? Math.round(efetivos.reduce((s, e) => s + num(e.efetivo), 0) / efetivos.length)
    : 0;

  const totalMunicipal = estado.resumo.reduce((s, r) => s + num(r.folha_total), 0);
  const pctMunicipal = totalMunicipal > 0
    ? (num(resumo.folha_total) / totalMunicipal * 100)
    : 0;
  const ticket = ticketPeriodo(resumo);

  el.innerHTML = `
    <div class="kpi">
      <div class="rotulo">Folha acumulada</div>
      <div class="valor">${fmtBRLCompacto(num(resumo.folha_total))}</div>
      <div class="detalhe">${resumo.meses_presentes || 0} meses na base</div>
    </div>
    <div class="kpi destaque">
      <div class="rotulo">Folha do último mês</div>
      <div class="valor">${fmtBRLCompacto(num(ultimoMesFolha.folha_total))}</div>
      <div class="detalhe">${ultimoMesFolha.ano ? rotuloPeriodo(ultimoMesFolha.ano, ultimoMesFolha.mes) : "-"}</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Efetivo médio</div>
      <div class="valor">${fmtNum.format(efetivoMedio)}</div>
      <div class="detalhe">Matrículas únicas por mês</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Ticket médio por matrícula</div>
      <div class="valor">${fmtBRL.format(ticket)}</div>
      <div class="detalhe">Folha acumulada ÷ matrículas únicas</div>
    </div>
    <div class="kpi positivo">
      <div class="rotulo">% do total municipal</div>
      <div class="valor">${isFinite(pctMunicipal) ? fmtPct(pctMunicipal) : "—"}</div>
      <div class="detalhe">Participação na folha total</div>
    </div>
    <div class="kpi">
      <div class="rotulo">Matrículas únicas</div>
      <div class="valor">${fmtNum.format(num(resumo.num_matriculas))}</div>
      <div class="detalhe">Pessoas distintas ao longo do período</div>
    </div>
  `;
}

const MUNICIPIO_ID = "__mun__";
const nomeCurto = (n) => (n ? n.replace(/^Secretaria (d[aeo]s?) /, "") : "Total do município");

function valorMetrica(r, metrica) {
  if (metrica === "num_matriculas") return num(r.num_matriculas);
  if (metrica === "ticket_medio") return num(r.ticket_medio);
  return num(r.folha_total) / 1e6;
}

/** Série de uma entidade (null = município) alinhada aos períodos; null onde não há dado. */
function serieDaEntidade(nome, periodos, metrica, real) {
  const linhas = nome == null ? estado.folhaMunicipalMes : estado.folhaMes.filter((f) => f.secretaria === nome);
  const mapa = new Map(linhas.map((r) => [`${r.ano}-${r.mes}`, r]));
  return periodos.map((p) => {
    const r = mapa.get(`${p.ano}-${p.mes}`);
    if (!r) return null;
    let v = valorMetrica(r, metrica);
    if (real && metrica !== "num_matriculas") {
      const ix = estado.ipcaMap.get(`${p.ano}-${p.mes}`);
      if (ix) v = (v * estado.ipcaUlt) / ix;
    }
    return v;
  });
}

function montarControlesComparacao(canvas) {
  if (document.getElementById("comparar-secretarias")) return;
  const cartao = canvas.closest(".cartao");
  const cont = canvas.closest(".grafico-container");
  if (!cartao || !cont) return;
  cont.classList.add("grafico-serie");
  const div = document.createElement("div");
  div.id = "comparar-secretarias";
  div.className = "comparar";
  div.innerHTML =
    '<label for="seletor-comparar">Comparar com</label>' +
    '<select id="seletor-comparar"></select>' +
    '<div class="chips" id="chips-comparar" aria-live="polite"></div>' +
    '<label class="chk" id="lbl-real"><input type="checkbox" id="chk-real"> Valores reais (corrigidos pelo IPCA)</label>' +
    '<label class="chk"><input type="checkbox" id="chk-suavizar"> Suavizar sazonalidade (média móvel de 12 meses)</label>' +
    '<label class="chk" id="lbl-indice" hidden><input type="checkbox" id="chk-indice" checked> Índice: primeiro mês com dados = 100</label>';
  cont.parentNode.insertBefore(div, cont);

  div.querySelector("#seletor-comparar").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v && estado.comparar.length < 3 && !estado.comparar.includes(v)) { estado.comparar.push(v); estado.indexar = true; }
    e.target.value = "";
    renderizarGraficoMetrica();
  });
  div.querySelector("#chk-real").addEventListener("change", (e) => { estado.valoresReais = e.target.checked; renderizarGraficoMetrica(); });
  div.querySelector("#chk-suavizar").addEventListener("change", (e) => { estado.suavizar = e.target.checked; renderizarGraficoMetrica(); });
  div.querySelector("#chk-indice").addEventListener("change", (e) => { estado.indexar = e.target.checked; renderizarGraficoMetrica(); });
  div.querySelector("#chips-comparar").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rm]");
    if (!b) return;
    estado.comparar = estado.comparar.filter((n) => n !== b.getAttribute("data-rm"));
    renderizarGraficoMetrica();
  });
}

function atualizarControlesComparacao(base, metrica) {
  const sel = document.getElementById("seletor-comparar");
  if (!sel) return;
  estado.comparar = estado.comparar.filter((n) => n !== base && !(base == null && n === MUNICIPIO_ID));
  const ordenado = [...estado.resumo].sort((a, b) => num(b.folha_total) - num(a.folha_total));
  const cheio = estado.comparar.length >= 3;
  let opts = `<option value="">${cheio ? "Máximo de 3 comparações" : "+ Adicionar órgão…"}</option>`;
  if (base != null) opts += `<option value="${MUNICIPIO_ID}">Total do município</option>`;
  ordenado.forEach((s) => { if (s.secretaria !== base) opts += `<option value="${escaparHTML(s.secretaria)}">${escaparHTML(nomeCurto(s.secretaria))}</option>`; });
  sel.innerHTML = opts;
  sel.disabled = cheio;
  Array.from(sel.options).forEach((o) => { if (estado.comparar.includes(o.value)) o.disabled = true; });
  document.getElementById("chips-comparar").innerHTML = estado.comparar.map((n) =>
    `<span class="chip">${escaparHTML(n === MUNICIPIO_ID ? "Total do município" : nomeCurto(n))}` +
    `<button type="button" data-rm="${escaparHTML(n)}" aria-label="Remover ${escaparHTML(n === MUNICIPIO_ID ? "Total do município" : nomeCurto(n))} da comparação">×</button></span>`).join("");
  const lblIdx = document.getElementById("lbl-indice");
  if (lblIdx) lblIdx.hidden = estado.comparar.length === 0;
  const chkReal = document.getElementById("chk-real");
  if (chkReal) { chkReal.disabled = metrica === "num_matriculas"; chkReal.checked = estado.valoresReais && metrica !== "num_matriculas"; }
}

function renderizarGraficoMetrica() {
  const ctx = document.getElementById("grafico-folha");
  if (!ctx || !window.SerieInterativa) return;

  const periodos = [...estado.folhaMunicipalMes]
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    .map((r) => ({ ano: r.ano, mes: r.mes }));
  if (!periodos.length) return;

  montarControlesComparacao(ctx);
  const base = estado.modo === "municipio" ? null : estado.secretariaAtual;
  const metrica = estado.metricaAtual;
  atualizarControlesComparacao(base, metrica);

  const real = estado.valoresReais && metrica !== "num_matriculas";
  const entidades = [base, ...estado.comparar.map((n) => (n === MUNICIPIO_ID ? null : n))];
  const indexar = entidades.length > 1 && estado.indexar;

  let series = entidades.map((nome) => ({
    label: nomeCurto(nome),
    dados: serieDaEntidade(nome, periodos, metrica, real),
  }));
  if (estado.suavizar) {
    series = series.map((sr) => ({
      ...sr,
      dados: sr.dados.map((_, i) => {
        if (i < 11) return null;
        const jan = sr.dados.slice(i - 11, i + 1);
        return jan.every((v) => v != null) ? jan.reduce((a, v) => a + v, 0) / 12 : null;
      }),
    }));
  }
  if (indexar) {
    series = series.map((sr) => {
      const b0 = sr.dados.find((v) => v != null && v !== 0);
      return { ...sr, dados: sr.dados.map((v) => (v == null || !b0 ? null : (v / b0) * 100)) };
    });
  }

  const rotulos = {
    folha_total: "Folha bruta (R$ mi)",
    num_matriculas: "Efetivo (matrículas)",
    ticket_medio: "Ticket médio por matrícula (R$)",
  };
  const rotulo = rotulos[metrica] || rotulos.folha_total;
  const sufixoReal = (real ? ` · R$ de ${estado.ipcaRotulo}` : "") + (estado.suavizar ? " · média 12 m" : "");

  let cfg;
  if (indexar) {
    cfg = { valFormat: (v) => v.toFixed(1).replace(".", ","), tickFormat: (v) => v.toFixed(0), yTitle: "Índice (base = 100)" + (estado.suavizar ? " · média 12 m" : ""), beginAtZero: false };
  } else if (metrica === "num_matriculas") {
    cfg = { valFormat: (v) => fmtNum.format(v) + " matrículas", tickFormat: (v) => fmtNumCompacto(v), yTitle: "Matrículas" + sufixoReal, beginAtZero: false };
  } else if (metrica === "ticket_medio") {
    cfg = { valFormat: (v) => fmtBRL.format(v), tickFormat: (v) => fmtBRLCompacto(v), yTitle: "R$ por matrícula" + sufixoReal, beginAtZero: false };
  } else {
    cfg = { valFormat: (v) => "R$ " + v.toFixed(1).replace(".", ",") + " mi", tickFormat: (v) => v.toFixed(0), yTitle: "R$ milhões" + sufixoReal, beginAtZero: true };
  }
  cfg.extra = (i, d) => {
    const s0 = d.series[0].dados;
    if (indexar || i < 12 || s0[i] == null || !s0[i - 12]) return null;
    const v = (s0[i] / s0[i - 12] - 1) * 100;
    return `${d.series[0].label} — var. 12 meses: ${(v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",")}%`;
  };

  const ctrl = SerieInterativa.criarGenerica(ctx, {});
  ctrl.configurar(cfg);
  estado.graficos.folha = ctrl.chart;
  ctrl.definir({
    periodos,
    series,
    ariaLabel: `Evolução mensal de ${rotulo}${indexar ? " em índice" : ""} para ${series.map((x) => x.label).join(", ")}. Uma tabela equivalente está abaixo do gráfico.`,
  });

  const cartao = ctx.closest(".cartao");
  const titulo = cartao && cartao.querySelector(".cartao-titulo");
  if (titulo) {
    titulo.textContent = indexar
      ? `Evolução mensal — Índice de ${rotulo.replace(/ \(.*\)$/, "")} (comparação)`
      : `Evolução mensal — ${rotulo}${series.length === 1 ? " — " + series[0].label : ""}`;
  }
}

function renderizarGraficoEfetivo(dados, contexto) {
  const ctx = document.getElementById("grafico-efetivo");
  if (!ctx || !dados || !dados.length) return;

  const labels = dados.map((d) => rotuloPeriodo(d.ano, d.mes));
  const valores = dados.map((d) => num(d.efetivo));

  if (estado.graficos.efetivo) estado.graficos.efetivo.destroy();

  estado.graficos.efetivo = graficoLinha(ctx, labels, valores, {
    label: "Efetivo",
    cor: CORES.verdeClaro,
    corFundo: "rgba(122,182,72,0.10)",
    formatador: (v) => fmtNum.format(v) + " matrículas",
    eixoYFormatador: (v) => fmtNumCompacto(v),
    inicioZero: false,
  });
}

/* -------------------------------------------------------------------------
Gráfico de composição por categoria — CORRIGIDO v7
O aviso metodológico agora é anexado ao .cartao (fora do .grafico-container),
evitando que o Chart.js infle a altura do canvas.
------------------------------------------------------------------------- */
function renderizarGraficoCategoria(dados, contexto) {
  const ctx = document.getElementById("grafico-categoria");
  if (!ctx) return;

  const cartao = ctx.closest(".cartao");
  if (!cartao) return;

  let aviso = cartao.querySelector(".aviso-metodologico.categoria-aviso");

  function garantirAviso() {
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "aviso-metodologico categoria-aviso";
      aviso.style.marginTop = "1rem";
      cartao.appendChild(aviso);
    }
    return aviso;
  }

  if (estado.graficos.categoria) {
    estado.graficos.categoria.destroy();
    estado.graficos.categoria = null;
  }

  if (!dados || !dados.length) {
    garantirAviso().textContent = "Sem dados de categoria.";
    return;
  }

  if (aviso) {
    aviso.remove();
    aviso = null;
  }

  const ultima = dados.reduce((acc, d) => {
    const chave = num(d.ano) * 100 + num(d.mes);
    const accChave = acc ? num(acc.ano) * 100 + num(acc.mes) : -1;
    return chave > accChave ? d : acc;
  }, null);

  const snapshot = dados
    .filter((d) => num(d.ano) === num(ultima.ano) && num(d.mes) === num(ultima.mes))
    .sort((a, b) => num(b.folha_total) - num(a.folha_total));

  const labels = snapshot.map((d) => window.ROTULOS_GRUPO[d.regime_subgrupo] || d.regime_subgrupo);
  const valores = snapshot.map((d) => num(d.folha_total));
  const cores = snapshot.map((d) => CORES_GRUPO[d.regime_subgrupo] || CORES.cinzaTexto);

  estado.graficos.categoria = graficoRosca(ctx, labels, valores, cores);

  const titulo = cartao.querySelector(".cartao-titulo");
  if (titulo) {
    const mesRef = rotuloPeriodo(ultima.ano, ultima.mes);
    titulo.textContent = `Composição por categoria — ${contexto} · ${mesRef}`;
  }

  const contextoLabel = contexto === "municipio" ? "Total do município" : contexto;
  garantirAviso().innerHTML =
    `Composição da folha de <strong>${rotuloPeriodo(ultima.ano, ultima.mes)}</strong> — ${escaparHTML(contextoLabel)}.`;
}

function renderizarComparadores(resumo) {
  const el = document.getElementById("comparadores");
  if (!el || !resumo) return;

  const folhas = estado.resumo.map((s) => num(s.folha_total));
  const medianaFolha = mediana(folhas);

  const tickets = estado.resumo.map(ticketPeriodo).filter((v) => isFinite(v) && v > 0);
  const medianaTicket = mediana(tickets);

  const ticketSec = ticketPeriodo(resumo);
  const ranking = [...estado.resumo].sort((a, b) => num(b.folha_total) - num(a.folha_total));
  const posicao = ranking.findIndex((s) => s.secretaria === resumo.secretaria) + 1;

  const comparar = (valor, referencia) => {
    if (!isFinite(valor) || !isFinite(referencia) || referencia <= 0) {
      return `<span class="badge">—</span>`;
    }
    const pct = ((valor - referencia) / referencia) * 100;
    const acima = valor > referencia;
    const classe = acima ? "positivo" : "alerta";
    const sinal = acima ? "+" : "";
    return `<span class="badge ${classe}">${sinal}${pct.toFixed(1).replace(".", ",")}% vs mediana</span>`;
  };

  el.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div>
        <div style="font-size: 0.78rem; color: var(--cinza-texto); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;">
          Ranking de folha acumulada
        </div>
        <div style="font-size: 1.6rem; font-weight: 700; color: var(--azul-escuro);">
          ${posicao}º de ${estado.resumo.length}
        </div>
      </div>
      <div>
        <div style="font-size: 0.78rem; color: var(--cinza-texto); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;">
          Folha acumulada vs mediana municipal
        </div>
        <div style="font-size: 1.2rem; font-weight: 600;">
          ${fmtBRLCompacto(num(resumo.folha_total))} ${comparar(num(resumo.folha_total), medianaFolha)}
        </div>
      </div>
      <div>
        <div style="font-size: 0.78rem; color: var(--cinza-texto); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;">
          Ticket médio vs mediana municipal
        </div>
        <div style="font-size: 1.2rem; font-weight: 600;">
          ${fmtBRL.format(ticketSec)} ${comparar(ticketSec, medianaTicket)}
        </div>
      </div>
    </div>
  `;
}

function renderizarTabela(dados) {
  const tbody = document.querySelector("#tabela-mensal tbody");
  if (!tbody) return;

  if (!dados || !dados.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="carregando">Sem dados.</td></tr>`;
    return;
  }

  const ordenado = [...dados].sort((a, b) => b.ano - a.ano || b.mes - a.mes);

  tbody.innerHTML = ordenado.map((d) => {
    const ticket = num(d.ticket_medio) ||
      (num(d.num_matriculas) > 0 ? num(d.folha_total) / num(d.num_matriculas) : 0);
    return `
      <tr>
        <td>${rotuloPeriodo(d.ano, d.mes)}</td>
        <td class="numerico">${fmtBRL.format(num(d.folha_total))}</td>
        <td class="numerico">${fmtBRL.format(num(d.folha_liquida))}</td>
        <td class="numerico">${fmtNum.format(num(d.num_registros))}</td>
        <td class="numerico">${fmtNum.format(num(d.num_matriculas))}</td>
        <td class="numerico">${fmtBRL.format(ticket)}</td>
      </tr>
    `;
  }).join("");
}

function renderizarAnatomia(nomeSecretaria) {
  const usarMunicipio = !nomeSecretaria;
  const chave = usarMunicipio ? "Município (todas as secretarias)" : nomeSecretaria;

  const dadosCargo = (usarMunicipio ? estado.municipioCargo : estado.secretariaCargo)
    .filter((r) => r.secretaria_canonica === chave);

  const dadosEsc = (usarMunicipio ? estado.municipioEscolaridade : estado.secretariaEscolaridade)
    .filter((r) => r.secretaria_canonica === chave);

  const dadosTempo = (usarMunicipio ? estado.municipioTempo : estado.secretariaTempo)
    .filter((r) => r.secretaria_canonica === chave);

  const dadosPerc = (usarMunicipio ? estado.municipioPercentis : estado.secretariaPercentis)
    .find((r) => r.secretaria_canonica === chave);

  const dadosGini = (usarMunicipio ? estado.municipioGini : estado.secretariaGini)
    .find((r) => r.secretaria_canonica === chave);

  renderizarTopCargos(dadosCargo, chave);
  renderizarEscolaridadeSec(dadosEsc, chave);
  renderizarTempoSec(dadosTempo, chave);
  renderizarPercentisSec(dadosPerc, dadosGini, chave);

  const aviso = document.getElementById("aviso-anatomia");
  if (aviso) {
    aviso.style.display = "block";
    if (usarMunicipio) {
      aviso.innerHTML = "🔍 <strong>Visão agregada do município.</strong> Selecione uma secretaria acima para ver o detalhamento individual.";
    } else {
      aviso.innerHTML = `Detalhamento interno de <strong>${escaparHTML(nomeSecretaria)}</strong>.`;
    }
  }
}

function renderizarTopCargos(dados, nomeSecretaria) {
  const ctx = document.getElementById("grafico-top-cargos");
  const tbody = document.querySelector("#tabela-top-cargos tbody");

  if (!dados || dados.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="carregando">Nenhum cargo disponível para esta secretaria.</td></tr>`;
    if (ctx && estado.graficos.topCargos) {
      estado.graficos.topCargos.destroy();
      estado.graficos.topCargos = null;
    }
    return;
  }

  const ordenado = [...dados].sort((a, b) => num(b.n) - num(a.n)).slice(0, 20);

  if (ctx) {
    if (estado.graficos.topCargos) estado.graficos.topCargos.destroy();
    estado.graficos.topCargos = graficoBarras(
      ctx,
      ordenado.map((d) => d.cargo),
      ordenado.map((d) => num(d.n)),
      {
        label: "Servidores",
        horizontal: true,
        cor: CORES.azulClaro,
        formatador: (v) => fmtNum.format(v) + " servidores",
        eixoFormatador: (v) => fmtNumCompacto(v),
      }
    );
  }

  if (tbody) {
    tbody.innerHTML = ordenado.map((d) => `
      <tr>
        <td>${escaparHTML(d.cargo)}</td>
        <td class="numerico">${fmtNum.format(num(d.n))}</td>
        <td class="numerico">${fmtBRL.format(num(d.folha_total))}</td>
        <td class="numerico">${fmtBRL.format(num(d.folha_media))}</td>
        <td class="numerico">${fmtBRL.format(num(d.folha_mediana))}</td>
        <td class="numerico">${fmtPct(num(d.pct_feminino))}</td>
      </tr>
    `).join("");
  }
}

const ORDEM_ESC_SEC = [
  "Sem escolaridade formal registrada", "Fundamental incompleto", "Fundamental completo",
  "Médio incompleto", "Medio incompleto", "Médio completo", "Medio completo",
  "Superior incompleto", "Superior completo", "Pós-graduação", "Pos-graduacao",
  "Mestrado", "Doutorado",
];

function renderizarEscolaridadeSec(dados, nomeSecretaria) {
  const ctx = document.getElementById("grafico-escolaridade-sec");
  if (!ctx || !dados || dados.length === 0) return;

  const ordenado = [...dados].sort((a, b) => {
    const ia = ORDEM_ESC_SEC.findIndex(o => a.escolaridade_canonica.toLowerCase().includes(o.toLowerCase()));
    const ib = ORDEM_ESC_SEC.findIndex(o => b.escolaridade_canonica.toLowerCase().includes(o.toLowerCase()));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (estado.graficos.escolaridadeSec) estado.graficos.escolaridadeSec.destroy();

  estado.graficos.escolaridadeSec = graficoBarras(
    ctx,
    ordenado.map((d) => d.escolaridade_canonica),
    ordenado.map((d) => num(d.n)),
    {
      label: "Servidores",
      horizontal: true,
      cor: CORES.azulClaro,
      formatador: (v) => fmtNum.format(v) + " servidores",
      eixoFormatador: (v) => fmtNumCompacto(v),
    }
  );
}

const ORDEM_TEMPO_SEC = ["0-5 anos", "6-10 anos", "11-15 anos", "16-20 anos", "21-25 anos", "26-30 anos", "30+ anos"];

function renderizarTempoSec(dados, nomeSecretaria) {
  const ctx = document.getElementById("grafico-tempo-sec");
  if (!ctx || !dados || dados.length === 0) return;

  const ordenado = [...dados].sort((a, b) => {
    const ia = ORDEM_TEMPO_SEC.indexOf(a.faixa_tempo);
    const ib = ORDEM_TEMPO_SEC.indexOf(b.faixa_tempo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (estado.graficos.tempoSec) estado.graficos.tempoSec.destroy();

  estado.graficos.tempoSec = graficoBarras(
    ctx,
    ordenado.map((d) => d.faixa_tempo),
    ordenado.map((d) => num(d.n)),
    {
      label: "Servidores",
      cor: CORES.verdeClaro,
      formatador: (v) => fmtNum.format(v) + " servidores",
      eixoFormatador: (v) => fmtNumCompacto(v),
    }
  );
}

function renderizarPercentisSec(perc, gini, nomeSecretaria) {
  const bloco = document.getElementById("bloco-percentis-sec");
  const tbody = document.querySelector("#tabela-percentis-sec tbody");
  const aviso = document.getElementById("aviso-sec-drilldown");

  if (!bloco || !tbody) return;

  if (!perc && !gini) {
    bloco.hidden = true;
    if (aviso) {
      aviso.style.display = "block";
      aviso.innerHTML = `<strong>${escaparHTML(nomeSecretaria)}</strong> não tem percentis publicados (n insuficiente).`;
    }
    return;
  }

  bloco.hidden = false;
  if (aviso) aviso.style.display = "none";

  const n = perc ? num(perc.n) : (gini ? num(gini.n) : 0);
  const fmtPerc = (campo) => (perc && perc[campo] != null ? fmtBRL.format(num(perc[campo])) : "—");
  const giniValor = gini ? num(gini.gini).toFixed(3).replace(".", ",") : "—";
  const giniNota = gini ? "" : ' <small style="color: var(--cinza-texto);">(n &lt; 50)</small>';

  tbody.innerHTML = `
    <tr>
      <td class="numerico">${fmtNum.format(n)}</td>
      <td class="numerico">${fmtPerc("media")}</td>
      <td class="numerico">${fmtPerc("p10")}</td>
      <td class="numerico">${fmtPerc("p25")}</td>
      <td class="numerico"><strong>${fmtPerc("p50")}</strong></td>
      <td class="numerico">${fmtPerc("p75")}</td>
      <td class="numerico">${fmtPerc("p90")}</td>
      <td class="numerico">${fmtPerc("p99")}</td>
      <td class="numerico">${giniValor}${giniNota}</td>
    </tr>
  `;
}

function exportarCSV() {
  let dados, nomeArquivo;

  if (estado.modo === "municipio") {
    dados = [...estado.folhaMunicipalMes].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    nomeArquivo = "total_municipio.csv";
  } else if (estado.secretariaAtual) {
    dados = estado.folhaMes
      .filter((f) => f.secretaria === estado.secretariaAtual)
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    nomeArquivo = `secretaria_${estado.secretariaAtual.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
  } else {
    alert("Nada para exportar.");
    return;
  }

  if (!dados.length) {
    alert("Sem dados para exportar.");
    return;
  }

  const colunas = Object.keys(dados[0]);
  const linhas = [colunas.join(";")];

  dados.forEach((linha) => {
    linhas.push(colunas.map((c) => escaparCsv(linha[c])).join(";"));
  });

  const csv = linhas.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", inicializar);