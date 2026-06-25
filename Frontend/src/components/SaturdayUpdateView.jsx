import { useEffect, useMemo, useState } from 'react';
import { Clock, Flag, Package, RefreshCcw, Star, User, Users } from 'lucide-react';

const normalizeDateKey = (dateStr) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return String(dateStr || '');
  const [day, month, year] = parts;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const findAvailableDate = (availableDates, targetDate) => {
  const targetKey = normalizeDateKey(targetDate);
  return availableDates.find(dateStr => normalizeDateKey(dateStr) === targetKey) || null;
};

const isDateForWeekday = (dateStr, weekday) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return false;
  const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  return d.getDay() === weekday;
};

const normalizeTime = (timeStr) => {
  const [h = '0', m = '0', s = '0'] = String(timeStr || '00:00:00').split(':');
  return `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}:${String(Number(s) || 0).padStart(2, '0')}`;
};

const isSameCutoffOrEarlier = (timeStr, latestHourLimit) => (
  normalizeTime(timeStr) <= normalizeTime(latestHourLimit || '23:59:59')
);

const isDateToday = (dateStr) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return false;
  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isInfinitePct = (value) => {
  const text = String(value ?? '').toLowerCase();
  return text === '∞' || text === 'infinity';
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');

const formatPercent = (value) => `${Math.round(toNumber(value))}%`;

const formatDeltaPercent = (pct) => {
  if (isInfinitePct(pct)) return 'nuevo';
  const value = Math.round(toNumber(pct));
  return `${value > 0 ? '+' : ''}${value}%`;
};

const deltaColor = (delta) => {
  const value = toNumber(delta);
  if (value > 0) return 'var(--success)';
  if (value < 0) return 'var(--danger)';
  return 'var(--text-secondary)';
};

const trendSymbol = (delta) => {
  const value = toNumber(delta);
  if (value > 0) return '▲';
  if (value < 0) return '▼';
  return '●';
};

const parseDate = (dateStr) => {
  const parts = normalizeDateKey(dateStr).split('/').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

const formatTitleDate = (dateStr) => {
  const date = parseDate(dateStr);
  if (!date) return dateStr || '';
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatComparisonDate = (dateStr) => {
  const normalized = normalizeDateKey(dateStr);
  return normalized ? `Sábado ${normalized}` : 'Sin fecha';
};

function computeMetrics(clients, latestSaturday, prevSaturday, latestHourLimit) {
  const total = clients.length;
  const latestKey = normalizeDateKey(latestSaturday);
  const prevKey = normalizeDateKey(prevSaturday);
  let currentSabCount = 0;
  let prevSabCount = 0;
  let prevSabCountSameHour = 0;
  let activeOnLatest = 0;
  let activeOnPrev = 0;
  let activeOnPrevSameHour = 0;

  clients.forEach(c => {
    if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;
    let clientCurrentCount = 0;
    let clientPrevCount = 0;
    let clientPrevCountSameHour = 0;

    c.redemption_dates.forEach((dateStr, idx) => {
      const dateKey = normalizeDateKey(dateStr);
      const hr = c.redemption_hours?.[idx] || '00:00:00';
      if (dateKey === latestKey) {
        currentSabCount++;
        clientCurrentCount++;
      }
      if (dateKey === prevKey) {
        prevSabCount++;
        clientPrevCount++;
        if (isSameCutoffOrEarlier(hr, latestHourLimit)) {
          prevSabCountSameHour++;
          clientPrevCountSameHour++;
        }
      }
    });

    if (clientCurrentCount > 0) activeOnLatest++;
    if (clientPrevCount > 0) activeOnPrev++;
    if (clientPrevCountSameHour > 0) activeOnPrevSameHour++;
  });

  const active = activeOnLatest;
  const inactive = total - active;
  const totalRedemptions = currentSabCount;
  const avgPerActive = active > 0 ? (totalRedemptions / active).toFixed(1) : '0.0';
  const useClosedDateCutoff = latestSaturday ? !isDateToday(latestSaturday) : false;
  const prevSabCountForFullDay = useClosedDateCutoff ? prevSabCountSameHour : prevSabCount;
  const activeOnPrevForFullDay = useClosedDateCutoff ? activeOnPrevSameHour : activeOnPrev;
  const prevAvgPerActive = activeOnPrevForFullDay > 0 ? (prevSabCountForFullDay / activeOnPrevForFullDay).toFixed(1) : '0.0';
  const prevAvgPerActiveSameHour = activeOnPrevSameHour > 0 ? (prevSabCountSameHour / activeOnPrevSameHour).toFixed(1) : '0.0';

  const vsSabDelta = currentSabCount - prevSabCountForFullDay;
  const vsSabPct = prevSabCountForFullDay > 0
    ? ((vsSabDelta / prevSabCountForFullDay) * 100).toFixed(1)
    : (currentSabCount > 0 ? '∞' : '0');

  const vsSabDeltaSameHour = currentSabCount - prevSabCountSameHour;
  const vsSabPctSameHour = prevSabCountSameHour > 0
    ? ((vsSabDeltaSameHour / prevSabCountSameHour) * 100).toFixed(1)
    : (currentSabCount > 0 ? '∞' : '0');

  const vsSabActiveDelta = activeOnLatest - activeOnPrevForFullDay;
  const vsSabActivePct = activeOnPrevForFullDay > 0
    ? ((vsSabActiveDelta / activeOnPrevForFullDay) * 100).toFixed(1)
    : (activeOnLatest > 0 ? '∞' : '0');

  const vsSabActiveDeltaSameHour = activeOnLatest - activeOnPrevSameHour;
  const vsSabActivePctSameHour = activeOnPrevSameHour > 0
    ? ((vsSabActiveDeltaSameHour / activeOnPrevSameHour) * 100).toFixed(1)
    : (activeOnLatest > 0 ? '∞' : '0');

  const vsSabAvgDelta = (parseFloat(avgPerActive) - parseFloat(prevAvgPerActive)).toFixed(1);
  const vsSabAvgPct = parseFloat(prevAvgPerActive) > 0
    ? (((parseFloat(avgPerActive) - parseFloat(prevAvgPerActive)) / parseFloat(prevAvgPerActive)) * 100).toFixed(1)
    : (parseFloat(avgPerActive) > 0 ? '∞' : '0');

  const vsSabAvgDeltaSameHour = (parseFloat(avgPerActive) - parseFloat(prevAvgPerActiveSameHour)).toFixed(1);
  const vsSabAvgPctSameHour = parseFloat(prevAvgPerActiveSameHour) > 0
    ? (((parseFloat(avgPerActive) - parseFloat(prevAvgPerActiveSameHour)) / parseFloat(prevAvgPerActiveSameHour)) * 100).toFixed(1)
    : (parseFloat(avgPerActive) > 0 ? '∞' : '0');

  return {
    total,
    active,
    inactive,
    totalRedemptions,
    avgPerActive,
    activePct: total > 0 ? ((active / total) * 100).toFixed(0) : '0',
    inactivePct: total > 0 ? ((inactive / total) * 100).toFixed(0) : '0',
    vsSabDelta,
    vsSabPct,
    vsSabDeltaSameHour,
    vsSabPctSameHour,
    vsSabActiveDelta,
    vsSabActivePct,
    vsSabActiveDeltaSameHour,
    vsSabActivePctSameHour,
    vsSabAvgDelta: parseFloat(vsSabAvgDelta),
    vsSabAvgPct,
    vsSabAvgDeltaSameHour: parseFloat(vsSabAvgDeltaSameHour),
    vsSabAvgPctSameHour,
  };
}

const SaturdayUpdateView = ({ allClients = [], progressData, onRefresh, refreshing = false }) => {
  const [selectedComparisonDate, setSelectedComparisonDate] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [mobileSection, setMobileSection] = useState('clients');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const saturdayDates = useMemo(() => {
    if (!progressData?.available_dates) return [];
    return progressData.available_dates.filter(dateStr => isDateForWeekday(dateStr, 6));
  }, [progressData]);

  const currentSaturday = saturdayDates[saturdayDates.length - 1] || null;

  const comparisonOptions = useMemo(() => {
    if (saturdayDates.length <= 1) return [];
    return saturdayDates.slice(0, -1).reverse();
  }, [saturdayDates]);

  useEffect(() => {
    if (comparisonOptions.length === 0) {
      setSelectedComparisonDate('');
      return;
    }

    const selectedExists = comparisonOptions.some(
      dateStr => normalizeDateKey(dateStr) === normalizeDateKey(selectedComparisonDate)
    );

    if (!selectedExists) {
      setSelectedComparisonDate(comparisonOptions[0]);
    }
  }, [comparisonOptions, selectedComparisonDate]);

  const comparisonSaturday = useMemo(() => {
    if (!selectedComparisonDate) return comparisonOptions[0] || null;
    return findAvailableDate(comparisonOptions, selectedComparisonDate) || comparisonOptions[0] || null;
  }, [comparisonOptions, selectedComparisonDate]);

  const latestHourLimit = useMemo(() => {
    if (!currentSaturday || allClients.length === 0) return '23:59:59';
    const currentKey = normalizeDateKey(currentSaturday);
    let maxTime = '00:00:00';

    allClients.forEach(c => {
      if (!c.redemption_dates || !c.redemption_hours) return;
      c.redemption_dates.forEach((dateStr, idx) => {
        if (normalizeDateKey(dateStr) === currentKey) {
          const time = normalizeTime(c.redemption_hours[idx]);
          if (time > maxTime) maxTime = time;
        }
      });
    });

    return maxTime;
  }, [allClients, currentSaturday]);

  const totals = useMemo(
    () => computeMetrics(allClients, currentSaturday, comparisonSaturday, latestHourLimit),
    [allClients, currentSaturday, comparisonSaturday, latestHourLimit]
  );

  const directions = useMemo(() => {
    const groups = {};
    allClients.forEach(client => {
      const name = client.direccion || 'N/A';
      if (!groups[name]) groups[name] = [];
      groups[name].push(client);
    });

    return Object.keys(groups).sort().map(name => ({
      name,
      ...computeMetrics(groups[name], currentSaturday, comparisonSaturday, latestHourLimit),
    }));
  }, [allClients, currentSaturday, comparisonSaturday, latestHourLimit]);

  const activeRows = useMemo(
    () => [...directions].sort((a, b) => toNumber(b.activePct) - toNumber(a.activePct)),
    [directions]
  );

  const bottleRows = useMemo(
    () => [...directions].sort((a, b) => b.totalRedemptions - a.totalRedemptions),
    [directions]
  );

  const averageRows = useMemo(
    () => [...directions].sort((a, b) => parseFloat(b.avgPerActive) - parseFloat(a.avgPerActive)),
    [directions]
  );

  const insight = useMemo(() => {
    if (directions.length === 0) return 'Sin datos suficientes para generar insight.';
    const topActivation = [...directions].sort((a, b) => toNumber(b.activePct) - toNumber(a.activePct))[0];
    const topBottles = [...directions].sort((a, b) => b.totalRedemptions - a.totalRedemptions)[0];
    const bottleShare = totals.totalRedemptions > 0
      ? Math.round((topBottles.totalRedemptions / totals.totalRedemptions) * 100)
      : 0;

    return `${topActivation.name} lidera activación con ${formatPercent(topActivation.activePct)} de clientes activos. ${topBottles.name} concentra el ${bottleShare}% de las botellas regaladas del día.`;
  }, [directions, totals.totalRedemptions]);

  if (!currentSaturday) {
    return (
      <div className="glass-panel p-6" style={{ color: 'var(--text-primary)' }}>
        No hay sábados disponibles para construir la actualización.
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileSaturdayLayout
        currentSaturday={currentSaturday}
        comparisonSaturday={comparisonSaturday}
        comparisonOptions={comparisonOptions}
        selectedComparisonDate={selectedComparisonDate}
        setSelectedComparisonDate={setSelectedComparisonDate}
        totals={totals}
        activeRows={activeRows}
        bottleRows={bottleRows}
        averageRows={averageRows}
        insight={insight}
        onRefresh={onRefresh}
        refreshing={refreshing}
        mobileSection={mobileSection}
        setMobileSection={setMobileSection}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '24px' }}>
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{
            color: 'var(--text-primary)',
            fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
            fontWeight: 900,
            letterSpacing: '0',
            marginBottom: '8px',
          }}>
            SÁBADOS CUSQUEÑA
          </h2>
          <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 500 }}>
            {formatTitleDate(currentSaturday)}
            <span style={{ color: 'var(--glass-border)', margin: '0 14px' }}>|</span>
            Comparado vs {formatTitleDate(comparisonSaturday)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 8px 24px var(--panel-shadow)',
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Comparar contra:
            </span>
            <select
              value={selectedComparisonDate || comparisonOptions[0] || ''}
              onChange={(event) => setSelectedComparisonDate(event.target.value)}
              disabled={comparisonOptions.length === 0}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 800,
                outline: 'none',
                minWidth: '170px',
              }}
            >
              {comparisonOptions.map(dateStr => (
                <option key={dateStr} value={dateStr}>{formatComparisonDate(dateStr)}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-gold"
            onClick={onRefresh}
            disabled={refreshing}
            style={{ minHeight: '46px', borderRadius: '8px' }}
          >
            {refreshing ? <div className="loader"></div> : <RefreshCcw size={18} />}
            Actualizar datos
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <SummaryCard
          icon={Users}
          title="CLIENTES ACTIVOS"
          value={formatNumber(totals.active)}
          sameHourDelta={totals.vsSabActiveDeltaSameHour}
          sameHourPct={totals.vsSabActivePctSameHour}
          closeDelta={totals.vsSabActiveDelta}
          closePct={totals.vsSabActivePct}
        />
        <SummaryCard
          icon={Package}
          title="BOTELLAS REGALADAS"
          value={formatNumber(totals.totalRedemptions)}
          sameHourDelta={totals.vsSabDeltaSameHour}
          sameHourPct={totals.vsSabPctSameHour}
          closeDelta={totals.vsSabDelta}
          closePct={totals.vsSabPct}
        />
        <SummaryCard
          icon={User}
          title="BOTELLAS POR CLIENTE ACTIVO"
          value={totals.avgPerActive}
          sameHourDelta={totals.vsSabAvgDeltaSameHour}
          sameHourPct={totals.vsSabAvgPctSameHour}
          closeDelta={totals.vsSabAvgDelta}
          closePct={totals.vsSabAvgPct}
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
        <ClientsTable rows={activeRows} total={totals} />
        <BottlesTable rows={bottleRows} total={totals} />
        <AverageTable rows={averageRows} total={totals} />
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} /> MH: Misma hora del sábado anterior
        </span>
        <span style={{ color: 'var(--glass-border)' }}>|</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Flag size={16} /> Cierre: Cierre final del sábado anterior
        </span>
      </div>

      <section style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '18px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        boxShadow: '0 8px 24px var(--panel-shadow)',
      }}>
        <Star size={24} color="var(--cusquena-gold)" />
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '0.95rem', marginBottom: '8px' }}>
            INSIGHT CLAVE
          </h3>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{insight}</p>
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, title, value, sameHourDelta, sameHourPct, closeDelta, closePct }) => (
  <article style={{
    background: 'var(--surface-raised)',
    border: '1px solid var(--glass-border)',
    borderTop: '3px solid #f4cd12',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 8px 24px var(--panel-shadow)',
  }}>
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '20px', alignItems: 'center' }}>
      <div style={{
        width: '58px',
        height: '58px',
        border: '2px solid #f4cd12',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)',
      }}>
        <Icon size={28} />
      </div>
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '0.9rem', marginBottom: '6px' }}>{title}</p>
        <p style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '2.6rem', lineHeight: 1 }}>{value}</p>
      </div>
    </div>

    <div style={{ height: '1px', background: 'var(--glass-border)', margin: '22px 0 16px' }} />

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <DeltaBlock icon={Clock} label="VS MISMA HORA" delta={sameHourDelta} pct={sameHourPct} />
      <DeltaBlock icon={Flag} label="VS CIERRE SÁBADO ANTERIOR" delta={closeDelta} pct={closePct} divider />
    </div>
  </article>
);

const DeltaBlock = ({ icon: Icon, label, delta, pct, divider = false }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderLeft: divider ? '1px solid var(--glass-border)' : 'none',
    paddingLeft: divider ? '16px' : 0,
    minWidth: 0,
  }}>
    <Icon size={20} color="var(--text-secondary)" />
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 900, marginBottom: '4px' }}>{label}</p>
      <p style={{ color: deltaColor(delta), fontWeight: 900, fontSize: '1.1rem' }}>
        {trendSymbol(delta)} {formatDeltaPercent(pct)}
      </p>
    </div>
  </div>
);

const TableCard = ({ icon: Icon, title, children }) => (
  <article style={{
    background: 'var(--surface-raised)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px var(--panel-shadow)',
  }}>
    <div style={{ padding: '18px 18px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Icon size={24} color="#f4cd12" />
      <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 900 }}>{title}</h3>
    </div>
    <div style={{ overflowX: 'auto' }}>{children}</div>
  </article>
);

const thStyle = {
  color: 'var(--text-primary)',
  fontWeight: 900,
  fontSize: '0.72rem',
  textAlign: 'left',
  padding: '14px',
  borderBottom: '1px solid var(--glass-border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  padding: '14px',
  borderBottom: '1px solid var(--glass-border)',
  verticalAlign: 'middle',
};

const totalRowStyle = {
  background: 'rgba(244, 205, 18, 0.10)',
  fontWeight: 900,
};

const ProgressBar = ({ value }) => (
  <div style={{
    width: '66px',
    height: '10px',
    background: 'var(--surface-muted)',
    borderRadius: '999px',
    overflow: 'hidden',
    boxShadow: 'inset 0 0 0 1px var(--glass-border)',
  }}>
    <div style={{
      width: `${Math.max(0, Math.min(100, toNumber(value)))}%`,
      height: '100%',
      background: '#f4cd12',
      borderRadius: '999px',
    }} />
  </div>
);

const DeltaCell = ({ delta, pct }) => (
  <span style={{ color: deltaColor(delta), fontWeight: 800, whiteSpace: 'nowrap' }}>
    {formatDeltaPercent(pct)}
  </span>
);

const MobileSaturdayLayout = ({
  currentSaturday,
  comparisonSaturday,
  comparisonOptions,
  selectedComparisonDate,
  setSelectedComparisonDate,
  totals,
  activeRows,
  bottleRows,
  averageRows,
  insight,
  onRefresh,
  refreshing,
  mobileSection,
  setMobileSection,
}) => {
  const sectionMap = {
    clients: {
      label: 'Clientes',
      title: 'Clientes por Dirección',
      rows: activeRows,
      total: totals,
      type: 'clients',
    },
    bottles: {
      label: 'Botellas',
      title: 'Botellas por Dirección',
      rows: bottleRows,
      total: totals,
      type: 'bottles',
    },
    average: {
      label: 'Promedio',
      title: 'Botellas por cliente activo',
      rows: averageRows,
      total: totals,
      type: 'average',
    },
  };
  const activeSection = sectionMap[mobileSection] || sectionMap.clients;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '18px' }}>
      <section style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 6px 18px var(--panel-shadow)',
      }}>
        <h2 style={{
          color: 'var(--text-primary)',
          fontSize: '1.45rem',
          fontWeight: 700,
          letterSpacing: '0',
          marginBottom: '6px',
        }}>
          Sábados Cusqueña
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.4, marginBottom: '14px' }}>
          {formatTitleDate(currentSaturday)} · Comparado vs {formatTitleDate(comparisonSaturday)}
        </p>

        <div style={{ display: 'grid', gap: '10px' }}>
          <label style={{
            display: 'grid',
            gap: '6px',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}>
            Comparar contra
            <select
              value={selectedComparisonDate || comparisonOptions[0] || ''}
              onChange={(event) => setSelectedComparisonDate(event.target.value)}
              disabled={comparisonOptions.length === 0}
              style={{
                width: '100%',
                background: 'var(--select-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'var(--select-text)',
                padding: '10px 12px',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              {comparisonOptions.map(dateStr => (
                <option key={dateStr} value={dateStr}>{formatComparisonDate(dateStr)}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-gold"
            onClick={onRefresh}
            disabled={refreshing}
            style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', padding: '11px 14px', fontWeight: 650 }}
          >
            {refreshing ? <div className="loader"></div> : <RefreshCcw size={17} />}
            Actualizar datos
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '10px' }}>
        <MobileKpiCard
          icon={Users}
          title="Clientes activos"
          value={formatNumber(totals.active)}
          helper={`${formatPercent(totals.activePct)} de la base`}
          sameHourDelta={totals.vsSabActiveDeltaSameHour}
          sameHourPct={totals.vsSabActivePctSameHour}
          closeDelta={totals.vsSabActiveDelta}
          closePct={totals.vsSabActivePct}
        />
        <MobileKpiCard
          icon={Package}
          title="Botellas regaladas"
          value={formatNumber(totals.totalRedemptions)}
          helper="Canjes del sábado actual"
          sameHourDelta={totals.vsSabDeltaSameHour}
          sameHourPct={totals.vsSabPctSameHour}
          closeDelta={totals.vsSabDelta}
          closePct={totals.vsSabPct}
        />
        <MobileKpiCard
          icon={User}
          title="Botellas por cliente activo"
          value={totals.avgPerActive}
          helper="Promedio sobre clientes activos"
          sameHourDelta={totals.vsSabAvgDeltaSameHour}
          sameHourPct={totals.vsSabAvgPctSameHour}
          closeDelta={totals.vsSabAvgDelta}
          closePct={totals.vsSabAvgPct}
        />
      </section>

      <section style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 6px 18px var(--panel-shadow)',
      }}>
        <div style={{ padding: '14px 14px 10px' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: '1rem', marginBottom: '10px' }}>
            {activeSection.title}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            background: 'var(--surface-muted)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '4px',
          }}>
            {Object.entries(sectionMap).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMobileSection(key)}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 4px',
                  background: mobileSection === key ? 'var(--surface-raised)' : 'transparent',
                  color: mobileSection === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: mobileSection === key ? 650 : 500,
                  boxShadow: mobileSection === key ? '0 2px 8px var(--panel-shadow)' : 'none',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <MobileDirectionList rows={activeSection.rows} total={activeSection.total} type={activeSection.type} />
      </section>

      <section style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '14px',
        display: 'flex',
        gap: '10px',
        boxShadow: '0 6px 18px var(--panel-shadow)',
      }}>
        <Star size={19} color="var(--cusquena-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: '0.88rem', marginBottom: '4px' }}>
            Insight clave
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>{insight}</p>
        </div>
      </section>
    </div>
  );
};

const MobileKpiCard = ({ icon: Icon, title, value, helper, sameHourDelta, sameHourPct, closeDelta, closePct }) => (
  <article style={{
    background: 'var(--surface-raised)',
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    padding: '14px',
    boxShadow: '0 6px 18px var(--panel-shadow)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: 'rgba(244, 205, 18, 0.14)',
        color: 'var(--cusquena-gold)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={21} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '2px' }}>{title}</p>
        <p style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{value}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '4px' }}>{helper}</p>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
      <MobileDeltaPill label="Misma hora" delta={sameHourDelta} pct={sameHourPct} />
      <MobileDeltaPill label="Cierre" delta={closeDelta} pct={closePct} />
    </div>
  </article>
);

const MobileDeltaPill = ({ label, delta, pct }) => (
  <div style={{
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '8px',
    background: 'var(--subtle-surface)',
  }}>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 500, marginBottom: '3px' }}>{label}</p>
    <p style={{ color: deltaColor(delta), fontSize: '0.92rem', fontWeight: 650 }}>
      {trendSymbol(delta)} {formatDeltaPercent(pct)}
    </p>
  </div>
);

const MobileDirectionList = ({ rows, total, type }) => (
  <div>
    {rows.map(row => (
      <MobileDirectionRow key={row.name} row={row} type={type} />
    ))}
    <MobileDirectionRow row={{ name: 'Total', ...total }} type={type} isTotal />
  </div>
);

const getMobileDirectionMetrics = (row, type) => {
  if (type === 'clients') {
    return {
      value: formatNumber(row.active),
      helper: `${formatPercent(row.activePct)} activos`,
      progress: row.activePct,
      sameDelta: row.vsSabActiveDeltaSameHour,
      samePct: row.vsSabActivePctSameHour,
      closeDelta: row.vsSabActiveDelta,
      closePct: row.vsSabActivePct,
    };
  }

  if (type === 'bottles') {
    return {
      value: formatNumber(row.totalRedemptions),
      helper: 'botellas',
      sameDelta: row.vsSabDeltaSameHour,
      samePct: row.vsSabPctSameHour,
      closeDelta: row.vsSabDelta,
      closePct: row.vsSabPct,
    };
  }

  return {
    value: row.avgPerActive,
    helper: 'por cliente activo',
    sameDelta: row.vsSabAvgDeltaSameHour,
    samePct: row.vsSabAvgPctSameHour,
    closeDelta: row.vsSabAvgDelta,
    closePct: row.vsSabAvgPct,
  };
};

const MobileDirectionRow = ({ row, type, isTotal = false }) => {
  const metrics = getMobileDirectionMetrics(row, type);

  return (
    <div style={{
      borderTop: '1px solid var(--glass-border)',
      background: isTotal ? 'rgba(244, 205, 18, 0.10)' : 'transparent',
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: isTotal ? 700 : 600, fontSize: '0.92rem', lineHeight: 1.25 }}>
            {row.name}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: '3px' }}>
            {metrics.helper}
          </p>
        </div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem', lineHeight: 1, whiteSpace: 'nowrap' }}>
          {metrics.value}
        </p>
      </div>

      {metrics.progress !== undefined && (
        <div style={{ marginTop: '9px' }}>
          <MobileProgressBar value={metrics.progress} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
        <MobileDeltaPill label="Misma hora" delta={metrics.sameDelta} pct={metrics.samePct} />
        <MobileDeltaPill label="Cierre" delta={metrics.closeDelta} pct={metrics.closePct} />
      </div>
    </div>
  );
};

const MobileProgressBar = ({ value }) => (
  <div style={{
    width: '100%',
    height: '8px',
    background: 'var(--surface-muted)',
    borderRadius: '999px',
    overflow: 'hidden',
  }}>
    <div style={{
      width: `${Math.max(0, Math.min(100, toNumber(value)))}%`,
      height: '100%',
      background: '#f4cd12',
      borderRadius: '999px',
    }} />
  </div>
);

const ClientsTable = ({ rows, total }) => (
  <TableCard icon={Users} title="CLIENTES">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
      <thead>
        <tr>
          <th style={thStyle}>DIRECCIÓN</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>ACTIVOS</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>% ACTIVOS</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS MISMA HORA</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS CIERRE SÁB. ANTERIOR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.name}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{row.name}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.active)}</td>
            <td style={{ ...tdStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800 }}>{formatPercent(row.activePct)}</span>
                <ProgressBar value={row.activePct} />
              </div>
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabActiveDeltaSameHour} pct={row.vsSabActivePctSameHour} /></td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabActiveDelta} pct={row.vsSabActivePct} /></td>
          </tr>
        ))}
        <tr style={totalRowStyle}>
          <td style={{ ...tdStyle, fontWeight: 900 }}>TOTAL</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 900 }}>{formatNumber(total.active)}</td>
          <td style={{ ...tdStyle, fontWeight: 900 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span>{formatPercent(total.activePct)}</span>
              <ProgressBar value={total.activePct} />
            </div>
          </td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabActiveDeltaSameHour} pct={total.vsSabActivePctSameHour} /></td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabActiveDelta} pct={total.vsSabActivePct} /></td>
        </tr>
      </tbody>
    </table>
  </TableCard>
);

const BottlesTable = ({ rows, total }) => (
  <TableCard icon={Package} title="BOTELLAS REGALADAS">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px' }}>
      <thead>
        <tr>
          <th style={thStyle}>DIRECCIÓN</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>BOTELLAS</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS MISMA HORA</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS CIERRE SÁB. ANTERIOR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.name}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{row.name}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.totalRedemptions)}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabDeltaSameHour} pct={row.vsSabPctSameHour} /></td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabDelta} pct={row.vsSabPct} /></td>
          </tr>
        ))}
        <tr style={totalRowStyle}>
          <td style={{ ...tdStyle, fontWeight: 900 }}>TOTAL</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 900 }}>{formatNumber(total.totalRedemptions)}</td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabDeltaSameHour} pct={total.vsSabPctSameHour} /></td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabDelta} pct={total.vsSabPct} /></td>
        </tr>
      </tbody>
    </table>
  </TableCard>
);

const AverageTable = ({ rows, total }) => (
  <TableCard icon={User} title="BOTELLAS POR CLIENTE ACTIVO">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px' }}>
      <thead>
        <tr>
          <th style={thStyle}>DIRECCIÓN</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>PROMEDIO</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS MISMA HORA</th>
          <th style={{ ...thStyle, textAlign: 'center' }}>VS CIERRE SÁB. ANTERIOR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.name}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{row.name}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{row.avgPerActive}</td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabAvgDeltaSameHour} pct={row.vsSabAvgPctSameHour} /></td>
            <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={row.vsSabAvgDelta} pct={row.vsSabAvgPct} /></td>
          </tr>
        ))}
        <tr style={totalRowStyle}>
          <td style={{ ...tdStyle, fontWeight: 900 }}>TOTAL</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 900 }}>{total.avgPerActive}</td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabAvgDeltaSameHour} pct={total.vsSabAvgPctSameHour} /></td>
          <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaCell delta={total.vsSabAvgDelta} pct={total.vsSabAvgPct} /></td>
        </tr>
      </tbody>
    </table>
  </TableCard>
);

export default SaturdayUpdateView;
