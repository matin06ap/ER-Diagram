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
    const attrRowHeight = 26 + Math.max(0, attrLines - 1) * 16;
    attrsHeight += attrRowHeight;
  });
  
  if (visibleAttrs.length === 0) {
    return headerHeight + 20;
  }
  return headerHeight + 20 + attrsHeight;
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
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggedTableId(null);
      setDraggedRelId(null);
      setDraggedRelAttr(null);
      setDraggedRelAttrBoxId(null);
    };

    if (isPanning || draggedTableId || draggedRelId || draggedRelAttr || draggedRelAttrBoxId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggedTableId, draggedRelId, draggedRelAttr, draggedRelAttrBoxId, scale]);

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
  const handleExportStatic = async () => {
    setIsExporting(true);
    setToastMessage('Preparing high-quality ERD export...');

    try {
      const canvasNode = document.getElementById('canvas');
      if (!canvasNode) {
        alert("Canvas element not found.");
        setIsExporting(false);
        return;
      }

      // Calculate diagram bounding box dynamically to prevent any cropping/clipping
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      if (tables.length === 0 && relationships.length === 0) {
        minX = 100;
        minY = 100;
        maxX = 800;
        maxY = 600;
      } else {
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
          const t1 = tables.find(t => t.id === rel.t1);
          const t2 = tables.find(t => t.id === rel.t2);
          if (t1 && t2) {
            const t1w = getTableWidth(t1);
            const t1h = getTableHeight(t1);
            const t2w = getTableWidth(t2);
            const t2h = getTableHeight(t2);
            const t1c = { x: t1.x + t1w / 2, y: t1.y + t1h / 2 };
            const t2c = { x: t2.x + t2w / 2, y: t2.y + t2h / 2 };
            const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + t1w / 2 : (t1c.x + t2c.x) / 2);
            const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);

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
      }

      // Add generous padding to make it clean
      const padding = 100;
      const targetWidth = (maxX - minX) + padding * 2;
      const targetHeight = (maxY - minY) + padding * 2;
      const shiftX = -minX + padding;
      const shiftY = -minY + padding;

      // Render using html-to-image with pixelRatio = 2 for high quality
      const dataUrl = await toPng(canvasNode, {
        width: targetWidth,
        height: targetHeight,
        style: {
          transform: `translate(${shiftX}px, ${shiftY}px) scale(1)`,
          transformOrigin: 'top left',
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          background: '#09090b radial-gradient(#1e1e24 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        },
        pixelRatio: 2,
        cacheBust: true,
      });

      // Simple, beautiful interactive HTML template
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported ERD - StructView</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root {
            --bg-dark: #09090b;
            --panel-dark: #0d0d10;
            --border-color: #27272a;
            --text-main: #f4f4f5;
            --text-muted: #a1a1aa;
            --accent-blue: #3b82f6;
            --accent-blue-hover: #2563eb;
            --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: var(--font-family);
            overflow: hidden;
        }
        .viewer-header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 64px;
            background-color: rgba(13, 13, 16, 0.85);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            z-index: 100;
        }
        .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 0.95rem;
            letter-spacing: -0.025em;
        }
        .logo span.icon {
            font-size: 1.2rem;
        }
        .logo span.badge {
            font-size: 0.7rem;
            background: rgba(59, 130, 246, 0.15);
            color: var(--accent-blue);
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .btn {
            background: #18181b;
            color: var(--text-main);
            border: 1px solid var(--border-color);
            padding: 8px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8rem;
            font-weight: 500;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn:hover {
            background: #27272a;
            border-color: #3f3f46;
        }
        .btn-primary {
            background: var(--accent-blue);
            border-color: var(--accent-blue);
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }
        .btn-primary:hover {
            background: var(--accent-blue-hover);
            border-color: var(--accent-blue-hover);
        }
        .viewport {
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            cursor: grab;
            background-color: var(--bg-dark);
            background-image: radial-gradient(#1e1e24 1px, transparent 1px);
            background-size: 20px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .viewport:active {
            cursor: grabbing;
        }
        .canvas-image {
            position: absolute;
            transform-origin: center center;
            max-width: none;
            user-select: none;
            -webkit-user-drag: none;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            transition: transform 0.05s ease-out;
        }
        .zoom-indicator {
            position: absolute;
            bottom: 24px;
            right: 24px;
            background-color: rgba(13, 13, 16, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-color);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            color: var(--text-muted);
            font-family: monospace;
            z-index: 90;
            pointer-events: none;
        }
        .guide-hint {
            position: absolute;
            bottom: 24px;
            left: 24px;
            background-color: rgba(13, 13, 16, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-color);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            color: var(--text-muted);
            z-index: 90;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .dot {
            width: 6px;
            height: 6px;
            background-color: var(--accent-blue);
            border-radius: 50%;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="viewer-header">
        <div class="logo">
            <span class="icon">📊</span>
            <span>StructView Static ERD</span>
            <span class="badge">High-Res Export</span>
        </div>
        <div class="controls">
            <button class="btn" id="btn-zoom-out" title="Zoom Out">➖ Zoom Out</button>
            <button class="btn" id="btn-zoom-in" title="Zoom In">➕ Zoom In</button>
            <button class="btn" id="btn-reset" title="Reset View">🔄 Reset</button>
            <button class="btn btn-primary" id="btn-download" title="Download High-Res PNG">📥 Download PNG</button>
        </div>
    </div>

    <div class="viewport" id="viewport">
        <img class="canvas-image" id="canvas-image" src="${dataUrl}" alt="Exported ERD" />
    </div>

    <div class="zoom-indicator" id="zoom-indicator">100%</div>
    <div class="guide-hint" id="guide-hint">
        <span class="dot"></span>
        <span>Drag to pan • Use mouse wheel to zoom</span>
    </div>

    <script>
        const viewport = document.getElementById('viewport');
        const img = document.getElementById('canvas-image');
        const zoomInBtn = document.getElementById('btn-zoom-in');
        const zoomOutBtn = document.getElementById('btn-zoom-out');
        const resetBtn = document.getElementById('btn-reset');
        const downloadBtn = document.getElementById('btn-download');
        const zoomIndicator = document.getElementById('zoom-indicator');

        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;

        // Center image initially
        function updateTransform() {
            img.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${scale})\`;
            zoomIndicator.textContent = \`\${Math.round(scale * 100)}%\`;
        }

        // Drag and Pan
        viewport.addEventListener('mousedown', (e) => {
            if (e.target === downloadBtn || e.target.closest('.controls')) return;
            isDragging = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            updateTransform();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Zoom via Wheel
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 0.08;
            const oldScale = scale;
            if (e.deltaY < 0) {
                scale = Math.min(scale + zoomFactor, 4);
            } else {
                scale = Math.max(scale - zoomFactor, 0.15);
            }
            
            // Adjust pan to zoom towards mouse position
            const rect = img.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            panX -= mouseX * (scale / oldScale - 1);
            panY -= mouseY * (scale / oldScale - 1);

            updateTransform();
        }, { passive: false });

        // Button controls
        zoomInBtn.addEventListener('click', () => {
            scale = Math.min(scale + 0.15, 4);
            updateTransform();
        });

        zoomOutBtn.addEventListener('click', () => {
            scale = Math.max(scale - 0.15, 0.15);
            updateTransform();
        });

        resetBtn.addEventListener('click', () => {
            scale = 1;
            panX = 0;
            panY = 0;
            updateTransform();
        });

        // Download PNG
        downloadBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = img.src;
            link.download = \`ERD_Export_\${Date.now()}.png\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        // Initialize
        updateTransform();
    </script>
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

      setToastMessage('High-resolution ERD exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export ERD as image. Try again.');
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

  const handleRelAttrBoxMouseDown = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    setDraggedRelAttrBoxId(relId);
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
        const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + 110 : (x1 + x2) / 2);
        const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (y1 + y2) / 2);
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
                <span>Export Static ERD</span>
              </>
            )}
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
          <svg id="svg-layer">
            {relationships.map(rel => {
              const t1 = tables.find(t => t.id === rel.t1);
              const t2 = tables.find(t => t.id === rel.t2);
              if (!t1 || !t2) return null;

              const t1w = getTableWidth(t1);
              const t2w = getTableWidth(t2);
              const t1h = getTableHeight(t1);
              const t2h = getTableHeight(t2);
              const t1c = { x: t1.x + t1w / 2, y: t1.y + t1h / 2 };
              const t2c = { x: t2.x + t2w / 2, y: t2.y + t2h / 2 };

              const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + t1w / 2 : (t1c.x + t2c.x) / 2);
              const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);
              const m = { x: mx, y: my };

              const relW = getRelationshipWidth(rel.name);
              const relH = getRelationshipHeight(rel.name);

              let edge1: Point;
              let edge2: Point;
              let dia1: Point;
              let dia2: Point;

              if (t1.id === t2.id) {
                // Self relationship connection points at top-left and top-right of table
                edge1 = { x: t1.x + Math.min(60, t1w * 0.25), y: t1.y };
                edge2 = { x: t1.x + t1w - Math.min(60, t1w * 0.25), y: t1.y };
                dia1 = getRhombusIntersection(m, edge1, relW, relH);
                dia2 = getRhombusIntersection(m, edge2, relW, relH);
              } else {
                edge1 = getRectIntersection({ x: t1.x, y: t1.y, w: t1w, h: t1h }, m);
                edge2 = getRectIntersection({ x: t2.x, y: t2.y, w: t2w, h: t2h }, m);
                dia1 = getRhombusIntersection(m, t1c, relW, relH);
                dia2 = getRhombusIntersection(m, t2c, relW, relH);
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
              const t1 = tables.find(t => t.id === rel.t1);
              const t2 = tables.find(t => t.id === rel.t2);
              if (!t1 || !t2) return null;

              const t1w = getTableWidth(t1);
              const t2w = getTableWidth(t2);
              const t1h = getTableHeight(t1);
              const t2h = getTableHeight(t2);
              const t1c = { x: t1.x + t1w / 2, y: t1.y + t1h / 2 };
              const t2c = { x: t2.x + t2w / 2, y: t2.y + t2h / 2 };

              const mx = rel.mx !== null ? rel.mx : (t1.id === t2.id ? t1.x + t1w / 2 : (t1c.x + t2c.x) / 2);
              const my = rel.my !== null ? rel.my : (t1.id === t2.id ? t1.y - 45 : (t1c.y + t2c.y) / 2);

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
                        fill="var(--card-bg)"
                        stroke="var(--accent-purple)"
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
                        <strong>From:</strong> {t1.name}<br />
                        <strong>To:</strong> {t2.name}<br />
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
