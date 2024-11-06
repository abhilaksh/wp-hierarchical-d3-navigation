/**
 * Circular Navigation Entry Point
 * Handles initialization and instance management
 */

import { CircularNavManager } from './CircularNavManager';
import { DEFAULT_CONFIG } from './config';

class CircularNavigation {
    static instances = new Map();

    /**
     * Creates a new circular navigation instance
     */
    static createInstance(containerId, postType, config = {}) {
        if (CircularNavigation.instances.has(containerId)) {
            throw new Error(`Instance ${containerId} already exists`);
        }

        const instance = new CircularNavManager(containerId, postType, {
            ...DEFAULT_CONFIG,
            ...config
        });

        CircularNavigation.instances.set(containerId, instance);
        return instance;
    }

    /**
     * Gets an existing instance
     */
    static getInstance(containerId) {
        return CircularNavigation.instances.get(containerId);
    }

    /**
     * Destroys an instance
     */
    static destroyInstance(containerId) {
        const instance = CircularNavigation.instances.get(containerId);
        if (instance) {
            instance.destroy();
            CircularNavigation.instances.delete(containerId);
            return true;
        }
        return false;
    }
}

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
    // Find all circular navigation containers
    document.querySelectorAll('[data-circular-nav]').forEach(container => {
        try {
            const containerId = container.id;
            const postType = container.dataset.postType;
            const config = JSON.parse(container.dataset.config || '{}');

            CircularNavigation.createInstance(containerId, postType, config);
        } catch (error) {
            console.error(`Failed to initialize circular navigation:`, error);
        }
    });
});

// Cleanup on unload
window.addEventListener('unload', () => {
    CircularNavigation.instances.forEach((instance, id) => {
        CircularNavigation.destroyInstance(id);
    });
});

export default CircularNavigation;