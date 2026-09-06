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
  leads: []
};

const DEMO_DB = {
  people: [
    { id: 'p1', name: 'Ravi Kumar', role: 'Logistics Coordinator', notes: 'Known courier route handler', mentions: 3 },
    { id: 'p2', name: 'Sanjay Mehta', role: 'Shell company operator', notes: 'Linked to suspicious invoice routing', mentions: 4 },
    { id: 'p3', name: 'Asha Verma', role: 'Informant', notes: 'Witness in warehouse handover', mentions: 2 },
    { id: 'p4', name: 'Nitin Shah', role: 'Financial broker', notes: 'Movement of funds across shell entities', mentions: 3 }
  ],
  locations: [
    { id: 'l1', name: 'Old Town Warehouse', notes: 'Primary handoff point', mentions: 2 },
    { id: 'l2', name: 'MG Road', notes: 'Meeting point noted in FIR', mentions: 1 },
    { id: 'l3', name: 'Navi Mumbai Office', notes: 'Operations office for shell network', mentions: 1 }
  ],
  organizations: [
    { id: 'o1', name: 'Shakti Traders', notes: 'Shell company under investigation', mentions: 2 },
    { id: 'o2', name: 'City Courier Pvt Ltd', notes: 'Transit and logistics partner', mentions: 1 }
  ],
  vehicles: [
    { id: 'v1', name: 'White Maruti Swift', notes: 'OD-05-XXXX, seen at warehouse', mentions: 2 }
  ],
  phones: [
    { id: 'ph1', name: '98765xxxxx', notes: 'Phone linked to Ravi Kumar', mentions: 2 }
  ],
  relationships: [
    { id: 'r1', sourceId: 'p1', targetId: 'l1', sourceName: 'Ravi Kumar', targetName: 'Old Town Warehouse', type: 'met_at', description: 'Ravi met associates at the warehouse', caseId: null },
    { id: 'r2', sourceId: 'p1', targetId: 'p2', sourceName: 'Ravi Kumar', targetName: 'Sanjay Mehta', type: 'contacts', description: 'Repeated coordination over the last two weeks', caseId: null },
    { id: 'r3', sourceId: 'p2', targetId: 'o1', sourceName: 'Sanjay Mehta', targetName: 'Shakti Traders', type: 'operates', description: 'Shell company linked to cash movement', caseId: null },
    { id: 'r4', sourceId: 'p2', targetId: 'v1', sourceName: 'Sanjay Mehta', targetName: 'White Maruti Swift', type: 'owns_vehicle', description: 'Vehicle seen at the warehouse', caseId: null },
    { id: 'r5', sourceId: 'p3', targetId: 'p1', sourceName: 'Asha Verma', targetName: 'Ravi Kumar', type: 'informs_about', description: 'Witness reports suspicious handoff', caseId: null },
    { id: 'r6', sourceId: 'p4', targetId: 'o1', sourceName: 'Nitin Shah', targetName: 'Shakti Traders', type: 'funds', description: 'Financial broker tied to shell funding', caseId: null }
  ],
  cases: [
    {
      id: 'c1',
      title: 'Warehouse logistics shell network',
      description: 'Suspicious movement of funds and goods through warehouse and shell company network.',
      reports: ['rep1'],
      createdAt: '2026-09-01T00:00:00.000Z'
    }
  ],
  reports: [
    {
      id: 'rep1',
      sourceType: 'fir',
      text: 'On 14 March, informant reports that Ravi Kumar met Sanjay Mehta at the Old Town warehouse on MG Road. Ravi\'s phone (98765xxxxx) has been in repeated contact with Sanjay over the past two weeks. A white Maruti Swift registered to Sanjay was seen at the same location. Sanjay is believed to be linked to Shakti Traders, a shell company under investigation for suspicious transactions.',
      summary: 'Warehouse logistics network involving shell-company transactions and repeated contact between suspects.',
      riskFlags: ['Cash movement', 'Shell entity linkage', 'Warehouse handoff'],
      evidence: [
        { entityType: 'person', entityName: 'Ravi Kumar', confidence: 0.9, provenance: { source: 'fir', extractedFrom: 'textual_report' } },
        { entityType: 'person', entityName: 'Sanjay Mehta', confidence: 0.9, provenance: { source: 'fir', extractedFrom: 'textual_report' } },
        { entityType: 'location', entityName: 'Old Town Warehouse', confidence: 0.9, provenance: { source: 'fir', extractedFrom: 'textual_report' } }
      ],
      confidence: 0.86,
      events: [
        { type: 'met_at', source: 'Ravi Kumar', target: 'Old Town Warehouse', description: 'Ravi met associates at the warehouse', confidence: 0.88 }
      ],
      leads: [
        { title: 'Review Sanjay Mehta', riskScore: 0.9, reasons: ['Shell entity linkage', 'Warehouse handoff'] }
      ],
      caseId: 'c1',
      createdAt: '2026-09-01T00:00:00.000Z'
    }
  ],
  evidence: [],
  leads: []
};

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEMO_DB, null, 2));
  }
}

function seedDatabase() {
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

module.exports = { readDB, writeDB };
