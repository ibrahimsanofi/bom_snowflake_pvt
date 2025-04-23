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
    handleExpandCollapseClick:function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';
        
        console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
        
        // Get state from the global App object
        const state = window.App?.state;
        
        // Ensure hierarchy exists
        if (!state || !state.hierarchies || !state.hierarchies[hierarchyName]) {
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
        // console.log(`Calculating ${measureField} for ${rowDef ? rowDef.label : 'All'}`);
        // console.log(`Input records: ${records ? records.length : 0}`);
        
        // Return 0 for empty record sets
        if (!records || records.length === 0) {
            console.log("No records to calculate");
            return 0;
        }
        
        // Start with all records
        let filteredRecords = [...records];
        
        // Debug initial data sample - check if input records have non-zero values
        // let initialNonZeroCount = 0;
        // filteredRecords.slice(0, 10).forEach(r => {
        //     const value = typeof r[measureField] === 'number' ? 
        //         r[measureField] : parseFloat(r[measureField] || 0);
        //     if (!isNaN(value) && value !== 0) {
        //         initialNonZeroCount++;
        //     }
        // });
        // console.log(`Initial check: ${initialNonZeroCount}/10 non-zero values found in sample`);
        
        // Filter by row definition if provided
        // if (rowDef) {
        //     console.log(`Filtering by row: ${rowDef.label}`);
            
        //     // For debugging, check if this is a Legal Entity node
        //     if (rowDef.hierarchyField === 'DIM_LEGAL_ENTITY') {
        //         console.log(`Legal Entity node: ${rowDef.label}, factId: ${rowDef.factId}`);
                
        //         // IMPORTANT: Debug the filtering logic
        //         if (rowDef.factId) {
        //             // Direct match by LE code (usually for leaf nodes)
        //             console.log(`Filtering ${filteredRecords.length} records by exact LE match: ${rowDef.factId}`);
                    
        //             // Check how many records match this LE
        //             const matchCount = filteredRecords.filter(r => r.LE === rowDef.factId).length;
        //             console.log(`Found ${matchCount} records with LE = "${rowDef.factId}"`);
                    
        //             filteredRecords = filteredRecords.filter(r => r.LE === rowDef.factId);
        //         } else {
        //             // For hierarchy nodes, check if we're filtering properly
        //             console.log(`Node ${rowDef.label} has no factId, using hierarchy filtering`);
                    
        //             // Don't filter root node
        //             if (rowDef.id === 'ROOT' || rowDef.label === 'WORLDWIDE') {
        //                 console.log("Root node - not filtering");
        //             } else {
        //                 console.log(`Filtering by hierarchy node: ${rowDef.label}`);
                        
        //                 // Instead of hierarchy filtering, look at each record's LE value
        //                 // and see if it belongs to this segment of the hierarchy
        //                 const mappings = window.App?.state?.mappings?.legalEntity;
                        
        //                 if (mappings && mappings.pathToLeCodes) {
        //                     // Try to find LEs for this path segment
        //                     const matchingLEs = mappings.pathToLeCodes[rowDef.label];
                            
        //                     if (matchingLEs && matchingLEs.size > 0) {
        //                         console.log(`Found ${matchingLEs.size} LEs for path segment "${rowDef.label}"`);
                                
        //                         // Filter to only records with these LEs
        //                         const leSet = new Set(matchingLEs);
        //                         filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
        //                     } else {
        //                         console.warn(`No matching LEs found for segment "${rowDef.label}"`);
                                
        //                         // Try matching based on path contains
        //                         const matchingByPath = [];
                                
        //                         // Check each record's LE path
        //                         const uniqueLEs = new Set(filteredRecords.map(r => r.LE));
        //                         uniqueLEs.forEach(le => {
        //                             if (mappings.leToPaths && mappings.leToPaths[le] && 
        //                                 mappings.leToPaths[le].includes(rowDef.label)) {
        //                                 matchingByPath.push(le);
        //                             }
        //                         });
                                
        //                         if (matchingByPath.length > 0) {
        //                             console.log(`Found ${matchingByPath.length} LEs with paths containing "${rowDef.label}"`);
                                    
        //                             // Filter to only records with these LEs
        //                             const leSet = new Set(matchingByPath);
        //                             filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
        //                         }
        //                     }
        //                 } else {
        //                     console.warn("No Legal Entity mappings available for filtering");
        //                 }
        //             }
        //         }
        //     } else {
        //         // Use standard filtering for other hierarchies
        //         filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
        //     }
        // }
        
        // console.log(`After row filtering: ${filteredRecords.length} records`);
        
        // // Filter by column definition if provided
        // if (colDef) {
        //     filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
        //     // console.log(`After column filtering: ${filteredRecords.length} records`);
        // }
        
        // Return 0 if no records match
        if (filteredRecords.length === 0) {
            console.log("No matching records after filtering");
            return 0;
        }
        
        // Sum the measure values with detailed checks
        let result = 0;
        let validCount = 0;
        let zeroCount = 0;
        let nanCount = 0;
        
        // Check a sample of the filtered data
        // console.log("Examining filtered data sample:");
        // filteredRecords.slice(0, 5).forEach((record, idx) => {
        //     const originalValue = record[measureField];
        //     const parsedValue = typeof originalValue === 'number' ? 
        //         originalValue : parseFloat(originalValue || 0);
                
        //     console.log(`Record ${idx}: ${measureField}=${originalValue} (${typeof originalValue}), parsed=${parsedValue}`);
        // });
        
        // Do the actual calculation
        if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
            filteredRecords.forEach(record => {
                // Get the original value
                const originalValue = record[measureField];
                
                // Convert to number if needed
                const value = typeof originalValue === 'number' ? 
                    originalValue : parseFloat(originalValue || 0);
                    
                // Count each type
                if (isNaN(value)) {
                    nanCount++;
                } else if (value === 0) {
                    zeroCount++;
                } else {
                    validCount++;
                    result += value;
                }
            });
        }
        
        // console.log(`Calculation results: ${validCount} valid values, ${zeroCount} zeros, ${nanCount} NaN => Sum: ${result}`);
        
        // Before returning the result
        // console.log(`Final calculation result: ${result}`);

        return result;
    },


    /**
     * Filters fact data by a dimension node
     * Updated for BOM data with LE mapping and non-hierarchical fields
     * 
     * @param {Array} data - The data array to filter
     * @param {Object} rowDef - Row definition with filtering criteria
     * @returns {Array} - Filtered data array
     */
    filterDataByDimension: function(data, rowDef) {
        let filteredData = [...data];
        
        // Handle non-hierarchical special fields (ITEM_COST_TYPE, COMPONENT_MATERIAL_TYPE)
        if (rowDef.hierarchyField === 'ITEM_COST_TYPE' || 
            rowDef.hierarchyField === 'DIM_ITEM_COST_TYPE') {
            // ROOT node shows all data
            if (rowDef._id === 'ITEM_COST_TYPE_ROOT') {
                return filteredData;
            }
            // Value node filters by specific value
            const value = rowDef.factId || rowDef.label;
            return filteredData.filter(record => record.ITEM_COST_TYPE === value);
        }
        
        if (rowDef.hierarchyField === 'COMPONENT_MATERIAL_TYPE' || 
            rowDef.hierarchyField === 'DIM_MATERIAL_TYPE') {
            // ROOT node shows all data
            if (rowDef._id === 'COMPONENT_MATERIAL_TYPE_ROOT') {
                return filteredData;
            }
            // Value node filters by specific value
            const value = rowDef.factId || rowDef.label;
            return filteredData.filter(record => record.COMPONENT_MATERIAL_TYPE === value);
        }
        
        // Handle standard non-hierarchical fields
        if (rowDef._id === 'ITEM_COST_TYPE' || rowDef._id === 'COMPONENT_MATERIAL_TYPE') {
            return filteredData.filter(record => record[rowDef._id] === rowDef.label);
        }
        
        // Continue with your existing hierarchy handling code...
        
        return filteredData;
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
                result = filterByDimensionNode(result, dimension);
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
        
        // Skip ROOT nodes
        if (node._id === 'ROOT') return records;
        
        // Dimension-specific filtering based on the mappings
        switch (dimName) {
            case 'legal_entity':
                return this.filterByLegalEntity(records, node);
                
            case 'cost_element':
                return this.filterByCostElement(records, node);
                
            case 'smart_code':
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


    /**
     * Filter records by GMID Display
     */
    filterByGmidDisplay: function(records, node) {
        // For leaf nodes with GMID, filter by COMPONENT_GMID
        if (node.isLeaf && node.factId) {
            return records.filter(record => record.COMPONENT_GMID === node.factId);
        }
        
        // For non-leaf nodes, this is more complex due to PATH_GMID
        // Let's use a simple approach for now
        if (node.gmidCode) {
            return records.filter(record => {
                // Check direct match with COMPONENT_GMID
                if (record.COMPONENT_GMID === node.gmidCode) return true;
                
                // Check if this gmidCode is part of PATH_GMID (if available)
                if (record.PATH_GMID) {
                    return record.PATH_GMID.split('/').includes(node.gmidCode);
                }
                
                return false;
            });
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
    filterByMaterialType: function (records, node) {
        // Direct filtering by COMPONENT_MATERIAL_TYPE
        if (node.factId) {
            return records.filter(record => record.COMPONENT_MATERIAL_TYPE === node.factId);
        }
        
        return records;
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
            'smart_code': 'ROOT_SMARTCODE',
            'item_cost_type': 'ITEM_COST_TYPE',
            'material_type': 'COMPONENT_MATERIAL_TYPE'
        };
        
        return factIdFieldMap[dimName] || null;
    },


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
                this.forceCreatePivotTable();
                return;
            }
        }
        
        const pivotData = this.state.pivotData;
    
        // Check if we have valid data
        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("No valid pivot data available for rendering");
            this.forceCreatePivotTable();
            return;
        }
    
        console.log(`Pivot-Table Active Data: ${pivotData.data?.length || 0} rows`);
    
        // Continue with the standard table rendering
        this.renderStandardTable(elements, useMultiDimension);
    },


    // renderTableBody: function(elements, useMultiDimension) {
    //     console.log("Rendering table body with hierarchies and special dimensions");
    //     const pivotData = this.state.pivotData;
    //     if (!pivotData) return;
        
    //     // Get visible rows
    //     const visibleRows = this.getVisibleRows(pivotData.rows);
        
    //     // Get visible columns (leaf nodes only)
    //     const visibleColumns = this.getVisibleLeafColumns(pivotData.columns);
        
    //     // Get value fields
    //     const valueFields = this.state.valueFields || ['COST_UNIT'];
        
    //     let bodyHtml = '';
        
    //     // Render each visible row
    //     visibleRows.forEach((rowDef, index) => {
    //         const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
    //         const rowClass = index % 2 === 0 ? 'even' : 'odd';
            
    //         // Start row
    //         bodyHtml += `<tr class="${rowClass}">`;
            
    //         // Check if this is a special non-hierarchical dimension
    //         const isItemCostType = rowDef.hierarchyField === 'ITEM_COST_TYPE' || 
    //                               rowDef.hierarchyField === 'DIM_ITEM_COST_TYPE';
    //         const isMaterialType = rowDef.hierarchyField === 'COMPONENT_MATERIAL_TYPE' || 
    //                               rowDef.hierarchyField === 'DIM_MATERIAL_TYPE';
            
    //         // Hierarchy cell with proper indentation and controls
    //         const indentation = rowDef.level ? rowDef.level * 20 : 0;
    //         const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
            
    //         bodyHtml += `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
            
    //         // Add appropriate marker based on row type
    //         if (rowDef.hasChildren) {
    //             const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
    //             bodyHtml += `<span class="expand-collapse ${expandClass}" 
    //                 data-node-id="${rowDef._id}" 
    //                 data-hierarchy="${dimName}" 
    //                 data-zone="row"
    //                 onclick="handleExpandCollapseClick(event)"
    //                 title="Expand/collapse this item"></span>`;
    //         } else {
    //             bodyHtml += `<span class="leaf-node"></span>`;
    //         }
            
    //         // Get appropriate label - use descriptions for special dimensions
    //         let displayLabel = rowDef.label || rowDef._id;
            
    //         if (isItemCostType && rowDef.factId) {
    //             // Use the description for ITEM_COST_TYPE
    //             displayLabel = data.getItemCostTypeDesc(rowDef.factId);
    //         } else if (isMaterialType && rowDef.factId) {
    //             // Use the description for MATERIAL_TYPE
    //             displayLabel = data.getMaterialTypeDesc(rowDef.factId);
    //         }
            
    //         bodyHtml += `<span class="dimension-label">${displayLabel}</span>`;
    //         bodyHtml += '</td>';
            
    //         // Render cells - similar to previous code
    //         if (visibleColumns.length > 0) {
    //             visibleColumns.forEach(col => {
    //                 valueFields.forEach(fieldId => {
    //                     // Get the cell key
    //                     const key = `${col._id}|${fieldId}`;
                        
    //                     // Get the value
    //                     let value = 0;
    //                     if (rowData[key] !== undefined) {
    //                         value = typeof rowData[key] === 'number' ? 
    //                               rowData[key] : parseFloat(rowData[key]);
    //                         if (isNaN(value)) value = 0;
    //                     }
                        
    //                     // Format value for display
    //                     let formattedValue;
    //                     if (value === 0) {
    //                         formattedValue = '0.00';
    //                     } else if (Math.abs(value) >= 1000000) {
    //                         formattedValue = (value / 1000000).toFixed(2) + 'm';
    //                     } else if (Math.abs(value) >= 1000) {
    //                         formattedValue = (value / 1000).toFixed(2) + 'k';
    //                     } else {
    //                         formattedValue = value.toFixed(2);
    //                     }
                        
    //                     // Add cell class based on value
    //                     const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell';
                        
    //                     // Add value cell
    //                     bodyHtml += `<td class="${cellClass}" data-column="${col._id}" data-field="${fieldId}" data-raw-value="${value}">${formattedValue}</td>`;
    //                 });
    //             });
    //         } else {
    //             // No columns, just render value fields
    //             valueFields.forEach(fieldId => {
    //                 // Get the value
    //                 let value = 0;
    //                 if (rowData[fieldId] !== undefined) {
    //                     value = typeof rowData[fieldId] === 'number' ? 
    //                            rowData[fieldId] : parseFloat(rowData[fieldId]);
    //                     if (isNaN(value)) value = 0;
    //                 }
                    
    //                 // Format value for display
    //                 let formattedValue;
    //                 if (value === 0) {
    //                     formattedValue = '0.00';
    //                 } else if (Math.abs(value) >= 1000000) {
    //                     formattedValue = (value / 1000000).toFixed(2) + 'm';
    //                 } else if (Math.abs(value) >= 1000) {
    //                     formattedValue = (value / 1000).toFixed(2) + 'k';
    //                 } else {
    //                     formattedValue = value.toFixed(2);
    //                 }
                    
    //                 // Add cell class based on value
    //                 const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell';
                    
    //                 // Add value cell
    //                 bodyHtml += `<td class="${cellClass}" data-field="${fieldId}" data-raw-value="${value}">${formattedValue}</td>`;
    //             });
    //         }
            
    //         // End row
    //         bodyHtml += '</tr>';
    //     });
        
    //     // Set the HTML content
    //     if (elements && elements.pivotTableBody) {
    //         elements.pivotTableBody.innerHTML = bodyHtml;
    //         console.log(`Rendered table body with ${visibleRows.length} rows`);
            
    //         // Add event handlers for row expand/collapse
    //         setTimeout(() => {
    //             const controls = elements.pivotTableBody.querySelectorAll('.expand-collapse');
    //             controls.forEach(control => {
    //                 control.addEventListener('click', (e) => {
    //                     window.handleExpandCollapseClick(e);
    //                 });
    //             });
    //         }, 100);
    //     }
    // },

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
        
        console.log(`Calculating pivot cells with ${factData.length} fact records`);
        
        // Sample check on the input data
        // if (factData.length > 0) {
        //     const sampleRecord = factData[0];
        //     console.log("Sample record from factData:", sampleRecord);
        //     valueFields.forEach(field => {
        //         console.log(`Field ${field} value: ${sampleRecord[field]}, type: ${typeof sampleRecord[field]}`);
        //     });
        // }
        
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
                    
                    // Log the stored value with detailed information
                    // console.log(`Row: ${rowDef.label}, Field: ${fieldId}, VALUE: ${finalValue}, TYPE: ${typeof finalValue}`);
                });
            });
            
            // Add the row data to the pivot data
            pivotData.data.push(rowData);
            // console.log(`Added row data for ${rowDef.label}:`, rowData);
        });
    
        // VALUE verification test - check each row's values after all calculations
        // console.log("VERIFICATION OF CALCULATED VALUES:");
        // pivotData.data.forEach(row => {
        //     // Find corresponding row definition
        //     const rowDef = pivotData.rows.find(r => r._id === row._id);
        //     if (rowDef) {
        //         console.log(`Checking values for row: ${rowDef.label}`);
                
        //         // Log the values for this row
        //         valueFields.forEach(fieldId => {
        //             const rawValue = row[fieldId];
        //             const numericValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue || 0);
                    
        //             if (numericValue === 0 || isNaN(numericValue)) {
        //                 console.warn(`⚠️ ROW "${rowDef.label}" - ${fieldId}: Raw=${rawValue}, Numeric=${numericValue}, Type=${typeof rawValue}`);
        //             } else {
        //                 console.log(`✅ ROW "${rowDef.label}" - ${fieldId}: Raw=${rawValue}, Numeric=${numericValue}, Type=${typeof rawValue}`);
        //             }
                    
        //             // Additional verification that the value is stored properly in the object
        //             const storedAgain = row[fieldId];
        //             if (storedAgain !== rawValue) {
        //                 console.error(`⛔ Value changed! Original: ${rawValue}, Now: ${storedAgain}`);
        //             }
        //         });
        //     }
        // });
        
        // Extra sanity check for column values
        // if (pivotData.columns.length > 0) {
        //     console.log("Column keys verification:");
        //     pivotData.columns.forEach(col => {
        //         valueFields.forEach(field => {
        //             const key = col._id === 'default' ? field : `${col._id}|${field}`;
        //             console.log(`Column: ${col.label}, Field: ${field}, Key: ${key}`);
                    
        //             // Check if this key exists in row data
        //             const sampleRow = pivotData.data[0];
        //             if (sampleRow) {
        //                 console.log(`Key "${key}" in first row: ${key in sampleRow ? 'YES' : 'NO'}, value: ${sampleRow[key]}`);
        //             }
        //         });
        //     });
        // }
        
        // console.log(`Pivot calculations complete: ${pivotData.data.length} data rows generated`);
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



    forceCreatePivotTable: function() {
        console.log("Forcing complete pivot table creation with calculated values...");
        
        // Get containers
        const headerContainer = document.getElementById('pivotTableHeader');
        const bodyContainer = document.getElementById('pivotTableBody');
        
        if (!headerContainer || !bodyContainer) {
            console.error("Table containers not found!");
            return;
        }
        
        // Get raw fact data
        const factData = this.state.factData || [];
        
        // Define row categories and aggregation rules
        const rowDefinitions = [
            { label: "WORLDWIDE", filter: (record) => true },  // All records
            { label: "Assumption Input", filter: (record) => record.LE?.includes("ASSUMPTION") },
            { label: "GREATER CHINA", filter: (record) => record.LE?.includes("CHINA") },
            { label: "INSURANCE", filter: (record) => record.LE?.includes("INSURANCE") },
            { label: "INTERNATIONAL", filter: (record) => record.LE?.includes("INTERNATIONAL") },
            { label: "KEY_MARKETS", filter: (record) => record.LE?.includes("KEY_MARKETS") },
            { label: "NORTH AMERICA", filter: (record) => record.LE?.includes("NORTH_AMERICA") },
            { label: "Set Conso Eur", filter: (record) => record.LE?.includes("CONSO_EUR") }
        ];
        
        // Calculate values for each row
        const rowData = rowDefinitions.map(rowDef => {
            // Filter data for this row
            const filteredRecords = factData.filter(rowDef.filter);
            
            // Sum COST_UNIT values
            let totalValue = 0;
            filteredRecords.forEach(record => {
                const value = typeof record.COST_UNIT === 'number' ? 
                             record.COST_UNIT : parseFloat(record.COST_UNIT || 0);
                if (!isNaN(value)) {
                    totalValue += value;
                }
            });
            
            return {
                label: rowDef.label,
                value: totalValue
            };
        });
        
        // 1. Create header
        let headerHtml = '<tr>';
        headerHtml += '<th class="row-header">Hierarchy</th>';
        headerHtml += '<th class="value-header">Value - Cost Unit</th>';
        headerHtml += '</tr>';
        headerContainer.innerHTML = headerHtml;
        
        // 2. Create body
        let bodyHtml = '';
        rowData.forEach((row, index) => {
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Hierarchy cell
            bodyHtml += `<td class="hierarchy-cell">${row.label}</td>`;
            
            // Value cell with formatting
            let formattedValue;
            if (Math.abs(row.value) >= 1000000) {
                formattedValue = (row.value / 1000000).toFixed(2) + 'm';
            } else if (Math.abs(row.value) >= 1000) {
                formattedValue = (row.value / 1000).toFixed(2) + 'k';
            } else {
                formattedValue = row.value.toFixed(2);
            }
            
            bodyHtml += `<td class="value-cell non-zero-value" data-raw-value="${row.value}">${formattedValue}</td>`;
            
            bodyHtml += '</tr>';
        });
        
        bodyContainer.innerHTML = bodyHtml;
        
        console.log("Forced table creation complete with " + rowData.length + " rows");
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


    generatePivotTable: function() {
        console.log("Starting pivot table generation...");
        
        // FIRST: Get DOM elements - Add this at the beginning of the function
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
        
        // Check if elements exist
        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Required pivot table elements not found in DOM");
            // Use fallback rendering as a last resort
            this.forceCreatePivotTable();
            return;
        }
        
        try {
            // Process the data for the pivot table
            this.processPivotData();
            
            // Check the table structure before rendering
            // this.checkTableStructure();
            
            // Now pass the elements to renderPivotTable
            this.renderPivotTable(elements);
            
            console.log("Pivot table generation complete");
        } catch (error) {
            console.error("Error in normal pivot table generation:", error);
            console.log("Using fallback rendering instead");
            this.forceCreatePivotTable();
        }
    }
};


// Export the pivotTable object
export default pivotTable;