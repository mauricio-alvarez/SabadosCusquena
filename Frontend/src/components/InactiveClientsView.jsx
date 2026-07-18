import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, SlidersHorizontal, UserX, X } from 'lucide-react';
import * as XLSX from 'xlsx';

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

const cleanValue = (value) => {
  const text = String(value ?? '').trim();
  return text && text.toLowerCase() !== 'nan' && text !== 'N/A' ? text : '';
};

const normalizeSearch = (value) => (
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const getClientCode = (client) => (
  client?.cliente_id ?? client?.codigo ?? client?.Cliente_ ?? ''
);

const normalizeDateKey = (dateValue) => {
  const parts = String(dateValue ?? '').split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

const dateValue = (dateKey) => {
  const [day, month, year] = normalizeDateKey(dateKey).split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
};

const isSaturday = (dateKey) => {
  const [day, month, year] = normalizeDateKey(dateKey).split('/').map(Number);
  return new Date(year, month - 1, day).getDay() === 6;
};

const todayDateKey = () => {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
};

const redemptionsOnDate = (client, targetDate) => (
  Array.isArray(client?.redemption_dates)
    ? client.redemption_dates.filter(date => normalizeDateKey(date) === targetDate).length
    : 0
);

const InactiveClientsView = ({ allClients = [], availableDates = [] }) => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [historicalSort, setHistoricalSort] = useState(null);

  const latestSaturday = useMemo(() => {
    const dates = new Set(availableDates.map(normalizeDateKey).filter(Boolean));
    const today = todayDateKey();
    if (isSaturday(today)) dates.add(today);
    allClients.forEach(client => {
      if (!Array.isArray(client.redemption_dates)) return;
      client.redemption_dates.forEach(date => {
        const normalized = normalizeDateKey(date);
        if (normalized) dates.add(normalized);
      });
    });

    return [...dates]
      .filter(isSaturday)
      .sort((a, b) => dateValue(b) - dateValue(a))[0] || '';
  }, [allClients, availableDates]);

  const inactiveClients = useMemo(() => (
    latestSaturday
      ? allClients.filter(client => redemptionsOnDate(client, latestSaturday) === 0)
      : allClients
  ), [allClients, latestSaturday]);

  const getFilterOptions = useCallback((filterKey) => {
    const values = inactiveClients
      .filter(client => FILTER_KEYS.every(key => (
        key === filterKey || filters[key] === 'All' || cleanValue(client[key]) === filters[key]
      )))
      .map(client => cleanValue(client[filterKey]))
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [filters, inactiveClients]);

  const filteredClients = useMemo(() => {
    const query = normalizeSearch(searchTerm);

    return inactiveClients
      .filter(client => FILTER_KEYS.every(key => (
        filters[key] === 'All' || cleanValue(client[key]) === filters[key]
      )))
      .filter(client => {
        if (!query) return true;
        return [
          getClientCode(client),
          client.nombre_comercial,
          client.direccion,
          client.gerencia,
          client.supervisor,
          client.BDR,
        ].some(value => normalizeSearch(value).includes(query));
      })
      .sort((a, b) => {
        if (historicalSort) {
          const redemptionDelta = (Number(a.redemptions) || 0) - (Number(b.redemptions) || 0);
          if (redemptionDelta !== 0) return historicalSort === 'asc' ? redemptionDelta : -redemptionDelta;
        }
        const directionOrder = cleanValue(a.direccion).localeCompare(cleanValue(b.direccion), 'es', { sensitivity: 'base' });
        if (directionOrder !== 0) return directionOrder;
        return cleanValue(a.nombre_comercial).localeCompare(cleanValue(b.nombre_comercial), 'es', { sensitivity: 'base' });
      });
  }, [filters, historicalSort, inactiveClients, searchTerm]);

  const filteredActiveCount = useMemo(() => {
    if (!latestSaturday) return 0;
    const query = normalizeSearch(searchTerm);

    return allClients.filter(client => {
      if (redemptionsOnDate(client, latestSaturday) === 0) return false;
      if (!FILTER_KEYS.every(key => filters[key] === 'All' || cleanValue(client[key]) === filters[key])) return false;
      if (!query) return true;

      return [
        getClientCode(client),
        client.nombre_comercial,
        client.direccion,
        client.gerencia,
        client.supervisor,
        client.BDR,
      ].some(value => normalizeSearch(value).includes(query));
    }).length;
  }, [allClients, filters, latestSaturday, searchTerm]);

  const hasFilters = searchTerm.trim() || FILTER_KEYS.some(key => filters[key] !== 'All');
  const filteredTotalCount = filteredClients.length + filteredActiveCount;
  const inactivePercentage = filteredTotalCount > 0
    ? ((filteredClients.length / filteredTotalCount) * 100).toFixed(1)
    : '0.0';

  const toggleHistoricalSort = () => {
    setHistoricalSort(previous => previous === 'desc' ? 'asc' : 'desc');
  };

  const handleFilterChange = (filterKey, value) => {
    const changedIndex = FILTER_KEYS.indexOf(filterKey);
    setFilters(previous => {
      const next = { ...previous, [filterKey]: value };
      FILTER_KEYS.slice(changedIndex + 1).forEach(key => {
        next[key] = 'All';
      });
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchTerm('');
  };

  const downloadInactiveClients = () => {
    if (filteredClients.length === 0) return;

    const rows = filteredClients.map(client => ({
      'Código Cliente': getClientCode(client),
      'Nombre Comercial': cleanValue(client.nombre_comercial),
      'Dirección': cleanValue(client.direccion),
      'Gerencia': cleanValue(client.gerencia),
      'Supervisor': cleanValue(client.supervisor),
      'BDR': cleanValue(client.BDR),
      [`Canjes Sábado ${latestSaturday}`]: redemptionsOnDate(client, latestSaturday),
      'Canjes Históricos': Number(client.redemptions) || 0,
      'Estado del Sábado': 'Sin redimir',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 34 }, { wch: 24 }, { wch: 28 },
      { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes Inactivos');
    XLSX.writeFile(workbook, 'Detalle_Clientes_Inactivos.xlsx');
  };

  return (
    <section className="inactive-view" aria-label="Búsqueda de clientes inactivos">
      <div className="inactive-toolbar glass-panel">
        <div className="inactive-filter-heading" aria-hidden="true">
          <SlidersHorizontal size={18} />
          <span>Filtros</span>
        </div>

        <div className="inactive-filter-grid">
          {FILTER_KEYS.map(filterKey => (
            <label className="inactive-filter-field" key={filterKey}>
              <span>{FILTER_LABELS[filterKey]}</span>
              <select
                className="filter-select"
                value={filters[filterKey]}
                onChange={event => handleFilterChange(filterKey, event.target.value)}
              >
                <option value="All">Todos</option>
                {getFilterOptions(filterKey).map(option => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="inactive-search-row">
          <label className="inactive-search-box">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por código, cliente, supervisor o BDR"
              aria-label="Buscar clientes inactivos"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} title="Limpiar búsqueda">
                <X size={16} />
              </button>
            )}
          </label>

          {hasFilters && (
            <button type="button" className="btn-secondary inactive-clear-button" onClick={clearFilters}>
              Borrar filtros
            </button>
          )}
        </div>
      </div>

      <div className="inactive-results glass-panel">
        <div className="inactive-results-bar">
          <div className="inactive-result-count">
            <UserX size={19} aria-hidden="true" />
            <div>
              <strong>
                {filteredClients.length.toLocaleString('es-PE')}/{filteredTotalCount.toLocaleString('es-PE')}
              </strong>
              <span> clientes sin redimir ({inactivePercentage}%)</span>
            </div>
          </div>
          <div className="inactive-saturday-status">
            <span>Sábado <strong>{latestSaturday || 'sin datos'}</strong></span>
          </div>
          <button
            type="button"
            className="btn-secondary inactive-mobile-sort"
            onClick={toggleHistoricalSort}
            title="Ordenar por canjes históricos"
          >
            {historicalSort === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            Canjes históricos
          </button>
          <button
            type="button"
            className="btn-gold inactive-download-button"
            onClick={downloadInactiveClients}
            disabled={filteredClients.length === 0}
          >
            <Download size={17} />
            Descargar lista
          </button>
        </div>

        {filteredClients.length === 0 ? (
          <div className="inactive-empty-state">
            <Search size={28} aria-hidden="true" />
            <p>No hay clientes inactivos que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <>
            <div className="inactive-table-wrap">
              <table className="inactive-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Dirección</th>
                    <th>Gerencia</th>
                    <th>Supervisor</th>
                    <th>BDR</th>
                    <th
                      className="numeric inactive-sort-header"
                      aria-sort={historicalSort === 'asc' ? 'ascending' : historicalSort === 'desc' ? 'descending' : 'none'}
                    >
                      <button type="button" onClick={toggleHistoricalSort} title="Ordenar por canjes históricos">
                        <span>Canjes históricos</span>
                        {historicalSort === 'asc' && <ArrowUp size={14} />}
                        {historicalSort === 'desc' && <ArrowDown size={14} />}
                        {!historicalSort && <ArrowUpDown size={14} />}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, index) => (
                    <tr key={`${getClientCode(client)}-${index}`}>
                      <td className="inactive-code">{getClientCode(client) || 'Sin código'}</td>
                      <td className="inactive-client-name">{cleanValue(client.nombre_comercial) || 'Sin nombre'}</td>
                      <td>{cleanValue(client.direccion) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.gerencia) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.supervisor) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.BDR) || 'Sin asignar'}</td>
                      <td className="numeric">{(Number(client.redemptions) || 0).toLocaleString('es-PE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inactive-mobile-list">
              {filteredClients.map((client, index) => (
                <article className="inactive-mobile-row" key={`${getClientCode(client)}-mobile-${index}`}>
                  <div className="inactive-mobile-primary">
                    <strong>{cleanValue(client.nombre_comercial) || 'Sin nombre'}</strong>
                    <span>{getClientCode(client) || 'Sin código'}</span>
                  </div>
                  <dl>
                    <div><dt>Dirección</dt><dd>{cleanValue(client.direccion) || 'Sin asignar'}</dd></div>
                    <div><dt>Gerencia</dt><dd>{cleanValue(client.gerencia) || 'Sin asignar'}</dd></div>
                    <div><dt>Supervisor</dt><dd>{cleanValue(client.supervisor) || 'Sin asignar'}</dd></div>
                    <div><dt>BDR</dt><dd>{cleanValue(client.BDR) || 'Sin asignar'}</dd></div>
                    <div><dt>Canjes históricos</dt><dd>{(Number(client.redemptions) || 0).toLocaleString('es-PE')}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default InactiveClientsView;
