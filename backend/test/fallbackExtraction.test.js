const test = require('node:test');
const assert = require('node:assert/strict');

const { extractEntities } = require('../services/nlpService');

test('falls back to a local extraction parser when no LLM credentials are configured', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
  process.env.LLM_PROVIDER = 'anthropic';

  const result = await extractEntities(
    'Ravi Kumar met Sanjay Mehta at Old Town Warehouse. Sanjay is linked to Shakti Traders and called 98765xxxxx.',
    'fir'
  );

  assert.ok(result.entities.people.some((person) => person.name === 'Ravi Kumar'));
  assert.ok(result.entities.people.some((person) => person.name === 'Sanjay Mehta'));
  assert.ok(result.entities.locations.some((location) => location.name === 'Old Town Warehouse'));
  assert.ok(result.entities.organizations.some((org) => org.name === 'Shakti Traders'));
  assert.ok(result.relationships.some((rel) => rel.type === 'met_at'));
  assert.ok(Array.isArray(result.riskFlags));
});
