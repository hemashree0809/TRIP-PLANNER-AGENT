'use strict';
/**
 * IBM Granite Integration via watsonx.ai REST API
 * Uses IBM Cloud Lite free tier — ibm/granite-13b-chat-v2
 */

const axios = require('axios');
const config = require('../config');

let _iamToken = null;
let _tokenExpiry = 0;

/**
 * Fetches a fresh IBM Cloud IAM Bearer token using the API key.
 * Caches the token until ~5 minutes before expiry.
 */
async function getIAMToken() {
  const now = Date.now();
  if (_iamToken && now < _tokenExpiry) return _iamToken;

  let response;
  try {
    response = await axios.post(
      config.ibm.iamUrl,
      new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: config.ibm.apiKey,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.errorMessage || err.message;
    // Do NOT include the API key value in any error message
    if (status === 400 || status === 401) {
      throw new Error(`IBM IAM authentication failed (HTTP ${status}): ${msg}. Check WATSONX_API_KEY in .env.`);
    }
    throw new Error(`IBM IAM token request failed: ${msg}`);
  }

  _iamToken = response.data.access_token;
  // expires_in is in seconds; refresh 5 min early
  _tokenExpiry = now + (response.data.expires_in - 300) * 1000;
  return _iamToken;
}

/**
 * Sends a prompt to IBM Granite via watsonx.ai Text Generation API.
 *
 * FIX: watsonx.ai rejects requests that combine decoding_method:'greedy'
 * with temperature or top_p parameters — those are only valid for 'sample'.
 * We use 'sample' decoding so temperature and top_p are honoured correctly.
 *
 * @param {string} systemPrompt  - Role/context for the model
 * @param {string} userMessage   - The user's travel query
 * @returns {Promise<string>}    - The model's text response
 */
async function askGranite(systemPrompt, userMessage) {
  const token = await getIAMToken();

  // Use the latest stable API version
  const url = `${config.ibm.watsonxUrl}/ml/v1/text/generation?version=2024-03-14`;

  // Granite chat format: <|system|>\n...\n<|user|>\n...\n<|assistant|>\n
  const formattedPrompt = `<|system|>\n${systemPrompt}\n<|user|>\n${userMessage}\n<|assistant|>\n`;

  const payload = {
    model_id: config.ibm.granite.modelId,
    project_id: config.ibm.projectId,
    input: formattedPrompt,
    parameters: {
      // 'sample' decoding allows temperature and top_p to be set.
      // 'greedy' ignores them but watsonx.ai returns HTTP 400 if they
      // are present in the payload alongside decoding_method:'greedy'.
      decoding_method: 'sample',
      max_new_tokens: config.ibm.granite.maxTokens,
      temperature: config.ibm.granite.temperature,
      top_p: config.ibm.granite.topP,
      repetition_penalty: 1.1,
      stop_sequences: ['<|user|>', '<|system|>'],
    },
  };

  let response;
  try {
    response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    const status = err.response?.status;
    const apiMsg = err.response?.data?.errors?.[0]?.message
      || err.response?.data?.message
      || err.message;
    if (status === 401) throw new Error(`Granite auth failed (401): ${apiMsg}`);
    if (status === 403) throw new Error(`Granite access denied (403): ${apiMsg}. Check WATSONX_PROJECT_ID.`);
    if (status === 400) throw new Error(`Granite bad request (400): ${apiMsg}`);
    if (status === 404) throw new Error(`Granite model not found (404): ${config.ibm.granite.modelId}. Check GRANITE_MODEL_ID.`);
    throw new Error(`Granite API error (HTTP ${status || 'network'}): ${apiMsg}`);
  }

  const generated = response.data?.results?.[0]?.generated_text || '';
  if (!generated.trim()) {
    throw new Error('Granite returned an empty response. The model may not support this prompt format or the token limit was exceeded.');
  }
  return generated.trim();
}

/**
 * Generates a full travel itinerary using IBM Granite.
 */
async function generateItinerary(preferences) {
  // Use the currency passed from the planner (which detects region),
  // falling back to USD only if genuinely unspecified.
  const currency = preferences.currency || 'USD';

  const system = `You are an expert travel planner assistant powered by IBM Granite.
Your job is to create detailed, personalized travel itineraries.
Always include: daily schedule, recommended activities, meal suggestions, estimated costs in ${currency}, and travel tips.
Respond in a clear, structured format with day-by-day breakdown.
Use the local context of the destination — recommend local transport modes, regional cuisine, and nearby attractions.
Do NOT suggest international transport (flights, visa advice) for short domestic trips within the same country.`;

  const user = `Create a detailed travel itinerary with the following preferences:
- Destination: ${preferences.destination}
- Origin: ${preferences.origin || 'Not specified'}
- Duration: ${preferences.duration} days
- Budget: ${preferences.budget || 'Moderate'} (${currency})
- Travel Style: ${preferences.travelStyle || 'Mixed (culture + leisure)'}
- Group: ${preferences.groupType || 'Solo'} (${preferences.groupSize || 1} person(s))
- Interests: ${(preferences.interests || ['sightseeing']).join(', ')}
- Special Requirements: ${preferences.specialRequirements || 'None'}
- Trip type: ${preferences.isDomestic ? 'Domestic (within same country)' : 'International'}

Provide a complete day-by-day itinerary with morning, afternoon, and evening activities.
Include realistic local transport options between the origin and destination.`;

  return askGranite(system, user);
}

/**
 * Gets destination recommendations based on user preferences.
 */
async function recommendDestinations(preferences) {
  const system = `You are a knowledgeable travel consultant powered by IBM Granite.
Recommend the best travel destinations based on user preferences.
For each destination, include: why it matches, best time to visit, must-see attractions, estimated budget range.`;

  const user = `Recommend 5 travel destinations based on these preferences:
- Budget: ${preferences.budget || 'Moderate'}
- Travel Style: ${preferences.travelStyle || 'Mixed'}
- Climate Preference: ${preferences.climate || 'Any'}
- Duration: ${preferences.duration || '7-10'} days
- From: ${preferences.origin || 'Anywhere'}
- Interests: ${(preferences.interests || ['culture', 'food']).join(', ')}
- Avoid: ${preferences.avoid || 'Nothing specified'}

List destinations with brief descriptions and why each is a great match.`;

  return askGranite(system, user);
}

/**
 * Provides packing and travel advice.
 */
async function getTravelAdvice(destination, duration, season) {
  const system = `You are a seasoned travel expert powered by IBM Granite. 
Give practical, actionable travel advice including packing lists, cultural tips, safety information, and local etiquette.`;

  const user = `Give comprehensive travel advice for:
- Destination: ${destination}
- Duration: ${duration} days
- Season/Month: ${season || 'Not specified'}

Include: packing list, visa/entry requirements overview, health tips, currency advice, cultural dos and don'ts, emergency contacts format, and top local phrases.`;

  return askGranite(system, user);
}

module.exports = { askGranite, generateItinerary, recommendDestinations, getTravelAdvice };
