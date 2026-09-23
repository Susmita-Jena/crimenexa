const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = {
  people: [],
  locations: [],
  organizations: [],
  vehicles: [],
  phones: [],
  relationships: [],
  cases: [],
  reports: [],
  evidence: [],
  leads: [],
  custodyLedger: []
};

const DEMO_DB = require('./seed/demoDataset');

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEMO_DB, null, 2));
  }
}

function seedDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(DEMO_DB, null, 2));
  return { ...EMPTY_DB, ...DEMO_DB };
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    const isEmpty =
      !parsed ||
      Object.values(parsed).every((value) => Array.isArray(value) ? value.length === 0 : !value);

    if (isEmpty) {
      return seedDatabase();
    }

    return { ...EMPTY_DB, ...parsed };
  } catch (err) {
    return seedDatabase();
  }
}

function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function resetDemoData() {
  return seedDatabase();
}

module.exports = { readDB, writeDB, resetDemoData };
