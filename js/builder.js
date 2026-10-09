// Assembles a trophy from the UI state into watertight solids.
import {
  Manifold, scoped, cached, dropCached, pruneCached, cleanDust, union, box, quality, toMeshData, meshStats, polys, bounds, rad, cyl,
} from './kernel.js';
import { getBase } from './parts/bases.js';
import { getColumn } from './parts/columns.js';
import { getTopper } from './parts/toppers.js';
import { buildPlaque } from './parts/plaques.js';
import { decorateBase, decorateColumn, decorateTopper } from './parts/ornaments.js';
import { textCross } from './text.js';

import { defaultState, newExtra, ANCHORS } from './state.js';
export { defaultState, newExtra, ANCHORS };

const GROUP_OF_ANCHOR = { baseFront: 'base', baseBack: 'base', baseLeft: 'base', baseRight: 'base', baseTop: 'base', column: 'column', topperTop: 'topper', plaqueFront: 'plaque', floor: 'base' };

/* ---------------------------------------------------------------- soup transforms (non-manifold STL fallback) */
function rotMatrix(rx, ry, rz) {
  const a = rad(rx), b = rad(ry), c = rad(rz);
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // Rz * Ry * Rx (same order as Manifold.rotate)
  return [
    [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
    [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
    [-sb, cb * sa, cb * ca],
  ];
}
function transformSoup(soup, { scale = 1, rot = [0, 0, 0], rotZ = 0, anchorRot = 0, offset = [0, 0, 0], center = true, sit = true }) {
  const R = rotMatrix(...rot);
  const out = new Float32Array(soup.length);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) {
    const v = [soup[i] * scale, soup[i + 1] * scale, soup[i + 2] * scale];
    const r = [0, 1, 2].map((k) => R[k][0] * v[0] + R[k][1] * v[1] + R[k][2] * v[2]);
    out[i] = r[0]; out[i + 1] = r[1]; out[i + 2] = r[2];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], r[k]); max[k] = Math.max(max[k], r[k]); }
  }
  const shift = [center ? -(min[0] + max[0]) / 2 : 0, center ? -(min[1] + max[1]) / 2 : 0, sit ? -min[2] : -(min[2] + max[2]) / 2];
  const ca = Math.cos(rad(anchorRot)), sa = Math.sin(rad(anchorRot));
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i] + shift[0] + offset[0], y = out[i + 1] + shift[1] + offset[1];
    out[i] = x * ca - y * sa; out[i + 1] = x * sa + y * ca; out[i + 2] = out[i + 2] + shift[2] + offset[2];
  }
  return out;
}

function soupExtent(soup) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], soup[i + k]); mx[k] = Math.max(mx[k], soup[i + k]); }
  return Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
}

const SINK = 0.3; // how far the plaque is pushed into the base (mm)

/* ---------------------------------------------------------------- main */
export function buildTrophy(state, assets = {}) {
  quality.factor = state.output.quality || 1;
  return scoped(() => {
    const dbg = globalThis.TM_DEBUG ? (l) => console.log(`  [${(performance.now() - T0).toFixed(0)}ms] ${l}`) : () => {};
    const T0 = performance.now();
    const warnings = [];
    const groups = { base: [], column: [], topper: [], plaque: [], plaqueText: [] };
    const engraves = { base: [], column: [], topper: [], plaque: [] };
    const looseBodies = []; // {name, manifold|soup}
    const S = state;

    /* ---- base ---- */
    const bdef = getBase(S.base.style);
    const qk = quality.factor;
    const baseKey = JSON.stringify([S.base, S.orn.base, qk]);
    const base0 = cached('base', baseKey, () => {
      const b = bdef.build({ width: S.base.width, depth: bdef.rect ? S.base.depth : S.base.width, height: S.base.height, podiumNumbers: S.orn.base.podiumNumbers });
      return decorateBase(b, S.orn.base);
    });
    const lift = base0.lift || 0;
    const base = { ...base0, halfAt: lift ? (z) => base0.halfAt(z - lift) : base0.halfAt };
    groups.base.push({ m: base.solid, key: baseKey });
    const baseTopZ = base.top[2];

    dbg('base');
    /* ---- column ---- */
    let colTop = baseTopZ;
    const cdef = getColumn(S.column.style);
    if (cdef.build) {
      // built 0.6 mm taller than asked so it overlaps the base and the topper (exact face contact would leave two separate shells)
      const colKey = JSON.stringify([S.column, S.orn.column, qk]);
      const col = cached('column', colKey, () => decorateColumn(cdef.build({ height: S.column.height + 0.6, radius: S.column.radius }), S.orn.column));
      groups.column.push({ m: col.solid.translate([base.top[0], base.top[1], baseTopZ - 0.3]), key: colKey + JSON.stringify([base.top, baseTopZ]) });
      colTop = baseTopZ + S.column.height;
    } else dropCached('column');

    dbg('column');
    /* ---- topper ---- */
    let topperTop = colTop;
    const T = S.topper;
    const tdef = getTopper(T.style);
    const stlAsset = T.style === 'stl' ? assets[T.stlId] : null;
    const topperKey = JSON.stringify([T, S.orn.topper, qk, stlAsset ? stlAsset.rev : 0]);
    let topperRes = null; // { solid, h }
    if (T.style === 'stl') {
      if (stlAsset && stlAsset.manifold) {
        topperRes = cached('topper', topperKey, () => {
          let m = stlAsset.manifold.rotate([T.rx || 0, T.ry || 0, T.rz || 0]);
          let bb = bounds(m);
          m = m.scale(T.size / (Math.max(...bb.size) || 1));
          bb = bounds(m);
          m = decorateTopper(m.translate([-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2, -bb.min[2]]), T.size, S.orn.topper);
          return { solid: m, h: bounds(m).max[2] };
        });
      } else if (stlAsset) {
        const rot = [T.rx || 0, T.ry || 0, T.rz || 0];
        const probe = transformSoup(stlAsset.soup, { rot });
        looseBodies.push({ name: 'topper-stl', group: 'topper', soup: transformSoup(stlAsset.soup, { scale: T.size / (soupExtent(probe) || 1), rot, offset: [base.top[0], base.top[1], colTop] }) });
        warnings.push(stlAsset.reason || 'Uploaded STL is not watertight; exported as a separate unwelded shell.');
        topperTop = colTop + T.size;
      } else warnings.push('Choose an STL file for the topper.');
    } else if (tdef.build) {
      topperRes = cached('topper', topperKey, () => {
        const m = decorateTopper(tdef.build(T.size, { text: T.text, font: T.font, embolden: T.embolden, backing: T.backing }), T.size, S.orn.topper);
        return { solid: m, h: bounds(m).max[2] };
      });
    } else dropCached('topper');
    if (topperRes) {
      // sink the topper 0.3 mm into whatever it stands on so the weld is a real overlap, not a coplanar touch
      groups.topper.push({ m: topperRes.solid.translate([base.top[0], base.top[1], colTop - 0.3]), key: topperKey + JSON.stringify([base.top, colTop]) });
      topperTop = colTop - 0.3 + topperRes.h;
    }

    dbg('topper');
    /* ---- plaque ---- */
    let plaqueInfo = null;
    const PL = S.plaque;
    if (PL.mount === 'none') dropCached('plaque');
    else {
      const sep = PL.mount === 'separate';
      const mnt = sep ? { ...base.mount, curved: null, maxW: Infinity, maxH: Infinity } : base.mount;
      const ph = Math.max(6, Math.min(PL.height, mnt.maxH));
      let pw = Math.max(10, Math.min(PL.width, mnt.maxW));
      if (mnt.curved) {
        // on a round base the flourishes at the plate ends must still reach the curved surface
        const reach = S.orn.plaque.scrolls ? 0.85 * ph : S.orn.plaque.laurel ? 0.34 * ph : 0;
        const lim = 2 * (0.97 * mnt.curved.a - reach);
        if (reach && lim >= 10) pw = Math.min(pw, lim);
      }
      if (pw < PL.width - 0.01 || ph < PL.height - 0.01) warnings.push(`Plaque shrunk to ${pw.toFixed(0)}×${ph.toFixed(0)} mm to fit the base — pick a taller/wider base for a bigger plaque.`);
      // raised text is fused into the plate here (inside the cache entry) whenever the final body is a single welded solid
      const mergeText = !sep && S.output.mode !== 'parts' && !S.output.splitText;
      const plKey = JSON.stringify([PL, S.orn.plaque, pw, ph, mnt.curved, qk, mergeText]);
      const plRes = cached('plaque', plKey, () => {
        // built SINK mm thicker and shifted back into the base: the weld is a true overlap, never a coplanar touch
        const plq = buildPlaque({ ...PL, width: pw, height: ph, thickness: PL.thickness + (sep ? 0 : SINK), orn: S.orn.plaque }, { embed: sep ? 0 : mnt.curved ? 5 : 4 });
        const warp = (m) => {
          if (!mnt.curved) return m;
          const { a, b } = mnt.curved;
          return m.refineToLength(2.2).warp((v) => { const x = Math.min(Math.abs(v[0]), a * 0.985); v[1] += b * (1 - Math.sqrt(1 - (x / a) ** 2)); });
        };
        const body = warp(plq.body), text = plq.text ? warp(plq.text) : null;
        return mergeText && text ? { body: union([body, text]), text: null } : { body, text };
      });
      const { body, text } = plRes;
      const place = (m) => m.translate([0, sep ? 0 : SINK, 0]).rotate([-(mnt.tilt + (PL.tilt || 0)), 0, 0]).translate([0, mnt.y, mnt.z]);
      if (PL.mount === 'separate') {
        // lay flat beside the base so it can be printed on its own
        const flat = (m) => m.rotate([-90, 0, 0]).translate([0, 0, 0]);
        const f = flat(body);
        const fb = bounds(f);
        const bf = bounds(base.solid);
        const dx = bf.max[0] + (fb.max[0] - fb.min[0]) / 2 + 12;
        const place2 = (m) => m.translate([dx - (fb.min[0] + fb.max[0]) / 2, -(fb.min[1] + fb.max[1]) / 2, -fb.min[2]]);
        looseBodies.push({ name: 'plaque', group: 'plaque', manifold: place2(f) });
        if (text) looseBodies.push({ name: 'plaque-text', group: 'plaqueText', manifold: place2(flat(text)) });
      } else {
        const placed = place(body);
        const plPlace = plKey + JSON.stringify([mnt.y, mnt.z, mnt.tilt, PL.tilt, SINK]);
        groups.plaque.push({ m: placed, key: plPlace });
        if (text) groups.plaqueText.push({ m: place(text), key: plPlace + 'text' });
        plaqueInfo = { place, pw, ph, t: PL.thickness, key: plPlace };
      }
    }

    dbg('plaque');
    /* ---- extras ---- */
    const zMid = baseTopZ * 0.5;
    const anchorFor = (name) => {
      const hz = base.halfAt(Math.max(zMid, 0.5));
      switch (name) {
        case 'baseFront': return { pos: [0, -hz[1] + 0.0, zMid], rotZ: 0, kind: 'face' };
        case 'baseBack': return { pos: [0, hz[1], zMid], rotZ: 180, kind: 'face' };
        case 'baseLeft': return { pos: [-hz[0], 0, zMid], rotZ: -90, kind: 'face' };
        case 'baseRight': return { pos: [hz[0], 0, zMid], rotZ: 90, kind: 'face' };
        case 'baseTop': return { pos: [base.top[0], base.top[1], baseTopZ], rotZ: 0, kind: 'top' };
        case 'column': return { pos: [base.top[0], base.top[1], baseTopZ + (colTop - baseTopZ) / 2], rotZ: 0, kind: 'face' };
        case 'topperTop': return { pos: [base.top[0], base.top[1], topperTop], rotZ: 0, kind: 'top' };
        case 'plaqueFront': return { pos: [0, 0, 0], rotZ: 0, kind: 'face', plaque: true };
        default: return { pos: [0, 0, 0], rotZ: 0, kind: 'top' };
      }
    };
    const usedExtras = new Set();
    for (const ex of S.extras) {
      const an = anchorFor(ex.anchor);
      if (an.plaque && !plaqueInfo) { warnings.push('An extra is anchored to the plaque, but there is no mounted plaque.'); continue; }
      const group = GROUP_OF_ANCHOR[ex.anchor];
      let solid = null, soupBody = null;
      const placeLocal = (m) => {
        // m is in anchor-local coordinates (x right, y into the surface, z up)
        let r = m.translate([ex.ox || 0, ex.oy || 0, ex.oz || 0]);
        if (an.plaque) {
          r = r.translate([0, -plaqueInfo.t, 0]);
          return plaqueInfo.place(r);
        }
        return r.rotate([0, 0, an.rotZ]).translate(an.pos);
      };
      let asset = null;
      if (ex.type === 'stl') {
        asset = assets[ex.assetId];
        if (!asset) { warnings.push('An STL extra has no file loaded.'); continue; }
        if (!asset.manifold) {
          // not watertight: transformed as raw triangles and exported as its own shell
          warnings.push(asset.reason || 'An uploaded STL is not watertight; it is exported as a separate unwelded shell.');
          const k = (ex.scale || 100) / 100;
          const sit = an.kind === 'top' || ex.anchor === 'floor';
          let sc = k;
          if (ex.fitHeight > 0) sc = ex.fitHeight / (soupExtent(transformSoup(asset.soup, { rot: [ex.rx || 0, ex.ry || 0, ex.rz || 0] })) || 1);
          soupBody = transformSoup(asset.soup, { scale: sc, rot: [ex.rx || 0, ex.ry || 0, ex.rz || 0], anchorRot: an.rotZ, offset: [an.pos[0] + (ex.ox || 0), an.pos[1] + (ex.oy || 0), an.pos[2] + (ex.oz || 0)], sit });
        }
      }
      if (!soupBody) {
        // each extra's placed solid is cached on everything that can change it, so unrelated edits skip the work
        const exKey = JSON.stringify([ex, an.pos, an.rotZ, an.kind, an.plaque ? plaqueInfo.key : 0, qk, asset ? asset.rev : 0]);
        usedExtras.add('ex:' + ex.id);
        const built = cached('ex:' + ex.id, exKey, () => {
          let m = null;
          if (ex.type === 'text') {
            const cs = textCross(ex.font, ex.text || ' ', ex.size, { embolden: ex.embolden || 0, align: ex.align || 'center' });
            if (!cs) return { solid: null };
            const depth = Math.max(0.2, ex.depth);
            const engrave = ex.mode === 'engrave';
            const e = engrave ? Manifold.extrude(cs, depth + 0.6, 0, 0, 1).translate([0, 0, -depth]) : Manifold.extrude(cs, depth + 0.4, 0, 0, 1).translate([0, 0, -0.4]);
            m = (ex.orient === 'flat' || (an.kind === 'top' && ex.orient !== 'upright')) ? e : e.rotate([90, 0, 0]);
            if (ex.rz) m = m.rotate([0, 0, ex.rz]);
          } else {
            const k = (ex.scale || 100) / 100;
            const sit = an.kind === 'top' || ex.anchor === 'floor';
            m = asset.manifold.rotate([ex.rx || 0, ex.ry || 0, ex.rz || 0]);
            if (ex.fitHeight > 0) { const bb = bounds(m); m = m.scale(ex.fitHeight / (Math.max(...bb.size) || 1)); } else m = m.scale(k);
            const b = bounds(m);
            m = m.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, sit ? -b.min[2] - 0.2 : -(b.min[2] + b.max[2]) / 2]);
            if (!sit) m = m.rotate([90, 0, 0]); // face-mounted: stand it up on the surface
          }
          return { solid: placeLocal(m) };
        });
        solid = built.solid;
      }
      if (soupBody) { looseBodies.push({ name: 'extra-stl', group: 'extra', soup: soupBody }); continue; }
      if (!solid) continue;
      const exMemberKey = 'ex:' + ex.id + JSON.stringify([ex.mode, ex.anchor, an.pos, an.rotZ]) + (an.plaque ? plaqueInfo.key : '') + JSON.stringify(ex) + (asset ? asset.rev : '');
      if (ex.mode === 'engrave') engraves[group].push({ m: solid, key: exMemberKey });
      else if (ex.mode === 'separate') looseBodies.push({ name: ex.type === 'text' ? 'text-' + (ex.text || '').slice(0, 12) : 'stl-' + ex.id, group: 'extra', manifold: solid });
      else groups[group].push({ m: solid, key: exMemberKey });
    }
    pruneCached('ex:', usedExtras);

    dbg('extras');
    const usesStl = S.topper.style === 'stl' || S.extras.some((e) => e.type === 'stl');

    /* ---- assemble ---- */
    const bodies = [];
    const finalize = (m, name, group) => {
      if (!m || m.isEmpty()) return;
      const dust = /text/i.test(name) ? { minSolid: 0.004, minVoid: 0.5 } // lettering: keep every dot and stop
        : usesStl ? { minSolid: 0.5, minVoid: 2 } // never trim features of a user's own model
        : { minSolid: 5, minVoid: 2 }; // our own geometry: floating bits under ~1.7 mm cubed can never print
      bodies.push({ name, group, manifold: cleanDust(m, dust) });
    };
    const groupKey = (g) => JSON.stringify([groups[g].map((i) => i.key), (engraves[g] || []).map((i) => i.key)]);
    const groupSolid = (g) => {
      if (!groups[g].length) { dropCached('grp:' + g); return null; }
      const eng = engraves[g] || [];
      if (groups[g].length === 1 && !eng.length) { dropCached('grp:' + g); return groups[g][0].m; }
      // the union of a group (e.g. base + its extras) is cached on its members, so an edit elsewhere skips it
      return cached('grp:' + g, groupKey(g), () => {
        let m = union(groups[g].map((i) => i.m));
        if (eng.length) m = m.subtract(union(eng.map((i) => i.m)));
        return { solid: m };
      }).solid;
    };

    if (S.output.mode === 'parts') {
      // separate, non-overlapping parts (each later part is trimmed against the earlier ones)
      let acc = null;
      for (const g of ['base', 'column', 'topper', 'plaque', 'plaqueText']) {
        let m = groupSolid(g);
        if (!m) continue;
        if (acc) m = m.subtract(acc);
        finalize(m, g === 'plaqueText' ? 'plaque-text' : g, g);
        acc = acc ? acc.add(m) : m;
      }
    } else {
      // everything below the topper is cached as one solid, so dragging the topper size only unions two things
      const lowerParts = ['base', 'column', 'plaque'].map(groupSolid).filter(Boolean);
      const lower = lowerParts.length > 1
        ? cached('lower', JSON.stringify(['base', 'column', 'plaque'].map(groupKey)), () => ({ solid: union(lowerParts) })).solid
        : (dropCached('lower'), lowerParts[0] || null);
      const solids = [lower, groupSolid('topper')].filter(Boolean);
      let whole = solids.length ? union(solids) : null;
      const txt = groupSolid('plaqueText');
      if (txt) {
        if (S.output.splitText && whole) finalize(txt.subtract(whole), 'plaque-text', 'plaqueText');
        else whole = whole ? whole.add(txt) : txt;
      }
      // engrave leftovers (extras anchored to groups were already applied per group)
      if (whole) finalize(whole, 'trophy', 'trophy');
    }
    for (const lb of looseBodies) {
      if (lb.manifold) finalize(lb.manifold, lb.name, lb.group);
      else bodies.push({ name: lb.name, group: lb.group, soup: lb.soup });
    }

    dbg('assembled');
    /* ---- extract meshes ---- */
    let zmin = Infinity, zmax = -Infinity;
    const out = [];
    let volume = 0, triangles = 0;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const b of bodies) {
      let md, stats = null;
      if (b.manifold) {
        md = toMeshData(b.manifold);
        stats = meshStats(b.manifold);
        volume += stats.volume;
      } else md = { positions: b.soup, indices: null };
      const pos = md.positions;
      for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
      triangles += md.indices ? md.indices.length / 3 : pos.length / 9;
      out.push({ name: b.name, group: b.group, positions: pos, indices: md.indices, watertight: !!b.manifold, genus: stats ? stats.genus : null, volume: stats ? stats.volume : null });
    }
    // uniform scale to a requested overall height
    let scale = 1;
    const height = mx[2] - mn[2];
    if (S.output.scaleTo > 0 && isFinite(height) && height > 0) scale = S.output.scaleTo / height;
    if (scale !== 1) for (const b of out) { for (let i = 0; i < b.positions.length; i++) b.positions[i] *= scale; if (b.volume) b.volume *= scale ** 3; }
    const size = [0, 1, 2].map((k) => (mx[k] - mn[k]) * scale);
    dbg('meshes');
    return { bodies: out, warnings, stats: { triangles, volume: volume * scale ** 3, size, scale }, info: { baseTopZ, colTop, topperTop } };
  });
}
