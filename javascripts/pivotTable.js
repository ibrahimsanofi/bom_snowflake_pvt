// PivotTable.js - Handles rendering and interaction for the pivot table
import stateModule from './state.js';
import datUtil from './data.js';

const state = stateModule.state;

/**
 * Initialize pivot table event handlers
 */
function initPivotTable(){
    // Add column expand/collapse handler to window
    window.handleColumnExpandCollapse = handleColumnExpandCollapse();

    // Add row expand.collapse handler to window
    window.handleRowExpandCollapse = handleRowExpandCollapse();

    // Initialize format controls
    initFormatControls();

    // Initialize expand/collapse all buttons
    initExpandCollapseButtons();

    // Initialize auto-adjustment for expandable columns
    addAutoAdjustScript();

    // Enhances Pivot table visual enhancement
    const enhancementsCallback = applyPivotTableEnhancements();
    document.addEventListener('pivotTableGenerated', enhancementsCallback);
}


/**
 * Main function to generate the pivot table from the current state
 */
function generatePivotTable() {
    console.log("⏳ Status: Generating pivot table with the following configuration:");
    // console.log(`  - Row Fields: ${state.rowFields.join(', ')}`);
    // console.log(`  - Column Fields: ${state.columnFields.join(', ')}`);
    // console.log(`  - Value Fields: ${state.valueFields.join(', ')}`);
    
    // Check if we have necessary data
    if (!state.factData || state.factData.length === 0) {
        console.warn("⚠️ Warning: No fact data available for pivot table");
        displayNoDataMessage();
        return;
    }
    
    // Apply any filters before pivoting
    const filteredData = datUtil.preFilterData(state.factData);
    console.log(`✅ Status: Filtered data contains ${filteredData.length} rows`);
    
    // Process rows based on field selection
    const rowResult = processRowFields(state.rowFields, filteredData);
    
    // Process columns based on field selection
    const columnResult = processColumnFields(state.columnFields, filteredData);
    
    // Calculate values at intersections
    const pivotedData = calculateIntersections(rowResult, columnResult, filteredData);
    
    // Render the pivot table
    renderPivotTable(pivotedData, rowResult, columnResult);
    
    // Update stats in UI
    updatePivotStats(pivotedData, rowResult, columnResult);
    
    console.log("✅ Status: Pivot table generated successfully");
}


/**
 * Process row fields to generate row headers and mappings
 * @param {Array} rowFields - Array of field IDs for rows
 * @param {Array} data - Filtered fact data
 * @returns {Object} - Object containing row headers and mappings
 */
function processRowFields(rowFields, data) {
    if (!rowFields || rowFields.length === 0) {
        return { rows: [], flatRows: [], flatMappings: [] };
    }
    
    console.log(`⏳ Status: Processing ${rowFields.length} row fields`);
    
    // Create dimension headers for ALL row fields, not just the first one
    rowFields.forEach(fieldId => {
        // Get field definition
        const field = state.availableFields.find(f => f.id === fieldId);
        if (field) {
            console.log(`Processing row field: ${fieldId}, Label: ${field.label}`);
        }
    });
    
    // Use the existing helper function for multiple row dimensions
    let processedRows;
    
    if (rowFields.length === 1) {
        // Single dimension case - use with dimension name as header
        processedRows = datUtil.processHierarchicalFields(rowFields, 'row');
        
        // Add the dimension name to each row for display
        if (processedRows && processedRows.flatRows) {
            // Get the field label for the dimension
            const fieldId = rowFields[0];
            const field = state.availableFields.find(f => f.id === fieldId);
            const dimensionLabel = field ? field.label : fieldId;
            
            // Attach the dimension label to each row
            processedRows.flatRows.forEach(row => {
                row.dimensionName = dimensionLabel;
            });
        }
    } else {
        // Multi-dimension case
        processedRows = processMultiDimensionRows(rowFields, 'row');
    }
    
    // Filter out any rows that have no data after filtering
    processedRows.flatRows = processedRows.flatRows.filter(row => {
        // Skip filtering for root nodes
        if (row._id === 'ROOT' || row._id.includes('_ROOT')) {
            return true;
        }
        
        // For multi-dimension rows we need a different approach
        if (row.dimensions) {
            // Use preserving filter to keep the hierarchical structure
            const matchingData = datUtil.preservingFilterByMultipleDimensions(data, row);
            
            // Keep rows that have matching data or are marked as _hierarchyNode
            return matchingData && (!matchingData._isEmpty || matchingData._hierarchyNode);
        } else {
            // Use preserving filter for single dimension
            const matchingData = datUtil.preservingFilterByDimension(data, row);
            
            // Keep rows that have matching data or are marked as _hierarchyNode
            return matchingData && (!matchingData._isEmpty || matchingData._hierarchyNode);
        }
    });
    
    console.log(`✅ Status: Row processing complete with ${processedRows.flatRows.length} rows`);
    
    return processedRows;
}


/**
 * Process column fields to generate column headers and mappings
 * @param {Array} columnFields - Array of field IDs for columns
 * @param {Array} data - Filtered fact data
 * @returns {Object} - Object containing column headers and mappings
 */
function processColumnFields(columnFields, data) {
    if (!columnFields || columnFields.length === 0) {
        // When no column fields are selected, create a simple column structure
        // with one column for each measure
        const valueFieldCount = state.valueFields ? state.valueFields.length : 0;
        
        if (valueFieldCount > 0) {
            // Create columns for each value field without a "Total" header
            return {
                headers: state.valueFields.map((vf, index) => {
                    const field = state.availableFields.find(f => f.id === vf);
                    return { 
                        id: field ? field.measureName || vf : vf,
                        label: field ? field.label : vf,
                        level: 0,
                        colspan: 1,
                        isLeaf: true
                    };
                }),
                flatMappings: state.valueFields.map(vf => {
                    const field = state.availableFields.find(f => f.id === vf);
                    return { id: field ? field.measureName || vf : vf };
                }),
                depths: [valueFieldCount],
                totalColspan: valueFieldCount
            };
        } else {
            // Fallback for no value fields case
            return {
                headers: [],
                flatMappings: [],
                depths: [0],
                totalColspan: 0
            };
        }
    }
    
    console.log(`⏳ Status: Processing ${columnFields.length} column fields`);
    
    // Create dimension information for all column fields
    const dimensionInfo = columnFields.map(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        // Determine if this is a hierarchical dimension
        const isHierarchical = field && 
            (field.isHierarchical || field.id.startsWith('DIM_') || field.hierarchyType);
        
        return {
            id: fieldId,
            label: field ? field.label : fieldId,
            isHierarchical: isHierarchical
        };
    });
    
    console.log("Column Dimensions:", dimensionInfo);
    
    // Process columns based on whether we have multiple dimensions
    let processedColumns;
    
    if (columnFields.length === 1) {
        // Single dimension case - can be hierarchical or flat
        const field = dimensionInfo[0];
        
        if (field.isHierarchical) {
            // Process as hierarchical field
            try {
                processedColumns = datUtil.processHierarchicalFields(columnFields, 'column');
                
                // Attach dimension info to all columns
                if (processedColumns && processedColumns.flatRows) {
                    processedColumns.flatRows.forEach(col => {
                        col.dimensionName = field.label;
                        col.isHierarchical = true;
                    });
                }
                
                // Check if we've got a valid result
                if (!processedColumns || !processedColumns.flatRows) {
                    console.warn("Invalid result from processHierarchicalFields for column fields");
                    processedColumns = { flatRows: [], flatMappings: [], hierarchyFields: [] };
                }
            } catch (error) {
                console.error("Error processing hierarchical column field:", error);
                processedColumns = { flatRows: [], flatMappings: [], hierarchyFields: [] };
            }
        } else {
            // Process as flat dimension - create columns for each unique value
            try {
                // Get unique values for this field
                const uniqueValues = getUniqueFieldValues(data, field.id);
                
                // Create flat columns for each value
                processedColumns = {
                    flatRows: uniqueValues.map(value => ({
                        _id: value.id,
                        label: value.label,
                        level: 0,
                        expanded: true,
                        isLeaf: true,
                        hasChildren: false,
                        dimensionName: field.label,
                        isHierarchical: false
                    })),
                    flatMappings: uniqueValues.map(value => ({
                        id: value.id,
                        dimensionName: field.id,
                        isHierarchical: false
                    })),
                    hierarchyFields: [field.id]
                };
            } catch (error) {
                console.error("Error processing flat column field:", error);
                processedColumns = { flatRows: [], flatMappings: [], hierarchyFields: [] };
            }
        }
    } else {
        // Multi-dimension case
        try {
            // Use modified process for multiple column dimensions
            processedColumns = processMultiDimensionColumns(columnFields, data, 'column');
            
            // Check if we've got a valid result
            if (!processedColumns || !processedColumns.flatRows) {
                console.warn("Invalid result from processMultiDimensionColumns for column fields");
                processedColumns = { flatRows: [], flatMappings: [], hierarchyFields: [] };
            }
        } catch (error) {
            console.error("Error processing multiple column dimensions:", error);
            processedColumns = { flatRows: [], flatMappings: [], hierarchyFields: [] };
        }
    }
    
    console.log(`Initial column processing complete with ${processedColumns.flatRows.length} flat rows`);
    
    // Filter column headers to only include those with data
    // We retain the hierarchical structure by using the preserving filter
    processedColumns.flatRows = processedColumns.flatRows.filter(col => {
        // Always include ROOT columns
        if (col._id === 'ROOT' || col._id.includes('_ROOT')) {
            return true;
        }
        
        // For multi-dimension columns we need a different approach
        if (col.dimensions) {
            try {
                // Use preserving filter to maintain hierarchy
                const matchingData = datUtil.preservingFilterByMultipleDimensions(data, col);
                return matchingData && (!matchingData._isEmpty || matchingData._hierarchyNode);
            } catch (error) {
                console.warn(`Error filtering multi-dimension column ${col._id}:`, error);
                return true; // Include on error to be safe
            }
        } else {
            try {
                // Use preserving filter for single dimension
                const matchingData = datUtil.preservingFilterByDimension(data, col);
                return matchingData && (!matchingData._isEmpty || matchingData._hierarchyNode);
            } catch (error) {
                console.warn(`Error filtering column ${col._id}:`, error);
                return true; // Include on error to be safe
            }
        }
    });
    
    // Now convert flat rows to hierarchical column headers with proper spans
    const { headers, depths, totalColspan } = convertToColumnHeaders(processedColumns.flatRows);
    
    console.log(`✅ Status: Column processing complete with ${headers.length} column headers across ${depths.length} levels`);
    
    return {
        headers: headers,
        flatMappings: processedColumns.flatMappings,
        depths: depths,
        totalColspan: totalColspan,
        dimensionInfo: dimensionInfo
    };
}


/**
 * Process multiple dimension fields for columns to create a combined structure
 * @param {Array} fieldIds - Array of field IDs to process
 * @param {Array} data - Data to process
 * @param {string} zone - 'row' or 'column'
 * @returns {Object} - Object containing processed multi-dimension data
 */
function processMultiDimensionColumns(fieldIds, data, zone) {
    console.log(`Processing multiple dimensions for ${zone}: ${fieldIds.join(', ')}`);
    
    // Process each dimension individually first
    const dimensionsData = fieldIds.map(fieldId => {
        // Get field definition to check if it's hierarchical
        const field = state.availableFields.find(f => f.id === fieldId);
        const isHierarchical = field && 
            (field.isHierarchical || field.id.startsWith('DIM_') || field.hierarchyType);
        
        // Process differently based on dimension type
        if (isHierarchical) {
            // Process hierarchical dimension
            const result = datUtil.processHierarchicalFields([fieldId], zone);
            
            // Add dimension info
            if (result && result.flatRows) {
                result.flatRows.forEach(row => {
                    row.dimensionName = field ? field.label : fieldId;
                    row.isHierarchical = true;
                });
            }
            
            return result;
        } else {
            // Process flat dimension
            // Get unique values for this field
            const uniqueValues = getUniqueFieldValues(data, fieldId);
            
            // Create flat structure
            return {
                flatRows: uniqueValues.map(value => ({
                    _id: value.id,
                    label: value.label,
                    level: 0,
                    expanded: true,
                    isLeaf: true,
                    hasChildren: false,
                    dimensionName: field ? field.label : fieldId,
                    isHierarchical: false,
                    hierarchyField: fieldId
                })),
                flatMappings: uniqueValues.map(value => ({
                    id: value.id,
                    dimensionName: fieldId,
                    isHierarchical: false
                })),
                hierarchyFields: [fieldId]
            };
        }
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
        if (dimData.hierarchyFields) {
            result.hierarchyFields = [...result.hierarchyFields, ...dimData.hierarchyFields];
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
                    label: `${existingRow.label} - ${newRow.label}`, // Combined label
                    dimensions: [],
                    level: 0, // Root level
                    isLeaf: true, // Leaf node by default
                    hasChildren: false
                };

                // Add existing dimensions
                if (existingRow.dimensions) {
                    combinedRow.dimensions = [...existingRow.dimensions];
                } else {
                    // Convert single dimension row to multi-dimension format
                    combinedRow.dimensions = [{
                        _id: existingRow._id,
                        label: existingRow.label,
                        level: existingRow.level || 0,
                        hasChildren: existingRow.hasChildren || false,
                        isLeaf: existingRow.isLeaf || true,
                        expanded: existingRow.expanded || true,
                        hierarchyField: existingRow.hierarchyField,
                        dimensionName: existingRow.dimensionName,
                        isHierarchical: existingRow.isHierarchical || false
                    }];
                }

                // Add the new dimension
                combinedRow.dimensions.push({
                    _id: newRow._id,
                    label: newRow.label,
                    level: newRow.level || 0,
                    hasChildren: newRow.hasChildren || false,
                    isLeaf: newRow.isLeaf || true,
                    expanded: newRow.expanded || true,
                    hierarchyField: newRow.hierarchyField,
                    dimensionName: newRow.dimensionName,
                    isHierarchical: newRow.isHierarchical || false
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
                        dimensionName: existingMapping.dimensionName,
                        isHierarchical: existingMapping.isHierarchical || false
                    }];
                }

                // Add the new dimension mapping
                combinedMapping.dimensions.push({
                    id: newMapping.id,
                    dimensionName: newMapping.dimensionName,
                    isHierarchical: newMapping.isHierarchical || false
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
 * Get unique values for a field from dataset
 * @param {Array} data - Dataset to process
 * @param {string} fieldId - Field ID to get values for
 * @returns {Array} - Array of unique values with IDs and labels
 */
function getUniqueFieldValues(data, fieldId) {
    // Check if data exists
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn(`No data available to get unique values for field ${fieldId}`);
        return [];
    }
    
    // Get the actual field name in the data (may be different from the field ID)
    const field = state.availableFields.find(f => f.id === fieldId);
    const dataField = field && field.dataField ? field.dataField : fieldId;
    
    // Create a set of unique values
    const uniqueValueMap = new Map();
    
    // Check the first row to see if the field exists
    if (data[0] && data[0][dataField] === undefined) {
        console.warn(`Field ${dataField} not found in data`);
        return [];
    }
    
    // Get unique values
    data.forEach(row => {
        const value = row[dataField];
        if (value !== undefined && value !== null && !uniqueValueMap.has(value)) {
            uniqueValueMap.set(value, {
                id: value,
                label: value.toString() // Use value as label by default
            });
        }
    });
    
    // Convert map to array and sort
    return Array.from(uniqueValueMap.values()).sort((a, b) => {
        // Try to sort numerically if possible
        const aNum = parseFloat(a.id);
        const bNum = parseFloat(b.id);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        // Otherwise sort alphabetically
        return a.label.localeCompare(b.label);
    });
}


/**
 * Convert flat column data to hierarchical headers with proper colspans
 * @param {Array} flatColumns - Flat column data
 * @returns {Object} - Object with headers, depths, and total colspan
 */
function convertToColumnHeaders(flatColumns) {
    // Start by organizing columns by level
    const columnsByLevel = {};
    let maxLevel = 0;
    
    try {
        flatColumns.forEach(col => {
            // Determine the level - for multi-dimension columns, use the dimension structure
            let level = 0;
            
            if (col.dimensions) {
                // For multi-dimension, create a header for each dimension
                col.dimensions.forEach((dim, dimIndex) => {
                    // Calculate level based on dimension index and internal level
                    const dimLevel = dimIndex * 10 + (dim.level || 0);
                    maxLevel = Math.max(maxLevel, dimLevel);
                    
                    // Create a header object for this dimension
                    let header = {
                        id: `${col._id}_dim${dimIndex}`,
                        originId: col._id, // Keep track of the original column ID
                        label: dim.label,
                        level: dimLevel,
                        expanded: dim.expanded !== undefined ? dim.expanded : true,
                        hasChildren: dim.hasChildren !== undefined ? dim.hasChildren : false,
                        isLeaf: dimIndex === col.dimensions.length - 1, // Last dimension is leaf
                        colspan: 1, // Initial value, will calculate later
                        originalCol: col,
                        dimensionIndex: dimIndex,
                        dimensionName: dim.dimensionName,
                        isHierarchical: dim.isHierarchical
                    };
                    
                    // Initialize the level array if needed
                    columnsByLevel[dimLevel] = columnsByLevel[dimLevel] || [];
                    
                    // Add to the level
                    columnsByLevel[dimLevel].push(header);
                });
            } else {
                // For single dimension columns
                level = typeof col.level === 'number' ? col.level : 0;
                maxLevel = Math.max(maxLevel, level);
                
                // Initialize the level array if needed
                columnsByLevel[level] = columnsByLevel[level] || [];
                
                // Create a header object for this column
                let header = {
                    id: col._id,
                    label: col.label || col._id,
                    level: level,
                    expanded: col.expanded !== undefined ? col.expanded : true,
                    hasChildren: col.hasChildren !== undefined ? col.hasChildren : false,
                    isLeaf: col.isLeaf !== undefined ? col.isLeaf : (level === maxLevel),
                    colspan: 1, // Initial value, will calculate later
                    originalCol: col,
                    dimensionName: col.dimensionName,
                    isHierarchical: col.isHierarchical
                };
                
                // Add to the level
                columnsByLevel[level].push(header);
            }
        });
    } catch (error) {
        console.error("Error organizing columns by level:", error);
    }
    
    try {
        // Calculate colspans bottom-up
        // Start from the deepest level (leaf nodes always have colspan=1)
        for (let level = maxLevel; level >= 0; level--) {
            const columns = columnsByLevel[level] || [];
            
            columns.forEach(col => {
                if (level === maxLevel || col.isLeaf) {
                    // Leaf nodes always have colspan=1
                    col.colspan = 1;
                } else if (col.hasChildren) {
                    // For non-leaf nodes, check expansion state
                    if (col.expanded) {
                        // For expanded non-leaf nodes, sum colspans of children
                        const childColspan = getChildrenColspan(col, columnsByLevel);
                        col.colspan = Math.max(1, childColspan);
                    } else {
                        // For collapsed nodes, use 1
                        col.colspan = 1;
                    }
                } else {
                    // Default to 1 if we don't know
                    col.colspan = 1;
                }
            });
        }
    } catch (error) {
        console.error("Error calculating colspans:", error);
    }
    
    // Flatten the headers by level for rendering
    const headers = [];
    const depths = [];
    
    try {
        for (let level = 0; level <= maxLevel; level++) {
            const columns = columnsByLevel[level] || [];
            if (columns.length > 0) {
                depths.push(columns.length);
                headers.push(...columns);
            }
        }
    } catch (error) {
        console.error("Error flattening headers:", error);
    }
    
    // Calculate total colspan (width of the table)
    // This is the sum of the colspans at the deepest level
    let totalColspan = 1;
    try {
        if (columnsByLevel[maxLevel] && columnsByLevel[maxLevel].length > 0) {
            totalColspan = columnsByLevel[maxLevel].reduce((sum, col) => sum + col.colspan, 0);
        }
    } catch (error) {
        console.error("Error calculating total colspan:", error);
    }
    
    return { headers, depths, totalColspan };
}


/**
 * Calculate the colspan of a column based on its children
 * @param {Object} column - The column to calculate colspan for
 * @param {Object} columnsByLevel - Columns organized by level
 * @returns {number} - The calculated colspan
 */
function getChildrenColspan(column, columnsByLevel) {
    // Get the next level
    const nextLevel = (column.level || 0) + 1;
    const childColumns = columnsByLevel[nextLevel] || [];
    
    // Find children of this column
    const children = childColumns.filter(child => {
        if (child.originalCol && child.originalCol.path && column.originalCol && column.originalCol.path) {
            // Check if this column is in the child's path
            return child.originalCol.path.includes(column.originalCol._id);
        }
        return false;
    });
    
    // Sum the colspans of all children
    return Math.max(1, children.reduce((sum, child) => sum + child.colspan, 0));
}


/**
 * Calculate values at intersections of rows and columns
 * @param {Object} rowResult - Processed row data
 * @param {Object} columnResult - Processed column data
 * @param {Array} data - Filtered fact data
 * @returns {Object} - Pivot table data with values at intersections
 */
function calculateIntersections(rowResult, columnResult, data) {
    // DEBUG: Log inputs
    // console.log("Calculate intersections - Row result:", rowResult);
    // console.log("Calculate intersections - Column result:", columnResult);
    // console.log("Calculate intersections - Data sample:", data.slice(0, 3));
    
    // Initialize pivot data structure
    const pivotData = {
        rows: rowResult.flatRows,
        columns: columnResult.headers,
        values: {} // Will hold all intersection values
    };
    
    // Check if we have value fields
    if (!state.valueFields || state.valueFields.length === 0) {
        console.warn("⚠️ Warning: No value fields selected");
        return pivotData;
    }
    
    console.log(`⏳ Status: Calculating ${rowResult.flatRows.length} x ${columnResult.headers.length} intersections for ${state.valueFields.length} value fields`);
    
    // Make sure we process ALL rows, not just filtered ones
    rowResult.flatRows.forEach((row, rowIndex) => {
        // DEBUG: Log current row being processed
        // console.log(`Processing row ${rowIndex}: ${row._id}`);
        
        // Create values object for this row
        pivotData.values[row._id] = {};
        
        // Filter data for this row
        let rowData;
        
        try {
            if (row.dimensions) {
                // Multi-dimension row
                rowData = datUtil.preservingFilterByMultipleDimensions(data, row);
            } else {
                // Single dimension row
                rowData = datUtil.preservingFilterByDimension(data, row);
            }
            
            // DEBUG: Log filtered row data
            // console.log(`Row ${row._id} data:`, 
            //     Array.isArray(rowData) ? 
            //     `${rowData.length} records` : 
            //     (rowData?._isEmpty ? "Empty" : "Has data"));
            
            // Skip if row has no data
            if (rowData?._isEmpty) {
                // console.log(`Row ${row._id} has no data, skipping`);
                return;
            }
        } catch (error) {
            console.error(`Error filtering data for row ${row._id}:`, error);
            return;
        }
        
        // Process value fields for all columns (including "Total")
        state.valueFields.forEach(valueField => {
            // Find the field definition
            const field = state.availableFields.find(f => f.id === valueField);
            
            if (!field) {
                console.warn(`⚠️ Warning: Field definition not found for ${valueField}`);
                return;
            }
            
            // Get measure name
            const measureName = field.measureName || valueField;
            
            // Calculate the value for this row (sum by default)
            let value = 0;
            
            if (rowData && Array.isArray(rowData)) {
                value = rowData.reduce((sum, record) => {
                    const recordValue = parseFloat(record[measureName]) || 0;
                    return sum + recordValue;
                }, 0);
            }
            
            // Store the value even for Total column
            const valueKey = `Total_${measureName}`;
            pivotData.values[row._id][valueKey] = value;
        });
    });
    
    console.log("✅ Status: Intersection calculations complete");
    return pivotData;
}


/**
 * Render the pivot table to the DOM
 * @param {Object} pivotData - Processed pivot data
 * @param {Object} rowResult - Processed row data
 * @param {Object} columnResult - Processed column data
 */
function renderPivotTable(pivotData, rowResult, columnResult) {
    // Get the table elements
    const tableHeader = document.getElementById('pivotTableHeader');
    const tableBody = document.getElementById('pivotTableBody');
    
    if (!tableHeader || !tableBody) {
        console.error("❌ Error: Pivot table elements not found in DOM");
        return;
    }
    
    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Set up column groups for proper sizing
    setupColumnGroups(columnResult);
    
    // Render column headers
    renderColumnHeaders(tableHeader, columnResult, rowResult);
    
    // Render rows with values
    renderTableRows(tableBody, pivotData, rowResult, columnResult);
    
    // Apply auto-size to columns after rendering
    autoSizeColumns();
}


/**
 * Set up column groups for proper sizing
 * @param {Object} columnResult - Processed column data
 */
function setupColumnGroups(columnResult) {
    const table = document.getElementById('pivotTable');
    const colgroup = document.createElement('colgroup');
    
    // Count the number of row dimensions
    const rowDimensionCount = state.rowFields ? state.rowFields.length : 1;
    
    // Add columns for row headers
    for (let i = 0; i < rowDimensionCount; i++) {
        const rowHeaderCol = document.createElement('col');
        rowHeaderCol.className = 'row-header-col';
        colgroup.appendChild(rowHeaderCol);
    }
    
    // Add columns for each leaf column and measure combination
    const leafColumns = columnResult.headers.filter(col => col.isLeaf || col.level === columnResult.depths.length - 1);
    
    // If no leaf columns but we have value fields, add one column per value field
    if ((leafColumns.length === 0 || (leafColumns.length === 1 && leafColumns[0].id === 'Total')) && 
        state.valueFields && state.valueFields.length > 0) {
        
        state.valueFields.forEach(valueField => {
            const colEl = document.createElement('col');
            colEl.className = 'data-col';
            colEl.setAttribute('data-field-id', valueField);
            colgroup.appendChild(colEl);
        });
    } else {
        // For each leaf column, add columns for each value field
        leafColumns.forEach(col => {
            if (state.valueFields && state.valueFields.length > 0) {
                state.valueFields.forEach(valueField => {
                    const colEl = document.createElement('col');
                    colEl.className = 'data-col';
                    colEl.setAttribute('data-col-id', col.id);
                    colEl.setAttribute('data-field-id', valueField);
                    colgroup.appendChild(colEl);
                });
            } else {
                // If no value fields, add one column per leaf column
                const colEl = document.createElement('col');
                colEl.className = 'data-col';
                colEl.setAttribute('data-col-id', col.id);
                colgroup.appendChild(colEl);
            }
        });
    }
    
    // Replace existing colgroup
    const existingColgroup = table.querySelector('colgroup');
    if (existingColgroup) {
        table.replaceChild(colgroup, existingColgroup);
    } else {
        table.insertBefore(colgroup, table.firstChild);
    }
}


/**
 * Render column headers in the table header
 * @param {HTMLElement} tableHeader - The table header element
 * @param {Object} columnResult - Processed column data
 * @param {Object} rowResult - Processed row data
 */
// function renderColumnHeaders(tableHeader, columnResult, rowResult) {
//     // Clear the existing header content
//     tableHeader.innerHTML = '';
//     console.log("Rendering column headers with:", columnResult);
    
//     // Get labels for row fields
//     const rowFieldLabels = state.rowFields.map(fieldId => {
//         const field = state.availableFields.find(f => f.id === fieldId);
//         return { id: fieldId, label: field ? field.label : fieldId };
//     });
    
//     // Get value field labels
//     const valueFieldLabels = state.valueFields.map(fieldId => {
//         const field = state.availableFields.find(f => f.id === fieldId);
//         return { id: fieldId, label: field ? field.label : fieldId };
//     });
    
//     // Create a header row for row dimension labels (the LE, COST_ELEMENT headers)
//     const dimensionHeaderRow = document.createElement('tr');
//     dimensionHeaderRow.className = 'dimension-header-row';
    
//     // Add dimension header cells for each row field
//     rowFieldLabels.forEach(field => {
//         const cell = document.createElement('th');
//         cell.className = 'dimension-header-cell';
//         cell.textContent = field.label;
//         cell.setAttribute('data-field-id', field.id);
//         cell.style.textAlign = 'center';
//         dimensionHeaderRow.appendChild(cell);
//     });
    
//     // Add single header cell for measures in first row
//     if (valueFieldLabels.length > 0) {
//         // Calculate colspan for the header cell (all leaf columns * number of measures)
//         const leafColumns = columnResult.headers.filter(col => 
//             col.isLeaf || col.level === Math.max(...columnResult.depths.map((_, i) => i)));
//         const leafCount = Math.max(1, leafColumns.length);
        
//         const measureHeaderCell = document.createElement('th');
//         measureHeaderCell.className = 'measures-group-header';
//         measureHeaderCell.textContent = valueFieldLabels.length > 1 ? 'Measures' : valueFieldLabels[0].label;
//         measureHeaderCell.colSpan = leafCount;
//         measureHeaderCell.style.textAlign = 'center';
//         dimensionHeaderRow.appendChild(measureHeaderCell);
//     }
    
//     // Add dimension header row as the first row
//     tableHeader.appendChild(dimensionHeaderRow);
    
//     // Check if we have column fields
//     if (columnResult.depths.length > 0 && columnResult.headers.length > 0) {
//         // Group headers by level
//         const headersByLevel = {};
//         columnResult.headers.forEach(header => {
//             const level = header.level || 0;
//             headersByLevel[level] = headersByLevel[level] || [];
//             headersByLevel[level].push(header);
//         });
        
//         // Get unique levels and sort them
//         const levels = Object.keys(headersByLevel).map(Number).sort((a, b) => a - b);
        
//         // Create a row for each level
//         levels.forEach(level => {
//             const levelRow = document.createElement('tr');
//             levelRow.className = `column-header-row header-level-${level}`;
            
//             // Add empty cells for row fields
//             const rowHeaderCell = document.createElement('th');
//             rowHeaderCell.className = 'row-header-cell corner-header';
//             rowHeaderCell.colSpan = rowFieldLabels.length || 1;
//             levelRow.appendChild(rowHeaderCell);
            
//             // Add headers for this level
//             const levelHeaders = headersByLevel[level] || [];
            
//             // Add all headers for this level
//             levelHeaders.forEach(header => {
//                 const cell = document.createElement('th');
//                 cell.className = `column-header ${header.isLeaf ? 'leaf-column' : 'parent-column'}`;
//                 cell.colSpan = header.colspan * (valueFieldLabels.length || 1);
                
//                 // Create header content with expand/collapse control if needed
//                 let headerContent = '';
                
//                 // Add expand/collapse button for hierarchical dimensions with children
//                 if (header.isHierarchical && header.hasChildren && !header.isLeaf) {
//                     headerContent += `<span class="expand-collapse-btn ${header.expanded ? 'expanded' : 'collapsed'}" 
//                                       data-column-id="${header.id}" onclick="handleColumnExpandCollapse(event)">
//                                       ${header.expanded ? '−' : '+'}
//                                       </span>`;
//                 }
                
//                 // Add label
//                 headerContent += `<span class="column-label">${header.label}</span>`;
                
//                 cell.innerHTML = headerContent;
                
//                 // Add data attributes for identification
//                 cell.setAttribute('data-column-id', header.id);
//                 cell.setAttribute('data-column-level', header.level);
//                 if (header.originalCol && header.originalCol.dimensionName) {
//                     cell.setAttribute('data-dimension-name', header.originalCol.dimensionName);
//                 }
//                 if (header.isHierarchical !== undefined) {
//                     cell.setAttribute('data-hierarchical', header.isHierarchical);
//                 }
                
//                 // Add to row
//                 levelRow.appendChild(cell);
//             });
            
//             // Add to header
//             tableHeader.appendChild(levelRow);
//         });
//     }
    
//     // Last row: Measure headers (but only if not already shown in first row)
//     if (valueFieldLabels.length > 1 || (columnResult.depths && columnResult.depths.length > 0)) {
//         const measureRow = document.createElement('tr');
//         measureRow.className = 'measure-header-row';
        
//         // Add empty cell for row dimensions
//         const emptyCell = document.createElement('th');
//         emptyCell.className = 'empty-header-cell';
//         emptyCell.colSpan = rowFieldLabels.length || 1;
//         measureRow.appendChild(emptyCell);
        
//         // Get all leaf columns
//         const leafColumns = columnResult.headers.filter(col => 
//             col.isLeaf || col.level === Math.max(...columnResult.depths.map((_, i) => i)));
        
//         // If no column fields are selected, just add measure headers directly
//         if (leafColumns.length === 0) {
//             // For each value field, create a header cell
//             valueFieldLabels.forEach(field => {
//                 const cell = document.createElement('th');
//                 cell.className = 'measure-header-cell';
//                 cell.textContent = field.label;
//                 cell.setAttribute('data-measure', field.id);
                
//                 measureRow.appendChild(cell);
//             });
//         } else {
//             // For each leaf column, create headers for each value field
//             leafColumns.forEach(column => {
//                 // Skip the Total column if needed
//                 if (column.id === 'Total' && column.label === 'Total') {
//                     return; // Skip this iteration
//                 }
                
//                 valueFieldLabels.forEach(field => {
//                     const cell = document.createElement('th');
//                     cell.className = 'measure-header-cell';
//                     cell.textContent = field.label;
                    
//                     // Add attributes for identification
//                     cell.setAttribute('data-column-id', column.id);
//                     cell.setAttribute('data-measure', field.id);
                    
//                     measureRow.appendChild(cell);
//                 });
//             });
//         }
        
//         // Add to header only if it has children (measures)
//         if (measureRow.childNodes.length > 1) {
//             tableHeader.appendChild(measureRow);
//         }
//     }
    
//     // Trigger auto-width adjustment
//     setTimeout(() => {
//         document.dispatchEvent(new Event('pivotTableGenerated'));
//     }, 0);
// }
function renderColumnHeaders(tableHeader, columnResult, rowResult) {
    // Clear the existing header content
    tableHeader.innerHTML = '';
    
    // Get labels for row fields
    const rowFieldLabels = state.rowFields.map(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        return { id: fieldId, label: field ? field.label : fieldId };
    });
    
    // Get value field labels
    const valueFieldLabels = state.valueFields.map(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        return { id: fieldId, label: field ? field.label : fieldId };
    });
    
    // Create a header row for row dimension labels
    const dimensionHeaderRow = document.createElement('tr');
    dimensionHeaderRow.className = 'dimension-header-row';
    
    // Add dimension header cells for each row field
    rowFieldLabels.forEach(field => {
        const cell = document.createElement('th');
        cell.className = 'dimension-header-cell';
        cell.textContent = field.label;
        cell.setAttribute('data-field-id', field.id);
        cell.style.textAlign = 'center';
        dimensionHeaderRow.appendChild(cell);
    });
    
    // Add single header cell for measures in first row
    if (valueFieldLabels.length > 0) {
        // Calculate colspan for the header cell (all leaf columns * number of measures)
        const leafColumns = columnResult.headers.filter(col => 
            col.isLeaf || col.level === Math.max(...columnResult.depths.map((_, i) => i)));
        const leafCount = Math.max(1, leafColumns.length) * valueFieldLabels.length;
        
        const measureHeaderCell = document.createElement('th');
        measureHeaderCell.className = 'measures-group-header';
        measureHeaderCell.textContent = 'Measures';
        measureHeaderCell.colSpan = leafCount;
        measureHeaderCell.style.textAlign = 'center';
        dimensionHeaderRow.appendChild(measureHeaderCell);
    }
    
    // Add dimension header row as the first row
    tableHeader.appendChild(dimensionHeaderRow);
    
    // Handle column fields section
    if (columnResult.depths.length > 0 && columnResult.headers.length > 0) {
        // Group headers by level
        const headersByLevel = {};
        columnResult.headers.forEach(header => {
            const level = header.level || 0;
            headersByLevel[level] = headersByLevel[level] || [];
            headersByLevel[level].push(header);
        });
        
        // Get unique levels and sort them
        const levels = Object.keys(headersByLevel).map(Number).sort((a, b) => a - b);
        
        // Create a row for each level
        levels.forEach(level => {
            const levelRow = document.createElement('tr');
            levelRow.className = `column-header-row header-level-${level}`;
            
            // Add empty cells for row fields
            const rowHeaderCell = document.createElement('th');
            rowHeaderCell.className = 'row-header-cell corner-header';
            rowHeaderCell.colSpan = rowFieldLabels.length || 1;
            levelRow.appendChild(rowHeaderCell);
            
            // Add headers for this level
            const levelHeaders = headersByLevel[level] || [];
            
            // Add all headers for this level
            levelHeaders.forEach(header => {
                const cell = document.createElement('th');
                cell.className = `column-header ${header.isLeaf ? 'leaf-column' : 'parent-column'}`;
                cell.colSpan = header.colspan * (valueFieldLabels.length || 1);
                
                // Create header content with expand/collapse control if needed
                let headerContent = '';
                
                // Add expand/collapse button for hierarchical dimensions with children
                if (header.isHierarchical && header.hasChildren && !header.isLeaf) {
                    headerContent += `<span class="expand-collapse-btn ${header.expanded ? 'expanded' : 'collapsed'}" 
                                      data-column-id="${header.id}" onclick="handleColumnExpandCollapse(event)">
                                      ${header.expanded ? '−' : '+'}
                                      </span>`;
                }
                
                // Add label
                headerContent += `<span class="column-label">${header.label}</span>`;
                
                cell.innerHTML = headerContent;
                
                // Add data attributes for identification
                cell.setAttribute('data-column-id', header.id);
                cell.setAttribute('data-column-level', header.level);
                if (header.originalCol && header.originalCol.dimensionName) {
                    cell.setAttribute('data-dimension-name', header.originalCol.dimensionName);
                }
                if (header.isHierarchical !== undefined) {
                    cell.setAttribute('data-hierarchical', header.isHierarchical);
                }
                
                // Add to row
                levelRow.appendChild(cell);
            });
            
            // Add to header
            tableHeader.appendChild(levelRow);
        });
    }
    
    // Add measure identifiers but not as separate headers if we have columns
    if (valueFieldLabels.length > 1 && columnResult.depths && columnResult.depths.length > 0) {
        const measureRow = document.createElement('tr');
        measureRow.className = 'measure-header-row';
        
        // Add empty cell for row dimensions
        const emptyCell = document.createElement('th');
        emptyCell.className = 'empty-header-cell';
        emptyCell.colSpan = rowFieldLabels.length || 1;
        measureRow.appendChild(emptyCell);
        
        // Get all leaf columns
        const leafColumns = columnResult.headers.filter(col => 
            col.isLeaf || col.level === Math.max(...columnResult.depths.map((_, i) => i)));
        
        // For each leaf column, create headers for each value field
        leafColumns.forEach(column => {
            // Skip the Total column if needed
            if (column.id === 'Total' && column.label === 'Total') {
                return; // Skip this iteration
            }
            
            valueFieldLabels.forEach(field => {
                const cell = document.createElement('th');
                cell.className = 'measure-header-cell';
                cell.textContent = field.label;
                
                // Add attributes for identification
                cell.setAttribute('data-column-id', column.id);
                cell.setAttribute('data-measure', field.id);
                
                measureRow.appendChild(cell);
            });
        });
        
        // Add to header
        tableHeader.appendChild(measureRow);
    } else if (valueFieldLabels.length > 0 && (!columnResult.depths || columnResult.depths.length === 0)) {
        // If no column fields, add measure headers directly in a row
        const measureRow = document.createElement('tr');
        measureRow.className = 'measure-header-row';
        
        // Add empty cell for row dimensions
        const emptyCell = document.createElement('th');
        emptyCell.className = 'empty-header-cell';
        emptyCell.colSpan = rowFieldLabels.length || 1;
        measureRow.appendChild(emptyCell);
        
        // Add measure headers
        valueFieldLabels.forEach(field => {
            const cell = document.createElement('th');
            cell.className = 'measure-header-cell';
            cell.textContent = field.label;
            cell.setAttribute('data-measure', field.id);
            
            measureRow.appendChild(cell);
        });
        
        // Add to header
        tableHeader.appendChild(measureRow);
    }
    
    // Trigger auto-width adjustment
    setTimeout(() => {
        document.dispatchEvent(new Event('pivotTableGenerated'));
    }, 0);
}


/**
 * Create row header cells - NEW HELPER FUNCTION
 * This makes row header cells auto-expandable (requirement #4)
 */
function createAutoExpandableRowHeaderCell(field) {
    const cell = document.createElement('th');
    cell.className = 'dimension-header-cell';
    cell.textContent = field.label;
    cell.setAttribute('data-field-id', field.id);
    
    // Add auto-expandable styling
    cell.style.textAlign = 'center';
    cell.style.whiteSpace = 'nowrap';
    cell.style.overflow = 'hidden';
    cell.style.textOverflow = 'ellipsis';
    cell.style.minWidth = '150px'; // Minimum width
    cell.style.maxWidth = '300px'; // Maximum width
    
    // Add auto-width calculation on window resize
    // This will be called via a script that gets added to the page
    cell.classList.add('auto-expandable-cell');
    
    return cell;
}


/**
 * Render table rows with values
 * @param {HTMLElement} tableBody - The table body element
 * @param {Object} pivotData - Processed pivot data
 * @param {Object} rowResult - Processed row data
 * @param {Object} columnResult - Processed column data
 */
// function renderTableRows(tableBody, pivotData, rowResult, columnResult) {
//     // Clear the table body first
//     tableBody.innerHTML = '';
    
//     // Log for debugging
//     console.log("Rendering table rows with pivotData:", pivotData);
//     console.log("Row result:", rowResult);
//     console.log("Column result:", columnResult);
    
//     // Get the rows to render
//     const rowsToRender = pivotData.rows;
    
//     // Get columns to render (only leaf columns)
//     const columnsToRender = columnResult.headers.filter(col => 
//         col.isLeaf || col.level === columnResult.depths.length - 1);
    
//     // Special case: if no column fields are selected, but we have value fields
//     const isValueFieldsOnly = (!columnsToRender || columnsToRender.length === 0 || 
//                              (columnsToRender.length === 1 && columnsToRender[0].id === 'Total')) &&
//                              state.valueFields && state.valueFields.length > 0;
    
//     // Check if we have multiple row dimensions
//     const hasMultipleRowDimensions = state.rowFields && state.rowFields.length > 1;
    
//     // Check if we have any rows
//     if (!rowsToRender || rowsToRender.length === 0) {
//         // Create a single row for "No data" message
//         const noDataRow = document.createElement('tr');
//         noDataRow.className = 'no-data-row';
        
//         const noDataCell = document.createElement('td');
//         noDataCell.className = 'no-data-cell';
//         noDataCell.colSpan = columnsToRender.length + (state.rowFields ? state.rowFields.length : 1);
//         noDataCell.textContent = 'No data to display';
        
//         noDataRow.appendChild(noDataCell);
//         tableBody.appendChild(noDataRow);
//         return;
//     }
    
//     // Function to create row header cells based on whether we have multi-dimension rows
//     function createRowHeaderCells(row, rowElement) {
//         if (hasMultipleRowDimensions && row.dimensions) {
//             // For multi-dimension rows, create a cell for each dimension
//             row.dimensions.forEach((dimension, index) => {
//                 const headerCell = document.createElement('td');
//                 headerCell.className = 'row-header-cell';
                
//                 // Create header content
//                 let headerContent = '';
                
//                 // Add proper indentation for last dimension only
//                 if (index === row.dimensions.length - 1) {
//                     const indentation = `<span class="row-indent" style="width:${(dimension.level || 0) * 20}px"></span>`;
                    
//                     if (dimension.hasChildren && !dimension.isLeaf) {
//                         // Add expand/collapse button for rows with children
//                         headerContent += `${indentation}<span class="expand-collapse-btn ${dimension.expanded ? 'expanded' : 'collapsed'}" 
//                                            data-row-id="${row._id}" data-dimension-index="${index}" onclick="handleRowExpandCollapse(event)">
//                                           ${dimension.expanded ? '−' : '+'}
//                                           </span>`;
//                     } else {
//                         headerContent += indentation;
//                     }
//                 }
                
//                 // Add label
//                 headerContent += `<span class="row-label">${dimension.label}</span>`;
                
//                 headerCell.innerHTML = headerContent;
//                 rowElement.appendChild(headerCell);
//             });
//         } else {
//             // Single dimension row
//             const rowHeaderCell = document.createElement('td');
//             rowHeaderCell.className = 'row-header-cell';
            
//             // Create header content with expand/collapse control if needed
//             let headerContent = '';
            
//             // Add proper indentation based on level
//             const indentation = `<span class="row-indent" style="width:${(row.level || 0) * 20}px"></span>`;
            
//             if (row.hasChildren && !row.isLeaf) {
//                 // Add expand/collapse button for rows with children
//                 headerContent += `${indentation}<span class="expand-collapse-btn ${row.expanded ? 'expanded' : 'collapsed'}" 
//                                    data-row-id="${row._id}" onclick="handleRowExpandCollapse(event)">
//                                   ${row.expanded ? '−' : '+'}
//                                   </span>`;
//             } else {
//                 headerContent += indentation;
//             }
            
//             // Add label
//             headerContent += `<span class="row-label">${row.label || ''}</span>`;
            
//             rowHeaderCell.innerHTML = headerContent;
//             rowElement.appendChild(rowHeaderCell);
//         }
//     }
    
//     // Render each row
//     rowsToRender.forEach((row, rowIndex) => {
//         console.log(`Rendering row ${rowIndex}: ${row._id}, Label: ${row.label}`);
        
//         // Create row element
//         const rowElement = document.createElement('tr');
//         rowElement.className = `data-row ${row.isLeaf ? 'leaf-row' : 'parent-row'} level-${row.level || 0}`;
//         rowElement.setAttribute('data-row-id', row._id);
        
//         // Add row header cell(s)
//         createRowHeaderCells(row, rowElement);
        
//         // Debug info about values for this row
//         console.log(`Values for row ${row._id}:`, pivotData.values && pivotData.values[row._id] ? 
//                      Object.keys(pivotData.values[row._id]) : "No values");
        
//         if (isValueFieldsOnly) {
//             // Special case handling when we have only value fields
//             state.valueFields.forEach(valueField => {
//                 // Find the field definition
//                 const field = state.availableFields.find(f => f.id === valueField);
//                 if (!field) return;
                
//                 // Create value cell
//                 const valueCell = document.createElement('td');
//                 valueCell.className = 'value-cell';
                
//                 // Get the value
//                 const valueKey = `Total_${field.measureName || valueField}`;
//                 const value = pivotData.values && pivotData.values[row._id] ? 
//                       pivotData.values[row._id][valueKey] || 0 : 0;
                
//                 // Debug value
//                 console.log(`Value for row ${row._id}, field ${field.id}, key ${valueKey}:`, value);
                
//                 // Format the value
//                 valueCell.textContent = formatValue(value);
                
//                 // Add classes based on value
//                 if (value !== 0) valueCell.classList.add('non-zero-value');
//                 if (value < 0) valueCell.classList.add('negative-value');
//                 if (Math.abs(value) > 1000) valueCell.classList.add('large-value');
//                 else if (Math.abs(value) > 100) valueCell.classList.add('medium-value');
                
//                 // Add attributes for identification
//                 valueCell.setAttribute('data-row-id', row._id);
//                 valueCell.setAttribute('data-column-id', 'Total');
//                 valueCell.setAttribute('data-measure', field.measureName || valueField);
//                 valueCell.setAttribute('data-value', value);
                
//                 rowElement.appendChild(valueCell);
//             });
//         } else {
//             // Add value cells for each column and measure
//             columnsToRender.forEach(column => {
//                 state.valueFields.forEach(valueField => {
//                     // Find the field definition
//                     const field = state.availableFields.find(f => f.id === valueField);
//                     if (!field) return;
                    
//                     // Create value cell
//                     const valueCell = document.createElement('td');
//                     valueCell.className = 'value-cell';
                    
//                     // Get the value key - try different formats to ensure we find the value
//                     let valueKey = null;
//                     let value = 0;
                    
//                     // Try standard key format
//                     valueKey = `${column.id}_${field.measureName || valueField}`;
//                     if (pivotData.values && pivotData.values[row._id] && 
//                         pivotData.values[row._id][valueKey] !== undefined) {
//                         value = pivotData.values[row._id][valueKey];
//                     } 
//                     // Try alternative formats if first attempt gives undefined
//                     else {
//                         const alternateKeys = [
//                             `${column.id}_${valueField}`,
//                             `${column.originId || column.id}_${field.measureName || valueField}`,
//                             `${column.originId || column.id}_${valueField}`,
//                             `Total_${field.measureName || valueField}`,
//                             `${field.measureName || valueField}`
//                         ];
                        
//                         for (const altKey of alternateKeys) {
//                             if (pivotData.values && pivotData.values[row._id] && 
//                                 pivotData.values[row._id][altKey] !== undefined) {
//                                 value = pivotData.values[row._id][altKey];
//                                 valueKey = altKey;
//                                 console.log(`Found value using alternate key ${altKey}`);
//                                 break;
//                             }
//                         }
//                     }
                    
//                     // Debug value
//                     console.log(`Value for row ${row._id}, column ${column.id}, field ${field.id}, key ${valueKey}:`, value);
                    
//                     // Format the value
//                     valueCell.textContent = formatValue(value);
                    
//                     // Add classes based on value
//                     if (value !== 0) valueCell.classList.add('non-zero-value');
//                     if (value < 0) valueCell.classList.add('negative-value');
//                     if (Math.abs(value) > 1000) valueCell.classList.add('large-value');
//                     else if (Math.abs(value) > 100) valueCell.classList.add('medium-value');
                    
//                     // Add attributes for identification
//                     valueCell.setAttribute('data-row-id', row._id);
//                     valueCell.setAttribute('data-column-id', column.id);
//                     valueCell.setAttribute('data-measure', field.measureName || valueField);
//                     valueCell.setAttribute('data-value', value);
                    
//                     rowElement.appendChild(valueCell);
//                 });
//             });
//         }
        
//         // Add to table body
//         tableBody.appendChild(rowElement);
//     });
// }
function renderTableRows(tableBody, pivotData, rowResult, columnResult) {
    // Clear the table body first
    tableBody.innerHTML = '';
    
    // Get the rows to render
    const rowsToRender = pivotData.rows;
    
    // Get columns to render (only leaf columns)
    const columnsToRender = columnResult.headers.filter(col => 
        col.isLeaf || col.level === columnResult.depths.length - 1);
    
    // Special case: if no column fields are selected, but we have value fields
    const isValueFieldsOnly = (!columnsToRender || columnsToRender.length === 0 || 
                             (columnsToRender.length === 1 && columnsToRender[0].id === 'Total')) &&
                             state.valueFields && state.valueFields.length > 0;
    
    // Check if we have multiple row dimensions
    const hasMultipleRowDimensions = state.rowFields && state.rowFields.length > 1;
    
    // Check if we have any rows
    if (!rowsToRender || rowsToRender.length === 0) {
        // Create a single row for "No data" message
        const noDataRow = document.createElement('tr');
        noDataRow.className = 'no-data-row';
        
        const noDataCell = document.createElement('td');
        noDataCell.className = 'no-data-cell';
        noDataCell.colSpan = (columnsToRender.length * state.valueFields.length) + 
                            (state.rowFields ? state.rowFields.length : 1);
        noDataCell.textContent = 'No data to display';
        
        noDataRow.appendChild(noDataCell);
        tableBody.appendChild(noDataRow);
        return;
    }
    
    // Function to create row header cells
    function createRowHeaderCells(row, rowElement) {
        if (hasMultipleRowDimensions && row.dimensions) {
            // For multi-dimension rows, create a cell for each dimension
            row.dimensions.forEach((dimension, index) => {
                const headerCell = document.createElement('td');
                headerCell.className = 'row-header-cell';
                
                // Create header content
                let headerContent = '';
                
                // Add proper indentation for last dimension only
                if (index === row.dimensions.length - 1) {
                    const indentation = `<span class="row-indent" style="width:${(dimension.level || 0) * 20}px"></span>`;
                    
                    if (dimension.hasChildren && !dimension.isLeaf) {
                        // Add expand/collapse button for rows with children
                        headerContent += `${indentation}<span class="expand-collapse-btn ${dimension.expanded ? 'expanded' : 'collapsed'}" 
                                           data-row-id="${row._id}" data-dimension-index="${index}" onclick="handleRowExpandCollapse(event)">
                                          ${dimension.expanded ? '−' : '+'}
                                          </span>`;
                    } else {
                        headerContent += indentation;
                    }
                }
                
                // Add label
                headerContent += `<span class="row-label">${dimension.label}</span>`;
                
                headerCell.innerHTML = headerContent;
                rowElement.appendChild(headerCell);
            });
        } else {
            // Single dimension row
            const rowHeaderCell = document.createElement('td');
            rowHeaderCell.className = 'row-header-cell';
            
            // Create header content with expand/collapse control if needed
            let headerContent = '';
            
            // Add proper indentation based on level
            const indentation = `<span class="row-indent" style="width:${(row.level || 0) * 20}px"></span>`;
            
            if (row.hasChildren && !row.isLeaf) {
                // Add expand/collapse button for rows with children
                headerContent += `${indentation}<span class="expand-collapse-btn ${row.expanded ? 'expanded' : 'collapsed'}" 
                                   data-row-id="${row._id}" onclick="handleRowExpandCollapse(event)">
                                  ${row.expanded ? '−' : '+'}
                                  </span>`;
            } else {
                headerContent += indentation;
            }
            
            // Add label
            headerContent += `<span class="row-label">${row.label || ''}</span>`;
            
            rowHeaderCell.innerHTML = headerContent;
            rowElement.appendChild(rowHeaderCell);
        }
    }
    
    // Render each row
    rowsToRender.forEach((row, rowIndex) => {
        // Create row element
        const rowElement = document.createElement('tr');
        rowElement.className = `data-row ${row.isLeaf ? 'leaf-row' : 'parent-row'} level-${row.level || 0}`;
        rowElement.setAttribute('data-row-id', row._id);
        
        // Add row header cell(s)
        createRowHeaderCells(row, rowElement);
        
        if (isValueFieldsOnly) {
            // Special case handling when we have only value fields
            state.valueFields.forEach(valueField => {
                // Find the field definition
                const field = state.availableFields.find(f => f.id === valueField);
                if (!field) return;
                
                // Create value cell
                const valueCell = document.createElement('td');
                valueCell.className = 'value-cell';
                
                // Get the value
                const valueKey = `Total_${field.measureName || valueField}`;
                const value = pivotData.values && pivotData.values[row._id] ? 
                      pivotData.values[row._id][valueKey] || 0 : 0;
                
                // Format the value
                valueCell.textContent = formatValue(value);
                
                // Add classes based on value
                if (value !== 0) valueCell.classList.add('non-zero-value');
                if (value < 0) valueCell.classList.add('negative-value');
                if (Math.abs(value) > 1000) valueCell.classList.add('large-value');
                else if (Math.abs(value) > 100) valueCell.classList.add('medium-value');
                
                // Add attributes for identification
                valueCell.setAttribute('data-row-id', row._id);
                valueCell.setAttribute('data-column-id', 'Total');
                valueCell.setAttribute('data-measure', field.measureName || valueField);
                valueCell.setAttribute('data-value', value);
                
                rowElement.appendChild(valueCell);
            });
        } else {
            // Add value cells for each column and measure combination
            columnsToRender.forEach(column => {
                state.valueFields.forEach(valueField => {
                    // Find the field definition
                    const field = state.availableFields.find(f => f.id === valueField);
                    if (!field) return;
                    
                    // Create value cell
                    const valueCell = document.createElement('td');
                    valueCell.className = 'value-cell';
                    
                    // Get the value key - try different formats to ensure we find the value
                    let valueKey = null;
                    let value = 0;
                    
                    // Try standard key format
                    valueKey = `${column.id}_${field.measureName || valueField}`;
                    if (pivotData.values && pivotData.values[row._id] && 
                        pivotData.values[row._id][valueKey] !== undefined) {
                        value = pivotData.values[row._id][valueKey];
                    } 
                    // Try alternative formats if first attempt gives undefined
                    else {
                        const alternateKeys = [
                            `${column.id}_${valueField}`,
                            `${column.originId || column.id}_${field.measureName || valueField}`,
                            `${column.originId || column.id}_${valueField}`,
                            `Total_${field.measureName || valueField}`,
                            `${field.measureName || valueField}`
                        ];
                        
                        for (const altKey of alternateKeys) {
                            if (pivotData.values && pivotData.values[row._id] && 
                                pivotData.values[row._id][altKey] !== undefined) {
                                value = pivotData.values[row._id][altKey];
                                valueKey = altKey;
                                break;
                            }
                        }
                    }
                    
                    // Format the value
                    valueCell.textContent = formatValue(value);
                    
                    // Add classes based on value
                    if (value !== 0) valueCell.classList.add('non-zero-value');
                    if (value < 0) valueCell.classList.add('negative-value');
                    if (Math.abs(value) > 1000) valueCell.classList.add('large-value');
                    else if (Math.abs(value) > 100) valueCell.classList.add('medium-value');
                    
                    // Add attributes for identification
                    valueCell.setAttribute('data-row-id', row._id);
                    valueCell.setAttribute('data-column-id', column.id);
                    valueCell.setAttribute('data-measure', field.measureName || valueField);
                    valueCell.setAttribute('data-value', value);
                    
                    rowElement.appendChild(valueCell);
                });
            });
        }
        
        // Add to table body
        tableBody.appendChild(rowElement);
    });
}


// This function is used to initialize pivot appearance changes
function applyPivotTableEnhancements() {
    // 1. Add the additional styles
    const styleElement = document.createElement('style');
    styleElement.textContent = additionalRowDimensionStyles;
    document.head.appendChild(styleElement);
    
    // 2. Return function to be called after initial render
    return function() {
        // Apply any post-render adjustments like adjusting specific column widths
        const measureHeaders = document.querySelectorAll('th.measure-header-cell');
        measureHeaders.forEach(header => {
            header.style.backgroundColor = '#e3f2fd';
        });
        
        // Apply highlighting to row headers
        const rowHeaders = document.querySelectorAll('td.row-header-cell');
        rowHeaders.forEach(header => {
            if (header.parentNode.classList.contains('level-0')) {
                header.style.fontWeight = '600';
            }
        });
        
        // Apply consistent styling to the measures header
        const measuresGroupHeader = document.querySelector('th.measures-group-header');
        if (measuresGroupHeader) {
            measuresGroupHeader.style.backgroundColor = '#e3f2fd';
            measuresGroupHeader.style.color = '#0366d6';
            measuresGroupHeader.style.fontWeight = '600';
        }
    };
}



/**
 * Format a numeric value for display
 * @param {number} value - The value to format
 * @returns {string} - Formatted value as string
 */
function formatValue(value) {
    // Get format settings from UI if available
    const formatSelect = document.getElementById('valueFormat');
    const decimalSelect = document.getElementById('decimalPlaces');
    
    // Default values if UI elements aren't found
    const format = formatSelect ? formatSelect.value : 'regular';
    const decimals = decimalSelect ? parseInt(decimalSelect.value) : 2;
    
    // Ensure value is a number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return '0.00';
    }
    
    // Apply format - with proper rounding and handling
    try {
        if (format === 'thousands') {
            // Format as thousands with K suffix
            return (numValue / 1000).toFixed(decimals) + 'K';
        } else if (format === 'millions') {
            // Format as millions with M suffix
            return (numValue / 1000000).toFixed(decimals) + 'M';
        } else if (format === 'percentage') {
            // Format as percentage
            return (numValue * 100).toFixed(decimals) + '%';
        } else {
            // Default formatting - regular numbers
            // Add thousand separators for larger numbers
            return numValue.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        }
    } catch (error) {
        console.error("Error formatting value:", error);
        // Fallback to basic formatting if error occurs
        return numValue.toFixed(decimals);
    }
}


/**
 * Auto-size columns based on content
 */
function autoSizeColumns() {
    // We'll use JavaScript to size columns based on content
    const table = document.getElementById('pivotTable');
    if (!table) return;
    
    // Get all cells in the first row to use as a starting point
    const firstRow = table.querySelector('tr');
    if (!firstRow) return;
    
    const cells = firstRow.querySelectorAll('th, td');
    
    // For each cell, check its content width and adjust column if needed
    cells.forEach((cell, index) => {
        const content = cell.textContent;
        
        // Create a temporary span to measure text width
        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.whiteSpace = 'nowrap';
        span.textContent = content;
        document.body.appendChild(span);
        
        // Measure content width
        const contentWidth = span.offsetWidth;
        document.body.removeChild(span);
        
        // Set minimum width based on content plus padding
        const minWidth = Math.max(60, contentWidth + 24); // 24px for padding
        
        // Get corresponding col element
        const colElements = table.querySelectorAll('col');
        if (index < colElements.length) {
            colElements[index].style.minWidth = minWidth + 'px';
        }
    });
}


/**
 * Display a message when no data is available
 */
function displayNoDataMessage() {
    const tableHeader = document.getElementById('pivotTableHeader');
    const tableBody = document.getElementById('pivotTableBody');
    
    if (!tableHeader || !tableBody) return;
    
    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Create a header row
    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('th');
    headerCell.textContent = 'Status';
    headerRow.appendChild(headerCell);
    tableHeader.appendChild(headerRow);
    
    // Create a data row
    const dataRow = document.createElement('tr');
    const dataCell = document.createElement('td');
    dataCell.textContent = 'No data available. Please load data and select fields.';
    dataCell.style.padding = '20px';
    dataCell.style.textAlign = 'center';
    dataRow.appendChild(dataCell);
    tableBody.appendChild(dataRow);
}


/**
 * Update pivot table statistics in the UI
 * @param {Object} pivotData - Processed pivot data
 * @param {Object} rowResult - Processed row data
 * @param {Object} columnResult - Processed column data
 */
function updatePivotStats(pivotData, rowResult, columnResult) {
    // Update row count
    const rowCountElement = document.getElementById('rowCount');
    if (rowCountElement) {
        const visibleRows = rowResult.flatRows.length;
        const totalRows = state.factData ? state.factData.length : 0;
        rowCountElement.textContent = `${visibleRows} rows (from ${totalRows} records)`;
    }
    
    // Update column count
    const columnCountElement = document.getElementById('columnCount');
    if (columnCountElement) {
        const valueFieldCount = state.valueFields ? state.valueFields.length : 0;
        const leafColumns = columnResult.headers.filter(col => 
            col.isLeaf || col.level === columnResult.depths.length - 1).length;
        const totalCells = leafColumns * valueFieldCount;
        
        columnCountElement.textContent = `${totalCells} columns`;
    }
}


/**
 * Handle row expand/collapse action
 * @param {Event} event - The click event
 */
function handleRowExpandCollapse(event) {
    // Stop event propagation to prevent other handlers
    event.stopPropagation();
    
    // Get row ID from the clicked element
    const rowId = event.currentTarget.getAttribute('data-row-id');
    if (!rowId) {
        console.warn("No row ID found in expand/collapse button");
        return;
    }
    
    // Get dimension index if available (for multi-dimension rows)
    const dimensionIndex = event.currentTarget.getAttribute('data-dimension-index');
    
    console.log(`Toggling expansion for row ${rowId}, dimension ${dimensionIndex || 'default'}`);
    
    // Find the row in the pivot data or DOM
    const row = getRowById(rowId);
    if (!row) {
        console.warn(`Row ${rowId} not found`);
        return;
    }
    
    // Toggle expanded state
    row.expanded = !row.expanded;
    
    // Update the UI - change the button appearance
    event.currentTarget.classList.toggle('expanded');
    event.currentTarget.classList.toggle('collapsed');
    event.currentTarget.innerHTML = row.expanded ? '−' : '+';
    
    // Update the actual DOM tree - show/hide child rows
    toggleChildRows(rowId, row.expanded);
    
    // Update hierarchy model state
    updateHierarchyModelState(row, dimensionIndex);
}


/**
 * Update the hierarchy model state after a row is expanded/collapsed
 * @param {Object} row - The row that was toggled
 * @param {string|null} dimensionIndex - The dimension index for multi-dimension rows
 */
function updateHierarchyModelState(row, dimensionIndex) {
    // If this is a multi-dimension row and we have a dimension index, handle it specially
    if (row.dimensions && dimensionIndex !== null && dimensionIndex !== undefined) {
        const dimension = row.dimensions[parseInt(dimensionIndex)];
        if (dimension && dimension.hierarchyField) {
            // Get dimension name
            const dimName = dimension.hierarchyField.replace('DIM_', '').toLowerCase();
            
            // Toggle in the state's expandedNodes
            if (state.expandedNodes && state.expandedNodes[dimName]) {
                // Set expansion state
                state.expandedNodes[dimName].row = state.expandedNodes[dimName].row || {};
                state.expandedNodes[dimName].row[dimension._id] = row.expanded;
                
                console.log(`Updated expansion state for ${dimName}.row.${dimension._id} to ${row.expanded}`);
            }
            
            // Also update the node in the hierarchy
            if (state.hierarchies && state.hierarchies[dimName] && 
                state.hierarchies[dimName].nodesMap && 
                state.hierarchies[dimName].nodesMap[dimension._id]) {
                
                state.hierarchies[dimName].nodesMap[dimension._id].expanded = row.expanded;
                console.log(`Updated hierarchy node ${dimension._id} expansion to ${row.expanded}`);
            }
        }
    } 
    // For regular single-dimension rows
    else if (row.hierarchyField) {
        // Get dimension name
        const dimName = row.hierarchyField.replace('DIM_', '').toLowerCase();
        
        // Toggle in the state's expandedNodes
        if (state.expandedNodes && state.expandedNodes[dimName]) {
            // Set expansion state
            state.expandedNodes[dimName].row = state.expandedNodes[dimName].row || {};
            state.expandedNodes[dimName].row[row._id] = row.expanded;
            
            console.log(`Updated expansion state for ${dimName}.row.${row._id} to ${row.expanded}`);
        }
        
        // Also update the node in the hierarchy
        if (state.hierarchies && state.hierarchies[dimName] && 
            state.hierarchies[dimName].nodesMap && 
            state.hierarchies[dimName].nodesMap[row._id]) {
            
            state.hierarchies[dimName].nodesMap[row._id].expanded = row.expanded;
            console.log(`Updated hierarchy node ${row._id} expansion to ${row.expanded}`);
        }
    }
    // If we don't have hierarchy field info, try to find it based on ID
    else {
        // Try to find which hierarchy this node belongs to
        for (const dimName in state.hierarchies) {
            const hierarchy = state.hierarchies[dimName];
            if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[row._id]) {
                // Found the node in this hierarchy
                hierarchy.nodesMap[row._id].expanded = row.expanded;
                
                // Also update expandedNodes
                if (state.expandedNodes && state.expandedNodes[dimName]) {
                    state.expandedNodes[dimName].row = state.expandedNodes[dimName].row || {};
                    state.expandedNodes[dimName].row[row._id] = row.expanded;
                }
                
                console.log(`Found and updated node ${row._id} in ${dimName} hierarchy`);
                break;
            }
        }
    }
}


/**
 * Handle column expand/collapse action
 * @param {Event} event - The click event
 */
function handleColumnExpandCollapse(event) {
    // Stop event propagation to prevent other handlers
    event.stopPropagation();
    
    // Get column ID from the clicked element
    const columnId = event.currentTarget.getAttribute('data-column-id');
    if (!columnId) {
        console.warn("No column ID found in expand/collapse button");
        return;
    }
    
    console.log(`Attempting to toggle column expansion for column ID: ${columnId}`);
    
    // Find column in the hierarchy
    let column = null;
    let hierarchyName = null;
    
    // Check all hierarchies to find this column
    for (const dimName in state.hierarchies) {
        const hierarchy = state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[columnId]) {
            column = hierarchy.nodesMap[columnId];
            hierarchyName = dimName;
            break;
        }
    }
    
    if (!column) {
        console.warn(`Column ${columnId} not found in any hierarchy`);
        return;
    }
    
    // Toggle expanded state
    column.expanded = !column.expanded;
    
    console.log(`Toggled expansion for column ${columnId} in ${hierarchyName} hierarchy to ${column.expanded}`);
    
    // Update the UI button
    event.currentTarget.classList.toggle('expanded');
    event.currentTarget.classList.toggle('collapsed');
    event.currentTarget.innerHTML = column.expanded ? '−' : '+';
    
    // Update the expansion state in state.expandedNodes
    if (state.expandedNodes && state.expandedNodes[hierarchyName]) {
        state.expandedNodes[hierarchyName].column = state.expandedNodes[hierarchyName].column || {};
        state.expandedNodes[hierarchyName].column[columnId] = column.expanded;
        
        console.log(`Updated expansion state for ${hierarchyName}.column.${columnId} to ${column.expanded}`);
    }
    
    // Regenerate the pivot table
    generatePivotTable();
}


/**
 * Save column expansion state to the appropriate hierarchy
 * @param {string} columnId - The column ID
 * @param {boolean} expanded - Whether the column is expanded
 */
function saveColumnExpansionState(columnId, expanded) {
    // Find which hierarchy this column belongs to
    for (const dimName in state.hierarchies) {
        const hierarchy = state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.nodesMap && hierarchy.nodesMap[columnId]) {
            // Found the node in this hierarchy
            hierarchy.nodesMap[columnId].expanded = expanded;
            
            // Also update the expandedNodes state
            if (state.expandedNodes && state.expandedNodes[dimName]) {
                state.expandedNodes[dimName].column = state.expandedNodes[dimName].column || {};
                state.expandedNodes[dimName].column[columnId] = expanded;
            }
            
            // Break the loop since we found the hierarchy
            break;
        }
    }
}


/**
 * Toggle visibility of child rows
 * @param {string} parentRowId - The parent row ID
 * @param {boolean} expanded - Whether the parent is expanded
 */
function toggleChildRows(parentRowId, expanded) {
    const table = document.getElementById('pivotTable');
    if (!table) return;
    
    // Get the parent row element
    const parentRow = table.querySelector(`tr[data-row-id="${parentRowId}"]`);
    if (!parentRow) {
        console.warn(`Parent row element not found for ID: ${parentRowId}`);
        return;
    }
    
    // Get the parent level
    const parentLevelMatch = parentRow.className.match(/level-(\d+)/);
    if (!parentLevelMatch) {
        console.warn(`Could not determine level for parent row: ${parentRowId}`);
        return;
    }
    
    const parentLevel = parseInt(parentLevelMatch[1]);
    
    // Find child rows
    const rows = table.querySelectorAll('tr.data-row');
    let inChildSection = false;
    
    // Debug info
    console.log(`Toggling child rows for parent ${parentRowId} (level ${parentLevel}) - expanded: ${expanded}`);
    
    for (const row of rows) {
        // Check if this is the parent row
        if (row.getAttribute('data-row-id') === parentRowId) {
            inChildSection = true; // Start tracking child rows
            continue;
        }
        
        if (inChildSection) {
            // Get current row level
            const rowLevelMatch = row.className.match(/level-(\d+)/);
            if (!rowLevelMatch) continue;
            
            const rowLevel = parseInt(rowLevelMatch[1]);
            
            // If level is less than or equal to parent level, we're out of the child section
            if (rowLevel <= parentLevel) {
                inChildSection = false;
                break;
            }
            
            // If level is exactly one more than parent, it's a direct child
            if (rowLevel === parentLevel + 1) {
                console.log(`  Toggling direct child: ${row.getAttribute('data-row-id')} to ${expanded ? 'visible' : 'hidden'}`);
                row.style.display = expanded ? '' : 'none';
            } else if (!expanded) {
                // If parent is collapsed, ensure all descendants are hidden
                row.style.display = 'none';
            }
            // If parent is expanded, visibility of deeper descendants depends on their parents
        }
    }
}


/**
 * Get a row by its ID from the pivot table
 * @param {string} rowId - The row ID to find
 * @returns {Object|null} - The found row or null
 */
function getRowById(rowId) {
    // Get the pivot table
    const pivotTable = document.getElementById('pivotTable');
    if (!pivotTable) return null;
    
    // Find the row element
    const rowElement = pivotTable.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!rowElement) return null;
    
    // Get data attributes
    const level = parseInt(rowElement.className.match(/level-(\d+)/)?.[1] || '0');
    const isExpanded = rowElement.querySelector('.expand-collapse-btn')?.classList.contains('expanded');
    const isLeaf = rowElement.classList.contains('leaf-row');
    const hasChildren = rowElement.querySelector('.expand-collapse-btn') !== null;
    
    // Create a row object with the necessary properties
    return {
        _id: rowId,
        level: level,
        expanded: isExpanded,
        isLeaf: isLeaf,
        hasChildren: hasChildren,
        // These properties might not be accurate but they're enough for the toggle function
        hierarchyField: state.rowFields[0]
    };
}


/**
 * Initialize format controls
 */
function initFormatControls() {
    // Get format selects
    const formatSelect = document.getElementById('valueFormat');
    const decimalSelect = document.getElementById('decimalPlaces');
    
    // Add change event handlers
    if (formatSelect) {
        formatSelect.addEventListener('change', generatePivotTable);
    }
    
    if (decimalSelect) {
        decimalSelect.addEventListener('change', generatePivotTable);
    }
}


/**
 * Initialize expand/collapse all buttons
 */
function initExpandCollapseButtons() {
    // Get the buttons
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const expandAllBtn = document.getElementById('expandAllBtn');
    
    // Add click handlers
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', function() {
            collapseAllNodes();
            generatePivotTable();
        });
    }
    
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', function() {
            expandAllNodes();
            generatePivotTable();
        });
    }
}


/**
 * Collapse all hierarchy nodes
 */
function collapseAllNodes() {
    // Set all nodes to collapsed in hierarchies
    for (const dimName in state.hierarchies) {
        const hierarchy = state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.nodesMap) {
            // Collapse all nodes
            Object.values(hierarchy.nodesMap).forEach(node => {
                if (node) node.expanded = false;
            });
            
            // Update expandedNodes state
            if (state.expandedNodes && state.expandedNodes[dimName]) {
                // Reset row expansions
                state.expandedNodes[dimName].row = { 'ROOT': false };
                
                // Reset column expansions
                state.expandedNodes[dimName].column = { 'ROOT': false };
            }
        }
    }
    
    // Apply function to collapse all root nodes if present
    if (typeof datUtil.setAllNodesCollapsed === 'function') {
        // For each hierarchy, collapse all nodes
        for (const dimName in state.hierarchies) {
            const hierarchy = state.hierarchies[dimName];
            if (hierarchy && hierarchy.root) {
                datUtil.setAllNodesCollapsed(hierarchy.root);
            }
        }
    }
    
    console.log("✅ Status: All hierarchy nodes collapsed");
}


/**
 * Expand all hierarchy nodes
 */
function expandAllNodes() {
    // Set all nodes to expanded in hierarchies
    for (const dimName in state.hierarchies) {
        const hierarchy = state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.nodesMap) {
            // Expand all nodes
            Object.values(hierarchy.nodesMap).forEach(node => {
                if (node) node.expanded = true;
            });
            
            // Update expandedNodes state
            if (state.expandedNodes && state.expandedNodes[dimName]) {
                // Initialize expandedNodes for this dimension if not exists
                state.expandedNodes[dimName].row = state.expandedNodes[dimName].row || {};
                state.expandedNodes[dimName].column = state.expandedNodes[dimName].column || {};
                
                // Set ROOT to expanded
                state.expandedNodes[dimName].row['ROOT'] = true;
                state.expandedNodes[dimName].column['ROOT'] = true;
                
                // Set all nodes to expanded
                Object.keys(hierarchy.nodesMap).forEach(nodeId => {
                    state.expandedNodes[dimName].row[nodeId] = true;
                    state.expandedNodes[dimName].column[nodeId] = true;
                });
            }
        }
    }
    
    console.log("✅ Status: All hierarchy nodes expanded");
}


/**
 * Gets the corresponding fact table field name for a dimension
 * 
 * @param {string} dimName - Dimension name
 * @returns {string|null} - Corresponding fact table field name or null if not found
 */
function getFactIdField(dimName) {
    // Define mapping between dimension names and fact table field names
    const factIdFieldMap = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'COMPONENT_GMID',
        'smartcode': 'ROOT_SMARTCODE',
        'item_cost_type': 'ITEM_COST_TYPE',
        'material_type': 'COMPONENT_MATERIAL_TYPE',
        'year': 'ZYEAR',
        'mc': 'MC'
    };
    
    return factIdFieldMap[dimName.toLowerCase()] || null;
}


// Function to add auto-adjustment script to the page
function addAutoAdjustScript() {
    const style = document.createElement('style');
    style.textContent = additionalStyles;
    document.head.appendChild(style);
    
    const script = document.createElement('script');
    script.textContent = `
        // Auto-adjust column widths based on content
        function adjustColumnWidths() {
            const cells = document.querySelectorAll('.dimension-header-cell, .row-header-cell');
            cells.forEach(cell => {
                // Create a temporary span to measure text
                const span = document.createElement('span');
                span.style.visibility = 'hidden';
                span.style.position = 'absolute';
                span.style.whiteSpace = 'nowrap';
                span.textContent = cell.textContent;
                document.body.appendChild(span);
                
                // Get content width plus padding
                const contentWidth = span.offsetWidth + 24; // 24px for padding
                document.body.removeChild(span);
                
                // Set width constraints
                const minWidth = 150;
                const maxWidth = 300;
                const optimalWidth = Math.max(minWidth, Math.min(maxWidth, contentWidth));
                
                // Apply width
                cell.style.width = optimalWidth + 'px';
            });
        }
        
        // Add event listener for window resize
        window.addEventListener('resize', adjustColumnWidths);
        
        // Call once when page loads
        window.addEventListener('load', adjustColumnWidths);
        
        // Call when pivotTable is generated
        document.addEventListener('pivotTableGenerated', adjustColumnWidths);
    `;
    document.body.appendChild(script);
    
    // Dispatch an event to trigger the initial adjustment
    const event = new Event('pivotTableGenerated');
    document.dispatchEvent(event);
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
        return datUtil.processHierarchicalFields([fieldId], 'row');
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
 * Extracts the dimension name from a hierarchy field
 * 
 * @param {string} hierarchyField - The hierarchy field ID (e.g., "DIM_PRODUCT")
 * @returns {string} - The lowercase dimension name without prefix (e.g., "product")
 */
function getDimensionName(hierarchyField) {
    if (!hierarchyField || !hierarchyField.startsWith('DIM_')) {
        return '';
    }
    return hierarchyField.replace('DIM_', '').toLowerCase();
}


/**
 * Gets all leaf descendants of a node recursively
 * 
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
        for (const child of node.children) {
            // Handle both child object references and child IDs
            const childNode = (typeof child === 'object') ? child : 
                (node.hierarchy?.nodesMap?.[child] || 
                (window.App?.state?.hierarchies?.[node.hierarchyName]?.nodesMap?.[child]));
                
            if (childNode) {
                this.getAllLeafDescendants(childNode, result);
            }
        }
    }
    
    return result;
}


// Export public API
export default {
    generatePivotTable,
    handleRowExpandCollapse,
    handleColumnExpandCollapse,
    initPivotTable,
    getFactIdField,
    collapseAllNodes,
    expandAllNodes,
    getAllLeafDescendants,
    addAutoAdjustScript
};
