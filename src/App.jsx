import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { CameraService } from './services/CameraService.js';
import { DetectionService } from './services/DetectionService.js';
import { RootFactsService } from './services/RootFactsService.js';
import { APP_CONFIG, TONE_CONFIG, isValidDetection } from './utils/config.js';
import { createDelay, logError } from './utils/common.js';

function App() {
  const { state, actions } = useAppState();
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);
  const isGeneratingResultRef = useRef(false);
  const lastPredictionAtRef = useRef(0);
  const stableDetectionRef = useRef({ className: null, count: 0 });
  const initializedRef = useRef(false);
  const servicesRef = useRef({ detector: null, camera: null, generator: null });
  const [currentTone, setCurrentTone] = useState(TONE_CONFIG.defaultTone);
  const [copyStatus, setCopyStatus] = useState('idle');

  const resetStableDetection = useCallback(() => {
    stableDetectionRef.current = { className: null, count: 0 };
  }, []);

  const stopDetectionLoop = useCallback(() => {
    isRunningRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    resetStableDetection();
    isGeneratingResultRef.current = false;
    servicesRef.current.camera?.stopCamera();
    actions.setRunning(false);
  }, [actions, resetStableDetection, stopDetectionLoop]);

  const generateFunFact = useCallback(async (result) => {
    const { generator } = servicesRef.current;

    actions.setFunFactData(null);
    await createDelay(APP_CONFIG.factsGenerationDelay);

    try {
      const text = await generator.generateFacts(result.className);
      actions.setFunFactData(text);
    } catch (error) {
      console.warn('generateFunFact belum stabil, menggunakan fakta aman.', error);
      const vegetableName = result.displayName || result.className || 'sayuran';
      actions.setFunFactData(vegetableName + ' memiliki fakta menarik karena ciri dan teksturnya mudah dikenali saat digunakan sebagai bahan masakan. Keunikan ini membuat ' + vegetableName + ' bermanfaat sebagai bahan pangan sehari-hari.');
    }
  }, [actions]);

  const handleDetectionResult = useCallback(async (result) => {
    if (isGeneratingResultRef.current) {
      return;
    }

    isGeneratingResultRef.current = true;

    // Stop only the prediction loop. Keep the camera stream visible so the UI
    // stays synchronized with the detected object and does not show a result
    // while the webcam is black/inactive.
    stopDetectionLoop();
    actions.setDetectionResult(result);
    actions.setAppState('result');
    await generateFunFact(result);
  }, [actions, generateFunFact, stopDetectionLoop]);

  const updateStableDetection = useCallback((result) => {
    if (!isValidDetection(result)) {
      resetStableDetection();
      return { stable: false, result: null };
    }

    const current = stableDetectionRef.current;
    const count = current.className === result.className ? current.count + 1 : 1;
    stableDetectionRef.current = { className: result.className, count };

    return {
      stable: count >= APP_CONFIG.requiredStableFrames,
      result: { ...result, stableFrameCount: count },
    };
  }, [resetStableDetection]);

  const runDetectionLoop = useCallback(() => {
    const loop = async (timestamp) => {
      if (!isRunningRef.current) {
        return;
      }

      const { detector, camera } = servicesRef.current;
      const frameInterval = camera?.getFrameInterval?.() || (1000 / APP_CONFIG.defaultFps);

      if (timestamp - lastPredictionAtRef.current >= frameInterval) {
        lastPredictionAtRef.current = timestamp;

        try {
          if (camera?.isReady() && detector?.isLoaded()) {
            const result = await detector.predict(camera.video);
            const { stable, result: stableResult } = updateStableDetection(result);

            if (stable && stableResult) {
              await handleDetectionResult(stableResult);
              return;
            }
          } else {
            resetStableDetection();
          }
        } catch (error) {
          logError('runDetectionLoop', error);
          actions.setError(error.message);
          resetStableDetection();
        }

        await createDelay(APP_CONFIG.detectionRetryInterval);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [actions, handleDetectionResult, resetStableDetection, updateStableDetection]);

  const handleToggleCamera = useCallback(async () => {
    const { camera, detector, generator } = servicesRef.current;

    if (state.isRunning) {
      stopCamera();
      actions.resetResults();
      actions.setAppState('idle');
      return;
    }

    if (!camera || !detector?.isLoaded() || !generator?.isReady()) {
      actions.setError('Model belum siap. Tunggu hingga status menjadi Model AI Siap.');
      return;
    }

    try {
      actions.resetResults();
      resetStableDetection();
      isGeneratingResultRef.current = false;
      actions.setAppState('analyzing');
      await camera.startCamera();
      await createDelay(APP_CONFIG.analyzingDelay);

      if (!camera.isReady()) {
        throw new Error('Kamera belum siap. Coba tekan Stop lalu Mulai Scan kembali.');
      }

      actions.setRunning(true);
      isRunningRef.current = true;
      lastPredictionAtRef.current = performance.now();
      runDetectionLoop();
    } catch (error) {
      logError('handleToggleCamera', error);
      stopCamera();
      actions.setError(error.message);
      actions.setAppState('idle');
      actions.setRunning(false);
    }
  }, [actions, resetStableDetection, runDetectionLoop, state.isRunning, stopCamera]);

  const handleToneChange = useCallback((tone) => {
    setCurrentTone(tone);
    servicesRef.current.generator?.setTone(tone);
  }, []);

  const handleCopyFact = useCallback(async () => {
    if (!state.funFactData || state.funFactData === 'error') {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.funFactData);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1500);
    } catch (error) {
      logError('handleCopyFact', error);
      actions.setError('Gagal menyalin teks ke papan klip.');
    }
  }, [actions, state.funFactData]);

  useEffect(() => {
    if (initializedRef.current) {
      return undefined;
    }

    initializedRef.current = true;
    let isMounted = true;

    const initializeApp = async () => {
      const detector = new DetectionService();
      const camera = new CameraService();
      const generator = new RootFactsService();
      generator.setTone(currentTone);

      servicesRef.current = { detector, camera, generator };
      actions.setServices(servicesRef.current);

      try {
        actions.setModelStatus('Menunggu Model... 0%');

        await detector.loadModel(({ progress, message }) => {
          if (isMounted) {
            actions.setModelStatus(message || `Menunggu Model... ${progress}%`);
          }
        });

        await generator.loadModel(({ progress, message }) => {
          if (isMounted) {
            actions.setModelStatus(message || `Menunggu Model... ${progress}%`);
          }
        });

        if (isMounted) {
          actions.setModelStatus('Model AI Siap');
        }
      } catch (error) {
        logError('initializeApp', error);
        if (isMounted) {
          actions.setModelStatus('Model gagal dimuat');
          actions.setError(error.message);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      stopDetectionLoop();
      servicesRef.current.camera?.stopCamera();
      servicesRef.current.detector?.dispose();
      servicesRef.current.generator?.dispose();
    };
  }, [actions, currentTone, stopDetectionLoop]);

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
          copyStatus={copyStatus}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js, Transformers.js, React, dan Workbox PWA.</p>
      </footer>

      {state.error && (
        <div className="error-toast" role="alert">
          <strong>Error:</strong> {state.error}
          <button
            type="button"
            onClick={() => actions.setError(null)}
            aria-label="Tutup pesan error"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
