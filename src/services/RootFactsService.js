import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Use a friendly and educational tone.',
  funny: 'Use a playful and funny tone, but keep it polite.',
  history: 'Use a short historical storyteller tone and include cultural context when possible.',
  professional: 'Use a concise, professional, and science-informed tone.',
  casual: 'Use a warm, casual tone as if explaining to a friend.',
};

const FACT_ANGLES = [
  'origin and cultivation',
  'unique plant characteristics',
  'culinary use',
  'color, smell, or texture',
  'storage and freshness',
  'traditional food culture',
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getGeneratedText(result) {
  if (Array.isArray(result)) {
    return result[0]?.generated_text || result[0]?.summary_text || result[0]?.text || '';
  }

  return result?.generated_text || result?.summary_text || result?.text || '';
}

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = ROOT_FACTS_CONFIG;
    this.currentBackend = 'not-loaded';
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel(onProgress = () => {}) {
    onProgress({
      stage: 'import',
      progress: 70,
      message: 'Menyiapkan Transformers.js untuk Si Otak...',
    });

    const { pipeline, env } = await import('@huggingface/transformers');

    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
    }

    const deviceCandidates = isWebGPUSupported() ? ['webgpu', 'wasm'] : ['wasm'];
    let lastError = null;

    for (const device of deviceCandidates) {
      try {
        this.currentBackend = device;
        onProgress({
          stage: 'pipeline',
          progress: device === 'webgpu' ? 74 : 78,
          message: `Memuat model Xenova/flan-t5-small melalui ${device.toUpperCase()}...`,
        });

        this.generator = await pipeline('text2text-generation', FACT_MODEL, {
          device,
          dtype: 'q4',
          progress_callback: (data) => {
            if (typeof data?.progress === 'number') {
              const progress = 78 + Math.round((data.progress / 100) * 17);
              onProgress({
                stage: data.status || 'download',
                progress: Math.min(95, progress),
                message: `Memuat model generative AI Xenova... ${Math.min(95, progress)}%`,
              });
            }
          },
        });

        this.isModelLoaded = true;
        onProgress({
          stage: 'ready',
          progress: 98,
          message: `Model generative AI siap (${device.toUpperCase()})...`,
        });

        return { backend: this.currentBackend, model: FACT_MODEL };
      } catch (error) {
        lastError = error;
        console.warn(`Gagal memuat model generative AI dengan backend ${device}.`, error);
      }
    }

    this.generator = null;
    this.isModelLoaded = false;
    this.currentBackend = 'failed';
    throw new Error(
      `Model generative AI Xenova gagal dimuat. Pastikan koneksi internet tersedia saat pemuatan pertama. Detail: ${lastError?.message || 'unknown error'}`,
    );
  }

  setTone(tone) {
    const allowedTone = TONE_CONFIG.availableTones.some((item) => item.value === tone);
    this.currentTone = allowedTone ? tone : TONE_CONFIG.defaultTone;
  }

  buildPrompt(vegetableName) {
    const angle = pickRandom(FACT_ANGLES);
    const toneInstruction = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;

    return [
      'Task: Generate a unique vegetable fun fact.',
      `Vegetable: ${vegetableName}.`,
      `Focus: ${angle}.`,
      toneInstruction,
      'Output language: Indonesian.',
      'Output format: exactly two short Indonesian sentences.',
      'Maximum length: 45 Indonesian words.',
      'Do not include medical claims. Do not say you are an AI. Do not repeat the prompt.',
    ].join(' ');
  }

  cleanGeneratedText(text, vegetableName) {
    const cleaned = String(text || '')
      .replace(/^(Task|Vegetable|Focus|Output language|Output format|Maximum length)\s*:.*$/gim, '')
      .replace(/^\s*(Fun fact|Fakta menarik|Answer|Jawaban)\s*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      throw new Error(`Model generative AI belum menghasilkan teks untuk ${vegetableName}.`);
    }

    return cleaned;
  }

  async generateFacts(vegetableName) {
    if (!vegetableName) {
      throw new Error('Nama sayuran kosong.');
    }

    if (!this.generator || !this.isModelLoaded) {
      throw new Error('Model generative AI belum siap. Tunggu proses loading model Xenova selesai.');
    }

    if (this.isGenerating) {
      return 'Si Otak sedang menyusun fakta sebelumnya. Coba beberapa detik lagi.';
    }

    this.isGenerating = true;

    try {
      const prompt = this.buildPrompt(vegetableName);
      const result = await this.generator(prompt, {
        max_new_tokens: this.config.maxNewTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        do_sample: this.config.doSample,
        repetition_penalty: 1.08,
        no_repeat_ngram_size: 3,
      });

      return this.cleanGeneratedText(getGeneratedText(result), vegetableName);
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && Boolean(this.generator);
  }

  async dispose() {
    if (typeof this.generator?.dispose === 'function') {
      await this.generator.dispose();
    }

    this.generator = null;
    this.isModelLoaded = false;
  }
}
