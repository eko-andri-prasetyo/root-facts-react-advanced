import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { APP_CONFIG } from '../utils/config.js';
import { getVegetableNameId } from '../utils/vegetables.js';
import { isWebGPUSupported, validateModelMetadata } from '../utils/common.js';

const MODEL_URL = '/model/model.json';
const METADATA_URL = '/model/metadata.json';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.metadata = null;
    this.config = {
      imageSize: 224,
      confidenceThreshold: APP_CONFIG.detectionConfidenceThreshold,
    };
    this.currentBackend = 'unknown';
  }

  async setupAdaptiveBackend() {
    const candidates = isWebGPUSupported() ? ['webgpu', 'webgl', 'cpu'] : ['webgl', 'cpu'];

    for (const backend of candidates) {
      try {
        await tf.setBackend(backend);
        await tf.ready();
        this.currentBackend = tf.getBackend();
        return this.currentBackend;
      } catch (error) {
        console.warn(`Backend ${backend} tidak tersedia, mencoba backend lain.`, error);
      }
    }

    throw new Error('Tidak ada backend TensorFlow.js yang dapat digunakan.');
  }

  async loadModel(onProgress = () => {}) {
    onProgress({ stage: 'backend', progress: 5, message: 'Menyiapkan backend AI...' });
    await this.setupAdaptiveBackend();

    onProgress({ stage: 'metadata', progress: 10, message: 'Memuat metadata model...' });
    const metadataResponse = await fetch(METADATA_URL, { cache: 'force-cache' });
    if (!metadataResponse.ok) {
      throw new Error(`Metadata model gagal dimuat (${metadataResponse.status}).`);
    }

    const metadata = await metadataResponse.json();
    if (!validateModelMetadata(metadata)) {
      throw new Error('metadata.json tidak valid atau tidak memiliki daftar label.');
    }

    this.metadata = metadata;
    this.labels = metadata.labels;
    this.config.imageSize = Number(metadata.imageSize || 224);

    onProgress({ stage: 'model', progress: 15, message: 'Memuat model deteksi sayuran...' });
    this.model = await tf.loadLayersModel(MODEL_URL, {
      onProgress: (fraction) => {
        const percentage = 15 + Math.round(fraction * 45);
        onProgress({
          stage: 'model',
          progress: Math.min(60, percentage),
          message: `Memuat model deteksi... ${Math.min(60, percentage)}%`,
        });
      },
    });

    onProgress({ stage: 'warmup', progress: 65, message: 'Pemanasan model deteksi...' });
    tf.tidy(() => {
      const dummy = tf.zeros([1, this.config.imageSize, this.config.imageSize, 3]);
      const warmup = this.model.predict(dummy);
      if (Array.isArray(warmup)) {
        warmup.forEach((tensor) => tensor.dataSync());
      } else {
        warmup.dataSync();
      }
    });

    return {
      backend: this.currentBackend,
      labels: this.labels,
      imageSize: this.config.imageSize,
    };
  }

  hasActiveVideoFrame(imageElement) {
    if (!imageElement || imageElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return false;
    }

    const stream = imageElement.srcObject;
    const hasLiveTrack = Boolean(
      stream
      && stream.active
      && typeof stream.getVideoTracks === 'function'
      && stream.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled),
    );

    return Boolean(
      hasLiveTrack
      && !imageElement.paused
      && !imageElement.ended
      && imageElement.videoWidth > 0
      && imageElement.videoHeight > 0,
    );
  }

  async predict(imageElement) {
    if (!this.isLoaded()) {
      throw new Error('Model deteksi belum siap.');
    }

    if (!this.hasActiveVideoFrame(imageElement)) {
      return null;
    }

    const predictionData = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(imageElement);
      const resized = tf.image.resizeBilinear(
        pixels,
        [this.config.imageSize, this.config.imageSize],
        true,
      );
      const frame = resized.toFloat();
      const frameMean = frame.mean();
      const centered = frame.sub(frameMean);
      const frameStd = centered.square().mean().sqrt();
      const brightness = frameMean.dataSync()[0];
      const contrast = frameStd.dataSync()[0];

      if (brightness < 8 || contrast < 3) {
        return { scores: [], frameQuality: { brightness, contrast, isReadable: false } };
      }

      const normalized = frame.div(127.5).sub(1);
      const batched = normalized.expandDims(0);
      const prediction = this.model.predict(batched);
      const output = Array.isArray(prediction) ? prediction[0] : prediction;

      return {
        scores: Array.from(output.dataSync()),
        frameQuality: { brightness, contrast, isReadable: true },
      };
    });

    const { scores, frameQuality } = predictionData;

    if (!scores.length) {
      return null;
    }

    const highest = scores.reduce(
      (best, score, index) => (score > best.score ? { score, index } : best),
      { score: Number.NEGATIVE_INFINITY, index: -1 },
    );

    const confidence = Math.round(highest.score * 100);
    const className = this.labels[highest.index] || 'Tidak diketahui';
    const displayName = getVegetableNameId(className);

    return {
      className,
      displayName,
      score: highest.score,
      confidence,
      isValid: confidence >= this.config.confidenceThreshold,
      backend: this.currentBackend,
      frameQuality,
      allScores: this.labels.map((label, index) => ({
        label,
        displayName: getVegetableNameId(label),
        score: scores[index] ?? 0,
        confidence: Math.round((scores[index] ?? 0) * 100),
      })),
    };
  }

  isLoaded() {
    return Boolean(this.model && this.labels.length > 0);
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}
