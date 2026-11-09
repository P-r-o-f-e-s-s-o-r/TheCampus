"use strict";

const { FieldPath } = require("firebase-admin/firestore");

function stripKey(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const copy = { ...doc };
  delete copy._key;
  return copy;
}

/**
 * In-memory store with serialized transactions.
 * Writes commit only if the transaction function returns.
 * Used by tests and the local fixture server. Not production data.
 */
class MemoryStore {
  constructor() {
    this.docs = new Map();
    this.queue = Promise.resolve();
  }

  transaction(fn) {
    const run = () => this._run(fn);
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async _run(fn) {
    const snapshot = new Map(this.docs);
    const writes = new Map();
    const tx = {
      async get(key) {
        const value = writes.has(key) ? writes.get(key) : snapshot.get(key);
        if (value == null) return null;
        return stripKey(structuredClone(value));
      },
      async set(key, value) {
        writes.set(key, { ...structuredClone(value), _key: key });
      },
      async del(key) {
        writes.set(key, null);
      },
      async list(prefix) {
        const keys = new Set([...snapshot.keys(), ...writes.keys()]);
        const out = [];
        for (const key of keys) {
          if (!key.startsWith(prefix)) continue;
          const value = writes.has(key) ? writes.get(key) : snapshot.get(key);
          if (value) out.push(stripKey(structuredClone(value)));
        }
        return out;
      },
    };
    const result = await fn(tx);
    for (const [key, value] of writes) {
      if (value == null) this.docs.delete(key);
      else this.docs.set(key, value);
    }
    return result;
  }

  listEnrolments() {
    const run = async () => {
      const out = [];
      for (const value of this.docs.values()) {
        if (value && value.kind === "enrolment") out.push(stripKey(structuredClone(value)));
      }
      return out;
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  /** Test-only drift injection. Not used by the service. */
  async putRaw(key, value) {
    this.docs.set(key, { ...structuredClone(value), _key: key });
  }
}

/**
 * Cloud Firestore Native `(default)` database.
 * Private docs live in `roadmapPrivate`; aggregates in `roadmapCounts`.
 * Client security rules deny all direct access. Callers must read before they write.
 */
class FirestoreStore {
  constructor(db) {
    this.db = db;
    this.privateCol = db.collection("roadmapPrivate");
    this.countsCol = db.collection("roadmapCounts");
    this.authorCol = db.collection("roadmapAuthoring");
  }

  ref(key) {
    if (key.startsWith("a:")) return this.authorCol.doc(key.slice(2).replace(/:/g, "__"));
    if (key.startsWith("c:")) return this.countsCol.doc(key.slice(2).replace(/:/g, "__"));
    if (key.startsWith("p:")) {
      const rest = key.slice(2);
      const splitAt = rest.indexOf(":");
      const uid = rest.slice(0, splitAt);
      const id = rest.slice(splitAt + 1).replace(/:/g, "__");
      return this.privateCol.doc(`${uid}__${id}`);
    }
    throw new Error(`Unknown roadmap key ${key}`);
  }

  transaction(fn) {
    return this.db.runTransaction(async (raw) => {
      const tx = {
        get: async (key) => {
          const snap = await raw.get(this.ref(key));
          return snap.exists ? stripKey(snap.data()) : null;
        },
        set: async (key, value) => {
          raw.set(this.ref(key), { ...value, _key: key });
        },
        del: async (key) => {
          raw.delete(this.ref(key));
        },
        list: async (prefix) => {
          if (!prefix.startsWith("p:")) throw new Error("Only private prefixes can be listed");
          const uid = prefix.slice(2).split(":")[0];
          const query = this.privateCol
            .orderBy(FieldPath.documentId())
            .startAt(`${uid}__`)
            .endAt(`${uid}__\uf8ff`);
          const snap = await raw.get(query);
          return snap.docs
            .map((doc) => doc.data())
            .filter((doc) => doc && doc._key && doc._key.startsWith(prefix))
            .map((doc) => stripKey(doc));
        },
      };
      return fn(tx);
    });
  }

  async listEnrolments() {
    const snap = await this.privateCol.where("kind", "==", "enrolment").get();
    return snap.docs.map((doc) => stripKey(doc.data()));
  }

  async putRaw() {
    throw new Error("Raw writes are not available on the Firestore store");
  }
}

module.exports = { MemoryStore, FirestoreStore };
