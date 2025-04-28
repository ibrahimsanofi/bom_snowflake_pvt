// Simple integration script for BOM Analysis Pivot Table fixes

import { generatePivotTable } from './pivot-table-fix.js';

/**
 * Initialize all improvements
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing BOM Analysis Suite improvements');
    
    // Store original pivot table generation function
    if (window.generatePivotTable && !window.originalGeneratePivotTable) {
        window.originalGeneratePivotTable = window.generatePivotTable;
    } else if (window.App?.pivotTable?.generatePivotTable && !window.originalGeneratePivotTable) {
        window.originalGeneratePivotTable = window.App.pivotTable.generatePivotTable.bind(window.App.pivotTable);
    }
    
    // Override with our filtered version
    window.generatePivotTable = generatePivotTable;
    
    // Add a refreshPivotTable function that applies filters first
    window.refreshPivotTable = function() {
        // Get reference to the filter renderer
        const filterRenderer = window.EnhancedFilterRenderer || {};
        
        // First apply any filters
        if (filterRenderer.applyFilters) {
            filterRenderer.applyFilters();
        }
        
        // Then generate the pivot table
        if (window.generatePivotTable) {
            window.generatePivotTable();
        }
    };
    
    // If refresh button exists, bind it to our function
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.refreshPivotTable);
    }
    
    // Export filter renderer to window for global access
    if (typeof EnhancedFilterRenderer !== 'undefined') {
        window.EnhancedFilterRenderer = EnhancedFilterRenderer;
    }
    
    console.log('BOM Analysis Suite improvements initialized');
});

// Fix for table row expansion/collapse
document.addEventListener('click', function(event) {
    // Check if clicked element is an expand/collapse control in the pivot table
    if (event.target.classList.contains('expand-collapse') && 
        (event.target.closest('#pivotTableHeader') || event.target.closest('#pivotTableBody'))) {
        
        const nodeId = event.target.getAttribute('data-node-id');
        const hierarchyName = event.target.getAttribute('data-hierarchy');
        const zone = event.target.getAttribute('data-zone') || 'row';
        
        console.log("Expand/collapse clicked:", { nodeId, hierarchyName, zone });
        
        // Get state reference
        const state = window.stateModule?.state;
        if (!state || !state.hierarchies || !state.hierarchies[hierarchyName]) {
            console.error("Cannot access state or hierarchy");
            return;
        }
        
        // Find the node
        const node = state.hierarchies[hierarchyName].nodesMap?.[nodeId];
        if (!node) {
            console.error(`Node ${nodeId} not found`);
            return;
        }
        
        // Toggle expansion state
        state.expandedNodes = state.expandedNodes || {};
        state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
        state.expandedNodes[hierarchyName][zone] = state.expandedNodes[hierarchyName][zone] || {};
        state.expandedNodes[hierarchyName][zone][nodeId] = !state.expandedNodes[hierarchyName][zone][nodeId];
        
        // Update node expanded property
        node.expanded = state.expandedNodes[hierarchyName][zone][nodeId];
        
        // Update UI
        event.target.classList.toggle('expanded');
        event.target.classList.toggle('collapsed');
        
        // Refresh pivot table
        if (window.refreshPivotTable) {
            window.refreshPivotTable();
        }
        
        // Prevent event bubbling
        event.stopPropagation();
    }
});