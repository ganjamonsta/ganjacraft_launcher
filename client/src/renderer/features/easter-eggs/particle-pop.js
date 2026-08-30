/**
 * Ganj4Craft Launcher - Interactive Particle Popper
 * Лопание падающих частиц (листья, снежинки) при клике.
 * Без очков, комбо и интерфейса — просто кайф.
 */

import { effectsEngine } from '../../ui/effects/effects-engine.js';
import { audioSynth } from './audio-synth.js';

class ParticlePopperGame {
    constructor() {}

    /**
     * Инициализация обработчиков кликов
     */
    init() {
        document.addEventListener('pointerdown', (e) => this.handleScreenClick(e), { passive: false });
    }

    /**
     * Обработка клика по экрану для поиска и взрыва частицы
     */
    handleScreenClick(e) {
        // Если идёт запуск игры — отключаем лопание частиц полностью
        if (document.body.classList.contains('is-game-launching')) return;

        // Игнорируем клики по интерактивным элементам UI
        const tag = e.target.tagName;
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SPAN', 'P', 'H1', 'H2', 'H3'].includes(tag)) return;
        if (e.target.closest('button, input, select, textarea, a, .launch-log-modal, .launch-console-body, .console-log-line, .custom-modal, .step-settings, .interactive-card, .pseudo-console-window, #step-settings, #title-bar, #step-progress')) return;

        const clickX = e.clientX;
        const clickY = e.clientY;
        const hitRadius = 45;

        let popped = false;
        let poppedX = clickX;
        let poppedY = clickY;

        // 1. Проверяем передний план (fgParticles)
        if (effectsEngine.fgParticles && effectsEngine.fgParticles.length > 0) {
            for (let i = effectsEngine.fgParticles.length - 1; i >= 0; i--) {
                const p = effectsEngine.fgParticles[i];
                const dx = p.x - clickX;
                const dy = p.y - clickY;
                if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
                    poppedX = p.x;
                    poppedY = p.y;
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
                if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
                    poppedX = p.x;
                    poppedY = p.y;
                    p.y = -20;
                    p.x = Math.random() * effectsEngine.width;
                    popped = true;
                    break;
                }
            }
        }

        if (popped) {
            audioSynth.playPop(1.0 + Math.random() * 0.3);
            this.spawnSparks(poppedX, poppedY);
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
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.setProperty('--dx', `${Math.cos(angle) * speed}px`);
            spark.style.setProperty('--dy', `${Math.sin(angle) * speed}px`);

            document.body.appendChild(spark);
            setTimeout(() => spark.remove(), 450);
        }
    }
}

export const particlePopper = new ParticlePopperGame();
