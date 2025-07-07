/**
 * PIVOT TABLE TEMPLATE SYSTEM
 * Creates separate rendering templates based on dimension combinations
 */

import pivotTable from './pivot-table.js';
import data from './data.js';

/**
 * Template detection and routing system
 */
const PivotTemplateSystem = {
   
    /**
     * Determine which template to use based on dimensions
     */
    getTemplateType: function(rowFields, columnFields, valueFields) {
        const rowCount = (rowFields || []).length;
        const columnCount = (columnFields || []).length;
        const valueCount = (valueFields || []).length;
        
        console.log(`🎯 Template Detection: ${rowCount} rows × ${columnCount} columns × ${valueCount} values`);
        
        // Must have at least 1 value field
        if (valueCount === 0) {
            console.warn("⚠️ No value fields - using Template1 as fallback");
            return 'template1';
        }
        
        // Template routing logic
        if (rowCount === 1 && columnCount === 0) {
            return 'template1'; // 1 row + 0 column + values
        } else if (rowCount >= 2 && columnCount === 0) {
            return 'template2'; // 2+ rows + 0 column + values
        } else if (rowCount === 1 && columnCount === 1) {
            return 'template3'; // 1 row + 1 column + values
        } else if (rowCount >= 2 && columnCount === 1) {
            return 'template4'; // 2+ rows + 1 column + values
        } else if (rowCount >= 2 && columnCount >= 2) {
            return 'template5'; // 2+ rows + 2+ columns + values
        } else if (rowCount === 1 && columnCount >= 2) {
            return 'template6'; // 1 row + 2+ columns + values
        }
        
        // Fallback
        console.warn(`⚠️ Unknown dimension combination: ${rowCount}×${columnCount}×${valueCount} - using Template1`);
        return 'template1';
    },

    
    /**
     * Main template renderer - routes to appropriate template
     */
    renderTemplate: function(templateType, elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Rendering ${templateType.toUpperCase()}`);
        
        // Apply template-specific CSS class
        this.applyTemplateCSS(templateType, elements);
        
        switch (templateType) {
            case 'template1':
                return this.renderTemplate1(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            case 'template2':
                return this.renderTemplate2(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            case 'template3':
                return this.renderTemplate3(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            case 'template4':
                return this.renderTemplate4(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            case 'template5':
                return this.renderTemplate5(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            case 'template6':
                return this.renderTemplate6(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
            default:
                console.error(`❌ Unknown template: ${templateType}`);
                return this.renderTemplate1(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        }
    },


    /**
     * Template-specific row cell renderers
     */
    renderTemplate1RowCell: function(row, field) {
        const level = row.level || 0;
        const indentationPx = 4 + (level * 30);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t1-hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${this.getDisplayLabel(row)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    renderTemplate2DimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t2-dimension-cell dimension-${dimIndex} empty">-</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t2-dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (this.nodeHasChildren(node)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${this.getDisplayLabel(node)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    renderTemplate3RowCell: function(row, field) {
        const level = row.level || 0;
        const indentationPx = 4 + (level * 30);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t3-hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${pivotTable.getDisplayLabel(row)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    renderTemplate4DimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t4-dimension-cell dimension-${dimIndex} empty">-</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t4-dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (this.nodeHasChildren(node)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${this.getDisplayLabel(node)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    renderTemplate5DimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t5-dimension-cell dimension-${dimIndex} empty">-</td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t5-dimension-cell dimension-${dimIndex}" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (this.nodeHasChildren(node)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${this.getDisplayLabel(node)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },
    

    renderTemplate6RowCell: function(row, field) {
        const level = row.level || 0;
        const indentationPx = 4 + (level * 30);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t6-hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${this.getDisplayLabel(row)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },


    getRealDimensionName: function(field) {
        // Add null/undefined check first
        if (!field) {
            console.warn('⚠️ getRealDimensionName called with undefined/null field');
            return 'Unknown Dimension';
        }
        
        // Handle both string and object field types
        let dimName = field;
        if (typeof field === 'object' && field.name) {
            dimName = field.name;
        } else if (typeof field === 'object' && field.field) {
            dimName = field.field;
        } else if (typeof field !== 'string') {
            console.warn('⚠️ getRealDimensionName: unexpected field type', typeof field, field);
            return 'Unknown Dimension';
        }
        
        // Remove DIM_ prefix and convert to proper display name
        if (dimName.startsWith('DIM_')) {
            dimName = dimName.replace(/^DIM_/, '');
        }
        dimName = dimName.toLowerCase();
        
        // Map dimension names to display names
        const displayNames = {
            'le': 'Legal Entity',
            'cost_element': 'Cost Element',
            'material_type': 'Material Type',
            'item_cost_type': 'Item Cost Type',
            'gmid_display': 'GMID Display',
            'root_gmid_display': 'ROOT GMID',
            'smartcode': 'Smart Code',
            'mc': 'Management Center',
            'year': 'Business Year'
        };
        
        return displayNames[dimName] || 
            dimName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    
    /**
     * Apply template-specific CSS classes
     */
    applyTemplateCSS: function(templateType, elements) {
        const container = elements.pivotTableHeader?.closest('.pivot-table-container');
        if (!container) return;
        
        // Remove all existing template classes
        container.classList.remove(
            'template1', 'template2', 'template3', 
            'template4', 'template5', 'template6'
        );
        
        // Add current template class
        container.classList.add(templateType);
        
        console.log(`🎨 Applied ${templateType} CSS class`);
    },

    
    /**
     * TEMPLATE 1: 1 row + 0 column + values
     * Simple hierarchy with value columns
     */
    renderTemplate1: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template1: Single row dimension with values`);
        
        this.renderTemplate1Header(elements, rowFields, valueFields, pivotTable);
        this.renderTemplate1Body(elements, pivotData, rowFields, valueFields, pivotTable);
    },

    
    renderTemplate1Header: function(elements, rowFields, valueFields, pivotTable) {
        let headerHtml = '<tr>';
        
        // Single row dimension header
        const rowDimName = this.getRealDimensionName(rowFields[0]);
        headerHtml += `<th class="t1-row-header">${rowDimName}</th>`;
        
        // Value headers
        valueFields.forEach(field => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t1-value-header">${fieldLabel}</th>`;
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
    },

    
    renderTemplate1Body: function(elements, pivotData, rowFields, valueFields, pivotTable) {
        const visibleRows = pivotTable.getVisibleRowsWithoutDuplicates(pivotData.rows);
        let bodyHtml = '';
        
        visibleRows.forEach((row, index) => {
            const rowData = pivotData.data.find(d => d._id === row._id) || {};
            
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Row cell
            bodyHtml += this.renderTemplate1RowCell(row, rowFields[0]);
            
            // Value cells
            valueFields.forEach(field => {
                const value = rowData[field] || 0;
                bodyHtml += pivotTable.renderValueCell(value);
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
    },


    /**
     * Template-specific row cell renderers
     */
    renderTemplate1RowCell: function(row, field) {
        const level = row.level || 0;
        const indentationPx = 4 + (level * 30);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t1-hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${pivotTable.getDisplayLabel(row)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },

    
    /**
     * TEMPLATE 2: 2+ rows + 0 column + values
     * Multi-dimensional hierarchy with value columns
     */
    renderTemplate2: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template2: Multi-row dimensions with values (${rowFields.length} rows × ${valueFields.length} values)`);
        
        // Apply dynamic CSS classes for width calculation
        this.applyTemplate2WidthClasses(elements, rowFields, valueFields);
        
        this.renderTemplate2Header(elements, rowFields, valueFields, pivotTable);
        this.renderTemplate2Body(elements, pivotData, rowFields, valueFields, pivotTable);
    },


    /**
     * Apply CSS classes for dynamic width calculation
     */
    applyTemplate2WidthClasses: function(elements, rowFields, valueFields) {
        const container = elements.pivotTableHeader?.closest('.pivot-table-container');
        if (!container) return;
        
        const rowCount = rowFields.length;
        const valueCount = valueFields.length;
        
        // Remove existing width classes
        container.classList.remove(
            'row-dimensions-1', 'row-dimensions-2', 'row-dimensions-3', 'row-dimensions-4', 'row-dimensions-5',
            'value-fields-1', 'value-fields-2', 'value-fields-3', 'value-fields-4', 'value-fields-5'
        );
        
        // Add current width classes
        container.classList.add(`row-dimensions-${Math.min(rowCount, 5)}`);
        container.classList.add(`value-fields-${Math.min(valueCount, 5)}`);
        
        console.log(`🎨 Applied Template2 width classes: row-dimensions-${rowCount}, value-fields-${valueCount}`);
    },

    
    renderTemplate2Header: function(elements, rowFields, valueFields, pivotTable) {
        let headerHtml = '<tr>';
        
        console.log(`🏗️ Building Template2 header: ${rowFields.length} row dimensions + ${valueFields.length} value fields`);
        
        // Row dimension headers (50% total, split evenly)
        rowFields.forEach((field, index) => {
            const dimName = this.getRealDimensionName(field);
            headerHtml += `<th class="t2-row-header" data-dimension-index="${index}">`;
            headerHtml += `<div class="header-content">${dimName}</div>`;
            headerHtml += '</th>';
        });
        
        // Value field headers (50% total, split evenly)
        valueFields.forEach((field, index) => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t2-value-header" data-value-index="${index}">`;
            headerHtml += `<div class="header-content">${fieldLabel}</div>`;
            headerHtml += '</th>';
        });
        
        headerHtml += '</tr>';
        elements.pivotTableHeader.innerHTML = headerHtml;
        
        console.log(`✅ Template2 header built with ${rowFields.length + valueFields.length} columns`);
    },

    
    renderTemplate2Body: function(elements, pivotData, rowFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template2 body...`);
        
        const rowCombinations = pivotTable.generateEnhancedRowCombinations(rowFields);
        let bodyHtml = '';
        
        console.log(`📊 Generated ${rowCombinations.length} row combinations for Template2`);
        
        if (rowCombinations.length === 0) {
            const totalCols = rowFields.length + valueFields.length;
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            rowCombinations.forEach((combination, rowIndex) => {
                bodyHtml += `<tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}" data-row-index="${rowIndex}">`;
                
                // Dimension cells (50% total space, split evenly)
                combination.nodes.forEach((node, dimIndex) => {
                    bodyHtml += this.renderTemplate2DimensionCellOptimized(node, rowFields[dimIndex], dimIndex);
                });
                
                // Value cells (50% total space, split evenly)
                valueFields.forEach((field, valueIndex) => {
                    const value = pivotTable.calculateMultiRowValue(combination.nodes, field);
                    bodyHtml += this.renderTemplate2ValueCell(value, valueIndex);
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Template2 body built with ${rowCombinations.length} rows`);
    },


    /**
     * Renders value cells for Template 2 with proper formatting and styling
     */
    renderTemplate2ValueCell: function(value, valueIndex) {
        let numericValue;

        // Handle different value types
        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        // Determine cell classes based on value
        let cellClass = 'value-cell';
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        // Format the value for display
        const formattedValue = pivotTable.formatValue(numericValue);

        // Return the cell HTML with Template 2 specific styling
        return `<td class="${cellClass}" data-raw-value="${numericValue}" data-value-index="${valueIndex}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },


    renderTemplate2DimensionCellOptimized: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t2-dimension-cell dimension-${dimIndex} empty" data-dimension-index="${dimIndex}">
                <div class="cell-content">-</div>
            </td>`;
        }

        console.log(`🔍 Rendering T2 optimized cell: dimIndex=${dimIndex}, field=${field}, node:`, node);

        const level = node.level || 0;
        let dimName = '';
        
        // Extract dimension name safely
        if (typeof field === 'string') {
            dimName = data.extractDimensionName(field);
        } else if (field && field.field) {
            dimName = data.extractDimensionName(field.field);
        } else if (field && field.name) {
            dimName = data.extractDimensionName(field.name);
        } else {
            dimName = `dim_${dimIndex}`;
        }
        
        // Calculate indentation based on level (optimized for Template 2's fixed width columns)
        const maxWidth = 100 / (dimIndex + 1); // Percentage width allocated to this dimension
        const indentPx = Math.min(level * 12, maxWidth * 0.3); // Limit indent to 30% of column width
        
        let cellHtml = `<td class="t2-dimension-cell dimension-${dimIndex}" data-level="${level}" data-dimension-index="${dimIndex}" data-dimension="${dimName}">`;
        cellHtml += `<div class="cell-content" style="padding-left: ${indentPx}px;">`;
        
        // Add expand/collapse control or leaf indicator
        const hasChildren = this.nodeHasChildrenSafe(node, window.pivotTable || null, dimName);
        
        if (hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id || node.id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
            console.log(`🎯 T2 Added expand/collapse to ${node.label || node._id} (${dimName} dim ${dimIndex})`);
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
            console.log(`🍃 T2 Leaf node: ${node.label || node._id} (${dimName} dim ${dimIndex})`);
        }
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        cellHtml += `<span class="dimension-label" title="${displayLabel}">${displayLabel}</span>`;
        
        cellHtml += '</div>';
        cellHtml += '</td>';
        
        return cellHtml;
    },

    
    /**
     * TEMPLATE 3: 1 row + 1 column + values
     * Simple cross-tabulation
     */
    renderTemplate3: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template3: Single row × single column cross-tabulation`);
        
        this.renderTemplate3Header(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        this.renderTemplate3Body(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
    },


    /**
     * Enhanced column processing that includes root nodes and their values
     */
    getTemplate3ColumnsWithRoot: function(pivotData, columnFields, pivotTable) {
        // Get all columns including root
        const allColumns = pivotData.columns.filter(col => {
            // Include everything except system columns, but KEEP root nodes
            return col._id !== 'VALUE' && 
                col.label !== 'VALUE' && 
                col.label !== 'Value' &&
                col._id !== 'default' && 
                col._id !== 'no_columns' &&
                col.label !== 'Measures';
        });
        
        console.log(`🔍 Template3: Processing ${allColumns.length} columns (including root)`);
        
        // Separate root and non-root columns
        const rootColumns = allColumns.filter(col => col._id === 'ROOT');
        const nonRootColumns = allColumns.filter(col => col._id !== 'ROOT' && col.hierarchyField);
        
        // Get visible leaf columns from non-root
        const leafColumns = pivotTable.getVisibleLeafColumns(nonRootColumns);
        
        // Combine: root nodes first, then leaf nodes
        const orderedColumns = [];
        
        // Add root nodes that have data
        rootColumns.forEach(rootCol => {
            if (this.shouldDisplayRootNode(rootCol, pivotTable)) {
                orderedColumns.push({
                    ...rootCol,
                    isRootNode: true,
                    displayOrder: 0
                });
                console.log(`✅ Including root node: ${rootCol.label || 'ROOT'}`);
            }
        });
        
        // Add leaf columns with proper ordering
        leafColumns.forEach((leafCol, index) => {
            orderedColumns.push({
                ...leafCol,
                isRootNode: false,
                displayOrder: index + 1
            });
        });
        
        console.log(`📊 Template3 final column order: ${orderedColumns.length} columns (${rootColumns.length} root + ${leafColumns.length} leaf)`);
        
        return orderedColumns;
    },


    renderTemplate3Header: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        // Use enhanced column processing
        const orderedColumns = this.getTemplate3ColumnsWithRoot(pivotData, columnFields, pivotTable);
        
        let headerHtml = '';
        
        // Row 1: Row header + Measures header
        headerHtml += '<tr>';
        const rowDimName = this.getRealDimensionName(rowFields[0]);
        headerHtml += `<th class="t3-row-header" rowspan="3">${rowDimName}</th>`;
        
        const totalValueCells = orderedColumns.length * valueFields.length;
        headerHtml += `<th class="t3-measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t3-measure-header" colspan="${orderedColumns.length}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Column dimension headers (including root)
        headerHtml += '<tr>';
        valueFields.forEach(() => {
            orderedColumns.forEach(col => {
                const isRootNode = col.isRootNode || col._id === 'ROOT';
                const cssClass = isRootNode ? 't3-column-header root-node' : 't3-column-header';
                
                headerHtml += `<th class="${cssClass}" data-column-id="${col._id}" data-is-root="${isRootNode}">`;
                
                // Add expand/collapse control for non-root nodes that have children
                if (!isRootNode && pivotTable.originalColumnHasChildren(col)) {
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = data.extractDimensionName(columnFields[0]);
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="window.handleExpandCollapseClick(event)"></span>`;
                } else if (isRootNode) {
                    // Root nodes get special expand/collapse handling
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = data.extractDimensionName(columnFields[0]);
                    headerHtml += `<span class="expand-collapse ${expandClass} root-expand" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="window.handleExpandCollapseClick(event)"
                        title="Expand/collapse all ${dimName} items"></span>`;
                }
                
                const displayLabel = pivotTable.getDisplayLabel(col);
                headerHtml += `<span class="column-label ${isRootNode ? 'root-label' : ''}">${displayLabel}</span>`;
                headerHtml += '</th>';
            });
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        console.log(`✅ Template3 header built with ${orderedColumns.length} columns including root nodes`);
    },

    
    renderTemplate3Body: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        const visibleRows = pivotTable.getVisibleRowsWithoutDuplicates(pivotData.rows);
        const orderedColumns = this.getTemplate3ColumnsWithRoot(pivotData, columnFields, pivotTable);
        
        let bodyHtml = '';
        
        visibleRows.forEach((row, index) => {
            bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
            
            // Row cell
            bodyHtml += this.renderTemplate3RowCell(row, rowFields[0]);
            
            // Cross-tabulated value cells (including root node values)
            valueFields.forEach(field => {
                orderedColumns.forEach((col, colIndex) => {
                    let value;
                    
                    if (col.isRootNode || col._id === 'ROOT') {
                        // Calculate aggregated value for root node
                        value = this.calculateRootNodeValue(row, col, field, pivotTable);
                        console.log(`🧮 Root node value for ${row.label || row._id} × ${field}: ${value}`);
                    } else {
                        // Regular cross-tabulation for non-root nodes
                        value = pivotTable.calculateMultiDimensionalValue([row], [col], field);
                    }
                    
                    bodyHtml += this.renderTemplate3ValueCell(value, col, colIndex, field, pivotTable);
                });
            });
            
            bodyHtml += '</tr>';
        });
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Template3 body built with ${visibleRows.length} rows × ${orderedColumns.length} columns`);
    },


    /**
     * Calculate aggregated value for root node (sum of all children)
     */
    calculateRootNodeValue: function(row, rootColumn, field, pivotTable) {
        console.log(`🧮 Calculating root value for row: ${row.label || row._id}, field: ${field}`);
        
        // Method 1: Try to get the total from the pivot data directly
        const rowData = this.findRowData(row._id);
        if (rowData && rowData[field] !== undefined) {
            console.log(`✅ Found direct root value: ${rowData[field]}`);
            return rowData[field];
        }
        
        // Method 2: Calculate by summing all child values in this dimension
        const dimName = data.extractDimensionName(rootColumn.hierarchyField);
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        
        if (hierarchy && hierarchy.root && hierarchy.root.children) {
            let total = 0;
            let hasData = false;
            
            hierarchy.root.children.forEach(childId => {
                const childNode = hierarchy.nodesMap[childId];
                if (childNode) {
                    // Create a mock column node for calculation
                    const mockChildColumn = {
                        _id: childId,
                        hierarchyField: rootColumn.hierarchyField,
                        factId: childNode.factId
                    };
                    
                    const childValue = pivotTable.calculateMultiDimensionalValue([row], [mockChildColumn], field);
                    if (typeof childValue === 'number' && !isNaN(childValue)) {
                        total += childValue;
                        hasData = true;
                        console.log(`  + Child ${childId}: ${childValue}`);
                    }
                }
            });
            
            if (hasData) {
                console.log(`✅ Calculated root total from children: ${total}`);
                return total;
            }
        }
        
        // Method 3: Fallback - try standard calculation
        const fallbackValue = pivotTable.calculateMultiDimensionalValue([row], [rootColumn], field);
        console.log(`⚠️ Using fallback calculation: ${fallbackValue}`);
        return fallbackValue || 0;
    },


    /**
     * Enhanced value cell rendering with root node styling
     */
    renderTemplate3ValueCell: function(value, column, columnIndex, field, pivotTable) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        const isRootNode = column.isRootNode || column._id === 'ROOT';
        
        let cellClass = 'value-cell';
        if (isRootNode) {
            cellClass += ' root-value-cell';
        }
        
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        const formattedValue = pivotTable.formatValue(numericValue);

        return `<td class="${cellClass}" 
                    data-raw-value="${numericValue}" 
                    data-column-index="${columnIndex}" 
                    data-field="${field}"
                    data-is-root="${isRootNode}"
                    data-column-id="${column._id}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },


    /**
     * Helper method to find row data in pivot table
     */
    findRowData: function(rowId) {
        // This should be added to the main pivot table class
        if (this.state && this.state.factData) {
            return this.state.factData.find(row => row._id === rowId);
        }
        
        if (this.pivotData && this.pivotData.data) {
            return this.pivotData.data.find(row => row._id === rowId);
        }
        
        return null;
    },

    
    /**
     * TEMPLATE 4: 2+ rows + 1 column + values
     * Multi-row with single column cross-tabulation
     */
    renderTemplate4: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template4 Refactored: Multi-row × single column (${rowFields.length} rows × ${columnFields.length} column × ${valueFields.length} values)`);
        
        // Apply Template 4 CSS classes for width calculation
        this.applyTemplate4WidthClasses(elements, rowFields, columnFields, valueFields);
        
        // Use Template 3's proven header structure, but with multiple row dimensions
        this.renderTemplate4HeaderBasedOnTemplate3(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        // Use Template 3's proven body structure, but with multiple row dimensions  
        this.renderTemplate4BodyBasedOnTemplate3(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        console.log('✅ Template4 refactored rendering complete');
    },


    /**
     * Apply CSS classes for Template 4 width calculation
     */
    applyTemplate4WidthClasses: function(elements, rowFields, columnFields, valueFields) {
        const container = elements.pivotTableHeader?.closest('.pivot-table-container');
        if (!container) return;
        
        const rowCount = rowFields.length;
        const valueCount = valueFields.length;
        
        // Remove existing classes
        container.classList.remove(
            'row-dimensions-1', 'row-dimensions-2', 'row-dimensions-3', 'row-dimensions-4', 'row-dimensions-5',
            'value-fields-1', 'value-fields-2', 'value-fields-3', 'value-fields-4', 'value-fields-5'
        );
        
        // Add current classes
        container.classList.add(`row-dimensions-${Math.min(rowCount, 5)}`);
        container.classList.add(`value-fields-${Math.min(valueCount, 5)}`);
        
        console.log(`🎨 Applied Template4 classes: row-dimensions-${rowCount}, value-fields-${valueCount}`);
    },


    /**
     * Render header based on Template 3 structure, but with multiple row dimensions
     */
    renderTemplate4HeaderBasedOnTemplate3: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template4 header based on Template3 structure`);
        
        // Get columns using Template 3's proven method
        const orderedColumns = this.getTemplate3ColumnsWithRoot(pivotData, columnFields, pivotTable);
        
        let headerHtml = '';
        
        // Row 1: Multiple row headers + Measures header (Template 3 style)
        headerHtml += '<tr>';
        
        // Multiple row dimension headers (each with rowspan="3")
        rowFields.forEach((field, index) => {
            const rowDimName = this.getRealDimensionName(field);
            headerHtml += `<th class="t4-row-header" data-dimension-index="${index}" rowspan="3">${rowDimName}</th>`;
        });
        
        // Measures header (Template 3 style)
        const totalValueCells = orderedColumns.length * valueFields.length;
        headerHtml += `<th class="t4-measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers (Template 3 style)
        headerHtml += '<tr>';
        valueFields.forEach(field => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t4-measure-header" colspan="${orderedColumns.length}">${fieldLabel}</th>`;
        });
        headerHtml += '</tr>';
        
        // Row 3: Column dimension headers (Template 3 style, including root)
        headerHtml += '<tr>';
        valueFields.forEach(() => {
            orderedColumns.forEach(col => {
                const isRootNode = col.isRootNode || col._id === 'ROOT';
                const cssClass = isRootNode ? 't4-column-header root-node' : 't4-column-header';
                
                headerHtml += `<th class="${cssClass}" data-column-id="${col._id}" data-is-root="${isRootNode}">`;
                
                // Add expand/collapse control (Template 3 style)
                if (!isRootNode && pivotTable.originalColumnHasChildren(col)) {
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = data.extractDimensionName(columnFields[0]);
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="window.handleExpandCollapseClick(event)"></span>`;
                } else if (isRootNode) {
                    // Root nodes get special expand/collapse handling (Template 3 style)
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = data.extractDimensionName(columnFields[0]);
                    headerHtml += `<span class="expand-collapse ${expandClass} root-expand" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="window.handleExpandCollapseClick(event)"
                        title="Expand/collapse all ${dimName} items"></span>`;
                }
                
                const displayLabel = pivotTable.getDisplayLabel(col);
                headerHtml += `<span class="column-label ${isRootNode ? 'root-label' : ''}">${displayLabel}</span>`;
                headerHtml += '</th>';
            });
        });
        headerHtml += '</tr>';
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        console.log(`✅ Template4 header built with ${rowFields.length} row dimensions and Template3-style column structure`);
    },


    /**
     * Render body based on Template 3 structure, but with multiple row dimensions
     */
    renderTemplate4BodyBasedOnTemplate3: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template4 body based on Template3 structure`);
        
        // Get columns using Template 3's proven method
        const orderedColumns = this.getTemplate3ColumnsWithRoot(pivotData, columnFields, pivotTable);
        
        // Use Template 2's proven multi-row combination generation
        const rowCombinations = pivotTable.generateEnhancedRowCombinations(rowFields);
        
        let bodyHtml = '';
        
        if (rowCombinations.length === 0) {
            const totalCols = rowFields.length + (orderedColumns.length * valueFields.length);
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            rowCombinations.forEach((combination, index) => {
                bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Multiple row dimension cells (Template 2 style)
                combination.nodes.forEach((node, dimIndex) => {
                    bodyHtml += this.renderTemplate4MultiRowDimensionCell(node, rowFields[dimIndex], dimIndex);
                });
                
                // Cross-tabulated value cells (Template 3 style, including root node values)
                valueFields.forEach(field => {
                    orderedColumns.forEach((col, colIndex) => {
                        let value;
                        
                        if (col.isRootNode || col._id === 'ROOT') {
                            // Calculate aggregated value for root node (Template 3 style)
                            value = this.calculateTemplate4RootNodeValue(combination.nodes, col, field, pivotTable);
                        } else {
                            // Regular cross-tabulation for non-root nodes
                            value = pivotTable.calculateMultiDimensionalValue(combination.nodes, [col], field);
                        }
                        
                        bodyHtml += this.renderTemplate4ValueCell(value, col, colIndex, field, pivotTable);
                    });
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Template4 body built with ${rowCombinations.length} row combinations × ${orderedColumns.length} columns`);
    },


    /**
     * Render individual row dimension cell for Template 4 (based on Template 2's approach)
     */
    renderTemplate4MultiRowDimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t4-dimension-cell dimension-${dimIndex} empty" data-dimension-index="${dimIndex}">
                <div class="cell-content">-</div>
            </td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t4-dimension-cell dimension-${dimIndex}" data-level="${level}" data-dimension-index="${dimIndex}" data-dimension="${dimName}">`;
        cellHtml += `<div class="cell-content" style="padding-left: ${indentationPx}px;">`;
        
        // Add expand/collapse control or leaf indicator (Template 2 style)
        const hasChildren = this.nodeHasChildrenSafe(node, window.pivotTable || null, dimName);
        
        if (hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id || node.id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        cellHtml += `<span class="dimension-label" title="${displayLabel}">${displayLabel}</span>`;
        
        cellHtml += '</div>';
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Calculate root node value for Template 4 (based on Template 3's method)
     */
    calculateTemplate4RootNodeValue: function(rowNodes, rootColumn, field, pivotTable) {
        console.log(`🧮 Template4: Calculating root value for ${rowNodes.length} row nodes, field: ${field}`);
        
        // Use Template 3's proven root calculation method but with multiple row nodes
        const dimName = data.extractDimensionName(rootColumn.hierarchyField);
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        
        if (hierarchy && hierarchy.root && hierarchy.root.children) {
            let total = 0;
            let hasData = false;
            
            hierarchy.root.children.forEach(childId => {
                const childNode = hierarchy.nodesMap[childId];
                if (childNode) {
                    // Create a mock column node for calculation
                    const mockChildColumn = {
                        _id: childId,
                        hierarchyField: rootColumn.hierarchyField,
                        factId: childNode.factId
                    };
                    
                    // Use multi-dimensional calculation with all row nodes
                    const childValue = pivotTable.calculateMultiDimensionalValue(rowNodes, [mockChildColumn], field);
                    if (typeof childValue === 'number' && !isNaN(childValue)) {
                        total += childValue;
                        hasData = true;
                    }
                }
            });
            
            if (hasData) {
                console.log(`✅ Template4: Calculated root total from children: ${total}`);
                return total;
            }
        }
        
        // Fallback - try standard calculation with all row nodes
        const fallbackValue = pivotTable.calculateMultiDimensionalValue(rowNodes, [rootColumn], field);
        console.log(`⚠️ Template4: Using fallback calculation: ${fallbackValue}`);
        return fallbackValue || 0;
    },


    /**
     * Render value cell for Template 4 (based on Template 3's approach)
     */
    renderTemplate4ValueCell: function(value, column, columnIndex, field, pivotTable) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        const isRootNode = column.isRootNode || column._id === 'ROOT';
        
        let cellClass = 'value-cell t4-value-cell';
        if (isRootNode) {
            cellClass += ' root-value-cell';
        }
        
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        const formattedValue = pivotTable.formatValue(numericValue);

        return `<td class="${cellClass}" 
                    data-raw-value="${numericValue}" 
                    data-column-index="${columnIndex}" 
                    data-field="${field}"
                    data-is-root="${isRootNode}"
                    data-column-id="${column._id}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },


    /**
     * TEMPLATE 5: 2+ rows + 2+ columns + values
     * Full multi-dimensional cross-tabulation
     */
    
    renderTemplate5: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template5 Refactored: Multi-row × hierarchical multi-column (${rowFields.length} rows × ${columnFields.length} columns × ${valueFields.length} values)`);
        
        // Apply Template 5 CSS classes for width calculation
        this.applyTemplate5WidthClasses(elements, rowFields, columnFields, valueFields);
        
        // Use Template 6's proven header structure, but with multiple row dimensions
        this.renderTemplate5HeaderBasedOnTemplate6(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        // Use Template 6's proven body structure, but with multiple row dimensions
        this.renderTemplate5BodyBasedOnTemplate6(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        console.log('✅ Template5 refactored rendering complete');
    },


    /**
     * Apply CSS classes for Template 5 width calculation
     */
    applyTemplate5WidthClasses: function(elements, rowFields, columnFields, valueFields) {
        const container = elements.pivotTableHeader?.closest('.pivot-table-container');
        if (!container) return;
        
        const rowCount = rowFields.length;
        const columnCount = columnFields.length;
        const valueCount = valueFields.length;
        
        // Remove existing classes
        container.classList.remove(
            'row-dimensions-1', 'row-dimensions-2', 'row-dimensions-3', 'row-dimensions-4', 'row-dimensions-5',
            'column-dimensions-1', 'column-dimensions-2', 'column-dimensions-3', 'column-dimensions-4', 'column-dimensions-5',
            'value-fields-1', 'value-fields-2', 'value-fields-3', 'value-fields-4', 'value-fields-5'
        );
        
        // Add current classes
        container.classList.add(`row-dimensions-${Math.min(rowCount, 5)}`);
        container.classList.add(`column-dimensions-${Math.min(columnCount, 5)}`);
        container.classList.add(`value-fields-${Math.min(valueCount, 5)}`);
        
        console.log(`🎨 Applied Template5 classes: row-dimensions-${rowCount}, column-dimensions-${columnCount}, value-fields-${valueCount}`);
    },


    /**
     * Render header based on Template 6 structure, but with multiple row dimensions
     */
    renderTemplate5HeaderBasedOnTemplate6: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template5 header based on Template6 structure`);
        
        // Get hierarchical column combinations using Template 6's proven method
        const columnCombinations = this.generateTemplate6ColumnCombinations(pivotData, columnFields, pivotTable);
        
        let headerHtml = '';
        
        // Calculate total header rows needed: 1 (row headers) + 1 (measures) + N (value fields) + M (column dimensions)
        const totalHeaderRows = 2 + valueFields.length + columnFields.length;
        
        // Row 1: Multiple row headers with mega rowspan + Measures header (Template 6 style)
        headerHtml += '<tr>';
        
        // Multiple row dimension headers (each with rowspan covering all header rows)
        rowFields.forEach((field, index) => {
            const rowDimName = this.getRealDimensionName(field);
            headerHtml += `<th class="t5-row-header" data-dimension-index="${index}" rowspan="${totalHeaderRows}">${rowDimName}</th>`;
        });
        
        // Measures header spanning all value cells (Template 6 style)
        const totalValueCells = columnCombinations.length * valueFields.length;
        headerHtml += `<th class="t5-measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers (Template 6 style)
        headerHtml += '<tr>';
        valueFields.forEach((field, valueIndex) => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t5-measure-header" colspan="${columnCombinations.length}" data-value-index="${valueIndex}">`;
            headerHtml += `<div class="header-content">${fieldLabel}</div>`;
            headerHtml += '</th>';
        });
        headerHtml += '</tr>';
        
        // Rows 3+: Hierarchical column dimension headers (Template 6 style)
        headerHtml += this.buildTemplate5HierarchicalColumnHeaders(columnCombinations, columnFields, valueFields, pivotTable);
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        console.log(`✅ Template5 header built with ${rowFields.length} row dimensions and Template6-style hierarchical columns`);
    },


    /**
     * Build hierarchical column headers for Template 5 (based on Template 6's proven approach)
     */
    buildTemplate5HierarchicalColumnHeaders: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '';
        
        // Build each column dimension level (Template 6 style)
        columnFields.forEach((field, levelIndex) => {
            headerHtml += '<tr>';
            
            valueFields.forEach((valueField, valueIndex) => {
                if (levelIndex === 0) {
                    // Top level - higher dimension nodes with expand/collapse (Template 6 style)
                    const topLevelSpans = this.calculateTemplate6TopLevelSpans(columnCombinations, levelIndex);
                    topLevelSpans.forEach(spanInfo => {
                        headerHtml += this.renderTemplate6HigherDimensionHeader(spanInfo, field, levelIndex, valueIndex, pivotTable);
                    });
                } else {
                    // Lower dimension nodes - repeated for each higher dimension node (Template 6 style)
                    headerHtml += this.renderTemplate6LowerDimensionHeaders(columnCombinations, field, levelIndex, valueField, valueIndex, pivotTable);
                }
            });
            
            headerHtml += '</tr>';
        });
        
        return headerHtml;
    },


    /**
     * Render body based on Template 6 structure, but with multiple row dimensions
     */
    renderTemplate5BodyBasedOnTemplate6: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template5 body based on Template6 structure`);
        
        // Get hierarchical column combinations using Template 6's proven method
        const columnCombinations = this.generateTemplate6ColumnCombinations(pivotData, columnFields, pivotTable);
        
        // Use Template 4's proven multi-row combination generation
        const rowCombinations = pivotTable.generateEnhancedRowCombinations(rowFields);
        
        let bodyHtml = '';
        
        if (rowCombinations.length === 0 || columnCombinations.length === 0) {
            const totalCols = rowFields.length + (columnCombinations.length * valueFields.length);
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            rowCombinations.forEach((combination, index) => {
                bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Multiple row dimension cells (Template 4 style)
                combination.nodes.forEach((node, dimIndex) => {
                    bodyHtml += this.renderTemplate5MultiRowDimensionCell(node, rowFields[dimIndex], dimIndex);
                });
                
                // Cross-tabulated value cells (Template 6 style)
                valueFields.forEach(field => {
                    columnCombinations.forEach((combo, colIndex) => {
                        const value = pivotTable.calculateMultiDimensionalValue(combination.nodes, combo.nodes, field);
                        bodyHtml += this.renderTemplate5ValueCell(value, field, colIndex, pivotTable);
                    });
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Template5 body built with ${rowCombinations.length} row combinations × ${columnCombinations.length} column combinations`);
    },


    /**
     * Render individual row dimension cell for Template 5 (based on Template 4's approach)
     */
    renderTemplate5MultiRowDimensionCell: function(node, field, dimIndex) {
        if (!node) {
            return `<td class="t5-dimension-cell dimension-${dimIndex} empty" data-dimension-index="${dimIndex}">
                <div class="cell-content">-</div>
            </td>`;
        }

        const level = node.level || 0;
        const indentationPx = 4 + (level * 20);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t5-dimension-cell dimension-${dimIndex}" data-level="${level}" data-dimension-index="${dimIndex}" data-dimension="${dimName}">`;
        cellHtml += `<div class="cell-content" style="padding-left: ${indentationPx}px;">`;
        
        // Add expand/collapse control or leaf indicator (Template 4 style)
        const hasChildren = this.nodeHasChildrenSafe(node, window.pivotTable || null, dimName);
        
        if (hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id || node.id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        cellHtml += `<span class="dimension-label" title="${displayLabel}">${displayLabel}</span>`;
        
        cellHtml += '</div>';
        cellHtml += '</td>';
        
        return cellHtml;
    },

    /**
     * Render value cell for Template 5 (based on Template 6's approach)
     */
    renderTemplate5ValueCell: function(value, field, columnIndex, pivotTable) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        let cellClass = 'value-cell t5-value-cell';
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        const formattedValue = pivotTable.formatValue(numericValue);

        return `<td class="${cellClass}" data-raw-value="${numericValue}" data-column-index="${columnIndex}" data-field="${field}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },
    

    /**
     * Get visible column nodes respecting hierarchy and expand/collapse state
     */
    getVisibleColumnNodesHierarchical: function(dimensionColumns, field, pivotTable) {
        const dimName = data.extractDimensionName(field);
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) {
            // Fallback to simple filtering
            return dimensionColumns.filter(col => col.factId || (col.level || 0) <= 1);
        }
        
        const visibleNodes = [];
        
        // Start from root and traverse based on expand/collapse state
        const rootNode = hierarchy.nodesMap['ROOT'];
        if (rootNode) {
            this.traverseColumnHierarchy(rootNode, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable);
        }
        
        // If no nodes found through traversal, fall back to direct filtering
        if (visibleNodes.length === 0) {
            return dimensionColumns.filter(col => {
                return !pivotTable.originalColumnHasChildren(col) || col.factId;
            }).slice(0, 10); // Limit for performance
        }
        
        return visibleNodes;
    },


    /**
     * Traverse column hierarchy to find visible nodes
     */
    traverseColumnHierarchy: function(node, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable) {
        if (!node) return;
        
        // Find the corresponding column in dimensionColumns
        const columnNode = dimensionColumns.find(col => col._id === node.id);
        if (!columnNode) return;
        
        // Check if this node is expanded
        const isExpanded = pivotTable.state?.expandedNodes?.[dimName]?.column?.[node.id] || false;
        
        if (node.isLeaf || !node.children || node.children.length === 0) {
            // Leaf node - always include
            visibleNodes.push(columnNode);
        } else if (!isExpanded) {
            // Collapsed parent - include the parent node itself
            visibleNodes.push(columnNode);
        } else {
            // Expanded parent - include children
            node.children.forEach(childId => {
                const childNode = hierarchy.nodesMap[childId];
                if (childNode) {
                    this.traverseColumnHierarchy(childNode, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable);
                }
            });
        }
    },


    /**
     * Generate hierarchical combinations for multiple column dimensions
     */
    generateHierarchicalColumnCombinations: function(columns, columnFields, pivotTable) {
        const combinations = [];
        
        // Group columns by dimension with hierarchical awareness
        const dimensionColumns = {};
        columnFields.forEach(field => {
            const dimName = data.extractDimensionName(field);
            dimensionColumns[field] = this.getVisibleColumnNodesHierarchical(
                columns.filter(col => {
                    if (!col.hierarchyField) return false;
                    const colDimName = data.extractDimensionName(col.hierarchyField);
                    return colDimName === dimName;
                }),
                field,
                pivotTable
            );
            console.log(`🔍 Hierarchical dimension ${dimName}: ${dimensionColumns[field].length} visible nodes`);
        });
        
        // Generate cartesian product of visible column nodes
        if (columnFields.length === 2) {
            const [field1, field2] = columnFields;
            const cols1 = dimensionColumns[field1] || [];
            const cols2 = dimensionColumns[field2] || [];
            
            console.log(`🔍 Two hierarchical dimensions: ${cols1.length} × ${cols2.length} = ${cols1.length * cols2.length} combinations`);
            
            cols1.forEach(col1 => {
                cols2.forEach(col2 => {
                    combinations.push({
                        nodes: [col1, col2],
                        labels: [pivotTable.getDisplayLabel(col1), pivotTable.getDisplayLabel(col2)],
                        key: `${col1._id}|${col2._id}`
                    });
                });
            });
        } else if (columnFields.length >= 3) {
            // Handle 3+ dimensions with recursive approach
            this.generateRecursiveHierarchicalCombinations(dimensionColumns, columnFields, combinations, pivotTable);
        }
        
        console.log(`🔍 Generated ${combinations.length} hierarchical column combinations`);
        return combinations;
    },


    /**
     * Generate recursive hierarchical combinations for 3+ column dimensions
     */
    generateRecursiveHierarchicalCombinations: function(dimensionColumns, columnFields, combinations, pivotTable) {
        const generateRecursive = (currentCombo, currentLabels, currentKey, fieldIndex) => {
            if (fieldIndex >= columnFields.length) {
                combinations.push({
                    nodes: [...currentCombo],
                    labels: [...currentLabels],
                    key: currentKey
                });
                return;
            }
            
            const field = columnFields[fieldIndex];
            const nodes = dimensionColumns[field] || [];
            
            // Limit combinations for performance
            const maxNodes = fieldIndex === 0 ? 5 : 3;
            const nodesToUse = nodes.slice(0, maxNodes);
            
            nodesToUse.forEach(node => {
                generateRecursive(
                    [...currentCombo, node],
                    [...currentLabels, pivotTable.getDisplayLabel(node)],
                    currentKey ? `${currentKey}|${node._id}` : node._id,
                    fieldIndex + 1
                );
            });
        };
        
        generateRecursive([], [], '', 0);
    },


    /**
     * Generate combinations for multiple column dimensions
     */
    generateMultiColumnCombinations: function(columns, columnFields, pivotTable) {
        const combinations = [];
        
        // Group columns by dimension
        const dimensionColumns = {};
        columnFields.forEach(field => {
            const dimName = data.extractDimensionName(field);
            dimensionColumns[field] = columns.filter(col => {
                if (!col.hierarchyField) return false;
                const colDimName = data.extractDimensionName(col.hierarchyField);
                return colDimName === dimName;
            });
            console.log(`🔍 Dimension ${dimName}: ${dimensionColumns[field].length} columns`);
        });
        
        // Generate cartesian product of visible column nodes
        if (columnFields.length === 2) {
            const [field1, field2] = columnFields;
            const cols1 = this.getVisibleColumnNodes(dimensionColumns[field1] || [], pivotTable);
            const cols2 = this.getVisibleColumnNodes(dimensionColumns[field2] || [], pivotTable);
            
            console.log(`🔍 Two dimensions: ${cols1.length} × ${cols2.length} = ${cols1.length * cols2.length} combinations`);
            
            cols1.forEach(col1 => {
                cols2.forEach(col2 => {
                    combinations.push({
                        nodes: [col1, col2],
                        labels: [pivotTable.getDisplayLabel(col1), pivotTable.getDisplayLabel(col2)],
                        key: `${col1._id}|${col2._id}`
                    });
                });
            });
        }
        
        console.log(`🔍 Generated ${combinations.length} column combinations`);
        return combinations;
    },


    /**
     * Get visible column nodes (leaf nodes or meaningful nodes)
     */
    getVisibleColumnNodes: function(dimensionColumns, pivotTable) {
        const visibleNodes = dimensionColumns.filter(col => {
            // Include nodes that are either leaf nodes or have factId (meaningful data nodes)
            return !pivotTable.originalColumnHasChildren(col) || col.factId || col.expanded;
        });
        
        // If no visible nodes, include root-level nodes
        if (visibleNodes.length === 0) {
            return dimensionColumns.filter(col => (col.level || 0) <= 1);
        }
        
        return visibleNodes;
    },


    /**
     * Build multi-level header for Template 5 scrollable area
     */
    buildTemplate5MultiLevelHeader: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '';
        
        const totalValueCells = columnCombinations.length * valueFields.length;
        
        // Row 1: Measures header spanning all value cells
        headerHtml += '<tr>';
        headerHtml += `<th class="t5-measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers
        headerHtml += '<tr>';
        valueFields.forEach((field, index) => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t5-measure-header" colspan="${columnCombinations.length}" data-value-index="${index}">`;
            headerHtml += `<div class="header-content">${fieldLabel}</div>`;
            headerHtml += '</th>';
        });
        headerHtml += '</tr>';
        
        // ENHANCED: Build hierarchical column headers with proper expand/collapse
        if (columnFields.length === 1) {
            // Single column dimension
            headerHtml += this.buildSingleColumnDimensionHeader(columnCombinations, columnFields, valueFields, pivotTable);
        } else if (columnFields.length >= 2) {
            // Multi-level column headers with proper hierarchy and expand/collapse
            headerHtml += this.buildHierarchicalColumnHeaders(columnCombinations, columnFields, valueFields, pivotTable);
        }
        
        return headerHtml;
    },


    /**
     * Build hierarchical column headers for multi-level dimensions
     */
    buildHierarchicalColumnHeaders: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '';
        
        // Build each column dimension level
        columnFields.forEach((field, levelIndex) => {
            headerHtml += '<tr>';
            
            valueFields.forEach(() => {
                if (levelIndex === 0) {
                    // FIXED: Add expand/collapse for any spanning node with children
                    const topLevelSpans = this.calculateTopLevelSpans(columnCombinations, columnFields, levelIndex);
                    topLevelSpans.forEach(spanInfo => {
                        const node = spanInfo.node;
                        const spanCount = spanInfo.spanCount;
                        
                        headerHtml += `<th class="t5-column-header dimension-level-${levelIndex}" colspan="${spanCount}" data-node-id="${node._id}">`;
                        
                        // FIXED: Any node with children should be expandable
                        if (this.columnNodeHasExpandableChildren(node, pivotTable)) {
                            const expandClass = node.expanded ? 'expanded' : 'collapsed';
                            const dimName = data.extractDimensionName(field);
                            headerHtml += `<span class="expand-collapse ${expandClass}" 
                                data-node-id="${node._id}" 
                                data-hierarchy="${dimName}" 
                                data-zone="column"
                                onclick="window.handleExpandCollapseClick(event)"
                                title="Expand/collapse ${pivotTable.getDisplayLabel(node)} (${dimName} dimension)"></span>`;
                            console.log(`🎯 Added expand/collapse to spanning node ${node.label} (${node._id}) in ${dimName}`);
                        } else {
                            headerHtml += '<span class="leaf-node-empty"></span>';
                            console.log(`🍃 Spanning leaf node (no children): ${node.label} (${node._id})`);
                        }
                        
                        const displayLabel = pivotTable.getDisplayLabel(node);
                        headerHtml += `<span class="column-label">${displayLabel}</span>`;
                        headerHtml += '</th>';
                    });
                } else {
                    // Lower levels - individual cells
                    columnCombinations.forEach((combo, colIndex) => {
                        const node = combo.nodes[levelIndex];
                        if (node) {
                            headerHtml += `<th class="t5-column-header dimension-level-${levelIndex}" data-column-index="${colIndex}" data-node-id="${node._id}">`;
                            
                            // FIX 2: Add expand/collapse for nodes with children
                            if (this.columnNodeHasExpandableChildren(node, pivotTable)) {
                                const expandClass = node.expanded ? 'expanded' : 'collapsed';
                                const dimName = data.extractDimensionName(columnFields[levelIndex]);
                                headerHtml += `<span class="expand-collapse ${expandClass}" 
                                    data-node-id="${node._id}" 
                                    data-hierarchy="${dimName}" 
                                    data-zone="column"
                                    onclick="window.handleExpandCollapseClick(event)"
                                    title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
                            } else {
                                headerHtml += '<span class="leaf-node-empty"></span>';
                            }
                            
                            const displayLabel = pivotTable.getDisplayLabel(node);
                            headerHtml += `<span class="column-label" title="${displayLabel}">${displayLabel}</span>`;
                            headerHtml += '</th>';
                        } else {
                            headerHtml += `<th class="t5-column-header dimension-level-${levelIndex} empty">-</th>`;
                        }
                    });
                }
            });
            
            headerHtml += '</tr>';
        });
        
        return headerHtml;
    },


    /**
     * Check if a column node has expandable children (for expand/collapse UI)
     * FIXED: Properly checks for children regardless of dimension level
     */
    columnNodeHasExpandableChildren: function(node, pivotTable) {
        if (!node) {
            console.log('🔍 columnNodeHasExpandableChildren: node is null/undefined');
            return false;
        }
        
        // Extract dimension name from node
        let dimName = '';
        if (node.hierarchyField) {
            dimName = data.extractDimensionName(node.hierarchyField);
        } else if (node._id && node._id.includes('_')) {
            // Try to extract from node ID pattern (e.g., "le_WORLDWIDE")
            const parts = node._id.split('_');
            if (parts.length >= 2) {
                dimName = parts[0].toLowerCase();
            }
        }
        
        if (!dimName) {
            console.log(`🔍 columnNodeHasExpandableChildren: cannot determine dimension for node ${node._id || 'unknown'}`);
            return false;
        }
        
        console.log(`🔍 Checking expandable children for node ${node._id} (${node.label || 'no label'}) in dimension ${dimName}`);
        
        // METHOD 1: Check via hierarchy system
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        if (hierarchy && hierarchy.nodesMap) {
            const originalNode = hierarchy.nodesMap[node._id];
            if (originalNode && originalNode.children && originalNode.children.length > 0) {
                console.log(`✅ Node ${node._id} has ${originalNode.children.length} children via hierarchy`);
                return true;
            }
        }
        
        // METHOD 2: Check direct children property
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            console.log(`✅ Node ${node._id} has ${node.children.length} direct children`);
            return true;
        }
        
        // METHOD 3: Check isLeaf property (inverse logic)
        if (node.hasOwnProperty('isLeaf') && !node.isLeaf) {
            console.log(`✅ Node ${node._id} is not a leaf (isLeaf=${node.isLeaf})`);
            return true;
        }
        
        // METHOD 4: Check if this node appears in other nodes' children
        if (hierarchy && hierarchy.nodesMap) {
            for (const [nodeId, hierarchyNode] of Object.entries(hierarchy.nodesMap)) {
                if (hierarchyNode.children && hierarchyNode.children.includes(node._id)) {
                    // This node is someone's child, so it might have its own children
                    const thisNode = hierarchy.nodesMap[node._id];
                    if (thisNode && thisNode.children && thisNode.children.length > 0) {
                        console.log(`✅ Node ${node._id} found in hierarchy with children`);
                        return true;
                    }
                }
            }
        }
        
        // METHOD 5: Check if factId indicates it's a leaf
        if (node.factId) {
            console.log(`❌ Node ${node._id} has factId, likely a leaf node`);
            return false;
        }
        
        console.log(`❌ Node ${node._id} - no children found via any method`);
        return false;
    },


    /**
     * Calculate spanning information for top-level column headers
     */
    calculateTopLevelSpans: function(columnCombinations, columnFields, levelIndex) {
        const spans = [];
        const processedNodes = new Set();
        
        columnCombinations.forEach((combo, comboIndex) => {
            const node = combo.nodes[levelIndex];
            if (!node || processedNodes.has(node._id)) return;
            
            // Calculate how many combinations this node spans
            let spanCount = 0;
            columnCombinations.forEach(otherCombo => {
                const otherNode = otherCombo.nodes[levelIndex];
                if (otherNode && otherNode._id === node._id) {
                    spanCount++;
                }
            });
            
            spans.push({
                node: node,
                spanCount: spanCount,
                startIndex: comboIndex
            });
            
            processedNodes.add(node._id);
        });
        
        return spans;
    },


    /**
     * Build single column dimension header with expand/collapse
     * FIXED: Properly checks each node for children regardless of apparent level
     */
    buildSingleColumnDimensionHeader: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '<tr>';
        
        valueFields.forEach(() => {
            columnCombinations.forEach((combo, colIndex) => {
                const col = combo.nodes[0];
                headerHtml += `<th class="t5-column-header" data-column-index="${colIndex}">`;
                
                // FIXED: Check for expandable children regardless of which dimension this node belongs to
                if (this.columnNodeHasExpandableChildren(col, pivotTable)) {
                    const expandClass = col.expanded ? 'expanded' : 'collapsed';
                    const dimName = data.extractDimensionName(col.hierarchyField);
                    headerHtml += `<span class="expand-collapse ${expandClass}" 
                        data-node-id="${col._id}" 
                        data-hierarchy="${dimName}" 
                        data-zone="column"
                        onclick="window.handleExpandCollapseClick(event)"
                        title="Expand/collapse ${pivotTable.getDisplayLabel(col)} (${dimName} dimension)"></span>`;
                    console.log(`🎯 Added expand/collapse to ${col.label} (${col._id}) in ${dimName}`);
                } else {
                    // Show empty space for actual leaf nodes (nodes with no children)
                    headerHtml += '<span class="leaf-node-empty"></span>';
                    console.log(`🍃 Leaf node (no children): ${col.label} (${col._id})`);
                }
                
                const displayLabel = pivotTable.getDisplayLabel(col);
                headerHtml += `<span class="column-label" title="${displayLabel}">${displayLabel}</span>`;
                headerHtml += '</th>';
            });
        });
        
        headerHtml += '</tr>';
        return headerHtml;
    },


    /**
     * Build multi-level column headers for 2+ column dimensions
     */
    buildMultiLevelColumnHeaders: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '';
        
        if (columnFields.length >= 2) {
            // First column dimension level
            headerHtml += '<tr>';
            valueFields.forEach(() => {
                const uniqueFirstLevel = this.getUniqueFirstLevelNodes(columnCombinations);
                uniqueFirstLevel.forEach(nodeInfo => {
                    const spanCount = nodeInfo.count;
                    const node = nodeInfo.node;
                    
                    headerHtml += `<th class="t5-column-header dimension-level-0" colspan="${spanCount}">`;
                    
                    if (pivotTable.originalColumnHasChildren(node)) {
                        const expandClass = node.expanded ? 'expanded' : 'collapsed';
                        const dimName = data.extractDimensionName(columnFields[0]);
                        headerHtml += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${node._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="window.handleExpandCollapseClick(event)"></span>`;
                    }
                    
                    const displayLabel = pivotTable.getDisplayLabel(node);
                    headerHtml += `<span class="column-label">${displayLabel}</span>`;
                    headerHtml += '</th>';
                });
            });
            headerHtml += '</tr>';
            
            // Second column dimension level (showing actual cost element nodes)
            headerHtml += '<tr>';
            valueFields.forEach(() => {
                columnCombinations.forEach((combo, colIndex) => {
                    const lastNode = combo.nodes[combo.nodes.length - 1]; // Get the last (deepest) node
                    
                    headerHtml += `<th class="t5-column-header dimension-level-1" data-column-index="${colIndex}">`;
                    
                    if (pivotTable.originalColumnHasChildren(lastNode)) {
                        const expandClass = lastNode.expanded ? 'expanded' : 'collapsed';
                        const dimName = data.extractDimensionName(columnFields[columnFields.length - 1]);
                        headerHtml += `<span class="expand-collapse ${expandClass}" 
                            data-node-id="${lastNode._id}" 
                            data-hierarchy="${dimName}" 
                            data-zone="column"
                            onclick="window.handleExpandCollapseClick(event)"></span>`;
                    }
                    
                    // FIX 6: Show the actual node label (e.g., specific cost element names, not "COST ELEMENT")
                    const displayLabel = pivotTable.getDisplayLabel(lastNode);
                    headerHtml += `<span class="column-label" title="${displayLabel}">${displayLabel}</span>`;
                    headerHtml += '</th>';
                });
            });
            headerHtml += '</tr>';
        }
        
        return headerHtml;
    },


    /**
     * Get unique first-level nodes with their span counts
     */
    getUniqueFirstLevelNodes: function(columnCombinations) {
        const uniqueNodes = new Map();
        
        columnCombinations.forEach(combo => {
            const firstNode = combo.nodes[0];
            if (firstNode) {
                const key = firstNode._id;
                if (!uniqueNodes.has(key)) {
                    uniqueNodes.set(key, {
                        node: firstNode,
                        count: 0
                    });
                }
                uniqueNodes.get(key).count++;
            }
        });
        
        return Array.from(uniqueNodes.values());
    },


    /**
     * Render dimension cell for frozen area
     */
    renderTemplate5FrozenDimensionCell: function(node, field, dimIndex, pivotTable) {
        if (!node) {
            return `<td class="t5-dimension-cell dimension-${dimIndex} empty" data-dimension-index="${dimIndex}">
                <div class="cell-content">-</div>
            </td>`;
        }

        console.log(`🔍 Rendering T5 cell: dimIndex=${dimIndex}, field=${field}, node:`, node);

        const level = node.level || 0;
        let dimName = '';
        
        // FIXED: Extract dimension name properly
        if (typeof field === 'string') {
            dimName = pivotTable.extractDimensionNameSafe(field);
        } else if (field && field.field) {
            dimName = pivotTable.extractDimensionNameSafe(field.field);
        } else {
            dimName = `dim_${dimIndex}`;
        }
        
        // Calculate indentation based on level (12px per level)
        const indentPx = level * 12;
        
        let cellHtml = `<td class="t5-dimension-cell dimension-${dimIndex}" data-level="${level}" data-dimension-index="${dimIndex}" data-dimension="${dimName}">`;
        cellHtml += `<div class="cell-content" style="padding-left: ${indentPx}px;">`;
        
        // FIXED: Proper hierarchy control logic
        const hasChildren = this.nodeHasChildrenSafe(node, pivotTable, dimName);
        
        if (hasChildren) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id || node.id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                data-dimension-index="${dimIndex}"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${this.getDisplayLabelSafe(node)}"></span>`;
            console.log(`🎯 Added expand/collapse to ${node.label || node._id} (${dimName} dim ${dimIndex})`);
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
            console.log(`🍃 Leaf node: ${node.label || node._id} (${dimName} dim ${dimIndex})`);
        }
        
        const displayLabel = this.getDisplayLabelSafe(node);
        cellHtml += `<span class="dimension-label" title="${displayLabel}">${displayLabel}</span>`;
        
        cellHtml += '</div>';
        cellHtml += '</td>';
        
        return cellHtml;
    },


    /**
     * Safe helper to extract dimension name
     */
    extractDimensionNameSafe: function(field) {
        if (!field) return 'unknown';
        
        // Remove DIM_ prefix if present
        let dimName = field.toString();
        if (dimName.startsWith('DIM_')) {
            dimName = dimName.replace(/^DIM_/, '');
        }
        
        return dimName.toLowerCase();
    },


    /**
     * Safe helper to check if node has children
     */
    nodeHasChildrenSafe: function(node, pivotTable, dimName) {
        if (!node) return false;
        
        // Method 1: Direct children property
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            return true;
        }
        
        // Method 2: Check via pivotTable if available
        if (pivotTable && typeof pivotTable.nodeHasChildren === 'function') {
            try {
                return pivotTable.nodeHasChildren(node);
            } catch (error) {
                console.warn('⚠️ Error checking nodeHasChildren:', error);
            }
        }
        
        // Method 3: Check hierarchy structure if available
        if (pivotTable && pivotTable.state && pivotTable.state.hierarchies && dimName) {
            const hierarchy = pivotTable.state.hierarchies[dimName];
            if (hierarchy && hierarchy.nodesMap) {
                const originalNode = hierarchy.nodesMap[node._id || node.id];
                if (originalNode && originalNode.children && originalNode.children.length > 0) {
                    return true;
                }
            }
        }
        
        // Method 4: Check isLeaf property
        if (node.hasOwnProperty('isLeaf')) {
            return !node.isLeaf;
        }
        
        // Method 5: Check factId (nodes with factId are usually leaf nodes)
        if (node.factId) {
            return false; // Nodes with factId are typically leaf nodes
        }
        
        // Default: assume no children
        return false;
    },


    /**
     * Safe helper to get display label
     */
    getDisplayLabelSafe: function(node) {
        if (!node) return 'Unknown';
        
        // Try different label properties
        if (node.label) return node.label;
        if (node.displayLabel) return node.displayLabel;
        if (node.name) return node.name;
        if (node._id) return node._id;
        if (node.id) return node.id;
        
        return 'Unknown';
    },


    /**
     * ENHANCED: More robust row combination generation for Template 5
     */
    generateTemplate5RowCombinations: function(rowFields, pivotData, pivotTable) {
        console.log(`🔍 Generating T5 row combinations for ${rowFields.length} dimensions`);
        
        if (!rowFields || rowFields.length === 0) {
            return [];
        }
        
        // Method 1: Use pivotTable if available
        if (pivotTable && typeof pivotTable.generateEnhancedRowCombinations === 'function') {
            try {
                const combinations = pivotTable.generateEnhancedRowCombinations(rowFields);
                console.log(`✅ Generated ${combinations.length} combinations via pivotTable`);
                return combinations;
            } catch (error) {
                console.warn('⚠️ pivotTable.generateEnhancedRowCombinations failed:', error);
            }
        }
        
        // Method 2: Use pivotData.rows if available
        if (pivotData && pivotData.rows && Array.isArray(pivotData.rows)) {
            console.log(`📍 Using pivotData.rows (${pivotData.rows.length} rows) as fallback`);
            
            // Convert simple rows to combination format
            const combinations = pivotData.rows.slice(0, 20).map((row, index) => {
                // Create nodes for each dimension
                const nodes = rowFields.map((field, dimIndex) => {
                    const dimName = data.extractDimensionName(field);
                    
                    // Create a mock node structure
                    return {
                        _id: `${dimName}_${row._id || index}`,
                        label: row.label || row._id || `Item ${index + 1}`,
                        level: 0, // Start at level 0, will be adjusted by hierarchy
                        hierarchyField: field,
                        expanded: false,
                        isLeaf: true // Assume leaf for now
                    };
                });
                
                return {
                    nodes: nodes,
                    key: row._id || `row_${index}`
                };
            });
            
            console.log(`✅ Created ${combinations.length} mock combinations from pivotData.rows`);
            return combinations;
        }
        
        // Method 3: Create minimal placeholder combinations
        console.log('📍 Creating placeholder combinations');
        const placeholderCombinations = [];
        
        for (let i = 0; i < 5; i++) { // Create 5 placeholder rows
            const nodes = rowFields.map((field, dimIndex) => {
                const dimName = data.extractDimensionName(field);
                let label = `${dimName.toUpperCase()} ${i + 1}`;
                
                // Create dimension-appropriate labels
                if (dimName.includes('le') || dimName.includes('legal')) {
                    label = i === 0 ? 'WORLDWIDE' : `Entity ${i}`;
                } else if (dimName.includes('mc') || dimName.includes('management')) {
                    label = i === 0 ? 'Sanofi' : `Center ${i}`;
                }
                
                return {
                    _id: `${dimName}_${i}`,
                    label: label,
                    level: 0,
                    hierarchyField: field,
                    expanded: false,
                    isLeaf: i > 0 // First item can expand, others are leaves
                };
            });
            
            placeholderCombinations.push({
                nodes: nodes,
                key: `placeholder_${i}`
            });
        }
        
        console.log(`✅ Created ${placeholderCombinations.length} placeholder combinations`);
        return placeholderCombinations;
    },


    /**
     * Render value cell for scrollable area
     */
    renderTemplate5ValueCell: function(value, valueIndex, columnIndex, pivotTable) {
        return pivotTable.renderValueCell(value);
    },


    /**
     * Setup synchronized scrolling for Template 5
     */
    setupTemplate5SynchronizedScrolling: function(elements) {
        const frozenArea = elements.template5FrozenBody?.closest('.frozen-row-dimensions');
        const scrollableArea = elements.template5ScrollableBody?.closest('.scrollable-value-area');
        
        if (!frozenArea || !scrollableArea) return;
        
        let isScrolling = false;
        
        // Synchronize vertical scrolling only
        const syncVerticalScroll = (source, target) => {
            if (isScrolling) return;
            isScrolling = true;
            target.scrollTop = source.scrollTop;
            requestAnimationFrame(() => {
                isScrolling = false;
            });
        };
        
        // Frozen area scroll -> sync scrollable area
        frozenArea.addEventListener('scroll', () => {
            syncVerticalScroll(frozenArea, scrollableArea);
            this.alignTemplate5RowHeights(frozenArea, scrollableArea);
        });
        
        // Scrollable area scroll -> sync frozen area
        scrollableArea.addEventListener('scroll', () => {
            syncVerticalScroll(scrollableArea, frozenArea);
            this.alignTemplate5RowHeights(frozenArea, scrollableArea);
        });
        
        // Initial alignment
        this.alignTemplate5RowHeights(frozenArea, scrollableArea);
        
        console.log('📜 Template5 synchronized scrolling setup complete');
    },


    /**
     * Align row heights between frozen and scrollable areas
     */
    alignTemplate5RowHeights: function(frozenArea, scrollableArea) {
        try {
            const frozenRows = frozenArea.querySelectorAll('tbody tr');
            const scrollableRows = scrollableArea.querySelectorAll('tbody tr');
            
            const maxRows = Math.min(frozenRows.length, scrollableRows.length);
            
            for (let i = 0; i < maxRows; i++) {
                const frozenRow = frozenRows[i];
                const scrollableRow = scrollableRows[i];
                
                if (!frozenRow || !scrollableRow) continue;
                
                // Reset heights
                frozenRow.style.height = 'auto';
                scrollableRow.style.height = 'auto';
                
                // Get natural heights and apply maximum
                const frozenHeight = frozenRow.offsetHeight;
                const scrollableHeight = scrollableRow.offsetHeight;
                const maxHeight = Math.max(frozenHeight, scrollableHeight, 40);
                
                frozenRow.style.height = `${maxHeight}px`;
                scrollableRow.style.height = `${maxHeight}px`;
            }
        } catch (error) {
            console.error('Error aligning Template5 row heights:', error);
        }
    },


    /**
     * TEMPLATE 6: 1 row + 2+ columns + values
     * Single row with multi-column cross-tabulation
     */
    renderTemplate6: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`📊 Template6 Enhanced: Single row × hierarchical multi-column (${rowFields.length} row × ${columnFields.length} columns × ${valueFields.length} values)`);
        
        // Apply Template 6 specific CSS
        this.applyTemplate6CSS(elements, columnFields, valueFields);
        
        // Render hierarchical header structure
        this.renderTemplate6HierarchicalHeader(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        // Render body with cross-tabulated values
        this.renderTemplate6HierarchicalBody(elements, pivotData, rowFields, columnFields, valueFields, pivotTable);
        
        console.log('✅ Template6 enhanced rendering complete');
    },    


    /**
     * Apply Template 6 specific CSS classes
     */
    applyTemplate6CSS: function(elements, columnFields, valueFields) {
        const container = elements.pivotTableHeader?.closest('.pivot-table-container');
        if (!container) return;
        
        const columnCount = columnFields.length;
        const valueCount = valueFields.length;
        
        // Remove existing classes
        container.classList.remove(
            'column-dimensions-1', 'column-dimensions-2', 'column-dimensions-3', 
            'column-dimensions-4', 'column-dimensions-5'
        );
        
        // Add current classes
        container.classList.add(`column-dimensions-${Math.min(columnCount, 5)}`);
        container.classList.add(`value-fields-${Math.min(valueCount, 5)}`);
        
        // IMPROVEMENT 1: Ensure row dimension takes minimum 25% width
        container.classList.add('template6-row-width-constraint');
        
        console.log(`🎨 Applied Template6 CSS: column-dimensions-${columnCount}, value-fields-${valueCount}`);
    }, 


    /**
     * Render hierarchical header structure for Template 6
     */
    renderTemplate6HierarchicalHeader: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template6 hierarchical header: ${columnFields.length} column levels`);
        
        // Get hierarchical column combinations
        const columnCombinations = this.generateTemplate6ColumnCombinations(pivotData, columnFields, pivotTable);
        console.log(`📊 Generated ${columnCombinations.length} column combinations for Template6`);
        
        let headerHtml = '';
        
        // Calculate total header rows needed: 1 (row header) + 1 (measures) + N (value fields) + M (column dimensions)
        const totalHeaderRows = 2 + valueFields.length + columnFields.length;
        
        // Row 1: Row dimension header with mega rowspan
        headerHtml += '<tr>';
        const rowDimName = this.getRealDimensionName(rowFields[0]);
        headerHtml += `<th class="t6-row-header" rowspan="${totalHeaderRows}">${rowDimName}</th>`;
        
        // Measures header spanning all value cells
        const totalValueCells = columnCombinations.length * valueFields.length;
        headerHtml += `<th class="t6-measures-header" colspan="${totalValueCells}">MEASURES</th>`;
        headerHtml += '</tr>';
        
        // Row 2: Value field headers
        headerHtml += '<tr>';
        valueFields.forEach((field, valueIndex) => {
            const fieldLabel = pivotTable.getFieldLabel(field);
            headerHtml += `<th class="t6-measure-header" colspan="${columnCombinations.length}" data-value-index="${valueIndex}">`;
            headerHtml += `<div class="header-content">${fieldLabel}</div>`;
            headerHtml += '</th>';
        });
        headerHtml += '</tr>';
        
        // Rows 3+: Hierarchical column dimension headers
        headerHtml += this.buildTemplate6HierarchicalColumnHeaders(columnCombinations, columnFields, valueFields, pivotTable);
        
        elements.pivotTableHeader.innerHTML = headerHtml;
        console.log(`✅ Template6 header built with ${totalHeaderRows} rows`);
    },    


    /**
     * Generate hierarchical column combinations for Template 6
     */
    generateTemplate6ColumnCombinations: function(pivotData, columnFields, pivotTable) {
        console.log(`🔍 Generating Template6 hierarchical column combinations for ${columnFields.length} dimensions`);
        
        // FIXED: Allow root nodes to be displayed
        const columns = this.filterColumnsForDisplay(pivotData.columns, true);
        
        console.log(`🔍 Found ${columns.length} valid column nodes from ${columnFields.length} column fields`);
        
        if (columnFields.length === 1) {
            // Single column dimension
            return this.generateSingleColumnCombinations(columns, columnFields[0], pivotTable);
        } else if (columnFields.length >= 2) {
            // Multi-column hierarchical dimensions
            return this.generateMultiColumnHierarchicalCombinations(columns, columnFields, pivotTable);
        }
        
        return [];
    },



    /**
     * Generate combinations for single column dimension
     */
    generateSingleColumnCombinations: function(columns, field, pivotTable) {
        const dimName = data.extractDimensionName(field);
        const visibleNodes = this.getVisibleColumnNodesForTemplate6(columns, field, pivotTable);
        
        console.log(`🔍 Single column dimension ${dimName}: ${visibleNodes.length} visible nodes`);
        
        return visibleNodes.map(col => ({
            nodes: [col],
            labels: [pivotTable.getDisplayLabel(col)],
            key: col._id,
            spanInfo: { level: 0, span: 1 }
        }));
    },


    /**
     * Generate hierarchical combinations for multiple column dimensions
     */
    generateMultiColumnHierarchicalCombinations: function(columns, columnFields, pivotTable) {
        console.log(`🔍 Generating hierarchical combinations for ${columnFields.length} column dimensions`);
        
        // Group columns by dimension with hierarchy awareness
        const dimensionColumns = this.groupColumnsByDimension(columns, columnFields, pivotTable);
        
        // Generate hierarchical cartesian product
        const combinations = this.generateHierarchicalCartesianProduct(dimensionColumns, columnFields, pivotTable);
        
        console.log(`✅ Generated ${combinations.length} hierarchical combinations`);
        return combinations;
    },



    /**
     * Group columns by dimension with hierarchy awareness
     */
    groupColumnsByDimension: function(columns, columnFields, pivotTable) {
        const dimensionColumns = {};
        
        columnFields.forEach(field => {
            const dimName = data.extractDimensionName(field);
            const dimColumns = columns.filter(col => {
                if (!col.hierarchyField) return false;
                const colDimName = data.extractDimensionName(col.hierarchyField);
                return colDimName === dimName;
            });
            
            // Get hierarchically visible nodes for this dimension
            dimensionColumns[field] = this.getHierarchicallyVisibleNodes(dimColumns, field, pivotTable);
            console.log(`📊 Dimension ${dimName}: ${dimensionColumns[field].length} hierarchically visible nodes`);
        });
        
        return dimensionColumns;
    },



    /**
     * Get hierarchically visible nodes respecting expand/collapse state
     */
    getHierarchicallyVisibleNodes: function(dimensionColumns, field, pivotTable) {
        const dimName = data.extractDimensionName(field);
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) {
            // Fallback to leaf nodes
            return dimensionColumns.filter(col => 
                !this.columnNodeHasExpandableChildren(col, pivotTable) || col.factId
            ).slice(0, 10);
        }
        
        const visibleNodes = [];
        const rootNode = hierarchy.nodesMap['ROOT'];
        
        if (rootNode) {
            this.traverseHierarchyForVisibleNodes(rootNode, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable);
        }
        
        // Fallback if no nodes found
        if (visibleNodes.length === 0) {
            return dimensionColumns.filter(col => (col.level || 0) <= 1).slice(0, 5);
        }
        
        return visibleNodes;
    },



    /**
     * Traverse hierarchy to find currently visible nodes
     */
    traverseHierarchyForVisibleNodes: function(node, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable) {
        if (!node) return;
        
        const columnNode = dimensionColumns.find(col => col._id === node.id);
        if (!columnNode) return;
        
        const isExpanded = pivotTable.state?.expandedNodes?.[dimName]?.column?.[node.id] || false;
        
        if (node.isLeaf || !node.children || node.children.length === 0) {
            // Leaf node - always include
            visibleNodes.push(columnNode);
        } else if (!isExpanded) {
            // Collapsed parent - include the parent node itself
            visibleNodes.push(columnNode);
        } else {
            // Expanded parent - include visible children
            node.children.forEach(childId => {
                const childNode = hierarchy.nodesMap[childId];
                if (childNode) {
                    this.traverseHierarchyForVisibleNodes(childNode, hierarchy, dimensionColumns, visibleNodes, dimName, pivotTable);
                }
            });
        }
    },
    


    /**
     * Generate hierarchical cartesian product with spanning information
     */
    generateHierarchicalCartesianProduct: function(dimensionColumns, columnFields, pivotTable) {
        const combinations = [];
        
        if (columnFields.length === 2) {
            const [field1, field2] = columnFields;
            const nodes1 = dimensionColumns[field1] || [];
            const nodes2 = dimensionColumns[field2] || [];
            
            nodes1.forEach(node1 => {
                nodes2.forEach(node2 => {
                    combinations.push({
                        nodes: [node1, node2],
                        labels: [pivotTable.getDisplayLabel(node1), pivotTable.getDisplayLabel(node2)],
                        key: `${node1._id}|${node2._id}`,
                        spanInfo: {
                            level1: { node: node1, span: nodes2.length },
                            level2: { node: node2, span: 1 }
                        }
                    });
                });
            });
        } else if (columnFields.length >= 3) {
            // Recursive approach for 3+ dimensions
            this.generateRecursiveCartesianProduct(dimensionColumns, columnFields, combinations, pivotTable, [], [], '', 0);
        }
        
        return combinations;
    },
   


    /**
     * Recursive cartesian product generator for 3+ dimensions
     */
    generateRecursiveCartesianProduct: function(dimensionColumns, columnFields, combinations, pivotTable, currentNodes, currentLabels, currentKey, fieldIndex) {
        if (fieldIndex >= columnFields.length) {
            combinations.push({
                nodes: [...currentNodes],
                labels: [...currentLabels],
                key: currentKey,
                spanInfo: this.calculateSpanInfo(currentNodes, dimensionColumns, columnFields)
            });
            return;
        }
        
        const field = columnFields[fieldIndex];
        const nodes = dimensionColumns[field] || [];
        
        // Limit for performance
        const maxNodes = fieldIndex === 0 ? 5 : 3;
        const nodesToUse = nodes.slice(0, maxNodes);
        
        nodesToUse.forEach(node => {
            this.generateRecursiveCartesianProduct(
                dimensionColumns,
                columnFields,
                combinations,
                pivotTable,
                [...currentNodes, node],
                [...currentLabels, pivotTable.getDisplayLabel(node)],
                currentKey ? `${currentKey}|${node._id}` : node._id,
                fieldIndex + 1
            );
        });
    },
   


    /**
     * Calculate spanning information for multi-level headers
     */
    calculateSpanInfo: function(nodes, dimensionColumns, columnFields) {
        const spanInfo = {};
        
        nodes.forEach((node, index) => {
            const field = columnFields[index];
            const remainingNodes = columnFields.slice(index + 1).reduce((product, f) => {
                const fieldNodes = dimensionColumns[f] || [];
                return product * fieldNodes.length;
            }, 1);
            
            spanInfo[`level${index + 1}`] = {
                node: node,
                span: Math.max(remainingNodes, 1)
            };
        });
        
        return spanInfo;
    },
    


    /**
     * Build hierarchical column headers with proper spanning
     */
    buildTemplate6HierarchicalColumnHeaders: function(columnCombinations, columnFields, valueFields, pivotTable) {
        let headerHtml = '';
        
        // Build each column dimension level
        columnFields.forEach((field, levelIndex) => {
            headerHtml += '<tr>';
            
            valueFields.forEach((valueField, valueIndex) => {
                if (levelIndex === 0) {
                    // IMPROVEMENT 2: Top level - higher dimension nodes with expand/collapse (no leaf icons)
                    const topLevelSpans = this.calculateTemplate6TopLevelSpans(columnCombinations, levelIndex);
                    topLevelSpans.forEach(spanInfo => {
                        headerHtml += this.renderTemplate6HigherDimensionHeader(spanInfo, field, levelIndex, valueIndex, pivotTable);
                    });
                } else {
                    // IMPROVEMENT 3 & 4: Lower dimension nodes - repeated for each higher dimension node
                    headerHtml += this.renderTemplate6LowerDimensionHeaders(columnCombinations, field, levelIndex, valueField, valueIndex, pivotTable);
                }
            });
            
            headerHtml += '</tr>';
        });
        
        return headerHtml;
    },    


    /**
     * Render higher dimension header (blue arrow level) - IMPROVEMENT 2
     * Always show expand/collapse, never show leaf node icons
     */
    renderTemplate6HigherDimensionHeader: function(spanInfo, field, levelIndex, valueIndex, pivotTable) {
        const node = spanInfo.node;
        const spanCount = spanInfo.spanCount;
        const isRootNode = node._id === 'ROOT';
        
        let headerHtml = `<th class="t6-column-header dimension-level-${levelIndex} ${isRootNode ? 'root-node' : ''}" colspan="${spanCount}" data-node-id="${node._id}" data-value-index="${valueIndex}">`;
        
        // Always add expand/collapse for higher dimension nodes (including root)
        const dimName = data.extractDimensionName(field);
        const isExpanded = this.isColumnNodeExpanded(node, dimName, pivotTable);
        const expandClass = isExpanded ? 'expanded' : 'collapsed';
        
        headerHtml += `<span class="expand-collapse ${expandClass}" 
            data-node-id="${node._id}" 
            data-hierarchy="${dimName}" 
            data-zone="column"
            onclick="window.handleExpandCollapseClick(event)"
            title="Expand/collapse ${pivotTable.getDisplayLabel(node)} (spans ${spanCount} columns)"></span>`;
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        headerHtml += `<span class="column-label ${isRootNode ? 'root-label' : ''}">${displayLabel}</span>`;
        headerHtml += '</th>';
        
        return headerHtml;
    },


    /**
     * Render lower dimension headers (orange arrow level) - IMPROVEMENTS 3 & 4
     * Show expand/collapse only if has children, no leaf icons, repeat for each higher dimension
     */
    renderTemplate6LowerDimensionHeaders: function(columnCombinations, field, levelIndex, valueField, valueIndex, pivotTable) {
        let headerHtml = '';
        const dimName = data.extractDimensionName(field);
        
        // IMPROVEMENT 4: Get lower dimension nodes for this specific value field
        const lowerDimensionNodes = this.getLowerDimensionNodesForValue(columnCombinations, levelIndex, valueField, valueIndex);
        
        lowerDimensionNodes.forEach((nodeInfo, nodeIndex) => {
            const node = nodeInfo.node;
            
            headerHtml += `<th class="t6-column-header dimension-level-${levelIndex}" data-column-index="${nodeInfo.comboIndex}" data-node-id="${node._id}" data-value-index="${valueIndex}">`;
            
            // IMPROVEMENT 3: Only add expand/collapse if node has children, never show leaf icons in column zone
            if (this.columnNodeHasExpandableChildren(node, pivotTable)) {
                const isExpanded = this.isColumnNodeExpanded(node, dimName, pivotTable);
                const expandClass = isExpanded ? 'expanded' : 'collapsed';
                headerHtml += `<span class="expand-collapse ${expandClass}" 
                    data-node-id="${node._id}" 
                    data-hierarchy="${dimName}" 
                    data-zone="column"
                    onclick="window.handleExpandCollapseClick(event)"
                    title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
            }
            // IMPROVEMENT 3: No leaf node icons in column zone - just empty space
            
            const displayLabel = pivotTable.getDisplayLabel(node);
            headerHtml += `<span class="column-label" title="${displayLabel}">${displayLabel}</span>`;
            headerHtml += '</th>';
        });
        
        return headerHtml;
    },    


    /**
     * Check if column node is expanded - helper function
     */
    isColumnNodeExpanded: function(node, dimName, pivotTable) {
        if (!pivotTable || !pivotTable.state || !pivotTable.state.expandedNodes) {
            return false;
        }
        
        const expandedNodes = pivotTable.state.expandedNodes[dimName];
        if (!expandedNodes || !expandedNodes.column) {
            return false;
        }
        
        return expandedNodes.column[node._id] || false;
    },
   

    /**
     * Get lower dimension nodes for specific value field - IMPROVEMENT 4
     */
    getLowerDimensionNodesForValue: function(columnCombinations, levelIndex, valueField, valueIndex) {
        const nodes = [];
        
        // Filter combinations for this specific value field context
        const relevantCombinations = columnCombinations.filter((combo, index) => {
            // Include all combinations for the current value field
            return true;
        });
        
        relevantCombinations.forEach((combo, comboIndex) => {
            const node = combo.nodes[levelIndex];
            if (node) {
                nodes.push({
                    node: node,
                    comboIndex: comboIndex,
                    valueIndex: valueIndex,
                    parentNode: levelIndex > 0 ? combo.nodes[levelIndex - 1] : null
                });
            }
        });
        
        return nodes;
    },


    /**
     * Calculate top-level spans for Template 6
     */
    calculateTemplate6TopLevelSpans: function(columnCombinations, levelIndex) {
        const spans = [];
        const processedNodes = new Set();
        
        columnCombinations.forEach((combo, comboIndex) => {
            const node = combo.nodes[levelIndex];
            if (!node || processedNodes.has(node._id)) return;
            
            // Calculate span count
            let spanCount = 0;
            let startIndex = comboIndex;
            
            for (let i = comboIndex; i < columnCombinations.length; i++) {
                const otherNode = columnCombinations[i].nodes[levelIndex];
                if (otherNode && otherNode._id === node._id) {
                    spanCount++;
                } else {
                    break; // Stop when we hit a different node
                }
            }
            
            spans.push({
                node: node,
                spanCount: spanCount,
                startIndex: startIndex
            });
            
            processedNodes.add(node._id);
        });
        
        return spans;
    },    


    /**
     * Group nodes by their parent for proper hierarchy display
     */
    groupNodesByParent: function(columnCombinations, levelIndex) {
        const groups = [];
        const processedNodes = new Set();
        
        columnCombinations.forEach((combo, comboIndex) => {
            const node = combo.nodes[levelIndex];
            if (!node || processedNodes.has(node._id)) return;
            
            groups.push({
                node: node,
                comboIndex: comboIndex,
                parentNode: levelIndex > 0 ? combo.nodes[levelIndex - 1] : null
            });
            
            processedNodes.add(node._id);
        });
        
        return groups;
    },
    

    /**
     * Render spanning header cell for top-level nodes
     */
    renderTemplate6SpanningHeader: function(spanInfo, field, levelIndex, pivotTable) {
        const node = spanInfo.node;
        const spanCount = spanInfo.spanCount;
        
        let headerHtml = `<th class="t6-column-header dimension-level-${levelIndex}" colspan="${spanCount}" data-node-id="${node._id}">`;
        
        // Add expand/collapse control if node has children
        if (this.columnNodeHasExpandableChildren(node, pivotTable)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            const dimName = data.extractDimensionName(field);
            headerHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="column"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${pivotTable.getDisplayLabel(node)} (spans ${spanCount} columns)"></span>`;
            console.log(`🎯 Template6: Added expand/collapse to spanning node ${node.label} (span: ${spanCount})`);
        } else {
            headerHtml += '<span class="leaf-node-empty"></span>';
        }
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        headerHtml += `<span class="column-label">${displayLabel}</span>`;
        headerHtml += '</th>';
        
        return headerHtml;
    },


    /**
     * Render grouped header cell for lower-level nodes
     */
    renderTemplate6GroupedHeader: function(group, field, levelIndex, pivotTable) {
        const node = group.node;
        
        let headerHtml = `<th class="t6-column-header dimension-level-${levelIndex}" data-column-index="${group.comboIndex}" data-node-id="${node._id}">`;
        
        // Add expand/collapse control if node has children
        if (this.columnNodeHasExpandableChildren(node, pivotTable)) {
            const expandClass = node.expanded ? 'expanded' : 'collapsed';
            const dimName = data.extractDimensionName(field);
            headerHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${node._id}" 
                data-hierarchy="${dimName}" 
                data-zone="column"
                onclick="window.handleExpandCollapseClick(event)"
                title="Expand/collapse ${pivotTable.getDisplayLabel(node)}"></span>`;
        } else {
            headerHtml += '<span class="leaf-node-empty"></span>';
        }
        
        const displayLabel = pivotTable.getDisplayLabel(node);
        headerHtml += `<span class="column-label" title="${displayLabel}">${displayLabel}</span>`;
        headerHtml += '</th>';
        
        return headerHtml;
    },


    /**
     * Get visible column nodes for Template 6
     */
    getVisibleColumnNodesForTemplate6: function(dimensionColumns, field, pivotTable) {
        return dimensionColumns.filter(col => {
            // Include leaf nodes or expanded parent nodes
            return !this.columnNodeHasExpandableChildren(col, pivotTable) || 
                col.factId || 
                col.expanded;
        }).slice(0, 15); // Slightly higher limit for Template 6
    },    


    /**
     * Render body with hierarchical cross-tabulation
     */
    renderTemplate6HierarchicalBody: function(elements, pivotData, rowFields, columnFields, valueFields, pivotTable) {
        console.log(`🏗️ Building Template6 hierarchical body...`);
        
        const visibleRows = pivotTable.getVisibleRowsWithoutDuplicates(pivotData.rows);
        const columnCombinations = this.generateTemplate6ColumnCombinations(pivotData, columnFields, pivotTable);
        
        let bodyHtml = '';
        
        if (visibleRows.length === 0 || columnCombinations.length === 0) {
            const totalCols = 1 + (columnCombinations.length * valueFields.length);
            bodyHtml = `<tr><td colspan="${totalCols}" class="empty-message">No data to display. Try expanding some dimensions.</td></tr>`;
        } else {
            visibleRows.forEach((row, index) => {
                bodyHtml += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}">`;
                
                // Row cell with hierarchy support
                bodyHtml += this.renderTemplate6RowCell(row, rowFields[0]);
                
                // Cross-tabulated value cells
                valueFields.forEach(field => {
                    columnCombinations.forEach((combo, colIndex) => {
                        const value = pivotTable.calculateMultiDimensionalValue([row], combo.nodes, field);
                        bodyHtml += this.renderTemplate6ValueCell(value, field, colIndex, pivotTable);
                    });
                });
                
                bodyHtml += '</tr>';
            });
        }
        
        elements.pivotTableBody.innerHTML = bodyHtml;
        pivotTable.attachEventListeners(elements.pivotTableBody);
        
        console.log(`✅ Template6 body built with ${visibleRows.length} rows × ${columnCombinations.length} column combinations`);
    },    


    /**
     * Render value cell with total support
     */
    renderTemplate6ValueCellWithTotal: function(value, field, columnIndex, combo, pivotTable) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        let cellClass = 'value-cell t6-value-cell';
        
        // Add special styling for totals
        if (combo.isTotal) {
            cellClass += ' t6-total-cell';
        } else if (combo.isCollapsedTotal) {
            cellClass += ' t6-collapsed-total-cell';
        }
        
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        const formattedValue = pivotTable.formatValue(numericValue);

        return `<td class="${cellClass}" data-raw-value="${numericValue}" data-column-index="${columnIndex}" data-field="${field}" data-is-total="${combo.isTotal || false}" data-is-collapsed-total="${combo.isCollapsedTotal || false}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },


    /**
     * Calculate total for collapsed parent (all children, including hidden ones)
     */
    calculateTotalForCollapsedParent: function(row, parentNode, field, pivotTable) {
        // Calculate total including all children (visible and hidden)
        const dimName = data.extractDimensionName(parentNode.hierarchyField);
        const hierarchy = pivotTable.state?.hierarchies?.[dimName];
        
        if (!hierarchy || !hierarchy.nodesMap) {
            // Fallback calculation
            return pivotTable.calculateMultiDimensionalValue([row], [parentNode], field);
        }
        
        const originalNode = hierarchy.nodesMap[parentNode._id];
        if (!originalNode || !originalNode.children) {
            return pivotTable.calculateMultiDimensionalValue([row], [parentNode], field);
        }
        
        let total = 0;
        originalNode.children.forEach(childId => {
            // Create mock child node for calculation
            const mockChildNode = {
                _id: childId,
                hierarchyField: parentNode.hierarchyField
            };
            
            const childValue = pivotTable.calculateMultiDimensionalValue([row], [parentNode, mockChildNode], field);
            if (typeof childValue === 'number') {
                total += childValue;
            }
        });
        
        return total;
    },


    /**
     * Calculate total for expanded parent (sum of visible children)
     */
    calculateTotalForExpandedParent: function(row, parentNode, field, pivotTable) {
        // Get all child nodes for this parent
        const childNodes = this.getChildNodesForParent(parentNode, [], pivotTable);
        
        let total = 0;
        childNodes.forEach(childNode => {
            const childValue = pivotTable.calculateMultiDimensionalValue([row], [parentNode, childNode], field);
            if (typeof childValue === 'number') {
                total += childValue;
            }
        });
        
        return total;
    },


    /**
     * Render row cell for Template 6
     */
    renderTemplate6RowCell: function(row, field) {
        const level = row.level || 0;
        const indentationPx = 4 + (level * 30);
        const dimName = data.extractDimensionName(field);
        
        let cellHtml = `<td class="t6-hierarchy-cell" data-level="${level}" style="padding-left: ${indentationPx}px !important;">`;
        
        if (row.hasChildren) {
            const expandClass = row.expanded ? 'expanded' : 'collapsed';
            cellHtml += `<span class="expand-collapse ${expandClass}" 
                data-node-id="${row._id}" 
                data-hierarchy="${dimName}" 
                data-zone="row"
                onclick="window.handleExpandCollapseClick(event)"></span>`;
        } else {
            cellHtml += '<span class="leaf-node-empty"></span>';
        }
        
        cellHtml += `<span class="dimension-label">${pivotTable.getDisplayLabel(row)}</span>`;
        cellHtml += '</td>';
        
        return cellHtml;
    },    


    /**
     * Render value cell for Template 6
     */
    renderTemplate6ValueCell: function(value, field, columnIndex, pivotTable) {
        let numericValue;

        if (value === undefined || value === null) {
            numericValue = 0;
        } else if (typeof value === 'number') {
            numericValue = value;
        } else {
            numericValue = parseFloat(String(value));
            if (isNaN(numericValue)) numericValue = 0;
        }

        let cellClass = 'value-cell t6-value-cell';
        if (numericValue !== 0) {
            cellClass += ' non-zero-value';
            if (numericValue < 0) {
                cellClass += ' negative-value';
            }
            if (Math.abs(numericValue) >= 1000000) {
                cellClass += ' large-value';
            } else if (Math.abs(numericValue) >= 1000) {
                cellClass += ' medium-value';
            }
        }

        const formattedValue = pivotTable.formatValue(numericValue);

        return `<td class="${cellClass}" data-raw-value="${numericValue}" data-column-index="${columnIndex}" data-field="${field}">
            <div class="cell-content">${formattedValue}</div>
        </td>`;
    },


    /**
     * Enhanced check for node children
     */
    nodeHasChildrenEnhanced: function(node, pivotTable) {
        if (!node) return false;
        
        // Method 1: Direct children property
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            console.log(`✅ Enhanced: Node ${node._id} has direct children: ${node.children.length}`);
            return true;
        }
        
        // Method 2: Check via pivotTable hierarchy system
        if (pivotTable && node.hierarchyField) {
            const dimName = data.extractDimensionName ? data.extractDimensionName(node.hierarchyField) : node.hierarchyField;
            const hierarchy = pivotTable.state?.hierarchies?.[dimName];
            
            if (hierarchy && hierarchy.nodesMap) {
                const originalNode = hierarchy.nodesMap[node._id];
                if (originalNode && originalNode.children && originalNode.children.length > 0) {
                    console.log(`✅ Enhanced: Node ${node._id} in ${dimName}: ${originalNode.children.length} children via hierarchy`);
                    return true;
                }
            }
        }
        
        // Method 3: Check isLeaf property (inverse logic)
        if (node.hasOwnProperty('isLeaf')) {
            const hasChildren = !node.isLeaf;
            if (hasChildren) {
                console.log(`✅ Enhanced: Node ${node._id} isLeaf=${node.isLeaf}, hasChildren=${hasChildren}`);
                return true;
            }
        }
        
        console.log(`❌ Enhanced: Node ${node._id} - no children found`);
        return false;
    },


    /**
     * Get enhanced visible column nodes
     */
    getVisibleColumnNodesEnhanced: function(dimensionColumns, field, pivotTable) {
        return dimensionColumns.filter(col => {
            return !this.nodeHasChildrenEnhanced(col, pivotTable) || col.factId;
        }).slice(0, 10);
    },


    /**
     * Replace the existing column filtering in all template functions
     * with this improved version that allows meaningful root nodes
     */
    filterColumnsForDisplay: function(columns, allowRootNodes = true) {
        return columns.filter(col => {
            // Always exclude these system values
            if (col._id === 'VALUE' || 
                col.label === 'VALUE' || 
                col.label === 'Value' ||
                col._id === 'default' || 
                col._id === 'no_columns' ||
                col.label === 'Measures') {
                return false;
            }
            
            // Handle ROOT nodes based on allowRootNodes parameter
            if (col._id === 'ROOT') {
                if (!allowRootNodes) {
                    return false;
                }
                // Include ROOT nodes that have meaningful data or children
                return col.hierarchyField && (col.hasChildren || col.children?.length > 0 || col.factId);
            }
            
            // Include other nodes with hierarchy field
            return col.hierarchyField;
        });
    },


    /**
     * Add this method to better handle root node visibility
     */
    shouldDisplayRootNode: function(rootNode, pivotTable) {
        if (!rootNode || rootNode._id !== 'ROOT') {
            return false;
        }
        
        // Check if root node has meaningful children or data
        if (rootNode.children && rootNode.children.length > 0) {
            return true;
        }
        
        // Check if root node has factId (contains actual data)
        if (rootNode.factId) {
            return true;
        }
        
        // Check via hierarchy system
        if (rootNode.hierarchyField && pivotTable?.state?.hierarchies) {
            const dimName = data.extractDimensionName(rootNode.hierarchyField);
            const hierarchy = pivotTable.state.hierarchies[dimName];
            
            if (hierarchy?.root?.children?.length > 0) {
                return true;
            }
        }
        
        return false;
    },


    /**
     * Enhanced visible column nodes that includes root
     */
    getVisibleColumnNodesWithRoot: function(dimensionColumns, field, pivotTable) {
        // First, check if we have a meaningful root node
        const rootNode = dimensionColumns.find(col => col._id === 'ROOT');
        const visibleNodes = [];
        
        if (rootNode && this.shouldDisplayRootNode(rootNode, pivotTable)) {
            // Include the root node if it's meaningful
            visibleNodes.push(rootNode);
            console.log(`✅ Including ROOT node for ${field}: ${rootNode.label || 'ROOT'}`);
        }
        
        // Add other visible nodes (non-root)
        const otherNodes = dimensionColumns.filter(col => {
            return col._id !== 'ROOT' && 
                (!this.columnNodeHasExpandableChildren(col, pivotTable) || col.factId);
        });
        
        visibleNodes.push(...otherNodes);
        
        console.log(`📊 Total visible nodes for ${field}: ${visibleNodes.length} (${rootNode && this.shouldDisplayRootNode(rootNode, pivotTable) ? 'including' : 'excluding'} root)`);
        
        return visibleNodes.slice(0, 15);
    },

};


// Export the template system
export default PivotTemplateSystem;