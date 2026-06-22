import { useEffect, useMemo, useState } from 'react';
import { Download, ShieldCheck, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const CATEGORIES = [
  { id: 'ADH', label: 'Adherido', short: 'adh', color: '#10b981' },
  { id: 'INT', label: 'Intermitente', short: 'int', color: '#f59e0b' },
  { id: 'NO ADH', label: 'No Adherido', short: 'no adh', color: '#ef4444' },
];

const VOLUME_METRICS = [
  { key: 'beer', title: 'VOL BEER', current: 'BEER LM', previous: 'BEER LM-1', ly: 'BEER LY', unit: 'HL' },
  { key: 'csq', title: 'VOL CSQ', current: 'CSQ LM', previous: 'CSQ LM-1', ly: 'CSQ LY', unit: 'HL' },
  { key: 'csq0', title: 'VOL CSQ 0', current: 'CSQ0 LM', previous: 'CSQ0 LM-1', ly: 'CSQ0 LY', unit: 'HL' },
  { key: 'nolo', title: 'VOL NOLO', current: 'NOLO LM', previous: 'NOLO LM-1', ly: 'NOLO LY', unit: 'HL' },
];

const MIX_METRICS = [
  { key: 'csq', title: 'MIX CSQ', current: 'CSQ LM', previous: 'CSQ LM-1', ly: 'CSQ LY' },
  { key: 'csq0', title: 'MIX CSQ 0', current: 'CSQ0 LM', previous: 'CSQ0 LM-1', ly: 'CSQ0 LY' },
  { key: 'nolo', title: 'MIX NOLO', current: 'NOLO LM', previous: 'NOLO LM-1', ly: 'NOLO LY' },
];

const defaultMetadata = {
  period: 'Mayo 2026',
  scope: 'Solo clientes incluidos en el programa',
  source_file: 'Venta_Mayo.xlsx',
};

const normalizePayload = (payload) => {
  if (Array.isArray(payload)) return { records: payload, metadata: defaultMetadata };
  return {
    records: Array.isArray(payload?.records) ? payload.records : [],
    metadata: { ...defaultMetadata, ...(payload?.metadata || {}) },
  };
};

const formatId = (value) => String(value ?? '').trim().replace(/\.0$/, '');
const num = (value) => Number(value || 0);
const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString('es-PE', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const safeRatio = (current, base) => {
  if (!base) return current > 0 ? Infinity : 0;
  return (current - base) / Math.abs(base);
};

const formatVariation = (value) => {
  if (value === Infinity) return '+nuevo';
  if (value === -Infinity) return '-nuevo';
  if (!Number.isFinite(value)) return '0.0%';
  const pct = value * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

const formatPp = (value) => {
  if (!Number.isFinite(value)) return '0.0 pp';
  const pp = value * 100;
  return `${pp > 0 ? '+' : ''}${pp.toFixed(1)} pp`;
};

const variationColor = (value) => {
  if (value === Infinity) return '#10b981';
  if (value === -Infinity) return '#ef4444';
  if (!Number.isFinite(value) || value === 0) return 'var(--text-secondary)';
  return value > 0 ? '#10b981' : '#ef4444';
};

const VolumeView = ({ allClients, storedCreds }) => {
  const [salesData, setSalesData] = useState([]);
  const [salesMeta, setSalesMeta] = useState(defaultMetadata);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storedCreds) return;

    const fetchSales = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/ventas'), {
          method: 'GET',
          headers: { Authorization: `Basic ${storedCreds}` },
        });

        if (!response.ok) throw new Error('No se pudieron cargar los datos de Venta_Mayo.');

        const { records, metadata } = normalizePayload(await response.json());
        setSalesData(records);
        setSalesMeta(metadata);
      } catch (err) {
        setError(err.message || 'Error al cargar datos de volumen.');
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [storedCreds]);

  const clientsWithCategory = useMemo(() => {
    const categoryByClient = new Map(
      (allClients || []).map((client) => [formatId(client.cliente_id), client.Tipo || 'NO ADH'])
    );

    return (salesData || []).map((record) => ({
      ...record,
      Tipo: categoryByClient.get(formatId(record.cliente_id)) || record.Tipo || 'NO ADH',
    }));
  }, [allClients, salesData]);

  const categoryGroups = useMemo(() => {
    const grouped = {};
    CATEGORIES.forEach((category) => {
      grouped[category.id] = clientsWithCategory.filter((client) => client.Tipo === category.id);
    });
    return grouped;
  }, [clientsWithCategory]);

  const baseCategoryCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach((category) => {
      counts[category.id] = (allClients || []).filter((client) => (client.Tipo || 'NO ADH') === category.id).length;
    });
    return counts;
  }, [allClients]);

  const totals = useMemo(() => {
    const totalBeer = clientsWithCategory.reduce((acc, client) => acc + num(client['BEER LM']), 0);
    const totalCsq = clientsWithCategory.reduce((acc, client) => acc + num(client['CSQ LM']), 0);
    const totalCajas = clientsWithCategory.reduce((acc, client) => acc + num(client.CAJAS), 0);
    const totalCoverage = clientsWithCategory.filter((client) => num(client['BEER LM']) > 0).length;
    const totalBaseClients = allClients?.length || clientsWithCategory.length;
    return { totalBeer, totalCsq, totalCajas, totalCoverage, totalBaseClients };
  }, [allClients, clientsWithCategory]);

  const getVolumeRow = (clients, metric) => {
    const current = clients.reduce((acc, client) => acc + num(client[metric.current]), 0);
    const previous = clients.reduce((acc, client) => acc + num(client[metric.previous]), 0);
    const ly = clients.reduce((acc, client) => acc + num(client[metric.ly]), 0);
    return {
      current,
      previous,
      ly,
      vsPrevious: safeRatio(current, previous),
      vsLy: safeRatio(current, ly),
    };
  };

  const getMixRow = (clients, metric) => {
    const beerCurrent = clients.reduce((acc, client) => acc + num(client['BEER LM']), 0);
    const beerPrevious = clients.reduce((acc, client) => acc + num(client['BEER LM-1']), 0);
    const beerLy = clients.reduce((acc, client) => acc + num(client['BEER LY']), 0);
    const currentNumerator = clients.reduce((acc, client) => acc + num(client[metric.current]), 0);
    const previousNumerator = clients.reduce((acc, client) => acc + num(client[metric.previous]), 0);
    const lyNumerator = clients.reduce((acc, client) => acc + num(client[metric.ly]), 0);

    const currentMix = beerCurrent ? currentNumerator / beerCurrent : 0;
    const previousMix = beerPrevious ? previousNumerator / beerPrevious : 0;
    const lyMix = beerLy ? lyNumerator / beerLy : 0;

    return {
      currentMix,
      previousMix,
      lyMix,
      vsPreviousPp: currentMix - previousMix,
      vsLyPp: currentMix - lyMix,
    };
  };

  const getCoverageRow = (clients, metric, baseCount = clients.length) => {
    const base = baseCount;
    const current = clients.filter((client) => num(client[metric.current]) > 0).length;
    const previous = clients.filter((client) => num(client[metric.previous]) > 0).length;
    const ly = clients.filter((client) => num(client[metric.ly]) > 0).length;
    const currentPct = base ? current / base : 0;
    const previousPct = base ? previous / base : 0;
    const lyPct = base ? ly / base : 0;

    return {
      current,
      previous,
      ly,
      currentPct,
      previousPct,
      lyPct,
      vsPreviousPp: currentPct - previousPct,
      vsLyPp: currentPct - lyPct,
    };
  };

  const downloadSummary = () => {
    const rows = [];

    CATEGORIES.forEach((category) => {
      const clients = categoryGroups[category.id] || [];
      VOLUME_METRICS.forEach((metric) => {
        const row = getVolumeRow(clients, metric);
        rows.push({
          Sección: 'Volumen',
          Categoría: category.label,
          Indicador: metric.title,
          MTD: row.current,
          'Vs LM-1': formatVariation(row.vsPrevious),
          'Vs LY': formatVariation(row.vsLy),
        });
      });
      MIX_METRICS.forEach((metric) => {
        const row = getMixRow(clients, metric);
        rows.push({
          Sección: 'Mix',
          Categoría: category.label,
          Indicador: metric.title,
          MTD: `${(row.currentMix * 100).toFixed(1)}%`,
          'Vs LM-1': formatPp(row.vsPreviousPp),
          'Vs LY': formatPp(row.vsLyPp),
        });
      });
      VOLUME_METRICS.forEach((metric) => {
        const row = getCoverageRow(clients, metric, baseCategoryCounts[category.id]);
        rows.push({
          Sección: 'Coberturas',
          Categoría: category.label,
          Indicador: metric.title,
          MTD: `${row.current} (${(row.currentPct * 100).toFixed(0)}%)`,
          'Vs LM-1': `${row.current - row.previous} (${formatPp(row.vsPreviousPp)})`,
          'Vs LY': `${row.current - row.ly} (${formatPp(row.vsLyPp)})`,
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Resumen Volumen');
    XLSX.writeFile(wb, 'Resumen_Volumen_por_Adherencia.xlsx');
  };

  if (loading) {
    return (
      <div className="glass-panel volume-empty-state">
        <div className="loader" />
        <p className="text-gold">Cargando Venta_Mayo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel volume-empty-state">
        <p className="text-red" style={{ color: 'var(--cusquena-red)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="volume-canvas animate-fade-in">
      <div className="volume-header">
        <div>
          <h2>Desempeño Volumen</h2>
          <p>Resumen de Venta_Mayo agrupado por adherencia de campaña.</p>
        </div>
        <button className="btn-gold" onClick={downloadSummary} disabled={clientsWithCategory.length === 0}>
          <Download size={18} />
          Descargar Resumen
        </button>
      </div>

      <div className="volume-scope">
        <ShieldCheck size={18} />
        <span>
          Datos válidos para <strong>{salesMeta.period}</strong>. Fuente: <strong>{salesMeta.source_file}</strong>.
          Agrupación tomada de las reglas de <strong>Desempeño Campaña</strong>.
        </span>
      </div>

      <div className="volume-overview">
        <OverviewCard title="Clientes con venta" value={formatNumber(clientsWithCategory.length)} detail="Clientes del programa con registro en Venta_Mayo" />
        <OverviewCard title="Vol Beer" value={`${formatNumber(totals.totalBeer, 1)} HL`} detail="Suma BEER LM" />
        <OverviewCard title="Vol CSQ" value={`${formatNumber(totals.totalCsq, 1)} HL`} detail="Suma CSQ LM" />
        <OverviewCard title="Cajas CSQ0" value={formatNumber(totals.totalCajas)} detail="Base del ranking de Mozos" />
        <OverviewCard title="Cobertura Beer" value={`${formatNumber(totals.totalCoverage)} (${totals.totalBaseClients ? ((totals.totalCoverage / totals.totalBaseClients) * 100).toFixed(0) : 0}%)`} detail="Clientes con BEER LM > 0 sobre Base Final" />
      </div>

      <VolumeSection title="VOLUMEN">
        {VOLUME_METRICS.map((metric) => (
          <VolumeMetricCard
            key={metric.key}
            metric={metric}
            categories={CATEGORIES}
            categoryGroups={categoryGroups}
            getRow={getVolumeRow}
          />
        ))}
      </VolumeSection>

      <VolumeSection title="MIX (INDICADOR / CERVEZA) EN %" subtitle="VAR ES RESTA PP">
        {MIX_METRICS.map((metric) => (
          <MixMetricCard
            key={metric.key}
            metric={metric}
            categories={CATEGORIES}
            categoryGroups={categoryGroups}
            getRow={getMixRow}
          />
        ))}
      </VolumeSection>

      <VolumeSection title="COBERTURAS CON BASE FINAL">
        {VOLUME_METRICS.map((metric) => (
          <CoverageMetricCard
            key={metric.key}
            metric={metric}
            categories={CATEGORIES}
            categoryGroups={categoryGroups}
            baseCategoryCounts={baseCategoryCounts}
            getRow={getCoverageRow}
          />
        ))}
      </VolumeSection>
    </div>
  );
};

const OverviewCard = ({ title, value, detail }) => (
  <div className="glass-panel volume-overview-card">
    <span>{title}</span>
    <strong>{value}</strong>
    <p>{detail}</p>
  </div>
);

const VolumeSection = ({ title, subtitle, children }) => (
  <section className="volume-section">
    <div className="volume-section-title">
      <h3>{title}</h3>
      {subtitle && <span>{subtitle}</span>}
    </div>
    <div className="volume-card-grid">{children}</div>
  </section>
);

const VolumeMetricCard = ({ metric, categories, categoryGroups, getRow }) => (
  <div className="glass-panel volume-summary-card volume-card-yellow">
    <h4>{metric.title}</h4>
    <div className="volume-mini-table">
      <div className="volume-mini-head">
        <span />
        <span>HL MTD</span>
        <span>VS LM MTD</span>
        <span>VS LY MTD</span>
      </div>
      {categories.map((category) => {
        const row = getRow(categoryGroups[category.id] || [], metric);
        return (
          <div className="volume-mini-row" key={category.id}>
            <span style={{ color: category.color }}>{category.short}</span>
            <strong>{formatNumber(row.current, 1)}</strong>
            <strong style={{ color: variationColor(row.vsPrevious) }}>{formatVariation(row.vsPrevious)}</strong>
            <strong style={{ color: variationColor(row.vsLy) }}>{formatVariation(row.vsLy)}</strong>
          </div>
        );
      })}
    </div>
  </div>
);

const MixMetricCard = ({ metric, categories, categoryGroups, getRow }) => (
  <div className="glass-panel volume-summary-card volume-card-pink">
    <h4>{metric.title}</h4>
    <div className="volume-mini-table">
      <div className="volume-mini-head">
        <span />
        <span>MIX MTD</span>
        <span>VS LM MTD</span>
        <span>VS LY MTD</span>
      </div>
      {categories.map((category) => {
        const row = getRow(categoryGroups[category.id] || [], metric);
        return (
          <div className="volume-mini-row" key={category.id}>
            <span style={{ color: category.color }}>{category.short}</span>
            <strong>{(row.currentMix * 100).toFixed(1)}%</strong>
            <strong style={{ color: variationColor(row.vsPreviousPp) }}>{formatPp(row.vsPreviousPp)}</strong>
            <strong style={{ color: variationColor(row.vsLyPp) }}>{formatPp(row.vsLyPp)}</strong>
          </div>
        );
      })}
    </div>
  </div>
);

const CoverageMetricCard = ({ metric, categories, categoryGroups, baseCategoryCounts, getRow }) => (
  <div className="glass-panel volume-summary-card volume-card-pink">
    <h4>{metric.title}</h4>
    <div className="volume-mini-table">
      <div className="volume-mini-head">
        <span />
        <span>COB MTD</span>
        <span>VS LM MTD</span>
        <span>VS LY MTD</span>
      </div>
      {categories.map((category) => {
        const row = getRow(categoryGroups[category.id] || [], metric, baseCategoryCounts[category.id]);
        return (
          <div className="volume-mini-row" key={category.id}>
            <span style={{ color: category.color }}>{category.short}</span>
            <strong>{row.current} ({(row.currentPct * 100).toFixed(0)}%)</strong>
            <strong style={{ color: variationColor(row.vsPreviousPp) }}>
              {row.current - row.previous > 0 ? '+' : ''}{row.current - row.previous} ({formatPp(row.vsPreviousPp)})
            </strong>
            <strong style={{ color: variationColor(row.vsLyPp) }}>
              {row.current - row.ly > 0 ? '+' : ''}{row.current - row.ly} ({formatPp(row.vsLyPp)})
            </strong>
          </div>
        );
      })}
    </div>
  </div>
);

export default VolumeView;
