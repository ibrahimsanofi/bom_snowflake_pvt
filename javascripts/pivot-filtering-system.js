/**
 * EnhancedFilterSystem - Main class for managing all filtering logic
 */
class EnhancedFilterSystem {
  constructor() {
    // Reference to the application state
    // We'll get this lazily to ensure it's available
    this.state = null;
    
    // Track filter selections
    this.filterSelections = {
      legalEntity: new Set(),
      rootGmid: new Set(),
      smartcode: new Set(),
      costElement: new Set(),
      businessYear: new Set(),
      itemCostType: new Set(),
      materialType: new Set(),
      managementCentre: new Set()
    };
    
    // Track expanded states for hierarchical filters
    this.expandedFilterNodes = {
      legalEntity: {},
      costElement: {},
      managementCentre: {}
    };
    
    // Track dropdown open states
    this.openDropdowns = {};
    
    // Element references
    this.elements = {
      filterContent: document.getElementById('filterContent'),
      filterComponentsContainer: null,
      filteredRecordsCount: document.getElementById('filteredRecordsCount'),
      applyFiltersBtn: null
    };
    
    // Filter metadata for each dimension
    this.filterMeta = {
      legalEntity: {
        id: 'legalEntity',
        label: 'Legal Entity',
        dimensionKey: 'le',
        factField: 'LE',
        hierarchical: false, // CHANGED: Treat as simple filter for now
        valueField: 'LE',
        displayField: 'LE_DESC'
      },
      rootGmid: {
        id: 'rootGmid',
        label: 'Root GMID',
        dimensionKey: 'root_gmid_display',
        factField: 'ROOT_GMID',
        hierarchical: false, // CHANGED: Treat as simple filter for now
        valueField: 'ROOT_GMID',
        displayField: 'ROOT_DISPLAY'
      },
      smartcode: {
        id: 'smartcode',
        label: 'Smartcode',
        dimensionKey: 'smartcode',
        factField: 'ROOT_SMARTCODE',
        hierarchical: false,
        valueField: 'SMARTCODE',
        displayField: 'SMARTCODE_DESC'
      },
      costElement: {
        id: 'costElement',
        label: 'Cost Element',
        dimensionKey: 'cost_element',
        factField: 'COST_ELEMENT',
        hierarchical: false, // CHANGED: Treat as simple filter for now
        valueField: 'COST_ELEMENT',
        displayField: 'COST_ELEMENT_DESC'
      },
      businessYear: {
        id: 'businessYear',
        label: 'Business Year',
        dimensionKey: 'year',
        factField: 'ZYEAR',
        hierarchical: false,
        valueField: 'YEAR',
        displayField: 'YEAR'
      },
      itemCostType: {
        id: 'itemCostType',
        label: 'Item Cost Type',
        dimensionKey: 'item_cost_type',
        factField: 'ITEM_COST_TYPE',
        hierarchical: false,
        valueField: 'ITEM_COST_TYPE',
        displayField: 'ITEM_COST_TYPE_DESC'
      },
      materialType: {
        id: 'materialType',
        label: 'Material Type',
        dimensionKey: 'material_type',
        factField: 'COMPONENT_MATERIAL_TYPE',
        hierarchical: false,
        valueField: 'MATERIAL_TYPE',
        displayField: 'MATERIAL_TYPE_DESC'
      },
      managementCentre: {
        id: 'managementCentre',
        label: 'MGT Centre',
        dimensionKey: 'mc',
        factField: 'MC',
        hierarchical: false, // CHANGED: Treat as simple filter for now
        valueField: 'MC',
        displayField: 'LE_DESC'
      }
    };

    
    // Performance tracking
    this.perfTracking = {
      lastFilterTime: 0,
      recordsBeforeFilter: 0,
      recordsAfterFilter: 0
    };
  }

  
  /**
   * Initialize the filter system
   */
  initialize() {
    console.log('✅ Status: Initializing Enhanced Filter System with field-specific data...');
    
    if (!this.state) {
      console.log('✅ Status: No state reference, cannot initialize filters');
      return false;
    }
    
    // CHANGED: Check for dimensionFilters instead of dimensions
    if (!this.state.dimensionFilters) {
      console.log('✅ Status: Dimension filter data not loaded yet, cannot initialize filters');
      return false;
    }
    
    this.createFilterComponents();
    this.setupFilterEvents();
    this.setupApplyButton();
    this.populateFiltersFromFieldData(); // CHANGED: Use new population method
    
    console.log('✅ Status: Enhanced Filter System initialized successfully with field-specific data');
    return true;
  }


   /**
   * ENHANCED: Populate all filter components with field-specific dimension data
   */
  populateFiltersFromFieldData() {
    console.log('✅ Status: Populating filter components with field-specific data...');
    
    if (!this.state) {
      this.state = window.App ? window.App.state : window.appState;
      
      if (!this.state) {
        console.log('⏳ Status: State not yet available, waiting...');
        setTimeout(() => this.populateFiltersFromFieldData(), 500);
        return;
      }
    }
    
    if (!this.state.dimensionFilters) {
      console.log('⏳ Status: Waiting for DIMENSION FILTER data to be loaded...');
      setTimeout(() => this.populateFiltersFromFieldData(), 500);
      return;
    }
    
    // Populate each filter using field-specific data
    Object.values(this.filterMeta).forEach(dimension => {
      this.populateSimpleFilterFromFieldData(dimension);
    });
    
    this.updateAllSelectionCounts();
  }


   /**
   * ENHANCED: Populate a filter with field-specific dimension data
   * @param {Object} dimension - Dimension configuration
   */
   populateSimpleFilterFromFieldData(dimension) {
    console.log(`⏳ Status: Populating filter for ${dimension.label} with field-specific data...`);
    
    const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
    if (!checkboxList) {
      console.warn(`Checkbox list for ${dimension.id} not found`);
      return;
    }
    
    checkboxList.innerHTML = '';
    
    // ENHANCED: Get filter options from field-specific data
    const uniqueValues = this.getUniqueValuesFromFieldData(dimension);
    
    if (uniqueValues.length === 0) {
      checkboxList.innerHTML = `<div class="no-values-message">No values available for ${dimension.label}</div>`;
      return;
    }
    
    // Sort values alphabetically by label
    uniqueValues.sort((a, b) => {
      return a.label.toString().toLowerCase().localeCompare(b.label.toString().toLowerCase());
    });
    
    // CHANGED: Initialize filter selections to contain ALL values (making them all unselected)
    this.filterSelections[dimension.id] = new Set(uniqueValues.map(item => item.value));
    
    // Create checkbox for each value
    uniqueValues.forEach(item => {
      const checkboxOption = document.createElement('div');
      checkboxOption.className = 'checkbox-option';
      
      const safeId = (item.value || '').toString().replace(/[^a-zA-Z0-9]/g, '_');
      
      // CHANGED: Set checkboxes to unchecked by default
      checkboxOption.innerHTML = `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; overflow: hidden;">
          <input type="checkbox" id="${dimension.id}_${safeId}" value="${item.value}">
          <span style="white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
            ${item.label}
          </span>
        </label>
      `;
      
      const checkbox = checkboxOption.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        this.handleSimpleFilterCheckboxChange(dimension, item.value, e.target.checked);
      });
      
      checkboxList.appendChild(checkboxOption);
    });
    
    console.log(`✅ Status: Populated ${dimension.label} filter with ${uniqueValues.length} options (all unselected by default)`);
  }


   /**
   * ENHANCED: Get unique values for a dimension from field-specific data
   * @param {Object} dimension - Dimension configuration
   * @returns {Array} - Array of unique values with label and value properties
   */
  getUniqueValuesFromFieldData(dimension) {
    const dimensionFilter = this.state.dimensionFilters[dimension.dimensionKey];
    
    if (!dimensionFilter || !dimensionFilter.data) {
      console.warn(`No field data available for dimension: ${dimension.dimensionKey}`);
      return [];
    }
    
    const { data, config } = dimensionFilter;
    const valueMap = new Map();
    
    // Process dimension data to extract unique values
    data.forEach(item => {
      if (item && item[dimension.valueField] !== undefined && item[dimension.valueField] !== null) {
        const value = item[dimension.valueField];
        const label = item[dimension.displayField] || value;
        
        // Use Map to automatically handle duplicates
        if (!valueMap.has(value)) {
          valueMap.set(value, {
            value: value,
            label: label,
            id: value
          });
        }
      }
    });
    
    // Convert Map to Array
    const result = Array.from(valueMap.values());
    
    console.log(`✅ Status: Found ${result.length} unique values for ${dimension.label}`);
    return result;
  }

  
  /**
   * Initialize storage for original hierarchies to support filtering
   */
  initializeHierarchyFilters() {
    console.log("✅ Status: Initializing hierarchical dimension filtering...");
    
    this.state._originalHierarchies = this.state._originalHierarchies || {};
    
    if (this.state.hierarchies) {
      const hierarchyKeys = ['le', 'gmid_display', 'root_gmid_display', 'item_cost_type', 'material_type', 'year', 'mc', 'smartcode', 'cost_element'];
      
      hierarchyKeys.forEach(key => {
        if (this.state.hierarchies[key] && !this.state._originalHierarchies[key]) {
          this.state._originalHierarchies[key] = this.state.hierarchies[key];
        }
      });
    }
    
    console.log("✅ Status: Hierarchical dimension filtering initialized");
  }

  
  /**
   * Create filter components container structure
   */
  createFilterComponents() {
    const filterContent = this.elements.filterContent;
    if (!filterContent) {
      console.error("❌ Alert! Filter content container not found");
      return;
    }
    
    filterContent.innerHTML = '';
    
    // Create filter components container
    const filterComponentsContainer = document.createElement('div');
    filterComponentsContainer.id = 'filterComponentsContainer';
    filterComponentsContainer.className = 'filter-components-container';
    filterComponentsContainer.style.display = 'grid';
    filterComponentsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    filterComponentsContainer.style.gap = '16px';
    filterComponentsContainer.style.marginBottom = '10px';
    filterContent.appendChild(filterComponentsContainer);
    
    this.elements.filterComponentsContainer = filterComponentsContainer;
    
    // Create each dimension filter (all as simple filters for now)
    Object.values(this.filterMeta).forEach(dimension => {
      this.createFilterComponent(filterComponentsContainer, dimension);
    });
    
    // Add Apply Filters button
    const applyButtonContainer = document.createElement('div');
    applyButtonContainer.className = 'apply-filters-container';
    applyButtonContainer.style.display = 'flex';
    applyButtonContainer.style.justifyContent = 'flex-end';
    applyButtonContainer.style.marginTop = '20px';
    
    const applyButton = document.createElement('button');
    applyButton.id = 'applyFiltersBtn';
    applyButton.className = 'apply-filters-btn';
    applyButton.innerHTML = '<i class="fas fa-check"></i> Apply Filters';
    applyButton.style.display = 'inline-flex';
    applyButton.style.alignItems = 'center';
    applyButton.style.gap = '8px';
    applyButton.style.padding = '8px 16px';
    applyButton.style.backgroundColor = '#2563eb';
    applyButton.style.color = 'white';
    applyButton.style.border = 'none';
    applyButton.style.borderRadius = '0.25rem';
    applyButton.style.fontWeight = '500';
    applyButton.style.cursor = 'pointer';
    
    applyButtonContainer.appendChild(applyButton);
    filterContent.appendChild(applyButtonContainer);
    
    this.elements.applyFiltersBtn = applyButton;
    this.createDataVolumeIndicator(filterContent);
  }

  
  /**
   * Create a data volume indicator to show filtered records count
   */
  createDataVolumeIndicator(container) {
    const dataVolumeContainer = document.createElement('div');
    dataVolumeContainer.className = 'data-volume-indicator';
    dataVolumeContainer.id = 'dataVolumeIndicator';
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'data-volume-progress';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = '100%';
    progressBar.style.backgroundColor = '#2563eb';
    
    const dataText = document.createElement('div');
    dataText.className = 'data-volume-text';
    dataText.id = 'dataVolumeText';
    dataText.textContent = 'Ready to load data based on filter selection';
    
    progressContainer.appendChild(progressBar);
    dataVolumeContainer.appendChild(progressContainer);
    dataVolumeContainer.appendChild(dataText);
    
    container.appendChild(dataVolumeContainer);
  }

  
  /**
   * Creates a single filter component for a dimension
   * @param {HTMLElement} container - Container to append the filter to
   * @param {Object} dimension - Dimension configuration object
   */
   createFilterComponent(container, dimension) {
    const filterComponent = document.createElement('div');
    filterComponent.className = 'filter-component';
    filterComponent.id = `${dimension.id}FilterComponent`;
    filterComponent.style.marginBottom = '16px';
    
    // Create header
    const filterHeader = document.createElement('div');
    filterHeader.className = 'filter-component-header';
    filterHeader.style.display = 'flex';
    filterHeader.style.justifyContent = 'space-between';
    filterHeader.style.alignItems = 'center';
    filterHeader.style.marginBottom = '8px';
    
    filterHeader.innerHTML = `
      <span class="filter-component-label" style="font-weight: 600; color: #1e293b;">${dimension.label}</span>
      <span class="selection-count" id="${dimension.id}SelectionCount" 
            style="font-size: 0.75rem; color: #64748b; background-color: #f8fafc; 
                   padding: 2px 6px; border-radius: 10px;"></span>
    `;
    
    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'multiselect-dropdown';
    dropdownContainer.id = `${dimension.id}Dropdown`;
    dropdownContainer.style.position = 'relative';
    dropdownContainer.style.width = '100%';
    
    // Create dropdown button
    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'multiselect-button';
    dropdownButton.style.display = 'flex';
    dropdownButton.style.alignItems = 'center';
    dropdownButton.style.justifyContent = 'space-between';
    dropdownButton.style.width = '100%';
    dropdownButton.style.padding = '8px 12px';
    dropdownButton.style.backgroundColor = 'white';
    dropdownButton.style.border = '1px solid #cbd5e1';
    dropdownButton.style.borderRadius = '0.25rem';
    dropdownButton.style.cursor = 'pointer';
    dropdownButton.style.fontSize = '0.875rem';
    
    dropdownButton.innerHTML = `
      <span class="selection-text">All ${dimension.label}s</span>
      <i class="fas fa-chevron-down"></i>
    `;
    
    // Create dropdown content
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'multiselect-dropdown-content';
    dropdownContent.style.display = 'none';
    dropdownContent.style.position = 'absolute';
    dropdownContent.style.top = '100%';
    dropdownContent.style.left = '0';
    dropdownContent.style.width = '350px';
    dropdownContent.style.maxWidth = '90vw';
    dropdownContent.style.backgroundColor = 'white';
    dropdownContent.style.border = '1px solid #cbd5e1';
    dropdownContent.style.borderRadius = '0.25rem';
    dropdownContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    dropdownContent.style.zIndex = '9999';
    dropdownContent.style.marginTop = '4px';
    
    // Add search container
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.style.padding = '8px';
    searchContainer.style.borderBottom = '1px solid #e2e8f0';
    searchContainer.innerHTML = `
      <input type="text" placeholder="Search ${dimension.label}s..." class="search-input" id="${dimension.id}Search"
          style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 0.125rem;">
    `;
    
    // Add select actions
    const selectActions = document.createElement('div');
    selectActions.className = 'select-actions';
    selectActions.style.display = 'flex';
    selectActions.style.gap = '8px';
    selectActions.style.padding = '8px';
    selectActions.style.borderBottom = '1px solid #e2e8f0';
    selectActions.innerHTML = `
      <button id="${dimension.id}SelectAll" class="select-all-btn" 
              style="flex: 1; padding: 4px 8px; font-size: 0.75rem; border: 1px solid #e2e8f0; 
                  border-radius: 0.125rem; background-color: #f8fafc; cursor: pointer;">
      Select All
      </button>
      <button id="${dimension.id}ClearAll" class="clear-all-btn"
              style="flex: 1; padding: 4px 8px; font-size: 0.75rem; border: 1px solid #e2e8f0; 
                  border-radius: 0.125rem; background-color: #f8fafc; cursor: pointer;">
      Clear All
      </button>
    `;
    
    // Add checkbox container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    checkboxContainer.style.maxHeight = '50vh';
    checkboxContainer.style.overflowY = 'auto';
    checkboxContainer.style.padding = '8px';
    checkboxContainer.style.width = '100%';
    
    // Always create simple checkbox list (no hierarchical for now)
    const checkboxList = document.createElement('div');
    checkboxList.className = 'checkbox-list';
    checkboxList.id = `${dimension.id}CheckboxList`;
    checkboxList.innerHTML = `
      <div class="checkbox-option" style="padding: 6px 0;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; overflow: hidden;">
          <input type="checkbox" disabled>
          <span style="white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
            Loading options...
          </span>
        </label>
      </div>
    `;
    checkboxContainer.appendChild(checkboxList);
    
    // Assemble dropdown
    dropdownContent.appendChild(searchContainer);
    dropdownContent.appendChild(selectActions);
    dropdownContent.appendChild(checkboxContainer);
    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(dropdownContent);
    
    // Assemble component
    filterComponent.appendChild(filterHeader);
    filterComponent.appendChild(dropdownContainer);
    container.appendChild(filterComponent);
    
    // Immediately update selection count
    this.updateSelectionCount(dimension);
  }


  /**
   * Setup event handlers for all filter components
   */
  setupFilterEvents() {
    Object.values(this.filterMeta).forEach(dimension => {
      this.setupFilterComponentEvents(dimension);
    });
    
    // Global click handler to close dropdowns
    document.addEventListener('click', () => {
      Object.keys(this.openDropdowns).forEach(id => {
        if (this.openDropdowns[id]) {
          const dropdownContent = document.querySelector(`#${id}Dropdown .multiselect-dropdown-content`);
          if (dropdownContent) {
            dropdownContent.style.display = 'none';
            this.openDropdowns[id] = false;
          }
        }
      });
    });
  }
  

  /**
   * Setup events for a specific filter component
   * @param {Object} dimension - Dimension configuration
   */
  setupFilterComponentEvents(dimension) {
    const dimensionId = dimension.id;
    const dropdownContainer = document.getElementById(`${dimensionId}Dropdown`);
    
    if (!dropdownContainer) {
      console.warn(`Dropdown container for ${dimensionId} not found`);
      return;
    }
    
    const dropdownButton = dropdownContainer.querySelector('.multiselect-button');
    const dropdownContent = dropdownContainer.querySelector('.multiselect-dropdown-content');
    const searchInput = dropdownContainer.querySelector('.search-input');
    const selectAllBtn = document.getElementById(`${dimensionId}SelectAll`);
    const clearAllBtn = document.getElementById(`${dimensionId}ClearAll`);
    
    this.openDropdowns[dimensionId] = false;
    
    // Toggle dropdown
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Close other dropdowns
      Object.keys(this.openDropdowns).forEach(id => {
        if (id !== dimensionId && this.openDropdowns[id]) {
          const otherContent = document.querySelector(`#${id}Dropdown .multiselect-dropdown-content`);
          if (otherContent) {
            otherContent.style.display = 'none';
            this.openDropdowns[id] = false;
          }
        }
      });
      
      // Toggle this dropdown
      const isOpen = dropdownContent.style.display !== 'none';
      dropdownContent.style.display = isOpen ? 'none' : 'block';
      this.openDropdowns[dimensionId] = !isOpen;
      
      if (!isOpen) {
        // Position dropdown
        const buttonRect = dropdownButton.getBoundingClientRect();
        dropdownContent.style.position = 'fixed';
        dropdownContent.style.top = (buttonRect.bottom + 5) + 'px';
        dropdownContent.style.left = buttonRect.left + 'px';
        
        // Ensure it doesn't go off-screen
        const windowWidth = window.innerWidth;
        if (buttonRect.left + 300 > windowWidth) {
          dropdownContent.style.left = (windowWidth - 310) + 'px';
        }
        
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 100);
        }
      }
    });
    
    // Prevent dropdown from closing when clicking inside
    dropdownContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Search functionality
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleFilterSearch(dimension, e.target.value);
      });
    }
    
    // Select all functionality
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.selectAllInFilter(dimension);
      });
    }
    
    // Clear all functionality
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.clearAllInFilter(dimension);
      });
    }
  }
  

  /**
   * Setup apply button event handler
   */
  setupApplyButton() {
    const applyBtn = this.elements.applyFiltersBtn;
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applyAllFilters();
      });
    }
  }
  

  /**
   * Update selection counts for all filter dimensions
   */
  updateAllSelectionCounts() {
    Object.values(this.filterMeta).forEach(dimension => {
      this.updateSelectionCount(dimension);
    });
  }


  /**
   * Populate all filter components with data from dimensions
   */
  populateFilters() {
    console.log('✅ Status: Populating filter components with data...');
    
    if (!this.state) {
      this.state = window.App ? window.App.state : window.appState;
      
      if (!this.state) {
        console.log('⏳ Status: State not yet available, waiting...');
        setTimeout(() => this.populateFilters(), 500);
        return;
      }
    }
    
    if (!this.state.dimensions) {
      console.log('⏳ Status: Waiting for DIMENSION data to be loaded...');
      setTimeout(() => this.populateFilters(), 500);
      return;
    }
    
    // Populate each filter
    Object.values(this.filterMeta).forEach(dimension => {
      if (dimension.hierarchical) {
        this.populateHierarchicalFilter(dimension);
      } else {
        this.populateSimpleFilter(dimension);
      }
    });
    
    this.updateAllSelectionCounts();
  }
  

  /**
   * Populate a hierarchical filter with data from the corresponding hierarchy
   * @param {Object} dimension - Dimension configuration
   */
  populateHierarchicalFilter(dimension) {
    console.log(`⏳ Status: Populating hierarchical filter for ${dimension.label}...`);
    
    const treeContainer = document.getElementById(`${dimension.id}TreeContainer`);
    if (!treeContainer) {
      console.warn(`Tree container for ${dimension.id} not found`);
      return;
    }
    
    const hierarchy = this.state.hierarchies[dimension.dimensionKey];
    if (!hierarchy || !hierarchy.root) {
      treeContainer.innerHTML = `<div class="empty-tree-message">No hierarchy data available</div>`;
      return;
    }
    
    treeContainer.innerHTML = '';
    
    const treeNodes = document.createElement('div');
    treeNodes.className = 'filter-tree-nodes';
    treeContainer.appendChild(treeNodes);
    
    this.renderHierarchyNode(treeNodes, hierarchy.root, dimension, 0);
  }

  
  /**
   * Build a helper method for flat hierarchy building
   * @param {Array} data - The dimension data
   * @param {Object} root - The root node
   * @param {Object} nodesMap - Map to store nodes by ID
   * @param {String} idField - Field to use for ID
   * @param {String} labelField - Field to use for label
   */
  buildFlatHierarchy(data, root, nodesMap, idField, labelField) {
    console.log(`⏳ Status: Building flat hierarchy for ${root.hierarchyName} using ${idField} and ${labelField}`);
    
    const valueMap = new Map();
    
    // Collect unique values with descriptions
    data.forEach(item => {
      if (item && item[idField]) {
        const description = item[labelField] || item[idField];
        valueMap.set(item[idField], description);
      }
    });
    
    // console.log(`✅ Status: Found ${valueMap.size} unique values for flat hierarchy`);
    
    // Create nodes for each value
    valueMap.forEach((description, code) => {
      const nodeId = `${root.hierarchyName.toUpperCase()}_${code}`.replace(/[^a-zA-Z0-9_]/g, '_');
      
      const node = {
        id: nodeId,
        label: description,
        children: [],
        level: 1,
        expanded: false,
        isLeaf: true,
        hasChildren: false,
        path: [root.id, nodeId],
        factId: code,
        hierarchyName: root.hierarchyName
      };
      
      // Add to maps
      nodesMap[nodeId] = node;
      
      // Add as child to root
      root.children.push(node);
      root.hasChildren = true;
    });
    
    // Sort children alphabetically
    root.children.sort((a, b) => {
      const aLabel = a.label;
      const bLabel = b.label;
      return aLabel.localeCompare(bLabel);
    });
    
    console.log(`✅ Status: Built flat hierarchy with ${root.children.length} children of root`);
  }


  /**
   * Handle empty filter result case
   * @param {Object} dimension - The dimension that caused the empty result
   */
  handleEmptyFilterResult(dimension) {
    console.log(`⏳ Status: Filter on ${dimension.label} resulted in NO matching records`);
    
    // Set flag to indicate empty result
    this.state._emptyFilterResult = true;
    
    // Store which dimension caused the empty result
    this.state._emptyFilterDimension = dimension.id;
    
    // Create empty hierarchies for all dimensions
    Object.values(this.filterMeta).forEach(dim => {
      if (dim.hierarchical) {
        this.createEmptyHierarchy(dim);
      }
    });
    
    // Update UI to show empty state
    this.updateDataVolumeIndicator(this.perfTracking.recordsBeforeFilter, 0);
    this.updateFilteredRecordsCount(0);
    
    // Show a message to the user
    const messageEl = document.createElement('div');
    messageEl.className = 'empty-result-message';
    messageEl.innerHTML = `<strong>No records match the selected filters.</strong><br>
      The ${dimension.label} filter resulted in zero matching records.<br>
      Try adjusting your filter selections.`;
    
    // Clear any existing messages
    const existingMsg = document.querySelector('.empty-result-message');
    if (existingMsg) {
      existingMsg.remove();
    }
    
    // Add message to the page
    const pivotContainer = document.getElementById('pivotTableContainer');
    if (pivotContainer) {
      pivotContainer.appendChild(messageEl);
    }
  }


  /**
   * Create an empty hierarchy for a dimension
   * @param {Object} dimension - The dimension configuration
   */
  createEmptyHierarchy(dimension) {
  const dimName = dimension.dimensionKey;
  
  // If original hierarchy doesn't exist, we can't do anything
  if (!this.state.hierarchies[dimName]) return;
  
  // Create an empty hierarchy with just a root node
  const emptyHierarchy = {
    root: {
      id: `${dimName.toUpperCase()}_ROOT`,
      label: `All ${dimension.label}s (No matching records)`,
      children: [],
      level: 0,
      expanded: true,
      isLeaf: true,
      hasChildren: false,
      path: [`${dimName.toUpperCase()}_ROOT`],
      hierarchyName: dimName
    },
    nodesMap: { [`${dimName.toUpperCase()}_ROOT`]: this.state.hierarchies[dimName].root },
    flatData: []
  };
  
  // Store the empty hierarchy
  this.state.hierarchies[dimName] = emptyHierarchy;
}

  
  /**
   * Recursively render a hierarchy node and its children
   * @param {HTMLElement} container - Container element
   * @param {Object} node - Hierarchy node
   * @param {Object} dimension - Dimension configuration
   * @param {number} level - Current nesting level
   */
  renderHierarchyNode(container, node, dimension, level) {
    if (!node) return;
    
    const nodeContainer = document.createElement('div');
    nodeContainer.className = 'filter-tree-node';
    nodeContainer.dataset.nodeId = node.id;
    nodeContainer.dataset.level = level;
    
    const nodeItem = document.createElement('div');
    nodeItem.className = 'filter-tree-item';
    nodeItem.style.marginLeft = `${level * 16}px`;
    
    const hasChildren = node.children && node.children.length > 0;
    
    // Create expand/collapse control
    let expandControl = null;
    if (hasChildren) {
      expandControl = document.createElement('span');
      expandControl.className = `expand-collapse ${this.expandedFilterNodes[dimension.id][node.id] ? 'expanded' : 'collapsed'}`;
      expandControl.innerHTML = this.expandedFilterNodes[dimension.id][node.id] ? '▼' : '▶';
      expandControl.style.cursor = 'pointer';
      expandControl.style.marginRight = '4px';
      
      expandControl.addEventListener('click', () => {
        this.toggleFilterNodeExpansion(dimension, node, nodeContainer);
      });
    } else {
      expandControl = document.createElement('span');
      expandControl.className = 'leaf-node';
      expandControl.innerHTML = '&nbsp;&nbsp;';
      expandControl.style.marginRight = '4px';
    }
    
    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${dimension.id}_node_${node.id}`;
    checkbox.checked = !this.filterSelections[dimension.id].has(node.id);
    checkbox.style.marginRight = '8px';
    
    checkbox.addEventListener('change', (e) => {
      this.handleFilterNodeCheckboxChange(dimension, node, e.target.checked);
    });
    
    // Create label
    const label = document.createElement('label');
    label.className = 'filter-tree-label';
    label.htmlFor = checkbox.id;
    label.textContent = node.label || node.id;
    label.style.cursor = 'pointer';
    
    // Assemble node item
    nodeItem.appendChild(expandControl);
    nodeItem.appendChild(checkbox);
    nodeItem.appendChild(label);
    nodeContainer.appendChild(nodeItem);
    
    // Create children container if needed
    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'filter-tree-children';
      childrenContainer.style.display = this.expandedFilterNodes[dimension.id][node.id] ? 'block' : 'none';
      
      // Render children
      node.children.forEach(childId => {
        const childNode = typeof childId === 'string' ? 
          this.state.hierarchies[dimension.dimensionKey].nodesMap[childId] : childId;
        
        if (childNode) {
          this.renderHierarchyNode(childrenContainer, childNode, dimension, level + 1);
        }
      });
      
      nodeContainer.appendChild(childrenContainer);
    }
    
    container.appendChild(nodeContainer);
  }
  

  /**
   * Toggle expansion of a hierarchical filter node
   * @param {Object} dimension - Dimension configuration
   * @param {Object} node - Hierarchy node
   * @param {HTMLElement} nodeContainer - Node container element
   */
  toggleFilterNodeExpansion(dimension, node, nodeContainer) {
    const expanded = !this.expandedFilterNodes[dimension.id][node.id];
    this.expandedFilterNodes[dimension.id][node.id] = expanded;
    
    // Update UI
    const expandControl = nodeContainer.querySelector('.expand-collapse');
    if (expandControl) {
      expandControl.innerHTML = expanded ? '▼' : '▶';
    }
    
    // Show/hide children
    const childrenContainer = nodeContainer.querySelector('.filter-tree-children');
    if (childrenContainer) {
      childrenContainer.style.display = expanded ? 'block' : 'none';
    }
  }
  

  /**
   * Handle checkbox change in hierarchical filter
   * @param {Object} dimension - Dimension configuration
   * @param {Object} node - Hierarchy node
   * @param {boolean} checked - New checkbox state
   */
  handleFilterNodeCheckboxChange(dimension, node, checked) {
    if (!node) return;
    
    if (checked) {
      this.filterSelections[dimension.id].delete(node.id);
    } else {
      this.filterSelections[dimension.id].add(node.id);
    }
    
    // Update child checkboxes if any
    if (node.children && node.children.length > 0) {
      const nodeContainer = document.querySelector(`.filter-tree-node[data-node-id="${node.id}"]`);
      if (nodeContainer) {
        const childCheckboxes = nodeContainer.querySelectorAll('.filter-tree-children input[type="checkbox"]');
        childCheckboxes.forEach(checkbox => {
          checkbox.checked = checked;
          
          const checkboxId = checkbox.id;
          const nodeId = checkboxId.replace(`${dimension.id}_node_`, '');
          
          if (checked) {
            this.filterSelections[dimension.id].delete(nodeId);
          } else {
            this.filterSelections[dimension.id].add(nodeId);
          }
        });
      }
    }
    
    this.updateSelectionCount(dimension);
  }
  

  /**
   * Collect all node IDs from a hierarchy
   * @param {Object} node - Starting node
   * @param {Object} dimension - Dimension configuration
   * @returns {Set} - Set of all node IDs
   */
  collectAllNodeIds(node, dimension) {
    const ids = new Set();
    
    // Add current node
    ids.add(node.id);
    
    // Add children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        const childNode = typeof childId === 'string' ? 
          this.state.hierarchies[dimension.dimensionKey].nodesMap[childId] : childId;
        
        if (childNode) {
          const childIds = this.collectAllNodeIds(childNode, dimension);
          childIds.forEach(id => ids.add(id));
        }
      });
    }
    
    return ids;
  }
  

  /**
   * Populate a simple (non-hierarchical) filter with unique values
   * @param {Object} dimension - Dimension configuration
   */
  populateSimpleFilter(dimension) {
    console.log(`⏳ Status: Populating simple filter for ${dimension.label}...`);
    
    const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
    if (!checkboxList) {
      console.warn(`Checkbox list for ${dimension.id} not found`);
      return;
    }
    
    checkboxList.innerHTML = '';
    
    const uniqueValues = this.getUniqueValuesForDimension(dimension);
    
    if (uniqueValues.length === 0) {
      checkboxList.innerHTML = `<div class="no-values-message">No values available</div>`;
      return;
    }
    
    uniqueValues.sort((a, b) => {
      return a.label.toString().toLowerCase().localeCompare(b.label.toString().toLowerCase());
    });
    
    uniqueValues.forEach(item => {
      const checkboxOption = document.createElement('div');
      checkboxOption.className = 'checkbox-option';
      
      const safeId = (item.id || item.value).toString().replace(/[^a-zA-Z0-9]/g, '_');
      
      checkboxOption.innerHTML = `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; overflow: hidden;">
          <input type="checkbox" id="${dimension.id}_${safeId}" value="${item.value}" checked>
          <span style="white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
            ${item.label}
          </span>
        </label>
      `;
      
      const checkbox = checkboxOption.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        this.handleSimpleFilterCheckboxChange(dimension, item.value, e.target.checked);
      });
      
      checkboxList.appendChild(checkboxOption);
    });
    
    this.filterSelections[dimension.id] = new Set();
  }

  
  /**
   * Get unique values for a dimension
   * @param {Object} dimension - Dimension configuration
   * @returns {Array} - Array of unique values with label and value properties
   */
  getUniqueValuesForDimension(dimension) {
    const valueSet = new Set();
    const labelMap = new Map();
    const result = [];
    
    switch (dimension.id) {
      case 'rootGmid':
        if (this.state.dimensions.gmid_display) {
          this.state.dimensions.gmid_display.forEach(item => {
            if (item.ROOT_GMID && !valueSet.has(item.ROOT_GMID)) {
              valueSet.add(item.ROOT_GMID);
              labelMap.set(item.ROOT_GMID, item.ROOT_DISPLAY || item.ROOT_GMID);
            }
          });
        }
        break;
        
      case 'smartcode':
        if (this.state.dimensions.smartcode) {
          this.state.dimensions.smartcode.forEach(item => {
            if (item.SMARTCODE && !valueSet.has(item.SMARTCODE)) {
              valueSet.add(item.SMARTCODE);
              labelMap.set(item.SMARTCODE, item.SMARTCODE);
            }
          });
        }
        break;
        
      case 'businessYear':
        if (this.state.dimensions.year) {
          this.state.dimensions.year.forEach(item => {
            if (item.YEAR && !valueSet.has(item.YEAR)) {
              valueSet.add(item.YEAR);
              labelMap.set(item.YEAR, item.YEAR.toString());
            }
          });
        }
        break;
        
      case 'itemCostType':
        if (this.state.dimensions.item_cost_type) {
          this.state.dimensions.item_cost_type.forEach(item => {
            if (item.ITEM_COST_TYPE && !valueSet.has(item.ITEM_COST_TYPE)) {
              valueSet.add(item.ITEM_COST_TYPE);
              labelMap.set(item.ITEM_COST_TYPE, item.ITEM_COST_TYPE_DESC || item.ITEM_COST_TYPE);
            }
          });
        }
        break;
        
      case 'materialType':
        if (this.state.dimensions.material_type) {
          this.state.dimensions.material_type.forEach(item => {
            if (item.MATERIAL_TYPE && !valueSet.has(item.MATERIAL_TYPE)) {
              valueSet.add(item.MATERIAL_TYPE);
              labelMap.set(item.MATERIAL_TYPE, item.MATERIAL_TYPE_DESC || item.MATERIAL_TYPE);
            }
          });
        }
        break;
        
      default:
        console.warn(`No implementation for dimension: ${dimension.id}`);
        break;
    }
    
    // Convert to array format
    valueSet.forEach(value => {
      result.push({
        value: value,
        id: value,
        label: labelMap.get(value) || value.toString()
      });
    });
    
    return result;
  }
  

  /**
   * Handle checkbox change in simple filter
   * @param {Object} dimension - Dimension configuration
   * @param {string} value - Value of the checkbox
   * @param {boolean} checked - New checkbox state
   */
  handleSimpleFilterCheckboxChange(dimension, value, checked) {
    if (checked) {
      this.filterSelections[dimension.id].delete(value);
    } else {
      this.filterSelections[dimension.id].add(value);
    }
    
    this.updateSelectionCount(dimension);
  }

  
  /**
   * Update the selection count display for a filter
   * @param {Object} dimension - Dimension configuration
   */
  updateSelectionCount(dimension) {
    const countElement = document.getElementById(`${dimension.id}SelectionCount`);
    if (!countElement) return;

    let selectedCount = 0;
    let totalCount = 0;

    const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);

    if (checkboxList) {
      const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
      totalCount = checkboxes.length;
      selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    }

    countElement.textContent = `${selectedCount} / ${totalCount}`;

    const selectionText = document.querySelector(`#${dimension.id}Dropdown .selection-text`);
    
    if (selectionText) {
      // CHANGED: Updated text logic for unselected-by-default behavior
      if (selectedCount === 0) {
        selectionText.textContent = `No ${dimension.label}s selected`;
      } else if (selectedCount === totalCount) {
        selectionText.textContent = `All ${dimension.label}s selected`;
      } else {
        selectionText.textContent = `${selectedCount} selected`;
      }
    }
  }
  

  /**
   * Update the "Select All" checkbox state based on current selections
   * @param {Object} dimension - Dimension configuration
   */
  updateSelectAllCheckbox(dimension) {
    const selectAllCheckbox = document.getElementById(`${dimension.id}SelectAllCheckbox`);
    if (!selectAllCheckbox) return;
    
    // Determine if all items are selected
    const allSelected = this.filterSelections[dimension.id].size === 0;
    
    // Update checkbox without triggering change event
    selectAllCheckbox.checked = allSelected;
  }
  

  /**
   * Count total nodes in a hierarchy
   * @param {Object} node - Starting node
   * @returns {number} - Total number of nodes
   */
  countTotalNodes(node) {
    if (!node) return 0;
    
    let count = 1; // Count this node
    
    // Count children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        const childNode = typeof childId === 'string' ? 
          this.state.hierarchies[node.hierarchyName || 'le'].nodesMap[childId] : childId;
        
        if (childNode) {
          count += this.countTotalNodes(childNode);
        }
      });
    }
    
    return count;
  }
  

  /**
   * Handle search in filter dropdown
   * @param {Object} dimension - Dimension configuration
   * @param {string} searchTerm - Search term
   */
  handleFilterSearch(dimension, searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const checkboxOptions = document.querySelectorAll(`#${dimension.id}CheckboxList .checkbox-option`);
    
    checkboxOptions.forEach(option => {
      const label = option.querySelector('label');
      if (label) {
        const text = label.textContent.toLowerCase();
        const match = text.includes(searchLower);
        option.style.display = match ? '' : 'none';
      }
    });
  }

  
  /**
   * Select all items in a filter
   * @param {Object} dimension - Dimension configuration
   */
  selectAllInFilter(dimension) {
    this.filterSelections[dimension.id].clear();
    
    const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
    if (checkboxList) {
      const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
    }
    
    this.updateSelectionCount(dimension);
  }
    

  /**
   * Clear all selections in a filter
   * @param {Object} dimension - Dimension configuration
   */
  clearAllInFilter(dimension) {
    const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
    if (checkboxList) {
      const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        this.filterSelections[dimension.id].add(checkbox.value);
      });
    }
    
    this.updateSelectionCount(dimension);
  }
  

  /**
   * Apply all filters to the data
   */
  applyAllFilters() {
    console.log('⏳ Status: Applying filters and fetching data...');
    console.time('ApplyFiltersWithFetch');
    
    // Debug: Log current filter selections
    console.log('🔍 Current filter selections:');
    Object.values(this.filterMeta).forEach(dimension => {
      const selections = this.filterSelections[dimension.id];
      const selectionCount = selections ? selections.size : 0;
      console.log(`  - ${dimension.label}: ${selectionCount} excluded items`);
    });
    
    // Build filter parameters for database query
    const filterParams = this.buildFilterParameters();
    
    // Check if we have any filters to apply
    const hasFilters = Object.keys(filterParams).length > 0;
    
    if (!hasFilters) {
      console.log('⏳ Status: No specific filters selected, checking if all are excluded...');
      
      // Check if any dimension has all items excluded
      let allExcluded = false;
      Object.values(this.filterMeta).forEach(dimension => {
        const allValues = this.getAllValuesFromFieldData(dimension);
        const excludedCount = this.filterSelections[dimension.id].size;
        
        if (excludedCount > 0 && excludedCount >= allValues.length) {
          allExcluded = true;
          console.log(`All items excluded for ${dimension.label}`);
        }
      });
      
      if (allExcluded) {
        this.handleEmptyFilterResult();
        return;
      } else {
        // If no filters applied, show message but don't fetch data
        this.updateDataVolumeIndicator(0, 0);
        this.updateFilteredRecordsCount(0);
        
        const dataText = document.getElementById('dataVolumeText');
        if (dataText) {
          dataText.textContent = 'Select filter criteria and click Apply to load data';
        }
        return;
      }
    }
    
    console.log('📊 Filter parameters for API:', filterParams);
    
    // Fetch fact data with filters applied at database level
    this.fetchFilteredFactData(filterParams)
      .then(factData => {
        if (!factData || factData.length === 0) {
          console.log('⚠️ No fact data returned for current filter selection');
          this.handleEmptyFilterResult();
          return;
        }
        
        // Store the filtered fact data
        this.state.factData = factData;
        this.state.filteredData = factData;
        this.state.factDataLoaded = true;
        
        console.log(`✅ Status: Retrieved ${factData.length} fact records matching filters`);
        
        // Update UI indicators
        this.updateDataVolumeIndicator(factData.length, factData.length);
        this.updateFilteredRecordsCount(factData.length);
        
        // Refresh pivot table with new data
        this.refreshPivotTable();
        
        console.timeEnd('ApplyFiltersWithFetch');
      })
      .catch(error => {
        console.error('❌ Error fetching filtered fact data:', error);
        this.handleFilterError(error);
      });
  }


  /**
   * Build filter parameters for database query
   * @returns {Object} - Filter parameters object for API call
   */
  buildFilterParameters() {
    const filterParams = {};
    
    Object.values(this.filterMeta).forEach(dimension => {
      const selections = this.filterSelections[dimension.id];
      
      // Skip if no selections (all items selected)
      if (!selections || selections.size === 0) {
        return;
      }
      
      const fieldName = dimension.factField;
      
      if (!fieldName) {
        console.warn(`⚠️ No factField defined for dimension: ${dimension.id}`);
        return;
      }
      
      // Get all available values for this dimension from field-specific data
      const allValues = this.getAllValuesFromFieldData(dimension);
      
      // Calculate selected values (inverse of excluded values)
      const selectedValues = allValues.filter(value => !selections.has(value));
      
      // Only add to filter params if we have some (but not all) values selected
      if (selectedValues.length > 0 && selectedValues.length < allValues.length) {
        filterParams[fieldName] = selectedValues;
        console.log(`🔍 Filter parameter: ${fieldName} = [${selectedValues.length} values]`);
      } else if (selectedValues.length === 0) {
        console.log(`🔍 No values selected for ${dimension.label}, filter will return no results`);
        // Return empty object to indicate no results should be returned
        return {};
      }
    });
    
    return filterParams;
  }


  /**
   * Get all possible values for a dimension from field-specific data
   * @param {Object} dimension - Dimension configuration
   * @returns {Array} - Array of all possible values
   */
  getAllValuesFromFieldData(dimension) {
    const dimensionFilter = this.state.dimensionFilters[dimension.dimensionKey];
    
    if (!dimensionFilter || !dimensionFilter.data) {
      console.warn(`No field data available for dimension: ${dimension.dimensionKey}`);
      return [];
    }
    
    const uniqueValues = new Set();
    
    dimensionFilter.data.forEach(item => {
      if (item && item[dimension.valueField] !== undefined && item[dimension.valueField] !== null) {
        uniqueValues.add(item[dimension.valueField]);
      }
    });
    
    return Array.from(uniqueValues);
  }


  /**
   * Get ALL possible values for a dimension (for filter parameter building)
   */
  getAllValuesForDimension(dimension) {
    const allValues = [];
    
    switch (dimension.id) {
      case 'rootGmid':
        if (this.state.dimensions.gmid_display) {
          const uniqueValues = new Set();
          this.state.dimensions.gmid_display.forEach(item => {
            if (item.ROOT_GMID && !uniqueValues.has(item.ROOT_GMID)) {
              uniqueValues.add(item.ROOT_GMID);
              allValues.push(item.ROOT_GMID);
            }
          });
        }
        break;
        
      case 'smartcode':
        if (this.state.dimensions.smartcode) {
          const uniqueValues = new Set();
          this.state.dimensions.smartcode.forEach(item => {
            if (item.SMARTCODE && !uniqueValues.has(item.SMARTCODE)) {
              uniqueValues.add(item.SMARTCODE);
              allValues.push(item.SMARTCODE);
            }
          });
        }
        break;
        
      case 'businessYear':
        if (this.state.dimensions.year) {
          const uniqueValues = new Set();
          this.state.dimensions.year.forEach(item => {
            if (item.YEAR && !uniqueValues.has(item.YEAR)) {
              uniqueValues.add(item.YEAR);
              allValues.push(item.YEAR);
            }
          });
        }
        break;
        
      case 'itemCostType':
        if (this.state.dimensions.item_cost_type) {
          const uniqueValues = new Set();
          this.state.dimensions.item_cost_type.forEach(item => {
            if (item.ITEM_COST_TYPE && !uniqueValues.has(item.ITEM_COST_TYPE)) {
              uniqueValues.add(item.ITEM_COST_TYPE);
              allValues.push(item.ITEM_COST_TYPE);
            }
          });
        }
        break;
        
      case 'materialType':
        if (this.state.dimensions.material_type) {
          const uniqueValues = new Set();
          this.state.dimensions.material_type.forEach(item => {
            if (item.MATERIAL_TYPE && !uniqueValues.has(item.MATERIAL_TYPE)) {
              uniqueValues.add(item.MATERIAL_TYPE);
              allValues.push(item.MATERIAL_TYPE);
            }
          });
        }
        break;
        
      // For hierarchical dimensions, collect all factIds
      case 'legalEntity':
        if (this.state.hierarchies.le) {
          allValues.push(...this.collectAllFactIdsFromHierarchy(this.state.hierarchies.le));
        }
        break;
        
      case 'costElement':
        if (this.state.hierarchies.cost_element) {
          allValues.push(...this.collectAllFactIdsFromHierarchy(this.state.hierarchies.cost_element));
        }
        break;
        
      case 'managementCentre':
        if (this.state.hierarchies.mc) {
          allValues.push(...this.collectAllFactIdsFromHierarchy(this.state.hierarchies.mc));
        }
        break;
        
      default:
        console.warn(`No implementation for getAllValuesForDimension: ${dimension.id}`);
        break;
    }
    
    return allValues;
  }


  /**
   * Collect all factIds from a hierarchy
   */
  collectAllFactIdsFromHierarchy(hierarchy) {
    const factIds = new Set();
    
    const traverseNode = (node) => {
      if (node.factId) {
        if (Array.isArray(node.factId)) {
          node.factId.forEach(id => factIds.add(id));
        } else {
          factIds.add(node.factId);
        }
      }
      
      if (node.children && node.children.length > 0) {
        node.children.forEach(childId => {
          const childNode = typeof childId === 'string' ? 
            hierarchy.nodesMap[childId] : childId;
          if (childNode) {
            traverseNode(childNode);
          }
        });
      }
    };
    
    if (hierarchy.root) {
      traverseNode(hierarchy.root);
    }
    
    return Array.from(factIds).filter(id => id !== null && id !== undefined);
  }



  /**
   * Fetch filtered fact data from database
   * @param {Object} filterParams - Filter parameters for the query
   * @returns {Promise<Array>} - Promise resolving to filtered fact data
   */
  async fetchFilteredFactData(filterParams) {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filterParams).forEach(([field, values]) => {
        queryParams.append(field, values.join(','));
      });
      
      const url = `${API_BASE_URL}/data/FACT_BOM/filtered?${queryParams.toString()}`;
      console.log(`⏳ Status: Fetching filtered fact data from: ${url}`);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/x-ndjson' }
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      // Parse NDJSON response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const rows = [];

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
              console.warn('Invalid JSON line:', e);
            }
          }
        });
      }

      if (buffer.trim()) {
        try {
          rows.push(JSON.parse(buffer));
        } catch (e) {
          console.warn('Invalid final JSON line:', e);
        }
      }

      // Filter out rows with no meaningful measure values
      const filteredRows = rows.filter(row => {
        const hasValidCost = row.COST_UNIT !== null && row.COST_UNIT !== undefined && row.COST_UNIT !== 0;
        const hasValidQty = row.QTY_UNIT !== null && row.QTY_UNIT !== undefined && row.QTY_UNIT !== 0;
        return hasValidCost || hasValidQty;
      });

      console.log(`✅ Status: Retrieved ${filteredRows.length} valid fact records`);
      
      return filteredRows;
      
    } catch (error) {
      console.error('❌ Error fetching filtered fact data:', error);
      throw error;
    }
  }


  /**
   * Optimize dimensions based on filtered fact data
   * @param {Array} factData - The filtered fact data
   */
  optimizeDimensionsWithFactData(factData) {
      console.log("⏳ Status: Optimizing dimensions based on filtered fact data...");
      
      // Extract unique dimension keys from fact data
      const dimensionKeys = {};
      
      Object.keys(this.state.dimensions).forEach(dimKey => {
          const factIdField = this.getFactIdFieldForDimension(dimKey);
          
          if (factIdField) {
              const uniqueValues = new Set();
              factData.forEach(row => {
                  if (row[factIdField] !== null && row[factIdField] !== undefined && row[factIdField] !== '') {
                      uniqueValues.add(row[factIdField]);
                  }
              });
              dimensionKeys[dimKey] = uniqueValues;
              console.log(`✅ Status: Found ${uniqueValues.size} unique ${dimKey} keys in filtered fact data`);
          }
      });
      
      // Filter each dimension to only include records referenced in fact data
      Object.keys(this.state.dimensions).forEach(dimKey => {
          const originalData = this.state.dimensions[dimKey];
          const originalCount = originalData.length;
          
          if (dimensionKeys[dimKey] && dimensionKeys[dimKey].size > 0) {
              const dimIdField = this.getDimensionIdFieldForDimension(dimKey);
              
              if (dimIdField) {
                  const filteredData = originalData.filter(row => 
                      dimensionKeys[dimKey].has(row[dimIdField])
                  );
                  
                  // Store both original and filtered for potential restoration
                  if (!this.state._originalDimensions) {
                      this.state._originalDimensions = {};
                  }
                  if (!this.state._originalDimensions[dimKey]) {
                      this.state._originalDimensions[dimKey] = [...originalData];
                  }
                  
                  this.state.dimensions[dimKey] = filteredData;
                  
                  const reduction = originalCount - filteredData.length;
                  console.log(`✅ Status: Optimized ${dimKey}: ${originalCount} → ${filteredData.length} rows (${reduction} reduced)`);
              }
          }
      });
  }


  /**
   * Rebuild hierarchies with filtered fact data
   * @param {Array} factData - The filtered fact data
   */
  rebuildHierarchiesWithFactData(factData) {
      console.log("⏳ Status: Rebuilding hierarchies with filtered fact data...");
      
      try {
          // Use the existing hierarchy building function
          if (window.App && window.App.data && window.App.data.processDimensionHierarchies) {
              const hierarchies = window.App.data.processDimensionHierarchies(this.state.dimensions, factData);
              this.state.hierarchies = hierarchies || {};
              console.log("✅ Status: Hierarchies rebuilt with filtered data:", Object.keys(this.state.hierarchies));
          }
      } catch (error) {
          console.error("❌ Error rebuilding hierarchies:", error);
      }
  }


  /**
   * Handle empty filter results
   */
  handleEmptyFilterResult() {
    this.updateDataVolumeIndicator(0, 0);
    this.updateFilteredRecordsCount(0);
    
    const pivotTableBody = document.getElementById('pivotTableBody');
    if (pivotTableBody) {
      pivotTableBody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px; color: #666;">No data matches the selected filters. Try adjusting your filter criteria.</td></tr>';
    }
    
    const dataText = document.getElementById('dataVolumeText');
    if (dataText) {
      dataText.textContent = 'No data matches current filter selection';
    }
    
    console.log("⚠️ No data returned for current filter selection");
  }


  /**
   * Handle filter errors
   * @param {Error} error - The error that occurred
   */
  handleFilterError(error) {
    console.error('❌ Filter application failed:', error);
    
    this.updateDataVolumeIndicator(0, 0);
    this.updateFilteredRecordsCount(0);
    
    const pivotTableBody = document.getElementById('pivotTableBody');
    if (pivotTableBody) {
      pivotTableBody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 20px; color: #dc3545;">Error loading data: ${error.message}</td></tr>`;
    }
    
    const dataText = document.getElementById('dataVolumeText');
    if (dataText) {
      dataText.textContent = `Error: ${error.message}`;
    }
  }



  /**
   * Get fact ID field for a dimension
   * @param {string} dimKey - Dimension key
   * @returns {string|null} - Fact table field name
   */
  getFactIdFieldForDimension(dimKey) {
    // Find the filter meta entry for this dimension
    const dimension = Object.values(this.filterMeta).find(d => d.dimensionKey === dimKey);
    
    if (dimension && dimension.factField) {
        return dimension.factField;
    }
    
    // Fallback mapping if not found in filterMeta
    const fallbackMapping = {
        'le': 'LE',
        'cost_element': 'COST_ELEMENT',
        'gmid_display': 'COMPONENT_GMID',
        'smartcode': 'ROOT_SMARTCODE',
        'item_cost_type': 'ITEM_COST_TYPE',
        'material_type': 'COMPONENT_MATERIAL_TYPE',
        'mc': 'MC',
        'year': 'ZYEAR'
    };
    
    return fallbackMapping[dimKey.toLowerCase()] || null;
}


  /**
   * Get dimension ID field for a dimension
   * @param {string} dimKey - Dimension key
   * @returns {string|null} - Dimension table field name
   */
  getDimensionIdFieldForDimension(dimKey) {
      const mapping = {
          'le': 'LE',
          'cost_element': 'COST_ELEMENT',
          'gmid_display': 'COMPONENT_GMID',
          'smartcode': 'SMARTCODE',
          'item_cost_type': 'ITEM_COST_TYPE',
          'material_type': 'MATERIAL_TYPE',
          'mc': 'MC',
          'year': 'YEAR'
      };
      
      return mapping[dimKey.toLowerCase()] || null;
  }


  /**
   * Rebuild filtered hierarchies based on current selections
   */
  rebuildFilteredHierarchies() {
    console.log("⏳ Status: Rebuilding hierarchies based on filter selections...");
    
    // Rebuild each hierarchy
    this.rebuildGmidHierarchyWithFilters();     
    this.rebuildItemCostTypeHierarchy();        
    this.rebuildMaterialTypeHierarchy();        
    this.rebuildYearHierarchy();                
    this.rebuildMcHierarchy();                  
    this.rebuildLegalEntityHierarchy();         
    this.rebuildCostElementHierarchy();         
    this.rebuildSmartcodeHierarchy();
  }


  /**
   * Rebuild GMID display hierarchy based on filters
   */
  rebuildGmidHierarchyWithFilters() {
      console.log("⏳ Status: Rebuilding GMID display hierarchy based on filters...");
      
      const rootGmidFilter = this.filterSelections.rootGmid;
      
      // Get all available ROOT_GMIDs
      const allRootGmids = [];
      if (this.state.dimensions && this.state.dimensions.gmid_display) {
          this.state.dimensions.gmid_display.forEach(item => {
              if (item.ROOT_GMID && !allRootGmids.includes(item.ROOT_GMID)) {
                  allRootGmids.push(item.ROOT_GMID);
              }
          });
      }
      
      // console.log(`✅ Status: Found ${allRootGmids.length} total ROOT_GMIDs`);
      
      // Check if ALL items are selected (no exclusions)
      const allItemsSelected = !rootGmidFilter || rootGmidFilter.size === 0;
      
      if (allItemsSelected) {
          // console.log("✅ Status: ALL ROOT_GMIDs selected - restoring/rebuilding complete hierarchy");
          
          // Always rebuild from original data when all are selected to ensure proper structure
          const originalDimData = this.state.dimensions?.gmid_display;
          if (originalDimData && originalDimData.length > 0) {
              console.log(`📊 Rebuilding complete hierarchy from ${originalDimData.length} dimension records`);
              const completeHierarchy = this.buildFilteredGmidDisplayHierarchy(originalDimData, null);
              
              // Install the complete hierarchy
              this.state.hierarchies.gmid_display = completeHierarchy;
              
              // Update backup
              if (!this.state._originalHierarchies) {
                  this.state._originalHierarchies = {};
              }
              this.state._originalHierarchies.gmid_display = {
                  root: { ...completeHierarchy.root },
                  nodesMap: { ...completeHierarchy.nodesMap },
                  flatData: [...completeHierarchy.flatData]
              };
              
              const nodeCount = Object.keys(completeHierarchy.nodesMap).length;
              const rootChildren = completeHierarchy.root.children ? completeHierarchy.root.children.length : 0;
              
              console.log(`✅ Status: Complete GMID hierarchy: ${nodeCount} nodes, ROOT has ${rootChildren} children`);
              return false; // No rebuilding needed - we just did it
          }
      }
      
      // Continue with filtered rebuilding for partial selections...
      // (rest of the method unchanged)
      const selectedRootGmids = allRootGmids.filter(gmid => !rootGmidFilter.has(gmid));
      
      if (selectedRootGmids.length === 0) {
          this.createEmptyHierarchy(this.filterMeta.rootGmid);
          this.state._emptyFilterResult = true;
          return true;
      }
      
      const originalDimData = this.state.dimensions.gmid_display;
      const filteredDimData = originalDimData.filter(item => 
          item.ROOT_GMID && selectedRootGmids.includes(item.ROOT_GMID)
      );
      
      const filteredHierarchy = this.buildFilteredGmidDisplayHierarchy(filteredDimData, selectedRootGmids);
      this.state.hierarchies.gmid_display = filteredHierarchy;
      
      console.log(`✅ Status: Rebuilt filtered GMID hierarchy with ${selectedRootGmids.length} ROOT_GMIDs`);
      return true;
  }


  // Method to rebuild GMID hierarchy from original data
  rebuildGmidHierarchyFromOriginalData() {
      console.log("🔧 Rebuilding GMID hierarchy from original dimension data...");
      
      const originalDimData = this.state.dimensions?.gmid_display;
      if (!originalDimData || originalDimData.length === 0) {
          // console.error("❌ No original GMID dimension data available");
          return false;
      }
      
      // console.log(`📊 Rebuilding from ${originalDimData.length} dimension records`);
      
      // Rebuild the complete hierarchy using all data
      const completeHierarchy = this.buildFilteredGmidDisplayHierarchy(originalDimData, null);
      
      // Store as both current and backup
      this.state.hierarchies.gmid_display = completeHierarchy;
      
      if (!this.state._originalHierarchies) {
          this.state._originalHierarchies = {};
      }
      this.state._originalHierarchies.gmid_display = {
          root: completeHierarchy.root,
          nodesMap: { ...completeHierarchy.nodesMap },
          flatData: [...completeHierarchy.flatData]
      };
      
      const nodeCount = Object.keys(completeHierarchy.nodesMap).length;
      // console.log(`✅ Rebuilt complete GMID hierarchy with ${nodeCount} nodes`);
      
      // Verify ROOT node has children
      const rootNode = completeHierarchy.nodesMap['ROOT'];
      if (rootNode && rootNode.children) {
          // console.log(`✅ ROOT node now has ${rootNode.children.length} children`);
          return true;
      } else {
          // console.error("❌ ROOT node still has no children after rebuild");
          return false;
      }
  }


  /**
   * Rebuild ITEM_COST_TYPE hierarchy based on filter selections
   */
  rebuildItemCostTypeHierarchy() {
    console.log("⏳ Status: Rebuilding ITEM_COST_TYPE hierarchy based on filters...");
    
    // Get the filter selections for item cost type
    const itemCostTypeFilter = this.filterSelections.itemCostType;
    
    // Get all available item cost types
    const allItemCostTypes = [];
    if (this.state.dimensions && this.state.dimensions.item_cost_type) {
      this.state.dimensions.item_cost_type.forEach(item => {
        if (item.ITEM_COST_TYPE && !allItemCostTypes.includes(item.ITEM_COST_TYPE)) {
          allItemCostTypes.push(item.ITEM_COST_TYPE);
        }
      });
    }
    
    // Determine selected item cost types (empty set means all selected)
    let selectedItemCostTypes = [];
    if (itemCostTypeFilter && itemCostTypeFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedItemCostTypes = allItemCostTypes.filter(type => !itemCostTypeFilter.has(type));
    } else {
      // All types are selected
      selectedItemCostTypes = [...allItemCostTypes];
    }
    
    console.log(`✅ Status: Selected ITEM_COST_TYPEs: ${selectedItemCostTypes.length} of ${allItemCostTypes.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedItemCostTypes.length < allItemCostTypes.length) {
      // Get the original dimension data
      const originalDimData = this.state.dimensions.item_cost_type;
      
      // Filter dimension data to only include selected types
      const filteredDimData = originalDimData.filter(item => 
        item.ITEM_COST_TYPE && selectedItemCostTypes.includes(item.ITEM_COST_TYPE)
      );
      
      // Build the filtered hierarchy
      const filteredHierarchy = this.buildFilteredItemCostTypeHierarchy(filteredDimData);
      
      // Store in state
      this.state.hierarchies.item_cost_type = filteredHierarchy;
      
      // console.log(`✅ Status: Rebuilt ITEM_COST_TYPE hierarchy with ${selectedItemCostTypes.length} types`);
      return true;
    } else {
      // console.log("✅ Status: All ITEM_COST_TYPEs selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.item_cost_type) {
        this.state.hierarchies.item_cost_type = this.state._originalHierarchies.item_cost_type;
        // console.log("✅ Status: Restored original ITEM_COST_TYPE hierarchy");
      }
      
      return false;
    }
  }


  /**
   * Rebuild MATERIAL_TYPE hierarchy based on filter selections
   */
  rebuildMaterialTypeHierarchy() {
    console.log("⏳ Status: Rebuilding MATERIAL_TYPE hierarchy based on filters...");
    
    // Get the filter selections for material type
    const materialTypeFilter = this.filterSelections.materialType;
    
    // Get all available material types
    const allMaterialTypes = [];
    if (this.state.dimensions && this.state.dimensions.material_type) {
      this.state.dimensions.material_type.forEach(item => {
        if (item.MATERIAL_TYPE && !allMaterialTypes.includes(item.MATERIAL_TYPE)) {
          allMaterialTypes.push(item.MATERIAL_TYPE);
        }
      });
    }
    
    // Determine selected material types (empty set means all selected)
    let selectedMaterialTypes = [];
    if (materialTypeFilter && materialTypeFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedMaterialTypes = allMaterialTypes.filter(type => !materialTypeFilter.has(type));
    } else {
      // All types are selected
      selectedMaterialTypes = [...allMaterialTypes];
    }
    
    // console.log(`✅ Status: Selected MATERIAL_TYPEs: ${selectedMaterialTypes.length} of ${allMaterialTypes.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedMaterialTypes.length < allMaterialTypes.length) {
      // Get the original dimension data
      const originalDimData = this.state.dimensions.material_type;
      
      // Filter dimension data to only include selected types
      const filteredDimData = originalDimData.filter(item => 
        item.MATERIAL_TYPE && selectedMaterialTypes.includes(item.MATERIAL_TYPE)
      );
      
      // Build the filtered hierarchy
      const filteredHierarchy = this.buildFilteredMaterialTypeHierarchy(filteredDimData);
      
      // Store in state
      this.state.hierarchies.material_type = filteredHierarchy;
      
      // console.log(`✅ Status: Rebuilt MATERIAL_TYPE hierarchy with ${selectedMaterialTypes.length} types`);
      return true;
    } else {
      // console.log("✅ Status: All MATERIAL_TYPEs selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.material_type) {
        this.state.hierarchies.material_type = this.state._originalHierarchies.material_type;
        // console.log("✅ Status: Restored original MATERIAL_TYPE hierarchy");
      }
      
      return false;
    }
  }


  /**
   * Rebuild YEAR hierarchy based on filter selections
   */
  rebuildYearHierarchy() {
    console.log("⏳ Status: Rebuilding YEAR hierarchy based on filters...");
    
    // Get the filter selections for business year
    const yearFilter = this.filterSelections.businessYear;
    
    // Get all available years
    const allYears = [];
    if (this.state.dimensions && this.state.dimensions.year) {
      this.state.dimensions.year.forEach(item => {
        if (item.YEAR && !allYears.includes(item.YEAR.toString())) {
          allYears.push(item.YEAR.toString());
        }
      });
    }
    
    // Determine selected years (empty set means all selected)
    let selectedYears = [];
    if (yearFilter && yearFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedYears = allYears.filter(year => !yearFilter.has(year));
    } else {
      // All years are selected
      selectedYears = [...allYears];
    }
    
    console.log(`✅ Status: Selected YEARS: ${selectedYears.length} of ${allYears.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedYears.length < allYears.length) {
      // Get the original dimension data
      const originalDimData = this.state.dimensions.year;
      
      // Filter dimension data to only include selected years
      const filteredDimData = originalDimData.filter(item => 
        item.YEAR && selectedYears.includes(item.YEAR.toString())
      );
      
      // Build the filtered hierarchy
      const filteredHierarchy = this.buildFilteredYearHierarchy(filteredDimData);
      
      // Store in state
      this.state.hierarchies.year = filteredHierarchy;
      
      // console.log(`✅ Status: Rebuilt YEAR hierarchy with ${selectedYears.length} years`);
      return true;
    } else {
      // console.log("✅ Status: All YEARs selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.year) {
        this.state.hierarchies.year = this.state._originalHierarchies.year;
        // console.log("✅ Status: Restored original YEAR hierarchy");
      }
      
      return false;
    }
  }


  /**
   * Rebuild MC hierarchy based on filter selections
   */
  rebuildMcHierarchy() {
    console.log("⏳ Status: Rebuilding MC hierarchy based on filters...");
    
    // Get the filter selections for MC
    const mcFilter = this.filterSelections.managementCentre;
    
    // Get all available MCs
    const allMCs = [];
    if (this.state.dimensions && this.state.dimensions.mc) {
      this.state.dimensions.mc.forEach(item => {
        if (item.MC && !allMCs.includes(item.MC)) {
          allMCs.push(item.MC);
        }
      });
    }
    
    // Determine selected MCs (empty set means all selected)
    let selectedMCs = [];
    if (mcFilter && mcFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedMCs = allMCs.filter(mc => !mcFilter.has(mc));
    } else {
      // All MCs are selected
      selectedMCs = [...allMCs];
    }
    
    console.log(`✅ Status: Selected MCs: ${selectedMCs.length} of ${allMCs.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedMCs.length < allMCs.length) {
      // Get the original dimension data
      const originalDimData = this.state.dimensions.mc;
      
      // Filter dimension data to only include selected MCs
      const filteredDimData = originalDimData.filter(item => 
        item.MC && selectedMCs.includes(item.MC)
      );
      
      // Build the filtered hierarchy
      const filteredHierarchy = this.buildFilteredMcHierarchy(filteredDimData);
      
      // Store in state
      this.state.hierarchies.mc = filteredHierarchy;
        
      // console.log(`✅ Status: Rebuilt MC hierarchy with ${selectedMCs.length} MCs`);
      return true;
    } else {
      // console.log("✅ Status: All MCs selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.mc) {
        this.state.hierarchies.mc = this.state._originalHierarchies.mc;
        // console.log("✅ Status: Restored original MC hierarchy");
      }
      
      return false;
    }
  }
  

  /**
   * Builds a filtered GMID display hierarchy based on selected ROOT_GMIDs
   * @param {Array} data - The GMID display dimension data
   * @param {Array} selectedRootGmids - Array of selected ROOT_GMID values
   * @returns {Object} - Hierarchy object with root, nodesMap and original data
   */
  buildFilteredGmidDisplayHierarchy(data, selectedRootGmids = null) {
      console.log(`⏳ Status: Building GMID display hierarchy${selectedRootGmids ? ' with ROOT_GMID filtering' : ''}...`);
      
      // Check if we should apply ROOT_GMID filtering
      const applyRootGmidFilter = selectedRootGmids && 
                                Array.isArray(selectedRootGmids) && 
                                selectedRootGmids.length > 0;
      
      if (applyRootGmidFilter) {
          // console.log(`✅ Status: Filtering GMID hierarchy to include only ${selectedRootGmids.length} selected ROOT_GMIDs`);
          data = data.filter(item => item.ROOT_GMID && selectedRootGmids.includes(item.ROOT_GMID));
          console.log(`✅ Status: Filtered to ${data.length} GMID dimension records`);
      }
      
      // Create root node
      const rootNode = { 
          id: 'ROOT', 
          label: 'All GMIDs', 
          children: [], 
          level: 0, 
          path: ['ROOT'],
          expanded: true,
          isLeaf: false,
          hasChildren: false
      };
      
      // Map to store all nodes by their ID for quick lookup
      const nodesMap = { 'ROOT': rootNode };
      
      // Debug: Keep track of how many nodes we're creating at each level
      const levelCounts = { 0: 1 }; // Root node
      
      // Process each row in the data
      data.forEach((item, index) => {
          if (!item) {
              console.warn(`Skipping null item at index ${index}`);
              return;
          }
          
          // Handle missing required fields
          if (!item.PATH_GMID || !item.DISPLAY) {
              return;
          }
          
          // Split the PATH_GMID and DISPLAY columns by their respective delimiters
          const pathSegments = item.PATH_GMID.split('/');
          const displaySegments = item.DISPLAY.split('//');
          
          // Validate that we have matching segments
          if (pathSegments.length !== displaySegments.length) {
              return;
          }
          
          // CRITICAL FIX: Determine the GMID for this row, handling null COMPONENT_GMID
          let gmid;
          if (pathSegments[pathSegments.length - 1] === '#') {
              // When leaf segment is '#', use the entire PATH_GMID as factId
              // This allows matching records with null COMPONENT_GMID but matching PATH_GMID
              gmid = item.PATH_GMID;
          } else {
              // Otherwise, use the COMPONENT_GMID value (could be null)
              gmid = item.COMPONENT_GMID || item.PATH_GMID; // Fallback to PATH_GMID if COMPONENT_GMID is null
          }
          
          // Track the maximum level
          const maxLevel = pathSegments.length;
          
          let currentNode = rootNode;
          let currentPath = ['ROOT'];
          
          // Process each level
          for (let i = 0; i < maxLevel; i++) {
              const pathSegment = pathSegments[i];
              const displaySegment = displaySegments[i];
              
              // Skip if segment is empty
              if (!displaySegment || displaySegment.trim() === '') {
                  continue;
              }
              
              // Create a unique node ID for this segment that's safe for DOM
              const safeId = pathSegment.replace(/[^a-zA-Z0-9]/g, '_');
              const nodeId = `LEVEL_${i+1}_${safeId}`;
              
              // Track nodes created at this level
              levelCounts[i+1] = (levelCounts[i+1] || 0) + 1;
              
              // Check if we already have a node for this segment
              if (!nodesMap[nodeId]) {
                  // Create a new node
                  const isLastLevel = i === maxLevel - 1;
                  const newNode = {
                      id: nodeId,
                      label: displaySegment.trim(),
                      levelNum: i + 1,
                      levelValue: pathSegment.trim(),
                      children: [],
                      level: i + 1,
                      path: [...currentPath, nodeId],
                      expanded: i < 2, // Auto-expand first two levels
                      isLeaf: isLastLevel,
                      hasChildren: false,
                      rootGmid: item.ROOT_GMID,
                      rootDisplay: item.ROOT_DISPLAY,
                      // CRITICAL: Store the factId for filtering (could be PATH_GMID or COMPONENT_GMID)
                      factId: isLastLevel ? gmid : null
                  };
                  
                  nodesMap[nodeId] = newNode;
                  
                  // Add to parent's children
                  currentNode.children.push(newNode);
                  currentNode.isLeaf = false;
                  currentNode.hasChildren = true;
              } else if (i === maxLevel - 1 && currentNode.id === nodesMap[nodeId].path[nodesMap[nodeId].path.length - 2]) {
                  // Handle multiple GMIDs mapping to the same node
                  const existingNode = nodesMap[nodeId];
                  
                  if (!existingNode.factId) {
                      existingNode.factId = gmid;
                      existingNode.isLeaf = true;
                  } else if (existingNode.factId !== gmid) {
                      // Convert factId to array if it isn't already
                      if (!Array.isArray(existingNode.factId)) {
                          existingNode.factId = [existingNode.factId];
                      }
                      // Add this GMID if it's not already in the array
                      if (!existingNode.factId.includes(gmid)) {
                          existingNode.factId.push(gmid);
                      }
                  }
                  
                  // Mark as non-leaf if it has children
                  if (existingNode.children && existingNode.children.length > 0) {
                      existingNode.isLeaf = false;
                  }
              }
              
              // Update current node and path for next level
              currentNode = nodesMap[nodeId];
              currentPath = [...currentPath, nodeId];
          }
      });
      
      // Debug: Log how many nodes we created at each level
      // console.log("✅ Status: Nodes created per level:", levelCounts);
      // console.log("✅ Status: Total nodes in hierarchy:", Object.keys(nodesMap).length);
      
      // Sort nodes at each level
      const sortHierarchyNodes = (node) => {
          if (node.children && node.children.length > 0) {
              // Sort children by label
              node.children.sort((a, b) => {
                  return a.label.localeCompare(b.label);
              });
              
              // Recursively sort children's children
              node.children.forEach(child => sortHierarchyNodes(child));
          }
      };
      
      sortHierarchyNodes(rootNode);
      
      // Return the hierarchy
      return {
          root: rootNode,
          nodesMap: nodesMap,
          flatData: data
      };
  }


  /**
   * Build a filtered ITEM_COST_TYPE hierarchy
   * @param {Array} data - The filtered item cost type dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredItemCostTypeHierarchy(data) {
    console.log(`⏳ Status: Building filtered ITEM_COST_TYPE hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'ITEM_COST_TYPE_ROOT',
      label: 'All Item Cost Types',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['ITEM_COST_TYPE_ROOT'],
      hierarchyName: 'item_cost_type'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'ITEM_COST_TYPE_ROOT': root };
    
    // Get unique item cost types from filtered dimension data
    const itemCostTypeMap = new Map();
    
    data.forEach(item => {
      if (item && item.ITEM_COST_TYPE !== undefined) {
        // Use description as label
        const description = item.ITEM_COST_TYPE_DESC || item.ITEM_COST_TYPE;
        
        // Store the item cost type and its description
        itemCostTypeMap.set(item.ITEM_COST_TYPE, description);
      }
    });
    
    // Create nodes for each item cost type
    itemCostTypeMap.forEach((description, itemCostTypeCode) => {
      // Handle null values
      const safeCode = itemCostTypeCode === null ? 'null' : itemCostTypeCode;
      const nodeId = `ITEM_COST_TYPE_${safeCode}`;
      
      const node = {
        id: nodeId,
        label: description || 'null',
        itemCostTypeCode: itemCostTypeCode,
        children: [],
        level: 1,
        expanded: false,
        isLeaf: true,
        hasChildren: false,
        path: ['ITEM_COST_TYPE_ROOT', nodeId],
        factId: itemCostTypeCode,
        hierarchyName: 'item_cost_type'
      };
      
      // Add to maps
      nodesMap[nodeId] = node;
      
      // Add as child to root
      root.children.push(node);
      root.hasChildren = true;
    });
    
    // Sort children alphabetically
    root.children.sort((a, b) => {
      const aLabel = a.label;
      const bLabel = b.label;
      return aLabel.localeCompare(bLabel);
    });
    
    console.log(`✅ Status: Built filtered ITEM_COST_TYPE hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a filtered MATERIAL_TYPE hierarchy
   * @param {Array} data - The filtered material type dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredMaterialTypeHierarchy(data) {
    console.log(`⏳ Status: Building filtered MATERIAL_TYPE hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'MATERIAL_TYPE_ROOT',
      label: 'All Material Types',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['MATERIAL_TYPE_ROOT'],
      hierarchyName: 'material_type'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'MATERIAL_TYPE_ROOT': root };
    
    // Get unique material types from filtered dimension data
    const materialTypeMap = new Map();
    
    data.forEach(item => {
      if (item && item.MATERIAL_TYPE !== undefined) {
        // Use description as label if available, otherwise use the code
        const description = item.MATERIAL_TYPE_DESC || item.MATERIAL_TYPE;
        
        // Store the material type and its description
        materialTypeMap.set(item.MATERIAL_TYPE, description);
      }
    });
    
    // Create nodes for each material type
    materialTypeMap.forEach((description, materialTypeCode) => {
      // Handle null values
      const safeCode = materialTypeCode === null ? 'null' : materialTypeCode;
      const nodeId = `MATERIAL_TYPE_${safeCode}`;
      
      const node = {
        id: nodeId,
        label: description || 'null',
        materialTypeCode: materialTypeCode,
        children: [],
        level: 1,
        expanded: false,
        isLeaf: true,
        hasChildren: false,
        path: ['MATERIAL_TYPE_ROOT', nodeId],
        factId: materialTypeCode,
        hierarchyName: 'material_type'
      };
      
      // Add to maps
      nodesMap[nodeId] = node;
      
      // Add as child to root
      root.children.push(node);
      root.hasChildren = true;
    });
    
    // Sort children alphabetically
    root.children.sort((a, b) => {
      const aLabel = a.label;
      const bLabel = b.label;
      return aLabel.localeCompare(bLabel);
    });
    
    console.log(`✅ Status: Built filtered MATERIAL_TYPE hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a filtered YEAR hierarchy
   * @param {Array} data - The filtered year dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredYearHierarchy(data) {
    console.log(`⏳ Status: Building filtered YEAR hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'YEAR_ROOT',
      label: 'All Years',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['YEAR_ROOT'],
      hierarchyName: 'year'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'YEAR_ROOT': root };
    
    // Get unique years from filtered dimension data
    const uniqueYears = new Set();
    
    data.forEach(item => {
      if (item && item.YEAR) {
        uniqueYears.add(item.YEAR.toString());
      }
    });
    
    // Create nodes for each year
    uniqueYears.forEach(year => {
      const nodeId = `YEAR_${year}`;
      
      const node = {
        id: nodeId,
        label: year,
        children: [],
        level: 1,
        expanded: false,
        isLeaf: true,
        hasChildren: false,
        path: ['YEAR_ROOT', nodeId],
        factId: year,
        hierarchyName: 'year'
      };
      
      // Add to maps
      nodesMap[nodeId] = node;
      
      // Add as child to root
      root.children.push(node);
      root.hasChildren = true;
    });
    
    // Sort children chronologically
    root.children.sort((a, b) => {
      const yearA = parseInt(a.label);
      const yearB = parseInt(b.label);
      return yearA - yearB;
    });
    
    console.log(`✅ Status: Built filtered YEAR hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a filtered MC hierarchy
   * @param {Array} data - The filtered management centre dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredMcHierarchy(data) {
    console.log(`⏳ Status: Building filtered MC hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'MC_ROOT',
      label: 'All Management Centres',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['MC_ROOT'],
      hierarchyName: 'mc'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'MC_ROOT': root };
    
    // Check if we have PATH data for hierarchical structure
    const hasPath = data.some(item => item.PATH);
    
    if (hasPath) {
      // Process MC data as a hierarchical structure using PATH
      this.buildPathHierarchy(data, root, nodesMap, 'MC', '//');
    } else {
      // Process as flat structure if no PATH data
      const mcMap = new Map();
      
      // Collect unique MC values with descriptions
      data.forEach(item => {
        if (item && item.MC) {
          const description = item.MC_DESC || item.MC;
          mcMap.set(item.MC, description);
        }
      });
      
      // Create nodes for each MC
      mcMap.forEach((description, mcCode) => {
        const nodeId = `MC_${mcCode}`;
        
        const node = {
          id: nodeId,
          label: description,
          children: [],
          level: 1,
          expanded: false,
          isLeaf: true,
          hasChildren: false,
          path: ['MC_ROOT', nodeId],
          factId: mcCode,
          hierarchyName: 'mc'
        };
        
        // Add to maps
        nodesMap[nodeId] = node;
        
        // Add as child to root
        root.children.push(node);
        root.hasChildren = true;
      });
      
      // Sort children alphabetically
      root.children.sort((a, b) => {
        const aLabel = a.label;
        const bLabel = b.label;
        return aLabel.localeCompare(bLabel);
      });
    }
    
    console.log(`✅ Status: Built filtered MC hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  } 

  
  /**
   * Rebuild Legal Entity hierarchy based on filter selections
   */
  rebuildLegalEntityHierarchy() {
    console.log("⏳ Status: Rebuilding Legal Entity hierarchy based on filters...");
    
    // Get the filter selections for Legal Entity
    const leFilter = this.filterSelections.legalEntity;
    
    // Get all available legal entities
    const allLEs = [];
    if (this.state.dimensions && this.state.dimensions.le) {
      this.state.dimensions.le.forEach(item => {
        if (item.LE && !allLEs.includes(item.LE)) {
          allLEs.push(item.LE);
        }
      });
    }
    
    // Determine selected legal entities (empty set means all selected)
    let selectedLEs = [];
    if (leFilter && leFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedLEs = allLEs.filter(le => !leFilter.has(le));
    } else {
      // All legal entities are selected
      selectedLEs = [...allLEs];
    }
    
    console.log(`⏳ Status: Selected LEs: ${selectedLEs.length} of ${allLEs.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedLEs.length < allLEs.length) {
      // 1. Filter fact data based on selected legal entities
      if (this.state.factData && this.state.factData.length > 0) {
        const originalFactData = this.state.factData;
        
        // Create filtered data if it doesn't exist yet
        if (!this.state.filteredData) {
          this.state.filteredData = [...originalFactData];
        }
        
        // Apply filter to fact data (may already be filtered by other dimensions)
        this.state.filteredData = this.state.filteredData.filter(record => 
          record.LE && selectedLEs.includes(record.LE)
        );
        
        console.log(`✅ Status: Filtered FACT data based on LE: ${originalFactData.length} -> ${this.state.filteredData.length} records`);
        
        // Check if any records remain after filtering
        if (this.state.filteredData.length === 0) {
          // Create an empty hierarchy when no data matches
          console.log("✅ Status: No records match LE filter, creating empty hierarchy");
          this.createEmptyHierarchy(this.filterMeta.legalEntity);
          
          // Set a flag to indicate we have an empty result set
          this.state._emptyFilterResult = true;
          return true;
        }
      }
      
      // 2. Get the original dimension data
      const originalDimData = this.state.dimensions.le;
      
      // 3. Filter dimension data to only include selected legal entities
      const filteredDimData = originalDimData.filter(item => 
        item.LE && selectedLEs.includes(item.LE)
      );
      
      // 4. Build the filtered hierarchy using the filtered dimension data
      const filteredHierarchy = this.buildFilteredLegalEntityHierarchy(filteredDimData);
      
      // 5. Store filtered hierarchy in state
      this.state.hierarchies.le = filteredHierarchy;
        
      // console.log(`✅ Status: Rebuilt LE hierarchy with ${selectedLEs.length} legal entities from ${filteredDimData.length} dimension records`);
      return true;
    } else {
      // console.log("✅ Status: All Legal Entities selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.le) {
        this.state.hierarchies.le = this.state._originalHierarchies.le;
        // console.log("✅ Status: Restored original LE hierarchy");
      }
      
      return false;
    }
  }

  
  /**
   * Rebuild Cost Element hierarchy based on filter selections
   */
  rebuildCostElementHierarchy() {
    console.log("⏳ Status: Rebuilding Cost Element hierarchy based on filters...");
    
    // Get the filter selections for Cost Element
    const ceFilter = this.filterSelections.costElement;
    
    // Get all available cost elements
    const allCEs = [];
    if (this.state.dimensions && this.state.dimensions.cost_element) {
      this.state.dimensions.cost_element.forEach(item => {
        if (item.COST_ELEMENT && !allCEs.includes(item.COST_ELEMENT)) {
          allCEs.push(item.COST_ELEMENT);
        }
      });
    }
    
    // Determine selected cost elements (empty set means all selected)
    let selectedCEs = [];
    if (ceFilter && ceFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedCEs = allCEs.filter(ce => !ceFilter.has(ce));
    } else {
      // All cost elements are selected
      selectedCEs = [...allCEs];
    }
    
    console.log(`✅ Status: Selected Cost Elements: ${selectedCEs.length} of ${allCEs.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedCEs.length < allCEs.length) {
      // 1. Filter fact data based on selected cost elements
      if (this.state.factData && this.state.factData.length > 0) {
        const originalFactData = this.state.factData;
        
        // Create filtered data if it doesn't exist yet
        if (!this.state.filteredData) {
          this.state.filteredData = [...originalFactData];
        }
        
        // Apply filter to fact data (may already be filtered by other dimensions)
        this.state.filteredData = this.state.filteredData.filter(record => 
          record.COST_ELEMENT && selectedCEs.includes(record.COST_ELEMENT)
        );
        
        console.log(`✅ Status: Filtered FACT data based on COST_ELEMENT: ${originalFactData.length} -> ${this.state.filteredData.length} records`);
        
        // Check if any records remain after filtering
        if (this.state.filteredData.length === 0) {
          // Create an empty hierarchy when no data matches
          console.log("✅ Status: No records match COST_ELEMENT filter, creating empty hierarchy");
          this.createEmptyHierarchy(this.filterMeta.costElement);
          
          // Set a flag to indicate we have an empty result set
          this.state._emptyFilterResult = true;
          return true;
        }
      }
      
      // 2. Get the original dimension data
      const originalDimData = this.state.dimensions.cost_element;
      
      // 3. Filter dimension data to only include selected cost elements
      const filteredDimData = originalDimData.filter(item => 
        item.COST_ELEMENT && selectedCEs.includes(item.COST_ELEMENT)
      );
      
      // 4. Build the filtered hierarchy using the filtered dimension data
      const filteredHierarchy = this.buildFilteredCostElementHierarchy(filteredDimData);
      
      // 5. Store filtered hierarchy in state
      this.state.hierarchies.cost_element = filteredHierarchy;
        
      // console.log(`✅ Status: Rebuilt Cost Element hierarchy with ${selectedCEs.length} cost elements from ${filteredDimData.length} dimension records`);
      return true;
    } else {
      // console.log("✅ Status: All Cost Elements selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.cost_element) {
        this.state.hierarchies.cost_element = this.state._originalHierarchies.cost_element;
        // console.log("✅ Status: Restored original Cost Element hierarchy");
      }
      
      return false;
    }
  }

  
  /**
   * Rebuild Smartcode hierarchy based on filter selections
   */
  rebuildSmartcodeHierarchy() {
    console.log("⏳ Status: Rebuilding Smartcode hierarchy based on filters...");
    
    // Get the filter selections for Smartcode
    const scFilter = this.filterSelections.smartcode;
    
    // Get all available smartcodes
    const allSCs = [];
    if (this.state.dimensions && this.state.dimensions.smartcode) {
      this.state.dimensions.smartcode.forEach(item => {
        if (item.SMARTCODE && !allSCs.includes(item.SMARTCODE)) {
          allSCs.push(item.SMARTCODE);
        }
      });
    }
    
    // Determine selected smartcodes (empty set means all selected)
    let selectedSCs = [];
    if (scFilter && scFilter.size > 0) {
      // We store excluded values, so we need to invert the selection
      selectedSCs = allSCs.filter(sc => !scFilter.has(sc));
    } else {
      // All smartcodes are selected
      selectedSCs = [...allSCs];
    }
    
    console.log(`✅ Status: Selected Smartcodes: ${selectedSCs.length} of ${allSCs.length}`);
    
    // Only rebuild if we're filtering (otherwise use the original hierarchy)
    if (selectedSCs.length < allSCs.length) {
      // 1. Get the original dimension data
      const originalDimData = this.state.dimensions.smartcode;
      
      // 2. Filter dimension data to only include selected smartcodes
      const filteredDimData = originalDimData.filter(item => 
        item.SMARTCODE && selectedSCs.includes(item.SMARTCODE)
      );
      
      // 5. Filter fact data based on selected smartcodes
      if (this.state.factData && this.state.factData.length > 0) {
        const originalFactData = this.state.factData;
        
        // Filter records to only include those with selected ROOT_SMARTCODE values
        if (!this.state.filteredData) {
          this.state.filteredData = [...originalFactData];
        }
        
        // Apply filter to fact data (may already be filtered by other dimensions)
        this.state.filteredData = this.state.filteredData.filter(record => 
          record.ROOT_SMARTCODE && selectedSCs.includes(record.ROOT_SMARTCODE)
        );
        
        console.log(`✅ Status: Filtered FACT data based on SMARTCODE: ${originalFactData.length} -> ${this.state.filteredData.length} records`);
        
        // Check if any records remain after filtering
        if (this.state.filteredData.length === 0) {
          // Create an empty hierarchy when no data matches
          console.log("✅ Status: No records match SMARTCODE filter, creating empty hierarchy");
          
          // Create an empty hierarchy with just a root node
          const emptyHierarchy = {
            root: {
              id: 'SMARTCODE_ROOT',
              label: 'All Smartcodes (No matching records)',
              children: [],
              level: 0,
              expanded: true,
              isLeaf: true,
              hasChildren: false,
              path: ['SMARTCODE_ROOT'],
              hierarchyName: 'smartcode'
            },
            nodesMap: { 'SMARTCODE_ROOT': this.state.hierarchies.smartcode.root },
            flatData: []
          };
          
          // Store the empty hierarchy
          this.state.hierarchies.smartcode = emptyHierarchy;
          
          // Set a flag to indicate we have an empty result set
          this.state._emptyFilterResult = true;
          return true;
        }
      }
      
      // Only build the filtered hierarchy if there's matching data
      // 3. Build the filtered hierarchy using the filtered dimension data
      const filteredHierarchy = this.buildFilteredSmartcodeHierarchy(filteredDimData);
      
      // 4. Store filtered hierarchy in state
      this.state.hierarchies.smartcode = filteredHierarchy;
        
      // console.log(`✅ Status: Rebuilt Smartcode hierarchy with ${selectedSCs.length} smartcodes from ${filteredDimData.length} dimension records`);
      return true;
    } else {
      // console.log("✅ Status: All Smartcodes selected, no need to rebuild hierarchy");
      
      // Restore original hierarchy if we previously filtered
      if (this.state._originalHierarchies && this.state._originalHierarchies.smartcode) {
        this.state.hierarchies.smartcode = this.state._originalHierarchies.smartcode;
        // console.log("✅ Status: Restored original Smartcode hierarchy");
      }
      
      return false;
    }
  }


  /**
   * Builds a hierarchical structure from PATH-based data
   * For use with LE, COST_ELEMENT, MC, and SMARTCODE dimensions
   * 
   * @param {Array} data - The dimension data with PATH property
   * @param {Object} root - The root node to build from
   * @param {Object} nodesMap - Map to store all nodes by ID
   * @param {String} factIdField - The field name to use for factId
   * @param {String} pathSeparator - The separator used in PATH field ('/' or '//')
   */
  buildPathHierarchy(data, root, nodesMap, factIdField, pathSeparator = '//') {
    console.log(`⏳ Status: Building PATH hierarchy for ${root.hierarchyName} with ${data.length} records using separator "${pathSeparator}"`);
    
    // Maps to track nodes by path
    const nodeByPath = new Map();
    
    // Track invalid/empty paths
    let invalidPathCount = 0;
    let emptyPathCount = 0;
    
    // Process each item to build the hierarchy
    data.forEach(item => {
      if (!item.PATH) {
        emptyPathCount++;
        return;
      }
      
      // Split the path into segments
      const segments = item.PATH.split(pathSeparator).filter(s => s.trim() !== '');
      if (segments.length === 0) {
        emptyPathCount++;
        return;
      }
      
      try {
        // Process each segment in the path
        let parentNode = root;
        let currentPath = root.id;
        
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const isLastSegment = i === segments.length - 1;
          
          // Skip empty segments
          if (!segment || segment.trim() === '') continue;
          
          // Build up the path for this segment
          currentPath = `${currentPath}/${segment}`;
          
          // Check if we already have a node for this path
          let node = nodeByPath.get(currentPath);
          
          if (!node) {
            // Create a unique ID for this node
            const dimensionPrefix = root.hierarchyName.toUpperCase();
            const safeSegment = segment.replace(/[^a-zA-Z0-9]/g, '_');
            const nodeId = `${dimensionPrefix}_SEGMENT_${i+1}_${safeSegment}_${Math.floor(Math.random() * 1000)}`;
            
            // Create new node
            node = {
              id: nodeId,
              label: segment,
              children: [],
              level: i + 1,
              expanded: i < 2, // Expand first two levels by default
              isLeaf: isLastSegment,
              hasChildren: !isLastSegment,
              factId: isLastSegment ? item[factIdField] : null,
              path: [...parentNode.path, nodeId],
              hierarchyName: root.hierarchyName
            };
            
            // Store in maps
            nodesMap[nodeId] = node;
            nodeByPath.set(currentPath, node);
            
            // Add as child to parent node
            parentNode.children.push(node);
            parentNode.hasChildren = true;
            parentNode.isLeaf = false;
          } else {
            // This path segment exists, but check if we need to update factId
            // If this is a leaf node in this particular path, ensure it has a factId
            if (isLastSegment && !node.factId && item[factIdField]) {
              node.factId = item[factIdField];
              node.isLeaf = true;
            }
          }
          
          // Update parent for next iteration
          parentNode = node;
        }
      } catch (err) {
        invalidPathCount++;
        console.error(`❌ Alert! Error processing path for ${root.hierarchyName}: ${item.PATH}`, err);
      }
    });
    
    // Log stats
    // console.log(`PATH hierarchy processing stats for ${root.hierarchyName}:`);
    // console.log(`- Total records processed: ${data.length}`);
    // console.log(`- Empty paths skipped: ${emptyPathCount}`);
    // console.log(`- Invalid paths skipped: ${invalidPathCount}`);
    // console.log(`- Nodes created: ${Object.keys(nodesMap).length - 1}`); // -1 for root
    
    // Recursively sort nodes at each level
    const sortNodes = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => {
          // Sort alphabetically by label
          return a.label.localeCompare(b.label);
        });
        node.children.forEach(sortNodes);
      }
    };
    
    sortNodes(root);
    
    console.log(`✅ Status: PATH hierarchy for ${root.hierarchyName} built with ${Object.keys(nodesMap).length} nodes`);
    
    // Handle case where no valid hierarchies were created
    if (Object.keys(nodesMap).length <= 1) {
      console.warn(`No valid hierarchy nodes created for ${root.hierarchyName}, falling back to flat structure`);
      
      // Fall back to flat structure
      this.buildFlatHierarchy(data, root, nodesMap, factIdField, 
        root.hierarchyName === 'cost_element' ? 'COST_ELEMENT_DESC' :
        root.hierarchyName === 'le' ? 'LE_DESC' :
        root.hierarchyName === 'mc' ? 'MC_DESC' : factIdField);
    }
  }


  /**
 * Build a filtered legal entity hierarchy
 * @param {Array} data - The filtered legal entity dimension data
 * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
 */
  buildFilteredLegalEntityHierarchy(data) {
    console.log(`⏳ Status: Building filtered legal entity hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'LE_ROOT',
      label: 'All Legal Entities',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['LE_ROOT'],
      hierarchyName: 'le'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'LE_ROOT': root };
    
    // Check if we have PATH data for hierarchical structure
    const hasPath = data.some(item => item.PATH);
    
    if (hasPath) {
      // Process legal entity data as a hierarchical structure using PATH
      // Use a more robust approach to ensure proper hierarchy building
      try {
        // Extract unique PATH values for analysis
        const paths = data.filter(item => item.PATH).map(item => item.PATH);
        // console.log(`✅ Status: Found ${paths.length} unique PATH values for Legal Entities`);
        
        // Get common delimiter (should be '//')
        const pathSeparator = '//';
        
        // console.log(`Using path separator: "${pathSeparator}" for Legal Entity hierarchy`);
        
        // Build the hierarchy using the robust path processing
        this.buildPathHierarchy(data, root, nodesMap, 'LE', pathSeparator);
        
        // Log hierarchy building success
        console.log(`✅ Status: Successfully built Legal Entity hierarchy: ${root.children.length} top-level nodes, ${Object.keys(nodesMap).length} total nodes`);
      } catch (error) {
        console.error("❌ Alert! Error building Legal Entity hierarchy:", error);
        // Fall back to flat structure on error
        this.buildFlatHierarchy(data, root, nodesMap, 'LE', 'LE_DESC');
      }
    } else {
      // Process as flat structure if no PATH data
      this.buildFlatHierarchy(data, root, nodesMap, 'LE', 'LE_DESC');
    }
    
    // Ensure root has children flag set correctly
    root.hasChildren = root.children.length > 0;
    
    console.log(`✅ Status: Built filtered LE hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a filtered cost element hierarchy
   * @param {Array} data - The filtered cost element dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredCostElementHierarchy(data) {
    console.log(`⏳ Status: Building filtered Cost Element hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'COST_ELEMENT_ROOT',
      label: 'All Cost Elements',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['COST_ELEMENT_ROOT'],
      hierarchyName: 'cost_element'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'COST_ELEMENT_ROOT': root };
    
    // Check if we have PATH data for hierarchical structure
    const hasPath = data.some(item => item.PATH);
    
    if (hasPath) {
      // Process cost element data as a hierarchical structure using PATH
      // We'll use a more robust approach to ensure proper hierarchy building
      try {
        // Extract unique PATH values for analysis
        const paths = data.filter(item => item.PATH).map(item => item.PATH);
        // console.log(`✅ Status: Found ${paths.length} unique PATH values for Cost Elements`);
        
        // Get common delimiter (should be '//')
        // Use // as the default path separator as specified
        const pathSeparator = '//';
        
        // console.log(`✅ Status: Using path separator: "${pathSeparator}" for Cost Element hierarchy`);
        
        // Build the hierarchy using the robust path processing
        this.buildPathHierarchy(data, root, nodesMap, 'COST_ELEMENT', pathSeparator);
        
        // Log hierarchy building success
        console.log(`✅ Status: Successfully built Cost Element hierarchy: ${root.children.length} top-level nodes, ${Object.keys(nodesMap).length} total nodes`);
      } catch (error) {
        console.error("❌ Alert! Error building Cost Element hierarchy:", error);
        // Fall back to flat structure on error
        this.buildFlatHierarchy(data, root, nodesMap, 'COST_ELEMENT', 'COST_ELEMENT_DESC');
      }
    } else {
      // Process as flat structure if no PATH data
      this.buildFlatHierarchy(data, root, nodesMap, 'COST_ELEMENT', 'COST_ELEMENT_DESC');
    }
    
    // Ensure root has children flag set correctly
    root.hasChildren = root.children.length > 0;
    
    console.log(`✅ Status: Built filtered Cost Element hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a filtered smartcode hierarchy
   * @param {Array} data - The filtered smartcode dimension data
   * @returns {Object} - Hierarchy object with root, nodesMap, and flatData
   */
  buildFilteredSmartcodeHierarchy(data) {
    console.log(`⏳ Status: Building filtered Smartcode hierarchy with ${data.length} records...`);
    
    // Create root node
    const root = {
      id: 'SMARTCODE_ROOT',
      label: 'All Smartcodes',
      children: [],
      level: 0,
      expanded: true,
      isLeaf: false,
      hasChildren: false,
      path: ['SMARTCODE_ROOT'],
      hierarchyName: 'smartcode'
    };
    
    // Map to store all nodes by their ID for quick lookup
    const nodesMap = { 'SMARTCODE_ROOT': root };
    
    // Check if we have PATH data for hierarchical structure
    const hasPath = data.some(item => item.PATH);
    
    if (hasPath) {
      // Process smartcode data as a hierarchical structure using PATH
      this.buildPathHierarchy(data, root, nodesMap, 'SMARTCODE', '//');
    } else {
      // Process as flat structure if no PATH data
      const scMap = new Map();
      
      // Collect unique SMARTCODE values with descriptions
      data.forEach(item => {
        if (item && item.SMARTCODE) {
          const description = item.SMARTCODE_DESC || item.SMARTCODE;
          scMap.set(item.SMARTCODE, description);
        }
      });
      
      // Create nodes for each SMARTCODE
      scMap.forEach((description, scCode) => {
        const nodeId = `SMARTCODE_${scCode}`;
        
        const node = {
          id: nodeId,
          label: description,
          children: [],
          level: 1,
          expanded: false,
          isLeaf: true,
          hasChildren: false,
          path: ['SMARTCODE_ROOT', nodeId],
          factId: scCode,
          hierarchyName: 'smartcode'
        };
        
        // Add to maps
        nodesMap[nodeId] = node;
        
        // Add as child to root
        root.children.push(node);
        root.hasChildren = true;
      });
      
      // Sort children alphabetically
      root.children.sort((a, b) => {
        const aLabel = a.label;
        const bLabel = b.label;
        return aLabel.localeCompare(bLabel);
      });
    }
    
    console.log(`✅ Status: Built filtered Smartcode hierarchy with ${Object.keys(nodesMap).length} nodes`);
    
    return {
      root: root,
      nodesMap: nodesMap,
      flatData: data
    };
  }


  /**
   * Build a hierarchical MC structure from PATH data
   * @param {Array} data - The MC dimension data
   * @param {Object} root - The root node to add children to
   * @param {Object} nodesMap - The map of node IDs to node objects
   */
  buildMcHierarchyFromPath(data, root, nodesMap) {
    // Maps to track nodes by path
    const nodeByPath = new Map();
    
    // Process each item to build the hierarchy
    data.forEach(item => {
        if (!item.PATH) return;
        
        // Split the path into segments
        const segments = item.PATH.split('//').filter(s => s.trim() !== '');
        if (segments.length === 0) return;
        
        // Process each segment in the path
        let parentNode = root;
        let currentPath = root.id;
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const isLastSegment = i === segments.length - 1;
            
            // Build up the path for this segment
            currentPath = `${currentPath}/${segment}`;
            
            // Check if we already have a node for this path
            let node = nodeByPath.get(currentPath);
            
            if (!node) {
                // Create a unique ID for this node
                const nodeId = `MC_SEGMENT_${currentPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                
                // Create new node
                node = {
                    id: nodeId,
                    label: segment,
                    children: [],
                    level: i + 1,
                    expanded: false,
                    isLeaf: isLastSegment,
                    hasChildren: !isLastSegment,
                    factId: isLastSegment ? item.MC : null,
                    path: [...parentNode.path, nodeId],
                    hierarchyName: 'mc'
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
    
    // Recursively sort nodes at each level
    const sortNodes = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => a.label.localeCompare(b.label));
            node.children.forEach(sortNodes);
        }
    };
    
    sortNodes(root);
  }


  /**
   * Apply a specific filter to the data
   * @param {Array} data - Data to filter
   * @param {Object} dimension - Dimension configuration
   * @returns {Array} - Filtered data
   */
  // applyFilter(data, dimension) {
  //   // Skip if no selections (all selected)
  //   if (this.filterSelections[dimension.id].size === 0) {
  //     return data;
  //   }
    
  //   console.log(`✅ Status: Applying ${dimension.label} filter (${this.filterSelections[dimension.id].size} excluded)...`);
    
  //   const startTime = performance.now();
  //   let filteredData;
    
  //   if (dimension.hierarchical) {
  //     // For hierarchical dimensions, use hierarchy-aware filtering
  //     filteredData = this.applyHierarchicalFilter(data, dimension);
  //   } else {
  //     // For simple dimensions like SMARTCODE, filter directly by field value
  //     filteredData = data.filter(record => {
  //       const value = record[dimension.factField];
  //       return value !== undefined && !this.filterSelections[dimension.id].has(value);
  //     });
  //   }
    
  //   const endTime = performance.now();
  //   console.log(`✅ Status: ${dimension.label} filter applied in ${(endTime - startTime).toFixed(2)}ms: ${data.length} -> ${filteredData.length} records`);
    
  //   return filteredData;
  // }

  
  /**
   * Apply a hierarchical filter using hierarchy information
   * @param {Array} data - Data to filter
   * @param {Object} dimension - Dimension configuration
   * @returns {Array} - Filtered data
   */
  applyHierarchicalFilter(data, dimension) {
    // Get hierarchy
    const hierarchy = this.state.hierarchies[dimension.dimensionKey];
    if (!hierarchy || !hierarchy.root) {
      console.warn(`⚠️ Warning: Hierarchy not found for ${dimension.label}, falling back to direct filtering`);
      return data.filter(record => {
        const value = record[dimension.factField];
        return value !== undefined && !this.filterSelections[dimension.id].has(value);
      });
    }
    
    // Get all excluded fact IDs
    const excludedFactIds = new Set();
    
    // Process each excluded node
    this.filterSelections[dimension.id].forEach(nodeId => {
      const node = hierarchy.nodesMap[nodeId];
      if (node) {
        // Add this node's factId if it's a leaf node
        if (node.factId) {
          if (Array.isArray(node.factId)) {
            // Handle multiple factIds (sometimes nodes can map to multiple values)
            node.factId.forEach(id => excludedFactIds.add(id));
          } else {
            excludedFactIds.add(node.factId);
          }
        }
        
        // Add descendant factIds if precomputed
        if (node.descendantFactIds && node.descendantFactIds.length > 0) {
          node.descendantFactIds.forEach(id => excludedFactIds.add(id));
        } else if (node.children && node.children.length > 0) {
          // Otherwise collect all leaf descendants
          this.collectLeafDescendantFactIds(node, hierarchy.nodesMap).forEach(id => excludedFactIds.add(id));
        }
      }
    });
    
    console.log(`✅ Status: Collected ${excludedFactIds.size} excluded factIds for ${dimension.label}`);
    
    // If we have no excluded factIds and no selected nodes, everything is selected
    if (excludedFactIds.size === 0 && this.filterSelections[dimension.id].size === 0) {
      return data;
    }
    
    // Filter data
    const filteredData = data.filter(record => {
      const value = record[dimension.factField];
      return value !== undefined && !excludedFactIds.has(value);
    });
    
    console.log(`✅ Status: Applied ${dimension.label} filter: ${data.length} -> ${filteredData.length} records`);
    
    return filteredData;
  }

  
  // Enhanced method to collect factIds from all leaf descendants
  collectLeafDescendantFactIds(node, nodesMap) {
    const factIds = new Set();
    
    // Add this node's factId if it's a leaf node
    if (node.isLeaf && node.factId) {
      if (Array.isArray(node.factId)) {
        // Handle array of factIds
        node.factId.forEach(id => factIds.add(id));
      } else {
        factIds.add(node.factId);
      }
      return factIds;
    }
    
    // Process children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        // Handle both string IDs and object references
        const childNode = typeof childId === 'string' ? nodesMap[childId] : childId;
        if (childNode) {
          const childFactIds = this.collectLeafDescendantFactIds(childNode, nodesMap);
          childFactIds.forEach(id => factIds.add(id));
        }
      });
    }
    
    return factIds;
  }

  
  /**
   * Collect factIds from all leaf descendants of a node
   * @param {Object} node - Starting node
   * @param {Object} nodesMap - Map of all nodes
   * @returns {Set} - Set of factIds
   */
  collectLeafDescendantFactIds(node, nodesMap) {
    const factIds = new Set();
    
    // Add this node's factId if it's a leaf node
    if (node.isLeaf && node.factId) {
      factIds.add(node.factId);
      return factIds;
    }
    
    // Process children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        // Handle both string IDs and object references
        const childNode = typeof childId === 'string' ? nodesMap[childId] : childId;
        if (childNode) {
          const childFactIds = this.collectLeafDescendantFactIds(childNode, nodesMap);
          childFactIds.forEach(id => factIds.add(id));
        }
      });
    }
    
    return factIds;
  }

  
  /**
   * Update the data volume indicator with filter results
   * @param {number} totalCount - Total number of records
   * @param {number} filteredCount - Filtered number of records
   */
  updateDataVolumeIndicator(totalCount, filteredCount) {
    const indicator = document.getElementById('dataVolumeIndicator');
    if (!indicator) return;
    
    const progressBar = indicator.querySelector('.progress-bar');
    const dataText = document.getElementById('dataVolumeText');
    
    if (progressBar && dataText) {
      const percentage = totalCount > 0 ? (filteredCount / totalCount) * 100 : 0;
      
      progressBar.style.width = `${percentage}%`;
      
      if (percentage < 10) {
        progressBar.style.backgroundColor = '#ef4444';
      } else if (percentage < 30) {
        progressBar.style.backgroundColor = '#f59e0b';
      } else if (percentage < 60) {
        progressBar.style.backgroundColor = '#10b981';
      } else {
        progressBar.style.backgroundColor = '#2563eb';
      }
      
      if (filteredCount > 0) {
        dataText.innerHTML = `${this.formatNumber(filteredCount)} records loaded`;
      } else {
        dataText.innerHTML = 'No data loaded';
      }
    }
  }

  
  /**
   * Update the filtered records count in the UI
   * @param {number} count - Filtered record count
   */
  updateFilteredRecordsCount(count) {
    const countElement = this.elements.filteredRecordsCount;
    if (countElement) {
      countElement.textContent = `${this.formatNumber(count)} records`;
    }
  }

  
  /**
   * Format a number with thousands separators
   * @param {number} num - Number to format
   * @returns {string} - Formatted number
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  
  /**
   * Refresh the pivot table with filtered data
   */
  refreshPivotTable() {
    console.log('⏳ Status: Refreshing pivot table with filtered data...');
    
    if (window.App && window.App.pivotTable && window.App.pivotTable.generatePivotTable) {
      window.App.pivotTable.generatePivotTable();
      console.log('✅ Status: Pivot table refreshed');
    } else if (window.generatePivotTable) {
      window.generatePivotTable();
      console.log('✅ Status: Pivot table refreshed');
    } else {
      console.warn('⚠️ Warning: Pivot table refresh function not found');
    }
  }


  updateSimpleFiltersAfterApply(selectAllMode = false) {
    Object.values(this.filterMeta).forEach(dimension => {
      if (!dimension.hierarchical) {
        const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
        if (!checkboxList) return;

        const allValues = this.getUniqueValuesForDimension(dimension);

        const validSet = new Set();
        this.state.filteredData.forEach(record => {
          const value = record[dimension.factField];
          if (value !== undefined && value !== null) validSet.add(value);
        });

        const previousSelection = new Set(this.filterSelections[dimension.id]);
        checkboxList.innerHTML = '';

        let allAreValid = true;

        allValues.forEach(item => {
          const safeId = (item.id || item.value).toString().replace(/[^a-zA-Z0-9]/g, '_');
          const isValid = validSet.has(item.value);
          const isChecked = !this.filterSelections[dimension.id].has(item.value);
          const checkboxOption = document.createElement('div');
          checkboxOption.className = 'checkbox-option';
          checkboxOption.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; overflow: hidden;">
              <input type="checkbox" id="${dimension.id}_${safeId}" value="${item.value}" ${isChecked ? 'checked' : ''}>
              <span style="white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; ${isValid ? '' : 'color:#aaa;'}">
                ${item.label}
              </span>
            </label>
          `;
          const checkbox = checkboxOption.querySelector('input[type="checkbox"]');
          checkbox.addEventListener('change', (e) => {
            this.handleSimpleFilterCheckboxChange(dimension, item.value, e.target.checked);
          });
          checkboxList.appendChild(checkboxOption);

          // NE TOUCHEZ PLUS À filterSelections ICI !
          // On ne modifie plus filterSelections selon isValid
        });

        this.updateSelectionCount(dimension);
      }
    });
  }


  updateHierarchicalFiltersAfterApply(selectAllMode = false) {
    Object.values(this.filterMeta).forEach(dimension => {
      if (dimension.hierarchical) {
        const treeContainer = document.getElementById(`${dimension.id}TreeContainer`);
        if (!treeContainer) return;

        // Récupère tous les factIds présents dans filteredData pour ce dimension
        const validFactIds = new Set();
        this.state.filteredData.forEach(record => {
          const value = record[dimension.factField];
          if (value !== undefined && value !== null) {
            validFactIds.add(value);
          }
        });

        // Parcourt tous les checkboxes de la hiérarchie
        const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
          const checkboxId = checkbox.id;
          const nodeId = checkboxId.replace(`${dimension.id}_node_`, '');
          const node = this.state.hierarchies[dimension.dimensionKey]?.nodesMap?.[nodeId];
          let nodeFactIds = [];
          if (node) {
            if (node.isLeaf && node.factId) {
              nodeFactIds = Array.isArray(node.factId) ? node.factId : [node.factId];
            } else if (node.children && node.children.length > 0) {
              nodeFactIds = Array.from(this.collectLeafDescendantFactIds(node, this.state.hierarchies[dimension.dimensionKey].nodesMap));
            }
          }
          const hasValid = nodeFactIds.some(fid => validFactIds.has(fid));

          if (selectAllMode) {
            checkbox.checked = true;
            // Ne pas modifier filterSelections
          } else {
            checkbox.checked = !this.filterSelections[dimension.id].has(nodeId);
            // NE TOUCHEZ PLUS À filterSelections ICI !
          }
          // Ne jamais désactiver (si tu veux garder la possibilité de recocher)
          checkbox.disabled = false;
        });
        this.updateSelectionCount(dimension);
      }
    });
  }


  resetAllFilters() {
    Object.values(this.filterMeta).forEach(dimension => {
      this.filterSelections[dimension.id].clear();
    });
    this.applyAllFilters();
  }
}


// Initialize and export the filter system
const enhancedFilterSystem = new EnhancedFilterSystem();

// Use a polling mechanism to safely initialize when data is available
let maxInitAttempts = 300; // Will try for about 300 seconds
let initAttempts = 0;

function attemptInitialization() {
  initAttempts++;
  
  // Check if window.App exists and has data
  if (window.App && window.App.state && window.App.state.factData && window.App.state.factData.length > 0) {
    console.log("⏳ Status: Data detected, initializing filter system");
    enhancedFilterSystem.state = window.App.state;
    enhancedFilterSystem.initialize();
    return true;
  }
  
  // Check if window.appState exists directly
  if (window.appState && window.appState.factData && window.appState.factData.length > 0) {
    console.log("⏳ Status: AppState data detected, initializing filter system");
    enhancedFilterSystem.state = window.appState;
    enhancedFilterSystem.initialize();
    return true;
  }

  
  // If we've tried too many times, stop trying
  if (initAttempts >= maxInitAttempts) {
    console.warn("⚠️ Warning: Gave up waiting for data to initialize filter system");
    return false;
  }
  
  return false;
}


// Make it globally available
window.EnhancedFilterSystem = enhancedFilterSystem;


// Export function to initialize from other modules
export function initializeFilterSystem() {
  return attemptInitialization();
}


// Export the filter system
export default enhancedFilterSystem;