import { useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Users, Zap, Calendar, Download } from 'lucide-react';
import { DualLineChart, CumulativeChart } from './D3Charts';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
  cliente: 'Clientes',
};

const DeltaBadge = ({ value, suffix = '' }) => {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? '#4ade80' : isNegative ? '#f87171' : '#9ca3af';
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
      <Icon size={16} />
      {isPositive ? '+' : ''}{value}{suffix}
    </span>
  );
};

const ProgressView = ({ progressData, filePath }) => {
  const [perfLevel, setPerfLevel] = useState('direccion');
  const [loading, setLoading] = useState(false);
  const [compData, setCompData] = useState(null);

  if (!progressData) return null;

  const { available_dates } = progressData;

  // Use compData if user changed dates, otherwise use initial progressData
  const activeData = compData || progressData;
  const {
    hourlyComparison,
    cumulativeToday,
    cumulativeLastWeek,
    performance,
    kpiDeltas,
    latest_date,
    last_week_date
  } = activeData;

  const kpi = kpiDeltas || {};

  const [dateA, setDateA] = useState(latest_date || '');
  const [dateB, setDateB] = useState(last_week_date || '');

  // Short date format for labels (DD/MM)
  const shortDate = (d) => d ? d.substring(0, 5) : '—';

  const handleCompare = useCallback(async () => {
    if (!dateA || !dateB || !filePath) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/compare-dates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, date_a: dateA, date_b: dateB }),
      });
      const data = await response.json();
      if (response.ok) {
        setCompData(data);
      }
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setLoading(false);
    }
  }, [dateA, dateB, filePath]);

  const handleDownload = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const dateAShort = shortDate(latest_date);
    const dateBShort = shortDate(last_week_date);

    for (const level of Object.keys(filterLabels)) {
      const list = performance?.[level] || [];
      if (list.length === 0) continue;

      const isClientLevel = level === 'cliente';
      const rows = list.map(item => {
        const row = {
          [filterLabels[level]]: item.name,
          [`Fecha A (${dateAShort}) Redenciones`]: item.current,
          [`Fecha B (${dateBShort}) Redenciones`]: item.previous,
          'Varianza Absoluta': item.diff,
          'Varianza %': item.previous > 0 ? item.pctChange : '',
        };
        if (!isClientLevel) {
          row[`Fecha A (${dateAShort}) Clientes Redimiendo`] = item.currentClients ?? '';
          row[`Fecha B (${dateBShort}) Clientes Redimiendo`] = item.previousClients ?? '';
          row['Varianza Clientes Abs.'] = item.clientDiff ?? '';
          row['Varianza Clientes %'] = (item.previousClients && item.previousClients > 0)
            ? parseFloat(((item.clientDiff / item.previousClients) * 100).toFixed(1))
            : '';
        }
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), filterLabels[level]);
    }

    XLSX.writeFile(wb, `Comparacion_${shortDate(latest_date)}_vs_${shortDate(last_week_date)}.xlsx`);
  }, [performance, latest_date, last_week_date]);

  const renderPerfList = () => {
    const list = performance?.[perfLevel] || [];
    if (list.length === 0) {
      return <p className="text-secondary text-sm text-center py-4">No hay datos de comparación.</p>;
    }

    const isClientLevel = perfLevel === 'cliente';

    return (
      <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-3 gap-4 mt-4">
        {list.map((item, idx) => {
          const isPositive = item.diff > 0;
          const isNegative = item.diff < 0;

          return (
            <div key={idx} className="glass-panel p-4 transition-all" style={{ borderLeft: `3px solid ${isPositive ? '#4ade80' : isNegative ? '#f87171' : '#6b7280'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p className="text-sm font-semibold text-white" style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</p>
                <DeltaBadge value={item.diff} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="text-xs text-secondary">Canjes: <span className="text-white">{item.current}</span> <span className="text-secondary">vs {item.previous}</span></p>
                  {item.pctChange !== undefined && (
                    <p className="text-xs" style={{ color: item.pctChange >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>
                      {item.pctChange >= 0 ? '+' : ''}{item.pctChange}%
                    </p>
                  )}
                </div>
                {!isClientLevel && item.clientDiff !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <p className="text-xs text-secondary">Clientes: <span className="text-white">{item.currentClients}</span></p>
                    <p className="text-xs" style={{ color: item.clientDiff >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>
                      {item.clientDiff >= 0 ? '+' : ''}{item.clientDiff} nuevos
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6">
      {/* Header + Date Pickers */}
      <div className="glass-panel p-4 mb-6 flex-shrink-0" style={{ position: 'relative', zIndex: 100 }}>
        <div className="flex items-center gap-4 mb-3 pb-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-2">
            <Calendar className="text-gold" size={20} />
            <h3 className="text-gold font-bold text-lg">Comparación de Fechas</h3>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-2" style={{ minWidth: '180px' }}>
            <label className="text-secondary text-sm font-semibold">Fecha A (principal)</label>
            <select
              className="filter-select"
              value={dateA}
              onChange={(e) => setDateA(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {(available_dates || []).slice().reverse().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: '180px' }}>
            <label className="text-secondary text-sm font-semibold">Fecha B (comparar contra)</label>
            <select
              className="filter-select"
              value={dateB}
              onChange={(e) => setDateB(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {(available_dates || []).slice().reverse().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: '120px', justifyContent: 'flex-end' }}>
            <label className="text-secondary text-sm font-semibold">&nbsp;</label>
            <button
              className="btn-gold"
              onClick={handleCompare}
              disabled={loading || !dateA || !dateB}
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
            >
              {loading ? (
                <><div className="loader"></div> Comparando...</>
              ) : (
                'Comparar'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hero KPI Row */}
      <div className="grid grid-cols-1 grid-cols-md-3 gap-4 mb-6">
        {/* Redemptions */}
        <div className="glass-panel p-5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <BarChart2 size={24} color="#CFA052" />
          </div>
          <span className="text-secondary text-sm font-semibold" style={{ marginBottom: '10px' }}>Canjes</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '8px' }}>
            <div>
              <p className="text-xs text-secondary" style={{ marginBottom: '2px' }}>Fecha A</p>
              <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>{kpi.todayTotal || 0}</span>
            </div>
            <span className="text-secondary" style={{ fontSize: '1.5rem', fontWeight: 300 }}>vs</span>
            <div>
              <p className="text-xs text-secondary" style={{ marginBottom: '2px' }}>Fecha B</p>
              <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>{kpi.lastWeekTotal || 0}</span>
            </div>
          </div>
          <p className="font-bold" style={{ fontSize: '1rem', color: kpi.redemptionPct >= 0 ? '#4ade80' : '#f87171' }}>
            {kpi.redemptionPct >= 0 ? '+' : ''}{kpi.redemptionPct || 0}%
          </p>
        </div>

        {/* Clients */}
        <div className="glass-panel p-5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Users size={24} color="#4ade80" />
          </div>
          <span className="text-secondary text-sm font-semibold" style={{ marginBottom: '10px' }}>Clientes Activos</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '8px' }}>
            <div>
              <p className="text-xs text-secondary" style={{ marginBottom: '2px' }}>Fecha A</p>
              <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>{kpi.newClientsToday || 0}</span>
            </div>
            <span className="text-secondary" style={{ fontSize: '1.5rem', fontWeight: 300 }}>vs</span>
            <div>
              <p className="text-xs text-secondary" style={{ marginBottom: '2px' }}>Fecha B</p>
              <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>{kpi.newClientsLW || 0}</span>
            </div>
          </div>
          {(() => {
            const pct = kpi.newClientsLW > 0 ? parseFloat(((kpi.clientDelta / kpi.newClientsLW) * 100).toFixed(1)) : 0;
            return (
              <p className="font-bold" style={{ fontSize: '1rem', color: pct >= 0 ? '#4ade80' : '#f87171' }}>
                {pct >= 0 ? '+' : ''}{pct}%
              </p>
            );
          })()}
        </div>

        {/* Current Rate */}
        <div className="glass-panel p-5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Zap size={24} color="#60a5fa" />
          </div>
          <span className="text-secondary text-sm font-semibold" style={{ marginBottom: '10px' }}>Ritmo Fecha A</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
            <span className="text-white font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>{kpi.currentRate || 0}</span>
            <span className="text-secondary text-sm">canjes/hora</span>
          </div>
          <p className="text-xs text-secondary">Promedio desde primera actividad</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 grid-cols-md-2 gap-4 mb-6">
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">
            Ritmo por Hora — {shortDate(latest_date)} vs {shortDate(last_week_date)}
          </h3>
          {hourlyComparison && hourlyComparison.length > 0 ? (
            <div style={{ height: '300px', width: '100%' }}>
              <DualLineChart data={hourlyComparison} />
            </div>
          ) : (
            <p className="text-secondary text-center py-10">Sin datos de comparación horaria.</p>
          )}
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">
            Canjes Acumulados — {shortDate(latest_date)} vs {shortDate(last_week_date)}
          </h3>
          {cumulativeToday && cumulativeToday.length > 0 ? (
            <div style={{ height: '300px', width: '100%' }}>
              <CumulativeChart todayData={cumulativeToday} lastWeekData={cumulativeLastWeek} />
            </div>
          ) : (
            <p className="text-secondary text-center py-10">Sin datos acumulados.</p>
          )}
        </div>
      </div>

      {/* Variance List */}
      <div>
        <div className="flex items-center justify-start mb-4 border-b border-opacity-20 border-gold pb-3" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="text-lg font-bold text-gold uppercase tracking-wider">Variaciones por Fecha</h3>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            {Object.keys(filterLabels).map(key => (
              <button
                key={key}
                onClick={() => setPerfLevel(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: perfLevel === key ? 'var(--cusquena-gold)' : 'rgba(255,255,255,0.08)',
                  color: perfLevel === key ? '#000' : '#ccc',
                }}
              >
                {filterLabels[key]}
              </button>
            ))}
            <button
              className="btn-gold"
              onClick={handleDownload}
              style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              Exportar
            </button>
          </div>
        </div>

        {renderPerfList()}
      </div>
    </div>
  );
};

export default ProgressView;
