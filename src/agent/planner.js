'use strict';
/**
 * Travel Planner Agent — Core Orchestration
 * Coordinates IBM Granite LLM with all travel tools
 */

const { v4: uuidv4 } = require('uuid');
const granite = require('../ibm/granite');
const weather = require('../tools/weather');
const destinations = require('../tools/destinations');
const transport = require('../tools/transport');
const budget = require('../tools/budget');
const { classifyRoute, isIndianCity } = require('../tools/transport');
const { isIndianDestination } = require('../tools/budget');

/**
 * Detects the appropriate currency for a trip based on destination and origin.
 * Returns { currency, currencySymbol, isDomestic }.
 */
function detectTripContext(destination, origin) {
  const destIsIndia = isIndianDestination(destination || '');
  const originIsIndia = origin ? isIndianDestination(origin) : destIsIndia;
  const isDomestic = destIsIndia && originIsIndia;

  if (destIsIndia) return { currency: 'INR', currencySymbol: '₹', isDomestic };

  // Could be extended for EUR, GBP, etc.
  return { currency: 'USD', currencySymbol: '$', isDomestic: false };
}

// In-memory session store (replace with Redis/DB for production)
const sessions = new Map();

/**
 * Creates a new planning session.
 */
function createSession() {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    id: sessionId,
    createdAt: new Date().toISOString(),
    messages: [],
    plan: {},
  });
  return sessionId;
}

/**
 * Main agent entry point — processes a user message in a session context.
 * Determines intent, calls relevant tools, and generates a Granite response.
 */
async function processMessage(sessionId, userMessage) {
  let session = sessions.get(sessionId);
  if (!session) {
    sessionId = createSession();
    session = sessions.get(sessionId);
  }

  // Add user message to history
  session.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });

  const intent = detectIntent(userMessage);
  let toolData = {};
  let errors = [];

  // --- Tool Execution based on intent ---
  try {
    if (intent.includes('weather') && session.plan.destination) {
      toolData.weather = await weather.getWeather(session.plan.destination);
    }

    if (intent.includes('destination_info') && session.plan.destination) {
      try {
        const countryName = extractCountryFromDestination(session.plan.destination);
        toolData.countryInfo = await destinations.getCountryInfo(countryName);
      } catch (e) {
        errors.push(`Country info unavailable: ${e.message}`);
      }
    }

    if (intent.includes('recommendations')) {
      toolData.popularDestinations = destinations.getPopularDestinations(
        session.plan.travelStyle || 'all'
      );
    }

    if (intent.includes('budget')) {
      if (session.plan.destination && session.plan.duration) {
        toolData.budgetEstimate = budget.estimateBudget({
          destination: session.plan.destination,
          duration: session.plan.duration,
          budgetLevel: session.plan.budgetLevel || 'moderate',
          groupSize: session.plan.groupSize || 1,
          origin: session.plan.origin || 'USA',
        });
      }
    }

    if (intent.includes('transport')) {
      if (session.plan.origin && session.plan.destination) {
        toolData.transport = transport.getTransportOptions(
          session.plan.origin,
          session.plan.destination,
          session.plan.duration
        );
        toolData.accommodation = transport.getAccommodationOptions(
          session.plan.destination,
          session.plan.duration || 7,
          session.plan.budgetLevel || 'moderate'
        );
      }
    }

    if (intent.includes('itinerary') && session.plan.destination && session.plan.duration) {
      toolData.itinerary = await granite.generateItinerary(session.plan);
    } else if (intent.includes('general')) {
      // General AI response without specific tool
    }
  } catch (err) {
    errors.push(err.message);
    console.error('[AGENT] Tool error:', err.message);
  }

  // Update session plan from extracted entities
  const extracted = extractEntities(userMessage);
  Object.assign(session.plan, extracted);

  // --- Build AI response ---
  let aiResponse;
  try {
    aiResponse = await buildGraniteResponse(userMessage, toolData, session, intent);
  } catch (err) {
    console.error('[AGENT] Granite error:', err.message);
    aiResponse = buildFallbackResponse(intent, toolData, session);
  }

  const assistantMessage = {
    role: 'assistant',
    content: aiResponse,
    toolData,
    intent,
    timestamp: new Date().toISOString(),
  };

  session.messages.push(assistantMessage);

  return {
    sessionId,
    response: aiResponse,
    toolData,
    intent,
    currentPlan: session.plan,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Orchestrates full trip planning pipeline in one call.
 */
async function planTrip(params) {
  const {
    destination,
    origin,
    duration,
    budget: budgetLevel,
    travelStyle,
    groupSize,
    interests,
  } = params;

  // Detect region context to set currency and domestic flag
  const tripCtx = detectTripContext(destination, origin);
  const currency = tripCtx.currency;
  const isDomestic = tripCtx.isDomestic;

  const results = await Promise.allSettled([
    weather.getWeather(destination),
    budget.estimateBudget({
      destination,
      duration,
      budgetLevel: budgetLevel || 'moderate',
      groupSize: groupSize || 1,
      origin: origin || '',
    }),
    granite.generateItinerary({
      destination,
      origin,
      duration,
      budget: budgetLevel,
      travelStyle,
      groupSize,
      interests,
      currency,
      isDomestic,
    }),
    granite.getTravelAdvice(destination, duration, getTravelSeason()),
  ]);

  const [weatherResult, budgetResult, itineraryResult, adviceResult] = results;

  const transportData = transport.getTransportOptions(origin || destination, destination, duration);
  const accommodationData = transport.getAccommodationOptions(
    destination, duration, budgetLevel || 'moderate', currency
  );

  // Capture Granite error details for the client — do NOT expose tokens/keys
  let itineraryValue = null;
  let graniteError = null;
  if (itineraryResult.status === 'fulfilled') {
    itineraryValue = itineraryResult.value;
  } else {
    const errMsg = itineraryResult.reason?.message || 'Unknown error';
    // Strip any accidental token leakage (bearer tokens are long base64 strings)
    graniteError = errMsg.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]');
    console.error('[PLANNER] Granite itinerary error:', graniteError);
  }

  let travelAdviceValue = null;
  let travelAdviceError = null;
  if (adviceResult.status === 'fulfilled') {
    travelAdviceValue = adviceResult.value;
  } else {
    travelAdviceError = adviceResult.reason?.message || 'Unknown error';
    console.error('[PLANNER] Granite advice error:', travelAdviceError);
  }

  return {
    destination,
    origin,
    duration,
    currency,
    isDomestic,
    weather: weatherResult.status === 'fulfilled'
      ? weatherResult.value
      : { error: weatherResult.reason?.message },
    budget: budgetResult.status === 'fulfilled'
      ? budgetResult.value
      : { error: budgetResult.reason?.message },
    // itinerary is null when Granite failed; graniteError carries the reason
    itinerary: itineraryValue,
    graniteError,
    travelAdvice: travelAdviceValue,
    travelAdviceError,
    transport: transportData,
    accommodation: accommodationData,
    popularAttractions: destinations.getPopularDestinations(travelStyle || 'culture').slice(0, 3),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectIntent(message) {
  const m = message.toLowerCase();
  const intents = [];

  if (/weather|climate|rain|temperature|forecast|hot|cold/.test(m)) intents.push('weather');
  if (/itinerary|schedule|plan|day.by.day|what to do|agenda/.test(m)) intents.push('itinerary');
  if (/budget|cost|price|expensive|cheap|afford|spend|money/.test(m)) intents.push('budget');
  if (/transport|flight|train|bus|car|drive|fly|travel from/.test(m)) intents.push('transport');
  if (/hotel|stay|accommodation|hostel|airbnb|resort|where to sleep/.test(m)) intents.push('transport');
  if (/recommend|suggest|destination|where should|best place/.test(m)) intents.push('recommendations');
  if (/country|currency|language|visa|info about/.test(m)) intents.push('destination_info');

  if (intents.length === 0) intents.push('general');
  return intents;
}

function extractEntities(message) {
  const entities = {};

  // Duration: "7 days", "2 weeks", "10 nights"
  const durationMatch = message.match(/(\d+)\s*(day|days|night|nights|week|weeks)/i);
  if (durationMatch) {
    const val = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    entities.duration = unit.startsWith('week') ? val * 7 : val;
  }

  // Group size
  const groupMatch = message.match(/(\d+)\s*(person|people|traveller|adult|guest)/i);
  if (groupMatch) entities.groupSize = parseInt(groupMatch[1]);

  // Budget level
  if (/\b(budget|cheap|backpacker|affordable)\b/i.test(message)) entities.budgetLevel = 'budget';
  else if (/\b(luxury|premium|5.?star|high.?end)\b/i.test(message)) entities.budgetLevel = 'luxury';
  else if (/\b(moderate|mid.?range|comfortable)\b/i.test(message)) entities.budgetLevel = 'moderate';

  // Travel style
  if (/\b(adventure|trekking|hiking|extreme)\b/i.test(message)) entities.travelStyle = 'adventure';
  else if (/\b(culture|history|museum|heritage)\b/i.test(message)) entities.travelStyle = 'culture';
  else if (/\b(beach|relax|sun|island)\b/i.test(message)) entities.travelStyle = 'beach';
  else if (/\b(luxury|spa|resort|fine dining)\b/i.test(message)) entities.travelStyle = 'luxury';

  return entities;
}

function extractCountryFromDestination(destination) {
  const parts = destination.split(',');
  return parts[parts.length - 1].trim();
}

function getTravelSeason() {
  const month = new Date().getMonth();
  if (month <= 1 || month === 11) return 'Winter (Dec-Feb)';
  if (month <= 4) return 'Spring (Mar-May)';
  if (month <= 7) return 'Summer (Jun-Aug)';
  return 'Autumn (Sep-Nov)';
}

async function buildGraniteResponse(userMessage, toolData, session, intents) {
  const contextSummary = buildContextSummary(toolData, session);

  const system = `You are TravelBot, an expert AI-powered Travel Planner assistant built on IBM Granite.
You help users plan amazing trips with personalized recommendations, detailed itineraries, and practical travel advice.
You have access to real-time weather data, budget calculators, destination guides, and transport information.
Always be helpful, enthusiastic, and specific. When you have tool data, reference it in your response.
Keep responses concise but informative. Use bullet points and structure for readability.`;

  const enrichedMessage = toolData && Object.keys(toolData).length > 0
    ? `User asked: "${userMessage}"\n\nAvailable data from tools:\n${contextSummary}\n\nBased on this data, provide a helpful, personalized response.`
    : userMessage;

  return granite.askGranite(system, enrichedMessage);
}

function buildContextSummary(toolData, session) {
  const parts = [];
  if (toolData.weather) {
    const w = toolData.weather;
    parts.push(`Weather in ${w.location?.name}: ${w.current?.condition}, ${w.current?.temperature}°C. Tip: ${w.travelTip}`);
  }
  if (toolData.budgetEstimate) {
    const b = toolData.budgetEstimate;
    parts.push(`Budget estimate: ${b.totalEstimate} total (${b.perPersonEstimate}/person) for ${b.duration} days`);
  }
  if (toolData.transport) {
    const t = toolData.transport;
    parts.push(`Transport from ${t.origin} to ${t.destination}: ${t.options.map((o) => o.label).join(', ')}`);
  }
  return parts.join('\n');
}

function buildFallbackResponse(intents, toolData, session) {
  // Structured fallback when Granite is unavailable
  const parts = ['Here is what I found for your travel query:\n'];

  if (toolData.weather) {
    const w = toolData.weather;
    parts.push(`🌤️ **Weather in ${w.location?.name || 'destination'}:**`);
    parts.push(`  Current: ${w.current?.condition}, ${w.current?.temperature}°C, Humidity: ${w.current?.humidity}%`);
    parts.push(`  ${w.travelTip}`);
  }

  if (toolData.budgetEstimate) {
    const b = toolData.budgetEstimate;
    parts.push(`\n💰 **Budget Estimate:**`);
    parts.push(`  Total: ${b.totalEstimate} | Per person: ${b.perPersonEstimate}`);
    parts.push(`  Accommodation: ${b.breakdown.accommodation}`);
    parts.push(`  Food: ${b.breakdown.food}`);
  }

  if (toolData.transport) {
    const t = toolData.transport;
    parts.push(`\n🚀 **Transport Options:**`);
    t.options.forEach((o) => parts.push(`  ${o.label}: ${o.note}`));
  }

  if (toolData.popularDestinations) {
    parts.push(`\n🌍 **Popular Destinations:**`);
    toolData.popularDestinations.slice(0, 3).forEach((d) =>
      parts.push(`  • ${d.name} — ${d.highlight}`)
    );
  }

  if (parts.length === 1) {
    parts.push("I'm ready to help plan your trip! Tell me your destination, travel dates, budget, and travel style to get started.");
  }

  return parts.join('\n');
}

module.exports = { createSession, processMessage, planTrip };
