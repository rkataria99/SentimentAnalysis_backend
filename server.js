import express from "express";
import dotenv from "dotenv";
//import cors from "cors";
import { connectDB } from "./db.js";
import { Score } from "./models/Score.js";
import { Example } from "./models/Example.js";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

// CORS
// allow exactly the two origins mentioned
const normalize = (u) => (u ? u.replace(/\/$/, "") : u);
const ALLOWED = (process.env.ORIGIN ||
  "https://sentiment-analysis-frontend-one.vercel.app,http://localhost:5173")
  .split(",")
  .map((s) => normalize(s.trim()))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = normalize(req.headers.origin);

  if (!origin || ALLOWED.includes(origin)) {
    // send Access-Control-Allow-Origin only for allowed origins 
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // make caches/proxies vary by Origin
  res.setHeader("Vary", "Origin");

  // preflight allowances
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // quick preflight response
  }
  next();
});

/*const ORIGIN = process.env.ORIGIN || "http://localhost:5173";
app.use(cors({ origin: ORIGIN, credentials: true }));*/

// Simple tokenizer
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Lexicon approach (UNCHANGED)
const POS_WORDS = new Set([
  "love","awesome","great","good","wonderful","happy","delightful","smile","best","fresh","friendly","helpful",
  "proud", "joy","fantastic","exciting","excellent","amazing","like","fun","cool","nice","wow","brilliant","super"
]);
const NEG_WORDS = new Set([
  "hate","terrible","worst","sad","disappointed","bad","awful","angry","boring","horrible","sick","tired","ugly",
  "annoying","broken","slow","bug","error","cry","mad"
]);

function lexiconScore(text) {
  const tokens = tokenize(text);
  let score = 0;
  let details = [];
  for (const t of tokens) {
    if (POS_WORDS.has(t)) { score += 1; details.push({t, effect:+1}); }
    if (NEG_WORDS.has(t)) { score -= 1; details.push({t, effect:-1}); }
  }
  let label = "neutral";
  if (score > 0) label = "positive";
  if (score < 0) label = "negative";
  return { label, score, details, tokens };
}

// Signals approach
/*  Looks at obvious clues kids already know:
    - emojis 😊 ☹️ 👍 👎
    - exclamation counts
    - booster words (very/really/so/super/extremely)
    - softeners (slightly/kinda/somewhat/bit/little)
    - gives extra weight to the clause AFTER “but”
*/
const POS_EMOJIS = /(\:\)|:D|😊|🙂|😁|😄|😍|🥳|👍|❤️)/g;
const NEG_EMOJIS = /(\:\(|☹️|🙁|😞|😠|😢|😭|👎|💔)/g;
const BOOSTERS = new Set(["very","really","so","super","extremely"]);
const SOFTENERS = new Set(["slightly","kinda","somewhat","abit","bit","little"]);

function basicSignals(text) {
  const tokens = tokenize(text);
  let score = 0;
  let details = [];

  const posEmo = (text.match(POS_EMOJIS) || []).length;
  const negEmo = (text.match(NEG_EMOJIS) || []).length;
  if (posEmo) { score += posEmo; details.push({ t:"emoji+", effect:+posEmo }); }
  if (negEmo) { score -= negEmo; details.push({ t:"emoji-", effect:-negEmo }); }

  const exclam = Math.min((text.match(/!/g) || []).length, 3);
  if (exclam) { score += exclam * 0.5; details.push({ t:"!", effect:+exclam*0.5 }); }

  for (const t of tokens) {
    if (BOOSTERS.has(t)) { score += 0.5; details.push({ t, effect:+0.5 }); }
    if (SOFTENERS.has(t)) { score -= 0.25; details.push({ t, effect:-0.25 }); }
  }
  return { score, details };
}

function signalsScore(text) {
  const raw = text || "";
  let { score, details } = basicSignals(raw);

  // Emphasize clause after "but"
  const parts = raw.split(/\bbut\b/i);
  if (parts.length > 1) {
    const after = basicSignals(parts.slice(1).join(" but "));
    score = score*0.5 + after.score*1.5;
    details = [...details, { t:"(but→)", effect:"emphasis" }, ...after.details];
  }

  let label = "neutral";
  if (score > 0.75) label = "positive";
  else if (score < -0.75) label = "negative";

  return { label, score: Number(score.toFixed(2)), details, tokens: tokenize(raw) };
}

// ---------- Routes ----------
app.get("/api/health", (req,res)=>{
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/lexicon", (req,res)=>{
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text required"});
  const out = lexiconScore(text);
  res.json(out);
});

app.post("/api/signals", (req,res)=>{
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text required"});
  const out = signalsScore(text);
  res.json(out);
});

app.post("/api/examples", async (req,res)=>{
  try {
    const { text, label } = req.body || {};
    if (!text || !label) return res.status(400).json({ error: "text and label required"});
    const doc = await Example.create({ text, label });
    res.json({ ok: true, id: doc._id });
  } catch {
    res.status(500).json({ error: "could not save example" });
  }
});

app.get("/api/examples", async (req,res)=>{
  const last = await Example.find().sort({ createdAt: -1 }).limit(10);
  res.json(last);
});

app.post("/api/score", async (req,res)=>{
  try {
    const { name, score, total } = req.body || {};
    // for non-empty name
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (typeof score !== "number" || typeof total !== "number") {
      return res.status(400).json({ error: "score and total numbers required" });
    }

    // (Duplicate guard: )if same name+score+total was saved in last 2 minutes, reject
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const dup = await Score.findOne({
      name: name.trim(),
      score,
      total,
      createdAt: { $gte: twoMinutesAgo }
    }).lean();

    if (dup) {
      return res.status(409).json({ error: "Duplicate submission detected. Please wait a moment." });
    }

    const doc = await Score.create({ name: name.trim(), score, total });
    res.json({ ok: true, id: doc._id });
  } catch (e) {
    res.status(500).json({ error: "could not save score" });
  }
});

app.get("/api/scores", async (req,res)=>{
  const top = await Score.find().sort({ createdAt: -1 }).limit(10);
  res.json(top);
});

//  prevents “unknown” in UI and return JSON
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
connectDB(MONGO_URI).then(()=>{
  app.listen(PORT, ()=> console.log(" Server running on port", PORT));
});
