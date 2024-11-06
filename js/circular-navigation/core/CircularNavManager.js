/**
 * Main Controller for Circular Navigation
 * Coordinates between all managers and handles core functionality
 */

import { StateManager } from '../state/StateManager';
import { DisplayManager } from '../state/DisplayManager';
import { CacheManager } from '../state/CacheManager';
import { VisualizationManager } from '../visualization/VisualizationManager';
import { NodeManager } from '../visualization/NodeManager';
import { PathManager } from '../visualization/PathManager';
import { OuterElementManager } from '../visualization/OuterElementManager';
//import { ZoomManager } from '../visualization/ZoomManager';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Controls } from '../ui/Controls';
import { validateConfig } from './config';
//import { performance } from '../utils/performance';

export class CircularNavManager {
    /**
     * Creates a new CircularNavManager instance
     * @param {string} containerId - DOM element ID
     * @param {string} postType - WordPress post type
     * @param {Object} config - Configuration object
     */
    constructor(containerId, postType, config = {}) {
        // Validate inputs
        if (!containerId) throw new Error('Container ID is required');
        if (!postType) throw new Error('Post type is required');
        
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container ${containerId} not found`);

        // Core properties
        this.id = containerId;
        this.postType = postType;
        this.config = validateConfig(config) ? config : {};

        // Initialize managers
        this.initializeManagers();

        // Bind methods
        this.handleResize = performance.debounce(this.handleResize.bind(this), 250);
        this.handleNodeClick = this.handleNodeClick.bind(this);
    }

    /**
     * Initializes all manager instances
     * @private
     */
    initializeManagers() {
        // State managers
        this.state = new StateManager(this);
        this.display = new DisplayManager(this);
        this.cache = new CacheManager(this);

        // Visualization managers
        this.viz = new VisualizationManager(this);
        this.nodes = new NodeManager(this);
        this.paths = new PathManager(this);
        this.outer = new OuterElementManager(this);
        this.zoom = new ZoomManager(this);

        // UI managers
        this.settings = new SettingsPanel(this);
        this.controls = new Controls(this);
    }

    /**
     * Initializes the visualization
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Start initialization
            await this.state.initialize();

            // Setup display and cache
            this.display.setup();
            await this.cache.init();

            // Create visualization
            await this.viz.create();
            
            // Setup UI
            this.settings.create();
            this.controls.create();

            // Setup event listeners
            this.setupEventListeners();

            // Set initialized state
            await this.state.updateState({ isInitialized: true });

        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleError(error);
        }
    }

    /**
     * Sets up event listeners
     * @private
     */
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);

        // Container events
        this.container.addEventListener('node:click', this.handleNodeClick);
        this.container.addEventListener('zoom:change', this.handleZoomChange);

        // State change handlers
        this.state.on('selectionChange', this.handleSelectionChange.bind(this));
        this.state.on('dataChange', this.handleDataChange.bind(this));
    }

    /**
     * Removes event listeners
     * @private
     */
    removeEventListeners() {
        window.removeEventListener('resize', this.handleResize);
        this.container.removeEventListener('node:click', this.handleNodeClick);
        this.container.removeEventListener('zoom:change', this.handleZoomChange);
        this.state.removeAllListeners();
    }

    /**
     * Handles node click events
     * @param {Event} event - Custom event with node data
     * @private
     */
    handleNodeClick(event) {
        const node = event.detail.node;
        if (!node || this.state.isTransitioning) return;

        this.state.updateState({ 
            selectedNode: node,
            isTransitioning: true 
        });
    }

    /**
     * Handles resize events
     * @private
     */
    handleResize() {
        if (this.state.isDestroying) return;

        const dimensions = this.display.calculateDimensions();
        this.viz.update(null, dimensions);
    }

    /**
     * Handles errors
     * @param {Error} error - Error object
     * @private
     */
    handleError(error) {
        console.error('CircularNav Error:', error);
        this.state.updateState({ 
            error: error,
            isError: true 
        });

        // Notify container
        const errorEvent = new CustomEvent('circular-nav:error', {
            detail: { error }
        });
        this.container.dispatchEvent(errorEvent);
    }

    /**
     * Updates the visualization
     * @param {Object} [data] - New data
     * @param {Object} [config] - New config
     * @returns {Promise<void>}
     */
    async update(data = null, config = null) {
        try {
            // Update state first
            await this.state.startUpdate();

            // Update config if provided
            if (config) {
                this.config = validateConfig({
                    ...this.config,
                    ...config
                }) ? {...this.config, ...config} : this.config;
            }

            // Update data if provided
            if (data) {
                await this.state.updateState({ data });
            }

            // Update visualization
            const dimensions = this.display.calculateDimensions();
            await this.viz.update(data, dimensions);

            // End update
            await this.state.endUpdate();

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Destroys the instance and cleans up
     * @returns {Promise<void>}
     */
    async destroy() {
        try {
            // Start cleanup
            await this.state.updateState({ isDestroying: true });

            // Remove event listeners
            this.removeEventListeners();

            // Destroy managers
            this.viz.destroy();
            this.settings.destroy();
            await this.cache.clear();

            // Clean up DOM
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }

            // Final state cleanup
            this.state.destroy();

        } catch (error) {
            console.error('Destroy error:', error);
        }
    }
}