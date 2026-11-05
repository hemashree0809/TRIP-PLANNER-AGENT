'use strict';
/**
 * Express REST API — Travel Planner Agent
 * All routes for the travel planning agent
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const planner = require('./agent/planner');
const weather = require('./tools/weather');
const destinations = require('./tools/destinations');
const budget = require('./tools/budget');
const transport = require('./tools/transport');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Travel Planner Agent',
    model: config.ibm.granite.modelId,
    timestamp: new Date().toISOString(),
    ibmConfigured: !!(config.ibm.apiKey && config.ibm.projectId &&
      config.ibm.apiKey !== 'your_ibm_cloud_api_key_here'),
  });
});

// ─── Session Management ──────────────────────────────────────────────────────
app.post('/api/session', (req, res) => {
  const sessionId = planner.createSession();
  res.json({ sessionId, message: 'Travel planning session started. How can I help you plan your trip?' });
});

// ─── Chat / Agent Conversation ───────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const result = await planner.processMessage(sessionId, message);
    res.json(result);
  } catch (err) {
    console.error('[API /chat]', err.message);
    res.status(500).json({ error: 'Failed to process message', details: err.message });
  }
});

// ─── Full Trip Plan ──────────────────────────────────────────────────────────
app.post('/api/plan', async (req, res) => {
  const { destination, origin, duration, budget: budgetLevel, travelStyle, groupSize, interests, currency } = req.body;

  if (!destination) return res.status(400).json({ error: 'destination is required' });
  if (!duration) return res.status(400).json({ error: 'duration (number of days) is required' });

  try {
    const plan = await planner.planTrip({
      destination, origin, duration: parseInt(duration, 10),
      budget: budgetLevel, travelStyle, groupSize: parseInt(groupSize || 1, 10),
      interests, currency,
    });
    res.json(plan);
  } catch (err) {
    console.error('[API /plan]', err.message);
    res.status(500).json({ error: 'Failed to generate plan', details: err.message });
  }
});

// ─── Weather ─────────────────────────────────────────────────────────────────
app.get('/api/weather/:destination', async (req, res) => {
  try {
    const data = await weather.getWeather(req.params.destination);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ─── Destination Info ─────────────────────────────────────────────────────────
app.get('/api/destination/:country', async (req, res) => {
  try {
    const data = await destinations.getCountryInfo(req.params.country);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/destinations/popular', (req, res) => {
  const { style } = req.query;
  res.json(destinations.getPopularDestinations(style || 'all'));
});

app.get('/api/attractions/:city', async (req, res) => {
  try {
    const data = await destinations.searchAttractions(req.params.city, req.query.category || 'tourism');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Budget Estimator ─────────────────────────────────────────────────────────
app.post('/api/budget', (req, res) => {
  const { destination, duration, budgetLevel, groupSize, origin } = req.body;
  if (!destination || !duration) {
    return res.status(400).json({ error: 'destination and duration are required' });
  }
  const estimate = budget.estimateBudget({
    destination, duration: parseInt(duration, 10),
    budgetLevel: budgetLevel || 'moderate',
    groupSize: parseInt(groupSize || 1, 10),
    origin: origin || 'USA',
  });
  res.json(estimate);
});

// ─── Transport & Accommodation ────────────────────────────────────────────────
app.post('/api/transport', (req, res) => {
  const { origin, destination, duration } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required' });
  }
  const data = transport.getTransportOptions(origin, destination, duration || 7);
  res.json(data);
});

app.post('/api/accommodation', (req, res) => {
  const { destination, nights, budgetLevel } = req.body;
  if (!destination || !nights) {
    return res.status(400).json({ error: 'destination and nights are required' });
  }
  const data = transport.getAccommodationOptions(destination, parseInt(nights, 10), budgetLevel || 'moderate');
  res.json(data);
});

// ─── IBM Granite direct endpoints ────────────────────────────────────────────
const granite = require('./ibm/granite');

app.post('/api/itinerary', async (req, res) => {
  try {
    const itinerary = await granite.generateItinerary(req.body);
    res.json({ itinerary });
  } catch (err) {
    res.status(500).json({ error: 'Granite error', details: err.message });
  }
});

app.post('/api/recommendations', async (req, res) => {
  try {
    const recommendations = await granite.recommendDestinations(req.body);
    res.json({ recommendations });
  } catch (err) {
    res.status(500).json({ error: 'Granite error', details: err.message });
  }
});

app.post('/api/advice', async (req, res) => {
  const { destination, duration, season } = req.body;
  try {
    const advice = await granite.getTravelAdvice(destination, duration, season);
    res.json({ advice });
  } catch (err) {
    res.status(500).json({ error: 'Granite error', details: err.message });
  }
});

// ─── Catch-all: serve frontend ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.app.port;
app.listen(PORT, () => {
  console.log(`\n🌍  Travel Planner Agent running at http://localhost:${PORT}`);
  console.log(`📊  IBM Granite model: ${config.ibm.granite.modelId}`);
  console.log(`🔑  IBM API configured: ${config.ibm.apiKey && config.ibm.apiKey !== 'your_ibm_cloud_api_key_here' ? '✅ Yes' : '❌ No (set WATSONX_API_KEY in .env)'}\n`);
});

module.exports = app;
