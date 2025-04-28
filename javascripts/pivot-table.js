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
    // Make handleExpandCollapseClick globally available
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
    calculateMeasure: function(records, rowDef, colDef, measureField) {
        console.log(`Calculating ${measureField} for row: ${rowDef ? rowDef.label : 'none'} (${rowDef ? rowDef._id : 'none'})`);
        
        // Start with all records
        let filteredRecords = [...records];
        
        // Filter by row definition if provided
        if (rowDef) {
            console.log(`Filtering by row: ${rowDef._id}, label: ${rowDef.label}`);
            
            // Special case for material_type
            if (rowDef._id && rowDef._id.startsWith('MATERIAL_TYPE_')) {
                filteredRecords = this.filterByMaterialType(filteredRecords, rowDef);
            } else {
                filteredRecords = this.filterByDimensionNode(filteredRecords, rowDef);
            }
            
            console.log(`After row filtering: ${filteredRecords.length} records`);
        }
        
        // Filter by column definition if provided
        if (colDef) {
            console.log(`Filtering by column: ${colDef._id}, label: ${colDef.label}`);
            
            // Special case for material_type
            if (colDef._id && colDef._id.startsWith('MATERIAL_TYPE_')) {
                filteredRecords = this.filterByMaterialType(filteredRecords, colDef);
            } else {
                filteredRecords = this.filterByDimensionNode(filteredRecords, colDef);
            }
            
            console.log(`After column filtering: ${filteredRecords.length} records`);
        }
        
        // Return 0 if no records match
        if (filteredRecords.length === 0) {
            console.log(`No records after filtering, returning 0`);
            return 0;
        }
        
        // Sum the measure values
        let result = 0;
        filteredRecords.forEach(record => {
            const value = parseFloat(record[measureField] || 0);
            if (!isNaN(value)) {
                result += value;
            }
        });
        
        console.log(`Calculated ${measureField} value: ${result}`);
        return result;
    },

    /**
     * Filter records based on dimension information
     * @param {Array} records - The records to filter
     * @param {Object} dimDef - The dimension definition (row or column)
     * @returns {Array} - Filtered records
     */
    filterRecordsByDimension: function(records, dimDef) {
        if (!dimDef) return records;
        
        // Start with all records
        let result = [...records];
        
        // For multi-dimension rows/columns
        if (dimDef.dimensions) {
            dimDef.dimensions.forEach(dimension => {
                result = this.filterByDimensionNode(result, dimension);
            });
            return result;
        }
        
        // For single dimension rows/columns
        return this.filterByDimensionNode(result, dimDef);
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

            case 'year':
                return this.filterByBusinessYear(records, node);

            case 'mc':
                return this.filterByMC(records, node);
                
            default:
                console.warn(`Unknown dimension: ${dimName}`);
                return records;
        }
    },


    /**
     * Filter records by Legal Entity
     */
    filterByLegalEntity: function(records, node) {
        if (!state.mappings || !state.mappings.legalEntity) return records;
        
        // Get the mapping
        const mapping = state.mappings.legalEntity;
        
        // For leaf nodes, filter by exact LE code
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.LE === node.factId);
        }
        
        // For hierarchy nodes, we need to find all LEs that fall under this path segment
        const nodePath = node.path ? node.path.join('/') : '';
        const nodeLabel = node.label || '';
        
        // Get all relevant LE codes
        const leCodes = new Set();
        
        // First try by path segments - any LE with this node in its path
        if (mapping.pathToLeCodes[nodeLabel]) {
            // Add all LE codes associated with this path segment
            mapping.pathToLeCodes[nodeLabel].forEach(leCode => leCodes.add(leCode));
        }
        
        // Find by checking if this node's label or path is contained in any LE paths
        if (leCodes.size === 0) {
            // Find all LEs that contain this node label in their path
            Object.entries(mapping.leToPaths).forEach(([leCode, path]) => {
                if (path.includes(nodeLabel)) {
                    leCodes.add(leCode);
                }
            });
        }
        
        // If we still don't have any LE codes but have a label, try direct matching
        if (leCodes.size === 0 && nodeLabel) {
            Object.keys(mapping.leToDetails).forEach(leCode => {
                const details = mapping.leToDetails[leCode];
                if (details.description === nodeLabel || leCode === nodeLabel) {
                    leCodes.add(leCode);
                }
            });
        }
        
        // Log what we found
        console.log(`Filtering by LE node ${nodeLabel}: Found ${leCodes.size} matching LE codes`);
        
        // If we found LE codes, filter the records
        if (leCodes.size > 0) {
            return records.filter(record => 
                record.LE && leCodes.has(record.LE)
            );
        }
        
        // If we didn't find any matching LE codes, just return the records as is
        console.warn(`No matching LE codes found for node ${nodeLabel}`);
        return records;
    },


    /**
     * Filter records by Cost Element
     */
    filterByCostElement: function(records, node) {
        if (!state.mappings || !state.mappings.costElement) return records;
        
        // Get the mapping
        const mapping = state.mappings.costElement;
        
        // For leaf nodes, filter by exact cost element
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.COST_ELEMENT === node.factId);
        }
        
        // For hierarchy nodes, use the nodeToCostElements mapping
        const costElements = mapping.nodeToCostElements[node.label];
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
        if (!state.mappings || !state.mappings.smartCode) return records;
        
        // Get the mapping
        const mapping = state.mappings.smartCode;
        
        // For leaf nodes, filter by exact smart code
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.ROOT_SMARTCODE === node.factId);
        }
        
        // For hierarchy nodes, use the nodeToSmartCodes mapping
        const smartCodes = mapping.nodeToSmartCodes[node.label];
        if (smartCodes && smartCodes.size > 0) {
            const codesArray = Array.from(smartCodes);
            return records.filter(record => codesArray.includes(record.ROOT_SMARTCODE));
        }
        
        return records;
    },


    filterByGmidDisplay: function(records, node) {
        console.log(`GMID Filtering for node: ${node._id}, label: ${node.label}`);
        console.log(`Node properties:`, JSON.stringify({
            id: node._id,
            label: node.label,
            level: node.level,
            levelValue: node.levelValue,
            factId: node.factId,
            path: node.path
        }));
        
        // For root node, return all records
        if (node._id === 'ROOT' || node.label === 'All GMIDs') {
            return records;
        }
        
        // For leaf nodes with factId, filter directly by COMPONENT_GMID
        if (node.factId) {
            console.log(`Filtering by factId: ${node.factId}`);
            
            if (Array.isArray(node.factId)) {
                // Handle multiple GMIDs case
                const factIdSet = new Set(node.factId);
                const result = records.filter(record => 
                    record.COMPONENT_GMID && factIdSet.has(record.COMPONENT_GMID));
                
                console.log(`Filtered by factId (array): ${result.length} records found from ${records.length}`);
                return result;
            } else {
                // Single GMID case
                const result = records.filter(record => 
                    record.COMPONENT_GMID === node.factId);
                
                console.log(`Filtered by factId (single): ${result.length} records found from ${records.length}`);
                return result;
            }
        }
        
        // For non-leaf nodes, filter by level and value in PATH_GMID
        if (node.levelValue) {
            const levelNum = node.level;
            console.log(`Filtering by levelValue: ${node.levelValue} at level ${levelNum}`);
            
            // Find all records where this node's levelValue matches a segment in PATH_GMID
            const result = records.filter(record => {
                if (!record.PATH_GMID) return false;
                
                const pathSegments = record.PATH_GMID.split('/');
                
                // If we have a specific level, check that position
                if (levelNum > 0 && levelNum <= pathSegments.length) {
                    return pathSegments[levelNum - 1] === node.levelValue;
                }
                
                // Otherwise check if it exists anywhere in the path
                return pathSegments.includes(node.levelValue);
            });
            
            console.log(`Filtered by levelValue: ${result.length} records found from ${records.length}`);
            return result;
        }
        
        // If we get here, try finding any descendants by using the path
        if (node.path) {
            console.log(`Attempting path-based filtering`);
            
            // Get path components
            const pathParts = node.path.filter(p => p !== 'ROOT');
            if (pathParts.length > 0) {
                // Extract level values from path IDs
                const pathValues = pathParts.map(p => {
                    const match = p.match(/LEVEL_\d+_(.+)/);
                    return match ? match[1].replace(/_/g, '-') : null;
                }).filter(Boolean);
                
                if (pathValues.length > 0) {
                    console.log(`Path values: ${pathValues.join(', ')}`);
                    
                    // Find records where PATH_GMID contains any of these values
                    const result = records.filter(record => {
                        if (!record.PATH_GMID) return false;
                        
                        const pathSegments = record.PATH_GMID.split('/');
                        return pathValues.some(value => 
                            pathSegments.includes(value));
                    });
                    
                    console.log(`Filtered by path: ${result.length} records found from ${records.length}`);
                    return result;
                }
            }
        }
        
        // If no criteria matched, log a warning and return all records
        console.warn(`No filtering criteria found for GMID node: ${node.label}`);
        return records;
    },


    /**
     * Filter records by Item Cost Type
     */
    filterByItemCostType: function(records, node) {
        // Skip filtering for root node
        if (node._id === 'ITEM_COST_TYPE_ROOT') {
            return records;
        }
        
        // Get the cost type - either from factId or directly from label
        const costType = node.factId || node.label;
        
        // Debug what we're doing
        console.log(`Filtering by ITEM_COST_TYPE: ${costType}, records before: ${records.length}`);
        
        // Direct equality filter on ITEM_COST_TYPE field
        const filtered = records.filter(record => record.ITEM_COST_TYPE === costType);
        
        console.log(`After filtering: ${filtered.length} records`);
        
        return filtered;
    },


    /**
     * Filter records by Material Type
     */
    filterByMaterialType: function(records, node) {
        // Safety check
        if (!records || records.length === 0) {
            console.log("No records to filter");
            return [];
        }
        
        if (!node) {
            console.error("No node provided for material type filtering");
            return records;
        }
        
        // If it's the root node, return all records
        if (node._id === 'MATERIAL_TYPE_ROOT') {
            console.log('Material Type Root node - no filtering');
            return records;
        }
        
        // Extract the material type code
        let materialTypeCode = null;
        
        if (node.materialTypeCode !== undefined) {
            materialTypeCode = node.materialTypeCode;
        } else if (node.factId !== undefined) {
            materialTypeCode = node.factId;
        } else if (node._id && node._id.startsWith('MATERIAL_TYPE_')) {
            const extractedCode = node._id.replace('MATERIAL_TYPE_', '');
            materialTypeCode = extractedCode === 'null' ? null : extractedCode;
        } else {
            console.error(`Cannot extract material type code from node:`, node);
            return records; // Return all records if we can't extract the code
        }
        
        console.log(`Filtering for material type '${materialTypeCode === null ? 'null' : materialTypeCode}', records before: ${records.length}`);
        
        // Simple equality filter
        const filtered = records.filter(record => {
            // Check both string and null equality
            if (materialTypeCode === null) {
                return record.COMPONENT_MATERIAL_TYPE === null || record.COMPONENT_MATERIAL_TYPE === 'null';
            } else {
                return record.COMPONENT_MATERIAL_TYPE === materialTypeCode;
            }
        });
        
        console.log(`After filtering: ${filtered.length} records for material type '${materialTypeCode === null ? 'null' : materialTypeCode}'`);
        
        return filtered;
    },


    /**
     * Filter records by MC
     */
    filterByMC: function(records, node) {
        if (!state.mappings || !state.mappings.managementCentre) return records;
        
        // Get the mapping
        const mapping = state.mappings.managementCentre;
        
        // For leaf nodes, filter by exact LE code
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.MC === node.factId);
        }
        
        // For hierarchy nodes, we need to find all LEs that fall under this path segment
        const nodePath = node.path ? node.path.join('/') : '';
        const nodeLabel = node.label || '';
        
        // Get all relevant LE codes
        const mcCodes = new Set();
        
        // First try by path segments - any LE with this node in its path
        if (mapping.pathToMcCodes[nodeLabel]) {
            // Add all LE codes associated with this path segment
            mapping.pathToMcCodes[nodeLabel].forEach(mcCode => mcCodes.add(mcCode));
        }
        
        // Find by checking if this node's label or path is contained in any LE paths
        if (mcCodes.size === 0) {
            // Find all LEs that contain this node label in their path
            Object.entries(mapping.mcToPaths).forEach(([mcCode, path]) => {
                if (path.includes(nodeLabel)) {
                    mcCodes.add(mcCode);
                }
            });
        }
        
        // If we still don't have any LE codes but have a label, try direct matching
        if (mcCodes.size === 0 && nodeLabel) {
            Object.keys(mapping.mcToDetails).forEach(mcCode => {
                const details = mapping.mcToDetails[mcCode];
                if (details.description === nodeLabel || mcCode === nodeLabel) {
                    mcCodes.add(mcCode);
                }
            });
        }
        
        // Log what we found
        console.log(`Filtering by MC node ${nodeLabel}: Found ${mcCodes.size} matching MC codes`);
        
        // If we found LE codes, filter the records
        if (mcCodes.size > 0) {
            return records.filter(record => 
                record.MC && mcCodes.has(record.MC)
            );
        }
        
        // If we didn't find any matching LE codes, just return the records as is
        console.warn(`No matching MC codes found for node ${nodeLabel}`);
        return records;
    },


    filterByBusinessYear: function(records, node) {
        if (!state.mappings || !state.mappings.year) return records;
        
        // Skip root nodes
        if(node._id === 'YEAR_ROOT'){
            return records;
        }

        // Get node value from the key or label
        const yearValue = node.factId || node.label;
        
        // Direct lookup of the pk to fk
        const filtered = records.filter(record => record.ZYEAR === yearValue);
        
        return filtered;
    },


    /**
     * Gets the corresponding fact table field name for a dimension
     * 
     * @param {string} dimName - Dimension name
     * @returns {string|null} - Corresponding fact table field name or null if not found
     */
    getFactIdField: function(dimName) {
        // Define mapping between dimension names and fact table field names
        const factIdFieldMap = {
            'legal_entity': 'LE',
            'cost_element': 'COST_ELEMENT',
            'gmid_display': 'COMPONENT_GMID',
            'smartcode': 'ROOT_SMARTCODE',
            'item_cost_type': 'ITEM_COST_TYPE',
            'material_type': 'COMPONENT_MATERIAL_TYPE',
            'year': 'ZYEAR',
            'zyear': 'ZYEAR',
            'mc': 'MC'
        };
        
        return factIdFieldMap[dimName.toLocaleLowerCase()] || null;
    },


    getVisibleLeafColumns: function(columns) {
        const visibleLeafs = [];
        
        const findVisibleLeafs = (column) => {
            if (!column) return;
            
            // Skip nodes marked to be hidden in UI
            if (column.skipInUI) return;
            
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


    // Additional helper to safely get an element from the DOM
    getElement:function(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },


    // Helper to show or hide loading indicator
    toggleLoading:function(show = true) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    },


    /**
     * Checks if a hierarchy node should be visible based on its ancestors' expansion state
     * 
     * @param {Object} row - The row definition object
     * @param {Array} allNodes - All nodes in the hierarchy
     * @returns {boolean} - Whether the node should be visible
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
        
        // For debugging, extract dimension name
        const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';
        
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
     * 
     * @param {Object} rowDef - The row definition object
     * @returns {string} - HTML for the row cell
     */
    renderRowCell: function(rowDef) {
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0; // 20px per level
        
        // Log for debugging
        console.log("Rendering row cell:", {
            id: rowDef._id,
            label: rowDef.label,
            hasChildren: rowDef.hasChildren,
            isLeaf: rowDef.isLeaf,
            expanded: rowDef.expanded
        });
        
        // Add cell with proper indentation and expand/collapse control
        let cellHtml = `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse control only if it has children
        // IMPORTANT: Ensure hasChildren is properly set
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
 * Renders hierarchical columns with proper expand/collapse controls
 * @param {Object} elements - DOM elements containing pivotTableHeader
 * @param {Object} pivotData - Pivot table data with columns structure
 */
 renderHierarchicalColumns: function(elements, pivotData) {
    if (!elements || !elements.pivotTableHeader) return;
    
    const valueFields = this.state.valueFields || ['COST_UNIT'];
    const columns = pivotData.columns;
    
    // Group columns by level for header rows, skipping nodes marked as skipInUI
    const columnsByLevel = {};
    let maxLevel = 0;
    let levelAdjustments = {}; // Track level adjustments due to skipped levels
    
    // First pass - identify which levels are completely skipped
    const skippedLevels = new Set();
    columns.forEach(col => {
        if (col.skipInUI) {
            skippedLevels.add(col.level);
        }
    });
    
    // Create a mapping to adjust levels for rendering
    let adjustment = 0;
    for (let i = 0; i <= Math.max(...columns.map(c => c.level)); i++) {
        if (skippedLevels.has(i)) {
            adjustment++;
        }
        levelAdjustments[i] = adjustment;
    }
    
    // Second pass - group columns by adjusted level
    columns.forEach(col => {
        // Skip nodes marked for UI hiding
        if (col.skipInUI) return;
        
        // Adjust the level by subtracting the number of skipped levels before this one
        const adjustedLevel = col.level - levelAdjustments[col.level];
        
        columnsByLevel[adjustedLevel] = columnsByLevel[adjustedLevel] || [];
        columnsByLevel[adjustedLevel].push(col);
        maxLevel = Math.max(maxLevel, adjustedLevel);
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
                        onclick="window.handleExpandCollapseClick(event)"
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
        
        // Get leaf columns - modified to skip nodes marked for UI hiding
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
},

    renderPivotTable: function(elements, useMultiDimension = false) {
        console.log("Rendering pivot table with data:", this.state.pivotData);
        
        // Validate elements parameter
        if (!elements || !elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Invalid elements provided to renderPivotTable");
            // Try to get elements directly if not provided correctly
            elements = {
                pivotTableHeader: document.getElementById('pivotTableHeader'),
                pivotTableBody: document.getElementById('pivotTableBody')
            };
            
            // Still not found? Use fallback
            if (!elements.pivotTableHeader || !elements.pivotTableBody) {
                console.error("Cannot find pivot table DOM elements, using fallback rendering");
                // this.forceCreatePivotTable();
                return;
            }
        }
        
        const pivotData = this.state.pivotData;
    
        // Check if we have valid data
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("No valid pivot data available for rendering");
            // this.forceCreatePivotTable();
            return;
        }
    
        // console.log(`Pivot-Table Active Data: ${pivotData.data?.length || 0} rows`);
    
        // Continue with the standard table rendering
        this.renderStandardTable(elements, useMultiDimension);
    },


    renderTableBody: function(elements, useMultiDimension) {
        console.log("Rendering table body with hierarchy structure");
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
            // setTimeout(() => {
            //     const controls = elements.pivotTableBody.querySelectorAll('.expand-collapse');
            //     controls.forEach(control => {
            //         control.addEventListener('click', (e) => {
            //             const nodeId = e.target.getAttribute('data-node-id');
            //             const hierarchyName = e.target.getAttribute('data-hierarchy');
            //             const zone = e.target.getAttribute('data-zone') || 'row';
                        
            //             console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
                        
            //             // Toggle class for immediate visual feedback
            //             e.target.classList.toggle('expanded');
            //             e.target.classList.toggle('collapsed');
                        
            //             // Call the actual handler with a small delay to prevent too many refreshes
            //             if (window.handleExpandCollapseClick) {
            //                 window.handleExpandCollapseClick(e);
            //             }
            //         });
            //     });
            // }, 100);
        } else {
            console.error("Cannot set table body HTML - element not found");
        }
    },


    setupGlobalHandlers: function() {
        // Explicitly make the function available on the window object
        window.handleExpandCollapseClick = function(e) {
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
            if (window.App && window.App.pivotTable && window.App.pivotTable.generatePivotTable) {
                window.App.pivotTable.generatePivotTable();
            } else if (window.refreshPivotTable) {
                window.refreshPivotTable();
            }
            
            // Prevent event from bubbling up
            e.stopPropagation();
        };
        
        // Also make the generatePivotTable function globally accessible
        if (this.generatePivotTable) {
            window.generatePivotTable = this.generatePivotTable.bind(this);
        }
    },


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
        // Debug the entire row data
        console.log(`Row data for ${rowDef.label}:`, dataRow);
        
        let rowHtml = `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
        
        // Row header cells
        if (useMultiDimension) {
            rowHtml += data.renderMultiDimensionRowCells(rowDef);
        } else {
            rowHtml += this.renderRowCell(rowDef);
        }
        
        // Data cells
        if (validColumns.length > 0) {
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


    processPivotData: function() {
        if (!this.state.factData || this.state.factData.length === 0) {
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
            // Find a dimension field and use it for rows
            // const firstDim = this.state.availableFields.find(f => f.type === 'dimension');
            // if (firstDim) rowFields = [firstDim.id];
        }
        
        if (valueFields.length === 0) {
            console.warn("No value fields selected, defaulting to COST_UNIT");
            // valueFields = ['COST_UNIT'];
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
        
        // Calculate the values for each cell using our improved functions
        this.calculatePivotCells();
    },


    calculatePivotCells: function() {
        const pivotData = this.state.pivotData;
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];
        
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }
        
        console.log('Calculating pivot cells for rows:', pivotData.rows.map(r => ({
            id:r._id,
            label: r.label,
            factId: r.factId,
            field: r.hierarchyField
        })))

        console.log(`Calculating pivot cells with ${factData.length} fact records`);
        
        // For each row
        pivotData.rows.forEach(rowDef => {
            // Create a data object for this row
            const rowData = { _id: rowDef._id };
            
            // console.log(`Processing row: ${rowDef.label} (${rowDef._id})`);
            
            // For each column
            pivotData.columns.forEach(colDef => {
                // For each value field
                valueFields.forEach(fieldId => {
                    // Calculate the aggregate value for this cell
                    const value = this.calculateMeasure(factData, rowDef, colDef, fieldId);
                    
                    // Verify the value is numeric and convert if needed
                    let finalValue = value;
                    if (typeof finalValue !== 'number') {
                        const converted = parseFloat(finalValue);
                        if (!isNaN(converted)) {
                            finalValue = converted;
                            // console.log(`Converted ${fieldId} value from ${typeof value} to number: ${finalValue}`);
                        }
                    }
                    
                    // Store the value in the row data object with proper key
                    const key = colDef._id === 'default' ? fieldId : `${colDef._id}|${fieldId}`;
                    rowData[key] = finalValue;
                });
            });
            
            // Add the row data to the pivot data
            pivotData.data.push(rowData);
            // console.log(`Added row data for ${rowDef.label}:`, rowData);
        });
    },


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
     * Gets all leaf descendants of a node recursively
     * 
     * @param {Object} node - The root node to start from
     * @param {Array} result - Array to collect leaf nodes (for recursion)
     * @returns {Array} - Array of all leaf descendant nodes
     */
    getAllLeafDescendants(node, result = []) {
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
   

    generatePivotTable: function(elements) {
        console.log("Starting pivot table generation...");
        
        // Get DOM elements if not provided
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
            // Check if we have filtered data to use
            const useFilteredData = state.filteredData && state.filteredData.length > 0;
            const dataToUse = useFilteredData ? state.filteredData : state.factData;
            
            if (useFilteredData) {
                console.log(`Using filtered data: ${state.filteredData.length} of ${state.factData.length} records`);
            } else {
                console.log(`Using original data: ${state.factData.length} records`);
            }
            
            // Store original factData reference if we're using filtered data
            let originalFactData;
            if (useFilteredData) {
                originalFactData = state.factData;
                state.factData = state.filteredData; // Temporarily replace with filtered data
            }
            
            // Process the data for the pivot table
            this.processPivotData();
            
            // Render the pivot table
            this.renderPivotTable(elements);
            
            // Restore original factData if we used filtered data
            if (useFilteredData) {
                state.factData = originalFactData;
            }
            
            console.log("Pivot table generation complete");
            
        } catch (error) {
            console.error("Error in pivot table generation:", error);
            
            // If we replaced factData, make sure to restore it
            if (state.filteredData && state.factData === state.filteredData) {
                state.factData = state.originalFactData;
            }
        }
    },
};


// Export the pivotTable object
export default pivotTable;