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
    return dimensionField.replace(/^DIM_/, '').toLowerCase();
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
        // Smart expand/collapse handler
        window.handleExpandCollapseClick = (e) => {
            const rowFields = this.state.rowFields || [];
            const zone = e.target.getAttribute('data-zone') || 'row';
            
            console.log(`🎯 Expand/collapse: zone=${zone}, rowFields.length=${rowFields.length}`);
            
            if (rowFields.length > 1 && zone === 'row') {
                // Use multi-dimension handler for row expansions in multi-dimension mode
                this.handleMultiDimensionExpandCollapse(e);
            } else {
                // Use standard handler for single dimensions or column expansions
                this.handleExpandCollapseClick(e);
            }
        };
        
        // Use the enhanced generation method
        window.generatePivotTable = this.generatePivotTable.bind(this);
        
        console.log(`✅ Enhanced global handlers set up`);
    },


    nodeHasChildren: function(node) {
        return nodeHasChildren(node, this.state);
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

        // Add event handlers
        setTimeout(() => {
            container.querySelectorAll('.expand-collapse').forEach(control => {
                control.addEventListener('click', window.handleExpandCollapseClick);
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

        return this.formattedValue;
    },

    
    /**
     * Handle expand/collapse clicks
     */
    handleExpandCollapseClick: function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';

        // Toggle expansion state
        const isCurrentlyExpanded = e.target.classList.contains('expanded');
        const newState = !isCurrentlyExpanded;
        
        // Update state
        this.updateNodeExpansionState(nodeId, hierarchyName, zone, newState);
        
        // For multi-dimension tables, regenerate the entire table
        if (this.state.rowFields.length > 1) {
            this.regenerateMultiDimensionTable();
        } else {
            window.refreshPivotTable();
        }
        
        e.stopPropagation();
    },


    updateNodeExpansionState: function(nodeId, hierarchyName, zone, newState) {
    // Initialize expansion tracking if needed
    if (!this.state.expandedNodes) {
        this.state.expandedNodes = {};
    }
    if (!this.state.expandedNodes[hierarchyName]) {
        this.state.expandedNodes[hierarchyName] = { row: {}, column: {} };
    }
    if (!this.state.expandedNodes[hierarchyName][zone]) {
        this.state.expandedNodes[hierarchyName][zone] = {};
    }

    // Update state
    this.state.expandedNodes[hierarchyName][zone][nodeId] = newState;
    
    // Update node object if it exists
    const node = this.state.hierarchies[hierarchyName]?.nodesMap[nodeId];
    if (node) {
        node.expanded = newState;
    }
    
    console.log(`📝 Updated ${nodeId} in ${hierarchyName}[${zone}] to ${newState}`);
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


    // EMERGENCY: Simple calculation method that bypasses filtering for ROOT nodes
    emergencyCalculateMeasure: function(records, rowDef, colDef, measureField) {
        // console.log(`🚨 EMERGENCY CALC: ${rowDef?.label} - ${measureField}`);
        
        if (!records || records.length === 0) return 0;
        
        // For ROOT/WORLDWIDE nodes, sum everything without filtering
        if (!rowDef || rowDef._id === 'ROOT' || rowDef.label === 'WORLDWIDE' || rowDef._id === 'ROOT_WORLDWIDE') {
            // console.log("🚨 ROOT NODE: Summing all records without filtering");
            let total = 0;
            let count = 0;
            
            records.forEach(record => {
                const value = parseFloat(record[measureField] || 0);
                if (!isNaN(value)) {
                    total += value;
                    count++;
                }
            });
            
            // console.log(`🚨 Emergency result: ${total} from ${count} valid records`);
            return total;
        }
        
        // For other nodes, fall back to regular calculation
        return this.calculateMeasure(records, rowDef, colDef, measureField);
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
        // console.log(`🔍 GMID Filter: Processing node "${node.label}" (${node._id}) with ${records.length} records`);
        
        // CRITICAL: Don't filter ROOT nodes - include ALL records for grand totals
        if (node._id === 'ROOT' || node.label === 'All GMIDs' || 
            node._id.endsWith('_ROOT') || node.label === 'WORLDWIDE') {
            // console.log(`🔍 GMID Filter: ROOT node - returning all ${records.length} records`);
            return records;
        }

        // For leaf nodes with factId, handle both COMPONENT_GMID and PATH_GMID matching
        if (node.isLeaf && node.factId) {
            let filtered = [];
            
            // console.log(`🔍 GMID Filter: Leaf node factId: "${node.factId}"`);
            
            if (Array.isArray(node.factId)) {
                // Handle multiple factIds (when multiple records map to same node)
                node.factId.forEach(factId => {
                    const singleFiltered = this.filterByFactId(records, factId);
                    filtered = filtered.concat(singleFiltered);
                    // console.log(`🔍 GMID Filter: Array factId "${factId}" matched ${singleFiltered.length} records`);
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
                // console.log(`🔍 GMID Filter: Single factId "${node.factId}" matched ${filtered.length} records`);
            }
            
            // console.log(`🔍 GMID Filter: Final result for "${node.label}": ${filtered.length} records`);
            return filtered;
        }

        // For parent/hierarchy nodes, use prefix matching
        if (node.prefixFilter) {
            const filtered = records.filter(r => {
                // Check PATH_GMID contains the prefix
                const pathMatch = r.PATH_GMID && r.PATH_GMID.includes(node.prefixFilter);
                // Check COMPONENT_GMID starts with prefix (if not null)
                const componentMatch = r.COMPONENT_GMID && r.COMPONENT_GMID.startsWith(node.prefixFilter);
                return pathMatch || componentMatch;
            });
            // console.log(`🔍 GMID Filter: Prefix "${node.prefixFilter}" matched ${filtered.length} records`);
            return filtered;
        }
        
        // Fallback: no specific filter criteria
        // console.log(`🔍 GMID Filter: No specific filter for "${node.label}" - returning all ${records.length} records`);
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
            console.log(`🔍 FACT_ID Filter: PATH_GMID exact match for "${factId}": ${pathMatches.length} records`);
            
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
    renderTableBody: function (elements, pivotData) {
        if (!elements || !elements.pivotTableBody || !pivotData) return;

        const valueFields = this.state.valueFields || [];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
        
        // CRITICAL: Same logic for determining real columns as in calculatePivotCells
        const realColumns = columns.filter(col => 
            col._id !== 'default' && 
            col._id !== 'no_columns' &&
            col.label !== 'Value' &&
            col.label !== 'All Data' &&
            col.label !== 'Measures' &&
            col.hierarchyField // Must have a hierarchy field to be real
        );
        
        const hasRealColumnDimensions = realColumns.length > 0;

        let bodyHtml = '';
        const visibleRows = this.getVisibleRows(pivotData.rows);
        
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};

            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Row header cell
            const indentation = row.level * 20;
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : 'unknown';
            
            bodyHtml += `<td class="hierarchy-cell" data-node-id="${row._id}" data-level="${row.level}" style="padding-left: ${indentation}px;">`;
            
            if (row.hasChildren) {
                const expandClass = row.expanded ? 'expanded' : 'collapsed';
                bodyHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${row._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="row"
                    onclick="handleExpandCollapseClick(event)"
                    title="Expand/collapse ${row.label || row._id}"></span>`;
            } else {
                bodyHtml += '<span class="leaf-node"></span>';
            }
            
            bodyHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
            bodyHtml += '</td>';

            // Value cells - CRITICAL: Match the key structure used in calculation
            if (hasRealColumnDimensions) {
                // WITH column hierarchies - use pipe notation
                const leafColumns = this.getVisibleLeafColumns(realColumns);
                valueFields.forEach(field => {
                    leafColumns.forEach(col => {
                        const key = `${col._id}|${field}`;
                        const value = rowData[key] || 0;
                        bodyHtml += this.renderValueCell(value);
                    });
                });
            } else {
                // NO column hierarchies - use direct field names
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    bodyHtml += this.renderValueCell(value);
                });
            }
            
            bodyHtml += '</tr>';
        });

        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    /**
     * Calculate cross-dimensional measure for stacked columns
     */
    calculateCrossDimensionalMeasure: function(rowNode, columnNodes, measureField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData)];
        
        console.log(`🔍 CROSS-CALC: Row ${rowNode.label} × Columns [${columnNodes.map(n => n.label).join(', ')}] × ${measureField}`);
        
        // Apply row filtering
        if (rowNode && rowNode._id !== 'ROOT' && !rowNode._id.includes('ROOT')) {
            filteredData = this.filterRecordsByDimension(filteredData, rowNode);
            console.log(`  After row filter: ${filteredData.length} records`);
        }
        
        // Apply each column dimension filter
        columnNodes.forEach((colNode, index) => {
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
                console.log(`🏗️ Enabled stacked columns mode for ${columnFields.length} column dimensions`);
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

        if (valueFields.length === 0) {
            console.warn("No value fields selected, defaulting to COST_UNIT");
            this.state.valueFields = ['COST_UNIT'];
        }

        // Process rows using data.js function
        const rowData = data.processHierarchicalFields(rowFields, 'row');
        
        // Process columns using data.js function or create default
        const columnData = columnFields.length > 0
            ? data.processHierarchicalFields(columnFields, 'column')
            : { 
                flatRows: [{ _id: 'default', label: 'Value' }], 
                flatMappings: [{ _id: 'default', isLeaf: true }] 
            };

        // Initialize pivotData with all required properties
        this.state.pivotData = {
            rows: rowData.flatRows || [],
            rowMappings: rowData.flatMappings || [],
            columns: columnData.flatRows || [],
            columnMappings: columnData.flatMappings || [],
            data: []
        };

        // Calculate the values for each cell
        this.calculatePivotCells();
    },


    /**
     * Process multiple dimension fields
     */
    processMultiDimensionFields: function (fields, zone) {
        const flatRows = [];
        const flatMappings = [];
        
        const processNodeRecursive = (node, dimensionField, hierarchy, path, level) => {
            const dimensionName = extractDimensionName(dimensionField);
            const hasChildren = nodeHasChildren(node, this.state);
            
            // Check expansion state - default to false (collapsed)
            const isExpanded = isNodeExpanded(node._id, dimensionName, zone, this.state);
            
            const processedNode = {
                _id: node._id,
                label: node.label || node._id,
                hierarchyField: dimensionField,
                level: level,
                path: [...path, node._id],
                hasChildren: hasChildren,
                isLeaf: !hasChildren,
                expanded: isExpanded, // This will be false by default
                dimension: dimensionField,
                factId: node.factId
            };
            
            flatRows.push(processedNode);
            flatMappings.push({ 
                _id: node._id, 
                dimension: dimensionField, 
                level: level 
            });
            
            // CRITICAL: Only process children if expanded
            // This ensures child nodes are hidden when parent is collapsed
            if (hasChildren && isExpanded) {
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

        console.log(`✅ Pivot calculation complete: ${pivotData.rows.length} rows processed`);
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
    renderRowCell: function (rowDef) {
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0;

        // console.log("Rendering row cell:", {
        //     id: rowDef._id,
        //     label: rowDef.label,
        //     hasChildren: rowDef.hasChildren,
        //     isLeaf: rowDef.isLeaf,
        //     expanded: rowDef.expanded
        // });

        let cellHtml = `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;

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
     * Renders hierarchical columns with merged measure headers
     */
    renderHierarchicalColumns: function (elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) return;

        const valueFields = this.state.valueFields || [];
        const columnFields = this.state.columnFields || [];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');

        console.log(`🏗️ COLUMNS: ${columnFields.length} column dimensions, ${columns.length} column nodes`);

        // Check if we need stacked column rendering
        if (columnFields.length > 1 && columns.length > 0) {
            console.log(`🚀 Using STACKED column rendering for ${columnFields.length} dimensions`);
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
            
            console.log(`📊 Level ${index} (${dimName}): ${dimensionNodes.length} nodes`);
            dimensionNodes.forEach(node => {
                console.log(`  - ${node.label || node._id} (${node._id})`);
            });
        });
        
        // Generate all combinations of visible leaf nodes across dimensions
        structure.leafCombinations = this.generateColumnCombinations(structure.levels);
        
        console.log(`📊 Column structure: ${structure.levels.length} levels, ${structure.leafCombinations.length} combinations`);
        structure.leafCombinations.forEach((combo, idx) => {
            console.log(`  Combination ${idx}: ${combo.labels.join(' × ')} (${combo.key})`);
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
        
        console.log(`📋 All nodes for dimension ${dimName}:`, dimensionNodes.map(n => `${n.label} (level: ${n.level}, id: ${n._id})`));
        
        // For stacked columns, we want to show the LEAF nodes that are actually meaningful
        // Filter out ROOT nodes and get the actual data nodes
        const leafNodes = dimensionNodes.filter(node => {
            // Skip ROOT nodes
            if (node._id === 'ROOT' || node._id.includes('ROOT')) {
                return false;
            }
            
            // For ITEM_COST_TYPE: we want AV, OVERHEAD, MATERIAL, VARIABLE
            // For MC: we want SANOFI, BIOPHARMA, CHC INTEGRATED
            
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
        
        console.log(`📋 Filtered leaf nodes for ${dimName}:`, leafNodes.map(n => `${n.label} (level: ${n.level}, factId: ${n.factId})`));
        
        // If we don't have any leaf nodes, try a different approach
        if (leafNodes.length === 0) {
            // Get all non-ROOT nodes
            const nonRootNodes = dimensionNodes.filter(node => 
                node._id !== 'ROOT' && 
                !node._id.includes('ROOT') && 
                node.label !== 'All Item Cost Type' &&
                node.label !== 'Sanofi'
            );
            
            console.log(`📋 Fallback non-root nodes for ${dimName}:`, nonRootNodes.map(n => `${n.label} (level: ${n.level})`));
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
    generateColumnCombinations: function(levels) {
        if (levels.length === 0) return [];
        if (levels.length === 1) {
            return levels[0].map(node => ({
                nodes: [node],
                labels: [node.label || node._id],
                key: node._id
            }));
        }
        
        // Generate cartesian product of all dimension levels
        const combinations = [];
        
        const generateRecursive = (currentCombo, currentLabels, currentKey, levelIndex) => {
            if (levelIndex >= levels.length) {
                combinations.push({
                    nodes: [...currentCombo],
                    labels: [...currentLabels],
                    key: currentKey
                });
                return;
            }
            
            levels[levelIndex].forEach(node => {
                generateRecursive(
                    [...currentCombo, node],
                    [...currentLabels, node.label || node._id],
                    currentKey ? `${currentKey}|${node._id}` : node._id,
                    levelIndex + 1
                );
            });
        };
        
        generateRecursive([], [], '', 0);
        
        console.log(`🔗 Generated ${combinations.length} combinations from levels:`, levels.map(l => l.length));
        return combinations;
    },


    /**
     * Render stacked column headers for multiple column dimensions
     */
    renderStackedColumnHeaders: function(elements, pivotData, columnFields, valueFields) {
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
        
        console.log(`🏗️ DIRECT ACCESS: ${columnFields.length} column fields, ${columns.length} column nodes`);
        
        // Get the actual meaningful nodes for each dimension
        const itemCostTypeNodes = this.getVisibleNodesForDimension(columns, extractDimensionName(columnFields[0])); // Should get AV, OVERHEAD, MATERIAL, VARIABLE
        const mcNodes = this.getVisibleNodesForDimension(columns, extractDimensionName(columnFields[1])); // Should get SANOFI, BIOPHARMA, CHC INTEGRATED
        
        console.log(`📊 ITEM_COST_TYPE nodes:`, itemCostTypeNodes.map(n => n.label));
        console.log(`📊 MC nodes:`, mcNodes.map(n => n.label));
        
        // If we're still not getting the right nodes, let's manually filter them
        if (itemCostTypeNodes.length === 0 || mcNodes.length === 0) {
            console.warn("🚨 Not getting expected nodes, using manual filtering");
            
            // Manual filtering for ITEM_COST_TYPE
            const itemCostTypeNodesManual = columns.filter(col => {
                const dimName = extractDimensionName(col.hierarchyField || '');
                return dimName === 'item_cost_type' && 
                    col.label && 
                    ['AV', 'OVERHEAD', 'MATERIAL', 'VARIABLE'].includes(col.label.toUpperCase());
            });
            
            // Manual filtering for MC
            const mcNodesManual = columns.filter(col => {
                const dimName = extractDimensionName(col.hierarchyField || '');
                return dimName === 'mc' && 
                    col.label && 
                    ['SANOFI', 'BIOPHARMA', 'CHC INTEGRATED'].some(expected => 
                        col.label.toUpperCase().includes(expected)
                    );
            });
            
            console.log(`📊 Manual ITEM_COST_TYPE:`, itemCostTypeNodesManual.map(n => n.label));
            console.log(`📊 Manual MC:`, mcNodesManual.map(n => n.label));
            
            // Use manual results if they're better
            if (itemCostTypeNodesManual.length > itemCostTypeNodes.length) {
                itemCostTypeNodes.splice(0, itemCostTypeNodes.length, ...itemCostTypeNodesManual);
            }
            if (mcNodesManual.length > mcNodes.length) {
                mcNodes.splice(0, mcNodes.length, ...mcNodesManual);
            }
        }
        
        // Calculate total columns
        const totalCombinations = itemCostTypeNodes.length * mcNodes.length;
        const totalValueCells = totalCombinations * valueFields.length;
        
        console.log(`📊 Building header: ${itemCostTypeNodes.length} × ${mcNodes.length} = ${totalCombinations} combinations`);
        
        let headerHtml = '';
        
        // Row 1: Row Header + Measures Header
        headerHtml += '<tr>';
        headerHtml += `<th class="row-header" rowspan="4">Hierarchy</th>`;
        headerHtml += `<th class="value-header measures-header" colspan="${totalValueCells}">Measures</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Measure names (COST UNIT, etc.)
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header measure-header" colspan="${totalCombinations}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: ITEM_COST_TYPE - HORIZONTAL layout (AV, OVERHEAD, MATERIAL, VARIABLE)
        headerHtml += '<tr>';
        itemCostTypeNodes.forEach(itemCostNode => {
            const spanCount = mcNodes.length;
            const hasChildren = this.originalColumnHasChildren(itemCostNode);
            const headerClass = this.getStackedDimensionHeaderClass(itemCostNode, 0);
            
            headerHtml += `<th class="${headerClass}" colspan="${spanCount}" data-level="${itemCostNode.level || 0}" data-dimension="item_cost_type">`;
            
            // Add expand/collapse control
            if (hasChildren) {
                const expandClass = itemCostNode.expanded ? 'expanded' : 'collapsed';
                headerHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${itemCostNode._id}" 
                    data-hierarchy="item_cost_type" 
                    data-zone="column"
                    onclick="handleExpandCollapseClick(event)"
                    title="Expand/collapse ${itemCostNode.label}"></span>`;
            }
            
            headerHtml += `<span class="column-label">${itemCostNode.label || itemCostNode._id}</span>`;
            headerHtml += '</th>';
        });
        headerHtml += '</tr>';
        
        // Row 4: MC - repeated under each ITEM_COST_TYPE (SANOFI, BIOPHARMA, CHC INTEGRATED)
        headerHtml += '<tr>';
        itemCostTypeNodes.forEach(itemCostNode => {
            mcNodes.forEach(mcNode => {
                const hasChildren = this.originalColumnHasChildren(mcNode);
                const headerClass = this.getStackedDimensionHeaderClass(mcNode, 1);
                
                headerHtml += `<th class="${headerClass}" data-level="${mcNode.level || 0}" data-dimension="mc" data-item-cost="${itemCostNode._id}" data-mc="${mcNode._id}">`;
                
                // Add expand/collapse control
                if (hasChildren) {
                    const expandClass = mcNode.expanded ? 'expanded' : 'collapsed';
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${mcNode._id}" 
                        data-hierarchy="mc" 
                        data-zone="column"
                        onclick="handleExpandCollapseClick(event)"
                        title="Expand/collapse ${mcNode.label}"></span>`;
                }
                
                headerHtml += `<span class="column-label">${mcNode.label || mcNode._id}</span>`;
                headerHtml += '</th>';
            });
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        this.attachEventListeners(elements.pivotTableHeader, 'header');
        
        console.log(`✅ Generated header with ${itemCostTypeNodes.length} item cost types × ${mcNodes.length} MCs = ${totalCombinations} combinations`);
        
        // Store the structure for body rendering
        this._columnStructure = {
            itemCostTypeNodes: itemCostTypeNodes,
            mcNodes: mcNodes,
            combinations: this.generateColumnCombinationsFromNodes(itemCostTypeNodes, mcNodes)
        };
        
        // Debug the stored structure
        console.log(`📦 Stored structure:`, this._columnStructure.combinations.map(c => c.labels.join(' × ')));
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
        
        console.log(`🔗 Generated ${combinations.length} combinations:`, combinations.map(c => c.labels.join(' × ')));
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



    // Add this new helper method for event listeners
    attachEventListeners: function(element, type) {
        setTimeout(() => {
            const controls = element.querySelectorAll('.expand-collapse');
            // console.log(`🔗 Attaching ${controls.length} ${type} event listeners`);
            
            controls.forEach((control, index) => {
                const nodeId = control.getAttribute('data-node-id');
                const hierarchy = control.getAttribute('data-hierarchy');
                const zone = control.getAttribute('data-zone');
                
                // console.log(`🔗 ${type} control ${index}: ${nodeId} in ${hierarchy} (${zone})`);
                
                control.addEventListener('click', (e) => {
                    this.handleExpandCollapseClick(e);
                });
            });
        }, 100);
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
    filterRecordsByDimension: function (records, dimDef) {
        if (!dimDef) {
            return records;
        }

        // CRITICAL: Don't filter overall ROOT nodes - let them show grand totals
        if (dimDef._id === 'ROOT' || dimDef.label === 'WORLDWIDE' || 
            dimDef._id === 'ROOT_WORLDWIDE' || dimDef.label === 'All GMIDs' ||
            dimDef._id === 'All GMIDs') {
            // console.log(`🔍 FILTER: ROOT node "${dimDef.label}" - no filtering, ${records.length} records`);
            return records;
        }

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

        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };

        this.detectAndApplyStackedColumnsMode();

        const rowFields = this.state.rowFields || [];
        const columnFields = this.state.columnFields || [];
        const hasMultipleRowDimensions = rowFields.length > 1;
        const hasColumnDimensions = columnFields.length > 0;
        
        console.log(`📊 Generation: ${rowFields.length} row fields, ${columnFields.length} column fields`);

        try {
            this.processPivotData();
            
            if (hasMultipleRowDimensions && !hasColumnDimensions) {
                // Multiple rows, no columns - use multi-dimension row layout
                console.log(`🌟 Using multi-dimension ROW rendering`);
                this.initializeAllRootNodesCollapsed();
                this.renderMultiDimensionTable(elements, rowFields);
            } else if (hasMultipleRowDimensions && hasColumnDimensions) {
                // Multiple rows WITH columns - use hybrid layout
                console.log(`🌟 Using HYBRID multi-row + column rendering`);
                this.initializeAllRootNodesCollapsed();
                this.renderHybridMultiDimensionTable(elements, rowFields, columnFields);
            } else {
                // Standard rendering for single row dimension
                console.log(`📊 Using standard rendering`);
                this.renderStandardTable(elements);
            }

        } catch (error) {
            console.error("Error in pivot generation:", error);
        }
    },


    renderHybridMultiDimensionTable: function(elements, rowFields, columnFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`🌟 HYBRID: ${rowFields.length} row dimensions + ${columnFields.length} column dimensions`);
        
        // Apply CSS for multi-dimension rows
        this.addEqualWidthCSS(rowFields);
        
        // Get visible rows for the primary row dimension
        const primaryDimension = rowFields[0];
        const primaryDimName = extractDimensionName(primaryDimension);
        const primaryRows = pivotData.rows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
            return rowDimName === primaryDimName;
        });
        
        const visiblePrimaryRows = this.getVisibleRows(primaryRows);
        
        // Get visible columns
        const visibleColumns = this.getVisibleLeafColumns(pivotData.columns.filter(col => col._id !== 'ROOT'));
        
        // Render hybrid header
        this.renderHybridMultiDimensionHeader(elements, rowFields, columnFields, valueFields, visibleColumns);
        
        // Render hybrid body
        this.renderHybridMultiDimensionBody(elements, visiblePrimaryRows, rowFields, valueFields, visibleColumns, pivotData);
    },


    renderHybridMultiDimensionHeader: function(elements, rowFields, columnFields, valueFields, visibleColumns) {
        const hasRealColumns = visibleColumns.length > 0;
        
        if (!hasRealColumns) {
            // No real columns - use simple multi-dimension header
            this.renderMultiDimensionHeader(elements, rowFields, valueFields);
            return;
        }
        
        let headerHtml = '';
        
        // Row 1: Row dimension headers + Measures header
        headerHtml += '<tr>';
        rowFields.forEach(field => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="dimension-header" rowspan="2">${dimName}</th>`;
        });
        
        const totalValueCells = visibleColumns.length * valueFields.length;
        headerHtml += `<th class="value-header measures-header" colspan="${totalValueCells}">Measures</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Column headers for each measure
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header" colspan="${visibleColumns.length}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Individual column nodes
        headerHtml += '<tr>';
        rowFields.forEach(() => {
            headerHtml += '<th></th>'; // Empty cells for row dimension headers
        });
        
        valueFields.forEach(field => {
            visibleColumns.forEach(col => {
                const displayLabel = this.getDisplayLabel(col);
                headerHtml += `<th class="column-header">${displayLabel}</th>`;
            });
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
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


    calculateHybridCrossDimensionalValue: function(rowDimensionCells, columnNode, valueField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData)];
        
        // Apply filters from all row dimensions
        rowDimensionCells.forEach(cell => {
            if (cell && cell._id !== 'ROOT' && !cell._id.includes('ROOT')) {
                filteredData = this.filterRecordsByDimension(filteredData, cell);
            }
        });
        
        // Apply filter from column dimension
        if (columnNode && columnNode._id !== 'ROOT' && !columnNode._id.includes('ROOT')) {
            filteredData = this.filterRecordsByDimension(filteredData, columnNode);
        }
        
        // Calculate the measure
        return this.calculateDirectMeasure(filteredData, valueField);
    },


    renderMultiDimensionTable: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`🌟 MULTI-DIM: Rendering ${rowFields.length} dimensions`);
        
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
        console.log(`🔍 HEADER: ${rowFields.length} dimension columns + ${valueFields.length} value columns`);
        
        let headerHtml = '<tr>';
        
        // Dimension headers
        rowFields.forEach(field => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="dimension-header">${dimName}</th>`;
            console.log(`📊 Dimension column: ${dimName}`);
        });
        
        // Value headers  
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
            console.log(`💰 Value column: ${fieldLabel}`);
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
        
        console.log(`✅ Total columns: ${rowFields.length + valueFields.length}`);
    },


    renderMultiDimensionBody: function(elements, visiblePrimaryRows, rowFields, valueFields, pivotData) {
        let bodyHtml = '';
        
        // Check if we should show only root row (all collapsed)
        const showOnlyRoot = this.areAllDimensionsCollapsed(rowFields);
        
        if (showOnlyRoot) {
            // Show only root row with grand totals
            bodyHtml += this.createRootRow(rowFields, valueFields);
        } else {
            // Generate proper matrix of visible rows for all dimensions
            const dimensionMatrix = this.generateMultiDimensionMatrix(rowFields);
            const maxRows = Math.max(...Object.values(dimensionMatrix).map(rows => rows.length));
            
            console.log(`🔍 Matrix has ${maxRows} total rows`);
            
            // Render each row of the matrix
            for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
                
                const dimensionCells = [];
                
                // For each dimension, get the appropriate node for this row
                rowFields.forEach((field, dimIndex) => {
                    const dimName = extractDimensionName(field);
                    const dimensionRows = dimensionMatrix[dimName] || [];
                    const cellNode = dimensionRows[rowIndex] || this.getRootNodeForDimension(field);
                    
                    dimensionCells.push(cellNode);
                    bodyHtml += this.renderMultiDimensionCell(cellNode, field, dimIndex, cellNode.level || 0);
                });
                
                // Calculate values for this specific combination
                valueFields.forEach(field => {
                    const value = this.calculateCrossDimensionalValue(dimensionCells, field);
                    bodyHtml += this.renderValueCell(value);
                });
                
                bodyHtml += '</tr>';
            }
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    generateMultiDimensionMatrix: function(rowFields) {
        const matrix = {};
        
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            const visibleRows = this.getVisibleRowsForDimension(dimName);
            matrix[dimName] = visibleRows;
            
            console.log(`📊 Matrix ${dimName}: ${visibleRows.length} visible rows`);
            visibleRows.forEach((row, idx) => {
                console.log(`  Row ${idx}: ${row.label} (level: ${row.level})`);
            });
        });
        
        return matrix;
    },


    areAllDimensionsCollapsed: function(rowFields) {
        // For multi-dimension, check if primary dimension is collapsed
        const primaryField = rowFields[0];
        const primaryDimName = extractDimensionName(primaryField);
        const rootExpanded = this.state.expandedNodes?.[primaryDimName]?.row?.['ROOT'];
        
        console.log(`🔍 Primary dimension ${primaryDimName} ROOT expanded: ${rootExpanded}`);
        return !rootExpanded;
    },


    createRootRow: function(rowFields, valueFields) {
        let rowHtml = `<tr class="root-row">`;
        
        // Collect root nodes and render ALL dimension columns first
        const rootCells = [];
        rowFields.forEach((field, dimIndex) => {
            const rootNode = this.getRootNodeForDimension(field);
            rootCells.push(rootNode);
            rowHtml += this.renderMultiDimensionCell(rootNode, field, dimIndex, 0);
        });
        
        // THEN render ALL value columns
        valueFields.forEach(field => {
            const value = this.calculateCrossDimensionalValue(rootCells, field);
            rowHtml += this.renderValueCell(value);
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


    renderMultiDimensionCell: function(node, field, dimIndex, level) {
        // Use the node's actual level for proper indentation
        const actualLevel = node.level || 0;
        const indentation = actualLevel * 15;
        const dimName = extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse control if has children
        if (node && node.hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="handleExpandCollapseClick(event)"
                title="Expand/collapse ${node.label}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${node.label || node._id}</span>`;
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
 * Render multiple row dimensions as separate columns
 */
    renderMultiRowColumns: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // Step 2: Create header with as many columns as there are dimensions
        this.renderMultiRowHeader(elements, rowFields, valueFields);
        
        // Step 3: Render content in respective columns
        this.renderMultiRowBody(elements, pivotData, rowFields, valueFields);
    },


    /**
     * Render header with separate column for each dimension
     */
    renderMultiRowHeader: function(elements, rowFields, valueFields) {
        let headerHtml = '<tr>';
        
        // One column header for each row dimension
        rowFields.forEach(field => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="row-header">${dimName}</th>`;
        });
        
        // Value columns
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    /**
     * Get display name for dimension
     */
    getDimensionDisplayName: function(field) {
        const dimName = extractDimensionName(field);
        
        // Map dimension names to display names
        const displayNames = {
            'legal_entity': 'Legal Entity',
            'le': 'Legal Entity',
            'cost_element': 'Cost Element',
            'material_type': 'Material Type',
            'item_cost_type': 'Item Cost Type',
            'gmid_display': 'GMID',
            'smartcode': 'Smart Code',
            'mc': 'Management Centre',
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
            
            console.log(`📊 Dimension ${dimName}: ${rowsByDimension[field].length} visible rows`);
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
        
        console.log("✅ All hierarchy nodes initialized to collapsed state");
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

    
    /**
     * Apply equal width classes based on number of dimensions
     */
    applyEqualWidthStyling: function(elements, rowFields) {
        const container = elements.pivotTableHeader.closest('.pivot-table-container');
        const table = container.querySelector('table');
        
        if (!container || !table) return;
        
        // Remove existing equal width classes
        container.classList.remove('equal-width-dimensions', 'dimensions-2', 'dimensions-3', 'dimensions-4');
        
        // Add base equal width class
        container.classList.add('equal-width-dimensions');
        
        // Add specific dimension count class
        const dimensionCount = rowFields.length;
        if (dimensionCount >= 2 && dimensionCount <= 4) {
            container.classList.add(`dimensions-${dimensionCount}`);
        }
        
        console.log(`📐 Applied equal width styling for ${dimensionCount} dimensions`);
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


    // Alternative: Programmatic equal width calculation
    calculateAndApplyEqualWidths: function(elements, rowFields) {
        const container = elements.pivotTableHeader.closest('.pivot-table-container');
        const table = container.querySelector('table');
        
        if (!table) return;
        
        const dimensionCount = rowFields.length;
        if (dimensionCount < 2) return;
        
        // Calculate equal width percentage
        const equalWidth = 100 / dimensionCount;
        
        // Apply to dimension headers
        const headers = table.querySelectorAll('thead th[class*="dimension-header-"]');
        headers.forEach(header => {
            header.style.width = `${equalWidth}%`;
            header.style.minWidth = `${equalWidth}%`;
            header.style.maxWidth = `${equalWidth}%`;
        });
        
        // Apply to dimension cells
        const cells = table.querySelectorAll('tbody td.dimension-cell');
        cells.forEach(cell => {
            cell.style.width = `${equalWidth}%`;
            cell.style.minWidth = `${equalWidth}%`;
            cell.style.maxWidth = `${equalWidth}%`;
        });
        
        console.log(`📐 Applied ${equalWidth}% width to ${dimensionCount} dimensions`);
    },


    // Option 1: CSS Classes (recommended)
    renderMultiRowColumns: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`🔧 PROPER MULTI-ROW: Rendering ${rowFields.length} dimensions`);
        
        // Get the primary dimension data (usually the first dimension)
        const primaryDimension = rowFields[0];
        const primaryDimName = extractDimensionName(primaryDimension);
        const primaryRows = pivotData.rows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
            return rowDimName === primaryDimName;
        });
        
        const visiblePrimaryRows = this.getVisibleRows(primaryRows);
        console.log(`🔧 PROPER: Found ${visiblePrimaryRows.length} visible primary rows`);
        
        // Render header
        this.renderProperMultiRowHeader(elements, rowFields, valueFields);
        
        // Render body with proper cross-tabulation
        this.renderProperMultiRowBody(elements, visiblePrimaryRows, rowFields, valueFields, pivotData);
    },


    /**
     * Render body with proper cross-tabulation
     */
    renderProperMultiRowBody: function(elements, primaryRows, rowFields, valueFields, pivotData) {
        let bodyHtml = '';
        
        primaryRows.forEach((primaryRow, index) => {
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Render each dimension column
            rowFields.forEach((field, dimIndex) => {
                if (dimIndex === 0) {
                    // First dimension - use the primary row
                    bodyHtml += this.renderDimensionColumnCell(primaryRow, field, dimIndex);
                } else {
                    // Other dimensions - find corresponding row from this dimension
                    const correspondingRow = this.findCorrespondingRow(primaryRow, field, pivotData.rows);
                    bodyHtml += this.renderDimensionColumnCell(correspondingRow, field, dimIndex);
                }
            });
            
            // Render value cells using the primary row's data
            const rowData = pivotData.data.find(d => d._id === primaryRow._id) || {};
            valueFields.forEach(field => {
                const value = rowData[field] || 0;
                bodyHtml += this.renderValueCell(value);
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    /**
     * Enhanced multi-dimension rendering with full hierarchy support
     */
    renderEnhancedMultiDimensions: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`🌟 ENHANCED: Rendering ${rowFields.length} dimensions with hierarchy`);
        
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
        
        console.log(`🔒 Initialized collapsed state for ${rowFields.length} dimensions`);
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
     * Enhanced expand/collapse handler that regenerates only the affected table
     */
    handleMultiDimensionExpandCollapse: function(e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';

        console.log(`🎯 Multi-dimension expand/collapse: ${nodeId} in ${hierarchyName} (${zone})`);

        const node = this.state.hierarchies[hierarchyName]?.nodesMap[nodeId];
        if (!node) {
            console.error(`Node ${nodeId} not found in ${hierarchyName}`);
            return;
        }

        // Initialize expansion tracking if needed
        if (!this.state.expandedNodes) {
            this.state.expandedNodes = {};
        }
        if (!this.state.expandedNodes[hierarchyName]) {
            this.state.expandedNodes[hierarchyName] = {};
        }
        if (!this.state.expandedNodes[hierarchyName][zone]) {
            this.state.expandedNodes[hierarchyName][zone] = {};
        }

        // Toggle expansion state
        const wasExpanded = this.state.expandedNodes[hierarchyName][zone][nodeId];
        this.state.expandedNodes[hierarchyName][zone][nodeId] = !wasExpanded;
        node.expanded = !wasExpanded;

        console.log(`🎯 Node ${nodeId} expanded: ${node.expanded}`);

        // Regenerate only if this is a row dimension in multi-dimension mode
        const rowFields = this.state.rowFields || [];
        if (rowFields.length > 1 && zone === 'row') {
            this.regenerateMultiDimensionTable();
        } else {
            // Use standard regeneration for column dimensions
            window.refreshPivotTable();
        }
        
        e.stopPropagation();
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


    renderMultiDimensionBodyFromMatrix: function(elements, visibleRowMatrix, rowFields, valueFields) {
        let bodyHtml = '';
        
        visibleRowMatrix.forEach((matrixRow, rowIndex) => {
            bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Render dimension cells
            matrixRow.dimensionCells.forEach((cell, dimIndex) => {
                bodyHtml += this.renderMultiDimensionCell(cell, rowFields[dimIndex], dimIndex, cell.level || 0);
            });
            
            // Calculate values using cross-dimensional filtering
            valueFields.forEach(field => {
                const value = this.calculateCrossDimensionalValue(matrixRow.dimensionCells, field);
                bodyHtml += this.renderValueCell(value);
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    renderMultiDimensionBody: function(elements, visiblePrimaryRows, rowFields, valueFields, pivotData) {
        let bodyHtml = '';
        
        // Check if we should show only root row (all collapsed)
        const showOnlyRoot = this.areAllDimensionsCollapsed(rowFields);
        
        console.log(`🔍 Show only root: ${showOnlyRoot}, visible rows: ${visiblePrimaryRows.length}`);
        
        if (showOnlyRoot) {
            // Show only root row with grand totals
            bodyHtml += this.createRootRow(rowFields, valueFields);
        } else {
            // Show expanded rows
            visiblePrimaryRows.forEach((primaryRow, rowIndex) => {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Collect dimension cells for this row
                const dimensionCells = [];
                
                // CRITICAL: Render ALL dimension columns first
                rowFields.forEach((field, dimIndex) => {
                    let cellNode;
                    if (dimIndex === 0) {
                        // Primary dimension - use the actual expanded row
                        cellNode = primaryRow;
                    } else {
                        // Secondary dimensions - ALWAYS show root node
                        cellNode = this.findCorrespondingNode(primaryRow, field);
                    }
                    
                    dimensionCells.push(cellNode);
                    bodyHtml += this.renderMultiDimensionCell(cellNode, field, dimIndex, cellNode.level || 0);
                });
                
                // THEN render all value columns
                valueFields.forEach(field => {
                    const value = this.calculateCrossDimensionalValue(dimensionCells, field);
                    bodyHtml += this.renderValueCell(value);
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    getVisibleRowsForDimension: function(dimName) {
        const allRows = this.state.pivotData.rows.filter(row => {
            const rowDimName = extractDimensionName(row.hierarchyField || '');
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
        const targetDimName = extractDimensionName(targetField);
        
        // Check if this secondary dimension has been expanded
        const isRootExpanded = this.state.expandedNodes?.[targetDimName]?.row?.['ROOT'];
        
        if (!isRootExpanded) {
            // Return root node for collapsed secondary dimensions
            return this.getRootNodeForDimension(targetField);
        } else {
            // If expanded, we need to get the visible rows for this dimension
            const targetRows = this.getVisibleRowsForDimension(targetDimName);
            
            // For now, cycle through available rows or return root if no specific match
            if (targetRows.length > rowIndex) {
                return targetRows[rowIndex];
            } else {
                // If we don't have enough rows, return the last available or root
                return targetRows[targetRows.length - 1] || this.getRootNodeForDimension(targetField);
            }
        }
    },


    getDimensionRootLabel: function(dimName) {
        const labels = {
            'le': 'WORLDWIDE',
            'legal_entity': 'WORLDWIDE', 
            'mc': 'Sanofi',
            'management_centre': 'Sanofi',
            'cost_element': 'All',
            'gmid_display': 'All GMIDs',
            'material_type': 'All Materials',
            'item_cost_type': 'All Cost Types'
        };
        
        return labels[dimName.toLowerCase()] || `All ${dimName.replace(/_/g, ' ')}`;
    },


    getRootNodeForDimension: function(field) {
        const dimName = extractDimensionName(field);
        const hierarchy = this.state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap['ROOT']) {
            const rootNode = hierarchy.nodesMap['ROOT'];
            // Ensure it has proper display properties
            return {
                ...rootNode,
                hasChildren: true,
                expanded: false,
                label: rootNode.label || this.getDimensionRootLabel(dimName)
            };
        } else {
            // Create a default root node with proper label
            return {
                _id: `${dimName.toUpperCase()}_ROOT`,
                label: this.getDimensionRootLabel(dimName),
                level: 0,
                hasChildren: true,
                expanded: false,
                hierarchyField: field
            };
        }
    },


    calculateCrossDimensionalValue: function(dimensionCells, valueField) {
        // Start with all fact data
        let filteredData = [...(this.state.filteredData || this.state.factData)];
        
        // Apply filter from each dimension cell that's not a root
        dimensionCells.forEach(cell => {
            if (cell && cell._id !== 'ROOT' && !cell._id.includes('ROOT')) {
                filteredData = this.filterRecordsByDimension(filteredData, cell);
            }
        });
        
        // Calculate the measure
        return this.calculateDirectMeasure(filteredData, valueField);
    },


    /**
     * Enhanced body rendering with proper cross-dimensional value calculation
     */
    renderEnhancedMultiBodyWithProperValues: function(elements, dimensionMatrix, rowFields, valueFields, pivotData) {
        let bodyHtml = '';
        const maxRows = dimensionMatrix.maxRows;
        
        for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
            bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Collect current row nodes from each dimension
            const currentRowNodes = [];
            
            // Render each dimension column and collect nodes
            rowFields.forEach((field, dimIndex) => {
                const dimensionRows = dimensionMatrix[field];
                const row = dimensionRows[rowIndex];
                
                if (row) {
                    currentRowNodes.push(row);
                    bodyHtml += this.renderHierarchicalDimensionCell(row, field, dimIndex);
                } else {
                    currentRowNodes.push(null);
                    bodyHtml += `<td class="dimension-cell dimension-${dimIndex} empty"></td>`;
                }
            });
            
            // Calculate values based on cross-dimensional filtering
            bodyHtml += this.renderCrossDimensionalValues(currentRowNodes, valueFields, pivotData);
            
            bodyHtml += '</tr>';
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
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
            if (value > 0) {
                const nodeLabels = rowNodes.map(n => n ? n.label : 'empty').join(' × ');
                console.log(`💰 Value calculation: ${nodeLabels} × ${fieldId} = ${value} (from ${filteredData.length} records)`);
            }
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
            
            console.log(`📊 Processing field ${fieldIndex}: ${field} (${dimName})`);
            
            // Get all rows for this dimension
            const dimensionRows = allRows.filter(row => {
                const rowDimName = extractDimensionName(row.hierarchyField || '');
                const matches = rowDimName === dimName;
                if (matches) {
                    console.log(`  Found row: ${row.label} (level: ${row.level})`);
                }
                return matches;
            });
            
            console.log(`📊 Dimension ${dimName}: found ${dimensionRows.length} total rows`);
            
            // Get only visible rows (respecting expand/collapse state)
            const visibleRows = this.getVisibleRowsForSpecificDimension(dimensionRows, dimName);
            
            matrix[field] = visibleRows;
            maxRows = Math.max(maxRows, visibleRows.length);
            
            console.log(`📊 Dimension ${dimName}: ${visibleRows.length} visible rows after filtering`);
            visibleRows.forEach((row, idx) => {
                console.log(`  Visible row ${idx}: ${row.label} (${row._id})`);
            });
        });
        
        matrix.maxRows = maxRows;
        console.log(`📊 Matrix complete: max rows = ${maxRows}`);
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
        console.log(`🔍 Filtering visible rows for ${dimName}`);
        
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
        
        console.log(`🔍 ${dimName}: ${visibleRows.length} of ${dimensionRows.length} rows are visible`);
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
        console.log(`📐 Applied ${equalWidth}% equal width for ${dimensionCount} dimensions`);
    },


    /**
     * Render a single dimension column cell
     */
    renderDimensionColumnCell: function(row, field, dimIndex) {
        if (!row) {
            return `<td class="dimension-cell dimension-${dimIndex} empty">-</td>`;
        }
        
        const indentation = (row.level || 0) * 10; // Reduced indentation for multi-column
        const dimName = extractDimensionName(field);
        
        let cellHtml = `<td class="dimension-cell dimension-${dimIndex}" style="padding-left: ${indentation}px;">`;
        
        // Add expand/collapse control if needed (only for primary dimension)
        if (dimIndex === 0 && row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="handleExpandCollapseClick(event)"></span>`;
        } else if (dimIndex === 0) {
            cellHtml += '<span class="leaf-node"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
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


    /**
     * Render header for proper multi-dimension layout
     */
    renderProperMultiRowHeader: function(elements, rowFields, valueFields) {
        // Apply equal width CSS
        this.addEqualWidthCSS(rowFields);
        
        let headerHtml = '<tr>';
        
        // One column header for each row dimension
        rowFields.forEach(field => {
            const dimName = this.getDimensionDisplayName(field);
            headerHtml += `<th class="row-header dimension-column">${dimName}</th>`;
        });
        
        // Value columns
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
    },


    // Option 2: Direct CSS injection (most reliable)
    renderMultiRowColumnsWithEqualWidth: function(elements, rowFields) {
        const pivotData = this.state.pivotData;
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // Apply equal width CSS
        // this.addEqualWidthCSS(rowFields);
        
        // Render content
        this.renderMultiRowHeader(elements, rowFields, valueFields);
        this.renderMultiRowBody(elements, pivotData, rowFields, valueFields);
    },


    /**
     * Initialize collapsed state that works with your state.js structure
     */
    initializeAllRootNodesCollapsed: function() {
        const rowFields = this.state.rowFields || [];
        
        console.log(`🔒 Initializing collapsed state for ${rowFields.length} row fields`);
        
        // Ensure expandedNodes exists
        if (!this.state.expandedNodes) {
            this.state.expandedNodes = {};
        }
        
        // For each row field, ensure it has collapsed root nodes
        rowFields.forEach(field => {
            const dimName = extractDimensionName(field);
            
            // Initialize structure if it doesn't exist
            if (!this.state.expandedNodes[dimName]) {
                this.state.expandedNodes[dimName] = {
                    row: {},
                    column: {}
                };
            }
            
            // Ensure row zone exists
            if (!this.state.expandedNodes[dimName].row) {
                this.state.expandedNodes[dimName].row = {};
            }
            
            // Set ROOT to collapsed in row zone (don't touch column zone)
            this.state.expandedNodes[dimName].row['ROOT'] = false;
            
            // Also update hierarchy nodes if they exist
            const hierarchy = this.state.hierarchies[dimName];
            if (hierarchy && hierarchy.nodesMap) {
                Object.keys(hierarchy.nodesMap).forEach(nodeId => {
                    const node = hierarchy.nodesMap[nodeId];
                    if (nodeId === 'ROOT' || node.level === 0) {
                        // Set root nodes to collapsed
                        node.expanded = false;
                        this.state.expandedNodes[dimName].row[nodeId] = false;
                    } else {
                        // Set all other nodes to collapsed initially
                        if (this.state.expandedNodes[dimName].row[nodeId] === undefined) {
                            this.state.expandedNodes[dimName].row[nodeId] = false;
                            node.expanded = false;
                        }
                    }
                });
            }
            
            console.log(`🔒 Initialized ${dimName} with collapsed root nodes`);
        });
        
        console.log(`✅ All ${rowFields.length} row dimensions initialized as collapsed`);
    },

    // x
};


// Event listener for the toggle button
document.getElementById('toggleViewBtn')?.addEventListener('click', () => {
    pivotTable.toggleView();
});


// Export the pivotTable object
export default pivotTable;