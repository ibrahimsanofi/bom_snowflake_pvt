/**
 * PIVOT TABLE LOADING ANIMATION INTEGRATION
 * Fixed version - Add this to your existing pivot table JavaScript files
 */

// ========================================
// LOADING ANIMATION MANAGER
// ========================================

class PivotLoadingManager {
    constructor() {
        this.isLoading = false;
        this.currentStep = 0;
        this.statusTimeout = null;
        this.autoHideTimeout = null;
        
        // Create and inject the loading HTML
        this.createLoadingElements();
    }
      
    /**
     * Create and inject loading elements into the pivot table container
     */
    createLoadingElements() {
        const pivotContainer = document.getElementById('pivotTableContainer') || 
                              document.querySelector('.pivot-table-container') ||
                              document.querySelector('[id*="pivot"]') ||
                              document.querySelector('[class*="pivot"]');
        
        if (!pivotContainer) {
            console.warn('Pivot table container not found. Looking for: #pivotTableContainer, .pivot-table-container, or elements containing "pivot"');
            return;
        }
        
        // Ensure container has relative positioning
        if (getComputedStyle(pivotContainer).position === 'static') {
            pivotContainer.style.position = 'relative';
        }
        
        // Remove existing loaders if they exist
        const existingFullLoader = document.getElementById('pivotFullLoader');
        const existingCompactLoader = document.getElementById('pivotCompactLoader');
        if (existingFullLoader) existingFullLoader.remove();
        if (existingCompactLoader) existingCompactLoader.remove();
        
        // Create full overlay loader
        const fullLoader = document.createElement('div');
        fullLoader.className = 'pivot-loading-overlay';
        fullLoader.id = 'pivotFullLoader';
        fullLoader.innerHTML = this.getFullLoaderHTML();
        
        // Create compact loader
        const compactLoader = document.createElement('div');
        compactLoader.className = 'pivot-compact-loader';
        compactLoader.id = 'pivotCompactLoader';
        compactLoader.innerHTML = this.getCompactLoaderHTML();
        
        // Append to container
        pivotContainer.appendChild(fullLoader);
        pivotContainer.appendChild(compactLoader);
        
        console.log('✅ Pivot loading animations created successfully');
    }
    
    /**
     * Get HTML for full overlay loader
     */
    getFullLoaderHTML() {
        return `
            <div class="pivot-loading-content">
                <div class="pivot-loading-icon">
                    <div class="pivot-grid">
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                        <div class="pivot-cell"></div>
                    </div>
                </div>
                
                <div class="pivot-loading-text" id="pivotLoadingText">Refreshing Pivot Table</div>
                <div class="pivot-loading-subtitle">Processing your data configuration changes...</div>
                
                <div class="pivot-progress-container">
                    <div class="pivot-progress-bar"></div>
                </div>
                
                <ul class="pivot-status-list" id="pivotStatusList">
                    <li class="pivot-status-item" data-step="1">
                        <div class="pivot-status-icon">
                            <div class="status-spinner"></div>
                        </div>
                        <span>Applying field changes...</span>
                    </li>
                    <li class="pivot-status-item" data-step="2">
                        <div class="pivot-status-icon">
                            <div class="status-spinner"></div>
                        </div>
                        <span>Recalculating aggregations...</span>
                    </li>
                    <li class="pivot-status-item" data-step="3">
                        <div class="pivot-status-icon">
                            <div class="status-spinner"></div>
                        </div>
                        <span>Rendering table structure...</span>
                    </li>
                </ul>
            </div>
        `;
    }
    
    /**
     * Get HTML for compact loader
     */
    getCompactLoaderHTML() {
        return `
            <div class="compact-spinner"></div>
            <div class="compact-text">Updating...</div>
        `;
    }
    
    /**
     * Show loading animation
     * @param {string} type - 'full' or 'compact'
     * @param {Object} options - Configuration options
     */
    show(type = 'full', options = {}) {
        // Don't show multiple full loaders
        if (this.isLoading && type === 'full') {
            console.log('Full loader already active');
            return;
        }
        
        this.isLoading = true;
        this.currentStep = 0;
        
        const {
            title = 'Refreshing Pivot Table',
            subtitle = 'Processing your data configuration changes...',
            steps = [
                'Applying field changes...',
                'Recalculating aggregations...',
                'Rendering table structure...'
            ],
            stepDuration = 1500,
            autoHide = true,
            autoHideDelay = 8000
        } = options;
        
        if (type === 'full') {
            this.showFullLoader(title, subtitle, steps, stepDuration);
        } else {
            this.showCompactLoader();
        }
        
        // Auto-hide if requested
        if (autoHide) {
            if (this.autoHideTimeout) {
                clearTimeout(this.autoHideTimeout);
            }
            this.autoHideTimeout = setTimeout(() => {
                this.hide();
            }, autoHideDelay);
        }
        
        console.log(`🔄 Pivot loading animation started (${type})`);
    }
    
    /**
     * Show full overlay loader
     */
    showFullLoader(title, subtitle, steps, stepDuration) {
        const loader = document.getElementById('pivotFullLoader');
        const loadingText = document.getElementById('pivotLoadingText');
        const loadingSubtitle = loader?.querySelector('.pivot-loading-subtitle');
        
        if (!loader) {
            console.error('Full loader element not found');
            return;
        }
        
        // Update text content
        if (loadingText) loadingText.textContent = title;
        if (loadingSubtitle) loadingSubtitle.textContent = subtitle;
        
        // Show loader
        loader.classList.add('active');
        
        // Start status progression
        this.progressThroughSteps(steps, stepDuration);
    }
    
    /**
     * Show compact loader
     */
    showCompactLoader() {
        const loader = document.getElementById('pivotCompactLoader');
        if (loader) {
            loader.classList.add('active');
        } else {
            console.error('Compact loader element not found');
        }
    }
    
    /**
     * Progress through loading steps
     */
    progressThroughSteps(steps, stepDuration) {
        const statusItems = document.querySelectorAll('#pivotStatusList .pivot-status-item');
        
        if (statusItems.length === 0) {
            console.warn('No status items found for progression');
            return;
        }
        
        const progressStep = () => {
            if (this.currentStep < statusItems.length) {
                // Mark current step as active
                statusItems[this.currentStep].classList.add('active');
                
                // Mark previous steps as completed
                if (this.currentStep > 0) {
                    const prevStep = statusItems[this.currentStep - 1];
                    prevStep.classList.remove('active');
                    prevStep.classList.add('completed');
                    const spinner = prevStep.querySelector('.status-spinner');
                    if (spinner) {
                        spinner.innerHTML = '<i class="status-check">✓</i>';
                    }
                }
                
                this.currentStep++;
                this.statusTimeout = setTimeout(progressStep, stepDuration);
            } else {
                // Complete the last step
                const lastStep = statusItems[statusItems.length - 1];
                lastStep.classList.remove('active');
                lastStep.classList.add('completed');
                const lastSpinner = lastStep.querySelector('.status-spinner');
                if (lastSpinner) {
                    lastSpinner.innerHTML = '<i class="status-check">✓</i>';
                }
            }
        };
        
        progressStep();
    }
    
    /**
     * Hide loading animation
     */
    hide() {
        if (!this.isLoading) return;
        
        this.isLoading = false;
        
        // Clear timeouts
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        
        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }
        
        // Hide loaders
        const fullLoader = document.getElementById('pivotFullLoader');
        const compactLoader = document.getElementById('pivotCompactLoader');
        
        if (fullLoader) fullLoader.classList.remove('active');
        if (compactLoader) compactLoader.classList.remove('active');
        
        // Reset status items after animation completes
        setTimeout(() => {
            this.resetStatusItems();
        }, 300);
        
        console.log('✅ Pivot loading animation hidden');
    }
    
    /**
     * Reset status items to initial state
     */
    resetStatusItems() {
        const statusItems = document.querySelectorAll('#pivotStatusList .pivot-status-item');
        statusItems.forEach(item => {
            item.classList.remove('active', 'completed');
            const spinner = item.querySelector('.pivot-status-icon');
            if (spinner) {
                spinner.innerHTML = '<div class="status-spinner"></div>';
            }
        });
        this.currentStep = 0;
    }
    
    /**
     * Update loading message
     */
    updateMessage(title, subtitle) {
        const loadingText = document.getElementById('pivotLoadingText');
        const loadingSubtitle = document.querySelector('.pivot-loading-subtitle');
        
        if (loadingText && title) loadingText.textContent = title;
        if (loadingSubtitle && subtitle) loadingSubtitle.textContent = subtitle;
    }
    
    /**
     * Check if loader is currently active
     */
    isActive() {
        return this.isLoading;
    }
}

// ========================================
// INTEGRATION WITH EXISTING PIVOT TABLE
// ========================================

// Global loading manager instance
let pivotLoadingManager = null;

/**
 * Initialize the loading manager
 */
function initializePivotLoadingManager() {
    try {
        pivotLoadingManager = new PivotLoadingManager();
        
        // Make it globally accessible
        window.pivotLoadingManager = pivotLoadingManager;
        
        console.log('✅ Pivot loading manager initialized');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize pivot loading manager:', error);
        return false;
    }
}

/**
 * Hook into your existing pivot table generation function
 * Add these calls to your pivot table code
 */
function integrateWithPivotTable() {
    // Store reference to original function if it exists
    const originalGeneratePivotTable = window.generatePivotTable;
    
    if (originalGeneratePivotTable && typeof originalGeneratePivotTable === 'function') {
        window.generatePivotTable = function(...args) {
            console.log('🔄 Starting pivot table generation with loading animation');
            
            // Show loading animation
            if (window.pivotLoadingManager) {
                window.pivotLoadingManager.show('full', {
                    title: 'Generating Pivot Table',
                    subtitle: 'Please wait while we process your configuration...',
                    steps: [
                        'Processing field configuration...',
                        'Calculating aggregations...',
                        'Rendering table layout...'
                    ],
                    stepDuration: 1200,
                    autoHide: true,
                    autoHideDelay: 6000
                });
            }
            
            // Execute original function
            try {
                const result = originalGeneratePivotTable.apply(this, args);
                
                // If it's a promise, handle accordingly
                if (result && typeof result.then === 'function') {
                    return result.finally(() => {
                        if (window.pivotLoadingManager) {
                            window.pivotLoadingManager.hide();
                        }
                    });
                } else {
                    // Hide after a short delay for non-promise returns
                    setTimeout(() => {
                        if (window.pivotLoadingManager) {
                            window.pivotLoadingManager.hide();
                        }
                    }, 2000);
                    
                    return result;
                }
            } catch (error) {
                console.error('Error in pivot table generation:', error);
                if (window.pivotLoadingManager) {
                    window.pivotLoadingManager.hide();
                }
                throw error;
            }
        };
        
        console.log('✅ Pivot table function wrapped with loading animation');
    } else {
        console.log('ℹ️ No existing generatePivotTable function found to wrap');
    }
}

// ========================================
// FIELD CHANGE DETECTION
// ========================================

/**
 * Detect when users drag/drop fields and show compact loader
 */
function setupFieldChangeDetection() {
    // Watch for changes in pivot field containers
    const fieldContainers = [
        document.getElementById('rowFields'),
        document.getElementById('columnFields'),
        document.getElementById('valueFields'),
        document.querySelector('[id*="row"]'),
        document.querySelector('[id*="column"]'),
        document.querySelector('[id*="value"]')
    ].filter(el => el !== null);
    
    if (fieldContainers.length === 0) {
        console.log('ℹ️ No field containers found for change detection');
        return;
    }
    
    fieldContainers.forEach(container => {
        // Use MutationObserver to detect field changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && 
                    (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                    
                    // Show compact loader for quick field changes
                    if (window.pivotLoadingManager) {
                        window.pivotLoadingManager.show('compact', {
                            autoHide: true,
                            autoHideDelay: 3000
                        });
                    }
                }
            });
        });
        
        observer.observe(container, {
            childList: true,
            subtree: true
        });
    });
    
    console.log(`✅ Field change detection setup complete for ${fieldContainers.length} containers`);
}

// ========================================
// AUTO-INITIALIZATION
// ========================================

/**
 * Initialize everything when DOM is ready
 */
function initializeWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performInitialization);
    } else {
        // DOM is already ready
        performInitialization();
    }
}

function performInitialization() {
    console.log('🚀 Initializing pivot loading animations...');
    
    // Small delay to ensure other scripts are loaded
    setTimeout(() => {
        const success = initializePivotLoadingManager();
        
        if (success) {
            integrateWithPivotTable();
            setupFieldChangeDetection();
            console.log('✅ Pivot loading animations fully integrated');
        } else {
            console.warn('⚠️ Pivot loading animations failed to initialize');
        }
    }, 1000);
}

// Start initialization
initializeWhenReady();

// ========================================
// MANUAL CONTROL FUNCTIONS
// ========================================

/**
 * Manual functions you can call from anywhere in your code
 */

// Show loading for specific operations
window.showPivotLoader = (type = 'full', options = {}) => {
    if (window.pivotLoadingManager) {
        window.pivotLoadingManager.show(type, options);
    } else {
        console.warn('Pivot loading manager not initialized yet');
    }
};

// Hide loading
window.hidePivotLoader = () => {
    if (window.pivotLoadingManager) {
        window.pivotLoadingManager.hide();
    } else {
        console.warn('Pivot loading manager not initialized yet');
    }
};

// Check if loading is active
window.isPivotLoading = () => {
    return window.pivotLoadingManager ? window.pivotLoadingManager.isActive() : false;
};

// Update loading message
window.updatePivotLoaderMessage = (title, subtitle) => {
    if (window.pivotLoadingManager) {
        window.pivotLoadingManager.updateMessage(title, subtitle);
    }
};