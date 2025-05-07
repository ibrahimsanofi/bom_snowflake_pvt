/**
 * Enhanced Column Hierarchy Handler for Pivot Tables
 * Implements proper horizontal hierarchical column headers
 */

import stateModule from './state.js';
import data from './data.js';

const state = stateModule.state;

const columnHierarchyHandler = {
    /**
     * Renders hierarchical column headers with proper expand/collapse controls
     * @param {HTMLElement} headerContainer - The table header container
     * @param {Array} columns - The column data array
     */
    renderHierarchicalColumnHeaders: function(headerContainer, columns) {
        // Clear existing header content
        headerContainer.innerHTML = '';
        
        // Find measure fields
        const valueFields = state.valueFields || ['COST_UNIT'];
        
        // First determine the maximum depth of the hierarchy
        const hierarchyInfo = this.analyzeHierarchy(columns);
        const maxDepth = hierarchyInfo.maxDepth;
        
        // Create array to hold header rows
        const headerRows = [];
        for (let i = 0; i <= maxDepth; i++) {
            const row = document.createElement('tr');
            row.className = `header-row header-level-${i}`;
            headerRows.push(row);
        }
        
        // Add measure header in the first row that spans all columns
        const measureRow = headerRows[0];
        
        // Add the corner cell (top-left) in the first row
        const cornerCell = document.createElement('th');
        cornerCell.className = 'corner-cell';
        cornerCell.rowSpan = maxDepth + 1; // Span all header rows
        measureRow.appendChild(cornerCell);
        
        // Add measure headers that span all value columns
        valueFields.forEach(field => {
            const measureHeader = document.createElement('th');
            measureHeader.className = 'measure-header';
            measureHeader.textContent = field === 'COST_UNIT' ? 'Cost Unit' : 
                                       field === 'QTY_UNIT' ? 'Quantity Unit' : field;
            
            // Calculate total number of leaf columns
            const leafCount = this.countVisibleLeafColumns(columns);
            measureHeader.colSpan = leafCount > 0 ? leafCount : 1;
            
            measureRow.appendChild(measureHeader);
        });
        
        // Process the column hierarchy to create the header structure
        // Start with level 1 (below the measure header)
        this.processColumnHeaders(headerRows.slice(1), columns, 0);
        
        // Add the header rows to the container
        headerRows.forEach(row => {
            headerContainer.appendChild(row);
        });
    },
    
    
    /**
     * Analyzes the column hierarchy to determine depth and structure
     * @param {Array} columns - The column data
     * @returns {Object} - Hierarchy information
     */
    analyzeHierarchy: function(columns) {
        const info = {
            maxDepth: 0,
            nodesByLevel: {}
        };
        
        const analyzeNode = (node, level) => {
            if (!node) return;
            
            // Update max depth
            info.maxDepth = Math.max(info.maxDepth, level);
            
            // Add node to level collection
            info.nodesByLevel[level] = info.nodesByLevel[level] || [];
            info.nodesByLevel[level].push(node);
            
            // Process children if expanded
            if (node.expanded && node.children && node.children.length > 0) {
                node.children.forEach(childId => {
                    // Handle both string IDs and direct references
                    const childNode = typeof childId === 'string'
                        ? this.findNodeById(childId, node.hierarchyField)
                        : childId;
                    
                    if (childNode) {
                        analyzeNode(childNode, level + 1);
                    }
                });
            }
        };
        
        // Process all columns
        columns.forEach(column => {
            analyzeNode(column, 0);
        });
        
        return info;
    },

    
    /**
     * Process column headers recursively
     * @param {Array} headerRows - Array of header row elements
     * @param {Array} nodes - The nodes to process at this level
     * @param {Number} level - Current level in hierarchy
     */
    processColumnHeaders: function(headerRows, nodes, level) {
        if (!headerRows[level]) return;
        
        // Process nodes at this level
        nodes.forEach(node => {
            // Create header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            if (node.isLeaf) cell.classList.add('leaf-node');
            
            cell.setAttribute('data-node-id', node._id);
            cell.setAttribute('data-level', level);
            
            // Calculate colspan - how many leaf nodes underneath
            const colspan = this.countLeafNodes(node);
            if (colspan > 1) {
                cell.colSpan = colspan;
            }
            
            // Calculate rowspan - if this is a leaf or collapsed node
            if (node.isLeaf || !node.expanded || !node.children || node.children.length === 0) {
                // Span down to the bottom of the header
                const rowsLeft = headerRows.length - level;
                if (rowsLeft > 1) {
                    cell.rowSpan = rowsLeft;
                }
            }
            
            // Add expand/collapse controls if node has children
            if (node.children && node.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = `expand-collapse ${node.expanded ? 'expanded' : 'collapsed'}`;
                expandControl.setAttribute('data-node-id', node._id);
                
                // Get dimension name from hierarchy field
                const dimName = node.hierarchyField ? 
                    node.hierarchyField.replace('DIM_', '').toLowerCase() : '';
                
                expandControl.setAttribute('data-hierarchy', dimName);
                expandControl.setAttribute('data-zone', 'column');
                
                // Add click handler
                expandControl.onclick = function(e) {
                    e.stopPropagation();
                    window.handleExpandCollapseClick(e);
                };
                
                cell.appendChild(expandControl);
            }
            
            // Add node label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'column-label';
            labelSpan.textContent = node.label || '';
            cell.appendChild(labelSpan);
            
            // Add cell to appropriate header row
            headerRows[level].appendChild(cell);
            
            // Process children if this node is expanded
            if (node.expanded && node.children && node.children.length > 0) {
                // Get child nodes
                const childNodes = node.children.map(childId => {
                    if (typeof childId === 'string') {
                        // Get dimension name
                        const dimName = node.hierarchyField ? 
                            node.hierarchyField.replace('DIM_', '').toLowerCase() : '';
                        
                        // Look up child node in hierarchy
                        return state.hierarchies[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean); // Remove any undefined/null values
                
                // Process next level with child nodes
                if (childNodes.length > 0) {
                    this.processColumnHeaders(headerRows, childNodes, level + 1);
                }
            }
        });
    },

    
    /**
     * Count the number of leaf nodes under a node
     * @param {Object} node - The node to check
     * @returns {Number} - The number of leaf nodes
     */
    countLeafNodes: function(node) {
        if (!node) return 0;
        
        // If this is a leaf node, count as 1
        if (node.isLeaf) return 1;
        
        // If node is not expanded, count as 1
        if (!node.expanded) return 1;
        
        // If node has no children, count as 1
        if (!node.children || node.children.length === 0) return 1;
        
        // For expanded nodes with children, sum up leaves from all children
        let count = 0;
        
        node.children.forEach(childId => {
            // Look up child node
            const childNode = typeof childId === 'string' ? 
                this.findNodeById(childId, node.hierarchyField) : 
                childId;
            
            if (childNode) {
                count += this.countLeafNodes(childNode);
            }
        });
        
        return Math.max(1, count); // At least 1
    },

    
    /**
     * Count the total number of visible leaf columns
     * @param {Array} columns - The column data
     * @returns {Number} - The count of visible leaf columns
     */
    countVisibleLeafColumns: function(columns) {
        let count = 0;
        
        columns.forEach(column => {
            count += this.countLeafNodes(column);
        });
        
        return Math.max(1, count); // At least 1
    },

    
    /**
     * Find a node by ID in a hierarchy
     * @param {String} nodeId - The node ID
     * @param {String} hierarchyField - The hierarchy field name
     * @returns {Object} - The found node or null
     */
    findNodeById: function(nodeId, hierarchyField) {
        if (!nodeId || !hierarchyField) return null;
        
        // Get dimension name
        const dimName = hierarchyField.replace('DIM_', '').toLowerCase();
        
        // Check if hierarchy exists
        if (!state.hierarchies || !state.hierarchies[dimName]) return null;
        
        // Look up node in hierarchy
        return state.hierarchies[dimName].nodesMap?.[nodeId] || null;
    },

    
    /**
     * Gets all visible leaf columns
     * @param {Array} columns - All column data
     * @returns {Array} - Visible leaf columns
     */
    getVisibleLeafColumns: function(columns) {
        const visibleLeafs = [];
        
        // Find root node if it exists
        const rootNode = columns.find(col => 
            col.label === 'All Items' || 
            col.label === 'All Item Cost Types' || 
            col.label === 'All Material Types' ||
            col._id === 'ROOT' || 
            col.isRootNode);
        
        const findVisibleLeafs = (column, currentPath = [], level = 0) => {
            if (!column) return;
            
            // Skip nodes marked to be hidden in UI
            if (column.skipInUI) return;
            
            // Add level information for indentation
            column.level = level;
            column.path = currentPath.concat(column._id);
            
            // Special handling for root node
            if (column === rootNode) {
                // If root is collapsed, it counts as one leaf
                if (!column.expanded) {
                    visibleLeafs.push(column);
                    return;
                }
                
                // If root is expanded, process its children instead
                if (column.expanded && column.children && column.children.length > 0) {
                    const childNodes = column.children.map(childId => {
                        if (typeof childId === 'string') {
                            const dimName = column.hierarchyField ? 
                                column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                                column.hierarchyName;
                            return this.state.hierarchies[dimName]?.nodesMap?.[childId];
                        }
                        return childId;
                    }).filter(Boolean);
                    
                    childNodes.forEach(childNode => {
                        findVisibleLeafs(childNode, column.path, level + 1);
                    });
                }
                return;
            }
            
            if (column.isLeaf) {
                // This is a leaf node, include it
                visibleLeafs.push(column);
                return;
            }
            
            // Not a leaf, check if it's expanded
            if (!column.expanded) {
                // Not expanded, treat it as a leaf for display purposes
                visibleLeafs.push(column);
                return;
            }
            
            // Expanded parent, check children
            if (column.children && column.children.length > 0) {
                const childNodes = column.children.map(childId => {
                    if (typeof childId === 'string') {
                        const dimName = column.hierarchyField ? 
                            column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                            column.hierarchyName;
                        return this.state.hierarchies[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean);
                
                // Process each child
                childNodes.forEach(childNode => {
                    findVisibleLeafs(childNode, column.path, level + 1);
                });
            } else {
                // No children, treat as leaf
                visibleLeafs.push(column);
            }
        };
        
        // Process each column
        if (rootNode) {
            // If we have a root node, start with it
            findVisibleLeafs(rootNode);
        } else {
            // Otherwise process all columns
            columns.forEach(column => {
                findVisibleLeafs(column);
            });
        }
        
        return visibleLeafs;
    },

    
    /**
     * Initialize column zone handlers
     */
    init: function() {
        // Initialize expanded nodes state
        state.expandedNodes = state.expandedNodes || {};
        
        // Set all hierarchies to have root nodes expanded by default
        Object.keys(state.hierarchies || {}).forEach(dimName => {
            state.expandedNodes[dimName] = state.expandedNodes[dimName] || {};
            state.expandedNodes[dimName].column = state.expandedNodes[dimName].column || {};
            
            const hierarchy = state.hierarchies[dimName];
            if (hierarchy && hierarchy.root) {
                state.expandedNodes[dimName].column[hierarchy.root.id] = true;
                hierarchy.root.expanded = true;
            }
        });
        
        console.log("Column hierarchy handler initialized");
    }
};

export default columnHierarchyHandler;