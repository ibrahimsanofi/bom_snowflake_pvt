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
        // Make handleExpandCollapseClick globally available
        window.handleExpandCollapseClick = this.handleExpandCollapseClick.bind(this);

        // Make generatePivotTable globally available
        window.generatePivotTable = this.generatePivotTable.bind(this);
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
        const decimals = this.state?.decimalPlaces;
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        if (numericValue === 0) return (0).toFixed(decimals);
        if (Math.abs(numericValue) >= 1000000000) return (numericValue / 1000000000).toFixed(decimals) + 'b';
        if (Math.abs(numericValue) >= 1000000) return (numericValue / 1000000).toFixed(decimals) + 'm';
        if (Math.abs(numericValue) >= 1000) return (numericValue / 1000).toFixed(decimals) + 'k';
        return numericValue.toFixed(decimals);
    },

    
    /**
     * Handle expand/collapse clicks
     */
    handleExpandCollapseClick: function (e) {
        const nodeId = e.target.getAttribute('data-node-id');
        const hierarchyName = e.target.getAttribute('data-hierarchy');
        const zone = e.target.getAttribute('data-zone') || 'row';

        const node = this.state.hierarchies[hierarchyName]?.nodesMap[nodeId];
        if (!node) {
            console.error(`Node ${nodeId} not found in ${hierarchyName}`);
            return;
        }

        this.state.expandedNodes = this.state.expandedNodes || {};
        this.state.expandedNodes[hierarchyName] = this.state.expandedNodes[hierarchyName] || {};
        this.state.expandedNodes[hierarchyName][zone] = this.state.expandedNodes[hierarchyName][zone] || {};
        this.state.expandedNodes[hierarchyName][zone][nodeId] = !this.state.expandedNodes[hierarchyName][zone][nodeId];
        node.expanded = this.state.expandedNodes[hierarchyName][zone][nodeId];

        window.refreshPivotTable();
        e.stopPropagation();
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
            
            console.log(`🔍 ROOT CALCULATION: Processing ${records.length} total records`);
            return this.calculateDirectMeasure(records, measureField);
        }

        // For leaf nodes, filter and calculate directly
        if (rowDef.isLeaf) {
            const filteredRecords = this.filterRecordsByDimension(records, rowDef);
            console.log(`🔍 LEAF CALCULATION: ${rowDef.label} - ${filteredRecords.length} filtered records`);
            return this.calculateDirectMeasure(filteredRecords, measureField);
        }

        // For parent nodes, aggregate from ALL descendants (not just visible)
        return this.calculateParentMeasure(records, rowDef, colDef, measureField);
    },


    /**
     * NEW: Calculate measure for parent nodes by aggregating descendant values
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

        console.log(`🔍 Parent ${rowDef.label}: Aggregating ${allLeafDescendants.length} total leaf descendants`);

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
     * NEW: Get visible leaf descendants based on expansion state
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
     * NEW: Get all leaf descendants of a node efficiently
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
     * NEW: Direct calculation helper for leaf nodes and root
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
        console.log(`🔍 LE Filter: Processing node ${node.label} (${node._id})`);
        
        // Don't filter ROOT nodes
        if (node._id === 'ROOT' || node.label === 'WORLDWIDE') {
            console.log(`🔍 LE Filter: ROOT node - returning all ${records.length} records`);
            return records;
        }
        
        // For leaf nodes with factId, filter directly
        if (node.isLeaf && node.factId) {
            const filtered = records.filter(r => r.LE === node.factId);
            console.log(`🔍 LE Filter: Leaf node filtering ${records.length} → ${filtered.length} records by LE=${node.factId}`);
            return filtered;
        }
        
        // For hierarchy nodes, use mapping
        const mapping = this.state.mappings?.legalEntity;
        if (!mapping) {
            console.log("🔍 LE Filter: No LE mapping available - returning all records");
            return records;
        }
        
        // Try to get LE codes for this node
        const leCodes = new Set();
        
        // Method 1: Direct path mapping
        if (mapping.pathToLeCodes && mapping.pathToLeCodes[node.label]) {
            mapping.pathToLeCodes[node.label].forEach(le => leCodes.add(le));
            console.log(`🔍 LE Filter: Found ${leCodes.size} LEs via pathToLeCodes for "${node.label}"`);
        }
        
        // Method 2: Reverse path lookup
        if (leCodes.size === 0 && mapping.leToPaths) {
            Object.entries(mapping.leToPaths).forEach(([le, paths]) => {
                if (paths.includes(node.label)) {
                    leCodes.add(le);
                }
            });
            console.log(`🔍 LE Filter: Found ${leCodes.size} LEs via leToPaths for "${node.label}"`);
        }
        
        if (leCodes.size > 0) {
            const filtered = records.filter(r => leCodes.has(r.LE));
            console.log(`🔍 LE Filter: Filtered ${records.length} → ${filtered.length} records using ${leCodes.size} LE codes`);
            return filtered;
        }
        
        console.log(`🔍 LE Filter: No matching LE codes found for "${node.label}" - returning all records`);
        return records;
    },


    // EMERGENCY: Simple calculation method that bypasses filtering for ROOT nodes
    emergencyCalculateMeasure: function(records, rowDef, colDef, measureField) {
        console.log(`🚨 EMERGENCY CALC: ${rowDef?.label} - ${measureField}`);
        
        if (!records || records.length === 0) return 0;
        
        // For ROOT/WORLDWIDE nodes, sum everything without filtering
        if (!rowDef || rowDef._id === 'ROOT' || rowDef.label === 'WORLDWIDE' || rowDef._id === 'ROOT_WORLDWIDE') {
            console.log("🚨 ROOT NODE: Summing all records without filtering");
            let total = 0;
            let count = 0;
            
            records.forEach(record => {
                const value = parseFloat(record[measureField] || 0);
                if (!isNaN(value)) {
                    total += value;
                    count++;
                }
            });
            
            console.log(`🚨 Emergency result: ${total} from ${count} valid records`);
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
        console.log(`🔍 GMID Filter: Processing node "${node.label}" (${node._id}) with ${records.length} records`);
        
        // CRITICAL: Don't filter ROOT nodes - include ALL records for grand totals
        if (node._id === 'ROOT' || node.label === 'All GMIDs' || 
            node._id.endsWith('_ROOT') || node.label === 'WORLDWIDE') {
            console.log(`🔍 GMID Filter: ROOT node - returning all ${records.length} records`);
            return records;
        }

        // For leaf nodes with factId, handle both COMPONENT_GMID and PATH_GMID matching
        if (node.isLeaf && node.factId) {
            let filtered = [];
            
            console.log(`🔍 GMID Filter: Leaf node factId: "${node.factId}"`);
            
            if (Array.isArray(node.factId)) {
                // Handle multiple factIds (when multiple records map to same node)
                node.factId.forEach(factId => {
                    const singleFiltered = this.filterByFactId(records, factId);
                    filtered = filtered.concat(singleFiltered);
                    console.log(`🔍 GMID Filter: Array factId "${factId}" matched ${singleFiltered.length} records`);
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
                console.log(`🔍 GMID Filter: Single factId "${node.factId}" matched ${filtered.length} records`);
            }
            
            console.log(`🔍 GMID Filter: Final result for "${node.label}": ${filtered.length} records`);
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
            console.log(`🔍 GMID Filter: Prefix "${node.prefixFilter}" matched ${filtered.length} records`);
            return filtered;
        }
        
        // Fallback: no specific filter criteria
        console.log(`🔍 GMID Filter: No specific filter for "${node.label}" - returning all ${records.length} records`);
        return records;
    },

    // Specific factId filtering logic
    filterByFactId: function(records, factId) {
        if (!factId) {
            console.log(`🔍 FACT_ID Filter: Empty factId - returning no records`);
            return [];
        }
        
        console.log(`🔍 FACT_ID Filter: Processing factId "${factId}"`);
        
        // Strategy 1: If factId ends with '#', it's a PATH_GMID (for NULL COMPONENT_GMID records)
        if (factId.endsWith('#')) {
            const pathMatches = records.filter(r => r.PATH_GMID === factId);
            console.log(`🔍 FACT_ID Filter: PATH_GMID exact match for "${factId}": ${pathMatches.length} records`);
            
            // Also check for records where COMPONENT_GMID matches but is derived from this PATH
            const componentMatches = records.filter(r => 
                r.COMPONENT_GMID && r.PATH_GMID === factId
            );
            console.log(`🔍 FACT_ID Filter: Additional COMPONENT_GMID matches: ${componentMatches.length} records`);
            
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
        console.log(`🔍 FACT_ID Filter: COMPONENT_GMID exact match for "${factId}": ${componentMatches.length} records`);
        
        // Strategy 3: If no COMPONENT_GMID matches, try PATH_GMID contains
        if (componentMatches.length === 0) {
            const pathContains = records.filter(r => 
                r.PATH_GMID && r.PATH_GMID.includes(factId)
            );
            console.log(`🔍 FACT_ID Filter: PATH_GMID contains "${factId}": ${pathContains.length} records`);
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
     * Get visible leaf columns
     */
    getVisibleLeafColumns: function (columns) {
        const visibleLeafs = [];
        const findVisibleLeafs = (col) => {
            if (!col) return;
            if (col.isLeaf || !col.expanded) {
                visibleLeafs.push(col);
                return;
            }
            col.children?.forEach(childId => {
                const childNode = this.state.hierarchies[col.hierarchyField.replace('DIM_', '').toLowerCase()]?.nodesMap[childId];
                if (childNode) findVisibleLeafs(childNode);
            });
        };
        columns.forEach(findVisibleLeafs);
        return visibleLeafs;
    },


    /**
     * Render table body
     */
    renderTableBody: function (elements, pivotData) {
    if (!elements || !elements.pivotTableBody || !pivotData) return;

    const valueFields = this.state.valueFields || ['COST_UNIT'];
    const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
    let bodyHtml = '';

    const visibleRows = this.getVisibleRows(pivotData.rows);
    visibleRows.forEach((row, index) => {
        const rowData = pivotData.data.find(d => d._id === row._id) || {};
        bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
        const indentation = row.level * 20;
        const dimName = row.hierarchyField.replace('DIM_', '').toLowerCase();
        bodyHtml += `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            bodyHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="handleExpandCollapseClick(event)"></span>`;
        } else {
            bodyHtml += '<span class="leaf-node"></span>';
        }
        bodyHtml += `<span class="dimension-label">${row.label || row._id}</span>`;
        bodyHtml += '</td>';

        if (columns.length > 0) {
            const leafColumns = this.getVisibleLeafColumns(columns);
            leafColumns.forEach(col => {
                valueFields.forEach(field => {
                    const key = `${col._id}|${field}`;
                    bodyHtml += this.renderValueCell(rowData[key] || 0);
                });
            });
        } else {
            valueFields.forEach(field => {
                bodyHtml += this.renderValueCell(rowData[field] || 0);
            });
        }
        bodyHtml += '</tr>';
    });

    elements.pivotTableBody.innerHTML = bodyHtml;

    // Add event listeners for expand/collapse
    setTimeout(() => {
        elements.pivotTableBody.querySelectorAll('.expand-collapse').forEach(control => {
            control.addEventListener('click', window.handleExpandCollapseClick);
        });
    }, 100);
    },


    /**
     * Render value cell
     */
    renderValueCell: function (value) {
        const numericValue = parseFloat(value) || 0;
        const cellClass = numericValue !== 0 ? 'value-cell non-zero-value' : 'value-cell';
        return `<td class="${cellClass}" data-raw-value="${numericValue}">${this.formatValue(numericValue)}</td>`;
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
        
        console.log(`🔍 CALC: Using ${this.state.filteredData ? 'FILTERED' : 'ORIGINAL'} data with ${factData.length} records`);
        
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
        console.log(`🔍 CALC: Has real column dimensions: ${hasRealColumnDimensions}, ${realColumns.length} columns`);

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
                        
                        console.log(`🔍 CROSS-CALC: Row ${rowDef.label} × Col ${colDef.label} × ${fieldId} = ${value} (from ${crossFilteredData.length} records)`);
                    });
                });
            } else {
                // NO COLUMN DIMENSIONS: Calculate measures directly
                valueFields.forEach((fieldId) => {
                    const value = this.calculateMeasure(factData, rowDef, null, fieldId);
                    rowData[fieldId] = typeof value === 'number' ? value : (parseFloat(value) || 0);
                    console.log(`🔍 DIRECT-CALC: Row ${rowDef.label} × ${fieldId} = ${value}`);
                });
            }

            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            // Only log slow calculations
            if (processingTime > 10) {
                console.log(`⏱️ Row ${rowIndex} (${rowDef.label}): ${processingTime.toFixed(2)}ms`);
            }

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
        console.warn(`⚠️ Filtering parent node ${node._id} - this should use descendant aggregation instead`);
        
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

        console.log("Rendering row cell:", {
            id: rowDef._id,
            label: rowDef.label,
            hasChildren: rowDef.hasChildren,
            isLeaf: rowDef.isLeaf,
            expanded: rowDef.expanded
        });

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
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');

        // CRITICAL FIX: When no column dimensions, use simple header
        if (columns.length === 0) {
            this.renderSimpleHeader(elements, valueFields);
            return;
        }

        // Continue with normal column hierarchy rendering...
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


    /**
     * Updated renderTableBody to handle column hierarchies with multiple measures
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
        
        console.log(`🔍 RENDER: ${valueFields.length} value fields, ${realColumns.length} real columns`);
        console.log(`🔍 RENDER: Has real column dimensions: ${hasRealColumnDimensions}`);

        let bodyHtml = '';
        const visibleRows = this.getVisibleRows(pivotData.rows);
        
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};
            console.log(`🔍 RENDER: Row ${index} (${row.label}) data keys:`, Object.keys(rowData));

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
                        console.log(`🔍 RENDER: [WITH COLUMNS] Looking for key "${key}", found: ${value}`);
                        bodyHtml += this.renderValueCell(value);
                    });
                });
            } else {
                // NO column hierarchies - use direct field names
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    console.log(`🔍 RENDER: [NO COLUMNS] Looking for field "${field}", found: ${value}`);
                    bodyHtml += this.renderValueCell(value);
                });
            }
            
            bodyHtml += '</tr>';
        });

        elements.pivotTableBody.innerHTML = bodyHtml;
        this.attachEventListeners(elements.pivotTableBody, 'body');
    },


    /**
     * Gets visible rows based on expansion state
     */
    getVisibleRows: function (rows) {
        const visibleRows = [];

        rows.forEach(row => {
            if (row._id === 'ROOT' || !row.path || row.path.length <= 1) {
                visibleRows.push(row);
                return;
            }

            let visible = true;
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';

            for (let i = 1; i < row.path.length - 1; i++) {
                const ancestorId = row.path[i];
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

        return `<td class="${cellClass}" data-raw-value="${numericValue}">${formattedValue}</td>`;
    },


    /**
     * Render a single table row
     */
    renderTableRow: function (rowDef, dataRow, rowIndex, bodyHtml, useMultiDimension, validColumns) {
        console.log(`Row data for ${rowDef.label}:`, dataRow);

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
     * Handle expand/collapse clicks in the pivot table
     */
    handleExpandCollapseClick: function (e) {
        const target = e.target;
        const nodeId = target.getAttribute('data-node-id');
        const hierarchyName = target.getAttribute('data-hierarchy');
        const zone = target.getAttribute('data-zone') || 'row';
        
        console.log(`🔄 Universal expand/collapse:`, { nodeId, hierarchyName, zone });
        
        // Prevent event propagation
        e.preventDefault();
        e.stopPropagation();
        
        const state = this.state;
        if (!state) {
            console.error("No state available");
            return false;
        }
        
        // Validate hierarchy exists
        if (!state.hierarchies[hierarchyName]) {
            console.error(`Hierarchy '${hierarchyName}' not found`);
            console.log("Available hierarchies:", Object.keys(state.hierarchies));
            return false;
        }
        
        // Validate node exists
        const node = state.hierarchies[hierarchyName].nodesMap[nodeId];
        if (!node) {
            console.error(`Node '${nodeId}' not found in hierarchy '${hierarchyName}'`);
            return false;
        }
        
        // Initialize expansion tracking
        initializeExpansionTracking(state, hierarchyName, zone);
        
        // Toggle expansion state
        const currentState = state.expandedNodes[hierarchyName][zone][nodeId] || false;
        const newState = !currentState;
        
        state.expandedNodes[hierarchyName][zone][nodeId] = newState;
        node.expanded = newState;
        
        console.log(`✅ Node '${nodeId}' in '${hierarchyName}' ${zone} expanded: ${newState}`);
        
        // Trigger refresh
        if (typeof window.refreshPivotTable === 'function') {
            window.refreshPivotTable();
        } else if (typeof this.generatePivotTable === 'function') {
            this.generatePivotTable();
        } else {
            console.error("No refresh function available");
        }
        
        return true;
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
            console.log(`🔍 FILTER: ROOT node "${dimDef.label}" - no filtering, ${records.length} records`);
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
     * Enhanced getVisibleLeafColumns to properly handle expanded/collapsed state
     */
    getVisibleLeafColumns: function (columns) {
        const visibleLeafs = [];

        const processColumn = (column) => {
            if (!column) return;

            // If it's a leaf node or not expanded, include it
            if (column.isLeaf || !column.expanded || !this.originalColumnHasChildren(column)) {
                visibleLeafs.push(column);
                return;
            }

            // If it's expanded and has children, process children
            if (column.children && column.children.length > 0) {
                column.children.forEach(childId => {
                    const dimName = extractDimensionName(column.hierarchyField);
                    const hierarchy = this.state.hierarchies[dimName];
                    const childNode = hierarchy?.nodesMap?.[childId];
                    
                    if (childNode) {
                        processColumn(childNode);
                    }
                });
            } else {
                // No children found, treat as leaf
                visibleLeafs.push(column);
            }
        };

        columns.forEach(column => {
            processColumn(column);
        });

        return visibleLeafs;
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
            console.error("Invalid pivot data for rendering");
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
     * Render a single table row
     */
    renderTableRow: function (rowDef, dataRow, rowIndex, bodyHtml, useMultiDimension, validColumns) {
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


    // This function is used to generate pivot table
    generatePivotTable: function () {
        // Ensure state connection
        if (!this.state) {
            console.error("Cannot generate pivot table: No state connection");
            // Attempt to reconnect
            if (window.App?.state) {
                this.state = window.App.state;
                console.log("Reconnected to state");
            } else {
                return;
            }
        }

        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };

        try {
            // Process the data for the pivot table
            this.processPivotData();
            
            // Render the table
            this.renderPivotTable(elements);

            console.log("Pivot table generation complete");

        } catch (error) {
            console.error("Error in pivot table generation:", error);
        }
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
    }

    // x
};


// Event listener for the toggle button
document.getElementById('toggleViewBtn')?.addEventListener('click', () => {
    pivotTable.toggleView();
});


// Export the pivotTable object
export default pivotTable;