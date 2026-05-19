import { useState, useMemo } from 'react';
import { Trophy, Medal, Award, Crown, ChevronDown, ChevronUp } from 'lucide-react';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
const MEDAL_ICONS = [Crown, Medal, Award];

const RankingCard = ({ title, icon: Icon, data, expandable = true }) => {
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
                  {item.activeClients} clientes activos · {item.activePct}% activación
                </p>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="text-gold font-bold" style={{ fontSize: '1.1rem' }}>{item.redemptions.toLocaleString()}</p>
                <p className="text-xs text-secondary">canjes</p>
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

const RankingsView = ({ clients }) => {
  const [sortBy, setSortBy] = useState('redemptions'); // 'redemptions' or 'activeClients'

  const rankings = useMemo(() => {
    if (!clients || clients.length === 0) return { gerencia: [], supervisor: [], BDR: [] };

    const aggregate = (key) => {
      const map = {};
      clients.forEach(c => {
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

    return {
      gerencia: aggregate('gerencia'),
      supervisor: aggregate('supervisor'),
      BDR: aggregate('BDR'),
    };
  }, [clients, sortBy]);

  // Overall top performers
  const topGerencia = rankings.gerencia[0];
  const topSupervisor = rankings.supervisor[0];
  const topBDR = rankings.BDR[0];

  return (
    <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full pb-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-gold font-bold text-2xl mb-1" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={28} color="#CFA052" /> Rankings
          </h2>
          <p className="text-secondary text-sm">Los mejores performers de la campaña Cusqueña</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
      </div>

      {/* Podium Heroes */}
      {topGerencia && topSupervisor && topBDR && (
        <div className="grid grid-cols-1 grid-cols-md-3 gap-4 mb-6">
          {[
            { label: 'Mejor Gerencia', data: topGerencia, gradient: 'linear-gradient(135deg, rgba(207,160,82,0.2), rgba(207,160,82,0.05))' },
            { label: 'Mejor Supervisor', data: topSupervisor, gradient: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.03))' },
            { label: 'Mejor BDR', data: topBDR, gradient: 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.03))' },
          ].map((hero, i) => (
            <div key={i} className="glass-panel p-5" style={{ background: hero.gradient, textAlign: 'center' }}>
              <Crown size={32} color={MEDAL_COLORS[0]} style={{ margin: '0 auto 8px' }} />
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-2">{hero.label}</p>
              <p className="text-white font-bold text-lg" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hero.data.name}>{hero.data.name}</p>
              <p className="text-gold font-bold" style={{ fontSize: '1.8rem', margin: '4px 0' }}>{hero.data.redemptions.toLocaleString()}</p>
              <p className="text-xs text-secondary">canjes · {hero.data.activeClients} clientes activos · {hero.data.activePct}% activación</p>
            </div>
          ))}
        </div>
      )}

      {/* Full Rankings */}
      <div className="grid grid-cols-1 grid-cols-md-3 gap-4">
        <RankingCard title="Gerencias" icon={Trophy} data={rankings.gerencia} />
        <RankingCard title="Supervisores" icon={Medal} data={rankings.supervisor} />
        <RankingCard title="BDRs" icon={Award} data={rankings.BDR} />
      </div>
    </div>
  );
};

export default RankingsView;
