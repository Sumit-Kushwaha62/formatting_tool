import sys
import json
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ── Arguments ──────────────────────────────────────────────
input_path   = sys.argv[1]
output_path  = sys.argv[2]
doc_type     = sys.argv[3] if len(sys.argv) > 3 else 'book'
options_file = sys.argv[4] if len(sys.argv) > 4 else None

options = {}
if options_file:
    try:
        with open(options_file, 'r', encoding='utf-8') as f:
            options = json.load(f)
    except Exception as e:
        print(f"Options load error: {e}")

print(f"DocType: {doc_type}")
print(f"Options: {options}")

# ── Default fonts per doc type ──────────────────────────────
DEFAULT_FONTS = {
    'book':     'Garamond',
    'thesis':   'Times New Roman',
    'research': 'Arial',
    'letter':   'Calibri',
}

# ── Page size map (width, height) in Mm ────────────────────
PAGE_SIZES = {
    'A4':     (210, 297),
    'A5':     (148, 210),
    'A3':     (297, 420),
    'Letter': (216, 279),
    'Legal':  (216, 356),
}

def get_font(opts, doc_type):
    return opts.get('font_style') or DEFAULT_FONTS.get(doc_type, 'Calibri')

def apply_page_size(doc, size_key='A4'):
    size = PAGE_SIZES.get(size_key, PAGE_SIZES['A4'])
    for section in doc.sections:
        section.page_width  = Mm(size[0])
        section.page_height = Mm(size[1])

# ── Helper: Page Border ─────────────────────────────────────
def add_page_border(doc, color='2E4057'):
    for section in doc.sections:
        sectPr = section._sectPr
        for existing in sectPr.findall(qn('w:pgBorders')):
            sectPr.remove(existing)
        pgBorders = OxmlElement('w:pgBorders')
        pgBorders.set(qn('w:offsetFrom'), 'page')
        for side in ['top', 'left', 'bottom', 'right']:
            border = OxmlElement(f'w:{side}')
            border.set(qn('w:val'), 'single')
            border.set(qn('w:sz'), '18')
            border.set(qn('w:space'), '24')
            border.set(qn('w:color'), color)
            pgBorders.append(border)
        sectPr.append(pgBorders)

# ── Helper: Header ──────────────────────────────────────────
def set_header(doc, text):
    if not text:
        return
    for section in doc.sections:
        header = section.header
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.clear()
        run = p.add_run(text)
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x6a, 0x5e, 0x4e)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── Helper: Footer ──────────────────────────────────────────
def set_footer(doc, text):
    if not text:
        return
    for section in doc.sections:
        footer = section.footer
        p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        p.clear()
        run = p.add_run(text)
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x6a, 0x5e, 0x4e)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── Helper: Margins ─────────────────────────────────────────
def set_margins(doc, top=1.0, bottom=1.0, left=1.2, right=1.0):
    for section in doc.sections:
        section.top_margin    = Inches(top)
        section.bottom_margin = Inches(bottom)
        section.left_margin   = Inches(left)
        section.right_margin  = Inches(right)

# ── Helper: Format Paragraphs ───────────────────────────────
def format_paragraphs(doc, body_font='Calibri', body_size=11, heading_size=14, heading_color='2E4057'):
    r, g, b = tuple(int(heading_color[i:i+2], 16) for i in (0, 2, 4))
    for para in doc.paragraphs:
        if not para.text.strip():
            continue
        is_heading = (
            (para.style and para.style.name and para.style.name.startswith('Heading'))
            or para.text.strip().isupper()
        )
        if is_heading:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.size = Pt(heading_size)
                run.font.color.rgb = RGBColor(r, g, b)
                run.font.name = body_font
        else:
            para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            for run in para.runs:
                run.font.size = Pt(body_size)
                run.font.name = body_font

# ══════════════════════════════════════════════════════════════
#  BOOK
# ══════════════════════════════════════════════════════════════
def format_book(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.0, bottom=1.0, left=1.5, right=1.0)
    add_page_border(doc, '2E4057')

    font = get_font(opts, 'book')
    format_paragraphs(doc, body_font=font, body_size=12, heading_size=16)

    header_text = opts.get('header') or opts.get('title') or ''
    footer_parts = []
    if opts.get('footer'):      footer_parts.append(opts['footer'])
    if opts.get('volume'):      footer_parts.append(opts['volume'])
    if opts.get('website_url'): footer_parts.append(opts['website_url'])
    if opts.get('isbn'):        footer_parts.append('ISBN: ' + opts['isbn'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  THESIS
# ══════════════════════════════════════════════════════════════
def format_thesis(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.2, bottom=1.0, left=1.5, right=1.0)
    add_page_border(doc, '1a1a5e')

    font = get_font(opts, 'thesis')
    format_paragraphs(doc, body_font=font, body_size=12, heading_size=14, heading_color='1a1a5e')

    header_parts = []
    if opts.get('university'): header_parts.append(opts['university'])
    if opts.get('department'):  header_parts.append(opts['department'])
    header_text = opts.get('header') or ' — '.join(header_parts)

    footer_parts = []
    if opts.get('footer'):     footer_parts.append(opts['footer'])
    if opts.get('supervisor'): footer_parts.append('Supervisor: ' + opts['supervisor'])
    if opts.get('year'):       footer_parts.append(opts['year'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  RESEARCH
# ══════════════════════════════════════════════════════════════
def format_research(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.0, bottom=1.0, left=1.0, right=1.0)
    add_page_border(doc, '1a4a2a')

    font = get_font(opts, 'research')
    format_paragraphs(doc, body_font=font, body_size=11, heading_size=13, heading_color='1a4a2a')

    header_text = opts.get('header') or opts.get('journal') or ''
    footer_parts = []
    if opts.get('footer'): footer_parts.append(opts['footer'])
    if opts.get('volume'): footer_parts.append(opts['volume'])
    if opts.get('doi'):    footer_parts.append('DOI: ' + opts['doi'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  LETTER
# ══════════════════════════════════════════════════════════════
def format_letter(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.2, bottom=1.0, left=1.2, right=1.0)
    add_page_border(doc, '5a3010')

    font = get_font(opts, 'letter')
    format_paragraphs(doc, body_font=font, body_size=11, heading_size=13, heading_color='5a3010')

    header_text = opts.get('header') or opts.get('org_name') or ''
    footer_parts = []
    if opts.get('footer'):      footer_parts.append(opts['footer'])
    if opts.get('website_url'): footer_parts.append(opts['website_url'])
    if opts.get('ref_no'):      footer_parts.append('Ref: ' + opts['ref_no'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════
def main():
    doc = Document(input_path)

    if doc_type == 'book':
        format_book(doc, options)
    elif doc_type == 'thesis':
        format_thesis(doc, options)
    elif doc_type == 'research':
        format_research(doc, options)
    elif doc_type == 'letter':
        format_letter(doc, options)
    else:
        format_book(doc, options)

    doc.save(output_path)
    print(f"Done! Saved to: {output_path}")

main()
