import { Sparkles, Search, CheckCircle, Lightbulb, Copy, Share2, Gauge } from 'lucide-react';

function InfoPanel({ appState, detectionResult, funFactData, error, onCopyFact, copyStatus }) {
  const isIdle = appState === 'idle';
  const isAnalyzing = appState === 'analyzing';
  const isResult = appState === 'result';

  const renderIdleState = () => (
    <div id="state-idle" className="result-card idle-card fadeIn">
      <div className="idle-icon">
        <Sparkles size={40} />
      </div>
      <h2>Scan Sayuran</h2>
      <p>Ketuk tombol scan, arahkan kamera ke satu sayuran, lalu dapatkan fakta menarik otomatis.</p>
      {error && <p className="inline-error">{error}</p>}
    </div>
  );

  const renderAnalyzingState = () => (
    <div id="state-loading" className="result-card loading-card fadeIn">
      <div className="loading-animation">
        <div className="loading-ring"></div>
        <div className="loading-icon">
          <Search size={24} />
        </div>
      </div>
      <h2>Mencari...</h2>
      <p>Sedang mengidentifikasi sayuran Anda. Pastikan objek terang dan memenuhi kotak scan.</p>
      {detectionResult && (
        <div className="live-prediction">
          <Gauge size={14} />
          <span>{detectionResult.className}</span>
          <strong>{Math.round(detectionResult.score * 100)}%</strong>
        </div>
      )}
    </div>
  );

  const renderFunFactContent = () => {
    if (funFactData === null) {
      return (
        <div id="fun-fact-loading" className="fun-fact-loading">
          <div className="fun-fact-loading-spinner"></div>
          <span>Memuat fakta menarik dari Si Otak...</span>
        </div>
      );
    }

    if (funFactData === 'error') {
      return (
        <div className="warning-box">
          Gagal menghasilkan fakta menarik. Coba scan ulang saat koneksi dan model AI tersedia.
        </div>
      );
    }

    return funFactData;
  };

  const renderResultState = () => {
    if (!detectionResult) return null;

    const confidence = Math.round(detectionResult.score * 100);

    return (
      <div id="state-result" className="result-card result-main fadeIn">
        <div className="detected-badge">
          <CheckCircle size={14} />
          <span id="detected-name">{detectionResult.className}</span>
        </div>

        <div className="fun-fact-card">
          <div className="fun-fact-icon">
            <Lightbulb size={28} />
          </div>
          <div id="fun-fact-content">
            <div id="fun-fact-text" className="fun-fact-text">
              {renderFunFactContent()}
            </div>
            {funFactData && funFactData !== 'error' && (
              <button
                id="btn-copy"
                type="button"
                className={`copy-btn ${copyStatus === 'copied' ? 'copied' : ''}`}
                onClick={onCopyFact}
                title="Salin fakta"
                aria-label="Salin fakta ke papan klip"
              >
                <Copy size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="confidence-bar">
          <span className="confidence-label">Kepercayaan</span>
          <div className="confidence-track">
            <div
              id="confidence-fill"
              className="confidence-fill"
              style={{ width: `${confidence}%` }}
            ></div>
          </div>
          <span id="detected-confidence" className="confidence-value">{confidence}%</span>
        </div>

        <div className="share-hint">
          <Share2 size={14} />
          <span>{copyStatus === 'copied' ? 'Fakta berhasil disalin!' : 'Salin dan bagikan ke teman!'}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="results-section" aria-live="polite">
      {isIdle && renderIdleState()}
      {isAnalyzing && renderAnalyzingState()}
      {isResult && renderResultState()}
    </section>
  );
}

export default InfoPanel;
