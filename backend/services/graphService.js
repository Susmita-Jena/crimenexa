const GRAPH_BASE_URL = (process.env.PYTHON_GRAPH_URL || 'http://localhost:5001').replace(/\/$/, '');

function hasAnyEntities(entities) {
  if (!entities || typeof entities !== 'object') {
    return false;
  }

  return Object.values(entities).some((value) => Array.isArray(value) && value.length > 0);
}

function normalizeEntityPayload(entities) {
  const payload = {
    people: [],
    locations: [],
    organizations: [],
    vehicles: [],
    phones: []
  };

  if (!entities || typeof entities !== 'object') {
    return payload;
  }

  Object.keys(payload).forEach((key) => {
    const value = entities[key];
    payload[key] = Array.isArray(value) ? value : [];
  });

  return payload;
}

async function postToGraphService(endpoint, data) {
  const url = `${GRAPH_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const rawText = await response.text();
    let parsedBody = null;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = rawText;
    }

    if (!response.ok) {
      const message = parsedBody && typeof parsedBody === 'object'
        ? (parsedBody.error || JSON.stringify(parsedBody))
        : rawText || response.statusText;
      throw new Error(`Python graph service error (${response.status}): ${message}`);
    }

    return parsedBody;
  } catch (error) {
    console.error(`[graphService] Failed to sync with Python graph service at ${url}:`, error.message || error);
    return null;
  }
}

async function syncEntitiesToGraph(entities, caseId) {
  if (!hasAnyEntities(entities)) {
    return null;
  }

  return postToGraphService('/api/graph/entities', {
    caseId: caseId || null,
    entities: normalizeEntityPayload(entities)
  });
}

async function syncRelationshipsToGraph(relationships, caseId) {
  if (!Array.isArray(relationships) || relationships.length === 0) {
    return null;
  }

  return postToGraphService('/api/graph/relationships', {
    caseId: caseId || null,
    relationships
  });
}

module.exports = {
  syncEntitiesToGraph,
  syncRelationshipsToGraph
};
