const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const router = express.Router();

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true, index: true },
  username: { type: String, unique: true, index: true },
  mobile: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  sessions: [{
    tokenHash: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const OtpSchema = new mongoose.Schema({
  mobile: { type: String, index: true },
  otpHash: String,
  expiresAt: Date,
  lastSentAt: Date,
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const WhatsAppSessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, index: true },
  ownerUserId: { type: String, index: true },
  phone: String,
  role: { type: String, enum: ['admin', 'user'], default: 'admin' },
  authPath: String,
  status: { type: String, default: 'waiting' },
  lastConnectedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.models.WAUser || mongoose.model('WAUser', UserSchema);
const Otp = mongoose.models.WAOtp || mongoose.model('WAOtp', OtpSchema);
const WhatsAppSession = mongoose.models.WAWhatsAppSession || mongoose.model('WAWhatsAppSession', WhatsAppSessionSchema);

const cleanMobile = (value) => String(value || '').replace(/\D/g, '');
const randomDigits = (length) => {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, '0');
};

const hashText = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const hashPassword = async (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (err, key) => err ? reject(err) : resolve(key.toString('hex')));
  });
  return `scrypt$${salt}$${derived}`;
};

const verifyPassword = async (password, stored) => {
  try {
    const [, salt, expected] = String(stored).split('$');
    if (!salt || !expected) return false;
    const derived = await new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, 64, (err, key) => err ? reject(err) : resolve(key.toString('hex')));
    });
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
};

const makeUserId = async () => {
  for (;;) {
    const id = `USR${randomDigits(8)}`;
    if (!(await User.exists({ userId: id }))) return id;
  }
};

const makeUsername = async () => {
  for (;;) {
    const id = `user${randomDigits(7)}`;
    if (!(await User.exists({ username: id }))) return id;
  }
};

const makePassword = () => {
  const length = Math.max(8, Number(process.env.USER_PASSWORD_LENGTH || 10));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let value = '';
  for (let i = 0; i < length; i++) value += alphabet[crypto.randomInt(0, alphabet.length)];
  return value;
};

const tokenHash = (token) => hashText(token);

async function ensureAdminUser() {
  if (mongoose.connection.readyState !== 1) return null;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      userId: 'ADMIN',
      username,
      passwordHash: await hashPassword(password),
      role: 'admin',
      status: 'active',
    });
    console.log(`Admin user created: ${username}`);
  }
  await WhatsAppSession.updateOne(
    { sessionId: process.env.ADMIN_WHATSAPP_SESSION_ID || 'admin' },
    {
      $setOnInsert: {
        ownerUserId: admin.userId,
        role: 'admin',
        authPath: process.env.ADMIN_WHATSAPP_SESSION_DIR || './auth_info',
        status: 'waiting',
      },
    },
    { upsert: true }
  );
  return admin;
}

async function createLoginToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttlDays = Math.max(1, Number(process.env.AUTH_TOKEN_TTL_DAYS || 30));
  const expiresAt = new Date(Date.now() + ttlDays * 86400000);
  user.sessions = (user.sessions || []).filter(s => s.expiresAt && s.expiresAt > new Date()).slice(-4);
  user.sessions.push({ tokenHash: tokenHash(token), expiresAt });
  user.updatedAt = new Date();
  await user.save();
  return token;
}

async function authenticateToken(token) {
  if (!token) return null;
  const hash = tokenHash(token);
  const user = await User.findOne({ 'sessions.tokenHash': hash, status: 'active' });
  if (!user) return null;
  const session = user.sessions.find(s => s.tokenHash === hash);
  if (!session || !session.expiresAt || session.expiresAt <= new Date()) return null;
  return user;
}

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const user = await authenticateToken(token);
    if (!user) return res.status(401).json({ success: false, message: 'लॉगिन समाप्त हो गया है। फिर से लॉगिन करें।' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication service error' });
  }
}

router.post('/api/auth/login', async (req, res) => {
  try {
    await ensureAdminUser();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username और password आवश्यक हैं।' });

    const user = await User.findOne({ username, status: 'active' });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Username या password गलत है।' });
    }

    const token = await createLoginToken(user);
    res.json({
      success: true,
      user: { token, userId: user.userId, username: user.username, mobile: user.mobile || null, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login service error' });
  }
});

router.post('/api/auth/signup/request-otp', async (req, res) => {
  try {
    const mobile = cleanMobile(req.body?.mobile);
    if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ success: false, message: '10 अंकों का मोबाइल नंबर डालें।' });
    if (await User.exists({ mobile })) return res.status(409).json({ success: false, message: 'इस मोबाइल नंबर का account पहले से मौजूद है।' });

    const latest = await Otp.findOne({ mobile }).sort({ createdAt: -1 });
    if (latest?.lastSentAt && Date.now() - latest.lastSentAt.getTime() < 60000) {
      return res.status(429).json({ success: false, message: 'OTP दोबारा भेजने से पहले 60 सेकंड प्रतीक्षा करें।' });
    }

    const otp = randomDigits(Number(process.env.OTP_LENGTH || 6));
    const expiresAt = new Date(Date.now() + Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES || 5)) * 60000);
    await Otp.deleteMany({ mobile });
    await Otp.create({ mobile, otpHash: hashText(otp), expiresAt, lastSentAt: new Date() });

    if (typeof global.__waSendAdminText !== 'function') {
      return res.status(503).json({ success: false, message: 'Admin WhatsApp अभी connected नहीं है। पहले Admin WhatsApp scan करें।' });
    }

    await global.__waSendAdminText(mobile, `WA Control Center verification OTP: ${otp}\nयह OTP ${process.env.OTP_EXPIRY_MINUTES || 5} मिनट तक valid है।`);
    res.json({ success: true, message: 'OTP आपके WhatsApp नंबर पर भेज दिया गया है।' });
  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ success: false, message: error.message || 'OTP भेजने में समस्या हुई।' });
  }
});

router.post('/api/auth/signup/verify', async (req, res) => {
  try {
    const mobile = cleanMobile(req.body?.mobile);
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{10}$/.test(mobile) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'मोबाइल और 6 अंकों का OTP सही डालें।' });
    }

    const record = await Otp.findOne({ mobile });
    if (!record || record.expiresAt <= new Date() || record.verified) {
      return res.status(400).json({ success: false, message: 'OTP expired या invalid है।' });
    }
    if (record.attempts >= 5) return res.status(429).json({ success: false, message: 'OTP attempts की सीमा समाप्त हो गई है।' });

    record.attempts += 1;
    if (hashText(otp) !== record.otpHash) {
      await record.save();
      return res.status(400).json({ success: false, message: 'OTP गलत है।' });
    }
    record.verified = true;
    await record.save();

    if (await User.exists({ mobile })) return res.status(409).json({ success: false, message: 'Account पहले से मौजूद है।' });

    const userId = await makeUserId();
    const username = await makeUsername();
    const password = makePassword();
    const user = await User.create({
      userId,
      username,
      mobile,
      passwordHash: await hashPassword(password),
      role: 'user',
      status: 'active',
    });

    const token = await createLoginToken(user);
    await WhatsAppSession.updateOne(
      { sessionId: `user-${userId}` },
      { $setOnInsert: { ownerUserId: userId, role: 'user', authPath: `${process.env.WHATSAPP_SESSION_DIR || './whatsapp_sessions'}/${userId}`, status: 'waiting' } },
      { upsert: true }
    );

    if (typeof global.__waSendAdminText === 'function') {
      try {
        await global.__waSendAdminText(mobile, `WA Control Center account created.\nUser ID: ${userId}\nLogin ID: ${username}\nPassword: ${password}\nइन्हें सुरक्षित रखें।`);
      } catch (sendError) {
        console.error('Credential WhatsApp send failed:', sendError.message);
      }
    }

    res.json({ success: true, message: 'Account successfully created.', user: { token, userId, username, mobile, role: 'user' } });
  } catch (error) {
    console.error('Signup verify error:', error);
    res.status(500).json({ success: false, message: error.message || 'Account creation failed' });
  }
});

router.get('/api/auth/me', authRequired, async (req, res) => {
  res.json({ success: true, user: { userId: req.user.userId, username: req.user.username, mobile: req.user.mobile || null, role: req.user.role } });
});

router.post('/api/auth/logout', authRequired, async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  req.user.sessions = (req.user.sessions || []).filter(s => s.tokenHash !== tokenHash(token));
  await req.user.save();
  res.json({ success: true });
});

async function recordAdminWhatsAppSession(info = {}) {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return;
    await WhatsAppSession.updateOne(
      { sessionId: process.env.ADMIN_WHATSAPP_SESSION_ID || 'admin' },
      { $set: { ownerUserId: admin.userId, phone: info.phone || null, role: 'admin', authPath: process.env.ADMIN_WHATSAPP_SESSION_DIR || './auth_info', status: info.status || 'waiting', ...(info.status === 'connected' ? { lastConnectedAt: new Date() } : {}), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error('WhatsApp session record error:', error.message);
  }
}

module.exports = { router, authRequired, ensureAdminUser, recordAdminWhatsAppSession, User, WhatsAppSession };
