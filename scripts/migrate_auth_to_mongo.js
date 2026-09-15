const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables if .env exists
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { useMongoAuthState, encryptPayload } = require('../mongoAuthState');
const SessionAuth = require('../models/SessionAuth');

const BufferJSON = {
  replacer: (k, v) => (Buffer.isBuffer(v) ? { type: 'Buffer', data: v.toString('base64') } : v),
  reviver: (k, v) => (v && typeof v === 'object' && v.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v),
};

async function migrateAuthToMongo() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required to run migration.');
  }

  const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.trim().length < 16) {
    throw new Error('SESSION_ENCRYPTION_KEY (min 16 chars) is required to encrypt credentials.');
  }

  const authDir = path.join(__dirname, '..', 'auth_info');
  if (!fs.existsSync(authDir)) {
    console.log('[Migration] No auth_info directory found to migrate.');
    return { migrated: 0, verified: false };
  }

  const credsFile = path.join(authDir, 'creds.json');
  if (!fs.existsSync(credsFile)) {
    console.log('[Migration] No creds.json found in auth_info.');
    return { migrated: 0, verified: false };
  }

  console.log('[Migration] Connecting to MongoDB...');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
  }
  console.log('[Migration] MongoDB Connected.');

  const files = fs.readdirSync(authDir).filter(f => f.endsWith('.json'));
  console.log(`[Migration] Found ${files.length} JSON auth files in auth_info/ to migrate.`);

  let successCount = 0;
  let errorCount = 0;
  const batchSize = 200;
  let currentBatch = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const filePath = path.join(authDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw, BufferJSON.reviver);
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      const encryptedRecord = encryptPayload(jsonString);
      const key = `admin_${file}`;

      currentBatch.push({
        updateOne: {
          filter: { id: key },
          update: { $set: { data: encryptedRecord } },
          upsert: true
        }
      });

      if (currentBatch.length >= batchSize || i === files.length - 1) {
        await SessionAuth.bulkWrite(currentBatch, { ordered: false });
        successCount += currentBatch.length;
        console.log(`[Migration] Migrated ${successCount}/${files.length} files...`);
        currentBatch = [];
      }
    } catch (err) {
      errorCount++;
      console.error(`[Migration] Error migrating ${file}:`, err.message);
    }
  }

  console.log(`[Migration] Successfully upserted ${successCount} files into MongoDB SessionAuth (errors: ${errorCount}).`);

  // Verification step: Read back using useMongoAuthState
  console.log('[Migration] Verifying credentials via useMongoAuthState("admin")...');
  const { state } = await useMongoAuthState('admin');

  if (!state || !state.creds || !state.creds.noiseKey) {
    throw new Error('Verification failed: Could not read back valid creds from MongoDB.');
  }

  const phone = state.creds.me?.id ? String(state.creds.me.id).split(':')[0].split('@')[0] : 'registered';
  console.log(`[Migration] ✅ Verification successful! Admin credentials securely verified for phone: +${phone}`);

  return { migrated: successCount, verified: true, phone };
}

if (require.main === module) {
  migrateAuthToMongo()
    .then(res => {
      console.log('[Migration] Complete:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migration] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { migrateAuthToMongo };
