import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import SessionLanding from './components/SessionLanding/SessionLanding';
import SessionPage from './pages/SessionPage';

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof gtag === 'undefined') return;
    gtag('event', 'page_view', { page_path: location.pathname });
  }, [location.pathname]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RouteTracker />
      <Routes>
        <Route path="/" element={<SessionLanding />} />
        <Route path="/session/:code" element={<SessionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
