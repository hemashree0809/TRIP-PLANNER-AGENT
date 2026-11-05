'use strict';
require('dotenv').config();

const config = {
  ibm: {
    apiKey: process.env.WATSONX_API_KEY,
    projectId: process.env.WATSONX_PROJECT_ID,
    watsonxUrl: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
    iamUrl: process.env.IBM_IAM_URL || 'https://iam.cloud.ibm.com/identity/token',
    granite: {
      // ibm/granite-4-h-small is the recommended Granite model for chat/instruct tasks.
      // Run `npm test` to auto-detect which models are available in your project.
      // Override with GRANITE_MODEL_ID in .env to use a different model.
      modelId: process.env.GRANITE_MODEL_ID || 'ibm/granite-4-h-small',
      maxTokens: parseInt(process.env.GRANITE_MAX_TOKENS, 10) || 1024,
      temperature: parseFloat(process.env.GRANITE_TEMPERATURE) || 0.7,
      topP: parseFloat(process.env.GRANITE_TOP_P) || 0.9,
    },
  },
  apis: {
    weatherUrl: process.env.WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast',
    geocodingUrl: process.env.GEOCODING_API_URL || 'https://geocoding-api.open-meteo.com/v1/search',
    nominatimUrl: process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org',
    restCountriesUrl: process.env.RESTCOUNTRIES_API_URL || 'https://restcountries.com/v3.1',
    exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY,
    exchangeRateUrl: process.env.EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6',
  },
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
    cacheTtl: parseInt(process.env.CACHE_TTL, 10) || 3600,
  },
};

function validate() {
  if (!config.ibm.apiKey || config.ibm.apiKey === 'your_ibm_cloud_api_key_here') {
    console.warn('[CONFIG] WARNING: WATSONX_API_KEY is not set. IBM Granite calls will fail.');
  }
  if (!config.ibm.projectId || config.ibm.projectId === 'your_watsonx_project_id_here') {
    console.warn('[CONFIG] WARNING: WATSONX_PROJECT_ID is not set. IBM Granite calls will fail.');
  }
}

validate();
module.exports = config;
