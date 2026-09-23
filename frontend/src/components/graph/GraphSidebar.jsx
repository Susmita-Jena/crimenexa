import React, { useEffect, useMemo, useState } from 'react';
import { edgeTimes, formatDay, nameOf, occurrenceOf } from '../../utils/graphAnalytics';
import { FAMILIES, TYPE_STYLES, familyOf, humanize, nodeIcon } from '../../utils/graphVisuals';

const TABS = [
  ['insights', 'Insights'],
  ['cells', 'Cells'],
  ['path', 'Connections'],
  ['entity', 'Entity']
];

function Avatar({ group, size = 30 }) {
  return <img className="gx-avatar" src={nodeIcon(group)} alt="" width={size} height={size} />;
}

function Metric({ value, label }) {
  return (
    <div className="gx-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/* --------------------------------- insights --------------------------------- */

function InsightsPanel({ ctx }) {
  const { analysis, keyEntities, nodeById, selectNode, showIds, whatIf } = ctx;

  return (
    <div className="gx-panel-body">
      <h3 className="gx-heading">What stands out</h3>
      {!analysis.findings.length && <p className="gx-empty">No notable patterns yet. Analyze more reports to build the network.</p>}
      <ul className="gx-list">
        {analysis.findings.map((finding) => (
          <li key={finding.id}>
            <div className={`gx-finding gx-sev-${finding.severity}`}>
              <button
                type="button"
                className="gx-finding-main"
                onClick={() => (finding.nodeIds.length === 1 ? selectNode(finding.nodeIds[0], { focus: true }) : showIds(finding.nodeIds, finding.title))}
              >
                <strong>{finding.title}</strong>
                <span>{finding.text}</span>
              </button>
              {finding.removal && (
                <button type="button" className="gx-link-button" onClick={() => whatIf.start(finding.removal)}>
                  Simulate taking them out
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="gx-heading">Most central entities</h3>
      <ul className="gx-list">
        {keyEntities.slice(0, 5).map((entity) => {
          const node = nodeById.get(entity.entityId);
          return (
            <li key={entity.entityId}>
              <button type="button" className="gx-row" onClick={() => selectNode(entity.entityId, { focus: true })}>
                <span className="gx-rank">{entity.rank}</span>
                <Avatar group={node?.group || entity.entityType} size={28} />
                <span className="gx-row-text">
                  <strong>{entity.name}</strong>
                  <span>{entity.metrics.connections} connections, score {entity.keyEntityScore}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="gx-note">Analytical output is decision support and needs human verification.</p>
    </div>
  );
}

/* ----------------------------------- cells ----------------------------------- */

function CellsPanel({ ctx }) {
  const { analysis, nodeById, activeCellId, chooseCell, selectNode } = ctx;

  if (!analysis.cells.length) {
    return (
      <div className="gx-panel-body">
        <p className="gx-empty">Cells appear once the network has groups of three or more connected entities.</p>
      </div>
    );
  }

  return (
    <div className="gx-panel-body">
      <p className="gx-lead">Cells are groups of entities that are far more connected to each other than to the rest of the network.</p>
      <ul className="gx-list">
        {analysis.cells.map((cell) => {
          const members = cell.members.map((id) => nodeById.get(id)).filter(Boolean);
          const counts = members.reduce((acc, n) => ({ ...acc, [n.group]: (acc[n.group] || 0) + 1 }), {});
          const hub = [...members].sort((a, b) => (a.rank || 99) - (b.rank || 99))[0];
          const brokers = analysis.brokers.filter((b) => b.cells.includes(cell.id));
          return (
            <li key={cell.id}>
              <button
                type="button"
                className={`gx-cell ${activeCellId === cell.id ? 'is-active' : ''}`}
                style={{ '--cell': cell.color }}
                onClick={() => chooseCell(cell)}
              >
                <span className="gx-cell-head">
                  <span className="gx-swatch" />
                  <strong>{cell.name}</strong>
                  <span className="gx-cell-count">{members.length} entities</span>
                </span>
                <span className="gx-chips">
                  {Object.entries(counts).map(([group, count]) => (
                    <span className="gx-chip" key={group}>
                      {count} {(TYPE_STYLES[group]?.label || group).toLowerCase()}
                    </span>
                  ))}
                </span>
                {hub && <span className="gx-cell-line">Most central: {nameOf(hub)}</span>}
                {brokers.length > 0 && <span className="gx-cell-line">Links out via {brokers.map((b) => nameOf(nodeById.get(b.id))).join(', ')}</span>}
              </button>
              {activeCellId === cell.id && (
                <ul className="gx-members">
                  {members.map((m) => (
                    <li key={m.id}>
                      <button type="button" className="gx-member" onClick={() => selectNode(m.id, { focus: true })}>
                        <Avatar group={m.group} size={20} />
                        {nameOf(m)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------- path finder -------------------------------- */

function PathPicker({ label, id, value, nodes, onChange, onUseSelected, canUseSelected }) {
  const [text, setText] = useState('');
  const options = useMemo(() => nodes.map((n) => ({ id: n.id, name: nameOf(n) })), [nodes]);

  useEffect(() => {
    if (!value) return;
    const match = options.find((o) => o.id === value);
    if (match) setText((prev) => (prev.trim().toLowerCase() === match.name.toLowerCase() ? prev : match.name));
  }, [value, options]);

  const handle = (event) => {
    const next = event.target.value;
    setText(next);
    const match = options.find((o) => o.name.toLowerCase() === next.trim().toLowerCase());
    onChange(match ? match.id : '');
  };

  return (
    <label className="gx-field">
      <span>{label}</span>
      <div className="gx-field-row">
        <input list={`gx-list-${id}`} value={text} onChange={handle} placeholder="Type a name" />
        <button type="button" className="gx-link-button" onClick={onUseSelected} disabled={!canUseSelected}>
          Use selected
        </button>
      </div>
      <datalist id={`gx-list-${id}`}>
        {options.map((o) => <option key={o.id} value={o.name} />)}
      </datalist>
    </label>
  );
}

function PathPanel({ ctx }) {
  const { nodes, nodeById, path, selectedId } = ctx;
  const result = path.result;

  return (
    <div className="gx-panel-body">
      <p className="gx-lead">Find the shortest chain of recorded links between two entities. Repeated, well-evidenced links are preferred when routes are the same length.</p>
      <PathPicker label="From" id="from" value={path.from} nodes={nodes} onChange={path.setFrom} onUseSelected={() => path.setFrom(selectedId)} canUseSelected={!!selectedId} />
      <PathPicker label="To" id="to" value={path.to} nodes={nodes} onChange={path.setTo} onUseSelected={() => path.setTo(selectedId)} canUseSelected={!!selectedId} />
      <div className="gx-actions">
        <button type="button" className="gx-button is-primary" onClick={path.run} disabled={!path.from || !path.to || path.from === path.to}>
          Find connection
        </button>
        {result !== undefined && (
          <button type="button" className="gx-button" onClick={path.clear}>
            Clear
          </button>
        )}
      </div>

      {result === null && <p className="gx-empty">No connection found in the current data. These entities may belong to separate networks.</p>}

      {result && (
        <div className="gx-chain" aria-live="polite">
          <p className="gx-chain-summary">
            {result.hops.length === 0 ? 'Same entity.' : `${result.hops.length} ${result.hops.length === 1 ? 'link' : 'links'} apart, through ${result.nodeIds.length - 2} ${result.nodeIds.length - 2 === 1 ? 'entity' : 'entities'}.`}
          </p>
          <ol>
            {result.nodeIds.map((id, i) => {
              const node = nodeById.get(id);
              const hop = result.hops[i];
              const family = hop ? FAMILIES[familyOf(hop.edge.label)] : null;
              return (
                <li key={id}>
                  <button type="button" className="gx-row" onClick={() => ctx.selectNode(id, { focus: true })}>
                    <Avatar group={node?.group} size={26} />
                    <span className="gx-row-text"><strong>{nameOf(node)}</strong></span>
                  </button>
                  {hop && (
                    <div className="gx-hop" style={{ '--line': family.color }}>
                      <span>{humanize(hop.edge.label)}{occurrenceOf(hop.edge) > 1 ? `, ${occurrenceOf(hop.edge)} records` : ''}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- entity ---------------------------------- */

function EntityPanel({ ctx }) {
  const { selectedId, nodeById, edges, analysis, selectNode, hops, setHops, path, whatIf } = ctx;
  const node = selectedId ? nodeById.get(selectedId) : null;

  const links = useMemo(() => {
    if (!node) return [];
    return edges
      .filter((e) => e.from === node.id || e.to === node.id)
      .map((edge) => ({ edge, other: nodeById.get(edge.from === node.id ? edge.to : edge.from), outgoing: edge.from === node.id }))
      .filter((l) => l.other);
  }, [edges, node, nodeById]);

  const grouped = useMemo(() => {
    const groups = {};
    links.forEach((link) => {
      const key = familyOf(link.edge.label);
      (groups[key] = groups[key] || []).push(link);
    });
    Object.values(groups).forEach((list) => list.sort((a, b) => occurrenceOf(b.edge) - occurrenceOf(a.edge)));
    return Object.entries(groups);
  }, [links]);

  const activity = useMemo(() => {
    const rows = [];
    links.forEach((link) => {
      edgeTimes(link.edge).forEach((t) => rows.push({ t, link }));
    });
    return rows.sort((a, b) => a.t - b.t);
  }, [links]);

  if (!node) {
    return (
      <div className="gx-panel-body">
        <p className="gx-empty">Select an entity on the graph to see its dossier.</p>
      </div>
    );
  }

  const cellId = analysis.cellOf.get(node.id);
  const cell = analysis.cells.find((c) => c.id === cellId);
  const isBroker = analysis.brokerIds.has(node.id);
  const provenance = {
    stations: node.policeStations || [],
    cases: node.caseIds || [],
    sources: node.sourceTypes || [],
    evidence: node.evidenceRefs || []
  };

  return (
    <div className="gx-panel-body">
      <div className="gx-dossier-head">
        <Avatar group={node.group} size={44} />
        <div>
          <h3>{nameOf(node)}</h3>
          <span className="gx-sub">{TYPE_STYLES[node.group]?.label || node.group}{node.title ? `. ${node.title}` : ''}</span>
        </div>
      </div>

      <div className="gx-chips">
        {node.rank && <span className="gx-chip is-strong">Rank {node.rank} of {nodeById.size}</span>}
        {cell && <span className="gx-chip" style={{ '--cell': cell.color }}><i className="gx-swatch" /> {cell.name}</span>}
        {isBroker && <span className="gx-chip is-accent">Broker between cells</span>}
      </div>

      <div className="gx-metrics">
        <Metric value={node.keyEntityScore ?? '-'} label="score" />
        <Metric value={node.metrics?.connections ?? links.length} label="connections" />
        <Metric value={node.metrics?.evidenceSources ?? '-'} label="sources" />
        <Metric value={node.metrics?.temporalOccurrences ?? '-'} label="active days" />
      </div>

      <div className="gx-actions">
        <button type="button" className="gx-button" onClick={() => { path.setFrom(node.id); ctx.setTab('path'); }}>Path from here</button>
        <button type="button" className="gx-button" onClick={() => { path.setTo(node.id); ctx.setTab('path'); }}>Path to here</button>
        <button type="button" className="gx-button is-danger" onClick={() => whatIf.start(node.id)}>Simulate taking out</button>
      </div>

      <div className="gx-segment" role="group" aria-label="How much of the network to show around this entity">
        {[['all', 'Whole network'], [1, '1 step out'], [2, '2 steps out']].map(([value, label]) => (
          <button key={label} type="button" className={hops === value ? 'is-on' : ''} aria-pressed={hops === value} onClick={() => setHops(value)}>
            {label}
          </button>
        ))}
      </div>

      {node.reasons?.length > 0 && (
        <>
          <h4 className="gx-heading">Why it ranks here</h4>
          <ul className="gx-bullets">{node.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </>
      )}

      <h4 className="gx-heading">Connections ({links.length})</h4>
      {grouped.map(([familyKey, list]) => (
        <div className="gx-group" key={familyKey}>
          <div className="gx-group-title" style={{ '--line': FAMILIES[familyKey].color }}>
            <i /> {FAMILIES[familyKey].label}
          </div>
          <ul className="gx-list">
            {list.map(({ edge, other, outgoing }) => (
              <li key={edge.id}>
                <button type="button" className="gx-row is-compact" onClick={() => selectNode(other.id, { focus: true })}>
                  <Avatar group={other.group} size={22} />
                  <span className="gx-row-text">
                    <strong>{nameOf(other)}</strong>
                    <span>{humanize(edge.label)}{outgoing ? '' : ' (incoming)'}{occurrenceOf(edge) > 1 ? `, ${occurrenceOf(edge)} records` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {activity.length > 0 && (
        <>
          <h4 className="gx-heading">Recorded activity</h4>
          <ol className="gx-activity">
            {activity.map(({ t, link }, i) => (
              <li key={`${link.edge.id}-${t}-${i}`}>
                <time>{formatDay(t)}</time>
                <span>{humanize(link.edge.label)} {link.outgoing ? 'to' : 'from'} {nameOf(link.other)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <h4 className="gx-heading">Where this comes from</h4>
      <dl className="gx-provenance">
        <dt>Police station</dt><dd>{provenance.stations.length ? provenance.stations.join(', ') : 'Not recorded'}</dd>
        <dt>Case</dt><dd>{provenance.cases.length ? provenance.cases.join(', ') : 'Not recorded'}</dd>
        <dt>Source types</dt><dd>{provenance.sources.length ? provenance.sources.join(', ') : 'Not recorded'}</dd>
        <dt>Reports</dt><dd>{provenance.evidence.length ? provenance.evidence.join(', ') : 'Not recorded'}</dd>
      </dl>
    </div>
  );
}

/* ----------------------------------- shell ----------------------------------- */

export default function GraphSidebar({ ctx }) {
  return (
    <aside className="gx-side" aria-label="Investigation tools">
      <div className="gx-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={ctx.tab === key}
            className={ctx.tab === key ? 'is-on' : ''}
            onClick={() => ctx.setTab(key)}
          >
            {label}
            {key === 'entity' && ctx.selectedId ? <i className="gx-dot" /> : null}
          </button>
        ))}
      </div>
      <div className="gx-scroll" role="tabpanel">
        {ctx.tab === 'insights' && <InsightsPanel ctx={ctx} />}
        {ctx.tab === 'cells' && <CellsPanel ctx={ctx} />}
        {ctx.tab === 'path' && <PathPanel ctx={ctx} />}
        {ctx.tab === 'entity' && <EntityPanel ctx={ctx} />}
      </div>
    </aside>
  );
}
