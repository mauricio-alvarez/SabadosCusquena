import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Filter, Menu, BarChart2, TrendingUp, AlertCircle, Trophy, Target } from 'lucide-react';
import { parse, isWithinInterval } from 'date-fns';
import GeneralView from './GeneralView';
import ProgressView from './ProgressView';
import RankingsView from './RankingsView';
import OpportunityView from './OpportunityView';
import DateRangePicker from './DateRangePicker';

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

  const [useAllTimeData, setUseAllTimeData] = useState(true);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

  const [activeView, setActiveView] = useState('general');
  const [showSideMenu, setShowSideMenu] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      if (mobile !== isMobile) {
        setIsMobile(mobile);
        setShowSideMenu(!mobile); // On mobile, close it by default. On desktop, open it.
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

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

    // First apply Date Range Filter to compute valid redemptions
    let clientsWithValidRedemptions = dashboardData.clients;

    if (!useAllTimeData && dateRange?.from && dateRange?.to) {
      clientsWithValidRedemptions = dashboardData.clients.map(c => {
        if (!c.redemption_dates || c.redemption_dates.length === 0) return c;

        let validCount = 0;
        c.redemption_dates.forEach(dateStr => {
          const dateObj = parse(dateStr, 'dd/MM/yyyy', new Date());
          dateObj.setHours(0, 0, 0, 0);

          if (isWithinInterval(dateObj, { start: dateRange.from, end: dateRange.to })) {
            validCount++;
          }
        });

        return { ...c, redemptions: validCount };
      });
    }

    return clientsWithValidRedemptions.filter(c => {
      if (filters.direccion !== 'All' && c.direccion !== filters.direccion) return false;
      if (filters.gerencia !== 'All' && c.gerencia !== filters.gerencia) return false;
      if (filters.supervisor !== 'All' && c.supervisor !== filters.supervisor) return false;
      if (filters.BDR !== 'All' && c.BDR !== filters.BDR) return false;
      return true;
    });
  }, [dashboardData, filters, useAllTimeData, dateRange]);

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

  const renderControls = () => (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        alignItems: isMobile ? 'stretch' : 'center', 
        gap: '12px',
        marginLeft: isMobile ? '0' : 'auto',
        width: isMobile ? '100%' : 'auto',
        justifyContent: 'flex-end',
      }}
    >
      <DateRangePicker
        useAllTimeData={useAllTimeData}
        setUseAllTimeData={setUseAllTimeData}
        dateRange={dateRange}
        setDateRange={setDateRange}
        isMobile={isMobile}
      />
      <button
        onClick={() => setFilters({ direccion: 'All', gerencia: 'All', supervisor: 'All', BDR: 'All' })}
        className="btn-secondary"
        style={{ 
          padding: isMobile ? '10px 14px' : '6px 14px', 
          fontSize: '0.85rem', 
          flexShrink: 0,
          width: isMobile ? '100%' : 'auto'
        }}
      >
        Borrar Filtros
      </button>
    </div>
  );

  return (
    <div className="dashboard-layout">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className={`gemini-sidebar ${!showSideMenu ? 'collapsed' : ''}`}>
          <div className="gemini-sidebar-header">
            <button
              className="btn-secondary flex items-center justify-center"
              onClick={() => setShowSideMenu(!showSideMenu)}
              title="Alternar Menú"
              style={{ padding: '8px', border: 'none', background: 'transparent' }}
            >
              <Menu size={24} color="#e5e7eb" />
            </button>
            <span className="gemini-logo-text text-gold">Cusqueña</span>
          </div>

          <div className="flex flex-col mt-4">
            <button onClick={() => setActiveView('general')} className={`sidebar-btn ${activeView === 'general' ? 'active' : ''}`}>
              <div className="sidebar-btn-icon"><BarChart2 size={20} /></div>
              <span className="sidebar-btn-text">Análisis General</span>
            </button>
            <button onClick={() => setActiveView('progress')} className={`sidebar-btn ${activeView === 'progress' ? 'active' : ''}`}>
              <div className="sidebar-btn-icon"><TrendingUp size={20} /></div>
              <span className="sidebar-btn-text">Progreso en el Tiempo</span>
            </button>
            <button onClick={() => setActiveView('rankings')} className={`sidebar-btn ${activeView === 'rankings' ? 'active' : ''}`}>
              <div className="sidebar-btn-icon"><Trophy size={20} /></div>
              <span className="sidebar-btn-text">Rankings</span>
            </button>
            <button onClick={() => setActiveView('opportunity')} className={`sidebar-btn ${activeView === 'opportunity' ? 'active' : ''}`}>
              <div className="sidebar-btn-icon"><Target size={20} /></div>
              <span className="sidebar-btn-text">Oportunidades</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && showSideMenu && (
        <div className="side-panel-mobile-overlay animate-fade-in" onClick={() => setShowSideMenu(false)}>
          <div className="side-panel-mobile" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col pt-4">
              <h3 className="text-gold font-bold uppercase tracking-wider px-4 mb-4 text-sm">Menú</h3>
              <button onClick={() => { setActiveView('general'); setShowSideMenu(false); }} className={`sidebar-btn ${activeView === 'general' ? 'active' : ''}`}>
                <div className="sidebar-btn-icon"><BarChart2 size={20} /></div>
                <span className="sidebar-btn-text">Análisis General</span>
              </button>
              <button onClick={() => { setActiveView('progress'); setShowSideMenu(false); }} className={`sidebar-btn ${activeView === 'progress' ? 'active' : ''}`}>
                <div className="sidebar-btn-icon"><TrendingUp size={20} /></div>
                <span className="sidebar-btn-text">Progreso en el Tiempo</span>
              </button>
              <button onClick={() => { setActiveView('rankings'); setShowSideMenu(false); }} className={`sidebar-btn ${activeView === 'rankings' ? 'active' : ''}`}>
                <div className="sidebar-btn-icon"><Trophy size={20} /></div>
                <span className="sidebar-btn-text">Rankings</span>
              </button>
              <button onClick={() => { setActiveView('opportunity'); setShowSideMenu(false); }} className={`sidebar-btn ${activeView === 'opportunity' ? 'active' : ''}`}>
                <div className="sidebar-btn-icon"><Target size={20} /></div>
                <span className="sidebar-btn-text">Oportunidades</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content" style={{ overflowY: activeView === 'opportunity' ? 'hidden' : 'auto' }}>
        <header className="dashboard-header flex justify-between items-center flex-wrap gap-4 mb-2 pb-2 border-b border-opacity-20 border-gold flex-shrink-0" style={{ borderBottom: '1px solid rgba(207, 160, 82, 0.2)' }}>
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                className="btn-secondary flex items-center justify-center"
                onClick={() => setShowSideMenu(true)}
                title="Menú"
                style={{ padding: '8px 12px', height: 'fit-content' }}
              >
                <Menu size={20} />
              </button>
            )}
            <div>
              <h1 className="dashboard-title text-2xl">Panel de Campaña en Tiempo Real - Cusqueña</h1>
              <p className="text-secondary mt-1 text-sm">
                {lastReport ? `Última actualización: ${lastReport.updated_at_display}` : 'Cargando último reporte...'}
              </p>
            </div>
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
          <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full">
            {activeView === 'general' && (
              <div className="glass-panel p-4 mb-4 flex-shrink-0" style={{ position: 'relative', zIndex: 100 }}>
                {/* Header row containing title and mobile toggle button */}
                <div 
                  style={{ 
                    borderBottom: (!isMobile || showFiltersMobile) ? '1px solid var(--glass-border)' : 'none',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: (!isMobile || showFiltersMobile) ? '12px' : '0px',
                    marginBottom: (!isMobile || showFiltersMobile) ? '12px' : '0px'
                  }}
                >
                  <div 
                    className="flex items-center justify-between select-none" 
                    onClick={() => isMobile && setShowFiltersMobile(prev => !prev)}
                    style={{ width: isMobile ? '100%' : 'auto', cursor: isMobile ? 'pointer' : 'default' }}
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="text-gold" size={20} />
                      <h3 className="text-gold font-bold text-lg">Filtros Activos</h3>
                    </div>
                    {isMobile && (
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                      >
                        {showFiltersMobile ? 'Ocultar' : 'Mostrar'}
                      </button>
                    )}
                  </div>
                  
                  {/* On Desktop, render controls in the header row on the right */}
                  {!isMobile && renderControls()}
                </div>

                {/* Filters Content (Date range, reset button, and select filters) */}
                {(!isMobile || showFiltersMobile) && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    {/* On Mobile, render controls inside the collapsible area */}
                    {isMobile && renderControls()}

                    {/* Dropdown Filters Grid */}
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
                )}
              </div>
            )}

            {activeView === 'general' && (
              <GeneralView kpis={kpis} chartConfig={chartConfig} />
            )}
            {activeView === 'progress' && (
              <ProgressView
                progressData={dashboardData.progress_data}
                filePath={lastReport?.file_path}
              />
            )}
            {activeView === 'rankings' && (
              <RankingsView allClients={dashboardData.clients} />
            )}
            {activeView === 'opportunity' && (
              <OpportunityView allClients={dashboardData.clients} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
