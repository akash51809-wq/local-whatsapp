const SessionAuth = require('../models/SessionAuth');
const { initAuthCreds } = require('@whiskeysockets/baileys');

const BufferJSON = {
  replacer: (k, v) => (Buffer.isBuffer(v) ? { type: 'Buffer', data: v.toString('base64') } : v),
  reviver: (k, v) => (v && typeof v === 'object' && v.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v),
};

async function useMongoAuthState(sessionId) {
  const writeData = async (data, file) => {
    try {
      const key = `${sessionId}_${file}`;
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      const jsonObject = JSON.parse(jsonString);
      await SessionAuth.findOneAndUpdate(
        { id: key },
        { data: jsonObject },
        { upsert: true }
      );
    } catch (e) {
      console.error(`Error writing ${file}:`, e);
    }
  };

  const readData = async (file) => {
    try {
      const key = `${sessionId}_${file}`;
      const result = await SessionAuth.findOne({ id: key });
      if (!result || !result.data) return null;
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

module.exports = { useMongoAuthState };