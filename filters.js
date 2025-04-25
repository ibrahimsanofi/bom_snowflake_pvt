// This module handles the data filtering logic for increased performance and better UX

// Import signature
import stateModule from './state.js';


// Get reference to application state
const state = stateModule.state;


/**
 * Initialize the filter container
 * Sets up event handlers and loads filter options
 */
function initializeFilters() {
        
    // Set up toggle for filter container
    const filterHeader = document.getElementById('filterHeader');
    const filterContent = document.getElementById('filterContent');
    const toggleIcon = document.querySelector('#toggleFilterContent i');
    
    if (filterHeader && filterContent) {
        filterHeader.addEventListener('click', () => {
            const isCollapsed = filterContent.style.display === 'none';
            filterContent.style.display = isCollapsed ? 'block' : 'none';
            toggleIcon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        });
    }
    
    // Set up dropdown toggles
    setupDropdownToggles();
    
    // Set up search functionality
    setupDropdownSearch();
    
    // Initialize apply filters button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    // Load filter options
    loadFilterOptions();
}


function filterByDimension(records, dimDef) {
    if (!dimDef) return records;
    
    // For multi-dimension rows/columns
    if (dimDef.dimensions) {
        let result = [...records];
        dimDef.dimensions.forEach(dimension => {
            result = filterByDimensionNode(result, dimension);
        });
        return result;
    }
    
    // For single dimension rows/columns
    return filterByDimensionNode(records, dimDef);
}


/**
 * Updates the filter indicator for a field
 * 
 * @param {string} fieldId - The field ID
 */
function updateFilterIndicator(fieldId) {
    // Find the filter header
    const container = document.querySelector(`.filter-dimension-container[data-field-id="${fieldId}"]`);
    if (!container) return;
    
    const header = container.querySelector('.filter-dimension-header');
    if (!header) return;
    
    // Check if filter is active
    const isActive = state.activeFilters && 
                    state.activeFilters[fieldId] && 
                    state.activeFilters[fieldId].length > 0;
    
    // Update header class
    if (isActive) {
        header.classList.add('has-active-filter');
        
        // Add count indicator
        const count = state.activeFilters[fieldId].length;
        let countBadge = header.querySelector('.filter-count');
        if (!countBadge) {
            countBadge = document.createElement('span');
            countBadge.className = 'filter-count';
            header.appendChild(countBadge);
        }
        countBadge.textContent = `(${count})`;
    } else {
        header.classList.remove('has-active-filter');
        
        // Remove count indicator
        const countBadge = header.querySelector('.filter-count');
        if (countBadge) {
            countBadge.remove();
        }
    }
}


/**
 * Set up dropdown toggle functionality for all dropdowns
 */
function setupDropdownToggles() {
    const dropdowns = document.querySelectorAll('.multiselect-dropdown');
    
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (btn && menu) {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu.show').forEach(openMenu => {
                    if (openMenu !== menu) {
                        openMenu.classList.remove('show');
                    }
                });
                
                // Toggle this dropdown
                menu.classList.toggle('show');
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    });
    
    // Prevent closing when clicking inside dropdown menu
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('click', e => {
            e.stopPropagation();
        });
    });
}


/**
 * Set up search functionality for all dropdowns
 */
function setupDropdownSearch() {
    const searchInputs = document.querySelectorAll('.dropdown-search input');
    
    searchInputs.forEach(input => {
        input.addEventListener('input', e => {
            const searchTerm = e.target.value.toLowerCase();
            const optionsContainer = e.target.closest('.dropdown-menu').querySelector('.dropdown-options');
            
            // Filter options based on search term
            const options = optionsContainer.querySelectorAll('.dropdown-option');
            options.forEach(option => {
                if (option.classList.contains('loading')) return;
                
                const text = option.textContent.toLowerCase();
                option.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    });
}


/**
 * Apply special dimension filters
 * @param {Array} filteredData - The data to filter
 * @returns {Array} - Filtered data
 */
function applySpecialDimensionFilters(filteredData) {
    // Apply Item Cost Type filters
    if (state.activeFilters && state.activeFilters['DIM_ITEM_COST_TYPE'] && 
        state.activeFilters['DIM_ITEM_COST_TYPE'].length > 0) {
        
        const validValues = new Set();
        
        // Get all selected values from the filter
        state.activeFilters['DIM_ITEM_COST_TYPE'].forEach(nodeId => {
            // Extract the actual value from the node ID
            // The node ID might be something like "ITEM_COST_TYPE_VALUE"
            const value = nodeId.replace('ITEM_COST_TYPE_', '');
            validValues.add(value);
        });
        
        // Filter data
        filteredData = filteredData.filter(record => 
            record.ITEM_COST_TYPE && validValues.has(record.ITEM_COST_TYPE)
        );
    }
    
    // Apply Material Type filters
    if (state.activeFilters && state.activeFilters['DIM_MATERIAL_TYPE'] && 
        state.activeFilters['DIM_MATERIAL_TYPE'].length > 0) {
        
        const validValues = new Set();
        
        // Get all selected values from the filter
        state.activeFilters['DIM_MATERIAL_TYPE'].forEach(nodeId => {
            // Extract the actual value from the node ID
            const value = nodeId.replace('MATERIAL_TYPE_', '');
            validValues.add(value);
        });
        
        // Filter data
        filteredData = filteredData.filter(record => 
            record.COMPONENT_MATERIAL_TYPE && validValues.has(record.COMPONENT_MATERIAL_TYPE)
        );
    }
    
    return filteredData;
}


/**
 * Render data volume indicator
 * @param {HTMLElement} container - Container element
 * @param {number} originalCount - Original data count
 * @param {number} filteredCount - Filtered data count
 */
function renderDataVolumeIndicator(container, originalCount, filteredCount) {
    // Calculate percentage
    const percentage = originalCount > 0 ? Math.round((filteredCount / originalCount) * 100) : 0;
    
    // Create indicator container
    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'data-volume-indicator';
    
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'data-volume-progress';
    progressBar.innerHTML = `
        <div class="progress-bar" style="width: ${percentage}%"></div>
    `;
    
    // Create text indicator
    const textIndicator = document.createElement('div');
    textIndicator.className = 'data-volume-text';
    textIndicator.textContent = `Showing ${filteredCount.toLocaleString()} of ${originalCount.toLocaleString()} records (${percentage}%)`;
    
    // Add to container
    indicatorContainer.appendChild(progressBar);
    indicatorContainer.appendChild(textIndicator);
    container.appendChild(indicatorContainer);
}


/**
 * Load all filter options for dropdowns
 */
function loadFilterOptions() {
    // Only load options once all data is available
    if (!state.rawFactBOMData || !state.dimensions) {
        // Set a timeout to try again later
        setTimeout(loadFilterOptions, 500);
        return;
    }
    
    // Load Legal Entity options
    loadLegalEntityOptions();
    
    // Load Smartcode options
    loadSmartcodeOptions();
    
    // Load Cost Element options
    loadCostElementOptions();
    
    // Load Business Year options from fact data
    loadSimpleOptions('ZYEAR', 'businessYearOptions', 'businessYear');
    
    // Load Item Cost Type options from fact data
    loadSimpleOptions('ITEM_COST_TYPE', 'itemCostTypeOptions', 'itemCostType');
    
    // Load Component Material Type options from fact data
    loadSimpleOptions('COMPONENT_MATERIAL_TYPE', 'componentMaterialTypeOptions', 'componentMaterialType');
    
    // Update the selected filters count
    updateSelectedFiltersCount();
}


/**
 * Direct render method for Legal Entity filters
 * @param {Array} data - Legal entity data 
 * @param {string} containerId - Container element ID
 */
function directRenderLegalEntityFilter(data, containerId) {
    console.log("Direct rendering LEGAL_ENTITY filter");

    // Get the container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Filter container not found:", containerId);
        return;
    }

    // Clear the container
    container.innerHTML = '<div class="filter-header">LEGAL_ENTITY</div>';

    // Parse raw data and extract hierarchy
    const hierarchyMap = {};
    const rootId = 'ROOT';
    hierarchyMap[rootId] = {
        id: rootId,
        label: 'All',
        children: [],
        level: 0
    };

    // Track entities to avoid duplicates
    const processedEntities = new Set();

    // Process each row
    data.forEach((row, index) => {
        if (!row) return;
        
        // Get entity ID or generate one
        const entityId = row.LEGAL_ENTITY_ID || `entity_${index}`;
        
        // Skip duplicates
        if (processedEntities.has(entityId)) return;
        processedEntities.add(entityId);
        
        // Get level values (from LEVEL_1 to LEVEL_10)
        const levelValues = [];
        for (let i = 1; i <= 10; i++) {
        const levelKey = `LEVEL_${i}`;
        if (row[levelKey] && row[levelKey].toString().trim()) {
            levelValues.push({
            level: i,
            value: row[levelKey].toString().trim(),
            id: `LEVEL_${i}_${row[levelKey]}`
            });
        }
        }
        
        // Process all levels
        let parentId = rootId;
        levelValues.forEach((levelInfo, levelIndex) => {
        const nodeId = levelInfo.id;
        const isLastLevel = levelIndex === levelValues.length - 1;
        
        // Create node if it doesn't exist
        if (!hierarchyMap[nodeId]) {
            hierarchyMap[nodeId] = {
            id: nodeId,
            label: levelInfo.value,
            children: [],
            level: levelInfo.level,
            isLeaf: isLastLevel,
            factId: isLastLevel ? entityId : null
            };
            
            // Add to parent's children
            if (!hierarchyMap[parentId].children.includes(nodeId)) {
            hierarchyMap[parentId].children.push(nodeId);
            }
        }
        
        // Update parent for next level
        parentId = nodeId;
        });
    });

    // Generate HTML directly
    const treeContainer = document.createElement('div');
    treeContainer.className = 'legal-entity-tree';

    // Create root checkbox
    const rootItem = document.createElement('div');
    rootItem.className = 'filter-tree-item root-item';
    rootItem.innerHTML = `
        <input type="checkbox" id="filter-legal-entity-root" checked>
        <label for="filter-legal-entity-root" class="filter-tree-label">All Legal Entities</label>
    `;
    treeContainer.appendChild(rootItem);

    // Add level 1 nodes (direct children of root)
    const hierarchyNodes = document.createElement('div');
    hierarchyNodes.className = 'legal-entity-nodes';

    // Used labels counter to ensure uniqueness
    const usedLabels = {};

    // Recursive function to render nodes
    function renderNode(nodeId, parentElement, level) {
        const node = hierarchyMap[nodeId];
        if (!node) return;
        
        // Generate unique label
        let displayLabel = node.label;
        if (usedLabels[displayLabel]) {
        usedLabels[displayLabel] += 1;
        displayLabel = `${displayLabel} (${usedLabels[displayLabel] - 1})`;
        } else {
        usedLabels[displayLabel] = 1;
        }
        
        // Create node container
        const nodeContainer = document.createElement('div');
        nodeContainer.className = 'filter-tree-node';
        nodeContainer.style.paddingLeft = `${level * 20}px`;
        
        // Create node item
        const nodeItem = document.createElement('div');
        nodeItem.className = 'filter-tree-item';
        
        // Add expand/collapse if has children
        if (node.children && node.children.length > 0) {
        const expandControl = document.createElement('span');
        expandControl.className = 'expand-collapse expanded';
        expandControl.setAttribute('data-node-id', node.id);
        expandControl.onclick = function() {
            this.classList.toggle('expanded');
            this.classList.toggle('collapsed');
            const childContainer = this.closest('.filter-tree-node').querySelector('.filter-tree-children');
            if (childContainer) {
            childContainer.style.display = this.classList.contains('expanded') ? 'block' : 'none';
            }
        };
        nodeItem.appendChild(expandControl);
        } else {
        const leafMarker = document.createElement('span');
        leafMarker.className = 'leaf-node';
        nodeItem.appendChild(leafMarker);
        }
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-legal-entity-${node.id}`;
        checkbox.setAttribute('data-node-id', node.id);
        
        // Add change event
        checkbox.onchange = function() {
        const rootCheckbox = document.getElementById('filter-legal-entity-root');
        if (this.checked) {
            // Uncheck the All option
            if (rootCheckbox) rootCheckbox.checked = false;
        }
        };
        
        // Create label
        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.textContent = displayLabel;
        label.className = 'filter-tree-label';
        
        // Add to node item
        nodeItem.appendChild(checkbox);
        nodeItem.appendChild(label);
        nodeContainer.appendChild(nodeItem);
        
        // Create and add children container if node has children
        if (node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'filter-tree-children';
        childrenContainer.style.display = 'block'; // Start expanded
        
        // Sort children alphabetically
        const sortedChildren = [...node.children];
        sortedChildren.sort((a, b) => {
            const labelA = hierarchyMap[a]?.label || '';
            const labelB = hierarchyMap[b]?.label || '';
            return labelA.localeCompare(labelB);
        });
        
        // Process children
        sortedChildren.forEach(childId => {
            renderNode(childId, childrenContainer, level + 1);
        });
        
        // Add children container to node container
        nodeContainer.appendChild(childrenContainer);
        }
        
        // Add node container to parent container
        parentElement.appendChild(nodeContainer);
    }

    // Sort level 1 nodes
    const sortedRootChildren = [...hierarchyMap[rootId].children];
    sortedRootChildren.sort((a, b) => {
        const labelA = hierarchyMap[a]?.label || '';
        const labelB = hierarchyMap[b]?.label || '';
        return labelA.localeCompare(labelB);
    });

    // Render level 1 nodes
    sortedRootChildren.forEach(childId => {
        renderNode(childId, hierarchyNodes, 0);
    });

    treeContainer.appendChild(hierarchyNodes);

    // Add clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-filter';
    clearButton.textContent = 'Clear All Filters';
    clearButton.onclick = function() {
        // Check root and uncheck all others
        const rootCheckbox = document.getElementById('filter-legal-entity-root');
        if (rootCheckbox) rootCheckbox.checked = true;
        
        // Uncheck all other checkboxes
        treeContainer.querySelectorAll('input[type="checkbox"]:not(#filter-legal-entity-root)').forEach(cb => {
        cb.checked = false;
        });
    };

    const clearContainer = document.createElement('div');
    clearContainer.className = 'filter-clear-container';
    clearContainer.appendChild(clearButton);
    treeContainer.appendChild(clearContainer);

    // Add complete tree to container
    container.appendChild(treeContainer);

    console.log("Completed direct render of LEGAL_ENTITY filter");
}


/**
 * Handler for Legal Entity filter zone
 */
function handleLegalEntityFilterZone() {
    console.log("Processing LEGAL_ENTITY for filter zone");

    // Get the raw data directly from state
    const legalEntityData = state.dimensions.le;

    if (!legalEntityData || legalEntityData.length === 0) {
        console.error("No LEGAL_ENTITY data found");
        return;
    }

    // Call direct render with container ID
    directRenderLegalEntityFilter(legalEntityData, 'pivotFilterControls');
}


/**
 * Render filter UI for multiple dimensions
 * @param {HTMLElement} filterContainer - Container element for filters
 */
function renderMultiDimensionFilters(filterContainer) {
    
    // Clear existing filters
    filterContainer.innerHTML = '';
    
    // Use the specialized dimension rendering
    renderAllDimensionFilters();

    // Initialize active filters if needed
    if (!state.activeFilters) {
        state.activeFilters = {};
    }

    // If no filter fields, hide the container
    if (!state.filterFields || state.filterFields.length === 0) {
        filterContainer.style.display = 'none';
        return;
    }
    
    // Show the container
    filterContainer.style.display = 'block';
    
    // Add a header
    const header = document.createElement('div');
    header.className = 'filter-header';
    header.textContent = 'Filters:';
    filterContainer.appendChild(header);
    
    // Check if we have LEGAL_ENTITY in the filter fields
    const hasLegalEntity = state.filterFields.some(field => 
        field === 'DIM_LE' || field.toLowerCase().includes('le')
    );
    
    if (hasLegalEntity) {
        // Use direct rendering for LEGAL_ENTITY
        handleLegalEntityFilterZone();
        
        // Filter out LEGAL_ENTITY from regular processing
        const otherFilters = state.filterFields.filter(field => 
            field !== 'DIM_LE' && !field.toLowerCase().includes('le')
        );
        
        // Process the remaining filters normally
        if (otherFilters.length > 0) {
            const { filterDimensions } = this.processFilterDimensions(otherFilters);
            filterDimensions.forEach(dimension => {
                this.renderFilterDimension(filterContainer, dimension);
            });
        }
    } else {
        // No LE, process filters normally
        const { filterDimensions } = this.processFilterDimensions(state.filterFields);
        filterDimensions.forEach(dimension => {
            this.renderFilterDimension(filterContainer, dimension);
        });
    }
}


/**
 * Apply multi-dimension filters to data
 * @param {Array} data - Data array to filter
 * @returns {Array} Filtered data
 */
function applyMultiDimensionFilters(data) {
    if (!data || data.length === 0) return data;
    
    // Initialize active filters if needed
    if (!state.activeFilters) {
        state.activeFilters = {};
    }
    
    // Get active filter dimensions
    const filterDimensions = Object.keys(state.activeFilters).filter(key => 
        state.activeFilters[key] && state.activeFilters[key].length > 0
    );
    
    // If no active filters, return all data
    if (filterDimensions.length === 0) {
        return data;
    }
    
    // Apply each filter dimension
    let filteredData = [...data];
    
    filterDimensions.forEach(fieldId => {
        // Skip if no active filters for this dimension
        if (!state.activeFilters[fieldId] || state.activeFilters[fieldId].length === 0) {
            return;
        }
        
        const dimName = fieldId.replace('DIM_', '').toLowerCase();
        const hierarchy = state.hierarchies[dimName];
        
        if (!hierarchy) return;
        
        // Get fact ID field for this dimension
        const factIdField = this.getFactIdField(dimName);
        
        // Build a set of valid fact IDs based on selected nodes
        const validFactIds = new Set();
        
        // For each selected node, gather all leaf node fact IDs
        state.activeFilters[fieldId].forEach(nodeId => {
            const node = hierarchy.nodesMap[nodeId];
            if (!node) return;
            
            if (node.isLeaf && node.factId) {
                // Leaf node - add its fact ID
                validFactIds.add(node.factId);
            } else {
                // Non-leaf node - add all descendant leaf node fact IDs
                const leafNodes = getAllLeafDescendants(node);
                leafNodes.forEach(leafNode => {
                    if (leafNode.factId) {
                        validFactIds.add(leafNode.factId);
                    }
                });
            }
        });
        
        // Filter the data to include only records with valid fact IDs
        if (validFactIds.size > 0) {
            filteredData = filteredData.filter(record => 
                record[factIdField] && validFactIds.has(record[factIdField])
            );
        }
    });
    
    return filteredData;
}


/**
 * Process multiple filter dimensions
 * @param {Array} fieldIds - Array of field IDs in the filter zone
 * @returns {Object} Filter dimensions info
 */
function processFilterDimensions(fieldIds) {
    // Ensure state.activeFilters is initialized
    if (!state.activeFilters) {
        state.activeFilters = {};
    }

    // Process each filter dimension
    const filterDimensions = fieldIds.map(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        const dimName = fieldId.replace('DIM_', '').toLowerCase();
        
        // Get dimension hierarchy
        const hierarchy = state.hierarchies[dimName];

        // Initialize filter tree state for this field
        if (!state.filterTreeState) {
            state.filterTreeState = {};
        }
        
        if (!state.filterTreeState[fieldId]) {
            state.filterTreeState[fieldId] = { 'ROOT': true };
        }
        
        return {
            id: fieldId,
            label: field ? field.label : fieldId,
            dimensionName: dimName,
            hierarchy: hierarchy,
            selected: state.activeFilters[fieldId] || []
        };
    });
    
    return { filterDimensions };
}


/**
 * Renders all filter controls with optimized rendering for large hierarchies
 * 
 * @param {HTMLElement} container - The container to render filters into
 */
function renderOptimizedFilters(container) {
    // Clear existing content
    container.innerHTML = '';
    
    // If no filter fields, hide container
    if (!state.filterFields || state.filterFields.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Show container
    container.style.display = 'block';
    
    // Add filter header
    const header = document.createElement('div');
    header.className = 'filter-header';
    header.textContent = 'Filters';
    container.appendChild(header);
    
    // Track which dimensions we've already rendered
    const renderedDimensions = new Set();
    
    // Render each filter dimension
    state.filterFields.forEach(fieldId => {
        // Get dimension name and check if already rendered
        const dimName = fieldId.replace('DIM_', '').toLowerCase();
        if (renderedDimensions.has(dimName)) {
            return; // Skip duplicates
        }
        renderedDimensions.add(dimName);
        
        // Find field definition
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) return;
        
        // Create container for this filter
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-dimension-container';
        filterContainer.setAttribute('data-field-id', fieldId);
        
        // Add dimension header
        const dimensionHeader = document.createElement('div');
        dimensionHeader.className = 'filter-dimension-header';
        dimensionHeader.textContent = field.label;
        filterContainer.appendChild(dimensionHeader);
        
        // Determine which rendering method to use based on dimension type
        if (field.hierarchical) {
            // For hierarchical dimensions (LE, COST_ELEMENT, etc.)
            renderHierarchicalFilter(filterContainer, field, fieldId);
        } else if (fieldId === 'ITEM_COST_TYPE' || fieldId === 'COMPONENT_MATERIAL_TYPE') {
            // For special categorical fields
            renderCategoricalFilter(filterContainer, fieldId);
        } else {
            // For regular fields (fallback)
            renderSimpleFilter(filterContainer, field, fieldId);
        }
        
        // Add the filter to the main container
        container.appendChild(filterContainer);
    });
    
    // Add clear all button if any filters are active
    const hasActiveFilters = (state.activeFilters && Object.keys(state.activeFilters).length > 0) ||
                           (state.directFilters && Object.keys(state.directFilters).length > 0);
    
    if (hasActiveFilters) {
        renderClearAllButton(container);
    }
}


/**
 * Extract unique values from fact data for a specific field
 * 
 * @param {string} fieldName - Field name to extract values from
 * @returns {Array} - Array of unique values
 */
function extractUniqueValues(fieldName) {
    const uniqueValues = new Set();
    
    if (!state.rawFactBOMData) return [];
    
    state.rawFactBOMData.forEach(row => {
        if (row[fieldName] && row[fieldName].toString().trim() !== '') {
            uniqueValues.add(row[fieldName].toString());
        }
    });
    
    return Array.from(uniqueValues).sort();
}


/**
 * Helper function to build a hierarchical tree structure for filters
 * This function supports the legacy approach of building the tree
 */
function buildHierarchyTree(node, container, fieldId, dimensionName, level = 0) {
    if (!node) return;
    
    // For the root node, just process children
    if (node.id === 'ROOT') {
        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'filter-tree-children';
            
            // Process children
            node.children.forEach(childId => {
                const childNode = node.hierarchy ? 
                    node.hierarchy.nodesMap[childId] : 
                    state.hierarchies[dimensionName].nodesMap[childId];
                if (childNode) {
                    buildHierarchyTree(childNode, childrenContainer, fieldId, dimensionName, level);
                }
            });
            
            // Add children container to parent
            container.appendChild(childrenContainer);
        }
        return;
    }
    
    // Create node container
    const nodeContainer = document.createElement('div');
    nodeContainer.className = 'filter-tree-node';
    nodeContainer.style.marginLeft = `${level * 20}px`;
    
    // Create node item
    const nodeItem = document.createElement('div');
    nodeItem.className = 'filter-tree-item';
    
    // Add leaf class if applicable
    if (node.isLeaf) {
        nodeItem.classList.add('leaf-node');
    }

    // Ensure state.filterTreeState is initialized
    if (!state.filterTreeState) {
        state.filterTreeState = {};
    }
    if (!state.filterTreeState[fieldId]) {
        state.filterTreeState[fieldId] = { 'ROOT': true };
    }
    
    // Add expand/collapse control if node has children
    if (node.children && node.children.length > 0) {
        const expandControl = document.createElement('span');
        const isExpanded = state.filterTreeState[fieldId][node.id];
        expandControl.className = `expand-collapse ${isExpanded ? 'expanded' : 'collapsed'}`;
        expandControl.setAttribute('data-node-id', node.id);
        expandControl.setAttribute('data-field-id', fieldId);
        
        // Add expand/collapse functionality
        expandControl.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const nodeId = this.getAttribute('data-node-id');
            const fieldId = this.getAttribute('data-field-id');
            
            // Toggle expanded state
            state.filterTreeState[fieldId][nodeId] = !state.filterTreeState[fieldId][nodeId];
            
            // Toggle class
            this.classList.toggle('expanded');
            this.classList.toggle('collapsed');
            
            // Toggle children visibility
            const childrenContainer = this.closest('.filter-tree-node').querySelector('.filter-tree-children');
            if (childrenContainer) {
                childrenContainer.style.display = state.filterTreeState[fieldId][nodeId] ? 'block' : 'none';
            }
        });
        
        nodeItem.appendChild(expandControl);
    } else {
        // Add leaf marker
        const leafMarker = document.createElement('span');
        leafMarker.className = 'leaf-node';
        nodeItem.appendChild(leafMarker);
    }

    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = `filter-${fieldId}`;
    checkbox.id = `filter-${fieldId}-${typeof node.id === 'object' ? 'obj_' + Math.random().toString(36).substring(2) : node.id}`;
    checkbox.setAttribute('data-node-id', node.id);
    checkbox.setAttribute('data-field-id', fieldId);
    
    // Ensure state.activeFilters is initialized
    if (!state.activeFilters) {
        state.activeFilters = {};
    }
    
    // Check if this node is selected
    if (state.activeFilters[fieldId] && state.activeFilters[fieldId].includes(node.id)) {
        checkbox.checked = true;
    }
    
    // Add change event
    checkbox.addEventListener('change', function() {
        const nodeId = this.getAttribute('data-node-id');
        const fieldId = this.getAttribute('data-field-id');
        
        // Initialize activeFilters for this field if needed
        if (!state.activeFilters[fieldId]) {
            state.activeFilters[fieldId] = [];
        }
        
        // Find the filter label
        const filterLabel = this.closest('.filter-control').querySelector('.filter-label');
        
        // Update filter state
        if (this.checked) {
            // Add to active filters if not already included
            if (!state.activeFilters[fieldId].includes(nodeId)) {
                state.activeFilters[fieldId].push(nodeId);
            }
            
            // Uncheck the "All" option
            const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
            if (allCheckbox) {
                allCheckbox.checked = false;
            }
            
            // Add active filter indicator
            if (filterLabel) {
                filterLabel.classList.add('has-active-filters');
            }
        } else {
            // Remove from active filters
            state.activeFilters[fieldId] = state.activeFilters[fieldId].filter(id => id !== nodeId);
            
            // If no filters active, check the "All" option
            if (state.activeFilters[fieldId].length === 0) {
                const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
                
                // Remove active filter indicator
                if (filterLabel) {
                    filterLabel.classList.remove('has-active-filters');
                }
            }
        }
        
        // Regenerate pivot table
        if (window.generatePivotTable) {
            window.generatePivotTable();
        }
    });

    // Create label
    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    label.textContent = node.label || node.id;
    label.className = 'filter-tree-label';
    
    // Add to node item
    nodeItem.appendChild(checkbox);
    nodeItem.appendChild(label);
    nodeContainer.appendChild(nodeItem);
    
    // Create and add children container if node has children
    if (node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'filter-tree-children';
        
        // Set initial display based on expanded state
        const isExpanded = state.filterTreeState[fieldId][node.id];
        childrenContainer.style.display = isExpanded ? 'block' : 'none';
        
        // Process children
        node.children.forEach(childId => {
            const childNode = node.hierarchy ? 
                node.hierarchy.nodesMap[childId] : 
                state.hierarchies[dimensionName].nodesMap[childId];
            if (childNode) {
                buildHierarchyTree(childNode, childrenContainer, fieldId, dimensionName, level + 1);
            }
        });
        
        // Add children container to node container
        nodeContainer.appendChild(childrenContainer);
    }
    
    // Add node container to parent container
    container.appendChild(nodeContainer);
}


/**
 * Improved function to build the filter hierarchy tree with proper node display
 * @param {Object} dimension - Dimension object
 * @param {HTMLElement} container - Container element to render tree
 */
function simplifiedBuildTree(dimension, container) {
    // Counter for generating unique IDs for HTML elements
    let idCounter = 1;  // Start from 1 instead of 0
    
    // Get dimension info
    const fieldId = dimension.id;
    const dimensionName = dimension.label || dimension.dimensionName || "Item";
    const hierarchy = dimension.hierarchy;
    
    console.log('Dimension Field ID:', fieldId);
    console.log('Dimension Name:', dimensionName);
    console.log('Hierarchy:', hierarchy);

    if (!hierarchy || !hierarchy.root) {
        console.error(`No hierarchy found for ${fieldId}`);
        container.innerHTML += '<div class="filter-error">No hierarchy data available</div>';
        return;
    }
    
    // Initialize filter tree state if needed
    if (!state.filterTreeState) {
        state.filterTreeState = {};
    }
    
    if (!state.filterTreeState[fieldId]) {
        state.filterTreeState[fieldId] = { 'ROOT': true };
    }

    // Apply the final fix to ensure all labels are meaningful and unique
    finalFixLabels(hierarchy);
    
    // Get the proper root node label from the hierarchy
    const rootLabel = hierarchy.root.label || "All";
    console.log(`Using root label for ${fieldId}: "${rootLabel}"`);
    
    // Generate a safe root ID for HTML attributes
    const safeRootId = typeof rootLabel === 'string' ? 
        rootLabel.replace(/[^a-zA-Z0-9_-]/g, '_') : 'root';
    
    // Add root option with the proper label
    const allHtml = `
        <div class="filter-tree-item root-item">
            <input type="checkbox" id="filter-${fieldId}-${safeRootId}" 
                   ${(!state.activeFilters[fieldId] || state.activeFilters[fieldId].length === 0) ? 'checked' : ''}>
            <label for="filter-${fieldId}-${safeRootId}" class="filter-tree-label">${rootLabel}</label>
        </div>
        <div class="filter-tree-separator"></div>
    `;
    container.innerHTML = allHtml;
    
    // Build tree HTML
    let treeHtml = '<div class="simplified-tree">';
    
    // Check if there are children in the root node
    if (!hierarchy.root.children || hierarchy.root.children.length === 0) {
        treeHtml += '<div class="no-children-message">No child nodes found</div>';
        console.warn(`Root node has no children for ${fieldId}`);
    } else {
        // Get and process child nodes
        const firstLevelNodes = [];
        // Collect all first-level nodes
        hierarchy.root.children.forEach(childId => {
            // Get actual node object
            let childNode = hierarchy.nodesMap[childId];
            
            // If not found, create a placeholder
            if (!childNode) {
                childNode = {
                    id: childId,
                    label: `${dimensionName} ${idCounter++}`,
                    level: 1,
                    isLeaf: true,
                    hasChildren: false,
                    children: [],
                    path: ['ROOT', childId]
                };
                
                // Add to nodesMap
                hierarchy.nodesMap[childId] = childNode;
            }
            
            firstLevelNodes.push(childNode);
        });
        
        // Sort first level nodes by label
        firstLevelNodes.sort((a, b) => {
            const labelA = a.label ? String(a.label) : String(a.id);
            const labelB = b.label ? String(b.label) : String(b.id);
            return labelA.localeCompare(labelB);
        });
        
        // Process each first-level node
        firstLevelNodes.forEach(node => {
            // Generate enhanced node HTML with guarantee of meaningful labels
            treeHtml += processNode(node, 0, fieldId, hierarchy, dimensionName, idCounter);
        });
    }
    
    treeHtml += '</div>'; // Close simplified-tree
    
    // Add clear button
    treeHtml += `
        <div class="filter-clear-container">
            <button class="clear-filter">Clear All Filters</button>
        </div>
    `;
    
    // Append the HTML to the container
    container.innerHTML += treeHtml;
    // Add event handlers for expand/collapse controls
    container.querySelectorAll('.expand-collapse').forEach(control => {
        control.addEventListener('click', function() {
            const nodeId = this.getAttribute('data-node-id');
            const fieldId = this.getAttribute('data-field-id');
            
            console.log(`Click on expand/collapse for node ${nodeId}`);
            
            // Initialize filter tree state if needed
            if (!state.filterTreeState) {
                state.filterTreeState = {};
            }
            
            if (!state.filterTreeState[fieldId]) {
                state.filterTreeState[fieldId] = {};
            }
            
            // Toggle expanded state
            state.filterTreeState[fieldId][nodeId] = !state.filterTreeState[fieldId][nodeId];
            
            // Toggle class
            this.classList.toggle('expanded');
            this.classList.toggle('collapsed');
            
            // Find children container - it's the next sibling after the parent filter-tree-item
            const childrenContainer = this.closest('.filter-tree-item').nextElementSibling;
            if (childrenContainer && childrenContainer.classList.contains('filter-tree-children')) {
                childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
                console.log(`Toggled children container display to ${childrenContainer.style.display}`);
            } else {
                console.error("Could not find children container");
            }
        });
    });

    // Add event handlers for checkboxes (excluding root)
    container.querySelectorAll(`input[type="checkbox"]:not(#filter-${fieldId}-${safeRootId})`).forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const nodeId = this.getAttribute('data-original-id');
            const fieldId = this.getAttribute('data-field-id');
            
            // Initialize activeFilters if needed
            if (!state.activeFilters) {
                state.activeFilters = {};
            }
            
            // Handle special case for object IDs
            let actualNodeId = nodeId === 'object' 
                ? Object.keys(hierarchy.nodesMap).find(key => typeof key === 'object')
                : nodeId;
            
            // Initialize if needed
            if (!state.activeFilters[fieldId]) {
                state.activeFilters[fieldId] = [];
            }
            
            if (this.checked) {
                // Add to active filters
                if (!state.activeFilters[fieldId].includes(actualNodeId)) {
                    state.activeFilters[fieldId].push(actualNodeId);
                }
                
                // Uncheck root option
                const rootCheckbox = document.getElementById(`filter-${fieldId}-${safeRootId}`);
                if (rootCheckbox) rootCheckbox.checked = false;
                
                // Add indicator to label
                const filterLabel = this.closest('.filter-control').querySelector('.filter-label');
                if (filterLabel) filterLabel.classList.add('has-active-filters');
            } else {
                // Remove from active filters
                state.activeFilters[fieldId] = state.activeFilters[fieldId].filter(id => id !== actualNodeId);
                
                // If no active filters, check the root option
                if (state.activeFilters[fieldId].length === 0) {
                    const rootCheckbox = document.getElementById(`filter-${fieldId}-${safeRootId}`);
                    if (rootCheckbox) rootCheckbox.checked = true;
                    
                    // Remove indicator from label
                    const filterLabel = this.closest('.filter-control').querySelector('.filter-label');
                    if (filterLabel) filterLabel.classList.remove('has-active-filters');
                }
            }
            
            // Update pivot table
            if (window.generatePivotTable) window.generatePivotTable();
        });
    });

    // Add event handler for root/all checkbox
    const rootCheckbox = document.getElementById(`filter-${fieldId}-${safeRootId}`);
    if (rootCheckbox) {
        rootCheckbox.addEventListener('change', function() {
            if (this.checked) {
                // Clear all filters
                state.activeFilters[fieldId] = [];
                
                // Uncheck all other checkboxes
                container.querySelectorAll(`input[type="checkbox"]:not(#filter-${fieldId}-${safeRootId})`).forEach(cb => {
                    cb.checked = false;
                });
                
                // Remove indicator from label
                const filterLabel = this.closest('.filter-control').querySelector('.filter-label');
                if (filterLabel) filterLabel.classList.remove('has-active-filters');
                
                // Update pivot table
                if (window.generatePivotTable) window.generatePivotTable();
            }
        });
    }
    
    // Add event handler for clear button
    container.querySelector('.clear-filter').addEventListener('click', function() {
        // Clear filters
        state.activeFilters[fieldId] = [];
        
        // Check root and uncheck others
        const rootCheckbox = document.getElementById(`filter-${fieldId}-${safeRootId}`);
        if (rootCheckbox) rootCheckbox.checked = true;
        
        container.querySelectorAll(`input[type="checkbox"]:not(#filter-${fieldId}-${safeRootId})`).forEach(cb => {
            cb.checked = false;
        });
        
        // Remove indicator
        const filterLabel = container.closest('.filter-control').querySelector('.filter-label');
        if (filterLabel) filterLabel.classList.remove('has-active-filters');
        
        // Update pivot table
        if (window.generatePivotTable) window.generatePivotTable();
    });
}


/**
 * Load simple options from fact data for a specific field
 * 
 * @param {string} fieldName - The field name in fact data
 * @param {string} containerId - The container element ID
 * @param {string} filterKey - The key in state.filters
 */
function loadSimpleOptions(fieldName, containerId, filterKey) {
    const optionsContainer = document.getElementById(containerId);
    if (!optionsContainer) return;
    
    // Clear loading indicator
    optionsContainer.innerHTML = '';
    
    // Get unique values from fact data
    let uniqueValues = [];
    
    if (state.uniqueValues && state.uniqueValues[fieldName]) {
        // Use pre-extracted unique values if available
        uniqueValues = state.uniqueValues[fieldName];
    } else {
        // Extract unique values
        uniqueValues = extractUniqueValues(fieldName);
        
        // Store in state for future use
        if (!state.uniqueValues) state.uniqueValues = {};
        state.uniqueValues[fieldName] = uniqueValues;
    }
    
    if (uniqueValues.length === 0) {
        optionsContainer.innerHTML = '<div class="dropdown-option">No data available</div>';
        return;
    }
    
    // Add "Select All" option
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'dropdown-option';
    selectAllOption.innerHTML = `
        <input type="checkbox" id="${filterKey}-select-all">
        <label for="${filterKey}-select-all"><strong>Select All</strong></label>
    `;
    optionsContainer.appendChild(selectAllOption);
    
    // Set up "Select All" functionality
    const selectAllCheckbox = selectAllOption.querySelector('input');
    selectAllCheckbox.addEventListener('change', e => {
        const isChecked = e.target.checked;
        
        // Update all checkboxes
        optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        
        // Update state
        if (!isChecked) {
            state.filters[filterKey] = [];
        } else {
            state.filters[filterKey] = [...uniqueValues];
        }
        
        // Update button text
        const labelMap = {
            'businessYear': 'Years',
            'itemCostType': 'Item Cost Types',
            'componentMaterialType': 'Material Types'
        };
        updateDropdownButtonText(`${filterKey}Dropdown`, labelMap[filterKey], state.filters[filterKey]);
        
        // Update the selected filters count
        updateSelectedFiltersCount();
    });
    
    // Add each unique value as an option
    uniqueValues.forEach((value, index) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        
        const isSelected = state.filters[filterKey].includes(value);
        
        option.innerHTML = `
            <input type="checkbox" id="${filterKey}-${index}" value="${value}" ${isSelected ? 'checked' : ''}>
            <label for="${filterKey}-${index}">${value}</label>
        `;
        
        // Add change event for the checkbox
        const checkbox = option.querySelector('input');
        checkbox.addEventListener('change', e => {
            if (e.target.checked) {
                // Add to filters
                if (!state.filters[filterKey].includes(value)) {
                    state.filters[filterKey].push(value);
                }
            } else {
                // Remove from filters
                state.filters[filterKey] = state.filters[filterKey].filter(item => item !== value);
                
                // Uncheck "Select All" if any item is unchecked
                selectAllCheckbox.checked = false;
            }
            
            // Update button text
            const labelMap = {
                'businessYear': 'Years',
                'itemCostType': 'Item Cost Types',
                'componentMaterialType': 'Material Types'
            };
            updateDropdownButtonText(`${filterKey}Dropdown`, labelMap[filterKey], state.filters[filterKey]);
            
            // Update the selected filters count
            updateSelectedFiltersCount();
        });
        
        optionsContainer.appendChild(option);
    });
    
    // Check if all options are selected
    selectAllCheckbox.checked = state.filters[filterKey].length === uniqueValues.length;
    
    // Update button text based on current selection
    const labelMap = {
        'businessYear': 'Years',
        'itemCostType': 'Item Cost Types',
        'componentMaterialType': 'Material Types'
    };
    updateDropdownButtonText(`${filterKey}Dropdown`, labelMap[filterKey], state.filters[filterKey]);
}


/**
 * Load hierarchical legal entity options
 */
function loadLegalEntityOptions() {
    const optionsContainer = document.getElementById('legalEntityOptions');
    if (!optionsContainer) return;
    
    // Clear loading indicator
    optionsContainer.innerHTML = '';
    
    // Get Legal Entity hierarchy
    const hierarchy = state.hierarchies.le;
    if (!hierarchy || !hierarchy.root) {
        optionsContainer.innerHTML = '<div class="dropdown-option">No Legal Entity data available</div>';
        return;
    }
    
    // Add "Select All" option
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'dropdown-option';
    selectAllOption.innerHTML = `
        <input type="checkbox" id="le-select-all">
        <label for="le-select-all"><strong>Select All</strong></label>
    `;
    optionsContainer.appendChild(selectAllOption);
    
    // Set up "Select All" functionality
    const selectAllCheckbox = selectAllOption.querySelector('input');
    selectAllCheckbox.addEventListener('change', e => {
        const isChecked = e.target.checked;
        
        // Update all checkboxes
        optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        
        // Update state if "Select All" is unchecked (clear all)
        if (!isChecked) {
            state.filters.legalEntity = [];
        } else {
            // Add all leaf nodes to filter
            const leafNodes = [];
            walkHierarchy(hierarchy.root, node => {
                if (node.isLeaf && node.factId) {
                    leafNodes.push(node.factId);
                }
            });
            state.filters.legalEntity = leafNodes;
        }
        
        // Update button text
        updateDropdownButtonText('legalEntityDropdown', 'Legal Entities', state.filters.legalEntity);
        
        // Update the selected filters count
        updateSelectedFiltersCount();
    });
    
    // Recursively build hierarchical options
    buildHierarchicalOptions(hierarchy.root, optionsContainer, 'le', 0, 'legalEntity');
    
    // Update button text based on current selection
    updateDropdownButtonText('legalEntityDropdown', 'Legal Entities', state.filters.legalEntity);
}


/**
 * Load hierarchical smartcode options
 */
function loadSmartcodeOptions() {
    const optionsContainer = document.getElementById('smartcodeOptions');
    if (!optionsContainer) return;
    
    // Clear loading indicator
    optionsContainer.innerHTML = '';
    
    // Get Smartcode hierarchy
    const hierarchy = state.hierarchies.smartcode;
    if (!hierarchy || !hierarchy.root) {
        optionsContainer.innerHTML = '<div class="dropdown-option">No Smartcode data available</div>';
        return;
    }
    
    // Add "Select All" option
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'dropdown-option';
    selectAllOption.innerHTML = `
        <input type="checkbox" id="sc-select-all">
        <label for="sc-select-all"><strong>Select All</strong></label>
    `;
    optionsContainer.appendChild(selectAllOption);
    
    // Set up "Select All" functionality
    const selectAllCheckbox = selectAllOption.querySelector('input');
    selectAllCheckbox.addEventListener('change', e => {
        const isChecked = e.target.checked;
        
        // Update all checkboxes
        optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        
        // Update state if "Select All" is unchecked (clear all)
        if (!isChecked) {
            state.filters.smartcode = [];
        } else {
            // Add all leaf nodes to filter
            const leafNodes = [];
            walkHierarchy(hierarchy.root, node => {
                if (node.isLeaf && node.factId) {
                    leafNodes.push(node.factId);
                }
            });
            state.filters.smartcode = leafNodes;
        }
        
        // Update button text
        updateDropdownButtonText('smartcodeDropdown', 'Smartcodes', state.filters.smartcode);
        
        // Update the selected filters count
        updateSelectedFiltersCount();
    });
    
    // Recursively build hierarchical options
    buildHierarchicalOptions(hierarchy.root, optionsContainer, 'sc', 0, 'smartcode');
    
    // Update button text based on current selection
    updateDropdownButtonText('smartcodeDropdown', 'Smartcodes', state.filters.smartcode);
}


/**
 * Load hierarchical cost element options
 */
function loadCostElementOptions() {
    const optionsContainer = document.getElementById('costElementOptions');
    if (!optionsContainer) return;
    
    // Clear loading indicator
    optionsContainer.innerHTML = '';
    
    // Get Cost Element hierarchy
    const hierarchy = state.hierarchies.cost_element;
    if (!hierarchy || !hierarchy.root) {
        optionsContainer.innerHTML = '<div class="dropdown-option">No Cost Element data available</div>';
        return;
    }
    
    // Add "Select All" option
    const selectAllOption = document.createElement('div');
    selectAllOption.className = 'dropdown-option';
    selectAllOption.innerHTML = `
        <input type="checkbox" id="ce-select-all">
        <label for="ce-select-all"><strong>Select All</strong></label>
    `;
    optionsContainer.appendChild(selectAllOption);
    
    // Set up "Select All" functionality
    const selectAllCheckbox = selectAllOption.querySelector('input');
    selectAllCheckbox.addEventListener('change', e => {
        const isChecked = e.target.checked;
        
        // Update all checkboxes
        optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        
        // Update state if "Select All" is unchecked (clear all)
        if (!isChecked) {
            state.filters.costElement = [];
        } else {
            // Add all leaf nodes to filter
            const leafNodes = [];
            walkHierarchy(hierarchy.root, node => {
                if (node.isLeaf && node.factId) {
                    leafNodes.push(node.factId);
                }
            });
            state.filters.costElement = leafNodes;
        }
        
        // Update button text
        updateDropdownButtonText('costElementDropdown', 'Cost Elements', state.filters.costElement);
        
        // Update the selected filters count
        updateSelectedFiltersCount();
    });
    
    // Recursively build hierarchical options
    buildHierarchicalOptions(hierarchy.root, optionsContainer, 'ce', 0, 'costElement');
    
    // Update button text based on current selection
    updateDropdownButtonText('costElementDropdown', 'Cost Elements', state.filters.costElement);
}


/**
 * Build hierarchical options for a dropdown
 * 
 * @param {Object} node - The hierarchy node
 * @param {HTMLElement} container - The container element
 * @param {string} prefix - Prefix for IDs
 * @param {number} level - Current hierarchy level
 * @param {string} filterKey - The key in state.filters
 */
function buildHierarchicalOptions(node, container, prefix, level, filterKey) {
    if (!node) return;
    
    // Skip ROOT node
    if (node.id === 'ROOT') {
        if (node.children && node.children.length > 0) {
            node.children.forEach(childId => {
                const childNode = node.hierarchy ? 
                    node.hierarchy.nodesMap[childId] : 
                    state.hierarchies[filterKey === 'legalEntity' ? 'le' : 
                                       filterKey === 'smartcode' ? 'smart_code' : 
                                       'cost_element'].nodesMap[childId];
                
                if (childNode) {
                    buildHierarchicalOptions(childNode, container, prefix, level, filterKey);
                }
            });
        }
        return;
    }
    
    // Create option for this node
    const option = document.createElement('div');
    option.className = `dropdown-option tree-option ${node.isLeaf ? 'leaf' : 'parent'}`;
    option.style.setProperty('--level', level);
    
    const isLeaf = node.isLeaf;
    const factId = node.factId;
    const nodeId = node.id;
    
    // Check if this node is selected
    const isSelected = isLeaf && factId && state.filters[filterKey].includes(factId);
    
    // Create a unique ID for the checkbox
    const uniqueId = `${prefix}-${nodeId}`;
    
    option.innerHTML = `
        <input type="checkbox" id="${uniqueId}" data-node-id="${nodeId}" data-fact-id="${factId || ''}" ${isSelected ? 'checked' : ''}>
        <label for="${uniqueId}">${node.label}</label>
    `;
    
    // Add change event for the checkbox
    const checkbox = option.querySelector('input');
    checkbox.addEventListener('change', e => {
        const isChecked = e.target.checked;
        const factId = e.target.getAttribute('data-fact-id');
        const nodeId = e.target.getAttribute('data-node-id');
        
        if (isLeaf && factId) {
            if (isChecked) {
                // Add to filters
                if (!state.filters[filterKey].includes(factId)) {
                    state.filters[filterKey].push(factId);
                }
            } else {
                // Remove from filters
                state.filters[filterKey] = state.filters[filterKey].filter(item => item !== factId);
                
                // Uncheck "Select All" checkbox
                const selectAllCheckbox = container.querySelector(`#${prefix}-select-all`);
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                }
            }
            
            // Update button text
            const labelMap = {
                'legalEntity': 'Legal Entities',
                'smartcode': 'Smartcodes',
                'costElement': 'Cost Elements'
            };
            updateDropdownButtonText(`${filterKey}Dropdown`, labelMap[filterKey], state.filters[filterKey]);
            
            // Update the selected filters count
            updateSelectedFiltersCount();
        } else {
            // For parent nodes, update all child checkboxes
            updateChildCheckboxes(nodeId, isChecked, prefix, filterKey);
        }
    });
    
    container.appendChild(option);
    
    // Process children recursively
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            const childNode = node.hierarchy ? 
                node.hierarchy.nodesMap[childId] : 
                state.hierarchies[filterKey === 'legalEntity' ? 'le' : 
                                   filterKey === 'smartcode' ? 'smartCode' : 
                                   'cost_element'].nodesMap[childId];
            
            if (childNode) {
                buildHierarchicalOptions(childNode, container, prefix, level + 1, filterKey);
            }
        });
    }
}


/**
 * Update all child checkboxes when a parent node is checked/unchecked
 * 
 * @param {string} nodeId - The parent node ID
 * @param {boolean} isChecked - Whether the parent is checked
 * @param {string} prefix - Prefix for IDs
 * @param {string} filterKey - The key in state.filters
 */
function updateChildCheckboxes(nodeId, isChecked, prefix, filterKey) {
    // Get the hierarchy
    const hierarchy = state.hierarchies[filterKey === 'legalEntity' ? 'le' : 
                                        filterKey === 'smartcode' ? 'smartCode' : 
                                        'cost_element'];
    
    if (!hierarchy || !hierarchy.nodesMap || !hierarchy.nodesMap[nodeId]) return;
    
    const node = hierarchy.nodesMap[nodeId];
    
    // Get all leaf descendants
    const leafDescendants = [];
    walkHierarchy(node, descendant => {
        if (descendant.isLeaf && descendant.factId) {
            leafDescendants.push(descendant);
        }
    });
    
    // Update checkboxes for all descendants
    leafDescendants.forEach(leafNode => {
        const checkbox = document.getElementById(`${prefix}-${leafNode.id}`);
        if (checkbox) {
            checkbox.checked = isChecked;
        }
        
        // Update state.filters
        if (isChecked) {
            // Add to filters if not already there
            if (!state.filters[filterKey].includes(leafNode.factId)) {
                state.filters[filterKey].push(leafNode.factId);
            }
        } else {
            // Remove from filters
            state.filters[filterKey] = state.filters[filterKey].filter(item => item !== leafNode.factId);
        }
    });
    
    // Update button text
    const labelMap = {
        'legalEntity': 'Legal Entities',
        'smartcode': 'Smartcodes',
        'costElement': 'Cost Elements'
    };
    updateDropdownButtonText(`${filterKey}Dropdown`, labelMap[filterKey], state.filters[filterKey]);
    
    // Update "Select All" checkbox
    const selectAllCheckbox = document.getElementById(`${prefix}-select-all`);
    if (selectAllCheckbox) {
        if (!isChecked) {
            selectAllCheckbox.checked = false;
        } else {
            // Check if all leaf nodes are now selected
            const allLeafNodes = [];
            walkHierarchy(hierarchy.root, node => {
                if (node.isLeaf && node.factId) {
                    allLeafNodes.push(node.factId);
                }
            });
            
            // If all leaf nodes are selected, check the "Select All" checkbox
            if (allLeafNodes.every(factId => state.filters[filterKey].includes(factId))) {
                selectAllCheckbox.checked = true;
            }
        }
    }
    
    // Update the selected filters count
    updateSelectedFiltersCount();
}


/**
 * Recursively walk a hierarchy, calling a callback for each node
 * 
 * @param {Object} node - The node to start from
 * @param {Function} callback - Function to call for each node
 */
function walkHierarchy(node, callback) {
    if (!node) return;
    
    // Call the callback for this node
    callback(node);
    
    // Process children
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            const childNode = node.hierarchy ? 
                node.hierarchy.nodesMap[childId] : 
                getChildNode(node, childId);
            
            if (childNode) {
                walkHierarchy(childNode, callback);
            }
        });
    }
}


/**
 * Get a child node from a parent node
 * 
 * @param {Object} parentNode - The parent node
 * @param {string} childId - The child node ID
 * @returns {Object} The child node
 */
function getChildNode(parentNode, childId) {
    // Check if the parent has a reference to the hierarchy
    if (parentNode.hierarchy && parentNode.hierarchy.nodesMap) {
        return parentNode.hierarchy.nodesMap[childId];
    }
    
    // Try to determine the hierarchy from the parent's ID
    if (parentNode.id) {
        // Check each hierarchy for this node
        for (const hierarchyName of ['le', 'smartcode', 'cost_element']) {
            const hierarchy = state.hierarchies[hierarchyName];
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[parentNode.id]) {
                return hierarchy.nodesMap[childId];
            }
        }
    }
    
    // If we can't determine the hierarchy, check all hierarchies
    for (const hierarchyName of ['le', 'smartcode', 'cost_element']) {
        const hierarchy = state.hierarchies[hierarchyName];
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[childId]) {
            return hierarchy.nodesMap[childId];
        }
    }
    
    return null;
}


/**
 * Update the text on a dropdown button based on selection
 * 
 * @param {string} dropdownId - The dropdown element ID
 * @param {string} labelText - The base label text
 * @param {Array} selectedItems - Array of selected items
 */
function updateDropdownButtonText(dropdownId, labelText, selectedItems) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const btn = dropdown.querySelector('.dropdown-btn span');
    if (!btn) return;
    
    if (!selectedItems || selectedItems.length === 0) {
        btn.textContent = `Select ${labelText}`;
    } else if (selectedItems.length === 1) {
        btn.textContent = `1 ${labelText.substr(0, labelText.length - 1)} selected`;
    } else {
        btn.textContent = `${selectedItems.length} ${labelText} selected`;
    }
}


/**
 * Update the selected filters count badge
 */
function updateSelectedFiltersCount() {
    const countElement = document.getElementById('selectedFiltersCount');
    if (!countElement) return;
    
    // Count total selected filters
    let totalCount = 0;
    Object.values(state.filters).forEach(filterArray => {
        totalCount += filterArray.length;
    });
    
    countElement.textContent = `${totalCount} selected`;
}


/**
 * Apply filters to fact data
 * This function filters the fact data and updates the pivot table
 */
function applyFilters() {
    // Show loading indicator
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (applyBtn) {
        const originalText = applyBtn.innerHTML;
        applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
        applyBtn.disabled = true;
        
        // Use setTimeout to allow the UI to update before the filtering starts
        setTimeout(() => {
            // Apply filters
            const filteredData = filterFactData();
            console.log(`Filtered data contains ${filteredData.length} records`);
            
            // Verify the first few records have numeric values
            // if (filteredData.length > 0) {
            //     const sampleSize = Math.min(5, filteredData.length);
            //     console.log("Verifying sample data values:");
            //     for (let i = 0; i < sampleSize; i++) {
            //         const record = filteredData[i];
            //         console.log(`Sample ${i+1}:`, {
            //             COST_UNIT: record.COST_UNIT,
            //             QTY_UNIT: record.QTY_UNIT,
            //             type_COST_UNIT: typeof record.COST_UNIT,
            //             type_QTY_UNIT: typeof record.QTY_UNIT
            //         });
            //     }
            // }
            
            // Generate pivot table with filtered data
            if (window.generatePivotTable) {
                window.generatePivotTable();
            }
            
            // Reset button
            applyBtn.innerHTML = originalText;
            applyBtn.disabled = false;
        }, 100);
    } else {
        // No button, just apply filters directly
        filterFactData();
        
        // Generate pivot table with filtered data
        if (window.generatePivotTable) {
            window.generatePivotTable();
        }
    }
}


/**
 * Filter fact data based on selected filters
 * Updates state.filteredData with the filtered results
 * @returns {Array} The filtered data
 */
function filterFactData() {
    // Start with all fact data
    let filteredData = [...state.rawFactBOMData];
    
    // Filter by Root GMID
    if (state.filters && state.filters.gmidDisplay && state.filters.gmidDisplay.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.gmidDisplay.includes(row.COMPONENT_GMID)
        );
    }

    // Filter by Legal Entity
    if (state.filters && state.filters.legalEntity && state.filters.legalEntity.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.legalEntity.includes(row.LE)
        );
    }
    
    // Filter by Smartcode
    if (state.filters && state.filters.smartCode && state.filters.smartCode.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.smartCode.includes(row.ROOT_SMARTCODE)
        );
    }
    
    // Filter by Cost Element
    if (state.filters && state.filters.costElement && state.filters.costElement.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.costElement.includes(row.COST_ELEMENT)
        );
    }
    
    // Filter by Business Year
    if (state.filters && state.filters.businessYear && state.filters.businessYear.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.businessYear.includes(row.ZYEAR)
        );
    }
    
    // Filter by Item Cost Type
    if (state.filters && state.filters.itemCostType && state.filters.itemCostType.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.itemCostType.includes(row.ITEM_COST_TYPE)
        );
    }
    
    // Filter by Component Material Type
    if (state.filters && state.filters.componentMaterialType && state.filters.componentMaterialType.length > 0) {
        filteredData = filteredData.filter(row => 
            state.filters.componentMaterialType.includes(row.COMPONENT_MATERIAL_TYPE)
        );
    }

    // Ensure all numeric fields remain numeric
    // filteredData.forEach(row => {
    //     // Force COST_UNIT to number
    //     if (row.COST_UNIT !== undefined) {
    //         const parsedValue = parseFloat(row.COST_UNIT);
    //         row.COST_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
    //     }
        
    //     // Force QTY_UNIT to number
    //     if (row.QTY_UNIT !== undefined) {
    //         const parsedValue = parseFloat(row.QTY_UNIT);
    //         row.QTY_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
    //     }
    // });
    
    // Log data types for verification
    // if (filteredData.length > 0) {
    //     console.log("Filtered data sample:", filteredData[0]);
    //     console.log("COST_UNIT type:", typeof filteredData[0].COST_UNIT);
    //     console.log("QTY_UNIT type:", typeof filteredData[0].QTY_UNIT);
    // }
    
    // Store the filtered data
    state.filteredData = filteredData;
    
    // Update data count display
    const filterHeader = document.getElementById('filterHeader');
    if (filterHeader) {
        // Create or update the filtered count element
        let countElement = document.getElementById('filteredRecordsCount');
        if (!countElement) {
            countElement = document.createElement('span');
            countElement.id = 'filteredRecordsCount';
            countElement.className = 'filtered-count';
            filterHeader.appendChild(countElement);
        }
        
        // Calculate percentage
        const percentage = Math.round((filteredData.length / state.rawFactBOMData.length) * 100);
        countElement.textContent = `${filteredData.length.toLocaleString()} / ${state.rawFactBOMData.length.toLocaleString()} records (${percentage}%)`;
    }
    
    return filteredData;
}


/**
 * Applies all filters to data before passing to pivot processing
 * 
 * @param {Array} originalData - The original fact data array
 * @returns {Array} - The filtered data array
 */
function preFilterData(originalData) {
    if (!originalData || originalData.length === 0) {
        console.log("preFilterData: No data to filter");
        return [];
    }
    
    console.time('Pre-Filter');
    console.log(`Starting pre-filter with ${originalData.length} records`);
    
    // Log active filters for debugging
    logActiveFilters();

    // Start with all data
    let filteredData = [...originalData];
    
    // Apply dimension filters if any are active
    const beforeDimFilters = filteredData.length;
    filteredData = applyDimensionFilters(filteredData);
    console.log(`After applying dimension filters: ${filteredData.length} records (${beforeDimFilters - filteredData.length} removed)`);
    
    // Apply any active non-hierarchical filters (e.g. direct field filters)
    const beforeDirectFilters = filteredData.length;
    filteredData = applyDirectFilters(filteredData);
    console.log(`After applying direct filters: ${filteredData.length} records (${beforeDirectFilters - filteredData.length} removed)`);
    
    console.log(`Pre-filter complete: ${originalData.length} -> ${filteredData.length} records`);
    console.timeEnd('Pre-Filter');
    
    return filteredData;
}


/**
 * Checks for active filters and logs detailed information
 */
function logActiveFilters() {
    console.log("=== Filter Debug Information ===");
    
    // Check direct filters
    if (state.directFilters && Object.keys(state.directFilters).length > 0) {
        console.log("Direct filters active:", state.directFilters);
    } else {
        console.log("No direct filters active");
    }
    
    // Check hierarchical dimension filters
    if (state.activeFilters && Object.keys(state.activeFilters).length > 0) {
        console.log("Dimension filters active:", state.activeFilters);
        
        // Log details for each active dimension filter
        Object.keys(state.activeFilters).forEach(fieldId => {
            if (!state.activeFilters[fieldId] || state.activeFilters[fieldId].length === 0) {
                return;
            }
            
            const dimName = fieldId.replace('DIM_', '').toLowerCase();
            const hierarchy = state.hierarchies[dimName];
            
            if (!hierarchy) {
                console.log(`  ${fieldId}: Hierarchy not found`);
                return;
            }
            
            console.log(`  ${fieldId}: ${state.activeFilters[fieldId].length} nodes selected`);
            state.activeFilters[fieldId].forEach(nodeId => {
                const node = hierarchy.nodesMap[nodeId];
                if (node) {
                    console.log(`    - Node: ${nodeId}, Label: ${node.label}, FactId: ${node.factId || 'none'}`);
                } else {
                    console.log(`    - Node: ${nodeId} (not found in hierarchy)`);
                }
            });
        });
    } else {
        console.log("No dimension filters active");
    }
    
    console.log("==============================");
}


/**
 * Applies hierarchical dimension filters
 * 
 * @param {Array} data - The data array to filter
 * @returns {Array} - Filtered data array
 */
function applyDimensionFilters(data) {
    if (!state.activeFilters || Object.keys(state.activeFilters).length === 0) {
        return data; // No filters active
    }
    
    let filteredData = [...data];
    
    // Track which dimension types we've processed
    const processedDimensions = new Set();
    
    // Process each filter dimension
    Object.keys(state.activeFilters).forEach(fieldId => {
        // Skip if no active filters for this dimension
        if (!state.activeFilters[fieldId] || state.activeFilters[fieldId].length === 0) {
            return;
        }
        
        // Get dimension name (e.g., legal_entity from DIM_LE)
        const dimName = fieldId.replace('DIM_', '').toLowerCase();
        
        // Skip if we've already processed this dimension type
        if (processedDimensions.has(dimName)) {
            return;
        }
        processedDimensions.add(dimName);
        
        // Get the hierarchy
        const hierarchy = state.hierarchies[dimName];
        if (!hierarchy) return;
        
        // Build a set of valid fact IDs based on selected nodes
        const validFactIds = new Set();
        
        // For each selected node, gather all leaf node fact IDs
        const selectedNodes = state.activeFilters[fieldId];
        selectedNodes.forEach(nodeId => {
            const node = hierarchy.nodesMap[nodeId];
            if (!node) return;
            
            if (node.isLeaf && node.factId) {
                // Leaf node - add its fact ID
                validFactIds.add(node.factId);
            } else {
                // Non-leaf node - add all descendant leaf node fact IDs
                const leafNodes = getAllLeafDescendants(node);
                leafNodes.forEach(leafNode => {
                    if (leafNode.factId) {
                        validFactIds.add(leafNode.factId);
                    }
                });
            }
        });
        
        // Skip if no valid fact IDs found
        if (validFactIds.size === 0) {
            return;
        }
        
        // Get fact ID field for this dimension
        const factIdField = this.getFactIdField(dimName);
        if (!factIdField) {
            return;
        }
        
        // Apply filter - keep only records that match any valid fact ID
        filteredData = filteredData.filter(record => 
            record[factIdField] && validFactIds.has(record[factIdField])
        );
        
        console.log(`Applied ${dimName} filter: ${validFactIds.size} values → ${filteredData.length} records`);
    });
    
    return filteredData;
}


/**
 * Applies direct (non-hierarchical) filters
 * 
 * @param {Array} data - The data array to filter
 * @returns {Array} - Filtered data array
 */
function applyDirectFilters(data) {
    if (!state.directFilters || Object.keys(state.directFilters).length === 0) {
        return data; // No direct filters active
    }
    
    let filteredData = [...data];
    
    // Apply each direct filter
    Object.keys(state.directFilters).forEach(fieldName => {
        const selectedValues = state.directFilters[fieldName];
        if (!selectedValues || selectedValues.length === 0) {
            return;
        }
        
        // Create a set for faster lookups
        const validValues = new Set(selectedValues);
        
        // Apply filter - keep only records with matching values
        filteredData = filteredData.filter(record => 
            record[fieldName] && validValues.has(record[fieldName])
        );
        
        console.log(`Applied ${fieldName} filter: ${validValues.size} values → ${filteredData.length} records`);
    });
    
    return filteredData;
}


/**
 * Gets all leaf descendants of a node recursively
 * 
 * @param {Object} node - The root node to start from
 * @param {Array} result - Array to collect leaf nodes (for recursion)
 * @returns {Array} - Array of all leaf descendant nodes
 */
function getAllLeafDescendants(node, result = []) {
    if (!node) return result;
    
    // If this is a leaf node, add it
    if (node.isLeaf) {
        result.push(node);
    } 
    // Otherwise recursively process all children
    else if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            // Handle both child object references and child IDs
            const childNode = (typeof child === 'object') ? child : (node.hierarchy?.nodesMap[child]);
            if (childNode) {
                getAllLeafDescendants(childNode, result);
            }
        });
    }
    
    return result;
}


/**
 * Initialize the filter system
 * Call this when the application loads
 */
function initializeFilterSystem() {
    console.log("Initializing filter system with database connection...");

    // Initialize filter state if needed
    if (!state.activeFilters) {
        state.activeFilters = {};
    }
    
    if (!state.directFilters) {
        state.directFilters = {};
    }
    
    // Initialize filter tree state if needed
    if (!state.filterTreeState) {
        state.filterTreeState = {};
    }

    // Initialize filters object if not already there
    if (!state.filters) {
        state.filters = {
            legalEntity: [],
            smartcode: [],
            costElement: [],
            businessYear: [],
            itemCostType: [],
            componentMaterialType: []
        };
    }
    
    console.log('Filter system initialized');
}


/**
 * Updates the filter state for a dimension
 * 
 * @param {string} fieldId - The field/dimension ID
 * @param {Array} selectedNodes - Array of selected node IDs
 */
function updateDimensionFilter(fieldId, selectedNodes) {
    // Initialize if needed
    if (!state.activeFilters) {
        state.activeFilters = {};
    }
    
    // Update filter state
    if (selectedNodes && selectedNodes.length > 0) {
        state.activeFilters[fieldId] = selectedNodes;
    } else {
        // If empty selection, remove filter
        delete state.activeFilters[fieldId];
    }
}


/**
 * Updates the filter state for a direct field
 * 
 * @param {string} fieldName - The field name
 * @param {Array} selectedValues - Array of selected values
 */
function updateDirectFilter(fieldName, selectedValues) {
    // Initialize if needed
    if (!state.directFilters) {
        state.directFilters = {};
    }
    
    // Update filter state
    if (selectedValues && selectedValues.length > 0) {
        state.directFilters[fieldName] = selectedValues;
    } else {
        // If empty selection, remove filter
        delete state.directFilters[fieldName];
    }
}


/**
 * Clears all filters
 */
function clearAllFilters() {
    state.activeFilters = {};
    state.directFilters = {};
    state.filters = {
        legalEntity: [],
        smartcode: [],
        costElement: [],
        businessYear: [],
        itemCostType: [],
        componentMaterialType: []
    };
    console.log('All filters cleared');
}


// Export signature
export default {
    // Filter initialization and management
    initializeFilters,
    loadFilterOptions,
    applyFilters,
    filterFactData,
    extractUniqueValues,
    
    // Pre-filter system
    preFilterData,
    initializeFilterSystem,
    updateDimensionFilter,
    updateDirectFilter,
    clearAllFilters,
    
    // Optimized filter UI
    renderOptimizedFilters,
    updateFilterIndicator,
    renderDataVolumeIndicator,
    
    // Multi-dimension filters
    renderMultiDimensionFilters,
    applyMultiDimensionFilters,
    processFilterDimensions,
    
    // Direct rendering functions for legal entity
    directRenderLegalEntityFilter,
    handleLegalEntityFilterZone,
    
    // Hierarchy-specific filter functions
    buildHierarchyTree,
    simplifiedBuildTree,
    
    // Helper functions
    getAllLeafDescendants
  };
    