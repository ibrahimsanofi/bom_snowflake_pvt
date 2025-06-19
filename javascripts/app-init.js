// This module initialize the application

// State module is imported since it's needed by all other modules
import stateModule from './state.js';

// Other relevant modules are imported too
import pivotTable from './pivot-table.js';
import core from './core.js';
import data from './data.js';
import ui from './ui.js';
import { initializeFilterSystem } from './pivot-filtering-system.js';


let isConnectingToDatabase = false; // Flag global


/**
 * This function initializes the application. It is called when the DOM is loaded
 */
function initializeApp() {
    
    // STEP 1:  First initialize the state
    const state = stateModule.state;

    // Set the state in the core module
    core.setState(state);

    // Make state accessible globally for debugging
    window.appState = state;    

    // STEP 2: Get DOM elements
    const elements = core.getDomElements();
    
    // STEP 3:  Set up console enhancements
    ui.initializeEnhancedConsole();
    ui.setupConsoleInterception();
    ui.setupActivityLogControls();

    console.log("✅ Status: Initializing BOM Analysis application...");        

    // STEP 4: Now we can initialize expanded nodes & filter system
    try{
        core.initializeExpandedNodes();
       
    } catch (expandError)
    {
        console.error("❌ Alert! Error initializing expanded nodes:", expandError);
    }        

    // STEP 5: Initialize pivot table with proper element references
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

    // STEP 6: Make modules available globally
    window.App = {
        state: state,
        core: core,
        data: data,
        ui: ui,
        pivotTable: pivotTable,
        
        // Add the init function for reuse
        init: initializeApp
    };

    
    // STEP 7: 
    // Initialize UI
    ui.initDragAndDrop();

    // Set up database connection
    setupDatabaseConnection(elements);

    // PHASE 1 CHANGE: Load only dimension data instead of all data
    loadDimensionDataFromDatabase(elements);

    // Initialize filtering system after dimension data is loaded
    setTimeout(() => {
        initializeFilterSystem();
    }, 1500);    

    // Add console listener for row count updates
    ui.setupRowCountUpdates();
    

    // STEP 8: Set up tab switching
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
                    // ENHANCEMENT: Ensure hierarchy state is preserved when switching tabs
                    setTimeout(() => {
                        if (window.App && window.App.pivotTable) {
                            // Only regenerate if we have data
                            if (window.App.state.factData && window.App.state.factData.length > 0) {
                                window.App.pivotTable.generatePivotTable();
                            }
                        }
                    }, 100); // Small delay to ensure tab switch is complete
                }
            });
        });
    }

    // STEP 9: Add a simple refresh function that can be called from the UI
    window.refreshPivotTable = function() {
        // Get the pivot table elements
        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
        
        // Check if we have valid elements
        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("❌ Alert! Pivot table elements not found!");
            return;
        }
        
        // Apply filters if we have any active
        const hasActiveFilters = state.filters && 
            Object.values(state.filters).some(filter => filter && filter.length > 0);
        
        if (hasActiveFilters && data.preFilterData) {
            // Use filtered data for pivot table generation
            const filteredData = data.preFilterData(state.factData);
            state.filteredData = filteredData;
        }
        
        // Refresh the pivot table (this will respect current hierarchy expansion states)
        if (pivotTable && pivotTable.generatePivotTable) {
            pivotTable.generatePivotTable(elements);
        }
        
        console.log("✅ Status: Pivot table refreshed");
    };

    // 4. Add a new function to reset hierarchies to collapsed state:
    window.resetHierarchyToCollapsed = function() {
        if (window.App && window.App.pivotTable) {
            console.log("🔒 Resetting all hierarchies to collapsed state...");
            window.App.pivotTable.initializeHierarchyCollapsedState();
            window.App.pivotTable.generatePivotTable();
            console.log("✅ Status: Hierarchies reset to collapsed state");
        }
    };

    // 5. Add debugging function for hierarchy state:
    window.debugHierarchyState = function(dimensionName) {
        const state = window.App?.state || window.appState;
        if (!state) {
            console.log("❌ No state available");
            return;
        }
        
        console.log(`=== HIERARCHY DEBUG: ${dimensionName || 'ALL'} ===`);
        
        if (dimensionName) {
            // Debug specific dimension
            const hierarchy = state.hierarchies?.[dimensionName];
            if (hierarchy && hierarchy.nodesMap) {
                Object.entries(hierarchy.nodesMap).forEach(([nodeId, node]) => {
                    const expandedState = state.expandedNodes?.[dimensionName]?.row?.[nodeId];
                    console.log(`Node: ${nodeId} (${node.label}) - Expanded: ${expandedState}, HasChildren: ${!!(node.children && node.children.length > 0)}`);
                });
            }
        } else {
            // Debug all dimensions
            const rowFields = state.rowFields || [];
            rowFields.forEach(field => {
                const dimName = field.replace('DIM_', '').toLowerCase();
                console.log(`\n--- ${dimName.toUpperCase()} ---`);
                window.debugHierarchyState(dimName);
            });
        }
        
        console.log(`=== END DEBUG ===`);
    };

    // STEP 10: For data refresh:
    const refreshButton = document.querySelector('#refreshBtn');
    if (refreshButton) {
        refreshButton.addEventListener('click', window.refreshPivotTable);
    }
    
    // STEP 11: Add handler for load data button
    const loadDataBtn = document.getElementById('loadDataBtn');
    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', function() {
            // PHASE 1 CHANGE: Load fact data on demand
            loadFactDataFromDatabase(elements);
        });
    }    
    
    // STEP 12: Add handler for reconnect button
    const reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.addEventListener('click', function() {
            reconnectToDatabase(elements);
        });
    }

    console.log("✅ Status: Application initialization complete");
}


/**
 * Set up the initial database connection
 * @param {Object} elements - DOM elements
 */
function setupDatabaseConnection(elements) {
    try{
        if (isConnectingToDatabase) {
                console.log('⏳ Status: Connection already in progress, waiting...');
                return;
        }

        isConnectingToDatabase = true;

        try {
            // Update connection status to connecting
            updateConnectionStatus('connecting', 'Connecting to Snowflake database...');

            // Check if the backend server is available
            fetch('http://localhost:3000/api/get_bom_dim')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                // Successfully connected to the server
                updateConnectionStatus('success', 'Connected to Snowflake database');
                
                // Parse the dimension names
                const availableDimensions = text
                    .split('\n')
                    .filter(Boolean)
                    .map(line => {
                        try {
                            const obj = JSON.parse(line);
                            const key = Object.keys(obj).find(k => typeof obj[k] === 'string');
                            return obj[key];
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean);
                
                console.log(`✅ Status: Available dimensions: ${availableDimensions.join(', ')}`);
                
                // Store available tables in state
                if (window.App && window.App.state) {
                    window.App.state.availableTables = availableDimensions;
                }
                
                // Update UI
                updateTableStatuses(availableDimensions, 'waiting');
                isConnectingToDatabase = false;
        })
        } catch(error) {
                
            }
        }
    catch(error){
        console.error('❌ Alert! Error setting up database connection:', error);
        updateConnectionStatus('error', 'Error setting up database connection')
        updateConnectionStatus('error', 'Error setting up database connection');
        isConnectingToDatabase = false;
    };
}


/**
 * PHASE 1 CHANGE: Load only dimension data from the database
 * @param {Object} elements - DOM elements
 */
function loadDimensionDataFromDatabase(elements) {
    console.log("✅ Status: Starting dimension data loading from Snowflake database");
    
    // Load only the dimension data
    data.ingestDimensionData(elements);
    
    console.log("✅ Status: Snowflake dimension data loading completed successfully");
    
    // CRITICAL: Initialize hierarchy collapsed state AFTER dimension data is loaded
    // setTimeout(() => {
    //     if (window.App && window.App.pivotTable && window.App.state.hierarchies) {
    //         console.log("🔒 Initializing hierarchy collapsed state after dimension data load...");
    //         window.App.pivotTable.initializeHierarchyCollapsedState();
    //     }
    // }, 1000); // Wait 1 second for data processing to complete
    
    console.log('✅ Status: Ready for fact data loading and pivot table operations.');
}


/**
 * PHASE 1 ADDITION: Load fact data on demand
 * @param {Object} elements - DOM elements
 */
function loadFactDataFromDatabase(elements) {
    console.log("✅ Status: Starting fact data loading from Snowflake database");
    
    // Load the fact data
    data.ingestFactData(elements);
    
    console.log("✅ Status: Snowflake fact data loading completed successfully");
    
    // Generate initial pivot table after fact data is loaded
    setTimeout(() => {
        if (window.App && window.App.pivotTable && window.App.state.factData && window.App.state.factData.length > 0) {
            console.log("📊 Generating initial pivot table with fact data...");
            
            if (window.App.pivotTable.generatePivotTable) {
                window.App.pivotTable.generatePivotTable();
            }
        }
    }, 500); // Wait 0.5 seconds for data processing to complete
}


/**
 * Load data from the database
 * @param {Object} elements - DOM elements
 */
// function loadDataFromDatabase(elements) {
//     console.log("✅ Status: Starting data loading from Snowflake database");
    
//     // Load the data first
//     data.ingestData(elements);
    
//     console.log("✅ Status: Snowflake data loading completed successfully");
    
//     // CRITICAL: Initialize hierarchy collapsed state AFTER data is loaded
//     // setTimeout(() => {
//     //     if (window.App && window.App.pivotTable && window.App.state.factData && window.App.state.factData.length > 0) {
//     //         console.log("🔒 Initializing hierarchy collapsed state after data load...");
//     //         window.App.pivotTable.initializeHierarchyCollapsedState();
            
//     //         // Generate initial pivot table with collapsed hierarchies
//     //         if (window.App.pivotTable.generatePivotTable) {
//     //             window.App.pivotTable.generatePivotTable();
//     //         }
//     //     }
//     // }, 1000); // Wait 1 second for data processing to complete
    
//     console.log('✅ Status: Drag and drop tasks can start.');
// }


/**
 * Reconnect to the database
 * @param {Object} elements - DOM elements
 */
function reconnectToDatabase(elements) {
    // Update connection status
    updateConnectionStatus('connecting', 'Reconnecting to database...');
    
    // Reset table statuses
    updateTableStatuses(window.App.state.availableTables, 'waiting');
    
    // Call setup again
    setupDatabaseConnection(elements);
}



/**
 * Update the connection status in the UI
 * @param {string} status - Status type (connecting, success, error)
 * @param {string} message - Status message
 */
function updateConnectionStatus(status, message) {
    const connectionStatus = document.getElementById('connectionStatus');
    if (!connectionStatus) return;
    
    let icon, className;
    
    switch (status) {
        case 'connecting':
            icon = '<i class="fas fa-circle-notch fa-spin"></i>';
            className = 'connection-status';
            break;
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            className = 'connection-status success';
            break;
        case 'error':
            icon = '<i class="fas fa-times-circle"></i>';
            className = 'connection-status error';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
            className = 'connection-status';
    }
    
    connectionStatus.innerHTML = `${icon} ${message}`;
    connectionStatus.className = className;
    
    // Also update state if available
    if (window.App && window.App.state && window.App.state.database) {
        window.App.state.database.connected = (status === 'success');
    }

    //
    console.log(`✅ Status: ${message}`);
}


/**
 * Update the status of all tables in the UI
 * @param {Array} tables - Array of table names
 * @param {string} status - Status to set (waiting, loading, loaded, error)
 */
function updateTableStatuses(tables, status) {
    if (!tables || !Array.isArray(tables)) return;
    
    // Include the fact table
    const allTables = [...tables, 'FACT_BOM'];
    
    allTables.forEach(table => {
        const normalizedName = table.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const statusElement = document.getElementById(`${normalizedName}Status`);
        
        if (statusElement) {
            statusElement.className = `table-status ${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    });
}


// Call initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

document.getElementById('decimalPlaces').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    window.App.state.decimalPlaces = isNaN(value) ? 2 : value;
    window.App.pivotTable.generatePivotTable();
});

document.getElementById('valueFormat').addEventListener('change', function(e) {
    const value = e.target.value;
    window.App.state.valueFormat = value;
    window.App.pivotTable.generatePivotTable();
});

// Export the initialization function
export default { initializeApp };