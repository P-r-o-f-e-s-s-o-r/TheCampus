"use strict";

/**
 * Local TEST fixture only. Serves the roadmap API from memory.
 * It does not use production Firestore and must not be pointed at live data.
 *
 *   node scripts/dev-roadmap-api.js
 */

const express = require("express");
const cors = require("cors");
const { createRouter } = require("../roadmap/routes");
const { RoadmapService } = require("../roadmap/service");
const { MemoryStore } = require("../roadmap/store");
const { loadSeed } = require("../roadmap/validate");

const users = new Map();
const service = new RoadmapService({ store: new MemoryStore(), catalog: loadSeed() });
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/questions", (_req, res) => {
  res.json({ version: "dev-fixture", questions: [], anchors: [], roleMap: {}, boosts: [], whatsappUrl: "" });
});
app.get("/api/colleges", (_req, res) => {
  res.json({ colleges: [], departments: [], whatsappUrl: "" });
});
app.get("/api/colleges/:id/stats", (req, res) => {
  res.json({ ok: true, collegeId: req.params.id, signedUpCount: 0 });
});

app.use(
  "/api",
  createRouter({
    service,
    countsTtlMs: 0,
    requireStudent(req, res, next) {
      const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
      if (!match) return res.status(401).json({ ok: false, error: "Missing bearer token" });
      req.student = { uid: "dev-student", email: "dev-student@example.com" };
      return next();
    },
    requireAdmin(req, res, next) {
      const match = String(req.headers.authorization || "").match(/^Bearer\s+dev-admin$/i);
      if (!match) return res.status(403).json({ ok: false, error: "Not an admin" });
      req.admin = { email: "dev-admin@example.com" };
      return next();
    },
    async resolveLearner(req) {
      const data = users.get(req.student.uid) || {
        roles: [
          { id: "builders", name: "Builders", key: "R", score: 8 },
          { id: "hackers", name: "Hackers", key: "I", score: 7 },
        ],
        selectedRole: { id: "builders", name: "Builders", key: "R", score: 8, animal: "Beaver" },
        scores: { R: 8, I: 7 },
      };
      users.set(req.student.uid, data);
      return {
        uid: req.student.uid,
        roles: data.roles,
        selectedRole: data.selectedRole,
        scores: data.scores,
        excluded: data.roadmapCountExcluded === true,
      };
    },
    async touchUser(uid, patch) {
      users.set(uid, { ...(users.get(uid) || {}), ...patch });
    },
  })
);

const port = Number(process.env.PORT || 8787);
app.listen(port, "127.0.0.1", () => {
  console.log(`TEST roadmap fixture listening on http://127.0.0.1:${port}`);
});
