
import React from 'react';
import { ParticleConfig, ShapeType } from '../types';

interface Props {
  config: ParticleConfig;
  onChange: (newConfig: Partial<ParticleConfig>) => void;
  onDrawRequest: () => void;
  handOpenness: number;
  videoDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onCameraChange: (deviceId: string) => void;
}

const shapeLabels: Record<string, string> = {
  [ShapeType.NEBULA]: '星云',
  [ShapeType.HEART]: '爱心',
  [ShapeType.SPHERE]: '球体',
  [ShapeType.GALAXY]: '星系螺旋',
  [ShapeType.MOBIUS]: '莫比乌斯环'
};

export const Controls: React.FC<Props> = ({ 
  config, 
  onChange, 
  onDrawRequest, 
  handOpenness,
  videoDevices,
  selectedDeviceId,
  onCameraChange
}) => {
  const isMulticolor = config.color === 'MULTICOLOR';
  
  return (
    <div className="absolute top-4 left-4 z-40 w-80 bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl text-white transition-all duration-300 hover:bg-black/60 font-sans max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
          粒子变形
        </h1>
        <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${handOpenness > 0.5 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-orange-500'}`} />
                <span className="text-xs text-gray-400">{handOpenness > 0.5 ? '张开' : '握拳'}</span>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Camera Selector (Only if multiple cameras exist) */}
        {videoDevices.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">摄像头选择</label>
            <div className="relative">
              <select 
                value={selectedDeviceId}
                onChange={(e) => onCameraChange(e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-gray-300 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 appearance-none cursor-pointer hover:bg-white/10 transition-colors"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-zinc-900 text-gray-300">
                    {device.label || `摄像头 ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        )}

        {/* Shapes */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">模型选择</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(shapeLabels).map(([type, label]) => (
              <button
                key={type}
                onClick={() => onChange({ shape: type as ShapeType })}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  config.shape === type
                    ? 'bg-white/20 border-white/40 text-white shadow-lg'
                    : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
             <button
                onClick={onDrawRequest}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  config.shape === ShapeType.CUSTOM
                    ? 'bg-white/20 border-white/40 text-white shadow-lg'
                    : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                手绘自定义
              </button>
          </div>
        </div>

        {/* Sliders */}
        <div>
           <div className="flex justify-between mb-1">
             <label className="text-xs font-semibold text-gray-400">粒子密度</label>
             <span className="text-xs text-gray-500">{Math.round(config.density * 100)}%</span>
           </div>
           <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={config.density}
            onChange={(e) => onChange({ density: parseFloat(e.target.value) })}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        <div>
           <div className="flex justify-between mb-1">
             <label className="text-xs font-semibold text-gray-400">手势扩散力度</label>
             <span className="text-xs text-gray-500">{Math.round(config.spread * 100)}%</span>
           </div>
           <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={config.spread}
            onChange={(e) => onChange({ spread: parseFloat(e.target.value) })}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">粒子颜色</label>
          <div className="flex gap-2 h-10">
              {/* Multicolor Button */}
              <button
                onClick={() => onChange({ color: 'MULTICOLOR' })}
                className={`flex-1 rounded-lg border transition-all flex items-center justify-center font-bold text-sm tracking-wide ${
                  isMulticolor 
                    ? 'border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                    : 'border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                }`}
                style={{
                  background: 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff)'
                }}
              >
                🌈 多彩
              </button>

              {/* Single Color Picker */}
              <div className={`relative flex-1 bg-white/5 rounded-lg border flex items-center gap-2 px-2 transition-all ${!isMulticolor ? 'border-white/40 bg-white/10' : 'border-white/10 opacity-60'}`}>
                  <input 
                    type="color" 
                    value={isMulticolor ? '#ffffff' : config.color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-xs font-mono text-gray-300 flex-1 text-center">
                    {isMulticolor ? '单色' : config.color}
                  </span>
              </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-[10px] text-gray-500 leading-relaxed">
              张开手掌以扩散粒子，握紧拳头将粒子凝聚成选定形状。
          </p>
      </div>
    </div>
  );
};
