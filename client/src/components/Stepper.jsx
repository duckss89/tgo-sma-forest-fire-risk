import { useNavigate } from 'react-router-dom';

const STEPS = [
  { n: 1, label: 'Nhập dữ liệu', path: '/upload' },
  { n: 2, label: 'Cấu hình & chạy', path: '/config' },
  { n: 3, label: 'Kết quả', path: '/results' },
];

export default function Stepper({ current }) {
  const navigate = useNavigate();
  return (
    <div className="wrap">
      <div className="stepper">
        {STEPS.map((s, i) => (
          <span key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className="stepper__sep" />}
            <button
              type="button"
              className={`stepper__item ${current === s.n ? 'is-current' : ''} ${current > s.n ? 'is-done' : ''}`}
              onClick={() => navigate(s.path)}
            >
              <span className="num">{current > s.n ? '✓' : s.n}</span>
              {s.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
