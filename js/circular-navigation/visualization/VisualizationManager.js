/**
 * Visualization Manager
 * Coordinates all D3-based visualization components
 */

import { performance } from '../utils/performance';
import { processHierarchicalData } from '../utils/calculations';

export class VisualizationManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.container = parent.container;
        
        // D3 selections
        this.svg = null;
        this.zoomContainer = null;
        
        // Track active transitions
        this.activeTransitions = new Set();
        this.isTransitioning = false;
    }

    /**
     * Creates the initial visualization
     * @returns {Promise<void>}
     */
    async create() {
        try {
            // Create SVG structure
            this.createSVG();
            
            // Initialize sub-components
            await Promise.all([
                this.parent.nodes.create(),
                this.parent.paths.create(),
                this.parent.outer.create()
            ]);

            // Setup zoom
            this.parent.zoom.init(this.svg, this.zoomContainer);

        } catch (error) {
            console.error('Visualization creation error:', error);
            throw error;
        }
    }

    /**
     * Creates the base SVG structure
     * @private
     */
    createSVG() {
        // Remove any existing SVG
        if (this.svg) {
            this.svg.remove();
        }

        // Create new SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', `${this.parent.id}-svg`)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Add zoom container
        this.zoomContainer = this.svg
            .append('g')
            .attr('class', 'zoom-container');

        // Add initial viewBox
        this.updateViewBox(this.parent.display.calculateDimensions());

        // Add ARIA attributes
        this.svg
            .attr('role', 'img')
            .attr('aria-label', 'Circular navigation visualization');
    }

    /**
     * Updates the visualization
     * @param {Object} [data] - New data
     * @param {Object} [dimensions] - New dimensions
     * @returns {Promise<void>}
     */
    async update(data = null, dimensions = null) {
        // Cancel any active transitions
        this.cancelTransitions();

        try {
            // Start transition state
            this.isTransitioning = true;

            // Process new data if provided
            if (data) {
                data = processHierarchicalData(data);
                await this.parent.state.updateState({ data });
            }

            // Update dimensions if provided
            if (dimensions) {
                this.updateViewBox(dimensions);
            }

            // Batch updates using requestAnimationFrame
            await performance.batchDOMUpdates(async () => {
                // Update components in parallel
                await Promise.all([
                    this.parent.nodes.update(data),
                    this.parent.paths.update(data),
                    this.parent.outer.update(data)
                ]);
            });

        } catch (error) {
            console.error('Visualization update error:', error);
            throw error;
        } finally {
            // End transition state
            this.isTransitioning = false;
        }
    }

    /**
     * Updates SVG viewBox
     * @private
     */
    updateViewBox(dimensions) {
        const { width, height } = dimensions;
        
        this.svg
            .transition()
            .duration(this.config.animation.duration)
            .attr('viewBox', [
                -width / 2,
                -height / 2,
                width,
                height
            ]);
    }

    /**
     * Updates selection state
     * @param {Object} newNode - Newly selected node
     * @param {Object} oldNode - Previously selected node
     */
    async updateSelection(newNode, oldNode) {
        // Cancel existing transitions
        this.cancelTransitions();

        try {
            // Start transition
            this.isTransitioning = true;

            // Batch updates
            await performance.batchDOMUpdates(async () => {
                // Update components in sequence
                await this.parent.paths.updatePathStates(newNode);
                await this.parent.nodes.updateNodeStates(newNode);
                await this.parent.outer.updateForSelection(newNode);

                // Handle zoom if needed
                if (newNode) {
                    await this.parent.zoom.zoomToNode(newNode);
                }
            });

        } catch (error) {
            console.error('Selection update error:', error);
            throw error;
        } finally {
            // End transition
            this.isTransitioning = false;
        }
    }

    /**
     * Cancels active transitions
     * @private
     */
    cancelTransitions() {
        this.activeTransitions.forEach(transition => {
            if (transition.selection) {
                transition.selection.interrupt();
            }
        });
        this.activeTransitions.clear();
    }

    /**
     * Adds a transition to tracking
     * @param {d3.Transition} transition - D3 transition
     */
    trackTransition(transition) {
        this.activeTransitions.add(transition);
        transition.on('end', () => {
            this.activeTransitions.delete(transition);
        });
    }

    /**
     * Cleanup visualization
     */
    destroy() {
        // Cancel transitions
        this.cancelTransitions();

        // Remove SVG
        if (this.svg) {
            this.svg.remove();
        }

        // Clear references
        this.svg = null;
        this.zoomContainer = null;
        this.activeTransitions.clear();
    }
}