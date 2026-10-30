import { useState, lazy, Suspense } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './theme/ThemeProvider';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileMenu from './components/layout/MobileMenu';
import AuthModals from './components/ui/AuthModals';
import DailyFeedbackPopup from './components/ui/DailyFeedbackPopup';
import Home from './pages/Home';
import Tool from './pages/Tool';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import MergePDF from './pages/tools/MergePDF';
import CompressPDF from './pages/tools/CompressPDF';
import MergeWord from './pages/tools/MergeWord';
import PDFtoWord from './pages/tools/PDFtoWord';
import ExcelToPDF from './pages/tools/ExcelToPDF';
import HindiToKrutidev from './pages/tools/HindiToKrutidev';
import CompressImage from './pages/tools/CompressImage';
import RemoveBg from './pages/tools/RemoveBg';
import UnlockPDF from './pages/tools/UnlockPDF';
import LegalPhoto from './pages/tools/LegalPhoto';
import './styles/globals.css';

// Admin is rarely visited by regular users, keep it lazy to save initial bandwidth
const Admin = lazy(() => import('./pages/Admin'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', gap: '12px' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>Loading tool…</span>
    </div>
  );
}

function AppContent() {
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);

  const navTo = (p) => {
    setPage(p);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app-container">
      <Navbar page={page} navTo={navTo} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <MobileMenu isOpen={menuOpen} navTo={navTo} setMenuOpen={setMenuOpen} />
      
      <Suspense fallback={<PageLoader />}>
        {page === 'home' && <Home navTo={navTo} />}
        {page === 'tool' && <Tool navTo={navTo} />}
        {page === 'merge-pdf' && <MergePDF navTo={navTo} />}
        {page === 'compress-pdf' && <CompressPDF navTo={navTo} />}
        {page === 'merge-word' && <MergeWord navTo={navTo} />}
        {page === 'pdf-to-word' && <PDFtoWord navTo={navTo} />}
        {page === 'excel-to-pdf' && <ExcelToPDF navTo={navTo} />}
        {page === 'hindi-to-krutidev' && <HindiToKrutidev navTo={navTo} />}
        {page === 'compress-image' && <CompressImage navTo={navTo} />}
        {page === 'remove-bg' && <RemoveBg navTo={navTo} />}
        {page === 'unlock-pdf' && <UnlockPDF navTo={navTo} />}
        {page === 'legal-photo' && <LegalPhoto navTo={navTo} />}
        {page === 'pricing' && <Pricing navTo={navTo} />}
        {page === 'contact' && <Contact />}
        {page === 'dashboard' && <Dashboard navTo={navTo} />}
        {page === 'admin' && <Admin navTo={navTo} />}
      </Suspense>

      {page !== 'dashboard' && page !== 'admin' && <Footer navTo={navTo} />}

      <AuthModals navTo={navTo} />
      <DailyFeedbackPopup />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
