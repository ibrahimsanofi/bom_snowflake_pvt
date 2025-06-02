
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
            
        console.log(`✅ Status: Fetched ${dims.length} dimension names from server`);
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
            
        // console.log(`Found ${dims.length} dimensions for fact table: ${factTable}`);
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
            
        // console.log(`Fetched ${facts.length} fact table names from server`);
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
    console.log('⏳ Status: Loading data from Snowflake database server...', 'info', elements);
    
    try {        
        // 1. Get dimensions related to the selected fact table
        const dimNames = await fetchDimensionNamesForFact(selectedFact);
        

        // 2. Build available files list (used for UI)
        state.availableFiles = [];
        dimNames.forEach(dim => {
            state.availableFiles.push({
                id: `${dim}`,
                label: dim.replace(/^DIM_/, ''),
                type: 'dimension',
                hierarchical: ['LE', 'COST_ELEMENT', 'GMID_DISPLAY', 'SMARTCODE', 'MC', 'YEAR', 'ITEM_COST_TYPE', 'MATERIAL_TYPE'].includes(
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
        console.log("⏳ Status: Loading dimension data from database...");
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
        

        // 4. Load fact data
        console.log(`⏳ Status: Loading fact data from ${selectedFact}...`);
        ui.updateTableStatus(selectedFact, 'loading');
        
        // Definition switched from const to let to allow data filtering
        let { data: factData, error: factError } = await fetchDatabaseData(selectedFact);

        console.log(`✅ Status: Loaded fact data ${selectedFact}: ${factData.length} rows`);

        // This step is crucial in performance enhancement. It filters out fact rows with zero/null/empty values for the measures 
        console.log(`⏳ Status: Filtering out null/empty/zero fact data from ${selectedFact}...`);

        factData = factData.filter(row => {
            // Check if COST_UNIT has a valid value (not null/undefined/empty string and not zero)
            const xHasValue = row.COST_UNIT !== null && row.COST_UNIT !== undefined && row.COST_UNIT !== 0 && row.COST_UNIT !== '';
            
            // Check if QTY_UNIT has a valid value (not null/undefined/empty string and not zero)
            const yHasValue = row.QTY_UNIT !== null && row.QTY_UNIT !== undefined && row.QTY_UNIT !== 0 && row.QTY_UNIT !== '';
            
            // Keep this row if either x or y has a valid value
            return xHasValue || yHasValue;
        });
        
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
        
        // Verify dimensions are loaded
        const dimensionsLoaded = Object.keys(state.dimensions).some(key => 
            Array.isArray(state.dimensions[key]) && state.dimensions[key].length > 0
        );
        
        if (!dimensionsLoaded) {
            throw new Error("No dimension data was properly loaded");
        }
        

        // 5. Optimize dimension data by filtering to only records used in fact data
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


        // 6. Generate available fields
        state.availableFields = [];
        
        // Add dimension fields
        state.availableFiles.forEach(file => {
            if (file.type === 'dimension') {
                state.availableFields.push({
                    id: file.id,
                    label: file.label,
                    category: 'Dimension',
                    type: 'dimension',
                    hierarchical: true, //file.hierarchical,
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


        // 7. Process dimension data to build hierarchies (now with optimized data)
        try {
            console.log("⏳ Status: Building Dimension hierarchies with optimized data...");
            const hierarchies = processDimensionHierarchies(state.dimensions, state.factData);
            state.hierarchies = hierarchies || {};
            console.log("✅ Status: Dimension hierarchies built:", Object.keys(state.hierarchies));
            
        } catch (hierError){
            console.error("Error building hierarchies:", hierError);
            // Initialize empty hierarchies
            state.hierarchies = {};
        }
        
        
        // 8. Set up UI elements
        ui.renderAvailableFields(elements);
        ui.setDefaultFields();
        ui.renderFieldContainers(elements, state);
        

        // 9. Initialize mappings AFTER data loading is complete
        console.log("⏳ Status: Initializing mappings now that data is loaded");
        initializeMappings();
                
        // Show success message
        console.log('✅ Status: Data loaded successfully from Snowflake database with performance optimizations.', 'success', elements);
        state.loading = false;

        return true;
        
    } catch (error) {
        console.error('Data Loading Error:', error);
                
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


function getDimensionIdField(dimName) {
    // Define mapping between dimension names and id field names
    const dimensionIdFieldMap = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'COMPONENT_GMID',
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
        
        // Get dimension name (lowercase without DIM_ prefix)
        const dimName = field.id.replace('DIM_', '').toLowerCase();
        // console.log(`Processing dimension: ${dimName}`);
        
        // Check if hierarchy exists
        if (!state.hierarchies || !state.hierarchies[dimName]) {
            console.error(`No hierarchy found for ${dimName}`);
            return;
        }
        
        const hierarchy = state.hierarchies[dimName];
        if (!hierarchy || !hierarchy.root) {
            console.error(`Invalid hierarchy for ${dimName}`);
            return;
        }
                
        // Store the field for reference
        result.hierarchyFields.push(field);
        
        // Get zone-specific expanded nodes
        const zone = axisType;
        
        // Ensure expandedNodes is initialized
        if (!state.expandedNodes[dimName]) {
            state.expandedNodes[dimName] = { row: {}, column: {} };
        }
        if (!state.expandedNodes[dimName][zone]) {
            state.expandedNodes[dimName][zone] = {};
        }
        
        // Ensure ROOT is expanded
        const rootId = hierarchy.root.id;
        state.expandedNodes[dimName][zone][rootId] = true;
        
        // Apply expansion state to nodes
        applyExpansionState(hierarchy.root, state.expandedNodes[dimName][zone]);
        
        // Flatten the hierarchy
        let flattenedNodes = [];
        try {
            flattenedNodes = flattenHierarchy(hierarchy.root);
        } catch (error) {
            console.error(`Error flattening ${dimName} hierarchy:`, error);
            flattenedNodes = [hierarchy.root]; // At least include the root
        }
        
        // Dimension-specific processing
        if (dimName === 'material_type') {
            // Add to result with special handling for material type
            flattenedNodes.forEach(node => {
                // Ensure materialTypeCode is correctly passed to the factId
                const factId = node.materialTypeCode !== undefined ? node.materialTypeCode : 
                            (node.factId !== undefined ? node.factId : null);
                
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path,
                    factId: factId,
                    materialTypeCode: node.materialTypeCode
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factId: factId,
                    factIdField: 'COMPONENT_MATERIAL_TYPE'
                });
            });
        } else if (dimName === 'item_cost_type') {
            // Special handling for item cost type
            flattenedNodes.forEach(node => {
                const factId = node.factId !== undefined ? node.factId : node.itemCostTypeCode;
                
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path,
                    factId: factId,
                    itemCostTypeCode: node.itemCostTypeCode
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factId: factId,
                    factIdField: 'ITEM_COST_TYPE'
                });
            });
        } else if (dimName === 'material_type') {
            flattenedNodes.forEach(node => {
                // No need for materialTypeCode or factId - we'll extract from node ID
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factIdField: 'COMPONENT_MATERIAL_TYPE'
                });
            });
        } else if (dimName === 'year') {
            // Special handling for year
            flattenedNodes.forEach(node => {
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path,
                    factId: node.factId
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factId: node.factId,
                    factIdField: 'ZYEAR'
                });
            });
        } else if (dimName === 'mc') {
            // Special handling for MC
            flattenedNodes.forEach(node => {
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path,
                    factId: node.factId
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factId: node.factId,
                    factIdField: 'MC'
                });
            });
        } else {
            // Default handling for other dimensions
            flattenedNodes.forEach(node => {
                result.flatRows.push({
                    _id: node.id,
                    label: node.label || node.id,
                    level: node.level,
                    hasChildren: node.hasChildren,
                    isLeaf: node.isLeaf,
                    expanded: node.expanded,
                    hierarchyField: field.id,
                    path: node.path,
                    factId: node.factId
                });
                
                result.flatMappings.push({
                    id: node.id,
                    dimensionName: dimName,
                    nodeId: node.id,
                    isHierarchical: true,
                    isLeaf: node.isLeaf,
                    factId: node.factId,
                    factIdField: getFactIdField(dimName)
                });
            });
        }
    });
    
    // console.log(`Processed ${fieldIds.length} fields. Result contains ${result.flatRows.length} rows.`);
    return result;
}


// Helper function to apply expansion state
function applyExpansionState(node, expansionState) {
    if (!node) return;
    
    // Set expansion state
    node.expanded = expansionState[node.id] === true;
    
    // Apply to children
    if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
            // Handle both string IDs and direct node references
            const childNode = typeof childId === 'string' ? 
                findNodeById(childId, node.hierarchyName) : childId;
            
            if (childNode) {
                applyExpansionState(childNode, expansionState);
            } else {
                console.warn(`Child node ID ${childId} not found during expansion`);
            }
        });
    }
}


// Helper function to get the fact ID field for a dimension
function getFactIdField(dimName) {
    // Define mapping between dimension names and fact table field names
    const factIdFieldMap = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'COMPONENT_GMID',
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
        factField = 'COMPONENT_GMID';
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
    } else if (nodeId.includes('GMID_') || nodeId.includes('COMPONENT_GMID_')) {
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
    if (!state.factData || state.factData.length === 0) {
        console.warn("No fact data available for mapping verification");
        return;
    }
    
    const sampleSize = Math.min(10, state.factData.length);
    const sampleRecords = state.factData.slice(0, sampleSize);
    
    // Check legal entity mapping
    if (state.mappings.legalEntity) {
        const leMatches = sampleRecords.filter(record => 
            record.LE && state.mappings.legalEntity.leToDetails[record.LE]
        ).length;
        
        console.log(`✅ Status: Legal Entity mapping: ${leMatches}/${sampleSize} records have matching LE codes`);
    }
    
    // Check cost element mapping
    if (state.mappings.costElement) {
        const ceMatches = sampleRecords.filter(record => 
            record.COST_ELEMENT && state.mappings.costElement.costElementToDetails[record.COST_ELEMENT]
        ).length;
        
        console.log(`✅ Status: Cost Element mapping: ${ceMatches}/${sampleSize} records have matching COST_ELEMENT`);
    }
    
    // Check smart code mapping - FIXED to correctly check ROOT_SMARTCODE
    if (state.mappings.smartCode) {
        const scMatches = sampleRecords.filter(record => 
            record.ROOT_SMARTCODE && state.mappings.smartCode.smartCodeToDetails[record.ROOT_SMARTCODE]
        ).length;
        
        console.log(`✅ Status: Smart Code mapping: ${scMatches}/${sampleSize} records have matching ROOT_SMARTCODE`);
    }
    
    // Check GMID mapping - FIXED to correctly check COMPONENT_GMID
    if (state.mappings.gmidDisplay) {
        const gmidMatches = sampleRecords.filter(record => 
            record.COMPONENT_GMID && state.mappings.gmidDisplay.gmidToDisplay[record.COMPONENT_GMID]
        ).length;
        
        console.log(`✅ Status: GMID mapping: ${gmidMatches}/${sampleSize} records have matching COMPONENT_GMID`);
    }
    
    // Check item cost type mapping
    if (state.mappings.itemCostType) {
        const ictMatches = sampleRecords.filter(record => 
            record.ITEM_COST_TYPE && state.mappings.itemCostType.costTypeToDetails[record.ITEM_COST_TYPE]
        ).length;
        
        console.log(`✅ Status: Item Cost Type mapping: ${ictMatches}/${sampleSize} records have matching ITEM_COST_TYPE`);
    }
    
    // Check material type mapping
    if (state.mappings.materialType) {
        const mtMatches = sampleRecords.filter(record => 
            record.COMPONENT_MATERIAL_TYPE && state.mappings.materialType.materialTypeToDetails[record.COMPONENT_MATERIAL_TYPE]
        ).length;
        
        console.log(`✅ Status: Material Type mapping: ${mtMatches}/${sampleSize} records have matching COMPONENT_MATERIAL_TYPE`);
    }

    // Check mc mapping
    if (state.mappings.managementCentre) {
        const mcMatches = sampleRecords.filter(record => 
            record.MC && state.mappings.managementCentre.mcToDetails[record.MC]
        ).length;
        
        console.log(`✅ Status: MC mapping: ${mcMatches}/${sampleSize} records have matching MC`);
    }

    // Check year mapping
    if (state.mappings.year) {
        const yrMatches = sampleRecords.filter(record => 
            record.ZYEAR && state.mappings.year.yearToDetails[record.ZYEAR]
        ).length;
        
        console.log(`✅ Status: ZYEAR mapping: ${yrMatches}/${sampleSize} records have matching ZYEAR`);
    }
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
  pathSeparator = '//',
  data = null
} = {}) {
  // Validate inputs
  if (!pathField) throw new Error('pathField is required');
  if (!idField) throw new Error('idField is required');
  
  // Determine multi-root status if data is provided
  let forceSeparateRoots = true;
  let isFlat = false;
  
  if (data && Array.isArray(data) && data.length > 0) {
    // Find all unique first level segments to determine multi-root status
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
    
    // Only force separate roots if we have multiple first segments
    forceSeparateRoots = firstLevelSegments.size > 1;
    
    console.log(`Path analysis: isFlat=${isFlat}, uniqueFirstSegments=${firstLevelSegments.size}, forceSeparateRoots=${forceSeparateRoots}`);
  }
  
  return {
    // Function to extract the path from an item
    getPath: item => item[pathField],
    
    // Function to get the leaf node ID 
    getLeafId: item => item[idField],
    
    // Use the same path segment label for leaf nodes too
    // This ensures consistency across all node types
    getLeafLabel: null,  // Don't override the segment labels
    
    // Function to determine if a node is a leaf
    isLeafNode: (item, level, totalLevels) => level === totalLevels - 1,
    
    // Separator for path splitting
    pathSeparator: pathSeparator,
    
    // Flags
    forceSeparateRoots: forceSeparateRoots,
    isFlat: isFlat,
    
    // Always use path segments for labels
    usePathSegmentsForLabels: true
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
    
    console.log(`⏳ Status: Processing ${data.length} rows of data...`);
    
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
    
    // Handle flat data with special function
    if (finalConfig.isFlat) {
        return buildFlatDataHierarchy(data, finalConfig);
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
    
    // If no segments found, return empty hierarchy
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
    
    // Create root nodes based on first segments
    const rootNodes = {};
    const nodesMap = {};
    
    // Create root node for each first segment
    firstLevelSegments.forEach(segment => {
        const rootId = `ROOT_${segment.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const rootNode = {
            id: rootId,
            label: segment,  // Use the segment itself as the label
            children: [],
            level: 0,
            path: [rootId],
            expanded: false,
            isLeaf: false,
            hasChildren: false
        };
        
        rootNodes[segment] = rootNode;
        nodesMap[rootId] = rootNode;
    });
    
    // Map to track nodes by path
    const nodesByPathKey = new Map();
    
    // Process each data item
    data.forEach(item => {
        try {
            if (!item) return;
            
            const pathString = finalConfig.getPath(item);
            if (!pathString) return;
            
            // Split path into segments
            const pathSegments = pathString.split(finalConfig.pathSeparator)
                .filter(segment => segment.trim() !== '');
            
            if (pathSegments.length === 0) return;
            
            // Get first segment and root node
            const firstSegment = pathSegments[0];
            const rootNode = rootNodes[firstSegment];
            
            if (!rootNode) {
                console.warn(`No root node found for segment: ${firstSegment}`);
                return;
            }
            
            // Start with root node
            let currentNode = rootNode;
            let currentPath = [rootNode.id];
            
            // Process remaining segments (skip first which is the root)
            for (let i = 1; i < pathSegments.length; i++) {
                const segment = pathSegments[i];
                
                // Skip empty segments
                if (!segment || segment === "") continue;
                
                // Create path key for this segment
                const pathKey = `${currentNode.id}_${segment}`;
                const nodeId = `SEGMENT_${pathKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                
                // Create node if it doesn't exist
                if (!nodesByPathKey.has(pathKey)) {
                    // Determine if this is a leaf node
                    const isLeafNode = (i === pathSegments.length - 1);
                    
                    // Create new node
                    const newNode = {
                        id: nodeId,
                        label: segment,  // Always use segment as label
                        children: [],
                        level: currentNode.level + 1,
                        path: [...currentPath, nodeId],
                        expanded: false,
                        isLeaf: isLeafNode,
                        hasChildren: !isLeafNode,
                        factId: isLeafNode ? finalConfig.getLeafId(item) : null
                    };
                    
                    // Store node in map
                    nodesMap[nodeId] = newNode;
                    nodesByPathKey.set(pathKey, nodeId);
                    
                    // Add to parent's children
                    currentNode.children.push(newNode);
                    currentNode.isLeaf = false;
                    currentNode.hasChildren = true;
                    
                    // For leaf nodes, store original data
                    if (isLeafNode) {
                        newNode.data = { ...item };
                    }
                }
                
                // Update current node for next iteration
                const existingNodeId = nodesByPathKey.get(pathKey);
                currentNode = nodesMap[existingNodeId];
                
                if (!currentNode) {
                    console.warn(`Node not found: ${existingNodeId}`);
                    break;
                }
                
                currentPath = [...currentPath, existingNodeId];
            }
        } catch (error) {
            console.warn("Error processing item:", error);
        }
    });
    
    // Sort hierarchy nodes
    try {
        Object.values(rootNodes).forEach(rootNode => {
            sortHierarchyNodes(rootNode);
        });
    } catch (error) {
        console.warn("Error sorting nodes:", error);
    }
    
    // Create result object
    const result = {
        roots: Object.values(rootNodes),
        nodesMap: nodesMap,
        flatData: data,
        isEmpty: false
    };
    
    // Set root property based on number of roots
    if (Object.keys(rootNodes).length === 1) {
        // Single root case
        result.root = Object.values(rootNodes)[0];
    } else if (Object.keys(rootNodes).length > 1) {
        // Multiple roots case - create a master root
        const masterRootId = "MASTER_ROOT";
        const masterRoot = {
            id: masterRootId,
            label: "All", // Simple label for master root
            children: Object.values(rootNodes),
            level: 0,
            path: [masterRootId],
            expanded: true,
            isLeaf: false,
            hasChildren: true
        };
        
        // Add master root to nodes map
        nodesMap[masterRootId] = masterRoot;
        
        // Set as root
        result.root = masterRoot;
    } else {
        // No roots case
        result.root = null;
    }
    
    console.log(`✅ Status: Built hierarchy with ${result.roots.length} root nodes and ${Object.keys(nodesMap).length} total nodes`);
    
    return result;
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
    
    // Create root node
    const rootId = `${dimensionName}_ROOT`;
    const rootNode = {
        id: rootId,
        label: `All ${dimensionName.replace(/_/g, ' ')}`,
        children: [],
        level: 0,
        path: [rootId],
        expanded: true,
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
            
            // Create node ID
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
    
    // Create config for path segment labels
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'LE',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with segment labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: Legal Entity hierarchy built with ${hierarchy.roots?.length || 0} root nodes`);
    return hierarchy;
}


/**
 * Builds a Smart Code hierarchy using path segments as labels for all nodes
 * @param {Array} data - Smart code dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildSmartCodeHierarchy(data) {
    console.log(`⏳ Status: Building SmartCode hierarchy from ${data?.length || 0} records...`);
    
    // Create config for path segment labels
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'SMARTCODE',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with segment labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: SmartCode hierarchy built with ${hierarchy.roots?.length || 0} root nodes`);
    return hierarchy;
}


/**
 * Builds a Management Centre hierarchy using path segments as labels for all nodes
 * @param {Array} data - Management centre dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildManagementCentreHierarchy(data) {
    console.log(`⏳ Status: Building Management Centre hierarchy from ${data?.length || 0} records...`);
    
    // Check if data has PATH structure
    const hasPathData = data && Array.isArray(data) && 
                         data.some(item => item && item.PATH && 
                                  typeof item.PATH === 'string' && 
                                  item.PATH.includes('//'));
    
    if (!hasPathData) {
        console.log("MC data appears to be flat. Using flat hierarchy builder.");
        return buildStandaloneFlatHierarchy(data, 'MC', 'MC', 'DIM_MC');
    }
    
    // Create config for path segment labels
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'MC',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with segment labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: Management Centre hierarchy built with ${hierarchy.roots?.length || 0} root nodes`);
    return hierarchy;
}


/**
 * Builds a Cost Element hierarchy using path segments as labels for all nodes
 * @param {Array} data - Cost element dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildCostElementHierarchy(data) {
    console.log(`⏳ Status: Building Cost Element hierarchy from ${data?.length || 0} records...`);
    
    // Create config for path segment labels
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH',
        idField: 'COST_ELEMENT',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with segment labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: Cost Element hierarchy built with ${hierarchy.roots?.length || 0} root nodes`);
    return hierarchy;
}


/**
 * Builds a GMID Display hierarchy using path segments as labels for all nodes
 * @param {Array} data - GMID display dimension data
 * @returns {Object} - Complete hierarchy object
 */
function buildFilteredGmidDisplayHierarchy(data) {
    console.log(`⏳ Status: Building GMID Display hierarchy from ${data?.length || 0} records...`);
    
    // Check if data has PATH_GMID structure
    const hasPathData = data && Array.isArray(data) && 
                         data.some(item => item && item.PATH_GMID && 
                                  typeof item.PATH_GMID === 'string' && 
                                  item.PATH_GMID.includes('//'));
    
    if (!hasPathData) {
        console.log("GMID data appears to be flat. Using flat hierarchy builder.");
        return buildStandaloneFlatHierarchy(data, 'GMID_DISPLAY', 'GMID', 'DIM_GMID_DISPLAY');
    }
    
    // Create config for path segment labels
    const config = createPathSegmentLabelConfig({
        pathField: 'PATH_GMID',
        idField: 'GMID',
        pathSeparator: '//',
        data: data
    });
    
    // Build hierarchy with segment labels
    const hierarchy = buildPathHierarchyWithSegmentLabels(data, config);
    
    console.log(`✅ Status: GMID Display hierarchy built with ${hierarchy.roots?.length || 0} root nodes`);
    return hierarchy;
}


function buildItemCostTypeHierarchy(data) {
    return buildStandaloneFlatHierarchy(
        data, 
        'ITEM_COST_TYPE',  // ID field
        'ITEM_COST_TYPE',  // Value field (what we're grouping by)
        'ITEM_COST_TYPE_DESC',  // Description field
        'ITEM_COST_TYPE'  // Root prefix
    );
}


function buildMaterialTypeHierarchy(data) {
    return buildStandaloneFlatHierarchy(
        data, 
        'MATERIAL_TYPE',  // ID field
        'MATERIAL_TYPE',  // Value field
        'MATERIAL_TYPE_DESC',  // Description field
        'MATERIAL_TYPE'  // Root prefix
    );
}


function buildBusinessYearHierarchy(data) {
    return buildStandaloneFlatHierarchy(
        data, 
        'YEAR',  // ID field
        'YEAR',  // Value field
        'YEAR',  // Description field
        'YEAR'  // Root prefix
    );
}


// Helper function for sorting hierarchy nodes
function sortHierarchyNodes(node) {
    if (!node) {
        console.warn("Cannot sort null node");
        return;
    }
    
    try {
        // Check if children array exists and has items
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            // First, ensure all children are objects, not just IDs
            // This handles both cases: array of objects and array of IDs
            const childrenObjects = node.children.map(child => {
                // If child is a string (ID), convert to the actual node
                if (typeof child === 'string') {
                    // If we can't find the node, create a placeholder
                    return findNodeById(child) || { 
                        id: child,
                        label: child,
                        children: []
                    };
                }
                return child;
            });
            
            // Sort children by label alphabetically
            childrenObjects.sort((a, b) => {
                const labelA = (a.label || '').toString().toLowerCase();
                const labelB = (b.label || '').toString().toLowerCase();
                return labelA.localeCompare(labelB);
            });
            
            // Update node's children with sorted array
            // If node.children was array of IDs, convert back to IDs
            if (typeof node.children[0] === 'string') {
                node.children = childrenObjects.map(child => child.id);
            } else {
                node.children = childrenObjects;
            }
            
            // Recursively sort children's children
            childrenObjects.forEach(child => {
                sortHierarchyNodes(child);
            });
        }
    } catch (error) {
        console.warn("Error sorting children for node:", node?.id, error);
    }
}


/**
 * Fixed processDimensionHierarchies function for js
 * Properly uses factData to build GMID_DISPLAY hierarchy
 * 
 * @param {Object} dimensions - Object containing arrays of data for each dimension
 * @param {Array} factData - Object containing arrays of fact table data
 * @returns {Object} - Object containing processed hierarchies for each dimension
 */
function processDimensionHierarchies(dimensions, factData) {
    console.log("processDimensionHierarchies called with:", 
                "dimensions:", dimensions ? Object.keys(dimensions) : "none", 
                "factData:", factData ? factData.length : "none");
    
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
                hierarchies.gmid_display = buildFilteredGmidDisplayHierarchy(dimensions.gmid_display);
                // Precompute descendant factIds for GMID hierarchy
                precomputeDescendantFactIds(hierarchies.gmid_display, 'COMPONENT_GMID');
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
    if (!window.state || !window.state.hierarchies) return null;
    
    try {
        // First check if we can determine which hierarchy from the node ID
        if (nodeId.startsWith('ROOT_') || nodeId.startsWith('SEGMENT_')) {
            // Try to extract hierarchy name from ID
            let hierarchyName = null;
            
            if (nodeId.startsWith('ROOT_LE_')) {
                hierarchyName = 'le';
            } else if (nodeId.startsWith('ROOT_COST_ELEMENT_')) {
                hierarchyName = 'cost_element';
            } else if (nodeId.startsWith('ROOT_SMARTCODE_')) {
                hierarchyName = 'smartcode';
            } else if (nodeId.startsWith('ROOT_GMID_')) {
                hierarchyName = 'gmid_display';
            } else if (nodeId.startsWith('ROOT_MATERIAL_TYPE_')) {
                hierarchyName = 'material_type';
            } else if (nodeId.startsWith('ROOT_ITEM_COST_TYPE_')) {
                hierarchyName = 'item_cost_type';
            } else if (nodeId.startsWith('ROOT_YEAR_')) {
                hierarchyName = 'year';
            } else if (nodeId.startsWith('ROOT_MC_')) {
                hierarchyName = 'mc';
            }
            
            // If we found a hierarchy name, check that hierarchy first
            if (hierarchyName && window.state.hierarchies[hierarchyName]) {
                const hierarchy = window.state.hierarchies[hierarchyName];
                if (hierarchy.nodesMap && hierarchy.nodesMap[nodeId]) {
                    return hierarchy.nodesMap[nodeId];
                }
            }
        }
        
        // If we couldn't determine the hierarchy or node wasn't found, 
        // search all hierarchies
        for (const hierarchyName in window.state.hierarchies) {
            const hierarchy = window.state.hierarchies[hierarchyName];
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
    const isGmidHierarchy = factIdField === 'COMPONENT_GMID';
    
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
    console.log("⏳ Status: Building GMID Display mapping with PATH_GMID-based hierarchy");
    
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
    
    console.log(`✅ Status: Loaded ${mapping.usedGmids.size} GMIDs from FACT_BOM data`);
    
    // Then process the display mappings
    if (gmidDisplayData && gmidDisplayData.length > 0) {
        console.log(`⏳ Status: Processing ${gmidDisplayData.length} rows of GMID Display data...`);
        
        // First find all root GMIDs to ensure we build complete hierarchies
        const rootGmidCounts = {};
        gmidDisplayData.forEach(row => {
            if (row.PATH_GMID) {
                const segments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
                if (segments.length > 0) {
                    const rootGmid = segments[0];
                    rootGmidCounts[rootGmid] = (rootGmidCounts[rootGmid] || 0) + 1;
                }
            }
        });
        
        // console.log(`Found ${Object.keys(rootGmidCounts).length} unique root GMIDs in PATH_GMID`);
        
        // Now process each row for display mappings
        gmidDisplayData.forEach(row => {
            // Determine the component GMID
            let componentGmid;
            if (row.PATH_GMID) {
                const pathSegments = row.PATH_GMID.split('/');
                const lastSegment = pathSegments[pathSegments.length - 1];
                
                // If the last segment is '#', use the entire PATH_GMID as the COMPONENT_GMID
                if (lastSegment === '#') {
                    componentGmid = row.PATH_GMID;
                } else {
                    // Otherwise, use the COMPONENT_GMID value
                    componentGmid = row.COMPONENT_GMID || "Unknown GMID";
                }
            } else {
                componentGmid = row.COMPONENT_GMID || "Unknown GMID";
            }
            
            // Skip if we couldn't determine a component GMID
            if (!componentGmid) return;
            
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
                    // Use the same node ID format as in buildGmidDisplayHierarchy for consistency
                    const safeId = pathSegment.replace(/[^a-zA-Z0-9]/g, '_');
                    const nodeId = `LEVEL_${i+1}_${safeId}`;
                    
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
                        const childSafeId = childPathSegment.replace(/[^a-zA-Z0-9]/g, '_');
                        const childNodeId = `LEVEL_${i+2}_${childSafeId}`;
                        
                        mapping.nodeToChildGmids[nodeId].add(childNodeId);
                        mapping.nodeToParent[childNodeId] = nodeId;
                    }
                }
            } else {
                // If no PATH_GMID, create a node for this COMPONENT_GMID
                const safeId = componentGmid.replace(/[^a-zA-Z0-9]/g, '_');
                const nodeId = `LEVEL_1_${safeId}`;
                mapping.nodeToChildGmids[nodeId] = new Set([componentGmid]);
                mapping.nodeToDescendantGmids[nodeId] = new Set([componentGmid]);
            }
        });
    }
    
    // Handle unmapped GMIDs from FACT_BOM
    const unmappedGmids = Array.from(mapping.usedGmids).filter(gmid => 
        !mapping.gmidToDisplay[gmid] || !mapping.gmidToDisplay[gmid].display);
    
    if (unmappedGmids.length > 0) {
        console.warn(`Found ${unmappedGmids.length} unmapped COMPONENT_GMIDs in fact data`);
        // console.warn("First few unmapped GMIDs:", unmappedGmids.slice(0, 5));
        
        // Create basic mappings for unmapped GMIDs
        unmappedGmids.forEach(gmid => {
            mapping.gmidToDisplay[gmid] = {
                display: gmid,
                fullPath: gmid
            };
            
            // Create a node for this GMID
            const safeId = gmid.replace(/[^a-zA-Z0-9]/g, '_');
            const nodeId = `LEVEL_1_${safeId}`;
            mapping.nodeToChildGmids[nodeId] = new Set([gmid]);
            mapping.nodeToDescendantGmids[nodeId] = new Set([gmid]);
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
    
    const mappedGmids = Object.keys(mapping.gmidToDisplay).length;
    const pathMappings = Object.keys(mapping.pathGmidToDisplay).length;
    const rootGmids = Object.keys(mapping.nodeToChildGmids).filter(id => !mapping.nodeToParent[id]).length;
    
    console.log(`✅ Status: GMID Display mapping complete: ${mappedGmids} GMIDs mapped`);
    console.log(`✅ Status: PATH_GMID mapping: ${pathMappings} path segments mapped`);
    console.log(`✅ Status: Root GMID mapping: ${rootGmids} root GMIDs`);
    
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
    
    console.log(`✅ Status: Legal Entity mapping complete: ${Object.keys(mapping.leToDetails).length} LE codes mapped`);
    console.log(`✅ Status: ${mapping.usedLeCodes.size} LE codes used in FACT_BOM`);
    
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
    
    console.log(`✅ Status: Legal Entity mapping complete: ${Object.keys(mapping.mcToDetails).length} MC codes mapped`);
    console.log(`✅ Status: ${mapping.usedMcCodes.size} MC codes used in FACT_BOM`);
    
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
    
    console.log(`✅ Status: Cost Element mapping complete: ${Object.keys(mapping.costElementToDetails).length} cost elements mapped`);
    console.log(`✅ Status: ${mapping.usedCostElements.size} cost elements used in FACT_BOM`);
    
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
    
    console.log(`✅ Status: Smart Code mapping complete: ${Object.keys(mapping.smartCodeToDetails).length} smart codes mapped`);
    console.log(`✅ Status: ${mapping.usedSmartCodes.size} smart codes used in FACT_BOM as ROOT_SMARTCODE`);
    
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
    
    console.log(`✅ Status: ITEM_COST_TYPE mapping complete: ${Object.keys(mapping.costTypeToDetails).length} types mapped`);
    
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
    
    console.log(`✅ Status: MATERIAL_TYPE mapping complete: ${Object.keys(mapping.materialTypeToDetails).length} types mapped`);
    
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
    
    console.log(`✅ Status: YEAR mapping complete: ${Object.keys(mapping.yearToDetails).length} years mapped`);
    console.log(`✅ Status: ${mapping.usedYears.size} years used in FACT_BOM as ZYEAR`);
    
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


// Export signature
export default {
    // Data processing
    getItemCostTypeDesc, 
    getMaterialTypeDesc,
    getDimensionDescription,
    
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
    buildFilteredGmidDisplayHierarchy,
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
    ingestData,
    processHierarchicalFields,
    preFilterData,

    // root gmid filter
    // initializeRootGmidFilter,
    updateSelectedRootGmids

  };