/**
 * Ganj4Craft Launcher - Discord Rich Presence (RPC)
 * Легковесный, автономный клиент Discord IPC (Zero dependencies, pure Node.js net)
 */

const net = require('net');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { DISCORD_CLIENT_ID, SITE_URL, CLIENT_VERSION, MC_VERSION } = require('../constants');

// Opcodes Discord IPC
const OPCODES = {
    HANDSHAKE: 0,
    FRAME: 1,
    CLOSE: 2,
    PING: 3,
    PONG: 4
};

class DiscordRpcManager {
    constructor() {
        this.clientId = DISCORD_CLIENT_ID;
        this.socket = null;
        this.isConnected = false;
        this.isHandshaked = false;
        this.isEnabled = true;
        this.reconnectTimer = null;
        this.currentActivity = null;
        this.lastState = null;
        this.pipeIndex = 0;
        this.inGame = false;
        this.gameStartTime = null;
        this.currentUsername = null;
    }

    /**
     * Поиск доступных путей IPC пайпов для текущей ОС
     */
    getAvailablePipes() {
        const pipes = [];
        if (process.platform === 'win32') {
            for (let i = 0; i < 10; i++) {
                pipes.push(`\\\\?\\pipe\\discord-ipc-${i}`);
                pipes.push(`\\\\.\\pipe\\discord-ipc-${i}`);
            }
        } else {
            const prefix = process.env.XDG_RUNTIME_DIR ||
                           process.env.TMPDIR ||
                           process.env.TMP ||
                           process.env.TEMP ||
                           '/tmp';
            for (let i = 0; i < 10; i++) {
                pipes.push(path.join(prefix, `discord-ipc-${i}`));
            }
        }
        return pipes;
    }

    /**
     * Инициализация и запуск подключения
     */
    init(options = {}) {
        if (options.enabled !== undefined) {
            this.isEnabled = !!options.enabled;
        }
        if (options.clientId) {
            this.clientId = options.clientId;
        }

        if (!this.isEnabled) {
            return;
        }

        this.connect();
    }

    /**
     * Подключение к Discord IPC сокету
     */
    connect() {
        if (!this.isEnabled || this.isConnected || this.socket) return;

        const pipes = this.getAvailablePipes();
        let connected = false;

        const tryNextPipe = (index) => {
            if (index >= pipes.length || !this.isEnabled) {
                this.scheduleReconnect();
                return;
            }

            const pipePath = pipes[index];
            const socket = net.createConnection(pipePath);

            const cleanup = () => {
                socket.removeAllListeners();
                socket.destroy();
            };

            socket.once('connect', () => {
                connected = true;
                this.socket = socket;
                this.isConnected = true;
                this.setupSocketListeners(socket);
                this.sendHandshake();
            });

            socket.once('error', () => {
                cleanup();
                if (!connected) {
                    tryNextPipe(index + 1);
                }
            });
        };

        tryNextPipe(0);
    }

    /**
     * Слушатели для установленного сокета
     */
    setupSocketListeners(socket) {
        let buffer = Buffer.alloc(0);

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);

            while (buffer.length >= 8) {
                const op = buffer.readUInt32LE(0);
                const len = buffer.readUInt32LE(4);

                if (buffer.length < 8 + len) {
                    break;
                }

                const payloadBuf = buffer.slice(8, 8 + len);
                buffer = buffer.slice(8 + len);

                try {
                    const parsed = JSON.parse(payloadBuf.toString('utf-8'));
                    this.handleMessage(op, parsed);
                } catch (e) {
                    // ignore malformed frame
                }
            }
        });

        socket.on('close', () => {
            this.cleanup();
            this.scheduleReconnect();
        });

        socket.on('error', () => {
            this.cleanup();
            this.scheduleReconnect();
        });
    }

    /**
     * Обработка входящих сообщений от Discord
     */
    handleMessage(op, data) {
        if (op === OPCODES.FRAME) {
            if (data && data.evt === 'READY') {
                this.isHandshaked = true;
                if (this.currentActivity) {
                    this.sendActivity(this.currentActivity);
                } else {
                    this.setLauncherActivity();
                }
            } else if (data && data.evt === 'ERROR') {
                console.warn('[DISCORD RPC] Error event from Discord:', data.data?.message);
            }
        } else if (op === OPCODES.PING) {
            this.sendPacket(OPCODES.PONG, data);
        }
    }

    /**
     * Отправка хендшейка
     */
    sendHandshake() {
        if (!this.socket || !this.isConnected) return;
        const payload = {
            v: 1,
            client_id: this.clientId
        };
        this.sendPacket(OPCODES.HANDSHAKE, payload);
    }

    /**
     * Формирование и отправка бинарного пакета
     */
    sendPacket(opcode, payloadObj) {
        if (!this.socket || !this.isConnected) return;

        try {
            const jsonStr = JSON.stringify(payloadObj);
            const payloadBuf = Buffer.from(jsonStr, 'utf-8');
            const headerBuf = Buffer.alloc(8);

            headerBuf.writeUInt32LE(opcode, 0);
            headerBuf.writeUInt32LE(payloadBuf.length, 4);

            this.socket.write(Buffer.concat([headerBuf, payloadBuf]));
        } catch (err) {
            console.warn('[DISCORD RPC] Packet send failed:', err.message);
        }
    }

    /**
     * Отправка команды SET_ACTIVITY
     */
    sendActivity(activity) {
        if (!this.isEnabled) return;
        this.currentActivity = activity;

        if (!this.socket || !this.isConnected || !this.isHandshaked) {
            return;
        }

        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: activity || null
            },
            nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
        };

        this.sendPacket(OPCODES.FRAME, payload);
    }

    /**
     * Установка статуса «В лаунчере»
     */
    setLauncherActivity(params = {}) {
        this.inGame = false;
        this.gameStartTime = null;
        if (params.username) this.currentUsername = params.username;

        const siteUrl = SITE_URL || 'https://ganj4craft.ru';
        const downloadUrl = `${siteUrl}/launcher.html`;
        const view = params.viewName || 'Главное меню';
        const userState = this.currentUsername ? `Игрок: ${this.currentUsername}` : `Ganj4Craft Season 4`;

        const activity = {
            details: `В лаунчере (${view})`,
            state: userState,
            assets: {
                large_image: 'logo',
                large_text: `Ganj4Craft Launcher v${CLIENT_VERSION}`,
                small_image: 'icon',
                small_text: `Minecraft ${MC_VERSION}`
            },
            buttons: [
                { label: '🌐 Наш сайт', url: siteUrl },
                { label: '🚀 Играть с нами', url: downloadUrl }
            ]
        };

        this.sendActivity(activity);
    }

    /**
     * Установка статуса «В игре»
     */
    setGameActivity(params = {}) {
        this.inGame = true;
        if (params.username) this.currentUsername = params.username;
        if (!this.gameStartTime || params.resetTimer) {
            this.gameStartTime = params.startTime || Math.floor(Date.now() / 1000);
        }

        const siteUrl = SITE_URL || 'https://ganj4craft.ru';
        const downloadUrl = `${siteUrl}/launcher.html`;
        const username = this.currentUsername || 'Игрок';

        const activity = {
            details: `Играет на Ganj4Craft Season 4`,
            state: `Ник: ${username}`,
            timestamps: {
                start: this.gameStartTime
            },
            assets: {
                large_image: 'logo',
                large_text: `NeoForge ${MC_VERSION}`,
                small_image: 'icon',
                small_text: username
            },
            buttons: [
                { label: '🌐 Наш сайт', url: siteUrl },
                { label: '🚀 Скачать лаунчер', url: downloadUrl }
            ]
        };

        this.sendActivity(activity);
    }

    /**
     * Очистка активности
     */
    clearActivity() {
        this.currentActivity = null;
        this.sendActivity(null);
    }

    /**
     * Включение / выключение Discord RPC
     */
    setEnabled(enabled) {
        this.isEnabled = !!enabled;
        if (!this.isEnabled) {
            this.clearActivity();
            this.cleanup();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        } else {
            this.connect();
        }
    }

    /**
     * Планирование переподключения при недоступности Discord
     */
    scheduleReconnect() {
        if (!this.isEnabled || this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.isEnabled && !this.isConnected) {
                this.connect();
            }
        }, 20000); // каждые 20 сек тихий опрос
    }

    /**
     * Очистка сокета
     */
    cleanup() {
        this.isConnected = false;
        this.isHandshaked = false;
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.destroy();
            } catch (_) {}
            this.socket = null;
        }
    }

    /**
     * Полное уничтожение при закрытии приложения
     */
    destroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.clearActivity();
        this.cleanup();
    }
}

// Экспорт синглтона
const discordRpc = new DiscordRpcManager();

module.exports = {
    discordRpc,
    DiscordRpcManager
};
