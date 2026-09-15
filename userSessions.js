const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { useMongoAuthState } = require('./mongoAuthState');
const { WhatsAppSession } = require('./auth');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');

const sessions = new Map();

async function startUserSession(userId) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId || normalizedUserId.toUpperCase() === 'ADMIN') {
        console.warn(`[UserSession] BLOCKED admin userId=${userId} from user session`);
        return {
            status: 'blocked',
            error: 'Admin user must use the dedicated Admin WhatsApp session (sessionId=admin)',
            qr: null,
            connectedNumber: null
        };
    }

    if (sessions.has(userId)) {
        const currentSession = sessions.get(userId);
        if (currentSession.status === 'connected' && currentSession.socket) {
            return {
                status: currentSession.status,
                connectedNumber: currentSession.connectedNumber,
                qr: null
            };
        }
        // If already connecting within the last 15 seconds, avoid resetting socket
        if (currentSession.status === 'connecting' && currentSession.connectingSince && (Date.now() - currentSession.connectingSince < 15000)) {
            return {
                status: 'connecting',
                connectedNumber: currentSession.connectedNumber,
                qr: currentSession.qr
            };
        }
        // Clean up previous socket before starting a new one
        if (currentSession.socket) {
            try {
                currentSession.socket.ev?.removeAllListeners?.();
                currentSession.socket.end?.();
            } catch (e) {}
        }
    }

    const sessionId = `user-${userId}`;
    const { state, saveCreds } = await useMongoAuthState(sessionId);

    console.log(`[UserSession] Starting session for user ${userId}`);

    const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Chrome (Windows)', 'Desktop', '10.0'],
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    const sessionData = {
        socket,
        status: 'connecting',
        connectingSince: Date.now(),
        connectedNumber: null,
        profileName: null,
        qr: null,
        saveCreds
    };

    sessions.set(userId, sessionData);

    let sessionRecord = await WhatsAppSession.findOne({ 
        $or: [{ ownerUserId: userId }, { sessionId: sessionId }] 
    });
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
            if (String(userId || '').trim().toUpperCase() === 'ADMIN') {
                console.warn(`[UserSession] BLOCKED QR for admin user ${userId}`);
                return;
            }
            console.log(`[UserSession] Received QR for user ${userId}`);
            currentSession.qr = qr;
            currentSession.status = 'waiting';
            
            await WhatsAppSession.updateOne(
                { $or: [{ ownerUserId: userId }, { sessionId: sessionId }] },
                { status: 'waiting', updatedAt: new Date() }
            );

            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                const { broadcastIncomingEvent } = require('./index');
                if (typeof broadcastIncomingEvent === 'function') {
                    broadcastIncomingEvent('connection_status', { 
                        status: 'waiting', 
                        qr: qrDataUrl, 
                        userId 
                    }, userId);
                }
            } catch (e) {}
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : null;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const shouldReconnect = !isLoggedOut;
            
            console.log(`[UserSession] Connection closed for user ${userId}, statusCode: ${statusCode}, reconnecting: ${shouldReconnect}, isLoggedOut: ${isLoggedOut}`);
            
            currentSession.status = isLoggedOut ? 'logged_out' : 'connecting';
            currentSession.connectingSince = shouldReconnect ? Date.now() : null;
            
            await WhatsAppSession.updateOne(
                { $or: [{ ownerUserId: userId }, { sessionId: sessionId }] },
                { 
                    status: isLoggedOut ? 'logged_out' : 'connecting', 
                    updatedAt: new Date() 
                }
            );

            try {
                const { broadcastIncomingEvent } = require('./index');
                if (typeof broadcastIncomingEvent === 'function') {
                    broadcastIncomingEvent('connection_status', { 
                        status: isLoggedOut ? 'logged_out' : 'connecting', 
                        number: null,
                        userId 
                    }, userId);
                }
            } catch (e) {}

            if (shouldReconnect) {
                setTimeout(() => startUserSession(userId), 3000);
            } else {
                sessions.delete(userId);
            }
        } else if (connection === 'open') {
            console.log(`[UserSession] User ${userId} connected`);
            currentSession.status = 'connected';
            currentSession.qr = null;
            const rawId = socket.user?.id || '';
            const phoneNum = rawId ? rawId.split(':')[0].split('@')[0].replace(/\D/g, '') : null;
            currentSession.connectedNumber = phoneNum;
            currentSession.profileName = socket.user?.name || socket.user?.notify || (phoneNum ? `+${phoneNum}` : null);
            
            await WhatsAppSession.updateOne(
                { $or: [{ ownerUserId: userId }, { sessionId: sessionId }] },
                { 
                    status: 'connected', 
                    phone: phoneNum,
                    lastConnectedAt: new Date(),
                    updatedAt: new Date() 
                }
            );

            try {
                const { broadcastIncomingEvent } = require('./index');
                if (typeof broadcastIncomingEvent === 'function') {
                    broadcastIncomingEvent('connection_status', { 
                        status: 'connected', 
                        number: phoneNum,
                        profileName: currentSession.profileName,
                        userId 
                    }, userId, phoneNum);
                }
            } catch (e) {}
        }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
        try {
            const indexModule = require('./index');
            if (indexModule && typeof indexModule.handleIncomingMessageFromSocket === 'function') {
                indexModule.handleIncomingMessageFromSocket(m, {
                    ownerUserId: userId,
                    socket,
                    sessionPhone: sessionData.connectedNumber
                });
            }
        } catch (err) {
            console.warn(`[UserSession ${userId}] messages.upsert warn:`, err.message);
        }
    });

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
    if (String(userId || '').trim().toUpperCase() === 'ADMIN') {
        console.warn(`[UserSession] BLOCKED QR request for admin user ${userId}`);
        return { status: 'blocked', qr: null, connectedNumber: null };
    }

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

/**
 * findOrLoadSession with strict security & multi-tenant isolation
 * @param {string} sessionParam - Requested session identifier or phone
 * @param {object|string} caller - Authenticated caller user object ({ userId, role, mobile }) or userId string
 */
async function findOrLoadSession(sessionParam, caller = null) {
    const callerUser = (caller && typeof caller === 'object') ? caller : (caller ? { userId: caller, role: 'user' } : null);
    const isAdmin = callerUser?.role === 'admin';
    const callerUserId = callerUser?.userId || null;
    const callerMobile10 = callerUser?.mobile ? String(callerUser.mobile).replace(/\D/g, '').slice(-10) : '';

    const clean = sessionParam ? String(sessionParam).replace(/\D/g, '') : '';
    const clean10 = clean.slice(-10);

    const adminPhone = global.__waAdminSocket?.user?.id 
        ? String(global.__waAdminSocket.user.id).split(':')[0].replace(/\D/g, '') 
        : (process.env.ADMIN_PHONE || '8840457632');
    const adminPhone10 = String(adminPhone).replace(/\D/g, '').slice(-10);

    // 1. SECURITY CHECK: Non-admin users cannot access the Admin session
    const isTargetingAdmin = sessionParam === 'admin' || (clean10 && clean10 === adminPhone10);
    if (isTargetingAdmin && !isAdmin) {
        const err = new Error('केवल एडमिन को एडमिन व्हाट्सऐप सेशन का उपयोग करने की अनुमति है।');
        err.statusCode = 403;
        throw err;
    }

    // 2. If Admin explicitly requests or defaults to Admin session
    if (isAdmin && (isTargetingAdmin || !sessionParam)) {
        if (global.__waAdminSocket && typeof global.__waAdminSocket.sendMessage === 'function') {
            return {
                userId: 'ADMIN',
                isAdmin: true,
                session: {
                    socket: global.__waAdminSocket,
                    status: 'connected',
                    connectedNumber: adminPhone
                }
            };
        }
        return {
            userId: 'ADMIN',
            isAdmin: true,
            session: {
                socket: global.__waAdminSocket || null,
                status: 'connecting',
                connectedNumber: adminPhone
            }
        };
    }

    // 3. For NON-ADMIN: Strict user session isolation
    if (!isAdmin && callerUserId) {
        // If sessionParam was provided, ensure it belongs to this caller
        if (sessionParam && sessionParam !== `user-${callerUserId}` && sessionParam !== callerUserId) {
            const activeS = sessions.get(callerUserId);
            const active10 = activeS?.connectedNumber ? String(activeS.connectedNumber).replace(/\D/g, '').slice(-10) : '';
            if (clean10 && clean10 !== callerMobile10 && clean10 !== active10) {
                const err = new Error('सुरक्षा उल्लंघन: आप केवल अपने स्वयं के व्हाट्सऐप सेशन का उपयोग कर सकते हैं।');
                err.statusCode = 403;
                throw err;
            }
        }

        // Return user's session
        let s = sessions.get(callerUserId);
        if (s && s.status === 'connected' && s.socket) return { userId: callerUserId, session: s };

        // If currently connecting, wait up to 3 seconds for it to finish connecting
        if (s && s.status === 'connecting') {
            for (let wait = 0; wait < 6; wait++) {
                s = sessions.get(callerUserId);
                if (s && s.status === 'connected' && s.socket) {
                    return { userId: callerUserId, session: s };
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }

        const dbS = await WhatsAppSession.findOne({ 
            $or: [{ ownerUserId: callerUserId }, { sessionId: `user-${callerUserId}` }],
            status: { $ne: 'logged_out' } 
        });
        if (dbS) {
            await startUserSession(callerUserId);
            for (let wait = 0; wait < 6; wait++) {
                s = sessions.get(callerUserId);
                if (s && s.status === 'connected' && s.socket) {
                    return { userId: callerUserId, session: s, dbSession: dbS };
                }
                await new Promise(r => setTimeout(r, 500));
            }
            if (s) return { userId: callerUserId, session: s, dbSession: dbS };
        }
        return null;
    }

    // 4. For ADMIN managing other user sessions:
    let match = getSessionByPhoneOrUserId(sessionParam);
    if (match && match.session?.status === 'connected' && match.session?.socket) {
        return match;
    }

    const targetUserId = match?.userId || (callerUserId && isAdmin ? null : callerUserId);
    if (targetUserId && String(targetUserId).trim().toUpperCase() !== 'ADMIN') {
        let s = sessions.get(targetUserId);
        if (s && s.status === 'connected' && s.socket) return { userId: targetUserId, session: s };
        
        if (s && s.status === 'connecting') {
            for (let wait = 0; wait < 6; wait++) {
                s = sessions.get(targetUserId);
                if (s && s.status === 'connected' && s.socket) {
                    return { userId: targetUserId, session: s };
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }

        const dbS = await WhatsAppSession.findOne({ 
            $or: [{ ownerUserId: targetUserId }, { sessionId: `user-${targetUserId}` }],
            status: { $ne: 'logged_out' } 
        });
        if (dbS) {
            await startUserSession(targetUserId);
            for (let wait = 0; wait < 6; wait++) {
                s = sessions.get(targetUserId);
                if (s && s.status === 'connected' && s.socket) {
                    return { userId: targetUserId, session: s, dbSession: dbS };
                }
                await new Promise(r => setTimeout(r, 500));
            }
            if (s) return { userId: targetUserId, session: s, dbSession: dbS };
        }
    }

    if (sessionParam && clean10.length === 10 && isAdmin) {
        const dbS = await WhatsAppSession.findOne({
            phone: { $regex: clean10 + '$' },
            status: { $ne: 'logged_out' }
        });
        if (dbS && dbS.ownerUserId && String(dbS.ownerUserId).trim().toUpperCase() !== 'ADMIN') {
            let s = sessions.get(dbS.ownerUserId);
            if (!s || s.status !== 'connected') {
                await startUserSession(dbS.ownerUserId);
                for (let wait = 0; wait < 6; wait++) {
                    s = sessions.get(dbS.ownerUserId);
                    if (s && s.status === 'connected' && s.socket) {
                        return { userId: dbS.ownerUserId, session: s, dbSession: dbS };
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            s = sessions.get(dbS.ownerUserId);
            return { userId: dbS.ownerUserId, session: s, dbSession: dbS };
        }
    }

    return null;
}

async function restoreAllSessions() {
    try {
        const SessionAuth = require('./models/SessionAuth');
        const userIdsToRestore = new Set();

        // 1. Find all users who have saved credentials in SessionAuth
        try {
            const credDocs = await SessionAuth.find({ id: { $regex: /_creds\.json$/ } }, { id: 1 }).lean();
            for (const doc of credDocs) {
                const match = doc.id.match(/^user-(.+?)_creds\.json$/);
                if (match && match[1]) {
                    const uId = match[1];
                    if (String(uId).trim().toUpperCase() !== 'ADMIN') {
                        userIdsToRestore.add(uId);
                    }
                }
            }
        } catch (e) {
            console.warn('[UserSession] SessionAuth cred lookup warning:', e.message);
        }

        // 2. Find all non-logged-out users in WhatsAppSession
        try {
            const sessionsToRestore = await WhatsAppSession.find({ 
                role: 'user', 
                status: { $ne: 'logged_out' }
            }).lean();

            for (const sessionRecord of sessionsToRestore) {
                if (sessionRecord.ownerUserId && String(sessionRecord.ownerUserId).trim().toUpperCase() !== 'ADMIN') {
                    userIdsToRestore.add(sessionRecord.ownerUserId);
                }
            }
        } catch (e) {
            console.warn('[UserSession] WhatsAppSession query warning:', e.message);
        }

        console.log(`[UserSession] Found ${userIdsToRestore.size} user sessions to restore & keep always-active`);
        
        for (const userId of userIdsToRestore) {
            console.log(`[UserSession] Auto-restoring session for user ${userId}`);
            await startUserSession(userId).catch(err => 
                console.error(`[UserSession] Restore failed for user ${userId}:`, err.message)
            );
            // Stagger startups by 500ms to avoid spike
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (error) {
        console.error('[UserSession] Error restoring sessions:', error);
    }
}

let userWatchdogInterval = null;

function startUserSessionWatchdog() {
    if (userWatchdogInterval) return;
    console.log('[UserSession] Starting 24/7 Always-Active Watchdog (every 45s)');
    userWatchdogInterval = setInterval(async () => {
        try {
            const SessionAuth = require('./models/SessionAuth');
            
            // 1. Check all in-memory sessions
            for (const [userId, session] of sessions.entries()) {
                if (session.status === 'connected') {
                    // Check if underlying websocket is alive (ws.OPEN === 1)
                    const wsState = session.socket?.ws?.readyState;
                    if (wsState !== undefined && wsState !== 1) {
                        console.warn(`[Watchdog] User ${userId} websocket closed (state: ${wsState}), auto-reconnecting...`);
                        startUserSession(userId).catch(e => console.error(`[Watchdog] User ${userId} reconnect err:`, e.message));
                    }
                } else if (session.status === 'connecting' && session.connectingSince && (Date.now() - session.connectingSince > 45000)) {
                    console.warn(`[Watchdog] User ${userId} stuck connecting >45s, restarting...`);
                    startUserSession(userId).catch(e => console.error(`[Watchdog] User ${userId} restart err:`, e.message));
                }
            }

            // 2. Revive any saved user credentials that dropped from memory
            try {
                const credDocs = await SessionAuth.find({ id: { $regex: /_creds\.json$/ } }, { id: 1 }).lean();
                for (const doc of credDocs) {
                    const match = doc.id.match(/^user-(.+?)_creds\.json$/);
                    if (match && match[1]) {
                        const uId = match[1];
                        if (String(uId).trim().toUpperCase() === 'ADMIN') continue;
                        const active = sessions.get(uId);
                        if (!active || active.status === 'disconnected') {
                            const dbRec = await WhatsAppSession.findOne({ 
                                $or: [{ ownerUserId: uId }, { sessionId: `user-${uId}` }] 
                            }).lean();
                            if (!dbRec || dbRec.status !== 'logged_out') {
                                console.log(`[Watchdog] Reviving offline user session ${uId} to maintain 24/7 active status`);
                                startUserSession(uId).catch(e => console.error(`[Watchdog] Revive err for ${uId}:`, e.message));
                            }
                        }
                    }
                }
            } catch (e) {}
        } catch (err) {
            console.error('[Watchdog] Error in session watchdog loop:', err.message);
        }
    }, 45000);
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
    restoreAllSessions,
    startUserSessionWatchdog
};
