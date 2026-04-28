# import sys
# from docx import Document
# from docx.shared import Pt, Inches, RGBColor
# from docx.enum.text import WD_ALIGN_PARAGRAPH
# from docx.oxml.ns import qn
# from docx.oxml import OxmlElement

# def add_border(doc):
#     """Page border add karta hai"""
#     for section in doc.sections:
#         sectPr = section._sectPr
#         pgBorders = OxmlElement('w:pgBorders')
#         pgBorders.set(qn('w:offsetFrom'), 'page')
#         for border_name in ['top', 'left', 'bottom', 'right']:
#             border = OxmlElement(f'w:{border_name}')
#             border.set(qn('w:val'), 'single')
#             border.set(qn('w:sz'), '18')
#             border.set(qn('w:space'), '24')
#             border.set(qn('w:color'), '2E4057')
#             pgBorders.append(border)
#         sectPr.append(pgBorders)

# def format_doc(input_path, output_path):
#     doc = Document(input_path)
    
#     # Page border
#     add_border(doc)
    
#     # Har paragraph format karo
#     for para in doc.paragraphs:
#         if not para.text.strip():
#             continue
        
#         # Heading detect karo
#         if para.style.name.startswith('Heading') or para.text.isupper():
#             para.alignment = WD_ALIGN_PARAGRAPH.CENTER
#             for run in para.runs:
#                 run.bold = True
#                 run.font.size = Pt(14)
#                 run.font.color.rgb = RGBColor(0x2E, 0x40, 0x57)
#         else:
#             # Normal text — justify alignment
#             para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
#             for run in para.runs:
#                 run.font.size = Pt(11)
#                 run.font.name = 'Calibri'
    
#     # Margins set karo
#     for section in doc.sections:
#         section.top_margin = Inches(1)
#         section.bottom_margin = Inches(1)
#         section.left_margin = Inches(1.2)
#         section.right_margin = Inches(1.2)
    
#     doc.save(output_path)
#     print("Done!")

# format_doc(sys.argv[1], sys.argv[2])










import sys
import json
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ── Arguments ──────────────────────────────────────────────
input_path  = sys.argv[1]
output_path = sys.argv[2]
doc_type    = sys.argv[3] if len(sys.argv) > 3 else 'book'
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

# ── Helper: Page Border ─────────────────────────────────────
def add_page_border(doc, color='2E4057'):
    for section in doc.sections:
        sectPr = section._sectPr
        # Remove existing borders if any
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
        if not header.paragraphs:
            p = header.add_paragraph()
        else:
            p = header.paragraphs[0]
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
        if not footer.paragraphs:
            p = footer.add_paragraph()
        else:
            p = footer.paragraphs[0]
        p.clear()
        run = p.add_run(text)
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x6a, 0x5e, 0x4e)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── Helper: Set Margins ─────────────────────────────────────
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
        is_heading = para.style.name.startswith('Heading') or para.text.strip().isupper()
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
#  BOOK FORMATTING
# ══════════════════════════════════════════════════════════════
def format_book(doc, opts):
    set_margins(doc, top=1.0, bottom=1.0, left=1.5, right=1.0)
    add_page_border(doc, '2E4057')
    format_paragraphs(doc, body_font='Garamond', body_size=12, heading_size=16)

    header_text = opts.get('header') or opts.get('title') or ''
    footer_parts = []
    if opts.get('footer'):       footer_parts.append(opts['footer'])
    if opts.get('volume'):       footer_parts.append(opts['volume'])
    if opts.get('website_url'):  footer_parts.append(opts['website_url'])
    if opts.get('isbn'):         footer_parts.append('ISBN: ' + opts['isbn'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  THESIS FORMATTING
# ══════════════════════════════════════════════════════════════
def format_thesis(doc, opts):
    set_margins(doc, top=1.2, bottom=1.0, left=1.5, right=1.0)
    add_page_border(doc, '1a1a5e')
    format_paragraphs(doc, body_font='Times New Roman', body_size=12, heading_size=14, heading_color='1a1a5e')

    header_parts = []
    if opts.get('university'):  header_parts.append(opts['university'])
    if opts.get('department'):  header_parts.append(opts['department'])
    header_text = opts.get('header') or ' — '.join(header_parts)

    footer_parts = []
    if opts.get('footer'):      footer_parts.append(opts['footer'])
    if opts.get('supervisor'):  footer_parts.append('Supervisor: ' + opts['supervisor'])
    if opts.get('year'):        footer_parts.append(opts['year'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  RESEARCH PAPER FORMATTING
# ══════════════════════════════════════════════════════════════
def format_research(doc, opts):
    set_margins(doc, top=1.0, bottom=1.0, left=1.0, right=1.0)
    add_page_border(doc, '1a4a2a')
    format_paragraphs(doc, body_font='Arial', body_size=11, heading_size=13, heading_color='1a4a2a')

    header_text = opts.get('header') or opts.get('journal') or ''
    footer_parts = []
    if opts.get('footer'):      footer_parts.append(opts['footer'])
    if opts.get('volume'):      footer_parts.append(opts['volume'])
    if opts.get('doi'):         footer_parts.append('DOI: ' + opts['doi'])

    set_header(doc, header_text)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '')

# ══════════════════════════════════════════════════════════════
#  LETTER / NOTICE FORMATTING
# ══════════════════════════════════════════════════════════════
def format_letter(doc, opts):
    set_margins(doc, top=1.2, bottom=1.0, left=1.2, right=1.0)
    add_page_border(doc, '5a3010')
    format_paragraphs(doc, body_font='Calibri', body_size=11, heading_size=13, heading_color='5a3010')

    header_text = opts.get('header') or opts.get('org_name') or ''
    footer_parts = []
    if opts.get('footer'):       footer_parts.append(opts['footer'])
    if opts.get('website_url'):  footer_parts.append(opts['website_url'])
    if opts.get('ref_no'):       footer_parts.append('Ref: ' + opts['ref_no'])

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
        format_book(doc, options)  # default

    doc.save(output_path)
    print(f"Done! Saved to: {output_path}")

main()
