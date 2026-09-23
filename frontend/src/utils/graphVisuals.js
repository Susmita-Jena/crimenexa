/*
 * Look-and-feel for the investigation graph: entity icons, relationship
 * families, edge/node styling helpers and the cell overlay drawing.
 * Nothing here touches React state.
 */

import { occurrenceOf } from './graphAnalytics';

export const FONT_FACE = "Aptos, 'Segoe UI', system-ui, sans-serif";

/* --------------------------------- entities --------------------------------- */

export const TYPE_STYLES = {
  person: { label: 'Person', color: '#6654b7' },
  location: { label: 'Location', color: '#397ac2' },
  organization: { label: 'Organisation', color: '#c66d69' },
  vehicle: { label: 'Vehicle', color: '#c98b32' },
  phone: { label: 'Phone', color: '#278f96' },
  event: { label: 'Event', color: '#7a62b8' },
  evidence: { label: 'Evidence', color: '#7b8798' }
};

const ICON_PATHS = {
  person: '<circle cx="32" cy="25" r="7"/><path d="M19 47c1.6-8.2 6.6-12 13-12s11.4 3.8 13 12"/>',
  location: '<path d="M32 47S20 36 20 27.5a12 12 0 0 1 24 0C44 36 32 47 32 47z"/><circle cx="32" cy="27.5" r="4.2"/>',
  organization: '<path d="M21 46V19h22v27M16 46h32"/><path d="M27 26h3M34 26h3M27 33h3M34 33h3M29 46v-6h6v6"/>',
  vehicle: '<path d="M17 38v-5.5l4.2-8.5h21.6l4.2 8.5V38"/><path d="M17 33h30"/><circle cx="24" cy="40.5" r="3.2"/><circle cx="40" cy="40.5" r="3.2"/>',
  phone: '<path d="M23 20h5.5l2.4 6.4-3.3 2.2a16 16 0 0 0 7.3 7.3l2.2-3.3 6.4 2.4V41a3 3 0 0 1-3 3C29.6 44 20 34.4 20 23a3 3 0 0 1 3-3z"/>',
  event: '<circle cx="32" cy="32" r="12"/><path d="M32 25v7l5 3"/>',
  evidence: '<path d="M23 18h13l6 6v22H23z"/><path d="M36 18v6h6M27 31h10M27 37h10"/>'
};

const iconCache = new Map();

/** Round node artwork as a data URI: coloured disc + white line icon. */
export function nodeIcon(group, { dim = false } = {}) {
  const kind = ICON_PATHS[group] ? group : 'person';
  const color = (TYPE_STYLES[kind] || TYPE_STYLES.person).color;
  const key = `${kind}|${dim}`;
  if (!iconCache.has(key)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g opacity="${dim ? 0.22 : 1}"><circle cx="32" cy="32" r="32" fill="${color}"/><g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind]}</g></g></svg>`;
    iconCache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }
  return iconCache.get(key);
}

/* ------------------------------ relationship kinds --------------------------- */

export const FAMILIES = {
  communication: { label: 'Communication', color: '#2a9d8f', arrows: false },
  finance: { label: 'Money', color: '#d99a2b', arrows: true },
  ownership: { label: 'Ownership and use', color: '#a9745f', arrows: true },
  presence: { label: 'Seen or met at', color: '#4b8bd6', arrows: false },
  organization: { label: 'Role in organisation', color: '#8a63d2', arrows: true },
  intelligence: { label: 'Intelligence', color: '#d0629b', arrows: true },
  logistics: { label: 'Logistics', color: '#7f9a3a', arrows: true },
  association: { label: 'Other association', color: '#8593a8', arrows: false }
};

const FAMILY_RULES = [
  ['finance', /fund|transfer|pay|transaction|financ|launder|invoice|account|deposit|cash/],
  ['communication', /contact|call|communicat|message|chat|sms|whatsapp/],
  ['ownership', /own|regist|lease|rent|drive|use|hold/],
  ['organization', /work|operate|employ|member|run|head|manage|director/],
  ['intelligence', /inform|witness|report|surveil|track|tip/],
  ['logistics', /deliver|ship|transport|haul|route|suppl|stor/],
  ['presence', /(^|_)met(_|$)|seen|located|visit|resid|meeting|present|spotted|stay|frequent/]
];

export function familyOf(type) {
  const key = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  const hit = FAMILY_RULES.find(([, pattern]) => pattern.test(key));
  return hit ? hit[0] : 'association';
}

export function humanize(type) {
  return String(type || 'related').replace(/_/g, ' ');
}

/* ---------------------------------- colours ---------------------------------- */

export function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const CELL_COLORS = ['#8b7bd8', '#3fb0a4', '#e0827c', '#dfae55', '#5f9fe6', '#b48ad6', '#8fae4f', '#8a97ab'];

export function cellColor(index) {
  return CELL_COLORS[index % CELL_COLORS.length];
}

/* ------------------------------- edge and node ------------------------------- */

export function edgeWidthFor(count) {
  return Math.min(1.3 + Math.log2(Math.max(1, count)) * 1.05, 5);
}

/**
 * vis-network edge props for one relationship.
 *   state.dim       faded (not part of the current focus)
 *   state.hot       part of a highlighted path
 *   state.label     show the text label
 *   state.count     occurrences as of the timeline position
 */
export function styleEdge(edge, state, theme) {
  const family = FAMILIES[familyOf(edge.label || edge.type)];
  const count = state.count ?? occurrenceOf(edge);
  const base = state.hot ? theme.hot : family.color;
  const alpha = state.dim ? 0.1 : state.hot ? 1 : 0.8;

  return {
    id: edge.id,
    hidden: !!state.hidden,
    width: state.hot ? Math.max(3.6, edgeWidthFor(count) + 1) : edgeWidthFor(count),
    color: { color: rgba(base, alpha), highlight: base, hover: base, inherit: false },
    arrows: family.arrows ? { to: { enabled: true, scaleFactor: 0.42, type: 'arrow' } } : { to: { enabled: false } },
    label: state.label ? `${humanize(edge.label || edge.type)}${count > 1 ? `  x${count}` : ''}` : null,
    font: { color: theme.text, face: FONT_FACE, strokeWidth: 4, strokeColor: theme.surface, align: 'horizontal' },
    smooth: edge.smooth || { enabled: true, type: 'continuous', roundness: 0.18 },
    selectionWidth: 1.5
  };
}

/** vis-network node props. */
export function styleNode(node, state, theme) {
  const size = 17 + Math.round((Number(node.keyEntityScore) || 0) * 17) + (state.selected ? 4 : 0);
  const top = state.keyRank && state.keyRank <= 3;
  const borderColor = top ? theme.gold : state.selected ? theme.accent : theme.surface;

  return {
    id: node.id,
    hidden: !!state.hidden,
    shape: 'circularImage',
    image: nodeIcon(node.group, { dim: state.dim }),
    size,
    borderWidth: top || state.selected || state.broker ? 4 : 3,
    borderWidthSelected: 4,
    shapeProperties: { borderDashes: state.broker ? [5, 4] : false },
    color: {
      background: theme.surface,
      border: state.dim ? rgba(theme.surface, 0.6) : borderColor,
      highlight: { background: theme.surface, border: theme.accent },
      hover: { background: theme.surface, border: theme.accent }
    },
    shadow: state.dim
      ? false
      : { enabled: true, color: top ? rgba(theme.gold, 0.55) : theme.shadow, size: top ? 16 : 8, x: 0, y: top ? 0 : 3 },
    label: state.label,
    font: {
      face: FONT_FACE,
      color: state.dim ? theme.textFaint : theme.text,
      strokeWidth: 4,
      strokeColor: theme.surface,
      vadjust: 2
    }
  };
}

/* ----------------------------------- hulls ----------------------------------- */

function convexHull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  pts.forEach((p) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  });
  const upper = [];
  [...pts].reverse().forEach((p) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Soft rounded outline that wraps a set of node positions. */
export function hullOutline(positions, padding = 42, steps = 12) {
  const samples = [];
  positions.forEach(({ x, y }) => {
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      samples.push({ x: x + Math.cos(angle) * padding, y: y + Math.sin(angle) * padding });
    }
  });
  return convexHull(samples);
}

/**
 * Paint one translucent region per cell behind the nodes.
 * `cells` = [{ id, name, members, color }]
 */
export function paintCells(ctx, positionsOf, cells, { isVisible, activeCellId, dark }) {
  cells.forEach((cell) => {
    const members = cell.members.filter(isVisible);
    if (members.length < 2) return;
    const positions = Object.values(positionsOf(members));
    if (positions.length < 2) return;

    const hull = hullOutline(positions);
    if (hull.length < 3) return;
    const active = activeCellId === cell.id;

    ctx.save();
    ctx.beginPath();
    hull.forEach((p, i) => {
      const next = hull[(i + 1) % hull.length];
      const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
      if (i === 0) ctx.moveTo((hull[hull.length - 1].x + p.x) / 2, (hull[hull.length - 1].y + p.y) / 2);
      ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
    });
    ctx.closePath();
    ctx.fillStyle = rgba(cell.color, active ? (dark ? 0.26 : 0.2) : dark ? 0.14 : 0.1);
    ctx.fill();
    ctx.lineWidth = active ? 2 : 1.3;
    ctx.setLineDash(active ? [] : [7, 6]);
    ctx.strokeStyle = rgba(cell.color, active ? 0.9 : 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    const top = hull.reduce((best, p) => (p.y < best.y ? p : best), hull[0]);
    const cx = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const scale = (ctx.getTransform && ctx.getTransform().a) || 1;
    const px = Math.min(30, Math.max(13, 14 / scale));
    ctx.font = `600 ${px}px ${FONT_FACE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = rgba(cell.color, dark ? 1 : 0.95);
    ctx.fillText(cell.name, cx, top.y - 6 / scale);
    ctx.restore();
  });
}
