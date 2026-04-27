import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('RootFacts siap digunakan secara offline.');
  },
  onRegisteredSW(swUrl) {
    console.info(`Service Worker terdaftar: ${swUrl}`);
  },
  onRegisterError(error) {
    console.warn('Service Worker gagal terdaftar.', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
