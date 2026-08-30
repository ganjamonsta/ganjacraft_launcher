/**
 * Ganj4Craft Launcher - Wardrobe & Armory UI Controller
 * Интерактивный интерфейс гардероба и оружейной для кастомизации героя
 */

import { dom } from '../../utils/dom.js';
import { EQUIPMENT_CATALOG, EQUIPMENT_PRESETS, equipmentManager } from './equipment-manager.js';
import { getSkinViewer3d } from './skin-viewer.js';
import { audioSynth } from '../easter-eggs/audio-synth.js';

let isWardrobeOpen = false;
let activeSlotTab = 'mainHand'; // 'mainHand' | 'head' | 'chest' | 'legs' | 'boots' | 'offHand' | 'back' | 'presets'

export function initWardrobeModal() {
    ensureWardrobeDOM();
    setupOpenButton();
    setupEventListeners();
}

function setupOpenButton() {
    const openBtn = dom.get('btn-open-wardrobe');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            openWardrobeModal();
        });
    }
}

function ensureWardrobeDOM() {
    if (dom.get('wardrobe-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'wardrobe-modal-overlay';
    overlay.className = 'wardrobe-modal-overlay hidden';
    overlay.innerHTML = `
        <div class="wardrobe-window" id="wardrobe-window">
            <div class="wardrobe-header">
                <div class="wardrobe-title-group">
                    <span class="wardrobe-title-icon">⚔️</span>
                    <div class="wardrobe-title-text">
                        <h3>ГАРДЕРОБ & ОРУЖЕЙНАЯ</h3>
                        <p>Экипировка героя и арсенал TACZ в 3D</p>
                    </div>
                </div>
                <button class="wardrobe-close-btn" id="wardrobe-close-btn" title="Закрыть">✕</button>
            </div>

            <div class="wardrobe-body">
                <!-- Левая колонка: Категории / Слоты -->
                <div class="wardrobe-nav-sidebar">
                    <div class="wardrobe-nav-group-title">СЛОТЫ СНАРЯЖЕНИЯ</div>
                    <button class="wardrobe-slot-tab active" data-slot="mainHand">
                        <span class="tab-icon">⚔️</span>
                        <span class="tab-label">Оружие / TACZ</span>
                        <span class="slot-active-badge" id="badge-slot-mainHand"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="head">
                        <span class="tab-icon">🪖</span>
                        <span class="tab-label">Шлем / Голова</span>
                        <span class="slot-active-badge" id="badge-slot-head"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="chest">
                        <span class="tab-icon">🎽</span>
                        <span class="tab-label">Нагрудник</span>
                        <span class="slot-active-badge" id="badge-slot-chest"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="legs">
                        <span class="tab-icon">👖</span>
                        <span class="tab-label">Поножи</span>
                        <span class="slot-active-badge" id="badge-slot-legs"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="boots">
                        <span class="tab-icon">👢</span>
                        <span class="tab-label">Ботинки</span>
                        <span class="slot-active-badge" id="badge-slot-boots"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="offHand">
                        <span class="tab-icon">🛡️</span>
                        <span class="tab-label">Вторая рука</span>
                        <span class="slot-active-badge" id="badge-slot-offHand"></span>
                    </button>
                    <button class="wardrobe-slot-tab" data-slot="back">
                        <span class="tab-icon">🎒</span>
                        <span class="tab-label">Спина / Рюкзак</span>
                        <span class="slot-active-badge" id="badge-slot-back"></span>
                    </button>

                    <div class="wardrobe-nav-group-title" style="margin-top:12px;">ГОТОВЫЕ СЕТЫ</div>
                    <button class="wardrobe-slot-tab preset-tab-highlight" data-slot="presets">
                        <span class="tab-icon">⚡</span>
                        <span class="tab-label">Быстрые пресеты</span>
                    </button>
                </div>

                <!-- Правая колонка: Сетка предметов / пресетов -->
                <div class="wardrobe-content-area" id="wardrobe-content-area">
                    <!-- Заполняется динамически -->
                </div>
            </div>

            <div class="wardrobe-footer">
                <div class="wardrobe-footer-hint">
                    <span>💡 Выбранная экипировка мгновенно отображается на 3D скине и сохраняется в профиле</span>
                </div>
                <button class="wardrobe-done-btn" id="wardrobe-done-btn">Готово</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

function setupEventListeners() {
    const overlay = dom.get('wardrobe-modal-overlay');
    const closeBtn = dom.get('wardrobe-close-btn');
    const doneBtn = dom.get('wardrobe-done-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeWardrobeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeWardrobeModal);

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeWardrobeModal();
        });
    }

    // Слушатели табов категорий
    document.querySelectorAll('.wardrobe-slot-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const slot = tab.getAttribute('data-slot');
            switchSlotTab(slot);
        });
    });

    // Escape для закрытия
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isWardrobeOpen) {
            closeWardrobeModal();
        }
    });
}

export function openWardrobeModal() {
    isWardrobeOpen = true;
    const overlay = dom.get('wardrobe-modal-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('visible');
        renderActiveTab();
        updateNavBadges();
        audioSynth.playClick();
    }
}

export function closeWardrobeModal() {
    isWardrobeOpen = false;
    const overlay = dom.get('wardrobe-modal-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.classList.add('hidden'), 200);
    }
}

function switchSlotTab(slot) {
    activeSlotTab = slot;
    document.querySelectorAll('.wardrobe-slot-tab').forEach(t => {
        if (t.getAttribute('data-slot') === slot) t.classList.add('active');
        else t.classList.remove('active');
    });

    renderActiveTab();
    audioSynth.playClick();
}

function renderActiveTab() {
    const area = dom.get('wardrobe-content-area');
    if (!area) return;

    const currentEquip = equipmentManager.getEquipment();

    if (activeSlotTab === 'presets') {
        // Рендер пресетов
        let html = `
            <div class="wardrobe-section-header">
                <h4>⚡ КОМПЛЕКТЫ ЭКИПИРОВКИ В 1 КЛИК</h4>
                <p>Выберите готовый стилизованный набор брони и оружия</p>
            </div>
            <div class="wardrobe-presets-grid">
        `;

        Object.keys(EQUIPMENT_PRESETS).forEach(pKey => {
            const p = EQUIPMENT_PRESETS[pKey];
            html += `
                <div class="wardrobe-preset-card" data-preset-id="${p.id}">
                    <div class="preset-icon-box">${p.icon}</div>
                    <div class="preset-info">
                        <div class="preset-name">${p.name}</div>
                        <div class="preset-desc">${p.desc}</div>
                    </div>
                    <button class="preset-apply-btn">Применить</button>
                </div>
            `;
        });

        html += `</div>`;
        area.innerHTML = html;

        area.querySelectorAll('.wardrobe-preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const pid = card.getAttribute('data-preset-id');
                equipmentManager.applyPreset(pid);
                equipmentManager.applyToViewer(getSkinViewer3d());
                updateNavBadges();
                audioSynth.playSuccess();

                card.classList.add('preset-applied');
                setTimeout(() => card.classList.remove('preset-applied'), 400);
            });
        });

        return;
    }

    // Рендер предметов для выбранного слота
    const catalog = EQUIPMENT_CATALOG[activeSlotTab];
    if (!catalog) return;

    const currentSelectedId = currentEquip[activeSlotTab] || 'none';

    let html = `
        <div class="wardrobe-section-header">
            <h4>${getSlotDisplayName(activeSlotTab).toUpperCase()}</h4>
            <p>Выберите предмет для экипировки</p>
        </div>
        <div class="wardrobe-items-grid">
    `;

    Object.keys(catalog).forEach(itemId => {
        const item = catalog[itemId];
        const isSelected = currentSelectedId === item.id;
        const rarityClass = `rarity-${item.rarity || 'common'}`;

        let iconMarkup = `<span class="item-emoji-icon">${item.icon}</span>`;
        if (item.isImage) {
            iconMarkup = `<img class="item-img-icon" src="${item.icon}" alt="${item.name}" />`;
        }

        html += `
            <div class="wardrobe-item-card ${isSelected ? 'selected' : ''} ${rarityClass}" data-item-id="${item.id}">
                <div class="item-icon-wrapper">
                    ${iconMarkup}
                    ${isSelected ? '<span class="item-equipped-pill">НАДЕТО</span>' : ''}
                </div>
                <div class="item-card-body">
                    <div class="item-card-name">${item.name}</div>
                    ${item.mod ? `<span class="item-mod-tag">${item.mod}</span>` : ''}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    area.innerHTML = html;

    area.querySelectorAll('.wardrobe-item-card').forEach(card => {
        card.addEventListener('click', () => {
            const itemId = card.getAttribute('data-item-id');
            equipmentManager.setSlot(activeSlotTab, itemId);
            equipmentManager.applyToViewer(getSkinViewer3d());
            renderActiveTab();
            updateNavBadges();
            audioSynth.playEquip();
        });
    });
}

function updateNavBadges() {
    const current = equipmentManager.getEquipment();
    ['head', 'chest', 'legs', 'boots', 'mainHand', 'offHand', 'back'].forEach(slot => {
        const badge = dom.get(`badge-slot-${slot}`);
        if (badge) {
            const itemId = current[slot];
            const item = EQUIPMENT_CATALOG[slot] ? EQUIPMENT_CATALOG[slot][itemId] : null;
            if (item && item.id !== 'none') {
                badge.innerText = item.name.split(' ')[0];
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

function getSlotDisplayName(slot) {
    const names = {
        head: 'Шлем и головные уборы',
        chest: 'Нагрудники и броня',
        legs: 'Поножи',
        boots: 'Ботинки и обувь',
        mainHand: 'Оружие, инструменты и огнестрел TACZ',
        offHand: 'Вторая рука (Щиты, Тотемы)',
        back: 'Спина (Рюкзаки, Элитры)',
        presets: 'Быстрые наборы'
    };
    return names[slot] || slot;
}
