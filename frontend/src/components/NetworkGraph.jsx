import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { fetchGraph } from '../api';
import { useTheme } from '../App';
import GraphSidebar from './graph/GraphSidebar';
import {
  betweenness,
  buildFindings,
  buildIndex,
  detectCells,
  edgeAt,
  findBrokers,
  findCutPoints,
  findPath,
  formatDay,
  nameOf,
  nodesNotYetSeen,
  pairKey,
  removalImpact,
  timeBounds,
  withinHops
} from '../utils/graphAnalytics';
import { FAMILIES, TYPE_STYLES, cellColor, familyOf, paintCells, styleEdge, styleNode } from '../utils/graphVisuals';
import '../styles/graph.css';

const DAY = 24 * 60 * 60 * 1000;
const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const animation = (duration = 500) => (REDUCED_MOTION ? false : { duration, easingFunction: 'easeInOutQuad' });

function themeTokens(isDark) {
  return isDark
    ? { surface: '#18263b', text: '#e5edf9', textFaint: '#6f819d', accent: '#8caef2', gold: '#f0c96a', hot: '#ffd166', shadow: 'rgba(0, 0, 0, 0.45)' }
    : { surface: '#ffffff', text: '#17243b', textFaint: '#a3aec1', accent: '#315fbd', gold: '#d19a1f', hot: '#d9480f', shadow: 'rgba(23, 36, 59, 0.2)' };
}

/** Give edges that share the same two entities different curves so they do not overlap. */
function withParallelSmoothing(edges) {
  const groups = new Map();
  edges.forEach((edge) => {
    const key = pairKey(edge.from, edge.to);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edge);
  });
  return edges.map((edge) => {
    const list = groups.get(pairKey(edge.from, edge.to));
    if (list.length < 2) return edge;
    const i = list.indexOf(edge);
    return { ...edge, smooth: { enabled: true, type: i % 2 ? 'curvedCCW' : 'curvedCW', roundness: 0.18 + 0.12 * Math.floor(i / 2) } };
  });
}

export default function NetworkGraph() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tokens = useMemo(() => themeTokens(isDark), [isDark]);

  const containerRef = useRef(null);
  const netRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);
  const paintRef = useRef(null);
  const visibleRef = useRef([]);

  const [graph, setGraph] = useState(null);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('insights');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hiddenFamilies, setHiddenFamilies] = useState(() => new Set());
  const [showCells, setShowCells] = useState(true);
  const [hops, setHops] = useState('all');
  const [hoverEdgeId, setHoverEdgeId] = useState(null);

  const [focus, setFocus] = useState(null); // { ids:Set, label }
  const [activeCellId, setActiveCellId] = useState(null);

  const [pathFrom, setPathFrom] = useState('');
  const [pathTo, setPathTo] = useState('');
  const [pathResult, setPathResult] = useState(undefined); // undefined = not run, null = no route

  const [removedId, setRemovedId] = useState(null);

  const [timeValue, setTimeValue] = useState(null);
  const [playing, setPlaying] = useState(false);

  /* ------------------------------- load data ------------------------------- */

  useEffect(() => {
    let alive = true;
    fetchGraph()
      .then((data) => {
        if (!alive) return;
        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        const edges = withParallelSmoothing(Array.isArray(data.edges) ? data.edges : []);
        setGraph({ nodes, edges, keyEntities: Array.isArray(data.keyEntities) ? data.keyEntities : [] });
        const range = timeBounds(edges);
        setTimeValue(range ? range.max : null);
      })
      .catch(() => alive && setError('Could not reach the backend. Is it running on port 5000?'));
    return () => {
      alive = false;
    };
  }, []);

  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const edges = useMemo(() => graph?.edges || [], [graph]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const fullIndex = useMemo(() => buildIndex(nodes, edges), [nodes, edges]);
  const bounds = useMemo(() => timeBounds(edges), [edges]);

  /* ------------------------------- analytics ------------------------------- */

  const analysis = useMemo(() => {
    if (!nodes.length) return null;
    const { cells, cellOf } = detectCells(fullIndex);
    const between = betweenness(fullIndex);
    const brokers = findBrokers(fullIndex, cellOf, between);
    const linkable = [...fullIndex.adj.keys()].filter((id) => fullIndex.adj.get(id).size >= 2);
    const cutPoints = findCutPoints(nodes, edges, linkable);
    const coloured = cells.map((cell, i) => ({ ...cell, color: cellColor(i) }));
    return {
      cells: coloured,
      cellOf,
      between,
      brokers,
      brokerIds: new Set(brokers.map((b) => b.id)),
      cutPoints,
      findings: buildFindings({ nodes, edges, cells, cellOf, brokers, cutPoints })
    };
  }, [nodes, edges, fullIndex]);

  const impact = useMemo(() => (removedId ? removalImpact(nodes, edges, removedId) : null), [nodes, edges, removedId]);

  /* -------------------------------- actions -------------------------------- */

  /** Frame a set of entities with room for cell regions and labels. */
  const frame = useCallback((ids, { animate = true, maxScale = 1.2 } = {}) => {
    const net = netRef.current;
    const box = containerRef.current;
    if (!net || !box) return;
    const points = Object.values(net.getPositions(ids));
    if (!points.length) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const pad = 85;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min(maxScale, box.clientWidth / (maxX - minX + pad * 2), box.clientHeight / (maxY - minY + pad * 2));
    net.moveTo({
      position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      scale,
      animation: animate ? animation(500) : false
    });
  }, []);

  const frameAll = useCallback((options) => frame(visibleRef.current, options), [frame]);

  const fitTo = useCallback((ids) => {
    const net = netRef.current;
    if (!net) return;
    const list = [...ids];
    if (list.length === 1) net.focus(list[0], { scale: 1.0, animation: animation(450) });
    else if (list.length > 1) frame(list);
  }, [frame]);

  const selectNode = useCallback((id, options = {}) => {
    setSelectedId(id);
    if (id) setTab('entity');
    if (!id) setHops('all');
    if (options.focus && id) {
      setFocus(null);
      setActiveCellId(null);
      window.setTimeout(() => fitTo([id]), 0);
    }
  }, [fitTo]);

  const showIds = useCallback((ids, label) => {
    setSelectedId(null);
    setHops('all');
    setActiveCellId(null);
    setFocus({ ids: new Set(ids), label });
    window.setTimeout(() => fitTo(ids), 0);
  }, [fitTo]);

  const chooseCell = useCallback((cell) => {
    if (activeCellId === cell.id) {
      setActiveCellId(null);
      setFocus(null);
      return;
    }
    setActiveCellId(cell.id);
    setSelectedId(null);
    setFocus({ ids: new Set(cell.members), label: cell.name });
    window.setTimeout(() => fitTo(cell.members), 0);
  }, [activeCellId, fitTo]);

  const runPath = useCallback(() => {
    if (!pathFrom || !pathTo) return;
    const result = findPath(fullIndex, pathFrom, pathTo);
    setPathResult(result);
    setFocus(null);
    setActiveCellId(null);
    if (result) window.setTimeout(() => fitTo(result.nodeIds), 0);
  }, [fullIndex, pathFrom, pathTo, fitTo]);

  const clearPath = useCallback(() => setPathResult(undefined), []);

  const startWhatIf = useCallback((id) => {
    setRemovedId(id);
    setSelectedId(null);
    setFocus(null);
    setActiveCellId(null);
    setHops('all');
    setPathResult(undefined);
  }, []);

  const stopWhatIf = useCallback(() => {
    setRemovedId(null);
    setFocus(null);
  }, []);

  const showGroup = useCallback((ids, index) => showIds(ids, `Group ${index + 1} after removal`), [showIds]);

  const toggleFamily = (family) => {
    setHiddenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const resetView = () => {
    setQuery('');
    setTypeFilter('all');
    setHiddenFamilies(new Set());
    setHops('all');
    setFocus(null);
    setActiveCellId(null);
    setSelectedId(null);
    setPathResult(undefined);
    setRemovedId(null);
    setPlaying(false);
    if (bounds) setTimeValue(bounds.max);
    window.setTimeout(() => frameAll(), 0);
  };

  /* ------------------------------- timeline ------------------------------- */

  useEffect(() => {
    if (!playing || !bounds) return undefined;
    const step = Math.max((bounds.max - bounds.min) / 90, DAY);
    const timer = window.setInterval(() => {
      setTimeValue((prev) => Math.min((prev ?? bounds.min) + step, bounds.max));
    }, 110);
    return () => window.clearInterval(timer);
  }, [playing, bounds]);

  useEffect(() => {
    if (playing && bounds && timeValue !== null && timeValue >= bounds.max) setPlaying(false);
  }, [playing, bounds, timeValue]);

  const startReplay = () => {
    if (!bounds) return;
    setTimeValue(bounds.min);
    setPlaying(true);
  };

  const timeActive = !!bounds && timeValue !== null && timeValue < bounds.max;

  /* --------------------------- what is on screen --------------------------- */

  const view = useMemo(() => {
    if (!analysis) return null;

    const q = query.trim().toLowerCase();
    const unseen = timeActive ? nodesNotYetSeen(nodes, edges, timeValue) : new Set();
    const nearby = selectedId && hops !== 'all' ? withinHops(fullIndex, selectedId, hops) : null;

    const hiddenNodes = new Set();
    nodes.forEach((node) => {
      if (typeFilter !== 'all' && node.group !== typeFilter) hiddenNodes.add(node.id);
      else if (unseen.has(node.id)) hiddenNodes.add(node.id);
      else if (nearby && !nearby.has(node.id)) hiddenNodes.add(node.id);
    });

    const hiddenEdges = new Set();
    const edgeCount = new Map();
    edges.forEach((edge) => {
      const family = familyOf(edge.label || edge.type);
      const state = timeActive ? edgeAt(edge, timeValue) : null;
      if (state) edgeCount.set(edge.id, state.count);
      if (
        hiddenNodes.has(edge.from) || hiddenNodes.has(edge.to)
        || hiddenFamilies.has(family)
        || (state && !state.visible)
        || edge.from === removedId || edge.to === removedId
      ) {
        hiddenEdges.add(edge.id);
      }
    });

    // What gets emphasised, in order of priority.
    let emphasisNodes = null;
    const hotEdges = new Set();
    const labelEdges = new Set();
    let emphasisEdge = () => false;

    if (pathResult) {
      emphasisNodes = new Set(pathResult.nodeIds);
      pathResult.edgeIds.forEach((id) => { hotEdges.add(id); labelEdges.add(id); });
      emphasisEdge = (edge) => hotEdges.has(edge.id);
    } else if (focus) {
      emphasisNodes = focus.ids;
      emphasisEdge = (edge) => focus.ids.has(edge.from) && focus.ids.has(edge.to);
    } else if (selectedId) {
      emphasisNodes = new Set([selectedId]);
      edges.forEach((edge) => {
        if (edge.from === selectedId || edge.to === selectedId) {
          emphasisNodes.add(edge.from);
          emphasisNodes.add(edge.to);
          labelEdges.add(edge.id);
        }
      });
      emphasisEdge = (edge) => edge.from === selectedId || edge.to === selectedId;
    } else if (q) {
      const matches = new Set(nodes.filter((n) => nameOf(n).toLowerCase().includes(q)).map((n) => n.id));
      emphasisNodes = new Set(matches);
      edges.forEach((edge) => {
        if (matches.has(edge.from) || matches.has(edge.to)) {
          emphasisNodes.add(edge.from);
          emphasisNodes.add(edge.to);
        }
      });
      emphasisEdge = (edge) => matches.has(edge.from) || matches.has(edge.to);
    }

    if (hoverEdgeId) labelEdges.add(hoverEdgeId);

    const dimNodes = new Set();
    const dimEdges = new Set();
    if (emphasisNodes) {
      nodes.forEach((n) => { if (!emphasisNodes.has(n.id)) dimNodes.add(n.id); });
      edges.forEach((e) => { if (!emphasisEdge(e)) dimEdges.add(e.id); });
    }

    return { hiddenNodes, hiddenEdges, dimNodes, dimEdges, hotEdges, labelEdges, edgeCount };
  }, [analysis, nodes, edges, fullIndex, query, typeFilter, hiddenFamilies, hops, selectedId, focus, pathResult, removedId, hoverEdgeId, timeActive, timeValue]);

  /* --------------------------- create the network --------------------------- */

  useEffect(() => {
    if (!analysis || !containerRef.current) return undefined;

    const base = themeTokens(false);
    const nodeSet = new DataSet(
      nodes.map((node) => styleNode(node, { label: nameOf(node), keyRank: node.rank, broker: analysis.brokerIds.has(node.id) }, base))
    );
    const edgeSet = new DataSet(
      edges.map((edge) => ({
        ...styleEdge(edge, {}, base),
        from: edge.from,
        to: edge.to,
        // keep cells visually apart so their regions do not overlap
        length: analysis.cellOf.get(edge.from) && analysis.cellOf.get(edge.from) !== analysis.cellOf.get(edge.to) ? 240 : 115
      }))
    );

    const network = new Network(containerRef.current, { nodes: nodeSet, edges: edgeSet }, {
      autoResize: true,
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { gravitationalConstant: -85, centralGravity: 0.008, springConstant: 0.06, damping: 0.55, avoidOverlap: 1 },
        stabilization: { iterations: 320, updateInterval: 40 }
      },
      interaction: { hover: true, hoverConnectedEdges: false, selectConnectedEdges: false, tooltipDelay: 100000, zoomSpeed: 0.6 },
      nodes: { font: { size: 12 }, scaling: { label: { drawThreshold: 5 } } },
      edges: { font: { size: 11 }, chosen: false }
    });

    // Keep labels readable at any zoom level: grow the font as the graph shrinks.
    let fontSize = 12;
    const applyFontScale = () => {
      const size = Math.round(Math.min(22, Math.max(12, 12 / network.getScale())));
      if (size === fontSize) return;
      fontSize = size;
      network.setOptions({ nodes: { font: { size } }, edges: { font: { size: Math.max(11, size - 1) } } });
    };
    network.on('zoom', applyFontScale);
    network.on('animationFinished', applyFontScale);

    network.on('click', (params) => {
      if (params.nodes.length) selectNode(params.nodes[0]);
      else if (!params.edges.length) selectNode(null);
    });
    network.on('doubleClick', (params) => {
      if (params.nodes.length) network.focus(params.nodes[0], { scale: 1.3, animation: animation(400) });
    });
    network.on('hoverNode', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer'; });
    network.on('blurNode', () => { if (containerRef.current) containerRef.current.style.cursor = 'default'; });
    network.on('hoverEdge', (params) => setHoverEdgeId(params.edge));
    network.on('blurEdge', () => setHoverEdgeId(null));
    network.on('beforeDrawing', (ctx) => {
      const paint = paintRef.current;
      if (!paint || !paint.showCells) return;
      paintCells(ctx, (ids) => network.getPositions(ids), paint.cells, paint);
    });
    network.once('stabilizationIterationsDone', () => {
      network.setOptions({ physics: false });
      frame(nodes.map((n) => n.id));
    });

    netRef.current = network;
    nodesRef.current = nodeSet;
    edgesRef.current = edgeSet;

    return () => {
      network.destroy();
      netRef.current = null;
      nodesRef.current = null;
      edgesRef.current = null;
    };
  }, [analysis, nodes, edges, selectNode, frame]);

  /* ------------------------- push state into the canvas ------------------------- */

  useEffect(() => {
    const net = netRef.current;
    if (!net || !view || !analysis) return;

    nodesRef.current.update(
      nodes.map((node) => styleNode(node, {
        hidden: view.hiddenNodes.has(node.id),
        dim: view.dimNodes.has(node.id) || node.id === removedId,
        selected: node.id === selectedId,
        label: node.id === removedId ? `${nameOf(node)} (removed)` : nameOf(node),
        keyRank: node.rank,
        broker: analysis.brokerIds.has(node.id)
      }, tokens))
    );

    edgesRef.current.update(
      edges.map((edge) => styleEdge(edge, {
        hidden: view.hiddenEdges.has(edge.id),
        dim: view.dimEdges.has(edge.id),
        hot: view.hotEdges.has(edge.id),
        label: view.labelEdges.has(edge.id),
        count: view.edgeCount.get(edge.id)
      }, tokens))
    );

    visibleRef.current = nodes.filter((n) => !view.hiddenNodes.has(n.id) && n.id !== removedId).map((n) => n.id);
    paintRef.current = {
      showCells,
      cells: analysis.cells,
      isVisible: (id) => !view.hiddenNodes.has(id) && id !== removedId,
      activeCellId,
      dark: isDark
    };
    net.redraw();
  }, [view, analysis, nodes, edges, tokens, isDark, selectedId, removedId, showCells, activeCellId]);

  /* -------------------------------- toolbar -------------------------------- */

  const zoomBy = (factor) => {
    const net = netRef.current;
    if (net) net.moveTo({ scale: net.getScale() * factor, animation: animation(250) });
  };

  const relayout = () => {
    const net = netRef.current;
    if (!net) return;
    net.setOptions({ physics: { enabled: true } });
    net.once('stabilized', () => {
      net.setOptions({ physics: false });
      frameAll();
    });
    net.stabilize(200);
  };

  const exportPng = () => {
    const source = containerRef.current?.querySelector('canvas');
    if (!source) return;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = tokens.surface;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    const link = document.createElement('a');
    link.download = `crimenexa-network-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  };

  const onSearchKey = (event) => {
    if (event.key !== 'Enter') return;
    const q = query.trim().toLowerCase();
    const match = nodes.find((n) => nameOf(n).toLowerCase().includes(q));
    if (match) selectNode(match.id, { focus: true });
  };

  /* -------------------------------- rendering -------------------------------- */

  if (error) {
    return (
      <div className="page">
        <div className="page-header"><h1>Network Graph</h1></div>
        <p className="page-error">{error}</p>
      </div>
    );
  }

  const shownNodes = view ? nodes.length - view.hiddenNodes.size : 0;
  const shownEdges = view ? edges.length - view.hiddenEdges.size : 0;
  const isEmpty = graph && !nodes.length;

  const banners = [];
  if (removedId && impact) {
    banners.push({
      key: 'removal',
      tone: 'danger',
      text: impact.splits
        ? `Without ${nameOf(nodeById.get(removedId))}, the network splits into ${impact.groups.length} groups`
        : `Without ${nameOf(nodeById.get(removedId))}, the network stays in one piece`,
      action: 'Bring back',
      run: stopWhatIf
    });
  }
  if (pathResult) banners.push({ key: 'path', text: 'Showing the shortest connection', action: 'Clear', run: clearPath });
  if (focus && !pathResult) banners.push({ key: 'focus', text: `Showing ${focus.label}`, action: 'Clear', run: () => { setFocus(null); setActiveCellId(null); } });
  if (selectedId && hops !== 'all') banners.push({ key: 'hops', text: `Only entities within ${hops} ${hops === 1 ? 'step' : 'steps'} of ${nameOf(nodeById.get(selectedId))}`, action: 'Show all', run: () => setHops('all') });

  const sidebarCtx = analysis && {
    tab,
    setTab,
    nodes,
    edges,
    nodeById,
    analysis,
    keyEntities: graph.keyEntities,
    selectedId,
    selectNode,
    showIds,
    activeCellId,
    chooseCell,
    hops,
    setHops,
    path: { from: pathFrom, to: pathTo, setFrom: setPathFrom, setTo: setPathTo, result: pathResult, run: runPath, clear: clearPath },
    whatIf: { start: startWhatIf }
  };

  return (
    <div className="page gx-page">
      <div className="page-header">
        <h1>Network Graph</h1>
        <p className="page-subtitle">See how people, places, phones and companies connect, where the network is fragile, and what changed over time.</p>
      </div>

      {!graph && <p className="empty-state">Loading network...</p>}
      {isEmpty && <p className="empty-state">No graph data yet. Analyze a report first.</p>}

      {analysis && (
        <div className="gx-shell">
          <section className="panel gx-stage" aria-label="Network graph">
            <div className="gx-toolbar">
              <label className="gx-search">
                <span className="gx-visually-hidden">Search entities</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Find an entity"
                />
              </label>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Show only one kind of entity">
                <option value="all">All entity types</option>
                {Object.entries(TYPE_STYLES).filter(([key]) => nodes.some((n) => n.group === key)).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
              <button type="button" className={`gx-toggle ${showCells ? 'is-on' : ''}`} aria-pressed={showCells} onClick={() => setShowCells((v) => !v)}>
                Cell regions
              </button>
              <span className="gx-spacer" />
              <button type="button" className="gx-icon-button" onClick={() => frameAll()} aria-label="Fit graph to screen" title="Fit to screen">Fit</button>
              <button type="button" className="gx-icon-button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
              <button type="button" className="gx-icon-button" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">-</button>
              <button type="button" className="gx-icon-button" onClick={relayout} title="Re-arrange the layout">Re-layout</button>
              <button type="button" className="gx-icon-button" onClick={exportPng} title="Download the current view as an image">Save image</button>
              <button type="button" className="gx-icon-button" onClick={resetView}>Reset</button>
            </div>

            <div className="gx-stats" aria-live="polite">
              <span><strong>{shownNodes}</strong> entities</span>
              <span><strong>{shownEdges}</strong> links</span>
              <span><strong>{analysis.cells.length}</strong> cells</span>
              <span><strong>{analysis.brokers.length}</strong> brokers</span>
            </div>

            <div className="gx-canvas-wrap">
              <div ref={containerRef} className="gx-canvas" role="img" aria-label="Interactive network graph of entities and their relationships" />

              {banners.length > 0 && (
                <div className="gx-banners">
                  {banners.map((b) => (
                    <div key={b.key} className={`gx-banner ${b.tone === 'danger' ? 'is-danger' : ''}`}>
                      <span>{b.text}</span>
                      <button type="button" onClick={b.run}>{b.action}</button>
                    </div>
                  ))}
                  {impact && removedId && (impact.groups.length > 0 || impact.isolated.length > 0) && (
                    <div className="gx-banner gx-fragments">
                      {impact.groups.map((group, i) => (
                        <button type="button" key={i} onClick={() => showGroup(group, i)}>
                          Group {i + 1}: {group.length} entities
                        </button>
                      ))}
                      {impact.isolated.length > 0 && <span>{impact.isolated.length} left with no connections</span>}
                    </div>
                  )}
                </div>
              )}

              {hoverEdgeId && (() => {
                const edge = edges.find((e) => e.id === hoverEdgeId);
                if (!edge) return null;
                const times = edge.timestamps || [];
                return (
                  <div className="gx-edge-card">
                    <strong>{nameOf(nodeById.get(edge.from))} to {nameOf(nodeById.get(edge.to))}</strong>
                    <span>{String(edge.label || edge.type).replace(/_/g, ' ')}, {edge.occurrenceCount || 1} {(edge.occurrenceCount || 1) === 1 ? 'record' : 'records'}</span>
                    {edge.description && <span>{edge.description}</span>}
                    {times.length > 0 && <span>{formatDay(Date.parse(times[0]))}{times.length > 1 ? ` to ${formatDay(Date.parse(times[times.length - 1]))}` : ''}</span>}
                    {edge.sourceTypes?.length > 0 && <span>Sources: {edge.sourceTypes.join(', ')}</span>}
                  </div>
                );
              })()}
            </div>

            {bounds && (
              <div className="gx-timeline">
                <button type="button" className="gx-button" onClick={playing ? () => setPlaying(false) : startReplay}>
                  {playing ? 'Pause' : 'Replay growth'}
                </button>
                <input
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={DAY}
                  value={timeValue ?? bounds.max}
                  onChange={(event) => { setPlaying(false); setTimeValue(Number(event.target.value)); }}
                  aria-label="Show the network as it was on this date"
                />
                <time>{formatDay(timeValue ?? bounds.max)}</time>
              </div>
            )}

            <div className="gx-legend">
              <div className="gx-legend-group" aria-label="Entity types">
                {Object.entries(TYPE_STYLES).filter(([key]) => nodes.some((n) => n.group === key)).map(([key, item]) => (
                  <span key={key} className="gx-legend-item"><i className="gx-dot-swatch" style={{ background: item.color }} />{item.label}</span>
                ))}
              </div>
              <div className="gx-legend-group" aria-label="Relationship types, click to hide or show">
                {Object.entries(FAMILIES).filter(([key]) => edges.some((e) => familyOf(e.label || e.type) === key)).map(([key, item]) => (
                  <button
                    type="button"
                    key={key}
                    className={`gx-legend-chip ${hiddenFamilies.has(key) ? 'is-off' : ''}`}
                    aria-pressed={!hiddenFamilies.has(key)}
                    onClick={() => toggleFamily(key)}
                  >
                    <i className="gx-line-swatch" style={{ background: item.color }} />{item.label}
                  </button>
                ))}
              </div>
              <p className="gx-key">Gold ring: top three by importance. Dashed ring: broker between cells. Thicker line: more recorded occurrences. Shaded region: cell.</p>
            </div>
          </section>

          <GraphSidebar ctx={sidebarCtx} />
        </div>
      )}
    </div>
  );
}
