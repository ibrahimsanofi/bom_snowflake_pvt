generatePivotTable: function() {
        if (!this.state) {
            console.error("No state connection");
            return;
        }

        console.log("🔄 Starting template-based pivot table generation...");

        // Reset table structure
        this.resetTableStructure();

        const elements = {
            pivotTableHeader: document.getElementById('pivotTableHeader'),
            pivotTableBody: document.getElementById('pivotTableBody')
        };

        if (!elements.pivotTableHeader || !elements.pivotTableBody) {
            console.error("Cannot find pivot table DOM elements");
            return;
        }

        const rowFields = this.state.rowFields || [];
        const columnFields = this.state.columnFields || [];
        const valueFields = this.state.valueFields || ['COST_UNIT'];
        
        console.log(`📊 Template-based generation: ${rowFields.length} row fields, ${columnFields.length} column fields, ${valueFields.length} value fields`);

        try {
            // Process pivot data
            this.processPivotData();
            
            // Determine template type
            const templateType = PivotTemplateSystem.getTemplateType(rowFields, columnFields, valueFields);
            
            // Render using appropriate template
            PivotTemplateSystem.renderTemplate(
                templateType, 
                elements, 
                this.state.pivotData, 
                rowFields, 
                columnFields, 
                valueFields, 
                this
            );

            // ⭐ HIDE ZERO ROWS AND COLUMNS
            // setTimeout(() => {
            //     const result = this.hideZeroRowsAndColumns();
            //     if (result && result.totalHidden > 0) {
            //         console.log(`🎯 Optimized view: ${result.hiddenRows} rows + ${result.hiddenColumns} columns hidden`);
            //     }
            // }, 100); // Small delay to ensure DOM is ready

            console.log(`✅ Template-based pivot table generation complete using ${templateType.toUpperCase()}`);

        } catch (error) {
            console.error("Error in template-based pivot generation:", error);
            if (elements.pivotTableBody) {
                elements.pivotTableBody.innerHTML = '<tr><td colspan="100%">Error generating pivot table</td></tr>';
            }
        }
    },