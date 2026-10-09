// Side panel: tabs, option cards, sliders, text/STL tools.
import { BASES, COLUMNS, TOPPERS, PLAQUES, SHAPES } from './catalog.js';
import { PRESETS } from './presets.js';
import { ANCHORS, newExtra } from './state.js';
import { listFonts } from './fonts-meta.js';

/* ------------------------------------------------------------------ tiny DOM kit */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== undefined && kid !== null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

const TABS = [
  ['start', '✨', 'Start'],
  ['base', '▭', 'Base'],
  ['column', '▮', 'Column'],
  ['topper', '🏆', 'Topper'],
  ['plaque', '🏷', 'Plaque'],
  ['details', '❦', 'Details'],
  ['extras', '＋', 'Extras'],
  ['export', '⬇', 'Export'],
];

export function initUI(app) {
  const tabsEl = document.getElementById('tabs');
  const body = document.getElementById('tabBody');
  let tab = 'start';

  /* ---------------------------------------------------------------- controls */
  const changed = (structural = false) => app.changed(structural);

  function slider(label, obj, key, min, max, step = 1, unit = 'mm', cb) {
    const num = h('input', { type: 'number', min, max, step, value: obj[key] });
    const rng = h('input', { type: 'range', min, max, step, value: obj[key] });
    const set = (v, fromNum) => {
      if (v === '' || isNaN(v)) return;
      v = Number(v);
      obj[key] = v;
      if (fromNum) rng.value = v; else num.value = v;
      if (cb) cb(v);
      changed();
    };
    rng.addEventListener('input', () => set(rng.value, false));
    num.addEventListener('change', () => set(num.value, true));
    return h('div', { class: 'row' }, h('label', { text: label }), h('div', { class: 'sl' }, rng, num, h('span', { class: 'u', text: unit })));
  }
  function select(label, options, obj, key, cb) {
    const s = h('select', {}, options.map(([v, t]) => h('option', { value: v, text: t, selected: obj[key] === v })));
    s.addEventListener('change', () => { obj[key] = s.value; if (cb) cb(s.value); changed(); });
    return h('div', { class: 'row' }, h('label', { text: label }), s);
  }
  function fontSelect(label, obj, key) {
    return select(label, listFonts().map((f) => [f.id, f.name]), obj, key, null);
  }
  function check(label, desc, obj, key, cb) {
    const i = h('input', { type: 'checkbox', checked: !!obj[key] });
    i.addEventListener('change', () => { obj[key] = i.checked; if (cb) cb(i.checked); changed(true); });
    return h('label', { class: 'check' }, i, h('span', {}, h('span', { class: 't', text: label }), desc && h('span', { class: 'd', text: desc })));
  }
  function textInput(label, obj, key, placeholder = '') {
    const i = h('input', { type: 'text', value: obj[key] ?? '', placeholder, maxlength: 60 });
    i.addEventListener('input', () => { obj[key] = i.value; changed(); });
    return h('div', { class: 'row' }, h('label', { text: label }), i);
  }
  function seg(options, obj, key, cb) {
    const wrap = h('div', { class: 'seg' });
    for (const [v, t] of options) {
      const b = h('button', { text: t, class: obj[key] === v ? 'on' : '', type: 'button' });
      b.addEventListener('click', () => { obj[key] = v; wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); if (cb) cb(v); changed(true); });
      wrap.append(b);
    }
    return wrap;
  }
  /** collapsible group of controls; remembers which are open across re-renders */
  const openFolds = new Set(['base']);
  function fold(key, title, kids, active = 0) {
    const d = h('details', { class: 'fold' }, h('summary', {}, h('span', { text: title }), active > 0 && h('span', { class: 'badge', text: String(active) })), h('div', { class: 'fold-body' }, ...kids.filter(Boolean)));
    d.open = openFolds.has(key);
    d.addEventListener('toggle', () => { if (d.open) openFolds.add(key); else openFolds.delete(key); });
    return d;
  }
  const count = (o, ...keys) => keys.filter((k) => o[k]).length;
  const segRow = (label, options, obj, key, cb) => h('div', { class: 'row' }, h('label', { text: label }), seg(options, obj, key, cb));

  function cards(kind, items, current, onPick, { wide = false } = {}) {
    const wrap = h('div', { class: 'cards' + (wide ? ' wide' : '') });
    for (const it of items) {
      const th = h('div', { class: 'th empty' });
      const img = h('img', { alt: '', draggable: 'false' });
      const card = h('button', { class: 'card' + (current === it.id ? ' on' : ''), type: 'button', title: it.name }, th,
        h('div', { class: 'nm' }, h('span', {}, it.name, it.blurb && h('span', { class: 'sub', text: it.blurb }))));
      card.addEventListener('click', () => { wrap.querySelectorAll('.card').forEach((c) => c.classList.remove('on')); card.classList.add('on'); onPick(it.id); });
      if (it.noThumb) { th.className = 'th none'; th.dataset.g = it.glyph || '∅'; } else {
        app.thumbs.want(kind, it.id, (url) => {
          th.classList.remove('empty');
          if (url) { img.src = url; th.append(img); } else th.classList.add('none');
        }, true);
      }
      wrap.append(card);
    }
    return wrap;
  }

  /* ---------------------------------------------------------------- tabs */
  function renderTabs() {
    tabsEl.replaceChildren(...TABS.map(([id, ic, label]) => {
      const b = h('button', { class: 'tab' + (tab === id ? ' on' : ''), role: 'tab', type: 'button' }, h('span', { class: 'ic', text: ic }), label);
      b.addEventListener('click', () => { tab = id; render(); });
      return b;
    }));
  }

  function render() {
    app.tab = tab;
    renderTabs();
    const keepScroll = body.scrollTop;
    body.replaceChildren(...PANELS[tab]().filter(Boolean));
    body.scrollTop = keepScroll;
  }
  app.rerender = render;

  /* ---------------------------------------------------------------- panels */
  const S = () => app.state;

  const PANELS = {
    start() {
      return [
        h('h2', { text: 'Start from a design' }),
        h('p', { class: 'lead', text: 'Pick a ready-made trophy, then change any part in the other tabs. Everything combines freely.' }),
        cards('preset', PRESETS.map((p) => ({ ...p })), null, (id) => app.loadPreset(id), { wide: true }),
        h('h3', { text: 'How it works' }),
        h('div', { class: 'note', html: '<b>1.</b> Choose a <b>Base</b>, optional <b>Column</b> and a <b>Topper</b>.<br><b>2.</b> Add a <b>Plaque</b> with your own text and font.<br><b>3.</b> Weld on ornate <b>Details</b> or drop in your own <b>STL</b>/text under <b>Extras</b>.<br><b>4.</b> <b>Export</b> a single watertight STL, ready to slice.' }),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', text: '🎲 Surprise me', onClick: () => app.randomize() }),
          h('button', { class: 'btn', text: '🔗 Copy share link', onClick: () => app.shareLink() }),
          h('button', { class: 'btn', text: '💾 Save design', onClick: () => app.saveDesign() }),
          h('button', { class: 'btn', text: '📂 Load design', onClick: () => document.getElementById('fileDesign').click() }),
          h('button', { class: 'btn danger', text: 'Reset', onClick: () => app.reset() })),
      ];
    },

    base() {
      const b = S().base;
      const def = BASES.find((x) => x.id === b.style) || BASES[0];
      return [
        h('h2', { text: 'Base' }),
        h('p', { class: 'lead', text: 'The foundation. Round and polygon bases use the width as their diameter.' }),
        cards('base', BASES, b.style, (id) => { b.style = id; changed(); render(); }),
        h('h3', { text: 'Size' }),
        slider('Width', b, 'width', 30, 200, 1),
        def.rect && slider('Depth', b, 'depth', 25, 200, 1),
        slider('Height', b, 'height', 10, 100, 1),
        h('h3', { text: 'Finish' }),
        slider('Edge softness', b, 'edge', 0.2, 4, 0.1, '×'),
        def.rect && slider('Corner rounding', b, 'corner', 0, 30, 0.5),
      ];
    },

    column() {
      const c = S().column;
      return [
        h('h2', { text: 'Column' }),
        h('p', { class: 'lead', text: 'Lifts the topper above the base. Choose “No column” to seat the topper directly on the base.' }),
        cards('column', COLUMNS.map((x) => ({ ...x, noThumb: !x.solid })), c.style, (id) => { c.style = id; changed(); render(); }),
        c.style !== 'none' && h('h3', { text: 'Size' }),
        c.style !== 'none' && slider('Height', c, 'height', 5, 140, 1),
        c.style !== 'none' && slider('Thickness', c, 'radius', 3, 30, 0.5, 'r'),
      ];
    },

    topper() {
      const t = S().topper;
      const items = TOPPERS.map((x) => ({ ...x, noThumb: !x.solid, glyph: x.id === 'stl' ? 'STL' : '∅' }));
      const out = [
        h('h2', { text: 'Topper' }),
        h('p', { class: 'lead', text: 'The star of the show. Use “Your STL” for any model you like, or “Custom Text” for lettering.' }),
        cards('topper', items, t.style, (id) => { t.style = id; changed(); render(); }),
        t.style !== 'none' && h('h3', { text: 'Size' }),
        t.style !== 'none' && slider(t.style === 'stl' ? 'Size' : 'Height', t, 'size', 20, 260, 1),
      ];
      if (t.style === 'text') {
        out.push(h('h3', { text: 'Lettering' }), textInput('Text', t, 'text', 'MVP'), fontSelect('Font', t, 'font'),
          slider('Thicken', t, 'embolden', 0, 2, 0.05),
          check('Backing panel', 'A thin panel behind the letters keeps dots, umlauts and loose strokes attached', t, 'backing'), fontUploadRow());
      }
      if (t.style === 'stl') {
        out.push(h('h3', { text: 'Your STL' }), ...stlPicker(t, 'stlId'),
          slider('Rotate X', t, 'rx', -180, 180, 5, '°'), slider('Rotate Y', t, 'ry', -180, 180, 5, '°'), slider('Rotate Z', t, 'rz', -180, 180, 5, '°'),
          h('div', { class: 'btns' }, h('button', { class: 'btn', text: '↻ Stand it up (X +90°)', onClick: () => { t.rx = ((t.rx || 0) + 90 + 180) % 360 - 180; changed(); render(); } })),
          h('div', { class: 'note', text: 'The model is scaled so its largest side matches the Size slider, centered on the column and welded to it. If it lies on its back, use “Stand it up”.' }));
      }
      return out;
    },

    plaque() {
      const p = S().plaque;
      const out = [
        h('h2', { text: 'Plaque' }),
        h('p', { class: 'lead', text: 'Text is real geometry: raised or engraved, in any font — including your own.' }),
        segRow('Mount', [['front', 'On the base'], ['separate', 'Separate piece'], ['none', 'None']], p, 'mount', () => render()),
      ];
      if (p.mount === 'none') return out;
      out.push(
        cards('plaque', PLAQUES, p.style, (id) => { p.style = id; changed(); render(); }),
        h('h3', { text: 'Shape' }),
        slider('Width', p, 'width', 16, 160, 1),
        slider('Height', p, 'height', 8, 80, 1),
        slider('Thickness', p, 'thickness', 1.5, 10, 0.5),
        slider('Bevel', p, 'bevel', 0, 3, 0.1),
      );
      if (p.mount === 'front') out.push(slider('Extra tilt', p, 'tilt', -20, 40, 1, '°'));
      out.push(
        h('h3', { text: 'Text' }),
        segRow('Style', [['raise', 'Raised'], ['engrave', 'Engraved'], ['none', 'No text']], p, 'textMode', () => render()),
      );
      if (p.textMode !== 'none') {
        out.push(slider('Depth', p, 'textDepth', 0.3, 3, 0.1), slider('Thicken', p, 'embolden', 0, 1.5, 0.05),
          slider('Line spacing', p, 'lineGap', 0.15, 1.6, 0.05, '×'),
          segRow('Align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], p, 'textAlign'));
        const box = h('div', { class: 'lines' });
        p.lines.forEach((ln, i) => {
          const t = h('input', { type: 'text', value: ln.text, placeholder: `Line ${i + 1}`, maxlength: 48 });
          t.addEventListener('input', () => { ln.text = t.value; changed(); });
          const f = h('select', {}, listFonts().map((x) => h('option', { value: x.id, text: x.name, selected: ln.font === x.id })));
          f.addEventListener('change', () => { ln.font = f.value; changed(); });
          const sz = h('input', { type: 'number', min: 1.5, max: 30, step: 0.5, value: ln.size, title: 'Letter height (mm)' });
          sz.addEventListener('change', () => { ln.size = Math.max(1.5, Number(sz.value) || 5); changed(); });
          const del = h('button', { class: 'btn small danger', text: '✕', title: 'Remove line', type: 'button' });
          del.addEventListener('click', () => { p.lines.splice(i, 1); changed(); render(); });
          const caps = h('select', { title: 'Letter case' }, [['', 'As typed'], ['upper', 'UPPER'], ['lower', 'lower']].map(([v, tx]) => h('option', { value: v, text: tx, selected: (ln.caps || '') === v })));
          caps.addEventListener('change', () => { ln.caps = caps.value; changed(); });
          const it = h('input', { type: 'number', min: 0, max: 25, step: 1, value: ln.italic || 0, title: 'Slant (degrees)' });
          it.addEventListener('change', () => { ln.italic = Math.max(0, Math.min(25, Number(it.value) || 0)); changed(); });
          box.append(h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: `Line ${i + 1}` }), del),
            h('div', { class: 'linebox' }, t, f, sz),
            h('div', { class: 'linebox opts' }, h('label', { text: 'Case' }), caps, h('label', { text: 'Slant °' }), it)));
        });
        out.push(box,
          h('div', { class: 'btns' },
            p.lines.length < 5 && h('button', { class: 'btn', text: '+ Add line', onClick: () => { p.lines.push({ text: '', font: p.lines[0]?.font || 'cinzel', size: 4 }); changed(); render(); } }),
            fontUploadBtn()),
          h('div', { class: 'note', text: 'Letter size is the capital-letter height in mm. Lines shrink automatically to fit the plaque. Thin script fonts print better with a little “Thicken”.' }));
      }
      return out;
    },

    details() {
      const o = S().orn;
      const ob = o.base, oc = o.column, ot = o.topper, op = o.plaque;
      const sub = (...k) => h('div', { class: 'sub-opts' }, ...k);
      const BEADS = [['ball', 'Pearl'], ['cube', 'Cube'], ['diamond', 'Diamond']];
      return [
        h('h2', { text: 'Ornate details' }),
        h('p', { class: 'lead', text: 'Every detail is boolean-welded into its part, so the result stays one clean, printable solid. Open a group to switch things on.' }),
        fold('base', 'Base', [
          check('Beaded top rim', 'A row of beads around the top edge', ob, 'beadsTop'),
          check('Beaded foot', 'Beads where the base meets the table', ob, 'beadsFoot'),
          (ob.beadsTop || ob.beadsFoot) && sub(select('Bead shape', BEADS, ob, 'beadShape'), slider('Bead size', ob, 'beadSize', 0.8, 4, 0.1, 'r'), slider('Spacing', ob, 'beadSpacing', 3, 14, 0.5)),
          check('Rope top rim', 'A continuous cord along the top edge', ob, 'cordTop'),
          check('Rope foot', 'A continuous cord around the bottom', ob, 'cordFoot'),
          (ob.cordTop || ob.cordFoot) && sub(slider('Cord thickness', ob, 'cordSize', 0.8, 3.5, 0.1, 'r')),
          check('Moulded top rail', 'A stepped moulding just below the top edge', ob, 'railTop'),
          check('Moulded foot rail', 'A stepped moulding just above the floor', ob, 'railFoot'),
          (ob.railTop || ob.railFoot) && sub(slider('Rail depth', ob, 'railSize', 0.6, 3.5, 0.1)),
          check('Stud band', 'A ring of round studs around the sides (front is left clear)', ob, 'studRow'),
          ob.studRow && sub(slider('Height on base', ob, 'studZ', 0.15, 0.85, 0.01, '×'), slider('Stud size', ob, 'studSize', 0.8, 4, 0.1, 'r'), slider('Spacing', ob, 'studSpacing', 4, 20, 0.5)),
          check('Raised top panel', 'A low plate under the column', ob, 'topPanel'),
          ob.topPanel && sub(slider('Inset', ob, 'panelInset', 1, 20, 0.5), slider('Height', ob, 'panelHeight', 0.6, 5, 0.1)),
          check('Corner finials', 'Turned posts on the corners', ob, 'finials'),
          ob.finials && sub(select('Style', [['urn', 'Urn'], ['ball', 'Ball'], ['flame', 'Flame'], ['acorn', 'Acorn'], ['spike', 'Spike'], ['cone', 'Cone'], ['pyramid', 'Pyramid']], ob, 'finialStyle'), slider('Height', ob, 'finialSize', 4, 30, 0.5)),
          check('Feet', 'Lift the base on little feet', ob, 'feet'),
          ob.feet && sub(select('Style', [['ball', 'Ball'], ['bun', 'Bun'], ['cone', 'Tapered'], ['block', 'Block']], ob, 'footStyle'), slider('Height', ob, 'footHeight', 2, 14, 0.5)),
          S().base.style === 'podium' && check('Podium numbers 1·2·3', null, ob, 'podiumNumbers'),
        ], count(ob, 'beadsTop', 'beadsFoot', 'cordTop', 'cordFoot', 'railTop', 'railFoot', 'studRow', 'topPanel', 'finials', 'feet')),
        fold('column', 'Column', [
          S().column.style === 'none' && h('div', { class: 'note warn', text: 'No column is selected, so column details have no effect.' }),
          check('Collar rings', 'Raised bands at both ends', oc, 'collars'),
          check('Leaf wrap', 'A ring of acanthus-style leaves at the foot', oc, 'leaves'),
          check('Capital', 'A flared cap under the topper', oc, 'capital'),
          check('Skirt', 'A flared foot where the column meets the base', oc, 'skirt'),
          check('Centre knob', 'A ball swelling halfway up', oc, 'knob'),
          oc.knob && sub(slider('Knob size', oc, 'knobSize', 1, 2.6, 0.05, '×')),
          h('div', { class: 'row' }, h('label', { text: 'Decorative bands' }), h('div', { class: 'sl' }, (() => {
            const r = h('input', { type: 'range', min: 0, max: 6, step: 1, value: oc.bands });
            const n = h('input', { type: 'number', min: 0, max: 6, step: 1, value: oc.bands });
            r.addEventListener('input', () => { oc.bands = Number(r.value); n.value = r.value; changed(); });
            n.addEventListener('change', () => { oc.bands = Math.max(0, Math.min(6, Number(n.value) || 0)); r.value = oc.bands; changed(); });
            return [r, n];
          })().flat(), h('span', { class: 'u', text: '' }))),
        ], count(oc, 'collars', 'leaves', 'capital', 'skirt', 'knob') + (oc.bands > 0 ? 1 : 0)),
        fold('topper', 'Topper', [
          check('Rear wings', 'A feathered pair rising behind the topper', ot, 'wings'),
          ot.wings && sub(slider('Span', ot, 'wingSize', 0.2, 0.9, 0.01, '×'), slider('Height', ot, 'wingHeight', 0.1, 1, 0.01, '×')),
          check('Star halo', 'An arc of little stars behind the topper', ot, 'halo'),
          ot.halo && sub(slider('Reach', ot, 'haloSize', 0.1, 0.8, 0.01, '×'), slider('Stars', ot, 'haloStars', 3, 11, 2, '')),
          check('Sun rays', 'A fan of rays radiating behind the topper', ot, 'rays'),
          ot.rays && sub(slider('Rays', ot, 'rayCount', 6, 30, 1, ''), slider('Length', ot, 'rayLength', 0.08, 0.6, 0.01, '×')),
          check('Stepped pedestal', 'Two small discs under the topper', ot, 'pedestal'),
        ], count(ot, 'wings', 'halo', 'rays', 'pedestal')),
        fold('plaque', 'Plaque', [
          S().plaque.mount === 'none' && h('div', { class: 'note warn', text: 'The plaque is turned off, so plaque details are hidden.' }),
          check('Raised border', 'A framed edge around the text', op, 'border'),
          op.border && sub(check('Double border', null, op, 'doubleBorder'), slider('Border width', op, 'borderWidth', 0.5, 2.5, 0.05, '×')),
          check('Pearl border', 'A row of beads inside the frame', op, 'beadBorder'),
          op.beadBorder && sub(slider('Pearl size', op, 'beadBorderSize', 0.6, 1.8, 0.05, '×')),
          check('Corner studs', 'Ornaments in the four corners', op, 'studs'),
          op.studs && sub(select('Style', [['ball', 'Rivet'], ['star', 'Star'], ['diamond', 'Diamond'], ['square', 'Square'], ['flower', 'Flower']], op, 'studStyle'), slider('Size', op, 'studSize', 0.6, 2, 0.05, '×')),
          check('Side scrolls', 'Curled flourishes at both ends', op, 'scrolls'),
          check('Laurel sprigs', 'Leaves flanking the plate', op, 'laurel'),
        ], count(op, 'border', 'beadBorder', 'studs', 'scrolls', 'laurel')),
      ];
    },

    extras() {
      const out = [
        h('h2', { text: 'Extras' }),
        h('p', { class: 'lead', text: 'Add your own lettering or STL models anywhere on the trophy. Weld them in, engrave them, or keep them as separate pieces.' }),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', text: '＋ Text', onClick: () => { S().extras.push(newExtra('text')); changed(); render(); } }),
          h('button', { class: 'btn', text: '＋ Shape', onClick: () => { S().extras.push(newExtra('shape')); changed(); render(); } }),
          h('button', { class: 'btn', text: '＋ STL model', onClick: () => { S().extras.push(newExtra('stl')); changed(); render(); } }),
          fontUploadBtn()),
      ];
      if (!S().extras.length) out.push(h('div', { class: 'note', text: 'Nothing here yet. Try adding text such as the recipient’s name on the front of the base, or a date on the back.' }));
      S().extras.forEach((ex, i) => out.push(extraBox(ex, i)));
      out.push(h('h3', { text: 'STL library' }), ...assetList());
      return out;
    },

    export() {
      const o = S().output;
      const r = app.last;
      const fn = h('input', { type: 'text', value: app.filename, maxlength: 60 });
      fn.addEventListener('input', () => { app.filename = fn.value.replace(/[^\w\- ]+/g, '') || 'trophy'; });
      return [
        h('h2', { text: 'Export' }),
        h('p', { class: 'lead', text: 'Binary STL, millimetres, Z-up, sitting flat on the bed.' }),
        h('h3', { text: 'File layout' }),
        h('div', { class: 'cards wide' },
          modeCard('weld', 'One welded solid', 'Everything fused into a single watertight shell — the simplest print.'),
          modeCard('parts', 'Separate parts (ZIP)', 'Base, column, topper, plaque and text as their own non-overlapping STLs, positioned as assembled — for multi-colour or glue-up.')),
        o.mode === 'weld' && check('Keep plaque text as its own body', 'Exports raised lettering as a separate shell, handy for colour changes', o, 'splitText'),
        h('h3', { text: 'Size & quality' }),
        h('div', { class: 'row' }, h('label', { text: 'Scale to height' }), h('div', { class: 'sl wide' }, (() => {
          const n = h('input', { type: 'number', min: 0, max: 1000, step: 1, value: o.scaleTo || '', placeholder: 'as designed' });
          n.addEventListener('change', () => { o.scaleTo = Number(n.value) || 0; changed(); });
          return n;
        })(), h('span', { class: 'u', text: 'mm' }))),
        segRow('Smoothness', [[0.6, 'Draft'], [1, 'Standard'], [1.6, 'Fine']], o, 'quality'),
        h('div', { class: 'row' }, h('label', { text: 'File name' }), fn),
        h('div', { class: 'btns' }, h('button', { class: 'primary', text: '⬇ Download STL', onClick: () => app.download() })),
        h('h3', { text: 'Model check' }),
        r ? h('div', { class: 'panelbox' }, h('div', { class: 'kv' },
          h('span', { text: 'Size' }), h('span', { text: `${r.stats.size.map((v) => v.toFixed(1)).join(' × ')} mm` }),
          h('span', { text: 'Triangles' }), h('span', { text: r.stats.triangles.toLocaleString() }),
          h('span', { text: 'Bodies' }), h('span', { text: r.bodies.map((b) => `${b.name}${b.watertight ? ' ✓' : ' ⚠'}`).join(', ') }),
          h('span', { text: 'Volume' }), h('span', { text: `${(r.stats.volume / 1000).toFixed(1)} cm³  (≈ ${(r.stats.volume / 1000 * 1.24).toFixed(0)} g solid PLA)` }))) : h('div', { class: 'note', text: 'Building…' }),
        h('div', { class: 'note', html: '✓ means the shell is a closed, manifold solid with no holes, flipped faces or self-intersections — verified by the boolean engine, not guessed.' }),
      ];
    },
  };

  function modeCard(id, title, desc) {
    const on = S().output.mode === id;
    const c = h('button', { class: 'card' + (on ? ' on' : ''), type: 'button', style: 'text-align:left;padding:10px' }, h('b', { text: title }), h('span', { class: 'sub', text: desc }));
    c.addEventListener('click', () => { S().output.mode = id; changed(true); render(); });
    return c;
  }

  /* ---------------------------------------------------------------- extras editor */
  function extraBox(ex, i) {
    const isText = ex.type === 'text', isShape = ex.type === 'shape', flatable = isText || isShape;
    const del = h('button', { class: 'btn small danger', text: '✕', title: 'Remove', type: 'button', onClick: () => { S().extras.splice(i, 1); changed(); render(); } });
    const faces = ['baseFront', 'baseBack', 'baseLeft', 'baseRight', 'plaqueFront', 'column'];
    const box = h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: isText ? `Text: “${(ex.text || '').slice(0, 18)}”` : isShape ? `Shape: ${(SHAPES.find((x) => x.id === ex.shape) || SHAPES[0]).name}` : 'STL model' }), del));
    if (isShape) {
      box.append(select('Shape', SHAPES.map((x) => [x.id, x.name]), ex, 'shape', () => render()), slider('Size', ex, 'size', 3, 80, 0.5), slider('Depth', ex, 'depth', 0.3, 12, 0.1));
    } else if (isText) {
      box.append(textInput('Text', ex, 'text', 'Your text'), fontSelect('Font', ex, 'font'),
        slider('Letter size', ex, 'size', 2, 60, 0.5), slider('Depth', ex, 'depth', 0.3, 12, 0.1), slider('Thicken', ex, 'embolden', 0, 2, 0.05));
    } else {
      box.append(...stlPicker(ex, 'assetId'), slider('Scale', ex, 'scale', 5, 600, 1, '%'), slider('Or fit size', ex, 'fitHeight', 0, 250, 1, 'mm'),
        slider('Rotate X', ex, 'rx', -180, 180, 5, '°'), slider('Rotate Y', ex, 'ry', -180, 180, 5, '°'), slider('Rotate Z', ex, 'rz', -180, 180, 5, '°'));
    }
    box.append(select('Place on', ANCHORS, ex, 'anchor', () => { if (flatable && !faces.includes(ex.anchor) && ex.orient === 'upright') ex.orient = 'flat'; if (flatable && faces.includes(ex.anchor)) ex.orient = 'upright'; render(); }));
    if (isShape) box.append(segRow('Orientation', [['upright', 'Upright'], ['flat', 'Lying flat']], ex, 'orient'));
    if (isText) box.append(segRow('Lettering', [['upright', 'Upright'], ['flat', 'Lying flat']], ex, 'orient'), segRow('Align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], ex, 'align'));
    box.append(segRow('Mode', [['weld', 'Weld on'], ['engrave', 'Engrave'], ['separate', 'Separate']], ex, 'mode'),
      slider('Move sideways', ex, 'ox', -100, 100, 0.5), slider('Move up', ex, 'oz', -100, 100, 0.5), slider('Push in/out', ex, 'oy', -40, 40, 0.5));
    if (flatable) box.append(slider('Rotate', ex, 'rz', -180, 180, 1, '°'));
    return box;
  }

  /* ---------------------------------------------------------------- assets */
  function stlPicker(obj, key) {
    const ids = Object.keys(app.assets);
    const out = [];
    if (ids.length) out.push(select('Model', [['', '— choose —'], ...ids.map((id) => [id, app.assets[id].name])], obj, key, () => render()));
    out.push(h('div', { class: 'btns' }, h('button', { class: 'btn', text: '📂 Upload STL…', onClick: () => app.pickStl((id) => { obj[key] = id; changed(true); render(); }) })));
    if (obj[key] && app.assets[obj[key]] && !app.assets[obj[key]].weldable) out.push(h('div', { class: 'note warn', text: app.assets[obj[key]].reason }));
    return out;
  }
  function assetList() {
    const ids = Object.keys(app.assets);
    if (!ids.length) return [h('div', { class: 'note', text: 'No STL files loaded. Uploaded models stay in your browser — they are never sent anywhere.' })];
    return ids.map((id) => {
      const a = app.assets[id];
      return h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: a.name }), h('button', { class: 'btn small danger', text: 'Remove', onClick: () => app.removeAsset(id) })),
        h('div', { class: 'kv' }, h('span', { text: 'Triangles' }), h('span', { text: String(a.triangles) }), h('span', { text: 'Weldable' }), h('span', { text: a.weldable ? 'Yes — watertight ✓' : 'No — exported as its own shell' })));
    });
  }
  function fontUploadBtn() { return h('button', { class: 'btn', text: 'Aa Upload font…', title: 'TTF, OTF or WOFF', onClick: () => app.pickFont(() => render()) }); }
  function fontUploadRow() { return h('div', { class: 'btns' }, fontUploadBtn()); }

  render();
  return { render, setTab: (t) => { tab = t; render(); } };
}

