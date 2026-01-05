/**
 * GanjaCraft Launcher - DOM Utilities
 * Кеширование и хелперы для работы с DOM
 */

class DOMCache {
    constructor() {
        this._cache = new Map();
    }
    
    /**
     * Get element by ID with caching
     */
    get(id) {
        if (!this._cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this._cache.set(id, element);
            }
            return element;
        }
        return this._cache.get(id);
    }
    
    /**
     * Get multiple elements by IDs
     */
    getAll(ids) {
        const result = {};
        for (const id of ids) {
            result[id] = this.get(id);
        }
        return result;
    }
    
    /**
     * Clear cache (useful after DOM changes)
     */
    clear() {
        this._cache.clear();
    }
    
    /**
     * Remove specific element from cache
     */
    invalidate(id) {
        this._cache.delete(id);
    }
}

// Singleton
export const dom = new DOMCache();

/**
 * Safe querySelector wrapper
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Safe querySelectorAll wrapper
 */
export function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

/**
 * Add event listener with cleanup support
 */
export function on(element, event, handler, options) {
    if (!element) return () => {};
    
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
}

/**
 * Add multiple event listeners
 */
export function onAll(elements, event, handler, options) {
    const cleanups = [];
    for (const el of elements) {
        cleanups.push(on(el, event, handler, options));
    }
    return () => cleanups.forEach(fn => fn());
}

/**
 * Create element with attributes and children
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') {
            Object.assign(el.dataset, value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }
    
    return el;
}

/**
 * Show element (remove hidden class)
 */
export function show(element) {
    if (element) element.classList.remove('hidden');
}

/**
 * Hide element (add hidden class)
 */
export function hide(element) {
    if (element) element.classList.add('hidden');
}

/**
 * Toggle element visibility
 */
export function toggle(element, visible) {
    if (element) {
        if (visible === undefined) {
            element.classList.toggle('hidden');
        } else {
            element.classList.toggle('hidden', !visible);
        }
    }
}

/**
 * Add class with animation support
 */
export function addClass(element, className) {
    if (element) element.classList.add(className);
}

/**
 * Remove class
 */
export function removeClass(element, className) {
    if (element) element.classList.remove(className);
}

/**
 * Check if element has class
 */
export function hasClass(element, className) {
    return element?.classList.contains(className) ?? false;
}
