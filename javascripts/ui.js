// This module handles ui-centric tasks

// Import signature
import core from './core.js';
import stateModule from './state.js';


const state = stateModule.state;


/**
 * Sets default field selections for the pivot table
 * Configures initial row, column, and value fields
 */
function setDefaultFields() {
    // Initialize empty fields
    state.rowFields = [];
    state.columnFields = []; 
    state.valueFields = [];
    
    // Initialize the hierarchy expansion state
    core.initializeExpandedNodes();
}


/**
 * Display a status message with type-based styling
 * @param {string} message - The message to display
 * @param {string} type - The type of message (success, error, info)
 * @param {object} elements - DOM elements object containing uploadStatus
 */
function showStatus(message, type, elements) {
    if (elements && elements.uploadStatus) {
        elements.uploadStatus.innerHTML = `<div class="status-bar status-${type}">${message}</div>`;
    } else {
        console.log(`Status (${type}): ${message}`);
    }
}


/**
 * Renders available fields in the field panel
 * @param {object} elements - DOM elements object containing availableFields container
 */
function renderAvailableFields(elements) {
    // Exit if container is not available
    if (!elements.availableFields) return;
    
    // Clear the container
    elements.availableFields.innerHTML = '';
    
    // Group fields by category
    const dimensionFields = state.availableFields.filter(field => field.type === 'dimension');
    const factFields = state.availableFields.filter(field => field.type === 'fact');
    
    // Render dimension section if we have dimension fields
    if (dimensionFields.length > 0) {
        // Create section header
        const dimensionHeader = document.createElement('div');
        dimensionHeader.className = 'field-category-header';
        dimensionHeader.textContent = 'Dimensions';
        elements.availableFields.appendChild(dimensionHeader);
        
        // Add each dimension field
        dimensionFields.forEach(field => {
            const fieldEl = document.createElement('div');
            // Set classes based on field type and hierarchical status
            fieldEl.className = `field dimension-field${field.hierarchical ? ' hierarchical' : ''}`;
            
            // Only allow drag if the field can go in at least one dimension zone
            const canDrag = field.draggableTo && (
                field.draggableTo.includes('row') ||
                field.draggableTo.includes('column') ||
                field.draggableTo.includes('filter')
            );
            fieldEl.setAttribute('draggable', canDrag ? 'true' : 'false');
            fieldEl.setAttribute('data-field', field.id);
            fieldEl.setAttribute('data-type', field.type);
            fieldEl.setAttribute('data-hierarchical', field.hierarchical ? 'true' : 'false');
            fieldEl.setAttribute('data-draggable-to', field.draggableTo.join(','));
            if (!canDrag) fieldEl.classList.add('not-draggable');
            
            // Create and add field label
            const fieldContent = document.createElement('span');
            fieldContent.className = 'field-label';
            fieldContent.textContent = field.label;
            fieldEl.appendChild(fieldContent);
            
            // Add hierarchy icon for hierarchical dimensions
            if (field.hierarchical) {
                const hierarchyIcon = document.createElement('span');
                hierarchyIcon.className = 'hierarchy-icon';
                hierarchyIcon.innerHTML = '&#x1F4C1;'; // Folder icon
                hierarchyIcon.title = 'Hierarchical dimension';
                fieldEl.appendChild(hierarchyIcon);
            }
            
            elements.availableFields.appendChild(fieldEl);
        });
    }
    
    // Render fact (measures) section if we have fact fields
    if (factFields.length > 0) {
        // Create section header
        const factHeader = document.createElement('div');
        factHeader.className = 'field-category-header';
        factHeader.textContent = 'Measures';
        elements.availableFields.appendChild(factHeader);
        
        // Add each fact field
        factFields.forEach(field => {
            const fieldEl = document.createElement('div');
            fieldEl.className = 'field fact-field';
            
            // Only allow drag if the field can go in valueFields
            const canDrag = field.draggableTo && field.draggableTo.includes('value');
            fieldEl.setAttribute('draggable', canDrag ? 'true' : 'false');
            fieldEl.setAttribute('data-field', field.id);
            fieldEl.setAttribute('data-type', field.type);
            fieldEl.setAttribute('data-draggable-to', field.draggableTo.join(','));
            if (!canDrag) fieldEl.classList.add('not-draggable');
            
            // Add measure name attribute if available
            if (field.measureName) {
                fieldEl.setAttribute('data-measure-name', field.measureName);
            }
            
            // Set the field label
            fieldEl.textContent = field.label;
            
            elements.availableFields.appendChild(fieldEl);
        });
    }
}


/**
 * Renders all field containers (row, column, value, filter zones)
 * @param {object} elements - DOM elements object containing field containers
 * @param {object} state - Application state object
 */
function renderFieldContainers(elements, state) {
    // Render each field container zone
    renderFieldContainer(elements.rowFields, state.rowFields);
    renderFieldContainer(elements.columnFields, state.columnFields);
    renderFieldContainer(elements.valueFields, state.valueFields);
    renderFieldContainer(elements.filterFields, state.filterFields);
}


/**
 * Renders a single field container with its fields
 * @param {HTMLElement} container - The container element to render into
 * @param {Array} fieldIds - Array of field IDs to render in this container
 */
function renderFieldContainer(container, fieldIds) {
    // Exit if container is not available
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Add each field to the container
    fieldIds.forEach(fieldId => {
        // Find the field definition
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) return; // Skip if field not found
        
        // Create field element
        const fieldEl = document.createElement('div');
        
        // Set class based on field type and hierarchical status
        let className = `field ${field.type}-field`;
        if (field.hierarchical) className += ' hierarchical';
        fieldEl.className = className;
        
        // Set drag attributes
        fieldEl.setAttribute('draggable', 'true');
        fieldEl.setAttribute('data-field', field.id);
        fieldEl.setAttribute('data-type', field.type);
        fieldEl.setAttribute('data-hierarchical', field.hierarchical ? 'true' : 'false');
        fieldEl.setAttribute('data-draggable-to', field.draggableTo.join(','));
        
        // Add measure name attribute if available
        if (field.measureName) {
            fieldEl.setAttribute('data-measure-name', field.measureName);
        }
        
        // Add field label
        const fieldContent = document.createElement('span');
        fieldContent.className = 'field-label';
        fieldContent.textContent = field.label;
        fieldEl.appendChild(fieldContent);
        
        // Add hierarchy icon for hierarchical dimensions
        if (field.hierarchical) {
            const hierarchyIcon = document.createElement('span');
            hierarchyIcon.className = 'hierarchy-icon';
            hierarchyIcon.innerHTML = '&#x1F4C1;'; // Folder icon
            hierarchyIcon.title = 'Hierarchical dimension';
            fieldEl.appendChild(hierarchyIcon);
        }
        
        container.appendChild(fieldEl);
    });
}


/**
 * Renders filter controls for the active filter fields
 * Creates a tree-style UI for hierarchical dimensions and text inputs for regular dimensions
 */
function renderFilterControls() {
    // Create or get the filter container
    let filterContainer = document.getElementById('pivotFilterControls');
    if (!filterContainer) {
        // Create the container if it doesn't exist
        filterContainer = document.createElement('div');
        filterContainer.id = 'pivotFilterControls';
        filterContainer.className = 'pivot-filter-controls';
        
        // Insert filter container before the pivot table
        const pivotTableContainer = document.getElementById('pivotTableContainer');
        if (pivotTableContainer) {
            pivotTableContainer.parentNode.insertBefore(filterContainer, pivotTableContainer);
        }
    }
    
    // Clear existing filters
    filterContainer.innerHTML = '';
    
    // Hide container if no filter fields
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
    
    // Render each filter field
    state.filterFields.forEach(fieldId => {
        // Find the field definition
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) return; // Skip if field not found
        
        // Create filter control container
        const filterControl = document.createElement('div');
        filterControl.className = 'filter-control';
        
        // Create filter label
        const filterLabel = document.createElement('span');
        filterLabel.className = 'filter-label';
        filterLabel.textContent = field.label + ': ';
        filterControl.appendChild(filterLabel);
        
        // Create different filter controls based on field type
        if (field.hierarchical) {
            // Render tree-style filter for hierarchical dimensions
            renderHierarchicalFilter(filterControl, field, fieldId);
        } else {
            // Render text input filter for non-hierarchical dimensions
            renderTextFilter(filterControl, field, fieldId);
        }
        
        // Add the completed filter control to the container
        filterContainer.appendChild(filterControl);
    });
}


/**
 * Renders a hierarchical tree-style filter for dimension fields
 * @param {HTMLElement} filterControl - The parent filter control element
 * @param {object} field - The field definition
 * @param {string} fieldId - The field ID
 */
function renderHierarchicalFilter(filterControl, field, fieldId) {
    // Get dimension name and hierarchy
    const dimName = field.id.replace('DIM_', '').toLowerCase();
    const hierarchy = state.hierarchies[dimName];
    
    // Only proceed if hierarchy exists and has a root node
    if (hierarchy && hierarchy.root) {
        // Create container for tree control
        const treeContainer = document.createElement('div');
        treeContainer.className = 'filter-tree-container';
        
        // Initialize filter tree state if not already set
        if (!state.filterTreeState) {
            state.filterTreeState = {};
        }
        if (!state.filterTreeState[fieldId]) {
            state.filterTreeState[fieldId] = { 'ROOT': true }; // Root is expanded by default
        }
        
        // Create "All" option at the top
        renderAllOption(treeContainer, fieldId);
        
        // Start building tree from the root node
        buildTreeNode(hierarchy.root, treeContainer, fieldId);
        
        // Add clear button if filter is active
        renderClearButton(treeContainer, fieldId);
        
        // Add the tree container to the filter control
        filterControl.appendChild(treeContainer);
    }
}


/**
 * Renders the "All" option at the top of a hierarchical filter
 * @param {HTMLElement} treeContainer - The tree container element
 * @param {string} fieldId - The field ID
 */
function renderAllOption(treeContainer, fieldId) {
    const allOption = document.createElement('div');
    allOption.className = 'filter-tree-item';
    
    // Create radio button for "All"
    const allRadio = document.createElement('input');
    allRadio.type = 'radio';
    allRadio.name = `filter-${fieldId}`;
    allRadio.value = 'ALL';
    allRadio.id = `filter-${fieldId}-ALL`;
    
    // Check if "All" is selected (no active filter)
    if (!state.activeFilters || !state.activeFilters[fieldId]) {
        allRadio.checked = true;
    }
    
    // Add change event for "All" option
    allRadio.addEventListener('change', function() {
        if (this.checked) {
            // Clear filter for this field
            state.activeFilters = state.activeFilters || {};
            state.activeFilters[fieldId] = null;
            
            // Regenerate pivot table
            generatePivotTable();
        }
    });
    
    // Create label for "All" option
    const allLabel = document.createElement('label');
    allLabel.setAttribute('for', `filter-${fieldId}-ALL`);
    allLabel.textContent = 'All';
    allLabel.className = 'filter-tree-label';
    
    // Add elements to the container
    allOption.appendChild(allRadio);
    allOption.appendChild(allLabel);
    treeContainer.appendChild(allOption);
}


/**
 * Renders a clear button for an active filter
 * @param {HTMLElement} treeContainer - The tree container element
 * @param {string} fieldId - The field ID
 */
function renderClearButton(treeContainer, fieldId) {
    // Only add clear button if filter is active
    if (state.activeFilters && state.activeFilters[fieldId]) {
        const clearButton = document.createElement('button');
        clearButton.className = 'clear-filter';
        clearButton.textContent = 'Clear Filter';
        clearButton.addEventListener('click', function() {
            // Clear the filter
            state.activeFilters[fieldId] = null;
            
            // Check the "All" radio button
            const allRadio = document.getElementById(`filter-${fieldId}-ALL`);
            if (allRadio) allRadio.checked = true;
            
            // Regenerate pivot table
            generatePivotTable();
        });
        
        // Add clear button to control
        const clearContainer = document.createElement('div');
        clearContainer.className = 'filter-clear-container';
        clearContainer.appendChild(clearButton);
        treeContainer.appendChild(clearContainer);
    }
}


/**
 * Renders an expand/collapse control for nodes with children
 * @param {HTMLElement} nodeItem - The node item element
 * @param {object} node - The node data
 * @param {string} fieldId - The field ID
 */
function renderExpandCollapseControl(nodeItem, node, fieldId) {
    const expandControl = document.createElement('span');
    expandControl.className = `expand-collapse ${state.filterTreeState[fieldId][node.id] ? 'expanded' : 'collapsed'}`;
    expandControl.setAttribute('data-node-id', node.id);
    expandControl.setAttribute('data-field-id', fieldId);
    
    // Add expand/collapse functionality
    expandControl.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent radio selection
        
        const nodeId = this.getAttribute('data-node-id');
        const fieldId = this.getAttribute('data-field-id');
        
        // Toggle expanded state
        state.filterTreeState[fieldId][nodeId] = !state.filterTreeState[fieldId][nodeId];
        
        // Toggle expanded/collapsed class
        this.classList.toggle('expanded');
        this.classList.toggle('collapsed');
        
        // Show/hide children container
        const childrenContainer = this.parentElement.nextElementSibling;
        if (childrenContainer && childrenContainer.classList.contains('filter-tree-children')) {
            childrenContainer.style.display = state.filterTreeState[fieldId][nodeId] ? 'block' : 'none';
        }
    });
    
    nodeItem.appendChild(expandControl);
}


/**
 * Renders a radio button for a filter tree node
 * @param {HTMLElement} nodeItem - The node item element
 * @param {object} node - The node data
 * @param {string} fieldId - The field ID
 */
function renderNodeRadioButton(nodeItem, node, fieldId) {
    // Create radio button
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `filter-${fieldId}`;
    radio.value = node.id;
    radio.id = `filter-${fieldId}-${node.id}`;
    
    // Check if this node is selected
    if (state.activeFilters && state.activeFilters[fieldId] === node.id) {
        radio.checked = true;
    }
    
    // Add change event
    radio.addEventListener('change', function() {
        if (this.checked) {
            // Set filter for this field
            state.activeFilters = state.activeFilters || {};
            state.activeFilters[fieldId] = node.id;
            
            // Regenerate pivot table
            generatePivotTable();
        }
    });
    
    // Create label
    const label = document.createElement('label');
    label.setAttribute('for', `filter-${fieldId}-${node.id}`);
    label.textContent = node.label;
    label.className = 'filter-tree-label';
    
    nodeItem.appendChild(radio);
    nodeItem.appendChild(label);
}


/**
 * Renders a container for child nodes
 * @param {HTMLElement} nodeContainer - The parent node container
 * @param {object} node - The parent node data
 * @param {string} fieldId - The field ID
 * @param {number} level - The current indentation level
 */
function renderChildrenContainer(nodeContainer, node, fieldId, level) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'filter-tree-children';
    
    // Set initial display based on expanded state
    const isExpanded = state.filterTreeState[fieldId][node.id];
    childrenContainer.style.display = isExpanded ? 'block' : 'none';
    
    // Add children recursively
    node.children.forEach(child => {
        buildTreeNode(child, childrenContainer, fieldId, level + 1);
    });
    
    nodeContainer.appendChild(childrenContainer);
}


/**
 * Renders a text input filter for non-hierarchical dimensions
 * @param {HTMLElement} filterControl - The filter control element
 * @param {object} field - The field definition
 * @param {string} fieldId - The field ID
 */
function renderTextFilter(filterControl, field, fieldId) {
    // Create text input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'filter-input';
    input.setAttribute('data-field', fieldId);
    input.placeholder = 'Filter value...';
    
    // Set current value if filter is active
    if (state.activeFilters && state.activeFilters[fieldId]) {
        input.value = state.activeFilters[fieldId];
        input.classList.add('has-filter');
    }
    
    // Create apply button
    const button = document.createElement('button');
    button.className = 'filter-button';
    button.textContent = 'Apply';
    button.addEventListener('click', function() {
        applyTextFilter(input);
    });
    
    // Add enter key support for the input
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyTextFilter(input);
        }
    });
    
    // Add elements to the filter control
    filterControl.appendChild(input);
    filterControl.appendChild(button);
    
    // Add clear button if filter is active
    if (state.activeFilters && state.activeFilters[fieldId]) {
        renderTextFilterClearButton(filterControl, input);
    }
}


/**
 * Renders a clear button for text filters
 * @param {HTMLElement} filterControl - The filter control element
 * @param {HTMLInputElement} input - The filter input element
 */
function renderTextFilterClearButton(filterControl, input) {
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-filter';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', function() {
        const fieldId = input.getAttribute('data-field');
        
        // Clear the filter
        state.activeFilters[fieldId] = null;
        input.value = '';
        input.classList.remove('has-filter');
        
        // Remove the clear button
        this.remove();
        
        // Regenerate pivot table
        generatePivotTable();
    });
    
    filterControl.appendChild(clearButton);
}


/**
 * Initializes drag and drop event listeners for the application
 * Sets up global event listeners to handle drag operations
 */
function initDragAndDrop() {
    // Set up drag event listeners for all field containers
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);
    
    // Set up enhanced reordering functionality
    enhanceDragDropReordering();
}


/**
 * Enhances drag and drop to support reordering within zones
 */
function enhanceDragDropReordering() {
    // Get all field containers
    const containers = [
        document.getElementById('rowFields'),
        document.getElementById('columnFields'),
        document.getElementById('valueFields'),
        document.getElementById('filterFields')
    ];
    
    // Add dragover event listeners to each container for reordering
    containers.forEach(container => {
        if (!container) return;
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggedItem = document.querySelector('.dragging');
            if (!draggedItem) return;
            
            // Get the item being dragged over
            const afterElement = getDragAfterElement(container, e.clientY);
            
            // Insert the dragged item at the appropriate position
            if (afterElement) {
                container.insertBefore(draggedItem, afterElement);
            } else {
                container.appendChild(draggedItem);
            }
            
            // Update visual feedback
            e.dataTransfer.dropEffect = 'move';
        });
    });
}


/**
 * Helper function to determine where to insert the dragged item
 * @param {HTMLElement} container - The container element
 * @param {number} y - The vertical mouse position
 * @returns {HTMLElement|null} - The element after which to insert, or null to append
 */
function getDragAfterElement(container, y) {
    // Get all draggable elements in the container that aren't being dragged
    const draggableElements = [...container.querySelectorAll('.field:not(.dragging)')];
    
    // Find the element that comes after the dragged item
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        // If this element is above the mouse but closer than the current closest element
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


/**
 * Handles the start of drag operations
 * Sets up the drag data transfer object with field information
 * 
 * @param {DragEvent} e - The drag start event
 */
function handleDragStart(e) {
    // Only handle draggable field elements
    if (!e.target.classList.contains('field')) return;
    
    // Get field attributes
    const fieldId = e.target.getAttribute('data-field');
    const fieldType = e.target.getAttribute('data-type');
    const isHierarchical = e.target.getAttribute('data-hierarchical') === 'true';
    const draggableTo = e.target.getAttribute('data-draggable-to');
    const sourceContainer = e.target.parentElement.id;
    
    // Set up data transfer with field information
    e.dataTransfer.setData('field', fieldId);
    e.dataTransfer.setData('type', fieldType);
    e.dataTransfer.setData('hierarchical', isHierarchical);
    e.dataTransfer.setData('draggableTo', draggableTo || '');
    e.dataTransfer.setData('source', sourceContainer);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual styling for dragging
    e.target.classList.add('dragging');
}


/**
 * Finds the closest valid drop target container from an element
 * 
 * @param {HTMLElement} element - The element to start searching from
 * @returns {HTMLElement|null} - The found drop target or null if none exists
 */
function getDropTarget(element) {
    let current = element;
    
    // Traverse up the DOM hierarchy to find a valid container
    while (current && 
           !current.classList.contains('pivot-fields') && 
           current.id !== 'availableFields') {
        current = current.parentElement;
    }
    
    return current;
}


/**
 * Handles the drag over event to determine if dropping is allowed
 * Prevents default behavior for valid drop targets
 * 
 * @param {DragEvent} e - The drag over event
 */
function handleDragOver(e) {
    const dropTarget = getDropTarget(e.target);

    if (dropTarget) {
        const targetId = dropTarget.id;
        const dataTransfer = e.dataTransfer;

        let dropAllowed = false;

        // Always allow dropping back to available fields (but only in correct section)
        if (targetId === 'availableFields') {
            const dragging = document.querySelector('.dragging');
            if (dragging) {
                const fieldType = dragging.getAttribute('data-type');
                if (fieldType === 'dimension' && e.target.closest('.field-category-header')?.textContent === 'Dimensions') {
                    dropAllowed = true;
                } else if (fieldType === 'fact' && e.target.closest('.field-category-header')?.textContent === 'Measures') {
                    dropAllowed = true;
                }
            }
        } else {
            const dragging = document.querySelector('.dragging');
            let fieldType = null;
            if (dragging) {
                fieldType = dragging.getAttribute('data-type');
            }
            if (targetId === 'valueFields') {
                if (fieldType === 'fact') {
                    dropAllowed = true;
                }
            } else if (
                targetId === 'rowFields' ||
                targetId === 'columnFields' ||
                targetId === 'filterFields'
            ) {
                if (fieldType === 'dimension') {
                    dropAllowed = true;
                }
            }
        }

        if (dropAllowed) {
            e.preventDefault();
            dataTransfer.dropEffect = 'move';
        } else {
            // Explicitly block forbidden drop
            dataTransfer.dropEffect = 'none';
        }
    }
}


/**
 * Handles the drop event when a field is dropped onto a target container
 * Updates application state based on the field movement
 * Prevents duplications across zones
 * 
 * @param {DragEvent} e - The drop event
 */
function handleDrop(e) {
    e.preventDefault();

    const dropTarget = getDropTarget(e.target);
    if (!dropTarget) return;

    const fieldId = e.dataTransfer.getData('field');
    const fieldType = e.dataTransfer.getData('type');
    const isHierarchical = e.dataTransfer.getData('hierarchical') === 'true';
    const draggableTo = (e.dataTransfer.getData('draggableTo') || '').split(',');
    const sourceContainer = e.dataTransfer.getData('source');
    const targetContainer = dropTarget.id;

    // Strict control: dimensions only in row/column/filter, measures only in valueFields
    if (
        (targetContainer === 'valueFields' && fieldType !== 'fact') ||
        ((targetContainer === 'rowFields' || targetContainer === 'columnFields' || targetContainer === 'filterFields') && fieldType !== 'dimension')
    ) {
        return;
    }

    // Check if drop is allowed based on field type and target zone
    let dropAllowed = false;
    
    if (targetContainer === 'availableFields') {
        // Always allow dropping back to available fields
        dropAllowed = true;
    } else if ((targetContainer === 'rowFields' || 
                targetContainer === 'columnFields' || 
                targetContainer === 'filterFields') && 
               fieldType === 'dimension' && 
               draggableTo.includes(targetContainer.replace('Fields', ''))) {
        dropAllowed = true;
    } else if (targetContainer === 'valueFields' && 
               fieldType === 'fact' && 
               draggableTo.includes('value')) {
        dropAllowed = true;
    }
    
    // If dropping in the same container, update order but don't change containers
    if (sourceContainer === targetContainer) {
        if (dropAllowed) {
            // Update the order without changing containers
            updateFieldOrder();
        }
        return;
    } else if (!dropAllowed) {
        return;
    }
    
    // Check for duplicates before proceeding
    if (targetContainer !== 'availableFields') {
        // Check if the field already exists in the target zone
        const isDuplicate = checkForDuplicate(fieldId, targetContainer);
        if (isDuplicate) {
            console.log(`Field ${fieldId} already exists in ${targetContainer}, skipping addition`);
            return;
        }
    }
    
    // Remove from source container's state array
    if (sourceContainer === 'availableFields') {
        // No need to remove from available fields - it's always there
    } else if (sourceContainer === 'rowFields') {
        state.rowFields = state.rowFields.filter(f => f !== fieldId);
    } else if (sourceContainer === 'columnFields') {
        state.columnFields = state.columnFields.filter(f => f !== fieldId);
    } else if (sourceContainer === 'valueFields') {
        state.valueFields = state.valueFields.filter(f => f !== fieldId);
    } else if (sourceContainer === 'filterFields') {
        state.filterFields = state.filterFields.filter(f => f !== fieldId);
    }
    
    // Add to target container's state array in the correct position
    if (targetContainer === 'availableFields') {
        // No need to add to available fields - fields are always in the available zone
    } else {
        // Insert at the correct position
        insertFieldAtPosition(fieldId, targetContainer);
    }

    // Update the UI
    const elements = {
        rowFields: document.getElementById('rowFields'),
        columnFields: document.getElementById('columnFields'),
        valueFields: document.getElementById('valueFields'),
        filterFields: document.getElementById('filterFields')
    };
    
    // If we added a hierarchical field, initialize its expansion state
    if (isHierarchical && targetContainer !== 'availableFields') {
        const zone = targetContainer.replace('Fields', '');
        core.debugLog("Dropped hierarchical field", {fieldId, zone});
        
        // Only handle row and column zones
        if (zone === 'row' || zone === 'column') {
            initializeHierarchyExpansion(fieldId, zone);
        }
    }

    if (targetContainer === 'filterFields' && window.renderFilterControls) {
        console.log('Field dropped into filter zone, rendering filters');
        window.renderFilterControls();
    }
    
    // Render the updated field containers
    renderFieldContainers(elements, state);
    
    // Regenerate the pivot table
    // if (window.generatePivotTable) {
    //     window.generatePivotTable();
    // }
}


/**
 * Checks if a field already exists in the target container
 * 
 * @param {string} fieldId - The field ID to check
 * @param {string} targetContainer - The target container ID
 * @returns {boolean} - Whether the field already exists in the target
 */
function checkForDuplicate(fieldId, targetContainer) {
    if (targetContainer === 'rowFields') {
        return state.rowFields.includes(fieldId);
    } else if (targetContainer === 'columnFields') {
        return state.columnFields.includes(fieldId);
    } else if (targetContainer === 'valueFields') {
        return state.valueFields.includes(fieldId);
    } else if (targetContainer === 'filterFields') {
        return state.filterFields.includes(fieldId);
    }
    return false;
}


/**
 * Inserts a field at the correct position in a target container
 * 
 * @param {string} fieldId - The field ID to insert
 * @param {string} targetContainer - The target container ID
 */
function insertFieldAtPosition(fieldId, targetContainer) {
    const container = document.getElementById(targetContainer);
    if (!container) return;
    
    // Get the dragged element and all other field elements
    const draggedItem = document.querySelector('.dragging');
    if (!draggedItem) {
        // Fallback to just adding at the end
        if (targetContainer === 'rowFields') {
            state.rowFields.push(fieldId);
        } else if (targetContainer === 'columnFields') {
            state.columnFields.push(fieldId);
        } else if (targetContainer === 'valueFields') {
            state.valueFields.push(fieldId);
        } else if (targetContainer === 'filterFields') {
            state.filterFields.push(fieldId);
        }
        return;
    }
    
    // Find the position based on DOM order
    const fieldElements = Array.from(container.querySelectorAll('.field:not(.dragging)'));
    const nextElement = getDragAfterElement(container, draggedItem.getBoundingClientRect().top);
    
    // Determine the index to insert at
    let insertIndex = nextElement ? 
        fieldElements.indexOf(nextElement) : 
        fieldElements.length;
    
    // Update the appropriate state array
    if (targetContainer === 'rowFields') {
        state.rowFields.splice(insertIndex, 0, fieldId);
    } else if (targetContainer === 'columnFields') {
        state.columnFields.splice(insertIndex, 0, fieldId);
    } else if (targetContainer === 'valueFields') {
        state.valueFields.splice(insertIndex, 0, fieldId);
    } else if (targetContainer === 'filterFields') {
        state.filterFields.splice(insertIndex, 0, fieldId);
    }
}


/**
 * Initialize hierarchy expansion state when a hierarchical field is dropped
 * 
 * @param {string} fieldId - The field ID
 * @param {string} zone - The zone (row/column)
 */
function initializeHierarchyExpansion(fieldId, zone) {
    const dimName = fieldId.replace('DIM_', '').toLowerCase();
    if (['le', 'gmid_display', 'smartcode', 'cost_element'].includes(dimName)) {
        // Initialize expansion state for this dimension if it doesn't exist
        state.expandedNodes[dimName] = state.expandedNodes[dimName] || {};
        state.expandedNodes[dimName][zone] = state.expandedNodes[dimName][zone] || {};
        state.expandedNodes[dimName][zone]['ROOT'] = false;
    }
}


/**
 * Updates the order of fields in state based on current DOM order
 */
function updateFieldOrder() {
    // Get the current order of fields in each container
    const rowFieldElements = Array.from(document.getElementById('rowFields').querySelectorAll('.field'));
    const columnFieldElements = Array.from(document.getElementById('columnFields').querySelectorAll('.field'));
    const valueFieldElements = Array.from(document.getElementById('valueFields').querySelectorAll('.field'));
    const filterFieldElements = Array.from(document.getElementById('filterFields').querySelectorAll('.field'));
    
    // Update state arrays with the new order
    state.rowFields = rowFieldElements.map(el => el.getAttribute('data-field'));
    state.columnFields = columnFieldElements.map(el => el.getAttribute('data-field'));
    state.valueFields = valueFieldElements.map(el => el.getAttribute('data-field'));
    state.filterFields = filterFieldElements.map(el => el.getAttribute('data-field'));
    
    // Regenerate the pivot table with the new field order
    if (window.generatePivotTable) {
        window.generatePivotTable();
    }
}


/**
 * Handles the end of drag operations
 * Cleans up visual styling from dragged elements and updates field order
 * 
 * @param {DragEvent} e - The drag end event
 */
function handleDragEnd(e) {
    // Remove dragging class
    if (e.target.classList.contains('field')) {
        e.target.classList.remove('dragging');
        
        // Update the field order based on the current DOM structure
        updateFieldOrder();
    }
}


// Override console.log to add timestamp
const originalConsoleLog = console.log;
console.log = function(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    originalConsoleLog.apply(console, [`[${timestamp}]`, ...args]);
};


// Function to initialize the enhanced console logger
function initializeEnhancedConsole() {
    console.log("Initializing enhanced console logging...");
    
    // Store the original console methods
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // Override console.log
    console.log = function() {
        // Call the original console.log first
        originalConsoleLog.apply(console, arguments);
        
        // Add message to processing status display
        addToProcessingStatus(arguments[0]);
        
        // Update progress based on message content
        updateProgressFromMessage(arguments[0]);
    };
    
    // Override console.error
    console.error = function() {
        // Call the original console.error
        originalConsoleError.apply(console, arguments);
        
        // Add error message to processing status
        addToProcessingStatus('Error: ' + arguments[0], 'error');
    };
    
    // Override console.warn
    console.warn = function() {
        // Call the original console.warn
        originalConsoleWarn.apply(console, arguments);
        
        // Add warning message to processing status
        addToProcessingStatus('Warning: ' + arguments[0], 'warning');
    };
    
    console.log("Enhanced console logging initialized");
}


/**
 * Set up event handlers for the activity log UI controls
 */
function setupActivityLogControls() {
    // Collapsible functionality
    const collapseBtn = document.getElementById('collapseActivityLog');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', function() {
            const cardBody = this.closest('.card-header').nextElementSibling;
            const icon = this.querySelector('i');
            
            if (cardBody.style.display === 'none') {
                cardBody.style.display = 'block';
                icon.className = 'fas fa-chevron-down';
            } else {
                cardBody.style.display = 'none';
                icon.className = 'fas fa-chevron-up';
            }
        });
    }
    
    // Clear log button
    const clearBtn = document.getElementById('clearLogBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            const logContainer = document.getElementById('activityLog');
            if (logContainer) {
                logContainer.innerHTML = '';
                addLogEntry('Log cleared', 'info');
            }
        });
    }
}


/**
 * Set up console method interception to capture logs to the activity log
 */
function setupConsoleInterception() {
    // Store original console methods
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    
    // Override console.log
    console.log = function() {
        // Call the original method
        originalConsoleLog.apply(console, arguments);
        
        // Add to activity log
        const message = Array.from(arguments).map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry(message, 'info');
    };
    
    // Override console.warn
    console.warn = function() {
        // Call the original method
        originalConsoleWarn.apply(console, arguments);
        
        // Add to activity log
        const message = Array.from(arguments).map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry(message, 'warning');
    };
    
    // Override console.error
    console.error = function() {
        // Call the original method
        originalConsoleError.apply(console, arguments);
        
        // Add to activity log
        const message = Array.from(arguments).map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLogEntry(message, 'error');
    };
    
    // Also add a global function to manually add log entries
    window.addActivityLog = function(message, type = 'info') {
        addLogEntry(message, type);
    };
}


/**
 * Add a log entry to the activity log
 * @param {string} message - The log message
 * @param {string} type - The type of log ('info', 'warning', 'error')
 */
function addLogEntry(message, type = 'info') {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer) return;
    
    // Create log entry element
    const entry = document.createElement('div');
    entry.className = `activity-log-entry activity-log-${type}`;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'activity-log-timestamp';
    timestampSpan.textContent = timestamp;
    
    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.className = 'activity-log-message';
    messageSpan.textContent = message;
    
    // Assemble entry
    entry.appendChild(timestampSpan);
    entry.appendChild(messageSpan);
    
    // Add to log container
    logContainer.appendChild(entry);
    
    // Scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}


// Expose key functions globally
window.activityLog = {
    addEntry: addLogEntry,
    clear: function() {
        const logContainer = document.getElementById('activityLog');
        if (logContainer) {
            logContainer.innerHTML = '';
        }
    }
};


// Add a message to the processing status display
function addToProcessingStatus(message, type = 'info') {
    // Get the processing status container
    const processingStatus = document.getElementById('processingStatus');
    if (!processingStatus) return;
    
    // Create a new message element
    const messageElement = document.createElement('div');
    messageElement.className = `processing-status-message ${type}`;
    
    // Add timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    // Format the message
    messageElement.innerHTML = `<span class="status-timestamp">${timeString}</span>${message}`;
    
    // Add to container
    processingStatus.appendChild(messageElement);
    
    // Scroll to the bottom
    processingStatus.scrollTop = processingStatus.scrollHeight;
    
    // Ensure the loading indicator is visible
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator && loadingIndicator.style.display === 'none') {
        loadingIndicator.style.display = 'flex';
    }
}

// Update progress bar based on message content
function updateProgressFromMessage(message) {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) return;
    
    // Check for specific progress indicators in the message
    if (typeof message === 'string') {
        // Check for percentage indicators
        const percentMatch = message.match(/(\d+)%/);
        if (percentMatch && percentMatch[1]) {
            progressBar.style.width = `${percentMatch[1]}%`;
            return;
        }
        
        // Key processing milestones
        if (message.includes('Initializing') || message.includes('starting')) {
            progressBar.style.width = '10%';
            return;
        }
        
        if (message.includes('loading files') || message.includes('parsing files')) {
            progressBar.style.width = '20%';
            return;
        }
        
        if (message.includes('Building hierarchies') || message.includes('processing hierarchies')) {
            progressBar.style.width = '30%';
            return;
        }
        
        if (message.includes('processDimensionFiles completed')) {
            progressBar.style.width = '50%';
            return;
        }
        
        if (message.includes('Facts Records Loaded')) {
            progressBar.style.width = '75%';
            return;
        }
        
        if (message.includes('Available fields populated') || 
            message.includes('Mappings initialized') ||
            message.includes('Hierarchies built')) {
            progressBar.style.width = '90%';
            return;
        }
        
        if (message.includes('Filters initialized') || 
            message.includes('Processing complete')) {
            progressBar.style.width = '100%';
            
            // Hide loading indicator after a short delay
            setTimeout(() => {
                const loadingIndicator = document.getElementById('loadingIndicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                // Show application content
                const appContent = document.getElementById('appContent');
                if (appContent) {
                    appContent.style.display = 'block';
                }
            }, 1000);
            return;
        }
    }
}


// Function to format numbers with commas for better readability
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Update row counts for all files when data is loaded
function updateFileRowCounts() {
    // Get reference to the application state
    const state = window.stateModule?.state;
    if (!state) return;
    
    // Update FACT_BOM row count
    if (state.factData && state.factData.length) {
        const rowCountElement = document.getElementById('factBOMRows');
        if (rowCountElement) {
            rowCountElement.textContent = formatNumber(state.factData.length) + ' rows';
        }
    }
    
    // Update dimension row counts
    if (state.dimensions) {
        // Update DIM_LE.csv row count
        if (state.dimensions.le) {
            const rowCountElement = document.getElementById('dimLERows');
            if (rowCountElement) {
                rowCountElement.textContent = formatNumber(state.dimensions.le.length) + ' rows';
            }
        }
        
        // Update DIM_COST_ELEMENT.csv row count
        if (state.dimensions.cost_element) {
            const rowCountElement = document.getElementById('dimCostElementRows');
            if (rowCountElement) {
                rowCountElement.textContent = formatNumber(state.dimensions.cost_element.length) + ' rows';
            }
        }
        
        // Update DIM_GMID_DISPLAY.csv row count
        if (state.dimensions.gmid_display) {
            const rowCountElement = document.getElementById('dimGMIDDisplayRows');
            if (rowCountElement) {
                rowCountElement.textContent = formatNumber(state.dimensions.gmid_display.length) + ' rows';
            }
        }
        
        // Update DIM_SMARTCODE.csv row count
        if (state.dimensions.smartcode) {
            const rowCountElement = document.getElementById('dimSmartCodeRows');
            if (rowCountElement) {
                rowCountElement.textContent = formatNumber(state.dimensions.smartcode.length) + ' rows';
            }
        }
    }
}


// Function to setup console log interception to update row counts when appropriate
function setupRowCountUpdates() {
    // Store original console.log
    const originalConsoleLog = console.log;
    
    // Override console.log to detect when files are loaded
    console.log = function() {
        // Call original method
        originalConsoleLog.apply(console, arguments);
        
        // Check if message indicates files were loaded
        if (typeof arguments[0] === 'string') {
            const message = arguments[0];
            
            // When dimensions are loaded or parsing is complete, update counts
            if (message.includes('dimension parse results') || 
                message.includes('Facts Records Loaded') ||
                message.includes('Parsing') && message.includes('complete')) {
                
                // Use setTimeout to ensure state has been updated
                setTimeout(updateFileRowCounts, 100);
            }
        }
    };
    
    // Also update when state changes (for cached data)
    stateModule.setupStateChangeDetection();
}


/**
 * Renders all cells for a multi-dimension row
 * 
 * @param {Object} rowDef - The row definition (single or multi-dimension)
 * @returns {string} - HTML string for all row cells
 */
function renderMultiDimensionRowCells(rowDef) {
    if (!rowDef.dimensions || !Array.isArray(rowDef.dimensions)) {
        // Single dimension - use standard rendering
        const dimName = rowDef.hierarchyField ? rowDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const indentation = rowDef.level ? rowDef.level * 20 : 0;
        
        let cellHtml = `<td class="hierarchy-cell" style="padding-left: ${indentation}px;">`;
        
        if (rowDef.hasChildren) {
            const expandClass = rowDef.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${rowDef._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                title="Expand/collapse this item"></span>`;
        } else {
            cellHtml += `<span class="leaf-node"></span>`;
        }
        
        cellHtml += `<span class="dimension-label">${rowDef.label}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    }

    // Multiple dimensions - render each in its own cell
    let cellsHtml = '';
    rowDef.dimensions.forEach((dimensionDef, index) => {
        cellsHtml += renderDimensionCell(dimensionDef, index);
    });
    
    return cellsHtml;
}


/**
 * Renders a single dimension cell within a multi-dimension row
 * 
 * @param {Object} dimensionDef - The dimension definition
 * @param {number} index - The dimension index
 * @returns {string} - HTML string for the dimension cell
 */
function renderDimensionCell(dimensionDef, index) {
    const dimName = dimensionDef.hierarchyField ? dimensionDef.hierarchyField.replace('DIM_', '').toLowerCase() : '';
    const indentation = dimensionDef.level ? dimensionDef.level * 20 : 0; // 20px per level
    
    // Add cell with proper indentation and expand/collapse control
    let cellHtml = `<td class="hierarchy-cell dimension-cell" 
                       data-dimension="${dimName}" 
                       data-dimension-index="${index}"
                       style="padding-left: ${indentation}px;">`;
    
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
}


/**
 * Determines if a multi-dimension row should be visible based on expansion state
 * 
 * @param {Object} row - The row definition (single or multi-dimension)
 * @param {Array} allRows - All rows in the pivot table
 * @returns {boolean} - Whether the row should be visible
 */
function isMultiDimensionRowVisible(row, allRows) {
    if (!row.dimensions || !Array.isArray(row.dimensions)) {
        // For single dimension rows, use the existing visibility check
        return utils.isNodeVisible(row, allRows);
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
        
        // Use the existing visibility check
        return utils.isNodeVisible(tempRow, allRows);
    });
}


/**
 * Enhanced handleMultiDimensionExpandCollapseClick that uses enhanced toggle function
 */
function handleMultiDimensionExpandCollapseClick(e) {
    const nodeId = e.target.getAttribute('data-node-id');
    const hierarchyName = e.target.getAttribute('data-hierarchy');
    const zone = e.target.getAttribute('data-zone') || 'row';
    const dimensionIndex = parseInt(e.target.getAttribute('data-dimension-index') || '0', 10);
    
    if (nodeId && hierarchyName) {
        // Toggle node expansion in state
        state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
        state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
        state.expandedNodes[hierarchyName][zone][nodeId] = !state.expandedNodes[hierarchyName][zone][nodeId];
        
        // Toggle in the hierarchy structure using enhanced function
        hierarchyHandler.enhancedToggleNodeExpansion(hierarchyName, nodeId, state.hierarchies, zone);
        
        // Update the UI to show the expand/collapse status
        const expandClass = state.expandedNodes[hierarchyName][zone][nodeId] ? 'expanded' : 'collapsed';
        e.target.className = `expand-collapse ${expandClass}`;
        
        // Regenerate pivot table
        generatePivotTable();
        
        // Prevent event from bubbling up
        e.stopPropagation();
    }
}

/**
 * Update table status indicator
 * @param {string} tableName - Table name
 * @param {string} status - Status (waiting, loading, loaded, error)
 * @param {number} rowCount - Number of rows (optional)
 */
function updateTableStatus(tableName, status, rowCount) {
    const normalizedName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const statusElement = document.getElementById(`${normalizedName}Status`);
    const rowCountElement = document.getElementById(`${normalizedName}Rows`);
    
    if (statusElement) {
        statusElement.className = `table-status ${status}`;
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    if (rowCountElement && rowCount !== undefined) {
        rowCountElement.textContent = `${rowCount.toLocaleString()} rows`;
    }
}


// Export signature
export default {
    // Rendering functions
    setDefaultFields,
    renderAvailableFields,
    renderFieldContainers,
    renderFieldContainer,
    renderFilterControls,
    
    // Drag and drop functionality
    initDragAndDrop,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    enhanceDragDropReordering,
    
    // Multi-dimension UI
    renderMultiDimensionRowCells,
    renderDimensionCell,
    isMultiDimensionRowVisible,
    handleMultiDimensionExpandCollapseClick,

    // Others
    initializeEnhancedConsole,
    updateFileRowCounts,
    setupRowCountUpdates,
    addToProcessingStatus,
    updateProgressFromMessage,
    formatNumber,
    setupConsoleInterception,
    setupActivityLogControls,
    addLogEntry,
    renderExpandCollapseControl,
    renderChildrenContainer,
    renderNodeRadioButton,
    showStatus,
    updateTableStatus

  };