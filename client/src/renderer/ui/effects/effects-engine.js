/**
 * GanjaCraft Launcher - Universal Particle Engine
 * Двухслойный движок эффектов (Задний план за карточками + Малый процент на переднем плане)
 */

import { snowPreset } from './presets/snow.js';
import { leavesPreset } from './presets/leaves.js';
import { sakuraPreset } from './presets/sakura.js';
import { firefliesPreset } from './presets/fireflies.js';
import { ganjaPreset } from './presets/ganja.js';
import { appState } from '../../state/app-state.js';

const PRESETS = {
    snow: snowPreset,
    leaves: leavesPreset,
    sakura: sakuraPreset,
    fireflies: firefliesPreset,
    ganja: ganjaPreset
};

class UniversalEffectsEngine {
    constructor() {
        this.bgCanvas = null;
        this.bgCtx = null;
        this.fgCanvas = null;
        this.fgCtx = null;
        
        this.bgParticles = [];
        this.fgParticles = [];
        this.animFrameId = null;
        
        this.currentPresetId = 'auto';
        this.density = 'medium';
        this.activePreset = null;
        this.isRunning = false;
        this.width = 0;
        this.height = 0;
        this.mousePos = { x: 0, y: 0 };

        this.handleResize = this.handleResize.bind(this);
        this.render = this.render.bind(this);
    }

    /**
     * Инициализировать canvas в двух слоях (Background & Foreground)
     */
    initContainer() {
        let bgContainer = document.getElementById('snow-bg-container');
        if (!bgContainer) {
            const mainContent = document.getElementById('main-content') || document.body;
            bgContainer = document.createElement('div');
            bgContainer.id = 'snow-bg-container';
            mainContent.insertBefore(bgContainer, mainContent.firstChild);
        }

        let fgContainer = document.getElementById('snow-container');
        if (!fgContainer) {
            fgContainer = document.createElement('div');
            fgContainer.id = 'snow-container';
            document.body.appendChild(fgContainer);
        }

        // Background canvas (Behind UI cards)
        if (!this.bgCanvas) {
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.id = 'effects-bg-canvas';
            this.bgCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
            bgContainer.appendChild(this.bgCanvas);
            this.bgCtx = this.bgCanvas.getContext('2d');
        }

        // Foreground canvas (In front of UI cards)
        if (!this.fgCanvas) {
            this.fgCanvas = document.createElement('canvas');
            this.fgCanvas.id = 'effects-fg-canvas';
            this.fgCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
            fgContainer.appendChild(this.fgCanvas);
            this.fgCtx = this.fgCanvas.getContext('2d');
        }

        window.removeEventListener('resize', this.handleResize);
        window.addEventListener('resize', this.handleResize, { passive: true });

        this.handleResize();
    }

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        if (this.bgCanvas) {
            this.bgCanvas.width = this.width;
            this.bgCanvas.height = this.height;
        }
        if (this.fgCanvas) {
            this.fgCanvas.width = this.width;
            this.fgCanvas.height = this.height;
        }
    }

    /**
     * Определить активный пресет по строковому ключу
     */
    resolvePreset(presetId) {
        if (!presetId || presetId === 'off') return null;

        if (presetId === 'auto') {
            const month = new Date().getMonth();
            if (month === 11 || month === 0 || month === 1) return PRESETS.snow; // Зима
            if (month >= 2 && month <= 4) return PRESETS.sakura; // Весна
            if (month >= 5 && month <= 7) return PRESETS.fireflies; // Лето
            return PRESETS.leaves; // Осень
        }

        return PRESETS[presetId] || PRESETS.snow;
    }

    /**
     * Установить конфигурацию эффектов
     */
    configure({ preset = 'auto', density = 'medium', enabled = true }) {
        this.currentPresetId = preset;
        this.density = density;
        
        if (!enabled || preset === 'off') {
            this.stop();
            return;
        }

        this.activePreset = this.resolvePreset(preset);
        if (!this.activePreset) {
            this.stop();
            return;
        }

        this.initContainer();
        this.rebuildParticles();
        this.start();
    }

    /**
     * Пересоздать пул частиц и распределить по слоям (~85% за окнами, ~15% перед окнами)
     */
    rebuildParticles() {
        if (!this.activePreset) return;

        const maxCount = this.activePreset.maxParticles[this.density] || this.activePreset.maxParticles.medium;
        this.bgParticles = [];
        this.fgParticles = [];
        
        for (let i = 0; i < maxCount; i++) {
            const p = this.activePreset.createParticle(this.width, this.height);
            p.y = Math.random() * this.height;
            
            // Каждая 7-я частица (около 15%) идет на передний план
            if (i % 7 === 0) {
                p.opacity = (p.opacity || 0.5) * 0.6; // Мягкая прозрачность для переднего плана
                this.fgParticles.push(p);
            } else {
                this.bgParticles.push(p);
            }
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.render();
    }

    stop() {
        this.isRunning = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.bgCtx && this.bgCanvas) {
            this.bgCtx.clearRect(0, 0, this.width, this.height);
        }
        if (this.fgCtx && this.fgCanvas) {
            this.fgCtx.clearRect(0, 0, this.width, this.height);
        }
    }

    render() {
        if (!this.isRunning) return;

        if (!document.hidden && this.activePreset) {
            // 1. Отрисовка заднего слоя (за полупрозрачными карточками)
            if (this.bgCtx) {
                this.bgCtx.clearRect(0, 0, this.width, this.height);
                for (let i = 0; i < this.bgParticles.length; i++) {
                    const p = this.bgParticles[i];
                    this.activePreset.updateParticle(p, this.width, this.height, 1, this.mousePos);
                    this.activePreset.drawParticle(this.bgCtx, p);
                }
            }

            // 2. Отрисовка переднего слоя (малый процент перед карточками)
            if (this.fgCtx) {
                this.fgCtx.clearRect(0, 0, this.width, this.height);
                for (let i = 0; i < this.fgParticles.length; i++) {
                    const p = this.fgParticles[i];
                    this.activePreset.updateParticle(p, this.width, this.height, 1, this.mousePos);
                    this.activePreset.drawParticle(this.fgCtx, p);
                }
            }
        }

        this.animFrameId = requestAnimationFrame(this.render);
    }

    /**
     * Создать стильный векторный DOM-элемент для Burst-взрыва
     */
    createBurstElement() {
        const elem = document.createElement('div');
        elem.classList.add('snowflake', 'burst');

        const presetId = this.activePreset ? this.activePreset.id : 'snow';

        if (presetId === 'leaves') {
            const colors = ['#e65c2d', '#d98325', '#c0392b', '#f1c40f'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            elem.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="${color}"><path d="M17 8C8 10 5.9 16.17 3.83 21 9c1.83-5.17 8-8 8-8z"/></svg>`;
        } else if (presetId === 'sakura') {
            const colors = ['#ffb7c5', '#ff9ab4', '#f8c8dc'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            elem.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="${color}"><path d="M12 2C8 6 6 12 12 22C18 12 16 6 12 2Z"/></svg>`;
        } else if (presetId === 'fireflies') {
            const color = Math.random() > 0.4 ? '#ffe066' : '#52be80';
            elem.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle, #fff 15%, ${color} 70%, transparent);box-shadow:0 0 8px ${color};"></div>`;
        } else if (presetId === 'ganja') {
            elem.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#2ecc71" style="filter:drop-shadow(0 0 4px #2ecc71)"><path d="M12 2C12 2 15 7 15 12C15 17 12 22 12 22C12 22 9 17 9 12C9 7 12 2 12 2Z"/><path d="M12 7C14.5 5 19 6 20 10C17 12 13 11 12 7Z"/><path d="M12 7C9.5 5 5 6 4 10C7 12 11 11 12 7Z"/></svg>`;
        } else {
            elem.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#e0f7fa" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M2 12h20M19 5L5 19M5 5l14 14"/></svg>`;
        }

        return elem;
    }

    /**
     * Получить символы для DOM-взрыва
     */
    getBurstSymbol() {
        if (this.activePreset && this.activePreset.symbols) {
            return this.activePreset.symbols[Math.floor(Math.random() * this.activePreset.symbols.length)];
        }
        return '❄';
    }
}

export const effectsEngine = new UniversalEffectsEngine();
