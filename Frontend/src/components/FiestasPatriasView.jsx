import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Flag, RefreshCcw, TrendingUp, Users } from 'lucide-react';

const FILTER_KEYS = ['direccion', 'gerencia', 'supervisor', 'BDR'];
const FILTER_LABELS = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
};
const EMPTY_FILTERS = {
  direccion: 'All',
  gerencia: 'All',
  supervisor: 'All',
  BDR: 'All',
};
const METRIC_CONFIG = {
  activeClients: {
    label: 'Clientes',
    title: 'Clientes activos',
    helper: 'clientes con canjes',
    decimals: 0,
  },
  totalRedemptions: {
    label: 'Canjes',
    title: 'Canjes totales',
    helper: 'redenciones',
    decimals: 0,
  },
  average: {
    label: 'Promedio',
    title: 'Promedio por activo',
    helper: 'canjes por cliente activo',
    decimals: 1,
  },
};

const normalizeDateKey = (dateStr) => {
  const parts = String(dateStr || '').split('/');
  if (parts.length !== 3) return String(dateStr || '');
  const [day, month, year] = parts;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const inferEventYear = (clients) => {
  const years = [];
  clients.forEach((client) => {
    (client.redemption_dates || []).forEach((dateStr) => {
      const [day, month, year] = normalizeDateKey(dateStr).split('/').map(Number);
      if ((day === 28 || day === 29) && month === 7 && Number.isFinite(year)) {
        years.push(year);
      }
    });
  });
  return years.length > 0
    ? Math.max(new Date().getFullYear(), ...years)
    : new Date().getFullYear();
};

const countRedemptions = (client, targetDate) => (
  (client.redemption_dates || []).reduce(
    (total, dateStr) => total + (normalizeDateKey(dateStr) === targetDate ? 1 : 0),
    0,
  )
);

const calculateMetrics = (clients, targetDate) => {
  let activeClients = 0;
  let totalRedemptions = 0;

  clients.forEach((client) => {
    const redemptions = countRedemptions(client, targetDate);
    totalRedemptions += redemptions;
    if (redemptions > 0) activeClients += 1;
  });

  return {
    activeClients,
    totalRedemptions,
    average: activeClients > 0 ? totalRedemptions / activeClients : 0,
  };
};

const buildGroupRows = (clients, groupKey, currentDate, comparisonDate) => {
  const groups = new Map();
  clients.forEach((client) => {
    const name = client[groupKey] || `Sin ${FILTER_LABELS[groupKey]}`;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(client);
  });

  return [...groups.entries()]
    .map(([name, groupClients]) => ({
      name,
      current: calculateMetrics(groupClients, currentDate),
      comparison: comparisonDate ? calculateMetrics(groupClients, comparisonDate) : null,
    }))
    .filter((row) => (
      row.current.totalRedemptions > 0
      || (row.comparison?.totalRedemptions || 0) > 0
    ))
    .sort((a, b) => (
      b.current.totalRedemptions - a.current.totalRedemptions
      || b.current.activeClients - a.current.activeClients
      || a.name.localeCompare(b.name)
    ));
};

const formatNumber = (value) => Number(value || 0).toLocaleString('es-PE');
const formatAverage = (value) => Number(value || 0).toFixed(1);
const formatSignedNumber = (value) => {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)}`;
};
const formatSignedPercent = (value) => {
  if (value === null || value === undefined) return '—';
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : ''}${(numeric * 100).toFixed(1)}%`;
};
const getDeltaClass = (value) => (
  value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
);

const Delta = ({ current, previous, decimals = 0 }) => {
  const delta = Number(current || 0) - Number(previous || 0);
  const className = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  const formatted = decimals > 0 ? Math.abs(delta).toFixed(decimals) : formatNumber(Math.abs(delta));

  return (
    <span className={`fiestas-delta ${className}`}>
      {delta > 0 ? '▲' : delta < 0 ? '▼' : '●'} {delta > 0 ? '+' : delta < 0 ? '−' : ''}{formatted}
    </span>
  );
};

const KpiCard = ({ icon, label, value, note, comparison, decimals = 0 }) => (
  <div className="glass-panel fiestas-kpi-card">
    <div className="fiestas-kpi-icon">{icon}</div>
    <div className="fiestas-kpi-copy">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
    {comparison && (
      <Delta
        current={comparison.current}
        previous={comparison.previous}
        decimals={decimals}
      />
    )}
  </div>
);

const metricValue = (metrics, metricKey) => (
  METRIC_CONFIG[metricKey].decimals > 0
    ? formatAverage(metrics[metricKey])
    : formatNumber(metrics[metricKey])
);

const MetricTable = ({
  metricKey,
  groupKey,
  rows,
  currentTotal,
  comparisonTotal,
  showComparison,
  onSelect,
  selectedValue,
}) => {
  const config = METRIC_CONFIG[metricKey];

  return (
    <section className="glass-panel fiestas-performance-panel">
      <div className="fiestas-performance-header">
        <div>
          <span>Performance</span>
          <h3>{config.title}</h3>
        </div>
        <small>{rows.length} registros</small>
      </div>

      <div className="fiestas-table-wrap">
        <table className="fiestas-table fiestas-metric-table">
          <thead>
            <tr>
              <th>{FILTER_LABELS[groupKey]}</th>
              <th>Total </th>
              {showComparison && <th>Vs. 28 Jul</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showComparison ? 3 : 2} className="fiestas-empty-cell">
                  Sin datos para los filtros seleccionados.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr
                key={row.name}
                className={selectedValue === row.name ? 'selected' : ''}
                onClick={() => onSelect(groupKey, row.name)}
              >
                <td title={row.name}>{row.name}</td>
                <td><strong>{metricValue(row.current, metricKey)}</strong></td>
                {showComparison && (
                  <td>
                    <Delta
                      current={row.current[metricKey]}
                      previous={row.comparison?.[metricKey]}
                      decimals={config.decimals}
                    />
                  </td>
                )}
              </tr>
            ))}
            <tr className="fiestas-total-row">
              <td>TOTAL</td>
              <td><strong>{metricValue(currentTotal, metricKey)}</strong></td>
              {showComparison && (
                <td>
                  <Delta
                    current={currentTotal[metricKey]}
                    previous={comparisonTotal[metricKey]}
                    decimals={config.decimals}
                  />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

const DirectionSummary = ({ rows, day28Total, day29Total }) => {
  const total28 = day28Total.totalRedemptions;
  const total29 = day29Total.totalRedemptions;
  const totalBothDays = total28 + total29;
  const totalDelta = total29 - total28;
  const totalDeltaPct = total28 > 0 ? totalDelta / total28 : null;
  const leadingDirection = rows[0] || null;
  const topGrowth = rows.filter((row) => row.delta > 0).reduce((best, row) => (
    !best || row.delta > best.delta ? row : best
  ), null);
  const largestDecline = rows.filter((row) => row.delta < 0).reduce((worst, row) => (
    !worst || row.delta < worst.delta ? row : worst
  ), null);
  const leadingShare = leadingDirection && totalBothDays > 0
    ? leadingDirection.total / totalBothDays
    : 0;

  return (
    <section className="glass-panel fiestas-summary-panel">
      <div className="fiestas-summary-heading">
        <div>
          <span>Resumen ejecutivo</span>
          <h3>28 y 29 de julio por Dirección</h3>
        </div>
        <div className="fiestas-summary-total">
          <span>Total dos días</span>
          <strong>{formatNumber(totalBothDays)}</strong>
          <small>canjes</small>
        </div>
      </div>

      <div className="fiestas-summary-table-wrap">
        <table className="fiestas-summary-table">
          <thead>
            <tr>
              <th>Dirección</th>
              <th>28 Jul</th>
              <th>29 Jul</th>
              <th>Δ Canjes</th>
              <th>Δ %</th>
              <th>Total por Dirección</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="fiestas-summary-empty">Sin canjes para los filtros seleccionados.</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.name}>
                <td title={row.name}>{row.name}</td>
                <td>
                  <strong>{formatNumber(row.day28.totalRedemptions)}</strong>
                  <small>{formatNumber(row.day28.activeClients)} activos</small>
                </td>
                <td>
                  <strong>{formatNumber(row.day29.totalRedemptions)}</strong>
                  <small>{formatNumber(row.day29.activeClients)} activos</small>
                </td>
                <td><span className={`fiestas-summary-change ${getDeltaClass(row.delta)}`}>{formatSignedNumber(row.delta)}</span></td>
                <td><span className={`fiestas-summary-change ${getDeltaClass(row.deltaPct)}`}>{formatSignedPercent(row.deltaPct)}</span></td>
                <td><strong>{formatNumber(row.total)}</strong></td>
              </tr>
            ))}
            <tr className="fiestas-summary-grand-total">
              <td>TOTAL</td>
              <td>
                <strong>{formatNumber(total28)}</strong>
                <small>{formatNumber(day28Total.activeClients)} activos</small>
              </td>
              <td>
                <strong>{formatNumber(total29)}</strong>
                <small>{formatNumber(day29Total.activeClients)} activos</small>
              </td>
              <td><strong>{formatSignedNumber(totalDelta)}</strong></td>
              <td><strong>{formatSignedPercent(totalDeltaPct)}</strong></td>
              <td><strong>{formatNumber(totalBothDays)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="fiestas-summary-insights">
          <article className={getDeltaClass(totalDelta)}>
            <span>Resultado general</span>
            <strong>{formatSignedPercent(totalDeltaPct)} el 29 vs. el 28</strong>
            <p>{formatSignedNumber(totalDelta)} canjes y {formatSignedNumber(day29Total.activeClients - day28Total.activeClients)} clientes activos.</p>
          </article>
          <article className={getDeltaClass(topGrowth?.delta || 0)}>
            <span>Mayor crecimiento</span>
            <strong>{topGrowth?.name || 'Sin variación positiva'}</strong>
            <p>{topGrowth ? `${formatSignedNumber(topGrowth.delta)} canjes (${formatSignedPercent(topGrowth.deltaPct)}).` : 'Ninguna dirección aumentó sus canjes.'}</p>
          </article>
          <article className="neutral">
            <span>Mayor concentración</span>
            <strong>{leadingDirection?.name}</strong>
            <p>
              {formatSignedPercent(leadingShare).replace('+', '')} del volumen de ambos días.
              {largestDecline ? ` Mayor caída: ${largestDecline.name} (${formatSignedPercent(largestDecline.deltaPct)}).` : ' No hubo direcciones con caída.'}
            </p>
          </article>
        </div>
      )}
    </section>
  );
};

const MobilePerformance = ({
  metricKey,
  setMetricKey,
  groupKey,
  rows,
  currentTotal,
  comparisonTotal,
  showComparison,
  onSelect,
  selectedValue,
}) => {
  const config = METRIC_CONFIG[metricKey];

  return (
    <section className="glass-panel fiestas-mobile-performance">
      <div className="fiestas-performance-header">
        <div>
          <span>Performance por {FILTER_LABELS[groupKey]}</span>
          <h3>{config.title}</h3>
        </div>
        <small>{rows.length} registros</small>
      </div>

      <div className="fiestas-metric-switcher" aria-label="Seleccionar indicador">
        {Object.entries(METRIC_CONFIG).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className={metricKey === key ? 'active' : ''}
            onClick={() => setMetricKey(key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="fiestas-mobile-list">
        {rows.length === 0 ? (
          <div className="fiestas-mobile-empty">Sin datos para los filtros seleccionados.</div>
        ) : rows.map((row) => (
          <button
            type="button"
            key={row.name}
            className={`fiestas-mobile-row ${selectedValue === row.name ? 'selected' : ''}`}
            onClick={() => onSelect(groupKey, row.name)}
          >
            <div>
              <strong>{row.name}</strong>
              <span>{config.helper}</span>
            </div>
            <div className="fiestas-mobile-result">
              <strong>{metricValue(row.current, metricKey)}</strong>
              {showComparison && (
                <Delta
                  current={row.current[metricKey]}
                  previous={row.comparison?.[metricKey]}
                  decimals={config.decimals}
                />
              )}
            </div>
          </button>
        ))}
        <div className="fiestas-mobile-row total">
          <div>
            <strong>Total</strong>
            <span>{config.helper}</span>
          </div>
          <div className="fiestas-mobile-result">
            <strong>{metricValue(currentTotal, metricKey)}</strong>
            {showComparison && (
              <Delta
                current={currentTotal[metricKey]}
                previous={comparisonTotal[metricKey]}
                decimals={config.decimals}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const FiestasPatriasView = ({
  allClients = [],
  onRefresh,
  refreshing = false,
}) => {
  const eventYear = useMemo(() => inferEventYear(allClients), [allClients]);
  const dateKeys = useMemo(() => ({
    28: `28/07/${eventYear}`,
    29: `29/07/${eventYear}`,
  }), [eventYear]);
  const [selectedTab, setSelectedTab] = useState('summary');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [mobileMetric, setMobileMetric] = useState('activeClients');

  const eventCounts = useMemo(() => ({
    28: calculateMetrics(allClients, dateKeys[28]),
    29: calculateMetrics(allClients, dateKeys[29]),
  }), [allClients, dateKeys]);

  const getFilterOptions = (filterKey) => {
    const filterIndex = FILTER_KEYS.indexOf(filterKey);
    const matchingClients = allClients.filter((client) => (
      FILTER_KEYS.slice(0, filterIndex).every((key) => (
        filters[key] === 'All' || client[key] === filters[key]
      ))
    ));
    return [...new Set(
      matchingClients
        .map((client) => client[filterKey])
        .filter((value) => value && value !== 'N/A'),
    )].sort();
  };

  const filteredClients = useMemo(() => (
    allClients.filter((client) => (
      FILTER_KEYS.every((key) => filters[key] === 'All' || client[key] === filters[key])
    ))
  ), [allClients, filters]);

  const isSummaryView = selectedTab === 'summary';
  const selectedDay = isSummaryView ? '28' : selectedTab;
  const currentDate = dateKeys[selectedDay];
  const showComparison = selectedDay === '29' && eventCounts[29].totalRedemptions > 0;
  const comparisonDate = showComparison ? dateKeys[28] : null;
  const filteredDayMetrics = useMemo(() => ({
    28: calculateMetrics(filteredClients, dateKeys[28]),
    29: calculateMetrics(filteredClients, dateKeys[29]),
  }), [filteredClients, dateKeys]);
  const currentMetrics = filteredDayMetrics[selectedDay];
  const comparisonMetrics = filteredDayMetrics[28];
  const directionSummaryRows = useMemo(
    () => buildGroupRows(filteredClients, 'direccion', dateKeys[28], dateKeys[29])
      .map((row) => {
        const day28 = row.current;
        const day29 = row.comparison || calculateMetrics([], dateKeys[29]);
        const delta = day29.totalRedemptions - day28.totalRedemptions;
        return {
          name: row.name,
          day28,
          day29,
          delta,
          deltaPct: day28.totalRedemptions > 0 ? delta / day28.totalRedemptions : null,
          total: day28.totalRedemptions + day29.totalRedemptions,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    [filteredClients, dateKeys],
  );
  const activeGroupKey = filters.BDR !== 'All'
    ? 'BDR'
    : filters.supervisor !== 'All'
    ? 'BDR'
    : filters.gerencia !== 'All'
      ? 'supervisor'
      : filters.direccion !== 'All'
        ? 'gerencia'
        : 'direccion';
  const detailRows = useMemo(
    () => buildGroupRows(filteredClients, activeGroupKey, currentDate, comparisonDate),
    [filteredClients, activeGroupKey, currentDate, comparisonDate],
  );

  const handleRowSelect = (key, value) => {
    const filterIndex = FILTER_KEYS.indexOf(key);
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? 'All' : value,
      ...Object.fromEntries(
        FILTER_KEYS.slice(filterIndex + 1).map((downstreamKey) => [downstreamKey, 'All']),
      ),
    }));
  };

  const handleFilterChange = (key, value) => {
    const filterIndex = FILTER_KEYS.indexOf(key);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...Object.fromEntries(
        FILTER_KEYS.slice(filterIndex + 1).map((downstreamKey) => [downstreamKey, 'All']),
      ),
    }));
  };

  const hasCurrentData = currentMetrics.totalRedemptions > 0;

  return (
    <div className="fiestas-view animate-fade-in">
      <section className="fiestas-hero">
        <div className="fiestas-hero-title">
          <div className="fiestas-flag-icon"><Flag size={22} /></div>
          <div>
            <span>Fechas 28 y 29 de julio</span>
            <h2>Fiestas Patrias {eventYear}</h2>
            <p>Performance diario de canjes por cliente y estructura comercial.</p>
          </div>
        </div>

        <div className="fiestas-hero-actions">
          <div className="fiestas-day-switcher" aria-label="Seleccionar vista">
            <button
              type="button"
              className={isSummaryView ? 'active' : ''}
              onClick={() => setSelectedTab('summary')}
            >
              <BarChart3 size={15} />
              <span>Resumen</span>
              <small>
                {formatNumber(eventCounts[28].totalRedemptions + eventCounts[29].totalRedemptions)} canjes
              </small>
            </button>
            {['28', '29'].map((day) => (
              <button
                type="button"
                key={day}
                className={!isSummaryView && selectedDay === day ? 'active' : ''}
                onClick={() => setSelectedTab(day)}
              >
                <CalendarDays size={15} />
                <span>{day} Jul</span>
                <small>{formatNumber(eventCounts[day].totalRedemptions)} canjes</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-gold fiestas-refresh"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCcw size={16} className={refreshing ? 'fiestas-spin' : ''} />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </section>

      <div className={`fiestas-status ${showComparison || isSummaryView ? 'comparison' : ''}`}>
        <Flag size={16} />
        <span>
          {isSummaryView
            ? `Resumen consolidado del 28 y 29 de julio de ${eventYear} por Dirección.`
            : showComparison
            ? `Comparando 29 de julio contra 28 de julio de ${eventYear}.`
            : selectedDay === '28'
              ? 'Vista operativa del 28 de julio. La comparación se habilita en la vista del día 29.'
              : `Aún no hay canjes cargados para el 29 de julio de ${eventYear}.`}
        </span>
      </div>

      <section className="glass-panel fiestas-filters">
        <div className="fiestas-filter-heading">
          <div>
            <span>Segmentación</span>
            <strong>{formatNumber(filteredClients.length)} clientes en el alcance</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Borrar filtros
          </button>
        </div>
        <div className="fiestas-filter-grid">
          {FILTER_KEYS.map((key) => (
            <label key={key}>
              <span>{FILTER_LABELS[key]}</span>
              <select
                className="filter-select"
                value={filters[key]}
                onChange={(event) => handleFilterChange(key, event.target.value)}
              >
                <option value="All">Todos</option>
                {getFilterOptions(key).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {isSummaryView ? (
        <DirectionSummary
          rows={directionSummaryRows}
          day28Total={filteredDayMetrics[28]}
          day29Total={filteredDayMetrics[29]}
        />
      ) : (
        <>
          <section className="fiestas-kpi-grid">
            <KpiCard
              icon={<Users size={21} />}
              label="Clientes activos"
              value={formatNumber(currentMetrics.activeClients)}
              note="Clientes con al menos un canje"
              comparison={showComparison ? {
                current: currentMetrics.activeClients,
                previous: comparisonMetrics.activeClients,
              } : null}
            />
            <KpiCard
              icon={<Flag size={21} />}
              label="Canjes totales"
              value={formatNumber(currentMetrics.totalRedemptions)}
              note={`Redenciones del ${selectedDay} de julio`}
              comparison={showComparison ? {
                current: currentMetrics.totalRedemptions,
                previous: comparisonMetrics.totalRedemptions,
              } : null}
            />
            <KpiCard
              icon={<TrendingUp size={21} />}
              label="Promedio por activo"
              value={formatAverage(currentMetrics.average)}
              note="Canjes / clientes activos"
              comparison={showComparison ? {
                current: currentMetrics.average,
                previous: comparisonMetrics.average,
              } : null}
              decimals={1}
            />
          </section>

          {!hasCurrentData && (
            <div className="glass-panel fiestas-empty-state">
              <CalendarDays size={32} />
              <strong>Sin canjes registrados para el {selectedDay} de julio</strong>
              <p>Actualiza el reporte cuando existan redenciones para esta fecha.</p>
            </div>
          )}

          <section className="fiestas-desktop-performance">
            {Object.keys(METRIC_CONFIG).map((metricKey) => (
              <MetricTable
                key={metricKey}
                metricKey={metricKey}
                groupKey={activeGroupKey}
                rows={detailRows}
                currentTotal={currentMetrics}
                comparisonTotal={comparisonMetrics}
                showComparison={showComparison}
                onSelect={handleRowSelect}
                selectedValue={filters[activeGroupKey]}
              />
            ))}
          </section>

          <MobilePerformance
            metricKey={mobileMetric}
            setMetricKey={setMobileMetric}
            groupKey={activeGroupKey}
            rows={detailRows}
            currentTotal={currentMetrics}
            comparisonTotal={comparisonMetrics}
            showComparison={showComparison}
            onSelect={handleRowSelect}
            selectedValue={filters[activeGroupKey]}
          />
        </>
      )}
    </div>
  );
};

export default FiestasPatriasView;
