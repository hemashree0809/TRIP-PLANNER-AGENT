# ✈️ Travel Planner Agent — IBM Granite + IBM Cloud

> An AI-powered travel planning assistant built on **IBM Granite (watsonx.ai)** with real-time weather, smart budgeting, destination discovery, and conversational itinerary generation.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Travel Planner Agent                      │
├────────────────┬────────────────┬───────────────────────────┤
│  IBM Granite   │  Real-time APIs│  Planning Tools            │
│  (watsonx.ai)  │                │                            │
│  ─────────     │  Open-Meteo    │  🗺️ Itinerary Generator    │
│  Itineraries   │  (Weather)     │  💰 Budget Calculator      │
│  Advice        │                │  🚀 Transport Planner      │
│  Recommends    │  REST Countries│  🏨 Accommodation Finder   │
│  Chat Q&A      │  (Country info)│  🌍 Destination Explorer   │
│                │                │                            │
│                │  Nominatim OSM │                            │
│                │  (Attractions) │                            │
└────────────────┴────────────────┴───────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Express REST API  │
              │   + Chat Interface  │
              └─────────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
npm install
```

### 2. Configure IBM Cloud (required for Granite AI)

1. Sign up at [IBM Cloud](https://cloud.ibm.com/) (free Lite account)
2. Create a **watsonx.ai** instance
3. Create a **Project** in watsonx.ai Studio
4. Generate an **API Key** from IAM → API Keys

Copy `.env` (already created) and fill in your credentials:
```bash
# Edit .env
WATSONX_API_KEY=your_actual_api_key
WATSONX_PROJECT_ID=your_actual_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

### 3. Run
```bash
npm start          # Production
npm run dev        # Development (auto-restart)
```

### 4. Open the App
```
http://localhost:3000
```

---

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `WATSONX_API_KEY` | IBM Cloud API Key | ✅ Yes |
| `WATSONX_PROJECT_ID` | watsonx.ai Project ID | ✅ Yes |
| `WATSONX_URL` | watsonx.ai endpoint | ✅ Yes |
| `GRANITE_MODEL_ID` | Model (default: `ibm/granite-13b-chat-v2`) | Optional |
| `PORT` | Server port (default: 3000) | Optional |
| `EXCHANGE_RATE_API_KEY` | For currency conversion | Optional |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health & IBM config status |
| `POST` | `/api/session` | Create a new planning session |
| `POST` | `/api/chat` | Conversational AI chat |
| `POST` | `/api/plan` | Generate full trip plan |
| `GET` | `/api/weather/:destination` | Real-time weather + 7-day forecast |
| `GET` | `/api/destination/:country` | Country info (currency, language, etc.) |
| `GET` | `/api/destinations/popular` | Popular destinations by travel style |
| `POST` | `/api/budget` | Trip budget estimation |
| `POST` | `/api/transport` | Transport options |
| `POST` | `/api/accommodation` | Accommodation options |
| `POST` | `/api/itinerary` | IBM Granite itinerary generation |
| `POST` | `/api/recommendations` | IBM Granite destination recommendations |
| `POST` | `/api/advice` | IBM Granite travel advice |

---

## 💡 Example API Usage

### Generate a full trip plan
```bash
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Kyoto, Japan",
    "origin": "New York",
    "duration": 7,
    "budget": "moderate",
    "travelStyle": "culture",
    "groupSize": 2,
    "interests": ["temples", "food", "gardens"]
  }'
```

### Chat with the agent
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the best time to visit Japan?"}'
```

### Check weather
```bash
curl http://localhost:3000/api/weather/Tokyo
```

---

## 🧪 Testing

```bash
npm test
```

Runs all offline tool tests (budget, transport, destinations) plus live weather API and IBM Granite integration tests (if credentials are set).

---

## 📁 Project Structure

```
travel-planner-agent/
├── .env                    # Environment variables (create from env.example)
├── env.example             # Template for .env
├── package.json
├── README.md
├── public/
│   └── index.html          # Frontend UI
└── src/
    ├── server.js           # Express API server + all routes
    ├── config.js           # Centralised configuration
    ├── ibm/
    │   └── granite.js      # IBM Granite integration (watsonx.ai)
    ├── agent/
    │   └── planner.js      # Agent orchestration & session management
    ├── tools/
    │   ├── weather.js      # Open-Meteo weather API
    │   ├── destinations.js # REST Countries + Nominatim
    │   ├── transport.js    # Transport & accommodation options
    │   └── budget.js       # Trip budget estimator
    └── test.js             # Test suite
```

---

## 🤖 IBM Granite Models Available

| Model ID | Size | Best For |
|---|---|---|
| `ibm/granite-13b-chat-v2` | 13B | Full conversations, detailed itineraries |
| `ibm/granite-13b-instruct-v2` | 13B | Structured responses, advice |
| `ibm/granite-3-8b-instruct` | 8B | Faster responses |
| `ibm/granite-3-2b-instruct` | 2B | Quickest, lightweight |

---

## 🌐 Free APIs Used (No Key Needed)

| API | Purpose |
|---|---|
| [Open-Meteo](https://open-meteo.com/) | Real-time weather + forecasts |
| [REST Countries](https://restcountries.com/) | Country info, currency, language |
| [Nominatim (OSM)](https://nominatim.openstreetmap.org/) | Geocoding + attractions |

---

## 📝 License

MIT — Edunet AI and Cloud Internship Project
