/**
 * Ganj4Craft Launcher - Interactive Particle Popper & Combo Mini-Game
 * Лопание падающих частиц (листья, снежинки, бошки) при клике со сбором очков и комбо
 */

import { effectsEngine } from '../../ui/effects/effects-engine.js';
import { createSnowBurst, createSideBurst } from '../../ui/effects/index.js';
import { audioSynth } from './audio-synth.js';
import { dom } from '../../utils/dom.js';

class ParticlePopperGame {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.comboTimeout = null;
        this.counterElem = null;
        this.leafClickCount = 0;
        this.leafClickTimer = null;
    }

    /**
     * Инициализация обработчиков кликов
     */
    init() {
        // Слушаем клики по всему экрану
        document.addEventListener('pointerdown', (e) => this.handleScreenClick(e), { passive: false });
    }

    /**
     * Обеспечить наличие плавающего счетчика урожая
     */
    ensureCounterDOM() {
        if (this.counterElem) return;

        const counter = document.createElement('div');
        counter.id = 'particle-pop-counter';
        counter.className = 'particle-pop-counter hidden';
        counter.innerHTML = `
            <div class="pop-counter-icon">🌿</div>
            <div class="pop-counter-info">
                <div class="pop-counter-title">Собрано урожая</div>
                <div class="pop-counter-value" id="pop-score-val">0</div>
            </div>
            <div class="pop-counter-combo hidden" id="pop-combo-badge">COMBO x2</div>
        `;

        document.body.appendChild(counter);
        this.counterElem = counter;
    }

    /**
     * Обработка клика по экрану для поиска и взрыва частицы
     */
    handleScreenClick(e) {
        // Если идёт запуск игры или открыты логи — отключаем лопание частиц полностью
        if (document.body.classList.contains('is-game-launching')) return;

        // Игнорируем клики по кнопкам, инпутам, выделению текста и любым интерактивным элементам UI
        const tag = e.target.tagName;
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SPAN', 'P', 'H1', 'H2', 'H3'].includes(tag)) return;
        if (e.target.closest('button, input, select, textarea, a, .launch-log-modal, .launch-console-body, .console-log-line, .custom-modal, .step-settings, .interactive-card, .pseudo-console-window, #step-settings, #title-bar, #step-progress')) return;

        const clickX = e.clientX;
        const clickY = e.clientY;
        const hitRadius = 45; // Радиус попадания по частице

        let popped = false;
        let poppedX = clickX;
        let poppedY = clickY;

        // 1. Проверяем передний план (fgParticles)
        if (effectsEngine.fgParticles && effectsEngine.fgParticles.length > 0) {
            for (let i = effectsEngine.fgParticles.length - 1; i >= 0; i--) {
                const p = effectsEngine.fgParticles[i];
                const dx = p.x - clickX;
                const dy = p.y - clickY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= hitRadius) {
                    poppedX = p.x;
                    poppedY = p.y;
                    // Сбрасываем частицу наверх
                    p.y = -20;
                    p.x = Math.random() * effectsEngine.width;
                    popped = true;
                    break;
                }
            }
        }

        // 2. Проверяем задний план (bgParticles) если не попали в передний
        if (!popped && effectsEngine.bgParticles && effectsEngine.bgParticles.length > 0) {
            for (let i = effectsEngine.bgParticles.length - 1; i >= 0; i--) {
                const p = effectsEngine.bgParticles[i];
                const dx = p.x - clickX;
                const dy = p.y - clickY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= hitRadius) {
                    poppedX = p.x;
                    poppedY = p.y;
                    // Сбрасываем частицу наверх
                    p.y = -20;
                    p.x = Math.random() * effectsEngine.width;
                    popped = true;
                    break;
                }
            }
        }

        if (popped) {
            this.registerHit(poppedX, poppedY);
        }
    }

    /**
     * Регистрация успешного попадания
     */
    registerHit(x, y) {
        this.score++;
        this.combo++;

        // Сброс комбо через 2.5 секунды бездействия
        if (this.comboTimeout) clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => {
            this.combo = 0;
            this.updateCounterUI();
        }, 2500);

        // Звук лопания с повышением питча по комбо
        const pitch = Math.min(2.2, 1.0 + (this.combo * 0.05));
        audioSynth.playPop(pitch);

        // Создаем искры в месте клика
        this.spawnSparks(x, y);

        // Создаем всплывающий текст
        let text = '+1 🌿';
        if (this.combo >= 20) text = `🔥 ${this.combo}x COMBO!`;
        else if (this.combo >= 10) text = `⚡ ${this.combo}x!`;
        else if (this.combo >= 5) text = `+${this.combo} COMBO!`;
        else if (this.score % 42 === 0) text = `+420 EMC! 💨`;

        this.spawnFloatingScore(x, y, text);

        // Награды за комбо-майлстоуны
        if (this.combo === 10 || this.combo === 25 || this.combo === 50) {
            audioSynth.playCoin();
            createSideBurst(Math.random() > 0.5 ? 'left' : 'right');
        } else if (this.score % 50 === 0) {
            audioSynth.playFanfare();
            createSnowBurst();
        }

        this.updateCounterUI();
    }

    /**
     * Обновление плашки счета в углу экрана
     */
    updateCounterUI() {
        this.ensureCounterDOM();
        if (!this.counterElem) return;

        const valElem = this.counterElem.querySelector('#pop-score-val');
        const comboElem = this.counterElem.querySelector('#pop-combo-badge');

        if (valElem) valElem.innerText = this.score;

        if (this.score > 0) {
            this.counterElem.classList.remove('hidden');
            this.counterElem.classList.add('active-pop');
            setTimeout(() => this.counterElem?.classList.remove('active-pop'), 200);
        }

        if (comboElem) {
            if (this.combo >= 3) {
                comboElem.innerText = `COMBO x${this.combo}`;
                comboElem.classList.remove('hidden');
            } else {
                comboElem.classList.add('hidden');
            }
        }
    }

    /**
     * Создание визуальных искр при лопании
     */
    spawnSparks(x, y) {
        const count = 6;
        for (let i = 0; i < count; i++) {
            const spark = document.createElement('div');
            spark.className = 'pop-spark';
            
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5);
            const speed = 25 + Math.random() * 35;
            const destX = Math.cos(angle) * speed;
            const destY = Math.sin(angle) * speed;

            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.setProperty('--dx', `${destX}px`);
            spark.style.setProperty('--dy', `${destY}px`);

            document.body.appendChild(spark);

            setTimeout(() => spark.remove(), 450);
        }
    }

    /**
     * Создание всплывающего текста с очками
     */
    spawnFloatingScore(x, y, text) {
        const floater = document.createElement('div');
        floater.className = 'pop-floating-score';
        floater.innerText = text;
        floater.style.left = `${x}px`;
        floater.style.top = `${y}px`;

        document.body.appendChild(floater);

        setTimeout(() => floater.remove(), 750);
    }
}

export const particlePopper = new ParticlePopperGame();
