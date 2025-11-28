
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { initializeHandTracker, detectHand } from './services/handTracking';
import { ParticleEngine } from './services/particleEngine';
import { Controls } from './components/Controls';
import { DrawingCanvas } from './components/DrawingCanvas';
import { ParticleConfig, ShapeType, Point3D } from './types';

// Independent component to handle video stream stability
const CameraPreview: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border border-white/20 shadow-lg z-30 bg-black">
      <video 
        ref={videoRef}
        autoPlay
        playsInline // Critical for mobile/Safari
        muted
        className="w-full h-full object-cover opacity-80"
        style={{ transform: 'scaleX(-1)' }}
      />
      <div className="absolute bottom-1 left-1 bg-black/60 px-1 rounded text-[10px] text-white">摄像头预览</div>
    </div>
  );
};

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Ref to track stream for cleanup (state value in cleanup closure is stale)
  const streamRef = useRef<MediaStream | null>(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [handOpenness, setHandOpenness] = useState(0); // 0 (closed) - 1 (open)
  const [isDrawing, setIsDrawing] = useState(false);
  const [config, setConfig] = useState<ParticleConfig>({
    density: 0.8,
    spread: 1.0,
    color: '#6366f1', // Indigo-500
    shape: ShapeType.NEBULA
  });

  const getDevices = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(videoInputs);
    } catch (e) {
        console.warn("Error enumerating devices", e);
    }
  };

  const startWebcam = async (deviceId?: string) => {
      setLoading(true);
      setError(null);
      
      // Stop existing stream if any
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
      }

      try {
        await initializeHandTracker();
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
           const constraints: MediaStreamConstraints = {
             video: { 
                 deviceId: deviceId ? { exact: deviceId } : undefined,
                 width: 640, 
                 height: 480,
                 frameRate: { ideal: 30 }
             } 
           };

           const stream = await navigator.mediaDevices.getUserMedia(constraints);
           
           // If successful, enumerate devices (labels are now available)
           await getDevices();

           // Set selected device ID from the active stream if not provided
           if (!deviceId) {
               const videoTrack = stream.getVideoTracks()[0];
               const settings = videoTrack.getSettings();
               if (settings.deviceId) {
                   setSelectedDeviceId(settings.deviceId);
               }
           } else {
               setSelectedDeviceId(deviceId);
           }
           
           setCameraStream(stream);
           streamRef.current = stream;
           
           if (videoRef.current) {
             videoRef.current.srcObject = stream;
             videoRef.current.onloadeddata = () => {
                 setLoading(false);
             };
           }
        } else {
            setError("此浏览器环境不支持访问摄像头，请尝试使用 Chrome/Edge 或检查 HTTPS 设置。");
            setLoading(false);
        }
      } catch (err: any) {
        console.error("Webcam/Tracker Error:", err);
        let msg = "初始化失败：";
        
        // Handle common DOMExceptions and Error types
        const errorName = err?.name || '';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
             msg = "摄像头权限被拒绝。请在浏览器设置中允许访问，并点击下方重试按钮。";
        } else if (errorName === 'NotFoundError') {
             msg = "未找到摄像头设备，请检查连接。";
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
             msg = "摄像头被其他应用占用或硬件无法访问。";
        } else if (err instanceof Error) {
             msg += err.message;
        } else if (typeof err === 'string') {
             msg += err;
        } else {
             try {
                // Defensive stringify to avoid [object Object]
                msg += JSON.stringify(err);
             } catch {
                msg += "发生了未知错误";
             }
        }
        
        setError(msg);
        setLoading(false);
      }
    };

  // Initialize Hand Tracking on mount
  useEffect(() => {
    startWebcam();
    return () => {
        // Use ref to access the current stream instance during cleanup
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    }
  }, []);

  // Initialize Three.js Engine with strict cleanup
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose existing engine if any
    if (engineRef.current) {
        engineRef.current.dispose();
    }

    const engine = new ParticleEngine(
        containerRef.current, 
        window.innerWidth, 
        window.innerHeight
    );
    engineRef.current = engine;
    engine.updateConfig(config); // Apply initial config

    const handleResize = () => {
      engine.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
        window.removeEventListener('resize', handleResize);
        engine.dispose();
        engineRef.current = null;
    };
  }, []); // Run once on mount (and cleanup on unmount)

  // Sync React Config to Engine
  useEffect(() => {
      if(engineRef.current) {
          engineRef.current.updateConfig(config);
      }
  }, [config]);

  // Main Animation Loop
  const loop = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState >= 2 && !loading && !error) {
       // 1. Detect Hand
       const handData = detectHand(videoRef.current);
       let openVal = 0;
       
       if (handData) {
           openVal = handData.openness;
       } else {
           // Default idle animation if no hand detected
           openVal = (Math.sin(Date.now() / 1000) + 1) * 0.2; 
       }
       
       setHandOpenness(openVal);

       // 2. Update Particles
       if (engineRef.current) {
           engineRef.current.animate(openVal);
       }
    } else if (engineRef.current && !loading) {
        // Fallback animation
        engineRef.current.animate(0.5);
    }

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [loading, error]);

  useEffect(() => {
      animationFrameRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationFrameRef.current);
  }, [loop]);


  // Event Handlers
  const handleConfigChange = (newConf: Partial<ParticleConfig>) => {
      setConfig(prev => ({ ...prev, ...newConf }));
  };

  const handleDrawComplete = (points: Point3D[]) => {
      if(engineRef.current) {
          engineRef.current.setCustomShape(points);
      }
      setConfig(prev => ({ ...prev, shape: ShapeType.CUSTOM }));
      setIsDrawing(false);
  };
  
  const handleCameraChange = (deviceId: string) => {
      startWebcam(deviceId);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
        {/* Hidden Video for MediaPipe */}
        <video 
            ref={videoRef} 
            className="absolute opacity-0 pointer-events-none"
            autoPlay 
            playsInline 
            muted
        />

        {/* 3D Container */}
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* UI Overlay */}
        {!isDrawing && !loading && !error && (
            <Controls 
                config={config} 
                onChange={handleConfigChange} 
                onDrawRequest={() => setIsDrawing(true)}
                handOpenness={handOpenness}
                videoDevices={videoDevices}
                selectedDeviceId={selectedDeviceId}
                onCameraChange={handleCameraChange}
            />
        )}

        {/* Drawing Mode Overlay */}
        {isDrawing && (
            <DrawingCanvas 
                onComplete={handleDrawComplete} 
                onCancel={() => setIsDrawing(false)}
            />
        )}

        {/* Loading State */}
        {loading && !error && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-light tracking-widest animate-pulse">视觉核心初始化中...</p>
                <p className="text-xs text-gray-500 mt-2">请允许摄像头访问</p>
            </div>
        )}

        {/* Error State with Retry */}
        {error && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 text-red-500 p-8 text-center">
                <div className="max-w-md bg-zinc-900/80 p-6 rounded-2xl border border-red-500/30 backdrop-blur-xl">
                    <h2 className="text-2xl font-bold mb-4 text-red-400">系统提示</h2>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button 
                        onClick={() => startWebcam()}
                        className="bg-red-500/20 hover:bg-red-500/40 text-red-300 hover:text-white px-6 py-2 rounded-full border border-red-500/50 transition-all font-semibold"
                    >
                        重试 / 开启摄像头
                    </button>
                </div>
            </div>
        )}
        
        {/* Camera Preview (Small PIP) */}
        {!loading && !isDrawing && !error && cameraStream && (
             <CameraPreview stream={cameraStream} />
        )}
    </div>
  );
};

export default App;
