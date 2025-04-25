// This module centralizes the essential logic of pivot table functionality

import data from './data.js';
import stateModule from './state.js';

// Get reference to application state
const state = stateModule.state;

// Define a namespace for pivot table functions
const pivotTable = {
    // Store a reference to the state object
    state: null,
    
    /**
     * Initialize the pivot table system
     * This should be called once DOM is ready
     */
    init: function(stateRef) {
        // Store reference to state
        this.state = stateRef;
        
        // Set up global event handlers
        this.setupGlobalHandlers();
        
        console.log("Pivot table system initialized");
    },
    
    
    /**
     * Set up global event handlers
     */
    setupGlobalHandlers: function() {
        // Make handleExpandCollapseClick globally available
        window.handleExpandCollapseClick = this.handleExpandCollapseClick.bind(this);
        
        // Make generatePivotTable globally available
        window.generatePivotTable = this.generatePivotTable.bind(this);
    },

   
    /**
     * Handle expand/collapse clicks in the pivot table
     */
    handleExpandCollapseClick: function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';
        
        console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
        
        // Get state from the global App object
        const state = window.App?.state;
        
        // Ensure hierarchy exists
        if (!state.hierarchies[hierarchyName]) {
            console.error(`Hierarchy ${hierarchyName} not found in state`);
            return;
        }
        
        // Ensure node exists
        const node = state.hierarchies[hierarchyName].nodesMap[nodeId];
        if (!node) {
            console.error(`Node ${nodeId} not found in ${hierarchyName} hierarchy`);
            return;
        }
        
        // Toggle node expansion in state
        state.expandedNodes = state.expandedNodes || {};
        state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
        state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
        state.expandedNodes[hierarchyName][zone][nodeId] = !state.expandedNodes[hierarchyName][zone][nodeId];
        
        // Also update the node's expanded property directly
        node.expanded = state.expandedNodes[hierarchyName][zone][nodeId];
        
        console.log(`Node ${nodeId} expansion set to: ${node.expanded}`);
        
        // Regenerate pivot table
        window.refreshPivotTable();
        
        // Prevent event from bubbling up
        e.stopPropagation();
    },


    /**
     * Calculate measure values for pivot table cells
     * Improved to properly handle dimension filtering
     * 
     * @param {Array} records - Array of data records to aggregate
     * @param {Object} rowDef - Row node information
     * @param {Object} colDef - Column node information (if applicable)
     * @param {string} measureField - Name of the measure field (COST_UNIT or QTY_UNIT)
     * @returns {number} - The calculated measure value
     */
    // calculateMeasure: function(records, rowDef, colDef, measureField) {
    //     // Return 0 for empty record sets
    //     if (!records || records.length === 0) {
    //         return 0;
    //     }
        
    //     // Start with all records
    //     let filteredRecords = [...records];
        
    //     // Filter by row definition if provided
    //     if (rowDef) {
    //         // For Legal Entity nodes, use special handling
    //         if (rowDef.hierarchyField === 'DIM_LE') {
    //             if (rowDef.factId) {
    //                 // Direct match by LE code (usually for leaf nodes)
    //                 filteredRecords = filteredRecords.filter(r => r.LE === rowDef.factId);
    //             } else {
    //                 // For hierarchy nodes, check if we're filtering properly
    //                 // Don't filter root node
    //                 if (rowDef.id !== 'ROOT' && rowDef.label !== 'WORLDWIDE') {
    //                     // Look at each record's LE value and see if it belongs to this segment
    //                     const mappings = this.state?.mappings?.legalEntity;
                        
    //                     if (mappings && mappings.pathToLeCodes) {
    //                         // Try to find LEs for this path segment
    //                         const matchingLEs = mappings.pathToLeCodes[rowDef.label];
                            
    //                         if (matchingLEs && matchingLEs.size > 0) {
    //                             // Filter to only records with these LEs
    //                             const leSet = new Set(matchingLEs);
    //                             filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
    //                         } else {
    //                             // Try matching based on path contains
    //                             const matchingByPath = [];
                                
    //                             // Check each record's LE path
    //                             const uniqueLEs = new Set(filteredRecords.map(r => r.LE));
    //                             uniqueLEs.forEach(le => {
    //                                 if (mappings.leToPaths && mappings.leToPaths[le] && 
    //                                     mappings.leToPaths[le].includes(rowDef.label)) {
    //                                     matchingByPath.push(le);
    //                                 }
    //                             });
                                
    //                             if (matchingByPath.length > 0) {
    //                                 // Filter to only records with these LEs
    //                                 const leSet = new Set(matchingByPath);
    //                                 filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         } else {
    //             // Use standard filtering for other hierarchies
    //             filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
    //         }
    //     }
        
    //     // Filter by column definition if provided
    //     if (colDef) {
    //         filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
    //     }
        
    //     // Return 0 if no records match
    //     if (filteredRecords.length === 0) {
    //         return 0;
    //     }
        
    //     // Sum the measure values
    //     let result = 0;
        
    //     if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
    //         filteredRecords.forEach(record => {
    //             // Get the value and ensure it's a number
    //             const value = typeof record[measureField] === 'number' ? 
    //                 record[measureField] : parseFloat(record[measureField] || 0);
                    
    //             // Add to sum if valid
    //             if (!isNaN(value)) {
    //                 result += value;
    //             }
    //         });
    //     }
        
    //     return result;
    // },

    calculateMeasure: function (records, rowDef, colDef, measureField) {
        // Return 0 for empty record sets
        if (!records || records.length === 0) {
            return 0;
        }
        
        // Start with all records
        let filteredRecords = [...records];
        
        // Filter by row definition if provided
        if (rowDef) {
            filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
        }
        
        // Filter by column definition if provided
        if (colDef) {
            filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
        }
        
        // Return 0 if no records match
        if (filteredRecords.length === 0) {
            return 0;
        }
        
        // Sum the measure values
        let result = 0;
        
        if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
            filteredRecords.forEach(record => {
                // Get the value and ensure it's a number
                const value = typeof record[measureField] === 'number' ? 
                    record[measureField] : parseFloat(record[measureField] || 0);
                    
                // Add to sum if valid
                if (!isNaN(value)) {
                    result += value;
                }
            });
        }
        
        return result;
    },
    

    /**
     * Filters records based on dimension information
     * @param {Array} records - The records to filter
     * @param {Object} dimDef - The dimension definition (row or column)
     * @returns {Array} - Filtered records
     */
    filterRecordsByDimension: function(records, dimDef) {
            
        if (!dimDef) return records;
        
        // For multi-dimension rows/columns
        if (dimDef.dimensions) {
            let result = [...records];
            dimDef.dimensions.forEach(dimension => {
                result = this.filterByDimensionNode(result, dimension);
            });
            return result;
        }
        
        // For single dimension rows/columns
        return this.filterByDimensionNode(records, dimDef);
    },

    /**
     * Filters records by a specific dimension node
     * @param {Array} records - The records to filter
     * @param {Object} node - The dimension node
     * @returns {Array} - Filtered records
     */
    filterByDimensionNode: function(records, node) {
        if (!node || !node.hierarchyField) return records;
        
        // Get dimension name
        const dimName = node.hierarchyField.replace('DIM_', '').toLowerCase();
        
        // Skip ROOT nodes
        if (node._id === 'ROOT') return records;
        
        // Dimension-specific filtering based on the mappings
        switch (dimName) {
            case 'le':
                return this.filterByLegalEntity(records, node);
                
            case 'cost_element':
                return this.filterByCostElement(records, node);
                
            case 'smartcode':
                return this.filterBySmartCode(records, node);
                
            case 'gmid_display':
                return this.filterByGmidDisplay(records, node);
                
            case 'item_cost_type':
                return this.filterByItemCostType(records, node);
                
            case 'material_type':
                return this.filterByMaterialType(records, node);
                
            default:
                console.warn(`Unknown dimension: ${dimName}`);
                return records;
        }
    },


    /**
     * Improved filter by Legal Entity function that properly handles hierarchy
     * 
     * @param {Array} records - The records to filter
     * @param {Object} node - The node definition
     * @returns {Array} - Filtered records
     */
    filterByLegalEntity: function (records, node) {
        // Get the current state
        const state = window.App?.state;
        if (!state?.mappings?.legalEntity) return records;
        
        // Get the mapping
        const mapping = state.mappings.legalEntity;
        
        // For leaf nodes, filter by exact LE code
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.LE === node.factId);
        }
        
        // For non-leaf nodes, use descendantFactIds if available
        if (node.descendantFactIds && node.descendantFactIds.length > 0) {
            const factIdSet = new Set(node.descendantFactIds);
            return records.filter(record => factIdSet.has(record.LE));
        }
        
        // If no descendantFactIds, try to find them via other means
        const nodePath = node.path ? node.path.join('/') : '';
        const nodeLabel = node.label || '';
        
        // Collect all relevant LE codes
        const leCodes = new Set();
        
        // 1. Try by node label in the mapping
        if (mapping.labelToLeCodes && mapping.labelToLeCodes[nodeLabel]) {
            mapping.labelToLeCodes[nodeLabel].forEach(leCode => leCodes.add(leCode));
        }
        
        // 2. Try by path segments
        if (mapping.pathToLeCodes && mapping.pathToLeCodes[nodeLabel]) {
            mapping.pathToLeCodes[nodeLabel].forEach(leCode => leCodes.add(leCode));
        }
        
        // 3. Find by checking if this node's label is contained in any LE paths
        if (leCodes.size === 0) {
            Object.entries(mapping.leToPaths || {}).forEach(([leCode, path]) => {
                if (path && path.includes(nodeLabel)) {
                    leCodes.add(leCode);
                }
            });
        }
        
        // 4. Try direct matching with LE codes or descriptions
        if (leCodes.size === 0 && nodeLabel) {
            Object.keys(mapping.leToDetails || {}).forEach(leCode => {
                const details = mapping.leToDetails[leCode];
                if (details && (details.description === nodeLabel || leCode === nodeLabel)) {
                    leCodes.add(leCode);
                }
            });
        }
        
        // If we found LE codes, filter the records
        if (leCodes.size > 0) {
            return records.filter(record => 
                record.LE && leCodes.has(record.LE)
            );
        }
        
        // If we can't determine any matching LE codes, return original records
        return records;
    },


    /**
     * Filter records by Cost Element
     */
    filterByCostElement: function(records, node) {
        if (!this.state.mappings || !this.state.mappings.costElement) return records;
        
        // Get the mapping
        const mapping = this.state.mappings.costElement;
        
        // For leaf nodes, filter by exact cost element
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.COST_ELEMENT === node.factId);
        }
        
        // For hierarchy nodes, use the nodeToCostElements mapping
        const costElements = mapping.nodeToCostElements && mapping.nodeToCostElements[node.label];
        if (costElements && costElements.size > 0) {
            const elementsArray = Array.from(costElements);
            return records.filter(record => elementsArray.includes(record.COST_ELEMENT));
        }
        
        return records;
    },


    /**
     * Filter records by Smart Code
     */
    filterBySmartCode: function(records, node) {
        if (!this.state.mappings || !this.state.mappings.smartCode) return records;
        
        // Get the mapping
        const mapping = this.state.mappings.smartCode;
        
        // For leaf nodes, filter by exact smart code
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.ROOT_SMARTCODE === node.factId);
        }
        
        // For hierarchy nodes, use the nodeToSmartCodes mapping
        const smartCodes = mapping.nodeToSmartCodes && mapping.nodeToSmartCodes[node.label];
        if (smartCodes && smartCodes.size > 0) {
            const codesArray = Array.from(smartCodes);
            return records.filter(record => codesArray.includes(record.ROOT_SMARTCODE));
        }
        
        return records;
    },


    /**
     * Filter records by GMID Display
     */
    filterByGmidDisplay: function(records, node) {
        // For the "All GMID Items" root node
        if (node.label === 'All GMID Items') {
            return records;
        }
        
        // Handle category nodes like "HUPF Items (387)"
        if (node.prefixFilter || (node.label && node.label.includes('Items'))) {
            // Use prefixFilter if available, otherwise extract from label
            let prefix = node.prefixFilter;
            
            if (!prefix && node.label) {
                const prefixMatch = node.label.match(/^([A-Za-z0-9]+)/);
                prefix = prefixMatch ? prefixMatch[1] : null;
            }
            
            if (prefix) {
                // Filter records where any segment in PATH_GMID starts with this prefix
                return records.filter(record => {
                    // Check COMPONENT_GMID first
                    if (record.COMPONENT_GMID && record.COMPONENT_GMID.startsWith(prefix)) {
                        return true;
                    }
                    
                    // Check PATH_GMID segments
                    if (record.PATH_GMID) {
                        const pathSegments = record.PATH_GMID.split('/');
                        return pathSegments.some(segment => segment.startsWith(prefix));
                    }
                    
                    return false;
                });
            }
        }
        
        // For specific GMID nodes (non-category nodes)
        if (node.gmidCode) {
            return records.filter(record => {
                // Check direct match with COMPONENT_GMID
                if (record.COMPONENT_GMID === node.gmidCode) {
                    return true;
                }
                
                // Check if any segment in PATH_GMID exactly matches this gmidCode
                if (record.PATH_GMID) {
                    const pathSegments = record.PATH_GMID.split('/');
                    return pathSegments.includes(node.gmidCode);
                }
                
                return false;
            });
        }
        
        // For leaf nodes with factId
        if (node.factId) {
            return records.filter(record => record.COMPONENT_GMID === node.factId);
        }
        
        // For nodes with descendantFactIds
        if (node.descendantFactIds && node.descendantFactIds.length > 0) {
            const factIdSet = new Set(node.descendantFactIds);
            return records.filter(record => factIdSet.has(record.COMPONENT_GMID));
        }
        
        return records;
    },


    /**
     * Filter records by Item Cost Type
     */
    filterByItemCostType: function(records, node) {
        // Direct filtering by ITEM_COST_TYPE
        if (node.factId) {
            return records.filter(record => record.ITEM_COST_TYPE === node.factId);
        }
        
        return records;
    },


    /**
     * Filter records by Material Type
     */
    filterByMaterialType: function(records, node) {
        // Direct filtering by COMPONENT_MATERIAL_TYPE
        if (node.factId) {
            return records.filter(record => record.COMPONENT_MATERIAL_TYPE === node.factId);
        }
        
        return records;
    },


    /**
     * Get all visible leaf columns based on expansion state
     */
    getVisibleLeafColumns: function(columns) {
        const visibleLeafs = [];
        
        const findVisibleLeafs = (column) => {
            if (!column) return;
            
            if (column.isLeaf) {
                visibleLeafs.push(column);
                return;
            }
            
            // Not a leaf, check if it's expanded
            if (!column.expanded) {
                // Not expanded, treat it as a leaf
                visibleLeafs.push(column);
                return;
            }
            
            // Expanded, check children
            if (column.children && column.children.length > 0) {
                column.children.forEach(childId => {
                    // Get the child column
                    if (typeof childId === 'string') {
                        const dimName = column.hierarchyField ? column.hierarchyField.replace('DIM_', '').toLowerCase() : '';
                        const hierarchy = this.state.hierarchies[dimName];
                        const childNode = hierarchy && hierarchy.nodesMap ? hierarchy.nodesMap[childId] : null;
                        
                        if (childNode) {
                            findVisibleLeafs(childNode);
                        }
                    } else {
                        findVisibleLeafs(childId);
                    }
                });
            } else {
                // No children, treat as leaf
                visibleLeafs.push(column);
            }
        };
        
        // Process each column
        columns.forEach(column => {
            findVisibleLeafs(column);
        });
        
        return visibleLeafs;
    },


    /**
     * Count leaf nodes under a parent node
     */
    countLeafNodes: function(node) {
        if (!node) return 0;
        if (node.isLeaf) return 1;
        if (!node.children || node.children.length === 0) return 1;
        
        let count = 0;
        node.children.forEach(childId => {
            if (typeof childId === 'string') {
                // Get child from nodesMap
                const dimName = node.hierarchyField ? node.hierarchyField.replace('DIM_', '').toLowerCase() : '';
                const hierarchy = this.state.hierarchies[dimName];
                const childNode = hierarchy && hierarchy.nodesMap ? hierarchy.nodesMap[childId] : null;
                
                if (childNode) {
                    count += this.countLeafNodes(childNode);
                }
            } else {
                count += this.countLeafNodes(childId);
            }
        });
        
        return count > 0 ? count : 1;
    },


    /**
     * Helper to safely get an element from the DOM
     */
    getElement: function(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },


    /**
     * Helper to show or hide loading indicator
     */
    toggleLoading: function(show = true) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    },


    /**
     * Checks if a hierarchy node should be visible based on its ancestors' expansion state
     */
    isNodeVisible: function(row, allNodes) {
        // Add proper null checking
        if (!row || !allNodes || !Array.isArray(allNodes)) {
            return true; // Default to visible if data is missing
        }
        
        // ROOT nodes or non-hierarchical fields are always visible
        if (!row.hierarchyField || !row.path || !Array.isArray(row.path) || row.path.length <= 1 || row._id === 'ROOT') {
            return true;
        }
        
        // Check each ancestor in the path except self and ROOT
        for (let i = 1; i < row.path.length - 1; i++) {
            const ancestorId = row.path[i];
            if (!ancestorId) continue; // Skip invalid path segments
            
            // Find ancestor node safely
            const ancestorNode = Array.isArray(allNodes) ? 
                allNodes.find(n => n && n._id === ancestorId) : null;
            
            // If any ancestor is not expanded, the node is not visible
            if (ancestorNode && ancestorNode.expanded === false) {
                return false;
            }
        }
        
        // Check expanded state directly from state
        if (this.state && this.state.expandedNodes) {
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : null;
            if (dimName && row.path && Array.isArray(row.path) && row.path.length > 1) {
                // For each ancestor, check if it's expanded in the state
                for (let i = 1; i < row.path.length - 1; i++) {
                    const ancestorId = row.path[i];
                    if (!ancestorId) continue;
                    
                    // Check if the ancestor is expanded in state safely
                    const isExpanded = this.state.expandedNodes[dimName] && 
                                        this.state.expandedNodes[dimName].row && 
                                        this.state.expandedNodes[dimName].row[ancestorId];
                    
                    if (isExpanded === false) {
                        return false;
                    }
                }
            }
        }
        
        return true; // All ancestors are expanded or we couldn't determine
    },


    /**
     * Renders a single row cell with proper indentation and expand/collapse controls
     */
    renderRowCell: function(rowDef) {
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0; // 20px per level
        
        // Add cell with proper indentation and expand/collapse control
        let cellHtml = `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse control only if it has children
        if (rowDef.hasChildren === true) {
            const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${rowDef._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                title="Expand/collapse this item"></span>`;
        } else {
            cellHtml += `<span class="leaf-node"></span>`;
        }
        
        cellHtml += `<span class="dimension-label">${rowDef.label || rowDef._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Renders hierarchical column headers
     */
    renderHierarchicalColumns: function(elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) return;
        
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        const columns = pivotData.columns;
        
        // Group columns by level for header rows
        const columnsByLevel = {};
        let maxLevel = 0;
        
        columns.forEach(col => {
            const level = col.level || 0;
            columnsByLevel[level] = columnsByLevel[level] || [];
            columnsByLevel[level].push(col);
            maxLevel = Math.max(maxLevel, level);
        });
        
        // Create header HTML with one row per level
        let headerHtml = '';
        
        // Create the column level headers
        for (let level = 0; level <= maxLevel; level++) {
            headerHtml += '<tr>';
            
            // Add the row header cell in first row only
            if (level === 0) {
                headerHtml += `<th class="row-header" rowspan="${maxLevel + 1}">Hierarchy</th>`;
            }
            
            // Add column headers for this level
            if (columnsByLevel[level]) {
                columnsByLevel[level].forEach(col => {
                    // Calculate how many leaf nodes are under this column
                    const leafCount = this.countLeafNodes(col);
                    
                    // Each column will span across value fields
                    const colspan = leafCount * valueFields.length;
                    
                    // Add expand/collapse for parent nodes
                    const dimName = col.hierarchyField ? col.hierarchyField.replace('DIM_', '').toLowerCase() : '';
                    
                    headerHtml += `<th class="column-header" colspan="${colspan}">`;
                    
                    // Add expand/collapse control if column has children
                    if (col.hasChildren) {
                        const expandClass = col.expanded ? 'expanded' : 'collapsed';
                        headerHtml += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${col._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="handleExpandCollapseClick(event)"
                            title="Expand/collapse this item"></span>`;
                    }
                    
                    // Check if this is a special non-hierarchical dimension
                    const isItemCostType = col.hierarchyField === 'ITEM_COST_TYPE' || 
                                          col.hierarchyField === 'DIM_ITEM_COST_TYPE';
                    const isMaterialType = col.hierarchyField === 'COMPONENT_MATERIAL_TYPE' || 
                                          col.hierarchyField === 'DIM_MATERIAL_TYPE';
                    
                    // Get appropriate label - use descriptions for special dimensions
                    let displayLabel = col.label || col._id;
                    
                    if (isItemCostType && col.factId) {
                        // Use the description for ITEM_COST_TYPE
                        displayLabel = data.getItemCostTypeDesc(col.factId);
                    } else if (isMaterialType && col.factId) {
                        // Use the description for MATERIAL_TYPE
                        displayLabel = data.getMaterialTypeDesc(col.factId);
                    }
                    
                    headerHtml += displayLabel;
                    headerHtml += '</th>';
                });
            }
            
            headerHtml += '</tr>';
        }
        
        // Add value field header row if needed
        if (maxLevel >= 0) {
            headerHtml += '<tr>';
            
            // Get leaf columns
            const leafColumns = this.getVisibleLeafColumns(columns);
            
            // For each leaf column, add value field headers
            leafColumns.forEach(col => {
                valueFields.forEach(field => {
                    const fieldDef = this.state.availableFields.find(f => f.id === field);
                    const fieldLabel = fieldDef ? fieldDef.label : field;
                    
                    headerHtml += `<th class="value-header" data-column="${col._id}" data-field="${field}">
                        ${fieldLabel}
                    </th>`;
                });
            });
            
            headerHtml += '</tr>';
        }
        
        // Set header HTML
        elements.pivotTableHeader.innerHTML = headerHtml;
        
        // Add event handlers for column expand/collapse
        setTimeout(() => {
            const controls = elements.pivotTableHeader.querySelectorAll('.expand-collapse');
            controls.forEach(control => {
                control.addEventListener('click', (e) => {
                    window.handleExpandCollapseClick(e);
                });
            });
        }, 100);
    },


    /**
     * Render the pivot table
     */
    renderPivotTable: function(elements, useMultiDimension = false) {
        // Validate elements parameter
        if (!elements || !elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Invalid elements provided to renderPivotTable");
            // Try to get elements directly if not provided correctly
            elements = {
                pivotTableHeader: document.getElementById('pivotTableHeader'),
                pivotTableBody: document.getElementById('pivotTableBody')
            };
            
            // Still not found? Exit with error
            if (!elements.pivotTableHeader || !elements.pivotTableBody) {
                console.error("Cannot find pivot table DOM elements");
                return;
            }
        }
        
        const pivotData = this.state.pivotData;
    
        // Check if we have valid data
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("No valid pivot data available for rendering");
            return;
        }
    
        // Render the standard table
        this.renderStandardTable(elements, useMultiDimension);
    },


    /**
     * Render the table body
     */
    renderTableBody: function(elements, useMultiDimension) {
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        // Use actual data from pivotData
        const rows = pivotData.rows;
        let bodyHtml = '';
        
        // Render each row from pivotData
        rows.forEach((rowDef, index) => {
            const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
            const rowClass = index % 2 === 0 ? 'even' : 'odd';
            
            // Start row
            bodyHtml += `<tr class="${rowClass}">`;
            
            // Hierarchy cell with proper indentation and expand/collapse controls
            const indentation = rowDef.level ? rowDef.level * 20 : 0;
            const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
            
            bodyHtml += `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
            
            // Add expand/collapse control if row has children
            if (rowDef.hasChildren) {
                const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
                bodyHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${rowDef._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="row"
                    onclick="handleExpandCollapseClick(event)"
                    title="Expand/collapse this item"></span>`;
            } else {
                bodyHtml += `<span class="leaf-node"></span>`;
            }
            
            bodyHtml += `<span class="dimension-label">${rowDef.label || rowDef._id}</span>`;
            bodyHtml += '</td>';
            
            // Value cell - Check for field ID that matches the column header
            const fieldId = 'COST_UNIT'; // This is the field ID for your Cost Unit column
            
            // Get the actual value
            let value = 0;
            if (rowData[fieldId] !== undefined) {
                value = typeof rowData[fieldId] === 'number' ? 
                       rowData[fieldId] : parseFloat(rowData[fieldId]);
                if (isNaN(value)) value = 0;
            }
            
            // Format value for display
            let formattedValue;
            if (value === 0) {
                formattedValue = '0.00';
            } else if (Math.abs(value) >= 1000000) {
                formattedValue = (value / 1000000).toFixed(2) + 'm';
            } else if (Math.abs(value) >= 1000) {
                formattedValue = (value / 1000).toFixed(2) + 'k';
            } else {
                formattedValue = value.toFixed(2);
            }
            
            // Add cell class based on value
            const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell';
            
            // Add value cell
            bodyHtml += `<td class="${cellClass}" data-raw-value="${value}">${formattedValue}</td>`;
            
            // End row
            bodyHtml += '</tr>';
        });
        
        // Set the HTML content
        if (elements && elements.pivotTableBody) {
            elements.pivotTableBody.innerHTML = bodyHtml;
            console.log(`Rendered table body with ${rows.length} rows`);
            
            // Make sure expand/collapse controls work
            setTimeout(() => {
                const controls = elements.pivotTableBody.querySelectorAll('.expand-collapse');
                controls.forEach(control => {
                    control.addEventListener('click', (e) => {
                        const nodeId = e.target.getAttribute('data-node-id');
                        const hierarchyName = e.target.getAttribute('data-hierarchy');
                        const zone = e.target.getAttribute('data-zone') || 'row';
                        
                        console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
                        
                        // Toggle class for immediate visual feedback
                        e.target.classList.toggle('expanded');
                        e.target.classList.toggle('collapsed');
                        
                        // Call the actual handler with a small delay to prevent too many refreshes
                        if (window.handleExpandCollapseClick) {
                            window.handleExpandCollapseClick(e);
                        }
                    });
                });
            }, 100);
        } else {
            console.error("Cannot set table body HTML - element not found");
        }
    },

    
    /**
     * Get visible rows based on hierarchy expansion state
     */
    getVisibleRows: function(rows) {
        const visibleRows = [];
        
        // For each row, check if it should be visible based on parent expansion
        rows.forEach(row => {
            // Always show ROOT nodes
            if (row._id === 'ROOT' || !row.path || row.path.length <= 1) {
                visibleRows.push(row);
                return;
            }
            
            // Check if all ancestors are expanded
            let visible = true;
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';
            
            // Start from the second element (after ROOT) and go until the second-to-last (the row itself)
            for (let i = 1; i < row.path.length - 1; i++) {
                const ancestorId = row.path[i];
                
                // Check if this ancestor is expanded
                const isExpanded = this.state.expandedNodes?.[dimName]?.row?.[ancestorId];
                
                if (!isExpanded) {
                    visible = false;
                    break;
                }
            }
            
            if (visible) {
                visibleRows.push(row);
            }
        });
        
        return visibleRows;
    },


    /**
     * Format a value cell with proper formatting and classes
     */
    renderValueCell: function(value) {
        // Force number conversion with proper null/undefined handling
        let numericValue;
        
        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            // Ensure stringification before parsing
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }
        
        // Determine cell class
        let cellClass = 'value-cell';
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }
        
        // Format value for display with added precision
        let formattedValue;
        if (numericValue === 0) {
            formattedValue = '0.00';
        } else if (Math.abs(numericValue) >= 1000000000) {
            formattedValue = (numericValue / 1000000000).toFixed(2) + 'b';
        } else if (Math.abs(numericValue) >= 1000000) {
            formattedValue = (numericValue / 1000000).toFixed(2) + 'm';
        } else if (Math.abs(numericValue) >= 1000) {
            formattedValue = (numericValue / 1000).toFixed(2) + 'k';
        } else {
            formattedValue = numericValue.toFixed(2);
        }
        
        // Return HTML for the cell with data-raw-value for sorting and other operations
        return `<td class="${cellClass}" data-raw-value="${numericValue}">${formattedValue}</td>`;
    },


    /**
     * Render a single table row
     */
    renderTableRow: function(rowDef, dataRow, rowIndex, bodyHtml, useMultiDimension, validColumns) {
        let rowHtml = `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
        
        // Row header cells
        if (useMultiDimension && typeof data.renderMultiDimensionRowCells === 'function') {
            rowHtml += data.renderMultiDimensionRowCells(rowDef);
        } else {
            rowHtml += this.renderRowCell(rowDef);
        }
        
        // Data cells
        if (validColumns && validColumns.length > 0) {
            validColumns.forEach(col => {
                this.state.valueFields.forEach(fieldId => {
                    const key = `${col._id}|${fieldId}`;
                    // DIRECT RENDERING without any default substitution
                    rowHtml += this.renderValueCell(dataRow[key]);
                });
            });
        } else {
            this.state.valueFields.forEach(fieldId => {
                // DIRECT RENDERING without any default substitution
                rowHtml += this.renderValueCell(dataRow[fieldId]);
            });
        }
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    /**
     * Render the standard table with hierarchical dimensions
     */
    renderStandardTable: function(elements, useMultiDimension) {
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        console.log("Rendering standard table with data");
        
        // Filter out the ROOT node from columns
        const validColumns = pivotData.columns.filter(col => col._id !== 'ROOT');
        
        // ===== HANDLE COLUMN HIERARCHIES =====
        // If we have column hierarchies, create appropriate headers
        if (validColumns.length > 0) {
            // Create column headers with hierarchy
            this.renderHierarchicalColumns(elements, pivotData);
        } else {
            // Simple header for value-only columns
            let headerHtml = '<tr>';
            headerHtml += '<th class="row-header">Hierarchy</th>';
            headerHtml += '<th class="value-header">Value - Cost Unit</th>';
            headerHtml += '</tr>';
            
            // Set header HTML
            if (elements && elements.pivotTableHeader) {
                elements.pivotTableHeader.innerHTML = headerHtml;
            }
        }
        
        // Render the body rows with proper column structure
        this.renderTableBody(elements, useMultiDimension);
    },


    /**
     * Gets all leaf descendants of a node recursively
     * @param {Object} node - The root node to start from
     * @param {Array} result - Array to collect leaf nodes (for recursion)
     * @returns {Array} - Array of all leaf descendant nodes
     */
    getAllLeafDescendants: function(node, result = []) {
        if (!node) return result;
        
        // If this is a leaf node, add it
        if (node.isLeaf) {
            result.push(node);
        } 
        // Otherwise recursively process all children
        else if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                // Handle both child object references and child IDs
                const childNode = (typeof child === 'object') ? child : 
                    (node.hierarchy?.nodesMap?.[child] || 
                    (window.App?.state?.hierarchies?.[node.hierarchyName]?.nodesMap?.[child]));
                    
                if (childNode) {
                    this.getAllLeafDescendants(childNode, result);
                }
            }
        }
        
        return result;
    },


    /**
     * Process pivot data to calculate cell values
     */
    processPivotData: function() {
        if (!this.state.rawFactBOMData || this.state.rawFactBOMData.length === 0) {
            console.error("No fact data available for pivot table");
            return;
        }
        
        // Process rows
        let rowFields = this.state.rowFields || [];
        let columnFields = this.state.columnFields || [];
        let valueFields = this.state.valueFields || [];
        
        // Ensure we have at least one field in each area
        if (rowFields.length === 0) {
            console.warn("No row fields selected, defaulting to first available dimension");
        }
        
        if (valueFields.length === 0) {
            console.warn("No value fields selected, defaulting to COST_UNIT");
        }
        
        // Process the row fields
        const rowData = data.processHierarchicalFields(rowFields, 'row');
        
        // Process the column fields (or use a simple default if none selected)
        const columnData = columnFields.length > 0 
            ? data.processHierarchicalFields(columnFields, 'column') 
            : { flatRows: [{ _id: 'default', label: 'Value' }], flatMappings: [] };
        
        // Prepare the pivot data structure
        this.state.pivotData = {
            rows: rowData.flatRows,
            rowMappings: rowData.flatMappings,
            columns: columnData.flatRows,
            columnMappings: columnData.flatMappings,
            data: [] // Will be populated with cell values
        };
        
        // Calculate the values for each cell
        this.calculatePivotCells();
    },


    /**
     * Calculate cell values for the pivot table
     */
    calculatePivotCells: function() {
        const pivotData = this.state.pivotData;
        const rawFactBOMData = this.state.rawFactBOMData || [];
        const valueFields = this.state.valueFields || [];
        
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }
        
        console.log(`Calculating pivot cells with ${rawFactBOMData.length} fact records`);
        
        // For each row
        pivotData.rows.forEach(rowDef => {
            // Create a data object for this row
            const rowData = { _id: rowDef._id };
            
            // For each column
            pivotData.columns.forEach(colDef => {
                // For each value field
                valueFields.forEach(fieldId => {
                    // Calculate the aggregate value for this cell
                    const value = this.calculateMeasure(rawFactBOMData, rowDef, colDef, fieldId);
                    
                    // Verify the value is numeric and convert if needed
                    let finalValue = value;
                    if (typeof finalValue !== 'number') {
                        const converted = parseFloat(finalValue);
                        if (!isNaN(converted)) {
                            finalValue = converted;
                        }
                    }
                    
                    // Store the value in the row data object with proper key
                    const key = colDef._id === 'default' ? fieldId : `${colDef._id}|${fieldId}`;
                    rowData[key] = finalValue;
                });
            });
            
            // Add the row data to the pivot data
            pivotData.data.push(rowData);
        });
        
        console.log(`Pivot calculations complete: ${pivotData.data.length} data rows generated`);
    },

    

    /**
     * Check table structure for debugging purposes
     */
    checkTableStructure: function() {
        console.log("=== TABLE STRUCTURE CHECK ===");
        
        // Check if table header exists
        const tableHeader = document.getElementById('pivotTableHeader');
        console.log("Table header exists:", !!tableHeader);
        if (tableHeader) {
            console.log("Header HTML:", tableHeader.innerHTML);
        }
        
        // Check if table body exists
        const tableBody = document.getElementById('pivotTableBody');
        console.log("Table body exists:", !!tableBody);
        if (tableBody) {
            console.log("Body has rows:", tableBody.querySelectorAll('tr').length);
            console.log("Body HTML sample:", tableBody.innerHTML.substring(0, 200) + '...');
        }
        
        // Check for any value cells
        const valueCells = document.querySelectorAll('.value-cell');
        console.log("Value cells found:", valueCells.length);
        
        // Check if the pivot data structure is correctly populated
        if (this.state && this.state.pivotData) {
            console.log("Pivot data exists with:");
            console.log("- Rows:", this.state.pivotData.rows?.length || 0);
            console.log("- Columns:", this.state.pivotData.columns?.length || 0);
            console.log("- Data rows:", this.state.pivotData.data?.length || 0);
        } else {
            console.log("No pivot data structure exists!");
        }
        
        console.log("=== END STRUCTURE CHECK ===");
    },


    /**
     * Main function to generate the pivot table
     * This is the entry point for generating and rendering the pivot table
     */
    generatePivotTable: function(elements) {
        console.log("Starting pivot table generation...");
        
        // FIRST: Get DOM elements if not provided
        if (!elements) {
            elements = {
                pivotTableHeader: document.getElementById('pivotTableHeader'),
                pivotTableBody: document.getElementById('pivotTableBody')
            };
        }
        
        // Check if elements exist
        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Required pivot table elements not found in DOM");
            return;
        }
        
        try {
            // If we're using filtered data
            if (this.state.filteredData && this.state.filteredData.length > 0) {
                console.log(`Using filteredData with ${this.state.filteredData.length} records`);
                
                // Store original rawFactBOMData reference
                const originalrawFactBOMData = this.state.rawFactBOMData;
                
                // Replace rawFactBOMData with filteredData
                this.state.rawFactBOMData = this.state.filteredData;
                
                // Process and render the pivot table
                this.processPivotData();
                this.renderPivotTable(elements);
                
                // Restore original rawFactBOMData
                this.state.rawFactBOMData = originalrawFactBOMData;
            } else {
                // Use all data
                console.log(`Using all rawFactBOMData (${this.state.rawFactBOMData?.length || 0} records)`);
                
                // Process and render the pivot table
                this.processPivotData();
                this.renderPivotTable(elements);
            }
            
            console.log("Pivot table generation complete");
        } catch (error) {
            console.error("Error generating pivot table:", error);
        }
    }
};

// Export the pivotTable object
export default pivotTable;