// ===== SUPER SMASH CATS — Network Manager (PeerJS WebRTC) =====
// Handles peer-to-peer online multiplayer via PeerJS.
// Host creates a room code, guest joins with it.
// Host sends game state, guest sends inputs.

const NetworkManager = (function () {
    'use strict';

    let peer = null;
    let conn = null;
    let isHost = false;
    let isConnected = false;
    let roomCode = '';
    let onConnectCallback = null;
    let onDisconnectCallback = null;
    let onDataCallback = null;
    let onErrorCallback = null;

    const ROOM_PREFIX = 'ssc-mp-';

    function generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    function setupConnection(connection) {
        conn = connection;
        conn.on('open', () => {
            isConnected = true;
            if (onConnectCallback) onConnectCallback();
        });
        conn.on('data', (data) => {
            if (onDataCallback) onDataCallback(data);
        });
        conn.on('close', () => {
            isConnected = false;
            conn = null;
            if (onDisconnectCallback) onDisconnectCallback();
        });
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            if (onErrorCallback) onErrorCallback(err);
        });
    }

    function host(callbacks) {
        onConnectCallback = callbacks.onConnect || null;
        onDisconnectCallback = callbacks.onDisconnect || null;
        onDataCallback = callbacks.onData || null;
        onErrorCallback = callbacks.onError || null;

        roomCode = generateCode();
        const peerId = ROOM_PREFIX + roomCode;
        isHost = true;

        return new Promise((resolve, reject) => {
            peer = new Peer(peerId, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peer.on('open', (id) => {
                console.log('Hosting room:', roomCode);
                resolve(roomCode);
            });

            peer.on('connection', (connection) => {
                setupConnection(connection);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    peer.destroy();
                    roomCode = generateCode();
                    const newId = ROOM_PREFIX + roomCode;
                    peer = new Peer(newId, { debug: 0 });
                    peer.on('open', () => resolve(roomCode));
                    peer.on('connection', (c) => setupConnection(c));
                    peer.on('error', (e) => {
                        if (onErrorCallback) onErrorCallback(e);
                        reject(e);
                    });
                } else {
                    if (onErrorCallback) onErrorCallback(err);
                    reject(err);
                }
            });
        });
    }

    function join(code, callbacks) {
        onConnectCallback = callbacks.onConnect || null;
        onDisconnectCallback = callbacks.onDisconnect || null;
        onDataCallback = callbacks.onData || null;
        onErrorCallback = callbacks.onError || null;

        roomCode = code.toUpperCase().trim();
        const peerId = ROOM_PREFIX + 'g-' + roomCode + '-' + Math.floor(Math.random() * 10000);
        const hostId = ROOM_PREFIX + roomCode;
        isHost = false;

        return new Promise((resolve, reject) => {
            peer = new Peer(peerId, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peer.on('open', () => {
                const connection = peer.connect(hostId, { reliable: true });
                setupConnection(connection);

                const timeout = setTimeout(() => {
                    if (!isConnected) {
                        reject(new Error('Connection timed out. Check the room code.'));
                        disconnect();
                    }
                }, 10000);

                const origConnect = onConnectCallback;
                onConnectCallback = () => {
                    clearTimeout(timeout);
                    if (origConnect) origConnect();
                    resolve();
                };
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (onErrorCallback) onErrorCallback(err);
                reject(err);
            });
        });
    }

    function send(data) {
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (e) {
                console.warn('Send error:', e);
            }
        }
    }

    function disconnect() {
        if (conn) { try { conn.close(); } catch (e) { } conn = null; }
        if (peer) { try { peer.destroy(); } catch (e) { } peer = null; }
        isConnected = false;
        isHost = false;
        roomCode = '';
    }

    return {
        host,
        join,
        send,
        disconnect,
        get isHost() { return isHost; },
        get isConnected() { return isConnected; },
        get roomCode() { return roomCode; },
        get isActive() { return peer !== null; }
    };
})();
