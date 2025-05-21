/**
 * Pivot Table Utilities
 * Helper functions to enhance pivot table functionality
 */

const PivotTableUtils = {
    /**
     * Initialize the pivot table enhancements
     * @param {string} tableSelector - CSS selector for the pivot table
     */
    initialize: function(tableSelector = '.table-modern') {
        // Get the table element
        const table = document.querySelector(tableSelector);
        if (!table) {
            console.warn('Pivot table not found with selector:', tableSelector);
            return;
        }

        // Apply appropriate view class based on table structure
        this.detectAndApplyViewClass(table);
        
        // Check for duplicate columns and hide them if needed
        this.hideDuplicateColumns(table);
        
        // Apply formatting to numeric values
        this.formatNumericValues(table);
        
        // Add event listeners for expand/collapse
        this.setupExpandCollapse(table);
        
        console.log('Pivot table utilities initialized');
    },

    /**
     * Detect the type of pivot view and apply appropriate class
     * @param {HTMLElement} table - The pivot table element
     */
    detectAndApplyViewClass: function(table) {
        const container = table.closest('.pivot-table-container') || table.parentElement;
        
        // Count column headers
        const headerRow = table.querySelector('thead tr:first-child');
        if (!headerRow) return;
        
        const headerCount = headerRow.querySelectorAll('th').length;
        
        // Check for "Total" and "Value" columns with same values
        const hasTotalAndValue = this.hasDuplicateTotalValueColumns(table);
        
        if (hasTotalAndValue) {
            // This is the rows-only view with duplicate Total/Value columns
            container.classList.add('pivot-view-rows-only');
            container.classList.add('hide-duplicates');
        } else if (headerCount > 3) {
            // This is likely the combined row+column hierarchy view
            container.classList.add('pivot-view-combined');
        } else {
            // Default to rows-only view
            container.classList.add('pivot-view-rows-only');
        }
    },

    /**
     * Check if table has Total and Value columns with duplicate values
     * @param {HTMLElement} table - The pivot table element
     * @returns {boolean} - Whether duplicate columns were detected
     */
    hasDuplicateTotalValueColumns: function(table) {
        // Get header cells to find Total and Value columns
        const headerRow = table.querySelector('thead tr:first-child');
        if (!headerRow) return false;
        
        const headers = Array.from(headerRow.querySelectorAll('th'));
        
        // Look for 'Total' and 'Value' headers
        const totalColIndex = headers.findIndex(th => 
            th.textContent.trim().toLowerCase() === 'total');
        
        const valueColIndex = headers.findIndex(th => 
            th.textContent.trim().toLowerCase() === 'value');
        
        // If both columns exist, check if they have the same values
        if (totalColIndex !== -1 && valueColIndex !== -1) {
            const dataRows = table.querySelectorAll('tbody tr');
            
            // Check a sample of rows to see if values match
            let matchCount = 0;
            let mismatchCount = 0;
            
            dataRows.forEach(row => {
                const totalCell = row.cells[totalColIndex];
                const valueCell = row.cells[valueColIndex];
                
                if (totalCell && valueCell && 
                    totalCell.textContent.trim() === valueCell.textContent.trim()) {
                    matchCount++;
                } else {
                    mismatchCount++;
                }
            });
            
            // If most rows match, consider them duplicates
            return matchCount > mismatchCount;
        }
        
        return false;
    },

    /**
     * Hide duplicate columns when Total and Value show the same data
     * @param {HTMLElement} table - The pivot table element
     */
    hideDuplicateColumns: function(table) {
        const container = table.closest('.pivot-table-container') || table.parentElement;
        
        // If already marked as having duplicates, hide the Total column
        if (container.classList.contains('hide-duplicates')) {
            const headerRow = table.querySelector('thead tr:first-child');
            if (!headerRow) return;
            
            const headers = Array.from(headerRow.querySelectorAll('th'));
            const totalColIndex = headers.findIndex(th => 
                th.textContent.trim().toLowerCase() === 'total');
            
            if (totalColIndex !== -1) {
                // Hide the Total column header
                headers[totalColIndex].style.display = 'none';
                
                // Hide the Total column cells
                table.querySelectorAll('tbody tr').forEach(row => {
                    if (row.cells[totalColIndex]) {
                        row.cells[totalColIndex].style.display = 'none';
                    }
                });
                
                console.log('Duplicate Total column hidden');
            }
        }
    },

    /**
     * Format numeric values in the pivot table
     * @param {HTMLElement} table - The pivot table element
     */
    formatNumericValues: function(table) {
        // Get all data cells (skipping the first column which is hierarchy)
        const dataCells = table.querySelectorAll('tbody td:not(:first-child)');
        
        dataCells.forEach(cell => {
            const text = cell.textContent.trim();
            
            // Skip empty cells
            if (!text) return;
            
            // Try to parse as numeric value
            const numValue = parseFloat(text.replace(/[^\d.-]/g, ''));
            
            if (!isNaN(numValue)) {
                // Add numeric class
                cell.classList.add('numeric-value');
                
                // Add specific classes based on value
                if (numValue === 0) {
                    cell.classList.add('zero-value');
                } else if (numValue < 0) {
                    cell.classList.add('negative-value');
                } else if (numValue > 1000000) {
                    cell.classList.add('large-value');
                } else if (numValue > 1000) {
                    cell.classList.add('medium-value');
                }
                
                // Format the value if needed
                // (Uncommenting this would replace the original formatting)
                /*
                if (Math.abs(numValue) >= 1000000) {
                    cell.textContent = (numValue / 1000000).toFixed(2) + 'M';
                } else if (Math.abs(numValue) >= 1000) {
                    cell.textContent = (numValue / 1000).toFixed(2) + 'K';
                }
                */
            }
        });
    },

    /**
     * Set up event handlers for expand/collapse controls
     * @param {HTMLElement} table - The pivot table element
     */
    setupExpandCollapse: function(table) {
        // Find all expand/collapse controls in the table
        const toggleControls = table.querySelectorAll('.expand-collapse');
        
        toggleControls.forEach(control => {
            // Skip if already has click handler
            if (control.hasClickListener) return;
            
            control.addEventListener('click', function(e) {
                const nodeId = this.getAttribute('data-node-id');
                const isExpanded = this.classList.contains('expanded');
                
                // Toggle the class
                this.classList.toggle('expanded');
                this.classList.toggle('collapsed');
                
                // Find all child rows and toggle their visibility
                const level = parseInt(this.closest('tr').getAttribute('data-level') || '0');
                const childRows = Array.from(table.querySelectorAll(`tr[data-parent="${nodeId}"], tr[data-path*="${nodeId}"]`));
                
                childRows.forEach(row => {
                    const childLevel = parseInt(row.getAttribute('data-level') || '0');
                    
                    // Only toggle immediate children
                    if (childLevel === level + 1) {
                        row.style.display = isExpanded ? 'none' : '';
                        
                        // If collapsing, also hide all descendants
                        if (isExpanded) {
                            const childId = row.getAttribute('data-node-id');
                            if (childId) {
                                const descendants = table.querySelectorAll(`tr[data-path*="${childId}"]`);
                                descendants.forEach(desc => {
                                    desc.style.display = 'none';
                                });
                            }
                        }
                    }
                });
                
                // Prevent default behavior
                e.stopPropagation();
            });
            
            // Mark as having a listener
            control.hasClickListener = true;
        });
    }
};

// Automatically initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    PivotTableUtils.initialize();
});

// Allow manual initialization
window.PivotTableUtils = PivotTableUtils;