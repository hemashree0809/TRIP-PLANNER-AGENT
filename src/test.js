'use strict';
/**
 * Travel Planner Agent — Integration Test Suite
 * Tests all tools without requiring IBM credentials (offline-safe)
 */

require('dotenv').config();
const budget = require('./tools/budget');
const transport = require('./tools/transport');
const destinations = require('./tools/destinations');

// ANSI helpers
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(green(`  ✓ ${name}`));
    passed++;
  } else {
    console.log(red(`  ✗ ${name}`));
    failed++;
  }
}

async function runTests() {
  console.log(bold('\n🧪 Travel Planner Agent — Test Suite\n'));

  // ── Budget Tool ──────────────────────────────────────────────────────────────
  console.log(bold('1. Budget Calculator'));
  const b1 = budget.estimateBudget({ destination: 'Bali, Indonesia', duration: 7, budgetLevel: 'budget', groupSize: 2, origin: 'USA' });
  assert(typeof b1.totalEstimate === 'string', 'Returns totalEstimate string');
  assert(typeof b1.perPersonEstimate === 'string', 'Returns perPersonEstimate string');
  assert(b1.breakdown && Object.keys(b1.breakdown).length > 0, 'Returns cost breakdown');
  assert(Array.isArray(b1.savingTips) && b1.savingTips.length > 0, 'Returns saving tips');

  const b2 = budget.estimateBudget({ destination: 'Paris, France', duration: 5, budgetLevel: 'luxury', groupSize: 1, origin: 'New York' });
  assert(typeof b2.totalEstimate === 'string', 'Luxury Paris budget calculated');

  const b3 = budget.estimateBudget({ destination: 'Vietnam', duration: 14, budgetLevel: 'budget', groupSize: 4, origin: 'London' });
  assert(b3.groupSize === 4, 'Group size correctly stored');
  console.log(`     → Bali 7d budget (2pax): ${b1.totalEstimate} | Paris 5d luxury: ${b2.totalEstimate}`);

  // ── Transport Tool ───────────────────────────────────────────────────────────
  console.log(bold('\n2. Transport Options'));
  const t1 = transport.getTransportOptions('New York', 'Tokyo', 10);
  assert(t1.isInternational === true, 'Detects international route (NY → Tokyo)');
  assert(Array.isArray(t1.options) && t1.options.length > 0, 'Returns transport options');
  assert(t1.options.some((o) => o.label === 'Flight'), 'Includes Flight option');
  assert(Array.isArray(t1.generalTips), 'Returns general travel tips');

  const t2 = transport.getTransportOptions('Paris', 'London', 3);
  assert(Array.isArray(t2.options), 'Domestic/regional route handled');

  const acc = transport.getAccommodationOptions('Tokyo', 7, 'moderate');
  assert(acc.destination === 'Tokyo', 'Accommodation destination set correctly');
  assert(Array.isArray(acc.options) && acc.options.length > 0, 'Returns accommodation options');
  assert(typeof acc.estimatedAccommodationCost === 'string', 'Returns cost estimate');
  console.log(`     → Transport options for NY→Tokyo: ${t1.options.map((o) => o.label).join(', ')}`);
  console.log(`     → Accommodation in Tokyo (7 nights, moderate): ${acc.estimatedAccommodationCost}`);

  // ── Destinations Tool ────────────────────────────────────────────────────────
  console.log(bold('\n3. Destinations'));
  const d1 = destinations.getPopularDestinations('adventure');
  assert(Array.isArray(d1) && d1.length > 0, 'Adventure destinations returned');
  assert(d1[0].name && d1[0].highlight, 'Destination has name and highlight');

  const d2 = destinations.getPopularDestinations('all');
  assert(d2.length > 10, 'All destinations returns full list');

  const d3 = destinations.getPopularDestinations('beach');
  assert(d3.every((d) => d.name && d.highlight), 'All beach destinations have required fields');
  console.log(`     → Adventure destinations: ${d1.slice(0, 2).map((d) => d.name).join(', ')}`);
  console.log(`     → Total destinations in catalog: ${d2.length}`);

  // ── Weather Tool (live API) ──────────────────────────────────────────────────
  console.log(bold('\n4. Weather API (live — requires internet)'));
  try {
    const weather = require('./tools/weather');
    const w = await weather.getWeather('Paris');
    assert(w.current && typeof w.current.temperature === 'number', 'Current temperature returned');
    assert(Array.isArray(w.forecast) && w.forecast.length === 7, '7-day forecast returned');
    assert(typeof w.travelTip === 'string', 'Travel tip generated');
    console.log(`     → Paris weather: ${w.current.condition}, ${w.current.temperature}°C`);
    console.log(`     → Tip: ${w.travelTip}`);
  } catch (e) {
    console.log(yellow(`  ⚠ Weather API skipped: ${e.message}`));
  }

  // ── IBM Granite (requires credentials) ───────────────────────────────────────
  console.log(bold('\n5. IBM Granite — ibm/granite-4-h-small'));
  const config = require('./config');
  const axios = require('axios');
  if (!config.ibm.apiKey || config.ibm.apiKey === 'your_ibm_cloud_api_key_here') {
    console.log(yellow('  ⚠ Skipped — WATSONX_API_KEY not configured'));
    console.log(yellow('  ℹ Set WATSONX_API_KEY and WATSONX_PROJECT_ID in .env to enable'));
  } else if (!config.ibm.projectId || config.ibm.projectId === 'your_watsonx_project_id_here') {
    console.log(yellow('  ⚠ Skipped — WATSONX_PROJECT_ID not configured'));
  } else {
    try {
      const granite = require('./ibm/granite');
      const response = await granite.askGranite(
        'You are a travel assistant.',
        'Give a 1-sentence description of Ooty, India as a travel destination.'
      );
      assert(typeof response === 'string' && response.length > 10, 'IBM Granite returns valid text');
      console.log(green(`  ✓ IBM Granite responded successfully`));
      console.log(`     → Model: ${config.ibm.granite.modelId}`);
      console.log(`     → Response: ${response.slice(0, 120)}...`);
    } catch (e) {
      const is404 = e.message.includes('404');
      const is401or403 = e.message.includes('401') || e.message.includes('403');
      if (is404) {
        // Auto-detect available models to help the user pick the right one
        console.log(red(`  ✗ Model not found: ${config.ibm.granite.modelId}`));
        try {
          const iamR = await axios.post(
            'https://iam.cloud.ibm.com/identity/token',
            new URLSearchParams({ grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: config.ibm.apiKey }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
          const token = iamR.data.access_token;
          const modR = await axios.get(
            `${config.ibm.watsonxUrl}/ml/v1/foundation_model_specs?version=2024-03-14&limit=200`,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
          );
          const available = (modR.data.resources || [])
            .filter(m => m.task_ids && m.task_ids.includes('generation'))
            .map(m => m.model_id);
          console.log(yellow(`    Available text-generation models in your project:`));
          available.forEach(id => console.log(yellow(`      • ${id}`)));
          if (available.length > 0) {
            console.log(yellow(`    Fix: Set GRANITE_MODEL_ID=${available[0]} in .env`));
          }
        } catch { /* ignore secondary lookup errors */ }
        failed++;
      } else if (is401or403) {
        console.log(red(`  ✗ IBM credentials rejected: ${e.message.slice(0, 100)}`));
        console.log(yellow(`    Fix: Check WATSONX_API_KEY and WATSONX_PROJECT_ID in .env`));
        failed++;
      } else {
        console.log(red(`  ✗ IBM Granite error: ${e.message}`));
        failed++;
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  const total = passed + failed;
  console.log(bold(`Results: ${green(passed + ' passed')} | ${failed > 0 ? red(failed + ' failed') : '0 failed'} | ${total} total`));
  if (failed === 0) {
    console.log(green('\n✅ All offline tests passed! The agent is ready.'));
    console.log('\n📋 Next steps:');
    console.log('  1. Set WATSONX_API_KEY in .env (IBM Cloud → watsonx.ai)');
    console.log('  2. Set WATSONX_PROJECT_ID in .env (watsonx.ai project)');
    console.log('  3. Run: npm install && npm start');
    console.log('  4. Open: http://localhost:3000\n');
  } else {
    console.log(red('\n❌ Some tests failed. Review errors above.\n'));
  }
}

runTests().catch((err) => {
  console.error(red('\n[TEST FATAL] ' + err.message));
  process.exit(1);
});
