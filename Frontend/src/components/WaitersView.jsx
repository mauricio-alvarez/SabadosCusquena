import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Medal, Award, Crown, Search, Lock, Coins, AlertCircle, Info, HelpCircle, Users, Phone, FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze

const formatMonthDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [m, y] = monthStr.split('/');
  const months = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };
  return `${months[m] || m} ${y}`;
};

const InfoTooltip = ({ content }) => {
  return (
    <span className="info-tooltip-container">
      <HelpCircle size={15} color="#CFA052" style={{ cursor: 'pointer', opacity: 0.8 }} />
      <span className="info-tooltip-popup">
        {content}
      </span>
    </span>
  );
};

const WaitersView = ({ filePath }) => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [rankingsData, setRankingsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRankings = useCallback(async (month) => {
    if (!filePath) {
      setError('No se ha detectado la ruta del archivo de reporte. Por favor, cargue o actualice los datos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('Fetching rankings for file:', filePath, 'and month:', month);
      const response = await fetch(apiUrl('/api/waiter-rankings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, month_year: month || null }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        let msg = 'Error al obtener rankings de meseros';
        if (data && data.detail) {
          if (Array.isArray(data.detail)) {
            msg = data.detail.map(e => `${e.loc?.join('.') || 'error'}: ${e.msg}`).join(', ');
          } else if (typeof data.detail === 'object') {
            msg = JSON.stringify(data.detail);
          } else {
            msg = data.detail;
          }
        }
        throw new Error(msg);
      }
      
      setRankingsData(data);
      if (!month && data.selected_month) {
        setSelectedMonth(data.selected_month);
      }
    } catch (err) {
      console.error('Error fetching waiter rankings:', err);
      setError(err.message || 'Error desconocido al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchRankings(selectedMonth);
  }, [filePath, selectedMonth, fetchRankings]);

  // Handle month selection change
  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const { 
    winners = [], 
    top1 = null, 
    top100 = [], 
    top_clients = [], 
    kpis = {}, 
    available_months = [] 
  } = rankingsData || {};

  const downloadWinnersExcel = () => {
    if (!winners || winners.length === 0) return;
    
    // Map data to match exact columns of ganadores_mozos_premios.xlsx
    const dataToExport = winners.map(w => ({
      'Mesero Nombre': w.mesero_nombre,
      'Mesero Documento': w.mesero_documento || '',
      'Mesero Telefono': w.mesero_telefono || '',
      'Cliente ID': w.cliente_id,
      'Cantidad de Redenciones': w.cantidad_redenciones,
      'Premios': w.premios
    }));

    // Create workbook and sheet
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Premios_Mozos');
    
    // Save as ganadores_mozos_premios.xlsx
    XLSX.writeFile(wb, 'ganadores_mozos_premios.xlsx');
  };


  const isMayo = selectedMonth === '05/2026';

  // Filter top 100 table based on search query (for Mayo)
  const filteredContest2 = useMemo(() => {
    if (!top100) return [];
    if (!searchQuery.trim()) return top100;
    
    const query = searchQuery.toLowerCase();
    return top100.filter(
      item => 
        item.waiter.toLowerCase().includes(query) || 
        item.restaurant_name.toLowerCase().includes(query) ||
        item.client_id.toLowerCase().includes(query)
    );
  }, [top100, searchQuery]);

  // Filter top clients table based on search query (for Mayo)
  const filteredTopClients = useMemo(() => {
    if (!top_clients) return [];
    if (!searchQuery.trim()) return top_clients;
    
    const query = searchQuery.toLowerCase();
    return top_clients.filter(
      item => 
        item.waiter.toLowerCase().includes(query) || 
        item.restaurant_name.toLowerCase().includes(query) ||
        item.client_id.toLowerCase().includes(query)
    );
  }, [top_clients, searchQuery]);

  // Filter consolidated winners table based on search query (for Junio)
  const filteredWinners = useMemo(() => {
    if (!winners) return [];
    if (!searchQuery.trim()) return winners;
    
    const query = searchQuery.toLowerCase();
    return winners.filter(
      item => 
        item.mesero_nombre.toLowerCase().includes(query) || 
        (item.nombre_comercial && item.nombre_comercial.toLowerCase().includes(query)) ||
        item.cliente_id.toLowerCase().includes(query) ||
        item.premios.toLowerCase().includes(query)
    );
  }, [winners, searchQuery]);

  if (loading && !rankingsData) {
    return (
      <div className="glass-panel p-6 flex items-center justify-center gap-4" style={{ borderColor: 'var(--cusquena-gold)' }}>
        <div className="loader"></div>
        <p className="text-gold">Cargando rankings de meseros...</p>
      </div>
    );
  }

  // Render premium prize badge pills
  const renderPrizeBadges = (premiosStr) => {
    if (!premiosStr) return null;
    const parts = premiosStr.split(' + ');
    return (
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {parts.map(p => {
          let bg = 'rgba(255, 255, 255, 0.05)';
          let color = '#ffffff';
          let border = '1px solid rgba(255, 255, 255, 0.15)';
          
          if (p === 'TOP 1') {
            bg = 'rgba(255, 215, 0, 0.1)';
            color = '#FFD700';
            border = '1px solid rgba(255, 215, 0, 0.3)';
          } else if (p === 'TOP 100') {
            bg = 'rgba(192, 192, 192, 0.1)';
            color = '#E5E7EB';
            border = '1px solid rgba(192, 192, 192, 0.3)';
          } else if (p === 'TOP CLIENT') {
            bg = 'rgba(207, 160, 82, 0.1)';
            color = '#CFA052';
            border = '1px solid rgba(207, 160, 82, 0.3)';
          }
          
          return (
            <span 
              key={p} 
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.62rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                background: bg,
                color: color,
                border: border
              }}
            >
              {p}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6 gap-6">
      
      {/* Header Section */}
      <div className="border-b border-gold border-opacity-10 pb-4">
        <h2 className="text-gold font-bold text-2xl mb-1 flex items-center gap-2">
          <Award size={28} color="#CFA052" /> Ranking e Incentivos de Mozos
        </h2>
        <p className="text-secondary text-sm">Control mensual de concursos y premios para meseros de locales participantes</p>
      </div>

      {/* Control Panel Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass-panel" style={{ 
        background: 'rgba(255,255,255,0.02)', 
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: '12px',
        marginTop: '4px',
        marginBottom: '4px'
      }}>
        <div className="flex items-center gap-3">
          <span className="text-secondary text-xs font-bold uppercase tracking-wider">Mes Evaluado:</span>
          <select
            className="filter-select"
            value={selectedMonth}
            onChange={handleMonthChange}
            style={{ 
              width: 'auto', 
              minWidth: '160px', 
              padding: '6px 32px 6px 12px', 
              fontSize: '0.85rem', 
              background: '#100c08', 
              border: '1px solid rgba(207, 160, 82, 0.3)',
              borderRadius: '8px',
              color: '#ffffff'
            }}
          >
            {available_months.map(m => (
              <option key={m} value={m}>{formatMonthDisplay(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <button
            onClick={downloadWinnersExcel}
            className="btn-gold"
            disabled={!winners || winners.length === 0}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 16px', 
              fontSize: '0.8rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              height: '38px',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={15} />
            Descargar Reporte Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-6 animate-fade-in flex items-center gap-4" style={{ borderColor: 'var(--cusquena-red)' }}>
          <AlertCircle className="text-red" size={24} />
          <p className="text-red">{error}</p>
        </div>
      )}

      {/* KPI Validation Metrics Grid */}
      {kpis && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          width: '100%'
        }}>
          {/* Card: Locales Aptos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--cusquena-gold)', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Locales Aptos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">{kpis.eligible_clients || 0}</span>
              <span className="text-secondary text-3xs">Califican con canjes &gt; 50 y ventas &ge; 2 cajas</span>
            </div>
          </div>

          {/* Card: Premios Asignados */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid #4ade80', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Premios Asignados</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">{kpis.final_rows || 0}</span>
              <span className="text-secondary text-3xs">Total de incentivos ganados por los mozos</span>
            </div>
          </div>

          {/* Card: Regla de 3 Mozos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid #38bdf8', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Regla 3 Mozos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">
                {isMayo ? `${kpis.clients_satisfying_rule?.split(' / ')[0] || 0} de ${kpis.eligible_clients || 0}` : `${kpis.eligible_clients || 0} de ${kpis.eligible_clients || 0}`}
              </span>
              <span className="text-secondary text-3xs">Locales con &ge; 3 mozos con más de 20 canjes</span>
            </div>
          </div>

          {/* Card: Locales Excluidos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--cusquena-red)', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Locales Excluidos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-red font-extrabold text-2xl">{(kpis.excl_sales || 0) + (kpis.excl_red || 0)}</span>
              <span className="text-secondary text-3xs" style={{ color: 'rgba(239, 68, 68, 0.8)' }}>
                Falta de ventas: {kpis.excl_sales || 0} | Falta de canjes: {kpis.excl_red || 0}
              </span>
            </div>
          </div>

          {/* Card: Cobertura de Contactos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid #a78bfa', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Cobertura de Contactos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">
                {kpis.final_rows > 0 ? Math.round((kpis.rows_with_documento || 0) / kpis.final_rows * 100) : 0}%
              </span>
              <span className="text-secondary text-3xs">
                Con DNI: {kpis.rows_with_documento || 0} | Con celular: {kpis.rows_with_telefono || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CONDITIONAL RENDER: MAY vs JUNIO */}
      {isMayo ? (
        /* ================= MAYO 2026 LAYOUT (3 Sections) ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          
          {/* Row: Contest 1 & Contest 2 */}
          <div className="waiters-grid">
            
            {/* Section 1: TOP 1 Card (Podium) */}
            <div className="contest-1-col flex flex-col">
              <div className="glass-panel p-6 flex-1 flex flex-col justify-between" style={{
                position: 'relative',
                border: '1px solid rgba(207, 160, 82, 0.4)',
                boxShadow: '0 0 25px rgba(207, 160, 82, 0.1)',
                background: 'linear-gradient(180deg, rgba(20,15,10,0.7) 0%, rgba(10,8,5,0.9) 100%)',
                minHeight: '430px'
              }}>
                <div>
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Crown size={20} color="#FFD700" />
                    </div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center">
                      Concurso 01 - Mejor Mozo Nacional
                      <InfoTooltip content={
                        <div>
                          <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 01: MEJOR MOZO NACIONAL</p>
                          <p className="mb-2">El mesero con mayor número de canjes en el mes a nivel nacional recibe un premio de <strong className="text-white">S/ 1,000</strong>.</p>
                          <div style={{ borderTop: '1px solid rgba(207, 160, 82, 0.2)', paddingTop: '6px', marginTop: '6px' }}>
                            <p className="text-2xs text-secondary"><strong className="text-white">Candado de Calificación:</strong> Solo participan meseros de locales con 50 o más canjes totales en el mes.</p>
                          </div>
                        </div>
                      } />
                    </h3>
                  </div>

                  {top1 ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      {/* Golden Trophy Icon */}
                      <div style={{ display: 'inline-flex', position: 'relative', marginBottom: '16px' }}>
                        <div style={{
                          width: '70px', height: '70px', borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(207,160,82,0.2) 0%, rgba(207,160,82,0.02) 70%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Trophy size={40} color="#FFD700" />
                        </div>
                      </div>

                      <p className="text-gold font-bold text-xs uppercase tracking-widest mb-1">Ganador Absoluto</p>
                      <h4 className="text-white font-bold text-xl mb-2" style={{ textShadow: '0 0 10px rgba(255,255,255,0.15)' }}>
                        {top1.waiter}
                      </h4>

                      <div className="glass-panel p-2.5 mb-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', margin: '0 auto' }}>
                        <p className="text-white text-xs font-semibold truncate" title={top1.restaurant_name}>{top1.restaurant_name}</p>
                        <p className="text-secondary text-2xs mt-0.5">Código: {top1.client_id}</p>
                        {top1.mesero_documento && <p className="text-secondary text-3xs mt-1">DNI: {top1.mesero_documento}</p>}
                        {top1.mesero_telefono && <p className="text-secondary text-3xs">Tel: {top1.mesero_telefono}</p>}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p className="text-gold font-bold" style={{ fontSize: '1.8rem' }}>{top1.redemptions}</p>
                          <p className="text-secondary text-3xs uppercase tracking-wider">Canjes Totales</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                      <Info size={32} style={{ margin: '0 auto 10px' }} />
                      <p className="text-sm">Sin datos para este mes</p>
                    </div>
                  )}
                </div>

                {top1 && (
                  <div style={{
                    background: 'linear-gradient(90deg, rgba(207,160,82,0.15), rgba(207,160,82,0.03))',
                    border: '1px solid rgba(207, 160, 82, 0.3)',
                    borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: '10px'
                  }}>
                    <div className="flex items-center gap-2">
                      <Coins size={16} color="#FFD700" />
                      <span className="text-white text-3xs font-bold uppercase tracking-wider">Incentivo Ganado</span>
                    </div>
                    <span className="text-gold font-extrabold text-md">{top1.prize}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: TOP 100 Table */}
            <div className="contest-2-col flex flex-col">
              <div className="glass-panel p-6 flex-1 flex flex-col" style={{ minHeight: '430px' }}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-gold border-opacity-10" style={{ position: 'relative', zIndex: 10 }}>
                  <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                      <Medal size={20} color="#C0C0C0" /> Concurso 02 - Los Mejores 100 Mozos Nacionales
                      <InfoTooltip content={
                        <div>
                          <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 02: TOP 100 MOZOS</p>
                          <p className="mb-2">El ranking nacional de los 100 meseros con más canjes en el mes. Cada ganador recibe <strong className="text-white">S/ 100</strong>.</p>
                          <div style={{ borderTop: '1px solid rgba(207, 160, 82, 0.2)', paddingTop: '6px', marginTop: '6px' }}>
                            <p className="text-2xs text-secondary"><strong className="text-white">Candado de Calificación:</strong> Solo participan meseros de restaurantes con 50 o más canjes totales en el mes.</p>
                          </div>
                        </div>
                      } />
                    </h3>
                    <p className="text-secondary text-2xs mt-0.5">Ranking completo de meseros del mes (S/ 100 c/u)</p>
                  </div>
                  
                  {/* Search Box */}
                  <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                      <Search size={14} color="#CFA052" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar mozo o local..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="filter-select"
                      style={{
                        width: '100%',
                        paddingLeft: '32px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(207, 160, 82, 0.2)',
                        paddingTop: '4px',
                        paddingBottom: '4px'
                      }}
                    />
                  </div>
                </div>

                {/* Scrollable Table Container */}
                <div style={{ overflowX: 'auto', flex: 1, maxHeight: '310px', position: 'relative' }}>
                  {filteredContest2.length > 0 ? (
                    <table className="pivot-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', width: '50px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Puesto</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Mozo</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Restaurante</th>
                          <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>ID Cliente</th>
                          <th style={{ textAlign: 'center', width: '80px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Canjes</th>
                          <th style={{ textAlign: 'center', width: '90px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Premio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContest2.map((item, idx) => {
                          const rank = item.rank;
                          const isTop3 = rank <= 3;
                          const rowBg = isTop3 
                            ? `rgba(207,160,82,${0.08 - (rank-1)*0.02})` 
                            : (idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent');

                          return (
                            <tr 
                              key={`${item.waiter}-${item.client_id}`}
                              style={{ 
                                background: rowBg,
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                transition: 'background-color 0.15s'
                              }}
                              className="table-row-hover"
                            >
                              <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold' }}>
                                {isTop3 ? (
                                  <div style={{
                                    display: 'inline-flex',
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    background: MEDAL_COLORS[rank-1],
                                    color: '#000',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.65rem'
                                  }}>
                                    {rank}
                                  </div>
                                ) : (
                                  <span className="text-secondary">{rank}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '500', color: isTop3 ? '#fff' : '#e5e7eb' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{item.waiter}</span>
                                  {(item.mesero_documento || item.mesero_telefono) && (
                                    <span className="text-secondary" style={{ fontSize: '0.62rem', fontWeight: 'normal' }}>
                                      {item.mesero_documento && `DNI: ${item.mesero_documento}`}
                                      {item.mesero_documento && item.mesero_telefono && ' | '}
                                      {item.mesero_telefono && `Cel: ${item.mesero_telefono}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px', color: '#9ca3af' }}>
                                {item.restaurant_name}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#6b7280', fontFamily: 'monospace' }}>
                                {item.client_id}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold', color: 'var(--cusquena-gold)' }}>
                                {item.redemptions}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                                  background: 'rgba(207, 160, 82, 0.08)', border: '1px solid rgba(207, 160, 82, 0.2)',
                                  padding: '2px 6px', borderRadius: '6px'
                                }}>
                                  <Coins size={8} color="#FFD700" />
                                  <span className="text-gold font-bold" style={{ fontSize: '0.65rem' }}>{item.prize}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                      <Info size={28} style={{ margin: '0 auto 8px' }} />
                      <p className="text-sm">No se encontraron meseros coincidentes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Section 3: TOP Clients Table (Full Width) */}
          <div className="glass-panel p-6 flex flex-col" style={{ position: 'relative', zIndex: 4 }}>
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(207,160,82,0.2)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} color="#CD7F32" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center">
                  Concurso 03 - Los mejores Mozos por Cliente (TOP CLIENT)
                  <InfoTooltip content={
                    <div>
                      <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 03: TOP CLIENT</p>
                      <p className="mb-2">El mejor mesero (con mayor cantidad de canjes) para cada uno de los locales aptos. Cada ganador recibe un premio de <strong className="text-white">S/ 50</strong>.</p>
                      <div style={{ borderTop: '1px solid rgba(207, 160, 82, 0.2)', paddingTop: '6px', marginTop: '6px' }}>
                        <p className="text-2xs text-secondary"><strong className="text-white">Detalle:</strong> Con 113 clientes aptos, este concurso reparte 113 premios en total.</p>
                      </div>
                    </div>
                  } />
                </h3>
                <p className="text-secondary text-2xs mt-0.5">El mesero con más canjes de cada uno de los locales aptos del mes (S/ 50 c/u)</p>
              </div>
            </div>

            {/* Scrollable Table Container */}
            <div style={{ overflowX: 'auto', maxHeight: '400px', position: 'relative' }}>
              {filteredTopClients.length > 0 ? (
                <table className="pivot-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Mozo Ganador</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Cliente (Restaurante)</th>
                      <th style={{ textAlign: 'center', width: '120px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>ID Cliente</th>
                      <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Canjes Mozo</th>
                      <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Premio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTopClients.map((item, idx) => (
                      <tr 
                        key={`${item.client_id}`}
                        style={{ 
                          background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          transition: 'background-color 0.15s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '8px 10px', fontWeight: '500', color: '#e5e7eb' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{item.waiter}</span>
                            {(item.mesero_documento || item.mesero_telefono) && (
                              <span className="text-secondary" style={{ fontSize: '0.62rem', fontWeight: 'normal' }}>
                                {item.mesero_documento && `DNI: ${item.mesero_documento}`}
                                {item.mesero_documento && item.mesero_telefono && ' | '}
                                {item.mesero_telefono && `Cel: ${item.mesero_telefono}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#9ca3af' }}>
                          {item.restaurant_name}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px', color: '#6b7280', fontFamily: 'monospace' }}>
                          {item.client_id}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold', color: 'var(--cusquena-gold)' }}>
                          {item.redemptions}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            background: 'rgba(207, 160, 82, 0.08)', border: '1px solid rgba(207, 160, 82, 0.2)',
                            padding: '2px 6px', borderRadius: '6px'
                          }}>
                            <Coins size={8} color="#FFD700" />
                            <span className="text-gold font-bold" style={{ fontSize: '0.65rem' }}>{item.prize}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <Info size={28} style={{ margin: '0 auto 8px' }} />
                  <p className="text-sm">No se encontraron ganadores coincidentes</p>
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* ================= JUNIO 2026 LAYOUT (Consolidated Winners Table) ================= */
        <div className="glass-panel p-6 flex flex-col" style={{ width: '100%', minHeight: '450px' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-gold border-opacity-10">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText size={20} color="#CFA052" /> Premios de Mozos - Vista Consolidada de Ganadores (`winners_view`)
                <InfoTooltip content={
                  <div>
                    <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>VISTA CONSOLIDADA DE GANADORES</p>
                    <p className="mb-2">Muestra todas las combinaciones ganadoras de meseros y locales de la campaña, unificando los premios <strong className="text-white">TOP 1</strong>, <strong className="text-white">TOP 100</strong>, y <strong className="text-white">TOP CLIENT</strong>.</p>
                    <div style={{ borderTop: '1px solid rgba(207, 160, 82, 0.2)', paddingTop: '6px', marginTop: '6px' }}>
                      <p className="text-2xs text-secondary"><strong className="text-white">Normativa de Junio:</strong> Aplica el filtro riguroso de que cada local apto debe tener al menos 3 meseros con más de 20 canjes.</p>
                    </div>
                  </div>
                } />
              </h3>
              <p className="text-secondary text-2xs mt-0.5">Premios consolidados por mesero y local apto (Deduplicado por Cliente ID + Mozo Key)</p>
            </div>
            
            {/* Search Box */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="#CFA052" />
              </span>
              <input
                type="text"
                placeholder="Buscar por mesero, ID, local o premio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="filter-select"
                style={{
                  width: '100%',
                  paddingLeft: '32px',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(207, 160, 82, 0.2)',
                  paddingTop: '4px',
                  paddingBottom: '4px'
                }}
              />
            </div>
          </div>

          {/* Scrollable Table Container */}
          <div style={{ overflowX: 'auto', flex: 1, maxHeight: '420px', position: 'relative' }}>
            {filteredWinners.length > 0 ? (
              <table className="pivot-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Mesero Nombre</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Mesero Documento</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Mesero Teléfono</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Cliente ID</th>
                    <th style={{ textAlign: 'center', width: '100px', padding: '10px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Canjes</th>
                    <th style={{ textAlign: 'center', width: '220px', padding: '10px 6px', background: 'rgba(20,15,10,0.95)', borderBottom: '2px solid rgba(207,160,82,0.4)', color: '#CFA052', fontWeight: 'bold' }}>Premios</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWinners.map((item, idx) => (
                    <tr 
                      key={`${item.cliente_id}-${item.mesero_nombre}`}
                      style={{ 
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        transition: 'background-color 0.15s'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#ffffff' }}>
                        {item.mesero_nombre}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', color: item.mesero_documento ? '#e5e7eb' : '#6b7280' }}>
                        {item.mesero_documento || '—'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', color: item.mesero_telefono ? '#e5e7eb' : '#6b7280' }}>
                        {item.mesero_telefono || '—'}
                      </td>
                      <td 
                        style={{ textAlign: 'center', padding: '10px 6px', color: '#CFA052', fontWeight: 'bold', cursor: 'help', fontFamily: 'monospace' }}
                        title={`Nombre Comercial: ${item.nombre_comercial}`}
                      >
                        {item.cliente_id}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 'bold', color: '#4ade80' }}>
                        {item.cantidad_redenciones}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                        {renderPrizeBadges(item.premios)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                <Info size={28} style={{ margin: '0 auto 8px' }} />
                <p className="text-sm">No se encontraron ganadores consolidados coincidentes</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default WaitersView;
