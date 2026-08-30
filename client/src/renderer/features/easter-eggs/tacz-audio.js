/**
 * Ganj4Craft Launcher - TACZ Authentic Audio Engine
 * Высокопроизводительный HTML5 Audio плеер для звуков оружия TACZ с пулом аудио-элементов,
 * аппаратным декодированием и троттлингом для устранения лагов.
 */

import { audioSynth } from './audio-synth.js';

class TACZAudioEngine {
    constructor() {
        this.volume = 0.75;
        this.isMuted = false;
        this.audioPool = new Map(); // id -> Array<HTMLAudioElement>
        this.lastPlayTime = new Map(); // id -> timestamp
        this.poolSize = 4;

        // Предустановленные пути звуков
        this.soundPaths = {
            'ak47_shoot': 'assets/tacz/sounds/ak47_shoot.ogg',
            'deagle_shoot': 'assets/tacz/sounds/deagle_shoot.ogg',
            'spas12_shoot': 'assets/tacz/sounds/spas12_shoot.ogg',
            'p90_shoot': 'assets/tacz/sounds/p90_shoot.ogg',
            'awp_shoot': 'assets/tacz/sounds/awp_shoot.ogg',
            'rpg7_shoot': 'assets/tacz/sounds/rpg7_shoot.ogg',
            'minigun_shoot': 'assets/tacz/sounds/minigun_shoot.ogg',
            'head_hit': 'assets/tacz/sounds/head_hit.ogg',
            'flesh_hit': 'assets/tacz/sounds/flesh_hit.ogg',
            'kill': 'assets/tacz/sounds/kill.ogg',
            'dry_fire': 'assets/tacz/sounds/dry_fire.ogg'
        };

        // Минимальные интервалы (мс) между повторным воспроизведением одного звука
        this.minCooldowns = {
            'flesh_hit': 35,
            'head_hit': 35,
            'kill': 45,
            'dry_fire': 100,
            'spas12_shoot': 80,
            'ak47_shoot': 35,
            'p90_shoot': 30,
            'minigun_shoot': 25,
            'deagle_shoot': 70,
            'awp_shoot': 120,
            'rpg7_shoot': 120
        };
    }

    /**
     * Получить свободный HTML5 Audio элемент из пула
     */
    getAudioElement(id) {
        if (!this.audioPool.has(id)) {
            const list = [];
            const src = this.soundPaths[id];
            if (!src) return null;
            for (let i = 0; i < this.poolSize; i++) {
                const a = new Audio(src);
                a.preload = 'auto';
                list.push(a);
            }
            this.audioPool.set(id, list);
        }
        const pool = this.audioPool.get(id);
        if (!pool || pool.length === 0) return null;

        for (let i = 0; i < pool.length; i++) {
            if (pool[i].paused || pool[i].ended) {
                return pool[i];
            }
        }
        const first = pool[0];
        try { first.currentTime = 0; } catch (_) {}
        return first;
    }

    /**
     * Воспроизвести звук по ID
     */
    play(id, pitchShift = 1.0, volScale = 1.0) {
        if (this.isMuted) return;

        const now = performance.now();
        const minCd = this.minCooldowns[id] || 30;
        const lastPlay = this.lastPlayTime.get(id) || 0;
        if (now - lastPlay < minCd) {
            return;
        }
        this.lastPlayTime.set(id, now);

        const audio = this.getAudioElement(id);
        if (audio) {
            try {
                audio.volume = Math.max(0, Math.min(1.0, this.volume * volScale));
                audio.currentTime = 0;
                audio.playbackRate = Math.max(0.8, Math.min(1.3, pitchShift * (0.96 + Math.random() * 0.08)));
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        this.playFallback(id);
                    });
                }
            } catch (_) {
                this.playFallback(id);
            }
        } else {
            this.playFallback(id);
        }
    }

    playFallback(id) {
        try {
            if (id.includes('shoot')) {
                if (id.includes('spas')) audioSynth.playShotgun();
                else if (id.includes('minigun') || id.includes('p90')) audioSynth.playSMG();
                else if (id.includes('rpg7')) audioSynth.playRocketLaunch();
                else if (id.includes('awp')) audioSynth.playRailgun();
                else audioSynth.playLaserShot();
            } else if (id === 'head_hit') {
                audioSynth.playPop(1.8);
            } else if (id === 'flesh_hit') {
                audioSynth.playTargetHit();
            } else if (id === 'kill') {
                audioSynth.playCoin();
            } else if (id === 'dry_fire') {
                audioSynth.playError();
            }
        } catch (_) {}
    }

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
