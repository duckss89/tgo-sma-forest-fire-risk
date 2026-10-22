import { NavLink, useNavigate } from 'react-router-dom';

export default function TopNav() {
  const navigate = useNavigate();
  return (
    <nav className="topnav">
      <div className="topnav__inner">
        <button type="button" className="topnav__brand" onClick={() => navigate('/')}>
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <path d="M13 2c3 4 3 8 0 12-3-4-3-8 0-12Z" fill="#2563EB" />
            <path d="M13 12c2.4 2.6 2.4 6 .6 9-.6-2.6-2.2-4-3.6-5.2 1-1.4 2-2.6 3-3.8Z" fill="#8AB4FF" />
          </svg>
          <span className="topnav__wordmark">FRI <em>Lâm Đồng</em></span>
        </button>
        <div className="topnav__spacer" />
        <div className="topnav__links">
          <NavLink to="/upload" className="topnav__link">Vào hệ thống</NavLink>
          <NavLink to="/history" className="topnav__link">Lịch sử chạy</NavLink>
          <NavLink to="/about" className="topnav__link">Về hệ thống</NavLink>
        </div>
      </div>
    </nav>
  );
}
