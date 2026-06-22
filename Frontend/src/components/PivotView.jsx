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

const ONE_WEEK_COMPARISON_OVERRIDE = {
  current: '07/06/2026',
  previous: '06/06/2026',
  startsAt: new Date(2026, 5, 7),
  endsBefore: new Date(2026, 5, 14),
};

const normalizeDateKey = (dateStr) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return String(dateStr || '');
  const [day, month, year] = parts;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const findAvailableDate = (availableDates, targetDate) => {
  const targetKey = normalizeDateKey(targetDate);
  return availableDates.find(dateStr => normalizeDateKey(dateStr) === targetKey) || null;
};

const isDateForWeekday = (dateStr, weekday) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return false;
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return d.getDay() === weekday;
};

const isInfinitePct = (value) => {
  const text = String(value ?? '');
  return text === '∞' || text === 'âˆž' || text.toLowerCase() === 'infinity';
};

const formatVsText = (delta, pct) => {
  const prefix = delta > 0 ? '+' : '';
  const pctText = isInfinitePct(pct) ? 'nuevo' : `${pct}%`;
  return `${prefix}${delta} (${pctText})`;
};

const getDeltaColor = (delta) => {
  if (delta > 0) return '#16a34a';
  if (delta < 0) return '#dc2626';
  return '#64748b';
};

const normalizeTime = (timeStr) => {
  const [h = '0', m = '0', s = '0'] = String(timeStr || '00:00:00').split(':');
  return `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}:${String(Number(s) || 0).padStart(2, '0')}`;
};

const isSameCutoffOrEarlier = (timeStr, latestHourLimit) => (
  normalizeTime(timeStr) <= normalizeTime(latestHourLimit || '23:59:59')
);

const isDateToday = (dateStr) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return false;
  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const formatTimeCutoff = (timeStr) => {
  const [hour = '00', minute = '00', second = '00'] = normalizeTime(timeStr).split(':');
  return `${hour}:${minute}:${second}`;
};

const isOneWeekComparisonOverrideActive = () => {
  const today = new Date();
  return today >= ONE_WEEK_COMPARISON_OVERRIDE.startsAt
    && today < ONE_WEEK_COMPARISON_OVERRIDE.endsBefore;
};

const PivotView = ({ allClients, progressData, isDatesView = false, targetDay = 6, dayLabel = 'Sábado' }) => {
  const [expanded, setExpanded] = useState({});
  const [selectedPath, setSelectedPath] = useState(null);
  const [detailTab, setDetailTab] = useState('activos');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null }); // { key: 'name'|'total'|..., direction: 'asc'|'desc' }
  const [customSelectedDate, setCustomSelectedDate] = useState('');
  const [selectedComparisonDate, setSelectedComparisonDate] = useState('');
  const dayLabelLower = dayLabel.toLowerCase();
  const previousDayShortLabel = targetDay === 0 ? 'Dom' : 'Sab';
  const previousDayKey = previousDayShortLabel.toUpperCase();
  const comparisonColumnLabel = isDatesView ? `${previousDayShortLabel} Pasado` : `${previousDayShortLabel} Base`;
  const comparisonDayLabelLower = isDatesView ? `${dayLabelLower} anterior` : `${dayLabelLower} base`;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter to Saturdays plus the specific Sunday 07/06/2026
  const availableEvaluationDates = useMemo(() => {
    if (!progressData || !progressData.available_dates) return [];

    return progressData.available_dates.filter(dateStr => {
      const normalized = normalizeDateKey(dateStr);
      if (normalized === '07/06/2026') return true;

      return isDateForWeekday(dateStr, 6); // 6 = Saturday
    }).reverse(); // Latest first
  }, [progressData]);

  const weekdayComparisonDates = useMemo(() => {
    if (!progressData || !progressData.available_dates) return [];
    return progressData.available_dates.filter(dateStr => isDateForWeekday(dateStr, targetDay));
  }, [progressData, targetDay]);

  const availableComparisonDates = useMemo(() => {
    if (weekdayComparisonDates.length <= 1) return [];
    return weekdayComparisonDates.slice(0, -1).reverse(); // Exclude current date and show latest first
  }, [weekdayComparisonDates]);

  // Set default selection when dates are loaded or isDatesView becomes active
  useEffect(() => {
    if (isDatesView && availableEvaluationDates.length > 0 && !customSelectedDate) {
      setCustomSelectedDate(availableEvaluationDates[0]);
    }
  }, [isDatesView, availableEvaluationDates, customSelectedDate]);

  useEffect(() => {
    if (isDatesView) return;

    if (availableComparisonDates.length === 0) {
      if (selectedComparisonDate) setSelectedComparisonDate('');
      return;
    }

    const selectedExists = availableComparisonDates.some(
      dateStr => normalizeDateKey(dateStr) === normalizeDateKey(selectedComparisonDate)
    );

    if (!selectedExists) {
      setSelectedComparisonDate(availableComparisonDates[0]);
    }
  }, [isDatesView, availableComparisonDates, selectedComparisonDate]);

  // Determine the dates to compare.
  const { latestSaturday, prevSaturday } = useMemo(() => {
    if (!progressData || !progressData.available_dates || progressData.available_dates.length === 0) {
      return { latestSaturday: null, prevSaturday: null };
    }

    const dates = progressData.available_dates;

    if (isDatesView) {
      // In Dates View: latestSaturday is the one chosen in the dropdown
      const selected = customSelectedDate || (availableEvaluationDates.length > 0 ? availableEvaluationDates[0] : null);
      if (!selected) return { latestSaturday: null, prevSaturday: null };

      // Determine prevSaturday for this selected date
      let prev = null;
      const normalizedSelected = normalizeDateKey(selected);

      if (normalizedSelected === '07/06/2026') {
        // Override Sunday 07/06 vs Saturday 06/06
        prev = findAvailableDate(dates, '06/06/2026');
      } else {
        // Find preceding Saturday in the sorted list of Saturdays
        const saturdays = dates.filter(dateStr => isDateForWeekday(dateStr, 6)); // Sorted oldest to newest

        const idx = saturdays.findIndex(dateStr => normalizeDateKey(dateStr) === normalizedSelected);
        if (idx > 0) {
          prev = saturdays[idx - 1]; // Preceding Saturday
        }
      }

      return {
        latestSaturday: selected,
        prevSaturday: prev,
      };
    } else {
      // In standard view: latest configured weekday is current; dropdown chooses the baseline.
      const currentDate = weekdayComparisonDates[weekdayComparisonDates.length - 1] || null;

      if (!currentDate) {
        return {
          latestSaturday: null,
          prevSaturday: null,
        };
      }

      const selectedBaseline = selectedComparisonDate
        ? findAvailableDate(weekdayComparisonDates, selectedComparisonDate)
        : null;
      const selectedIsCurrent = selectedBaseline
        ? normalizeDateKey(selectedBaseline) === normalizeDateKey(currentDate)
        : false;
      const fallbackBaseline = weekdayComparisonDates.length >= 2
        ? weekdayComparisonDates[weekdayComparisonDates.length - 2]
        : null;

      return {
        latestSaturday: currentDate,
        prevSaturday: selectedBaseline && !selectedIsCurrent ? selectedBaseline : fallbackBaseline,
      };
    }
  }, [progressData, isDatesView, customSelectedDate, availableEvaluationDates, weekdayComparisonDates, selectedComparisonDate]);

  // Calculate the maximum hour limit in latestSaturday's dynamic data
  const latestHourLimit = useMemo(() => {
    if (!allClients || allClients.length === 0 || !latestSaturday) return '23:59:59';
    let maxTime = '00:00:00';
    allClients.forEach(c => {
      if (!c.redemption_dates || !c.redemption_hours) return;
      c.redemption_dates.forEach((d, idx) => {
        if (d === latestSaturday) {
          const t = c.redemption_hours[idx];
          if (t && t > maxTime) {
            maxTime = t;
          }
        }
      });
    });
    return maxTime;
  }, [allClients, latestSaturday]);

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
          ...computeMetrics(groupClients, latestSaturday, prevSaturday, latestHourLimit),
        };
      });
    };

    return buildLevel(allClients, 0);
  }, [allClients, latestSaturday, prevSaturday, latestHourLimit]);

  // Calculate totals for the entire dataset
  const totals = useMemo(() => {
    if (!allClients || allClients.length === 0) return null;
    return {
      name: 'TOTAL',
      level: -1,
      total: allClients.length,
      ...computeMetrics(allClients, latestSaturday, prevSaturday, latestHourLimit),
    };
  }, [allClients, latestSaturday, prevSaturday, latestHourLimit]);

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

  const getClientRedemptions = useCallback((c) => {
    if (!latestSaturday || !c.redemption_dates || !Array.isArray(c.redemption_dates)) {
      return c.redemptions || 0;
    }
    return c.redemption_dates.filter(d => d === latestSaturday).length;
  }, [latestSaturday]);

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

  const activeClientsSorted = useMemo(() => {
    const sorted = [...activeClients];
    sorted.sort((a, b) => {
      const redA = getClientRedemptions(a);
      const redB = getClientRedemptions(b);
      if (redB !== redA) return redB - redA;
      return String(a.nombre_comercial || '').localeCompare(String(b.nombre_comercial || ''));
    });
    return sorted;
  }, [activeClients, getClientRedemptions]);

  const inactiveClientsSorted = useMemo(() => {
    const sorted = [...inactiveClients];
    sorted.sort((a, b) => {
      const redA = a.redemptions || 0;
      const redB = b.redemptions || 0;
      if (redB !== redA) return redB - redA;
      return String(a.nombre_comercial || '').localeCompare(String(b.nombre_comercial || ''));
    });
    return sorted;
  }, [inactiveClients]);

  const displayClients = detailTab === 'activos' ? activeClientsSorted : inactiveClientsSorted;
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
      'Código Cliente': c.cliente_id,
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      [`Redenciones (${latestSaturday || `Último ${previousDayShortLabel}`})`]: countOnDate(c, latestSaturday),
    }));

    const inactiveRows = inactiveClients.map(c => ({
      'Código Cliente': c.cliente_id,
      'Nombre Comercial': c.nombre_comercial,
      'Dirección': c.direccion,
      'Gerencia': c.gerencia,
      'Supervisor': c.supervisor,
      'BDR': c.BDR,
      [`Redenciones (${latestSaturday || `Último ${previousDayShortLabel}`})`]: countOnDate(c, latestSaturday),
    }));

    if (activeRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeRows), 'Activos');
    }
    if (inactiveRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inactiveRows), 'Inactivos');
    }

    const label = selectedPath ? selectedPath.replace(/\/\/\//g, '_') : 'Todos';
    XLSX.writeFile(wb, `Detalle_Clientes_${label}.xlsx`);
  }, [activeClients, inactiveClients, latestSaturday, previousDayShortLabel, selectedPath]);

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
          'Clientes Redimiendo': node.active,
          '% Redimiendo': node.activePct,
          'Clientes Sin Redimir': node.inactive,
          '% Sin Redimir': node.inactivePct,
          [`VS ${previousDayKey} ACT (Abs)`]: node.vsSabActiveDelta,
          [`VS ${previousDayKey} ACT (%)`]: node.vsSabActivePct,
          [`VS ${previousDayKey} ACT MH (Abs)`]: node.vsSabActiveDeltaSameHour,
          [`VS ${previousDayKey} ACT MH (%)`]: node.vsSabActivePctSameHour,
          'Redenciones Totales': node.totalRedemptions,
          [`VS ${previousDayKey} RED (Abs)`]: node.vsSabDelta,
          [`VS ${previousDayKey} RED (%)`]: node.vsSabPct,
          [`VS ${previousDayKey} RED MH (Abs)`]: node.vsSabDeltaSameHour,
          [`VS ${previousDayKey} RED MH (%)`]: node.vsSabPctSameHour,
          'Red Prom x Activo': node.avgPerActive,
          [`VS ${previousDayKey} PROM (Abs)`]: node.vsSabAvgDelta,
          [`VS ${previousDayKey} PROM (%)`]: node.vsSabAvgPct,
          [`VS ${previousDayKey} PROM MH (Abs)`]: node.vsSabAvgDeltaSameHour,
          [`VS ${previousDayKey} PROM MH (%)`]: node.vsSabAvgPctSameHour,
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
        'Clientes Redimiendo': totals.active,
        '% Redimiendo': totals.activePct,
        'Clientes Sin Redimir': totals.inactive,
        '% Sin Redimir': totals.inactivePct,
        [`VS ${previousDayKey} ACT (Abs)`]: totals.vsSabActiveDelta,
        [`VS ${previousDayKey} ACT (%)`]: totals.vsSabActivePct,
        [`VS ${previousDayKey} ACT MH (Abs)`]: totals.vsSabActiveDeltaSameHour,
        [`VS ${previousDayKey} ACT MH (%)`]: totals.vsSabActivePctSameHour,
        'Redenciones Totales': totals.totalRedemptions,
        [`VS ${previousDayKey} RED (Abs)`]: totals.vsSabDelta,
        [`VS ${previousDayKey} RED (%)`]: totals.vsSabPct,
        [`VS ${previousDayKey} RED MH (Abs)`]: totals.vsSabDeltaSameHour,
        [`VS ${previousDayKey} RED MH (%)`]: totals.vsSabPctSameHour,
        'Red Prom x Activo': totals.avgPerActive,
        [`VS ${previousDayKey} PROM (Abs)`]: totals.vsSabAvgDelta,
        [`VS ${previousDayKey} PROM (%)`]: totals.vsSabAvgPct,
        [`VS ${previousDayKey} PROM MH (Abs)`]: totals.vsSabAvgDeltaSameHour,
        [`VS ${previousDayKey} PROM MH (%)`]: totals.vsSabAvgPctSameHour,
      });
    }

    if (rows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tabla Dinámica');
    }
    XLSX.writeFile(wb, `Tabla_Dinamica_Desempeno_${dayLabel}.xlsx`);
  }, [tree, totals, dayLabel, previousDayKey]);

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
              {isDatesView ? 'Desempeño Fechas' : `${dayLabel} y Fecha Actual`}
            </h2>
            {latestSaturday && prevSaturday ? (
              <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Comparando {latestSaturday} vs {prevSaturday}
              </p>
            ) : latestSaturday ? (
              <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Evaluando {latestSaturday}
              </p>
            ) : null}
          </div>
        </div>

        {isDatesView && availableEvaluationDates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="text-secondary text-xs font-semibold whitespace-nowrap">Fecha de Evaluación:</label>
            <select
              className="filter-select"
              value={customSelectedDate || availableEvaluationDates[0]}
              onChange={(e) => setCustomSelectedDate(e.target.value)}
              style={{ width: 'auto', padding: '6px 32px 6px 12px', fontSize: '0.85rem' }}
            >
              {availableEvaluationDates.map(dateStr => {
                const normalized = normalizeDateKey(dateStr);
                const isSunday = normalized === '07/06/2026';
                const prefix = isSunday ? 'Domingo' : 'Sábado';
                return (
                  <option key={dateStr} value={dateStr}>
                    {prefix} {dateStr}
                  </option>
                );
              })}
            </select>
          </div>
        )}
        {!isDatesView && availableComparisonDates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label className="text-secondary text-xs font-semibold whitespace-nowrap">Comparar contra:</label>
            <select
              className="filter-select"
              value={selectedComparisonDate || availableComparisonDates[0]}
              onChange={(e) => setSelectedComparisonDate(e.target.value)}
              style={{ width: 'auto', padding: '6px 32px 6px 12px', fontSize: '0.85rem' }}
            >
              {availableComparisonDates.map(dateStr => (
                <option key={dateStr} value={dateStr}>
                  {dayLabel} {dateStr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isMobile ? (
        <MobilePivotCards
          totals={totals}
          directions={tree}
          latestSaturday={latestSaturday}
          prevSaturday={prevSaturday}
          latestHourLimit={latestHourLimit}
          onDownload={downloadPivotTable}
          dayLabel={dayLabel}
          dayLabelLower={dayLabelLower}
          comparisonDayLabelLower={comparisonDayLabelLower}
        />
      ) : (
      <>
      {/* Main content: Table + Detail panel */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
      }}>
        {/* Pivot Table */}
        <div className="glass-panel" style={{
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '520px',
        }}>
          {/* Scroll wrapper for horizontal overflow */}
          <div style={{
            overflowX: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ minWidth: '1250px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 2.2fr) repeat(11, minmax(90px, 1fr))',
                gap: '0',
                padding: '12px 16px',
                borderBottom: '2px solid rgba(207, 160, 82, 0.3)',
                background: 'rgba(207, 160, 82, 0.06)',
                flexShrink: 0,
              }}>
                <SortHeader label="Nombre" sortKey="name" sortConfig={sortConfig} onSort={toggleSort} isName />
                <SortHeader label={<>Clientes<br />Totales</>} sortKey="total" sortConfig={sortConfig} onSort={toggleSort} />
                <SortHeader label={<>Clientes<br />Redimiendo</>} sortKey="active" sortConfig={sortConfig} onSort={toggleSort} />
                <SortHeader label={<>Clientes<br />Sin Redimir</>} sortKey="inactive" sortConfig={sortConfig} onSort={toggleSort} />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Misma Hora</>} sortKey="vsSabActiveDeltaSameHour" sortConfig={sortConfig} onSort={toggleSort} purple />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Dia Completo</>} sortKey="vsSabActiveDelta" sortConfig={sortConfig} onSort={toggleSort} purple />                
                <SortHeader label={<>Redenc.<br />Totales</>} sortKey="totalRedemptions" sortConfig={sortConfig} onSort={toggleSort} />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Misma Hora</>} sortKey="vsSabDeltaSameHour" sortConfig={sortConfig} onSort={toggleSort} purple />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Dia Completo</>} sortKey="vsSabDelta" sortConfig={sortConfig} onSort={toggleSort} purple />               
                <SortHeader label={<>Red Prom<br />x Activo</>} sortKey="avgPerActive" sortConfig={sortConfig} onSort={toggleSort} />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Misma Hora</>} sortKey="vsSabAvgDeltaSameHour" sortConfig={sortConfig} onSort={toggleSort} purple />
                <SortHeader label={<>Var vs {comparisonColumnLabel}<br />Dia Completo</>} sortKey="vsSabAvgDelta" sortConfig={sortConfig} onSort={toggleSort} purple />
                
              </div>

              {/* Table Body - vertical scrolling only */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {flatRows.map((row) => (
                  <PivotRow
                    key={row.path}
                    row={row}
                    isSelected={selectedPath === row.path}
                    onToggle={() => toggleRow(row.path)}
                    onSelect={() => selectRow(row.path, row.clients)}
                  />
                ))}

                {/* Grand Total row - next to the last row, sticky at bottom when content overflows */}
                {totals && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(180px, 2.2fr) repeat(11, minmax(90px, 1fr))',
                      gap: '0',
                      padding: '0 16px',
                      background: 'var(--total-row-bg)',
                      borderTop: '2px solid rgba(207, 160, 82, 0.4)',
                      borderBottom: '2px solid rgba(207, 160, 82, 0.4)',
                      minHeight: '40px',
                      alignItems: 'center',
                      flexShrink: 0,
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
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {totals.active}
                        <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 500 }}>({totals.activePct}%)</span>
                      </span>
                    </div>
                    {/* Clientes Inactivos */}
                    <div style={dataCellStyle}>
                      <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {totals.inactive}
                        <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 500 }}>({totals.inactivePct}%)</span>
                      </span>
                    </div>
                    {/* VS SAB ACT SAME HOUR */}
                    <div style={dataCellStyle}>
                      <span style={{
                        color: totals.vsSabActiveDeltaSameHour > 0 ? '#4ade80' : totals.vsSabActiveDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}>
                        {totals.vsSabActiveDeltaSameHour > 0 ? '+' : ''}{totals.vsSabActiveDeltaSameHour}
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                          {totals.vsSabActivePctSameHour !== '∞' ? `(${totals.vsSabActivePctSameHour}%)` : '(nuevo)'}
                        </span>
                      </span>
                    </div>
                    {/* VS SAB ACT */}
                    <div style={dataCellStyle}>
                      <span style={{
                        color: totals.vsSabActiveDelta > 0 ? '#4ade80' : totals.vsSabActiveDelta < 0 ? '#f87171' : '#9ca3af',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}>
                        {totals.vsSabActiveDelta > 0 ? '+' : ''}{totals.vsSabActiveDelta}
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
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
                    {/* VS SAB RED SAME HOUR */}
                    <div style={dataCellStyle}>
                      <span style={{
                        color: totals.vsSabDeltaSameHour > 0 ? '#4ade80' : totals.vsSabDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}>
                        {totals.vsSabDeltaSameHour > 0 ? '+' : ''}{totals.vsSabDeltaSameHour}
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                          {totals.vsSabPctSameHour !== '∞' ? `(${totals.vsSabPctSameHour}%)` : '(nuevo)'}
                        </span>
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
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
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
                    {/* VS SAB PROM SAME HOUR */}
                    <div style={dataCellStyle}>
                      <span style={{
                        color: totals.vsSabAvgDeltaSameHour > 0 ? '#4ade80' : totals.vsSabAvgDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}>
                        {totals.vsSabAvgDeltaSameHour > 0 ? '+' : ''}{totals.vsSabAvgDeltaSameHour}
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                          {totals.vsSabAvgPctSameHour !== '∞' ? `(${totals.vsSabAvgPctSameHour}%)` : '(nuevo)'}
                        </span>
                      </span>
                    </div>
                    {/* VS SAB PROM */}
                    <div style={dataCellStyle}>
                      <span style={{
                        color: totals.vsSabAvgDelta > 0 ? '#4ade80' : totals.vsSabAvgDelta < 0 ? '#f87171' : '#9ca3af',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}>
                        {totals.vsSabAvgDelta > 0 ? '+' : ''}{totals.vsSabAvgDelta}
                        <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.8, fontWeight: 500 }}>
                          {totals.vsSabAvgPct !== '∞' ? `(${totals.vsSabAvgPct}%)` : '(nuevo)'}
                        </span>
                      </span>
                    </div>
                    
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="glass-panel" style={{
          width: '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '400px',
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

          {/* Header for client list */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 16px',
            borderBottom: '1px solid rgba(207, 160, 82, 0.2)',
            background: 'rgba(207, 160, 82, 0.02)',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}>
            <span>Cliente</span>
            <span>Redenciones</span>
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
                    maxWidth: '75%',
                  }} title={`${c.nombre_comercial} (${c.cliente_id})`}>
                    {c.cliente_id} - {c.nombre_comercial}
                  </span>
                  <span className="text-gold font-bold" style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                    {getClientRedemptions(c)}
                  </span>
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
      </>
      )}
    </div>
  );
};

// ─── Metrics Computation (Saturday-specific) ────────────────────────
const MobilePivotCards = ({ totals, directions, latestSaturday, prevSaturday, latestHourLimit, onDownload, dayLabel = 'Sábado', dayLabelLower = 'sábado', comparisonDayLabelLower = 'sábado base' }) => {
  if (!totals) return null;

  const primaryCards = [
    {
      title: 'Regalando Botellas',
      value: totals.active.toLocaleString(),
      detail: `${totals.activePct}% de ${totals.total.toLocaleString()} clientes`,
      sameHourDelta: totals.vsSabActiveDeltaSameHour,
      sameHourPct: totals.vsSabActivePctSameHour,
      fullDayDelta: totals.vsSabActiveDelta,
      fullDayPct: totals.vsSabActivePct,
      accent: '#16a34a',
    },
    {
      title: 'Redenciones Totales',
      value: totals.totalRedemptions.toLocaleString(),
      detail: `${totals.avgPerActive} redenciones por cliente activo`,
      sameHourDelta: totals.vsSabDeltaSameHour,
      sameHourPct: totals.vsSabPctSameHour,
      fullDayDelta: totals.vsSabDelta,
      fullDayPct: totals.vsSabPct,
      accent: '#CFA052',
    },
    {
      title: 'Promedio por Activo',
      value: totals.avgPerActive,
      detail: `${totals.inactive.toLocaleString()} clientes sin redimir (${totals.inactivePct}%)`,
      sameHourDelta: totals.vsSabAvgDeltaSameHour,
      sameHourPct: totals.vsSabAvgPctSameHour,
      fullDayDelta: totals.vsSabAvgDelta,
      fullDayPct: totals.vsSabAvgPct,
      accent: '#2563eb',
    },
  ];

  const sortedDirections = [...(directions || [])].sort((a, b) => b.active - a.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
          <div>
            <p className="text-secondary" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
              Resumen móvil
            </p>
            <h3 className="text-white font-bold" style={{ fontSize: '1rem', marginTop: '2px' }}>
              {latestSaturday ? `${dayLabel} ${latestSaturday}` : `${dayLabel} actual`}
            </h3>
            {prevSaturday && (
              <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Vs {comparisonDayLabelLower} {prevSaturday}
              </p>
            )}
          </div>
          <button
            className="btn-secondary"
            onClick={onDownload}
            style={{ padding: '8px 10px', fontSize: '0.72rem', flexShrink: 0 }}
          >
            <Download size={14} />
            Excel
          </button>
        </div>
        <p className="text-secondary" style={{ fontSize: '0.72rem' }}>
          Misma hora compara el {comparisonDayLabelLower} hasta {formatTimeCutoff(latestHourLimit)}. Día completo usa el mismo corte si la fecha evaluada ya cerró.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        {primaryCards.map(card => (
          <MobileMetricCard key={card.title} {...card} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', gap: '8px' }}>
        <h3 className="text-gold font-bold" style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Por Dirección
        </h3>
        <span className="text-secondary" style={{ fontSize: '0.72rem', textAlign: 'right' }}>
          Ordenado por clientes regalando botellas
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sortedDirections.map(direction => (
          <MobileDirectionCard key={direction.name} direction={direction} />
        ))}
      </div>
    </div>
  );
};

const MobileMetricCard = ({ title, value, detail, sameHourDelta, sameHourPct, fullDayDelta, fullDayPct, accent }) => (
  <div className="glass-panel" style={{ padding: '16px', borderLeft: `4px solid ${accent}` }}>
    <p className="text-secondary" style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {title}
    </p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
      <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>
        {value}
      </span>
      <span className="text-secondary" style={{ fontSize: '0.78rem' }}>
        {detail}
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
      <MobileVsChip label="Vs misma hora" delta={sameHourDelta} pct={sameHourPct} />
      <MobileVsChip label="Vs día completo" delta={fullDayDelta} pct={fullDayPct} />
    </div>
  </div>
);

const MobileDirectionCard = ({ direction }) => (
  <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <h4 className="text-white font-bold" style={{ fontSize: '0.92rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {direction.name}
        </h4>
        <p className="text-secondary" style={{ fontSize: '0.72rem', marginTop: '3px' }}>
          {direction.total.toLocaleString()} clientes totales
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1 }}>
          {direction.active}
        </span>
        <p className="text-secondary" style={{ fontSize: '0.68rem' }}>
          regalando botellas ({direction.activePct}%)
        </p>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <div>
        <p className="text-secondary" style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 800 }}>Regalando Botellas</p>
        <p className="text-gold font-bold" style={{ fontSize: '1.15rem' }}>{direction.totalRedemptions.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-secondary" style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 800 }}>Sin regalar</p>
        <p style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.15rem' }}>{direction.inactive} <span style={{ fontSize: '0.75rem' }}>({direction.inactivePct}%)</span></p>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <MobileVsChip label="Clientes vs misma hora" delta={direction.vsSabActiveDeltaSameHour} pct={direction.vsSabActivePctSameHour} />
      <MobileVsChip label="Clientes vs día completo" delta={direction.vsSabActiveDelta} pct={direction.vsSabActivePct} />
      <MobileVsChip label="Redenc. vs misma hora" delta={direction.vsSabDeltaSameHour} pct={direction.vsSabPctSameHour} />
      <MobileVsChip label="Redenc. vs día completo" delta={direction.vsSabDelta} pct={direction.vsSabPct} />
    </div>
  </div>
);

const MobileVsChip = ({ label, delta, pct }) => (
  <div style={{
    background: 'var(--subtle-surface)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '8px',
    minWidth: 0,
  }}>
    <p className="text-secondary" style={{ fontSize: '0.64rem', textTransform: 'uppercase', fontWeight: 800, lineHeight: 1.2 }}>
      {label}
    </p>
    <p style={{ color: getDeltaColor(delta), fontSize: '0.86rem', fontWeight: 800, marginTop: '4px' }}>
      {formatVsText(delta, pct)}
    </p>
  </div>
);

function computeMetrics(clients, latestSaturday, prevSaturday, latestHourLimit) {
  const total = clients.length;

  // Count redemptions per client on each Saturday
  let currentSabCount = 0;
  let prevSabCount = 0;
  let prevSabCountSameHour = 0;

  let activeOnLatest = 0;
  let activeOnPrev = 0;
  let activeOnPrevSameHour = 0;

  clients.forEach(c => {
    if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
    let clientCurrentCount = 0;
    let clientPrevCount = 0;
    let clientPrevCountSameHour = 0;

    c.redemption_dates.forEach((dateStr, idx) => {
      const hr = c.redemption_hours?.[idx] || '00:00:00';
      if (dateStr === latestSaturday) {
        currentSabCount++;
        clientCurrentCount++;
      }
      if (dateStr === prevSaturday) {
        prevSabCount++;
        clientPrevCount++;
        if (isSameCutoffOrEarlier(hr, latestHourLimit)) {
          prevSabCountSameHour++;
          clientPrevCountSameHour++;
        }
      }
    });
    if (clientCurrentCount > 0) activeOnLatest++;
    if (clientPrevCount > 0) activeOnPrev++;
    if (clientPrevCountSameHour > 0) activeOnPrevSameHour++;
  });

  const active = activeOnLatest;
  const inactive = total - active;
  const totalRedemptions = currentSabCount; // Only latest Saturday
  const avgPerActive = active > 0 ? (totalRedemptions / active).toFixed(1) : '0.0';
  const useClosedDateCutoff = latestSaturday ? !isDateToday(latestSaturday) : false;
  const prevSabCountForFullDay = useClosedDateCutoff ? prevSabCountSameHour : prevSabCount;
  const activeOnPrevForFullDay = useClosedDateCutoff ? activeOnPrevSameHour : activeOnPrev;
  const prevAvgPerActive = activeOnPrevForFullDay > 0 ? (prevSabCountForFullDay / activeOnPrevForFullDay).toFixed(1) : '0.0';
  const vsSabAvgDelta = (parseFloat(avgPerActive) - parseFloat(prevAvgPerActive)).toFixed(1);
  const vsSabAvgPct = parseFloat(prevAvgPerActive) > 0
    ? (((parseFloat(avgPerActive) - parseFloat(prevAvgPerActive)) / parseFloat(prevAvgPerActive)) * 100).toFixed(1)
    : (parseFloat(avgPerActive) > 0 ? '∞' : '0');
  const activePct = total > 0 ? ((active / total) * 100).toFixed(0) : '0';
  const inactivePct = total > 0 ? ((inactive / total) * 100).toFixed(0) : '0';

  const vsSabDelta = currentSabCount - prevSabCountForFullDay;
  const vsSabPct = prevSabCountForFullDay > 0
    ? ((vsSabDelta / prevSabCountForFullDay) * 100).toFixed(1)
    : (currentSabCount > 0 ? '∞' : '0');

  const vsSabActiveDelta = activeOnLatest - activeOnPrevForFullDay;
  const vsSabActivePct = activeOnPrevForFullDay > 0
    ? ((vsSabActiveDelta / activeOnPrevForFullDay) * 100).toFixed(1)
    : (activeOnLatest > 0 ? '∞' : '0');

  // Same hour metrics
  const vsSabActiveDeltaSameHour = activeOnLatest - activeOnPrevSameHour;
  const vsSabActivePctSameHour = activeOnPrevSameHour > 0
    ? ((vsSabActiveDeltaSameHour / activeOnPrevSameHour) * 100).toFixed(1)
    : (activeOnLatest > 0 ? '∞' : '0');

  const vsSabDeltaSameHour = currentSabCount - prevSabCountSameHour;
  const vsSabPctSameHour = prevSabCountSameHour > 0
    ? ((vsSabDeltaSameHour / prevSabCountSameHour) * 100).toFixed(1)
    : (currentSabCount > 0 ? '∞' : '0');

  const prevAvgPerActiveSameHour = activeOnPrevSameHour > 0 ? (prevSabCountSameHour / activeOnPrevSameHour).toFixed(1) : '0.0';
  const vsSabAvgDeltaSameHour = (parseFloat(avgPerActive) - parseFloat(prevAvgPerActiveSameHour)).toFixed(1);
  const vsSabAvgPctSameHour = parseFloat(prevAvgPerActiveSameHour) > 0
    ? (((parseFloat(avgPerActive) - parseFloat(prevAvgPerActiveSameHour)) / parseFloat(prevAvgPerActiveSameHour)) * 100).toFixed(1)
    : (parseFloat(avgPerActive) > 0 ? '∞' : '0');

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
    prevAvgPerActive,
    vsSabAvgDelta: parseFloat(vsSabAvgDelta),
    vsSabAvgPct,
    // Same hour metrics
    prevSabCountSameHour,
    activeOnPrevSameHour,
    vsSabActiveDeltaSameHour,
    vsSabActivePctSameHour,
    vsSabDeltaSameHour,
    vsSabDeltaSameHourKey: vsSabDeltaSameHour,
    vsSabPctSameHour,
    prevAvgPerActiveSameHour,
    vsSabAvgDeltaSameHour: parseFloat(vsSabAvgDeltaSameHour),
    vsSabAvgPctSameHour,
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
        gridTemplateColumns: 'minmax(180px, 2.2fr) repeat(11, minmax(90px, 1fr))',
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
        <span style={{ color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
          {row.active}
          <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 500 }}>({row.activePct}%)</span>
        </span>
      </div>

      {/* Clientes Inactivos */}
      <div style={dataCellStyle}>
        <span style={{ color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
          {row.inactive}
          <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 500 }}>({row.inactivePct}%)</span>
        </span>
      </div>

      {/* VS SAB ACT SAME HOUR */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabActiveDeltaSameHour > 0 ? '#4ade80' : row.vsSabActiveDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabActiveDeltaSameHour > 0 ? '+' : ''}{row.vsSabActiveDeltaSameHour}
          <span style={{
            fontSize: '0.6rem',
            marginLeft: '2px',
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabActivePctSameHour !== '∞' ? `(${row.vsSabActivePctSameHour}%)` : '(nuevo)'}
          </span>
        </span>
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

      {/* VS SAB RED SAME HOUR */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabDeltaSameHour > 0 ? '#4ade80' : row.vsSabDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabDeltaSameHour > 0 ? '+' : ''}{row.vsSabDeltaSameHour}
          <span style={{
            fontSize: '0.6rem',
            marginLeft: '2px',
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabPctSameHour !== '∞' ? `(${row.vsSabPctSameHour}%)` : '(nuevo)'}
          </span>
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

      {/* VS SAB PROM SAME HOUR */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabAvgDeltaSameHour > 0 ? '#4ade80' : row.vsSabAvgDeltaSameHour < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabAvgDeltaSameHour > 0 ? '+' : ''}{row.vsSabAvgDeltaSameHour}
          <span style={{
            fontSize: '0.6rem',
            marginLeft: '2px',
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabAvgPctSameHour !== '∞' ? `(${row.vsSabAvgPctSameHour}%)` : '(nuevo)'}
          </span>
        </span>
      </div>

      {/* VS SAB PROM */}
      <div style={dataCellStyle}>
        <span style={{
          color: row.vsSabAvgDelta > 0 ? '#4ade80' : row.vsSabAvgDelta < 0 ? '#f87171' : '#9ca3af',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}>
          {row.vsSabAvgDelta > 0 ? '+' : ''}{row.vsSabAvgDelta}
          <span style={{
            fontSize: '0.6rem',
            marginLeft: '2px',
            opacity: 0.8,
            fontWeight: 400,
          }}>
            {row.vsSabAvgPct !== '∞' ? `(${row.vsSabAvgPct}%)` : '(nuevo)'}
          </span>
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
