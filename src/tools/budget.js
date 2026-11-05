'use strict';
/**
 * Budget Calculator Tool
 * Estimates trip cost in the appropriate local currency.
 * - Indian destinations: INR (₹)
 * - All others: USD ($)
 * All prices are curated estimates and are clearly labelled as such.
 */

// ─── Daily cost baselines in USD ─────────────────────────────────────────────
const DAILY_ESTIMATES_USD = {
  budget:   { accommodation: 25,  food: 20,  transport: 10, activities: 15, misc: 10 },
  moderate: { accommodation: 100, food: 60,  transport: 30, activities: 50, misc: 30 },
  luxury:   { accommodation: 400, food: 200, transport: 100, activities: 150, misc: 100 },
};

// ─── Daily cost baselines in INR (for Indian destinations) ───────────────────
const DAILY_ESTIMATES_INR = {
  budget:   { accommodation: 700,  food: 400,  transport: 200, activities: 300, misc: 200 },
  moderate: { accommodation: 3000, food: 1200, transport: 600, activities: 1000, misc: 500 },
  luxury:   { accommodation: 12000, food: 4000, transport: 2000, activities: 3000, misc: 1500 },
};

// ─── Regional cost multipliers (relative to US baseline, USD only) ───────────
const REGION_MULTIPLIERS = {
  'western europe':  1.3,
  'northern europe': 1.5,
  'eastern europe':  0.6,
  'southeast asia':  0.4,
  'south asia':      0.3,
  'east asia':       0.9,
  'middle east':     1.1,
  'north america':   1.0,
  'central america': 0.5,
  'south america':   0.6,
  'africa':          0.5,
  'oceania':         1.4,
  'caribbean':       1.2,
};

// ─── Indian city/state detector ──────────────────────────────────────────────
const INDIAN_PATTERN = /ooty|ootikal|udagamandalam|chennai|coimbatore|bangalore|bengaluru|mumbai|delhi|hyderabad|kolkata|pune|jaipur|ahmedabad|surat|lucknow|nagpur|indore|bhopal|visakhapatnam|patna|vadodara|agra|nashik|varanasi|srinagar|amritsar|allahabad|ranchi|jabalpur|gwalior|vijayawada|jodhpur|madurai|raipur|kota|chandigarh|guwahati|mysore|mysuru|tiruchirappalli|tiruchy|coorg|kodaikanal|munnar|manali|shimla|mussoorie|nainital|darjeeling|gangtok|pondicherry|puducherry|kochi|trivandrum|thiruvananthapuram|kozhikode|calicut|mangalore|goa|panaji|udaipur|pushkar|jaisalmer|ajmer|bikaner|mount abu|hampi|india|tamil nadu|karnataka|kerala|andhra|telangana|maharashtra|rajasthan|gujarat|punjab|haryana|uttarakhand|himachal|west bengal|assam|odisha|bihar/i;

function isIndianDestination(destination) {
  return INDIAN_PATTERN.test(destination);
}

function getRegionMultiplier(destination) {
  const dest = destination.toLowerCase();
  if (/japan|korea|hong kong|singapore/.test(dest)) return REGION_MULTIPLIERS['east asia'];
  if (/thailand|vietnam|cambodia|myanmar|indonesia|bali|philippines|laos/.test(dest)) return REGION_MULTIPLIERS['southeast asia'];
  if (/france|germany|spain|italy|uk|england|switzerland|austria|netherlands|belgium/.test(dest)) return REGION_MULTIPLIERS['western europe'];
  if (/sweden|norway|denmark|finland|iceland/.test(dest)) return REGION_MULTIPLIERS['northern europe'];
  if (/poland|czech|hungary|romania|bulgaria|croatia|serbia/.test(dest)) return REGION_MULTIPLIERS['eastern europe'];
  if (/dubai|uae|qatar|bahrain|oman|saudi/.test(dest)) return REGION_MULTIPLIERS['middle east'];
  if (/mexico|belize|guatemala|costa rica/.test(dest)) return REGION_MULTIPLIERS['central america'];
  if (/brazil|argentina|colombia|peru|chile/.test(dest)) return REGION_MULTIPLIERS['south america'];
  if (/kenya|morocco|egypt|south africa|tanzania/.test(dest)) return REGION_MULTIPLIERS['africa'];
  if (/australia|new zealand/.test(dest)) return REGION_MULTIPLIERS['oceania'];
  if (/caribbean|bahamas|jamaica|cuba/.test(dest)) return REGION_MULTIPLIERS['caribbean'];
  return 1.0;
}

/**
 * Detects whether a trip is domestic within India.
 */
function isDomesticIndia(origin, destination) {
  if (!origin) return false;
  return isIndianDestination(origin) && isIndianDestination(destination);
}

/**
 * Estimates the total cost of a trip in the appropriate currency.
 */
function estimateBudget(params) {
  const {
    destination,
    duration,
    budgetLevel = 'moderate',
    groupSize = 1,
    origin = '',
  } = params;

  const useInr = isIndianDestination(destination);
  const domestic = isDomesticIndia(origin, destination);

  if (useInr) {
    return estimateBudgetINR({ destination, duration, budgetLevel, groupSize, domestic });
  }
  return estimateBudgetUSD({ destination, duration, budgetLevel, groupSize, origin });
}

// ─── INR budget estimator ─────────────────────────────────────────────────────

function estimateBudgetINR({ destination, duration, budgetLevel, groupSize, domestic }) {
  const base = DAILY_ESTIMATES_INR[budgetLevel] || DAILY_ESTIMATES_INR.moderate;

  const dailyCosts = {
    accommodation: base.accommodation,                            // per room/unit
    food:          base.food          * groupSize,
    localTransport: base.transport    * groupSize,
    activities:    base.activities    * groupSize,
    misc:          base.misc          * groupSize,
  };

  const totalDaily = Object.values(dailyCosts).reduce((a, b) => a + b, 0);
  const totalStay = totalDaily * duration;

  // Intercity travel cost (INR) — only if domestic India trip
  const travelCost = domestic
    ? estimateIndiaTravelCost(budgetLevel, groupSize)
    : 0;

  const grandTotal = totalStay + travelCost;
  const perPerson = Math.round(grandTotal / groupSize);

  const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return {
    destination,
    duration,
    groupSize,
    budgetLevel,
    currency: 'INR',
    currencySymbol: '₹',
    breakdown: {
      accommodation:  `${fmt(dailyCosts.accommodation)}/night × ${duration} nights = ${fmt(dailyCosts.accommodation * duration)}`,
      food:           `${fmt(dailyCosts.food)}/day × ${duration} days = ${fmt(dailyCosts.food * duration)}`,
      localTransport: `${fmt(dailyCosts.localTransport)}/day × ${duration} days = ${fmt(dailyCosts.localTransport * duration)}`,
      activities:     `${fmt(dailyCosts.activities)}/day × ${duration} days = ${fmt(dailyCosts.activities * duration)}`,
      misc:           `${fmt(dailyCosts.misc)}/day × ${duration} days = ${fmt(dailyCosts.misc * duration)}`,
      intercityTravel: domestic && travelCost > 0
        ? `~${fmt(travelCost)} (${groupSize} person(s), estimated)`
        : 'Not included',
    },
    totalEstimate: fmt(grandTotal),
    perPersonEstimate: fmt(perPerson),
    dataNote: 'Estimated prices in Indian Rupees (INR). Actual costs vary by season, booking lead time and provider.',
    savingTips: [
      'Travel mid-week to avoid weekend surcharges at hill stations',
      'Book accommodation 2–4 weeks ahead for better rates',
      'Use state-run TNSTC/KSRTC buses for cheapest intercity travel',
      'Eat at local "meals" restaurants (thali) for authentic food at ₹80–₹200',
      'Auto-rickshaws and local buses are cheap for getting around town',
      'Ooty and Nilgiris are budget-friendly compared to other hill stations',
    ],
  };
}

function estimateIndiaTravelCost(budgetLevel, groupSize) {
  // Rough round-trip estimate per person in INR for typical domestic India route
  const ROUTE_COSTS = {
    'budget':   { bus: 400 },
    'moderate': { bus: 600 },
    'luxury':   { bus: 1200 },
  };
  const costs = ROUTE_COSTS[budgetLevel] || ROUTE_COSTS.moderate;
  return costs.bus * 2 * groupSize; // return journey included
}

// ─── USD budget estimator ─────────────────────────────────────────────────────

function estimateBudgetUSD({ destination, duration, budgetLevel, groupSize, origin }) {
  const base = DAILY_ESTIMATES_USD[budgetLevel] || DAILY_ESTIMATES_USD.moderate;
  const multiplier = getRegionMultiplier(destination);

  const dailyCosts = {
    accommodation:  Math.round(base.accommodation  * multiplier),
    food:           Math.round(base.food           * multiplier * groupSize),
    localTransport: Math.round(base.transport      * multiplier * groupSize),
    activities:     Math.round(base.activities     * multiplier * groupSize),
    misc:           Math.round(base.misc           * multiplier * groupSize),
  };

  const totalDaily = Object.values(dailyCosts).reduce((a, b) => a + b, 0);
  const totalStay = totalDaily * duration;

  const flightCost = estimateFlightCostUSD(origin, destination, budgetLevel) * groupSize;
  const grandTotal = totalStay + flightCost;
  const perPerson = Math.round(grandTotal / groupSize);

  return {
    destination,
    duration,
    groupSize,
    budgetLevel,
    currency: 'USD',
    currencySymbol: '$',
    breakdown: {
      accommodation:  `$${dailyCosts.accommodation}/night × ${duration} nights = $${dailyCosts.accommodation * duration}`,
      food:           `$${dailyCosts.food}/day × ${duration} days = $${dailyCosts.food * duration}`,
      localTransport: `$${dailyCosts.localTransport}/day × ${duration} days = $${dailyCosts.localTransport * duration}`,
      activities:     `$${dailyCosts.activities}/day × ${duration} days = $${dailyCosts.activities * duration}`,
      misc:           `$${dailyCosts.misc}/day × ${duration} days = $${dailyCosts.misc * duration}`,
      flights:        `~$${flightCost} (${groupSize} person(s), estimated)`,
    },
    totalEstimate: `$${grandTotal.toLocaleString()}`,
    perPersonEstimate: `$${perPerson.toLocaleString()}`,
    dataNote: 'Estimated prices in USD. Actual costs vary by season, booking lead time and provider.',
    savingTips: [
      'Travel in shoulder season (spring/fall) for 20–40% savings',
      'Book accommodation and flights as a package for discounts',
      'Use local transport instead of taxis',
      'Cook some meals if staying in apartments or hostels',
      'Look for free walking tours and museum free days',
      'Use city tourist cards for bundled attraction savings',
    ],
  };
}

function estimateFlightCostUSD(origin, destination, budgetLevel) {
  const base = { budget: 300, moderate: 600, luxury: 1800 }[budgetLevel] || 600;
  return isLongHaulRoute(origin, destination) ? base * 2.5 : base;
}

function isLongHaulRoute(origin, destination) {
  const asianCities    = /japan|china|india|thailand|vietnam|korea|singapore|indonesia|bali|nepal/;
  const europeanCities = /france|germany|spain|italy|uk|england/;
  const americanCities = /usa|new york|los angeles|chicago|miami|toronto|canada/;
  const o = (origin || '').toLowerCase();
  const d = destination.toLowerCase();
  return (
    (americanCities.test(o) && (asianCities.test(d) || europeanCities.test(d))) ||
    (europeanCities.test(o) && asianCities.test(d))
  );
}

module.exports = { estimateBudget, isIndianDestination };
