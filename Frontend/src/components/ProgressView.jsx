import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Users, Zap, Target } from 'lucide-react';
import { DualLineChart, CumulativeChart, LineChart } from './D3Charts';

const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
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

const ProgressView = ({ progressData }) => {
  const [perfLevel, setPerfLevel] = useState('direccion');

  if (!progressData) return null;

  const {
    redemptionsOverTime,
    hourlyComparison,
    cumulativeToday,
    cumulativeLastWeek,
    prediction,
    performance,
    kpiDeltas,
    latest_date,
    last_week_date
  } = progressData;

  const kpi = kpiDeltas || {};

  const renderPerfList = () => {
    const list = performance?.[perfLevel] || [];
    if (list.length === 0) {
      return <p className="text-secondary text-sm text-center py-4">No hay datos de comparación.</p>;
    }

    return (
      <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-3 gap-4 mt-4">
        {list.slice(0, 15).map((item, idx) => {
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
                {item.clientDiff !== undefined && (
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
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-gold font-bold text-2xl mb-1">Monitoreo en Tiempo Real</h2>
          <p className="text-secondary text-sm">
            Comparando: <strong className="text-white">{latest_date}</strong> vs <strong className="text-white">{last_week_date}</strong>
          </p>
        </div>
      </div>

      {/* Hero KPI Row */}
      <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4 mb-6">
        {/* Redemptions Today */}
        <div className="glass-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={20} color="#CFA052" />
            </div>
            <span className="text-secondary text-sm font-semibold">Canjes Hoy</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span className="text-white font-bold" style={{ fontSize: '2rem' }}>{kpi.todayTotal || 0}</span>
            <DeltaBadge value={kpi.redemptionDelta || 0} />
          </div>
          <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>vs {kpi.lastWeekTotal || 0} semana pasada ({kpi.redemptionPct >= 0 ? '+' : ''}{kpi.redemptionPct || 0}%)</p>
        </div>

        {/* Clients Today */}
        <div className="glass-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="#4ade80" />
            </div>
            <span className="text-secondary text-sm font-semibold">Clientes Activos</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span className="text-white font-bold" style={{ fontSize: '2rem' }}>{kpi.newClientsToday || 0}</span>
            <DeltaBadge value={kpi.clientDelta || 0} />
          </div>
          <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>vs {kpi.newClientsLW || 0} semana pasada</p>
        </div>

        {/* Current Rate */}
        <div className="glass-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="#60a5fa" />
            </div>
            <span className="text-secondary text-sm font-semibold">Ritmo Actual</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="text-white font-bold" style={{ fontSize: '2rem' }}>{kpi.currentRate || 0}</span>
            <span className="text-secondary text-sm">canjes/hora</span>
          </div>
          <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>Promedio desde primera actividad</p>
        </div>

        {/* Prediction */}
        <div className="glass-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={20} color="#a855f7" />
            </div>
            <span className="text-secondary text-sm font-semibold">Predicción al Cierre</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="text-white font-bold" style={{ fontSize: '2rem' }}>{prediction?.predictedTotal || '—'}</span>
            <span className="text-secondary text-sm">canjes estimados</span>
          </div>
          <p className="text-xs text-secondary" style={{ marginTop: '4px' }}>
            Confianza: {prediction ? `${(prediction.confidence * 100).toFixed(0)}% (R²)` : 'Sin datos suficientes'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 grid-cols-md-2 gap-4 mb-6">
        {/* Hourly Comparison */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">
            Ritmo por Hora — Hoy vs Semana Pasada
          </h3>
          {hourlyComparison && hourlyComparison.length > 0 ? (
            <div style={{ height: '300px', width: '100%' }}>
              <DualLineChart data={hourlyComparison} predictionLine={prediction?.predictionLine} />
            </div>
          ) : (
            <p className="text-secondary text-center py-10">Sin datos de comparación horaria.</p>
          )}
        </div>

        {/* Cumulative */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">
            Canjes Acumulados — Momentum del Día
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

      {/* Overall Trend */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">Tendencia General de Canjes</h3>
        {redemptionsOverTime && redemptionsOverTime.length > 0 ? (
          <div style={{ height: '300px', width: '100%' }}>
            <LineChart data={redemptionsOverTime} />
          </div>
        ) : (
          <p className="text-secondary text-center py-10">Sin datos de tendencia.</p>
        )}
      </div>

      {/* Top Performers */}
      <div>
        <div className="flex items-center justify-between mb-4 border-b border-opacity-20 border-gold pb-3">
          <h3 className="text-lg font-bold text-gold uppercase tracking-wider">Top Variaciones del Día</h3>
          <select 
            className="filter-select w-auto"
            value={perfLevel}
            onChange={(e) => setPerfLevel(e.target.value)}
          >
            {Object.keys(filterLabels).map(key => (
              <option key={key} value={key}>{filterLabels[key]}</option>
            ))}
          </select>
        </div>
        
        {renderPerfList()}
      </div>
    </div>
  );
};

export default ProgressView;
