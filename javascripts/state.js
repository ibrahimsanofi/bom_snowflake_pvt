
// This module defines the application state structure and provides helper functions for initializing and managing state.


/**
 * Main application state object
 * Contains all data and UI state for the application
 */
const state = {
    // Core data
    factData: [],                 // Array to store the main fact table data
    filteredData: [],             // Array to store filtered fact data
    dimensions: {},               // Object to store dimension metadata
    hierarchies: {},              // Object to store hierarchy definitions
    selectedRootGmids: [],          // Array to store selected ROOT_GMID values
    rootGmids: [],                  // Array to store all available ROOT_GMID values
    filteredFactData: null,
    decimalPlaces: 2,          // Number of decimal places for numeric values
    
    // Filter state
    filters: {                    // Filter state object
        legalEntity: [],
        smartcode: [],
        costElement: [],
        businessYear: [],
        itemCostType: [],
        componentMaterialType: [],
        mc: [],
        itemCostType: [],
        materialType: []
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
        },
        mc: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        year: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        item_cost_type: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        material_type: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        }
    },
    
    // Data and field configuration
    availableFiles: [],           // List of available data files
    availableFields: [],          // List of all available fields for analysis
    rowFields: [],                // Fields selected for row dimension
    columnFields: [],             // Fields selected for column dimension
    valueFields: [],              // Fields selected for metrics/measures
    filterFields: [],             // Fields used for filtering
    pivotData: null,              // Processed pivot table data
    loading: true,                // Loading state flag
    
    directory: null,              // Current working directory
    
    // Filter state
    filterTreeState: {},          // UI state for filter selection trees
    activeFilters: {},            // Currently applied filters
    
    // Store unique values for fields
    uniqueValues: {}              // Store unique values for fields like ZYEAR, ITEM_COST_TYPE, etc.
};


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
        },
        mc: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        year: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        item_cost_type: {
            row: { 'ROOT': true },
            column: { 'ROOT': true }
        },
        material_type: {
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
            }   
        });
    }
    
    console.log("✅ Status: Initialized hierarchy expansion states:", state.expandedNodes);
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
            
            // Store filter state - but simplified
            filters: {}, // Simplified to prevent large objects
            
            // Timestamp for cache validation
            timestamp: Date.now(),
            version: '1.0'
        };
        
        // Store directly without compression first as a fallback
        try {
            localStorage.setItem('pivotTableMinimal', JSON.stringify(cacheMetadata));
            console.log("✅ Status: Minimal state cached successfully");
        } catch (error) {
            console.warn("⚠️ Warning: Failed to store even minimal state:", error);
        }
        
        // Try to store field configurations separately
        try {
            if (state.availableFields) {
                localStorage.setItem('pivotTableFields', JSON.stringify({
                    availableFields: state.availableFields,
                    timestamp: Date.now()
                }));
                console.log("✅ Status: Field configurations cached successfully");
            }
        } catch (fieldsError) {
            console.warn("⚠️ Warning: Failed to store field configurations:", fieldsError);
        }
    } catch (error) {
        console.error("❌ Alert! Error preparing cache:", error);
        // Try to clean up any potentially corrupted cache
        clearCache();
    }
}


/**
 * Restore state from localStorage cache with support for compressed data
 * @returns {boolean} Whether state was restored from cache
 */
function restoreStateFromCache() {
    try {
        // First check for compressed metadata
        let metadata = null;
        try {
            const compressedMetadata = localStorage.getItem('pivotTableMetadata_compressed');
            if (compressedMetadata) {
                const decompressedData = decompressData(compressedMetadata);
                metadata = JSON.parse(decompressedData);
                console.log("✅ Status: Restored compressed metadata");
            }
        } catch (compressionError) {
            console.warn("⚠️ Warning: Error decompressing metadata, trying uncompressed:", compressionError);
        }
        
        // Fallback to uncompressed
        if (!metadata) {
            const metadataJson = localStorage.getItem('pivotTableMetadata');
            if (metadataJson) {
                metadata = JSON.parse(metadataJson);
                console.log("✅ Status: Restored uncompressed metadata");
            }
        }
        
        // Fallback to minimal
        if (!metadata) {
            const minimalJson = localStorage.getItem('pivotTableMinimal');
            if (minimalJson) {
                metadata = JSON.parse(minimalJson);
                console.log("✅ Status: Restored minimal metadata");
            }
        }
        
        // If no metadata found at all
        if (!metadata) {
            console.log("✅ Status: No cached metadata found");
            return false;
        }
        
        // Check metadata timestamp (max age: 24 hours)
        const cacheAge = Date.now() - (metadata.timestamp || 0);
        const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge > MAX_CACHE_AGE) {
            console.log("✅ Status: Cache is too old, not using");
            clearCache();
            return false;
        }
        
        // Restore filter state if available
        if (metadata.filters) {
            state.filters = metadata.filters;
            console.log("✅ Status: Restored filter state from cache");
        }
        
        // Restore expansion states if available
        if (metadata.expandedNodes) {
            state.expandedNodes = metadata.expandedNodes;
            console.log("✅ Status: Restored expansion states from cache");
        }
        
        // Restore field selections if available
        if (metadata.fieldConfig) {
            state.rowFields = metadata.fieldConfig.rowFields || [];
            state.columnFields = metadata.fieldConfig.columnFields || [];
            state.valueFields = metadata.fieldConfig.valueFields || [];
            state.filterFields = metadata.fieldConfig.filterFields || [];
            console.log("✅ Status: Restored field selections from cache");
        }
        
        // Try to restore available fields
        try {
            // First try compressed
            let fieldsData = null;
            try {
                const compressedFields = localStorage.getItem('pivotTableFields_compressed');
                if (compressedFields) {
                    const decompressedFields = decompressData(compressedFields);
                    fieldsData = JSON.parse(decompressedFields);
                    console.log("✅ Status: Restored compressed fields");
                }
            } catch (compressedFieldsError) {
                console.warn("⚠️ Warning: Error decompressing fields:", compressedFieldsError);
            }
            
            // Fallback to uncompressed
            if (!fieldsData) {
                const fieldsJson = localStorage.getItem('pivotTableFields');
                if (fieldsJson) {
                    fieldsData = JSON.parse(fieldsJson);
                    console.log("✅ Status: Restored uncompressed fields");
                }
            }
            
            if (fieldsData && fieldsData.availableFields) {
                state.availableFields = fieldsData.availableFields;
                console.log("✅ Status: Restored available fields from cache");
            }
        } catch (fieldsError) {
            console.warn("⚠️ Warning: Could not restore field configurations:", fieldsError);
        }
        
        return true;
    } catch (error) {
        console.error("❌ Alert! Error restoring cache:", error);
        return false;
    }
}


/**
 * Clear all cached data including compressed versions
 */
function clearCache() {
    try {
        // Clear all versions of cache data
        localStorage.removeItem('pivotTableMetadata');
        localStorage.removeItem('pivotTableMetadata_compressed');
        localStorage.removeItem('pivotTableFields');
        localStorage.removeItem('pivotTableFields_compressed');
        localStorage.removeItem('pivotTableMinimal');
        console.log("✅ Status: Cache cleared completely");
    } catch (error) {
        console.error("❌ Alert! Error clearing cache:", error);
    }
}


/**
 * Improved LZW compression algorithm with safeguards against large inputs
 * @param {string} input - String to compress
 * @returns {string} - Compressed string (Base64 encoded)
 */
function compressData(input) {
    if (!input) return "";
    
    // Add size limit to prevent stack overflow
    if (input.length > 1000000) {
        console.warn("⚠️ Warning: Input too large for compression, truncating to prevent overflow");
        input = input.substring(0, 1000000);
    }
    
    try {
        // Dictionary size must be greater than 255
        const dict = {};
        const data = (input + "").split("");
        const out = [];
        let currChar;
        let phrase = data[0];
        let code = 256;
        
        for (let i = 1; i < data.length; i++) {
            currChar = data[i];
            if (dict[phrase + currChar] !== undefined) {
                phrase += currChar;
            } else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase = currChar;
            }
        }
        
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        
        // Convert to a string representation using a safer approach
        let compressedStr = "";
        const chunkSize = 8192; // Process in chunks to avoid call stack issues
        
        for (let i = 0; i < out.length; i += chunkSize) {
            const chunk = out.slice(i, i + chunkSize);
            compressedStr += String.fromCharCode.apply(null, chunk);
        }
        
        // Base64 encode for safer storage
        return btoa(compressedStr);
    } catch (e) {
        console.error("❌ Alert! Compression failed:", e);
        return ""; // Return empty string on failure
    }
}



/**
 * LZW decompression of compressed string
 * @param {string} compressed - Compressed string (Base64 encoded)
 * @returns {string} - Original decompressed string
 */
function decompressData(compressed) {
    if (!compressed) return "";
    
    // Base64 decode
    let input = atob(compressed);
    
    // Convert string back to character codes
    const compressedCodes = [];
    for (let i = 0; i < input.length; i++) {
        compressedCodes.push(input.charCodeAt(i));
    }
    
    // Decompress
    const dict = {};
    const data = compressedCodes;
    let currChar = String.fromCharCode(data[0]);
    let oldPhrase = currChar;
    const out = [currChar];
    let code = 256;
    let phrase;
    
    for (let i = 1; i < data.length; i++) {
        const currCode = data[i];
        if (currCode < 256) {
            phrase = String.fromCharCode(currCode);
        } else {
            phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
        }
        
        out.push(phrase);
        currChar = phrase.charAt(0);
        dict[code] = oldPhrase + currChar;
        code++;
        oldPhrase = phrase;
    }
    
    return out.join("");
}


// For browsers that don't support btoa/atob natively (should be rare)
if (typeof btoa === 'undefined') {
    window.btoa = function(str) {
        return Buffer.from(str, 'binary').toString('base64');
    };
}


if (typeof atob === 'undefined') {
    window.atob = function(b64Encoded) {
        return Buffer.from(b64Encoded, 'base64').toString('binary');
    };
}


/**
 * Determine if we should use cached data
 * @param {Object} files - The loaded files
 * @returns {Promise<boolean>} - Whether to use cached data
 */
async function shouldUseCache(files) {
    // Get the last modified times of all files
    const fileTimePromises = Object.values(files || {}).map(async file => {
        if (!file) return 0;
        return file.lastModified;
    });
    
    try {
        const fileTimes = await Promise.all(fileTimePromises);
        
        // Get the latest file modification time
        const latestFileTime = Math.max(...fileTimes.filter(t => t));
        
        // Get the cache timestamp
        let cacheTimestamp = 0;
        try {
            const metadataJson = localStorage.getItem('pivotTableMetadata');
            if (metadataJson) {
                const metadata = JSON.parse(metadataJson);
                cacheTimestamp = metadata.timestamp || 0;
            }
        } catch (error) {
            console.warn("⚠️ Warning: Error checking cache timestamp:", error);
            return false;
        }
        
        // Use cache if it's newer than the latest file modification
        // Also check for a minimum timestamp to avoid using cache from testing
        const minimumTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        const isCacheNewer = cacheTimestamp > latestFileTime;
        const isCacheRecent = cacheTimestamp > minimumTimestamp;
        
        console.log("✅ Status: Cache evaluation:", {
            latestFileTime,
            cacheTimestamp,
            isCacheNewer,
            isCacheRecent,
            useCache: isCacheNewer && isCacheRecent
        });
        
        return isCacheNewer && isCacheRecent;
    } catch (error) {
        console.error("❌ Alert! Error determining cache usage:", error);
        return false;
    }
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
            debugHierarchy(name, state);
        });
    };
    
    window.debugGmidHierarchy = function() {
        debugHierarchy('gmid_display', state);
    };
    
    window.debugFilters = function() {
        console.log("===== CURRENT FILTER STATE =====");
        console.log(state.filters);
        
        // Count total selected filters
        let totalCount = 0;
        Object.entries(state.filters).forEach(([key, values]) => {
            // console.log(`${key}: ${values.length} selected`);
            totalCount += values.length;
        });
        
        console.log(`Total filters: ${totalCount}`);
    };
    
    console.log("Debug commands available: window.debugHierarchies(), window.debugGmidHierarchy(), window.debugFilters()");
}


/**
 * Debugging utility to validate hierarchy structures and help diagnose issues
 * 
 * @param {string} hierarchyName - Name of the hierarchy (e.g., 'gmid_display')
 * @param {object} state - Application state object containing hierarchies
 */
function debugHierarchy(hierarchyName, state) {
    console.log(`======== DEBUGGING ${hierarchyName.toUpperCase()} HIERARCHY ========`);
    
    // 1. Check if hierarchy exists in state
    if (!state.hierarchies || !state.hierarchies[hierarchyName]) {
        console.error(`❌ Alert! Hierarchy '${hierarchyName}' does not exist in state.hierarchies`);
        return;
    }
    
    const hierarchy = state.hierarchies[hierarchyName];
    
    // 2. Validate root node
    if (!hierarchy.root) {
        console.error(`❌ Alert! Hierarchy '${hierarchyName}' has no root node`);
        return;
    }
    
    // console.log(`Root node found: id=${hierarchy.root.id}, label=${hierarchy.root.label}, expanded=${hierarchy.root.expanded}`);
    
    // 3. Check nodesMap
    if (!hierarchy.nodesMap) {
        console.error(`❌ Alert! Hierarchy '${hierarchyName}' has no nodesMap`);
        return;
    }
    
    const nodeCount = Object.keys(hierarchy.nodesMap).length;
    // console.log(`Nodes map contains ${nodeCount} nodes`);
    
    // 4. Validate expansion states
    console.log("Checking expansion states...");
    
    if (!state.expandedNodes || !state.expandedNodes[hierarchyName]) {
        console.error(`❌ Alert! No expansion state found for '${hierarchyName}'`);
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
                // console.error(`Child at index ${i} is undefined`);
                continue;
            }
            
            const childNode = hierarchy.nodesMap[child.id || child];
            if (!childNode) {
                // console.error(`Child node ${child.id || child} not found in nodesMap`);
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


// Setup detection of state changes for cached data scenarios
function setupStateChangeDetection() {
    // Check every second for state changes
    const checkInterval = setInterval(() => {
        const state = window.stateModule?.state;
        if (state && state.factData && state.dimensions) {
            updateFileRowCounts();
            clearInterval(checkInterval); // Stop checking once we have data
        }
    }, 1000);
    
    // Stop checking after 30 seconds regardless
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 30000);
}


// Export the state object and helper functions
export default {
    state,
    initializeExpandedNodes,
    compressData,
    decompressData,
    saveStateToCache,
    restoreStateFromCache,
    shouldUseCache,
    clearCache, 
    exposeDebugCommands,
    setupStateChangeDetection
};