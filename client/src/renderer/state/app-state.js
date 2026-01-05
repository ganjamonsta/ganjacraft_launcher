/**
 * GanjaCraft Launcher - App State Manager
 * Централизованное управление состоянием приложения
 */

class AppState {
    constructor() {
        this._state = {
            // Current screen
            currentStep: 'loading',
            
            // Authentication
            auth: {
                username: '',
                token: '',
                isAdmin: false
            },
            
            // Game state
            game: {
                isRunning: false,
                isLaunching: false
            },
            
            // UI state
            ui: {
                isAnimationLocked: false,
                settingsOpen: false,
                consoleVisible: false,
                currentTabIndex: 0
            },
            
            // Visual effects state
            effects: {
                snowEnabled: true,
                smokeEnabled: true,
                parallaxEnabled: true
            },
            
            // Easter egg state
            easterEgg: {
                active: false,
                stage: 0,
                originalNewsContent: null,
                originalPanelTitle: null
            },
            
            // Config (loaded from main process)
            config: {}
        };
        
        // Subscribers for state changes
        this._subscribers = new Map();
    }
    
    /**
     * Get a state value by key path (e.g., 'auth.username')
     */
    get(keyPath) {
        const keys = keyPath.split('.');
        let value = this._state;
        for (const key of keys) {
            if (value === undefined) return undefined;
            value = value[key];
        }
        return value;
    }
    
    /**
     * Set a state value by key path
     */
    set(keyPath, value) {
        const keys = keyPath.split('.');
        const lastKey = keys.pop();
        let target = this._state;
        
        for (const key of keys) {
            if (target[key] === undefined) {
                target[key] = {};
            }
            target = target[key];
        }
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Notify subscribers
        this._notifySubscribers(keyPath, value, oldValue);
    }
    
    /**
     * Update multiple properties in a nested object
     */
    update(keyPath, partial) {
        const current = this.get(keyPath) || {};
        this.set(keyPath, { ...current, ...partial });
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(keyPath, callback) {
        if (!this._subscribers.has(keyPath)) {
            this._subscribers.set(keyPath, new Set());
        }
        this._subscribers.get(keyPath).add(callback);
        
        // Return unsubscribe function
        return () => {
            this._subscribers.get(keyPath)?.delete(callback);
        };
    }
    
    /**
     * Notify subscribers of state changes
     */
    _notifySubscribers(keyPath, newValue, oldValue) {
        // Exact match subscribers
        if (this._subscribers.has(keyPath)) {
            for (const callback of this._subscribers.get(keyPath)) {
                callback(newValue, oldValue);
            }
        }
        
        // Parent path subscribers (e.g., 'auth' when 'auth.username' changes)
        const keys = keyPath.split('.');
        for (let i = 1; i < keys.length; i++) {
            const parentPath = keys.slice(0, i).join('.');
            if (this._subscribers.has(parentPath)) {
                for (const callback of this._subscribers.get(parentPath)) {
                    callback(this.get(parentPath), null);
                }
            }
        }
    }
    
    /**
     * Get full state (for debugging)
     */
    getAll() {
        return { ...this._state };
    }
    
    /**
     * Reset state to initial values
     */
    reset() {
        this._state = {
            currentStep: 'loading',
            auth: { username: '', token: '', isAdmin: false },
            game: { isRunning: false, isLaunching: false },
            ui: { isAnimationLocked: false, settingsOpen: false, consoleVisible: false, currentTabIndex: 0 },
            effects: { snowEnabled: true, smokeEnabled: true, parallaxEnabled: true },
            easterEgg: { active: false, stage: 0, originalNewsContent: null, originalPanelTitle: null },
            config: {}
        };
    }
}

// Singleton instance
export const appState = new AppState();

// Export class for testing
export { AppState };
