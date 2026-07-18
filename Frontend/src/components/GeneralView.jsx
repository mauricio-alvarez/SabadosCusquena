import { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import MetricCard from './MetricCard';
import { SaturdaysStackedBarChart } from './D3Charts';

const formatSigned = (value, decimals = 0) => {
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${number.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

const comparisonText = (delta, percentage, decimals = 0) => (
  `Últimos 2 vs 2 anteriores: ${formatSigned(delta, decimals)} (${formatSigned(percentage, 1)}%)`
);

const directionShortName = (direction) => String(direction || '').replace(/^PE Dir\s+/i, '');

const GeneralView = ({ kpis, allClients, progressData, useAllTimeData, dateRange }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!kpis) return null;

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6">
      <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4 mb-4 flex-shrink-0">
        <div className="glass-panel metric-card general-kpi-card p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="metric-title">Canjes Totales</h3>
            <TrendingUp size={20} className="text-gold" />
          </div>
          <div className="metric-value">{kpis.totalRedemptions.toLocaleString('es-PE')}</div>
          <div className="direction-share-list" aria-label="Participación de canjes por Dirección">
            {kpis.directionShares.map(item => (
              <div className="direction-share-row" key={item.direction} title={item.direction}>
                <span>{directionShortName(item.direction)}</span>
                <div className="direction-share-track" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
                <strong>{item.percentage.toFixed(1)}%</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel metric-card clients-summary-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="metric-title">Clientes</h3>
            <Users size={20} className="text-gold" />
          </div>
          <div className="clients-summary">
            <div>
              <span className="client-count">{kpis.active.toLocaleString()}</span>
              <span className="client-label text-green">Activos · {kpis.activeRate}%</span>
            </div>
            <div>
              <span className="client-count">{kpis.inactive.toLocaleString()}</span>
              <span className="client-label text-red-light">Inactivos · {kpis.inactiveRate}%</span>
            </div>
          </div>
          <p className="metric-note">Activo: al menos 1 canje en cada uno de los últimos 2 sábados.</p>
          <p className={`metric-comparison ${kpis.activeDelta >= 0 ? 'text-green' : 'text-red-light'}`}>
            {comparisonText(kpis.activeDelta, kpis.activeDeltaPct)}
          </p>
        </div>
        <MetricCard
          title="Promedio Activo · 2 sábados"
          value={Number(kpis.avg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          change={comparisonText(kpis.avgDelta, kpis.avgDeltaPct, 2)}
          isPositive={kpis.avgDelta >= 0}
          icon={TrendingUp}
        />
        <MetricCard
          title="Bajo Rendimiento"
          value={`${kpis.lowPerformers.toLocaleString('es-PE')}\u00a0(${kpis.lowPerformerRate}%)`}
          change={`Q1: ${formatSigned(kpis.q1Change, 1)}%`}
          isPositive={false}
          icon={TrendingDown}
        />
      </div>

      <div className="glass-panel flex flex-col general-evolution-panel" style={{ padding: isMobile ? '1rem 0.875rem' : '1.25rem', animationDelay: '0.2s' }}>
        <div className="mb-4 text-center">
          <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Evolución de Canjes por Sábado</h2>
          <p className="text-secondary mt-1 text-sm">Distribución de redenciones y locales activos por Dirección</p>
        </div>
        <div style={{ minHeight: isMobile ? '450px' : '340px', width: '100%', display: 'flex', flexDirection: 'column' }}>
          <SaturdaysStackedBarChart
            allClients={allClients}
            progressData={progressData}
            useAllTimeData={useAllTimeData}
            dateRange={dateRange}
          />
        </div>
      </div>
    </div>
  );
};

export default GeneralView;
