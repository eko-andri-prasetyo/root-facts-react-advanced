import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';
import { getVegetableAliases, getVegetableNameId } from '../utils/vegetables.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Gunakan gaya bahasa sederhana, ramah, dan edukatif.',
  funny: 'Gunakan gaya ringan dan sedikit lucu, tetapi tetap jelas.',
  history: 'Gunakan gaya cerita singkat tentang kebiasaan masyarakat atau asal pemanfaatannya.',
  professional: 'Gunakan gaya profesional, ringkas, dan mudah dipahami.',
  casual: 'Gunakan gaya santai seperti menjelaskan kepada teman.',
};

const FACT_ANGLES = [
  'ciri khas warna, bentuk, aroma, atau tekstur',
  'cara sayuran ini digunakan dalam masakan sehari-hari',
  'cara memilih dan menjaga kesegarannya',
  'alasan sayuran ini mudah dikenali di pasar atau dapur',
  'kebiasaan masyarakat saat mengolah sayuran ini',
];

const SAFE_DETAILS = [
  'ciri warna, bentuk, aroma, atau teksturnya membantu orang mengenalinya saat memilih bahan masakan',
  'rasanya mudah dipadukan dengan berbagai bumbu sehingga sering dipakai dalam masakan rumahan',
  'kesegarannya lebih mudah dijaga bila disimpan di tempat yang bersih dan sesuai kebutuhan',
  'bentuk dan teksturnya membuatnya mudah dikenali ketika berada bersama sayuran lain',
  'cara pengolahannya bisa berbeda di tiap daerah, sehingga sayuran ini sering muncul dalam banyak menu keluarga',
];

const PRODUCE_TERMS = [
  'apple', 'apel', 'banana', 'pisang', 'orange', 'jeruk', 'grape', 'anggur',
  'mango', 'mangga', 'tomato', 'tomat', 'broccoli', 'brokoli', 'celery', 'seledri',
  'cabbage', 'kubis', 'carrot', 'wortel', 'onion', 'bawang bombai', 'bawang bombay',
  'potato', 'kentang', 'corn', 'jagung', 'spinach', 'bayam', 'cucumber', 'mentimun',
  'eggplant', 'terong', 'garlic', 'bawang putih', 'ginger', 'jahe', 'lettuce', 'selada',
  'peas', 'kacang polong', 'soybean', 'kedelai', 'turnip', 'lobak', 'chilli', 'chili',
  'cabai', 'paprika', 'beetroot', 'bit', 'cauliflower', 'kembang kol',
];

const PROMPT_OR_SYSTEM_MARKERS = [
  'jangan', 'deskripsikan', 'tuliskan', 'tulis ', 'buat ', 'gunakan gaya',
  'kalimat', 'bahasa indonesia', 'bahasa inggris', 'instruksi', 'prompt',
  'output', 'task', 'target', 'seo', 'model ai', 'terdeteksi', 'deteksi', 'scan', 'you are', 'you\'re',
  'american', 'chef', 'recipe', 'expert', 'english', 'indonesian',
];

const ENGLISH_MARKERS = [
  'you', 'your', 'youre', 'expert', 'vegetable', 'cuisine', 'better',
  'american', 'chef', 'recipe', 'target', 'output', 'task', 'write',
  'sentence', 'english', 'indonesian', 'description', 'describe',
];

const INDONESIAN_HINTS = [
  'adalah', 'yang', 'dan', 'atau', 'karena', 'dengan', 'sebagai', 'sering',
  'digunakan', 'memiliki', 'sayuran', 'warna', 'aroma', 'tekstur', 'masakan',
  'dapat', 'bisa', 'lebih', 'dikenal', 'dipakai', 'disimpan', 'segar',
  'mudah', 'bahan', 'rumah', 'dapur',
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

function getDisplayName(vegetableName) {
  return getVegetableNameId(vegetableName);
}

function getAliases(vegetableName) {
  return getVegetableAliases(vegetableName).map((alias) => alias.toLowerCase());
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasTargetVegetable(text, vegetableName) {
  const lowerText = String(text || '').toLowerCase();
  return getAliases(vegetableName).some((alias) => lowerText.includes(alias));
}

function hasPromptLeak(text) {
  const lower = String(text || '').toLowerCase();
  return PROMPT_OR_SYSTEM_MARKERS.some((marker) => lower.includes(marker));
}

function isMostlyEnglish(sentence) {
  const lower = String(sentence || '').toLowerCase();
  const englishHits = ENGLISH_MARKERS.filter((marker) => lower.includes(marker)).length;
  const indonesianHits = INDONESIAN_HINTS.filter((word) => lower.includes(word)).length;

  return englishHits >= 1 && englishHits >= indonesianHits;
}

function hasIndonesianSignals(text) {
  const lower = String(text || '').toLowerCase();
  return INDONESIAN_HINTS.filter((word) => lower.includes(word)).length >= 2;
}

function removePromptEcho(text) {
  return String(text || '')
    .replace(/^(tugas|sayuran|fokus|gaya bahasa|jawaban|fakta menarik)\s*:.*$/gim, '')
    .replace(/^(task|target|vegetable|focus|output|answer|maximum)\s*:.*$/gim, '')
    .replace(/^\s*(fakta menarik|jawaban|answer)\s*:?\s*/i, '')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceOtherProduceNames(text, vegetableName) {
  const displayName = getDisplayName(vegetableName);
  const aliases = new Set(getAliases(vegetableName));
  let cleaned = text;

  PRODUCE_TERMS.forEach((term) => {
    const lowerTerm = term.toLowerCase();

    if (!aliases.has(lowerTerm)) {
      const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
      cleaned = cleaned.replace(pattern, displayName);
    }
  });

  return cleaned;
}

function normalizeModelText(text, vegetableName) {
  const displayName = getDisplayName(vegetableName);
  let cleaned = removePromptEcho(text);

  cleaned = replaceOtherProduceNames(cleaned, vegetableName)
    .replace(/\b(?:you(?:'re| are)?|your|expert|american|chef|recipe|vegetable cuisine)\b[^.!?]*[.!?]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const validSentences = splitSentences(cleaned)
    .filter((sentence) => sentence.length >= 18)
    .filter((sentence) => !hasPromptLeak(sentence))
    .filter((sentence) => !isMostlyEnglish(sentence))
    .map((sentence) => sentence.replace(/[.!?]*$/, '.'))
    .slice(0, 2);

  if (validSentences.length === 0) {
    return '';
  }

  cleaned = validSentences.join(' ').trim();

  if (!hasTargetVegetable(cleaned, vegetableName)) {
    cleaned = `${displayName} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }

  return cleaned;
}

function composeSafeFact(vegetableName, rawText = '') {
  const displayName = getDisplayName(vegetableName);
  const normalizedRaw = removePromptEcho(rawText).toLowerCase();
  const detail = SAFE_DETAILS.find((item) => {
    const firstKeyword = item.split(' ')[0];
    return normalizedRaw.includes(firstKeyword);
  }) || pickRandom(SAFE_DETAILS);

  return `${displayName} memiliki fakta menarik karena ${detail}. Keunikan ini membuat ${displayName} mudah dikenali dan bermanfaat sebagai bahan pangan sehari-hari.`;
}

function isValidFact(text, vegetableName) {
  return Boolean(
    text
    && hasTargetVegetable(text, vegetableName)
    && hasIndonesianSignals(text)
    && !hasPromptLeak(text)
    && !isMostlyEnglish(text)
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

  buildPrompt(vegetableName) {
    const displayName = getDisplayName(vegetableName);
    const angle = pickRandom(FACT_ANGLES);
    const toneInstruction = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;

    return `Deskripsikan terkait ${displayName} ini dalam bahasa Indonesia. Berikan satu fakta menarik yang alami, singkat, dan hanya membahas ${displayName}. Fokus pada ${angle}. ${toneInstruction}`;
  }

  cleanGeneratedText(text, vegetableName) {
    const cleaned = normalizeModelText(text, vegetableName);

    if (isValidFact(cleaned, vegetableName)) {
      return cleaned;
    }

    return composeSafeFact(vegetableName, text);
  }

  async generateOnce(vegetableName) {
    const prompt = this.buildPrompt(vegetableName);
    const result = await this.generator(prompt, {
      max_new_tokens: this.config.maxNewTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      do_sample: this.config.doSample,
      repetition_penalty: 1.05,
      no_repeat_ngram_size: 3,
    });

    return this.cleanGeneratedText(getGeneratedText(result), vegetableName);
  }

  async generateFacts(vegetableName) {
    if (!vegetableName) {
      return composeSafeFact('sayuran');
    }

    if (!this.generator || !this.isModelLoaded) {
      return composeSafeFact(vegetableName);
    }

    if (this.isGenerating) {
      return composeSafeFact(vegetableName);
    }

    this.isGenerating = true;

    try {
      let lastText = '';

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const generatedText = await this.generateOnce(vegetableName);
          lastText = generatedText;

          if (isValidFact(generatedText, vegetableName)) {
            return generatedText;
          }
        } catch (error) {
          console.warn(`Percobaan generate fakta ke-${attempt} belum stabil. Menggunakan teks aman.`, error);
        }
      }

      return composeSafeFact(vegetableName, lastText);
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
