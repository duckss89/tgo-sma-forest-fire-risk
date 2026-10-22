import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav.jsx';
import Splash from './pages/Splash.jsx';
import About from './pages/About.jsx';
import Upload from './pages/Upload.jsx';
import Config from './pages/Config.jsx';
import Results from './pages/Results.jsx';
import History from './pages/History.jsx';

function Shell({ children }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/about" element={<Shell><About /></Shell>} />
      <Route path="/upload" element={<Shell><Upload /></Shell>} />
      <Route path="/config" element={<Shell><Config /></Shell>} />
      <Route path="/results" element={<Shell><Results /></Shell>} />
      <Route path="/history" element={<Shell><History /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
