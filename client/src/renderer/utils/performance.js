/**
 * GanjaCraft Launcher - Performance Utilities
 * Утилиты для оптимизации производительности
 */

/**
 * Throttle функция - ограничивает частоту вызовов
 * @param {Function} fn - функция для throttle
 * @param {number} limit - минимальный интервал между вызовами (мс)
 * @returns {Function}
 */
export function throttle(fn, limit) {
    let inThrottle = false;
    let lastArgs = null;
    
    return function throttled(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    throttled.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            lastArgs = args;
        }
    };
}

/**
 * Debounce функция - откладывает вызов до окончания серии событий
 * @param {Function} fn - функция для debounce
 * @param {number} delay - задержка (мс)
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timeoutId = null;
    
    const debounced = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
    
    debounced.cancel = () => clearTimeout(timeoutId);
    debounced.flush = function(...args) {
        clearTimeout(timeoutId);
        fn.apply(this, args);
    };
    
    return debounced;
}

/**
 * RequestAnimationFrame throttle - для плавных анимаций
 * @param {Function} fn - функция для выполнения
 * @returns {Function}
 */
export function rafThrottle(fn) {
    let rafId = null;
    let lastArgs = null;
    
    return function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                fn.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
}

/**
 * Единый метод управления инерционными каскадными анимациями элементов (DRY)
 * @param {HTMLElement|string} target - Элемент или CSS-селектор контейнера
 * @param {'right'|'left'|'down'|'up'} direction - Направление каскада
 * @param {boolean} randomize - Индивидуальная случайная задержка и инерция каждой карточки
 */
export function triggerInertiaCascade(target, direction = 'down', randomize = true) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    
    el.dataset.dir = direction;
    el.classList.remove('inertia-cascade');
    void el.offsetWidth; // Force reflow
    el.classList.add('inertia-cascade');

    const children = Array.from(el.children);
    if (!children.length) return;

    const directions = ['right', 'left', 'down', 'up'];

    children.forEach((child, index) => {
        child.style.animation = 'none';
        void child.offsetWidth;

        if (randomize) {
            const randDir = Math.random() < 0.75 ? direction : directions[Math.floor(Math.random() * directions.length)];
            const animName = `inertia-enter-${randDir}`;
            const delayMs = Math.round(index * 35 + Math.random() * 40);
            const durationMs = Math.round(320 + Math.random() * 90);

            child.style.animation = `${animName} ${durationMs}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delayMs}ms both`;
            child.style.opacity = '1';
        } else {
            child.style.animation = '';
        }
    });
}
