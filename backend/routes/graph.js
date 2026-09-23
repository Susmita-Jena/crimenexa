const express = require('express');

const { readDB } = require('../db');
const { analyzeKeyEntities } = require('../services/keyEntityAnalysis');

const router = express.Router();

/* ----------------------------- Helpers ----------------------------- */

const uniq = (values) => [
  ...new Set(
    values
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
      )
      .map(String)
  )
];

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

function valuesFromObject(obj, keys) {
  if (!obj || typeof obj !== 'object') return [];

  return keys.flatMap((key) => {
    const value = obj[key];

    if (Array.isArray(value)) return value;

    return value === undefined || value === null ? [] : [value];
  });
}

/* --------------------------- Provenance ---------------------------- */

function getSourceTypes(record) {
  return uniq(
    valuesFromObject(record, [
      'sourceType',
      'source',
      'reportType',
      'documentType',
      'evidenceType',
      'channel',
      'origin'
    ])
  );
}

function getEvidenceRefs(record) {
  return uniq(
    valuesFromObject(record, [
      'evidenceId',
      'evidenceID',
      'evidenceRef',
      'evidenceRefs',
      'reportId',
      'reportID',
      'reportRef'
    ])
  );
}

function getCaseIds(record) {
  return uniq(
    valuesFromObject(record, [
      'caseId',
      'caseID',
      'caseIds'
    ])
  );
}

function getTimestamps(record) {
  return uniq(
    valuesFromObject(record, [
      'timestamp',
      'date',
      'datetime',
      'dateTime',
      'eventDate',
      'observedAt',
      'createdAt',
      'occurredAt'
    ])
  );
}

function getPoliceStations(record) {
  return uniq(
    valuesFromObject(record, [
      'policeStation',
      'station',
      'stationName',
      'police_station',
      'jurisdiction',
      'registeredAt'
    ])
  );
}

/* ------------------------- Relationship Key ------------------------ */

function relationshipKey(from, to, type) {
  return `${from}|${to}|${normalize(type)}`;
}

/* =============================== ROUTE ============================== */

router.get('/', (req, res) => {
  try {
    const db = readDB();

    /* ---------------------- KEY ENTITY ANALYSIS ---------------------- */

    const keyEntities = analyzeKeyEntities(db);

    const keyEntityById = new Map(
      keyEntities.map((entity) => [
        entity.entityId,
        entity
      ])
    );

    /* -------------------------- ALL RECORDS -------------------------- */

    const allRecords = [
      ...(Array.isArray(db.reports) ? db.reports : []),
      ...(Array.isArray(db.evidence) ? db.evidence : []),
      ...(Array.isArray(db.events) ? db.events : []),
      ...(Array.isArray(db.cases) ? db.cases : [])
    ];

    /* ------------------------- PROVENANCE MAP ------------------------ */

    const provenanceByEntity = new Map();

    const addProvenance = (entityId, record) => {
      if (!entityId || !record) return;

      const id = String(entityId);

      if (!provenanceByEntity.has(id)) {
        provenanceByEntity.set(id, {
          sourceTypes: new Set(),
          evidenceRefs: new Set(),
          caseIds: new Set(),
          policeStations: new Set(),
          timestamps: new Set()
        });
      }

      const provenance = provenanceByEntity.get(id);

      getSourceTypes(record).forEach((value) =>
        provenance.sourceTypes.add(value)
      );

      getEvidenceRefs(record).forEach((value) =>
        provenance.evidenceRefs.add(value)
      );

      getCaseIds(record).forEach((value) =>
        provenance.caseIds.add(value)
      );

      getPoliceStations(record).forEach((value) =>
        provenance.policeStations.add(value)
      );

      getTimestamps(record).forEach((value) =>
        provenance.timestamps.add(value)
      );
    };

    /* ----------------------- CONNECT RECORDS ------------------------- */

    allRecords.forEach((record) => {
      const possibleEntityIds = [
        ...valuesFromObject(record, [
          'entityId',
          'entityID',
          'personId',
          'personID',
          'locationId',
          'locationID',
          'organizationId',
          'organizationID',
          'vehicleId',
          'vehicleID',
          'phoneId',
          'phoneID'
        ]),

        ...(Array.isArray(record.entityIds)
          ? record.entityIds
          : [])
      ];

      possibleEntityIds.forEach((id) => {
        addProvenance(String(id), record);
      });
    });

    /* ----------------------------- NODES ----------------------------- */

    const entityArrays = [
      ['people', 'person'],
      ['locations', 'location'],
      ['organizations', 'organization'],
      ['vehicles', 'vehicle'],
      ['phones', 'phone']
    ];

    const nodes = entityArrays.flatMap(
      ([collection, group]) =>
        (Array.isArray(db[collection])
          ? db[collection]
          : []
        ).map((entity) => {
          const ranking = keyEntityById.get(entity.id);

          const provenance =
            provenanceByEntity.get(
              String(entity.id)
            );

          return {
            id: entity.id,

            label: ranking
              ? `${ranking.rank}. ${entity.name}`
              : entity.name,

            group,

            title:
              entity.notes ||
              entity.role ||
              '',

            /* Existing key entity data */
            ...(ranking || {}),

            /* Provenance */
            sourceTypes: provenance
              ? [...provenance.sourceTypes]
              : [],

            evidenceRefs: provenance
              ? [...provenance.evidenceRefs]
              : [],

            caseIds: provenance
              ? [...provenance.caseIds]
              : [],

            policeStations: provenance
              ? [...provenance.policeStations]
              : [],

            timestamps: provenance
              ? [...provenance.timestamps]
              : []
          };
        })
    );

    /* ----------------------- RELATIONSHIPS --------------------------- */

    const rawRelationships = Array.isArray(db.relationships)
      ? db.relationships
      : [];

    const relationshipGroups = new Map();

    rawRelationships
      .filter(
        (relationship) =>
          relationship &&
          relationship.sourceId &&
          relationship.targetId
      )
      .forEach((relationship) => {
        const key = relationshipKey(
          relationship.sourceId,
          relationship.targetId,
          relationship.type
        );

        if (!relationshipGroups.has(key)) {
          relationshipGroups.set(key, {
            id:
              relationship.id ||
              `rel-${relationshipGroups.size + 1}`,

            from: relationship.sourceId,

            to: relationship.targetId,

            label:
              relationship.type ||
              'RELATED',

            descriptions: [],

            sourceTypes: new Set(),

            evidenceRefs: new Set(),

            caseIds: new Set(),

            timestamps: [],

            occurrenceCount: 0
          });
        }

        const grouped =
          relationshipGroups.get(key);

        /* Count repeated relationship */
        grouped.occurrenceCount += 1;

        if (relationship.description) {
          grouped.descriptions.push(
            String(relationship.description)
          );
        }

        getSourceTypes(relationship).forEach(
          (value) =>
            grouped.sourceTypes.add(value)
        );

        getEvidenceRefs(relationship).forEach(
          (value) =>
            grouped.evidenceRefs.add(value)
        );

        getCaseIds(relationship).forEach(
          (value) =>
            grouped.caseIds.add(value)
        );

        getTimestamps(relationship).forEach(
          (value) =>
            grouped.timestamps.push(value)
        );

        /* Relationship-level provenance */
        addProvenance(
          String(relationship.sourceId),
          relationship
        );

        addProvenance(
          String(relationship.targetId),
          relationship
        );
      });

    /* ----------------------- FINAL EDGE DATA ------------------------- */

    const edges = [
      ...relationshipGroups.values()
    ].map((relationship) => ({
      id: relationship.id,

      from: relationship.from,

      to: relationship.to,

      label: relationship.label,

      type: relationship.label,

      description: uniq(
        relationship.descriptions
      ).join(' | '),

      /*
       * IMPORTANT:
       * Frontend uses this to make repeated
       * relationships visually thicker.
       */
      occurrenceCount:
        relationship.occurrenceCount,

      sourceTypes: [
        ...relationship.sourceTypes
      ],

      evidenceRefs: [
        ...relationship.evidenceRefs
      ],

      caseIds: [
        ...relationship.caseIds
      ],

      timestamps: uniq(
        relationship.timestamps
      ),

      sourceCount:
        relationship.sourceTypes.size,

      evidenceCount:
        relationship.evidenceRefs.size
    }));

    /* ---------------- UPDATE NODE PROVENANCE ---------------- */

    nodes.forEach((node) => {
      const provenance =
        provenanceByEntity.get(
          String(node.id)
        );

      if (!provenance) return;

      node.sourceTypes = [
        ...provenance.sourceTypes
      ];

      node.evidenceRefs = [
        ...provenance.evidenceRefs
      ];

      node.caseIds = [
        ...provenance.caseIds
      ];

      node.policeStations = [
        ...provenance.policeStations
      ];

      node.timestamps = [
        ...provenance.timestamps
      ];
    });

    /* ======================= ALERT GENERATION ======================= */

    const alerts = [];

    edges.forEach((edge) => {

      /* -------- Repeated relationship -------- */

      if (edge.occurrenceCount >= 2) {
        alerts.push({
          id: `repeat-${edge.id}`,

          type:
            edge.occurrenceCount >= 4
              ? 'high'
              : 'medium',

          category:
            'REPEATED_CONNECTION',

          title:
            'Repeated connection detected',

          relationshipId:
            edge.id,

          from:
            edge.from,

          to:
            edge.to,

          occurrenceCount:
            edge.occurrenceCount,

          requiresHumanReview: true
        });
      }

      /* -------- Cross source recurrence -------- */

      if (
        edge.sourceCount >= 2 ||
        edge.evidenceCount >= 2
      ) {
        alerts.push({
          id:
            `cross-source-${edge.id}`,

          type:
            'medium',

          category:
            'CROSS_SOURCE_RECURRENCE',

          title:
            'Cross-source recurrence detected',

          relationshipId:
            edge.id,

          from:
            edge.from,

          to:
            edge.to,

          sourceCount:
            edge.sourceCount,

          evidenceCount:
            edge.evidenceCount,

          requiresHumanReview: true
        });
      }

      /* -------- Movement / location activity -------- */

      const locationRelationship = [
        'located_at',
        'seen_at',
        'location',
        'movement'
      ].includes(
        normalize(edge.label)
      );

      if (
        locationRelationship &&
        edge.timestamps.length > 0
      ) {
        alerts.push({
          id:
            `movement-${edge.id}`,

          type:
            'medium',

          category:
            'ACTIVITY_MOVEMENT',

          title:
            'Recorded location activity',

          relationshipId:
            edge.id,

          from:
            edge.from,

          to:
            edge.to,

          timestamps:
            edge.timestamps,

          requiresHumanReview: true
        });
      }
    });

    /* -------- Key entity notifications -------- */

    keyEntities
      .slice(0, 5)
      .forEach((entity) => {
        alerts.push({
          id:
            `key-${entity.entityId}`,

          type:
            'info',

          category:
            'KEY_ENTITY',

          title:
            'Key entity identified',

          entityId:
            entity.entityId,

          rank:
            entity.rank,

          score:
            entity.keyEntityScore,

          requiresHumanReview:
            true
        });
      });

    /* =========================== RESPONSE ============================ */

    res.json({
      nodes,

      edges,

      keyEntities,

      alerts:
        alerts.slice(0, 20)
    });

  } catch (error) {

    console.error(
      'Graph route error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to build investigation graph',

      message:
        error.message
    });
  }
});

module.exports = router;
