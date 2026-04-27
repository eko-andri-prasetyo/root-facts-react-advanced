import { getCameraErrorMessage } from '../utils/common.js';

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

      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(reject);
        };
      });

      await this.loadCameras();
      return this.stream;
    } catch (error) {
      this.stopCamera();
      throw new Error(getCameraErrorMessage(error));
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
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

  isActive() {
    return Boolean(this.stream && this.stream.active);
  }

  isReady() {
    return Boolean(
      this.video
      && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && this.video.videoWidth > 0
      && this.video.videoHeight > 0,
    );
  }
}
