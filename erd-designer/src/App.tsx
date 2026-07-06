import React, { useState, useEffect, useRef } from 'react';
import { Table, Relationship, Attribute } from './types';

// Default example data generators
function getExampleTables(): Table[] {
  return [
    {
      id: 'tbl_patient',
      name: 'Patient',
      x: 300,
      y: 200,
      attributes: [
        { id: 'attr_p1', name: 'PatientID', type: 'INT', pk: true, fk: false, nullable: false, unique: true },
        { id: 'attr_p2', name: 'FirstName', type: 'VARCHAR', pk: false, fk: false, nullable: false, unique: false },
        { id: 'attr_p3', name: 'LastName', type: 'VARCHAR', pk: false, fk: false, nullable: false, unique: false },
        { id: 'attr_p4', name: 'BirthDate', type: 'DATE', pk: false, fk: false, nullable: true, unique: false },
      ]
    },
    {
      id: 'tbl_visit',
      name: 'Visit',
      x: 700,
      y: 200,
      attributes: [
        { id: 'attr_v1', name: 'VisitID', type: 'INT', pk: true, fk: false, nullable: false, unique: true },
        { id: 'attr_v2', name: 'PatientID', type: 'INT', pk: false, fk: true, nullable: false, unique: false },
        { id: 'attr_v3', name: 'VisitDate', type: 'DATETIME', pk: false, fk: false, nullable: false, unique: false },
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
    };

    if (isPanning || draggedTableId || draggedRelId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggedTableId, draggedRelId, scale]);

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
      name: `NewTable_${tables.length + 1}`,
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
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, name } : t));
  };

  const handleAddNewAttribute = (tableId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const newAttr: Attribute = {
          id: 'attr_' + Date.now() + Math.random().toString(36).substr(2, 5),
          name: 'NewAttr',
          type: 'VARCHAR',
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

  const handleCloseGuidePermanently = () => {
    // CHANGED: Permanently hides the guide element
    setGuideHidden(true);
    localStorage.setItem('erd_guide_hidden', 'true');
  };

  // --- EXPORT STATIC ERD ---
  const handleExportStatic = () => {
    // CHANGED: Export output keeps the exact structure but omits left panel, right panel, and edit UI
    const polylinesHtml = relationships.map(rel => {
      const t1 = tables.find(t => t.id === rel.t1);
      const t2 = tables.find(t => t.id === rel.t2);
      if (!t1 || !t2) return '';

      let x1 = t1.x + 110;
      let y1 = t1.y + 20;
      let x2 = t2.x + 110;
      let y2 = t2.y + 20;

      // CHANGED: Draw curved self-loops for self-relationships
      if (t1.id === t2.id) {
        x1 = t1.x + 50;
        x2 = t1.x + 170;
      }

      const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (x1 + x2) / 2);
      const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (y1 + y2) / 2);

      return `<polyline id="line_${rel.id}" points="${x1},${y1} ${mx},${my} ${x2},${y2}" class="rel-line"></polyline>`;
    }).join('\n');

    const tablesHtml = tables.map((table, index) => {
      const attrsHtml = table.attributes.map(attr => {
        let icons = '';
        if (attr.pk) icons += `<span class="icon pk" title="Primary Key">🔑</span>`;
        if (attr.fk) icons += `<span class="icon fk" title="Foreign Key">🔗</span>`;
        if (attr.unique) icons += `<span class="icon unique" title="Unique">⭐</span>`;
        if (attr.nullable) icons += `<span class="icon nullable" title="Nullable">○</span>`;

        return `
          <div class="attr-line">
            <div class="attr-icons">${icons}</div>
            <div class="attr-name">${attr.name}</div>
            <div class="attr-type">${attr.type}</div>
          </div>
        `;
      }).join('\n');

      return `
        <div class="table-node" id="node_${table.id}" style="left: ${table.x}px; top: ${table.y}px; z-index: ${index + 10}; cursor: default;">
          <div class="table-node-header" style="cursor: default;">
            <span>${table.name.toLowerCase()}</span>
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
        .table-node-header { background: #1a1a1a; color: var(--accent-blue); border-bottom: 1px solid var(--border-color); padding: 10px; font-weight: bold; font-family: monospace; text-transform: lowercase; text-align: center; height: 40px; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; padding-right: 14px; }
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
                  {table.attributes.map(attr => (
                    <div className="attr-row" key={attr.id}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ margin: 0 }}
                        value={attr.name}
                        onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'name', e.target.value)}
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        className="input-field"
                        style={{ margin: 0 }}
                        value={attr.type}
                        onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'type', e.target.value)}
                        placeholder="Type"
                      />
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAttribute(table.id, attr.id)}>X</button>
                      <div style={{ gridColumn: 'span 3', display: 'flex', gap: '5px', fontSize: '12px', marginBottom: '10px' }}>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={attr.pk} onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'pk', e.target.checked)} /> PK
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={attr.fk} onChange={(e) => handleUpdateAttribute(table.id, attr.id, 'fk', e.target.checked)} /> FK
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
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Name: {rel.name}</div>
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

              let x1 = t1.x + 110;
              let y1 = t1.y + 20;
              let x2 = t2.x + 110;
              let y2 = t2.y + 20;

              // CHANGED: Draw self-loop coordinates for self-relationship
              if (t1.id === t2.id) {
                x1 = t1.x + 50;
                x2 = t1.x + 170;
              }

              const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (x1 + x2) / 2);
              const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (y1 + y2) / 2);

              return (
                <polyline
                  key={rel.id}
                  id={`line_${rel.id}`}
                  points={`${x1},${y1} ${mx},${my} ${x2},${y2}`}
                  className="rel-line"
                />
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
                  <span>{table.name.toLowerCase()}</span>
                  <div className="flex gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                  </div>
                </div>
                <div className="table-node-body">
                  {table.attributes.map(attr => {
                    let icons = [];
                    if (attr.pk) icons.push(<span className="icon pk" title="Primary Key" key="pk">🔑</span>);
                    if (attr.fk) icons.push(<span className="icon fk" title="Foreign Key" key="fk">🔗</span>);
                    if (attr.unique) icons.push(<span className="icon unique" title="Unique" key="uq">⭐</span>);
                    if (attr.nullable) icons.push(<span className="icon nullable" title="Nullable" key="null">○</span>);

                    return (
                      <div className="attr-line" key={attr.id}>
                        <div className="attr-icons">{icons}</div>
                        <div className="attr-name">{attr.name}</div>
                        <div className="attr-type">{attr.type}</div>
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

              return (
                <div
                  className={`rel-node ${draggedRelId === rel.id ? 'dragging' : ''}`}
                  id={`rel_node_${rel.id}`}
                  key={rel.id}
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
            <p>• <strong>Hover</strong> tables to auto-expand their attributes.</p>
          </div>

          <div className="border-t border-[#262626] pt-2">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Legend</h4>
            <ul className="text-xs text-gray-300 flex flex-col gap-1.5">
              <li className="flex items-center gap-2"><span className="text-[#ecc94b]">🔑</span> Primary Key</li>
              <li className="flex items-center gap-2"><span className="text-[#4fd1c5]">🔗</span> Foreign Key</li>
              <li className="flex items-center gap-2"><span className="text-[#b794f4]">⭐</span> Unique</li>
              <li className="flex items-center gap-2"><span className="text-[#718096]">○</span> Nullable</li>
              <li className="flex items-center gap-2"><span className="text-[#6366f1]">◇</span> Relationship</li>
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
