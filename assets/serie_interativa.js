/* =========================================================================
Série temporal interativa — Raio-X do Quadro de Pessoal
- Mobile-first: toque para ler valores, pinça/arraste para zoom e pan
- Períodos rápidos (12 m, 24 m, tudo) e "redefinir zoom"
- Duas séries na MESMA escala: nominal (tracejada) e real (sólida, R$ do último mês)
- Eventos numerados (lista abaixo do gráfico, sem texto sobre a linha)
- Tabela equivalente para leitores de tela
Depende de: Chart.js 4, hammerjs e chartjs-plugin-zoom (assets/vendor).
========================================================================= */
(function () {
  "use strict";

  const COR = { real: "#2f6f2a", nominal: "#2a7ab0", grade: "#dfe6da", texto: "#4f5a50", evento: "#8a5a00" };

  const mesesCurtos = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const rotCurto = (a, m) => `${mesesCurtos[m - 1]}/${String(a).slice(2)}`;
  const rotLongo = (a, m) => `${mesesCurtos[m - 1]}/${a}`;
  const fmtMi = (v) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " mi";
  const fmtPct = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const ehCelular = () => window.matchMedia("(max-width: 600px)").matches;

  /** Constrói séries nominal/real (em R$ milhões) a partir de linhas {ano,mes,folha_total}. */
  function montarSeries(linhas, ipca) {
    const idx = new Map(ipca.map((r) => [`${r.ano}-${r.mes}`, Number(r.indice_ipca)]));
    const ultimo = ipca[ipca.length - 1];
    const idxUlt = Number(ultimo.indice_ipca);
    const meses = linhas.map((r) => ({ ano: Number(r.ano), mes: Number(r.mes) }));
    const nominal = linhas.map((r) => Number(r.folha_total) / 1e6);
    const real = linhas.map((r, i) => {
      const ix = idx.get(`${r.ano}-${r.mes}`);
      return ix ? (nominal[i] * idxUlt) / ix : null;
    });
    return { meses, nominal, real, baseRotulo: rotLongo(ultimo.ano, ultimo.mes) };
  }

  const variacao12m = (arr, i) => (i >= 12 && arr[i] != null && arr[i - 12] ? (arr[i] / arr[i - 12] - 1) * 100 : null);

  function criar(canvas, opts) {
    const o = Object.assign({ eventos: [], elEventos: null, elResumo: null, elTabela: null }, opts);
    let dados = null;
    let eventosIdx = [];

    const pluginEventos = {
      id: "marcadoresEvento",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !eventosIdx.length) return;
        const x = scales.x;
        ctx.save();
        eventosIdx.forEach((ev, n) => {
          if (ev.i < x.min || ev.i > x.max) return;
          const px = x.getPixelForValue(ev.i);
          ctx.strokeStyle = COR.evento; ctx.fillStyle = COR.evento; ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(px, chartArea.top + 14); ctx.lineTo(px, chartArea.bottom); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(px, chartArea.top + 8, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui, sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(n + 1), px, chartArea.top + 8.5);
        });
        ctx.restore();
      },
    };

    const chart = new Chart(canvas, {
      type: "line",
      data: { labels: [], datasets: [] },
      plugins: [pluginEventos],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 4, right: 6 } },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: false, boxWidth: 22, boxHeight: 2, color: COR.texto, padding: 14, font: { size: 13 } },
          },
          tooltip: {
            padding: 10, bodyFont: { size: 13 }, titleFont: { size: 13 }, boxPadding: 4,
            callbacks: {
              title: (it) => (dados ? rotLongo(dados.meses[it[0].dataIndex].ano, dados.meses[it[0].dataIndex].mes) : ""),
              label: (it) => `${it.dataset.label}: ${fmtMi(it.parsed.y)}`,
              afterBody: (it) => {
                if (!dados) return [];
                const i = it[0].dataIndex;
                const linhas = [];
                const r = variacao12m(dados.real, i), n = variacao12m(dados.nominal, i);
                if (n != null) linhas.push(`Var. 12 meses: ${fmtPct(n)} nominal · ${fmtPct(r)} real`);
                const ev = eventosIdx.findIndex((e) => e.i === i);
                if (ev >= 0) linhas.push(`Evento ${ev + 1}: ver nota abaixo do gráfico`);
                return linhas;
              },
            },
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: { wheel: { enabled: true, modifierKey: "ctrl" }, pinch: { enabled: true }, mode: "x" },
            limits: { x: { min: "original", max: "original", minRange: 6 } },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COR.texto, maxRotation: 0, autoSkip: true, maxTicksLimit: ehCelular() ? 5 : 12 },
          },
          y: {
            beginAtZero: false,
            grid: { color: COR.grade },
            title: { display: true, text: "R$ milhões", color: COR.texto },
            ticks: { color: COR.texto, maxTicksLimit: ehCelular() ? 5 : 8, callback: (v) => v.toLocaleString("pt-BR") },
          },
        },
        onResize(c) {
          c.options.scales.x.ticks.maxTicksLimit = ehCelular() ? 5 : 12;
          c.options.scales.y.ticks.maxTicksLimit = ehCelular() ? 5 : 8;
        },
      },
    });
    canvas.style.touchAction = "pan-y"; // rolagem vertical da página continua funcionando

    function resumo() {
      if (!o.elResumo || !dados) return;
      const i = dados.meses.length - 1, m = dados.meses[i];
      const n = variacao12m(dados.nominal, i), r = variacao12m(dados.real, i);
      o.elResumo.textContent =
        `${rotLongo(m.ano, m.mes)}: ${fmtMi(dados.nominal[i])} pagos (nominal). ` +
        `Em 12 meses a folha variou ${fmtPct(n)} nominal e ${fmtPct(r)} após a inflação (IPCA). ` +
        `A linha "Real" está em valores de ${dados.baseRotulo}. Os picos de nov e dez incluem o 13º salário.`;
    }

    function tabela() {
      if (!o.elTabela || !dados) return;
      const linhas = dados.meses.map((m, i) => {
        const r = variacao12m(dados.real, i);
        return `<tr><th scope="row">${rotLongo(m.ano, m.mes)}</th><td>${fmtMi(dados.nominal[i])}</td>` +
          `<td>${dados.real[i] == null ? "—" : fmtMi(dados.real[i])}</td><td>${r == null ? "—" : fmtPct(r)}</td></tr>`;
      }).reverse().join("");
      o.elTabela.innerHTML =
        `<thead><tr><th scope="col">Mês</th><th scope="col">Nominal</th><th scope="col">Real (${dados.baseRotulo})</th>` +
        `<th scope="col">Var. 12 m (real)</th></tr></thead><tbody>${linhas}</tbody>`;
    }

    function listaEventos() {
      if (!o.elEventos) return;
      o.elEventos.innerHTML = eventosIdx.map((e, n) =>
        `<li><span class="serie-ev-num" aria-hidden="true">${n + 1}</span><strong>${rotLongo(dados.meses[e.i].ano, dados.meses[e.i].mes)}:</strong> ${e.rotulo}</li>`
      ).join("");
      o.elEventos.hidden = !eventosIdx.length;
    }

    function definir(series, rotuloSerie) {
      dados = series;
      eventosIdx = o.eventos
        .map((e) => ({ i: series.meses.findIndex((m) => `${m.ano}-${String(m.mes).padStart(2, "0")}` === e.periodo), rotulo: e.rotulo }))
        .filter((e) => e.i >= 0);
      chart.data.labels = series.meses.map((m) => rotCurto(m.ano, m.mes));
      chart.data.datasets = [
        { label: `Real (R$ de ${series.baseRotulo})`, data: series.real, borderColor: COR.real, backgroundColor: COR.real, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: COR.real, pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2, tension: 0.2 },
        { label: "Nominal (valor pago na época)", data: series.nominal, borderColor: COR.nominal, backgroundColor: COR.nominal, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: COR.nominal, pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2, tension: 0.2 },
      ];
      chart.options.plugins.legend.labels.generateLabels = (c) => Chart.defaults.plugins.legend.labels.generateLabels(c).map((l) => {
        l.lineDash = c.data.datasets[l.datasetIndex].borderDash || [];
        l.lineWidth = 2; l.fillStyle = l.strokeStyle; return l;
      });
      chart.canvas.setAttribute("aria-label", `Série mensal ${rotuloSerie}, ${series.meses.length} meses, com valores nominais e reais.`);
      chart.update("none");
      chart.resetZoom && chart.resetZoom("none");
      resumo(); tabela(); listaEventos();
    }

    function periodo(meses) {
      const n = chart.data.labels.length;
      if (!meses || meses >= n) { chart.resetZoom("none"); return; }
      chart.zoomScale("x", { min: n - meses, max: n - 1 }, "none");
    }

    return { chart, definir, periodo, resetar: () => chart.resetZoom() };
  }


  /* =====================================================================
     API genérica: qualquer série mensal (percentis, Gini, % feminino,
     métricas por secretaria, comparação entre secretarias…).
     Injeta sozinha: botões de período, dica de toque, eventos e tabela.
     ===================================================================== */
  const CATEGORICAS = ["#2f6f2a", "#2a7ab0", "#b8641a", "#7b4fa3"]; // validadas (CVD ΔE ≥ 8, contraste ≥ 3:1)

  function criarGenerica(canvas, opts) {
    if (canvas._serieGenerica) return canvas._serieGenerica;
    const o = Object.assign({
      valFormat: (v) => v.toLocaleString("pt-BR"),
      tickFormat: null, yTitle: "", beginAtZero: false, yMax: undefined,
      eventos: [], sombrear: null, notaSombra: "", extra: null, rotuloColuna: "Mês",
    }, opts);
    let dados = null, eventosIdx = [];

    const cont = canvas.closest(".grafico-container") || canvas.parentElement;
    const barra = document.createElement("div");
    barra.className = "serie-controles";
    barra.innerHTML = '<div class="seg" role="group" aria-label="Período exibido">' +
      '<button type="button" class="seg-btn" data-p="12" aria-pressed="false">12 meses</button>' +
      '<button type="button" class="seg-btn" data-p="24" aria-pressed="false">24 meses</button>' +
      '<button type="button" class="seg-btn ativo" data-p="0" aria-pressed="true">Tudo</button></div>';
    cont.parentNode.insertBefore(barra, cont);
    const dica = document.createElement("p");
    dica.className = "serie-dica";
    dica.innerHTML = "Toque no gráfico para ver os valores; dois dedos ampliam e arrastar navega. " +
      '<button type="button" class="seg-btn seg-link">Redefinir zoom</button>' +
      (o.sombrear && o.notaSombra ? `<br><span class="serie-faixa" aria-hidden="true"></span> ${o.notaSombra}` : "");
    cont.insertAdjacentElement("afterend", dica);
    const lista = document.createElement("ol");
    lista.className = "serie-eventos"; lista.hidden = true;
    dica.insertAdjacentElement("afterend", lista);
    const det = document.createElement("details");
    det.className = "serie-tabela";
    det.innerHTML = '<summary>Ver os dados em tabela</summary><div class="tabela-rolagem"><table></table></div>';
    lista.insertAdjacentElement("afterend", det);

    const plugins = [{
      id: "faixasEeventos",
      beforeDatasetsDraw(chart) {
        if (!o.sombrear || !dados) return;
        const { ctx, chartArea, scales } = chart, x = scales.x;
        const passo = Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) || 8;
        ctx.save(); ctx.beginPath(); ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height); ctx.clip();
        ctx.fillStyle = "rgba(79,90,80,0.10)";
        dados.periodos.forEach((m, i) => {
          if (i < x.min - 1 || i > x.max + 1 || !o.sombrear(m)) return;
          ctx.fillRect(x.getPixelForValue(i) - passo / 2, chartArea.top, passo, chartArea.height);
        });
        ctx.restore();
      },
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart, x = scales.x;
        if (!eventosIdx.length) return;
        ctx.save();
        eventosIdx.forEach((ev, n) => {
          if (ev.i < x.min || ev.i > x.max) return;
          const px = x.getPixelForValue(ev.i);
          ctx.strokeStyle = COR.evento; ctx.fillStyle = COR.evento; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(px, chartArea.top + 14); ctx.lineTo(px, chartArea.bottom); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(px, chartArea.top + 8, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(n + 1), px, chartArea.top + 8.5);
        });
        ctx.restore();
      },
    }];

    const chart = new Chart(canvas, {
      type: "line", data: { labels: [], datasets: [] }, plugins,
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: "index", intersect: false }, layout: { padding: { top: 4, right: 6 } },
        plugins: {
          legend: { display: true, position: "bottom", labels: { boxWidth: 22, boxHeight: 2, color: COR.texto, padding: 14, font: { size: 13 } } },
          tooltip: {
            padding: 10, bodyFont: { size: 13 }, titleFont: { size: 13 }, boxPadding: 4,
            callbacks: {
              title: (it) => (dados ? rotLongo(dados.periodos[it[0].dataIndex].ano, dados.periodos[it[0].dataIndex].mes) : ""),
              label: (it) => (it.parsed.y == null ? null : `${it.dataset.label}: ${o.valFormat(it.parsed.y)}`),
              afterBody: (it) => {
                const i = it[0].dataIndex, l = [];
                if (o.extra && dados) { const e = o.extra(i, dados); if (e) l.push(...[].concat(e)); }
                const ev = eventosIdx.findIndex((e) => e.i === i);
                if (ev >= 0) l.push(`Evento ${ev + 1}: ver nota abaixo do gráfico`);
                return l;
              },
            },
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: { wheel: { enabled: true, modifierKey: "ctrl" }, pinch: { enabled: true }, mode: "x" },
            limits: { x: { min: "original", max: "original", minRange: 6 } },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COR.texto, maxRotation: 0, autoSkip: true, maxTicksLimit: ehCelular() ? 5 : 12 } },
          y: {
            beginAtZero: o.beginAtZero, max: o.yMax, grid: { color: COR.grade },
            title: { display: !!o.yTitle, text: o.yTitle, color: COR.texto },
            ticks: { color: COR.texto, maxTicksLimit: ehCelular() ? 5 : 8, callback: (v) => (o.tickFormat ? o.tickFormat(v) : v.toLocaleString("pt-BR")) },
          },
        },
        onResize(c) {
          c.options.scales.x.ticks.maxTicksLimit = ehCelular() ? 5 : 12;
          c.options.scales.y.ticks.maxTicksLimit = ehCelular() ? 5 : 8;
        },
      },
    });
    canvas.style.touchAction = "pan-y";

    const botoes = barra.querySelectorAll("[data-p]");
    function marcar(v) { botoes.forEach((b) => { const t = b.getAttribute("data-p") === String(v); b.classList.toggle("ativo", t); b.setAttribute("aria-pressed", String(t)); }); }
    function periodo(meses) {
      const n = chart.data.labels.length;
      if (!meses || meses >= n) { chart.resetZoom("none"); marcar(0); return; }
      chart.zoomScale("x", { min: n - meses, max: n - 1 }, "none"); marcar(meses);
    }
    botoes.forEach((b) => b.addEventListener("click", () => periodo(Number(b.getAttribute("data-p")))));
    dica.querySelector(".seg-link").addEventListener("click", () => { chart.resetZoom(); marcar(0); });

    function definir(d) {
      dados = d;
      eventosIdx = o.eventos
        .map((e) => ({ i: d.periodos.findIndex((m) => `${m.ano}-${String(m.mes).padStart(2, "0")}` === e.periodo), rotulo: e.rotulo }))
        .filter((e) => e.i >= 0);
      chart.data.labels = d.periodos.map((m) => rotCurto(m.ano, m.mes));
      chart.data.datasets = d.series.map((sr, k) => {
        const cor = sr.cor || CATEGORICAS[k % CATEGORICAS.length];
        return { label: sr.label, data: sr.dados, borderColor: cor, backgroundColor: cor, borderWidth: sr.largura || 2.5,
          borderDash: sr.tracejado ? [6, 4] : [], pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: cor,
          pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2, tension: 0.2, spanGaps: false };
      });
      chart.options.plugins.legend.display = d.series.length > 1;
      chart.options.plugins.legend.labels.generateLabels = (c) => Chart.defaults.plugins.legend.labels.generateLabels(c).map((l) => {
        l.lineDash = c.data.datasets[l.datasetIndex].borderDash || []; l.lineWidth = 2; l.fillStyle = l.strokeStyle; return l;
      });
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", d.ariaLabel || `Série mensal com ${d.periodos.length} meses.`);
      chart.update("none"); chart.resetZoom("none"); marcar(0);
      lista.innerHTML = eventosIdx.map((e, n) =>
        `<li><span class="serie-ev-num" aria-hidden="true">${n + 1}</span><strong>${rotLongo(d.periodos[e.i].ano, d.periodos[e.i].mes)}:</strong> ${e.rotulo}</li>`).join("");
      lista.hidden = !eventosIdx.length;
      const linhas = d.periodos.map((m, i) =>
        `<tr><th scope="row">${rotLongo(m.ano, m.mes)}</th>` +
        d.series.map((sr) => `<td>${sr.dados[i] == null ? "—" : o.valFormat(sr.dados[i])}</td>`).join("") + "</tr>").reverse().join("");
      det.querySelector("table").innerHTML =
        `<thead><tr><th scope="col">${o.rotuloColuna}</th>${d.series.map((sr) => `<th scope="col">${sr.label}</th>`).join("")}</tr></thead><tbody>${linhas}</tbody>`;
    }

    function configurar(c) {
      Object.assign(o, c);
      const y = chart.options.scales.y;
      y.beginAtZero = o.beginAtZero; y.max = o.yMax;
      y.title = { display: !!o.yTitle, text: o.yTitle, color: COR.texto };
    }

    return (canvas._serieGenerica = { chart, definir, configurar, periodo, resetar: () => { chart.resetZoom(); marcar(0); } });
  }

  window.SerieInterativa = { criar, montarSeries, criarGenerica, CATEGORICAS };
})();
