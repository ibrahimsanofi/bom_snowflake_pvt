// This module centralizes the essential logic of pivot table functionality
// Enhanced with functionality from old implementation

import data from './data.js';
import stateModule from './state.js';
import multiDimensionPivotHandler from './pivotTableMultiDimensionsHandler.js';
import columnHierarchyHandler from './columnHierarchyHandler.js';

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
        
        // Initialize column expansion states
        this.initializeColumnExpansionStates();
        
        console.log("Pivot table system initialized with enhanced functionality");
    },
    
    
    /**
     * Set up global event handlers
     */
    setupGlobalHandlers: function() {
        // Make handleExpandCollapseClick globally available
        window.handleExpandCollapseClick = this.handleExpandCollapseClick.bind(this);
        
        // Make generatePivotTable globally available
        window.generatePivotTable = this.generatePivotTable.bind(this);
        
        // Make handleMultiDimensionExpandCollapseClick globally available
        window.handleMultiDimensionExpandCollapseClick = 
            multiDimensionPivotHandler.handleMultiDimensionExpandCollapseClick;
        
        // Make refreshPivotTable globally available
        window.refreshPivotTable = this.generatePivotTable.bind(this);
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
        const state = window.App?.state || this.state;
        
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
        
        // Also update the node's expanded property directly for proper rendering
        node.expanded = state.expandedNodes[hierarchyName][zone][nodeId];
        
        console.log(`Node ${nodeId} expansion set to: ${node.expanded}`);
        
        // Update the visual state of the expand/collapse icon
        e.target.classList.toggle('expanded');
        e.target.classList.toggle('collapsed');
        
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
        // Handle multi-dimension rows with special filter handling
        if (rowDef && rowDef.dimensions && Array.isArray(rowDef.dimensions)) {
            // Use the multi-dimension filter handler
            return this.calculateMeasureMultiDim(records, rowDef, colDef, measureField);
        }
        
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
     * Calculate measure values for multi-dimensional pivot table cells
     */
    calculateMeasureMultiDim: function(records, rowDef, colDef, measureField) {
        // Use the multi-dimension filter handler
        let filteredRecords = multiDimensionPivotHandler.filterDataByMultipleDimensions(records, rowDef);
        
        // Apply column filtering if provided
        if (colDef) {
            filteredRecords = this.filterByDimensionNode(filteredRecords, colDef);
        }
        
        // Return 0 if no records match
        if (filteredRecords.length === 0) {
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
                
            case 'time':
                // Add special case handling for time hierarchy from old implementation
                return this.filterByTime(records, node);

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
        // For root node, return all records
        if (node._id === 'ROOT' || node.label === 'All GMIDs') {
            return records;
        }
        
        // For leaf nodes with factId, filter directly by COMPONENT_GMID
        if (node.factId) {
            // console.log(`Filtering by factId: ${node.factId}`);
            
            if (Array.isArray(node.factId)) {
                // Handle multiple GMIDs case
                const factIdSet = new Set(node.factId);
                const result = records.filter(record => 
                    record.COMPONENT_GMID && factIdSet.has(record.COMPONENT_GMID));
                
                // console.log(`Filtered by factId (array): ${result.length} records found from ${records.length}`);
                return result;
            } else {
                // Single GMID case
                const result = records.filter(record => 
                    record.COMPONENT_GMID === node.factId);
                
                // console.log(`Filtered by factId (single): ${result.length} records found from ${records.length}`);
                return result;
            }
        }
        
        // For non-leaf nodes, filter by level and value in PATH_GMID
        if (node.levelValue) {
            const levelNum = node.level;
            // console.log(`Filtering by levelValue: ${node.levelValue} at level ${levelNum}`);
            
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
            
            // console.log(`Filtered by levelValue: ${result.length} records found from ${records.length}`);
            return result;
        }
        
        // If we get here, try finding any descendants by using the path
        if (node.path) {
            // console.log(`Attempting path-based filtering`);
            
            // Get path components
            const pathParts = node.path.filter(p => p !== 'ROOT');
            if (pathParts.length > 0) {
                // Extract level values from path IDs
                const pathValues = pathParts.map(p => {
                    const match = p.match(/LEVEL_\d+_(.+)/);
                    return match ? match[1].replace(/_/g, '-') : null;
                }).filter(Boolean);
                
                if (pathValues.length > 0) {
                    // console.log(`Path values: ${pathValues.join(', ')}`);
                    
                    // Find records where PATH_GMID contains any of these values
                    const result = records.filter(record => {
                        if (!record.PATH_GMID) return false;
                        
                        const pathSegments = record.PATH_GMID.split('/');
                        return pathValues.some(value => 
                            pathSegments.includes(value));
                    });
                    
                    // console.log(`Filtered by path: ${result.length} records found from ${records.length}`);
                    return result;
                }
            }
        }
        
        // If no criteria matched, log a warning and return all records
        // console.warn(`No filtering criteria found for GMID node: ${node.label}`);
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
            'le': 'LE',
            'cost_element': 'COST_ELEMENT',
            'gmid_display': 'COMPONENT_GMID',
            'smartcode': 'ROOT_SMARTCODE',
            'item_cost_type': 'ITEM_COST_TYPE',
            'material_type': 'COMPONENT_MATERIAL_TYPE',
            'year': 'ZYEAR',
            'mc': 'MC'
        };
        
        return factIdFieldMap[dimName.toLowerCase()] || null;
    },


   /**
     * Helper function to get all visible leaf columns
     * This gets columns that should show values (leaf nodes and collapsed parents)
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
        
        const findVisibleLeafs = (column) => {
            if (!column) return;
            
            // Skip nodes marked to be hidden in UI
            if (column.skipInUI) return;
            
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
                        findVisibleLeafs(childNode);
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
                    findVisibleLeafs(childNode);
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
     * Helper function to count leaf nodes under a node
     * This is used to calculate column spans
     */
    countLeafNodes: function(node) {
        if (!node) return 0;
    
        // If node is a leaf, it counts as one
        if (node.isLeaf) return 1;
        
        // If node is collapsed, treat it as one leaf for display purposes
        if (!node.expanded) return 1;
        
        // If node has no children, count as one
        if (!node.children || node.children.length === 0) return 1;
        
        // For expanded parents, count leaves in all child branches
        let count = 0;
        
        // Process each child
        node.children.forEach(childId => {
            const childNode = this.getChildNode(node, childId);
            if (childNode) {
                count += this.countLeafNodes(childNode);
            }
        });
        
        // Ensure we always return at least 1
        return Math.max(1, count);
    },

    
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
     * Helper to get a child node from either ID or object reference
     */
    getChildNode: function(parentNode, childId) {
        if (typeof childId !== 'string') {
            // It's already a node object
            return childId;
        }
        
        // It's a string ID, look up in the appropriate hierarchy
        const dimName = parentNode.hierarchyField ? 
                        parentNode.hierarchyField.replace('DIM_', '').toLowerCase() : 
                        parentNode.hierarchyName;
        
        const hierarchy = this.state.hierarchies[dimName];
        return hierarchy && hierarchy.nodesMap ? hierarchy.nodesMap[childId] : null;
    },


    /**
     * Initialize the column expansion state
     * This sets the root nodes to collapsed by default
     */
    initializeColumnExpansionStates: function() {
        // Get dimensions that might go into column zone
        const dimNames = ['le', 'year', 'smartcode', 'mc', 'cost_element', 'item_cost_type', 'material_type', 'year'];
        
        dimNames.forEach(dimName => {
            // Initialize hierarchy expansion state
            this.state.expandedNodes = this.state.expandedNodes || {};
            this.state.expandedNodes[dimName] = this.state.expandedNodes[dimName] || {};
            this.state.expandedNodes[dimName].column = this.state.expandedNodes[dimName].column || {};
            
            // Get the hierarchy
            const hierarchy = this.state.hierarchies[dimName];
            if (!hierarchy || !hierarchy.root) return;
            
            // Set root to collapsed by default in column zone
            const rootId = hierarchy.root.id || 'ROOT';
            this.state.expandedNodes[dimName].column[rootId] = false;
            
            // Update the node's column-specific expanded property
            if (hierarchy.root) {
                hierarchy.root.columnExpanded = false;
                hierarchy.root.expanded = false; // Also set the main expanded property
            }
        });
    },


    /**
     * Checks if a hierarchy node should be visible based on its ancestors' expansion state
     * 
     * @param {Object} row - The row definition object
     * @param {Array} allNodes - All nodes in the hierarchy
     * @returns {boolean} - Whether the node should be visible
     */
    isNodeVisible: function(row, allNodes) {
        // Handle multi-dimension rows with special visibility check
        if (row && row.dimensions && Array.isArray(row.dimensions)) {
            return multiDimensionPivotHandler.isMultiDimensionRowVisible(row, allNodes);
        }
        
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
        // Handle multi-dimension rows with special renderer
        if (rowDef && rowDef.dimensions && Array.isArray(rowDef.dimensions)) {
            return multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
        }
        
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const level = rowDef.level || 0;
        
        // Add cell with data-level attribute for CSS styling to handle indentation
        let cellHtml = `<td class="hierarchy-cell" data-level="${level}">`;
        
        // Add expand/collapse control only if it has children
        if (rowDef.hasChildren === true) {
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
     * Renders hierarchical columns with proper expand/collapse controls
     * @param {Object} elements - DOM elements containing pivotTableHeader
     * @param {Object} pivotData - Pivot table data with columns structure
     */
    renderHierarchicalColumns: function(elements, pivotData) {
        // Safety checks
        if (!elements || !elements.pivotTableHeader) {
            console.error("Missing header element");
            return;
        }
        
        try {
            // Clear header
            elements.pivotTableHeader.innerHTML = '';
            
            // Get available measures
            const valueFields = this.state?.valueFields || ['COST_UNIT'];
            
            // Create a single header row
            const headerRow = document.createElement('tr');
            headerRow.className = 'measure-header-row';
            
            // Add corner cell
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            headerRow.appendChild(cornerCell);
            
            // Add measure headers - one for each measure
            for (let i = 0; i < valueFields.length; i++) {
                const measureCell = document.createElement('th');
                measureCell.className = 'measure-header';
                
                // Format display name
                let displayName = valueFields[i];
                if (displayName === 'COST_UNIT') displayName = 'Cost Unit';
                else if (displayName === 'QTY_UNIT') displayName = 'Quantity Unit';
                
                measureCell.textContent = displayName;
                headerRow.appendChild(measureCell);
            }
            
            // Add row to header
            elements.pivotTableHeader.appendChild(headerRow);
            
            console.log("Single row measure headers rendered");
            
        } catch (error) {
            console.error("Error rendering column headers:", error);
            // Fall back to basic rendering
            this.renderBasicColumnHeaders(elements, pivotData);
        }
    },


    /**
     * Fallback to render basic column headers
     */
    renderBasicColumnHeaders: function(elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) return;
        
        try {
            // Clear existing content
            elements.pivotTableHeader.innerHTML = '';
            
            // Create simple two-row structure
            const measureRow = document.createElement('tr');
            measureRow.className = 'measure-header-row';
            
            const columnRow = document.createElement('tr');
            columnRow.className = 'column-header-row';
            
            // Add corner cell
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            cornerCell.rowSpan = 2;
            measureRow.appendChild(cornerCell);
            
            // Add measure header
            const measureCell = document.createElement('th');
            measureCell.className = 'measure-header';
            const valueFields = this.state?.valueFields || ['COST_UNIT'];
            measureCell.textContent = valueFields[0] === 'COST_UNIT' ? 'Cost Unit' : 
                                valueFields[0] === 'QTY_UNIT' ? 'Quantity Unit' : valueFields[0];
            measureCell.colSpan = pivotData.columns.length || 1;
            measureRow.appendChild(measureCell);
            
            // Add basic column headers
            pivotData.columns.forEach(col => {
                const cell = document.createElement('th');
                cell.className = 'column-header';
                cell.textContent = col.label || '';
                columnRow.appendChild(cell);
            });
            
            // Add rows to header
            elements.pivotTableHeader.appendChild(measureRow);
            elements.pivotTableHeader.appendChild(columnRow);
            
            console.log("Basic column headers rendered as fallback");
        } catch (error) {
            console.error("Error in fallback column rendering:", error);
        }
    },


    /**
     * Process column hierarchy recursively
     */
    processColumnHierarchy: function(columns, headerRows, level, parentColspan = 0) {
        if (!columns || columns.length === 0 || !headerRows || level >= headerRows.length) {
            return 0;
        }
        
        let totalColspan = 0;
        const currentRow = headerRows[level];
        
        // Process each column at this level
        columns.forEach(column => {
            // Skip if undefined or null
            if (!column) return;
            
            // Create column header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            if (column.children && column.children.length > 0) {
                cell.classList.add('parent-column');
            }
            
            // Set data attributes for styling
            cell.setAttribute('data-node-id', column._id || '');
            cell.setAttribute('data-level', level);
            
            // Add hierarchy metadata if available
            if (column.hierarchyField) {
                const dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                cell.setAttribute('data-hierarchy', dimName);
            } else if (column.hierarchyName) {
                cell.setAttribute('data-hierarchy', column.hierarchyName);
            }
            
            // Check if column is expanded
            const isExpanded = column.expanded || column.columnExpanded;
            
            // Calculate colspan based on visible descendants
            let colspan = 1;
            
            // If it has children and is expanded, process them
            if (column.children && column.children.length > 0 && isExpanded) {
                // Get child nodes (convert string IDs to objects)
                const childNodes = column.children.map(childId => {
                    if (typeof childId === 'string') {
                        // Look up in hierarchies
                        const dimName = column.hierarchyField ? 
                            column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                            column.hierarchyName;
                        
                        return this.state.hierarchies?.[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean); // Remove nulls
                
                // Process children at next level
                colspan = this.processColumnHierarchy(childNodes, headerRows, level + 1);
                
                // If no children were processed, ensure at least 1
                colspan = Math.max(1, colspan);
                
            } else if (column.children && column.children.length > 0) {
                // Has children but collapsed - count visible leaf nodes
                colspan = this.countVisibleLeafColumns([column]);
                
                // If column is a leaf or collapsed parent, set rowspan
                const remainingLevels = headerRows.length - level;
                if (remainingLevels > 1) {
                    cell.rowSpan = remainingLevels;
                }
            } else {
                // Leaf node - span to bottom
                const remainingLevels = headerRows.length - level;
                if (remainingLevels > 1) {
                    cell.rowSpan = remainingLevels;
                }
            }
            
            // Set colspan
            if (colspan > 1) {
                cell.colSpan = colspan;
            }
            
            // Add expand/collapse control if it has children
            if (column.children && column.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = isExpanded ? 'expand-collapse expanded' : 'expand-collapse collapsed';
                
                // Set data attributes
                expandControl.setAttribute('data-node-id', column._id || '');
                
                const dimName = column.hierarchyField ? 
                    column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                    column.hierarchyName || '';
                
                expandControl.setAttribute('data-hierarchy', dimName);
                expandControl.setAttribute('data-zone', 'column');
                
                // Add click handler
                expandControl.setAttribute('onclick', 'window.handleExpandCollapseClick(event)');
                
                cell.appendChild(expandControl);
            }
            
            // Add label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'column-label';
            labelSpan.textContent = column.label || '';
            cell.appendChild(labelSpan);
            
            // Add cell to row
            currentRow.appendChild(cell);
            
            // Update total colspan
            totalColspan += colspan;
        });
        
        return totalColspan;
    },


    /**
     * Count total visible leaf columns
     * @param {Array} columns - Column array
     * @returns {Number} - Count of visible leaf columns
     */
    countVisibleLeafColumns: function(columns) {
        let count = 0;
        
        columns.forEach(column => {
            count += this.countLeafNodes(column);
        });
        
        return Math.max(1, count); // At least 1
    },


    /**
     * Recursively renders column hierarchy
     * @param {Array} columns - Columns to render
     * @param {Array} headerRows - Header rows by level
     * @param {Number} level - Current level in hierarchy
     */
    renderColumnHierarchy: function(columns, headerRows, level, parentId) {
        if (!columns || columns.length === 0 || !headerRows || level >= headerRows.length) {
            return;
        }
        
        // Current row for this level
        const currentRow = headerRows[level];
        
        // Process each column at this level
        columns.forEach(column => {
            // Create column header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            
            // Add cell classification
            if (column.isLeaf) cell.classList.add('leaf-node');
            if (column.children && column.children.length > 0) cell.classList.add('has-children');
            
            // Apply data attributes for styling and behavior
            cell.setAttribute('data-node-id', column._id);
            cell.setAttribute('data-level', level);
            
            // Track parent-child relationship
            if (parentId) {
                cell.setAttribute('data-parent-id', parentId);
            }
            
            // Add dimension info if available
            if (column.hierarchyField) {
                const dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                cell.setAttribute('data-hierarchy', dimName);
            } else if (column.hierarchyName) {
                cell.setAttribute('data-hierarchy', column.hierarchyName);
            }
            
            // Calculate colspan - how many leaf nodes underneath
            let colspan = this.countLeafNodes(column);
            if (colspan > 1) {
                cell.colSpan = colspan;
            }
            
            // Calculate rowspan for leaf or collapsed nodes
            if (column.isLeaf || !column.expanded || !column.children || column.children.length === 0) {
                const remainingRows = headerRows.length - level;
                if (remainingRows > 1) {
                    cell.rowSpan = remainingRows;
                }
            }
            
            // Add expand/collapse control if column has children
            if (column.children && column.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = `expand-collapse ${column.expanded ? 'expanded' : 'collapsed'}`;
                expandControl.setAttribute('data-node-id', column._id);
                
                // Get dimension name
                let dimName = '';
                if (column.hierarchyField) {
                    dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                } else if (column.hierarchyName) {
                    dimName = column.hierarchyName;
                }
                
                expandControl.setAttribute('data-hierarchy', dimName);
                expandControl.setAttribute('data-zone', 'column');
                
                // Add click handler via a data attribute for event delegation
                expandControl.setAttribute('onclick', 'window.handleExpandCollapseClick(event)');
                
                cell.appendChild(expandControl);
            }
            
            // Add column label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'column-label';
            labelSpan.textContent = column.label || '';
            cell.appendChild(labelSpan);
            
            // Add cell to current row
            currentRow.appendChild(cell);
            
            // Process children if expanded
            if (column.expanded && column.children && column.children.length > 0) {
                // Get actual child nodes
                const childNodes = column.children.map(childId => {
                    if (typeof childId === 'string') {
                        // Get dimension name
                        let dimName = '';
                        if (column.hierarchyField) {
                            dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                        } else if (column.hierarchyName) {
                            dimName = column.hierarchyName;
                        }
                        
                        // Look up in hierarchies
                        return this.state.hierarchies?.[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean); // Remove nulls/undefined
                
                // Recursively render children at next level
                this.renderColumnHierarchy(childNodes, headerRows, level + 1, column._id);
            }
        });
    },


    /**
     * Helper function to get child leaf count from root node
     * @param {Object} rootNode - The root node
     * @param {Array} availableColumns - All available columns
     * @returns {number} - Count of leaf nodes under root
     */
    getChildLeafCount(rootNode, availableColumns) {
        if (!rootNode || !rootNode.children || !rootNode.expanded) return 1;
        
        let count = 0;
        
        // Process direct children of the root node
        const childIds = Array.isArray(rootNode.children) ? rootNode.children : [];
        
        // For each child ID, find the actual node and count its leaves
        childIds.forEach(childId => {
            let childNode;
            
            if (typeof childId === 'string') {
                // Look up node by ID in hierarchies
                const dimName = rootNode.hierarchyField ? 
                    rootNode.hierarchyField.replace('DIM_', '').toLowerCase() : 
                    rootNode.hierarchyName;
                    
                childNode = this.state.hierarchies[dimName]?.nodesMap?.[childId];
                
                // If not found in hierarchies, try to find in available columns
                if (!childNode) {
                    childNode = availableColumns.find(col => col._id === childId);
                }
            } else {
                // Already a node object
                childNode = childId;
            }
            
            // Count leaves under this child
            if (childNode) {
                count += this.countLeafNodes(childNode);
            }
        });
        
        return Math.max(1, count);
    },


    /**
     * Count total leaf columns across all root level columns
     */
    countTotalLeafColumns:function(rootColumns) {
        // Find root node
        const rootNode = rootColumns.find(col => 
            col.label === 'All Items' || 
            col.label === 'All Item Cost Types' || 
            col.label === 'All Material Types' ||
            col._id === 'ROOT' || 
            col.isRootNode);
        
        if (rootNode) {
            // If root node exists and is expanded, count its children
            if (rootNode.expanded && rootNode.children && rootNode.children.length > 0) {
                // Get child nodes
                const childNodes = rootNode.children.map(childId => {
                    if (typeof childId === 'string') {
                        const dimName = rootNode.hierarchyField 
                            ? rootNode.hierarchyField.replace('DIM_', '').toLowerCase() 
                            : rootNode.hierarchyName;
                        return this.state.hierarchies[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean);
                
                // Calculate total leaves from all children
                let totalChildLeaves = 0;
                childNodes.forEach(childNode => {
                    if (childNode.expanded && childNode.hasChildren) {
                        totalChildLeaves += this.countLeafNodes(childNode);
                    } else {
                        totalChildLeaves += 1;
                    }
                });
                
                return totalChildLeaves;
            } else {
                // Root node exists but not expanded - counts as 1
                return 1;
            }
        } else {
            // No root node, count all columns individually
            let totalLeaves = 0;
            rootColumns.forEach(col => {
                if (col.isLeaf || !col.expanded) {
                    totalLeaves += 1;
                } else {
                    totalLeaves += this.countLeafNodes(col);
                }
            });
            
            return Math.max(1, totalLeaves);
        }
    },


    renderPivotTable: function(elements, useMultiDimension = false) {        
        console.log("Rendering standard pivot table with data:", this.state.pivotData);
        
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
                return;
            }
        }
        
        const pivotData = this.state.pivotData;

        // Check if we have valid data
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("No valid pivot data available for rendering");
            return;
        }

        // Continue with the standard table rendering
        this.renderStandardTable(elements, useMultiDimension);
    },


    /**
     * Update the renderTableBody function to properly handle column hierarchies
     */    
    renderTableBody: function(elements, useMultiDimension) {
        console.log("Rendering table body with hierarchy structure");
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        // Get the visible rows
        const rows = this.getVisibleRows(pivotData.rows, useMultiDimension);
        
        // Get value fields
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        let bodyHtml = '';
        
        // Render each row
        rows.forEach((rowDef, index) => {
            const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
            const rowClass = index % 2 === 0 ? 'even' : 'odd';
            
            // Start row
            bodyHtml += `<tr class="${rowClass}">`;
            
            // Hierarchy cell with proper indentation and expand/collapse controls
            if (useMultiDimension) {
                bodyHtml += multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
            } else {
                bodyHtml += this.renderRowCell(rowDef);
            }
            
            // Render a cell for each measure
            valueFields.forEach(fieldId => {
                // Get the value from row data directly
                let value = rowData[fieldId] !== undefined ? rowData[fieldId] : 0;
                
                // Render the value cell
                bodyHtml += this.renderValueCell(value);
            });
            
            // End row
            bodyHtml += '</tr>';
        });
        
        // Set the HTML content
        if (elements && elements.pivotTableBody) {
            elements.pivotTableBody.innerHTML = bodyHtml;
            console.log(`Rendered table body with ${rows.length} rows and ${valueFields.length} measures`);
        } else {
            console.error("Cannot set table body HTML - element not found");
        }
    },


    /**
     * Get visible rows based on hierarchy expansion state
     */
    getVisibleRows: function(rows, useMultiDimension = false) {
        if (useMultiDimension) {
            // Use multi-dimension visibility check
            return rows.filter(row => 
                multiDimensionPivotHandler.isMultiDimensionRowVisible(row, rows));
        } else {
            // Use standard visibility check
            return rows.filter(row => this.isNodeVisible(row, rows));
        }
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


    /**
     * Enhanced value cell renderer with improved styling
     * @param {any} value - Cell value
     * @param {string} additionalClass - Optional additional CSS class
     * @returns {string} - HTML for the cell
     */
    renderValueCell: function(value, additionalClass = '') {
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
        if (additionalClass) cellClass += ' ' + additionalClass;
        
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
        } else {
            cellClass += ' zero-value'; // Special class for zero values
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
            rowHtml += multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
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
        }
        
        if (valueFields.length === 0) {
            console.warn("No value fields selected, defaulting to COST_UNIT");
        }
        
        // Detect if we need multi-dimension row processing
        const useMultiDimension = rowFields.length > 1;
        
        // Process the row fields - use appropriate handler based on dimension count
        const rowData = useMultiDimension 
            ? multiDimensionPivotHandler.processMultiDimensionRows(rowFields)
            : data.processHierarchicalFields(rowFields, 'row');
        
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
            data: [], // Will be populated with cell values
            useMultiDimension: useMultiDimension // Store multi-dimension flag
        };
        
        // Calculate the values for each cell using our improved functions
        this.calculatePivotCells();
    },


    /**
     * Calculates pivot cells properly accounting for hierarchical columns
     */
    calculatePivotCells: function() {
        const pivotData = this.state.pivotData;
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];
        const useMultiDimension = pivotData.useMultiDimension;
        
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }
        
        console.log(`Calculating pivot cells with ${factData.length} fact records`);
        
        // Find the root node if it exists
        const rootNode = pivotData.columns.find(col => 
            col.label === 'All Items' || 
            col.label === 'All Item Cost Types' || 
            col._id === 'ROOT' || 
            col.isRootNode);
        
        // For each row
        pivotData.rows.forEach(rowDef => {
            // Create a data object for this row
            const rowData = { _id: rowDef._id };
            
            // First calculate row total for each value field (independent of column)
            valueFields.forEach(fieldId => {
                // Use only row filtering for total - consider multi-dimension rows
                const totalValue = useMultiDimension
                    ? this.calculateMeasureMultiDim(factData, rowDef, null, fieldId)
                    : this.calculateMeasure(factData, rowDef, null, fieldId);
                    
                rowData[fieldId] = totalValue;
            });
            
            // For each column
            pivotData.columns.forEach(colDef => {
                // If this is the root node, handle it specially
                if (colDef === rootNode) {
                    // For root node, calculate values using it as a filter
                    valueFields.forEach(fieldId => {
                        const value = useMultiDimension
                            ? this.calculateMeasureMultiDim(factData, rowDef, colDef, fieldId)
                            : this.calculateMeasure(factData, rowDef, colDef, fieldId);
                            
                        const key = `${colDef._id}|${fieldId}`;
                        rowData[key] = value;
                    });
                    return;
                }
                
                // For normal columns, proceed as usual
                valueFields.forEach(fieldId => {
                    // Calculate the aggregate value for this cell
                    const value = useMultiDimension
                        ? this.calculateMeasureMultiDim(factData, rowDef, colDef, fieldId)
                        : this.calculateMeasure(factData, rowDef, colDef, fieldId);
                        
                    // Store the value in the row data object with proper key
                    const key = `${colDef._id}|${fieldId}`;
                    rowData[key] = value;
                });
            });
            
            // Add the row data to the pivot data
            pivotData.data.push(rowData);
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
            // Debug state before processing
            // this.debugPivotTableState();
            
            // Check if we have filtered data to use
            const useFilteredData = this.state.filteredData && this.state.filteredData.length > 0;
            const dataToUse = useFilteredData ? this.state.filteredData : this.state.factData;
            
            if (useFilteredData) {
                console.log(`Using filtered data: ${this.state.filteredData.length} of ${this.state.factData.length} records`);
            } else {
                console.log(`Using original data: ${this.state.factData.length} records`);
            }
            
            // Store original factData reference if we're using filtered data
            let originalFactData;
            if (useFilteredData) {
                originalFactData = this.state.factData;
                this.state.factData = this.state.filteredData; // Temporarily replace with filtered data
            }
            
            // Process the data for the pivot table
            this.processPivotData();
            
            
            // Check if we have multiple row dimensions
            const useMultiDimension = this.state.rowFields && this.state.rowFields.length > 1;
            
            // Render the pivot table
            this.renderHierarchicalColumns(elements, this.state.pivotData);
            this.renderTableBody(elements, useMultiDimension);
            
            // Restore original factData if we used filtered data
            if (useFilteredData) {
                this.state.factData = originalFactData;
            }
            
            // Hide empty rows and columns at the end
            setTimeout(() => {
                this.hideEmptyRowsAndColumns();
                this.reduceCellHeights();
            }, 0);
            
            console.log("Pivot table generation complete");
            
        } catch (error) {
            console.error("Error in pivot table generation:", error);
            
            // If we replaced factData, make sure to restore it
            if (this.state.filteredData && this.state.factData === this.state.filteredData) {
                this.state.factData = this.state.originalFactData;
            }
        }
    },


    /**
     * Hides rows and columns that contain only zeros
     */
    hideEmptyRowsAndColumns: function() {
        const table = document.getElementById('pivotTable');
        if (!table) return;
        
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        if (!rows.length) return;
        
        const headerRow = table.querySelector('thead tr:last-child');
        if (!headerRow) return;
        
        // Track columns that have all zeros
        const columnCount = headerRow.querySelectorAll('th').length;
        // Skip first column (hierarchy column)
        const columnsAllZeros = Array(columnCount).fill(true);
        columnsAllZeros[0] = false; // Never hide the first column
        
        let hiddenRowCount = 0;
        let hiddenColumnCount = 0;
        
        // Check each row
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            let rowHasNonZero = false;
            
            // Skip the first cell (hierarchy cell)
            for (let i = 1; i < cells.length; i++) {
                const cell = cells[i];
                
                // Use data-raw-value if available (more reliable)
                const rawValue = cell.getAttribute('data-raw-value');
                let cellValue;
                
                if (rawValue !== null) {
                    cellValue = parseFloat(rawValue);
                } else {
                    cellValue = parseFloat(cell.textContent.trim());
                }
                
                const isZero = isNaN(cellValue) || cellValue === 0;
                
                // If this cell is not zero, mark the column as not-all-zeros
                if (!isZero) {
                    columnsAllZeros[i] = false;
                    rowHasNonZero = true;
                }
            }
            
            // If row has only zeros, add class to hide it
            if (!rowHasNonZero) {
                row.classList.add('all-zeros-row');
                hiddenRowCount++;
            }
        });
        
        // Now hide columns that are all zeros (skip the first column - hierarchy)
        for (let i = 1; i < columnsAllZeros.length; i++) {
            if (columnsAllZeros[i]) {
                // Add class to all cells in this column
                const columnCells = table.querySelectorAll(`tr > *:nth-child(${i + 1})`);
                columnCells.forEach(cell => {
                    cell.classList.add('all-zeros-column');
                });
                hiddenColumnCount++;
            }
        }
        
        console.log(`Hiding ${hiddenRowCount} rows and ${hiddenColumnCount} columns with all zeros`);
        
        // Add an indicator to the table for statistics
        const tableContainer = table.closest('.pivot-table-container');
        if (tableContainer) {
            const stats = document.createElement('div');
            stats.className = 'pivot-table-stats';
            stats.innerHTML = `<span>${hiddenRowCount} empty rows and ${hiddenColumnCount} empty columns hidden</span>`;
            
            // Remove any existing stats
            const existingStats = tableContainer.querySelector('.pivot-table-stats');
            if (existingStats) existingStats.remove();
            
            tableContainer.appendChild(stats);
        }
    },


    /**
     * Reduce cell heights for the entire table
     */
    reduceCellHeights: function() {
        const table = document.getElementById('pivotTable');
        if (!table) return;
        
        // Add a specific class to the table for height reduction
        table.classList.add('reduced-height');
        
        // Add inline style for immediate effect
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.paddingTop = '0.4rem';
            cell.style.paddingBottom = '0.4rem';
            cell.style.lineHeight = '1.05';
        });
    }
};


// Export the pivotTable object
export default pivotTable;