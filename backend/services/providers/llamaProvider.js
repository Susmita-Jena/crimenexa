const OpenAI = require('openai');
const { EXTRACTION_SYSTEM_PROMPT, buildUserMessage, parseExtractionJSON } = require('../extractionPrompt');

let client = null;

function getClient() {
  const apiKey = process.env.LLAMA_API_KEY?.trim();
  const baseURL = process.env.LLAMA_BASE_URL?.trim();

  if (!apiKey || /^your_/i.test(apiKey)) {
    throw new Error('LLAMA_API_KEY is not set. Add it to backend/.env');
  }

  if (!baseURL) {
    throw new Error('LLAMA_BASE_URL is not set. Add it to backend/.env');
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL
    });
  }

  return client;
}

async function extractEntities(reportText, sourceType) {
  const llm = getClient();

  const completion = await llm.chat.completions.create({
    model: process.env.LLAMA_MODEL || 'llama-3.1-70b-instruct',
    temperature: 0.2,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(reportText, sourceType) }
    ]
  });

  const rawText = completion.choices?.[0]?.message?.content || '';
  return parseExtractionJSON(rawText);
}

module.exports = { extractEntities, name: 'llama' };
