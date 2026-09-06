const express = require('express');
const { readDB } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDB();
  const people = db.people
    .map((p) => ({
      ...p,
      connectionCount: db.relationships.filter((r) => r.sourceId === p.id || r.targetId === p.id).length
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount);
  res.json(people);
});

module.exports = router;
