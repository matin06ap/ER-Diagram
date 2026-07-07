import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { Table, Relationship, Attribute } from './types';
import { 
  Database, 
  Link2, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  HelpCircle, 
  Info, 
  Key, 
  Star, 
  Check, 
  Sliders, 
  ArrowUp, 
  ArrowDown, 
  ChevronUp, 
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles
} from 'lucide-react';

// Helper functions for shape layout and line connection math
export function getTableWidth(table: Table): number {
  let maxLength = table.name.length * 8.5 + 48;
  table.attributes.filter(attr => !attr.fk).forEach(attr => {
    const attrLen = 45 + attr.name.length * 8 + 24;
    if (attrLen > maxLength) {
      maxLength = attrLen;
    }
  });
  return Math.min(340, Math.max(220, maxLength));
}

export function getTableHeight(table: Table): number {
  const w = getTableWidth(table);
  const headerCharFit = Math.max(1, (w - 48) / 8.5);
  const headerLines = Math.ceil(table.name.length / headerCharFit);
  const headerHeight = 44 + Math.max(0, headerLines - 1) * 18;
  
  const visibleAttrs = table.attributes.filter(attr => !attr.fk);
  let attrsHeight = 0;
  visibleAttrs.forEach(attr => {
    const attrCharFit = Math.max(1, (w - 69) / 8);
    const attrLines = Math.ceil(attr.name.length / attrCharFit);
    const attrRowHeight = 34 + Math.max(0, attrLines - 1) * 18;
    attrsHeight += attrRowHeight;
  });
  
  if (visibleAttrs.length === 0) {
    return headerHeight + 24;
  }
  return headerHeight + 24 + attrsHeight;
}

export function getRelationshipWidth(name: string): number {
  const textWidth = name.length * 6.5;
  return Math.min(160, Math.max(64, textWidth + 36));
}

export function getRelationshipHeight(name: string): number {
  const w = getRelationshipWidth(name);
  const charFit = Math.max(1, (w - 24) / 6.5);
  const lines = Math.ceil(name.length / charFit);
  return 40 + Math.max(0, lines - 1) * 14;
}

export function getRelAttrBoxWidth(rel: Relationship): number {
  if (!rel.attributes || rel.attributes.length === 0) return 0;
  let maxItemWidth = 0;
  rel.attributes.forEach(attr => {
    const itemWidth = 14 + attr.name.length * 7;
    if (itemWidth > maxItemWidth) {
      maxItemWidth = itemWidth;
    }
  });
  const totalW = maxItemWidth + 24; // padding
  return Math.min(180, Math.max(100, totalW));
}

export function getRelAttrBoxHeight(rel: Relationship): number {
  if (!rel.attributes || rel.attributes.length === 0) return 0;
  const boxWidth = getRelAttrBoxWidth(rel);
  const availableWidthForText = boxWidth - 38;
  const charFit = Math.max(1, availableWidthForText / 7);
  let totalItemsHeight = 0;
  rel.attributes.forEach((attr) => {
    const lines = Math.ceil(attr.name.length / charFit);
    const itemHeight = Math.max(18, lines * 18);
    totalItemsHeight += itemHeight;
  });
  const gapHeight = (rel.attributes.length - 1) * 5;
  return totalItemsHeight + gapHeight + 16; // 16px vertical padding
}

export function getNodeDetails(id: string, tables: Table[], relationships: Relationship[]): {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  isTable: boolean;
} | null {
  const table = tables.find(t => t.id === id);
  if (table) {
    const w = getTableWidth(table);
    const h = getTableHeight(table);
    return {
      id,
      name: table.name,
      x: table.x,
      y: table.y,
      w,
      h,
      cx: table.x + w / 2,
      cy: table.y + h / 2,
      isTable: true,
    };
  }

  const rel = relationships.find(r => r.id === id);
  if (rel) {
    const relW = getRelationshipWidth(rel.name);
    const relH = getRelationshipHeight(rel.name);

    if (rel.mx !== null && rel.my !== null) {
      return {
        id,
        name: rel.name,
        x: rel.mx - relW / 2,
        y: rel.my - relH / 2,
        w: relW,
        h: relH,
        cx: rel.mx,
        cy: rel.my,
        isTable: false,
      };
    }

    // Dynamic resolution if mx/my are null
    // Avoid cyclic queries by passing a simplified tracker or limit
    const n1 = tables.find(t => t.id === rel.t1);
    const n2 = tables.find(t => t.id === rel.t2);
    let cx = 0;
    let cy = 0;
    
    if (n1 && n2) {
      const n1w = getTableWidth(n1);
      const n2w = getTableWidth(n2);
      const n1h = getTableHeight(n1);
      const n2h = getTableHeight(n2);
      const n1c = { x: n1.x + n1w / 2, y: n1.y + n1h / 2 };
      const n2c = { x: n2.x + n2w / 2, y: n2.y + n2h / 2 };
      
      cx = rel.t1 === rel.t2 ? n1.x + n1w / 2 : (n1c.x + n2c.x) / 2;
      cy = rel.t1 === rel.t2 ? n1.y - 45 : (n1c.y + n2c.y) / 2;
    } else {
      // General fallback using a simple resolver for when endpoints are relationships
      // We pass relationships with current rel removed to avoid infinite recursion
      const remainingRels = relationships.filter(r => r.id !== id);
      const ep1 = getNodeDetails(rel.t1, tables, remainingRels);
      const ep2 = getNodeDetails(rel.t2, tables, remainingRels);
      
      if (ep1 && ep2) {
        cx = rel.t1 === rel.t2 ? ep1.x + ep1.w / 2 : (ep1.cx + ep2.cx) / 2;
        cy = rel.t1 === rel.t2 ? ep1.y - 45 : (ep1.cy + ep2.cy) / 2;
      } else if (ep1) {
        cx = ep1.cx;
        cy = ep1.cy + 100;
      } else {
        cx = 250;
        cy = 250;
      }
    }

    return {
      id,
      name: rel.name,
      x: cx - relW / 2,
      y: cy - relH / 2,
      w: relW,
      h: relH,
      cx,
      cy,
      isTable: false,
    };
  }

  return null;
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
  
  const t_x = dx === 0 ? Infinity : (rect.w / 2) / Math.abs(dx);
  const t_y = dy === 0 ? Infinity : (rect.h / 2) / Math.abs(dy);
  
  const t = Math.min(t_x, t_y);
  
  return {
    x: cx + dx * t,
    y: cy + dy * t
  };
}

function getRhombusIntersection(center: Point, target: Point, w: number, h: number): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  
  const halfW = w / 2 + 1;
  const halfH = h / 2 + 1;
  
  const t = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH);
  
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDrawing: boolean;
    hasSelection: boolean;
  } | null>(null);

  // Cancel selection mode with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        setIsSelectionMode(false);
        setSelectionBox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Dragging Interaction State
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [draggedRelId, setDraggedRelId] = useState<string | null>(null);
  const [draggedRelAttr, setDraggedRelAttr] = useState<{ relId: string; attrId: string } | null>(null);
  const [draggedRelAttrBoxId, setDraggedRelAttrBoxId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const dragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Connection Form State
  const [relT1, setRelT1] = useState<string>('');
  const [relT2, setRelT2] = useState<string>('');
  const [relCard, setRelCard] = useState<string>('1:N');
  const [relName, setRelName] = useState<string>('');

  // Drag-and-drop connection creation states
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<{ x: number, y: number } | null>(null);

  // Sync form options when tables or relationships change
  useEffect(() => {
    if (tables.length > 0 || relationships.length > 0) {
      const allOptions = [
        ...tables.map(t => t.id),
        ...relationships.map(r => r.id)
      ];
      if (!relT1 || !allOptions.includes(relT1)) {
        setRelT1(tables[0]?.id || relationships[0]?.id || '');
      }
      if (!relT2 || !allOptions.includes(relT2)) {
        setRelT2(tables[1]?.id || tables[0]?.id || relationships[0]?.id || '');
      }
    } else {
      setRelT1('');
      setRelT2('');
    }
  }, [tables, relationships]);

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
      } else if (draggedRelAttrBoxId) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setRelationships(prev => prev.map(r => {
          if (r.id === draggedRelAttrBoxId) {
            return {
              ...r,
              ax: dragStart.current.itemX + dx / scale,
              ay: dragStart.current.itemY + dy / scale,
            };
          }
          return r;
        }));
      } else if (connectingSourceId) {
        const parentRect = document.getElementById('canvas')?.getBoundingClientRect();
        if (parentRect) {
          setConnectionMousePos({
            x: (e.clientX - parentRect.left) / scale,
            y: (e.clientY - parentRect.top) / scale
          });
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggedTableId(null);
      setDraggedRelId(null);
      setDraggedRelAttr(null);
      setDraggedRelAttrBoxId(null);
      if (connectingSourceId) {
        setTimeout(() => {
          setConnectingSourceId(null);
          setConnectionMousePos(null);
        }, 120);
      }
    };

    if (isPanning || draggedTableId || draggedRelId || draggedRelAttr || draggedRelAttrBoxId || connectingSourceId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggedTableId, draggedRelId, draggedRelAttr, draggedRelAttrBoxId, connectingSourceId, scale]);

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
    setToastMessage('Layout saved successfully!');
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
    setRelationships(prev => {
      const idsToDelete = new Set([tableId]);
      let size = 0;
      while (idsToDelete.size !== size) {
        size = idsToDelete.size;
        prev.forEach(r => {
          if (idsToDelete.has(r.t1) || idsToDelete.has(r.t2)) {
            idsToDelete.add(r.id);
          }
        });
      }
      return prev.filter(r => !idsToDelete.has(r.id));
    });
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
    setRelationships(prev => {
      const idsToDelete = new Set([relId]);
      let size = 0;
      while (idsToDelete.size !== size) {
        size = idsToDelete.size;
        prev.forEach(r => {
          if (idsToDelete.has(r.t1) || idsToDelete.has(r.t2)) {
            idsToDelete.add(r.id);
          }
        });
      }
      return prev.filter(r => !idsToDelete.has(r.id));
    });
  };

  const handleAddConnectionBetween = (srcId: string, destId: string) => {
    if (srcId === destId) return;

    // Check if relationship already exists
    const exists = relationships.some(r => 
      (r.t1 === srcId && r.t2 === destId) || (r.t1 === destId && r.t2 === srcId)
    );
    if (exists) {
      setToastMessage('A relationship already exists between these elements!');
      return;
    }

    const n1 = getNodeDetails(srcId, tables, relationships);
    const n2 = getNodeDetails(destId, tables, relationships);
    if (!n1 || !n2) return;

    const name = 'Relates To';
    const newRel: Relationship = {
      id: 'rel_' + Date.now() + Math.random().toString(36).substr(2, 5),
      t1: srcId,
      t2: destId,
      name,
      cardinality: '1:N',
      mx: null,
      my: null,
    };
    
    setRelationships(prev => [...prev, newRel]);
    setToastMessage(`Connected ${n1.name} and ${n2.name}!`);
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
  const handleExportStatic = async () => {
    if (tables.length === 0 && relationships.length === 0) {
      alert("Nothing to export! Create some tables or connections first.");
      return;
    }

    setIsExporting(true);
    setToastMessage('Preparing high-resolution PNG export...');

    try {
      const viewportNode = document.getElementById('canvas-viewport');
      if (!viewportNode) {
        alert("Viewport element not found.");
        setIsExporting(false);
        return;
      }

      // 1. Calculate diagram bounding box dynamically in canvas coordinates
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      // Calculate boundaries from tables
      tables.forEach(table => {
        const tableH = getTableHeight(table);
        const w = getTableWidth(table); // Table cards have dynamic width
        minX = Math.min(minX, table.x);
        maxX = Math.max(maxX, table.x + w);
        minY = Math.min(minY, table.y);
        maxY = Math.max(maxY, table.y + tableH);
      });

      // Calculate boundaries from relationships and attribute boxes
      relationships.forEach(rel => {
        const n1 = getNodeDetails(rel.t1, tables, relationships);
        const n2 = getNodeDetails(rel.t2, tables, relationships);
        if (n1 && n2) {
          const mx = rel.mx !== null ? rel.mx : (rel.t1 === rel.t2 ? n1.x + n1.w / 2 : (n1.cx + n2.cx) / 2);
          const my = rel.my !== null ? rel.my : (rel.t1 === rel.t2 ? n1.y - 45 : (n1.cy + n2.cy) / 2);

          const relW = getRelationshipWidth(rel.name);
          const relH = getRelationshipHeight(rel.name);

          minX = Math.min(minX, mx - relW / 2);
          maxX = Math.max(maxX, mx + relW / 2);
          minY = Math.min(minY, my - relH / 2);
          maxY = Math.max(maxY, my + relH / 2);

          const hasAttrs = rel.attributes && rel.attributes.length > 0;
          if (hasAttrs) {
            const ax = rel.ax !== null && rel.ax !== undefined ? rel.ax : mx + 60;
            const ay = rel.ay !== null && rel.ay !== undefined ? rel.ay : my - 40;
            const relAttrWidth = getRelAttrBoxWidth(rel);
            const relAttrHeight = getRelAttrBoxHeight(rel);
            minX = Math.min(minX, ax);
            maxX = Math.max(maxX, ax + relAttrWidth);
            minY = Math.min(minY, ay);
            maxY = Math.max(maxY, ay + relAttrHeight);
          }
        }
      });

      // 2. Fetch viewport size
      const rect = viewportNode.getBoundingClientRect();
      const viewportWidth = rect.width;
      const viewportHeight = rect.height;

      // Add a generous 80px padding around the entire diagram
      const padding = 80;
      const diagramWidth = maxX - minX;
      const diagramHeight = maxY - minY;
      const paddedWidth = diagramWidth + padding * 2;
      const paddedHeight = diagramHeight + padding * 2;

      // 3. Compute scale and pan required to fit the entire padded diagram into the viewport
      const fitScaleX = viewportWidth / paddedWidth;
      const fitScaleY = viewportHeight / paddedHeight;
      const fitScale = Math.min(fitScaleX, fitScaleY, 1.5); // cap at 1.5 zoom to prevent oversized graphics

      const diagramCenterX = minX + diagramWidth / 2;
      const diagramCenterY = minY + diagramHeight / 2;
      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;

      const tempPanX = viewportCenterX - diagramCenterX * fitScale;
      const tempPanY = viewportCenterY - diagramCenterY * fitScale;

      // 4. Save user's current zoom/pan state
      const originalScale = scale;
      const originalPanX = panX;
      const originalPanY = panY;

      // 5. Temporarily apply fitted zoom/pan state to reveal everything in the viewport
      setScale(fitScale);
      setPanX(tempPanX);
      setPanY(tempPanY);

      // 6. Wait 180ms for React state state-updates to finish and the browser to render
      await new Promise(resolve => setTimeout(resolve, 180));

      // Calculate exact bounding coordinates in viewport screen space
      const sx = (minX - padding) * fitScale + tempPanX;
      const sy = (minY - padding) * fitScale + tempPanY;
      const sw = paddedWidth * fitScale;
      const sh = paddedHeight * fitScale;

      const pixelRatio = 2; // Export at 2x high resolution (Retina level)

      // 7. Capture the whole viewport
      const dataUrl = await toPng(viewportNode, {
        pixelRatio,
        cacheBust: true,
        style: {
          // Cascade direct colors to make sure nested stylesheets / variables resolve perfectly
          '--bg-dark': '#09090b',
          '--panel-dark': '#0d0d10',
          '--border-color': '#27272a',
          '--accent-blue': '#3b82f6',
          '--accent-blue-hover': '#2563eb',
          '--accent-purple': '#6366f1',
          '--text-main': '#f4f4f5',
          '--text-muted': '#a1a1aa',
          '--card-bg': '#141417',
          '--color-pk': '#fbbf24',
          '--color-fk': '#2dd4bf',
          '--color-unique': '#c084fc',
          '--color-nullable': '#94a3b8',
        } as any
      });

      // 8. Restore user's zoom/pan state immediately
      setScale(originalScale);
      setPanX(originalPanX);
      setPanY(originalPanY);

      // 9. Load full viewport image into canvas and crop to target diagram bounds
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = sw * pixelRatio;
        offscreenCanvas.height = sh * pixelRatio;

        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Crop out only the padded diagram bounding box
          ctx.drawImage(
            img,
            sx * pixelRatio,
            sy * pixelRatio,
            sw * pixelRatio,
            sh * pixelRatio,
            0,
            0,
            sw * pixelRatio,
            sh * pixelRatio
          );

          // Get final high-quality .png data url
          const croppedDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);

          // Download downloadable .png
          const link = document.createElement('a');
          link.href = croppedDataUrl;
          link.download = `ERD_Full_Export_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setToastMessage('High-resolution PNG exported successfully!');
        } else {
          throw new Error("Canvas context is null");
        }
      };
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export ERD as PNG. Try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // --- CAPTURE DRAGGED SELECTION AREA ---
  const handleCaptureSelectedArea = async (left: number, top: number, width: number, height: number) => {
    if (width < 10 || height < 10) {
      alert("Please select a larger region to export.");
      return;
    }

    setIsExporting(true);
    setToastMessage('Capturing custom selection...');

    try {
      const viewportNode = document.getElementById('canvas-viewport');
      if (!viewportNode) {
        alert("Viewport element not found.");
        setIsExporting(false);
        return;
      }

      // Hide the crop overlay before capturing so it doesn't appear in the image
      setIsSelectionMode(false);
      await new Promise(resolve => setTimeout(resolve, 80));

      const pixelRatio = 2; // Capture at 2x high resolution

      // Capture current viewport layout
      const dataUrl = await toPng(viewportNode, {
        pixelRatio,
        cacheBust: true,
        style: {
          '--bg-dark': '#09090b',
          '--panel-dark': '#0d0d10',
          '--border-color': '#27272a',
          '--accent-blue': '#3b82f6',
          '--accent-blue-hover': '#2563eb',
          '--accent-purple': '#6366f1',
          '--text-main': '#f4f4f5',
          '--text-muted': '#a1a1aa',
          '--card-bg': '#141417',
          '--color-pk': '#fbbf24',
          '--color-fk': '#2dd4bf',
          '--color-unique': '#c084fc',
          '--color-nullable': '#94a3b8',
        } as any
      });

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width * pixelRatio;
        offscreenCanvas.height = height * pixelRatio;

        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Crop exactly what was inside the selection rectangle
          ctx.drawImage(
            img,
            left * pixelRatio,
            top * pixelRatio,
            width * pixelRatio,
            height * pixelRatio,
            0,
            0,
            width * pixelRatio,
            height * pixelRatio
          );

          const croppedDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);

          // Download cropped .png
          const link = document.createElement('a');
          link.href = croppedDataUrl;
          link.download = `ERD_Selection_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setToastMessage('Selected region exported successfully!');
          setSelectionBox(null);
        } else {
          throw new Error("Canvas context is null");
        }
      };
    } catch (error) {
      console.error('Selection export failed:', error);
      alert('Failed to export selection. Try again.');
      setIsSelectionMode(true); // Restore selection screen
    } finally {
      setIsExporting(false);
    }
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
      const n1 = getNodeDetails(rel.t1, tables, relationships);
      const n2 = getNodeDetails(rel.t2, tables, relationships);
      if (n1 && n2) {
        let x1 = n1.cx;
        let x2 = n2.cx;
        let y1 = n1.cy;
        let y2 = n2.cy;
        if (rel.t1 === rel.t2) {
          x1 = n1.x + 50;
          x2 = n1.x + 170;
        }
        const currentMx = rel.mx !== null ? rel.mx : (rel.t1 === rel.t2 ? n1.x + 110 : (x1 + x2) / 2);
        const currentMy = rel.my !== null ? rel.my : (rel.t1 === rel.t2 ? n1.y - 45 : (y1 + y2) / 2);
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          itemX: currentMx,
          itemY: currentMy,
        };
      }
    }
  };

  const handleRelAttrBoxMouseDown = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    setDraggedRelAttrBoxId(relId);
    const rel = relationships.find(r => r.id === relId);
    if (rel) {
      const n1 = getNodeDetails(rel.t1, tables, relationships);
      const n2 = getNodeDetails(rel.t2, tables, relationships);
      if (n1 && n2) {
        let x1 = n1.cx;
        let x2 = n2.cx;
        let y1 = n1.cy;
        let y2 = n2.cy;
        if (rel.t1 === rel.t2) {
          x1 = n1.x + 50;
          x2 = n1.x + 170;
        }
        const mx = rel.mx !== null ? rel.mx : (rel.t1 === rel.t2 ? n1.x + 110 : (x1 + x2) / 2);
        const my = rel.my !== null ? rel.my : (rel.t1 === rel.t2 ? n1.y - 45 : (y1 + y2) / 2);
        const currentAx = rel.ax !== null && rel.ax !== undefined ? rel.ax : mx + 60;
        const currentAy = rel.ay !== null && rel.ay !== undefined ? rel.ay : my - 40;
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          itemX: currentAx,
          itemY: currentAy,
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
    <div className="h-screen w-screen flex flex-col bg-[#09090B] text-zinc-300 font-sans overflow-hidden select-none" id="app-container">
      {/* Header Navigation */}
      <header className="h-16 border-b border-[#27272a] bg-[#0d0d10]/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-30 shadow-md shadow-black/35">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-700 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform duration-200">
            <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2.5">
            StructView
            <span className="text-[10px] font-mono font-medium text-zinc-300 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700/60">v2.4.1</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSaveManual} 
            className="px-4 py-2 text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 transition-all duration-200 cursor-pointer font-bold shadow-sm active:scale-[0.97] flex items-center gap-1.5"
            id="save-layout-btn"
          >
            <span>💾</span>
            <span>Save Layout</span>
          </button>
          <button 
            onClick={handleClearSaved} 
            className="px-4 py-2 text-xs bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-lg border border-red-900/30 transition-all duration-200 cursor-pointer font-bold shadow-sm active:scale-[0.97] flex items-center gap-1.5"
            id="reset-canvas-btn"
          >
            <span>🧹</span>
            <span>Reset Canvas</span>
          </button>
          <button 
            onClick={handleExportStatic} 
            disabled={isExporting}
            className={`px-4.5 py-2 text-xs text-white rounded-lg font-bold transition-all duration-200 shadow-md active:scale-[0.97] cursor-pointer flex items-center gap-1.5 ${
              isExporting 
                ? 'bg-zinc-700/50 text-zinc-400 cursor-not-allowed border border-zinc-600/30' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/10 hover:shadow-blue-500/25'
            }`}
            id="export-btn"
            title="Automatically calculate bounds and export entire diagram as PNG"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>Export Entire ERD</span>
              </>
            )}
          </button>
          <button 
            onClick={() => {
              setIsSelectionMode(true);
              setSelectionBox(null);
              setToastMessage('Draw a box on the canvas to select the export region.');
            }}
            disabled={isExporting}
            className={`px-4.5 py-2 text-xs font-bold rounded-lg border transition-all duration-200 shadow-sm active:scale-[0.97] cursor-pointer flex items-center gap-1.5 ${
              isSelectionMode 
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 ring-1 ring-blue-500/30 shadow-blue-500/5'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white border-zinc-700'
            }`}
            id="export-selection-btn"
            title="Select a custom area to export as high-quality PNG"
          >
            <span>✂️</span>
            <span>Export Selection</span>
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
                      style={{ margin: 0, width: '70%' }}
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
                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '10px' }}>
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
                <optgroup label="Entities (Tables)">
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Relationships (Diamonds)">
                  {relationships.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.cardinality})</option>
                  ))}
                </optgroup>
              </select>
              <select id="rel-card" className="input-field narrow" value={relCard} onChange={(e) => setRelCard(e.target.value)}>
                <option value="1:1">1:1</option>
                <option value="1:N">1:N</option>
                <option value="N:1">N:1</option>
                <option value="N:M">N:M</option>
              </select>
              <select id="rel-t2" className="input-field" value={relT2} onChange={(e) => setRelT2(e.target.value)}>
                <optgroup label="Entities (Tables)">
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Relationships (Diamonds)">
                  {relationships.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.cardinality})</option>
                  ))}
                </optgroup>
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
                const n1 = getNodeDetails(rel.t1, tables, relationships);
                const n2 = getNodeDetails(rel.t2, tables, relationships);
                if (!n1 || !n2) return null;
                return (
                  <div className="sidebar-item" key={rel.id}>
                    <div className="sidebar-item-header">
                      <span style={{ fontSize: '0.85rem' }}>
                        {n1.name} <strong style={{ color: 'var(--accent-purple)' }}>[{rel.cardinality}]</strong> {n2.name}
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
                        <span>Total Participation ({n1.name})</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!rel.total2}
                          onChange={(e) => handleToggleRelTotal(rel.id, 2, e.target.checked)}
                        />
                        <span>Total Participation ({n2.name})</span>
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
        className="absolute z-40 top-1/2 -translate-y-1/2 w-6 h-14 bg-zinc-900 border-y border-r border-zinc-800 rounded-r-xl flex items-center justify-center hover:bg-zinc-850 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-md shadow-black/35 active:scale-95"
        title="Toggle Left Panel"
        onClick={() => setLeftCollapsed(!leftCollapsed)}
        style={{ left: leftCollapsed ? '0px' : '319px' }}
      >
        {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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
          <svg id="svg-layer" style={{ overflow: 'visible' }}>
            {relationships.map(rel => {
              const n1 = getNodeDetails(rel.t1, tables, relationships);
              const n2 = getNodeDetails(rel.t2, tables, relationships);
              if (!n1 || !n2) return null;

              const mx = rel.mx !== null ? rel.mx : (rel.t1 === rel.t2 ? n1.x + n1.w / 2 : (n1.cx + n2.cx) / 2);
              const my = rel.my !== null ? rel.my : (rel.t1 === rel.t2 ? n1.y - 45 : (n1.cy + n2.cy) / 2);
              const m = { x: mx, y: my };

              const relW = getRelationshipWidth(rel.name);
              const relH = getRelationshipHeight(rel.name);

              let edge1: Point;
              let edge2: Point;
              let dia1: Point;
              let dia2: Point;

              if (rel.t1 === rel.t2) {
                // Self relationship connection points at top-left and top-right of table
                edge1 = { x: n1.x + Math.min(60, n1.w * 0.25), y: n1.y };
                edge2 = { x: n1.x + n1.w - Math.min(60, n1.w * 0.25), y: n1.y };
                dia1 = getRhombusIntersection(m, edge1, relW, relH);
                dia2 = getRhombusIntersection(m, edge2, relW, relH);
              } else {
                if (n1.isTable) {
                  edge1 = getRectIntersection({ x: n1.x, y: n1.y, w: n1.w, h: n1.h }, m);
                } else {
                  edge1 = getRhombusIntersection({ x: n1.cx, y: n1.cy }, m, n1.w, n1.h);
                }

                if (n2.isTable) {
                  edge2 = getRectIntersection({ x: n2.x, y: n2.y, w: n2.w, h: n2.h }, m);
                } else {
                  edge2 = getRhombusIntersection({ x: n2.cx, y: n2.cy }, m, n2.w, n2.h);
                }

                dia1 = getRhombusIntersection(m, { x: n1.cx, y: n1.cy }, relW, relH);
                dia2 = getRhombusIntersection(m, { x: n2.cx, y: n2.cy }, relW, relH);
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
              const label1X = len1 > 45 ? edge1.x + (dx1 / len1) * 20 : (len1 > 0 ? edge1.x + dx1 * 0.4 : edge1.x);
              const label1Y = len1 > 45 ? edge1.y + (dy1 / len1) * 20 : (len1 > 0 ? edge1.y + dy1 * 0.4 : edge1.y);

              const dx2 = dia2.x - edge2.x;
              const dy2 = dia2.y - edge2.y;
              const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              const label2X = len2 > 45 ? edge2.x + (dx2 / len2) * 20 : (len2 > 0 ? edge2.x + dx2 * 0.4 : edge2.x);
              const label2Y = len2 > 45 ? edge2.y + (dy2 / len2) * 20 : (len2 > 0 ? edge2.y + dy2 * 0.4 : edge2.y);

              const hasAttrs = rel.attributes && rel.attributes.length > 0;
              const attrBoxX = rel.ax !== null && rel.ax !== undefined ? rel.ax : mx + 60;
              const attrBoxY = rel.ay !== null && rel.ay !== undefined ? rel.ay : my - 40;

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
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinejoin="round"
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
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinejoin="round"
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
                  width: `${getTableWidth(table)}px`,
                  height: `${getTableHeight(table)}px`,
                  zIndex: draggedTableId === table.id ? 100 : index + 10,
                }}
              >
                <div
                  className="table-node-header"
                  id={`header_${table.id}`}
                  onMouseDown={(e) => handleTableMouseDown(e, table.id)}
                >
                  <span className="break-all whitespace-normal overflow-wrap-anywhere pr-2 text-left">{table.name}</span>
                  <div className="flex gap-1.5 opacity-60 shrink-0">
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
              const n1 = getNodeDetails(rel.t1, tables, relationships);
              const n2 = getNodeDetails(rel.t2, tables, relationships);
              if (!n1 || !n2) return null;

              const mx = rel.mx !== null ? rel.mx : (rel.t1 === rel.t2 ? n1.x + n1.w / 2 : (n1.cx + n2.cx) / 2);
              const my = rel.my !== null ? rel.my : (rel.t1 === rel.t2 ? n1.y - 45 : (n1.cy + n2.cy) / 2);

              const relW = getRelationshipWidth(rel.name);
              const relH = getRelationshipHeight(rel.name);

              const hasAttrs = rel.attributes && rel.attributes.length > 0;

              return (
                <React.Fragment key={rel.id}>
                  <div
                    className={`rel-node ${draggedRelId === rel.id ? 'dragging' : ''}`}
                    id={`rel_node_${rel.id}`}
                    style={{
                      left: `${mx}px`,
                      top: `${my}px`,
                      width: `${relW}px`,
                      height: `${relH}px`,
                      marginLeft: `-${relW / 2}px`,
                      marginTop: `-${relH / 2}px`,
                      zIndex: draggedRelId === rel.id ? 110 : 50,
                    }}
                    onMouseDown={(e) => handleRelMouseDown(e, rel.id)}
                  >
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                      <path
                        d={`M 0,${relH / 2} L ${relW / 2},0 L ${relW},${relH / 2} L ${relW / 2},${relH} Z`}
                        fill="#141417"
                        stroke="#6366f1"
                        strokeWidth="2"
                        className="rel-diamond-shape-path transition-all duration-200"
                      />
                    </svg>
                    <div className="rel-text-label px-2 text-center" style={{
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {rel.name}
                    </div>
                    <div className="rel-tooltip">
                      <div className="rel-tooltip-title">{rel.name}</div>
                      <div className="rel-tooltip-body">
                        <strong>From:</strong> {n1.name}<br />
                        <strong>To:</strong> {n2.name}<br />
                        <strong>Cardinality:</strong> {rel.cardinality}
                      </div>
                    </div>
                  </div>

                   {/* Relationship Attribute Box */}
                   {hasAttrs && (() => {
                     const ax = rel.ax !== null && rel.ax !== undefined ? rel.ax : mx + 60;
                     const ay = rel.ay !== null && rel.ay !== undefined ? rel.ay : my - 40;
                     const isDraggingThisBox = draggedRelAttrBoxId === rel.id;
                     return (
                       <div
                         className={`rel-attr-box select-none cursor-grab ${isDraggingThisBox ? 'cursor-grabbing border-solid' : ''}`}
                         style={{
                           left: `${ax}px`,
                           top: `${ay}px`,
                           pointerEvents: 'auto',
                           zIndex: isDraggingThisBox ? 110 : 45,
                         }}
                         onMouseDown={(e) => handleRelAttrBoxMouseDown(e, rel.id)}
                       >
                         {rel.attributes?.map((attr) => (
                           <div
                             key={attr.id}
                             className="rel-attr-item px-1 rounded transition-colors"
                           >
                             <span className="rel-attr-bullet">○</span>
                             <span>{attr.name}</span>
                           </div>
                         ))}
                       </div>
                     );
                   })()}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* --- INTERACTIVE MANUAL SELECTION CROP OVERLAY --- */}
        {isSelectionMode && (
          <div
            className="absolute inset-0 bg-black/50 z-[90] cursor-crosshair flex flex-col items-center justify-between pointer-events-auto"
            style={{ userSelect: 'none' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              setSelectionBox({
                startX: clickX,
                startY: clickY,
                endX: clickX,
                endY: clickY,
                isDrawing: true,
                hasSelection: true,
              });
            }}
            onMouseMove={(e) => {
              if (!selectionBox || !selectionBox.isDrawing) return;
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const currentX = e.clientX - rect.left;
              const currentY = e.clientY - rect.top;
              setSelectionBox(prev => prev ? {
                ...prev,
                endX: currentX,
                endY: currentY,
              } : null);
            }}
            onMouseUp={(e) => {
              if (!selectionBox || !selectionBox.isDrawing) return;
              e.stopPropagation();
              setSelectionBox(prev => prev ? {
                ...prev,
                isDrawing: false,
              } : null);
            }}
          >
            {/* Instruction Banner */}
            <div className="bg-[#0f0f13] border border-[#27272a] rounded-full px-5 py-2.5 mt-4 text-xs font-semibold text-zinc-100 flex items-center gap-3 shadow-xl backdrop-blur-md animate-fadeIn select-none pointer-events-auto">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Drag a box to select the area to export as PNG</span>
              <span className="text-zinc-500">|</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSelectionMode(false);
                  setSelectionBox(null);
                }}
                className="text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
              >
                Cancel (Esc)
              </button>
            </div>

            {/* Selection Rectangle rendering with darken outer effect */}
            {selectionBox && selectionBox.hasSelection && (() => {
              const left = Math.min(selectionBox.startX, selectionBox.endX);
              const top = Math.min(selectionBox.startY, selectionBox.endY);
              const width = Math.abs(selectionBox.startX - selectionBox.endX);
              const height = Math.abs(selectionBox.startY - selectionBox.endY);

              return (
                <>
                  <div
                    className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    }}
                  />
                  
                  {/* Floating Action Box below selection */}
                  {!selectionBox.isDrawing && width > 10 && height > 10 && (
                    <div
                      className="absolute bg-[#141417] border border-[#27272a] rounded-lg p-2.5 shadow-2xl flex items-center gap-2.5 z-[100] pointer-events-auto"
                      style={{
                        left: `${left + width / 2}px`,
                        top: `${top + height + 15}px`,
                        transform: 'translateX(-50%)',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCaptureSelectedArea(left, top, width, height);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                      >
                        <span>📥</span>
                        <span>Export Selection PNG</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectionBox(null);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs px-2.5 py-1.5 rounded cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="mb-4 text-[10px] text-zinc-500 pointer-events-none select-none uppercase tracking-widest font-mono">
              ESC to Cancel • Click and drag to redefine area
            </div>
          </div>
        )}
      </main>

      {/* Floating Guide/Help bubble and legend (Dismissible & Toggleable) */}
      {!guideHidden && (
        <div 
          className="absolute right-6 bottom-20 w-80 bg-[#0d0d10]/95 border border-[#27272a]/90 rounded-2xl p-5 shadow-2xl shadow-black/85 backdrop-blur-md z-40 animate-fadeIn flex flex-col gap-4 border-l-blue-500/50"
          id="floating-guide-panel"
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Interactive Guide</span>
            </div>
            <button 
              onClick={handleCloseGuidePermanently} 
              className="text-zinc-500 hover:text-red-400 p-1 rounded-lg hover:bg-zinc-900 transition-all duration-200 cursor-pointer"
              title="Dismiss guide permanently"
              id="close-guide-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-xs text-zinc-400 leading-relaxed flex flex-col gap-2.5">
            <p className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span> <span><strong>Drag</strong> table headers to position them on canvas.</span></p>
            <p className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span> <span><strong>Drag</strong> relationship diamonds to reroute connection lines.</span></p>
            <p className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span> <span><strong>Hover</strong> entities to visually highlight active connections.</span></p>
            <p className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span> <span><strong>Total Participation</strong> draws double lines via the sidebar tags.</span></p>
            <p className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span> <span><strong>Attributes</strong> can be attached to relationships and dragged freely.</span></p>
          </div>

          <div className="border-t border-zinc-800/80 pt-3">
            <h4 className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-3">Legend / Indicators</h4>
            <ul className="text-xs text-zinc-300 flex flex-col gap-2">
              <li className="flex items-center gap-2.5"><span className="text-amber-400 text-xs font-bold font-mono">PK</span> Primary Key Indicator (Gold)</li>
              <li className="flex items-center gap-2.5"><span className="text-indigo-400 text-xs font-bold font-mono">UQ</span> Unique Attribute (Purple)</li>
              <li className="flex items-center gap-2.5"><span className="text-emerald-400 text-xs font-bold font-mono">N</span> Nullable Attribute (Green)</li>
              <li className="flex items-center gap-2.5"><span className="text-zinc-500 font-mono text-[9px] tracking-tighter">════</span> Double lines indicate Total Participation</li>
              <li className="flex items-center gap-2.5"><span className="text-zinc-500 font-mono text-[9px] tracking-tighter">- - -</span> Dashed line connects relationship attributes</li>
            </ul>
          </div>
        </div>
      )}

      {/* Control Bar (Zoom & Help) */}
      <div className="absolute right-6 bottom-6 flex items-center gap-2.5 z-40">
        {/* On-screen Zoom Controls */}
        <div className="flex items-center bg-[#0d0d10]/95 border border-[#27272a]/95 rounded-xl px-1.5 py-1 shadow-lg shadow-black/40 backdrop-blur-md gap-0.5">
          <button
            onClick={() => setScale(s => Math.max(s - 0.1, 0.3))}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setScale(1); setPanX(0); setPanY(0); }}
            className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-[10px] font-mono font-bold transition-colors cursor-pointer active:scale-95"
            title="Reset Zoom to 100% and Center Canvas"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => setScale(s => Math.min(s + 0.1, 2.0))}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

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
          className="bg-[#0d0d10]/95 hover:bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white px-4 py-2 rounded-xl border border-[#27272a] shadow-lg shadow-black/40 flex items-center gap-1.5 transition-all duration-200 cursor-pointer hover:border-zinc-700 hover:scale-[1.02] active:scale-[0.98] h-9"
          title="Toggle interactive guide and legend"
          id="toggle-guide-btn"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>{guideHidden ? "Show Guide" : "Hide Guide"}</span>
        </button>
      </div>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#09090b]/95 border border-emerald-500/35 text-emerald-400 text-xs px-4 py-2.5 rounded-full shadow-xl shadow-black/60 backdrop-blur z-50 flex items-center gap-2 animate-fadeIn font-semibold" id="toast-message">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      </div>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-[#1f1f23] bg-[#09090b] flex items-center justify-between px-6 text-[10px] text-zinc-500 shrink-0 z-30 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Workspace Active</span>
          </span>
          <span className="w-[1px] h-3 bg-zinc-800"></span>
          <span>Entities: <strong className="text-zinc-300 font-mono font-semibold">{tables.length}</strong></span>
          <span className="w-[1px] h-3 bg-zinc-800"></span>
          <span>Relationships: <strong className="text-zinc-300 font-mono font-semibold">{relationships.length}</strong></span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[9px] text-zinc-400">
          <span>Offsets: X <strong className="text-zinc-500 font-medium">{Math.round(panX)}px</strong> / Y <strong className="text-zinc-500 font-medium">{Math.round(panY)}px</strong></span>
          <span className="w-[1px] h-3 bg-zinc-800"></span>
          <span className="text-indigo-400 font-bold bg-indigo-950/15 px-2 py-0.5 rounded border border-indigo-900/25">Scale: {Math.round(scale * 100)}%</span>
        </div>
      </footer>
    </div>
  );
}
