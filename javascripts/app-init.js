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
    
    // STEP 1: First initialize the state
    const state = stateModule.state;

    // Set the state in the core module
    core.setState(state);

    // Make state accessible globally for debugging
    window.appState = state;    

    // STEP 2: Get DOM elements
    const elements = core.getDomElements();
    
    // STEP 3: Set up console enhancements
    ui.initializeEnhancedConsole();
    ui.setupConsoleInterception();
    ui.setupActivityLogControls();

    console.log("✅ Status: Initializing BOM Analysis application with field-specific loading...");        

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

    // STEP 7: Initialize UI
    ui.initDragAndDrop();

    // Set up database connection
    setupDatabaseConnection(elements);

    // ENHANCED: Load dimension filter data instead of full dimension data
    loadDimensionFilterDataFromDatabase(elements);

    // Initialize filtering system after dimension filter data is loaded
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
                    setTimeout(() => {
                        if (window.App && window.App.pivotTable) {
                            // Check if hierarchies are ready
                            if (!window.App.state.hierarchies || Object.keys(window.App.state.hierarchies).length === 0) {
                                console.log("📊 Hierarchies not ready yet, building them first...");
                                
                                // Try to build hierarchies if we have dimension filter data
                                if (window.App.state.dimensionFiltersLoaded) {
                                    data.buildAndPersistDimensionHierarchies().then(() => {
                                        console.log("📊 Hierarchies built, generating pivot table...");
                                        window.App.pivotTable.generatePivotTable();
                                    });
                                } else {
                                    console.log("📊 Dimension data not loaded yet");
                                }
                            } else if (window.App.state.factData && window.App.state.factData.length > 0) {
                                // Hierarchies exist and we have fact data
                                window.App.pivotTable.generatePivotTable();
                            } else {
                                // Hierarchies exist but no fact data - show structure only
                                console.log("📊 Showing pivot structure without fact data");
                                window.App.pivotTable.generatePivotTable();
                            }
                        }
                    }, 100);
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

    // STEP 10: For data refresh:
    const refreshButton = document.querySelector('#refreshBtn');
    if (refreshButton) {
        refreshButton.addEventListener('click', window.refreshPivotTable);
    }
    
    // ENHANCED: Add handler for load data button (now loads fact data on demand)
    const loadDataBtn = document.getElementById('loadDataBtn');
    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', function() {
            // Load fact data on demand after filter selection
            if (state.dimensionFiltersLoaded) {
                loadFactDataFromDatabase(elements);
            } else {
                console.warn("⚠️ Dimension filter data must be loaded first");
                ui.showMessage("Please wait for dimension data to load first", "warning");
            }
        });
    }    
    
    // STEP 11: Add handler for reconnect button
    const reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.addEventListener('click', function() {
            reconnectToDatabase(elements);
        });
    }

    console.log("✅ Status: Application initialization complete with field-specific loading");
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
 * ENHANCED: Load dimension filter data from the database (specific fields only)
 * @param {Object} elements - DOM elements
 */
// function loadDimensionFilterDataFromDatabase(elements) {
//     console.log("✅ Status: Starting dimension filter data loading from Snowflake database");
    
//     // ENHANCED: Load only the dimension filter data (specific fields)
//     data.ingestDimensionFilterData(elements);
    
//     console.log("✅ Status: Snowflake dimension filter data loading completed successfully");
    
//     console.log('✅ Status: Ready for fact data loading based on filter selection.');
// }
// In app-init.js, update the loadDimensionFilterDataFromDatabase function:

async function loadDimensionFilterDataFromDatabase(elements) {
    console.log("✅ Status: Starting dimension filter data loading from Snowflake database");
    
    try {
        // Step 1: Load dimension filter data
        const dataLoadSuccess = await data.ingestDimensionFilterDataOnly(elements);
        if (!dataLoadSuccess) {
            throw new Error("Failed to load dimension filter data");
        }
        
        // Step 2: Build hierarchies from loaded data
        const hierarchyBuildSuccess = await data.buildAndPersistDimensionHierarchies(elements);
        if (!hierarchyBuildSuccess) {
            console.warn("Hierarchy building failed, but continuing with loaded data");
        }
        
        console.log("✅ Status: Dimension data and hierarchies ready");
        
        // Step 3: Initialize pivot table state
        setTimeout(() => {
            if (window.App && window.App.pivotTable) {
                // Set default fields if not already set
                if (!window.App.state.rowFields || window.App.state.rowFields.length === 0) {
                    window.App.state.rowFields = ['DIM_LE']; // Default row field
                }
                if (!window.App.state.valueFields || window.App.state.valueFields.length === 0) {
                    window.App.state.valueFields = ['COST_UNIT']; // Default value field
                }
                
                // Generate initial pivot table structure (without fact data)
                console.log("📊 Generating initial pivot table structure...");
                window.App.pivotTable.generatePivotTable();
            }
        }, 1000);
        
    } catch (error) {
        console.error("Error loading dimension data:", error);
    }
    
    console.log("✅ Status: Snowflake dimension filter data loading completed successfully");
    console.log('✅ Status: Ready for fact data loading based on filter selection.');
}


/**
 * Load fact data on demand
 * @param {Object} elements - DOM elements
 */
function loadFactDataFromDatabase(elements) {
    console.log("✅ Status: Starting fact data loading from Snowflake database");
    
    // Ensure dimension filter data is loaded first
    if (!state.dimensionFiltersLoaded) {
        console.error("❌ Dimension filter data must be loaded before fact data");
        ui.showMessage("Dimension filter data must be loaded first", "error");
        return;
    }
    
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

// ENHANCED: Add event handlers for value formatting with field-specific data support
document.getElementById('decimalPlaces').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    window.App.state.decimalPlaces = isNaN(value) ? 2 : value;
    
    // Only regenerate if we have fact data loaded
    if (window.App.state.factData && window.App.state.factData.length > 0) {
        window.App.pivotTable.generatePivotTable();
    }
});

document.getElementById('valueFormat').addEventListener('change', function(e) {
    const value = e.target.value;
    window.App.state.valueFormat = value;
    
    // Only regenerate if we have fact data loaded
    if (window.App.state.factData && window.App.state.factData.length > 0) {
        window.App.pivotTable.generatePivotTable();
    }
});


// Export the initialization function
export default { initializeApp };