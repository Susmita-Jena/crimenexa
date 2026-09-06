# CrimeNexa — AI-Powered Criminal Network Analysis (MVP)

Prototype built for **Smart India Hackathon 2026**, under the Ministry of Home Affairs / NCRB —
Women Safety Division problem statement on AI-powered criminal network analysis.

CrimeGraph takes raw, unstructured report text (FIR excerpts, call detail records, financial
transaction notes, surveillance reports, social-media intel, criminal history notes) and uses
**Claude** to extract entities and relationships, which are merged into a live network graph so
investigators can spot key influencers and suspicious patterns.

## How it works

1. An investigator pastes report text into the **Analyze Report** screen and picks a source type.
2. The backend sends the text to Claude with a structured-extraction prompt and gets back JSON:
   people, locations, organizations, vehicles, phone numbers, relationships, a summary, and risk
   flags.
3. Extracted entities are merged into a JSON store (deduplicated by name), building up a single
   growing network over every report analyzed.
4. The **Network Graph**, **People** (ranked by connections — "key influencers"), **Cases**, and
   **Dashboard** screens all read from that same store.

## Stack

- **Backend:** Node.js + Express, a flat JSON file (`backend/data/db.json`) as the data store —
  no database to install for the demo.
- **NLP extraction:** provider-agnostic. Swap between **Claude** (`@anthropic-ai/sdk`) and
  **Groq** (via the `openai` SDK, since Groq's API is OpenAI-compatible) with one environment
  variable — see "Choosing an LLM provider" below.
- **Frontend:** React (Create React App), plain CSS, React Router, Axios, `vis-network` /
  `vis-data` for the graph view.

### Choosing an LLM provider

`backend/services/nlpService.js` is the only place that decides which LLM does the extraction.
Set `LLM_PROVIDER` in `backend/.env` to either:

- `anthropic` (default) — uses Claude. Requires `ANTHROPIC_API_KEY`. Metered, no lasting free
  tier, but Anthropic gives new accounts a small one-time trial credit.
- `groq` — uses an open-weight model (Llama 3.3 70B by default) running on Groq's fast, cheap
  infrastructure. Requires `GROQ_API_KEY`. Groq has a genuinely usable **free tier** (no credit
  card, rate-limited but no spend), which makes it a good fit for building/demoing without
  burning paid credits.

Both providers are called through the exact same prompt (`backend/services/extractionPrompt.js`)
and return the exact same JSON shape, so nothing else in the app — routes, frontend, graph — needs
to know or care which one is active. This is also a live demonstration that the pipeline isn't
locked to one vendor: swapping providers is a one-line env change, not a code change.

## Project structure

```
crimegraph-mvp/
├── backend/
│   ├── server.js               Express app + routes
│   ├── db.js                   Flat-file JSON read/write helper
│   ├── services/
│   │   ├── nlpService.js       Picks the active provider based on LLM_PROVIDER
│   │   ├── extractionPrompt.js Shared extraction prompt + JSON parsing (used by every provider)
│   │   └── providers/
│   │       ├── anthropicProvider.js   Claude implementation
│   │       └── groqProvider.js        Groq implementation (OpenAI-compatible API)
│   ├── routes/                 analyze, graph, people, cases, reports
│   └── data/db.json            The "database" (git-ignored once you run it)
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.jsx, App.css, api.js
        ├── styles/theme.css    Design tokens (colors, fonts)
        └── components/         Hero, Navbar, Dashboard, AnalyzeReport, NetworkGraph, PeopleList, CaseList
```

## Running it locally

You'll need Node.js 18+ and an API key for whichever provider you're using — Anthropic
(https://console.anthropic.com/) or Groq (https://console.groq.com/, free tier, no card needed).

```bash
# 1. Install everything
npm run install:all

# 2. Configure the backend
cp backend/.env.example backend/.env
# then edit backend/.env: set LLM_PROVIDER (anthropic or groq) and paste in the matching API key

# 3. (optional) point the frontend at a non-default backend URL
cp frontend/.env.example frontend/.env

# 4. Run both backend and frontend together
npm run dev
```

- Backend: http://localhost:5000 (health check at `/api/health`)
- Frontend: http://localhost:3000

Or run them separately with `npm run start:backend` / `npm run start:frontend`.

## Trying it out

Paste something like this into **Analyze Report** (source type: FIR) and hit **Extract with
Claude**:

> On 14 March, informant reports that Ravi Kumar met Sanjay Mehta at the Old Town warehouse on
> MG Road. Ravi's phone (98765xxxxx) has been in repeated contact with Sanjay over the past two
> weeks. A white Maruti Swift (OD-05-XXXX) registered to Sanjay was seen at the same location.
> Sanjay is believed to be linked to Shakti Traders, a shell company under investigation for
> suspicious transactions.

You should see people, a location, a vehicle, an organization, and relationships extracted, then
reflected on the Network Graph and People screens.

## Deploying

**Backend → Render or Railway**
1. Push this repo to GitHub.
2. Create a new Web Service pointing at the `backend/` directory.
3. Build command: `npm install`. Start command: `npm start`.
4. Add an environment variable `ANTHROPIC_API_KEY` with your key.
5. Note the deployed URL, e.g. `https://crimegraph-backend.onrender.com`.

**Frontend → Vercel or Netlify**
1. Create a new project pointing at the `frontend/` directory.
2. Build command: `npm run build`. Output directory: `build`.
3. Add an environment variable `REACT_APP_API_URL` set to
   `https://<your-backend-url>/api`.
4. Deploy.

**Note on the data store:** `backend/data/db.json` lives on the backend's local disk. On most
free-tier hosts (Render, Railway) the filesystem is ephemeral, so data resets on redeploy/restart
— fine for a hackathon demo, but swap in a real database (Postgres/Mongo) before this goes beyond
a prototype.

## What's next (beyond MVP)

- Swap the JSON file for a real database once you need persistence across deploys.
- Add authentication (the Hero screen's "Enter Command Center" button is currently a demo gate,
  not real auth).
- Add bulk ingestion (upload multiple reports at once) instead of one-at-a-time paste.
- Add a map view for location entities (Leaflet, as in the original design) once the location
  data includes coordinates.
