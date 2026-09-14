const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const router = express.Router();

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true, index: true },
  username: { type: String, unique: true, index: true },
  name: { type: String, default: '' },
  mobile: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  apiToken: { type: String, unique: true, sparse: true, index: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
  plan: { type: String, default: 'Standard' },
  status: { type: String, enum: ['active', 'blocked', 'inactive'], default: 'active' },
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
const generateApiToken = () => 'wa_' + crypto.randomBytes(12).toString('hex');

async function ensureAdminUser() {
  if (mongoose.connection.readyState !== 1) return null;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      userId: 'ADMIN', username, passwordHash: await hashPassword(password), apiToken: generateApiToken(), role: 'admin', status: 'active',
    });
    console.log(`Admin user created: ${username}`);
  } else if (!admin.apiToken) {
    admin.apiToken = generateApiToken();
    await admin.save();
  }
  await WhatsAppSession.updateOne(
    { sessionId: process.env.ADMIN_WHATSAPP_SESSION_ID || 'admin' },
    { $setOnInsert: { ownerUserId: admin.userId, role: 'admin', authPath: process.env.ADMIN_WHATSAPP_SESSION_DIR || './auth_info', status: 'waiting' } },
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
    
    // Support login using username, mobile number, or userId
    const user = await User.findOne({ 
      $or: [
        { username },
        { mobile: username },
        { userId: username }
      ], 
      status: 'active' 
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Username या password गलत है।' });
    }
    if ((user.mobile === '8840457632' || user.username === '8840457632' || user.username === 'admin') && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    const token = await createLoginToken(user);
    res.json({ success: true, user: { token, userId: user.userId, username: user.username, mobile: user.mobile || null, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login service error' });
  }
});

function getLiveAdminWhatsAppSender() {
  if (typeof global.__waSendAdminText === 'function') {
    return global.__waSendAdminText;
  }
  const socket = global.__waAdminSocket;
  if (socket && typeof socket.sendMessage === 'function') {
    return async (number, text) => {
      let digits = String(number || '').replace(/\D/g, '');
      if (digits.length === 10) digits = `91${digits}`;
      return socket.sendMessage(`${digits}@s.whatsapp.net`, { text: String(text) });
    };
  }
  return null;
}

async function waitForAdminWhatsAppSender(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const sender = getLiveAdminWhatsAppSender();
    if (sender) return sender;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

/* =========================================================
   OTP-BASED SIGNUP (Credentials sent via Admin WhatsApp)
========================================================= */

router.post('/api/auth/signup/request-otp', async (req, res) => {
  try {
    const mobile = cleanMobile(req.body?.mobile);
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: '10 अंकों का मोबाइल नंबर डालें।' });
    }
    if (await User.exists({ $or: [{ mobile }, { username: mobile }] })) {
      return res.status(409).json({ success: false, message: 'इस मोबाइल नंबर का account पहले से मौजूद है।' });
    }

    const latest = await Otp.findOne({ mobile }).sort({ createdAt: -1 });
    if (latest?.lastSentAt && Date.now() - latest.lastSentAt.getTime() < 60000) {
      return res.status(429).json({ success: false, message: 'OTP दोबारा भेजने से पहले 60 सेकंड प्रतीक्षा करें।' });
    }

    const sender = await waitForAdminWhatsAppSender(8000);
    if (!sender) {
      return res.status(503).json({ 
        success: false, 
        message: 'Admin WhatsApp अभी connected नहीं है। कृपया कुछ देर बाद प्रयास करें।' 
      });
    }

    const otp = randomDigits(Number(process.env.OTP_LENGTH || 6));
    const expiresAt = new Date(Date.now() + Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES || 5)) * 60000);
    await Otp.deleteMany({ mobile });
    await Otp.create({ mobile, otpHash: hashText(otp), expiresAt, lastSentAt: new Date() });

    await sender(mobile, `WA Control Center verification OTP: ${otp}\nयह OTP ${process.env.OTP_EXPIRY_MINUTES || 5} मिनट तक valid है।`);
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
    if (record.attempts >= 5) {
      return res.status(429).json({ success: false, message: 'OTP attempts की सीमा समाप्त हो गई है।' });
    }

    record.attempts += 1;
    if (hashText(otp) !== record.otpHash) {
      await record.save();
      return res.status(400).json({ success: false, message: 'OTP गलत है।' });
    }
    record.verified = true;
    await record.save();

    if (await User.exists({ $or: [{ mobile }, { username: mobile }] })) {
      return res.status(409).json({ success: false, message: 'Account पहले से मौजूद है।' });
    }

    const userId = await makeUserId();
    const username = mobile; // User ID = Registered mobile number
    const password = makePassword(); // Random password

    const user = await User.create({
      userId,
      username,
      mobile,
      passwordHash: await hashPassword(password),
      apiToken: generateApiToken(),
      role: 'user',
      status: 'active'
    });

    // Create a WhatsApp session record for this user
    await WhatsAppSession.updateOne(
      { sessionId: `user-${userId}` },
      { 
        $setOnInsert: { 
          ownerUserId: userId, 
          role: 'user', 
          status: 'waiting', 
          createdAt: new Date() 
        }, 
        $set: { updatedAt: new Date() } 
      },
      { upsert: true }
    );

    // Send credentials to user's registered WhatsApp via Admin WhatsApp
    const sender = getLiveAdminWhatsAppSender();
    let sentOnWhatsApp = false;
    if (sender) {
      try {
        await sender(
          mobile,
          `*WA Control Center Account Created!* 🎉\n\nLogin ID: *${username}*\nPassword: *${password}*\n\nकृपया लॉगिन करने के बाद Dashboard से अपना WhatsApp scan करें। सुरक्षा के लिए आप Settings से पासवर्ड बदल सकते हैं।`
        );
        sentOnWhatsApp = true;
      } catch (sendErr) {
        console.error('Failed to send credentials via WhatsApp:', sendErr.message);
      }
    }

    // Do NOT return password on screen — credentials sent to WhatsApp!
    res.json({
      success: true,
      message: 'Account सफलतापूर्वक बन गया है! Login ID और Password आपके WhatsApp नंबर पर भेज दिया गया है।',
      sentOnWhatsApp,
      user: {
        userId,
        username,
        mobile
      }
    });
  } catch (error) {
    console.error('Signup verify error:', error);
    res.status(500).json({ success: false, message: error.message || 'Account creation failed' });
  }
});

/* =========================================================
   USER PASSWORD CHANGE (in user panel)
========================================================= */

router.post('/api/auth/change-password', authRequired, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'वर्तमान और नया पासवर्ड दोनों आवश्यक हैं।' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' });
    }

    const isValid = await verifyPassword(currentPassword, req.user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'वर्तमान पासवर्ड गलत है।' });
    }

    req.user.passwordHash = await hashPassword(newPassword);
    req.user.updatedAt = new Date();
    await req.user.save();

    res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक बदल दिया गया है।' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message || 'पासवर्ड बदलने में समस्या हुई।' });
  }
});

/* =========================================================
   ADMIN USER MANAGEMENT APIs (Admin only)
========================================================= */

function adminRequired(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'केवल एडमिन को यह अनुमति है।' });
}

// 1. Get list of all registered users with their details and WhatsApp status
router.get('/api/admin/users', authRequired, adminRequired, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    const { sessions } = require('./userSessions');
    const dbSessions = await WhatsAppSession.find({});
    const sessionMap = new Map();
    for (const s of dbSessions) {
      if (s.ownerUserId) sessionMap.set(s.ownerUserId, s);
    }

    const list = users.map(u => {
      const active = sessions?.get(u.userId);
      const dbS = sessionMap.get(u.userId);
      
      let waStatus = 'not_scanned';
      if (u.role === 'admin') {
        waStatus = (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') ? 'connected' : 'disconnected';
      } else if (active && active.status === 'connected') {
        waStatus = 'connected';
      } else if (dbS && dbS.status) {
        waStatus = dbS.status;
      }

      const rawPhone = (u.role === 'admin' && global.__waAdminSocket?.user?.id) 
        ? String(global.__waAdminSocket.user.id).split(':')[0].replace(/\D/g, '')
        : (active?.connectedNumber || dbS?.phone || null);

      return {
        userId: u.userId,
        username: u.username,
        name: u.name || u.username || 'User',
        mobile: u.mobile || '',
        role: u.role,
        plan: u.plan || 'Standard',
        status: u.status || 'active',
        whatsappStatus: waStatus,
        whatsappPhone: rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-10) : null,
        lastConnectedAt: dbS?.lastConnectedAt || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    });

    res.json({ success: true, users: list });
  } catch (err) {
    console.error('Admin fetch users error:', err);
    res.status(500).json({ success: false, message: err.message || 'Users load failed' });
  }
});

// 2. Update user profile (name, mobile, plan, role, status)
router.put('/api/admin/users/:userId', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, mobile, plan, role, status } = req.body || {};
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ success: false, message: 'यूजर नहीं मिला।' });

    if (name !== undefined) user.name = String(name).trim();
    if (mobile !== undefined) user.mobile = String(mobile).replace(/\D/g, '').slice(-10);
    if (plan !== undefined) user.plan = String(plan).trim();
    if (role && ['admin', 'user'].includes(role)) user.role = role;
    if (status && ['active', 'inactive', 'blocked'].includes(status)) user.status = status;
    user.updatedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'यूजर प्रोफाइल सफलतापूर्वक अपडेट हो गया।', user });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ success: false, message: err.message || 'User update failed' });
  }
});

// 3. Toggle user active / inactive status
router.post('/api/admin/users/:userId/toggle-status', authRequired, adminRequired, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ success: false, message: 'यूजर नहीं मिला।' });

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    user.status = newStatus;
    user.updatedAt = new Date();
    await user.save();

    res.json({ 
      success: true, 
      status: newStatus, 
      message: `यूजर अब ${newStatus === 'active' ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'} है।` 
    });
  } catch (err) {
    console.error('Admin toggle status error:', err);
    res.status(500).json({ success: false, message: err.message || 'Status toggle failed' });
  }
});

// 4. Send new generated password to user's registered WhatsApp
router.post('/api/admin/users/:userId/send-password', authRequired, adminRequired, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ success: false, message: 'यूजर नहीं मिला।' });

    const targetMobile = user.mobile || user.username;
    const clean10 = targetMobile ? String(targetMobile).replace(/\D/g, '').slice(-10) : '';
    if (!clean10 || clean10.length !== 10) {
      return res.status(400).json({ success: false, message: 'यूजर का कोई वैध 10-अंकीय मोबाइल नंबर नहीं मिला।' });
    }

    const newPassword = makePassword();
    user.passwordHash = await hashPassword(newPassword);
    user.updatedAt = new Date();
    await user.save();

    const sender = getLiveAdminWhatsAppSender();
    if (!sender) {
      return res.status(503).json({ 
        success: false, 
        message: 'Admin WhatsApp कनेक्टेड नहीं है। कृपया पहले Admin WhatsApp कनेक्ट करें।' 
      });
    }

    await sender(
      clean10,
      `*WA Control Center - Password Reset* 🔐\n\nUser ID: *${user.userId}*\nLogin ID: *${user.username || clean10}*\nNew Password: *${newPassword}*\n\nकृपया पोर्टल में लॉगिन करें और Settings से पासवर्ड बदलें।`
    );

    res.json({ 
      success: true, 
      message: `नया पासवर्ड यूजर (+91 ${clean10}) के WhatsApp पर सफलतापूर्वक भेज दिया गया!` 
    });
  } catch (err) {
    console.error('Admin send password error:', err);
    res.status(500).json({ success: false, message: err.message || 'Password send failed' });
  }
});

/* =========================================================
   USER WHATSAPP SESSION APIs (auth-protected)
========================================================= */

// Get user's own WhatsApp connection status
router.get('/api/user/whatsapp/status', authRequired, async (req, res) => {
  try {
    const { getUserSession } = require('./userSessions');
    const session = getUserSession(req.user.userId);
    const dbSession = await WhatsAppSession.findOne({ sessionId: `user-${req.user.userId}` });

    res.json({
      success: true,
      status: session?.status || dbSession?.status || 'waiting',
      number: session?.connectedNumber || dbSession?.phone || null,
      profileName: session?.profileName || (session?.connectedNumber ? `+${session.connectedNumber}` : 'WhatsApp Account'),
      ready: session?.status === 'connected',
      lastConnected: dbSession?.lastConnectedAt || null,
    });
  } catch (error) {
    console.error('User WhatsApp status error:', error);
    res.status(500).json({ success: false, message: 'Status check failed' });
  }
});

// Get QR code for user to scan their own WhatsApp
router.get('/api/user/whatsapp/qr', authRequired, async (req, res) => {
  try {
    const { getUserQR } = require('./userSessions');
    const result = await getUserQR(req.user.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('User WhatsApp QR error:', error);
    res.status(500).json({ success: false, message: 'QR generation failed' });
  }
});

// Start/connect user's WhatsApp session
router.post('/api/user/whatsapp/connect', authRequired, async (req, res) => {
  try {
    const { startUserSession } = require('./userSessions');
    const result = await startUserSession(req.user.userId);
    res.json({ success: true, message: 'WhatsApp session started.', ...result });
  } catch (error) {
    console.error('User WhatsApp connect error:', error);
    res.status(500).json({ success: false, message: error.message || 'WhatsApp connect failed' });
  }
});

// Disconnect user's WhatsApp session
router.post('/api/user/whatsapp/disconnect', authRequired, async (req, res) => {
  try {
    const { stopUserSession } = require('./userSessions');
    await stopUserSession(req.user.userId);
    res.json({ success: true, message: 'WhatsApp disconnected.' });
  } catch (error) {
    console.error('User WhatsApp disconnect error:', error);
    res.status(500).json({ success: false, message: error.message || 'Disconnect failed' });
  }
});

// Get list of active / scanned WhatsApp sessions available to the user
router.get('/api/user/whatsapp/sessions', authRequired, async (req, res) => {
  try {
    const { getUserSession, sessions } = require('./userSessions');
    const list = [];

    if (req.user.role === 'admin') {
      const adminPhone = global.__waAdminSocket?.user?.id
        ? String(global.__waAdminSocket.user.id).split(':')[0].split('@')[0].replace(/\D/g, '')
        : null;
      const isAdminConnected = Boolean(global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function');
      list.push({
        id: 'admin',
        sessionId: 'admin',
        name: 'Admin WhatsApp' + (adminPhone ? ` (+${adminPhone})` : ''),
        number: adminPhone ? adminPhone.slice(-10) : null,
        display: `Admin WhatsApp ${adminPhone ? `(+${adminPhone})` : ''} - ${isAdminConnected ? 'Connected ✓' : 'Offline'}`,
        status: isAdminConnected ? 'connected' : 'disconnected',
        isDefault: true,
        role: 'admin'
      });

      const dbSessions = await WhatsAppSession.find({});
      for (const s of dbSessions) {
        if (s.sessionId === 'admin') continue;
        const active = sessions?.get(s.ownerUserId);
        const num = active?.connectedNumber || s.phone || null;
        const clean10 = num ? String(num).replace(/\D/g, '').slice(-10) : null;
        const isConn = (active?.status === 'connected') || (s.status === 'connected');
        list.push({
          id: s.sessionId || `user-${s.ownerUserId}`,
          sessionId: s.sessionId || `user-${s.ownerUserId}`,
          userId: s.ownerUserId,
          name: `User: ${s.ownerUserId}${clean10 ? ` (+91${clean10})` : ''}`,
          number: clean10,
          display: `User (${s.ownerUserId}) ${clean10 ? `+91 ${clean10}` : ''} - ${isConn ? 'Connected ✓' : 'Offline'}`,
          status: isConn ? 'connected' : 'disconnected',
          role: s.role || 'user'
        });
      }
    } else {
      const active = getUserSession(req.user.userId);
      const dbSession = await WhatsAppSession.findOne({ ownerUserId: req.user.userId });
      const rawNum = active?.connectedNumber || dbSession?.phone || req.user.mobile || null;
      const clean10 = rawNum ? String(rawNum).replace(/\D/g, '').slice(-10) : null;
      const isConn = active?.status === 'connected';

      list.push({
        id: `user-${req.user.userId}`,
        sessionId: `user-${req.user.userId}`,
        userId: req.user.userId,
        name: clean10 ? `My WhatsApp (+91${clean10})` : `My WhatsApp (${req.user.username || req.user.userId})`,
        number: clean10,
        display: clean10 ? `+91 ${clean10} (${isConn ? 'Connected ✓' : 'Not Connected'})` : `My WhatsApp (${isConn ? 'Connected ✓' : 'Not Connected'})`,
        status: isConn ? 'connected' : (active?.status || dbSession?.status || 'waiting'),
        isDefault: true,
        role: 'user'
      });
    }

    res.json({ success: true, sessions: list });
  } catch (error) {
    console.error('Fetch whatsapp sessions error:', error);
    res.status(500).json({ success: false, message: error.message || 'Sessions fetch failed' });
  }
});

// Send message from selected WhatsApp (single or sequential)
router.post('/api/user/send', authRequired, async (req, res) => {
  try {
    const { to, text, attachment, session } = req.body || {};
    if (!to) return res.status(400).json({ success: false, message: 'Recipient number (to) is required.' });
    if (!text && !attachment) return res.status(400).json({ success: false, message: 'Message text or attachment is required.' });

    // Resolve socket
    let activeSocket = null;
    let fromNumber = null;
    let sessionName = '';

    const { findOrLoadSession, getUserSession } = require('./userSessions');

    if (req.user.role === 'admin') {
      if (session && session !== 'admin') {
        const match = await findOrLoadSession(session);
        if (match && match.session?.status === 'connected' && match.session?.socket) {
          activeSocket = match.session.socket;
          fromNumber = match.session.connectedNumber || match.userId;
          sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
        }
      }
      if (!activeSocket) {
        if (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') {
          activeSocket = global.__waAdminSocket;
          fromNumber = activeSocket?.user?.id ? String(activeSocket.user.id).split(':')[0].replace(/\D/g, '') : 'Admin';
          sessionName = 'admin';
        }
      }
    } else {
      const match = await findOrLoadSession(session, req.user.userId);
      if (match && match.session?.status === 'connected' && match.session?.socket) {
        activeSocket = match.session.socket;
        fromNumber = match.session.connectedNumber || req.user.mobile || req.user.userId;
        sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
      } else {
        const uSession = getUserSession(req.user.userId);
        if (uSession && uSession.status === 'connected' && uSession.socket) {
          activeSocket = uSession.socket;
          fromNumber = uSession.connectedNumber || req.user.mobile || req.user.userId;
          sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
        }
      }
    }

    if (!activeSocket) {
      return res.status(400).json({
        success: false,
        message: 'चयनित WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard पर जाकर QR कोड स्कैन करें।'
      });
    }

    // Format destination number
    const cleanDigits = String(to).replace(/\D/g, '');
    let normalized = cleanDigits;
    if (cleanDigits.length === 10) normalized = '91' + cleanDigits;
    else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) normalized = cleanDigits;
    else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) normalized = '91' + cleanDigits.slice(1);

    if (normalized.length < 10) {
      return res.status(400).json({ success: false, message: `अमान्य मोबाइल नंबर: ${to}` });
    }

    const jid = normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`;

    // Construct message payload
    let messageContent = {};
    let mediaUrl = null;
    let mediaType = null;
    let fileName = null;

    if (attachment && attachment.data) {
      const base64Clean = attachment.data.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');
      const mimeType = attachment.type || 'application/octet-stream';
      fileName = attachment.name || 'file';

      const path = require('path');
      const fs = require('fs');
      const MEDIA_DIR = path.join(__dirname, 'media_storage');
      if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
      const ext = path.extname(fileName) || '.bin';
      const savedName = `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
      fs.writeFileSync(path.join(MEDIA_DIR, savedName), buffer);
      mediaUrl = `/media/${savedName}`;

      if (mimeType.startsWith('image/')) {
        messageContent = { image: buffer, caption: text ? String(text) : undefined, mimetype: mimeType };
        mediaType = 'image';
      } else if (mimeType.startsWith('video/')) {
        messageContent = { video: buffer, caption: text ? String(text) : undefined, mimetype: mimeType };
        mediaType = 'video';
      } else if (mimeType.startsWith('audio/')) {
        messageContent = { audio: buffer, mimetype: mimeType, ptt: false };
        mediaType = 'audio';
      } else {
        messageContent = { document: buffer, fileName: fileName, caption: text ? String(text) : undefined, mimetype: mimeType };
        mediaType = 'document';
      }
    } else {
      messageContent = { text: String(text || '') };
    }

    const result = await activeSocket.sendMessage(jid, messageContent);
    const messageId = result?.key?.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));

    // Log to message_reports & incoming_messages
    try {
      const { appendMessageReport, appendIncomingMessage, broadcastIncomingEvent } = require('./index');
      const reportText = attachment ? `[${mediaType?.toUpperCase() || 'ATTACHMENT'}] ${text || ''}`.trim() : String(text || '');
      appendMessageReport({
        id: messageId,
        date: new Date().toISOString(),
        from: fromNumber || sessionName || 'User',
        to: normalized,
        message: reportText,
        status: 'sent',
        session: sessionName || 'default'
      });

      appendIncomingMessage({
        id: messageId,
        chatJid: jid,
        from: fromNumber || sessionName || 'User',
        fromMe: true,
        message: reportText,
        mediaType: mediaType,
        mediaUrl: mediaUrl,
        fileName: fileName,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        isRead: true
      });

      broadcastIncomingEvent('new_message', {
        id: messageId,
        chatJid: jid,
        from: fromNumber || sessionName || 'User',
        fromMe: true,
        message: reportText
      });
    } catch (logErr) {
      console.warn('[User Send] Report log warning:', logErr.message);
    }

    res.json({
      success: true,
      message: 'मैसेज सफलतापूर्वक भेज दिया गया।',
      messageId,
      to: normalized
    });
  } catch (error) {
    console.error('User send error:', error);
    res.status(500).json({ success: false, message: error.message || 'Message sending failed' });
  }
});

/* =========================================================
   USER API TOKEN & INTEGRATION
========================================================= */

router.get('/api/user/api-token', authRequired, async (req, res) => {
  try {
    if (!req.user.apiToken) {
      req.user.apiToken = generateApiToken();
      await req.user.save();
    }

    const { getUserSession } = require('./userSessions');
    const active = getUserSession(req.user.userId);
    const dbSession = await WhatsAppSession.findOne({ ownerUserId: req.user.userId });
    
    const adminPhone = global.__waAdminSocket?.user?.id 
      ? String(global.__waAdminSocket.user.id).split(':')[0].replace(/\D/g, '') 
      : (process.env.ADMIN_PHONE || '8840457632');

    const rawNumber = req.user.role === 'admin' 
      ? (adminPhone || active?.connectedNumber || dbSession?.phone || req.user.mobile || '') 
      : (active?.connectedNumber || dbSession?.phone || req.user.mobile || '');
    const session10 = String(rawNumber).replace(/\D/g, '').slice(-10);

    const isConnected = req.user.role === 'admin'
      ? Boolean(global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function')
      : (active?.status === 'connected');

    const host = req.get('host') || 'local-whatsapp.onrender.com';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const sampleUrl = `${baseUrl}/send-text?token=${req.user.apiToken}&to=9876543210&message=Hello&session=${session10 || 'YOUR_10_DIGIT_NUMBER'}`;

    res.json({
      success: true,
      token: req.user.apiToken,
      session: session10 || null,
      connectedNumber: rawNumber || null,
      status: isConnected ? 'connected' : (active?.status || dbSession?.status || 'disconnected'),
      baseUrl,
      sampleUrl,
      sampleProductionUrl: `https://local-whatsapp.onrender.com/send-text?token=${req.user.apiToken}&to=9876543210&message=Hello&session=${session10 || 'YOUR_10_DIGIT_NUMBER'}`
    });
  } catch (error) {
    console.error('Fetch user api-token error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/api/user/api-token/regenerate', authRequired, async (req, res) => {
  try {
    req.user.apiToken = generateApiToken();
    req.user.updatedAt = new Date();
    await req.user.save();
    res.json({
      success: true,
      token: req.user.apiToken,
      message: 'नया API Token सफलतापूर्वक जनरेट हो गया है।'
    });
  } catch (error) {
    console.error('Regenerate API token error:', error);
    res.status(500).json({ success: false, message: error.message });
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