'use strict';
/**
 * Destinations Tool
 * Provides destination info: country details, currency, local attractions
 * Uses REST Countries API (free, no key) + Nominatim (OpenStreetMap)
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config');

const cache = new NodeCache({ stdTTL: config.app.cacheTtl });

/**
 * Fetches country information for a given country name or code.
 */
async function getCountryInfo(countryName) {
  const cacheKey = `country_${countryName.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const res = await axios.get(
    `${config.apis.restCountriesUrl}/search`,
    { params: { fields: 'name,capital,currencies,languages,flags,timezones,region,subregion,population,area' }, }
  );

  // The /search endpoint returns by name query — rebuild as /name route
  const nameRes = await axios.get(
    `${config.apis.restCountriesUrl}/name/${encodeURIComponent(countryName)}`,
    { params: { fields: 'name,capital,currencies,languages,flags,timezones,region,subregion,population,area' } }
  );

  const country = nameRes.data[0];
  const currencies = Object.values(country.currencies || {});
  const languages = Object.values(country.languages || {});

  const result = {
    name: country.name.common,
    officialName: country.name.official,
    capital: country.capital?.[0] || 'N/A',
    region: country.region,
    subregion: country.subregion,
    population: country.population?.toLocaleString(),
    currency: currencies[0] ? `${currencies[0].name} (${currencies[0].symbol})` : 'N/A',
    currencyCode: Object.keys(country.currencies || {})[0],
    languages: languages.join(', '),
    timezones: country.timezones,
    flag: country.flags?.png,
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Searches for places of interest in a destination using Nominatim.
 */
async function searchAttractions(city, category = 'tourism') {
  const cacheKey = `attractions_${city.toLowerCase()}_${category}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const CATEGORY_MAP = {
    tourism: 'tourism',
    food: 'amenity=restaurant',
    museum: 'tourism=museum',
    hotel: 'tourism=hotel',
    transport: 'public_transport',
  };

  const res = await axios.get(`${config.apis.nominatimUrl}/search`, {
    params: {
      q: `${category} in ${city}`,
      format: 'json',
      limit: 10,
      addressdetails: 1,
    },
    headers: { 'User-Agent': 'TravelPlannerAgent/1.0' },
  });

  const attractions = res.data.map((place) => ({
    name: place.display_name.split(',')[0],
    type: place.type,
    address: place.display_name,
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon),
  }));

  cache.set(cacheKey, attractions);
  return attractions;
}

/**
 * Returns popular destinations by travel style.
 */
function getPopularDestinations(travelStyle = 'all') {
  const destinations = {
    adventure: [
      { name: 'Queenstown, New Zealand', highlight: 'Bungee jumping, skydiving, extreme sports capital' },
      { name: 'Patagonia, Argentina/Chile', highlight: 'Trekking, glaciers, wild landscapes' },
      { name: 'Moab, USA', highlight: 'Red rock canyons, mountain biking, canyoneering' },
      { name: 'Nepal', highlight: 'Everest Base Camp, Himalayan trekking, white water rafting' },
      { name: 'Iceland', highlight: 'Northern lights, glacier hikes, volcanic landscapes' },
    ],
    culture: [
      { name: 'Kyoto, Japan', highlight: 'Ancient temples, geishas, traditional tea ceremony' },
      { name: 'Rome, Italy', highlight: 'Colosseum, Vatican, Renaissance art' },
      { name: 'Varanasi, India', highlight: 'Sacred Ganges, Hindu rituals, spiritual heritage' },
      { name: 'Marrakech, Morocco', highlight: 'Medinas, souks, Moorish architecture' },
      { name: 'Athens, Greece', highlight: 'Acropolis, ancient history, Mediterranean culture' },
    ],
    beach: [
      { name: 'Maldives', highlight: 'Crystal clear waters, overwater bungalows, coral reefs' },
      { name: 'Bali, Indonesia', highlight: 'Tropical beaches, surf spots, vibrant nightlife' },
      { name: 'Amalfi Coast, Italy', highlight: 'Scenic cliffs, azure sea, charming villages' },
      { name: 'Phuket, Thailand', highlight: 'White sand beaches, island hopping, affordable luxury' },
      { name: 'Zanzibar, Tanzania', highlight: 'Pristine beaches, historic Stone Town, snorkeling' },
    ],
    budget: [
      { name: 'Vietnam', highlight: 'Street food paradise, stunning scenery, very affordable' },
      { name: 'Portugal', highlight: 'Beautiful cities, great food, relatively cheap in Europe' },
      { name: 'Mexico', highlight: 'Ruins, beaches, culture, excellent value' },
      { name: 'Hungary (Budapest)', highlight: 'Stunning architecture, thermal baths, cheap eats' },
      { name: 'Georgia (Caucasus)', highlight: 'Wine country, mountains, incredibly affordable' },
    ],
    luxury: [
      { name: 'Dubai, UAE', highlight: 'Burj Khalifa, ultra-luxury hotels, world-class dining' },
      { name: 'Swiss Alps', highlight: 'Ski resorts, mountain scenery, world-class hospitality' },
      { name: 'French Riviera', highlight: 'Cannes, Monaco, yachts, Michelin-starred restaurants' },
      { name: 'Tokyo, Japan', highlight: 'Finest sushi, capsule hotels to palace hotels' },
      { name: 'Santorini, Greece', highlight: 'Iconic white-domed villas, sunset views, exclusive resorts' },
    ],
  };

  if (travelStyle === 'all') {
    return Object.entries(destinations).flatMap(([style, list]) =>
      list.map((d) => ({ ...d, style }))
    );
  }
  return destinations[travelStyle] || destinations.culture;
}

module.exports = { getCountryInfo, searchAttractions, getPopularDestinations };
