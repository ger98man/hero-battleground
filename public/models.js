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
    const draw = {
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
