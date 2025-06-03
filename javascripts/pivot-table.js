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
        // Store reference to state
        this.state = stateRef;

        // Set up global event handlers
        this.setupGlobalHandlers();
        document.getElementById('toggleViewBtn')?.addEventListener('click', () => {
            this.toggleView();
        });

        console.log("Pivot table system initialized");
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
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        if (numericValue === 0) return '0.00';
        if (Math.abs(numericValue) >= 1000000) return (numericValue / 1000000).toFixed(2) + 'm';
        if (Math.abs(numericValue) >= 1000) return (numericValue / 1000).toFixed(2) + 'k';
        return numericValue.toFixed(2);
    },


    // Update the main render function
    renderPivotTable: function (elements, useMultiDimension = false) {
        if (this.currentView === 'vertical') {
            this.renderVerticalHierarchicalColumns(elements, this.state.pivotData);
        } else {
            this.renderStandardTable(elements, useMultiDimension);
        }
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
    calculateMeasureXXX: function (records, rowDef, colDef, measureField) {
        let filteredRecords = [...records];

        if (rowDef && rowDef.dimensions) {
            rowDef.dimensions.forEach(dim => {
                filteredRecords = this.filterRecordsByDimension(filteredRecords, dim);
            });
        } else if (rowDef) {
            filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
        }

        if (colDef && colDef.dimensions) {
            colDef.dimensions.forEach(dim => {
                filteredRecords = this.filterRecordsByDimension(filteredRecords, dim);
            });
        } else if (colDef) {
            filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
        }

        let result = 0;
        if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
            filteredRecords.forEach(record => {
                const value = parseFloat(record[measureField]) || 0;
                result += value;
            });
        }

        return result;
    },

    calculateMeasure: function (records, rowDef, colDef, measureField) {
    console.log(`🔍 CALCULATING: ${rowDef?.label || 'Unknown'} - ${measureField}`);
    console.log(`🔍 Input records: ${records?.length || 0}`);
    
    if (!records || records.length === 0) {
        console.log("❌ No records to calculate");
        return 0;
    }

    let filteredRecords = [...records];
    
    // Filter by row definition if provided
    if (rowDef) {
        console.log(`🔍 Row definition:`, {
            id: rowDef._id,
            label: rowDef.label,
            hierarchyField: rowDef.hierarchyField,
            factId: rowDef.factId,
            isLeaf: rowDef.isLeaf,
            hasChildren: rowDef.hasChildren
        });
        
        const beforeCount = filteredRecords.length;
        filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
        const afterCount = filteredRecords.length;
        
        console.log(`🔍 After row filtering: ${beforeCount} → ${afterCount} records`);
        
        // Debug: Check what we're filtering by
        if (rowDef.hierarchyField === 'DIM_LE') {
            console.log(`🔍 LE Filtering details:`, {
                nodeId: rowDef._id,
                factId: rowDef.factId,
                filteringBy: 'LE field in fact data'
            });
            
            // Sample the filtered records
            if (filteredRecords.length > 0) {
                const sampleLE = filteredRecords.slice(0, 3).map(r => r.LE);
                console.log(`🔍 Sample LE values in filtered data:`, sampleLE);
                
                const sampleCosts = filteredRecords.slice(0, 3).map(r => r.COST_UNIT);
                console.log(`🔍 Sample COST_UNIT values:`, sampleCosts);
            }
        }
    }

    // Filter by column definition if provided
    if (colDef) {
        const beforeCount = filteredRecords.length;
        filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
        const afterCount = filteredRecords.length;
        console.log(`🔍 After column filtering: ${beforeCount} → ${afterCount} records`);
    }

    if (filteredRecords.length === 0) {
        console.log("❌ No records after filtering");
        return 0;
    }

    // Calculate sum
    let result = 0;
    let validCount = 0;
    let zeroCount = 0;

    if (measureField === 'COST_UNIT' || measureField === 'QTY_UNIT') {
        filteredRecords.forEach(record => {
            const value = typeof record[measureField] === 'number' ? 
                record[measureField] : parseFloat(record[measureField] || 0);
            
            if (isNaN(value)) {
                // skip
            } else if (value === 0) {
                zeroCount++;
            } else {
                validCount++;
                result += value;
            }
        });
    }

    console.log(`🔍 CALCULATION RESULT: ${result.toFixed(2)} (${validCount} valid, ${zeroCount} zeros)`);
    console.log(`🔍 Average per record: ${(result / Math.max(1, validCount)).toFixed(2)}`);
    
    return result;
},

// Add this helper to check specific LE filtering
debugLEFiltering: function(records, nodeLabel) {
    console.log(`🔍 DEBUG LE FILTERING for: ${nodeLabel}`);
    
    // Find the LE mapping
    const mapping = this.state.mappings?.legalEntity;
    if (!mapping) {
        console.log("❌ No LE mapping found");
        return records;
    }
    
    console.log("🔍 LE Mapping structure:", {
        pathToLeCodes: Object.keys(mapping.pathToLeCodes || {}),
        leToPaths: Object.keys(mapping.leToPaths || {}),
        usedLeCodes: mapping.usedLeCodes?.size || 0
    });
    
    // Check if this node label maps to LE codes
    const leCodes = mapping.pathToLeCodes?.[nodeLabel];
    console.log(`🔍 Node "${nodeLabel}" maps to LE codes:`, leCodes);
    
    if (leCodes && leCodes.size > 0) {
        const leCodesArray = Array.from(leCodes);
        const filtered = records.filter(r => leCodesArray.includes(r.LE));
        console.log(`🔍 Filtered ${records.length} → ${filtered.length} records using LE codes:`, leCodesArray);
        return filtered;
    }
    
    console.log("❌ No LE codes found for this node");
    return [];
},


    // Dimension filter functions (simplified for brevity)
    filterByLegalEntity: function (records, node) {
        if (node._id === 'ROOT') return records;
        if (node.isLeaf && node.factId) return records.filter(r => r.LE === node.factId);
        const mapping = this.state.mappings?.legalEntity;
        if (!mapping) return records;
        const leCodes = new Set(mapping.pathToLeCodes[node.label] || []);
        Object.entries(mapping.leToPaths || {}).forEach(([le, paths]) => {
            if (paths.includes(node.label)) leCodes.add(le);
        });
        return leCodes.size > 0 ? records.filter(r => leCodes.has(r.LE)) : records;
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
        if (node._id === 'ROOT') return records;
        if (node.factId) return records.filter(r => r.COMPONENT_GMID === node.factId);
        if (node.prefixFilter) {
            return records.filter(r => r.COMPONENT_GMID?.startsWith(node.prefixFilter) || r.PATH_GMID?.includes(node.prefixFilter));
        }
        return records;
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
        if (!this.state.factData || !this.state.factData.length) {
            console.error("No fact data available");
            return;
        }

        const rowFields = this.state.rowFields || [];
        const columnFields = this.state.columnFields || [];
        const valueFields = this.state.valueFields || ['COST_UNIT'];

        // Process rows with multiple dimensions
        const rowData = this.processMultiDimensionFields(rowFields, 'row');
        const columnData = columnFields.length > 0
            ? this.processMultiDimensionFields(columnFields, 'column')
            : { flatRows: [{ _id: 'default', label: 'Measures', level: 0 }], flatMappings: [] };

        this.state.pivotData = {
            rows: rowData.flatRows,
            rowMappings: rowData.flatMappings,
            columns: columnData.flatRows,
            columnMappings: columnData.flatMappings,
            data: []
        };

        this.calculatePivotCells();
    },


    /**
     * Process multiple dimension fields
     */
    // processMultiDimensionFields: function (fields, zone) {
    //     const flatRows = [];
    //     const flatMappings = [];
        
    //     const processNodeRecursive = (node, dimensionField, hierarchy, path, level) => {
    //         const dimensionName = extractDimensionName(dimensionField);
    //         const hasChildren = nodeHasChildren(node, this.state);
    //         const isExpanded = isNodeExpanded(node._id, dimensionName, zone, this.state);
            
    //         const processedNode = {
    //             _id: node._id,
    //             label: node.label || node._id,
    //             hierarchyField: dimensionField,
    //             level: level,
    //             path: [...path, node._id],
    //             hasChildren: hasChildren,
    //             isLeaf: !hasChildren,
    //             expanded: isExpanded,
    //             dimension: dimensionField,
    //             factId: node.factId
    //         };
            
    //         flatRows.push(processedNode);
    //         flatMappings.push({ 
    //             _id: node._id, 
    //             dimension: dimensionField, 
    //             level: level 
    //         });
            
    //         // Process children if expanded
    //         if (hasChildren && isExpanded) {
    //             node.children.forEach(childId => {
    //                 const childNode = hierarchy.nodesMap[childId];
    //                 if (childNode) {
    //                     processNodeRecursive(
    //                         childNode, 
    //                         dimensionField, 
    //                         hierarchy, 
    //                         processedNode.path, 
    //                         level + 1
    //                     );
    //                 }
    //             });
    //         }
    //     };

    //     fields.forEach((dimensionField) => {
    //         const dimensionName = extractDimensionName(dimensionField);
    //         const hierarchy = this.state.hierarchies[dimensionName];
            
    //         if (!hierarchy) {
    //             console.warn(`Hierarchy not found for dimension: ${dimensionName}`);
    //             return;
    //         }
            
    //         const analysis = analyzeDimension(dimensionField, hierarchy);
    //         if (!analysis) return;
            
    //         console.log(`Processing dimension: ${dimensionName}`, analysis);
            
    //         const rootNode = hierarchy.nodesMap['ROOT'];
    //         if (rootNode) {
    //             processNodeRecursive(rootNode, dimensionField, hierarchy, [], 0);
    //         }
    //     });
        
    //     return { flatRows, flatMappings };
    // },

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
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];

        pivotData.rows.forEach(rowDef => {
            const rowData = { _id: rowDef._id };
            pivotData.columns.forEach(colDef => {
                valueFields.forEach(fieldId => {
                    const value = this.calculateMeasure(factData, rowDef, colDef, fieldId);
                    const key = colDef._id === 'default' ? fieldId : `${colDef._id}|${fieldId}`;
                    rowData[key] = value;
                });
            });
            pivotData.data.push(rowData);
        });
    },


    /**
     * Render pivot table
     */
    renderPivotTable: function (elements) {
        if (this.currentView === 'vertical') {
            this.renderVerticalHierarchicalColumns(elements, this.state.pivotData);
        } else {
            this.renderHierarchicalColumns(elements, this.state.pivotData);
            this.renderTableBody(elements, this.state.pivotData);
        }
    },


    /**
     * Filters records by a specific dimension node
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
                console.warn(`⚠️ Warning: Unknown dimension: ${dimName}`);
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

        if (columns.length === 0) {
            this.renderSimpleHeader(elements, valueFields);
            return;
        }

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
        
        // FIXED: For each measure, show all leaf columns with expand/collapse for EACH measure
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
                
                // CRITICAL FIX: Add expand/collapse control for ALL measures if column has children
                // Previously only added for fieldIndex === 0, now add for all measures
                if (hasChildren) {
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = extractDimensionName(col.hierarchyField);
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        data-measure="${field}"
                        onclick="handleExpandCollapseClick(event)"
                        title="Expand/collapse ${displayLabel}"></span>`;
                } else {
                    // Don't add leaf-node span for headers (this removes the red dot)
                    // headerHtml += '<span class="leaf-node"></span>';
                }
                
                headerHtml += `<span class="column-label">${displayLabel}</span>`;
                headerHtml += '</th>';
            });
        });
        
        headerHtml += '</tr>';

        elements.pivotTableHeader.innerHTML = headerHtml;
        this.attachEventListeners(elements.pivotTableHeader, 'header');
    },


    // Add this helper method to check if original column has children
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
        
        const dimName = extractDimensionName(node.hierarchyField);
        
        // Try to get enhanced label from data module
        if (typeof data !== 'undefined') {
            if (dimName === 'item_cost_type' && node.factId) {
                return data.getItemCostTypeDesc?.(node.factId) || node.label || node._id;
            }
            if (dimName === 'material_type' && node.factId) {
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
        let headerHtml = '<tr>';
        // Row header spans all 3 rows
        headerHtml += `<th class="row-header" rowspan="3">${PivotHeaderConfig.getRowAreaLabel()}</th>`;
        // Measures header spans all measure columns
        headerHtml += `<th class="value-header measures-header" colspan="${valueFields.length}">${PivotHeaderConfig.getValueAreaLabel()}</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Placeholder for measure level (empty when no column dimensions)
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            headerHtml += `<th class="value-header merged-measure">${this.getFieldLabel(field)}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Individual measure labels (repeated for consistency)
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = this.getFieldLabel(field);
            headerHtml += `<th class="value-header">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
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
        let bodyHtml = '';

        const visibleRows = this.getVisibleRows(pivotData.rows);
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Hierarchy cell
            const indentation = row.level * 20;
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';
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

            // Value cells - organize by measure then by column
            if (columns.length > 0) {
                const leafColumns = this.getVisibleLeafColumns(columns);
                
                // For each measure, render all column values
                valueFields.forEach(field => {
                    leafColumns.forEach(col => {
                        const key = `${col._id}|${field}`;
                        const value = rowData[key] || 0;
                        bodyHtml += this.renderValueCell(value);
                    });
                });
            } else {
                // No column hierarchies - simple measures
                valueFields.forEach(field => {
                    const value = rowData[field] || 0;
                    bodyHtml += this.renderValueCell(value);
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
     * Process pivot data
     */
    processPivotData: function () {
        if (!this.state.factData || this.state.factData.length === 0) {
            console.error("No fact data available for pivot table");
            return;
        }

        let rowFields = this.state.rowFields || [];
        let columnFields = this.state.columnFields || [];
        let valueFields = this.state.valueFields || [];

        if (rowFields.length === 0) {
            console.warn("No row fields selected, defaulting to first available dimension");
        }

        if (valueFields.length === 0) {
            console.warn("No value fields selected, defaulting to COST_UNIT");
        }

        const rowData = data.processHierarchicalFields(rowFields, 'row');
        const columnData = columnFields.length > 0
            ? data.processHierarchicalFields(columnFields, 'column')
            : { flatRows: [{ _id: 'default', label: 'Value' }], flatMappings: [] };

        this.state.pivotData = {
            rows: rowData.flatRows,
            rowMappings: rowData.flatMappings,
            columns: columnData.flatRows,
            columnMappings: columnData.flatMappings,
            data: []
        };

        this.calculatePivotCells();
    },


    calculatePivotCells: function () {
        const pivotData = this.state.pivotData;
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];

        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }

        console.log(`🔍 DIAGNOSTIC: Calculating pivot cells with ${factData.length} fact records`);
        console.log(`🔍 DIAGNOSTIC: Value fields:`, valueFields);
        console.log(`🔍 DIAGNOSTIC: Pivot rows:`, pivotData.rows.length);
        console.log(`🔍 DIAGNOSTIC: Pivot columns:`, pivotData.columns.length);

        // Clear existing data
        pivotData.data = [];

        pivotData.rows.forEach((rowDef, rowIndex) => {
            const rowData = { _id: rowDef._id };
            
            console.log(`🔍 ROW ${rowIndex}: Processing "${rowDef.label}" (${rowDef._id})`);

            pivotData.columns.forEach((colDef, colIndex) => {
                valueFields.forEach((fieldId, fieldIndex) => {
                    const value = this.calculateMeasure(factData, rowDef, colDef, fieldId);
                    
                    // Store value with proper key
                    const key = colDef._id === 'default' ? fieldId : `${colDef._id}|${fieldId}`;
                    
                    let finalValue = value;
                    if (typeof finalValue !== 'number') {
                        const converted = parseFloat(finalValue);
                        if (!isNaN(converted)) {
                            finalValue = converted;
                        } else {
                            finalValue = 0;
                        }
                    }
                    
                    rowData[key] = finalValue;
                    
                    console.log(`🔍   Field "${fieldId}" -> Key "${key}" = ${finalValue}`);
                });
            });

            pivotData.data.push(rowData);
            console.log(`🔍 ROW ${rowIndex} DATA:`, rowData);
        });

        console.log(`🔍 DIAGNOSTIC: Final pivot data:`, pivotData.data);
        console.log(`🔍 DIAGNOSTIC: Pivot calculations complete: ${pivotData.data.length} data rows generated`);
    },


    /**
     * Check table structure
     */
    checkTableStructure: function () {
        console.log("=== TABLE STRUCTURE CHECK ===");
        const tableHeader = document.getElementById('pivotTableHeader');
        console.log("Table header exists:", !!tableHeader);
        if (tableHeader) {
            console.log("Header HTML:", tableHeader.innerHTML);
        }

        const tableBody = document.getElementById('pivotTableBody');
        console.log("Table body exists:", !!tableBody);
        if (tableBody) {
            console.log("Body has rows:", tableBody.querySelectorAll('tr').length);
            console.log("Body HTML sample:", tableBody.innerHTML.substring(0, 200) + '...');
        }

        const valueCells = document.querySelectorAll('.value-cell');
        console.log("Value cells found:", valueCells.length);

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
     * Gets all leaf descendants of a node
     */
    getAllLeafDescendants(node, result = []) {
        if (!node) return result;

        if (node.isLeaf) {
            result.push(node);
        } else if (node.children && node.children.length > 0) {
            for (const child of node.children) {
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
     * Calculate measure values for pivot table cells
     * Improved to properly handle dimension filtering
     * 
     * @param {Array} records - Array of data records to aggregate
     * @param {Object} rowDef - Row node information
     * @param {Object} colDef - Column node information (if applicable)
     * @param {string} measureField - Name of the measure field (COST_UNIT or QTY_UNIT)
     * @returns {number} - The calculated measure value
     */
    calculateMeasure: function (records, rowDef, colDef, measureField) {
        // console.log(`Calculating ${measureField} for ${rowDef ? rowDef.label : 'All'}`);
        // console.log(`Input records: ${records ? records.length : 0}`);

        // Return 0 for empty record sets
        if (!records || records.length === 0) {
            console.log("No records to calculate");
            return 0;
        }

        // Start with all records
        let filteredRecords = [...records];

        // Filter by row definition if provided
        if (rowDef) {
            // console.log(`Filtering by row: ${rowDef.label}`);

            // For debugging, check if this is a Legal Entity node
            if (rowDef.hierarchyField === 'DIM_LEGAL_ENTITY') {
                // console.log(`Legal Entity node: ${rowDef.label}, factId: ${rowDef.factId}`);

                // IMPORTANT: Debug the filtering logic
                if (rowDef.factId) {
                    // Check how many records match this LE
                    const matchCount = filteredRecords.filter(r => r.LE === rowDef.factId).length;
                    // console.log(`Found ${matchCount} records with LE = "${rowDef.factId}"`);

                    filteredRecords = filteredRecords.filter(r => r.LE === rowDef.factId);
                } else {
                    // For hierarchy nodes, check if we're filtering properly
                    console.log(`Node ${rowDef.label} has no factId, using hierarchy filtering`);

                    // Don't filter root node
                    if (rowDef.id === 'ROOT' || rowDef.label === 'WORLDWIDE') {
                        console.log("Root node - not filtering");
                    } else {
                        console.log(`Filtering by hierarchy node: ${rowDef.label}`);

                        // Instead of hierarchy filtering, look at each record's LE value
                        // and see if it belongs to this segment of the hierarchy
                        const mappings = window.App?.state?.mappings?.legalEntity;

                        if (mappings && mappings.pathToLeCodes) {
                            // Try to find LEs for this path segment
                            const matchingLEs = mappings.pathToLeCodes[rowDef.label];

                            if (matchingLEs && matchingLEs.size > 0) {
                                // console.log(`Found ${matchingLEs.size} LEs for path segment "${rowDef.label}"`);

                                // Filter to only records with these LEs
                                const leSet = new Set(matchingLEs);
                                filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
                            } else {
                                console.warn(`No matching LEs found for segment "${rowDef.label}"`);

                                // Try matching based on path contains
                                const matchingByPath = [];

                                // Check each record's LE path
                                const uniqueLEs = new Set(filteredRecords.map(r => r.LE));
                                uniqueLEs.forEach(le => {
                                    if (mappings.leToPaths && mappings.leToPaths[le] &&
                                        mappings.leToPaths[le].includes(rowDef.label)) {
                                        matchingByPath.push(le);
                                    }
                                });

                                if (matchingByPath.length > 0) {
                                    // console.log(`Found ${matchingByPath.length} LEs with paths containing "${rowDef.label}"`);

                                    // Filter to only records with these LEs
                                    const leSet = new Set(matchingByPath);
                                    filteredRecords = filteredRecords.filter(r => leSet.has(r.LE));
                                }
                            }
                        } else {
                            console.warn("No Legal Entity mappings available for filtering");
                        }
                    }
                }
            } else {
                // Use standard filtering for other hierarchies
                filteredRecords = this.filterRecordsByDimension(filteredRecords, rowDef);
            }
        }

        // console.log(`After row filtering: ${filteredRecords.length} records`);

        // Filter by column definition if provided
        if (colDef) {
            filteredRecords = this.filterRecordsByDimension(filteredRecords, colDef);
            // console.log(`After column filtering: ${filteredRecords.length} records`);
        }

        // Return 0 if no records match
        if (filteredRecords.length === 0) {
            // console.log("No matching records after filtering");
            return 0;
        }

        // Sum the measure values with detailed checks
        let result = 0;
        let validCount = 0;
        let zeroCount = 0;
        let nanCount = 0;

        // Check a sample of the filtered data
        // console.log("Examining filtered data sample:");
        filteredRecords.slice(0, 3).forEach((record, idx) => {
            const originalValue = record[measureField];
            const parsedValue = typeof originalValue === 'number' ?
                originalValue : parseFloat(originalValue || 0);

            // console.log(`Record ${idx}: ${measureField}=${originalValue} (${typeof originalValue}), parsed=${parsedValue}`);
        });

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


    checkTableAlignment: function () {
        const headerCells = document.querySelectorAll('#pivotTableHeader th');
        const firstRowCells = document.querySelectorAll('#pivotTableBody tr:first-child td');
        console.log(`Header cells: ${headerCells.length}, First row cells: ${firstRowCells.length}`);
        if (headerCells.length !== firstRowCells.length) {
            console.warn('Header and body cell counts do not match!');
        }
        headerCells.forEach((header, index) => {
            const bodyCell = firstRowCells[index];
            if (header && bodyCell) {
                const headerWidth = header.offsetWidth;
                const bodyWidth = bodyCell.offsetWidth;
                if (Math.abs(headerWidth - bodyWidth) > 2) {
                    console.warn(`Misalignment at column ${index}: Header width ${headerWidth}px, Body width ${bodyWidth}px`);
                }
            }
        });
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


    /**
     * Enhanced renderTableBody to properly handle dynamic column depths
     */
    renderTableBody: function (elements, pivotData) {
        if (!elements || !elements.pivotTableBody || !pivotData) return;

        const valueFields = this.state.valueFields || [];
        const columns = pivotData.columns.filter(col => col._id !== 'ROOT');
        let bodyHtml = '';

        const visibleRows = this.getVisibleRows(pivotData.rows);
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Row header cell
            const indentation = row.level * 20;
            const dimName = extractDimensionName(row.hierarchyField);
            
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

            // Value cells - match the header structure exactly
            if (columns.length > 0) {
                const leafColumns = this.getVisibleLeafColumns(columns);
                
                // For each leaf column, show all measures horizontally (same order as headers)
                leafColumns.forEach(col => {
                    valueFields.forEach(field => {
                        const key = `${col._id}|${field}`;
                        const value = rowData[key] || 0;
                        bodyHtml += this.renderValueCell(value);
                    });
                });
            } else {
                // No column hierarchies - simple measures
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
     * Debug function to check current state
     */
    debugPivotTableState: function() {
        console.log("🔍 PIVOT TABLE STATE DEBUG:");
        console.log("🔍 Value Fields:", this.state.valueFields);
        console.log("🔍 Row Fields:", this.state.rowFields);
        console.log("🔍 Column Fields:", this.state.columnFields);
        console.log("🔍 Fact Data Count:", this.state.factData?.length || 0);
        console.log("🔍 Pivot Data:", this.state.pivotData);
        
        if (this.state.pivotData?.data) {
            console.log("🔍 Sample Row Data:", this.state.pivotData.data[0]);
        }
    },


    /**
     * Debug function to verify value fields configuration
     */
    debugValueFields: function() {
        console.log("🔍 VALUE FIELDS DEBUG:");
        console.log("🔍 this.state.valueFields:", this.state.valueFields);
        console.log("🔍 Available fields:", this.state.availableFields?.filter(f => f.category === 'measure' || f.category === 'fact'));
        
        // Check what's in the value fields drop zone in the UI
        const valueFieldsContainer = document.getElementById('valueFields');
        if (valueFieldsContainer) {
            const fieldElements = valueFieldsContainer.querySelectorAll('.field');
            console.log("🔍 UI Value Fields Count:", fieldElements.length);
            fieldElements.forEach((field, index) => {
                console.log(`🔍 UI Field ${index}:`, {
                    text: field.textContent,
                    fieldId: field.dataset.fieldId,
                    className: field.className
                });
            });
        }
        
        // Check sample fact data for available measures
        if (this.state.factData && this.state.factData.length > 0) {
            const sampleRecord = this.state.factData[0];
            console.log("🔍 Sample fact record keys:", Object.keys(sampleRecord));
            console.log("🔍 Sample COST_UNIT value:", sampleRecord.COST_UNIT);
            console.log("🔍 Sample QTY_UNIT value:", sampleRecord.QTY_UNIT);
        }
    },


    getVisibleRows: function (rows) {
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


    renderValueCell: function (value) {
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


    processPivotData: function () {
        if (!this.state.factData || this.state.factData.length === 0) {
            console.error("No fact data available for pivot table");
            return;
        }

        // Process rows
        let rowFields = this.state.rowFields || [];
        let columnFields = this.state.columnFields || [];
        let valueFields = this.state.valueFields || [];

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


    calculatePivotCells: function () {
        const pivotData = this.state.pivotData;
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];

        if (!pivotData || !pivotData.rows || pivotData.rows.length === 0) {
            console.error("Invalid pivot data structure");
            return;
        }

        // console.log(`🔥 FIXED calculatePivotCells: ${factData.length} fact records, ${valueFields.length} value fields`);

        // Clear existing data
        pivotData.data = [];

        // CRITICAL: Check if we have real column dimensions
        const realColumns = pivotData.columns.filter(col => 
            col._id !== 'ROOT' && 
            col._id !== 'default' && 
            col._id !== 'no_columns' &&
            col.label !== 'Value' &&
            col.label !== 'All Data'
        );
        
        const hasRealColumnDimensions = realColumns.length > 0;
        // console.log(`🔥 FIXED: Real columns for calculation:`, realColumns.map(c => c._id));
        // console.log(`🔥 FIXED: Has real column dimensions: ${hasRealColumnDimensions}`);

        pivotData.rows.forEach((rowDef, rowIndex) => {
            const rowData = { _id: rowDef._id };
            
            // console.log(`🔥 FIXED: Processing row: "${rowDef.label}" (${rowDef._id})`);

            if (hasRealColumnDimensions) {
                // HAS COLUMN DIMENSIONS: Use standard cross-tabulation
                realColumns.forEach((colDef) => {
                    valueFields.forEach((fieldId) => {
                        const value = this.calculateMeasure(factData, rowDef, colDef, fieldId);
                        const key = `${colDef._id}|${fieldId}`;
                        rowData[key] = typeof value === 'number' ? value : (parseFloat(value) || 0);
                        // console.log(`🔥 FIXED:   ${key} = ${rowData[key]}`);
                    });
                });
            } else {
                // NO COLUMN DIMENSIONS: Calculate measures directly for each row
                valueFields.forEach((fieldId) => {
                    const value = this.calculateMeasure(factData, rowDef, null, fieldId);
                    // CRITICAL: Use field name directly as key
                    rowData[fieldId] = typeof value === 'number' ? value : (parseFloat(value) || 0);
                    // console.log(`🔥 FIXED:   ${fieldId} = ${rowData[fieldId]} (DIRECT KEY)`);
                });
            }

            pivotData.data.push(rowData);
        });

        // console.log(`🔥 FIXED: Calculation complete: ${pivotData.data.length} data rows`);
        // console.log(`🔥 FIXED: Sample row data:`, pivotData.data[0]);
        
        // Verify the keys exist
        // if (pivotData.data.length > 0) {
        //     const firstRowKeys = Object.keys(pivotData.data[0]);
        //     // console.log(`🔥 FIXED: First row keys:`, firstRowKeys);
        //     valueFields.forEach(field => {
        //         if (firstRowKeys.includes(field)) {
        //             // console.log(`✅ FIXED: Field ${field} EXISTS as direct key`);
        //         } else {
        //             // console.log(`❌ FIXED: Field ${field} MISSING as direct key`);
        //         }
        //     });
        // }
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


    generatePivotTable: function () {
        console.log("Starting pivot table generation...");

        // ADD THESE DEBUG CALLS
        this.debugValueFields();
        this.debugPivotTableState();

        // FIRST: Get DOM elements - Add this at the beginning of the function
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };

        try {
            // Process the data for the pivot table
            this.processPivotData();

            // Now pass the elements to renderPivotTable
            this.renderPivotTable(elements);

            console.log("Pivot table generation complete");

        } catch (error) {
            console.error("Error in normal pivot table generation:", error);
            console.log("Using fallback rendering instead");
        }
    },


    // generatePivotTable: function () {
    //     console.log("Starting pivot table generation...");

    //     // STEP 1: Initialize all nodes to collapsed state
    //     this.initializeCollapsedState();

    //     // Get DOM elements
    //     const elements = {
    //         pivotTableHeader: document.getElementById('pivotTableHeader'),
    //         pivotTableBody: document.getElementById('pivotTableBody')
    //     };

    //     try {
    //         // Process the data for the pivot table
    //         this.processPivotData();

    //         // Render the pivot table
    //         this.renderPivotTable(elements);

    //         console.log("Pivot table generation complete - all nodes collapsed by default");

    //     } catch (error) {
    //         console.error("Error in pivot table generation:", error);
    //     }
    // },


    

// 
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


    // You can also add this helper method to expand only root nodes if desired
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