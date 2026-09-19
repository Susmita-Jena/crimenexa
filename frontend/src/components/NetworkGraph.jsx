import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { fetchGraph } from '../api';
import { useTheme } from '../App';

const GROUP_STYLES = {
  person: { color: '#6654b7', icon: '👤', label: 'Person' },
  location: { color: '#397ac2', icon: '📍', label: 'Location' },
  organization: { color: '#c66d69', icon: '🏢', label: 'Organization' },
  vehicle: { color: '#c98b32', icon: '🚗', label: 'Vehicle' },
  phone: { color: '#278f96', icon: '☎', label: 'Phone Number' },
  event: { color: '#7a62b8', icon: '◷', label: 'Event' },
  evidence: { color: '#7b8798', icon: '▣', label: 'Evidence' }
};

const RELATIONSHIP_STYLES = {
  communicated_with: { color: '#278f96', icon: '☎', label: 'Communication' },
  communication: { color: '#278f96', icon: '☎', label: 'Communication' },
  located_at: { color: '#397ac2', icon: '📍', label: 'Location' },
  seen_at: { color: '#397ac2', icon: '📍', label: 'Location / Observation' },
  owns: { color: '#c98b32', icon: '🚗', label: 'Vehicle' },
  owned_by: { color: '#c98b32', icon: '🚗', label: 'Vehicle' },
  associated_with: { color: '#6654b7', icon: '↔', label: 'Association' },
  connected_to: { color: '#6654b7', icon: '↔', label: 'Connection' },
  works_for: { color: '#c66d69', icon: '🏢', label: 'Organization' },
  involved_in: { color: '#7a62b8', icon: '◷', label: 'Event' },
  event_of: { color: '#7a62b8', icon: '◷', label: 'Event' },
  linked_to: { color: '#7b8798', icon: '▣', label: 'Evidence Link' }
};

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

function relationshipStyle(type) {
  const key = normalize(type);
  return RELATIONSHIP_STYLES[key] || { color: '#7d8ca3', icon: '•', label: type || 'Relationship' };
}

function getOccurrenceCount(edge) {
  const candidates = [
    edge.occurrenceCount,
    edge.frequency,
    edge.count,
    edge.interactions,
    edge.evidenceCount,
    Array.isArray(edge.evidenceRefs) ? edge.evidenceRefs.length : 0,
    Array.isArray(edge.evidence) ? edge.evidence.length : 0,
    Array.isArray(edge.timestamps) ? edge.timestamps.length : 0,
    1
  ];
  const n = Number(candidates.find((v) => Number(v) > 0));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function edgeWidth(edge) {
  const count = getOccurrenceCount(edge);
  if (count >= 4) return 4;
  if (count >= 2) return 2.6;
  return 1.4;
}

function sourceList(entity) {
  const values = [
    ...(Array.isArray(entity?.sourceTypes) ? entity.sourceTypes : []),
    ...(Array.isArray(entity?.sources) ? entity.sources : []),
    ...(Array.isArray(entity?.provenance?.sources) ? entity.provenance.sources : [])
  ].filter(Boolean);
  return [...new Set(values.map(String))];
}

function evidenceList(entity) {
  const values = [
    ...(Array.isArray(entity?.evidenceRefs) ? entity.evidenceRefs : []),
    ...(Array.isArray(entity?.evidenceIds) ? entity.evidenceIds : []),
    ...(Array.isArray(entity?.provenance?.evidenceRefs) ? entity.provenance.evidenceRefs : [])
  ].filter(Boolean);
  return [...new Set(values.map(String))];
}

function stationList(entity) {
  const values = [
    entity?.policeStation,
    entity?.station,
    entity?.stationName,
    entity?.jurisdiction,
    entity?.provenance?.policeStation,
    entity?.provenance?.station,
    ...(Array.isArray(entity?.provenance?.policeStations) ? entity.provenance.policeStations : [])
  ].filter(Boolean);
  return [...new Set(values.map(String))];
}

function caseList(entity) {
  const values = [
    entity?.caseId,
    entity?.caseID,
    entity?.provenance?.caseId,
    ...(Array.isArray(entity?.caseIds) ? entity.caseIds : [])
  ].filter(Boolean);
  return [...new Set(values.map(String))];
}

function formatEdgeDetails(edge) {
  const style = relationshipStyle(edge.label || edge.type);
  const sources = [
    ...(Array.isArray(edge.sourceTypes) ? edge.sourceTypes : []),
    ...(Array.isArray(edge.sources) ? edge.sources : [])
  ].filter(Boolean);
  const evidence = [
    ...(Array.isArray(edge.evidenceRefs) ? edge.evidenceRefs : []),
    ...(Array.isArray(edge.evidenceIds) ? edge.evidenceIds : [])
  ].filter(Boolean);
  const timestamps = Array.isArray(edge.timestamps) ? edge.timestamps.filter(Boolean) : [];
  return [
    `${style.icon} ${edge.label || edge.type || 'Relationship'}`,
    `Occurrences: ${getOccurrenceCount(edge)}`,
    sources.length ? `Sources: ${[...new Set(sources)].join(', ')}` : '',
    evidence.length ? `Evidence: ${[...new Set(evidence)].join(', ')}` : '',
    timestamps.length ? `Observed: ${timestamps[0]}${timestamps.length > 1 ? ` → ${timestamps[timestamps.length - 1]}` : ''}` : ''
  ].filter(Boolean).join('\n');
}

function buildAlerts(nodes, edges, keyEntities) {
  const alerts = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  edges.forEach((edge) => {
    const count = getOccurrenceCount(edge);
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const evidenceCount = Array.isArray(edge.evidenceRefs) ? edge.evidenceRefs.length : Number(edge.evidenceCount || 0);
    const sourceCount = Array.isArray(edge.sourceTypes) ? edge.sourceTypes.length : Number(edge.sourceCount || 0);
    const label = edge.label || edge.type || 'relationship';

    if (count >= 2) {
      alerts.push({
        id: `repeat-${edge.id || `${edge.from}-${edge.to}-${label}`}`,
        severity: count >= 4 ? 'high' : 'medium',
        icon: '↻',
        title: 'Repeated Connection Detected',
        text: `${from?.label || edge.from} ↔ ${to?.label || edge.to} has ${count} recorded occurrence${count === 1 ? '' : 's'}.`,
        nodeId: edge.from,
        edgeId: edge.id
      });
    }

    if (sourceCount >= 2 || evidenceCount >= 2) {
      alerts.push({
        id: `cross-${edge.id || `${edge.from}-${edge.to}-${label}`}`,
        severity: 'medium',
        icon: '◈',
        title: 'Cross-Source Recurrence',
        text: `${label} is supported by multiple recorded sources/evidence references.`,
        nodeId: edge.from,
        edgeId: edge.id
      });
    }

    const hasMovement = ['located_at', 'seen_at', 'location', 'movement'].includes(normalize(label));
    if (hasMovement && (edge.timestamp || edge.eventDate || edge.timestamps?.length)) {
      alerts.push({
        id: `move-${edge.id || `${edge.from}-${edge.to}`}`,
        severity: 'medium',
        icon: '📍',
        title: 'New Activity / Movement Signal',
        text: `${from?.label || edge.from} has a recorded location activity linked to ${to?.label || edge.to}.`,
        nodeId: edge.from,
        edgeId: edge.id
      });
    }
  });

  keyEntities.slice(0, 3).forEach((entity) => {
    alerts.push({
      id: `key-${entity.entityId}`,
      severity: 'info',
      icon: '◎',
      title: 'Key Entity Identified',
      text: `${entity.name} is ranked #${entity.rank} by structural importance.`,
      nodeId: entity.entityId
    });
  });

  const seen = new Set();
  return alerts.filter((a) => {
    const key = `${a.title}|${a.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

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
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const alerts = useMemo(
    () => buildAlerts(graphData.nodes, graphData.edges, keyEntities),
    [graphData.nodes, graphData.edges, keyEntities]
  );

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
    setError('');
    fetchGraph()
      .then(({ nodes = [], edges = [], keyEntities: rankedEntities = [] }) => {
        setGraphData({ nodes, edges, keyEntities: rankedEntities });
        setKeyEntities(rankedEntities);
        setIsEmpty(!nodes.length);
      })
      .catch(() => setError('Could not reach the backend. Is it running?'));
  }, []);

  useEffect(() => {
    if (!filteredGraph.nodes.length || !containerRef.current) return undefined;

    const selectedNeighbors = selectedEntityId
      ? new Set([
          selectedEntityId,
          ...graphData.edges
            .filter((edge) => edge.from === selectedEntityId || edge.to === selectedEntityId)
            .flatMap((edge) => [edge.from, edge.to])
        ])
      : null;

    const styledNodes = filteredGraph.nodes.map((node) => {
      const isSelected = node.id === selectedEntityId;
      const isDimmed = selectedNeighbors && !selectedNeighbors.has(node.id);
      const ranking = Number(node.keyEntityScore || 0);
      const group = node.group || 'person';
      const style = GROUP_STYLES[group] || { color: '#8b97aa', icon: '●', label: group };

      return {
        ...node,
        label: `${style.icon}  ${node.label}\n${style.label}`,
        color: {
          background: style.color,
          border: node.rank === 1
            ? (isDark ? '#f0c96a' : '#c88d22')
            : isSelected
              ? (isDark ? '#b9d0ff' : '#244c9b')
              : (isDark ? '#314766' : '#ffffff'),
          highlight: {
            background: style.color,
            border: isDark ? '#e6efff' : '#244c9b'
          }
        },
        font: {
          color: isDimmed ? (isDark ? '#687891' : '#aeb8c7') : (isDark ? '#e5edf9' : '#1c2a40'),
          face: 'Aptos',
          size: 12,
          multi: true
        },
        shape: 'dot',
        size: Math.min(34, 15 + Math.round(ranking * 8) + (isSelected ? 3 : 0)),
        borderWidth: node.rank === 1 || isSelected ? 4 : 2,
        opacity: isDimmed ? 0.28 : 1,
        title: [
          `${style.icon} ${node.label}`,
          `Type: ${style.label}`,
          node.rank ? `Key Entity Rank: #${node.rank} · Score ${node.keyEntityScore}` : '',
          node.reasons?.length ? `Why: ${node.reasons.join(' · ')}` : ''
        ].filter(Boolean).join('\n')
      };
    });

    const styledEdges = filteredGraph.edges.map((edge) => {
      const style = relationshipStyle(edge.label || edge.type);
      const unrelated = selectedNeighbors && (!selectedNeighbors.has(edge.from) || !selectedNeighbors.has(edge.to));
      return {
        ...edge,
        label: `${style.icon} ${edge.label || edge.type || 'RELATED'}`,
        width: edgeWidth(edge),
        color: {
          color: unrelated ? (isDark ? '#26364e' : '#dfe5ee') : style.color,
          highlight: isDark ? '#c7d9ff' : '#315fbd',
          hover: style.color
        },
        font: {
          color: unrelated ? (isDark ? '#53647c' : '#aab4c3') : (isDark ? '#c3d0e5' : '#60708a'),
          size: 9,
          strokeWidth: 3,
          strokeColor: isDark ? '#111d31' : '#ffffff',
          align: 'middle'
        },
        smooth: { type: 'dynamic' },
        arrows: edge.arrows || { to: { enabled: true, scaleFactor: 0.45 } },
        title: formatEdgeDetails(edge)
      };
    });

    const network = new Network(containerRef.current, {
      nodes: new DataSet(styledNodes),
      edges: new DataSet(styledEdges)
    }, {
      physics: {
        stabilization: { iterations: 180 },
        barnesHut: { gravitationalConstant: -4200, springLength: 145, avoidOverlap: 0.8 }
      },
      interaction: { hover: true, tooltipDelay: 120, navigationButtons: false },
      edges: { width: 1.2, selectionWidth: 2 },
      nodes: { shadow: { enabled: true, color: isDark ? 'rgba(0, 0, 0, .38)' : 'rgba(26, 52, 85, .16)', size: 7, x: 0, y: 3 } }
    });

    networkRef.current = network;

    network.on('click', ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelectedEntityId(selectedNodes[0] || null);
      setSelectedEdge(selectedEdges[0] ? graphData.edges.find((e) => e.id === selectedEdges[0]) || null : null);
    });

    network.on('hoverEdge', ({ edge }) => {
      const original = graphData.edges.find((e) => e.id === edge);
      if (original) setSelectedEdge(original);
    });

    network.once('stabilizationIterationsDone', () => {
      network.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
    });

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
    setShowNotifications(false);
  };

  const selectedEntity =
    keyEntities.find((entity) => entity.entityId === selectedEntityId) ||
    keyEntities[0];

  const selectedSources = sourceList(selectedEntity);
  const selectedEvidence = evidenceList(selectedEntity);
  const selectedStations = stationList(selectedEntity);
  const selectedCases = caseList(selectedEntity);

  const selectedNodeEdges = selectedEntityId
    ? graphData.edges.filter((edge) => edge.from === selectedEntityId || edge.to === selectedEntityId)
    : [];

  const activityEdges = selectedEntityId
    ? selectedNodeEdges
        .filter((edge) => edge.timestamp || edge.eventDate || edge.timestamps?.length)
        .sort((a, b) => String(a.timestamp || a.eventDate || a.timestamps?.[0] || '').localeCompare(String(b.timestamp || b.eventDate || b.timestamps?.[0] || '')))
    : [];

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1>Network Graph</h1>
            <p className="page-subtitle">Explore connections, recurring activity and structurally important entities.</p>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setShowNotifications((v) => !v)}
              aria-label="Open investigative notifications"
              aria-expanded={showNotifications}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <span aria-hidden="true">🔔</span>
              Notifications
              {alerts.length > 0 && (
                <span style={{ minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: '#c84b4b', color: '#fff' }}>
                  {alerts.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 360, maxWidth: 'calc(100vw - 32px)', zIndex: 30, background: isDark ? '#18243a' : '#fff', color: isDark ? '#e7eef9' : '#1b2a40', border: `1px solid ${isDark ? '#30435f' : '#dce3ed'}`, borderRadius: 14, boxShadow: '0 14px 40px rgba(20,35,60,.18)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong>Investigative Signals</strong>
                  <span style={{ fontSize: 12, opacity: .7 }}>{alerts.length} detected</span>
                </div>
                {!alerts.length && <div style={{ padding: 18, fontSize: 13, opacity: .7 }}>No evidence-backed activity signals detected.</div>}
                {alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      if (alert.nodeId) focusEntity(alert.nodeId);
                      if (alert.edgeId) setSelectedEdge(graphData.edges.find((e) => e.id === alert.edgeId) || null);
                    }}
                    style={{ width: '100%', textAlign: 'left', border: 0, borderTop: `1px solid ${isDark ? '#2a3b54' : '#edf0f5'}`, background: 'transparent', color: 'inherit', padding: '11px 4px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', gap: 9 }}>
                      <span style={{ fontSize: 16 }}>{alert.icon}</span>
                      <span>
                        <strong style={{ display: 'block', fontSize: 13 }}>{alert.title}</strong>
                        <span style={{ display: 'block', marginTop: 3, fontSize: 12, opacity: .75, lineHeight: 1.45 }}>{alert.text}</span>
                        <small style={{ display: 'block', marginTop: 5, opacity: .6 }}>Requires investigator review</small>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel graph-panel">
        <div className="graph-toolbar">
          <label className="graph-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities, locations, phone numbers..." /></label>
          <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} aria-label="Filter entity types">
            <option value="all">All entity types</option>
            {Object.entries(GROUP_STYLES).map(([group, item]) => <option value={group} key={group}>{item.label}</option>)}
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
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div ref={containerRef} className="graph-canvas" />
            {selectedEdge && (
              <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 5, width: 300, maxWidth: 'calc(100% - 28px)', background: isDark ? 'rgba(24,36,58,.96)' : 'rgba(255,255,255,.96)', color: isDark ? '#e7eef9' : '#1b2a40', border: `1px solid ${isDark ? '#30435f' : '#dce3ed'}`, borderRadius: 12, padding: 13, boxShadow: '0 8px 28px rgba(20,35,60,.15)' }}>
                <button type="button" onClick={() => setSelectedEdge(null)} aria-label="Close relationship details" style={{ float: 'right', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
                <strong>{relationshipStyle(selectedEdge.label || selectedEdge.type).icon} {selectedEdge.label || selectedEdge.type || 'Relationship'}</strong>
                <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 7, opacity: .82 }}>
                  <div>Occurrences: <b>{getOccurrenceCount(selectedEdge)}</b></div>
                  {selectedEdge.sourceTypes?.length ? <div>Sources: {selectedEdge.sourceTypes.join(', ')}</div> : null}
                  {selectedEdge.evidenceRefs?.length ? <div>Evidence: {selectedEdge.evidenceRefs.join(', ')}</div> : null}
                  {selectedEdge.timestamp ? <div>Observed: {selectedEdge.timestamp}</div> : null}
                  {selectedEdge.timestamps?.length ? <div>Observed: {selectedEdge.timestamps[0]} → {selectedEdge.timestamps[selectedEdge.timestamps.length - 1]}</div> : null}
                </div>
              </div>
            )}
          </div>

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
                <button type="button" className={`key-entity-item ${selectedEntityId === entity.entityId ? 'selected' : ''}`} key={entity.entityId} onClick={() => focusEntity(entity.entityId)}>
                  <span className="key-entity-rank">#{entity.rank}</span>
                  <span className="key-entity-content">
                    <strong>{GROUP_STYLES[normalize(entity.entityType)]?.icon || '👤'} {entity.name}</strong>
                    <span>{entity.entityType} · Score {entity.keyEntityScore}</span>
                    <span>{entity.metrics.connections} connections · {entity.metrics.relationshipTypes} relationship types · {entity.metrics.entityTypes} entity types · {entity.metrics.evidenceSources} evidence sources</span>
                    <small>Why: {(entity.reasons || []).join('; ')}</small>
                  </span>
                </button>
              ))}
            </div>

            {selectedEntity && (
              <div className="entity-detail-card">
                <span className="eyebrow">Selected entity</span>
                <h3>{GROUP_STYLES[normalize(selectedEntity.entityType)]?.icon || '👤'} {selectedEntity.name}</h3>
                <span className="detail-type">{selectedEntity.entityType} · Rank #{selectedEntity.rank}</span>

                <div className="detail-metrics">
                  <span><strong>{selectedEntity.keyEntityScore}</strong> score</span>
                  <span><strong>{selectedEntity.metrics.connections}</strong> connections</span>
                  <span><strong>{selectedEntity.metrics.evidenceSources}</strong> sources</span>
                  <span><strong>{selectedEntity.metrics.temporalOccurrences}</strong> temporal</span>
                </div>

                <p>Why important</p>
                <ul>{(selectedEntity.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${isDark ? '#2d405b' : '#e5e9ef'}` }}>
                  <strong style={{ display: 'block', marginBottom: 8 }}>SOURCE / PROVENANCE</strong>
                  <div style={{ fontSize: 12, lineHeight: 1.65 }}>
                    <div><b>Police Station:</b> {selectedStations.length ? selectedStations.join(', ') : 'Not recorded'}</div>
                    <div><b>Case:</b> {selectedCases.length ? selectedCases.join(', ') : 'Not recorded'}</div>
                    <div><b>Sources:</b> {selectedSources.length ? selectedSources.join(', ') : 'Not recorded'}</div>
                    <div><b>Evidence:</b> {selectedEvidence.length ? selectedEvidence.join(', ') : 'Not recorded'}</div>
                  </div>
                </div>

                {activityEdges.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${isDark ? '#2d405b' : '#e5e9ef'}` }}>
                    <strong style={{ display: 'block', marginBottom: 8 }}>ACTIVITY / MOVEMENT</strong>
                    <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12 }}>
                      {activityEdges.map((edge) => {
                        const fromNode = graphData.nodes.find((n) => n.id === edge.from);
                        const toNode = graphData.nodes.find((n) => n.id === edge.to);
                        const when = edge.timestamp || edge.eventDate || edge.timestamps?.[0];
                        return (
                          <div key={edge.id} style={{ padding: '6px 0', borderBottom: `1px solid ${isDark ? '#26384f' : '#edf0f4'}` }}>
                            <b>{when || 'Recorded event'}</b>
                            <div>{relationshipStyle(edge.label || edge.type).icon} {fromNode?.label || edge.from} → {toNode?.label || edge.to}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, opacity: .65 }}>
                  ⚠ Analytical output is decision-support and requires human verification.
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="graph-legend legend">
          {Object.entries(GROUP_STYLES).map(([group, item]) => (
            <div className="legend-item" key={group}>
              <span style={{ display: 'inline-flex', width: 22, justifyContent: 'center' }}>{item.icon}</span>
              <span className="legend-dot" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
          <div className="legend-item" style={{ marginLeft: 'auto' }}>
            <span>—</span> single
            <span style={{ marginLeft: 8 }}>━━</span> repeated
            <span style={{ marginLeft: 8 }}>━━━</span> high recurrence
          </div>
        </div>

        {selectedEdge && <div style={{ padding: '8px 14px 12px', fontSize: 11, opacity: .7 }}>Relationship selected. Hover over edges for details; thicker lines indicate higher recorded recurrence.</div>}
        {error && <p className="page-error">{error}</p>}
        {isEmpty && !error && <p className="empty-state">No graph data yet — analyze a report first.</p>}
      </div>
    </div>
  );
}


