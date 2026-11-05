'use strict';
/**
 * Transport Tool
 * Provides context-aware transport options based on origin, destination,
 * distance and whether the trip is domestic or international.
 */

const TRANSPORT_OPTIONS = {
  flight: {
    label: 'Flight',
    icon: '✈️',
    pros: ['Fastest option', 'Best for long distances', 'Wide coverage'],
    cons: ['Most expensive', 'Baggage fees', 'Airport time overhead'],
    bookingTips: [
      'Book 6–8 weeks in advance for best prices',
      'Use Google Flights or MakeMyTrip/Cleartrip for comparison',
      'Tuesday/Wednesday flights are typically cheaper',
      'Set price alerts for your route',
    ],
  },
  train: {
    label: 'Train',
    icon: '🚂',
    pros: ['City centre to city centre', 'Scenic routes', 'No baggage restrictions', 'Comfortable for medium distances'],
    cons: ['Slower than flying', 'Advance booking needed for reserved seats'],
    bookingTips: [
      'Book on IRCTC (India) / National Rail / Eurail depending on country',
      'Overnight trains save on accommodation costs',
      'Tatkal quota available for last-minute bookings in India',
    ],
  },
  bus: {
    label: 'Bus',
    icon: '🚌',
    pros: ['Most affordable', 'Good for short to medium distances', 'Frequent departures'],
    cons: ['Slower than train or flight', 'Comfort varies by operator'],
    bookingTips: [
      'Book on RedBus, AbhiBus (India) or local operators',
      'AC sleeper buses are comfortable for overnight journeys',
      'Government (TNSTC/KSRTC) buses are cheapest',
    ],
  },
  car_rental: {
    label: 'Car / Cab',
    icon: '🚗',
    pros: ['Complete flexibility', 'Door-to-door convenience', 'Best for hill stations and rural areas'],
    cons: ['Fuel and toll costs', 'Driver fatigue on long routes', 'Parking costs in cities'],
    bookingTips: [
      'Self-drive on Zoomcar / Revv; chauffeur-driven on Savaari / Ola Outstation',
      'Negotiate rates for full-day or multi-day hire',
      'Ensure the vehicle is insured and driver is licensed',
    ],
  },
  ferry: {
    label: 'Ferry',
    icon: '⛴️',
    pros: ['Scenic experience', 'Only option for island destinations', 'Carries vehicles'],
    cons: ['Weather-dependent', 'Slow', 'Limited routes'],
    bookingTips: [
      'Book ahead for peak season island routes',
      'Check timetables as services can be infrequent',
    ],
  },
};

// ─── Region detection helpers ────────────────────────────────────────────────

const INDIAN_CITIES = [
  'chennai', 'ooty', 'coimbatore', 'bangalore', 'bengaluru', 'mumbai',
  'delhi', 'hyderabad', 'kolkata', 'pune', 'jaipur', 'ahmedabad', 'surat',
  'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam',
  'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik',
  'faridabad', 'meerut', 'rajkot', 'kalyan', 'varanasi', 'srinagar', 'aurangabad',
  'dhanbad', 'amritsar', 'allahabad', 'ranchi', 'howrah', 'jabalpur', 'gwalior',
  'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'chandigarh', 'guwahati',
  'solapur', 'hubballi', 'mysore', 'mysuru', 'tiruchirappalli', 'tiruchy',
  'coorg', 'kodaikanal', 'munnar', 'manali', 'shimla', 'mussoorie', 'nainital',
  'darjeeling', 'gangtok', 'pondicherry', 'puducherry', 'kochi', 'trivandrum',
  'thiruvananthapuram', 'kozhikode', 'calicut', 'mangalore', 'goa', 'panaji',
  'udaipur', 'pushkar', 'jaisalmer', 'ajmer', 'bikaner', 'mount abu',
  'hampi', 'hubli', 'belgaum', 'gulbarga', 'bijapur', 'tumkur',
  'tanjavur', 'thanjavur', 'vellore', 'salem', 'erode', 'tirunelveli', 'tuticorin',
  'india', 'tamil nadu', 'karnataka', 'kerala', 'andhra', 'telangana',
  'maharashtra', 'rajasthan', 'gujarat', 'punjab', 'haryana', 'uttarakhand',
  'himachal', 'west bengal', 'assam', 'odisha', 'orissa', 'bihar',
];

const EUROPEAN_CITIES = [
  'paris', 'london', 'berlin', 'rome', 'madrid', 'amsterdam', 'barcelona',
  'vienna', 'prague', 'zurich', 'munich', 'frankfurt', 'milan', 'brussels',
  'stockholm', 'oslo', 'copenhagen', 'helsinki', 'lisbon', 'athens',
];

function isIndianCity(name) {
  const n = name.toLowerCase();
  return INDIAN_CITIES.some((c) => n.includes(c));
}

function isEuropeanCity(name) {
  const n = name.toLowerCase();
  return EUROPEAN_CITIES.some((c) => n.includes(c));
}

/**
 * Classifies a pair of origin/destination and returns context metadata.
 */
function classifyRoute(origin, destination) {
  const bothIndian = isIndianCity(origin) && isIndianCity(destination);
  const bothEuropean = isEuropeanCity(origin) && isEuropeanCity(destination);
  const isDomestic = bothIndian || bothEuropean;
  const isInternational = !isDomestic;

  // Estimate rough distance for Indian routes to decide road vs rail vs air
  const shortHaulIndia = isShortHaulIndia(origin, destination);

  return { isDomestic, isInternational, bothIndian, bothEuropean, shortHaulIndia };
}

/**
 * Very short routes in India where road transport dominates (< ~350 km).
 * Chennai–Ooty is ~530 km by road but a well-known bus/train route.
 * We flag known short/medium routes explicitly.
 */
function isShortHaulIndia(origin, destination) {
  const o = origin.toLowerCase();
  const d = destination.toLowerCase();
  // Known pairs where no domestic flight exists or is practical
  const shortPairs = [
    ['chennai', 'ooty'], ['chennai', 'kodaikanal'], ['chennai', 'pondicherry'],
    ['bangalore', 'ooty'], ['bangalore', 'mysore'], ['bangalore', 'coorg'],
    ['bangalore', 'coimbatore'], ['mumbai', 'pune'], ['mumbai', 'goa'],
    ['delhi', 'agra'], ['delhi', 'jaipur'], ['delhi', 'shimla'],
    ['delhi', 'manali'], ['delhi', 'mussoorie'], ['delhi', 'nainital'],
  ];
  return shortPairs.some(([a, b]) =>
    (o.includes(a) && d.includes(b)) || (o.includes(b) && d.includes(a))
  );
}

/**
 * Returns context-aware transport options for a trip.
 */
function getTransportOptions(origin, destination, duration) {
  const route = classifyRoute(origin, destination);
  const options = [];
  let generalTips = [];

  if (route.bothIndian) {
    // ── Indian domestic routes ───────────────────────────────────────────────
    if (route.shortHaulIndia) {
      // Short/medium Indian route — no commercial flights, road/rail is primary
      options.push({
        ...TRANSPORT_OPTIONS.bus,
        recommended: true,
        note: `Direct bus services available (e.g. TNSTC, KSRTC, private operators). Estimated journey: 5–8 hours depending on route.`,
      });
      options.push({
        ...TRANSPORT_OPTIONS.train,
        recommended: false,
        note: 'Train + connecting bus or taxi may be required for hill stations. Check IRCTC for nearest rail junction.',
      });
      options.push({
        ...TRANSPORT_OPTIONS.car_rental,
        recommended: false,
        note: 'Self-drive or hired cab gives the most flexibility, especially for hill station roads.',
      });
    } else {
      // Longer domestic India route — train or flight
      options.push({
        ...TRANSPORT_OPTIONS.train,
        recommended: true,
        note: 'Indian Railways covers most city pairs. Book on IRCTC — Rajdhani/Shatabdi for major routes.',
      });
      options.push({
        ...TRANSPORT_OPTIONS.flight,
        recommended: false,
        note: 'Domestic flights available on IndiGo, Air India, SpiceJet. Book in advance for best fares.',
      });
      options.push({
        ...TRANSPORT_OPTIONS.bus,
        recommended: false,
        note: 'State-run and private overnight buses are a budget option.',
      });
    }

    generalTips = [
      'Carry a valid photo ID (Aadhaar, PAN, or passport) for train and flight check-in',
      'Book train tickets on IRCTC (irctc.co.in) — Tatkal quota for urgent bookings',
      'UPI (Google Pay, PhonePe, Paytm) is widely accepted across India',
      'Download Google Maps or Maps.me with offline maps before you go',
      'Local SIM cards offer cheap data — Jio, Airtel, Vi are widely available',
    ];

  } else if (route.bothEuropean) {
    // ── European domestic / intra-regional ──────────────────────────────────
    options.push({
      ...TRANSPORT_OPTIONS.train,
      recommended: true,
      note: 'High-speed rail (Eurostar, TGV, ICE, Thalys) is excellent for city pairs under 800 km.',
    });
    options.push({
      ...TRANSPORT_OPTIONS.bus,
      recommended: false,
      note: 'FlixBus and BlaBlaBus offer very cheap fares across Europe.',
    });
    options.push({
      ...TRANSPORT_OPTIONS.flight,
      recommended: false,
      note: 'Budget carriers (Ryanair, easyJet) for longer distances. Factor in airport transfer time.',
    });

    generalTips = [
      'Eurail Pass can be cost-effective for multi-city European trips',
      'Download offline maps before you go',
      'Validate train tickets before boarding — fines apply on many networks',
      'Most EU countries accept card payments widely',
    ];

  } else {
    // ── International route ──────────────────────────────────────────────────
    options.push({
      ...TRANSPORT_OPTIONS.flight,
      recommended: true,
      note: 'International flight is the primary option for this cross-border route.',
    });
    options.push({
      ...TRANSPORT_OPTIONS.train,
      recommended: false,
      note: 'Only if within a connected rail region (Europe, some Asia corridors).',
    });

    generalTips = [
      'Check visa requirements at least 4–6 weeks before departure',
      'Travel insurance is strongly recommended for international trips',
      'Notify your bank before travelling internationally to avoid card blocks',
      'Download offline maps (Google Maps / Maps.me) before you go',
      'Keep digital and physical copies of your passport and bookings',
    ];
  }

  return {
    origin,
    destination,
    duration,
    isDomestic: route.isDomestic,
    isInternational: route.isInternational,
    routeContext: route.bothIndian
      ? (route.shortHaulIndia ? 'india-short' : 'india-long')
      : route.bothEuropean ? 'europe' : 'international',
    options,
    generalTips,
  };
}

/**
 * Returns estimated budget ranges for accommodation, with local currency context.
 * @param {string} destination
 * @param {number} nights
 * @param {string} budgetLevel
 * @param {string} currency  - e.g. 'INR', 'USD', 'EUR'
 */
function getAccommodationOptions(destination, nights, budgetLevel = 'moderate', currency = 'USD') {
  const isIndia = isIndianCity(destination);

  let budgets;
  if (isIndia) {
    budgets = {
      budget: {
        label: 'Budget',
        options: [
          { type: 'Dormitory / Backpacker Hostel', priceRange: '₹300–₹800/night', sites: ['Hostelworld', 'Booking.com', 'Zostel'] },
          { type: 'Budget Hotel / Lodge', priceRange: '₹600–₹1,500/night', sites: ['Booking.com', 'MakeMyTrip', 'OYO'] },
          { type: 'Dharamshala / Guesthouse', priceRange: '₹200–₹600/night', sites: ['Local booking', 'Goibibo'] },
          { type: 'Home Stay', priceRange: '₹500–₹1,200/night', sites: ['Airbnb', 'StayVista', 'Local'] },
        ],
        estimatedPerNight: 800,
      },
      moderate: {
        label: 'Moderate',
        options: [
          { type: '3-Star Hotel', priceRange: '₹1,500–₹4,000/night', sites: ['Booking.com', 'MakeMyTrip', 'Cleartrip'] },
          { type: 'Airbnb / Home Stay', priceRange: '₹1,200–₹3,500/night', sites: ['Airbnb', 'StayVista'] },
          { type: 'Heritage / Boutique Hotel', priceRange: '₹2,000–₹5,000/night', sites: ['Booking.com', 'Goibibo'] },
          { type: 'Resort (mid-range)', priceRange: '₹2,500–₹6,000/night', sites: ['MakeMyTrip', 'Agoda'] },
        ],
        estimatedPerNight: 3000,
      },
      luxury: {
        label: 'Luxury',
        options: [
          { type: '4–5 Star Hotel / Resort', priceRange: '₹7,000–₹25,000+/night', sites: ['Taj Hotels', 'ITC', 'Marriott'] },
          { type: 'Heritage Palace Hotel', priceRange: '₹10,000–₹40,000+/night', sites: ['Neemrana Hotels', 'CGH Earth'] },
          { type: 'Luxury Forest / Hillside Resort', priceRange: '₹8,000–₹20,000+/night', sites: ['Booking.com', 'Ama Stays'] },
        ],
        estimatedPerNight: 12000,
      },
    };
  } else {
    budgets = {
      budget: {
        label: 'Budget',
        options: [
          { type: 'Hostel (Dormitory)', priceRange: '$8–$25/night', sites: ['Hostelworld', 'Booking.com', 'Hostelz'] },
          { type: 'Budget Hotel / Guesthouse', priceRange: '$20–$50/night', sites: ['Booking.com', 'Agoda'] },
          { type: 'Couchsurfing', priceRange: 'Free', sites: ['couchsurfing.com'] },
          { type: 'Camping / Glamping', priceRange: '$5–$30/night', sites: ['Hipcamp', 'Campspace'] },
        ],
        estimatedPerNight: 20,
      },
      moderate: {
        label: 'Moderate',
        options: [
          { type: '3-Star Hotel', priceRange: '$60–$150/night', sites: ['Booking.com', 'Hotels.com', 'Expedia'] },
          { type: 'Airbnb / Vacation Rental', priceRange: '$50–$120/night', sites: ['Airbnb', 'VRBO'] },
          { type: 'Boutique Hotel', priceRange: '$80–$180/night', sites: ['Mr & Mrs Smith', 'Design Hotels'] },
          { type: 'Serviced Apartment', priceRange: '$70–$150/night', sites: ['aparthotels.com', 'Booking.com'] },
        ],
        estimatedPerNight: 100,
      },
      luxury: {
        label: 'Luxury',
        options: [
          { type: '4–5 Star Hotel', priceRange: '$200–$600+/night', sites: ['Marriott', 'Hilton', 'Four Seasons'] },
          { type: 'Resort / Overwater Villa', priceRange: '$400–$2000+/night', sites: ['Leading Hotels', 'Relais & Châteaux'] },
          { type: 'Private Villa', priceRange: '$300–$1500+/night', sites: ['Onefinestay', 'Plum Guide'] },
        ],
        estimatedPerNight: 400,
      },
    };
  }

  const selected = budgets[budgetLevel] || budgets.moderate;
  const perNight = selected.estimatedPerNight;
  const totalLow = perNight * nights;
  const totalHigh = Math.round(totalLow * 1.5);
  const sym = isIndia ? '₹' : '$';

  return {
    destination,
    nights,
    budgetLevel: selected.label,
    currency: isIndia ? 'INR' : currency,
    options: selected.options,
    estimatedAccommodationCost: `${sym}${totalLow.toLocaleString('en-IN')} – ${sym}${totalHigh.toLocaleString('en-IN')}`,
    dataNote: 'Estimated price ranges based on typical rates. Actual prices vary by season, availability and provider.',
    bookingTips: isIndia
      ? [
          'Book via MakeMyTrip, Goibibo, or Booking.com for verified reviews',
          'OYO and FabHotels offer budget options with standardised quality',
          'Hill station rates spike during school holidays and long weekends',
          'Always read recent reviews — quality can vary significantly',
        ]
      : [
          'Book refundable rates when plans are uncertain',
          'Check hotel loyalty programs for points and free nights',
          'Read recent reviews — aim for 8.0+ on Booking.com',
          'Consider location carefully — central stays save transport costs',
        ],
  };
}

module.exports = { getTransportOptions, getAccommodationOptions, classifyRoute, isIndianCity };
