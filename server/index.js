import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initStore, listSlots, upsertVotes, getVotesByPerson, getSummary } from "./lib/storeSupabase.js";
import { sanitizeName, validateVotesPayload } from "./lib/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

await initStore();

const app = express();
app.set("trust proxy", true);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"]
      }
    }
  })
);
app.use(express.json({ limit: "32kb" }));

app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));

app.get("/api/slots", (req, res) => {
  res.json({ slots: listSlots() });
});

app.get("/api/votes", (req, res) => {
  const rawName = typeof req.query.name === "string" ? req.query.name : "";
  const name = sanitizeName(rawName);
  if (!name) return res.status(400).json({ error: "Missing name" });

  getVotesByPerson(name)
    .then((votes) => res.json({ name, votes }))
    .catch((err) => res.status(500).json({ error: err.message || "Server error" }));
});

app.post("/api/votes", (req, res) => {
  const validation = validateVotesPayload(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const name = sanitizeName(validation.value.name);
  if (!name) return res.status(400).json({ error: "Invalid name" });

  upsertVotes(name, validation.value.votes)
    .then((result) => res.json({ ok: true, name, ...result }))
    .catch((err) => res.status(500).json({ error: err.message || "Server error" }));
});

app.get("/api/summary", (req, res) => {
  getSummary()
    .then((summary) => res.json(summary))
    .catch((err) => res.status(500).json({ error: err.message || "Server error" }));
});

app.get("/healthz", (req, res) => res.type("text").send("ok"));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`mini-doodle running on http://localhost:${PORT}`);
});
