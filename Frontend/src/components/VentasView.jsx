import { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Search, ArrowUpDown, TrendingUp, Inbox, Download, Lock, Key, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const VentasView = ({ storedCreds, setStoredCreds }) => {
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'CAJAS', direction: 'desc' });
  const [filters, setFilters] = useState({
    direccion: 'All',
    gerencia: 'All',
    supervisor: 'All',
    BDR: 'All',
    Ola: 'All',
  });

  // Custom Form Login States
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isAuthenticated = !!storedCreds;

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchSales = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/ventas'), {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${storedCreds}`
          }
        });
        if (response.status === 401) {
          setError('Sesión expirada o credenciales inválidas. Por favor inicie sesión nuevamente.');
          sessionStorage.removeItem('ventas_creds');
          setStoredCreds('');
          setLoading(false);
          return;
        }
        if (!response.ok) {
          throw new Error('Error al cargar datos de ventas.');
        }
        const data = await response.json();
        setSalesData(data);
      } catch (err) {
        setError(err.message || 'Error de conexión.');
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [isAuthenticated, storedCreds]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
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
        headers: {
          'Authorization': `Basic ${base64Creds}`
        }
      });

      if (response.status === 401) {
        setLoginError('Usuario o contraseña incorrectos.');
        setSubmittingLogin(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Error al conectar con el servidor.');
      }

      const data = await response.json();
      sessionStorage.setItem('ventas_creds', base64Creds);
      setSalesData(data);
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
    setUsernameInput('');
    setPasswordInput('');
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getFilterOptions = (key) => {
    return Array.from(new Set(salesData.map(c => c[key]).filter(Boolean))).sort();
  };

  // Sort and filter logic
  const filteredAndSortedData = useMemo(() => {
    let result = [...salesData];

    // Search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        String(c.cliente_id).toLowerCase().includes(term) ||
        String(c.nombre_comercial).toLowerCase().includes(term)
      );
    }

    // Dropdown filters
    Object.keys(filters).forEach(key => {
      if (filters[key] !== 'All') {
        result = result.filter(c => String(c[key]) === String(filters[key]));
      }
    });

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [salesData, searchTerm, filters, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    if (filteredAndSortedData.length === 0) return { totalClients: 0, totalCajas: 0, totalBeer: 0, totalCsq: 0 };
    const totalClients = filteredAndSortedData.length;
    const totalCajas = filteredAndSortedData.reduce((acc, c) => acc + (c.CAJAS || 0), 0);
    const totalBeer = filteredAndSortedData.reduce((acc, c) => acc + (c['BEER LM'] || 0), 0);
    const totalCsq = filteredAndSortedData.reduce((acc, c) => acc + (c['CSQ LM'] || 0), 0);

    return {
      totalClients,
      totalCajas,
      totalBeer: totalBeer.toFixed(2),
      totalCsq: totalCsq.toFixed(2),
    };
  }, [filteredAndSortedData]);

  // Excel Export
  const downloadReport = () => {
    const wb = XLSX.utils.book_new();
    const rows = filteredAndSortedData.map(d => ({
      'Código de Cliente': d.cliente_id,
      'Cliente': d.nombre_comercial,
      'Dirección': d.direccion,
      'Gerencia': d.gerencia,
      'Supervisor': d.supervisor,
      'BDR': d.BDR,
      'Ola': d.Ola,
      'Beer LM (MTD)': d['BEER LM'] || 0,
      'CSQ LM (MTD)': d['CSQ LM'] || 0,
      'Cajas': d.CAJAS || 0,
      'Nolo LM (MTD)': d['NOLO LM'] || 0,
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Ventas');
    XLSX.writeFile(wb, 'Reporte_Ventas_Seguras.xlsx');
  };

  // 1. Render Login Screen if not authenticated
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
                  onChange={(e) => setUsernameInput(e.target.value)}
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
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
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

            <button type="submit" className="btn-gold w-full mt-2" style={{ height: '42px' }} disabled={submittingLogin}>
              {submittingLogin ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="loader" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid var(--text-dark)' }}></div>
                  Validando...
                </div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Render Main Sales Page if authenticated
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full p-4 p-lg-6">
      {/* Title block */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="header-icon bg-gold-gradient p-2 rounded-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={28} className="text-dark" />
          </div>
          <div>
            <h2 className="text-gold text-2xl font-bold font-display uppercase tracking-wider">Desempeño de Ventas</h2>
            <p className="text-secondary text-sm">Vista confidencial de volumen y cajas vendidas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {salesData.length > 0 && (
            <button onClick={downloadReport} className="btn-gold flex items-center gap-2">
              <Download size={18} />
              Exportar Excel
            </button>
          )}
          <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 border-red-hover" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-6 mb-6 animate-fade-in flex items-center gap-4 border-red" style={{ borderColor: 'var(--cusquena-red)' }}>
          <ShieldCheck className="text-red" size={24} />
          <p className="text-red font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-8 animate-fade-in flex flex-col items-center gap-4 justify-center" style={{ minHeight: '300px' }}>
          <div className="loader"></div>
          <p className="text-gold font-medium">Cargando datos sensibles de ventas...</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 w-full gap-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-4 gap-4 flex-shrink-0">
            <div className="glass-panel card-metric p-4 p-lg-5 text-center flex flex-col items-center justify-center">
              <span className="text-secondary text-xs uppercase tracking-wider font-semibold">Total Locales</span>
              <span className="text-gold text-2xl font-bold mt-2">{metrics.totalClients}</span>
            </div>
            <div className="glass-panel card-metric p-4 p-lg-5 text-center flex flex-col items-center justify-center">
              <span className="text-secondary text-xs uppercase tracking-wider font-semibold">Volumen Total Beer (MTD)</span>
              <span className="text-gold text-2xl font-bold mt-2">{metrics.totalBeer} HL</span>
            </div>
            <div className="glass-panel card-metric p-4 p-lg-5 text-center flex flex-col items-center justify-center">
              <span className="text-secondary text-xs uppercase tracking-wider font-semibold">Cusqueña (MTD)</span>
              <span className="text-gold text-2xl font-bold mt-2">{metrics.totalCsq} HL</span>
            </div>
            <div className="glass-panel card-metric p-4 p-lg-5 text-center flex flex-col items-center justify-center">
              <span className="text-secondary text-xs uppercase tracking-wider font-semibold">Total Cajas</span>
              <span className="text-gold text-2xl font-bold mt-2">{metrics.totalCajas}</span>
            </div>
          </div>

          {/* Filters Card */}
          <div className="glass-panel p-4 flex flex-col gap-4 flex-shrink-0">
            <div className="flex flex-col flex-md-row gap-4 items-end">
              {/* Search bar */}
              <div className="flex flex-col gap-2 flex-1 w-full">
                <label className="text-secondary text-xs font-semibold uppercase tracking-wider">Buscar Cliente</label>
                <div className="position-relative" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="filter-select w-full"
                    style={{ paddingLeft: '38px' }}
                    placeholder="Código o nombre de cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search size={18} className="text-secondary" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              {/* Reset button */}
              <button
                className="btn-secondary flex-shrink-0"
                style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ direccion: 'All', gerencia: 'All', supervisor: 'All', BDR: 'All', Ola: 'All' });
                }}
              >
                Resetear Filtros
              </button>
            </div>

            {/* Dropdowns Filters Grid */}
            <div className="grid grid-cols-2 grid-cols-md-3 grid-cols-lg-5 gap-3">
              {['direccion', 'gerencia', 'supervisor', 'BDR', 'Ola'].map(key => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-secondary text-2xs uppercase tracking-wider font-bold">
                    {key === 'direccion' ? 'Dirección' : key === 'Ola' ? 'Ola/Wave' : key}
                  </label>
                  <select
                    className="filter-select text-xs"
                    value={filters[key]}
                    onChange={(e) => handleFilterChange(key, e.target.value)}
                  >
                    <option value="All">Todos</option>
                    {getFilterOptions(key).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Table Card */}
          <div className="glass-panel flex-1 min-h-0 flex flex-col" style={{ padding: '0px', overflow: 'hidden' }}>
            <div className="flex-1 overflow-auto custom-scrollbar" style={{ maxHeight: '600px' }}>
              {filteredAndSortedData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-secondary gap-3" style={{ minHeight: '200px' }}>
                  <Inbox size={48} className="opacity-40 text-gold" />
                  <p className="font-semibold text-lg">No se encontraron registros</p>
                  <p className="text-sm">Pruebe ajustando el buscador o los filtros</p>
                </div>
              ) : (
                <table className="gemini-table w-full">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th onClick={() => requestSort('cliente_id')} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-1.5">Código <ArrowUpDown size={14} /></div>
                      </th>
                      <th onClick={() => requestSort('nombre_comercial')} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-1.5">Cliente <ArrowUpDown size={14} /></div>
                      </th>
                      <th>Dirección</th>
                      <th>Gerencia</th>
                      <th>Supervisor</th>
                      <th>BDR</th>
                      <th onClick={() => requestSort('Ola')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                        <div className="flex items-center gap-1.5 justify-center">Ola <ArrowUpDown size={14} /></div>
                      </th>
                      <th onClick={() => requestSort('BEER LM')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        <div className="flex items-center gap-1.5 justify-end">Beer LM <ArrowUpDown size={14} /></div>
                      </th>
                      <th onClick={() => requestSort('CSQ LM')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        <div className="flex items-center gap-1.5 justify-end">CSQ LM <ArrowUpDown size={14} /></div>
                      </th>
                      <th onClick={() => requestSort('CAJAS')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        <div className="flex items-center gap-1.5 justify-end">Cajas <ArrowUpDown size={14} /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedData.map(d => (
                      <tr key={d.cliente_id}>
                        <td className="font-mono text-xs">{d.cliente_id}</td>
                        <td className="font-bold text-gold">{d.nombre_comercial}</td>
                        <td>{d.direccion || 'N/A'}</td>
                        <td>{d.gerencia || 'N/A'}</td>
                        <td>{d.supervisor || 'N/A'}</td>
                        <td>{d.BDR || 'N/A'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge-ola wave-${d.Ola || 1}`}>Ola {d.Ola || 1}</span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-mono font-bold">{(d['BEER LM'] || 0).toFixed(2)} HL</td>
                        <td style={{ textAlign: 'right' }} className="font-mono text-gold font-bold">{(d['CSQ LM'] || 0).toFixed(2)} HL</td>
                        <td style={{ textAlign: 'right' }} className="font-mono font-bold text-gold font-display" style={{ color: 'var(--cusquena-gold)', fontSize: '1.05rem' }}>{d.CAJAS || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sticky Table Footer */}
            {filteredAndSortedData.length > 0 && (
              <div 
                className="flex justify-between items-center p-3 border-t border-gold border-opacity-10 text-xs text-secondary font-semibold"
                style={{ backgroundColor: 'rgba(23, 23, 23, 0.9)', backdropFilter: 'blur(10px)' }}
              >
                <span>Mostrando {filteredAndSortedData.length} de {salesData.length} locales</span>
                <span className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-gold" />
                  Suma de Cajas: <strong className="text-gold font-display" style={{ fontSize: '1.05rem' }}>{metrics.totalCajas}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasView;
