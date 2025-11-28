
import React, { useRef, useState, useEffect } from 'react';
import { Point3D } from '../types';

interface Props {
  onComplete: (points: Point3D[]) => void;
  onCancel: () => void;
}

export const DrawingCanvas: React.FC<Props> = ({ onComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const pointsRef = useRef<Point3D[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffff';
      ctx.strokeStyle = '#00ffff';
    }
  }, []);

  // Update line width when brush size changes
  useEffect(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
          ctx.lineWidth = brushSize;
      }
  }, [brushSize]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if(!canvas) return {x:0, y:0};
      
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }
      
      const rect = canvas.getBoundingClientRect();
      return {
          x: clientX - rect.left,
          y: clientY - rect.top
      };
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getPos(e);
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
    }
    
    // Add initial point
    addPoint(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    
    addPoint(x, y);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const addPoint = (x: number, y: number) => {
      const w = canvasRef.current!.width;
      const h = canvasRef.current!.height;
      
      const x3d = (x / w) * 40 - 20;
      const y3d = -((y / h) * 40 - 20); 
      
      // Scatter particles based on brush size to create volume
      const density = Math.max(1, Math.floor(brushSize / 2));
      const scatter = brushSize * 0.05; // Adjust multiplier for world space scatter

      for(let i=0; i<density; i++) {
          pointsRef.current.push({ 
              x: x3d + (Math.random() - 0.5) * scatter, 
              y: y3d + (Math.random() - 0.5) * scatter, 
              z: (Math.random() - 0.5) * 5 // Depth noise
          });
      }
  };

  const endDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
        ctx.closePath();
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pointsRef.current = [];
  };

  const handleConfirm = () => {
    if (pointsRef.current.length > 5) {
        onComplete(pointsRef.current);
    } else {
        onCancel();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center cursor-crosshair backdrop-blur-md font-sans">
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}
            className="absolute inset-0 w-full h-full touch-none"
        />
        
        {/* Top Controls: Actions */}
        <div className="absolute top-6 right-6 flex gap-3 z-10">
            <button 
                onClick={onCancel}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full border border-white/20 transition-all backdrop-blur-md text-sm"
            >
                取消
            </button>
            <button 
                onClick={handleConfirm}
                className="bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-2 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all font-bold text-sm"
            >
                确定生成
            </button>
        </div>

        {/* Bottom Controls: Tools */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 w-full max-w-md px-4">
             {/* Instructions overlay if empty */}
            {pointsRef.current.length === 0 && !isDrawing && (
                <div className="text-white/40 text-lg font-light tracking-widest pointer-events-none mb-4 animate-pulse">
                    请在屏幕上绘制图案
                </div>
            )}

            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl w-full flex items-center justify-between gap-6 shadow-2xl">
                 <button 
                    onClick={handleClear}
                    className="text-red-400 hover:text-red-300 text-sm font-medium px-3 py-1 hover:bg-white/5 rounded transition-colors whitespace-nowrap"
                >
                    清空画板
                </button>

                <div className="flex-1 flex items-center gap-3">
                    <span className="text-xs text-gray-400 whitespace-nowrap">画笔粗细</span>
                    <input 
                        type="range" 
                        min="2" 
                        max="20" 
                        step="1"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <span className="text-xs text-cyan-400 w-4 text-center">{brushSize}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
