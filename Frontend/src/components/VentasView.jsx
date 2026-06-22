import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Download, Inbox, Key, Lock, LogOut, Search, ShieldCheck, TrendingUp, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const filterKeys = ['direccion', 'gerencia', 'supervisor', 'BDR', 'Ola'];
const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
  Ola: 'Ola',
};

const defaultMetadata = {
  period: 'Mayo 2026',
  scope: 'Solo clientes incluidos en el programa',
  source_file: 'Venta_Mayo.xlsx',
  filtered_to_program_clients: true,
};

const emptyFilters = {
  direccion: 'All',
  gerencia: 'All',
  supervisor: 'All',
  BDR: 'All',
  Ola: 'All',
};

const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString('es-PE', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const normalizeSalesPayload = (payload) => {
  if (Array.isArray(payload)) {
    return { records: payload, metadata: defaultMetadata };
  }

  return {
    records: Array.isArray(payload?.records) ? payload.records : [],
    metadata: { ...defaultMetadata, ...(payload?.metadata || {}) },
  };
};

const VentasView = ({ storedCreds, setStoredCreds }) => {
  const [salesData, setSalesData] = useState([]);
  const [salesMeta, setSalesMeta] = useState(defaultMetadata);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'CAJAS', direction: 'desc' });
  const [filters, setFilters] = useState(emptyFilters);

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isAuthenticated = !!storedCreds;

  const applySalesPayload = (payload) => {
    const { records, metadata } = normalizeSalesPayload(payload);
    setSalesData(records);
    setSalesMeta(metadata);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchSales = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/ventas'), {
          method: 'GET',
          headers: { Authorization: `Basic ${storedCreds}` },
        });

        if (response.status === 401) {
          setError('Sesión expirada o credenciales inválidas. Por favor inicie sesión nuevamente.');
          sessionStorage.removeItem('ventas_creds');
          setStoredCreds('');
          return;
        }

        if (!response.ok) throw new Error('Error al cargar datos de ventas.');
        applySalesPayload(await response.json());
      } catch (err) {
        setError(err.message || 'Error de conexión.');
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [isAuthenticated, setStoredCreds, storedCreds]);

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setLoginError('Por favor ingrese el usuario y la contraseña.');
      return;
    }

    setSubmittingLogin(true);
    setLoginError('');

    try {
      const base64Creds = btoa(`${usernameInput.trim()}:${passwordInput.trim()}`);
      const response = await fetch(apiUrl('/api/ventas'), {
        method: 'GET',
        headers: { Authorization: `Basic ${base64Creds}` },
      });

      if (response.status === 401) {
        setLoginError('Usuario o contraseña incorrectos.');
        return;
      }

      if (!response.ok) throw new Error('Error al conectar con el servidor.');

      applySalesPayload(await response.json());
      sessionStorage.setItem('ventas_creds', base64Creds);
      setStoredCreds(base64Creds);
    } catch (err) {
      setLoginError(err.message || 'Error de conexión.');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ventas_creds');
    setStoredCreds('');
    setSalesData([]);
    setSalesMeta(defaultMetadata);
    setSearchTerm('');
    setFilters(emptyFilters);
    setUsernameInput('');
    setPasswordInput('');
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(emptyFilters);
  };

  const getFilterOptions = (key) => {
    const base = salesData.filter((client) => (
      filterKeys.every((filterKey) => (
        filterKey === key || filters[filterKey] === 'All' || String(client[filterKey]) === String(filters[filterKey])
      ))
    ));

    return Array.from(new Set(base.map((client) => client[key]).filter((value) => value !== null && value !== undefined && value !== '')))
      .sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...salesData];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((client) => (
        String(client.cliente_id).toLowerCase().includes(term)
        || String(client.nombre_comercial).toLowerCase().includes(term)
        || String(client.BDR).toLowerCase().includes(term)
        || String(client.supervisor).toLowerCase().includes(term)
      ));
    }

    filterKeys.forEach((key) => {
      if (filters[key] !== 'All') {
        result = result.filter((client) => String(client[key]) === String(filters[key]));
      }
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valueA = a[sortConfig.key] ?? '';
        let valueB = b[sortConfig.key] ?? '';

        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();

        if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [filters, salesData, searchTerm, sortConfig]);

  const metrics = useMemo(() => {
    const totalClients = filteredAndSortedData.length;
    const totalCajas = filteredAndSortedData.reduce((acc, client) => acc + Number(client.CAJAS || 0), 0);
    const totalBeer = filteredAndSortedData.reduce((acc, client) => acc + Number(client['BEER LM'] || 0), 0);
    const totalCsq = filteredAndSortedData.reduce((acc, client) => acc + Number(client['CSQ LM'] || 0), 0);
    const avgCajas = totalClients > 0 ? totalCajas / totalClients : 0;

    return { totalClients, totalCajas, totalBeer, totalCsq, avgCajas };
  }, [filteredAndSortedData]);

  const activeFilterCount = filterKeys.filter((key) => filters[key] !== 'All').length + (searchTerm.trim() ? 1 : 0);

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const downloadReport = () => {
    const wb = XLSX.utils.book_new();
    const scopeRows = [
      { Campo: 'Periodo válido', Valor: salesMeta.period },
      { Campo: 'Alcance', Valor: salesMeta.scope },
      { Campo: 'Archivo fuente', Valor: salesMeta.source_file },
      { Campo: 'Registros exportados', Valor: filteredAndSortedData.length },
    ];
    const rows = filteredAndSortedData.map((client) => ({
      'Código de Cliente': client.cliente_id,
      Cliente: client.nombre_comercial,
      Dirección: client.direccion,
      Gerencia: client.gerencia,
      Supervisor: client.supervisor,
      BDR: client.BDR,
      Ola: client.Ola,
      'Beer LM (MTD)': client['BEER LM'] || 0,
      'CSQ LM (MTD)': client['CSQ LM'] || 0,
      Cajas: client.CAJAS || 0,
      'Nolo LM (MTD)': client['NOLO LM'] || 0,
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scopeRows), 'Alcance');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Ventas');
    XLSX.writeFile(wb, 'Reporte_Ventas_Mayo_Clientes_Programa.xlsx');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full p-4" style={{ minHeight: '80vh' }}>
        <div className="glass-panel w-full animate-fade-in" style={{ maxWidth: '420px', padding: '32px', border: '1px solid rgba(207, 160, 82, 0.3)' }}>
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="bg-gold-gradient p-3 rounded-full flex items-center justify-center" style={{ width: '64px', height: '64px' }}>
              <Lock size={30} className="text-dark" />
            </div>
            <div>
              <h2 className="text-gold text-xl font-bold font-display uppercase tracking-widest">Ingreso Autorizado</h2>
              <p className="text-secondary text-xs mt-1">El acceso a estos datos requiere credenciales de seguridad</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-secondary text-2xs uppercase tracking-wider font-semibold">Usuario</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="filter-select w-full"
                  style={{ paddingLeft: '38px', height: '42px' }}
                  placeholder="Ingrese su usuario..."
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  disabled={submittingLogin}
                />
                <Lock size={16} className="text-secondary" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-secondary text-2xs uppercase tracking-wider font-semibold">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="filter-select w-full"
                  style={{ paddingLeft: '38px', height: '42px' }}
                  placeholder="Contraseña"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  disabled={submittingLogin}
                />
                <Key size={16} className="text-secondary" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {loginError && (
              <p className="text-red text-xs font-semibold animate-fade-in" style={{ color: 'var(--cusquena-red)' }}>
                {loginError}
              </p>
            )}

            <button type="submit" className="btn-gold w-full mt-2" style={{ height: '42px', justifyContent: 'center' }} disabled={submittingLogin}>
              {submittingLogin ? 'Validando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="ventas-view animate-fade-in">
      <div className="ventas-header">
        <div className="ventas-title-block">
          <div className="ventas-title-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="ventas-title">Desempeño de Ventas</h2>
            <p className="text-secondary text-sm">Vista confidencial de volumen y cajas vendidas</p>
          </div>
        </div>

        <div className="ventas-actions">
          <button onClick={downloadReport} className="btn-gold" disabled={filteredAndSortedData.length === 0}>
            <Download size={18} />
            Descargar
          </button>
          <button onClick={handleLogout} className="btn-secondary ventas-logout">
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </div>

      <div className="ventas-scope">
        <ShieldCheck size={18} />
        <div>
          <strong>Alcance del dato:</strong> válido solo para {salesMeta.period}. La base está cruzada únicamente con clientes que están en el programa.
          <span> Fuente: {salesMeta.source_file}</span>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-6 animate-fade-in flex items-center gap-4" style={{ borderColor: 'var(--cusquena-red)' }}>
          <ShieldCheck className="text-red" size={24} />
          <p className="text-red font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-8 animate-fade-in flex flex-col items-center gap-4 justify-center" style={{ minHeight: '300px' }}>
          <div className="loader" />
          <p className="text-gold font-medium">Cargando datos sensibles de ventas...</p>
        </div>
      ) : (
        <>
          <div className="ventas-kpi-grid">
            <SalesMetricCard title="Locales del programa" value={formatNumber(metrics.totalClients)} detail={`${formatNumber(salesData.length)} locales en la base de ventas`} />
            <SalesMetricCard title="Volumen Beer MTD" value={`${formatNumber(metrics.totalBeer, 2)} HL`} detail="Ventas de mayo, acumulado MTD" />
            <SalesMetricCard title="Cusqueña MTD" value={`${formatNumber(metrics.totalCsq, 2)} HL`} detail="Solo clientes dentro del programa" />
            <SalesMetricCard title="Cajas totales" value={formatNumber(metrics.totalCajas)} detail={`${formatNumber(metrics.avgCajas, 1)} cajas promedio por local`} />
          </div>

          <div className="glass-panel ventas-controls">
            <div className="ventas-controls-header">
              <div>
                <h3 className="text-gold font-bold">Explorar locales</h3>
                <p className="text-secondary text-sm">Busca por cliente, código, supervisor o BDR; luego refina por jerarquía.</p>
              </div>
              <button className="btn-secondary" onClick={resetFilters} disabled={activeFilterCount === 0}>
                <X size={16} />
                Limpiar filtros
              </button>
            </div>

            <div className="ventas-search-row">
              <div className="ventas-search">
                <Search size={18} className="text-secondary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por código, cliente, supervisor o BDR"
                />
              </div>
              <div className="ventas-result-count">
                {formatNumber(filteredAndSortedData.length)} de {formatNumber(salesData.length)} locales
              </div>
            </div>

            <div className="ventas-filter-grid">
              {filterKeys.map((key) => (
                <label key={key} className="ventas-filter">
                  <span>{filterLabels[key]}</span>
                  <select value={filters[key]} onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}>
                    <option value="All">Todos</option>
                    {getFilterOptions(key).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="glass-panel ventas-list-panel">
            <div className="ventas-list-header">
              <div>
                <h3 className="text-white font-bold">Locales con ventas</h3>
                <p className="text-secondary text-sm">Orden actual: {filterLabels[sortConfig.key] || sortConfig.key} ({sortConfig.direction === 'desc' ? 'mayor a menor' : 'menor a mayor'})</p>
              </div>
              <span className="ventas-total-pill">
                <TrendingUp size={14} />
                {formatNumber(metrics.totalCajas)} cajas
              </span>
            </div>

            {filteredAndSortedData.length === 0 ? (
              <div className="ventas-empty">
                <Inbox size={48} />
                <p>No se encontraron registros</p>
                <span>Prueba ajustando el buscador o los filtros.</span>
              </div>
            ) : (
              <>
                <div className="ventas-table-wrap">
                  <table className="ventas-table">
                    <thead>
                      <tr>
                        <SortableHeader label="Código" sortKey="cliente_id" requestSort={requestSort} />
                        <SortableHeader label="Cliente" sortKey="nombre_comercial" requestSort={requestSort} />
                        <th>Dirección</th>
                        <th>Gerencia</th>
                        <th>Supervisor</th>
                        <th>BDR</th>
                        <SortableHeader label="Ola" sortKey="Ola" requestSort={requestSort} align="center" />
                        <SortableHeader label="Beer LM" sortKey="BEER LM" requestSort={requestSort} align="right" />
                        <SortableHeader label="CSQ LM" sortKey="CSQ LM" requestSort={requestSort} align="right" />
                        <SortableHeader label="Cajas" sortKey="CAJAS" requestSort={requestSort} align="right" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedData.map((client) => (
                        <tr key={client.cliente_id}>
                          <td className="ventas-code">{client.cliente_id}</td>
                          <td>
                            <strong className="text-gold">{client.nombre_comercial}</strong>
                          </td>
                          <td>{client.direccion || 'N/A'}</td>
                          <td>{client.gerencia || 'N/A'}</td>
                          <td>{client.supervisor || 'N/A'}</td>
                          <td>{client.BDR || 'N/A'}</td>
                          <td style={{ textAlign: 'center' }}><span className="ventas-wave">Ola {client.Ola || 1}</span></td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(client['BEER LM'], 2)} HL</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(client['CSQ LM'], 2)} HL</td>
                          <td className="ventas-cajas">{formatNumber(client.CAJAS)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ventas-card-list">
                  {filteredAndSortedData.map((client) => (
                    <div className="ventas-client-card" key={client.cliente_id}>
                      <div>
                        <span className="ventas-code">{client.cliente_id}</span>
                        <h4>{client.nombre_comercial}</h4>
                        <p>{client.direccion || 'N/A'} · {client.gerencia || 'N/A'}</p>
                      </div>
                      <div className="ventas-client-metrics">
                        <span><strong>{formatNumber(client.CAJAS)}</strong> cajas</span>
                        <span>{formatNumber(client['CSQ LM'], 2)} HL CSQ</span>
                        <span>{client.BDR || 'N/A'} · Ola {client.Ola || 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const SalesMetricCard = ({ title, value, detail }) => (
  <div className="glass-panel ventas-metric-card">
    <span>{title}</span>
    <strong>{value}</strong>
    <p>{detail}</p>
  </div>
);

const SortableHeader = ({ label, sortKey, requestSort, align = 'left' }) => (
  <th onClick={() => requestSort(sortKey)} style={{ cursor: 'pointer', textAlign: align }}>
    <span className={`ventas-sortable ventas-sortable-${align}`}>
      {label}
      <ArrowUpDown size={13} />
    </span>
  </th>
);

export default VentasView;
