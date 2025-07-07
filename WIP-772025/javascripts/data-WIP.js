/*
Functions in this module handle various data-centric tasks identified for the project
*/

import stateModule from './state.js';
import ui from './ui.js'
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
    GET_FACT_NAMES: `${API_BASE_URL}/get_fact_names`,
    GET_DIMENSION_FIELDS: `${API_BASE_URL}/dimension-fields/`
};


/**
 * ENHANCED: Configuration for dimension field loading
 * Maps each dimension to the specific fields needed for filtering
 */
const DIMENSION_FIELD_CONFIG = {
    'DIM_LE': {
        fields: ['LE', 'LE_DESC', 'PATH'],
        displayField: 'LE_DESC',
        valueField: 'LE',
        filterField: 'LE'
    },
    'DIM_COST_ELEMENT': {
        fields: ['COST_ELEMENT', 'COST_ELEMENT_DESC', 'PATH'],
        displayField: 'COST_ELEMENT_DESC',
        valueField: 'COST_ELEMENT',
        filterField: 'COST_ELEMENT'
    },
    'DIM_SMARTCODE': {
        fields: ['SMARTCODE', 'SMARTCODE_DESC', 'PATH'],
        displayField: 'SMARTCODE_DESC',
        valueField: 'SMARTCODE',
        filterField: 'ROOT_SMARTCODE'
    },
    'DIM_GMID_DISPLAY': {
        fields: ['PATH_GMID', 'ROOT_GMID', 'DISPLAY'], 
        valueField: 'PATH_GMID', 
        displayField: 'DISPLAY',
        filterField: 'PATH_GMID'
    },
    'DIM_ROOT_GMID_DISPLAY': {
        fields: ['ROOT_GMID', 'ROOT_DISPLAY'],
        displayField: 'ROOT_DISPLAY',
        valueField: 'ROOT_GMID',
        filterField: 'ROOT_GMID'
    },
    'DIM_ITEM_COST_TYPE': {
        fields: ['ITEM_COST_TYPE', 'ITEM_COST_TYPE_DESC'],
        displayField: 'ITEM_COST_TYPE_DESC',
        valueField: 'ITEM_COST_TYPE',
        filterField: 'ITEM_COST_TYPE'
    },
    'DIM_MATERIAL_TYPE': {
        fields: ['MATERIAL_TYPE', 'MATERIAL_TYPE_DESC'],
        displayField: 'MATERIAL_TYPE_DESC',
        valueField: 'MATERIAL_TYPE',
        filterField: 'COMPONENT_MATERIAL_TYPE'
    },
    'DIM_MC': {
        fields: ['MC', 'LE_DESC', 'PATH'],
        displayField: 'LE_DESC',
        valueField: 'MC',
        filterField: 'MC'
    },
    'DIM_YEAR': {
        fields: ['YEAR'],
        displayField: 'YEAR',
        valueField: 'YEAR',
        filterField: 'ZYEAR'
    }
};


/**
 * ENHANCED: Fetch specific fields from a dimension table
 * @param {string} tableName - Name of the dimension table
 * @param {Array} fields - Array of field names to fetch
 * @returns {Promise<{data: Array, error?: any}>} - Object containing data or error
 */
async function fetchDimensionFields(tableName, fields) {
    const url = `${ENDPOINTS.GET_DIMENSION_FIELDS}${tableName}`;
    
    try {
        console.log(`⏳ Status: Fetching optimized fields [${fields.join(', ')}] from ${tableName}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Accept': 'application/x-ndjson',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                fields: fields,
                options: {
                    limit: 10000,
                    distinct: true
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 400 && errorData.availableFields) {
                console.warn(`⚠️ Some fields don't exist in ${tableName}:`, errorData.invalidFields);
                console.log(`📋 Available fields: ${errorData.availableFields.slice(0, 10).join(', ')}...`);
            }
            
            // Try the optimized GET endpoint as fallback
            console.log(`🔄 Trying optimized GET endpoint for ${tableName}...`);
            return await fetchOptimizedData(tableName, fields);
        }

        // Check headers for field validation results
        const selectedFields = response.headers.get('X-Selected-Fields');
        const invalidFields = response.headers.get('X-Invalid-Fields');
        
        if (invalidFields) {
            console.warn(`⚠️ Invalid fields ignored: ${invalidFields}`);
        }
        if (selectedFields) {
            console.log(`✅ Using validated fields: ${selectedFields}`);
        }

        // Process the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];

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
                            console.warn(`Invalid JSON line in ${tableName}:`, e);
                        }
                    }
                });
            }
        } catch (err) {
            console.error(`❌ Network error while fetching ${tableName}:`, err);
            return await fetchOptimizedData(tableName, fields);
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn(`Invalid final JSON in ${tableName}:`, e);
            }
        }

        console.log(`✅ Optimized fetch: ${rows.length} rows from ${tableName} (${fields.length} columns)`);
        return { data: rows };
        
    } catch (err) {
        console.error(`❌ Error in optimized fetch for ${tableName}:`, err.message);
        console.log(`🔄 Falling back to standard approach...`);
        return await fetchOptimizedData(tableName, fields);
    }
}


/**
 * Optimized data fetching using GET endpoint with query parameters
 */
async function fetchOptimizedData(tableName, fields = null) {
    let url = `${API_BASE_URL}/data/${tableName}`;
    
    if (fields && fields.length > 0) {
        const fieldsParam = fields.join(',');
        url += `?fields=${encodeURIComponent(fieldsParam)}&limit=10000&distinct=true`;
    } else {
        url += '?limit=10000';
    }
    
    try {
        console.log(`⏳ Status: Fetching optimized data from ${tableName}...`);
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];

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
                        console.warn(`Invalid JSON line in ${tableName}:`, e);
                    }
                }
            });
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn(`Invalid final JSON in ${tableName}:`, e);
            }
        }

        console.log(`✅ Optimized GET: ${rows.length} rows from ${tableName}`);
        return { data: rows };
        
    } catch (err) {
        console.error(`❌ Error in optimized GET for ${tableName}:`, err.message);
        // Final fallback to original approach
        return await fetchDatabaseData(tableName);
    }
}


/**
 * Batch field validation before data loading
 */
async function validateAllDimensionFields() {
    const validationRequest = {};
    
    // Build validation request for all dimensions
    Object.entries(DIMENSION_FIELD_CONFIG).forEach(([dimTable, config]) => {
        validationRequest[dimTable] = config.fields;
    });
    
    try {
        console.log('⏳ Status: Validating all dimension fields...');
        
        const response = await fetch(`${API_BASE_URL}/validate-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tables: validationRequest })
        });
        
        if (!response.ok) {
            throw new Error(`Validation failed: ${response.status}`);
        }
        
        const validation = await response.json();
        console.log('✅ Field validation results:', validation.summary);
        
        // Log any issues
        Object.entries(validation.validation).forEach(([table, result]) => {
            if (result.invalidFields && result.invalidFields.length > 0) {
                console.warn(`⚠️ ${table}: Invalid fields: ${result.invalidFields.join(', ')}`);
                console.log(`📋 ${table}: Available fields: ${result.availableFields?.slice(0, 5).join(', ')}...`);
            }
        });
        
        return validation;
        
    } catch (error) {
        console.error('❌ Field validation error:', error);
        return null;
    }
}


/**
 * Load placeholder GMID_DISPLAY data for initial dimension setup
 * This loads a small sample to initialize the dimension and hierarchy
 * @returns {Promise<Array>} - Small array of GMID_DISPLAY records
 */
async function loadGmidDisplayPlaceholder() {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    try {
        console.log('📦 Loading GMID_DISPLAY placeholder data...');
        
        const url = `${API_BASE_URL}/data/DIM_GMID_DISPLAY/placeholder?limit=10`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        // Parse NDJSON response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];

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
                        console.warn('Invalid JSON line in placeholder:', e);
                    }
                }
            });
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn('Invalid final JSON in placeholder:', e);
            }
        }

        console.log(`✅ Loaded ${rows.length} GMID_DISPLAY placeholder records`);
        
        // Add metadata to identify as placeholder
        rows._isPlaceholder = true;
        rows._loadedAt = Date.now();
        
        return rows;
        
    } catch (error) {
        console.error('❌ Error loading GMID placeholder:', error);
        
        // Return minimal fallback data
        const fallbackData = [
            {
                COMPONENT_GMID: 'PLACEHOLDER_001',
                ROOT_GMID: 'SAMPLE_ROOT',
                PATH_GMID: 'SAMPLE_ROOT',
                DISPLAY: 'Sample GMID (placeholder data)'
            }
        ];
        fallbackData._isPlaceholder = true;
        fallbackData._isFallback = true;
        
        return fallbackData;
    }
}


/**
 * COMBINED FUNCTION: Load dimension data and build hierarchies
 * This replaces the original ingestDimensionFilterData function
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table (default: 'FACT_BOM')
 * @returns {Promise<boolean>} - Success status
 */
async function ingestDimensionFilterData(elements, selectedFact = 'FACT_BOM') {
    console.log('⏳ Status: Starting complete dimension data ingestion and hierarchy building process...');
    
    try {
        // Step 1: Load dimension filter data
        const dataLoadSuccess = await ingestDimensionFilterDataOnly(elements, selectedFact);
        if (!dataLoadSuccess) {
            throw new Error("Failed to load dimension filter data");
        }
        
        // Step 2: Build hierarchies from loaded data
        const hierarchyBuildSuccess = await buildAndPersistDimensionHierarchies(elements);
        if (!hierarchyBuildSuccess) {
            console.warn("Hierarchy building failed, but continuing with loaded data");
            // Don't throw error here - we can still work with flat data
        }
        
        console.log('✅ Status: Complete dimension data ingestion and hierarchy building process finished successfully');
        return true;
        
    } catch (error) {
        console.error('Complete Dimension Processing Error:', error);
        return false;
    }
}


/**
 * PART 1: Ingest dimension filter data from database
 * This function only handles data loading and storage, no hierarchy processing
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table (default: 'FACT_BOM')
 * @returns {Promise<boolean>} - Success status
 */
async function ingestDimensionFilterDataOnly(elements, selectedFact = 'FACT_BOM') {
    console.log('⏳ Status: Loading optimized dimension filter data from Snowflake database server...');
    
    try {
        // Step 1: Validate all fields before starting
        const validation = await validateAllDimensionFields();
        if (validation) {
            console.log(`📊 Field validation: ${validation.summary.tablesValidated}/${validation.summary.totalTables} tables validated`);
        }
        
        // Step 2: Get dimensions related to the selected fact table
        const dimNames = await fetchDimensionNamesForFact(selectedFact);
        console.log(`✅ Status: Found ${dimNames.length} dimensions for ${selectedFact}`);

        // Step 3: Build available files list
        state.availableFiles = [];
        dimNames.forEach(dim => {
            state.availableFiles.push({
                id: `${dim}`,
                label: dim.replace(/^DIM_/, ''),
                type: 'dimension',
                hierarchical: ['LE', 'COST_ELEMENT', 'GMID_DISPLAY', 'SMARTCODE', 'MC', 'YEAR', 'ITEM_COST_TYPE', 'MATERIAL_TYPE', 'ROOT_GMID_DISPLAY'].includes(
                    dim.replace(/^DIM_/, '')
                )
            });
        });
        
        state.availableFiles.push({
            id: selectedFact,
            label: selectedFact.replace(/^FACT_/, ''),
            type: 'fact'
        });

        // Step 4: Load dimension filter data with optimized fetching
        console.log("⏳ Status: Loading optimized dimension filter data...");
        state.dimensionFilters = {};
        
        dimNames.forEach(dim => {
            const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
            state.dimensionFilters[dimKey] = [];
        });
        
        // Fetch dimension filter data in parallel with optimization
        const dimensionPromises = dimNames.map(async dim => {
            try {
                ui.updateTableStatus(dim, 'loading');
                
                const fieldConfig = DIMENSION_FIELD_CONFIG[dim];
                if (!fieldConfig) {
                    console.warn(`No field configuration found for ${dim}, using fallback`);
                    ui.updateTableStatus(dim, 'warning');
                    return false;
                }
                
                // Use optimized field fetching
                const { data, error } = await fetchDimensionFields(dim, fieldConfig.fields);
                
                if (error || !data) {
                    ui.updateTableStatus(dim, 'error');
                    console.error(`Error loading optimized dimension fields: ${dim}`, error);
                    return false;
                }
                
                const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
                state.dimensionFilters[dimKey] = {
                    data: data,
                    config: fieldConfig,
                    tableName: dim
                };
                
                ui.updateTableStatus(dim, 'loaded', data.length);
                console.log(`✅ Status: Optimized load ${dim}: ${data.length} rows with ${fieldConfig.fields.length} columns`);
                
                // Calculate performance improvement
                if (validation && validation.validation[dim]) {
                    const totalCols = validation.validation[dim].availableFields?.length || fieldConfig.fields.length;
                    const selectedCols = fieldConfig.fields.length;
                    const reduction = Math.round((1 - selectedCols/totalCols) * 100);
                    console.log(`📊 ${dim}: ${reduction}% column reduction (${selectedCols}/${totalCols} columns)`);
                }
                
                return true;
            } catch (err) {
                console.error(`Error loading optimized dimension filter data ${dim}:`, err);
                ui.updateTableStatus(dim, 'error');
                return false;
            }
        });
        
        await Promise.all(dimensionPromises);

        // Step 5: Verify and finalize
        const filtersLoaded = Object.keys(state.dimensionFilters).some(key => 
            state.dimensionFilters[key].data && state.dimensionFilters[key].data.length > 0
        );
        
        if (!filtersLoaded) {
            throw new Error("No dimension filter data was properly loaded");
        }

        // Step 6: Generate available fields for UI
        state.availableFields = [];
        
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

        ui.renderAvailableFields(elements);
        ui.setDefaultFields();
        ui.renderFieldContainers(elements, state);

        console.log('✅ Status: Optimized dimension filter data loaded successfully!');
        state.dimensionFiltersLoaded = true;

        return true;
        
    } catch (error) {
        console.error('Optimized Dimension Filter Data Loading Error:', error);
        
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'block';
        }
        
        console.error(`❌ Optimized Loading Error: ${error.message}`, 'error', elements);
        return false;
    }
}


/**
 * Clear server-side cache
 */
async function clearServerCache() {
    try {
        const response = await fetch(`${API_BASE_URL}/clear-cache`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Server cache cleared:', result);
            return true;
        } else {
            console.warn('⚠️ Failed to clear server cache');
            return false;
        }
    } catch (error) {
        console.error('❌ Error clearing server cache:', error);
        return false;
    }
}


/**
 * PART 2: Build and persist hierarchies from loaded dimension data
 * This function processes the loaded dimension data to create hierarchical structures
 * @param {Object} elements - DOM elements object (optional, for status updates)
 * @returns {Promise<boolean>} - Success status
 */
async function buildAndPersistDimensionHierarchies(elements = null) {
    console.log('⏳ Status: Building and persisting dimension hierarchies...');
    
    try {
        // Ensure dimension filter data is loaded
        if (!state.dimensionFiltersLoaded || !state.dimensionFilters) {
            throw new Error("Dimension filter data must be loaded before building hierarchies");
        }

        // Initialize hierarchies storage
        state.hierarchies = state.hierarchies || {};
        state.expandedNodes = state.expandedNodes || {};

        // Track successful hierarchy builds
        const hierarchyResults = {};

        // Build hierarchies for each dimension
        for (const [dimKey, dimensionFilter] of Object.entries(state.dimensionFilters)) {
            if (!dimensionFilter.data || dimensionFilter.data.length === 0) {
                console.warn(`No data available for dimension: ${dimKey}`);
                continue;
            }

            try {
                console.log(`⏳ Status: Building hierarchy for ${dimKey}...`);
                
                let hierarchy = null;
                
                // Build hierarchy based on dimension type
                switch (dimKey) {
                    case 'le':
                        hierarchy = buildLegalEntityHierarchy(dimensionFilter.data);
                        break;
                    case 'cost_element':
                        hierarchy = buildCostElementHierarchy(dimensionFilter.data);
                        break;
                    case 'smartcode':
                        hierarchy = buildSmartCodeHierarchy(dimensionFilter.data);
                        break;
                    case 'mc':
                        hierarchy = buildManagementCentreHierarchy(dimensionFilter.data);
                        break;
                    case 'gmid_display':
                        hierarchy = buildGmidDisplayHierarchy(dimensionFilter.data);
                        break;
                    case 'item_cost_type':
                        hierarchy = buildItemCostTypeHierarchy(dimensionFilter.data);
                        break;
                    case 'material_type':
                        hierarchy = buildMaterialTypeHierarchy(dimensionFilter.data);
                        break;
                    case 'year':
                        hierarchy = buildBusinessYearHierarchy(dimensionFilter.data);
                        break;
                    default:
                        // For unknown dimensions, try to build a flat hierarchy
                        console.warn(`Unknown dimension type: ${dimKey}, building flat hierarchy`);
                        hierarchy = buildStandaloneFlatHierarchy(
                            dimensionFilter.data, 
                            dimKey.toUpperCase(),
                            dimensionFilter.config?.valueField || 'ID',
                            dimensionFilter.config?.displayField || 'LABEL'
                        );
                        break;
                }

                if (hierarchy && hierarchy.root) {
                    // Store the hierarchy
                    state.hierarchies[dimKey] = hierarchy;
                    
                    // Initialize expansion state for both row and column zones
                    state.expandedNodes[dimKey] = state.expandedNodes[dimKey] || {};
                    state.expandedNodes[dimKey].row = state.expandedNodes[dimKey].row || {};
                    state.expandedNodes[dimKey].column = state.expandedNodes[dimKey].column || {};
                    
                    // Set root node to collapsed by default
                    state.expandedNodes[dimKey].row['ROOT'] = false;
                    state.expandedNodes[dimKey].column['ROOT'] = false;
                    
                    // Precompute descendant factIds for efficient filtering
                    const factIdField = getFactIdField(dimKey);
                    if (factIdField) {
                        precomputeDescendantFactIds(hierarchy, factIdField);
                    }
                    
                    hierarchyResults[dimKey] = true;
                    console.log(`✅ Status: Successfully built hierarchy for ${dimKey} with ${Object.keys(hierarchy.nodesMap).length} nodes`);
                    
                    // Update UI status if elements provided
                    if (elements) {
                        const tableName = dimensionFilter.tableName;
                        ui.updateTableStatus(tableName, 'hierarchy_built', Object.keys(hierarchy.nodesMap).length);
                    }
                } else {
                    console.error(`Failed to build hierarchy for ${dimKey}: invalid hierarchy structure`);
                    hierarchyResults[dimKey] = false;
                }
                
            } catch (error) {
                console.error(`Error building hierarchy for ${dimKey}:`, error);
                hierarchyResults[dimKey] = false;
                
                // Create fallback hierarchy to prevent crashes
                state.hierarchies[dimKey] = createFallbackHierarchy(
                    `${dimKey.toUpperCase()} (Fallback)`, 
                    'ROOT'
                );
            }
        }

        // Validate that we have at least some hierarchies
        const successfulHierarchies = Object.values(hierarchyResults).filter(success => success).length;
        const totalDimensions = Object.keys(state.dimensionFilters).length;
        
        if (successfulHierarchies === 0) {
            throw new Error("Failed to build any hierarchies from dimension data");
        }

        console.log(`✅ Status: Hierarchy building complete: ${successfulHierarchies}/${totalDimensions} dimensions processed successfully`);
        
        // Initialize filter system with dimension hierarchies
        console.log("⏳ Status: Initializing filter system with dimension hierarchies");
        setTimeout(() => {
            if (window.EnhancedFilterSystem && typeof window.EnhancedFilterSystem.initialize === 'function') {
                window.EnhancedFilterSystem.state = state;
                window.EnhancedFilterSystem.initialize();
            } else {
                console.log("⏳ Status: Filter system not yet available, will initialize when loaded");
            }
        }, 500);

        // Mark hierarchies as built
        state.hierarchiesBuilt = true;
        
        return true;
        
    } catch (error) {
        console.error('Hierarchy Building Error:', error);
        
        // Show error message if elements provided
        if (elements) {
            console.error(`❌ Hierarchy Building Error: ${error.message}`, 'error', elements);
        }
        
        return false;
    }
}


/**
 * ENHANCED: Get filter options for a specific dimension
 * @param {string} dimensionKey - Dimension key (e.g., 'le', 'cost_element')
 * @returns {Array} - Array of filter options with value and label
 */
function getDimensionFilterOptions(dimensionKey) {
    const dimensionFilter = state.dimensionFilters[dimensionKey];
    if (!dimensionFilter || !dimensionFilter.data || !dimensionFilter.config) {
        console.warn(`No filter data available for dimension: ${dimensionKey}`);
        return [];
    }
    
    const { data, config } = dimensionFilter;
    const options = [];
    const seenValues = new Set();
    
    data.forEach(row => {
        const value = row[config.valueField];
        const label = row[config.displayField] || value;
        
        if (value !== null && value !== undefined && !seenValues.has(value)) {
            seenValues.add(value);
            options.push({
                value: value,
                label: label,
                filterField: config.filterField
            });
        }
    });
    
    // Sort options by label
    options.sort((a, b) => {
        const labelA = String(a.label || '').toLowerCase();
        const labelB = String(b.label || '').toLowerCase();
        return labelA.localeCompare(labelB);
    });
    
    console.log(`✅ Status: Generated ${options.length} filter options for ${dimensionKey}`);
    return options;
}


/**
 * ENHANCED: Get all available filter fields for building filter UI
 * @returns {Object} - Object mapping dimension keys to their filter options
 */
function getAllDimensionFilterOptions() {
    const allOptions = {};
    
    Object.keys(state.dimensionFilters).forEach(dimensionKey => {
        allOptions[dimensionKey] = getDimensionFilterOptions(dimensionKey);
    });
    
    return allOptions;
}


/**
 * Fetches a table (dimension or fact) via the API NDJSON endpoint
 * @param {string} tableName - Name of the table to fetch
 * @returns {Promise<{data: Array, error?: any}>} - Object containing data or error
 */
async function fetchDatabaseData(databaseObjectName) {
    const url = `${ENDPOINTS.GET_DATA}${databaseObjectName}`; 
    try {
        console.log(`⏳ Status: Fetching data for ${databaseObjectName}...`);
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
            
        return dims;
    } catch (error) {
        console.error('❌ Error fetching dimension names for fact:', error);
        throw error;
    }
}


/**
 * PHASE 1: Ingest only dimension data from database
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table to get dimensions for (default: 'FACT_BOM')
 * @returns {Promise<void>}
 */
async function ingestDimensionData(elements, selectedFact = 'FACT_BOM') {
    console.log('⏳ Status: Loading dimension data with GMID limited loading...');
    
    try {        
        // 1. Get dimensions related to the selected fact table
        const dimNames = await fetchDimensionNamesForFact(selectedFact);
        
        console.log(`✅ Status: Loading ${dimNames.length} dimensions`);

        // 2. Build available files list (include ALL dimensions as regular dimensions)
        state.availableFiles = [];
        dimNames.forEach(dim => {
            state.availableFiles.push({
                id: `${dim}`,
                label: dim.replace(/^DIM_/, ''),
                type: 'dimension',
                hierarchical: ['LE', 'COST_ELEMENT', 'GMID_DISPLAY', 'ROOT_GMID_DISPLAY', 'SMARTCODE', 'MC', 'YEAR', 'ITEM_COST_TYPE', 'MATERIAL_TYPE'].includes(
                    dim.replace(/^DIM_/, '')
                ),
                suppressFilter: dim === 'DIM_GMID_DISPLAY' // Flag to suppress filter UI
            });
        });
        
        // Add fact table to available files
        state.availableFiles.push({
            id: selectedFact,
            label: selectedFact.replace(/^FACT_/, ''),
            type: 'fact'
        });

        // 3. Load dimension data
        console.log("⏳ Status: Loading dimension data from database...");
        state.dimensions = {};
        
        // Initialize all dimensions to empty objects
        dimNames.forEach(dim => {
            const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
            state.dimensions[dimKey] = [];
        });
        
        // 4. Fetch dimension data with special handling for GMID_DISPLAY
        const dimensionPromises = dimNames.map(async dim => {
            try {
                ui.updateTableStatus(dim, 'loading');
                
                let data, error;
                
                // Special handling for GMID_DISPLAY - load placeholder data
                if (dim === 'DIM_GMID_DISPLAY') {
                    console.log("📦 Loading GMID_DISPLAY with 10-record limit...");
                    const gmidData = await loadGmidDisplayPlaceholder();
                    data = gmidData;
                    error = null;
                    
                    if (data && data.length > 0) {
                        console.log(`✅ Status: GMID_DISPLAY loaded with limit: ${data.length} records`);
                        ui.updateTableStatus(dim, 'limited', data.length);
                    } else {
                        console.warn("⚠️ Warning: No GMID_DISPLAY data received");
                        ui.updateTableStatus(dim, 'warning');
                        error = "No data received";
                    }
                } else {
                    // Regular dimension loading
                    const result = await fetchDatabaseData(dim);
                    data = result.data;
                    error = result.error;
                }
                
                if (error || !data) {
                    ui.updateTableStatus(dim, 'error');
                    console.error(`Error loading dimension: ${dim}`, error);
                    return false;
                }
                
                const dimKey = dim.replace(/^DIM_/, '').toLowerCase();
                state.dimensions[dimKey] = data;
                
                if (dim !== 'DIM_GMID_DISPLAY') {
                    ui.updateTableStatus(dim, 'loaded', data.length);
                }
                console.log(`✅ Status: Loaded dimension ${dim}: ${data.length} rows`);
                                
                return true;
            } catch (err) {
                console.error(`Error loading dimension ${dim}:`, err);
                ui.updateTableStatus(dim, 'error');
                return false;
            }
        });
        
        // Wait for all dimension data to load
        await Promise.all(dimensionPromises);

        // 5. Verify dimensions are loaded
        const dimensionsLoaded = Object.keys(state.dimensions).some(dimKey => 
            Array.isArray(state.dimensions[dimKey]) && state.dimensions[dimKey].length > 0
        );
        
        if (!dimensionsLoaded) {
            throw new Error("No dimension data was properly loaded");
        }

        // 6. Generate available fields (include all dimensions, including GMID_DISPLAY)
        state.availableFields = [];
        
        state.availableFiles.forEach(file => {
            if (file.type === 'dimension') {
                state.availableFields.push({
                    id: file.id,
                    label: file.label,
                    category: 'Dimension',
                    type: 'dimension',
                    hierarchical: file.hierarchical,
                    draggableTo: ['row', 'column', 'filter'],
                    suppressFilter: file.suppressFilter || false // Pass through the suppress flag
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

        // 7. Process dimension data to build hierarchies (including limited GMID)
        try {
            console.log("⏳ Status: Building dimension hierarchies with limited GMID data...");
            const hierarchies = processDimensionHierarchies(state.dimensions, null);
            state.hierarchies = hierarchies || {};
            
            // Mark GMID hierarchy as limited data (not placeholder, but limited)
            if (state.hierarchies.gmid_display) {
                state.hierarchies.gmid_display._isLimited = true;
                state.hierarchies.gmid_display._loadedAt = Date.now();
                state.hierarchies.gmid_display._recordCount = state.dimensions.gmid_display?.length || 0;
                
                // Update root node label to indicate limited data
                if (state.hierarchies.gmid_display.root) {
                    const recordCount = state.hierarchies.gmid_display._recordCount;
                    state.hierarchies.gmid_display.root.label = `GMIDs (${recordCount} sample records)`;
                }
            }
            
            console.log("✅ Status: Dimension hierarchies built including limited GMID:", Object.keys(state.hierarchies));
            
        } catch (hierError){
            console.error("Error building hierarchies:", hierError);
            state.hierarchies = {};
        }
        
        // 8. Set up UI elements
        ui.renderAvailableFields(elements);
        ui.setDefaultFields();
        ui.renderFieldContainers(elements, state);
        
        // 9. Initialize mappings (without fact data for now)
        console.log("⏳ Status: Initializing basic mappings without fact data");
        initializeBasicMappings();
                
        // 10. Initialize filter system now that dimensions are available
        console.log("⏳ Status: Initializing filter system with dimension data including limited GMID");
        setTimeout(() => {
            if (window.EnhancedFilterSystem && typeof window.EnhancedFilterSystem.initialize === 'function') {
                window.EnhancedFilterSystem.state = state;
                window.EnhancedFilterSystem.initialize();
            } else {
                console.log("⏳ Status: Filter system not yet available, will initialize when loaded");
            }
        }, 500);
        
        console.log('✅ Status: Enhanced dimension data loaded successfully with limited GMID data.', 'success', elements);
        state.dimensionsLoaded = true;
        state.gmidLimitedLoaded = true; // New flag

        return true;
        
    } catch (error) {
        console.error('Enhanced Dimension Data Loading Error:', error);
                
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.style.display = 'block';
        }
        
        console.error(`❌ Enhanced Dimension Data Loading Error: ${error.message}`, 'error', elements);
        return false;
    }
}


/**
 * Replace GMID placeholder with real filtered data
 * @param {Array} selectedRootGmids - Array of selected ROOT_GMID values
 * @returns {Promise<boolean>} - Success status
 */
// async function replaceGmidPlaceholderWithRealData(selectedRootGmids) {
//     if (!selectedRootGmids || selectedRootGmids.length === 0) {
//         console.log('✅ Status: No ROOT_GMIDs selected, keeping placeholder data');
//         return true;
//     }
    
//     if (selectedRootGmids.length > 10) {
//         console.warn(`⚠️ Warning: ${selectedRootGmids.length} ROOT_GMIDs selected (max 10 recommended for performance)`);
//         selectedRootGmids = selectedRootGmids.slice(0, 10);
//     }
    
//     console.log(`🔄 Replacing GMID placeholder with real data for ${selectedRootGmids.length} ROOT_GMIDs...`);
    
//     try {
//         // Use the existing filtered GMID endpoint
//         const API_BASE_URL = 'http://localhost:3000/api';
        
//         const queryParams = new URLSearchParams();
//         queryParams.append('ROOT_GMID', selectedRootGmids.join(','));
        
//         const url = `${API_BASE_URL}/data/DIM_GMID_DISPLAY/filtered?${queryParams.toString()}`;
        
//         console.log(`📡 Fetching real GMID data from: ${url}`);
        
//         const response = await fetch(url, {
//             headers: { 'Accept': 'application/x-ndjson' }
//         });
        
//         if (!response.ok) {
//             throw new Error(`API returned ${response.status}: ${response.statusText}`);
//         }

//         // Parse NDJSON response
//         const reader = response.body.getReader();
//         const decoder = new TextDecoder();
//         let buffer = '';
//         const rows = [];

//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
            
//             buffer += decoder.decode(value, { stream: true });
//             const lines = buffer.split('\n');
//             buffer = lines.pop();

//             lines.forEach(line => {
//                 if (line.trim()) {
//                     try {
//                         rows.push(JSON.parse(line));
//                     } catch (e) {
//                         console.warn('Invalid JSON line in real GMID data:', e);
//                     }
//                 }
//             });
//         }

//         if (buffer.trim()) {
//             try {
//                 rows.push(JSON.parse(buffer));
//             } catch (e) {
//                 console.warn('Invalid final JSON in real GMID data:', e);
//             }
//         }

//         console.log(`✅ Loaded ${rows.length} real GMID_DISPLAY records`);
        
//         // Replace placeholder data with real data
//         state.dimensions.gmid_display = rows;
        
//         // Rebuild GMID hierarchy with real data
//         console.log("🔧 Rebuilding GMID hierarchy with real data...");
//         const gmidHierarchy = buildGmidDisplayHierarchy(rows);
        
//         if (gmidHierarchy) {
//             state.hierarchies.gmid_display = gmidHierarchy;
//             state.hierarchies.gmid_display._isPlaceholder = false;
//             state.hierarchies.gmid_display._replacedAt = Date.now();
            
//             console.log(`✅ Status: GMID hierarchy rebuilt with real data: ${Object.keys(gmidHierarchy.nodesMap || {}).length} nodes`);
//         }
        
//         // Update UI status
//         ui.updateTableStatus('DIM_GMID_DISPLAY', 'loaded', rows.length);
        
//         // Clear placeholder flag
//         state.gmidPlaceholderLoaded = false;
//         state.gmidRealDataLoaded = true;
        
//         console.log(`✅ Status: Successfully replaced GMID placeholder with ${rows.length} real records`);
//         return true;
        
//     } catch (error) {
//         console.error('❌ Error replacing GMID placeholder with real data:', error);
        
//         // Update UI to show error but keep placeholder
//         ui.updateTableStatus('DIM_GMID_DISPLAY', 'error');
        
//         return false;
//     }
// }
async function replaceGmidPlaceholderWithRealData(selectedRootGmids, additionalFilters = {}) {
    if (!selectedRootGmids || selectedRootGmids.length === 0) {
        console.log('✅ Status: No ROOT_GMIDs provided, keeping placeholder data');
        return true;
    }
    
    if (selectedRootGmids.length > 50) {
        console.warn(`⚠️ Warning: ${selectedRootGmids.length} ROOT_GMIDs provided, limiting to first 50 for performance`);
        selectedRootGmids = selectedRootGmids.slice(0, 50);
    }
    
    console.log(`🔄 Enhanced GMID replacement with filtered data for ${selectedRootGmids.length} ROOT_GMIDs...`);
    
    try {
        const API_BASE_URL = 'http://localhost:3000/api';
        
        // Build query parameters for ROOT_GMID filtering
        const queryParams = new URLSearchParams();
        queryParams.append('ROOT_GMID', selectedRootGmids.join(','));
        
        // Add any additional filters if provided
        if (additionalFilters.PATH_GMID && additionalFilters.PATH_GMID.length > 0) {
            queryParams.append('PATH_GMID', additionalFilters.PATH_GMID.join(','));
        }
        
        const url = `${API_BASE_URL}/data/DIM_GMID_DISPLAY/filtered?${queryParams.toString()}`;
        
        console.log(`📡 Fetching enhanced GMID data from: ${url}`);
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        // Parse NDJSON response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];

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
                        console.warn('Invalid JSON line in enhanced GMID data:', e);
                    }
                }
            });
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn('Invalid final JSON in enhanced GMID data:', e);
            }
        }

        console.log(`✅ Loaded ${rows.length} filtered GMID_DISPLAY records`);
        
        // Apply additional filtering if PATH_GMID constraints exist
        let filteredRows = rows;
        if (additionalFilters.PATH_GMID && additionalFilters.PATH_GMID.length > 0) {
            const pathGmidSet = new Set(additionalFilters.PATH_GMID);
            filteredRows = rows.filter(row => 
                row.PATH_GMID && pathGmidSet.has(row.PATH_GMID)
            );
            console.log(`✅ Applied PATH_GMID filter: ${rows.length} → ${filteredRows.length} records`);
        }
        
        // Replace dimension data with filtered real data
        if (!state.dimensions) {
            state.dimensions = {};
        }
        state.dimensions.gmid_display = filteredRows;
        
        // Rebuild GMID hierarchy with filtered real data
        console.log("🔧 Rebuilding GMID hierarchy with filtered real data...");
        const gmidHierarchy = buildGmidDisplayHierarchy(filteredRows);
        
        if (gmidHierarchy) {
            if (!state.hierarchies) {
                state.hierarchies = {};
            }
            
            state.hierarchies.gmid_display = gmidHierarchy;
            state.hierarchies.gmid_display._isPlaceholder = false;
            state.hierarchies.gmid_display._isFiltered = true;
            state.hierarchies.gmid_display._filterCriteria = {
                rootGmids: selectedRootGmids,
                additionalFilters: additionalFilters,
                appliedAt: Date.now()
            };
            
            console.log(`✅ Status: GMID hierarchy rebuilt with filtered data: ${Object.keys(gmidHierarchy.nodesMap || {}).length} nodes`);
        }
        
        // Update UI status
        if (typeof ui !== 'undefined' && ui.updateTableStatus) {
            ui.updateTableStatus('DIM_GMID_DISPLAY', 'loaded', filteredRows.length);
        }
        
        // Clear placeholder flags and set filtered flags
        state.gmidPlaceholderLoaded = false;
        state.gmidRealDataLoaded = true;
        state.gmidFilteredDataLoaded = true;
        
        console.log(`✅ Status: Successfully replaced GMID placeholder with ${filteredRows.length} filtered records`);
        return true;
        
    } catch (error) {
        console.error('❌ Error in enhanced GMID placeholder replacement:', error);
        
        // Update UI to show error but keep placeholder
        if (typeof ui !== 'undefined' && ui.updateTableStatus) {
            ui.updateTableStatus('DIM_GMID_DISPLAY', 'error');
        }
        
        return false;
    }
}


/**
 * NEW: Extract ROOT_GMIDs from filtered fact data
 * This function helps determine which ROOT_GMIDs should be used for GMID filtering
 * @param {Array} filteredFactData - The filtered fact data
 * @param {number} maxRootGmids - Maximum number of ROOT_GMIDs to return (default: 50)
 * @returns {Array} - Array of unique ROOT_GMID values
 */
function extractRootGmidsFromFactData(filteredFactData, maxRootGmids = 50) {
    if (!filteredFactData || !Array.isArray(filteredFactData) || filteredFactData.length === 0) {
        console.warn('⚠️ No filtered fact data provided for ROOT_GMID extraction');
        return [];
    }
    
    console.log(`🔍 Extracting ROOT_GMIDs from ${filteredFactData.length} fact records...`);
    
    // Extract unique ROOT_GMIDs, filtering out null/empty values
    const uniqueRootGmids = [...new Set(
        filteredFactData
            .filter(row => row && row.ROOT_GMID && row.ROOT_GMID.trim() !== '')
            .map(row => row.ROOT_GMID.trim())
    )];
    
    // Sort for consistent results
    uniqueRootGmids.sort();
    
    // Limit for performance
    const limitedRootGmids = uniqueRootGmids.slice(0, maxRootGmids);
    
    if (limitedRootGmids.length < uniqueRootGmids.length) {
        console.warn(`⚠️ Limited ROOT_GMIDs from ${uniqueRootGmids.length} to ${limitedRootGmids.length} for performance`);
    }
    
    console.log(`✅ Extracted ${limitedRootGmids.length} unique ROOT_GMIDs from fact data`);
    
    return limitedRootGmids;
}

/**
 * NEW: Extract PATH_GMIDs from filtered fact data
 * This can be used for additional GMID dimension filtering
 * @param {Array} filteredFactData - The filtered fact data
 * @param {number} maxPathGmids - Maximum number of PATH_GMIDs to return (default: 1000)
 * @returns {Array} - Array of unique PATH_GMID values
 */
function extractPathGmidsFromFactData(filteredFactData, maxPathGmids = 1000) {
    if (!filteredFactData || !Array.isArray(filteredFactData) || filteredFactData.length === 0) {
        console.warn('⚠️ No filtered fact data provided for PATH_GMID extraction');
        return [];
    }
    
    console.log(`🔍 Extracting PATH_GMIDs from ${filteredFactData.length} fact records...`);
    
    // Extract unique PATH_GMIDs, filtering out null/empty values
    const uniquePathGmids = [...new Set(
        filteredFactData
            .filter(row => row && row.PATH_GMID && row.PATH_GMID.trim() !== '')
            .map(row => row.PATH_GMID.trim())
    )];
    
    // Sort for consistent results
    uniquePathGmids.sort();
    
    // Limit for performance
    const limitedPathGmids = uniquePathGmids.slice(0, maxPathGmids);
    
    if (limitedPathGmids.length < uniquePathGmids.length) {
        console.warn(`⚠️ Limited PATH_GMIDs from ${uniquePathGmids.length} to ${limitedPathGmids.length} for performance`);
    }
    
    console.log(`✅ Extracted ${limitedPathGmids.length} unique PATH_GMIDs from fact data`);
    
    return limitedPathGmids;
}

/**
 * NEW: Comprehensive filter coordination function
 * This function coordinates filtering across dimensions and fact data
 * @param {Object} filterParams - Filter parameters from the filter system
 * @returns {Promise<Object>} - Result object with filtered data and metadata
 */
async function coordinateComprehensiveFiltering(filterParams) {
    console.log('🚀 Starting comprehensive filtering coordination...');
    
    try {
        // Step 1: Apply filters to get filtered fact data (excluding GMID filters for now)
        const nonGmidFilters = { ...filterParams };
        delete nonGmidFilters.PATH_GMID; // Remove GMID filters temporarily
        
        console.log('📊 Step 1: Fetching fact data with non-GMID filters...');
        const factData = await fetchFilteredFactDataDirect(nonGmidFilters);
        
        if (!factData || factData.length === 0) {
            console.log('⚠️ No fact data matches non-GMID filters');
            return {
                success: false,
                factData: [],
                gmidData: [],
                rootGmids: [],
                pathGmids: []
            };
        }
        
        console.log(`✅ Step 1 complete: ${factData.length} fact records retrieved`);
        
        // Step 2: Extract GMIDs from filtered fact data
        console.log('🔍 Step 2: Extracting GMIDs from filtered fact data...');
        const rootGmidsFromFact = extractRootGmidsFromFactData(factData);
        const pathGmidsFromFact = extractPathGmidsFromFactData(factData);
        
        console.log(`✅ Step 2 complete: ${rootGmidsFromFact.length} ROOT_GMIDs, ${pathGmidsFromFact.length} PATH_GMIDs`);
        
        // Step 3: Filter GMID dimension data
        console.log('🔧 Step 3: Filtering GMID dimension data...');
        const gmidFilterSuccess = await replaceGmidPlaceholderWithRealDataEnhanced(
            rootGmidsFromFact,
            { PATH_GMID: pathGmidsFromFact }
        );
        
        let gmidData = [];
        if (gmidFilterSuccess && state.dimensions && state.dimensions.gmid_display) {
            gmidData = state.dimensions.gmid_display;
        }
        
        console.log(`✅ Step 3 complete: ${gmidData.length} GMID dimension records`);
        
        // Step 4: Apply any remaining GMID filters to fact data
        let finalFactData = factData;
        if (filterParams.PATH_GMID && filterParams.PATH_GMID.length > 0) {
            console.log('🔧 Step 4: Applying GMID filters to fact data...');
            const pathGmidSet = new Set(filterParams.PATH_GMID);
            finalFactData = factData.filter(row => 
                row.PATH_GMID && pathGmidSet.has(row.PATH_GMID)
            );
            console.log(`✅ Step 4 complete: ${factData.length} → ${finalFactData.length} fact records after GMID filtering`);
        }
        
        console.log('🚀 Comprehensive filtering coordination complete');
        
        return {
            success: true,
            factData: finalFactData,
            gmidData: gmidData,
            rootGmids: rootGmidsFromFact,
            pathGmids: pathGmidsFromFact,
            filteringSteps: {
                step1_factRecords: factData.length,
                step2_rootGmids: rootGmidsFromFact.length,
                step2_pathGmids: pathGmidsFromFact.length,
                step3_gmidRecords: gmidData.length,
                step4_finalFactRecords: finalFactData.length
            }
        };
        
    } catch (error) {
        console.error('❌ Error in comprehensive filtering coordination:', error);
        return {
            success: false,
            error: error.message,
            factData: [],
            gmidData: [],
            rootGmids: [],
            pathGmids: []
        };
    }
}

/**
 * NEW: Direct fact data fetching function (wrapper for existing functionality)
 * This function calls the existing filtered fact data API
 * @param {Object} filterParams - Filter parameters
 * @returns {Promise<Array>} - Filtered fact data
 */
async function fetchFilteredFactDataDirect(filterParams) {
    // This function should call the existing fetchFilteredFactData method
    // from the EnhancedFilterSystem class or similar functionality
    
    const API_BASE_URL = 'http://localhost:3000/api';
    
    try {
        console.log(`📡 Fetching filtered FACT_BOM data with parameters:`, filterParams);
        
        // Build query parameters
        const queryParams = new URLSearchParams();
        
        Object.entries(filterParams).forEach(([field, values]) => {
            if (values && Array.isArray(values) && values.length > 0) {
                queryParams.append(field, values.join(','));
            }
        });
        
        const url = `${API_BASE_URL}/data/FACT_BOM/filtered?${queryParams.toString()}`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        // Parse NDJSON response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const rows = [];

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
                        console.warn('Invalid JSON line in fact data:', e);
                    }
                }
            });
        }

        if (buffer.trim()) {
            try {
                rows.push(JSON.parse(buffer));
            } catch (e) {
                console.warn('Invalid final JSON in fact data:', e);
            }
        }

        console.log(`✅ Retrieved ${rows.length} filtered FACT_BOM records`);
        return rows;
        
    } catch (error) {
        console.error('❌ Error fetching filtered fact data:', error);
        throw error;
    }
}

/**
 * NEW: Check if GMID dimension has been filtered
 * @returns {boolean} - True if GMID dimension contains filtered data
 */
function isGmidDimensionFiltered() {
    return state.gmidFilteredDataLoaded === true ||
           (state.hierarchies?.gmid_display?._isFiltered === true);
}

/**
 * NEW: Get GMID filter metadata
 * @returns {Object|null} - Metadata about GMID filtering or null if not filtered
 */
function getGmidFilterMetadata() {
    if (!isGmidDimensionFiltered()) {
        return null;
    }
    
    const hierarchy = state.hierarchies?.gmid_display;
    if (hierarchy && hierarchy._filterCriteria) {
        return {
            isFiltered: true,
            rootGmidsCount: hierarchy._filterCriteria.rootGmids?.length || 0,
            appliedAt: hierarchy._filterCriteria.appliedAt,
            additionalFilters: hierarchy._filterCriteria.additionalFilters,
            recordCount: state.dimensions?.gmid_display?.length || 0
        };
    }
    
    return {
        isFiltered: true,
        recordCount: state.dimensions?.gmid_display?.length || 0
    };
}


/**
 * Check if GMID dimension is currently using placeholder data
 * @returns {boolean} - True if using placeholder data
 */
function isGmidUsingPlaceholderData() {
    return state.gmidPlaceholderLoaded === true && 
           state.gmidRealDataLoaded !== true &&
           state.hierarchies?.gmid_display?._isPlaceholder === true;
}


function createPlaceholderHierarchy(dimensionName) {
    const dimKey = dimensionName.replace(/^DIM_/, '').toLowerCase();
    const label = dimensionName.replace(/^DIM_/, '').replace(/_/g, ' ');
    
    const rootNode = {
        id: 'ROOT',
        label: `${label} (Loading...)`,
        children: [],
        level: 0,
        path: ['ROOT'],
        expanded: false,
        isLeaf: true,  // Temporarily treat as leaf until loaded
        hasChildren: false,
        isPlaceholder: true
    };
    
    return {
        root: rootNode,
        nodesMap: { 'ROOT': rootNode },
        flatData: [],
        isPlaceholder: true,
        dimensionName: dimensionName
    };
}


async function loadDeferredDimension(dimensionName) {
    console.log(`⏳ Status: Loading deferred dimension: ${dimensionName}`);
    
    try {
        ui.updateTableStatus(dimensionName, 'loading');
        
        // Fetch the dimension data
        const { data, error } = await fetchDatabaseData(dimensionName);
        
        if (error || !data) {
            ui.updateTableStatus(dimensionName, 'error');
            console.error(`Error loading deferred dimension: ${dimensionName}`, error);
            return false;
        }
        
        // Store in state
        const dimKey = dimensionName.replace(/^DIM_/, '').toLowerCase();
        state.dimensions[dimKey] = data;
        
        // Build hierarchy for this dimension
        const hierarchies = processDimensionHierarchies({ [dimKey]: data }, null);
        if (hierarchies && hierarchies[dimKey]) {
            state.hierarchies[dimKey] = hierarchies[dimKey];
        }
        
        // Update UI status
        ui.updateTableStatus(dimensionName, 'loaded', data.length);
        
        // Add to available fields if not already there
        const existingField = state.availableFields.find(f => f.id === dimensionName);
        if (!existingField) {
            const file = state.availableFiles.find(f => f.id === dimensionName);
            if (file) {
                state.availableFields.push({
                    id: file.id,
                    label: file.label,
                    category: 'Dimension',
                    type: 'dimension',
                    hierarchical: file.hierarchical,
                    draggableTo: ['row', 'column', 'filter']
                });
                
                // Re-render available fields
                const elements = core.getDomElements();
                ui.renderAvailableFields(elements);
            }
        }
        
        console.log(`✅ Status: Successfully loaded deferred dimension ${dimensionName}: ${data.length} rows`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error loading deferred dimension ${dimensionName}:`, error);
        ui.updateTableStatus(dimensionName, 'error');
        return false;
    }
}


async function loadAllDeferredDimensions() {
    if (!state.deferredDimensions || state.deferredDimensions.length === 0) {
        console.log("✅ Status: No deferred dimensions to load");
        return true;
    }
    
    console.log(`⏳ Status: Loading ${state.deferredDimensions.length} deferred dimensions...`);
    
    const loadPromises = state.deferredDimensions.map(dim => loadDeferredDimension(dim));
    const results = await Promise.all(loadPromises);
    
    const successCount = results.filter(Boolean).length;
    console.log(`✅ Status: Loaded ${successCount}/${state.deferredDimensions.length} deferred dimensions`);
    
    return successCount > 0;
}


/**
 * PHASE 1: Ingest fact data on demand
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table to load (default: 'FACT_BOM')
 * @returns {Promise<void>}
 */
async function ingestFactData(elements, selectedFact = 'FACT_BOM') {
    console.log('⏳ Status: Loading fact data from Snowflake database server...', 'info', elements);
    
    try {
        // Ensure dimensions are loaded first
        if (!state.dimensionsLoaded) {
            throw new Error("Dimensions must be loaded before fact data");
        }

        // Load fact data
        console.log(`⏳ Status: Loading fact data from ${selectedFact}...`);
        ui.updateTableStatus(selectedFact, 'loading');
        
        // Definition switched from const to let to allow data filtering
        let { data: factData, error: factError } = await fetchDatabaseData(selectedFact);

        console.log(`✅ Status: Loaded fact data ${selectedFact}: ${factData.length} rows`);
        
        if (factError || !factData) {
            ui.updateTableStatus(selectedFact, 'error');
            throw new Error(`Error loading fact data: ${selectedFact}`);
        }
        
        // Store fact data
        state.factData = factData;
        ui.updateTableStatus(selectedFact, 'loaded', factData.length);
        console.log(`✅ Status: Loaded working fact data ${selectedFact}: ${factData.length} rows`);

        // Confirm fact data is cached before moving on
        if(state.factData.length > 0){
            console.log("✅ Status: Sample BOM data:", state.factData[0]);
        }

        // Verify fact data is loaded before proceeding
        if (!state.factData || state.factData.length === 0) {
            throw new Error("Fact data was not properly loaded");
        }        

        // Optimize dimension data by filtering to only records used in fact data
        console.log("⏳ Status: Optimizing dimension data based on fact relationships...");
        
        // Extract unique dimension keys from fact data for filtering
        const dimensionKeys = {};
        
        Object.keys(state.dimensions).forEach(dimKey => {
            const factIdField = getFactIdField(dimKey);
            
            if (factIdField) {
                // Extract unique values from fact data for this dimension
                const uniqueValues = new Set();
                state.factData.forEach(row => {
                    if (row[factIdField] !== null && row[factIdField] !== undefined && row[factIdField] !== '') {
                        uniqueValues.add(row[factIdField]);
                    }
                });
                dimensionKeys[dimKey] = uniqueValues;
                console.log(`✅ Status: Found ${uniqueValues.size} unique ${dimKey} keys in fact data`);
            } else {
                console.warn(`⚠️ Warning: No fact field mapping found for dimension ${dimKey}`);
                dimensionKeys[dimKey] = new Set(); // Empty set means no filtering
            }
        });
        
        // Filter each dimension to only include records referenced in fact data
        Object.keys(state.dimensions).forEach(dimKey => {
            const originalData = state.dimensions[dimKey];
            const originalCount = originalData.length;
            
            if (dimensionKeys[dimKey] && dimensionKeys[dimKey].size > 0) {
                // Get the dimension ID field using the provided mapping function
                const dimIdField = getDimensionIdField(dimKey);
                
                if (dimIdField) {
                    const filteredData = originalData.filter(row => 
                        dimensionKeys[dimKey].has(row[dimIdField])
                    );
                    
                    state.dimensions[dimKey] = filteredData;
                    
                    const filterRatio = ((originalCount - filteredData.length) / originalCount * 100).toFixed(1);
                    console.log(`✅ Status: Optimized ${dimKey}: ${originalCount} → ${filteredData.length} rows (${filterRatio}% reduction)`);
                } else {
                    console.warn(`⚠️ Warning: No ID field mapping found for dimension ${dimKey}, keeping all records`);
                }
            } else {
                console.log(`📝 Status: No optimization applied to ${dimKey} (no matching fact keys found)`);
            }
        });

        // Rebuild hierarchies with optimized dimension data
        console.log("⏳ Status: Rebuilding hierarchies with optimized data...");
        const hierarchies = processDimensionHierarchies(state.dimensions, state.factData);
        state.hierarchies = hierarchies || {};
        console.log("✅ Status: Dimension hierarchies rebuilt with fact data:", Object.keys(state.hierarchies));
        
        // Complete mappings initialization now that we have fact data
        console.log("⏳ Status: Completing mappings with fact data");
        initializeMappings();
        
        // Enable filters now that fact data is available
        console.log("⏳ Status: Enabling filters with fact data");
        setTimeout(() => {
            // Try to enable filters if the filter system exists
            if (window.EnhancedFilterSystem && window.EnhancedFilterSystem.applyAllFilters) {
                window.EnhancedFilterSystem.applyAllFilters();
            }
        }, 500);
                
        // Show success message
        console.log('✅ Status: Fact data loaded successfully from Snowflake database with performance optimizations.', 'success', elements);
        state.factDataLoaded = true;

        return true;
        
    } catch (error) {
        console.error('Fact Data Loading Error:', error);
                
        // Show error message
        console.error(`❌ Fact Data Loading Error: ${error.message}`, 'error', elements);
        return false;
    }
}


/**
 * Initialize basic mappings without fact data
 */
function initializeBasicMappings() {
    console.log("⏳ Status: Starting basic dimension mappings initialization");
    
    // Initialize state.mappings object if it doesn't exist
    if (!state.mappings) {
        state.mappings = {};
    }
    
    // Initialize basic mappings that don't require fact data
    // These will be completed when fact data is loaded
    
    console.log("✅ Status: Basic mappings initialized successfully");
}


/**
 * Main function to ingest data from database
 * @param {Object} elements - DOM elements object
 * @param {string} selectedFact - Name of the fact table to load (default: 'FACT_BOM')
 * @returns {Promise<void>}
 */
async function ingestData(elements, selectedFact = 'FACT_BOM') {
    console.log('⏳ Status: Using legacy ingestData - calling new phased approach...');
    
    // First load dimensions
    const dimensionsSuccess = await ingestDimensionData(elements, selectedFact);
    if (!dimensionsSuccess) {
        return false;
    }
    
    // Then load fact data
    const factSuccess = await ingestFactData(elements, selectedFact);
    return factSuccess;
}


function getDimensionIdField(dimName) {
    // Define mapping between dimension names and id field names
    const dimensionIdFieldMap = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'PATH_GMID',
        'root_gmid_display': 'ROOT_GMID',
        'smartcode': 'SMARTCODE',
        'item_cost_type': 'ITEM_COST_TYPE',
        'material_type': 'MATERIAL_TYPE',
        'mc': 'MC',
        'year': 'YEAR'
    };
    
    return dimensionIdFieldMap[dimName.toLowerCase()] || null;
}


window.generatePivotTable = function() {
    console.log("PIVOT GEN START - Original factData length:", stateModule.state.factData.length);
    
    // Are we using filtered data?
    if (stateModule.state.filteredData && stateModule.state.filteredData.length > 0) {
        console.log("⏳ Status: Using filteredData with length:", stateModule.state.filteredData.length);
                
        // Store original factData reference (not just length)
        const originalFactData = stateModule.state.factData;
        
        // Replace factData with filteredData
        stateModule.state.factData = stateModule.state.filteredData;
        
        // Generate pivot table
        console.log("⏳ Status: Calling pivotTable.generatePivotTable with filtered data");
        pivotTable.generatePivotTable();
        
        // Restore original factData
        console.log("✅ Status: Restoring original factData");
        stateModule.state.factData = originalFactData;
    } else {
        // Generate pivot table with original data
        console.log("✅ Status: Using original factData");
        pivotTable.generatePivotTable();
    }
    
    console.log("✅ Status: PIVOT GEN COMPLETE");
};


function processHierarchicalFields(fieldIds, axisType) {
    console.log(`⏳ Status: Processing hierarchical fields: ${fieldIds.join(', ')} for ${axisType}`);
    
    const result = {
        flatRows: [],
        flatMappings: [],
        hierarchyFields: []
    };
    
    fieldIds.forEach(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) {
            console.warn(`Field not found: ${fieldId}`);
            return;
        }
        
        const dimName = field.id.replace('DIM_', '').toLowerCase();
        
        if (!state.hierarchies || !state.hierarchies[dimName]) {
            console.error(`No hierarchy found for ${dimName}`);
            return;
        }
        
        const hierarchy = state.hierarchies[dimName];
        if (!hierarchy || !hierarchy.root) {
            console.error(`Invalid hierarchy for ${dimName}`);
            return;
        }
        
        // Ensure root node always has ID 'ROOT'
        if (hierarchy.root.id !== 'ROOT') {
            console.warn(`Fixing root node ID from ${hierarchy.root.id} to ROOT for ${dimName}`);
            const oldId = hierarchy.root.id;
            hierarchy.root.id = 'ROOT';
            hierarchy.root.path = ['ROOT'];
            
            if (hierarchy.nodesMap) {
                hierarchy.nodesMap['ROOT'] = hierarchy.root;
                if (oldId !== 'ROOT') {
                    delete hierarchy.nodesMap[oldId];
                }
            }
        }
        
        result.hierarchyFields.push(field);
        
        const zone = axisType;
        
        if (!state.expandedNodes[dimName]) {
            state.expandedNodes[dimName] = { row: {}, column: {} };
        }
        if (!state.expandedNodes[dimName][zone]) {
            state.expandedNodes[dimName][zone] = {};
        }
        
        const rootId = 'ROOT';
        
        // CRITICAL FIX: Different expansion logic for column vs row
        if (axisType === 'column') {
            // COLUMN ZONE: Auto-expand root to show children, but INCLUDE root in output
            console.log(`🏛️ Column zone processing for ${dimName}: Auto-expanding root "${hierarchy.root.label}"`);
            
            // Force root to be expanded so children are visible
            state.expandedNodes[dimName][zone][rootId] = true;
            hierarchy.root.expanded = true;
            
            // Apply expansion state to all nodes
            applyExpansionState(hierarchy.root, state.expandedNodes[dimName][zone]);
            
        } else {
            // ROW ZONE: Keep existing behavior
            if (state.expandedNodes[dimName][zone][rootId] === undefined) {
                state.expandedNodes[dimName][zone][rootId] = false;
            }
            
            applyExpansionState(hierarchy.root, state.expandedNodes[dimName][zone]);
        }
        
        // CRITICAL FIX: Always flatten hierarchy INCLUDING root node
        let flattenedNodes = [];
        try {
            flattenedNodes = flattenHierarchyRespectingState(hierarchy.root, state.expandedNodes[dimName][zone]);
            
            // DEBUGGING: Log what nodes we got
            console.log(`📊 ${axisType} zone ${dimName}: Flattened ${flattenedNodes.length} nodes:`);
            flattenedNodes.forEach((node, index) => {
                console.log(`  ${index}: ${node.id} - "${node.label}" (level: ${node.level}, isLeaf: ${node.isLeaf})`);
            });
            
        } catch (error) {
            console.error(`Error flattening ${dimName} hierarchy:`, error);
            flattenedNodes = [hierarchy.root]; // At least include the root
        }
        
        // Process all flattened nodes
        flattenedNodes.forEach(node => {
            const factId = node.factId !== undefined ? node.factId : null;
            
            result.flatRows.push({
                _id: node.id,
                label: node.label || node.id,
                level: node.level,
                hasChildren: node.hasChildren,
                isLeaf: node.isLeaf,
                expanded: node.expanded,
                hierarchyField: field.id,
                path: node.path,
                factId: factId
            });
            
            result.flatMappings.push({
                id: node.id,
                dimensionName: dimName,
                nodeId: node.id,
                isHierarchical: true,
                isLeaf: node.isLeaf,
                factId: factId,
                factIdField: getFactIdField(dimName)
            });
        });
    });
    
    console.log(`✅ Processed ${fieldIds.length} fields for ${axisType}. Total nodes: ${result.flatRows.length}`);
    
    // DEBUGGING: Log final result for column zone
    if (axisType === 'column') {
        console.log(`🏛️ Final column result:`);
        result.flatRows.forEach((row, index) => {
            console.log(`  Column ${index}: ${row._id} - "${row.label}" (level: ${row.level})`);
        });
    }
    
    return result;
}



/**
 * ENHANCED: Initialize all dimensions with proper collapsed state
 */
function initializeAllDimensionsCollapsed() {
    if (!state.expandedNodes) {
        state.expandedNodes = {};
    }
    
    // Get all available dimensions
    const allDimensions = ['le', 'cost_element', 'smartcode', 'gmid_display', 'root_gmid_display', 'item_cost_type', 'material_type', 'mc', 'year'];
    
    allDimensions.forEach(dimName => {
        if (!state.expandedNodes[dimName]) {
            state.expandedNodes[dimName] = { row: {}, column: {} };
        }
        
        // Initialize both row and column zones as collapsed
        ['row', 'column'].forEach(zone => {
            if (!state.expandedNodes[dimName][zone]) {
                state.expandedNodes[dimName][zone] = {};
            }
            
            // CRITICAL FIX: Always use 'ROOT' as the key
            state.expandedNodes[dimName][zone]['ROOT'] = false;
            
            // Set all other nodes to collapsed if they exist
            const hierarchy = state.hierarchies[dimName];
            if (hierarchy && hierarchy.nodesMap) {
                Object.keys(hierarchy.nodesMap).forEach(nodeId => {
                    if (nodeId !== 'ROOT' && state.expandedNodes[dimName][zone][nodeId] === undefined) {
                        state.expandedNodes[dimName][zone][nodeId] = false;
                    }
                });
            }
        });
    });
    
    console.log("✅ All dimensions initialized with collapsed state for both row and column zones");
}


// Helper function to apply expansion state
function applyExpansionState(node, expansionState) {
    if (!node) return;
    
    // Set expansion state from the zone-specific state
    node.expanded = expansionState[node.id] === true;
    
    // Apply to children
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            const childNode = typeof childId === 'string' ? findNodeById(childId) : childId;
            if (childNode) {
                applyExpansionState(childNode, expansionState);
            }
        });
    }
}


/**
 * Flatten hierarchy respecting expansion state
 */
function flattenHierarchyRespectingState(node, expansionState) {
    if (!node) return [];
    
    // CRITICAL: Always start with the current node (including root)
    const result = [node];
    
    console.log(`🔍 Flattening node: ${node.id} - "${node.label}" (expanded: ${node.expanded}, hasChildren: ${node.hasChildren})`);
    
    // Only process children if this node is expanded AND has children
    if (node.expanded && node.children && node.children.length > 0) {
        console.log(`  📁 Processing ${node.children.length} children of ${node.id}`);
        
        node.children.forEach(childId => {
            const childNode = typeof childId === 'string' ? findNodeById(childId) : childId;
            if (childNode) {
                // Apply expansion state to child
                childNode.expanded = expansionState[childNode.id] === true;
                
                console.log(`    🔍 Child: ${childNode.id} - "${childNode.label}" (expanded: ${childNode.expanded})`);
                
                // Recursively flatten child
                const childResults = flattenHierarchyRespectingState(childNode, expansionState);
                result.push(...childResults);
            } else {
                console.warn(`    ⚠️ Child node not found: ${childId}`);
            }
        });
    }
    
    return result;
}


// Helper function to get the fact ID field for a dimension
function getFactIdField(dimName) {
    // Define mapping between dimension names and fact table field names
    const factIdFieldMap = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'PATH_GMID',
        'root_gmid_display': 'ROOT_GMID',
        'smartcode': 'ROOT_SMARTCODE',
        'item_cost_type': 'ITEM_COST_TYPE',
        'material_type': 'COMPONENT_MATERIAL_TYPE',
        'mc': 'MC',
        'year': 'ZYEAR'
    };
    
    return factIdFieldMap[dimName.toLowerCase()] || null;
}


/**
 * Modified version of filterDataByDimension that ensures hierarchies
 * are displayed even when there's no matching fact data
 * Add this new function to js
 */
function preservingFilterByDimension(data, dimensionNode) {
    // Input validation - first check if data is empty or invalid
    if (!Array.isArray(data) || data.length === 0) {
        console.log(`No data to filter for node ${dimensionNode?._id || 'unknown'}`);
        return { _isEmpty: true, _hierarchyNode: true };
    }
    
    // Check if dimensionNode is null or undefined
    if (!dimensionNode) {
        console.log("Dimension node is null or undefined");
        return data;
    }
    
    // Always include ROOT nodes without filtering
    if (dimensionNode._id === 'ROOT' || dimensionNode._id.includes('_ROOT')) {
        console.log(`ROOT node detected: ${dimensionNode._id}, returning all data (${data.length} records)`);
        return data;
    }

    // Get hierarchy info from node
    const hierarchyField = dimensionNode.hierarchyField;
    if (!hierarchyField) {
        console.warn(`No hierarchy field specified for node ${dimensionNode._id}`);
        // We shouldn't return empty here - instead, try to determine the hierarchy field from the node ID
        // or use a default behavior so we don't lose data
        const potentialField = guessDimensionField(dimensionNode._id);
        if (potentialField) {
            console.log(`Using guessed field ${potentialField} for node ${dimensionNode._id}`);
            // Continue processing with the guessed field
        } else {
            // Only if we can't determine anything, return empty
            return { _isEmpty: true, _hierarchyNode: true };
        }
    }
    
    // Get the actual field to filter on from hierarchyField or potential field
    let factField = null;
    
    if (hierarchyField === 'DIM_GMID_DISPLAY') {
        factField = 'PATH_GMID';
    } else if (hierarchyField === 'DIM_COST_ELEMENT') {
        factField = 'COST_ELEMENT';
    } else if (hierarchyField === 'DIM_LE') {
        factField = 'LE';
    } else if (hierarchyField === 'DIM_ITEM_COST_TYPE') {
        factField = 'ITEM_COST_TYPE';
    } else if (hierarchyField === 'DIM_MATERIAL_TYPE') {
        factField = 'COMPONENT_MATERIAL_TYPE';
    } else if (hierarchyField === 'DIM_YEAR') {
        factField = 'ZYEAR';
    } else if (hierarchyField === 'DIM_MC') {
        factField = 'MC';
    } else if (hierarchyField === 'DIM_SMARTCODE') {
        factField = 'ROOT_SMARTCODE';
    } else {
        // Default to the hierarchyField name without DIM_ prefix
        factField = hierarchyField.replace('DIM_', '');
    }
    
    console.log(`Filtering data for node ${dimensionNode._id} using fact field ${factField}`);
    
    // Check if this is a leaf node with a specific factId to filter on
    if (dimensionNode.factId !== undefined && dimensionNode.factId !== null) {
        // Filter data based on factId
        const filteredData = data.filter(record => {
            // Handle array of factIds if present
            if (Array.isArray(dimensionNode.factId)) {
                return dimensionNode.factId.includes(record[factField]);
            }
            // Otherwise do direct comparison
            return record[factField] === dimensionNode.factId;
        });
        
        // Log filtering results for debugging
        console.log(`Filtering for factId ${dimensionNode.factId}: Found ${filteredData.length} matching records`);
        
        // Add debug logging for sample values
        if (filteredData.length > 0) {
            const sampleRecord = filteredData[0];
            console.log(`Sample record: factField=${factField}, value=${sampleRecord[factField]}, COST_UNIT=${sampleRecord.COST_UNIT}, QTY_UNIT=${sampleRecord.QTY_UNIT}`);
        }
        
        // Return empty indicator if no data found, but still preserving hierarchy
        if (filteredData.length === 0) {
            return { _isEmpty: true, _hierarchyNode: true };
        }
        
        return filteredData;
    }
    
    // For non-leaf nodes, we need to find all descendant leaf nodes and include their factIds
    const leafFactIds = getAllLeafDescendantFactIds(dimensionNode);
    
    // No leaf factIds found, return empty
    if (leafFactIds.size === 0) {
        console.log(`No leaf factIds found for node ${dimensionNode._id}`);
        return { _isEmpty: true, _hierarchyNode: true };
    }
    
    // Filter data based on all leaf factIds
    const filteredData = data.filter(record => 
        leafFactIds.has(record[factField])
    );
    
    console.log(`Filtered data using ${leafFactIds.size} leaf factIds, found ${filteredData.length} matching records`);
    
    // Return empty indicator if no data found, but still preserving hierarchy
    if (filteredData.length === 0) {
        return { _isEmpty: true, _hierarchyNode: true };
    }
    
    return filteredData;
}


/**
 * Try to guess the dimension field from a node ID
 * @param {string} nodeId - The node ID
 * @returns {string|null} - The guessed dimension field or null if can't determine
 */
function guessDimensionField(nodeId) {
    if (!nodeId) return null;
    
    // Try to determine the dimension from common patterns in node IDs
    if (nodeId.includes('LE_')) {
        return 'DIM_LE';
    } else if (nodeId.includes('COST_ELEMENT_')) {
        return 'DIM_COST_ELEMENT';
    } else if (nodeId.includes('GMID_') || nodeId.includes('PATH_GMID_')) {
        return 'DIM_GMID_DISPLAY';
    } else if (nodeId.includes('ITEM_COST_TYPE_')) {
        return 'DIM_ITEM_COST_TYPE';
    } else if (nodeId.includes('MATERIAL_TYPE_')) {
        return 'DIM_MATERIAL_TYPE';
    } else if (nodeId.includes('YEAR_')) {
        return 'DIM_YEAR';
    } else if (nodeId.includes('MC_')) {
        return 'DIM_MC';
    } else if (nodeId.includes('SMARTCODE_')) {
        return 'DIM_SMARTCODE';
    }
    
    return null;
}


/**
 * Get all fact IDs from leaf descendants of a node
 * @param {Object} node - The node to get descendants for
 * @returns {Set} - Set of all factIds
 */
function getAllLeafDescendantFactIds(node) {
    const factIds = new Set();
    
    // If this is a leaf node, add its factId
    if (node.isLeaf && node.factId) {
        if (Array.isArray(node.factId)) {
            node.factId.forEach(id => factIds.add(id));
        } else {
            factIds.add(node.factId);
        }
        return factIds;
    }
    
    // If no children, return empty set
    if (!node.children || node.children.length === 0) {
        return factIds;
    }
    
    // Process each child
    node.children.forEach(child => {
        // Handle both object references and string IDs
        const childNode = typeof child === 'string' ? 
            (node.nodesMap ? node.nodesMap[child] : null) : child;
        
        if (childNode) {
            // Get factIds from this child
            const childFactIds = getAllLeafDescendantFactIds(childNode);
            
            // Add to our set
            childFactIds.forEach(id => factIds.add(id));
        }
    });
    
    return factIds;
}


/**
 * Processes multiple row dimensions for multi-dimensional pivot tables
 * 
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
 * Extracts dimension name from a hierarchy field
 * 
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
 * Filters data by multiple dimension criteria
 * Updated for BOM data
 * 
 * @param {Array} data - Data array to filter
 * @param {Object} rowDef - Row definition with multiple dimensions
 * @returns {Array} - Filtered data array
 */
function filterDataByMultipleDimensions(data, rowDef) {
    // If not a multi-dimension row, use existing function
    if (!rowDef.dimensions) {
        return pivotTable.filterByDimensionNode(data, rowDef);
    }
    
    // Start with all data
    let filteredData = [...data];
    
    // Filter by each dimension successively
    rowDef.dimensions.forEach(dimension => {
        // Skip non-hierarchical or ROOT dimensions
        if ((!dimension.hierarchyField && dimension._id === 'ROOT') ||
            (dimension._id === 'ITEM_COST_TYPE_ROOT') ||
            (dimension._id === 'COMPONENT_MATERIAL_TYPE_ROOT') || 
            (dimension._id === 'YEAR_ROOT')) {
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
        filteredData = pivotTable.filterByDimensionNode(filteredData, dimRowDef);
    });
    
    return filteredData;
}


/**
 * Modified version of filterDataByMultipleDimensions that preserves hierarchies
 * Add this new function to js
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
            (dimension._id === 'COMPONENT_MATERIAL_TYPE_ROOT') || (dimension._id === 'MC_ROOT') || (dimension._id === 'ZYEAR_ROOT')) {
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
 * Initialize all dimension mappings
 * Builds mappings between dimension tables and fact table
 */
function initializeMappings() {
    console.log("⏳ Status: Starting dimension mappings initialization");
    
    // Initialize state.mappings object if it doesn't exist
    if (!state.mappings) {
        state.mappings = {};
    }
    
    // 1. Initialize legal entity mapping
    if (state.dimensions && state.dimensions.le && state.factData) {
        console.log("⏳ Status: Initializing Legal Entity mapping");
        state.mappings.legalEntity = buildLegalEntityMapping(state.dimensions.le, state.factData);
        
        console.log("✅ Status: Legal Entity Mapping initialized with", 
            Object.keys(state.mappings.legalEntity.leToDetails || {}).length, "entities mapped");
    } else {
        console.warn("Cannot initialize legal entity mapping: missing dimension or fact data");
    }
    
    // 2. Initialize cost element mapping
    if (state.dimensions && state.dimensions.cost_element && state.factData) {
        console.log("⏳ Status: Initializing Cost Element mapping");
        state.mappings.costElement = buildCostElementMapping(state.dimensions.cost_element, state.factData);
        
        console.log("✅ Status: Cost Element Mapping initialized with", 
            Object.keys(state.mappings.costElement.costElementToDetails || {}).length, "elements mapped");
    } else {
        console.warn("Cannot initialize cost element mapping: missing dimension or fact data");
    }
    
    // 3. Initialize smart code mapping
    if (state.dimensions && state.dimensions.smartcode && state.factData) {
        console.log("⏳ Status: Initializing Smart Code mapping");
        state.mappings.smartCode = buildSmartCodeMapping(state.dimensions.smartcode, state.factData);
        
        console.log("✅ Status: Smart Code Mapping initialized with", 
            Object.keys(state.mappings.smartCode.smartCodeToDetails || {}).length, "smart codes mapped");
    } else {
        console.warn("Cannot initialize smart code mapping: missing dimension or fact data");
    }
    
    // 4. Initialize GMID display mapping - FIXED to correctly map to COMPONENT_GMID
    if (state.dimensions && state.dimensions.gmid_display && state.factData) {
        console.log("⏳ Status: Initializing GMID Display mapping");
        state.mappings.gmidDisplay = buildGmidDisplayMapping(state.dimensions.gmid_display, state.factData);
        
        console.log("✅ Status: GMID Display Mapping initialized with", 
            Object.keys(state.mappings.gmidDisplay.gmidToDisplay || {}).length, "GMIDs mapped");
    } else {
        console.warn("Cannot initialize GMID display mapping: missing dimension or fact data");
    }

    // 5. Initialize ITEM_COST_TYPE mapping
    if (state.dimensions && state.dimensions.item_cost_type && state.factData) {
        console.log("⏳ Status: Initializing ITEM_COST_TYPE mapping");
        state.mappings.itemCostType = buildItemCostTypeMapping(state.dimensions.item_cost_type, state.factData);
        
        console.log("✅ Status: ITEM_COST_TYPE Mapping initialized with", 
            Object.keys(state.mappings.itemCostType.costTypeToDetails || {}).length, "item cost types mapped");
    } else {
        console.warn("Cannot initialize item cost type mapping: missing dimension or fact data");
    }

    // 6. Initialize MATERIAL_TYPE mapping
    if (state.dimensions && state.dimensions.material_type && state.factData) {
        console.log("⏳ Status: Initializing MATERIAL_TYPE mapping");
        state.mappings.materialType = buildMaterialTypeMapping(state.dimensions.material_type, state.factData);
        
        console.log("✅ Status: MATERIAL_TYPE Mapping initialized with", 
            Object.keys(state.mappings.materialType.materialTypeToDetails || {}).length, "material types mapped");
    } else {
        console.warn("Cannot initialize material type mapping: missing dimension or fact data");
    }

    // 7. Initialize ZYEAR mapping
    if (state.dimensions && state.dimensions.year && state.factData) {
        console.log("⏳ Status: Initializing YEAR mapping");
        state.mappings.year = buildBusinessYearMapping(state.dimensions.year, state.factData);
        
        console.log("✅ Status: ZYEAR Mapping initialized with", 
            Object.keys(state.mappings.year.yearToDetails || {}).length, "year entries mapped");
    } else {
        console.warn("Cannot initialize year mapping: missing dimension or fact data");
    }

    // 8. Initialize MC mapping
    if (state.dimensions && state.dimensions.mc && state.factData) {
        console.log("⏳ Status: Initializing MC mapping");
        state.mappings.managementCentre = buildManagementCentreMapping(state.dimensions.mc, state.factData);
        
        console.log("✅ Status: MC Mapping initialized with", 
            Object.keys(state.mappings.managementCentre.mcToDetails || {}).length, "MCs mapped");
    } else {
        console.warn("Cannot initialize MC mapping: missing dimension or fact data");
    }
        
    // 7. Add integrity checks to verify mappings are working
    verifyFactDimensionMappings();
    
    console.log("✅ Status: All mappings initialized successfully");
}


/**
 * Verify that fact records can be properly joined with dimensions
 * This helps diagnose mapping issues
 */
function verifyFactDimensionMappings() {
    console.log("⏳ Status: Starting fact dimension mapping verification...");
    
    // Enhanced safety checks for state and factData
    if (!state) {
        console.warn("⚠️ Warning: Application state not available for mapping verification");
        return;
    }
    
    if (!state.factData || !Array.isArray(state.factData) || state.factData.length === 0) {
        console.warn("⚠️ Warning: No fact data available for mapping verification");
        return;
    }
    
    const sampleSize = Math.min(10, state.factData.length);
    const sampleRecords = state.factData.slice(0, sampleSize);
    
    console.log(`📊 Verifying mappings with ${sampleSize} sample records...`);
    
    // Check legal entity mapping with enhanced safety
    if (state.mappings && state.mappings.legalEntity && state.mappings.legalEntity.leToDetails) {
        try {
            let leMatches = 0;
            sampleRecords.forEach((record, index) => {
                if (record && typeof record === 'object' && record.LE) {
                    try {
                        if (state.mappings.legalEntity.leToDetails[record.LE]) {
                            leMatches++;
                        }
                    } catch (accessError) {
                        console.warn(`⚠️ Warning: Error accessing LE mapping for record ${index}:`, accessError);
                    }
                }
            });
            
            console.log(`✅ Status: Legal Entity mapping: ${leMatches}/${sampleSize} records have matching LE codes`);
        } catch (error) {
            console.error("❌ Error verifying Legal Entity mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Legal Entity mapping not available for verification");
    }
    
    // Check cost element mapping with enhanced safety
    if (state.mappings && state.mappings.costElement && state.mappings.costElement.costElementToDetails) {
        try {
            let ceMatches = 0;
            sampleRecords.forEach((record, index) => {
                if (record && typeof record === 'object' && record.COST_ELEMENT) {
                    try {
                        if (state.mappings.costElement.costElementToDetails[record.COST_ELEMENT]) {
                            ceMatches++;
                        }
                    } catch (accessError) {
                        console.warn(`⚠️ Warning: Error accessing Cost Element mapping for record ${index}:`, accessError);
                    }
                }
            });
            
            console.log(`✅ Status: Cost Element mapping: ${ceMatches}/${sampleSize} records have matching COST_ELEMENT`);
        } catch (error) {
            console.error("❌ Error verifying Cost Element mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Cost Element mapping not available for verification");
    }
    
    // Check smart code mapping with enhanced safety
    if (state.mappings && state.mappings.smartCode && state.mappings.smartCode.smartCodeToDetails) {
        try {
            let scMatches = 0;
            sampleRecords.forEach((record, index) => {
                if (record && typeof record === 'object' && record.ROOT_SMARTCODE) {
                    try {
                        if (state.mappings.smartCode.smartCodeToDetails[record.ROOT_SMARTCODE]) {
                            scMatches++;
                        }
                    } catch (accessError) {
                        console.warn(`⚠️ Warning: Error accessing Smart Code mapping for record ${index}:`, accessError);
                    }
                }
            });
            
            console.log(`✅ Status: Smart Code mapping: ${scMatches}/${sampleSize} records have matching ROOT_SMARTCODE`);
        } catch (error) {
            console.error("❌ Error verifying Smart Code mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Smart Code mapping not available for verification");
    }
    
    // FIXED: Check GMID mapping using PATH_GMID ONLY with comprehensive safety
    if (state.mappings && state.mappings.gmidDisplay && state.mappings.gmidDisplay.pathGmidToDisplay) {
        try {
            let gmidMatches = 0;
            let problemRecords = [];
            
            sampleRecords.forEach((record, index) => {
                // Enhanced safety checks for each record
                if (!record || typeof record !== 'object') {
                    console.warn(`⚠️ Warning: Invalid record at index ${index}:`, record);
                    return;
                }
                
                const pathGmid = record.PATH_GMID;
                
                // Check if PATH_GMID exists and is valid
                if (!pathGmid || typeof pathGmid !== 'string' || pathGmid.trim() === '') {
                    console.warn(`⚠️ Warning: Record ${index} has invalid PATH_GMID:`, pathGmid);
                    return;
                }
                
                try {
                    // Safely access the mapping object
                    const mappingObj = state.mappings.gmidDisplay.pathGmidToDisplay;
                    
                    // Check if the mapping object exists and has the property
                    if (mappingObj && typeof mappingObj === 'object' && mappingObj.hasOwnProperty(pathGmid)) {
                        const mapping = mappingObj[pathGmid];
                        if (mapping && typeof mapping === 'object') {
                            gmidMatches++;
                        } else {
                            console.warn(`⚠️ Warning: Mapping for PATH_GMID "${pathGmid}" exists but is invalid:`, mapping);
                        }
                    } else {
                        problemRecords.push({
                            index: index,
                            pathGmid: pathGmid,
                            reason: 'No mapping found'
                        });
                    }
                } catch (accessError) {
                    console.error(`❌ Error accessing GMID mapping for record ${index} with PATH_GMID "${pathGmid}":`, accessError);
                    problemRecords.push({
                        index: index,
                        pathGmid: pathGmid,
                        reason: 'Access error',
                        error: accessError.message
                    });
                }
            });
            
            console.log(`✅ Status: GMID mapping: ${gmidMatches}/${sampleSize} records have matching PATH_GMID`);
            
            // Log problem records if any
            if (problemRecords.length > 0) {
                console.warn(`⚠️ Warning: ${problemRecords.length} records had GMID mapping issues:`);
                problemRecords.slice(0, 3).forEach(prob => {
                    console.warn(`  Record ${prob.index}: PATH_GMID="${prob.pathGmid}" - ${prob.reason}`);
                });
            }
            
            // Log sample successful mappings
            console.log("📋 Sample PATH_GMID mappings (successful):");
            let successCount = 0;
            sampleRecords.forEach((record, index) => {
                if (successCount >= 3) return; // Only show first 3 successful ones
                
                if (record && record.PATH_GMID && 
                    state.mappings.gmidDisplay.pathGmidToDisplay[record.PATH_GMID]) {
                    
                    const mapping = state.mappings.gmidDisplay.pathGmidToDisplay[record.PATH_GMID];
                    console.log(`  Record ${index + 1}: PATH_GMID="${record.PATH_GMID}" -> Display="${mapping.display || 'N/A'}"`);
                    successCount++;
                }
            });
            
        } catch (error) {
            console.error("❌ Error verifying GMID mapping:", error);
            
            // Detailed debugging for GMID mapping structure
            console.log("🔍 Debug: GMID mapping structure analysis:");
            try {
                const gmidMapping = state.mappings.gmidDisplay;
                console.log("  - gmidDisplay object exists:", !!gmidMapping);
                
                if (gmidMapping) {
                    console.log("  - pathGmidToDisplay exists:", !!gmidMapping.pathGmidToDisplay);
                    console.log("  - pathGmidToDisplay type:", typeof gmidMapping.pathGmidToDisplay);
                    
                    if (gmidMapping.pathGmidToDisplay) {
                        const keys = Object.keys(gmidMapping.pathGmidToDisplay);
                        console.log("  - Number of mappings:", keys.length);
                        console.log("  - Sample keys:", keys.slice(0, 3));
                    }
                }
            } catch (debugError) {
                console.error("❌ Error in debug analysis:", debugError);
            }
        }
    } else {
        console.log("ℹ️ Info: GMID Display mapping not available for verification");
        
        // Check what's actually available
        console.log("🔍 Debug: Available mappings:");
        if (state.mappings) {
            console.log("  Available mapping types:", Object.keys(state.mappings));
            if (state.mappings.gmidDisplay) {
                console.log("  GMID Display mapping keys:", Object.keys(state.mappings.gmidDisplay));
            }
        } else {
            console.log("  No mappings object found in state");
        }
    }
    
    // Continue with other mappings...
    
    // Check item cost type mapping
    if (state.mappings && state.mappings.itemCostType && state.mappings.itemCostType.costTypeToDetails) {
        try {
            let ictMatches = 0;
            sampleRecords.forEach((record) => {
                if (record && record.ITEM_COST_TYPE && 
                    state.mappings.itemCostType.costTypeToDetails[record.ITEM_COST_TYPE]) {
                    ictMatches++;
                }
            });
            
            console.log(`✅ Status: Item Cost Type mapping: ${ictMatches}/${sampleSize} records have matching ITEM_COST_TYPE`);
        } catch (error) {
            console.error("❌ Error verifying Item Cost Type mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Item Cost Type mapping not available for verification");
    }
    
    // Check material type mapping
    if (state.mappings && state.mappings.materialType && state.mappings.materialType.materialTypeToDetails) {
        try {
            let mtMatches = 0;
            sampleRecords.forEach((record) => {
                if (record && record.COMPONENT_MATERIAL_TYPE && 
                    state.mappings.materialType.materialTypeToDetails[record.COMPONENT_MATERIAL_TYPE]) {
                    mtMatches++;
                }
            });
            
            console.log(`✅ Status: Material Type mapping: ${mtMatches}/${sampleSize} records have matching COMPONENT_MATERIAL_TYPE`);
        } catch (error) {
            console.error("❌ Error verifying Material Type mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Material Type mapping not available for verification");
    }

    // Check mc mapping
    if (state.mappings && state.mappings.managementCentre && state.mappings.managementCentre.mcToDetails) {
        try {
            let mcMatches = 0;
            sampleRecords.forEach((record) => {
                if (record && record.MC && 
                    state.mappings.managementCentre.mcToDetails[record.MC]) {
                    mcMatches++;
                }
            });
            
            console.log(`✅ Status: MC mapping: ${mcMatches}/${sampleSize} records have matching MC`);
        } catch (error) {
            console.error("❌ Error verifying MC mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: MC mapping not available for verification");
    }

    // Check year mapping
    if (state.mappings && state.mappings.year && state.mappings.year.yearToDetails) {
        try {
            let yrMatches = 0;
            sampleRecords.forEach((record) => {
                if (record && record.ZYEAR && 
                    state.mappings.year.yearToDetails[record.ZYEAR]) {
                    yrMatches++;
                }
            });
            
            console.log(`✅ Status: ZYEAR mapping: ${yrMatches}/${sampleSize} records have matching ZYEAR`);
        } catch (error) {
            console.error("❌ Error verifying Year mapping:", error);
        }
    } else {
        console.log("ℹ️ Info: Year mapping not available for verification");
    }
    
    console.log("✅ Status: Fact dimension mapping verification completed");
}


/**
 * Enhanced version of filterDataByMultipleDimensions that uses the new mappings
 * 
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
 * Creates a simplified path hierarchy configuration that uses
 * path segments as labels for ALL nodes (root, internal, and leaf)
 * 
 * @param {Object} options - Configuration options
 * @param {string} [options.pathField='PATH'] - Field name containing the path
 * @param {string} [options.idField='ID'] - Field name containing the unique ID
 * @param {string} [options.pathSeparator='//'] - Separator used in the path strings
 * @param {Array} [options.data] - Optional data array to analyze
 * @returns {Object} - Configuration object for buildPathHierarchy
 */
function createPathSegmentLabelConfig({
  pathField = 'PATH',
  idField = 'ID', 
  displayField = null,
  pathSeparator = '//',
  data = null
} = {}) {
  // Validate inputs
  if (!pathField) throw new Error('pathField is required');
  if (!idField) throw new Error('idField is required');
  
  // Determine hierarchy type and root label if data is provided
  let isFlat = false;
  let dynamicRootLabel = null;
  
  if (data && Array.isArray(data) && data.length > 0) {
    // Find all unique first level segments
    const firstLevelSegments = new Set();
    let hasValidPaths = false;
    
    data.forEach(item => {
      if (item && item[pathField]) {
        const path = item[pathField];
        
        if (typeof path === 'string' && path.includes(pathSeparator)) {
          hasValidPaths = true;
          const segments = path.split(pathSeparator).filter(s => s.trim() !== '');
          if (segments.length > 0) {
            firstLevelSegments.add(segments[0]);
          }
        }
      }
    });
    
    // If no valid paths found, treat as flat data
    isFlat = !hasValidPaths;
    
    // Determine dynamic root label from data
    if (firstLevelSegments.size === 1) {
      // Single hierarchical root - use the segment name
      dynamicRootLabel = Array.from(firstLevelSegments)[0];
    } else if (isFlat) {
      // Flat data - determine label from dimension type
      dynamicRootLabel = determineFlatRootLabel(data, idField, displayField);
    } else {
      // Multiple hierarchical roots - use first one or create generic
      dynamicRootLabel = Array.from(firstLevelSegments)[0] || determineFlatRootLabel(data, idField, displayField);
    }
    
    console.log(`Path analysis: isFlat=${isFlat}, uniqueFirstSegments=${firstLevelSegments.size}, dynamicRootLabel="${dynamicRootLabel}"`);
  }
  
  return {
    // Function to extract the path from an item
    getPath: item => item[pathField],
    
    // Function to get the leaf node ID 
    getLeafId: item => item[idField],
    
    // Use displayField for leaf labels when provided
    getLeafLabel: displayField ? (item => item[displayField] || item[idField]) : null,
    
    // Function to determine if a node is a leaf
    isLeafNode: (item, level, totalLevels) => level === totalLevels - 1,
    
    // Separator for path splitting
    pathSeparator: pathSeparator,
    
    // Flags
    isFlat: isFlat,
    
    // Use path segments for labels (but override for leaves if displayField provided)
    usePathSegmentsForLabels: true,
    
    // Store the display field and dynamic root label
    displayField: displayField,
    dynamicRootLabel: dynamicRootLabel
  };
}


/**
 * Builds a path hierarchy with segment labels for all nodes
 * This implementation ensures path segments are always used as labels
 * 
 * @param {Array} data - The data to process
 * @param {Object} config - The configuration object
 * @returns {Object} - The hierarchy structure
 */
function buildPathHierarchyWithSegmentLabels(data, config) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("No data provided or empty data array");
        return { 
            root: null, 
            roots: [], 
            nodesMap: {}, 
            flatData: [],
            isEmpty: true
        };
    }
    
    console.log(`⏳ Status: Processing ${data.length} rows of data with alphabetical sorting...`);
    
    // Merge with default config
    const defaultConfig = {
        getPath: item => item.PATH,
        getLeafId: item => item.ID,
        pathSeparator: '//',
        forceSeparateRoots: true,
        isFlat: false,
        usePathSegmentsForLabels: true
    };
    const finalConfig = { ...defaultConfig, ...config };
    
    // Handle flat data with dynamic labeling
    if (finalConfig.isFlat) {
        return buildFlatDataHierarchyWithSorting(data, finalConfig);
    }
    
    // Find all unique first level segments
    const firstLevelSegments = new Set();
    data.forEach(item => {
        try {
            const path = finalConfig.getPath(item);
            if (path) {
                const segments = path.split(finalConfig.pathSeparator).filter(s => s.trim() !== '');
                if (segments.length > 0) {
                    firstLevelSegments.add(segments[0]);
                }
            }
        } catch (error) {
            console.warn("Error processing path:", error);
        }
    });
    
    if (firstLevelSegments.size === 0) {
        console.warn("No valid path segments found in data");
        return { 
            root: null, 
            roots: [], 
            nodesMap: {}, 
            flatData: data,
            isEmpty: true
        };
    }
    
    const nodesMap = {};
    let rootNode;
    let skipFirstSegment = false;
    const nodesByPathKey = new Map();

    if (firstLevelSegments.size === 1) {
        // Single hierarchical root - use the actual segment name from data
        const onlySegment = Array.from(firstLevelSegments)[0];
        rootNode = {
            id: 'ROOT',
            label: onlySegment,
            children: [],
            level: 0,
            path: ['ROOT'],
            expanded: false,
            isLeaf: false,
            hasChildren: false
        };
        nodesMap['ROOT'] = rootNode;
        skipFirstSegment = true;
    } else {
        // Multiple hierarchical roots or no clear hierarchy - use dynamic label
        const rootLabel = finalConfig.dynamicRootLabel || 'All Items';
        rootNode = {
            id: 'ROOT',
            label: rootLabel,
            children: [],
            level: 0,
            path: ['ROOT'],
            expanded: false,
            isLeaf: false,
            hasChildren: false
        };
        nodesMap['ROOT'] = rootNode;
    }

    // Process each data item
    data.forEach(item => {
        try {
            if (!item) return;

            const pathString = finalConfig.getPath(item);
            if (!pathString) return;

            const pathSegments = pathString.split(finalConfig.pathSeparator)
                .filter(segment => segment.trim() !== '');

            if (pathSegments.length === 0) return;

            let currentNode = rootNode;
            let currentPath = [...rootNode.path];

            let startIdx = skipFirstSegment ? 1 : 0;

            for (let i = startIdx; i < pathSegments.length; i++) {
                const segment = pathSegments[i];
                if (!segment || segment === "") continue;

                const pathKey = `${currentNode.id}_${segment}`;
                const nodeId = `SEGMENT_${pathKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;

                if (!nodesByPathKey.has(pathKey)) {
                    const isLeafNode = (i === pathSegments.length - 1);
                    
                    // Use proper label for leaf nodes
                    let nodeLabel;
                    if (isLeafNode && finalConfig.getLeafLabel) {
                        nodeLabel = finalConfig.getLeafLabel(item);
                    } else {
                        nodeLabel = segment;
                    }
                    
                    const newNode = {
                        id: nodeId,
                        label: nodeLabel,
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
                    currentNode.children.push(newNode);
                    currentNode.isLeaf = false;
                    currentNode.hasChildren = true;
                    
                    if (isLeafNode) {
                        newNode.data = { ...item };
                    }
                }
                
                const existingNodeId = nodesByPathKey.get(pathKey);
                currentNode = nodesMap[existingNodeId];
                if (!currentNode) break;
                currentPath = [...currentPath, existingNodeId];
            }
        } catch (error) {
            console.warn("Error processing item:", error);
        }
    });
    
    // CRITICAL ADDITION: Sort all hierarchy nodes alphabetically
    sortHierarchyNodesRecursively(rootNode, nodesMap);
    
    const result = {
        root: rootNode,
        roots: [rootNode],
        nodesMap: nodesMap,
        flatData: data,
        isEmpty: false
    };
    
    console.log(`✅ Status: Built sorted hierarchy with root "${rootNode.label}" and ${Object.keys(nodesMap).length} total nodes`);
    
    return result;
}


/**
 * Recursively sorts all nodes in a hierarchy alphabetically by label
 * 
 * @param {Object} node - The node to sort (and its children recursively)
 * @param {Object} nodesMap - Map of all nodes for resolving child references
 */
function sortHierarchyNodesRecursively(node, nodesMap) {
    if (!node || !node.children || !Array.isArray(node.children) || node.children.length === 0) {
        return;
    }
    
    try {
        // Convert children array to objects if they're still IDs
        const childrenObjects = node.children.map(child => {
            if (typeof child === 'string') {
                return nodesMap[child] || { id: child, label: child };
            }
            return child;
        });
        
        // Sort children alphabetically by label (case-insensitive)
        childrenObjects.sort((a, b) => {
            const labelA = (a.label || a.id || '').toString().toLowerCase();
            const labelB = (b.label || b.id || '').toString().toLowerCase();
            return labelA.localeCompare(labelB);
        });
        
        // Update the children array with sorted objects or IDs
        if (typeof node.children[0] === 'string') {
            // If original was array of IDs, keep it as array of IDs
            node.children = childrenObjects.map(child => child.id);
        } else {
            // If original was array of objects, keep it as array of objects
            node.children = childrenObjects;
        }
        
        // Recursively sort children's children
        childrenObjects.forEach(childNode => {
            if (childNode && typeof childNode === 'object') {
                sortHierarchyNodesRecursively(childNode, nodesMap);
            }
        });
        
    } catch (error) {
        console.warn(`Error sorting children for node ${node.id}:`, error);
    }
}


/**
 * Standalone function for building flat dimension hierarchies
 * This function is completely self-contained with no dependencies on other functions
 * 
 * @param {Array} data - The dimension data array
 * @param {string} dimensionName - Name of the dimension (e.g., 'ITEM_COST_TYPE')
 * @param {string} idField - Field name containing the ID value (e.g., 'ITEM_COST_TYPE')
 * @param {string} labelField - Field name containing the label/description value (e.g., 'DIM_ITEM_COST_TYPE')
 * @returns {Object} - Complete hierarchy object
 */
function buildStandaloneFlatHierarchy(data, dimensionName, idField, labelField) {
    // Validate inputs and provide defaults
    if (!data || !Array.isArray(data)) {
        console.warn(`buildStandaloneFlatHierarchy: Invalid data input for ${dimensionName}`);
        data = [];
    }
    
    dimensionName = dimensionName || 'DIMENSION';
    idField = idField || 'ID';
    labelField = labelField || idField;
    
    console.log(`⏳ Status: Building standalone flat hierarchy for ${dimensionName} with ${data.length} records`);
    
    // CRITICAL FIX: Always use 'ROOT' as the root node ID
    const rootId = 'ROOT';
    const rootNode = {
        id: rootId,
        label: `All ${dimensionName.replace(/_/g, ' ')}`,
        children: [],
        level: 0,
        path: [rootId],
        expanded: false,
        isLeaf: false,
        hasChildren: false
    };
    
    // Create nodesMap with root node
    const nodesMap = {
        [rootId]: rootNode
    };
    
    // Set to track unique values (avoid duplicates)
    const processedValues = new Set();
    
    // Process each data item
    (data || []).forEach(item => {
        try {
            // Skip invalid items or already processed values
            if (!item) return;
            
            // Get ID value (use a default if missing)
            const idValue = item[idField] !== undefined ? item[idField] : 
                            (item.ID !== undefined ? item.ID : null);
            
            // Skip items with no ID
            if (idValue === null || idValue === undefined) return;
            
            // Convert to string for consistent handling
            const idValueStr = String(idValue);
            
            // Skip if we've already processed this value
            if (processedValues.has(idValueStr)) return;
            processedValues.add(idValueStr);
            
            // Get label value (fallback to ID if missing)
            const labelValue = item[labelField] !== undefined ? item[labelField] : idValueStr;
            
            // Create node ID - FIXED: Use consistent naming
            const safeId = idValueStr.replace(/[^a-zA-Z0-9_]/g, '_');
            const nodeId = `${dimensionName}_${safeId}`;
            
            // Create child node
            const childNode = {
                id: nodeId,
                label: labelValue,
                children: [],
                level: 1,
                path: [rootId, nodeId],
                expanded: false,
                isLeaf: true,
                hasChildren: false,
                factId: idValue,
                data: item
            };
            
            // Add to nodesMap
            nodesMap[nodeId] = childNode;
            
            // Add to root's children array directly (not just the ID)
            rootNode.children.push(childNode);
        } catch (error) {
            console.warn(`Error processing item in ${dimensionName}:`, error);
        }
    });
    
    // Update root properties
    rootNode.hasChildren = rootNode.children.length > 0;
    
    // Sort children alphabetically
    try {
        rootNode.children.sort((a, b) => {
            const labelA = String(a.label || '').toLowerCase();
            const labelB = String(b.label || '').toLowerCase();
            return labelA.localeCompare(labelB);
        });
    } catch (error) {
        console.warn(`Error sorting ${dimensionName} nodes:`, error);
    }
    
    // Convert children array to array of IDs for compatibility
    const childrenIds = rootNode.children.map(child => child.id);
    rootNode.childrenIds = childrenIds;  // Store reference to IDs
    
    console.log(`✅ Status: Created ${dimensionName} hierarchy with ${rootNode.children.length} items`);
    
    // Return complete hierarchy
    return {
        root: rootNode,
        roots: [rootNode],
        nodesMap: nodesMap,
        flatData: data || [],
        isFlat: true
    };
}


/**
 * Builds a Legal Entity hierarchy using path segments as labels for all nodes
 * @param {Array} data - Legal entity dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildLegalEntityHierarchy(data) {
    console.log(`⏳ Status: Building Legal Entity hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'LE',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined from the data
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: Legal Entity hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


/**
 * Builds a Smart Code hierarchy using path segments as labels for all nodes
 * @param {Array} data - Smart code dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildSmartCodeHierarchy(data) {
    console.log(`⏳ Status: Building SmartCode hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'SMARTCODE',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined from the data
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: SmartCode hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


/**
 * Builds a Management Centre hierarchy using path segments as labels for all nodes
 * @param {Array} data - Management centre dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildManagementCentreHierarchy(data) {
    console.log(`⏳ Status: Building Management Centre hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection for hierarchical MC data
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'MC',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: Management Centre hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


/**
 * Builds a Cost Element hierarchy using path segments as labels for all nodes
 * @param {Array} data - Cost element dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildCostElementHierarchy(data) {
    console.log(`⏳ Status: Building COST_ELEMENT hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'COST_ELEMENT',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined from the data
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: COST_ELEMENT hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


/**
 * Builds a GMID Display hierarchy using path segments as labels for all nodes
 * @param {Array} data - GMID display dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildGmidDisplayHierarchy(data) {
    console.log(`⏳ Status: Building GMID Display hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'DISPLAY',
        idField: 'PATH_GMID',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined from the data
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: GMID Display hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


function buildItemCostTypeHierarchy(data) {
    console.log(`⏳ Status: Building ITEM_COST_TYPE hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'ITEM_COST_TYPE',
        displayField: 'ITEM_COST_TYPE_DESC',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined dynamically
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: ITEM_COST_TYPE hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


function buildMaterialTypeHierarchy(data) {
    console.log(`⏳ Status: Building MATERIAL_TYPE hierarchy from ${data?.length || 0} records...`);
    
    // Use dynamic root label detection
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'MATERIAL_TYPE',
        displayField: 'MATERIAL_TYPE_DESC',
        pathSeparator: '//',
        data: data
    });
    // Don't set rootLabel - let it be determined dynamically
    
    // Build hierarchy with dynamic labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: MATERIAL_TYPE hierarchy built with dynamic root label: "${hierarchy.root?.label}"`);
    return hierarchy;
}


function buildBusinessYearHierarchy(data) {
    const hierarchy = buildStandaloneFlatHierarchy(
        data, 
        'YEAR',
        'YEAR',
        'YEAR'
    );
    
    // The buildStandaloneFlatHierarchy now ensures ROOT ID consistency
    return hierarchy;
}


// Helper function for sorting hierarchy nodes
function sortHierarchyNodes(node) {
    if (!node) {
        console.warn("Cannot sort null node");
        return;
    }
    
    // Use the new recursive sorting function
    sortHierarchyNodesRecursively(node, { [node.id]: node });
}


/**
 * Sort all hierarchies in the state alphabetically
 */
function sortAllHierarchiesAlphabetically() {
    if (!state.hierarchies) {
        console.warn("No hierarchies found in state");
        return;
    }
    
    console.log("⏳ Status: Sorting all hierarchies alphabetically...");
    
    Object.keys(state.hierarchies).forEach(hierarchyName => {
        const hierarchy = state.hierarchies[hierarchyName];
        if (hierarchy && hierarchy.root && hierarchy.nodesMap) {
            try {
                sortHierarchyNodesRecursively(hierarchy.root, hierarchy.nodesMap);
                console.log(`✅ Status: Sorted hierarchy: ${hierarchyName}`);
            } catch (error) {
                console.warn(`Error sorting hierarchy ${hierarchyName}:`, error);
            }
        }
    });
    
    console.log("✅ Status: All hierarchies sorted alphabetically");
}


/**
 * Fixed processDimensionHierarchies function for js
 * Properly uses factData to build GMID_DISPLAY hierarchy
 * 
 * @param {Object} dimensions - Object containing arrays of data for each dimension
 * @param {Array} factData - Object containing arrays of fact table data
 * @returns {Object} - Object containing processed hierarchies for each dimension
 */
function processDimensionHierarchies(dimensions){ 
    const hierarchies = {};
    
    try {
        // Process legal entity hierarchy
        if (dimensions && dimensions.le && dimensions.le.length > 0) {
            try {
                hierarchies.le = buildLegalEntityHierarchy(dimensions.le);
                // Precompute descendant factIds for legal entity hierarchy
                precomputeDescendantFactIds(hierarchies.le, 'LE');
            } catch (error) {
                console.error("❌ Error building legal entity hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.le = createFallbackHierarchy("Legal Entities", "LE_ROOT");
            }
        }
        
        // Process cost element hierarchy
        if (dimensions && dimensions.cost_element && dimensions.cost_element.length > 0) {
            try {
                hierarchies.cost_element = buildCostElementHierarchy(dimensions.cost_element);
                // Precompute descendant factIds for cost element hierarchy
                precomputeDescendantFactIds(hierarchies.cost_element, 'COST_ELEMENT');
            } catch (error) {
                console.error("❌ Error building cost element hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.cost_element = createFallbackHierarchy("Cost Elements", "COST_ELEMENT_ROOT");
            }
        }
        
        // Process smart code hierarchy
        if (dimensions && dimensions.smartcode && dimensions.smartcode.length > 0) {
            try {
                hierarchies.smartcode = buildSmartCodeHierarchy(dimensions.smartcode);
                // Precompute descendant factIds for smart code hierarchy
                precomputeDescendantFactIds(hierarchies.smartcode, 'ROOT_SMARTCODE');
            } catch (error) {
                console.error("❌ Error building smart code hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.smartcode = createFallbackHierarchy("Smart Codes", "SMARTCODE_ROOT");
            }
        }

        // Process MC hierarchy
        if (dimensions && dimensions.mc && dimensions.mc.length > 0) {
            try {
                hierarchies.mc = buildManagementCentreHierarchy(dimensions.mc);
                // Precompute descendant factIds for management_center hierarchy
                precomputeDescendantFactIds(hierarchies.mc, 'MC');
            } catch (error) {
                console.error("❌ Error building management center hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.mc = createFallbackHierarchy("Management Centers", "MC_ROOT");
            }
        }

        // Process ITEM_COST_TYPE hierarchy
        if (dimensions && dimensions.item_cost_type && dimensions.item_cost_type.length > 0) {
            try {
                hierarchies.item_cost_type = buildItemCostTypeHierarchy(dimensions.item_cost_type);
                // Precompute descendant factIds for management_center hierarchy
                precomputeDescendantFactIds(hierarchies.item_cost_type, 'ITEM_COST_TYPE');
            } catch (error) {
                console.error("❌ Error building item cost type hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.item_cost_type = createFallbackHierarchy("Item Cost Types", "ITEM_COST_TYPE_ROOT");
            }
        }

        // Process MATERIAL_TYPE hierarchy
        if (dimensions && dimensions.material_type && dimensions.material_type.length > 0) {
            try {
                hierarchies.material_type = buildMaterialTypeHierarchy(dimensions.material_type);
                // Precompute descendant factIds for management_center hierarchy
                precomputeDescendantFactIds(hierarchies.material_type, 'MATERIAL_TYPE');
            } catch (error) {
                console.error("❌ Error building material type hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.material_type = createFallbackHierarchy("Material Types", "MATERIAL_TYPE_ROOT");
            }
        }

        // Process YEAR hierarchy
        if (dimensions && dimensions.year && dimensions.year.length > 0) {
            try {
                // Build YEAR hierarchy with the original function signature
                hierarchies.year = buildBusinessYearHierarchy(dimensions.year);
                // Precompute descendant factIds for YEAR hierarchy
                precomputeDescendantFactIds(hierarchies.year, 'ZYEAR');
            } catch (error) {
                console.error("❌ Error building year hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.year = createFallbackHierarchy("Years", "YEAR_ROOT");
            }
        }

        // Process GMID hierarchy
        if (dimensions && dimensions.gmid_display && dimensions.gmid_display.length > 0) {
            try {
                // Build GMID hierarchy with the original function signature
                hierarchies.gmid_display = buildGmidDisplayHierarchy(dimensions.gmid_display);
                // Precompute descendant factIds for GMID hierarchy
                precomputeDescendantFactIds(hierarchies.gmid_display, 'PATH_GMID');
            } catch (error) {
                console.error("❌ Error building GMID display hierarchy:", error);
                // Create fallback hierarchy
                hierarchies.gmid_display = createFallbackHierarchy("GMID Display", "GMID_DISPLAY_ROOT");
            }
        }
    } catch (error) {
        console.error("❌ Error in processDimensionHierarchies:", error);
    }
    
    console.log("✅ Status: New hierarchies built:", Object.keys(hierarchies));
    return hierarchies;
}


/**
 * Creates a fallback hierarchy when a regular hierarchy build fails
 * This ensures we always have a valid hierarchy structure
 * 
 * @param {string} label - Label for the root node
 * @param {string} rootId - ID for the root node
 * @returns {Object} - A minimal valid hierarchy object
 */
function createFallbackHierarchy(label, rootId) {
    // Create a simple root node
    const rootNode = {
        id: rootId,
        label: label,
        children: [],
        level: 0,
        path: [rootId],
        expanded: false,
        isLeaf: false,
        hasChildren: false
    };
    
    // Create the nodes map with just the root
    const nodesMap = {
        [rootId]: rootNode
    };
    
    // Return a valid hierarchy structure
    return {
        root: rootNode,
        roots: [rootNode],
        nodesMap: nodesMap,
        flatData: [],
        isEmpty: false
    };
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
 * Converts a hierarchical structure to a flat array of nodes
 * Used for rendering and processing hierarchies
 * 
 * @param {Object} node - The root node to start from
 * @param {Array} result - Array to collect flattened nodes (for recursion)
 * @param {number} level - Current level in the hierarchy (for recursion)
 * @param {Array} parentPath - Path from root to parent (for recursion)
 * @returns {Array} - Flattened array of nodes with hierarchy information
 */
function flattenHierarchy(node) {
    if (!node) return [];
    
    // Create current path
    const result = [node];
    
    // Process children if they exist and node is expanded
    if (node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            // Is child a string ID or an object?
            const childNode = typeof childId === 'string' ? findNodeById(childId) : childId;

            if(childNode){
                result.push(...flattenHierarchy(childNode));
            } else {
                // console.warn(`Child node ID ${childId} not found in nodesMap`);
            }

        });
    }
    
    return result;
}


/**
 * Improved findNodeById that safely searches through all hierarchies
 * @param {string} nodeId - ID of the node to find
 * @returns {Object|null} - The found node or null if not found
 */
function findNodeById(nodeId) {
    if (!nodeId) return null;
    
    // Safety checks for state object
    if (!state || !state.hierarchies) return null;
    
    try {
        // Search all hierarchies for the node
        for (const hierarchyName in state.hierarchies) {
            const hierarchy = state.hierarchies[hierarchyName];
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[nodeId]) {
                return hierarchy.nodesMap[nodeId];
            }
        }
    } catch (error) {
        console.warn("Error in findNodeById:", error);
    }
    
    return null;
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
        
        console.log(`⏳ Status: Preserving hierarchy structure for ${dimField} in column zone`);
        
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
    
    // console.log(`Precomputing descendant factIds for hierarchy using ${factIdField}`);
    
    // Special case for GMID hierarchy - ensure we're handling it differently
    const isGmidHierarchy = factIdField === 'PATH_GMID';
    
    // Get all nodes from the hierarchy
    const nodes = Object.values(hierarchy.nodesMap);
    // console.log(`Processing ${nodes.length} nodes in hierarchy`);
    
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
    
    // console.log(`Hierarchy has ${maxLevel + 1} levels (0 to ${maxLevel})`);
    
    // Process from bottom to top, starting with leaf nodes
    for (let level = maxLevel; level >= 0; level--) {
        // console.log(`Processing level ${level} with ${nodesByLevel[level]?.length || 0} nodes`);
        
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
    
    // Verify that we have different distributions of descendantFactIds
    const factIdCounts = {};
    let nodesWithDescendants = 0;
    
    Object.values(hierarchy.nodesMap).forEach(node => {
        if (node.descendantFactIds && node.descendantFactIds.length > 0) {
            nodesWithDescendants++;
            const count = node.descendantFactIds.length;
            factIdCounts[count] = (factIdCounts[count] || 0) + 1;
        }
    });
    
    // console.log(`Nodes with descendantFactIds: ${nodesWithDescendants} of ${nodes.length}`);
    
    // Log distribution of descendantFactIds counts
    const countEntries = Object.entries(factIdCounts)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    console.log("✅ Status: Descendant factIds precomputation complete");
}


/**
 * Filter records based on legal entity hierarchy
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


function buildGmidDisplayMapping(gmidDisplayData, bomData) {
    console.log("⏳ Status: Building GMID Display mapping with PATH_GMID as the ONLY primary key");
    
    // Create mapping object - REMOVED all COMPONENT_GMID references
    const mapping = {
        // Maps PATH_GMID to display information (PRIMARY and ONLY mapping)
        pathGmidToDisplay: {},
        
        // Maps any path segment to its display value
        pathSegmentToDisplay: {},
        
        // Maps node IDs to their child PATH_GMIDs
        nodeToChildPathGmids: {},
        
        // Maps node IDs to their descendant PATH_GMIDs (all leaf PATH_GMIDs below)
        nodeToDescendantPathGmids: {},
        
        // Maps node IDs to their parent node ID
        nodeToParent: {},
        
        // Tracks which PATH_GMIDs are used in FACT_BOM
        usedPathGmids: new Set(),
        
        // Tracks PATH_GMID hierarchy levels
        pathGmidLevels: {},
        
        // Maps ROOT_GMID to all its descendant PATH_GMIDs
        rootGmidToPathGmids: {}
    };
    
    // Add safety checks for input data
    if (!Array.isArray(bomData)) {
        console.warn("⚠️ Warning: bomData is not an array, initializing as empty");
        bomData = [];
    }
    
    if (!Array.isArray(gmidDisplayData)) {
        console.warn("⚠️ Warning: gmidDisplayData is not an array, initializing as empty");
        gmidDisplayData = [];
    }
    
    // First pass: Load all PATH_GMIDs from BOM data
    if (bomData && bomData.length > 0) {
        bomData.forEach((row, index) => {
            if (!row || typeof row !== 'object') {
                console.warn(`⚠️ Warning: Invalid row at index ${index}:`, row);
                return;
            }
            
            // ONLY use PATH_GMID - no COMPONENT_GMID references
            const pathGmid = row.PATH_GMID;
            if (pathGmid && typeof pathGmid === 'string' && pathGmid.trim() !== '') {
                mapping.usedPathGmids.add(pathGmid);
                
                // Pre-populate the display mapping with PATH_GMID
                if (!mapping.pathGmidToDisplay[pathGmid]) {
                    mapping.pathGmidToDisplay[pathGmid] = {
                        display: pathGmid,
                        fullPath: pathGmid,
                        level: 0,
                        isFromFactData: true // Flag to indicate this came from fact data
                    };
                }
                
                // Build ROOT_GMID to PATH_GMID mapping
                const rootGmid = row.ROOT_GMID;
                if (rootGmid && typeof rootGmid === 'string' && rootGmid.trim() !== '') {
                    if (!mapping.rootGmidToPathGmids[rootGmid]) {
                        mapping.rootGmidToPathGmids[rootGmid] = new Set();
                    }
                    mapping.rootGmidToPathGmids[rootGmid].add(pathGmid);
                }
            }
        });
    }
    
    console.log(`✅ Status: Loaded ${mapping.usedPathGmids.size} PATH_GMIDs from FACT_BOM data`);
    
    // Second pass: Process the display mappings from dimension data
    if (gmidDisplayData && gmidDisplayData.length > 0) {
        console.log(`⏳ Status: Processing ${gmidDisplayData.length} rows of GMID Display data...`);
        
        gmidDisplayData.forEach((row, index) => {
            if (!row || typeof row !== 'object') {
                console.warn(`⚠️ Warning: Invalid GMID display row at index ${index}:`, row);
                return;
            }
            
            const pathGmid = row.PATH_GMID;
            const displayValue = row.DISPLAY;
            
            // Skip if no PATH_GMID
            if (!pathGmid || typeof pathGmid !== 'string' || pathGmid.trim() === '') {
                console.warn(`⚠️ Warning: Missing or invalid PATH_GMID at index ${index}`);
                return;
            }
            
            // Calculate hierarchy level from PATH_GMID structure
            let pathSegments = [];
            try {
                pathSegments = pathGmid.split('/').filter(s => s && s.trim() !== '');
            } catch (error) {
                console.warn(`⚠️ Warning: Error splitting PATH_GMID "${pathGmid}":`, error);
                pathSegments = [pathGmid];
            }
            
            const level = pathSegments.length;
            
            // Store PATH_GMID level
            mapping.pathGmidLevels[pathGmid] = level;
            
            // Create or update the PATH_GMID display mapping
            const existingMapping = mapping.pathGmidToDisplay[pathGmid];
            mapping.pathGmidToDisplay[pathGmid] = {
                display: (displayValue && typeof displayValue === 'string') ? displayValue : pathGmid,
                fullPath: (displayValue && typeof displayValue === 'string') ? displayValue : pathGmid,
                level: level,
                pathSegments: pathSegments,
                isFromFactData: existingMapping ? existingMapping.isFromFactData : false,
                isFromDimensionData: true
            };
            
            // Process display path to build hierarchy mappings
            if (displayValue && typeof displayValue === 'string' && displayValue.trim() !== '') {
                let displaySegments = [];
                try {
                    displaySegments = displayValue.split('//').filter(s => s && s.trim() !== '');
                } catch (error) {
                    console.warn(`⚠️ Warning: Error splitting DISPLAY "${displayValue}":`, error);
                    displaySegments = [displayValue];
                }
                
                // Map each path segment to its display segment
                for (let i = 0; i < pathSegments.length; i++) {
                    const pathSegment = pathSegments[i];
                    const displaySegment = (i < displaySegments.length) ? displaySegments[i] : pathSegment;
                    
                    if (!pathSegment || typeof pathSegment !== 'string') continue;
                    
                    // Store segment to display mapping
                    mapping.pathSegmentToDisplay[pathSegment] = displaySegment;
                    
                    // Generate node ID for this segment
                    let safeId;
                    try {
                        safeId = pathSegment.replace(/[^a-zA-Z0-9_]/g, '_');
                    } catch (error) {
                        console.warn(`⚠️ Warning: Error creating safe ID for "${pathSegment}":`, error);
                        safeId = `SEGMENT_${i}_${Math.random().toString(36).substr(2, 9)}`;
                    }
                    
                    const nodeId = `SEGMENT_LEVEL_${i+1}_${safeId}`;
                    
                    // Initialize this node's collections
                    if (!mapping.nodeToChildPathGmids[nodeId]) {
                        mapping.nodeToChildPathGmids[nodeId] = new Set();
                        mapping.nodeToDescendantPathGmids[nodeId] = new Set();
                    }
                    
                    // If this is the last segment, add PATH_GMID as a leaf
                    if (i === pathSegments.length - 1) {
                        mapping.nodeToChildPathGmids[nodeId].add(pathGmid);
                    }
                    
                    // Always add PATH_GMID as a descendant of this node
                    mapping.nodeToDescendantPathGmids[nodeId].add(pathGmid);
                    
                    // Set up parent-child relationship with next segment
                    if (i < pathSegments.length - 1) {
                        const nextSegment = pathSegments[i + 1];
                        if (nextSegment && typeof nextSegment === 'string') {
                            let childSafeId;
                            try {
                                childSafeId = nextSegment.replace(/[^a-zA-Z0-9_]/g, '_');
                            } catch (error) {
                                childSafeId = `SEGMENT_${i+1}_${Math.random().toString(36).substr(2, 9)}`;
                            }
                            
                            const childNodeId = `SEGMENT_LEVEL_${i+2}_${childSafeId}`;
                            
                            mapping.nodeToChildPathGmids[nodeId].add(childNodeId);
                            mapping.nodeToParent[childNodeId] = nodeId;
                        }
                    }
                }
            }
        });
    }
    
    // Third pass: Handle PATH_GMIDs that are in fact data but not in dimension data
    const factOnlyPathGmids = Array.from(mapping.usedPathGmids).filter(pathGmid => {
        const mapping_entry = mapping.pathGmidToDisplay[pathGmid];
        return !mapping_entry || 
               !mapping_entry.isFromDimensionData ||
               mapping_entry.display === pathGmid;
    });
    
    if (factOnlyPathGmids.length > 0) {
        console.warn(`Found ${factOnlyPathGmids.length} PATH_GMIDs in fact data but not in dimension data`);
        console.warn("Sample fact-only PATH_GMIDs:", factOnlyPathGmids.slice(0, 5));
        
        // Create basic mappings for fact-only PATH_GMIDs
        factOnlyPathGmids.forEach(pathGmid => {
            if (!pathGmid || typeof pathGmid !== 'string') {
                console.warn(`⚠️ Warning: Invalid fact-only PATH_GMID:`, pathGmid);
                return;
            }
            
            let pathSegments = [];
            try {
                pathSegments = pathGmid.split('/').filter(s => s && s.trim() !== '');
            } catch (error) {
                console.warn(`⚠️ Warning: Error processing fact-only PATH_GMID "${pathGmid}":`, error);
                pathSegments = [pathGmid];
            }
            
            const level = pathSegments.length;
            
            // Update existing mapping or create new one
            const existingMapping = mapping.pathGmidToDisplay[pathGmid];
            mapping.pathGmidToDisplay[pathGmid] = {
                display: pathGmid, // Use PATH_GMID as display when no dimension data
                fullPath: pathGmid,
                level: level,
                pathSegments: pathSegments,
                isFromFactData: true,
                isFromDimensionData: false,
                isFallback: true
            };
            
            mapping.pathGmidLevels[pathGmid] = level;
            
            // Create a node for this PATH_GMID
            const lastSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : pathGmid;
            let safeId;
            try {
                safeId = lastSegment.replace(/[^a-zA-Z0-9_]/g, '_');
            } catch (error) {
                safeId = `FALLBACK_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            const nodeId = `SEGMENT_LEVEL_${level}_${safeId}`;
            
            if (!mapping.nodeToChildPathGmids[nodeId]) {
                mapping.nodeToChildPathGmids[nodeId] = new Set();
                mapping.nodeToDescendantPathGmids[nodeId] = new Set();
            }
            
            mapping.nodeToChildPathGmids[nodeId].add(pathGmid);
            mapping.nodeToDescendantPathGmids[nodeId].add(pathGmid);
        });
    }
    
    // Convert Sets to Arrays for easier consumption
    try {
        for (const key in mapping.nodeToChildPathGmids) {
            if (mapping.nodeToChildPathGmids[key] instanceof Set) {
                mapping.nodeToChildPathGmids[key] = Array.from(mapping.nodeToChildPathGmids[key]);
            }
        }
        
        for (const key in mapping.nodeToDescendantPathGmids) {
            if (mapping.nodeToDescendantPathGmids[key] instanceof Set) {
                mapping.nodeToDescendantPathGmids[key] = Array.from(mapping.nodeToDescendantPathGmids[key]);
            }
        }
        
        // Convert ROOT_GMID mappings to arrays
        for (const rootGmid in mapping.rootGmidToPathGmids) {
            if (mapping.rootGmidToPathGmids[rootGmid] instanceof Set) {
                mapping.rootGmidToPathGmids[rootGmid] = Array.from(mapping.rootGmidToPathGmids[rootGmid]);
            }
        }
        
        if (mapping.usedPathGmids instanceof Set) {
            mapping.usedPathGmids = Array.from(mapping.usedPathGmids);
        }
    } catch (error) {
        console.error("❌ Error converting Sets to Arrays:", error);
    }
    
    // Calculate statistics
    const mappedPathGmids = Object.keys(mapping.pathGmidToDisplay || {}).length;
    const pathMappings = Object.keys(mapping.pathSegmentToDisplay || {}).length;
    const rootGmids = Object.keys(mapping.nodeToChildPathGmids || {}).filter(id => !mapping.nodeToParent[id]).length;
    const fallbackMappings = Object.values(mapping.pathGmidToDisplay || {}).filter(m => m && m.isFallback).length;
    const dimensionDataMappings = Object.values(mapping.pathGmidToDisplay || {}).filter(m => m && m.isFromDimensionData).length;
    
    console.log(`✅ Status: PATH_GMID-only mapping complete:`);
    console.log(`   - ${mappedPathGmids} PATH_GMIDs mapped (PRIMARY KEY)`);
    console.log(`   - ${dimensionDataMappings} from dimension data`);
    console.log(`   - ${fallbackMappings} fallback mappings from fact data only`);
    console.log(`   - ${pathMappings} path segments mapped`);
    console.log(`   - ${rootGmids} root nodes identified`);
    console.log(`   - ${Object.keys(mapping.rootGmidToPathGmids || {}).length} ROOT_GMIDs with descendant PATH_GMIDs`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_LE and FACT_BOM for Legal Entity dimension
 * @param {Array} legalEntityData - Legal entity dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildLegalEntityMapping(legalEntityData, bomData) {
    console.log("⏳ Status: Building Legal Entity mapping with PATH-based structure");
    
    // Create mapping object
    const mapping = {
        // Maps LE code to entity details
        leToDetails: {},
        
        // Maps path segments to LE codes (instead of labels)
        pathToLeCodes: {},
        
        // Maps LE to its path for easier lookups
        leToPaths: {},
        
        // Tracks which LE codes are actually used in FACT_BOM
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
                    // Store the full path to LE mapping
                    mapping.leToPaths[row.LE] = row.PATH;
                    
                    // Process each segment of the path
                    const segments = row.PATH.split('//').filter(s => s.trim() !== '');
                    
                    segments.forEach(segment => {
                        // Initialize if doesn't exist
                        if (!mapping.pathToLeCodes[segment]) {
                            mapping.pathToLeCodes[segment] = new Set();
                        }
                        
                        // Add this LE to the segment's collection
                        mapping.pathToLeCodes[segment].add(row.LE);
                    });
                    
                    // Also handle the special case of the last segment
                    // which might be more specific
                    if (segments.length > 0) {
                        const lastSegment = segments[segments.length - 1];
                        
                        if (!mapping.pathToLeCodes[lastSegment]) {
                            mapping.pathToLeCodes[lastSegment] = new Set();
                        }
                        mapping.pathToLeCodes[lastSegment].add(row.LE);
                    }
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
                    path: 'UNKNOWN/' + row.LE // Create a fallback path
                };
                
                // Add to pathToLeCodes
                if (!mapping.pathToLeCodes['UNKNOWN']) {
                    mapping.pathToLeCodes['UNKNOWN'] = new Set();
                }
                mapping.pathToLeCodes['UNKNOWN'].add(row.LE);
                
                // Add to leToPaths
                mapping.leToPaths[row.LE] = 'UNKNOWN/' + row.LE;
                
                // console.warn(`Added fallback mapping for unmapped LE code: ${row.LE}`);
            }
        });
    }
    
    // console.log(`✅ Status: Legal Entity mapping complete: ${Object.keys(mapping.leToDetails).length} LE codes mapped`);
    // console.log(`✅ Status: ${mapping.usedLeCodes.size} LE codes used in FACT_BOM`);
    
    // Diagnostic info: Check how many FACT_BOM LE codes are mapped
    const mappedLeCodesCount = Array.from(mapping.usedLeCodes).filter(leCode => 
        mapping.leToDetails[leCode]
    ).length;
    
    const mappingCoveragePercent = Math.round((mappedLeCodesCount / mapping.usedLeCodes.size) * 100);
    console.log(`✅ Status: LE mapping coverage: ${mappedLeCodesCount}/${mapping.usedLeCodes.size} (${mappingCoveragePercent}%)`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_MC and FACT_BOM for Legal Entity dimension
 * @param {Array} managementCentreData - Management centre dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildManagementCentreMapping(managementCentreData, bomData) {
    console.log("⏳ Status: Building MC mapping with PATH-based structure");
    
    // Create mapping object
    const mapping = {
        // Maps LE code to entity details
        mcToDetails: {},
        
        // Maps path segments to MC codes (instead of labels)
        pathToMcCodes: {},
        
        // Maps MC to its path for easier lookups
        mcToPaths: {},
        
        // Tracks which LE codes are actually used in FACT_BOM
        usedMcCodes: new Set()
    };
    
    // First pass - build the LE code mappings from dimension data
    if (managementCentreData && managementCentreData.length > 0) {
        managementCentreData.forEach(row => {
            if (row.MC) {
                // Store MC details
                mapping.mcToDetails[row.MC] = {
                    description: row.LE_DESC || row.MC,
                    path: row.PATH || ''
                };
                
                // Store path to LE mapping
                if (row.PATH) {
                    // Store the full path to LE mapping
                    mapping.mcToPaths[row.MC] = row.PATH;
                    
                    // Process each segment of the path
                    const segments = row.PATH.split('//').filter(s => s.trim() !== '');
                    
                    segments.forEach(segment => {
                        // Initialize if doesn't exist
                        if (!mapping.pathToMcCodes[segment]) {
                            mapping.pathToMcCodes[segment] = new Set();
                        }
                        
                        // Add this LE to the segment's collection
                        mapping.pathToMcCodes[segment].add(row.MC);
                    });
                    
                    // Also handle the special case of the last segment
                    // which might be more specific
                    if (segments.length > 0) {
                        const lastSegment = segments[segments.length - 1];
                        
                        if (!mapping.pathToMcCodes[lastSegment]) {
                            mapping.pathToMcCodes[lastSegment] = new Set();
                        }
                        mapping.pathToMcCodes[lastSegment].add(row.MC);
                    }
                }
            }
        });
    }
    
    // Second pass - identify which LE codes are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.MC) {
                mapping.usedMcCodes.add(row.MC);
            }
        });
    }
    
    // Add a direct mapping for any LE codes in FACT_BOM not found in dimension
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.MC && !mapping.mcToDetails[row.MC]) {
                // Create a fallback mapping
                mapping.mcToDetails[row.MC] = {
                    description: row.MC, // Use code as description
                    path: 'UNKNOWN/' + row.MC // Create a fallback path
                };
                
                // Add to pathToLeCodes
                if (!mapping.pathToMcCodes['UNKNOWN']) {
                    mapping.pathToMcCodes['UNKNOWN'] = new Set();
                }
                mapping.pathToMcCodes['UNKNOWN'].add(row.MC);
                
                // Add to leToPaths
                mapping.mcToPaths[row.MC] = 'UNKNOWN/' + row.MC;
                
                // console.warn(`Added fallback mapping for unmapped MC code: ${row.MC}`);
            }
        });
    }
    
    // console.log(`✅ Status: Legal Entity mapping complete: ${Object.keys(mapping.mcToDetails).length} MC codes mapped`);
    // console.log(`✅ Status: ${mapping.usedMcCodes.size} MC codes used in FACT_BOM`);
    
    // Diagnostic info: Check how many FACT_BOM LE codes are mapped
    const mappedMcCodesCount = Array.from(mapping.usedMcCodes).filter(mcCode => 
        mapping.mcToDetails[mcCode]
    ).length;
    
    const mappingCoveragePercent = Math.round((mappedMcCodesCount / mapping.usedMcCodes.size) * 100);
    console.log(`✅ Status: MC mapping coverage: ${mappedMcCodesCount}/${mapping.usedMcCodes.size} (${mappingCoveragePercent}%)`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_COST_ELEMENT and FACT_BOM
 * @param {Array} costElementData - Cost element dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildCostElementMapping(costElementData, bomData) {
    console.log("⏳ Status: Building Cost Element mapping");
    
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
    
    // console.log(`✅ Status: Cost Element mapping complete: ${Object.keys(mapping.costElementToDetails).length} cost elements mapped`);
    // console.log(`✅ Status: ${mapping.usedCostElements.size} cost elements used in FACT_BOM`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_SMART_CODE and FACT_BOM
 * @param {Array} smartCodeData - Smart code dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildSmartCodeMapping(smartCodeData, bomData) {
    console.log("⏳ Status: Building Smart Code mapping");
    
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
    
    // console.log(`✅ Status: Smart Code mapping complete: ${Object.keys(mapping.smartCodeToDetails).length} smart codes mapped`);
    // console.log(`✅ Status: ${mapping.usedSmartCodes.size} smart codes used in FACT_BOM as ROOT_SMARTCODE`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_ITEM_COST_TYPE and FACT_BOM
 * Maps ITEM_COST_TYPE_DESC in dimension table to ITEM_COST_TYPE in fact table
 * 
 * @param {Array} itemCostTypeData - Item cost type dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildItemCostTypeMapping(itemCostTypeData, bomData) {
    console.log("⏳ Status: Building ITEM_COST_TYPE mapping");
    
    // Create mapping object
    const mapping = {
        // Maps cost type to its details
        costTypeToDetails: {},
        
        // Tracks which cost types are used in FACT_BOM
        usedCostTypes: new Set()
    };
    
    // Build the mappings from dimension data
    if (itemCostTypeData && itemCostTypeData.length > 0) {
        itemCostTypeData.forEach(row => {
            if (row.ITEM_COST_TYPE) {
                // Store cost type details
                mapping.costTypeToDetails[row.ITEM_COST_TYPE] = {
                    description: row.COST_TYPE_DESC || row.ITEM_COST_TYPE,
                    code: row.ITEM_COST_TYPE
                };
            }
        });
    }
    
    // Identify which cost types are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.ITEM_COST_TYPE) {
                mapping.usedCostTypes.add(row.ITEM_COST_TYPE);
            }
        });
    }
    
    // console.log(`✅ Status: ITEM_COST_TYPE mapping complete: ${Object.keys(mapping.costTypeToDetails).length} types mapped`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_MATERIAL_TYPE and FACT_BOM
 * @param {Array} data - Material type dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildMaterialTypeMapping(data, bomData) {
    console.log("⏳ Status: Building MATERIAL_TYPE mapping");
    
    // Create mapping object
    const mapping = {
        // Maps material type to its details
        materialTypeToDetails: {},
        
        // Maps from component material type in fact to dimension
        componentMaterialTypeToType: {},
        
        // Tracks which material types are used in FACT_BOM
        usedMaterialTypes: new Set()
    };
    
    // Build the mappings from dimension data
    if (data && data.length > 0) {
        data.forEach(row => {
            if (row.MATERIAL_TYPE) {
                // Store material type details
                mapping.materialTypeToDetails[row.MATERIAL_TYPE] = {
                    description: row.MATERIAL_TYPE_DESC || row.MATERIAL_TYPE,
                    code: row.MATERIAL_TYPE
                };
                
                // Direct mapping for COMPONENT_MATERIAL_TYPE field in fact table
                mapping.componentMaterialTypeToType[row.MATERIAL_TYPE] = row.MATERIAL_TYPE;
            }
        });
    }
    
    // Identify which material types are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.COMPONENT_MATERIAL_TYPE) {
                mapping.usedMaterialTypes.add(row.MATERIAL_TYPE);
            }
        });
    }
    
    // console.log(`✅ Status: MATERIAL_TYPE mapping complete: ${Object.keys(mapping.materialTypeToDetails).length} types mapped`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_MATERIAL_TYPE and FACT_BOM
 * @param {Array} businessYearData - Material type dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
function buildBusinessYearMapping(businessYearData, bomData) {
    console.log("⏳ Status: Building Business Year mapping");
    
    // Create mapping object
    const mapping = {
        // Maps YEAR to detailsn
        yearToDetails: {},

        // Maps ZYEAR in fact_bom to year in dimension
        zyearToYear: {},

        // Tracks which years are used in fact_bom
        usedYears: new Set()
    };
    
    // Build the year mappings from dimension data
    if (businessYearData && businessYearData.length > 0) {
        businessYearData.forEach(row => {
            if (row.YEAR) {
                // Store year details
                mapping.yearToDetails[row.YEAR] = {
                    description: row.YEAR.toString(),
                    year: row.YEAR
                };

                // Year in dimension to ZYear in fact table mapping
                mapping.zyearToYear[row.YEAR] = row.YEAR;
            }
        });
    }
    
    // Identify which years are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.ZYEAR) {
                mapping.usedYears.add(row.YEAR);
            }
        });
    }
    
    // console.log(`✅ Status: YEAR mapping complete: ${Object.keys(mapping.yearToDetails).length} years mapped`);
    // console.log(`✅ Status: ${mapping.usedYears.size} years used in FACT_BOM as ZYEAR`);
    
    return mapping;
}


/**
 * Process multiple dimension fields to create a combined hierarchy
 * This function creates a cartesian product of all dimensions for rendering
 * 
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


function getItemCostTypeDesc(codeValue) {
    // Get the mapping from the state
    const mapping = state.mappings?.itemCostType?.codeToDesc;
    
    if (mapping && mapping[codeValue]) {
        return mapping[codeValue];
    }
    
    // Fallback to the code if no description found
    return codeValue;
}


function getMaterialTypeDesc(codeValue) {
    // Get the mapping from the state
    const mapping = state.mappings?.materialType?.codeToDesc;
    
    if (mapping && mapping[codeValue]) {
        return mapping[codeValue];
    }
    
    // Fallback to the code if no description found
    return codeValue;
}


// Generic function to get description for any dimension
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


function processNonHierarchicalDimension(fieldId, factData) {
    // Get dimension type
    const isDimItemCostType = fieldId === 'DIM_ITEM_COST_TYPE' || fieldId === 'ITEM_COST_TYPE';
    const isDimMaterialType = fieldId === 'DIM_MATERIAL_TYPE' || fieldId === 'COMPONENT_MATERIAL_TYPE';
    const isDimYear = fieldId === 'DIM_YEAR' || fieldId === 'YEAR' || fieldId === 'ZYEAR';
    
    // Create root node
    const rootId = isDimItemCostType ? 'ITEM_COST_TYPE_ROOT' : 
                  isDimMaterialType ? 'COMPONENT_MATERIAL_TYPE_ROOT' : 
                  isDimYear ? 'YEAR_ROOT' :
                  `${fieldId}_ROOT`;
    
    const rootLabel = isDimItemCostType ? 'All Item Cost Types' : 
                     isDimMaterialType ? 'All Material Types' : 
                     isDimYear ? 'All Years' :
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
    
    // Get field name in fact data
    const factFieldName = isDimYear ? 'ZYEAR' : 
                            fieldId === 'ITEM_COST_TYPE' ? 'ITEM_COST_TYPE' :
                            fieldId === 'MATERIAL_TYPE' ? 'COMPONENT_MATERIAL_TYPE' :
                            fieldId;

    // Get values from the appropriate dimension table
    let uniqueValues = [];
    
    if (isDimItemCostType && state.dimensions.item_cost_type) {
        // Get from dimension table
        const dimData = state.dimensions.item_cost_type;
        uniqueValues = dimData.map(item => ({
            id: item.ITEM_COST_TYPE,
            label: item.ITEM_COST_TYPE_DESC || item.ITEM_COST_TYPE
        }));
    } else if (isDimMaterialType && state.dimensions.material_type) {
        // Get from dimension table
        const dimData = state.dimensions.material_type;
        uniqueValues = dimData.map(item => ({
            id: item.MATERIAL_TYPE,
            label: item.MATERIAL_TYPE_DESC
        }));
    } else if (isDimYear && state.dimensions.year) {
        // Get from dimension table
        const dimData = state.dimensions.year;
        uniqueValues = dimData.map(item => ({
            id: item.YEAR,
            label: item.YEAR
        }));
    } else {
        // Extract from fact data
        const fieldName = isDimItemCostType ? 'ITEM_COST_TYPE' : 
                         isDimMaterialType ? 'COMPONENT_MATERIAL_TYPE' : 
                         isDimYear ? 'ZYEAR' :
                         fieldId;
        
        const valueSet = new Set();
        factData.forEach(record => {
            if (record[fieldName]) {
                valueSet.add(record[fieldName]);
            }
        });
        
        uniqueValues = Array.from(valueSet).map(value => ({
            id: value,
            label: value
        }));
    }
    
    // Create a nodes map
    const nodesMap = { [rootId]: root };
    
    // Create child nodes for each unique value
    uniqueValues.forEach(item => {
        const nodeId = isDimItemCostType ? `ITEM_COST_TYPE_${item.id}` : 
                      isDimMaterialType ? `MATERIAL_TYPE_${item.id}` : 
                      isDimYear ? `YEAR_${item.id}` : 
                      `${fieldId}_${item.id}`;
        
        const node = {
            _id: nodeId,
            label: item.label,
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
    
    // Sort children by label
    root.children.sort((a, b) => {
        const nodeA = nodesMap[a];
        const nodeB = nodesMap[b];
        return nodeA.label.localeCompare(nodeB.label);
    });
    
    // Return the hierarchy-like structure
    return {
        root: root,
        nodesMap: nodesMap
    };
}


/**
 * Applies all filters to data before passing to pivot processing
 * 
 * @param {Array} originalData - The original fact data array
 * @returns {Array} - The filtered data array
 */
function preFilterData(originalData) {
    if (!originalData || originalData.length === 0) {
        console.log("preFilterData: No data to filter");
        return [];
    }
    
    console.time('Pre-Filter');
    console.log(`⏳ Status: Starting pre-filter with ${originalData.length} records`);
    
    // If no active filters, return original data
    if (!state.filters || Object.keys(state.filters).every(key => 
        !state.filters[key] || state.filters[key].length === 0)) {
        console.log("✅ Status: No active filters, using original data");
        return originalData;
    }
    
    // Start with all data
    let filteredData = [...originalData];
    
    // Filter by Legal Entity
    if (state.filters.legalEntity && state.filters.legalEntity.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.legalEntity.includes(row.LE)
        );
        console.log(`✅ Status: After LE filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    // Filter by Smartcode
    if (state.filters.smartcode && state.filters.smartcode.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.smartcode.includes(row.ROOT_SMARTCODE)
        );
        console.log(`✅ Status: After Smartcode filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    // Filter by Cost Element
    if (state.filters.costElement && state.filters.costElement.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.costElement.includes(row.COST_ELEMENT)
        );
        console.log(`✅ Status: After Cost Element filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    // Filter by Business Year
    if (state.filters.businessYear && state.filters.businessYear.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.businessYear.includes(row.ZYEAR)
        );
        console.log(`✅ Status: After Year filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    // Filter by Item Cost Type
    if (state.filters.itemCostType && state.filters.itemCostType.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.itemCostType.includes(row.ITEM_COST_TYPE)
        );
        console.log(`✅ Status: After Item Cost Type filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    // Filter by Component Material Type
    if (state.filters.componentMaterialType && state.filters.componentMaterialType.length > 0) {
        const before = filteredData.length;
        filteredData = filteredData.filter(row => 
            state.filters.componentMaterialType.includes(row.COMPONENT_MATERIAL_TYPE)
        );
        console.log(`✅ Status: After Material Type filter: ${filteredData.length} records (${before - filteredData.length} removed)`);
    }
    
    console.log(`✅ Status: Pre-filter complete: ${originalData.length} -> ${filteredData.length} records`);
    console.timeEnd('Pre-Filter');
    
    return filteredData;
}


/**
 * Universal node children detector
 * Checks if a node has children in the hierarchy
 * 
 * @param {Object} node - The node to check
 * @param {Object} state - Application state containing hierarchies
 * @returns {boolean} - Whether the node has children
 */
function nodeHasChildren(node, state) {
    if (!node || !node.hierarchyField) return false;
    
    const dimName = extractDimensionName(node.hierarchyField);
    const hierarchy = state?.hierarchies?.[dimName];
    
    return !!(node.children && node.children.length > 0 && 
             node.children.some(childId => hierarchy?.nodesMap?.[childId]));
}


/**
 * Universal expansion state checker
 * Checks if a node is currently expanded in the specified zone
 * 
 * @param {string} nodeId - ID of the node to check
 * @param {string} dimensionName - Name of the dimension (e.g., 'le', 'mc', 'cost_element')
 * @param {string} zone - Zone to check ('row' or 'column')
 * @param {Object} state - Application state containing expansion tracking
 * @returns {boolean} - Whether the node is expanded
 */
function isNodeExpanded(nodeId, dimensionName, zone, state) {
    if (!state.expandedNodes) return false;
    if (!state.expandedNodes[dimensionName]) return false;
    if (!state.expandedNodes[dimensionName][zone]) return false;
    return !!state.expandedNodes[dimensionName][zone][nodeId];
}


function processHierarchicalFieldsEnhanced(fields, zone) {
    const flatRows = [];
    const flatMappings = [];
    
    const processNodeRecursive = (node, dimensionField, hierarchy, path, level) => {
        const dimensionName = extractDimensionName(dimensionField);
        const hasChildren = nodeHasChildren(node, state); // Now this function exists
        
        // Check expansion state from the current state
        const isExpanded = isNodeExpanded(node._id, dimensionName, zone, state); // Now this function exists
        
        const processedNode = {
            _id: node._id,
            label: node.label || node._id,
            hierarchyField: dimensionField,
            level: level,
            path: [...path, node._id],
            hasChildren: hasChildren,
            isLeaf: !hasChildren,
            expanded: isExpanded,
            dimension: dimensionField,
            factId: node.factId
        };
        
        flatRows.push(processedNode);
        flatMappings.push({ 
            _id: node._id, 
            dimension: dimensionField, 
            level: level,
            isLeaf: !hasChildren
        });
        
        // Process children if expanded OR if this is initial processing
        if (hasChildren && (isExpanded || zone === 'column')) {
            node.children.forEach(childId => {
                const childNode = hierarchy.nodesMap[childId];
                if (childNode) {
                    processNodeRecursive(
                        childNode, 
                        dimensionField, 
                        hierarchy, 
                        processedNode.path, 
                        level + 1
                    );
                }
            });
        }
    };

    fields.forEach((dimensionField) => {
        const dimensionName = extractDimensionName(dimensionField);
        const hierarchy = state.hierarchies[dimensionName];
        
        if (!hierarchy) {
            console.warn(`Hierarchy not found for dimension: ${dimensionName}`);
            return;
        }
        
        const rootNode = hierarchy.nodesMap['ROOT'];
        if (rootNode) {
            processNodeRecursive(rootNode, dimensionField, hierarchy, [], 0);
        }
    });
    
    console.log(`📊 Processed ${fields.length} ${zone} fields: ${flatRows.length} total nodes`);
    return { flatRows, flatMappings };
}

  
/**
 * Update the selectedRootGmids array in the state based on checked checkboxes
 */
function updateSelectedRootGmids() {
    const checkboxList = document.getElementById('rootGmidCheckboxList');
    if (!checkboxList) return;

    const checkedBoxes = checkboxList.querySelectorAll('input[type="checkbox"]:checked');

    // Update selectedRootGmids with the values from checked checkboxes
    state.selectedRootGmids = Array.from(checkedBoxes).map(checkbox => checkbox.value);

    console.log(`✅ Status: Selected ${state.selectedRootGmids.length} ROOT_GMIDs`);

    // Filter fact data based on selected ROOT_GMIDs
    filterFactDataByRootGmids();
}


/**
 * Universal dimension name extractor - works with DIM_ prefixed and non-prefixed names
 */
function extractDimensionName(dimensionField) {
    if (!dimensionField) {
        return 'unknown'; // Return a safe default
    }
    
    // Handle both DIM_ prefixed and direct dimension names
    let dimName = dimensionField;
    if (dimName.startsWith('DIM_')) {
        dimName = dimName.replace(/^DIM_/, '');
    }
    
    // Convert to lowercase for consistency
    return dimName.toLowerCase();
}


/**
 * Filter FACT_BOM data based on selected ROOT_GMIDs
 * This function should be called whenever selectedRootGmids changes
 */
function filterFactDataByRootGmids() {
    console.log("⏳ Status: Filtering FACT_BOM data by selected ROOT_GMIDs");

    // Skip if no fact data or no selected ROOT_GMIDs
    if (!state.factData || !state.factData.length || 
        !state.selectedRootGmids || !state.selectedRootGmids.length) {
        console.log("✅ Status: No filtering needed: missing data or no selections");
        state.filteredFactData = null;
        return;
    }

    // Skip if all ROOT_GMIDs are selected
    if (state.rootGmids && state.selectedRootGmids.length === state.rootGmids.length) {
        console.log("✅ Status: All ROOT_GMIDs selected, using original data");
        state.filteredFactData = null;
        return;
    }

    console.time('FilterFactData');
    console.log(`⏳ Status: Filtering ${state.factData.length} FACT_BOM records by ${state.selectedRootGmids.length} ROOT_GMIDs`);

    // Filter the fact data to only include records with selected ROOT_GMIDs
    state.filteredFactData = state.factData.filter(record => 
        record.ROOT_GMID && state.selectedRootGmids.includes(record.ROOT_GMID)
    );

    console.log(`✅ Status: Filtered FACT_BOM data: ${state.factData.length} -> ${state.filteredFactData.length} records`);
    console.timeEnd('FilterFactData');
}


// Endpoint selection logic:
async function loadGmidDisplayDataWithEndpointSelection(rootGmids, pathGmids = null) {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Choose endpoint based on filtering complexity
    let endpoint, queryParams;
    
    if (pathGmids && pathGmids.length > 0) {
        // Use enhanced endpoint when PATH_GMID filtering is needed
        endpoint = `${API_BASE_URL}/data/DIM_GMID_DISPLAY/filtered-enhanced`;
        queryParams = new URLSearchParams();
        
        if (rootGmids && rootGmids.length > 0) {
            queryParams.append('ROOT_GMID', rootGmids.join(','));
        }
        queryParams.append('PATH_GMID', pathGmids.join(','));
        
        console.log('🚀 Using enhanced endpoint with PATH_GMID filtering');
        
    } else {
        // Use existing endpoint for simple ROOT_GMID filtering
        endpoint = `${API_BASE_URL}/data/DIM_GMID_DISPLAY/filtered`;
        queryParams = new URLSearchParams();
        queryParams.append('ROOT_GMID', rootGmids.join(','));
        
        console.log('✅ Using existing endpoint for ROOT_GMID filtering');
    }
    
    const url = `${endpoint}?${queryParams.toString()}`;
    
    // Rest of your existing fetch logic...
    const response = await fetch(url, {
        headers: { 'Accept': 'application/x-ndjson' }
    });
    
    // ... continue with existing implementation
}


// Export signature
export default {
    // new exports
    extractRootGmidsFromFactData,
    extractPathGmidsFromFactData,
    coordinateComprehensiveFiltering,
    fetchFilteredFactDataDirect,
    isGmidDimensionFiltered,
    getGmidFilterMetadata,

    // ENHANCED EXPORTS
    ingestDimensionFilterData,
    getDimensionFilterOptions,
    getAllDimensionFilterOptions,
    fetchDimensionFields,
    ingestDimensionData,
    ingestFactData,
    initializeBasicMappings,

    // Data processing
    getItemCostTypeDesc, 
    getMaterialTypeDesc,
    getDimensionDescription,
    extractDimensionName,
    
    // Core data functions
    processDimensionHierarchies,
    processHierarchicalFields,
    processMultiDimensionRows,
    processMultipleRowDimensions,
    filterDataByMultipleDimensions,
    enhancedFilterByMultipleDimensions,
    preservingFilterByDimension,
    preservingFilterByMultipleDimensions,
    processNonHierarchicalDimension,
    
    // Hierarchy functions
    buildLegalEntityHierarchy,
    buildSmartCodeHierarchy,
    buildCostElementHierarchy,
    buildGmidDisplayHierarchy,
    buildMaterialTypeHierarchy,
    buildManagementCentreHierarchy,
    buildItemCostTypeHierarchy,
    processDimensionHierarchies,
    getNodeById,
    getFactIdField,
    flattenHierarchy,
    enhancedToggleNodeExpansion,
    
    // Calculation functions
    buildLegalEntityMapping,
    buildCostElementMapping,
    buildSmartCodeMapping,
    buildGmidDisplayMapping,
    buildItemCostTypeMapping,
    buildMaterialTypeMapping,
    buildBusinessYearMapping,
    buildManagementCentreMapping,
        
    // Data mapping
    //extractUniqueFactValues,
    initializeMappings,

    // others
    setAllNodesCollapsed,
    getVisibleLeafNodes,
    regenerateColumnHierarchies,
    filterRecordsByLeHierarchy,
    preFilterData,
    
    // root gmid filter
    // initializeRootGmidFilter,
    updateSelectedRootGmids,
    // 
    processHierarchicalFieldsEnhanced,
    initializeAllDimensionsCollapsed,

    ingestData,
    ingestDimensionFilterDataOnly,
    ingestDimensionData,
    ingestDimensionFilterData,
    ingestFactData,

    //
    buildAndPersistDimensionHierarchies,
    fetchDimensionFields,
    fetchOptimizedData,
    validateAllDimensionFields,
    ingestDimensionFilterDataOnly,
    clearServerCache,
    loadDeferredDimension,
    loadAllDeferredDimensions,
    createPlaceholderHierarchy,

    //
    loadGmidDisplayPlaceholder,
    replaceGmidPlaceholderWithRealData,
    isGmidUsingPlaceholderData,
  };