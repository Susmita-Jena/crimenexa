const express = require('express');
const { readDB } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDB();
  const reports = [...db.reports].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(reports);
});

module.exports = router;
