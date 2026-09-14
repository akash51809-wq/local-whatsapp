const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { useMongoAuthState } = require('./mongoAuthState');
const { WhatsAppSession } = require('./auth');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');

const sessions = new Map();

async function startUserSession(userId) {
    if (sessions.has(userId)) {
        const currentSession = sessions.get(userId);
        if (currentSession.status === 'connected') {
            return {
                status: currentSession.status,
                connectedNumber: currentSession.connectedNumber,
                qr: null
            };
        }
    }

    const sessionId = `user-${userId}`;
    const { state, saveCreds } = await useMongoAuthState(sessionId);

    console.log(`[UserSession] Starting session for user ${userId}`);

    const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Chrome (Windows)', 'Desktop', '10.0']
    });

    const sessionData = {
        socket,
        status: 'connecting',
        connectedNumber: null,
        profileName: null,
        qr: null,
        saveCreds
    };

    sessions.set(userId, sessionData);

    let sessionRecord = await WhatsAppSession.findOne({ ownerUserId: userId });
    if (!sessionRecord) {
        sessionRecord = new WhatsAppSession({
            sessionId: sessionId,
            ownerUserId: userId,
            role: 'user',
            status: 'connecting',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    } else {
        sessionRecord.status = 'connecting';
        sessionRecord.updatedAt = new Date();
    }
    await sessionRecord.save();

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const currentSession = sessions.get(userId);
        
        if (!currentSession) return;

        if (qr) {
            console.log(`[UserSession] Received QR for user ${userId}`);
            currentSession.qr = qr;
            currentSession.status = 'waiting';
            
            await WhatsAppSession.updateOne(
                { ownerUserId: userId },
                { status: 'waiting', updatedAt: new Date() }
            );
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            
            console.log(`[UserSession] Connection closed for user ${userId}, reconnecting: ${shouldReconnect}`);
            
            currentSession.status = 'disconnected';
            
            await WhatsAppSession.updateOne(
                { ownerUserId: userId },
                { status: 'disconnected', updatedAt: new Date() }
            );

            if (shouldReconnect) {
                setTimeout(() => startUserSession(userId), 3000);
            } else {
                sessions.delete(userId);
            }
        } else if (connection === 'open') {
            console.log(`[UserSession] User ${userId} connected`);
            currentSession.status = 'connected';
            currentSession.qr = null;
            currentSession.connectedNumber = socket.user?.id?.split(':')[0] || null;
            currentSession.profileName = socket.user?.name || null;
            
            await WhatsAppSession.updateOne(
                { ownerUserId: userId },
                { 
                    status: 'connected', 
                    phone: currentSession.connectedNumber,
                    lastConnectedAt: new Date(),
                    updatedAt: new Date() 
                }
            );
        }
    });

    socket.ev.on('creds.update', saveCreds);

    return {
        status: sessionData.status,
        qr: sessionData.qr,
        connectedNumber: sessionData.connectedNumber
    };
}

async function stopUserSession(userId) {
    const session = sessions.get(userId);
    if (session) {
        if (session.socket) {
            session.socket.end(new Error('Session stopped by user'));
        }
        sessions.delete(userId);
    }
    
    await WhatsAppSession.updateOne(
        { ownerUserId: userId },
        { status: 'disconnected', updatedAt: new Date() }
    );
    console.log(`[UserSession] Session stopped for user ${userId}`);
}

function getUserSession(userId) {
    return sessions.get(userId) || null;
}

async function getUserQR(userId) {
    const session = sessions.get(userId);
    if (!session) {
        return { status: 'disconnected', qr: null, connectedNumber: null };
    }
    
    if (session.status === 'connected') {
        return { status: 'connected', qr: null, connectedNumber: session.connectedNumber };
    }

    if (session.qr) {
        try {
            const qrDataUrl = await QRCode.toDataURL(session.qr);
            return { status: session.status, qr: qrDataUrl, connectedNumber: null };
        } catch (error) {
            console.error(`[UserSession] Error generating QR for user ${userId}:`, error);
            return { status: session.status, qr: null, connectedNumber: null };
        }
    }

    return { status: session.status, qr: null, connectedNumber: null };
}

async function sendUserMessage(userId, jid, content) {
    const session = sessions.get(userId);
    if (!session || session.status !== 'connected' || !session.socket) {
        throw new Error('User session is not connected');
    }
    
    return await session.socket.sendMessage(jid, content);
}

function getSessionByPhoneOrUserId(param) {
    if (!param) return null;
    const clean = String(param).replace(/\D/g, '');
    const clean10 = clean.slice(-10);

    // 1. Direct match by userId in sessions map
    if (sessions.has(param)) {
        return { userId: param, session: sessions.get(param) };
    }

    // 2. Match by connectedNumber in active sessions
    for (const [userId, session] of sessions.entries()) {
        if (session.connectedNumber) {
            const sClean = String(session.connectedNumber).replace(/\D/g, '');
            if (sClean === clean || (clean10.length === 10 && sClean.slice(-10) === clean10)) {
                return { userId, session };
            }
        }
    }

    return null;
}

async function findOrLoadSession(sessionParam, userIdFallback = null) {
    // 1. Try active in-memory session first
    let match = getSessionByPhoneOrUserId(sessionParam);
    if (match && match.session?.status === 'connected') {
        return match;
    }

    // 2. Try by userIdFallback if provided
    const targetUserId = match?.userId || userIdFallback;
    if (targetUserId) {
        const s = sessions.get(targetUserId);
        if (s && s.status === 'connected') return { userId: targetUserId, session: s };
        
        const dbS = await WhatsAppSession.findOne({ ownerUserId: targetUserId });
        if (dbS && dbS.status === 'connected') {
            await startUserSession(targetUserId);
            const reloaded = sessions.get(targetUserId);
            if (reloaded) return { userId: targetUserId, session: reloaded };
        }
    }

    // 3. Search in MongoDB by phone number
    if (sessionParam) {
        const clean10 = String(sessionParam).replace(/\D/g, '').slice(-10);
        if (clean10.length === 10) {
            const dbS = await WhatsAppSession.findOne({
                phone: { $regex: clean10 + '$' },
                role: 'user'
            });
            if (dbS && dbS.ownerUserId) {
                if (!sessions.has(dbS.ownerUserId) && dbS.status === 'connected') {
                    await startUserSession(dbS.ownerUserId);
                }
                const s = sessions.get(dbS.ownerUserId);
                return { userId: dbS.ownerUserId, session: s, dbSession: dbS };
            }
        }
    }

    return null;
}

async function restoreAllSessions() {
    try {
        const activeSessions = await WhatsAppSession.find({ role: 'user', status: 'connected' });
        console.log(`[UserSession] Found ${activeSessions.length} active sessions to restore`);
        
        for (const sessionRecord of activeSessions) {
            const userId = sessionRecord.ownerUserId;
            if (userId) {
                console.log(`[UserSession] Restoring session for user ${userId}`);
                await startUserSession(userId);
            }
        }
    } catch (error) {
        console.error('[UserSession] Error restoring sessions:', error);
    }
}

module.exports = {
    sessions,
    startUserSession,
    stopUserSession,
    getUserSession,
    getUserQR,
    sendUserMessage,
    getSessionByPhoneOrUserId,
    findOrLoadSession,
    restoreAllSessions
};
