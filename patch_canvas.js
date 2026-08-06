const fs = require('fs');
const file = '/workspaces/quadcore-hackathon-2k26/components/BlockNoteEditor.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add StickyNote component
const stickyNoteComponent = `
function StickyNote({ note, updateNote, deleteNote }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initX: 0, initY: 0 });

  function onPointerDown(e) {
    if (e.target.closest('.sticky-drag-handle')) {
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, initX: note.x, initY: note.y };
      
      const onPointerMove = (evt) => {
        updateNote({
          x: dragStart.current.initX + (evt.clientX - dragStart.current.x),
          y: dragStart.current.initY + (evt.clientY - dragStart.current.y)
        });
      };
      const onPointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }
  }

  const colorStyles = {
    yellow: "bg-yellow-200 border-yellow-300 text-yellow-900",
    blue: "bg-blue-200 border-blue-300 text-blue-900",
    green: "bg-green-200 border-green-300 text-green-900",
    pink: "bg-pink-200 border-pink-300 text-pink-900",
  };

  return (
    <div
      style={{ left: note.x, top: note.y, width: note.width, height: note.height }}
      className={\`absolute flex flex-col shadow-lg border resize overflow-hidden \${colorStyles[note.color || 'yellow']}\`}
      onPointerDown={onPointerDown}
      onMouseUp={(e) => {
        if (!isDragging) {
          updateNote({ width: e.currentTarget.offsetWidth, height: e.currentTarget.offsetHeight });
        }
      }}
    >
      <div className="sticky-drag-handle h-6 flex shrink-0 items-center justify-between px-2 cursor-move bg-black/10 hover:bg-black/20 transition-colors">
        <div className="flex gap-1.5">
          {['yellow', 'blue', 'green', 'pink'].map(c => (
            <button key={c} onPointerDown={(e) => { e.stopPropagation(); updateNote({ color: c }); }} className={\`w-3 h-3 rounded-full \${colorStyles[c]} hover:scale-110 border border-black/20\`} />
          ))}
        </div>
        <button onPointerDown={(e) => { e.stopPropagation(); deleteNote(); }} className="text-black/40 hover:text-black font-bold">✕</button>
      </div>
      <textarea
        className="flex-1 w-full p-2 bg-transparent outline-none resize-none font-medium text-sm placeholder:text-black/30"
        value={note.text}
        onChange={(e) => updateNote({ text: e.target.value })}
        placeholder="Type here..."
      />
    </div>
  );
}

// ─── Canvas Modal (85% Screen Drawing Workspace) ────────────────────
`;
content = content.replace('// ─── Canvas Modal (85% Screen Drawing Workspace) ────────────────────', stickyNoteComponent);

// 2. Update CanvasModal signature and add stickyNotes state
content = content.replace(
  'function CanvasModal({ drawingData, bgType: initialBgType, title, onSave, onClose }) {',
  'function CanvasModal({ drawingData, bgType: initialBgType, title, stickyNotes: initialStickyNotes, onSave, onClose }) {'
);

content = content.replace(
  'const [bgType, setBgType] = useState(initialBgType || "dots");',
  'const [bgType, setBgType] = useState(initialBgType || "dots");\n  const [stickyNotes, setStickyNotes] = useState(initialStickyNotes || []);'
);

// 3. Add sticky tool to TOOLS
content = content.replace(
  '{ id: "ruler", label: "Ruler Line", icon: "📐", opacity: 1 },',
  '{ id: "ruler", label: "Ruler Line", icon: "📐", opacity: 1 },\n    { id: "sticky", label: "Sticky Note", icon: "📝", opacity: 1 },'
);

// 4. Update startDrawing
const newStartDrawing = `function startDrawing(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    
    if (tool === "sticky") {
      setStickyNotes(prev => [...prev, {
        id: \`sticky_\${Date.now()}\`,
        x: coords.x,
        y: coords.y,
        width: 160,
        height: 160,
        color: 'yellow',
        text: ''
      }]);
      setTool("pen");
      return;
    }

    setIsDrawing(true);`;
content = content.replace('function startDrawing(e) {\n    e.preventDefault();\n    const coords = getCanvasCoords(e);\n    setIsDrawing(true);', newStartDrawing);

// 5. Update onSave
content = content.replace(
  'onSave(dataUrl, bgType);',
  'onSave(dataUrl, bgType, stickyNotes);'
);

// 6. Update rendering in CanvasModal
const overlayRender = `
          {stickyNotes.map((note) => (
             <StickyNote 
               key={note.id} 
               note={note} 
               updateNote={(updates) => setStickyNotes(prev => prev.map(n => n.id === note.id ? {...n, ...updates} : n))} 
               deleteNote={() => setStickyNotes(prev => prev.filter(n => n.id !== note.id))} 
             />
          ))}
          
          {/* Floating Circular Eraser Preview Cursor */}`;
content = content.replace('{/* Floating Circular Eraser Preview Cursor */}', overlayRender);

// 7. Update Canvas block wrapper onSave callback
content = content.replace(
  'onSave={(newData, newBg) => {',
  'onSave={(newData, newBg, newStickyNotes) => {'
);
content = content.replace(
  'onUpdateBlock(block.id, { drawingData: newData, bgType: newBg }, true);',
  'onUpdateBlock(block.id, { drawingData: newData, bgType: newBg, stickyNotes: newStickyNotes }, true);'
);

// 8. Pass stickyNotes to CanvasModal
content = content.replace(
  'bgType={block.bgType || "dots"}',
  'bgType={block.bgType || "dots"}\n              stickyNotes={block.stickyNotes || []}'
);

fs.writeFileSync(file, content);
console.log("Successfully patched BlockNoteEditor.jsx");
