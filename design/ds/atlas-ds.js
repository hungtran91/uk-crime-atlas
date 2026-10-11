// Atlas DS — chart + UI helpers. Requires d3 v7. Colors come from CSS variables so charts follow the theme.
(function () {
  const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = {
    int: v => nf0.format(v),
    dec1: v => nf1.format(v),
    dec2: v => nf2.format(v),
    compact: v => v >= 1e6 ? nf1.format(v / 1e6) + 'M' : v >= 1e4 ? nf0.format(v / 1e3) + 'k' : nf0.format(v),
    pct: (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%',
    ordinal: n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); },
  };

  // polarity: 'up-bad' (crime), 'up-good' (prices, returns), 'neutral'
  function delta(change, { polarity = 'up-bad', text, threshold = 0.0005 } = {}) {
    const dir = Math.abs(change) < threshold ? 'flat' : change > 0 ? 'up' : 'down';
    const tone = dir === 'flat' || polarity === 'neutral' ? 'neutral' : (dir === 'up') === (polarity === 'up-good') ? 'good' : 'bad';
    return `<span class="delta ${dir} ${tone}">${text ?? fmt.pct(change)}</span>`;
  }

  function seqIndex(v, thresholds) { let i = 0; while (i < thresholds.length && v >= thresholds[i]) i++; return i + 1; }
  const seqColor = (v, thresholds) => v == null ? 'url(#nodata-hatch)' : `var(--seq-${seqIndex(v, thresholds)})`;

  function hatchDefs(svg) {
    const d = svg.append('defs').append('pattern').attr('id', 'nodata-hatch').attr('width', 5).attr('height', 5)
      .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    d.append('rect').attr('width', 5).attr('height', 5).style('fill', 'var(--nodata)');
    d.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).style('stroke', 'var(--nodata-stripe)').attr('stroke-width', 1.6);
  }

  function legendSeq(el, thresholds, { unit = '', nodata = true, format = fmt.dec1 } = {}) {
    const n = thresholds.length + 1;
    const ticks = ['<' + format(thresholds[0]), ...thresholds.slice(1).map(format), '≥' + format(thresholds[thresholds.length - 1])];
    const labels = [ticks[0], ...thresholds.slice(0, -1).map((t, i) => format(t) + '–' + format(thresholds[i + 1])), ticks[ticks.length - 1]];
    el.innerHTML = `<div class="legend">
      <div class="legend-row" style="justify-content:space-between"><span>${unit}</span>${nodata ? '<span class="legend-item"><span class="sw nodata-fill"></span>No data</span>' : ''}</div>
      <div class="legend-scale">${Array.from({ length: n }, (_, i) => `<span style="background:var(--seq-${i + 1})" title="${labels[i]}"></span>`).join('')}</div>
      <div class="legend-ticks">${labels.map(l => `<span>${l}</span>`).join('')}</div></div>`;
  }

  // Tooltip singleton — lives in the nearest themed root.
  let tipEl;
  const tooltip = {
    show(html, ev, root = document.body) {
      if (!tipEl || !root.contains(tipEl)) { tipEl?.remove(); tipEl = document.createElement('div'); tipEl.className = 'tooltip'; root.appendChild(tipEl); }
      tipEl.innerHTML = html; tipEl.classList.add('on'); this.move(ev);
    },
    move(ev) {
      if (!tipEl) return;
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    },
    hide() { tipEl?.classList.remove('on'); },
  };
  const ttRows = rows => rows.map(([k, v]) => `<div class="tt-row"><span>${k}</span><b>${v}</b></div>`).join('');

  function observe(el, draw) {
    let w = 0;
    const ro = new ResizeObserver(() => { const nw = el.clientWidth; if (nw && nw !== w) { w = nw; draw(nw); } });
    ro.observe(el); el._ro?.disconnect(); el._ro = ro;
    if (el.clientWidth) { w = el.clientWidth; draw(w); }
  }

  function sparkline(el, values, { color = 'var(--cat-1)', height = 30, highlightLast = true } = {}) {
    observe(el, w => {
      const svg = d3.select(el).html('').append('svg').attr('class', 'chart').attr('width', w).attr('height', height);
      const ok = values.map((v, i) => [i, v]).filter(d => d[1] != null);
      const x = d3.scaleLinear([0, values.length - 1], [2, w - 3]);
      const ext = d3.extent(ok, d => d[1]);
      const y = d3.scaleLinear(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext, [height - 3, 3]);
      const line = d3.line().defined(d => d[1] != null).x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveMonotoneX);
      svg.append('path').attr('d', line(values.map((v, i) => [i, v]))).style('fill', 'none').style('stroke', color).attr('stroke-width', 1.5);
      if (highlightLast && ok.length) { const l = ok[ok.length - 1]; svg.append('circle').attr('cx', x(l[0])).attr('cy', y(l[1])).attr('r', 2.5).style('fill', color); }
    });
  }

  // Horizontal bars in HTML. rows: [{label, value, ref?, color?, sub?}]
  function barChart(el, rows, { format = fmt.int, color = 'var(--cat-1)', refLabel, max, onHover, labelWidth = 180, valueWidth = 64 } = {}) {
    const m = max ?? d3.max(rows, r => Math.max(r.value, r.ref ?? 0)) * 1.04;
    el.innerHTML = `<div style="display:grid;grid-template-columns:${labelWidth}px minmax(0,1fr) ${valueWidth}px;column-gap:12px;row-gap:6px;align-items:center;font-size:var(--fs-sm)">
      ${rows.map((r, i) => `
        <div data-i="${i}" style="color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.label}">${r.label}</div>
        <div data-i="${i}" style="position:relative;height:16px;background:var(--surface-2);border-radius:2px">
          <div style="position:absolute;inset:0 auto 0 0;width:${(r.value / m * 100).toFixed(2)}%;background:${r.color || color};border-radius:2px"></div>
          ${r.ref != null ? `<div style="position:absolute;top:-3px;bottom:-3px;left:calc(${(r.ref / m * 100).toFixed(2)}% - 1px);width:2px;background:var(--text);border-radius:1px"></div>` : ''}
        </div>
        <div data-i="${i}" style="text-align:right;font-variant-numeric:tabular-nums;font-weight:500">${format(r.value)}</div>`).join('')}
    </div>
    ${refLabel ? `<div class="legend-row caption" style="margin-top:12px"><span class="legend-item"><span class="sw" style="background:${color}"></span>${refLabel[0]}</span><span class="legend-item"><span style="width:2px;height:12px;background:var(--text);border-radius:1px"></span>${refLabel[1]}</span></div>` : ''}`;
    if (onHover) el.querySelectorAll('[data-i]').forEach(n => {
      n.addEventListener('mousemove', e => onHover(rows[+n.dataset.i], e));
      n.addEventListener('mouseleave', () => onHover(null));
    });
  }

  // Multi-series line chart. series: [{name, values:[n|null], color, dashed}]
  function lineChart(el, series, { labels, format = fmt.dec1, height = 240, yZero = false, highlight } = {}) {
    observe(el, w => {
      const M = { t: 12, r: 16, b: 24, l: 40 };
      const svg = d3.select(el).html('').append('svg').attr('class', 'chart').attr('width', w).attr('height', height);
      const all = series.flatMap(s => s.values).filter(v => v != null);
      const ext = d3.extent(all); const pad = (ext[1] - ext[0]) * 0.15 || 1;
      const x = d3.scalePoint(labels.map((_, i) => i), [M.l, w - M.r]);
      const y = d3.scaleLinear([yZero ? 0 : ext[0] - pad, ext[1] + pad], [height - M.b, M.t]).nice(5);
      const g = svg.append('g').attr('class', 'grid');
      y.ticks(5).forEach(t => {
        g.append('line').attr('x1', M.l).attr('x2', w - M.r).attr('y1', y(t)).attr('y2', y(t));
        svg.append('text').attr('x', M.l - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(format(t));
      });
      labels.forEach((l, i) => svg.append('text').attr('x', x(i)).attr('y', height - 6).attr('text-anchor', 'middle').text(l));
      series.forEach(s => {
        const line = d3.line().defined(d => d != null).x((d, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
        svg.append('path').attr('d', line(s.values)).style('fill', 'none').style('stroke', s.color).attr('stroke-width', s.dashed ? 1.5 : 2).attr('stroke-dasharray', s.dashed ? '4 3' : null);
        if (!s.dashed) s.values.forEach((v, i) => v != null && svg.append('circle').attr('cx', x(i)).attr('cy', y(v)).attr('r', i === highlight ? 4 : 2.5).style('fill', i === highlight ? s.color : 'var(--surface)').style('stroke', s.color).attr('stroke-width', 1.5));
        s.values.forEach((v, i) => v == null && svg.append('rect').attr('x', x(i) - 5).attr('y', M.t).attr('width', 10).attr('height', height - M.t - M.b).attr('rx', 2).style('fill', 'url(#nodata-hatch)'));
      });
      hatchDefs(svg);
      const cross = svg.append('line').attr('y1', M.t).attr('y2', height - M.b).style('stroke', 'var(--border-strong)').style('opacity', 0);
      const step = x.step();
      svg.append('rect').attr('x', M.l - step / 2).attr('y', 0).attr('width', w - M.l - M.r + step).attr('height', height).style('fill', 'transparent')
        .on('mousemove', e => {
          const [mx] = d3.pointer(e); const i = Math.max(0, Math.min(labels.length - 1, Math.round((mx - M.l) / step)));
          cross.attr('x1', x(i)).attr('x2', x(i)).style('opacity', 1);
          tooltip.show(`<div class="tt-title">${labels.full ? labels.full[i] : labels[i]}</div>` +
            series.map(s => `<div class="tt-row"><span class="legend-item"><span class="sw-line" style="background:${s.color}"></span>${s.name}</span><b>${s.values[i] == null ? 'No data' : format(s.values[i])}</b></div>`).join(''), e, el.closest('[data-theme]'));
        })
        .on('mouseleave', () => { cross.style('opacity', 0); tooltip.hide(); });
    });
  }

  // Dot/strip plot for ranking. items: [{label, value, highlight}]
  function dotPlot(el, items, { ref, refLabel = 'National average', max, format = fmt.dec1, height = 96, onClick } = {}) {
    observe(el, w => {
      const M = { t: 30, r: 24, b: 22, l: 8 };
      const svg = d3.select(el).html('').append('svg').attr('class', 'chart').attr('width', w).attr('height', height);
      const vmax = max ?? d3.max(items, d => d.value) * 1.05;
      const vmin = Math.floor(d3.min(items, d => d.value) - 0.5);
      const x = d3.scaleLinear([vmin, vmax], [M.l, w - M.r]);
      const cy = M.t + (height - M.t - M.b) / 2;
      x.ticks(8).forEach(t => {
        svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', M.t).attr('y2', height - M.b).style('stroke', 'var(--grid)');
        svg.append('text').attr('x', x(t)).attr('y', height - 6).attr('text-anchor', 'middle').text(format(t));
      });
      if (ref != null) {
        svg.append('line').attr('class', 'ref').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', M.t - 6).attr('y2', height - M.b);
        svg.append('text').attr('x', x(ref)).attr('y', M.t - 12).attr('text-anchor', 'middle').style('fill', 'var(--text-2)').text(`${refLabel} ${format(ref)}`);
      }
      const sorted = items.slice().sort((a, b) => a.highlight - b.highlight);
      sorted.forEach(d => {
        const over = d.value > vmax; const px = over ? x(vmax) + 10 : x(d.value);
        const c = svg.append(over ? 'path' : 'circle');
        if (over) c.attr('d', `M${px - 5},${cy - 5}L${px + 3},${cy}L${px - 5},${cy + 5}Z`);
        else c.attr('cx', px).attr('cy', cy).attr('r', d.highlight ? 7 : 5);
        c.style('fill', d.highlight ? 'var(--accent)' : 'var(--text-3)').style('fill-opacity', d.highlight ? 1 : 0.45)
          .style('stroke', d.highlight ? 'var(--surface)' : 'none').attr('stroke-width', 2).style('cursor', onClick ? 'pointer' : null)
          .on('mousemove', e => tooltip.show(`<div class="tt-title">${d.label}</div>${ttRows([['Rate', format(d.value)], ...(d.extra || [])])}`, e, el.closest('[data-theme]')))
          .on('mouseleave', () => tooltip.hide())
          .on('click', () => onClick && onClick(d));
        if (d.highlight) svg.append('text').attr('x', px).attr('y', cy + 22).attr('text-anchor', 'middle').style('fill', 'var(--text)').style('font-weight', 600).text(d.short || d.label);
      });
    });
  }

  window.AtlasDS = { fmt, delta, seqIndex, seqColor, hatchDefs, legendSeq, tooltip, ttRows, observe, sparkline, barChart, lineChart, dotPlot };
})();
