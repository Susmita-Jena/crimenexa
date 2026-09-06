const ENTITY_COLLECTIONS = [
  ['people', 'person'],
  ['locations', 'location'],
  ['organizations', 'organization'],
  ['vehicles', 'vehicle'],
  ['phones', 'phone']
];

const SCORE_WEIGHTS = {
  connectivity: 0.3,
  diversity: 0.2,
  recurrence: 0.2,
  temporal: 0.1,
  bridging: 0.2
};

function round(value) {
  return Number(value.toFixed(2));
}

function normalize(value, maximum) {
  return maximum > 0 ? value / maximum : 0;
}

function buildEntityIndex(db) {
  const entities = [];
  ENTITY_COLLECTIONS.forEach(([collection, entityType]) => {
    (db[collection] || []).forEach((entity) => {
      entities.push({ ...entity, entityType });
    });
  });
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function reportMatchesEntity(report, entity) {
  const name = String(entity.name || '').toLowerCase();
  const evidenceMatch = (report.evidence || []).some(
    (item) => String(item.entityName || '').toLowerCase() === name
  );
  const eventMatch = (report.events || []).some(
    (event) => [event.source, event.target].some((value) => String(value || '').toLowerCase() === name)
  );
  return evidenceMatch || eventMatch || (name && String(report.text || '').toLowerCase().includes(name));
}

function getEvidenceMetrics(db, entity, relationships) {
  const matchedReports = (db.reports || []).filter((report) => reportMatchesEntity(report, entity));
  const sourceNames = new Set();
  const temporalOccurrences = new Set();

  matchedReports.forEach((report) => {
    const source = report.sourceType || report.source || report.id;
    if (source) sourceNames.add(source);

    (report.evidence || []).forEach((item) => {
      if (String(item.entityName || '').toLowerCase() === String(entity.name || '').toLowerCase()) {
        const evidenceSource = item.provenance?.source || source;
        if (evidenceSource) sourceNames.add(evidenceSource);
      }
    });

    (report.events || []).forEach((event) => {
      if ([event.source, event.target].some((value) => String(value || '').toLowerCase() === String(entity.name || '').toLowerCase())) {
        const timestamp = event.timestamp || event.date || report.createdAt;
        if (timestamp) temporalOccurrences.add(String(timestamp).slice(0, 10));
      }
    });

    if (report.createdAt) temporalOccurrences.add(String(report.createdAt).slice(0, 10));
  });

  relationships
    .filter((relationship) => relationship.sourceId === entity.id || relationship.targetId === entity.id)
    .map((relationship) => relationship.createdAt || relationship.timestamp || relationship.date)
    .filter(Boolean)
    .forEach((timestamp) => temporalOccurrences.add(String(timestamp).slice(0, 10)));

  return {
    evidenceSources: sourceNames.size || (entity.mentions > 0 ? 1 : 0),
    temporalOccurrences: temporalOccurrences.size || Number(entity.mentions || 0)
  };
}

function calculateBridgingScore(relationships, neighborIds) {
  if (neighborIds.size < 2) return 0;
  let disconnectedPairs = 0;
  let possiblePairs = 0;
  const neighbors = [...neighborIds];

  for (let index = 0; index < neighbors.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < neighbors.length; nextIndex += 1) {
      possiblePairs += 1;
      const connected = relationships.some((relationship) => {
        const pair = new Set([relationship.sourceId, relationship.targetId]);
        return pair.has(neighbors[index]) && pair.has(neighbors[nextIndex]);
      });
      if (!connected) disconnectedPairs += 1;
    }
  }

  return possiblePairs > 0 ? disconnectedPairs / possiblePairs : 0;
}

function analyzeKeyEntities(db) {
  const entityIndex = buildEntityIndex(db);
  const relationships = (db.relationships || []).filter((relationship) => (
    entityIndex.has(relationship.sourceId) && entityIndex.has(relationship.targetId)
  ));
  const rawMetrics = [...entityIndex.values()].map((entity) => {
    const entityRelationships = relationships.filter((relationship) => (
      relationship.sourceId === entity.id || relationship.targetId === entity.id
    ));
    const neighborIds = new Set(entityRelationships.map((relationship) => (
      relationship.sourceId === entity.id ? relationship.targetId : relationship.sourceId
    )));
    const relationshipTypes = new Set(entityRelationships.map((relationship) => relationship.type).filter(Boolean));
    const neighborTypes = new Set([...neighborIds]
      .map((neighborId) => entityIndex.get(neighborId)?.entityType)
      .filter(Boolean));
    const evidence = getEvidenceMetrics(db, entity, relationships);

    return {
      entity,
      metrics: {
        connections: neighborIds.size,
        relationshipTypes: relationshipTypes.size,
        entityTypes: neighborTypes.size,
        evidenceSources: evidence.evidenceSources,
        temporalOccurrences: evidence.temporalOccurrences,
        bridgingScore: calculateBridgingScore(relationships, neighborIds)
      }
    };
  });

  const maximums = ['connections', 'entityTypes', 'evidenceSources', 'temporalOccurrences']
    .reduce((result, key) => ({
      ...result,
      [key]: Math.max(...rawMetrics.map(({ metrics }) => metrics[key]), 0)
    }), {});

  const ranked = rawMetrics.map(({ entity, metrics }) => {
    const components = {
      connectivity: normalize(metrics.connections, maximums.connections),
      diversity: normalize(metrics.entityTypes, maximums.entityTypes),
      recurrence: normalize(metrics.evidenceSources, maximums.evidenceSources),
      temporal: normalize(metrics.temporalOccurrences, maximums.temporalOccurrences),
      bridging: metrics.bridgingScore
    };
    const keyEntityScore = round(
      components.connectivity * SCORE_WEIGHTS.connectivity
      + components.diversity * SCORE_WEIGHTS.diversity
      + components.recurrence * SCORE_WEIGHTS.recurrence
      + components.temporal * SCORE_WEIGHTS.temporal
      + components.bridging * SCORE_WEIGHTS.bridging
    );
    const reasons = [];
    if (components.connectivity >= 0.5) reasons.push('High network connectivity');
    if (components.diversity >= 0.5) reasons.push('Connected to multiple entity types');
    if (components.recurrence >= 0.5) reasons.push('Appears across multiple evidence sources');
    if (components.temporal >= 0.5) reasons.push('Recurs across relevant evidence events or timestamps');
    if (components.bridging >= 0.5) reasons.push('Bridges otherwise separate network clusters');
    if (!reasons.length) reasons.push('Has a measurable structural connection in the evidence network');

    return {
      entityId: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      keyEntityScore,
      metrics: {
        ...metrics,
        bridgingScore: round(metrics.bridgingScore)
      },
      reasons,
      requiresHumanReview: keyEntityScore >= 0.5
    };
  }).sort((left, right) => (
    right.keyEntityScore - left.keyEntityScore
    || right.metrics.connections - left.metrics.connections
    || String(left.name).localeCompare(String(right.name))
    || String(left.entityId).localeCompare(String(right.entityId))
  ));

  return ranked.map((entity, index) => ({ ...entity, rank: index + 1 }));
}

module.exports = { analyzeKeyEntities };