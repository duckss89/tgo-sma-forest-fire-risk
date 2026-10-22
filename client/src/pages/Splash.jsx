import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { riskColor } from '../lib/risk.js';

const CELLS = Array.from({ length: 108 }, (_, i) => {
  const x = i % 12;
  const y = Math.floor(i / 12);
  const v = (Math.sin(x * 0.7) + Math.cos(y * 0.6) + 2) / 4;
  return Math.min(5, Math.max(1, Math.round(v * 4) + 1));
});

export default function Splash() {
  const navigate = useNavigate();
  return (
    <>
      <TopNav />
      <div className="splash">
        <div className="splash__bg" />
        <div className="splash__inner">
          <div>
            <p className="splash__kicker">Nghiên cứu khoa học · Metaheuristic lai ghép</p>
            <h1 className="splash__title">
              Ứng dụng thuật toán lai ghép TGO&#8209;SMA tối ưu hóa trọng số đánh giá nguy cơ
              cháy rừng tỉnh Lâm Đồng
            </h1>
            <p className="splash__subtitle">
              Xử lý dữ liệu vệ tinh &amp; khí tượng, tối ưu trọng số bằng TGO&#8209;SMA, và
              dựng bản đồ chỉ số nguy cơ cháy (FRI) — thao tác hoàn toàn bằng nhấp chuột.
            </p>
            <dl className="splash__meta">
              <div><dt>Thuật toán lõi</dt><dd>TGO&#8209;SMA Hybrid</dd></div>
              <div><dt>Vùng nghiên cứu</dt><dd>Tỉnh Lâm Đồng</dd></div>
              <div><dt>Dữ liệu kiểm chứng</dt><dd>NASA FIRMS 2023–2025</dd></div>
            </dl>
            <div className="splash__cta">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/upload')}>
                Bắt đầu sử dụng →
              </button>
              <button type="button" className="btn btn-ghost" style={{ color: '#c9d6ec', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => navigate('/about')}>
                Tìm hiểu phương pháp
              </button>
            </div>
          </div>
          <div className="risk-card">
            <div className="risk-card__grid">
              {CELLS.map((lvl, i) => (
                <i key={i} style={{ background: riskColor(lvl), display: 'block' }} />
              ))}
            </div>
            <p className="risk-card__cap">
              <b style={{ color: '#eaf0fc' }}>Bản đồ FRI</b> — mỗi ô lưới được phân 5 mức nguy cơ,
              từ rất thấp (xanh) đến rất cao (đỏ).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
