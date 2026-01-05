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
