import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { fetchGraph } from '../api';
import { useTheme } from '../App';

const GROUP_COLORS = {
  person: '#6654b7',
  location: '#397ac2',
  organization: '#c66d69',
  vehicle: '#c98b32',
  phone: '#278f96'
};

const LEGEND = [
  { group: 'person', label: 'Person' },
  { group: 'location', label: 'Location' },
  { group: 'organization', label: 'Organization' },
  { group: 'vehicle', label: 'Vehicle' },
  { group: 'phone', label: 'Phone Number' }
];

export default function NetworkGraph() {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [error, setError] = useState('');
  const [keyEntities, setKeyEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], keyEntities: [] });
  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const filteredGraph = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visibleNodes = graphData.nodes.filter((node) => {
      const matchesType = entityFilter === 'all' || node.group === entityFilter;
      const matchesQuery = !normalizedQuery || `${node.label} ${node.title || ''}`.toLowerCase().includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graphData.edges.filter((edge) => (
      visibleIds.has(edge.from) && visibleIds.has(edge.to)
      && (relationshipFilter === 'all' || edge.label === relationshipFilter)
    ));
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [entityFilter, graphData, query, relationshipFilter]);

  useEffect(() => {
    fetchGraph()
      .then(({ nodes, edges, keyEntities: rankedEntities = [] }) => {
        setGraphData({ nodes, edges, keyEntities: rankedEntities });
        setKeyEntities(rankedEntities);
        if (!nodes.length) {
          setIsEmpty(true);
        }
      })
      .catch(() => setError('Could not reach the backend. Is it running?'));
  }, []);

  useEffect(() => {
    if (!filteredGraph.nodes.length || !containerRef.current) return undefined;
    const selectedNeighbors = selectedEntityId
      ? new Set([selectedEntityId, ...graphData.edges.filter((edge) => edge.from === selectedEntityId || edge.to === selectedEntityId).flatMap((edge) => [edge.from, edge.to])])
      : null;
    const styledNodes = filteredGraph.nodes.map((node) => {
      const isSelected = node.id === selectedEntityId;
      const isDimmed = selectedNeighbors && !selectedNeighbors.has(node.id);
      const ranking = node.keyEntityScore || 0;
      return {
        ...node,
        label: `${node.label}\n${node.group}`,
        color: {
          background: GROUP_COLORS[node.group] || '#8b97aa',
          border: node.rank === 1 ? (isDark ? '#e5b957' : '#d69b2c') : isSelected ? (isDark ? '#8aaef0' : '#244c9b') : (isDark ? '#253a59' : '#ffffff'),
          highlight: { background: GROUP_COLORS[node.group] || '#8b97aa', border: isDark ? '#b9d0ff' : '#244c9b' }
        },
        font: { color: isDimmed ? (isDark ? '#687891' : '#aeb8c7') : (isDark ? '#e5edf9' : '#1c2a40'), face: 'Aptos', size: 13, multi: true },
        shape: 'dot', size: 15 + Math.round(ranking * 14) + (isSelected ? 3 : 0),
        borderWidth: node.rank === 1 || isSelected ? 4 : 2,
        opacity: isDimmed ? 0.28 : 1,
        title: `${node.label}\n${node.group}${node.keyEntityScore ? `\nRank #${node.rank} · Score ${node.keyEntityScore}\n${node.reasons.join(' · ')}` : ''}`
      };
    });
    const data = {
      nodes: new DataSet(styledNodes),
      edges: new DataSet(filteredGraph.edges.map((edge) => ({
        ...edge,
        color: { color: selectedNeighbors && (!selectedNeighbors.has(edge.from) || !selectedNeighbors.has(edge.to)) ? (isDark ? '#31445f' : '#dce3ed') : (isDark ? '#7186a5' : '#9aa9bd'), highlight: isDark ? '#9bbcff' : '#315fbd' },
        font: { color: isDark ? '#c3d0e5' : '#60708a', size: 10, strokeWidth: 3, strokeColor: isDark ? '#111d31' : '#ffffff' },
        smooth: { type: 'dynamic' }, arrows: { to: { enabled: true, scaleFactor: 0.45 } }
      })))
    };
    const network = new Network(containerRef.current, data, {
      physics: { stabilization: { iterations: 180 }, barnesHut: { gravitationalConstant: -4200, springLength: 145, avoidOverlap: 0.8 } },
      interaction: { hover: true, tooltipDelay: 120, navigationButtons: false },
      edges: { width: 1.2 }, nodes: { shadow: { enabled: true, color: isDark ? 'rgba(0, 0, 0, .38)' : 'rgba(26, 52, 85, .16)', size: 7, x: 0, y: 3 } }
    });
    networkRef.current = network;
    network.on('click', ({ nodes: selectedNodes }) => setSelectedEntityId(selectedNodes[0] || null));
    network.once('stabilizationIterationsDone', () => network.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } }));
    if (selectedEntityId && filteredGraph.nodes.some((node) => node.id === selectedEntityId)) {
      network.selectNodes([selectedEntityId]);
    }
    return () => network.destroy();
  }, [filteredGraph, graphData.edges, selectedEntityId, isDark]);

  const focusEntity = (entityId) => {
    if (!networkRef.current) return;
    const connectedNodeIds = networkRef.current.getConnectedNodes(entityId);
    networkRef.current.selectNodes([entityId, ...connectedNodeIds]);
    networkRef.current.focus(entityId, { scale: 1.25, animation: { duration: 450, easingFunction: 'easeInOutQuad' } });
    setSelectedEntityId(entityId);
  };

  const selectedEntity = keyEntities.find((entity) => entity.entityId === selectedEntityId) || keyEntities[0];
  const relationshipTypes = [...new Set(graphData.edges.map((edge) => edge.label).filter(Boolean))].sort();
  const counts = {
    relationships: filteredGraph.edges.length,
    people: filteredGraph.nodes.filter((node) => node.group === 'person').length,
    locations: filteredGraph.nodes.filter((node) => node.group === 'location').length,
    vehicles: filteredGraph.nodes.filter((node) => node.group === 'vehicle').length,
    organizations: filteredGraph.nodes.filter((node) => node.group === 'organization').length
  };

  return (
    <div className="page">
      <div className="page-header graph-page-header">
        <span className="eyebrow">Investigation workspace / network intelligence</span>
        <h1>Network Graph</h1>
        <p className="page-subtitle">Explore connections, relationships and structurally important entities.</p>
      </div>

      <div className="panel graph-panel">
        <div className="graph-toolbar">
          <label className="graph-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities, locations, phone numbers..." /></label>
          <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} aria-label="Filter entity types">
            <option value="all">All entity types</option>
            {LEGEND.map((item) => <option value={item.group} key={item.group}>{item.label}</option>)}
          </select>
          <select value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value)} aria-label="Filter relationships">
            <option value="all">All relationships</option>
            {relationshipTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
          <button className="toolbar-button" type="button" onClick={() => { setQuery(''); setEntityFilter('all'); setRelationshipFilter('all'); }}>Reset</button>
          <button className="toolbar-icon" type="button" onClick={() => networkRef.current?.fit({ animation: true })} title="Fit graph">⊙</button>
          <button className="toolbar-icon" type="button" onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) * 1.18 })} title="Zoom in">＋</button>
          <button className="toolbar-icon" type="button" onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) / 1.18 })} title="Zoom out">−</button>
        </div>
        <div className="graph-summary-strip">
          {Object.entries(counts).map(([key, value]) => <div key={key}><strong>{value}</strong><span>{key}</span></div>)}
        </div>

        <div className="graph-workspace">
          <div ref={containerRef} className="graph-canvas" />
          <aside className="key-entities" aria-labelledby="key-entities-heading">
            <div className="key-entities-header">
              <div>
                <h2 id="key-entities-heading">Key Entities</h2>
                <p>Structural importance in the current evidence network.</p>
              </div>
              {selectedEntityId && <span className="key-entity-selection">Highlighted in graph</span>}
            </div>
            <div className="key-entity-list">
              {keyEntities.slice(0, 5).map((entity) => (
                <button
                  type="button"
                  className={`key-entity-item ${selectedEntityId === entity.entityId ? 'selected' : ''}`}
                  key={entity.entityId}
                  onClick={() => focusEntity(entity.entityId)}
                >
                  <span className="key-entity-rank">#{entity.rank}</span>
                  <span className="key-entity-content">
                    <strong>{entity.name}</strong>
                    <span>{entity.entityType} · Score {entity.keyEntityScore}</span>
                    <span>{entity.metrics.connections} connections · {entity.metrics.relationshipTypes} relationship types · {entity.metrics.entityTypes} entity types · {entity.metrics.evidenceSources} evidence sources</span>
                    <small>Why: {entity.reasons.join('; ')}</small>
                  </span>
                </button>
              ))}
            </div>
            {selectedEntity && (
              <div className="entity-detail-card">
                <span className="eyebrow">Selected entity</span>
                <h3>{selectedEntity.name}</h3>
                <span className="detail-type">{selectedEntity.entityType} · Rank #{selectedEntity.rank}</span>
                <div className="detail-metrics"><span><strong>{selectedEntity.keyEntityScore}</strong> score</span><span><strong>{selectedEntity.metrics.connections}</strong> connections</span><span><strong>{selectedEntity.metrics.evidenceSources}</strong> sources</span><span><strong>{selectedEntity.metrics.temporalOccurrences}</strong> temporal</span></div>
                <p>Why important</p>
                <ul>{selectedEntity.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
        <div className="graph-legend legend">
          {LEGEND.map((l) => <div className="legend-item" key={l.group}><span className="legend-dot" style={{ background: GROUP_COLORS[l.group] }} />{l.label}</div>)}
        </div>

        {error && <p className="page-error">{error}</p>}
        {isEmpty && !error && (
          <p className="empty-state">No graph data yet — analyze a report first.</p>
        )}
      </div>
    </div>
  );
}
