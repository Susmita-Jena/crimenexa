const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeKeyEntities } = require('../services/keyEntityAnalysis');

test('ranks a diverse, recurring bridge above a single-type neighbor', () => {
  const db = {
    people: [{ id: 'p1', name: 'Person A', mentions: 4 }, { id: 'p2', name: 'Person B', mentions: 1 }],
    locations: [{ id: 'l1', name: 'Location A' }],
    organizations: [{ id: 'o1', name: 'Organization A' }],
    vehicles: [],
    phones: [],
    relationships: [
      { id: 'r1', sourceId: 'p1', targetId: 'p2', type: 'contacts' },
      { id: 'r2', sourceId: 'p1', targetId: 'l1', type: 'met_at' },
      { id: 'r3', sourceId: 'p1', targetId: 'o1', type: 'operates', createdAt: '2026-09-03T00:00:00.000Z' }
    ],
    reports: [
      {
        id: 'report-1',
        sourceType: 'fir',
        createdAt: '2026-09-01T00:00:00.000Z',
        evidence: [{ entityName: 'Person A', provenance: { source: 'fir' } }]
      },
      {
        id: 'report-2',
        sourceType: 'social',
        createdAt: '2026-09-02T00:00:00.000Z',
        evidence: [{ entityName: 'Person A', provenance: { source: 'social' } }]
      }
    ]
  };

  const ranked = analyzeKeyEntities(db);
  assert.equal(ranked[0].name, 'Person A');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].metrics.connections, 3);
  assert.equal(ranked[0].metrics.relationshipTypes, 3);
  assert.equal(ranked[0].metrics.evidenceSources, 2);
  assert.ok(ranked[0].reasons.includes('Connected to multiple entity types'));
  assert.ok(ranked[0].reasons.includes('Appears across multiple evidence sources'));
  assert.deepEqual(analyzeKeyEntities(db), ranked);
});