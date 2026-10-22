import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="wrap">
      <div className="about-hero">
        <p className="step-header__eyebrow">Về hệ thống</p>
        <h2 className="about-hero__title">
          Ứng dụng thuật toán lai ghép TGO&#8209;SMA tối ưu hóa trọng số đánh giá nguy cơ
          cháy rừng tỉnh Lâm Đồng
        </h2>
        <p className="about-hero__lede">
          Hệ thống đóng gói quy trình đã kiểm chứng trong đề tài — xử lý ảnh vệ tinh, tối ưu
          trọng số bằng TGO&#8209;SMA và tính bản đồ nguy cơ cháy — thành công cụ web thao tác
          bằng nhấp chuột. Lõi tối ưu hóa (TGO&#8209;SMA Hybrid) chạy trực tiếp trên máy chủ
          Node.js mỗi khi bạn nhấn &laquo;Chạy&raquo;.
        </p>
      </div>

      <div className="about-section">
        <h3>Quy trình xử lý</h3>
        <div className="pipeline">
          <div className="pipeline__step">
            <div className="pipeline__num">01</div>
            <div className="pipeline__title">Dữ liệu đầu vào</div>
            <div className="pipeline__desc">
              11.604 điểm mẫu (cháy / không cháy) kèm 8 đặc trưng, trích từ ảnh Landsat 8/9 và
              dữ liệu khí tượng NASA POWER, đối chiếu điểm cháy NASA FIRMS.
            </div>
          </div>
          <span className="muted">→</span>
          <div className="pipeline__step">
            <div className="pipeline__num">02</div>
            <div className="pipeline__title">Tối ưu hóa TGO&#8209;SMA</div>
            <div className="pipeline__desc">
              Pha TGO dò rộng không gian trọng số, pha SMA tinh chỉnh cục bộ; kèm kho tinh hoa,
              bước bay Lévy, tìm kiếm cục bộ và khởi động lại khi trì trệ.
            </div>
          </div>
          <span className="muted">→</span>
          <div className="pipeline__step">
            <div className="pipeline__num">03</div>
            <div className="pipeline__title">Bản đồ FRI</div>
            <div className="pipeline__desc">
              FRI = Σ(wᵢ·xᵢ) trên các biến chuẩn hóa, phân 5 mức nguy cơ cho từng ô lưới.
            </div>
          </div>
        </div>
      </div>

      <div className="about-section">
        <h3>Tám biến đầu vào &amp; ràng buộc khoa học</h3>
        <p className="about-section__body">
          Mỗi trọng số bị ràng buộc dấu theo ý nghĩa vật lý: biến làm <b>tăng</b> nguy cơ có
          trọng số dương, biến làm <b>giảm</b> nguy cơ có trọng số âm.
        </p>
        <div className="grid-2" style={{ marginTop: 18 }}>
          <div className="card"><div className="card__body">
            <div style={{ fontWeight: 600 }}>Ảnh vệ tinh Landsat</div>
            <div className="chip-row">
              <span className="chip">NDVI (−)</span><span className="chip">NBR (+)</span>
              <span className="chip">NDWI (−)</span><span className="chip">NBRT (+)</span>
            </div>
          </div></div>
          <div className="card"><div className="card__body">
            <div style={{ fontWeight: 600 }}>Khí tượng NASA POWER</div>
            <div className="chip-row">
              <span className="chip">T2M (+)</span><span className="chip">RH2M (−)</span>
              <span className="chip">WS2M (±)</span><span className="chip">PRECTOTCORR (−)</span>
            </div>
          </div></div>
        </div>
      </div>

      <div className="about-section">
        <h3>Thuật toán TGO&#8209;SMA (lõi hệ thống)</h3>
        <p className="about-section__body">
          Được port nguyên vẹn từ lớp <code>TGO_SMA_Hybrid_Scientific</code> trong
          <code> metaheuristic_comparison_v8.py</code> sang JavaScript. Hàm mục tiêu:
          {' '}<b>fitness = AUC × (0,5 + 0,5·F1) × diversity</b>, tối đa hóa mức khớp giữa bản đồ
          FRI dự đoán và điểm cháy thực tế. Bộ trọng số tối ưu là nghiệm có fitness cao nhất
          sau toàn bộ quá trình (kể cả bước tinh chỉnh hill&#8209;climbing / pattern&#8209;search /
          coordinate&#8209;descent).
        </p>
      </div>

      <div className="about-section">
        <h3>Nhóm thực hiện</h3>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="card"><div className="card__body">
            <div className="step-header__eyebrow">Sinh viên thực hiện</div>
            <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--ink-500)' }}>[Điền họ tên thành viên]</div>
          </div></div>
          <div className="card"><div className="card__body">
            <div className="step-header__eyebrow">Giảng viên hướng dẫn</div>
            <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--ink-500)' }}>[Điền họ tên giảng viên]</div>
          </div></div>
        </div>
      </div>

      <div style={{ padding: '40px 0 72px' }}>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/upload')}>Bắt đầu sử dụng →</button>
      </div>
    </div>
  );
}
