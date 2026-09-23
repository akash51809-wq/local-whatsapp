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

const PlanSchema = new mongoose.Schema({
  planId: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  description: { type: String, default: '' },
  dailyLimit: { type: String, default: '500/Day' },
  validity: { type: String, default: '30 Days' },
  validityDays: { type: Number, default: 30 },
  deviceLimit: { type: String, default: '1 Free + 1 Add-on' },
  apiAccess: { type: Boolean, default: false },
  webAccess: { type: Boolean, default: true },
  bulkMsg: { type: Boolean, default: false },
  groupOption: { type: Boolean, default: false },
  scheduleMsg: { type: Boolean, default: false },
  ipSecurity: { type: Boolean, default: false },
  headerColor: { type: String, default: '#705ec8' },
  badgeText: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const PlanPurchaseRequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userMobile: { type: String, default: '' },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  bankDetails: { type: String, required: true },
  screenshot: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  adminNotes: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.models.WAUser || mongoose.model('WAUser', UserSchema);
const Otp = mongoose.models.WAOtp || mongoose.model('WAOtp', OtpSchema);
const WhatsAppSession = mongoose.models.WAWhatsAppSession || mongoose.model('WAWhatsAppSession', WhatsAppSessionSchema);
const Plan = mongoose.models.WAPlan || mongoose.model('WAPlan', PlanSchema);
const PlanPurchaseRequest = mongoose.models.WAPlanPurchaseRequest || mongoose.model('WAPlanPurchaseRequest', PlanPurchaseRequestSchema);

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

async function ensureDefaultPlans() {
  if (mongoose.connection.readyState !== 1) return;
  const count = await Plan.countDocuments();
  if (count === 0) {
    await Plan.create([
      {
        planId: 'plan_startup',
        name: 'Startup',
        price: 99,
        currency: 'INR',
        description: 'Send message to contacts only',
        dailyLimit: '500/Day',
        validity: '30 Days',
        validityDays: 30,
        deviceLimit: '1 Free + 1 Add-on',
        apiAccess: false,
        webAccess: true,
        bulkMsg: false,
        groupOption: false,
        scheduleMsg: false,
        ipSecurity: false,
        headerColor: '#5398f5',
        sortOrder: 1,
        active: true
      },
      {
        planId: 'plan_business',
        name: 'Business',
        price: 149,
        currency: 'INR',
        description: 'Send message to groups also',
        dailyLimit: '1000/Day',
        validity: '30 Days',
        validityDays: 30,
        deviceLimit: '1 Free + 2 Add-ons',
        apiAccess: true,
        webAccess: true,
        bulkMsg: true,
        groupOption: true,
        scheduleMsg: true,
        ipSecurity: false,
        headerColor: '#128c7e',
        sortOrder: 2,
        active: true
      },
      {
        planId: 'plan_enterprise',
        name: 'Enterprise',
        price: 199,
        currency: 'INR',
        description: 'Received message webhook support',
        dailyLimit: '2000/Day',
        validity: '30 Days',
        validityDays: 30,
        deviceLimit: '1 Free + 4 Add-ons',
        apiAccess: true,
        webAccess: true,
        bulkMsg: true,
        groupOption: true,
        scheduleMsg: true,
        ipSecurity: true,
        headerColor: '#705ec8',
        sortOrder: 3,
        active: true
      }
    ]);
    console.log('[PlanSystem] Default Startup, Business & Enterprise plans created.');
  }
}

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
    { $setOnInsert: { ownerUserId: admin.userId, role: 'admin', status: 'waiting' } },
    { upsert: true }
  );
  await ensureDefaultPlans().catch(err => console.error('[PlanSystem] Seeding error:', err.message));
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
    let token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token && req.query && req.query.token) {
      token = String(req.query.token).trim();
    }
    let user = await authenticateToken(token);
    if (!user && token) {
      try {
        user = await User.findOne({ apiToken: token, status: 'active' });
      } catch {}
    }
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
  let socket = global.__waAdminSocket;
  if (!socket || typeof socket.sendMessage !== 'function') {
    try {
      const { getSessionByPhoneOrUserId, sessions } = require('./userSessions');
      const adminPhone = process.env.ADMIN_PHONE || '8840457632';
      const match = getSessionByPhoneOrUserId(adminPhone);
      if (match?.session?.socket && match?.session?.status === 'connected') {
        socket = match.session.socket;
        global.__waAdminSocket = socket;
      } else {
        const userS = sessions?.get('USR59396382');
        if (userS?.socket && userS?.status === 'connected') {
          socket = userS.socket;
          global.__waAdminSocket = socket;
        }
      }
    } catch (e) {}
  }
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
    const users = await User.find({ role: { $ne: 'admin' }, userId: { $ne: 'ADMIN' } }).sort({ createdAt: -1 });
    const { sessions } = require('./userSessions');
    const dbSessions = await WhatsAppSession.find({ role: 'user', ownerUserId: { $ne: 'ADMIN' } });
    const sessionMap = new Map();
    for (const s of dbSessions) {
      if (s.ownerUserId) sessionMap.set(s.ownerUserId, s);
    }

    const list = users.map(u => {
      const active = sessions?.get(u.userId);
      const dbS = sessionMap.get(u.userId);
      
      let waStatus = 'not_scanned';
      if (active && active.status === 'connected') {
        waStatus = 'connected';
      } else if (dbS && dbS.status) {
        waStatus = dbS.status;
      }

      const rawPhone = active?.connectedNumber || dbS?.phone || null;

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
    if (String(req.params.userId || '').toUpperCase() === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin account cannot be managed via user endpoints.' });
    }
    const { name, mobile, plan, role, status } = req.body || {};
    const user = await User.findOne({ userId: req.params.userId, role: { $ne: 'admin' } });
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
    if (String(req.params.userId || '').toUpperCase() === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin account status cannot be toggled.' });
    }
    const user = await User.findOne({ userId: req.params.userId, role: { $ne: 'admin' } });
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
    if (String(req.params.userId || '').toUpperCase() === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin password cannot be reset via user endpoints.' });
    }
    const user = await User.findOne({ userId: req.params.userId, role: { $ne: 'admin' } });
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
    const isRoleAdmin = req.user.role === 'admin' || String(req.user.userId || '').toUpperCase() === 'ADMIN';
    if (isRoleAdmin) {
      console.log('[AdminSession] Status check for admin user');
      let activeSock = global.__waAdminSocket;
      let isConn = Boolean(activeSock && typeof activeSock.sendMessage === 'function');
      if (!isConn) {
        try {
          const { getSessionByPhoneOrUserId, sessions } = require('./userSessions');
          const adminPhone = process.env.ADMIN_PHONE || '8840457632';
          const match = getSessionByPhoneOrUserId(adminPhone);
          if (match?.session?.socket && match?.session?.status === 'connected') {
            activeSock = match.session.socket;
            global.__waAdminSocket = activeSock;
            isConn = true;
          } else {
            const userS = sessions?.get('USR59396382');
            if (userS?.socket && userS?.status === 'connected') {
              activeSock = userS.socket;
              global.__waAdminSocket = activeSock;
              isConn = true;
            }
          }
        } catch (e) {}
      }
      const adminPhone = activeSock?.user?.id
        ? String(activeSock.user.id).split(':')[0].split('@')[0].replace(/\D/g, '')
        : (process.env.ADMIN_PHONE || '8840457632');
      return res.json({
        success: true,
        status: isConn ? 'connected' : 'waiting',
        number: isConn && adminPhone ? adminPhone.slice(-10) : (adminPhone ? adminPhone.slice(-10) : null),
        profileName: activeSock?.user?.name || (adminPhone ? `+${adminPhone}` : 'Admin WhatsApp'),
        ready: isConn,
        lastConnected: null,
      });
    }

    const { getUserSession, startUserSession } = require('./userSessions');
    let session = getUserSession(req.user.userId);
    const dbSession = await WhatsAppSession.findOne({ 
      $or: [{ ownerUserId: req.user.userId }, { sessionId: `user-${req.user.userId}` }] 
    });

    // Proactively wake up/reconnect session if not in memory and user hasn't logged out
    if ((!session || session.status === 'disconnected') && dbSession && dbSession.status !== 'logged_out') {
      console.log(`[AutoWake] Proactively starting session for user ${req.user.userId}`);
      startUserSession(req.user.userId).catch(err => console.error('[AutoWake] Session error:', err.message));
      session = getUserSession(req.user.userId);
    }

    const currentStatus = session?.status || (dbSession?.status === 'connected' ? 'connecting' : (dbSession?.status || 'waiting'));

    res.json({
      success: true,
      status: currentStatus,
      number: session?.connectedNumber || dbSession?.phone || null,
      profileName: session?.profileName || (session?.connectedNumber ? `+${session.connectedNumber}` : (dbSession?.phone ? `+${dbSession.phone}` : 'WhatsApp Account')),
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
    const isRoleAdmin = req.user.role === 'admin' || String(req.user.userId || '').toUpperCase() === 'ADMIN';
    if (isRoleAdmin) {
      console.warn('[UserSession] BLOCKED QR request for admin user ADMIN via user QR endpoint');
      const isConn = Boolean(global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function');
      return res.json({
        success: true,
        status: isConn ? 'connected' : 'waiting',
        qr: null,
        connectedNumber: isConn ? (global.__waAdminSocket?.user?.id?.split(':')[0]?.replace(/\D/g, '') || null) : null
      });
    }

    const { getUserQR, getUserSession, startUserSession } = require('./userSessions');
    let session = getUserSession(req.user.userId);
    if (!session || session.status === 'disconnected') {
      await startUserSession(req.user.userId).catch(() => {});
    }
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
    const isRoleAdmin = req.user.role === 'admin' || String(req.user.userId || '').toUpperCase() === 'ADMIN';
    if (isRoleAdmin) {
      console.warn('[UserSession] BLOCKED admin userId=ADMIN from user session connect endpoint');
      return res.status(400).json({
        success: false,
        message: 'Admin WhatsApp session is managed automatically via dedicated sessionId=admin.'
      });
    }

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
    const isRoleAdmin = req.user.role === 'admin' || String(req.user.userId || '').toUpperCase() === 'ADMIN';
    if (isRoleAdmin) {
      console.warn('[UserSession] BLOCKED admin userId=ADMIN from user session disconnect endpoint');
      return res.status(400).json({
        success: false,
        message: 'Admin WhatsApp session cannot be disconnected via user session endpoint.'
      });
    }

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
      const dbAdminS = await WhatsAppSession.findOne({ sessionId: 'admin' });
      const adminPhone = global.__waAdminSocket?.user?.id
        ? String(global.__waAdminSocket.user.id).split(':')[0].split('@')[0].replace(/\D/g, '')
        : (dbAdminS?.phone || process.env.ADMIN_PHONE || '8840457632');
      let isAdminConnected = Boolean(global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function');
      if (!isAdminConnected) {
        const { getSessionByPhoneOrUserId } = require('./userSessions');
        const match = getSessionByPhoneOrUserId(process.env.ADMIN_PHONE || '8840457632');
        if (match?.session?.socket && match?.session?.status === 'connected') {
          global.__waAdminSocket = match.session.socket;
          isAdminConnected = true;
        } else {
          const userS = sessions?.get('USR59396382');
          if (userS?.socket && userS?.status === 'connected') {
            global.__waAdminSocket = userS.socket;
            isAdminConnected = true;
          }
        }
      }
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
        if (s.sessionId === 'admin' || s.role === 'admin' || String(s.ownerUserId || '').toUpperCase() === 'ADMIN') continue;
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
      const match = await findOrLoadSession(session || 'admin', req.user);
      if (match && match.session?.status === 'connected' && match.session?.socket && Boolean(match.session.socket.user?.id)) {
        activeSocket = match.session.socket;
        fromNumber = match.session.connectedNumber || match.userId;
        sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
      }
      if (!activeSocket) {
        if (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function' && Boolean(global.__waAdminSocket.user?.id)) {
          activeSocket = global.__waAdminSocket;
          fromNumber = activeSocket?.user?.id ? String(activeSocket.user.id).split(':')[0].replace(/\D/g, '') : 'Admin';
          sessionName = 'admin';
        } else {
          // Check fallback: get active session for adminPhone or USR59396382
          const { getSessionByPhoneOrUserId, sessions } = require('./userSessions');
          const adminPhone = process.env.ADMIN_PHONE || '8840457632';
          const phoneMatch = getSessionByPhoneOrUserId(adminPhone);
          if (phoneMatch?.session?.socket && phoneMatch?.session?.status === 'connected' && Boolean(phoneMatch.session.socket.user?.id)) {
            activeSocket = phoneMatch.session.socket;
            global.__waAdminSocket = activeSocket;
            fromNumber = phoneMatch.session.connectedNumber || adminPhone;
            sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
          } else {
            const userS = sessions?.get('USR59396382');
            if (userS?.socket && userS?.status === 'connected' && Boolean(userS.socket.user?.id)) {
              activeSocket = userS.socket;
              global.__waAdminSocket = activeSocket;
              fromNumber = userS.connectedNumber || adminPhone;
              sessionName = String(fromNumber).replace(/\D/g, '').slice(-10);
            }
          }
        }
      }
    } else {
      const match = await findOrLoadSession(session, req.user);
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

    // Format destination: Group vs Individual
    const toClean = String(to).trim();
    const isGroup = toClean.endsWith('@g.us') || toClean.includes('@g.us') || (toClean.startsWith('120363') && toClean.replace(/\D/g, '').length >= 15);
    let normalized = '';
    let jid = '';

    if (isGroup) {
      jid = toClean.includes('@g.us') ? toClean : `${toClean.replace(/\D/g, '')}@g.us`;
      normalized = jid;
    } else {
      const cleanDigits = toClean.replace(/\D/g, '');
      normalized = cleanDigits;
      if (cleanDigits.length === 10) normalized = '91' + cleanDigits;
      else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) normalized = cleanDigits;
      else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) normalized = '91' + cleanDigits.slice(1);

      if (normalized.length < 10) {
        return res.status(400).json({ success: false, message: `अमान्य मोबाइल नंबर या ग्रुप ID: ${to}` });
      }
      jid = `${normalized}@s.whatsapp.net`;
    }

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
        ownerUserId: req.user.userId,
        from: fromNumber || sessionName || 'User',
        to: normalized,
        message: reportText,
        status: 'sent',
        session: sessionName || 'default'
      });

      appendIncomingMessage({
        id: messageId,
        chatJid: jid,
        ownerUserId: req.user.userId,
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
      message: isGroup ? 'ग्रुप में मैसेज सफलतापूर्वक भेज दिया गया।' : 'मैसेज सफलतापूर्वक भेज दिया गया।',
      messageId,
      recipientType: isGroup ? 'group' : 'user',
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
    const updateFields = {
      ownerUserId: admin.userId,
      role: 'admin',
      status: info.status || 'waiting',
      ...(info.status === 'connected' ? { lastConnectedAt: new Date() } : {}),
      updatedAt: new Date()
    };
    if (info.phone) {
      updateFields.phone = info.phone;
    }
    await WhatsAppSession.updateOne(
      { sessionId: process.env.ADMIN_WHATSAPP_SESSION_ID || 'admin' },
      { $set: updateFields, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error('WhatsApp session record error:', error.message);
  }
}

// =========================================================
// PLAN MANAGEMENT & SUBSCRIPTION PURCHASE APIS
// =========================================================

// 1. Get active plans for user pricing table
router.get('/api/plans', authRequired, async (req, res) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ sortOrder: 1, price: 1 });
    const userRequests = await PlanPurchaseRequest.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      plans,
      currentPlan: req.user.plan || 'Standard',
      myRequests: userRequests
    });
  } catch (error) {
    console.error('Fetch active plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Admin: Get all plans (active & inactive)
router.get('/api/admin/plans', authRequired, adminRequired, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Admin fetch plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Admin: Create a new plan
router.post('/api/admin/plans', authRequired, adminRequired, async (req, res) => {
  try {
    const {
      name, price, currency, description, dailyLimit, validity, validityDays,
      deviceLimit, apiAccess, webAccess, bulkMsg, groupOption, scheduleMsg,
      ipSecurity, headerColor, badgeText, active, sortOrder
    } = req.body;

    if (!name || price === undefined || price === null) {
      return res.status(400).json({ success: false, message: 'Plan Name और Price आवश्यक हैं।' });
    }

    const planId = 'plan_' + randomDigits(6);
    const plan = await Plan.create({
      planId,
      name: String(name).trim(),
      price: Number(price),
      currency: currency || 'INR',
      description: description || '',
      dailyLimit: dailyLimit || '500/Day',
      validity: validity || '30 Days',
      validityDays: Number(validityDays) || 30,
      deviceLimit: deviceLimit || '1 Free + 1 Add-on',
      apiAccess: Boolean(apiAccess),
      webAccess: webAccess !== undefined ? Boolean(webAccess) : true,
      bulkMsg: Boolean(bulkMsg),
      groupOption: Boolean(groupOption),
      scheduleMsg: Boolean(scheduleMsg),
      ipSecurity: Boolean(ipSecurity),
      headerColor: headerColor || '#705ec8',
      badgeText: badgeText || '',
      active: active !== undefined ? Boolean(active) : true,
      sortOrder: Number(sortOrder) || 0,
    });

    res.json({ success: true, message: 'नया प्लान सफलतापूर्वक बनाया गया!', plan });
  } catch (error) {
    console.error('Admin create plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Admin: Update an existing plan
router.put('/api/admin/plans/:planId', authRequired, adminRequired, async (req, res) => {
  try {
    const plan = await Plan.findOne({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan नहीं मिला।' });

    const fields = [
      'name', 'price', 'currency', 'description', 'dailyLimit', 'validity',
      'validityDays', 'deviceLimit', 'apiAccess', 'webAccess', 'bulkMsg',
      'groupOption', 'scheduleMsg', 'ipSecurity', 'headerColor', 'badgeText',
      'active', 'sortOrder'
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'price' || f === 'validityDays' || f === 'sortOrder') {
          plan[f] = Number(req.body[f]);
        } else if (typeof plan[f] === 'boolean') {
          plan[f] = Boolean(req.body[f]);
        } else {
          plan[f] = req.body[f];
        }
      }
    }
    plan.updatedAt = new Date();
    await plan.save();

    res.json({ success: true, message: 'Plan सफलतापूर्वक अपडेट किया गया!', plan });
  } catch (error) {
    console.error('Admin update plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Admin: Delete a plan
router.delete('/api/admin/plans/:planId', authRequired, adminRequired, async (req, res) => {
  try {
    const plan = await Plan.findOneAndDelete({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan नहीं मिला।' });
    res.json({ success: true, message: 'Plan हटा दिया गया है।' });
  } catch (error) {
    console.error('Admin delete plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. User: Submit plan purchase request
router.post('/api/plans/purchase', authRequired, async (req, res) => {
  try {
    const { planId, amount, paymentDate, bankDetails, screenshot, notes } = req.body;
    if (!planId || !bankDetails) {
      return res.status(400).json({ success: false, message: 'Plan और Payment / Bank Details भरना आवश्यक है।' });
    }

    const plan = await Plan.findOne({ planId });
    if (!plan) return res.status(404).json({ success: false, message: 'चुना हुआ Plan उपलब्ध नहीं है।' });

    const requestId = 'REQ' + randomDigits(7);
    const purchaseReq = await PlanPurchaseRequest.create({
      requestId,
      userId: req.user.userId,
      userName: req.user.name || req.user.username || 'User',
      userMobile: req.user.mobile || req.user.username || '',
      planId: plan.planId,
      planName: plan.name,
      amount: Number(amount) || plan.price,
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      bankDetails: String(bankDetails).trim(),
      screenshot: screenshot || '',
      adminNotes: notes || '',
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'आपकी पेमेंट रिक्वेस्ट सफलतापूर्वक सबमिट हो गई है! एडमिन द्वारा अप्रूवल के बाद प्लान एक्टिवेट हो जाएगा।',
      request: purchaseReq
    });
  } catch (error) {
    console.error('Plan purchase submit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. User: Get my plan purchase requests
router.get('/api/user/my-plan-requests', authRequired, async (req, res) => {
  try {
    const requests = await PlanPurchaseRequest.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      currentPlan: req.user.plan || 'Standard',
      requests
    });
  } catch (error) {
    console.error('User fetch my plan requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Admin: Get all purchase requests
router.get('/api/admin/plan-requests', authRequired, adminRequired, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    const requests = await PlanPurchaseRequest.find(filter).sort({ createdAt: -1 });
    const counts = {
      total: await PlanPurchaseRequest.countDocuments(),
      pending: await PlanPurchaseRequest.countDocuments({ status: 'pending' }),
      approved: await PlanPurchaseRequest.countDocuments({ status: 'approved' }),
      rejected: await PlanPurchaseRequest.countDocuments({ status: 'rejected' }),
    };

    res.json({ success: true, requests, counts });
  } catch (error) {
    console.error('Admin fetch plan requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Admin: Approve purchase request
router.post('/api/admin/plan-requests/:requestId/approve', authRequired, adminRequired, async (req, res) => {
  try {
    const request = await PlanPurchaseRequest.findOne({ requestId: req.params.requestId });
    if (!request) return res.status(404).json({ success: false, message: 'Request नहीं मिली।' });
    if (request.status === 'approved') {
      return res.status(400).json({ success: false, message: 'यह रिक्वेस्ट पहले ही अप्रूव हो चुकी है।' });
    }

    const user = await User.findOne({ userId: request.userId });
    if (!user) return res.status(404).json({ success: false, message: 'User नहीं मिला।' });

    // Update user plan
    user.plan = request.planName;
    user.updatedAt = new Date();
    await user.save();

    // Mark request approved
    request.status = 'approved';
    request.approvedAt = new Date();
    if (req.body.notes) request.adminNotes = req.body.notes;
    await request.save();

    res.json({
      success: true,
      message: `User ${user.name || user.userId} (${user.mobile || user.username}) का प्लान '${request.planName}' एक्टिवेट कर दिया गया है!`
    });
  } catch (error) {
    console.error('Admin approve plan request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Admin: Reject purchase request
router.post('/api/admin/plan-requests/:requestId/reject', authRequired, adminRequired, async (req, res) => {
  try {
    const request = await PlanPurchaseRequest.findOne({ requestId: req.params.requestId });
    if (!request) return res.status(404).json({ success: false, message: 'Request नहीं मिली।' });

    request.status = 'rejected';
    request.rejectedAt = new Date();
    if (req.body.notes) request.adminNotes = req.body.notes;
    await request.save();

    res.json({ success: true, message: 'रिक्वेस्ट अस्वीकार (Reject) कर दी गई है।' });
  } catch (error) {
    console.error('Admin reject plan request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, authRequired, adminRequired, ensureAdminUser, recordAdminWhatsAppSession, User, WhatsAppSession, Plan, PlanPurchaseRequest };