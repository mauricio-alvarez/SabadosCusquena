import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

export default function DateRangePicker({ 
  useAllTimeData, 
  setUseAllTimeData, 
  dateRange, 
  setDateRange 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const getDisplayValue = () => {
    if (!dateRange?.from) return 'Selecciona un rango';
    if (!dateRange?.to) return format(dateRange.from, 'dd/MM/yyyy');
    if (dateRange.from.getTime() === dateRange.to.getTime()) return format(dateRange.from, 'dd/MM/yyyy');
    return `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;
  };

  return (
    <div className="flex items-center gap-4 ml-auto">
      <div className="flex items-center gap-2">
        <label className="text-secondary text-sm font-semibold cursor-pointer select-none" onClick={() => setUseAllTimeData(!useAllTimeData)}>
          Usar todos los datos
        </label>
        <div 
          className={`toggle-switch ${useAllTimeData ? 'on' : 'off'}`} 
          onClick={() => setUseAllTimeData(!useAllTimeData)}
        >
          <div className="toggle-knob" />
        </div>
      </div>

      {!useAllTimeData && (
        <div ref={popoverRef} style={{ position: 'relative' }}>
          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={() => setIsOpen(!isOpen)}
            style={{ padding: '8px 16px', fontSize: '0.85rem', minWidth: '220px', justifyContent: 'space-between' }}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} />
              <span>{getDisplayValue()}</span>
            </div>
          </button>

          {isOpen && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0, 
              marginTop: '8px', 
              zIndex: 50, 
              padding: '16px', 
              background: '#1c1c1c', 
              border: '1px solid rgba(255,255,255,0.1)', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              width: 'max-content'
            }}>
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={es}
                className="dark-calendar"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
