const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInvestigationContext, generateLeadCandidates } = require('../services/investigationModel');

test('buildInvestigationContext attaches evidence, provenance, confidence, and lead candidates', () => {
  const data = buildInvestigationContext({
    text: 'Ravi Kumar met Sanjay Mehta at Old Town Warehouse. Sanjay is linked to Shakti Traders and the white Maruti Swift was seen there.',
    sourceType: 'fir',
    entities: {
      people: [{ name: 'Ravi Kumar', role: 'Logistics Coordinator' }, { name: 'Sanjay Mehta', role: 'Suspect' }],
      locations: [{ name: 'Old Town Warehouse' }],
      organizations: [{ name: 'Shakti Traders' }],
      vehicles: [{ description: 'white Maruti Swift' }],
      phones: [{ number: '98765xxxxx', owner: 'Ravi Kumar' }]
    },
    relationships: [
      { source: 'Ravi Kumar', target: 'Old Town Warehouse', type: 'met_at', description: 'Met at warehouse' },
      { source: 'Sanjay Mehta', target: 'Shakti Traders', type: 'linked_to', description: 'Linked to shell company' },
      { source: 'Sanjay Mehta', target: 'white Maruti Swift', type: 'owns_vehicle', description: 'Vehicle seen at location' }
    ],
    riskFlags: ['Shell entity linkage', 'Warehouse handoff']
  });

  assert.ok(Array.isArray(data.evidence));
  assert.ok(data.evidence.length >= 2);
  assert.ok(data.confidence >= 0.5 && data.confidence <= 1);
  assert.ok(Array.isArray(data.events));
  assert.ok(Array.isArray(data.leads));
  assert.ok(data.leads.some((lead) => lead.title.includes('Sanjay') || lead.title.includes('Shakti')));
});

test('generateLeadCandidates creates deterministic leads from suspicious entities', () => {
  const leads = generateLeadCandidates({
    people: [{ name: 'Sanjay Mehta' }, { name: 'Ravi Kumar' }],
    organizations: [{ name: 'Shakti Traders' }],
    locations: [{ name: 'Old Town Warehouse' }],
    riskFlags: ['Shell entity linkage', 'Warehouse handoff']
  });

  assert.ok(leads.length >= 1);
  assert.ok(leads[0].riskScore >= 0.5);
  assert.ok(leads[0].reasons.length >= 1);
});
