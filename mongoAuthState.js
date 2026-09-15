const crypto = require('crypto');
const SessionAuth = require('./models/SessionAuth');
const { initAuthCreds } = require('@whiskeysockets/baileys');

const BufferJSON = {
  replacer: (k, v) => (Buffer.isBuffer(v) ? { type: 'Buffer', data: v.toString('base64') } : v),
  reviver: (k, v) => (v && typeof v === 'object' && v.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v),
};

let cachedDerivedKey = null;
let cachedSecret = null;

// Derive 32-byte key for AES-256-GCM encryption with caching for high performance
function getEncryptionKey() {
  const secret = process.env.SESSION_ENCRYPTION_KEY ? String(process.env.SESSION_ENCRYPTION_KEY).trim() : '';
  if (!secret) {
    cachedDerivedKey = null;
    cachedSecret = null;
    throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is missing. A secure key (min 16 chars) is required to encrypt/decrypt WhatsApp session credentials.');
  }
  if (secret.length < 16) {
    cachedDerivedKey = null;
    cachedSecret = null;
    throw new Error('FATAL: SESSION_ENCRYPTION_KEY is too short (minimum 16 characters required for strong AES-256 key derivation).');
  }
  if (cachedSecret === secret && cachedDerivedKey) {
    return cachedDerivedKey;
  }
  cachedDerivedKey = crypto.scryptSync(secret, 'wa_session_auth_salt_v1', 32);
  cachedSecret = secret;
  return cachedDerivedKey;
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

function decryptPayload(payload) {
  try {
    if (!payload || !payload.encrypted) {
      return null;
    }
    const key = getEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
        if (!decryptedJson) return null;
        return JSON.parse(decryptedJson, BufferJSON.reviver);
      }

      // Backward-compatible for previously stored unencrypted data
      const jsonString = JSON.stringify(result.data);
      return JSON.parse(jsonString, BufferJSON.reviver);
    } catch (error) {
      return null;
    }
  };

  const removeData = async (file) => {
    try {
      const key = `${sessionId}_${file}`;
      await SessionAuth.deleteOne({ id: key });
    } catch (error) {}
  };

  const creds = (await readData('creds.json')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}.json`);
              data[id] = value;
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