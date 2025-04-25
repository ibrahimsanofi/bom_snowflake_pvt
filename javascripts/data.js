import stateModule, {DIM_LE, DIM_GMID_DISPLAY, getDimensionData, DIM_COST_ELEMENT} from './state.js';
import ui from './ui.js';
import filters from './filters.js';
import pivotTable from './pivot-table.js';

// Get reference to application state
const state = stateModule.state;

/**
 * API Constants - Endpoints for data retrieval
 */
const API_BASE_URL = 'http://localhost:3000/api';
const ENDPOINTS = {
    GET_DIMENSIONS: `${API_BASE_URL}/get_bom_dim`,
    GET_DATA: `${API_BASE_URL}/data/`,
    GET_FACT_NAMES: `${API_BASE_URL}/get_fact_names`
};


/**
 * Fetches the list of available dimensions via the server API
 * @returns {Promise<Array>} - Array of dimension names (e.g. ['DIM_LE', ...])
 */
async function fetchDimensionNames() {
    try {
        const response = await fetch(ENDPOINTS.GET_DIMENSIONS);
        if (!response.ok) throw new Error('Error while retrieving dimensions.');
        
        const text = await response.text();
        const dims = text
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
            
        console.log(`Fetched ${dims.length} dimension names from server`);
        return dims;
    } catch (error) {
        console.error('❌ Error fetching dimension names:', error);
        throw error;
    }
}


/**
 * Fetches a table (dimension or fact) via the API NDJSON endpoint
 * @param {string} tableName - Name of the table to fetch
 * @returns {Promise<{data: Array, error?: any}>} - Object containing data or error
 */
async function fetchDatabaseData(databaseObjectName) {
    const url = `${ENDPOINTS.GET_DATA}${databaseObjectName}`; 
    try {
        console.log(`Fetching data for ${databaseObjectName}...`);
        const response = await fetch(url, {
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error(`Error while loading data from ${databaseObjectName} via the API: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];
        let networkError = false;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop(); 

                lines.forEach(line => {
                    if (line.trim()) {
                        try {
                            rows.push(JSON.parse(line));
                        } catch (e) {
                            console.warn(`Invalid line in ${databaseObjectName}:`, e);
                        }
                    }
                });
            }
        } catch (err) {
            networkError = true;
            console.error(`❌ Network error while fetching NDJSON data for ${databaseObjectName}:`, err);
        }

        if (networkError || rows.length === 0) {
            throw new Error(`Network error while loading data for ${databaseObjectName}`);
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn(`Invalid lines in ${databaseObjectName}:`, e);
            }
        }

        console.log(`✅ ${rows.length} rows loaded from Snowflake database object: ${databaseObjectName}`);
        return { data: rows };
    } catch (err) {
        console.error(`❌ Error fetching data from ${databaseObjectName}:`, err);
        return { data: null, error: err };
    }
}


/**
 * Fetches dimension names related to a specific fact table
 * @param {string} factTable - Name of the fact table
 * @returns {Promise<Array>} - Array of dimension names
 */
async function fetchDimensionNamesForFact(factTable) {
    try {
        const url = `${ENDPOINTS.GET_DIMENSIONS}?fact=${encodeURIComponent(factTable)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Error loading dimensions data');
        }
        
        const text = await response.text();
        const dims = text
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
            
        console.log(`Found ${dims.length} dimensions for fact table: ${factTable}`);
        return dims;
    } catch (error) {
        console.error('❌ Error fetching dimension names for fact:', error);
        throw error;
    }
}


/**
 * Fetches all available fact table names from the database
 * @returns {Promise<Array>} - Array of fact table names
 */
async function fetchFactTableNames() {
    try {
        const response = await fetch(ENDPOINTS.GET_FACT_NAMES);
        if (!response.ok) throw new Error('Error while retrieving fact table names.');
        
        const text = await response.text();
        const facts = text
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
            
        console.log(`Fetched ${facts.length} fact table names from server`);
        return facts;
    } catch (error) {
        console.error('❌ Error fetching fact table names:', error);
        throw error;
    }
}


/**
 * Main function to ingest data from database
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table to load (default: 'FACT_BOM')
 * @returns {Promise<void>}
 */
async function ingestData(elements, selectedFact = 'FACT_BOM') {
    console.log('Loading data from Snowflake database server...', 'info', elements);
    
    try {        
        // 1. Get dimensions related to the selected fact table
        const dimNames = await fetchDimensionNamesForFact(selectedFact);
        console.log(`Loading ${dimNames.length} dimensions for ${selectedFact}`);
        
        // 2. Build available files list (used for UI)
        state.availableFiles = [];
        dimNames.forEach(dim => {
            state.availableFiles.push({
                id: `${dim}`,
                label: dim.replace(/^DIM_/, ''),
                type: 'dimension',
                hierarchical: ['LE', 'COST_ELEMENT', 'GMID_DISPLAY', 'SMARTCODE'].includes(
                    dim.replace(/^DIM_/, '')
                )
            });
        });
        
        // Add fact table to available files
        state.availableFiles.push({
            id: selectedFact,
            label: selectedFact.replace(/^FACT_/, ''),
            type: 'fact'
        });
        
        // 3. Load dimension data
        console.log("Loading dimension data from database...");
        state.dimensions = {};
        
        // Initialize dimensions to empty objects to prevent null reference issues
        dimNames.forEach(dim => {
            const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
            state.dimensions[dimKey] = [];
        });
        
        // Fetch all dimension data in parallel for efficiency
        const dimensionPromises = dimNames.map(async dim => {
            try {
                // Update status
                ui.updateTableStatus(dim, 'loading');
                
                // Fetch dimension data
                const { data, error } = await fetchDatabaseData(dim);
                
                if (error || !data) {
                    ui.updateTableStatus(dim, 'error');
                    console.error(`Error loading dimension: ${dim}`, error);
                    return false;
                }
                
                // Store in state (lowercase dimension name without DIM_ prefix)
                const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
                state.dimensions[dimKey] = data;
                
                // Update status
                ui.updateTableStatus(dim, 'loaded', data.length);
                console.log(`Loaded dimension ${dim}: ${data.length} rows`);
                return true;
            } catch (err) {
                console.error(`Error loading dimension ${dim}:`, err);
                ui.updateTableStatus(dim, 'error');
                return false;
            }
        });
        
        // Wait for all dimension data to load
        await Promise.all(dimensionPromises);
        
        // 4. Load fact data
        console.log(`Loading fact data from ${selectedFact}...`);
        ui.updateTableStatus(selectedFact, 'loading');
        
        const { data: rawFactBOMData, error: factError } = await fetchDatabaseData(selectedFact);
        
        if (factError || !rawFactBOMData) {
            ui.updateTableStatus(selectedFact, 'error');
            throw new Error(`Error loading fact data: ${selectedFact}`);
        }
        
        // Process numeric fields to ensure they're numbers, not strings
        // rawFactBOMData.forEach(row => {
        //     if (row.COST_UNIT !== undefined) {
        //         const parsedValue = parseFloat(row.COST_UNIT);
        //         row.COST_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
        //     }
            
        //     if (row.QTY_UNIT !== undefined) {
        //         const parsedValue = parseFloat(row.QTY_UNIT);
        //         row.QTY_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
        //     }
        // });
        
        // Store fact data
        state.rawFactBOMData = rawFactBOMData;
        ui.updateTableStatus(selectedFact, 'loaded', rawFactBOMData.length);
        console.log(`Loaded fact data ${selectedFact}: ${rawFactBOMData.length} rows`);
        
        // Verify data is loaded before proceeding
        if (!state.rawFactBOMData || state.rawFactBOMData.length === 0) {
            throw new Error("Fact data was not properly loaded");
        }
        
        // Verify dimensions are loaded
        const dimensionsLoaded = Object.keys(state.dimensions).some(key => 
            Array.isArray(state.dimensions[key]) && state.dimensions[key].length > 0
        );
        
        if (!dimensionsLoaded) {
            throw new Error("No dimension data was properly loaded");
        }
        
        // 5. Generate available fields
        state.availableFields = [];
        
        // Add dimension fields
        state.availableFiles.forEach(file => {
            if (file.type === 'dimension') {
                state.availableFields.push({
                    id: file.id,
                    label: file.label,
                    category: 'Dimension',
                    type: 'dimension',
                    hierarchical: file.hierarchical,
                    draggableTo: ['row', 'column', 'filter']
                });
            }
        });
        
        // Add measure fields
        [
            { id: 'COST_UNIT', label: 'Cost Unit' },
            { id: 'QTY_UNIT', label: 'Quantity Unit' }
        ].forEach(measure => {
            state.availableFields.push({
                id: measure.id,
                label: measure.label,
                category: 'Measure',
                type: 'fact',
                measureName: measure.id,
                draggableTo: ['value']
            });
        });
        
        // 6. Process dimension data to build hierarchies
        await processDimensionHierarchies();
        ensureHierarchicalMarkings();

        console.log("Dimension hierarchies built successfully");
        
        // 7. Set up UI elements
        ui.renderAvailableFields(elements);
        ui.setDefaultFields();
        ui.renderFieldContainers(elements, state);
        
        // 8. Initialize mappings AFTER data loading is complete
        console.log("Initializing mappings now that data is loaded");
        initializeMappings();
        
        // 9. Set up filters
        setTimeout(() => {
            if (filters && filters.initializeFilters) {
                filters.initializeFilters();
            }
        }, 1000);
        
        // Hide loading indicator
        if (elements && elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
        
        // Show app content
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'block';
        }
        
        // Show success message
        console.log('Data loaded successfully from Snowflake database.', 'success', elements);
        state.loading = false;

        return true;
        
    } catch (error) {
        console.error('Data Loading Error:', error);
        
        // Hide loading indicator
        if (elements && elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
        
        // Show app content even on error
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'block';
        }
        
        // Show error message
        console.error(`❌ Data Loading Error: ${error.message}`, 'error', elements);
        return false;
    }
}


/**
 * Ensures hierarchical dimensions are properly marked in the availableFields structure
 * This should be called when building the available fields list
 */
function ensureHierarchicalMarkings() {
    // Make sure we have availableFields
    if (!state.availableFields || !Array.isArray(state.availableFields)) {
        console.warn("Cannot mark hierarchical fields - availableFields not defined");
        return;
    }
    
    // Set of known hierarchical dimensions
    const hierarchicalDims = new Set([
        'LE', 
        'COST_ELEMENT', 
        'GMID_DISPLAY', 
        'SMARTCODE'
    ]);
    
    // Verify each field's hierarchical status
    state.availableFields.forEach(field => {
        if (field.type === 'dimension') {
            // Extract dimension name
            const dimName = field.id.replace(/^DIM_/, '');
            
            // Check if this is a known hierarchical dimension
            if (hierarchicalDims.has(dimName)) {
                // Ensure it's marked as hierarchical
                field.hierarchical = true;
                
                // Also ensure draggableTo includes appropriate zones
                if (!field.draggableTo) {
                    field.draggableTo = ['row', 'column', 'filter'];
                }
            }
        }
    });
    
    console.log("Hierarchical fields verified:", 
        state.availableFields.filter(f => f.hierarchical).map(f => f.id).join(', '));
}


/**
 * Initializes hierarchy expansion state when a hierarchical field is dropped
 * 
 * @param {string} fieldId - The field ID
 * @param {string} zone - The zone (row/column)
 */
function initializeHierarchyExpansion(fieldId, zone) {
    // Get the dimension name from the field ID
    let dimName;
    
    if (fieldId.startsWith('DIM_')) {
        dimName = fieldId.replace('DIM_', '').toLowerCase();
    } else {
        // Handle legacy dimension names without DIM_ prefix
        dimName = fieldId.toLowerCase();
    }
    
    // Check if this is a known hierarchical dimension
    if (['le', 'gmid_display', 'smartcode', 'smartcode', 'cost_element'].includes(dimName)) {
        // // Standardize some dimension names
        // if (dimName === 'le') dimName = 'le';
        // if (dimName === 'smartcode') dimName = 'smartcode';
        
        // Initialize expansion state for this dimension if it doesn't exist
        state.expandedNodes[dimName] = state.expandedNodes[dimName] || {};
        state.expandedNodes[dimName][zone] = state.expandedNodes[dimName][zone] || {};
        
        // Always expand the ROOT node by default for better usability
        state.expandedNodes[dimName][zone]['ROOT'] = true;
        
        console.log(`Initialized expansion state for ${dimName} in ${zone} zone, ROOT expanded`);
        
        // Also make sure the hierarchy object has this dimension
        if (state.hierarchies && !state.hierarchies[dimName]) {
            console.warn(`Hierarchy for ${dimName} not found in state.hierarchies`);
        }
    } else {
        console.log(`Field ${fieldId} not recognized as hierarchical dimension`);
    }
}


/**
 * Process dimension hierarchies after loading data from database
 * @returns {Promise<void>}
 */
async function processDimensionHierarchies() {
    try {        
        // Use the existing processDimensionHierarchies function but adapt it for our needs
        state.hierarchies = processDimensionFiles();
        
        // Initialize expansion state for all hierarchies - expanded by default for ROOT nodes
        console.log("Initializing expansion states for hierarchies");
        Object.keys(state.hierarchies).forEach(hierarchyName => {
            // Ensure the expandedNodes structure is initialized
            if (!state.expandedNodes[hierarchyName]) {
                state.expandedNodes[hierarchyName] = { row: { 'ROOT': true }, column: { 'ROOT': true } };
            }
            
            // Ensure the hierarchy has a root node
            if (state.hierarchies[hierarchyName] && state.hierarchies[hierarchyName].root) {
                // Set root node to expanded
                state.hierarchies[hierarchyName].root.expanded = true;
            }
        });
        
        console.log("Hierarchy processing complete");
    } catch (error) {
        console.error("❌ Error building dimension hierarchies:", error);
        // Initialize hierarchies as empty object in case of error
        state.hierarchies = {};
        throw error;
    }
}


/**
 * Set up the initial database connection
 * @param {Object} elements - DOM elements
 */
async function setupDatabaseConnection(elements) {
    // Update connection status to connecting
    updateConnectionStatus('connecting', 'Connecting to Snowflake database...', elements);
    
    try {
        // Try fetching the dimension names to verify connection
        const dimensions = await fetchDimensionNames();
        
        // Connection successful
        updateConnectionStatus('success', 'Connected to Snowflake database', elements);
        
        // Store available tables in state
        if (window.App && window.App.state) {
            window.App.state.availableTables = dimensions;
        }
        
        // Update UI
        updateTableStatuses(dimensions, 'waiting', elements);
        
        return { success: true, dimensions };
    } catch (error) {
        console.error('❌ Connection error:', error);
        updateConnectionStatus('error', 'Failed to connect to database server', elements);
        return { success: false, error };
    }
}


/**
 * Reconnect to the database
 * @param {Object} elements - DOM elements
 */
async function reconnectToDatabase(elements) {
    // Update connection status
    updateConnectionStatus('connecting', 'Reconnecting to database...', elements);
    
    // Reset table statuses
    if (window.App && window.App.state && window.App.state.availableTables) {
        updateTableStatuses(window.App.state.availableTables, 'waiting', elements);
    }
    
    // Call setup again
    return setupDatabaseConnection(elements);
}


/**
 * Update the connection status in the UI
 * @param {string} status - Status type (connecting, success, error)
 * @param {string} message - Status message
 * @param {Object} elements - DOM elements
 */
function updateConnectionStatus(status, message, elements) {
    const connectionStatus = elements?.connectionStatus;
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
}


/**
 * Update the status of all tables in the UI
 * @param {Array} tables - Array of table names
 * @param {string} status - Status to set (waiting, loading, loaded, error)
 * @param {Object} elements - DOM elements
 */
function updateTableStatuses(tables, status, elements) {
    if (!tables || !Array.isArray(tables)) return;
    
    // Include the fact table
    const allTables = [...tables, 'FACT_BOM'];
    
    allTables.forEach(table => {
        const normalizedName = table.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const statusElement = elements[`${normalizedName}Status`];
        
        if (statusElement) {
            statusElement.className = `table-status ${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    });
}


/**
 * Load data from the database
 * @param {Object} elements - DOM elements
 */
function loadDataFromDatabase(elements) {
    // Show loading indicator
    // const loadingIndicator = document.getElementById('loadingIndicator');
    // if (loadingIndicator) {
    //     loadingIndicator.style.display = 'flex';
    // }
    
    // Hide app content while loading
    // const appContent = document.getElementById('appContent');
    // if (appContent) {
    //     appContent.style.display = 'none';
    // }
    
    console.log("Starting data loading from Snowflake database");
    
    // Ensure we have a data reference before trying to load
    if (!window.App || !window.App.data || !window.App.data.ingestData) {
        console.error("Data loading functions not available");
        
        // Hide loading indicator and show content in case of error
        // if (loadingIndicator) {
        //     loadingIndicator.style.display = 'none';
        // }
        // if (appContent) {
        //     appContent.style.display = 'block';
        // }
        
        return;
    }
    
    // Use promise to handle async loading
    window.App.data.ingestData(elements)
        .then(success => {
            if (success) {
                console.log("Snowflake data loading completed successfully");
            } else {
                console.error("Snowflake data loading failed");
            }
        })
        .catch(error => {
            console.error("Error during data loading:", error);
        })
        .finally(() => {
            // Always hide loading indicator and show content when done
            // if (loadingIndicator) {
            //     loadingIndicator.style.display = 'none';
            // }
            if (appContent) {
                appContent.style.display = 'block';
            }
        });
}


/**
 * Applies filters to data before passing to pivot processing
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
        const factIdField = getFactIdField(dimName);
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
 * Get the corresponding fact table field for a dimension
 * @param {string} dimensionName - Dimension name
 * @returns {string} Field name in fact table
 */
function getFactIdField(dimensionName) {
    const mappings = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'COMPONENT_GMID',
        'smartcode': 'ROOT_SMARTCODE',
        'item_cost_type': 'ITEM_COST_TYPE',
        'material_type': 'COMPONENT_MATERIAL_TYPE'
    };
    
    return mappings[dimensionName] || null;
}


/**
 * Process dimension files to build hierarchies
 * @returns {Object} - Object containing processed hierarchies for each dimension
 */
function processDimensionFiles() {
    console.log("Processing dimension data to build hierarchies");
    
    const hierarchies = {};
    
    try {
        // Process legal entity hierarchy
        if (state.dimensions.le && state.dimensions.le.length > 0) {
            hierarchies.le = buildLegalEntityHierarchy(state.dimensions.le);
            // Precompute descendant factIds for legal entity hierarchy
            precomputeDescendantFactIds(hierarchies.le, 'LE');
        }
        
        // Process cost element hierarchy
        if (state.dimensions.cost_element && state.dimensions.cost_element.length > 0) {
            hierarchies.cost_element = buildCostElementHierarchy(state.dimensions.cost_element);
            // Precompute descendant factIds for cost element hierarchy
            precomputeDescendantFactIds(hierarchies.cost_element, 'COST_ELEMENT');
        }
        
        // Process smart code hierarchy
        if (state.dimensions.smartcode && state.dimensions.smartcode.length > 0) {
            hierarchies.smartcode = buildSmartCodeHierarchy(state.dimensions.smartcode);
            // Precompute descendant factIds for smart code hierarchy
            precomputeDescendantFactIds(hierarchies.smartcode, 'ROOT_SMARTCODE');
        }
        
        // Process GMID hierarchy
        if (state.dimensions.gmid_display && state.dimensions.gmid_display.length > 0) {
            hierarchies.gmid_display = buildGmidDisplayHierarchy(state.dimensions.gmid_display);
            // Precompute descendant factIds for GMID hierarchy
            precomputeDescendantFactIds(hierarchies.gmid_display, 'COMPONENT_GMID');
        }
        
        console.log("Hierarchies built successfully");
        return hierarchies;
    } catch (error) {
        console.error("❌ Error building hierarchies:", error);
        return {};
    }
}


/**
 * Initialize all dimension mappings
 * Builds mappings between dimension tables and fact table
 */
function initializeMappings() {
    console.log("Starting dimension mappings initialization");
    
    // Initialize state.mappings object if it doesn't exist
    if (!state.mappings) {
        state.mappings = {};
    }

    // CRITICAL: First verify we have the necessary data
    // Check for dimensions existence
    if (!state.dimensions || Object.keys(state.dimensions).length === 0) {
        console.warn("Cannot initialize mappings: No dimension data available");
        return false;
    }
    
    // Check for fact data existence
    if (!state.rawFactBOMData || !Array.isArray(state.rawFactBOMData) || state.rawFactBOMData.length === 0) {
        console.warn("Cannot initialize mappings: No fact data available");
        return false;
    }
    
    let hasAnyMappingInitialized = false;
    
    // 1. Initialize legal entity mapping
    if (state.dimensions.le && state.dimensions.le.length > 0) {
        try {
            console.log("Initializing Legal Entity mapping");
            state.mappings.le = buildLegalEntityMapping(state.dimensions.le, state.rawFactBOMData);
            
            console.log("Legal Entity Mapping initialized with", 
                Object.keys(state.mappings.le?.leToDetails || {}).length, "entities mapped");
            hasAnyMappingInitialized = true;
        } catch (error) {
            console.error("❌ Failed to initialize legal entity mapping:", error);
            // Create empty mapping to prevent null reference errors
            state.mappings.le = {
                leToDetails: {},
                pathToLeCodes: {},
                leToPaths: {},
                usedLeCodes: new Set()
            };
        }
    } else {
        console.warn("Cannot initialize legal entity mapping: missing dimension data");
        state.mappings.le = {
            leToDetails: {},
            pathToLeCodes: {},
            leToPaths: {},
            usedLeCodes: new Set()
        };
    }
    
    // 2. Initialize cost element mapping
    if (state.dimensions.cost_element && state.dimensions.cost_element.length > 0) {
        try {
            console.log("Initializing Cost Element mapping");
            state.mappings.costElement = buildCostElementMapping(state.dimensions.cost_element, state.rawFactBOMData);
            
            console.log("Cost Element Mapping initialized with", 
                Object.keys(state.mappings.costElement?.costElementToDetails || {}).length, "elements mapped");
            hasAnyMappingInitialized = true;
        } catch (error) {
            console.error("❌ Failed to initialize cost element mapping:", error);
            // Create empty mapping to prevent null reference errors
            state.mappings.costElement = {
                costElementToDetails: {},
                nodeToCostElements: {},
                usedCostElements: new Set()
            };
        }
    } else {
        console.warn("Cannot initialize cost element mapping: missing dimension data");
        state.mappings.costElement = {
            costElementToDetails: {},
            nodeToCostElements: {},
            usedCostElements: new Set()
        };
    }
    
    // 3. Initialize smart code mapping
    if (state.dimensions.smartcode && state.dimensions.smartcode.length > 0) {
        try {
            console.log("Initializing Smart Code mapping");
            state.mappings.smartCode = buildSmartCodeMapping(state.dimensions.smartcode, state.rawFactBOMData);
            
            console.log("Smart Code Mapping initialized with", 
                Object.keys(state.mappings.smartCode?.smartCodeToDetails || {}).length, "smart codes mapped");
            hasAnyMappingInitialized = true;
        } catch (error) {
            console.error("❌ Failed to initialize smart code mapping:", error);
            // Create empty mapping
            state.mappings.smartCode = {
                smartCodeToDetails: {},
                nodeToSmartCodes: {},
                usedSmartCodes: new Set()
            };
        }
    } else {
        console.warn("Cannot initialize smart code mapping: missing dimension data");
        state.mappings.smartCode = {
            smartCodeToDetails: {},
            nodeToSmartCodes: {},
            usedSmartCodes: new Set()
        };
    }
    
    // 4. Initialize GMID display mapping
    if (state.dimensions.gmid_display && state.dimensions.gmid_display.length > 0) {
        try {
            console.log("Initializing GMID Display mapping");
            state.mappings.gmidDisplay = buildGmidDisplayMapping(state.dimensions.gmid_display, state.rawFactBOMData);
            
            console.log("GMID Display Mapping initialized with", 
                Object.keys(state.mappings.gmidDisplay?.gmidToDisplay || {}).length, "GMIDs mapped");
            hasAnyMappingInitialized = true;
        } catch (error) {
            console.error("❌ Failed to initialize GMID display mapping:", error);
            // Create empty mapping
            state.mappings.gmidDisplay = {
                gmidToDisplay: {},
                pathGmidToDisplay: {},
                nodeToChildGmids: {},
                nodeToDescendantGmids: {},
                nodeToParent: {},
                usedGmids: []
            };
        }
    } else {
        console.warn("Cannot initialize GMID display mapping: missing dimension data");
        state.mappings.gmidDisplay = {
            gmidToDisplay: {},
            pathGmidToDisplay: {},
            nodeToChildGmids: {},
            nodeToDescendantGmids: {},
            nodeToParent: {},
            usedGmids: []
        };
    }
    
    // 5. Initialize ITEM_COST_TYPE mapping (with similar error handling)
    try {
        if (state.dimensions.item_cost_type && state.dimensions.item_cost_type.length > 0) {
            console.log("Initializing ITEM_COST_TYPE mapping");
            state.mappings.itemCostType = buildItemCostTypeMapping(state.dimensions.item_cost_type, state.rawFactBOMData);
            
            console.log("ITEM_COST_TYPE Mapping initialized with", 
                Object.keys(state.mappings.itemCostType?.codeToDesc || {}).length, "item cost types mapped");
            hasAnyMappingInitialized = true;
        } else {
            state.mappings.itemCostType = { codeToDesc: {}, descToCode: {}, descToFactCode: {}, usedItemCostTypes: new Set() };
        }
    } catch (error) {
        console.error("❌ Failed to initialize item cost type mapping:", error);
        state.mappings.itemCostType = { codeToDesc: {}, descToCode: {}, descToFactCode: {}, usedItemCostTypes: new Set() };
    }
    
    // 6. Initialize MATERIAL_TYPE mapping (with similar error handling)
    try {
        if (state.dimensions.material_type && state.dimensions.material_type.length > 0) {
            console.log("Initializing MATERIAL_TYPE mapping");
            state.mappings.materialType = buildMaterialTypeMapping(state.dimensions.material_type, state.rawFactBOMData);
            
            console.log("MATERIAL_TYPE Mapping initialized with", 
                Object.keys(state.mappings.materialType?.codeToDesc || {}).length, "material types mapped");
            hasAnyMappingInitialized = true;
        } else {
            state.mappings.materialType = { codeToDesc: {}, descToCode: {}, usedMaterialTypes: new Set() };
        }
    } catch (error) {
        console.error("❌ Failed to initialize material type mapping:", error);
        state.mappings.materialType = { codeToDesc: {}, descToCode: {}, usedMaterialTypes: new Set() };
    }
    
    // Only run verification if at least one mapping was initialized
    if (hasAnyMappingInitialized) {
        try {
            // 7. Add integrity checks to verify mappings are working
            verifyFactDimensionMappings();
        } catch (error) {
            console.warn("Could not verify fact dimension mappings:", error);
        }
    }
    
    console.log("All mappings initialized successfully");
    return true;
}


/**
 * Verify that fact records can be properly joined with dimensions
 * This helps diagnose mapping issues
 */
function verifyFactDimensionMappings() {
    if (!state.rawFactBOMData || state.rawFactBOMData.length === 0) {
        console.warn("No fact data available for mapping verification");
        return;
    }
    
    const sampleSize = Math.min(10, state.rawFactBOMData.length);
    const sampleRecords = state.rawFactBOMData.slice(0, sampleSize);
    
    // Check legal entity mapping
    if (state.mappings.le) {
        const leMatches = sampleRecords.filter(record => 
            record.LE && state.mappings.le.leToDetails[record.LE]
        ).length;
        
        console.log(`Legal Entity mapping: ${leMatches}/${sampleSize} records have matching LE codes`);
    }
    
    // Check cost element mapping
    if (state.mappings.costElement) {
        const ceMatches = sampleRecords.filter(record => 
            record.COST_ELEMENT && state.mappings.costElement.costElementToDetails[record.COST_ELEMENT]
        ).length;
        
        console.log(`Cost Element mapping: ${ceMatches}/${sampleSize} records have matching COST_ELEMENT`);
    }
    
    // Check smart code mapping
    if (state.mappings.smartCode) {
        const scMatches = sampleRecords.filter(record => 
            record.ROOT_SMARTCODE && state.mappings.smartCode.smartCodeToDetails[record.ROOT_SMARTCODE]
        ).length;
        
        console.log(`Smart Code mapping: ${scMatches}/${sampleSize} records have matching ROOT_SMARTCODE`);
    }
    
    // Check GMID mapping
    if (state.mappings.gmidDisplay) {
        const gmidMatches = sampleRecords.filter(record => 
            record.COMPONENT_GMID && state.mappings.gmidDisplay.gmidToDisplay[record.COMPONENT_GMID]
        ).length;
        
        console.log(`GMID mapping: ${gmidMatches}/${sampleSize} records have matching COMPONENT_GMID`);
    }
    
    // Check item cost type mapping
    if (state.mappings.itemCostType) {
        const ictMatches = sampleRecords.filter(record => 
            record.ITEM_COST_TYPE && state.mappings.itemCostType.codeToDesc[record.ITEM_COST_TYPE]
        ).length;
        
        console.log(`Item Cost Type mapping: ${ictMatches}/${sampleSize} records have matching ITEM_COST_TYPE`);
    }
    
    // Check material type mapping
    if (state.mappings.materialType) {
        const mtMatches = sampleRecords.filter(record => 
            record.COMPONENT_MATERIAL_TYPE && state.mappings.materialType.codeToDesc[record.COMPONENT_MATERIAL_TYPE]
        ).length;
        
        console.log(`Material Type mapping: ${mtMatches}/${sampleSize} records have matching COMPONENT_MATERIAL_TYPE`);
    }
}


/**
 * Precompute descendant factIds for each parent node in the hierarchy
 * Special handling for GMID hierarchies to ensure correct filtering
 * 
 * @param {Object} hierarchy - The hierarchy object with root and nodesMap
 * @param {string} factIdField - The fact table field name for this dimension
 */
function precomputeDescendantFactIds(hierarchy, factIdField) {
    // Check if the hierarchy has a valid structure
    if (!hierarchy || !hierarchy.nodesMap || (!hierarchy.root && (!hierarchy.roots || !hierarchy.roots.length))) {
        console.warn("Cannot precompute descendant factIds - invalid hierarchy structure");
        return;
    }
    
    console.log(`Precomputing descendant factIds for hierarchy using ${factIdField}`);
    
    // Special case for GMID hierarchy - ensure we're handling it differently
    const isGmidHierarchy = factIdField === 'COMPONENT_GMID';
    
    // Get all nodes from the hierarchy
    const nodes = Object.values(hierarchy.nodesMap);
    console.log(`Processing ${nodes.length} nodes in hierarchy`);
    
    // Group nodes by level for bottom-up processing
    const nodesByLevel = {};
    let maxLevel = 0;
    
    nodes.forEach(node => {
        // Ensure node has a level property
        const level = node.level || 0;
        nodesByLevel[level] = nodesByLevel[level] || [];
        nodesByLevel[level].push(node);
        maxLevel = Math.max(maxLevel, level);
        
        // Initialize descendantFactIds as empty array
        node.descendantFactIds = [];
        
        // For leaf nodes, add their own factId if present
        if (node.isLeaf && node.factId) {
            node.descendantFactIds.push(node.factId);
        }
    });
    
    console.log(`Hierarchy has ${maxLevel + 1} levels (0 to ${maxLevel})`);
    
    // Process from bottom to top, starting with leaf nodes
    for (let level = maxLevel; level >= 0; level--) {
        console.log(`Processing level ${level} with ${nodesByLevel[level]?.length || 0} nodes`);
        
        // Process all nodes at this level
        (nodesByLevel[level] || []).forEach(node => {
            // Skip leaf nodes, already handled
            if (node.isLeaf) return;
            
            // For non-leaf nodes, collect factIds from children
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    // Resolve child node (might be object or string reference)
                    const childNode = typeof child === 'string' ? hierarchy.nodesMap[child] : child;
                    
                    if (childNode && childNode.descendantFactIds) {
                        // Add child's descendantFactIds to this node
                        childNode.descendantFactIds.forEach(factId => {
                            if (!node.descendantFactIds.includes(factId)) {
                                node.descendantFactIds.push(factId);
                            }
                        });
                    }
                });
            }
        });
    }
    
    console.log("Descendant factIds precomputation complete");
}


/**
 * Window-level function to generate the pivot table
 * Uses filtered data if available
 */
window.generatePivotTable = function() {
    console.log("PIVOT GEN START - Original rawFactBOMData length:", state.rawFactBOMData.length);
    
    // Are we using filtered data?
    if (state.filteredData && state.filteredData.length > 0) {
        console.log("Using filteredData with length:", state.filteredData.length);
        
        // Check data types in filtered data
        if (state.filteredData.length > 0) {
            const sample = state.filteredData[0];
            console.log("COST_UNIT type check:", {
                value: sample.COST_UNIT,
                type: typeof sample.COST_UNIT
            });
        }
        
        // Store original rawFactBOMData reference (not just length)
        const originalrawFactBOMData = state.rawFactBOMData;
        
        // Replace rawFactBOMData with filteredData
        state.rawFactBOMData = state.filteredData;
        
        // Generate pivot table
        console.log("Calling pivotTable.generatePivotTable with filtered data");
        pivotTable.generatePivotTable();
        
        // Restore original rawFactBOMData
        console.log("Restoring original rawFactBOMData");
        state.rawFactBOMData = originalrawFactBOMData;
    } else {
        // Generate pivot table with original data
        console.log("Using original rawFactBOMData");
        pivotTable.generatePivotTable();
    }
    
    console.log("PIVOT GEN COMPLETE");
};


/**
 * Process non-hierarchical dimensions for filter functionality
 * @param {string} fieldId - The field ID
 * @param {Array} rawFactBOMData - The fact data array
 * @returns {Object} - Processed dimension with root node and nodes map
 */
function processNonHierarchicalDimension(fieldId, rawFactBOMData) {
    // Check for valid inputs
    if (!fieldId || !rawFactBOMData || !Array.isArray(rawFactBOMData)) {
        console.warn("Invalid inputs to processNonHierarchicalDimension:", { fieldId, rawFactBOMDataExists: !!rawFactBOMData });
        // Return minimal valid hierarchy
        return {
            root: {
                id: 'ROOT',
                label: 'All Items',
                children: [],
                level: 0,
                path: ['ROOT'],
                expanded: true,
                isLeaf: false,
                hasChildren: false
            },
            nodesMap: { 'ROOT': { id: 'ROOT', label: 'All Items', children: [], level: 0, path: ['ROOT'], expanded: true, isLeaf: false, hasChildren: false } }
        };
    }
    
    // Get dimension type
    const isDimItemCostType = fieldId === 'DIM_ITEM_COST_TYPE' || fieldId === 'ITEM_COST_TYPE';
    const isDimMaterialType = fieldId === 'DIM_MATERIAL_TYPE' || fieldId === 'COMPONENT_MATERIAL_TYPE';
    
    // Create root node
    const rootId = isDimItemCostType ? 'ITEM_COST_TYPE_ROOT' : 
                  isDimMaterialType ? 'COMPONENT_MATERIAL_TYPE_ROOT' : 
                  `${fieldId}_ROOT`;
    
    const rootLabel = isDimItemCostType ? 'All Item Cost Types' : 
                     isDimMaterialType ? 'All Material Types' : 
                     `All ${fieldId}`;
    
    const root = {
        _id: rootId,
        label: rootLabel,
        children: [],
        level: 0,
        path: [rootId],
        expanded: true,
        isLeaf: false,
        hasChildren: false,
        hierarchyField: fieldId
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { [rootId]: root };
    
    // Get values from the appropriate dimension table
    let uniqueValues = [];
    
    try {
        if (isDimItemCostType && state.dimensions && state.dimensions.item_cost_type) {
            // Get from dimension table
            const dimData = state.dimensions.item_cost_type;
            uniqueValues = dimData.map(item => ({
                id: item.ITEM_COST_TYPE || 'unknown',
                label: item.ITEM_COST_TYPE_DESC || item.ITEM_COST_TYPE || 'Unknown'
            }));
        } else if (isDimMaterialType && state.dimensions && state.dimensions.material_type) {
            // Get from dimension table
            const dimData = state.dimensions.material_type;
            uniqueValues = dimData.map(item => ({
                id: item.MATERIAL_TYPE || 'unknown',
                label: item.MATERIAL_TYPE_DESC || item.MATERIAL_TYPE || 'Unknown'
            }));
        } else {
            // Extract from fact data
            const fieldName = isDimItemCostType ? 'ITEM_COST_TYPE' : 
                             isDimMaterialType ? 'COMPONENT_MATERIAL_TYPE' : 
                             fieldId;
            
            const valueSet = new Set();
            rawFactBOMData.forEach(record => {
                if (record && record[fieldName]) {
                    valueSet.add(record[fieldName]);
                }
            });
            
            uniqueValues = Array.from(valueSet).map(value => ({
                id: value,
                label: value
            }));
        }
        
        // Filter out any null/undefined values
        uniqueValues = uniqueValues.filter(item => !!item && !!item.id && !!item.label);
        
        // Add default "Unknown" item if we have no values
        if (uniqueValues.length === 0) {
            uniqueValues.push({
                id: 'unknown',
                label: 'Unknown'
            });
        }
    } catch (error) {
        console.error(`❌ Error extracting unique values for ${fieldId}:`, error);
        // Provide a default "Unknown" value
        uniqueValues = [{
            id: 'unknown',
            label: 'Unknown'
        }];
    }
    
    // Create child nodes for each unique value
    uniqueValues.forEach(item => {
        // Skip if item is invalid
        if (!item || !item.id) return;
        
        const nodeId = isDimItemCostType ? `ITEM_COST_TYPE_${item.id}` : 
                      isDimMaterialType ? `MATERIAL_TYPE_${item.id}` : 
                      `${fieldId}_${item.id}`;
        
        const node = {
            _id: nodeId,
            label: item.label || String(item.id),
            children: [],
            level: 1,
            path: [rootId, nodeId],
            expanded: false,
            isLeaf: true,
            hasChildren: false,
            factId: item.id,
            hierarchyField: fieldId
        };
        
        // Add to nodes map
        nodesMap[nodeId] = node;
        
        // Add to root's children
        root.children.push(nodeId);
    });
    
    // Update root node if it has children
    if (root.children.length > 0) {
        root.hasChildren = true;
    }
    
    // Sort children by label with null safety
    root.children.sort((a, b) => {
        const nodeA = nodesMap[a];
        const nodeB = nodesMap[b];
        
        // Handle null/undefined nodes
        if (!nodeA && !nodeB) return 0;
        if (!nodeA) return 1;
        if (!nodeB) return -1;
        
        // Handle null/undefined labels
        const labelA = nodeA.label || '';
        const labelB = nodeB.label || '';
        
        return labelA.localeCompare(labelB);
    });
    
    // Return the hierarchy-like structure
    return {
        root: root,
        nodesMap: nodesMap
    };
}


/**
 * Build a legal entity hierarchy using the generic path-based approach
 * @param {Array} data - The legal entity data
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
function buildLegalEntityHierarchy(data) {
    console.log("Building Legal Entity hierarchy using PATH-based approach");
    console.log(`Processing ${data.length} LE records with PATH structure`);
    
    // First extract all unique first segments and count their frequency
    const firstSegmentCounts = new Map();
    data.forEach(item => {
        if (item.PATH) {
            const segments = item.PATH.split('/').filter(s => s.trim() !== '');
            if (segments.length > 0) {
                const firstSegment = segments[0];
                firstSegmentCounts.set(firstSegment, (firstSegmentCounts.get(firstSegment) || 0) + 1);
            }
        }
    });
    
    // Find the most frequent first segment to use as root label
    let rootLabel = 'ROOT';
    let maxCount = 0;
    for (const [segment, count] of firstSegmentCounts.entries()) {
        if (count > maxCount) {
            maxCount = count;
            rootLabel = segment;
        }
    }
    
    console.log(`Using most common first segment as root label: ${rootLabel}`);
    
    // Create root node with this label
    const root = {
        id: 'ROOT',
        label: rootLabel,
        children: [],
        level: 0,
        expanded: true,
        isLeaf: false,
        hasChildren: false,
        path: ['ROOT']
    };
    
    // Map to store nodes by their path
    const nodeByPath = new Map();
    
    // Create nodes map
    const nodesMap = { 'ROOT': root };
    
    // Now process each item to build the hierarchy
    data.forEach(item => {
        if (!item.PATH) return;
        
        // Split the path into segments
        const segments = item.PATH.split('/').filter(s => s.trim() !== '');
        if (segments.length === 0) return;
        
        // Skip the first segment if it matches the root label
        const startIndex = segments[0] === rootLabel ? 1 : 0;
        
        // Process each segment in the path
        let parentNode = root;
        let currentPath = rootLabel;
        
        for (let i = startIndex; i < segments.length; i++) {
            const segment = segments[i];
            const isLastSegment = i === segments.length - 1;
            
            // Build up the path for this segment
            currentPath = `${currentPath}/${segment}`;
            
            // Check if we already have a node for this path
            let node = nodeByPath.get(currentPath);
            
            if (!node) {
                // Create a unique ID for this node
                const nodeId = `SEGMENT_${currentPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                
                // Create new node
                node = {
                    id: nodeId,
                    label: segment,
                    children: [],
                    level: i - startIndex + 1, // Adjust level based on startIndex
                    expanded: false,
                    isLeaf: isLastSegment,
                    hasChildren: !isLastSegment,
                    factId: isLastSegment ? item.LE : null,
                    path: [...parentNode.path, nodeId]
                };
                
                // Store in maps
                nodesMap[nodeId] = node;
                nodeByPath.set(currentPath, node);
                
                // Add as child to parent node
                parentNode.children.push(node);
                parentNode.hasChildren = true;
                parentNode.isLeaf = false;
            }
            
            // Update parent for next iteration
            parentNode = node;
        }
    });
    
    // Sort nodes at each level
    const sortNodes = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => a.label.localeCompare(b.label));
            node.children.forEach(sortNodes);
        }
    };
    
    sortNodes(root);
    
    console.log(`Successfully built Legal Entity hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
        root: root,
        nodesMap: nodesMap,
        flatData: data
    };
}



// Helper function to add descendant factIds to all nodes
function buildDescendantFactIds(node, nodesMap) {
    // Initialize descendantFactIds array if not present
    if (!node.descendantFactIds) {
        node.descendantFactIds = [];
    }
    
    // If this is a leaf node, add its own factId
    if (node.isLeaf && node.factId) {
        node.descendantFactIds.push(node.factId);
        return node.descendantFactIds;
    }
    
    // For non-leaf nodes, collect factIds from children
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            const childNode = typeof childId === 'object' ? childId : nodesMap[childId];
            if (childNode) {
                const childFactIds = buildDescendantFactIds(childNode, nodesMap);
                
                // Add unique factIds from children
                childFactIds.forEach(factId => {
                    if (!node.descendantFactIds.includes(factId)) {
                        node.descendantFactIds.push(factId);
                    }
                });
            }
        });
    }
    
    return node.descendantFactIds;
}


/**
 * Build a smart code hierarchy using the generic path-based approach
 * @param {Array} data - The smart code data
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
function buildSmartCodeHierarchy(data) {
    return buildGenericPathHierarchy(data, {
        getPath: item => item.PATH,
        getLeafId: item => item.SMARTCODE,
        getLeafLabel: item => item.SMARTCODE_DESC || item.DESCRIPTION,
        isLeafNode: (item, level, totalLevels) => {
            return (level === totalLevels - 1) && 
                (item.LEAF === true || item.LEAF === 'True' || 
                (item.LEAF === undefined && level === totalLevels - 1));
        },
        pathSeparator: '//'
    });
}


/**
 * Builds a hierarchy for cost elements from dimension data
 * Uses PATH column to build the hierarchy structure
 * @param {Array} data - Array of cost element dimension records
 * @returns {Object} - Processed hierarchy with root node, nodes map, and flat data
 */
function buildCostElementHierarchy(data) {
    return buildGenericPathHierarchy(data, {
        getPath: item => item.PATH,
        getLeafId: item => item.COST_ELEMENT,
        getLeafLabel: item => item.COST_ELEMENT_DESC,
        isLeafNode: (item, level, totalLevels) => {
            return (level === totalLevels - 1) && 
                (item.LEAF === true || item.LEAF === 'True' || 
                (item.LEAF === undefined && level === totalLevels - 1));
        },
        pathSeparator: '//'
    });
}


/**
 * Builds a hierarchical structure for GMID display data
 * @param {Array} data - Array of GMID display dimension records
 * @returns {Object} - Processed hierarchy with root node, nodes map, and flat data
 */
function buildGmidDisplayHierarchy(data) {
    console.log(`Processing ${data.length} rows of GMID path data...`);
    
    // Properly initialize masterRoot with required properties
    const masterRoot = {
        id: 'ROOT',
        label: 'All GMID Items',
        children: [],
        level: 0,
        expanded: true,
        isLeaf: false,
        hasChildren: true,
        path: ['ROOT']
    };

    // Map to store all nodes by their ID for quick lookup
    const nodesMap = {};
    nodesMap['ROOT'] = masterRoot;
    
    // Set to track all unique COMPONENT_GMIDs
    const componentGmidSet = new Set();
    
    // First collect all COMPONENT_GMIDs from the data
    data.forEach(item => {
        if (item.COMPONENT_GMID) {
            componentGmidSet.add(item.COMPONENT_GMID);
        }
    });
    
    console.log(`Found ${componentGmidSet.size} unique COMPONENT_GMIDs in dimension data`);
    
    // Create a node for each unique COMPONENT_GMID to ensure all are included
    componentGmidSet.forEach(gmid => {
        const nodeId = `GMID_${gmid}`;
        if (!nodesMap[nodeId]) {
            nodesMap[nodeId] = {
                id: nodeId,
                label: gmid, // Use GMID as label if no display info
                gmidCode: gmid, // Store the GMID code for filtering
                children: [],
                level: 0,
                pathSegment: gmid,
                expanded: true,
                isLeaf: true,
                hasChildren: false,
                factId: gmid // Set factId to COMPONENT_GMID for matching
            };
        }
    });
    
    // Map to store all unique display paths for grouping
    const displayPathMap = new Map();
    
    // Now process the DIM_GMID_DISPLAY data to build hierarchy
    data.forEach(item => {
        if (!item.COMPONENT_GMID) return;
        
        // Create or update node for this COMPONENT_GMID
        const componentGmid = item.COMPONENT_GMID;
        const nodeId = `GMID_${componentGmid}`;
        
        // Update the label if DISPLAY is available
        if (item.DISPLAY) {
            const displaySegments = item.DISPLAY.split('//').filter(s => s.trim() !== '');
            const displayLabel = displaySegments.length > 0 ? 
                displaySegments[displaySegments.length - 1] : item.DISPLAY;
            
            if (nodesMap[nodeId]) {
                nodesMap[nodeId].label = displayLabel;
                
                // Store the full display path for this GMID
                if (displaySegments.length > 0) {
                    // If we have a PATH_GMID, use the first segment as a prefix for grouping
                    let prefix = null;
                    if (item.PATH_GMID) {
                        const pathSegments = item.PATH_GMID.split('/').filter(s => s.trim() !== '');
                        if (pathSegments.length > 0) {
                            // Extract the prefix part (like HUPF from HUPF-613091)
                            const prefixMatch = pathSegments[0].match(/^([A-Za-z0-9]+)/i);
                            prefix = prefixMatch ? prefixMatch[1] : null;
                        }
                    }
                    
                    // Use the prefix if available, otherwise use 'Other'
                    prefix = prefix || 'Other';
                    
                    // Store in display path map for grouping
                    if (!displayPathMap.has(prefix)) {
                        displayPathMap.set(prefix, {
                            items: [],
                            // Store the first segment to use as a parent display
                            firstSegmentDisplay: displaySegments[0]
                        });
                    }
                    
                    displayPathMap.get(prefix).items.push({
                        componentGmid: componentGmid,
                        nodeId: nodeId,
                        displayPath: item.DISPLAY,
                        displaySegments: displaySegments,
                        pathGmid: item.PATH_GMID
                    });
                }
            }
        }
    });
    
    // Process each display path group to build hierarchies
    displayPathMap.forEach((groupData, prefix) => {
        // Create a category node for this prefix
        const categoryId = `CATEGORY_${prefix}`;

        // Use a descriptive label if available
        let categoryLabel = `${prefix} Items`;

        if (groupData.firstSegmentDisplay && groupData.firstSegmentDisplay.length>0){
            // Use the first segment from DISPLAY for a more descriptive category
            categoryLabel = groupData.firstSegmentDisplay;
        }

        const categoryNode = {
            id: categoryId,
            label: `${prefix} Items (${groupData.items.length})`,
            children: [],
            level: 1,
            expanded: true,
            isLeaf: false,
            hasChildren: true,
            prefixFilter: prefix,
            path: ['ROOT', categoryId]
        };
        
        nodesMap[categoryId] = categoryNode;
        masterRoot.children.push(categoryNode);
        
        // Group items by first display segment to create hierarchy
        const firstSegmentItems = new Map();
        
        groupData.items.forEach(item => {
            if (item.displaySegments.length > 0) {
                const firstSegment = item.displaySegments[0];
                
                if (!firstSegmentItems.has(firstSegment)) {
                    firstSegmentItems.set(firstSegment, []);
                }
                
                firstSegmentItems.get(firstSegment).push(item);
            } else {
                // If no display segments, add directly to category
                categoryNode.children.push(nodesMap[item.nodeId]);
                // Update the path of the GMID node
                nodesMap[item.nodeId].path = ['ROOT', categoryId, item.nodeId];
                nodesMap[item.nodeId].level = 2;
            }
        });
        
        // Create first-level display nodes
        firstSegmentItems.forEach((items, firstSegment) => {
            const displayNodeId = `DISPLAY_${prefix}_${firstSegment.substring(0, 20).replace(/\s+/g, '_')}`;
            
            // Create a node for this display segment
            const displayNode = {
                id: displayNodeId,
                label: firstSegment,
                children: [],
                level: 2,
                expanded: false,
                isLeaf: false,
                hasChildren: true,
                prefixFilter: prefix,
                path: ['ROOT', categoryId, displayNodeId]
            };
            
            nodesMap[displayNodeId] = displayNode;
            
            // Add all item nodes as children
            items.forEach(item => {
                const childNode = nodesMap[item.nodeId];
                if (childNode) {
                    displayNode.children.push(childNode);
                    // Update child node's path
                    childNode.path = ['ROOT', categoryId, displayNodeId, childNode.id];
                    childNode.level = 3;
                }
            });
            
            // Add to category node
            categoryNode.children.push(displayNode);
        });
    });
    
    // Process standalone nodes (those without display info)
    const standaloneNodes = Object.values(nodesMap).filter(node => 
        node.factId === node.pathSegment && // Only component nodes
        !node.id.includes('CATEGORY_') && // Not category nodes
        !masterRoot.children.some(childNode => // Not already in hierarchy
            childNode.children && childNode.children.some(grandchild => 
                grandchild.id === node.id
            )
        )
    );
    
    if (standaloneNodes.length > 0) {
        console.log(`Found ${standaloneNodes.length} standalone nodes without display info`);
        
        // Group by prefix
        const groupedNodes = {};
        
        standaloneNodes.forEach(node => {
            // Extract the prefix part (like HUPF from HUPF-613091)
            const prefixMatch = node.pathSegment ? node.pathSegment.match(/^([A-Za-z0-9]+)/i) : null;
            const prefix = prefixMatch ? prefixMatch[1] : 'Other';
            
            groupedNodes[prefix] = groupedNodes[prefix] || [];
            groupedNodes[prefix].push(node);
        });
        
        // Create or update category nodes for each prefix
        Object.entries(groupedNodes).forEach(([prefix, nodes]) => {
            if (nodes.length === 0) return;
            
            // Check if we already have a category for this prefix
            const existingCategoryId = `CATEGORY_${prefix}`;
            const existingCategory = nodesMap[existingCategoryId];
            
            if (existingCategory) {
                // Add these nodes to the existing category
                nodes.forEach(node => {
                    if (!existingCategory.children.some(child => 
                        (typeof child === 'object' && child.id === node.id) ||
                        (typeof child === 'string' && child === node.id)
                    )) {
                        existingCategory.children.push(node);
                        // Update node's path
                        node.path = ['ROOT', existingCategoryId, node.id];
                        node.level = 2;
                    }
                });
                
                // Update the count in the label
                existingCategory.label = `${prefix} Items (${existingCategory.children.length})`;
            } else {
                // Create a new category node
                const categoryId = `CATEGORY_${prefix}`;
                nodesMap[categoryId] = {
                    id: categoryId,
                    label: `${prefix} Items (${nodes.length})`,
                    children: nodes,
                    level: 1,
                    expanded: false,
                    isLeaf: false,
                    hasChildren: true,
                    prefixFilter: prefix,
                    path: ['ROOT', categoryId]
                };
                
                // Update paths for all child nodes
                nodes.forEach(node => {
                    node.path = ['ROOT', categoryId, node.id];
                    node.level = 2;
                });
                
                // Add to root
                masterRoot.children.push(nodesMap[categoryId]);
            }
        });
    }
    
    // Sort all nodes alphabetically at each level - REPLACE THIS FUNCTION
    // const sortHierarchyNodes = (node) => {
    //     // Skip if node is null or undefined
    //     if (!node) return;
        
    //     // Skip if no children
    //     if (!node.children || node.children.length === 0) return;
        
    //     try {
    //         // Sort children by label alphabetically with safety checks
    //         node.children.sort((a, b) => {
    //             const aNode = typeof a === 'string' ? nodesMap[a] : a;
    //             const bNode = typeof b === 'string' ? nodesMap[b] : b;
                
    //             // Handle missing nodes safely
    //             if (!aNode && !bNode) return 0;
    //             if (!aNode) return 1;
    //             if (!bNode) return -1;
                
    //             // Get labels with fallbacks
    //             const aLabel = aNode?.label || '';
    //             const bLabel = bNode?.label || '';
                
    //             return aLabel.localeCompare(bLabel);
    //         });
            
    //         // Process limited number of children to avoid stack overflow
    //         const MAX_CHILDREN = 1000;
    //         const childrenToProcess = node.children.length > MAX_CHILDREN ? 
    //             node.children.slice(0, MAX_CHILDREN) : node.children;
                
    //         if (node.children.length > MAX_CHILDREN) {
    //             console.warn(`Processing only ${MAX_CHILDREN} of ${node.children.length} children in sortHierarchyNodes to avoid stack overflow`);
    //         }
            
    //         // Track already processed nodes to avoid circular references
    //         const processedNodes = new Set();
    //         processedNodes.add(node.id);
            
    //         // Process each child but avoid recursion depth issues
    //         childrenToProcess.forEach(child => {
    //             try {
    //                 const childNode = typeof child === 'string' ? nodesMap[child] : child;
                    
    //                 if (childNode && childNode.id && !processedNodes.has(childNode.id)) {
    //                     processedNodes.add(childNode.id);
    //                     sortHierarchyNodes(childNode);
    //                 }
    //             } catch (err) {
    //                 console.warn(`Error processing child in sortHierarchyNodes: ${err.message}`);
    //             }
    //         });
    //     } catch (error) {
    //         console.error(`Error in sortHierarchyNodes: ${error.message}`);
    //     }
    // };
    
    // Now call the sorting function on the root node
    // try {
    //     sortHierarchyNodes(masterRoot);
    // } catch (error) {
    //     console.error("Error sorting hierarchy nodes:", error);
    // }
    
    console.log(`Successfully built GMID hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
        root: masterRoot,
        nodesMap: nodesMap,
        flatData: data
    };
}



/**
 * Builds mapping between DIM_LE and FACT_BOM for Legal Entity dimension
 * @param {Array} legalEntityData - Legal entity dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildLegalEntityMapping(legalEntityData, bomData) {
    console.log("Building Legal Entity mapping with PATH-based structure");
    
    // Create mapping object
    const mapping = {
        // Maps LE code to entity details
        leToDetails: {},
        
        // Maps path segments to LE codes
        pathToLeCodes: {},
        
        // Maps LE to its path for easier lookups
        leToPaths: {},
        
        // Maps node labels to LE codes
        labelToLeCodes: {},
        
        // Tracks which LE codes are used in FACT_BOM
        usedLeCodes: new Set()
    };
    
    // First pass - build the LE code mappings from dimension data
    if (legalEntityData && legalEntityData.length > 0) {
        legalEntityData.forEach(row => {
            if (row.LE) {
                // Store LE details
                mapping.leToDetails[row.LE] = {
                    description: row.LE_DESC || row.LE,
                    country: row.COUNTRY || '',
                    path: row.PATH || ''
                };
                
                // Store path to LE mapping
                if (row.PATH) {
                    // Normalize path separator - always use //
                    const normalizedPath = row.PATH.replace(/\//g, '//');
                    mapping.leToPaths[row.LE] = normalizedPath;
                    
                    // Process each segment of the path
                    const segments = normalizedPath.split('//').filter(s => s.trim() !== '');
                    
                    segments.forEach(segment => {
                        // Initialize if doesn't exist
                        if (!mapping.pathToLeCodes[segment]) {
                            mapping.pathToLeCodes[segment] = new Set();
                        }
                        
                        // Add this LE to the segment's collection
                        mapping.pathToLeCodes[segment].add(row.LE);
                        
                        // Also map by label
                        if (!mapping.labelToLeCodes[segment]) {
                            mapping.labelToLeCodes[segment] = new Set();
                        }
                        mapping.labelToLeCodes[segment].add(row.LE);
                    });
                }
                
                // Map by LE_DESC too for better matching
                if (row.LE_DESC) {
                    if (!mapping.labelToLeCodes[row.LE_DESC]) {
                        mapping.labelToLeCodes[row.LE_DESC] = new Set();
                    }
                    mapping.labelToLeCodes[row.LE_DESC].add(row.LE);
                }
            }
        });
    }
    
    // Second pass - identify which LE codes are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.LE) {
                mapping.usedLeCodes.add(row.LE);
            }
        });
    }
    
    // Add a direct mapping for any LE codes in FACT_BOM not found in dimension
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.LE && !mapping.leToDetails[row.LE]) {
                // Create a fallback mapping
                mapping.leToDetails[row.LE] = {
                    description: row.LE, // Use code as description
                    path: `UNKNOWN//${row.LE}` // Create a fallback path
                };
                
                // Add to pathToLeCodes
                if (!mapping.pathToLeCodes['UNKNOWN']) {
                    mapping.pathToLeCodes['UNKNOWN'] = new Set();
                }
                mapping.pathToLeCodes['UNKNOWN'].add(row.LE);
                
                // Add to leToPaths
                mapping.leToPaths[row.LE] = `UNKNOWN//${row.LE}`;
                
                // Add to labelToLeCodes
                if (!mapping.labelToLeCodes[row.LE]) {
                    mapping.labelToLeCodes[row.LE] = new Set();
                }
                mapping.labelToLeCodes[row.LE].add(row.LE);
            }
        });
    }
    
    // Convert Sets to Arrays for easier use with some libraries
    Object.keys(mapping.pathToLeCodes).forEach(key => {
        mapping.pathToLeCodes[key] = Array.from(mapping.pathToLeCodes[key]);
    });
    
    Object.keys(mapping.labelToLeCodes).forEach(key => {
        mapping.labelToLeCodes[key] = Array.from(mapping.labelToLeCodes[key]);
    });
    
    mapping.usedLeCodes = Array.from(mapping.usedLeCodes);
    
    return mapping;
}



/**
 * Builds mapping between DIM_COST_ELEMENT and FACT_BOM
 * @param {Array} costElementData - Cost element dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildCostElementMapping(costElementData, bomData) {
    console.log("Building Cost Element mapping");
    
    // Create mapping object
    const mapping = {
        // Maps cost element to its details
        costElementToDetails: {},
        // Maps hierarchy nodes to cost elements
        nodeToCostElements: {},
        // Tracks which cost elements are used in FACT_BOM
        usedCostElements: new Set()
    };
    
    // First pass - build mappings from dimension data
    if (costElementData && costElementData.length > 0) {
        costElementData.forEach(row => {
            if (row.COST_ELEMENT) {
                // Store cost element details
                mapping.costElementToDetails[row.COST_ELEMENT] = {
                    description: row.COST_ELEMENT_DESC || '',
                    path: row.PATH || ''
                };
                
                // Parse PATH to build node mappings
                if (row.PATH) {
                    const pathSegments = row.PATH.split('//').filter(s => s.trim() !== '');
                    pathSegments.forEach(segment => {
                        mapping.nodeToCostElements[segment] = mapping.nodeToCostElements[segment] || new Set();
                        mapping.nodeToCostElements[segment].add(row.COST_ELEMENT);
                    });
                }
            }
        });
    }
    
    // Second pass - identify which cost elements are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.COST_ELEMENT) {
                mapping.usedCostElements.add(row.COST_ELEMENT);
            }
        });
    }
    
    return mapping;
}


/**
 * Builds mapping between DIM_SMART_CODE and FACT_BOM
 * @param {Array} smartCodeData - Smart code dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildSmartCodeMapping(smartCodeData, bomData) {
    console.log("Building Smart Code mapping");
    
    // Create mapping object
    const mapping = {
        // Maps smartcode to details
        smartCodeToDetails: {},
        // Maps hierarchy nodes to smartcodes
        nodeToSmartCodes: {},
        // Tracks which smartcodes are used in FACT_BOM as ROOT_SMARTCODE
        usedSmartCodes: new Set()
    };
    
    // First pass - build mappings from dimension data
    if (smartCodeData && smartCodeData.length > 0) {
        smartCodeData.forEach(row => {
            if (row.SMARTCODE) {
                // Store smartcode details
                mapping.smartCodeToDetails[row.SMARTCODE] = {
                    description: row.SMARTCODE_DESC || '',
                    path: row.PATH || ''
                };
                
                // Parse PATH to build node mappings
                if (row.PATH) {
                    const pathSegments = row.PATH.split('//').filter(s => s.trim() !== '');
                    pathSegments.forEach(segment => {
                        mapping.nodeToSmartCodes[segment] = mapping.nodeToSmartCodes[segment] || new Set();
                        mapping.nodeToSmartCodes[segment].add(row.SMARTCODE);
                    });
                }
            }
        });
    }
    
    // Second pass - identify which smartcodes are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.ROOT_SMARTCODE) {
                mapping.usedSmartCodes.add(row.ROOT_SMARTCODE);
            }
        });
    }
    
    return mapping;
}


/**
 * Builds mapping between DIM_GMID_DISPLAY and FACT_BOM
 * @param {Array} gmidDisplayData - GMID display dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildGmidDisplayMapping(gmidDisplayData, bomData) {
    console.log("Building GMID Display mapping with PATH_GMID-based hierarchy");
    
    // Create mapping object
    const mapping = {
        // Maps COMPONENT_GMID to display information
        gmidToDisplay: {},
        // Maps any GMID or path segment from PATH_GMID to its display value
        pathGmidToDisplay: {},
        // Maps node IDs to their child GMIDs
        nodeToChildGmids: {},
        // Maps node IDs to their descendant GMIDs (all leaf GMIDs below)
        nodeToDescendantGmids: {},
        // Maps node IDs to their parent node ID
        nodeToParent: {},
        // Tracks which GMIDs are used in FACT_BOM as COMPONENT_GMID
        usedGmids: new Set()
    };
    
    // First load all GMIDs from BOM data to ensure we catch all needed GMIDs
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.COMPONENT_GMID) {
                mapping.usedGmids.add(row.COMPONENT_GMID);
                
                // Pre-populate the display mapping with at least the GMID itself
                // This ensures we at least have a placeholder for all GMIDs
                if (!mapping.gmidToDisplay[row.COMPONENT_GMID]) {
                    mapping.gmidToDisplay[row.COMPONENT_GMID] = {
                        display: row.COMPONENT_GMID,
                        fullPath: row.COMPONENT_GMID
                    };
                }
            }
        });
    }
    
    // Then process the display mappings
    if (gmidDisplayData && gmidDisplayData.length > 0) {
        console.log(`Processing ${gmidDisplayData.length} rows of GMID Display data...`);
        
        // Now process each row for display mappings
        gmidDisplayData.forEach(row => {
            // Skip rows without necessary data
            if (!row.COMPONENT_GMID) return;
            
            const componentGmid = row.COMPONENT_GMID;
            
            // Get display info
            let displayValue = row.DISPLAY || componentGmid;
            let displaySegments = displayValue.split('//').filter(s => s.trim() !== '');
            
            // If there are no segments, treat the whole display as one segment
            if (displaySegments.length === 0) {
                displaySegments = [displayValue];
            }
            
            // Update or create the GMID display mapping
            mapping.gmidToDisplay[componentGmid] = {
                display: displaySegments[displaySegments.length - 1] || componentGmid,
                fullPath: displayValue,
                pathGmid: row.PATH_GMID || componentGmid
            };
            
            // Process PATH_GMID to build hierarchy
            if (row.PATH_GMID) {
                const pathSegments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
                
                // Map each path segment to its display segment
                for (let i = 0; i < pathSegments.length; i++) {
                    const pathSegment = pathSegments[i];
                    
                    // Use corresponding display segment if available, otherwise use path segment
                    const displaySegment = (i < displaySegments.length) ? displaySegments[i] : pathSegment;
                    mapping.pathGmidToDisplay[pathSegment] = displaySegment;
                    
                    // Generate node ID for this segment
                    const nodeId = `GMID_${pathSegment}`;
                    
                    // Initialize this node's children and descendants if not already done
                    if (!mapping.nodeToChildGmids[nodeId]) {
                        mapping.nodeToChildGmids[nodeId] = new Set();
                        mapping.nodeToDescendantGmids[nodeId] = new Set();
                    }
                    
                    // If this is the last segment, add COMPONENT_GMID as a child
                    if (i === pathSegments.length - 1) {
                        mapping.nodeToChildGmids[nodeId].add(componentGmid);
                    }
                    
                    // Always add COMPONENT_GMID as a descendant of this node
                    mapping.nodeToDescendantGmids[nodeId].add(componentGmid);
                    
                    // If not the last segment, set up parent-child relationship with next segment
                    if (i < pathSegments.length - 1) {
                        const childPathSegment = pathSegments[i + 1];
                        const childNodeId = `GMID_${childPathSegment}`;
                        
                        mapping.nodeToChildGmids[nodeId].add(childNodeId);
                        mapping.nodeToParent[childNodeId] = nodeId;
                    }
                }
            } else {
                // If no PATH_GMID, create a node for this COMPONENT_GMID
                const nodeId = `GMID_${componentGmid}`;
                mapping.nodeToChildGmids[nodeId] = new Set([componentGmid]);
                mapping.nodeToDescendantGmids[nodeId] = new Set([componentGmid]);
            }
        });
    }
    
    // Convert Sets to Arrays for easier consumption
    for (const key in mapping.nodeToChildGmids) {
        mapping.nodeToChildGmids[key] = Array.from(mapping.nodeToChildGmids[key]);
    }
    
    for (const key in mapping.nodeToDescendantGmids) {
        mapping.nodeToDescendantGmids[key] = Array.from(mapping.nodeToDescendantGmids[key]);
    }
    
    mapping.usedGmids = Array.from(mapping.usedGmids);
    
    return mapping;
}


/**
 * Builds mapping between DIM_ITEM_COST_TYPE and FACT_BOM
 * Maps ITEM_COST_TYPE_DESC in dimension table to ITEM_COST_TYPE in fact table
 * @param {Array} itemCostTypeData - Item cost type dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildItemCostTypeMapping(itemCostTypeData, bomData) {
    console.log("Building Item Cost Type mapping with corrected field mapping");
    
    // Create mapping object
    const mapping = {
        // Maps ITEM_COST_TYPE to description
        codeToDesc: {},
        // Maps description to code
        descToCode: {},
        // Maps description in dimension to ITEM_COST_TYPE in fact table
        descToFactCode: {},
        // Tracks which item cost types are used in FACT_BOM
        usedItemCostTypes: new Set()
    };
    
    // First pass - build mappings from dimension data
    if (itemCostTypeData && itemCostTypeData.length > 0) {
        itemCostTypeData.forEach(row => {
            if (row.ITEM_COST_TYPE && row.ITEM_COST_TYPE_DESC) {
                // Store standard mappings
                mapping.codeToDesc[row.ITEM_COST_TYPE] = row.ITEM_COST_TYPE_DESC;
                mapping.descToCode[row.ITEM_COST_TYPE_DESC] = row.ITEM_COST_TYPE;
                
                // The crucial mapping: ITEM_COST_TYPE_DESC maps to ITEM_COST_TYPE in FACT_BOM
                mapping.descToFactCode[row.ITEM_COST_TYPE_DESC] = row.ITEM_COST_TYPE_DESC;
            }
        });
    }
    
    // Second pass - identify which item cost types are used in FACT_BOM
    // and build reverse mapping if needed
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.ITEM_COST_TYPE) {
                mapping.usedItemCostTypes.add(row.ITEM_COST_TYPE);
                
                // If this value doesn't already exist in our mapping, add it
                if (!Object.values(mapping.descToFactCode).includes(row.ITEM_COST_TYPE)) {
                    // Create a direct mapping entry (using the value itself as both key and value)
                    mapping.descToFactCode[row.ITEM_COST_TYPE] = row.ITEM_COST_TYPE;
                    
                    // Also add to standard mappings if missing
                    if (!mapping.codeToDesc[row.ITEM_COST_TYPE]) {
                        mapping.codeToDesc[row.ITEM_COST_TYPE] = row.ITEM_COST_TYPE;
                    }
                }
            }
        });
    }
    
    return mapping;
}


/**
 * Builds mapping between DIM_MATERIAL_TYPE and FACT_BOM
 * @param {Array} materialTypeData - Material type dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildMaterialTypeMapping(materialTypeData, bomData) {
    console.log("Building Material Type mapping");
    
    // Create mapping object
    const mapping = {
        // Maps MATERIAL_TYPE to description
        codeToDesc: {},
        // Maps description to code
        descToCode: {},
        // Tracks which material types are used in FACT_BOM as COMPONENT_MATERIAL_TYPE
        usedMaterialTypes: new Set()
    };
    
    // First pass - build mappings from dimension data
    if (materialTypeData && materialTypeData.length > 0) {
        materialTypeData.forEach(row => {
            if (row.MATERIAL_TYPE && row.MATERIAL_TYPE_DESC) {
                mapping.codeToDesc[row.MATERIAL_TYPE] = row.MATERIAL_TYPE_DESC;
                mapping.descToCode[row.MATERIAL_TYPE_DESC] = row.MATERIAL_TYPE;
            }
        });
    }
    
    // Second pass - identify which material types are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.COMPONENT_MATERIAL_TYPE) {
                mapping.usedMaterialTypes.add(row.COMPONENT_MATERIAL_TYPE);
            }
        });
    }
    
    return mapping;
}


/**
 * Converts a hierarchical structure to a flat array of nodes
 * Used for rendering and processing hierarchies
 * 
 * @param {Object} node - The root node to start from
 * @param {Array} result - Array to collect flattened nodes (for recursion)
 * @param {number} level - Current level in the hierarchy (for recursion)
 * @param {Array} parentPath - Path from root to parent (for recursion)
 * @returns {Array} - Flattened array of nodes with hierarchy information
 */
function flattenHierarchy(node, result = [], level = 0, parentPath = [], nodesMap = {}) {
    // Node validation
    if (!node) {
        console.warn("flattenHierarchy called with null/undefined node");
        return result;
    }
    
    // Get node ID with fallback
    const nodeId = node.id || node._id;
    if (!nodeId) {
        console.warn("Node has no ID:", node);
        return result;
    }
    
    // Create current path
    const currentPath = [...parentPath, nodeId];
    
    // Add current node to result with label
    result.push({
        id: nodeId,
        label: node.label || nodeId, // Ensure label exists
        level: level,
        path: currentPath,
        hasChildren: !!(node.children && node.children.length > 0),
        isLeaf: !!node.isLeaf,
        expanded: !!node.expanded,
        factId: node.factId,
        factCode: node.factCode,
        gmid: node.gmid,
        data: node.data
    });
    
    // Track processed nodes to prevent circular references
    const processedNodes = new Set([nodeId]);
    
    // Process children if node is expanded and has children
    if (node.expanded && node.children && node.children.length > 0) {
        // Limit children processing to prevent stack overflow
        const MAX_CHILDREN = 5000;
        const childrenToProcess = node.children.length > MAX_CHILDREN ?
            node.children.slice(0, MAX_CHILDREN) : 
            node.children;
            
        if (node.children.length > MAX_CHILDREN) {
            console.warn(`Processing only ${MAX_CHILDREN} of ${node.children.length} children to avoid stack overflow`);
        }
        
        // Process each child safely
        for (let i = 0; i < childrenToProcess.length; i++) {
            try {
                const child = childrenToProcess[i];
                
                // Is child a string ID or an object?
                if (typeof child === 'string') {
                    // If it's a string ID and nodesMap is provided, use it
                    if (nodesMap[child] && !processedNodes.has(child)) {
                        processedNodes.add(child);
                        // Use iteration instead of recursion to avoid stack overflow
                        const childNode = nodesMap[child];
                        if (childNode) {
                            result.push({
                                id: childNode.id || childNode._id || child,
                                label: childNode.label || child,
                                level: level + 1,
                                path: [...currentPath, childNode.id || childNode._id || child],
                                hasChildren: !!(childNode.children && childNode.children.length > 0),
                                isLeaf: !!childNode.isLeaf,
                                expanded: !!childNode.expanded,
                                factId: childNode.factId,
                                factCode: childNode.factCode,
                                gmid: childNode.gmid,
                                data: childNode.data
                            });
                        }
                    }
                } else if (child && typeof child === 'object') {
                    // If it's a direct object reference, use it
                    const childId = child.id || child._id;
                    if (childId && !processedNodes.has(childId)) {
                        processedNodes.add(childId);
                        // Use iteration instead of recursion
                        result.push({
                            id: childId,
                            label: child.label || childId,
                            level: level + 1,
                            path: [...currentPath, childId],
                            hasChildren: !!(child.children && child.children.length > 0),
                            isLeaf: !!child.isLeaf,
                            expanded: !!child.expanded,
                            factId: child.factId,
                            factCode: child.factCode,
                            gmid: child.gmid,
                            data: child.data
                        });
                    }
                }
            } catch (error) {
                console.error("Error processing child in flattenHierarchy:", error);
            }
        }
        
        // For a limited subset of direct children, still use recursion to go deeper
        // but limit to prevent stack overflow
        const RECURSION_LIMIT = 50;
        const recursiveChildren = childrenToProcess.slice(0, RECURSION_LIMIT);
        
        recursiveChildren.forEach(child => {
            try {
                // Is child a string ID or an object?
                if (typeof child === 'string') {
                    // If it's a string ID and nodesMap is provided, use it
                    if (nodesMap[child] && !processedNodes.has(`deep_${child}`)) {
                        processedNodes.add(`deep_${child}`);
                        flattenHierarchy(nodesMap[child], result, level + 1, currentPath, nodesMap);
                    }
                } else if (child && typeof child === 'object') {
                    // If it's a direct object reference, use it
                    const childId = child.id || child._id;
                    if (childId && !processedNodes.has(`deep_${childId}`)) {
                        processedNodes.add(`deep_${childId}`);
                        flattenHierarchy(child, result, level + 1, currentPath, nodesMap);
                    }
                }
            } catch (error) {
                console.error("Error processing recursive child in flattenHierarchy:", error);
            }
        });
    }
    
    return result;
}


/**
 * Gets a node by its ID from the specified hierarchy
 * 
 * @param {string} hierarchyName - Name of the hierarchy to search in
 * @param {string} nodeId - ID of the node to find
 * @param {Object} hierarchies - Object containing all hierarchies
 * @returns {Object|null} - The found node or null if not found
 */
function getNodeById(hierarchyName, nodeId, hierarchies) {
    const hierarchy = hierarchies[hierarchyName];
    if (!hierarchy) {
        console.error(`Hierarchy not found: ${hierarchyName}`);
        return null;
    }
    
    if (!hierarchy.nodesMap) {
        console.error(`nodesMap not found in hierarchy: ${hierarchyName}`);
        return null;
    }
    
    const node = hierarchy.nodesMap[nodeId];
    if (!node) {
        console.error(`Node not found: ${nodeId} in hierarchy: ${hierarchyName}`);
        return null;
    }
    
    return node;
}


/**
 * Enhanced version of the toggleNodeExpansion function to better handle column zone
 * @param {string} hierarchyName - Name of the hierarchy
 * @param {string} nodeId - ID of the node to toggle
 * @param {Object} hierarchies - Object containing all hierarchies
 * @param {string} zone - Zone of the node (row/column)
 * @returns {boolean} - Whether the operation was successful
 */
function enhancedToggleNodeExpansion(hierarchyName, nodeId, hierarchies, zone = 'row') {
    const hierarchy = hierarchies[hierarchyName];
    if (!hierarchy || !hierarchy.nodesMap[nodeId]) return false;
    
    const node = hierarchy.nodesMap[nodeId];
    
    // Toggle the main expanded state
    node.expanded = !node.expanded;
    
    // Handle zone-specific expanded state
    if (zone === 'column') {
        node.columnExpanded = node.expanded;
    } else {
        node.rowExpanded = node.expanded;
    }
    
    return true;
}


/**
 * Helper function to set all nodes in a hierarchy to collapsed state
 * @param {Object} node - The node to process
 */
function setAllNodesCollapsed(node) {
    if (!node) return;
    
    // Set this node to collapsed
    node.expanded = false;
    
    // Process children recursively
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            if (typeof childId === 'string' && this.nodesMap[childId]) {
                this.setAllNodesCollapsed(this.nodesMap[childId]);
            }
        });
    }
}


/**
 * Get all visible leaf nodes based on current expansion state
 * @param {Object} node - The root node to start from
 * @param {Array} result - Array to collect leaf nodes (for recursion)
 * @returns {Array} - Array of visible leaf nodes
 */
function getVisibleLeafNodes(node, result = []) {
    if (!node) return result;
    
    // If this is a leaf node, add it
    if (node.isLeaf) {
        result.push(node);
    } 
    // Otherwise process children if node is expanded
    else if (node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            if (typeof childId === 'string' && this.nodesMap[childId]) {
                this.getVisibleLeafNodes(this.nodesMap[childId], result);
            }
        });
    }
    
    return result;
}


/**
 * Regenerate any column hierarchies - Add this to the hierarchyHandler object
 * 
 * @param {Array} filteredData - The filtered data
 * @param {Object} state - Application state
 * @returns {boolean} - Whether any hierarchies were regenerated
 */
function regenerateColumnHierarchies(filteredData, state) {
    // Get the currently active column fields
    const activeColumnFields = state.columnFields || [];
    
    // Check if any DIM_ fields are in columns
    const dimInColumns = activeColumnFields.filter(field => field.startsWith('DIM_'));
    
    if (dimInColumns.length === 0 || !filteredData || filteredData.length === 0) {
        return false;
    }
    
    let regenerated = false;
    
    // Process each dimension in columns
    dimInColumns.forEach(dimField => {
        const dimName = dimField.replace('DIM_', '').toLowerCase();
        
        console.log(`Preserving hierarchy structure for ${dimField} in column zone`);
        
        // We don't actually regenerate the hierarchy - we just ensure we preserve it
        // by keeping the original structure and just marking the hierarchy as processed
        if (state.hierarchies[dimName]) {
            // For certain dimensions, we may want to update stats or counts
            // based on the filtered data, but keep the structure intact
            
            // For now, just mark it as processed
            regenerated = true;
        }
    });
    
    return regenerated;
}


/**
 * Filter records by Legal Entity
 * @param {Array} records - Records to filter
 * @param {string} leCode - Legal entity code
 * @returns {Array} - Filtered records
 */
function filterRecordsByLeHierarchy(records, leCode) {
    // If we have mapping, use it
    if (window.PivotApp && 
        PivotApp.leMapping && 
        PivotApp.leMapping.nodeToLeCodes && 
        PivotApp.leMapping.nodeToLeCodes[leCode]) {
        
        const leCodes = Array.from(PivotApp.leMapping.nodeToLeCodes[leCode]);
        return records.filter(record => leCodes.includes(record.LE));
    }
    
    // Fallback to direct matching
    return records.filter(record => record.LE === leCode);
}


/**
 * Diagnostic function to analyze GMID dimension data
 * @param {Array} data - The GMID display dimension data
 * @returns {Object} - Diagnostic information
 */
function diagnoseDimGmidData(data) {
    console.log(`Analyzing ${data.length} rows of DIM_GMID_DISPLAY data...`);
    
    // Check data structure
    const sampleRow = data.length > 0 ? data[0] : null;
    if (sampleRow) {
        console.log("Sample row structure:", Object.keys(sampleRow).join(", "));
        console.log("Sample row values:", JSON.stringify(sampleRow));
    }
    
    // Count rows with different key fields
    const counts = {
        hasComponentGmid: 0,
        hasPathGmid: 0,
        hasDisplay: 0,
        hasRootGmid: 0,
        hasRootDisplay: 0,
        pathGmidFormats: new Set(),
        displayFormats: new Set()
    };
    
    data.forEach(row => {
        if (row.COMPONENT_GMID) counts.hasComponentGmid++;
        if (row.PATH_GMID) counts.hasPathGmid++;
        if (row.DISPLAY) counts.hasDisplay++;
        if (row.ROOT_GMID) counts.hasRootGmid++;
        if (row.ROOT_DISPLAY) counts.hasRootDisplay++;
        
        // Check PATH_GMID format
        if (row.PATH_GMID) {
            if (row.PATH_GMID.includes('/')) {
                counts.pathGmidFormats.add('has_slashes');
            } else {
                counts.pathGmidFormats.add('no_slashes');
            }
        }
        
        // Check DISPLAY format
        if (row.DISPLAY) {
            if (row.DISPLAY.includes('//')) {
                counts.displayFormats.add('has_double_slashes');
            } else {
                counts.displayFormats.add('no_double_slashes');
            }
        }
    });
    
    console.log("Data analysis:");
    console.log(`- Rows with COMPONENT_GMID: ${counts.hasComponentGmid} of ${data.length}`);
    console.log(`- Rows with PATH_GMID: ${counts.hasPathGmid} of ${data.length}`);
    console.log(`- Rows with DISPLAY: ${counts.hasDisplay} of ${data.length}`);
    console.log(`- Rows with ROOT_GMID: ${counts.hasRootGmid} of ${data.length}`);
    console.log(`- Rows with ROOT_DISPLAY: ${counts.hasRootDisplay} of ${data.length}`);
    
    console.log("PATH_GMID formats:", Array.from(counts.pathGmidFormats).join(", "));
    console.log("DISPLAY formats:", Array.from(counts.displayFormats).join(", "));
    
    // Sample some PATH_GMID values
    const pathGmidSamples = data
        .filter(row => row.PATH_GMID)
        .map(row => row.PATH_GMID)
        .slice(0, 5);
    
    console.log("Sample PATH_GMID values:", pathGmidSamples);
    
    // Count unique values
    const uniqueCounts = {
        componentGmids: new Set(),
        rootGmids: new Set(),
        pathGmidSections: {}
    };
    
    data.forEach(row => {
        if (row.COMPONENT_GMID) uniqueCounts.componentGmids.add(row.COMPONENT_GMID);
        if (row.ROOT_GMID) uniqueCounts.rootGmids.add(row.ROOT_GMID);
        
        // Count unique path segments
        if (row.PATH_GMID) {
            const segments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
            segments.forEach((segment, index) => {
                uniqueCounts.pathGmidSections[index] = uniqueCounts.pathGmidSections[index] || new Set();
                uniqueCounts.pathGmidSections[index].add(segment);
            });
        }
    });
    
    console.log(`Unique COMPONENT_GMIDs: ${uniqueCounts.componentGmids.size}`);
    console.log(`Unique ROOT_GMIDs: ${uniqueCounts.rootGmids.size}`);
    
    Object.keys(uniqueCounts.pathGmidSections).forEach(level => {
        console.log(`Unique PATH_GMID segments at level ${level}: ${uniqueCounts.pathGmidSections[level].size}`);
    });
    
    return {
        counts,
        uniqueCounts,
        pathGmidSamples
    };
}


/**
 * Filters data based on multiple dimension criteria
 * @param {Array} data - Data array to filter
 * @param {Object} rowDef - Row definition with multiple dimensions
 * @returns {Array} - Filtered data array
 */
function filterDataByMultipleDimensions(data, rowDef) {
    // If not a multi-dimension row, use existing function
    if (!rowDef.dimensions) {
        return filterDataByDimension(data, rowDef);
    }
    
    // Start with all data
    let filteredData = [...data];
    
    // Filter by each dimension successively
    rowDef.dimensions.forEach(dimension => {
        // Skip non-hierarchical or ROOT dimensions
        if ((!dimension.hierarchyField && dimension._id === 'ROOT') ||
            (dimension._id === 'ITEM_COST_TYPE_ROOT') ||
            (dimension._id === 'COMPONENT_MATERIAL_TYPE_ROOT')) {
            return;
        }
        
        // Create a temp row definition for this dimension
        const dimRowDef = {
            _id: dimension._id,
            label: dimension.label,  // Add label for non-hierarchical filters
            hierarchyField: dimension.hierarchyField,
            isLeaf: dimension.isLeaf,
            factId: dimension.factId
        };
        
        // Filter data using existing function
        filteredData = filterDataByDimension(filteredData, dimRowDef);
    });
    
    return filteredData;
}


/**
 * Enhanced version of filterDataByMultipleDimensions that uses the new mappings
 * @param {Array} data - Data array to filter
 * @param {Object} rowDef - Row definition with multiple dimensions
 * @returns {Array} - Filtered data array
 */
function enhancedFilterByMultipleDimensions(data, rowDef) {
    // If not a multi-dimension row, use enhanced single dimension filter
    if (!rowDef.dimensions) {
        return enhancedFilterByDimension(data, rowDef);
    }
    
    // Start with all data
    let filteredData = [...data];
    
    // Filter by each dimension successively
    rowDef.dimensions.forEach(dimension => {
        // Skip non-hierarchical or ROOT dimensions
        if ((!dimension.hierarchyField && dimension._id === 'ROOT') ||
            (dimension._id === 'ITEM_COST_TYPE_ROOT') ||
            (dimension._id === 'COMPONENT_MATERIAL_TYPE_ROOT')) {
            return;
        }
        
        // Create a temp row definition for this dimension
        const dimRowDef = {
            _id: dimension._id,
            label: dimension.label,
            hierarchyField: dimension.hierarchyField,
            isLeaf: dimension.isLeaf,
            factId: dimension.factId
        };
        
        // Filter data using enhanced filtering
        filteredData = enhancedFilterByDimension(filteredData, dimRowDef);
    });
    
    return filteredData;
}


/**
 * Modified version of filterDataByDimension that ensures hierarchies
 * are displayed even when there's no matching fact data
 * @param {Array} data - Data array to filter
 * @param {Object} rowDef - Row node information
 * @returns {Array|Object} - Filtered data array or special object for empty results
 */
function preservingFilterByDimension(data, rowDef) {
    // Return 0 for empty record sets
    if (!data || data.length === 0) {
        return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
    }
    
    // Start with all records
    let filteredRecords = [...data];
    
    // Check if we're filtering by a hierarchical dimension
    if (rowDef.hierarchyField && rowDef.hierarchyField.startsWith('DIM_')) {
        const dimName = rowDef.hierarchyField.replace('DIM_', '').toLowerCase();
        const node = getNodeById(dimName, rowDef._id, state.hierarchies);
        
        if (node) {
            // Apply the normal filtering logic
            if (rowDef.isLeaf && rowDef.factId) {
                // For leaf nodes, filter by exact match
                filteredRecords = filteredRecords.filter(record => 
                    record[getFactIdField(dimName)] === rowDef.factId
                );
            } else {
                // For non-leaf nodes, get all leaf descendants
                const leafNodes = getAllLeafDescendants(node);
                const factIds = leafNodes.map(n => n.factId).filter(id => id);
                
                if (factIds.length > 0) {
                    filteredRecords = filteredRecords.filter(record => 
                        factIds.includes(record[getFactIdField(dimName)])
                    );
                }
            }
            
            // If no records matched, return empty array but with a special flag
            // that indicates this is a valid node that should be displayed
            if (filteredRecords.length === 0) {
                // Add a flag to indicate this is a valid hierarchy node with no matching data
                return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
            }
        }
    } else if (rowDef.hierarchyField === 'ITEM_COST_TYPE' || rowDef.hierarchyField === 'COMPONENT_MATERIAL_TYPE') {
        // Handle non-hierarchical special fields
        if (rowDef._id.endsWith('_ROOT')) {
            return filteredRecords; // Root shows all
        }
        
        const value = rowDef.factId || rowDef.label;
        filteredRecords = filteredRecords.filter(record => record[rowDef.hierarchyField] === value);
        
        // For empty result sets, add flag
        if (filteredRecords.length === 0) {
            return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
        }
    }
    
    return filteredRecords;
}


/**
 * Modified version of filterDataByMultipleDimensions that preserves hierarchies
 * @param {Array} data - Data array to filter
 * @param {Object} rowDef - Row definition with multiple dimensions
 * @returns {Array|Object} - Filtered data array or special object for empty results
 */
function preservingFilterByMultipleDimensions(data, rowDef) {
    // If not a multi-dimension row, use the preserving filter for single dimension
    if (!rowDef.dimensions) {
        return preservingFilterByDimension(data, rowDef);
    }
    
    // Start with all data
    let filteredData = [...data];
    let isEmpty = false;
    
    // Filter by each dimension successively
    rowDef.dimensions.forEach(dimension => {
        // Skip if already empty
        if (isEmpty) return;
        
        // Skip non-hierarchical or ROOT dimensions
        if ((!dimension.hierarchyField && dimension._id === 'ROOT') ||
            (dimension._id === 'ITEM_COST_TYPE_ROOT') ||
            (dimension._id === 'COMPONENT_MATERIAL_TYPE_ROOT')) {
            return;
        }
        
        // Create a temp row definition for this dimension
        const dimRowDef = {
            _id: dimension._id,
            label: dimension.label,  // Add label for non-hierarchical filters
            hierarchyField: dimension.hierarchyField,
            isLeaf: dimension.isLeaf,
            factId: dimension.factId,
            path: dimension.path
        };
        
        // Filter data using preserving filter
        const result = preservingFilterByDimension(filteredData, dimRowDef);
        
        // Check if it's an empty result
        if (result && result._isEmpty) {
            isEmpty = true;
            return;
        }
        
        // Update filtered data
        filteredData = result;
    });
    
    // If any dimension resulted in empty data, return special flag
    if (isEmpty) {
        return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
    }
    
    return filteredData;
}


/**
 * Process multiple dimension fields to create a combined hierarchy
 * This function creates a cartesian product of all dimensions for rendering
 * @param {Array} fieldIds - Array of field IDs to process
 * @returns {Object} - Object containing processed multi-dimension data
 */
function processMultiDimensionRows(fieldIds) {
    // First process each dimension individually to get its hierarchy
    const dimensionsData = fieldIds.map(fieldId => {
        return processHierarchicalFields([fieldId], 'row');
    });

    // Create a result structure combining all dimensions
    const result = {
        flatRows: [],          // Combined rows for rendering
        flatMappings: [],      // Mappings for data filtering
        dimensionsInfo: dimensionsData, // Keep original dimension data
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

    // If there's only one dimension, return its processed data directly
    if (dimensionsData.length === 1) {
        return dimensionsData[0];
    }

    // For multiple dimensions, we need to create a complete cartesian product
    // Start by ensuring we have ROOT nodes in all dimension data sets
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

    // Build cartesian product of all dimension combinations
    // Start with the first dimension's rows
    let combinedRows = [...dimensionsData[0].flatRows];
    let combinedMappings = [...dimensionsData[0].flatMappings];

    // For each additional dimension, create combinations with existing rows
    for (let i = 1; i < dimensionsData.length; i++) {
        const newRows = [];
        const newMappings = [];
        const currentDimRows = dimensionsData[i].flatRows;
        const currentDimMappings = dimensionsData[i].flatMappings;

        // Create combinations with existing rows
        for (let existingIdx = 0; existingIdx < combinedRows.length; existingIdx++) {
            const existingRow = combinedRows[existingIdx];
            const existingMapping = combinedMappings[existingIdx];

            for (let newIdx = 0; newIdx < currentDimRows.length; newIdx++) {
                const newRow = currentDimRows[newIdx];
                const newMapping = currentDimMappings[newIdx];

                // Create a composite row with combined data
                const combinedRow = {
                    _id: `${existingRow._id}|${newRow._id}`,
                    dimensions: []
                };

                // Add existing dimensions
                if (existingRow.dimensions) {
                    combinedRow.dimensions = [...existingRow.dimensions];
                } else {
                    // Convert single dimension row to multi-dimension format
                    combinedRow.dimensions = [{
                        _id: existingRow._id,
                        label: existingRow.label,
                        level: existingRow.level,
                        hasChildren: existingRow.hasChildren,
                        isLeaf: existingRow.isLeaf,
                        expanded: existingRow.expanded,
                        hierarchyField: existingRow.hierarchyField,
                        path: existingRow.path,
                        factId: existingRow.factId
                    }];
                }

                // Add the new dimension
                combinedRow.dimensions.push({
                    _id: newRow._id,
                    label: newRow.label,
                    level: newRow.level,
                    hasChildren: newRow.hasChildren,
                    isLeaf: newRow.isLeaf,
                    expanded: newRow.expanded,
                    hierarchyField: newRow.hierarchyField,
                    path: newRow.path,
                    factId: newRow.factId
                });

                // Combine mappings as well for data filtering
                const combinedMapping = {
                    id: combinedRow._id,
                    dimensions: []
                };

                // Add existing dimension mappings
                if (existingMapping.dimensions) {
                    combinedMapping.dimensions = [...existingMapping.dimensions];
                } else {
                    // Convert single dimension mapping to multi-dimension format
                    combinedMapping.dimensions = [{
                        id: existingMapping.id,
                        dimensionName: existingMapping.dimensionName || getDimensionName(existingRow.hierarchyField),
                        nodeId: existingMapping.nodeId || existingRow._id,
                        isHierarchical: existingMapping.isHierarchical,
                        isLeaf: existingMapping.isLeaf,
                        factId: existingMapping.factId,
                        factIdField: existingMapping.factIdField
                    }];
                }

                // Add the new dimension mapping
                combinedMapping.dimensions.push({
                    id: newMapping.id,
                    dimensionName: newMapping.dimensionName || getDimensionName(newRow.hierarchyField),
                    nodeId: newMapping.nodeId || newRow._id,
                    isHierarchical: newMapping.isHierarchical,
                    isLeaf: newMapping.isLeaf,
                    factId: newMapping.factId,
                    factIdField: newMapping.factIdField
                });

                // Add to results
                newRows.push(combinedRow);
                newMappings.push(combinedMapping);
            }
        }

        // Update combined rows for next iteration
        combinedRows = newRows;
        combinedMappings = newMappings;
    }

    // Update result with the combined data
    result.flatRows = combinedRows;
    result.flatMappings = combinedMappings;

    return result;
}


/**
 * Processes multiple row dimensions for multi-dimensional pivot tables
 * @param {Array} fieldIds - Array of field IDs to process
 * @param {string} axisType - Axis type ('row' or 'column')
 * @returns {Object} - Object containing combined rows and mappings
 */
function processMultipleRowDimensions(fieldIds, axisType) {
    // If there's only one field, use the existing function
    if (fieldIds.length <= 1) {
        return processHierarchicalFields(fieldIds, axisType);
    }
    
    const result = {
        flatRows: [],
        flatMappings: [],
        hierarchyFields: []
    };
    
    // Step 1: Process each field individually
    const dimensionResults = fieldIds.map(fieldId => {
        return processHierarchicalFields([fieldId], axisType);
    });
    
    // Collect all hierarchy fields from all dimensions
    dimensionResults.forEach(dimResult => {
        result.hierarchyFields = [...result.hierarchyFields, ...dimResult.hierarchyFields];
    });
    
    // Step 2: Create a cartesian product of all dimensions
    let combinedRows = [...dimensionResults[0].flatRows];
    let combinedMappings = [...dimensionResults[0].flatMappings];
    
    // For each additional dimension, create combinations with existing rows
    for (let i = 1; i < dimensionResults.length; i++) {
        const newRows = [];
        const newMappings = [];
        const currentDimRows = dimensionResults[i].flatRows;
        const currentDimMappings = dimensionResults[i].flatMappings;
        
        // Create combinations with existing rows
        for (let existingIdx = 0; existingIdx < combinedRows.length; existingIdx++) {
            const existingRow = combinedRows[existingIdx];
            const existingMapping = combinedMappings[existingIdx];
            
            for (let newIdx = 0; newIdx < currentDimRows.length; newIdx++) {
                const newRow = currentDimRows[newIdx];
                const newMapping = currentDimMappings[newIdx];
                
                // Skip ROOT nodes in subsequent dimensions
                if (newIdx > 0 && newRow._id === 'ROOT') continue;
                
                // Create a combined row ID
                const combinedId = `${existingRow._id}|${newRow._id}`;
                
                // Create a row object with dimension information
                const combinedRow = {
                    _id: combinedId,
                    dimensions: []
                };
                
                // Add existing dimensions
                if (existingRow.dimensions) {
                    combinedRow.dimensions = [...existingRow.dimensions];
                } else {
                    combinedRow.dimensions = [{
                        _id: existingRow._id,
                        label: existingRow.label,
                        level: existingRow.level,
                        hasChildren: existingRow.hasChildren,
                        isLeaf: existingRow.isLeaf,
                        expanded: existingRow.expanded,
                        hierarchyField: existingRow.hierarchyField,
                        path: existingRow.path,
                        factId: existingRow.factId
                    }];
                }
                
                // Add the new dimension
                combinedRow.dimensions.push({
                    _id: newRow._id,
                    label: newRow.label,
                    level: newRow.level,
                    hasChildren: newRow.hasChildren,
                    isLeaf: newRow.isLeaf,
                    expanded: newRow.expanded,
                    hierarchyField: newRow.hierarchyField,
                    path: newRow.path,
                    factId: newRow.factId
                });
                
                // Create a combined mapping object
                const combinedMapping = {
                    id: combinedId,
                    dimensions: []
                };
                
                // Add existing dimension mappings
                if (existingMapping.dimensions) {
                    combinedMapping.dimensions = [...existingMapping.dimensions];
                } else {
                    combinedMapping.dimensions = [{
                        id: existingMapping.id,
                        dimensionName: existingMapping.dimensionName || getDimensionName(existingRow.hierarchyField),
                        nodeId: existingMapping.nodeId || existingRow._id,
                        isHierarchical: existingMapping.isHierarchical,
                        isLeaf: existingMapping.isLeaf,
                        factId: existingMapping.factId,
                        factIdField: existingMapping.factIdField
                    }];
                }
                
                // Add the new dimension mapping
                combinedMapping.dimensions.push({
                    id: newMapping.id,
                    dimensionName: newMapping.dimensionName || getDimensionName(newRow.hierarchyField),
                    nodeId: newMapping.nodeId || newRow._id,
                    isHierarchical: newMapping.isHierarchical,
                    isLeaf: newMapping.isLeaf,
                    factId: newMapping.factId,
                    factIdField: newMapping.factIdField
                });
                
                newRows.push(combinedRow);
                newMappings.push(combinedMapping);
            }
        }
        
        // Update combined collections for next iteration
        combinedRows = newRows;
        combinedMappings = newMappings;
    }
    
    // Update result
    result.flatRows = combinedRows;
    result.flatMappings = combinedMappings;
    
    return result;
}


/**
 * Get description for Item Cost Type
 * @param {string} codeValue - The code value
 * @returns {string} - The description or the code if no description found
 */
function getItemCostTypeDesc(codeValue) {
    // Get the mapping from the state
    const mapping = state.mappings?.itemCostType?.codeToDesc;
    
    if (mapping && mapping[codeValue]) {
        return mapping[codeValue];
    }
    
    // Fallback to the code if no description found
    return codeValue;
}


/**
 * Get description for Material Type
 * @param {string} codeValue - The code value
 * @returns {string} - The description or the code if no description found
 */
function getMaterialTypeDesc(codeValue) {
    // Get the mapping from the state
    const mapping = state.mappings?.materialType?.codeToDesc;
    
    if (mapping && mapping[codeValue]) {
        return mapping[codeValue];
    }
    
    // Fallback to the code if no description found
    return codeValue;
}


/**
 * Generic function to get description for any dimension
 * @param {string} dimensionType - The dimension type
 * @param {string} codeValue - The code value
 * @returns {string} - The description or the code if no description found
 */
function getDimensionDescription(dimensionType, codeValue) {
    switch(dimensionType.toLowerCase()) {
        case 'item_cost_type':
            return getItemCostTypeDesc(codeValue);
        case 'material_type':
        case 'component_material_type':
            return getMaterialTypeDesc(codeValue);
        default:
            return codeValue;
    }
}


/**
 * Extract dimension name from a hierarchy field
 * @param {string} hierarchyField - Hierarchy field ID
 * @returns {string} - Dimension name
 */
function getDimensionName(hierarchyField) {
    if (!hierarchyField || !hierarchyField.startsWith('DIM_')) {
        return '';
    }
    return hierarchyField.replace('DIM_', '').toLowerCase();
}


/**
 * Processes hierarchical fields for pivot table display
 * Creates flattened hierarchy structures based on expanded nodes
 * @param {Array} fieldIds - Array of field IDs to process
 * @param {string} axisType - Axis type ('row' or 'column')
 * @returns {Object} - Object containing flattened rows and mappings
 */
function processHierarchicalFields(fieldIds, axisType) {
    const result = {
        flatRows: [],
        flatMappings: [],
        hierarchyFields: []
    };
    
    if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
        console.warn("No field IDs provided to processHierarchicalFields");
        return result;
    }
    
    fieldIds.forEach(fieldId => {
        if (!fieldId) {
            console.warn("Invalid field ID found in fieldIds array");
            return;
        }
        
        const field = state.availableFields ? state.availableFields.find(f => f.id === fieldId) : null;
        if (!field) {
            console.warn(`Field not found: ${fieldId}`);
            return;
        }
        
        // Check if this is a hierarchical dimension
        const isHierarchical = field.hierarchical;
        
        if (isHierarchical) {
            // Handle hierarchical field
            result.hierarchyFields.push(field);
            
            // Get the dimension name
            const dimName = field.id.replace('DIM_', '').toLowerCase();
            const hierarchy = state.hierarchies ? state.hierarchies[dimName] : null;
            
            if (hierarchy && hierarchy.root) {
                // Get zone-specific expanded nodes
                const zone = axisType;
                
                // Always ensure ROOT is expanded
                if (!state.expandedNodes[dimName]) {
                    state.expandedNodes[dimName] = { row: {}, column: {} };
                }
                if (!state.expandedNodes[dimName][zone]) {
                    state.expandedNodes[dimName][zone] = {};
                }
                state.expandedNodes[dimName][zone]['ROOT'] = true;
                
                // Flatten the hierarchy safely
                try {
                    // Debug the hierarchy
                    console.log(`Processing ${dimName} hierarchy with root:`, {
                        rootId: hierarchy.root.id || 'undefined',
                        rootLabel: hierarchy.root.label || 'undefined',
                        childCount: hierarchy.root.children ? hierarchy.root.children.length : 0
                    });
                    
                    // Flatten the hierarchy with error handling
                    const flattenedNodes = flattenHierarchy(hierarchy.root, [], 0, [], hierarchy.nodesMap || {});
                    
                    // Debug flattened nodes
                    console.log(`Flattened ${flattenedNodes.length} nodes for ${dimName}`);
                    
                    // Add to flat rows - all nodes are included
                    flattenedNodes.forEach(node => {
                        if (!node || !node.id) {
                            console.warn("Invalid node found during flattening", node);
                            return;
                        }
                        
                        result.flatRows.push({
                            _id: node.id,
                            label: node.label || node.id || 'Unknown', // Use ID as fallback
                            level: node.level || 0,
                            hasChildren: !!node.hasChildren,
                            isLeaf: !!node.isLeaf,
                            expanded: !!node.expanded,
                            hierarchyField: field.id,
                            path: node.path || [],
                            factId: node.factId,
                            sortKey: node.path ? node.path.join('|') : ''
                        });
                        
                        // Add mapping for this node
                        result.flatMappings.push({
                            id: node.id,
                            dimensionName: dimName,
                            nodeId: node.id,
                            isHierarchical: true,
                            isLeaf: !!node.isLeaf,
                            factId: node.factId,
                            factIdField: getFactIdField(dimName)
                        });
                    });
                } catch (error) {
                    console.error(`Error flattening hierarchy for ${dimName}:`, error);
                }
            } else {
                console.warn(`Hierarchy for ${dimName} is missing or has no root node`);
            }
        } else if (field.id === 'DIM_ITEM_COST_TYPE' || field.id === 'ITEM_COST_TYPE' ||
                  field.id === 'DIM_MATERIAL_TYPE' || field.id === 'COMPONENT_MATERIAL_TYPE') {
            // Handle special non-hierarchical dimensions
            try {
                const dimStructure = processNonHierarchicalDimension(field.id, state.rawFactBOMData || []);
                
                if (!dimStructure || !dimStructure.root) {
                    console.warn(`Failed to process non-hierarchical dimension: ${field.id}`);
                    return;
                }
                
                // Add all nodes to the flat structures
                const flatNodes = [];
                
                // Add root node
                flatNodes.push({
                    _id: dimStructure.root._id,
                    label: dimStructure.root.label,
                    level: dimStructure.root.level,
                    hasChildren: dimStructure.root.hasChildren,
                    isLeaf: dimStructure.root.isLeaf,
                    expanded: dimStructure.root.expanded,
                    hierarchyField: field.id,
                    path: dimStructure.root.path
                });
                
                // Add child nodes
                Object.keys(dimStructure.nodesMap || {}).forEach(nodeId => {
                    if (nodeId === dimStructure.root._id) return; // Skip root
                    
                    const node = dimStructure.nodesMap[nodeId];
                    if (!node) return; // Skip missing nodes
                    
                    flatNodes.push({
                        _id: node._id,
                        label: node.label || 'Unknown',
                        level: node.level || 0,
                        hasChildren: !!node.hasChildren,
                        isLeaf: !!node.isLeaf,
                        expanded: !!node.expanded,
                        hierarchyField: field.id,
                        path: node.path || [],
                        factId: node.factId
                    });
                });
                
                // Add to result
                result.flatRows.push(...flatNodes);
                
                // Add mappings
                flatNodes.forEach(node => {
                    result.flatMappings.push({
                        id: node._id,
                        dimensionName: field.id,
                        nodeId: node._id,
                        isHierarchical: false,
                        isLeaf: !!node.isLeaf,
                        factId: node.factId,
                        factIdField: node.isLeaf ? (field.id === 'DIM_ITEM_COST_TYPE' ? 'ITEM_COST_TYPE' : 'COMPONENT_MATERIAL_TYPE') : null
                    });
                });
            } catch (error) {
                console.error(`Error processing non-hierarchical dimension ${field.id}:`, error);
            }
        }
    });
    
    return result;
}



/**
 * Filter data based on dimension information
 * @param {Array} data - The data to filter
 * @param {Object} rowDef - The dimension definition
 * @returns {Array} - Filtered data
 */
function filterDataByDimension(data, rowDef) {
    if (!rowDef) return data;
    
    // Handle multi-dimension rows differently
    if (rowDef.dimensions) {
        return filterDataByMultipleDimensions(data, rowDef);
    }
    
    // Skip ROOT nodes
    if (rowDef._id === 'ROOT') return data;
    
    // Get dimension information
    const hierarchyField = rowDef.hierarchyField;
    if (!hierarchyField) return data;
    
    const dimName = hierarchyField.replace('DIM_', '').toLowerCase();
    
    // For special non-hierarchical dimensions
    if (hierarchyField === 'ITEM_COST_TYPE' || hierarchyField === 'DIM_ITEM_COST_TYPE') {
        if (rowDef._id === 'ITEM_COST_TYPE_ROOT') return data;
        const value = rowDef.factId || rowDef.label;
        return data.filter(row => row.ITEM_COST_TYPE === value);
    }
    
    if (hierarchyField === 'COMPONENT_MATERIAL_TYPE' || hierarchyField === 'DIM_MATERIAL_TYPE') {
        if (rowDef._id === 'COMPONENT_MATERIAL_TYPE_ROOT') return data;
        const value = rowDef.factId || rowDef.label;
        return data.filter(row => row.COMPONENT_MATERIAL_TYPE === value);
    }
    
    // For hierarchical dimensions
    const hierarchy = state.hierarchies[dimName];
    if (!hierarchy) return data;
    
    const node = hierarchy.nodesMap[rowDef._id];
    if (!node) return data;
    
    // For leaf nodes, filter by factId
    if (node.isLeaf && node.factId) {
        const factIdField = getFactIdField(dimName);
        return data.filter(row => row[factIdField] === node.factId);
    }
    
    // For non-leaf nodes, use all descendant factIds
    if (node.descendantFactIds && node.descendantFactIds.length > 0) {
        const factIdField = getFactIdField(dimName);
        const factIdSet = new Set(node.descendantFactIds);
        return data.filter(row => factIdSet.has(row[factIdField]));
    }
    
    return data;
}


/**
 * Enhanced single dimension filter method
 * @param {Array} data - The data to filter
 * @param {Object} rowDef - The dimension definition
 * @returns {Array} - Filtered data
 */
function enhancedFilterByDimension(data, rowDef) {
    if (!rowDef) return data;
    
    // Skip ROOT nodes
    if (rowDef._id === 'ROOT') return data;
    
    // Get dimension information
    const hierarchyField = rowDef.hierarchyField;
    if (!hierarchyField) return data;
    
    const dimName = hierarchyField.replace('DIM_', '').toLowerCase();
    
    // For special non-hierarchical dimensions
    if (hierarchyField === 'ITEM_COST_TYPE' || hierarchyField === 'DIM_ITEM_COST_TYPE') {
        if (rowDef._id === 'ITEM_COST_TYPE_ROOT') return data;
        const value = rowDef.factId || rowDef.label;
        return data.filter(row => row.ITEM_COST_TYPE === value);
    }
    
    if (hierarchyField === 'COMPONENT_MATERIAL_TYPE' || hierarchyField === 'DIM_MATERIAL_TYPE') {
        if (rowDef._id === 'COMPONENT_MATERIAL_TYPE_ROOT') return data;
        const value = rowDef.factId || rowDef.label;
        return data.filter(row => row.COMPONENT_MATERIAL_TYPE === value);
    }
    
    // For hierarchical dimensions, use the proper mapping
    switch (dimName) {
        case 'legal_entity':
            return filterByLegalEntity(data, rowDef);
        case 'cost_element':
            return filterByCostElement(data, rowDef);
        case 'smart_code':
            return filterBySmartCode(data, rowDef);
        case 'gmid_display':
            return filterByGmidDisplay(data, rowDef);
        default:
            // Default to original filter for other dimensions
            return filterDataByDimension(data, rowDef);
    }
}


/**
 * Generic function to build a hierarchy from level-based data
 * @param {Array} data - Array of data objects
 * @param {Object} config - Configuration object with the following properties:
 *   @param {Function} config.getLevelValue - Function to get the value at a specific level
 *   @param {Function} config.getLevelCount - Function to get the number of levels
 *   @param {Function} config.getLeafId - Function to get the ID of a leaf node
 *   @param {Function} config.getLeafLabel - Function to get the label for a leaf node
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
function buildGenericHierarchy(data, config) {
    console.log(`Processing ${data.length} rows of data...`);
    console.log("Sample row:", data.length > 0 ? data[0] : "No data");
    
    // Default configuration
    const defaultConfig = {
        getLevelValue: (item, level) => item[`LEVEL_${level}`],
        getLevelCount: () => 10,
        getLeafId: item => item.ID,
        getLeafLabel: item => item.NAME || item.DESCRIPTION
    };
    
    // Merge default config with provided config
    const finalConfig = { ...defaultConfig, ...config };
    
    // Find all unique values at the first level to create root nodes
    const level1Values = new Set();
    data.forEach(item => {
        const value = finalConfig.getLevelValue(item, 1);
        if (value) {
            level1Values.add(value);
        }
    });
    
    // Create a master root node if there are multiple level 1 nodes
    const needsMasterRoot = level1Values.size > 1;
    
    // Determine the root label based on level 1 values
    let rootLabel = "All Items"; // Default fallback
    if (level1Values.size === 1) {
        // If there's just one level 1 value, use it directly
        rootLabel = Array.from(level1Values)[0];
    } else if (level1Values.size > 1) {
        // For multiple values, create a common parent name
        // Find a common prefix if possible
        const values = Array.from(level1Values);
        let commonPrefix = "";
        
        // Simple algorithm to find common word prefix
        const firstWords = values.map(v => v.split(' ')[0]);
        if (new Set(firstWords).size === 1) {
            commonPrefix = firstWords[0] + " ";
        }
        
        rootLabel = `${commonPrefix}${rootLabel}`;
    }
    
    const masterRootNode = {
        id: 'ROOT', 
        label: rootLabel, 
        children: [], 
        level: 0, 
        path: ['ROOT'],
        expanded: true,
        isLeaf: false,
        hasChildren: false
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'ROOT': masterRootNode };
    
    // Create root nodes for each level 1 value
    const rootNodes = Array.from(level1Values).map(value => {
        const rootId = `ROOT_${value}`;
        const rootNode = { 
            id: rootId, 
            label: value, 
            children: [], 
            level: needsMasterRoot ? 1 : 0, 
            path: needsMasterRoot ? ['ROOT', rootId] : [rootId],
            expanded: false,
            isLeaf: false,
            hasChildren: false
        };
        
        nodesMap[rootId] = rootNode;
        
        // Add to master root if needed
        if (needsMasterRoot) {
            masterRootNode.children.push(rootNode);
            masterRootNode.hasChildren = true;
        }
        
        return rootNode;
    });
    
    // Process each data item
    data.forEach(item => {
        if (!item) return;
        
        // Find appropriate root node for this item
        const level1Value = finalConfig.getLevelValue(item, 1);
        let parentNode = level1Value 
            ? rootNodes.find(node => node.label === level1Value) 
            : (needsMasterRoot ? null : rootNodes[0]);
        
        // Skip if no matching root
        if (!parentNode) return;
        
        let currentNode = parentNode;
        let currentPath = [...currentNode.path];
        
        // Process each level starting from level 2
        const startLevel = 2;
        const maxLevel = finalConfig.getLevelCount();
        
        for (let i = startLevel; i <= maxLevel; i++) {
            const levelValue = finalConfig.getLevelValue(item, i);
            
            // Skip empty levels
            if (!levelValue) continue;
            
            // Skip if level value is the same as current node label
            if (levelValue === currentNode.label) continue;
            
            // Create a unique ID for this node
            const levelNodeId = `LEVEL_${i}_${levelValue}`;
            
            // Create the node if it doesn't exist
            if (!nodesMap[levelNodeId]) {
                const newNode = {
                    id: levelNodeId,
                    label: levelValue,
                    children: [],
                    level: currentNode.level + 1,
                    path: [...currentPath, levelNodeId],
                    expanded: false,
                    isLeaf: true,
                    hasChildren: false
                };
                
                nodesMap[levelNodeId] = newNode;
                currentNode.children.push(newNode);
                currentNode.isLeaf = false;
                currentNode.hasChildren = true;
            }
            
            // Update current node for next level
            currentNode = nodesMap[levelNodeId];
            currentPath = [...currentPath, levelNodeId];
        }
        
        // Add leaf node data if possible
        const leafId = finalConfig.getLeafId(item);
        if (leafId && !currentNode.factId) {
            // Assign leaf properties
            currentNode.factId = leafId;
            currentNode.data = { ...item };
            
            // Update label if a better one is available
            const betterLabel = finalConfig.getLeafLabel(item);
            if (betterLabel && 
                betterLabel !== currentNode.label && 
                betterLabel.length > currentNode.label.length) {
                currentNode.label = betterLabel;
            }
        }
    });
    
    // Sort hierarchy
    const rootNode = needsMasterRoot ? masterRootNode : rootNodes[0];
    sortHierarchyNodes(rootNode);
    
    return {
        root: rootNode,
        nodesMap: nodesMap,
        flatData: data
    };
}


/**
 * Generic function to build a hierarchy from path-based data
 * @param {Array} data - Array of data objects
 * @param {Object} config - Configuration object with the following properties:
 *   @param {Function} config.getPath - Function to get the path string
 *   @param {Function} config.getLeafId - Function to get the ID of a leaf node
 *   @param {Function} config.getLeafLabel - Function to get the label for a leaf node
 *   @param {Function} config.isLeafNode - Function to determine if an item is a leaf node
 *   @param {String} config.pathSeparator - Separator for path segments
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
function buildGenericPathHierarchy(data, config) {
    console.log(`Processing ${data.length} rows of path-based data...`);
    console.log("Sample row:", data.length > 0 ? data[0] : "No data");
    
    // Default configuration
    const defaultConfig = {
        getPath: item => item.PATH,
        getLeafId: item => item.ID,
        getLeafLabel: item => item.DESCRIPTION || item.NAME,
        isLeafNode: (item, level, totalLevels) => level === totalLevels - 1,
        pathSeparator: '//'
    };
    
    // Merge default config with provided config
    const finalConfig = { ...defaultConfig, ...config };
    
    // Find all unique first level segments to create root nodes
    const firstLevelSegments = new Set();
    data.forEach(item => {
        const path = finalConfig.getPath(item);
        if (path) {
            const segments = path.split(finalConfig.pathSeparator).filter(s => s.trim() !== '');
            if (segments.length > 0) {
                firstLevelSegments.add(segments[0]);
            }
        }
    });
    
    // Create a master root node if there are multiple first level segments
    const needsMasterRoot = firstLevelSegments.size > 1;
    
    // Determine the root label based on first level segments
    let rootLabel = "All Items"; // Default fallback
    if (firstLevelSegments.size === 1) {
        // If there's just one first level segment, use it directly
        rootLabel = Array.from(firstLevelSegments)[0];
    } else if (firstLevelSegments.size > 1) {
        // For multiple segments, create a common parent name
        // Find a common prefix if possible
        const segments = Array.from(firstLevelSegments);
        let commonPrefix = "";
        
        // Simple algorithm to find common word prefix
        const firstWords = segments.map(s => s.split(' ')[0]);
        if (new Set(firstWords).size === 1) {
            commonPrefix = firstWords[0] + " ";
        }
        
        rootLabel = `${commonPrefix}${rootLabel}`;
    }
    
    const masterRootNode = {
        id: 'ROOT', 
        label: rootLabel, 
        children: [], 
        level: 0, 
        path: ['ROOT'],
        expanded: true,
        isLeaf: false,
        hasChildren: false
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'ROOT': masterRootNode };
    
    // Map to track nodes by path key to prevent duplicates
    const nodesByPathKey = new Map();
    
    // For single root (no master root), create the root node
    let singleRootNode = null;
    if (!needsMasterRoot && firstLevelSegments.size === 1) {
        const rootSegment = Array.from(firstLevelSegments)[0];
        const rootId = `ROOT_${rootSegment}`;
        singleRootNode = {
            id: rootId,
            label: rootSegment,
            children: [],
            level: 0,
            path: [rootId],
            expanded: false,
            isLeaf: false,
            hasChildren: false
        };
        nodesMap[rootId] = singleRootNode;
    }
    
    // Process each item in the data array
    data.forEach(item => {
        if (!item) return;
        
        const pathString = finalConfig.getPath(item);
        if (!pathString) return;
        
        // Split the path into segments
        const pathSegments = pathString.split(finalConfig.pathSeparator)
            .filter(segment => segment.trim() !== '');
        
        if (pathSegments.length === 0) return;
        
        // Start with appropriate parent node
        let currentNode, currentPath;
        
        if (needsMasterRoot) {
            // Using master root with multiple segment values
            currentNode = masterRootNode;
            currentPath = ['ROOT'];
        } else if (singleRootNode) {
            // For single root, use it and skip the first segment
            currentNode = singleRootNode;
            currentPath = [singleRootNode.id];
            
            // Continue processing from the second segment
            pathSegments.shift();
        } else {
            // No root node exists - create it from the first segment
            const firstSegment = pathSegments[0];
            const rootId = `ROOT_${firstSegment}`;
            
            if (!nodesMap[rootId]) {
                singleRootNode = {
                    id: rootId,
                    label: firstSegment,
                    children: [],
                    level: 0,
                    path: [rootId],
                    expanded: false,
                    isLeaf: pathSegments.length === 1,
                    hasChildren: pathSegments.length > 1
                };
                nodesMap[rootId] = singleRootNode;
            }
            
            currentNode = nodesMap[rootId];
            currentPath = [rootId];
            
            // Skip first segment since it's the root
            pathSegments.shift();
        }
        
        // If we're using a master root, process the first segment separately
        if (needsMasterRoot && pathSegments.length > 0) {
            const firstSegment = pathSegments[0];
            const rootId = `ROOT_${firstSegment}`;
            
            // Create or get the root node for this first segment
            if (!nodesMap[rootId]) {
                const rootNode = {
                    id: rootId,
                    label: firstSegment,
                    children: [],
                    level: 1,
                    path: ['ROOT', rootId],
                    expanded: false,
                    isLeaf: pathSegments.length === 1,
                    hasChildren: pathSegments.length > 1
                };
                
                nodesMap[rootId] = rootNode;
                masterRootNode.children.push(rootNode);
                masterRootNode.hasChildren = true;
            }
            
            // Update current node to this root
            currentNode = nodesMap[rootId];
            currentPath = ['ROOT', rootId];
            
            // Skip first segment since we've processed it
            pathSegments.shift();
        }
        
        // Process each remaining segment of the path
        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            
            // Skip empty segments
            if (!segment || segment === "") continue;
            
            // Create a unique path key for this segment
            const pathKey = `${currentNode.id}_${segment}`;
            const nodeId = `SEGMENT_${pathKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            
            // Check if we already have a node for this path segment
            if (!nodesByPathKey.has(pathKey)) {
                // Determine if this is a leaf node
                const isLeafNode = finalConfig.isLeafNode(item, i, pathSegments.length);
                
                const newNode = {
                    id: nodeId,
                    label: segment,
                    children: [],
                    level: currentNode.level + 1,
                    path: [...currentPath, nodeId],
                    expanded: false,
                    isLeaf: isLeafNode,
                    hasChildren: !isLeafNode,
                    factId: isLeafNode ? finalConfig.getLeafId(item) : null
                };
                
                nodesMap[nodeId] = newNode;
                nodesByPathKey.set(pathKey, nodeId);
                
                // Add to parent's children
                currentNode.children.push(newNode);
                currentNode.isLeaf = false;
                currentNode.hasChildren = true;
                
                // If this is a leaf node, store additional data
                if (isLeafNode) {
                    newNode.data = { ...item };
                    
                    // Update label if a better one is available
                    const betterLabel = finalConfig.getLeafLabel(item);
                    if (betterLabel && betterLabel !== newNode.label) {
                        newNode.label = betterLabel;
                    }
                }
            }
            
            // Update current node and path for next iteration
            const existingNodeId = nodesByPathKey.get(pathKey);
            currentNode = nodesMap[existingNodeId];
            currentPath = [...currentPath, existingNodeId];
        }
    });
    
    // Sort hierarchy
    const rootNode = needsMasterRoot ? masterRootNode : 
        (singleRootNode || Object.values(nodesMap).find(node => node.level === 0) || masterRootNode);
    sortHierarchyNodes(rootNode);
    
    return {
        root: rootNode,
        nodesMap: nodesMap,
        flatData: data
    };
}


/**
 * Helper function for sorting hierarchy nodes
 * @param {Object} node - The node whose children to sort
 */
function sortHierarchyNodes(node) {
    if (node.children && node.children.length > 0) {
        // Sort children by label alphabetically
        node.children.sort((a, b) => {
            // Handle both direct node objects and references
            const aNode = typeof a === 'object' ? a : (node.nodesMap ? node.nodesMap[a] : null);
            const bNode = typeof b === 'object' ? b : (node.nodesMap ? node.nodesMap[b] : null);
            
            const aLabel = aNode?.label || '';
            const bLabel = bNode?.label || '';
            
            return aLabel.localeCompare(bLabel);
        });
        
        // Recursively sort children's children
        node.children.forEach(child => {
            const childNode = typeof child === 'object' ? child : (node.nodesMap ? node.nodesMap[child] : null);
            if (childNode) {
                sortHierarchyNodes(childNode);
            }
        });
    }
}


/**
 * Process fact data before using it in pivot table
 * Ensures numeric fields are properly typed, etc.
 */
function processrawFactBOMData() {
    try {
        console.log("Processing fact data...");
        
        if (!state.rawFactBOMData || state.rawFactBOMData.length === 0) {
            console.warn("No fact data available to process");
            return;
        }
        
        console.log(`Processing ${state.rawFactBOMData.length} fact records...`);
        
        // Force numeric conversion for value fields
        let numericConversionCount = 0;
        state.rawFactBOMData.forEach(row => {
            // Process COST_UNIT
            if (row.COST_UNIT !== undefined) {
                const parsedValue = parseFloat(row.COST_UNIT);
                if (isNaN(parsedValue)) {
                    row.COST_UNIT = 0;
                } else {
                    row.COST_UNIT = parsedValue;
                    if (typeof row.COST_UNIT !== 'number') {
                        numericConversionCount++;
                    }
                }
            } else {
                row.COST_UNIT = 0;
            }
            
            // Process QTY_UNIT
            if (row.QTY_UNIT !== undefined) {
                const parsedValue = parseFloat(row.QTY_UNIT);
                if (isNaN(parsedValue)) {
                    row.QTY_UNIT = 0;
                } else {
                    row.QTY_UNIT = parsedValue;
                }
            } else {
                row.QTY_UNIT = 0;
            }
        });
        
        console.log(`Converted ${numericConversionCount} records to ensure numeric values`);
        
        // Extract unique values for filtering
        const uniqueValues = extractUniqueFactValues(state.rawFactBOMData);
        state.uniqueValues = uniqueValues;
        
        console.log("Fact data processing complete");
        
    } catch (error) {
        console.error("Error processing fact data:", error);
    }
}


/**
 * Extract unique values from fact data for filtering
 * @param {Array} rawFactBOMData - The fact data array
 * @returns {Object} - Object with unique values by field
 */
function extractUniqueFactValues(rawFactBOMData) {
    console.log("Extracting unique values from fact data for filters...");
    
    if (!rawFactBOMData || rawFactBOMData.length === 0) {
        return {};
    }
    
    const uniqueValues = {
        ITEM_COST_TYPE: new Set(),
        COMPONENT_MATERIAL_TYPE: new Set(),
        ZYEAR: new Set(),
        MC: new Set()
    };
    
    // Extract unique values
    rawFactBOMData.forEach(row => {
        if (row.ITEM_COST_TYPE) uniqueValues.ITEM_COST_TYPE.add(row.ITEM_COST_TYPE);
        if (row.COMPONENT_MATERIAL_TYPE) uniqueValues.COMPONENT_MATERIAL_TYPE.add(row.COMPONENT_MATERIAL_TYPE);
        if (row.ZYEAR) uniqueValues.ZYEAR.add(row.ZYEAR);
        if (row.MC) uniqueValues.MC.add(row.MC);
    });
    
    // Convert sets to sorted arrays
    const result = {};
    Object.keys(uniqueValues).forEach(key => {
        result[key] = Array.from(uniqueValues[key]).sort();
    });
    
    console.log("Unique value extraction complete");
    Object.keys(result).forEach(key => {
        console.log(`Field ${key}: ${result[key].length} unique values`);
    });
    
    return result;
}


// Export the module
export default {
    // Data connection functions
    setupDatabaseConnection,
    reconnectToDatabase,
    loadDataFromDatabase,
    
    // Data retrieval functions
    ingestData,
    fetchDimensionNames,
    fetchDatabaseData,
    fetchDimensionNamesForFact,
    fetchFactTableNames,
    
    // Data processing functions
    processDimensionFiles,
    processrawFactBOMData,
    processDimensionHierarchies,
    preFilterData,

    // Others
    filterDataByMultipleDimensions,
    enhancedFilterByMultipleDimensions,
    preservingFilterByDimension,
    preservingFilterByMultipleDimensions,
    processMultiDimensionRows,
    processMultipleRowDimensions,
    getItemCostTypeDesc, 
    getMaterialTypeDesc,
    getDimensionDescription,
        
    // Mapping functions
    initializeMappings,
    precomputeDescendantFactIds,
    verifyFactDimensionMappings,
    
    // Filter helpers
    getFactIdField,
    getAllLeafDescendants,
    applyDimensionFilters,
    applyDirectFilters,
    processNonHierarchicalDimension,
    
    // UI helper functions
    updateConnectionStatus,
    updateTableStatuses,

    // Hierarchy functions
    buildGenericHierarchy,
    buildGenericPathHierarchy,
    processDimensionHierarchies,
    buildLegalEntityHierarchy,
    buildSmartCodeHierarchy,
    buildCostElementHierarchy,
    buildGmidDisplayHierarchy,
    flattenHierarchy,
    getNodeById,
    enhancedToggleNodeExpansion,
    setAllNodesCollapsed,
    getVisibleLeafNodes,
    regenerateColumnHierarchies,
    filterRecordsByLeHierarchy,
    diagnoseDimGmidData,
    processHierarchicalFields,

    // Calculation functions
    buildLegalEntityMapping,
    buildCostElementMapping,
    buildSmartCodeMapping,
    buildGmidDisplayMapping,
    buildItemCostTypeMapping,
    buildMaterialTypeMapping,

    // Others
    ensureHierarchicalMarkings,
    initializeHierarchyExpansion,

    
    // Make window.generatePivotTable available
    generatePivotTable: window.generatePivotTable
};