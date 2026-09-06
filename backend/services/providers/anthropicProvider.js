const Anthropic = require('@anthropic-ai/sdk');
const { EXTRACTION_SYSTEM_PROMPT, buildUserMessage, parseExtractionJSON } = require('../extractionPrompt');

let client = null;
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || /^your_/i.test(apiKey)) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env');
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

async function extractEntities(reportText, sourceType) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(reportText, sourceType) }]
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseExtractionJSON(rawText);
}

module.exports = { extractEntities, name: 'anthropic' };
