function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeEvidenceItem({ sourceType, text, entityType, entityName, detail, confidence }) {
  return {
    id: `${sourceType || 'source'}-${entityType}-${entityName || 'item'}-${Math.random().toString(16).slice(2, 8)}`,
    sourceType: sourceType || 'unspecified',
    entityType,
    entityName: entityName || 'Unknown',
    detail: normalizeText(detail || text || ''),
    confidence: typeof confidence === 'number' ? Math.min(Math.max(confidence, 0), 1) : 0.72,
    provenance: {
      source: sourceType || 'unspecified',
      extractedFrom: 'textual_report',
      timestamp: new Date().toISOString()
    }
  };
}

function buildInvestigationContext({ text, sourceType, entities = {}, relationships = [], riskFlags = [] }) {
  const personNames = (entities.people || []).map((person) => person.name).filter(Boolean);
  const locationNames = (entities.locations || []).map((location) => location.name).filter(Boolean);
  const organizationNames = (entities.organizations || []).map((org) => org.name).filter(Boolean);
  const vehicleNames = (entities.vehicles || []).map((vehicle) => vehicle.description).filter(Boolean);

  const evidence = [
    ...personNames.map((name) => makeEvidenceItem({
      sourceType,
      text,
      entityType: 'person',
      entityName: name,
      detail: `Named person of interest: ${name}`,
      confidence: 0.82
    })),
    ...locationNames.map((name) => makeEvidenceItem({
      sourceType,
      text,
      entityType: 'location',
      entityName: name,
      detail: `Location mention: ${name}`,
      confidence: 0.8
    })),
    ...organizationNames.map((name) => makeEvidenceItem({
      sourceType,
      text,
      entityType: 'organization',
      entityName: name,
      detail: `Organization mention: ${name}`,
      confidence: 0.74
    })),
    ...vehicleNames.map((name) => makeEvidenceItem({
      sourceType,
      text,
      entityType: 'vehicle',
      entityName: name,
      detail: `Vehicle reference: ${name}`,
      confidence: 0.7
    }))
  ];

  const events = relationships.map((relationship, index) => ({
    id: `event-${index + 1}`,
    type: relationship.type || 'associate',
    source: relationship.source,
    target: relationship.target,
    description: relationship.description || '',
    confidence: 0.74,
    timestamp: new Date().toISOString()
  }));

  const riskWeight = Math.min(1, 0.45 + (riskFlags.length * 0.12) + (relationships.length * 0.08));
  const confidence = Number(riskWeight.toFixed(2));

  const leads = generateLeadCandidates({
    people: entities.people || [],
    organizations: entities.organizations || [],
    locations: entities.locations || [],
    riskFlags: riskFlags || []
  });

  return {
    summary: normalizeText(text || 'No report text provided.'),
    evidence,
    confidence,
    events,
    leads,
    riskFlags: Array.isArray(riskFlags) ? riskFlags : [],
    provenance: {
      status: 'text_extracted',
      sourceType: sourceType || 'unspecified',
      generatedAt: new Date().toISOString()
    }
  };
}

function generateLeadCandidates({ people = [], organizations = [], locations = [], riskFlags = [] }) {
  const leadPool = [];

  if (people.length > 0) {
    people.forEach((person, index) => {
      const reasons = [];
      if (riskFlags.some((flag) => /shell|cash|warehouse|handoff|repeated|contact/i.test(flag))) {
        reasons.push('Flagged by suspicious pattern');
      }
      if (person.role) {
        reasons.push(`Role: ${person.role}`);
      }
      leadPool.push({
        id: `lead-${index + 1}`,
        title: `Review ${person.name || 'person of interest'}`,
        riskScore: 0.7 + (reasons.length * 0.08),
        reasons,
        entities: [{ type: 'person', value: person.name }],
        nextAction: 'Validate contacts, movements, and linked records.'
      });
    });
  }

  if (organizations.length > 0) {
    organizations.forEach((org, index) => {
      const reasons = ['Organization appears in suspicious activity'];
      if (riskFlags.length > 0) {
        reasons.push(riskFlags[0]);
      }
      leadPool.push({
        id: `lead-org-${index + 1}`,
        title: `Inspect ${org.name}`,
        riskScore: 0.8,
        reasons,
        entities: [{ type: 'organization', value: org.name }],
        nextAction: 'Trace ownership, bank activity, and document trail.'
      });
    });
  }

  if (locations.length > 0) {
    locations.forEach((location, index) => {
      leadPool.push({
        id: `lead-loc-${index + 1}`,
        title: `Map surveillance around ${location.name}`,
        riskScore: 0.72,
        reasons: ['Repeated mention in intelligence context'],
        entities: [{ type: 'location', value: location.name }],
        nextAction: 'Check movement patterns and nearby holdings.'
      });
    });
  }

  return leadPool.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
}

module.exports = { buildInvestigationContext, generateLeadCandidates };
