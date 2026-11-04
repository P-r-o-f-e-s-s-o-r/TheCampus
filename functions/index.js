const fs = require("fs");
const path = require("path");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const express = require("express");
const cors = require("cors");

setGlobalOptions({ region: "asia-south1" });

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();
const app = express();
const router = express.Router();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const QUESTIONS = db.collection("questions");
const QUIZ_META = db.collection("quizMeta").doc("config");
const WAITLIST = db.collection("waitlist");
const ADMINS = db.collection("admins");
/** Always-allowed admin Google accounts (in addition to Firestore `admins`). */
const BOOTSTRAP_ADMIN_EMAILS = new Set(["sapienscampus@gmail.com"]);

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeQuestion(input = {}, existingId) {
  const id = String(input.id || existingId || "").trim();
  if (!id) throw Object.assign(new Error("Question id is required"), { status: 400 });
  if (!input.area || !/^[RIASEC]$/.test(input.area)) {
    throw Object.assign(new Error("area must be one of R,I,A,S,E,C"), { status: 400 });
  }
  if (!input.title || !String(input.title).trim()) {
    throw Object.assign(new Error("title is required"), { status: 400 });
  }
  return {
    id,
    area: input.area,
    title: String(input.title).trim(),
    cue: String(input.cue || "").trim(),
    icon: String(input.icon || "spark").trim(),
    scene: String(input.scene || "").trim(),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    active: input.active !== false,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function packFromDocs(meta, questions) {
  return {
    version: meta?.version || "sc-discovery-1",
    areas: meta?.areas || {},
    pairs: meta?.pairs || {},
    anchors: meta?.anchors || [
      { value: 0, label: "Not for me", detail: "I would pass", face: "pass", color: "pink" },
      { value: 1, label: "Maybe", detail: "Open to trying", face: "maybe", color: "paper" },
      { value: 2, label: "I’d love it", detail: "Count me in", face: "love", color: "green" },
    ],
    questions: questions
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  };
}

async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Missing bearer token" });
    }
    const decoded = await auth.verifyIdToken(match[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) {
      return res.status(403).json({ ok: false, error: "Admin email required" });
    }
    const allowlisted =
      BOOTSTRAP_ADMIN_EMAILS.has(email) || (await ADMINS.doc(email).get()).exists;
    if (!allowlisted) {
      return res.status(403).json({ ok: false, error: "Not an admin" });
    }
    req.admin = { uid: decoded.uid, email };
    return next();
  } catch (_err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

async function seedFromTemplateIfEmpty() {
  const existing = await QUESTIONS.limit(1).get();
  if (!existing.empty) return false;

  const packPath = path.join(__dirname, "data", "questions.template.json");
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  const batch = db.batch();

  batch.set(
    QUIZ_META,
    {
      version: pack.version,
      areas: pack.areas,
      pairs: pack.pairs,
      anchors: pack.anchors,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  pack.questions.forEach((q, index) => {
    batch.set(QUESTIONS.doc(q.id), {
      ...q,
      sortOrder: q.sortOrder ?? index,
      active: q.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const adminEmail = "sapienscampus@gmail.com";
  batch.set(ADMINS.doc(adminEmail), {
    email: adminEmail,
    role: "admin",
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return true;
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sapienscampus-api" });
});

router.get("/questions", async (_req, res) => {
  try {
    await seedFromTemplateIfEmpty();
    const [metaSnap, questionSnap] = await Promise.all([
      QUIZ_META.get(),
      QUESTIONS.where("active", "==", true).get(),
    ]);
    const pack = packFromDocs(metaSnap.data(), questionSnap.docs);
    if (!pack.questions.length) {
      return res.status(503).json({ ok: false, error: "Questions are not seeded yet" });
    }
    res.json({
      ok: true,
      version: pack.version,
      areas: pack.areas,
      pairs: pack.pairs,
      anchors: pack.anchors,
      questions: pack.questions.map(({ id, area, title, cue, icon, scene, sortOrder }) => ({
        id,
        area,
        title,
        cue,
        icon,
        scene,
        sortOrder,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to load questions" });
  }
});

router.post("/waitlist", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const consent = Boolean(req.body?.consent);
    const company = String(req.body?.company || "").trim();
    const answers = req.body?.answers ?? null;
    const scores = req.body?.scores ?? null;

    if (company) {
      return res.status(200).json({ ok: true, status: "joined" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (!consent) {
      return res.status(400).json({ ok: false, error: "Consent required" });
    }

    const existing = await WAITLIST.where("email", "==", email).limit(1).get();
    const payload = {
      email,
      consent: true,
      answers: answers && typeof answers === "object" ? answers : null,
      scores: scores && typeof scores === "object" ? scores : null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing.empty) {
      await WAITLIST.add({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await existing.docs[0].ref.set(payload, { merge: true });
    }

    res.json({ ok: true, status: "joined" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to join waitlist" });
  }
});

router.get("/admin/waitlist", requireAdmin, async (_req, res) => {
  try {
    const snap = await WAITLIST.orderBy("createdAt", "desc").limit(500).get();
    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        consent: data.consent,
        scores: data.scores || null,
        hasAnswers: Boolean(data.answers),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    });
    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to list waitlist" });
  }
});

router.get("/admin/questions", requireAdmin, async (_req, res) => {
  try {
    const [metaSnap, questionSnap] = await Promise.all([
      QUIZ_META.get(),
      QUESTIONS.get(),
    ]);
    res.json({ ok: true, pack: packFromDocs(metaSnap.data(), questionSnap.docs) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to list questions" });
  }
});

router.post("/admin/questions", requireAdmin, async (req, res) => {
  try {
    const question = normalizeQuestion(req.body);
    question.createdAt = FieldValue.serverTimestamp();
    await QUESTIONS.doc(question.id).set(question, { merge: true });
    res.status(201).json({ ok: true, question });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || "Create failed" });
  }
});

router.put("/admin/questions/:id", requireAdmin, async (req, res) => {
  try {
    const question = normalizeQuestion({ ...req.body, id: req.params.id }, req.params.id);
    const ref = QUESTIONS.doc(question.id);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ ok: false, error: "Question not found" });
    }
    await ref.set(question, { merge: true });
    res.json({ ok: true, question });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || "Update failed" });
  }
});

router.delete("/admin/questions/:id", requireAdmin, async (req, res) => {
  try {
    const ref = QUESTIONS.doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ ok: false, error: "Question not found" });
    }
    await ref.delete();
    res.json({ ok: true });
  } catch (_err) {
    res.status(500).json({ ok: false, error: "Delete failed" });
  }
});

router.get("/admin/questions/export", requireAdmin, async (_req, res) => {
  try {
    const [metaSnap, questionSnap] = await Promise.all([
      QUIZ_META.get(),
      QUESTIONS.get(),
    ]);
    const pack = packFromDocs(metaSnap.data(), questionSnap.docs);
    res.json({
      ok: true,
      pack: {
        version: pack.version,
        areas: pack.areas,
        pairs: pack.pairs,
        anchors: pack.anchors,
        questions: pack.questions.map(
          ({ id, area, title, cue, icon, scene, sortOrder, active }) => ({
            id,
            area,
            title,
            cue,
            icon,
            scene,
            sortOrder,
            active: active !== false,
          })
        ),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Export failed" });
  }
});

router.post("/admin/questions/import", requireAdmin, async (req, res) => {
  try {
    const pack = req.body?.pack || req.body;
    if (!pack || !Array.isArray(pack.questions)) {
      return res.status(400).json({ ok: false, error: "pack.questions array required" });
    }

    const batch = db.batch();
    batch.set(
      QUIZ_META,
      {
        version: pack.version || "sc-discovery-1",
        areas: pack.areas || {},
        pairs: pack.pairs || {},
        anchors: pack.anchors || [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const existing = await QUESTIONS.get();
    existing.docs.forEach((doc) => batch.delete(doc.ref));

    pack.questions.forEach((raw, index) => {
      const question = normalizeQuestion({
        ...raw,
        sortOrder: raw.sortOrder ?? index,
      });
      question.createdAt = FieldValue.serverTimestamp();
      batch.set(QUESTIONS.doc(question.id), question);
    });

    await batch.commit();
    res.json({ ok: true, imported: pack.questions.length });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.message || "Import failed" });
  }
});

app.use("/api", router);
app.use(router);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error" });
});

exports.api = onRequest(
  {
    region: "asia-south1",
    cors: true,
    invoker: "public",
  },
  app
);
