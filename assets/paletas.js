/* =========================================================================
paletas.js — Cores e painel de detalhe para os gráficos do Raio-X
v1.0

API:
  Paletas.CATEGORICA             — 8 cores validadas (categorias sem ordem)
  Paletas.VIRIDIS                — 6 stops da escala Viridis
  Paletas.porPosicao(n)          — n cores interpoladas no Viridis (baixo→alto)
  Paletas.porCategoria(n)        — n cores cíclicas para categorias
  Paletas.variacao(v)            — azul (positivo) / laranja (negativo) / cinza
  Paletas.paridade(pct)          — azul (>50) / laranja (<50) / cinza (=50)
  Paletas.ligarDetalhe(chart, fn) — painel abaixo do gráfico ao tocar
  Paletas.nota(canvas, texto)    — nota de leitura abaixo do gráfico
========================================================================= */
(function () {
  "use strict";

  const CATEGORICA = [
    "#2a78d6", // 0 azul
    "#eb6834", // 1 laranja
    "#1baf7a", // 2 verde
    "#eda100", // 3 amarelo
    "#e87ba4", // 4 rosa
    "#008300", // 5 verde escuro
    "#6250d6", // 6 roxo
    "#e34948", // 7 vermelho
  ];

  const VIRIDIS = [
    "#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725",
  ];

  const POSITIVO = "#2a78d6";
  const NEGATIVO = "#eb6834";
  const NEUTRO   = "#a0aec0";

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  function rgbToHex(r, g, b) {
    const to = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
    return "#" + to(r) + to(g) + to(b);
  }

  function interpolar(a, b, t) {
    const [r1,g1,b1] = hexToRgb(a);
    const [r2,g2,b2] = hexToRgb(b);
    return rgbToHex(r1+(r2-r1)*t, g1+(g2-g1)*t, b1+(b2-b1)*t);
  }

  function corViridis(t) {
    t = Math.max(0, Math.min(1, t));
    const n = VIRIDIS.length - 1;
    const pos = t * n;
    const i = Math.floor(pos);
    if (i >= n) return VIRIDIS[n];
    return interpolar(VIRIDIS[i], VIRIDIS[i+1], pos - i);
  }

  function porPosicao(n) {
    if (n <= 0) return [];
    if (n === 1) return [VIRIDIS[Math.floor(VIRIDIS.length / 2)]];
    return Array.from({ length: n }, (_, i) => corViridis(i / (n - 1)));
  }

  function porCategoria(n) {
    return Array.from({ length: n }, (_, i) => CATEGORICA[i % CATEGORICA.length]);
  }

  function variacao(v) {
    if (v == null || isNaN(v) || v === 0) return NEUTRO;
    return v > 0 ? POSITIVO : NEGATIVO;
  }

  function paridade(pct) {
    if (pct == null || isNaN(pct)) return NEUTRO;
    const d = pct - 50;
    if (Math.abs(d) < 1) return NEUTRO;
    return d > 0 ? POSITIVO : NEGATIVO;
  }

  function ligarDetalhe(chart, fn) {
    const canvas = chart.canvas;
    const container = canvas.closest(".grafico-container") || canvas.parentElement;
    if (!container) return;

    let painel = container.nextElementSibling;
    if (!painel || !painel.classList.contains("grafico-detalhe")) {
      painel = document.createElement("div");
      painel.className = "grafico-detalhe";
      painel.setAttribute("aria-live", "polite");
      painel.textContent = "Toque em um elemento para ver os detalhes.";
      container.insertAdjacentElement("afterend", painel);
    }

    const render = (idx) => {
      let linhas = fn(idx);
      if (linhas == null) return;
      if (!Array.isArray(linhas)) linhas = [linhas];
      if (linhas.length === 0) return;
      const titulo = linhas[0];
      const resto = linhas.slice(1);
      painel.innerHTML = "<strong>" + titulo + "</strong>" + resto.map((l) => "<br>" + l).join("");
    };

    chart.options.onClick = (ev, el) => { if (el && el.length) render(el[0].index); };
    chart.options.onHover = (ev, el) => { if (el && el.length) render(el[0].index); };
    chart.update("none");
    return painel;
  }

  function nota(canvas, texto) {
    const container = canvas.closest(".grafico-container") || canvas.parentElement;
    if (!container) return;
    let ref = container.nextElementSibling;
    if (ref && ref.classList.contains("grafico-detalhe")) ref = ref.nextElementSibling;
    if (ref && ref.classList.contains("grafico-nota")) {
      ref.textContent = texto;
      return ref;
    }
    const p = document.createElement("p");
    p.className = "grafico-nota";
    p.textContent = texto;
    const afterEl = container.nextElementSibling;
    const target = (afterEl && afterEl.classList.contains("grafico-detalhe")) ? afterEl : container;
    target.insertAdjacentElement("afterend", p);
    return p;
  }

  window.Paletas = {
    CATEGORICA, VIRIDIS, POSITIVO, NEGATIVO, NEUTRO,
    porPosicao, porCategoria, variacao, paridade, ligarDetalhe, nota,
  };
})();