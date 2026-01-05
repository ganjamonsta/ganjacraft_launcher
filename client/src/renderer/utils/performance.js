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
