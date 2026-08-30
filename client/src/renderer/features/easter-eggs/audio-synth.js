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
     * Звук выстрела лазера / бластера (Sci-Fi Laser Pew)
     */
    playLaser(pitchMod = 1) {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            const startFreq = (950 + Math.random() * 150) * pitchMod;
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        } catch (e) {
            console.debug('[AudioSynth] Laser error', e);
        }
    }

    /**
     * Звук взрыва цели / бошки (Explosion / Boom)
     */
    playExplosion() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;

            // 1. Низкочастотный саб-удар
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.42);

            // 2. Шумовой буфер (хруст взрыва)
            const bufferSize = ctx.sampleRate * 0.2;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(50, now + 0.2);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.3, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            whiteNoise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            whiteNoise.start(now);
            whiteNoise.stop(now + 0.25);
        } catch (e) {
            console.debug('[AudioSynth] Explosion error', e);
        }
    }

    /**
     * Хитмаркер при точном попадании
     */
    playHitmarker() {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.setValueAtTime(1800, now + 0.02);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {
            console.debug('[AudioSynth] Hitmarker error', e);
        }
    }
}

export const audioSynth = new AudioSynthEngine();

