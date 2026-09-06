const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.cases);
});

router.post('/', (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Case title is required.' });
  }
  const db = readDB();
  const newCase = {
    id: uuidv4(),
    title,
    description: description || '',
    reports: [],
    createdAt: new Date().toISOString()
  };
  db.cases.push(newCase);
  writeDB(db);
  res.json(newCase);
});

module.exports = router;
