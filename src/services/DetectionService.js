import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { APP_CONFIG } from '../utils/config.js';
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

  async predict(imageElement) {
    if (!this.isLoaded()) {
      throw new Error('Model deteksi belum siap.');
    }

    if (!imageElement || imageElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const scores = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(imageElement);
      const resized = tf.image.resizeBilinear(
        pixels,
        [this.config.imageSize, this.config.imageSize],
        true,
      );
      const normalized = resized.toFloat().div(127.5).sub(1);
      const batched = normalized.expandDims(0);
      const prediction = this.model.predict(batched);
      const output = Array.isArray(prediction) ? prediction[0] : prediction;

      return Array.from(output.dataSync());
    });

    if (!scores.length) {
      return null;
    }

    const highest = scores.reduce(
      (best, score, index) => (score > best.score ? { score, index } : best),
      { score: Number.NEGATIVE_INFINITY, index: -1 },
    );

    const confidence = Math.round(highest.score * 100);
    const className = this.labels[highest.index] || 'Tidak diketahui';

    return {
      className,
      score: highest.score,
      confidence,
      isValid: confidence >= this.config.confidenceThreshold,
      backend: this.currentBackend,
      allScores: this.labels.map((label, index) => ({
        label,
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
