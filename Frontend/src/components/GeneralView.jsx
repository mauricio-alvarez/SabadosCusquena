import React from 'react';
import { Users, TrendingUp, AlertCircle, TrendingDown } from 'lucide-react';
import MetricCard from './MetricCard';
import { BarChart, DonutChart } from './D3Charts';

const GeneralView = ({ kpis, chartConfig }) => {
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
          <p className="metric-note">{kpis.activeRate}% con actividad</p>
        </div>
        <MetricCard
          title="Promedio Activo"
          value={Number(kpis.avg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          change="Canjes por cliente activo"
          isPositive={null}
          icon={AlertCircle}
        />
        <MetricCard
          title="Bajo Rendimiento"
          value={kpis.lowPerformers.toLocaleString()}
          change={`Q1: ${kpis.q1} canjes · Mediana: ${kpis.median}`}
          isPositive={false}
          icon={TrendingDown}
        />
      </div>

      <div className="grid grid-cols-1 grid-cols-lg-2 gap-6 flex-shrink-0">
        <div className="glass-panel flex flex-col" style={{ padding: '1rem', animationDelay: '0.2s' }}>
          <div className="mb-4 text-center">
            <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Canjes por {chartConfig.barTitle}</h2>
            <p className="text-secondary mt-1 text-sm">Distribución de redenciones</p>
          </div>
          <div style={{ height: '350px', width: '100%' }}>
            {chartConfig.barData.length > 0 ? (
              <BarChart data={chartConfig.barData} />
            ) : (
              <p className="text-secondary text-center py-10">No hay datos para los filtros actuales</p>
            )}
          </div>
        </div>

        <div className="glass-panel flex flex-col" style={{ padding: '1rem', animationDelay: '0.4s' }}>
          <div className="mb-4 text-center">
            <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Participación Top 5 {chartConfig.donutTitle}</h2>
            <p className="text-secondary mt-1 text-sm">Distribución porcentual</p>
          </div>
          <div style={{ height: '350px', width: '100%' }}>
            {chartConfig.donutData.length > 0 ? (
              <DonutChart data={chartConfig.donutData} />
            ) : (
              <p className="text-secondary text-center py-10">No hay datos para los filtros actuales</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralView;
