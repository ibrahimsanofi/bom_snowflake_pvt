// Export logic for BOM Pivot Table (Excel/CSV)

import stateModule from './state.js';

const state = stateModule.state;

function getVisibleRows(rows, isNodeVisible) {
  return rows.filter(row => isNodeVisible(row, rows));
}

function getVisibleLeafColumns(columns, getChildNodes) {
  const visible = [];
  function process(col) {
    if (!col) return;
    if (col.skipInUI) return;
    if (col.isLeaf) { visible.push(col); return; }
    if (!col.expanded) { visible.push(col); return; }
    if (col.children && col.children.length > 0) {
      const children = getChildNodes(col);
      children.forEach(process);
    } else {
      visible.push(col);
    }
  }
  columns.forEach(process);
  return visible;
}

// Get display label path for a node (do NOT skip first node)
function getDisplayLabelPath(node, hierarchy) {
  if (!node || !node.path || !hierarchy || !hierarchy.nodesMap) return '';
  // Do NOT skip 'ROOT' in path
  const ids = node.path;
  const labels = ids.map(id => {
    const n = hierarchy.nodesMap[id];
    return n ? n.label : id;
  });
  return labels.join('/');
}

// Get display label path as array (do NOT skip first node)
function getDisplayLabelPathArray(node, hierarchy) {
  if (!node || !node.path || !hierarchy || !hierarchy.nodesMap) return [];
  const ids = node.path;
  return ids.map(id => {
    const n = hierarchy.nodesMap[id];
    return n ? n.label : id;
  });
}

// For multi-dimension row, get label path for each dimension
function getMultiDimRowLabelPaths(row, state) {
  if (!row.dimensions || !Array.isArray(row.dimensions)) return [];
  return row.dimensions.map((dim, i) => {
    const dimName = dim.hierarchyField ? dim.hierarchyField.replace('DIM_', '').toLowerCase() : '';
    const hierarchy = state.hierarchies[dimName];
    return getDisplayLabelPath(dim, hierarchy);
  });
}

// For multi-dimension row, get label path arrays for each dimension
function getMultiDimRowLabelPathArrays(row, state) {
  if (!row.dimensions || !Array.isArray(row.dimensions)) return [];
  return row.dimensions.map(dim => {
    const dimName = dim.hierarchyField ? dim.hierarchyField.replace('DIM_', '').toLowerCase() : '';
    const hierarchy = state.hierarchies[dimName];
    return getDisplayLabelPathArray(dim, hierarchy);
  });
}

function buildExportData({pivotData, rowFields, columnFields, valueFields, getChildNodes, isNodeVisible}) {
  const rows = getVisibleRows(pivotData.rows, isNodeVisible);
  const cols = getVisibleLeafColumns(pivotData.columns, getChildNodes);

  // Build row path headers (LEVEL_1, LEVEL_2, ...) for each row dimension
  let rowLevelHeaders = [];
  let rowLevelCounts = [];
  rowFields.forEach((f, idx) => {
    // Find max depth for this dimension
    let maxDepth = 0;
    rows.forEach(row => {
      let arr;
      if (row.dimensions && Array.isArray(row.dimensions)) {
        arr = getMultiDimRowLabelPathArrays(row, state)[idx] || [];
      } else if (idx === 0) {
        const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';
        const hierarchy = state.hierarchies[dimName];
        arr = getDisplayLabelPathArray(row, hierarchy);
      } else {
        arr = [];
      }
      if (arr.length > maxDepth) maxDepth = arr.length;
    });
    rowLevelCounts.push(maxDepth);
    for (let i = 0; i < maxDepth; i++) {
      rowLevelHeaders.push(`${state.availableFields?.find(ff => ff.id === f)?.label || f.replace('DIM_', '').toUpperCase()} LEVEL_${i+1}`);
    }
  });

  // Same for columns
  let colLevelHeaders = [];
  let colLevelCounts = [];
  columnFields.forEach((f, idx) => {
    let maxDepth = 0;
    cols.forEach(col => {
      const colDimName = col.hierarchyField ? col.hierarchyField.replace('DIM_', '').toLowerCase() : (col.hierarchyName || '');
      const colHierarchy = state.hierarchies[colDimName];
      const arr = getDisplayLabelPathArray(col, colHierarchy);
      if (arr.length > maxDepth) maxDepth = arr.length;
    });
    colLevelCounts.push(maxDepth);
    for (let i = 0; i < maxDepth; i++) {
      colLevelHeaders.push(`${state.availableFields?.find(ff => ff.id === f)?.label || f.replace('DIM_', '').toUpperCase()} LEVEL_${i+1}`);
    }
  });

  const measureHeaders = valueFields;
  const exportRows = [];
  rows.forEach(row => {
    let rowLabelPathArrays = [];
    if (row.dimensions && Array.isArray(row.dimensions)) {
      rowLabelPathArrays = getMultiDimRowLabelPathArrays(row, state);
    } else {
      // Single-dimension row
      const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';
      const hierarchy = state.hierarchies[dimName];
      rowLabelPathArrays = [getDisplayLabelPathArray(row, hierarchy)];
    }
    cols.forEach(col => {
      // Column label path array
      const colDimName = col.hierarchyField ? col.hierarchyField.replace('DIM_', '').toLowerCase() : (col.hierarchyName || '');
      const colHierarchy = state.hierarchies[colDimName];
      const colLabelPathArray = getDisplayLabelPathArray(col, colHierarchy);
      measureHeaders.forEach(measure => {
        const rowData = pivotData.data.find(d => d._id === row._id) || {};
        const key = col._id ? `${col._id}|${measure}` : measure;
        const value = rowData[key] !== undefined ? rowData[key] : '';
        const exportRow = {};
        // Fill row path columns
        let colIdx = 0;
        rowLevelCounts.forEach((count, dimIdx) => {
          const arr = rowLabelPathArrays[dimIdx] || [];
          for (let i = 0; i < count; i++) {
            exportRow[rowLevelHeaders[colIdx]] = arr[i] || '';
            colIdx++;
          }
        });
        // Fill col path columns
        colIdx = 0;
        colLevelCounts.forEach((count, dimIdx) => {
          const arr = colLabelPathArray;
          for (let i = 0; i < count; i++) {
            exportRow[colLevelHeaders[colIdx]] = arr[i] || '';
            colIdx++;
          }
        });
        exportRow['MEASURE'] = measure;
        exportRow['VALUE'] = value;
        exportRows.push(exportRow);
      });
    });
  });
  return {header: [...rowLevelHeaders, ...colLevelHeaders, 'MEASURE', 'VALUE'], rows: exportRows};
}

function exportPivotToExcel() {
  const pivotTable = window.App?.pivotTable;
  if (!pivotTable || !state.pivotData) {
    alert('Pivot table not ready');
    return;
  }
  // Get helpers from pivotTable
  const getChildNodes = pivotTable.getChildNodes?.bind(pivotTable) || (() => []);
  const isNodeVisible = pivotTable.isNodeVisible?.bind(pivotTable) || (() => true);
  const {header, rows} = buildExportData({
    pivotData: state.pivotData,
    rowFields: state.rowFields || [],
    columnFields: state.columnFields || [],
    valueFields: state.valueFields || ['COST_UNIT'],
    getChildNodes,
    isNodeVisible
  });
  // Convert to worksheet
  const ws = window.XLSX.utils.json_to_sheet(rows, {header});
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'PivotExport');
  window.XLSX.writeFile(wb, 'pivot_export.xlsx');
}

function setupExportButton() {
  const btn = document.getElementById('exportBtn');
  if (!btn) return;
  btn.addEventListener('click', exportPivotToExcel);
}

// Auto-setup if loaded as a module
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupExportButton);
} else {
  setupExportButton();
}

export { exportPivotToExcel, setupExportButton };
