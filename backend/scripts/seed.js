// Resets backend/data/db.json to the demo dataset:  npm run seed
const { resetDemoData } = require('../db');

const db = resetDemoData();
const entityCount = ['people', 'locations', 'organizations', 'vehicles', 'phones']
  .reduce((sum, key) => sum + (db[key] || []).length, 0);

console.log(`Seeded demo data: ${entityCount} entities, ${db.relationships.length} relationship records, ${db.cases.length} cases, ${db.reports.length} reports.`);
