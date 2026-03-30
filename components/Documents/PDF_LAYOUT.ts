
export const PDF_LAYOUT = {
  // Physical A4 Dimensions (mm)
  widthMm: 210,
  heightMm: 297,
  
  // Safe Print Margins (mm)
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 20,
  marginRight: 20,

  // CSS Values
  get cssWidth() { return `${this.widthMm}mm`; },
  get cssHeight() { return `${this.heightMm}mm`; },
  get cssPadding() { return `${this.marginTop}mm ${this.marginRight}mm ${this.marginBottom}mm ${this.marginLeft}mm`; },
  
  // Screen Approximation (96 DPI)
  widthPx: 794,
  heightPx: 1123,
  
  // Standard Styling Class for Document Container
  // overflow-hidden is CRITICAL to prevent blank pages in PDF generation
  printClass: 'bg-white shadow-2xl print:shadow-none mx-auto relative flex flex-col box-border font-serif text-slate-900 overflow-hidden leading-normal',
  
  // Typography Defaults (Standardized for A4 Business Docs)
  baseFontSize: '10pt',   // Reduced from 11pt
  headerFontSize: '16pt', // Reduced from 18pt
  
  // Table Layout
  tableHeaderColor: '#f3f4f6', // gray-100
  tableBorderColor: '#000000', // Black borders for formal print
};
