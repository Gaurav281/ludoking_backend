const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

let cachedClient = null;
let cachedDb = null;

// Local fallback DB for development without MONGODB_URI configured
class LocalCollection {
  constructor(name, getDb, saveDb) {
    this.name = name;
    this.getDb = getDb;
    this.saveDb = saveDb;
  }

  async findOne(query) {
    const data = this.getDb()[this.name] || [];
    return data.find(doc => this._matches(doc, query)) || null;
  }

  async find(query = {}) {
    const data = this.getDb()[this.name] || [];
    const results = data.filter(doc => this._matches(doc, query));
    return {
      toArray: async () => results,
      sort: (sortCriteria) => {
        const sorted = [...results].sort((a, b) => {
          for (const key in sortCriteria) {
            const dir = sortCriteria[key];
            if ((a[key] || 0) < (b[key] || 0)) return -1 * dir;
            if ((a[key] || 0) > (b[key] || 0)) return 1 * dir;
          }
          return 0;
        });
        return {
          toArray: async () => sorted
        };
      }
    };
  }

  async insertOne(doc) {
    const db = this.getDb();
    if (!db[this.name]) db[this.name] = [];
    const clone = JSON.parse(JSON.stringify(doc));
    db[this.name].push(clone);
    this.saveDb();
    return { insertedId: clone._id || clone.id || Date.now().toString() };
  }

  async updateOne(filter, update) {
    const db = this.getDb();
    if (!db[this.name]) db[this.name] = [];
    const index = db[this.name].findIndex(doc => this._matches(doc, filter));
    if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
    
    this._applyUpdate(db[this.name][index], update);
    this.saveDb();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const db = this.getDb();
    if (!db[this.name]) db[this.name] = [];
    const index = db[this.name].findIndex(doc => this._matches(doc, filter));
    if (index === -1) {
      if (options.upsert) {
        const newDoc = {};
        if (filter.roomCode) newDoc.roomCode = filter.roomCode;
        if (filter.code) newDoc.code = filter.code;
        this._applyUpdate(newDoc, update);
        db[this.name].push(newDoc);
        this.saveDb();
        return newDoc;
      }
      return null;
    }
    const original = JSON.parse(JSON.stringify(db[this.name][index]));
    this._applyUpdate(db[this.name][index], update);
    this.saveDb();
    return options.returnDocument === 'after' ? db[this.name][index] : original;
  }

  _matches(doc, query) {
    for (const [key, val] of Object.entries(query)) {
      if (key === '$or') {
        const orMatch = val.some(subQuery => this._matches(doc, subQuery));
        if (!orMatch) return false;
        continue;
      }
      // Support dot notation like 'player1.id'
      const actual = this._getNested(doc, key);
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        if ('$ne' in val && actual === val.$ne) return false;
        if ('$in' in val && !val.$in.includes(actual)) return false;
      } else {
        if (actual !== val) return false;
      }
    }
    return true;
  }

  _getNested(obj, path) {
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  _applyUpdate(doc, update) {
    if (update.$set) {
      for (const [key, val] of Object.entries(update.$set)) {
        const parts = key.split('.');
        let curr = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
      }
    }
    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + val;
      }
    }
    if (update.$push) {
      for (const [key, val] of Object.entries(update.$push)) {
        if (!Array.isArray(doc[key])) doc[key] = [];
        doc[key].push(val);
      }
    }
  }
}

class LocalDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { users: [], rooms: [], game_states: [], match_actions: [] };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this._save();
      }
    } catch (e) {
      console.error('Error loading local DB, initializing empty:', e);
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving local DB:', e);
    }
  }

  collection(name) {
    return new LocalCollection(
      name,
      () => {
        this._load();
        return this.data;
      },
      () => this._save()
    );
  }
}

let localDbInstance = null;

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || !!process.env.VERCEL;

  if (uri && uri.trim().startsWith('mongodb')) {
    if (cachedDb && cachedClient) {
      return { client: cachedClient, db: cachedDb, isAtlas: true };
    }
    try {
      const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      const db = process.env.MONGODB_DB ? client.db(process.env.MONGODB_DB) : client.db();

      // Ensure indexes once
      try {
        await db.collection('rooms').createIndex({ code: 1 }, { unique: true });
        await db.collection('match_actions').createIndex({ actionId: 1 }, { unique: true });
        await db.collection('users').createIndex({ userId: 1 }, { unique: true });
        await db.collection('game_states').createIndex({ roomCode: 1 }, { unique: true });
      } catch (idxErr) {
        // Index might already exist
      }

      cachedClient = client;
      cachedDb = db;
      return { client, db, isAtlas: true };
    } catch (err) {
      if (isProduction) {
        throw new Error(`Production database connection failed: ${err.message}. Local fallback is disabled in production.`);
      }
      console.warn('MongoDB connection failed, falling back to local storage:', err.message);
    }
  } else if (isProduction) {
    throw new Error('Production requires MONGODB_URI to be configured. Local JSON fallback is disabled in production.');
  }

  // Fallback local store (only enabled for offline development when not in production)
  if (!localDbInstance) {
    const dataDir = path.join(process.cwd(), '.data');
    const dbFile = path.join(dataDir, 'local_db.json');
    localDbInstance = new LocalDatabase(dbFile);
  }

  return { client: null, db: localDbInstance, isAtlas: false };
}

function extractUpdatedDoc(result) {
  if (!result) return null;
  if (result.value !== undefined) return result.value;
  return result;
}

module.exports = { connectToDatabase, extractUpdatedDoc };
