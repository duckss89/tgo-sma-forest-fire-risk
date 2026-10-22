import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper.jsx';
import RiskMap from '../components/RiskMap.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../state/AppContext.jsx';

function DropCsv({ label, accept, onFile, state }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const handle = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onFile(file.name, reader.result);
    reader.readAsText(file);
  };
  return (
    <div
      className={`dropzone ${drag ? 'is-drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
    >
      <p style={{ fontSize: 14.5, color: 'var(--ink-700)' }}>
        {label}<br />
        <b style={{ color: 'var(--blue-accent)', cursor: 'pointer' }} onClick={() => inputRef.current?.click()}>
          chọn tệp {accept}
        </b>
      </p>
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => handle(e.target.files[0])} />
      {state?.ok && <p className="banner info" style={{ marginTop: 12 }}>{state.msg}</p>}
      {state?.error && <p className="banner warn" style={{ marginTop: 12 }}>{state.error}</p>}
    </div>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const { uploads, refreshUploads } = useApp();
  const [boundary, setBoundary] = useState(null);
  const [firesState, setFiresState] = useState(null);
  const [meteoState, setMeteoState] = useState(null);

  useEffect(() => {
    api.boundary().then(setBoundary).catch(() => {});
  }, []);

  const onFires = async (name, text) => {
    try {
      const r = await api.uploadFires(text);
      setFiresState({ ok: true, msg: `${name}: đã nạp ${r.count} điểm cháy.` });
      refreshUploads();
    } catch (err) {
      setFiresState({ error: String(err.message) });
    }
  };
  const onMeteo = async (name, text) => {
    try {
      const r = await api.uploadMeteo(text);
      setMeteoState({ ok: true, msg: `${name}: ${r.rows} dòng, cột ${r.columns.join(', ')}.` });
      refreshUploads();
    } catch (err) {
      setMeteoState({ error: String(err.message) });
    }
  };

  return (
    <>
      <Stepper current={1} />
      <div className="wrap">
        <div className="step-header">
          <p className="step-header__eyebrow">Bước 1</p>
          <h2 className="step-header__title">Nhập dữ liệu đầu vào</h2>
          <p className="step-header__desc">
            Hệ thống đã tích hợp sẵn bộ dữ liệu huấn luyện của đề tài. Bạn có thể chạy ngay,
            hoặc nạp thêm dữ liệu điểm cháy / khí tượng của riêng bạn.
          </p>
        </div>

        <div className="grid-2" style={{ padding: '20px 0' }}>
          <div className="stack">
            <div className="card">
              <div className="card__head"><div className="card__title">Dữ liệu tích hợp sẵn</div></div>
              <div className="card__body stack" style={{ gap: 10 }}>
                <div className="file-state">
                  <div>
                    <div className="file-state__name">training_data_ffrm.csv</div>
                    <div className="file-state__meta">11.604 điểm mẫu · 8 đặc trưng · nhãn cháy/không cháy (2023–2025)</div>
                  </div>
                </div>
                <div className="file-state">
                  <div>
                    <div className="file-state__name">firms_lamdong_2023_2025.csv</div>
                    <div className="file-state__meta">Điểm cháy NASA FIRMS dùng để kiểm chứng</div>
                  </div>
                </div>
                <div className="file-state">
                  <div>
                    <div className="file-state__name">lamdong_boundary.geojson</div>
                    <div className="file-state__meta">Ranh giới hành chính tỉnh Lâm Đồng</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <div className="card__title">Nạp thêm (tùy chọn)</div>
                  <div className="card__hint">CSV điểm cháy kiểu FIRMS hoặc CSV khí tượng kiểu NASA POWER</div>
                </div>
              </div>
              <div className="card__body stack">
                <DropCsv
                  label="Kéo thả CSV điểm cháy (latitude, longitude, acq_date)"
                  accept=".csv"
                  onFile={onFires}
                  state={firesState || (uploads.fires ? { ok: true, msg: `Đang dùng ${uploads.fires.count} điểm cháy đã nạp` } : null)}
                />
                <DropCsv
                  label="Kéo thả CSV khí tượng (T2M, RH2M, WS2M, PRECTOTCORR)"
                  accept=".csv"
                  onFile={onMeteo}
                  state={meteoState || (uploads.meteo ? { ok: true, msg: `${uploads.meteo.rows} dòng khí tượng đã nạp` } : null)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head"><div className="card__title">Vùng nghiên cứu — tỉnh Lâm Đồng</div></div>
            <div className="card__body">
              <div className="map-stage" style={{ height: 460 }}>
                <RiskMap
                  boundary={boundary}
                  friRaster={null}
                  fires={[]}
                  layers={{ base: true, risk: false, fire: false }}
                />
              </div>
              <p className="card__hint" style={{ marginTop: 10 }}>
                Bản đồ nguy cơ cháy (FRI) sẽ được dựng ở bước Kết quả, sau khi chạy TGO&#8209;SMA.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0 60px' }}>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/config')}>
            Tiếp tục → Cấu hình &amp; chạy
          </button>
        </div>
      </div>
    </>
  );
}
