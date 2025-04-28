// enhanced-filter-renderer.js
// This module enhances the filter rendering in the BOM Analysis Suite

import stateModule from './state.js';

// Get reference to application state
const state = stateModule.state;

/**
 * The EnhancedFilterRenderer module
 * Provides improved filter rendering capabilities
 */
const EnhancedFilterRenderer = {
    /**
     * Initialize the enhanced filter renderer
     */
    initialize() {
        console.log('Initializing enhanced filter renderer');
        
        // Add required styles
        this.addStyles();
        
        // Override the existing renderFilterControls function
        if (window.renderFilterControls) {
            window.originalRenderFilterControls = window.renderFilterControls;
            window.renderFilterControls = () => this.enhancedRenderFilterControls();
        }
        
        console.log('Enhanced filter renderer initialized');
    },
    
    /**
     * Add necessary styles for filter rendering
     */
    addStyles() {
        // Check if styles are already added
        if (document.getElementById('enhanced-filter-styles')) {
            return;
        }
        
        // Create style element
        const style = document.createElement('style');
        style.id = 'enhanced-filter-styles';
        style.textContent = `
            /* Enhanced Filter Styles */
            .filter-header {
                font-weight: 600;
                margin-bottom: 10px;
                color: var(--text-dark);
                border-bottom: 1px solid var(--border-light);
                padding-bottom: 5px;
            }
            
            .filter-control {
                margin-bottom: 15px;
                border: 1px solid var(--border-light);
                border-radius: 5px;
                padding: 10px;
                background-color: white;
            }
            
            .filter-label {
                display: block;
                font-weight: 500;
                margin-bottom: 8px;
                color: var(--text-dark);
            }
            
            .filter-search {
                position: relative;
                margin-bottom: 10px;
            }
            
            .filter-search input {
                width: 100%;
                padding: 6px 10px 6px 30px;
                border: 1px solid var(--border-light);
                border-radius: 4px;
                font-size: 0.9rem;
            }
            
            .filter-search:before {
                content: "\\f002";
                font-family: "Font Awesome 5 Free";
                font-weight: 900;
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-light);
            }
            
            .filter-options {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--border-light);
                border-radius: 4px;
            }
            
            .filter-option {
                display: flex;
                align-items: center;
                padding: 6px 10px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-light);
            }
            
            .filter-option:last-child {
                border-bottom: none;
            }
            
            .filter-option:hover {
                background-color: var(--bg-light);
            }
            
            .filter-option input[type="checkbox"] {
                margin-right: 8px;
            }
            
            .filter-option-label {
                flex-grow: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .filter-tree-container {
                margin-top: 8px;
            }
            
            .filter-tree-item {
                display: flex;
                align-items: center;
                padding: 4px 0;
            }
            
            .filter-tree-children {
                margin-left: 20px;
            }
            
            .expand-collapse {
                display: inline-block;
                width: 16px;
                height: 16px;
                margin-right: 5px;
                cursor: pointer;
                text-align: center;
                line-height: 14px;
                border: 1px solid var(--border-light);
                border-radius: 2px;
                color: var(--text-dark);
            }
            
            .expand-collapse.expanded:before {
                content: "-";
            }
            
            .expand-collapse.collapsed:before {
                content: "+";
            }
            
            .filter-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 10px;
                font-size: 0.8rem;
            }
            
            .filter-count {
                color: var(--text-light);
            }
            
            .clear-filter {
                color: var(--primary);
                background: none;
                border: none;
                cursor: pointer;
                font-size: 0.8rem;
                padding: 0;
            }
            
            .clear-filter:hover {
                text-decoration: underline;
            }
            
            .no-results {
                padding: 10px;
                text-align: center;
                color: var(--text-light);
                font-style: italic;
            }
            
            .filter-empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: var(--text-light);
                text-align: center;
                background-color: var(--bg-light);
                border-radius: 5px;
                margin: 10px 0;
            }
            
            .filter-empty-state i {
                font-size: 2rem;
                margin-bottom: 10px;
                opacity: 0.5;
            }
            
            /* Data volume indicator styles */
            .data-volume-indicator {
                margin-bottom: 15px;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                border: 1px solid #dee2e6;
            }
            
            .data-volume-progress {
                height: 8px;
                background-color: #e9ecef;
                border-radius: 4px;
                margin-bottom: 8px;
                overflow: hidden;
            }
            
            .progress-bar {
                height: 100%;
                background-color: #007bff;
                border-radius: 4px;
            }
            
            .data-volume-text {
                font-size: 0.875rem;
                color: #6c757d;
                text-align: center;
            }
        `;
        
        // Add to document head
        document.head.appendChild(style);
    },
    
    /**
     * Enhanced version of renderFilterControls
     * Creates improved, searchable filter UI for each dimension
     */
    enhancedRenderFilterControls() {
        console.log('Rendering enhanced filter controls');
        
        // Get the filter content container
        const filterContent = document.getElementById('filterContent');
        if (!filterContent) {
            console.error('Filter content container not found');
            return;
        }
        
        // Clear existing filters
        filterContent.innerHTML = '';
        
        // Add data volume indicator if we have data
        if (state.factData && state.factData.length > 0) {
            const dataVolumeIndicator = document.createElement('div');
            dataVolumeIndicator.id = 'dataVolumeIndicator';
            
            // Calculate the percentage of filtered records
            const filteredCount = state.filteredData ? state.filteredData.length : state.factData.length;
            const totalCount = state.factData.length;
            const percentage = Math.round((filteredCount / totalCount) * 100);
            
            // Create the indicator HTML
            dataVolumeIndicator.innerHTML = `
                <div class="data-volume-indicator">
                    <div class="data-volume-progress">
                        <div class="progress-bar" style="width: ${percentage}%"></div>
                    </div>
                    <div class="data-volume-text">
                        Showing ${filteredCount.toLocaleString()} of ${totalCount.toLocaleString()} records (${percentage}%)
                    </div>
                </div>
            `;
            
            filterContent.appendChild(dataVolumeIndicator);
        }
        
        // Hide container if no filter fields
        if (!state.filterFields || state.filterFields.length === 0) {
            console.log('No filter fields to render, showing empty state');
            this.renderEmptyState(filterContent);
            return;
        }
        
        // Render each filter field
        state.filterFields.forEach(fieldId => {
            // Find the field definition
            const field = state.availableFields.find(f => f.id === fieldId);
            if (!field) return; // Skip if field not found
            
            // console.log(`Rendering filter for: ${fieldId} (${field.label})`);
            
            // Create filter control container
            const filterControl = document.createElement('div');
            filterControl.className = 'filter-control';
            filterControl.setAttribute('data-field-id', fieldId);
            
            // Create filter label
            const filterLabel = document.createElement('div');
            filterLabel.className = 'filter-label';
            filterLabel.textContent = field.label;
            filterControl.appendChild(filterLabel);
            
            // Create different filter controls based on field type
            if (field.hierarchical) {
                // Render tree-style filter for hierarchical dimensions
                this.renderHierarchicalFilter(filterControl, field, fieldId);
            } else {
                // Render checkbox list filter for non-hierarchical dimensions
                this.renderCheckboxFilter(filterControl, field, fieldId);
            }
            
            // Add the completed filter control to the container
            filterContent.appendChild(filterControl);
        });
    },
    
    /**
     * Render an empty state for the filter section
     * @param {HTMLElement} container - The filter container
     */
    renderEmptyState(container) {
        container.innerHTML += `
            <div class="filter-empty-state">
                <i class="fas fa-filter"></i>
                <p>No filters applied. Drag dimensions from the Available Fields panel to Filter Fields to add filters.</p>
            </div>
        `;
    },
    
    /**
     * Render a hierarchical tree-style filter
     * @param {HTMLElement} filterControl - The parent filter control element
     * @param {Object} field - The field definition
     * @param {string} fieldId - The field ID
     */
    renderHierarchicalFilter(filterControl, field, fieldId) {
        // Get dimension name and hierarchy
        const dimName = field.id.replace('DIM_', '').toLowerCase();
        const hierarchy = state.hierarchies[dimName];
        
        // Create the filter body for this dimension
        const filterBody = document.createElement('div');
        filterBody.className = 'filter-body';
        
        // Only proceed if hierarchy exists and has a root node
        if (hierarchy && hierarchy.root) {
            // Create search input
            const searchDiv = document.createElement('div');
            searchDiv.className = 'filter-search';
            searchDiv.innerHTML = `<input type="text" placeholder="Search ${field.label}...">`;
            filterBody.appendChild(searchDiv);
            
            // Add tree container
            const treeContainer = document.createElement('div');
            treeContainer.className = 'filter-tree-container';
            
            // Initialize filter state if needed
            if (!state.activeFilters) {
                state.activeFilters = {};
            }
            
            // Initialize filter tree state if not already set
            if (!state.filterTreeState) {
                state.filterTreeState = {};
            }
            if (!state.filterTreeState[fieldId]) {
                state.filterTreeState[fieldId] = { 'ROOT': true }; // Root is expanded by default
            }
            
            // Create "All" option at the top
            const allOption = this.renderAllOption(fieldId);
            treeContainer.appendChild(allOption);
            
            // Render the rest of the tree
            this.renderTreeNodes(hierarchy.root, treeContainer, fieldId, 0);
            
            // Add the tree container to the filter body
            filterBody.appendChild(treeContainer);
            
            // Set up search functionality
            const searchInput = searchDiv.querySelector('input');
            searchInput.addEventListener('input', (e) => {
                this.handleTreeSearch(e.target.value, treeContainer, field.label);
            });
            
            // Add footer with selection count and clear button
            const footer = this.renderFilterFooter(fieldId);
            filterBody.appendChild(footer);
            
            // Add event listener for select all checkbox
            const selectAllCheckbox = allOption.querySelector('input[type="checkbox"]');
            selectAllCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    // Clear all selections for this dimension
                    this.clearDimensionSelections(fieldId, treeContainer);
                    // Update footer
                    this.updateFilterFooter(fieldId, 0);
                }
            });
        } else {
            // No hierarchy found, show error
            filterBody.innerHTML = `
                <div class="filter-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Hierarchy data not available for ${field.label}</span>
                </div>
            `;
        }
        
        // Add the completed filter body to the control
        filterControl.appendChild(filterBody);
    },
    
    /**
     * Render the "All" option for a hierarchical filter
     * @param {string} fieldId - The field ID
     * @returns {HTMLElement} - The all option element
     */
    renderAllOption(fieldId) {
        const allOption = document.createElement('div');
        allOption.className = 'filter-option';
        
        // Create checkbox for "All"
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-${fieldId}-all`;
        checkbox.className = 'filter-all-checkbox';
        
        // Check if "All" is selected (no active filters for this dimension)
        if (!state.activeFilters || !state.activeFilters[fieldId] || state.activeFilters[fieldId].length === 0) {
            checkbox.checked = true;
        }
        
        // Create label
        const label = document.createElement('label');
        label.setAttribute('for', `filter-${fieldId}-all`);
        label.className = 'filter-option-label';
        label.textContent = 'All';
        
        // Add to option
        allOption.appendChild(checkbox);
        allOption.appendChild(label);
        
        return allOption;
    },
    
    /**
     * Recursively render tree nodes for a hierarchical filter
     * @param {Object} node - The current node
     * @param {HTMLElement} container - The parent container
     * @param {string} fieldId - The field ID
     * @param {number} level - The current level for indentation
     */
    renderTreeNodes(node, container, fieldId, level) {
        // Skip rendering the root node itself - we only show its children
        if (node.id === 'ROOT' || node.id === 'MASTER_ROOT') {
            if (node.children && node.children.length > 0) {
                // Process each child node
                node.children.forEach(childId => {
                    // Handle both string IDs and direct node references
                    const childNode = typeof childId === 'string' ? 
                        (node.hierarchy ? node.hierarchy.nodesMap[childId] : this.findNodeById(childId, fieldId)) : 
                        childId;
                    
                    if (childNode) {
                        this.renderTreeNode(childNode, container, fieldId, level);
                    }
                });
            }
            return;
        }
        
        // Render this node
        this.renderTreeNode(node, container, fieldId, level);
    },
    
    /**
     * Render a single tree node for a hierarchical filter
     * @param {Object} node - The node to render
     * @param {HTMLElement} container - The parent container
     * @param {string} fieldId - The field ID
     * @param {number} level - The current level for indentation
     */
    renderTreeNode(node, container, fieldId, level) {
        // Create node container
        const nodeItem = document.createElement('div');
        nodeItem.className = 'filter-option';
        nodeItem.style.paddingLeft = `${level * 20}px`;
        
        // If node has children, add expand/collapse control
        if (node.children && node.children.length > 0) {
            const expandControl = document.createElement('span');
            expandControl.className = `expand-collapse ${state.filterTreeState[fieldId][node.id] ? 'expanded' : 'collapsed'}`;
            expandControl.setAttribute('data-node-id', node.id);
            expandControl.setAttribute('data-field-id', fieldId);
            
            // Add expand/collapse functionality
            expandControl.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const nodeId = e.target.getAttribute('data-node-id');
                const fieldId = e.target.getAttribute('data-field-id');
                
                // Toggle expanded state
                state.filterTreeState[fieldId][nodeId] = !state.filterTreeState[fieldId][nodeId];
                
                // Toggle class
                e.target.classList.toggle('expanded');
                e.target.classList.toggle('collapsed');
                
                // Toggle children container visibility
                const childrenContainer = document.querySelector(`.filter-tree-children[data-parent="${nodeId}"]`);
                if (childrenContainer) {
                    childrenContainer.style.display = state.filterTreeState[fieldId][nodeId] ? 'block' : 'none';
                }
            });
            
            nodeItem.appendChild(expandControl);
        }
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-${fieldId}-${node.id}`;
        checkbox.className = 'filter-node-checkbox';
        checkbox.setAttribute('data-node-id', node.id);
        checkbox.setAttribute('data-field-id', fieldId);
        
        // Set checked state based on active filters
        if (state.activeFilters && 
            state.activeFilters[fieldId] && 
            state.activeFilters[fieldId].includes(node.id)) {
            checkbox.checked = true;
        }
        
        // Add change event for checkbox
        checkbox.addEventListener('change', (e) => {
            this.handleNodeCheckboxChange(e.target, fieldId);
        });
        
        // Create label
        const label = document.createElement('label');
        label.setAttribute('for', `filter-${fieldId}-${node.id}`);
        label.className = 'filter-option-label';
        label.textContent = node.label || node.id;
        
        // Add to node item
        nodeItem.appendChild(checkbox);
        nodeItem.appendChild(label);
        
        // Add to container
        container.appendChild(nodeItem);
        
        // Process children if any
        if (node.children && node.children.length > 0) {
            // Create children container
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'filter-tree-children';
            childrenContainer.setAttribute('data-parent', node.id);
            
            // Set initial display based on expanded state
            childrenContainer.style.display = state.filterTreeState[fieldId][node.id] ? 'block' : 'none';
            
            // Process each child node
            node.children.forEach(childId => {
                // Handle both string IDs and direct node references
                const childNode = typeof childId === 'string' ? 
                    (node.hierarchy ? node.hierarchy.nodesMap[childId] : this.findNodeById(childId, fieldId)) : 
                    childId;
                
                if (childNode) {
                    this.renderTreeNode(childNode, childrenContainer, fieldId, level + 1);
                }
            });
            
            // Add children container to main container
            container.appendChild(childrenContainer);
        }
    },
    
    /**
     * Handle checkbox change for a node
     * @param {HTMLElement} checkbox - The checkbox element
     * @param {string} fieldId - The field ID
     */
    handleNodeCheckboxChange(checkbox, fieldId) {
        const nodeId = checkbox.getAttribute('data-node-id');
        const checked = checkbox.checked;
        
        // Initialize activeFilters if needed
        if (!state.activeFilters) {
            state.activeFilters = {};
        }
        
        // Initialize array for this field if needed
        if (!state.activeFilters[fieldId]) {
            state.activeFilters[fieldId] = [];
        }
        
        if (checked) {
            // Add to active filters if not already there
            if (!state.activeFilters[fieldId].includes(nodeId)) {
                state.activeFilters[fieldId].push(nodeId);
            }
            
            // Uncheck the "All" checkbox
            const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
            if (allCheckbox) {
                allCheckbox.checked = false;
            }
        } else {
            // Remove from active filters
            state.activeFilters[fieldId] = state.activeFilters[fieldId].filter(id => id !== nodeId);
            
            // If no selections, check the "All" checkbox
            if (state.activeFilters[fieldId].length === 0) {
                const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
            }
        }
        
        // Update footer
        this.updateFilterFooter(fieldId, state.activeFilters[fieldId].length);
    },
    
    /**
     * Handle tree search
     * @param {string} searchTerm - The search term
     * @param {HTMLElement} treeContainer - The tree container
     * @param {string} fieldLabel - The field label (for no results message)
     */
    handleTreeSearch(searchTerm, treeContainer, fieldLabel) {
        const normalizedTerm = searchTerm.toLowerCase();
        
        // Get all filter options except the "All" option
        const options = treeContainer.querySelectorAll('.filter-option:not(:first-child)');
        let matchFound = false;
        
        // Search through options
        options.forEach(option => {
            const label = option.querySelector('.filter-option-label');
            if (!label) return;
            
            const text = label.textContent.toLowerCase();
            const match = text.includes(normalizedTerm);
            
            // Show/hide based on match
            option.style.display = match ? '' : 'none';
            
            if (match) {
                matchFound = true;
                
                // If this is inside a hidden children container, make its parent visible
                let parent = option.parentElement;
                while (parent && !parent.classList.contains('filter-tree-container')) {
                    if (parent.classList.contains('filter-tree-children')) {
                        parent.style.display = 'block';
                        
                        // Also expand the parent node control
                        const parentId = parent.getAttribute('data-parent');
                        if (parentId) {
                            const expandControl = treeContainer.querySelector(`.expand-collapse[data-node-id="${parentId}"]`);
                            if (expandControl) {
                                expandControl.classList.remove('collapsed');
                                expandControl.classList.add('expanded');
                            }
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        });
        
        // Show/hide no results message
        let noResults = treeContainer.querySelector('.no-results');
        
        if (!matchFound && searchTerm) {
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.textContent = `No matching ${fieldLabel} found`;
                treeContainer.appendChild(noResults);
            }
            noResults.style.display = 'block';
        } else if (noResults) {
            noResults.style.display = 'none';
        }
    },
    
    /**
     * Render a checkbox list filter for non-hierarchical dimensions
     * @param {HTMLElement} filterControl - The filter control element
     * @param {Object} field - The field definition
     * @param {string} fieldId - The field ID
     */
    renderCheckboxFilter(filterControl, field, fieldId) {
        // Create filter body
        const filterBody = document.createElement('div');
        filterBody.className = 'filter-body';
        
        // Create search input
        const searchDiv = document.createElement('div');
        searchDiv.className = 'filter-search';
        searchDiv.innerHTML = `<input type="text" placeholder="Search ${field.label}...">`;
        filterBody.appendChild(searchDiv);
        
        // Get values for this dimension
        const values = this.getUniqueValuesForField(fieldId);
        
        // Create options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'filter-options';
        
        // Add "All" option
        const allOption = this.renderAllOption(fieldId);
        optionsContainer.appendChild(allOption);
        
        // Add each value as an option
        values.forEach((value, index) => {
            const option = document.createElement('div');
            option.className = 'filter-option';
            
            // Create checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `filter-${fieldId}-${index}`;
            checkbox.className = 'filter-value-checkbox';
            checkbox.setAttribute('data-value', value);
            checkbox.setAttribute('data-field-id', fieldId);
            
            // Set checked state based on active filters
            if (state.activeFilters && 
                state.activeFilters[fieldId] && 
                state.activeFilters[fieldId].includes(value)) {
                checkbox.checked = true;
            }
            
            // Add change event for checkbox
            checkbox.addEventListener('change', (e) => {
                this.handleValueCheckboxChange(e.target, fieldId);
            });
            
            // Create label
            const label = document.createElement('label');
            label.setAttribute('for', `filter-${fieldId}-${index}`);
            label.className = 'filter-option-label';
            label.textContent = value;
            
            // Add to option
            option.appendChild(checkbox);
            option.appendChild(label);
            
            // Add to container
            optionsContainer.appendChild(option);
        });
        
        // Add options container to filter body
        filterBody.appendChild(optionsContainer);
        
        // Set up search functionality
        const searchInput = searchDiv.querySelector('input');
        searchInput.addEventListener('input', (e) => {
            this.handleOptionsSearch(e.target.value, optionsContainer, field.label);
        });
        
        // Add footer with selection count and clear button
        const footer = this.renderFilterFooter(fieldId);
        filterBody.appendChild(footer);
        
        // Add event listener for select all checkbox
        const selectAllCheckbox = allOption.querySelector('input[type="checkbox"]');
        selectAllCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Clear all selections for this dimension
                this.clearDimensionSelections(fieldId, optionsContainer);
                // Update footer
                this.updateFilterFooter(fieldId, 0);
            }
        });
        
        // Add the completed filter body to the control
        filterControl.appendChild(filterBody);
    },
    
    /**
     * Handle value checkbox change
     * @param {HTMLElement} checkbox - The checkbox element
     * @param {string} fieldId - The field ID
     */
    handleValueCheckboxChange(checkbox, fieldId) {
        const value = checkbox.getAttribute('data-value');
        const checked = checkbox.checked;
        
        // Initialize activeFilters if needed
        if (!state.activeFilters) {
            state.activeFilters = {};
        }
        
        // Initialize array for this field if needed
        if (!state.activeFilters[fieldId]) {
            state.activeFilters[fieldId] = [];
        }
        
        if (checked) {
            // Add to active filters if not already there
            if (!state.activeFilters[fieldId].includes(value)) {
                state.activeFilters[fieldId].push(value);
            }
            
            // Uncheck the "All" checkbox
            const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
            if (allCheckbox) {
                allCheckbox.checked = false;
            }
        } else {
            // Remove from active filters
            state.activeFilters[fieldId] = state.activeFilters[fieldId].filter(val => val !== value);
            
            // If no selections, check the "All" checkbox
            if (state.activeFilters[fieldId].length === 0) {
                const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
            }
        }
        
        // Update footer
        this.updateFilterFooter(fieldId, state.activeFilters[fieldId].length);
    },
    
    /**
     * Handle options search
     * @param {string} searchTerm - The search term
     * @param {HTMLElement} optionsContainer - The options container
     * @param {string} fieldLabel - The field label (for no results message)
     */
    handleOptionsSearch(searchTerm, optionsContainer, fieldLabel) {
        const normalizedTerm = searchTerm.toLowerCase();
        
        // Get all filter options except the "All" option
        const options = optionsContainer.querySelectorAll('.filter-option:not(:first-child)');
        let matchFound = false;
        
        // Search through options
        options.forEach(option => {
            const label = option.querySelector('.filter-option-label');
            if (!label) return;
            
            const text = label.textContent.toLowerCase();
            const match = text.includes(normalizedTerm);
            
            // Show/hide based on match
            option.style.display = match ? '' : 'none';
            
            if (match) {
                matchFound = true;
            }
        });
        
        // Show/hide no results message
        let noResults = optionsContainer.querySelector('.no-results');
        
        if (!matchFound && searchTerm) {
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.textContent = `No matching ${fieldLabel} found`;
                optionsContainer.appendChild(noResults);
            }
            noResults.style.display = 'block';
        } else if (noResults) {
            noResults.style.display = 'none';
        }
    },
    
    /**
     * Get unique values for a field from fact data
     * @param {string} fieldId - The field ID
     * @returns {Array} - Array of unique values
     */
    getUniqueValuesForField(fieldId) {
        // Map dimension ID to fact data field name
        const factFieldMap = {
            'DIM_LEGAL_ENTITY': 'LE',
            'DIM_COST_ELEMENT': 'COST_ELEMENT',
            'DIM_SMARTCODE': 'ROOT_SMARTCODE',
            'DIM_GMID_DISPLAY': 'COMPONENT_GMID',
            'ITEM_COST_TYPE': 'ITEM_COST_TYPE',
            'COMPONENT_MATERIAL_TYPE': 'COMPONENT_MATERIAL_TYPE',
            'DIM_YEAR': 'ZYEAR',
            'ZYEAR': 'ZYEAR',
            'MC': 'MC',
            'DIM_MC': 'MC'
        };
        
        // Get fact field name
        const factField = factFieldMap[fieldId] || fieldId;
        
        // Extract unique values from fact data
        const uniqueValues = new Set();
        
        if (state.factData && state.factData.length > 0) {
            state.factData.forEach(record => {
                if (record[factField] !== undefined && record[factField] !== null) {
                    uniqueValues.add(String(record[factField]));
                }
            });
        }
        
        // Convert to array and sort
        return Array.from(uniqueValues).sort();
    },
    
    /**
     * Render filter footer with selection count and clear button
     * @param {string} fieldId - The field ID
     * @returns {HTMLElement} - The footer element
     */
    renderFilterFooter(fieldId) {
        const footer = document.createElement('div');
        footer.className = 'filter-footer';
        
        // Count element
        const countElement = document.createElement('div');
        countElement.className = 'filter-count';
        countElement.id = `filter-count-${fieldId}`;
        
        // Set current count
        const count = state.activeFilters && state.activeFilters[fieldId] ? 
            state.activeFilters[fieldId].length : 0;
        countElement.textContent = count === 0 ? 
            'No items selected' : 
            `${count} item${count === 1 ? '' : 's'} selected`;
        
        // Clear button
        const clearButton = document.createElement('button');
        clearButton.className = 'clear-filter';
        clearButton.textContent = 'Clear All';
        clearButton.id = `clear-filter-${fieldId}`;
        
        // Disable if nothing selected
        clearButton.disabled = count === 0;
        
        // Add click event
        clearButton.addEventListener('click', () => {
            this.clearDimensionSelections(fieldId);
        });
        
        // Add to footer
        footer.appendChild(countElement);
        footer.appendChild(clearButton);
        
        return footer;
    },
    
    /**
     * Update filter footer when selections change
     * @param {string} fieldId - The field ID
     * @param {number} count - The number of selected items
     */
    updateFilterFooter(fieldId, count) {
        // Update count element
        const countElement = document.getElementById(`filter-count-${fieldId}`);
        if (countElement) {
            countElement.textContent = count === 0 ? 
                'No items selected' : 
                `${count} item${count === 1 ? '' : 's'} selected`;
        }
        
        // Update clear button
        const clearButton = document.getElementById(`clear-filter-${fieldId}`);
        if (clearButton) {
            clearButton.disabled = count === 0;
        }
    },
    
    /**
     * Clear all selections for a dimension
     * @param {string} fieldId - The field ID
     * @param {HTMLElement} container - Optional container (if not specified, will find in DOM)
     */
    clearDimensionSelections(fieldId, container) {
        // Get the container if not provided
        if (!container) {
            const filterControl = document.querySelector(`.filter-control[data-field-id="${fieldId}"]`);
            if (filterControl) {
                container = filterControl.querySelector('.filter-options, .filter-tree-container');
            }
        }
        
        if (!container) return;
        
        // Check all checkboxes except "All"
        const checkboxes = container.querySelectorAll('.filter-node-checkbox, .filter-value-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Check the "All" checkbox
        const allCheckbox = document.getElementById(`filter-${fieldId}-all`);
        if (allCheckbox) {
            allCheckbox.checked = true;
        }
        
        // Clear active filters for this dimension
        if (state.activeFilters) {
            state.activeFilters[fieldId] = [];
        }
    },
    
    /**
     * Apply all filters to data
     */
    applyFilters() {
        console.log('Applying all filters');
        
        // Show loading indicator on button
        const applyButton = document.getElementById('applyFiltersBtn');
        if (applyButton) {
            const originalHtml = applyButton.innerHTML;
            applyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            applyButton.disabled = true;
            
            // Use setTimeout to allow UI update
            setTimeout(() => {
                // Filter the data
                this.filterData();
                
                // Reset button
                applyButton.innerHTML = originalHtml;
                applyButton.disabled = false;
                
                // Update pivot table
                if (window.generatePivotTable) {
                    window.generatePivotTable();
                }
            }, 100);
        } else {
            // No button, just apply directly
            this.filterData();
            
            // Update pivot table
            if (window.generatePivotTable) {
                window.generatePivotTable();
            }
        }
    },
    
    /**
     * Filter data based on all active filters
     */
    filterData() {
        console.log('Filtering data based on active filters');
        
        // Start with all data
        let filteredData = [...state.factData];
        
        // Map dimension IDs to fact data field names
        const factFieldMap = {
            'DIM_LEGAL_ENTITY': 'LE',
            'DIM_COST_ELEMENT': 'COST_ELEMENT',
            'DIM_SMARTCODE': 'ROOT_SMARTCODE',
            'DIM_GMID_DISPLAY': 'COMPONENT_GMID',
            'ITEM_COST_TYPE': 'ITEM_COST_TYPE',
            'COMPONENT_MATERIAL_TYPE': 'COMPONENT_MATERIAL_TYPE',
            'DIM_YEAR': 'ZYEAR',
            'ZYEAR': 'ZYEAR',
            'MC': 'MC',
            'DIM_MC': 'MC'
        };
        
        // Check if we have active filters
        if (state.activeFilters) {
            // Apply each dimension filter
            Object.entries(state.activeFilters).forEach(([fieldId, selectedValues]) => {
                // Skip if nothing selected (All)
                if (!selectedValues || selectedValues.length === 0) {
                    return;
                }
                
                // Get field name in fact data
                const factField = factFieldMap[fieldId] || fieldId;
                
                // Get field definition
                const field = state.availableFields.find(f => f.id === fieldId);
                
                if (field && field.hierarchical) {
                    // Handle hierarchical dimensions
                    filteredData = this.applyHierarchicalFilter(filteredData, fieldId, selectedValues);
                } else {
                    // Handle non-hierarchical dimensions
                    filteredData = filteredData.filter(record => 
                        selectedValues.includes(String(record[factField]))
                    );
                }
                
                console.log(`After applying ${fieldId} filter: ${filteredData.length} records remaining`);
            });
        }
        
        // Store filtered data in state
        state.filteredData = filteredData;
        
        console.log(`Filtering complete: ${state.factData.length} → ${filteredData.length} records`);
        
        // Update data volume indicator
        this.updateDataVolumeIndicator(state.factData.length, filteredData.length);
        
        return filteredData;
    },
    
    /**
     * Apply a hierarchical filter
     * @param {Array} data - The data to filter
     * @param {string} fieldId - The field ID
     * @param {Array} selectedNodeIds - The selected node IDs
     * @returns {Array} - Filtered data
     */
    applyHierarchicalFilter(data, fieldId, selectedNodeIds) {
        // Get dimension name
        const dimName = fieldId.replace('DIM_', '').toLowerCase();
        
        // Get hierarchy
        const hierarchy = state.hierarchies[dimName];
        if (!hierarchy || !hierarchy.nodesMap) {
            return data;
        }
        
        // Map field ID to fact field name
        const factFieldMap = {
            'DIM_LEGAL_ENTITY': 'LE',
            'DIM_COST_ELEMENT': 'COST_ELEMENT',
            'DIM_SMARTCODE': 'ROOT_SMARTCODE',
            'DIM_GMID_DISPLAY': 'COMPONENT_GMID',
            'DIM_MC': 'MC',
            'DIM_YEAR': 'ZYEAR'
        };
        
        const factField = factFieldMap[fieldId] || dimName.toUpperCase();
        
        // Build set of all valid fact IDs
        const validFactIds = new Set();
        
        // Process each selected node
        selectedNodeIds.forEach(nodeId => {
            const node = hierarchy.nodesMap[nodeId];
            if (!node) return;
            
            if (node.factId) {
                // For leaf nodes, add the fact ID
                validFactIds.add(node.factId);
            } else if (node.descendantFactIds) {
                // For parent nodes with precomputed descendants, add all descendant fact IDs
                node.descendantFactIds.forEach(id => validFactIds.add(id));
            } else {
                // For parent nodes without precomputed descendants, traverse the tree
                this.collectLeafFactIds(node, validFactIds);
            }
        });
        
        console.log(`Hierarchical filter for ${fieldId}: ${validFactIds.size} values to include`);
        
        // Filter the data to only include records with valid fact IDs
        return data.filter(record => 
            record[factField] && validFactIds.has(record[factField])
        );
    },
    
    /**
     * Collect fact IDs from all leaf descendants of a node
     * @param {Object} node - The node to process
     * @param {Set} resultSet - The set to collect fact IDs in
     */
    collectLeafFactIds(node, resultSet) {
        if (!node) return;
        
        // Add this node's fact ID if it has one
        if (node.factId) {
            resultSet.add(node.factId);
        }
        
        // Process children recursively
        if (node.children && node.children.length > 0) {
            node.children.forEach(childId => {
                const childNode = typeof childId === 'string' ? 
                    (node.hierarchy ? node.hierarchy.nodesMap[childId] : this.findNodeById(childId)) : 
                    childId;
                
                if (childNode) {
                    this.collectLeafFactIds(childNode, resultSet);
                }
            });
        }
    },
    
    /**
     * Update the data volume indicator
     * @param {number} totalCount - Total record count
     * @param {number} filteredCount - Filtered record count
     */
    updateDataVolumeIndicator(totalCount, filteredCount) {
        const indicator = document.getElementById('dataVolumeIndicator');
        if (!indicator) return;
        
        // Calculate percentage
        const percentage = Math.round((filteredCount / totalCount) * 100);
        
        // Format counts
        const formattedTotal = totalCount.toLocaleString();
        const formattedFiltered = filteredCount.toLocaleString();
        
        // Update the indicator
        indicator.innerHTML = `
            <div class="data-volume-indicator">
                <div class="data-volume-progress">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
                <div class="data-volume-text">
                    Showing ${formattedFiltered} of ${formattedTotal} records (${percentage}%)
                </div>
            </div>
        `;
        
        // Also update the filtered records count
        const filteredRecordsCount = document.getElementById('filteredRecordsCount');
        if (filteredRecordsCount) {
            filteredRecordsCount.textContent = `${formattedFiltered} / ${formattedTotal} records (${percentage}%)`;
        }
    },
    
    /**
     * Clear all filters
     */
    clearAllFilters() {
        console.log('Clearing all filters');
        
        // Clear active filters
        state.activeFilters = {};
        
        // Check all "All" checkboxes
        document.querySelectorAll('.filter-all-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        // Uncheck all other checkboxes
        document.querySelectorAll('.filter-node-checkbox, .filter-value-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Update all footers
        document.querySelectorAll('.filter-count').forEach(count => {
            count.textContent = 'No items selected';
        });
        
        // Disable all clear buttons
        document.querySelectorAll('.clear-filter').forEach(button => {
            button.disabled = true;
        });
        
        // Apply filters to update data
        this.applyFilters();
    },
    
    /**
     * Find a node by its ID
     * @param {string} nodeId - The node ID
     * @param {string} [fieldId] - Optional field ID to narrow search
     * @returns {Object|null} - The node object or null if not found
     */
    findNodeById(nodeId, fieldId) {
        // If field ID is provided, try to find in that specific hierarchy
        if (fieldId) {
            const dimName = fieldId.replace('DIM_', '').toLowerCase();
            const hierarchy = state.hierarchies[dimName];
            
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[nodeId]) {
                return hierarchy.nodesMap[nodeId];
            }
        }
        
        // If not found or no field ID, search in all hierarchies
        for (const hierarchyName in state.hierarchies) {
            const hierarchy = state.hierarchies[hierarchyName];
            
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[nodeId]) {
                return hierarchy.nodesMap[nodeId];
            }
        }
        
        return null;
    }
};

export default EnhancedFilterRenderer;