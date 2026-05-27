export const DOC_TYPES = [
  {
    id: 'book', label: 'Book', icon: '📖', tag: 'Publishing',
    desc: 'Full book formatting with chapters, headers & print layout',
    fields: [
      { key: 'title', label: 'Book Title', placeholder: 'e.g. The Art of Science' },
      { key: 'author', label: 'Author Name', placeholder: 'e.g. Dr. Ramesh Kumar' },
      { key: 'volume', label: 'Volume / Edition', placeholder: 'e.g. Vol. 2, 3rd Edition' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Chapter name or Publisher name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. © 2024 Publisher Name' },
      { key: 'website_url', label: 'Publisher Website', placeholder: 'https://yourpublisher.com' },
      { key: 'isbn', label: 'ISBN', placeholder: 'e.g. 978-3-16-148410-0' },
    ],
  },
  {
    id: 'thesis', label: 'Thesis', icon: '🎓', tag: 'Academic',
    desc: 'Academic thesis with university formatting standards',
    fields: [
      { key: 'title', label: 'Thesis Title', placeholder: 'e.g. Impact of AI on Education' },
      { key: 'author', label: 'Student Name', placeholder: 'e.g. Priya Sharma' },
      { key: 'university', label: 'University Name', placeholder: 'e.g. IIT Delhi' },
      { key: 'department', label: 'Department', placeholder: 'e.g. Computer Science' },
      { key: 'supervisor', label: 'Supervisor Name', placeholder: 'e.g. Prof. A.K. Singh' },
      { key: 'year', label: 'Submission Year', placeholder: 'e.g. 2024' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. University name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Confidential' },
    ],
  },
  {
    id: 'research', label: 'Research Paper', icon: '🔬', tag: 'Journal',
    desc: 'Journal-ready research paper with citations & abstract layout',
    fields: [
      { key: 'title', label: 'Paper Title', placeholder: 'e.g. Neural Networks in Climate' },
      { key: 'author', label: 'Author(s)', placeholder: 'e.g. Kumar A., Singh B.' },
      { key: 'journal', label: 'Journal / Conference', placeholder: 'e.g. IEEE Transactions on AI' },
      { key: 'volume', label: 'Volume & Issue', placeholder: 'e.g. Vol. 12, Issue 3' },
      { key: 'doi', label: 'DOI / URL', placeholder: 'e.g. 10.1109/tai.2024.001' },
      { key: 'keywords', label: 'Keywords', placeholder: 'e.g. AI, Machine Learning' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Journal name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Copyright notice' },
    ],
  },
  {
    id: 'letter', label: 'Letter / Notice', icon: '✉️', tag: 'Official',
    desc: 'Formal letters, office memos and official notices',
    fields: [
      { key: 'org_name', label: 'Organization Name', placeholder: 'e.g. Ministry of Education' },
      { key: 'ref_no', label: 'Reference Number', placeholder: 'e.g. MOE/2024/001' },
      { key: 'date', label: 'Date', placeholder: 'e.g. 28 April 2024' },
      { key: 'subject', label: 'Subject', placeholder: 'e.g. Annual Report Submission' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Government of India' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Address, Phone, Website' },
      { key: 'website_url', label: 'Website URL', placeholder: 'https://yourorg.gov.in' },
    ],
  },
];

export const ENGLISH_FONTS = [
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Cambria', label: 'Cambria' },
  { value: 'Bookman Old Style', label: 'Bookman Old Style' },
];

export const HINDI_FONTS = [
  { value: 'Krutidev010', label: 'KrutiDev 010' },
  { value: 'Mangal', label: 'Mangal' },
  { value: 'Kokila', label: 'Kokila' },
  { value: 'Utsaah', label: 'Utsaah' },
  { value: 'Aparajita', label: 'Aparajita' },
  { value: 'Nirmala UI', label: 'Nirmala UI' },
];

export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 22, 24];

export const LINE_SPACINGS = [
  { label: 'Single (1.0)', value: 1.0 },
  { label: 'Normal (1.15)', value: 1.15 },
  { label: 'Wide (1.5)', value: 1.5 },
  { label: 'Double (2.0)', value: 2.0 },
];

export const PAGE_SIZES = [
  { value: 'A4', label: 'A4', desc: '210×297mm' },
  { value: 'A5', label: 'A5', desc: '148×210mm' },
  { value: 'A3', label: 'A3', desc: '297×420mm' },
  { value: 'Letter', label: 'Letter', desc: '216×279mm' },
  { value: 'Legal', label: 'Legal', desc: '216×356mm' },
];

export const PAGE_NUM_POSITIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Scholar',
    price: '₹0',
    period: 'forever',
    desc: 'For students & occasional use',
    features: ['3 documents/month', 'Book & Thesis formatting', 'Standard fonts', 'A4 / Letter page sizes', 'Email support'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Professional',
    price: '₹199',
    period: '/month',
    desc: 'For researchers & publishers',
    features: ['Unlimited documents', 'All 4 document types', 'Hindi & English fonts', 'All page sizes & margins', 'Priority support', 'Batch formatting', 'Custom headers & footers'],
    cta: 'Start 14-day Trial',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Institution',
    price: '₹999',
    period: '/month',
    desc: 'For universities & publishers',
    features: ['Everything in Pro', 'Up to 10 users', 'Dedicated account manager', 'Custom formatting templates', 'API access', 'Invoice & GST billing', 'SLA guarantee'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

export const FEATURES = [
  { icon: '📐', title: 'Precision Formatting', desc: 'Pixel-perfect margins, spacing & typography following international academic standards.' },
  { icon: '🌐', title: 'Hindi & English', desc: 'Full support for KrutiDev, Mangal, Times New Roman and all major publishing fonts.' },
  { icon: '🎓', title: 'University Standards', desc: 'Pre-configured for IIT, DU, BHU & other Indian university thesis submission guidelines.' },
  { icon: '⚡', title: 'Instant Processing', desc: 'No AI, no queue. Direct rule-based formatting engine delivers results in seconds.' },
  { icon: '🔒', title: 'Secure & Private', desc: 'Files processed and immediately deleted. Zero retention. Your data stays yours.' },
  { icon: '📄', title: 'All Document Types', desc: 'Books, theses, research papers, official letters & government notices — one platform.' },
];
