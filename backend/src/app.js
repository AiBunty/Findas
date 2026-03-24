const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'findas-admin-backend' });
});

app.use('/auth', authRoutes);
app.use('/api', contentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

module.exports = app;
