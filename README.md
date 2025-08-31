# Sentiment Analysis – Backend (Node.js + Express + MongoDB)

REST API powering **Chitti & Sana Learn Sentiment**.  
Implements two kid-friendly sentiment analyzers (Lexicon & Signals), a quiz score store, and simple examples storage.

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- Custom CORS (whitelist main Vercel origin; wildcard for others if desired)
- Deployed on Render (recommended)

## Endpoints

### Health
`GET /api/health` → `{ ok: true, time: <iso> }`

### Sentiment
- `POST /api/lexicon` → `{ label, score, details, tokens }`
- `POST /api/signals` → `{ label, score, details, tokens }`

Body for both:
```json
{ "text": "I love ice cream but homework is boring!" }
