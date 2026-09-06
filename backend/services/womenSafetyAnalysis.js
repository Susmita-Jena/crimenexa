function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeEntity(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function entityNamesFromText(text) {
  const matches = [...new Set((text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || []).concat(
    (text.match(/[A-Za-z][A-Za-z\s]+(?:\b(?:Kumar|Sharma|Verma|Singh|Patel|Mehta|Reddy|Iyer|Nair|Ali|Ahmed|Khan|Sethi)\b)/g) || [])
  ))];
  return matches.map((item) => normalizeEntity(item)).filter(Boolean).slice(0, 6);
}

function buildSignal({
  type,
  title,
  description,
  confidence,
  evidenceRefs = [],
  relatedEntities = [],
  timestamps = [],
  severity = 'medium',
  requiresHumanReview = true,
  source = 'women_safety_analysis'
}) {
  return {
    type,
    title,
    description,
    confidence: clamp(Number(confidence || 0.5), 0, 1),
    severity,
    evidenceRefs: uniq(evidenceRefs),
    relatedEntities: uniq(relatedEntities.map((item) => normalizeEntity(item))).filter(Boolean),
    timestamps: uniq(timestamps.filter(Boolean)),
    requiresHumanReview,
    provenance: {
      source,
      generatedAt: new Date().toISOString()
    }
  };
}

function analyzeWomenSafetySignals({ text = '', entities = {}, relationships = [], events = [], evidence = [], caseId }) {
  const signals = [];
  const evidenceRefs = Array.isArray(evidence) ? evidence : [];
  const textLower = normalizeEntity(text || '').toLowerCase();

  if (!textLower && (!relationships || relationships.length === 0) && evidenceRefs.length === 0) {
    return [];
  }

  const textSignalRules = [
    {
      type: 'REPEATED_CONTACT',
      title: 'Repeated contact pattern',
      description: 'Potential repeated-contact pattern detected in the complaint text and related records.',
      keywords: ['repeated', 'repeatedly', 'contact', 'phone', 'call', 'message', 'sms', 'chat', 'followed', 'persist'],
      confidence: 0.72,
      relatedEntities: entityNamesFromText(textLower)
    },
    {
      type: 'COMMUNICATION_ESCALATION',
      title: 'Communication escalation pattern',
      description: 'Communication escalation pattern detected based on repeated contact and follow-up behavior.',
      keywords: ['follow-up', 'follow up', 'warning', 'threat', 'pressure', 'concern', 'escalat', 'harass', 'stalk', 'monitor'],
      confidence: 0.76,
      relatedEntities: entityNamesFromText(textLower)
    },
    {
      type: 'RECURRING_LOCATION',
      title: 'Recurring location association',
      description: 'Recurring location association detected in the evidence trail and complaint context.',
      keywords: ['same location', 'same place', 'near', 'repeated location', 'visited', 'met at', 'at the same place', 'warehouse', 'street', 'road', 'office', 'home', 'school'],
      confidence: 0.69,
      relatedEntities: entityNamesFromText(textLower)
    },
    {
      type: 'CROSS_SOURCE_RECURRENCE',
      title: 'Cross-source recurrence requires review',
      description: 'The same entity is appearing across multiple evidence streams and requires investigator review.',
      keywords: ['multiple reports', 'across sources', 'same number', 'same person', 'same location', 'evidence', 'report', 'records'],
      confidence: 0.7,
      relatedEntities: entityNamesFromText(textLower)
    },
    {
      type: 'TEMPORAL_PATTERN',
      title: 'Time-pattern correlation',
      description: 'Recurring interaction timing suggests a repeat pattern in the communication sequence.',
      keywords: ['same time', 'around the same time', 'repeatedly', 'daily', 'week', 'evening', 'night', 'morning'],
      confidence: 0.68,
      relatedEntities: entityNamesFromText(textLower)
    }
  ];

  for (const rule of textSignalRules) {
    const matched = rule.keywords.some((keyword) => textLower.includes(keyword));
    if (matched) {
      signals.push(buildSignal({
        type: rule.type,
        title: rule.title,
        description: rule.description,
        confidence: rule.confidence,
        evidenceRefs: evidenceRefs.map((item) => item.id || `${item.entityType || 'entity'}:${item.entityName || item.name || 'unknown'}`),
        relatedEntities: rule.relatedEntities.length > 0 ? rule.relatedEntities : [textLower.slice(0, 40)],
        severity: rule.type === 'COMMUNICATION_ESCALATION' ? 'high' : 'medium',
        requiresHumanReview: true,
        source: caseId ? `case:${caseId}` : 'women_safety_analysis'
      }));
    }
  }

  const entityNames = uniq([
    ...(entities.people || []).map((p) => p.name),
    ...(entities.locations || []).map((l) => l.name),
    ...(entities.organizations || []).map((o) => o.name),
    ...(entities.vehicles || []).map((v) => v.description || v.name),
    ...(entities.phones || []).map((p) => p.number || p.name)
  ]);

  const contactCounter = new Map();
  const locationCounter = new Map();
  const entityCounter = new Map();
  const escalationTerms = /(threat|warning|pressure|follow[- ]?up|escalat|harass|stalk|observe|monitor|contacted|message|call|repeated|persist|concern)/i;

  for (const item of evidenceRefs) {
    const name = normalizeEntity(item.entityName || item.name || item.number || '');
    if (!name) continue;
    entityCounter.set(name, (entityCounter.get(name) || 0) + 1);
  }

  for (const rel of relationships || []) {
    const source = normalizeEntity(rel.source || '');
    const target = normalizeEntity(rel.target || '');
    if (source) entityCounter.set(source, (entityCounter.get(source) || 0) + 1);
    if (target) entityCounter.set(target, (entityCounter.get(target) || 0) + 1);

    const typeText = `${rel.type || ''} ${rel.description || ''}`.toLowerCase();
    const key = `${source}::${target}`;
    if (/(contact|message|call|text|sms|chat|communicat)/i.test(typeText)) {
      contactCounter.set(key, (contactCounter.get(key) || 0) + 1);
    }

    if (/(met_at|at|near|location|visited|inside|nearby)/i.test(typeText)) {
      const locKey = normalizeEntity(rel.target || '');
      if (locKey && /(warehouse|road|street|market|station|office|apartment|residence|hostel|park|school|college|bus|area|lane|building)/i.test(locKey)) {
        locationCounter.set(locKey, (locationCounter.get(locKey) || 0) + 1);
      }
    }
  }

  const repeatedContacts = [...contactCounter.entries()].filter(([, count]) => count >= 2);
  if (repeatedContacts.length > 0) {
    const contactSignal = repeatedContacts[0];
    const [source, target] = contactSignal[0].split('::');
    const related = [source, target].filter(Boolean);
    const evidenceRefsForContact = evidenceRefs
      .filter((item) => related.includes(item.entityName || item.name || item.number || ''))
      .map((item) => item.id || `${item.entityType || 'entity'}:${item.entityName || item.name || item.number || 'unknown'}`);

    signals.push(buildSignal({
      type: 'REPEATED_CONTACT',
      title: 'Repeated contact pattern',
      description: `Potential repeated-contact pattern detected between ${source || 'the involved entities'} and ${target || 'related contact points'}.`,
      confidence: clamp(0.68 + (contactSignal[1] - 2) * 0.08, 0.68, 0.94),
      evidenceRefs: evidenceRefsForContact,
      relatedEntities: related,
      severity: 'medium',
      requiresHumanReview: true,
      source: caseId ? `case:${caseId}` : 'women_safety_analysis'
    }));
  }

  const escalationCandidates = (relationships || []).filter((rel) => {
    const text = `${rel.type || ''} ${rel.description || ''}`.toLowerCase();
    return /(follow[- ]?up|escalat|pressure|warning|threat|harass|stalk|concern|observe|monitor)/i.test(text);
  });
  if (repeatedContacts.length > 0 || escalationCandidates.length > 0) {
    const contactScale = repeatedContacts.length + escalationCandidates.length;
    if (contactScale >= 2) {
      const related = uniq([
        ...(relationships || []).map((rel) => [rel.source, rel.target]).flat(),
        ...(evidenceRefs || []).map((item) => item.entityName || item.name || item.number || '')
      ]).filter(Boolean).slice(0, 8);

      signals.push(buildSignal({
        type: 'COMMUNICATION_ESCALATION',
        title: 'Communication escalation pattern',
        description: 'Repeated contact combined with follow-up or concerning communication indicates a possible escalation pattern requiring investigator review.',
        confidence: clamp(0.7 + (contactScale - 2) * 0.06, 0.7, 0.96),
        evidenceRefs: (evidenceRefs || []).map((item) => item.id || `${item.entityType || 'entity'}:${item.entityName || item.name || item.number || 'unknown'}`),
        relatedEntities: related,
        severity: 'high',
        requiresHumanReview: true,
        source: caseId ? `case:${caseId}` : 'women_safety_analysis'
      }));
    }
  }

  const recurringLocations = [...locationCounter.entries()].filter(([, count]) => count >= 2);
  if (recurringLocations.length > 0) {
    const [location, count] = recurringLocations[0];
    const locRefs = evidenceRefs
      .filter((item) => (item.entityName || item.name || '').toLowerCase() === location.toLowerCase())
      .map((item) => item.id || `${item.entityType || 'entity'}:${item.entityName || item.name || 'unknown'}`);

    signals.push(buildSignal({
      type: 'RECURRING_LOCATION',
      title: 'Recurring location association',
      description: `The same location, ${location}, appears repeatedly across connected evidence and relationship records.`,
      confidence: clamp(0.66 + (count - 1) * 0.08, 0.66, 0.92),
      evidenceRefs: locRefs.length > 0 ? locRefs : [],
      relatedEntities: [location],
      severity: 'medium',
      requiresHumanReview: true,
      source: caseId ? `case:${caseId}` : 'women_safety_analysis'
    }));
  }

  const crossSourceCandidates = new Map();
  const evidenceByEntity = new Map();
  for (const item of evidenceRefs) {
    const key = normalizeEntity(item.entityName || item.name || item.number || '');
    if (!key) continue;
    const list = evidenceByEntity.get(key) || [];
    list.push(item);
    evidenceByEntity.set(key, list);
  }
  for (const [, items] of evidenceByEntity) {
    if (items.length > 1) {
      const sourceSet = new Set(items.map((item) => normalizeEntity(item.provenance?.source || item.sourceType || 'report')));
      if (sourceSet.size > 1 || items.length >= 2) {
        crossSourceCandidates.set(items[0].entityName || items[0].name || items[0].number || 'entity', items.length);
      }
    }
  }
  if (crossSourceCandidates.size > 0) {
    const [entity, hits] = [...crossSourceCandidates.entries()][0];
    signals.push(buildSignal({
      type: 'CROSS_SOURCE_RECURRENCE',
      title: 'Cross-source recurrence requires review',
      description: `The same entity, ${entity}, appears across multiple evidence records and should be reviewed across sources.`,
      confidence: clamp(0.62 + (hits - 1) * 0.08, 0.62, 0.9),
      evidenceRefs: (evidenceByEntity.get(entity) || []).map((item) => item.id || `${item.entityType || 'entity'}:${item.entityName || item.name || item.number || 'unknown'}`),
      relatedEntities: [entity],
      severity: 'medium',
      requiresHumanReview: true,
      source: caseId ? `case:${caseId}` : 'women_safety_analysis'
    }));
  }

  const timestamps = (events || [])
    .map((event) => parseDate(event.timestamp))
    .filter(Boolean)
    .map((date) => date.toISOString());
  if (timestamps.length >= 2) {
    const timeOfDay = new Map();
    for (const iso of timestamps) {
      const date = parseDate(iso);
      if (!date) continue;
      const key = `${date.getUTCHours()}:${date.getUTCDay()}`;
      timeOfDay.set(key, (timeOfDay.get(key) || 0) + 1);
    }
    const repeatedTimeWindow = [...timeOfDay.entries()].find(([, count]) => count >= 2);
    if (repeatedTimeWindow) {
      const [slot, count] = repeatedTimeWindow;
      signals.push(buildSignal({
        type: 'TEMPORAL_PATTERN',
        title: 'Time-pattern correlation',
        description: `Repeated interactions cluster around a consistent time window (${slot}), which may reflect recurring contact timing.`,
        confidence: clamp(0.6 + (count - 1) * 0.1, 0.6, 0.88),
        evidenceRefs: (events || []).slice(0, 5).map((event, index) => event.id || `event:${index + 1}`),
        relatedEntities: uniq([...(events || []).map((event) => event.source), ...(events || []).map((event) => event.target)]),
        timestamps: timestamps.slice(0, 5),
        severity: 'low',
        requiresHumanReview: true,
        source: caseId ? `case:${caseId}` : 'women_safety_analysis'
      }));
    }
  }

  const concentration = [...entityCounter.entries()].filter(([, count]) => count >= 3);
  if (concentration.length > 0) {
    const [entity, count] = concentration[0];
    signals.push(buildSignal({
      type: 'ENTITY_CONCENTRATION',
      title: 'Relationship concentration',
      description: `One entity, ${entity}, appears repeatedly across connected records and should be reviewed for relationship concentration.`,
      confidence: clamp(0.65 + (count - 2) * 0.08, 0.65, 0.92),
      evidenceRefs: (evidenceRefs || []).filter((item) => (item.entityName || item.name || item.number || '').toLowerCase() === entity.toLowerCase()).map((item) => item.id || `${item.entityType || 'entity'}:${entity}`),
      relatedEntities: [entity],
      severity: 'medium',
      requiresHumanReview: true,
      source: caseId ? `case:${caseId}` : 'women_safety_analysis'
    }));
  }

  const deduped = [];
  const seen = new Set();
  for (const signal of signals) {
    const key = `${signal.type}:${signal.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(signal);
    }
  }

  return deduped.slice(0, 6);
}

module.exports = { analyzeWomenSafetySignals };
