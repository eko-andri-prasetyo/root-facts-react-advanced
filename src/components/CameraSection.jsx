import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, ScanLine, Zap } from 'lucide-react';
import { APP_CONFIG, TONE_CONFIG } from '../utils/config';

function CameraSection({
  isRunning,
  onToggleCamera,
  onToneChange,
  services,
  modelStatus,
  error,
  currentTone,
}) {
  const [fps, setFps] = useState(APP_CONFIG.defaultFps);
  const [cameraType, setCameraType] = useState('default');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (services.camera) {
      if (videoRef.current && !services.camera.video) {
        services.camera.setVideoElement(videoRef.current);
      }
      if (canvasRef.current && !services.camera.canvas) {
        services.camera.setCanvasElement(canvasRef.current);
      }
    }
  });

  useEffect(() => {
    services.camera?.setFPS(fps);
  }, [fps, services.camera]);

  const handleCameraChange = async (newCameraType) => {
    setCameraType(newCameraType);

    if (services.camera) {
      services.camera.selectedCamera = newCameraType === 'front' ? 'front' : 'environment';
    }

    if (services.camera?.isActive()) {
      await services.camera.startCamera(newCameraType);
    }
  };

  const handleFpsChange = (newFps) => {
    setFps(Number(newFps));
  };

  const isModelReady = modelStatus === 'Model AI Siap';
  const buttonDisabled = !isModelReady;
  const buttonText = isRunning ? 'Stop Scan' : 'Mulai Scan';

  return (
    <section className="camera-section" aria-label="Camera Feed and Controls">
      <div className="camera-container">
        <div className="camera-wrapper">
          <video
            ref={videoRef}
            id="media-video"
            autoPlay
            muted
            playsInline
            className={isRunning ? '' : 'hidden'}
          />

          <canvas
            ref={canvasRef}
            id="media-canvas"
            className="hidden"
          />

          <div className={`camera-overlay ${isRunning ? 'active' : ''}`}>
            <div className="overlay-frame"></div>
          </div>

          {!isRunning && (
            <div className="camera-placeholder">
              <Camera size={48} />
              <p>{buttonDisabled ? modelStatus : 'Kamera tidak aktif'}</p>
              {error && <p className="inline-error">{error}</p>}
            </div>
          )}
        </div>

        <div className="camera-controls">
          <button
            id="btn-toggle"
            type="button"
            className={`capture-btn ${isRunning ? 'scanning' : ''}`}
            onClick={onToggleCamera}
            disabled={buttonDisabled}
            aria-label={buttonText}
            title={buttonText}
          >
            <ScanLine size={24} />
          </button>
        </div>

        <div className="settings-bar">
          <div className="setting-item">
            <Camera size={16} />
            <select
              id="camera-select"
              value={cameraType}
              onChange={(event) => handleCameraChange(event.target.value)}
              disabled={isRunning}
              aria-label="Pilih kamera"
            >
              <option value="default">Kamera belakang/default</option>
              <option value="front">Kamera depan</option>
            </select>
          </div>

          <div className="setting-item fps-setting">
            <Zap size={16} />
            <span id="fps-label">{fps} FPS</span>
            <input
              id="fps-slider"
              type="range"
              min="5"
              max="30"
              step="5"
              value={fps}
              onChange={(event) => handleFpsChange(event.target.value)}
              disabled={isRunning}
              aria-label="Batasi FPS deteksi"
            />
          </div>

          <div className="setting-item tone-setting">
            <Mic size={16} />
            <select
              id="tone-select"
              value={currentTone || TONE_CONFIG.defaultTone}
              onChange={(event) => onToneChange?.(event.target.value)}
              disabled={isRunning}
              aria-label="Pilih gaya bahasa fun fact"
            >
              {TONE_CONFIG.availableTones.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CameraSection;
