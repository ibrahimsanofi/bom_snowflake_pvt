// This module initialize the application

// First import the state module since it's needed by all other modules
import stateModule from './state.js';

// Then import other modules
import pivotTable from './pivot-table.js';
import core from './core.js';
import data from './data.js';
import filters from './filters.js';
import ui from './ui.js';

/**
 * Initialize the application. This should be called when the DOM is loaded
 */
function initializeApp() {
    console.log("Initializing BOM Analysis application...");
    
    // First initialize the state
    const state = stateModule.state;

    // Set the state in the core module
    core.setState(state);
    
    // Now we can initialize expanded nodes
    core.initializeExpandedNodes();
    
    // Make state accessible globally for debugging
    window.appState = state;
    
    // Initialize pivot table with proper element references
    // Create a wrapper for generatePivotTable that automatically gets elements
    const originalGeneratePivotTable = pivotTable.generatePivotTable;
    pivotTable.generatePivotTable = function() {
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
        return originalGeneratePivotTable.call(this, elements);
    };
    
    // Initialize pivot table
    pivotTable.init(state);
    
    // Make modules available globally
    window.App = {
        state: state,
        core: core,
        data: data,
        filters: filters,
        ui: ui,
        pivotTable: pivotTable,
        
        // Add the init function for reuse
        init: initializeApp
    };
    
    // Get DOM elements
    const elements = core.getDomElements();
    
    // Set up console enhancements
    ui.initializeEnhancedConsole();
    ui.setupConsoleInterception();
    ui.setupActivityLogControls();
    
    // Initialize UI
    ui.initDragAndDrop();
    
    // Auto-load files
    data.autoLoadFiles(elements);
    
    // Add console listener for row count updates
    ui.setupRowCountUpdates();

    // Initialize filters
    filters.initializeFilterSystem();
    
    // Set up tab switching
    if (elements.tabs && elements.tabs.length > 0) {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Switch tabs
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Switch content
                const tabName = tab.getAttribute('data-tab');
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}TabContent`) {
                        content.classList.add('active');
                    }
                });
                
                // If switching to pivot tab, update the pivot table
                if (tabName === 'pivot') {
                    // The wrapped function will automatically get the elements
                    pivotTable.generatePivotTable();
                }
            });
        });
    }
    
    // After pivot table initialization in app-init.js:
    // Add a simple refresh function that can be called from the UI
    window.refreshPivotTable = function() {
        // Get the pivot table elements
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
        
        // Check if we have valid elements
        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Pivot table elements not found!");
            return;
        }
        
        // Refresh the pivot table
        if (pivotTable && pivotTable.generatePivotTable) {
            pivotTable.generatePivotTable(elements);
        }
        
        console.log("Pivot table refreshed");
    };

    // If you have a refresh button on your UI, add this handler:
    const refreshButton = document.querySelector('.refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', window.refreshPivotTable);
    }

    console.log("Application initialization complete");
}

// Call initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export the initialization function
export default { initializeApp };