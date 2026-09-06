import React, { useEffect, useState } from 'react';
import { fetchGraph, fetchPeople } from '../api';

export default function PeopleList() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([fetchPeople(), fetchGraph()])
      .then(([peopleData, graph]) => {
        const rankings = new Map((graph.keyEntities || []).map((entity) => [entity.entityId, entity]));
        setPeople(peopleData.map((person) => ({ ...person, ranking: rankings.get(person.id) })));
      })
      .catch(() => setError('Could not reach the backend. Is it running?'))
      .finally(() => setLoading(false));
  }, []);

  const visiblePeople = people.filter((person) => (
    `${person.name} ${person.role || ''} ${person.notes || ''}`.toLowerCase().includes(query.toLowerCase())
  ));

  return (
    <div className="page">
      <div className="page-header">
        <h1>People</h1>
        <p className="page-subtitle">Review people in the evidence network and their structural importance.</p>
      </div>

      <div className="panel">
        <div className="list-toolbar">
          <input className="input list-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people..." />
        </div>
        {loading && <p className="empty-state">Loading…</p>}
        {error && <p className="page-error">{error}</p>}
        {!loading && !error && people.length === 0 && (
          <p className="empty-state">No people extracted yet. Analyze a report to get started.</p>
        )}

        {people.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Connections</th>
                <th>Mentions</th>
                <th>Key entity</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((p) => (
                <tr key={p.id}>
                  <td className="table-name">{p.name}</td>
                  <td>{p.role || <span className="text-faint">—</span>}</td>
                  <td>
                    <span className="badge badge-accent">{p.ranking?.metrics.connections || p.connectionCount}</span>
                  </td>
                  <td className="mono">{p.mentions}</td>
                  <td>{p.ranking ? <span className="badge badge-source">#{p.ranking.rank} · {p.ranking.keyEntityScore}</span> : <span className="text-faint">—</span>}</td>
                  <td className="table-notes">{p.notes || <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
