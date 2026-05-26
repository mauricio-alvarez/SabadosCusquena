import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, Download, Users, TableProperties, X, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';

const LEVEL_KEYS = ['direccion', 'gerencia', 'supervisor', 'BDR'];
const LEVEL_LABELS = ['Dirección', 'Gerencia', 'Supervisor', 'BDR'];

// Alternating band colors per top-level Dirección group
const BAND_COLORS = [
  'rgba(76, 175, 80, 0.07)',   // green tint
  'rgba(79, 195, 247, 0.07)',  // blue tint  
  'rgba(255, 183, 77, 0.07)',  // amber tint
  'rgba(186, 104, 200, 0.07)', // purple tint
  'rgba(255, 138, 128, 0.07)', // red tint
  'rgba(128, 222, 234, 0.07)', // cyan tint
];

const PivotView = ({ allClients, progressData }) => {
  const [expanded, setExpanded] = useState({});
  const [selectedPath, setSelectedPath] = useState(null);
  const [detailTab, setDetailTab] = useState('activos');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null }); // { key: 'name'|'total'|..., direction: 'asc'|'desc' }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine the two most recent Saturdays from available_dates
  const { latestSaturday, prevSaturday } = useMemo(() => {
    if (!progressData || !progressData.available_dates || progressData.available_dates.length === 0) {
      return { latestSaturday: null, prevSaturday: null };
    }

    // Filter to only Saturdays (day 6 in JS Date)
    const saturdays = progressData.available_dates.filter(dateStr => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return false;
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return d.getDay() === 6; // 6 = Saturday
    });

    if (saturdays.length < 2) {
      // Fallback: use last two available dates if not enough Saturdays
      const dates = progressData.available_dates;
      return {
        latestSaturday: dates[dates.length - 1] || null,
        prevSaturday: dates.length >= 2 ? dates[dates.length - 2] : null,
      };
    }

    return {
      latestSaturday: saturdays[saturdays.length - 1],
      prevSaturday: saturdays[saturdays.length - 2],
    };
  }, [progressData]);

  // Build the hierarchical tree
  const tree = useMemo(() => {
    if (!allClients || allClients.length === 0) return [];

    const buildLevel = (clients, levelIdx) => {
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
        const children = levelIdx < LEVEL_KEYS.length - 1 
          ? buildLevel(groupClients, levelIdx + 1)
          : null;

        return {
          name,
          level: levelIdx,
          clients: groupClients,
          children,
          ...computeMetrics(groupClients, latestSaturday, prevSaturday),
        };
      });
    };

    return buildLevel(allClients, 0);
  }, [allClients, latestSaturday, prevSaturday]);

  // Calculate totals for the entire dataset
  const totals = useMemo(() => {
    if (!allClients || allClients.length === 0) return null;
    return {
      name: 'TOTAL',
      level: -1,
      total: allClients.length,
      ...computeMetrics(allClients, latestSaturday, prevSaturday),
    };
  }, [allClients, latestSaturday, prevSaturday]);

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
        // Toggle direction, then clear
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        return { key: null, direction: null }; // third click clears sort
      }
      // Default: name → asc (A-Z), numbers → desc (biggest first)
      const defaultDir = key === 'name' ? 'asc' : 'desc';
      return { key, direction: defaultDir };
    });
  }, []);

  // Select a row to show its clients in the detail panel
  const selectRow = useCallback((path, clients) => {
    setSelectedPath(prev => prev === path ? null : path);
    setDetailTab('activos');
  }, []);

  // Get the clients for the currently selected row
  const selectedClients = useMemo(() => {
    if (!selectedPath) return allClients || [];
    
    // Walk the tree to find the node matching the path
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

  // Active/Inactive based on latest Saturday only
  const activeClients = useMemo(() => {
    if (!latestSaturday) return selectedClients.filter(c => c.redemptions > 0);
    return selectedClients.filter(c => {
      if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return false;
      return c.redemption_dates.some(d => d === latestSaturday);
    });
  }, [selectedClients, latestSaturday]);

  const inactiveClients = useMemo(() => {
    if (!latestSaturday) return selectedClients.filter(c => c.redemptions === 0);
    return selectedClients.filter(c => {
      if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return true;
      return !c.redemption_dates.some(d => d === latestSaturday);
    });
  }, [selectedClients, latestSaturday]);

  const displayClients = detailTab === 'activos' ? activeClients : inactiveClients;
  const displayLimit = 20;
  const visibleClients = displayClients.slice(0, displayLimit);

  // Download client detail list
  const downloadClientList = useCallback(() => {
    const wb = XLSX.utils.book_new();
    
    const countOnDate = (c, date) => {
      if (!date || !c.redemption_dates || !Array.isArray(c.redemption_dates)) return 0;
      return c.redemption_dates.filter(d => d === date).length;
    };

    const activeRows = activeClients.map(c => ({
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      [`Redenciones (${latestSaturday || 'Último Sáb'})`]: countOnDate(c, latestSaturday),
    }));
    
    const inactiveRows = inactiveClients.map(c => ({
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      [`Redenciones (${latestSaturday || 'Último Sáb'})`]: countOnDate(c, latestSaturday),
    }));
    
    if (activeRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeRows), 'Activos');
    }
    if (inactiveRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inactiveRows), 'Inactivos');
    }

    const label = selectedPath ? selectedPath.replace(/\/\/\//g, '_') : 'Todos';
    XLSX.writeFile(wb, `Detalle_Clientes_${label}.xlsx`);
  }, [activeClients, inactiveClients, selectedPath]);

  // Download full pivot table
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
          'Clientes Totales': node.total,
          'Clientes Activos': node.active,
          '% Activos': node.activePct,
          'Clientes Inactivos': node.inactive,
          '% Inactivos': node.inactivePct,
          'VS SAB ACT (Abs)': node.vsSabActiveDelta,
          'VS SAB ACT (%)': node.vsSabActivePct,
          'Redenciones Totales': node.totalRedemptions,
          'VS SAB RED (Abs)': node.vsSabDelta,
          'VS SAB RED (%)': node.vsSabPct,
          'Red Prom x Activo': node.avgPerActive,
        });
        if (node.children) {
          flattenTree(node.children, path);
        }
      });
    };

    flattenTree(tree);

    // Append TOTAL row at the bottom of Excel export
    if (totals) {
      rows.push({
        'Nivel': '',
        'Nombre': 'TOTAL',
        'Ruta': '',
        'Clientes Totales': totals.total,
        'Clientes Activos': totals.active,
        '% Activos': totals.activePct,
        'Clientes Inactivos': totals.inactive,
        '% Inactivos': totals.inactivePct,
        'VS SAB ACT (Abs)': totals.vsSabActiveDelta,
        'VS SAB ACT (%)': totals.vsSabActivePct,        
        'Redenciones Totales': totals.totalRedemptions,
        'VS SAB RED (Abs)': totals.vsSabDelta,
        'VS SAB RED (%)': totals.vsSabPct,
        'Red Prom x Activo': totals.avgPerActive,
      });
    }

    if (rows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tabla Dinámica');
    }
    XLSX.writeFile(wb, 'Tabla_Dinamica_Desempeno.xlsx');
  }, [tree, totals]);

  // Flatten tree into renderable rows (with sorting at each level)
  const flatRows = useMemo(() => {
    const rows = [];

    // Comparator for sorting nodes
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
        if (key === 'activePct' || key === 'inactivePct' || key === 'avgPerActive') {
          valA = parseFloat(a[key]) || 0;
          valB = parseFloat(b[key]) || 0;
        } else {
          valA = a[key] ?? 0;
          valB = b[key] ?? 0;
        }
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

  if (!allClients || allClients.length === 0) {
    return (
      <div className="glass-panel p-6 text-center">
        <p className="text-secondary">No hay datos de clientes disponibles.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6" style={{ gap: '16px' }}>
      {/* Header */}
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
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'rgba(207, 160, 82, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TableProperties size={22} color="#CFA052" />
          </div>
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: '1.25rem', margin: 0 }}>
              Desempeño Sábado Actual
            </h2>
            {latestSaturday && prevSaturday && (
              <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Comparando {latestSaturday} vs {prevSaturday}
              </p>
            )}
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

      {/* Main content: Table + Detail panel */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '16px',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Pivot Table */}
        <div className="glass-panel" style={{
          flex: isMobile ? 'none' : '1 1 0%',
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 2fr) repeat(9, minmax(70px, 1fr))',
            gap: '0',
            padding: '12px 16px',
            borderBottom: '2px solid rgba(207, 160, 82, 0.3)',
            background: 'rgba(207, 160, 82, 0.06)',
            flexShrink: 0,
            minWidth: '850px',
          }}>
            <SortHeader label="Nombre" sortKey="name" sortConfig={sortConfig} onSort={toggleSort} isName />
            <SortHeader label={<>Clientes<br/>Totales</>} sortKey="total" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label={<>Clientes<br/>Activos</>} sortKey="active" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label="%" sortKey="activePct" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label={<>Clientes<br/>Inactivos</>} sortKey="inactive" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label="%" sortKey="inactivePct" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label={<>VS SAB<br/>ACT</>} sortKey="vsSabActiveDelta" sortConfig={sortConfig} onSort={toggleSort} purple />
            <SortHeader label={<>Redenc.<br/>Totales</>} sortKey="totalRedemptions" sortConfig={sortConfig} onSort={toggleSort} />
            <SortHeader label={<>VS SAB<br/>RED</>} sortKey="vsSabDelta" sortConfig={sortConfig} onSort={toggleSort} purple />
            <SortHeader label={<>Red Prom<br/>x Activo</>} sortKey="avgPerActive" sortConfig={sortConfig} onSort={toggleSort} />
          </div>

          {/* Table Body (scrollable) */}
          <div style={{
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}>
            <div style={{ minWidth: '850px' }}>
              {flatRows.map((row) => (
                <PivotRow
                  key={row.path}
                  row={row}
                  isSelected={selectedPath === row.path}
                  onToggle={() => toggleRow(row.path)}
                  onSelect={() => selectRow(row.path, row.clients)}
                />
              ))}

              {/* TOTAL ROW */}
              {totals && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 2fr) repeat(9, minmax(70px, 1fr))',
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
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', paddingLeft: '4px' }}>
                    <span className="text-gold font-bold" style={{ fontSize: '0.8rem' }}>TOTAL</span>
                  </div>
                  {/* Clientes Totales */}
                  <div style={dataCellStyle}>
                    <span className="text-white font-bold" style={{ fontSize: '0.75rem' }}>{totals.total}</span>
                  </div>
                  {/* Clientes Activos */}
                  <div style={dataCellStyle}>
                    <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.75rem' }}>{totals.active}</span>
                  </div>
                  {/* % Activos */}
                  <div style={dataCellStyle}>
                    <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.7rem' }}>{totals.activePct}%</span>
                  </div>
                  {/* Clientes Inactivos */}
                  <div style={dataCellStyle}>
                    <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.75rem' }}>{totals.inactive}</span>
                  </div>
                  {/* % Inactivos */}
                  <div style={dataCellStyle}>
                    <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.7rem' }}>{totals.inactivePct}%</span>
                  </div>
                  {/* VS SAB ACT */}
                  <div style={dataCellStyle}>
                    <span style={{
                      color: totals.vsSabActiveDelta > 0 ? '#4ade80' : totals.vsSabActiveDelta < 0 ? '#f87171' : '#9ca3af',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}>
                      {totals.vsSabActiveDelta > 0 ? '+' : ''}{totals.vsSabActiveDelta}
                      <span style={{ fontSize: '0.6rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                        {totals.vsSabActivePct !== '∞' ? `(${totals.vsSabActivePct}%)` : '(nuevo)'}
                      </span>
                    </span>
                  </div>
                  {/* Redenciones Totales */}
                  <div style={dataCellStyle}>
                    <span className="text-gold font-bold" style={{ fontSize: '0.8rem' }}>
                      {totals.totalRedemptions.toLocaleString()}
                    </span>
                  </div>
                  {/* VS SAB RED */}
                  <div style={dataCellStyle}>
                    <span style={{
                      color: totals.vsSabDelta > 0 ? '#4ade80' : totals.vsSabDelta < 0 ? '#f87171' : '#9ca3af',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}>
                      {totals.vsSabDelta > 0 ? '+' : ''}{totals.vsSabDelta}
                      <span style={{ fontSize: '0.6rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                        {totals.vsSabPct !== '∞' ? `(${totals.vsSabPct}%)` : '(nuevo)'}
                      </span>
                    </span>
                  </div>
                  {/* Red Prom x Activo */}
                  <div style={dataCellStyle}>
                    <span className="text-white font-bold" style={{ fontSize: '0.75rem' }}>
                      {totals.avgPerActive}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="glass-panel" style={{
          width: isMobile ? '100%' : '300px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: isMobile ? '400px' : 'none',
        }}>
          {/* Panel Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(207, 160, 82, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#CFA052" />
              <h3 className="text-gold font-bold" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Detalle Clientes
              </h3>
            </div>
            {selectedPath && (
              <button
                onClick={() => setSelectedPath(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', padding: '2px',
                  display: 'flex', alignItems: 'center',
                }}
                title="Mostrar todos"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Selected Filter Label */}
          {selectedPath && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(207, 160, 82, 0.06)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
            }}>
              <p className="text-secondary" style={{ fontSize: '0.7rem' }}>
                Filtrado por: <span className="text-white font-semibold">{selectedPath.split('///').join(' → ')}</span>
              </p>
            </div>
          )}

          {/* Tabs: Activos / Inactivos */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setDetailTab('activos')}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s',
                background: detailTab === 'activos' ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
                color: detailTab === 'activos' ? '#4ade80' : '#9ca3af',
                borderBottom: detailTab === 'activos' ? '2px solid #4ade80' : '2px solid transparent',
              }}
            >
              Activos ({activeClients.length})
            </button>
            <button
              onClick={() => setDetailTab('inactivos')}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s',
                background: detailTab === 'inactivos' ? 'rgba(248, 113, 113, 0.1)' : 'transparent',
                color: detailTab === 'inactivos' ? '#f87171' : '#9ca3af',
                borderBottom: detailTab === 'inactivos' ? '2px solid #f87171' : '2px solid transparent',
              }}
            >
              Inactivos ({inactiveClients.length})
            </button>
          </div>

          {/* Client List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
            minHeight: 0,
          }}>
            {visibleClients.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: '0.75rem', padding: '16px', textAlign: 'center' }}>
                No hay clientes {detailTab === 'activos' ? 'activos' : 'inactivos'}.
              </p>
            ) : (
              visibleClients.map((c, idx) => (
                <div
                  key={c.cliente_id || idx}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="text-white" style={{
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }} title={c.nombre_comercial}>
                    {c.nombre_comercial}
                  </span>
                  {detailTab === 'activos' && (
                    <span className="text-gold font-bold" style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                      {latestSaturday && c.redemption_dates
                        ? c.redemption_dates.filter(d => d === latestSaturday).length
                        : c.redemptions}
                    </span>
                  )}
                </div>
              ))
            )}
            {displayClients.length > displayLimit && (
              <p className="text-secondary" style={{
                fontSize: '0.65rem', textAlign: 'center',
                padding: '8px', opacity: 0.8,
              }}>
                Mostrando {displayLimit} de {displayClients.length} clientes.
              </p>
            )}
          </div>

          {/* Download button */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <button
              onClick={downloadClientList}
              className="btn-gold"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                fontSize: '0.75rem',
              }}
            >
              <Download size={14} />
              Descargar Lista Completa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Metrics Computation (Saturday-specific) ────────────────────────
function computeMetrics(clients, latestSaturday, prevSaturday) {
  const total = clients.length;

  // Count redemptions per client on each Saturday
  let currentSabCount = 0;
  let prevSabCount = 0;
  let activeOnLatest = 0;
  let activeOnPrev = 0;

  clients.forEach(c => {
    if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
    let clientCurrentCount = 0;
    let clientPrevCount = 0;
    c.redemption_dates.forEach(dateStr => {
      if (dateStr === latestSaturday) { currentSabCount++; clientCurrentCount++; }
      if (dateStr === prevSaturday) { prevSabCount++; clientPrevCount++; }
    });
    if (clientCurrentCount > 0) activeOnLatest++;
    if (clientPrevCount > 0) activeOnPrev++;
  });

  const active = activeOnLatest;
  const inactive = total - active;
  const totalRedemptions = currentSabCount; // Only latest Saturday
  const avgPerActive = active > 0 ? (totalRedemptions / active).toFixed(1) : '0.0';
  const activePct = total > 0 ? ((active / total) * 100).toFixed(0) : '0';
  const inactivePct = total > 0 ? ((inactive / total) * 100).toFixed(0) : '0';

  const vsSabDelta = currentSabCount - prevSabCount;
  const vsSabPct = prevSabCount > 0 
    ? ((vsSabDelta / prevSabCount) * 100).toFixed(1)
    : (currentSabCount > 0 ? '∞' : '0');

  const vsSabActiveDelta = activeOnLatest - activeOnPrev;
  const vsSabActivePct = activeOnPrev > 0
    ? ((vsSabActiveDelta / activeOnPrev) * 100).toFixed(1)
    : (activeOnLatest > 0 ? '∞' : '0');

  return {
    total,
    active,
    inactive,
    totalRedemptions,
    avgPerActive,
    activePct,
    inactivePct,
    currentSabCount,
    prevSabCount,
    vsSabDelta,
    vsSabPct,
    activeOnLatest,
    activeOnPrev,
    vsSabActiveDelta,
    vsSabActivePct,
  };
}

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

// ─── PivotRow Component ─────────────────────────────────────────────
const PivotRow = ({ row, isSelected, onToggle, onSelect }) => {
  const indent = row.depth * 24;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 2fr) repeat(9, minmax(70px, 1fr))',
        gap: '0',
        padding: '0 16px',
        background: isSelected
          ? 'rgba(207, 160, 82, 0.12)'
          : row.bandColor,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.15s',
        cursor: 'pointer',
        minHeight: '38px',
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
      {/* Name cell with indent and expand toggle */}
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
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />
            }
          </button>
        ) : (
          <span style={{ width: '18px', flexShrink: 0 }} />
        )}
        <span
          className="text-white"
          style={{
            fontSize: row.depth === 0 ? '0.8rem' : '0.75rem',
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
          fontSize: '0.6rem',
          flexShrink: 0,
          marginLeft: '4px',
          opacity: 0.6,
        }}>
          {LEVEL_LABELS[row.level]}
        </span>
      </div>

      {/* Clientes Totales */}
      <div style={dataCellStyle}>
        <span className="text-white font-bold">{row.total}</span>
      </div>

      {/* Clientes Activos */}
      <div style={dataCellStyle}>
        <span style={{ color: '#4ade80', fontWeight: 600 }}>{row.active}</span>
      </div>

      {/* % Activos */}
      <div style={dataCellStyle}>
        <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>{row.activePct}%</span>
      </div>

      {/* Clientes Inactivos */}
      <div style={dataCellStyle}>
        <span style={{ color: '#f87171', fontWeight: 600 }}>{row.inactive}</span>
      </div>

      {/* % Inactivos */}
      <div style={dataCellStyle}>
        <span style={{ color: '#f87171', fontSize: '0.7rem' }}>{row.inactivePct}%</span>
      </div>

      {/* VS SAB ACT */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabActiveDelta > 0 ? '#4ade80' : row.vsSabActiveDelta < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabActiveDelta > 0 ? '+' : ''}{row.vsSabActiveDelta}
          <span style={{ 
            fontSize: '0.6rem', 
            marginLeft: '2px', 
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabActivePct !== '∞' ? `(${row.vsSabActivePct}%)` : '(nuevo)'}
          </span>
        </span>
      </div>

      {/* Redenciones Totales */}
      <div style={dataCellStyle}>
        <span className="text-gold font-bold" style={{ fontSize: '0.8rem' }}>
          {row.totalRedemptions.toLocaleString()}
        </span>
      </div>

      {/* VS SAB RED */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabDelta > 0 ? '#4ade80' : row.vsSabDelta < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabDelta > 0 ? '+' : ''}{row.vsSabDelta}
          <span style={{ 
            fontSize: '0.6rem', 
            marginLeft: '2px', 
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabPct !== '∞' ? `(${row.vsSabPct}%)` : '(nuevo)'}
          </span>
        </span>
      </div>

      {/* Red Prom x Activo */}
      <div style={dataCellStyle}>
        <span className="text-white" style={{ fontSize: '0.75rem' }}>
          {row.avgPerActive}
        </span>
      </div>
    </div>
  );
};

const dataCellStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  padding: '4px 2px',
};

// ─── SortHeader Component ───────────────────────────────────────────
const SortHeader = ({ label, sortKey, sortConfig, onSort, isName, purple }) => {
  const isActive = sortConfig.key === sortKey;
  const dir = isActive ? sortConfig.direction : null;

  return (
    <div
      onClick={() => onSort(sortKey)}
      style={{
        ...(isName
          ? { fontSize: '0.7rem', fontWeight: 700, color: '#cfa052', textTransform: 'uppercase', letterSpacing: '0.05em' }
          : { ...headerCellStyle, ...(purple ? { color: '#a78bfa' } : {}) }
        ),
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isName ? 'flex-start' : 'center',
        gap: '3px',
      }}
      title={`Ordenar por ${typeof label === 'string' ? label : sortKey}`}
    >
      <span style={{ lineHeight: 1.3 }}>{label}</span>
      <span style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0px',
        flexShrink: 0,
        opacity: isActive ? 1 : 0.3,
        transition: 'opacity 0.15s',
      }}>
        {dir === 'asc'
          ? <ArrowUp size={10} style={{ color: '#cfa052' }} />
          : dir === 'desc'
            ? <ArrowDown size={10} style={{ color: '#cfa052' }} />
            : <ArrowDown size={9} style={{ color: '#9ca3af' }} />
        }
      </span>
    </div>
  );
};

export default PivotView;
