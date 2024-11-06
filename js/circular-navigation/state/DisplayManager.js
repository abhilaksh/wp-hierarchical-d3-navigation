/**
 * Display Manager
 * Handles dimensions, responsive behavior, and profile management
 */

import { performance } from '../utils/performance';
import { calculateTextWidth } from '../utils/calculations';

export class DisplayManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.currentProfile = null;
        this.lastDimensions = null;
        
        // Bind methods
        this.handleResize = performance.debounce(
            this.handleResize.bind(this),
            this.config.performance.debounceDelay
        );
    }

    /**
     * Setup display manager
     */
    setup() {
        this.currentProfile = this.getActiveProfile();
        this.lastDimensions = this.calculateDimensions();
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * Calculate current dimensions
     * @returns {Object} Dimension calculations
     */
    calculateDimensions() {
        const rect = this.parent.container.getBoundingClientRect();
        const profile = this.getActiveProfile();
        
        // Calculate base dimensions
        const dimensions = {
            width: this.calculateWidth(rect, profile),
            height: this.calculateHeight(rect, profile),
            radius: this.calculateRadius(rect, profile),
            text: this.calculateTextSizes(rect, profile),
            nodes: this.calculateNodeSizes(rect, profile),
            indicators: this.calculateIndicatorSizes(rect, profile)
        };

        // Store for comparison
        this.lastDimensions = dimensions;
        return dimensions;
    }

    /**
     * Get active profile based on current size
     * @returns {Object} Active profile
     */
    getActiveProfile() {
        const width = window.innerWidth;
        const { small, medium } = this.config.dimensions.breakpoints;

        if (width < small) return this.config.profiles.mobile;
        if (width < medium) return this.config.profiles.tablet;
        return this.config.profiles.desktop;
    }

    /**
     * Calculate container width
     * @private
     */
    calculateWidth(rect, profile) {
        const { min } = this.config.dimensions;
        const containerWidth = Math.max(rect.width, min.width);
        const maxWidth = window.innerWidth * 0.9;
        return Math.min(containerWidth, maxWidth);
    }

    /**
     * Calculate container height
     * @private
     */
    calculateHeight(rect, profile) {
        const { min } = this.config.dimensions;
        const containerHeight = Math.max(rect.height, min.height);
        const maxHeight = window.innerHeight * 0.7;
        return Math.min(containerHeight, maxHeight);
    }

    /**
     * Calculate visualization radius
     * @private
     */
    calculateRadius(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        const baseRadius = minDimension * 0.35; // 35% of smallest dimension
        
        return Math.max(
            this.config.node.central.minSize * 1.5,
            Math.min(baseRadius, rect.width * 0.4)
        );
    }

    /**
     * Calculate text sizes
     * @private
     */
    calculateTextSizes(rect, profile) {
        const width = rect.width;
        const { small, large } = this.config.dimensions.breakpoints;
        
        // Fluid typography calculation
        const calculateFluidSize = (minSize, maxSize) => {
            const slope = (maxSize - minSize) / (large - small);
            const size = minSize + (slope * (width - small));
            return Math.min(maxSize, Math.max(minSize, size));
        };

        return {
            central: calculateFluidSize(
                profile.textSizes.central,
                this.config.text.sizes.large.central
            ),
            primary: calculateFluidSize(
                profile.textSizes.primary,
                this.config.text.sizes.large.primary
            ),
            secondary: calculateFluidSize(
                profile.textSizes.secondary,
                this.config.text.sizes.large.secondary
            )
        };
    }

    /**
     * Calculate node sizes
     * @private
     */
    calculateNodeSizes(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        
        return {
            central: {
                width: Math.max(
                    profile.nodeSizes.central,
                    minDimension * 0.15
                ),
                height: Math.max(
                    profile.nodeSizes.central,
                    minDimension * 0.15
                )
            },
            primary: {
                width: Math.max(
                    profile.nodeSizes.primary.width,
                    minDimension * 0.1
                ),
                height: Math.max(
                    profile.nodeSizes.primary.height,
                    minDimension * 0.08
                )
            },
            secondary: {
                width: Math.max(
                    profile.nodeSizes.secondary.width,
                    minDimension * 0.08
                ),
                height: Math.max(
                    profile.nodeSizes.secondary.height,
                    minDimension * 0.06
                )
            }
        };
    }

    /**
     * Calculate indicator sizes
     * @private
     */
    calculateIndicatorSizes(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        
        return {
            inner: Math.max(
                this.config.indicator.inner.radius,
                minDimension * 0.01
            ),
            outer: Math.max(
                this.config.indicator.outer.radius,
                minDimension * 0.015
            )
        };
    }

    /**
     * Calculate text dimensions for specific content
     * @param {string} text - Text content
     * @param {string} type - Node type (central, primary, secondary)
     * @returns {Object} Text dimensions
     */
    calculateTextDimensions(text, type) {
        const fontSize = this.lastDimensions.text[type];
        return {
            width: calculateTextWidth(text, fontSize),
            height: fontSize * 1.2 // Approximate line height
        };
    }

    /**
     * Handle resize events
     * @private
     */
    handleResize() {
        const newProfile = this.getActiveProfile();
        const newDimensions = this.calculateDimensions();
        
        // Check for significant changes
        if (this.hasSignificantChanges(newDimensions)) {
            this.currentProfile = newProfile;
            this.parent.viz.update(null, newDimensions);
        }
    }

    /**
     * Check if dimensions changed significantly
     * @private
     */
    hasSignificantChanges(newDims) {
        if (!this.lastDimensions) return true;

        const threshold = 0.01; // 1% change threshold
        
        return (
            Math.abs(newDims.width - this.lastDimensions.width) > this.lastDimensions.width * threshold ||
            Math.abs(newDims.height - this.lastDimensions.height) > this.lastDimensions.height * threshold
        );
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        this.lastDimensions = null;
        this.currentProfile = null;
    }
}