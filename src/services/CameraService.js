import { createDelay, getCameraErrorMessage } from '../utils/common.js';
import { APP_CONFIG } from '../utils/config.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.devices = [];
    this.selectedCamera = 'environment';
    this.fps = 15;
    this.frameInterval = 1000 / this.fps;
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error('Browser tidak mendukung MediaDevices API.');
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    this.devices = devices.filter((device) => device.kind === 'videoinput');
    return this.devices;
  }

  getConstraints(selectedCamera = this.selectedCamera) {
    if (selectedCamera && selectedCamera !== 'default' && selectedCamera !== 'front' && selectedCamera !== 'environment') {
      return {
        audio: false,
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: this.fps, max: this.fps },
        },
      };
    }

    const facingMode = selectedCamera === 'front' ? 'user' : 'environment';
    this.selectedCamera = facingMode;

    return {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: this.fps, max: this.fps },
      },
    };
  }

  async startCamera(selectedCamera = this.selectedCamera) {
    if (!this.video) {
      throw new Error('Elemen video belum tersedia.');
    }

    this.stopCamera();

    try {
      const constraints = this.getConstraints(selectedCamera);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;

      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Timeout saat menyalakan kamera.')), 6000);

        const resolveWhenReady = async () => {
          try {
            await this.video.play();
            window.clearTimeout(timeout);
            resolve();
          } catch (error) {
            window.clearTimeout(timeout);
            reject(error);
          }
        };

        if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolveWhenReady();
          return;
        }

        this.video.onloadedmetadata = resolveWhenReady;
      });

      await this.waitUntilReady();
      await this.loadCameras();
      return this.stream;
    } catch (error) {
      this.stopCamera();
      throw new Error(getCameraErrorMessage(error));
    }
  }

  async waitUntilReady(maxWaitMs = 5000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWaitMs) {
      if (this.isReady()) {
        await createDelay(APP_CONFIG.cameraWarmupDelay);
        return true;
      }

      await createDelay(100);
    }

    throw new Error('Kamera belum siap mengirim frame video. Coba izinkan kamera lalu mulai ulang scan.');
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeAttribute('src');
      this.video.load?.();
    }
  }

  setFPS(fps) {
    const parsedFps = Number(fps);
    const safeFps = Number.isFinite(parsedFps) ? Math.min(Math.max(parsedFps, 1), 60) : 15;
    this.fps = safeFps;
    this.frameInterval = 1000 / safeFps;
  }

  getFrameInterval() {
    return this.frameInterval;
  }

  hasLiveVideoTrack() {
    return Boolean(
      this.stream
      && this.stream.active
      && this.stream.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled),
    );
  }

  isActive() {
    return this.hasLiveVideoTrack();
  }

  isReady() {
    return Boolean(
      this.hasLiveVideoTrack()
      && this.video
      && this.video.srcObject === this.stream
      && !this.video.paused
      && !this.video.ended
      && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && this.video.videoWidth > 0
      && this.video.videoHeight > 0,
    );
  }
}
