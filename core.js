
// This module now focuses only on core app functionality. There is no direct imports of other app modules to avoid circular dependencies

const core = {
    // Store a reference to state that will be set during initialization
    state: null,
    
    /**
     * Set the state reference - called from app-init.js
     */
    setState: function(stateRef) {
        this.state = stateRef;
    },

    
    /**
     * Get DOM elements needed by the application
     * @returns {Object} Object containing DOM element references
     */
    getDomElements: function() {
        return {
            // Directory picker
            selectDirectoryBtn: document.getElementById('selectDirectoryBtn'),
            directoryPath: document.getElementById('directoryPath'),
            fileList: document.getElementById('fileList'),
            
            // File status indicators
            dimLegalEntityStatus: document.getElementById('dimLegalEntityStatus'),
            factBOMStatus: document.getElementById('factBOMStatus'),
            dimCostElementStatus: document.getElementById('dimCostElementStatus'),
            dimGMIDDisplayStatus: document.getElementById('dimGMIDDisplayStatus'),
            dimSmartCodeStatus: document.getElementById('dimSmartCodeStatus'),
            dimItemCostTypeStatus: document.getElementById('dimItemCostTypeStatus'),
            dimMaterialTypeStatus: document.getElementById('dimMaterialTypeStatus'),
            
            // File inputs
            factBOMFile: document.getElementById('factBOMFile'),
            dimLegalEntityFile: document.getElementById('dimLegalEntityFile'),
            dimCostElementFile: document.getElementById('dimCostElementFile'),
            dimGMIDDisplayFile: document.getElementById('dimGMIDDisplayFile'),
            dimSmartCodeFile: document.getElementById('dimSmartCodeFile'),
            dimItemCostTypeFile: document.getElementById('dimItemCostTypeFile'),
            dimMaterialTypeFile: document.getElementById('dimMaterialTypeFile'),
            
            // Buttons and status
            processFilesBtn: document.getElementById('processFilesBtn'),
            uploadStatus: document.getElementById('uploadStatus'),
            
            // App sections
            appContent: document.getElementById('appContent'),
            fallbackUpload: document.getElementById('fallbackUpload'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            
            // Tabs and content
            tabs: document.querySelectorAll('.tab'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Field containers
            availableFields: document.getElementById('availableFields'),
            rowFields: document.getElementById('rowFields'),
            columnFields: document.getElementById('columnFields'),
            valueFields: document.getElementById('valueFields'),
            filterFields: document.getElementById('filterFields'),
            
            // Pivot table
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };
    },

    
    /**
     * Initialize expanded nodes for all hierarchies
     * Sets the default expansion state to only show root nodes
     */
    initializeExpandedNodes: function() {
        if (!this.state) {
            console.warn('State not initialized when calling initializeExpandedNodes');
            return;
        }
        
        this.state.expandedNodes = {
            legal_entity: {
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
            smart_code: {
                row: { 'ROOT': true },
                column: { 'ROOT': true }
            }
        };
    
        // Also ensure the hierarchy roots have their expanded property set to true
        if (this.state.hierarchies) {
            Object.keys(this.state.hierarchies).forEach(hierarchyName => {
                const hierarchy = this.state.hierarchies[hierarchyName];
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
                                this.state.expandedNodes.cost_element.row[childId] = true;
                                this.state.expandedNodes.cost_element.column[childId] = true;
                            }
                        });
                    }
                }
            });
        }
        
        console.log("Initialized hierarchy expansion states:", this.state.expandedNodes);
    },

    
    /**
     * Log debug messages to console with an object for inspection
     * @param {string} message - The debug message to display
     * @param {any} object - The object to inspect in console
     */
    debugLog: function(message, object) {
        console.log(`DEBUG: ${message}`, object);
    }
};


// Export the core module
export default core;