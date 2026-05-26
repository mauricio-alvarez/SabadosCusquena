import { useState, useMemo, useCallback, useEffect } from 'react';
import { Download, Users, Target, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

const LEVEL_KEYS = ['direccion', 'gerencia', 'supervisor', 'BDR'];
const LEVEL_LABELS = ['Dirección', 'Gerencia', 'Supervisor', 'BDR'];

const CampaignView = ({ allClients, progressData }) => {
  const [selectedFilters, setSelectedFilters] = useState({ direccion: null, gerencia: null, supervisor: null, BDR: null });
  const [detailTab, setDetailTab] = useState('adheridos');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine the list of Saturdays from available_dates
  const saturdays = useMemo(() => {
    if (!progressData || !progressData.available_dates) return [];
    return progressData.available_dates.filter(dateStr => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return false;
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return d.getDay() === 6; // 6 = Saturday
    });
  }, [progressData]);

  // Helper function to calculate Q1
  const getQ1 = useCallback((values) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * 0.25;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }, []);

  // Precalculate Q1 threshold for each Saturday
  const saturdayQ1s = useMemo(() => {
    const q1Map = {};
    if (!allClients || allClients.length === 0 || saturdays.length === 0) return q1Map;

    saturdays.forEach(sat => {
      const counts = [];
      allClients.forEach(c => {
        if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
        const count = c.redemption_dates.filter(d => d === sat).length;
        if (count > 0) {
          counts.push(count);
        }
      });
      q1Map[sat] = getQ1(counts);
    });
    return q1Map;
  }, [allClients, saturdays, getQ1]);

  // Precalculate category for each client
  const clientClassifications = useMemo(() => {
    const classifications = {};
    if (!allClients || allClients.length === 0 || saturdays.length === 0) return classifications;

    allClients.forEach(c => {
      let aboveCount = 0;
      saturdays.forEach(sat => {
        if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
        const count = c.redemption_dates.filter(d => d === sat).length;
        const q1 = saturdayQ1s[sat] || 0;
        if (count > q1) {
          aboveCount++;
        }
      });

      const ratio = aboveCount / saturdays.length;
      let category = 'no_adherido';
      if (ratio >= 0.75) {
        category = 'adherido';
      } else if (ratio >= 0.25) {
        category = 'intermitente';
      }

      classifications[c.cliente_id] = {
        category,
        aboveCount,
        ratio,
      };
    });
    return classifications;
  }, [allClients, saturdays, saturdayQ1s]);

  // Filter clients by ALL active hierarchical filters (for charts, summary, and detail panel)
  const selectedClients = useMemo(() => {
    if (!allClients) return [];
    return allClients.filter(c => {
      for (const level of LEVEL_KEYS) {
        if (selectedFilters[level] && c[level] !== selectedFilters[level]) return false;
      }
      return true;
    });
  }, [selectedFilters, allClients]);

  // Filter clients by levels ABOVE a given level (for each table's data source)
  const getClientsForLevel = useCallback((level) => {
    if (!allClients) return [];
    const levelIdx = LEVEL_KEYS.indexOf(level);
    return allClients.filter(c => {
      for (let i = 0; i < levelIdx; i++) {
        const filterLevel = LEVEL_KEYS[i];
        if (selectedFilters[filterLevel] && c[filterLevel] !== selectedFilters[filterLevel]) return false;
      }
      return true;
    });
  }, [allClients, selectedFilters]);

  // Precalculate evolution graph points week-by-week
  const evolutionData = useMemo(() => {
    if (!selectedClients || selectedClients.length === 0 || saturdays.length === 0) return [];

    const points = [];
    for (let k = 0; k < saturdays.length; k++) {
      let adherido = 0;
      let intermitente = 0;
      let no_adherido = 0;

      selectedClients.forEach(c => {
        let aboveCount = 0;
        for (let j = 0; j <= k; j++) {
          const sat = saturdays[j];
          if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) continue;
          const count = c.redemption_dates.filter(d => d === sat).length;
          const q1 = saturdayQ1s[sat] || 0;
          if (count > q1) {
            aboveCount++;
          }
        }
        const ratio = aboveCount / (k + 1);
        if (ratio >= 0.75) {
          adherido++;
        } else if (ratio >= 0.25) {
          intermitente++;
        } else {
          no_adherido++;
        }
      });

      points.push({
        date: saturdays[k],
        shortDate: saturdays[k].substring(0, 5),
        adherido,
        intermitente,
        no_adherido,
      });
    }
    return points;
  }, [selectedClients, saturdays, saturdayQ1s]);

  // Overall summary (counts from filtered selectedClients only)
  const summary = useMemo(() => {
    let adherido = 0;
    let intermitente = 0;
    let no_adherido = 0;

    selectedClients.forEach(c => {
      const info = clientClassifications[c.cliente_id];
      if (!info) return;
      if (info.category === 'adherido') adherido++;
      else if (info.category === 'intermitente') intermitente++;
      else no_adherido++;
    });

    const total = selectedClients.length;
    return {
      total,
      adherido,
      adheridoPct: total > 0 ? ((adherido / total) * 100).toFixed(1) : '0.0',
      intermitente,
      intermitentePct: total > 0 ? ((intermitente / total) * 100).toFixed(1) : '0.0',
      no_adherido,
      noAdheridoPct: total > 0 ? ((no_adherido / total) * 100).toFixed(1) : '0.0',
    };
  }, [selectedClients, clientClassifications]);

  // selectedClients is now defined earlier (after clientClassifications) for cross-filtering

  // Grouped clients for the detail tabs
  const detailClients = useMemo(() => {
    const grouped = { adheridos: [], intermitentes: [], no_adheridos: [] };
    selectedClients.forEach(c => {
      const info = clientClassifications[c.cliente_id];
      if (info) {
        if (info.category === 'adherido') grouped.adheridos.push(c);
        else if (info.category === 'intermitente') grouped.intermitentes.push(c);
        else grouped.no_adheridos.push(c);
      }
    });
    return grouped;
  }, [selectedClients, clientClassifications]);

  const displayClients = detailClients[detailTab === 'adheridos' ? 'adheridos' : detailTab === 'intermitentes' ? 'intermitentes' : 'no_adheridos'];
  const displayLimit = 20;
  const visibleClients = displayClients.slice(0, displayLimit);

  // Toggle filter selections on row clicks (hierarchical: set this level, clear levels below)
  const handleRowClick = useCallback((level, name) => {
    setSelectedFilters(prev => {
      const clickedIdx = LEVEL_KEYS.indexOf(level);
      const newFilters = { ...prev };

      if (prev[level] === name) {
        // Deselect: clear this level and all below
        for (let i = clickedIdx; i < LEVEL_KEYS.length; i++) {
          newFilters[LEVEL_KEYS[i]] = null;
        }
      } else {
        // Select: set this level, clear all below
        newFilters[level] = name;
        for (let i = clickedIdx + 1; i < LEVEL_KEYS.length; i++) {
          newFilters[LEVEL_KEYS[i]] = null;
        }
      }
      return newFilters;
    });
  }, []);

  // Excel download for the detail panel list
  const downloadClientList = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const activeRows = detailClients.adheridos.map(c => ({
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      'Sábados Sobre Q1': clientClassifications[c.cliente_id]?.aboveCount || 0,
      'Total Sábados': saturdays.length,
      '% Adherencia': `${((clientClassifications[c.cliente_id]?.ratio || 0) * 100).toFixed(0)}%`,
    }));

    const interRows = detailClients.intermitentes.map(c => ({
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      'Sábados Sobre Q1': clientClassifications[c.cliente_id]?.aboveCount || 0,
      'Total Sábados': saturdays.length,
      '% Adherencia': `${((clientClassifications[c.cliente_id]?.ratio || 0) * 100).toFixed(0)}%`,
    }));

    const noRows = detailClients.no_adheridos.map(c => ({
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      'Sábados Sobre Q1': clientClassifications[c.cliente_id]?.aboveCount || 0,
      'Total Sábados': saturdays.length,
      '% Adherencia': `${((clientClassifications[c.cliente_id]?.ratio || 0) * 100).toFixed(0)}%`,
    }));

    if (activeRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeRows), 'Adheridos');
    if (interRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(interRows), 'Intermitentes');
    if (noRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(noRows), 'No Adheridos');

    const activeFilterNames = LEVEL_KEYS.map(k => selectedFilters[k]).filter(Boolean);
    const label = activeFilterNames.length > 0 ? activeFilterNames.join('_') : 'Todos';
    XLSX.writeFile(wb, `Detalle_Campaña_${label}.xlsx`);
  }, [detailClients, clientClassifications, saturdays, selectedFilters]);

  // General layout stats aggregator for subdivisions (each table filtered by levels ABOVE it)
  const getLevelData = useCallback((level) => {
    const clients = getClientsForLevel(level);
    if (clients.length === 0 || Object.keys(clientClassifications).length === 0) return [];
    
    // Find all unique values
    const uniqueNames = Array.from(new Set(clients.map(c => c[level]).filter(v => v !== null && v !== 'N/A'))).sort();
    
    return uniqueNames.map(name => {
      const groupClients = clients.filter(c => c[level] === name);
      
      let adherido = 0;
      let intermitente = 0;
      let no_adherido = 0;

      groupClients.forEach(c => {
        const info = clientClassifications[c.cliente_id];
        if (info) {
          if (info.category === 'adherido') adherido++;
          else if (info.category === 'intermitente') intermitente++;
          else no_adherido++;
        }
      });

      const total = groupClients.length;
      const adheridoPct = total > 0 ? ((adherido / total) * 100).toFixed(0) : '0';
      const intermitentePct = total > 0 ? ((intermitente / total) * 100).toFixed(0) : '0';
      const noAdheridoPct = total > 0 ? ((no_adherido / total) * 100).toFixed(0) : '0';

      // Average redemptions per active Saturday
      let totalRedemptions = 0;
      let totalActiveSaturdays = 0;
      groupClients.forEach(c => {
        if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
        saturdays.forEach(sat => {
          const count = c.redemption_dates.filter(d => d === sat).length;
          if (count > 0) {
            totalRedemptions += count;
            totalActiveSaturdays++;
          }
        });
      });
      const avgPerActiveSat = totalActiveSaturdays > 0 ? (totalRedemptions / totalActiveSaturdays).toFixed(1) : '0.0';

      return {
        name,
        total,
        adherido,
        adheridoPct,
        intermitente,
        intermitentePct,
        no_adherido,
        noAdheridoPct,
        avgPerActiveSat,
      };
    });
  }, [getClientsForLevel, clientClassifications, saturdays]);

  const direccioneData = useMemo(() => getLevelData('direccion'), [getLevelData]);
  const gerenciasData = useMemo(() => getLevelData('gerencia'), [getLevelData]);
  const supervisoresData = useMemo(() => getLevelData('supervisor'), [getLevelData]);
  const bdrsData = useMemo(() => getLevelData('BDR'), [getLevelData]);

  // Excel download for the full campaign view hierarchy (all levels as tabs)
  const downloadFullReport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const formatRows = (data) => {
      const formatted = data.map(d => ({
        'Nombre': d.name,
        'Total Locales': d.total,
        'Adheridos': d.adherido,
        '% Adheridos': `${d.adheridoPct}%`,
        'Intermitentes': d.intermitente,
        '% Intermitentes': `${d.intermitentePct}%`,
        'No Adheridos': d.no_adherido,
        '% No Adheridos': `${d.noAdheridoPct}%`,
        'Prom Canjes x Sábado Activo': d.avgPerActiveSat,
      }));
      
      if (summary) {
        formatted.push({
          'Nombre': 'TOTAL',
          'Total Locales': summary.total,
          'Adheridos': summary.adherido,
          '% Adheridos': `${summary.adheridoPct}%`,
          'Intermitentes': summary.intermitente,
          '% Intermitentes': `${summary.intermitentePct}%`,
          'No Adheridos': summary.no_adherido,
          '% No Adheridos': `${summary.noAdheridoPct}%`,
          'Prom Canjes x Sábado Activo': '',
        });
      }
      return formatted;
    };

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(direccioneData)), 'Direcciones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(gerenciasData)), 'Gerencias');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(supervisoresData)), 'Supervisores');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(bdrsData)), 'BDRs');

    XLSX.writeFile(wb, 'Desempeño_Campaña_Total.xlsx');
  }, [direccioneData, gerenciasData, supervisoresData, bdrsData, summary]);

  // Render Thermometer arc gauge
  const renderGauge = () => {
    if (!summary) return null;
    const radius = 65;
    const strokeWidth = 12;
    const circumference = Math.PI * radius; // Half circle
    const pct = parseFloat(summary.adheridoPct) + parseFloat(summary.intermitentePct);
    const percentage = pct;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center" style={{ position: 'relative', height: '100%' }}>
        <svg width="160" height="85" viewBox="0 0 160 85" style={{ overflow: 'visible' }}>
          {/* Background Arc */}
          <path
            d="M 15,75 A 65,65 0 0,1 145,75"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Foreground arc with gradient */}
          <path
            d="M 15,75 A 65,65 0 0,1 145,75"
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
              <stop offset="50%" stopColor="#f59e0b" /> {/* Amber */}
              <stop offset="100%" stopColor="#10b981" /> {/* Green */}
            </linearGradient>
          </defs>
          <text x="80" y="68" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">
            {pct}%
          </text>
        </svg>
        <div className="text-center mt-1">
          <span className="text-gold font-bold uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Clientes Redimiendo</span>
        </div>
      </div>
    );
  };

  // Render SVG Evolution line chart
  const renderEvolutionChart = () => {
    if (evolutionData.length === 0) return null;

    const width = 500;
    const height = 100;
    const paddingX = 40;
    const paddingY = 15;

    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;
    const maxVal = selectedClients.length;

    const getX = (idx) => {
      if (evolutionData.length <= 1) return paddingX + chartWidth / 2;
      return paddingX + (idx / (evolutionData.length - 1)) * chartWidth;
    };

    const getY = (val) => {
      return paddingY + chartHeight - (val / maxVal) * chartHeight;
    };

    const getPathD = (key) => {
      return evolutionData.map((d, idx) => {
        const x = getX(idx);
        const y = getY(d[key]);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    };

    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gold font-bold uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Evolución de Categorías</span>
          <div className="flex gap-3 text-[8.5px]">
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} /> Adheridos
            </span>
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b' }} /> Intermitentes
            </span>
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} /> No Adheridos
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {/* Grid Lines */}
            {[0, 0.5, 1.0].map((pct, idx) => {
              const val = Math.round(maxVal * pct);
              const y = getY(val);
              return (
                <g key={idx}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                  <text x={paddingX - 8} y={y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{val}</text>
                </g>
              );
            })}

            {/* X axis labels */}
            {evolutionData.map((d, idx) => {
              const x = getX(idx);
              return (
                <g key={idx}>
                  <line x1={x} y1={paddingY} x2={x} y2={paddingY + chartHeight} stroke="rgba(255,255,255,0.02)" />
                  <text x={x} y={height - paddingY + 12} fill="#9ca3af" fontSize="8" textAnchor="middle">{d.shortDate}</text>
                </g>
              );
            })}

            {/* Lines */}
            <path d={getPathD('adherido')} fill="none" stroke="#10b981" strokeWidth="2" style={{ opacity: 0.8 }} />
            <path d={getPathD('intermitente')} fill="none" stroke="#f59e0b" strokeWidth="2" style={{ opacity: 0.8 }} />
            <path d={getPathD('no_adherido')} fill="none" stroke="#ef4444" strokeWidth="2" style={{ opacity: 0.8 }} />

            {/* Dots */}
            {evolutionData.map((d, idx) => (
              <g key={idx}>
                <circle cx={getX(idx)} cy={getY(d.adherido)} r="3" fill="#10b981" stroke="#0e1726" strokeWidth="0.8" />
                <circle cx={getX(idx)} cy={getY(d.intermitente)} r="3" fill="#f59e0b" stroke="#0e1726" strokeWidth="0.8" />
                <circle cx={getX(idx)} cy={getY(d.no_adherido)} r="3" fill="#ef4444" stroke="#0e1726" strokeWidth="0.8" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  // Render separate compact table for a specific subdivision level
  const renderLevelTable = (title, level, data, maxHeight) => {
    const isLevelSelected = !!selectedFilters[level];

    // Compute per-table totals from its own data rows
    const tableTotal = data.reduce((acc, r) => acc + r.total, 0);
    const tableAdherido = data.reduce((acc, r) => acc + r.adherido, 0);
    const tableIntermitente = data.reduce((acc, r) => acc + r.intermitente, 0);
    const tableNoAdherido = data.reduce((acc, r) => acc + r.no_adherido, 0);
    const tableAdheridoPct = tableTotal > 0 ? ((tableAdherido / tableTotal) * 100).toFixed(0) : '0';
    const tableIntermitentePct = tableTotal > 0 ? ((tableIntermitente / tableTotal) * 100).toFixed(0) : '0';
    const tableNoAdheridoPct = tableTotal > 0 ? ((tableNoAdherido / tableTotal) * 100).toFixed(0) : '0';
    const tableAvg = data.length > 0
      ? (data.reduce((acc, curr) => acc + parseFloat(curr.avgPerActiveSat), 0) / data.length).toFixed(1)
      : '0.0';

    return (
      <div className="glass-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}>
        {/* Header Title */}
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span className="text-gold font-bold text-[10.5px] uppercase tracking-wider">{title}</span>
          {isLevelSelected && (
            <span className="text-secondary text-[8.5px] font-semibold">
              Filtrado: {selectedFilters[level]}
            </span>
          )}
        </div>

        {/* Columns Grid headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 1.6fr) repeat(5, minmax(52px, 1fr))',
          gap: '0',
          padding: '5px 12px',
          borderBottom: '1px solid rgba(207, 160, 82, 0.2)',
          background: 'rgba(207, 160, 82, 0.03)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#cfa052', textTransform: 'uppercase' }}>Nombre</div>
          <div style={headerCellStyle}>Total</div>
          <div style={{ ...headerCellStyle, color: '#10b981' }}>Adh.</div>
          <div style={{ ...headerCellStyle, color: '#f59e0b' }}>Inter.</div>
          <div style={{ ...headerCellStyle, color: '#ef4444' }}>No Adh.</div>
          <div style={headerCellStyle}>Canjes</div>
        </div>

        {/* Scrollable list of rows */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          maxHeight: maxHeight,
        }}>
          {data.map((row) => {
            const isRowSelected = selectedFilters[level] === row.name;
            return (
              <div
                key={row.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 1.6fr) repeat(5, minmax(52px, 1fr))',
                  gap: '0',
                  padding: '5px 12px',
                  background: isRowSelected ? 'rgba(207, 160, 82, 0.12)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  minHeight: '30px',
                  alignItems: 'center',
                }}
                onClick={() => handleRowClick(level, row.name)}
                onMouseEnter={e => {
                  if (!isRowSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  if (!isRowSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="text-white truncate" style={{ fontSize: '0.68rem', fontWeight: 500 }} title={row.name}>
                  {row.name}
                </div>
                <div style={dataCellStyle}>{row.total}</div>
                <div style={{ ...dataCellStyle, color: '#10b981', fontWeight: 500 }}>
                  {row.adherido}
                  <span style={{ fontSize: '0.55rem', fontWeight: 400, opacity: 0.7, marginLeft: '1px' }}>({row.adheridoPct}%)</span>
                </div>
                <div style={{ ...dataCellStyle, color: '#f59e0b', fontWeight: 500 }}>
                  {row.intermitente}
                  <span style={{ fontSize: '0.55rem', fontWeight: 400, opacity: 0.7, marginLeft: '1px' }}>({row.intermitentePct}%)</span>
                </div>
                <div style={{ ...dataCellStyle, color: '#ef4444', fontWeight: 500 }}>
                  {row.no_adherido}
                  <span style={{ fontSize: '0.55rem', fontWeight: 400, opacity: 0.7, marginLeft: '1px' }}>({row.noAdheridoPct}%)</span>
                </div>
                <div style={dataCellStyle}>{row.avgPerActiveSat}</div>
              </div>
            );
          })}
        </div>

        {/* Total Sticky Row */}
        {data.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(100px, 1.6fr) repeat(5, minmax(52px, 1fr))',
              gap: '0',
              padding: '5px 12px',
              background: 'rgba(207, 160, 82, 0.12)',
              borderTop: '1px solid rgba(207, 160, 82, 0.3)',
              minHeight: '30px',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div className="text-gold font-bold" style={{ fontSize: '0.65rem' }}>TOTAL</div>
            <div style={dataCellStyle} className="font-bold">{tableTotal}</div>
            <div style={{ ...dataCellStyle, color: '#10b981', fontWeight: 700 }}>
              {tableAdherido}
              <span style={{ fontSize: '0.55rem', fontWeight: 500, opacity: 0.8, marginLeft: '1px' }}>({tableAdheridoPct}%)</span>
            </div>
            <div style={{ ...dataCellStyle, color: '#f59e0b', fontWeight: 700 }}>
              {tableIntermitente}
              <span style={{ fontSize: '0.55rem', fontWeight: 500, opacity: 0.8, marginLeft: '1px' }}>({tableIntermitentePct}%)</span>
            </div>
            <div style={{ ...dataCellStyle, color: '#ef4444', fontWeight: 700 }}>
              {tableNoAdherido}
              <span style={{ fontSize: '0.55rem', fontWeight: 500, opacity: 0.8, marginLeft: '1px' }}>({tableNoAdheridoPct}%)</span>
            </div>
            <div style={dataCellStyle} className="font-bold">
              {tableAvg}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render detail panel for lists
  const renderDetailPanel = () => {
    return (
      <div className="glass-panel" style={{
        width: isMobile ? '100%' : '300px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
        maxHeight: isMobile ? 'none' : '530px',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={15} className="text-gold" />
            <span className="text-white font-bold" style={{ fontSize: '0.8rem' }}>Detalle Clientes</span>
          </div>
          {LEVEL_KEYS.some(k => selectedFilters[k]) && (
            <span className="text-secondary truncate max-w-[140px]" style={{ fontSize: '0.65rem', opacity: 0.8 }}
              title={LEVEL_KEYS.map(k => selectedFilters[k]).filter(Boolean).join(' → ')}
            >
              {LEVEL_KEYS.map(k => selectedFilters[k]).filter(Boolean).join(' → ')}
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setDetailTab('adheridos')}
            style={{
              flex: 1, padding: '8px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'adheridos' ? '2px solid #10b981' : 'none',
              color: detailTab === 'adheridos' ? '#10b981' : '#9ca3af',
              fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Adh. ({detailClients.adheridos.length})
          </button>
          <button
            onClick={() => setDetailTab('intermitentes')}
            style={{
              flex: 1, padding: '8px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'intermitentes' ? '2px solid #f59e0b' : 'none',
              color: detailTab === 'intermitentes' ? '#f59e0b' : '#9ca3af',
              fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Inter. ({detailClients.intermitentes.length})
          </button>
          <button
            onClick={() => setDetailTab('no_adheridos')}
            style={{
              flex: 1, padding: '8px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'no_adheridos' ? '2px solid #ef4444' : 'none',
              color: detailTab === 'no_adheridos' ? '#ef4444' : '#9ca3af',
              fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            No Adh. ({detailClients.no_adheridos.length})
          </button>
        </div>

        {/* List of clients */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: '6px',
          minHeight: 0,
        }}>
          {displayClients.length === 0 ? (
            <div style={{
              textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: '0.72rem', opacity: 0.6
            }}>
              Ningún cliente en este segmento.
            </div>
          ) : (
            visibleClients.map(c => (
              <div
                key={c.cliente_id}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span className="text-white truncate" style={{ fontSize: '0.72rem', fontWeight: 500 }} title={c.nombre_comercial}>
                  {c.nombre_comercial}
                </span>
                <span className="text-secondary" style={{ fontSize: '0.62rem', flexShrink: 0, opacity: 0.8 }}>
                  {clientClassifications[c.cliente_id]?.aboveCount || 0}/{saturdays.length} Sáb
                </span>
              </div>
            ))
          )}
          {displayClients.length > displayLimit && (
            <p className="text-secondary" style={{ fontSize: '0.62rem', textAlign: 'center', padding: '8px', opacity: 0.8 }}>
              Mostrando {displayLimit} de {displayClients.length} locales.
            </p>
          )}
        </div>

        {/* Download list button */}
        <div style={{
          padding: '10px 16px',
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
              padding: '6px 12px',
              fontSize: '0.72rem',
            }}
          >
            <Download size={13} />
            Descargar Lista
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6" style={{ gap: '12px' }}>
      
      {/* Compact Graphs Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.2fr 2.5fr',
        gap: '16px',
        flexShrink: 0,
      }}>
        {/* Thermometer Gauge */}
        <div className="glass-panel" style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '140px',
        }}>
          {renderGauge()}
        </div>

        {/* Evolution Chart */}
        <div className="glass-panel" style={{
          padding: '8px 16px',
          height: '140px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {renderEvolutionChart()}
        </div>
      </div>

      {/* Table Header Section */}
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
            <Target size={18} color="#CFA052" />
          </div>
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: '1.1rem', margin: 0 }}>
              Desempeño Campaña Total
            </h2>
            {saturdays.length > 0 && (
              <p className="text-secondary" style={{ fontSize: '0.7rem', marginTop: '1px' }}>
                Evaluado sobre {saturdays.length} sábados en total
              </p>
            )}
          </div>
        </div>
        <button
          onClick={downloadFullReport}
          className="btn-gold"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.75rem' }}
        >
          <Download size={14} />
          Descargar Reporte Completo
        </button>
      </div>

      {/* Main content: Grid of Tables + Detail panel */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '16px',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Tables Grid */}
        <div style={{
          flex: isMobile ? 'none' : '1 1 0%',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '16px',
          minHeight: 0,
        }}>
          {renderLevelTable('Direcciones', 'direccion', direccioneData, '180px')}
          {renderLevelTable('Gerencias', 'gerencia', gerenciasData, '180px')}
          {renderLevelTable('Supervisores', 'supervisor', supervisoresData, '250px')}
          {renderLevelTable('BDRs', 'BDR', bdrsData, '250px')}
        </div>

        {/* Detail Panel */}
        {renderDetailPanel()}
      </div>
    </div>
  );
};

const headerCellStyle = {
  fontSize: '0.6rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  textAlign: 'center',
  lineHeight: 1.2,
};

const dataCellStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.72rem',
  padding: '3px 1px',
};

export default CampaignView;
