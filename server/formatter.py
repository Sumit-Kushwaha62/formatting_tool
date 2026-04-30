import sys
import json
import os
import re
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

PAGE_SIZE_MAP = {
    'A4':     (Mm(210), Mm(297)),
    'A5':     (Mm(148), Mm(210)),
    'A3':     (Mm(297), Mm(420)),
    'Letter': (Mm(215.9), Mm(279.4)),
    'Legal':  (Mm(215.9), Mm(355.6)),
}

# ═══════════════════════════
# PRE-CLEANING
# ═══════════════════════════

def clean_runs_in_para(para):
    for run in para.runs:
        cleaned = run.text.replace('\t', '').replace('\n', ' ')
        cleaned = re.sub(r' {2,}', ' ', cleaned)
        run.text = cleaned

def is_all_bold(para):
    runs = [r for r in para.runs if r.text.strip()]
    return bool(runs) and all(r.bold for r in runs)

def is_bullet_para(para):
    """True if paragraph has a numbering/bullet list marker in XML."""
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return False
    return pPr.find(qn('w:numPr')) is not None

def merge_split_paragraphs(doc):
    paras = doc.paragraphs
    merge_indices = []
    i = 0
    while i < len(paras) - 1:
        p1 = paras[i]
        p2 = paras[i + 1]
        t1 = p1.text.strip()
        t2 = p2.text.strip()
        if t1 and t2:
            b1 = is_all_bold(p1)
            b2 = is_all_bold(p2)
            if b1 == b2 and t1[-1].isalpha() and t2[0].islower():
                merge_indices.append(i)
                i += 2
                continue
        i += 1
    for idx in reversed(merge_indices):
        p1 = doc.paragraphs[idx]
        p2 = doc.paragraphs[idx + 1]
        for run in p2.runs:
            p1._p.append(run._r)
        p2._element.getparent().remove(p2._element)

def clear_pPr_sz(para):
    """Remove any font size override from paragraph-level rPr (pPr > rPr > sz).
    This prevents paragraph-default sz from overriding run-level sz."""
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return
    rPr = pPr.find(qn('w:rPr'))
    if rPr is None:
        return
    for tag in [qn('w:sz'), qn('w:szCs')]:
        el = rPr.find(tag)
        if el is not None:
            rPr.remove(el)

def set_pPr_sz(para, half_pts):
    """Set font size at paragraph-level rPr so it applies as default for all runs."""
    pPr = para._p.get_or_add_pPr()
    rPr = pPr.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        pPr.append(rPr)
    for tag_name in ['w:sz', 'w:szCs']:
        el = rPr.find(qn(tag_name))
        if el is None:
            el = OxmlElement(tag_name)
            rPr.append(el)
        el.set(qn('w:val'), str(half_pts))

def preprocess_document(doc):
    for para in doc.paragraphs:
        clean_runs_in_para(para)
    merge_split_paragraphs(doc)

# ═══════════════════════════
# HELPERS
# ═══════════════════════════

def set_font_properly(run, font_name):
    run.font.name = font_name
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        rFonts.set(qn(f'w:{attr}'), font_name)

def set_para_font(para, font_name):
    """Also set font at paragraph-level rPr (applies as default for all runs)."""
    pPr = para._p.get_or_add_pPr()
    rPr = pPr.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        pPr.append(rPr)
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.insert(0, rFonts)
    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        rFonts.set(qn(f'w:{attr}'), font_name)

def add_run_with_font(para, text, font_name, size_pt, bold=False, color=None):
    run = para.add_run(text)
    run.bold = bold
    set_font_properly(run, font_name)
    run.font.size = Pt(size_pt)
    if color:
        run.font.color.rgb = color
    return run

def add_fld_char(run, fld_type):
    fc = OxmlElement('w:fldChar')
    fc.set(qn('w:fldCharType'), fld_type)
    run._r.append(fc)

def add_instr_text(run, instr):
    it = OxmlElement('w:instrText')
    it.text = instr
    run._r.append(it)

# ═══════════════════════════
# TITLE PAGE
# ═══════════════════════════

def insert_title_page(doc, opts, font_name):
    black = RGBColor(0, 0, 0)
    gray  = RGBColor(100, 100, 100)
    title       = opts.get('title', '').strip()
    author      = opts.get('author', '').strip()
    volume      = opts.get('volume', '').strip()
    isbn        = opts.get('isbn', '').strip()
    website     = opts.get('website_url', '').strip()
    footer_text = opts.get('footer', '').strip()

    if not title and not author:
        return

    insert_paras = []

    def make_para(text, align, size, bold=False, space_before=0, space_after=12, color=None):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after  = Pt(space_after)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
        if text:
            add_run_with_font(p, text, font_name, size, bold=bold, color=color or black)
        return p

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(72)
    spacer.paragraph_format.space_after  = Pt(0)
    insert_paras.append(spacer)

    if title:
        insert_paras.append(make_para(title, WD_ALIGN_PARAGRAPH.CENTER, 28, bold=True, space_after=20))
    if volume:
        insert_paras.append(make_para(volume, WD_ALIGN_PARAGRAPH.CENTER, 14, space_after=14, color=gray))
    if author:
        insert_paras.append(make_para(author, WD_ALIGN_PARAGRAPH.CENTER, 16, bold=True, space_before=10, space_after=14))

    sep = doc.add_paragraph()
    sep.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sep.paragraph_format.space_before = Pt(20)
    sep.paragraph_format.space_after  = Pt(20)
    r = sep.add_run('\u2015 \u2015 \u2015')
    set_font_properly(r, font_name)
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(180, 180, 180)
    insert_paras.append(sep)

    if footer_text:
        insert_paras.append(make_para(footer_text, WD_ALIGN_PARAGRAPH.CENTER, 11, space_after=8, color=gray))
    if website:
        insert_paras.append(make_para(website, WD_ALIGN_PARAGRAPH.CENTER, 10, space_after=8, color=gray))
    if isbn:
        insert_paras.append(make_para(f'ISBN: {isbn}', WD_ALIGN_PARAGRAPH.CENTER, 10, space_after=0, color=gray))

    pb_para = doc.add_paragraph()
    pb_para.paragraph_format.space_before = Pt(0)
    pb_para.paragraph_format.space_after  = Pt(0)
    run = pb_para.add_run()
    br = OxmlElement('w:br')
    br.set(qn('w:type'), 'page')
    run._r.append(br)
    insert_paras.append(pb_para)

    body = doc.element.body
    for p in reversed(insert_paras):
        body.remove(p._element)
        body.insert(0, p._element)

# ═══════════════════════════
# STRUCTURE DETECTION
# ═══════════════════════════

def detect_structure(para, index):
    """Detect paragraph type. Bullet paragraphs are always 'bullet'."""
    text  = para.text.strip()
    words = text.split()
    wc    = len(words)

    if wc == 0:
        return 'empty'

    # Bullet list items — NEVER treat as heading regardless of bold
    if is_bullet_para(para):
        return 'bullet'

    if wc > 20:
        return 'body'

    is_bold = is_all_bold(para)

    chapter_regex = r'^(chapter|unit|part|section|lesson|adhyaay|\u0905\u0927\u094d\u092f\u093e\u092f|\u0907\u0915\u093e\u0908|\u092d\u093e\u0917)\s*([\dIVX]+)?'
    if re.match(chapter_regex, text.lower()):
        return 'chapter_title'

    if re.match(r'^\d+(\.\d+)*[\.\s]', text) and is_bold and wc <= 12:
        return 'subheading'

    if re.match(r'^[a-zA-Z]\)', text) and is_bold and wc <= 10:
        return 'subheading'

    if text.isupper() and wc < 8:
        return 'chapter_title'

    if index < 4 and wc < 8 and is_bold and not text.endswith('.'):
        return 'title'

    if is_bold and wc <= 15:
        return 'subheading'

    return 'body'

# ═══════════════════════════
# JUSTIFY
# ═══════════════════════════

def apply_clean_justify(para):
    """Justify only long lines; short lines stay left-aligned to avoid word gaps."""
    text = para.text.strip()
    word_count = len(text.split())
    # Raised threshold: need 20+ words AND 150+ chars to justify
    if word_count < 20 or len(text) < 150 or text.endswith(('?', ':', '!')):
        para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        return
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pPr = para._p.get_or_add_pPr()
    for jc in pPr.findall(qn('w:jc')):
        pPr.remove(jc)
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'both')
    pPr.append(jc)

# ═══════════════════════════
# APPLY FORMATTING
# ═══════════════════════════

def apply_para_formatting(para, etype, font_name, font_size_pt, bold, color, align,
                           space_before_pt, space_after_pt, first_indent=None):
    """Apply all formatting to a paragraph — both run-level and pPr-level."""
    # pPr-level font + size (paragraph default — overrides inherited styles)
    set_para_font(para, font_name)
    clear_pPr_sz(para)
    set_pPr_sz(para, int(font_size_pt * 2))  # Word uses half-points

    # Spacing
    para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    para.paragraph_format.space_before = Pt(space_before_pt)
    para.paragraph_format.space_after  = Pt(space_after_pt)
    if first_indent is not None:
        para.paragraph_format.first_line_indent = first_indent
    else:
        para.paragraph_format.first_line_indent = None

    # Alignment
    para.alignment = align

    # Run-level (individual runs)
    for run in para.runs:
        run.bold = bold
        set_font_properly(run, font_name)
        run.font.size = Pt(font_size_pt)
        run.font.color.rgb = color

# ═══════════════════════════
# MAIN
# ═══════════════════════════

def format_document(input_file, output_file, opts):
    doc = Document(input_file)
    font_name = opts.get('font_style') or 'Garamond'
    black = RGBColor(0, 0, 0)
    gray  = RGBColor(100, 100, 100)

    # 1. Pre-clean
    preprocess_document(doc)

    # 2. Page Size
    page_size_key = opts.get('page_size', 'A4')
    page_w, page_h = PAGE_SIZE_MAP.get(page_size_key, PAGE_SIZE_MAP['A4'])
    for section in doc.sections:
        section.page_width   = page_w
        section.page_height  = page_h
        section.top_margin    = section.bottom_margin = Inches(0.8)
        section.left_margin   = Inches(1.3)
        section.right_margin  = Inches(0.7)

    # 3. Title page
    insert_title_page(doc, opts, font_name)

    # 4. Format paragraphs
    for i, para in enumerate(doc.paragraphs):
        text = para.text.strip()
        if not text:
            continue

        etype = detect_structure(para, i)
        if etype == 'empty':
            continue

        if etype == 'title':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=28, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.CENTER,
                space_before_pt=72, space_after_pt=36)

        elif etype == 'chapter_title':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=20, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.CENTER,
                space_before_pt=48, space_after_pt=24)

        elif etype == 'subheading':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=13, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=14, space_after_pt=6)

        elif etype == 'bullet':
            # Bullets: normal size, preserve bold if present, no justify
            is_bold = is_all_bold(para)
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=is_bold, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=0, space_after_pt=4)

        else:  # body
            # Determine justify before apply
            apply_clean_justify(para)
            use_indent = para.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=False, color=black,
                align=para.alignment,  # already set by apply_clean_justify
                space_before_pt=0, space_after_pt=8,
                first_indent=Inches(0.3) if use_indent else None)

    # 5. Headers & Footers
    header_text  = opts.get('header', '').strip()
    footer_text  = opts.get('footer', '').strip()
    page_numbers = opts.get('page_numbers', False)
    page_num_pos = opts.get('page_number_position', 'center')
    ALIGN_MAP = {
        'left':   WD_ALIGN_PARAGRAPH.LEFT,
        'center': WD_ALIGN_PARAGRAPH.CENTER,
        'right':  WD_ALIGN_PARAGRAPH.RIGHT,
    }
    num_align = ALIGN_MAP.get(page_num_pos, WD_ALIGN_PARAGRAPH.CENTER)

    for section in doc.sections:
        if header_text:
            hdr_para = section.header.paragraphs[0]
            hdr_para.clear()
            hdr_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = hdr_para.add_run(header_text)
            set_font_properly(r, font_name)
            r.font.size = Pt(9)
            r.font.color.rgb = gray

        ftr = section.footer
        for fp in ftr.paragraphs:
            fp.clear()

        if footer_text:
            ft_para = ftr.paragraphs[0] if ftr.paragraphs else ftr.add_paragraph()
            ft_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = ft_para.add_run(footer_text)
            set_font_properly(r, font_name)
            r.font.size = Pt(9)
            r.font.color.rgb = gray

        if page_numbers:
            pn_para = ftr.add_paragraph()
            pn_para.alignment = num_align
            r1 = pn_para.add_run()
            set_font_properly(r1, font_name)
            r1.font.size = Pt(9)
            r1.font.color.rgb = gray
            add_fld_char(r1, 'begin')
            add_instr_text(r1, ' PAGE ')
            add_fld_char(r1, 'end')
            r2 = pn_para.add_run(' / ')
            set_font_properly(r2, font_name)
            r2.font.size = Pt(9)
            r2.font.color.rgb = gray
            r3 = pn_para.add_run()
            set_font_properly(r3, font_name)
            r3.font.size = Pt(9)
            r3.font.color.rgb = gray
            add_fld_char(r3, 'begin')
            add_instr_text(r3, ' NUMPAGES ')
            add_fld_char(r3, 'end')

    doc.save(output_file)


if __name__ == '__main__':
    in_p   = sys.argv[1]
    out_p  = sys.argv[2]
    type_d = sys.argv[3]
    opts_f = sys.argv[4]

    options = {}
    if os.path.exists(opts_f) and os.path.getsize(opts_f) > 0:
        with open(opts_f, 'r', encoding='utf-8') as f:
            options = json.load(f)

    format_document(in_p, out_p, options)
    print(f'Success: {out_p}')
