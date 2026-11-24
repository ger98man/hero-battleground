// Placeholder figures for heroes and units, drawn as SVG from a small spec (src/game/factions.ts → model):
// body shape, weapon, headgear, shield / cape / wings and a tint. One function: hbModel(spec, faction) → SVG string.
(() => {
  let uid = 0;

  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => clamp(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
    const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  const SKIN = { dawn: "#e3b98f", ash: "#b98a5e", rot: "#b8c2b0", grove: "#d9c3a0" };
  const STEEL = "#c7ccd6";
  const WOOD = "#7a5432";
  const OUT = 'stroke="#140f0a" stroke-width="1.2" stroke-linejoin="round"';

  // ---------- parts ----------
  function head(x, y, r, kind, c) {
    const face = kind === "skull"
      ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8e2cf" ${OUT}/><circle cx="${x - r * .35}" cy="${y - r * .05}" r="${r * .25}" fill="#1a1410"/><circle cx="${x + r * .35}" cy="${y - r * .05}" r="${r * .25}" fill="#1a1410"/><path d="M${x - r * .3} ${y + r * .55}h${r * .6}" stroke="#1a1410" stroke-width="1.2"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#skin${c.id})" ${OUT}/><circle cx="${x - r * .35}" cy="${y}" r="${r * .12}" fill="#1a1410"/><circle cx="${x + r * .35}" cy="${y}" r="${r * .12}" fill="#1a1410"/>`;
    const gear = {
      helm: `<path d="M${x - r * 1.1} ${y + r * .2}Q${x - r * 1.1} ${y - r * 1.3} ${x} ${y - r * 1.25}Q${x + r * 1.1} ${y - r * 1.3} ${x + r * 1.1} ${y + r * .2}L${x + r * .55} ${y + r * .2}L${x + r * .55} ${y - r * .25}L${x - r * .55} ${y - r * .25}L${x - r * .55} ${y + r * .2}Z" fill="url(#steel${c.id})" ${OUT}/><path d="M${x} ${y - r * 1.25}v-${r * .5}" stroke="${c.trim}" stroke-width="2.4"/>`,
      hood: `<path d="M${x - r * 1.25} ${y + r * 1.1}Q${x - r * 1.3} ${y - r * 1.5} ${x} ${y - r * 1.5}Q${x + r * 1.3} ${y - r * 1.5} ${x + r * 1.25} ${y + r * 1.1}Q${x + r * .7} ${y - r * .4} ${x} ${y - r * .5}Q${x - r * .7} ${y - r * .4} ${x - r * 1.25} ${y + r * 1.1}Z" fill="${shade(c.tint, -.25)}" ${OUT}/>`,
      horns: `<path d="M${x - r * .8} ${y - r * .6}Q${x - r * 2} ${y - r * .8} ${x - r * 1.6} ${y - r * 2}Q${x - r * 1.3} ${y - r * 1.1} ${x - r * .4} ${y - r * .95}Z" fill="#e6dcc2" ${OUT}/><path d="M${x + r * .8} ${y - r * .6}Q${x + r * 2} ${y - r * .8} ${x + r * 1.6} ${y - r * 2}Q${x + r * 1.3} ${y - r * 1.1} ${x + r * .4} ${y - r * .95}Z" fill="#e6dcc2" ${OUT}/>`,
      crown: `<path d="M${x - r * .85} ${y - r * .55}L${x - r * .9} ${y - r * 1.5}L${x - r * .4} ${y - r * 1.05}L${x} ${y - r * 1.7}L${x + r * .4} ${y - r * 1.05}L${x + r * .9} ${y - r * 1.5}L${x + r * .85} ${y - r * .55}Z" fill="${c.accent}" ${OUT}/>`,
      antlers: `<path d="M${x - r * .5} ${y - r * .8}l-${r * .5} -${r * 1.2}l-${r * .6} -${r * .2}M${x - r * .95} ${y - r * 1.7}l-${r * .1} -${r * .7}M${x + r * .5} ${y - r * .8}l${r * .5} -${r * 1.2}l${r * .6} -${r * .2}M${x + r * .95} ${y - r * 1.7}l${r * .1} -${r * .7}" stroke="#6a4a2a" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
      halo: `<ellipse cx="${x}" cy="${y - r * 1.35}" rx="${r * .9}" ry="${r * .28}" fill="none" stroke="#ffe9a0" stroke-width="2" filter="url(#glow${c.id})"/>`,
      feather: `<path d="M${x - r} ${y - r * .4}Q${x} ${y - r * 1.5} ${x + r} ${y - r * .4}Z" fill="${shade(c.tint, -.1)}" ${OUT}/><path d="M${x + r * .6} ${y - r * .9}Q${x + r * 1.8} ${y - r * 2.2} ${x + r * 1.6} ${y - r * 2.4}Q${x + r * 1.2} ${y - r * 1.6} ${x + r * .4} ${y - r * 1}Z" fill="${c.trim}" ${OUT}/>`,
      bare: kind === "bare" && c.hair ? `<path d="M${x - r} ${y - r * .1}Q${x - r} ${y - r * 1.15} ${x} ${y - r * 1.1}Q${x + r} ${y - r * 1.15} ${x + r} ${y - r * .1}Q${x + r * .4} ${y - r * .7} ${x - r} ${y - r * .1}Z" fill="#3a2a1a"/>` : "",
      skull: "",
    }[kind] ?? "";
    return kind === "hood" ? gear + face : face + gear;
  }

  function weapon(x, y, kind, c, scale = 1) {
    const s = scale;
    const w = {
      sword: `<path d="M${x} ${y}L${x + 4 * s} ${y - 26 * s}L${x + 6.5 * s} ${y - 25 * s}L${x + 3 * s} ${y + 1 * s}Z" fill="url(#steel${c.id})" ${OUT}/><path d="M${x - 4 * s} ${y + 1 * s}L${x + 7 * s} ${y - 1 * s}" stroke="${c.accent}" stroke-width="${3 * s}" stroke-linecap="round"/>`,
      spear: `<path d="M${x - 4 * s} ${y + 16 * s}L${x + 7 * s} ${y - 30 * s}" stroke="${WOOD}" stroke-width="${2.4 * s}" stroke-linecap="round"/><path d="M${x + 7 * s} ${y - 30 * s}l-${1 * s} -${9 * s}l${4.5 * s} ${7 * s}Z" fill="url(#steel${c.id})" ${OUT}/>`,
      bow: `<path d="M${x + 2 * s} ${y - 20 * s}Q${x + 14 * s} ${y} ${x + 2 * s} ${y + 20 * s}" fill="none" stroke="${WOOD}" stroke-width="${2.6 * s}"/><path d="M${x + 2 * s} ${y - 20 * s}L${x + 2 * s} ${y + 20 * s}" stroke="#e8e0c8" stroke-width=".8"/>`,
      crossbow: `<path d="M${x - 6 * s} ${y}h${18 * s}" stroke="${WOOD}" stroke-width="${3 * s}" stroke-linecap="round"/><path d="M${x + 9 * s} ${y - 9 * s}Q${x + 14 * s} ${y} ${x + 9 * s} ${y + 9 * s}" fill="none" stroke="#5a5048" stroke-width="${2.4 * s}"/>`,
      staff: `<path d="M${x} ${y + 22 * s}L${x + 2 * s} ${y - 26 * s}" stroke="${WOOD}" stroke-width="${2.6 * s}" stroke-linecap="round"/><circle cx="${x + 2 * s}" cy="${y - 29 * s}" r="${4.5 * s}" fill="${c.accent}" filter="url(#glow${c.id})"/>`,
      axe: `<path d="M${x - 2 * s} ${y + 10 * s}L${x + 4 * s} ${y - 22 * s}" stroke="${WOOD}" stroke-width="${2.6 * s}" stroke-linecap="round"/><path d="M${x + 3 * s} ${y - 20 * s}Q${x + 16 * s} ${y - 26 * s} ${x + 14 * s} ${y - 10 * s}Q${x + 8 * s} ${y - 14 * s} ${x + 1.5 * s} ${y - 13 * s}Z" fill="url(#steel${c.id})" ${OUT}/>`,
      hammer: `<path d="M${x - 2 * s} ${y + 10 * s}L${x + 3 * s} ${y - 20 * s}" stroke="${WOOD}" stroke-width="${2.8 * s}" stroke-linecap="round"/><rect x="${x - 5 * s}" y="${y - 28 * s}" width="${16 * s}" height="${9 * s}" rx="${1.5 * s}" fill="url(#steel${c.id})" ${OUT} transform="rotate(10 ${x + 3 * s} ${y - 23 * s})"/>`,
      scythe: `<path d="M${x - 2 * s} ${y + 20 * s}L${x + 3 * s} ${y - 26 * s}" stroke="#3a2a22" stroke-width="${2.6 * s}" stroke-linecap="round"/><path d="M${x + 3 * s} ${y - 26 * s}Q${x - 16 * s} ${y - 30 * s} ${x - 22 * s} ${y - 14 * s}Q${x - 12 * s} ${y - 24 * s} ${x + 2 * s} ${y - 20 * s}Z" fill="url(#steel${c.id})" ${OUT}/>`,
      claws: `<path d="M${x} ${y}l${5 * s} -${4 * s}M${x + 1 * s} ${y + 3 * s}l${6 * s} -${2 * s}M${x + 1 * s} ${y + 6 * s}l${6 * s} ${0.5 * s}" stroke="#f2ead6" stroke-width="${1.6 * s}" stroke-linecap="round"/>`,
      sling: `<path d="M${x} ${y}Q${x + 10 * s} ${y - 14 * s} ${x + 12 * s} ${y - 30 * s}" fill="none" stroke="#5a3a1a" stroke-width="${1.4 * s}"/><path d="M${x + 4 * s} ${y - 36 * s}Q${x + 20 * s} ${y - 38 * s} ${x + 18 * s} ${y - 20 * s}" fill="none" stroke="#e8e0c8" stroke-width="${1 * s}" stroke-dasharray="2 2" opacity=".8"/><circle cx="${x + 12 * s}" cy="${y - 30 * s}" r="${3.6 * s}" fill="#8a8a86" ${OUT}/>`,
      totem: `<path d="M${x} ${y + 22 * s}L${x + 1 * s} ${y - 30 * s}" stroke="${WOOD}" stroke-width="${3.4 * s}" stroke-linecap="round"/><rect x="${x - 5 * s}" y="${y - 40 * s}" width="${12 * s}" height="${14 * s}" rx="${2 * s}" fill="${shade(WOOD, .15)}" ${OUT}/><circle cx="${x - 1 * s}" cy="${y - 35 * s}" r="${1.4 * s}" fill="${c.accent}" filter="url(#glow${c.id})"/><circle cx="${x + 3.5 * s}" cy="${y - 35 * s}" r="${1.4 * s}" fill="${c.accent}" filter="url(#glow${c.id})"/><path d="M${x - 1 * s} ${y - 30 * s}h${5 * s}" stroke="#1a1410" stroke-width="1"/><path d="M${x - 5 * s} ${y - 40 * s}q-${6 * s} -${4 * s} -${4 * s} -${10 * s}M${x + 7 * s} ${y - 40 * s}q${6 * s} -${4 * s} ${4 * s} -${10 * s}" stroke="#e6dcc2" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/><path d="M${x + 7 * s} ${y - 28 * s}l${6 * s} ${8 * s}M${x + 7 * s} ${y - 26 * s}l${3 * s} ${10 * s}" stroke="${c.trim}" stroke-width="${1.6 * s}"/>`,
      twin_axes: "",
      none: "",
    };
    return w[kind] ?? "";
  }

  const shieldAt = (x, y, c, s = 1) =>
    `<path d="M${x - 8 * s} ${y - 9 * s}h${16 * s}v${7 * s}Q${x + 8 * s} ${y + 8 * s} ${x} ${y + 12 * s}Q${x - 8 * s} ${y + 8 * s} ${x - 8 * s} ${y - 2 * s}Z" fill="${c.trim}" ${OUT}/><path d="M${x} ${y - 6 * s}v${14 * s}M${x - 5 * s} ${y}h${10 * s}" stroke="${c.accent}" stroke-width="${2 * s}"/>`;

  const wingsAt = (x, y, c, s = 1) => {
    const fill = c.wingFill;
    return `<path d="M${x - 4} ${y}Q${x - 30 * s} ${y - 26 * s} ${x - 44 * s} ${y - 10 * s}Q${x - 34 * s} ${y - 6 * s} ${x - 36 * s} ${y + 4 * s}Q${x - 24 * s} ${y - 2 * s} ${x - 22 * s} ${y + 10 * s}Q${x - 12 * s} ${y + 2 * s} ${x - 4} ${y + 6}Z" fill="${fill}" ${OUT} opacity=".95"/>` +
      `<path d="M${x + 4} ${y}Q${x + 30 * s} ${y - 26 * s} ${x + 44 * s} ${y - 10 * s}Q${x + 34 * s} ${y - 6 * s} ${x + 36 * s} ${y + 4 * s}Q${x + 24 * s} ${y - 2 * s} ${x + 22 * s} ${y + 10 * s}Q${x + 12 * s} ${y + 2 * s} ${x + 4} ${y + 6}Z" fill="${fill}" ${OUT} opacity=".95"/>`;
  };

  // A standing humanoid; `w` widens the body (giants), `robe` draws a robe instead of legs.
  function humanoid(spec, c, { w = 1, robe = false, spirit = false, top = 24, scale = 1 } = {}) {
    const cx = 50, hr = 9 * (w > 1.2 ? .85 : 1) * scale;
    const sh = top + hr + 2; // shoulders
    const half = 11 * w * scale;
    const hip = sh + 24 * scale, foot = Math.min(86, hip + 26 * scale);
    const parts = [];
    if (spec.cape) parts.push(`<path d="M${cx - half} ${sh + 2}Q${cx - half - 6} ${foot - 4} ${cx - half - 2} ${foot}L${cx + half + 2} ${foot}Q${cx + half + 6} ${foot - 4} ${cx + half} ${sh + 2}Z" fill="${c.trim}" ${OUT}/>`);
    if (spec.wings) parts.push(wingsAt(cx, sh + 8, c, .9));
    if (robe || spirit) {
      const hem = spirit
        ? `L${cx + half + 6} ${foot - 8}Q${cx + 6} ${foot - 16} ${cx + 2} ${foot}Q${cx - 4} ${foot - 12} ${cx - half - 6} ${foot - 8}`
        : `L${cx + half + 8} ${foot}L${cx - half - 8} ${foot}`;
      parts.push(`<path d="M${cx - half} ${sh}L${cx + half} ${sh}${hem}Z" fill="url(#body${c.id})" ${OUT} ${spirit ? 'opacity=".85" filter="url(#glow' + c.id + ')"' : ""}/>`);
      parts.push(`<path d="M${cx} ${sh + 2}V${foot - 2}" stroke="${c.trim}" stroke-width="2.4" opacity=".9"/>`);
    }
    if (!robe && !spirit) {
      parts.push(`<rect x="${cx - half * .8}" y="${hip - 2}" width="${half * .7}" height="${foot - hip + 2}" rx="2" fill="${shade(c.tint, -.35)}" ${OUT}/>`);
      parts.push(`<rect x="${cx + half * .1}" y="${hip - 2}" width="${half * .7}" height="${foot - hip + 2}" rx="2" fill="${shade(c.tint, -.35)}" ${OUT}/>`);
      parts.push(`<path d="M${cx - half} ${sh}L${cx + half} ${sh}L${cx + half * .85} ${hip + 2}L${cx - half * .85} ${hip + 2}Z" fill="url(#body${c.id})" ${OUT}/>`);
      parts.push(`<rect x="${cx - half * .85}" y="${hip - 3}" width="${half * 1.7}" height="4" fill="${c.trim}" ${OUT}/>`);
    }
    if (spec.body === "knight") {
      parts.push(`<ellipse cx="${cx - half}" cy="${sh + 2}" rx="${5 * w}" ry="4" fill="url(#steel${c.id})" ${OUT}/><ellipse cx="${cx + half}" cy="${sh + 2}" rx="${5 * w}" ry="4" fill="url(#steel${c.id})" ${OUT}/>`);
    }
    // arms
    const handY = sh + 18 * scale;
    parts.push(`<path d="M${cx - half} ${sh + 2}L${cx - half - 5} ${handY}" stroke="${shade(c.tint, -.15)}" stroke-width="${5 * w}" stroke-linecap="round"/>`);
    parts.push(`<path d="M${cx + half} ${sh + 2}L${cx + half + 5} ${handY}" stroke="${shade(c.tint, -.15)}" stroke-width="${5 * w}" stroke-linecap="round"/>`);
    parts.push(head(cx, top, hr, spec.head, c));
    if (spec.weapon === "twin_axes") {
      // a throwing axe in each hand, the left one mirrored, smaller and raised
      parts.push(weapon(cx + half + 5, handY, "axe", c, scale * .8));
      const lx = cx - half - 5;
      parts.push(`<g transform="translate(${2 * lx} -6) scale(-1 1)">${weapon(lx, handY, "axe", c, scale * .8)}</g>`);
    } else parts.push(weapon(cx + half + 5, handY, spec.weapon, c, scale * (w > 1.2 ? 1.15 : 1)));
    if (spec.shield) parts.push(shieldAt(cx - half - 5, handY, c, scale));
    return parts.join("");
  }

  // A four-legged animal facing right; `y` lifts it (flyers).
  function beast(spec, c, { y = 0, s = 1, neck = false } = {}) {
    const by = 60 - y;
    const parts = [];
    if (spec.wings) parts.push(wingsAt(48, by - 6, c, 1.05));
    parts.push(`<path d="M${24} ${by - 2}Q${10} ${by - 10} ${12} ${by - 22}" stroke="${shade(c.tint, -.2)}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    for (const lx of [30, 38, 58, 66]) parts.push(`<rect x="${lx}" y="${by + 4}" width="5" height="${y ? 14 : 22}" rx="2" fill="${shade(c.tint, -.3)}" ${OUT}/>`);
    parts.push(`<ellipse cx="48" cy="${by}" rx="${24 * s}" ry="${12 * s}" fill="url(#body${c.id})" ${OUT}/>`);
    const hx = neck ? 82 : 76, hy = neck ? by - 30 : by - 12;
    if (neck) parts.push(`<path d="M64 ${by - 6}Q76 ${by - 14} ${hx - 4} ${hy + 6}" stroke="url(#body${c.id})" stroke-width="9" fill="none" stroke-linecap="round"/>`);
    parts.push(`<ellipse cx="${hx}" cy="${hy}" rx="9" ry="7" fill="url(#body${c.id})" ${OUT}/><path d="M${hx + 6} ${hy + 1}l7 2l-7 3Z" fill="${shade(c.tint, -.25)}" ${OUT}/><circle cx="${hx + 2}" cy="${hy - 2}" r="1.4" fill="${spec.head === "skull" ? "#7ee07a" : "#1a1410"}"/>`);
    if (spec.head === "horns" || spec.head === "skull") parts.push(`<path d="M${hx - 4} ${hy - 5}q-6 -8 -1 -12q0 6 4 9Z" fill="#e6dcc2" ${OUT}/>`);
    if (spec.head === "antlers") parts.push(`<path d="M${hx - 2} ${hy - 6}l-4 -10l-5 -2M${hx - 6} ${hy - 16}l1 -6M${hx + 2} ${hy - 6}l3 -10l5 -2" stroke="#e8d8b0" stroke-width="2" stroke-linecap="round" fill="none" filter="url(#glow${c.id})"/>`);
    if (spec.weapon === "spear") parts.push(`<path d="M${hx + 2} ${hy - 6}l6 -14l-1 15Z" fill="#fff4d0" ${OUT} filter="url(#glow${c.id})"/>`);
    if (spec.weapon === "claws") parts.push(weapon(70, by + 18 - (y ? 4 : 0), "claws", c, .8));
    return parts.join("");
  }

  function rider(spec, c) {
    const mountTint = { dawn: "#e9ecf2", ash: "#6b6f74", rot: "#2a2a2e", grove: "#c8b090" }[c.faction] ?? "#8a7a6a";
    const mount = beast({ ...spec, tint: mountTint, wings: false, head: "bare", weapon: "none" }, { ...c, tint: mountTint, id: c.id + "m" }, { y: 0, s: .95 });
    const r = humanoid({ ...spec, body: "soldier" }, c, { top: 16, scale: .72 }).replace(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="2" fill="[^"]+" stroke[^>]+\/>/g, "");
    return mount + `<g transform="translate(-6 8)">${r}</g>`;
  }

  function siege(spec, c) {
    const parts = [];
    parts.push(`<path d="M18 74L50 30L82 74" stroke="${WOOD}" stroke-width="5" fill="none" stroke-linejoin="round"/>`);
    parts.push(`<rect x="14" y="70" width="72" height="8" rx="2" fill="${shade(WOOD, .1)}" ${OUT}/>`);
    for (const wx of [24, 76]) parts.push(`<circle cx="${wx}" cy="${82}" r="8" fill="#4a3220" ${OUT}/><circle cx="${wx}" cy="82" r="2.5" fill="${c.accent}"/>`);
    if (spec.weapon === "crossbow") parts.push(`<path d="M30 52h44" stroke="${WOOD}" stroke-width="4"/><path d="M68 36Q78 52 68 68" stroke="#3a3028" stroke-width="3" fill="none"/><path d="M74 52l8 0" stroke="${STEEL}" stroke-width="3"/>`);
    else if (spec.weapon === "hammer") parts.push(`<rect x="24" y="44" width="54" height="12" rx="3" fill="${WOOD}" ${OUT}/><path d="M78 40l8 10l-8 10Z" fill="${STEEL}" ${OUT}/>`);
    else if (spec.weapon === "scythe") parts.push(`<rect x="22" y="50" width="56" height="20" rx="3" fill="${shade(c.tint, -.1)}" ${OUT}/><circle cx="40" cy="44" r="7" fill="#7ee07a" opacity=".55" filter="url(#glow${c.id})"/><circle cx="56" cy="40" r="9" fill="#7ee07a" opacity=".45" filter="url(#glow${c.id})"/>`);
    else parts.push(`<path d="M50 34L26 16" stroke="${WOOD}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="14" r="6" fill="${spec.head === "skull" ? "#e8e2cf" : "#8a8a8a"}" ${OUT}/>`);
    parts.push(`<path d="M50 30v-6" stroke="${c.trim}" stroke-width="3"/><path d="M50 24h9l-3 3l3 3h-9" fill="${c.trim}"/>`);
    return parts.join("");
  }

  function tree(spec, c) {
    const parts = [];
    parts.push(`<path d="M40 88Q42 64 36 44L64 44Q58 64 60 88Z" fill="url(#body${c.id})" ${OUT}/>`);
    parts.push(`<path d="M38 52Q22 46 18 30M62 52Q78 46 84 32" stroke="${shade(c.tint, -.1)}" stroke-width="6" stroke-linecap="round" fill="none"/>`);
    parts.push(`<circle cx="50" cy="30" r="22" fill="#3f7a3a" ${OUT}/><circle cx="34" cy="26" r="11" fill="#4f8f44" ${OUT}/><circle cx="66" cy="24" r="12" fill="#4f8f44" ${OUT}/><circle cx="50" cy="14" r="10" fill="#5fa050" ${OUT}/>`);
    parts.push(`<circle cx="45" cy="56" r="2.2" fill="#ffe07a" filter="url(#glow${c.id})"/><circle cx="55" cy="56" r="2.2" fill="#ffe07a" filter="url(#glow${c.id})"/><path d="M45 64q5 3 10 0" stroke="#1a1410" stroke-width="1.5" fill="none"/>`);
    if (spec.weapon === "hammer") parts.push(`<circle cx="86" cy="28" r="7" fill="#8a8a8a" ${OUT}/>`);
    if (spec.head === "antlers") parts.push(`<path d="M40 10l-6 -8M60 10l6 -8" stroke="#6a4a2a" stroke-width="3" stroke-linecap="round"/>`);
    return parts.join("");
  }

  function dragon(spec, c) {
    const parts = [];
    parts.push(wingsAt(46, 44, c, 1.15));
    parts.push(`<path d="M28 62Q10 70 8 84Q16 74 30 70" fill="url(#body${c.id})" ${OUT}/>`);
    for (const lx of [36, 60]) parts.push(`<rect x="${lx}" y="64" width="7" height="18" rx="3" fill="${shade(c.tint, -.3)}" ${OUT}/>`);
    parts.push(`<ellipse cx="48" cy="58" rx="22" ry="13" fill="url(#body${c.id})" ${OUT}/>`);
    parts.push(`<path d="M62 52Q74 40 74 26" stroke="url(#body${c.id})" stroke-width="10" fill="none" stroke-linecap="round"/>`);
    const skull = spec.head === "skull";
    parts.push(`<path d="M68 22Q76 14 88 22L90 28Q80 30 70 30Z" fill="${skull ? "#e8e2cf" : shade(c.tint, .1)}" ${OUT}/><circle cx="76" cy="22" r="1.8" fill="${skull ? "#7ee07a" : "#ffd040"}" filter="url(#glow${c.id})"/>`);
    parts.push(`<path d="M70 18q-4 -8 0 -12q1 6 4 8Z" fill="#e6dcc2" ${OUT}/>`);
    if (skull) parts.push(`<path d="M40 50v16M48 48v18M56 50v14" stroke="#1a1410" stroke-width="1.2" opacity=".7"/>`);
    return parts.join("");
  }

  // ---------- own figures of the 56 creatures (spec.shape = unit id) ----------
  // Every creature gets a silhouette of its own: four-legged beasts with different heads, tails and builds,
  // skeletons, hunched and bloated bodies, flyers and six kinds of siege engines.
  const BONE = "#e8e2cf";
  const INK = "#140f0a";
  /** A limb or neck: a thick round stroke with a dark outline. Points: [x, y, x, y, ...]. */
  function limb(pts, w, fill) {
    const d = `M${pts[0]} ${pts[1]}` + pts.slice(2).reduce((s, v, i) => s + (i % 2 ? ` ${v}` : `L${v}`), "");
    return `<path d="${d}" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
      `<path d="${d}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }
  const P = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${OUT} ${extra}/>`;
  const eye = (x, y, r = 1.4, col = "#1a1410", glow) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" ${glow ? `filter="url(#glow${glow})"` : ""}/>`;

  // heads of four-legged creatures, facing right, centred at (x, y)
  const HEADS = {
    horse: (x, y, f, c, o) => P(`M${x - 6} ${y - 5}Q${x + 2} ${y - 9} ${x + 13} ${y + 1}Q${x + 14} ${y + 6} ${x + 9} ${y + 7}L${x - 1} ${y + 5}Q${x - 8} ${y + 2} ${x - 6} ${y - 5}Z`, f) +
      P(`M${x - 4} ${y - 5}l1 -7l4 6Z`, f) + eye(x + 1, y - 2, 1.4, o.eye ?? "#1a1410", o.eye ? c.id : null) + `<circle cx="${x + 11}" cy="${y + 3}" r=".9" fill="#1a1410"/>`,
    wolf: (x, y, f, c, o) => P(`M${x - 7} ${y - 3}Q${x - 4} ${y - 9} ${x + 3} ${y - 6}L${x + 14} ${y + 1}L${x + 12} ${y + 4}L${x + 2} ${y + 6}Q${x - 7} ${y + 5} ${x - 7} ${y - 3}Z`, f) +
      P(`M${x - 5} ${y - 5}l-1 -9l6 6Z`, f) + P(`M${x} ${y - 6}l2 -8l3 7Z`, f) + eye(x + 3, y - 2, 1.4, "#ffcc33", c.id) +
      `<path d="M${x + 5} ${y + 4}l1.5 2l1.5 -2l1.5 2" stroke="#f2ead6" stroke-width="1" fill="none"/>`,
    cat: (x, y, f, c, o) => P(`M${x - 6} ${y}Q${x - 6} ${y - 8} ${x + 2} ${y - 7}Q${x + 10} ${y - 5} ${x + 11} ${y + 1}Q${x + 9} ${y + 6} ${x + 2} ${y + 6}Q${x - 6} ${y + 6} ${x - 6} ${y}Z`, f) +
      P(`M${x - 4} ${y - 6}l0 -6l5 4Z`, f) + P(`M${x + 2} ${y - 7}l2 -5l3 5Z`, f) + eye(x + 4, y - 2, 1.5, "#7ee07a", c.id) +
      `<path d="M${x + 7} ${y + 3}l3 0M${x + 7} ${y + 3}l3 -2" stroke="#d8d0c0" stroke-width=".6"/>`,
    boar: (x, y, f, c, o) => P(`M${x - 8} ${y - 6}Q${x + 2} ${y - 10} ${x + 10} ${y}L${x + 14} ${y + 2}L${x + 14} ${y + 8}L${x + 4} ${y + 10}Q${x - 8} ${y + 8} ${x - 8} ${y - 6}Z`, f) +
      `<ellipse cx="${x + 14}" cy="${y + 5}" rx="2" ry="3.2" fill="#c89a8a" ${OUT}/>` + P(`M${x + 8} ${y + 8}q4 0 5 -8q0 6 -3 9Z`, "#f2ead6") +
      P(`M${x - 5} ${y - 6}l-2 -7l6 4Z`, f) + eye(x + 4, y - 2, 1.3, "#d23a2a", c.id) +
      `<path d="M${x - 8} ${y - 8}l3 -4l2 3l3 -4l2 3l3 -3" stroke="${INK}" stroke-width="1.6" fill="none"/>`,
    bear: (x, y, f, c, o) => P(`M${x - 8} ${y}Q${x - 8} ${y - 10} ${x + 2} ${y - 9}Q${x + 8} ${y - 8} ${x + 9} ${y - 2}L${x + 14} ${y}Q${x + 15} ${y + 6} ${x + 8} ${y + 6}L${x} ${y + 7}Q${x - 8} ${y + 7} ${x - 8} ${y}Z`, f) +
      `<circle cx="${x - 5}" cy="${y - 9}" r="3.4" fill="${f}" ${OUT}/><circle cx="${x + 2}" cy="${y - 10}" r="3.2" fill="${f}" ${OUT}/>` +
      `<circle cx="${x + 14}" cy="${y + 1}" r="1.6" fill="#1a1410"/>` + eye(x + 4, y - 3, 1.3),
    deer: (x, y, f, c, o) => P(`M${x - 5} ${y - 3}Q${x} ${y - 8} ${x + 5} ${y - 4}L${x + 12} ${y + 2}Q${x + 12} ${y + 5} ${x + 8} ${y + 5}L${x - 1} ${y + 4}Q${x - 6} ${y + 2} ${x - 5} ${y - 3}Z`, f) +
      P(`M${x - 4} ${y - 4}q-8 -2 -8 2q4 2 8 0Z`, f) + eye(x + 2, y - 2, 1.3),
    eagle: (x, y, f, c, o) => P(`M${x - 6} ${y + 4}Q${x - 8} ${y - 8} ${x + 2} ${y - 8}Q${x + 8} ${y - 8} ${x + 9} ${y - 3}Q${x + 16} ${y - 2} ${x + 15} ${y + 5}Q${x + 12} ${y + 1} ${x + 8} ${y + 3}Q${x + 2} ${y + 8} ${x - 6} ${y + 4}Z`, o.headFill ?? "#f4efe4") +
      P(`M${x + 8} ${y - 3}Q${x + 16} ${y - 2} ${x + 15} ${y + 5}Q${x + 13} ${y + 1} ${x + 8} ${y + 2}Z`, "#e8b23a") + eye(x + 4, y - 3, 1.5, "#ffcc33", c.id) +
      P(`M${x - 6} ${y - 4}l-6 -3l5 6Z`, o.headFill ?? "#f4efe4"),
    elephant: (x, y, f, c, o) => P(`M${x - 8} ${y + 2}Q${x - 10} ${y - 14} ${x + 2} ${y - 14}Q${x + 12} ${y - 13} ${x + 12} ${y}Q${x + 14} ${y + 12} ${x + 18} ${y + 22}Q${x + 13} ${y + 24} ${x + 10} ${y + 14}Q${x + 6} ${y + 8} ${x} ${y + 8}Q${x - 8} ${y + 8} ${x - 8} ${y + 2}Z`, f) +
      P(`M${x + 6} ${y + 6}Q${x + 20} ${y + 10} ${x + 24} ${y - 4}Q${x + 20} ${y + 4} ${x + 6} ${y + 2}Z`, "#f2ead6") + eye(x + 5, y - 4, 1.4) +
      P(`M${x - 6} ${y - 6}q-8 2 -6 12q4 2 6 -2Z`, shade(c.tint, -.2)),
    lizard: (x, y, f, c, o) => P(`M${x - 6} ${y - 4}Q${x + 2} ${y - 9} ${x + 16} ${y - 2}L${x + 17} ${y + 2}L${x + 6} ${y + 2}L${x + 15} ${y + 5}Q${x + 4} ${y + 9} ${x - 6} ${y + 4}Z`, o.skull ? BONE : f) +
      P(`M${x - 4} ${y - 5}q-4 -9 2 -12q-1 6 3 9Z`, "#e6dcc2") + P(`M${x + 2} ${y - 6}q0 -7 5 -8q-2 5 0 7Z`, "#e6dcc2") +
      eye(x + 5, y - 3, 1.8, o.skull ? "#7ee07a" : "#ffd040", c.id),
  };

  // tails, from the rump at (x, y) backwards (to the left)
  const TAILS = {
    horse: (x, y, c, o) => P(`M${x} ${y}Q${x - 14} ${y + 2} ${x - 12} ${y + 22}Q${x - 6} ${y + 14} ${x - 2} ${y + 6}Z`, o.mane ?? shade(c.tint, -.35)),
    wolf: (x, y, c, o) => P(`M${x} ${y}Q${x - 18} ${y - 2} ${x - 20} ${y + 12}Q${x - 10} ${y + 10} ${x} ${y + 5}Z`, o.fill),
    cat: (x, y, c, o) => limb([x, y, x - 10, y + 4, x - 16, y - 6, x - 13, y - 14], 2.6, o.solid),
    lion: (x, y, c, o) => limb([x, y, x - 10, y + 6, x - 15, y - 4], 2.2, o.solid) + `<circle cx="${x - 15}" cy="${y - 6}" r="3.2" fill="${shade(c.tint, -.35)}" ${OUT}/>`,
    stub: () => "",
    sting: (x, y, c, o) => limb([x, y, x - 14, y + 6, x - 24, y - 2, x - 28, y - 14], 3, o.solid) + P(`M${x - 28} ${y - 14}l-3 -7l6 4Z`, "#e6dcc2"),
    lizard: (x, y, c, o) => P(`M${x} ${y - 3}Q${x - 18} ${y} ${x - 34} ${y + 16}Q${x - 18} ${y + 8} ${x} ${y + 5}Z`, o.fill),
  };

  /** A four-legged creature facing right. */
  function quad(c, o = {}) {
    const x = o.x ?? 46, y = o.y ?? 56, rx = o.rx ?? 20, ry = o.ry ?? 10;
    const top = y + ry * .45, foot = o.foot ?? 84, leg = foot - top;
    const fill = o.fill ?? `url(#body${c.id})`, solid = o.solid ?? c.tint, dark = shade(solid, -.35), lw = o.legW ?? 4.6;
    const opts = { ...o, fill, solid };
    const legPath = (lx, near) => o.bentLegs && lx < x
      ? [lx, top - 4, lx - 3, top + leg * .5, lx + 1, foot]
      : [lx, top - 4, lx + (o.bentLegs ? 2 : 0), top + leg * .5, lx, foot];
    const back = x - rx * .58, front = x + rx * .6;
    const parts = [];
    if (o.wings) parts.push(wingsAt(x + 2, y - ry * .6, { ...c, wingFill: o.wingFill ?? c.wingFill }, o.wingScale ?? 1.05));
    for (const lx of [back + 4, front + 4]) parts.push(limb(legPath(lx), lw, dark));
    parts.push((TAILS[o.tail ?? "horse"] ?? TAILS.horse)(x - rx + 3, y - ry * .3, c, opts));
    const belly = o.belly ?? 0;
    parts.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry + belly}" fill="${fill}" ${OUT}/>`);
    if (o.hump) parts.push(P(`M${x - rx * .3} ${y - ry * .7}Q${x + rx * .2} ${y - ry - o.hump} ${x + rx * .75} ${y - ry * .4}Z`, fill));
    if (o.stripes) parts.push(`<path d="M${x - 8} ${y - ry + 2}q2 5 0 9M${x} ${y - ry + 1}q2 5 0 9M${x + 8} ${y - ry + 2}q2 5 0 8" stroke="${o.stripes}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    if (o.ribs) parts.push(`<path d="M${x - 10} ${y - 6}v12M${x - 4} ${y - 8}v15M${x + 2} ${y - 8}v15M${x + 8} ${y - 6}v12" stroke="${INK}" stroke-width="1.4" opacity=".75"/>`);
    if (o.barding) parts.push(P(`M${x - rx + 2} ${y - 2}Q${x} ${y - ry - 3} ${x + rx - 2} ${y - 2}L${x + rx - 4} ${y + ry * .6}L${x - rx + 4} ${y + ry * .6}Z`, o.barding));
    if (o.cloth) parts.push(P(`M${x - rx + 4} ${y - ry * .5}L${x + rx - 3} ${y - ry * .5}L${x + rx - 1} ${y + ry + 8}l-6 -3l-6 3l-6 -3l-6 3l-6 -3l-6 3l-6 -3Z`, o.cloth) + `<path d="M${x - rx + 5} ${y + ry + 2}h${rx * 2 - 8}" stroke="${c.accent}" stroke-width="1.5"/>`);
    if (o.shag) parts.push(P(`M${x - rx} ${y}Q${x - rx + 2} ${y + ry + 6} ${x - rx + 8} ${y + ry + 3}L${x - rx + 12} ${y + ry + 7}L${x - 4} ${y + ry + 3}L${x + 2} ${y + ry + 7}L${x + 8} ${y + ry + 3}L${x + 14} ${y + ry + 6}Q${x + rx} ${y + ry} ${x + rx} ${y}Z`, shade(solid, -.25)));
    for (const lx of [back, front]) parts.push(limb(legPath(lx), lw + .4, solid));
    if (o.hoof) for (const lx of [back, front]) parts.push(`<rect x="${lx - 3}" y="${foot - 2}" width="6" height="3.5" rx="1" fill="${o.hoof}" ${OUT}/>`);
    if (o.paws) for (const lx of [back, front]) parts.push(`<ellipse cx="${lx + 1.5}" cy="${foot}" rx="3.6" ry="2.2" fill="${solid}" ${OUT}/>`);
    const hx = x + rx + (o.headDx ?? 4), hy = y - ry - (o.neck ?? 4);
    if ((o.neck ?? 4) > 2) parts.push(limb([x + rx * .55, y - ry * .2, hx - 3, hy + 3], o.neckW ?? 9, solid));
    if (o.mane) parts.push(P(`M${x + rx * .3} ${y - ry * .8}Q${hx - 8} ${hy - 10} ${hx - 3} ${hy - 6}L${hx - 6} ${hy + 2}Q${x + rx * .6} ${y - ry * .2} ${x + rx * .3} ${y - ry * .8}Z`, o.mane));
    parts.push((HEADS[o.head ?? "horse"] ?? HEADS.horse)(hx, hy, fill, c, o));
    if (o.horn) parts.push(P(`M${hx + 1} ${hy - 6}l9 -14l-4 15Z`, "#fff4d0", `filter="url(#glow${c.id})"`));
    if (o.antlers) parts.push(`<path d="M${hx - 1} ${hy - 6}l-3 -10l-5 -3M${hx - 4} ${hy - 16}l1 -6M${hx - 4} ${hy - 16}l-5 -1M${hx + 2} ${hy - 6}l4 -10l6 -2M${hx + 6} ${hy - 16}l0 -6" stroke="${o.antlers}" stroke-width="2.2" stroke-linecap="round" fill="none" ${o.glowAntlers ? `filter="url(#glow${c.id})"` : ""}/>`);
    if (o.horns) parts.push(P(`M${hx - 3} ${hy - 6}q-6 -8 -1 -13q0 6 4 10Z`, "#e6dcc2"));
    return { svg: parts.join(""), seat: [x - 2, y - ry + 1], head: [hx, hy] };
  }

  const stripLegs = (svg) => svg.replace(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="2" fill="[^"]+" stroke[^>]+\/>/g, "");
  /** A rider sitting on a mount drawn by `quad`. */
  function mounted(spec, c, mount, rider = {}) {
    const [sx, sy] = mount.seat;
    const scale = rider.scale ?? .7;
    const top = 16, hr = 9 * scale, sh = top + hr + 2, hip = sh + 24 * scale;
    const man = rider.skeleton ? skeleton({ ...spec, ...rider.spec }, c, { top, scale, noLegs: true }) : stripLegs(humanoid({ ...spec, body: "soldier", wings: false, ...rider.spec }, c, { top, scale }));
    const legY = sy + 4;
    const leg = limb([sx, sy - 1, sx + 3, legY + 6, sx + 1, legY + 12], 3.4, rider.skeleton ? BONE : shade(c.tint, -.35));
    return mount.svg + `<g transform="translate(${sx - 50} ${sy - hip})">${man}</g>` + leg;
  }

  /** A walking skeleton: skull, spine, ribs and bone limbs. */
  function skeleton(spec, c, { top = 22, scale = 1, noLegs = false } = {}) {
    const s = scale, cx = 50, hr = 8.5 * s, sh = top + hr + 3 * s, hip = sh + 22 * s, foot = Math.min(86, hip + 26 * s);
    const parts = [];
    if (spec.cape) parts.push(P(`M${cx - 9 * s} ${sh}Q${cx - 16 * s} ${hip + 10 * s} ${cx - 12 * s} ${foot - 6 * s}L${cx + 6 * s} ${foot - 10 * s}L${cx + 9 * s} ${sh}Z`, c.trim, 'opacity=".9"'));
    if (!noLegs) {
      parts.push(limb([cx - 4 * s, hip, cx - 6 * s, hip + 13 * s, cx - 5 * s, foot], 2.4 * s, BONE));
      parts.push(limb([cx + 4 * s, hip, cx + 6 * s, hip + 13 * s, cx + 6 * s, foot], 2.4 * s, BONE));
    }
    parts.push(P(`M${cx - 7 * s} ${hip - 2 * s}h${14 * s}l-2 ${5 * s}h${-10 * s}Z`, BONE));
    parts.push(limb([cx, sh, cx, hip], 2.6 * s, BONE));
    for (let i = 0; i < 4; i++) parts.push(`<path d="M${cx - (9 - i) * s} ${sh + (3 + i * 4) * s}Q${cx} ${sh + (1 + i * 4) * s} ${cx + (9 - i) * s} ${sh + (3 + i * 4) * s}" stroke="${INK}" stroke-width="${3.6 * s}" fill="none"/><path d="M${cx - (9 - i) * s} ${sh + (3 + i * 4) * s}Q${cx} ${sh + (1 + i * 4) * s} ${cx + (9 - i) * s} ${sh + (3 + i * 4) * s}" stroke="${BONE}" stroke-width="${2 * s}" fill="none"/>`);
    const handY = sh + 18 * s;
    parts.push(limb([cx - 10 * s, sh + 1, cx - 13 * s, sh + 10 * s, cx - 15 * s, handY], 2.2 * s, BONE));
    parts.push(limb([cx + 10 * s, sh + 1, cx + 13 * s, sh + 10 * s, cx + 15 * s, handY], 2.2 * s, BONE));
    parts.push(head(cx, top, hr, "skull", c));
    parts.push(`<circle cx="${cx - hr * .35}" cy="${top - hr * .05}" r="${hr * .12}" fill="#7ee07a" filter="url(#glow${c.id})"/><circle cx="${cx + hr * .35}" cy="${top - hr * .05}" r="${hr * .12}" fill="#7ee07a" filter="url(#glow${c.id})"/>`);
    if (spec.head === "helm") parts.push(P(`M${cx - hr * 1.05} ${top - hr * .1}Q${cx} ${top - hr * 1.9} ${cx + hr * 1.05} ${top - hr * .1}Z`, `url(#steel${c.id})`));
    parts.push(weapon(cx + 15 * s, handY, spec.weapon, c, s));
    if (spec.shield) parts.push(shieldAt(cx - 15 * s, handY, c, s));
    return parts.join("");
  }

  /** A humanoid bent forward (hunched): the upper body is tilted towards the enemy. */
  const hunched = (svg, deg = 14) => `<g transform="rotate(${deg} 50 82)">${svg}</g>`;

  /** Big bat-like wings spread to both sides. */
  const batWings = (x, y, fill, s = 1) => {
    const one = (k) => P(`M${x} ${y}Q${x + k * 14 * s} ${y - 24 * s} ${x + k * 40 * s} ${y - 20 * s}L${x + k * 36 * s} ${y - 6 * s}Q${x + k * 30 * s} ${y - 12 * s} ${x + k * 26 * s} ${y - 2 * s}Q${x + k * 20 * s} ${y - 8 * s} ${x + k * 16 * s} ${y + 2 * s}Q${x + k * 10 * s} ${y - 4 * s} ${x} ${y + 6 * s}Z`, fill) +
      `<path d="M${x} ${y}L${x + k * 36 * s} ${y - 18 * s}M${x + k * 6 * s} ${y - 4 * s}L${x + k * 26 * s} ${y - 2 * s}" stroke="${INK}" stroke-width=".9" opacity=".6"/>`;
    return one(-1) + one(1);
  };
  /** Butterfly wings for fey creatures. */
  const fairyWings = (x, y, c) => {
    const col = c.accent;
    const one = (k) => P(`M${x} ${y}Q${x + k * 20} ${y - 26} ${x + k * 28} ${y - 14}Q${x + k * 26} ${y - 2} ${x} ${y + 2}Z`, col, 'opacity=".75"') + P(`M${x} ${y + 2}Q${x + k * 20} ${y + 4} ${x + k * 18} ${y + 16}Q${x + k * 8} ${y + 14} ${x} ${y + 4}Z`, shade(col, .3), 'opacity=".7"');
    return `<g filter="url(#glow${c.id})">${one(-1)}${one(1)}</g>`;
  };
  const sparkles = (c, pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6c0" filter="url(#glow${c.id})"/>`).join("");

  // siege engines: wooden frame on wheels plus a machine on top
  const wheel = (x, y, c, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#4a3220" ${OUT}/><path d="M${x - r + 2} ${y}h${2 * r - 4}M${x} ${y - r + 2}v${2 * r - 4}" stroke="#2a1a10" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="2" fill="${c.accent}"/>`;
  const banner = (x, y, c) => `<path d="M${x} ${y}v-12" stroke="#3a2a1a" stroke-width="1.6"/><path d="M${x} ${y - 12}h9l-3 3l3 3h-9" fill="${c.trim}" ${OUT}/>`;
  const plank = (x, y, w, h, fill = WOOD) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" ${OUT}/>`;

  const SHAPES = {
    // ---------------- Орден Рассвета ----------------
    dawn_militia: (s, c) => humanoid({ ...s, head: "helm", weapon: "spear" }, c, { w: .95 }) + P(`M38 46h24l-2 16H40Z`, "#b8a27a", 'opacity=".9"'),
    dawn_halberdier: (s, c) => humanoid({ ...s, weapon: "none" }, c, { w: 1.1 }) +
      limb([68, 88, 66, 10], 2.4, WOOD) + P(`M66 14q10 -2 12 8q-4 6 -12 4Z`, `url(#steel${c.id})`) + P(`M66 10l-1 -7l3 7Z`, `url(#steel${c.id})`),
    dawn_crossbow: (s, c) => humanoid({ ...s, weapon: "crossbow" }, c) + P(`M34 34l-6 20l5 1l5 -19Z`, "#6a4a2a") + `<path d="M30 36l-2 -5M32 36l0 -5M34 37l1 -5" stroke="#e8e0c8" stroke-width="1"/>`,
    dawn_archer: (s, c) => humanoid({ ...s, head: "hood", weapon: "none" }, c, { w: .9 }) +
      `<path d="M66 18Q84 40 66 66" fill="none" stroke="${WOOD}" stroke-width="3"/><path d="M66 18L56 42L66 66" stroke="#e8e0c8" stroke-width=".9" fill="none"/><path d="M56 42h22" stroke="#d8c8a0" stroke-width="1.2"/><path d="M78 42l-4 -2v4Z" fill="${STEEL}"/>`,
    dawn_sister: (s, c) => humanoid({ ...s, weapon: "none", head: "hood" }, c, { robe: true }) +
      P(`M60 50h12v10H60Z`, "#7a2a1a") + `<path d="M66 50v10" stroke="${c.accent}" stroke-width="1.4"/>` + `<ellipse cx="50" cy="10" rx="9" ry="2.6" fill="none" stroke="#ffe9a0" stroke-width="2" filter="url(#glow${c.id})"/>` +
      `<circle cx="66" cy="55" r="9" fill="#fff6c0" opacity=".25" filter="url(#glow${c.id})"/>`,
    dawn_battlemage: (s, c) => humanoid({ ...s, weapon: "none", head: "bare" }, c, { robe: true }) +
      P(`M38 22L50 -2L62 22Q50 18 38 22Z`, shade(c.tint, -.2)) + `<path d="M40 20h20" stroke="${c.accent}" stroke-width="2"/>` +
      `<circle cx="70" cy="34" r="7" fill="#ff8a2a" filter="url(#glow${c.id})"/><circle cx="70" cy="34" r="3.5" fill="#fff0a0"/>` + limb([61, 37, 68, 40], 4, shade(c.tint, -.15)),
    dawn_griffin: (s, c) => quad(c, { head: "eagle", tail: "lion", wings: true, wingFill: "#c8a070", bentLegs: true, paws: true, rx: 19, ry: 10, neck: 6, neckW: 10 }).svg,
    dawn_pegasus: (s, c) => quad(c, { head: "horse", tail: "horse", wings: true, wingFill: "#ffffff", mane: "#dfe6f2", hoof: "#b8a070", rx: 20, ry: 9, neck: 8, y: 54 }).svg,
    dawn_knight: (s, c) => mounted(s, c, quad({ ...c, tint: "#e9ecf2" }, { head: "horse", tail: "horse", mane: "#8a7a6a", cloth: c.trim, solid: "#e9ecf2", fill: "#e9ecf2", hoof: "#3a3028", rx: 20, ry: 9, neck: 8 }),
      { spec: { weapon: "none", head: "helm", shield: true } }) + limb([62, 46, 90, 22], 2.2, WOOD) + P(`M90 22l3 -6l-6 3Z`, `url(#steel${c.id})`),
    dawn_cuirassier: (s, c) => mounted(s, c, quad({ ...c, tint: "#5a4a3a" }, { head: "horse", tail: "horse", solid: "#5a4a3a", fill: "#5a4a3a", barding: `url(#steel${c.id})`, mane: "#1a1410", hoof: "#1a1410", rx: 21, ry: 10, neck: 7 }),
      { spec: { weapon: "sword", head: "helm", cape: true } }),
    dawn_trebuchet: (s, c) => plank(16, 72, 70, 6) + wheel(24, 82, c) + wheel(78, 82, c) + `<path d="M30 72L50 22L70 72" stroke="${WOOD}" stroke-width="5" fill="none"/>` +
      limb([22, 46, 86, 14], 3, shade(WOOD, .1)) + plank(14, 44, 14, 14, "#5a5048") + `<path d="M86 14q2 14 -6 20" stroke="#5a3a1a" stroke-width="1.2" fill="none"/><circle cx="80" cy="35" r="4" fill="#8a8a86" ${OUT}/>` + banner(50, 22, c),
    dawn_ballista: (s, c) => plank(18, 70, 64, 7) + wheel(26, 82, c) + wheel(74, 82, c) + `<path d="M50 70V52" stroke="${WOOD}" stroke-width="6"/>` +
      plank(22, 46, 58, 6) + `<path d="M70 30Q82 49 70 68" stroke="#3a3028" stroke-width="4" fill="none"/><path d="M70 30L36 49L70 68" stroke="#e8e0c8" stroke-width="1" fill="none"/>` +
      `<path d="M36 49H92" stroke="${WOOD}" stroke-width="2.4"/><path d="M92 49l-6 -3v6Z" fill="${STEEL}" ${OUT}/>` + banner(30, 46, c),
    dawn_guardian: (s, c) => wingsAt(50, 40, { ...c, wingFill: "#ffffff" }, 1.15) + humanoid({ ...s, wings: false }, c, { w: 1.15 }),
    dawn_seraph: (s, c) => `<circle cx="50" cy="44" r="34" fill="#fff6c0" opacity=".18" filter="url(#glow${c.id})"/>` + wingsAt(50, 30, { ...c, wingFill: "#fff8e0" }, 1.1) + wingsAt(50, 52, { ...c, wingFill: "#f6ecd0" }, .85) +
      humanoid({ ...s, wings: false, weapon: "none" }, c, { robe: true }) + limb([66, 14, 64, 78], 2.6, "#ffcf5a") + `<path d="M65 14q-6 -10 2 -14q-2 6 4 10Z" fill="#ffb040" filter="url(#glow${c.id})"/>`,

    // ---------------- Кланы Пепла ----------------
    ash_raider: (s, c) => humanoid({ ...s, head: "bare" }, c, { w: .9 }) + `<path d="M42 40l3 6M47 40l3 6M53 40l3 6" stroke="#9b2a1e" stroke-width="2.2" stroke-linecap="round"/>` +
      P(`M46 12l4 -9l4 9Z`, "#9b2a1e") + `<path d="M44 26l3 1M53 27l3 -1" stroke="#9b2a1e" stroke-width="1.4"/>`,
    ash_brute: (s, c) => humanoid(s, c, { w: 1.3, top: 22 }) + P(`M30 36Q50 26 70 36L66 42Q50 34 34 42Z`, "#8a6a4a") + `<path d="M34 40l2 3M40 37l1 4M60 37l-1 4M66 40l-2 3" stroke="#5a3a2a" stroke-width="1.4"/>`,
    ash_axethrower: (s, c) => humanoid(s, c) + `<path d="M40 50h20" stroke="#5a3a1a" stroke-width="2.4"/>` + P(`M44 50l-3 8l5 -2Z`, `url(#steel${c.id})`) + P(`M56 50l3 8l-5 -2Z`, `url(#steel${c.id})`),
    ash_slinger: (s, c) => humanoid(s, c, { w: .85 }) + `<circle cx="38" cy="56" r="4" fill="#6a4a2a" ${OUT}/><circle cx="37" cy="55" r="1.2" fill="#8a8a86"/><circle cx="39" cy="57" r="1.2" fill="#8a8a86"/>`,
    ash_witchdoctor: (s, c) => hunched(humanoid({ ...s, weapon: "none", head: "bare" }, c, { robe: true }), 12) +
      `<g transform="translate(2 6)">` + P(`M53 12h14v16q-7 5 -14 0Z`, BONE) + `<circle cx="57" cy="19" r="1.8" fill="#d23a2a" filter="url(#glow${c.id})"/><circle cx="63" cy="19" r="1.8" fill="#d23a2a" filter="url(#glow${c.id})"/>` +
      `<path d="M55 12l-4 -8M60 11v-9M65 12l4 -8" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/></g>` + limb([74, 86, 78, 34], 2.4, WOOD) + `<circle cx="78" cy="30" r="5" fill="${BONE}" ${OUT}/><circle cx="76.5" cy="29.5" r="1" fill="#1a1410"/><circle cx="79.5" cy="29.5" r="1" fill="#1a1410"/>` +
      `<path d="M76 36l-3 8M80 36l3 8" stroke="#7ee07a" stroke-width="1.2"/>`,
    ash_totemist: (s, c) => humanoid(s, c, { robe: true }),
    ash_wolfrider: (s, c) => mounted(s, c, quad({ ...c, tint: "#6b6f74" }, { head: "wolf", tail: "wolf", solid: "#6b6f74", fill: "#6b6f74", bentLegs: true, paws: true, rx: 20, ry: 9, neck: 3, neckW: 11, y: 58, mane: "#4a4e54" }),
      { spec: { weapon: "axe", head: "bare" } }),
    ash_boarrider: (s, c) => mounted(s, c, quad({ ...c, tint: "#5a3a2a" }, { head: "boar", tail: "stub", solid: "#5a3a2a", fill: "#5a3a2a", hoof: "#1a1410", rx: 22, ry: 12, legW: 6, neck: 0, headDx: 0, y: 60, hump: 4 }),
      { spec: { weapon: "spear", head: "horns" } }),
    ash_ogre: (s, c) => humanoid({ ...s, weapon: "none" }, c, { w: 1.7, top: 24, scale: 1.05 }) + `<ellipse cx="50" cy="54" rx="15" ry="10" fill="${shade(c.skin, -.1)}" ${OUT}/>` +
      limb([74, 60, 84, 18], 5, WOOD) + P(`M78 22q6 -12 12 -2q2 10 -6 12Z`, shade(WOOD, -.1)) + `<path d="M80 18l-2 -3M86 16l1 -4M88 24l4 -1" stroke="${STEEL}" stroke-width="2"/>`,
    ash_ogremage: (s, c) => humanoid({ ...s, weapon: "none" }, c, { w: 1.6, top: 22, robe: true }) +
      `<circle cx="80" cy="28" r="8" fill="#a04aff" opacity=".35" filter="url(#glow${c.id})"/><circle cx="80" cy="28" r="4.5" fill="#d8a8ff" filter="url(#glow${c.id})"/>` +
      `<path d="M40 50l4 4M44 60l4 -4M56 50l-4 4" stroke="#d8a8ff" stroke-width="1.6" filter="url(#glow${c.id})"/>` + limb([72, 50, 78, 36], 5, shade(c.tint, -.15)),
    ash_catapult: (s, c) => plank(16, 70, 68, 7) + wheel(24, 82, c) + wheel(76, 82, c) + `<path d="M40 70V50M60 70V50" stroke="${WOOD}" stroke-width="4"/>` + plank(36, 48, 28, 4) +
      limb([60, 64, 22, 22], 3.2, shade(WOOD, .15)) + P(`M14 18q8 -6 14 2q-4 6 -14 -2Z`, WOOD) + `<circle cx="20" cy="14" r="6" fill="#7a7a76" ${OUT}/>` + banner(76, 70, c),
    ash_ram: (s, c) => wheel(26, 82, c) + wheel(52, 82, c) + wheel(76, 82, c) + P(`M14 74V46L50 26L86 46V74Z`, "#5a3a22") +
      `<path d="M20 48l60 0M18 58h64M18 66h64" stroke="#3a2214" stroke-width="1.4"/>` + P(`M14 46L50 22L86 46L82 48L50 28L18 48Z`, "#8a6a4a") +
      limb([20, 62, 90, 62], 6, WOOD) + P(`M86 56q10 -2 8 12l-8 -4Z`, "#6a6a6a") + P(`M90 56q-2 -8 6 -8q-2 4 0 8Z`, "#e6dcc2") + banner(50, 24, c),
    ash_wyvern: (s, c) => {
      const parts = [wingsAt(46, 36, { ...c, wingFill: shade(c.tint, -.15) }, 1.25)];
      parts.push(TAILS.sting(30, 50, c, { solid: c.tint }));
      parts.push(`<ellipse cx="46" cy="48" rx="16" ry="11" fill="url(#body${c.id})" ${OUT}/>`);
      parts.push(limb([40, 56, 38, 70, 42, 84], 4.6, shade(c.tint, -.3)), limb([52, 56, 56, 70, 54, 84], 4.6, c.tint));
      parts.push(limb([56, 42, 68, 26], 7, c.tint));
      parts.push(HEADS.lizard(70, 22, `url(#body${c.id})`, c, {}));
      return parts.join("");
    },
    ash_mammoth: (s, c) => {
      const m = quad(c, { head: "elephant", tail: "stub", shag: true, rx: 25, ry: 15, legW: 8, neck: 0, headDx: -2, y: 54, foot: 86, hump: 6 });
      return m.svg + P(`M32 30h26v10H32Z`, "#7a2a14") + `<path d="M32 30l4 -8h18l4 8" stroke="${WOOD}" stroke-width="2" fill="none"/>` + banner(45, 22, c) +
        `<circle cx="38" cy="26" r="3.4" fill="url(#skin${c.id})" ${OUT}/><circle cx="52" cy="26" r="3.4" fill="url(#skin${c.id})" ${OUT}/>`;
    },

    // ---------------- Ковен Тлена ----------------
    rot_skeleton: (s, c) => skeleton({ ...s, weapon: "sword", shield: true }, c),
    rot_ghoul: (s, c) => hunched(humanoid({ ...s, weapon: "claws", head: "bare" }, { ...c, hair: false }, { w: .85 }) +
      `<path d="M47 28l3 2l3 -2" stroke="#d23a2a" stroke-width="1.4" fill="none"/>` + limb([39, 44, 30, 56], 4, shade(c.tint, -.15)) + weapon(30, 56, "claws", c), 14),
    rot_skelarcher: (s, c) => skeleton({ ...s, weapon: "bow", head: "bare" }, c) + P(`M38 36l-6 18l4 1l5 -17Z`, "#3a2a3a"),
    rot_spitter: (s, c) => {
      const body = `<ellipse cx="46" cy="60" rx="24" ry="20" fill="url(#body${c.id})" ${OUT}/>`;
      const legs = [30, 40, 52, 62].map((x) => limb([x, 74, x - 1, 86], 4, shade(c.tint, -.3))).join("");
      const boils = [[36, 52, 4], [52, 48, 3], [58, 62, 3.5], [40, 66, 2.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#b8d860" ${OUT}/>`).join("");
      return legs + body + boils + P(`M64 48q10 -4 12 4q-4 6 -12 4Z`, shade(c.tint, -.2)) + `<path d="M74 52q8 -2 12 -10" stroke="#9aff5a" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#glow${c.id})"/>` +
        `<circle cx="88" cy="38" r="3" fill="#9aff5a" filter="url(#glow${c.id})"/>` + eye(66, 46, 1.6, "#ffd040", c.id) + eye(60, 44, 1.2, "#ffd040", c.id);
    },
    rot_wraith: (s, c) => `<g transform="translate(0 -4)">${humanoid(s, c, { spirit: true })}</g>` + `<path d="M34 72q4 8 0 14M44 74q3 6 1 12M56 74q-3 6 -1 12" stroke="${shade(c.tint, .2)}" stroke-width="2" opacity=".5" fill="none"/>`,
    rot_banshee: (s, c) => humanoid({ ...s, weapon: "none" }, c, { spirit: true }) +
      P(`M40 16Q50 4 60 16L66 52Q58 40 56 30L44 30Q42 40 34 52Z`, "#e8eef6", 'opacity=".9"') + `<ellipse cx="50" cy="28" rx="2.4" ry="3.6" fill="#1a1410"/>` +
      `<path d="M64 22q6 4 0 10M70 18q10 8 0 18M76 14q14 12 0 26" stroke="#bfe0ff" stroke-width="1.6" fill="none" opacity=".8" filter="url(#glow${c.id})"/>`,
    rot_gargoyle: (s, c) => batWings(50, 40, shade(c.tint, -.15), .95) + hunched(humanoid({ ...s, wings: false, weapon: "claws", head: "horns" }, { ...c, skin: "#8a8a92", hair: false }, { w: 1.2, top: 26 }), 8) +
      `<path d="M38 50l4 6M58 48l-3 6M46 62l4 -3" stroke="#3a3a40" stroke-width="1" opacity=".7"/>`,
    rot_bat: (s, c) => batWings(50, 44, shade(c.tint, .1), 1.05) + `<ellipse cx="50" cy="50" rx="9" ry="12" fill="url(#body${c.id})" ${OUT}/>` +
      `<circle cx="50" cy="36" r="7" fill="url(#body${c.id})" ${OUT}/>` + P(`M44 32l-2 -9l5 5Z`, c.tint) + P(`M56 32l2 -9l-5 5Z`, c.tint) +
      eye(47, 35, 1.4, "#ff3a3a", c.id) + eye(53, 35, 1.4, "#ff3a3a", c.id) + `<path d="M47 40l1 3l1 -3M51 40l1 3l1 -3" stroke="#fff" stroke-width=".8" fill="none"/>` +
      limb([46, 61, 44, 70], 2, shade(c.tint, -.3)) + limb([54, 61, 56, 70], 2, shade(c.tint, -.3)),
    rot_abomination: (s, c) => humanoid({ ...s, weapon: "none" }, { ...c, skin: "#c8a8a0" }, { w: 1.8, top: 26 }) + `<ellipse cx="50" cy="58" rx="18" ry="14" fill="${shade(c.tint, -.05)}" ${OUT}/>` +
      `<path d="M38 48q12 6 24 0M40 62q10 -6 20 2M50 46v26" stroke="#5a2a2a" stroke-width="1.4" fill="none" stroke-dasharray="2 2"/>` +
      limb([76, 64, 84, 40], 3, "#3a3028") + P(`M80 40h12v12H82Z`, `url(#steel${c.id})`) + limb([24, 62, 18, 70], 2, "#6a6a6a") + `<path d="M18 70q-4 4 0 6" stroke="#9a9a9a" stroke-width="2" fill="none"/>`,
    rot_deadrider: (s, c) => mounted(s, c, quad({ ...c, tint: "#2a2a2e" }, { head: "horse", eye: "#7ee07a", tail: "horse", mane: "#4a8a4a", solid: "#2a2a2e", fill: "#2a2a2e", ribs: true, hoof: "#1a1410", rx: 20, ry: 9, neck: 8 }),
      { skeleton: true, spec: { weapon: "spear", head: "helm", cape: true } }),
    rot_bonecatapult: (s, c) => plank(16, 70, 68, 7, "#5a4a5a") + wheel(24, 82, { ...c, accent: "#7ee07a" }) + wheel(76, 82, { ...c, accent: "#7ee07a" }) +
      `<path d="M36 70L48 46L60 70" stroke="${BONE}" stroke-width="4" fill="none"/>` + [30, 40, 60, 70].map((x) => `<path d="M${x} 70v-6" stroke="${BONE}" stroke-width="3"/>`).join("") +
      limb([62, 62, 24, 26], 3, BONE) + `<circle cx="20" cy="20" r="7" fill="${BONE}" ${OUT}/><circle cx="18" cy="19" r="1.6" fill="#7ee07a" filter="url(#glow${c.id})"/><circle cx="22.5" cy="19" r="1.6" fill="#7ee07a" filter="url(#glow${c.id})"/>`,
    rot_plaguecart: (s, c) => wheel(28, 80, c, 9) + wheel(70, 80, c, 9) + P(`M16 72V52h68v20Z`, "#4a3a2a") + `<path d="M16 60h68M30 52v20M50 52v20M70 52v20" stroke="#2a1a10" stroke-width="1.2"/>` +
      P(`M30 52q0 -14 10 -14h20q10 0 10 14Z`, "#5a6a3a") + `<path d="M30 46h40" stroke="#2a2a2a" stroke-width="2"/>` +
      [[38, 30, 9], [54, 24, 11], [68, 32, 8], [46, 18, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#7ee07a" opacity=".4" filter="url(#glow${c.id})"/>`).join("") + limb([84, 66, 94, 62], 2.2, WOOD),
    rot_bonedragon: (s, c) => {
      const parts = [wingsAt(46, 40, { ...c, wingFill: "rgba(232,226,207,.35)" }, 1.2)];
      parts.push(`<path d="M10 40L46 40M20 34L46 44M14 48L46 44M78 40L54 40M84 34L54 44M86 48L54 44" stroke="${BONE}" stroke-width="1.6" opacity=".9"/>`);
      parts.push(limb([30, 58, 16, 66, 8, 82], 2.6, BONE));
      parts.push(limb([30, 58, 62, 54], 3, BONE));
      for (let i = 0; i < 5; i++) parts.push(`<path d="M${36 + i * 5} 52q2 8 0 14" stroke="${INK}" stroke-width="3.4" fill="none"/><path d="M${36 + i * 5} 52q2 8 0 14" stroke="${BONE}" stroke-width="2" fill="none"/>`);
      parts.push(limb([38, 60, 36, 72, 40, 84], 2.6, BONE), limb([56, 60, 60, 72, 58, 84], 2.6, BONE));
      parts.push(limb([60, 54, 66, 40, 70, 28], 3, BONE));
      parts.push(HEADS.lizard(72, 24, BONE, c, { skull: true }));
      return parts.join("");
    },
    rot_reaper: (s, c) => `<g transform="translate(50 86) scale(1.12) translate(-50 -86)">${humanoid({ ...s, weapon: "none" }, c, { spirit: true })}</g>` +
      limb([70, 90, 76, 4], 2.8, "#3a2a22") + P(`M76 6Q50 0 40 22Q52 10 75 12Z`, `url(#steel${c.id})`) + `<circle cx="46" cy="22" r="1.6" fill="#7ee07a" filter="url(#glow${c.id})"/><circle cx="54" cy="22" r="1.6" fill="#7ee07a" filter="url(#glow${c.id})"/>`,

    // ---------------- Лесной Круг ----------------
    grove_tracker: (s, c) => hunched(humanoid({ ...s, weapon: "none", head: "hood" }, c, { w: .88 }), 8) +
      P(`M66 56l14 -16l2 2l-14 16Z`, `url(#steel${c.id})`) + P(`M34 58l-12 -14l-2 2l12 14Z`, `url(#steel${c.id})`),
    grove_sprite: (s, c) => fairyWings(50, 46, c) + `<circle cx="50" cy="50" r="10" fill="#c8ffb0" opacity=".9" filter="url(#glow${c.id})"/><circle cx="50" cy="50" r="5" fill="#ffffff"/>` +
      eye(47.5, 49, 1, "#2a4a2a") + eye(52.5, 49, 1, "#2a4a2a") + sparkles(c, [[30, 30, 1.6], [70, 34, 1.4], [36, 72, 1.2], [66, 70, 1.6], [50, 26, 1]]),
    grove_archer: (s, c) => humanoid({ ...s, weapon: "none" }, c, { w: .88 }) + P(`M40 18Q36 40 42 50L46 30Z`, "#7a4a2a") +
      `<path d="M66 12Q90 42 66 74" fill="none" stroke="${WOOD}" stroke-width="3"/><path d="M66 12L54 42L66 74" stroke="#e8e0c8" stroke-width=".9" fill="none"/><path d="M54 42h26" stroke="#d8c8a0" stroke-width="1.2"/><path d="M80 42l-4 -2v4Z" fill="${STEEL}"/>`,
    grove_panther: (s, c) => quad(c, { head: "cat", tail: "cat", bentLegs: true, paws: true, rx: 22, ry: 8, legW: 4, neck: 2, headDx: 3, y: 62 }).svg,
    grove_dryad: (s, c) => P(`M38 22Q34 4 50 6Q66 4 62 22Q70 30 64 40Q60 28 50 24Q40 28 36 40Q30 30 38 22Z`, "#4f8f44") +
      humanoid({ ...s, weapon: "none", head: "bare" }, { ...c, skin: "#a8c888", hair: false }, { robe: true }) + P(`M41 20Q42 12 50 12Q58 12 59 20Q55 15 50 16Q45 15 41 20Z`, "#5fa050") + `<circle cx="42" cy="10" r="2" fill="#ff9ad8"/><circle cx="58" cy="12" r="2" fill="#ffd87a"/>` +
      `<path d="M62 50q12 0 16 12q4 10 12 10M38 50q-12 2 -16 14" stroke="#3f7a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + `<path d="M76 62l4 -2M84 70l3 -3M26 60l-4 -1" stroke="#6ab04a" stroke-width="3" stroke-linecap="round"/>`,
    grove_fairy: (s, c) => `<g transform="translate(50 60) scale(.72) translate(-50 -60)">${fairyWings(50, 44, c)}${humanoid({ ...s, wings: false, weapon: "none" }, c, { robe: true })}</g>` +
      limb([62, 54, 70, 42], 1.4, "#f2e2b8") + `<circle cx="71" cy="40" r="2.6" fill="#fff6c0" filter="url(#glow${c.id})"/>` + sparkles(c, [[76, 34, 1.2], [80, 44, 1], [70, 30, .9], [30, 40, 1.2]]),
    grove_hippogryph: (s, c) => mounted(s, c, quad({ ...c, tint: "#c8b090" }, { head: "eagle", headFill: "#f4efe4", tail: "horse", mane: "#e8e0c8", wings: true, wingFill: "#f0e6d0", solid: "#c8b090", fill: "#c8b090", hoof: "#5a4a3a", rx: 19, ry: 9, neck: 7, y: 54 }),
      { spec: { weapon: "spear", head: "feather" } }),
    grove_bear: (s, c) => quad(c, { head: "bear", tail: "stub", paws: true, rx: 23, ry: 14, legW: 8, neck: 0, headDx: 0, y: 60, hump: 6 }).svg + `<path d="M66 50l4 3M68 46l4 2" stroke="#e8d8b0" stroke-width="1.2" opacity=".6"/>`,
    grove_unicorn: (s, c) => `<ellipse cx="50" cy="56" rx="34" ry="26" fill="#fff6e0" opacity=".15" filter="url(#glow${c.id})"/>` + quad(c, { head: "horse", tail: "horse", mane: "#e8c8f8", horn: true, hoof: "#d8c070", rx: 20, ry: 9, neck: 9 }).svg,
    grove_stag: (s, c) => quad(c, { head: "deer", tail: "stub", antlers: "#e8f0b0", glowAntlers: true, hoof: "#2a1a10", rx: 19, ry: 8, legW: 3.6, neck: 12, neckW: 7, y: 56 }).svg +
      sparkles(c, [[74, 10, 1.4], [86, 18, 1.2], [66, 14, 1]]),
    grove_treant: (s, c) => tree(s, c),
    grove_rootthrower: (s, c) => `<g transform="translate(-6 10) scale(.92)">${tree({ ...s, head: "bare", weapon: "none" }, c)}</g>` +
      limb([64, 48, 78, 22], 5, shade(c.tint, -.1)) + `<circle cx="80" cy="16" r="9" fill="#8a8a86" ${OUT}/><path d="M72 14q8 -4 16 4M74 22q6 2 12 -4" stroke="#3f7a3a" stroke-width="2" fill="none"/>`,
    grove_giant: (s, c) => humanoid({ ...s, weapon: "none" }, { ...c, skin: "#9aa0a0", hair: false }, { w: 1.6, top: 20, scale: 1.05 }) +
      `<path d="M38 40l6 4M58 44l4 -4M44 58l6 2" stroke="#5a6060" stroke-width="1.4"/><path d="M40 14q4 -6 10 -4q6 -2 10 4" stroke="#4f8f44" stroke-width="3" fill="none"/>` +
      limb([72, 66, 88, 14], 7, "#6a4a2a") + `<path d="M84 22l5 -2M80 36l5 -1" stroke="#3f7a3a" stroke-width="2"/>`,
    grove_dragon: (s, c) => dragon(s, c) + `<path d="M88 26q6 -2 6 -8" stroke="#c8ffb0" stroke-width="2" fill="none" filter="url(#glow${c.id})"/><circle cx="94" cy="16" r="2" fill="#c8ffb0" filter="url(#glow${c.id})"/>`,
  };

  function defs(c) {
    return `<defs>
      <linearGradient id="body${c.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.tint, .25)}"/><stop offset=".55" stop-color="${c.tint}"/><stop offset="1" stop-color="${shade(c.tint, -.4)}"/></linearGradient>
      <linearGradient id="body${c.id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.mountTint ?? c.tint, .25)}"/><stop offset="1" stop-color="${shade(c.mountTint ?? c.tint, -.35)}"/></linearGradient>
      <linearGradient id="steel${c.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${STEEL}"/><stop offset="1" stop-color="#6a707c"/></linearGradient>
      <linearGradient id="steel${c.id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#6a707c"/></linearGradient>
      <radialGradient id="skin${c.id}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${shade(c.skin, .2)}"/><stop offset="1" stop-color="${shade(c.skin, -.3)}"/></radialGradient>
      <radialGradient id="skin${c.id}m" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${shade(c.skin, .2)}"/><stop offset="1" stop-color="${shade(c.skin, -.3)}"/></radialGradient>
      <filter id="glow${c.id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow${c.id}m" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>`;
  }

  /**
   * @param spec  model spec from the server ({ body, weapon, head, shield, cape, wings, tint })
   * @param faction  faction object ({ id, color, accent }) for trim colors
   */
  window.hbModel = (spec, faction) => {
    const id = `m${++uid}`;
    const mountTint = { dawn: "#e9ecf2", ash: "#6b6f74", rot: "#2a2a2e", grove: "#c8b090" }[faction.id];
    const c = {
      id, faction: faction.id, tint: spec.tint, trim: faction.color, accent: faction.accent, mountTint,
      skin: SKIN[faction.id] ?? "#e0b48a", hair: true,
      wingFill: spec.body === "dragon" || spec.body === "flyer" && faction.id === "rot" ? shade(spec.tint, -.2) : "#f4efe4",
    };
    if (spec.body === "flyer" && spec.weapon === "claws" && faction.id === "dawn") c.wingFill = "#c8a070";
    const own = spec.shape && SHAPES[spec.shape];
    const draw = own ? () => own(spec, c) : {
      soldier: () => humanoid(spec, c),
      knight: () => humanoid(spec, c, { w: 1.15 }),
      robed: () => humanoid(spec, c, { robe: true }),
      giant: () => humanoid(spec, c, { w: 1.5, top: 20, scale: 1.05 }),
      spirit: () => humanoid(spec, c, { spirit: true }),
      beast: () => beast(spec, c, { neck: spec.weapon === "none" && spec.head === "horns" }),
      flyer: () => spec.weapon === "spear" ? beast({ ...spec, weapon: "none" }, c, { y: 10 }) + `<g transform="translate(-4 -6)">${humanoid({ ...spec, body: "soldier", wings: false }, c, { top: 16, scale: .62 }).replace(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="2" fill="[^"]+" stroke[^>]+\/>/g, "")}</g>` : beast(spec, c, { y: 10 }),
      rider: () => rider(spec, c),
      siege: () => siege(spec, c),
      tree: () => tree(spec, c),
      dragon: () => dragon(spec, c),
    }[spec.body] ?? (() => humanoid(spec, c));
    if (own) return `<svg class="model" viewBox="8 8 84 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs(c)}
      <ellipse cx="50" cy="86" rx="28" ry="4.5" fill="#000" opacity=".45"/>${draw()}</svg>`;
    return `<svg class="model" viewBox="8 8 84 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs(c)}
      <ellipse cx="50" cy="86" rx="28" ry="4.5" fill="#000" opacity=".45"/>${draw()}</svg>`;
  };
})();

// Painted figures: public/img/figures/<id>.png (square portrait, see docs/art-prompts.md).
// Until a file exists, the SVG placeholder above is drawn instead.
(() => {
  const registry = new Map();
  const missing = new Set();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** @param entity a faction hero or unit ({ id, name, model }), @param faction its faction */
  window.hbFigure = (entity, faction) => {
    if (missing.has(entity.id)) return window.hbModel(entity.model, faction);
    registry.set(entity.id, { spec: entity.model, faction });
    return `<img class="model figure" src="/img/figures/${encodeURIComponent(entity.id)}.png" alt="${esc(entity.name ?? "")}" data-figure="${esc(entity.id)}">`;
  };

  document.addEventListener("error", (e) => {
    const img = e.target;
    const id = img instanceof HTMLImageElement ? img.dataset.figure : undefined;
    const entry = id && registry.get(id);
    if (!entry) return;
    missing.add(id);
    img.outerHTML = window.hbModel(entry.spec, entry.faction);
  }, true);
})();
