// This module centralizes the essential logic of pivot table functionality

import data from './data.js';
import stateModule from './state.js';


// Get reference to application state
const state = stateModule.state;


// Dynamic header classifier - works with any dimension
const classifyHeader = function(headerInfo) {
    const { isValueField, level, hasChildren, isLeaf } = headerInfo;
    
    if (isValueField) {
        const modifiers = level === 0 ? ['measures-header'] : ['merged-measure'];
        return 'value-header ' + modifiers.join(' ');
    }
    
    const modifiers = [];
    if (level === 0) modifiers.push('root-level');
    if (hasChildren) modifiers.push('has-children');
    if (isLeaf) modifiers.push('leaf-node');
    
    return 'column-header ' + modifiers.join(' ');
};


// Dynamic dimension analyzer
const analyzeDimension = function(dimension, hierarchy) {
    if (!hierarchy || !hierarchy.nodesMap) {
        console.warn(`No hierarchy found for dimension: ${dimension}`);
        return null;
    }
    
    const rootNode = hierarchy.nodesMap['ROOT'];
    if (!rootNode) {
        console.warn(`No ROOT node found in hierarchy: ${dimension}`);
        return null;
    }
    
    return {
        name: dimension,
        rootLabel: rootNode.label || rootNode._id,
        hasHierarchy: !!(rootNode.children && rootNode.children.length > 0)
    };
};


// Universal node children detector
const nodeHasChildren = function(node, state) {
    if (!node || !node.hierarchyField) return false;
    
    const dimName = extractDimensionName(node.hierarchyField);
    const hierarchy = state?.hierarchies?.[dimName];
    
    return !!(node.children && node.children.length > 0 && 
             node.children.some(childId => hierarchy?.nodesMap?.[childId]));
};


// Universal dimension name extractor
const extractDimensionName = function(dimensionField) {
    if (!dimensionField) {
        return 'unknown'; // Return a safe default
    }
    
    // Handle both DIM_ prefixed and direct dimension names
    let dimName = dimensionField;
    if (dimName.startsWith('DIM_')) {
        dimName = dimName.replace(/^DIM_/, '');
    }
    
    // Convert to lowercase for consistency
    return dimName.toLowerCase();
};


// Universal expansion state checker
const isNodeExpanded = function(nodeId, dimensionName, zone, state) {
    if (!state.expandedNodes) return false;
    if (!state.expandedNodes[dimensionName]) return false;
    if (!state.expandedNodes[dimensionName][zone]) return false;
    return !!state.expandedNodes[dimensionName][zone][nodeId];
};


// Universal expansion tracking initializer
const initializeExpansionTracking = function(state, hierarchyName, zone) {
    state.expandedNodes = state.expandedNodes || {};
    state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
    state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
};


const PivotHeaderConfig = {
    rowAreaLabel: 'Hierarchy',
    valueAreaLabel: 'Measures',
    
    updateConfig: function(config) {
        Object.assign(this, config);
    },
    
    getRowAreaLabel: function() {
        return this.rowAreaLabel;
    },
    
    getValueAreaLabel: function() {
        return this.valueAreaLabel;
    }
};


// Define a namespace for pivot table functions
const pivotTable = {
    // Store a reference to the state object
    state: null,
    currentView: 'horizontal',

    /**
     * Initialize the pivot table system
     * This should be called once DOM is ready
     */
    init: function (stateRef) {
        // Store reference to state - CRITICAL for proper operation
        this.state = stateRef;
        
        // Ensure state connection is maintained
        if (!this.state) {
            console.error("Pivot table initialization failed: No state provided");
            return false;
        }

        // Set up global event handlers
        this.setupGlobalHandlers();
        
        // Set up view toggle button
        document.getElementById('toggleViewBtn')?.addEventListener('click', () => {
            this.toggleView();
        });

        console.log("Pivot table system initialized with state connection");
        return true;
    },


    /**
     * Set up global event handlers
     */
    setupGlobalHandlers: function () {
        // Enhanced universal expand/collapse handler for independent dimensions
        window.handleExpandCollapseClick = (e) => {
            // CRITICAL: Prevent event bubbling to avoid double-firing
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const nodeId = e.target.getAttribute('data-node-id');
            const hierarchyName = e.target.getAttribute('data-hierarchy');
            const zone = e.target.getAttribute('data-zone') || 'row';
            const dimensionIndex = e.target.getAttribute('data-dimension-index');
            
            console.log(`🎯 Single-click expand/collapse: ${nodeId} in ${hierarchyName} (${zone}) - dimension ${dimensionIndex}`);
            
            const rowFields = this.state.rowFields || [];
            
            // For multi-dimension tables, use independent expansion logic
            if (rowFields.length > 1) {
                console.log(`🔀 Using independent multi-dimension handler`);
                this.handleIndependentMultiDimensionExpandCollapse(e);
            } else {
                console.log(`🔀 Using standard handler`);
                this.handleStandardExpandCollapse(e);
            }
        };
        
        // Use the enhanced generation method
        window.generatePivotTable = this.generatePivotTable.bind(this);
        
        console.log(`✅ Enhanced universal handlers set up with single-click response`);
    },


    // Method to handle independent multi-dimension expansion
    handleIndependentMultiDimensionExpandCollapse: function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';
        const dimensionIndex = parseInt(e.target.getAttribute('data-dimension-index') || '0');

        console.log(`🎯 Independent multi-dimension expand/collapse: ${nodeId} in ${hierarchyName} (dimension ${dimensionIndex})`);

        if (!nodeId || !hierarchyName) {
            console.error("Missing nodeId or hierarchyName in expand/collapse event");
            return;
        }

        // Find the node in the hierarchy
        const hierarchy = this.state.hierarchies?.[hierarchyName];
        if (!hierarchy || !hierarchy.nodesMap) {
            console.error(`Hierarchy ${hierarchyName} not found or invalid`);
            return;
        }

        const node = hierarchy.nodesMap[nodeId];
        if (!node) {
            console.error(`Node ${nodeId} not found in ${hierarchyName} hierarchy`);
            return;
        }

        console.log(`🎯 Found node: ${node.label}, currently expanded: ${node.expanded}`);

        // IMMEDIATE UI UPDATE: Toggle the visual state of the button first
        const button = e.target;
        const wasExpanded = button.classList.contains('expanded');
        const newExpansionState = !wasExpanded;

        // Update button appearance immediately
        if (newExpansionState) {
            button.classList.remove('collapsed');
            button.classList.add('expanded');
        } else {
            button.classList.remove('expanded');
            button.classList.add('collapsed');
        }

        // Toggle expansion state in data
        node.expanded = newExpansionState;

        // Update state tracking for this specific dimension
        this.updateNodeExpansionState(nodeId, hierarchyName, zone, newExpansionState);

        console.log(`🎯 Node ${nodeId} expanded: ${newExpansionState} in dimension ${hierarchyName}`);

        // Regenerate table (this can be async)
        setTimeout(() => {
            try {
                console.log(`🔄 Regenerating independent multi-dimension table...`);
                this.generatePivotTable();
            } catch (error) {
                console.error("Error regenerating pivot table:", error);
            }
        }, 10); // Small delay to ensure UI update is visible
    },


    /**
     * Standard expand/collapse for single dimension
     */
    handleStandardExpandCollapse: function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';

        console.log(`🎯 Standard expand/collapse: ${nodeId} in ${hierarchyName} (${zone})`);

        // IMMEDIATE UI UPDATE: Toggle the visual state of the button first
        const button = e.target;
        const wasExpanded = button.classList.contains('expanded');
        const newExpansionState = !wasExpanded;

        // Update button appearance immediately
        if (newExpansionState) {
            button.classList.remove('collapsed');
            button.classList.add('expanded');
        } else {
            button.classList.remove('expanded');
            button.classList.add('collapsed');
        }
        
        // Update state
        this.updateNodeExpansionState(nodeId, hierarchyName, zone, newExpansionState);
        
        // Regenerate table (this can be async)
        setTimeout(() => {
            try {
                if (window.refreshPivotTable) {
                    window.refreshPivotTable();
                } else {
                    this.generatePivotTable();
                }
            } catch (error) {
                console.error("Error regenerating pivot table:", error);
            }
        }, 10); // Small delay to ensure UI update is visible
    },


    /**
 * Enhanced node children checker with proper hierarchy support
 */
    nodeHasChildren: function(node) {
        if (!node || !node.hierarchyField) return false;
        
        const dimName = this.extractDimensionName(node.hierarchyField);
        const hierarchy = this.state?.hierarchies?.[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) return false;
        
        const originalNode = hierarchy.nodesMap[node._id];
        return !!(originalNode && originalNode.children && originalNode.children.length > 0);
    },


    /*
    Toggle between horizontal and vertical views
    */
    toggleView: function () {
        const container = document.getElementById('pivotTableContainer');
        if (!container) return;
        this.currentView = this.currentView === 'horizontal' ? 'vertical' : 'horizontal';
        container.classList.toggle('vertical-view', this.currentView === 'vertical');
        this.generatePivotTable();
    },


    /**
     * Render vertical hierarchy for rows
     */
    renderVerticalHierarchicalColumns: function (elements, pivotData) {
        if (!elements || !elements.pivotTableHeader || !elements.pivotTableBody) return;

        const valueFields = this.state.valueFields || ['COST_UNIT'];
        const rowFields = this.state.rowFields || [];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');

        const container = elements.pivotTableHeader.closest('.pivot-table-container');
        container.innerHTML = '';

        // Group rows by hierarchy level for each dimension
        const rowsByDimension = {};
        let maxLevel = 0;
        pivotData.rows.forEach(row => {
            const dimension = row.dimension || rowFields[0];
            const level = row.level || 0;
            rowsByDimension[dimension] = rowsByDimension[dimension] || {};
            rowsByDimension[dimension][level] = rowsByDimension[dimension][level] || [];
            rowsByDimension[dimension][level].push(row);
            maxLevel = Math.max(maxLevel, level);
        });

        // Create a table for each row dimension
        rowFields.forEach((dimension, dimIndex) => {
            const table = document.createElement('table');
            table.className = 'table-modern vertical-table';

            // Header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const dimTh = document.createElement('th');
            dimTh.textContent = dimension.replace('DIM_', '');
            headerRow.appendChild(dimTh);

            // Column headers (stacked if multiple column dimensions)
            if (columns.length > 0) {
                const columnLevels = this.getColumnLevels(columns);
                columnLevels.forEach((levelCols, level) => {
                    if (level === 0) {
                        levelCols.forEach(col => {
                            valueFields.forEach(field => {
                                const th = document.createElement('th');
                                th.textContent = `${col.label || col._id} - ${this.getFieldLabel(field)}`;
                                headerRow.appendChild(th);
                            });
                        });
                    }
                });
            } else {
                valueFields.forEach(field => {
                    const th = document.createElement('th');
                    th.textContent = this.getFieldLabel(field);
                    headerRow.appendChild(th);
                });
            }

            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Body
            const tbody = document.createElement('tbody');
            const levels = rowsByDimension[dimension] || {};
            for (let level = 0; level <= maxLevel; level++) {
                if (!levels[level]) continue;
                const visibleRows = this.getVisibleRows(levels[level]);
                visibleRows.forEach(row => {
                    const tr = document.createElement('tr');
                    const rowTd = document.createElement('td');
                    rowTd.className = 'hierarchy-cell';
                    const indentation = row.level * 20;
                    rowTd.style.paddingLeft = `${indentation}px`;

                    if (row.hasChildren) {
                        const expandClass = row.expanded ? 'expanded' : 'collapsed';
                        const dimName = row.hierarchyField.replace('DIM_', '').toLowerCase();
                        rowTd.innerHTML = `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${row._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="row"
                            onclick="handleExpandCollapseClick(event)"></span>`;
                    } else {
                        rowTd.innerHTML = '<span class="leaf-node"></span>';
                    }
                    rowTd.innerHTML += `<span class="dimension-label">${row.label || row._id}</span>`;
                    tr.appendChild(rowTd);

                    // Values
                    if (columns.length > 0) {
                        columns.forEach(col => {
                            valueFields.forEach(field => {
                                const key = `${col._id}|${field}`;
                                const value = pivotData.data.find(d => d._id === row._id)?.[key] || 0;
                                const td = document.createElement('td');
                                td.className = 'value-cell';
                                td.innerHTML = this.formatValue(value);
                                tr.appendChild(td);
                            });
                        });
                    } else {
                        valueFields.forEach(field => {
                            const value = pivotData.data.find(d => d._id === row._id)?.[field] || 0;
                            const td = document.createElement('td');
                            td.className = 'value-cell';
                            td.innerHTML = this.formatValue(value);
                            tr.appendChild(td);
                        });
                    }

                    tbody.appendChild(tr);
                });
            }

            table.appendChild(tbody);
            container.appendChild(table);
        });

        // Add event handlers with immediate response
        setTimeout(() => {
            container.querySelectorAll('.expand-collapse').forEach(control => {
                control.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.handleExpandCollapseClick(e);
                });
            });
        }, 100);
    },


    /**
     * Get field label from available fields
     */
    getFieldLabel: function (fieldId) {
        const fieldDef = this.state.availableFields.find(f => f.id === fieldId);
        return fieldDef ? fieldDef.label : fieldId;
    },


    /**
     * Format a value for display
     */
    formatValue: function (value) {
        // Fix the variable name issue
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        let formattedValue;
        const decimals = this.state?.decimalPlaces ?? 2;
        const valFormat = this.state?.valueFormat;

        switch (valFormat) {
            case "regular":
                if (numericValue === 0) {
                    formattedValue = (0).toFixed(decimals);
                } else {
                    formattedValue = numericValue.toLocaleString(undefined, {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    });
                }
                break;

            case "thousands":
                formattedValue = (numericValue / 1000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'k';
                break;

            case "millions":
                formattedValue = (numericValue / 1000000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'm';
                break;

            case "billions":
                formattedValue = (numericValue / 1000000000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'b';
                break;

            default:
                formattedValue = numericValue.toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                break;
        }

        return formattedValue; // Fixed: was returning this.formattedValue
    },

    
    /**
     * Handle expand/collapse clicks
     */
    handleExpandCollapseClick: function(e) {
        // Prevent event bubbling
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';
        
        if (!nodeId || !hierarchyName) {
            console.error("Missing nodeId or hierarchyName");
            return;
        }
        
        // Immediate visual feedback
        const button = e.target;
        const wasExpanded = button.classList.contains('expanded');
        const newState = !wasExpanded;
        
        if (newState) {
            button.classList.remove('collapsed');
            button.classList.add('expanded');
        } else {
            button.classList.remove('expanded');
            button.classList.add('collapsed');
        }
        
        // Update data state
        updateNodeExpansionState(nodeId, hierarchyName, zone, newState);
        
        // Regenerate table after small delay for smooth UI
        setTimeout(() => {
            if (window.refreshPivotTable) {
                window.refreshPivotTable();
            } else if (typeof generatePivotTable === 'function') {
                generatePivotTable();
            }
        }, 10);
    },


    updateNodeExpansionState: function(nodeId, hierarchyName, zone, newState) {
        if (!this.state) return;
    
        // Initialize if needed
        if (!this.state.expandedNodes) this.state.expandedNodes = {};
        if (!this.state.expandedNodes[hierarchyName]) this.state.expandedNodes[hierarchyName] = { row: {}, column: {} };
        if (!this.state.expandedNodes[hierarchyName][zone]) this.state.expandedNodes[hierarchyName][zone] = {};
        
        this.state.expandedNodes[hierarchyName][zone][nodeId] = newState;
        
        // Update hierarchy node if it exists
        const hierarchy = this.state.hierarchies?.[hierarchyName];
        if (hierarchy?.nodesMap?.[nodeId]) {
            hierarchy.nodesMap[nodeId].expanded = newState;
        }
        
        // console.log(`📝 Updated ${nodeId} in ${hierarchyName}[${zone}] to ${newState}`);
    },


    /**
     * Calculate measure values
     */
    calculateMeasure: function (records, rowDef, colDef, measureField) {
        if (!records || records.length === 0) {
            return 0;
        }

        // CRITICAL FIX: Handle ROOT nodes to show GRAND TOTAL of ALL records
        if (!rowDef || rowDef._id === 'ROOT' || rowDef.label === 'WORLDWIDE' || 
            rowDef._id === 'ROOT_WORLDWIDE' || rowDef._id === 'All GMIDs' ||
            rowDef.label === 'All GMIDs') {
            
            // console.log(`🔍 ROOT CALCULATION: Processing ${records.length} total records`);
            return this.calculateDirectMeasure(records, measureField);
        }

        // For leaf nodes, filter and calculate directly
        if (rowDef.isLeaf) {
            const filteredRecords = this.filterRecordsByDimension(records, rowDef);
            // console.log(`🔍 LEAF CALCULATION: ${rowDef.label} - ${filteredRecords.length} filtered records`);
            return this.calculateDirectMeasure(filteredRecords, measureField);
        }

        // For parent nodes, aggregate from ALL descendants (not just visible)
        return this.calculateParentMeasure(records, rowDef, colDef, measureField);
    },


    /**
     * Calculate measure for parent nodes by aggregating descendant values
     */
    calculateParentMeasure: function(records, rowDef, colDef, measureField) {
        if (!rowDef.hierarchyField) {
            return 0;
        }

        const dimName = rowDef.hierarchyField.replace('DIM_', '').toLowerCase();
        const hierarchy = this.state.hierarchies[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) {
            console.warn(`No hierarchy found for ${dimName}`);
            return 0;
        }

        const node = hierarchy.nodesMap[rowDef._id];
        if (!node) {
            console.warn(`Node ${rowDef._id} not found in hierarchy ${dimName}`);
            return 0;
        }

        // CRITICAL: Always get ALL leaf descendants, not just visible ones
        // Parent nodes should show the total of all their children, regardless of expansion state
        const allLeafDescendants = this.getAllLeafDescendants(node, hierarchy);
        
        if (allLeafDescendants.length === 0) {
            return 0;
        }

        // console.log(`🔍 Parent ${rowDef.label}: Aggregating ${allLeafDescendants.length} total leaf descendants`);

        // Calculate sum from ALL leaf descendants
        let total = 0;
        allLeafDescendants.forEach(leafNode => {
            // Create a temporary row definition for the leaf
            const leafRowDef = {
                _id: leafNode.id,
                label: leafNode.label,
                hierarchyField: rowDef.hierarchyField,
                isLeaf: true,
                factId: leafNode.factId
            };

            // Filter records for this specific leaf and calculate
            const leafRecords = this.filterRecordsByDimension(records, leafRowDef);
            const leafValue = this.calculateDirectMeasure(leafRecords, measureField);
            total += leafValue;
        });

        return total;
    },


    /**
     * Get visible leaf descendants based on expansion state
     */
    getAllLeafDescendants: function(node, hierarchy) {
        const leaves = [];
        
        const collectAllLeaves = (currentNode) => {
            if (!currentNode) return;
            
            if (currentNode.isLeaf) {
                leaves.push(currentNode);
                return;
            }
            
            // Always traverse ALL children regardless of expansion state
            if (currentNode.children && currentNode.children.length > 0) {
                currentNode.children.forEach(childId => {
                    const childNode = typeof childId === 'string' 
                        ? hierarchy.nodesMap[childId] 
                        : childId;
                    
                    if (childNode) {
                        collectAllLeaves(childNode);
                    }
                });
            }
        };
        
        collectAllLeaves(node);
        return leaves;
    },


    /**
     * Get all leaf descendants of a node efficiently
     */
    getLeafDescendants: function(node, hierarchy) {
        const leaves = [];
        
        const collectLeaves = (currentNode) => {
            if (!currentNode) return;
            
            if (currentNode.isLeaf) {
                leaves.push(currentNode);
                return;
            }
            
            if (currentNode.children && currentNode.children.length > 0) {
                currentNode.children.forEach(childId => {
                    const childNode = typeof childId === 'string' 
                        ? hierarchy.nodesMap[childId] 
                        : childId;
                    
                    if (childNode) {
                        collectLeaves(childNode);
                    }
                });
            }
        };
        
        collectLeaves(node);
        return leaves;
    },


    /**
     * Direct calculation helper for leaf nodes and root
     */
    calculateDirectMeasure: function(records, measureField) {
        if (!records || records.length === 0) {
            return 0;
        }

        let result = 0;
        if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
            records.forEach(record => {
                const value = typeof record[measureField] === 'number' ? 
                    record[measureField] : parseFloat(record[measureField] || 0);
                
                if (!isNaN(value)) {
                    result += value;
                }
            });
        }
        
        return result;
    },


    // Dimension filter functions (simplified for brevity)
    filterByLegalEntity: function (records, node) {
        // console.log(`🔍 LE Filter: Processing node ${node.label} (${node._id})`);
        
        // Don't filter ROOT nodes
        if (node._id === 'ROOT' || node.label === 'WORLDWIDE') {
            // console.log(`🔍 LE Filter: ROOT node - returning all ${records.length} records`);
            return records;
        }
        
        // For leaf nodes with factId, filter directly
        if (node.isLeaf && node.factId) {
            const filtered = records.filter(r => r.LE === node.factId);
            // console.log(`🔍 LE Filter: Leaf node filtering ${records.length} → ${filtered.length} records by LE=${node.factId}`);
            return filtered;
        }
        
        // For hierarchy nodes, use mapping
        const mapping = this.state.mappings?.legalEntity;
        if (!mapping) {
            // console.log("🔍 LE Filter: No LE mapping available - returning all records");
            return records;
        }
        
        // Try to get LE codes for this node
        const leCodes = new Set();
        
        // Method 1: Direct path mapping
        if (mapping.pathToLeCodes && mapping.pathToLeCodes[node.label]) {
            mapping.pathToLeCodes[node.label].forEach(le => leCodes.add(le));
            // console.log(`🔍 LE Filter: Found ${leCodes.size} LEs via pathToLeCodes for "${node.label}"`);
        }
        
        // Method 2: Reverse path lookup
        if (leCodes.size === 0 && mapping.leToPaths) {
            Object.entries(mapping.leToPaths).forEach(([le, paths]) => {
                if (paths.includes(node.label)) {
                    leCodes.add(le);
                }
            });
            // console.log(`🔍 LE Filter: Found ${leCodes.size} LEs via leToPaths for "${node.label}"`);
        }
        
        if (leCodes.size > 0) {
            const filtered = records.filter(r => leCodes.has(r.LE));
            // console.log(`🔍 LE Filter: Filtered ${records.length} → ${filtered.length} records using ${leCodes.size} LE codes`);
            return filtered;
        }
        
        // console.log(`🔍 LE Filter: No matching LE codes found for "${node.label}" - returning all records`);
        return records;
    },


    filterByCostElement: function (records, node) {
        if (node._id === 'ROOT') return records;
        if (node.isLeaf && node.factId) return records.filter(r => r.COST_ELEMENT === node.factId);
        const mapping = this.state.mappings?.costElement;
        const costElements = mapping?.nodeToCostElements[node.label];
        return costElements ? records.filter(r => costElements.has(r.COST_ELEMENT)) : records;
    },


    filterBySmartCode: function (records, node) {
        if (node._id === 'ROOT') return records;
        if (node.isLeaf && node.factId) return records.filter(r => r.ROOT_SMARTCODE === node.factId);
        const mapping = this.state.mappings?.smartCode;
        const smartCodes = mapping?.nodeToSmartCodes[node.label];
        return smartCodes ? records.filter(r => smartCodes.has(r.ROOT_SMARTCODE)) : records;
    },

    
    filterByGmidDisplay: function (records, node) {
        console.log(`🔍 GMID Filter: Processing node "${node.label}" (${node._id}) with ${records.length} records`);
        
        // CRITICAL: Don't filter ROOT nodes - include ALL records for grand totals
        if (node._id === 'ROOT' || 
            node.label === 'All GMIDs' || 
            node._id.endsWith('_ROOT') || 
            node.label === 'WORLDWIDE' ||
            node._id === 'All GMIDs') {
            console.log(`🔍 GMID Filter: ROOT node "${node.label}" - returning all ${records.length} records`);
            return records;
        }

        // For leaf nodes with factId, handle both COMPONENT_GMID and PATH_GMID matching
        if (node.isLeaf && node.factId) {
            console.log(`🔍 GMID Filter: Leaf node with factId: "${node.factId}"`);
            
            let filtered = [];
            
            if (Array.isArray(node.factId)) {
                // Handle multiple factIds
                node.factId.forEach(factId => {
                    const singleFiltered = this.filterByFactId(records, factId);
                    filtered = filtered.concat(singleFiltered);
                });
                
                // Remove duplicates
                filtered = filtered.filter((record, index, self) => 
                    index === self.findIndex(r => 
                        r.PATH_GMID === record.PATH_GMID && 
                        r.COMPONENT_GMID === record.COMPONENT_GMID
                    )
                );
            } else {
                // Single factId
                filtered = this.filterByFactId(records, node.factId);
            }
            
            console.log(`🔍 GMID Filter: Leaf node result: ${filtered.length} records`);
            return filtered;
        }

        // For parent/hierarchy nodes, get all descendant factIds
        const dimName = 'gmid_display';
        const hierarchy = this.state.hierarchies?.[dimName];
        
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[node._id]) {
            const hierarchyNode = hierarchy.nodesMap[node._id];
            const descendants = this.getAllLeafDescendants(hierarchyNode, hierarchy);
            
            if (descendants.length > 0) {
                const factIds = new Set();
                descendants.forEach(desc => {
                    if (desc.factId) {
                        if (Array.isArray(desc.factId)) {
                            desc.factId.forEach(id => factIds.add(id));
                        } else {
                            factIds.add(desc.factId);
                        }
                    }
                });
                
                if (factIds.size > 0) {
                    const filtered = records.filter(record => {
                        // Check both COMPONENT_GMID and PATH_GMID
                        return factIds.has(record.COMPONENT_GMID) || 
                            (record.PATH_GMID && Array.from(factIds).some(factId => 
                                record.PATH_GMID === factId || record.PATH_GMID.includes(factId)
                            ));
                    });
                    console.log(`🔍 GMID Filter: Parent node with ${descendants.length} descendants, ${factIds.size} factIds -> ${filtered.length} records`);
                    return filtered;
                }
            }
        }
        
        // Fallback: no specific filter criteria - return all records
        console.log(`🔍 GMID Filter: No filter criteria for "${node.label}" - returning all ${records.length} records`);
        return records;
    },
    

    // Specific factId filtering logic
    filterByFactId: function(records, factId) {
        if (!factId) {
            // console.log(`🔍 FACT_ID Filter: Empty factId - returning no records`);
            return [];
        }
        
        // console.log(`🔍 FACT_ID Filter: Processing factId "${factId}"`);
        
        // Strategy 1: If factId ends with '#', it's a PATH_GMID (for NULL COMPONENT_GMID records)
        if (factId.endsWith('#')) {
            const pathMatches = records.filter(r => r.PATH_GMID === factId);
            // console.log(`🔍 FACT_ID Filter: PATH_GMID exact match for "${factId}": ${pathMatches.length} records`);
            
            // Also check for records where COMPONENT_GMID matches but is derived from this PATH
            const componentMatches = records.filter(r => 
                r.COMPONENT_GMID && r.PATH_GMID === factId
            );
            // console.log(`🔍 FACT_ID Filter: Additional COMPONENT_GMID matches: ${componentMatches.length} records`);
            
            // Combine and deduplicate
            const combined = [...pathMatches, ...componentMatches];
            const unique = combined.filter((record, index, self) => 
                index === self.findIndex(r => 
                    r.PATH_GMID === record.PATH_GMID && 
                    r.COMPONENT_GMID === record.COMPONENT_GMID
                )
            );
            
            return unique;
        }
        
        // Strategy 2: Regular COMPONENT_GMID matching
        const componentMatches = records.filter(r => r.COMPONENT_GMID === factId);
        // console.log(`🔍 FACT_ID Filter: COMPONENT_GMID exact match for "${factId}": ${componentMatches.length} records`);
        
        // Strategy 3: If no COMPONENT_GMID matches, try PATH_GMID contains
        if (componentMatches.length === 0) {
            const pathContains = records.filter(r => 
                r.PATH_GMID && r.PATH_GMID.includes(factId)
            );
            // console.log(`🔍 FACT_ID Filter: PATH_GMID contains "${factId}": ${pathContains.length} records`);
            return pathContains;
        }
        
        return componentMatches;
    },


    filterByItemCostType: function (records, node) {
        if (node._id === 'ROOT') return records;
        if (node.factId) return records.filter(r => r.ITEM_COST_TYPE === node.factId);
        return records;
    },


    filterByMaterialType: function (records, node) {
        if (node._id === 'ROOT') return records;
        if (node.factId) return records.filter(r => r.COMPONENT_MATERIAL_TYPE === node.factId);
        return records;
    },

    
    /**
     * Filter records by MC
     */
    filterByMC: function(records, node) {
        if (!state.mappings || !state.mappings.managementCentre || node._id === 'ROOT') return records;

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
        // console.log(`Filtering by MC node ${nodeLabel}: Found ${mcCodes.size} matching MC codes`);
        
        // If we found LE codes, filter the records
        if (mcCodes.size > 0) {
            return records.filter(record => 
                record.MC && mcCodes.has(record.MC)
            );
        }
        
        // If we didn't find any matching LE codes, just return the records as is
        console.warn(`⚠️ Warning: No matching MC codes found for node ${nodeLabel}`);
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
     * Get visible rows
     */
    getVisibleRows: function (rows) {
        return rows.filter(row => {
            if (row._id === 'ROOT' || !row.path || row.path.length <= 1) return true;
            const dimName = row.hierarchyField.replace('DIM_', '').toLowerCase();
            for (let i = 1; i < row.path.length - 1; i++) {
                if (!this.state.expandedNodes?.[dimName]?.row?.[row.path[i]]) return false;
            }
            return true;
        });
    },


    /**
     * Get column levels for stacking
     */
    getColumnLevels: function (columns) {
        const levels = {};
        columns.forEach(col => {
            const level = col.level || 0;
            levels[level] = levels[level] || [];
            levels[level].push(col);
        });
        return Object.values(levels);
    },


    /**
     * Count leaf nodes
     */
    countLeafNodes: function (node) {
        if (!node) return 0;
        if (node.isLeaf) return 1;
        if (!node.children) return 1;
        return node.children.reduce((count, childId) => {
            const childNode = this.state.hierarchies[node.hierarchyField.replace('DIM_', '').toLowerCase()]?.nodesMap[childId];
            return count + (childNode ? this.countLeafNodes(childNode) : 0);
        }, 0);
    },


    /**
     * Enhanced renderTableBody to properly handle dynamic column depths
     */
    renderTableBody: function(elements, pivotData) {
        if (!elements || !elements.pivotTableBody || !pivotData) return;

        const valueFields = this.state?.valueFields || ['COST_UNIT'];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
        
        const realColumns = columns.filter(col => 
            col._id !== 'default' && 
            col._id !== 'no_columns' &&
            col.label !== 'Value' &&
            col.hierarchyField
        );
        
        const hasRealColumnDimensions = realColumns.length > 0;
        let bodyHtml = '';
        
        const visibleRows = this.getVisibleRowsWithoutDuplicates(pivotData.rows);
        
        // Check maximum depth for this render
        let maxDepthThisRender = 0;
        
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};
            const level = row.level || 0;
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';
            
            // Track maximum depth
            if (level > maxDepthThisRender) {
                maxDepthThisRender = level;
            }
            
            // Calculate 30px indentation per level (supports up to level 30)
            const indentationPx = 4 + (Math.min(level, 30) * 30); // Cap at level 30
            
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Enhanced row header cell with proper indentation and level tracking
            bodyHtml += `<td class="hierarchy-cell" data-level="${level}" data-node-id="${row._id}" style="padding-left: ${indentationPx}px !important;">`;
            
            // Add expand/collapse control with enhanced styling
            if (row.hasChildren) {
                const expandClass = row.expanded ? 'expanded' : 'collapsed';
                bodyHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${row._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="row"
                    onclick="handleExpandCollapseClick(event)"
                    title="Click to expand/collapse ${row.label}"></span>`;
            } else {
                bodyHtml += '<span class="leaf-node"></span>';
            }
            
            bodyHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
            bodyHtml += '</td>';

            // Value cells
            if (hasRealColumnDimensions) {
                const leafColumns = this.getVisibleLeafColumns(realColumns);
                valueFields.forEach(field => {
                    leafColumns.forEach(col => {
                        const key = `${col._id}|${field}`;
                        const value = rowData[key] || 0;
                        bodyHtml += this.renderValueCell(value);
                    });
                });
            } else {
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    bodyHtml += this.renderValueCell(value);
                });
            }
            
            bodyHtml += '</tr>';
        });

        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody);
        
        // Apply visual hierarchy styles
        this.applyHierarchyStyles();
        
        console.log(`✅ Rendered ${visibleRows.length} rows with max depth ${maxDepthThisRender} (30px indentation per level)`);
    },


    applyHierarchyStyles: function() {
        // Add CSS for enhanced hierarchy visualization with 30 levels support
        let styleElement = document.getElementById('pivot-hierarchy-styles');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'pivot-hierarchy-styles';
            document.head.appendChild(styleElement);
            
            // Generate CSS for 30 levels dynamically
            let levelCSS = '';
            for (let level = 0; level <= 30; level++) {
                const indentationPx = 4 + (level * 30);
                levelCSS += `.hierarchy-cell[data-level="${level}"] { padding-left: ${indentationPx}px !important; }\n`;
                levelCSS += `.dimension-cell[data-level="${level}"] { padding-left: ${indentationPx}px !important; }\n`;
            }
            
            const css = `
                /* Enhanced hierarchy visualization with 30px indentation for 30 levels */
                .hierarchy-cell, .dimension-cell {
                    position: relative !important;
                    border-left: 2px solid transparent !important;
                    transition: background-color 0.2s ease !important;
                }
                
                /* Level-specific indentation (0-30 levels) */
                ${levelCSS}
                
                /* Visual styling by level groups */
                .hierarchy-cell[data-level="0"], .dimension-cell[data-level="0"] {
                    font-weight: bold !important;
                    background-color: #f8f9fa !important;
                    border-left-color: #007bff !important;
                    border-left-width: 4px !important;
                }
                
                .hierarchy-cell[data-level="1"], .dimension-cell[data-level="1"] {
                    font-weight: 600 !important;
                    background-color: #f1f3f5 !important;
                    border-left-color: #28a745 !important;
                    border-left-width: 3px !important;
                }
                
                .hierarchy-cell[data-level="2"], .dimension-cell[data-level="2"] {
                    font-weight: 500 !important;
                    background-color: #ffffff !important;
                    border-left-color: #ffc107 !important;
                    border-left-width: 2px !important;
                }
                
                /* Levels 3-5: Orange gradient */
                .hierarchy-cell[data-level="3"], .hierarchy-cell[data-level="4"], .hierarchy-cell[data-level="5"],
                .dimension-cell[data-level="3"], .dimension-cell[data-level="4"], .dimension-cell[data-level="5"] {
                    background-color: #fff8f0 !important;
                    border-left-color: #fd7e14 !important;
                    border-left-width: 2px !important;
                }
                
                /* Levels 6-10: Purple gradient */
                .hierarchy-cell[data-level="6"], .hierarchy-cell[data-level="7"], .hierarchy-cell[data-level="8"], 
                .hierarchy-cell[data-level="9"], .hierarchy-cell[data-level="10"],
                .dimension-cell[data-level="6"], .dimension-cell[data-level="7"], .dimension-cell[data-level="8"], 
                .dimension-cell[data-level="9"], .dimension-cell[data-level="10"] {
                    background-color: #f8f0ff !important;
                    border-left-color: #6f42c1 !important;
                    border-left-width: 1px !important;
                }
                
                /* Levels 11-15: Teal gradient */
                .hierarchy-cell[data-level="11"], .hierarchy-cell[data-level="12"], .hierarchy-cell[data-level="13"], 
                .hierarchy-cell[data-level="14"], .hierarchy-cell[data-level="15"],
                .dimension-cell[data-level="11"], .dimension-cell[data-level="12"], .dimension-cell[data-level="13"], 
                .dimension-cell[data-level="14"], .dimension-cell[data-level="15"] {
                    background-color: #f0fdff !important;
                    border-left-color: #20c997 !important;
                    border-left-width: 1px !important;
                    font-size: 0.9rem !important;
                }
                
                /* Levels 16-20: Pink gradient */
                .hierarchy-cell[data-level="16"], .hierarchy-cell[data-level="17"], .hierarchy-cell[data-level="18"], 
                .hierarchy-cell[data-level="19"], .hierarchy-cell[data-level="20"],
                .dimension-cell[data-level="16"], .dimension-cell[data-level="17"], .dimension-cell[data-level="18"], 
                .dimension-cell[data-level="19"], .dimension-cell[data-level="20"] {
                    background-color: #fff0f5 !important;
                    border-left-color: #e83e8c !important;
                    border-left-width: 1px !important;
                    font-size: 0.85rem !important;
                }
                
                /* Levels 21-25: Dark blue gradient */
                .hierarchy-cell[data-level="21"], .hierarchy-cell[data-level="22"], .hierarchy-cell[data-level="23"], 
                .hierarchy-cell[data-level="24"], .hierarchy-cell[data-level="25"],
                .dimension-cell[data-level="21"], .dimension-cell[data-level="22"], .dimension-cell[data-level="23"], 
                .dimension-cell[data-level="24"], .dimension-cell[data-level="25"] {
                    background-color: #f0f4ff !important;
                    border-left-color: #0d6efd !important;
                    border-left-width: 1px !important;
                    font-size: 0.8rem !important;
                }
                
                /* Levels 26-30: Gray gradient for deepest levels */
                .hierarchy-cell[data-level="26"], .hierarchy-cell[data-level="27"], .hierarchy-cell[data-level="28"], 
                .hierarchy-cell[data-level="29"], .hierarchy-cell[data-level="30"],
                .dimension-cell[data-level="26"], .dimension-cell[data-level="27"], .dimension-cell[data-level="28"], 
                .dimension-cell[data-level="29"], .dimension-cell[data-level="30"] {
                    background-color: #f8f9fa !important;
                    border-left-color: #6c757d !important;
                    border-left-width: 1px !important;
                    font-size: 0.75rem !important;
                    color: #495057 !important;
                }
                
                /* Hover effects for all levels */
                .hierarchy-cell[data-level]:hover, .dimension-cell[data-level]:hover {
                    background-color: #e9ecef !important;
                    cursor: pointer !important;
                }
                
                /* Enhanced expand/collapse controls */
                .expand-collapse {
                    display: inline-block !important;
                    width: 16px !important;
                    height: 16px !important;
                    margin-right: 8px !important;
                    cursor: pointer !important;
                    font-size: 12px !important;
                    line-height: 14px !important;
                    text-align: center !important;
                    border: 1px solid #6c757d !important;
                    border-radius: 2px !important;
                    background-color: #ffffff !important;
                    font-weight: bold !important;
                }
                
                .expand-collapse.expanded::before {
                    content: '−' !important;
                    color: #dc3545 !important;
                }
                
                .expand-collapse.collapsed::before {
                    content: '+' !important;
                    color: #28a745 !important;
                }
                
                .expand-collapse:hover {
                    background-color: #f8f9fa !important;
                    border-color: #495057 !important;
                }
                
                /* Leaf node indicators */
                .leaf-node {
                    display: inline-block !important;
                    width: 16px !important;
                    height: 16px !important;
                    margin-right: 8px !important;
                    text-align: center !important;
                    line-height: 14px !important;
                    color: #6c757d !important;
                    font-size: 10px !important;
                }
                
                .leaf-node::before {
                    content: '•' !important;
                }
                
                /* Connection lines for very deep hierarchies */
                .hierarchy-cell[data-level]:before, .dimension-cell[data-level]:before {
                    content: '' !important;
                    position: absolute !important;
                    left: 2px !important;
                    top: 0 !important;
                    bottom: 0 !important;
                    width: 1px !important;
                    background: linear-gradient(to bottom, #dee2e6 0%, #dee2e6 50%, transparent 50%) !important;
                    opacity: 0.5 !important;
                }
                
                /* Hide connection lines for root level */
                .hierarchy-cell[data-level="0"]:before, .dimension-cell[data-level="0"]:before {
                    display: none !important;
                }
                
                /* Responsive adjustments for deep hierarchies */
                @media (max-width: 1200px) {
                    .hierarchy-cell[data-level], .dimension-cell[data-level] {
                        font-size: 0.8rem !important;
                    }
                    
                    .expand-collapse {
                        width: 14px !important;
                        height: 14px !important;
                        font-size: 10px !important;
                        line-height: 12px !important;
                    }
                }
                
                /* Ensure text doesn't get cut off at deep levels */
                .dimension-label {
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    max-width: calc(100vw - 50px) !important;
                }
                
                /* Add subtle shadows for depth perception */
                .hierarchy-cell[data-level]:after, .dimension-cell[data-level]:after {
                    content: '' !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    box-shadow: inset 1px 0 0 rgba(0,0,0,0.1) !important;
                    pointer-events: none !important;
                }
            `;
            
            styleElement.textContent = css;
            console.log("✅ Applied enhanced hierarchy styles with 30-level support (30px indentation per level)");
        }
    },


    // Method to check maximum depth
    getMaxHierarchyDepth: function() {
        let maxDepth = 0;
        
        if (this.state && this.state.pivotData && this.state.pivotData.rows) {
            this.state.pivotData.rows.forEach(row => {
                const level = row.level || 0;
                if (level > maxDepth) {
                    maxDepth = level;
                }
            });
        }
        
        console.log(`📊 Maximum hierarchy depth detected: ${maxDepth} levels`);
        return maxDepth;
    },


    /**
     * Calculate cross-dimensional measure for stacked columns
     */
    calculateCrossDimensionalMeasure: function(rowNode, columnNodes, measureField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData)];
        
        // console.log(`🔍 CROSS-CALC: Row ${rowNode.label} × Columns [${columnNodes.map(n => n.label).join(', ')}] × ${measureField}`);
        
        // Apply row filtering
        if (rowNode && rowNode._id !== 'ROOT' && !rowNode._id.includes('ROOT')) {
            filteredData = this.filterRecordsByDimension(filteredData, rowNode);
            // console.log(`  After row filter: ${filteredData.length} records`);
        }
        
        // Apply each column dimension filter
        columnNodes.forEach((colNode, index) => {
            if (colNode && colNode._id !== 'ROOT' && !colNode._id.includes('ROOT')) {
                const beforeCount = filteredData.length;
                filteredData = this.filterRecordsByDimension(filteredData, colNode);
                // console.log(`  After column ${index} filter (${colNode.label}): ${filteredData.length} records (was ${beforeCount})`);
            }
        });
        
        // Calculate the measure
        const result = this.calculateDirectMeasure(filteredData, measureField);
        // console.log(`  Final result: ${result} from ${filteredData.length} records`);
        
        return result;
    },


    /**
     * ENHANCED: Updated generatePivotTable to detect stacked columns
     * Add this logic to your existing generatePivotTable method
     */
    detectAndApplyStackedColumnsMode: function() {
        const columnFields = this.state.columnFields || [];
        const container = document.querySelector('.pivot-table-container');
        
        if (container) {
            if (columnFields.length > 1) {
                // Enable stacked columns mode
                container.classList.add('stacked-columns');
                // console.log(`🏗️ Enabled stacked columns mode for ${columnFields.length} column dimensions`);
            } else {
                // Disable stacked columns mode
                container.classList.remove('stacked-columns');
            }
        }
    },


    /**
     * Process pivot data
     */
    processPivotData: function () {
        if (!this.state.factData || this.state.factData.length === 0) {
            console.error("No fact data available for pivot table");
            return;
        }

        const rowFields = this.state.rowFields || [];
        const columnFields = this.state.columnFields || [];
        const valueFields = this.state.valueFields || ['COST_UNIT'];

        if (rowFields.length === 0) {
            console.warn("No row fields selected, defaulting to first available dimension");
        }

        console.log(`📊 Processing pivot data: ${rowFields.length} row fields, ${columnFields.length} column fields`);

        // CRITICAL FIX: Auto-expand hierarchies when all items are selected
        this.autoExpandForAllSelected(rowFields);

        // Process row data with better error handling
        let rowData;
        try {
            if (typeof data !== 'undefined' && data.processHierarchicalFields) {
                rowData = data.processHierarchicalFields(rowFields, 'row');
            } else {
                rowData = this.processMultiDimensionFields(rowFields, 'row');
            }
        } catch (error) {
            console.error("Error processing row fields:", error);
            rowData = { flatRows: [], flatMappings: [] };
        }
        
        // Process columns
        let columnData;
        try {
            if (columnFields.length > 0) {
                if (typeof data !== 'undefined' && data.processHierarchicalFields) {
                    columnData = data.processHierarchicalFields(columnFields, 'column');
                } else {
                    columnData = this.processMultiDimensionFields(columnFields, 'column');
                }
            } else {
                columnData = { 
                    flatRows: [{ _id: 'default', label: 'Value' }], 
                    flatMappings: [{ _id: 'default', isLeaf: true }] 
                };
            }
        } catch (error) {
            console.error("Error processing column fields:", error);
            columnData = { 
                flatRows: [{ _id: 'default', label: 'Value' }], 
                flatMappings: [{ _id: 'default', isLeaf: true }] 
            };
        }

        // Initialize pivotData
        this.state.pivotData = {
            rows: rowData.flatRows || [],
            rowMappings: rowData.flatMappings || [],
            columns: columnData.flatRows || [],
            columnMappings: columnData.flatMappings || [],
            data: []
        };

        console.log(`📊 Pivot data structure: ${this.state.pivotData.rows.length} rows, ${this.state.pivotData.columns.length} columns`);

        // Calculate the values for each cell
        this.calculatePivotCells();
    },


    // Method to auto-expand hierarchies when all items are selected
    autoExpandForAllSelected: function(rowFields) {
        console.log("🔧 Auto-expanding hierarchies for 'all selected' state...");
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            
            // First analyze the hierarchy structure
            this.analyzeHierarchyStructure(dimName);
            
            // Check if this dimension has all items selected (no exclusions)
            const filterSystem = window.EnhancedFilterSystem;
            if (!filterSystem) return;
            
            const dimensionMeta = Object.values(filterSystem.filterMeta).find(meta => 
                extractDimensionName(meta.dimensionKey) === dimName
            );
            
            if (!dimensionMeta) return;
            
            const exclusions = filterSystem.filterSelections[dimensionMeta.id];
            const allSelected = !exclusions || exclusions.size === 0;
            
            if (allSelected) {
                console.log(`✅ All items selected for ${dimName} - expanding hierarchy`);
                this.expandFirstLevelForDimension(dimName);
            } else {
                console.log(`⏸️ Some items filtered for ${dimName} - keeping current expansion`);
            }
        });
    },


    // Method to manually expand GMID hierarchy for debugging
    manuallyExpandGMIDHierarchy: function() {
        console.log("🔧 Manually expanding GMID hierarchy...");
        
        const dimName = 'gmid_display';
        
        // First analyze what we have
        this.analyzeHierarchyStructure(dimName);
        
        const hierarchy = this.state.hierarchies?.[dimName];
        if (!hierarchy || !hierarchy.nodesMap) {
            console.error("❌ GMID hierarchy not found");
            return false;
        }
        
        // Initialize expansion tracking
        if (!this.state.expandedNodes) {
            this.state.expandedNodes = {};
        }
        if (!this.state.expandedNodes[dimName]) {
            this.state.expandedNodes[dimName] = { row: {}, column: {} };
        }
        
        // Strategy 1: Try to expand ROOT if it exists
        const rootNode = hierarchy.nodesMap['ROOT'];
        if (rootNode) {
            rootNode.expanded = true;
            this.state.expandedNodes[dimName].row['ROOT'] = true;
            console.log(`✅ Expanded ROOT node`);
        }
        
        // Strategy 2: Find and expand top-level nodes
        const topLevelNodes = [];
        Object.values(hierarchy.nodesMap).forEach(node => {
            // Look for nodes at level 0 or 1 that are not ROOT
            if ((node.level === 0 || node.level === 1) && node.id !== 'ROOT') {
                topLevelNodes.push(node);
            }
        });
        
        console.log(`🔍 Found ${topLevelNodes.length} potential top-level nodes`);
        
        // Expand first few top-level nodes
        const nodesToExpand = Math.min(topLevelNodes.length, 3);
        for (let i = 0; i < nodesToExpand; i++) {
            const node = topLevelNodes[i];
            node.expanded = true;
            this.state.expandedNodes[dimName].row[node.id] = true;
            console.log(`✅ Expanded top-level node: ${node.label || node.id}`);
        }
        
        // Strategy 3: If still no expansion, try expanding nodes with children
        if (nodesToExpand === 0) {
            console.log(`🔍 No top-level nodes found, looking for nodes with children...`);
            const nodesWithChildren = Object.values(hierarchy.nodesMap).filter(node => 
                node.children && node.children.length > 0
            );
            
            console.log(`🔍 Found ${nodesWithChildren.length} nodes with children`);
            
            // Expand first few nodes with children
            const childNodesToExpand = Math.min(nodesWithChildren.length, 3);
            for (let i = 0; i < childNodesToExpand; i++) {
                const node = nodesWithChildren[i];
                node.expanded = true;
                this.state.expandedNodes[dimName].row[node.id] = true;
                console.log(`✅ Expanded node with children: ${node.label || node.id} (${node.children.length} children)`);
            }
        }
        
        // Regenerate pivot table
        console.log(`🔄 Regenerating pivot table...`);
        this.generatePivotTable();
        
        return true;
    },


    // Method to expand first level of a hierarchy
    expandFirstLevelForDimension: function(dimName) {
        const hierarchy = this.state.hierarchies?.[dimName];
        if (!hierarchy || !hierarchy.nodesMap) {
            console.warn(`No hierarchy found for ${dimName}`);
            return;
        }
        
        // Initialize expansion tracking if needed
        if (!this.state.expandedNodes) {
            this.state.expandedNodes = {};
        }
        if (!this.state.expandedNodes[dimName]) {
            this.state.expandedNodes[dimName] = { row: {}, column: {} };
        }
        
        console.log(`🔍 Analyzing hierarchy structure for ${dimName}...`);
        console.log(`🔍 Total nodes in hierarchy: ${Object.keys(hierarchy.nodesMap).length}`);
        
        // CRITICAL FIX: Handle both single-root and multi-root hierarchies
        const rootNode = hierarchy.nodesMap['ROOT'];
        
        if (rootNode && rootNode.children && rootNode.children.length > 0) {
            // Traditional single-root hierarchy
            console.log(`📂 Single-root hierarchy detected for ${dimName}`);
            rootNode.expanded = true;
            this.state.expandedNodes[dimName].row['ROOT'] = true;
            console.log(`📂 Expanded ROOT node, showing ${rootNode.children.length} children`);
            
        } else {
            // MULTI-ROOT HIERARCHY (like GMID_DISPLAY)
            console.log(`📂 Multi-root hierarchy detected for ${dimName}`);
            
            // Find all level-1 nodes (top-level nodes that are not ROOT)
            const topLevelNodes = [];
            Object.values(hierarchy.nodesMap).forEach(node => {
                if (node.level === 1 || (node.level === 0 && node.id !== 'ROOT')) {
                    topLevelNodes.push(node);
                }
            });
            
            console.log(`📂 Found ${topLevelNodes.length} top-level nodes`);
            topLevelNodes.forEach(node => {
                console.log(`  - ${node.label || node.id} (${node.id})`);
            });
            
            if (topLevelNodes.length > 0) {
                // Expand the first few top-level nodes to show meaningful data
                const nodesToExpand = Math.min(topLevelNodes.length, 5); // Limit to first 5 to avoid overwhelming
                
                for (let i = 0; i < nodesToExpand; i++) {
                    const node = topLevelNodes[i];
                    node.expanded = true;
                    this.state.expandedNodes[dimName].row[node.id] = true;
                    console.log(`📂 Auto-expanded top-level node: ${node.label || node.id}`);
                }
                
                console.log(`✅ Auto-expanded ${nodesToExpand} top-level nodes for ${dimName}`);
            } else {
                console.warn(`⚠️ No top-level nodes found for ${dimName}`);
            }
            
            // Also try to expand ROOT if it exists but has no children
            if (rootNode) {
                rootNode.expanded = true;
                this.state.expandedNodes[dimName].row['ROOT'] = true;
                console.log(`📂 Also expanded ROOT node for visibility`);
            }
        }
    },


    // FIX 2: Add method to analyze and debug hierarchy structure
    analyzeHierarchyStructure: function(dimName) {
        console.log(`🔍 ANALYZING HIERARCHY STRUCTURE: ${dimName}`);
        console.log("=".repeat(50));
        
        const hierarchy = this.state.hierarchies?.[dimName];
        if (!hierarchy || !hierarchy.nodesMap) {
            console.log("❌ No hierarchy found");
            return;
        }
        
        const nodes = Object.values(hierarchy.nodesMap);
        console.log(`📊 Total nodes: ${nodes.length}`);
        
        // Group by level
        const nodesByLevel = {};
        nodes.forEach(node => {
            const level = node.level || 0;
            if (!nodesByLevel[level]) {
                nodesByLevel[level] = [];
            }
            nodesByLevel[level].push(node);
        });
        
        // Show structure by level
        Object.keys(nodesByLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
            const levelNodes = nodesByLevel[level];
            console.log(`📊 Level ${level}: ${levelNodes.length} nodes`);
            
            // Show first few nodes as examples
            const examples = levelNodes.slice(0, 3);
            examples.forEach(node => {
                const hasChildren = node.children && node.children.length > 0;
                const expanded = node.expanded ? '📂' : '📁';
                console.log(`  ${expanded} ${node.label || node.id} (${node.id}) - Children: ${hasChildren ? node.children.length : 0}`);
            });
            
            if (levelNodes.length > 3) {
                console.log(`  ... and ${levelNodes.length - 3} more`);
            }
        });
        
        // Check ROOT node specifically
        const rootNode = hierarchy.nodesMap['ROOT'];
        if (rootNode) {
            console.log(`🎯 ROOT node analysis:`);
            console.log(`  - Label: ${rootNode.label}`);
            console.log(`  - Level: ${rootNode.level}`);
            console.log(`  - Has children: ${rootNode.children ? rootNode.children.length : 0}`);
            console.log(`  - Expanded: ${rootNode.expanded}`);
        } else {
            console.log(`🎯 No ROOT node found`);
        }
        
        // Check expansion state
        const expansionState = this.state.expandedNodes?.[dimName]?.row || {};
        const expandedCount = Object.values(expansionState).filter(Boolean).length;
        console.log(`🎯 Currently expanded nodes: ${expandedCount}`);
        
        console.log("=".repeat(50));
    },


    /**
     * Process multiple dimension fields
     */
    processMultiDimensionFields: function (fields, zone) {
        const flatRows = [];
        const flatMappings = [];
        
        const processNodeRecursive = (node, dimensionField, hierarchy, path, level) => {
            const dimensionName = extractDimensionName(dimensionField);
            const hasChildren = this.nodeHasChildren ? this.nodeHasChildren(node) : 
                            (node.children && node.children.length > 0);
            
            // Check expansion state - default to false (collapsed)
            const isExpanded = this.state.expandedNodes?.[dimensionName]?.[zone]?.[node.id] || false;
            
            const processedNode = {
                _id: node.id,
                label: node.label || node.id,
                hierarchyField: dimensionField,
                level: level,
                path: [...path, node.id],
                hasChildren: hasChildren,
                isLeaf: !hasChildren,
                expanded: isExpanded,
                dimension: dimensionField,
                factId: node.factId
            };
            
            flatRows.push(processedNode);
            flatMappings.push({ 
                _id: node.id, 
                dimension: dimensionField, 
                level: level 
            });
            
            // Only process children if expanded
            if (hasChildren && isExpanded && node.children) {
                node.children.forEach(childId => {
                    const childNode = hierarchy.nodesMap[childId];
                    if (childNode) {
                        processNodeRecursive(
                            childNode, 
                            dimensionField, 
                            hierarchy, 
                            processedNode.path, 
                            level + 1
                        );
                    }
                });
            }
        };

        fields.forEach((dimensionField) => {
            const dimensionName = extractDimensionName(dimensionField);
            const hierarchy = this.state.hierarchies[dimensionName];
            
            if (!hierarchy) {
                console.warn(`Hierarchy not found for dimension: ${dimensionName}`);
                return;
            }
            
            const rootNode = hierarchy.nodesMap['ROOT'];
            if (rootNode) {
                processNodeRecursive(rootNode, dimensionField, hierarchy, [], 0);
            }
        });
        
        return { flatRows, flatMappings };
    },


    /**
     * Calculate pivot cells
     */
    calculatePivotCells: function () {
        const pivotData = this.state.pivotData;
        
        // Use filtered data if available
        const factData = this.state.filteredData && this.state.filteredData.length > 0 
            ? this.state.filteredData 
            : this.state.factData || [];
        
        // console.log(`🔍 CALC: Using ${this.state.filteredData ? 'FILTERED' : 'ORIGINAL'} data with ${factData.length} records`);
        
        const valueFields = this.state.valueFields || ['COST_UNIT'];

        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }

        // Clear existing data
        pivotData.data = [];

        // Identify real column dimensions
        const realColumns = pivotData.columns.filter(col => 
            col._id !== 'ROOT' && 
            col._id !== 'default' && 
            col._id !== 'no_columns' &&
            col.label !== 'Value' &&
            col.label !== 'All Data' &&
            col.label !== 'Measures' &&
            col.hierarchyField
        );
        
        const hasRealColumnDimensions = realColumns.length > 0;
        // console.log(`🔍 CALC: Has real column dimensions: ${hasRealColumnDimensions}, ${realColumns.length} columns`);

        // Process each row with performance timing
        pivotData.rows.forEach((rowDef, rowIndex) => {
            const startTime = performance.now();
            const rowData = { _id: rowDef._id };

            if (hasRealColumnDimensions) {
                // HAS COLUMN DIMENSIONS: Use cross-tabulation with proper filtering
                realColumns.forEach((colDef) => {
                    valueFields.forEach((fieldId) => {
                        // CRITICAL FIX: Apply BOTH row and column filtering
                        let crossFilteredData = [...factData];
                        
                        // Apply row filtering
                        crossFilteredData = this.filterRecordsByDimension(crossFilteredData, rowDef);
                        
                        // Apply column filtering
                        crossFilteredData = this.filterRecordsByDimension(crossFilteredData, colDef);
                        
                        // Calculate measure on the cross-filtered data
                        const value = this.calculateDirectMeasure(crossFilteredData, fieldId);
                        const key = `${colDef._id}|${fieldId}`;
                        rowData[key] = typeof value === 'number' ? value : (parseFloat(value) || 0);
                        
                        // console.log(`🔍 CROSS-CALC: Row ${rowDef.label} × Col ${colDef.label} × ${fieldId} = ${value} (from ${crossFilteredData.length} records)`);
                    });
                });
            } else {
                // NO COLUMN DIMENSIONS: Calculate measures directly
                valueFields.forEach((fieldId) => {
                    const value = this.calculateMeasure(factData, rowDef, null, fieldId);
                    rowData[fieldId] = typeof value === 'number' ? value : (parseFloat(value) || 0);
                    // console.log(`🔍 DIRECT-CALC: Row ${rowDef.label} × ${fieldId} = ${value}`);
                });
            }

            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            // Only log slow calculations
            // if (processingTime > 10) {
            //     console.log(`⏱️ Row ${rowIndex} (${rowDef.label}): ${processingTime.toFixed(2)}ms`);
            // }

            pivotData.data.push(rowData);
        });

        // console.log(`✅ Pivot calculation complete: ${pivotData.rows.length} rows processed`);
        return pivotData.data;
    },


    /**
     * Filters records by a specific dimension node
     */
    filterByDimensionNode: function(records, node) {
        if (!node || !node.hierarchyField) {
            return records;
        }
        
        // Don't filter overall ROOT nodes - let them show grand totals
        if (node._id === 'ROOT' || node.label === 'WORLDWIDE' || 
            node._id === 'ROOT_WORLDWIDE' || node.label === 'All GMIDs' ||
            node._id === 'All GMIDs') {
            return records;
        }
        
        // Get dimension name
        const dimName = node.hierarchyField.replace('DIM_', '').toLowerCase();
        
        // For leaf nodes, use direct factId filtering (much faster)
        if (node.isLeaf && node.factId) {
            const factField = this.getFactIdField(dimName);
            if (factField) {
                return records.filter(record => {
                    if (Array.isArray(node.factId)) {
                        return node.factId.includes(record[factField]);
                    }
                    return record[factField] === node.factId;
                });
            }
        }
        
        // For parent nodes, this should not be called in the new approach
        // but keeping as fallback
        // console.warn(`⚠️ Filtering parent node ${node._id} - this should use descendant aggregation instead`);
        
        // Dimension-specific filtering (fallback)
        switch (dimName) {
            case 'le':
            case 'legal_entity':
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
                console.warn(`⚠️ Unknown dimension: ${dimName}`);
                return records;
        }
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
            'root_gmid_display': 'ROOT_GMID',
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
     * Gets the corresponding fact table field name for a dimension
     * 
     * @param {string} dimName - Dimension name
     * @returns {string|null} - Corresponding dimension table field name or null if not found
     */
    getDimensionIdField: function(dimName) {
        // Define mapping between dimension names and pk field names
        const dimensionIdFieldMap = {
            'le': 'LE',
            'cost_element': 'COST_ELEMENT',
            'root_gmid_display': 'ROOT_GMID',
            'gmid_display': 'COMPONENT_GMID',
            'smartcode': 'SMARTCODE',
            'item_cost_type': 'ITEM_COST_TYPE',
            'material_type': 'MATERIAL_TYPE',
            'year': 'YEAR',
            'mc': 'MC'
        };
        
        return dimensionIdFieldMap[dimName.toLowerCase()] || null;
    },


    /**
     * Gets visible leaf columns
     */
    getVisibleLeafColumns: function (columns) {
        const visibleLeafs = [];

        const findVisibleLeafs = (column) => {
            if (!column) return;

            if (column.isLeaf) {
                visibleLeafs.push(column);
                return;
            }

            if (!column.expanded) {
                visibleLeafs.push(column);
                return;
            }

            if (column.children && column.children.length > 0) {
                column.children.forEach(childId => {
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
                visibleLeafs.push(column);
            }
        };

        columns.forEach(column => {
            findVisibleLeafs(column);
        });

        return visibleLeafs;
    },


    /**
     * Counts leaf nodes under a node
     */
    countLeafNodes: function (node) {
        if (!node) return 0;
        if (node.isLeaf) return 1;
        if (!node.children || node.children.length === 0) return 1;

        let count = 0;
        node.children.forEach(childId => {
            if (typeof childId === 'string') {
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
     * Safely get DOM element
     */
    getElement: function (id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },


    /**
     * Toggle loading indicator
     */
    toggleLoading: function (show = true) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    },


    /**
     * Checks if a hierarchy node should be visible
     */
    isNodeVisible: function (row, allNodes) {
        if (!row || !allNodes || !Array.isArray(allNodes)) {
            return true;
        }

        if (!row.hierarchyField || !row.path || !Array.isArray(row.path) || row.path.length <= 1 || row._id === 'ROOT') {
            return true;
        }

        const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';

        for (let i = 1; i < row.path.length - 1; i++) {
            const ancestorId = row.path[i];
            if (!ancestorId) continue;

            const ancestorNode = Array.isArray(allNodes) ?
                allNodes.find(n => n && n._id === ancestorId) : null;

            if (ancestorNode && ancestorNode.expanded === false) {
                return false;
            }
        }

        if (this.state && this.state.expandedNodes) {
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : null;
            if (dimName && row.path && Array.isArray(row.path) && row.path.length > 1) {
                for (let i = 1; i < row.path.length - 1; i++) {
                    const ancestorId = row.path[i];
                    if (!ancestorId) continue;

                    const isExpanded = this.state.expandedNodes[dimName] &&
                        this.state.expandedNodes[dimName].row &&
                        this.state.expandedNodes[dimName].row[ancestorId];

                    if (isExpanded === false) {
                        return false;
                    }
                }
            }
        }

        return true;
    },


    /**
     * Renders a single row cell
     */
    renderRowCell: function(rowDef) {
        const level = rowDef.level || 0;
        const indentationPx = 4 + (level * 30); // Enhanced to 30px per level
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';

        let cellHtml = `<td class="hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;

        if (rowDef.hasChildren === true) {
            const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${rowDef._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="handleExpandCollapseClick(event)"
                style="cursor: pointer; display: inline-block; width: 16px; height: 16px; margin-right: 8px; text-align: center; border: 1px solid #6c757d; border-radius: 2px; background: white; line-height: 14px; font-size: 12px;"
                title="Click to expand/collapse ${rowDef.label}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node" style="display: inline-block; width: 16px; height: 16px; margin-right: 8px; text-align: center; line-height: 14px; color: #6c757d;">•</span>';
        }

        cellHtml += `<span class="dimension-label">${rowDef.label || rowDef._id}</span>`;
        cellHtml += '</td>';

        return cellHtml;
    },


    // Helper function to get visible rows without duplicates
    getVisibleRowsWithoutDuplicates: function(rows) {
        if (!rows || !Array.isArray(rows)) return [];
    
        const seenRootNodes = new Set();
        const uniqueRows = [];
        
        rows.forEach(row => {
            // Handle ROOT node duplicates
            if (row._id === 'ROOT' || (row.level === 0 && row.label && row.label.includes('WORLDWIDE'))) {
                const rootKey = `${row._id}-${row.label}-${row.hierarchyField}`;
                if (seenRootNodes.has(rootKey)) {
                    console.log(`🗑️ Skipping duplicate root: ${row.label}`);
                    return;
                }
                seenRootNodes.add(rootKey);
            }
            
            // Check visibility based on parent expansion
            if (this.isRowVisible(row)) {
                uniqueRows.push(row);
            }
        });
        
        return uniqueRows;
    },


    // Check if row should be visible based on parent expansion
    isRowVisible: function(row) {
        if (row._id === 'ROOT' || !row.path || row.path.length <= 1) return true;
        
        const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';
        
        // Check if all parent nodes are expanded
        for (let i = 1; i < row.path.length - 1; i++) {
            const parentId = row.path[i];
            const isExpanded = this.state?.expandedNodes?.[dimName]?.row?.[parentId];
            if (!isExpanded) return false;
        }
        
        return true;
    },


    /**
     * Renders hierarchical columns with merged measure headers
     */
    renderHierarchicalColumns: function (elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) return;

        const valueFields = this.state.valueFields || [];
        const columnFields = this.state.columnFields || [];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');

        // console.log(`🏗️ COLUMNS: ${columnFields.length} column dimensions, ${columns.length} column nodes`);

        // Check if we need stacked column rendering
        if (columnFields.length > 1 && columns.length > 0) {
            // console.log(`🚀 Using STACKED column rendering for ${columnFields.length} dimensions`);
            this.renderStackedColumnHeaders(elements, pivotData, columnFields, valueFields);
            return;
        }

        // CRITICAL FIX: When no column dimensions, use simple header
        if (columns.length === 0) {
            this.renderSimpleHeader(elements, valueFields);
            return;
        }

        // Continue with normal single-column hierarchy rendering...
        const leafColumns = this.getVisibleLeafColumns(columns);
        
        let headerHtml = '';

        // Row 1: Hierarchy + Measures header
        headerHtml += '<tr>';
        headerHtml += `<th class="row-header" rowspan="3">${PivotHeaderConfig.getRowAreaLabel()}</th>`;
        
        const totalMeasureCells = leafColumns.length * valueFields.length;
        const measuresHeaderClass = classifyHeader({ isValueField: true, level: 0, hasChildren: false, isLeaf: false });
        headerHtml += `<th class="${measuresHeaderClass}" colspan="${totalMeasureCells}">${PivotHeaderConfig.getValueAreaLabel()}</th>`;
        headerHtml += '</tr>';

        // Row 2: Measure names
        headerHtml += '<tr>';
        valueFields.forEach((field, fieldIndex) => {
            const fieldLabel = this.getFieldLabel(field);
            const measureClass = classifyHeader({ isValueField: true, level: 1, hasChildren: false, isLeaf: true });
            headerHtml += `<th class="${measureClass}" colspan="${leafColumns.length}" data-measure="${field}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';

        // Row 3: Individual dimension nodes
        headerHtml += '<tr>';
        
        valueFields.forEach((field, fieldIndex) => {
            leafColumns.forEach((col, colIndex) => {
                const displayLabel = this.getDisplayLabel(col);
                const hasChildren = this.originalColumnHasChildren(col);
                
                const headerClass = classifyHeader({ 
                    isValueField: false, 
                    level: col.level || 0, 
                    hasChildren: hasChildren, 
                    isLeaf: !hasChildren 
                });
                
                headerHtml += `<th class="${headerClass}" data-level="${col.level || 0}" data-material-type="${col._id}" data-measure="${field}">`;
                
                // Only add expand/collapse if column has hierarchy field
                if (hasChildren && col.hierarchyField) {
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = extractDimensionName(col.hierarchyField);
                    
                    // FIXED: No JavaScript icons in column headers either
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="handleExpandCollapseClick(event)"
                        title="Expand/collapse ${displayLabel}"></span>`;
                }
                
                headerHtml += `<span class="column-label">${displayLabel}</span>`;
                headerHtml += '</th>';
            });
        });
        
        headerHtml += '</tr>';

        elements.pivotTableHeader.innerHTML = headerHtml;
        this.attachEventListeners(elements.pivotTableHeader, 'header');
    },


    /**
     * Build proper column structure with cross-combinations
     */
    buildProperColumnStructure: function(columns, columnFields) {
        const structure = {
            levels: [],
            leafCombinations: []
        };
        
        // Group columns by dimension and get visible nodes for each level
        columnFields.forEach((field, index) => {
            const dimName = extractDimensionName(field);
            const dimensionNodes = this.getVisibleNodesForDimension(columns, dimName);
            structure.levels[index] = dimensionNodes;
            
            // console.log(`📊 Level ${index} (${dimName}): ${dimensionNodes.length} nodes`);
            dimensionNodes.forEach(node => {
                // console.log(`  - ${node.label || node._id} (${node._id})`);
            });
        });
        
        // Generate all combinations of visible leaf nodes across dimensions
        structure.leafCombinations = this.generateColumnCombinations(structure.levels);
        
        // console.log(`📊 Column structure: ${structure.levels.length} levels, ${structure.leafCombinations.length} combinations`);
        structure.leafCombinations.forEach((combo, idx) => {
            // console.log(`  Combination ${idx}: ${combo.labels.join(' × ')} (${combo.key})`);
        });
        
        return structure;
    },


    /**
     * Get visible nodes for a dimension (respecting expand/collapse state)
     */
    getVisibleNodesForDimension: function(columns, dimName) {
        // Get all nodes for this dimension
        const dimensionNodes = columns.filter(col => {
            if (!col.hierarchyField) return false;
            return extractDimensionName(col.hierarchyField) === dimName;
        });
        
        // console.log(`📋 All nodes for dimension ${dimName}:`, dimensionNodes.map(n => `${n.label} (level: ${n.level}, id: ${n._id})`));
        
        // For stacked columns, we want to show the LEAF nodes that are actually meaningful
        // Filter out ROOT nodes and get the actual data nodes
        const leafNodes = dimensionNodes.filter(node => {
            // Skip ROOT nodes
            if (node._id === 'ROOT' || node._id.includes('ROOT')) {
                return false;
            }
            
            // Include nodes that have factId (these are the actual data nodes)
            if (node.factId) {
                return true;
            }
            
            // Include nodes that are at level 1 or higher (non-root)
            if ((node.level || 0) > 0) {
                return true;
            }
            
            // Include nodes that don't have children (leaf nodes)
            if (!this.originalColumnHasChildren(node)) {
                return true;
            }
            
            return false;
        });
        
        // console.log(`📋 Filtered leaf nodes for ${dimName}:`, leafNodes.map(n => `${n.label} (level: ${n.level}, factId: ${n.factId})`));
        
        // If we don't have any leaf nodes, try a different approach
        if (leafNodes.length === 0) {
            // Get all non-ROOT nodes
            const nonRootNodes = dimensionNodes.filter(node => 
                node._id !== 'ROOT' && 
                !node._id.includes('ROOT') && 
                node.label !== 'All Item Cost Type' &&
                node.label !== 'Sanofi'
            );
            
            // console.log(`📋 Fallback non-root nodes for ${dimName}:`, nonRootNodes.map(n => `${n.label} (level: ${n.level})`));
            return nonRootNodes.sort((a, b) => (a.label || a._id).localeCompare(b.label || b._id));
        }
        
        // Sort by label for consistent ordering
        return leafNodes.sort((a, b) => (a.label || a._id).localeCompare(b.label || b._id));
    },


    /**
     * Check if a column node should be visible
     */
    isColumnNodeVisible: function(node, dimName) {
        // Root level nodes are always visible
        if (!node.level || node.level === 0) {
            return true;
        }
        
        // Check if all ancestors are expanded
        if (node.path && node.path.length > 1) {
            for (let i = 1; i < node.path.length - 1; i++) {
                const ancestorId = node.path[i];
                const isExpanded = this.state.expandedNodes?.[dimName]?.column?.[ancestorId];
                if (!isExpanded) {
                    return false;
                }
            }
        }
        
        return true;
    },


    /**
     * Generate all combinations of column dimensions
     */
    generateColumnCombinations: function(columnFields) {
        const combinations = [];
        
        if (columnFields.length === 0) {
            return [{ nodes: [], labels: [], key: 'default' }];
        }
        
        // Get visible nodes for each column dimension
        const dimensionNodes = {};
        columnFields.forEach(field => {
            const dimName = this.extractDimensionName(field);
            const allNodes = this.state.pivotData.columns.filter(col => {
                if (!col.hierarchyField) return false;
                const colDimName = this.extractDimensionName(col.hierarchyField);
                return colDimName === dimName && col._id !== 'ROOT';
            });
            
            // Get only visible nodes (respecting expand/collapse)
            dimensionNodes[field] = this.getVisibleLeafColumns(allNodes);
        });
        
        // Generate cartesian product of all column dimensions
        if (columnFields.length === 1) {
            const field = columnFields[0];
            const nodes = dimensionNodes[field] || [];
            return nodes.map(node => ({
                nodes: [node],
                labels: [node.label || node._id],
                key: node._id
            }));
        } else if (columnFields.length === 2) {
            const [field1, field2] = columnFields;
            const nodes1 = dimensionNodes[field1] || [];
            const nodes2 = dimensionNodes[field2] || [];
            
            nodes1.forEach(node1 => {
                nodes2.forEach(node2 => {
                    combinations.push({
                        nodes: [node1, node2],
                        labels: [node1.label || node1._id, node2.label || node2._id],
                        key: `${node1._id}|${node2._id}`
                    });
                });
            });
        } else {
            // Handle 3+ column dimensions recursively
            this.generateRecursiveColumnCombinations(dimensionNodes, columnFields, combinations);
        }
        
        return combinations;
    },


    /**
     * Recursive column combination generator for 3+ dimensions
     */
    generateRecursiveColumnCombinations: function(dimensionNodes, columnFields, combinations) {
        const generateRecursive = (currentCombo, currentLabels, currentKey, fieldIndex) => {
            if (fieldIndex >= columnFields.length) {
                combinations.push({
                    nodes: [...currentCombo],
                    labels: [...currentLabels],
                    key: currentKey
                });
                return;
            }
            
            const field = columnFields[fieldIndex];
            const nodes = dimensionNodes[field] || [];
            
            nodes.forEach(node => {
                generateRecursive(
                    [...currentCombo, node],
                    [...currentLabels, node.label || node._id],
                    currentKey ? `${currentKey}|${node._id}` : node._id,
                    fieldIndex + 1
                );
            });
        };
        
        generateRecursive([], [], '', 0);
    },


    /**
     * Render stacked column headers for multiple column dimensions
     */
    renderStackedColumnHeaders: function(elements, pivotData, columnFields, valueFields) {
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
        
        console.log(`🏗️ FIXED STACKED: ${columnFields.length} column fields, ${columns.length} column nodes`);
        
        // Build column structure with enhanced error handling
        const columnStructure = this.buildFixedColumnStructure(columns, columnFields);
        
        if (!columnStructure.isValid) {
            console.error("❌ Invalid column structure, falling back to simple header");
            this.renderSimpleHeader(elements, valueFields);
            return;
        }
        
        // Extract dimension nodes
        const dimension1Nodes = columnStructure.dimensions[0]?.nodes || [];
        const dimension2Nodes = columnStructure.dimensions[1]?.nodes || [];
        
        console.log(`📊 Fixed Structure - Dim1: ${dimension1Nodes.length}, Dim2: ${dimension2Nodes.length}`);
        
        if (dimension1Nodes.length === 0 || dimension2Nodes.length === 0) {
            console.error("❌ Missing dimension nodes, falling back to simple header");
            this.renderSimpleHeader(elements, valueFields);
            return;
        }
        
        // Build header with FIXED alignment
        let headerHtml = '';
        
        // Row 1: Row Header + Measures Header
        headerHtml += '<tr>';
        headerHtml += `<th class="row-header corner-cell" rowspan="4">HIERARCHY</th>`;
        
        // Calculate total columns correctly
        const totalCombinations = dimension1Nodes.length * dimension2Nodes.length;
        const totalValueCells = totalCombinations * valueFields.length;
        
        headerHtml += `<th class="value-header measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Measure names (COST UNIT, etc.) - spans across ALL combinations
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header measure-header" colspan="${totalCombinations}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: First dimension headers - FIXED COLSPAN calculation
        headerHtml += '<tr>';
        dimension1Nodes.forEach(dim1Node => {
            // CRITICAL FIX: Each first dimension node spans across:
            // (number of second dimension nodes) × (number of value fields)
            const spanCount = dimension2Nodes.length * valueFields.length;
            
            headerHtml += `<th class="column-header dimension-level-0" colspan="${spanCount}" data-level="${dim1Node.level || 0}">`;
            
            if (this.originalColumnHasChildren(dim1Node)) {
                const expandClass = dim1Node.expanded ? 'expanded' : 'collapsed';
                const dimName = this.extractDimensionName(columnFields[0]);
                headerHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${dim1Node._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="column"
                    onclick="handleExpandCollapseClick(event)"></span>`;
            }
            
            headerHtml += `<span class="column-label">${dim1Node.label || dim1Node._id}</span>`;
            headerHtml += '</th>';
        });
        headerHtml += '</tr>';
        
        // Row 4: Second dimension headers - FIXED structure
        headerHtml += '<tr>';
        dimension1Nodes.forEach(dim1Node => {
            dimension2Nodes.forEach(dim2Node => {
                // CRITICAL FIX: Each combination appears once per value field
                valueFields.forEach(field => {
                    headerHtml += `<th class="column-header dimension-level-1" 
                        data-level="${dim2Node.level || 0}" 
                        data-dim1="${dim1Node._id}" 
                        data-dim2="${dim2Node._id}" 
                        data-measure="${field}">`;
                    
                    if (this.originalColumnHasChildren(dim2Node)) {
                        const expandClass = dim2Node.expanded ? 'expanded' : 'collapsed';
                        const dimName = this.extractDimensionName(columnFields[1]);
                        headerHtml += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${dim2Node._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="handleExpandCollapseClick(event)"></span>`;
                    }
                    
                    headerHtml += `<span class="column-label">${dim2Node.label || dim2Node._id}</span>`;
                    headerHtml += '</th>';
                });
            });
        });
        headerHtml += '</tr>';
        
        // Apply to DOM
        elements.pivotTableHeader.innerHTML = headerHtml;
        this.attachEventListeners(elements.pivotTableHeader, 'header');
        
        // Store structure for body rendering with FIXED combinations
        this._fixedColumnStructure = {
            dimension1Nodes: dimension1Nodes,
            dimension2Nodes: dimension2Nodes,
            combinations: this.generateFixedColumnCombinations(dimension1Nodes, dimension2Nodes),
            valueFields: valueFields,
            totalCombinations: totalCombinations
        };
        
        console.log(`✅ Fixed stacked header: ${dimension1Nodes.length} × ${dimension2Nodes.length} = ${totalCombinations} combinations`);
    },


    /**
     * Generate FIXED column combinations
     */
    generateFixedColumnCombinations: function(dimension1Nodes, dimension2Nodes) {
        const combinations = [];
        
        if (!dimension1Nodes || !dimension2Nodes || dimension1Nodes.length === 0 || dimension2Nodes.length === 0) {
            console.warn("Cannot generate FIXED combinations: missing dimension nodes");
            return combinations;
        }
        
        // Generate all combinations - each combination is UNIQUE
        dimension1Nodes.forEach(dim1Node => {
            dimension2Nodes.forEach(dim2Node => {
                combinations.push({
                    nodes: [dim1Node, dim2Node],
                    labels: [dim1Node.label || dim1Node._id, dim2Node.label || dim2Node._id],
                    key: `${dim1Node._id}|${dim2Node._id}`,
                    dim1Node: dim1Node,
                    dim2Node: dim2Node
                });
            });
        });
        
        console.log(`🔗 Generated ${combinations.length} FIXED combinations`);
        return combinations;
    },


    /**
     * Build FIXED column structure
     */
    buildFixedColumnStructure: function(columns, columnFields) {
        const structure = {
            isValid: false,
            dimensions: [],
            totalCombinations: 0
        };
        
        if (!columnFields || columnFields.length < 2) {
            console.warn("❌ Need at least 2 column fields for stacked columns");
            return structure;
        }
        
        console.log(`🔍 Building FIXED structure for ${columnFields.length} column fields`);
        
        // Process each column dimension with FIXED logic
        columnFields.forEach((field, index) => {
            const dimName = this.extractDimensionName(field);
            console.log(`🔍 Processing column field ${index}: ${field} → ${dimName}`);
            
            // Get meaningful nodes for this dimension
            let dimensionNodes = this.getFixedVisibleNodesForDimension(columns, dimName, field);
            
            if (dimensionNodes.length === 0) {
                console.warn(`⚠️ No nodes found for ${dimName}, creating fallback`);
                dimensionNodes = this.createFallbackNodesForDimension(dimName, field);
            }
            
            console.log(`📋 Fixed dimension ${index} (${dimName}): ${dimensionNodes.length} nodes`);
            dimensionNodes.forEach(node => {
                console.log(`  - ${node.label || node._id} (id: ${node._id})`);
            });
            
            structure.dimensions.push({
                field: field,
                dimName: dimName,
                nodes: dimensionNodes
            });
        });
        
        // Validate and calculate combinations
        const allDimensionsHaveNodes = structure.dimensions.every(dim => dim.nodes.length > 0);
        
        if (allDimensionsHaveNodes) {
            structure.isValid = true;
            structure.totalCombinations = structure.dimensions.reduce((total, dim) => total * dim.nodes.length, 1);
            console.log(`✅ Fixed structure: ${structure.totalCombinations} total combinations`);
        } else {
            console.error("❌ Invalid structure - some dimensions have no nodes");
        }
        
        return structure;
    },


    /**
     * Create fallback nodes when none found
     */
    createFallbackNodesForDimension: function(dimName, field) {
        console.log(`🏗️ Creating fallback nodes for ${dimName}`);
        
        const fallbackNodes = [];
        
        // Create basic nodes based on known dimension types
        switch (dimName.toLowerCase()) {
            case 'smartcode':
            case 'smart_code':
                fallbackNodes.push(
                    { _id: 'CP_PRODUITS', label: 'CP PRODUITS', hierarchyField: field, level: 1, factId: 'CP_PRODUITS', isLeaf: true },
                    { _id: 'SERVICES', label: 'SERVICES', hierarchyField: field, level: 1, factId: 'SERVICES', isLeaf: true }
                );
                break;
            case 'item_cost_type':
                fallbackNodes.push(
                    { _id: 'AV', label: 'AV', hierarchyField: field, level: 1, factId: 'AV', isLeaf: true },
                    { _id: 'OVERHEAD', label: 'OVERHEAD', hierarchyField: field, level: 1, factId: 'OVERHEAD', isLeaf: true }
                );
                break;
            default:
                fallbackNodes.push({
                    _id: `${dimName.toUpperCase()}_NODE`,
                    label: `${dimName.replace(/_/g, ' ')}`,
                    hierarchyField: field,
                    level: 1,
                    factId: `${dimName.toUpperCase()}_NODE`,
                    isLeaf: true
                });
        }
        
        console.log(`🏗️ Created ${fallbackNodes.length} fallback nodes for ${dimName}`);
        return fallbackNodes;
    },



    /**
     * Get FIXED visible nodes for dimension
     */
    getFixedVisibleNodesForDimension: function(columns, dimName, field) {
        console.log(`🔍 Getting FIXED nodes for dimension: ${dimName}`);
        
        // Filter columns for this dimension
        const dimensionColumns = columns.filter(col => {
            if (!col.hierarchyField) return false;
            const colDimName = this.extractDimensionName(col.hierarchyField);
            return colDimName === dimName;
        });
        
        console.log(`📋 Found ${dimensionColumns.length} columns for ${dimName}`);
        
        if (dimensionColumns.length === 0) {
            return [];
        }
        
        // FIXED: Get actual data nodes (not ROOT, not aggregated)
        const meaningfulNodes = dimensionColumns.filter(node => {
            // Exclude ROOT and aggregate nodes
            if (node._id === 'ROOT' || node._id.includes('ROOT')) {
                return false;
            }
            
            // Include nodes with factId (actual data nodes)
            if (node.factId && node.factId !== '') {
                return true;
            }
            
            // Include leaf nodes
            if (node.isLeaf || !this.originalColumnHasChildren(node)) {
                return true;
            }
            
            // Include expanded parent nodes
            if (node.expanded && this.originalColumnHasChildren(node)) {
                return true;
            }
            
            return false;
        });
        
        console.log(`📋 Filtered to ${meaningfulNodes.length} meaningful nodes for ${dimName}`);
        
        // Sort by label for consistent ordering
        const sortedNodes = meaningfulNodes.sort((a, b) => {
            return (a.label || a._id).localeCompare(b.label || b._id);
        });
        
        return sortedNodes;
    },


    /**
     * Generate enhanced combinations from dimension nodes
     */
    generateEnhancedColumnCombinations: function(dimension1Nodes, dimension2Nodes) {
        const combinations = [];
        
        if (!dimension1Nodes || !dimension2Nodes || dimension1Nodes.length === 0 || dimension2Nodes.length === 0) {
            console.warn("Cannot generate combinations: missing or empty dimension nodes");
            return combinations;
        }
        
        dimension1Nodes.forEach(dim1Node => {
            dimension2Nodes.forEach(dim2Node => {
                combinations.push({
                    nodes: [dim1Node, dim2Node],
                    labels: [dim1Node.label || dim1Node._id, dim2Node.label || dim2Node._id],
                    key: `${dim1Node._id}|${dim2Node._id}`,
                    dim1Node: dim1Node,
                    dim2Node: dim2Node
                });
            });
        });
        
        console.log(`🔗 Generated ${combinations.length} enhanced combinations`);
        return combinations;
    },


    /**
     * Enhanced table body rendering for stacked columns
     */
    renderEnhancedStackedTableBody: function(elements, pivotData) {
        if (!this._columnStructure) {
            console.error("❌ No column structure available for body rendering");
            this.renderStandardTable(elements);
            return;
        }
        
        const valueFields = this._columnStructure.valueFields;
        const combinations = this._columnStructure.combinations;
        
        console.log(`🏗️ Rendering body with ${combinations.length} column combinations`);
        
        let bodyHtml = '';
        const visibleRows = this.getVisibleRowsWithoutDuplicates(pivotData.rows);
        
        // Handle case where no visible rows
        if (visibleRows.length === 0) {
            bodyHtml = `<tr><td colspan="${1 + combinations.length * valueFields.length}">No data available</td></tr>`;
            elements.pivotTableBody.innerHTML = bodyHtml;
            return;
        }
        
        visibleRows.forEach((row, index) => {
            const level = row.level || 0;
            const indentationPx = 4 + (level * 30);
            
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Row header cell
            bodyHtml += `<td class="hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
            
            if (row.hasChildren) {
                const expandClass = row.expanded ? 'expanded' : 'collapsed';
                const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';
                bodyHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${row._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="row"
                    onclick="handleExpandCollapseClick(event)"
                    title="Click to expand/collapse ${row.label}"></span>`;
            } else {
                bodyHtml += '<span class="leaf-node"></span>';
            }
            
            bodyHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
            bodyHtml += '</td>';
            
            // Value cells for each combination
            combinations.forEach(combination => {
                valueFields.forEach(field => {
                    const value = this.calculateEnhancedStackedValue(row, combination, field);
                    bodyHtml += this.renderValueCell(value);
                });
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Rendered ${visibleRows.length} rows with ${combinations.length} column combinations`);
    },


    /**
     * Calculate value for enhanced stacked columns
     */
    calculateEnhancedStackedValue: function(rowNode, columnCombination, measureField) {
        try {
            // Start with all fact data
            let filteredData = [...(this.state.filteredData || this.state.factData || [])];
            
            if (filteredData.length === 0) {
                console.warn("No fact data available for calculation");
                return 0;
            }
            
            console.log(`🔍 ENHANCED CALC: Row ${rowNode.label} × Columns [${columnCombination.labels.join(' × ')}] × ${measureField}`);
            
            // Apply row filtering
            if (rowNode && rowNode._id !== 'ROOT' && !rowNode._id.includes('ROOT')) {
                const beforeCount = filteredData.length;
                filteredData = this.filterRecordsByDimension(filteredData, rowNode);
                console.log(`  After row filter: ${filteredData.length} records (was ${beforeCount})`);
            }
            
            // Apply each column dimension filter
            columnCombination.nodes.forEach((colNode, index) => {
                if (colNode && colNode._id !== 'ROOT' && !colNode._id.includes('ROOT')) {
                    const beforeCount = filteredData.length;
                    filteredData = this.filterRecordsByDimension(filteredData, colNode);
                    console.log(`  After column ${index} filter (${colNode.label}): ${filteredData.length} records (was ${beforeCount})`);
                }
            });
            
            // Calculate the measure
            const result = this.calculateDirectMeasure(filteredData, measureField);
            console.log(`  Final result: ${result} from ${filteredData.length} records`);
            
            return result;
            
        } catch (error) {
            console.error(`Error calculating enhanced stacked value:`, error);
            return 0;
        }
    },


    /**
     * Build enhanced column structure that properly handles all dimensions
     */
    buildEnhancedColumnStructure: function(columns, columnFields) {
        const structure = {
            isValid: false,
            dimensions: [],
            totalCombinations: 0
        };
        
        if (!columnFields || columnFields.length < 2) {
            console.warn("❌ Need at least 2 column fields for stacked columns");
            return structure;
        }
        
        console.log(`🔍 Building structure for ${columnFields.length} column fields`);
        console.log(`🔍 Available columns:`, columns.map(c => `${c.label || c._id} (${c.hierarchyField || 'no-field'})`));
        
        // Process each column dimension
        columnFields.forEach((field, index) => {
            const dimName = extractDimensionName(field);
            console.log(`🔍 Processing column field ${index}: ${field} → ${dimName}`);
            
            // ENHANCED: Get nodes with fallback strategies
            let dimensionNodes = this.getEnhancedVisibleNodesForDimension(columns, dimName, field);
            
            // FALLBACK 1: If no nodes found, try alternative filtering
            if (dimensionNodes.length === 0) {
                console.warn(`⚠️ No nodes found for ${dimName}, trying alternative approach`);
                dimensionNodes = this.getAlternativeNodesForDimension(columns, dimName, field);
            }
            
            // FALLBACK 2: If still no nodes, create default nodes
            if (dimensionNodes.length === 0) {
                console.warn(`⚠️ Still no nodes for ${dimName}, creating default nodes`);
                dimensionNodes = this.createDefaultNodesForDimension(dimName, field);
            }
            
            console.log(`📋 Final dimension ${index} (${dimName}): ${dimensionNodes.length} nodes`);
            dimensionNodes.forEach(node => {
                console.log(`  - ${node.label || node._id} (level: ${node.level}, factId: ${node.factId}, hierarchyField: ${node.hierarchyField})`);
            });
            
            structure.dimensions.push({
                field: field,
                dimName: dimName,
                nodes: dimensionNodes
            });
        });
        
        
        // Validate structure - require at least 1 node per dimension
        const allDimensionsHaveNodes = structure.dimensions.every(dim => dim.nodes.length > 0);
        
        if (allDimensionsHaveNodes) {
            structure.isValid = true;
            structure.totalCombinations = structure.dimensions.reduce((total, dim) => total * dim.nodes.length, 1);
            console.log(`✅ Valid structure with ${structure.totalCombinations} total combinations`);
        } else {
            console.error("❌ Invalid structure - some dimensions have no nodes");
            structure.dimensions.forEach((dim, idx) => {
                console.log(`  Dimension ${idx} (${dim.dimName}): ${dim.nodes.length} nodes`);
            });
        }
        
        return structure;
    },


    /**
     * Create default nodes when no real nodes are found
     */
    createDefaultNodesForDimension: function(dimName, field) {
        console.log(`🏗️ Creating default nodes for ${dimName}`);
        
        // Create some basic default nodes based on dimension type
        const defaultNodes = [];
        
        switch (dimName.toLowerCase()) {
            case 'item_cost_type':
                defaultNodes.push(
                    { _id: 'AV', label: 'AV', hierarchyField: field, level: 1, factId: 'AV', isLeaf: true },
                    { _id: 'OVERHEAD', label: 'OVERHEAD', hierarchyField: field, level: 1, factId: 'OVERHEAD', isLeaf: true },
                    { _id: 'MATERIAL', label: 'MATERIAL', hierarchyField: field, level: 1, factId: 'MATERIAL', isLeaf: true },
                    { _id: 'VARIABLE', label: 'VARIABLE', hierarchyField: field, level: 1, factId: 'VARIABLE', isLeaf: true }
                );
                break;
            case 'mc':
                defaultNodes.push(
                    { _id: 'SANOFI', label: 'SANOFI', hierarchyField: field, level: 1, factId: 'SANOFI', isLeaf: true },
                    { _id: 'BIOPHARMA', label: 'BIOPHARMA', hierarchyField: field, level: 1, factId: 'BIOPHARMA', isLeaf: true },
                    { _id: 'CHC_INTEGRATED', label: 'CHC INTEGRATED', hierarchyField: field, level: 1, factId: 'CHC_INTEGRATED', isLeaf: true }
                );
                break;
            default:
                // Generic default node
                defaultNodes.push({
                    _id: `DEFAULT_${dimName.toUpperCase()}`,
                    label: `Default ${dimName.replace(/_/g, ' ')}`,
                    hierarchyField: field,
                    level: 1,
                    factId: `DEFAULT_${dimName.toUpperCase()}`,
                    isLeaf: true
                });
        }
        
        console.log(`🏗️ Created ${defaultNodes.length} default nodes for ${dimName}`);
        return defaultNodes;
    },


    /**
     * Enhanced method to get visible nodes for a dimension with better filtering
     */
    getEnhancedVisibleNodesForDimension: function(columns, dimName, field) {
        console.log(`🔍 Getting enhanced nodes for dimension: ${dimName} (field: ${field})`);
        
        // Get all nodes for this dimension
        const dimensionNodes = columns.filter(col => {
            if (!col.hierarchyField) {
                return false;
            }
            const colDimName = extractDimensionName(col.hierarchyField);
            const matches = colDimName === dimName;
            if (matches) {
                console.log(`  ✓ Found node: ${col.label || col._id} (level: ${col.level}, factId: ${col.factId}, id: ${col._id})`);
            }
            return matches;
        });
        
        console.log(`📋 Found ${dimensionNodes.length} total nodes for ${dimName}`);
        
        if (dimensionNodes.length === 0) {
            console.warn(`⚠️ No nodes found for dimension ${dimName}`);
            return [];
        }
        
        // Enhanced filtering strategy
        let meaningfulNodes = [];
        
        // Strategy 1: Get nodes with factId (actual data nodes)
        const nodesWithFactId = dimensionNodes.filter(node => {
            const hasFactId = node.factId && node.factId !== '' && node._id !== 'ROOT';
            if (hasFactId) {
                console.log(`  📌 Node with factId: ${node.label} (${node.factId})`);
            }
            return hasFactId;
        });
        
        if (nodesWithFactId.length > 0) {
            meaningfulNodes = nodesWithFactId;
            console.log(`✅ Using ${meaningfulNodes.length} nodes with factId for ${dimName}`);
        } else {
            // Strategy 2: Get leaf nodes (no children)
            const leafNodes = dimensionNodes.filter(node => {
                const isLeaf = !this.originalColumnHasChildren(node) && node._id !== 'ROOT' && !node._id.includes('ROOT');
                if (isLeaf) {
                    console.log(`  🍃 Leaf node: ${node.label}`);
                }
                return isLeaf;
            });
            
            if (leafNodes.length > 0) {
                meaningfulNodes = leafNodes;
                console.log(`✅ Using ${meaningfulNodes.length} leaf nodes for ${dimName}`);
            } else {
                // Strategy 3: Get level 1+ nodes (non-root meaningful nodes)
                const levelNodes = dimensionNodes.filter(node => {
                    const isLevel1Plus = (node.level || 0) > 0 && node._id !== 'ROOT' && !node._id.includes('ROOT');
                    if (isLevel1Plus) {
                        console.log(`  📊 Level 1+ node: ${node.label} (level: ${node.level})`);
                    }
                    return isLevel1Plus;
                });
                
                meaningfulNodes = levelNodes;
                console.log(`✅ Using ${meaningfulNodes.length} level 1+ nodes for ${dimName}`);
            }
        }
        
        // Sort by level and then by label for consistent ordering
        meaningfulNodes.sort((a, b) => {
            const levelA = a.level || 0;
            const levelB = b.level || 0;
            if (levelA !== levelB) return levelA - levelB;
            return (a.label || a._id).localeCompare(b.label || b._id);
        });
        
        console.log(`📋 Final enhanced nodes for ${dimName}:`, meaningfulNodes.map(n => n.label || n._id));
        return meaningfulNodes;
    },


    /**
     * Generate combinations from specific node arrays
     */
    generateColumnCombinationsFromNodes: function(topLevelNodes, bottomLevelNodes) {
        const combinations = [];
        
        topLevelNodes.forEach(topNode => {
            bottomLevelNodes.forEach(bottomNode => {
                combinations.push({
                    nodes: [topNode, bottomNode],
                    labels: [topNode.label || topNode._id, bottomNode.label || bottomNode._id],
                    key: `${topNode._id}|${bottomNode._id}`,
                    topNode: topNode,
                    bottomNode: bottomNode
                });
            });
        });
        
        // console.log(`🔗 Generated ${combinations.length} combinations:`, combinations.map(c => c.labels.join(' × ')));
        return combinations;
    },


    /**
     * Calculate span for top level dimension
     */
    calculateTopLevelSpan: function(topNode, columnStructure, measureCount) {
        // Top level spans across all combinations that include this node times number of measures
        const lowerLevelCount = columnStructure.levels.length > 1 ? columnStructure.levels[1].length : 1;
        return lowerLevelCount * measureCount;
    },


    /**
     * Count leaf descendants in column list
     */
    countLeafDescendantsInColumns: function(parentNode, leafColumns) {
        if (!parentNode.hierarchyField) return 0;
        
        const dimName = extractDimensionName(parentNode.hierarchyField);
        const hierarchy = this.state.hierarchies[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) return 0;
        
        // Get all leaf descendants of this node
        const descendants = this.getAllLeafDescendants(hierarchy.nodesMap[parentNode._id], hierarchy);
        
        // Count how many of these descendants are in the leaf columns list
        return descendants.filter(desc => 
            leafColumns.some(leaf => leaf._id === desc.id)
        ).length;
    },


    /**
     * Get CSS class for stacked dimension headers
     */
    getStackedDimensionHeaderClass: function(node, dimensionIndex) {
        const baseClass = 'column-header dimension-header';
        const modifiers = [];
        
        if (node.level === 0) modifiers.push('root-level');
        if (this.originalColumnHasChildren(node)) modifiers.push('has-children');
        if (!this.originalColumnHasChildren(node)) modifiers.push('leaf-node');
        modifiers.push(`dimension-${dimensionIndex}`);
        
        return baseClass + ' ' + modifiers.join(' ');
    },


    /**
     * Get all leaf columns for stacked layout
     */
    getStackedLeafColumns: function(columnHierarchy) {
        // For stacked columns, we need to return the actual combinations
        // This method should be used by the column structure builder
        const levels = Object.values(columnHierarchy).map(dimData => dimData.nodes);
        return this.generateColumnCombinations(levels);
    },


    /**
     * Calculate colspan for a node in stacked layout
     */
    calculateStackedNodeColspan: function(node, allLeafColumns, measureCount) {
        // Count how many leaf columns fall under this node
        let leafCount = 0;
        
        if (!this.originalColumnHasChildren(node) || !node.expanded) {
            // This node itself is a leaf
            leafCount = 1;
        } else {
            // Count leaf descendants
            leafCount = this.countLeafDescendantsInColumns(node, allLeafColumns);
        }
        
        return leafCount * measureCount;
    },


    /**
     * Get nodes for a specific dimension in proper order
     */
    getNodesForDimension: function(columns, dimName) {
        const dimensionNodes = columns.filter(col => {
            if (!col.hierarchyField) return false;
            return extractDimensionName(col.hierarchyField) === dimName;
        });
        
        // Sort by level and then by order within level
        return dimensionNodes.sort((a, b) => {
            const levelA = a.level || 0;
            const levelB = b.level || 0;
            if (levelA !== levelB) return levelA - levelB;
            return (a._id || '').localeCompare(b._id || '');
        });
    },


    /**
     * Build column hierarchy structure for stacked rendering
     */
    buildColumnHierarchyStructure: function(columns, columnFields) {
        const hierarchy = {};
        
        // Initialize structure for each column field
        columnFields.forEach((field, index) => {
            const dimName = extractDimensionName(field);
            hierarchy[dimName] = {
                fieldIndex: index,
                nodes: [],
                levels: {}
            };
        });
        
        // Populate with actual column nodes
        columns.forEach(col => {
            if (!col.hierarchyField) return;
            
            const dimName = extractDimensionName(col.hierarchyField);
            if (hierarchy[dimName]) {
                hierarchy[dimName].nodes.push(col);
                
                const level = col.level || 0;
                if (!hierarchy[dimName].levels[level]) {
                    hierarchy[dimName].levels[level] = [];
                }
                hierarchy[dimName].levels[level].push(col);
            }
        });
        
        // For stacked columns, we also need the proper structure
        hierarchy._stackedStructure = this.buildProperColumnStructure(columns, columnFields);
        
        return hierarchy;
    },


    // Function to check if original column has children
    originalColumnHasChildren: function(col) {
        if (!col || !col.hierarchyField) return false;
        
        const dimName = extractDimensionName(col.hierarchyField);
        const hierarchy = this.state?.hierarchies?.[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) return false;
        
        const originalNode = hierarchy.nodesMap[col._id];
        return !!(originalNode && originalNode.children && originalNode.children.length > 0);
    },


    // Event listeners
    attachEventListeners: function(element, type) {
      if (!element) return;
      
      setTimeout(() => {
          const controls = element.querySelectorAll('.expand-collapse');
          console.log(`🔗 Attaching event listeners to ${controls.length} controls`);
          
          controls.forEach(control => {
              control.addEventListener('click', handleExpandCollapseClick, {
                  once: false,
                  passive: false,
                  capture: true
              });
          });
      }, 50);
    },


    // Add this new helper method for display labels
    getDisplayLabel: function(node) {
        if (!node) return '';
        
        // Handle case where hierarchyField might be undefined
        if (!node.hierarchyField) {
            return node.label || node._id || 'Unknown';
        }
        
        const dimName = extractDimensionName(node.hierarchyField);
        
        // Try to get enhanced label from data module
        if (typeof data !== 'undefined') {
            if (dimName === 'item_cost_type' && node.factId) {
                return data.getItemCostTypeDesc?.(node.factId) || node.label || node._id;
            } else if (dimName === 'material_type' && node.factId) {
                return data.getMaterialTypeDesc?.(node.factId) || node.label || node._id;
            }
        }
        
        return node.label || node._id;
    },


    /**
     * Get total count of leaf columns for proper spanning
     */
    getTotalLeafColumnCount: function(columns) {
        let totalLeafs = 0;
        columns.forEach(col => {
            totalLeafs += this.countLeafNodes(col);
        });
        return totalLeafs;
    },


    /**
     * Renders simple header for no column dimensions - HELPER FUNCTION
     */
    renderSimpleHeader: function(elements, valueFields) {
        if (!valueFields || valueFields.length === 0) {
            console.warn("No value fields provided to renderSimpleHeader");
            return;
        }

        let headerHtml = '<tr>';
        // Row header spans 2 rows for simple case
        headerHtml += `<th class="row-header" rowspan="2">Hierarchy</th>`;
        // Measures header spans all measure columns
        headerHtml += `<th class="value-header measures-header" colspan="${valueFields.length}">Measures</th>`;
        headerHtml += '</tr>';
        
        // Second row: Individual measure labels
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    // Add helper method for row area label
    getRowAreaLabel: function() {
        return 'Hierarchy';
    },


    /**
     * Helper function to calculate total value cell count
     */
    getTotalValueCellCount: function(columns, valueFields) {
        if (!columns || columns.length === 0) {
            return valueFields.length;
        }
        
        let totalCells = 0;
        columns.forEach(col => {
            const leafCount = this.countLeafNodes(col);
            totalCells += leafCount * valueFields.length;
        });
        
        return totalCells;
    },
   

    renderStandardTable: function (elements, useMultiDimension) {
        const pivotData = this.state.pivotData;
        if (!pivotData) return;

        const validColumns = pivotData.columns.filter(col => col._id !== 'ROOT');

        if (validColumns.length > 0) {
            this.renderHierarchicalColumns(elements, pivotData);
        } else {
            // FIXED: Create proper 2-row header structure
            let headerHtml = '<tr>';
            headerHtml += `<th class="row-header" rowspan="2">${PivotHeaderConfig.getRowAreaLabel()}</th>`;
            headerHtml += `<th class="value-header" colspan="${this.state.valueFields.length}">${PivotHeaderConfig.getValueAreaLabel()}</th>`;
            headerHtml += '</tr>';
            
            // Second row: Individual measure labels
            headerHtml += '<tr>';
            this.state.valueFields.forEach(field => {
                const fieldLabel = this.getFieldLabel(field);
                headerHtml += `<th class="value-header">${fieldLabel}</th>`;
            });
            headerHtml += '</tr>';
            
            elements.pivotTableHeader.innerHTML = headerHtml;
        }

        this.renderTableBody(elements, pivotData);
    },


    /**
     * Renders a value cell
     */
    renderValueCell: function (value) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

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

        let formattedValue;
        const decimals = this.state?.decimalPlaces ?? 2;
        const valFormat = this.state?.valueFormat;

        switch (valFormat) {
            case "regular":
                if (numericValue === 0) {
                    formattedValue = (0).toFixed(decimals);
                } else {
                    formattedValue = numericValue.toLocaleString(undefined, {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    });
                }
                break;

            case "thousands":
                formattedValue = (numericValue / 1000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'k';
                break;

            case "millions":
                formattedValue = (numericValue / 1000000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'm';
                break;

            case "billions":
                formattedValue = (numericValue / 1000000000).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) + 'b';
                break;
        }


        return `<td class="${cellClass}" data-raw-value="${numericValue}">${formattedValue}</td>`;
    },


    /**
     * Render a single table row
     */
    renderTableRow: function (rowDef, dataRow, rowIndex, bodyHtml, useMultiDimension, validColumns) {
        // console.log(`Row data for ${rowDef.label}:`, dataRow);

        let rowHtml = `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;

        if (useMultiDimension) {
            rowHtml += data.renderMultiDimensionRowCells(rowDef);
        } else {
            rowHtml += this.renderRowCell(rowDef);
        }

        if (validColumns.length > 0) {
            validColumns.forEach(col => {
                this.state.valueFields.forEach(fieldId => {
                    const key = `${col._id}|${fieldId}`;
                    rowHtml += this.renderValueCell(dataRow[key]);
                });
            });
        } else {
            this.state.valueFields.forEach(fieldId => {
                rowHtml += this.renderValueCell(dataRow[fieldId]);
            });
        }

        rowHtml += '</tr>';
        return rowHtml;
    },


    /**
     * Filters fact data by a dimension node
     * Updated for BOM data with LE mapping and non-hierarchical fields
     * 
     * @param {Array} data - The data array to filter
     * @param {Object} rowDef - Row definition with filtering criteria
     * @returns {Array} - Filtered data array
     */
    filterDataByDimension: function (data, rowDef) {
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
    filterRecordsByDimension: function(records, dimNode) {
        if (!dimNode || !dimNode.hierarchyField) {
            // console.log("No hierarchy field, returning all records");
            return records;
        }

        const dimName = extractDimensionName(dimNode.hierarchyField);
        // console.log(`🔍 Filtering by ${dimName}: ${dimNode.label} (${dimNode._id})`);

        // Don't filter ROOT nodes
        if (dimNode._id === 'ROOT' || dimNode.label === 'WORLDWIDE' || 
            dimNode.label === 'All GMIDs' || dimNode.label === 'All Cost Elements' ||
            dimNode.label === 'Sanofi' || dimNode.label === 'All Years') {
            // console.log(`  ROOT/ALL node - no filtering`);
            return records;
        }

        // For leaf nodes with factId, filter directly
        if (dimNode.isLeaf && dimNode.factId) {
            const factField = this.getFactIdField(dimName);
            if (factField) {
                const filtered = records.filter(record => {
                    if (Array.isArray(dimNode.factId)) {
                        return dimNode.factId.includes(record[factField]);
                    }
                    return record[factField] === dimNode.factId;
                });
                // console.log(`  Leaf node filter: ${factField} = ${dimNode.factId} → ${filtered.length} records`);
                return filtered;
            }
        }

        // For parent nodes, need to get all descendant factIds
        const hierarchy = this.state.hierarchies?.[dimName];
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[dimNode._id]) {
            const node = hierarchy.nodesMap[dimNode._id];
            const descendants = this.getAllLeafDescendants(node, hierarchy);
            
            if (descendants.length > 0) {
                const factField = this.getFactIdField(dimName);
                const factIds = new Set();
                
                descendants.forEach(desc => {
                    if (desc.factId) {
                        if (Array.isArray(desc.factId)) {
                            desc.factId.forEach(id => factIds.add(id));
                        } else {
                            factIds.add(desc.factId);
                        }
                    }
                });
                
                if (factIds.size > 0 && factField) {
                    const filtered = records.filter(record => factIds.has(record[factField]));
                    // console.log(`  Parent node filter: ${factIds.size} factIds → ${filtered.length} records`);
                    return filtered;
                }
            }
        }

        // console.log(`  No filtering applied for ${dimNode.label}`);
        return records;
    },


    /**
     * Enhanced countLeafNodes to respect expanded/collapsed state
     */
    countLeafNodes: function (node) {
        if (!node) return 0;
        
        // If it's a leaf node, count as 1
        if (node.isLeaf || !node.children || node.children.length === 0) {
            return 1;
        }

        // If it's not expanded, treat as 1 leaf
        if (!node.expanded) {
            return 1;
        }

        // If expanded, count all children
        let count = 0;
        node.children.forEach(childId => {
            if (typeof childId === 'string') {
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
    getElement: function (id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },


    // Helper to show or hide loading indicator
    toggleLoading: function (show = true) {
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
    isNodeVisible: function (row, allNodes) {
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
    renderRowCell: function (rowDef) {
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0; // 20px per level

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


    renderPivotTable: function (elements, useMultiDimension = false) {
        // Validate elements
        if (!elements || !elements.pivotTableHeader || !elements.pivotTableBody) {
            elements = {
                pivotTableHeader: document.getElementById('pivotTableHeader'),
                pivotTableBody: document.getElementById('pivotTableBody')
            };

            if (!elements.pivotTableHeader || !elements.pivotTableBody) {
                console.error("Cannot find pivot table DOM elements");
                return;
            }
        }

        const pivotData = this.state.pivotData;

        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0 || !pivotData.data) {
            console.warn("Invalid pivot data for rendering");
            return;
        }

        // Render based on current view
        if (this.currentView === 'vertical') {
            this.renderVerticalHierarchicalColumns(elements, pivotData);
        } else {
            this.renderStandardTable(elements, useMultiDimension);
        }
    },


    /**
     * Render a single table row
     */
    renderTableRow: function (rowDef, dataRow, rowIndex, bodyHtml, useMultiDimension, validColumns) {
        // Debug the entire row data
        // console.log(`Row data for ${rowDef.label}:`, dataRow);

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


    /**
     * Gets all leaf descendants of a node recursively
     * 
     * @param {Object} node - The root node to start from
     * @param {Array} result - Array to collect leaf nodes (for recursion)
     * @returns {Array} - Array of all leaf descendant nodes
     */
    getAllLeafDescendants: function(node, hierarchy) {
        const leaves = [];
        
        const collectAllLeaves = (currentNode) => {
            if (!currentNode) return;
            
            if (currentNode.isLeaf) {
                leaves.push(currentNode);
                return;
            }
            
            // Always traverse ALL children regardless of expansion state
            if (currentNode.children && currentNode.children.length > 0) {
                currentNode.children.forEach(childId => {
                    const childNode = typeof childId === 'string' 
                        ? hierarchy.nodesMap[childId] 
                        : childId;
                    
                    if (childNode) {
                        collectAllLeaves(childNode);
                    }
                });
            }
        };
        
        collectAllLeaves(node);
        return leaves;
    },


    /**
     * Enhanced generatePivotTableEnhanced with proper state integration
     */
    generatePivotTable: function() {
        if (!this.state) {
            console.error("No state connection");
            return;
        }

        console.log("🔄 Starting Excel-like multi-dimensional pivot table generation...");

        this.resetTableStructure();

        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };

        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Cannot find pivot table DOM elements");
            return;
        }

        const rowFields = this.state.rowFields || [];
        const columnFields = this.state.columnFields || [];
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`📊 Excel-like generation: ${rowFields.length} row fields, ${columnFields.length} column fields, ${valueFields.length} value fields`);

        // Add multi-dimension class to container
        const container = elements.pivotTableHeader.closest('.pivot-table-container');
        if (container) {
            container.classList.add('multi-dimension');
            if (rowFields.length === 2) container.classList.add('two-dimensions');
            if (rowFields.length === 3) container.classList.add('three-dimensions');
        }

        try {
            this.processPivotData();
            
            // Determine rendering strategy based on dimensions
            if (rowFields.length >= 2 && columnFields.length >= 2) {
                console.log(`🌟 Using EXCEL-LIKE multi-row + multi-column rendering`);
                this.renderExcelLikeMultiDimensionTable(elements, rowFields, columnFields, valueFields);
            } else if (rowFields.length >= 2) {
                console.log(`🌟 Using enhanced multi-row rendering (${rowFields.length} dimensions)`);
                this.renderEnhancedMultiRowTable(elements, rowFields);
            } else if (columnFields.length >= 2) {
                console.log(`🌟 Using enhanced stacked column rendering`);
                this.renderStackedColumnHeaders(elements, this.state.pivotData, columnFields, valueFields);
                this.renderEnhancedStackedTableBody(elements, this.state.pivotData);
            } else {
                console.log(`📊 Using standard rendering`);
                this.renderStandardTable(elements);
            }

            console.log("✅ Excel-like pivot table generation complete");

        } catch (error) {
            console.error("Error in Excel-like pivot generation:", error);
            if (elements.pivotTableBody) {
                elements.pivotTableBody.innerHTML = '<tr><td colspan="100%">Error generating pivot table</td></tr>';
            }
        }
    },


    /**
     * Main Excel-like multi-dimension table renderer
     */
    renderExcelLikeMultiDimensionTable: function(elements, rowFields, columnFields, valueFields) {
        console.log(`🎯 EXCEL-LIKE: ${rowFields.length} row dims × ${columnFields.length} col dims × ${valueFields.length} measures`);
        
        // Generate all row combinations
        const rowCombinations = this.generateEnhancedRowCombinations(rowFields);
        
        // Generate all column combinations  
        const columnCombinations = this.generateColumnCombinations(columnFields);
        
        console.log(`📊 Excel-like: ${rowCombinations.length} row combos × ${columnCombinations.length} col combos`);
        
        // Render the Excel-like header structure
        this.renderExcelLikeHeader(elements, rowFields, columnFields, valueFields, columnCombinations);
        
        // Render the Excel-like body with full cross-tabulation
        this.renderExcelLikeBody(elements, rowCombinations, columnCombinations, rowFields, columnFields, valueFields);
    },


    /**
     * Main Excel-like multi-dimension table renderer
     */
    renderExcelLikeMultiDimensionTable: function(elements, rowFields, columnFields, valueFields) {
        console.log(`🎯 EXCEL-LIKE: ${rowFields.length} row dims × ${columnFields.length} col dims × ${valueFields.length} measures`);
        
        // Generate all row combinations
        const rowCombinations = this.generateEnhancedRowCombinations(rowFields);
        
        // Generate all column combinations  
        const columnCombinations = this.generateColumnCombinations(columnFields);
        
        console.log(`📊 Excel-like: ${rowCombinations.length} row combos × ${columnCombinations.length} col combos`);
        
        // Render the Excel-like header structure
        this.renderExcelLikeHeader(elements, rowFields, columnFields, valueFields, columnCombinations);
        
        // Render the Excel-like body with full cross-tabulation
        this.renderExcelLikeBody(elements, rowCombinations, columnCombinations, rowFields, columnFields, valueFields);
    },


    /**
     * Render Excel-like header structure
     */
    renderExcelLikeHeader: function(elements, rowFields, columnFields, valueFields, columnCombinations) {
        let headerHtml = '';
        
        const totalCombinations = columnCombinations.length;
        const totalValueCells = totalCombinations * valueFields.length;
        
        // Row 1: HIERARCHY label + MEASURES label
        headerHtml += '<tr>';
        headerHtml += `<th class="hierarchy-section" colspan="${rowFields.length}">HIERARCHY</th>`;
        headerHtml += `<th class="measures-section" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: REAL dimension names + REAL measure names
        headerHtml += '<tr>';
        rowFields.forEach((field, index) => {
            const realDimName = this.getRealDimensionName(field);
            headerHtml += `<th class="dimension-column dimension-header-${index}">${realDimName}</th>`;
        });
        valueFields.forEach((field) => {
            const realMeasureName = this.getRealMeasureName(field);
            headerHtml += `<th class="measure-header" colspan="${totalCombinations}">${realMeasureName}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Empty cells for dimensions + First column dimension level with REAL names
        headerHtml += '<tr>';
        rowFields.forEach(() => {
            headerHtml += '<th class="dimension-column"></th>';
        });
        
        if (columnFields.length >= 1) {
            const field1 = columnFields[0];
            const dim1Nodes = this.getUniqueNodesForDimension(field1, columnCombinations, 0);
            
            valueFields.forEach(() => {
                dim1Nodes.forEach((nodeInfo) => {
                    const spanCount = nodeInfo.count;
                    const realNodeName = nodeInfo.node.label || nodeInfo.node._id;
                    
                    // Add expand/collapse if node has children
                    let headerContent = '';
                    if (this.nodeHasChildren(nodeInfo.node)) {
                        const expandClass = nodeInfo.node.expanded ? 'expanded' : 'collapsed';
                        const dimName = this.extractDimensionName(field1);
                        headerContent += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${nodeInfo.node._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="window.handleExpandCollapseClick(event)"
                            title="Expand/collapse ${realNodeName}"></span>`;
                    }
                    headerContent += `<span class="column-label">${realNodeName}</span>`;
                    
                    headerHtml += `<th class="dimension-level-0" colspan="${spanCount}">${headerContent}</th>`;
                });
            });
        }
        headerHtml += '</tr>';
        
        // Row 4: Empty cells for dimensions + Second column dimension level with REAL names
        if (columnFields.length >= 2) {
            headerHtml += '<tr>';
            rowFields.forEach(() => {
                headerHtml += '<th class="dimension-column"></th>';
            });
            
            valueFields.forEach(() => {
                columnCombinations.forEach((combo) => {
                    const node2 = combo.nodes[1];
                    const realNodeName = node2.label || node2._id;
                    
                    // Add expand/collapse if node has children
                    let headerContent = '';
                    if (this.nodeHasChildren(node2)) {
                        const expandClass = node2.expanded ? 'expanded' : 'collapsed';
                        const dimName = this.extractDimensionName(columnFields[1]);
                        headerContent += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${node2._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="window.handleExpandCollapseClick(event)"
                            title="Expand/collapse ${realNodeName}"></span>`;
                    }
                    headerContent += `<span class="column-label">${realNodeName}</span>`;
                    
                    headerHtml += `<th class="dimension-level-1">${headerContent}</th>`;
                });
            });
            headerHtml += '</tr>';
        }
        
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    /**
     * Get real measure name from field identifier
     */
    getRealMeasureName: function(field) {
        // Map measure field IDs to display names
        const measureNames = {
            'COST_UNIT': 'Cost per Unit',
            'QTY_UNIT': 'Quantity per Unit', 
            'REVENUE': 'Revenue',
            'TOTAL_COST': 'Total Cost',
            'UNIT_PRICE': 'Unit Price',
            'MARGIN': 'Margin',
            'PROFIT': 'Profit',
            'SALES': 'Sales',
            'VOLUME': 'Volume',
            'AMOUNT': 'Amount',
            'VALUE': 'Value'
        };
        
        // Try to get from available fields definition first
        if (this.state && this.state.availableFields) {
            const fieldDef = this.state.availableFields.find(f => f.id === field);
            if (fieldDef && fieldDef.label) {
                return fieldDef.label;
            }
        }
        
        // Fallback to predefined mapping or formatted field name
        return measureNames[field] || 
            field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },


    /**
     * Render Excel-like body with full cross-tabulation
     */
    renderExcelLikeBody: function(elements, rowCombinations, columnCombinations, rowFields, columnFields, valueFields) {
        let bodyHtml = '';
        
        console.log(`🏗️ Excel-like body: ${rowCombinations.length} rows × ${columnCombinations.length * valueFields.length} columns`);
        
        if (rowCombinations.length === 0) {
            const totalCols = rowFields.length + (columnCombinations.length * valueFields.length);
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            rowCombinations.forEach((rowCombo, rowIndex) => {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Render dimension cells for this row combination
                rowCombo.nodes.forEach((node, dimIndex) => {
                    bodyHtml += this.renderExcelLikeDimensionCell(node, rowFields[dimIndex], dimIndex);
                });
                
                // Render cross-tabulated value cells
                valueFields.forEach(field => {
                    columnCombinations.forEach(colCombo => {
                        const value = this.calculateMultiDimensionalValue(
                            rowCombo.nodes,
                            colCombo.nodes,
                            field
                        );
                        bodyHtml += this.renderValueCell(value);
                    });
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
        
        console.log(`✅ Excel-like body rendered: ${rowCombinations.length} rows with full cross-tabulation`);
    },


    /**
     * Render Excel-like dimension cell
     */
    renderExcelLikeDimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="dimension-cell dimension-${dimIndex} empty">-</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = this.extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        // Add expand/collapse control for nodes with children
        if (this.nodeHasChildren(node)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${node.label || node._id}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        // Display real node name
        const realNodeName = node.label || node._id;
        cellHtml += `<span class="dimension-label">${realNodeName}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Enhanced multi-row table rendering
     */
    renderEnhancedMultiRowTable: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        const columnFields = this.state.columnFields || [];
        
        console.log(`🌟 ENHANCED MULTI-ROW: Rendering ${rowFields.length} row dimensions`);
        
        // Apply equal width CSS for row dimensions
        this.addEnhancedEqualWidthCSS(rowFields);
        
        // Check if we have column dimensions
        const hasColumnDimensions = columnFields.length > 0;
        let visibleColumns = [];
        
        if (hasColumnDimensions) {
            // Get all visible column combinations
            visibleColumns = this.generateColumnCombinations(columnFields);
            console.log(`📊 Generated ${visibleColumns.length} column combinations`);
        }
        
        // Generate row combinations using enhanced cartesian product
        const rowCombinations = this.generateEnhancedRowCombinations(rowFields);
        console.log(`📊 Generated ${rowCombinations.length} row combinations`);
        
        // Render appropriate header
        if (hasColumnDimensions && columnFields.length >= 2) {
            this.renderMultiRowMultiColumnHeader(elements, rowFields, columnFields, valueFields, visibleColumns);
        } else if (hasColumnDimensions) {
            this.renderMultiRowSingleColumnHeader(elements, rowFields, columnFields, valueFields, visibleColumns);
        } else {
            this.renderMultiRowHeader(elements, rowFields, valueFields);
        }
        
        // Render body with enhanced combinations
        this.renderEnhancedMultiRowBody(elements, rowCombinations, rowFields, valueFields, visibleColumns, hasColumnDimensions);
    },


    /**
     * Render header for multi-row + single column layout
     * Add this method to your pivotTable object in pivot-table.js
     */
    renderMultiRowSingleColumnHeader: function(elements, rowFields, columnFields, valueFields, visibleColumns) {
        let headerHtml = '';
        
        const totalValueCells = visibleColumns.length * valueFields.length;
        
        // Row 1: REAL row dimension headers + Measures header
        headerHtml += '<tr>';
        rowFields.forEach((field, index) => {
            const realDimName = this.getRealDimensionName(field);
            headerHtml += `<th class="row-header dimension-column dimension-header-${index}" rowspan="3">${realDimName}</th>`;
        });
        headerHtml += `<th class="value-header measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: REAL value field headers
        headerHtml += '<tr>';
        valueFields.forEach((field) => {
            const realMeasureName = this.getRealMeasureName(field);
            headerHtml += `<th class="value-header measure-header" colspan="${visibleColumns.length}">${realMeasureName}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Single column dimension with REAL names and expand/collapse
        headerHtml += '<tr>';
        if (columnFields.length >= 1) {
            valueFields.forEach(() => {
                visibleColumns.forEach(column => {
                    const realNodeName = column.label || column._id;
                    
                    let headerContent = '';
                    if (this.nodeHasChildren(column)) {
                        const expandClass = column.expanded ? 'expanded' : 'collapsed';
                        const dimName = this.extractDimensionName(columnFields[0]);
                        headerContent += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${column._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="window.handleExpandCollapseClick(event)"
                            title="Expand/collapse ${realNodeName}"></span>`;
                    }
                    headerContent += `<span class="column-label">${realNodeName}</span>`;
                    
                    headerHtml += `<th class="column-header dimension-level-0">${headerContent}</th>`;
                });
            });
        } else {
            // No column dimensions - just show measure labels
            valueFields.forEach((field) => {
                const realMeasureName = this.getRealMeasureName(field);
                headerHtml += `<th class="value-header">${realMeasureName}</th>`;
            });
        }
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        console.log(`✅ Rendered multi-row single-column header with real names`);
    },


    /**
     * Enhanced equal width CSS for multiple dimensions
     */
    addEnhancedEqualWidthCSS: function(rowFields) {
        const dimensionCount = rowFields.length;
        if (dimensionCount < 2) return;
        
        let styleElement = document.getElementById('pivot-enhanced-equal-widths');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'pivot-enhanced-equal-widths';
            document.head.appendChild(styleElement);
        }
        
        const equalWidth = Math.floor(100 / dimensionCount);
        
        const css = `
            .pivot-table-container table {
                table-layout: auto !important;
                width: 100% !important;
                border-collapse: collapse !important;
            }
            
            .dimension-column {
                width: ${equalWidth}% !important;
                min-width: 150px !important;
                max-width: 250px !important;
                box-sizing: border-box !important;
                text-align: center !important;
                font-weight: 700 !important;
                background: linear-gradient(135deg, #e6f0ff 0%, #cce7ff 100%) !important;
                border: 1px solid #b3d9ff !important;
                color: #0066cc !important;
            }
            
            .dimension-cell {
                width: ${equalWidth}% !important;
                min-width: 150px !important;
                max-width: 250px !important;
                box-sizing: border-box !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                white-space: normal !important;
                vertical-align: top !important;
                padding: 8px 12px !important;
            }
            
            .value-cell {
                min-width: 100px !important;
                text-align: right !important;
                padding: 8px 12px !important;
                background: white !important;
            }
            
            .measures-header {
                background: linear-gradient(135deg, #f0e6ff 0%, #e6ccff 100%) !important;
                border: 2px solid #cc99ff !important;
                color: #6600cc !important;
                font-weight: 700 !important;
                text-align: center !important;
                text-transform: uppercase !important;
                letter-spacing: 1px !important;
            }
            
            .measure-header {
                background: linear-gradient(135deg, #fff0e6 0%, #ffddcc 100%) !important;
                border: 1px solid #ff9966 !important;
                color: #cc4400 !important;
                font-weight: 600 !important;
                text-align: center !important;
            }
            
            .dimension-level-0 {
                background: linear-gradient(135deg, #e6f7ff 0%, #ccf0ff 100%) !important;
                border: 1px solid #66ccff !important;
                color: #0099cc !important;
                font-weight: 600 !important;
                text-align: center !important;
            }
            
            .dimension-level-1 {
                background: linear-gradient(135deg, #f0fff0 0%, #e6ffe6 100%) !important;
                border: 1px solid #66cc66 !important;
                color: #006600 !important;
                font-weight: 600 !important;
                text-align: center !important;
            }
        `;
        
        styleElement.textContent = css;
        console.log(`📐 Applied enhanced equal width for ${dimensionCount} dimensions`);
    },


    /**
     * Get unique nodes for a dimension with their span counts
     */
    getUniqueNodesForDimension: function(field, visibleColumns, dimensionIndex) {
        const uniqueNodes = new Map();
        
        visibleColumns.forEach(combo => {
            const node = combo.nodes[dimensionIndex];
            if (node) {
                const key = node._id;
                if (!uniqueNodes.has(key)) {
                    uniqueNodes.set(key, {
                        node: node,
                        count: 0,
                        index: uniqueNodes.size
                    });
                }
                uniqueNodes.get(key).count++;
            }
        });
        
        return Array.from(uniqueNodes.values());
    },


    /**
     * Hybrid header for multi-row + multi-column
     */
    renderHybridMultiRowHeader: function(elements, rowFields, columnFields, valueFields, visibleColumns) {
        this.addEqualWidthCSS(rowFields);
        
        let headerHtml = '';
        
        // Row 1: Row dimension headers + Measures header
        headerHtml += '<tr>';
        rowFields.forEach((field, index) => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="row-header dimension-column dimension-header-${index}" rowspan="3">${dimName}</th>`;
        });
        
        const totalValueCells = visibleColumns.length * valueFields.length;
        headerHtml += `<th class="value-header measures-header" colspan="${totalValueCells}">Measures</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header" colspan="${visibleColumns.length}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Column dimension headers
        headerHtml += '<tr>';
        valueFields.forEach(() => {
            visibleColumns.forEach(col => {
                const displayLabel = this.getDisplayLabel(col);
                headerHtml += `<th class="column-header">${displayLabel}</th>`;
            });
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    /**
     * Enhanced multi-row body rendering
     */
    renderEnhancedMultiRowBody: function(elements, rowCombinations, rowFields, valueFields, visibleColumns, hasColumnDimensions) {
        let bodyHtml = '';
        
        console.log(`🏗️ Rendering ${rowCombinations.length} row combinations`);
        
        if (rowCombinations.length === 0) {
            // Show a message when no combinations are available
            const totalCols = rowFields.length + (hasColumnDimensions ? 
                visibleColumns.length * valueFields.length : valueFields.length);
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            rowCombinations.forEach((combination, rowIndex) => {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Render dimension cells
                combination.nodes.forEach((node, dimIndex) => {
                    bodyHtml += this.renderEnhancedDimensionCell(node, rowFields[dimIndex], dimIndex);
                });
                
                // Render value cells
                if (hasColumnDimensions) {
                    // Cross-tabulate with columns
                    valueFields.forEach(field => {
                        visibleColumns.forEach(colCombo => {
                            const value = this.calculateMultiDimensionalValue(
                                combination.nodes, 
                                colCombo.nodes, 
                                field
                            );
                            bodyHtml += this.renderValueCell(value);
                        });
                    });
                } else {
                    // Direct value calculation
                    valueFields.forEach(field => {
                        const value = this.calculateMultiRowValue(combination.nodes, field);
                        bodyHtml += this.renderValueCell(value);
                    });
                }
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
        
        console.log(`✅ Rendered ${rowCombinations.length} enhanced multi-dimensional combinations`);
    },


    /**
     * Calculate value for multi-dimensional cross-tabulation
     */
    calculateMultiDimensionalValue: function(rowNodes, columnNodes, valueField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData || [])];
        
        if (filteredData.length === 0) return 0;
        
        // Apply filters from all row dimensions
        rowNodes.forEach((node, index) => {
            if (node && node._id !== 'ROOT') {
                filteredData = this.filterRecordsByDimension(filteredData, node);
            }
        });
        
        // Apply filters from all column dimensions
        columnNodes.forEach((node, index) => {
            if (node && node._id !== 'ROOT') {
                filteredData = this.filterRecordsByDimension(filteredData, node);
            }
        });
        
        return this.calculateDirectMeasure(filteredData, valueField);
    },



    /**
     * Calculate value for multi-row combination (no columns)
     */
    calculateMultiRowValue: function(dimensionNodes, valueField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData || [])];
        
        if (filteredData.length === 0) return 0;
        
        // Apply filter from each dimension node
        dimensionNodes.forEach((node, index) => {
            if (node && node._id !== 'ROOT') {
                const beforeCount = filteredData.length;
                filteredData = this.filterRecordsByDimension(filteredData, node);
                // console.log(`  Multi-row filter ${index} (${node.label}): ${beforeCount} → ${filteredData.length} records`);
            }
        });
        
        return this.calculateDirectMeasure(filteredData, valueField);
    },


    /**
     * Calculate value for multi-row + column combination
     */
    calculateMultiRowColumnValue: function(rowNodes, columnNode, valueField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData || [])];
        
        if (filteredData.length === 0) return 0;
        
        // Apply filters from all row dimensions
        rowNodes.forEach((node, index) => {
            if (node && node._id !== 'ROOT') {
                filteredData = this.filterRecordsByDimension(filteredData, node);
            }
        });
        
        // Apply filter from column dimension
        if (columnNode && columnNode._id !== 'ROOT') {
            filteredData = this.filterRecordsByDimension(filteredData, columnNode);
        }
        
        return this.calculateDirectMeasure(filteredData, valueField);
    },


    /**
     * Enhanced dimension cell rendering with proper hierarchy
     */
    renderEnhancedDimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="dimension-cell dimension-${dimIndex} empty">-</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = this.extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        // Add expand/collapse control with proper hierarchy checking
        if (this.nodeHasChildren(node)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${node.label || node._id}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        // Display real node name
        const realNodeName = node.label || node._id;
        cellHtml += `<span class="dimension-label">${realNodeName}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Utility method to extract dimension name (moved from global scope)
     */
    extractDimensionName: function(dimensionField) {
        if (!dimensionField) {
            return 'unknown';
        }
        
        let dimName = dimensionField;
        if (dimName.startsWith('DIM_')) {
            dimName = dimName.replace(/^DIM_/, '');
        }
        
        return dimName.toLowerCase();
    },


    /**
     * Generate enhanced row combinations with proper hierarchy traversal
     */
    generateEnhancedRowCombinations: function(rowFields) {
        const combinations = [];
        
        // Build dimension matrices - each dimension contributes independently
        const dimensionMatrices = {};
        
        rowFields.forEach(field => {
            const dimName = this.extractDimensionName(field);
            
            // Get all rows for this dimension
            const allDimensionRows = this.state.pivotData.rows.filter(row => {
                if (!row || !row.hierarchyField) return false;
                const rowDimName = this.extractDimensionName(row.hierarchyField);
                return rowDimName === dimName;
            });
            
            // Get visible rows for this dimension independently
            const visibleRows = this.getVisibleRowsForSpecificDimension(allDimensionRows, dimName);
            dimensionMatrices[field] = this.removeDuplicateRows(visibleRows);
            
            console.log(`📊 Dimension ${dimName}: ${dimensionMatrices[field].length} unique visible rows`);
        });
        
        // Generate cartesian product with enhanced logic
        if (rowFields.length === 1) {
            // Single dimension - simple case
            const field = rowFields[0];
            const rows = dimensionMatrices[field] || [];
            return rows.map(row => ({
                nodes: [row],
                key: row._id,
                primaryRow: row
            }));
        } else if (rowFields.length === 2) {
            // Two dimensions - enhanced combination generation
            return this.generateTwoDimensionCombinations(dimensionMatrices, rowFields);
        } else if (rowFields.length === 3) {
            // Three dimensions
            return this.generateThreeDimensionCombinations(dimensionMatrices, rowFields);
        } else {
            // Four or more dimensions - recursive approach
            return this.generateRecursiveDimensionCombinations(dimensionMatrices, rowFields);
        }
    },


    /**
     * Generate combinations for two dimensions with smart filtering
     */
    generateTwoDimensionCombinations: function(dimensionMatrices, rowFields) {
        const combinations = [];
        const field1 = rowFields[0];
        const field2 = rowFields[1];
        const rows1 = dimensionMatrices[field1] || [];
        const rows2 = dimensionMatrices[field2] || [];
        
        console.log(`🔗 Two-dimension combinations: ${rows1.length} × ${rows2.length}`);
        
        // Strategy: Create meaningful combinations
        // - If both dimensions have ROOT expanded, show all combinations
        // - If one dimension is collapsed, show ROOT combinations only
        // - Apply smart filtering to avoid explosion
        
        const dim1Name = this.extractDimensionName(field1);
        const dim2Name = this.extractDimensionName(field2);
        
        const dim1HasExpansion = this.dimensionHasExpandedNodes(dim1Name);
        const dim2HasExpansion = this.dimensionHasExpandedNodes(dim2Name);
        
        if (!dim1HasExpansion && !dim2HasExpansion) {
            // Both collapsed - show only root combination
            const root1 = rows1.find(r => r._id === 'ROOT') || rows1[0];
            const root2 = rows2.find(r => r._id === 'ROOT') || rows2[0];
            if (root1 && root2) {
                combinations.push({
                    nodes: [root1, root2],
                    key: `${root1._id}|${root2._id}`,
                    primaryRow: root1
                });
            }
        } else if (dim1HasExpansion && !dim2HasExpansion) {
            // First expanded, second collapsed
            const root2 = rows2.find(r => r._id === 'ROOT') || rows2[0];
            rows1.forEach(row1 => {
                if (root2) {
                    combinations.push({
                        nodes: [row1, root2],
                        key: `${row1._id}|${root2._id}`,
                        primaryRow: row1
                    });
                }
            });
        } else if (!dim1HasExpansion && dim2HasExpansion) {
            // First collapsed, second expanded
            const root1 = rows1.find(r => r._id === 'ROOT') || rows1[0];
            rows2.forEach(row2 => {
                if (root1) {
                    combinations.push({
                        nodes: [root1, row2],
                        key: `${root1._id}|${row2._id}`,
                        primaryRow: root1
                    });
                }
            });
        } else {
            // Both expanded - show all combinations (with limit for performance)
            const maxCombinations = 100; // Limit to prevent UI explosion
            let combinationCount = 0;
            
            for (const row1 of rows1) {
                for (const row2 of rows2) {
                    if (combinationCount >= maxCombinations) break;
                    
                    combinations.push({
                        nodes: [row1, row2],
                        key: `${row1._id}|${row2._id}`,
                        primaryRow: row1
                    });
                    combinationCount++;
                }
                if (combinationCount >= maxCombinations) break;
            }
            
            if (combinationCount >= maxCombinations) {
                console.warn(`⚠️ Limited to ${maxCombinations} combinations for performance`);
            }
        }
        
        console.log(`🔗 Generated ${combinations.length} two-dimension combinations`);
        return combinations;
    },


    /**
     * Generate combinations for three dimensions
     */
    generateThreeDimensionCombinations: function(dimensionMatrices, rowFields) {
        const combinations = [];
        const [field1, field2, field3] = rowFields;
        const rows1 = dimensionMatrices[field1] || [];
        const rows2 = dimensionMatrices[field2] || [];
        const rows3 = dimensionMatrices[field3] || [];
        
        console.log(`🔗 Three-dimension combinations: ${rows1.length} × ${rows2.length} × ${rows3.length}`);
        
        // Apply intelligent filtering to prevent explosion
        const maxCombinations = 50;
        let combinationCount = 0;
        
        // Check expansion state of each dimension
        const expansionStates = rowFields.map(field => {
            const dimName = this.extractDimensionName(field);
            return this.dimensionHasExpandedNodes(dimName);
        });
        
        const expandedCount = expansionStates.filter(Boolean).length;
        
        if (expandedCount === 0) {
            // All collapsed - show only root combination
            const roots = [
                rows1.find(r => r._id === 'ROOT') || rows1[0],
                rows2.find(r => r._id === 'ROOT') || rows2[0],
                rows3.find(r => r._id === 'ROOT') || rows3[0]
            ];
            
            if (roots.every(Boolean)) {
                combinations.push({
                    nodes: roots,
                    key: roots.map(r => r._id).join('|'),
                    primaryRow: roots[0]
                });
            }
        } else if (expandedCount === 1) {
            // One expanded - cross with roots of others
            const expandedIndex = expansionStates.findIndex(Boolean);
            const expandedRows = [rows1, rows2, rows3][expandedIndex];
            const otherRoots = [
                expandedIndex !== 0 ? (rows1.find(r => r._id === 'ROOT') || rows1[0]) : null,
                expandedIndex !== 1 ? (rows2.find(r => r._id === 'ROOT') || rows2[0]) : null,
                expandedIndex !== 2 ? (rows3.find(r => r._id === 'ROOT') || rows3[0]) : null
            ].filter(Boolean);
            
            expandedRows.forEach(expandedRow => {
                const nodes = [];
                nodes[expandedIndex] = expandedRow;
                
                let rootIndex = 0;
                for (let i = 0; i < 3; i++) {
                    if (i !== expandedIndex) {
                        nodes[i] = otherRoots[rootIndex++];
                    }
                }
                
                if (nodes.every(Boolean)) {
                    combinations.push({
                        nodes: nodes,
                        key: nodes.map(r => r._id).join('|'),
                        primaryRow: nodes[0]
                    });
                }
            });
        } else {
            // Multiple expanded - limited cartesian product
            for (const row1 of rows1.slice(0, 5)) { // Limit each dimension
                for (const row2 of rows2.slice(0, 5)) {
                    for (const row3 of rows3.slice(0, 5)) {
                        if (combinationCount >= maxCombinations) break;
                        
                        combinations.push({
                            nodes: [row1, row2, row3],
                            key: `${row1._id}|${row2._id}|${row3._id}`,
                            primaryRow: row1
                        });
                        combinationCount++;
                    }
                    if (combinationCount >= maxCombinations) break;
                }
                if (combinationCount >= maxCombinations) break;
            }
        }
        
        console.log(`🔗 Generated ${combinations.length} three-dimension combinations`);
        return combinations;
    },


    /**
     * Recursive combination generation for 4+ dimensions
     */
    generateRecursiveDimensionCombinations: function(dimensionMatrices, rowFields) {
        const combinations = [];
        const maxCombinations = 25; // Lower limit for high-dimension cases
        
        console.log(`🔗 Recursive combinations for ${rowFields.length} dimensions`);
        
        // Check how many dimensions are expanded
        const expansionStates = rowFields.map(field => {
            const dimName = this.extractDimensionName(field);
            return this.dimensionHasExpandedNodes(dimName);
        });
        
        const expandedCount = expansionStates.filter(Boolean).length;
        
        if (expandedCount === 0) {
            // All collapsed - show only root combination
            const rootNodes = rowFields.map(field => {
                const rows = dimensionMatrices[field] || [];
                return rows.find(r => r._id === 'ROOT') || rows[0];
            });
            
            if (rootNodes.every(Boolean)) {
                combinations.push({
                    nodes: rootNodes,
                    key: rootNodes.map(r => r._id).join('|'),
                    primaryRow: rootNodes[0]
                });
            }
        } else {
            // Generate limited combinations focusing on expanded dimensions
            const generateRecursive = (currentCombo, currentKey, fieldIndex) => {
                if (fieldIndex >= rowFields.length) {
                    if (combinations.length < maxCombinations) {
                        combinations.push({
                            nodes: [...currentCombo],
                            key: currentKey,
                            primaryRow: currentCombo[0]
                        });
                    }
                    return;
                }
                
                if (combinations.length >= maxCombinations) return;
                
                const field = rowFields[fieldIndex];
                const rows = dimensionMatrices[field] || [];
                const isExpanded = expansionStates[fieldIndex];
                
                // Limit rows per dimension for performance
                const rowsToUse = isExpanded ? rows.slice(0, 3) : 
                    [rows.find(r => r._id === 'ROOT') || rows[0]].filter(Boolean);
                
                rowsToUse.forEach(row => {
                    if (combinations.length >= maxCombinations) return;
                    
                    const newCombo = [...currentCombo, row];
                    const newKey = currentKey ? `${currentKey}|${row._id}` : row._id;
                    generateRecursive(newCombo, newKey, fieldIndex + 1);
                });
            };
            
            generateRecursive([], '', 0);
        }
        
        console.log(`🔗 Generated ${combinations.length} recursive combinations`);
        return combinations;
    },


    /**
     * ENHANCEMENT: Reset table structure completely
     */
    resetTableStructure: function() {
        const container = document.querySelector('.pivot-table-container');
        if (container) {
            // Remove all dynamic classes
            container.classList.remove(
                'vertical-view', 
                'stacked-columns', 
                'equal-width-dimensions',
                'dimensions-2', 
                'dimensions-3', 
                'dimensions-4',
                'multi-dimension',
                'two-dimensions',
                'three-dimensions'
            );
        }
        
        // Clear existing content
        const header = document.getElementById('pivotTableHeader');
        const body = document.getElementById('pivotTableBody');
        
        if (header) header.innerHTML = '';
        if (body) body.innerHTML = '';
        
        // Remove any dynamic styles
        ['pivot-equal-widths', 'pivot-enhanced-equal-widths'].forEach(id => {
            const styleElement = document.getElementById(id);
            if (styleElement) styleElement.remove();
        });
        
        console.log("🔄 Excel-like table structure reset complete");
    },


    renderHybridMultiDimensionBody: function(elements, visiblePrimaryRows, rowFields, valueFields, visibleColumns, pivotData) {
        let bodyHtml = '';
        const hasRealColumns = visibleColumns.length > 0;
        
        // Check if we should show only root row
        const showOnlyRoot = this.areAllDimensionsCollapsed(rowFields);
        
        if (showOnlyRoot) {
            // Show only root row
            bodyHtml += this.createHybridRootRow(rowFields, valueFields, visibleColumns, hasRealColumns);
        } else {
            // Show expanded rows
            visiblePrimaryRows.forEach((primaryRow, rowIndex) => {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Render all row dimension columns
                const dimensionCells = [];
                rowFields.forEach((field, dimIndex) => {
                    let cellNode;
                    if (dimIndex === 0) {
                        cellNode = primaryRow;
                    } else {
                        cellNode = this.findCorrespondingNode(primaryRow, field);
                    }
                    dimensionCells.push(cellNode);
                    bodyHtml += this.renderMultiDimensionCell(cellNode, field, dimIndex, cellNode.level || 0);
                });
                
                // Render value cells with cross-tabulation
                if (hasRealColumns) {
                    // WITH columns - use cross-tabulation
                    valueFields.forEach(field => {
                        visibleColumns.forEach(col => {
                            const value = this.calculateHybridCrossDimensionalValue(dimensionCells, col, field);
                            bodyHtml += this.renderValueCell(value);
                        });
                    });
                } else {
                    // NO columns - direct calculation
                    valueFields.forEach(field => {
                        const value = this.calculateCrossDimensionalValue(dimensionCells, field);
                        bodyHtml += this.renderValueCell(value);
                    });
                }
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    createHybridRootRow: function(rowFields, valueFields, visibleColumns, hasRealColumns) {
        let rowHtml = `<tr class="root-row">`;
        
        // Render root nodes for each row dimension
        const rootCells = [];
        rowFields.forEach((field, dimIndex) => {
            const rootNode = this.getRootNodeForDimension(field);
            rootCells.push(rootNode);
            rowHtml += this.renderMultiDimensionCell(rootNode, field, dimIndex, 0);
        });
        
        // Render value cells
        if (hasRealColumns) {
            // WITH columns - cross-tabulate with columns
            valueFields.forEach(field => {
                visibleColumns.forEach(col => {
                    const value = this.calculateHybridCrossDimensionalValue(rootCells, col, field);
                    rowHtml += this.renderValueCell(value);
                });
            });
        } else {
            // NO columns - direct calculation
            valueFields.forEach(field => {
                const value = this.calculateCrossDimensionalValue(rootCells, field);
                rowHtml += this.renderValueCell(value);
            });
        }
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    renderMultiDimensionTable: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // console.log(`🌟 MULTI-DIM: Rendering ${rowFields.length} dimensions`);
        
        // Apply equal width CSS
        this.addEqualWidthCSS(rowFields);
        
        // Get the primary dimension for driving the row structure
        const primaryDimension = rowFields[0];
        const primaryDimName = extractDimensionName(primaryDimension);
        const primaryRows = pivotData.rows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
            return rowDimName === primaryDimName;
        });
        
        // Get only visible rows from primary dimension
        const visiblePrimaryRows = this.getVisibleRows(primaryRows);
        
        // Render header
        this.renderMultiDimensionHeader(elements, rowFields, valueFields);
        
        // Render body
        this.renderMultiDimensionBody(elements, visiblePrimaryRows, rowFields, valueFields, pivotData);
    },


    // Add this to your renderMultiDimensionHeader method for debugging
    renderMultiDimensionHeader: function(elements, rowFields, valueFields) {
        // console.log(`🔍 HEADER: ${rowFields.length} dimension columns + ${valueFields.length} value columns`);
        
        let headerHtml = '<tr>';
        
        // Dimension headers
        rowFields.forEach(field => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="dimension-header">${dimName}</th>`;
            // console.log(`📊 Dimension column: ${dimName}`);
        });
        
        // Value headers  
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
            // console.log(`💰 Value column: ${fieldLabel}`);
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
        
        // console.log(`✅ Total columns: ${rowFields.length + valueFields.length}`);
    },


    generateMultiDimensionMatrix: function(rowFields) {
        const matrix = {};
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            const visibleRows = this.getVisibleRowsForDimension(dimName);
            matrix[dimName] = visibleRows;
            
            // console.log(`📊 Matrix ${dimName}: ${visibleRows.length} visible rows`);
            visibleRows.forEach((row, idx) => {
                // console.log(`  Row ${idx}: ${row.label} (level: ${row.level})`);
            });
        });
        
        return matrix;
    },


    areAllDimensionsCollapsed: function(rowFields) {
        if (!rowFields || rowFields.length === 0) {
            return true;
        }

        // Check if ALL dimensions have no expanded nodes
        return rowFields.every(field => {
            const dimName = extractDimensionName(field);
            return !this.dimensionHasExpandedNodes(dimName);
        });
    },


    createRootRow: function(rowFields, valueFields) {
        if (!rowFields || rowFields.length === 0) {
            throw new Error("No row fields provided to createRootRow");
        }

        if (!valueFields || valueFields.length === 0) {
            throw new Error("No value fields provided to createRootRow");
        }

        let rowHtml = `<tr class="root-row">`;
        
        // Collect root nodes and render ALL dimension columns first
        const rootCells = [];
        rowFields.forEach((field, dimIndex) => {
            try {
                const rootNode = this.getRootNodeForDimension(field);
                if (!rootNode) {
                    throw new Error(`Could not get root node for field ${field}`);
                }
                
                rootCells.push(rootNode);
                rowHtml += this.renderMultiDimensionCell(rootNode, field, dimIndex, 0);
            } catch (error) {
                console.error(`Error creating root cell for dimension ${dimIndex}:`, error);
                const defaultNode = this.createDefaultNode(field);
                rootCells.push(defaultNode);
                rowHtml += this.renderMultiDimensionCell(defaultNode, field, dimIndex, 0);
            }
        });
        
        // THEN render ALL value columns
        valueFields.forEach(field => {
            try {
                const value = this.calculateCrossDimensionalValue(rootCells, field);
                rowHtml += this.renderValueCell(value);
            } catch (error) {
                console.error(`Error calculating root value for ${field}:`, error);
                rowHtml += '<td class="value-cell error">Error</td>';
            }
        });
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    getRootNodesForEachDimension: function(rowFields) {
        const rootNodes = [];
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            const hierarchy = this.state.hierarchies[dimName];
            
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap['ROOT']) {
                rootNodes.push(hierarchy.nodesMap['ROOT']);
            } else {
                // Create a default root node
                rootNodes.push({
                    _id: `${dimName.toUpperCase()}_ROOT`,
                    label: `All ${dimName.replace(/_/g, ' ')}`,
                    level: 0,
                    hasChildren: true,
                    expanded: false,
                    hierarchyField: field
                });
            }
        });
        
        return rootNodes;
    },


    renderMultiDimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="dimension-cell dimension-${dimIndex} error" data-level="0" style="padding-left: 4px !important;">Missing Node</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 30); // Enhanced to 30px per level
        const dimName = extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (node.hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                style="cursor: pointer; display: inline-block; width: 16px; height: 16px; margin-right: 8px; text-align: center; border: 1px solid #6c757d; border-radius: 2px; background: white; line-height: 14px; font-size: 12px;"
                title="Expand/collapse ${node.label}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node" style="display: inline-block; width: 16px; height: 16px; margin-right: 8px; text-align: center; line-height: 14px; color: #6c757d;">•</span>';
        }
        
        cellHtml += `<span class="dimension-label">${node.label || node._id || 'Unknown'}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    calculateGrandTotals: function(valueFields) {
        const factData = this.state.filteredData?.length > 0 ? this.state.filteredData : this.state.factData;
        const totals = {};
        
        valueFields.forEach(field => {
            let total = 0;
            factData.forEach(record => {
                const value = parseFloat(record[field] || 0);
                if (!isNaN(value)) {
                    total += value;
                }
            });
            totals[field] = total;
        });
        
        return totals;
    },


    /**
     * Render header with separate column for each dimension
     */
    renderMultiRowHeader: function(elements, rowFields, valueFields) {
        this.addEqualWidthCSS(rowFields);
        
        let headerHtml = '<tr>';
        
        // REAL dimension headers - one for each row field
        rowFields.forEach((field, index) => {
            const realDimName = this.getRealDimensionName(field);
            headerHtml += `<th class="row-header dimension-column dimension-header-${index}">${realDimName}</th>`;
        });
        
        // REAL value headers
        valueFields.forEach(field => {
            const realMeasureName = this.getRealMeasureName(field);
            headerHtml += `<th class="value-header">${realMeasureName}</th>`;
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    /**
     * Get real dimension name from field identifier
     */
    getRealDimensionName: function(field) {
        // Remove DIM_ prefix and convert to proper display name
        const dimName = this.extractDimensionName(field);
        
        // Map dimension names to display names
        const displayNames = {
            'le': 'Legal Entity',
            'cost_element': 'Cost Element',
            'material_type': 'Material Type',
            'item_cost_type': 'Item Cost Type',
            'gmid_display': 'GMID Display',
            'gmid': 'ROOT GMID',
            'smartcode': 'Smart Code',
            'mc': 'Management Center',
            'year': 'Business Year',
        };
        
        return displayNames[dimName.toLowerCase()] || 
            dimName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },


    /**
     * Get display name for dimension
     */
    getDimensionDisplayName: function(field) {
        const dimName = extractDimensionName(field);
        
        // Map dimension names to display names
        const displayNames = {
            'le': 'Legal Entity',
            'cost_element': 'Cost Element',
            'material_type': 'Material Type',
            'item_cost_type': 'Item Cost Type',
            'root_gmid_display': 'ROOT GMID',
            'gmid_display': 'GMID Display',
            'smartcode': 'Smart Code',
            'mc': 'Management Center',
            'year': 'Year'
        };
        
        return displayNames[dimName] || dimName.replace(/_/g, ' ').toUpperCase();
    },


    /**
     * Render body with content in respective columns
     */
    renderMultiRowBody: function(elements, pivotData, rowFields, valueFields) {
        // Group rows by dimension
        const rowsByDimension = this.groupRowsByDimension(pivotData.rows, rowFields);
        
        // Get the maximum number of rows across all dimensions
        const maxRows = Math.max(...Object.values(rowsByDimension).map(rows => rows.length));
        
        let bodyHtml = '';
        
        // Create rows with content in respective columns
        for (let i = 0; i < maxRows; i++) {
            bodyHtml += `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Step 3: Render content in respective columns
            rowFields.forEach(field => {
                const dimRows = rowsByDimension[field] || [];
                const row = dimRows[i]; // May be undefined if this dimension has fewer rows
                
                if (row) {
                    bodyHtml += this.renderDimensionCell(row, field);
                } else {
                    bodyHtml += '<td class="dimension-cell empty"></td>';
                }
            });
            
            // Add value cells (using first available row for now)
            const firstAvailableRow = rowFields
                .map(field => rowsByDimension[field]?.[i])
                .find(row => row);
            
            if (firstAvailableRow) {
                const rowData = pivotData.data.find(d => d._id === firstAvailableRow._id) || {};
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    bodyHtml += this.renderValueCell(value);
                });
            } else {
                // Empty value cells
                valueFields.forEach(() => {
                    bodyHtml += '<td class="value-cell empty">-</td>';
                });
            }
            
            bodyHtml += '</tr>';
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
    },


    /**
     * Group rows by their dimension
     */
    groupRowsByDimension: function(allRows, rowFields) {
        const rowsByDimension = {};
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            rowsByDimension[field] = allRows.filter(row => {
                const rowDimName = extractDimensionName(row.hierarchyField || '');
                return rowDimName === dimName;
            });
            
            // Only show visible rows for this dimension
            rowsByDimension[field] = this.getVisibleRows(rowsByDimension[field]);
            
            // console.log(`📊 Dimension ${dimName}: ${rowsByDimension[field].length} visible rows`);
        });
        
        return rowsByDimension;
    },


    /**
     * Render a single dimension cell
     */
    renderDimensionCell: function(row, field) {
        const indentation = (row.level || 0) * 15;
        const dimName = extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse if has children
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    // This function is used initialize collapsed state
    initializeCollapsedState: function() {
        // Ensure all hierarchies start in collapsed state
        if (this.state.hierarchies) {
            Object.keys(this.state.hierarchies).forEach(hierarchyName => {
                const hierarchy = this.state.hierarchies[hierarchyName];
                if (hierarchy.nodesMap) {
                    Object.keys(hierarchy.nodesMap).forEach(nodeId => {
                        const node = hierarchy.nodesMap[nodeId];
                        // Set all nodes to collapsed by default (except ROOT which can be expanded)
                        if (nodeId !== 'ROOT') {
                            node.expanded = false;
                        } else {
                            // ROOT node starts collapsed too
                            node.expanded = false;
                        }
                    });
                }
            });
        }
        
        // Initialize expanded nodes tracking with all nodes collapsed
        this.state.expandedNodes = {};
        
        // console.log("✅ All hierarchy nodes initialized to collapsed state");
    },


    // This function can be used to expand only root nodes if desired
    expandRootNodesOnly: function() {
        if (this.state.hierarchies) {
            Object.keys(this.state.hierarchies).forEach(hierarchyName => {
                const hierarchy = this.state.hierarchies[hierarchyName];
                if (hierarchy.nodesMap && hierarchy.nodesMap['ROOT']) {
                    // Initialize expansion tracking
                    initializeExpansionTracking(this.state, hierarchyName, 'row');
                    initializeExpansionTracking(this.state, hierarchyName, 'column');
                    
                    // Expand only the ROOT node
                    this.state.expandedNodes[hierarchyName].row['ROOT'] = true;
                    this.state.expandedNodes[hierarchyName].column['ROOT'] = true;
                    hierarchy.nodesMap['ROOT'].expanded = true;
                }
            });
        }
        
        // Regenerate the table
        this.generatePivotTable();
    },


    // Update your renderMultiRowColumns method to include the equal width styling:
    renderMultiRowColumns: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // Apply equal width styling
        this.applyEqualWidthStyling(elements, rowFields);
        
        // Render header and body as before
        this.renderMultiRowHeader(elements, rowFields, valueFields);
        this.renderMultiRowBody(elements, pivotData, rowFields, valueFields);
    },


    // Option 1: CSS Classes
    renderMultiRowColumns: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // console.log(`🔧 PROPER MULTI-ROW: Rendering ${rowFields.length} dimensions`);
        
        // Get the primary dimension data (usually the first dimension)
        const primaryDimension = rowFields[0];
        const primaryDimName = extractDimensionName(primaryDimension);
        const primaryRows = pivotData.rows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
            return rowDimName === primaryDimName;
        });
        
        const visiblePrimaryRows = this.getVisibleRows(primaryRows);
        // console.log(`🔧 PROPER: Found ${visiblePrimaryRows.length} visible primary rows`);
        
        // Render header
        this.renderProperMultiRowHeader(elements, rowFields, valueFields);
        
        // Render body with proper cross-tabulation
        this.renderProperMultiRowBody(elements, visiblePrimaryRows, rowFields, valueFields, pivotData);
    },


    /**
     * Enhanced multi-dimension rendering with full hierarchy support
     */
    renderEnhancedMultiDimensions: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // console.log(`🌟 ENHANCED: Rendering ${rowFields.length} dimensions with hierarchy`);
        
        // Apply equal width CSS
        this.addEqualWidthCSS(rowFields);
        
        // Generate matrix of visible rows for each dimension
        const dimensionMatrix = this.generateDimensionMatrix(rowFields, pivotData.rows);
        
        // Render header
        this.renderEnhancedMultiHeader(elements, rowFields, valueFields);
        
        // Render body with proper value calculation
        this.renderEnhancedMultiBodyWithProperValues(elements, dimensionMatrix, rowFields, valueFields, pivotData);
    },


    /**
     * Initialize collapsed state for all row dimensions
     */
    initializeMultiDimensionCollapsedState: function(rowFields) {
        if (!this.state.expandedNodes) {
            this.state.expandedNodes = {};
        }
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            
            // Initialize dimension tracking if not exists
            if (!this.state.expandedNodes[dimName]) {
                this.state.expandedNodes[dimName] = { row: {} };
            }
            
            // Ensure root nodes start collapsed
            const hierarchy = this.state.hierarchies[dimName];
            if (hierarchy && hierarchy.nodesMap) {
                Object.keys(hierarchy.nodesMap).forEach(nodeId => {
                    const node = hierarchy.nodesMap[nodeId];
                    if (nodeId === 'ROOT' || node.level === 0) {
                        // Root nodes start collapsed
                        node.expanded = false;
                        this.state.expandedNodes[dimName].row[nodeId] = false;
                    } else {
                        // All other nodes start collapsed
                        node.expanded = false;
                        this.state.expandedNodes[dimName].row[nodeId] = false;
                    }
                });
            }
        });
        
        // console.log(`🔒 Initialized collapsed state for ${rowFields.length} dimensions`);
    },


    /**
     * Render enhanced body with full hierarchy support
     */
    renderEnhancedMultiBody: function(elements, dimensionMatrix, rowFields, valueFields, pivotData) {
        let bodyHtml = '';
        const maxRows = dimensionMatrix.maxRows;
        
        for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
            bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Render each dimension column
            rowFields.forEach((field, dimIndex) => {
                const dimensionRows = dimensionMatrix[field];
                const row = dimensionRows[rowIndex];
                
                if (row) {
                    bodyHtml += this.renderHierarchicalDimensionCell(row, field, dimIndex);
                } else {
                    bodyHtml += `<td class="dimension-cell dimension-${dimIndex} empty"></td>`;
                }
            });
            
            // Render value cells - use the first available row's data
            const primaryRow = this.findPrimaryRowForIndex(dimensionMatrix, rowFields, rowIndex);
            if (primaryRow) {
                const rowData = pivotData.data.find(d => d._id === primaryRow._id) || {};
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    bodyHtml += this.renderValueCell(value);
                });
            } else {
                // Empty value cells
                valueFields.forEach(() => {
                    bodyHtml += '<td class="value-cell empty">-</td>';
                });
            }
            
            bodyHtml += '</tr>';
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    /**
     * Find primary row for value calculation at given index
     */
    findPrimaryRowForIndex: function(dimensionMatrix, rowFields, rowIndex) {
        // Use the first dimension as primary for value calculation
        const primaryField = rowFields[0];
        const primaryRows = dimensionMatrix[primaryField];
        return primaryRows[rowIndex] || null;
    },


    /**
     * Render hierarchical dimension cell with expand/collapse
     */
    renderHierarchicalDimensionCell: function(row, field, dimIndex) {
        const indentation = (row.level || 0) * 15;
        const dimName = extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse control if has children
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="handleExpandCollapseClick(event)"
                title="Expand/collapse ${row.label}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Regenerate the multi-dimension table
     */
    regenerateMultiDimensionTable: function() {
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
        
        const rowFields = this.state.rowFields || [];
        const valueFields = this.state.valueFields || [];
        
        // Generate matrix of all visible rows based on current expansion states
        const visibleRowMatrix = this.generateVisibleRowMatrix(rowFields);
        
        // Render header (unchanged)
        this.renderMultiDimensionHeader(elements, rowFields, valueFields);
        
        // Render body with current visible rows
        this.renderMultiDimensionBodyFromMatrix(elements, visibleRowMatrix, rowFields, valueFields);
    },
    

    renderMultiDimensionBody: function(elements, visiblePrimaryRows, rowFields, valueFields, pivotData) {
        if (!elements || !elements.pivotTableBody) {
            console.error("No valid elements provided to renderMultiDimensionBody");
            return;
        }

        let bodyHtml = '';
        
        // Generate TRULY independent matrices for each dimension
        const dimensionMatrices = {};
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            
            // Get all rows for this dimension
            const allDimensionRows = this.state.pivotData.rows.filter(row => {
                if (!row || !row.hierarchyField) return false;
                const rowDimName = extractDimensionName(row.hierarchyField);
                return rowDimName === dimName;
            });
            
            // Get visible rows for this dimension INDEPENDENTLY
            const visibleRows = this.getVisibleRowsForSpecificDimension(allDimensionRows, dimName);
            dimensionMatrices[field] = visibleRows;
            
            // console.log(`📊 Independent dimension ${dimName}: ${visibleRows.length} visible rows`);
            visibleRows.forEach((row, idx) => {
                // console.log(`  Row ${idx}: ${row.label} (level: ${row.level})`);
            });
        });
        
        // Generate all possible row combinations using cartesian product
        const rowCombinations = this.generateIndependentRowCombinations(dimensionMatrices, rowFields);
        
        console.log(`📊 Generated ${rowCombinations.length} row combinations`);
        
        // Render each row combination
        rowCombinations.forEach((combination, rowIndex) => {
            bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Render dimension cells
            combination.nodes.forEach((node, dimIndex) => {
                bodyHtml += this.renderIndependentDimensionCell(node, rowFields[dimIndex], dimIndex);
            });
            
            // Calculate cross-dimensional values for this specific combination
            valueFields.forEach(field => {
                const value = this.calculateIndependentCrossDimensionalValue(combination.nodes, field);
                bodyHtml += this.renderValueCell(value);
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    // Function to remove duplicate rows from a single dimension
    removeDuplicateRows: function(rows) {
        const seen = new Set();
        const uniqueRows = [];
        
        rows.forEach(row => {
            const key = `${row._id}-${row.label}-${row.level}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueRows.push(row);
            }
        });
        
        // console.log(`    Removed ${rows.length - uniqueRows.length} duplicate rows`);
        return uniqueRows;
    },


    // Function to check if a dimension has expanded nodes
    dimensionHasExpandedNodes: function(dimName) {
        if (!this.state.expandedNodes || !this.state.expandedNodes[dimName] || !this.state.expandedNodes[dimName].row) {
            return false;
        }
        
        const expandedNodes = this.state.expandedNodes[dimName].row;
        
        // Check if any node in this dimension is expanded
        return Object.values(expandedNodes).some(isExpanded => isExpanded === true);
    },


    // Recursive combination generator for 4+ dimensions
    generateRecursiveCombinations: function(dimensionMatrices, rowFields) {
        const combinations = [];
        
        const generateRecursive = (currentCombo, currentKey, fieldIndex) => {
            if (fieldIndex >= rowFields.length) {
                combinations.push({
                    nodes: [...currentCombo],
                    key: currentKey
                });
                return;
            }
            
            const field = rowFields[fieldIndex];
            const rows = dimensionMatrices[field] || [];
            
            rows.forEach(row => {
                const newCombo = [...currentCombo, row];
                const newKey = currentKey ? `${currentKey}|${row._id}` : row._id;
                generateRecursive(newCombo, newKey, fieldIndex + 1);
            });
        };
        
        generateRecursive([], '', 0);
        return combinations;
    },


    createIndependentRootRow: function(rowFields, valueFields) {
        let rowHtml = `<tr class="root-row">`;
        
        const rootCells = [];
        
        // Create root node for each dimension - ALWAYS show root nodes
        rowFields.forEach((field, dimIndex) => {
            const rootNode = this.getRootNodeForDimension(field);
            rootCells.push(rootNode);
            rowHtml += this.renderIndependentDimensionCell(rootNode, field, dimIndex);
        });
        
        // Calculate cross-dimensional values for root combination
        valueFields.forEach(field => {
            const value = this.calculateIndependentCrossDimensionalValue(rootCells, field);
            rowHtml += this.renderValueCell(value);
        });
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    /**
     * Safe root row creation
     */
    createSafeRootRow: function(rowFields, valueFields) {
        let rowHtml = `<tr class="root-row">`;
        
        // Collect root nodes and render ALL dimension columns
        const rootCells = [];
        
        rowFields.forEach((field, dimIndex) => {
            const rootNode = this.getRootNodeForDimension(field);
            rootCells.push(rootNode);
            
            try {
                // Render with proper dimension index
                rowHtml += this.renderSafeMultiDimensionCell(rootNode, field, dimIndex);
            } catch (error) {
                console.error(`Error rendering root cell for dimension ${dimIndex}:`, error);
                rowHtml += `<td class="dimension-cell error">Error</td>`;
            }
        });
        
        // Render value columns
        valueFields.forEach(field => {
            try {
                const value = this.calculateCrossDimensionalValue(rootCells, field);
                rowHtml += this.renderValueCell(value);
            } catch (error) {
                console.error(`Error calculating root value for ${field}:`, error);
                rowHtml += '<td class="value-cell error">-</td>';
            }
        });
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    /**
     * Create an error row when something goes wrong
     */
    createErrorRow: function(rowFields, valueFields, errorMessage) {
        let rowHtml = '<tr class="error-row">';
        
        // Error message in first dimension column
        rowHtml += `<td class="dimension-cell error" colspan="${rowFields.length}">${errorMessage}</td>`;
        
        // Empty value cells
        valueFields.forEach(() => {
            rowHtml += '<td class="value-cell error">-</td>';
        });
        
        rowHtml += '</tr>';
        return rowHtml;
    },


    getVisibleRowsForDimension: function(dimName) {
        if (!dimName) {
            console.warn("No dimension name provided to getVisibleRowsForDimension");
            return [];
        }

        if (!this.state.pivotData || !this.state.pivotData.rows) {
            console.warn("No pivot data available for getVisibleRowsForDimension");
            return [];
        }

        const allRows = this.state.pivotData.rows.filter(row => {
            if (!row || !row.hierarchyField) return false;
            const rowDimName = extractDimensionName(row.hierarchyField);
            return rowDimName === dimName;
        });
        
        return this.getVisibleRowsForSpecificDimension(allRows, dimName);
    },


    generateVisibleRowMatrix: function(rowFields) {
        const matrix = [];
        
        // Get the primary dimension (first one) to drive row count
        const primaryField = rowFields[0];
        const primaryDimName = extractDimensionName(primaryField);
        const primaryRows = this.getVisibleRowsForDimension(primaryDimName);
        
        // For each visible row in primary dimension
        primaryRows.forEach(primaryRow => {
            const matrixRow = {
                primaryRow: primaryRow,
                dimensionCells: []
            };
            
            // For each dimension, determine what to show in that column
            rowFields.forEach((field, dimIndex) => {
                if (dimIndex === 0) {
                    // Primary dimension - use the actual row
                    matrixRow.dimensionCells.push(primaryRow);
                } else {
                    // Other dimensions - show corresponding node or root
                    const correspondingNode = this.findCorrespondingNode(primaryRow, field);
                    matrixRow.dimensionCells.push(correspondingNode);
                }
            });
            
            matrix.push(matrixRow);
        });
        
        return matrix;
    },


    findCorrespondingNode: function(primaryRow, targetField, rowIndex = 0) {
        if (!targetField) {
            console.warn("No targetField provided to findCorrespondingNode");
            return this.getRootNodeForDimension(targetField);
        }

        if (!primaryRow) {
            console.warn("No primaryRow provided to findCorrespondingNode");
            return this.getRootNodeForDimension(targetField);
        }

        const targetDimName = extractDimensionName(targetField);
        
        // Check if this secondary dimension has been expanded
        const isRootExpanded = this.state.expandedNodes?.[targetDimName]?.row?.['ROOT'];
        
        // console.log(`🔍 Finding node for ${targetDimName}, expanded: ${isRootExpanded}`);
        
        if (!isRootExpanded) {
            // Return root node for collapsed secondary dimensions
            return this.getRootNodeForDimension(targetField);
        } else {
            // If expanded, get the visible rows for this dimension
            try {
                const targetRows = this.getVisibleRowsForSpecificDimension([], targetDimName);
                
                // Try to match based on the same level/position as primary row
                if (targetRows && targetRows.length > 0) {
                    // For now, return the first non-root visible row
                    const nonRootRows = targetRows.filter(row => row._id !== 'ROOT');
                    if (nonRootRows.length > 0) {
                        // Use modulo to cycle through available rows
                        const selectedRow = nonRootRows[rowIndex % nonRootRows.length];
                        // console.log(`🔍 Selected ${selectedRow.label} for ${targetDimName}`);
                        return selectedRow;
                    }
                }
                
                // Fallback to root
                return this.getRootNodeForDimension(targetField);
                
            } catch (error) {
                console.error(`Error finding corresponding node for ${targetDimName}:`, error);
                return this.getRootNodeForDimension(targetField);
            }
        }
    },


    /**
     * Better dimension root labels
     */
    getDimensionRootLabel: function(dimName) {
        const labels = {
            'le': 'All Legal Entities', 
            'mc': 'All Management Centers',
            'cost_element': 'All Cost Elements',
            'gmid_display': 'All GMIDs',
            'material_type': 'All Materials',
            'item_cost_type': 'All Cost Types',
            'year': 'All Years',
            'smartcode': 'All Smart Codes'
        };
        
        return labels[dimName?.toLowerCase()] || `All ${dimName?.replace(/_/g, ' ') || 'Items'}`;
    },


    getRootNodeForDimension: function(field) {
        if (!field) {
            console.warn("No field provided to getRootNodeForDimension");
            return this.createSafeRootNode('unknown', field);
        }

        const dimName = extractDimensionName(field);

        try {
            // Check if hierarchy exists
            if (!this.state.hierarchies) {
                console.warn("No hierarchies in state");
                return this.createSafeRootNode(dimName, field);
            }

            const hierarchy = this.state.hierarchies[dimName];
            if (!hierarchy) {
                console.warn(`No hierarchy found for dimension: ${dimName}`);
                return this.createSafeRootNode(dimName, field);
            }

            if (!hierarchy.nodesMap) {
                console.warn(`No nodesMap found for dimension: ${dimName}`);
                return this.createSafeRootNode(dimName, field);
            }

            const rootNode = hierarchy.nodesMap['ROOT'];
            if (!rootNode) {
                console.warn(`No ROOT node found for dimension: ${dimName}`);
                return this.createSafeRootNode(dimName, field);
            }

            // Return a safe copy of the root node
            return {
                _id: 'ROOT',
                label: rootNode.label || this.getDimensionRootLabel(dimName),
                level: 0,
                hasChildren: rootNode.hasChildren || true,
                expanded: false,
                hierarchyField: field,
                isRoot: true,
                isLeaf: false
            };
            
        } catch (error) {
            console.error(`Error getting root node for ${dimName}:`, error);
            return this.createSafeRootNode(dimName, field);
        }
    },


    /**
     * Create a default root node when hierarchy is missing
     */
    createDefaultRootNode: function(dimName, field) {
        return {
            _id: 'ROOT',
            label: this.getDimensionRootLabel(dimName),
            level: 0,
            hasChildren: true,
            expanded: false,
            hierarchyField: field,
            isRoot: true
        };
    },


    /**
     * Create a completely default node as fallback
     */
    createDefaultNode: function(field) {
        return {
            _id: 'ROOT',
            label: 'Unknown',
            level: 0,
            hasChildren: false,
            expanded: false,
            hierarchyField: field || 'UNKNOWN',
            isRoot: true
        };
    },


    /**
     * Create a completely default node as fallback
     */
    createDefaultNode: function(field) {
        return {
            _id: 'UNKNOWN_ROOT',
            label: 'Unknown',
            level: 0,
            hasChildren: false,
            expanded: false,
            hierarchyField: field || 'UNKNOWN',
            isRoot: true
        };
    },


    /**
     * Create a default root node when hierarchy is missing
     */
    createDefaultRootNode: function(dimName, field) {
        return {
            _id: `${dimName.toUpperCase()}_ROOT`,
            label: this.getDimensionRootLabel(dimName),
            level: 0,
            hasChildren: true,
            expanded: false,
            hierarchyField: field,
            isRoot: true
        };
    },


    calculateCrossDimensionalValue: function(dimensionCells, valueField) {
        // Validate inputs
        if (!dimensionCells || !Array.isArray(dimensionCells) || dimensionCells.length === 0) {
            console.warn("Invalid dimensionCells provided to calculateCrossDimensionalValue");
            return 0;
        }

        if (!valueField) {
            console.warn("No valueField provided to calculateCrossDimensionalValue");
            return 0;
        }

        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData || [])];
        
        if (filteredData.length === 0) {
            console.warn("No fact data available for calculation");
            return 0;
        }

        // console.log(`🔍 CROSS-CALC: Starting with ${filteredData.length} records for ${dimensionCells.map(c => c.label).join(' × ')}`);
        
        // Apply filter from each dimension cell that's not null and not a root
        dimensionCells.forEach((cell, index) => {
            if (!cell) {
                // console.log(`  Dimension ${index}: null cell, skipping filter`);
                return;
            }

            // CRITICAL: Only skip ROOT nodes, not all nodes with "All" in the name
            if (cell._id === 'ROOT') {
                // console.log(`  Dimension ${index}: ROOT cell (${cell.label}), skipping filter`);
                return;
            }

            const beforeCount = filteredData.length;
            try {
                // ENHANCED: Use proper dimension-specific filtering
                filteredData = this.filterRecordsByDimension(filteredData, cell);
                // console.log(`  Dimension ${index} (${cell.label}): ${beforeCount} → ${filteredData.length} records`);
            } catch (error) {
                console.error(`Error filtering dimension ${index} (${cell.label}):`, error);
            }
        });
        
        // Calculate the measure
        try {
            const result = this.calculateDirectMeasure(filteredData, valueField);
            // console.log(`  Final result: ${result} from ${filteredData.length} records`);
            return result;
        } catch (error) {
            console.error(`Error calculating measure for ${valueField}:`, error);
            return 0;
        }
    },


    /**
     * Calculate and render values based on cross-dimensional filtering
     */
    renderCrossDimensionalValues: function(rowNodes, valueFields, pivotData) {
        let valueCellsHtml = '';
        
        // If any node is null (empty cell), show empty values
        if (rowNodes.some(node => node === null)) {
            valueFields.forEach(() => {
                valueCellsHtml += '<td class="value-cell empty">-</td>';
            });
            return valueCellsHtml;
        }
        
        // Calculate values by applying filters from all dimensions
        const factData = this.state.filteredData?.length > 0 ? this.state.filteredData : this.state.factData;
        
        valueFields.forEach(fieldId => {
            // Start with all data
            let filteredData = [...factData];
            
            // Apply filter from each dimension
            rowNodes.forEach(node => {
                if (node && node._id !== 'ROOT') {
                    // Apply dimension-specific filtering
                    filteredData = this.filterRecordsByDimension(filteredData, node);
                }
            });
            
            // Calculate the measure
            const value = this.calculateDirectMeasure(filteredData, fieldId);
            valueCellsHtml += this.renderValueCell(value);
            
            // Debug logging
            // if (value > 0) {
            //     const nodeLabels = rowNodes.map(n => n ? n.label : 'empty').join(' × ');
            //     console.log(`💰 Value calculation: ${nodeLabels} × ${fieldId} = ${value} (from ${filteredData.length} records)`);
            // }
        });
        
        return valueCellsHtml;
    },


    /**
     * Generate matrix of visible rows for each dimension
     */
    generateDimensionMatrix: function(rowFields, allRows) {
        const matrix = {};
        let maxRows = 0;
        
        rowFields.forEach((field, fieldIndex) => {
            const dimName = extractDimensionName(field);
            
            // console.log(`📊 Processing field ${fieldIndex}: ${field} (${dimName})`);
            
            // Get all rows for this dimension
            const dimensionRows = allRows.filter(row => {
                const rowDimName = extractDimensionName(row.hierarchyField || '');
                const matches = rowDimName === dimName;
                if (matches) {
                    console.log(`  Found row: ${row.label} (level: ${row.level})`);
                }
                return matches;
            });
            
            // console.log(`📊 Dimension ${dimName}: found ${dimensionRows.length} total rows`);
            
            // Get only visible rows (respecting expand/collapse state)
            const visibleRows = this.getVisibleRowsForSpecificDimension(dimensionRows, dimName);
            
            matrix[field] = visibleRows;
            maxRows = Math.max(maxRows, visibleRows.length);
            
            // console.log(`📊 Dimension ${dimName}: ${visibleRows.length} visible rows after filtering`);
            // visibleRows.forEach((row, idx) => {
            //     console.log(`  Visible row ${idx}: ${row.label} (${row._id})`);
            // });
        });
        
        matrix.maxRows = maxRows;
        // console.log(`📊 Matrix complete: max rows = ${maxRows}`);
        return matrix;
    },


    /**
     * Render enhanced header with dimension columns
     */
    renderEnhancedMultiHeader: function(elements, rowFields, valueFields) {
        let headerHtml = '<tr>';
        
        // Dimension headers
        rowFields.forEach((field, index) => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="row-header dimension-column dimension-header-${index}">${dimName}</th>`;
        });
        
        // Value headers
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    /**
     * Get visible rows for a specific dimension respecting expansion state
     */
    getVisibleRowsForSpecificDimension: function(dimensionRows, dimName) {
        // If no dimensionRows provided, get them from pivotData
        if (!dimensionRows || dimensionRows.length === 0) {
            if (this.state.pivotData && this.state.pivotData.rows) {
                dimensionRows = this.state.pivotData.rows.filter(row => {
                    if (!row || !row.hierarchyField) return false;
                    const rowDimName = extractDimensionName(row.hierarchyField);
                    return rowDimName === dimName;
                });
            } else {
                return [];
            }
        }

        // console.log(`🔍 Filtering visible rows for ${dimName}: ${dimensionRows.length} total rows`);
        
        const visibleRows = dimensionRows.filter(row => {
            // Always show root nodes
            if (row._id === 'ROOT' || !row.path || row.path.length <= 1) {
                console.log(`  Root node always visible: ${row.label}`);
                return true;
            }
            
            // Check if all ancestors are expanded in ROW zone specifically
            for (let i = 1; i < row.path.length - 1; i++) {
                const ancestorId = row.path[i];
                const isExpanded = this.state.expandedNodes?.[dimName]?.row?.[ancestorId];
                if (!isExpanded) {
                    console.log(`  Hidden by ancestor ${ancestorId}: ${row.label}`);
                    return false;
                }
            }
            
            console.log(`  Visible: ${row.label}`);
            return true;
        });
        
        // console.log(`🔍 ${dimName}: ${visibleRows.length} of ${dimensionRows.length} rows are visible`);
        return visibleRows;
    },


    /**
     * Simple equal width CSS injection
     */
    addEqualWidthCSS: function(rowFields) {
        const dimensionCount = rowFields.length;
        if (dimensionCount < 2) return;
        
        // Create or update style element
        let styleElement = document.getElementById('pivot-equal-widths');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'pivot-equal-widths';
            document.head.appendChild(styleElement);
        }
        
        const equalWidth = Math.floor(100 / dimensionCount);
        
        const css = `
            .pivot-table-container table {
                table-layout: fixed !important;
                width: 100% !important;
            }
            
            .dimension-column {
                width: ${equalWidth}% !important;
                min-width: ${equalWidth}% !important;
                max-width: ${equalWidth}% !important;
                box-sizing: border-box !important;
            }
            
            .dimension-cell {
                width: ${equalWidth}% !important;
                min-width: ${equalWidth}% !important;
                max-width: ${equalWidth}% !important;
                box-sizing: border-box !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                white-space: normal !important;
            }
            
            .value-cell {
                width: auto !important;
                min-width: 80px !important;
            }
            
            .dimension-cell .dimension-label {
                max-width: 100% !important;
                word-wrap: break-word !important;
                white-space: normal !important;
            }
        `;
        
        styleElement.textContent = css;
        // console.log(`📐 Applied ${equalWidth}% equal width for ${dimensionCount} dimensions`);
    },


    /**
     * Find corresponding row from another dimension
     */
    findCorrespondingRow: function(primaryRow, targetField, allRows) {
        const targetDimName = extractDimensionName(targetField);
        
        // Find rows from the target dimension
        const targetDimensionRows = allRows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
            return rowDimName === targetDimName;
        });
        
        // For now, return the root node of the target dimension
        // You can implement more sophisticated matching logic here
        const rootRow = targetDimensionRows.find(row => row._id.includes('ROOT') || row.level === 0);
        return rootRow || targetDimensionRows[0] || { _id: 'unknown', label: 'Unknown' };
    },


    // x
};


// Event listener for the toggle button
document.getElementById('toggleViewBtn')?.addEventListener('click', () => {
    pivotTable.toggleView();
});


// Export the pivotTable object
export default pivotTable;