import { useRef, useEffect } from 'react';
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

  }, [data]);

  return (
    <div className="chart-container">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export const DonutChart = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const width = 560;
    const height = 300;
    const radius = 112;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', 'translate(142,150)');

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
      .attr('transform', 'translate(295,56)');

    const legendRows = legend.selectAll('g')
      .data(pieData)
      .enter()
      .append('g')
      .attr('transform', (d, i) => `translate(0,${i * 40})`);

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

  }, [data]);

  return (
    <div className="chart-container flex justify-center items-center">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};
