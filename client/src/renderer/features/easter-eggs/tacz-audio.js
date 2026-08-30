/**
 * Ganj4Craft Launcher - TACZ Authentic Audio Engine
 * Высокопроизводительный Web Audio API плеер для звуков оружия TACZ
 */

import { audioSynth } from './audio-synth.js';

class TACZAudioEngine {
    constructor() {
        this.audioCtx = null;
        this.soundBuffers = new Map();
        this.loadingPromises = new Map();
        this.volume = 0.75;
        this.isMuted = false;

        // Предустановленные пути звуков
        this.soundPaths = {
            'ak47_shoot': 'assets/tacz/sounds/ak47_shoot.ogg',
            'deagle_shoot': 'assets/tacz/sounds/deagle_shoot.ogg',
            'spas12_shoot': 'assets/tacz/sounds/spas12_shoot.ogg',
            'p90_shoot': 'assets/tacz/sounds/p90_shoot.ogg',
            'victor45_shoot': 'assets/tacz/sounds/victor45_shoot.ogg',
            'awp_shoot': 'assets/tacz/sounds/awp_shoot.ogg',
            'rpg7_shoot': 'assets/tacz/sounds/rpg7_shoot.ogg',
            'minigun_shoot': 'assets/tacz/sounds/minigun_shoot.ogg',
            'head_hit': 'assets/tacz/sounds/head_hit.ogg',
            'flesh_hit': 'assets/tacz/sounds/flesh_hit.ogg',
            'kill': 'assets/tacz/sounds/kill.ogg',
            'dry_fire': 'assets/tacz/sounds/dry_fire.ogg'
        };

        this.initContext();
    }

    initContext() {
        if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContextClass();
            } catch (e) {
                console.debug('[TACZ Audio] AudioContext init error:', e);
            }
        }
    }

    resumeContext() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    }

    /**
     * Предзагрузка звукового файла в AudioBuffer
     */
    async loadSound(id) {
        if (this.soundBuffers.has(id)) {
            return this.soundBuffers.get(id);
        }

        if (this.loadingPromises.has(id)) {
            return this.loadingPromises.get(id);
        }

        const url = this.soundPaths[id];
        if (!url) return null;

        const promise = (async () => {
            try {
                this.initContext();
                if (!this.audioCtx) return null;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch sound: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                this.soundBuffers.set(id, audioBuffer);
                return audioBuffer;
            } catch (err) {
                console.debug(`[TACZ Audio] Failed to load ${id}:`, err);
                return null;
            } finally {
                this.loadingPromises.delete(id);
            }
        })();

        this.loadingPromises.set(id, promise);
        return promise;
    }

    /**
     * Предзагрузка всех звуков арсенала
     */
    preloadAll() {
        Object.keys(this.soundPaths).forEach(id => {
            this.loadSound(id);
        });
    }

    /**
     * Воспроизвести звук по ID
     * @param {string} id 
     * @param {number} pitchShift - Случайная вариация высоты тона (для разнообразия)
     * @param {number} volScale - Масштаб громкости
     */
    async play(id, pitchShift = 1.0, volScale = 1.0) {
        if (this.isMuted) return;
        this.resumeContext();

        let buffer = this.soundBuffers.get(id);
        if (!buffer) {
            buffer = await this.loadSound(id);
        }

        if (buffer && this.audioCtx) {
            try {
                const source = this.audioCtx.createBufferSource();
                source.buffer = buffer;

                // Небольшой рандом питча для сочности выстрелов (+- 4%)
                source.playbackRate.value = pitchShift * (0.97 + Math.random() * 0.06);

                const gainNode = this.audioCtx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1.0, this.volume * volScale));

                source.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                source.start(0);
                return;
            } catch (err) {
                console.debug('[TACZ Audio] Play error:', err);
            }
        }

        // Фолбэк на синтезатор при отсутствии файла или сбое
        this.playFallback(id);
    }

    playFallback(id) {
        if (id.includes('shoot')) {
            if (id.includes('spas')) audioSynth.playShotgun();
            else if (id.includes('minigun') || id.includes('p90') || id.includes('victor')) audioSynth.playLaserShot();
            else if (id.includes('rpg7')) audioSynth.playExplosion(true);
            else audioSynth.playLaserShot();
        } else if (id === 'head_hit') {
            audioSynth.playCrit();
        } else if (id === 'flesh_hit') {
            audioSynth.playHit();
        } else if (id === 'kill') {
            audioSynth.playCoin();
        }
    }

    // Хелперы для выстрелов
    playShoot(weaponId) {
        const soundMap = {
            'deagle': 'deagle_shoot',
            'spas_12': 'spas12_shoot',
            'ak47': 'ak47_shoot',
            'vector45': 'p90_shoot',
            'p90': 'p90_shoot',
            'awp': 'awp_shoot',
            'rpg7': 'rpg7_shoot',
            'minigun': 'minigun_shoot'
        };

        const soundId = soundMap[weaponId] || 'ak47_shoot';
        this.play(soundId, 1.0, 0.9);
    }

    playHeadHit() {
        this.play('head_hit', 1.0, 1.0);
    }

    playFleshHit() {
        this.play('flesh_hit', 1.0, 0.7);
    }

    playKill() {
        this.play('kill', 1.0, 0.85);
    }

    playDryFire() {
        this.play('dry_fire', 1.0, 0.6);
    }
}

export const taczAudio = new TACZAudioEngine();
