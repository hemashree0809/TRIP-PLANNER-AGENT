'use strict';
/**
 * Weather Tool — uses Open-Meteo (free, no API key needed)
 * Fetches real-time and 7-day forecast for any destination
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config');

const cache = new NodeCache({ stdTTL: config.app.cacheTtl });

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Slight showers', 81: 'Moderate showers',
  82: 'Violent showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
};

/**
 * Geocodes a city name to lat/lon using Open-Meteo Geocoding API.
 */
async function geocode(city) {
  const cacheKey = `geo_${city.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const res = await axios.get(config.apis.geocodingUrl, {
    params: { name: city, count: 1, language: 'en', format: 'json' },
    headers: { 'User-Agent': 'TravelPlannerAgent/1.0' },
  });

  const loc = res.data?.results?.[0];
  if (!loc) throw new Error(`Location not found: ${city}`);

  const result = {
    name: loc.name,
    country: loc.country,
    latitude: loc.latitude,
    longitude: loc.longitude,
    timezone: loc.timezone,
  };
  cache.set(cacheKey, result);
  return result;
}

/**
 * Fetches current weather + 7-day forecast for a destination.
 */
async function getWeather(destination) {
  const cacheKey = `weather_${destination.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const location = await geocode(destination);

  const res = await axios.get(config.apis.weatherUrl, {
    params: {
      latitude: location.latitude,
      longitude: location.longitude,
      current: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weathercode'].join(','),
      daily: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max', 'weathercode'].join(','),
      timezone: location.timezone || 'auto',
      forecast_days: 7,
    },
  });

  const current = res.data.current;
  const daily = res.data.daily;

  const forecast = daily.time.map((date, i) => ({
    date,
    maxTemp: daily.temperature_2m_max[i],
    minTemp: daily.temperature_2m_min[i],
    precipitation: daily.precipitation_probability_max[i],
    condition: WMO_CODES[daily.weathercode[i]] || 'Unknown',
  }));

  const result = {
    location: { name: location.name, country: location.country },
    current: {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      condition: WMO_CODES[current.weathercode] || 'Unknown',
    },
    forecast,
    travelTip: buildWeatherTip(current, forecast),
  };

  cache.set(cacheKey, result);
  return result;
}

function buildWeatherTip(current, forecast) {
  const avgMax = forecast.reduce((s, d) => s + d.maxTemp, 0) / forecast.length;
  const avgRain = forecast.reduce((s, d) => s + d.precipitation, 0) / forecast.length;

  let tip = '';
  if (avgMax > 30) tip += 'Expect hot weather — carry sunscreen and stay hydrated. ';
  else if (avgMax < 10) tip += 'Cold weather ahead — pack warm layers. ';
  else tip += 'Mild temperatures — light layers recommended. ';

  if (avgRain > 60) tip += 'High chance of rain — bring a waterproof jacket and umbrella.';
  else if (avgRain > 30) tip += 'Some rain possible — a light rain jacket is useful.';
  else tip += 'Low rain probability — great for outdoor activities!';

  return tip;
}

module.exports = { getWeather, geocode };
