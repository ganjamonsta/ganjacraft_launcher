/**
 * GanjaCraft Launcher - App State
 * Простое хранилище состояния приложения
 */

class AppState {
    constructor() {
        this._state = {
            // Authentication
            auth: {
                username: '',
                token: '',
                isAdmin: false,
                isLoggedIn: false
            },
            
            // Game state
            game: {
                isRunning: false,
                isLaunching: false
            },
            
            // Visual effects state
            effects: {
                preset: 'auto',
                density: 'medium',
                snowEnabled: true,
                smokeEnabled: true,
                parallaxEnabled: true
            },
            
            // Easter egg state
            easterEgg: {
                active: false,
                stage: 0
            }
        };
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
        
        target[lastKey] = value;
    }
    
    /**
     * Update multiple properties in a nested object
     */
    update(keyPath, partial) {
        const current = this.get(keyPath) || {};
        this.set(keyPath, { ...current, ...partial });
    }
}

// Singleton instance
export const appState = new AppState();
