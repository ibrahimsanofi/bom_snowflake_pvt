// Main.js - Main entry point for the pivot table application
import stateModule from './state.js';
import hierarchyUtils from './data.js';
import ui from './ui.js';
import pivotTable from './pivotTable.js';

// Main initialization function
function init() {
    console.log("⏳ Status: Initializing BOM Pivot Table application...");
    
    // Set up DOM references
    const elements = {
        rowFields: document.getElementById('rowFields'),
        columnFields: document.getElementById('columnFields'),
        valueFields: document.getElementById('valueFields'),
        filterFields: document.getElementById('filterFields'),
        availableFields: document.getElementById('availableFields'),
        pivotTableContainer: document.getElementById('pivotTableContainer'),
        pivotTable: document.getElementById('pivotTable'),
        pivotTableHeader: document.getElementById('pivotTableHeader'),
        pivotTableBody: document.getElementById('pivotTableBody'),
        connectionStatus: document.getElementById('connectionStatus'),
        loadDataBtn: document.getElementById('loadDataBtn'),
        resetBtn: document.getElementById('resetBtn'),
        exportBtn: document.getElementById('exportBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        collapseAllBtn: document.getElementById('collapseAllBtn'),
        expandAllBtn: document.getElementById('expandAllBtn')
    };
    
    // Check if we have the necessary elements
    if (!elements.rowFields || !elements.columnFields || !elements.valueFields || !elements.pivotTable) {
        console.error("❌ Error: Required DOM elements not found");
        return;
    }
    
    // Initialize UI components
    ui.initDragAndDrop();
    ui.setupResetUI();
    
    // Initialize pivot table
    pivotTable.initPivotTable();

    // Initialize auto adjustmnet script for pivot table columns
    // if (typeof pivotTable.addAutoAdjustScript === 'function'){
    //     pivotTable.addAutoAdjustScript();
    // }
    
    // Add load data button handler
    if (elements.loadDataBtn) {
        elements.loadDataBtn.addEventListener('click', () => {
            loadDataAndSetupTable(elements);
        });
    }
    
    // Add refresh button handler
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', () => {
            pivotTable.generatePivotTable();
        });
    }
    
    // Add export button handler
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportPivotTable);
    }
    
    // Add expand/collapse handlers
    window.handleRowExpandCollapse = pivotTable.handleRowExpandCollapse;
    window.handleColumnExpandCollapse = pivotTable.handleColumnExpandCollapse;
    
    // Handle tab switching
    setupTabNavigation();
    
    // Set up filter section toggle
    setupFilterSectionToggle();
    
    // Set up activity log
    ui.setupActivityLogControls();
    ui.setupConsoleInterception();
    
    // Expose debug functions
    stateModule.exposeDebugCommands();


    
    // Initialize state and load data if available
    console.log("✅ Status: Application initialized");
    
    // Check if we should auto-load data
    if (elements.loadDataBtn && shouldAutoLoadData()) {
        console.log("⏳ Status: Auto-loading data...");
        
        // Simulate load data button click after a short delay
        setTimeout(() => {
            elements.loadDataBtn.click();
        }, 500);
    }
}

/**
 * Load data and setup the pivot table
 * @param {Object} elements - DOM elements
 */
function loadDataAndSetupTable(elements) {
    // Update connection status
    if (elements.connectionStatus) {
        elements.connectionStatus.innerHTML = `
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>Loading data from Snowflake database...</span>
        `;
    }
    
    // Call the ingestData method from test.js
    hierarchyUtils.ingestData(elements).then(success => {
        if (success) {
            // Update connection status
            if (elements.connectionStatus) {
                elements.connectionStatus.innerHTML = `
                    <i class="fas fa-check-circle" style="color: green;"></i>
                    <span>Connected to Snowflake database</span>
                `;
            }
            
            // Initialize UI components with loaded data
            ui.setDefaultFields();
            ui.renderAvailableFields(elements);
            ui.renderFieldContainers(elements, stateModule.state);
            
            // Set root nodes to collapsed by default
            ensureRootNodesCollapsed();
            
            // Show app content
            const appContent = document.getElementById('appContent');
            if (appContent) {
                appContent.style.display = 'block';
            }
            
            // Generate initial empty pivot table
            pivotTable.generatePivotTable();
            
            console.log("✅ Status: Data loaded and UI initialized");
        } else {
            // Update connection status for failure
            if (elements.connectionStatus) {
                elements.connectionStatus.innerHTML = `
                    <i class="fas fa-exclamation-circle" style="color: red;"></i>
                    <span>Failed to connect to Snowflake database</span>
                `;
            }
            
            console.error("❌ Error: Failed to load data");
        }
    }).catch(error => {
        console.error("❌ Error loading data:", error);
        
        // Update connection status for error
        if (elements.connectionStatus) {
            elements.connectionStatus.innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: red;"></i>
                <span>Error connecting to database: ${error.message}</span>
            `;
        }
    });
}

/**
 * Ensure root nodes are collapsed by default
 */
function ensureRootNodesCollapsed() {
    // Set root expansion state to false
    for (const dimName in stateModule.state.expandedNodes) {
        if (stateModule.state.expandedNodes[dimName].row) {
            stateModule.state.expandedNodes[dimName].row['ROOT'] = false;
        }
        
        if (stateModule.state.expandedNodes[dimName].column) {
            stateModule.state.expandedNodes[dimName].column['ROOT'] = false;
        }
    }
    
    // Also ensure the hierarchies have root nodes collapsed
    for (const dimName in stateModule.state.hierarchies) {
        const hierarchy = stateModule.state.hierarchies[dimName];
        
        if (hierarchy && hierarchy.root) {
            hierarchy.root.expanded = false;
        }
    }
    
    console.log("✅ Status: Root nodes set to collapsed by default");
}

/**
 * Determine if we should auto-load data
 * @returns {boolean} - Whether to auto-load data
 */
function shouldAutoLoadData() {
    // Auto-load if we have cached state
    const hasCachedState = localStorage.getItem('pivotTableMinimal') !== null;
    
    // Also check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const autoLoad = urlParams.get('autoLoad');
    
    return hasCachedState || autoLoad === 'true';
}

/**
 * Set up tab navigation
 */
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show the corresponding tab content
            const tabContentId = `${tab.getAttribute('data-tab')}TabContent`;
            const tabContent = document.getElementById(tabContentId);
            
            if (tabContent) {
                tabContent.classList.add('active');
                
                // If switching to pivot table tab, refresh the table
                if (tab.getAttribute('data-tab') === 'pivot') {
                    pivotTable.generatePivotTable();
                }
                
                // If switching to chart tab, generate chart
                if (tab.getAttribute('data-tab') === 'chart') {
                    generateChart();
                }
            }
        });
    });
}

/**
 * Set up filter section toggle
 */
function setupFilterSectionToggle() {
    const filterHeader = document.getElementById('filterHeader');
    const filterContent = document.getElementById('filterContent');
    const toggleButton = document.getElementById('toggleFilterContent');
    
    if (filterHeader && filterContent && toggleButton) {
        toggleButton.addEventListener('click', () => {
            // Toggle filter content visibility
            if (filterContent.style.display === 'none') {
                filterContent.style.display = 'block';
                toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
            } else {
                filterContent.style.display = 'none';
                toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
            }
        });
    }
}

/**
 * Generate chart based on pivot table data
 */
function generateChart() {
    // Get chart area
    const chartArea = document.getElementById('chartArea');
    
    if (!chartArea) return;
    
    // Check if we have data
    if (!stateModule.state.rowFields || stateModule.state.rowFields.length === 0 ||
        !stateModule.state.valueFields || stateModule.state.valueFields.length === 0) {
        
        // Show placeholder
        chartArea.innerHTML = `
            <div class="chart-placeholder">
                <i class="fas fa-chart-bar"></i>
                <p>Set up your pivot table first to generate a chart</p>
            </div>
        `;
        
        return;
    }
    
    // In a real implementation, this would create a chart based on the pivot data
    // For now, just show a message
    chartArea.innerHTML = `
        <div class="chart-placeholder">
            <i class="fas fa-chart-bar"></i>
            <p>Chart visualization would be generated here based on your pivot table data</p>
        </div>
    `;
}

/**
 * Export pivot table to CSV
 */
function exportPivotTable() {
    // Get the pivot table
    const pivotTable = document.getElementById('pivotTable');
    
    if (!pivotTable) {
        console.error("❌ Error: Pivot table element not found");
        return;
    }
    
    // Get all rows
    const rows = Array.from(pivotTable.querySelectorAll('tr'));
    
    // Create CSV content
    let csvContent = '';
    
    // Process each row
    rows.forEach(row => {
        // Get all cells in this row
        const cells = Array.from(row.querySelectorAll('th, td'));
        
        // Map cells to text content
        const cellValues = cells.map(cell => {
            // Get cell content, clean it, and escape quotes
            let value = cell.textContent.trim().replace(/"/g, '""');
            
            // If the value contains commas, quotes, or newlines, wrap in quotes
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
            }
            
            return value;
        });
        
        // Add row to CSV
        csvContent += cellValues.join(',') + '\r\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'pivot_table_export.csv');
    link.style.display = 'none';
    
    // Add to document
    document.body.appendChild(link);
    
    // Click the link to trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log("✅ Status: Pivot table exported to CSV");
}

/**
 * Setup adjustable column widths
 */
function setupAdjustableColumns() {
    const pivotTable = document.getElementById('pivotTable');
    
    // If we don't have a table, do nothing
    if (!pivotTable) return;
    
    // Add event listeners for column resize
    pivotTable.addEventListener('mousedown', startColumnResize);
    
    // Function to start column resize
    function startColumnResize(event) {
        // Check if we clicked on a resize handle
        if (!event.target.classList.contains('column-resize-handle')) return;
        
        // Get the th element and column index
        const th = event.target.parentElement;
        const colIndex = Array.from(th.parentElement.children).indexOf(th);
        
        // Get the col element
        const colElement = pivotTable.querySelectorAll('col')[colIndex];
        
        // Starting width
        const startWidth = th.offsetWidth;
        const startX = event.clientX;
        
        // Track mouse movement
        function trackMouseMove(moveEvent) {
            // Calculate new width
            const newWidth = startWidth + (moveEvent.clientX - startX);
            
            // Set new width
            if (colElement) {
                colElement.style.width = `${newWidth}px`;
                colElement.style.minWidth = `${newWidth}px`;
            }
        }
        
        // Function to stop resizing
        function stopResize() {
            // Remove event listeners
            document.removeEventListener('mousemove', trackMouseMove);
            document.removeEventListener('mouseup', stopResize);
        }
        
        // Add event listeners
        document.addEventListener('mousemove', trackMouseMove);
        document.addEventListener('mouseup', stopResize);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export public API
export default {
    init,
    loadDataAndSetupTable,
    exportPivotTable,
    setupAdjustableColumns
};
