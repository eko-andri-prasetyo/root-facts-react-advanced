import { TONE_CONFIG, ROOT_FACTS_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';

const FACT_MODEL = 'Xenova/flan-t5-small';

const TONE_PROMPTS = {
  normal: 'Write in a friendly and educational tone.',
  funny: 'Write in a playful, funny, and light tone without being rude.',
  history: 'Write like a short historical storyteller and include a cultural angle when possible.',
  professional: 'Write in a concise, professional, and science-informed tone.',
  casual: 'Write in a warm, casual tone as if explaining to a friend.',
};

const FACT_ANGLES = [
  'origin and cultivation',
  'unique plant characteristics',
  'culinary use',
  'color or aroma',
  'storage and freshness',
  'traditional food culture',
];

const FALLBACK_FACTS = {
  Beetroot: 'Beetroot dikenal dengan warna merah-ungu alaminya yang kuat. Warna ini sering membuatnya dipakai sebagai pewarna alami makanan.',
  Paprika: 'Paprika termasuk keluarga cabai, tetapi banyak varietasnya terasa manis. Warna hijau, kuning, oranye, dan merah biasanya dipengaruhi tingkat kematangannya.',
  Cabbage: 'Kubis tersusun dari daun yang saling menutup rapat seperti bola. Sayuran ini populer karena tahan disimpan lebih lama dibanding banyak sayuran daun.',
  Carrot: 'Wortel yang umum berwarna oranye menjadi populer karena kaya pigmen karotenoid. Dahulu, wortel juga banyak ditemukan dalam warna ungu, kuning, dan putih.',
  Cauliflower: 'Kembang kol yang kita makan adalah bagian kepala bunga yang belum mekar. Karena itulah bentuknya seperti kumpulan kuntum kecil yang padat.',
  Chilli: 'Cabai terasa pedas karena senyawa capsaicin. Uniknya, rasa pedas itu bukan rasa dasar, melainkan sensasi panas yang dibaca saraf di mulut.',
  Corn: 'Jagung memiliki barisan biji yang tersusun rapi pada tongkolnya. Dalam banyak budaya, jagung menjadi bahan pokok sekaligus bahan camilan.',
  Cucumber: 'Mentimun mengandung banyak air sehingga terasa segar saat dimakan. Itulah sebabnya mentimun sering hadir dalam lalapan, acar, dan minuman segar.',
  eggplant: 'Terong punya tekstur berpori seperti spons sehingga mudah menyerap bumbu. Karena sifat ini, terong cocok dimasak dengan balado, kari, atau dipanggang.',
  Garlic: 'Bawang putih menghasilkan aroma tajam saat siungnya dihancurkan. Reaksi alami di dalam siungnya membentuk senyawa aroma yang membuat masakan lebih harum.',
  Ginger: 'Jahe adalah rimpang yang terkenal dengan aroma hangat dan pedas lembut. Di Indonesia, jahe sering dipakai untuk minuman tradisional saat cuaca dingin.',
  Lettuce: 'Selada memiliki daun renyah dan rasa ringan. Karena tidak perlu dimasak lama, selada sering dipakai pada salad, burger, dan lalapan modern.',
  Onion: 'Bawang bombai bisa membuat mata berair saat dipotong karena senyawa volatilnya menguap. Memotong dengan pisau tajam dapat membantu mengurangi kerusakan sel bawang.',
  Peas: 'Kacang polong tumbuh dalam polong kecil yang melindungi bijinya. Bentuknya mungil, tetapi sering memberi warna hijau cerah pada sup dan nasi goreng.',
  Potato: 'Kentang adalah umbi batang, bukan akar. Mata kecil pada permukaan kentang dapat tumbuh menjadi tunas baru jika kondisinya lembap dan terang.',
  Turnip: 'Turnip atau lobak putih kecil dimanfaatkan bagian umbi dan daunnya. Rasanya cenderung segar dengan sedikit pedas ketika masih muda.',
  Soybean: 'Kedelai adalah bahan dasar tempe, tahu, dan kecap. Dalam kuliner Nusantara, kedelai menjadi salah satu sumber protein nabati yang sangat penting.',
  Spinach: 'Bayam cepat layu karena daunnya tipis dan banyak mengandung air. Karena itu, bayam biasanya dimasak sebentar agar tekstur dan warnanya tetap baik.',
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = ROOT_FACTS_CONFIG;
    this.currentBackend = 'unknown';
    this.currentTone = TONE_CONFIG.defaultTone;
    this.fallbackMode = false;
  }

  async loadModel(onProgress = () => {}) {
    onProgress({ stage: 'import', progress: 70, message: 'Menyiapkan Transformers.js...' });

    try {
      const { pipeline, env } = await import('@huggingface/transformers');

      env.allowRemoteModels = true;
      env.allowLocalModels = true;
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
      }

      this.currentBackend = isWebGPUSupported() ? 'webgpu' : 'wasm';
      onProgress({
        stage: 'pipeline',
        progress: 75,
        message: `Memuat model fun fact (${this.currentBackend})...`,
      });

      this.generator = await pipeline('text2text-generation', FACT_MODEL, {
        dtype: 'q4',
        device: this.currentBackend,
        progress_callback: (data) => {
          if (typeof data?.progress === 'number') {
            const progress = 75 + Math.round((data.progress / 100) * 20);
            onProgress({
              stage: data.status || 'download',
              progress: Math.min(95, progress),
              message: `Memuat model fun fact... ${Math.min(95, progress)}%`,
            });
          }
        },
      });

      this.isModelLoaded = true;
      this.fallbackMode = false;
      onProgress({ stage: 'ready', progress: 98, message: 'Model fun fact siap...' });
      return { backend: this.currentBackend, fallback: false };
    } catch (error) {
      console.warn('Transformers.js gagal dimuat, memakai fallback fakta dinamis.', error);
      this.fallbackMode = true;
      this.isModelLoaded = true;
      this.currentBackend = 'fallback-dynamic';
      onProgress({
        stage: 'fallback',
        progress: 98,
        message: 'Model fun fact memakai fallback offline...',
      });
      return { backend: this.currentBackend, fallback: true };
    }
  }

  setTone(tone) {
    const allowedTone = TONE_CONFIG.availableTones.some((item) => item.value === tone);
    this.currentTone = allowedTone ? tone : TONE_CONFIG.defaultTone;
  }

  buildPrompt(vegetableName) {
    const angle = FACT_ANGLES[Math.floor(Math.random() * FACT_ANGLES.length)];
    const toneInstruction = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;

    return [
      `Create one unique fun fact in Indonesian about ${vegetableName}.`,
      `Focus on ${angle}.`,
      toneInstruction,
      'Use 2 short sentences, maximum 45 Indonesian words.',
      'Avoid medical claims and do not mention that you are an AI.',
    ].join(' ');
  }

  createFallbackFact(vegetableName) {
    const baseFact = FALLBACK_FACTS[vegetableName] || `${vegetableName} adalah sayuran yang menarik untuk diamati karena bentuk, warna, dan aromanya bisa berbeda tergantung varietas serta cara budidayanya.`;
    const toneSuffix = {
      normal: 'Fakta kecil seperti ini membuat kegiatan mengenal sayuran jadi lebih menyenangkan.',
      funny: 'Jadi, sayuran ini bukan cuma penghuni kulkas, tetapi juga punya cerita keren untuk dibagikan.',
      history: 'Dari kebun sampai dapur, sayuran ini ikut membentuk kebiasaan makan banyak masyarakat.',
      professional: 'Informasi ini dapat membantu pengguna mengenali karakter sayuran secara lebih kontekstual.',
      casual: 'Lumayan seru kan, ternyata sayuran sehari-hari juga punya sisi unik.',
    }[this.currentTone] || '';

    return `${baseFact} ${toneSuffix}`.trim();
  }

  cleanGeneratedText(text, vegetableName) {
    if (!text) {
      return this.createFallbackFact(vegetableName);
    }

    return text
      .replace(/^\s*(Fun fact|Fakta menarik)\s*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async generateFacts(vegetableName) {
    if (!vegetableName) {
      throw new Error('Nama sayuran kosong.');
    }

    if (this.isGenerating) {
      return 'AI sedang menyusun fakta sebelumnya. Coba beberapa detik lagi.';
    }

    this.isGenerating = true;

    try {
      if (!this.generator || this.fallbackMode) {
        return this.createFallbackFact(vegetableName);
      }

      const prompt = this.buildPrompt(vegetableName);
      const result = await this.generator(prompt, {
        max_new_tokens: this.config.maxNewTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        do_sample: this.config.doSample,
        repetition_penalty: 1.08,
      });

      const generatedText = Array.isArray(result)
        ? (result[0]?.generated_text || result[0]?.summary_text || '')
        : (result?.generated_text || result?.summary_text || '');

      return this.cleanGeneratedText(generatedText, vegetableName);
    } catch (error) {
      console.warn('Gagal menghasilkan teks dari Transformers.js.', error);
      return this.createFallbackFact(vegetableName);
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded;
  }

  async dispose() {
    if (typeof this.generator?.dispose === 'function') {
      await this.generator.dispose();
    }
    this.generator = null;
    this.isModelLoaded = false;
  }
}
