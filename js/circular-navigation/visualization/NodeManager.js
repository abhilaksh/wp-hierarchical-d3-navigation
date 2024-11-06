/**
 * Node Manager
 * Handles creation, updating, and interaction of all nodes
 */

export class NodeManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.nodes = null;
        this.activeTransitions = new Set();
    }

    /**
     * Creates initial nodes
     * @returns {Promise<void>}
     */
    async create() {
        const data = this.parent.state.getData();
        if (!data) return;

        // Create node groups
        this.nodes = this.parent.viz.zoomContainer
            .selectAll('g.node')
            .data(data.descendants().filter(d => d.depth < 2))
            .join('g')
            .attr('class', d => `node depth-${d.depth}-node`);

        // Create foreignObjects for content
        this.createNodeContent();
        
        // Setup interactions
        this.setupNodeInteractions();

        // Initial positioning
        this.updateNodePositions();
    }

    /**
     * Creates node content using foreignObject
     * @private
     */
    createNodeContent() {
        // Create foreignObject containers
        const foreignObjects = this.nodes
            .append('foreignObject')
            .attr('class', d => `node-foreignObject ${d.depth === 0 ? 'central-node' : ''}`);

        // Create content divs
        foreignObjects
            .append('xhtml:div')
            .attr('class', d => `node-content ${d.depth === 0 ? 'central' : ''}`)
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('text-align', 'center')
            .style('box-sizing', 'border-box')
            .text(d => d.data.name);

        // Set initial sizes
        this.updateNodeSizes();
    }

    /**
     * Sets up node interactions
     * @private
     */
    setupNodeInteractions() {
        this.nodes
            // Click handling
            .on('click', (event, d) => {
                event.stopPropagation();
                if (!this.parent.state.isTransitioning) {
                    this.handleNodeClick(d);
                }
            })
            // Hover effects
            .on('mouseover', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleNodeHover(d, true);
                }
            })
            .on('mouseout', (event, d) => {
                if (!this.parent.state.isTransitioning) {
                    this.handleNodeHover(d, false);
                }
            })
            // Keyboard navigation
            .attr('tabindex', 0)
            .on('keydown', (event, d) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleNodeClick(d);
                }
            });
    }

    /**
     * Updates node states based on selection
     * @param {Object} selectedNode - Currently selected node
     */
    updateNodeStates(selectedNode) {
        this.nodes
            .classed('active', n => this.isActiveNode(n, selectedNode))
            .classed('sibling', n => this.isSiblingNode(n, selectedNode));

        // Update node content styles
        this.nodes.select('.node-content')
            .transition()
            .duration(this.config.animation.duration)
            .style('background-color', n => this.getNodeColor(n, selectedNode))
            .style('color', n => this.getNodeTextColor(n, selectedNode))
            .style('border-color', n => this.getNodeBorderColor(n, selectedNode));
    }

    /**
     * State calculation methods
     * @private
     */
    isActiveNode(node, selectedNode) {
        if (!selectedNode) return node.depth === 0;
        return node === selectedNode ||
               (selectedNode.parent && node === selectedNode.parent) ||
               (node.depth === 0 && selectedNode);
    }

    isSiblingNode(node, selectedNode) {
        if (!selectedNode || node.depth === 0) return false;
        return node.parent === selectedNode.parent && node !== selectedNode;
    }

    /**
     * Style calculation methods
     * @private
     */
    getNodeColor(node, selectedNode) {
        if (node.depth === 0) return this.config.colors.node.central;
        if (this.isActiveNode(node, selectedNode)) return this.config.colors.node.active;
        if (this.isSiblingNode(node, selectedNode)) return this.config.colors.node.default;
        return this.config.colors.node.default;
    }

    getNodeTextColor(node, selectedNode) {
        if (node.depth === 0) return this.config.colors.text.active;
        if (this.isActiveNode(node, selectedNode)) return this.config.colors.text.active;
        return this.config.colors.text.default;
    }

    getNodeBorderColor(node, selectedNode) {
        if (node.depth === 0) return 'none';
        if (this.isActiveNode(node, selectedNode)) return this.config.colors.node.active;
        if (this.isSiblingNode(node, selectedNode)) return this.config.colors.node.default;
        return this.config.colors.node.default;
    }

    /**
     * Updates node dimensions and positions
     * @param {Object} dimensions - Current dimensions
     */
    updateNodeSizes(dimensions = null) {
        if (!dimensions) {
            dimensions = this.parent.display.calculateDimensions();
        }

        this.nodes.each((d, i, nodes) => {
            const node = d3.select(nodes[i]);
            const fo = node.select('foreignObject');
            const div = fo.select('div');
            
            if (d.depth === 0) {
                // Central node
                const size = dimensions.nodes.central.width;
                fo.attr('width', size)
                  .attr('height', size)
                  .attr('x', -size / 2)
                  .attr('y', -size / 2);
                  
                div.style('width', `${size}px`)
                   .style('height', `${size}px`)
                   .style('font-size', `${dimensions.text.central}px`);
            } else {
                // Other nodes
                const nodeSize = d.depth === 1 ? 
                    dimensions.nodes.primary : 
                    dimensions.nodes.secondary;
                    
                fo.attr('width', nodeSize.width)
                  .attr('height', nodeSize.height)
                  .attr('x', -nodeSize.width / 2)
                  .attr('y', -nodeSize.height / 2);
                  
                div.style('width', `${nodeSize.width}px`)
                   .style('height', `${nodeSize.height}px`)
                   .style('font-size', `${
                       d.depth === 1 ? dimensions.text.primary : dimensions.text.secondary
                   }px`);
            }
        });
    }

    /**
     * Updates node positions
     */
    updateNodePositions() {
        this.nodes
            .transition()
            .duration(this.config.animation.duration)
            .attr('transform', d => {
                if (d.depth === 0) return 'translate(0,0)';
                const [x, y] = this.calculateNodePosition(d);
                return `translate(${x},${y})`;
            });
    }

    /**
     * Calculates node position
     * @private
     */
    calculateNodePosition(node) {
        if (node.depth === 0) return [0, 0];
        
        const angle = node.x - Math.PI / 2;
        const radius = node.y;
        
        return [
            radius * Math.cos(angle),
            radius * Math.sin(angle)
        ];
    }

    /**
     * Handles node click events
     * @private
     */
    handleNodeClick(node) {
        const event = new CustomEvent('node:click', {
            detail: { node },
            bubbles: true
        });
        this.parent.container.dispatchEvent(event);
    }

    /**
     * Handles node hover events
     * @private
     */
    handleNodeHover(node, isEnter) {
        if (isEnter) {
            // Scale up
            this.nodes
                .filter(d => d === node)
                .transition()
                .duration(200)
                .attr('transform', d => {
                    const [x, y] = this.calculateNodePosition(d);
                    return `translate(${x},${y}) scale(1.1)`;
                });
        } else {
            // Scale back
            this.nodes
                .filter(d => d === node)
                .transition()
                .duration(200)
                .attr('transform', d => {
                    const [x, y] = this.calculateNodePosition(d);
                    return `translate(${x},${y}) scale(1)`;
                });
        }
    }

    /**
     * Updates nodes with new data
     * @param {Object} data - New data
     */
    update(data) {
        if (!data) return;

        // Update data binding
        this.nodes = this.parent.viz.zoomContainer
            .selectAll('g.node')
            .data(data.descendants().filter(d => d.depth < 2), d => d.data.id);

        // Handle enter/exit
        const nodeEnter = this.nodes.enter()
            .append('g')
            .attr('class', d => `node depth-${d.depth}-node`);

        // Create content for new nodes
        nodeEnter.each((d, i, nodes) => {
            const node = d3.select(nodes[i]);
            this.createNodeContent.call(this, node);
        });

        // Setup interactions for new nodes
        nodeEnter.each((d, i, nodes) => {
            const node = d3.select(nodes[i]);
            this.setupNodeInteractions.call(this, node);
        });

        // Remove old nodes
        this.nodes.exit().remove();

        // Update all nodes
        this.nodes = nodeEnter.merge(this.nodes);

        // Update positions and sizes
        this.updateNodeSizes();
        this.updateNodePositions();
    }

    /**
     * Cleanup
     */
    destroy() {
        // Remove nodes
        if (this.nodes) {
            this.nodes.remove();
        }

        // Clear references
        this.nodes = null;
        this.activeTransitions.clear();
    }
}