'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';

export interface OrgUser {
  id: string;
  full_name: string;
  role: string;
  manager_id: string | null;
}

interface OrgChartProps {
  onNodeClick: (user: OrgUser) => void;
  selectedNodeId: string | null;
  refreshKey: number;
  onNodeDrop?: (nodeId: string, newManagerId: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: '#f0a500',
  dyrektor:   '#4a95a9',
  menedzer:   '#2d7a8a',
  partner:    '#1e6070',
  hr:         '#4a6a9a',
  default:    '#1e3448',
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? ROLE_COLORS.default;
}

const VIRTUAL_ROOT_ID = '__root__';

export const OrgChart: React.FC<OrgChartProps> = ({
  onNodeClick,
  selectedNodeId,
  refreshKey,
  onNodeDrop,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/org/users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: OrgUser[] = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Błąd pobierania danych');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // D3 rendering
  useEffect(() => {
    if (loading || error || !svgRef.current || data.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Build hierarchy — handle multiple roots via virtual root
    const roots = data.filter(u => u.manager_id === null);
    const needsVirtualRoot = roots.length !== 1;

    let usersForStratify: OrgUser[];
    if (needsVirtualRoot) {
      const virtualRoot: OrgUser = {
        id: VIRTUAL_ROOT_ID,
        full_name: 'Stratton Prime', // korzeń zastępczy, gdy struktura ma wiele wierzchołków
        role: 'superadmin',
        manager_id: null,
      };
      usersForStratify = [
        virtualRoot,
        ...data.map(u =>
          u.manager_id === null ? { ...u, manager_id: VIRTUAL_ROOT_ID } : u
        ),
      ];
    } else {
      usersForStratify = data;
    }

    let root: d3.HierarchyPointNode<OrgUser>;
    try {
      const stratified = d3
        .stratify<OrgUser>()
        .id(d => d.id)
        .parentId(d => d.manager_id)(usersForStratify);

      const treeLayout = d3.tree<OrgUser>().nodeSize([80, 200]);
      root = treeLayout(stratified) as d3.HierarchyPointNode<OrgUser>;
    } catch {
      setError('Błąd budowania drzewa hierarchii');
      return;
    }

    // Compute bounds to center the tree
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.each(d => {
      if (d.data.id === VIRTUAL_ROOT_ID) return;
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });

    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const treeWidth = maxY - minY + margin.left + margin.right;
    const treeHeight = maxX - minX + margin.top + margin.bottom;

    const initialTranslateX = margin.left - minY + (width - treeWidth) / 2;
    const initialTranslateY = margin.top - minX + (height - treeHeight) / 2;

    // Zoom setup
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.0])
      .on('zoom', event => {
        mainGroup.attr('transform', event.transform.toString());
      });

    svg
      .attr('width', width)
      .attr('height', height)
      .call(zoomBehavior)
      .on('dblclick.zoom', null);

    const mainGroup = svg.append('g')
      .attr('transform', `translate(${initialTranslateX},${initialTranslateY})`);

    // Preview line for drag
    const previewLine = mainGroup.append('line')
      .attr('class', 'drag-preview')
      .attr('stroke', '#f0a500')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3')
      .attr('opacity', 0);

    // Links
    const linkGenerator = d3.linkHorizontal<
      d3.HierarchyPointLink<OrgUser>,
      d3.HierarchyPointNode<OrgUser>
    >()
      .x(d => d.y)
      .y(d => d.x);

    mainGroup.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(root.links().filter(l => l.source.data.id !== VIRTUAL_ROOT_ID))
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('d', linkGenerator);

    // Nodes
    const allNodes = root.descendants().filter(d => d.data.id !== VIRTUAL_ROOT_ID);

    const nodeGroup = mainGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(allNodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        onNodeClick(d.data);
      });

    // Circle
    nodeGroup.append('circle')
      .attr('r', 28)
      .attr('fill', d => getRoleColor(d.data.role))
      .attr('stroke', d => d.data.id === selectedNodeId ? '#f0a500' : 'transparent')
      .attr('stroke-width', d => d.data.id === selectedNodeId ? 3 : 0);

    // Initials text inside circle
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .text(d => {
        const parts = d.data.full_name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return d.data.full_name.slice(0, 2).toUpperCase();
      });

    // Full name below
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 40)
      .attr('fill', '#1e293b')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .text(d => {
        const name = d.data.full_name;
        return name.length > 18 ? name.slice(0, 16) + '…' : name;
      });

    // Role text below name
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 54)
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('pointer-events', 'none')
      .text(d => d.data.role);

    // Drag behavior
    const dragBehavior = d3.drag<SVGGElement, d3.HierarchyPointNode<OrgUser>>()
      .on('start', function (_event, _d) {
        d3.select(this).raise();
      })
      .on('drag', function (event, d) {
        // Move node visually during drag
        const [dx, dy] = [event.x - d.y, event.y - d.x];
        d3.select(this).attr('transform', `translate(${event.x},${event.y})`);

        // Find nearest node within 60px (excluding self and virtual root)
        let nearest: d3.HierarchyPointNode<OrgUser> | null = null;
        let minDist = 60;

        allNodes.forEach(other => {
          if (other.data.id === d.data.id) return;
          const distX = event.x - other.y;
          const distY = event.y - other.x;
          const dist = Math.sqrt(distX * distX + distY * distY);
          if (dist < minDist) {
            minDist = dist;
            nearest = other;
          }
        });

        if (nearest) {
          const n = nearest as d3.HierarchyPointNode<OrgUser>;
          previewLine
            .attr('x1', event.x)
            .attr('y1', event.y)
            .attr('x2', n.y)
            .attr('y2', n.x)
            .attr('opacity', 1);
        } else {
          previewLine.attr('opacity', 0);
        }

        // Suppress unused variable warning
        void dx; void dy;
      })
      .on('end', function (event, d) {
        // Snap back to original position
        d3.select(this).attr('transform', `translate(${d.y},${d.x})`);
        previewLine.attr('opacity', 0);

        // Find nearest node within 60px
        let nearest: d3.HierarchyPointNode<OrgUser> | null = null;
        let minDist = 60;

        allNodes.forEach(other => {
          if (other.data.id === d.data.id) return;
          const distX = event.x - other.y;
          const distY = event.y - other.x;
          const dist = Math.sqrt(distX * distX + distY * distY);
          if (dist < minDist) {
            minDist = dist;
            nearest = other;
          }
        });

        if (nearest && onNodeDrop) {
          const n = nearest as d3.HierarchyPointNode<OrgUser>;
          onNodeDrop(d.data.id, n.data.id);
        }
      });

    nodeGroup.call(dragBehavior);

    // Set initial zoom to fit
    svg.call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(initialTranslateX, initialTranslateY)
    );
  }, [data, loading, error, dimensions, selectedNodeId, onNodeClick, onNodeDrop]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Ładowanie struktury organizacyjnej...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 font-semibold mb-2">Błąd</div>
          <div className="text-slate-500 text-sm">{error}</div>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] overflow-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      />
    </div>
  );
};
