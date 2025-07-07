
// A function for monitoring RAM use by the App
(function() {
    'use strict';
    
    // Enhanced data discovery function
    function findApplicationData() {
        console.log('🔍 Searching for application data...');
        
        const results = {
            factData: null,
            dimensions: null,
            hierarchies: null,
            mappings: null,
            locations: {}
        };
        
        // Function to recursively search for data in objects
        function searchInObject(obj, path, maxDepth = 3, currentDepth = 0) {
            if (!obj || typeof obj !== 'object' || currentDepth > maxDepth) return;
            
            try {
                for (let key in obj) {
                    if (!obj.hasOwnProperty(key)) continue;
                    
                    const value = obj[key];
                    const fullPath = path ? `${path}.${key}` : key;
                    
                    // Check for factData (large arrays)
                    if (key === 'factData' && Array.isArray(value) && value.length > 0) {
                        console.log(`✅ Found factData at ${fullPath}: ${value.length} records`);
                        results.factData = value;
                        results.locations.factData = fullPath;
                    }
                    
                    // Check for dimensions (object with arrays)
                    if (key === 'dimensions' && value && typeof value === 'object' && !Array.isArray(value)) {
                        const dimKeys = Object.keys(value);
                        if (dimKeys.length > 0) {
                            console.log(`✅ Found dimensions at ${fullPath}: ${dimKeys.join(', ')}`);
                            results.dimensions = value;
                            results.locations.dimensions = fullPath;
                        }
                    }
                    
                    // Check for hierarchies
                    if (key === 'hierarchies' && value && typeof value === 'object') {
                        const hierKeys = Object.keys(value);
                        if (hierKeys.length > 0) {
                            console.log(`✅ Found hierarchies at ${fullPath}: ${hierKeys.join(', ')}`);
                            results.hierarchies = value;
                            results.locations.hierarchies = fullPath;
                        }
                    }
                    
                    // Check for mappings
                    if (key === 'mappings' && value && typeof value === 'object') {
                        const mapKeys = Object.keys(value);
                        if (mapKeys.length > 0) {
                            console.log(`✅ Found mappings at ${fullPath}: ${mapKeys.join(', ')}`);
                            results.mappings = value;
                            results.locations.mappings = fullPath;
                        }
                    }
                    
                    // Look for large arrays that might be factData with different names
                    if (Array.isArray(value) && value.length > 1000) {
                        console.log(`📊 Found large array at ${fullPath}: ${value.length} items`);
                        if (!results.factData) {
                            console.log(`🔄 Using ${fullPath} as potential factData`);
                            results.factData = value;
                            results.locations.factData = fullPath;
                        }
                    }
                    
                    // Recurse into objects
                    if (value && typeof value === 'object' && currentDepth < maxDepth) {
                        searchInObject(value, fullPath, maxDepth, currentDepth + 1);
                    }
                }
            } catch (e) {
                console.warn(`Error searching in ${path}:`, e);
            }
        }
        
        // Search in common locations
        const searchTargets = [
            { obj: window.state, path: 'window.state' },
            { obj: window.stateModule?.state, path: 'window.stateModule.state' },
            { obj: window.applicationState, path: 'window.applicationState' },
            { obj: window.app?.state, path: 'window.app.state' },
            { obj: window.pivotApp?.state, path: 'window.pivotApp.state' },
            { obj: window.BOMApp?.state, path: 'window.BOMApp.state' }
        ];
        
        // Also search direct window properties
        for (let key in window) {
            if (key.toLowerCase().includes('state') || key.toLowerCase().includes('data')) {
                searchTargets.push({ obj: window[key], path: `window.${key}` });
            }
        }
        
        // Search each target
        searchTargets.forEach(target => {
            if (target.obj) {
                console.log(`🔍 Searching in ${target.path}...`);
                searchInObject(target.obj, target.path);
            }
        });
        
        // Also check for global arrays that might be data
        for (let key in window) {
            const value = window[key];
            if (Array.isArray(value) && value.length > 100) {
                console.log(`📊 Found global array window.${key}: ${value.length} items`);
                // Check if it looks like fact data (has typical BOM fields)
                if (value.length > 0 && value[0] && typeof value[0] === 'object') {
                    const sampleKeys = Object.keys(value[0]);
                    const bomFields = ['COST_UNIT', 'QTY_UNIT', 'LE', 'COMPONENT_GMID', 'ZYEAR'];
                    const matchCount = bomFields.filter(field => sampleKeys.includes(field)).length;
                    if (matchCount >= 2) {
                        console.log(`🎯 window.${key} looks like BOM data (${matchCount} matching fields)`);
                        if (!results.factData) {
                            results.factData = value;
                            results.locations.factData = `window.${key}`;
                        }
                    }
                }
            }
        }
        
        console.log('🔍 Search complete. Found:', results.locations);
        return results;
    }
    
    // Memory calculation functions
    function calculateMemoryUsage(obj, visited = new Set()) {
        if (obj === null || obj === undefined) return 0;
        
        const objType = typeof obj;
        if (objType === 'object' && obj !== null) {
            if (visited.has(obj)) return 0;
            visited.add(obj);
        }
        
        let bytes = 0;
        
        try {
            switch (objType) {
                case 'string':
                    bytes = obj.length * 2 + 24;
                    break;
                case 'number':
                    bytes = 8;
                    break;
                case 'boolean':
                    bytes = 4;
                    break;
                case 'object':
                    if (Array.isArray(obj)) {
                        bytes = 32;
                        for (let i = 0; i < obj.length; i++) {
                            bytes += calculateMemoryUsage(obj[i], visited);
                        }
                    } else {
                        bytes = 32;
                        for (let key in obj) {
                            if (obj.hasOwnProperty(key)) {
                                bytes += calculateMemoryUsage(key, visited);
                                bytes += calculateMemoryUsage(obj[key], visited);
                            }
                        }
                    }
                    break;
                default:
                    bytes = 8;
            }
        } catch (e) {
            bytes = 0;
        }
        
        if (objType === 'object' && obj !== null) {
            visited.delete(obj);
        }
        
        return bytes;
    }
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Global data cache
    let cachedData = null;
    let lastSearchTime = 0;
    
    function getCachedOrFindData() {
        const now = Date.now();
        // Re-search every 10 seconds or if no cached data
        if (!cachedData || (now - lastSearchTime) > 10000) {
            cachedData = findApplicationData();
            lastSearchTime = now;
        }
        return cachedData;
    }
    
    function calculateTotalMemory() {
        const data = getCachedOrFindData();
        let total = 0;
        const breakdown = {
            factData: 0,
            dimensions: 0,
            hierarchies: 0,
            mappings: 0
        };
        
        if (data.factData && Array.isArray(data.factData)) {
            breakdown.factData = calculateMemoryUsage(data.factData);
            total += breakdown.factData;
            console.log(`💾 Fact data: ${data.factData.length} records = ${formatBytes(breakdown.factData)}`);
        }
        
        if (data.dimensions && typeof data.dimensions === 'object') {
            breakdown.dimensions = calculateMemoryUsage(data.dimensions);
            total += breakdown.dimensions;
            console.log(`💾 Dimensions: ${formatBytes(breakdown.dimensions)}`);
        }
        
        if (data.hierarchies && typeof data.hierarchies === 'object') {
            breakdown.hierarchies = calculateMemoryUsage(data.hierarchies);
            total += breakdown.hierarchies;
            console.log(`💾 Hierarchies: ${formatBytes(breakdown.hierarchies)}`);
        }
        
        if (data.mappings && typeof data.mappings === 'object') {
            breakdown.mappings = calculateMemoryUsage(data.mappings);
            total += breakdown.mappings;
            console.log(`💾 Mappings: ${formatBytes(breakdown.mappings)}`);
        }
        
        console.log(`💾 Total calculated memory: ${formatBytes(total)}`);
        return { total, breakdown, locations: data.locations };
    }
    
    function createMemoryDisplay() {
        // Remove existing display
        const existing = document.getElementById('smartMemoryMonitor');
        if (existing) existing.remove();
        
        // Find connection actions container
        const connectionActions = document.querySelector('.connection-actions') || 
                                document.querySelector('.database-connection-container .card-body');
        
        if (!connectionActions) {
            console.warn('❌ Could not find connection actions container');
            return null;
        }
        
        // Create container
        const container = document.createElement('div');
        container.id = 'smartMemoryMonitor';
        container.style.cssText = `
            display: flex;
            align-items: center;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            margin-left: auto;
            min-width: 220px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <i class="fas fa-memory" style="color: #2563eb; font-size: 14px;"></i>
                    <span style="font-size: 11px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">LAPTOP MEMORY USAGE</span>
                    <div id="memoryStatus" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-left: auto;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: center; flex: 1;">
                        <div id="memoryTotalValue" style="font-size: 20px; font-weight: 700; font-family: monospace; color: #10b981; line-height: 1;">0 B</div>
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 2px;">TOTAL</div>
                    </div>
                    <div style="margin-left: 12px;">
                        <button id="memoryRefreshBtn" style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center;">
                            <i class="fas fa-sync-alt" style="font-size: 12px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add hover effect
        container.addEventListener('mouseenter', () => {
            container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            container.style.transform = 'translateY(-1px)';
        });
        
        container.addEventListener('mouseleave', () => {
            container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            container.style.transform = 'translateY(0)';
        });
        
        // Add click handler for details
        container.addEventListener('click', showMemoryDetails);
        
        // Add refresh button handler
        const refreshBtn = container.querySelector('#memoryRefreshBtn');
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cachedData = null; // Force refresh
            updateMemoryDisplay();
        });
        
        connectionActions.appendChild(container);
        console.log('✅ Memory display created and attached');
        return container;
    }
    
    function updateMemoryDisplay() {
        const totalElement = document.getElementById('memoryTotalValue');
        const statusElement = document.getElementById('memoryStatus');
        
        if (!totalElement) {
            createMemoryDisplay();
            return;
        }
        
        try {
            const memory = calculateTotalMemory();
            totalElement.textContent = formatBytes(memory.total);
            
            // Update color based on memory usage
            if (memory.total > 100 * 1024 * 1024) { // > 100MB
                totalElement.style.color = '#ef4444'; // red
                statusElement.style.background = '#ef4444';
            } else if (memory.total > 50 * 1024 * 1024) { // > 50MB
                totalElement.style.color = '#f59e0b'; // yellow
                statusElement.style.background = '#f59e0b';
            } else if (memory.total > 0) {
                totalElement.style.color = '#10b981'; // green
                statusElement.style.background = '#10b981';
            } else {
                totalElement.style.color = '#6b7280'; // gray
                statusElement.style.background = '#6b7280';
            }
            
            // Add animation on update
            totalElement.style.transform = 'scale(1.05)';
            setTimeout(() => {
                totalElement.style.transform = 'scale(1)';
            }, 200);
            
        } catch (error) {
            console.error('❌ Error updating memory display:', error);
            totalElement.textContent = 'Error';
            totalElement.style.color = '#ef4444';
        }
    }
    
    function showMemoryDetails() {
        const memory = calculateTotalMemory();
        
        let details = `📊 MEMORY USAGE DETAILS\n\n`;
        details += `Total: ${formatBytes(memory.total)}\n`;
        details += `├ Fact Data: ${formatBytes(memory.breakdown.factData)}\n`;
        details += `├ Dimensions: ${formatBytes(memory.breakdown.dimensions)}\n`;
        details += `├ Hierarchies: ${formatBytes(memory.breakdown.hierarchies)}\n`;
        details += `└ Mappings: ${formatBytes(memory.breakdown.mappings)}\n\n`;
        
        if (memory.locations && Object.keys(memory.locations).length > 0) {
            details += `📍 DATA LOCATIONS:\n`;
            for (let key in memory.locations) {
                details += `├ ${key}: ${memory.locations[key]}\n`;
            }
        }
        
        alert(details);
    }
    
    // Initialize function
    function initialize() {
        console.log('🚀 Smart Memory Monitor initializing...');
        
        // Initial search and display creation
        createMemoryDisplay();
        updateMemoryDisplay();
        
        // Set up periodic updates: 5 minutes
        setInterval(updateMemoryDisplay, 300000);
        
        // Make functions globally available for debugging
        window.findData = findApplicationData;
        window.updateMemoryNow = updateMemoryDisplay;
        window.showMemoryDetails = showMemoryDetails;
        window.clearMemoryCache = () => { cachedData = null; };
        
        console.log('✅ Smart Memory Monitor initialized');
        console.log('🔧 Debug commands: findData(), updateMemoryNow(), showMemoryDetails()');
    }
    
    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 200);
    }
    
})();
   