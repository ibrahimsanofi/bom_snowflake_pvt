/**
  * This module handles specialized needs for pivot tables including:
 * - Enhanced column hierarchy handling 
 * - Special case visualization models
 */

const pivotTableHandler = {
    /**
     * Render hierarchical column headers recursively
     * This function ensures consistent hierarchy behavior between row and column zones
     * @param {Object} node - The hierarchy node to render
     * @param {Array} headers - Array to collect header cells
     * @param {Number} level - Current level in hierarchy
     * @param {Number} colspan - Colspan attribute value
     * @param {String} dimensionName - Name of the dimension (e.g., 'time')
     */
    renderHierarchicalColumnHeaders: function(node, headers, level, colspan, dimensionName) {
        if (!node) return;
        
        // Create header cell
        const th = document.createElement('th');
        th.className = 'hierarchy-cell';
        th.setAttribute('data-node-id', node.id);
        th.setAttribute('data-dimension', dimensionName);
        th.setAttribute('data-level', level);
        
        if (colspan > 1) {
            th.setAttribute('colspan', colspan);
        }
        
        // Create span for label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'dimension-label';
        labelSpan.textContent = node.label;
        
        // Add expand/collapse controls if the node has children
        if (node.children && node.children.length > 0) {
            const expandCollapseEl = document.createElement('span');
            expandCollapseEl.className = `expand-collapse ${node.expanded ? 'expanded' : 'collapsed'}`;
            expandCollapseEl.setAttribute('data-node-id', node.id);
            expandCollapseEl.setAttribute('data-hierarchy', dimensionName);
            expandCollapseEl.setAttribute('data-zone', 'column');
            
            // Add click handler
            expandCollapseEl.addEventListener('click', function(e) {
                e.stopPropagation();
                const nodeId = this.getAttribute('data-node-id');
                const dimension = this.getAttribute('data-hierarchy');
                
                // Toggle node expansion
                if (window.handleExpandCollapseClick) {
                    // Create a synthetic event with the needed attributes
                    const syntheticEvent = { 
                        target: this,
                        stopPropagation: () => {}
                    };
                    window.handleExpandCollapseClick(syntheticEvent);
                }
            });
            
            th.appendChild(expandCollapseEl);
        } else {
            // Add spacer for leaf nodes to maintain alignment
            const leafSpacerEl = document.createElement('span');
            leafSpacerEl.className = 'leaf-node';
            th.appendChild(leafSpacerEl);
        }
        
        // Add label
        th.appendChild(labelSpan);
        
        // Add to headers array
        headers.push(th);
        
        // Process children recursively if expanded
        if (node.expanded && node.children && node.children.length > 0) {
            // Process all children
            node.children.forEach(child => {
                // Calculate colspan for each child recursively
                let childColspan = 1;
                if (child.children && child.children.length > 0 && child.expanded) {
                    childColspan = this.countLeafNodes(child);
                }
                
                this.renderHierarchicalColumnHeaders(child, headers, level + 1, childColspan, dimensionName);
            });
        }
    },

    /**
     * Count leaf nodes under a given node
     * @param {Object} node - The hierarchy node
     * @returns {Number} - Number of leaf nodes
     */
    countLeafNodes: function(node) {
        if (!node) return 0;
        
        // If it's a leaf or has no children, count as 1
        if (node.isLeaf || !node.children || node.children.length === 0) {
            return 1;
        }
        
        // If node is collapsed, count as 1
        if (!node.expanded) {
            return 1;
        }
        
        // Recursively count leaves in children
        let count = 0;
        node.children.forEach(child => {
            count += this.countLeafNodes(child);
        });
        
        return count;
    },

    /**
     * Create column headers with separate rows for each level of the hierarchy
     * @param {Object} rootNode - The root node of the hierarchy
     * @param {String} dimensionName - Name of the dimension
     * @returns {Array} - Array of header rows as DOM elements
     */
    createColumnHeaderRows: function(rootNode, dimensionName) {
        if (!rootNode) return [];
        
        // Determine the maximum depth of the expanded hierarchy
        const maxDepth = this.getMaxExpandedDepth(rootNode);
        
        // Create header rows for each level
        const headerRows = [];
        for (let i = 0; i < maxDepth; i++) {
            const tr = document.createElement('tr');
            tr.className = 'column-header-row';
            tr.setAttribute('data-level', i);
            headerRows.push(tr);
        }
        
        // Add an empty cell for the top-left corner in each row
        headerRows.forEach(row => {
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            row.appendChild(cornerCell);
        });
        
        // Process each top-level child of the root node
        rootNode.children.forEach(topNode => {
            // Calculate colspan for each top node
            let colspan = 1;
            if (topNode.children && topNode.children.length > 0 && topNode.expanded) {
                colspan = this.countLeafNodes(topNode);
            }
            
            // Create header structure
            this.processColumnHeaderNode(topNode, headerRows, 0, colspan, dimensionName, maxDepth);
        });
        
        return headerRows;
    },

    /**
     * Process a node for column headers
     * @param {Object} node - Current node
     * @param {Array} headerRows - Array of header row elements
     * @param {Number} level - Current hierarchy level
     * @param {Number} colspan - Colspan value
     * @param {String} dimensionName - Dimension name
     * @param {Number} maxDepth - Maximum depth of the hierarchy
     */
    processColumnHeaderNode: function(node, headerRows, level, colspan, dimensionName, maxDepth) {
        if (!node) return;
        
        // Create header cell
        const th = document.createElement('th');
        th.className = 'hierarchy-cell';
        th.setAttribute('data-node-id', node.id);
        th.setAttribute('data-dimension', dimensionName);
        th.setAttribute('data-level', level);
        
        if (colspan > 1) {
            th.setAttribute('colspan', colspan);
        }
        
        // Calculate rowspan if this cell needs to extend down
        let rowspan = 1;
        if (!node.expanded || !node.children || node.children.length === 0) {
            rowspan = maxDepth - level;
        }
        
        if (rowspan > 1) {
            th.setAttribute('rowspan', rowspan);
        }
        
        // Create expand/collapse control
        if (node.children && node.children.length > 0) {
            const expandCollapseEl = document.createElement('span');
            expandCollapseEl.className = `expand-collapse ${node.expanded ? 'expanded' : 'collapsed'}`;
            expandCollapseEl.setAttribute('data-node-id', node.id);
            expandCollapseEl.setAttribute('data-hierarchy', dimensionName);
            expandCollapseEl.setAttribute('data-zone', 'column');
            
            // Add click handler
            expandCollapseEl.addEventListener('click', function(e) {
                e.stopPropagation();
                const nodeId = this.getAttribute('data-node-id');
                const dimension = this.getAttribute('data-hierarchy');
                
                // Create a synthetic event for the click handler
                const syntheticEvent = { 
                    target: this,
                    stopPropagation: () => {}
                };
                
                // Use global handler if available
                if (window.handleExpandCollapseClick) {
                    window.handleExpandCollapseClick(syntheticEvent);
                }
            });
            
            th.appendChild(expandCollapseEl);
        } else {
            // Add spacer for leaf nodes
            const leafSpacerEl = document.createElement('span');
            leafSpacerEl.className = 'leaf-node';
            th.appendChild(leafSpacerEl);
        }
        
        // Add label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'dimension-label';
        labelSpan.textContent = node.label;
        th.appendChild(labelSpan);
        
        // Add to the appropriate header row
        headerRows[level].appendChild(th);
        
        // Process children if expanded
        if (node.expanded && node.children && node.children.length > 0) {
            node.children.forEach(child => {
                // Calculate colspan for each child
                let childColspan = 1;
                if (child.children && child.children.length > 0 && child.expanded) {
                    childColspan = this.countLeafNodes(child);
                }
                
                this.processColumnHeaderNode(child, headerRows, level + 1, childColspan, dimensionName, maxDepth);
            });
        }
    },

    /**
     * Get maximum depth of expanded nodes in hierarchy
     * @param {Object} node - Current node
     * @param {Number} currentLevel - Current level
     * @returns {Number} - Maximum depth
     */
    getMaxExpandedDepth: function(node, currentLevel = 0) {
        if (!node) return currentLevel;
        
        // If node is a leaf or is collapsed, return current level
        if (node.isLeaf || !node.expanded || !node.children || node.children.length === 0) {
            return currentLevel + 1;
        }
        
        // Get max depth from all children
        let maxChildDepth = currentLevel + 1;
        node.children.forEach(child => {
            const childDepth = this.getMaxExpandedDepth(child, currentLevel + 1);
            maxChildDepth = Math.max(maxChildDepth, childDepth);
        });
        
        return maxChildDepth;
    },
    
    
    /**
     * Check if a node is expanded
     */
    isNodeExpanded: function(node) {
        if (!node) return true; // Default to expanded
        return node.expanded !== false; // Treat undefined as expanded
    },
        
    
    /**
     * Render a basic row cell with indentation and expand/collapse controls
     * Used as a fallback when pivotTable.renderRowCell is not available
     */
    renderBasicRowCell: function(rowDef) {
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0; // 20px per level
        
        let cellHtml = `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
        
        if (rowDef.hasChildren) {
            const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${rowDef._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse this item"></span>`;
        } else {
            cellHtml += `<span class="leaf-node"></span>`;
        }
        
        cellHtml += `<span class="dimension-label">${rowDef.label || rowDef._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },
    
    /**
     * Render a basic value cell
     * Used as a fallback when pivotTable.renderValueCell is not available
     */
    renderBasicValueCell: function(value, additionalClass = '') {
        // Force number conversion
        let numericValue = parseFloat(value) || 0;
        
        // Determine cell class
        let cellClass = 'value-cell';
        if (additionalClass) cellClass += ' ' + additionalClass;
        
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
        } else {
            cellClass += ' zero-value';
        }
        
        // Format value
        let formattedValue;
        if (numericValue === 0) {
            formattedValue = '0.00';
        } else if (Math.abs(numericValue) >= 1000000) {
            formattedValue = (numericValue / 1000000).toFixed(2) + 'M';
        } else if (Math.abs(numericValue) >= 1000) {
            formattedValue = (numericValue / 1000).toFixed(2) + 'K';
        } else {
            formattedValue = numericValue.toFixed(2);
        }
        
        return `<td class="${cellClass}">${formattedValue}</td>`;
    },
};

export default pivotTableHandler;