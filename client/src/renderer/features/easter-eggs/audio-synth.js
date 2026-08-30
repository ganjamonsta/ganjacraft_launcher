/**
 * Ganj4Craft Launcher - Audio Synth SFX Engine
 * Синтезатор звуковых эффектов на чистом Web Audio API
 * Работает без внешних mp3/wav файлов, мгновенный отклик и нулевой оверхед
 */

class AudioSynthEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    /**
     * Получить или создать AudioContext (с разблокировкой по пользовательскому действию)
     */
    getContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    /**
     * Звук лопания частицы / пузырька (Pop)
     */
    playPop(pitchModifier = 1) {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            const baseFreq = (400 + Math.random() * 200) * pitchModifier;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 0.08);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {
            console.debug('[AudioSynth] Pop error', e);
        }
    }

    /**
     * Звук начисления EMC / монет (Retro 8-bit Coin)
     */
    playCoin() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(987.77, now); // B5
            osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.setValueAtTime(0.15, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.36);
        } catch (e) {
            console.debug('[AudioSynth] Coin error', e);
        }
    }

    /**
     * Победный фанфарный джингл (Выдача Опки / Admin OP)
     */
    playFanfare() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            const noteDur = 0.1;

            notes.forEach((freq, idx) => {
                const now = ctx.currentTime + (idx * noteDur);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = idx === notes.length - 1 ? 'triangle' : 'square';
                osc.frequency.setValueAtTime(freq, now);

                const dur = idx === notes.length - 1 ? 0.45 : noteDur * 0.9;
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + dur);
            });
        } catch (e) {
            console.debug('[AudioSynth] Fanfare error', e);
        }
    }

    /**
     * Звук левитации / включения креатива (Creative / Fly mode)
     */
    playFly() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.52);
        } catch (e) {
            console.debug('[AudioSynth] Fly error', e);
        }
    }

    /**
     * Глубокий 808 Sub-Bass Drop (для 420 BeatDrop)
     */
    playBassDrop() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.85);
        } catch (e) {
            console.debug('[AudioSynth] BassDrop error', e);
        }
    }

    /**
     * Звук ошибки / доступа запрещено (Buzzer)
     */
    playError() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.setValueAtTime(90, now + 0.12);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.26);
        } catch (e) {
            console.debug('[AudioSynth] Error error', e);
        }
    }

    /**
     * Акробатический прыжок / Трюк со скином (Whoosh/Spring)
     */
    playJump() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(650, now + 0.22);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.26);
        } catch (e) {
            console.debug('[AudioSynth] Jump error', e);
        }
    }

    /**
     * Выстрел из плазмогана / лазера (Sci-Fi Laser Blast)
     */
    playLaserShot() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            // Быстрый питч-дроп с 920Hz до 120Hz для сочного щелчка
            osc.frequency.setValueAtTime(950, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            console.debug('[AudioSynth] Laser error', e);
        }
    }

    /**
     * Взрыв / Уничтожение мишени (Target Explosion)
     */
    playTargetHit() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            // Шум / хруст взрыва
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        } catch (e) {
            console.debug('[AudioSynth] Hit error', e);
        }
    }

    /**
     * Выстрел из дробовика (Shotgun blast)
     */
    playShotgun() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            // 1. Ударный низкий тон
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.23);

            // 2. Хрустящий шумовой залп дроби
            const bufferSize = ctx.sampleRate * 0.15;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(1400, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.15);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.3, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noise.start(now);
            noise.stop(now + 0.16);
        } catch (e) {
            console.debug('[AudioSynth] Shotgun error', e);
        }
    }

    /**
     * Выстрел из скорострельного SMG (Rapid SMG laser)
     */
    playSMG() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200 + Math.random() * 200, now);
            osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.07);
        } catch (e) {
            console.debug('[AudioSynth] SMG error', e);
        }
    }

    /**
     * Выстрел из BFG Рельсотрона (Heavy Railgun zap)
     */
    playRailgun() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            
            // 1. Высокочастотный ионизирующий свист
            const oscHi = ctx.createOscillator();
            const gainHi = ctx.createGain();
            oscHi.type = 'sine';
            oscHi.frequency.setValueAtTime(3200, now);
            oscHi.frequency.exponentialRampToValueAtTime(400, now + 0.25);
            gainHi.gain.setValueAtTime(0.25, now);
            gainHi.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            oscHi.connect(gainHi);
            gainHi.connect(ctx.destination);
            oscHi.start(now);
            oscHi.stop(now + 0.32);

            // 2. Тяжелый суб-басовый удар
            const oscLo = ctx.createOscillator();
            const gainLo = ctx.createGain();
            oscLo.type = 'sawtooth';
            oscLo.frequency.setValueAtTime(180, now);
            oscLo.frequency.exponentialRampToValueAtTime(32, now + 0.45);
            gainLo.gain.setValueAtTime(0.4, now);
            gainLo.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            oscLo.connect(gainLo);
            gainLo.connect(ctx.destination);
            oscLo.start(now);
            oscLo.stop(now + 0.52);
        } catch (e) {
            console.debug('[AudioSynth] Railgun error', e);
        }
    }

    /**
     * Старт ракеты (Rocket launch whoosh)
     */
    playRocketLaunch() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.26);
        } catch (e) {
            console.debug('[AudioSynth] RocketLaunch error', e);
        }
    }

    /**
     * Детонация ракеты / тяжелый взрыв (Rocket detonation)
     */
    playRocketExplode() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

            gain.gain.setValueAtTime(0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.42);
        } catch (e) {
            console.debug('[AudioSynth] RocketExplode error', e);
        }
    }

    /**
     * Тревожная сирена появления Босса (Boss Siren Alarm)
     */
    playBossWarning() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            [0, 0.25, 0.5].forEach((offset) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(440, now + offset);
                osc.frequency.linearRampToValueAtTime(880, now + offset + 0.12);
                osc.frequency.linearRampToValueAtTime(440, now + offset + 0.24);

                gain.gain.setValueAtTime(0.25, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + offset);
                osc.stop(now + offset + 0.25);
            });
        } catch (e) {
            console.debug('[AudioSynth] BossWarning error', e);
        }
    }

    /**
     * Победный джингл поверженного босса (Boss Defeated Fanfare)
     */
    playBossDefeated() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
            notes.forEach((freq, idx) => {
                const now = ctx.currentTime + (idx * 0.08);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.32);
            });
        } catch (e) {
            console.debug('[AudioSynth] BossDefeated error', e);
        }
    }

    /**
     * Звук подбора монетки (Coin Pickup)
     */
    playCoinPickup() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.50, now); // C6
            osc.frequency.setValueAtTime(1567.98, now + 0.06); // G6

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        } catch (e) {
            console.debug('[AudioSynth] CoinPickup error', e);
        }
    }

    /**
     * Покупка улучшения / прокачка (Upgrade Powerup)
     */
    playUpgradePurchased() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach((freq, idx) => {
                const now = ctx.currentTime + (idx * 0.05);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.2);
            });
        } catch (e) {
            console.debug('[AudioSynth] UpgradePurchased error', e);
        }
    }

    /**
     * Озвучка надевания снаряжения / экипировки (Armor / Weapon Equip)
     */
    playEquip() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            // Металлический лязг надевания брони / затвора
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.14);
        } catch (e) {
            console.debug('[AudioSynth] Equip error', e);
        }
    }
}

export const audioSynth = new AudioSynthEngine();
