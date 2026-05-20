import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as XLSX from 'xlsx';
import { Target, TrendingDown, X, Download } from 'lucide-react';

const OpportunityView = ({ allClients }) => {
  const mapRef = useRef(null);
  
  const [geoData, setGeoData] = useState(null);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [useRedemptionVolume, setUseRedemptionVolume] = useState(false);
  
  // Filtering states for the client list
  const [listFilters, setListFilters] = useState({
    gerencia: 'All',
    supervisor: 'All',
    BDR: 'All',
  });

  // Use refs to avoid stale closures in D3 event handlers
  const metricsRef = useRef({});
  const selectedRegionRef = useRef(null);
  const useRedemptionVolumeRef = useRef(useRedemptionVolume);
  const colorScaleRef = useRef(null);

  // Fetch GeoJSON once on mount
  useEffect(() => {
    d3.json('/peru_departments.geojson').then(data => {
      setGeoData(data);
    }).catch(err => console.error("Error loading map data:", err));
  }, []);

  // Update useRedemptionVolumeRef
  useEffect(() => {
    useRedemptionVolumeRef.current = useRedemptionVolume;
  }, [useRedemptionVolume]);

  // Reset list filters when selected map region or view mode changes
  useEffect(() => {
    setListFilters({
      gerencia: 'All',
      supervisor: 'All',
      BDR: 'All',
    });
  }, [selectedRegion, useRedemptionVolume]);

  // Helper to map Gerencia string to GeoJSON Department name (NOMBDEP)
  const mapGerenciaToDepartment = (gerencia) => {
    if (!gerencia) return null;
    const g = gerencia.trim().toUpperCase();

    if (g.includes('LIMA') || g.includes('NORTE CHI')) return 'LIMA';
    if (g.includes('ANCASH')) return 'ANCASH';
    if (g.includes('AREQUIPA')) return 'AREQUIPA';
    if (g.includes('AYACUCHO')) return 'AYACUCHO';
    if (g.includes('CUSCO')) return 'CUSCO';
    if (g.includes('PUNO')) return 'PUNO';
    if (g.includes('TACNA')) return 'TACNA';
    if (g.includes('PIURA')) return 'PIURA';
    if (g.includes('TUMBES')) return 'TUMBES';
    if (g.includes('TRUJILLO')) return 'LA LIBERTAD';
    if (g.includes('CHICLAY')) return 'LAMBAYEQUE'; // Chiclayo maps to Lambayeque
    if (g.includes('TARAPOTO')) return 'SAN MARTIN';
    if (g.includes('IQUITOS')) return 'LORETO';
    if (g.includes('PUCALL') || g.includes('HCO')) return 'UCAYALI'; // Pucallpa maps to Ucayali
    if (g.includes('HUANCAY')) return 'JUNIN'; // Huancayo maps to Junin
    if (g.includes('SUR CHI')) return 'ICA'; // Sur Chico maps to Ica
    
    return null;
  };

  // Compute metrics per GeoJSON Department (NOMBDEP)
  const metricsByRegion = useMemo(() => {
    const metrics = {};
    if (!allClients) return metrics;

    allClients.forEach(client => {
      const region = mapGerenciaToDepartment(client.gerencia);
      if (!region) return;

      if (!metrics[region]) {
        metrics[region] = {
          total: 0,
          active: 0,
          inactive: 0,
          totalRedemptions: 0,
          clients: []
        };
      }
      
      metrics[region].total += 1;
      metrics[region].totalRedemptions += (client.redemptions || 0);
      if (client.redemptions > 0) {
        metrics[region].active += 1;
      } else {
        metrics[region].inactive += 1;
      }
      
      // Keep track of all clients for potential list view
      metrics[region].clients.push(client);
    });

    return metrics;
  }, [allClients]);

  // Keep metrics ref synchronized
  useEffect(() => {
    metricsRef.current = metricsByRegion;
  }, [metricsByRegion]);

  // Keep selectedRegion ref synchronized
  useEffect(() => {
    selectedRegionRef.current = selectedRegion;
  }, [selectedRegion]);

  // Compute max redemptions across all regions
  const maxRedemptions = useMemo(() => {
    const values = Object.values(metricsByRegion).map(m => m.totalRedemptions || 0);
    return Math.max(...values, 1); // fallback to 1 to avoid division by zero
  }, [metricsByRegion]);

  // Color Scale based on Inactive Client Rate (0 to 1) or totalRedemptions (0 to maxRedemptions)
  // Yellow-Orange-Red gradient matching the user's requested palette
  const colorScale = useMemo(() => {
    const rangeColors = ["#ffffe0", "#fed976", "#feb24c", "#fc4e2a", "#800026"];
    if (useRedemptionVolume) {
      return d3.scaleLinear()
        .domain([
          0,
          maxRedemptions * 0.25,
          maxRedemptions * 0.5,
          maxRedemptions * 0.75,
          maxRedemptions
        ])
        .range(rangeColors);
    } else {
      return d3.scaleLinear()
        .domain([0, 0.25, 0.5, 0.75, 1.0])
        .range(rangeColors);
    }
  }, [useRedemptionVolume, maxRedemptions]);

  // Keep colorScale ref synchronized
  useEffect(() => {
    colorScaleRef.current = colorScale;
  }, [colorScale]);

  // Active details card info (shows hovered department, or selected, or placeholder)
  const activeDetailRegion = useMemo(() => {
    if (hoveredRegion) {
      return hoveredRegion;
    }
    if (selectedRegion) {
      return {
        name: selectedRegion,
        metrics: metricsByRegion[selectedRegion] || { total: 0, active: 0, inactive: 0, totalRedemptions: 0 }
      };
    }
    return null;
  }, [hoveredRegion, selectedRegion, metricsByRegion]);

  // Cascading options for client list filters
  const listFilterOptions = useMemo(() => {
    let baseList = allClients ? (useRedemptionVolume ? allClients : allClients.filter(c => c.redemptions === 0)) : [];
    
    // Hard filter by selected Map region first
    if (selectedRegion) {
      baseList = baseList.filter(c => mapGerenciaToDepartment(c.gerencia) === selectedRegion);
    }

    const getOptions = (key, currentFilters) => {
      let list = baseList;
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (k !== key && v !== 'All') {
          list = list.filter(c => c[k] === v);
        }
      });
      return Array.from(new Set(list.map(c => c[key]).filter(Boolean))).sort();
    };

    return {
      gerencia: getOptions('gerencia', listFilters),
      supervisor: getOptions('supervisor', listFilters),
      BDR: getOptions('BDR', listFilters),
    };
  }, [allClients, selectedRegion, listFilters, useRedemptionVolume]);

  // Compute final filtered list of clients
  const filteredClients = useMemo(() => {
    let list = allClients ? [...allClients] : [];

    if (selectedRegion) {
      list = list.filter(c => mapGerenciaToDepartment(c.gerencia) === selectedRegion);
    }

    if (listFilters.gerencia !== 'All') {
      list = list.filter(c => c.gerencia === listFilters.gerencia);
    }
    if (listFilters.supervisor !== 'All') {
      list = list.filter(c => c.supervisor === listFilters.supervisor);
    }
    if (listFilters.BDR !== 'All') {
      list = list.filter(c => c.BDR === listFilters.BDR);
    }

    if (useRedemptionVolume) {
      // Sort ascending (fewest first)
      list.sort((a, b) => (a.redemptions || 0) - (b.redemptions || 0));
    } else {
      // Only keep inactive clients (redemptions === 0)
      list = list.filter(c => c.redemptions === 0);
    }

    return list;
  }, [allClients, selectedRegion, listFilters, useRedemptionVolume]);

  // Max exactly 10 items in list preview to fit perfectly without card overflow
  const displayClients = useMemo(() => {
    return filteredClients.slice(0, 10);
  }, [filteredClients]);

  const hasDropdownFilters = listFilters.gerencia !== 'All' || listFilters.supervisor !== 'All' || listFilters.BDR !== 'All';

  const resetDropdownFilters = () => {
    setListFilters({
      gerencia: 'All',
      supervisor: 'All',
      BDR: 'All',
    });
  };

  // Download filtered clients to Excel
  const handleDownloadExcel = () => {
    if (filteredClients.length === 0) return;

    const dataToExport = filteredClients.map(client => ({
      'Código Cliente': client.cliente_id,
      'Nombre Comercial': client.nombre_comercial,
      'Gerencia': client.gerencia,
      'Supervisor': client.supervisor,
      'BDR': client.BDR,
      'Canjes': client.redemptions,
      'Días Inactivo': client.days_since_last_redemption || 'Sin canjes'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, useRedemptionVolume ? "Volumen Canjes" : "Oportunidades");

    const maxLengths = {};
    dataToExport.forEach(row => {
      Object.keys(row).forEach(key => {
        const val = row[key] ? row[key].toString() : '';
        maxLengths[key] = Math.max(maxLengths[key] || 10, val.length);
      });
    });
    worksheet['!cols'] = Object.keys(maxLengths).map(key => ({
      wch: maxLengths[key] + 3
    }));

    const filename = useRedemptionVolume 
      ? `Volumen_Canjes_${selectedRegion || 'Nacional'}.xlsx`
      : `Clientes_Inactivos_${selectedRegion || 'Nacional'}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  // 1. Initial SVG Map Render
  useEffect(() => {
    if (!geoData || !mapRef.current) return;

    const width = 500;
    const height = 620;

    const svg = d3.select(mapRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", "100%")
       .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoMercator()
      .fitSize([width, height], geoData);
    
    const path = d3.geoPath().projection(projection);

    const g = svg.append("g");

    g.selectAll("path")
      .data(geoData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "department-path")
      .attr("cursor", "pointer")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("fill", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const regionData = metricsRef.current[regionName];
        const currentSelected = selectedRegionRef.current;
        if (currentSelected && currentSelected !== regionName) {
          return "rgba(255, 255, 255, 0.04)";
        }
        if (!regionData || regionData.total === 0) return "#1e293b";
        
        return useRedemptionVolumeRef.current
          ? colorScaleRef.current(regionData.totalRedemptions || 0)
          : colorScaleRef.current(regionData.inactive / regionData.total);
      })
      .attr("stroke", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const currentSelected = selectedRegionRef.current;
        return currentSelected === regionName ? "var(--cusquena-gold)" : "rgba(255, 255, 255, 0.15)";
      })
      .attr("stroke-width", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const currentSelected = selectedRegionRef.current;
        return currentSelected === regionName ? 2.0 : 0.75;
      })
      .style("transition", "fill 0.3s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease, stroke-width 0.3s ease")
      .on("mouseover", function(event, d) {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const currentSelected = selectedRegionRef.current;
        
        d3.select(this)
          .attr("stroke", "rgba(255, 255, 255, 0.6)")
          .attr("stroke-width", currentSelected === regionName ? 2.0 : 1.25);
          
        setHoveredRegion({
          name: d.properties.NOMBDEP,
          metrics: metricsRef.current[regionName] || { total: 0, active: 0, inactive: 0, totalRedemptions: 0 }
        });
      })
      .on("mouseout", function(event, d) {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const currentSelected = selectedRegionRef.current;
        
        d3.select(this)
          .attr("stroke", currentSelected === regionName ? "var(--cusquena-gold)" : "rgba(255, 255, 255, 0.15)")
          .attr("stroke-width", currentSelected === regionName ? 2.0 : 0.75);
          
        setHoveredRegion(null);
      })
      .on("click", function(event, d) {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        setSelectedRegion(prev => prev === regionName ? null : regionName);
      });

  }, [geoData]);

  // 2. Map Styling & Selection Update
  useEffect(() => {
    if (!geoData || !mapRef.current) return;

    const svg = d3.select(mapRef.current);
    
    svg.selectAll(".department-path")
      .attr("fill", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        const regionData = metricsByRegion[regionName];
        
        if (selectedRegion && selectedRegion !== regionName) {
          return "rgba(255, 255, 255, 0.04)"; 
        }
        if (!regionData || regionData.total === 0) return "#1e293b";
        
        return useRedemptionVolume
          ? colorScale(regionData.totalRedemptions || 0)
          : colorScale(regionData.inactive / regionData.total);
      })
      .attr("stroke", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        return selectedRegion === regionName ? "var(--cusquena-gold)" : "rgba(255, 255, 255, 0.15)";
      })
      .attr("stroke-width", d => {
        const regionName = d.properties.NOMBDEP.toUpperCase();
        return selectedRegion === regionName ? 2.0 : 0.75;
      });

  }, [geoData, metricsByRegion, selectedRegion, colorScale]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full h-full pb-2">
      {/* Header with Title & Mode Switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full" style={{ background: 'rgba(207, 160, 82, 0.1)' }}>
            <Target className="text-gold" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Mapa de Oportunidades (Calor)</h2>
            <p className="text-secondary text-sm">
              {useRedemptionVolume 
                ? 'Monitorea y atiende el volumen total de canjes por Gerencia'
                : 'Monitorea y atiende las zonas con mayor tasa de clientes inactivos'}
            </p>
          </div>
        </div>

        {/* Dynamic Mode Switch Toggle */}
        <div 
          className="cursor-pointer select-none transition-all duration-300 hover:border-gold/50" 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            height: 'fit-content', 
            borderRadius: '14px',
            border: '1px solid rgba(207, 160, 82, 0.35)',
            background: 'rgba(17, 24, 39, 0.75)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            padding: '10px 18px',
            flexShrink: 0
          }}
          onClick={() => setUseRedemptionVolume(prev => !prev)}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-gold" style={{ letterSpacing: '0.05em' }}>
            Medida:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span 
              className="text-sm font-black transition-all duration-300"
              style={{ 
                color: !useRedemptionVolume ? '#ffffff' : 'rgba(156, 163, 175, 0.4)',
                textShadow: !useRedemptionVolume ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none'
              }}
            >
              Inactividad
            </span>
            
            {/* Switch track styled inline */}
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '28px',
                width: '56px',
                flexShrink: 0,
                cursor: 'pointer',
                borderRadius: '9999px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: useRedemptionVolume ? '#cfa052' : 'rgba(255, 255, 255, 0.1)',
                transition: 'background-color 0.3s ease-in-out',
                alignItems: 'center'
              }}
            >
              {/* Switch handle styled inline */}
              <span
                style={{
                  pointerEvents: 'none',
                  display: 'inline-block',
                  height: '20px',
                  width: '20px',
                  borderRadius: '9999px',
                  backgroundColor: useRedemptionVolume ? '#111827' : '#ffffff',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                  transform: useRedemptionVolume ? 'translateX(30px)' : 'translateX(4px)',
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease-in-out'
                }}
              />
            </div>
            
            <span 
              className="text-sm font-black transition-all duration-300"
              style={{ 
                color: useRedemptionVolume ? '#ffffff' : 'rgba(156, 163, 175, 0.4)',
                textShadow: useRedemptionVolume ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none'
              }}
            >
              Volumen Canjes
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout - Two columns scaling to fill viewport height */}
      <div 
        className="grid grid-cols-1 grid-cols-md-3 gap-6 flex-1 min-h-0"
        style={{ height: 'calc(100vh - 240px)', minHeight: '350px' }}
      >
        
        {/* Heatmap Column (Large panel on the left) */}
        <div 
          className="col-span-2 glass-panel p-5 flex flex-col relative" 
          style={{ height: '100%', overflow: 'hidden' }}
        >
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2 flex-shrink-0" style={{ marginBottom: '22px' }}>
            <h3 className="text-gold font-bold text-xs p-4" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Heatmap de Oportunidad de Crecimiento
            </h3>
            {selectedRegion && (
              <button 
                onClick={() => setSelectedRegion(null)}
                className="btn-secondary flex items-center gap-2 text-[10px] py-1 px-2.5"
                style={{ height: 'fit-content' }}
              >
                <X size={12} />
                Quitar Filtro ({selectedRegion})
              </button>
            )}
          </div>
          
          <div className="flex-1 flex gap-4 items-center justify-between min-h-0 min-w-0 overflow-hidden relative w-full h-full">
            
            {/* Left Inner: Gerencia Info Panel */}
            <div 
              className="glass-panel p-4 flex flex-col justify-between flex-shrink-0 my-auto"
              style={{ 
                width: '28%', 
                minWidth: '165px',
                maxWidth: '240px',
                height: 'auto',
                minHeight: '210px',
                maxHeight: '85%',
                marginLeft: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              {activeDetailRegion ? (
                <>
                  <div className="w-full">
                    <h4 
                      className="font-bold text-white truncate text-sm" 
                      style={{ 
                        marginBottom: '12px',
                        borderBottom: '1px solid var(--cusquena-gold)',
                        paddingBottom: '8px'
                      }}
                      title={activeDetailRegion.name}
                    >
                      {activeDetailRegion.name}
                    </h4>
                    <div className="flex flex-col gap-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-secondary">Locales Totales:</span>
                        <span className="text-white font-bold text-sm">{activeDetailRegion.metrics.total}</span>
                      </div>
                      {!useRedemptionVolume ? (
                        <>
                          <div className="flex justify-between">
                            <span className="font-semibold" style={{ color: '#4ade80' }}>Activos:</span>
                            <span className="font-bold text-sm" style={{ color: '#4ade80' }}>{activeDetailRegion.metrics.active}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold" style={{ color: 'var(--cusquena-red)' }}>Inactivos:</span>
                            <span className="font-bold text-sm" style={{ color: 'var(--cusquena-red)' }}>{activeDetailRegion.metrics.inactive}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-secondary font-semibold">Promedio Canjes/Local:</span>
                          <span className="text-white font-bold text-sm">
                            {activeDetailRegion.metrics.total > 0 
                              ? (activeDetailRegion.metrics.totalRedemptions / activeDetailRegion.metrics.total).toFixed(1)
                              : 0}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {activeDetailRegion.metrics.total > 0 && (
                    <div 
                      className="flex flex-col w-full" 
                      style={{ 
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                        paddingTop: '12px', 
                        marginTop: '12px',
                        gap: '6px' 
                      }}
                    >
                      <span className="text-secondary uppercase font-semibold text-[10px]">
                        {useRedemptionVolume ? 'Canjes Totales' : 'Tasa Inactividad'}
                      </span>
                      <span className="text-gold font-bold text-2xl" style={{ lineHeight: 1 }}>
                        {useRedemptionVolume 
                          ? activeDetailRegion.metrics.totalRedemptions 
                          : `${((activeDetailRegion.metrics.inactive / activeDetailRegion.metrics.total) * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col text-center py-2 text-secondary my-auto w-full gap-3">
                  <p className="font-semibold text-white text-xs">Detalle de Región</p>
                  <p className="leading-relaxed opacity-85 px-1 text-[11px]">
                    {useRedemptionVolume 
                      ? "Pasa el cursor o haz clic en el mapa para ver el volumen de canjes."
                      : "Pasa el cursor o haz clic en el mapa para analizar la inactividad."}
                  </p>
                </div>
              )}
            </div>

            {/* Center Inner: Heatmap SVG */}
            <div className="flex-1 h-full min-h-0 min-w-0 flex justify-center items-center overflow-hidden relative">
              {!geoData && <div className="loader absolute"></div>}
              <svg 
                ref={mapRef} 
                className="w-full h-full" 
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
              />
            </div>

            {/* Right Inner: Vertical Legend */}
            <div 
              className="glass-panel p-2 flex flex-col items-center justify-between flex-shrink-0 my-auto"
              style={{ 
                width: '64px', 
                height: '190px', 
                minWidth: '64px', 
                maxWidth: '64px', 
                marginRight: '12px',
                paddingTop: '14px',
                paddingBottom: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                gap: '8px'
              }}
            >
              <span className="text-[10px] text-secondary font-bold font-mono">
                {useRedemptionVolume ? maxRedemptions : '100%'}
              </span>
              
              <div 
                className="rounded-full border border-white/10" 
                style={{ 
                  background: 'linear-gradient(to top, #ffffe0, #fed976, #feb24c, #fc4e2a, #800026)',
                  width: '8px', 
                  flex: '1', 
                  minHeight: '80px'
                }}
              ></div>
              
              <span className="text-[10px] text-secondary font-bold font-mono">
                {useRedemptionVolume ? '0' : '0%'}
              </span>

              <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/5 w-full">
                <div className="w-3.5 h-1.5 rounded-sm border border-gray-600 flex-shrink-0" style={{ backgroundColor: '#1e293b' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* === Right Column: List (Takes up 33% on large screens) === */}
        <div 
          className="glass-panel p-4 flex flex-col w-full lg:w-1/3"
          style={{ height: '100%', overflow: 'hidden' }}
        >
          <div className="flex flex-col gap-1 mb-2.5 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-gold font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown size={14} />
                {useRedemptionVolume ? 'Clientes con Menor Canje' : 'Clientes a Insistir'}
              </h3>
              {hasDropdownFilters && (
                <button 
                  onClick={resetDropdownFilters}
                  className="text-[10px] text-gold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X size={10} /> Borrar
                </button>
              )}
            </div>
            
            <div className="flex flex-col text-secondary" style={{ fontSize: '12px', gap: '2px' }}>
              <span>
                {selectedRegion ? `Filtrado por ${selectedRegion}:` : 'Todo el país:'} <strong>{filteredClients.length} locales</strong> {useRedemptionVolume ? 'con menor volumen' : 'sin canjes'}
              </span>
              {filteredClients.length > displayClients.length && (
                <span style={{ fontSize: '10.5px', opacity: 0.8 }}>
                  * Mostrando los primeros {displayClients.length} locales.
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mb-3 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] flex-shrink-0">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="flex flex-col gap-0.5">
                <label className="text-[11px] text-secondary font-semibold uppercase">Gerencia</label>
                <select
                  className="filter-select"
                  value={listFilters.gerencia}
                  onChange={(e) => setListFilters(prev => ({ ...prev, gerencia: e.target.value }))}
                  style={{ padding: '0 1.5rem 0 0.5rem', height: '32px', lineHeight: '30px', fontSize: '13px' }}
                >
                  <option value="All">Todos ({listFilterOptions.gerencia.length})</option>
                  {listFilterOptions.gerencia.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-0.5">
                <label className="text-[11px] text-secondary font-semibold uppercase">Supervisor</label>
                <select
                  className="filter-select"
                  value={listFilters.supervisor}
                  onChange={(e) => setListFilters(prev => ({ ...prev, supervisor: e.target.value }))}
                  style={{ padding: '0 1.5rem 0 0.5rem', height: '32px', lineHeight: '30px', fontSize: '13px' }}
                >
                  <option value="All">Todos ({listFilterOptions.supervisor.length})</option>
                  {listFilterOptions.supervisor.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'flex-end' }}>
              <div className="flex flex-col gap-0.5">
                <label className="text-[11px] text-secondary font-semibold uppercase">BDR</label>
                <select
                  className="filter-select w-full"
                  value={listFilters.BDR}
                  onChange={(e) => setListFilters(prev => ({ ...prev, BDR: e.target.value }))}
                  style={{ padding: '0 1.5rem 0 0.5rem', height: '32px', lineHeight: '30px', fontSize: '13px' }}
                >
                  <option value="All">Todos ({listFilterOptions.BDR.length})</option>
                  {listFilterOptions.BDR.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button 
                  onClick={handleDownloadExcel}
                  className="btn-gold w-full flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ height: '32px', fontSize: '12.5px', fontWeight: '700', padding: '0 6px', borderRadius: '8px' }}
                  disabled={filteredClients.length === 0}
                >
                  <Download size={14} />
                  Descargar ({filteredClients.length})
                </button>
              </div>
            </div>
          </div>

          <div 
            className="pr-1 custom-scrollbar" 
            style={{ 
              flex: '1 1 0%', 
              minHeight: '0', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '6px' 
            }}
          >
            {displayClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-6 gap-2">
                <p className="text-white text-xs font-semibold">¡Sin locales!</p>
                <p className="text-secondary text-[10px] px-2">
                  No hay locales que coincidan con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {displayClients.map((client, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 flex flex-col relative" 
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.015)', 
                      border: '1px solid rgba(255,255,255,0.03)',
                      gap: '4px',
                      flexShrink: 0
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-white font-semibold text-xs truncate" style={{ maxWidth: '170px' }} title={client.nombre_comercial}>
                        {client.nombre_comercial}
                      </span>
                      <span className="text-[10px] text-secondary font-mono flex-shrink-0 opacity-70">
                        {client.cliente_id}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-1.5 text-[10px] text-secondary">
                      <div className="truncate" title={client.gerencia}><span className="opacity-50">Gerencia:</span> {client.gerencia}</div>
                      <div className="truncate" title={client.supervisor}><span className="opacity-50">Sup:</span> {client.supervisor}</div>
                      <div className="truncate mt-0.5" title={client.BDR}><span className="opacity-50">BDR:</span> {client.BDR}</div>
                      <div className="text-gold font-bold text-right mt-0.5" style={{ fontSize: '10px' }}>
                        Canjes: {client.redemptions || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunityView;