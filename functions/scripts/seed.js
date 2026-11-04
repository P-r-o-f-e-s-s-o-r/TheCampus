/**
 * Seed quiz questions + bootstrap admin into Firestore / Auth.
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='secret' node scripts/seed.js
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (!getApps().length) {
  initializeApp({ projectId: "sapienscampus-97b6a" });
}

const db = getFirestore();
const auth = getAuth();

async function ensureAdminUser(email, password) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Auth user exists: ${email}`);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    if (!password) {
      console.log(`No Auth user for ${email}. Set ADMIN_PASSWORD to create one.`);
      return;
    }
    user = await auth.createUser({
      email,
      password,
      emailVerified: true,
    });
    console.log(`Created Auth user: ${email}`);
  }
  if (password) {
    await auth.updateUser(user.uid, { password });
    console.log(`Updated password for ${email}`);
  }
}

async function main() {
  const packPath = path.join(__dirname, "../../shared/questions.template.json");
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));

  const batch = db.batch();
  batch.set(
    db.collection("quizMeta").doc("config"),
    {
      version: pack.version,
      areas: pack.areas,
      pairs: pack.pairs,
      anchors: pack.anchors,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const existing = await db.collection("questions").get();
  existing.docs.forEach((doc) => batch.delete(doc.ref));

  pack.questions.forEach((q, index) => {
    batch.set(db.collection("questions").doc(q.id), {
      ...q,
      sortOrder: q.sortOrder ?? index,
      active: q.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const adminEmail = (process.env.ADMIN_EMAIL || "sapienscampus@gmail.com").toLowerCase();
  batch.set(db.collection("admins").doc(adminEmail), {
    email: adminEmail,
    role: "admin",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Drop legacy allowlist entry when rotating the primary admin.
  const legacyAdmin = "sapienscampus@gmail.com";
  if (adminEmail !== legacyAdmin) {
    batch.delete(db.collection("admins").doc(legacyAdmin));
  }

  await batch.commit();
  console.log(`Seeded ${pack.questions.length} questions and admin doc ${adminEmail}`);

  // Google Sign-In creates the Auth user on first login; password is optional.
  await ensureAdminUser(adminEmail, process.env.ADMIN_PASSWORD || null);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
