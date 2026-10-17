/* =========================================================================
Raio-X do Quadro de Pessoal da Prefeitura de Sorocaba
Helpers compartilhados — v9
Novo: animarNumero() para KPIs
========================================================================= */
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLCompacto = (v) => {
  if (v == null || isNaN(v)) return "-";
  if (Math.abs(v) >= 1e9) return "R$ " + (v / 1e9).toFixed(2).replace(".", ",") + " bi";
  if (Math.abs(v) >= 1e6) return "R$ " + (v / 1e6).toFixed(1).replace(".", ",") + " mi";
  if (Math.abs(v) >= 1e3) return "R$ " + (v / 1e3).toFixed(0).replace(".", ",") + " mil";
  return fmtBRL.format(v);
};
const fmtNum = new Intl.NumberFormat("pt-BR");
const fmtPct = (v) => (v == null || isNaN(v) ? "-" : v.toFixed(2).replace(".", ",") + "%");
const fmtNumCompacto = (v) => {
  if (v == null || isNaN(v)) return "-";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + " mi";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(".", ",") + " mil";
  return fmtNum.format(v);
};
const nomeMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const rotuloPeriodo = (ano, mes) => `${nomeMes[mes - 1]}/${ano}`;

const CORES = {
  azulEscuro: "#1d4023", azulClaro: "#4e8c3a", verdeEscuro: "#1d4023", verdeClaro: "#7ab648",
  amarelo: "#ffd200", amareloGrafico: "#d4a900", branco: "#ffffff",
  cinzaFundo: "#f4f7f2", cinzaBorda: "#dfe6da", cinzaTexto: "#4f5a50", pretoSuave: "#1a1a1a",
  efetivos: "#2a788e", funcao: "#2e7d32", comissionados: "#d4a900",
  flexiveis: "#414487", inativos: "#6b6b6b", nc: "#cc0000",
  viridis: ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"],
};
const CORES_GRUPO = {
  efetivos: CORES.efetivos, funcao_confianca: CORES.funcao,
  comissionados: CORES.comissionados, flexiveis: CORES.flexiveis,
  inativos: CORES.inativos, nao_classificado: CORES.nc,
};
window.ROTULOS_GRUPO = {
  efetivos: "Efetivos e empregados públicos",
  funcao_confianca: "Efetivos em função de confiança",
  comissionados: "Comissionados e agentes políticos",
  flexiveis: "Temporários, estagiários e eventuais",
  inativos: "Inativos e pensionistas",
  nao_classificado: "Não classificado",
};

/* -------------- v9: animação de número (KPIs) -------------- */
function animarNumero(el, de, para, formatador, duracao = 1200) {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !isFinite(para) || para === 0) {
    el.textContent = formatador(para);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duracao, 1);
    const easing = 1 - Math.pow(1 - t, 3);
    const valorAtual = de + (para - de) * easing;
    el.textContent = formatador(valorAtual);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function carregarJSON(caminho) {
  const r = await fetch(caminho, { cache: "no-store" });
  if (!r.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${r.status})`);
  return r.json();
}
async function carregarCSV(caminho) {
  const r = await fetch(caminho, { cache: "no-store" });
  if (!r.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${r.status})`);
  let texto = await r.text();
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
  return new Promise((resolve, reject) => {
    Papa.parse(texto, {
      header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: "",
      transformHeader: (h) => String(h).replace(/^\uFEFF/, "").trim(),
      complete: (res) => {
        const limpos = (res.data || []).filter((l) => Object.values(l).some((v) => v !== null && v !== "" && v !== undefined));
        resolve(limpos);
      },
      error: (e) => reject(e),
    });
  });
}

async function atualizarBadgeAtualizacao() {
  const el = document.getElementById("badge-atualizacao");
  if (!el) return;
  try {
    const auditoria = await carregarJSON("dados/auditoria.json");
    const d = auditoria.dados || auditoria;
    const data = d.gerado_em ? new Date(d.gerado_em) : null;
    if (!data || isNaN(data.getTime())) {
      el.textContent = "Atualização pendente";
      el.classList.add("indisponivel");
      return;
    }
    el.textContent = `Atualizado em ${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
    el.title = `Última extração: ${data.toLocaleString("pt-BR")}`;
  } catch (e) {
    el.textContent = "Atualização pendente";
    el.classList.add("indisponivel");
  }
}

function inicializarMenu() {
  const paginaAtual = (location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll(".menu a, .drawer-nav a").forEach((a) => {
    const d = a.getAttribute("href");
    if (d === paginaAtual || (paginaAtual === "" && d === "index.html")) a.classList.add("ativo");
  });
  const botaoHamburguer = document.querySelector(".menu-hamburguer");
  const botaoLateral = document.querySelector(".botao-lateral");
  const drawer = document.querySelector(".drawer");
  const backdrop = document.querySelector(".backdrop");
  const fechar = document.querySelector(".drawer-fechar");
  function abrirDrawer() {
    if (drawer) drawer.classList.add("aberto");
    if (backdrop) backdrop.classList.add("aberto");
    if (drawer) drawer.setAttribute("aria-hidden", "false");
  }
  function fecharDrawer() {
    if (drawer) drawer.classList.remove("aberto");
    if (backdrop) backdrop.classList.remove("aberto");
    if (drawer) drawer.setAttribute("aria-hidden", "true");
  }
  if (botaoLateral) botaoLateral.addEventListener("click", abrirDrawer);
  if (botaoHamburguer) botaoHamburguer.addEventListener("click", () => { abrirDrawer(); if (fechar) fechar.focus(); });
  if (fechar) fechar.addEventListener("click", fecharDrawer);
  if (backdrop) backdrop.addEventListener("click", fecharDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharDrawer(); });
}

function inicializarBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  if (!el) return;
  const PAGINAS = {
    "index.html": { nome: "Início", pai: null },
    "secretarias.html": { nome: "Secretarias", pai: "index.html" },
    "quadro.html": { nome: "Perfil das Unidades", pai: "index.html" },
    "genero.html": { nome: "Gênero", pai: "index.html" },
    "salarios.html": { nome: "Salários", pai: "index.html" },
    "sobre.html": { nome: "Sobre", pai: "index.html" },
  };
  const paginaAtual = (location.pathname.split("/").pop() || "index.html");
  const info = PAGINAS[paginaAtual];
  if (!info || paginaAtual === "index.html") { el.style.display = "none"; return; }
  const params = new URLSearchParams(location.search);
  const sec = params.get("secretaria");
  let html = `<a href="index.html">Início</a>`;
  if (info.pai) html += `<span class="separador">›</span> <a href="${paginaAtual}">${info.nome}</a>`;
  if (sec) html += `<span class="separador">›</span> <span class="atual">${sec}</span>`;
  else html = `<a href="index.html">Início</a> <span class="separador">›</span> <span class="atual">${info.nome}</span>`;
  el.innerHTML = html;
  el.style.display = "";
}

function mostrarErro(c, m) { if (c) c.innerHTML = `<div class="erro" role="alert"><strong>Erro.</strong><br>${m}</div>`; }
function mostrarCarregando(c) { if (c) c.innerHTML = `<div class="carregando">Carregando dados</div>`; }

function graficoLinha(ctx, labels, dados, opcoes = {}) {
  return new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{
      label: opcoes.label || "Valor", data: dados,
      borderColor: opcoes.cor || CORES.azulClaro,
      backgroundColor: opcoes.corFundo || "rgba(78,140,58,0.10)",
      borderWidth: 2, fill: true, tension: 0.25, pointRadius: 2, pointHoverRadius: 5,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (i) => opcoes.formatador ? opcoes.formatador(i.parsed.y) : fmtBRL.format(i.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: CORES.cinzaTexto, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 } },
        y: { beginAtZero: opcoes.inicioZero !== false, grid: { color: CORES.cinzaBorda },
             ticks: { color: CORES.cinzaTexto, callback: (v) => opcoes.eixoYFormatador ? opcoes.eixoYFormatador(v) : fmtNumCompacto(v) } },
      },
    },
  });
}

function graficoBarras(ctx, labels, dados, opcoes = {}) {
  const corConfig = opcoes.cor || CORES.azulClaro;
  const horizontal = !!opcoes.horizontal;
  const labelsSeguros = labels.map((l) => String(l));
  const eixoValores = {
    beginAtZero: true, grid: { color: CORES.cinzaBorda },
    ticks: { color: CORES.cinzaTexto, callback: (v) => opcoes.eixoFormatador ? opcoes.eixoFormatador(v) : fmtNumCompacto(v) },
  };
  const eixoCategorias = {
    type: "category", grid: { display: false },
    ticks: { color: CORES.cinzaTexto, autoSkip: false, callback: function (v) { return this.getLabelForValue(v); } },
  };
  return new Chart(ctx, {
    type: "bar",
    data: { labels: labelsSeguros, datasets: [{
      label: opcoes.label || "Valor", data: dados,
      backgroundColor: corConfig,
      borderColor: "rgba(26,26,26,0.35)", borderWidth: 1, borderRadius: 4, borderSkipped: false,
    }]},
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (i) => {
          const v = i.parsed[horizontal ? "x" : "y"];
          return opcoes.formatador ? opcoes.formatador(v) : fmtBRL.format(v);
        }}},
      },
      scales: horizontal ? { x: eixoValores, y: eixoCategorias } : { x: eixoCategorias, y: eixoValores },
    },
  });
}

function graficoRosca(ctx, labels, dados, cores) {
  return new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: dados, backgroundColor: cores, borderColor: "rgba(26,26,26,0.4)", borderWidth: 1.5 }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
      plugins: {
        legend: { position: "right", labels: { color: CORES.pretoSuave, font: { size: 12 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: (i) => {
          const tot = i.dataset.data.reduce((a,b) => a+b, 0);
          const pct = (i.parsed / tot * 100).toFixed(1).replace(".", ",");
          return `${i.label}: ${fmtBRL.format(i.parsed)} (${pct}%)`;
        }}},
      },
    },
  });
}

function renderizarSelo(selo, seletor = "#selo-conteudo") {
  const el = document.querySelector(seletor);
  if (!el || !selo) return;
  const d = selo.dados || selo;
  const per = d.periodo_coberto || {};
  const q = d.qualidade || {};
  const al = d.alertas || {};
  const regNc = Array.isArray(al.codigos_regime_nao_mapeados) ? al.codigos_regime_nao_mapeados : [];
  const secNc = Array.isArray(al.secretarias_nao_mapeadas) ? al.secretarias_nao_mapeadas : [];
  const escNc = Array.isArray(al.escolaridades_nao_mapeadas) ? al.escolaridades_nao_mapeadas : [];
  const totalPend = regNc.length + secNc.length + escNc.length;
  let dataFmt = "-";
  if (d.gerado_em) {
    const dt = new Date(d.gerado_em);
    if (!isNaN(dt.getTime())) dataFmt = dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  let bloco;
  if (totalPend === 0) {
    bloco = `<div class="ok"><strong>Auditoria em dia.</strong> Todos os códigos de regime, secretarias e escolaridades do portal foram mapeados.</div>`;
  } else {
    const det = [];
    if (regNc.length) det.push(`${regNc.length} regime(s)`);
    if (secNc.length) det.push(`${secNc.length} secretaria(s)`);
    if (escNc.length) det.push(`${escNc.length} escolaridade(s)`);
    bloco = `<div class="alerta"><strong>Atenção:</strong> pendências em ${det.join(", ")}.</div>`;
  }
  el.innerHTML =
    `<dt>Fonte</dt><dd>${d.fonte || "-"}</dd>` +
    `<dt>Período coberto</dt><dd>${per.inicio || "-"} a ${per.fim || "-"} · ${per.total_meses || 0} meses</dd>` +
    `<dt>Registros brutos</dt><dd>${fmtNum.format(q.registros_brutos ?? 0)}</dd>` +
    `<dt>Múltiplos vínculos</dt><dd>${fmtNum.format(q.registros_multivinculo ?? 0)} (${fmtPct(q.percentual_multivinculo ?? 0)})</dd>` +
    `<dt>Registros únicos</dt><dd>${fmtNum.format(q.registros_liquidos ?? 0)}</dd>` +
    `<dt>Servidores únicos</dt><dd>${fmtNum.format(q.matriculas_unicas ?? 0)}</dd>` +
    `<dt>Secretarias</dt><dd>${q.secretarias ?? 0}</dd>` +
    `<dt>Última atualização</dt><dd>${dataFmt}</dd>` + bloco;
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarMenu(); inicializarBreadcrumb(); atualizarBadgeAtualizacao();
});