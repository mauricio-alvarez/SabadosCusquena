import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';

export const BarChart = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 90, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.region))
      .range([0, innerWidth])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value)])
      .range([innerHeight, 0]);

    // Tooltip
    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tooltipEnter = tooltip.enter().append('div').attr('class', 'd3-tooltip');
    const tt = tooltipEnter.merge(tooltip);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .attr('color', '#aaaaaa')
      .selectAll('text')
      .attr('fill', '#ffffff')
      .style('font-size', '11px')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-45)')
      .text(d => typeof d === 'string' && d.length > 18 ? d.substring(0, 18) + '...' : d);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? (d / 1000) + 'k' : d))
      .attr('color', '#aaaaaa')
      .selectAll('text')
      .attr('fill', '#ffffff');

    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.region))
      .attr('y', y(0))
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('fill', 'var(--cusquena-gold)')
      .attr('rx', 4)
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('fill', 'var(--cusquena-gold-light)');
        tt.style('opacity', 1)
          .html(`<strong>${d.region}</strong><br/>${d.value.toLocaleString()} canjes`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('fill', 'var(--cusquena-gold)');
        tt.style('opacity', 0);
      })
      .transition()
      .duration(800)
      .attr('y', d => y(d.value))
      .attr('height', d => innerHeight - y(d.value));

    // Value labels on top of each bar
    g.selectAll('.bar-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.region) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .text(d => d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value.toLocaleString())
      .attr('opacity', 0)
      .transition()
      .delay(800)
      .duration(400)
      .attr('opacity', 1);

  }, [data]);

  return (
    <div className="chart-container">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const DonutChart = ({ data }) => {
  const svgRef = useRef();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const width = isMobile ? 360 : 560;
    const height = isMobile ? 450 : 300;
    const radius = isMobile ? 120 : 112;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', isMobile ? 'translate(180,145)' : 'translate(142,150)');

    const total = d3.sum(data.map(item => item.value));
    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.department))
      .range(['#CFA052', '#a67c33', '#e8c07d', '#8B0000', '#5c0000']);

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.72);

    const arcHover = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.78);

    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tt = tooltip.enter().append('div').attr('class', 'd3-tooltip').merge(tooltip);
    const pieData = pie(data);

    const path = g.selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('fill', d => color(d.data.department))
      .attr('stroke', 'var(--primary-dark)')
      .attr('stroke-width', 2)
      .on('mouseover', function (event, d) {
        d3.select(this).transition().duration(200).attr('d', arcHover);
        const percent = ((d.data.value / total) * 100).toFixed(1);
        tt.style('opacity', 1)
          .html(`<strong>${d.data.department}</strong><br/>${d.data.value.toLocaleString()} canjes (${percent}%)`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(200).attr('d', arc);
        tt.style('opacity', 0);
      });

    path.transition()
      .duration(1000)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) { return arc(i(t)); };
      });

    const legend = svg.append('g')
      .attr('class', 'donut-legend')
      .attr('transform', isMobile ? 'translate(40,280)' : 'translate(295,56)');

    const legendRows = legend.selectAll('g')
      .data(pieData)
      .enter()
      .append('g')
      .attr('transform', (d, i) => `translate(0,${i * (isMobile ? 34 : 40)})`);

    legendRows.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 3)
      .attr('fill', d => color(d.data.department));

    legendRows.append('text')
      .attr('x', 20)
      .attr('y', 2)
      .attr('fill', '#ffffff')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text(d => d.data.department.length > 26 ? `${d.data.department.slice(0, 26)}...` : d.data.department);

    legendRows.append('text')
      .attr('x', 20)
      .attr('y', 20)
      .attr('fill', 'var(--text-secondary)')
      .style('font-size', '11px')
      .text(d => {
        const percent = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0.0';
        return `${d.data.value.toLocaleString()} canjes · ${percent}%`;
      });

  }, [data, isMobile]);

  return (
    <div className="chart-container flex justify-center items-center">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const LineChart = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const parseTime = d3.timeParse("%d/%m/%Y");
    const parsedData = data.map(d => ({
      date: parseTime(d.date),
      value: d.count
    }));

    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.date))
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.value) * 1.1]) // 10% padding top
      .range([innerHeight, 0]);

    // Tooltip
    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tt = tooltip.enter().append('div').attr('class', 'd3-tooltip').merge(tooltip);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")))
      .attr('color', '#aaaaaa')
      .selectAll('text')
      .attr('fill', '#ffffff')
      .style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('color', '#aaaaaa')
      .selectAll('text')
      .attr('fill', '#ffffff');

    const line = d3.line()
      .x(d => x(d.date))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    // Path
    const path = g.append('path')
      .datum(parsedData)
      .attr('fill', 'none')
      .attr('stroke', 'var(--cusquena-gold)')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Animation
    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Points
    g.selectAll('.dot')
      .data(parsedData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.value))
      .attr('r', 5)
      .attr('fill', 'var(--cusquena-gold-light)')
      .attr('stroke', 'var(--primary-dark)')
      .attr('stroke-width', 2)
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('r', 7).attr('fill', '#ffffff');
        tt.style('opacity', 1)
          .html(`<strong>${d3.timeFormat("%d/%m/%Y")(d.date)}</strong><br/>${d.value.toLocaleString()} canjes`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('r', 5).attr('fill', 'var(--cusquena-gold-light)');
        tt.style('opacity', 0);
      })
      .attr('opacity', 0)
      .transition()
      .delay(1500)
      .duration(500)
      .attr('opacity', 1);

  }, [data]);

  return (
    <div className="chart-container" style={{ minHeight: '200px', height: '100%' }}>
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const DualLineChart = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const width = 600;
    const height = 280;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allValues = [
      ...data.map(d => d.today),
      ...data.map(d => d.lastWeek),
    ];
    const maxVal = d3.max(allValues) || 10;

    const x = d3.scaleBand()
      .domain(data.map(d => d.hour))
      .range([0, innerWidth])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([innerHeight, 0]);

    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tt = tooltip.enter().append('div').attr('class', 'd3-tooltip').merge(tooltip);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(data.filter((_, i) => i % 2 === 0).map(d => d.hour)))
      .attr('color', '#aaaaaa')
      .selectAll('text').attr('fill', '#ffffff').style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('color', '#aaaaaa')
      .selectAll('text').attr('fill', '#ffffff');

    // Last week line
    const lwLine = d3.line()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y(d => y(d.lastWeek))
      .curve(d3.curveMonotoneX)
      .defined(d => d.lastWeek > 0);

    g.append('path')
      .datum(data.filter(d => d.lastWeek > 0))
      .attr('fill', 'none')
      .attr('stroke', '#8B0000')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.7)
      .attr('d', lwLine);

    // Last week dots
    g.selectAll('.lw-dot')
      .data(data.filter(d => d.lastWeek > 0))
      .enter().append('circle')
      .attr('cx', d => x(d.hour) + x.bandwidth() / 2)
      .attr('cy', d => y(d.lastWeek))
      .attr('r', 4)
      .attr('fill', '#8B0000')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 1.5)
      .on('mouseover', (event, d) => {
        tt.style('opacity', 1).html(`<strong>${d.hour} (Sem. Pasada)</strong><br/>${d.lastWeek} canjes`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => tt.style('opacity', 0));

    // Today line
    const todayLine = d3.line()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y(d => y(d.today))
      .curve(d3.curveMonotoneX)
      .defined(d => d.today > 0);

    const todayPath = g.append('path')
      .datum(data.filter(d => d.today > 0))
      .attr('fill', 'none')
      .attr('stroke', '#CFA052')
      .attr('stroke-width', 3)
      .attr('d', todayLine);

    // Animate today line
    const totalLength = todayPath.node()?.getTotalLength() || 0;
    if (totalLength > 0) {
      todayPath
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(1200).ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
    }

    // Today dots
    g.selectAll('.today-dot')
      .data(data.filter(d => d.today > 0))
      .enter().append('circle')
      .attr('cx', d => x(d.hour) + x.bandwidth() / 2)
      .attr('cy', d => y(d.today))
      .attr('r', 5)
      .attr('fill', '#CFA052')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 2)
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('r', 7).attr('fill', '#fff');
        tt.style('opacity', 1).html(`<strong>${d.hour} (Hoy)</strong><br/>${d.today} canjes`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('r', 5).attr('fill', '#CFA052');
        tt.style('opacity', 0);
      })
      .attr('opacity', 0)
      .transition().delay(1200).duration(400).attr('opacity', 1);

    // Legend
    const legend = g.append('g').attr('transform', `translate(${innerWidth - 180}, 0)`);
    [
      { label: 'Fecha A', color: '#CFA052', dash: null },
      { label: 'Fecha B', color: '#8B0000', dash: null },
    ].forEach((item, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
      row.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 6).attr('y2', 6)
        .attr('stroke', item.color).attr('stroke-width', 2)
        .attr('stroke-dasharray', item.dash).attr('stroke-opacity', item.dash ? 0.5 : 1);
      row.append('text').attr('x', 25).attr('y', 10).attr('fill', '#fff')
        .style('font-size', '11px').text(item.label);
    });

  }, [data]);

  return (
    <div className="chart-container" style={{ minHeight: '250px', height: '100%' }}>
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const CumulativeChart = ({ todayData, lastWeekData }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!todayData || todayData.length === 0) return;

    const width = 600;
    const height = 260;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allVals = [...todayData.map(d => d.value), ...(lastWeekData || []).map(d => d.value)];
    const maxVal = d3.max(allVals) || 10;

    const x = d3.scaleBand()
      .domain(todayData.map(d => d.hour))
      .range([0, innerWidth])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([innerHeight, 0]);

    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tt = tooltip.enter().append('div').attr('class', 'd3-tooltip').merge(tooltip);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(todayData.filter((_, i) => i % 2 === 0).map(d => d.hour)))
      .attr('color', '#aaaaaa')
      .selectAll('text').attr('fill', '#ffffff').style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('color', '#aaaaaa')
      .selectAll('text').attr('fill', '#ffffff');

    // Last week area
    if (lastWeekData && lastWeekData.length > 0) {
      const lwArea = d3.area()
        .x(d => x(d.hour) + x.bandwidth() / 2)
        .y0(innerHeight)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(lastWeekData.filter(d => d.value > 0))
        .attr('fill', 'rgba(139, 0, 0, 0.15)')
        .attr('d', lwArea);

      const lwLine = d3.line()
        .x(d => x(d.hour) + x.bandwidth() / 2)
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(lastWeekData.filter(d => d.value > 0))
        .attr('fill', 'none')
        .attr('stroke', '#8B0000')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('d', lwLine);
    }

    // Today area
    const todayArea = d3.area()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y0(innerHeight)
      .y1(d => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(todayData.filter(d => d.value > 0))
      .attr('fill', 'rgba(207, 160, 82, 0.15)')
      .attr('d', todayArea);

    const todayLine = d3.line()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(todayData.filter(d => d.value > 0))
      .attr('fill', 'none')
      .attr('stroke', '#CFA052')
      .attr('stroke-width', 3)
      .attr('d', todayLine);

    // Dots on today line
    g.selectAll('.cum-dot')
      .data(todayData.filter(d => d.value > 0))
      .enter().append('circle')
      .attr('cx', d => x(d.hour) + x.bandwidth() / 2)
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', '#CFA052')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 2)
      .on('mouseover', (event, d) => {
        tt.style('opacity', 1).html(`<strong>${d.hour}</strong><br/>${d.value} canjes acumulados`);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => tt.style('opacity', 0));

    // Legend
    const legend = g.append('g').attr('transform', `translate(${innerWidth - 150}, 0)`);
    [
      { label: 'Hoy', color: '#CFA052' },
      { label: 'Sem. Pasada', color: '#8B0000' },
    ].forEach((item, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
      row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3).attr('fill', item.color);
      row.append('text').attr('x', 18).attr('y', 10).attr('fill', '#fff').style('font-size', '11px').text(item.label);
    });

  }, [todayData, lastWeekData]);

  return (
    <div className="chart-container" style={{ minHeight: '230px', height: '100%' }}>
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const SaturdaysStackedBarChart = ({ allClients, progressData, useAllTimeData, dateRange }) => {
  const svgRef = useRef();
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef();

  // Color mapping configuration
  const DIRECTION_COLORS = {
    'PE Dir Lima': '#c78a27ff',         // Gold
    'PE Dir Norte': '#E5B562',        // Amber Gold
    'PE Dir Sur': '#a83225ff',          // Ruby Red
    'PE Dir Centro Orient': '#7A0000' // Deep Burgundy Red
  };

  // Track container width for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries && entries[0]) {
        setContainerWidth(entries[0].contentRect.width || 600);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute unique directions dynamically
  const keys = useMemo(() => {
    if (!allClients) return [];
    return Array.from(new Set(allClients.map(c => c.direccion).filter(Boolean))).sort();
  }, [allClients]);

  // Compute aggregated data
  const data = useMemo(() => {
    if (!allClients || !progressData || !progressData.available_dates || keys.length === 0) return [];

    // 1. Find and sort Saturdays
    let saturdays = progressData.available_dates.filter(dateStr => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return false;
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return d.getDay() === 6; // 6 = Saturday
    });

    saturdays.sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');
      const dA = new Date(parseInt(partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0]));
      const dB = new Date(parseInt(partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0]));
      return dA - dB;
    });

    // 2. Filter Saturdays by active dateRange if useAllTimeData is false
    if (!useAllTimeData && dateRange?.from) {
      const start = new Date(dateRange.from);
      start.setHours(0, 0, 0, 0);
      const end = dateRange.to ? new Date(dateRange.to) : new Date();
      end.setHours(23, 59, 59, 999);

      saturdays = saturdays.filter(sat => {
        const parts = sat.split('/');
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return d >= start && d <= end;
      });
    }

    // 4. Initialize Saturday items
    return saturdays.map(sat => {
      const item = {
        date: sat,
        totalRedemptions: 0,
        activeClients: {}
      };
      
      // Initialize directions with 0 count
      keys.forEach(dir => {
        item[dir] = 0;
        item.activeClients[dir] = 0;
      });

      // Aggregate counts from clients
      allClients.forEach(c => {
        const dir = c.direccion;
        if (!dir || !keys.includes(dir)) return;

        if (!c.redemption_dates || !Array.isArray(c.redemption_dates)) return;

        let clientSatRedemptions = 0;
        c.redemption_dates.forEach((d) => {
          if (d === sat) {
            clientSatRedemptions++;
          }
        });

        if (clientSatRedemptions > 0) {
          item[dir] += clientSatRedemptions;
          item.activeClients[dir] += 1;
          item.totalRedemptions += clientSatRedemptions;
        }
      });

      return item;
    });
  }, [allClients, progressData, useAllTimeData, dateRange, keys]);

  useEffect(() => {
    if (!data || data.length === 0 || keys.length === 0) return;

    const width = containerWidth;
    const height = 350;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.date))
      .range([0, innerWidth])
      .padding(0.35);

    const maxVal = d3.max(data, d => d.totalRedemptions) || 10;
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15]) // 15% padding at top for totals labels
      .range([innerHeight, 0]);

    // Stack generator
    const stack = d3.stack().keys(keys);
    const series = stack(data);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .attr('color', '#444444')
      .selectAll('text')
      .attr('fill', '#aaaaaa')
      .style('font-size', '11px')
      .style('font-weight', '600');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? (d / 1000).toFixed(0) + 'k' : d))
      .attr('color', '#444444')
      .selectAll('text')
      .attr('fill', '#aaaaaa')
      .style('font-size', '11px');

    // Tooltip
    const tooltip = d3.select('body').selectAll('.d3-tooltip').data([0]);
    const tt = tooltip.enter().append('div').attr('class', 'd3-tooltip').merge(tooltip);

    // Draw stacked bars
    g.selectAll('.serie')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'serie')
      .attr('fill', d => DIRECTION_COLORS[d.key] || '#9ca3af')
      .selectAll('rect')
      .data(d => d.map(item => { item.key = d.key; return item; }))
      .enter()
      .append('rect')
      .attr('x', d => x(d.data.date))
      .attr('y', d => y(d[1]))
      .attr('width', x.bandwidth())
      .attr('height', d => y(d[0]) - y(d[1]))
      .attr('rx', 2)
      .on('mouseover', function (event, d) {
        // Brighten color on hover
        d3.select(this).attr('opacity', 0.85);
        const segmentColor = DIRECTION_COLORS[d.key] || '#9ca3af';
        
        tt.style('opacity', 1)
          .html(`
            <div style="font-weight: 700; margin-bottom: 4px; color: #CFA052;">Sábado ${d.data.date}</div>
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 12px; color: ${segmentColor};">${d.key}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 11px; margin-bottom: 3px;">
              <span style="color: #9ca3af;">Canjes:</span>
              <span style="font-weight: 700; color: #fff;">${d.data[d.key].toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 11px;">
              <span style="color: #9ca3af;">Locales Activos:</span>
              <span style="font-weight: 700; color: #4ade80;">${d.data.activeClients[d.key].toLocaleString()}</span>
            </div>
          `);
      })
      .on('mousemove', (event) => {
        tt.style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1.0);
        tt.style('opacity', 0);
      });

    // Formatting totals label helper
    const formatTotalLabel = (val) => {
      if (val >= 1000) {
        const rounded = Math.round(val / 100);
        const kVal = rounded / 10;
        return kVal % 1 === 0 ? `${kVal.toFixed(0)}k` : `${kVal.toFixed(1)}k`;
      }
      return val.toLocaleString();
    };

    // Add total labels at the top of each stacked bar
    g.selectAll('.total-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'total-label')
      .attr('x', d => x(d.date) + x.bandwidth() / 2)
      .attr('y', d => y(d.totalRedemptions) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .style('font-size', '11.5px')
      .style('font-weight', '700')
      .text(d => d.totalRedemptions > 0 ? formatTotalLabel(d.totalRedemptions) : '');

  }, [data, containerWidth, keys]);

  return (
    <div ref={containerRef} className="chart-container" style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '24px',
        marginBottom: '16px',
        padding: '0 8px'
      }}>
        {[...keys].reverse().map(key => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '3px',
              backgroundColor: DIRECTION_COLORS[key] || '#9ca3af'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>
              {key}
            </span>
          </div>
        ))}
      </div>
      {data.length > 0 ? (
        <svg ref={svgRef} width="100%" height="100%"></svg>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-secondary text-center">No hay sábados con datos en el rango seleccionado</p>
        </div>
      )}
    </div>
  );
};
