import React, { useState } from 'react';
import { AuthProvider } from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileMenu from './components/layout/MobileMenu';
import AuthModals from './components/ui/AuthModals';
import LicenceModal from './components/ui/LicenceModal';
import Home from './pages/Home';
import Tool from './pages/Tool';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import MergePDF from './pages/tools/MergePDF';
import MergeWord from './pages/tools/MergeWord';
import PDFtoWord from './pages/tools/PDFtoWord';
import ExcelToPDF from './pages/tools/ExcelToPDF';
import './styles/globals.css';

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
      
      {page === 'home' && <Home navTo={navTo} />}
      {page === 'tool' && <Tool navTo={navTo} />}
      {page === 'merge-pdf' && <MergePDF navTo={navTo} />}
      {page === 'merge-word' && <MergeWord navTo={navTo} />}
      {page === 'pdf-to-word' && <PDFtoWord navTo={navTo} />}
      {page === 'excel-to-pdf' && <ExcelToPDF navTo={navTo} />}
      {page === 'pricing' && <Pricing navTo={navTo} />}
      {page === 'contact' && <Contact />}
      {page === 'dashboard' && <Dashboard navTo={navTo} />}

      {page !== 'dashboard' && <Footer navTo={navTo} />}

      <AuthModals navTo={navTo} />
      <LicenceModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
