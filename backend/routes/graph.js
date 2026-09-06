const express = require('express');
const { readDB } = require('../db');
const { analyzeKeyEntities } = require('../services/keyEntityAnalysis');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDB();
  const keyEntities = analyzeKeyEntities(db);
  const keyEntityById = new Map(keyEntities.map((entity) => [entity.entityId, entity]));

  const nodes = [
    ...db.people.map((p) => ({ id: p.id, label: p.name, group: 'person', title: p.notes || p.role || '' })),
    ...db.locations.map((l) => ({ id: l.id, label: l.name, group: 'location', title: l.notes || '' })),
    ...db.organizations.map((o) => ({ id: o.id, label: o.name, group: 'organization', title: o.notes || '' })),
    ...db.vehicles.map((v) => ({ id: v.id, label: v.name, group: 'vehicle', title: v.notes || '' })),
    ...db.phones.map((ph) => ({ id: ph.id, label: ph.name, group: 'phone', title: ph.notes || '' }))
  ].map((node) => {
    const ranking = keyEntityById.get(node.id);
    return ranking ? { ...node, ...ranking, label: `${ranking.rank}. ${node.label}` } : node;
  });

  const edges = db.relationships
    .filter((r) => r.sourceId && r.targetId)
    .map((r) => ({ id: r.id, from: r.sourceId, to: r.targetId, label: r.type, title: r.description }));

  res.json({ nodes, edges, keyEntities });
});

module.exports = router;
