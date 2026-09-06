require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoute = require('./routes/analyze');
const graphRoute = require('./routes/graph');
const peopleRoute = require('./routes/people');
const casesRoute = require('./routes/cases');
const reportsRoute = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'crimegraph-backend' });
});

app.use('/api/analyze', analyzeRoute);
app.use('/api/graph', graphRoute);
app.use('/api/people', peopleRoute);
app.use('/api/cases', casesRoute);
app.use('/api/reports', reportsRoute);

// Central error handler — keep it last
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CrimeGraph backend listening on port ${PORT}`);
});
