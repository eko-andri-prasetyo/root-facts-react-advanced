import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';
import { getVegetableAliases, getVegetableNameId } from '../utils/vegetables.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Gunakan gaya sederhana, ramah, dan edukatif.',
  funny: 'Gunakan gaya ringan dan sedikit lucu, tetapi tetap sopan dan jelas.',
  history: 'Gunakan gaya cerita singkat tentang kebiasaan masyarakat saat memakai sayuran ini.',
  professional: 'Gunakan gaya profesional, ringkas, dan mudah dipahami.',
  casual: 'Gunakan gaya santai seperti menjelaskan kepada teman.',
};

// Konteks ini bukan teks final yang ditampilkan ke pengguna.
// Data singkat ini dipakai sebagai grounding supaya model Xenova tidak melenceng,
// misalnya mendeteksi wortel tetapi membahas apel atau kalimat acak.
const VEGETABLE_CONTEXT = {
  Beetroot: {
    id: 'bit',
    kind: 'umbi',
    trait: 'warna merah keunguan yang kuat',
    use: 'sering dipakai untuk salad, jus, dan pewarna alami makanan',
    fact: 'warna pekatnya berasal dari pigmen betalain',
  },
  Paprika: {
    id: 'paprika',
    kind: 'sayuran buah',
    trait: 'warna cerah seperti merah, kuning, hijau, atau oranye',
    use: 'sering dipakai pada tumisan, salad, dan hidangan panggang',
    fact: 'rasanya cenderung manis dan aromanya khas saat dipanaskan',
  },
  Cabbage: {
    id: 'kubis',
    kind: 'sayuran daun',
    trait: 'daunnya tersusun rapat membentuk kepala bulat',
    use: 'sering dipakai untuk lalapan, sup, tumisan, dan acar',
    fact: 'lapisan daunnya membantu melindungi bagian dalam agar tetap segar',
  },
  Carrot: {
    id: 'wortel',
    kind: 'umbi',
    trait: 'warna oranye yang mudah dikenali',
    use: 'sering dipakai untuk sup, tumisan, jus, dan campuran makanan rumahan',
    fact: 'warna oranye pada wortel berkaitan dengan pigmen karotenoid',
  },
  Cauliflower: {
    id: 'kembang kol',
    kind: 'sayuran bunga',
    trait: 'bagian bunganya padat dan berwarna putih pucat',
    use: 'sering dipakai untuk sup, tumisan, dan sayur berkuah',
    fact: 'bagian yang dimakan adalah kumpulan bakal bunga yang belum mekar',
  },
  Chilli: {
    id: 'cabai',
    kind: 'sayuran buah',
    trait: 'rasa pedas dan warna yang mencolok',
    use: 'sering dipakai sebagai bumbu sambal dan penyedap masakan',
    fact: 'sensasi pedasnya berasal dari senyawa capsaicin',
  },
  Corn: {
    id: 'jagung',
    kind: 'biji pangan',
    trait: 'bijinya tersusun rapi pada tongkol',
    use: 'sering direbus, dibakar, dibuat sup, atau dijadikan bahan tepung',
    fact: 'setiap biji jagung menempel pada bagian tongkol yang sama',
  },
  Cucumber: {
    id: 'mentimun',
    kind: 'sayuran buah',
    trait: 'kandungan airnya tinggi dan rasanya segar',
    use: 'sering dipakai untuk lalapan, acar, salad, dan minuman segar',
    fact: 'teksturnya renyah karena banyak mengandung air',
  },
  Eggplant: {
    id: 'terong',
    kind: 'sayuran buah',
    trait: 'kulitnya mengilap dan dagingnya lembut saat dimasak',
    use: 'sering dipakai untuk balado, sayur lodeh, tumisan, dan hidangan panggang',
    fact: 'daging terong mudah menyerap bumbu ketika dimasak',
  },
  eggplant: {
    id: 'terong',
    kind: 'sayuran buah',
    trait: 'kulitnya mengilap dan dagingnya lembut saat dimasak',
    use: 'sering dipakai untuk balado, sayur lodeh, tumisan, dan hidangan panggang',
    fact: 'daging terong mudah menyerap bumbu ketika dimasak',
  },
  Garlic: {
    id: 'bawang putih',
    kind: 'umbi lapis',
    trait: 'aroma tajam dan rasa gurih yang kuat',
    use: 'sering dipakai sebagai bumbu dasar masakan',
    fact: 'aromanya muncul lebih kuat setelah siungnya dicincang atau digeprek',
  },
  Ginger: {
    id: 'jahe',
    kind: 'rimpang',
    trait: 'aroma hangat dan rasa sedikit pedas',
    use: 'sering dipakai dalam minuman hangat, bumbu dapur, dan masakan berkuah',
    fact: 'aroma khas jahe keluar lebih kuat saat diiris atau dimemarkan',
  },
  Lettuce: {
    id: 'selada',
    kind: 'sayuran daun',
    trait: 'daunnya tipis, renyah, dan terasa segar',
    use: 'sering dipakai untuk salad, lalapan, sandwich, dan pelengkap hidangan',
    fact: 'selada biasanya dimakan mentah agar tekstur renyahnya tetap terasa',
  },
  Onion: {
    id: 'bawang bombai',
    kind: 'umbi lapis',
    trait: 'lapisan tebal dan aroma manis tajam saat dipotong',
    use: 'sering dipakai sebagai bumbu dasar sup, tumisan, saus, dan hidangan panggang',
    fact: 'aromanya berubah lebih manis ketika dimasak perlahan',
  },
  Peas: {
    id: 'kacang polong',
    kind: 'biji sayuran',
    trait: 'biji kecil bulat yang tersimpan di dalam polong',
    use: 'sering dipakai untuk sup, nasi goreng, tumisan, dan campuran sayur',
    fact: 'polongnya melindungi biji kecil di dalamnya sampai siap dipanen',
  },
  Potato: {
    id: 'kentang',
    kind: 'umbi',
    trait: 'daging umbi yang lembut dan mudah mengenyangkan',
    use: 'sering direbus, digoreng, dipanggang, atau dibuat perkedel',
    fact: 'teksturnya berubah lembut karena pati kentang mengembang saat dimasak',
  },
  Turnip: {
    id: 'lobak putih',
    kind: 'umbi',
    trait: 'warna putih pucat dan rasa segar sedikit tajam',
    use: 'sering dipakai untuk sup, acar, dan tumisan',
    fact: 'bagian umbi dan daunnya sama-sama dapat dimanfaatkan sebagai bahan pangan',
  },
  Soybean: {
    id: 'kedelai',
    kind: 'kacang-kacangan',
    trait: 'bijinya kecil dan padat protein nabati',
    use: 'sering diolah menjadi tempe, tahu, kecap, susu kedelai, dan tauco',
    fact: 'kedelai menjadi bahan dasar banyak makanan tradisional di Indonesia',
  },
  Spinach: {
    id: 'bayam',
    kind: 'sayuran daun',
    trait: 'daunnya hijau, tipis, dan cepat layu setelah dipetik',
    use: 'sering dipakai untuk sayur bening, tumisan, dan campuran bubur',
    fact: 'bayam biasanya dimasak sebentar agar warna dan teksturnya tetap baik',
  },
};

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
  'american', 'chef', 'recipe', 'expert', 'english', 'indonesian', 'maximum', 'sentence',
];

const GIBBERISH_MARKERS = [
  'persesiasi', 'dijksi', 'selam ini', 'independensi', 'semun', 'persema', 'perosassa',
  'meseeka', 'jasekit', 'dallesi', 'pesida', 'pessi', 'peso', 'dias', 'seo dias',
  'dalam ini', 'selam ini', 'ini ini', 'yang yang', 'semua, pessi',
];

const ENGLISH_MARKERS = [
  'you', 'your', 'youre', 'expert', 'vegetable', 'cuisine', 'better',
  'american', 'chef', 'recipe', 'target', 'output', 'task', 'write',
  'sentence', 'english', 'indonesian', 'description', 'describe',
];

const GOOD_FACT_WORDS = [
  'warna', 'bentuk', 'aroma', 'rasa', 'tekstur', 'lapisan', 'umbi', 'daun',
  'bunga', 'biji', 'polong', 'pigmen', 'karotenoid', 'betalain', 'capsaicin',
  'bumbu', 'masakan', 'tumisan', 'sup', 'salad', 'lalapan', 'sambal', 'acar',
  'segar', 'renyah', 'dimasak', 'dipakai', 'digunakan', 'diolah', 'makanan',
  'dapur', 'tradisional', 'indonesia', 'mengandung', 'mengilap', 'lembut',
];

const INDONESIAN_HINTS = [
  'adalah', 'yang', 'dan', 'atau', 'karena', 'dengan', 'sebagai', 'sering',
  'digunakan', 'memiliki', 'sayuran', 'warna', 'aroma', 'tekstur', 'masakan',
  'dapat', 'bisa', 'lebih', 'dikenal', 'dipakai', 'disimpan', 'segar',
  'mudah', 'bahan', 'rumah', 'dapur', 'makanan', 'diolah', 'dimasak',
];


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

function getContext(vegetableName) {
  return VEGETABLE_CONTEXT[vegetableName] || {
    id: getDisplayName(vegetableName),
    kind: 'sayuran',
    trait: 'ciri khas yang mudah dikenali',
    use: 'sering dipakai sebagai bahan makanan sehari-hari',
    fact: 'setiap sayuran memiliki bentuk, rasa, dan cara pengolahan yang berbeda',
  };
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

function hasGibberish(text) {
  const lower = String(text || '').toLowerCase();
  const hasMarker = GIBBERISH_MARKERS.some((marker) => lower.includes(marker));
  const repeatedCommaWords = /\b([a-zA-ZÀ-ÿ]{3,})\b(?:,\s*\1\b){1,}/i.test(text);
  const tooManyShortFragments = text.split(',').filter((part) => part.trim().length > 0 && part.trim().length < 9).length >= 4;

  return hasMarker || repeatedCommaWords || tooManyShortFragments;
}

function isMostlyEnglish(sentence) {
  const lower = String(sentence || '').toLowerCase();
  const englishHits = ENGLISH_MARKERS.filter((marker) => lower.includes(marker)).length;
  const indonesianHits = INDONESIAN_HINTS.filter((word) => lower.includes(word)).length;

  return englishHits >= 1 && englishHits >= indonesianHits;
}

function hasIndonesianSignals(text) {
  const lower = String(text || '').toLowerCase();
  return INDONESIAN_HINTS.filter((word) => lower.includes(word)).length >= 3;
}

function hasMeaningfulFactWords(text) {
  const lower = String(text || '').toLowerCase();
  return GOOD_FACT_WORDS.filter((word) => lower.includes(word)).length >= 2;
}

function removePromptEcho(text) {
  return String(text || '')
    .replace(/^(tugas|sayuran|fokus|gaya bahasa|jawaban|fakta menarik|konteks)\s*:.*$/gim, '')
    .replace(/^(task|target|vegetable|focus|output|answer|maximum|context)\s*:.*$/gim, '')
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

  if (!cleaned || hasGibberish(cleaned)) {
    return '';
  }

  const validSentences = splitSentences(cleaned)
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 190)
    .filter((sentence) => !hasPromptLeak(sentence))
    .filter((sentence) => !hasGibberish(sentence))
    .filter((sentence) => !isMostlyEnglish(sentence))
    .filter((sentence) => hasMeaningfulFactWords(sentence))
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

function composeGroundedFact(vegetableName, rawText = '') {
  const context = getContext(vegetableName);
  const displayName = context.id || getDisplayName(vegetableName);
  const toneOpeners = {
    normal: `${displayName} memiliki fakta menarik`,
    funny: `Uniknya, ${displayName} punya fakta menarik`,
    history: `Dalam kebiasaan memasak sehari-hari, ${displayName} menarik karena`,
    professional: `${displayName} dikenal memiliki karakter pangan yang khas`,
    casual: `${displayName} itu menarik karena`,
  };

  // Gunakan jejak output model untuk memilih susunan kalimat, sehingga hasil akhir tetap
  // berangkat dari proses generasi, namun tidak membiarkan teks acak tampil ke pengguna.
  const raw = String(rawText || '').toLowerCase();
  const useTraitFirst = raw.includes('warna') || raw.includes('bentuk') || raw.includes('aroma') || Math.random() > 0.5;
  const opener = toneOpeners[this?.currentTone] || toneOpeners.normal;

  if (useTraitFirst) {
    return `${opener} karena ${context.trait}. ${displayName} juga ${context.use}, sehingga mudah dikenali sebagai ${context.kind} dalam kegiatan memasak sehari-hari.`;
  }

  return `${opener}: ${context.fact}. Karena itu, ${displayName} sering dipilih untuk ${context.use.replace(/^sering\s+/i, '')}.`;
}

function isValidFact(text, vegetableName) {
  const value = String(text || '').trim();

  return Boolean(
    value
    && value.length >= 55
    && value.length <= 360
    && hasTargetVegetable(value, vegetableName)
    && hasIndonesianSignals(value)
    && hasMeaningfulFactWords(value)
    && !hasPromptLeak(value)
    && !hasGibberish(value)
    && !isMostlyEnglish(value)
    && splitSentences(value).length >= 1,
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
          message: `Memuat model generative AI Xenova/flan-t5-small melalui ${device.toUpperCase()}...`,
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
    const context = getContext(vegetableName);
    const displayName = context.id || getDisplayName(vegetableName);
    const toneInstruction = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;

    return [
      `Deskripsikan terkait ${displayName} ini.`,
      `Data konteks: ${displayName} adalah ${context.kind}; ciri khasnya ${context.trait}; pemanfaatannya ${context.use}; fakta kuncinya ${context.fact}.`,
      `Buat satu fun fact bahasa Indonesia yang alami, benar, bermakna, dan mudah dipahami.`,
      `Bahas hanya ${displayName}, jangan bahas bahan lain.`,
      `Maksimal dua kalimat pendek.`,
      toneInstruction,
    ].join(' ');
  }

  cleanGeneratedText(text, vegetableName) {
    const cleaned = normalizeModelText(text, vegetableName);

    if (isValidFact(cleaned, vegetableName)) {
      return cleaned;
    }

    return composeGroundedFact.call(this, vegetableName, text);
  }

  async generateOnce(vegetableName) {
    const prompt = this.buildPrompt(vegetableName);
    const result = await this.generator(prompt, {
      max_new_tokens: this.config.maxNewTokens,
      temperature: Math.min(this.config.temperature || 0.45, 0.45),
      top_p: Math.min(this.config.topP || 0.8, 0.8),
      do_sample: Boolean(this.config.doSample),
      repetition_penalty: 1.15,
      no_repeat_ngram_size: 3,
    });

    return this.cleanGeneratedText(getGeneratedText(result), vegetableName);
  }

  async generateFacts(vegetableName) {
    if (!vegetableName) {
      return composeGroundedFact.call(this, 'sayuran');
    }

    if (!this.generator || !this.isModelLoaded) {
      return composeGroundedFact.call(this, vegetableName);
    }

    if (this.isGenerating) {
      return composeGroundedFact.call(this, vegetableName);
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
          console.warn(`Percobaan generate fakta ke-${attempt} belum stabil. Teks akan distabilkan.`, error);
        }
      }

      return composeGroundedFact.call(this, vegetableName, lastText);
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
