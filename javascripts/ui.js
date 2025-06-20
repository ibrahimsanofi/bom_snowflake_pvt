// Enhanced UI module with improved drag/drop restrictions and reset functionality

import core from './core-old.js';
import stateModule from './state.js';

const state = stateModule.state;

/**
 * Sets default field selections for the pivot table
 */
function setDefaultFields() {
    state.rowFields = [];
    state.columnFields = []; 
    state.valueFields = [];
    core.initializeExpandedNodes();
}


/**
 * Renders available fields in the field panel
 * FIXED: Added proper error handling and element validation
 */
function renderAvailableFields(elements) {
    // Validate elements parameter
    if (!elements || !elements.availableFields) {
        console.error("❌ renderAvailableFields called without proper elements parameter");
        // Try to get the element directly if not provided
        const availableFieldsEl = document.getElementById('availableFields');
        if (!availableFieldsEl) {
            console.error("❌ Could not find availableFields element");
            return;
        }
        elements = { availableFields: availableFieldsEl };
    }
    
    elements.availableFields.innerHTML = '';
    
    // Ensure we have available fields
    if (!state.availableFields || !Array.isArray(state.availableFields)) {
        console.warn("⚠️ No available fields to render");
        return;
    }
    
    // Group fields by category
    const dimensionFields = state.availableFields.filter(field => field.type === 'dimension');
    const factFields = state.availableFields.filter(field => field.type === 'fact');
    
    // Render dimension section
    if (dimensionFields.length > 0) {
        const dimensionHeader = document.createElement('div');
        dimensionHeader.className = 'field-category-header';
        dimensionHeader.textContent = 'Dimensions';
        elements.availableFields.appendChild(dimensionHeader);
        
        dimensionFields.forEach(field => {
            const fieldEl = createFieldElement(field, 'dimension');
            elements.availableFields.appendChild(fieldEl);
        });
    }
    
    // Render measures section
    if (factFields.length > 0) {
        const factHeader = document.createElement('div');
        factHeader.className = 'field-category-header';
        factHeader.textContent = 'Measures';
        elements.availableFields.appendChild(factHeader);
        
        factFields.forEach(field => {
            const fieldEl = createFieldElement(field, 'fact');
            elements.availableFields.appendChild(fieldEl);
        });
    }
}

/**
 * Creates a field element with STRICT drag restrictions
 * ENHANCED: More restrictive drag/drop rules
 */
function createFieldElement(field, category) {
    const fieldEl = document.createElement('div');
    
    // Set classes based on field type
    fieldEl.className = `field ${field.type}-field${field.hierarchical ? ' hierarchical' : ''}`;
    
    // STRICT DRAG RESTRICTIONS: Set drag restrictions based on field type
    let draggableTo = [];
    if (field.type === 'dimension') {
        // Dimensions can ONLY go to row/column zones, NOT values
        draggableTo = ['row', 'column', 'available'];
    } else if (field.type === 'fact') {
        // Facts/measures can ONLY go to value zone, NOT row/column
        draggableTo = ['value', 'available'];
    }
    
    fieldEl.setAttribute('draggable', 'true');
    fieldEl.setAttribute('data-field', field.id);
    fieldEl.setAttribute('data-type', field.type);
    fieldEl.setAttribute('data-hierarchical', field.hierarchical ? 'true' : 'false');
    fieldEl.setAttribute('data-draggable-to', draggableTo.join(','));
    
    // Create field content
    const fieldContent = document.createElement('span');
    fieldContent.className = 'field-label';
    fieldContent.textContent = field.label;
    fieldEl.appendChild(fieldContent);
    
    // Add hierarchy icon for hierarchical dimensions
    if (field.hierarchical) {
        const hierarchyIcon = document.createElement('span');
        hierarchyIcon.className = 'hierarchy-icon';
        hierarchyIcon.innerHTML = '&#x1F4C1;';
        hierarchyIcon.title = 'Hierarchical dimension';
        fieldEl.appendChild(hierarchyIcon);
    }
    
    // Add type indicator
    const typeIndicator = document.createElement('span');
    typeIndicator.className = `type-indicator ${field.type}-indicator`;
    typeIndicator.textContent = field.type === 'dimension' ? 'D' : 'M';
    typeIndicator.title = field.type === 'dimension' ? 'Dimension' : 'Measure';
    fieldEl.appendChild(typeIndicator);
    
    return fieldEl;
}


/**
 * Renders all field containers
 */
function renderFieldContainers(elements, state) {
    renderFieldContainer(elements.rowFields, state.rowFields);
    renderFieldContainer(elements.columnFields, state.columnFields);
    renderFieldContainer(elements.valueFields, state.valueFields);
    if (elements.filterFields) {
        renderFieldContainer(elements.filterFields, state.filterFields);
    }
}


/**
 * Renders a single field container with its fields
 */
function renderFieldContainer(container, fieldIds) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!fieldIds || !Array.isArray(fieldIds)) {
        return;
    }
    
    fieldIds.forEach(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) return;
        
        const fieldEl = createFieldElement(field);
        container.appendChild(fieldEl);
    });
}


/**
 * Initializes drag and drop with enhanced restrictions
 */
function initDragAndDrop() {
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);
    
    enhanceDragDropReordering();
}


/**k
 * Enhanced drag and drop reordering
 */
function enhanceDragDropReordering() {
    const containers = [
        document.getElementById('rowFields'),
        document.getElementById('columnFields'),
        document.getElementById('valueFields'),
        document.getElementById('filterFields')
    ].filter(Boolean);
    
    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggedItem = document.querySelector('.dragging');
            if (!draggedItem) return;
            
            const afterElement = getDragAfterElement(container, e.clientY);
            
            if (afterElement) {
                container.insertBefore(draggedItem, afterElement);
            } else {
                container.appendChild(draggedItem);
            }
            
            e.dataTransfer.dropEffect = 'move';
        });
    });
}


/**
 * Helper function to determine insertion point during drag
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.field:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


/**
 * Enhanced drag start handler
 */
function handleDragStart(e) {
    if (!e.target.classList.contains('field')) return;
    
    const fieldId = e.target.getAttribute('data-field');
    const fieldType = e.target.getAttribute('data-type');
    const isHierarchical = e.target.getAttribute('data-hierarchical') === 'true';
    const draggableTo = e.target.getAttribute('data-draggable-to');
    const sourceContainer = e.target.parentElement.id;
    
    e.dataTransfer.setData('field', fieldId);
    e.dataTransfer.setData('type', fieldType);
    e.dataTransfer.setData('hierarchical', isHierarchical);
    e.dataTransfer.setData('draggableTo', draggableTo || '');
    e.dataTransfer.setData('source', sourceContainer);
    e.dataTransfer.effectAllowed = 'move';
    
    e.target.classList.add('dragging');
}


/**
 * Enhanced drag over handler with strict restrictions
 */
function handleDragOver(e) {
    const dropTarget = getDropTarget(e.target);
    if (!dropTarget) return;
    
    const targetId = dropTarget.id;
    const dragging = document.querySelector('.dragging');
    
    if (!dragging) return;
    
    const fieldType = dragging.getAttribute('data-type');
    const draggableTo = dragging.getAttribute('data-draggable-to');
    
    let dropAllowed = false;
    let targetZone = '';
    
    // Determine target zone from element ID
    if (targetId === 'availableFields') {
        targetZone = 'available';
        dropAllowed = true; // Always allow dropping back to available fields
    } else if (targetId === 'rowFields') {
        targetZone = 'row';
    } else if (targetId === 'columnFields') {
        targetZone = 'column';
    } else if (targetId === 'valueFields') {
        targetZone = 'value';
    }
    
    // STRICT ENFORCEMENT: Check if the target zone is allowed for this field type
    if (targetZone !== 'available') {
        if (fieldType === 'dimension' && (targetZone === 'row' || targetZone === 'column')) {
            dropAllowed = true;
        } else if (fieldType === 'fact' && targetZone === 'value') {
            dropAllowed = true;
        } else {
            dropAllowed = false;
        }
    }
    
    // Also check the draggableTo attribute as a secondary validation
    if (draggableTo && !draggableTo.split(',').includes(targetZone)) {
        dropAllowed = false;
    }
    
    if (dropAllowed) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Add visual feedback
        dropTarget.classList.add('drag-over');
        dropTarget.classList.remove('drag-invalid');
    } else {
        e.dataTransfer.dropEffect = 'none';
        dropTarget.classList.remove('drag-over');
        dropTarget.classList.add('drag-invalid');
        
        // Show visual feedback for invalid drop
        showInvalidDropFeedback(dropTarget, fieldType, targetZone);
    }
}


/**
 * Enhanced drop handler
 */
function handleDrop(e) {
    e.preventDefault();
    
    // Remove visual feedback
    document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => {
        el.classList.remove('drag-over', 'drag-invalid');
    });
    
    // Hide any tooltips
    document.querySelectorAll('.invalid-drop-tooltip').forEach(el => {
        el.style.display = 'none';
    });
    
    const dropTarget = getDropTarget(e.target);
    if (!dropTarget) return;
    
    const fieldId = e.dataTransfer.getData('field');
    const fieldType = e.dataTransfer.getData('type');
    const sourceContainer = e.dataTransfer.getData('source');
    const targetContainer = dropTarget.id;
    
    // STRICT VALIDATION: Validate drop based on field type restrictions
    let dropAllowed = false;
    let errorMessage = '';
    
    if (targetContainer === 'availableFields') {
        dropAllowed = true;
    } else if ((targetContainer === 'rowFields' || targetContainer === 'columnFields') && fieldType === 'dimension') {
        dropAllowed = true;
    } else if (targetContainer === 'valueFields' && fieldType === 'fact') {
        dropAllowed = true;
    } else {
        // Provide specific error messages
        if (fieldType === 'dimension' && targetContainer === 'valueFields') {
            errorMessage = 'Dimensions cannot be dropped into the Values area. Only measures are allowed there.';
        } else if (fieldType === 'fact' && (targetContainer === 'rowFields' || targetContainer === 'columnFields')) {
            errorMessage = 'Measures cannot be dropped into Row or Column areas. Only dimensions are allowed there.';
        }
        // } else {
        //     errorMessage = `${fieldType} fields cannot be dropped in ${targetContainer}`;
        // }
    }
    
    if (!dropAllowed) {
        console.warn(`❌ Drop rejected: ${errorMessage}`);
        
        // Show user-friendly error message
        showUserErrorMessage(errorMessage);
        return;
    }
    
    // Check for duplicates
    if (targetContainer !== 'availableFields' && targetContainer !== sourceContainer) {
        if (checkForDuplicate(fieldId, targetContainer)) {
            const duplicateMessage = `Field ${fieldId} already exists in ${targetContainer}`;
            console.log(`❌ ${duplicateMessage}`);
            showUserErrorMessage(duplicateMessage);
            return;
        }
    }
    
    // Remove from source
    removeFieldFromContainer(fieldId, sourceContainer);
    
    // Add to target (if not available fields)
    if (targetContainer !== 'availableFields') {
        insertFieldAtPosition(fieldId, targetContainer);
    }
    
    // Update UI
    const elements = {
        rowFields: document.getElementById('rowFields'),
        columnFields: document.getElementById('columnFields'),
        valueFields: document.getElementById('valueFields'),
        filterFields: document.getElementById('filterFields'),
        availableFields: document.getElementById('availableFields')
    };
    
    renderFieldContainers(elements, state);
    renderAvailableFields(elements);
}


/**
 * Show user-friendly error message
 */
function showUserErrorMessage(message) {
    // Create or get existing error message container
    let errorContainer = document.querySelector('.field-drop-error');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'field-drop-error';
        
        // Style the error container
        errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        document.body.appendChild(errorContainer);
    }
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        if (errorContainer && errorContainer.parentNode) {
            errorContainer.style.display = 'none';
        }
    }, 4000);
}


/**
 * Show visual feedback for invalid drops
 */
function showInvalidDropFeedback(dropTarget, fieldType, targetZone) {
    // Create or update tooltip showing why drop is invalid
    let tooltip = dropTarget.querySelector('.invalid-drop-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'invalid-drop-tooltip';
        dropTarget.appendChild(tooltip);
    }
    
    let message = '';
    if (fieldType === 'dimension' && targetZone === 'value') {
        message = 'Dimensions cannot be used as measures';
    } else if (fieldType === 'fact' && (targetZone === 'row' || targetZone === 'column')) {
        message = 'Measures cannot be used as dimensions';
    }
    
    tooltip.textContent = message;
    tooltip.style.display = 'block';
    
    // Hide tooltip after 2 seconds
    setTimeout(() => {
        if (tooltip && tooltip.parentNode) {
            tooltip.style.display = 'none';
        }
    }, 2000);
}


/**
 * Remove field from source container
 */
function removeFieldFromContainer(fieldId, sourceContainer) {
    switch (sourceContainer) {
        case 'rowFields':
            state.rowFields = state.rowFields.filter(f => f !== fieldId);
            break;
        case 'columnFields':
            state.columnFields = state.columnFields.filter(f => f !== fieldId);
            break;
        case 'valueFields':
            state.valueFields = state.valueFields.filter(f => f !== fieldId);
            break;
        case 'filterFields':
            if (state.filterFields) {
                state.filterFields = state.filterFields.filter(f => f !== fieldId);
            }
            break;
    }
}


/**
 * Insert field at correct position in target container
 */
function insertFieldAtPosition(fieldId, targetContainer) {
    const container = document.getElementById(targetContainer);
    if (!container) return;
    
    const draggedItem = document.querySelector('.dragging');
    const fieldElements = Array.from(container.querySelectorAll('.field:not(.dragging)'));
    const nextElement = getDragAfterElement(container, draggedItem ? draggedItem.getBoundingClientRect().top : 0);
    
    let insertIndex = nextElement ? fieldElements.indexOf(nextElement) : fieldElements.length;
    
    switch (targetContainer) {
        case 'rowFields':
            state.rowFields.splice(insertIndex, 0, fieldId);
            break;
        case 'columnFields':
            state.columnFields.splice(insertIndex, 0, fieldId);
            break;
        case 'valueFields':
            state.valueFields.splice(insertIndex, 0, fieldId);
            break;
        case 'filterFields':
            if (!state.filterFields) state.filterFields = [];
            state.filterFields.splice(insertIndex, 0, fieldId);
            break;
    }
}


/**
 * Check for duplicate fields in target container
 */
function checkForDuplicate(fieldId, targetContainer) {
    switch (targetContainer) {
        case 'rowFields':
            return state.rowFields.includes(fieldId);
        case 'columnFields':
            return state.columnFields.includes(fieldId);
        case 'valueFields':
            return state.valueFields.includes(fieldId);
        case 'filterFields':
            return state.filterFields && state.filterFields.includes(fieldId);
        default:
            return false;
    }
}


/**
 * Find closest valid drop target
 */
function getDropTarget(element) {
    let current = element;
    
    while (current && 
           !current.classList.contains('pivot-fields') && 
           current.id !== 'availableFields') {
        current = current.parentElement;
    }
    
    return current;
}


/**
 * Clean up after drag operation
 */
function handleDragEnd(e) {
    if (e.target.classList.contains('field')) {
        e.target.classList.remove('dragging');
        updateFieldOrder();
    }
    
    // Remove all visual feedback
    document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => {
        el.classList.remove('drag-over', 'drag-invalid');
    });
    
    // Hide any tooltips
    document.querySelectorAll('.invalid-drop-tooltip').forEach(el => {
        el.style.display = 'none';
    });
}


/**
 * Update field order based on current DOM structure
 */
function updateFieldOrder() {
    const containers = {
        rowFields: document.getElementById('rowFields'),
        columnFields: document.getElementById('columnFields'),
        valueFields: document.getElementById('valueFields'),
        filterFields: document.getElementById('filterFields')
    };

    Object.entries(containers).forEach(([key, container]) => {
        if (container) {
            const fieldElements = Array.from(container.querySelectorAll('.field'));
            const fieldIds = fieldElements.map(el => el.getAttribute('data-field'));
            
            switch (key) {
                case 'rowFields':
                    state.rowFields = fieldIds;
                    break;
                case 'columnFields':
                    state.columnFields = fieldIds;
                    break;
                case 'valueFields':
                    state.valueFields = fieldIds;
                    break;
                case 'filterFields':
                    state.filterFields = fieldIds;
                    break;
            }
        }
    });
}


/**
 * Enhanced Reset UI functionality
 */
function handleResetUI(e) {
    if (e) e.preventDefault();
    
    console.log("⏳ Resetting UI - Clearing all field zones...");
    
    // Clear all field arrays in state
    state.rowFields = [];
    state.columnFields = [];
    state.valueFields = [];
    if (state.filterFields) {
        state.filterFields = [];
    }
    
    // Get field containers with error handling
    const elements = {
        rowFields: document.getElementById('rowFields'),
        columnFields: document.getElementById('columnFields'),
        valueFields: document.getElementById('valueFields'),
        filterFields: document.getElementById('filterFields'),
        availableFields: document.getElementById('availableFields')
    };
    
    // Validate that we found the elements
    const missingElements = Object.entries(elements)
        .filter(([key, element]) => !element && key !== 'filterFields')
        .map(([key]) => key);
    
    if (missingElements.length > 0) {
        console.error(`❌ Missing UI elements for reset: ${missingElements.join(', ')}`);
        return;
    }
    
    // Clear all field containers
    Object.values(elements).forEach(container => {
        if (container) container.innerHTML = '';
    });
    
    // Re-render available fields to restore all fields
    renderAvailableFields(elements);
    
    // Clear pivot table
    const pivotTableHeader = document.getElementById('pivotTableHeader');
    const pivotTableBody = document.getElementById('pivotTableBody');
    
    if (pivotTableHeader) pivotTableHeader.innerHTML = '';
    if (pivotTableBody) pivotTableBody.innerHTML = '';
    
    console.log("✅ UI Reset complete - All fields returned to Available Fields");
}


/**
 * Initialize Reset UI button
 */
function initializeResetUIButton() {
    const resetButton = document.getElementById('resetBtn');
    if (resetButton) {
        resetButton.addEventListener('click', handleResetUI);
        console.log("✅ Reset UI button initialized");
    }
}


/**
 * Setup Reset UI functionality
 */
function setupResetUI() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeResetUIButton();
    } else {
        document.addEventListener('DOMContentLoaded', initializeResetUIButton);
    }
}


// Function to initialize the enhanced console logger
function initializeEnhancedConsole() {
    console.log("✅ Status: Initializing enhanced console logging...");
    
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
    
    console.log("✅ Status: Enhanced console logging initialized");
}


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


// Export functions
export default {
    setupRowCountUpdates,
    updateTableStatus,
    addLogEntry,
    setupActivityLogControls,
    updateProgressFromMessage,
    setupConsoleInterception,
    setDefaultFields,
    renderAvailableFields,
    renderFieldContainers,
    renderFieldContainer,
    createFieldElement,
    initDragAndDrop,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    enhanceDragDropReordering,
    handleResetUI,
    initializeResetUIButton,
    setupResetUI,
    removeFieldFromContainer,
    insertFieldAtPosition,
    checkForDuplicate,
    updateFieldOrder,
    initializeEnhancedConsole,
    addToProcessingStatus
};