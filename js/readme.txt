/**
 * File Structure:
 * /js
 *   /circular-navigation/
 *     /core/
 *       - index.js             (entry point & initialization)
 *       - CircularNavManager.js (main controller)
 *       - config.js           (configuration & profiles)
 *     /visualization/
 *       - VisualizationManager.js (main D3 handler)
 *       - NodeManager.js      (node rendering & interactions)
 *       - PathManager.js      (links & paths)
 *       - OuterElementManager.js (indicators & labels)
 *       - ZoomManager.js      (zoom & pan handling)
 *     /state/
 *       - DisplayManager.js   (dimensions & responsiveness)
 *       - StateManager.js     (state & transitions)
 *       - CacheManager.js     (content caching)
 *     /ui/
 *       - SettingsPanel.js    (settings UI)
 *       - Controls.js         (zoom controls & UI elements)
 *     /utils/
 *       - calculations.js     (math & positioning)
 *       - dom.js             (DOM utilities)
 *       - performance.js     (optimization utilities)
 */

/**
 * Configuration & Types
 */
// config.js
const DEFAULT_CONFIG = {
    dimensions: {
        min: { width: 800, height: 600 },
        aspectRatio: 1.25,
        breakpoints: { small: 768, medium: 1024, large: 1440 }
    },
    animation: {
        duration: 500,
        delayOffset: 50
    },
    profiles: {
        mobile: {/*...*/},
        tablet: {/*...*/},
        desktop: {/*...*/}
    }
};

/**
 * Core Controller
 */
// CircularNavManager.js
class CircularNavManager {
    constructor(containerId, postType, config = {}) {
        this.id = containerId;
        this.container = document.getElementById(containerId);
        this.config = deepMerge(DEFAULT_CONFIG, config);
        
        // Core Managers
        this.state = new StateManager(this);
        this.display = new DisplayManager(this);
        this.cache = new CacheManager(this);
        
        // Visualization Managers
        this.viz = new VisualizationManager(this);
        this.nodes = new NodeManager(this);
        this.paths = new PathManager(this);
        this.outer = new OuterElementManager(this);
        this.zoom = new ZoomManager(this);
        
        // UI Managers
        this.settings = new SettingsPanel(this);
        this.controls = new Controls(this);
    }

    async init() {
        try {
            await this.state.initialize();
            this.display.setup();
            await this.cache.init();
            this.viz.create();
            this.setupEventListeners();
            this.settings.create();
            this.controls.create();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleError(error);
        }
    }

    destroy() {
        this.state.cleanup();
        this.viz.destroy();
        this.settings.destroy();
        this.cache.clear();
        this.removeEventListeners();
    }
}

/**
 * State Management
 */
// StateManager.js
class StateManager {
    constructor(parent) {
        this.parent = parent;
        this.state = {
            isInitialized: false,
            isTransitioning: false,
            selectedNode: null,
            previousNode: null,
            zoomLevel: 1,
            contentLoaded: new Set()
        };
    }

    async updateState(newState) {
        const oldState = {...this.state};
        this.state = {...this.state, ...newState};
        await this.handleStateChange(oldState, this.state);
    }
}

/**
 * Visualization Core
 */
// VisualizationManager.js
class VisualizationManager {
    constructor(parent) {
        this.parent = parent;
        this.svg = null;
        this.container = null;
    }

    create() {
        this.createSVG();
        this.parent.nodes.create();
        this.parent.paths.create();
        this.parent.outer.create();
        this.parent.zoom.init();
    }

    update(data = null, dimensions = null) {
        this.parent.state.startTransition();
        
        this.updateDimensions(dimensions);
        this.parent.nodes.update(data);
        this.parent.paths.update(data);
        this.parent.outer.update(data);
        
        this.parent.state.endTransition();
    }
}

/**
 * Node Management
 */
// NodeManager.js
class NodeManager {
    constructor(parent) {
        this.parent = parent;
        this.nodes = null;
        this.activeTransitions = new Set();
    }

    create() {
        this.nodes = this.createNodes();
        this.setupNodeEvents();
        this.setupHoverEffects();
    }

    update(data) {
        this.updateNodes(data);
        this.updateStates();
        this.updatePositions();
    }

    handleNodeClick(node) {
        const previousNode = this.parent.state.getSelectedNode();
        this.parent.state.updateState({ selectedNode: node });
        this.updateNodeStates(node, previousNode);
        this.parent.paths.updatePathStates(node);
        this.parent.outer.updateForSelection(node);
    }
}

/**
 * Path Management
 */
// PathManager.js
class PathManager {
    constructor(parent) {
        this.parent = parent;
        this.links = null;
    }

    updatePathStates(selectedNode) {
        this.links
            .transition()
            .duration(this.parent.config.animation.duration)
            .style("stroke", link => this.getPathStyle(link, selectedNode))
            .style("opacity", link => this.getPathOpacity(link, selectedNode))
            .style("stroke-dasharray", link => 
                this.isSiblingPath(link, selectedNode) ? "5,5" : null);
    }

    isActivePath(link, selectedNode) {
        // Comprehensive path relationship checking
    }

    isSiblingPath(link, selectedNode) {
        // Sibling path relationship checking
    }
}

/**
 * Outer Element Management
 */
// OuterElementManager.js
class OuterElementManager {
    constructor(parent) {
        this.parent = parent;
        this.indicators = null;
        this.labels = null;
    }

    create() {
        this.createIndicators();
        this.createLabels();
        this.setupInteractions();
    }

    updateForSelection(selectedNode) {
        this.updateIndicatorStates(selectedNode);
        this.updateLabelStates(selectedNode);
        this.updateAnimations(selectedNode);
    }

    calculateTextLayout(text, angle) {
        // Complex text positioning and wrapping logic
    }
}

/**
 * Display Management
 */
// DisplayManager.js
class DisplayManager {
    constructor(parent) {
        this.parent = parent;
        this.currentProfile = null;
    }

    calculateDimensions() {
        const rect = this.parent.container.getBoundingClientRect();
        const profile = this.getActiveProfile();
        
        return {
            width: this.calculateWidth(rect, profile),
            height: this.calculateHeight(rect, profile),
            radius: this.calculateRadius(rect, profile),
            text: this.calculateTextSizes(rect, profile),
            nodes: this.calculateNodeSizes(rect, profile)
        };
    }

    handleResize = debounce(() => {
        const dimensions = this.calculateDimensions();
        this.parent.viz.update(null, dimensions);
    }, 250);
}

/**
 * Settings Panel
 */
// SettingsPanel.js
class SettingsPanel {
    constructor(parent) {
        this.parent = parent;
        this.panel = null;
        this.isVisible = false;
    }

    create() {
        this.panel = this.createPanel();
        this.createControls();
        this.setupEventListeners();
    }

    applySettings(settings) {
        this.parent.state.updateState({ settings });
        this.parent.viz.update();
    }
}

/**
 * Performance Utilities
 */
// performance.js
const performance = {
    debounce,
    throttle,
    batchDOMUpdates: async (updates) => {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                updates();
                resolve();
            });
        });
    }
};