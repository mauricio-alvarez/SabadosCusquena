import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Medal, Award, Crown, Search, Lock, Coins, AlertCircle, Info, HelpCircle } from 'lucide-react';

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

  // Filter top 100 table based on search query
  const filteredContest2 = useMemo(() => {
    if (!rankingsData?.contest2) return [];
    if (!searchQuery.trim()) return rankingsData.contest2;
    
    const query = searchQuery.toLowerCase();
    return rankingsData.contest2.filter(
      item => 
        item.waiter.toLowerCase().includes(query) || 
        item.restaurant_name.toLowerCase().includes(query) ||
        item.client_id.toLowerCase().includes(query)
    );
  }, [rankingsData, searchQuery]);

  if (loading && !rankingsData) {
    return (
      <div className="glass-panel p-6 flex items-center justify-center gap-4" style={{ borderColor: 'var(--cusquena-gold)' }}>
        <div className="loader"></div>
        <p className="text-gold">Cargando rankings de meseros...</p>
      </div>
    );
  }

  const { contest1, contest2 = [], contest3 = [], available_months = [] } = rankingsData || {};

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6 gap-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gold border-opacity-10 pb-4">
        <div>
          <h2 className="text-gold font-bold text-2xl mb-1 flex items-center gap-2">
            <Award size={28} color="#CFA052" /> Ranking e Incentivos de Mozos
          </h2>
          <p className="text-secondary text-sm">Control mensual de concursos y premios para meseros de locales participantes</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-secondary text-xs font-semibold whitespace-nowrap">Mes Evaluado:</label>
          <select
            className="filter-select"
            value={selectedMonth}
            onChange={handleMonthChange}
            style={{ width: 'auto', padding: '6px 32px 6px 12px', fontSize: '0.85rem' }}
          >
            {available_months.map(m => (
              <option key={m} value={m}>{formatMonthDisplay(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-6 animate-fade-in flex items-center gap-4" style={{ borderColor: 'var(--cusquena-red)' }}>
          <AlertCircle className="text-red" size={24} />
          <p className="text-red">{error}</p>
        </div>
      )}
      {/* Row: Contest 1 & Contest 2 */}
      <div className="waiters-grid">
        
        {/* Contest 1 Card - Podium (4 cols on large screen) */}
        <div className="contest-1-col flex flex-col">
          <div className="glass-panel p-6 flex-1 flex flex-col justify-between" style={{
            position: 'relative',
            border: '1px solid rgba(207, 160, 82, 0.4)',
            boxShadow: '0 0 25px rgba(207, 160, 82, 0.1)',
            background: 'linear-gradient(180deg, rgba(20,15,10,0.7) 0%, rgba(10,8,5,0.9) 100%)',
            minHeight: '450px'
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

              {contest1 ? (
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
                    {contest1.waiter}
                  </h4>

                  <div className="glass-panel p-2.5 mb-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', margin: '0 auto' }}>
                    <p className="text-white text-xs font-semibold truncate" title={contest1.restaurant_name}>{contest1.restaurant_name}</p>
                    <p className="text-secondary text-2xs mt-0.5">Código: {contest1.client_id}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p className="text-gold font-bold" style={{ fontSize: '1.8rem' }}>{contest1.redemptions}</p>
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

            {contest1 && (
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
                <span className="text-gold font-extrabold text-md">{contest1.prize}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contest 2 Card - Top 100 (8 cols on large screen) */}
        <div className="contest-2-col flex flex-col">
          <div className="glass-panel p-6 flex-1 flex flex-col" style={{ minHeight: '450px' }}>
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
            <div style={{ overflowX: 'auto', flex: 1, maxHeight: '330px', position: 'relative' }}>
              {filteredContest2.length > 0 ? (
                <table className="pivot-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
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
                                fontSize: '0.7rem'
                              }}>
                                {rank}
                              </div>
                            ) : (
                              <span className="text-secondary">{rank}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: '500', color: isTop3 ? '#fff' : '#e5e7eb' }}>
                            {item.waiter}
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

      {/* Contest 3 Card (Full Width at the bottom) */}
      <div className="glass-panel p-6 flex flex-col" style={{ position: 'relative', zIndex: 4 }}>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(207,160,82,0.2)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={20} color="#CFA052" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center">
              Concurso 03 - Mejores Mozos de los Top 10 Locales
              <InfoTooltip content={
                <div>
                  <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 03: TOP LOCALES</p>
                  <p className="mb-2">Se seleccionan los 10 restaurantes con mayor volumen de canjes en el mes. En cada uno de estos 10 locales, su mejor mesero (con más canjes) recibe <strong className="text-white">S/ 50</strong> (10 ganadores totales).</p>
                  <div style={{ borderTop: '1px solid rgba(207, 160, 82, 0.2)', paddingTop: '6px', marginTop: '6px' }}>
                    <p className="text-2xs text-secondary"><strong className="text-white">Nota:</strong> Para este concurso no aplica el candado mínimo de 50 canjes (se eligen los 10 mejores locales absolutos).</p>
                  </div>
                </div>
              } />
            </h3>
            <p className="text-secondary text-2xs mt-0.5">Un ganador (S/ 50) por cada uno de los 10 mejores locales por canjes en el mes</p>
          </div>
        </div>

        {/* 10 Winners Grid */}
        <div className="waiters-contest3-grid">
          {contest3.length > 0 ? (
            contest3.map((winner, idx) => (
              <div
                key={winner.client_id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.2s',
                  gap: '8px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(207,160,82,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(207,160,82,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: idx === 0 ? MEDAL_COLORS[0] : (idx === 1 ? MEDAL_COLORS[1] : (idx === 2 ? MEDAL_COLORS[2] : 'rgba(255,255,255,0.08)')),
                    color: idx < 3 ? '#000' : '#e5e7eb',
                    fontWeight: 'bold', fontSize: '0.7rem', flexShrink: 0
                  }}>
                    {winner.restaurant_rank}
                  </div>
                  <span className="text-white text-xs font-semibold block truncate" title={winner.restaurant_name} style={{ flex: 1 }}>
                    {winner.restaurant_name}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                  <p className="text-secondary text-3xs font-medium uppercase tracking-wider">Mozo Ganador</p>
                  <p className="text-white text-xs font-bold truncate mt-0.5" title={winner.waiter}>
                    {winner.waiter}
                  </p>
                  {winner.waiter !== 'Sin mesero registrado' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span className="text-secondary text-3xs">
                        {winner.waiter_redemptions} canjes
                      </span>
                      <span className="text-secondary text-3xs">
                        (Total: {winner.restaurant_redemptions})
                      </span>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  background: 'rgba(207, 160, 82, 0.08)', border: '1px solid rgba(207, 160, 82, 0.2)',
                  padding: '4px', borderRadius: '6px', marginTop: '4px'
                }}>
                  <Coins size={12} color="#FFD700" />
                  <span className="text-gold font-bold text-2xs">{winner.prize}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: 'span 5', textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
              <Info size={32} style={{ margin: '0 auto 10px' }} />
              <p className="text-sm">Sin datos de ganadores</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitersView;

