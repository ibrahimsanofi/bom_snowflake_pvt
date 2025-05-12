
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
            console.warn('⚠️ Warning: State not initialized when calling initializeExpandedNodes');
            return;
        }
        
        this.state.expandedNodes = {
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
        if (this.state.hierarchies) {
            Object.keys(this.state.hierarchies).forEach(hierarchyName => {
                const hierarchy = this.state.hierarchies[hierarchyName];
                if (hierarchy && hierarchy.root) {
                    hierarchy.root.expanded = true;
                }
            });
        }
        
        console.log("✅ Status: Initialized hierarchy expansion states:", this.state.expandedNodes);
    },

    
    /**
     * Log debug messages to console with an object for inspection
     * @param {string} message - The debug message to display
     * @param {any} object - The object to inspect in console
     */
    debugLog: function(message, object) {
        console.log(`DEBUG: ${message}`, object);
    },

    /**
     * Update the application UI based on the connection status
     * @param {boolean} connected - Whether connected to database
     */
    updateConnectionUI: function(connected) {
        const elements = this.getDomElements();
        
        // Update load data button
        if (elements.loadDataBtn) {
            elements.loadDataBtn.disabled = !connected;
        }
        
        // Show appropriate sections
        if (elements.appContent) {
            elements.appContent.style.display = connected ? 'block' : 'none';
        }
    },
    
    /**
     * Update table status indicators
     * @param {string} tableName - The table name
     * @param {string} status - Status (waiting, loading, loaded, error)
     */
    updateTableStatus: function(tableName, status) {
        const normalizedName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const statusElementId = `${normalizedName}Status`;
        const statusElement = document.getElementById(statusElementId);
        
        if (statusElement) {
            statusElement.className = `table-status ${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }
};


// Export the core module
export default core;