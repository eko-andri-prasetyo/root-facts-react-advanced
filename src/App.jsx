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
  const lastPredictionAtRef = useRef(0);
  const initializedRef = useRef(false);
  const servicesRef = useRef({ detector: null, camera: null, generator: null });
  const [currentTone, setCurrentTone] = useState(TONE_CONFIG.defaultTone);
  const [copyStatus, setCopyStatus] = useState('idle');

  const stopDetectionLoop = useCallback(() => {
    isRunningRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    servicesRef.current.camera?.stopCamera();
    actions.setRunning(false);
  }, [actions, stopDetectionLoop]);

  const generateFunFact = useCallback(async (result) => {
    const { generator } = servicesRef.current;

    actions.setFunFactData(null);
    await createDelay(APP_CONFIG.factsGenerationDelay);

    try {
      const text = await generator.generateFacts(result.className);
      actions.setFunFactData(text);
    } catch (error) {
      logError('generateFunFact', error);
      actions.setFunFactData('error');
    }
  }, [actions]);

  const handleDetectionResult = useCallback(async (result) => {
    stopCamera();
    actions.setDetectionResult(result);
    actions.setAppState('result');
    await generateFunFact(result);
  }, [actions, generateFunFact, stopCamera]);

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

            if (result) {
              actions.setDetectionResult(result);
            }

            if (isValidDetection(result)) {
              await handleDetectionResult(result);
              return;
            }
          }
        } catch (error) {
          logError('runDetectionLoop', error);
          actions.setError(error.message);
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [actions, handleDetectionResult]);

  const handleToggleCamera = useCallback(async () => {
    const { camera, detector, generator } = servicesRef.current;

    if (state.isRunning) {
      stopCamera();
      actions.setAppState('idle');
      return;
    }

    if (!camera || !detector?.isLoaded() || !generator?.isReady()) {
      actions.setError('Model belum siap. Tunggu hingga status menjadi Model AI Siap.');
      return;
    }

    try {
      actions.resetResults();
      actions.setAppState('analyzing');
      await camera.startCamera();
      await createDelay(APP_CONFIG.analyzingDelay);
      actions.setRunning(true);
      isRunningRef.current = true;
      lastPredictionAtRef.current = 0;
      runDetectionLoop();
    } catch (error) {
      logError('handleToggleCamera', error);
      actions.setError(error.message);
      actions.setAppState('idle');
      actions.setRunning(false);
    }
  }, [actions, runDetectionLoop, state.isRunning, stopCamera]);

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
