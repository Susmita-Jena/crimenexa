const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeWomenSafetySignals } = require('../services/womenSafetyAnalysis');

test('analyzeWomenSafetySignals returns evidence-backed women safety alerts', () => {
  const signals = analyzeWomenSafetySignals({
    entities: {
      people: [{ name: 'Asha Verma' }, { name: 'Ravi Kumar' }],
      locations: [{ name: 'Old Town Warehouse' }, { name: 'MG Road' }],
      phones: [{ number: '9876543210' }]
    },
    relationships: [
      { source: 'Ravi Kumar', target: '9876543210', type: 'communicated_with', description: 'Repeated contact over several days', confidence: 0.9 },
      { source: 'Ravi Kumar', target: '9876543210', type: 'communicated_with', description: 'Follow-up message after previous contact', confidence: 0.8 },
      { source: 'Ravi Kumar', target: 'Old Town Warehouse', type: 'met_at', description: 'Meeting near the same location', confidence: 0.85 },
      { source: 'Ravi Kumar', target: 'Old Town Warehouse', type: 'met_at', description: 'Another meeting at same location', confidence: 0.82 }
    ],
    events: [
      { type: 'communication', source: 'Ravi Kumar', target: '9876543210', timestamp: '2026-03-01T09:00:00.000Z' },
      { type: 'communication', source: 'Ravi Kumar', target: '9876543210', timestamp: '2026-03-02T09:00:00.000Z' },
      { type: 'communication', source: 'Ravi Kumar', target: '9876543210', timestamp: '2026-03-03T09:00:00.000Z' }
    ],
    evidence: [
      { id: 'ev-1', entityName: 'Ravi Kumar', entityType: 'person', detail: 'Repeated contact', confidence: 0.9 },
      { id: 'ev-2', entityName: 'Old Town Warehouse', entityType: 'location', detail: 'Recurring association', confidence: 0.82 },
      { id: 'ev-3', entityName: '9876543210', entityType: 'phone', detail: 'Repeated communication', confidence: 0.88 }
    ],
    caseId: 'case-1'
  });

  assert.ok(Array.isArray(signals));
  assert.ok(signals.some((signal) => signal.type === 'REPEATED_CONTACT'));
  assert.ok(signals.some((signal) => signal.type === 'RECURRING_LOCATION'));
  assert.ok(signals.every((signal) => signal.confidence >= 0 && signal.confidence <= 1));
  assert.ok(signals.every((signal) => Array.isArray(signal.evidenceRefs)));
});
