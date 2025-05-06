

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
          hierarchical: true
        },
        rootGmid: {
          id: 'rootGmid',
          label: 'Root GMID',
          dimensionKey: 'gmid_display',
          factField: 'ROOT_GMID',
          hierarchical: false
        },
        smartcode: {
          id: 'smartcode',
          label: 'Smartcode',
          dimensionKey: 'smartcode',
          factField: 'ROOT_SMARTCODE',
          hierarchical: false
        },
        costElement: {
          id: 'costElement',
          label: 'Cost Element',
          dimensionKey: 'cost_element',
          factField: 'COST_ELEMENT',
          hierarchical: true
        },
        businessYear: {
          id: 'businessYear',
          label: 'Business Year',
          dimensionKey: 'year',
          factField: 'ZYEAR',
          hierarchical: false
        },
        itemCostType: {
          id: 'itemCostType',
          label: 'Item Cost Type',
          dimensionKey: 'item_cost_type',
          factField: 'ITEM_COST_TYPE',
          hierarchical: false
        },
        materialType: {
          id: 'materialType',
          label: 'Material Type',
          dimensionKey: 'material_type',
          factField: 'COMPONENT_MATERIAL_TYPE',
          hierarchical: false
        },
        managementCentre: {
          id: 'managementCentre',
          label: 'MGT Centre',
          dimensionKey: 'mc',
          factField: 'MC',
          hierarchical: true
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
      console.log('Initializing Enhanced Filter System...');
      
      // Make sure we have a valid state reference
      if (!this.state) {
        console.log('No state reference, cannot initialize filters');
        return false;
      }
      
      // Make sure data is loaded
      if (!this.state.factData || !this.state.dimensions) {
        console.log('Data not loaded yet, cannot initialize filters');
        return false;
      }
      
      this.createFilterComponents();
      this.setupFilterEvents();
      this.setupApplyButton();
      this.populateFilters();
      
      console.log('Enhanced Filter System initialized successfully');
      return true;
    }
    
    /**
     * Create filter components container structure
     */
    createFilterComponents() {
      // Get the filter content container
      const filterContent = this.elements.filterContent;
      if (!filterContent) {
        console.error("Filter content container not found");
        return;
      }
      
      // Clear existing content
      filterContent.innerHTML = '';
      
      // Create filter components container (grid layout)
      const filterComponentsContainer = document.createElement('div');
      filterComponentsContainer.id = 'filterComponentsContainer';
      filterComponentsContainer.className = 'filter-components-container';
      filterComponentsContainer.style.display = 'grid';
      filterComponentsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
      filterComponentsContainer.style.gap = '16px';
      filterComponentsContainer.style.marginBottom = '10px';
      filterContent.appendChild(filterComponentsContainer);
      
      // Store reference to the container
      this.elements.filterComponentsContainer = filterComponentsContainer;
      
      // Create each dimension filter
      Object.values(this.filterMeta).forEach(dimension => {
        this.createFilterComponent(filterComponentsContainer, dimension);
      });
      
      // Add Apply Filters button at the bottom
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
      
      // Store reference to apply button
      this.elements.applyFiltersBtn = applyButton;
      
      // Add data volume indicator
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
      dataText.textContent = 'All records available for processing';
      
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
      // Create the filter component wrapper
      const filterComponent = document.createElement('div');
      filterComponent.className = 'filter-component';
      filterComponent.id = `${dimension.id}FilterComponent`;
      filterComponent.style.marginBottom = '16px';
      
      // Create the filter header with label above the dropdown
      const filterHeader = document.createElement('div');
      filterHeader.className = 'filter-component-header';
      filterHeader.style.display = 'flex';
      filterHeader.style.justifyContent = 'space-between';
      filterHeader.style.alignItems = 'center';
      filterHeader.style.marginBottom = '8px';
      
      // Add label and selection count
      filterHeader.innerHTML = `
        <span class="filter-component-label" style="font-weight: 600; color: #1e293b;">${dimension.label}</span>
        <span class="selection-count" id="${dimension.id}SelectionCount" 
              style="font-size: 0.75rem; color: #64748b; background-color: #f8fafc; 
                     padding: 2px 6px; border-radius: 10px;">All selected</span>
      `;
      
      // Create the dropdown container
      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'multiselect-dropdown';
      dropdownContainer.id = `${dimension.id}Dropdown`;
      dropdownContainer.style.position = 'relative';
      dropdownContainer.style.width = '100%';
      
      // Create the dropdown button
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
      
      // Customize button text based on dimension
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
      dropdownContent.style.width = '350px'; // Increased width
      dropdownContent.style.maxWidth = '90vw'; // Prevent going off screen
      dropdownContent.style.backgroundColor = 'white';
      dropdownContent.style.border = '1px solid #cbd5e1';
      dropdownContent.style.borderRadius = '0.25rem';
      dropdownContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)';
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
      checkboxContainer.style.maxHeight = '50vh'; // Use viewport height instead of fixed pixels
      checkboxContainer.style.overflowY = 'auto';
      checkboxContainer.style.padding = '8px';
      checkboxContainer.style.width = '100%';
      
      // For hierarchical filters, add special container
      if (dimension.hierarchical) {
        const treeContainer = document.createElement('div');
        treeContainer.className = 'filter-tree-container';
        treeContainer.id = `${dimension.id}TreeContainer`;
        
        // Add loading indicator initially
        treeContainer.innerHTML = `
          <div class="loading-tree-indicator">
            <i class="fas fa-circle-notch fa-spin"></i> Loading hierarchy...
          </div>
        `;
        
        checkboxContainer.appendChild(treeContainer);
      } else {
        // Add checkbox list for non-hierarchical filters
        const checkboxList = document.createElement('div');
        checkboxList.className = 'checkbox-list';
        checkboxList.id = `${dimension.id}CheckboxList`;
        
        // Add loading indicator initially
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
      }
      
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
    }
  
    /**
     * Setup event handlers for all filter components
     */
    setupFilterEvents() {
      // Set up events for each filter dropdown
      Object.values(this.filterMeta).forEach(dimension => {
        this.setupFilterComponentEvents(dimension);
      });
      
      // Global click handler to close dropdowns when clicking outside
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
      
      // Get elements
      const dropdownButton = dropdownContainer.querySelector('.multiselect-button');
      const dropdownContent = dropdownContainer.querySelector('.multiselect-dropdown-content');
      const searchInput = dropdownContainer.querySelector('.search-input');
      const selectAllBtn = document.getElementById(`${dimensionId}SelectAll`);
      const clearAllBtn = document.getElementById(`${dimensionId}ClearAll`);
      
      // Store initial open state
      this.openDropdowns[dimensionId] = false;
      
      // Toggle dropdown
      dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close all other dropdowns
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
          
          // Focus search input
          if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
          }
        }
      });
      
      // Prevent dropdown from closing when clicking inside
      dropdownContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // Add search functionality
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.handleFilterSearch(dimension, e.target.value);
        });
      }
      
      // Add select all functionality
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          this.selectAllInFilter(dimension);
        });
      }
      
      // Add clear all functionality
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
     * Populate all filter components with data from dimensions
     */
    populateFilters() {
      console.log('Populating filter components with data...');
      
      // Get state reference if not already available
      if (!this.state) {
        this.state = window.App ? window.App.state : window.appState;
        
        // If still not available, wait and retry
        if (!this.state) {
          console.log('State not yet available, waiting...');
          setTimeout(() => this.populateFilters(), 500);
          return;
        }
      }
      
      // Wait for data to be loaded
      if (!this.state.factData || !this.state.dimensions) {
        console.log('Waiting for BOM data to be loaded...', window.App ? 'App is available' : 'No App object');
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
    }
    
    /**
     * Populate a hierarchical filter with data from the corresponding hierarchy
     * @param {Object} dimension - Dimension configuration
     */
    populateHierarchicalFilter(dimension) {
      console.log(`Populating hierarchical filter for ${dimension.label}...`);
      
      const treeContainer = document.getElementById(`${dimension.id}TreeContainer`);
      if (!treeContainer) {
        console.warn(`Tree container for ${dimension.id} not found`);
        return;
      }
      
      // Get hierarchy from state
      const hierarchy = this.state.hierarchies[dimension.dimensionKey];
      if (!hierarchy || !hierarchy.root) {
        treeContainer.innerHTML = `<div class="empty-tree-message">No hierarchy data available</div>`;
        return;
      }
      
      // Clear container
      treeContainer.innerHTML = '';
      
      // Add 'Select All' option at the top
      const selectAllOption = document.createElement('div');
      selectAllOption.className = 'filter-all-option';
      selectAllOption.innerHTML = `
        <input type="checkbox" id="${dimension.id}SelectAllCheckbox" checked>
        <label for="${dimension.id}SelectAllCheckbox">Select All</label>
      `;
      treeContainer.appendChild(selectAllOption);
      
      // Add separator
      const separator = document.createElement('div');
      separator.className = 'filter-separator';
      treeContainer.appendChild(separator);
      
      // Create tree nodes container
      const treeNodes = document.createElement('div');
      treeNodes.className = 'filter-tree-nodes';
      treeContainer.appendChild(treeNodes);
      
      // Render root node and its children
      this.renderHierarchyNode(treeNodes, hierarchy.root, dimension, 0);
      
      // Set up select all checkbox
      const selectAllCheckbox = document.getElementById(`${dimension.id}SelectAllCheckbox`);
      if (selectAllCheckbox) {
        // Initialize state
        this.expandedFilterNodes[dimension.id] = { 'ROOT': true };
        
        selectAllCheckbox.addEventListener('change', (e) => {
          const checked = e.target.checked;
          
          // Update all checkboxes in the tree
          const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            if (checkbox !== selectAllCheckbox) {
              checkbox.checked = checked;
            }
          });
          
          // Update filter selections
          if (checked) {
            // Select all by clearing the selections (empty means all selected)
            this.filterSelections[dimension.id] = new Set();
          } else {
            // Deselect all by collecting all node IDs
            this.filterSelections[dimension.id] = new Set();
            this.collectAllNodeIds(hierarchy.root, dimension).forEach(id => {
              this.filterSelections[dimension.id].add(id);
            });
          }
          
          // Update the selection count
          this.updateSelectionCount(dimension);
        });
      }
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
      
      // Create node container
      const nodeContainer = document.createElement('div');
      nodeContainer.className = 'filter-tree-node';
      nodeContainer.dataset.nodeId = node.id;
      nodeContainer.dataset.level = level;
      
      // Create node item with checkbox
      const nodeItem = document.createElement('div');
      nodeItem.className = 'filter-tree-item';
      nodeItem.style.marginLeft = `${level * 16}px`;
      
      // Determine if node has children
      const hasChildren = node.children && node.children.length > 0;
      
      // Create expand/collapse control for parent nodes
      let expandControl = null;
      if (hasChildren) {
        expandControl = document.createElement('span');
        expandControl.className = `expand-collapse ${this.expandedFilterNodes[dimension.id][node.id] ? 'expanded' : 'collapsed'}`;
        
        // Add event listener for expand/collapse
        expandControl.addEventListener('click', () => {
          this.toggleFilterNodeExpansion(dimension, node, nodeContainer);
        });
      } else {
        // Leaf node indicator
        expandControl = document.createElement('span');
        expandControl.className = 'leaf-node';
      }
      
      // Create checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `${dimension.id}_node_${node.id}`;
      checkbox.checked = !this.filterSelections[dimension.id].has(node.id);
      
      // Add event listener for checkbox
      checkbox.addEventListener('change', (e) => {
        this.handleFilterNodeCheckboxChange(dimension, node, e.target.checked);
      });
      
      // Create label
      const label = document.createElement('label');
      label.className = 'filter-tree-label';
      label.htmlFor = checkbox.id;
      label.textContent = node.label || node.id;
      
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
          // Get child node
          const childNode = typeof childId === 'string' ? 
            this.state.hierarchies[dimension.dimensionKey].nodesMap[childId] : childId;
          
          if (childNode) {
            this.renderHierarchyNode(childrenContainer, childNode, dimension, level + 1);
          }
        });
        
        nodeContainer.appendChild(childrenContainer);
      }
      
      // Add to container
      container.appendChild(nodeContainer);
    }
    
    /**
     * Toggle expansion of a hierarchical filter node
     * @param {Object} dimension - Dimension configuration
     * @param {Object} node - Hierarchy node
     * @param {HTMLElement} nodeContainer - Node container element
     */
    toggleFilterNodeExpansion(dimension, node, nodeContainer) {
      // Toggle expanded state
      const expanded = !this.expandedFilterNodes[dimension.id][node.id];
      this.expandedFilterNodes[dimension.id][node.id] = expanded;
      
      // Update UI
      const expandControl = nodeContainer.querySelector('.expand-collapse');
      if (expandControl) {
        expandControl.className = `expand-collapse ${expanded ? 'expanded' : 'collapsed'}`;
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
      
      // Update selection set based on checked state
      if (checked) {
        // Remove from excluded set
        this.filterSelections[dimension.id].delete(node.id);
      } else {
        // Add to excluded set
        this.filterSelections[dimension.id].add(node.id);
      }
      
      // Update child checkboxes if any
      if (node.children && node.children.length > 0) {
        // Get container
        const nodeContainer = document.querySelector(`.filter-tree-node[data-node-id="${node.id}"]`);
        if (nodeContainer) {
          const childCheckboxes = nodeContainer.querySelectorAll('.filter-tree-children input[type="checkbox"]');
          childCheckboxes.forEach(checkbox => {
            checkbox.checked = checked;
            
            // Get node ID from checkbox ID
            const checkboxId = checkbox.id;
            const nodeId = checkboxId.replace(`${dimension.id}_node_`, '');
            
            // Update selection state
            if (checked) {
              this.filterSelections[dimension.id].delete(nodeId);
            } else {
              this.filterSelections[dimension.id].add(nodeId);
            }
          });
        }
      }
      
      // Update the selection count
      this.updateSelectionCount(dimension);
      
      // Update "Select All" checkbox
      this.updateSelectAllCheckbox(dimension);
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
      console.log(`Populating simple filter for ${dimension.label}...`);
      
      const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
      if (!checkboxList) {
        console.warn(`Checkbox list for ${dimension.id} not found`);
        return;
      }
      
      // Clear container
      checkboxList.innerHTML = '';
      
      // Extract unique values from dimension or fact data
      const uniqueValues = this.getUniqueValuesForDimension(dimension);
      
      if (uniqueValues.length === 0) {
        checkboxList.innerHTML = `<div class="no-values-message">No values available</div>`;
        return;
      }
      
      // Sort values alphabetically
      uniqueValues.sort((a, b) => {
        const textA = a.label.toString().toLowerCase();
        const textB = b.label.toString().toLowerCase();
        return textA.localeCompare(textB);
      });
      
      // Create checkbox for each value
      uniqueValues.forEach(item => {
        const checkboxOption = document.createElement('div');
        checkboxOption.className = 'checkbox-option';
        
        // Sanitize ID by removing special characters
        const safeId = (item.id || item.value).toString().replace(/[^a-zA-Z0-9]/g, '_');
        
        checkboxOption.innerHTML = `
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; overflow: hidden;">
            <input type="checkbox" id="${dimension.id}_${safeId}" value="${item.value}" checked>
            <span style="white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
              ${item.label}
            </span>
          </label>
        `;
        
        // Add event listener for checkbox
        const checkbox = checkboxOption.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
          this.handleSimpleFilterCheckboxChange(dimension, item.value, e.target.checked);
        });
        
        checkboxList.appendChild(checkboxOption);
      });
      
      // Initialize state
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
          // Extract from gmid_display dimension
          if (this.state.dimensions.gmid_display) {
            this.state.dimensions.gmid_display.forEach(item => {
              if (item.ROOT_GMID && !valueSet.has(item.ROOT_GMID)) {
                valueSet.add(item.ROOT_GMID);
                labelMap.set(item.ROOT_GMID, item.ROOT_GMID);
              }
            });
          }
          break;
          
        case 'smartcode':
          // Extract from smartcode dimension
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
          // Extract from year dimension
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
          // Extract from item_cost_type dimension
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
          // Extract from material_type dimension
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
          // If no dimension data is available, extract from fact data
          if (this.state.factData && this.state.factData.length > 0 && dimension.factField) {
            // For large datasets, limit the number of records to check
            const sampleSize = Math.min(10000, this.state.factData.length);
            const sampleData = this.state.factData.slice(0, sampleSize);
            
            sampleData.forEach(record => {
              if (record[dimension.factField] !== undefined && record[dimension.factField] !== null) {
                valueSet.add(record[dimension.factField]);
              }
            });
            
            valueSet.forEach(value => {
              labelMap.set(value, value.toString());
            });
          }
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
      // Update selection set based on checked state
      if (checked) {
        // Remove from excluded set
        this.filterSelections[dimension.id].delete(value);
      } else {
        // Add to excluded set
        this.filterSelections[dimension.id].add(value);
      }
      
      // Update the selection count
      this.updateSelectionCount(dimension);
      
      // Update "Select All" checkbox
      this.updateSelectAllCheckbox(dimension);
    }
    
    /**
     * Update the selection count display for a filter
     * @param {Object} dimension - Dimension configuration
     */
    updateSelectionCount(dimension) {
      const countElement = document.getElementById(`${dimension.id}SelectionCount`);
      if (!countElement) return;
      
      // Get the number of selected items
      let selectedCount = 0;
      let totalCount = 0;
      
      if (dimension.hierarchical) {
        // For hierarchical dimensions, count from the tree
        const hierarchy = this.state.hierarchies[dimension.dimensionKey];
        if (hierarchy) {
          totalCount = this.countTotalNodes(hierarchy.root);
          selectedCount = totalCount - this.filterSelections[dimension.id].size;
        }
      } else {
        // For simple dimensions, count from the checkbox list
        const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
        if (checkboxList) {
          const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
          totalCount = checkboxes.length;
          selectedCount = totalCount - this.filterSelections[dimension.id].size;
        }
      }
      
      // Update the display
      if (selectedCount === totalCount) {
        countElement.textContent = 'All selected';
      } else {
        countElement.textContent = `${selectedCount} / ${totalCount}`;
      }
      
      // Update selection text in dropdown button
      const selectionText = document.querySelector(`#${dimension.id}Dropdown .selection-text`);
      if (selectionText) {
        if (selectedCount === totalCount) {
          selectionText.textContent = `All ${dimension.label}s`;
        } else if (selectedCount === 0) {
          selectionText.textContent = 'None selected';
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
      
      if (dimension.hierarchical) {
        // For hierarchical filters, search the tree
        const treeNodes = document.querySelectorAll(`#${dimension.id}TreeContainer .filter-tree-node`);
        
        treeNodes.forEach(node => {
          const label = node.querySelector('.filter-tree-label');
          if (label) {
            const text = label.textContent.toLowerCase();
            const match = text.includes(searchLower);
            
            // Show/hide based on match
            node.style.display = match ? '' : 'none';
            
            // If this is a parent node, show it and its children if it matches
            if (match) {
              // Expand parent nodes to show matching children
              let parent = node.parentElement;
              while (parent && parent.classList.contains('filter-tree-children')) {
                parent.style.display = 'block';
                
                // Get parent node
                const parentNode = parent.parentElement;
                if (parentNode && parentNode.classList.contains('filter-tree-node')) {
                  parentNode.style.display = '';
                  
                  // Update expand/collapse control
                  const expandControl = parentNode.querySelector('.expand-collapse');
                  if (expandControl) {
                    expandControl.className = 'expand-collapse expanded';
                  }
                }
                
                parent = parent.parentElement ? parent.parentElement.parentElement : null;
              }
            }
          }
        });
      } else {
        // For simple filters, search the checkbox list
        const checkboxOptions = document.querySelectorAll(`#${dimension.id}CheckboxList .checkbox-option`);
        
        checkboxOptions.forEach(option => {
          const label = option.querySelector('label');
          if (label) {
            const text = label.textContent.toLowerCase();
            const match = text.includes(searchLower);
            
            // Show/hide based on match
            option.style.display = match ? '' : 'none';
          }
        });
      }
    }
    
    /**
     * Select all items in a filter
     * @param {Object} dimension - Dimension configuration
     */
    selectAllInFilter(dimension) {
      if (dimension.hierarchical) {
        // For hierarchical filters, select all in the tree
        const treeContainer = document.getElementById(`${dimension.id}TreeContainer`);
        if (treeContainer) {
          const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.checked = true;
          });
        }
        
        // Clear selection set (empty means all selected)
        this.filterSelections[dimension.id] = new Set();
      } else {
        // For simple filters, select all in the checkbox list
        const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
        if (checkboxList) {
          const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.checked = true;
          });
        }
        
        // Clear selection set (empty means all selected)
        this.filterSelections[dimension.id] = new Set();
      }
      
      // Update the selection count
      this.updateSelectionCount(dimension);
      
      // Update "Select All" checkbox
      this.updateSelectAllCheckbox(dimension);
    }
    
    /**
     * Clear all selections in a filter
     * @param {Object} dimension - Dimension configuration
     */
    clearAllInFilter(dimension) {
      if (dimension.hierarchical) {
        // For hierarchical filters, deselect all in the tree
        const treeContainer = document.getElementById(`${dimension.id}TreeContainer`);
        if (treeContainer) {
          const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            
            // Get node ID from checkbox ID
            const checkboxId = checkbox.id;
            if (checkboxId.startsWith(`${dimension.id}_node_`)) {
              const nodeId = checkboxId.replace(`${dimension.id}_node_`, '');
              this.filterSelections[dimension.id].add(nodeId);
            }
          });
        }
      } else {
        // For simple filters, deselect all in the checkbox list
        const checkboxList = document.getElementById(`${dimension.id}CheckboxList`);
        if (checkboxList) {
          const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            this.filterSelections[dimension.id].add(checkbox.value);
          });
        }
      }
      
      // Update the selection count
      this.updateSelectionCount(dimension);
      
      // Update "Select All" checkbox
      this.updateSelectAllCheckbox(dimension);
    }


    /**
     * Builds a filtered GMID display hierarchy based on selected ROOT_GMIDs
     * @param {Array} data - The GMID display dimension data
     * @param {Array} selectedRootGmids - Array of selected ROOT_GMID values
     * @returns {Object} - Hierarchy object with root, nodesMap and original data
     */
    buildFilteredGmidDisplayHierarchy = function(data, selectedRootGmids = null) {
      console.log(`Building GMID display hierarchy${selectedRootGmids ? ' with ROOT_GMID filtering' : ''}...`);
      
      // Check if we should apply ROOT_GMID filtering
      const applyRootGmidFilter = selectedRootGmids && 
                                  Array.isArray(selectedRootGmids) && 
                                  selectedRootGmids.length > 0;
      
      if (applyRootGmidFilter) {
        console.log(`Filtering GMID hierarchy to include only ${selectedRootGmids.length} selected ROOT_GMIDs`);
        
        // Filter the dimension data to only include records with selected ROOT_GMIDs
        data = data.filter(item => item.ROOT_GMID && selectedRootGmids.includes(item.ROOT_GMID));
        
        console.log(`Filtered to ${data.length} GMID dimension records`);
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
        
        // Determine the GMID for this row
        let gmid;
        if (pathSegments[pathSegments.length - 1] === '#') {
          // When leaf segment is '#', use the entire PATH_GMID as COMPONENT_GMID
          gmid = item.PATH_GMID;
        } else {
          // Otherwise, use the COMPONENT_GMID value
          gmid = item.COMPONENT_GMID || "Unknown GMID";
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
          // Using the path segment as part of the ID ensures uniqueness
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
              label: displaySegment.trim(),  // Using the DISPLAY segment as the label
              levelNum: i + 1,
              levelValue: pathSegment.trim(),  // Store the PATH_GMID segment for reference
              children: [],
              level: i + 1,
              path: [...currentPath, nodeId],
              expanded: i < 2, // Auto-expand first two levels
              isLeaf: isLastLevel,
              hasChildren: false,
              // Store ROOT_GMID for filtering
              rootGmid: item.ROOT_GMID,
              // If this is the last level, associate with the GMID for filtering
              factId: isLastLevel ? gmid : null
            };
            
            nodesMap[nodeId] = newNode;
            
            // Add to parent's children
            currentNode.children.push(newNode);
            currentNode.isLeaf = false;
            currentNode.hasChildren = true;
          } else if (i === maxLevel - 1 && currentNode.id === nodesMap[nodeId].path[nodesMap[nodeId].path.length - 2]) {
            // If this node already exists but is now a leaf at this level under the same parent,
            // we need to handle potential multiple GMIDs mapping to the same node
            const existingNode = nodesMap[nodeId];
            
            // If the node doesn't already have a factId, set it
            if (!existingNode.factId) {
              existingNode.factId = gmid;
              existingNode.isLeaf = true;
            } 
            // If it already has a factId but this is a different GMID,
            // we need to track both GMIDs
            else if (existingNode.factId !== gmid) {
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
      console.log("Nodes created per level:", levelCounts);
      console.log("Total nodes in hierarchy:", Object.keys(nodesMap).length);
      
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
     * Apply all filters to the data
     */
    applyAllFilters(){
      console.log('Applying all filters...');
      console.time('ApplyFilters');
      
      // Store original data reference
      const originalData = this.state.factData;
      this.perfTracking.recordsBeforeFilter = originalData.length;
      
      // FIRST: Store original GMID hierarchy if we haven't already
      if (!this.state._originalGmidHierarchy && this.state.hierarchies.gmid_display) {
        this.state._originalGmidHierarchy = this.state.hierarchies.gmid_display;
      }
      
      // SECOND: Rebuild GMID hierarchy based on ROOT_GMID filter
      this.rebuildGmidHierarchyWithFilters();
      
      // THIRD: Start with all data for filtering
      let filteredData = [...originalData];
      
      // Track filter reductions
      const filterReductions = {};
      
      // Apply each filter
      Object.values(this.filterMeta).forEach(dimension => {
        const beforeCount = filteredData.length;
        filteredData = this.applyFilter(filteredData, dimension);
        const afterCount = filteredData.length;
        
        // Record the reduction for this filter
        filterReductions[dimension.label] = beforeCount - afterCount;
      });
      
      // Store filtered data
      this.state.filteredData = filteredData;
      this.perfTracking.recordsAfterFilter = filteredData.length;
      
      // Update UI
      this.updateDataVolumeIndicator(originalData.length, filteredData.length);
      this.updateFilteredRecordsCount(filteredData.length);
      
      // Log filter performance details
      console.log(`Filtering complete: ${originalData.length} -> ${filteredData.length} records (${((filteredData.length / originalData.length) * 100).toFixed(2)}%)`);
      console.log('Filter reductions:', filterReductions);
      console.timeEnd('ApplyFilters');
      
      // Refresh pivot table
      this.refreshPivotTable();
    }


    /**
     * Modify the EnhancedFilterSystem to rebuild GMID hierarchy when filters change
     * Add this method to your EnhancedFilterSystem class
     */
    rebuildGmidHierarchyWithFilters() {
      console.log("Rebuilding GMID display hierarchy based on filters...");
      
      // 1. Get the current ROOT_GMID filter selections
      const rootGmidFilter = this.filterSelections.rootGmid;
      
      // 2. Get all available ROOT_GMIDs
      const allRootGmids = [];
      if (this.state.dimensions && this.state.dimensions.gmid_display) {
        this.state.dimensions.gmid_display.forEach(item => {
          if (item.ROOT_GMID && !allRootGmids.includes(item.ROOT_GMID)) {
            allRootGmids.push(item.ROOT_GMID);
          }
        });
      }
      
      // 3. Determine selected ROOT_GMIDs (empty set means all selected)
      let selectedRootGmids = [];
      if (rootGmidFilter && rootGmidFilter.size > 0) {
        // We store excluded GMIDs, so we need to invert the selection
        selectedRootGmids = allRootGmids.filter(gmid => !rootGmidFilter.has(gmid));
      } else {
        // All ROOT_GMIDs are selected
        selectedRootGmids = [...allRootGmids];
      }
      
      console.log(`Selected ROOT_GMIDs: ${selectedRootGmids.length} of ${allRootGmids.length}`);
      
      // 4. Only rebuild if we're filtering (otherwise use the original hierarchy)
      if (selectedRootGmids.length < allRootGmids.length) {
        // Get the original dimension data
        const originalDimData = this.state.dimensions.gmid_display;
        
        // Build the filtered hierarchy
        const filteredHierarchy = this.buildFilteredGmidDisplayHierarchy(originalDimData, selectedRootGmids);
        
        // Store in state
        this.state.hierarchies.gmid_display = filteredHierarchy;
        
        console.log(`Rebuilt GMID hierarchy with ${selectedRootGmids.length} ROOT_GMIDs`);
        return true;
      } else {
        console.log("All ROOT_GMIDs selected, no need to rebuild hierarchy");
        
        // Restore original hierarchy if we previously filtered
        if (this.state._originalGmidHierarchy) {
          this.state.hierarchies.gmid_display = this.state._originalGmidHierarchy;
          console.log("Restored original GMID hierarchy");
        }
        
        return false;
      }
    }

    
    /**
     * Apply a specific filter to the data
     * @param {Array} data - Data to filter
     * @param {Object} dimension - Dimension configuration
     * @returns {Array} - Filtered data
     */
    applyFilter(data, dimension) {
      // Skip if no selections (all selected)
      if (this.filterSelections[dimension.id].size === 0) {
        return data;
      }
      
      console.log(`Applying ${dimension.label} filter (${this.filterSelections[dimension.id].size} excluded)...`);
      
      const startTime = performance.now();
      let filteredData;
      
      if (dimension.hierarchical) {
        // For hierarchical dimensions, use hierarchy-aware filtering
        filteredData = this.applyHierarchicalFilter(data, dimension);
      } else {
        // For simple dimensions, filter by field value
        filteredData = data.filter(record => {
          const value = record[dimension.factField];
          return value !== undefined && !this.filterSelections[dimension.id].has(value);
        });
      }
      
      const endTime = performance.now();
      console.log(`${dimension.label} filter applied in ${(endTime - startTime).toFixed(2)}ms: ${data.length} -> ${filteredData.length} records`);
      
      return filteredData;
    }
    
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
        console.warn(`Hierarchy not found for ${dimension.label}, falling back to direct filtering`);
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
            excludedFactIds.add(node.factId);
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
      
      console.log(`Collected ${excludedFactIds.size} excluded factIds for ${dimension.label}`);
      
      // If we have no excluded factIds and no selected nodes, everything is selected
      if (excludedFactIds.size === 0 && this.filterSelections[dimension.id].size === 0) {
        return data;
      }
      
      // Filter data
      return data.filter(record => {
        const value = record[dimension.factField];
        return value !== undefined && !excludedFactIds.has(value);
      });
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
        // Calculate percentage
        const percentage = totalCount > 0 ? (filteredCount / totalCount) * 100 : 0;
        
        // Update progress bar
        progressBar.style.width = `${percentage}%`;
        
        // Update color based on percentage
        if (percentage < 10) {
          progressBar.style.backgroundColor = '#ef4444'; // Red for very small subset
        } else if (percentage < 30) {
          progressBar.style.backgroundColor = '#f59e0b'; // Orange for small subset
        } else if (percentage < 60) {
          progressBar.style.backgroundColor = '#10b981'; // Green for medium subset
        } else {
          progressBar.style.backgroundColor = '#2563eb'; // Blue for large subset
        }
        
        // Update text
        dataText.innerHTML = `${this.formatNumber(filteredCount)} of ${this.formatNumber(totalCount)} records (${percentage.toFixed(1)}%)`;
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
      console.log('Refreshing pivot table with filtered data...');
      
      // Check if we have a pivot table generation function
      if (window.App && window.App.pivotTable && window.App.pivotTable.generatePivotTable) {
        window.App.pivotTable.generatePivotTable();
        console.log('Pivot table refreshed');
      } else if (window.generatePivotTable) {
        window.generatePivotTable();
        console.log('Pivot table refreshed');
      } else {
        console.warn('Pivot table refresh function not found');
      }
    }
  }
  
  // Initialize and export the filter system
  const enhancedFilterSystem = new EnhancedFilterSystem();
  
  // Use a polling mechanism to safely initialize when data is available
  let maxInitAttempts = 180; // Will try for about 180 seconds
  let initAttempts = 0;
  
  function attemptInitialization() {
    initAttempts++;
    
    // Check if window.App exists and has data
    if (window.App && window.App.state && window.App.state.factData && window.App.state.factData.length > 0) {
      console.log("Data detected, initializing filter system");
      enhancedFilterSystem.state = window.App.state;
      enhancedFilterSystem.initialize();
      return true;
    }
    
    // Check if window.appState exists directly
    if (window.appState && window.appState.factData && window.appState.factData.length > 0) {
      console.log("appState data detected, initializing filter system");
      enhancedFilterSystem.state = window.appState;
      enhancedFilterSystem.initialize();
      return true;
    }
    
    // If we've tried too many times, stop trying
    if (initAttempts >= maxInitAttempts) {
      console.warn("Gave up waiting for data to initialize filter system");
      return false;
    }
    
    // Try again in 1 second
    console.log(`Waiting for BOM data to be available... (attempt ${initAttempts})`);
    setTimeout(attemptInitialization, 1000);
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