/**
 * State Manager
 * Handles all state changes and transitions
 */

export class StateManager {
    constructor(parent) {
        this.parent = parent;
        this.listeners = new Map();
        
        // Initialize state
        this.state = {
            isInitialized: false,
            isDestroying: false,
            isTransitioning: false,
            isUpdating: false,
            isError: false,
            error: null,
            data: null,
            selectedNode: null,
            previousNode: null,
            zoomLevel: 1,
            dimensions: null,
            contentLoaded: new Set()
        };
    }

    /**
     * Initialize state
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.fetchInitialData();
        return this.updateState({
            isInitialized: true,
            data: this.state.data
        });
    }

    /**
     * Fetches initial data
     * @private
     * @returns {Promise<void>}
     */
    async fetchInitialData() {
        try {
            const response = await fetch(ajaxurl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    action: 'fetch_hierarchical_posts',
                    post_type: this.parent.postType,
                    nonce: circularNavData.nonce
                })
            });

            const result = await response.json();
            if (!result.success) throw new Error('Data fetch failed');

            await this.updateState({ data: result.data });

        } catch (error) {
            console.error('Data fetch error:', error);
            throw error;
        }
    }

    /**
     * Updates state and triggers events
     * @param {Object} newState - New state object
     * @returns {Promise<void>}
     */
    async updateState(newState) {
        const oldState = {...this.state};
        this.state = {...this.state, ...newState};

        // Handle specific state changes
        await this.handleStateChange(oldState, this.state);

        // Emit events for changed properties
        Object.keys(newState).forEach(key => {
            if (newState[key] !== oldState[key]) {
                this.emit(`${key}Change`, {
                    oldValue: oldState[key],
                    newValue: newState[key]
                });
            }
        });
    }

    /**
     * Handles state changes
     * @private
     * @param {Object} oldState - Previous state
     * @param {Object} newState - New state
     */
    async handleStateChange(oldState, newState) {
        // Handle selection changes
        if (newState.selectedNode !== oldState.selectedNode) {
            if (oldState.selectedNode) {
                newState.previousNode = oldState.selectedNode;
            }
            await this.handleSelectionChange(newState.selectedNode, oldState.selectedNode);
        }

        // Handle data changes
        if (newState.data !== oldState.data) {
            await this.handleDataChange(newState.data);
        }

        // Handle transition state
        if (newState.isTransitioning !== oldState.isTransitioning) {
            this.handleTransitionChange(newState.isTransitioning);
        }

        // Handle error state
        if (newState.isError !== oldState.isError) {
            this.handleErrorChange(newState.error);
        }
    }

    /**
     * Handles node selection changes
     * @private
     * @param {Object} newNode - Newly selected node
     * @param {Object} oldNode - Previously selected node
     */
    async handleSelectionChange(newNode, oldNode) {
        // Start transition
        await this.updateState({ isTransitioning: true });

        try {
            // Preload content if needed
            if (newNode && !this.state.contentLoaded.has(newNode.id)) {
                await this.parent.cache.preload(newNode.id);
                this.state.contentLoaded.add(newNode.id);
            }

            // Update visualization
            await this.parent.viz.updateSelection(newNode, oldNode);

        } catch (error) {
            console.error('Selection change error:', error);
            this.parent.handleError(error);
        } finally {
            // End transition
            await this.updateState({ isTransitioning: false });
        }
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.listeners.clear();
        this.state = null;
    }

    /**
     * Update lifecycle methods
     */
    async startUpdate() {
        return this.updateState({ isUpdating: true });
    }

    async endUpdate() {
        return this.updateState({ isUpdating: false });
    }

    /**
     * Getters
     */
    getSelectedNode() {
        return this.state.selectedNode;
    }

    getPreviousNode() {
        return this.state.previousNode;
    }

    getData() {
        return this.state.data;
    }

    isTransitioning() {
        return this.state.isTransitioning;
    }
}