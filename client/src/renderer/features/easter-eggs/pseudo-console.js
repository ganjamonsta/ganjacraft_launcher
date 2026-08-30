/**
 * Ganj4Craft Launcher - Pseudo Admin / RCON Hacker Console
 * Секретная консоль сервера для выдачи опки, креатива, накрутки EMC и других приколов
 */

import { dom } from '../../utils/dom.js';
import { audioSynth } from './audio-synth.js';
import { skinTricks } from './skin-tricks.js';
import { triggerMemeWebcam } from './meme-webcam.js';
import { triggerBlazeRave } from './blaze-rave.js';
import { createSnowBurst } from '../../ui/effects/index.js';

class PseudoConsole {
    constructor() {
        this.isOpen = false;
        this.history = [];
        this.historyIndex = -1;
        this.container = null;
        this.output = null;
        this.input = null;
        this.currentEmc = 0;
    }

    /**
     * Создать или получить элементы консоли в DOM
     */
    ensureDOM() {
        if (this.container) return;

        const overlay = document.createElement('div');
        overlay.id = 'pseudo-console-overlay';
        overlay.className = 'pseudo-console-overlay hidden';
        overlay.innerHTML = `
            <div class="pseudo-console-window">
                <div class="pseudo-console-header">
                    <div class="pseudo-console-title">
                        <span class="terminal-dot green"></span>
                        <span class="terminal-dot yellow"></span>
                        <span class="terminal-dot red"></span>
                        <span class="terminal-title-text">Ganj4Craft Server Core [RCON Root Terminal v4.20] — ACCESS LEVEL: ROOT</span>
                    </div>
                    <button class="pseudo-console-close" id="pseudo-console-close-btn" title="Закрыть (Esc или ~)">✕</button>
                </div>
                <div class="pseudo-console-body" id="pseudo-console-output">
                    <div class="console-line system">[SYSTEM] Ganj4Craft Direct RCON Bridge initialized.</div>
                    <div class="console-line system">[SYSTEM] Connected to local cluster node: 127.0.0.1:25575</div>
                    <div class="console-line tip">💡 Введите <span class="cmd-highlight">/help</span> для списка секретных чит-команд (выдача опки, креатив, EMC и др.)</div>
                </div>
                <div class="pseudo-console-input-row">
                    <span class="pseudo-prompt">root@ganjacraft-core:~#</span>
                    <input type="text" id="pseudo-console-input" class="pseudo-input" autocomplete="off" spellcheck="false" placeholder="Введите команду (/op, /gm 1, /give emc, /help)...">
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        this.container = overlay;
        this.output = overlay.querySelector('#pseudo-console-output');
        this.input = overlay.querySelector('#pseudo-console-input');

        const closeBtn = overlay.querySelector('#pseudo-console-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggle(false));
        }

        if (this.input) {
            this.input.addEventListener('keydown', (e) => this.handleInputKey(e));
        }

        // Клик по оверлею вне окна закрывает
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.toggle(false);
            }
        });
    }

    /**
     * Открыть / закрыть консоль
     */
    toggle(forceState) {
        this.ensureDOM();
        const shouldOpen = forceState !== undefined ? forceState : !this.isOpen;
        this.isOpen = shouldOpen;

        if (this.isOpen) {
            this.container.classList.remove('hidden');
            setTimeout(() => {
                this.container.classList.add('visible');
                if (this.input) {
                    this.input.focus();
                    this.input.select();
                }
            }, 10);
            audioSynth.playPop(1.5);
        } else {
            this.container.classList.remove('visible');
            setTimeout(() => {
                this.container.classList.add('hidden');
            }, 200);
        }
    }

    /**
     * Добавить строку в вывод
     */
    log(text, type = 'normal') {
        this.ensureDOM();
        if (!this.output) return;

        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.innerHTML = text;
        this.output.appendChild(line);

        // Auto-scroll
        this.output.scrollTop = this.output.scrollHeight;
    }

    /**
     * Обработка нажатий клавиш в строке ввода
     */
    handleInputKey(e) {
        if (e.key === 'Enter') {
            const val = this.input.value.trim();
            if (val) {
                this.history.push(val);
                this.historyIndex = this.history.length;
                this.executeCommand(val);
                this.input.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.history.length > 0 && this.historyIndex > 0) {
                this.historyIndex--;
                this.input.value = this.history[this.historyIndex] || '';
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.input.value = this.history[this.historyIndex] || '';
            } else {
                this.historyIndex = this.history.length;
                this.input.value = '';
            }
        } else if (e.key === 'Escape' || e.key === '`' || e.key === 'ё' || e.key === 'Ё') {
            e.preventDefault();
            this.toggle(false);
        }
    }

    /**
     * Выполнение чит-команд
     */
    executeCommand(cmdRaw) {
        let cmd = cmdRaw.trim();
        this.log(`<span class="prompt-echo">root@ganjacraft-core:~#</span> <span class="cmd-echo">${this.escapeHtml(cmd)}</span>`, 'user-cmd');

        if (cmd.startsWith('/')) {
            cmd = cmd.slice(1);
        }

        const parts = cmd.split(/\s+/);
        const action = parts[0]?.toLowerCase();
        const arg1 = parts[1]?.toLowerCase();
        const arg2 = parts[2]?.toLowerCase();

        // Текущий ник
        const usernameElem = dom.get('player-display-name');
        const username = usernameElem ? usernameElem.innerText : (localStorage.getItem('auth_user') || 'Игрок');

        switch (action) {
            case 'help':
            case '?':
                this.log(`
                    <div class="help-box">
                        <div class="help-title">═══════ ДОСТУПНЫЕ СЕРВЕРНЫЕ ЧИТ-КОМАНДЫ ═══════</div>
                        <div class="help-item"><span class="cmd-col">/op [ник]</span> <span class="desc-col">— Выдать права Главного Админа (Опку) + корону</span></div>
                        <div class="help-item"><span class="cmd-col">/deop [ник]</span> <span class="desc-col">— Снять опку, вернуть статус Игрока</span></div>
                        <div class="help-item"><span class="cmd-col">/gamemode creative (или /gm 1, /fly)</span> <span class="desc-col">— Включить Креатив & Левитацию скина</span></div>
                        <div class="help-item"><span class="cmd-col">/gamemode survival (или /gm 0)</span> <span class="desc-col">— Вернуть режим Выживания</span></div>
                        <div class="help-item"><span class="cmd-col">/give emc [кол-во]</span> <span class="desc-col">— Накрутить себе EMC баланс до небес</span></div>
                        <div class="help-item"><span class="cmd-col">/dupe</span> <span class="desc-col">— Активировать дюп ресурсов</span></div>
                        <div class="help-item"><span class="cmd-col">/craft</span> <span class="desc-col">— Экстренная видео-связь с админом (крафт не работает)</span></div>
                        <div class="help-item"><span class="cmd-col">/420</span> или <span class="cmd-col">/blaze</span> <span class="desc-col">— 420 BeatDrop Rave Mode</span></div>
                        <div class="help-item"><span class="cmd-col">/ban [ник]</span> <span class="desc-col">— Забанить наглого админа</span></div>
                        <div class="help-item"><span class="cmd-col">/pop</span> <span class="desc-col">— Взорвать сноп листьев на экране</span></div>
                        <div class="help-item"><span class="cmd-col">/clear</span> <span class="desc-col">— Очистить экран терминала</span></div>
                        <div class="help-item"><span class="cmd-col">/exit</span> <span class="desc-col">— Закрыть консоль</span></div>
                    </div>
                `, 'info');
                break;

            case 'op': {
                const target = arg1 || username;
                const badge = dom.get('player-rank-badge');
                if (badge) {
                    badge.innerText = '[👑 ГЛ. АДМИН]';
                    badge.className = 'player-rank-pill minecraft-rank-badge rank-admin op-glow-badge';
                }
                audioSynth.playFanfare();
                createSnowBurst();

                this.log(`[RCON] <span class="success">Made ${target} a server operator (Permission Level: 4 - OWNER).</span>`, 'success');
                this.log(`[SECURITY] 🚨 ВНИМАНИЕ: Игроку ${target} выдана абсолютная власть над сервером. Не сломайте спавн!`, 'warning');
                break;
            }

            case 'deop': {
                const badge = dom.get('player-rank-badge');
                if (badge) {
                    badge.innerText = '[Игрок]';
                    badge.className = 'player-rank-pill minecraft-rank-badge rank-player';
                }
                audioSynth.playPop(0.8);
                this.log(`[RCON] Operator rights removed from ${arg1 || username}. Back to mortal.`, 'normal');
                break;
            }

            case 'gamemode':
            case 'gm':
            case 'fly': {
                const isCreative = action === 'fly' || arg1 === '1' || arg1 === 'c' || arg1 === 'creative';
                if (isCreative) {
                    skinTricks.setCreativeMode(true);
                    audioSynth.playFly();
                    createSnowBurst();

                    const badge = dom.get('player-rank-badge');
                    if (badge && !badge.innerText.includes('АДМИН')) {
                        badge.innerText = '[⚡ КРЕАТИВ]';
                        badge.className = 'player-rank-pill minecraft-rank-badge rank-creative';
                    }

                    this.log(`[GAME] <span class="success">Игровой режим изменен на Творческий (Creative Mode).</span>`, 'success');
                    this.log(`[FLY] 🪽 Левитация 3D персонажа активирована! Взгляните на скин слева!`, 'info');
                } else {
                    skinTricks.setCreativeMode(false);
                    audioSynth.playPop();

                    const badge = dom.get('player-rank-badge');
                    if (badge && badge.innerText.includes('КРЕАТИВ')) {
                        badge.innerText = '[Игрок]';
                        badge.className = 'player-rank-pill minecraft-rank-badge rank-player';
                    }

                    this.log(`[GAME] Игровой режим изменен на Выживание (Survival Mode). Приземление успешно.`, 'normal');
                }
                break;
            }

            case 'give': {
                let amount = 999999;
                let itemName = 'EMC';

                if (arg1 === 'emc') {
                    amount = parseInt(arg2, 10) || 999999;
                    itemName = 'EMC';
                } else if (arg1) {
                    itemName = arg1.toUpperCase();
                    amount = parseInt(arg2, 10) || 64;
                }

                // Накрутка счетчика EMC на дашборде
                const coinsElem = dom.get('stat-coins');
                if (coinsElem) {
                    this.animateEmcCount(coinsElem, amount);
                }

                audioSynth.playCoin();
                this.log(`[RCON] <span class="success">Выдано ${amount.toLocaleString()}x ${itemName} игроку ${username}.</span>`, 'success');
                this.log(`[ECONOMY] 💰 Баланс EMC успешно обновлен на дашборде!`, 'info');
                break;
            }

            case 'emc': {
                const amount = parseInt(arg1, 10) || 999999;
                const coinsElem = dom.get('stat-coins');
                if (coinsElem) {
                    this.animateEmcCount(coinsElem, amount);
                }
                audioSynth.playCoin();
                this.log(`[ECONOMY] <span class="success">EMC баланс увеличен до ${amount.toLocaleString()}!</span>`, 'success');
                break;
            }

            case 'dupe': {
                audioSynth.playError();
                this.log(`[EXPLOIT] 🔍 Поиск уязвимостей в KubeJS и AE2... Найдено!`, 'warning');
                this.log(`[EXPLOIT] 1. Выбросите все ваши вещи и квантовую броню в лаву на спавне.`, 'normal');
                this.log(`[EXPLOIT] 2. Нажмите Alt + F4 в течение 0.420 секунды.`, 'normal');
                this.log(`[EXPLOIT] 3. Вещи успешно продублируются (проверено Нотчем в 2011 году).`, 'success');
                break;
            }

            case 'ban': {
                const target = arg1 || 'admin';
                audioSynth.playError();
                this.log(`[BAN] 🚫 Выполняю бан: ${target}...`, 'error');

                // Фейковый кратковременный экран бана
                this.showFakeBanScreen(target);
                break;
            }

            case 'craft':
            case 'webcam':
            case 'admin_meme': {
                this.toggle(false);
                triggerMemeWebcam();
                break;
            }

            case '420':
            case 'blaze':
            case 'weed':
            case 'rave':
            case 'disco': {
                this.toggle(false);
                triggerBlazeRave();
                break;
            }

            case 'pop': {
                audioSynth.playPop(1.2);
                createSnowBurst();
                this.log(`[EFFECTS] 🌿 Взрыв частиц активирован!`, 'success');
                break;
            }

            case 'clear':
            case 'cls': {
                if (this.output) {
                    this.output.innerHTML = `
                        <div class="console-line system">[SYSTEM] Screen cleared. RCON session active.</div>
                    `;
                }
                break;
            }

            case 'exit':
            case 'quit':
            case 'close': {
                this.toggle(false);
                break;
            }

            default:
                audioSynth.playError();
                this.log(`[ERROR] Неизвестная команда: "${this.escapeHtml(cmd)}". Введите <span class="cmd-highlight">/help</span> для списка.`, 'error');
                break;
        }
    }

    /**
     * Анимация быстрого начисления EMC на дашборде
     */
    animateEmcCount(element, target) {
        let current = parseInt(element.innerText.replace(/\D/g, ''), 10) || 0;
        const step = Math.max(1, Math.floor((target - current) / 20));
        let count = 0;

        const timer = setInterval(() => {
            current += step;
            count++;
            if (count >= 20 || current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.innerText = current.toLocaleString('ru-RU');
        }, 30);
    }

    /**
     * Показать забавный фейковый бан-экран
     */
    showFakeBanScreen(target) {
        const banOverlay = document.createElement('div');
        banOverlay.className = 'fake-ban-screen';
        banOverlay.innerHTML = `
            <div class="fake-ban-modal">
                <div class="ban-title">🔨 ВЫ БЫЛИ ЗАБАНЕНЫ НА СЕРВЕРЕ</div>
                <div class="ban-reason">Причина: Попытка превышения должностных полномочий и свержения админа (${this.escapeHtml(target)})</div>
                <div class="ban-duration">Срок блокировки: <strong>999999 Дней 23 Часа</strong></div>
                <div class="ban-footer">Снятие бана через 3 секунды... Шутка, возвращайтесь!</div>
            </div>
        `;
        document.body.appendChild(banOverlay);

        setTimeout(() => {
            banOverlay.style.opacity = '0';
            banOverlay.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                banOverlay.remove();
                this.log(`[SYSTEM] 😇 Шутка! Бан снят. Играйте с удовольствием.`, 'success');
            }, 500);
        }, 3000);
    }

    escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

export const pseudoConsole = new PseudoConsole();
