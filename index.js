const {
    default: makeWASocket,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const { useMongoAuthState } = require('./mongoAuthState');

const { Boom } = require('@hapi/boom');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const { authRequired, adminRequired } = require('./auth');

const app = express();
app.disable('x-powered-by');

// Strict CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV !== 'production') {
            if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
        }
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        if (process.env.RENDER_EXTERNAL_URL && origin === process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')) {
            return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.removeHeader('X-Powered-By');
    next();
});

// Standard secure limits: 1MB default JSON / Form limit (replaces 100MB open limit)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Dedicated body parser for attachments (up to 15MB)
const attachmentBodyParser = express.json({ limit: '15mb' });

const fs = require('fs');
const path = require('path');

// Protected Media Storage
const MEDIA_DIR = path.join(__dirname, 'media_storage');
if (!fs.existsSync(MEDIA_DIR)) {
    try {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
    } catch (e) {
        console.error('Error creating media_storage dir:', e);
    }
}

// Protected Media Route: requires authentication, protects against path traversal
app.get('/media/:filename', authRequired, (req, res) => {
    try {
        const rawFilename = req.params.filename || '';
        const safeFilename = path.basename(rawFilename);
        const filePath = path.resolve(MEDIA_DIR, safeFilename);

        if (!filePath.startsWith(path.resolve(MEDIA_DIR))) {
            return res.status(403).json({ success: false, message: 'Access forbidden: invalid path.' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Media file not found.' });
        }

        return res.sendFile(filePath);
    } catch (err) {
        console.error('Media fetch error:', err.message);
        return res.status(500).json({ success: false, message: 'Error retrieving media file.' });
    }
});

// Global Group Metadata Cache
const groupMetaCache = new Map();

// Server-Sent Events (SSE) clients map: res -> user object
const sseClients = new Map();

function broadcastIncomingEvent(type, data, ownerUserId = null, sessionPhone = null) {
    const payload = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
    for (const [clientRes, user] of sseClients.entries()) {
        try {
            if (!user || user.role === 'admin') {
                clientRes.write(payload);
            } else if (ownerUserId && user.userId === ownerUserId) {
                clientRes.write(payload);
            } else if (sessionPhone && user.mobile && String(sessionPhone).includes(String(user.mobile).slice(-10))) {
                clientRes.write(payload);
            } else if (!ownerUserId && !sessionPhone) {
                clientRes.write(payload);
            }
        } catch {
            sseClients.delete(clientRes);
        }
    }
}

const PORT = process.env.PORT || 3001;

let sock = null;
let latestQR = null;
let connectionStatus = 'waiting';
let connectedNumber = null;
let lastConnectedTime = new Date().toISOString();

let sendingQueue = [];

/* =========================================================
   REPORTS STORAGE
========================================================= */

const REPORTS_FILE = path.join(__dirname, 'message_reports.json');

function getMessageReports(user = null) {
    try {
        if (!fs.existsSync(REPORTS_FILE)) {
            fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(REPORTS_FILE, 'utf-8');
        const list = JSON.parse(data || '[]');
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!user || user.role === 'admin') {
            return list;
        }

        const userMobile10 = user.mobile ? String(user.mobile).replace(/\D/g, '').slice(-10) : '';
        return list.filter(r => {
            if (r.ownerUserId && r.ownerUserId === user.userId) return true;
            if (userMobile10) {
                const sClean = r.session ? String(r.session).replace(/\D/g, '').slice(-10) : '';
                const fClean = r.from ? String(r.from).replace(/\D/g, '').slice(-10) : '';
                if (sClean === userMobile10 || fClean === userMobile10) return true;
            }
            return false;
        });
    } catch (e) {
        console.error('Error reading message reports:', e);
        return [];
    }
}

function appendMessageReport(record) {
    try {
        const reports = getMessageReports();
        reports.unshift(record);
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error appending message report:', e);
    }
}

/* =========================================================
   LID RESOLUTION & CONTACTS STORE
========================================================= */

const lidReverseCache = new Map();

function getPhoneNumberFromLid(lid) {
    if (!lid) return null;
    const cleanLid = String(lid).replace(/@lid$/, '').split(':')[0];
    if (lidReverseCache.has(cleanLid)) {
        return lidReverseCache.get(cleanLid);
    }
    return null;
}

function resolveJidAndNumber(jid, altJid = null) {
    if (!jid) return { jid: '', number: '' };

    if (altJid && altJid.endsWith('@s.whatsapp.net')) {
        const num = altJid.split('@')[0].split(':')[0];
        return { jid: `${num}@s.whatsapp.net`, number: num };
    }

    if (jid.endsWith('@g.us')) {
        const num = jid.split('@')[0].split(':')[0];
        return { jid: `${num}@g.us`, number: num };
    }

    if (jid.endsWith('@lid')) {
        const phone = getPhoneNumberFromLid(jid);
        if (phone) {
            return { jid: `${phone}@s.whatsapp.net`, number: phone };
        }
    }

    const num = jid.split('@')[0].split(':')[0];
    const domain = jid.includes('@') ? jid.split('@') : 's.whatsapp.net';
    return { jid: `${num}@${domain}`, number: num };
}

const CONTACTS_FILE = path.join(__dirname, 'contacts_store.json');
const contactsMap = new Map();

function loadContacts() {
    try {
        if (fs.existsSync(CONTACTS_FILE)) {
            const raw = fs.readFileSync(CONTACTS_FILE, 'utf-8');
            const list = JSON.parse(raw || '[]');
            for (const c of list) {
                if (c && c.id) {
                    contactsMap.set(c.id, c);
                    const clean = c.id.split('@')[0];
                    if (clean) contactsMap.set(clean, c);
                    if (c.lid && c.phone) {
                        lidReverseCache.set(c.lid.replace(/@lid$/, ''), c.phone);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error loading contacts:', e.message);
    }
}
loadContacts();

let saveContactsTimer = null;
function saveContact(c) {
    if (!c || !c.id) return;
    const cleanNum = c.id.split('@')[0];
    const existing = contactsMap.get(c.id) || contactsMap.get(cleanNum) || {};
    const updated = {
        ...existing,
        id: c.id,
        name: c.name || existing.name || null,
        notify: c.notify || existing.notify || null,
        verifiedName: c.verifiedName || existing.verifiedName || null,
        phone: c.id.includes('@s.whatsapp.net') ? cleanNum : (existing.phone || null),
        lid: c.lid || existing.lid || null
    };
    contactsMap.set(c.id, updated);
    if (cleanNum) contactsMap.set(cleanNum, updated);
    if (updated.lid && updated.phone) {
        lidReverseCache.set(updated.lid.replace(/@lid$/, ''), updated.phone);
    }

    if (saveContactsTimer) clearTimeout(saveContactsTimer);
    saveContactsTimer = setTimeout(() => {
        try {
            const unique = Array.from(new Set(contactsMap.values()));
            fs.writeFileSync(CONTACTS_FILE, JSON.stringify(unique, null, 2), 'utf-8');
        } catch {}
    }, 2000);
}

function unwrapMessage(msg) {
    if (!msg) return null;
    let m = msg.message || msg;
    let depth = 0;
    while (m && depth < 5) {
        depth++;
        if (m.ephemeralMessage?.message) {
            m = m.ephemeralMessage.message;
        } else if (m.viewOnceMessage?.message) {
            m = m.viewOnceMessage.message;
        } else if (m.viewOnceMessageV2?.message) {
            m = m.viewOnceMessageV2.message;
        } else if (m.viewOnceMessageV2Extension?.message) {
            m = m.viewOnceMessageV2Extension.message;
        } else if (m.documentWithCaptionMessage?.message) {
            m = m.documentWithCaptionMessage.message;
        } else {
            break;
        }
    }
    return m;
}

function extractMessageText(m) {
    if (!m) return '';
    if (typeof m === 'string') return m;
    const text =
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        m.templateMessage?.hydratedTemplate?.hydratedContentText ||
        m.templateMessage?.hydratedFourRowTemplate?.hydratedContentText ||
        m.interactiveMessage?.body?.text ||
        m.interactiveMessage?.header?.title ||
        m.buttonsMessage?.contentText ||
        m.listMessage?.description ||
        m.listMessage?.title ||
        m.buttonsResponseMessage?.selectedDisplayText ||
        m.templateButtonReplyMessage?.selectedDisplayText ||
        m.listResponseMessage?.title ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.interactiveResponseMessage?.body?.text ||
        (m.imageMessage ? '📷 Photo' : '') ||
        (m.videoMessage ? '🎥 Video' : '') ||
        (m.documentMessage ? `📄 Document: ${m.documentMessage.fileName || 'file'}` : '') ||
        (m.audioMessage ? (m.audioMessage.ptt ? '🎤 Voice message' : '🎵 Audio') : '') ||
        (m.stickerMessage ? '🏷️ Sticker' : '') ||
        (m.contactMessage ? `👤 Contact: ${m.contactMessage.displayName || ''}` : '') ||
        (m.contactsArrayMessage ? `👥 Contacts: ${m.contactsArrayMessage.contacts?.map(c => c.displayName).filter(Boolean).join(', ') || 'Contacts'}` : '') ||
        (m.pollCreationMessage ? `📊 Poll: ${m.pollCreationMessage.name || 'Poll'}` : '') ||
        (m.locationMessage ? `📍 Location${m.locationMessage.name ? ': ' + m.locationMessage.name : ''}` : '') ||
        (m.liveLocationMessage ? '📍 Live Location' : '') ||
        (m.reactionMessage ? `Reaction: ${m.reactionMessage.text || ''}` : '') ||
        '';
    return text || '';
}

/* =========================================================
   INCOMING MESSAGES STORAGE & BATCH ENGINE
========================================================= */

const INCOMING_FILE = path.join(__dirname, 'incoming_messages.json');
let incomingMessagesCache = null;

function getIncomingMessages(user = null) {
    let all = [];
    if (incomingMessagesCache) {
        all = incomingMessagesCache;
    } else {
        try {
            if (!fs.existsSync(INCOMING_FILE)) {
                fs.writeFileSync(INCOMING_FILE, JSON.stringify([], null, 2), 'utf-8');
                incomingMessagesCache = [];
                all = [];
            } else {
                const data = fs.readFileSync(INCOMING_FILE, 'utf-8');
                const list = JSON.parse(data || '[]');
                const realOnly = list.filter(m => m.from !== '919876543210' && m.from !== '919123456789' && !(m.message === 'Message' && !m.mediaUrl && !m.mediaType));
                realOnly.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                incomingMessagesCache = realOnly;
                all = realOnly;
            }
        } catch (e) {
            console.error('Error reading incoming messages:', e);
            all = [];
        }
    }

    if (!user || user.role === 'admin') {
        return all;
    }

    const userMobile10 = user.mobile ? String(user.mobile).replace(/\D/g, '').slice(-10) : '';
    return all.filter(m => {
        if (m.ownerUserId && m.ownerUserId === user.userId) return true;
        if (userMobile10) {
            const sClean = m.sessionPhone ? String(m.sessionPhone).replace(/\D/g, '').slice(-10) : '';
            const fClean = m.from ? String(m.from).replace(/\D/g, '').slice(-10) : '';
            const cClean = m.chatJid ? String(m.chatJid).replace(/\D/g, '').slice(-10) : '';
            if (sClean === userMobile10 || fClean === userMobile10 || cClean === userMobile10) return true;
        }
        return false;
    });
}

let incomingSaveTimer = null;
function persistIncomingMessages() {
    if (incomingSaveTimer) clearTimeout(incomingSaveTimer);
    incomingSaveTimer = setTimeout(() => {
        try {
            if (incomingMessagesCache) {
                fs.writeFileSync(INCOMING_FILE, JSON.stringify(incomingMessagesCache, null, 2), 'utf-8');
            }
        } catch (e) {
            console.error('Error persisting incoming messages:', e);
        }
    }, 1000);
}

function appendIncomingMessage(record) {
    const messages = getIncomingMessages();
    if (record.id && messages.some(m => m.id === record.id)) {
        return false;
    }
    messages.unshift(record);
    persistIncomingMessages();
    return true;
}

function appendIncomingMessagesBatch(records) {
    if (!Array.isArray(records) || records.length === 0) return 0;
    const messages = getIncomingMessages();
    const existingIds = new Set(messages.map(m => m.id));
    let added = 0;
    for (const r of records) {
        if (r.id && !existingIds.has(r.id)) {
            existingIds.add(r.id);
            messages.unshift(r);
            added++;
        }
    }
    if (added > 0) {
        messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        persistIncomingMessages();
    }
    return added;
}

function normalizeExistingMessages() {
    try {
        let messages = getIncomingMessages();
        const initialCount = messages.length;
        messages = messages.filter(m => !(m.message === 'Message' && !m.mediaUrl && !m.mediaType));
        let modified = messages.length !== initialCount;
        for (const m of messages) {
            if (m.chatJid && m.chatJid.includes('@lid')) {
                const resolved = resolveJidAndNumber(m.chatJid);
                if (resolved.jid && !resolved.jid.includes('@lid')) {
                    m.chatJid = resolved.jid;
                    modified = true;
                }
            }
            if (m.from && m.from.length > 13 && !m.from.startsWith('91') && !m.isGroup) {
                const num = getPhoneNumberFromLid(m.from);
                if (num) {
                    m.from = num;
                    modified = true;
                }
            }
            if (!m.fromMe && m.pushName === 'You') {
                m.pushName = null;
                modified = true;
            }
        }
        if (modified) {
            incomingMessagesCache = messages;
            persistIncomingMessages();
            console.log('✅ Normalized existing WhatsApp messages and purged bogus protocol messages.');
        }
    } catch (e) {
        console.error('Error normalizing messages:', e);
    }
}
normalizeExistingMessages();

function updateIncomingReadStatus(id, isRead = true) {
    try {
        const messages = getIncomingMessages();
        const msg = messages.find(m => m.id === id);
        if (msg) {
            msg.isRead = isRead;
            persistIncomingMessages();
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error updating read status:', e);
        return false;
    }
}

function markChatAsRead(chatJid) {
    try {
        const messages = getIncomingMessages();
        let changed = false;
        messages.forEach(m => {
            if ((m.chatJid === chatJid || m.from === chatJid) && !m.isRead) {
                m.isRead = true;
                changed = true;
            }
        });
        if (changed) {
            persistIncomingMessages();
        }
        return changed;
    } catch (e) {
        console.error('Error marking chat as read:', e);
        return false;
    }
}

function markAllIncomingRead() {
    try {
        const messages = getIncomingMessages();
        messages.forEach(m => { m.isRead = true; });
        persistIncomingMessages();
        return true;
    } catch (e) {
        console.error('Error marking all incoming read:', e);
        return false;
    }
}

function deleteChatMessages(chatJid) {
    try {
        const messages = getIncomingMessages();
        const filtered = messages.filter(m => m.chatJid !== chatJid && m.from !== chatJid);
        incomingMessagesCache = filtered;
        persistIncomingMessages();
        return true;
    } catch (e) {
        console.error('Error deleting chat messages:', e);
        return false;
    }
}

/* =========================================================
   API SETTINGS & 12-CHARACTER TOKEN SYSTEM
========================================================= */

const API_SETTINGS_FILE = path.join(__dirname, 'api_settings.json');

function generateToken12() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

function getApiSettings() {
    const envToken = process.env.API_MASTER_TOKEN ? String(process.env.API_MASTER_TOKEN).trim() : '';
    let settings = {
        token: envToken || generateToken12(),
        isEnabled: true,
        webhookUrl: '',
        webhookEnabled: false,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        totalSent: 0
    };
    try {
        if (fs.existsSync(API_SETTINGS_FILE)) {
            const data = fs.readFileSync(API_SETTINGS_FILE, 'utf-8');
            const parsed = JSON.parse(data || '{}');
            settings = { ...settings, ...parsed };
        }
    } catch (e) {
        console.error('Error reading API settings:', e);
    }
    if (envToken) {
        settings.token = envToken;
    } else if (!settings.token || settings.token.length !== 12) {
        settings.token = generateToken12();
        if (settings.isEnabled === undefined) settings.isEnabled = true;
    }
    return settings;
}

function saveApiSettings(settings) {
    try {
        const toSave = { ...settings };
        // If master token is managed via environment, do not write raw token to disk file
        if (process.env.API_MASTER_TOKEN) {
            toSave.token = '';
        }
        fs.writeFileSync(API_SETTINGS_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error saving API settings:', e);
        return false;
    }
}

let isSending = false;

/* =========================================================
   BASIC API
========================================================= */

app.get('/api/status', authRequired, adminRequired, async (req, res) => {
    let profilePicUrl = null;
    let profileName = null;
    if (sock && connectionStatus === 'connected' && sock.user) {
        profileName = sock.user.name || sock.user.notify || null;
        try {
            if (sock.user.id) {
                profilePicUrl = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => null);
            }
        } catch {}
    }
    const cleanNumber = connectedNumber ? String(connectedNumber).replace(/\D/g, '') : null;
    const jid = cleanNumber ? `${cleanNumber}@s.whatsapp.net` : null;

    res.json({
        status: connectionStatus,
        number: cleanNumber,
        profileName: profileName || (cleanNumber ? `+${cleanNumber}` : 'WhatsApp Account'),
        profilePicUrl: profilePicUrl,
        jid: jid,
        lastConnected: lastConnectedTime || new Date().toISOString(),
        device: 'Chrome (Windows) / WhatsApp Web',
        ready: connectionStatus === 'connected'
    });
});

app.get('/api/qr', authRequired, adminRequired, async (req, res) => {
    if (connectionStatus === 'connected') {
        return res.json({ status: 'connected', number: connectedNumber });
    }
    if (!latestQR) {
        return res.json({ status: 'waiting' });
    }
    try {
        const qrImage = await QRCode.toDataURL(latestQR);
        res.json({ status: 'qr', qr: qrImage });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/whatsapp/qr', authRequired, adminRequired, async (req, res) => {
    if (connectionStatus === 'connected') {
        return res.json({ success: true, status: 'connected', number: connectedNumber });
    }
    if (!latestQR) {
        return res.json({ success: true, status: 'waiting' });
    }
    try {
        const qrImage = await QRCode.toDataURL(latestQR);
        res.json({ success: true, status: 'qr', qr: qrImage });
    } catch (error) {
        res.status(500).json({ success: false, status: 'error', message: error.message });
    }
});

app.get('/api/admin/system-info', authRequired, adminRequired, (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const reports = getMessageReports();
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);

        res.json({
            success: true,
            info: {
                platform: process.platform,
                nodeVersion: process.version,
                uptime: `${hours}h ${minutes}m`,
                memoryRssMB: Math.round(memoryUsage.rss / 1024 / 1024),
                memoryHeapMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                connectedWhatsApp: connectedNumber || null,
                whatsappStatus: connectionStatus,
                totalMessagesLogged: reports.length,
                serverPort: PORT,
                timestamp: new Date().toISOString()
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/* =========================================================
   INCOMING MESSAGES API & REALTIME SSE
========================================================= */

app.get('/api/incoming/events', authRequired, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected', connectedNumber, connectionStatus })}\n\n`);
    sseClients.set(res, req.user);

    const pingInterval = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch {
            clearInterval(pingInterval);
            sseClients.delete(res);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(pingInterval);
        sseClients.delete(res);
    });
});

app.get('/api/incoming/messages', authRequired, (req, res) => {
    try {
        const { filter, search, chatJid } = req.query;
        let messages = getIncomingMessages(req.user);

        if (chatJid) {
            messages = messages.filter(m => m.chatJid === chatJid || m.from === chatJid);
        }

        if (filter === 'unread') {
            messages = messages.filter(m => !m.isRead);
        } else if (filter === 'read') {
            messages = messages.filter(m => m.isRead);
        } else if (filter === 'group') {
            messages = messages.filter(m => m.isGroup);
        } else if (filter === 'non_contact' || filter === 'direct') {
            messages = messages.filter(m => !m.isGroup);
        }

        if (search) {
            const q = search.toLowerCase();
            messages = messages.filter(m => 
                (m.from && m.from.toLowerCase().includes(q)) ||
                (m.pushName && m.pushName.toLowerCase().includes(q)) ||
                (m.groupName && m.groupName.toLowerCase().includes(q)) ||
                (m.message && m.message.toLowerCase().includes(q)) ||
                (m.fileName && m.fileName.toLowerCase().includes(q))
            );
        }

        const all = getIncomingMessages(req.user);
        const total = all.length;
        const unreadCount = all.filter(m => !m.isRead && !m.fromMe).length;
        const groupCount = all.filter(m => m.isGroup).length;
        const nonContactCount = all.filter(m => !m.isGroup).length;

        if (chatJid) {
            messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        res.json({
            success: true,
            messages,
            stats: {
                total,
                unread: unreadCount,
                read: total - unreadCount,
                group: groupCount,
                nonContact: nonContactCount
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/incoming/mark-read', authRequired, async (req, res) => {
    try {
        const { id, chatJid, isRead, all } = req.body || {};
        if (all) {
            markAllIncomingRead();
            broadcastIncomingEvent('read_update', { all: true });
            return res.json({ success: true, message: 'All messages marked as read' });
        }
        if (chatJid) {
            markChatAsRead(chatJid);
            if (sock && connectionStatus === 'connected') {
                try {
                    const unreadList = getIncomingMessages().filter(m => (m.chatJid === chatJid || m.from === chatJid) && !m.fromMe);
                    if (unreadList.length > 0) {
                        const target = unreadList[0];
                        await sock.readMessages([{ remoteJid: chatJid, id: target.id, participant: target.isGroup ? (target.from + '@s.whatsapp.net') : undefined }]);
                    }
                } catch {}
            }
            broadcastIncomingEvent('read_update', { chatJid });
            return res.json({ success: true, message: 'Chat marked as read' });
        }
        if (id) {
            const ok = updateIncomingReadStatus(id, isRead !== undefined ? Boolean(isRead) : true);
            broadcastIncomingEvent('read_update', { id });
            return res.json({ success: ok, message: ok ? 'Read status updated' : 'Message not found' });
        }
        return res.status(400).json({ success: false, message: 'id, chatJid or all:true required' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/incoming/chats', authRequired, (req, res) => {
    try {
        const { filter, search } = req.query;
        const allMessages = getIncomingMessages(req.user);
        const chatsMap = new Map();

        for (const msg of allMessages) {
            let jid = msg.chatJid || msg.from;
            if (!jid) continue;

            if (jid.includes('@lid')) {
                const resolved = resolveJidAndNumber(jid);
                if (resolved.jid && !resolved.jid.includes('@lid')) {
                    jid = resolved.jid;
                    msg.chatJid = jid;
                }
            }

            const isGroup = Boolean(msg.isGroup || jid.endsWith('@g.us'));
            const cleanNum = jid.split('@')[0].split(':')[0];

            if (!chatsMap.has(jid)) {
                let displayName = null;

                if (isGroup) {
                    displayName = msg.groupName || groupMetaCache.get(jid) || 'WhatsApp Group';
                } else {
                    const contact = contactsMap.get(jid) || contactsMap.get(cleanNum);
                    displayName = contact?.name || contact?.notify || contact?.verifiedName;

                    if (!displayName) {
                        const incomingFromContact = allMessages.find(m => 
                            (m.chatJid === jid || m.from === cleanNum) && 
                            !m.fromMe && 
                            m.pushName && 
                            m.pushName !== 'You'
                        );
                        if (incomingFromContact) {
                            displayName = incomingFromContact.pushName;
                        }
                    }

                    if (cleanNum === connectedNumber) {
                        displayName = `+${cleanNum} (You / Notes)`;
                    } else if (!displayName || displayName === 'You') {
                        displayName = '+' + cleanNum;
                    }
                }

                chatsMap.set(jid, {
                    chatJid: jid,
                    name: displayName,
                    from: isGroup ? jid : cleanNum,
                    pushName: displayName,
                    isGroup: isGroup,
                    groupName: isGroup ? displayName : null,
                    lastMessage: msg.message,
                    lastMediaType: msg.mediaType || null,
                    lastTimestamp: msg.date,
                    lastFromMe: Boolean(msg.fromMe),
                    unreadCount: 0,
                    mediaCount: 0,
                    messages: []
                });
            }

            const chat = chatsMap.get(jid);
            chat.messages.unshift(msg);
            if (!msg.isRead && !msg.fromMe) {
                chat.unreadCount++;
            }
            if (msg.mediaUrl || msg.mediaType) {
                chat.mediaCount++;
            }
        }

        let chats = Array.from(chatsMap.values());

        if (filter === 'unread') {
            chats = chats.filter(c => c.unreadCount > 0);
        } else if (filter === 'group') {
            chats = chats.filter(c => c.isGroup);
        } else if (filter === 'non_contact' || filter === 'direct') {
            chats = chats.filter(c => !c.isGroup);
        }

        if (search) {
            const q = search.toLowerCase();
            chats = chats.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.from && c.from.toLowerCase().includes(q)) ||
                (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
            );
        }

        chats.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());

        const allChats = Array.from(chatsMap.values());
        res.json({
            success: true,
            chats,
            stats: {
                total: allChats.length,
                unread: allChats.filter(c => c.unreadCount > 0).length,
                group: allChats.filter(c => c.isGroup).length,
                nonContact: allChats.filter(c => !c.isGroup).length
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/incoming/sync-chats', authRequired, async (req, res) => {
    try {
        normalizeExistingMessages();
        const all = getIncomingMessages(req.user);
        if (req.user.role === 'admin' && sock && connectionStatus === 'connected') {
            try {
                const groupJids = Array.from(new Set(all.filter(m => m.isGroup && m.chatJid?.endsWith('@g.us')).map(m => m.chatJid)));
                for (const gJid of groupJids) {
                    try {
                        const meta = await sock.groupMetadata(gJid);
                        if (meta && meta.subject) {
                            groupMetaCache.set(gJid, meta.subject);
                            all.forEach(m => {
                                if (m.chatJid === gJid) m.groupName = meta.subject;
                            });
                        }
                    } catch {}
                }
                persistIncomingMessages();
            } catch (gErr) {
                console.error('Group sync error:', gErr.message);
            }
        }
        const uniqueChats = new Set(all.map(m => m.chatJid || m.from));
        broadcastIncomingEvent('refresh', { timestamp: new Date().toISOString(), chatCount: uniqueChats.size }, req.user.userId);
        res.json({ success: true, message: 'WhatsApp chats synchronized successfully', chatCount: uniqueChats.size });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/incoming/reply', authRequired, attachmentBodyParser, async (req, res) => {
    try {
        const { chatJid, text, attachment, quotedMsgId } = req.body || {};
        if (!chatJid) {
            return res.status(400).json({ success: false, message: 'chatJid is required' });
        }
        if (!text && !attachment) {
            return res.status(400).json({ success: false, message: 'Message text or attachment is required' });
        }

        const { findOrLoadSession } = require('./userSessions');
        const sessionMatch = await findOrLoadSession(null, req.user);
        let activeSocket = null;
        let fromNumber = null;

        if (sessionMatch && sessionMatch.session?.status === 'connected' && sessionMatch.session?.socket) {
            activeSocket = sessionMatch.session.socket;
            fromNumber = sessionMatch.session.connectedNumber || sessionMatch.userId;
        } else if (req.user.role === 'admin' && global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') {
            activeSocket = global.__waAdminSocket;
            fromNumber = activeSocket?.user?.id ? String(activeSocket.user.id).split(':')[0].replace(/\D/g, '') : 'Admin';
        } else if (req.user.role === 'admin' && connectionStatus === 'connected' && sock) {
            activeSocket = sock;
            fromNumber = connectedNumber || 'Admin';
        }

        if (!activeSocket) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।'
            });
        }

        let sendPayload = {};
        let mediaUrl = null;
        let mediaType = null;
        let fileName = null;
        let fileSize = 0;
        let mimetype = null;

        if (attachment && attachment.data) {
            const base64Data = attachment.data.includes('base64,')
                ? attachment.data.split('base64,')
                : attachment.data;
            const buffer = Buffer.from(base64Data, 'base64');
            mimetype = attachment.type || 'application/octet-stream';
            fileName = attachment.name || 'file';
            fileSize = buffer.length;

            const ext = path.extname(fileName) || '.bin';
            const savedName = `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, savedName), buffer);
            mediaUrl = `/media/${savedName}`;

            if (mimetype.startsWith('image/')) {
                sendPayload = { image: buffer, caption: text || '', mimetype };
                mediaType = 'image';
            } else if (mimetype.startsWith('video/')) {
                sendPayload = { video: buffer, caption: text || '', mimetype };
                mediaType = 'video';
            } else if (mimetype.startsWith('audio/')) {
                sendPayload = { audio: buffer, mimetype, ptt: false };
                mediaType = 'audio';
            } else {
                sendPayload = { document: buffer, fileName: fileName, caption: text || '', mimetype };
                mediaType = 'document';
            }
        } else {
            sendPayload = { text: text || '' };
        }

        let sendOptions = {};
        if (quotedMsgId) {
            const existingMsgs = getIncomingMessages(req.user);
            const targetMsg = existingMsgs.find(m => m.id === quotedMsgId);
            if (targetMsg) {
                sendOptions.quoted = {
                    key: {
                        remoteJid: chatJid,
                        id: targetMsg.id,
                        fromMe: Boolean(targetMsg.fromMe),
                        participant: targetMsg.isGroup ? (targetMsg.from + '@s.whatsapp.net') : undefined
                    },
                    message: { conversation: targetMsg.message || '' }
                };
            }
        }

        const result = await activeSocket.sendMessage(chatJid, sendPayload, sendOptions);
        const sentId = result?.key?.id || ('out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));

        const myNumber = fromNumber || (req.user?.mobile ? String(req.user.mobile) : 'User');
        const outRecord = {
            id: sentId,
            date: new Date().toISOString(),
            ownerUserId: req.user.userId,
            from: myNumber,
            fromMe: true,
            pushName: req.user.username || 'You',
            chatJid: chatJid,
            isGroup: chatJid.endsWith('@g.us'),
            groupName: null,
            message: text || (mediaType ? `[${mediaType.toUpperCase()}]` : ''),
            mediaType: mediaType,
            mediaUrl: mediaUrl,
            fileName: fileName,
            fileSize: fileSize,
            mimetype: mimetype,
            isRead: true,
            quotedMsgId: quotedMsgId || null,
            quotedText: sendOptions.quoted ? (sendOptions.quoted.message?.conversation || 'Quoted Message') : null
        };

        appendIncomingMessage(outRecord);
        appendMessageReport({
            id: sentId,
            date: new Date().toISOString(),
            ownerUserId: req.user.userId,
            from: myNumber,
            to: chatJid.split('@')[0],
            message: text || (mediaType ? `[${mediaType.toUpperCase()}]` : ''),
            status: 'sent',
            session: myNumber
        });

        broadcastIncomingEvent('new_message', outRecord, req.user.userId, myNumber);

        res.json({ success: true, message: 'Reply sent successfully', data: outRecord });
    } catch (e) {
        console.error('Error sending reply:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/incoming/chat-info', authRequired, async (req, res) => {
    try {
        const { chatJid } = req.query;
        if (!chatJid) {
            return res.status(400).json({ success: false, message: 'chatJid is required' });
        }

        const isGroup = chatJid.endsWith('@g.us');
        let groupMeta = null;

        if (isGroup && sock && connectionStatus === 'connected') {
            try {
                groupMeta = await sock.groupMetadata(chatJid);
            } catch (err) {
                console.error('Could not fetch group metadata:', err.message);
            }
        }

        const all = getIncomingMessages(req.user).filter(m => m.chatJid === chatJid || m.from === chatJid);
        const mediaItems = all.filter(m => m.mediaUrl).map(m => ({
            id: m.id,
            date: m.date,
            type: m.mediaType,
            url: m.mediaUrl,
            fileName: m.fileName,
            fileSize: m.fileSize
        }));

        res.json({
            success: true,
            chatJid,
            isGroup,
            groupMetadata: groupMeta ? {
                subject: groupMeta.subject,
                desc: groupMeta.desc?.toString() || null,
                owner: groupMeta.owner,
                creation: groupMeta.creation,
                size: groupMeta.size || groupMeta.participants?.length || 0,
                participants: (groupMeta.participants || []).map(p => ({
                    id: p.id,
                    admin: p.admin || null,
                    number: p.id.split('@')[0]
                }))
            } : null,
            stats: {
                totalMessages: all.length,
                mediaCount: mediaItems.length
            },
            sharedMedia: mediaItems
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/incoming/chat', authRequired, (req, res) => {
    try {
        const chatJid = req.body?.chatJid || req.query?.chatJid;
        if (!chatJid) {
            return res.status(400).json({ success: false, message: 'chatJid is required' });
        }
        deleteChatMessages(chatJid);
        broadcastIncomingEvent('chat_deleted', { chatJid }, req.user.userId);
        res.json({ success: true, message: 'Chat messages cleared successfully' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/* =========================================================
   MESSAGE REPORTS API
========================================================= */

app.get('/api/reports/messages', authRequired, (req, res) => {
    try {
        const { startDate, endDate, status, search } = req.query;
        let reports = getMessageReports(req.user);

        if (startDate) {
            const start = new Date(startDate).getTime();
            reports = reports.filter(r => new Date(r.date).getTime() >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            reports = reports.filter(r => new Date(r.date).getTime() <= end.getTime());
        }
        if (status && status !== 'all') {
            reports = reports.filter(r => r.status === status);
        }
        if (search) {
            const q = search.toLowerCase();
            reports = reports.filter(r => 
                (r.to && r.to.toLowerCase().includes(q)) ||
                (r.from && r.from.toLowerCase().includes(q)) ||
                (r.message && r.message.toLowerCase().includes(q))
            );
        }

        res.json({
            success: true,
            total: reports.length,
            reports
        });
    } catch (error) {
        console.error('Reports fetch error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================================
   WHATSAPP LIST
========================================================= */

app.get('/api/whatsapp/list', authRequired, adminRequired, (req, res) => {
    if (connectionStatus !== 'connected' || !connectedNumber) {
        return res.json({
            success: true,
            whatsapp: []
        });
    }

    res.json({
        success: true,
        whatsapp: [
            {
                id: 'default',
                number: connectedNumber,
                name: 'Connected WhatsApp',
                status: 'connected'
            }
        ]
    });
});

/* =========================================================
   WHATSAPP GROUPS APIs
========================================================= */

app.get('/api/whatsapp/groups', authRequired, async (req, res) => {
    try {
        const { findOrLoadSession } = require('./userSessions');
        const match = await findOrLoadSession(null, req.user);
        let activeSocket = null;

        if (match && match.session?.status === 'connected' && match.session?.socket) {
            activeSocket = match.session.socket;
        } else if (req.user.role === 'admin') {
            activeSocket = global.__waAdminSocket || sock;
        }

        if (!activeSocket) {
            return res.status(400).json({ 
                success: false, 
                message: 'WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।' 
            });
        }

        let groups = {};
        try {
            groups = await activeSocket.groupFetchAllParticipating();
        } catch (err) {
            console.log('groupFetchAllParticipating failed, trying store/chats fallback:', err.message);
            if (activeSocket.chats) {
                const allChats = Object.values(activeSocket.chats);
                allChats.forEach(chat => {
                    if (chat.id && chat.id.endsWith('@g.us')) {
                        groups[chat.id] = chat;
                    }
                });
            }
        }

        const groupList = Object.values(groups).map(group => ({
            id: group.id || group.jid,
            subject: group.subject || group.name || 'Unnamed Group',
            size: group.participants?.length || group.size || 0,
            participants: group.participants || []
        }));

        res.json({ 
            success: true, 
            groups: groupList 
        });
    } catch (error) {
        console.error('Fetch groups error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/send-group-message', authRequired, async (req, res) => {
    try {
        const { groupIds, message } = req.body;

        const { findOrLoadSession } = require('./userSessions');
        const match = await findOrLoadSession(null, req.user);
        let activeSocket = null;
        let fromNumber = null;

        if (match && match.session?.status === 'connected' && match.session?.socket) {
            activeSocket = match.session.socket;
            fromNumber = match.session.connectedNumber || match.userId;
        } else if (req.user.role === 'admin') {
            activeSocket = global.__waAdminSocket || sock;
            fromNumber = connectedNumber || 'Admin';
        }

        if (!activeSocket) {
            return res.status(400).json({ 
                success: false, 
                message: 'WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।' 
            });
        }

        if (!Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'कम से कम एक group चुनें' 
            });
        }

        if (req.user.role !== 'admin' && groupIds.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'एक बार में अधिकतम 10 ग्रुप्स पर ही मैसेज भेजा जा सकता है।'
            });
        }

        if (!message || !String(message).trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message खाली नहीं हो सकता' 
            });
        }

        const results = [];

        for (const groupId of groupIds) {
            try {
                await activeSocket.sendMessage(groupId, { text: String(message) });
                results.push({ 
                    groupId, 
                    status: 'sent', 
                    message: 'Sent successfully', 
                    time: new Date().toISOString() 
                });
                appendMessageReport({
                    id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
                    date: new Date().toISOString(),
                    ownerUserId: req.user.userId,
                    from: fromNumber || String(req.user.mobile || 'User'),
                    to: groupId,
                    message: String(message),
                    status: 'sent',
                    session: fromNumber || 'default'
                });
            } catch (err) {
                results.push({ 
                    groupId, 
                    status: 'failed', 
                    error: err.message, 
                    time: new Date().toISOString() 
                });
                appendMessageReport({
                    id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
                    date: new Date().toISOString(),
                    ownerUserId: req.user.userId,
                    from: fromNumber || String(req.user.mobile || 'User'),
                    to: groupId,
                    message: String(message),
                    status: 'failed',
                    session: fromNumber || 'default'
                });
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        res.json({ 
            success: true, 
            results 
        });
    } catch (error) {
        console.error('Send group message error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.post('/api/whatsapp/extract-members', authRequired, async (req, res) => {
    try {
        const { groupIds } = req.body;

        const { findOrLoadSession } = require('./userSessions');
        const match = await findOrLoadSession(null, req.user);
        let activeSocket = null;

        if (match && match.session?.status === 'connected' && match.session?.socket) {
            activeSocket = match.session.socket;
        } else if (req.user.role === 'admin') {
            activeSocket = global.__waAdminSocket || sock;
        }

        if (!activeSocket) {
            return res.status(400).json({ 
                success: false, 
                message: 'WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।' 
            });
        }

        if (!Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'कम से कम एक group चुनें' 
            });
        }

        let allMembers = [];

        for (const groupId of groupIds) {
            try {
                const metadata = await activeSocket.groupMetadata(groupId);
                const groupName = metadata.subject;

                metadata.participants.forEach(p => {
                    allMembers.push({
                        groupName: groupName,
                        groupId: groupId,
                        userNumber: p.id.split('@')[0],
                        jid: p.id,
                        admin: p.admin || 'member'
                    });
                });
            } catch (err) {
                console.error(`Failed to fetch metadata for group ${groupId}:`, err.message);
            }
        }

        res.json({ 
            success: true, 
            members: allMembers 
        });
    } catch (error) {
        console.error('Extract members error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/* =========================================================
   NORMALIZE INDIAN NUMBER
========================================================= */

function normalizeIndianNumber(number) {
    if (!number) {
        return null;
    }

    let value = String(number)
        .trim()
        .replace(/\s+/g, '')
        .replace(/-/g, '')
        .replace(/\(/g, '')
        .replace(/\)/g, '');

    if (value.startsWith('+91')) {
        value = value.substring(3);
    }

    if (value.startsWith('91') && value.length === 12) {
        value = value.substring(2);
    }

    value = value.replace(/\D/g, '');

    if (!/^[6-9]\d{9}$/.test(value)) {
        return null;
    }

    return `91${value}`;
}

/* =========================================================
   SEND SINGLE WHATSAPP MESSAGE (WITH ATTACHMENT & BUTTONS)
========================================================= */

async function sendWhatsAppMessage(targetSocket, number, message, attachment = null, buttons = []) {
    const s = targetSocket || (global.__waAdminSocket || sock);
    if (!s || typeof s.sendMessage !== 'function') {
        throw new Error('WhatsApp socket is not available');
    }

    const jid = `${number}@s.whatsapp.net`;
    let textToSend = String(message || '').trim();

    if (Array.isArray(buttons) && buttons.length > 0) {
        const validButtons = buttons.filter(b => b && b.label && String(b.label).trim());
        if (validButtons.length > 0) {
            textToSend += (textToSend ? '\n\n' : '') + validButtons.map((b) => {
                if (b.type === 'url') {
                    return `🔗 ${b.label}: ${b.value || ''}`;
                } else if (b.type === 'call') {
                    return `📞 ${b.label}: ${b.value || ''}`;
                } else {
                    return `🔘 [${b.label}]`;
                }
            }).join('\n');
        }
    }

    if (attachment && attachment.data) {
        let buffer;
        if (Buffer.isBuffer(attachment.data)) {
            buffer = attachment.data;
        } else if (typeof attachment.data === 'string') {
            const base64Clean = attachment.data.replace(/^data:.*?;base64,/, '');
            buffer = Buffer.from(base64Clean, 'base64');
        } else {
            throw new Error('Invalid attachment data format');
        }

        const mimeType = attachment.type || 'application/octet-stream';
        const fileName = attachment.name || 'document';

        if (mimeType.startsWith('image/')) {
            await s.sendMessage(jid, { image: buffer, caption: textToSend || undefined, mimetype: mimeType });
        } else if (mimeType.startsWith('video/')) {
            await s.sendMessage(jid, { video: buffer, caption: textToSend || undefined, mimetype: mimeType });
        } else if (mimeType.startsWith('audio/')) {
            await s.sendMessage(jid, { audio: buffer, mimetype: mimeType, ptt: false });
            if (textToSend) {
                await s.sendMessage(jid, { text: textToSend });
            }
        } else {
            await s.sendMessage(jid, { document: buffer, fileName: fileName, caption: textToSend || undefined, mimetype: mimeType });
        }
        return;
    }

    if (!textToSend) {
        throw new Error('Message or attachment is required');
    }

    await s.sendMessage(jid, { text: textToSend });
}

/* =========================================================
   SEND MESSAGE API
========================================================= */

app.post('/api/send-message', authRequired, attachmentBodyParser, async (req, res) => {
    try {
        const { whatsappId, numbers, message, attachment, buttons } = req.body;

        const { findOrLoadSession } = require('./userSessions');
        const sessionMatch = await findOrLoadSession(whatsappId, req.user);
        let activeSocket = null;
        let fromNumber = null;

        if (sessionMatch && sessionMatch.session?.status === 'connected' && sessionMatch.session?.socket) {
            activeSocket = sessionMatch.session.socket;
            fromNumber = sessionMatch.session.connectedNumber || sessionMatch.userId;
        } else if (req.user.role === 'admin' && (!whatsappId || whatsappId === 'default' || whatsappId === 'admin')) {
            if (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') {
                activeSocket = global.__waAdminSocket;
                fromNumber = activeSocket?.user?.id ? String(activeSocket.user.id).split(':')[0].replace(/\D/g, '') : 'Admin';
            } else if (connectionStatus === 'connected' && sock) {
                activeSocket = sock;
                fromNumber = connectedNumber || 'Admin';
            }
        }

        if (!activeSocket) {
            return res.status(400).json({
                success: false,
                message: 'चयनित WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।'
            });
        }

        const hasMessage = message && String(message).trim();
        const hasAttachment = attachment && attachment.data;

        if (!hasMessage && !hasAttachment) {
            return res.status(400).json({
                success: false,
                message: 'कम से कम Message या Attachment देना आवश्यक है'
            });
        }

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'कम से कम एक mobile number दीजिए'
            });
        }

        const validNumbers = [];
        const invalidNumbers = [];

        for (const item of numbers) {
            const normalized = normalizeIndianNumber(item);
            if (normalized) {
                validNumbers.push(normalized);
            } else {
                invalidNumbers.push(item);
            }
        }

        if (validNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'कोई valid 10 digit Indian number नहीं मिला',
                invalidNumbers
            });
        }

        // Anti-spam campaign limit check for standard users
        const maxAllowed = req.user.role === 'admin' ? 1000 : 50;
        if (validNumbers.length > maxAllowed) {
            return res.status(400).json({
                success: false,
                message: `सुरक्षा सीमा: एक बार में अधिकतम ${maxAllowed} नंबरों पर ही मैसेज भेजा जा सकता है।`
            });
        }

        const job = {
            id: Date.now().toString(),
            ownerUserId: req.user.userId,
            fromNumber: fromNumber || String(req.user.mobile || 'User'),
            socket: activeSocket,
            numbers: validNumbers,
            message: String(message || ''),
            attachment: attachment || null,
            buttons: Array.isArray(buttons) ? buttons : [],
            invalidNumbers,
            results: [],
            createdAt: new Date().toISOString()
        };

        sendingQueue.push(job);
        processQueue();

        res.json({
            success: true,
            jobId: job.id,
            total: validNumbers.length,
            invalidNumbers,
            hasAttachment: Boolean(job.attachment),
            message: 'Message sending queue में डाल दिया गया है'
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================================
   QUEUE PROCESSOR
========================================================= */

async function processQueue() {
    if (isSending || sendingQueue.length === 0) {
        return;
    }

    const job = sendingQueue.shift();
    isSending = true;

    console.log(`\nStarting job: ${job.id} (Attachment: ${Boolean(job.attachment)}, Buttons: ${job.buttons?.length || 0})`);

    for (const number of job.numbers) {
        const reportContent = job.attachment
            ? `[${job.attachment.name || 'Attachment'}] ${job.message || ''}`.trim()
            : job.message;

        try {
            console.log(`Sending message to ${number}`);
            await sendWhatsAppMessage(job.socket, number, job.message, job.attachment, job.buttons);

            job.results.push({
                number,
                status: 'sent',
                message: 'Message sent successfully',
                time: new Date().toISOString()
            });

            appendMessageReport({
                id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
                date: new Date().toISOString(),
                ownerUserId: job.ownerUserId,
                from: job.fromNumber || connectedNumber || 'Admin',
                to: number,
                message: reportContent,
                status: 'sent',
                session: job.fromNumber || 'default'
            });

            console.log(`✅ Sent: ${number}`);
        } catch (error) {
            job.results.push({
                number,
                status: 'failed',
                message: error.message,
                time: new Date().toISOString()
            });

            appendMessageReport({
                id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
                date: new Date().toISOString(),
                ownerUserId: job.ownerUserId,
                from: job.fromNumber || connectedNumber || 'Admin',
                to: number,
                message: reportContent,
                status: 'failed',
                session: job.fromNumber || 'default'
            });

            console.log(`❌ Failed: ${number}`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`Job completed: ${job.id}`);
    isSending = false;
    setTimeout(processQueue, 100);
}

/* =========================================================
   JOB STATUS
========================================================= */

app.get('/api/send-status/:jobId', authRequired, (req, res) => {
    const jobId = req.params.jobId;
    const activeJob = sendingQueue.find(job => job.id === jobId);

    if (activeJob) {
        if (req.user.role !== 'admin' && activeJob.ownerUserId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied to this job.' });
        }
        return res.json({
            success: true,
            status: 'queued',
            job: activeJob
        });
    }

    res.json({
        success: true,
        status: 'processing_or_completed',
        jobId
    });
});

/* =========================================================
   API & WEBHOOKS SYSTEM (EXTERNAL /send-text ENDPOINTS)
========================================================= */

app.get('/api/settings/api-token', authRequired, adminRequired, (req, res) => {
    try {
        const settings = getApiSettings();
        const activeSession = connectedNumber ? String(connectedNumber).replace(/\D/g, '').slice(-10) : '';
        const host = req.get('host') || `localhost:${PORT}`;
        const protocol = req.protocol || 'http';
        const localBaseUrl = `${protocol}://${host}`;

        res.json({
            success: true,
            settings: {
                token: settings.token,
                isEnabled: settings.isEnabled !== false,
                webhookUrl: settings.webhookUrl || '',
                webhookEnabled: Boolean(settings.webhookEnabled),
                createdAt: settings.createdAt,
                lastUsed: settings.lastUsed,
                totalSent: settings.totalSent || 0
            },
            session: activeSession,
            connectedNumber: connectedNumber,
            connectionStatus: connectionStatus,
            localBaseUrl,
            sampleUrl: `${localBaseUrl}/send-text?token=${settings.token}&to=XXXXXXXXXX&message=Hello${activeSession ? `&session=${activeSession}` : ''}`,
            sampleLocalUrl: `${localBaseUrl}/send-text?token=${settings.token}&to=9876543210&message=Hello${activeSession ? `&session=${activeSession}` : ''}`,
            sampleProductionUrl: `https://chatagent.in/send-text?token=${settings.token}&to=9876543210&message=Hello${activeSession ? `&session=${activeSession}` : ''}`
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/settings/api-token/regenerate', authRequired, adminRequired, (req, res) => {
    try {
        const settings = getApiSettings();
        const newToken = generateToken12();
        settings.token = newToken;
        settings.createdAt = new Date().toISOString();
        saveApiSettings(settings);

        console.log(`[API Settings] Token regenerated`);
        res.json({
            success: true,
            token: newToken,
            message: 'New 12-character API token generated successfully'
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/settings/api-token/toggle', authRequired, adminRequired, (req, res) => {
    try {
        const settings = getApiSettings();
        settings.isEnabled = !settings.isEnabled;
        saveApiSettings(settings);

        res.json({
            success: true,
            isEnabled: settings.isEnabled,
            message: settings.isEnabled ? 'API is now active' : 'API has been paused'
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/settings/webhook', authRequired, adminRequired, (req, res) => {
    try {
        const { webhookUrl, webhookEnabled } = req.body || {};
        const settings = getApiSettings();
        if (webhookUrl !== undefined) settings.webhookUrl = String(webhookUrl).trim();
        if (webhookEnabled !== undefined) settings.webhookEnabled = Boolean(webhookEnabled);
        saveApiSettings(settings);

        res.json({
            success: true,
            webhookUrl: settings.webhookUrl,
            webhookEnabled: settings.webhookEnabled,
            message: 'Webhook settings saved successfully'
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

const apiTokenCache = new Map();

async function handleSendText(req, res) {
    res.setHeader('Connection', 'keep-alive');
    try {
        const token = String(req.query.token || req.body?.token || req.headers['x-api-token'] || '').trim();
        const to = String(req.query.to || req.body?.to || '').trim();
        const rawMessage = req.query.message !== undefined ? req.query.message : (req.body?.message !== undefined ? req.body?.message : (req.query.text !== undefined ? req.query.text : req.body?.text));
        const providedSession = String(req.query.session || req.body?.session || '').trim();
        const isAsync = req.query.async === '1' || req.query.fast === '1' || req.body?.async === 1;

        if (!token) {
            return res.status(401).json({ status: false, message: "Authentication failed: 'token' parameter is required." });
        }

        if (!to) {
            return res.status(400).json({ status: false, message: "Bad Request: Recipient phone number 'to' is required." });
        }

        const messageText = String(rawMessage || '').trim();
        if (!messageText) {
            return res.status(400).json({ status: false, message: "Bad Request: 'message' parameter cannot be empty." });
        }

        // Normalize destination number
        let normalizedTo = normalizeIndianNumber(to);
        if (!normalizedTo) {
            const clean = String(to).replace(/\D/g, '');
            if (clean.length === 10) normalizedTo = '91' + clean;
            else if (clean.length >= 11) normalizedTo = clean;
            else return res.status(400).json({ status: false, message: "Invalid mobile number. Provide a valid 10-digit mobile number." });
        }

        // 1. Authenticate token (Check in-memory cache first for lightning fast response)
        let user = null;
        let isGlobalAdmin = false;
        const now = Date.now();
        const cached = apiTokenCache.get(token);

        if (cached && cached.expiresAt > now) {
            user = cached.user;
            isGlobalAdmin = cached.isGlobalAdmin;
        } else {
            try {
                const { User } = require('./auth');
                user = await User.findOne({ apiToken: token, status: 'active' }).lean();
            } catch (dbErr) {
                console.warn('[API /send-text] DB user token lookup warn:', dbErr.message);
            }

            const settings = getApiSettings();
            if (!user && token === settings.token) {
                isGlobalAdmin = true;
            }

            if (!user && !isGlobalAdmin) {
                try {
                    const { authenticateToken } = require('./auth');
                    user = await authenticateToken(token);
                } catch {}
            }

            if (user || isGlobalAdmin) {
                apiTokenCache.set(token, { user, isGlobalAdmin, expiresAt: now + 60000 });
            }
        }

        if (!user && !isGlobalAdmin) {
            return res.status(401).json({ status: false, message: "Unauthorized: Invalid API token." });
        }

        const settings = getApiSettings();
        if (isGlobalAdmin && settings.isEnabled === false) {
            return res.status(403).json({ status: false, message: "Forbidden: API access is currently paused or disabled in settings." });
        }

        // 2. Resolve WhatsApp Session and Socket
        let activeSocket = null;
        let fromNumber = null;
        let activeSession10 = '';

        const { findOrLoadSession } = require('./userSessions');
        const caller = isGlobalAdmin ? { role: 'admin', userId: 'admin' } : user;

        // Session target resolution
        const targetSessionParam = providedSession || (caller.role === 'admin' ? 'admin' : caller.userId);

        try {
            const sessionMatch = await findOrLoadSession(targetSessionParam, caller);
            if (sessionMatch && sessionMatch.session?.status === 'connected' && sessionMatch.session?.socket) {
                activeSocket = sessionMatch.session.socket;
                fromNumber = sessionMatch.session.connectedNumber || sessionMatch.userId;
                activeSession10 = String(fromNumber).replace(/\D/g, '').slice(-10);
            }
        } catch (authErr) {
            return res.status(403).json({ status: false, message: authErr.message });
        }

        // Admin WhatsApp fallback: ONLY if caller is verified admin!
        const isAdminAuthorized = isGlobalAdmin || user?.role === 'admin';
        if (!activeSocket && isAdminAuthorized) {
            const adminPhone = global.__waAdminSocket?.user?.id 
                ? String(global.__waAdminSocket.user.id).split(':')[0].replace(/\D/g, '') 
                : (connectedNumber || '8840457632');
            const adminPhone10 = String(adminPhone).replace(/\D/g, '').slice(-10);

            if (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') {
                activeSocket = global.__waAdminSocket;
                fromNumber = adminPhone;
                activeSession10 = adminPhone10;
            } else if (connectionStatus === 'connected' && sock) {
                activeSocket = sock;
                fromNumber = connectedNumber || adminPhone;
                activeSession10 = adminPhone10;
            }
        }

        if (!activeSocket) {
            return res.status(503).json({
                status: false,
                message: `WhatsApp is not connected for this user session (${providedSession || user?.mobile || user?.userId || 'default'}). कृपया डैशबोर्ड से पहले WhatsApp स्कैन करें।`
            });
        }

        const jid = `${normalizedTo}@s.whatsapp.net`;
        const ownerUserId = isGlobalAdmin ? 'admin' : (user?.userId || null);

        // Fast / Async Mode: Instant HTTP response under 15ms
        if (isAsync) {
            const tempMessageId = 'api_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            res.status(200).json({
                status: true,
                message: "Message queued for immediate delivery",
                data: {
                    to: normalizedTo,
                    message: messageText,
                    session: activeSession10 || providedSession || null,
                    messageId: tempMessageId
                }
            });

            setImmediate(async () => {
                try {
                    const sendResult = await activeSocket.sendMessage(jid, { text: messageText });
                    const messageId = sendResult?.key?.id || tempMessageId;
                    appendMessageReport({
                        id: messageId,
                        date: new Date().toISOString(),
                        from: fromNumber || activeSession10,
                        to: normalizedTo,
                        message: messageText,
                        status: 'sent',
                        session: activeSession10 || providedSession || 'default',
                        ownerUserId: ownerUserId
                    });
                    const incomingRecord = {
                        id: messageId,
                        chatJid: jid,
                        from: fromNumber || activeSession10,
                        fromMe: true,
                        message: messageText,
                        date: new Date().toISOString(),
                        timestamp: Date.now(),
                        isRead: true,
                        ownerUserId: ownerUserId
                    };
                    appendIncomingMessage(incomingRecord);
                    broadcastIncomingEvent('new_message', incomingRecord);
                    if (isGlobalAdmin) {
                        settings.totalSent = (settings.totalSent || 0) + 1;
                        settings.lastUsed = new Date().toISOString();
                        saveApiSettings(settings);
                    }
                } catch (sendErr) {
                    console.error('[API /send-text Async] Send failed:', sendErr.message);
                }
            });
            return;
        }

        // 3. Normal Synchronous Mode: Send message via WhatsApp socket
        const sendResult = await activeSocket.sendMessage(jid, { text: messageText });
        const messageId = sendResult?.key?.id || ('api_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

        // 4. Send HTTP Response IMMEDIATELY (Do not wait for disk I/O)
        res.status(200).json({
            status: true,
            message: "Message sent successfully",
            data: {
                to: normalizedTo,
                message: messageText,
                session: activeSession10 || providedSession || null,
                messageId: messageId
            }
        });

        // 5. Asynchronous background logging and notifications
        setImmediate(() => {
            try {
                appendMessageReport({
                    id: messageId,
                    date: new Date().toISOString(),
                    from: fromNumber || activeSession10,
                    to: normalizedTo,
                    message: messageText,
                    status: 'sent',
                    session: activeSession10 || providedSession || 'default',
                    ownerUserId: ownerUserId
                });

                const incomingRecord = {
                    id: messageId,
                    chatJid: jid,
                    from: fromNumber || activeSession10,
                    fromMe: true,
                    message: messageText,
                    date: new Date().toISOString(),
                    timestamp: Date.now(),
                    isRead: true,
                    ownerUserId: ownerUserId
                };
                appendIncomingMessage(incomingRecord);
                broadcastIncomingEvent('new_message', incomingRecord);

                if (isGlobalAdmin) {
                    settings.totalSent = (settings.totalSent || 0) + 1;
                    settings.lastUsed = new Date().toISOString();
                    saveApiSettings(settings);
                }
            } catch (postErr) {
                console.warn('[API /send-text] Background report logging warning:', postErr.message);
            }
        });

        console.log(`[API /send-text] Message sent successfully to ${normalizedTo} via session ${activeSession10 || 'default'} (ID: ${messageId})`);
        return;
    } catch (error) {
        console.error('Error in /send-text API:', error);
        return res.status(500).json({ status: false, message: `Internal Server Error: ${error.message}` });
    }
}

app.get('/send-text', handleSendText);
app.post('/send-text', handleSendText);
app.get('/api/send-text', handleSendText);
app.post('/api/send-text', handleSendText);

/* =========================================================
   WHATSAPP CONNECTION
========================================================= */

let isStartingBot = false;
let adminReconnectTimer = null;

async function startBot() {
    if (isStartingBot) {
        console.log('[AdminSocket] Startup already in progress, skipping concurrent call.');
        return;
    }
    isStartingBot = true;

    if (adminReconnectTimer) {
        clearTimeout(adminReconnectTimer);
        adminReconnectTimer = null;
    }

    try {
        // Safely tear down and unbind existing Admin socket before creating a new one
        if (sock) {
            try {
                console.log('[AdminSocket] Safely tearing down previous Admin socket...');
                sock.ev?.removeAllListeners?.();
                sock.end?.();
            } catch (cleanupErr) {
                console.warn('[AdminSocket] Warning during previous socket teardown:', cleanupErr.message);
            } finally {
                sock = null;
            }
        }

        const { state, saveCreds } = await useMongoAuthState('admin');

        const newSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ["Chrome (Windows)", "Desktop", "10.0"],
            syncFullHistory: true,
            keepAliveIntervalMs: 30000,
            getMessage: async (key) => {
                const all = getIncomingMessages();
                const found = all.find(m => m.id === key?.id);
                if (found) {
                    return { conversation: found.message };
                }
                return undefined;
            }
        });

        sock = newSock;
        // Expose socket globally so auth.js can use it for OTP/signup messages
        global.__waAdminSocket = newSock;

        newSock.ev.on('connection.update', (update) => {
            // Guard against stale events from an older or replaced socket
            if (newSock !== sock) return;

            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                latestQR = qr;
                connectionStatus = 'qr';
                console.log('\nScan this QR code with WhatsApp:\n');
                qrcodeTerminal.generate(qr, { small: true });
                const { recordAdminWhatsAppSession } = require('./auth');
                recordAdminWhatsAppSession({ status: 'waiting' }).catch(() => {});
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                latestQR = null;
                connectedNumber = newSock.user?.id?.split(':')[0] || newSock.user?.id?.split('@')[0] || null;

                // Refresh global socket reference for auth.js OTP sending
                global.__waAdminSocket = newSock;

                console.log('=================================');
                console.log('✅ WhatsApp connected successfully!');
                console.log('WhatsApp:', connectedNumber);
                console.log('=================================');

                const { recordAdminWhatsAppSession } = require('./auth');
                recordAdminWhatsAppSession({ status: 'connected', phone: connectedNumber }).catch(() => {});

                lastConnectedTime = new Date().toISOString();
                broadcastIncomingEvent('connection_status', { status: 'connected', number: connectedNumber });
                processQueue();
            }

            if (connection === 'close') {
                connectionStatus = 'disconnected';
                connectedNumber = null;
                if (global.__waAdminSocket === newSock) {
                    global.__waAdminSocket = null; // Clear so auth.js knows WhatsApp is disconnected
                }
                broadcastIncomingEvent('connection_status', { status: 'disconnected', number: null });

                const { recordAdminWhatsAppSession } = require('./auth');
                recordAdminWhatsAppSession({ status: 'disconnected', phone: null }).catch(() => {});

                const statusCode = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : null;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    if (adminReconnectTimer) clearTimeout(adminReconnectTimer);
                    adminReconnectTimer = setTimeout(() => {
                        adminReconnectTimer = null;
                        startBot();
                    }, 3000);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
            try {
                if (Array.isArray(contacts) && contacts.length > 0) {
                    for (const c of contacts) {
                        saveContact(c);
                    }
                }
                if (Array.isArray(messages) && messages.length > 0) {
                    console.log(`Syncing WhatsApp history: ${messages.length} messages found`);
                    const batch = [];
                    for (const rawMsg of messages) {
                        if (!rawMsg || !rawMsg.message) continue;

                        const rawRemoteJid = rawMsg.key?.remoteJid || '';
                        if (!rawRemoteJid || rawRemoteJid === 'status@broadcast') continue;

                        const unwrapped = unwrapMessage(rawMsg.message);
                        if (!unwrapped) continue;

                        const isFromMe = Boolean(rawMsg.key?.fromMe);
                        const isGroup = rawRemoteJid.endsWith('@g.us');

                        const resolvedRemote = resolveJidAndNumber(rawRemoteJid, rawMsg.key?.remoteJidAlt);
                        const chatJid = resolvedRemote.jid;

                        let senderJid = rawRemoteJid;
                        if (isGroup) {
                            senderJid = rawMsg.key?.participant || rawRemoteJid;
                        }
                        const resolvedSender = resolveJidAndNumber(senderJid, rawMsg.key?.participantAlt);
                        // Fixed: use resolvedSender.number instead of resolvedSender.phoneNumber
                        const fromNumber = isFromMe ? (connectedNumber || 'me') : (resolvedSender.number || resolvedRemote.number || senderJid.split('@')[0]);

                        const text = extractMessageText(unwrapped);
                        const hasMedia = Boolean(unwrapped.imageMessage || unwrapped.videoMessage || unwrapped.audioMessage || unwrapped.documentMessage || unwrapped.stickerMessage);
                        if (!text && !hasMedia) continue;

                        let pushName = null;
                        if (!isFromMe) {
                            pushName = rawMsg.pushName || null;
                            if (pushName && resolvedSender.number) {
                                saveContact({ id: resolvedSender.jid, notify: pushName });
                            }
                        }

                        batch.push({
                            id: rawMsg.key?.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
                            date: new Date(rawMsg.messageTimestamp ? (rawMsg.messageTimestamp * 1000) : Date.now()).toISOString(),
                            from: fromNumber,
                            fromMe: isFromMe,
                            pushName: pushName,
                            chatJid: chatJid,
                            isGroup: isGroup,
                            groupName: isGroup ? 'WhatsApp Group' : null,
                            message: text || (hasMedia ? 'Media' : ''),
                            isRead: isFromMe ? true : false
                        });
                    }
                    if (batch.length > 0) {
                        const addedCount = appendIncomingMessagesBatch(batch);
                        console.log(`History sync: appended ${addedCount} new messages from history set`);
                        broadcastIncomingEvent('refresh', { count: addedCount });
                    }
                }
            } catch (err) {
                console.error('Error in messaging-history.set:', err.message);
            }
        });

        sock.ev.on('contacts.upsert', (contacts) => {
            if (Array.isArray(contacts)) {
                for (const c of contacts) saveContact(c);
            }
        });

        sock.ev.on('contacts.update', (updates) => {
            if (Array.isArray(updates)) {
                for (const u of updates) saveContact(u);
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            await handleIncomingMessageFromSocket(m, {
                ownerUserId: 'admin',
                socket: sock,
                sessionPhone: connectedNumber
            });
        });
    } catch (error) {
        console.error('WhatsApp startup error:', error);
        connectionStatus = 'disconnected';
        if (adminReconnectTimer) clearTimeout(adminReconnectTimer);
        adminReconnectTimer = setTimeout(() => {
            adminReconnectTimer = null;
            startBot();
        }, 5000);
    } finally {
        isStartingBot = false;
    }
}

async function handleIncomingMessageFromSocket(m, context = {}) {
    try {
        const targetSocket = context.socket || sock;
        const ownerUserId = context.ownerUserId || 'admin';
        const sessionConnectedNumber = context.sessionPhone || (ownerUserId === 'admin' ? connectedNumber : null);

        const msgs = m.messages || [];
        for (const rawMsg of msgs) {
            if (!rawMsg || !rawMsg.message) continue;

            const rawRemoteJid = rawMsg.key?.remoteJid || '';
            if (!rawRemoteJid || rawRemoteJid === 'status@broadcast') continue;

            const unwrapped = unwrapMessage(rawMsg.message);
            if (!unwrapped) continue;

            const isFromMe = Boolean(rawMsg.key && rawMsg.key.fromMe);
            const isGroup = rawRemoteJid.endsWith('@g.us');

            const resolvedRemote = resolveJidAndNumber(rawRemoteJid, rawMsg.key?.remoteJidAlt);
            const chatJid = resolvedRemote.jid;

            let senderJid = rawRemoteJid;
            if (isGroup) {
                senderJid = rawMsg.key?.participant || rawRemoteJid;
            }
            const resolvedSender = resolveJidAndNumber(senderJid, rawMsg.key?.participantAlt);
            const fromNumber = isFromMe ? (sessionConnectedNumber || 'me') : (resolvedSender.number || resolvedRemote.number || senderJid.split('@')[0]);

            let pushName = null;
            if (!isFromMe) {
                pushName = rawMsg.pushName || null;
                if (pushName && resolvedSender.number) {
                    saveContact({ id: resolvedSender.jid, notify: pushName });
                }
            }

            let mediaType = null;
            let mediaUrl = null;
            let fileName = null;
            let fileSize = 0;
            let mimetype = null;

            const imgMsg = unwrapped.imageMessage;
            const vidMsg = unwrapped.videoMessage;
            const audMsg = unwrapped.audioMessage;
            const docMsg = unwrapped.documentMessage;
            const stkMsg = unwrapped.stickerMessage;

            if (imgMsg) {
                mediaType = 'image';
                mimetype = imgMsg.mimetype || 'image/jpeg';
                fileName = `image_${Date.now()}.jpg`;
            } else if (vidMsg) {
                mediaType = 'video';
                mimetype = vidMsg.mimetype || 'video/mp4';
                fileName = `video_${Date.now()}.mp4`;
            } else if (audMsg) {
                mediaType = 'audio';
                mimetype = audMsg.mimetype || 'audio/ogg';
                fileName = `audio_${Date.now()}.ogg`;
            } else if (docMsg) {
                mediaType = 'document';
                mimetype = docMsg.mimetype || 'application/pdf';
                fileName = docMsg.fileName || `document_${Date.now()}.pdf`;
            } else if (stkMsg) {
                mediaType = 'sticker';
                mimetype = stkMsg.mimetype || 'image/webp';
                fileName = `sticker_${Date.now()}.webp`;
            }

            if (mediaType) {
                try {
                    const buffer = await downloadMediaMessage(rawMsg, 'buffer', {});
                    if (buffer && buffer.length) {
                        fileSize = buffer.length;
                        const ext = path.extname(fileName) || (mediaType === 'image' ? '.jpg' : mediaType === 'video' ? '.mp4' : mediaType === 'audio' ? '.ogg' : '.bin');
                        const savedFileName = `${rawMsg.key?.id || Date.now()}${ext}`;
                        fs.writeFileSync(path.join(MEDIA_DIR, savedFileName), buffer);
                        mediaUrl = `/media/${savedFileName}`;
                    }
                } catch (mErr) {
                    console.error('[Media Download Error]:', mErr.message);
                }
            }

            let groupName = null;
            if (isGroup) {
                if (groupMetaCache.has(rawRemoteJid)) {
                    groupName = groupMetaCache.get(rawRemoteJid);
                } else if (targetSocket?.groupMetadata) {
                    try {
                        const groupMeta = await targetSocket.groupMetadata(rawRemoteJid);
                        groupName = groupMeta.subject || 'WhatsApp Group';
                        groupMetaCache.set(rawRemoteJid, groupName);
                    } catch {
                        groupName = 'WhatsApp Group';
                    }
                }
            }

            let quotedText = null;
            let quotedParticipant = null;
            const contextInfo = unwrapped.extendedTextMessage?.contextInfo ||
                unwrapped.imageMessage?.contextInfo ||
                unwrapped.videoMessage?.contextInfo ||
                unwrapped.documentMessage?.contextInfo;

            if (contextInfo?.quotedMessage) {
                const unwrappedQuoted = unwrapMessage(contextInfo.quotedMessage);
                quotedText = extractMessageText(unwrappedQuoted) || 'Message';
                const resolvedQuotedPart = resolveJidAndNumber(contextInfo.participant || '');
                quotedParticipant = resolvedQuotedPart.number || contextInfo.participant?.split('@')[0] || null;
            }

            const text = extractMessageText(unwrapped);
            if (!text && !mediaType) {
                continue;
            }

            const record = {
                id: rawMsg.key?.id || ('inc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
                date: new Date(rawMsg.messageTimestamp ? (rawMsg.messageTimestamp * 1000) : Date.now()).toISOString(),
                from: fromNumber,
                fromMe: isFromMe,
                pushName: pushName,
                chatJid: chatJid,
                isGroup: isGroup,
                groupName: groupName,
                message: text || (mediaType ? `[${mediaType}]` : 'Media'),
                mediaType: mediaType,
                mediaUrl: mediaUrl,
                fileName: fileName,
                fileSize: fileSize,
                mimetype: mimetype,
                quotedText: quotedText,
                quotedParticipant: quotedParticipant,
                isRead: isFromMe ? true : false,
                ownerUserId: ownerUserId
            };

            const appended = appendIncomingMessage(record);
            if (appended) {
                broadcastIncomingEvent('new_message', record);
            }

            if (!isFromMe) {
                try {
                    const apiSet = getApiSettings();
                    if (apiSet.webhookEnabled && apiSet.webhookUrl) {
                        fetch(apiSet.webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                event: 'incoming_message',
                                data: record,
                                timestamp: new Date().toISOString()
                            })
                        }).catch(wErr => console.error('[Webhook Dispatch Error]', wErr.message));
                    }
                } catch {}
            }
        }
    } catch (err) {
        console.error('Error handling incoming message from socket:', err.message);
    }
}

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    startBot();
});

// Admin Watchdog: Ensure Admin WhatsApp socket remains 24/7 active
const adminWatchdog = setInterval(async () => {
    if (connectionStatus === 'disconnected') {
        try {
            const SessionAuth = require('./models/SessionAuth');
            const hasCreds = await SessionAuth.exists({ id: 'admin_creds.json' });
            if (hasCreds) {
                console.log('[AdminWatchdog] Admin WhatsApp offline, auto-reconnecting from MongoDB...');
                startBot().catch(e => console.error('[AdminWatchdog] Reconnect err:', e.message));
            }
        } catch (e) {
            // DB not connected or lookup error
        }
    }
}, 45000);
if (typeof adminWatchdog?.unref === 'function') adminWatchdog.unref();

module.exports = {
    app,
    startBot,
    appendMessageReport,
    appendIncomingMessage,
    broadcastIncomingEvent,
    getMessageReports,
    normalizeIndianNumber,
    handleIncomingMessageFromSocket
};