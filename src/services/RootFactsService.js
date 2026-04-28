import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';
import { getVegetableAliases, getVegetableNameId } from '../utils/vegetables.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Gunakan gaya bahasa edukatif, ramah, dan mudah dipahami.',
  funny: 'Gunakan gaya bahasa lucu, ringan, dan tetap sopan.',
  history: 'Gunakan gaya bercerita sejarah yang singkat dan menarik.',
  professional: 'Gunakan gaya profesional, padat, dan informatif.',
  casual: 'Gunakan gaya santai seperti menjelaskan kepada teman.',
};

const FACT_ANGLES = [
  'asal-usul dan budidaya',
  'ciri khas tanaman',
  'penggunaan dalam masakan',
  'warna, aroma, atau tekstur',
  'cara penyimpanan dan kesegaran',
  'budaya makanan tradisional',
];

const OTHER_PRODUCE_TERMS = [
  'apple', 'apel', 'banana', 'pisang', 'orange', 'jeruk', 'grape', 'anggur',
  'mango', 'mangga', 'tomato', 'tomat', 'broccoli', 'brokoli', 'celery', 'seledri',
  'cabbage', 'kubis', 'carrot', 'wortel', 'onion', 'bawang bombai', 'bawang bombay',
  'potato', 'kentang', 'corn', 'jagung', 'spinach', 'bayam', 'cucumber', 'mentimun',
  'eggplant', 'terong', 'garlic', 'bawang putih', 'ginger', 'jahe', 'lettuce', 'selada',
  'peas', 'kacang polong', 'soybean', 'kedelai', 'turnip', 'lobak', 'chilli', 'chili', 'cabai', 'paprika',
  'beetroot', 'bit', 'cauliflower', 'kembang kol',
];

const ENGLISH_MARKERS = [
  'you', 'your', "you're", 'youre', 'expert', 'vegetable cuisine', 'better',
  'american', 'chef', 'recipe', 'this', 'that', 'the', 'and', 'but', 'with',
  'target', 'output', 'task', 'write', 'sentence', 'english', 'indonesian',
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
  return getVegetableAliases(vegetableName);
}

function getDisplayName(vegetableName) {
  return getVegetableNameId(vegetableName);
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

function splitSentences(text) {
  return String(text || '')
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isEnglishSentence(sentence) {
  const lower = sentence.toLowerCase();
  const asciiWords = lower.match(/[a-z]+/g) || [];
  const markerHits = ENGLISH_MARKERS.filter((marker) => lower.includes(marker)).length;
  const indonesianHints = [
    'adalah', 'yang', 'dan', 'atau', 'karena', 'dengan', 'sebagai', 'sering',
    'digunakan', 'memiliki', 'sayuran', 'warna', 'aroma', 'tekstur', 'masakan',
    'bawang', 'wortel', 'kubis', 'cabai', 'jagung', 'mentimun', 'terong',
  ].filter((word) => lower.includes(word)).length;

  return markerHits >= 1 && markerHits >= indonesianHints && asciiWords.length >= 3;
}

function removeMixedEnglish(text) {
  return splitSentences(text)
    .filter((sentence) => !isEnglishSentence(sentence))
    .join(' ')
    .replace(/\b(?:You(?:'re| are)?|your|expert|American|chef|recipe|vegetable cuisine|but you'?d better have an?)\b[^.!?]*[.!?]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMostlyIndonesian(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;

  const hasEnglish = ENGLISH_MARKERS.some((marker) => lower.includes(marker));
  const hasIndonesian = [
    'adalah', 'yang', 'dan', 'karena', 'memiliki', 'sering', 'digunakan',
    'bisa', 'dapat', 'sayuran', 'warna', 'aroma', 'tekstur', 'masakan',
  ].some((marker) => lower.includes(marker));

  return hasIndonesian && !hasEnglish;
}

function ensureTwoIndonesianSentences(text, vegetableName) {
  const displayName = getDisplayName(vegetableName);
  let cleaned = removeMixedEnglish(text);

  if (!cleaned) {
    return '';
  }

  cleaned = cleaned
    .replace(/\b(onion|carrot|cabbage|cauliflower|chilli|chili|corn|cucumber|eggplant|garlic|ginger|lettuce|peas|potato|turnip|soybean|spinach|beetroot)\b/gi, displayName)
    .replace(/\s+/g, ' ')
    .trim();

  if (!containsTargetVegetable(cleaned, vegetableName)) {
    cleaned = `${displayName} adalah sayuran yang sedang terdeteksi. ${cleaned}`;
  }

  const sentences = splitSentences(cleaned).slice(0, 2);
  return sentences
    .map((sentence) => sentence.replace(/[.!?]*$/, '.'))
    .join(' ')
    .trim();
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

  buildPrompt(vegetableName, attempt = 1) {
    const angle = pickRandom(FACT_ANGLES);
    const toneInstruction = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;
    const displayName = getDisplayName(vegetableName);

    if (attempt > 1) {
      return [
        `Deskripsikan terkait ${displayName} ini dalam bahasa Indonesia.`,
        `Tulis tepat dua kalimat pendek tentang ${displayName}.`,
        `Bahas ${displayName} saja, terutama dari sisi ${angle}.`,
        'Jangan memakai bahasa Inggris.',
        'Jangan menyebut buah, apel, chef, atau sayuran lain.',
        'Jangan menulis instruksi, judul, daftar, atau kalimat pembuka yang tidak perlu.',
      ].join(' ');
    }

    return [
      `Deskripsikan terkait ${displayName} ini dalam bahasa Indonesia.`,
      `Sayuran yang terdeteksi adalah ${displayName}.`,
      `Buat fakta menarik tentang ${displayName} saja dengan fokus ${angle}.`,
      toneInstruction,
      'Tulis tepat dua kalimat pendek.',
      `Kalimat pertama harus dimulai dengan kata "${displayName}".`,
      'Jangan memakai bahasa Inggris.',
      'Jangan menyebut buah, apel, chef, atau sayuran lain.',
      'Jangan memberikan klaim medis.',
    ].join(' ');
  }

  cleanGeneratedText(text, vegetableName) {
    const displayName = getDisplayName(vegetableName);
    let cleaned = String(text || '')
      .replace(/^(Tugas|Sayuran yang terdeteksi|Deskripsikan|Fokus|Gaya bahasa|Jawaban|Fakta menarik)\s*:.*$/gim, '')
      .replace(/^(Task|Target vegetable label|Indonesian vegetable name|Vegetable|Focus|Output language|Output format|Maximum length)\s*:.*$/gim, '')
      .replace(/^\s*(Fun fact|Fakta menarik|Answer|Jawaban)\s*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      throw new Error(`Model generative AI belum menghasilkan teks untuk ${displayName}.`);
    }

    cleaned = replaceWrongProduceTerms(cleaned, vegetableName);
    cleaned = ensureTwoIndonesianSentences(cleaned, vegetableName);

    if (!cleaned || !containsTargetVegetable(cleaned, vegetableName) || !isMostlyIndonesian(cleaned)) {
      throw new Error(`Teks generative AI belum konsisten memakai bahasa Indonesia untuk ${displayName}.`);
    }

    return cleaned;
  }

  async generateOnce(vegetableName, attempt = 1) {
    const prompt = this.buildPrompt(vegetableName, attempt);
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
      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          return await this.generateOnce(vegetableName, attempt);
        } catch (error) {
          lastError = error;
          console.warn(`Percobaan generate fakta ke-${attempt} belum valid.`, error);
        }
      }

      throw lastError || new Error('Model generative AI belum menghasilkan fakta berbahasa Indonesia.');
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
