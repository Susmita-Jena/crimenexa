/*
 * CrimeNexa demo dataset — "Operation Kalinga Cash Trail" (synthetic data).
 *
 * Three loosely-linked cells so the graph has real structure to explore:
 *   Cell A  warehouse + courier operation (Old Town Warehouse)
 *   Cell B  shell companies + financial broker (Navi Mumbai Office)
 *   Cell C  transport + handlers (Paradeep / Berhampur routes)
 *
 * Story hooks baked in on purpose:
 *   - Karan Malhotra has few links, but he is the ONLY path between B and C
 *     (high betweenness, removing him splits the network).
 *   - Three shell companies are registered at the same address.
 *   - Ravi <-> Sanjay recur 6 times (high-recurrence edge).
 *   - Activity spreads over ~12 weeks, so the timeline replay shows the
 *     network growing cell by cell.
 *
 * All names, numbers and plates are fictional.
 */

const people = [
  { id: 'p1', name: 'Ravi Kumar', role: 'Logistics Coordinator', notes: 'Known courier route handler', mentions: 6 },
  { id: 'p2', name: 'Sanjay Mehta', role: 'Shell company operator', notes: 'Linked to suspicious invoice routing', mentions: 7 },
  { id: 'p3', name: 'Asha Verma', role: 'Informant', notes: 'Witness in warehouse handover', mentions: 2 },
  { id: 'p4', name: 'Nitin Shah', role: 'Financial broker', notes: 'Moves funds across shell entities', mentions: 6 },
  { id: 'p5', name: 'Karan Malhotra', role: 'Fixer', notes: 'Low-profile go-between, uses a burner phone', mentions: 4 },
  { id: 'p6', name: 'Deepak Rao', role: 'Company director', notes: 'Director of Kalinga Exports LLP', mentions: 3 },
  { id: 'p7', name: 'Meera Iyer', role: 'Accountant', notes: 'Keeps books for two shell companies', mentions: 3 },
  { id: 'p8', name: 'Imran Sheikh', role: 'Transporter', notes: 'Runs the Paradeep freight leg', mentions: 5 },
  { id: 'p9', name: 'Bhaskar Nayak', role: 'Driver', notes: 'Drives the Tata 407 between warehouse and godown', mentions: 3 },
  { id: 'p10', name: 'Lata Pradhan', role: 'Warehouse manager', notes: 'Manages Old Town Warehouse day to day', mentions: 3 },
  { id: 'p11', name: 'Vikram Singh', role: 'Handler', notes: 'Coordinates transport cell, owns Sagar Cold Storage', mentions: 5 },
  { id: 'p12', name: 'Rohit Das', role: 'Runner', notes: 'Short-haul runner, seen at Cuttack Road Godown', mentions: 3 },
  { id: 'p13', name: 'Pooja Sahoo', role: 'Nominee director', notes: 'Named director on two shell companies', mentions: 2 }
];

const locations = [
  { id: 'l1', name: 'Old Town Warehouse', notes: 'Primary handoff point', mentions: 6 },
  { id: 'l2', name: 'MG Road', notes: 'Meeting point noted in FIR', mentions: 1 },
  { id: 'l3', name: 'Navi Mumbai Office', notes: 'Registered address for three companies', mentions: 5 },
  { id: 'l4', name: 'Cuttack Road Godown', notes: 'Storage godown, owned via Sagar Cold Storage', mentions: 3 },
  { id: 'l5', name: 'Paradeep Port Gate 3', notes: 'Truck movement observed', mentions: 3 },
  { id: 'l6', name: 'Hotel Sagar Residency', notes: 'Meeting venue, Berhampur', mentions: 2 },
  { id: 'l7', name: 'Berhampur Truck Yard', notes: 'Overnight halt point', mentions: 2 }
];

const organizations = [
  { id: 'o1', name: 'Shakti Traders', notes: 'Shell company under investigation', mentions: 5 },
  { id: 'o2', name: 'City Courier Pvt Ltd', notes: 'Transit and logistics partner', mentions: 2 },
  { id: 'o3', name: 'Kalinga Exports LLP', notes: 'Receives layered transfers', mentions: 5 },
  { id: 'o4', name: 'Meridian Infra Services', notes: 'Second-layer shell, no visible operations', mentions: 3 },
  { id: 'o5', name: 'Sagar Cold Storage', notes: 'Owns the Cuttack Road godown', mentions: 2 },
  { id: 'o6', name: 'Utkal Freight Lines', notes: 'Freight operator used for port legs', mentions: 3 }
];

const vehicles = [
  { id: 'v1', name: 'White Maruti Swift', notes: 'OD-05-XXXX, registered to Sanjay Mehta', mentions: 3 },
  { id: 'v2', name: 'Tata 407 (OD-07-XXXX)', notes: 'Light goods carrier', mentions: 4 },
  { id: 'v3', name: 'Black Scorpio (OD-02-XXXX)', notes: 'Handler vehicle', mentions: 2 },
  { id: 'v4', name: 'Eicher Truck (OD-30-XXXX)', notes: 'Port-leg truck', mentions: 4 }
];

const phones = [
  { id: 'ph1', name: '98765xxxxx', notes: 'Phone linked to Ravi Kumar', mentions: 3 },
  { id: 'ph2', name: '98123xxxxx', notes: 'Phone linked to Sanjay Mehta', mentions: 3 },
  { id: 'ph3', name: '90901xxxxx', notes: 'Burner used by Karan Malhotra', mentions: 3 },
  { id: 'ph4', name: '70102xxxxx', notes: 'Phone linked to Vikram Singh', mentions: 2 },
  { id: 'ph5', name: '99370xxxxx', notes: 'Phone linked to Nitin Shah', mentions: 2 },
  { id: 'ph6', name: '63704xxxxx', notes: 'Phone linked to Imran Sheikh', mentions: 2 }
];

const all = [...people, ...locations, ...organizations, ...vehicles, ...phones];
const nameOf = (id) => all.find((e) => e.id === id).name;

/* ------------------------------ relationships ----------------------------- */

const relationships = [];
let counter = 0;

/**
 * add(source, target, type, sourceType, reportId, caseId, station, description, ...dates)
 * One row per dated occurrence — repeated rows for the same pair+type are what
 * make an edge "recurring" in the graph.
 */
function add(sourceId, targetId, type, sourceType, reportId, caseId, station, description, ...dates) {
  dates.forEach((date) => {
    counter += 1;
    relationships.push({
      id: `r${counter}`,
      sourceId,
      targetId,
      sourceName: nameOf(sourceId),
      targetName: nameOf(targetId),
      type,
      description,
      sourceType,
      reportId,
      caseId,
      policeStation: station,
      date
    });
  });
}

const OLD_TOWN = 'Old Town PS';
const CUTTACK = 'Cuttack Sadar PS';
const PARADEEP = 'Paradeep PS';
const BERHAMPUR = 'Berhampur Town PS';
const CYBER = 'Cyber Crime PS';

/* ---- Cell A: warehouse + courier ---- */
add('p3', 'p1', 'informs_about', 'informant', 'rep1', 'c1', OLD_TOWN, 'Witness reports suspicious handoff', '2026-06-22');
add('p3', 'p2', 'informs_about', 'informant', 'rep1', 'c1', OLD_TOWN, 'Witness names Sanjay as the buyer', '2026-06-22');
add('p1', 'l1', 'met_at', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Ravi met associates at the warehouse', '2026-06-24', '2026-07-08', '2026-07-30', '2026-08-19');
add('p1', 'p2', 'contacts', 'cdr', 'rep2', 'c1', OLD_TOWN, 'Repeated coordination calls', '2026-06-28', '2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25', '2026-08-02');
add('p2', 'l1', 'met_at', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Sanjay present during handover', '2026-07-11', '2026-07-30');
add('p2', 'o1', 'operates', 'fir', 'rep1', 'c1', OLD_TOWN, 'Shell company linked to cash movement', '2026-06-22');
add('p2', 'v1', 'owns_vehicle', 'fir', 'rep1', 'c1', OLD_TOWN, 'Vehicle registered to Sanjay', '2026-06-22');
add('v1', 'l1', 'seen_at', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Vehicle seen at the warehouse', '2026-07-11', '2026-07-30');
add('p1', 'ph1', 'uses_phone', 'cdr', 'rep2', 'c1', OLD_TOWN, 'Handset linked in CDR', '2026-06-25');
add('p2', 'ph2', 'uses_phone', 'cdr', 'rep2', 'c1', OLD_TOWN, 'Handset linked in CDR', '2026-06-25');
add('p1', 'o2', 'works_for', 'fir', 'rep1', 'c1', OLD_TOWN, 'Employed as logistics coordinator', '2026-06-24');
add('p9', 'o2', 'works_for', 'informant', 'rep8', 'c1', OLD_TOWN, 'Drives for the courier company', '2026-07-02');
add('p9', 'v2', 'drives', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Seen driving the Tata 407', '2026-07-11');
add('v2', 'l1', 'seen_at', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Loading observed at night', '2026-07-11', '2026-07-30', '2026-08-19');
add('p10', 'l1', 'manages', 'informant', 'rep8', 'c1', OLD_TOWN, 'Manages the warehouse', '2026-07-05');
add('p10', 'p1', 'contacts', 'cdr', 'rep2', 'c1', OLD_TOWN, 'Coordination before handovers', '2026-07-05', '2026-07-19');
add('o2', 'l1', 'delivers_to', 'surveillance', 'rep3', 'c1', OLD_TOWN, 'Courier vans unload after hours', '2026-07-30');

/* ---- Bridge between A and B: Shakti Traders sits on the warehouse ---- */
add('o1', 'l1', 'leases', 'financial', 'rep4', 'c1', OLD_TOWN, 'Warehouse rent paid from Shakti Traders account', '2026-07-06', '2026-08-06');
add('p2', 'p4', 'contacts', 'cdr', 'rep2', 'c1', OLD_TOWN, 'Calls before fund transfers', '2026-07-14', '2026-07-21', '2026-08-04');

/* ---- Cell B: shells + broker ---- */
add('p4', 'o1', 'funds', 'financial', 'rep4', 'c2', CYBER, 'Recurring funding into Shakti Traders', '2026-07-14', '2026-07-28', '2026-08-11');
add('p4', 'o3', 'transfers_funds_to', 'financial', 'rep4', 'c2', CYBER, 'Layered transfers to Kalinga Exports', '2026-07-29', '2026-08-05', '2026-08-12', '2026-08-26');
add('o3', 'o4', 'transfers_funds_to', 'financial', 'rep4', 'c2', CYBER, 'Onward transfer with no invoice trail', '2026-08-06', '2026-08-20');
add('p6', 'o3', 'director_of', 'financial', 'rep4', 'c2', CYBER, 'Named director on registry filings', '2026-07-01');
add('p13', 'o1', 'director_of', 'financial', 'rep4', 'c2', CYBER, 'Nominee director, no visible role', '2026-07-01');
add('p13', 'o4', 'director_of', 'financial', 'rep4', 'c2', CYBER, 'Nominee director, no visible role', '2026-07-01');
add('p7', 'o3', 'works_for', 'financial', 'rep4', 'c2', CYBER, 'Books maintained by Meera Iyer', '2026-07-03');
add('p7', 'o4', 'works_for', 'financial', 'rep4', 'c2', CYBER, 'Books maintained by Meera Iyer', '2026-07-03');
add('p7', 'p4', 'contacts', 'cdr', 'rep5', 'c2', CYBER, 'Reconciliation calls', '2026-07-20', '2026-08-10');
add('p4', 'p6', 'communicated_with', 'social', 'rep7', 'c2', CYBER, 'Messages found in social media intel', '2026-09-10');
add('p13', 'ph2', 'uses_phone', 'cdr', 'rep5', 'c2', CYBER, 'Same handset appears on two profiles', '2026-08-14');
add('p4', 'ph5', 'uses_phone', 'cdr', 'rep5', 'c2', CYBER, 'Handset linked in CDR', '2026-07-14');
add('o1', 'l3', 'registered_at', 'fir', 'rep4', 'c2', CYBER, 'Registered address', '2026-06-30');
add('o3', 'l3', 'registered_at', 'fir', 'rep4', 'c2', CYBER, 'Registered address', '2026-06-30');
add('o4', 'l3', 'registered_at', 'fir', 'rep4', 'c2', CYBER, 'Registered address', '2026-06-30');
add('p4', 'l3', 'met_at', 'surveillance', 'rep6', 'c2', CYBER, 'Meeting observed at the office', '2026-07-15');
add('p6', 'l3', 'met_at', 'surveillance', 'rep6', 'c2', CYBER, 'Meeting observed at the office', '2026-07-15');
add('p7', 'l3', 'met_at', 'surveillance', 'rep6', 'c2', CYBER, 'Seen entering the office', '2026-08-10');

/* ---- Karan Malhotra: the only bridge between B and C ---- */
add('p5', 'p4', 'contacts', 'cdr', 'rep5', 'c2', CYBER, 'Cash coordination calls', '2026-07-22', '2026-08-04', '2026-08-13', '2026-08-25');
add('p5', 'p11', 'contacts', 'cdr', 'rep5', 'c2', BERHAMPUR, 'Calls before each meeting', '2026-08-03', '2026-08-17', '2026-08-31');
add('p5', 'ph3', 'uses_phone', 'cdr', 'rep5', 'c2', BERHAMPUR, 'Burner handset', '2026-08-03');
add('p5', 'l6', 'met_at', 'surveillance', 'rep6', 'c2', BERHAMPUR, 'Meeting with Vikram observed', '2026-08-17');
add('p11', 'l6', 'met_at', 'surveillance', 'rep6', 'c2', BERHAMPUR, 'Meeting with Karan observed', '2026-08-17');

/* ---- Cell C: transport + handlers ---- */
add('p11', 'p8', 'contacts', 'cdr', 'rep5', 'c2', BERHAMPUR, 'Route instructions', '2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29');
add('p11', 'ph4', 'uses_phone', 'cdr', 'rep5', 'c2', BERHAMPUR, 'Handset linked in CDR', '2026-08-01');
add('p11', 'v3', 'owns_vehicle', 'fir', 'rep6', 'c2', BERHAMPUR, 'Vehicle registered to Vikram', '2026-08-10');
add('p11', 'o5', 'director_of', 'financial', 'rep4', 'c2', BERHAMPUR, 'Owner of the cold storage firm', '2026-08-05');
add('o5', 'l4', 'located_at', 'fir', 'rep6', 'c2', CUTTACK, 'Godown belongs to the firm', '2026-08-05');
add('p8', 'ph6', 'uses_phone', 'cdr', 'rep5', 'c2', PARADEEP, 'Handset linked in CDR', '2026-08-01');
add('p8', 'o6', 'works_for', 'informant', 'rep6', 'c2', PARADEEP, 'Runs freight legs for Utkal Freight', '2026-08-01');
add('p8', 'v4', 'drives', 'surveillance', 'rep6', 'c2', PARADEEP, 'Seen driving the Eicher truck', '2026-08-15');
add('v4', 'l5', 'seen_at', 'surveillance', 'rep6', 'c2', PARADEEP, 'Truck logged at the port gate', '2026-08-15', '2026-08-29', '2026-09-05');
add('v4', 'l7', 'seen_at', 'surveillance', 'rep6', 'c2', BERHAMPUR, 'Overnight halt', '2026-08-29');
add('o6', 'l5', 'delivers_to', 'surveillance', 'rep6', 'c2', PARADEEP, 'Consignments delivered to the gate', '2026-08-29');
add('p8', 'l4', 'met_at', 'surveillance', 'rep6', 'c2', CUTTACK, 'Meeting at the godown', '2026-08-27');
add('p12', 'p8', 'contacts', 'cdr', 'rep5', 'c2', CUTTACK, 'Pickup coordination', '2026-08-20', '2026-08-27', '2026-09-03');
add('p12', 'l4', 'seen_at', 'surveillance', 'rep6', 'c2', CUTTACK, 'Runner seen loading', '2026-08-27', '2026-09-03');

/* ------------------------------- cases/reports ---------------------------- */

const cases = [
  {
    id: 'c1',
    title: 'Warehouse logistics shell network',
    description: 'Suspicious movement of funds and goods through the Old Town warehouse and Shakti Traders.',
    reports: ['rep1', 'rep2', 'rep3', 'rep8'],
    createdAt: '2026-06-22T00:00:00.000Z'
  },
  {
    id: 'c2',
    title: 'Kalinga Exports cash routing',
    description: 'Layered transfers through shell companies, with a transport leg towards Paradeep.',
    reports: ['rep4', 'rep5', 'rep6', 'rep7'],
    createdAt: '2026-07-14T00:00:00.000Z'
  }
];

const reports = [
  {
    id: 'rep1', sourceType: 'fir', caseId: 'c1', createdAt: '2026-06-22T00:00:00.000Z',
    text: 'Informant Asha Verma reports that Ravi Kumar met Sanjay Mehta at the Old Town Warehouse. A white Maruti Swift registered to Sanjay was seen at the same location. Sanjay is believed to be linked to Shakti Traders, a shell company under investigation.',
    summary: 'Warehouse handoff involving a shell-company operator and a courier coordinator.',
    riskFlags: ['Shell entity linkage', 'Warehouse handoff'], confidence: 0.86,
    evidence: [
      { entityType: 'person', entityName: 'Ravi Kumar', confidence: 0.9, provenance: { source: 'fir', extractedFrom: 'textual_report' } },
      { entityType: 'person', entityName: 'Sanjay Mehta', confidence: 0.9, provenance: { source: 'fir', extractedFrom: 'textual_report' } }
    ],
    events: [], leads: []
  },
  {
    id: 'rep2', sourceType: 'cdr', caseId: 'c1', createdAt: '2026-08-03T00:00:00.000Z',
    text: 'Call detail records show repeated contact between Ravi Kumar and Sanjay Mehta, with Nitin Shah calling Sanjay ahead of each transfer. Lata Pradhan is in touch with Ravi Kumar before every handover.',
    summary: 'CDR pattern linking the warehouse cell to a financial broker.',
    riskFlags: ['Repeated contact', 'Broker involvement'], confidence: 0.82, evidence: [], events: [], leads: []
  },
  {
    id: 'rep3', sourceType: 'surveillance', caseId: 'c1', createdAt: '2026-08-20T00:00:00.000Z',
    text: 'Surveillance at the Old Town Warehouse recorded Ravi Kumar, Sanjay Mehta and Bhaskar Nayak. The Tata 407 and the white Maruti Swift were present during night loading.',
    summary: 'Night loading observed at the warehouse.',
    riskFlags: ['Night loading'], confidence: 0.8, evidence: [], events: [], leads: []
  },
  {
    id: 'rep4', sourceType: 'financial', caseId: 'c2', createdAt: '2026-08-27T00:00:00.000Z',
    text: 'Bank records show Nitin Shah funding Shakti Traders and moving money to Kalinga Exports LLP, which passes it on to Meridian Infra Services. Deepak Rao, Pooja Sahoo and Meera Iyer appear on filings for these companies. Vikram Singh is the owner of Sagar Cold Storage. All three shells share the Navi Mumbai Office address.',
    summary: 'Layered transfers through three shell companies at one address.',
    riskFlags: ['Layering', 'Shared address', 'Nominee directors'], confidence: 0.88, evidence: [], events: [], leads: []
  },
  {
    id: 'rep5', sourceType: 'cdr', caseId: 'c2', createdAt: '2026-09-02T00:00:00.000Z',
    text: 'CDR analysis shows Karan Malhotra calling Nitin Shah and Vikram Singh from a burner handset. Vikram Singh calls Imran Sheikh every week. Rohit Das calls Imran Sheikh before pickups.',
    summary: 'A single go-between links the finance side to the transport side.',
    riskFlags: ['Burner phone', 'Single point of contact'], confidence: 0.84, evidence: [], events: [], leads: []
  },
  {
    id: 'rep6', sourceType: 'surveillance', caseId: 'c2', createdAt: '2026-09-06T00:00:00.000Z',
    text: 'Karan Malhotra and Vikram Singh were observed meeting at Hotel Sagar Residency. An Eicher truck driven by Imran Sheikh was logged three times at Paradeep Port Gate 3. Rohit Das was seen loading at the Cuttack Road Godown.',
    summary: 'Meetings and truck movements along the Paradeep route.',
    riskFlags: ['Route pattern', 'Godown loading'], confidence: 0.83, evidence: [], events: [], leads: []
  },
  {
    id: 'rep7', sourceType: 'social', caseId: 'c2', createdAt: '2026-09-10T00:00:00.000Z',
    text: 'Social media intelligence found messages between Nitin Shah and Deepak Rao discussing "the next batch" from Kalinga Exports.',
    summary: 'Social media contact between broker and company director.',
    riskFlags: ['Coded language'], confidence: 0.7, evidence: [], events: [], leads: []
  },
  {
    id: 'rep8', sourceType: 'informant', caseId: 'c1', createdAt: '2026-07-05T00:00:00.000Z',
    text: 'Informant states Lata Pradhan manages the Old Town Warehouse and Bhaskar Nayak drives for City Courier Pvt Ltd.',
    summary: 'Staffing details for the warehouse operation.',
    riskFlags: [], confidence: 0.72, evidence: [], events: [], leads: []
  }
];

/* Seed a genesis custody entry for each demo report so the evidence-integrity
 * view has something real to show right away, not just after a fresh analyze. */
const { hashContent, appendCustodyEvent } = require('../services/custodyLedger');

const custodyLedger = [];
const custodySeedDb = { custodyLedger };

reports.forEach((report) => {
  const contentHash = hashContent(report.text);
  report.integrityHash = contentHash;
  appendCustodyEvent(custodySeedDb, {
    reportId: report.id,
    action: 'INGESTED',
    actorName: report.sourceType === 'informant' ? 'Field Officer' : 'Investigator Portal',
    detail: { sourceType: report.sourceType, contentHash }
  });
});

module.exports = {
  people,
  locations,
  organizations,
  vehicles,
  phones,
  relationships,
  cases,
  reports,
  evidence: [],
  leads: [],
  custodyLedger
};
