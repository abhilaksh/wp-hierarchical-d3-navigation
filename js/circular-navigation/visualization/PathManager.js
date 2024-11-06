/**
 * Path Manager
 * Handles creation, updating, and styling of all paths/links between nodes
 */

export class PathManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.links = null;
        this.activeTransitions = new Set();
    }

    /**
     * Creates initial paths
     * @returns {Promise<void>}
     */
    async create() {
        const data = this.parent.state.getData();
        if (!data) return;

        // Create link groups
        this.links = this.parent.viz.zoomContainer
            .append('g')
            .attr('class', 'links')
            .selectAll('path.link')
            .data(data.links())
            .join('path')
            .attr('class', d => `link depth-${d.source.depth}-${d.target.depth}`)
            .attr('d', d => this.generateLinkPath(d))
            .style('fill', 'none')
            .style('stroke', this.config.colors.path.default)
            .style('stroke-width', this.config.node.linkWidth)
            .style('opacity', d => this.getInitialOpacity(d));
    }

    /**
     * Generates SVG path for a link
     * @private
     */
    generateLinkPath(d) {
        if (d.source.depth === 0) {
            // Straight line from center
            const start = [0, 0];
            const end = this.calculateEndPoint(d.target);
            return `M${start[0]},${start[1]}L${end[0]},${end[1]}`;
        } else {
            // Curved path between nodes
            const sourcePoint = this.calculateEndPoint(d.source);
            const targetPoint = this.calculateEndPoint(d.target);
            const midX = (sourcePoint[0] + targetPoint[0]) / 2;
            const midY = (sourcePoint[1] + targetPoint[1]) / 2;
            
            // Add curve based on depth
            const curveFactor = d.target.depth === 2 ? 0.2 : 0.1;
            const dx = targetPoint[0] - sourcePoint[0];
            const dy = targetPoint[1] - sourcePoint[1];
            const curve = Math.sqrt(dx * dx + dy * dy) * curveFactor;
            
            return `M${sourcePoint[0]},${sourcePoint[1]}
                    Q${midX},${midY} ${targetPoint[0]},${targetPoint[1]}`;
        }
    }

    /**
     * Calculates endpoint for a link
     * @private
     */
    calculateEndPoint(node) {
        const angle = node.x - Math.PI / 2;
        const radius = node.y;
        return [
            radius * Math.cos(angle),
            radius * Math.sin(angle)
        ];
    }

    /**
     * Gets initial opacity for a link
     * @private
     */
    getInitialOpacity(link) {
        if (link.source.depth === 0) return 1;
        if (link.source.depth === 1 && link.target.depth === 2) return 0;
        return 1;
    }

    /**
     * Updates path states based on selection
     * @param {Object} selectedNode - Currently selected node
     */
    updatePathStates(selectedNode) {
        const transition = this.links
            .transition()
            .duration(this.config.animation.duration)
            .style('stroke', d => this.getPathColor(d, selectedNode))
            .style('stroke-width', d => this.getPathWidth(d, selectedNode))
            .style('opacity', d => this.getPathOpacity(d, selectedNode))
            .style('stroke-dasharray', d => 
                this.isSiblingPath(d, selectedNode) ? '5,5' : null
            );

        // Track transition
        this.parent.viz.trackTransition(transition);
    }

    /**
     * State calculation methods
     * @private
     */
    isActivePath(link, selectedNode) {
        if (!link || !selectedNode) return false;
        
        if (selectedNode.depth === 0) return true;
        
        if (selectedNode.depth === 1) {
            return (selectedNode.parent && link.source === selectedNode.parent && 
                    link.target === selectedNode) ||
                   (link.source === selectedNode);
        }
        
        if (selectedNode.depth === 2) {
            return (link.target === selectedNode) || 
                   (selectedNode.parent && link.source === selectedNode.parent) ||
                   (selectedNode.parent?.parent && 
                    link.source === selectedNode.parent.parent && 
                    link.target === selectedNode.parent);
        }
        
        return false;
    }

    isSiblingPath(link, selectedNode) {
        if (!link || !selectedNode) return false;
        
        if (selectedNode.depth === 1) {
            return (selectedNode.parent && 
                    link.source === selectedNode.parent && 
                    link.target !== selectedNode);
        }
        
        if (selectedNode.depth === 2) {
            return (selectedNode.parent && 
                    link.source === selectedNode.parent && 
                    link.target !== selectedNode) ||
                   (selectedNode.parent?.parent && 
                    link.source !== selectedNode.parent.parent && 
                    link.target.depth === 2 && 
                    link.target !== selectedNode);
        }
        
        return false;
    }

    /**
     * Style calculation methods
     * @private
     */
    getPathColor(link, selectedNode) {
        if (this.isActivePath(link, selectedNode)) {
            return this.config.colors.path.active;
        }
        if (this.isSiblingPath(link, selectedNode)) {
            return this.config.colors.path.inactive;
        }
        return this.config.colors.path.default;
    }

    getPathWidth(link, selectedNode) {
        return this.isActivePath(link, selectedNode) ? 
            this.config.node.linkWidth * 1.5 : 
            this.config.node.linkWidth;
    }

    getPathOpacity(link, selectedNode) {
        // Handle level-2 links visibility
        if (link.source.depth === 1 && link.target.depth === 2) {
            if (selectedNode?.depth === 0) return 1;
            if (selectedNode?.depth === 1) {
                return link.source === selectedNode ? 1 : 0;
            }
            if (selectedNode?.depth === 2 && selectedNode.parent) {
                return link.source === selectedNode.parent ? 1 : 0;
            }
            return 0;
        }
        return 1;
    }

    /**
     * Updates paths with new data
     * @param {Object} data - New data
     */
    update(data) {
        if (!data) return;

        // Update data binding
        this.links = this.parent.viz.zoomContainer
            .select('g.links')
            .selectAll('path.link')
            .data(data.links());

        // Handle enter/exit
        const enterLinks = this.links.enter()
            .append('path')
            .attr('class', d => `link depth-${d.source.depth}-${d.target.depth}`)
            .attr('d', d => this.generateLinkPath(d))
            .style('opacity', 0);

        // Remove old links
        this.links.exit()
            .transition()
            .duration(this.config.animation.duration / 2)
            .style('opacity', 0)
            .remove();

        // Merge and update all links
        this.links = enterLinks.merge(this.links)
            .transition()
            .duration(this.config.animation.duration)
            .attr('d', d => this.generateLinkPath(d))
            .style('opacity', 1);

        // Update states if there's a selected node
        const selectedNode = this.parent.state.getSelectedNode();
        if (selectedNode) {
            this.updatePathStates(selectedNode);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.links) {
            this.links.remove();
        }
        this.links = null;
        this.activeTransitions.clear();
    }
}