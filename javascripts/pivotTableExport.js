// Export logic for BOM Pivot Table (Excel/CSV)
// Requires SheetJS (xlsx) library loaded in the HTML

import stateModule from './state.js';
import multiDimensionPivotHandler from './pivotTableMultiDimensionsHandler.js';

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

// Helper: Get display label path for a node (do NOT skip first node)
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

// Helper: For multi-dimension row, get label path for each dimension
function getMultiDimRowLabelPaths(row, state) {
  if (!row.dimensions || !Array.isArray(row.dimensions)) return [];
  return row.dimensions.map((dim, i) => {
    const dimName = dim.hierarchyField ? dim.hierarchyField.replace('DIM_', '').toLowerCase() : '';
    const hierarchy = state.hierarchies[dimName];
    return getDisplayLabelPath(dim, hierarchy);
  });
}

function buildExportData({pivotData, rowFields, columnFields, valueFields, getChildNodes, isNodeVisible}) {
  const rows = getVisibleRows(pivotData.rows, isNodeVisible);
  const cols = getVisibleLeafColumns(pivotData.columns, getChildNodes);
  const rowHeaders = rowFields.map((f, i) => {
    // Use display name for header
    const field = state.availableFields?.find(ff => ff.id === f);
    return field ? field.label : f.replace('DIM_', '').toUpperCase();
  });
  const colHeaders = columnFields.map((f, i) => {
    const field = state.availableFields?.find(ff => ff.id === f);
    return field ? field.label : f.replace('DIM_', '').toUpperCase();
  });
  const measureHeaders = valueFields;

  const exportRows = [];
  rows.forEach(row => {
    let rowLabelPaths = [];
    if (row.dimensions && Array.isArray(row.dimensions)) {
      // Multi-dimension row
      rowLabelPaths = getMultiDimRowLabelPaths(row, state);
    } else {
      // Single-dimension row
      const dimName = row.hierarchyField ? row.hierarchyField.replace('DIM_', '').toLowerCase() : '';
      const hierarchy = state.hierarchies[dimName];
      rowLabelPaths = [getDisplayLabelPath(row, hierarchy)];
    }
    cols.forEach(col => {
      // Column label path
      const colDimName = col.hierarchyField ? col.hierarchyField.replace('DIM_', '').toLowerCase() : (col.hierarchyName || '');
      const colHierarchy = state.hierarchies[colDimName];
      const colLabelPath = getDisplayLabelPath(col, colHierarchy);
      measureHeaders.forEach(measure => {
        const rowData = pivotData.data.find(d => d._id === row._id) || {};
        const key = col._id ? `${col._id}|${measure}` : measure;
        const value = rowData[key] !== undefined ? rowData[key] : '';
        const exportRow = {};
        rowHeaders.forEach((h, i) => { exportRow[h] = rowLabelPaths[i] || ''; });
        colHeaders.forEach((h, i) => { exportRow[h] = i === 0 ? colLabelPath : ''; }); // Only fill first colHeader for flat export
        exportRow['MEASURE'] = measure;
        exportRow['VALUE'] = value;
        exportRows.push(exportRow);
      });
    });
  });
  return {header: [...rowHeaders, ...colHeaders, 'MEASURE', 'VALUE'], rows: exportRows};
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
