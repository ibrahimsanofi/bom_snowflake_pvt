/**
 * This module provides functionality for handling multiple dimensions in pivot tables.
 * It processes data across multiple dimensions, handles filtering, rendering, and user interactions
 * for multi-dimensional pivot tables.
 */

import stateModule from './state.js';
import data from './data.js'


// Get reference to application state
const state = stateModule.state;

const multiDimensionPivotHandler = {
    /**
     * Process multiple dimension fields to create a combined hierarchy
     * This function creates a cartesian product of all dimensions for rendering
     * 
     * @param {Array} fieldIds - Array of field IDs to process
     * @returns {Object} - Object containing processed multi-dimension data
     */
    processMultiDimensionRows: function(fieldIds) {
        // First process each dimension individually to get its hierarchy
        const dimensionsData = fieldIds.map(fieldId => {
            return data.processHierarchicalFields([fieldId], 'row');
        });

        // Create a result structure combining all dimensions
        const result = {
            flatRows: [],          // Combined rows for rendering
            flatMappings: [],      // Mappings for data filtering
            dimensionsInfo: dimensionsData, // Keep original dimension data
            hierarchyFields: [],   // All hierarchy fields involved
            dimensions: fieldIds.map(id => {
                const field = state.availableFields.find(f => f.id === id);
                return {
                    id: id,
                    label: field ? field.label : id,
                    hierarchyField: id,
                    dimensionName: id.replace('DIM_', '').toLowerCase()
                };
            })
        };

        // Collect all hierarchy fields from all dimensions
        dimensionsData.forEach(dimData => {
            result.hierarchyFields = [...result.hierarchyFields, ...dimData.hierarchyFields];
        });

        // If there's only one dimension, return its processed data directly
        if (dimensionsData.length === 1) {
            return dimensionsData[0];
        }

        // For multiple dimensions, we need to create a complete cartesian product
        // Start by ensuring we have ROOT nodes in all dimension data sets
        dimensionsData.forEach((dimData, index) => {
            // Check if we have a ROOT node in the flatRows
            const hasRoot = dimData.flatRows.some(row => row._id === 'ROOT');
            
            if (!hasRoot && dimData.flatRows.length > 0) {
                // Create a ROOT node if one doesn't exist
                const rootNode = {
                    _id: 'ROOT',
                    label: `All ${result.dimensions[index].label}`,
                    level: 0,
                    hasChildren: true,
                    isLeaf: false,
                    expanded: true,
                    hierarchyField: fieldIds[index],
                    path: ['ROOT']
                };
                
                // Insert ROOT at the beginning
                dimData.flatRows.unshift(rootNode);
                
                // Add corresponding mapping
                dimData.flatMappings.unshift({
                    id: 'ROOT',
                    dimensionName: this.getDimensionName(fieldIds[index]),
                    nodeId: 'ROOT',
                    isHierarchical: true,
                    isLeaf: false
                });
            }
        });

        // Build cartesian product of all dimension combinations
        // Start with the first dimension's rows
        let combinedRows = [...dimensionsData[0].flatRows];
        let combinedMappings = [...dimensionsData[0].flatMappings];

        // For each additional dimension, create combinations with existing rows
        for (let i = 1; i < dimensionsData.length; i++) {
            const newRows = [];
            const newMappings = [];
            const currentDimRows = dimensionsData[i].flatRows;
            const currentDimMappings = dimensionsData[i].flatMappings;

            // Create combinations with existing rows
            for (let existingIdx = 0; existingIdx < combinedRows.length; existingIdx++) {
                const existingRow = combinedRows[existingIdx];
                const existingMapping = combinedMappings[existingIdx];

                for (let newIdx = 0; newIdx < currentDimRows.length; newIdx++) {
                    const newRow = currentDimRows[newIdx];
                    const newMapping = currentDimMappings[newIdx];

                    // Create a composite row with combined data
                    const combinedRow = {
                        _id: `${existingRow._id}|${newRow._id}`,
                        dimensions: []
                    };

                    // Add existing dimensions
                    if (existingRow.dimensions) {
                        combinedRow.dimensions = [...existingRow.dimensions];
                    } else {
                        // Convert single dimension row to multi-dimension format
                        combinedRow.dimensions = [{
                            _id: existingRow._id,
                            label: existingRow.label,
                            level: existingRow.level,
                            hasChildren: existingRow.hasChildren,
                            isLeaf: existingRow.isLeaf,
                            expanded: existingRow.expanded,
                            hierarchyField: existingRow.hierarchyField,
                            path: existingRow.path,
                            factId: existingRow.factId
                        }];
                    }

                    // Add the new dimension
                    combinedRow.dimensions.push({
                        _id: newRow._id,
                        label: newRow.label,
                        level: newRow.level,
                        hasChildren: newRow.hasChildren,
                        isLeaf: newRow.isLeaf,
                        expanded: newRow.expanded,
                        hierarchyField: newRow.hierarchyField,
                        path: newRow.path,
                        factId: newRow.factId
                    });

                    // Combine mappings as well for data filtering
                    const combinedMapping = {
                        id: combinedRow._id,
                        dimensions: []
                    };

                    // Add existing dimension mappings
                    if (existingMapping.dimensions) {
                        combinedMapping.dimensions = [...existingMapping.dimensions];
                    } else {
                        // Convert single dimension mapping to multi-dimension format
                        combinedMapping.dimensions = [{
                            id: existingMapping.id,
                            dimensionName: existingMapping.dimensionName || this.getDimensionName(existingRow.hierarchyField),
                            nodeId: existingMapping.nodeId || existingRow._id,
                            isHierarchical: existingMapping.isHierarchical,
                            isLeaf: existingMapping.isLeaf,
                            factId: existingMapping.factId,
                            factIdField: existingMapping.factIdField
                        }];
                    }

                    // Add the new dimension mapping
                    combinedMapping.dimensions.push({
                        id: newMapping.id,
                        dimensionName: newMapping.dimensionName || this.getDimensionName(newRow.hierarchyField),
                        nodeId: newMapping.nodeId || newRow._id,
                        isHierarchical: newMapping.isHierarchical,
                        isLeaf: newMapping.isLeaf,
                        factId: newMapping.factId,
                        factIdField: newMapping.factIdField
                    });

                    // Add to results
                    newRows.push(combinedRow);
                    newMappings.push(combinedMapping);
                }
            }

            // Update combined rows for next iteration
            combinedRows = newRows;
            combinedMappings = newMappings;
        }

        // Update result with the combined data
        result.flatRows = combinedRows;
        result.flatMappings = combinedMappings;

        return result;
    },


    /**
     * Gets a user-friendly display name for a dimension
     * 
     * @param {string} hierarchyField - The hierarchy field ID (e.g., "DIM_PRODUCT")
     * @returns {string} - A formatted display name (e.g., "Product")
     */
    getDimensionDisplayName: function(hierarchyField) {
        if (!hierarchyField) return '';
        
        // Remove DIM_ prefix
        let name = hierarchyField.replace('DIM_', '');
        
        // Format specific dimension names
        const formattedNames = {
            'LE': 'Legal Entity',
            'MC': 'Management Center',
            'COST_ELEMENT': 'Cost Element',
            'SMARTCODE': 'Smart Code',
            'GMID_DISPLAY': 'GMID',
            'ITEM_COST_TYPE': 'Item Cost Type',
            'MATERIAL_TYPE': 'Material Type',
            'YEAR': 'Year'
        };
        
        // Return formatted name or format the original
        if (formattedNames[name]) {
            return formattedNames[name];
        }
        
        // Format camel case or underscores
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^\w/, c => c.toUpperCase());
    },


    /**
     * Extracts the dimension name from a hierarchy field
     * 
     * @param {string} hierarchyField - The hierarchy field ID (e.g., "DIM_PRODUCT")
     * @returns {string} - The lowercase dimension name without prefix (e.g., "product")
     */
    getDimensionName: function(hierarchyField) {
        if (!hierarchyField || !hierarchyField.startsWith('DIM_')) {
            return '';
        }
        return hierarchyField.replace('DIM_', '').toLowerCase();
    },


    /**
     * Filters data by multiple dimension criteria
     * Applies filters for each dimension in sequence
     * 
     * @param {Array} data - The data array to filter
     * @param {Object} rowDef - Multi-dimension row definition
     * @returns {Array} - Filtered data array
     */
    filterDataByMultipleDimensions: function(data, rowDef) {
        if (!rowDef.dimensions || !Array.isArray(rowDef.dimensions)) {
            return data; // No dimensions to filter by
        }

        // Start with all data
        let filteredData = [...data];

        // Apply filters for each dimension
        rowDef.dimensions.forEach(dimensionDef => {
            // Skip ROOT nodes - they don't filter the data
            if (dimensionDef._id === 'ROOT') {
                return;
            }
            
            // Skip non-hierarchical fields
            if (!dimensionDef.hierarchyField) {
                return;
            }

            // Create a temporary row definition for this dimension
            const tempRowDef = {
                _id: dimensionDef._id,
                hierarchyField: dimensionDef.hierarchyField,
                isLeaf: dimensionDef.isLeaf,
                factId: dimensionDef.factId,
                path: dimensionDef.path
            };

            // Filter data using the existing single dimension method
            filteredData = this.filterByDimension(filteredData, tempRowDef);
        });

        return filteredData;
    },


    /**
     * Filter data by a single dimension
     */
    filterByDimension: function(data, dimensionDef) {
        if (!dimensionDef || !dimensionDef.hierarchyField) {
            return data;
        }
        
        // Get the dimension name
        const dimName = dimensionDef.hierarchyField.replace('DIM_', '').toLowerCase();
        
        // Get the appropriate filter function
        if (state.pivotTable && typeof state.pivotTable.filterByDimensionNode === 'function') {
            return state.pivotTable.filterByDimensionNode(data, dimensionDef);
        }
        
        // If no specialized filter is available, fallback to basic filtering
        // This is a safety measure in case pivotTable is not initialized yet
        return this.basicFilterByDimension(data, dimensionDef, dimName);
    },

    
    /**
     * Basic dimension filtering as a fallback
     */
    basicFilterByDimension: function(data, dimensionDef, dimName) {
        // Skip root nodes
        if (dimensionDef._id === 'ROOT') {
            return data;
        }
        
        // For leaf nodes with factId, apply direct filtering
        if (dimensionDef.isLeaf && dimensionDef.factId) {
            const factIdField = this.getFactIdField(dimName);
            if (factIdField) {
                return data.filter(record => record[factIdField] === dimensionDef.factId);
            }
        }
        
        // For hierarchical dimensions, try path-based filtering
        if (dimensionDef.path && dimensionDef.path.length > 1) {
            const hierarchyPath = dimensionDef.path.filter(p => p !== 'ROOT');
            
            if (hierarchyPath.length > 0) {
                // Try to filter using path information
                const pathField = this.getPathField(dimName);
                if (pathField) {
                    return data.filter(record => {
                        if (!record[pathField]) return false;
                        const recordPath = record[pathField].split('/');
                        return hierarchyPath.some(segment => recordPath.includes(segment));
                    });
                }
            }
        }
        
        // Fallback - couldn't apply specific filtering
        // console.warn(`⚠️ Warning: Basic filtering fallback - no specific filter for dimension: ${dimName}`);
        return data;
    },

    
    /**
     * Get fact id field name for a dimension
     */
    getFactIdField: function(dimName) {
        const factIdFieldMap = {
            'legal_entity': 'LE',
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
     * Get path field name for a dimension
     */
    getPathField: function(dimName) {
        const pathFieldMap = {
            'legal_entity': 'LE_PATH',
            'cost_element': 'COST_ELEMENT_PATH',
            'gmid_display': 'PATH_GMID',
            'smartcode': 'SMARTCODE_PATH',
            'material_type': 'MATERIAL_TYPE_PATH'
        };
        
        return pathFieldMap[dimName.toLowerCase()] || null;
    },


    /**
     * Renders a single dimension cell within a multi-dimension row
     * 
     * @param {Object} dimensionDef - The dimension definition
     * @param {number} index - The dimension index
     * @returns {string} - HTML string for the dimension cell
     */
    renderDimensionCell: function(dimensionDef, index) {
        const dimName = dimensionDef.hierarchyField ? dimensionDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const level = dimensionDef.level || 0;
        const indentClass = `indent-level-${level}`; // Use class-based indentation
        
        // Determine if this is a parent node for visual indicators
        const isParent = dimensionDef.hasChildren === true;
        const parentClass = isParent ? 'hierarchy-parent' : '';
        
        // Add cell with proper class-based indentation and expand/collapse control
        let cellHtml = `<td class="hierarchy-cell dimension-cell ${indentClass} ${parentClass}" 
                           data-dimension="${dimName}" 
                           data-dimension-index="${index}"
                           data-level="${level}">`;
        
        // Add expand/collapse control only if it has children
        if (dimensionDef.hasChildren) {
            const expandClass = dimensionDef.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${dimensionDef._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${index}"
                title="Expand/collapse this item"></span>`;
        } else {
            cellHtml += `<span class="leaf-node"></span>`;
        }
        
        cellHtml += `<span class="dimension-label">${dimensionDef.label}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Renders all cells for a multi-dimension row
     * 
     * @param {Object} rowDef - The row definition (single or multi-dimension)
     * @returns {string} - HTML string for all row cells
     */
    renderMultiDimensionRowCells: function(rowDef) {
        if (!rowDef || !rowDef.dimensions) return '<td class="hierarchy-cell">No data</td>';
        
        // Create a cell with the multi-dimension-cell class
        let cellsHtml = '<td class="hierarchy-cell multi-dimension-cell">';
        
        // Render each dimension in order with proper indentation and clear visual distinction
        rowDef.dimensions.forEach((dimensionDef, index) => {
            const level = dimensionDef.level || 0;
            const dimName = dimensionDef.hierarchyField ? 
                        dimensionDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
            
            // Get the field label for this dimension for display
            const fieldLabel = this.getDimensionDisplayName(dimensionDef.hierarchyField);
            
            // Add a wrapper div for this dimension with proper styling
            cellsHtml += `<div class="dimension-row" 
                            data-dimension="${dimName}" 
                            data-dimension-index="${index}"
                            data-level="${level}">`;
            
            // Add dimension type label 
            cellsHtml += `<div class="dimension-type">${fieldLabel}</div>`;
            
            // Value container with proper indentation
            cellsHtml += `<div class="dimension-value">`;
            
            // Indent based on level
            const indentPx = 20 * level;
            if (level > 0) {
                cellsHtml += `<span class="dimension-indent" style="width:${indentPx}px"></span>`;
            }
            
            // Add expand/collapse control only if it has children
            if (dimensionDef.hasChildren === true) {
                const expandClass = dimensionDef.expanded ? 'expanded' : 'collapsed';
                cellsHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${dimensionDef._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="row"
                    data-dimension-index="${index}"
                    onclick="window.handleMultiDimensionExpandCollapseClick(event)"
                    title="Expand/collapse this item"></span>`;
            } else {
                cellsHtml += `<span class="leaf-node"></span>`;
            }
            
            cellsHtml += `<span class="dimension-label">${dimensionDef.label || dimensionDef._id}</span>`;
            cellsHtml += '</div>'; // Close dimension-value
            cellsHtml += '</div>'; // Close dimension-row
        });
        
        cellsHtml += '</td>'; // Close hierarchy-cell
        
        return cellsHtml;
    },


    /**
     * Determines if a multi-dimension row should be visible based on expansion state
     * 
     * @param {Object} row - The row definition (single or multi-dimension)
     * @param {Array} allRows - All rows in the pivot table
     * @returns {boolean} - Whether the row should be visible
     */
    isMultiDimensionRowVisible: function(row, allRows) {
        if (!row.dimensions || !Array.isArray(row.dimensions)) {
            // For single dimension rows, use the existing visibility check
            if (state.pivotTable && typeof state.pivotTable.isNodeVisible === 'function') {
                return state.pivotTable.isNodeVisible(row, allRows);
            }
            return true; // Default to visible
        }
        
        // For multi-dimension rows, check visibility of each dimension
        return row.dimensions.every(dimensionDef => {
            // ROOT nodes are always visible
            if (dimensionDef._id === 'ROOT') {
                return true;
            }
            
            // Create a temporary row object for the util function
            const tempRow = {
                _id: dimensionDef._id,
                hierarchyField: dimensionDef.hierarchyField,
                path: dimensionDef.path
            };
            
            // Use the existing visibility check if available
            if (state.pivotTable && typeof state.pivotTable.isNodeVisible === 'function') {
                return state.pivotTable.isNodeVisible(tempRow, allRows);
            }
            
            // Fallback visibility check
            return this.basicIsNodeVisible(tempRow, allRows);
        });
    },

    
    /**
     * Basic node visibility check as a fallback
     */
    basicIsNodeVisible: function(row, allNodes) {
        if (!row.hierarchyField || !row.path || row.path.length <= 1) {
            return true; // Root nodes or non-hierarchical fields are always visible
        }
        
        // Check each ancestor in the path
        for (let i = 0; i < row.path.length - 1; i++) {
            const ancestorId = row.path[i];
            
            // Skip 'ROOT' node which is always expanded
            if (ancestorId === 'ROOT') continue;
            
            // Find ancestor node
            const ancestorNode = allNodes.find(n => n._id === ancestorId);
            
            // If any ancestor is not expanded, the node is not visible
            if (ancestorNode && !ancestorNode.expanded) {
                return false;
            }
        }
        
        return true; // All ancestors are expanded
    },


    /**
     * Event handler for expand/collapse controls in multi-dimension rows
     * 
     * @param {Event} e - Click event
     */
    handleMultiDimensionExpandCollapseClick: function(e) {
        // Make sure we're handling the actual button click, not its children
        let target = e.target;
        
        // If clicked on a child element, find the actual button
        if (!target.classList.contains('expand-collapse')) {
            target = target.closest('.expand-collapse');
            if (!target) return; // Exit if no button found
        }
        
        const nodeId = target.getAttribute('data-node-id');
        const hierarchyName = target.getAttribute('data-hierarchy');
        const zone = target.getAttribute('data-zone') || 'row';
        const dimensionIndex = parseInt(target.getAttribute('data-dimension-index') || '0', 10);
        
        console.log("Multi-dimension expand/collapse clicked:", { 
            nodeId, hierarchyName, zone, dimensionIndex 
        });
        
        // Get reference to state
        const state = window.App?.state || stateModule.state;
        
        // Ensure node exists in state
        let node = null;
        
        if (hierarchyName && state.hierarchies && state.hierarchies[hierarchyName]) {
            // Look in the specified hierarchy
            node = state.hierarchies[hierarchyName].nodesMap?.[nodeId];
        }
        
        if (!node) {
            console.error(`❌ Alert! Node ${nodeId} not found in ${hierarchyName} hierarchy`);
            return;
        }
        
        // Toggle node expansion in state
        state.expandedNodes = state.expandedNodes || {};
        state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
        state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
        
        // Toggle the expansion state
        const newState = !state.expandedNodes[hierarchyName][zone][nodeId];
        state.expandedNodes[hierarchyName][zone][nodeId] = newState;
        
        // Also update the node's expanded property directly
        node.expanded = newState;
        
        console.log(`Node ${nodeId} expansion set to: ${newState}`);
        
        // Update the visual state of the button IMMEDIATELY for feedback
        target.classList.toggle('expanded');
        target.classList.toggle('collapsed');
        
        // Regenerate pivot table with a small delay to allow visual feedback
        setTimeout(() => {
            window.refreshPivotTable();
        }, 10);
        
        // Prevent event from bubbling up
        e.stopPropagation();
    },

};

export default multiDimensionPivotHandler;