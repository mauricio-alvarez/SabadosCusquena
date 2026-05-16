import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, AlertCircle, TrendingDown, RefreshCcw, Filter } from 'lucide-react';
import MetricCard from './MetricCard';
import { BarChart, DonutChart } from './D3Charts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
};

const Dashboard = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [lastReport, setLastReport] = useState(null);

  const [filters, setFilters] = useState({
    direccion: 'All',
    gerencia: 'All',
    supervisor: 'All',
    BDR: 'All',
  });

  const fetchDashboardData = useCallback(async (report) => {
    const filePath = typeof report === 'string' ? report : report.file_path;
    setLoadingData(true);

    try {
      const response = await fetch(apiUrl('/api/dashboard-data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to fetch dashboard data');
      setDashboardData(data);

      if (typeof report !== 'string') {
        setLastReport(report);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadLatestReport = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/latest-report'));
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'No recent report found');
      await fetchDashboardData(data);
    } catch (err) {
      setError(err.message);
      setLoadingData(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLatestReport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLatestReport]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/refresh-report'), {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to refresh report');
      await fetchDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getFilterOptions = (filterKey) => {
    if (!dashboardData) return [];
    const validClients = dashboardData.clients.filter(c => {
      let keep = true;
      ['direccion', 'gerencia', 'supervisor', 'BDR'].forEach(k => {
        if (k !== filterKey && filters[k] !== 'All' && c[k] !== filters[k]) {
          keep = false;
        }
      });
      return keep;
    });
    return Array.from(new Set(validClients.map(c => c[filterKey]).filter(v => v !== null && v !== 'N/A'))).sort();
  };

  const filteredClients = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.clients.filter(c => {
      if (filters.direccion !== 'All' && c.direccion !== filters.direccion) return false;
      if (filters.gerencia !== 'All' && c.gerencia !== filters.gerencia) return false;
      if (filters.supervisor !== 'All' && c.supervisor !== filters.supervisor) return false;
      if (filters.BDR !== 'All' && c.BDR !== filters.BDR) return false;
      return true;
    });
  }, [dashboardData, filters]);

  const kpis = useMemo(() => {
    if (filteredClients.length === 0) return null;

    const total = filteredClients.length;
    const active = filteredClients.filter(c => c.redemptions > 0);
    const totalRedemptions = filteredClients.reduce((acc, c) => acc + c.redemptions, 0);
    const avg = active.length > 0 ? (totalRedemptions / active.length).toFixed(2) : 0;

    const sortedReds = active.map(c => c.redemptions).sort((a, b) => a - b);
    let median = 0;
    let q1 = 0;
    let lowPerformers = 0;

    if (sortedReds.length > 0) {
      const mid = Math.floor(sortedReds.length / 2);
      median = sortedReds.length % 2 !== 0 ? sortedReds[mid] : (sortedReds[mid - 1] + sortedReds[mid]) / 2;

      const q1Idx = Math.floor(sortedReds.length * 0.25);
      q1 = sortedReds[q1Idx];
      lowPerformers = active.filter(c => c.redemptions <= q1).length;
    }

    return {
      total,
      active: active.length,
      inactive: total - active.length,
      totalRedemptions,
      avg,
      median,
      q1,
      activeRate: total > 0 ? ((active.length / total) * 100).toFixed(1) : '0.0',
      lowPerformers,
    };
  }, [filteredClients]);
  
  const getAdjustedTime = () => {
    const date = new Date();
    date.setHours(date.getHours() - 5);
    
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  const chartConfig = useMemo(() => {
    let barKey = 'direccion';
    let donutKey = 'gerencia';
    let barTitle = 'Dirección';
    let donutTitle = 'Gerencias';

    if (filters.BDR !== 'All') {
      barKey = 'nombre_comercial'; donutKey = 'nombre_comercial';
      barTitle = 'Cliente'; donutTitle = 'Clientes';
    } else if (filters.supervisor !== 'All') {
      barKey = 'BDR'; donutKey = 'nombre_comercial';
      barTitle = 'BDR'; donutTitle = 'Clientes';
    } else if (filters.gerencia !== 'All') {
      barKey = 'supervisor'; donutKey = 'BDR';
      barTitle = 'Supervisor'; donutTitle = 'BDRs';
    } else if (filters.direccion !== 'All') {
      barKey = 'gerencia'; donutKey = 'supervisor';
      barTitle = 'Gerencia'; donutTitle = 'Supervisores';
    }

    if (filteredClients.length === 0) {
      return { barData: [], donutData: [], barTitle, donutTitle };
    }

    const barMap = {};
    const donutMap = {};

    filteredClients.forEach(c => {
      if (c.redemptions > 0) {
        barMap[c[barKey]] = (barMap[c[barKey]] || 0) + c.redemptions;
        donutMap[c[donutKey]] = (donutMap[c[donutKey]] || 0) + c.redemptions;
      }
    });

    const barData = Object.keys(barMap)
      .map(k => ({ region: k, value: barMap[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    const donutData = Object.keys(donutMap)
      .map(k => ({ department: k, value: donutMap[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { barData, donutData, barTitle, donutTitle };
  }, [filteredClients, filters]);

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header flex justify-between items-center flex-wrap gap-4 mb-2 pb-2 border-b border-opacity-20 border-gold flex-shrink-0" style={{ borderBottom: '1px solid rgba(207, 160, 82, 0.2)' }}>
        <div>
          <h1 className="dashboard-title text-2xl">Panel de Campaña en Tiempo Real - Cusqueña</h1>
          <p className="text-secondary mt-1 text-sm">
            {lastReport ? `Última actualización: ${getAdjustedTime()}` : 'Cargando último reporte...'}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            className="btn-gold"
            onClick={handleRefresh}
            disabled={refreshing || loadingData}
            title="Usa un reporte reciente si tiene menos de 20 minutos; si no, descarga uno nuevo."
          >
            {refreshing ? (
              <>
                <div className="loader"></div>
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCcw size={20} />
                Actualizar Datos
              </>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="glass-panel p-6 mb-6 animate-fade-in flex items-center gap-4" style={{ borderColor: 'var(--cusquena-red)' }}>
          <AlertCircle className="text-red" size={24} />
          <p className="text-red">{error}</p>
        </div>
      )}

      {loadingData && (
        <div className="glass-panel p-6 mb-6 animate-fade-in flex items-center gap-4 justify-center" style={{ borderColor: 'var(--cusquena-gold)' }}>
          <div className="loader"></div>
          <p className="text-gold">{dashboardData ? 'Actualizando vista...' : 'Cargando último reporte...'}</p>
        </div>
      )}

      {dashboardData && kpis && (
        <div className="animate-fade-in flex flex-col flex-1 min-h-0">
          <div className="glass-panel p-4 mb-4 flex-shrink-0">
            <div className="flex items-center gap-4 mb-3 pb-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2">
                <Filter className="text-gold" size={20} />
                <h3 className="text-gold font-bold text-lg">Filtros Activos</h3>
              </div>
              <button
                onClick={() => setFilters({ direccion: 'All', gerencia: 'All', supervisor: 'All', BDR: 'All' })}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              >
                Borrar Filtros
              </button>
            </div>
            <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4">
              {['direccion', 'gerencia', 'supervisor', 'BDR'].map(f => (
                <div key={f} className="flex flex-col gap-2">
                  <label className="text-secondary text-sm font-semibold">{filterLabels[f]}</label>
                  <select
                    className="filter-select"
                    value={filters[f]}
                    onChange={(e) => handleFilterChange(f, e.target.value)}
                  >
                    <option value="All">Todos</option>
                    {getFilterOptions(f).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4 mb-4 flex-shrink-0">
            <MetricCard
              title="Canjes Totales"
              value={kpis.totalRedemptions.toLocaleString()}
              change="Redenciones registradas en el reporte"
              isPositive={null}
              icon={TrendingUp}
            />
            <div className="glass-panel metric-card clients-summary-card p-6 animate-fade-in">
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

          <div className="grid grid-cols-1 grid-cols-lg-2 gap-6 flex-1 min-h-0">
            <div className="glass-panel flex flex-col h-full" style={{ padding: '1rem', animationDelay: '0.2s' }}>
              <div className="mb-4 text-center">
                <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Canjes por {chartConfig.barTitle}</h2>
                <p className="text-secondary mt-1 text-sm">Distribución de redenciones</p>
              </div>
              <div className="flex-1 w-full min-h-0">
                {chartConfig.barData.length > 0 ? (
                  <BarChart data={chartConfig.barData} />
                ) : (
                  <p className="text-secondary text-center py-10">No hay datos para los filtros actuales</p>
                )}
              </div>
            </div>

            <div className="glass-panel flex flex-col h-full" style={{ padding: '1rem', animationDelay: '0.4s' }}>
              <div className="mb-4 text-center">
                <h2 className="text-gold font-bold" style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}>Participación Top 5 {chartConfig.donutTitle}</h2>
                <p className="text-secondary mt-1 text-sm">Distribución porcentual</p>
              </div>
              <div className="flex-1 w-full min-h-0">
                {chartConfig.donutData.length > 0 ? (
                  <DonutChart data={chartConfig.donutData} />
                ) : (
                  <p className="text-secondary text-center py-10">No hay datos para los filtros actuales</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
