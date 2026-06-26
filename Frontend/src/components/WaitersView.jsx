import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Medal, Award, Crown, Search, Lock, Coins, AlertCircle, Info, HelpCircle, Users, Phone, FileText, Download, CheckCircle, XCircle, Beer, Calendar, ShoppingCart } from 'lucide-react';
import * as XLSX from 'xlsx';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const MEDAL_COLORS = ['var(--warning)', 'var(--text-secondary)', 'var(--cusquena-gold-dark)'];
const PRIZE_BADGE_STYLES = {
  default: {
    background: 'var(--subtle-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)'
  },
  'TOP 1': {
    background: 'var(--warning-soft)',
    color: 'var(--warning)',
    border: '1px solid var(--glass-border)'
  },
  'TOP 100': {
    background: 'var(--info-soft)',
    color: 'var(--info)',
    border: '1px solid var(--glass-border)'
  },
  'TOP CLIENT': {
    background: 'var(--accent-purple-soft)',
    color: 'var(--accent-purple)',
    border: '1px solid var(--glass-border)'
  }
};

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
      <HelpCircle size={15} color="var(--cusquena-gold)" style={{ cursor: 'pointer', opacity: 0.8 }} />
      <span className="info-tooltip-popup">
        {content}
      </span>
    </span>
  );
};

const formatPct = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const DownloadMiniButton = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '7px',
      border: '1px solid var(--glass-border)',
      background: disabled ? 'var(--subtle-surface)' : 'var(--surface-raised)',
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
      borderRadius: '8px',
      padding: '8px 11px',
      fontSize: '0.76rem',
      fontWeight: 650,
      cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    <Download size={14} />
    {children}
  </button>
);

const ProgressLine = ({ value, tone = 'var(--success)' }) => (
  <div style={{
    height: '8px',
    width: '100%',
    background: 'var(--surface-muted)',
    borderRadius: '999px',
    overflow: 'hidden',
    marginTop: '10px',
  }}>
    <div style={{
      width: `${Math.max(0, Math.min(100, value))}%`,
      height: '100%',
      background: tone,
      borderRadius: '999px',
    }} />
  </div>
);

const EligibilityHeroCard = ({ type, title, count, total, detail, icon: Icon, onDownload, disabled }) => {
  const isPositive = type === 'positive';
  const accent = isPositive ? 'var(--success)' : 'var(--danger)';
  const soft = isPositive ? 'var(--success-soft)' : 'var(--danger-soft)';
  const pct = formatPct(count, total);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${soft}, var(--surface-raised) 58%)`,
      border: '1px solid var(--glass-border)',
      borderLeft: `4px solid ${accent}`,
      borderRadius: '14px',
      padding: '18px',
      minHeight: '190px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 8px 24px var(--panel-shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>{title}</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '2.55rem', fontWeight: 780, lineHeight: 1 }}>{count.toLocaleString()}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '6px' }}>{pct}% de clientes evaluados</p>
        </div>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          background: soft,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={25} />
        </div>
      </div>
      <div>
        <ProgressLine value={pct} tone={accent} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.35, margin: 0 }}>{detail}</p>
          <DownloadMiniButton onClick={onDownload} disabled={disabled}>Descargar</DownloadMiniButton>
        </div>
      </div>
    </div>
  );
};

const RequirementLockCard = ({ icon: Icon, title, subtitle, okCount, missingRows, total, onDownload }) => {
  const okPct = formatPct(okCount, total);
  const missingCount = missingRows?.length || 0;

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--glass-border)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 6px 18px var(--panel-shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={21} />
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 720, fontSize: '0.92rem' }}>{title}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: '2px' }}>{subtitle}</p>
          </div>
        </div>
        <Lock size={17} color="var(--text-muted)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
        <div>
          <p style={{ color: 'var(--success)', fontSize: '1.3rem', fontWeight: 760 }}>{okCount.toLocaleString()}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>cumplen</p>
        </div>
        <div>
          <p style={{ color: 'var(--danger)', fontSize: '1.3rem', fontWeight: 760 }}>{missingCount.toLocaleString()}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>faltan</p>
        </div>
      </div>
      <ProgressLine value={okPct} tone="var(--success)" />
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <DownloadMiniButton onClick={onDownload} disabled={missingCount === 0}>Descargar faltantes</DownloadMiniButton>
      </div>
    </div>
  );
};

const EligibilityRewardsPanel = ({
  kpis,
  eligibleClients,
  ineligibleClients,
  missingRedemptionClients,
  missingWeeklyClients,
  missingBoxClients,
  onDownload,
}) => {
  const total = kpis.total_clients_evaluated || eligibleClients.length + ineligibleClients.length || 0;
  const lockRows = [
    {
      icon: Beer,
      title: '50 cervezas mínimo',
      subtitle: 'Canjes acumulados del mes',
      okCount: kpis.lock_redemptions_ok || 0,
      missingRows: missingRedemptionClients,
      filename: 'clientes_faltan_50_cervezas.xlsx',
      sheet: 'Faltan_50_Cervezas',
    },
    {
      icon: Calendar,
      title: 'Redime todos los fines de semana',
      subtitle: `${kpis.weekends_required_count || kpis.weeks_required_count || 0} fines de semana evaluados`,
      okCount: kpis.lock_weeks_ok || 0,
      missingRows: missingWeeklyClients,
      filename: 'clientes_faltan_fines_de_semana.xlsx',
      sheet: 'Faltan_Fines_Semana',
    },
    {
      icon: ShoppingCart,
      title: 'Compra de 1 caja',
      subtitle: 'Compra mínima registrada',
      okCount: kpis.lock_boxes_ok || 0,
      missingRows: missingBoxClients,
      filename: 'clientes_faltan_1_caja.xlsx',
      sheet: 'Faltan_1_Caja',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '18px',
        boxShadow: '0 8px 24px var(--panel-shadow)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--cusquena-gold)', fontWeight: 760, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Candados Junio</p>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.45rem', fontWeight: 760, marginTop: '4px' }}>Elegibilidad para incentivos de mozos</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '6px' }}>
              Un cliente entra al ranking solo si cumple los tres candados: 50 cervezas, redención en todos los fines de semana de junio y 1 caja comprada.
            </p>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString()}</strong> clientes evaluados<br />
            Fines de semana: {(kpis.weekends_required || kpis.weeks_required || []).join(', ') || 'Sin fines de semana'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        <EligibilityHeroCard
          type="positive"
          title="Clientes elegibles"
          count={eligibleClients.length}
          total={total}
          detail="Cumplen los tres candados y ya pueden participar en el ranking."
          icon={CheckCircle}
          onDownload={() => onDownload(eligibleClients, 'clientes_elegibles_mozos_junio.xlsx', 'Elegibles')}
          disabled={eligibleClients.length === 0}
        />
        <EligibilityHeroCard
          type="negative"
          title="Clientes no elegibles"
          count={ineligibleClients.length}
          total={total}
          detail="Tienen al menos un candado pendiente; el Excel indica exactamente qué falta."
          icon={XCircle}
          onDownload={() => onDownload(ineligibleClients, 'clientes_no_elegibles_mozos_junio.xlsx', 'No_Elegibles')}
          disabled={ineligibleClients.length === 0}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
        {lockRows.map(lock => (
          <RequirementLockCard
            key={lock.title}
            icon={lock.icon}
            title={lock.title}
            subtitle={lock.subtitle}
            okCount={lock.okCount}
            missingRows={lock.missingRows}
            total={total}
            onDownload={() => onDownload(lock.missingRows, lock.filename, lock.sheet)}
          />
        ))}
      </div>
    </div>
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
    setLoading(true);
    setSearchQuery('');
    setSelectedMonth(e.target.value);
  };

  const { 
    winners = [], 
    eligible_clients_detail = [],
    ineligible_clients_detail = [],
    top1 = null, 
    top100 = [], 
    top_clients = [], 
    kpis = {}, 
    available_months = [] 
  } = rankingsData || {};

  const loadingMonthLabel = selectedMonth ? formatMonthDisplay(selectedMonth) : 'el mes seleccionado';

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

  const buildEligibilityExportRows = (rows) => rows.map(row => ({
    'Cliente ID': row.cliente_id,
    'Nombre Comercial': row.nombre_comercial,
    'Dirección': row.direccion,
    'Gerencia': row.gerencia,
    'Supervisor': row.supervisor,
    'BDR': row.BDR,
    'Redenciones Mes': row.redenciones_mes,
    'Cajas': row.cajas,
    'Fines de Semana Redimiendo': row.fines_de_semana_redimiendo ?? row.semanas_redimiendo,
    'Fines de Semana Requeridos': row.fines_de_semana_requeridos ?? row.semanas_requeridas,
    'Fines de Semana con Redención': row.fines_de_semana_con_redencion ?? row.semanas_con_redencion,
    'Fines de Semana Faltantes': row.fines_de_semana_faltantes ?? row.semanas_faltantes,
    'Cumple 50 Cervezas': row.cumple_50_cervezas ? 'Sí' : 'No',
    'Cumple Todos los Fines de Semana': row.cumple_todas_las_semanas ? 'Sí' : 'No',
    'Cumple 1 Caja': row.cumple_1_caja ? 'Sí' : 'No',
    'Elegible': row.elegible ? 'Sí' : 'No',
    'Faltantes': row.faltantes,
  }));

  const downloadEligibilityExcel = (rows, filename, sheetName = 'Clientes') => {
    if (!rows || rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(buildEligibilityExportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  };


  const isMayo = selectedMonth === '05/2026';
  const usesJuneLocks = !!kpis.uses_june_locks;
  const missingRedemptionClients = useMemo(
    () => ineligible_clients_detail.filter(client => !client.cumple_50_cervezas),
    [ineligible_clients_detail]
  );
  const missingWeeklyClients = useMemo(
    () => ineligible_clients_detail.filter(client => !client.cumple_todas_las_semanas),
    [ineligible_clients_detail]
  );
  const missingBoxClients = useMemo(
    () => ineligible_clients_detail.filter(client => !client.cumple_1_caja),
    [ineligible_clients_detail]
  );

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
          const badgeStyle = PRIZE_BADGE_STYLES[p] || PRIZE_BADGE_STYLES.default;
          
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
                background: badgeStyle.background,
                color: badgeStyle.color,
                border: badgeStyle.border
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
          <Award size={28} color="var(--cusquena-gold)" /> Ranking e Incentivos de Mozos
        </h2>
        <p className="text-secondary text-sm">Control mensual de concursos y premios para meseros de locales participantes</p>
      </div>

      {/* Control Panel Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass-panel" style={{ 
        background: 'var(--subtle-surface)', 
        borderColor: 'var(--glass-border)',
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
            disabled={loading}
            style={{ 
              width: 'auto', 
              minWidth: '160px', 
              padding: '6px 32px 6px 12px', 
              fontSize: '0.85rem', 
              background: 'var(--select-bg)', 
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              color: 'var(--text-primary)'
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
            disabled={loading || !winners || winners.length === 0}
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

      {loading && rankingsData && (
        <div className="glass-panel p-6 animate-fade-in flex items-center justify-center gap-4" style={{
          minHeight: '260px',
          borderColor: 'var(--cusquena-gold)',
          flexDirection: 'column',
          textAlign: 'center'
        }}>
          <div className="loader"></div>
          <div>
            <p className="text-gold font-bold">Cargando Ranking Mozos</p>
            <p className="text-secondary text-sm mt-1">Actualizando información para {loadingMonthLabel}...</p>
          </div>
        </div>
      )}

      {/* KPI Validation Metrics Grid */}
      {!loading && kpis && !usesJuneLocks && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          width: '100%'
        }}>
          {/* Card: Locales Aptos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--cusquena-gold)', background: 'var(--subtle-surface)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Locales Aptos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">{kpis.eligible_clients || 0}</span>
              <span className="text-secondary text-3xs">Califican con canjes &gt; 50 y ventas &ge; 2 cajas</span>
            </div>
          </div>

          {/* Card: Premios Asignados */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--success)', background: 'var(--subtle-surface)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Premios Asignados</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">{kpis.final_rows || 0}</span>
              <span className="text-secondary text-3xs">Total de incentivos ganados por los mozos</span>
            </div>
          </div>

          {/* Card: Regla de 3 Mozos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--info)', background: 'var(--subtle-surface)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Regla 3 Mozos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-white font-extrabold text-2xl">
                {isMayo ? `${kpis.clients_satisfying_rule?.split(' / ')[0] || 0} de ${kpis.eligible_clients || 0}` : `${kpis.eligible_clients || 0} de ${kpis.eligible_clients || 0}`}
              </span>
              <span className="text-secondary text-3xs">Locales con &ge; 3 mozos con más de 20 canjes</span>
            </div>
          </div>

          {/* Card: Locales Excluidos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--cusquena-red)', background: 'var(--subtle-surface)' }}>
            <span className="text-secondary text-2xs font-bold uppercase tracking-wider block mb-1">Locales Excluidos</span>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-red font-extrabold text-2xl">{(kpis.excl_sales || 0) + (kpis.excl_red || 0)}</span>
              <span className="text-secondary text-3xs" style={{ color: 'var(--danger)' }}>
                Falta de ventas: {kpis.excl_sales || 0} | Falta de canjes: {kpis.excl_red || 0}
              </span>
            </div>
          </div>

          {/* Card: Cobertura de Contactos */}
          <div className="glass-panel p-4 flex flex-col justify-between" style={{ borderLeft: '3px solid var(--accent-purple)', background: 'var(--subtle-surface)' }}>
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

      {!loading && kpis && usesJuneLocks && (
        <EligibilityRewardsPanel
          kpis={kpis}
          eligibleClients={eligible_clients_detail}
          ineligibleClients={ineligible_clients_detail}
          missingRedemptionClients={missingRedemptionClients}
          missingWeeklyClients={missingWeeklyClients}
          missingBoxClients={missingBoxClients}
          onDownload={downloadEligibilityExcel}
        />
      )}

      {/* CONDITIONAL RENDER: MAY vs JUNIO */}
      {!loading && isMayo && (
        /* ================= MAYO 2026 LAYOUT (3 Sections) ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          
          {/* Row: Contest 1 & Contest 2 */}
          <div className="waiters-grid">
            
            {/* Section 1: TOP 1 Card (Podium) */}
            <div className="contest-1-col flex flex-col">
              <div className="glass-panel p-6 flex-1 flex flex-col justify-between" style={{
                position: 'relative',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 0 25px var(--panel-shadow)',
                background: 'linear-gradient(180deg, var(--glass-bg) 0%, var(--subtle-surface) 100%)',
                minHeight: '430px'
              }}>
                <div>
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Crown size={20} color="var(--warning)" />
                    </div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center">
                      Concurso 01 - Mejor Mozo Nacional
                      <InfoTooltip content={
                        <div>
                          <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 01: MEJOR MOZO NACIONAL</p>
                          <p className="mb-2">El mesero con mayor número de canjes en el mes a nivel nacional recibe un premio de <strong className="text-white">S/ 1,000</strong>.</p>
                          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '6px', marginTop: '6px' }}>
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
                          background: 'radial-gradient(circle, var(--warning-soft) 0%, transparent 72%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Trophy size={40} color="var(--warning)" />
                        </div>
                      </div>

                      <p className="text-gold font-bold text-xs uppercase tracking-widest mb-1">Ganador Absoluto</p>
                      <h4 className="text-white font-bold text-xl mb-2" style={{ textShadow: 'none' }}>
                        {top1.waiter}
                      </h4>

                      <div className="glass-panel p-2.5 mb-3" style={{ background: 'var(--subtle-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', margin: '0 auto' }}>
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
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      <Info size={32} style={{ margin: '0 auto 10px' }} />
                      <p className="text-sm">Sin datos para este mes</p>
                    </div>
                  )}
                </div>

                {top1 && (
                  <div style={{
                    background: 'linear-gradient(90deg, var(--warning-soft), var(--subtle-surface))',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: '10px'
                  }}>
                    <div className="flex items-center gap-2">
                      <Coins size={16} color="var(--warning)" />
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
                      <Medal size={20} color="var(--text-secondary)" /> Concurso 02 - Los Mejores 100 Mozos Nacionales
                      <InfoTooltip content={
                        <div>
                          <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 02: TOP 100 MOZOS</p>
                          <p className="mb-2">El ranking nacional de los 100 meseros con más canjes en el mes. Cada ganador recibe <strong className="text-white">S/ 100</strong>.</p>
                          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '6px', marginTop: '6px' }}>
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
                      <Search size={14} color="var(--cusquena-gold)" />
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
                        background: 'var(--select-bg)',
                        border: '1px solid var(--glass-border)',
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
                          <th style={{ textAlign: 'center', width: '50px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Puesto</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Mozo</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Restaurante</th>
                          <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>ID Cliente</th>
                          <th style={{ textAlign: 'center', width: '80px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Canjes</th>
                          <th style={{ textAlign: 'center', width: '90px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Premio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContest2.map((item, idx) => {
                          const rank = item.rank;
                          const isTop3 = rank <= 3;
                          const rowBg = isTop3 
                            ? 'var(--warning-soft)' 
                            : (idx % 2 === 0 ? 'var(--subtle-surface)' : 'transparent');

                          return (
                            <tr 
                              key={`${item.waiter}-${item.client_id}`}
                              style={{ 
                                background: rowBg,
                                borderBottom: '1px solid var(--glass-border)',
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
                                    color: 'var(--text-on-gold)',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.65rem'
                                  }}>
                                    {rank}
                                  </div>
                                ) : (
                                  <span className="text-secondary">{rank}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '500', color: 'var(--text-primary)' }}>
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
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                                {item.restaurant_name}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {item.client_id}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold', color: 'var(--cusquena-gold)' }}>
                                {item.redemptions}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                                  background: 'var(--warning-soft)', border: '1px solid var(--glass-border)',
                                  padding: '2px 6px', borderRadius: '6px'
                                }}>
                                  <Coins size={8} color="var(--warning)" />
                                  <span className="text-gold font-bold" style={{ fontSize: '0.65rem' }}>{item.prize}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
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
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} color="var(--cusquena-gold-dark)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center">
                  Concurso 03 - Los mejores Mozos por Cliente (TOP CLIENT)
                  <InfoTooltip content={
                    <div>
                      <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>CONCURSO 03: TOP CLIENT</p>
                      <p className="mb-2">El mejor mesero (con mayor cantidad de canjes) para cada uno de los locales aptos. Cada ganador recibe un premio de <strong className="text-white">S/ 50</strong>.</p>
                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '6px', marginTop: '6px' }}>
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
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Mozo Ganador</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Cliente (Restaurante)</th>
                      <th style={{ textAlign: 'center', width: '120px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>ID Cliente</th>
                      <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Canjes Mozo</th>
                      <th style={{ textAlign: 'center', width: '100px', padding: '8px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Premio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTopClients.map((item, idx) => (
                      <tr 
                        key={`${item.client_id}`}
                        style={{ 
                          background: idx % 2 === 0 ? 'var(--subtle-surface)' : 'transparent',
                          borderBottom: '1px solid var(--glass-border)',
                          transition: 'background-color 0.15s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '8px 10px', fontWeight: '500', color: 'var(--text-primary)' }}>
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
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                          {item.restaurant_name}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {item.client_id}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold', color: 'var(--cusquena-gold)' }}>
                          {item.redemptions}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            background: 'var(--warning-soft)', border: '1px solid var(--glass-border)',
                            padding: '2px 6px', borderRadius: '6px'
                          }}>
                            <Coins size={8} color="var(--warning)" />
                            <span className="text-gold font-bold" style={{ fontSize: '0.65rem' }}>{item.prize}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <Info size={28} style={{ margin: '0 auto 8px' }} />
                  <p className="text-sm">No se encontraron ganadores coincidentes</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {!loading && !isMayo && (
        /* ================= JUNIO 2026 LAYOUT (Consolidated Winners Table) ================= */
        <div className="glass-panel p-6 flex flex-col" style={{ width: '100%', minHeight: '450px' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-gold border-opacity-10">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText size={20} color="var(--cusquena-gold)" /> Premios de Mozos - Vista Consolidada de Ganadores (`winners_view`)
                <InfoTooltip content={
                  <div>
                    <p className="font-bold text-gold mb-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>VISTA CONSOLIDADA DE GANADORES</p>
                    <p className="mb-2">Muestra todas las combinaciones ganadoras de meseros y locales de la campaña, unificando los premios <strong className="text-white">TOP 1</strong>, <strong className="text-white">TOP 100</strong>, y <strong className="text-white">TOP CLIENT</strong>.</p>
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '6px', marginTop: '6px' }}>
                      <p className="text-2xs text-secondary"><strong className="text-white">Normativa de Junio:</strong> El cliente debe cumplir 50 cervezas mínimo, redimir todos los fines de semana de junio evaluados y registrar compra de 1 caja.</p>
                    </div>
                  </div>
                } />
              </h3>
              <p className="text-secondary text-2xs mt-0.5">Premios consolidados por mesero y local apto (Deduplicado por Cliente ID + Mozo Key)</p>
            </div>
            
            {/* Search Box */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="var(--cusquena-gold)" />
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
                  background: 'var(--select-bg)',
                  border: '1px solid var(--glass-border)',
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
                    <th style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Mesero Nombre</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Mesero Documento</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Mesero Teléfono</th>
                    <th style={{ textAlign: 'center', width: '110px', padding: '10px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Cliente ID</th>
                    <th style={{ textAlign: 'center', width: '100px', padding: '10px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Canjes</th>
                    <th style={{ textAlign: 'center', width: '220px', padding: '10px 6px', background: 'var(--table-header-bg)', borderBottom: '2px solid var(--glass-border)', color: 'var(--cusquena-gold)', fontWeight: 'bold' }}>Premios</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWinners.map((item, idx) => (
                    <tr 
                      key={`${item.cliente_id}-${item.mesero_nombre}`}
                      style={{ 
                        background: idx % 2 === 0 ? 'var(--subtle-surface)' : 'transparent',
                        borderBottom: '1px solid var(--glass-border)',
                        transition: 'background-color 0.15s'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {item.mesero_nombre}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', color: item.mesero_documento ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {item.mesero_documento || '—'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', color: item.mesero_telefono ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {item.mesero_telefono || '—'}
                      </td>
                      <td 
                        style={{ textAlign: 'center', padding: '10px 6px', color: 'var(--cusquena-gold)', fontWeight: 'bold', cursor: 'help', fontFamily: 'monospace' }}
                        title={`Nombre Comercial: ${item.nombre_comercial}`}
                      >
                        {item.cliente_id}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 'bold', color: 'var(--success)' }}>
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
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
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

