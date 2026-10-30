import { useState, useRef, useEffect, useCallback } from 'react';
import DocumentPreviewModal from '../../components/ui/DocumentPreviewModal';

const PRESETS = [
  {
    id: 'india_passport',
    name: 'India Passport / PAN / DL',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    desc: '35 × 45 mm (Aspect 7:9) · Standard for Indian Passport, PAN card & OCI',
    badge: 'Popular',
  },
  {
    id: 'us_visa',
    name: 'US Visa / Green Card',
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    desc: '2 × 2 inch (51 × 51 mm) · 1:1 Square · US Visa, Schengen & Diversity Visa',
    badge: 'Global',
  },
  {
    id: 'govt_exam',
    name: 'Govt Exam (SSC / UPSC / Police)',
    widthMm: 35,
    heightMm: 45,
    widthPx: 350,
    heightPx: 450,
    desc: '3.5 × 4.5 cm · Standard for SSC CGL/CHSL, UPSC, Railways & State Police',
    badge: 'Exams',
  },
  {
    id: 'schengen_visa',
    name: 'Schengen / Europe Visa',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    desc: '35 × 45 mm · Light grey/white background with 70–80% face coverage',
    badge: 'Visa',
  },
  {
    id: 'stamp_size',
    name: 'Stamp Size',
    widthMm: 25,
    heightMm: 30,
    widthPx: 295,
    heightPx: 354,
    desc: '25 × 30 mm · Official legal documents, affidavits and identity cards',
    badge: 'Affidavit',
  },
  {
    id: 'custom',
    name: 'Custom Dimensions',
    widthMm: 35,
    heightMm: 45,
    widthPx: 400,
    heightPx: 500,
    desc: 'Specify exact pixel width and height for unique job portals',
    badge: 'Custom',
  },
];

const COLOR_SWATCHES = [
  { id: 'white', label: 'Pure White', hex: '#FFFFFF', border: '#E2E8F0', tag: 'Standard' },
  { id: 'sky', label: 'Light Sky Blue', hex: '#87CEEB', border: '#6BAEDB', tag: 'India ID' },
  { id: 'azure', label: 'Soft Blue', hex: '#BFDBFE', border: '#93C5FD', tag: 'Passport' },
  { id: 'grey', label: 'Light Grey', hex: '#E5E7EB', border: '#D1D5DB', tag: 'Europe' },
  { id: 'offwhite', label: 'Off-White', hex: '#F9FAFB', border: '#E5E7EB', tag: 'Neutral' },
  { id: 'navy', label: 'Studio Navy', hex: '#1E293B', border: '#0F172A', tag: 'Corporate' },
  { id: 'red', label: 'Deep Maroon', hex: '#881337', border: '#4C0519', tag: 'Studio' },
];

export default function LegalPhoto({ navTo }) {
  // File state
  const [file, setFile] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [hasTransparentBg, setHasTransparentBg] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemovalError, setBgRemovalError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Preset & Sizing
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [customWidth, setCustomWidth] = useState(400);
  const [customHeight, setCustomHeight] = useState(500);

  // Background color
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [useBgFill, setUseBgFill] = useState(false);

  // Transformations
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [tilt, setTilt] = useState(0); // -15 to +15 deg
  const [flipH, setFlipH] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Guides
  const [showBiometricGuide, setShowBiometricGuide] = useState(true);
  const [showGridGuide, setShowGridGuide] = useState(false);

  // Name & Date Strip (Govt Exam Requirement)
  const [showNameDate, setShowNameDate] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [photoDate, setPhotoDate] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `DOP: ${dd}.${mm}.${yyyy}`;
  });

  // Adjustments & Cut Border
  const [brightness, setBrightness] = useState(0); // -40 to +40
  const [contrast, setContrast] = useState(0); // -40 to +40
  const [saturation, setSaturation] = useState(0); // -40 to +40
  const [showBorder, setShowBorder] = useState(true);

  // Export settings
  const [exportMode, setExportMode] = useState('single'); // 'single' | 'sheet'
  const [targetSizeLimit, setTargetSizeLimit] = useState('original'); // 'original' | '50kb' | '20kb'
  const [sheetPaper, setSheetPaper] = useState('4x6'); // '4x6' | 'a4'
  const [sheetPhotoCount, setSheetPhotoCount] = useState(8); // 6 | 8 for 4x6, 16 | 32 for A4

  // Live output preview / sizing calculation
  const [estimatedSize, setEstimatedSize] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Modals & Refs
  const previewCanvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const originalImgRef = useRef(null);
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    title: '',
    previewUrl: null,
    downloadUrl: null,
  });

  const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

  // Dimensions helper
  const targetWidth = selectedPreset.id === 'custom' ? Number(customWidth) || 400 : selectedPreset.widthPx;
  const targetHeight = selectedPreset.id === 'custom' ? Number(customHeight) || 500 : selectedPreset.heightPx;
  const aspectRatio = targetWidth / targetHeight;

  // File loading
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      alert('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const img = new Image();
    const objUrl = URL.createObjectURL(selectedFile);
    img.onload = () => {
      originalImgRef.current = img;
      setImageObj(img);
      setFile(selectedFile);
      setHasTransparentBg(false);
      setUseBgFill(false);
      setBgRemovalError(null);
      // Reset transformations
      setRotation(0);
      setTilt(0);
      setFlipH(false);
      setScale(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = objUrl;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // AI Background Removal using optimized /api/remove-bg
  const handleRemoveBg = async () => {
    if (!file) return;
    setIsRemovingBg(true);
    setBgRemovalError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/remove-bg`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errText = '';
        try {
          const errJson = await res.json();
          errText = errJson.error;
        } catch (e) {
          errText = (res.status === 502 || res.status === 503)
            ? 'Backend server is waking up on Render. Please wait 10-20 seconds and click again.'
            : `Server returned error (${res.status})`;
        }
        throw new Error(errText || 'Failed to remove background.');
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const previewUrl = data.previewUrl || data.downloadUrl;
      const fullUrl = previewUrl.startsWith('http') ? previewUrl : `${API_URL}${previewUrl}`;

      // Fetch processed image as a local Blob to ensure zero CORS canvas tainting
      const imgRes = await fetch(fullUrl);
      if (!imgRes.ok) {
        throw new Error('Failed to download processed cutout image.');
      }
      const blob = await imgRes.blob();
      const localBlobUrl = URL.createObjectURL(blob);

      await new Promise((resolve, reject) => {
        const cleanImg = new Image();
        cleanImg.onload = () => {
          if (!originalImgRef.current && imageObj) {
            originalImgRef.current = imageObj;
          }
          setImageObj(cleanImg);
          setHasTransparentBg(true);
          setUseBgFill(true);
          resolve();
        };
        cleanImg.onerror = () => {
          reject(new Error('Could not load processed transparent image.'));
        };
        cleanImg.src = localBlobUrl;
      });
    } catch (err) {
      console.error('BG removal error:', err);
      setBgRemovalError(err.message || 'Background removal failed. You can still use original photo.');
    } finally {
      setIsRemovingBg(false);
    }
  };

  // Revert back to original uploaded photo
  const handleRevertBg = () => {
    if (originalImgRef.current) {
      setImageObj(originalImgRef.current);
      setHasTransparentBg(false);
      setUseBgFill(false);
      setBgRemovalError(null);
    }
  };

  // Render high-res passport photo to a temporary or provided canvas
  const renderPhotoToCanvas = useCallback((targetCanvas, width, height, withBiometrics = false) => {
    if (!targetCanvas || !imageObj) return;
    targetCanvas.width = width;
    targetCanvas.height = height;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background Color if requested or if background was stripped
    if (useBgFill || hasTransparentBg) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Default plain background behind photo
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Transformed Image
    ctx.save();
    
    // Apply Filters (brightness, contrast, saturation)
    const b = 100 + brightness;
    const c = 100 + contrast;
    const s = 100 + saturation;
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

    // Center transform
    const centerX = width / 2 + (pan.x / 100) * width;
    const centerY = height / 2 + (pan.y / 100) * height;
    ctx.translate(centerX, centerY);

    const totalAngle = (rotation + tilt) * (Math.PI / 180);
    ctx.rotate(totalAngle);
    ctx.scale(flipH ? -scale : scale, scale);

    // Determine base fit sizing (cover style inside target box)
    const imgAspect = imageObj.naturalWidth / imageObj.naturalHeight;
    const boxAspect = width / height;
    let drawW, drawH;

    if (imgAspect > boxAspect) {
      drawH = height;
      drawW = height * imgAspect;
    } else {
      drawW = width;
      drawH = width / imgAspect;
    }

    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 3. Name & Date of Photo (DOP) Strip
    if (showNameDate && (candidateName.trim() || photoDate.trim())) {
      const stripH = Math.round(height * 0.16);
      const stripY = height - stripH;

      // Solid crisp white strip
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, stripY, width, stripH);

      // Top dividing line
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, Math.round(width / 350));
      ctx.beginPath();
      ctx.moveTo(0, stripY);
      ctx.lineTo(width, stripY);
      ctx.stroke();

      // Typography
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fontSizePrimary = Math.round(stripH * 0.36);
      const fontSizeSecondary = Math.round(stripH * 0.30);

      if (candidateName.trim() && photoDate.trim()) {
        ctx.font = `700 ${fontSizePrimary}px "Inter", Arial, sans-serif`;
        ctx.fillText(candidateName.trim().toUpperCase(), width / 2, stripY + stripH * 0.34);

        ctx.font = `600 ${fontSizeSecondary}px "Inter", Arial, sans-serif`;
        ctx.fillText(photoDate.trim(), width / 2, stripY + stripH * 0.72);
      } else {
        const textToDraw = candidateName.trim().toUpperCase() || photoDate.trim();
        ctx.font = `700 ${fontSizePrimary}px "Inter", Arial, sans-serif`;
        ctx.fillText(textToDraw, width / 2, stripY + stripH / 2);
      }
    }

    // 4. Subtle Border for cutting out
    if (showBorder) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = Math.max(1, Math.round(width / 400));
      ctx.strokeRect(0, 0, width, height);
    }

    // 5. Interactive Biometric Overlays (Preview mode only)
    if (withBiometrics) {
      ctx.save();
      
      // Rule of thirds grid
      if (showGridGuide) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(width / 3, 0); ctx.lineTo(width / 3, height);
        ctx.moveTo((2 * width) / 3, 0); ctx.lineTo((2 * width) / 3, height);
        ctx.moveTo(0, height / 3); ctx.lineTo(width, height / 3);
        ctx.moveTo(0, (2 * height) / 3); ctx.lineTo(width, (2 * height) / 3);
        ctx.stroke();
      }

      // Biometric Head & Chin Oval Guide (Official ~70-80% height)
      if (showBiometricGuide) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);

        const ovalCenterX = width / 2;
        const ovalCenterY = height * 0.44;
        const radiusX = width * 0.28;
        const radiusY = height * 0.32;

        ctx.beginPath();
        ctx.ellipse(ovalCenterX, ovalCenterY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();

        // Eye line guideline
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const eyeLineY = height * 0.42;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, eyeLineY);
        ctx.lineTo(width * 0.8, eyeLineY);
        ctx.stroke();

        // Chin guideline
        const chinLineY = ovalCenterY + radiusY;
        ctx.beginPath();
        ctx.moveTo(width * 0.3, chinLineY);
        ctx.lineTo(width * 0.7, chinLineY);
        ctx.stroke();

        // Guideline badge
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(width / 2 - 58, 8, 116, 20);
        ctx.fillStyle = '#60A5FA';
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Biometric Guide', width / 2, 18);
      }

      ctx.restore();
    }
  }, [
    imageObj,
    useBgFill,
    hasTransparentBg,
    bgColor,
    brightness,
    contrast,
    saturation,
    pan,
    rotation,
    tilt,
    flipH,
    scale,
    showNameDate,
    candidateName,
    photoDate,
    showBorder,
    showBiometricGuide,
    showGridGuide,
  ]);

  // Update canvas on every state change
  useEffect(() => {
    if (!previewCanvasRef.current || !imageObj) return;
    renderPhotoToCanvas(previewCanvasRef.current, targetWidth, targetHeight, true);
  }, [renderPhotoToCanvas, targetWidth, targetHeight, imageObj]);

  // Calculate estimated file size (debounced to eliminate UI lag during drag/adjustments)
  useEffect(() => {
    if (!imageObj) {
      setEstimatedSize(null);
      return;
    }

    const timer = setTimeout(() => {
      const tempCanvas = document.createElement('canvas');
      renderPhotoToCanvas(tempCanvas, targetWidth, targetHeight, false);

      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            if (targetSizeLimit === '50kb') {
              setEstimatedSize('~35–48 KB');
            } else if (targetSizeLimit === '20kb') {
              setEstimatedSize('~16–19 KB');
            } else {
              const kb = (blob.size / 1024).toFixed(1);
              setEstimatedSize(`${kb} KB`);
            }
          }
        },
        'image/jpeg',
        0.92
      );
    }, 250);

    return () => clearTimeout(timer);
  }, [renderPhotoToCanvas, targetWidth, targetHeight, imageObj, targetSizeLimit]);

  // Non-passive native wheel listener: zooms image without scrolling the outer page
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
      setScale((prev) => Math.min(3.0, Math.max(0.4, Number((prev + zoomDelta).toFixed(2)))));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Pan Canvas Mouse/Touch Handlers with RAF for 60fps performance
  const handleMouseDown = (e) => {
    isDraggingCanvasRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingCanvasRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPan((prev) => ({
        x: prev.x + (deltaX / targetWidth) * 100,
        y: prev.y + (deltaY / targetHeight) * 100,
      }));
    });
  };

  const handleMouseUp = () => {
    isDraggingCanvasRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  // Touch Support for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDraggingCanvasRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPan((prev) => ({
        x: prev.x + (deltaX / targetWidth) * 100,
        y: prev.y + (deltaY / targetHeight) * 100,
      }));
    });
  };

  const handleTouchEnd = () => {
    isDraggingCanvasRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  // Generate Compressed Blob adhering to Target Size (<50KB or <20KB)
  const getOptimizedBlob = async (canvas, targetLimit) => {
    if (targetLimit === 'original') {
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.96));
    }

    const maxBytes = targetLimit === '20kb' ? 19.5 * 1024 : 48.5 * 1024;
    let minQuality = 0.05;
    let maxQuality = 0.95;
    let bestBlob = null;

    for (let i = 0; i < 7; i++) {
      const mid = (minQuality + maxQuality) / 2;
      const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', mid));

      if (blob.size <= maxBytes) {
        bestBlob = blob;
        minQuality = mid; // Try higher quality
      } else {
        maxQuality = mid; // Need lower quality
      }
    }

    // If even lowest quality is slightly above, downsample canvas resolution
    if (!bestBlob || bestBlob.size > maxBytes) {
      const downsample = document.createElement('canvas');
      downsample.width = Math.round(canvas.width * 0.75);
      downsample.height = Math.round(canvas.height * 0.75);
      const dCtx = downsample.getContext('2d');
      dCtx.drawImage(canvas, 0, 0, downsample.width, downsample.height);
      return new Promise((resolve) => downsample.toBlob((b) => resolve(b), 'image/jpeg', 0.65));
    }

    return bestBlob;
  };

  // Single Photo Download
  const handleDownloadSingle = async () => {
    if (!imageObj) return;
    setIsExporting(true);

    try {
      const exportCanvas = document.createElement('canvas');
      renderPhotoToCanvas(exportCanvas, targetWidth, targetHeight, false);

      const blob = await getOptimizedBlob(exportCanvas, targetSizeLimit);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal_photo_${selectedPreset.id}_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Preview Single Photo Modal
  const handlePreviewSingle = () => {
    if (!imageObj) return;
    const exportCanvas = document.createElement('canvas');
    renderPhotoToCanvas(exportCanvas, targetWidth, targetHeight, false);
    exportCanvas.toBlob((blob) => {
      if (blob) {
        const previewUrl = URL.createObjectURL(blob);
        setPreviewModal({
          isOpen: true,
          title: `Legal Photo Preview (${selectedPreset.name})`,
          previewUrl,
          downloadUrl: null,
        });
      }
    }, 'image/jpeg', 0.95);
  };

  // Multi-Photo Print Sheet Generator
  const generatePrintSheetCanvas = () => {
    const singleCanvas = document.createElement('canvas');
    renderPhotoToCanvas(singleCanvas, targetWidth, targetHeight, false);

    const sheetCanvas = document.createElement('canvas');
    const ctx = sheetCanvas.getContext('2d');

    // High resolution 300 DPI Sheet Dimensions
    let sheetW, sheetH, cols, rows;

    if (sheetPaper === '4x6') {
      sheetW = 1800; // 6 inches @ 300 DPI
      sheetH = 1200; // 4 inches @ 300 DPI
      if (sheetPhotoCount === 6) {
        cols = 3;
        rows = 2;
      } else {
        cols = 4;
        rows = 2;
      }
    } else {
      // A4 Sheet: 8.27 x 11.69 inches (~2480 x 3508 px)
      sheetW = 2480;
      sheetH = 3508;
      if (sheetPhotoCount === 16) {
        cols = 4;
        rows = 4;
      } else {
        cols = 4;
        rows = 8;
      }
    }

    sheetCanvas.width = sheetW;
    sheetCanvas.height = sheetH;

    // Fill clean white print paper
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetW, sheetH);

    // Calculate margins and cell sizing
    const marginX = sheetW * 0.05;
    const marginY = sheetH * 0.05;
    const printableW = sheetW - 2 * marginX;
    const printableH = sheetH - 2 * marginY;

    const cellW = printableW / cols;
    const cellH = printableH / rows;

    // Fit photo inside each cell maintaining exact aspect ratio
    const photoAspect = targetWidth / targetHeight;
    let photoW = cellW * 0.88;
    let photoH = photoW / photoAspect;

    if (photoH > cellH * 0.88) {
      photoH = cellH * 0.88;
      photoW = photoH * photoAspect;
    }

    const totalToDraw = Math.min(sheetPhotoCount, cols * rows);

    for (let i = 0; i < totalToDraw; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);

      const cellX = marginX + c * cellW;
      const cellY = marginY + r * cellH;

      const px = cellX + (cellW - photoW) / 2;
      const py = cellY + (cellH - photoH) / 2;

      // Draw photo
      ctx.drawImage(singleCanvas, px, py, photoW, photoH);

      // Draw scissors dashed cut guidelines around each photo cell
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(px - 6, py - 6, photoW + 12, photoH + 12);
      ctx.restore();
    }

    // Sheet metadata header
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Format Studio · ${selectedPreset.name} (${sheetPhotoCount} Copies) · Print at 100% Scale (Do not fit to page)`,
      sheetW / 2,
      sheetH - 24
    );

    return sheetCanvas;
  };

  // Download Multi-Photo Sheet
  const handleDownloadSheet = () => {
    setIsExporting(true);
    try {
      const sheetCanvas = generatePrintSheetCanvas();
      sheetCanvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `print_sheet_${sheetPaper}_${sheetPhotoCount}_photos_${Date.now()}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
          }
          setIsExporting(false);
        },
        'image/jpeg',
        0.96
      );
    } catch (e) {
      console.error(e);
      alert('Could not generate print sheet.');
      setIsExporting(false);
    }
  };

  // Direct Print via Browser
  const handlePrintDirect = () => {
    const sheetCanvas = generatePrintSheetCanvas();
    const dataUrl = sheetCanvas.toDataURL('image/jpeg', 0.98);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to open the print dialog.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Photos - Format Studio</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { width: 100%; height: auto; max-width: 100vw; display: block; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="tool-page legal-photo-page">
      <button className="back-btn" onClick={() => navTo('home')}>
        ← Back to Home
      </button>

      <div className="tool-header">
        <h1 className="tool-title">Passport & Legal Photograph Studio</h1>
        <p className="tool-subtitle">
          Create compliant passport, visa & govt exam photos with custom background colors, SSC name/date stamps, and multi-photo print sheets.
        </p>
      </div>

      <div className="card glass-card legal-photo-card" style={{ padding: 24 }}>
        {!imageObj ? (
          /* Dropzone State */
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('legalPhotoInput').click()}
            style={{ padding: '60px 24px', textAlign: 'center' }}
          >
            <div className="dropzone-icon" style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
            <div className="dropzone-text" style={{ fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>
              Click or drag your portrait photo here
            </div>
            <div className="dropzone-sub" style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
              Supports JPG, PNG, and WebP · Crisp camera selfie or scanned photo
            </div>
            <input
              id="legalPhotoInput"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>
        ) : (
          /* Studio Editor State */
          <div className="legal-studio-layout">
            {/* Top Toolbar / Image Header */}
            <div className="legal-studio-header">
              <div className="legal-file-meta">
                <span className="legal-file-name" title={file?.name}>📄 {file?.name}</span>
                <span className="legal-specs-badge">
                  {selectedPreset.name} ({targetWidth} × {targetHeight} px)
                </span>
                {estimatedSize && (
                  <span className="legal-size-badge" title="Target File Size">
                    💾 {estimatedSize}
                  </span>
                )}
              </div>

              <div className="legal-header-actions">
                <button
                  type="button"
                  className="compress-action-btn compress-btn-change"
                  onClick={() => {
                    setImageObj(null);
                    setFile(null);
                  }}
                  title="Upload a different photo"
                >
                  <span className="compress-btn-icon">🔄</span>
                  <span>Change Photo</span>
                </button>
              </div>
            </div>

            {/* Main Studio Grid */}
            <div className="legal-studio-body">
              {/* Left Column: Interactive Canvas Viewport */}
              <div className="legal-viewport-column">
                <div className="legal-canvas-frame-container">
                  <div
                    ref={canvasWrapperRef}
                    className="legal-canvas-wrapper"
                    style={{
                      aspectRatio: `${aspectRatio}`,
                      maxWidth: aspectRatio < 1 ? '320px' : '380px',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    title="Drag to reposition · Scroll wheel to zoom"
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className="legal-preview-canvas"
                    />

                    {/* Drag helper hint */}
                    <div className="canvas-drag-hint">
                      <span>✋ Drag to position · Wheel to zoom</span>
                    </div>
                  </div>
                </div>

                {/* Viewport Control Badges & Guides Toggle */}
                <div className="viewport-overlay-controls">
                  <button
                    type="button"
                    className={`guide-toggle-btn ${showBiometricGuide ? 'active' : ''}`}
                    onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                    title="Toggle biometric head & chin oval guides"
                  >
                    <span className="guide-icon">👤</span>
                    <span>Biometric Guide</span>
                  </button>

                  <button
                    type="button"
                    className={`guide-toggle-btn ${showGridGuide ? 'active' : ''}`}
                    onClick={() => setShowGridGuide(!showGridGuide)}
                    title="Toggle rule-of-thirds alignment grid"
                  >
                    <span className="guide-icon">▦</span>
                    <span>Thirds Grid</span>
                  </button>

                  <button
                    type="button"
                    className="guide-toggle-btn"
                    onClick={() => {
                      setScale(1);
                      setPan({ x: 0, y: 0 });
                      setTilt(0);
                    }}
                    title="Reset pan, zoom and tilt to center"
                  >
                    <span className="guide-icon">⟲</span>
                    <span>Center Frame</span>
                  </button>
                </div>

                {/* Zoom & Quick Posture Sliders under viewport */}
                <div className="viewport-sliders-card">
                  <div className="slider-row">
                    <span className="slider-label">Zoom ({Math.round(scale * 100)}%)</span>
                    <input
                      type="range"
                      min="0.4"
                      max="3.0"
                      step="0.05"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="legal-range-input"
                    />
                  </div>

                  <div className="slider-row">
                    <span className="slider-label">Head Tilt ({tilt > 0 ? `+${tilt}°` : `${tilt}°`})</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={tilt}
                        onChange={(e) => setTilt(parseFloat(e.target.value))}
                        className="legal-range-input"
                      />
                      {tilt !== 0 && (
                        <button
                          type="button"
                          className="tilt-reset-btn"
                          onClick={() => setTilt(0)}
                          title="Reset tilt to 0"
                        >
                          0°
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rotation & Flip Toolbar */}
                  <div className="transform-action-row">
                    <button
                      type="button"
                      className="transform-btn"
                      onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                      title="Rotate 90 degrees counter-clockwise"
                    >
                      ↺ Rotate Left
                    </button>
                    <button
                      type="button"
                      className="transform-btn"
                      onClick={() => setRotation((prev) => (prev + 90) % 360)}
                      title="Rotate 90 degrees clockwise"
                    >
                      ↻ Rotate Right
                    </button>
                    <button
                      type="button"
                      className={`transform-btn ${flipH ? 'active' : ''}`}
                      onClick={() => setFlipH(!flipH)}
                      title="Flip photo horizontally (mirror selfie fix)"
                    >
                      ⇆ Flip Mirror
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Studio Customization Panel */}
              <div className="legal-controls-column">
                {/* 1. Size Presets Accordion */}
                <div className="control-section-box">
                  <div className="section-title-row">
                    <span className="section-step-num">1</span>
                    <h2 className="section-step-title">Document & Size Standard</h2>
                  </div>

                  <div className="presets-list">
                    {PRESETS.map((p) => (
                      <div
                        key={p.id}
                        className={`preset-card-item ${selectedPreset.id === p.id ? 'active' : ''}`}
                        onClick={() => setSelectedPreset(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPreset(p); }}
                      >
                        <div className="preset-card-header">
                          <span className="preset-radio-indicator">
                            {selectedPreset.id === p.id ? '●' : '○'}
                          </span>
                          <span className="preset-name">{p.name}</span>
                          <span className="preset-badge">{p.badge}</span>
                        </div>
                        <p className="preset-desc">{p.desc}</p>
                      </div>
                    ))}
                  </div>

                  {selectedPreset.id === 'custom' && (
                    <div className="custom-dim-row">
                      <div className="custom-dim-col">
                        <label className="dim-input-label">Width (px)</label>
                        <input
                          type="number"
                          className="dim-input"
                          value={customWidth}
                          min="100"
                          max="2000"
                          onChange={(e) => setCustomWidth(Math.max(50, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <span className="dim-sep">×</span>
                      <div className="custom-dim-col">
                        <label className="dim-input-label">Height (px)</label>
                        <input
                          type="number"
                          className="dim-input"
                          value={customHeight}
                          min="100"
                          max="2000"
                          onChange={(e) => setCustomHeight(Math.max(50, parseInt(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Background Color & AI Clean */}
                <div className="control-section-box">
                  <div className="section-title-row">
                    <span className="section-step-num">2</span>
                    <h2 className="section-step-title">Background Color</h2>
                  </div>

                  {/* AI Remove BG CTA */}
                  <div className="ai-bg-banner">
                    <div className="ai-bg-info">
                      <span className="ai-bg-title">AI Background Cutout</span>
                      <span className="ai-bg-sub">
                        {hasTransparentBg
                          ? 'Background is transparent. Pick any backdrop color below.'
                          : 'Remove messy backdrop to apply official passport colors.'}
                      </span>
                    </div>

                    {!hasTransparentBg ? (
                      <button
                        type="button"
                        className="btn-ai-remove-bg"
                        onClick={handleRemoveBg}
                        disabled={isRemovingBg}
                      >
                        {isRemovingBg ? (
                          <>
                            <div className="spinner" style={{ width: 14, height: 14, margin: 0, marginRight: 6 }} />
                            <span>Cleaning…</span>
                          </>
                        ) : (
                          '✨ AI Clean Background'
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="ai-cleaned-pill">✓ Background Cutout Active</span>
                        <button
                          type="button"
                          className="btn-revert-bg"
                          onClick={handleRevertBg}
                          title="Revert back to original photo"
                        >
                          ↺ Original
                        </button>
                      </div>
                    )}
                  </div>

                  {bgRemovalError && (
                    <div className="tool-error-msg" style={{ margin: '8px 0 12px 0' }}>
                      {bgRemovalError}
                    </div>
                  )}

                  {/* Solid Swatches */}
                  <div className="color-swatches-grid">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.id}
                        type="button"
                        className={`swatch-btn ${bgColor.toUpperCase() === swatch.hex.toUpperCase() && useBgFill ? 'active' : ''}`}
                        onClick={() => {
                          setBgColor(swatch.hex);
                          setUseBgFill(true);
                        }}
                        style={{ background: swatch.hex, borderColor: swatch.border }}
                        title={`${swatch.label} (${swatch.tag})`}
                      >
                        {bgColor.toUpperCase() === swatch.hex.toUpperCase() && useBgFill && (
                          <span style={{ color: swatch.id === 'white' || swatch.id === 'offwhite' ? '#0F172A' : '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                            ✓
                          </span>
                        )}
                      </button>
                    ))}

                    {/* Custom Color Input */}
                    <label className="custom-color-picker-label" title="Pick custom color">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          setUseBgFill(true);
                        }}
                        className="custom-color-native-input"
                      />
                      <span>🎨</span>
                    </label>
                  </div>

                  <div className="bg-toggle-row">
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={useBgFill}
                        onChange={(e) => setUseBgFill(e.target.checked)}
                      />
                      <span>Apply solid background fill</span>
                    </label>
                  </div>
                </div>

                {/* 3. Name & Date of Photo Strip (Govt Exam Requirement) */}
                <div className="control-section-box">
                  <div className="section-title-row">
                    <span className="section-step-num">3</span>
                    <h2 className="section-step-title">Name & Date of Photo (DOP)</h2>
                    <span className="section-step-badge">Govt / SSC</span>
                  </div>

                  <p className="section-step-desc">
                    Mandatory for SSC CGL, CHSL, GD, Railway, and State Police recruitment portals.
                  </p>

                  <label className="checkbox-toggle-label" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={showNameDate}
                      onChange={(e) => setShowNameDate(e.target.checked)}
                    />
                    <span>Add bottom white strip with Candidate Name & Date</span>
                  </label>

                  {showNameDate && (
                    <div className="name-date-inputs-box">
                      <div className="input-group">
                        <label className="input-label">Candidate Full Name (in CAPS)</label>
                        <input
                          type="text"
                          className="form-control-input"
                          placeholder="e.g. RAHUL KUMAR SHARMA"
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Date of Photo (DOP)</label>
                        <input
                          type="text"
                          className="form-control-input"
                          placeholder="e.g. DOP: 29.10.2026"
                          value={photoDate}
                          onChange={(e) => setPhotoDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Fine Tune Adjustments & Border */}
                <div className="control-section-box">
                  <div className="section-title-row">
                    <span className="section-step-num">4</span>
                    <h2 className="section-step-title">Enhancements & Border</h2>
                  </div>

                  <div className="adjustments-grid">
                    <div className="adj-item">
                      <span className="adj-label">Brightness ({brightness})</span>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="legal-range-input"
                      />
                    </div>
                    <div className="adj-item">
                      <span className="adj-label">Contrast ({contrast})</span>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="legal-range-input"
                      />
                    </div>
                    <div className="adj-item">
                      <span className="adj-label">Saturation ({saturation})</span>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={saturation}
                        onChange={(e) => setSaturation(parseInt(e.target.value))}
                        className="legal-range-input"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={showBorder}
                        onChange={(e) => setShowBorder(e.target.checked)}
                      />
                      <span>Add 1px cut line border (Makes cutting easy on white paper)</span>
                    </label>
                  </div>
                </div>

                {/* 5. Export Modes (Single Photo vs Multi-Photo Print Sheet) */}
                <div className="control-section-box export-box">
                  <div className="section-title-row">
                    <span className="section-step-num">5</span>
                    <h2 className="section-step-title">Download & Print</h2>
                  </div>

                  {/* Export Tabs */}
                  <div className="export-tabs-row">
                    <button
                      type="button"
                      className={`export-tab-btn ${exportMode === 'single' ? 'active' : ''}`}
                      onClick={() => setExportMode('single')}
                    >
                      Single Photo
                    </button>
                    <button
                      type="button"
                      className={`export-tab-btn ${exportMode === 'sheet' ? 'active' : ''}`}
                      onClick={() => setExportMode('sheet')}
                    >
                      Multi-Photo Print Sheet
                    </button>
                  </div>

                  {exportMode === 'single' ? (
                    /* Single Photo Options */
                    <div className="single-export-options">
                      <label className="modal-label" style={{ marginBottom: 8, display: 'block' }}>
                        Portal File Size Target
                      </label>
                      <div className="size-limit-selector">
                        <button
                          type="button"
                          className={`size-limit-btn ${targetSizeLimit === 'original' ? 'active' : ''}`}
                          onClick={() => setTargetSizeLimit('original')}
                        >
                          <span className="limit-title">300 DPI Original</span>
                          <span className="limit-sub">Maximum Clarity</span>
                        </button>
                        <button
                          type="button"
                          className={`size-limit-btn ${targetSizeLimit === '50kb' ? 'active' : ''}`}
                          onClick={() => setTargetSizeLimit('50kb')}
                        >
                          <span className="limit-title">Under 50 KB</span>
                          <span className="limit-sub">SSC / UPSC Standard</span>
                        </button>
                        <button
                          type="button"
                          className={`size-limit-btn ${targetSizeLimit === '20kb' ? 'active' : ''}`}
                          onClick={() => setTargetSizeLimit('20kb')}
                        >
                          <span className="limit-title">Under 20 KB</span>
                          <span className="limit-sub">Strict Portals</span>
                        </button>
                      </div>

                      <div className="export-actions-row">
                        <button
                          type="button"
                          className="btn-preview-action"
                          onClick={handlePreviewSingle}
                        >
                          👁️ Full Preview
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleDownloadSingle}
                          disabled={isExporting}
                        >
                          {isExporting ? 'Generating…' : '⬇ Download Passport Photo'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Multi-Photo Printable Sheet Options */
                    <div className="sheet-export-options">
                      <div className="sheet-config-row">
                        <div className="sheet-config-col">
                          <label className="modal-label">Paper Size</label>
                          <select
                            className="sheet-select"
                            value={sheetPaper}
                            onChange={(e) => {
                              const p = e.target.value;
                              setSheetPaper(p);
                              setSheetPhotoCount(p === '4x6' ? 8 : 16);
                            }}
                          >
                            <option value="4x6">4 × 6 Inch (Photo Studio Paper)</option>
                            <option value="a4">A4 Size (Standard Office Paper)</option>
                          </select>
                        </div>

                        <div className="sheet-config-col">
                          <label className="modal-label">Total Copies</label>
                          <select
                            className="sheet-select"
                            value={sheetPhotoCount}
                            onChange={(e) => setSheetPhotoCount(Number(e.target.value))}
                          >
                            {sheetPaper === '4x6' ? (
                              <>
                                <option value={6}>6 Photos Grid</option>
                                <option value={8}>8 Photos Grid</option>
                              </>
                            ) : (
                              <>
                                <option value={16}>16 Photos Grid</option>
                                <option value={32}>32 Photos Grid</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="sheet-info-pill">
                        🖨️ Includes scissors dashed cut guidelines between photos for clean trimming.
                      </div>

                      <div className="export-actions-row">
                        <button
                          type="button"
                          className="btn-preview-action"
                          onClick={handlePrintDirect}
                        >
                          🖨️ Print Directly
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleDownloadSheet}
                          disabled={isExporting}
                        >
                          {isExporting ? 'Generating Sheet…' : `⬇ Download ${sheetPaper.toUpperCase()} Sheet (JPG)`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        title={previewModal.title}
        previewUrl={previewModal.previewUrl}
        downloadUrl={previewModal.downloadUrl}
      />
    </div>
  );
}
