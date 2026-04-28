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

const VEGETABLE_ALIASES = {
  Beetroot: ['beetroot', 'bit', 'umbi bit'],
  Paprika: ['paprika', 'bell pepper'],
  Cabbage: ['cabbage', 'kubis', 'kol'],
  Carrot: ['carrot', 'wortel'],
  Cauliflower: ['cauliflower', 'kembang kol'],
  Chilli: ['chilli', 'chili', 'cabai', 'cabe'],
  Corn: ['corn', 'jagung'],
  Cucumber: ['cucumber', 'mentimun', 'timun'],
  eggplant: ['eggplant', 'terong'],
  Garlic: ['garlic', 'bawang putih'],
  Ginger: ['ginger', 'jahe'],
  Lettuce: ['lettuce', 'selada'],
  Onion: ['onion', 'bawang bombai', 'bawang bawang bombay', 'bawang bombay'],
  Peas: ['peas', 'kacang polong'],
  Potato: ['potato', 'kentang'],
  Turnip: ['turnip', 'lobak putih kecil', 'turnip'],
  Soybean: ['soybean', 'kedelai'],
  Spinach: ['spinach', 'bayam'],
};

const DISPLAY_NAMES = {
  Beetroot: 'bit',
  Paprika: 'paprika',
  Cabbage: 'kubis',
  Carrot: 'wortel',
  Cauliflower: 'kembang kol',
  Chilli: 'cabai',
  Corn: 'jagung',
  Cucumber: 'mentimun',
  eggplant: 'terong',
  Garlic: 'bawang putih',
  Ginger: 'jahe',
  Lettuce: 'selada',
  Onion: 'bawang bombai',
  Peas: 'kacang polong',
  Potato: 'kentang',
  Turnip: 'turnip',
  Soybean: 'kedelai',
  Spinach: 'bayam',
};

const OTHER_PRODUCE_TERMS = [
  'apple', 'apel', 'banana', 'pisang', 'orange', 'jeruk', 'grape', 'anggur',
  'mango', 'mangga', 'tomato', 'tomat', 'broccoli', 'brokoli', 'celery', 'seledri',
  'cabbage', 'kubis', 'carrot', 'wortel', 'onion', 'bawang bombai', 'bawang bombay',
  'potato', 'kentang', 'corn', 'jagung', 'spinach', 'bayam', 'cucumber', 'mentimun',
  'eggplant', 'terong', 'garlic', 'bawang putih', 'ginger', 'jahe', 'lettuce', 'selada',
  'peas', 'kacang polong', 'soybean', 'kedelai', 'turnip', 'chilli', 'cabai', 'paprika',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAliases(vegetableName) {
  return VEGETABLE_ALIASES[vegetableName] || [vegetableName.toLowerCase()];
}

function getDisplayName(vegetableName) {
  return DISPLAY_NAMES[vegetableName] || vegetableName;
}

function containsTargetVegetable(text, vegetableName) {
  const lowerText = text.toLowerCase();
  return getAliases(vegetableName).some((alias) => lowerText.includes(alias.toLowerCase()));
}

function replaceWrongProduceTerms(text, vegetableName) {
  const displayName = getDisplayName(vegetableName);
  const allowedAliases = new Set(getAliases(vegetableName).map((alias) => alias.toLowerCase()));
  let syncedText = text;

  OTHER_PRODUCE_TERMS.forEach((term) => {
    if (!allowedAliases.has(term.toLowerCase())) {
      const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
      syncedText = syncedText.replace(pattern, displayName);
    }
  });

  return syncedText;
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
    const displayName = getDisplayName(vegetableName);

    return [
      'Task: Write a unique fun fact about exactly one vegetable.',
      `Target vegetable label: ${vegetableName}.`,
      `Indonesian vegetable name: ${displayName}.`,
      `Only discuss ${displayName}. Do not mention apple, fruit, or any different vegetable.`,
      `Focus: ${angle}.`,
      toneInstruction,
      'Output language: Indonesian.',
      `Start the first sentence with "${displayName}".`,
      'Output format: exactly two short Indonesian sentences.',
      'Maximum length: 45 Indonesian words.',
      'Do not include medical claims. Do not say you are an AI. Do not repeat the prompt.',
    ].join(' ');
  }

  cleanGeneratedText(text, vegetableName) {
    const displayName = getDisplayName(vegetableName);
    let cleaned = String(text || '')
      .replace(/^(Task|Target vegetable label|Indonesian vegetable name|Vegetable|Focus|Output language|Output format|Maximum length)\s*:.*$/gim, '')
      .replace(/^\s*(Fun fact|Fakta menarik|Answer|Jawaban)\s*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      throw new Error(`Model generative AI belum menghasilkan teks untuk ${vegetableName}.`);
    }

    cleaned = replaceWrongProduceTerms(cleaned, vegetableName);

    if (!containsTargetVegetable(cleaned, vegetableName)) {
      cleaned = `${displayName} adalah sayuran yang sedang terdeteksi. ${cleaned}`;
    }

    return cleaned;
  }

  async generateOnce(vegetableName) {
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
  }

  async generateFacts(vegetableName) {
    if (!vegetableName) {
      throw new Error('Nama sayuran kosong.');
    }

    if (!this.generator || !this.isModelLoaded) {
      throw new Error('Model generative AI belum siap. Tunggu proses loading model Xenova selesai.');
    }

    if (this.isGenerating) {
      throw new Error('Si Otak sedang menyusun fakta sebelumnya. Coba beberapa detik lagi.');
    }

    this.isGenerating = true;

    try {
      const firstText = await this.generateOnce(vegetableName);
      if (containsTargetVegetable(firstText, vegetableName)) {
        return firstText;
      }

      return await this.generateOnce(vegetableName);
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
