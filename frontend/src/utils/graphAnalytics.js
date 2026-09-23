/*
 * Pure graph analytics for the investigation graph.
 * No React, no vis-network: everything here takes plain { nodes, edges } and
 * returns plain data, so it is easy to test and reuse.
 *
 * Graph is treated as undirected for structure (cells, paths, brokers).
 */

/* ------------------------------ index/adjacency ----------------------------- */

export function occurrenceOf(edge) {
  const n = Number(edge?.occurrenceCount);
  if (Number.isFinite(n) && n > 0) return n;
  const stamps = Array.isArray(edge?.timestamps) ? edge.timestamps.length : 0;
  return Math.max(1, stamps);
}

/** Build adjacency + edge lookup. `hiddenIds` nodes are left out entirely. */
export function buildIndex(nodes, edges, hiddenIds = null) {
  const adj = new Map();
  const nodeById = new Map();
  nodes.forEach((node) => {
    if (hiddenIds && hiddenIds.has(node.id)) return;
    adj.set(node.id, new Map());
    nodeById.set(node.id, node);
  });

  const edgesBetween = new Map(); // "a|b" (sorted) -> edge[]
  edges.forEach((edge) => {
    if (!adj.has(edge.from) || !adj.has(edge.to) || edge.from === edge.to) return;
    const weight = 1 + Math.log2(occurrenceOf(edge));
    adj.get(edge.from).set(edge.to, (adj.get(edge.from).get(edge.to) || 0) + weight);
    adj.get(edge.to).set(edge.from, (adj.get(edge.to).get(edge.from) || 0) + weight);
    const key = pairKey(edge.from, edge.to);
    if (!edgesBetween.has(key)) edgesBetween.set(key, []);
    edgesBetween.get(key).push(edge);
  });

  return { adj, nodeById, edgesBetween };
}

export function pairKey(a, b) {
  return String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`;
}

export function neighborsOf(index, id) {
  return [...(index.adj.get(id)?.keys() || [])];
}

/* --------------------------------- components -------------------------------- */

export function connectedComponents(index) {
  const seen = new Set();
  const groups = [];
  [...index.adj.keys()].forEach((start) => {
    if (seen.has(start)) return;
    const group = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop();
      group.push(id);
      index.adj.get(id).forEach((_, next) => {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      });
    }
    groups.push(group);
  });
  return groups.sort((a, b) => b.length - a.length);
}

/* ------------------------------ hop neighbourhood ---------------------------- */

/** All node ids within `hops` steps of `startId` (including the start). */
export function withinHops(index, startId, hops) {
  const dist = new Map([[startId, 0]]);
  const queue = [startId];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    const d = dist.get(id);
    if (d >= hops) continue;
    index.adj.get(id)?.forEach((_, next) => {
      if (!dist.has(next)) {
        dist.set(next, d + 1);
        queue.push(next);
      }
    });
  }
  return new Set(dist.keys());
}

/* ---------------------------------- cells ------------------------------------ */
/* Louvain community detection (modularity), deterministic ordering. */

function localMove(graph) {
  const n = graph.length;
  const degree = graph.map((nbrs) => {
    let sum = 0;
    nbrs.forEach((w) => { sum += w; });
    return sum;
  });
  const m2 = degree.reduce((a, b) => a + b, 0);
  const comm = graph.map((_, i) => i);
  if (m2 === 0) return { comm, improved: false };

  const total = degree.slice();
  let improved = false;
  let moved = true;
  let passes = 0;

  while (moved && passes < 25) {
    moved = false;
    passes += 1;
    for (let u = 0; u < n; u += 1) {
      const current = comm[u];
      const weightTo = new Map();
      graph[u].forEach((w, v) => {
        if (v === u) return;
        weightTo.set(comm[v], (weightTo.get(comm[v]) || 0) + w);
      });

      total[current] -= degree[u];
      let best = current;
      let bestGain = (weightTo.get(current) || 0) - (total[current] * degree[u]) / m2;

      [...weightTo.keys()].sort((a, b) => a - b).forEach((c) => {
        const gain = weightTo.get(c) - (total[c] * degree[u]) / m2;
        if (gain > bestGain + 1e-12) {
          best = c;
          bestGain = gain;
        }
      });

      total[best] += degree[u];
      if (best !== current) {
        comm[u] = best;
        moved = true;
        improved = true;
      }
    }
  }
  return { comm, improved };
}

function louvain(initial) {
  let graph = initial;
  let assignment = graph.map((_, i) => i);

  for (let level = 0; level < 10; level += 1) {
    const { comm, improved } = localMove(graph);
    if (!improved) break;

    const remap = new Map();
    comm.forEach((c) => { if (!remap.has(c)) remap.set(c, remap.size); });
    const renumbered = comm.map((c) => remap.get(c));
    assignment = assignment.map((a) => renumbered[a]);

    const next = Array.from({ length: remap.size }, () => new Map());
    graph.forEach((nbrs, u) => {
      nbrs.forEach((w, v) => {
        const cu = renumbered[u];
        const cv = renumbered[v];
        next[cu].set(cv, (next[cu].get(cv) || 0) + w);
      });
    });
    graph = next;
    if (remap.size === 1) break;
  }
  return assignment;
}

/**
 * Group entities into cells.
 * Returns { cells: [{ id, name, members }], cellOf: Map<nodeId, cellId|null> }
 * Groups smaller than `minSize` are not treated as cells (cellOf = null).
 */
export function detectCells(index, { minSize = 3 } = {}) {
  const ids = [...index.adj.keys()].sort((a, b) => String(a).localeCompare(String(b)));
  const position = new Map(ids.map((id, i) => [id, i]));
  const graph = ids.map((id) => {
    const nbrs = new Map();
    index.adj.get(id).forEach((w, other) => nbrs.set(position.get(other), w));
    return nbrs;
  });

  const assignment = louvain(graph);
  const groups = new Map();
  assignment.forEach((c, i) => {
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(ids[i]);
  });

  const sorted = [...groups.values()]
    .filter((members) => members.length >= minSize)
    .sort((a, b) => b.length - a.length || String(a[0]).localeCompare(String(b[0])));

  const cellOf = new Map(ids.map((id) => [id, null]));
  const cells = sorted.map((members, i) => {
    const id = `cell-${i}`;
    members.forEach((m) => cellOf.set(m, id));
    return { id, name: `Cell ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`, members };
  });

  return { cells, cellOf };
}

/* -------------------------------- betweenness -------------------------------- */
/* Brandes, unweighted, undirected. Returns Map<id, 0..1>. */

export function betweenness(index) {
  const ids = [...index.adj.keys()];
  const score = new Map(ids.map((id) => [id, 0]));

  ids.forEach((source) => {
    const stack = [];
    const preds = new Map(ids.map((id) => [id, []]));
    const sigma = new Map(ids.map((id) => [id, 0]));
    const dist = new Map(ids.map((id) => [id, -1]));
    sigma.set(source, 1);
    dist.set(source, 0);
    const queue = [source];

    for (let qi = 0; qi < queue.length; qi += 1) {
      const v = queue[qi];
      stack.push(v);
      index.adj.get(v).forEach((_, w) => {
        if (dist.get(w) < 0) {
          dist.set(w, dist.get(v) + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          preds.get(w).push(v);
        }
      });
    }

    const delta = new Map(ids.map((id) => [id, 0]));
    while (stack.length) {
      const w = stack.pop();
      preds.get(w).forEach((v) => {
        delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      });
      if (w !== source) score.set(w, score.get(w) + delta.get(w));
    }
  });

  const n = ids.length;
  const norm = n > 2 ? (n - 1) * (n - 2) : 1; // undirected: each pair counted twice, so /2 * 2/((n-1)(n-2))
  ids.forEach((id) => score.set(id, score.get(id) / norm));
  return score;
}

/**
 * Brokers: entities that sit between cells. An entity qualifies when it has
 * neighbours in 2+ different cells (or is itself the link between them) and
 * its betweenness is well above the network average.
 */
export function findBrokers(index, cellOf, between, { limit = 4 } = {}) {
  const values = [...between.values()];
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const rows = [];

  index.adj.forEach((nbrs, id) => {
    const touching = new Set();
    const own = cellOf.get(id);
    if (own) touching.add(own);
    nbrs.forEach((_, other) => {
      const c = cellOf.get(other);
      if (c) touching.add(c);
    });
    const score = between.get(id) || 0;
    if (touching.size >= 2 && score > mean * 1.5) {
      rows.push({ id, score, cells: [...touching] });
    }
  });

  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* -------------------------------- shortest path ------------------------------ */

/**
 * Fewest hops between two entities; ties are broken toward stronger evidence
 * (more recorded occurrences). Returns null when they are not connected.
 */
export function findPath(index, fromId, toId) {
  if (!index.adj.has(fromId) || !index.adj.has(toId)) return null;
  if (fromId === toId) return { nodeIds: [fromId], hops: [], edgeIds: [] };

  const cost = new Map([[fromId, 0]]);
  const prev = new Map();
  const done = new Set();

  while (true) {
    let current = null;
    let best = Infinity;
    cost.forEach((c, id) => {
      if (!done.has(id) && c < best) {
        best = c;
        current = id;
      }
    });
    if (current === null) return null;
    if (current === toId) break;
    done.add(current);

    index.adj.get(current).forEach((_, next) => {
      if (done.has(next)) return;
      const strongest = strongestEdge(index, current, next);
      // hop count dominates; evidence strength only breaks ties
      const step = 1 + 0.01 / (1 + occurrenceOf(strongest));
      const candidate = best + step;
      if (candidate < (cost.get(next) ?? Infinity)) {
        cost.set(next, candidate);
        prev.set(next, current);
      }
    });
  }

  const nodeIds = [toId];
  while (nodeIds[0] !== fromId) nodeIds.unshift(prev.get(nodeIds[0]));

  const hops = [];
  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    const edge = strongestEdge(index, nodeIds[i], nodeIds[i + 1]);
    hops.push({ from: nodeIds[i], to: nodeIds[i + 1], edge });
  }
  return { nodeIds, hops, edgeIds: hops.map((h) => h.edge.id) };
}

function strongestEdge(index, a, b) {
  const list = index.edgesBetween.get(pairKey(a, b)) || [];
  return list.reduce((best, edge) => (!best || occurrenceOf(edge) > occurrenceOf(best) ? edge : best), null);
}

export function edgesBetweenNodes(index, a, b) {
  return index.edgesBetween.get(pairKey(a, b)) || [];
}

/* --------------------------- what-if: remove an entity ----------------------- */

/**
 * What happens to the network if `nodeId` is taken out (arrested, seized,
 * shut down)? Reports the groups that remain from its former component.
 */
export function removalImpact(nodes, edges, nodeId) {
  const before = buildIndex(nodes, edges);
  const beforeGroups = connectedComponents(before);
  const home = beforeGroups.find((g) => g.includes(nodeId)) || [nodeId];

  const after = buildIndex(nodes, edges, new Set([nodeId]));
  const afterGroups = connectedComponents(after);
  const homeSet = new Set(home);
  const fragments = afterGroups.filter((g) => g.every((id) => homeSet.has(id)));

  const groups = fragments.filter((g) => g.length >= 2);
  const isolated = fragments.filter((g) => g.length === 1).map((g) => g[0]);

  return {
    nodeId,
    before: home.length,
    groups,                   // remaining groups of 2+ entities
    isolated,                 // entities left with no connections at all
    splits: groups.length >= 2,
    largestAfter: groups.length ? groups[0].length : 0
  };
}

/** Entities whose removal splits their group into 2+ meaningful groups. */
export function findCutPoints(nodes, edges, candidateIds) {
  return candidateIds
    .map((id) => removalImpact(nodes, edges, id))
    .filter((impact) => impact.splits);
}

/* ---------------------------------- timeline --------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

function toTime(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export function edgeTimes(edge) {
  const list = [];
  (Array.isArray(edge?.timestamps) ? edge.timestamps : []).forEach((v) => {
    const t = toTime(v);
    if (t !== null) list.push(t);
  });
  [edge?.timestamp, edge?.eventDate].forEach((v) => {
    const t = v ? toTime(v) : null;
    if (t !== null) list.push(t);
  });
  return list.sort((a, b) => a - b);
}

/** { min, max } in epoch ms, or null if fewer than two distinct dated days exist. */
export function timeBounds(edges) {
  let min = Infinity;
  let max = -Infinity;
  edges.forEach((edge) => {
    edgeTimes(edge).forEach((t) => {
      if (t < min) min = t;
      if (t > max) max = t;
    });
  });
  if (!Number.isFinite(min) || max - min < DAY) return null;
  return { min, max };
}

/** Edge state at time `t`: undated edges are always visible. */
export function edgeAt(edge, t) {
  const times = edgeTimes(edge);
  if (!times.length) return { visible: true, count: occurrenceOf(edge), latest: null };
  const seen = times.filter((x) => x <= t);
  return { visible: seen.length > 0, count: seen.length, latest: seen[seen.length - 1] || null };
}

/** Ids of nodes that have no recorded link yet at time `t` (dated graphs only). */
export function nodesNotYetSeen(nodes, edges, t) {
  const firstSeen = new Map();
  let hasDatedEdges = false;
  edges.forEach((edge) => {
    const times = edgeTimes(edge);
    if (!times.length) {
      firstSeen.set(edge.from, -Infinity);
      firstSeen.set(edge.to, -Infinity);
      return;
    }
    hasDatedEdges = true;
    [edge.from, edge.to].forEach((id) => {
      if (!firstSeen.has(id) || times[0] < firstSeen.get(id)) firstSeen.set(id, times[0]);
    });
  });
  if (!hasDatedEdges) return new Set();
  const hidden = new Set();
  nodes.forEach((node) => {
    if (firstSeen.has(node.id) && firstSeen.get(node.id) > t) hidden.add(node.id);
  });
  return hidden;
}

export function formatDay(t) {
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------------------------------- findings --------------------------------- */

const DEFAULT_NAME = (node) => node.name || String(node.label || node.id).replace(/^\d+\.\s*/, '');
export const nameOf = DEFAULT_NAME;

/**
 * Plain-language findings for the Insights tab. Each finding lists the entity
 * (and optionally relationship) ids it refers to so the UI can jump to them.
 */
export function buildFindings({ nodes, edges, cells, cellOf, brokers, cutPoints }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cellName = new Map(cells.map((c) => [c.id, c.name]));
  const out = [];

  const totalCut = (impact) => impact.groups.reduce((sum, g) => sum + g.length, 0) || 1;
  [...cutPoints]
    .sort((a, b) => Math.min(...b.groups.map((g) => g.length)) / totalCut(b) - Math.min(...a.groups.map((g) => g.length)) / totalCut(a))
    .slice(0, 3)
    .forEach((impact) => {
      const node = byId.get(impact.nodeId);
      if (!node) return;
      const sizes = impact.groups.map((g) => g.length).join(' and ');
      out.push({
        id: `cut-${impact.nodeId}`,
        severity: 'high',
        kind: 'single-link',
        title: `${nameOf(node)} is a single point of failure`,
        text: `Without this entity the network breaks into groups of ${sizes}.`,
        nodeIds: [impact.nodeId],
        removal: impact.nodeId
      });
    });

  brokers.forEach((broker) => {
    const node = byId.get(broker.id);
    if (!node || cutPoints.some((c) => c.nodeId === broker.id)) return;
    const names = broker.cells.map((c) => cellName.get(c)).filter(Boolean).join(' and ');
    out.push({
      id: `broker-${broker.id}`,
      severity: 'medium',
      kind: 'broker',
      title: `${nameOf(node)} bridges ${names}`,
      text: 'Sits on many of the shortest routes between cells, so information or money likely passes through this entity.',
      nodeIds: [broker.id]
    });
  });

  // Shared addresses, phones and vehicles.
  const degreeInfo = new Map();
  edges.forEach((edge) => {
    [[edge.from, edge.to], [edge.to, edge.from]].forEach(([self, other]) => {
      if (!degreeInfo.has(self)) degreeInfo.set(self, new Set());
      degreeInfo.get(self).add(other);
    });
  });
  nodes
    .filter((n) => ['location', 'phone', 'vehicle'].includes(n.group))
    .forEach((node) => {
      const linked = [...(degreeInfo.get(node.id) || [])].map((id) => byId.get(id)).filter(Boolean);
      const orgs = linked.filter((n) => n.group === 'organization');
      const people = linked.filter((n) => n.group === 'person');
      if (node.group === 'location' && orgs.length >= 3) {
        out.push({
          id: `shared-${node.id}`,
          severity: 'high',
          kind: 'shared',
          title: `${orgs.length} organisations share ${nameOf(node)}`,
          text: `${orgs.map(nameOf).join(', ')} are all linked to this address. A common red flag for shell companies.`,
          nodeIds: [node.id, ...orgs.map((o) => o.id)]
        });
      } else if (node.group !== 'location' && people.length >= 2) {
        out.push({
          id: `shared-${node.id}`,
          severity: 'high',
          kind: 'shared',
          title: `${nameOf(node)} is linked to ${people.length} people`,
          text: `${people.map(nameOf).join(' and ')} are both tied to this ${node.group}. Check whether it is a shared device or vehicle.`,
          nodeIds: [node.id, ...people.map((p) => p.id)]
        });
      }
    });

  // Recurring links.
  edges
    .filter((edge) => occurrenceOf(edge) >= 4)
    .sort((a, b) => occurrenceOf(b) - occurrenceOf(a))
    .slice(0, 3)
    .forEach((edge) => {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) return;
      const times = edgeTimes(edge);
      const span = times.length > 1 ? ` between ${formatDay(times[0])} and ${formatDay(times[times.length - 1])}` : '';
      out.push({
        id: `repeat-${edge.id}`,
        severity: 'medium',
        kind: 'recurring',
        title: `${nameOf(a)} and ${nameOf(b)} keep recurring`,
        text: `${occurrenceOf(edge)} records of "${String(edge.label || 'link').replace(/_/g, ' ')}"${span}.`,
        nodeIds: [edge.from, edge.to],
        edgeId: edge.id
      });
    });

  // Newest activity.
  const bounds = timeBounds(edges);
  if (bounds) {
    const since = bounds.max - 14 * DAY;
    const fresh = new Map();
    edges.forEach((edge) => {
      const times = edgeTimes(edge);
      if (!times.length || times[0] < since) return; // only links that first appeared recently
      [edge.from, edge.to].forEach((id) => fresh.set(id, (fresh.get(id) || 0) + 1));
    });
    const top = [...fresh.entries()]
      .filter(([id]) => byId.get(id)?.group === 'person')
      .sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      out.push({
        id: `fresh-${top[0]}`,
        severity: 'info',
        kind: 'recent',
        title: `Newest activity centres on ${nameOf(byId.get(top[0]))}`,
        text: `${top[1]} new links in the last two weeks of recorded data (since ${formatDay(since)}).`,
        nodeIds: [top[0]]
      });
    }
  }

  const rank = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
