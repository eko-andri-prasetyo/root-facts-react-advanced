# RootFacts - Advanced React PWA

RootFacts adalah aplikasi PWA berbasis React + Vite yang menggabungkan TensorFlow.js untuk deteksi sayuran dan Transformers.js untuk membuat fun fact dinamis.

## Fitur submission

- Deteksi sayuran dari kamera dengan TensorFlow.js.
- Backend adaptif: WebGPU bila tersedia, fallback otomatis ke WebGL/CPU.
- Manajemen memori prediksi memakai `tf.tidy()`.
- FPS limit melalui slider UI.
- Status loading model dengan persentase.
- Fun fact dinamis dari label deteksi menggunakan Transformers.js.
- Parameter generasi: `temperature`, `max_new_tokens`, `top_p`, dan `do_sample`.
- Persona/gaya bahasa dinamis: Normal, Lucu, Sejarah, Profesional, Santai.
- Copy to Clipboard untuk fun fact.
- PWA installable dengan manifest dan service worker Workbox.
- Precaching aset inti dan model deteksi `/model/model.json`, `/model/metadata.json`, `/model/weights.bin`.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka URL yang tampil di terminal, biasanya `http://localhost:3001`.

## Build production

```bash
npm run build
npm run preview
```

## Deploy Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

File `netlify.toml` sudah disiapkan.

## Pengujian sebelum submit

```bash
npm run lint
npm run build
```

Lalu cek di Chrome DevTools:

- Application > Manifest: nama dan ikon muncul.
- Application > Service workers: status activated and running.
- Application > Cache storage: cache Workbox berisi file HTML/CSS/JS dan file model `.json`/`.bin`.
- Matikan internet setelah halaman pernah terbuka: aplikasi tetap bisa dibuka dan model deteksi lokal tetap tersedia dari cache.
