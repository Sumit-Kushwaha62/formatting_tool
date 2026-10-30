export const TOOL_GROUPS = [
  {
    id: 'formatting',
    label: 'Publishing & Academic Formats',
    description: 'Structured layout presets engineered for print publication, university submissions, and formal correspondence.',
    tools: [
      { id: 'book', name: 'Book', description: 'Automated chapter hierarchy, running headers, and book print layout.', target: 'tool', action: 'Open formatter' },
      { id: 'thesis', name: 'Thesis', description: 'Pre-configured margins and sections for academic university submission guidelines.', target: 'tool', action: 'Open formatter' },
      { id: 'research', name: 'Research Paper', description: 'Journal-ready structure with abstract, metadata, and citation layout.', target: 'tool', action: 'Open formatter' },
      { id: 'letter', name: 'Letter / Notice', description: 'Formal letterhead layouts, reference numbers, and administrative formats.', target: 'tool', action: 'Open formatter' },
    ],
  },
  {
    id: 'conversion',
    label: 'Conversion & Assembly Utilities',
    description: 'High-speed deterministic file processors to merge documents and convert formats without quality loss.',
    tools: [
      { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF files in custom order with page fidelity preserved.', target: 'merge-pdf', action: 'Open utility' },
      { id: 'compress-pdf', name: 'PDF Compressor', description: 'Reduce PDF file sizes dramatically with smart DPI optimization and live preview.', target: 'compress-pdf', action: 'Open utility' },
      { id: 'merge-word', name: 'Merge Word', description: 'Combine multiple DOCX files with clean section breaks and style preservation.', target: 'merge-word', action: 'Open utility' },
      { id: 'pdf-to-word', name: 'PDF to Word', description: 'Convert PDF files into fully editable, cleanly structured DOCX documents.', target: 'pdf-to-word', action: 'Open utility' },
      { id: 'excel-to-pdf', name: 'Excel to PDF', description: 'Render spreadsheet tables into paginated, publication-grade PDF documents.', target: 'excel-to-pdf', action: 'Open utility' },
      { id: 'hindi-to-krutidev', name: 'Hindi to KrutiDev', description: 'Convert Unicode Hindi documents to legacy KrutiDev 010 font encoding.', target: 'hindi-to-krutidev', action: 'Open utility' },
      { id: 'compress-image', name: 'Image Compressor', description: 'Reduce JPG, PNG, and WebP image sizes with smart quality optimization and instant preview.', target: 'compress-image', action: 'Open utility' },
      { id: 'remove-bg', name: 'Background Remover', description: 'Remove background from any image with high-precision AI and download transparent PNG.', target: 'remove-bg', action: 'Open utility' },
      { id: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove password security from protected PDF files with safe and instant decryption.', target: 'unlock-pdf', action: 'Open utility' },
      { id: 'legal-photo', name: 'Passport & Legal Photo', description: 'Design compliant passport, visa & exam photos with background change, name/date & print sheet.', target: 'legal-photo', action: 'Open studio' },
    ],
  },
];

export const ALL_TOOLS = TOOL_GROUPS.flatMap((group) => group.tools);
