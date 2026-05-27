import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, Download, Users, TableProperties, X, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';

const LEVEL_KEYS = ['Tipo', 'direccion', 'gerencia', 'supervisor', 'BDR'];
const LEVEL_LABELS = ['Categoría', 'Dirección', 'Gerencia', 'Supervisor', 'BDR'];

const BAND_COLORS = [
  'rgba(76, 175, 80, 0.07)',   // green tint
  'rgba(79, 195, 247, 0.07)',  // blue tint  
  'rgba(255, 183, 77, 0.07)',  // amber tint
  'rgba(186, 104, 200, 0.07)', // purple tint
  'rgba(255, 138, 128, 0.07)', // red tint
  'rgba(128, 222, 234, 0.07)', // cyan tint
];

const VolumeView = ({ allClients }) => {
  const [expanded, setExpanded] = useState({});
  const [selectedPath, setSelectedPath] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [detailSort, setDetailSort] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build the hierarchical tree
  const tree = useMemo(() => {
    if (!allClients || allClients.length === 0) return [];

    const buildLevel = (clients, levelIdx, parentPath = '') => {
      if (levelIdx >= LEVEL_KEYS.length) return null;

      const key = LEVEL_KEYS[levelIdx];
      const groups = {};

      clients.forEach(c => {
        const groupName = c[key] || 'N/A';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(c);
      });

      return Object.keys(groups).sort().map(name => {
        const groupClients = groups[name];
        const currentPath = parentPath ? `${parentPath}///${name}` : name;
        const children = levelIdx < LEVEL_KEYS.length - 1 
          ? buildLevel(groupClients, levelIdx + 1, currentPath)
          : null;

        return {
          name,
          level: levelIdx,
          clients: groupClients,
          children,
          path: currentPath,
          ...computeMetrics(groupClients),
        };
      });
    };

    return buildLevel(allClients, 0);
  }, [allClients]);

  // Calculate totals for the entire dataset
  const totals = useMemo(() => {
    if (!allClients || allClients.length === 0) return null;
    return {
      name: 'Total general',
      level: -1,
      total: allClients.length,
      ...computeMetrics(allClients),
    };
  }, [allClients]);

  // Toggle expand/collapse for a row
  const toggleRow = useCallback((path) => {
    setExpanded(prev => {
      const newState = { ...prev };
      if (newState[path]) {
        // Collapse: remove this and all children
        Object.keys(newState).forEach(k => {
          if (k.startsWith(path)) delete newState[k];
        });
      } else {
        newState[path] = true;
      }
      return newState;
    });
  }, []);

  // Toggle sort when clicking a column header
  const toggleSort = useCallback((key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        return { key: null, direction: null };
      }
      const defaultDir = key === 'name' ? 'asc' : 'desc';
      return { key, direction: defaultDir };
    });
  }, []);

  // Select a row to show its clients in the detail panel
  const selectRow = useCallback((path) => {
    setSelectedPath(prev => prev === path ? null : path);
  }, []);

  // Get the clients for the currently selected row
  const selectedClients = useMemo(() => {
    if (!selectedPath) return allClients || [];
    
    const pathParts = selectedPath.split('///');
    let currentNodes = tree;
    let foundClients = allClients || [];

    for (let i = 0; i < pathParts.length; i++) {
      const node = currentNodes?.find(n => n.name === pathParts[i]);
      if (node) {
        foundClients = node.clients;
        currentNodes = node.children;
      } else {
        break;
      }
    }
    return foundClients;
  }, [selectedPath, tree, allClients]);

  // Sort detail clients
  const sortedDetailClients = useMemo(() => {
    const sorted = [...selectedClients];
    const { key, direction } = detailSort;
    if (!key) return sorted;

    sorted.sort((a, b) => {
      let valA, valB;
      if (key === 'name') {
        valA = (a.nombre_comercial || '').toLowerCase();
        valB = (b.nombre_comercial || '').toLowerCase();
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (key === 'Tipo') {
        valA = a.Tipo || '';
        valB = b.Tipo || '';
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = Number(a[key] || 0);
        valB = Number(b[key] || 0);
        return direction === 'asc' ? valA - valB : valB - valA;
      }
    });
    return sorted;
  }, [selectedClients, detailSort]);

  // Handle detail table sort
  const toggleDetailSort = (key) => {
    setDetailSort(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'name' || key === 'Tipo' ? 'asc' : 'desc' };
    });
  };

  // Format helper for numbers
  const formatNum = (val) => Math.round(val).toLocaleString();
  const formatPct = (val) => (val * 100).toFixed(0) + '%';
  const formatVar = (val) => {
    if (val === Infinity || val === -Infinity) return '∞';
    if (isNaN(val)) return '0%';
    const rounded = Math.round(val * 100);
    return (rounded > 0 ? '+' : '') + rounded + '%';
  };

  const getVarColor = (val) => {
    if (val === Infinity || val === -Infinity) return '#10b981';
    if (isNaN(val) || val === 0) return '#9ca3af';
    return val > 0 ? '#10b981' : '#ef4444';
  };

  // Download full pivot table to Excel
  const downloadPivotTable = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const rows = [];

    const flattenTree = (nodes, parentPath = '') => {
      if (!nodes) return;
      nodes.forEach(node => {
        const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
        rows.push({
          'Nivel': LEVEL_LABELS[node.level],
          'Nombre': node.name,
          'Ruta': path,
          'Suma de BEER LM': Math.round(node.beerLM),
          'Suma de BEER MTD': Math.round(node.beerMTD),
          'Variance BEER': formatVar(node.varBeer),
          'Suma de CSQ LM': Math.round(node.csqLM),
          'Suma de CSQ MTD': Math.round(node.csqMTD),
          'Variance CSQ': formatVar(node.varCsq),
          'Suma de NOLO LM': Math.round(node.noloLM),
          'Suma de NOLO MTD': Math.round(node.noloMTD),
          'Variance NOLO': formatVar(node.varNolo),
          'Promedio de MIX NOLO LM': formatPct(node.mixLM),
          'Promedio de MIX NOLO MTD': formatPct(node.mixMTD),
          'Variance MIX NOLO': formatVar(node.varMix),
        });
        if (node.children) {
          flattenTree(node.children, path);
        }
      });
    };

    flattenTree(tree);

    if (totals) {
      rows.push({
        'Nivel': '',
        'Nombre': 'Total general',
        'Ruta': 'Total general',
        'Suma de BEER LM': Math.round(totals.beerLM),
        'Suma de BEER MTD': Math.round(totals.beerMTD),
        'Variance BEER': formatVar(totals.varBeer),
        'Suma de CSQ LM': Math.round(totals.csqLM),
        'Suma de CSQ MTD': Math.round(totals.csqMTD),
        'Variance CSQ': formatVar(totals.varCsq),
        'Suma de NOLO LM': Math.round(totals.noloLM),
        'Suma de NOLO MTD': Math.round(totals.noloMTD),
        'Variance NOLO': formatVar(totals.varNolo),
        'Promedio de MIX NOLO LM': formatPct(totals.mixLM),
        'Promedio de MIX NOLO MTD': formatPct(totals.mixMTD),
        'Variance MIX NOLO': formatVar(totals.varMix),
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Pivot Volumen');
    XLSX.writeFile(wb, 'Tabla_Dinamica_Volumen.xlsx');
  }, [tree, totals]);

  // Download filtered client detail list
  const downloadClientList = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const rows = selectedClients.map(c => ({
      'Código Cliente': c.cliente_id,
      'Nombre Comercial': c.nombre_comercial,
      'Categoría (Tipo)': c.Tipo,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      'BEER LM': c['BEER LM'],
      'BEER MTD': c['BEER MTD'],
      'CSQ LM': c['CSQ LM'],
      'CSQ MTD': c['CSQ MTD'],
      'NOLO LM': c['NOLO LM'],
      'NOLO MTD': c['NOLO MTD'],
      'MIX NOLO LM': formatPct(c['MIX NOLO LM'] || 0),
      'MIX NOLO MTD': formatPct(c['MIX NOLO MTD'] || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Volumen');
    XLSX.writeFile(wb, 'Detalle_Clientes_Volumen.xlsx');
  }, [selectedClients]);

  // Flatten tree into renderable rows (with sorting at each level)
  const flatRows = useMemo(() => {
    const rows = [];

    const sortNodes = (nodes) => {
      if (!sortConfig.key || !sortConfig.direction || !nodes) return nodes;
      const sorted = [...nodes];
      const { key, direction } = sortConfig;
      sorted.sort((a, b) => {
        let valA, valB;
        if (key === 'name') {
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        valA = a[key] ?? 0;
        valB = b[key] ?? 0;
        return direction === 'asc' ? valA - valB : valB - valA;
      });
      return sorted;
    };

    const walk = (nodes, parentPath = '', depth = 0, bandIdx = 0) => {
      if (!nodes) return;
      const sorted = sortNodes(nodes);
      sorted.forEach((node, idx) => {
        const path = parentPath ? `${parentPath}///${node.name}` : node.name;
        const isExpanded = !!expanded[path];
        const hasChildren = node.children && node.children.length > 0;
        const currentBandIdx = depth === 0 ? idx : bandIdx;

        rows.push({
          ...node,
          path,
          depth,
          isExpanded,
          hasChildren,
          bandColor: BAND_COLORS[currentBandIdx % BAND_COLORS.length],
        });

        if (isExpanded && hasChildren) {
          walk(node.children, path, depth + 1, currentBandIdx);
        }
      });
    };

    walk(tree);
    return rows;
  }, [tree, expanded, sortConfig]);

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6" style={{ gap: '12px' }}>
      
      {/* Top Header Row with Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'rgba(207, 160, 82, 0.1)',
            display: 'flex', alignItems: 'center', justifyItem: 'center', justifyContent: 'center',
          }}>
            <TableProperties size={18} color="#CFA052" />
          </div>
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: '1.1rem', margin: 0 }}>
              Desempeño Volumen Ventas
            </h2>
            <p className="text-secondary" style={{ fontSize: '0.7rem', marginTop: '1px' }}>
              Volumen MTD vs LM por Categoría, Dirección y BDRs
            </p>
          </div>
        </div>

        <button
          onClick={downloadPivotTable}
          className="btn-gold"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.8rem' }}
        >
          <Download size={16} />
          Descargar Tabla
        </button>
      </div>

      {/* Main Content Viewport */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '16px',
        flex: 1,
        minHeight: 0,
      }}>
        
        {/* Pivot Table scrollable panel */}
        <div className="glass-panel" style={{
          flex: isMobile ? 'none' : '1 1 0%',
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Outer scroll wrapper for horizontal overflow */}
          <div style={{
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ minWidth: '1300px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              
              {/* Header Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 2.5fr) repeat(12, minmax(80px, 1fr))',
                gap: '0',
                padding: '12px 16px',
                borderBottom: '2px solid rgba(207, 160, 82, 0.3)',
                background: 'rgba(207, 160, 82, 0.06)',
                flexShrink: 0,
                alignItems: 'center',
              }}>
                <VolumeSortHeader label="Etiquetas de fila" sortKey="name" sortConfig={sortConfig} onSort={toggleSort} isName />
                <VolumeSortHeader label={<>BEER LM<br/>(Vol)</>} sortKey="beerLM" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>BEER MTD<br/>(Vol)</>} sortKey="beerMTD" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>Var.<br/>BEER</>} sortKey="varBeer" sortConfig={sortConfig} onSort={toggleSort} purple />
                
                <VolumeSortHeader label={<>CSQ LM<br/>(Vol)</>} sortKey="csqLM" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>CSQ MTD<br/>(Vol)</>} sortKey="csqMTD" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>Var.<br/>CSQ</>} sortKey="varCsq" sortConfig={sortConfig} onSort={toggleSort} purple />
                
                <VolumeSortHeader label={<>NOLO LM<br/>(Vol)</>} sortKey="noloLM" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>NOLO MTD<br/>(Vol)</>} sortKey="noloMTD" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>Var.<br/>NOLO</>} sortKey="varNolo" sortConfig={sortConfig} onSort={toggleSort} purple />
                
                <VolumeSortHeader label={<>MIX NOLO LM<br/>(Prom)</>} sortKey="mixLM" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>MIX NOLO MTD<br/>(Prom)</>} sortKey="mixMTD" sortConfig={sortConfig} onSort={toggleSort} />
                <VolumeSortHeader label={<>Var.<br/>MIX NOLO</>} sortKey="varMix" sortConfig={sortConfig} onSort={toggleSort} purple />
              </div>

              {/* Body Rows */}
              <div style={{ flex: 1, minHeight: 0 }}>
                {flatRows.map((row) => (
                  <VolumePivotRow
                    key={row.path}
                    row={row}
                    isSelected={selectedPath === row.path}
                    onToggle={() => toggleRow(row.path)}
                    onSelect={() => selectRow(row.path)}
                  />
                ))}

                {/* Sticky Grand Total row */}
                {totals && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 2.5fr) repeat(12, minmax(80px, 1fr))',
                    gap: '0',
                    padding: '0 16px',
                    background: 'rgba(207, 160, 82, 0.14)',
                    borderTop: '2px solid rgba(207, 160, 82, 0.4)',
                    borderBottom: '2px solid rgba(207, 160, 82, 0.4)',
                    minHeight: '40px',
                    alignItems: 'center',
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', paddingLeft: '4px' }}>
                      <span className="text-gold font-bold" style={{ fontSize: '0.8rem' }}>Total general</span>
                    </div>
                    {/* Beer Totals */}
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.beerLM)}</span></div>
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.beerMTD)}</span></div>
                    <div style={dataCellStyle}><span style={{ color: getVarColor(totals.varBeer), fontWeight: 700 }}>{formatVar(totals.varBeer)}</span></div>
                    
                    {/* Csq Totals */}
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.csqLM)}</span></div>
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.csqMTD)}</span></div>
                    <div style={dataCellStyle}><span style={{ color: getVarColor(totals.varCsq), fontWeight: 700 }}>{formatVar(totals.varCsq)}</span></div>
                    
                    {/* Nolo Totals */}
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.noloLM)}</span></div>
                    <div style={dataCellStyle}><span className="text-white font-bold">{formatNum(totals.noloMTD)}</span></div>
                    <div style={dataCellStyle}><span style={{ color: getVarColor(totals.varNolo), fontWeight: 700 }}>{formatVar(totals.varNolo)}</span></div>
                    
                    {/* Mix Averages */}
                    <div style={dataCellStyle}><span className="text-gold font-semibold">{formatPct(totals.mixLM)}</span></div>
                    <div style={dataCellStyle}><span className="text-gold font-semibold">{formatPct(totals.mixMTD)}</span></div>
                    <div style={dataCellStyle}><span style={{ color: getVarColor(totals.varMix), fontWeight: 700 }}>{formatVar(totals.varMix)}</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Detail Panel showing clients in selected node */}
        <div className="glass-panel" style={{
          width: isMobile ? '100%' : '380px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '350px',
          flexShrink: 0,
        }}>
          {/* Panel Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div className="flex items-center gap-2">
              <Users size={16} color="#CFA052" />
              <span className="text-gold font-bold text-xs uppercase tracking-wider">Detalle Clientes</span>
            </div>
            {selectedPath && (
              <button
                onClick={() => setSelectedPath(null)}
                style={{
                  background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px'
                }}
                title="Limpiar Filtro"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Path display */}
          <div style={{
            padding: '6px 16px',
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            fontSize: '0.65rem',
            color: '#9ca3af',
            flexShrink: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedPath ? (
              <span>Filtro: <span className="text-white font-semibold">{selectedPath.replace(/\/\/\//g, ' > ')}</span></span>
            ) : (
              <span>Mostrando todos los locales del canal</span>
            )}
          </div>

          {/* Client count info */}
          <div style={{
            padding: '8px 16px 4px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
              Locales: <span className="text-white font-bold">{selectedClients.length}</span>
            </span>

            <button
              onClick={downloadClientList}
              disabled={selectedClients.length === 0}
              className="text-gold hover:text-white flex items-center gap-1 font-semibold transition"
              style={{ fontSize: '0.7rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Download size={12} />
              Exportar
            </button>
          </div>

          {/* Small Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.6fr repeat(3, 0.7fr)',
            gap: '4px',
            padding: '6px 12px',
            borderBottom: '1px solid rgba(207, 160, 82, 0.2)',
            background: 'rgba(207, 160, 82, 0.02)',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}>
            <div onClick={() => toggleDetailSort('name')} className="cursor-pointer hover:text-white flex items-center gap-0.5">
              Local {detailSort.key === 'name' && (detailSort.direction === 'asc' ? '▲' : '▼')}
            </div>
            <div onClick={() => toggleDetailSort('Tipo')} className="cursor-pointer hover:text-white flex items-center gap-0.5 justify-center">
              Tipo {detailSort.key === 'Tipo' && (detailSort.direction === 'asc' ? '▲' : '▼')}
            </div>
            <div onClick={() => toggleDetailSort('BEER MTD')} className="cursor-pointer hover:text-white flex items-center gap-0.5 justify-end">
              BEER {detailSort.key === 'BEER MTD' && (detailSort.direction === 'asc' ? '▲' : '▼')}
            </div>
            <div onClick={() => toggleDetailSort('CSQ MTD')} className="cursor-pointer hover:text-white flex items-center gap-0.5 justify-end">
              CSQ {detailSort.key === 'CSQ MTD' && (detailSort.direction === 'asc' ? '▲' : '▼')}
            </div>
            <div onClick={() => toggleDetailSort('MIX NOLO MTD')} className="cursor-pointer hover:text-white flex items-center gap-0.5 justify-end">
              MIX {detailSort.key === 'MIX NOLO MTD' && (detailSort.direction === 'asc' ? '▲' : '▼')}
            </div>
          </div>

          {/* Client List (scrollable) */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '4px 0'
          }}>
            {sortedDetailClients.slice(0, 50).map((c, idx) => (
              <div
                key={c.cliente_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.6fr repeat(3, 0.7fr)',
                  gap: '4px',
                  padding: '6px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  fontSize: '0.65rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }} title={c.nombre_comercial}>
                  {c.nombre_comercial}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: '4px',
                    background: c.Tipo === 'ADH' ? 'rgba(16, 185, 129, 0.15)' : c.Tipo === 'INT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: c.Tipo === 'ADH' ? '#10b981' : c.Tipo === 'INT' ? '#f59e0b' : '#ef4444',
                  }}>
                    {c.Tipo}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#f3f4f6' }}>{formatNum(c['BEER MTD'] || 0)}</div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#f3f4f6' }}>{formatNum(c['CSQ MTD'] || 0)}</div>
                <div style={{ textAlign: 'right', color: '#CFA052', fontWeight: 600 }}>{formatPct(c['MIX NOLO MTD'] || 0)}</div>
              </div>
            ))}
            {selectedClients.length > 50 && (
              <div style={{
                textAlign: 'center', padding: '8px', fontSize: '0.6rem', color: '#9ca3af', fontStyle: 'italic'
              }}>
                * Mostrando los primeros 50 de {selectedClients.length} locales. Descarga el Excel para ver la lista completa.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Pivot Row Grid cell helper ─────────────────────────────────────
const dataCellStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  padding: '4px 2px',
};

// ─── Header Cell Style ──────────────────────────────────────────────
const headerCellStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  textAlign: 'center',
  lineHeight: 1.3,
};

// ─── VolumeSortHeader Component ─────────────────────────────────────
const VolumeSortHeader = ({ label, sortKey, sortConfig, onSort, isName, purple }) => {
  const isActive = sortConfig.key === sortKey;
  const dir = isActive ? sortConfig.direction : null;

  return (
    <div
      onClick={() => onSort(sortKey)}
      style={{
        ...(isName
          ? { fontSize: '0.7rem', fontWeight: 700, color: '#cfa052', textTransform: 'uppercase', letterSpacing: '0.05em' }
          : headerCellStyle),
        display: 'flex',
        alignItems: 'center',
        justifyContent: isName ? 'flex-start' : 'center',
        gap: '4px',
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? '#CFA052' : isName ? '#cfa052' : '#9ca3af',
        background: purple ? 'rgba(186, 104, 200, 0.04)' : 'transparent',
        padding: '6px 2px',
        borderRadius: '4px',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#CFA052';
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.color = isName ? '#cfa052' : '#9ca3af';
          e.currentTarget.style.background = purple ? 'rgba(186, 104, 200, 0.04)' : 'transparent';
        }
      }}
    >
      <span style={{ textAlign: isName ? 'left' : 'center' }}>{label}</span>
      {isActive ? (
        dir === 'asc' ? <ArrowUp size={11} color="#CFA052" /> : <ArrowDown size={11} color="#CFA052" />
      ) : (
        <span style={{ opacity: 0.15, display: 'flex', alignItems: 'center' }}>
          <ArrowDown size={10} />
        </span>
      )}
    </div>
  );
};

// ─── VolumePivotRow Component ───────────────────────────────────────
const VolumePivotRow = ({ row, isSelected, onToggle, onSelect }) => {
  const indent = row.depth * 20;

  // Format values
  const formatNum = (val) => Math.round(val).toLocaleString();
  const formatPct = (val) => (val * 100).toFixed(0) + '%';
  const formatVar = (val) => {
    if (val === Infinity || val === -Infinity) return '∞';
    if (isNaN(val)) return '0%';
    const rounded = Math.round(val * 100);
    return (rounded > 0 ? '+' : '') + rounded + '%';
  };

  const getVarColor = (val) => {
    if (val === Infinity || val === -Infinity) return '#10b981';
    if (isNaN(val) || val === 0) return '#9ca3af';
    return val > 0 ? '#10b981' : '#ef4444';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 2.5fr) repeat(12, minmax(80px, 1fr))',
        gap: '0',
        padding: '0 16px',
        background: isSelected
          ? 'rgba(207, 160, 82, 0.12)'
          : row.bandColor,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.15s',
        cursor: 'pointer',
        minHeight: '36px',
        alignItems: 'center',
      }}
      onClick={onSelect}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = row.bandColor;
      }}
    >
      {/* Name cell */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        paddingLeft: `${indent}px`,
        overflow: 'hidden',
      }}>
        {row.hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              color: '#cfa052',
              flexShrink: 0,
            }}
          >
            {row.isExpanded
              ? <ChevronDown size={13} />
              : <ChevronRight size={13} />
            }
          </button>
        ) : (
          <span style={{ width: '17px', flexShrink: 0 }} />
        )}
        <span
          className="text-white"
          style={{
            fontSize: row.depth === 0 ? '0.85rem' : '0.75rem',
            fontWeight: row.depth <= 1 ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={row.name}
        >
          {row.name}
        </span>
        <span className="text-secondary" style={{
          fontSize: '0.55rem',
          flexShrink: 0,
          marginLeft: '4px',
          opacity: 0.5,
        }}>
          {LEVEL_LABELS[row.level]}
        </span>
      </div>

      {/* Beer metrics */}
      <div style={dataCellStyle}><span className="text-gray-300">{formatNum(row.beerLM)}</span></div>
      <div style={dataCellStyle}><span className="text-white font-semibold">{formatNum(row.beerMTD)}</span></div>
      <div style={dataCellStyle}><span style={{ color: getVarColor(row.varBeer), fontWeight: 600 }}>{formatVar(row.varBeer)}</span></div>

      {/* Csq metrics */}
      <div style={dataCellStyle}><span className="text-gray-300">{formatNum(row.csqLM)}</span></div>
      <div style={dataCellStyle}><span className="text-white font-semibold">{formatNum(row.csqMTD)}</span></div>
      <div style={dataCellStyle}><span style={{ color: getVarColor(row.varCsq), fontWeight: 600 }}>{formatVar(row.varCsq)}</span></div>

      {/* Nolo metrics */}
      <div style={dataCellStyle}><span className="text-gray-300">{formatNum(row.noloLM)}</span></div>
      <div style={dataCellStyle}><span className="text-white font-semibold">{formatNum(row.noloMTD)}</span></div>
      <div style={dataCellStyle}><span style={{ color: getVarColor(row.varNolo), fontWeight: 600 }}>{formatVar(row.varNolo)}</span></div>

      {/* Mix averages */}
      <div style={dataCellStyle}><span className="text-secondary">{formatPct(row.mixLM)}</span></div>
      <div style={dataCellStyle}><span className="text-gold font-semibold">{formatPct(row.mixMTD)}</span></div>
      <div style={dataCellStyle}><span style={{ color: getVarColor(row.varMix), fontWeight: 600 }}>{formatVar(row.varMix)}</span></div>
    </div>
  );
};

// ─── Metrics Computation ────────────────────────────────────────────
function computeMetrics(clients) {
  let beerLM = 0;
  let beerMTD = 0;
  let csqLM = 0;
  let csqMTD = 0;
  let noloLM = 0;
  let noloMTD = 0;
  let mixLM_sum = 0;
  let mixMTD_sum = 0;
  let mixLM_count = 0;
  let mixMTD_count = 0;

  clients.forEach(c => {
    beerLM += Number(c['BEER LM'] || 0);
    beerMTD += Number(c['BEER MTD'] || 0);
    csqLM += Number(c['CSQ LM'] || 0);
    csqMTD += Number(c['CSQ MTD'] || 0);
    noloLM += Number(c['NOLO LM'] || 0);
    noloMTD += Number(c['NOLO MTD'] || 0);
    
    // Sum for averaging
    mixLM_sum += Number(c['MIX NOLO LM'] || 0);
    mixMTD_sum += Number(c['MIX NOLO MTD'] || 0);
    mixLM_count++;
    mixMTD_count++;
  });

  const mixLM = mixLM_count > 0 ? (mixLM_sum / mixLM_count) : 0;
  const mixMTD = mixMTD_count > 0 ? (mixMTD_sum / mixMTD_count) : 0;

  const calcVar = (mtd, lm) => {
    if (lm === 0) return mtd > 0 ? Infinity : 0;
    return (mtd - lm) / lm;
  };

  const varBeer = calcVar(beerMTD, beerLM);
  const varCsq = calcVar(csqMTD, csqLM);
  const varNolo = calcVar(noloMTD, noloLM);
  const varMix = calcVar(mixMTD, mixLM);

  return {
    beerLM,
    beerMTD,
    varBeer,
    csqLM,
    csqMTD,
    varCsq,
    noloLM,
    noloMTD,
    varNolo,
    mixLM,
    mixMTD,
    varMix,
  };
}

export default VolumeView;
