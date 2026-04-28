export const APP_CONFIG = {
  detectionConfidenceThreshold: 85,
  analyzingDelay: 900,
  factsGenerationDelay: 250,
  detectionRetryInterval: 120,
  requiredStableFrames: 3,
  cameraWarmupDelay: 700,
  defaultFps: 15,
};

export const ROOT_FACTS_CONFIG = {
  temperature: 0.75,
  maxNewTokens: 110,
  topP: 0.9,
  doSample: true,
};

export const TONE_CONFIG = {
  availableTones: [
    { value: 'normal', label: 'Normal' },
    { value: 'funny', label: 'Lucu' },
    { value: 'history', label: 'Sejarah' },
    { value: 'professional', label: 'Profesional' },
    { value: 'casual', label: 'Santai' },
  ],
  defaultTone: 'normal',
};

export const isValidDetection = (result) => {
  const { detectionConfidenceThreshold } = APP_CONFIG;
  return result && result.isValid && result.confidence >= detectionConfidenceThreshold;
};
