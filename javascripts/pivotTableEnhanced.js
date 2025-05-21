// This module centralizes the essential logic of pivot table functionality with enhanced column hierarchy handling capabilities

import data from './data.js';
import stateModule from './state.js';
import multiDimensionPivotHandler from './pivotTableMultiDimensionsHandler.js';

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
        
        // Initialize column hierarchy handler
        this.columnHierarchyHandler.init();
        
        // Add animation styles
        this.addAnimationStyles();
        
        // Initialize searchable dropdowns
        this.initializeAllSearchableDropdowns();
        
        // Add the column dimension processing methods
        // this.processColumnDimensions = processColumnDimensions;
        // this.renderHierarchicalColumnHeaders = renderHierarchicalColumnHeaders;
        // this.getVisibleLeafColumns = getVisibleLeafColumns;
        
        // Replace generatePivotTable with enhanced version
        window.generatePivotTable = generatePivotTable;
        
        console.log("✅ Status: Pivot table system initialized with enhanced column functionality");
    },


    /**
     * Adds animation styles to the document
     */
    addAnimationStyles: function() {
        // Create a style element if it doesn't exist
        let styleEl = document.getElementById('pivot-animation-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'pivot-animation-styles';
            document.head.appendChild(styleEl);
        }
        
        // Add animation styles
        styleEl.textContent = `
            /* Expand/Collapse Button Animations */
            .expand-collapse {
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                            background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                will-change: transform, background-color;
                position: relative;
            }
            
            .expand-collapse:hover {
                transform: scale(1.1);
                background-color: rgba(37, 99, 235, 0.15);
            }
            
            .expand-collapse:active {
                transform: scale(0.9);
            }
            
            /* Plus/Minus icon animations */
            .expand-collapse.collapsed:before {
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: center;
            }
            
            .expand-collapse.expanded:before {
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: center;
            }
            
            .expand-collapse.expanding:before {
                animation: rotateFromPlusToMinus 0.3s forwards;
            }
            
            .expand-collapse.collapsing:before {
                animation: rotateFromMinusToPlus 0.3s forwards;
            }
            
            @keyframes rotateFromPlusToMinus {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(180deg); }
            }
            
            @keyframes rotateFromMinusToPlus {
                0% { transform: rotate(180deg); }
                100% { transform: rotate(0deg); }
            }
            
            /* Row appearance/disappearance animations */
            tr[data-parent-id] {
                transition: opacity 0.3s ease-out, 
                            transform 0.3s ease-out;
                will-change: opacity, transform;
            }
            
            /* Search Functionality Styles */
            .filter-search-container {
                position: relative;
                margin: 8px;
                padding: 4px;
                background-color: #f8fafc;
                border-radius: 6px;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            
            .filter-search {
                width: 100%;
                padding: 8px 30px 8px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                font-size: 14px;
                line-height: 1.5;
                color: #334155;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            
            .filter-search:focus {
                outline: none;
                border-color: #2563eb;
                box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
            }
            
            .filter-search::placeholder {
                color: #94a3b8;
            }
            
            .filter-search-clear {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #64748b;
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s ease, color 0.2s ease;
            }
            
            .filter-search-clear:hover {
                background-color: #e2e8f0;
                color: #1e293b;
            }
            
            .filter-item.hidden {
                display: none;
            }
            
            .no-results-message {
                padding: 12px;
                text-align: center;
                color: #64748b;
                font-style: italic;
                font-size: 14px;
                background-color: #f8fafc;
                border-radius: 4px;
                margin: 8px;
            }
        `;
        
        console.log("✅ Animation styles added to document");
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
     * @param {Event} e - The click event
     */
    handleExpandCollapseClick: function(e) {
        // Make sure we're handling the actual button click, not its children
        let target = e.target;
        
        // If clicked on a child element, find the actual button
        if (!target.classList.contains('expand-collapse')) {
            target = target.closest('.expand-collapse');
            if (!target) return; // Exit if no button found
        }
        
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        
        // Get node information
        const nodeId = target.getAttribute('data-node-id');
        const hierarchyName = target.getAttribute('data-hierarchy');
        const zone = target.getAttribute('data-zone') || 'row';
        
        console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
        
        // Prevent multiple clicks during animation
        if (target.classList.contains('animating')) {
            return;
        }
        
        // Add animating class to prevent multiple clicks
        target.classList.add('animating');
        
        // Get state from the global App object or this object
        const state = window.App?.state || this.state;
        
        // Ensure node exists in state
        let node = null;
        
        if (hierarchyName && state.hierarchies && state.hierarchies[hierarchyName]) {
            // Look in the specified hierarchy
            node = state.hierarchies[hierarchyName].nodesMap?.[nodeId];
        } else if (nodeId === 'ROOT') {
            // It might be the root node
            const pivotData = state.pivotData || {};
            if (zone === 'column') {
                // Find in columns
                node = pivotData.columns?.find(col => col._id === 'ROOT' || col.isRootNode);
            } else {
                // Find in rows
                node = pivotData.rows?.find(row => row._id === 'ROOT' || row.isRootNode);
            }
        }
        
        if (!node) {
            console.error(`❌ Alert! Node ${nodeId} not found in ${hierarchyName} hierarchy`);
            target.classList.remove('animating');
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
        
        // Special handling for column zone
        if (zone === 'column') {
            node.columnExpanded = newState;
        }
        
        // Toggle visual state immediately for feedback
        const isExpanding = newState;
        target.classList.toggle('expanded', isExpanding);
        target.classList.toggle('collapsed', !isExpanding);
        target.classList.add(isExpanding ? 'expanding' : 'collapsing');
        
        console.log(`Node ${nodeId} expansion set to: ${newState}`);
        
        // For column expansions, we need to regenerate the entire table
        if (zone === 'column') {
            setTimeout(() => {
                window.refreshPivotTable();
                
                // Remove animation classes after refresh
                setTimeout(() => {
                    target.classList.remove('animating', 'expanding', 'collapsing');
                }, 300);
            }, 50);
            return;
        }
        
        // Use requestAnimationFrame for smooth animations for row expansions
        requestAnimationFrame(() => {
            // Find child elements that need to be shown/hidden
            let childrenContainer;
            
            // For rows, we need to find child rows using node ID
            childrenContainer = document.querySelectorAll(`tr[data-parent-id="${nodeId}"]`);
            
            // If we found children, animate them
            if (childrenContainer && childrenContainer.length > 0) {
                // Set initial state for animation
                childrenContainer.forEach(child => {
                    if (isExpanding) {
                        // Prepare for expand animation
                        child.style.display = 'table-row';
                        child.style.opacity = '0';
                        child.style.transform = 'translateY(-10px)';
                    } else {
                        // Prepare for collapse animation
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0)';
                    }
                });
                
                // Trigger the animation
                setTimeout(() => {
                    childrenContainer.forEach((child, index) => {
                        // Stagger animations for children
                        setTimeout(() => {
                            if (isExpanding) {
                                child.style.opacity = '1';
                                child.style.transform = 'translateY(0)';
                            } else {
                                child.style.opacity = '0';
                                child.style.transform = 'translateY(-10px)';
                            }
                        }, index * 20); // Stagger by 20ms per child
                    });
                    
                    // Clean up after animation
                    setTimeout(() => {
                        childrenContainer.forEach(child => {
                            if (!isExpanding) {
                                child.style.display = 'none';
                            }
                            // Remove inline styles after animation
                            child.style.opacity = '';
                            child.style.transform = '';
                        });
                        
                        // Remove animation classes
                        target.classList.remove('animating', 'expanding', 'collapsing');
                    }, childrenContainer.length * 20 + 300); // Allow time for all animations to complete
                }, 10);
            } else {
                // For when we can't find children directly
                // Regenerate pivot table with a small delay to allow visual feedback
                setTimeout(() => {
                    window.refreshPivotTable();
                    
                    // Remove animation classes after refresh
                    setTimeout(() => {
                        target.classList.remove('animating', 'expanding', 'collapsing');
                    }, 300);
                }, 50);
            }
        });
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
        // Start with all records
        let filteredRecords = [...records];
        
        // Filter by row definition if provided
        if (rowDef) {
            filteredRecords = this.filterByDimensionNode(filteredRecords, rowDef);
        }
        
        // IMPROVED: Filter by column definition if provided
        if (colDef) {
            // Check specifically for ITEM_COST_TYPE columns
            if (colDef._id && colDef._id.includes("ITEM_COST_TYPE")) {
                // Extract the actual cost type correctly
                let costType;
                
                // Handle different ways the cost type might be stored
                if (colDef.factId) {
                    costType = colDef.factId;
                } else if (colDef.label) {
                    costType = colDef.label;
                } else if (colDef._id && colDef._id.includes("ITEM_COST_TYPE_")) {
                    // Extract from ID if in format "ITEM_COST_TYPE_[value]"
                    costType = colDef._id.replace("ITEM_COST_TYPE_", "");
                }
                
                // Skip filtering if we couldn't determine the cost type
                if (costType) {
                    // More robust filtering with fallback options
                    filteredRecords = filteredRecords.filter(record => {
                        // Check for exact match
                        if (record.ITEM_COST_TYPE === costType) return true;
                        
                        // Check for case-insensitive match as fallback
                        if (record.ITEM_COST_TYPE && record.ITEM_COST_TYPE.toLowerCase() === costType.toLowerCase()) return true;
                        
                        // Consider column hierarchy paths if available
                        if (colDef.path && record.ITEM_COST_TYPE_PATH) {
                            return colDef.path.some(segment => record.ITEM_COST_TYPE_PATH.includes(segment));
                        }
                        
                        return false;
                    });
                    
                    console.log(`Filtered for ${costType}: ${filteredRecords.length} records`);
                } else {
                    console.warn(`⚠️ Warning: Could not determine cost type for column: ${colDef._id}`);
                }
            } else {
                // For other column types
                filteredRecords = this.filterByDimensionNode(filteredRecords, colDef);
            }
        }
        
        // Sum the measure values
        let result = 0;
        filteredRecords.forEach(record => {
            const value = parseFloat(record[measureField] || 0);
            if (!isNaN(value)) {
                result += value;
            }
        });
        
        // Add debugging to verify calculation
        if (colDef) {
            const rowId = rowDef ? rowDef._id : 'total';
            const colId = colDef._id || 'unknown';
            console.log(`Cell value for ${rowId} × ${colId} (${measureField}): ${result.toFixed(2)}`);
        }
        
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
     * Recursively renders column hierarchy
     * @param {Array} columns - Columns to render
     * @param {Array} headerRows - Header rows by level
     * @param {Number} level - Current level in hierarchy
     */
    renderColumnHierarchy: function(columns, headerRows, level) {
        if (!columns || columns.length === 0 || !headerRows || level >= headerRows.length) {
            return;
        }
        
        // Current row for this level
        const currentRow = headerRows[level];
        
        // Determine if we're dealing with a simple hierarchy
        const isSimple = this.isSimpleHierarchy(columns);
        
        // Process each column at this level
        columns.forEach(column => {
            // Skip invalid columns
            if (!column) return;
            
            // Create column header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            
            // Add cell classification
            if (column.isLeaf) cell.classList.add('leaf-node');
            if (column.children && column.children.length > 0) cell.classList.add('has-children');
            
            // Apply data attributes for styling and behavior
            cell.setAttribute('data-node-id', column._id);
            cell.setAttribute('data-level', level);
            
            // CRITICAL FIX: Add dimension info if available with consistent handling
            let dimName = '';
            if (column.hierarchyField) {
                dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                cell.setAttribute('data-hierarchy', dimName);
                
                // CRITICAL FIX: Add dimension type explicitly
                cell.setAttribute('data-dimension', dimName);
            } else if (column.hierarchyName) {
                dimName = column.hierarchyName;
                cell.setAttribute('data-hierarchy', dimName);
                
                // CRITICAL FIX: Add dimension type explicitly
                cell.setAttribute('data-dimension', dimName);
            }
            
            // CRITICAL FIX: Add hierarchy type indicator for styling
            if (isSimple) {
                cell.setAttribute('data-hierarchy-type', 'simple');
                
                // CRITICAL FIX: For simple hierarchies, add specific class for consistent styling
                cell.classList.add('simple-hierarchy');
                
                // For direct children of root in simple hierarchies
                if (level === 1) {
                    cell.classList.add('simple-child');
                }
            } else {
                cell.setAttribute('data-hierarchy-type', 'dense');
            }
            
            // CRITICAL FIX: Special handling for root and top-level nodes
            if (level === 0) {
                cell.classList.add('root-level');
                
                // CRITICAL FIX: Add specific class for simple root nodes
                if (isSimple) {
                    cell.classList.add('simple-root');
                }
            }
            
            // CRITICAL FIX: Add single-level class for consistent styling
            if (column.isLeaf || 
                !column.children || 
                column.children.length === 0 || 
                !column.expanded) {
                cell.classList.add('single-level');
            }
            
            // CRITICAL FIX: In simple hierarchies, ensure every column gets the flat dimension type
            if (isSimple) {
                cell.setAttribute('data-dimension-type', 'flat');
            }
            
            // Calculate colspan - how many leaf nodes underneath
            let colspan = this.countLeafNodes(column);
            if (colspan > 1) {
                cell.colSpan = colspan;
                
                // CRITICAL FIX: Add colspan class for specific styling
                cell.classList.add('has-colspan');
            }
            
            // Calculate rowspan for leaf or collapsed nodes
            if (column.isLeaf || !column.expanded || !column.children || column.children.length === 0) {
                const remainingRows = headerRows.length - level;
                if (remainingRows > 1) {
                    cell.rowSpan = remainingRows;
                    
                    // CRITICAL FIX: Add rowspan class for specific styling
                    cell.classList.add('has-rowspan');
                }
            }
            
            // Add expand/collapse control if column has children
            if (column.children && column.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = `expand-collapse ${column.expanded ? 'expanded' : 'collapsed'}`;
                expandControl.setAttribute('data-node-id', column._id);
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
                        // Look up in hierarchies
                        return this.state.hierarchies?.[dimName]?.nodesMap?.[childId];
                    }
                    return childId;
                }).filter(Boolean); // Remove nulls/undefined
                
                // Recursively render children at next level
                this.renderColumnHierarchy(childNodes, headerRows, level + 1);
            }
        });
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
                console.warn(`⚠️ Warning: Unknown dimension: ${dimName}`);
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
        // console.log(`Filtering by LE node ${nodeLabel}: Found ${leCodes.size} matching LE codes`);
        
        // If we found LE codes, filter the records
        if (leCodes.size > 0) {
            return records.filter(record => 
                record.LE && leCodes.has(record.LE)
            );
        }
        
        // If we didn't find any matching LE codes, just return the records as is
        console.warn(`⚠️ Warning: No matching LE codes found for node ${nodeLabel}`);
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
        // console.warn(`⚠️ Warning: No filtering criteria found for GMID node: ${node.label}`);
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
        
        // Get the cost type with more fallback options
        let costType = null;
        
        if (node.factId) {
            costType = node.factId;
        } else if (node.label) {
            costType = node.label;
        } else if (node._id && node._id.startsWith('ITEM_COST_TYPE_')) {
            costType = node._id.replace('ITEM_COST_TYPE_', '');
        }
        
        if (!costType) {
            console.error("❌ Cannot determine cost type from node:", node);
            return records; // Return all records if we can't determine cost type
        }
        
        console.log(`Filtering by ITEM_COST_TYPE: ${costType}, records before: ${records.length}`);
        
        // More robust filtering logic
        const filtered = records.filter(record => {
            // Exact match
            if (record.ITEM_COST_TYPE === costType) return true;
            
            // Case-insensitive match
            if (record.ITEM_COST_TYPE && 
                record.ITEM_COST_TYPE.toLowerCase() === costType.toLowerCase()) return true;
                
            return false;
        });
        
        console.log(`After filtering: ${filtered.length} records`);
        
        return filtered;
    },

    /**
     * Filter records by Material Type
     */
    filterByMaterialType: function(records, node) {
        // Safety check
        if (!records || records.length === 0) {
            // console.log("No records to filter");
            return [];
        }
        
        if (!node) {
            console.error("❌ Alert! No node provided for material type filtering");
            return records;
        }
        
        // If it's the root node, return all records
        if (node._id === 'MATERIAL_TYPE_ROOT') {
            // console.log('Material Type Root node - no filtering');
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
            console.error(`❌ Alert! Cannot extract material type code from node:`, node);
            return records; // Return all records if we can't extract the code
        }
        
        // console.log(`Filtering for material type '${materialTypeCode === null ? 'null' : materialTypeCode}', records before: ${records.length}`);
        
        // Simple equality filter
        const filtered = records.filter(record => {
            // Check both string and null equality
            if (materialTypeCode === null) {
                return record.COMPONENT_MATERIAL_TYPE === null || record.COMPONENT_MATERIAL_TYPE === 'null';
            } else {
                return record.COMPONENT_MATERIAL_TYPE === materialTypeCode;
            }
        });
        
        // console.log(`After filtering: ${filtered.length} records for material type '${materialTypeCode === null ? 'null' : materialTypeCode}'`);
        
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
     * @param {Array} columns - Array of column definitions
     * @returns {Array} - Array of visible leaf columns
     */
    getVisibleLeafColumns: function(columns) {
        // Safety check for columns
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            console.warn("⚠️ No columns provided to getVisibleLeafColumns");
            return [];
        }
        
        try {
            const visibleLeafs = [];
            
            // Process a column and its descendants
            const processColumn = (column) => {
                // Safety check for column
                if (!column) return;
                
                // Skip columns marked to be hidden
                if (column.skipInUI) return;
                
                // If it's a leaf node, count it
                if (column.isLeaf) {
                    visibleLeafs.push(column);
                    return;
                }
                
                // If it's not expanded, treat as a leaf for display
                if (!column.expanded) {
                    visibleLeafs.push(column);
                    return;
                }
                
                // For expanded parents, process all children
                if (column.children && column.children.length > 0) {
                    // Safety check for getChildNodes
                    let childNodes = [];
                    try {
                        childNodes = this.getChildNodes(column);
                    } catch (err) {
                        console.error("Error in getChildNodes:", err);
                        // Fallback: try to process direct children
                        childNodes = column.children.filter(child => typeof child === 'object');
                    }
                    
                    childNodes.forEach(child => {
                        if (child) processColumn(child);
                    });
                } else {
                    // No children, treat as leaf
                    visibleLeafs.push(column);
                }
            };
            
            // Process each top-level column
            columns.forEach(column => {
                if (column) processColumn(column);
            });
            
            return visibleLeafs;
        } catch (error) {
            console.error("❌ Error in getVisibleLeafColumns:", error);
            return [];
        }
    },


    countLeafNodes: function(node) {
        if (!node) return 0;
        
        // If this is a leaf node, count as 1
        if (node.isLeaf) return 1;
        
        // If node is not expanded, treat as 1
        if (!node.expanded) return 1;
        
        // If node has no children, count as 1
        if (!node.children || node.children.length === 0) return 1;
        
        // For expanded nodes with children, sum up leaves from all children
        let count = 0;
        
        // Get and process child nodes
        const childNodes = this.getChildNodes(node);
        childNodes.forEach(child => {
            count += countLeafNodes(child);
        });
        
        return Math.max(1, count); // At least 1
    },


    // Improved column dimension processing
    processColumnDimensions:function(fieldIds) {
        // Similar to the row dimensions processing, but optimized for column zone
        const dimensionsData = fieldIds.map(fieldId => {
            return data.processHierarchicalFields([fieldId], 'column');
        });
        
        // Return single dimension directly if that's all we have
        if (dimensionsData.length === 1) {
            return dimensionsData[0];
        }
        
        // For multiple dimensions, create a cartesian product similar to row processing
        // but optimized for column zone rendering
        const result = {
            flatRows: [],          // Combined rows for rendering as columns
            flatMappings: [],      // Mappings for data filtering
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
        
        // Process each dimension to ensure ROOT nodes exist
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
                    dimensionName: getDimensionName(fieldIds[index]),
                    nodeId: 'ROOT',
                    isHierarchical: true,
                    isLeaf: false
                });
            }
        });
        
        // Build specialized column dimension structure
        let combinedColumns = [...dimensionsData[0].flatRows];
        let combinedMappings = [...dimensionsData[0].flatMappings];
        
        for (let i = 1; i < dimensionsData.length; i++) {
            // For columns, the structure is different than rows
            // We need to ensure hierarchical relationships are maintained
            combinedColumns = combineColumnHierarchies(
                combinedColumns, 
                dimensionsData[i].flatRows
            );
            
            combinedMappings = combineMappings(
                combinedMappings,
                dimensionsData[i].flatMappings
            );
        }
        
        result.flatRows = combinedColumns;
        result.flatMappings = combinedMappings;
        
        return result;
    },


    getDimensionName: function(hierarchyField) {
        if (!hierarchyField || !hierarchyField.startsWith('DIM_')) {
            return '';
        }
        return hierarchyField.replace('DIM_', '').toLowerCase();
    },


    // Helper function to combine column hierarchies
    combineColumnHierarchies:function(existingColumns, newColumns) {
        // This creates a specialized structure for columns 
        // where the second dimension becomes nodes under the first
        
        const combined = [];
        
        // For each existing column, create children based on new columns
        existingColumns.forEach(existingCol => {
            // Clone the existing column to avoid modifying original
            const colCopy = {...existingCol};
            
            // If this is a leaf node or not expanded, keep as is
            if (existingCol.isLeaf || !existingCol.expanded) {
                combined.push(colCopy);
                return;
            }
            
            // Otherwise, create child nodes from new columns
            colCopy.children = newColumns.map(newCol => {
                return {
                    _id: `${existingCol._id}|${newCol._id}`,
                    label: newCol.label,
                    parentId: existingCol._id,
                    level: existingCol.level + 1,
                    hasChildren: newCol.hasChildren,
                    isLeaf: newCol.isLeaf,
                    expanded: newCol.expanded,
                    hierarchyField: newCol.hierarchyField,
                    path: newCol.path ? [...existingCol.path, ...newCol.path.filter(p => p !== 'ROOT')] : [...existingCol.path]
                };
            });
            
            combined.push(colCopy);
        });
        
        return combined;
    },


    // Improved column header rendering
    renderHierarchicalColumnHeaders:function(elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) {
            console.error("❌ Alert! Missing header element");
            return;
        }
        
        try {
            // Clear existing header content
            elements.pivotTableHeader.innerHTML = '';
            
            // Get column field dimensions
            const hasColumnDimensions = pivotData.columns && 
                                    pivotData.columns.length > 0 && 
                                    pivotData.columns[0]._id !== 'default';
            
            // Get value/measure fields
            const valueFields = state.valueFields || ['COST_UNIT'];
            
            if (!hasColumnDimensions) {
                // Simple case - just measures, no column dimensions
                this.renderSimpleMeasureHeaders(elements, valueFields);
                return;
            }
            
            // Calculate max hierarchy depth
            const maxHierarchyDepth = this.getMaxColumnHierarchyDepth(pivotData.columns);
            
            // Create header rows - one for each hierarchy level plus one for measures
            const headerRows = [];
            for (let i = 0; i <= maxHierarchyDepth; i++) {
                const row = document.createElement('tr');
                row.className = `header-row header-level-${i}`;
                headerRows.push(row);
            }
            
            // Add the corner cell in the top-left spanning all header rows
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            cornerCell.rowSpan = headerRows.length;
            
            // Add special class for multi-dimension setup if needed
            if (state.rowFields && state.rowFields.length > 1) {
                cornerCell.classList.add('multi-dimension-corner');
                
                // Calculate total sticky cell width based on number of dimensions
                const dimensionCount = state.rowFields.length;
                const totalWidth = Math.min(dimensionCount * 200, 600) + 'px';
                cornerCell.style.width = totalWidth;
                
                // Add dimension count as data attribute
                cornerCell.setAttribute('data-dimension-count', dimensionCount);
            }
            
            cornerCell.textContent = ''; // Can add a label if desired
            headerRows[0].appendChild(cornerCell);
            
            // Process column hierarchies recursively
            this.processColumnHierarchy(pivotData.columns, headerRows, 0, valueFields);
            
            // Add all header rows to the container
            headerRows.forEach(row => {
                elements.pivotTableHeader.appendChild(row);
            });
            
            console.log(`Column hierarchies rendered with ${headerRows.length} levels`);
            
        } catch (error) {
            console.error("❌ Alert! Error rendering column headers:", error);
            this.renderSimpleMeasureHeaders(elements, state.valueFields || ['COST_UNIT']);
        }
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
            console.warn(`⚠️ Warning: Element with ID '${id}' not found`);
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
        // For multi-dimension rows, use specialized handler
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
        if (state && state.expandedNodes) {
            const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : null;
            if (dimName && row.path && Array.isArray(row.path) && row.path.length > 1) {
                // For each ancestor, check if it's expanded in the state
                for (let i = 1; i < row.path.length - 1; i++) {
                    const ancestorId = row.path[i];
                    if (!ancestorId) continue;
                    
                    // Check if the ancestor is expanded in state safely
                    const isExpanded = state.expandedNodes[dimName] && 
                                        state.expandedNodes[dimName].row && 
                                        state.expandedNodes[dimName].row[ancestorId];
                    
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
    // renderRowCell: function(rowDef) {
    //     const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
    //     const level = rowDef.level || 0;
        
    //     // Add cell with data-level attribute for CSS styling to handle indentation
    //     let cellHtml = `<td class="hierarchy-cell" data-level="${level}">`;
        
    //     // Calculate indentation based on level
    //     const indentPixels = level * 16; // 16px per level
        
    //     // Add indent if needed
    //     if (indentPixels > 0) {
    //         cellHtml += `<span class="indent" style="width:${indentPixels}px;display:inline-block;"></span>`;
    //     }
        
    //     // Add expand/collapse control only if it has children
    //     if (rowDef.hasChildren === true) {
    //         const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
            
    //         cellHtml += `<span class="expand-collapse ${expandClass}" 
    //             data-node-id="${rowDef._id}" 
    //             data-hierarchy="${dimName}" 
    //             data-zone="row"
    //             onclick="handleExpandCollapseClick(event)"
    //             title="Expand/collapse this item"></span>`;
    //     } else {
    //         cellHtml += `<span class="leaf-node"></span>`;
    //     }
        
    //     // Add label with proper styling
    //     const fontWeight = level === 0 ? 'font-weight:600;' : '';
    //     cellHtml += `<span class="dimension-label" style="${fontWeight}">${rowDef.label || rowDef._id}</span>`;
    //     cellHtml += '</td>';
        
    //     return cellHtml;
    // },
    renderRowCell: function(rowDef) {
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
                onclick="handleExpandCollapseClick(event)"
                title="Expand/collapse this item"></span>`;
        } else {
            cellHtml += `<span class="leaf-node"></span>`;
        }
        
        // Add label with proper styling
        const fontWeight = level === 0 ? 'font-weight:600;' : '';
        cellHtml += `<span class="dimension-label" style="${fontWeight}">${rowDef.label || rowDef._id}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    renderCornerCell:function() {
        return `<th class="corner-cell" rowspan="2" style="width:350px !important; min-width:350px !important; box-sizing:border-box !important; padding:8px !important; border-right:1px solid #e2e8f0 !important; border-bottom:1px solid #e2e8f0 !important; background-color:#f8fafc !important;"></th>`;
    },

    // Function to apply immediate styling fix to existing pivot table
    // applyPivotTableFix: function() {
    //     console.log("Applying direct pivot table layout fix...");
        
    //     // 1. Ensure consistent cell heights
    //     const cells = document.querySelectorAll('.pivot-table-container th, .pivot-table-container td');
    //     cells.forEach(cell => {
    //         cell.style.height = '32px';
    //         cell.style.boxSizing = 'border-box';
    //         cell.style.margin = '0';
    //         cell.style.overflow = 'hidden';
    //     });
        
    //     // 2. Fix hierarchy cell width and styling
    //     const hierarchyCells = document.querySelectorAll('.hierarchy-cell');
    //     hierarchyCells.forEach(cell => {
    //         cell.style.width = "250px";
    //         cell.style.minWidth = "250px";
    //         cell.style.backgroundColor = "#f8fafc";
    //         cell.style.borderRight = "1px solid #cbd5e1";
    //     });
        
    //     // 3. Fix value cell alignment
    //     const valueCells = document.querySelectorAll('.value-cell');
    //     valueCells.forEach(cell => {
    //         cell.style.textAlign = "right";
    //         cell.style.paddingRight = "12px";
    //     });
        
    //     // 4. Ensure header stickiness
    //     const headerCells = document.querySelectorAll('th');
    //     headerCells.forEach(cell => {
    //         if (cell.classList.contains('corner-cell')) {
    //             cell.style.zIndex = '40';
    //         } else {
    //             cell.style.zIndex = '30';
    //         }
    //     });
        
    //     console.log("Direct style fixes applied to pivot table");
    // },
    applyPivotTableFix: function() {
        console.log("Applying improved pivot table styling");
        
        try {
            // 1. Improve alignment for all cells
            const cells = document.querySelectorAll('.pivot-table-container th, .pivot-table-container td');
            cells.forEach(cell => {
                cell.style.boxSizing = 'border-box';
                cell.style.margin = '0';
                cell.style.overflow = 'hidden';
            });
            
            // 2. Set specific heights for rows
            const rows = document.querySelectorAll('.pivot-table-container tr');
            rows.forEach(row => {
                row.style.height = '34px'; // Consistent height for all rows
            });
            
            // 3. Right-align value cells
            const valueCells = document.querySelectorAll('.value-cell');
            valueCells.forEach(cell => {
                cell.style.textAlign = 'right';
                cell.style.paddingRight = '12px';
            });
            
            // 4. Properly style zero values
            const zeroCells = document.querySelectorAll('.value-cell.zero-value');
            zeroCells.forEach(cell => {
                cell.style.color = '#94a3b8';
                cell.style.opacity = '0.7';
            });
            
            // 5. Highlight non-zero values for better readability
            const nonzeroCells = document.querySelectorAll('.value-cell.non-zero-value');
            nonzeroCells.forEach(cell => {
                cell.style.color = '#1e293b';
                cell.style.fontWeight = '500';
            });
            
            // 6. Add hover effect to rows
            rows.forEach(row => {
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = '#f1f5f9';
                });
                row.addEventListener('mouseleave', () => {
                    // Restore original background color based on even/odd
                    const isEven = Array.from(row.parentNode.children).indexOf(row) % 2 === 0;
                    row.style.backgroundColor = isEven ? '#ffffff' : '#f8fafc';
                });
            });
            
            // 7. Style hierarchy cells
            const hierarchyCells = document.querySelectorAll('.hierarchy-cell');
            hierarchyCells.forEach(cell => {
                cell.style.backgroundColor = '#f8fafc';
                cell.style.borderRight = '1px solid #cbd5e1';
            });
            
            // 8. Style column and measure headers
            const headers = document.querySelectorAll('.column-header, .measure-header');
            headers.forEach(header => {
                header.style.backgroundColor = '#f8fafc';
                header.style.borderBottom = '1px solid #cbd5e1';
                header.style.textAlign = 'center';
            });
            
            // 9. Better style for expand/collapse controls
            const controls = document.querySelectorAll('.expand-collapse');
            controls.forEach(control => {
                control.style.display = 'inline-flex';
                control.style.justifyContent = 'center';
                control.style.alignItems = 'center';
                control.style.width = '16px';
                control.style.height = '16px';
                control.style.borderRadius = '3px';
                control.style.marginRight = '6px';
                control.style.cursor = 'pointer';
            });
            
            console.log("Improved table styling applied");
        } catch (error) {
            console.error("Error applying style fixes:", error);
        }
    },


    /**
     * Renders hierarchical columns with proper expand/collapse controls
     * @param {Object} elements - DOM elements containing pivotTableHeader
     * @param {Object} pivotData - Pivot table data with columns structure
     */
    // renderHierarchicalColumns: function(elements, pivotData) {
    //     if (!elements || !elements.pivotTableHeader) {
    //         console.error("❌ Alert! Missing header element");
    //         return;
    //     }
        
    //     // CRITICAL: Add null check for pivotData
    //     if (!pivotData) {
    //         console.error("❌ Alert! pivotData is null or undefined");
    //         this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
    //         return;
    //     }
        
    //     try {
    //         // Clear existing header content
    //         elements.pivotTableHeader.innerHTML = '';
            
    //         // CRITICAL: Add null check for pivotData.columns
    //         if (!pivotData.columns) {
    //             console.error("❌ Alert! pivotData.columns is null or undefined");
    //             this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
    //             return;
    //         }
            
    //         // Get column field dimensions
    //         const hasColumnDimensions = pivotData.columns && 
    //                                 pivotData.columns.length > 0 && 
    //                                 pivotData.columns[0]._id !== 'default';
            
    //         // Get value/measure fields
    //         const valueFields = this.state.valueFields || ['COST_UNIT'];
            
    //         if (!hasColumnDimensions) {
    //             // Simple case - just measures, no column dimensions
    //             this.renderSimpleMeasureHeaders(elements, valueFields);
    //             return;
    //         }
            
    //         // Calculate total number of visible leaf columns - with null check
    //         const visibleLeafColumns = pivotData.columns ? this.getVisibleLeafColumns(pivotData.columns) : [];
    //         const columnCount = visibleLeafColumns.length;
            
    //         // Create a two-row structure for header
    //         const measureHeaderRow = document.createElement('tr');
    //         measureHeaderRow.className = 'measure-header-row';
            
    //         const dimensionHeaderRow = document.createElement('tr');
    //         dimensionHeaderRow.className = 'dimension-header-row';
            
    //         // Add the corner cell spanning both rows
    //         const cornerCell = document.createElement('th');
    //         cornerCell.className = 'corner-cell';
    //         cornerCell.rowSpan = 2; // Span both rows
            
    //         // Customize corner cell if needed for multi-dimensions
    //         if (this.state.rowFields && this.state.rowFields.length > 1) {
    //             cornerCell.classList.add('multi-dimension-corner');
                
    //             // Calculate total sticky cell width based on number of dimensions
    //             const dimensionCount = this.state.rowFields.length;
    //             const totalWidth = Math.min(dimensionCount * 250, 750) + 'px';
    //             cornerCell.style.width = totalWidth;
    //             cornerCell.setAttribute('data-dimension-count', dimensionCount);
    //         }
            
    //         measureHeaderRow.appendChild(cornerCell);
            
    //         // First, get the column field name to use as measure header
    //         const columnDimension = this.state.columnFields && this.state.columnFields.length > 0 
    //             ? this.state.columnFields[0] 
    //             : null;
                
    //         let columnFieldName = "COST";
            
    //         // If we have a column dimension, get its display name
    //         if (columnDimension) {
    //             // Get field from available fields
    //             const field = this.state.availableFields && this.state.availableFields.find(f => f.id === columnDimension);
    //             if (field) {
    //                 columnFieldName = field.label || "COST"; 
    //             }
    //         }
            
    //         // Add the measure header that spans all columns
    //         valueFields.forEach(fieldId => {
    //             const measureCell = document.createElement('th');
    //             measureCell.className = 'measure-header';
    //             measureCell.setAttribute('data-measure', fieldId);
                
    //             // Format display name - use the specific measure name (usually "COST")
    //             let displayName = fieldId;
    //             if (fieldId === 'COST_UNIT') displayName = 'COST';
    //             else if (fieldId === 'QTY_UNIT') displayName = 'QUANTITY';
                
    //             // Enhanced: Set to uppercase to match screenshot
    //             measureCell.textContent = displayName.toUpperCase();
                
    //             // Make it span all columns
    //             if (columnCount > 0) {
    //                 measureCell.colSpan = columnCount;
    //             }
                
    //             measureHeaderRow.appendChild(measureCell);
    //         });
            
    //         // Now process all leaf column dimension values
    //         if (visibleLeafColumns.length === 0) {
    //             console.warn("⚠️ Warning: No visible leaf columns found");
                
    //             // Add a default column header
    //             const placeholderCell = document.createElement('th');
    //             placeholderCell.className = 'column-header dimension-header';
    //             placeholderCell.textContent = 'Value';
    //             dimensionHeaderRow.appendChild(placeholderCell);
    //         } else {
    //             // Get the parent dimension name if available
    //             const firstColumn = visibleLeafColumns[0];
    //             let parentDimensionLabel = "ITEM COST TYPE"; // Default fallback
                
    //             if (firstColumn && firstColumn.hierarchyField) {
    //                 const dimField = firstColumn.hierarchyField;
    //                 // Look for a matching field in availableFields
    //                 const availField = this.state.availableFields && 
    //                     this.state.availableFields.find(f => f.id === dimField);
                        
    //                 if (availField) {
    //                     parentDimensionLabel = availField.label || parentDimensionLabel;
    //                 }
    //             }
                
    //             // Add a header cell for the parent dimension that spans all columns
    //             const parentDimHeader = document.createElement('th');
    //             parentDimHeader.className = 'column-header parent-dimension-header';
    //             parentDimHeader.colSpan = columnCount;
    //             parentDimHeader.textContent = parentDimensionLabel.toUpperCase();
    //             const parentHeaderRow = document.createElement('tr');
    //             parentHeaderRow.className = 'parent-dimension-row';
                
    //             // Add blank corner cell for parent dimension row
    //             const parentCornerCell = document.createElement('th');
    //             parentCornerCell.className = 'corner-cell';
    //             parentHeaderRow.appendChild(parentCornerCell);
    //             parentHeaderRow.appendChild(parentDimHeader);
                
    //             // Add the parent dimension row first
    //             elements.pivotTableHeader.appendChild(parentHeaderRow);
                
    //             // Now add individual dimension value cells
    //             visibleLeafColumns.forEach(column => {
    //                 // Skip if column is null or undefined
    //                 if (!column) return;
                    
    //                 const dimensionCell = document.createElement('th');
    //                 dimensionCell.className = 'column-header dimension-header';
    //                 dimensionCell.setAttribute('data-node-id', column._id || '');
                    
    //                 // Get dimension name if available
    //                 const dimName = column.hierarchyField ? 
    //                     column.hierarchyField.replace('DIM_', '').toLowerCase() : 
    //                     (column.hierarchyName || '');
                    
    //                 if (dimName) {
    //                     dimensionCell.setAttribute('data-hierarchy', dimName);
    //                 }
                    
    //                 // Add the dimension label
    //                 dimensionCell.textContent = column.label || '';
                    
    //                 dimensionHeaderRow.appendChild(dimensionCell);
    //             });
                
    //             // Modify the corner cell to span 3 rows instead of 2
    //             cornerCell.rowSpan = 3;
    //         }
            
    //         // Add rows to the header container - after the parent dimension row
    //         elements.pivotTableHeader.appendChild(measureHeaderRow);
    //         elements.pivotTableHeader.appendChild(dimensionHeaderRow);
            
    //         console.log(`Column headers rendered with improved structure`);
            
    //     } catch (error) {
    //         console.error("❌ Alert! Error rendering column headers:", error);
    //         // Fallback to simple headers in case of error
    //         this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
    //     }
    // },
    renderHierarchicalColumns: function(elements, pivotData) {
        if (!elements || !elements.pivotTableHeader) {
            console.error("❌ Alert! Missing header element");
            return;
        }
        
        try {
            // IMPORTANT: Add robust null checks for pivotData
            if (!pivotData) {
                console.error("❌ Alert! pivotData is null or undefined");
                this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
                return;
            }
            
            // Clear existing header content
            elements.pivotTableHeader.innerHTML = '';
            
            // IMPORTANT: Add robust null check for pivotData.columns
            if (!pivotData.columns) {
                console.error("❌ Alert! pivotData.columns is null or undefined");
                this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
                return;
            }
            
            // Get value fields and their display names
            const valueFields = this.state.valueFields || ['COST_UNIT'];
            const valueFieldDisplayNames = {};
            
            // Map field IDs to display names
            valueFields.forEach(fieldId => {
                // Try to get field label from available fields
                let displayName = fieldId;
                if (this.state && this.state.availableFields) {
                    const fieldDef = this.state.availableFields.find(f => f.id === fieldId);
                    if (fieldDef && fieldDef.label) {
                        displayName = fieldDef.label;
                    } else {
                        // Default formatting if not found
                        if (fieldId === 'COST_UNIT') displayName = 'Cost Unit';
                        else if (fieldId === 'QTY_UNIT') displayName = 'Quantity Unit';
                    }
                } else {
                    // Default formatting if no field definitions
                    if (fieldId === 'COST_UNIT') displayName = 'Cost Unit';
                    else if (fieldId === 'QTY_UNIT') displayName = 'Quantity Unit';
                }
                valueFieldDisplayNames[fieldId] = displayName;
            });
            
            // Get column dimensions and values - with additional safety checks
            const hasColumnDimensions = pivotData.columns && 
                                    Array.isArray(pivotData.columns) &&
                                    pivotData.columns.length > 0 && 
                                    pivotData.columns[0] && 
                                    pivotData.columns[0]._id !== 'default';
                                    
            // Get corner cell label from row fields
            let cornerCellText = 'Dimension';
            if (this.state && this.state.rowFields && this.state.rowFields.length > 0) {
                const firstRowField = this.state.rowFields[0];
                // Try to get a nice display name
                if (this.state.availableFields) {
                    const fieldDef = this.state.availableFields.find(f => f.id === firstRowField);
                    if (fieldDef && fieldDef.label) {
                        cornerCellText = fieldDef.label;
                    } else {
                        // Clean up the raw field ID
                        cornerCellText = firstRowField.replace('DIM_', '').replace(/_/g, ' ');
                    }
                } else {
                    // Clean up the raw field ID
                    cornerCellText = firstRowField.replace('DIM_', '').replace(/_/g, ' ');
                }
            }
            
            // If we don't have column dimensions, render simple header
            if (!hasColumnDimensions) {
                this.renderSimpleMeasureHeaders(elements, valueFields, valueFieldDisplayNames);
                return;
            }
            
            // Get visible leaf columns with safety checks
            let visibleColumns = [];
            try {
                visibleColumns = this.getVisibleLeafColumns(pivotData.columns) || [];
            } catch (err) {
                console.error("❌ Error getting visible leaf columns:", err);
                visibleColumns = pivotData.columns || []; // Fallback to all columns
            }
            
            // If no columns were found, fall back to simple header
            if (!visibleColumns || visibleColumns.length === 0) {
                console.warn("⚠️ No visible columns found, using simple header");
                this.renderSimpleMeasureHeaders(elements, valueFields, valueFieldDisplayNames);
                return;
            }
            
            // Determine column field name for display
            let columnFieldName = "Dimension";
            if (this.state && this.state.columnFields && this.state.columnFields.length > 0) {
                const columnField = this.state.columnFields[0];
                if (this.state.availableFields) {
                    const fieldDef = this.state.availableFields.find(f => f.id === columnField);
                    if (fieldDef && fieldDef.label) {
                        columnFieldName = fieldDef.label;
                    } else {
                        // Clean up the raw field ID
                        columnFieldName = columnField.replace('DIM_', '').replace(/_/g, ' ');
                    }
                } else {
                    // Clean up the raw field ID
                    columnFieldName = columnField.replace('DIM_', '').replace(/_/g, ' ');
                }
            }
            
            // Create a three-row header structure
            // Row 1: Measures header
            const measuresRow = document.createElement('tr');
            measuresRow.className = 'measures-header-row';
            
            // Add corner cell that spans all three rows
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            cornerCell.rowSpan = 3; // Span all three header rows
            cornerCell.textContent = cornerCellText;
            measuresRow.appendChild(cornerCell);
            
            // Add "Measures" header that spans all value columns
            const measuresHeader = document.createElement('th');
            measuresHeader.className = 'parent-dimension-header';
            measuresHeader.colSpan = visibleColumns.length * valueFields.length;
            measuresHeader.textContent = 'Measures';
            measuresRow.appendChild(measuresHeader);
            
            // Row 2: Measure types (Cost Unit, Quantity Unit)
            const measureRow = document.createElement('tr');
            measureRow.className = 'measure-header-row';
            
            // Add measure headers
            valueFields.forEach(fieldId => {
                const header = document.createElement('th');
                header.className = 'measure-header';
                header.colSpan = visibleColumns.length;
                header.textContent = valueFieldDisplayNames[fieldId];
                header.setAttribute('data-measure', fieldId);
                measureRow.appendChild(header);
            });
            
            // Row 3: Dimension value headers
            const dimensionRow = document.createElement('tr');
            dimensionRow.className = 'dimension-header-row';
            
            // Add a header for each value in each measure
            valueFields.forEach(fieldId => {
                visibleColumns.forEach(column => {
                    const header = document.createElement('th');
                    header.className = 'column-header dimension-header';
                    header.textContent = column.label || '';
                    header.setAttribute('data-node-id', column._id || '');
                    header.setAttribute('data-measure', fieldId);
                    
                    // Add hierarchy info if available
                    if (column.hierarchyField) {
                        const dimName = column.hierarchyField.replace('DIM_', '').toLowerCase();
                        header.setAttribute('data-hierarchy', dimName);
                    }
                    
                    dimensionRow.appendChild(header);
                });
            });
            
            // Add all rows to the header
            elements.pivotTableHeader.appendChild(measuresRow);
            elements.pivotTableHeader.appendChild(measureRow);
            elements.pivotTableHeader.appendChild(dimensionRow);
            
            console.log("Three-tier header structure rendered successfully");
            
        } catch (error) {
            console.error("❌ Alert! Error rendering column headers:", error);
            // Fallback to simple headers in case of error
            this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
        }
    },


    countVisibleLeafColumns: function(columns) {
        if (!columns || !Array.isArray(columns)) {
            return 0;
        }
        
        // Process each column to count visible leaf columns
        let count = 0;
        
        // Helper function to process a column and its descendants
        const processColumn = (column) => {
            if (!column) return;
            
            // Skip columns marked to be hidden
            if (column.skipInUI) return;
            
            // If it's a leaf node, count it
            if (column.isLeaf) {
                count++;
                return;
            }
            
            // If it's not expanded, count it as one leaf
            if (!column.expanded) {
                count++;
                return;
            }
            
            // If it has children and is expanded, process each child
            if (column.children && column.children.length > 0) {
                const childNodes = this.getChildNodes(column);
                childNodes.forEach(child => {
                    processColumn(child);
                });
            } else {
                // No children, count as a leaf
                count++;
            }
        };
        
        // Process all top-level columns
        columns.forEach(column => {
            processColumn(column);
        });
        
        return Math.max(1, count); // At least 1
    },


    /**
     * Analyze if columns represent a flat dimension (no hierarchy)
     * @param {Array} columns - The column data
     * @returns {boolean} - True if columns are flat/non-hierarchical
     */
    areColumnsDimensionallyFlat: function(columns) {
        if (!columns || columns.length === 0) return true;
        
        // Calculate maximum depth to determine if it's a shallow hierarchy
        let maxDepth = 0;
        
        const calculateDepth = (node, currentDepth) => {
            maxDepth = Math.max(maxDepth, currentDepth);
            
            // Only recurse if node is expanded and has children
            if (node.expanded && node.children && node.children.length > 0) {
                // Get child nodes and process them
                const childNodes = this.getChildNodes(node);
                childNodes.forEach(child => {
                    if (child) {
                        calculateDepth(child, currentDepth + 1);
                    }
                });
            }
        };
        
        // Process all columns
        columns.forEach(col => {
            if (col) {
                calculateDepth(col, 0);
            }
        });
        
        // Check if any columns have children and are expanded
        const hasExpandedHierarchy = columns.some(col => 
            col && col.children && col.children.length > 0 && col.expanded
        );
        
        // Consider it flat if:
        // 1. No expanded hierarchies, OR
        // 2. The max depth is 1 or less (only one level of hierarchy)
        return !hasExpandedHierarchy || maxDepth <= 1;
    },

    
    processHierarchicalColumns: function(columns, headerRows, level, valueFields) {
        if (!columns || columns.length === 0 || !headerRows || level >= headerRows.length) {
            return;
        }
        
        const isLastLevel = level === headerRows.length - 1;
        
        // Process each column at this level
        columns.forEach(column => {
            // Skip undefined/null columns
            if (!column) return;
            
            // Create column header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            
            // Add cell classification
            if (column.isLeaf) cell.classList.add('leaf-node');
            if (column.children && column.children.length > 0) cell.classList.add('has-children');
            
            // Add data attributes
            cell.setAttribute('data-node-id', column._id);
            cell.setAttribute('data-level', level);
            
            // Add hierarchy info if available
            const dimName = column.hierarchyField ? 
                column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                (column.hierarchyName || '');
            
            if (dimName) {
                cell.setAttribute('data-hierarchy', dimName);
            }
            
            // Calculate colspan - either based on measures or child columns
            let colspan = 1;
            
            if (column.isLeaf || !column.expanded || !column.children || column.children.length === 0) {
                // Leaf nodes or collapsed parents need to span all measures
                colspan = valueFields.length;
                
                // Also calculate rowspan if not at the last level
                if (!isLastLevel) {
                    const remainingRows = headerRows.length - level - 1;
                    if (remainingRows > 0) {
                        cell.rowSpan = remainingRows;
                    }
                }
            } else if (column.expanded && column.children && column.children.length > 0) {
                // Expanded parents - calculate colspan based on visible descendants
                const leafCount = this.countVisibleLeafNodes(column);
                colspan = leafCount * valueFields.length;
            }
            
            // Set colspan if greater than 1
            if (colspan > 1) {
                cell.colSpan = colspan;
            }
            
            // Add expand/collapse control if column has children
            if (column.children && column.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = `expand-collapse ${column.expanded ? 'expanded' : 'collapsed'}`;
                expandControl.setAttribute('data-node-id', column._id);
                expandControl.setAttribute('data-hierarchy', dimName);
                expandControl.setAttribute('data-zone', 'column');
                expandControl.setAttribute('onclick', 'handleExpandCollapseClick(event)');
                
                cell.appendChild(expandControl);
            }
            
            // Add column label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'column-label';
            labelSpan.textContent = column.label || '';
            cell.appendChild(labelSpan);
            
            // Add cell to the current row
            headerRows[level].appendChild(cell);
            
            // If at the last level and measures should be shown below dimension values,
            // add measure headers
            if (isLastLevel && 
            (column.isLeaf || !column.expanded || !column.children || column.children.length === 0) &&
            valueFields.length > 1) {
                
                // Show measures in separate row
                valueFields.forEach(fieldId => {
                    const measureCell = document.createElement('th');
                    measureCell.className = 'measure-header';
                    
                    // Format measure name
                    let displayName = fieldId;
                    if (fieldId === 'COST_UNIT') displayName = 'Cost';
                    else if (fieldId === 'QTY_UNIT') displayName = 'Qty';
                    
                    measureCell.textContent = displayName;
                    headerRows[level].appendChild(measureCell);
                });
            }
            
            // Process children if expanded
            if (column.expanded && column.children && column.children.length > 0) {
                const childNodes = this.getChildNodes(column);
                this.processHierarchicalColumns(childNodes, headerRows, level + 1, valueFields);
            }
        });
    },


    /**
     * Render simple measure headers when no column hierarchies are present
     */
    // renderSimpleMeasureHeaders: function(elements, valueFields) {
    //     const headerRow = document.createElement('tr');
    //     headerRow.className = 'measure-header-row';
        
    //     // Add corner cell
    //     const cornerCell = document.createElement('th');
    //     cornerCell.className = 'corner-cell';
    //     cornerCell.textContent = ''; // Can add a label if desired
    //     headerRow.appendChild(cornerCell);
        
    //     // Add measure headers
    //     valueFields.forEach(fieldId => {
    //         const measureCell = document.createElement('th');
    //         measureCell.className = 'measure-header';
    //         measureCell.setAttribute('data-measure', fieldId);
            
    //         // Format display name
    //         let displayName = fieldId;
    //         if (fieldId === 'COST_UNIT') displayName = 'Cost Unit';
    //         else if (fieldId === 'QTY_UNIT') displayName = 'Quantity Unit';
            
    //         measureCell.textContent = displayName;
    //         headerRow.appendChild(measureCell);
    //     });
        
    //     // Add to container
    //     elements.pivotTableHeader.appendChild(headerRow);
    // },
    renderSimpleMeasureHeaders: function(elements, valueFields, displayNames = null) {
        if (!elements || !elements.pivotTableHeader) {
            console.error("❌ Missing header element in renderSimpleMeasureHeaders");
            return;
        }
        
        try {
            const headerRow = document.createElement('tr');
            headerRow.className = 'measure-header-row';
            
            // Add corner cell
            const cornerCell = document.createElement('th');
            cornerCell.className = 'corner-cell';
            cornerCell.textContent = ''; // Can add a label if desired
            headerRow.appendChild(cornerCell);
            
            // Safety check for valueFields
            if (!valueFields || !Array.isArray(valueFields) || valueFields.length === 0) {
                valueFields = ['COST_UNIT']; // Default value
            }
            
            // Add measure headers
            valueFields.forEach(fieldId => {
                const measureCell = document.createElement('th');
                measureCell.className = 'measure-header';
                measureCell.setAttribute('data-measure', fieldId);
                
                // Use provided display name or format from fieldId
                let displayName;
                if (displayNames && displayNames[fieldId]) {
                    displayName = displayNames[fieldId];
                } else {
                    // Format display name
                    displayName = fieldId;
                    if (fieldId === 'COST_UNIT') displayName = 'Cost Unit';
                    else if (fieldId === 'QTY_UNIT') displayName = 'Quantity Unit';
                }
                
                measureCell.textContent = displayName;
                headerRow.appendChild(measureCell);
            });
            
            // Clear existing content and add new header row
            elements.pivotTableHeader.innerHTML = '';
            elements.pivotTableHeader.appendChild(headerRow);
            
        } catch (error) {
            console.error("❌ Error in renderSimpleMeasureHeaders:", error);
            // Create a minimal header as last resort
            elements.pivotTableHeader.innerHTML = '<tr><th class="corner-cell"></th><th class="measure-header">Value</th></tr>';
        }
    },


    /**
     * Get maximum depth of column hierarchy
     */
    getMaxColumnHierarchyDepth: function(columns) {
        let maxDepth = 0;
        
        const traverseNode = (node, currentDepth) => {
            maxDepth = Math.max(maxDepth, currentDepth);
            
            // Only recurse if node is expanded and has children
            if (node.expanded && node.children && node.children.length > 0) {
                const childNodes = getChildNodes(node);
                childNodes.forEach(child => {
                    traverseNode(child, currentDepth + 1);
                });
            }
        };
        
        // Start with each top-level column
        columns.forEach(col => {
            traverseNode(col, 0);
        });
        
        return maxDepth;
    },


    /**
     * Improved detection of simple/flat hierarchies
     * 
     * @param {Array} columns - Column data
     * @returns {Boolean} - True if columns represent a simple/flat hierarchy
     */
    isSimpleHierarchy: function(columns) {
        if (!columns || columns.length === 0) return true;
        
        // Function to check if a node is part of a simple hierarchy
        const isSimpleNode = (node) => {
            // If it's a leaf node or has no children, it's simple by definition
            if (node.isLeaf || !node.children || node.children.length === 0) {
                return true;
            }
            
            // If node is not expanded, treat it as simple for rendering purposes
            if (!node.expanded) {
                return true;
            }
            
            // Get dimension name
            let dimName = '';
            if (node.hierarchyField) {
                dimName = node.hierarchyField.replace('DIM_', '').toLowerCase();
            } else if (node.hierarchyName) {
                dimName = node.hierarchyName;
            }
            
            // Get child nodes
            const childNodes = node.children.map(childId => {
                if (typeof childId === 'string') {
                    // Look up in hierarchies
                    return this.state.hierarchies?.[dimName]?.nodesMap?.[childId];
                }
                return childId;
            }).filter(Boolean);
            
            // Check if all children are leaf nodes (characteristic of simple hierarchy)
            return childNodes.every(child => child.isLeaf || !child.children || child.children.length === 0);
        };
        
        // Check all top-level columns
        return columns.every(isSimpleNode);
    },


    /**
     * Get actual child node objects from parent node
     */
    getChildNodes: function(parentNode) {
        if (!parentNode) return [];
        if (!parentNode.children || !Array.isArray(parentNode.children) || parentNode.children.length === 0) {
            return [];
        }
        
        try {
            return parentNode.children.map(childId => {
                if (typeof childId === 'object') {
                    return childId; // Already a node object
                }
                
                if (typeof childId !== 'string') {
                    return null; // Invalid child ID
                }
                
                // Try to find node in hierarchies
                const dimName = (parentNode.hierarchyField ? 
                    parentNode.hierarchyField.replace('DIM_', '').toLowerCase() : 
                    (parentNode.hierarchyName || ''));
                
                if (!dimName || !this.state || !this.state.hierarchies || !this.state.hierarchies[dimName]) {
                    return null;
                }
                
                return this.state.hierarchies[dimName].nodesMap?.[childId] || null;
            }).filter(Boolean); // Remove nulls
        } catch (error) {
            console.error("❌ Error in getChildNodes:", error);
            return [];
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
    processColumnHierarchy:function(columns, headerRows, level, valueFields) {
        if (!columns || columns.length === 0 || !headerRows[level]) return;
        
        // Get if we're at the last level
        const isLastLevel = level === headerRows.length - 1;
        
        // Process each column at this level
        columns.forEach(column => {
            // Skip invalid columns
            if (!column) return;
            
            // Create column header cell
            const cell = document.createElement('th');
            cell.className = 'column-header';
            
            // Add cell classification
            if (column.isLeaf) cell.classList.add('leaf-node');
            if (column.children && column.children.length > 0) cell.classList.add('has-children');
            
            // Add data attributes for styling and behavior
            cell.setAttribute('data-node-id', column._id);
            cell.setAttribute('data-level', level);
            
            // Add hierarchy info if available
            const dimName = column.hierarchyField ? 
                column.hierarchyField.replace('DIM_', '').toLowerCase() : 
                (column.hierarchyName || '');
            
            if (dimName) {
                cell.setAttribute('data-hierarchy', dimName);
            }
            
            // Calculate colspan - how many leaf nodes underneath
            let colspan = 1;
            
            if (column.isLeaf || !column.expanded || !column.children || column.children.length === 0) {
                // Leaf nodes or collapsed parents need to span all measures
                colspan = valueFields.length;
                
                // Also calculate rowspan if not at the last level
                if (!isLastLevel) {
                    const remainingRows = headerRows.length - level - 1;
                    if (remainingRows > 0) {
                        cell.rowSpan = remainingRows;
                    }
                }
            } else if (column.expanded && column.children && column.children.length > 0) {
                // Expanded parents - calculate colspan based on visible descendants
                const leafCount = countLeafNodes(column);
                colspan = leafCount * valueFields.length;
            }
            
            // Set colspan if greater than 1
            if (colspan > 1) {
                cell.colSpan = colspan;
            }
            
            // Add expand/collapse control if column has children
            if (column.children && column.children.length > 0) {
                const expandControl = document.createElement('span');
                expandControl.className = `expand-collapse ${column.expanded ? 'expanded' : 'collapsed'}`;
                expandControl.setAttribute('data-node-id', column._id);
                expandControl.setAttribute('data-hierarchy', dimName);
                expandControl.setAttribute('data-zone', 'column');
                expandControl.setAttribute('onclick', 'handleExpandCollapseClick(event)');
                
                cell.appendChild(expandControl);
            }
            
            // Add column label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'column-label';
            labelSpan.textContent = column.label || '';
            cell.appendChild(labelSpan);
            
            // Add cell to the current row
            headerRows[level].appendChild(cell);
            
            // If at the last level and measures should be shown below dimension values,
            // add measure headers
            if (isLastLevel && 
                (column.isLeaf || !column.expanded || !column.children || column.children.length === 0)) {
                
                // Add measure headers for this leaf column
                valueFields.forEach(fieldId => {
                    const measureCell = document.createElement('th');
                    measureCell.className = 'measure-header';
                    measureCell.setAttribute('data-measure', fieldId);
                    measureCell.setAttribute('data-column-id', column._id);
                    
                    // Format display name
                    let displayName = fieldId;
                    if (fieldId === 'COST_UNIT') displayName = 'Cost';
                    else if (fieldId === 'QTY_UNIT') displayName = 'Qty';
                    
                    measureCell.textContent = displayName;
                    headerRows[level].appendChild(measureCell);
                });
            }
            
            // Process children if expanded
            if (column.expanded && column.children && column.children.length > 0) {
                const childNodes = getChildNodes(column);
                processColumnHierarchy(childNodes, headerRows, level + 1, valueFields);
            }
        });
    },


    // Function to calculate pivot cells with column dimensions
    calculatePivotCellsWithColumns:function() {
        const pivotData = state.pivotData;
        const factData = state.factData || [];
        const valueFields = state.valueFields || [];
        const useMultiDimension = pivotData.useMultiDimension;
        
        if (!pivotData || !pivotData.rows) {
            console.error("❌ Alert! Invalid pivot data structure");
            return;
        }
        
        console.log(`Calculating pivot cells with ${factData.length} fact records`);
        
        // Get visible leaf columns to calculate values for
        const visibleLeafColumns = this.getVisibleLeafColumns(pivotData.columns);
        
        // For each row
        pivotData.rows.forEach(rowDef => {
            // Create a data object for this row
            const rowData = { _id: rowDef._id };
            
            // Calculate row totals - these will be displayed when no column dimensions
            valueFields.forEach(fieldId => {
                // Use appropriate filtering based on row type
                const totalValue = useMultiDimension
                    ? this.calculateMeasureMultiDim(factData, rowDef, null, fieldId)
                    : this.calculateMeasure(factData, rowDef, null, fieldId);
                    
                rowData[fieldId] = totalValue;
            });
            
            // For each visible leaf column
            visibleLeafColumns.forEach(colDef => {
                // For each value field
                valueFields.forEach(fieldId => {
                    // Calculate the value at this intersection
                    const value = useMultiDimension
                        ? this.calculateMeasureMultiDim(factData, rowDef, colDef, fieldId)
                        : this.calculateMeasure(factData, rowDef, colDef, fieldId);
                        
                    // Store with column ID and field ID
                    const key = `${colDef._id}|${fieldId}`;
                    rowData[key] = value;
                });
            });
            
            // Add row data to pivot data
            pivotData.data.push(rowData);
        });
    },


    /**
     * Count visible leaf nodes under a column node
     */
    countVisibleLeafNodes: function(node) {
        if (!node) return 0;
        
        // If node is a leaf, count as 1
        if (node.isLeaf) return 1;
        
        // If node is not expanded, treat as 1 leaf for display
        if (!node.expanded) return 1;
        
        // If node has no children, count as 1
        if (!node.children || node.children.length === 0) return 1;
        
        // For expanded nodes with children, count leaves in all child branches
        let count = 0;
        const childNodes = this.getChildNodes(node);
        
        childNodes.forEach(child => {
            count += this.countVisibleLeafNodes(child);
        });
        
        // Return at least 1 even if no children found
        return Math.max(1, count);
    },


    renderTableBody:function(elements, useMultiDimension) {
        console.log("Rendering table body with multiple measures");
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        // Get value fields
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // Filter rows based on visibility
        const visibleRows = this.getVisibleRows(pivotData.rows);
        
        // Build HTML for table body
        let bodyHtml = '';
        
        // Render each visible row
        visibleRows.forEach((rowDef, rowIndex) => {
            const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
            const rowClass = rowIndex % 2 === 0 ? 'even' : 'odd';
            
            // Start row
            bodyHtml += `<tr class="${rowClass}" data-row-id="${rowDef._id}">`;
            
            // Hierarchy cell with proper indentation and expand/collapse controls
            if (useMultiDimension) {
                bodyHtml += multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
            } else {
                bodyHtml += this.renderRowCell(rowDef);
            }
            
            // Render values for each measure
            valueFields.forEach(fieldId => {
                // Get the value for this measure
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
                const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell zero-value';
                
                // Add value cell
                bodyHtml += `<td class="${cellClass}" data-raw-value="${value}" data-measure="${fieldId}">${formattedValue}</td>`;
            });
            
            // End row
            bodyHtml += '</tr>';
        });
        
        // Set the HTML content
        if (elements && elements.pivotTableBody) {
            elements.pivotTableBody.innerHTML = bodyHtml;
            console.log(`Rendered table body with ${visibleRows.length} rows`);
        } else {
            console.error("Cannot set table body HTML - element not found");
        }
    },


    /**
     * Get visible rows based on hierarchy expansion state
     */
    getVisibleRows: function(rows) {
        if (!rows || !Array.isArray(rows)) return [];
        
        const visibleRows = [];
        
        rows.forEach(row => {
            if (this.isNodeVisible(row, rows)) {
                visibleRows.push(row);
            }
        });
        
        return visibleRows;
    },


    renderStandardTable: function(elements, useMultiDimension) {
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        console.log("✅ Status: Rendering standard table with data");
        
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
        console.log(`✅ Status: Row data for ${rowDef.label}:`, dataRow);
        
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


    /**
     * Processes pivot data with improved error handling
     */
    processPivotData: function() {
        // Safety check for fact data
        if (!this.state.factData || !Array.isArray(this.state.factData) || this.state.factData.length === 0) {
            console.warn("⚠️ Warning: No fact data available for pivot table");
            // Create empty pivot data structure
            this.state.pivotData = {
                rows: [],
                columns: [],
                data: [],
                useMultiDimension: false
            };
            return;
        }
        
        try {
            // Process rows and columns
            let rowFields = this.state.rowFields || [];
            let columnFields = this.state.columnFields || [];
            let valueFields = this.state.valueFields || [];
            
            // Validate we have at least some fields
            if (valueFields.length === 0) {
                console.warn("⚠️ Warning: No value fields specified, defaulting to COST_UNIT");
                valueFields = ['COST_UNIT'];
                this.state.valueFields = valueFields;
            }
            
            // Detect if we need multi-dimension row processing
            const useMultiDimension = rowFields.length > 1;
            
            // Process data only if minimum requirements are met
            if (valueFields.length > 0 && (rowFields.length > 0 || columnFields.length > 0)) {
                // Process row data or use empty array if error
                let rowData;
                try {
                    rowData = useMultiDimension 
                        ? window.multiDimensionPivotHandler.processMultiDimensionRows(rowFields)
                        : data.processHierarchicalFields(rowFields, 'row');
                } catch (error) {
                    console.error("❌ Error processing row data:", error);
                    rowData = { flatRows: [], flatMappings: [] };
                }
                
                // Process column data or use default if error
                let columnData;
                try {
                    columnData = columnFields.length > 0 
                        ? data.processHierarchicalFields(columnFields, 'column') 
                        : { flatRows: [{ _id: 'default', label: 'Value' }], flatMappings: [] };
                } catch (error) {
                    console.error("❌ Error processing column data:", error);
                    columnData = { flatRows: [{ _id: 'default', label: 'Value' }], flatMappings: [] };
                }
                
                // Prepare the pivot data structure
                this.state.pivotData = {
                    rows: rowData.flatRows || [],
                    rowMappings: rowData.flatMappings || [],
                    columns: columnData.flatRows || [],
                    columnMappings: columnData.flatMappings || [],
                    data: [], // Will be populated with cell values
                    useMultiDimension: useMultiDimension
                };
                
                // Calculate cell values with error handling
                try {
                    this.calculatePivotCells();
                } catch (error) {
                    console.error("❌ Error calculating pivot cells:", error);
                }
            } else {
                // Not enough fields specified
                console.warn("⚠️ Warning: Not enough fields specified for pivot table");
                this.state.pivotData = {
                    rows: [],
                    columns: [],
                    data: [],
                    useMultiDimension: false
                };
            }
        } catch (error) {
            console.error("❌ Alert! Error in processPivotData:", error);
            // Create empty data structure as fallback
            this.state.pivotData = {
                rows: [],
                columns: [],
                data: [],
                useMultiDimension: false
            };
        }
    },


    /**
     * Calculates pivot cells properly accounting for hierarchical columns
     */
    calculatePivotCells: function() {
        const pivotData = this.state.pivotData;
        const factData = this.state.factData || [];
        const valueFields = this.state.valueFields || [];
        const useMultiDimension = pivotData.useMultiDimension;
        
        if (!pivotData || !pivotData.rows) {
            console.error("❌ Alert! Invalid pivot data structure");
            return;
        }
        
        // Get visible leaf columns to calculate values for
        const visibleLeafColumns = this.getVisibleLeafColumns(pivotData.columns);
        
        // Debug column structure before calculating
        console.log(`Calculating pivot cells with ${visibleLeafColumns.length} visible leaf columns`);
        visibleLeafColumns.forEach(col => {
            console.log(`Column: ${col._id} (${col.label})`);
        });
        
        // For each row
        pivotData.rows.forEach(rowDef => {
            // Create a data object for this row
            const rowData = { _id: rowDef._id };
            
            // Calculate row totals - these will be displayed when no column dimensions
            valueFields.forEach(fieldId => {
                // Use appropriate filtering based on row type
                const totalValue = useMultiDimension
                    ? this.calculateMeasureMultiDim(factData, rowDef, null, fieldId)
                    : this.calculateMeasure(factData, rowDef, null, fieldId);
                    
                rowData[fieldId] = totalValue;
                
                // Debug row totals
                console.log(`Row total for ${rowDef._id} (${fieldId}): ${totalValue.toFixed(2)}`);
            });
            
            // For each visible leaf column
            visibleLeafColumns.forEach(colDef => {
                // For each value field
                valueFields.forEach(fieldId => {
                    // Calculate the value at this intersection
                    const value = useMultiDimension
                        ? this.calculateMeasureMultiDim(factData, rowDef, colDef, fieldId)
                        : this.calculateMeasure(factData, rowDef, colDef, fieldId);
                        
                    // Store with column ID and field ID
                    const key = `${colDef._id}|${fieldId}`;
                    rowData[key] = value;
                    
                    // Validate that column values add up to the total (debugging)
                    if (colDef._id.includes('ITEM_COST_TYPE')) {
                        console.log(`  - ${colDef.label || colDef._id}: ${value.toFixed(2)}`);
                    }
                });
            });
            
            // Add row data to pivot data
            pivotData.data.push(rowData);
        });
    },


    /**
     * Gets all leaf descendants of a node recursively
     * 
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
     * Enhanced generatePivotTable function with robust error handling
     * @param {Object} elements - DOM elements for the table
     */
    generatePivotTable: function(elements) {
        console.log("✅ Status: Starting pivot table generation with measure header...");
        
        try {
            // Get DOM elements if not provided
            if (!elements) {
                elements = {
                    pivotTableHeader: document.getElementById('pivotTableHeader'),
                    pivotTableBody: document.getElementById('pivotTableBody')
                };
            }
            
            // Safety checks
            if (!elements.pivotTableHeader || !elements.pivotTableBody) {
                console.error("❌ Alert! Required pivot table elements not found in DOM");
                return;
            }
            
            // Process pivot data with error handling
            try {
                this.processPivotData();
            } catch (error) {
                console.error("❌ Error processing pivot data:", error);
                // Create an empty pivot data structure as fallback
                this.state.pivotData = {
                    rows: [],
                    columns: [],
                    data: [],
                    useMultiDimension: false
                };
            }
            
            // Verify pivotData exists after processing
            if (!this.state.pivotData) {
                console.error("❌ Alert! pivotData is null after processing");
                this.state.pivotData = {
                    rows: [],
                    columns: [],
                    data: [],
                    useMultiDimension: false
                };
            }
            
            // Check if we have multiple row dimensions
            const useMultiDimension = this.state.rowFields && this.state.rowFields.length > 1;
            
            // Render header with error handling
            try {
                this.renderHierarchicalColumns(elements, this.state.pivotData);
            } catch (error) {
                console.error("❌ Error rendering column headers:", error);
                this.renderSimpleMeasureHeaders(elements, this.state.valueFields || ['COST_UNIT']);
            }
            
            // Render table body with error handling
            try {
                this.renderTableBodyWithMeasureHeader(elements, useMultiDimension);
            } catch (error) {
                console.error("❌ Error rendering table body:", error);
                elements.pivotTableBody.innerHTML = '<tr><td>Error rendering table body. Please check console for details.</td></tr>';
            }
            
            // Apply styling fixes with error handling
            try {
                this.applyPivotTableFix();
            } catch (error) {
                console.error("❌ Error applying style fixes:", error);
            }
            
            console.log("✅ Status: Pivot table generation complete");
            
        } catch (error) {
            console.error("❌ Alert! Error in pivot table generation:", error);
            // Create minimal working table as fallback
            if (elements && elements.pivotTableHeader) {
                elements.pivotTableHeader.innerHTML = '<tr><th>Data</th><th>Value</th></tr>';
            }
            if (elements && elements.pivotTableBody) {
                elements.pivotTableBody.innerHTML = '<tr><td colspan="2">Error generating pivot table. Please check console logs for details.</td></tr>';
            }
        }
    },


    // Helper to render body with simplified column handling
    renderTableBodyWithMeasureHeader: function(elements, useMultiDimension) {
        console.log("Rendering table body with improved formatting");
        const pivotData = this.state.pivotData;
        if (!pivotData) return;
        
        // Get value fields
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        // Filter rows based on visibility
        const visibleRows = this.getVisibleRows(pivotData.rows);
        
        // Get visible leaf columns
        const visibleColumns = this.getVisibleLeafColumns(pivotData.columns);
        
        // Build HTML for table body
        let bodyHtml = '';
        
        // Render each visible row
        visibleRows.forEach((rowDef, rowIndex) => {
            const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
            const rowClass = rowIndex % 2 === 0 ? 'even' : 'odd';
            
            // Add data attributes for filtering and styling
            let rowAttrs = `class="${rowClass}" data-row-id="${rowDef._id}"`;
            
            // Add level attribute if available
            if (rowDef.level !== undefined) {
                rowAttrs += ` data-level="${rowDef.level}"`;
            }
            
            // Add parent attribute if available
            if (rowDef.parentId) {
                rowAttrs += ` data-parent-id="${rowDef.parentId}"`;
            }
            
            // Start row
            bodyHtml += `<tr ${rowAttrs}>`;
            
            // Hierarchy cell with proper indentation and expand/collapse controls
            if (useMultiDimension) {
                bodyHtml += window.multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
            } else {
                bodyHtml += this.renderRowCell(rowDef);
            }
            
            // If we have column dimensions, render cell for each column and measure
            if (visibleColumns.length > 0) {
                // Loop through each value field
                valueFields.forEach(fieldId => {
                    // Loop through each visible column
                    visibleColumns.forEach(column => {
                        // Get value from row data using column ID and field
                        const key = `${column._id}|${fieldId}`;
                        
                        // Get value from row data
                        let value = 0;
                        if (rowData[key] !== undefined) {
                            value = typeof rowData[key] === 'number' ? 
                                    rowData[key] : parseFloat(rowData[key]);
                            if (isNaN(value)) value = 0;
                        }
                        
                        // Enhanced number formatting
                        let formattedValue = this.formatValue(value);
                        
                        // Add cell class based on value - for better zero handling
                        const isZero = Math.abs(value) < 0.001; // Account for floating point imprecision
                        const cellClass = isZero ? 'value-cell zero-value' : 'value-cell non-zero-value';
                        
                        // Add data attributes for filtering and sorting
                        bodyHtml += `<td class="${cellClass}" 
                                    data-raw-value="${value}" 
                                    data-measure="${fieldId}"
                                    data-column-id="${column._id}">${formattedValue}</td>`;
                    });
                });
            } else {
                // Simple case - just render measures
                valueFields.forEach(fieldId => {
                    // Get measure value directly
                    let value = 0;
                    if (rowData[fieldId] !== undefined) {
                        value = typeof rowData[fieldId] === 'number' ? 
                                rowData[fieldId] : parseFloat(rowData[fieldId]);
                        if (isNaN(value)) value = 0;
                    }
                    
                    // Format value
                    let formattedValue = this.formatValue(value);
                    
                    // Add cell class based on value - better zero handling
                    const isZero = Math.abs(value) < 0.001;
                    const cellClass = isZero ? 'value-cell zero-value' : 'value-cell non-zero-value';
                    
                    // Add the cell
                    bodyHtml += `<td class="${cellClass}" 
                                data-raw-value="${value}" 
                                data-measure="${fieldId}">${formattedValue}</td>`;
                });
            }
            
            // End row
            bodyHtml += '</tr>';
        });
        
        // Set the HTML content
        if (elements && elements.pivotTableBody) {
            elements.pivotTableBody.innerHTML = bodyHtml;
            console.log(`Rendered table body with ${visibleRows.length} rows`);
        } else {
            console.error("Cannot set table body HTML - element not found");
        }
    },



    // Helper for better number formatting
    // formatNumberWithCommas: function(number) {
    //     return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // },
    formatNumberWithCommas: function(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },


    // Helper for attaching expand/collapse handlers
    attachExpandCollapseHandlers: function(tableBody) {
        if (!tableBody) return;
        
        setTimeout(() => {
            const controls = tableBody.querySelectorAll('.expand-collapse');
            controls.forEach(control => {
                // Clear any existing handlers
                const newControl = control.cloneNode(true);
                control.parentNode.replaceChild(newControl, control);
                
                // Add the correct handler based on whether it's multi-dimension
                if (newControl.hasAttribute('data-dimension-index')) {
                    newControl.addEventListener('click', (e) => {
                        window.handleMultiDimensionExpandCollapseClick(e);
                    });
                } else {
                    newControl.addEventListener('click', (e) => {
                        window.handleExpandCollapseClick(e);
                    });
                }
            });
        }, 100);
    },


    // Render the table body with hierarchical rows and column values
    renderHierarchicalBody:function(elements, useMultiDimension) {
        console.log("Rendering hierarchical table body - useMultiDimension:", useMultiDimension);
        const pivotData = state.pivotData;
        if (!pivotData) return;
        
        // Get value fields
        const valueFields = state.valueFields || ['COST_UNIT'];
        
        // Get visible rows based on expansion state
        const visibleRows = this.getVisibleRows(pivotData.rows);
        console.log(`Found ${visibleRows.length} visible rows`);
        
        // Check if we have column hierarchies
        const hasColumnHierarchy = pivotData.columns && 
                                pivotData.columns.length > 0 && 
                                pivotData.columns[0]._id !== 'default';
        
        // Get visible leaf columns if we have hierarchy
        const visibleColumns = hasColumnHierarchy ? 
                            this.getVisibleLeafColumns(pivotData.columns) : 
                            pivotData.columns;
        
        console.log(`Found ${visibleColumns.length} visible leaf columns`);
        
        // Build HTML for table body
        let bodyHtml = '';
        
        // Render each visible row
        visibleRows.forEach((rowDef, rowIndex) => {
            const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
            const rowClass = rowIndex % 2 === 0 ? 'even' : 'odd';
            
            // Start row
            bodyHtml += `<tr class="${rowClass}" data-row-id="${rowDef._id}">`;
            
            // Add dimension cells
            if (useMultiDimension) {
                // Multi-dimension case - each dimension in a separate cell
                const dimensionCells = multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
                bodyHtml += dimensionCells;
            } else {
                // Single dimension case - one hierarchy cell
                bodyHtml += this.renderRowCell(rowDef);
            }
            
            // Render value cells for visible leaf columns
            if (hasColumnHierarchy && visibleColumns.length > 0) {
                // With column hierarchies
                visibleColumns.forEach(colDef => {
                    valueFields.forEach(fieldId => {
                        // Get the key for this cell - column ID + measure
                        const key = `${colDef._id}|${fieldId}`;
                        
                        // Get value from row data or calculate if missing
                        let value = 0;
                        if (rowData[key] !== undefined) {
                            value = typeof rowData[key] === 'number' ? 
                                rowData[key] : parseFloat(rowData[key]);
                            if (isNaN(value)) value = 0;
                        }
                        
                        // Format value for display
                        const formattedValue = this.formatValue(value);
                        
                        // Add cell class based on value
                        const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell zero-value';
                        
                        // Add the cell
                        bodyHtml += `<td class="${cellClass}" 
                                    data-raw-value="${value}" 
                                    data-measure="${fieldId}"
                                    data-column-id="${colDef._id}">${formattedValue}</td>`;
                    });
                });
            } else {
                // Simple case - measure values only
                valueFields.forEach(fieldId => {
                    // Get value from row data
                    let value = 0;
                    if (rowData[fieldId] !== undefined) {
                        value = typeof rowData[fieldId] === 'number' ? 
                            rowData[fieldId] : parseFloat(rowData[fieldId]);
                        if (isNaN(value)) value = 0;
                    }
                    
                    // Format for display
                    const formattedValue = this.formatValue(value);
                    
                    // Determine cell class
                    const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell zero-value';
                    
                    // Add cell
                    bodyHtml += `<td class="${cellClass}" 
                                data-raw-value="${value}" 
                                data-measure="${fieldId}">${formattedValue}</td>`;
                });
            }
            
            // End row
            bodyHtml += '</tr>';
        });
        
        // Set the HTML content
        elements.pivotTableBody.innerHTML = bodyHtml;
    },



    // Format a numeric value for display    
    formatValue: function(value) {
        // Format a numeric value for display
        if (value === 0) {
            return '0.00';
        } else if (Math.abs(value) >= 1000000) {
            return this.formatNumberWithCommas((value / 1000000).toFixed(2)) + 'm';
        } else if (Math.abs(value) >= 1000) {
            return this.formatNumberWithCommas((value / 1000).toFixed(2)) + 'k';
        } else {
            return this.formatNumberWithCommas(value.toFixed(2));
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
        
        console.log(`✅ Status: Hiding ${hiddenRowCount} rows and ${hiddenColumnCount} columns with all zeros`);
        
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
            cell.style.lineHeight = '1.3';
        });
    },


    // Column Hierarchy Handler functionality - integrated from columnHierarchyHandler.js
    columnHierarchyHandler: {
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
        // countLeafNodes: function(node) {
        //     if (!node) return 0;
            
        //     // If this is a leaf node, count as 1
        //     if (node.isLeaf) return 1;
            
        //     // If node is not expanded, count as 1
        //     if (!node.expanded) return 1;
            
        //     // If node has no children, count as 1
        //     if (!node.children || node.children.length === 0) return 1;
            
        //     // For expanded nodes with children, sum up leaves from all children
        //     let count = 0;
            
        //     node.children.forEach(childId => {
        //         // Look up child node
        //         const childNode = typeof childId === 'string' ? 
        //             this.findNodeById(childId, node.hierarchyField) : 
        //             childId;
                
        //         if (childNode) {
        //             count += this.countLeafNodes(childNode);
        //         }
        //     });
            
        //     return Math.max(1, count); // At least 1
        // },
        countLeafNodes: function(node) {
    if (!node) return 0;
    
    // If this is a leaf node, count as 1
    if (node.isLeaf) return 1;
    
    // If node is not expanded, treat as 1
    if (!node.expanded) return 1;
    
    // If node has no children, count as 1
    if (!node.children || node.children.length === 0) return 1;
    
    // For expanded nodes with children, sum up leaves from all children
    let count = 0;
    
    // Get and process child nodes
    const childNodes = getChildNodes(node);
    childNodes.forEach(child => {
        count += countLeafNodes(child);
    });
    
    return Math.max(1, count); // At least 1
},

        
        /**
         * Count the total number of visible leaf columns
         * @param {Array} columns - The column data
         * @returns {Number} - The count of visible leaf columns
         */
        countVisibleLeafColumns: function(columns) {
    if (!columns || !Array.isArray(columns)) {
        return 0;
    }
    
    // Process each column to count visible leaf columns
    let count = 0;
    
    // Helper function to process a column and its descendants
    const processColumn = (column) => {
        if (!column) return;
        
        // Skip columns marked to be hidden
        if (column.skipInUI) return;
        
        // If it's a leaf node, count it
        if (column.isLeaf) {
            count++;
            return;
        }
        
        // If it's not expanded, count it as one leaf
        if (!column.expanded) {
            count++;
            return;
        }
        
        // If it has children and is expanded, process each child
        if (column.children && column.children.length > 0) {
            const childNodes = this.getChildNodes(column);
            childNodes.forEach(child => {
                processColumn(child);
            });
        } else {
            // No children, count as a leaf
            count++;
        }
    };
    
    // Process all top-level columns
    columns.forEach(column => {
        processColumn(column);
    });
    
    return Math.max(1, count); // At least 1
},

    
// Helper to render body with simplified column handling
renderTableBodyWithMeasureHeader: function(elements, useMultiDimension) {
    console.log("Rendering table body with measure header");
    const pivotData = this.state.pivotData;
    if (!pivotData) return;
    
    // Get value fields
    const valueFields = this.state.valueFields || ['COST_UNIT'];
    
    // Filter rows based on visibility
    const visibleRows = this.getVisibleRows(pivotData.rows);
    
    // Get visible leaf columns
    const visibleColumns = this.getVisibleLeafColumns(pivotData.columns);
    
    // Build HTML for table body
    let bodyHtml = '';
    
    // Render each visible row
    visibleRows.forEach((rowDef, rowIndex) => {
        const rowData = pivotData.data.find(d => d._id === rowDef._id) || { _id: rowDef._id };
        const rowClass = rowIndex % 2 === 0 ? 'even' : 'odd';
        
        // Start row
        bodyHtml += `<tr class="${rowClass}" data-row-id="${rowDef._id}">`;
        
        // Hierarchy cell with proper indentation and expand/collapse controls
        if (useMultiDimension) {
            bodyHtml += window.multiDimensionPivotHandler.renderMultiDimensionRowCells(rowDef);
        } else {
            bodyHtml += this.renderRowCell(rowDef);
        }
        
        // Render cells for each visible leaf column
        visibleColumns.forEach(colDef => {
            // Just use the first value field - typically 'COST_UNIT'
            const fieldId = valueFields[0];
            
            // Get the key for this cell - column ID + measure
            const key = `${colDef._id}|${fieldId}`;
            
            // Get value from row data
            let value = 0;
            if (rowData[key] !== undefined) {
                value = typeof rowData[key] === 'number' ? 
                    rowData[key] : parseFloat(rowData[key]);
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
            const cellClass = value !== 0 ? 'value-cell non-zero-value' : 'value-cell zero-value';
            
            // Add data attributes for filtering and sorting
            bodyHtml += `<td class="${cellClass}" 
                        data-raw-value="${value}" 
                        data-measure="${fieldId}"
                        data-column-id="${colDef._id}">${formattedValue}</td>`;
        });
        
        // End row
        bodyHtml += '</tr>';
    });
    
    // Set the HTML content
    if (elements && elements.pivotTableBody) {
        elements.pivotTableBody.innerHTML = bodyHtml;
        console.log(`Rendered table body with ${visibleRows.length} rows`);
    } else {
        console.error("Cannot set table body HTML - element not found");
    }
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
            if (!columns || columns.length === 0) {
                return [];
            }
            
            const visibleLeafs = [];
            
            // Function to process a column node and its descendants
            const processColumn = (column) => {
                if (!column) return;
                
                // Skip nodes marked to be hidden
                if (column.skipInUI) return;
                
                // If column is a leaf, include it
                if (column.isLeaf) {
                    visibleLeafs.push(column);
                    return;
                }
                
                // If column is not expanded, treat it as a leaf for display
                if (!column.expanded) {
                    visibleLeafs.push(column);
                    return;
                }
                
                // For expanded parents, process all children
                if (column.children && column.children.length > 0) {
                    const childNodes = this.getChildNodes(column);
                    childNodes.forEach(childNode => {
                        processColumn(childNode);
                    });
                } else {
                    // No children, treat as leaf
                    visibleLeafs.push(column);
                }
            };
            
            // Process each top-level column
            columns.forEach(column => {
                processColumn(column);
            });
            
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
            
            console.log("✅ Status: Column hierarchy handler initialized");
        }

    },


    /**
     * Check if a dimension is one of the problematic specific types
     * 
     * @param {string} dimensionName - The dimension name to check
     * @returns {boolean} - True if this is one of the specific types we need to handle
     */
    isSpecificDimensionType: function(dimensionName) {
        if (!dimensionName) return false;
        
        // Normalize the dimension name
        const normalizedDim = dimensionName.toLowerCase().replace('dim_', '');
        
        // These are the specific dimension types that need special handling
        const specificTypes = [
            'item_cost_type', 
            'year', 
            'material_type'
        ];
        
        return specificTypes.includes(normalizedDim);
    },


    /**
     * Initialize dimensions to be collapsed by default
     * 
     * @param {Array} dimensionFields - Array of dimension field IDs
     */
    initializeDimensionsCollapsed: function(dimensionFields) {
        if (!dimensionFields || !Array.isArray(dimensionFields)) return;
        
        // Get reference to state
        const state = window.App?.state || stateModule.state;
        if (!state || !state.hierarchies) return;
        
        // Process each dimension
        dimensionFields.forEach((fieldId, index) => {
            // Skip first dimension, keep it expanded
            if (index === 0) return;
            
            // Get dimension name
            const dimName = fieldId.replace('DIM_', '').toLowerCase();
            
            // Skip if hierarchy doesn't exist
            if (!state.hierarchies[dimName]) return;
            
            // Get root node
            const rootNode = state.hierarchies[dimName].root;
            if (!rootNode) return;
            
            // Set root node to collapsed by default
            state.expandedNodes = state.expandedNodes || {};
            state.expandedNodes[dimName] = state.expandedNodes[dimName] || {};
            state.expandedNodes[dimName].row = state.expandedNodes[dimName].row || {};
            
            // Set root node to collapsed
            const rootId = rootNode.id || 'ROOT';
            state.expandedNodes[dimName].row[rootId] = false;
            
            // Update node property
            if (rootNode) {
                rootNode.expanded = false;
            }
            
            console.log(`Dimension ${dimName} initialized as collapsed`);
        });
    },


    /**
     * Initializes search functionality for filter dropdowns
     * @param {string} filterId - The ID of the filter container
     */
    initializeSearchableDropdown: function(filterId) {
        const filterContainer = document.getElementById(filterId);
        if (!filterContainer) return;
        
        // Create search input if it doesn't exist
        let searchInput = filterContainer.querySelector('.filter-search');
        if (!searchInput) {
            // Create search container
            const searchContainer = document.createElement('div');
            searchContainer.className = 'filter-search-container';
            
            // Create search input
            searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'filter-search form-control';
            searchInput.placeholder = 'Search...';
            searchInput.setAttribute('autocomplete', 'off');
            
            // Create clear button
            const clearButton = document.createElement('button');
            clearButton.className = 'filter-search-clear';
            clearButton.innerHTML = '&times;';
            clearButton.style.display = 'none';
            clearButton.title = 'Clear search';
            
            // Add to container
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearButton);
            
            // Insert at the top of the filter dropdown
            const firstChild = filterContainer.firstChild;
            filterContainer.insertBefore(searchContainer, firstChild);
            
            // Add clear button functionality
            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                clearButton.style.display = 'none';
                this.filterDropdownItems('', filterContainer);
                searchInput.focus();
            });
        }
        
        // Add event listeners
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            const clearButton = searchInput.nextElementSibling;
            
            // Show/hide clear button
            clearButton.style.display = query.length > 0 ? 'block' : 'none';
            
            // Filter items based on search query
            this.filterDropdownItems(query, filterContainer);
        });
        
        // Add keydown event for Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // Find first visible item and select it
                const firstVisibleItem = filterContainer.querySelector('.filter-item:not(.hidden)');
                if (firstVisibleItem) {
                    const checkbox = firstVisibleItem.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        
                        // Trigger change event
                        const changeEvent = new Event('change', { bubbles: true });
                        checkbox.dispatchEvent(changeEvent);
                        
                        // Clear search after selection
                        searchInput.value = '';
                        searchInput.nextElementSibling.style.display = 'none';
                        this.filterDropdownItems('', filterContainer);
                    }
                }
            }
        });
    },


    /**
     * Filter items in a dropdown based on search query
     * @param {string} query - Search query
     * @param {HTMLElement} container - Filter container
     */
    filterDropdownItems: function(query, container) {
        const items = container.querySelectorAll('.filter-item');
        let visibleCount = 0;
        
        items.forEach(item => {
            const label = item.querySelector('label');
            if (!label) return;
            
            const text = label.textContent.toLowerCase();
            const match = text.includes(query);
            
            // Show/hide based on match
            item.classList.toggle('hidden', !match);
            if (match) visibleCount++;
            
            // Expand parent sections if child matches
            if (match && query.length > 0) {
                let parent = item.parentElement;
                while (parent && !parent.classList.contains('filter-dropdown')) {
                    if (parent.classList.contains('filter-group-items')) {
                        const groupHeader = parent.previousElementSibling;
                        if (groupHeader && groupHeader.classList.contains('filter-group-header')) {
                            groupHeader.classList.add('expanded');
                            parent.style.display = 'block';
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        });
        
        // Show "no results" message if needed
        let noResultsMsg = container.querySelector('.no-results-message');
        if (visibleCount === 0 && query.length > 0) {
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-results-message';
                noResultsMsg.textContent = 'No matching items found';
                container.appendChild(noResultsMsg);
            }
            noResultsMsg.style.display = 'block';
        } else if (noResultsMsg) {
            noResultsMsg.style.display = 'none';
        }
    },


    /**
     * Filters items in a dropdown based on search query
     * @param {string} query - The search query
     * @param {HTMLElement} container - The filter container
     */
    filterItems: function(query, container) {
        const items = container.querySelectorAll('.filter-item');
        let visibleCount = 0;
        
        items.forEach(item => {
            const label = item.querySelector('label');
            if (!label) return;
            
            const text = label.textContent.toLowerCase();
            const match = text.includes(query);
            
            // Show/hide based on match
            item.classList.toggle('hidden', !match);
            if (match) visibleCount++;
            
            // Expand parent sections if child matches
            if (match && query.length > 0) {
            let parent = item.parentElement;
            while (parent && !parent.classList.contains('filter-dropdown')) {
                if (parent.classList.contains('filter-group-items')) {
                const groupHeader = parent.previousElementSibling;
                if (groupHeader && groupHeader.classList.contains('filter-group-header')) {
                    groupHeader.classList.add('expanded');
                    parent.style.display = 'block';
                }
                }
                parent = parent.parentElement;
            }
            }
        });
    
        // Show "no results" message if needed
        let noResultsMsg = container.querySelector('.no-results-message');
        if (visibleCount === 0 && query.length > 0) {
            if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            noResultsMsg.textContent = 'No matching items found';
            container.appendChild(noResultsMsg);
            }
            noResultsMsg.style.display = 'block';
        } else if (noResultsMsg) {
            noResultsMsg.style.display = 'none';
        }
    },


    // Initialize search for all filter dropdowns
    initializeAllSearchableDropdowns: function() {
        const filterIds = [
            'legalEntityFilter',
            'rootGmidFilter',
            'smartcodeFilter',
            'costElementFilter',
            'businessYearFilter',
            'itemCostTypeFilter',
            'materialTypeFilter',
            'mgcFilter'
        ];
        
        filterIds.forEach(id => {
            this.initializeSearchableDropdown(id);
        });
        
        console.log("✅ Searchable dropdowns initialized");
    },


    /**
     * Enhanced expand/collapse handler with animations and better performance
     * @param {Event} e - The click event
     */
    enhancedExpandCollapseHandler:function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the target element
        let target = e.target;
        
        // If clicked on a child element, find the actual button
        if (!target.classList.contains('expand-collapse')) {
            target = target.closest('.expand-collapse');
            if (!target) return; // Exit if no button found
        }
        
        // Get node information
        const nodeId = target.getAttribute('data-node-id');
        const hierarchyName = target.getAttribute('data-hierarchy');
        const zone = target.getAttribute('data-zone') || 'row';
        
        // Prevent multiple clicks during animation
        if (target.classList.contains('animating')) {
            return;
        }
        
        // Add animating class to prevent multiple clicks
        target.classList.add('animating');
        
        // Toggle visual state immediately for feedback
        const isExpanding = target.classList.contains('collapsed');
        target.classList.toggle('collapsed');
        target.classList.toggle('expanded');
    
        // Add animation class
        target.classList.add(isExpanding ? 'expanding' : 'collapsing');
        
        // Get state reference
        const state = window.App?.state || window.stateModule?.state;
        
        // Update state
        if (state && state.expandedNodes) {
            state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
            state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
            state.expandedNodes[hierarchyName][zone][nodeId] = isExpanding;
            
            // Also update node object if available
            let node = null;
            
            if (state.hierarchies && state.hierarchies[hierarchyName]) {
            node = state.hierarchies[hierarchyName].nodesMap?.[nodeId];
            if (node) {
                node.expanded = isExpanding;
                if (zone === 'column') {
                node.columnExpanded = isExpanding;
                }
            }
            }
        }
    
        // Use requestAnimationFrame for smooth animations
        requestAnimationFrame(() => {
            // Find child elements that need to be shown/hidden
            let childrenContainer;
            
            // Different logic for row vs column zone
            if (zone === 'row') {
            // For rows, we need to find child rows using node ID
            childrenContainer = document.querySelectorAll(`tr[data-parent-id="${nodeId}"]`);
            } else {
            // For columns, we need to reorganize the headers
            childrenContainer = null; // Will handle in regeneratePivotTable
            }
            
            // If we found children in row zone, animate them
            if (childrenContainer && childrenContainer.length) {
            // Set initial state for animation
            childrenContainer.forEach(child => {
                if (isExpanding) {
                // Prepare for expand animation
                child.style.display = 'table-row';
                child.style.opacity = '0';
                child.style.transform = 'translateY(-10px)';
                } else {
                // Prepare for collapse animation
                child.style.opacity = '1';
                child.style.transform = 'translateY(0)';
                }
            });
            
            // Trigger the animation
            setTimeout(() => {
                childrenContainer.forEach((child, index) => {
                // Stagger animations for children
                setTimeout(() => {
                    if (isExpanding) {
                    child.style.opacity = '1';
                    child.style.transform = 'translateY(0)';
                    } else {
                    child.style.opacity = '0';
                    child.style.transform = 'translateY(-10px)';
                    }
                }, index * 30); // Stagger by 30ms per child
                });
                
                // Clean up after animation
                setTimeout(() => {
                childrenContainer.forEach(child => {
                    if (!isExpanding) {
                    child.style.display = 'none';
                    }
                    // Remove inline styles after animation
                    child.style.opacity = '';
                    child.style.transform = '';
                });
                
                // Remove animation classes
                target.classList.remove('animating', 'expanding', 'collapsing');
                }, childrenContainer.length * 30 + 300); // Allow time for all animations to complete
            }, 10);
            } else {
            // For column zone or when we can't find children directly, regenerate the table
            // Delay slightly to keep UI responsive
            setTimeout(() => {
                // Call window.refreshPivotTable or equivalent function
                if (window.refreshPivotTable) {
                window.refreshPivotTable();
                } else if (window.generatePivotTable) {
                window.generatePivotTable();
                }
                
                // Remove animation classes after table refresh
                setTimeout(() => {
                target.classList.remove('animating', 'expanding', 'collapsing');
                }, 300);
            }, 50);
            }
        });
    },


    /**
     * Sets up the enhanced expand/collapse functionality
     */
    setupEnhancedExpandCollapse:function() {
        // Remove any existing handlers first (to prevent duplicates)
        document.removeEventListener('click', window.handleExpandCollapseClick);
        
        // Replace global handler
        window.handleExpandCollapseClick = enhancedExpandCollapseHandler;
        
        // Make enhanced handler globally available
        window.enhancedExpandCollapseHandler = enhancedExpandCollapseHandler;
        
        // Find all existing expand/collapse controls and attach the enhanced handler
        document.querySelectorAll('.expand-collapse').forEach(control => {
            // Remove old event listeners by cloning
            const newControl = control.cloneNode(true);
            control.parentNode.replaceChild(newControl, control);
            
            // Add enhanced click handler
            newControl.addEventListener('click', enhancedExpandCollapseHandler);
        });
        
        // Add global event delegation for future elements
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('expand-collapse') || e.target.closest('.expand-collapse')) {
                this.enhancedExpandCollapseHandler(e);
            }
        });
        
        console.log("✅ Enhanced expand/collapse functionality initialized");
    }

};


// Export the pivotTable object
export default pivotTable;

