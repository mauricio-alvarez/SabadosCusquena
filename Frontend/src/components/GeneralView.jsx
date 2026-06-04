import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, TrendingDown } from 'lucide-react';
import MetricCard from './MetricCard';
import { SaturdaysStackedBarChart } from './D3Charts';

const GeneralView = ({ kpis, chartConfig, allClients, progressData, useAllTimeData, dateRange }) => {
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
        <MetricCard
          title="Canjes Totales"
          value={kpis.totalRedemptions.toLocaleString()}
          change="Redenciones registradas en el reporte"
          isPositive={null}
          icon={TrendingUp}
        />
        <div className="glass-panel metric-card clients-summary-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="metric-title">Clientes</h3>
            <Users size={20} className="text-gold" />
          </div>
          <div className="clients-summary">
            <div>
              <span className="client-count">{kpis.active.toLocaleString()}</span>
              <span className="client-label text-green">Activos</span>
            </div>
            <div>
              <span className="client-count">{kpis.inactive.toLocaleString()}</span>
              <span className="client-label text-red-light">Inactivos</span>
            </div>
          </div>
          <p className="metric-note ">{kpis.activeRate}% han redimido al menos una vez</p>
        </div>
        <MetricCard
          title="Promedio Activo"
          value={Number(kpis.avg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          change="Redenciones por cliente activo"
          isPositive={null}
          icon={AlertCircle}
        />
        <MetricCard
          title="Bajo Rendimiento"
          value={kpis.lowPerformers.toLocaleString()}
          change={`Clientes han redimido menos de ${kpis.q1} unidades`}
          isPositive={false}
          icon={TrendingDown}
        />
      </div>

      <div className="glass-panel flex flex-col" style={{ padding: '1.25rem', animationDelay: '0.2s' }}>
        <div className="mb-4 text-center">
          <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Evolución de Canjes por Sábado</h2>
          <p className="text-secondary mt-1 text-sm">Distribución de redenciones y locales activos por Dirección</p>
        </div>
        <div style={{ minHeight: '340px', width: '100%', display: 'flex', flexDirection: 'column' }}>
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
