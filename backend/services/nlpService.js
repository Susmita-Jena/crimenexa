const anthropicProvider = require('./providers/anthropicProvider');
const groqProvider = require('./providers/groqProvider');
const llamaProvider = require('./providers/llamaProvider');

const PROVIDERS = {
  anthropic: anthropicProvider,
  groq: groqProvider,
  llama: llamaProvider
};

function uniqueItems(items, picker) {
  const seen = new Set();
  return items.filter((item) => {
    const key = picker(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const NON_NAME_WORDS = new Set([
  'शिकायतकर्ता', 'आरोपी', 'पीड़िता', 'गवाह', 'पुलिस', 'कर्मचारी', 'व्यक्ति', 'लड़का', 'लड़की', 'पुरुष', 'महिला',
  'ने', 'में', 'पर', 'से', 'के', 'की', 'और', 'को', 'है', 'था', 'रहा', 'रही', 'जाती', 'आता', 'लगातार', 'फोन', 'कॉल',
  'गई', 'किया', 'दिया', 'दो', 'तीन', 'चार', 'सामने', 'पास', 'रास्ते', 'मार्केट', 'रोड', 'गली', 'घटना', 'शिकायत',
  'केंद्र', 'सड़क', 'शाम', 'रात', 'बजे', 'जोर', 'उसने', 'उसका', 'यह', 'वह', 'थे', 'हो', 'चला', 'गया', 'जाते', 'करता',
  'बना', 'कई', 'कुछ', 'लगभग', 'बराबर', 'बताया', 'प्राप्त', 'हुए', 'दिखाई', 'सुना', 'पता', 'आने', 'जाने', 'कि', 'अपनी',
  'अगस्त', 'दिन', 'समय', 'माह', 'घंटा', 'मिनट', 'टाइम', 'साफ', 'एक', 'दो', 'तीन', 'चार'
]);

function isLikelyNameCandidate(parts) {
  if (!parts || parts.length < 2 || parts.length > 4) return false;
  const normalized = parts.map((p) => p.trim());
  if (normalized.some((p) => p.length < 2 || /[0-9]/.test(p))) return false;
  if (normalized.some((p) => NON_NAME_WORDS.has(p) || /(शाम|रात|बजे|मार्केट|रोड|गली|सड़क|फोन|कॉल|घटना|आरोपी|शिकायत|कॉलोनी|एरिया|अगस्त|हुए|बताया|प्राप्त|दिखाई|अपनी|कि)/.test(p))) return false;
  return true;
}

function extractHindiPersonNameCandidates(text) {
  const tokens = Array.from(text.matchAll(/[\u0900-\u097F]+/g), (m) => m[0]);
  const candidates = new Set();

  for (let i = 0; i < tokens.length; i += 1) {
    for (let length = 2; length <= 4 && i + length <= tokens.length; length += 1) {
      const segment = tokens.slice(i, i + length).join(' ');
      const parts = segment.split(/\s+/).filter(Boolean);
      if (!isLikelyNameCandidate(parts)) continue;
      const normalized = segment.trim();
      if (/(सफेद|काला|लाल|नीला|सिल्वर|ग्रे|पीला|हरा|बैंगनी|white|black|red|blue|silver|gray|grey|yellow|green|maroon|हैचबैक|कार|गाड़ी|वाहन|स्कूटर|बाइक|ऑटो|hatchback|sedan|suv|car|bike|auto|van|jeep|swift|maruti|wagonr)/i.test(normalized)) continue;
      candidates.add(segment);
    }
  }

  return [...candidates];
}

function fallbackExtractEntities(reportText, sourceType) {
  const text = normalizeValue(reportText || '');
  const locationSuffixPattern = /(Warehouse|Road|Office|Street|Market|Lane|Area|Town|District|Park|Complex|Colony|Sector|Apartment|Square|रोड|मार्केट|गली|कॉलोनी|एरिया|सड़क|चौराहा|मोहल्ला|बाजार)$/i;

  const englishNames = [...new Set(
    Array.from(text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g), (m) => m[1])
  )].filter((name) => !/(Warehouse|Road|Office|Street|Market|Lane|Area|Town|District|Park|Company|Traders|Pvt|Ltd|Swift|Maruti|City|Old|MG|Navi)$/i.test(name));

  const hindiNames = [...new Set(extractHindiPersonNameCandidates(text))].filter((name) => !/^(?:शिकायतकर्ता|आरोपी|गवाह|पुलिस|व्यक्ति)$/i.test(name));
  const filteredHindiNames = hindiNames.filter((name) => !/(सफेद|काला|लाल|नीला|सिल्वर|ग्रे|पीला|हरा|बैंगनी|white|black|red|blue|silver|gray|grey|yellow|green|maroon|हैचबैक|कार|गाड़ी|वाहन|स्कूटर|बाइक|ऑटो|hatchback|sedan|suv|car|bike|auto|van|jeep|swift|maruti|wagonr)/i.test(name));

  const names = [...new Set([...englishNames, ...filteredHindiNames])].filter(Boolean);
  const cleanedNames = names.filter((name) => !/(अपनी|सफेद|काला|लाल|नीला|सिल्वर|ग्रे|पीला|हरा|बैंगनी|हैचबैक|कार|गाड़ी|वाहन|स्कूटर|बाइक|ऑटो|hatchback|sedan|suv|car|bike|auto|van|jeep|swift|maruti|wagonr|अगस्त|शाम|रात|फोन|कॉल|प्राप्त|हुए|बताया|कि)/i.test(name));

  const nameWordSet = new Set(
    cleanedNames.flatMap((name) => name.split(/\s+/).filter(Boolean).map((word) => word.toLowerCase()))
  );

  const nameTokens = new Set(
    names.flatMap((name) => name.split(/\s+/).filter(Boolean).map((part) => part.toLowerCase()))
  );

  const locationMatches = [...new Set(
    text.split(/[.!?।]+/).flatMap((sentence) => {
      const tokens = sentence.split(/\s+/).filter(Boolean).map((token) => token.replace(/[.,;:!?()]/g, ''));
      const suffixIndex = tokens.findLastIndex((token) => locationSuffixPattern.test(token));
      if (suffixIndex < 0) return [];
      const beforeLocation = tokens.slice(0, suffixIndex + 1);
      const prepositionIndex = beforeLocation.findLastIndex((token) => /^(?:at|near|from|on|in|के|से|पर|में|पास|आसपास)$/i.test(token));
      const candidateTokens = beforeLocation.slice(prepositionIndex + 1);
      const filtered = candidateTokens.filter((token) => token && !/^(?:प्राप्त|हुए|हुआ|हुई|बताया|कहा|दिखाई|आता|जाती|अपनी|कि|ने|में|पर|से|के|की|को|फोन|कॉल|शाम|रात|बजे|उसने|उसका|लगातार)$/i.test(token) && !nameWordSet.has(token.toLowerCase()));
      const location = filtered.slice(Math.max(0, filtered.length - 5)).join(' ');
      return location && locationSuffixPattern.test(location) ? [location] : [];
    })
  )];

  const organizationMatches = [
    ...new Set(
      Array.from(
        text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Traders|Group|Company|Corporation|Enterprises|Ltd|LLC|Industries|Private Limited|Pvt Ltd))\b/g),
        (m) => m[1]
      )
    )
  ];

  const phoneMatches = [
    ...new Set(
      Array.from(text.matchAll(/\b(?:\d{4,}x+|\d{8,15})\b/g), (m) => m[0])
    )
  ];

  const vehicleMatches = [
    ...new Set([
      ...Array.from(
        text.matchAll(/\b(?:white|black|red|blue|silver|gray|grey|yellow|green|maroon|सफेद|काला|लाल|नीला|सिल्वर|ग्रे|पीला|हरा|बैंगनी)\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|[\u0900-\u097F]+(?:\s+[\u0900-\u097F]+){0,3}|[A-Za-z\u0900-\u097F]+)\b/gi),
        (m) => m[0]
      ),
      ...Array.from(
        text.matchAll(/(?:सफेद|काला|लाल|नीला|सिल्वर|ग्रे|पीला|हरा|बैंगनी|white|black|red|blue|silver|gray|grey|yellow|green|maroon)\s+(?:hatchback|sedan|suv|car|bike|auto|van|jeep|swift|maruti|wagonr|vehicle|हैचबैक|कार|गाड़ी|वाहन|स्कूटर|बाइक|ऑटो)(?:\s+(?:vehicle|car|गाड़ी|वाहन|कार|बाइक|ऑटो))?/gi),
        (m) => m[0]
      )
    ])
  ].filter((v) => {
    const clean = String(v || '').trim();
    if (!clean) return false;
    return !/^(?:फोन|कॉल|रात|शाम|आरोपी|शिकायतकर्ता|उसने|लगातार|प्राप्त|हुए|बताया|अपनी|कि|नेहा|अगस्त)$/i.test(clean);
  });

  const people = uniqueItems(
    cleanedNames.map((name) => ({ name, role: 'person of interest', notes: `Extracted from ${sourceType || 'report'}` })),
    (item) => item.name.toLowerCase()
  );

  const locations = uniqueItems(
    locationMatches.map((name) => ({ name, notes: `Location mentioned in ${sourceType || 'report'}` })),
    (item) => item.name.toLowerCase()
  );

  const organizations = uniqueItems(
    organizationMatches.map((name) => ({ name, notes: `Organization mentioned in ${sourceType || 'report'}` })),
    (item) => item.name.toLowerCase()
  );

  const vehicles = uniqueItems(
    vehicleMatches.map((description) => ({ description, notes: `Vehicle referenced in ${sourceType || 'report'}` })),
    (item) => item.description.toLowerCase()
  );

  const phones = uniqueItems(
    phoneMatches.map((number) => ({ number, owner: people[0]?.name || 'unknown' })),
    (item) => item.number
  );

  const relationships = [];
  if (people.length > 0 && phones.length > 0) {
    relationships.push({
      source: people[0].name,
      target: phones[0].number,
      type: 'communicated_with',
      description: `${people[0].name} is associated with ${phones[0].number}`
    });
  }

  if (people.length > 1 && locations.length > 0) {
    relationships.push({
      source: people[0].name,
      target: locations[0].name,
      type: /\bmet\b|मुलाकात|मिला|मिली|मिलने/i.test(text) ? 'met_at' : 'observed_near',
      description: /\bmet\b|मुलाकात|मिला|मिली|मिलने/i.test(text)
        ? `${people[0].name} met at ${locations[0].name}`
        : `${people[0].name} was observed near ${locations[0].name}`
    });
  }

  if (people.length > 0 && vehicles.length > 0) {
    relationships.push({
      source: people[0].name,
      target: vehicles[0].description,
      type: 'associated_with',
      description: `${people[0].name} is associated with ${vehicles[0].description}`
    });
  }

  if (people.length > 1 && organizations.length > 0) {
    relationships.push({
      source: people[1].name,
      target: organizations[0].name,
      type: 'linked_to',
      description: `${people[1].name} is linked to ${organizations[0].name}`
    });
  }

  const summary = normalizeValue(
    text.length > 220 ? `${text.slice(0, 220)}...` : text || 'No report text was provided.'
  );

  const riskFlags = [];
  if (/cash|transaction|fund|shell|warehouse|handoff|repeated contact|repeatedly|follow-up|calls|messages|near|saw|observed|suspect|stalk/i.test(text)) {
    riskFlags.push('Repeated contact pattern');
  }
  if (/warehouse|handoff|meeting|met|near|observed|market|road|colony|residence|area/i.test(text)) {
    riskFlags.push('Recurring location association');
  }
  if (/call|message|phone|sms|contact|repeatedly|follow-up/i.test(text)) {
    riskFlags.push('Communication escalation');
  }

  return {
    entities: {
      people,
      locations,
      organizations,
      vehicles,
      phones
    },
    relationships,
    summary,
    riskFlags
  };
}

function completeMissingExtractionFields(extracted, reportText, sourceType) {
  const fallback = fallbackExtractEntities(reportText, sourceType);
  const completed = { ...fallback, ...extracted, entities: { ...fallback.entities, ...(extracted?.entities || {}) } };

  for (const category of ['people', 'locations', 'organizations', 'vehicles', 'phones']) {
    if (!Array.isArray(extracted?.entities?.[category]) || extracted.entities[category].length === 0) {
      completed.entities[category] = fallback.entities[category];
    }
  }

  if (!Array.isArray(extracted?.relationships) || extracted.relationships.length === 0) {
    completed.relationships = fallback.relationships;
  }
  if (!Array.isArray(extracted?.riskFlags) || extracted.riskFlags.length === 0) {
    completed.riskFlags = fallback.riskFlags;
  }
  if (!completed.summary) completed.summary = fallback.summary;

  return completed;
}

function getActiveProvider() {
  const key = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  const provider = PROVIDERS[key];
  if (!provider) {
    throw new Error(
      `Unknown LLM_PROVIDER "${key}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return provider;
}

// Same function signature and same JSON output shape regardless of which
// provider is active — routes/analyze.js never needs to know which one is running.
async function extractEntities(reportText, sourceType) {
  try {
    const provider = getActiveProvider();
    const extracted = await provider.extractEntities(reportText, sourceType);
    return completeMissingExtractionFields(extracted, reportText, sourceType);
  } catch (error) {
    const message = error?.message || '';
    if (/API_KEY|not set|Unknown LLM_PROVIDER|placeholder|your_/i.test(message)) {
      return fallbackExtractEntities(reportText, sourceType);
    }
    throw error;
  }
}

module.exports = { extractEntities, getActiveProvider, fallbackExtractEntities, completeMissingExtractionFields };
