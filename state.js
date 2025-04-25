// This module defines the application state structure and provides helper functions for initializing and managing state.

// Define raw dimension variables that will be globally accessible
export const DIM_LE = 'DIM_LE';
export const DIM_GMID_DISPLAY = 'DIM_GMID_DISPLAY';
export const DIM_SMARTCODE = 'DIM_SMARTCODE';
export const DIM_ITEM_COST_TYPE = 'DIM_ITEM_COST_TYPE';
export const DIM_MATERIAL_TYPE = 'DIM_MATERIAL_TYPE';
export const DIM_COST_ELEMENT = 'DIM_COST_ELEMENT';
export const DIM_YEAR = 'DIM_YEAR';
export const DIM_MC = 'DIM_MC';
export const FACT_BOM = 'FACT_BOM';

// Map dimension names to their table column names for filtering and joins
export const DIMENSION_FIELD_MAPPING = {
    [DIM_LE]: { idField: 'LE', descField: 'LE_DESC', foreignKey: 'LE' },
    [DIM_GMID_DISPLAY]: { idField: 'COMPONENT_GMID', descField: 'DISPLAY', foreignKey: 'COMPONENT_GMID' },
    [DIM_SMARTCODE]: { idField: 'SMARTCODE', descField: 'SMARTCODE_DESC', foreignKey: 'ROOT_SMARTCODE' },
    [DIM_ITEM_COST_TYPE]: { idField: 'ITEM_COST_TYPE', descField: 'ITEM_COST_TYPE_DESC', foreignKey: 'ITEM_COST_TYPE' },
    [DIM_MATERIAL_TYPE]: { idField: 'MATERIAL_TYPE', descField: 'MATERIAL_TYPE_DESC', foreignKey: 'COMPONENT_MATERIAL_TYPE' },
    [DIM_COST_ELEMENT]: { idField: 'COST_ELEMENT', descField: 'COST_ELEMENT_DESC', foreignKey: 'COST_ELEMENT' },
    [DIM_YEAR]: { idField: 'ZYEAR', descField: 'ZYEAR_DESC', foreignKey: 'ZYEAR' },
    [DIM_MC]: { idField: 'MC', descField: 'MC_DESC', foreignKey: 'MC' }
};

// Define which dimensions are hierarchical
export const HIERARCHICAL_DIMENSIONS = [DIM_LE, DIM_GMID_DISPLAY, DIM_SMARTCODE, DIM_COST_ELEMENT];

/**
 * Main application state object
 * Contains all data and UI state for the application
 */
const state = {
    // Core data
    rawFactBOMData: [],                // Array to store the main fact table BOM data
    filteredData: [],            // Array to store filtered fact BOM data
    dimensions: {},              // Object to store dimension data by dimension name
    hierarchies: {},             // Object to store hierarchy definitions
    
    // Filter state
    filters: {                    // Filter state object
        legalEntity: [],
        smartCode: [],
        costElement: [],
        businessYear: [],
        itemCostType: [],
        componentMaterialType: [],
        gmidDisplay: []
    },

    // Database connection state
    database: {
        connected: false,
        lastRefreshed: null,
        connectionDetails: null,
        availableTables: []
    },
    
    // UI expansion state for hierarchical dimensions
    expandedNodes: {
        le: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        cost_element: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        gmid_display: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        smartcode: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        }
    },
    
    // Data and field configuration
    availableFields: [],          // List of all available fields for analysis
    availableFiles: [],
    rowFields: [],                // Fields selected for row dimension
    columnFields: [],             // Fields selected for column dimension
    valueFields: [],              // Fields selected for metrics/measures
    filterFields: [],             // Fields used for filtering
    pivotData: null,              // Processed pivot table data
    loading: true,                // Loading state flag
    
    // Store unique values for fields
    uniqueValues: {},             // Store unique values for fields like ZYEAR, ITEM_COST_TYPE, etc.
    
    // Mappings between dimensions for lookup
    mappings: {},                 // Store mappings between dimensions and fact data
    
    // Available database tables
    availableTables: [],          // List of tables available in the database
    
    // Active filters for data
    activeFilters: {},            // Store active filters
    filterTreeState: {},          // Store tree expansion state for filter hierarchies
    directFilters: {}             // Store direct field filters
};


/**
 * Get a dimension data by its name
 * @param {string} dimensionName - The dimension name (e.g., DIM_LE)
 * @returns {Array|null} - The dimension data or null if not found
 */
export function getDimensionData(dimensionName) {
    return state.dimensions[dimensionName.toLowerCase().replace('dim_', '')] || null;
}


/**
 * Get the dimension field mapping for a dimension
 * @param {string} dimensionName - The dimension name
 * @returns {Object|null} - The field mapping or null if not found
 */
export function getDimensionMapping(dimensionName) {
    return DIMENSION_FIELD_MAPPING[dimensionName] || null;
}


/**
 * Check if a dimension is hierarchical
 * @param {string} dimensionName - The dimension name
 * @returns {boolean} - True if the dimension is hierarchical
 */
export function isHierarchicalDimension(dimensionName) {
    return HIERARCHICAL_DIMENSIONS.includes(dimensionName);
}


/**
 * Updates the database connection state
 * @param {Object} connectionInfo - Connection information
 */
function updateDatabaseConnection(connectionInfo) {
    state.database.connected = true;
    state.database.lastRefreshed = new Date();
    state.database.connectionDetails = connectionInfo;
    
    console.log(`Database connection updated: ${new Date().toLocaleString()}`);
}



/**
 * Initializes the expanded nodes for all hierarchies
 * Sets the default expansion state to only show root nodes
 */
function initializeExpandedNodes() {
    state.expandedNodes = {
        le: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        cost_element: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        gmid_display: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        smartcode: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        }
    };

    // Also ensure the hierarchy roots have their expanded property set to true
    if (state.hierarchies) {
        Object.keys(state.hierarchies).forEach(hierarchyName => {
            const hierarchy = state.hierarchies[hierarchyName];
            if (hierarchy && hierarchy.root) {
                hierarchy.root.expanded = true;
                
                // Additionally expand first level children for cost_element hierarchy
                if (hierarchyName === 'cost_element' && hierarchy.root.children) {
                    hierarchy.root.children.forEach(child => {
                        const childId = typeof child === 'string' ? child : child.id;
                        if (childId && hierarchy.nodesMap[childId]) {
                            // Set the child node's expanded property to true
                            hierarchy.nodesMap[childId].expanded = false;
                            
                            // Update the expandedNodes state tracking
                            state.expandedNodes.cost_element.row[childId] = true;
                            state.expandedNodes.cost_element.column[childId] = true;
                        }
                    });
                }
            }
        });
    }
    
    console.log("Initialized hierarchy expansion states:", state.expandedNodes);
}


/**
 * Save essential state information to localStorage with compression and quota management
 * Implements multiple strategies to fit data within storage limits
 */
function saveStateToCache() {
    try {
        // Create a minimal cache object with only essential metadata
        const cacheMetadata = {
            // Store field selections and configurations only
            fieldConfig: {
                rowFields: state.rowFields || [],
                columnFields: state.columnFields || [],
                valueFields: state.valueFields || [],
                filterFields: state.filterFields || []
            },
            
            // Timestamp for cache validation
            timestamp: Date.now(),
            version: '1.0'
        };
        
        // Store directly without compression first as a fallback
        try {
            localStorage.setItem('pivotTableMinimal', JSON.stringify(cacheMetadata));
            console.log("Minimal state cached successfully");
        } catch (error) {
            console.warn("Failed to store even minimal state:", error);
        }
        
        // Try to store field configurations separately
        try {
            if (state.availableFields) {
                localStorage.setItem('pivotTableFields', JSON.stringify({
                    availableFields: state.availableFields,
                    timestamp: Date.now()
                }));
                console.log("Field configurations cached successfully");
            }
        } catch (fieldsError) {
            console.warn("Failed to store field configurations:", fieldsError);
        }
    } catch (error) {
        console.error("Error preparing cache:", error);
        // Try to clean up any potentially corrupted cache
        clearCache();
    }
}


/**
 * Restore state from localStorage cache
 * @returns {boolean} Whether state was restored from cache
 */
function restoreStateFromCache() {
    try {
        // First check for minimal state
        const minimalJson = localStorage.getItem('pivotTableMinimal');
        if (!minimalJson) {
            console.log("No cached metadata found");
            return false;
        }

        const metadata = JSON.parse(minimalJson);
        
        // Check metadata timestamp (max age: 24 hours)
        const cacheAge = Date.now() - (metadata.timestamp || 0);
        const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge > MAX_CACHE_AGE) {
            console.log("Cache is too old, not using");
            clearCache();
            return false;
        }
        
        // Restore field selections if available
        if (metadata.fieldConfig) {
            state.rowFields = metadata.fieldConfig.rowFields || [];
            state.columnFields = metadata.fieldConfig.columnFields || [];
            state.valueFields = metadata.fieldConfig.valueFields || [];
            state.filterFields = metadata.fieldConfig.filterFields || [];
            console.log("Restored field selections from cache");
        }
        
        // Try to restore available fields
        try {
            const fieldsJson = localStorage.getItem('pivotTableFields');
            if (fieldsJson) {
                const fieldsData = JSON.parse(fieldsJson);
                if (fieldsData && fieldsData.availableFields) {
                    state.availableFields = fieldsData.availableFields;
                    console.log("Restored available fields from cache");
                }
            }
        } catch (fieldsError) {
            console.warn("Could not restore field configurations:", fieldsError);
        }
        
        return true;
    } catch (error) {
        console.error("Error restoring cache:", error);
        return false;
    }
}


/**
 * Clear all cached data
 */
function clearCache() {
    try {
        // Clear all versions of cache data
        localStorage.removeItem('pivotTableMetadata');
        localStorage.removeItem('pivotTableFields');
        localStorage.removeItem('pivotTableMinimal');
        console.log("Cache cleared completely");
    } catch (error) {
        console.error("Error clearing cache:", error);
    }
}


/**
 * Updates table row counts for display
 */
function updateTableRowCounts() {
    const counts = {};
    
    // Count dimensions
    Object.entries(state.dimensions).forEach(([dimName, data]) => {
        counts[`dim_${dimName}`] = data ? data.length : 0;
    });
    
    // Count fact data
    counts['fact_bom'] = state.rawFactBOMData ? state.rawFactBOMData.length : 0;
    
    // Update UI elements with counts
    Object.entries(counts).forEach(([table, count]) => {
        const element = document.getElementById(`${table}Rows`);
        if (element) {
            element.textContent = `${count.toLocaleString()} rows`;
        }
        
        // Also update status indicator
        const statusElement = document.getElementById(`${table}Status`);
        if (statusElement) {
            statusElement.className = 'table-status loaded';
            statusElement.textContent = 'Loaded';
        }
    });
    
    console.log("Updated table row counts:", counts);
}


/**
 * Set up detection for state changes that require UI updates
 */
function setupStateChangeDetection() {
    // This is a simple polling mechanism to detect state changes
    // In a more sophisticated app, you might use a Proxy or custom setter methods
    
    let lastrawFactBOMDataLength = 0;
    let lastDimensionsCount = 0;
    
    // Check state every second
    setInterval(() => {
        const currentrawFactBOMDataLength = state.rawFactBOMData ? state.rawFactBOMData.length : 0;
        const currentDimensionsCount = state.dimensions ? Object.keys(state.dimensions).length : 0;
        
        // If data has changed, update counts
        if (currentrawFactBOMDataLength !== lastrawFactBOMDataLength || 
            currentDimensionsCount !== lastDimensionsCount) {
            
            updateTableRowCounts();
            
            // Update last values
            lastrawFactBOMDataLength = currentrawFactBOMDataLength;
            lastDimensionsCount = currentDimensionsCount;
        }
    }, 1000);
}


/**
 * Debugging utility to validate hierarchy structures and help diagnose issues
 * 
 * @param {string} hierarchyName - Name of the hierarchy (e.g., 'gmid_display')
 * @param {object} state - Application state object containing hierarchies
 */
function debugHierarchy(hierarchyName) {
    console.log(`======== DEBUGGING ${hierarchyName.toUpperCase()} HIERARCHY ========`);
    
    // 1. Check if hierarchy exists in state
    if (!state.hierarchies || !state.hierarchies[hierarchyName]) {
        console.error(`Hierarchy '${hierarchyName}' does not exist in state.hierarchies`);
        return;
    }
    
    const hierarchy = state.hierarchies[hierarchyName];
    
    // 2. Validate root node
    if (!hierarchy.root) {
        console.error(`Hierarchy '${hierarchyName}' has no root node`);
        return;
    }
    
    console.log(`Root node found: id=${hierarchy.root.id}, label=${hierarchy.root.label}, expanded=${hierarchy.root.expanded}`);
    
    // 3. Check nodesMap
    if (!hierarchy.nodesMap) {
        console.error(`Hierarchy '${hierarchyName}' has no nodesMap`);
        return;
    }
    
    const nodeCount = Object.keys(hierarchy.nodesMap).length;
    console.log(`Nodes map contains ${nodeCount} nodes`);
    
    // 4. Validate expansion states
    console.log("Checking expansion states...");
    
    if (!state.expandedNodes || !state.expandedNodes[hierarchyName]) {
        console.error(`No expansion state found for '${hierarchyName}'`);
    } else {
        const rowExpansions = state.expandedNodes[hierarchyName].row || {};
        const columnExpansions = state.expandedNodes[hierarchyName].column || {};
        
        console.log(`Row zone expansions found: ${Object.keys(rowExpansions).length}`);
        console.log(`Column zone expansions found: ${Object.keys(columnExpansions).length}`);
        
        // Check ROOT expansion state
        console.log(`ROOT expansion state: row=${rowExpansions['ROOT']}, column=${columnExpansions['ROOT']}`);
    }
    
    // 5. Check children connectivity
    console.log("Checking hierarchy connectivity...");
    
    const rootChildren = hierarchy.root.children || [];
    console.log(`Root has ${rootChildren.length} direct children`);
    
    // Sample first few children
    if (rootChildren.length > 0) {
        const sampleSize = Math.min(3, rootChildren.length);
        console.log(`Sampling ${sampleSize} first-level children:`);
        
        for (let i = 0; i < sampleSize; i++) {
            const child = rootChildren[i];
            if (!child) {
                console.error(`Child at index ${i} is undefined`);
                continue;
            }
            
            const childNode = hierarchy.nodesMap[child.id || child];
            if (!childNode) {
                console.error(`Child node ${child.id || child} not found in nodesMap`);
                continue;
            }
            
            console.log(`  Child ${i+1}: id=${childNode.id}, label=${childNode.label}, level=${childNode.level}, isLeaf=${childNode.isLeaf}, expanded=${childNode.expanded}`);
            
            // Check grandchildren
            if (childNode.children && childNode.children.length > 0) {
                console.log(`    Has ${childNode.children.length} children`);
            }
        }
    }
    
    console.log("======== HIERARCHY DEBUG COMPLETE ========");
}


/**
 * Add debugging commands to the window object for inspecting hierarchies
 */
function exposeDebugCommands() {
    window.debugHierarchies = function() {
        console.log("===== DEBUGGING ALL HIERARCHIES =====");
        const hierarchyNames = Object.keys(state.hierarchies || {});
        console.log(`Found ${hierarchyNames.length} hierarchies: ${hierarchyNames.join(', ')}`);
        
        hierarchyNames.forEach(name => {
            debugHierarchy(name);
        });
    };
    
    window.debugGmidHierarchy = function() {
        debugHierarchy('gmid_display');
    };
    
    window.getDimension = function(dimName) {
        return getDimensionData(dimName);
    };
    
    window.getrawFactBOMData = function() {
        return state.rawFactBOMData;
    };
    
    console.log("Debug commands available: window.debugHierarchies(), window.debugGmidHierarchy(), window.getDimension(dimName), window.getrawFactBOMData()");
}


/**
 * Update the list of available tables from the database
 * @param {Array} tables - Array of table names available in the database
 */
function updateAvailableTables(tables) {
    if (Array.isArray(tables)) {
        state.availableTables = tables;
        console.log(`Updated available tables: ${tables.length} tables found`);
    }
}


/**
 * Updates the database connection status in the UI
 * @param {boolean} connected - Whether connected to database
 * @param {string} message - Status message
 */
function updateConnectionStatus(connected, message) {
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        connectionStatus.innerHTML = connected ? 
            `<i class="fas fa-check-circle"></i> ${message || 'Connected to Snowflake database'}` :
            `<i class="fas fa-times-circle"></i> ${message || 'Not connected to database'}`;
        
        connectionStatus.className = `connection-status ${connected ? 'success' : 'error'}`;
    }
    
    // Update state
    state.database.connected = connected;
}


/**
 * Updates the table status in the UI
 * @param {string} tableName - The table name
 * @param {string} status - Status (loading, loaded, error)
 * @param {string} message - Optional status message
 */
function updateTableStatus(tableName, status, message) {
    const normalizedName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const statusElement = document.getElementById(`${normalizedName}Status`);
    
    if (statusElement) {
        statusElement.className = `table-status ${status}`;
        statusElement.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
    }
}


// Export the state object and helper functions
export default {
    state,
    initializeExpandedNodes,
    saveStateToCache,
    restoreStateFromCache,
    clearCache,
    updateDatabaseConnection,
    updateTableRowCounts,
    exposeDebugCommands,
    getDimensionData,
    getDimensionMapping,
    isHierarchicalDimension,
    debugHierarchy,
    setupStateChangeDetection,
    updateAvailableTables,
    updateConnectionStatus,
    updateTableStatus
};