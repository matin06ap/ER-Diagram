import React, { useState, useEffect, useRef } from 'react';
import { Table, Relationship, Attribute } from './types';

// Helper functions for shape layout and line connection math
function getTableHeight(table: Table): number {
  const visibleAttrs = table.attributes.filter(attr => !attr.fk).length;
  if (visibleAttrs === 0) return 60; // 40 header + 20 body padding
  return 40 + 20 + (visibleAttrs * 26); // 40 header + 20 body padding + attrs * 26
}

interface Point {
  x: number;
  y: number;
}

function getRectIntersection(rect: { x: number, y: number, w: number, h: number }, target: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  
  const dx = target.x - cx;
  const dy = target.y - cy;
  
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  
  // Handle vertical line
  if (dx === 0) {
    return {
      x: cx,
      y: dy > 0 ? rect.y + rect.h : rect.y
    };
  }
  
  // Handle horizontal line
  if (dy === 0) {
    return {
      x: dx > 0 ? rect.x + rect.w : rect.x,
      y: cy
    };
  }
  
  const slope = dy / dx;
  const rectSlope = rect.h / rect.w;
  
  let ix = cx;
  let iy = cy;
  
  if (Math.abs(slope) <= rectSlope) {
    // Intersects left or right boundary
    if (dx > 0) {
      ix = rect.x + rect.w;
      iy = cy + (rect.w / 2) * slope;
    } else {
      ix = rect.x;
      iy = cy - (rect.w / 2) * slope;
    }
  } else {
    // Intersects top or bottom boundary
    if (dy > 0) {
      iy = rect.y + rect.h;
      ix = cx + (rect.h / 2) / slope;
    } else {
      iy = rect.y;
      ix = cx - (rect.h / 2) / slope;
    }
  }
  
  return { x: ix, y: iy };
}

function getDiamondIntersection(center: Point, target: Point): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  
  // The boundary of the diamond rotated by 45 degrees satisfies |x| + |y| = d
  // Side length is 40px, half diagonal is 40 / sqrt(2) = 28.28px.
  // Add 1.2px for half of the 2.5px stroke width to touch perfectly, d = 29.5px.
  const d = 29.5;
  const t = d / (Math.abs(dx) + Math.abs(dy));
  
  return {
    x: center.x + dx * t,
    y: center.y + dy * t
  };
}

function getParallelSegment(x1: number, y1: number, x2: number, y2: number, offset: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x1, y1, x2, y2 };
  const px = -dy / len;
  const py = dx / len;
  return {
    x1: x1 + px * offset,
    y1: y1 + py * offset,
    x2: x2 + px * offset,
    y2: y2 + py * offset,
  };
}

// Default example data generators
function getExampleTables(): Table[] {
  return [
    {
      id: 'tbl_patient',
      name: 'Patient',
      x: 300,
      y: 200,
      attributes: [
        { id: 'attr_p1', name: 'PatientID', type: '', pk: true, fk: false, nullable: false, unique: true },
        { id: 'attr_p2', name: 'FirstName', type: '', pk: false, fk: false, nullable: false, unique: false },
        { id: 'attr_p3', name: 'LastName', type: '', pk: false, fk: false, nullable: false, unique: false },
        { id: 'attr_p4', name: 'BirthDate', type: '', pk: false, fk: false, nullable: true, unique: false },
      ]
    },
    {
      id: 'tbl_visit',
      name: 'Visit',
      x: 700,
      y: 200,
      attributes: [
        { id: 'attr_v1', name: 'VisitID', type: '', pk: true, fk: false, nullable: false, unique: true },
        { id: 'attr_v3', name: 'VisitDate', type: '', pk: false, fk: false, nullable: false, unique: false },
      ]
    }
  ];
}

function getExampleRelationships(): Relationship[] {
  return [
    {
      id: 'rel_patient_visit',
      t1: 'tbl_patient',
      t2: 'tbl_visit',
      name: 'Has',
      cardinality: '1:N',
      mx: null,
      my: null,
      attributes: [
        { id: 'attr_rel_1', name: 'StartDate', type: '', pk: false, fk: false, nullable: true, unique: false }
      ],
      total1: false,
      total2: false,
    }
  ];
}

export default function App() {
  // --- STATE ---
  const [tables, setTables] = useState<Table[]>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.tables) return data.tables;
      } catch (e) {
        console.error('Failed to load tables state:', e);
      }
    }
    return getExampleTables();
  });

  const [relationships, setRelationships] = useState<Relationship[]>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.relationships) return data.relationships;
      } catch (e) {
        console.error('Failed to load relationships state:', e);
      }
    }
    return getExampleRelationships();
  });

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.scale !== undefined) return data.scale;
      } catch (e) {}
    }
    return 1;
  });

  const [panX, setPanX] = useState<number>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.panX !== undefined) return data.panX;
      } catch (e) {}
    }
    return 0;
  });

  const [panY, setPanY] = useState<number>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.panY !== undefined) return data.panY;
      } catch (e) {}
    }
    return 0;
  });

  // CHANGED: Left sidebar closed by default when the app loads (defaults to true)
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.leftCollapsed !== undefined) return data.leftCollapsed;
      } catch (e) {}
    }
    return true; // Make the left sidebar closed by default on load
  });

  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('erd_save_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.rightCollapsed !== undefined) return data.rightCollapsed;
      } catch (e) {}
    }
    return false;
  });

  // CHANGED: Floating Guide bubble close state persisted in localStorage
  const [guideHidden, setGuideHidden] = useState<boolean>(() => {
    return localStorage.getItem('erd_guide_hidden') === 'true';
  });

  // Dragging Interaction State
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [draggedRelId, setDraggedRelId] = useState<string | null>(null);
  const [draggedRelAttr, setDraggedRelAttr] = useState<{ relId: string; attrId: string } | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const dragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Connection Form State
  const [relT1, setRelT1] = useState<string>('');
  const [relT2, setRelT2] = useState<string>('');
  const [relCard, setRelCard] = useState<string>('1:N');
  const [relName, setRelName] = useState<string>('');

  // Sync form options when tables change
  useEffect(() => {
    if (tables.length > 0) {
      if (!relT1 || !tables.some(t => t.id === relT1)) {
        setRelT1(tables[0].id);
      }
      if (!relT2 || !tables.some(t => t.id === relT2)) {
        setRelT2(tables[1]?.id || tables[0].id);
      }
    } else {
      setRelT1('');
      setRelT2('');
    }
  }, [tables]);

  // --- AUTO-SAVE ---
  useEffect(() => {
    const state = {
      tables,
      relationships,
      scale,
      panX,
      panY,
      leftCollapsed,
      rightCollapsed,
    };
    localStorage.setItem('erd_save_data', JSON.stringify(state));
  }, [tables, relationships, scale, panX, panY, leftCollapsed, rightCollapsed]);

  // --- ZOOM HANDLING via Wheel (Passive: false support) ---
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomAmount = 0.05;
      if (e.deltaY < 0) {
        setScale(s => Math.min(s + zoomAmount, 2));
      } else {
        setScale(s => Math.max(s - zoomAmount, 0.3));
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // --- DRAG AND PAN HANDLING ---
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPanX(dragStart.current.itemX + dx);
        setPanY(dragStart.current.itemY + dy);
      } else if (draggedTableId) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setTables(prev => prev.map(t => {
          if (t.id === draggedTableId) {
            return {
              ...t,
              x: dragStart.current.itemX + dx / scale,
              y: dragStart.current.itemY + dy / scale,
            };
          }
          return t;
        }));
      } else if (draggedRelId) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setRelationships(prev => prev.map(r => {
          if (r.id === draggedRelId) {
            return {
              ...r,
              mx: dragStart.current.itemX + dx / scale,
              my: dragStart.current.itemY + dy / scale,
            };
          }
          return r;
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggedTableId(null);
      setDraggedRelId(null);
      setDraggedRelAttr(null);
    };

    if (isPanning || draggedTableId || draggedRelId || draggedRelAttr) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggedTableId, draggedRelId, draggedRelAttr, scale]);

  // --- ACTIONS ---
  const handleSaveManual = () => {
    const state = {
      tables,
      relationships,
      scale,
      panX,
      panY,
      leftCollapsed,
      rightCollapsed,
    };
    localStorage.setItem('erd_save_data', JSON.stringify(state));
    alert('Diagram Saved Successfully!');
  };

  const handleClearSaved = () => {
    localStorage.removeItem('erd_save_data');
    localStorage.removeItem('erd_guide_hidden');
    setTables(getExampleTables());
    setRelationships(getExampleRelationships());
    setScale(1);
    setPanX(0);
    setPanY(0);
    setLeftCollapsed(true);
    setRightCollapsed(false);
    setGuideHidden(false);
  };

  const handleAddTable = () => {
    const id = 'tbl_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const newTable: Table = {
      id,
      name: `Entity_${tables.length + 1}`,
      x: 100 - panX,
      y: 100 - panY,
      attributes: [],
    };
    setTables(prev => [...prev, newTable]);
  };

  const handleDeleteTable = (tableId: string) => {
    setTables(prev => prev.filter(t => t.id !== tableId));
    setRelationships(prev => prev.filter(r => r.t1 !== tableId && r.t2 !== tableId));
  };

  const handleUpdateTableName = (tableId: string, name: string) => {
    if (!name.trim()) return;
    const formatted = name.charAt(0).toUpperCase() + name.slice(1);
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, name: formatted } : t));
  };

  const handleAddNewAttribute = (tableId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const newAttr: Attribute = {
          id: 'attr_' + Date.now() + Math.random().toString(36).substr(2, 5),
          name: 'NewAttr',
          type: '',
          pk: false,
          fk: false,
          nullable: false,
          unique: false,
        };
        return {
          ...t,
          attributes: [...t.attributes, newAttr],
        };
      }
      return t;
    }));
  };

  const handleUpdateAttribute = (tableId: string, attrId: string, field: keyof Attribute, value: any) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          attributes: t.attributes.map(a => a.id === attrId ? { ...a, [field]: value } : a),
        };
      }
      return t;
    }));
  };

  const handleDeleteAttribute = (tableId: string, attrId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          attributes: t.attributes.filter(a => a.id !== attrId),
        };
      }
      return t;
    }));
  };

  const handleAddRelationship = () => {
    if (!relT1 || !relT2) {
      alert("Select two tables.");
      return;
    }

    // CHANGED: Removed the condition blocking t1 === t2 to allow self-relationships
    const name = relName.trim() || 'Relates To';
    const newRel: Relationship = {
      id: 'rel_' + Date.now() + Math.random().toString(36).substr(2, 5),
      t1: relT1,
      t2: relT2,
      name,
      cardinality: relCard,
      mx: null,
      my: null,
    };
    setRelationships(prev => [...prev, newRel]);
    setRelName('');
  };

  const handleDeleteRelationship = (relId: string) => {
    setRelationships(prev => prev.filter(r => r.id !== relId));
  };

  const handleToggleRelTotal = (relId: string, side: 1 | 2, checked: boolean) => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        return side === 1 ? { ...r, total1: checked } : { ...r, total2: checked };
      }
      return r;
    }));
  };

  const handleAddNewRelAttribute = (relId: string) => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        const newAttr: Attribute = {
          id: 'attr_' + Date.now() + Math.random().toString(36).substr(2, 5),
          name: 'NewAttr',
          type: '',
          pk: false,
          fk: false,
          nullable: true,
          unique: false,
        };
        const currentAttrs = r.attributes || [];
        return {
          ...r,
          attributes: [...currentAttrs, newAttr],
        };
      }
      return r;
    }));
  };

  const handleUpdateRelAttribute = (relId: string, attrId: string, value: string) => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        const currentAttrs = r.attributes || [];
        return {
          ...r,
          attributes: currentAttrs.map(a => a.id === attrId ? { ...a, name: value } : a)
        };
      }
      return r;
    }));
  };

  const handleDeleteRelAttribute = (relId: string, attrId: string) => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        const currentAttrs = r.attributes || [];
        return {
          ...r,
          attributes: currentAttrs.filter(a => a.id !== attrId)
        };
      }
      return r;
    }));
  };

  const handleReorderRelAttribute = (relId: string, attrId: string, direction: 'up' | 'down') => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        const currentAttrs = r.attributes || [];
        const index = currentAttrs.findIndex(a => a.id === attrId);
        if (index === -1) return r;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentAttrs.length) return r;
        
        const updatedAttrs = [...currentAttrs];
        const temp = updatedAttrs[index];
        updatedAttrs[index] = updatedAttrs[targetIndex];
        updatedAttrs[targetIndex] = temp;
        
        return {
          ...r,
          attributes: updatedAttrs,
        };
      }
      return r;
    }));
  };

  const handleMoveRelAttribute = (relId: string, draggedId: string, targetIndex: number) => {
    setRelationships(prev => prev.map(r => {
      if (r.id === relId) {
        const currentAttrs = r.attributes || [];
        const index = currentAttrs.findIndex(a => a.id === draggedId);
        if (index === -1) return r;
        
        const updatedAttrs = [...currentAttrs];
        const [moved] = updatedAttrs.splice(index, 1);
        updatedAttrs.splice(targetIndex, 0, moved);
        
        return {
          ...r,
          attributes: updatedAttrs,
        };
      }
      return r;
    }));
  };

  const handleRelAttrMouseEnter = (relId: string, attrId: string) => {
    if (!draggedRelAttr || draggedRelAttr.relId !== relId || draggedRelAttr.attrId === attrId) return;
    
    const rel = relationships.find(r => r.id === relId);
    if (!rel || !rel.attributes) return;
    
    const hoverIdx = rel.attributes.findIndex(a => a.id === attrId);
    if (hoverIdx === -1) return;
    
    handleMoveRelAttribute(relId, draggedRelAttr.attrId, hoverIdx);
  };

  const handleCloseGuidePermanently = () => {
    // CHANGED: Permanently hides the guide element
    setGuideHidden(true);
    localStorage.setItem('erd_guide_hidden', 'true');
  };

  // --- EXPORT STATIC ERD ---
  const handleExportStatic = () => {
    // Export output keeps the exact structure but omits left panel, right panel, and edit UI
    const polylinesHtml = relationships.map(rel => {
      const t1 = tables.find(t => t.id === rel.t1);
      const t2 = tables.find(t => t.id === rel.t2);
      if (!t1 || !t2) return '';

      const t1h = getTableHeight(t1);
      const t2h = getTableHeight(t2);
      const t1c = { x: t1.x + 110, y: t1.y + t1h / 2 };
      const t2c = { x: t2.x + 110, y: t2.y + t2h / 2 };

      const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (t1c.x + t2c.x) / 2);
      const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);
      const m = { x: mx, y: my };

      let edge1: Point;
      let edge2: Point;
      let dia1: Point;
      let dia2: Point;

      if (t1.id === t2.id) {
        edge1 = { x: t1.x + 50, y: t1.y };
        edge2 = { x: t1.x + 170, y: t1.y };
        dia1 = getDiamondIntersection(m, edge1);
        dia2 = getDiamondIntersection(m, edge2);
      } else {
        edge1 = getRectIntersection({ x: t1.x, y: t1.y, w: 220, h: t1h }, m);
        edge2 = getRectIntersection({ x: t2.x, y: t2.y, w: 220, h: t2h }, m);
        dia1 = getDiamondIntersection(m, t1c);
        dia2 = getDiamondIntersection(m, t2c);
      }

      // Determine segments to draw (double line if total participation is enabled)
      const line1Segments = rel.total1 ? [
        getParallelSegment(edge1.x, edge1.y, dia1.x, dia1.y, -2.5),
        getParallelSegment(edge1.x, edge1.y, dia1.x, dia1.y, 2.5),
      ] : [
        { x1: edge1.x, y1: edge1.y, x2: dia1.x, y2: dia1.y }
      ];

      const line2Segments = rel.total2 ? [
        getParallelSegment(edge2.x, edge2.y, dia2.x, dia2.y, -2.5),
        getParallelSegment(edge2.x, edge2.y, dia2.x, dia2.y, 2.5),
      ] : [
        { x1: edge2.x, y1: edge2.y, x2: dia2.x, y2: dia2.y }
      ];

      // Parse cardinality
      const cardParts = rel.cardinality.split(':');
      const c1 = cardParts[0] || '1';
      const c2 = cardParts[1] || 'N';

      // Smart cardinality positions (fixed distance of 20px from boundary if line is long enough)
      const dx1 = dia1.x - edge1.x;
      const dy1 = dia1.y - edge1.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const label1X = len1 > 45 ? edge1.x + (dx1 / len1) * 20 : edge1.x + dx1 * 0.4;
      const label1Y = len1 > 45 ? edge1.y + (dy1 / len1) * 20 : edge1.y + dy1 * 0.4;

      const dx2 = dia2.x - edge2.x;
      const dy2 = dia2.y - edge2.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const label2X = len2 > 45 ? edge2.x + (dx2 / len2) * 20 : edge2.x + dx2 * 0.4;
      const label2Y = len2 > 45 ? edge2.y + (dy2 / len2) * 20 : edge2.y + dy2 * 0.4;

      const hasAttrs = rel.attributes && rel.attributes.length > 0;
      const attrBoxX = mx + 60;
      const attrBoxY = my - 40;

      const lines1Html = line1Segments.map(seg => `
        <line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" class="rel-line"></line>
      `).join('\n');

      const lines2Html = line2Segments.map(seg => `
        <line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" class="rel-line"></line>
      `).join('\n');

      const dashedConnectorHtml = hasAttrs ? `
        <line x1="${mx}" y1="${my}" x2="${attrBoxX}" y2="${attrBoxY + 12}" stroke="#6366f1" stroke-dasharray="4,4" stroke-width="1.5"></line>
      ` : '';

      return `
        ${dashedConnectorHtml}
        ${lines1Html}
        ${lines2Html}
        <text x="${label1X}" y="${label1Y}" fill="#6366f1" font-size="13" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="paint-order: stroke; stroke: #0a0a0a; stroke-width: 4px; stroke-linecap: butt; stroke-linejoin: miter; user-select: none;">${c1}</text>
        <text x="${label2X}" y="${label2Y}" fill="#6366f1" font-size="13" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="paint-order: stroke; stroke: #0a0a0a; stroke-width: 4px; stroke-linecap: butt; stroke-linejoin: miter; user-select: none;">${c2}</text>
      `;
    }).join('\n');

    const tablesHtml = tables.map((table, index) => {
      // Filter out any foreign key attributes and remove datatype rendering
      const attrsHtml = table.attributes.filter(attr => !attr.fk).map(attr => {
        let icons = '';
        if (attr.pk) icons += `<span class="icon pk" title="Primary Key">🔑</span>`;
        if (attr.unique) icons += `<span class="icon unique" title="Unique">⭐</span>`;
        if (attr.nullable) icons += `<span class="icon nullable" title="Nullable">○</span>`;

        return `
          <div class="attr-line">
            <div class="attr-icons">${icons}</div>
            <div class="attr-name">${attr.name}</div>
          </div>
        `;
      }).join('\n');

      return `
        <div class="table-node" id="node_${table.id}" style="left: ${table.x}px; top: ${table.y}px; z-index: ${index + 10}; cursor: default;">
          <div class="table-node-header" style="cursor: default;">
            <span>${table.name}</span>
            <div style="display: flex; gap: 6px; opacity: 0.6;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #6b7280;"></div>
              <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #6b7280;"></div>
            </div>
          </div>
          <div class="table-node-body">${attrsHtml}</div>
        </div>
      `;
    }).join('\n');

    const relsHtml = relationships.map(rel => {
      const t1 = tables.find(t => t.id === rel.t1);
      const t2 = tables.find(t => t.id === rel.t2);
      if (!t1 || !t2) return '';

      const t1h = getTableHeight(t1);
      const t2h = getTableHeight(t2);
      const t1c = { x: t1.x + 110, y: t1.y + t1h / 2 };
      const t2c = { x: t2.x + 110, y: t2.y + t2h / 2 };

      const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (t1c.x + t2c.x) / 2);
      const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);

      const hasAttrs = rel.attributes && rel.attributes.length > 0;
      let attrsBoxHtml = '';
      if (hasAttrs) {
        const itemsHtml = (rel.attributes || []).map(attr => `
          <div class="rel-attr-item">
            <span class="rel-attr-bullet">○</span>
            <span>${attr.name}</span>
          </div>
        `).join('\n');

        attrsBoxHtml = `
          <div class="rel-attr-box" style="left: ${mx + 60}px; top: ${my - 40}px;">
            ${itemsHtml}
          </div>
        `;
      }

      return `
        <div class="rel-node" id="rel_node_${rel.id}" style="left: ${mx}px; top: ${my}px; cursor: help;">
          <div class="rel-diamond-shape"></div>
          <div class="rel-text-label">${rel.name.substring(0, 5)}</div>
          <div class="rel-tooltip">
            <div class="rel-tooltip-title">${rel.name}</div>
            <div class="rel-tooltip-body">
              <strong>From:</strong> ${t1.name}<br>
              <strong>To:</strong> ${t2.name}<br>
              <strong>Cardinality:</strong> ${rel.cardinality}
            </div>
          </div>
        </div>
        ${attrsBoxHtml}
      `;
    }).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported ERD - StructView</title>
    <style>
        :root {
            --bg-dark: #0a0a0a;
            --panel-dark: #121212;
            --border-color: #262626;
            --accent-blue: #3b82f6;
            --accent-blue-hover: #2563eb;
            --accent-purple: #6366f1;
            --text-main: #d1d5db;
            --text-muted: #6b7280;
            --card-bg: #161616;
            --font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            --color-pk: #ecc94b;
            --color-fk: #4fd1c5;
            --color-unique: #b794f4;
            --color-nullable: #718096;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: auto; background-color: var(--bg-dark); cursor: default; font-family: var(--font-family); color: var(--text-main); }
        .canvas-viewport { position: relative; width: 100vw; height: 100vh; overflow: auto; background-image: radial-gradient(var(--border-color) 1px, transparent 1px); background-size: 20px 20px; }
        .canvas { position: absolute; transform-origin: 0 0; width: 5000px; height: 5000px; }
        #svg-layer, #tables-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        #svg-layer { pointer-events: none; z-index: 1; }
        #tables-layer { z-index: 2; pointer-events: none; }
        .table-node { position: absolute; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; width: 220px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6); overflow: hidden; pointer-events: auto; }
        .table-node:hover { border-color: var(--accent-blue); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.2); z-index: 100 !important; }
        .table-node-header { background: #1a1a1a; color: var(--accent-blue); border-bottom: 1px solid var(--border-color); padding: 10px; font-weight: bold; font-family: monospace; text-align: center; height: 40px; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; padding-right: 14px; }
        .table-node-body { padding: 10px; }
        .attr-line { display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; }
        .attr-line:last-child { border-bottom: none; }
        .attr-icons { display: flex; gap: 4px; width: 45px; }
        .attr-name { flex: 1; font-family: monospace; font-size: 0.9rem;}
        .attr-type { color: var(--text-muted); font-size: 0.75rem; }
        .rel-node { position: absolute; width: 60px; height: 40px; margin-left: -30px; margin-top: -20px; display: flex; align-items: center; justify-content: center; pointer-events: auto; z-index: 50; }
        .rel-diamond-shape { position: absolute; width: 40px; height: 40px; background: var(--card-bg); border: 2px solid var(--accent-purple); transform: rotate(45deg); transition: background 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .rel-node:hover .rel-diamond-shape { background: var(--accent-purple); }
        .rel-text-label { position: relative; color: var(--text-main); font-size: 11px; font-weight: bold; user-select: none; z-index: 2; pointer-events: none; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .rel-tooltip { position: absolute; top: 50px; left: 50%; transform: translateX(-50%); background: var(--panel-dark); border: 1px solid var(--accent-purple); padding: 12px; border-radius: 8px; width: max-content; box-shadow: 0 8px 25px rgba(0,0,0,0.7); backdrop-filter: blur(8px); opacity: 0; visibility: hidden; transition: opacity 0.2s, top 0.2s; pointer-events: none; z-index: 200; }
        .rel-node:hover .rel-tooltip { opacity: 1; visibility: visible; top: 35px; }
        .rel-tooltip-title { color: var(--accent-purple); font-weight: bold; font-size: 1rem; margin-bottom: 5px; }
        .rel-tooltip-body { color: var(--text-muted); font-size: 0.85rem; line-height: 1.4; }
        .rel-tooltip-body strong { color: var(--text-main); }
        .rel-line { stroke: var(--accent-purple); stroke-width: 2.5; fill: none; stroke-linejoin: round; }
        .rel-attr-box { position: absolute; background: #111111; border: 1.5px dashed var(--accent-purple); border-radius: 6px; padding: 6px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: none; z-index: 45; display: flex; flex-direction: column; gap: 4px; min-width: 90px; }
        .rel-attr-title { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; border-bottom: 1px solid #222222; padding-bottom: 2px; margin-bottom: 2px; }
        .rel-attr-item { font-size: 0.75rem; color: var(--text-main); font-family: monospace; display: flex; align-items: center; gap: 4px; }
        .rel-attr-bullet { color: var(--accent-purple); }
        .icon.pk { color: var(--color-pk); }
        .icon.fk { color: var(--color-fk); }
        .icon.unique { color: var(--color-unique); }
        .icon.nullable { color: var(--color-nullable); }
        .icon.rel { color: var(--accent-purple); }
    </style>
</head>
<body>
    <div class="canvas-viewport">
        <div class="canvas" style="transform: scale(${scale}); top: ${-panY}px; left: ${-panX}px;">
            <svg id="svg-layer">${polylinesHtml}</svg>
            <div id="tables-layer">
                ${tablesHtml}
                ${relsHtml}
            </div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERD_Export_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- MOUSE LISTENERS ---
  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    setDraggedTableId(tableId);
    const table = tables.find(t => t.id === tableId);
    if (table) {
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: table.x,
        itemY: table.y,
      };
    }
  };

  const handleRelMouseDown = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    setDraggedRelId(relId);
    const rel = relationships.find(r => r.id === relId);
    if (rel) {
      const t1 = tables.find(t => t.id === rel.t1);
      const t2 = tables.find(t => t.id === rel.t2);
      if (t1 && t2) {
        let x1 = t1.x + 110;
        let x2 = t2.x + 110;
        let y1 = t1.y + 20;
        let y2 = t2.y + 20;
        if (t1.id === t2.id) {
          x1 = t1.x + 50;
          x2 = t1.x + 170;
        }
        const currentMx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (x1 + x2) / 2);
        const currentMy = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (y1 + y2) / 2);
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          itemX: currentMx,
          itemY: currentMy,
        };
      }
    }
  };

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === viewportRef.current || target.id === 'canvas' || target.id === 'svg-layer' || target.id === 'tables-layer') {
      setIsPanning(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: panX,
        itemY: panY,
      };
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0A0A0A] text-gray-300 font-sans overflow-hidden select-none" id="app-container">
      {/* Header Navigation */}
      <header className="h-14 border-b border-[#262626] bg-[#121212] flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-md shadow-blue-900/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <h1 className="text-base font-semibold tracking-tight text-gray-100 flex items-center gap-2">
            StructView
            <span className="text-[10px] font-mono font-normal text-gray-500 bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#2d2d2d]">v2.4.1</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handleSaveManual} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors cursor-pointer font-medium">
            Save Layout
          </button>
          <button onClick={handleClearSaved} className="px-3 py-1.5 text-xs bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded border border-red-900/40 transition-colors cursor-pointer font-medium">
            Reset Canvas
          </button>
          <button onClick={handleExportStatic} className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors shadow-lg shadow-blue-900/20 cursor-pointer">
            Export Static HTML
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL: Manage Tables and Relationships */}
        <aside className={`panel left-panel ${leftCollapsed ? 'collapsed' : ''}`} id="left-panel">
          <div className="panel-header">
            <h2>ERD Manager</h2>
          </div>

        <div className="panel-section">
          <div className="section-title">
            <h3>Tables</h3>
            <button id="add-table-btn" className="btn btn-primary btn-sm" onClick={handleAddTable}>+ Add</button>
          </div>
          <div id="sidebar-tables-list" className="list-container">
            {tables.map(table => (
              <div className="sidebar-item" key={table.id}>
                <div className="sidebar-item-header">
                  <input
                    type="text"
                    className="input-field"
                    style={{ margin: 0, width: '60%' }}
                    value={table.name}
                    onChange={(e) => handleUpdateTableName(table.id, e.target.value)}
                  />
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteTable(table.id)}>Del</button>
                </div>
                
                <div className="sidebar-item-body">
                  {table.attributes.filter(attr => !attr.fk).map(attr => (
                    <div className="attr-row" key={attr.id}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ margin: 0 }}
                        value={attr.name}
                        onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'name', e.target.value)}
                        placeholder="Name"
                      />
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAttribute(table.id, attr.id)}>X</button>
                      <div style={{ gridColumn: 'span 2', display: 'flex', gap: '5px', fontSize: '12px', marginBottom: '10px' }}>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={attr.pk} onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'pk', e.target.checked)} /> PK
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={attr.unique} onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'unique', e.target.checked)} /> UQ
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={attr.nullable} onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'nullable', e.target.checked)} /> NULL
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-sm" style={{ width: '100%', marginTop: '10px' }} onClick={() => handleAddNewAttribute(table.id)}>+ Add Attribute</button>
              </div>
            ))}
          </div>
        </div>

        <hr className="divider" />

        <div className="panel-section">
          <div className="section-title">
            <h3>Relationships</h3>
          </div>
          <div className="form-group row">
            <select id="rel-t1" className="input-field" value={relT1} onChange={(e) => setRelT1(e.target.value)}>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select id="rel-card" className="input-field narrow" value={relCard} onChange={(e) => setRelCard(e.target.value)}>
              <option value="1:1">1:1</option>
              <option value="1:N">1:N</option>
              <option value="N:1">N:1</option>
              <option value="N:M">N:M</option>
            </select>
            <select id="rel-t2" className="input-field" value={relT2} onChange={(e) => setRelT2(e.target.value)}>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group row">
            <input
              type="text"
              id="rel-name"
              className="input-field"
              placeholder="e.g., Has, Belongs To"
              value={relName}
              onChange={(e) => setRelName(e.target.value)}
            />
            <button id="add-relationship-btn" className="btn btn-secondary" onClick={handleAddRelationship}>Connect</button>
          </div>
          <div id="sidebar-rel-list" className="list-container">
            {relationships.map(rel => {
              const t1 = tables.find(t => t.id === rel.t1);
              const t2 = tables.find(t => t.id === rel.t2);
              if (!t1 || !t2) return null;
              return (
                <div className="sidebar-item" key={rel.id}>
                  <div className="sidebar-item-header">
                    <span style={{ fontSize: '0.85rem' }}>
                      {t1.name} <strong style={{ color: 'var(--accent-purple)' }}>[{rel.cardinality}]</strong> {t2.name}
                    </span>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRelationship(rel.id)}>X</button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Name: {rel.name}</div>

                  {/* Participation Toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', marginBottom: '8px' }}>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!rel.total1}
                        onChange={(e) => handleToggleRelTotal(rel.id, 1, e.target.checked)}
                      />
                      <span>Total Participation ({t1.name})</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!rel.total2}
                        onChange={(e) => handleToggleRelTotal(rel.id, 2, e.target.checked)}
                      />
                      <span>Total Participation ({t2.name})</span>
                    </label>
                  </div>

                  {/* Relationship Attributes Management */}
                  <div style={{ borderTop: '1px solid #222', paddingTop: '6px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Attributes</span>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={() => handleAddNewRelAttribute(rel.id)}
                      >
                        + Add Attr
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(rel.attributes || []).map((attr, idx) => (
                        <div
                          key={attr.id}
                          style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', attr.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId !== attr.id) {
                              const targetIdx = (rel.attributes || []).findIndex(a => a.id === attr.id);
                              if (targetIdx !== -1) {
                                handleMoveRelAttribute(rel.id, draggedId, targetIdx);
                              }
                            }
                          }}
                        >
                          <span
                            className="cursor-grab text-gray-500 hover:text-gray-300 select-none text-[11px] px-1"
                            title="Drag to reorder"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            ☰
                          </span>
                          <input
                            type="text"
                            className="input-field"
                            style={{ margin: 0, padding: '2px 4px', fontSize: '11px', flex: 1 }}
                            value={attr.name}
                            placeholder="Attr Name"
                            onChange={(e) => handleUpdateRelAttribute(rel.id, attr.id, e.target.value)}
                          />
                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 4px', fontSize: '10px' }}
                            onClick={() => handleReorderRelAttribute(rel.id, attr.id, 'up')}
                            disabled={idx === 0}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '2px 4px', fontSize: '10px' }}
                            onClick={() => handleReorderRelAttribute(rel.id, attr.id, 'down')}
                            disabled={idx === (rel.attributes || []).length - 1}
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={() => handleDeleteRelAttribute(rel.id, attr.id)}
                            title="Delete Attribute"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Toggle for Left Panel */}
      <button
        id="toggle-left"
        className="panel-toggle toggle-left"
        title="Toggle Left Panel"
        onClick={() => setLeftCollapsed(!leftCollapsed)}
        style={{ left: leftCollapsed ? '10px' : '308px', transform: leftCollapsed ? 'rotate(180deg)' : 'none' }}
      >
        ◀
      </button>

      {/* CENTER PANEL: ERD Canvas */}
      <main
        className="canvas-viewport"
        id="canvas-viewport"
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
      >
        <div
          className="canvas"
          id="canvas"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          }}
        >
          {/* SVG Layer for drawing relationship lines */}
          <svg id="svg-layer">
            {relationships.map(rel => {
              const t1 = tables.find(t => t.id === rel.t1);
              const t2 = tables.find(t => t.id === rel.t2);
              if (!t1 || !t2) return null;

              const t1h = getTableHeight(t1);
              const t2h = getTableHeight(t2);
              const t1c = { x: t1.x + 110, y: t1.y + t1h / 2 };
              const t2c = { x: t2.x + 110, y: t2.y + t2h / 2 };

              const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (t1c.x + t2c.x) / 2);
              const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);
              const m = { x: mx, y: my };

              let edge1: Point;
              let edge2: Point;
              let dia1: Point;
              let dia2: Point;

              if (t1.id === t2.id) {
                // Self relationship connection points at top-left and top-right of table
                edge1 = { x: t1.x + 50, y: t1.y };
                edge2 = { x: t1.x + 170, y: t1.y };
                dia1 = getDiamondIntersection(m, edge1);
                dia2 = getDiamondIntersection(m, edge2);
              } else {
                edge1 = getRectIntersection({ x: t1.x, y: t1.y, w: 220, h: t1h }, m);
                edge2 = getRectIntersection({ x: t2.x, y: t2.y, w: 220, h: t2h }, m);
                dia1 = getDiamondIntersection(m, t1c);
                dia2 = getDiamondIntersection(m, t2c);
              }

              // Determine segments to draw (double line if total participation is enabled)
              const line1Segments = rel.total1 ? [
                getParallelSegment(edge1.x, edge1.y, dia1.x, dia1.y, -2.5),
                getParallelSegment(edge1.x, edge1.y, dia1.x, dia1.y, 2.5),
              ] : [
                { x1: edge1.x, y1: edge1.y, x2: dia1.x, y2: dia1.y }
              ];

              const line2Segments = rel.total2 ? [
                getParallelSegment(edge2.x, edge2.y, dia2.x, dia2.y, -2.5),
                getParallelSegment(edge2.x, edge2.y, dia2.x, dia2.y, 2.5),
              ] : [
                { x1: edge2.x, y1: edge2.y, x2: dia2.x, y2: dia2.y }
              ];

              // Parse cardinality
              const cardParts = rel.cardinality.split(':');
              const c1 = cardParts[0] || '1';
              const c2 = cardParts[1] || 'N';

              // Smart cardinality positions (fixed distance of 20px from boundary if line is long enough)
              const dx1 = dia1.x - edge1.x;
              const dy1 = dia1.y - edge1.y;
              const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
              const label1X = len1 > 45 ? edge1.x + (dx1 / len1) * 20 : edge1.x + dx1 * 0.4;
              const label1Y = len1 > 45 ? edge1.y + (dy1 / len1) * 20 : edge1.y + dy1 * 0.4;

              const dx2 = dia2.x - edge2.x;
              const dy2 = dia2.y - edge2.y;
              const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              const label2X = len2 > 45 ? edge2.x + (dx2 / len2) * 20 : edge2.x + dx2 * 0.4;
              const label2Y = len2 > 45 ? edge2.y + (dy2 / len2) * 20 : edge2.y + dy2 * 0.4;

              const hasAttrs = rel.attributes && rel.attributes.length > 0;
              const attrBoxX = mx + 60;
              const attrBoxY = my - 40;

              return (
                <g key={rel.id}>
                  {/* Dashed connector to relationship attributes box */}
                  {hasAttrs && (
                    <line
                      x1={mx}
                      y1={my}
                      x2={attrBoxX}
                      y2={attrBoxY + 12}
                      stroke="#6366f1"
                      strokeDasharray="4,4"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Table 1 to Relationship Diamond line(s) */}
                  {line1Segments.map((seg, i) => (
                    <line
                      key={`l1_${i}`}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      className="rel-line"
                    />
                  ))}

                  {/* Table 2 to Relationship Diamond line(s) */}
                  {line2Segments.map((seg, i) => (
                    <line
                      key={`l2_${i}`}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      className="rel-line"
                    />
                  ))}

                  {/* Cardinality 1 Label */}
                  <text
                    x={label1X}
                    y={label1Y}
                    fill="#6366f1"
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a0a0a',
                      strokeWidth: '4px',
                      strokeLinecap: 'butt',
                      strokeLinejoin: 'miter',
                      userSelect: 'none',
                    }}
                  >
                    {c1}
                  </text>
                  {/* Cardinality 2 Label */}
                  <text
                    x={label2X}
                    y={label2Y}
                    fill="#6366f1"
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a0a0a',
                      strokeWidth: '4px',
                      strokeLinecap: 'butt',
                      strokeLinejoin: 'miter',
                      userSelect: 'none',
                    }}
                  >
                    {c2}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Elements for Tables and Relationship Diamonds */}
          <div id="tables-layer">
            {tables.map((table, index) => (
              <div
                className={`table-node ${draggedTableId === table.id ? 'dragging' : ''}`}
                id={`node_${table.id}`}
                key={table.id}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  zIndex: draggedTableId === table.id ? 100 : index + 10,
                }}
              >
                <div
                  className="table-node-header"
                  id={`header_${table.id}`}
                  onMouseDown={(e) => handleTableMouseDown(e, table.id)}
                >
                  <span>{table.name}</span>
                  <div className="flex gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                  </div>
                </div>
                <div className="table-node-body">
                  {table.attributes.filter(attr => !attr.fk).map(attr => {
                    let icons = [];
                    if (attr.pk) icons.push(<span className="icon pk" title="Primary Key" key="pk">🔑</span>);
                    if (attr.unique) icons.push(<span className="icon unique" title="Unique" key="uq">⭐</span>);
                    if (attr.nullable) icons.push(<span className="icon nullable" title="Nullable" key="null">○</span>);

                    return (
                      <div className="attr-line" key={attr.id}>
                        <div className="attr-icons">{icons}</div>
                        <div className="attr-name">{attr.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {relationships.map(rel => {
              const t1 = tables.find(t => t.id === rel.t1);
              const t2 = tables.find(t => t.id === rel.t2);
              if (!t1 || !t2) return null;

              let x1 = t1.x + 110;
              let y1 = t1.y + 20;
              let x2 = t2.x + 110;
              let y2 = t2.y + 20;

              if (t1.id === t2.id) {
                x1 = t1.x + 50;
                x2 = t1.x + 170;
              }

              const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (x1 + x2) / 2);
              const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (y1 + y2) / 2);

              const hasAttrs = rel.attributes && rel.attributes.length > 0;

              return (
                <React.Fragment key={rel.id}>
                  <div
                    className={`rel-node ${draggedRelId === rel.id ? 'dragging' : ''}`}
                    id={`rel_node_${rel.id}`}
                    style={{
                      left: `${mx}px`,
                      top: `${my}px`,
                      zIndex: draggedRelId === rel.id ? 110 : 50,
                    }}
                    onMouseDown={(e) => handleRelMouseDown(e, rel.id)}
                  >
                    <div className="rel-diamond-shape"></div>
                    <div className="rel-text-label">{rel.name.substring(0, 5)}</div>
                    <div className="rel-tooltip">
                      <div className="rel-tooltip-title">{rel.name}</div>
                      <div className="rel-tooltip-body">
                        <strong>From:</strong> {t1.name}<br />
                        <strong>To:</strong> {t2.name}<br />
                        <strong>Cardinality:</strong> {rel.cardinality}
                      </div>
                    </div>
                  </div>

                   {/* Relationship Attribute Box */}
                   {hasAttrs && (
                     <div
                       className="rel-attr-box"
                       style={{
                         left: `${mx + 60}px`,
                         top: `${my - 40}px`,
                         pointerEvents: 'auto',
                       }}
                       onMouseDown={(e) => e.stopPropagation()}
                     >
                       {rel.attributes?.map((attr) => {
                         const isBeingDragged = draggedRelAttr?.relId === rel.id && draggedRelAttr?.attrId === attr.id;
                         return (
                           <div
                             key={attr.id}
                             className={`rel-attr-item cursor-grab select-none active:cursor-grabbing hover:bg-white/5 px-1 rounded transition-colors ${
                               isBeingDragged ? 'opacity-40 border border-dashed border-[#6366f1] bg-[#6366f1]/10' : ''
                             }`}
                             onMouseDown={(e) => {
                               e.stopPropagation();
                               e.preventDefault();
                               setDraggedRelAttr({ relId: rel.id, attrId: attr.id });
                             }}
                             onMouseEnter={() => handleRelAttrMouseEnter(rel.id, attr.id)}
                           >
                             <span className="rel-attr-bullet">○</span>
                             <span>{attr.name}</span>
                           </div>
                         );
                       })}
                     </div>
                   )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Guide/Help bubble and legend (Dismissible & Toggleable) */}
      {!guideHidden && (
        <div 
          className="absolute right-6 bottom-16 w-64 bg-[#121212]/95 border border-[#262626] rounded-xl p-4 shadow-2xl backdrop-blur-md z-40 animate-fadeIn flex flex-col gap-3"
          id="floating-guide-panel"
        >
          <div className="flex items-center justify-between border-b border-[#262626] pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
              <span>💡</span>
              <span>Interactive Guide</span>
            </div>
            <button 
              onClick={handleCloseGuidePermanently} 
              className="text-gray-500 hover:text-red-400 text-lg transition-colors cursor-pointer leading-none"
              title="Dismiss guide permanently"
              id="close-guide-btn"
            >
              &times;
            </button>
          </div>
          
          <div className="text-xs text-gray-400 leading-relaxed flex flex-col gap-1.5">
            <p>• <strong>Drag</strong> table headers to position them.</p>
            <p>• <strong>Drag</strong> relationship diamonds to reroute lines.</p>
            <p>• <strong>Hover</strong> tables to highlight their connections.</p>
            <p>• <strong>Total Participation</strong> renders double lines via the sidebar checkbox.</p>
            <p>• <strong>Relationship Attributes</strong> can be added in the sidebar to float by the diamond.</p>
          </div>

          <div className="border-t border-[#262626] pt-2">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Legend</h4>
            <ul className="text-xs text-gray-300 flex flex-col gap-1.5">
              <li className="flex items-center gap-2"><span className="text-[#ecc94b]">🔑</span> Primary Key</li>
              <li className="flex items-center gap-2"><span className="text-[#b794f4]">⭐</span> Unique</li>
              <li className="flex items-center gap-2"><span className="text-[#718096]">○</span> Nullable</li>
              <li className="flex items-center gap-2"><span className="text-[#6366f1]">◇</span> Relationship</li>
              <li className="flex items-center gap-2"><span className="text-gray-400 font-mono text-[9px]">══</span> Total Participation (Double Line)</li>
              <li className="flex items-center gap-2"><span className="text-gray-400 font-mono text-[9px]">- -</span> Relationship Attribute Connector</li>
            </ul>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          const nextHidden = !guideHidden;
          setGuideHidden(nextHidden);
          if (nextHidden) {
            localStorage.setItem('erd_guide_hidden', 'true');
          } else {
            localStorage.removeItem('erd_guide_hidden');
          }
        }}
        className="absolute right-6 bottom-4 bg-[#161616] hover:bg-[#222222] text-xs font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg border border-[#262626] shadow-lg flex items-center gap-1.5 transition-colors cursor-pointer z-40"
        title="Toggle interactive guide and legend"
        id="toggle-guide-btn"
      >
        <span>💡</span>
        <span>{guideHidden ? "Show Guide" : "Hide Guide"}</span>
      </button>
      </div>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-[#262626] bg-[#121212] flex items-center justify-between px-6 text-[10px] text-gray-500 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Connected to Sandbox
          </span>
          <span className="w-[1px] h-3 bg-[#262626]"></span>
          <span>Entities: <strong className="text-gray-300 font-mono">{tables.length}</strong></span>
          <span className="w-[1px] h-3 bg-[#262626]"></span>
          <span>Relationships: <strong className="text-gray-300 font-mono">{relationships.length}</strong></span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>Pan X: <strong className="text-gray-400">{Math.round(panX)}px</strong> Y: <strong className="text-gray-400">{Math.round(panY)}px</strong></span>
          <span className="w-[1px] h-3 bg-[#262626]"></span>
          <span className="text-blue-400 bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/30">Zoom: {Math.round(scale * 100)}%</span>
        </div>
      </footer>
    </div>
  );
}
