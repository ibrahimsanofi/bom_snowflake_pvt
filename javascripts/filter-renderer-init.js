// filter-renderer-init.js
// This module initializes the enhanced filter renderer

import EnhancedFilterRenderer from './enhanced-filter-renderer.js';

/**
 * Initialize the enhanced filter renderer when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing enhanced filter renderer');
    
    // Initialize with a small delay to ensure all dependencies are loaded
    setTimeout(function() {
        console.log('Initializing enhanced filter renderer');
        EnhancedFilterRenderer.initialize();
        
        // Force immediate filter rendering
        if (window.renderFilterControls) {
            console.log('Initial filter rendering');
            window.renderFilterControls();
        }
    }, 500);
});

/**
 * Override window.renderFilterControls after page load
 * This ensures filters update correctly after fields are dragged/dropped
 */
window.addEventListener('load', function() {
    console.log('Page loaded, overriding renderFilterControls');
    
    // Capture original method if it hasn't been done yet
    if (!window.originalRenderFilterControls && window.renderFilterControls) {
        window.originalRenderFilterControls = window.renderFilterControls;
    }
    
    // Override with enhanced method
    window.renderFilterControls = function() {
        console.log('Enhanced renderFilterControls called');
        EnhancedFilterRenderer.enhancedRenderFilterControls();
    };
});

/**
 * Listen for field changes in the filter zone
 * This ensures filters are regenerated when fields are added/removed
 */
document.addEventListener('DOMContentLoaded', function() {
    // Select the filter fields container
    const filterFields = document.getElementById('filterFields');
    if (!filterFields) {
        console.warn('Filter fields container not found, cannot monitor for changes');
        return;
    }
    
    // Create a mutation observer to detect changes to the filter fields
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Fields have been added or removed
                console.log('Filter fields changed, updating filters');
                
                // Update the filters after a short delay to allow state updates
                setTimeout(function() {
                    if (window.renderFilterControls) {
                        window.renderFilterControls();
                    }
                }, 100);
            }
        });
    });
    
    // Start observing the filter fields container
    observer.observe(filterFields, { childList: true });
});

/**
 * Add event handler to apply filters button
 * This ensures we use the enhanced filtering system
 */
document.addEventListener('DOMContentLoaded', function() {
    // Handle click on "Apply Filters" button
    document.addEventListener('click', function(event) {
        if (event.target.id === 'applyFiltersBtn' || event.target.closest('#applyFiltersBtn')) {
            event.preventDefault();
            
            // Apply filters using enhanced renderer
            EnhancedFilterRenderer.applyFilters();
        }
    });
});

/**
 * Event handler for data loaded events
 * We need to initialize (or re-initialize) the filter system
 * whenever new data is loaded
 */
document.addEventListener('dataLoaded', function() {
    console.log('Data loaded event detected, initializing enhanced filters');
    setTimeout(function() {
        EnhancedFilterRenderer.initialize();
        EnhancedFilterRenderer.enhancedRenderFilterControls();
    }, 200);
});

/**
 * Handle the Load Data button click
 */
document.addEventListener('click', function(event) {
    if (event.target.id === 'loadDataBtn' || event.target.closest('#loadDataBtn')) {
        console.log('Load data button clicked, will re-initialize filters when data loads');
        
        // Data loading can take time, so we'll wait and then try to update filters
        setTimeout(function() {
            console.log('Checking if data is loaded...');
            if (window.stateModule && window.stateModule.state.factData) {
                console.log('Data loaded, updating filters');
                EnhancedFilterRenderer.enhancedRenderFilterControls();
            } else {
                console.log('Data not yet loaded, will try again');
                // Try again later
                setTimeout(function() {
                    console.log('Second attempt to update filters');
                    EnhancedFilterRenderer.enhancedRenderFilterControls();
                }, 2000);
            }
        }, 1000);
    }
});

/**
 * Add a direct activation option if the filter is not showing up
 * This can help debug issues with the filter not displaying
 */
window.forceRenderFilters = function() {
    console.log('Forcing filter rendering via manual call');
    EnhancedFilterRenderer.initialize();
    EnhancedFilterRenderer.enhancedRenderFilterControls();
    return 'Filter rendering forced';
};

console.log('Enhanced filter renderer initialization module loaded');