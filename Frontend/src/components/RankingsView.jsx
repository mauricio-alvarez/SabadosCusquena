import { useState, useMemo, useCallback } from 'react';
import { Trophy, Medal, Award, Crown, ChevronDown, ChevronUp, Filter, Users, Download } from 'lucide-react';
import { parse, isWithinInterval, format } from 'date-fns';
import * as XLSX from 'xlsx';
import DateRangePicker from './DateRangePicker';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
const MEDAL_ICONS = [Crown, Medal, Award];

const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
};

const RankingCard = ({ title, icon: Icon, data, expandable = true, statLabel = 'canjes', statKey = 'redemptions', secondaryLine }) => {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="glass-panel p-5" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(207,160,82,0.2)' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(207,160,82,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color="#CFA052" />
        </div>
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">{title}</h3>
        <span className="text-secondary text-xs" style={{ marginLeft: 'auto' }}>{data.length} registros</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {displayData.map((item, idx) => {
          const rank = idx + 1;
          const isTop3 = rank <= 3;
          const MedalIcon = isTop3 ? MEDAL_ICONS[idx] : null;
          const medalColor = isTop3 ? MEDAL_COLORS[idx] : null;

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: isTop3 ? `rgba(207,160,82,${0.12 - idx * 0.03})` : 'rgba(255,255,255,0.02)',
                transition: 'background 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isTop3 ? `rgba(207,160,82,${0.18 - idx * 0.03})` : 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = isTop3 ? `rgba(207,160,82,${0.12 - idx * 0.03})` : 'rgba(255,255,255,0.02)'}
            >
              {/* Rank */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isTop3 ? medalColor : 'rgba(255,255,255,0.1)',
                color: isTop3 ? '#000' : '#9ca3af',
                fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0
              }}>
                {isTop3 ? <MedalIcon size={16} /> : rank}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-white text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-secondary" style={{ marginTop: '2px' }}>
                  {secondaryLine ? secondaryLine(item) : `${item.activeClients} clientes activos · ${item.activePct}% activación`}
                </p>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="text-gold font-bold" style={{ fontSize: '1.1rem' }}>{item[statKey].toLocaleString()}</p>
                <p className="text-xs text-secondary">{statLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {expandable && data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', marginTop: '12px', padding: '8px',
            background: 'rgba(207,160,82,0.08)', border: '1px solid rgba(207,160,82,0.2)',
            borderRadius: '8px', color: '#CFA052', fontSize: '0.8rem', fontWeight: '600',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(207,160,82,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(207,160,82,0.08)'}
        >
          {expanded ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todos ({data.length})</>}
        </button>
      )}
    </div>
  );
};

const RankingsView = ({ allClients }) => {
  const [sortBy, setSortBy] = useState('redemptions'); // 'redemptions' or 'activeClients'

  // Independent filters for rankings
  const [filters, setFilters] = useState({
    direccion: 'All',
    gerencia: 'All',
    supervisor: 'All',
    BDR: 'All',
  });
  const [useAllTimeData, setUseAllTimeData] = useState(true);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Cascading filter options
  const getFilterOptions = (filterKey) => {
    if (!allClients) return [];
    const validClients = allClients.filter(c => {
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

  // Apply date + hierarchy filters
  const filteredClients = useMemo(() => {
    if (!allClients || allClients.length === 0) return [];

    // Date filtering
    let clientsWithValidRedemptions = allClients;
    if (!useAllTimeData && dateRange?.from && dateRange?.to) {
      clientsWithValidRedemptions = allClients.map(c => {
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

    // Hierarchy filtering
    return clientsWithValidRedemptions.filter(c => {
      if (filters.direccion !== 'All' && c.direccion !== filters.direccion) return false;
      if (filters.gerencia !== 'All' && c.gerencia !== filters.gerencia) return false;
      if (filters.supervisor !== 'All' && c.supervisor !== filters.supervisor) return false;
      if (filters.BDR !== 'All' && c.BDR !== filters.BDR) return false;
      return true;
    });
  }, [allClients, filters, useAllTimeData, dateRange]);

  const rankings = useMemo(() => {
    if (!filteredClients || filteredClients.length === 0) return { gerencia: [], supervisor: [], BDR: [], clients: [] };

    const aggregate = (key) => {
      const map = {};
      filteredClients.forEach(c => {
        const name = c[key];
        if (!name || name === 'N/A') return;
        if (!map[name]) map[name] = { name, redemptions: 0, totalClients: 0, activeClients: 0 };
        map[name].totalClients++;
        map[name].redemptions += c.redemptions;
        if (c.redemptions > 0) map[name].activeClients++;
      });

      return Object.values(map)
        .map(item => ({
          ...item,
          activePct: item.totalClients > 0 ? ((item.activeClients / item.totalClients) * 100).toFixed(1) : '0.0',
          avg: item.activeClients > 0 ? (item.redemptions / item.activeClients).toFixed(1) : '0.0'
        }))
        .sort((a, b) => sortBy === 'redemptions' ? b.redemptions - a.redemptions : b.activeClients - a.activeClients);
    };

    // Client-level ranking (individual clients with most redemptions)
    const clientList = filteredClients
      .filter(c => c.redemptions > 0)
      .map(c => ({
        name: c.nombre_comercial || c.cliente_id,
        clientId: c.cliente_id,
        redemptions: c.redemptions,
        supervisor: c.supervisor || 'N/A',
        BDR: c.BDR || 'N/A',
        gerencia: c.gerencia || 'N/A',
      }))
      .sort((a, b) => b.redemptions - a.redemptions);

    return {
      gerencia: aggregate('gerencia'),
      supervisor: aggregate('supervisor'),
      BDR: aggregate('BDR'),
      clients: clientList,
    };
  }, [filteredClients, sortBy]);

  // Overall top performers
  const topGerencia = rankings.gerencia[0];
  const topSupervisor = rankings.supervisor[0];
  const topBDR = rankings.BDR[0];
  const topClient = rankings.clients[0];

  const handleDownload = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Helper: build sheet for aggregated groups (Gerencia, Supervisor, BDR)
    const buildGroupSheet = (data, nameLabel) => {
      const rows = data.map(item => ({
        [nameLabel]: item.name,
        'Redenciones Totales': item.redemptions,
        'Clientes Activos': item.activeClients,
        'Clientes Total': item.totalClients,
        '% de Activación': parseFloat(item.activePct),
        '% de Oportunidad': parseFloat((100 - parseFloat(item.activePct)).toFixed(1)),
      }));
      return XLSX.utils.json_to_sheet(rows);
    };

    // Helper: build sheet for individual clients
    const buildClientSheet = (data) => {
      const rows = data.map(item => ({
        'Cliente': item.name,
        'ID Cliente': item.clientId,
        'Gerencia': item.gerencia,
        'Supervisor': item.supervisor,
        'BDR': item.BDR,
        'Redenciones Totales': item.redemptions,
      }));
      return XLSX.utils.json_to_sheet(rows);
    };

    XLSX.utils.book_append_sheet(wb, buildGroupSheet(rankings.gerencia, 'Gerencia'), 'Gerencia');
    XLSX.utils.book_append_sheet(wb, buildGroupSheet(rankings.supervisor, 'Supervisor'), 'Supervisor');
    XLSX.utils.book_append_sheet(wb, buildGroupSheet(rankings.BDR, 'BDR'), 'BDR');
    XLSX.utils.book_append_sheet(wb, buildClientSheet(rankings.clients), 'Cliente');

    const today = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `Rankings_Cusquena_${today}.xlsx`);
  }, [rankings]);

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6">
      {/* Filters Panel */}
      <div className="glass-panel p-4 mb-4 flex-shrink-0" style={{ position: 'relative', zIndex: 100 }}>
        <div className="flex items-center gap-4 mb-3 pb-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-2">
            <Filter className="text-gold" size={20} />
            <h3 className="text-gold font-bold text-lg">Filtros Activos</h3>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <DateRangePicker
              useAllTimeData={useAllTimeData}
              setUseAllTimeData={setUseAllTimeData}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
            <button
              onClick={() => setFilters({ direccion: 'All', gerencia: 'All', supervisor: 'All', BDR: 'All' })}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.85rem', flexShrink: 0 }}
            >
              Borrar Filtros
            </button>
          </div>
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

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-gold font-bold text-2xl mb-1" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={28} color="#CFA052" /> Rankings
          </h2>
          <p className="text-secondary text-sm">Los mejores performers de la campaña Cusqueña</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="text-secondary text-xs font-semibold">Ordenar por:</span>
          <select
            className="filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '6px 32px 6px 12px', fontSize: '0.85rem' }}
          >
            <option value="redemptions">Total Canjes</option>
            <option value="activeClients">Clientes Activos</option>
          </select>
          <button
            className="btn-gold"
            onClick={handleDownload}
            style={{ padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Podium Heroes */}
      {topGerencia && topSupervisor && topBDR && topClient && (
        <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4 mb-6">
          {[
            { label: 'Mejor Gerencia', data: topGerencia, gradient: 'linear-gradient(135deg, rgba(207,160,82,0.2), rgba(207,160,82,0.05))' },
            { label: 'Mejor Supervisor', data: topSupervisor, gradient: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.03))' },
            { label: 'Mejor BDR', data: topBDR, gradient: 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.03))' },
            { label: 'Mejor Cliente', data: topClient, gradient: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.03))', isClient: true },
          ].map((hero, i) => (
            <div key={i} className="glass-panel p-5" style={{ background: hero.gradient, textAlign: 'center' }}>
              <Crown size={32} color={MEDAL_COLORS[0]} style={{ margin: '0 auto 8px' }} />
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-2">{hero.label}</p>
              <p className="text-white font-bold text-lg" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hero.data.name}>{hero.data.name}</p>
              <p className="text-gold font-bold" style={{ fontSize: '1.8rem', margin: '4px 0' }}>{hero.data.redemptions.toLocaleString()}</p>
              <p className="text-xs text-secondary">
                {hero.isClient
                  ? `canjes · BDR: ${hero.data.BDR}`
                  : `canjes · ${hero.data.activeClients} clientes activos · ${hero.data.activePct}% activación`
                }
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Full Rankings */}
      <div className="grid grid-cols-1 grid-cols-md-2 gap-4">
        <RankingCard title="Gerencias" icon={Trophy} data={rankings.gerencia} />
        <RankingCard title="Supervisores" icon={Medal} data={rankings.supervisor} />
        <RankingCard title="BDRs" icon={Award} data={rankings.BDR} />
        <RankingCard
          title="Clientes"
          icon={Users}
          data={rankings.clients}
          statLabel="canjes"
          statKey="redemptions"
          secondaryLine={(item) => `BDR: ${item.BDR} · Supervisor: ${item.supervisor}`}
        />
      </div>
    </div>
  );
};

export default RankingsView;
