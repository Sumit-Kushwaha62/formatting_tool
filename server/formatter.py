import sys
import json
import re
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

# ── Constants ───────────────────────────────────────────────
DEFAULT_FONTS = {
    'book':     'Garamond',
    'thesis':   'Times New Roman',
    'research': 'Arial',
    'letter':   'Calibri',
}

PAGE_SIZES = {
    'A4':     (210, 297),
    'A5':     (148, 210),
    'A3':     (297, 420),
    'Letter': (216, 279),
    'Legal':  (216, 356),
}

ALIGNMENT_MAP = {
    'left':    WD_ALIGN_PARAGRAPH.LEFT,
    'center':  WD_ALIGN_PARAGRAPH.CENTER,
    'right':   WD_ALIGN_PARAGRAPH.RIGHT,
    'justify': WD_ALIGN_PARAGRAPH.JUSTIFY,
}

# ── Heading Detection Patterns ──────────────────────────────
NUMBERED_SUBHEAD_RE = re.compile(r'^\d+(\.\d+)+[\s\.\)]+\S')

CHAPTER_RE = re.compile(
    r'^(CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|'
    r'ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|\d+)|'
    r'INTRODUCTION|CONCLUSION|PREFACE|FOREWORD|ABSTRACT|'
    r'REFERENCES|APPENDIX|BIBLIOGRAPHY|ACKNOWLEDGEMENTS?)',
    re.IGNORECASE
)

# List/bullet/MCQ style names — never justify these
LIST_STYLE_KEYWORDS = ('list', 'bullet', 'number', 'item', 'enumerat')


# ── Smart Alignment Decision ────────────────────────────────
def smart_align(para, text, desired_align, page_width_mm=210, margin_l=1.3, margin_r=1.0):
    """
    Return the best alignment for a paragraph.
    Rules (professional book logic):
      1. If style is a list/bullet style → LEFT always
      2. If text starts with MCQ pattern (A. / B. / 1. / •) → LEFT always
      3. If word count < 6 → LEFT (too few words to justify nicely)
      4. If desired is JUSTIFY but text is very short (< 60 chars) → LEFT
      5. Otherwise → use desired_align
    """
    if desired_align != WD_ALIGN_PARAGRAPH.JUSTIFY:
        return desired_align

    style_name = (para.style.name or '').lower()

    # List styles → always LEFT
    if any(kw in style_name for kw in LIST_STYLE_KEYWORDS):
        return WD_ALIGN_PARAGRAPH.LEFT

    # MCQ / lettered list lines: "A.", "B.", "1.", "•", "-", "–"
    mcq_re = re.compile(r'^([A-Da-d]\.|[•\-–—]|\(\w\)|\d+[\.\)])\s')
    if mcq_re.match(text):
        return WD_ALIGN_PARAGRAPH.LEFT

    words = text.split()
    word_count = len(words)

    # Too few words → justify looks terrible
    if word_count < 7:
        return WD_ALIGN_PARAGRAPH.LEFT

    # Estimate usable line width in chars (avg char ~5.5pt, 12pt font)
    # A4 with margins: ~(210mm - 1.3in*25.4 - 1.0in*25.4) = ~132mm usable ≈ 75 chars at 12pt
    # Use char count heuristic: if text fills less than ~55% of a line → LEFT
    usable_chars = 75  # approx for A4, 12pt, standard margins
    if len(text) < int(usable_chars * 0.55):
        return WD_ALIGN_PARAGRAPH.LEFT

    return WD_ALIGN_PARAGRAPH.JUSTIFY


# ── Paragraph Type Detection ────────────────────────────────
def para_type(para):
    """
    Returns: 'chapter_heading' | 'subheading' | 'minor_heading' | 'list' | 'body'
    """
    style_name = para.style.name if para.style else 'Normal'
    text = para.text.strip()

    if style_name == 'Heading 1' or (bool(CHAPTER_RE.match(text)) and len(text) < 80):
        return 'chapter_heading'

    if style_name in ('Heading 2', 'Heading 3'):
        return 'subheading'

    if style_name.startswith('Heading'):
        return 'minor_heading'

    if any(kw in style_name.lower() for kw in LIST_STYLE_KEYWORDS):
        return 'list'

    # Numbered subheading: 1.1 Title / 2.3.4 Title
    if NUMBERED_SUBHEAD_RE.match(text) and len(text) < 120:
        return 'subheading'

    return 'body'


# ── Core XML Helpers ─────────────────────────────────────────
def apply_line_spacing(para, spacing_str):
    """MS-Word numeric line spacing: 1.0=single, 1.5, 2.0=double etc."""
    try:
        val = float(str(spacing_str).strip())
    except (ValueError, TypeError):
        val = 1.5
    pPr = para._p.get_or_add_pPr()
    sp = pPr.find(qn('w:spacing'))
    if sp is None:
        sp = OxmlElement('w:spacing')
        pPr.append(sp)
    # Preserve before/after if already set
    sp.set(qn('w:line'), str(round(val * 240)))
    sp.set(qn('w:lineRule'), 'auto')


def set_para_spacing(para, before_pt=0, after_pt=6):
    pPr = para._p.get_or_add_pPr()
    sp = pPr.find(qn('w:spacing'))
    if sp is None:
        sp = OxmlElement('w:spacing')
        pPr.append(sp)
    if before_pt is not None:
        sp.set(qn('w:before'), str(int(before_pt * 20)))
    if after_pt is not None:
        sp.set(qn('w:after'), str(int(after_pt * 20)))


def apply_word_spacing(run, spacing_twips):
    if not spacing_twips:
        return
    rPr = run._r.get_or_add_rPr()
    for old in rPr.findall(qn('w:spacing')):
        rPr.remove(old)
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:val'), str(int(spacing_twips)))
    rPr.append(sp)


def style_run(run, font_name, size_pt, bold=False, italic=False, color_rgb=None):
    run.font.name   = font_name
    run.font.size   = Pt(size_pt)
    run.bold        = bold
    run.italic      = italic
    if color_rgb:
        run.font.color.rgb = RGBColor(*color_rgb)


# ── Option Parsers ───────────────────────────────────────────
def get_font(opts, dt):
    return opts.get('font_style') or DEFAULT_FONTS.get(dt, 'Calibri')

def get_alignment(opts, default='justify'):
    return ALIGNMENT_MAP.get(opts.get('alignment', default).lower(),
                              WD_ALIGN_PARAGRAPH.JUSTIFY)

def parse_word_spacing(opts):
    raw = opts.get('word_spacing', 'normal')
    legacy = {'normal': 0, 'wide': 20, 'wider': 40, 'widest': 80}
    if isinstance(raw, str) and raw.lower() in legacy:
        return legacy[raw.lower()]
    try:
        return int(float(raw) * 20)
    except (ValueError, TypeError):
        return 0

def apply_page_size(doc, size_key='A4'):
    size = PAGE_SIZES.get(size_key, PAGE_SIZES['A4'])
    for section in doc.sections:
        section.page_width  = Mm(size[0])
        section.page_height = Mm(size[1])

def set_margins(doc, top=1.0, bottom=1.0, left=1.3, right=1.0):
    for section in doc.sections:
        section.top_margin    = Inches(top)
        section.bottom_margin = Inches(bottom)
        section.left_margin   = Inches(left)
        section.right_margin  = Inches(right)


# ── Page Border (thesis/research/letter only) ────────────────
def _add_page_border(doc, color='2E4057'):
    for section in doc.sections:
        sectPr = section._sectPr
        for ex in sectPr.findall(qn('w:pgBorders')):
            sectPr.remove(ex)
        pgBorders = OxmlElement('w:pgBorders')
        pgBorders.set(qn('w:offsetFrom'), 'page')
        for side in ['top', 'left', 'bottom', 'right']:
            b = OxmlElement(f'w:{side}')
            b.set(qn('w:val'), 'single')
            b.set(qn('w:sz'), '18')
            b.set(qn('w:space'), '24')
            b.set(qn('w:color'), color)
            pgBorders.append(b)
        sectPr.append(pgBorders)


# ── Header / Footer ──────────────────────────────────────────
def set_header(doc, text, font_name='Calibri', color_hex='6a5e4e'):
    if not text:
        return
    rgb = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
    for section in doc.sections:
        section.different_first_page_header_footer = False
        header = section.header
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.clear()
        run = p.add_run(text)
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(*rgb)
        run.font.name = font_name
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # thin bottom border
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        bot = OxmlElement('w:bottom')
        bot.set(qn('w:val'), 'single'); bot.set(qn('w:sz'), '4')
        bot.set(qn('w:space'), '1');    bot.set(qn('w:color'), 'D1D5DB')
        pBdr.append(bot); pPr.append(pBdr)


def set_footer(doc, text, show_page_numbers=False,
               page_position='center', font_name='Calibri'):
    align_map = {'left': WD_ALIGN_PARAGRAPH.LEFT,
                 'center': WD_ALIGN_PARAGRAPH.CENTER,
                 'right': WD_ALIGN_PARAGRAPH.RIGHT}
    for section in doc.sections:
        footer = section.footer
        p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        p.clear()
        p.alignment = align_map.get(page_position, WD_ALIGN_PARAGRAPH.CENTER)

        if text:
            r = p.add_run(text)
            r.font.size = Pt(9)
            r.font.color.rgb = RGBColor(0x6a, 0x5e, 0x4e)
            r.font.name = font_name

        if show_page_numbers:
            if text:
                sep = p.add_run('  |  ')
                sep.font.size = Pt(9)
                sep.font.color.rgb = RGBColor(0xaa, 0xaa, 0xaa)
            for fld, clr in [(' PAGE ', (0x6a,0x5e,0x4e)),
                              (None, None),
                              (' NUMPAGES ', (0x6a,0x5e,0x4e))]:
                if fld is None:
                    x = p.add_run(' of '); x.font.size = Pt(9)
                    x.font.color.rgb = RGBColor(0xaa, 0xaa, 0xaa); continue
                rr = p.add_run(); rr.font.size = Pt(9)
                rr.font.color.rgb = RGBColor(*clr); rr.font.name = font_name
                fc1 = OxmlElement('w:fldChar'); fc1.set(qn('w:fldCharType'), 'begin')
                it  = OxmlElement('w:instrText'); it.text = fld
                fc2 = OxmlElement('w:fldChar'); fc2.set(qn('w:fldCharType'), 'end')
                rr._r.append(fc1); rr._r.append(it); rr._r.append(fc2)

        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        top = OxmlElement('w:top')
        top.set(qn('w:val'), 'single'); top.set(qn('w:sz'), '4')
        top.set(qn('w:space'), '1');    top.set(qn('w:color'), 'D1D5DB')
        pBdr.append(top); pPr.append(pBdr)


# ══════════════════════════════════════════════════════════════
#  MASTER PARAGRAPH FORMATTER
#  Used by all doc types — doc_type controls heading style
# ══════════════════════════════════════════════════════════════
def format_all_paragraphs(doc,
                           body_font='Garamond',
                           body_size=12,
                           heading_color='111111',
                           body_alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
                           word_spacing_twips=0,
                           line_spacing='1.5',
                           use_book_headings=True):
    """
    Professional book-quality paragraph formatter.

    Heading hierarchy:
      chapter_heading → CENTER, 16pt, bold  (CHAPTER 1, INTRODUCTION...)
      subheading      → LEFT,   13pt, bold  (1.1 Overview, 2.3 Methods...)
      minor_heading   → LEFT,   12pt, bold+italic
      list            → LEFT,   body_size   (never justify)
      body            → smart_align()       (justify only when line is full enough)
    """
    hc = tuple(int(heading_color[i:i+2], 16) for i in (0, 2, 4))

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            set_para_spacing(para, before_pt=0, after_pt=0)
            continue

        ptype = para_type(para)

        if ptype == 'chapter_heading':
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                style_run(run, body_font, 16, bold=True, color_rgb=hc)
            set_para_spacing(para, before_pt=24, after_pt=12)
            apply_line_spacing(para, '1.0')

        elif ptype == 'subheading':
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in para.runs:
                style_run(run, body_font, 13, bold=True, color_rgb=hc)
            set_para_spacing(para, before_pt=14, after_pt=6)
            apply_line_spacing(para, '1.0')

        elif ptype == 'minor_heading':
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in para.runs:
                style_run(run, body_font, 12, bold=True, italic=True, color_rgb=hc)
            set_para_spacing(para, before_pt=10, after_pt=4)
            apply_line_spacing(para, '1.0')

        elif ptype == 'list':
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in para.runs:
                style_run(run, body_font, body_size)
                if word_spacing_twips:
                    apply_word_spacing(run, word_spacing_twips)
            set_para_spacing(para, before_pt=0, after_pt=3)
            apply_line_spacing(para, line_spacing)

        else:  # body
            # Smart alignment: justify only when line is long enough
            align = smart_align(para, text, body_alignment)
            para.alignment = align
            for run in para.runs:
                style_run(run, body_font, body_size)
                if word_spacing_twips:
                    apply_word_spacing(run, word_spacing_twips)
            set_para_spacing(para, before_pt=0, after_pt=6)
            apply_line_spacing(para, line_spacing)


# ══════════════════════════════════════════════════════════════
#  DOC TYPE FORMATTERS
# ══════════════════════════════════════════════════════════════
def format_book(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.0, bottom=1.0, left=1.3, right=1.0)
    # NO border for book

    font         = get_font(opts, 'book')
    alignment    = get_alignment(opts, 'justify')
    word_spacing = parse_word_spacing(opts)
    line_spacing = str(opts.get('line_spacing', '1.5'))
    show_pg      = opts.get('page_numbers', False)
    pg_pos       = opts.get('page_number_position', 'center')

    format_all_paragraphs(doc, body_font=font, body_size=12,
                          heading_color='111111', body_alignment=alignment,
                          word_spacing_twips=word_spacing, line_spacing=line_spacing,
                          use_book_headings=True)

    header_text  = opts.get('header') or opts.get('title') or ''
    footer_parts = [v for v in [
        opts.get('footer'), opts.get('volume'), opts.get('website_url'),
        ('ISBN: ' + opts['isbn']) if opts.get('isbn') else None,
    ] if v]
    set_header(doc, header_text, font_name=font)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '',
               show_page_numbers=show_pg, page_position=pg_pos, font_name=font)


def format_thesis(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.2, bottom=1.0, left=1.5, right=1.0)
    _add_page_border(doc, '1a1a5e')

    font         = get_font(opts, 'thesis')
    alignment    = get_alignment(opts, 'justify')
    word_spacing = parse_word_spacing(opts)
    line_spacing = str(opts.get('line_spacing', '1.5'))
    show_pg      = opts.get('page_numbers', False)
    pg_pos       = opts.get('page_number_position', 'center')

    format_all_paragraphs(doc, body_font=font, body_size=12,
                          heading_color='1a1a5e', body_alignment=alignment,
                          word_spacing_twips=word_spacing, line_spacing=line_spacing)

    header_parts = [v for v in [opts.get('university'), opts.get('department')] if v]
    header_text  = opts.get('header') or ' — '.join(header_parts)
    footer_parts = [v for v in [
        opts.get('footer'),
        ('Supervisor: ' + opts['supervisor']) if opts.get('supervisor') else None,
        opts.get('year'),
    ] if v]
    set_header(doc, header_text, font_name=font)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '',
               show_page_numbers=show_pg, page_position=pg_pos, font_name=font)


def format_research(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.0, bottom=1.0, left=1.0, right=1.0)
    _add_page_border(doc, '1a4a2a')

    font         = get_font(opts, 'research')
    alignment    = get_alignment(opts, 'justify')
    word_spacing = parse_word_spacing(opts)
    line_spacing = str(opts.get('line_spacing', '1.5'))
    show_pg      = opts.get('page_numbers', False)
    pg_pos       = opts.get('page_number_position', 'center')

    format_all_paragraphs(doc, body_font=font, body_size=11,
                          heading_color='1a4a2a', body_alignment=alignment,
                          word_spacing_twips=word_spacing, line_spacing=line_spacing)

    header_text  = opts.get('header') or opts.get('journal') or ''
    footer_parts = [v for v in [
        opts.get('footer'), opts.get('volume'),
        ('DOI: ' + opts['doi']) if opts.get('doi') else None,
    ] if v]
    set_header(doc, header_text, font_name=font)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '',
               show_page_numbers=show_pg, page_position=pg_pos, font_name=font)


def format_letter(doc, opts):
    apply_page_size(doc, opts.get('page_size', 'A4'))
    set_margins(doc, top=1.2, bottom=1.0, left=1.2, right=1.0)
    _add_page_border(doc, '5a3010')

    font         = get_font(opts, 'letter')
    alignment    = get_alignment(opts, 'left')
    word_spacing = parse_word_spacing(opts)
    line_spacing = str(opts.get('line_spacing', '1.5'))
    show_pg      = opts.get('page_numbers', False)
    pg_pos       = opts.get('page_number_position', 'center')

    format_all_paragraphs(doc, body_font=font, body_size=11,
                          heading_color='5a3010', body_alignment=alignment,
                          word_spacing_twips=word_spacing, line_spacing=line_spacing)

    header_text  = opts.get('header') or opts.get('org_name') or ''
    footer_parts = [v for v in [
        opts.get('footer'), opts.get('website_url'),
        ('Ref: ' + opts['ref_no']) if opts.get('ref_no') else None,
    ] if v]
    set_header(doc, header_text, font_name=font)
    set_footer(doc, '  |  '.join(footer_parts) if footer_parts else '',
               show_page_numbers=show_pg, page_position=pg_pos, font_name=font)


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════
def main():
    doc = Document(input_path)
    dispatch = {
        'book':     format_book,
        'thesis':   format_thesis,
        'research': format_research,
        'letter':   format_letter,
    }
    dispatch.get(doc_type, format_book)(doc, options)
    doc.save(output_path)
    print(f"Done! Saved to: {output_path}")

main()
