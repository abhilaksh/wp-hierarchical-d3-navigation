/**
 * Outer Element Manager
 * Handles creation, updating, and interaction of outer indicators and labels
 */

export class OuterElementManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.indicators = null;
        this.labels = null;
        this.activeTransitions = new Set();
    }

    /**
     * Creates outer elements
     * @returns {Promise<void>}
     */
    async create() {
        const data = this.parent.state.getData();
        if (!data) return;

        // Get depth-2 nodes
        const outerNodes = data.descendants().filter(d => d.depth === 2);

        // Create container for outer elements
        const outerGroup = this.parent.viz.zoomContainer
            .append('g')
            .attr('class', 'outer-elements');

        // Create indicators
        await this.createIndicators(outerGroup, outerNodes);

        // Create labels
        await this.createLabels(outerGroup, outerNodes);

        // Setup interactions
        this.setupInteractions();
    }

    /**
     * Creates indicator elements
     * @private
     */
    async createIndicators(container, nodes) {
        // Create indicator groups
        this.indicators = container.selectAll('g.indicator-group')
            .data(nodes)
            .join('g')
            .attr('class', 'indicator-group')
            .attr('transform', d => this.calculateIndicatorPosition(d));

        // Create inner indicators
        this.indicators.append('circle')
            .attr('class', 'outer-indicator')
            .attr('r', this.config.indicator.inner.radius)
            .attr('cx', 0)
            .attr('cy', 0);

        // Create indicator outlines
        this.indicators.append('circle')
            .attr('class', 'indicator-outline')
            .attr('r', this.config.indicator.outer.radius)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('fill', 'none')
            .style('opacity', 0);

        // Set initial styles
        this.indicators.select('.outer-indicator')
            .style('fill', this.config.colors.indicator.default);
    }

    /**
     * Creates label elements
     * @private
     */
    async createLabels(container, nodes) {
        // Create label containers
        this.labels = container.selectAll('foreignObject.outer-text-container')
            .data(nodes)
            .join('foreignObject')
            .attr('class', 'outer-text-container');

        // Calculate and set dimensions
        nodes.forEach((node, i) => {
            const labelData = this.calculateLabelLayout(node);
            
            // Update container position and size
            const label = this.labels.filter(d => d === node);
            label
                .attr('width', labelData.width)
                .attr('height', labelData.height)
                .attr('x', labelData.x)
                .attr('y', labelData.y)
                .html(d => this.createLabelContent(d, labelData));
        });
    }

    /**
     * Creates HTML content for labels
     * @private
     */
    createLabelContent(node, layout) {
        const fontSize = this.parent.display.lastDimensions.text.secondary;
        
        if (layout.type === 'single') {
            return `
                <div class="outer-text" style="
                    width: ${layout.width}px;
                    height: ${layout.height}px;
                    font-size: ${fontSize}px;
                    line-height: ${fontSize * 1.2}px;
                ">
                    <div class="line-clamp-1">${node.data.name}</div>
                </div>
            `;
        }

        return `
            <div class="outer-text" style="
                width: ${layout.width}px;
                height: ${layout.height}px;
                font-size: ${fontSize}px;
                line-height: ${fontSize * 1.2}px;
            ">
                <div class="line-clamp-1">${layout.firstLine}</div>
                <div class="line-clamp-1">${layout.secondLine}</div>
            </div>
        `;
    }

    /**
     * Calculates label layout
     * @private
     */
    calculateLabelLayout(node) {
        const text = node.data.name;
        const words = text.split(' ');
        const totalLength = text.length;
        const wordCount = words.length;

        // Determine layout type
        let layout = {
            type: 'single',
            text: text,
            width: this.config.text.spacing.base,
            height: this.config.text.sizes.large.secondary * 1.5
        };

        if (wordCount > 1 && (
            totalLength > this.config.text.thresholds.longText ||
            wordCount > 2
        )) {
            // Calculate split point
            let midpoint = Math.ceil(wordCount / 2);
            const firstHalf = words.slice(0, midpoint).join(' ');
            const secondHalf = words.slice(midpoint).join(' ');
            
            // Adjust split if first half is much longer
            if (firstHalf.length > secondHalf.length * 1.5) {
                midpoint -= 1;
            }

            layout = {
                type: 'double',
                firstLine: words.slice(0, midpoint).join(' '),
                secondLine: words.slice(midpoint).join(' '),
                width: this.config.text.spacing.base,
                height: this.config.text.sizes.large.secondary * 2.5
            };
        }

        // Calculate position
        const angle = node.x;
        const radius = node.y + this.config.indicator.outer.radius;
        const position = this.calculateTextPosition(angle, radius, layout);

        return {
            ...layout,
            ...position
        };
    }

    /**
     * Calculates text position
     * @private
     */
    calculateTextPosition(angle, radius, layout) {
        // Normalize angle
        let normalizedAngle = angle;
        while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
        while (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;
        
        // Calculate base position
        const textRadius = radius + this.config.text.spacing.base;
        let x = textRadius * Math.cos(angle);
        let y = textRadius * Math.sin(angle);
        
        // Adjust based on angle
        const sideProximity = Math.abs(Math.cos(angle));
        const dynamicSpacing = this.config.text.spacing.base + 
            (this.config.text.spacing.side * Math.pow(sideProximity, 1.5));
        
        // Center text
        x -= layout.width / 2;
        y -= layout.type === 'single' ? 
            layout.height / 4 : 
            layout.height / 2;
        
        return { x, y };
    }

    /**
     * Calculates indicator position
     * @private
     */
    calculateIndicatorPosition(node) {
        const angle = node.x;
        const radius = node.y;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        return `translate(${x},${y})`;
    }

    /**
     * Sets up interactions
     * @private
     */
    setupInteractions() {
        // Setup indicator interactions
        this.indicators
            .on('click', (event, d) => {
                event.stopPropagation();
                if (!this.parent.state.isTransitioning) {
                    this.handleElementClick(d);
                }
            })
            .on('mouseover', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleElementHover(d, true);
                }
            })
            .on('mouseout', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleElementHover(d, false);
                }
            });

        // Setup label interactions
        this.labels
            .on('click', (event, d) => {
                event.stopPropagation();
                if (!this.parent.state.isTransitioning) {
                    this.handleElementClick(d);
                }
            })
            .on('mouseover', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleElementHover(d, true);
                }
            })
            .on('mouseout', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleElementHover(d, false);
                }
            });
    }

    /**
     * Updates for selection changes
     * @param {Object} selectedNode - Currently selected node
     */
    updateForSelection(selectedNode) {
        // Update indicators
        this.updateIndicatorStates(selectedNode);
        
        // Update labels
        this.updateLabelStates(selectedNode);
        
        // Update animations
        this.updateAnimations(selectedNode);
    }

    /**
     * Updates indicator states
     * @private
     */
    updateIndicatorStates(selectedNode) {
        this.indicators.select('.outer-indicator')
            .classed('active', d => this.isActiveIndicator(d, selectedNode))
            .classed('pulse', d => this.shouldPulse(d, selectedNode))
            .transition()
            .duration(this.config.animation.duration)
            .style('fill', d => this.getIndicatorColor(d, selectedNode));
    }

    /**
     * Updates label states
     * @private
     */
    updateLabelStates(selectedNode) {
        this.labels
            .classed('active', d => this.isActiveLabel(d, selectedNode))
            .classed('faded', d => this.isFadedLabel(d, selectedNode))
            .transition()
            .duration(this.config.animation.duration)
            .style('opacity', d => this.getLabelOpacity(d, selectedNode));
    }

    /**
     * Updates animations
     * @private
     */
    updateAnimations(selectedNode) {
        this.indicators.select('.outer-indicator')
            .filter(d => this.shouldPulse(d, selectedNode))
            .each((d, i, nodes) => {
                const indicator = d3.select(nodes[i]);
                this.startPulseAnimation(indicator);
            });
    }

    /**
     * State calculation methods
     * @private
     */
    isActiveIndicator(node, selectedNode) {
        if (!selectedNode) return false;
        return node === selectedNode || 
               (selectedNode.depth === 1 && node.parent === selectedNode);
    }

    shouldPulse(node, selectedNode) {
        return node === selectedNode && selectedNode.depth === 2;
    }

    isActiveLabel(node, selectedNode) {
        return this.isActiveIndicator(node, selectedNode);
    }

    isFadedLabel(node, selectedNode) {
        if (!selectedNode || selectedNode.depth === 0) return false;
        if (selectedNode.depth === 1) return node.parent !== selectedNode;
        return node !== selectedNode && node.parent !== selectedNode.parent;
    }

    /**
     * Style calculation methods
     * @private
     */
    getIndicatorColor(node, selectedNode) {
        if (this.isActiveIndicator(node, selectedNode)) {
            return this.config.colors.indicator.active;
        }
        return this.config.colors.indicator.default;
    }

    getLabelOpacity(node, selectedNode) {
        if (this.isFadedLabel(node, selectedNode)) return 0.5;
        return 1;
    }

    /**
     * Animation methods
     * @private
     */
    startPulseAnimation(indicator) {
        indicator
            .transition()
            .duration(1000)
            .attr('r', this.config.indicator.inner.radius * 
                this.config.indicator.inner.activeScale)
            .transition()
            .duration(1000)
            .attr('r', this.config.indicator.inner.radius)
            .on('end', () => {
                if (indicator.classed('pulse')) {
                    this.startPulseAnimation(indicator);
                }
            });
    }

    /**
     * Event handlers
     * @private
     */
    handleElementClick(node) {
        const event = new CustomEvent('node:click', {
            detail: { node },
            bubbles: true
        });
        this.parent.container.dispatchEvent(event);
    }

    handleElementHover(node, isEnter) {
        const indicator = this.indicators
            .filter(d => d === node)
            .select('.outer-indicator');
            
        const label = this.labels
            .filter(d => d === node);

        if (isEnter) {
            indicator
                .transition()
                .duration(200)
                .attr('r', this.config.indicator.inner.radius * 1.2);
                
            label
                .transition()
                .duration(200)
                .style('transform', 'scale(1.1)');
        } else {
            indicator
                .transition()
                .duration(200)
                .attr('r', this.config.indicator.inner.radius);
                
            label
                .transition()
                .duration(200)
                .style('transform', 'scale(1)');
        }
    }

    /**
     * Updates with new data
     * @param {Object} data - New data
     */
    update(data) {
        if (!data) return;

        const outerNodes = data.descendants().filter(d => d.depth === 2);

        // Update indicators
        this.updateIndicators(outerNodes);

        // Update labels
        this.updateLabels(outerNodes);

        // Update selection state if needed
        const selectedNode = this.parent.state.getSelectedNode();
        if (selectedNode) {
            this.updateForSelection(selectedNode);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.indicators) {
            this.indicators.remove();
        }
        if (this.labels) {
            this.labels.remove();
        }
        this.indicators = null;
        this.labels = null;
        this.activeTransitions.clear();
    }
}