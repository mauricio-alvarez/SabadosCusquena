import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart } from './D3Charts';

const filterLabels = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  BDR: 'BDR',
};

const ProgressPanel = ({ progressData, onClose, isMobile }) => {
  const [perfLevel, setPerfLevel] = useState('direccion');

  if (!progressData) return null;

  const { redemptionsOverTime, performance, latest_date, last_week_date } = progressData;

  const renderPerfList = () => {
    const list = performance[perfLevel] || [];
    if (list.length === 0) {
      return <p className="text-secondary text-sm text-center py-4">No hay datos de comparación.</p>;
    }

    return (
      <div className="mt-2">
        {list.slice(0, 8).map((item, idx) => {
          const isPositive = item.diff > 0;
          const isNegative = item.diff < 0;
          
          return (
            <div key={idx} className="perf-item">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-semibold truncate text-white" title={item.name}>{item.name}</p>
                <p className="text-xs text-secondary">Actual: {item.current} | Anterior: {item.previous}</p>
              </div>
              <div className={`perf-diff flex items-center gap-1 ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
                {isPositive ? <TrendingUp size={16} /> : isNegative ? <TrendingDown size={16} /> : <Minus size={16} />}
                <span className="text-sm">{isPositive ? '+' : ''}{item.diff}</span>
              </div>
            </div>
          );
        })}
        {list.length > 8 && (
           <p className="text-xs text-secondary text-center mt-2">Mostrando top 8 variaciones...</p>
        )}
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full p-4">
      {isMobile && (
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>
      )}
      
      <div className="mb-6">
        <h2 className="text-gold font-bold text-xl mb-1">Progreso en el Tiempo</h2>
        <p className="text-secondary text-xs">
          Comparando: {latest_date} vs {last_week_date}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Tendencia de Canjes</h3>
        {redemptionsOverTime && redemptionsOverTime.length > 0 ? (
          <div style={{ height: '220px' }}>
            <LineChart data={redemptionsOverTime} />
          </div>
        ) : (
          <p className="text-secondary text-sm">Sin datos de tendencia.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Variación por</h3>
          <select 
            className="filter-select"
            style={{ padding: '0.4rem 1.5rem 0.4rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
            value={perfLevel}
            onChange={(e) => setPerfLevel(e.target.value)}
          >
            {Object.keys(filterLabels).map(key => (
              <option key={key} value={key}>{filterLabels[key]}</option>
            ))}
          </select>
        </div>
        
        {renderPerfList()}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="side-panel-mobile-overlay animate-fade-in" onClick={onClose}>
        <div className="side-panel-mobile" onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="side-panel glass-panel flex-shrink-0 animate-fade-in ml-0 mr-4">
      {content}
    </div>
  );
};

export default ProgressPanel;
