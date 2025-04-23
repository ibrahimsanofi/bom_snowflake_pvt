
import stateModule from './state.js';
import ui from './ui.js'
import filters from './filters.js';
import pivotTable from './pivot-table.js';


// Get reference to application state
const state = stateModule.state;


/**
 * Enhanced processDirectory function with caching
 * Replace the existing processDirectory function
 */
async function processDirectory(directoryHandle, elements) {
    try {
        // Validate required UI elements
        if (!elements.loadingIndicator || !elements.appContent || !elements.fileList) {
            return;
        }
        
        // Show loading indicators
        elements.loadingIndicator.style.display = 'flex';
        elements.appContent.style.display = 'block';
        
        // Map of expected files and their corresponding state properties
        const expectedFiles = {
            'FACT_BOM.csv': 'factBOM',
            'DIM_LE.csv': 'dimLegalEntity',
            'DIM_COST_ELEMENT.csv': 'dimCostElement',
            'DIM_GMID_DISPLAY.csv': 'dimGMIDDisplay',
            'DIM_SMARTCODE.csv': 'dimSmartCode',
            'DIM_ITEM_COST_TYPE':'dimItemCostType',
            'DIM_MATERIAL_TYPE':'dimMaterialType'
        };
        
        // Get all matching files in the directory
        const fileEntries = [];
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name in expectedFiles) {
                fileEntries.push({ name: entry.name, handle: entry });
            }
        }
        
        // Display file list in UI
        elements.fileList.style.display = 'block';
        
        // Mark all files as missing initially
        Object.keys(expectedFiles).forEach(filename => {
            const stateKey = expectedFiles[filename];
            const statusElement = elements[`${stateKey}Status`];
            if (statusElement) {
                statusElement.className = 'file-item missing';
            }
        });
        
        // Clear cache when loading from a new directory
        stateModule.clearCache();
        
        // Mark found files and load them into state
        for (const entry of fileEntries) {
            const stateKey = expectedFiles[entry.name];
            const statusElement = elements[`${stateKey}Status`];
            if (statusElement) {
                statusElement.className = 'file-item found';
            }
            
            // Store file in state
            const file = await entry.handle.getFile();
            state.files[stateKey] = file;
        }
        
        // Check if all required files are found
        const missingFiles = Object.keys(expectedFiles).filter(
            filename => !fileEntries.some(entry => entry.name === filename)
        );
        
        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }
        
        // Process all files
        await processFiles(elements);
    } catch (error) {
        console.error('Error processing directory:', error);
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
        pivotTable.showStatus(`Error processing directory: ${error.message}`, 'error', elements);
    }
}


/**
 * Automatically load files from inputFiles folder
 * Replaces the directory picker functionality
 */
function autoLoadFiles(elements) {
    // Show loading indicator
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'flex';
    }

    // Show file list
    if (elements.fileList) {
        elements.fileList.style.display = 'block';
    }

    // Set all file statuses to loading initially
    const fileStatusElements = [
        elements.factBOMStatus,
        elements.dimLegalEntityStatus,
        elements.dimCostElementStatus,
        elements.dimGMIDDisplayStatus,
        elements.dimSmartCodeStatus,
        elements.dimItemCostTypeStatus,
        elements.dimMaterialTypeStatus
    ];

    fileStatusElements.forEach(element => {
        if (element) {
            element.className = 'file-item loading';
        }
    });

    // Create progress bar
    const directoryContainer = document.querySelector('.directory-input-container');
    if (directoryContainer) {
        // Replace directory picker with progress bar
        directoryContainer.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar" id="loadingProgress"></div>
            </div>
            <div id="loadingStatus" class="loading-status">Loading files from inputFiles folder...</div>
        `;
    }

    // Define required files
    const requiredFiles = [
        { name: 'FACT_BOM.csv', stateKey: 'factBOM', statusElement: elements.factBOMStatus },
        { name: 'DIM_LE.csv', stateKey: 'dimLegalEntity', statusElement: elements.dimLegalEntityStatus },
        { name: 'DIM_COST_ELEMENT.csv', stateKey: 'dimCostElement', statusElement: elements.dimCostElementStatus },
        { name: 'DIM_GMID_DISPLAY.csv', stateKey: 'dimGMIDDisplay', statusElement: elements.dimGMIDDisplayStatus },
        { name: 'DIM_SMARTCODE.csv', stateKey: 'dimSmartCode', statusElement: elements.dimSmartCodeStatus },
        { name: 'DIM_ITEM_COST_TYPE.csv', stateKey: 'dimItemCostType', statusElement: elements.dimItemCostTypeStatus },
        { name: 'DIM_MATERIAL_TYPE.csv', stateKey: 'dimMaterialType', statusElement: elements.dimMaterialTypeStatus }
    ];

    // Track loading progress
    let loadedCount = 0;
    const totalFiles = requiredFiles.length;
    
    // Update progress bar
    function updateProgress() {
        const progressPercent = (loadedCount / totalFiles) * 100;
        const progressBar = document.getElementById('loadingProgress');
        const loadingStatus = document.getElementById('loadingStatus');
        
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }
        
        if (loadingStatus) {
            loadingStatus.textContent = `Loading files: ${loadedCount} of ${totalFiles} (${Math.round(progressPercent)}%)`;
        }
    }

    // Function to load a single file
    async function loadFile(fileInfo) {
        try {
            // Update status to loading
            if (fileInfo.statusElement) {
                fileInfo.statusElement.className = 'file-item loading';
            }
            
            // Build the path to the file in the inputFiles folder
            const filePath = `./inputFiles/${fileInfo.name}`;
            
            // Fetch the file
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${fileInfo.name}`);
            }
            
            // Get file content as text
            const content = await response.text();
            
            // Convert to File object (for compatibility with existing code)
            const file = new File([content], fileInfo.name, { type: 'text/csv' });
            
            // Store in state
            state.files[fileInfo.stateKey] = file;
            
            // Update file status with row count
            let rowCount = content.split('\n').length - 1; // -1 for header
            if (fileInfo.statusElement) {
                const countBadge = document.createElement('span');
                countBadge.className = 'file-count';
                countBadge.textContent = `${rowCount.toLocaleString()} rows`;
                
                // Clear existing badges if any
                const existingBadge = fileInfo.statusElement.querySelector('.file-count');
                if (existingBadge) {
                    existingBadge.remove();
                }
                
                // Add the badge to the file name element
                const fileNameEl = fileInfo.statusElement.querySelector('.file-name');
                if (fileNameEl) {
                    fileNameEl.appendChild(countBadge);
                }
                
                // Update status to loaded
                fileInfo.statusElement.className = 'file-item loaded';
            }
            
            // Update progress
            loadedCount++;
            updateProgress();
            
            return true;
        } catch (error) {
            console.error(`Error loading ${fileInfo.name}:`, error);
            
            // Update status to error
            if (fileInfo.statusElement) {
                fileInfo.statusElement.className = 'file-item error';
            }
            
            // Update progress even on error
            loadedCount++;
            updateProgress();
            
            return false;
        }
    }

    // Load all files concurrently
    Promise.all(requiredFiles.map(fileInfo => loadFile(fileInfo)))
        .then(results => {
            // All files processed (successfully or with errors)
            const allSuccess = results.every(result => result === true);
            const loadingStatus = document.getElementById('loadingStatus');
            
            if (allSuccess) {
                // All files loaded successfully
                if (loadingStatus) {
                    loadingStatus.textContent = 'All files loaded successfully!';
                    
                    // Hide loading status after a delay
                    setTimeout(() => {
                        const container = document.querySelector('.progress-container');
                        if (container) {
                            container.style.display = 'none';
                        }
                        loadingStatus.style.display = 'none';
                    }, 3000);
                }
                
                // Process files
                processFiles(elements);
            } else {
                // Some files failed to load
                const failedCount = results.filter(result => result === false).length;
                
                if (loadingStatus) {
                    loadingStatus.textContent = `${failedCount} files failed to load. Please check the console for details.`;
                    loadingStatus.style.color = '#ef4444';
                }
                
                // Try to process with the files we have
                if (loadedCount > 0) {
                    processFiles(elements);
                }
            }
        });
}


/**
 * Sets up the directory picker button event handler
 * 
 * @param {Object} elements - Object containing references to UI elements
 */
function setupDirectoryPicker(elements) {
    // Instead of waiting for button click, automatically start file loading
    // Call the autoload function when the page loads
    autoLoadFiles(elements);
    
    // For backwards compatibility, if the button still exists, make it re-run the auto loading
    if (elements.selectDirectoryBtn) {
        elements.selectDirectoryBtn.addEventListener('click', () => {
            autoLoadFiles(elements);
        });
    }
}


/**
 * Enhanced setupFileInputs with cache clearing
 * Replace the existing setupFileInputs function
 */
function setupFileInputs(elements) {
    // Fact BOM file
    if (elements.factBOMFile) {
        elements.factBOMFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.factBOM = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }
    
    // Dimension files
    if (elements.dimLegalEntityFile) {
        elements.dimLegalEntityFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimLegalEntity = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }
    
    if (elements.dimCostElementFile) {
        elements.dimCostElementFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimCostElement = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }
    
    if (elements.dimGMIDDisplayFile) {
        elements.dimGMIDDisplayFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimGMIDDisplay = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }
    
    if (elements.dimSmartCodeFile) {
        elements.dimSmartCodeFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimSmartCode = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }

    if (elements.dimItemCostTypeFile) {
        elements.dimItemCostTypeFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimItemCostType = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }

    if (elements.dimMaterialTypeFile) {
        elements.dimMaterialTypeFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                stateModule.clearCache(); // Clear cache when file changes
                state.files.dimMaterialType = e.target.files[0];
                checkAllFilesUploaded(elements);
            }
        });
    }
}


/**
 * Checks if all required files have been uploaded and updates UI accordingly
 * 
 * @param {Object} elements - Object containing references to UI elements
 */
function checkAllFilesUploaded(elements) {
    // Check if all required files are present
    const allFilesUploaded = 
        state.files.factBOM &&
        state.files.dimLegalEntity &&
        state.files.dimCostElement &&
        state.files.dimGMIDDisplay &&
        state.files.dimSmartCode &&
        state.files.dimItemCostType &&
        state.files.dimMaterialType
    
    // Enable/disable process button based on file status
    if (elements.processFilesBtn) {
        elements.processFilesBtn.disabled = !allFilesUploaded;
    }
    
    // Show status message if all files are ready
    if (allFilesUploaded) {
        ui.showStatus('All files uploaded. Click "Process Files" to continue.', 'info', elements);
    }
}


/**
 * Processes all uploaded files, creating dimensions and loading fact data
 * 
 * @param {Object} elements - Object containing references to UI elements
 * @returns {Promise<void>}
 */
async function processFiles(elements) {    
    // Update status
    ui.showStatus('Processing files, please wait...', 'info', elements);
    
    try {
        // First check if we can use cached data - properly awaiting the async result
        const canUseCache = await stateModule.shouldUseCache(state.files);
        
        // Try to restore cached state if available
        let hasCachedState = false;
        if (canUseCache) {
            hasCachedState = stateModule.restoreStateFromCache();
            console.log("Cache state:", hasCachedState ? "Using cached UI state" : "No usable cached state");
        } else {
            console.log("Not using cache - files are newer than cache or no cache available");
        }
        
        // Check if we have field configurations from cache
        const hasAvailableFields = state.availableFields && state.availableFields.length > 0;
        const hasFieldSelections = state.rowFields?.length > 0 || 
                                 state.columnFields?.length > 0 || 
                                 state.valueFields?.length > 0;
        
        // We need to load files regardless, but we can reuse field configurations
        console.log("Processing files with cached configuration:",
            hasAvailableFields ? "Using cached field definitions" : "Creating new field definitions",
            hasFieldSelections ? "Using cached field selections" : "Will use default field selections"
        );
            
        // First, identify and organize available files
        state.availableFiles = [];
        
        // Define dimension files
        const dimFiles = [
            { name: 'LEGAL_ENTITY', file: state.files.dimLegalEntity, type: 'dimension', hierarchical: true },
            { name: 'COST_ELEMENT', file: state.files.dimCostElement, type: 'dimension', hierarchical: true },
            { name: 'GMID_DISPLAY', file: state.files.dimGMIDDisplay, type: 'dimension', hierarchical: true },
            { name: 'SMART_CODE', file: state.files.dimSmartCode, type: 'dimension', hierarchical: true },
            { name: 'ITEM_COST_TYPE', file: state.files.dimItemCostType, type: 'dimension', hierarchical: false },
            { name: 'MATERIAL_TYPE', file: state.files.dimMaterialType, type: 'dimension', hierarchical: false },
        ];
        
        // Add dimension files to available files list
        for (const dimFile of dimFiles) {
            if (dimFile.file) {
                state.availableFiles.push({
                    id: `DIM_${dimFile.name}`,
                    label: dimFile.name,
                    type: 'dimension',
                    hierarchical: dimFile.hierarchical,
                    file: dimFile.file
                });
            }
        }
        
        // Process fact files
        if (state.files.factBOM) {
            state.availableFiles.push({
                id: 'FACT_BOM',
                label: 'BOM',
                type: 'fact',
                file: state.files.factBOM
            });
        }
        
        // Process dimension files to build hierarchies
        await processDimensionFiles();
        
        // Process fact data
        await processFactData();
        
        // Only save minimal state to cache (avoiding the quota error)
        try {
            stateModule.saveStateToCache();
        } catch (cacheError) {
            console.warn("Could not save state to cache:", cacheError);
            // Continue even if caching fails
        }
        
        
        // Setup initial UI - if we don't have cached fields, generate them
        if (!hasAvailableFields) {
            ui.renderAvailableFields(elements);
        }
        
        // If we don't have cached field selections, set defaults
        if (!hasFieldSelections) {
            ui.setDefaultFields();
        }
        
        // Always render field containers
        ui.renderFieldContainers(elements, state);
        ui.showStatus('Files processed successfully. Drag fields to create your pivot table.', 'success', elements);
        
        // Update loading state
        state.loading = false;

        // Add a slight delay to ensure data is available
        setTimeout(() => {
            if (filters && filters.initializeFilters) {
                console.log("Calling filter initialization...");
                filters.initializeFilters();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error processing files:', error);
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
        ui.showStatus(`Error processing files: ${error.message}`, 'error', elements);
    }
}


/**
 * Add a function to clear cache when new files are uploaded
 * Add this function to fileHandler.js
 */
function handleFileChanges() {
    // Clear cache when any file is changed
    stateModule.clearCache();
}


// Replace your existing window.generatePivotTable function with this:
window.generatePivotTable = function() {
    console.log("PIVOT GEN START - Original factData length:", stateModule.state.factData.length);
    
    // Are we using filtered data?
    if (stateModule.state.filteredData && stateModule.state.filteredData.length > 0) {
        console.log("Using filteredData with length:", stateModule.state.filteredData.length);
        
        // Check data types in filtered data
        if (stateModule.state.filteredData.length > 0) {
            const sample = stateModule.state.filteredData[0];
            console.log("COST_UNIT type check:", {
                value: sample.COST_UNIT,
                type: typeof sample.COST_UNIT
            });
        }
        
        // Store original factData reference (not just length)
        const originalFactData = stateModule.state.factData;
        
        // Replace factData with filteredData
        stateModule.state.factData = stateModule.state.filteredData;
        
        // Generate pivot table
        console.log("Calling pivotTable.generatePivotTable with filtered data");
        pivotTable.generatePivotTable();
        
        // Restore original factData
        console.log("Restoring original factData");
        stateModule.state.factData = originalFactData;
    } else {
        // Generate pivot table with original data
        console.log("Using original factData");
        pivotTable.generatePivotTable();
    }
    
    console.log("PIVOT GEN COMPLETE");
};


/**
 * Parse a CSV file using PapaParse with options for filtering and data processing
 * @param {File} file - The file object to parse
 * @param {object} options - Parsing options
 * @returns {Promise<object>} - A promise that resolves to the parsed results
 */
function parseFile(file, options = {}) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        // Set default options
        const defaultOptions = {
            filterZeroValues: false,
            valueFields: ['COST_UNIT', 'QTY_UNIT'], 
            isFactTable: false,
            dynamicTyping: true,
            skipEmptyLines: true
        };
        
        const finalOptions = {...defaultOptions, ...options};
        
        // First, try to read a small sample of the file to detect format
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const sample = e.target.result;
                console.log(`File sample (${file.name}):`);
                console.log(sample.substring(0, 200)); // First 200 chars
                
                // Detect delimiter - look for commas, semicolons, and tabs
                const commas = (sample.match(/,/g) || []).length;
                const semicolons = (sample.match(/;/g) || []).length;
                const tabs = (sample.match(/\t/g) || []).length;
                
                // Choose the most common character as delimiter
                let delimiter = ','; // Default
                if (semicolons > commas && semicolons > tabs) delimiter = ';';
                if (tabs > commas && tabs > semicolons) delimiter = '\t';
                
                console.log(`Detected delimiter for ${file.name}: "${delimiter === '\t' ? 'TAB' : delimiter}"`);
                
                // Now parse with the detected delimiter
                Papa.parse(file, {
                    header: true,
                    dynamicTyping: finalOptions.dynamicTyping,
                    skipEmptyLines: true,
                    delimiter: delimiter,
                    encoding: "UTF-8",
                    transformHeader: header => header.trim(), // Trim whitespace from headers
                    complete: function(results) {
                        if (results.data && results.data.length > 0) {
                            console.log(`Successfully parsed ${file.name}: ${results.data.length} rows, sample:`, results.data[0]);
                            resolve(results);
                        } else {
                            console.warn(`No data rows found in ${file.name} - trying alternative parsing`);
                            
                            // Try again with first line treated as data rather than header
                            Papa.parse(file, {
                                header: false,
                                dynamicTyping: finalOptions.dynamicTyping,
                                skipEmptyLines: true,
                                delimiter: delimiter,
                                encoding: "UTF-8",
                                preview: 5, // Just get a few rows to check format
                                complete: function(resultsNoHeader) {
                                    if (resultsNoHeader.data && resultsNoHeader.data.length > 0) {
                                        console.log(`Found ${resultsNoHeader.data.length} rows with header=false parsing`);
                                        
                                        // Try to extract headers from first row
                                        const headers = resultsNoHeader.data[0];
                                        const data = resultsNoHeader.data.slice(1).map(row => {
                                            const obj = {};
                                            headers.forEach((header, i) => {
                                                obj[header] = row[i];
                                            });
                                            return obj;
                                        });
                                        
                                        if (data.length > 0) {
                                            console.log(`Converted to ${data.length} rows with headers, sample:`, data[0]);
                                            resolve({ data, meta: { fields: headers } });
                                        } else {
                                            reject(new Error(`No valid data rows in ${file.name}`));
                                        }
                                    } else {
                                        reject(new Error(`Could not parse ${file.name}`));
                                    }
                                },
                                error: function(error) {
                                    reject(error);
                                }
                            });
                        }
                    },
                    error: function(error) {
                        console.error(`Error parsing ${file.name}:`, error);
                        reject(error);
                    }
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error(`Error reading ${file.name}`));
        };
        
        // Read a sample of the file (first 5KB is usually enough to detect format)
        const blob = file.slice(0, 5000);
        reader.readAsText(blob);
    });
}


function parseFactBOM(file) {
    return new Promise((resolve, reject) => {
        console.log("Starting to parse FACT_BOM with minimal processing...");
        
        // Variables to track progress
        let rowCount = 0;
        let validCount = 0;
        const allRows = [];
        
        Papa.parse(file, {
            header: true,
            dynamicTyping: false, // Don't convert to numbers yet
            skipEmptyLines: true,
            step: function(result) {
                try {
                    if (result.data && typeof result.data === 'object') {
                        rowCount++;
                        
                        // Just store the row without filtering
                        allRows.push(result.data);
                        validCount++;
                        
                        // Log every 100,000 rows
                        if (rowCount % 100000 === 0) {
                            console.log(`Processed ${rowCount} rows`);
                        }
                    }
                } catch (error) {
                    console.error("Error in step:", error);
                }
            },
            complete: function() {
                console.log(`FACT_BOM parsing complete. Total rows: ${rowCount}, Stored: ${validCount}`);
                
                if (allRows.length > 0) {
                    // Return all rows, no filtering
                    resolve({
                        data: allRows,
                        meta: { fields: Object.keys(allRows[0]) }
                    });
                } else {
                    console.error("No rows found in FACT_BOM");
                    reject(new Error("No rows found in FACT_BOM"));
                }
            },
            error: function(error) {
                console.error("Error parsing FACT_BOM:", error);
                reject(error);
            }
        });
    });
}


/**
 * Processes dimension files and builds hierarchies
 * 
 * @returns {Promise<void>}
 */
async function processDimensionFiles() {
    try {
        console.log("Starting processDimensionFiles");
        
        // Debug initial state
        console.log("Initial hierarchies:", state.hierarchies ? Object.keys(state.hierarchies) : "none");
        console.log("Initial dimensions:", state.dimensions ? Object.keys(state.dimensions) : "none");
        
        // Check if we already have hierarchies from cache
        const hasPartialHierarchies = state.hierarchies && Object.keys(state.hierarchies).length > 0;
        
        if (hasPartialHierarchies) {
            console.log("Using partial hierarchy data from cache");
            // We'll keep what we have and potentially enhance it
        } else {
            console.log("No hierarchy data in cache, processing from scratch");
        }
        
        // Only parse files if we don't have the corresponding data already
        const needsLegalEntity = !state.dimensions || !state.dimensions.legal_entity || state.dimensions.legal_entity.length === 0;
        const needsCostElement = !state.dimensions || !state.dimensions.cost_element || state.dimensions.cost_element.length === 0;
        const needsGmidDisplay = !state.dimensions || !state.dimensions.gmid_display || state.dimensions.gmid_display.length === 0;
        const needsSmartCode = !state.dimensions || !state.dimensions.smart_code || state.dimensions.smart_code.length === 0;
        const needsItemCostType = !state.dimensions || !state.dimensions.item_cost_type || state.dimensions.item_cost_type.length === 0;
        const needsMaterialType = !state.dimensions || !state.dimensions.material_type || state.dimensions.material_type.length === 0;
        
        // Parse all needed dimension files concurrently
        console.log("Starting to parse dimension files...");
        const parsePromises = [];

        if (needsLegalEntity && state.files.dimLegalEntity) {
            console.log("Parsing DIM_LE.csv");
            parsePromises.push(parseFile(state.files.dimLegalEntity));
        } else {
            parsePromises.push(Promise.resolve(null));
        }
        
        if (needsCostElement && state.files.dimCostElement) {
            console.log("Parsing DIM_COST_ELEMENT.csv");
            parsePromises.push(parseFile(state.files.dimCostElement));
        } else {
            parsePromises.push(Promise.resolve(null));
        }
        
        if (needsGmidDisplay && state.files.dimGMIDDisplay) {
            console.log("Parsing DIM_GMID_DISPLAY.csv");
            parsePromises.push(parseFile(state.files.dimGMIDDisplay));
        } else {
            parsePromises.push(Promise.resolve(null));
        }
        
        if (needsSmartCode && state.files.dimSmartCode) {
            console.log("Parsing DIM_SMARTCODE.csv");
            parsePromises.push(parseFile(state.files.dimSmartCode));
        } else {
            parsePromises.push(Promise.resolve(null));
        }

        if (needsItemCostType && state.files.dimItemCostType) {
            console.log("Parsing DIM_ITEM_COST_TYPE.csv");
            parsePromises.push(parseFile(state.files.dimItemCostType));
        } else {
            parsePromises.push(Promise.resolve(null));
        }

        if (needsMaterialType && state.files.dimMaterialType) {
            console.log("Parsing DIM_MATERIAL_TYPE.csv");
            parsePromises.push(parseFile(state.files.dimMaterialType));
        } else {
            parsePromises.push(Promise.resolve(null));
        }

        // BOM
        if (state.files.factBOM) {
            console.log("Parsing FACT_BOM.csv");
            parsePromises.push(parseFile(state.files.factBOM));
        } else {
            parsePromises.push(Promise.resolve(null));
        }
        
        // Wait for all parses to complete
        console.log("Waiting for all file parsing to complete...");
        const parseResults = await Promise.all(parsePromises);
        const [legalEntityResult, costElementResult, gmidDisplayResult, smartCodeResult, itemCostTypeResult, materialTypeResult, bomResult] = parseResults;
        
        // Debug parse results
        console.log("Dimension parse results:", {
            legalEntity: legalEntityResult ? legalEntityResult.data.length : 0,
            costElement: costElementResult ? costElementResult.data.length : 0,
            gmidDisplay: gmidDisplayResult ? gmidDisplayResult.data.length : 0,
            smartCode: smartCodeResult ? smartCodeResult.data.length : 0,
            itemCostType: itemCostTypeResult ? itemCostTypeResult.data.length : 0,
            materialType: materialTypeResult ? materialTypeResult.data.length : 0,
            bom: bomResult ? bomResult.data.length : 0
        });
        
        // Initialize state.dimensions if needed
        if (!state.dimensions) {
            state.dimensions = {};
        }
        
        // Update dimensions with new data if available
        if (legalEntityResult && legalEntityResult.data) {
            console.log("Loaded Legal Entity dimension with", legalEntityResult.data.length, "records");
            state.dimensions.legal_entity = legalEntityResult.data;
        }
        
        if (costElementResult && costElementResult.data) {
            console.log("Loaded Cost Element dimension with", costElementResult.data.length, "records");
            state.dimensions.cost_element = costElementResult.data;
        }
        
        if (gmidDisplayResult && gmidDisplayResult.data) {
            console.log("Loaded GMID Display dimension with", gmidDisplayResult.data.length, "records");
            state.dimensions.gmid_display = gmidDisplayResult.data;
        }
        
        if (smartCodeResult && smartCodeResult.data) {
            console.log("Loaded Smart Code dimension with", smartCodeResult.data.length, "records");
            state.dimensions.smart_code = smartCodeResult.data;
        }

        if (itemCostTypeResult && itemCostTypeResult.data) {
            console.log("Loaded Item Cost Type dimension with", itemCostTypeResult.data.length, "records");
            state.dimensions.item_cost_type = itemCostTypeResult.data;
        }

        if (materialTypeResult && materialTypeResult.data) {
            console.log("Loaded Material Type dimension with", materialTypeResult.data.length, "records");
            state.dimensions.material_type = materialTypeResult.data;
        }
        
        // Store fact data if available
        if (bomResult && bomResult.data) {
            console.log("Loaded BOM fact data with", bomResult.data.length, "records");
            state.factData = bomResult.data;
        }
        
        // Only rebuild hierarchies if we don't have them from cache, or they're incomplete
        const needsHierarchies = !hasPartialHierarchies || 
            Object.values(state.hierarchies).some(h => !h || !h.root || !h.nodesMap);
        
        if (needsHierarchies) {
            console.log("Building hierarchies from dimension data - 30% complete");
            console.log("Dimensions before hierarchy build:", state.dimensions ? Object.keys(state.dimensions) : "none");
            console.log("factData length:", state.factData ? state.factData.length : 0);
            
            // Make sure hierarchies is initialized as an empty object first
            state.hierarchies = {};
            
            // Build hierarchies using hierarchyHandler with proper arguments
            try {
                console.log("Processing dimension hierarchies - 40% complete");
                const newHierarchies = processDimensionHierarchies(state.dimensions, state.factData);
                console.log("New hierarchies built:", newHierarchies ? Object.keys(newHierarchies) : "none");

                // TO DO: Remove this IF block later
                // Add verification for Legal Entity hierarchy
                // Verify and repair all hierarchies
                function verifyAndRepairHierarchies(hierarchies, dimensions) {
                    if (!hierarchies) {
                        console.error("No hierarchies object provided");
                        return {};
                    }
                    
                    // Check each hierarchy
                    const hierarchyNames = Object.keys(hierarchies);
                    console.log(`Verifying ${hierarchyNames.length} hierarchies...`);
                    
                    hierarchyNames.forEach(hierarchyName => {
                        const hierarchy = hierarchies[hierarchyName];
                        const dimension = dimensions[hierarchyName];
                        
                        // Skip if no dimension data
                        if (!dimension || !Array.isArray(dimension)) {
                            console.warn(`No dimension data for ${hierarchyName}, skipping verification`);
                            return;
                        }
                        
                        console.log(`Verifying ${hierarchyName} hierarchy...`);
                        
                        // Ensure nodesMap exists
                        if (!hierarchy.nodesMap) {
                            hierarchy.nodesMap = {};
                            console.warn(`Created missing nodesMap for ${hierarchyName}`);
                        }
                        
                        // Check if root node exists
                        if (!hierarchy.root) {
                            console.warn(`${hierarchyName} hierarchy missing root node, creating default`);
                            
                            // Create a default root node
                            hierarchy.root = {
                                id: 'ROOT',
                                label: `All ${hierarchyName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                                children: [],
                                level: 0,
                                expanded: true,
                                isLeaf: false,
                                hasChildren: true,
                                path: ['ROOT']
                            };
                            
                            // Add root to nodesMap
                            hierarchy.nodesMap['ROOT'] = hierarchy.root;
                            
                            // Get field mappings for this hierarchy
                            const fieldMappings = {
                                legal_entity: { id: 'LE', name: 'LE_DESC' },
                                cost_element: { id: 'COST_ELEMENT', name: 'COST_ELEMENT_DESC' },
                                smart_code: { id: 'SMARTCODE', name: 'SMARTCODE_DESC' },
                                gmid_display: { id: 'GMID', name: 'DISPLAY' },
                                item_cost_type: { id: 'ITEM_COST_TYPE', name: 'ITEM_COST_TYPE_DESC' },
                                material_type: { id: 'MATERIAL_TYPE', name: 'MATERIAL_TYPE_DESC' }
                            };
                            
                            const mapping = fieldMappings[hierarchyName] || { id: 'ID', name: 'NAME' };
                            
                            // Add leaf nodes from dimension data
                            let leafCount = 0;
                            dimension.forEach(item => {
                                if (item[mapping.id]) {
                                    // Create a node for this item
                                    const nodeId = `${hierarchyName}_${item[mapping.id]}`;
                                    const node = {
                                        id: nodeId,
                                        label: item[mapping.name] || item[mapping.id],
                                        children: [],
                                        level: 1,
                                        expanded: false,
                                        isLeaf: true,
                                        hasChildren: false,
                                        factId: item[mapping.id],
                                        path: ['ROOT', nodeId]
                                    };
                                    
                                    // Add to nodesMap
                                    hierarchy.nodesMap[nodeId] = node;
                                    
                                    // Add to root's children
                                    hierarchy.root.children.push(node);
                                    leafCount++;
                                }
                            });
                            
                            console.log(`Created default ${hierarchyName} hierarchy with ${leafCount} leaf nodes`);
                        }
                        
                        // Ensure root has valid children array
                        if (!hierarchy.root.children) {
                            hierarchy.root.children = [];
                            hierarchy.root.hasChildren = false;
                            console.warn(`Added missing children array to ${hierarchyName} root node`);
                        }
                        
                        // If root has no children but dimension data exists, add some children
                        if (hierarchy.root.children.length === 0 && dimension.length > 0) {
                            console.warn(`${hierarchyName} root has no children, adding from dimension data`);
                            
                            // Get field mappings for this hierarchy
                            const fieldMappings = {
                                legal_entity: { id: 'LE', name: 'LE_DESC' },
                                cost_element: { id: 'COST_ELEMENT', name: 'COST_ELEMENT_DESC' },
                                smart_code: { id: 'SMARTCODE', name: 'SMARTCODE_DESC' },
                                gmid_display: { id: 'GMID', name: 'DISPLAY' },
                                item_cost_type: { id: 'ITEM_COST_TYPE', name: 'ITEM_COST_TYPE_DESC' },
                                material_type: { id: 'MATERIAL_TYPE', name: 'MATERIAL_TYPE_DESC' }
                            };
                            
                            const mapping = fieldMappings[hierarchyName] || { id: 'ID', name: 'NAME' };
                            
                            // Add leaf nodes from dimension data (limit to 1000 for performance)
                            const maxNodes = Math.min(dimension.length, 1000);
                            for (let i = 0; i < maxNodes; i++) {
                                const item = dimension[i];
                                if (item[mapping.id]) {
                                    // Create a node for this item
                                    const nodeId = `${hierarchyName}_${item[mapping.id]}`;
                                    const node = {
                                        id: nodeId,
                                        label: item[mapping.name] || item[mapping.id],
                                        children: [],
                                        level: 1,
                                        expanded: false,
                                        isLeaf: true,
                                        hasChildren: false,
                                        factId: item[mapping.id],
                                        path: ['ROOT', nodeId]
                                    };
                                    
                                    // Add to nodesMap
                                    hierarchy.nodesMap[nodeId] = node;
                                    
                                    // Add to root's children
                                    hierarchy.root.children.push(node);
                                }
                            }
                            
                            // Update root node properties
                            hierarchy.root.hasChildren = hierarchy.root.children.length > 0;
                            console.log(`Added ${hierarchy.root.children.length} children to ${hierarchyName} root`);
                        }
                    });
                    
                    return hierarchies;
                }

                // Call the verification function
                const verifiedHierarchies = verifyAndRepairHierarchies(newHierarchies, state.dimensions);

                // Important: Ensure proper assignment
                state.hierarchies = verifiedHierarchies || {};
                
                // Important: Ensure proper assignment
                // state.hierarchies = newHierarchies || {};
                
                console.log("Hierarchies after build:", state.hierarchies ? Object.keys(state.hierarchies) : "none");
            } catch (hierError) {
                console.error("Error building hierarchies:", hierError);
                // Initialize empty hierarchies in case of error
                state.hierarchies = {};
            }
        } else {
            console.log("Using hierarchies from cache");
        }
        
        // Initialize expansion state for all hierarchies - expanded by default for ROOT nodes
        console.log("Initializing expansion states for hierarchies - 45% complete");
        Object.keys(state.hierarchies).forEach(hierarchyName => {
            console.log(`Processing expansion state for ${hierarchyName}`);
            
            // Ensure the hierarchy has a root node
            if (state.hierarchies[hierarchyName] && state.hierarchies[hierarchyName].root) {
                console.log(`Found root node for ${hierarchyName}`);
                
                // Make sure expandedNodes is initialized with all nodes collapsed
                state.expandedNodes[hierarchyName] = state.expandedNodes[hierarchyName] || {};
                state.expandedNodes[hierarchyName].row = state.expandedNodes[hierarchyName].row || {};
                state.expandedNodes[hierarchyName].column = state.expandedNodes[hierarchyName].column || {};
                
                // Only ROOT node expanded by default
                state.expandedNodes[hierarchyName].row['ROOT'] = true;
                state.expandedNodes[hierarchyName].column['ROOT'] = true;
                
                // Set root node to expanded
                state.hierarchies[hierarchyName].root.expanded = true;
                
                // Apply the collapsed state to all non-root nodes in the hierarchy
                if (state.hierarchies[hierarchyName].nodesMap) {
                    Object.keys(state.hierarchies[hierarchyName].nodesMap).forEach(nodeId => {
                        if (nodeId !== 'ROOT') {
                            // Don't override existing expansion states if they exist
                            if (!state.expandedNodes[hierarchyName].row[nodeId]) {
                                state.expandedNodes[hierarchyName].row[nodeId] = false;
                            }
                            if (!state.expandedNodes[hierarchyName].column[nodeId]) {
                                state.expandedNodes[hierarchyName].column[nodeId] = false;
                            }
                        }
                    });
                }
            } else {
                console.log(`No root node found for ${hierarchyName}`);
            }
        });
        
        console.log("processDimensionFiles completed successfully - 50% complete");
        
    } catch (error) {
        console.error("Error processing dimension files:", error);
        // Initialize hierarchies as empty object in case of error
        state.hierarchies = {};
        throw error;
    }
}


/**
 * Processes fact data and generates available fields
 * Updated for FACT_BOM with COST_UNIT and QTY_UNIT
 * 
 * @returns {Promise<void>}
 */
async function processFactData() {
    try {
        console.log("Processing fact data - 60% complete");
        
        // Parse fact data file with options for BOM
        if (!state.files.factBOM) {
            console.error("FACT_BOM.csv file not available");
            return;
        }
        
        console.log("Parsing FACT_BOM.csv with options");
        
        const factResult = await parseFactBOM(state.files.factBOM, {
            filterZeroValues: true, 
            valueFields: ['COST_UNIT', 'QTY_UNIT'],
            isFactTable: true
        });

        // Call this function right after parsing FACT_BOM.csv
        debugFactBOMParsing(factResult);

        // Store fact data
        if (factResult && factResult.data) {
            console.log("Processing numerical values - 65% complete");
            // Ensure numeric values for the value columns
            factResult.data.forEach(row => {
                // Process COST_UNIT
                if (row && row.COST_UNIT !== undefined && typeof row.COST_UNIT !== 'number') {
                    const parsedCost = parseFloat(row.COST_UNIT);
                    row.COST_UNIT = isNaN(parsedCost) ? 0 : parsedCost;
                }
                
                // Process QTY_UNIT
                if (row && row.QTY_UNIT !== undefined && typeof row.QTY_UNIT !== 'number') {
                    const parsedQty = parseFloat(row.QTY_UNIT);
                    row.QTY_UNIT = isNaN(parsedQty) ? 0 : parsedQty;
                }
            });
            
            // Store the fact data in state
            state.factData = factResult.data;

            // Force numeric conversion
            let nonZeroCount = 0;
            state.factData.forEach(row => {
            // Force COST_UNIT to number
            if (row.COST_UNIT !== undefined) {
                const parsedValue = parseFloat(row.COST_UNIT);
                row.COST_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
                if (row.COST_UNIT > 0) nonZeroCount++;
            } else {
                row.COST_UNIT = 0;
            }
            
            // Force QTY_UNIT to number
            if (row.QTY_UNIT !== undefined) {
                const parsedValue = parseFloat(row.QTY_UNIT);
                row.QTY_UNIT = isNaN(parsedValue) ? 0 : parsedValue;
            } else {
                row.QTY_UNIT = 0;
            }
            });

            console.log(`After forcing numeric conversion: ${nonZeroCount} records with non-zero COST_UNIT`);

            console.log('Facts Records Loaded:', factResult.data.length, '- 75% complete');

            // TO DO: This part is for troubleshooting and will be removed later
            // Verify if we have numeric values for COST_UNIT and QTY_UNIT
            let validCostUnitCount = 0;
            let validQtyUnitCount = 0;
            let zeroValueCount = 0;
            let nanValueCount = 0;

            // Sample the first 10 records or less
            const sampleSize = Math.min(10, factResult.data.length);
            console.log(`Checking first ${sampleSize} records for numeric values:`);

            for (let i = 0; i < sampleSize; i++) {
                const record = factResult.data[i];
                
                // Check COST_UNIT
                const costUnit = parseFloat(record.COST_UNIT);
                if (!isNaN(costUnit)) {
                    validCostUnitCount++;
                    if (costUnit === 0) zeroValueCount++;
                } else {
                    nanValueCount++;
                }
                
                // Check QTY_UNIT
                const qtyUnit = parseFloat(record.QTY_UNIT);
                if (!isNaN(qtyUnit)) {
                    validQtyUnitCount++;
                }
                
                // Log the record
                console.log(`Record ${i+1}:`, {
                    COST_UNIT: record.COST_UNIT,
                    COST_UNIT_parsed: costUnit,
                    QTY_UNIT: record.QTY_UNIT,
                    QTY_UNIT_parsed: qtyUnit,
                    LE: record.LE,
                    COST_ELEMENT: record.COST_ELEMENT
                });
            }

            console.log('Fact data validation:', {
                validCostUnitCount,
                validQtyUnitCount,
                zeroValueCount,
                nanValueCount,
                totalSampled: sampleSize
            });

            // If fact data contains zero numeric records, this is a critical issue
            if (validCostUnitCount === 0) {
                console.error('CRITICAL: No valid numeric COST_UNIT values found in fact data!');
            }

            // To be removed up till here
            
            // Extract unique values for ITEM_COST_TYPE and COMPONENT_MATERIAL_TYPE
            console.log("Extracting unique values from fact data - 80% complete");
            // extractAndStoreUniqueValues(factResult.data);
            
        } else {
            console.warn("No fact data was loaded");
            state.factData = [];
        }
        
        // Generate available fields
        console.log("Generating available fields - 85% complete");
        state.availableFields = [];
        
        // Add dimension fields
        state.availableFiles.forEach(file => {
            if (file.type === 'dimension') {
                // Mark dimensions as hierarchical
                const isHierarchical = file.id === 'DIM_LEGAL_ENTITY' || 
                                      file.id === 'DIM_COST_ELEMENT' || 
                                      file.id === 'DIM_GMID_DISPLAY' ||
                                      file.id === 'DIM_SMART_CODE'; 
        
                state.availableFields.push({
                    id: file.id,
                    label: file.label,
                    category: 'Dimension',
                    type: 'dimension',
                    hierarchical: isHierarchical,
                    draggableTo: ['row', 'column', 'filter']
                });
            }
        });
        
        // Add measure fields for BOM - direct value columns
        const bomMeasures = [
            { id: 'COST_UNIT', label: 'Cost Unit' },
            { id: 'QTY_UNIT', label: 'Quantity Unit' }
        ];
        
        bomMeasures.forEach(measure => {
            state.availableFields.push({
                id: measure.id,
                label: measure.label,
                category: 'Measure',
                type: 'fact',
                measureName: measure.id,
                draggableTo: ['value']
            });
        });
        
        // Initialize all the dimension mappings after data is loaded
        console.log("Initializing dimension mappings - 90% complete");
        initializeMappings();
        
        console.log("Fact data processing complete - 95% complete");
        
    } catch (error) {
        console.error("Error processing fact file:", error);
        throw error;
    }
}


// Add detailed CSV parsing debug function
function debugFactBOMParsing(factResult) {
    if (!factResult) {
        console.log("No FACT_BOM parse result available");
        return;
    }
    
    console.log("=== Debug FACT_BOM CSV Parsing ===");
    console.log(`Rows parsed: ${factResult.data ? factResult.data.length : 0}`);
    
    if (factResult.errors && factResult.errors.length > 0) {
        console.error("Parsing errors in FACT_BOM:", factResult.errors);
    }
    
    if (!factResult.data || factResult.data.length === 0) {
        console.warn("No data rows found in FACT_BOM");
        return;
    }
    
    // Sample the first record
    const firstRecord = factResult.data[0];
    if (firstRecord) {
        console.log("First record fields in FACT_BOM:", Object.keys(firstRecord));
        console.log("First record sample:", firstRecord);
    }
    
    // Check for COST_UNIT and QTY_UNIT fields
    const hasCostUnit = firstRecord && ('COST_UNIT' in firstRecord);
    const hasQtyUnit = firstRecord && ('QTY_UNIT' in firstRecord);
    
    console.log(`Contains COST_UNIT field: ${hasCostUnit}`);
    console.log(`Contains QTY_UNIT field: ${hasQtyUnit}`);
    
    if (hasCostUnit) {
        // Sample COST_UNIT values from the first few records
        const costUnitSamples = factResult.data.slice(0, 5).map(r => ({
            original: r.COST_UNIT,
            type: typeof r.COST_UNIT,
            asNumber: parseFloat(r.COST_UNIT),
            isNumeric: !isNaN(parseFloat(r.COST_UNIT))
        }));
        
        console.log("COST_UNIT samples:", costUnitSamples);
        
        // Count how many records have non-zero COST_UNIT values
        const nonZeroCount = factResult.data.filter(r => {
            const val = parseFloat(r.COST_UNIT);
            return !isNaN(val) && val !== 0;
        }).length;
        
        console.log(`Records with non-zero COST_UNIT: ${nonZeroCount} (${Math.round(nonZeroCount/factResult.data.length*100)}%)`);
    }
    
    console.log("=== End FACT_BOM CSV Parse Debug ===");
}


/**
 * Processes hierarchical fields for pivot table display
 * Creates flattened hierarchy structures based on expanded nodes
 * 
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
    
    fieldIds.forEach(fieldId => {
        const field = state.availableFields.find(f => f.id === fieldId);
        if (!field) return;
        
        // Check if this is a hierarchical dimension
        const isHierarchical = field.hierarchical;
        
        if (isHierarchical) {
            // Handle hierarchical field
            result.hierarchyFields.push(field);
            
            // Get the dimension name
            const dimName = field.id.replace('DIM_', '').toLowerCase();
            const hierarchy = state.hierarchies[dimName];
            
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
                
                // Debug the hierarchy
                // console.log(`Processing ${dimName} hierarchy with root:`, {
                //     rootId: hierarchy.root.id,
                //     rootLabel: hierarchy.root.label,
                //     childCount: hierarchy.root.children ? hierarchy.root.children.length : 0
                // });
                
                // Flatten the hierarchy - this includes all nodes, even if not all are visible
                const flattenedNodes = flattenHierarchy(hierarchy.root);
                
                // Debug flattened nodes
                // console.log(`Flattened ${flattenedNodes.length} nodes for ${dimName}`);
                // if (flattenedNodes.length > 0) {
                //     console.log("First few flattened nodes:", flattenedNodes.slice(0, 3));
                // }
                
                // Add to flat rows - all nodes are included
                flattenedNodes.forEach(node => {
                    // Debug each node being added
                    // console.log(`Adding node to flatRows: ${node.id}, label: ${node.label}`);
                    
                    result.flatRows.push({
                        _id: node.id,
                        label: node.label || node.id, // Use ID as fallback
                        level: node.level,
                        hasChildren: node.hasChildren,
                        isLeaf: node.isLeaf,
                        expanded: node.expanded,
                        hierarchyField: field.id,
                        path: node.path,
                        factId: node.factId,
                        sortKey: node.path ? node.path.join('|') : ''
                    });
                    
                    // Add mapping for this node
                    result.flatMappings.push({
                        id: node.id,
                        dimensionName: dimName,
                        nodeId: node.id,
                        isHierarchical: true,
                        isLeaf: node.isLeaf,
                        factId: node.factId,
                        factIdField: pivotTable.getFactIdField(dimName)
                    });
                });
            }
        } if (field.id === 'DIM_ITEM_COST_TYPE' || field.id === 'ITEM_COST_TYPE' ||
            field.id === 'DIM_MATERIAL_TYPE' || field.id === 'COMPONENT_MATERIAL_TYPE') {
      // Handle special non-hierarchical dimensions
      const dimStructure = processNonHierarchicalDimension(field.id, state.factData);
      
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
      Object.keys(dimStructure.nodesMap).forEach(nodeId => {
          if (nodeId === dimStructure.root._id) return; // Skip root
          
          const node = dimStructure.nodesMap[nodeId];
          flatNodes.push({
              _id: node._id,
              label: node.label,
              level: node.level,
              hasChildren: node.hasChildren,
              isLeaf: node.isLeaf,
              expanded: node.expanded,
              hierarchyField: field.id,
              path: node.path,
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
              isLeaf: node.isLeaf,
              factId: node.factId,
              factIdField: node.isLeaf ? (field.id === 'DIM_ITEM_COST_TYPE' ? 'ITEM_COST_TYPE' : 'COMPONENT_MATERIAL_TYPE') : null
          });
      });
  } else {
      // Handle non-hierarchical field (unchanged)
      // ...
            
        }
    });
    
    return result;
}


/**
 * Modified version of filterDataByDimension that ensures hierarchies
 * are displayed even when there's no matching fact data
 * Add this new function to js
 */
function preservingFilterByDimension(data, rowDef) {
    // Get a copy of the data
    let filteredData = [...data];
    
    // Check if we're filtering by a hierarchical dimension
    if (rowDef.hierarchyField && rowDef.hierarchyField.startsWith('DIM_')) {
        const dimName = rowDef.hierarchyField.replace('DIM_', '').toLowerCase();
        const node = getNodeById(dimName, rowDef._id, state.hierarchies);
        
        if (node) {
            // Apply the normal filtering logic
            if (rowDef.isLeaf && rowDef.factId) {
                // For leaf nodes, filter by exact match
                filteredData = filteredData.filter(record => 
                    record[pivotTable.getFactIdField(dimName)] === rowDef.factId
                );
            } else {
                // For non-leaf nodes, get all leaf descendants
                const leafNodes = pivotTable.getAllLeafDescendants(node);
                const factIds = leafNodes.map(n => n.factId).filter(id => id);
                
                if (factIds.length > 0) {
                    filteredData = filteredData.filter(record => 
                        factIds.includes(record[pivotTable.getFactIdField(dimName)])
                    );
                }
            }
            
            // If no records matched, return empty array but with a special flag
            // that indicates this is a valid node that should be displayed
            if (filteredData.length === 0) {
                // Add a flag to indicate this is a valid hierarchy node with no matching data
                return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
            }
        }
    } else if (rowDef.hierarchyField === 'ITEM_COST_TYPE' || rowDef.hierarchyField === 'COMPONENT_MATERIAL_TYPE') {
        // Handle non-hierarchical special fields
        if (rowDef._id.endsWith('_ROOT')) {
            return filteredData; // Root shows all
        }
        
        const value = rowDef.factId || rowDef.label;
        filteredData = filteredData.filter(record => record[rowDef.hierarchyField] === value);
        
        // For empty result sets, add flag
        if (filteredData.length === 0) {
            return { _isEmpty: true, _hierarchyNode: true, _rowDef: rowDef };
        }
    }
    
    return filteredData;
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
 * Initialize all dimension mappings
 * Builds mappings between dimension tables and fact table
 */
function initializeMappings() {
    console.log("Starting dimension mappings initialization");
    
    // Initialize state.mappings object if it doesn't exist
    if (!state.mappings) {
        state.mappings = {};
    }
    
    // 1. Initialize legal entity mapping
    if (state.dimensions && state.dimensions.legal_entity && state.factData) {
        console.log("Initializing Legal Entity mapping");
        state.mappings.legalEntity = buildLegalEntityMapping(state.dimensions.legal_entity, state.factData);
        
        console.log("Legal Entity Mapping initialized with", 
            Object.keys(state.mappings.legalEntity.leToDetails || {}).length, "entities mapped");
    } else {
        console.warn("Cannot initialize legal entity mapping: missing dimension or fact data");
    }
    
    // 2. Initialize cost element mapping
    if (state.dimensions && state.dimensions.cost_element && state.factData) {
        console.log("Initializing Cost Element mapping");
        state.mappings.costElement = buildCostElementMapping(state.dimensions.cost_element, state.factData);
        
        console.log("Cost Element Mapping initialized with", 
            Object.keys(state.mappings.costElement.costElementToDetails || {}).length, "elements mapped");
    } else {
        console.warn("Cannot initialize cost element mapping: missing dimension or fact data");
    }
    
    // 3. Initialize smart code mapping
    if (state.dimensions && state.dimensions.smart_code && state.factData) {
        console.log("Initializing Smart Code mapping");
        state.mappings.smartCode = buildSmartCodeMapping(state.dimensions.smart_code, state.factData);
        
        console.log("Smart Code Mapping initialized with", 
            Object.keys(state.mappings.smartCode.smartCodeToDetails || {}).length, "smart codes mapped");
    } else {
        console.warn("Cannot initialize smart code mapping: missing dimension or fact data");
    }
    
    // 4. Initialize GMID display mapping
    if (state.dimensions && state.dimensions.gmid_display && state.factData) {
        console.log("Initializing GMID Display mapping");
        state.mappings.gmidDisplay = buildGmidDisplayMapping(state.dimensions.gmid_display, state.factData);
        
        console.log("GMID Display Mapping initialized with", 
            Object.keys(state.mappings.gmidDisplay.gmidToDisplay || {}).length, "GMIDs mapped");
    } else {
        console.warn("Cannot initialize GMID display mapping: missing dimension or fact data");
    }

    // 5. Initialize ITEM_COST_TYPE mapping
    if (state.dimensions && state.dimensions.item_cost_type && state.factData) {
        console.log("Initializing ITEM_COST_TYPE mapping");
        state.mappings.itemCostType = buildItemCostTypeMapping(state.dimensions.item_cost_type, state.factData);
        
        console.log("ITEM_COST_TYPE Mapping initialized with", 
            Object.keys(state.mappings.itemCostType.codeToDesc || {}).length, "item cost types mapped");
    } else {
        console.warn("Cannot initialize item cost type mapping: missing dimension or fact data");
    }

    // 6. Initialize MATERIAL_TYPE mapping
    if (state.dimensions && state.dimensions.material_type && state.factData) {
        console.log("Initializing MATERIAL_TYPE mapping");
        state.mappings.materialType = buildMaterialTypeMapping(state.dimensions.material_type, state.factData);
        
        console.log("MATERIAL_TYPE Mapping initialized with", 
            Object.keys(state.mappings.materialType.codeToDesc || {}).length, "material types mapped");
    } else {
        console.warn("Cannot initialize material type mapping: missing dimension or fact data");
    }
    
    // 7. Extract and store unique fact values
    //console.log("Extracting and storing unique fact values");
    //state.uniqueValues = extractUniqueFactValues(state.factData);
    
    // 7. Add integrity checks to verify mappings are working
    verifyFactDimensionMappings();
    
    console.log("All mappings initialized successfully");

    // Verify entity mappings
    logMappingDetails();
}


/**
 * Log detailed information about dimension mappings
 */
function logMappingDetails() {
    console.log("=== Dimension Mapping Debug Information ===");
    
    // Check Legal Entity mapping
    if (state.mappings && state.mappings.legalEntity) {
        const leMapping = state.mappings.legalEntity;
        console.log(`Legal Entity mapping: ${Object.keys(leMapping.leToDetails || {}).length} entities`);
        
        // Sample a few mappings
        const leKeys = Object.keys(leMapping.leToDetails || {}).slice(0, 3);
        if (leKeys.length > 0) {
            console.log("Sample LE mappings:");
            leKeys.forEach(key => {
                console.log(`  ${key} -> ${JSON.stringify(leMapping.leToDetails[key])}`);
            });
        }
        
        // Check if any LE codes in fact data are unmapped
        const unmappedLEs = new Set();
        state.factData.slice(0, 100).forEach(record => {
            if (record.LE && !leMapping.leToDetails[record.LE]) {
                unmappedLEs.add(record.LE);
            }
        });
        if (unmappedLEs.size > 0) {
            console.warn(`Found ${unmappedLEs.size} unmapped LE codes in fact data`);
            console.warn("First few unmapped LEs:", Array.from(unmappedLEs).slice(0, 5));
        }
    }
    
    // Check Cost Element mapping
    if (state.mappings && state.mappings.costElement) {
        const ceMapping = state.mappings.costElement;
        console.log(`Cost Element mapping: ${Object.keys(ceMapping.costElementToDetails || {}).length} elements`);
        
        // Sample a few mappings
        const ceKeys = Object.keys(ceMapping.costElementToDetails || {}).slice(0, 3);
        if (ceKeys.length > 0) {
            console.log("Sample Cost Element mappings:");
            ceKeys.forEach(key => {
                console.log(`  ${key} -> ${JSON.stringify(ceMapping.costElementToDetails[key])}`);
            });
        }
        
        // Check if any Cost Elements in fact data are unmapped
        const unmappedCEs = new Set();
        state.factData.slice(0, 100).forEach(record => {
            if (record.COST_ELEMENT && !ceMapping.costElementToDetails[record.COST_ELEMENT]) {
                unmappedCEs.add(record.COST_ELEMENT);
            }
        });
        if (unmappedCEs.size > 0) {
            console.warn(`Found ${unmappedCEs.size} unmapped Cost Elements in fact data`);
            console.warn("First few unmapped Cost Elements:", Array.from(unmappedCEs).slice(0, 5));
        }
    }
    
    // Check other mappings
    // (Add similar checks for other dimensions)
    
    console.log("=========================================");
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
    
    const sampleSize = Math.min(100, state.factData.length);
    const sampleRecords = state.factData.slice(0, sampleSize);
    
    // Check legal entity mapping
    if (state.mappings.legalEntity) {
        const leMatches = sampleRecords.filter(record => 
            record.LE && state.mappings.legalEntity.leToDetails[record.LE]
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
        id: 'MASTER_ROOT', 
        label: rootLabel, 
        children: [], 
        level: 0, 
        path: ['MASTER_ROOT'],
        expanded: true,
        isLeaf: false,
        hasChildren: false
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'MASTER_ROOT': masterRootNode };
    
    // Create root nodes for each level 1 value
    const rootNodes = Array.from(level1Values).map(value => {
        const rootId = `ROOT_${value}`;
        const rootNode = { 
            id: rootId, 
            label: value, 
            children: [], 
            level: needsMasterRoot ? 1 : 0, 
            path: needsMasterRoot ? ['MASTER_ROOT', rootId] : [rootId],
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
        id: 'MASTER_ROOT', 
        label: rootLabel, 
        children: [], 
        level: 0, 
        path: ['MASTER_ROOT'],
        expanded: true,
        isLeaf: false,
        hasChildren: false
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'MASTER_ROOT': masterRootNode };
    
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
            currentPath = ['MASTER_ROOT'];
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
                    path: ['MASTER_ROOT', rootId],
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
            currentPath = ['MASTER_ROOT', rootId];
            
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
 * Builds a hierarchical structure from tabular data with PATH_GMID and H*_GMID columns
 * following the same signature as buildGenericPathHierarchy
 * 
 * @param {Array} data - Array of objects containing the dataset
 * @param {Object} config - Configuration options (optional)
 * @returns {Object} - Object containing root node, nodesMap, and original data
 */
function buildGmidDisplayHierarchy(data, config) {
    console.log(`Processing ${data.length} rows of GMID path-based data...`);
    console.log("Sample row:", data.length > 0 ? data[0] : "No data");
    
    // Default configuration
    const defaultConfig = {
        getPath: item => item.PATH_GMID,
        getLeafId: item => item.COMPONENT_GMID,
        getLeafLabel: item => item.DISPLAY,
        isLeafNode: (item, level, totalLevels) => level === totalLevels - 1,
        pathSeparator: '/',
        getLevelDisplay: (item, level) => item[`DISPLAY_${level+1}`] || null,
        matchSegmentWithHGmid: true // Whether to validate segments with H*_GMID
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
    
    // Determine the root label
    let rootLabel = "All Items"; // Default fallback
    if (firstLevelSegments.size === 1) {
        const firstSegment = Array.from(firstLevelSegments)[0];
        // Try to get display_1 value from any row with this segment
        const sampleRow = data.find(item => {
            const path = finalConfig.getPath(item);
            return path && path.split(finalConfig.pathSeparator)[0] === firstSegment;
        });
        
        if (sampleRow && sampleRow.DISPLAY_1) {
            rootLabel = sampleRow.DISPLAY_1;
        } else {
            rootLabel = firstSegment;
        }
    } else if (firstLevelSegments.size > 1) {
        // For multiple segments, create a common parent name
        rootLabel = `${rootLabel}`;
    }
    
    const masterRootNode = {
        id: 'MASTER_ROOT', 
        label: rootLabel, 
        children: [], 
        level: 0, 
        path: ['MASTER_ROOT'],
        expanded: true,
        isLeaf: false,
        hasChildren: false
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'MASTER_ROOT': masterRootNode };
    
    // Map to track nodes by path key to prevent duplicates
    const nodesByPathKey = new Map();
    
    // For single root (no master root), create the root node
    let singleRootNode = null;
    if (!needsMasterRoot && firstLevelSegments.size === 1) {
        const rootSegment = Array.from(firstLevelSegments)[0];
        
        // Try to get DISPLAY_1 for better label
        const sampleRow = data.find(item => {
            const path = finalConfig.getPath(item);
            return path && path.split(finalConfig.pathSeparator)[0] === rootSegment;
        });
        
        const rootLabel = (sampleRow && sampleRow.DISPLAY_1) ? sampleRow.DISPLAY_1 : rootSegment;
        const rootId = `ROOT_${rootSegment}`;
        
        singleRootNode = {
            id: rootId,
            label: rootLabel,
            gmid: rootSegment, // Store the actual GMID value
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
    data.forEach((item, itemIndex) => {
        if (!item) return;
        
        const pathString = finalConfig.getPath(item);
        if (!pathString) return;
        
        // Split the path into segments
        const pathSegments = pathString.split(finalConfig.pathSeparator)
            .filter(segment => segment.trim() !== '');
        
        if (pathSegments.length === 0) return;
        
        // Verify that segments match H*_GMID values if configured
        if (finalConfig.matchSegmentWithHGmid) {
            let validSegments = true;
            for (let i = 0; i < pathSegments.length; i++) {
                const segment = pathSegments[i];
                const hKey = `H${i+1}_GMID`;
                
                if (item[hKey] !== segment) {
                    console.warn(`Warning: Row ${itemIndex}: Segment ${segment} doesn't match ${hKey} value ${item[hKey]}`);
                    validSegments = false;
                    break;
                }
            }
            
            if (!validSegments) {
                // Skip this row if segments don't match H*_GMID values
                return;
            }
        }
        
        // Start with appropriate parent node
        let currentNode, currentPath;
        
        if (needsMasterRoot) {
            // Using master root with multiple segment values
            currentNode = masterRootNode;
            currentPath = ['MASTER_ROOT'];
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
            
            // Try to get DISPLAY_1 for better label
            const rootLabel = item.DISPLAY_1 || firstSegment;
            
            if (!nodesMap[rootId]) {
                singleRootNode = {
                    id: rootId,
                    label: rootLabel,
                    gmid: firstSegment, // Store the actual GMID value
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
            
            // Get the display label for this level
            const levelDisplay = item.DISPLAY_1 || firstSegment;
            
            // Create or get the root node for this first segment
            if (!nodesMap[rootId]) {
                const rootNode = {
                    id: rootId,
                    label: levelDisplay,
                    gmid: firstSegment, // Store the actual GMID value
                    children: [],
                    level: 1,
                    path: ['MASTER_ROOT', rootId],
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
            currentPath = ['MASTER_ROOT', rootId];
            
            // Skip first segment since we've processed it
            pathSegments.shift();
        }
        
        // Process each remaining segment of the path
        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            
            // Skip empty segments
            if (!segment || segment === "") continue;
            
            // Calculate the actual level in the hierarchy (accounting for shifts)
            const actualLevel = needsMasterRoot 
                ? i + 1  // If using master root, first segment is at level 1
                : i;     // Otherwise, segments start at level 0 
            
            // Create a unique path key for this segment
            const pathKey = `${currentNode.id}_${segment}`;
            const nodeId = `SEGMENT_${pathKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            
            // Get the display label for this level
            const displayIndex = actualLevel + 1; // DISPLAY_1, DISPLAY_2, etc. are 1-based
            const levelDisplay = item[`DISPLAY_${displayIndex}`] || segment;
            
            // Check if we already have a node for this path segment
            if (!nodesByPathKey.has(pathKey)) {
                // Determine if this is a leaf node
                const isLeafNode = finalConfig.isLeafNode(item, i, pathSegments.length);
                
                const newNode = {
                    id: nodeId,
                    label: levelDisplay,
                    gmid: segment, // Store the actual GMID value
                    children: [],
                    level: currentNode.level + 1,
                    path: [...currentPath, nodeId],
                    expanded: false,
                    isLeaf: isLeafNode,
                    hasChildren: !isLeafNode,
                    gmidLevel: displayIndex, // Store which H*_GMID level this corresponds to
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
                        newNode.alternateLabel = betterLabel; // Store as alternate
                    }
                }
            }
            
            // Update current node and path for next iteration
            const existingNodeId = nodesByPathKey.get(pathKey);
            currentNode = nodesMap[existingNodeId];
            currentPath = [...currentPath, existingNodeId];
        }
    });
    
    // Sort hierarchy by label
    const sortHierarchyNodes = (node) => {
        if (node.children && node.children.length > 0) {
            // Sort children alphabetically by label
            node.children.sort((a, b) => a.label.localeCompare(b.label));
            
            // Recursively sort children's children
            node.children.forEach(child => sortHierarchyNodes(child));
        }
    };
    
    // Get the root node to return
    const rootNode = needsMasterRoot ? masterRootNode : 
        (singleRootNode || Object.values(nodesMap).find(node => node.level === 0) || masterRootNode);
    
    // Sort the hierarchy
    sortHierarchyNodes(rootNode);
    
    return {
        root: rootNode,
        nodesMap: nodesMap,
        flatData: data
    };
}


/**
 * Build a legal entity hierarchy using the generic function
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
        const segments = item.PATH.split('//').filter(s => s.trim() !== '');
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



/**
 * Build a smart code hierarchy using the generic path-based function
 * @param {Array} data - The smart code data
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
function buildSmartCodeHierarchy(data) {
    return buildGenericPathHierarchy(data, {
        getPath: item => item.PATH,
        getLeafId: item => item.SMARTCODE,
        getLeafLabel: item => item.SMARTCODE_DESC,
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
 * 
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
    
    // Process legal entity hierarchy
    if (dimensions.legal_entity && dimensions.legal_entity.length > 0) {
        hierarchies.legal_entity = buildLegalEntityHierarchy(dimensions.legal_entity);
        // Precompute descendant factIds for legal entity hierarchy
        precomputeDescendantFactIds(hierarchies.legal_entity, 'GBL_LEGAL_ENTITY');
    }
    
    // Process cost element hierarchy
    if (dimensions.cost_element && dimensions.cost_element.length > 0) {
        hierarchies.cost_element = buildCostElementHierarchy(dimensions.cost_element);
        // Precompute descendant factIds for cost element hierarchy
        precomputeDescendantFactIds(hierarchies.cost_element, 'COST_ELEMENT');
    }
    

    // Process smart code hierarchy
    if (dimensions.smart_code && dimensions.smart_code.length > 0) {
        hierarchies.smart_code = buildSmartCodeHierarchy(dimensions.smart_code);
        // Precompute descendant factIds for smart code hierarchy
        precomputeDescendantFactIds(hierarchies.smart_code, 'ROOT_SMARTCODE');
    }

    // Process GMID hierarchy
    if (dimensions.gmid_display && dimensions.gmid_display.length > 0) {
        hierarchies.gmid_display = buildGmidDisplayHierarchy(dimensions.gmid_display);
        // Precompute descendant factIds for GMID hierarchy
        precomputeDescendantFactIds(hierarchies.gmid_display, 'COMPONENT_GMID');
    }
    
    console.log("New hierarchies built:", Object.keys(hierarchies));
    return hierarchies;
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
function flattenHierarchy(node, result = [], level = 0, parentPath = [], nodesMap = {}) {
    if (!node) return result;
    
    // Create current path
    const currentPath = [...parentPath, node.id];
    
    // Add current node to result with label
    result.push({
        id: node.id,
        label: node.label || node.id, // Ensure label exists
        level: level,
        path: currentPath,
        hasChildren: node.children && node.children.length > 0,
        isLeaf: node.isLeaf || false,
        expanded: node.expanded || false,
        factId: node.factId,
        factCode: node.factCode,
        gmid: node.gmid,
        data: node.data
    });
    
    // Process children if node is expanded
    if (node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(child => {
            // Is child a string ID or an object?
            if (typeof child === 'string') {
                // If it's a string ID and nodesMap is provided, use it
                if (nodesMap[child]) {
                    flattenHierarchy(nodesMap[child], result, level + 1, currentPath, nodesMap);
                } else {
                    console.warn(`Child node ID ${child} not found in nodesMap`);
                }
            } else {
                // If it's a direct object reference, use it
                flattenHierarchy(child, result, level + 1, currentPath, nodesMap);
            }
        });
    }
    
    return result;
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
 * Precompute descendant factIds for each parent node in the hierarchy
 * Special handling for GMID hierarchies to ensure correct filtering
 * 
 * @param {Object} hierarchy - The hierarchy object with root and nodesMap
 * @param {string} factIdField - The fact table field name for this dimension
 */
function precomputeDescendantFactIds(hierarchy, factIdField) {
    if (!hierarchy || !hierarchy.root || !hierarchy.nodesMap) {
        console.warn("Cannot precompute descendant factIds - invalid hierarchy structure");
        return;
    }
    
    console.log(`Precomputing descendant factIds for hierarchy using ${factIdField}`);
    
    // Special handling for GMID hierarchy
    const isGmidHierarchy = factIdField === 'COMPONENT_GMID';
    
    // Process each node in the hierarchy
    Object.values(hierarchy.nodesMap).forEach(node => {
        // Always initialize as an array (critical for null-check safety)
        node.descendantFactIds = [];

        if (node.isLeaf && node.factId) {
            node.descendantFactIds.push(node.factId);
            return;
        }
        
        // Helper function to collect factIds recursively
        const collectFactIds = (currentNode) => {
            if (!currentNode) return;
            
            if (!isGmidHierarchy && currentNode.isLeaf && currentNode.factId) {
                node.descendantFactIds.push(currentNode.factId);
            }
            
            // Process children recursively
            if (currentNode.children && currentNode.children.length > 0) {
                currentNode.children.forEach(child => {
                    // Handle both ID strings and direct child objects
                    const childNode = typeof child === 'string' 
                        ? hierarchy.nodesMap[child] 
                        : child;
                    
                    if (childNode) {
                        collectFactIds(childNode);
                    }
                });
            }
        };
        
        // Start collection from this node's children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childNode = typeof child === 'string' 
                    ? hierarchy.nodesMap[child] 
                    : child;
                
                if (childNode) {
                    collectFactIds(childNode);
                }
            });
        }
        
        // Log stats for debugging large nodes
        if (node.descendantFactIds.length > 0) {
            console.log(`Node ${node.id} has ${node.descendantFactIds.length} descendant factIds`);
            if (node.descendantFactIds.length < 5) {
                console.log(`Sample descendant factIds: ${node.descendantFactIds.join(', ')}`);
            }
        }
    });
    
    console.log("Descendant factIds precomputation complete");
}


/**
 * Helper function to sort hierarchy nodes
 */
function sortHierarchyNodes(node) {
    if (node && node.children && node.children.length > 0) {
        node.children.sort((a, b) => {
            if (a.label < b.label) return -1;
            if (a.label > b.label) return 1;
            return 0;
        });
        
        // Sort children recursively
        node.children.forEach(child => sortHierarchyNodes(child));
    }
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
                
                console.warn(`Added fallback mapping for unmapped LE code: ${row.LE}`);
            }
        });
    }
    
    console.log(`Legal Entity mapping complete: ${Object.keys(mapping.leToDetails).length} LE codes mapped`);
    console.log(`${mapping.usedLeCodes.size} LE codes used in FACT_BOM`);
    
    // Diagnostic info: Check how many FACT_BOM LE codes are mapped
    const mappedLeCodesCount = Array.from(mapping.usedLeCodes).filter(leCode => 
        mapping.leToDetails[leCode]
    ).length;
    
    const mappingCoveragePercent = Math.round((mappedLeCodesCount / mapping.usedLeCodes.size) * 100);
    console.log(`LE mapping coverage: ${mappedLeCodesCount}/${mapping.usedLeCodes.size} (${mappingCoveragePercent}%)`);
    
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
    
    console.log(`Cost Element mapping complete: ${Object.keys(mapping.costElementToDetails).length} cost elements mapped`);
    console.log(`${mapping.usedCostElements.size} cost elements used in FACT_BOM`);
    
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
                    description: row.SMARTCODE_DESC || row.DESCRIPTION || '',
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
    
    console.log(`Smart Code mapping complete: ${Object.keys(mapping.smartCodeToDetails).length} smart codes mapped`);
    console.log(`${mapping.usedSmartCodes.size} smart codes used in FACT_BOM as ROOT_SMARTCODE`);
    
    return mapping;
}


/**
 * Builds mapping between DIM_GMID_DISPLAY and FACT_BOM
 * @param {Array} gmidDisplayData - GMID display dimension data
 * @param {Array} bomData - BOM fact data
 * @returns {Object} - Mapping object
 */
// function buildGmidDisplayMapping(gmidDisplayData, bomData) {
//     console.log("Building GMID Display mapping");
    
//     // Create mapping object
//     const mapping = {
//         // Maps GMID to display information
//         gmidToDisplay: {},
//         // Maps hierarchy nodes to GMIDs
//         nodeToGmids: {},
//         // Maps path segments to GMIDs
//         pathSegmentToGmids: {},
//         // Tracks which GMIDs are used in FACT_BOM as COMPONENT_GMID
//         usedGmids: new Set()
//     };
    
//     // First pass - build mappings from dimension data
//     if (gmidDisplayData && gmidDisplayData.length > 0) {
//         gmidDisplayData.forEach(row => {
//             if (row.GMID) {
//                 // Store GMID display information
//                 mapping.gmidToDisplay[row.GMID] = {
//                     display: row.DISPLAY || row.GMID,
//                     rootGmid: row.ROOT_GMID || '',
//                     rootDisplay: row.ROOT_DISPLAY || '',
//                     path: row.PATH_GMID || ''
//                 };
                
//                 // Process PATH_GMID to build hierarchy mappings
//                 if (row.PATH_GMID) {
//                     const pathSegments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
                    
//                     // For each segment in the path, associate it with this GMID
//                     pathSegments.forEach(segment => {
//                         // Map segment to all GMIDs that contain it in their path
//                         mapping.pathSegmentToGmids[segment] = mapping.pathSegmentToGmids[segment] || new Set();
//                         mapping.pathSegmentToGmids[segment].add(row.GMID);
//                     });
                    
//                     // If this is a complete path with both ROOT_GMID and GMID
//                     if (row.ROOT_GMID && pathSegments.length > 0) {
//                         const rootSegment = pathSegments[0];
                        
//                         // Associate ROOT_GMID with this GMID
//                         mapping.nodeToGmids[rootSegment] = mapping.nodeToGmids[rootSegment] || new Set();
//                         mapping.nodeToGmids[rootSegment].add(row.GMID);
                        
//                         // Also map the display name to GMIDs if ROOT_DISPLAY exists
//                         if (row.ROOT_DISPLAY) {
//                             mapping.nodeToGmids[row.ROOT_DISPLAY] = mapping.nodeToGmids[row.ROOT_DISPLAY] || new Set();
//                             mapping.nodeToGmids[row.ROOT_DISPLAY].add(row.GMID);
//                         }
//                     }
//                 }
//             }
//         });
//     }
    
//     // Second pass - identify which GMIDs are used in FACT_BOM
//     if (bomData && bomData.length > 0) {
//         bomData.forEach(row => {
//             if (row.COMPONENT_GMID) {
//                 mapping.usedGmids.add(row.COMPONENT_GMID);
//             }
//         });
//     }
    
//     console.log(`GMID Display mapping complete: ${Object.keys(mapping.gmidToDisplay).length} GMIDs mapped`);
//     console.log(`${mapping.usedGmids.size} GMIDs used in FACT_BOM as COMPONENT_GMID`);
    
//     return mapping;
// }


/**
 * Builds GMID display mappings from the new table structure with H*_GMID and DISPLAY_* columns.
 * 
 * @param {Array} gmidDisplayData - Data from DIM_GMID_DISPLAY with H*_GMID and DISPLAY_* columns
 * @param {Array} bomData - Data from FACT_BOM with COMPONENT_GMID column
 * @returns {Object} - Mapping object containing various GMID mappings
 */
// function buildGmidDisplayMapping(gmidDisplayData, bomData) {
//     console.log("Building GMID Display mapping using new column structure");
    
//     // Create mapping object
//     const mapping = {
//         // Maps GMID to display information
//         gmidToDisplay: {},
//         // Maps hierarchy nodes to GMIDs
//         nodeToGmids: {},
//         // Maps path segments to GMIDs
//         pathSegmentToGmids: {},
//         // Maps each level's GMID to its display value
//         levelGmidToDisplay: {},
//         // Tracks which GMIDs are used in FACT_BOM as COMPONENT_GMID
//         usedGmids: new Set()
//     };
    
//     // First pass - build mappings from dimension data with new structure
//     if (gmidDisplayData && gmidDisplayData.length > 0) {
//         gmidDisplayData.forEach(row => {
//             // Skip rows without PATH_GMID
//             if (!row.PATH_GMID) return;
            
//             // Get COMPONENT_GMID (leaf GMID)
//             const componentGmid = row.COMPONENT_GMID;
//             if (!componentGmid) return;

//             // Process PATH_GMID - split by // to get the main hierarchy segments
//             const pathSegments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
//             if (pathSegments.length === 0) return;
            
//             // Store basic component information
//             mapping.gmidToDisplay[componentGmid] = {
//                 display: row.DISPLAY || componentGmid,
//                 rootGmid: row.ROOT_GMID || '',
//                 rootDisplay: row.ROOT_DISPLAY || '',
//                 path: row.PATH_GMID
//             };
            
//             // Process each hierarchy level using H*_GMID and DISPLAY_* values directly
//             for (let level = 1; level <= pathSegments.length; level++) {
//                 const hGmidKey = `H${level}_GMID`;
//                 const displayKey = `DISPLAY_${level}`;
                
//                 // Skip if this level doesn't have a corresponding H*_GMID value
//                 if (!row[hGmidKey]) continue;
                
//                 const levelGmid = row[hGmidKey];
                
//                 // Store display mapping for this level
//                 if (row[displayKey]) {
//                     // Map this level's GMID to its display value
//                     mapping.levelGmidToDisplay[levelGmid] = row[displayKey];
                    
//                     // Also add to gmidToDisplay for easier lookup
//                     if (!mapping.gmidToDisplay[levelGmid]) {
//                         mapping.gmidToDisplay[levelGmid] = {
//                             display: row[displayKey],
//                             level: level,
//                             isHierarchyNode: true
//                         };
//                     }
//                 }
                
//                 // Map hierarchy nodes to COMPONENT_GMIDs
//                 // This creates the relationship between hierarchy nodes and leaf GMIDs
//                 mapping.nodeToGmids[levelGmid] = mapping.nodeToGmids[levelGmid] || new Set();
//                 mapping.nodeToGmids[levelGmid].add(componentGmid);
                
//                 // Also map by display name if available
//                 if (row[displayKey]) {
//                     mapping.nodeToGmids[row[displayKey]] = mapping.nodeToGmids[row[displayKey]] || new Set();
//                     mapping.nodeToGmids[row[displayKey]].add(componentGmid);
//                 }
                
//                 // Map path segment to COMPONENT_GMIDs
//                 // This allows looking up all leaf GMIDs that contain this segment in their path
//                 mapping.pathSegmentToGmids[levelGmid] = mapping.pathSegmentToGmids[levelGmid] || new Set();
//                 mapping.pathSegmentToGmids[levelGmid].add(componentGmid);
//             }
//         });
//     }
    
//     // Second pass - identify which GMIDs are used in FACT_BOM
//     if (bomData && bomData.length > 0) {
//         bomData.forEach(row => {
//             if (row.COMPONENT_GMID) {
//                 mapping.usedGmids.add(row.COMPONENT_GMID);
//             }
//         });
//     }
    
//     // Convert Sets to Arrays for easier consumption
//     for (const key in mapping.pathSegmentToGmids) {
//         mapping.pathSegmentToGmids[key] = Array.from(mapping.pathSegmentToGmids[key]);
//     }
    
//     for (const key in mapping.nodeToGmids) {
//         mapping.nodeToGmids[key] = Array.from(mapping.nodeToGmids[key]);
//     }
    
//     mapping.usedGmids = Array.from(mapping.usedGmids);
    
//     console.log(`GMID Display mapping complete: ${Object.keys(mapping.gmidToDisplay).length} GMIDs mapped`);
//     console.log(`${mapping.usedGmids.length} GMIDs used in FACT_BOM as COMPONENT_GMID`);
    
//     return mapping;
// }

function buildGmidDisplayMapping(gmidDisplayData, bomData) {
    console.log("Building GMID Display mapping using revised structure");
    
    // Create mapping object
    const mapping = {
        // Maps GMID to display information
        gmidToDisplay: {},
        // Maps hierarchy nodes to GMIDs
        nodeToGmids: {},
        // Maps path segments to GMIDs
        pathSegmentToGmids: {},
        // Maps each level's GMID to its display value
        levelGmidToDisplay: {},
        // Tracks which GMIDs are used in FACT_BOM as COMPONENT_GMID
        usedGmids: new Set()
    };
    
    // First pass - build mappings from dimension data with new structure
    if (gmidDisplayData && gmidDisplayData.length > 0) {
        gmidDisplayData.forEach(row => {
            // Skip rows without PATH_GMID
            if (!row.PATH_GMID) return;
            
            // Get COMPONENT_GMID (leaf GMID)
            const componentGmid = row.COMPONENT_GMID;
            if (!componentGmid) return;

            // Process PATH_GMID - split by / to get the main hierarchy segments
            const pathSegments = row.PATH_GMID.split('/').filter(s => s.trim() !== '');
            if (pathSegments.length === 0) return;
            
            // Store basic component information
            mapping.gmidToDisplay[componentGmid] = {
                display: row.DISPLAY || componentGmid,
                rootGmid: row.ROOT_GMID || '',
                rootDisplay: row.ROOT_DISPLAY || '',
                path: row.PATH_GMID
            };
            
            // Map each H*_GMID to its corresponding DISPLAY_* value
            for (let level = 1; level <= pathSegments.length; level++) {
                const hGmidKey = `H${level}_GMID`;
                const displayKey = `DISPLAY_${level}`;
                
                // Skip if this level doesn't have a corresponding H*_GMID value
                if (!row[hGmidKey]) continue;
                
                const levelGmid = row[hGmidKey];
                
                // Map this level's GMID to its display value
                if (row[displayKey]) {
                    // Store in levelGmidToDisplay mapping
                    mapping.levelGmidToDisplay[levelGmid] = row[displayKey];
                    
                    // Also add to gmidToDisplay for easier lookup
                    if (!mapping.gmidToDisplay[levelGmid]) {
                        mapping.gmidToDisplay[levelGmid] = {
                            display: row[displayKey],
                            level: level,
                            isHierarchyNode: true
                        };
                    }
                }
                
                // Add to pathSegmentToGmids mapping
                mapping.pathSegmentToGmids[levelGmid] = mapping.pathSegmentToGmids[levelGmid] || new Set();
                
                // For each path segment, we store the COMPONENT_GMID that it's associated with
                // This allows lookups to find which COMPONENT_GMIDs are under a given hierarchy node
                mapping.pathSegmentToGmids[levelGmid].add(componentGmid);
                
                // Add to nodeToGmids mapping - only for root level nodes
                if (level === 1) {
                    mapping.nodeToGmids[levelGmid] = mapping.nodeToGmids[levelGmid] || new Set();
                    mapping.nodeToGmids[levelGmid].add(componentGmid);
                    
                    // Also map by display name if available
                    if (row[displayKey]) {
                        mapping.nodeToGmids[row[displayKey]] = mapping.nodeToGmids[row[displayKey]] || new Set();
                        mapping.nodeToGmids[row[displayKey]].add(componentGmid);
                    }
                }
            }
            
            // Ensure COMPONENT_GMID is in pathSegmentToGmids
            mapping.pathSegmentToGmids[componentGmid] = mapping.pathSegmentToGmids[componentGmid] || new Set();
            mapping.pathSegmentToGmids[componentGmid].add(componentGmid);
        });
    }
    
    // Second pass - identify which GMIDs are used in FACT_BOM
    if (bomData && bomData.length > 0) {
        bomData.forEach(row => {
            if (row.COMPONENT_GMID) {
                mapping.usedGmids.add(row.COMPONENT_GMID);
            }
        });
    }
    
    // Convert Sets to Arrays for easier consumption
    for (const key in mapping.pathSegmentToGmids) {
        mapping.pathSegmentToGmids[key] = Array.from(mapping.pathSegmentToGmids[key]);
    }
    
    for (const key in mapping.nodeToGmids) {
        mapping.nodeToGmids[key] = Array.from(mapping.nodeToGmids[key]);
    }
    
    mapping.usedGmids = Array.from(mapping.usedGmids);
    
    console.log(`GMID Display mapping complete: ${Object.keys(mapping.gmidToDisplay).length} GMIDs mapped`);
    console.log(`${mapping.usedGmids.length} GMIDs used in FACT_BOM as COMPONENT_GMID`);
    
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
    
    // Log the mapping statistics for verification
    console.log(`Item Cost Type mapping complete: ${Object.keys(mapping.codeToDesc).length} item cost types mapped`);
    console.log(`${mapping.usedItemCostTypes.size} item cost types used in FACT_BOM`);
    
    // Debug sample of the mappings
    const sampleSize = Math.min(5, Object.keys(mapping.descToFactCode).length);
    if (sampleSize > 0) {
        console.log("Sample descToFactCode mappings:");
        Object.entries(mapping.descToFactCode).slice(0, sampleSize).forEach(([desc, factCode]) => {
            console.log(`  "${desc}" -> "${factCode}"`);
        });
    }
    
    // Check for unmapped fact values
    const unmappedTypes = new Set();
    bomData.slice(0, 100).forEach(row => {
        if (row.ITEM_COST_TYPE && !Object.values(mapping.descToFactCode).includes(row.ITEM_COST_TYPE)) {
            unmappedTypes.add(row.ITEM_COST_TYPE);
        }
    });
    
    if (unmappedTypes.size > 0) {
        console.warn(`Warning: Found ${unmappedTypes.size} ITEM_COST_TYPE values in FACT_BOM that aren't mapped`);
        console.warn("First few unmapped types:", Array.from(unmappedTypes).slice(0, 5));
    } else {
        console.log("All sampled ITEM_COST_TYPE values in FACT_BOM are mapped correctly");
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
    
    console.log(`Material Type mapping complete: ${Object.keys(mapping.codeToDesc).length} material types mapped`);
    console.log(`${mapping.usedMaterialTypes.size} material types used in FACT_BOM as COMPONENT_MATERIAL_TYPE`);
    
    return mapping;
}


/**
 * Extract unique values from columns in FACT_BOM for filtering
 * @param {Array} bomData - BOM fact data
 * @returns {object} - Object containing unique values by column
 */
// function extractUniqueFactValues(bomData) {
//     const valueSet = {
//         ITEM_COST_TYPE: new Set(),
//         COMPONENT_MATERIAL_TYPE: new Set(),
//         ZYEAR: new Set(),
//         MC: new Set()
//     };
    
//     if (!bomData || bomData.length === 0) {
//         return {
//             ITEM_COST_TYPE: [],
//             COMPONENT_MATERIAL_TYPE: [],
//             ZYEAR: [],
//             MC:[]
//         };
//     }
    
//     // Extract unique values
//     bomData.forEach(row => {
//         if (row.ITEM_COST_TYPE) valueSet.ITEM_COST_TYPE.add(row.ITEM_COST_TYPE);
//         if (row.COMPONENT_MATERIAL_TYPE) valueSet.COMPONENT_MATERIAL_TYPE.add(row.COMPONENT_MATERIAL_TYPE);
//         if (row.ZYEAR) valueSet.ZYEAR.add(row.ZYEAR);
//         if (row.MC) valueSet.MC.add(row.MC);
//     });
    
//     // Convert to sorted arrays
//     return {
//         ITEM_COST_TYPE: Array.from(valueSet.ITEM_COST_TYPE).sort(),
//         COMPONENT_MATERIAL_TYPE: Array.from(valueSet.COMPONENT_MATERIAL_TYPE).sort(),
//         ZYEAR: Array.from(valueSet.ZYEAR).sort(),
//         MC: Array.from(valueSet.MC).sort()

//     };
// }


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


// Add to pivot-table.js
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


// Add to data.js
function processNonHierarchicalDimension(fieldId, factData) {
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
            label: item.MATERIAL_TYPE_DESC || item.MATERIAL_TYPE
        }));
    } else {
        // Extract from fact data
        const fieldName = isDimItemCostType ? 'ITEM_COST_TYPE' : 
                         isDimMaterialType ? 'COMPONENT_MATERIAL_TYPE' : 
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


// Export signature
export default {
    // Data processing
    getItemCostTypeDesc, 
    getMaterialTypeDesc,
    getDimensionDescription,
    
    // Core data functions
    autoLoadFiles,
    parseFile,
    setupDirectoryPicker,
    setupFileInputs,
    checkAllFilesUploaded,
    processFiles,
    processDirectory,
    handleFileChanges,
    processDimensionFiles,
    processDimensionHierarchies,
    processFactData,
    processHierarchicalFields,
    processMultiDimensionRows,
    processMultipleRowDimensions,
    filterDataByMultipleDimensions,
    enhancedFilterByMultipleDimensions,
    preservingFilterByDimension,
    preservingFilterByMultipleDimensions,
    processNonHierarchicalDimension,
    
    // Hierarchy functions
    buildGenericHierarchy,
    buildGenericPathHierarchy,
    buildLegalEntityHierarchy,
    buildSmartCodeHierarchy,
    buildCostElementHierarchy,
    buildGmidDisplayHierarchy,
    processDimensionHierarchies,
    getNodeById,
    flattenHierarchy,
    enhancedToggleNodeExpansion,
    
    // Calculation functions
    buildLegalEntityMapping,
    buildCostElementMapping,
    buildSmartCodeMapping,
    buildGmidDisplayMapping,
        
    // Data mapping
    //extractUniqueFactValues,
    initializeMappings,

    // others
    setAllNodesCollapsed,
    getVisibleLeafNodes,
    regenerateColumnHierarchies,
    filterRecordsByLeHierarchy,


  };