import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';
import { getVegetableAliases, getVegetableNameId } from '../utils/vegetables.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Gunakan gaya penjelasan yang ramah dan edukatif.',
  funny: 'Gunakan gaya ringan dan sedikit lucu, tetapi tetap informatif.',
  history: 'Gunakan gaya bercerita singkat seperti kisah asal-usul makanan.',
  professional: 'Gunakan gaya profesional, ringkas, dan jelas.',
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
  'peas', 'kacang polong', 'soybean', 'kedelai', 'turnip', 'lobak', 'chilli', 'chili',
  'cabai', 'paprika', 'beetroot', 'bit', 'cauliflower', 'kembang kol',
];

const ENGLISH_MARKERS = [
  'you', 'your', "you're", 'youre', 'expert', 'vegetable cuisine', 'better',
  'american', 'chef', 'recipe', 'target', 'output', 'task', 'write', 'sentence',
  'english', 'indonesian', 'description', 'describe', 'food', 'plant', 'fact',
];

const PROMPT_LEAK_MARKERS = [
  'jangan', 'deskripsikan', 'tuliskan', 'tulis ', 'buat ', 'gunakan gaya',
  'kalimat pertama', 'dua kalimat', 'bahasa indonesia', 'bahasa inggris',
  'klaim medis', 'instruksi', 'prompt', 'output', 'task', 'target', 'seo',
];

const INDONESIAN_HINTS = [
  'adalah', 'yang', 'dan', 'atau', 'karena', 'dengan', 'sebagai', 'sering',
  'digunakan', 'memiliki', 'sayuran', 'warna', 'aroma', 'tekstur', 'masakan',
  'dapat', 'bisa', 'lebih', 'dikenal', 'dipakai', 'disimpan', 'segar',
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

function containsPromptLeak(text) {
  const lower = String(text || '').toLowerCase();
  return PROMPT_LEAK_MARKERS.some((marker) => lower.includes(marker));
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
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isEnglishSentence(sentence) {
  const lower = sentence.toLowerCase();
  const markerHits = ENGLISH_MARKERS.filter((marker) => lower.includes(marker)).length;
  const indonesianHits = INDONESIAN_HINTS.filter((word) => lower.includes(word)).length;

  return markerHits >= 1 && markerHits >= indonesianHits;
}

function hasEnoughIndonesianSignals(text) {
  const lower = String(text || '').toLowerCase();
  const hits = INDONESIAN_HINTS.filter((marker) => lower.includes(marker)).length;
  const hasEnglish = ENGLISH_MARKERS.some((marker) => lower.includes(marker));

  return hits >= 2 && !hasEnglish;
}

function removePromptEcho(text) {
  return String(text || '')
    .replace(/^(Tugas|Sayuran yang terdeteksi|Deskripsikan|Fokus|Gaya bahasa|Jawaban|Fakta menarik)\s*:.*$/gim, '')
    .replace(/^(Task|Target vegetable label|Indonesian vegetable name|Vegetable|Focus|Output language|Output format|Maximum length)\s*:.*$/gim, '')
    .replace(/^\s*(Fun fact|Fakta menarik|Answer|Jawaban)\s*:?\s*/i, '')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeInvalidSentences(text) {
  return splitSentences(text)
    .filter((sentence) => !isEnglishSentence(sentence))
    .filter((sentence) => !containsPromptLeak(sentence))
    .join(' ')
    .replace(/\b(?:You(?:'re| are)?|your|expert|American|chef|recipe|vegetable cuisine)\b[^.!?]*[.!?]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIndonesianText(text, vegetableName) {
  const displayName = getDisplayName(vegetableName);
  let cleaned = removePromptEcho(text);
  cleaned = replaceWrongProduceTerms(cleaned, vegetableName);
  cleaned = removeInvalidSentences(cleaned);

  if (!cleaned) {
    return '';
  }

  cleaned = cleaned
    .replace(/\b(onion|carrot|cabbage|cauliflower|chilli|chili|corn|cucumber|eggplant|garlic|ginger|lettuce|peas|potato|turnip|soybean|spinach|beetroot)\b/gi, displayName)
    .replace(/\s+/g, ' ')
    .trim();

  if (!containsTargetVegetable(cleaned, vegetableName)) {
    cleaned = `${displayName} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }

  const sentences = splitSentences(cleaned)
    .filter((sentence) => sentence.length >= 24)
    .slice(0, 2)
    .map((sentence) => sentence.replace(/[.!?]*$/, '.'));

  return sentences.join(' ').trim();
}

function buildModelAssistedSentence(vegetableName, angle, rawText) {
  const displayName = getDisplayName(vegetableName);
  const cleaned = removeInvalidSentences(removePromptEcho(rawText));
  const lower = cleaned.toLowerCase();

  let detail = 'ciri, rasa, dan teksturnya dapat berbeda tergantung cara tanam serta cara pengolahannya';

  if (lower.includes('warna') || angle.includes('warna')) {
    detail = 'warna dan teksturnya membantu orang mengenalinya saat dipilih untuk bahan masakan';
  } else if (lower.includes('masak') || angle.includes('masakan')) {
    detail = 'rasanya mudah dipadukan dengan berbagai bumbu sehingga sering muncul dalam masakan rumahan';
  } else if (lower.includes('simpan') || angle.includes('penyimpanan')) {
    detail = 'kesegarannya lebih mudah dijaga bila disimpan di tempat yang bersih, kering, dan sesuai kebutuhan';
  } else if (lower.includes('budidaya') || angle.includes('budidaya')) {
    detail = 'proses budidayanya membuat sayuran ini akrab ditemui dari kebun kecil sampai pasar harian';
  }

  return `${displayName} memiliki fakta menarik karena ${detail}. Keunikan ini membuat ${displayName} mudah dikenali dan bermanfaat sebagai bahan pangan sehari-hari.`;
}

function isValidFact(text, vegetableName) {
  return Boolean(
    text
    && containsTargetVegetable(text, vegetableName)
    && hasEnoughIndonesianSignals(text)
    && !containsPromptLeak(text)
    && !isEnglishSentence(text)
    && splitSentences(text).length >= 1,
  );
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

    const promptVariants = [
      `Deskripsikan terkait ${displayName} ini. Buat fakta menarik dalam dua kalimat pendek berbahasa Indonesia. ${toneInstruction}`,
      `Ceritakan fakta unik tentang ${displayName}. Jawab singkat dalam bahasa Indonesia dan fokus pada ${angle}.`,
      `${displayName} adalah sayuran. Jelaskan satu fakta menarik tentang ${displayName} dalam bahasa Indonesia yang alami.`,
    ];

    return promptVariants[Math.min(attempt - 1, promptVariants.length - 1)];
  }

  cleanGeneratedText(text, vegetableName, angle = pickRandom(FACT_ANGLES)) {
    const displayName = getDisplayName(vegetableName);
    const normalized = normalizeIndonesianText(text, vegetableName);

    if (isValidFact(normalized, vegetableName)) {
      return normalized;
    }

    const repaired = buildModelAssistedSentence(vegetableName, angle, text);
    if (isValidFact(repaired, vegetableName)) {
      return repaired;
    }

    throw new Error(`Model generative AI belum menghasilkan fakta valid untuk ${displayName}.`);
  }

  async generateOnce(vegetableName, attempt = 1) {
    const prompt = this.buildPrompt(vegetableName, attempt);
    const angle = pickRandom(FACT_ANGLES);
    const result = await this.generator(prompt, {
      max_new_tokens: this.config.maxNewTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      do_sample: this.config.doSample,
      repetition_penalty: 1.12,
      no_repeat_ngram_size: 3,
    });

    return this.cleanGeneratedText(getGeneratedText(result), vegetableName, angle);
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
