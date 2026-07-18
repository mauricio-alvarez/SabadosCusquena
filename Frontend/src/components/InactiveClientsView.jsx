import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, SlidersHorizontal, UserCheck, UserX, Users, X } from 'lucide-react';
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
  const [statusView, setStatusView] = useState('inactive');

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

  const getFilterOptions = useCallback((filterKey) => {
    const values = allClients
      .filter(client => FILTER_KEYS.every(key => (
        key === filterKey || filters[key] === 'All' || cleanValue(client[key]) === filters[key]
      )))
      .map(client => cleanValue(client[filterKey]))
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [allClients, filters]);

  const filteredBaseClients = useMemo(() => {
    const query = normalizeSearch(searchTerm);

    return allClients
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
      });
  }, [allClients, filters, searchTerm]);

  const filteredActiveClients = useMemo(() => (
    latestSaturday
      ? filteredBaseClients.filter(client => redemptionsOnDate(client, latestSaturday) > 0)
      : []
  ), [filteredBaseClients, latestSaturday]);

  const filteredInactiveClients = useMemo(() => (
    latestSaturday
      ? filteredBaseClients.filter(client => redemptionsOnDate(client, latestSaturday) === 0)
      : filteredBaseClients
  ), [filteredBaseClients, latestSaturday]);

  const displayedClients = useMemo(() => {
    const source = statusView === 'active' ? filteredActiveClients : filteredInactiveClients;
    return [...source].sort((a, b) => {
      if (historicalSort) {
        const redemptionDelta = (Number(a.redemptions) || 0) - (Number(b.redemptions) || 0);
        if (redemptionDelta !== 0) return historicalSort === 'asc' ? redemptionDelta : -redemptionDelta;
      }
      const directionOrder = cleanValue(a.direccion).localeCompare(cleanValue(b.direccion), 'es', { sensitivity: 'base' });
      if (directionOrder !== 0) return directionOrder;
      return cleanValue(a.nombre_comercial).localeCompare(cleanValue(b.nombre_comercial), 'es', { sensitivity: 'base' });
    });
  }, [filteredActiveClients, filteredInactiveClients, historicalSort, statusView]);

  const hasFilters = searchTerm.trim() || FILTER_KEYS.some(key => filters[key] !== 'All');
  const filteredTotalCount = filteredBaseClients.length;
  const activePercentage = filteredTotalCount > 0 ? ((filteredActiveClients.length / filteredTotalCount) * 100).toFixed(1) : '0.0';
  const inactivePercentage = filteredTotalCount > 0 ? ((filteredInactiveClients.length / filteredTotalCount) * 100).toFixed(1) : '0.0';
  const selectedPercentage = statusView === 'active' ? activePercentage : inactivePercentage;
  const selectedLabel = statusView === 'active' ? 'activos' : 'inactivos';

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

  const downloadClients = (clients, scope) => {
    if (clients.length === 0) return;

    const rows = clients.map(client => {
      const saturdayRedemptions = redemptionsOnDate(client, latestSaturday);
      return {
        'Código Cliente': getClientCode(client),
        'Nombre Comercial': cleanValue(client.nombre_comercial),
        'Dirección': cleanValue(client.direccion),
        'Gerencia': cleanValue(client.gerencia),
        'Supervisor': cleanValue(client.supervisor),
        'BDR': cleanValue(client.BDR),
        [`Canjes Sábado ${latestSaturday}`]: saturdayRedemptions,
        'Canjes Históricos': Number(client.redemptions) || 0,
        'Estado del Sábado': saturdayRedemptions > 0 ? 'Activo' : 'Inactivo',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 34 }, { wch: 24 }, { wch: 28 },
      { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    const sheetName = scope === 'Todos' ? 'Todos los Clientes' : `Clientes ${scope}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `Detalle_Clientes_${scope}.xlsx`);
  };

  return (
    <section className="inactive-view" aria-label="Detalle de clientes activos e inactivos">
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
              aria-label="Buscar clientes"
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
        <div className="client-status-switcher" role="tablist" aria-label="Estado del cliente">
          <button
            type="button"
            role="tab"
            aria-selected={statusView === 'active'}
            className={statusView === 'active' ? 'active' : ''}
            onClick={() => setStatusView('active')}
          >
            <UserCheck size={18} />
            <span>Activos</span>
            <strong>{filteredActiveClients.length.toLocaleString('es-PE')}</strong>
            <small>{activePercentage}%</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusView === 'inactive'}
            className={statusView === 'inactive' ? 'active' : ''}
            onClick={() => setStatusView('inactive')}
          >
            <UserX size={18} />
            <span>Inactivos</span>
            <strong>{filteredInactiveClients.length.toLocaleString('es-PE')}</strong>
            <small>{inactivePercentage}%</small>
          </button>
          <div className="client-status-total">
            <Users size={17} />
            <span>{filteredTotalCount.toLocaleString('es-PE')} clientes filtrados</span>
          </div>
        </div>

        <div className="inactive-results-bar">
          <div className={`inactive-result-count status-${statusView}`}>
            {statusView === 'active' ? <UserCheck size={19} aria-hidden="true" /> : <UserX size={19} aria-hidden="true" />}
            <div>
              <strong>
                {displayedClients.length.toLocaleString('es-PE')}/{filteredTotalCount.toLocaleString('es-PE')}
              </strong>
              <span> clientes {selectedLabel} ({selectedPercentage}%)</span>
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
          <div className="client-download-actions">
            <button
              type="button"
              className="btn-secondary inactive-download-button"
              onClick={() => downloadClients(filteredBaseClients, 'Todos')}
              disabled={filteredBaseClients.length === 0}
            >
              <Download size={16} />
              Todos
            </button>
            <button
              type="button"
              className="btn-secondary inactive-download-button download-active"
              onClick={() => downloadClients(filteredActiveClients, 'Activos')}
              disabled={filteredActiveClients.length === 0}
            >
              <UserCheck size={16} />
              Activos
            </button>
            <button
              type="button"
              className="btn-secondary inactive-download-button download-inactive"
              onClick={() => downloadClients(filteredInactiveClients, 'Inactivos')}
              disabled={filteredInactiveClients.length === 0}
            >
              <UserX size={16} />
              Inactivos
            </button>
          </div>
        </div>

        {displayedClients.length === 0 ? (
          <div className="inactive-empty-state">
            <Search size={28} aria-hidden="true" />
            <p>No hay clientes {selectedLabel} que coincidan con la búsqueda.</p>
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
                    <th className="numeric">Canjes sábado</th>
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
                  {displayedClients.map((client, index) => (
                    <tr key={`${getClientCode(client)}-${index}`}>
                      <td className="inactive-code">{getClientCode(client) || 'Sin código'}</td>
                      <td className="inactive-client-name">{cleanValue(client.nombre_comercial) || 'Sin nombre'}</td>
                      <td>{cleanValue(client.direccion) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.gerencia) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.supervisor) || 'Sin asignar'}</td>
                      <td>{cleanValue(client.BDR) || 'Sin asignar'}</td>
                      <td className="numeric">{redemptionsOnDate(client, latestSaturday).toLocaleString('es-PE')}</td>
                      <td className="numeric">{(Number(client.redemptions) || 0).toLocaleString('es-PE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inactive-mobile-list">
              {displayedClients.map((client, index) => (
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
                    <div><dt>Canjes sábado</dt><dd>{redemptionsOnDate(client, latestSaturday).toLocaleString('es-PE')}</dd></div>
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
