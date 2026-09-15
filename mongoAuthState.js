const crypto = require('crypto');
const SessionAuth = require('./models/SessionAuth');
const { initAuthCreds } = require('@whiskeysockets/baileys');

const BufferJSON = {
  replacer: (k, v) => (Buffer.isBuffer(v) ? { type: 'Buffer', data: v.toString('base64') } : v),
  reviver: (k, v) => (v && typeof v === 'object' && v.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v),
};

let cachedCandidateKeys = null;
let lastEnvSignature = null;
const SALT = 'wa_session_auth_salt_v1';

function normalizeSecret(val) {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }
  return str;
}

function deriveKey(secret) {
  return crypto.scryptSync(secret, SALT, 32);
}

// Build candidate keys list: Primary key first, followed by legacy candidates (in memory)
function getCandidateKeys() {
  const primaryRaw = process.env.SESSION_ENCRYPTION_KEY;
  const primary = normalizeSecret(primaryRaw);
  if (!primary) {
    cachedCandidateKeys = null;
    lastEnvSignature = null;
    throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is missing. A secure key (min 16 chars) is required to encrypt/decrypt WhatsApp session credentials.');
  }
  if (primary.length < 16) {
    cachedCandidateKeys = null;
    lastEnvSignature = null;
    throw new Error('FATAL: SESSION_ENCRYPTION_KEY is too short (minimum 16 characters required for strong AES-256 key derivation).');
  }

  const authSecret = normalizeSecret(process.env.AUTH_SECRET);
  const mongoUri = normalizeSecret(process.env.MONGO_URI);
  const legacyDefault = 'wa-automation-secure-salt-key-2026';

  const envSig = `${primary}||${authSecret}||${mongoUri}`;
  if (cachedCandidateKeys && lastEnvSignature === envSig) {
    return cachedCandidateKeys;
  }

  const candidates = [];
  const seenSecrets = new Set();

  // 1. Primary candidate (SESSION_ENCRYPTION_KEY)
  candidates.push({
    label: 'primary',
    key: deriveKey(primary)
  });
  seenSecrets.add(primary);

  // 2. Legacy fallback candidate: legacy default salt key
  if (!seenSecrets.has(legacyDefault)) {
    candidates.push({
      label: 'legacy-default',
      key: deriveKey(legacyDefault)
    });
    seenSecrets.add(legacyDefault);
  }

  // 3. Legacy fallback candidate: AUTH_SECRET (if defined)
  if (authSecret && !seenSecrets.has(authSecret)) {
    candidates.push({
      label: 'AUTH_SECRET',
      key: deriveKey(authSecret)
    });
    seenSecrets.add(authSecret);
  }

  // 4. Legacy fallback candidate: MONGO_URI (if defined)
  if (mongoUri && !seenSecrets.has(mongoUri)) {
    candidates.push({
      label: 'MONGO_URI',
      key: deriveKey(mongoUri)
    });
    seenSecrets.add(mongoUri);
  }

  cachedCandidateKeys = candidates;
  lastEnvSignature = envSig;
  return candidates;
}

// Derive 32-byte key for AES-256-GCM encryption using primary key
function getEncryptionKey() {
  const candidates = getCandidateKeys();
  return candidates[0].key;
}

function encryptPayload(plaintext) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
      encrypted: true,
      iv: iv.toString('hex'),
      tag: authTag,
      data: encrypted
    };
  } catch (err) {
    console.error('[SessionAuth] Encryption error:', err.message);
    throw err;
  }
}

// In-memory multi-key decryption: strictly read-only, NO MongoDB writes
function decryptPayload(payload) {
  try {
    if (!payload || !payload.encrypted || !payload.iv || !payload.tag || !payload.data) {
      return null;
    }
    const candidates = getCandidateKeys();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.tag, 'hex');

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', candidate.key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(payload.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        if (i > 0) {
          console.log(`[SessionAuth] Successfully decrypted record with legacy key candidate: ${candidate.label}`);
        }
        return decrypted;
      } catch (err) {
        // Tag verification failed for this candidate, try next
      }
    }

    console.error('[SessionAuth] Decryption error: Unsupported state or unable to authenticate data with any known candidate key.');
    return null;
  } catch (err) {
    console.error('[SessionAuth] Decryption error:', err.message);
    return null;
  }
}

async function useMongoAuthState(sessionId) {
  const writeData = async (data, file) => {
    try {
      const key = `${sessionId}_${file}`;
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      // Encrypt sensitive WhatsApp credentials before saving to MongoDB
      const encryptedRecord = encryptPayload(jsonString);
      await SessionAuth.findOneAndUpdate(
        { id: key },
        { data: encryptedRecord },
        { upsert: true }
      );
    } catch (e) {
      console.error(`[SessionAuth] Error writing ${file}:`, e.message);
    }
  };

  const readData = async (file) => {
    try {
      const key = `${sessionId}_${file}`;
      const result = await SessionAuth.findOne({ id: key });
      if (!result || !result.data) return null;

      // Handle encrypted payload
      if (result.data.encrypted === true) {
        const decryptedJson = decryptPayload(result.data);
        if (!decryptedJson) {
          throw new Error(`Failed to decrypt ${key} with any candidate key`);
        }
        return JSON.parse(decryptedJson, BufferJSON.reviver);
      }

      // Backward-compatible for previously stored unencrypted data
      const jsonString = JSON.stringify(result.data);
      return JSON.parse(jsonString, BufferJSON.reviver);
    } catch (error) {
      if (file === 'creds.json') {
        throw error;
      }
      return null;
    }
  };

  const removeData = async (file) => {
    try {
      const key = `${sessionId}_${file}`;
      await SessionAuth.deleteOne({ id: key });
    } catch (error) {}
  };

  const normalizedSessionId = String(sessionId || '').trim();
  const isInvalidAdminUserSession = /^user-admin$/i.test(normalizedSessionId);
  if (isInvalidAdminUserSession) {
    const msg = `FATAL: Invalid Admin user session detected (sessionId='${sessionId}'). Admin must use canonical sessionId='admin'. Rejecting to prevent initAuthCreds() or credential pollution.`;
    console.error(`[SessionAuth] ${msg}`);
    throw new Error(msg);
  }

  const isAdmin = (sessionId === 'admin');
  const credsKey = `${sessionId}_creds.json`;

  // Verify whether SessionAuth contains existing credentials for this session
  let hasExistingCreds = false;
  try {
    hasExistingCreds = Boolean(await SessionAuth.exists({ id: credsKey }));
  } catch (err) {
    if (isAdmin) hasExistingCreds = true; // Err on the side of safety for Admin
  }

  // Read creds with bounded retry logic
  const retryDelays = [250, 500, 1000, 2000, 4000];
  let creds = null;
  let lastReadError = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      creds = await readData('creds.json');
      if (creds && (creds.me || !hasExistingCreds)) {
        break;
      }
      if (creds && isAdmin && creds.me) {
        break;
      }
      if (!hasExistingCreds && !isAdmin) {
        break;
      }
    } catch (err) {
      lastReadError = err;
      console.warn(`[SessionAuth] Attempt ${attempt + 1}/${retryDelays.length + 1} read ${credsKey} failed:`, err.message);
    }

    if (attempt < retryDelays.length && (hasExistingCreds || isAdmin)) {
      const delay = retryDelays[attempt];
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  if (isAdmin) {
    // Explicit Admin safety guard: Existing Admin session + read failure => THROW, NEVER initAuthCreds() / QR
    if (hasExistingCreds || lastReadError) {
      if (!creds || !creds.me) {
        const msg = lastReadError
          ? `FATAL: Failed to read existing Admin WhatsApp credentials (${credsKey}): ${lastReadError.message}`
          : `FATAL: Existing Admin WhatsApp credentials (${credsKey}) missing or incomplete. Aborting to prevent empty session / QR fallback.`;
        console.error(`[SessionAuth] ${msg}`);
        throw new Error(msg);
      }
    } else if (!creds) {
      creds = initAuthCreds();
    }
  } else {
    if (!creds) {
      creds = initAuthCreds();
    }
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              try {
                let value = await readData(`${type}-${id}.json`);
                data[id] = value;
              } catch (e) {
                data[id] = null;
              }
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const file = `${category}-${id}.json`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(creds, 'creds.json'),
  };
}

module.exports = { 
  useMongoAuthState,
  encryptPayload,
  decryptPayload,
  encryptData: encryptPayload,
  decryptData: decryptPayload
};