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
 * Batch DOM updates - группирует обновления DOM
 * @param {Function[]} updates - массив функций обновления
 */
export function batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
        // Force read phase (все чтения DOM)
        const reads = updates.filter(u => u.type === 'read').map(u => u.fn());
        
        // Write phase (все записи DOM)
        updates.filter(u => u.type !== 'read').forEach(u => u.fn(reads));
    });
}

/**
 * Lazy load - отложенная загрузка
 * @param {Function} factory - функция создания
 * @returns {Function}
 */
export function lazy(factory) {
    let instance = null;
    let initialized = false;
    
    return () => {
        if (!initialized) {
            instance = factory();
            initialized = true;
        }
        return instance;
    };
}

/**
 * Intersection Observer для ленивой загрузки
 * @param {Element} element - элемент для наблюдения
 * @param {Function} callback - колбэк при появлении
 * @param {Object} options - опции IntersectionObserver
 * @returns {Function} - функция отмены наблюдения
 */
export function onVisible(element, callback, options = {}) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                callback(entry.target);
                if (options.once !== false) {
                    observer.unobserve(entry.target);
                }
            }
        });
    }, {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '50px'
    });
    
    observer.observe(element);
    
    return () => observer.unobserve(element);
}

/**
 * Pool объектов для переиспользования DOM элементов
 */
export class ObjectPool {
    constructor(factory, reset, initialSize = 10) {
        this._factory = factory;
        this._reset = reset;
        this._pool = [];
        
        // Pre-populate
        for (let i = 0; i < initialSize; i++) {
            this._pool.push(factory());
        }
    }
    
    acquire() {
        return this._pool.length > 0 ? this._pool.pop() : this._factory();
    }
    
    release(obj) {
        this._reset(obj);
        this._pool.push(obj);
    }
    
    get size() {
        return this._pool.length;
    }
}

/**
 * Измерение производительности
 * @param {string} label - метка
 * @param {Function} fn - функция для измерения
 * @returns {*} - результат функции
 */
export function measure(label, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.debug(`[Perf] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}

/**
 * Async измерение производительности
 * @param {string} label - метка
 * @param {Function} fn - async функция для измерения
 * @returns {Promise<*>} - результат функции
 */
export async function measureAsync(label, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.debug(`[Perf] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}

/**
 * Idle callback wrapper - выполняет задачу когда браузер свободен
 * @param {Function} fn - функция для выполнения
 * @param {Object} options - опции
 * @returns {number} - ID для отмены
 */
export function whenIdle(fn, options = {}) {
    if ('requestIdleCallback' in window) {
        return requestIdleCallback(fn, { timeout: options.timeout || 2000 });
    } else {
        // Fallback для старых браузеров
        return setTimeout(fn, 1);
    }
}

/**
 * Отмена idle callback
 * @param {number} id 
 */
export function cancelIdle(id) {
    if ('cancelIdleCallback' in window) {
        cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

/**
 * Frame budget - проверка есть ли время в текущем кадре
 * @param {number} startTime - время начала кадра
 * @param {number} budget - бюджет времени (мс), default 16ms для 60fps
 * @returns {boolean}
 */
export function hasFrameBudget(startTime, budget = 16) {
    return performance.now() - startTime < budget;
}

/**
 * Chunk array processing - обработка больших массивов по частям
 * @param {Array} array - массив для обработки
 * @param {Function} processor - функция обработки элемента
 * @param {number} chunkSize - размер чанка
 * @param {number} delay - задержка между чанками (мс)
 * @returns {Promise<void>}
 */
export async function processInChunks(array, processor, chunkSize = 50, delay = 0) {
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        chunk.forEach(processor);
        
        if (delay > 0 && i + chunkSize < array.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
