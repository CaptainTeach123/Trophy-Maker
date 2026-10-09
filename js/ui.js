// Side panel: tabs, option cards, sliders, text/STL tools.
import { BASES } from './parts/bases.js';
import { COLUMNS } from './parts/columns.js';
import { TOPPERS } from './parts/toppers.js';
import { PLAQUES } from './parts/plaques.js';
import { PRESETS } from './presets.js';
import { ANCHORS, newExtra } from './builder.js';
import { listFonts } from './text.js';
import { MATERIALS } from './viewer.js';

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
      ];
    },

    column() {
      const c = S().column;
      return [
        h('h2', { text: 'Column' }),
        h('p', { class: 'lead', text: 'Lifts the topper above the base. Choose “No column” to seat the topper directly on the base.' }),
        cards('column', COLUMNS.map((x) => ({ ...x, noThumb: x.id === 'none' })), c.style, (id) => { c.style = id; changed(); render(); }),
        c.style !== 'none' && h('h3', { text: 'Size' }),
        c.style !== 'none' && slider('Height', c, 'height', 5, 140, 1),
        c.style !== 'none' && slider('Thickness', c, 'radius', 3, 30, 0.5, 'r'),
      ];
    },

    topper() {
      const t = S().topper;
      const items = TOPPERS.map((x) => ({ ...x, noThumb: x.id === 'none' || x.id === 'stl', glyph: x.id === 'stl' ? 'STL' : '∅' }));
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
        out.push(slider('Depth', p, 'textDepth', 0.3, 3, 0.1), slider('Thicken', p, 'embolden', 0, 1.5, 0.05));
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
          box.append(h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: `Line ${i + 1}` }), del),
            h('div', { class: 'linebox' }, t, f, sz)));
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
      const sub = (...k) => h('div', { class: 'sub-opts' }, ...k);
      return [
        h('h2', { text: 'Ornate details' }),
        h('p', { class: 'lead', text: 'Every detail is boolean-welded into its part, so the result stays one clean, printable solid.' }),
        h('h3', { text: 'Base' }),
        check('Beaded top rim', 'A row of pearls around the top edge', o.base, 'beadsTop'),
        check('Beaded foot', 'Pearls where the base meets the table', o.base, 'beadsFoot'),
        (o.base.beadsTop || o.base.beadsFoot) && sub(slider('Bead size', o.base, 'beadSize', 0.8, 4, 0.1, 'r'), slider('Spacing', o.base, 'beadSpacing', 3, 14, 0.5)),
        check('Corner finials', 'Turned posts on the corners', o.base, 'finials'),
        o.base.finials && sub(select('Style', [['urn', 'Urn'], ['ball', 'Ball'], ['spike', 'Spike'], ['cone', 'Cone'], ['pyramid', 'Pyramid']], o.base, 'finialStyle'), slider('Height', o.base, 'finialSize', 4, 30, 0.5)),
        check('Feet', 'Lift the base on little feet', o.base, 'feet'),
        o.base.feet && sub(select('Style', [['ball', 'Ball'], ['block', 'Block']], o.base, 'footStyle'), slider('Height', o.base, 'footHeight', 2, 14, 0.5)),
        S().base.style === 'podium' && check('Podium numbers 1·2·3', null, o.base, 'podiumNumbers'),
        h('h3', { text: 'Column' }),
        check('Collar rings', 'Raised bands at both ends', o.column, 'collars'),
        check('Leaf wrap', 'A ring of acanthus-style leaves at the foot', o.column, 'leaves'),
        S().column.style === 'none' && h('div', { class: 'note warn', text: 'No column is selected, so column details have no effect.' }),
        h('h3', { text: 'Topper' }),
        check('Rear wings', 'A feathered pair rising behind the topper', o.topper, 'wings'),
        o.topper.wings && sub(slider('Span', o.topper, 'wingSize', 0.2, 0.9, 0.01, '×'), slider('Height', o.topper, 'wingHeight', 0.1, 1, 0.01, '×')),
        check('Star halo', 'An arc of little stars behind the topper', o.topper, 'halo'),
        o.topper.halo && sub(slider('Reach', o.topper, 'haloSize', 0.1, 0.8, 0.01, '×'), slider('Stars', o.topper, 'haloStars', 3, 11, 2, '')),
        h('h3', { text: 'Plaque' }),
        check('Raised border', 'A framed edge around the text', o.plaque, 'border'),
        o.plaque.border && sub(check('Double border', null, o.plaque, 'doubleBorder')),
        check('Corner rivets', null, o.plaque, 'studs'),
        check('Side scrolls', 'Curled flourishes at both ends', o.plaque, 'scrolls'),
        check('Laurel sprigs', 'Leaves flanking the plate', o.plaque, 'laurel'),
        S().plaque.mount === 'none' && h('div', { class: 'note warn', text: 'The plaque is turned off, so plaque details are hidden.' }),
      ];
    },

    extras() {
      const out = [
        h('h2', { text: 'Extras' }),
        h('p', { class: 'lead', text: 'Add your own lettering or STL models anywhere on the trophy. Weld them in, engrave them, or keep them as separate pieces.' }),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', text: '＋ Text', onClick: () => { S().extras.push(newExtra('text')); changed(); render(); } }),
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
    const isText = ex.type === 'text';
    const del = h('button', { class: 'btn small danger', text: '✕', title: 'Remove', type: 'button', onClick: () => { S().extras.splice(i, 1); changed(); render(); } });
    const faces = ['baseFront', 'baseBack', 'baseLeft', 'baseRight', 'plaqueFront', 'column'];
    const box = h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: isText ? `Text: “${(ex.text || '').slice(0, 18)}”` : 'STL model' }), del));
    if (isText) {
      box.append(textInput('Text', ex, 'text', 'Your text'), fontSelect('Font', ex, 'font'),
        slider('Letter size', ex, 'size', 2, 60, 0.5), slider('Depth', ex, 'depth', 0.3, 12, 0.1), slider('Thicken', ex, 'embolden', 0, 2, 0.05));
    } else {
      box.append(...stlPicker(ex, 'assetId'), slider('Scale', ex, 'scale', 5, 600, 1, '%'), slider('Or fit size', ex, 'fitHeight', 0, 250, 1, 'mm'),
        slider('Rotate X', ex, 'rx', -180, 180, 5, '°'), slider('Rotate Y', ex, 'ry', -180, 180, 5, '°'), slider('Rotate Z', ex, 'rz', -180, 180, 5, '°'));
    }
    box.append(select('Place on', ANCHORS, ex, 'anchor', () => { if (isText && !faces.includes(ex.anchor) && ex.orient === 'upright') ex.orient = 'flat'; if (isText && faces.includes(ex.anchor)) ex.orient = 'upright'; render(); }));
    if (isText) box.append(segRow('Lettering', [['upright', 'Upright'], ['flat', 'Lying flat']], ex, 'orient'), segRow('Align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], ex, 'align'));
    box.append(segRow('Mode', [['weld', 'Weld on'], ['engrave', 'Engrave'], ['separate', 'Separate']], ex, 'mode'),
      slider('Move sideways', ex, 'ox', -100, 100, 0.5), slider('Move up', ex, 'oz', -100, 100, 0.5), slider('Push in/out', ex, 'oy', -40, 40, 0.5));
    if (isText) box.append(slider('Rotate', ex, 'rz', -180, 180, 1, '°'));
    return box;
  }

  /* ---------------------------------------------------------------- assets */
  function stlPicker(obj, key) {
    const ids = Object.keys(app.assets);
    const out = [];
    if (ids.length) out.push(select('Model', [['', '— choose —'], ...ids.map((id) => [id, app.assets[id].name])], obj, key, () => render()));
    out.push(h('div', { class: 'btns' }, h('button', { class: 'btn', text: '📂 Upload STL…', onClick: () => app.pickStl((id) => { obj[key] = id; changed(true); render(); }) })));
    if (obj[key] && app.assets[obj[key]] && !app.assets[obj[key]].manifold) out.push(h('div', { class: 'note warn', text: app.assets[obj[key]].reason }));
    return out;
  }
  function assetList() {
    const ids = Object.keys(app.assets);
    if (!ids.length) return [h('div', { class: 'note', text: 'No STL files loaded. Uploaded models stay in your browser — they are never sent anywhere.' })];
    return ids.map((id) => {
      const a = app.assets[id];
      return h('div', { class: 'panelbox' }, h('div', { class: 'hd' }, h('b', { text: a.name }), h('button', { class: 'btn small danger', text: 'Remove', onClick: () => app.removeAsset(id) })),
        h('div', { class: 'kv' }, h('span', { text: 'Triangles' }), h('span', { text: String(a.soup.length / 9) }), h('span', { text: 'Weldable' }), h('span', { text: a.manifold ? 'Yes — watertight ✓' : 'No — exported as its own shell' })));
    });
  }
  function fontUploadBtn() { return h('button', { class: 'btn', text: 'Aa Upload font…', title: 'TTF, OTF or WOFF', onClick: () => app.pickFont(() => render()) }); }
  function fontUploadRow() { return h('div', { class: 'btns' }, fontUploadBtn()); }

  render();
  return { render, setTab: (t) => { tab = t; render(); } };
}

export { MATERIALS };
