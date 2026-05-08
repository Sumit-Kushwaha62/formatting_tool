import re
import copy
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from utils import (
    has_drawing, is_all_bold, is_bullet_para,
    apply_para_formatting, apply_bold_before_colon, apply_clean_justify,
    set_font_properly, set_para_font, is_krutidev
)


# ═══════════════════════════
# LETTER HEADER
# ═══════════════════════════

def insert_letter_header(doc, opts, font_name):
    black = RGBColor(0, 0, 0)
    gray  = RGBColor(80, 80, 80)
    dark  = RGBColor(20, 20, 80)

    org_name = opts.get('org_name', '').strip()
    ref_no   = opts.get('ref_no',   '').strip()
    date     = opts.get('date',     '').strip()
    subject  = opts.get('subject',  '').strip()

    if not org_name and not subject:
        return

    insert_paras = []

    def make_para(text, align, size, bold=False, italic=False,
                  space_before=0, space_after=8, color=None):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after  = Pt(space_after)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        if text:
            r = p.add_run(text)
            r.bold   = bold
            r.italic = italic
            set_font_properly(r, font_name)
            r.font.size = Pt(size)
            r.font.color.rgb = color or black
        return p

    if org_name:
        insert_paras.append(make_para(org_name, WD_ALIGN_PARAGRAPH.CENTER,
                                       16, bold=True, color=dark, space_after=4))

    hr = doc.add_paragraph()
    hr.paragraph_format.space_before = Pt(4)
    hr.paragraph_format.space_after  = Pt(10)
    pPr   = hr._p.get_or_add_pPr()
    pBdr  = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'),   'single')
    bottom.set(qn('w:sz'),    '8')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '2222AA')
    pBdr.append(bottom)
    pPr.append(pBdr)
    insert_paras.append(hr)

    if ref_no or date:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after  = Pt(4)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        if ref_no:
            r1 = p.add_run(f'Ref.: {ref_no}')
            r1.bold = True
            set_font_properly(r1, font_name)
            r1.font.size = Pt(11)
            r1.font.color.rgb = black
        if ref_no and date:
            tab_r = p.add_run('\t\t\t\t\t\t')
            set_font_properly(tab_r, font_name)
            tab_r.font.size = Pt(11)
        if date:
            r2 = p.add_run(f'Date: {date}')
            r2.bold = True
            set_font_properly(r2, font_name)
            r2.font.size = Pt(11)
            r2.font.color.rgb = black
        insert_paras.append(p)

    if subject:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(12)
        sp.paragraph_format.space_after  = Pt(12)
        sp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        r_lbl = sp.add_run('Subject: ')
        r_lbl.bold = True
        set_font_properly(r_lbl, font_name)
        r_lbl.font.size = Pt(12)
        r_lbl.font.color.rgb = black
        r_sub = sp.add_run(subject)
        r_sub.bold      = True
        r_sub.underline = True
        set_font_properly(r_sub, font_name)
        r_sub.font.size = Pt(12)
        r_sub.font.color.rgb = dark
        insert_paras.append(sp)

    hr2  = doc.add_paragraph()
    hr2.paragraph_format.space_before = Pt(4)
    hr2.paragraph_format.space_after  = Pt(16)
    pPr2  = hr2._p.get_or_add_pPr()
    pBdr2 = OxmlElement('w:pBdr')
    b2 = OxmlElement('w:bottom')
    b2.set(qn('w:val'),   'single')
    b2.set(qn('w:sz'),    '4')
    b2.set(qn('w:space'), '1')
    b2.set(qn('w:color'), 'AAAACC')
    pBdr2.append(b2)
    pPr2.append(pBdr2)
    insert_paras.append(hr2)

    body = doc.element.body
    for p in reversed(insert_paras):
        body.remove(p._element)
        body.insert(0, p._element)


# ═══════════════════════════
# LETTER STRUCTURE DETECTION
# ═══════════════════════════

def detect_letter_structure(para, index):
    text  = para.text.strip()
    words = text.split()
    wc    = len(words)

    if wc == 0:
        return 'empty'
    if is_bullet_para(para):
        return 'bullet'

    is_bold = is_all_bold(para)

    if re.match(r'^(dear|to|respected|sub|subject)', text.lower()):
        return 'salutation'

    closing_words = ['yours', 'sincerely', 'faithfully', 'regards', 'thanking',
                     'with regards', 'best regards', 'warm regards']
    if any(text.lower().startswith(w) for w in closing_words) and wc <= 5:
        return 'closing'

    if is_bold and wc <= 8 and index > 5:
        return 'signature'

    if is_bold and wc <= 12:
        return 'label'

    return 'body'


def has_existing_letter_header(doc):
    for para in doc.paragraphs[:10]:
        t = para.text.strip()
        if re.match(r'^ref\.?\s*:', t, re.IGNORECASE):
            return True
    return False


def is_ref_date_line(para):
    return bool(re.match(r'^ref\.?\s*:', para.text.strip(), re.IGNORECASE))


def preserve_para_indent(para):
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return None
    ind = pPr.find(qn('w:ind'))
    if ind is None:
        return None
    return copy.deepcopy(ind)


def restore_para_indent(para, saved_ind):
    if saved_ind is None:
        return
    pPr = para._p.get_or_add_pPr()
    existing = pPr.find(qn('w:ind'))
    if existing is not None:
        pPr.remove(existing)
    pPr.append(saved_ind)


# ═══════════════════════════
# LETTER BODY FORMATTING
# ═══════════════════════════

def format_letter_body(doc, opts, font_name):
    black         = RGBColor(0, 0, 0)
    dark          = RGBColor(20, 20, 80)
    krutidev_mode = is_krutidev(font_name)

    for i, para in enumerate(doc.paragraphs):
        if has_drawing(para):
            continue
        text = para.text.strip()
        if not text:
            continue

        if is_ref_date_line(para):
            saved_ind = preserve_para_indent(para)
            if not krutidev_mode:
                set_para_font(para, font_name)
                for run in para.runs:
                    set_font_properly(run, font_name)
                    run.font.size = Pt(11)
            restore_para_indent(para, saved_ind)
            continue

        etype = detect_letter_structure(para, i)
        if etype == 'empty':
            continue

        if etype == 'salutation':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=8, space_after_pt=8)

        elif etype == 'closing':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=False, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=16, space_after_pt=4)

        elif etype == 'signature':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=True, color=dark,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=2, space_after_pt=2)

        elif etype == 'label':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=12, space_after_pt=4)
            if not krutidev_mode and ': ' in para.text:
                apply_bold_before_colon(para, font_name, krutidev_mode)

        elif etype == 'bullet':
            is_bold_para = is_all_bold(para)
            apply_para_formatting(para, etype, font_name,
                font_size_pt=12, bold=is_bold_para, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=0, space_after_pt=4)
            if not krutidev_mode and ': ' in para.text and not is_bold_para:
                apply_bold_before_colon(para, font_name, krutidev_mode)

        else:  # body
            if krutidev_mode:
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=12, bold=False, color=black,
                    align=WD_ALIGN_PARAGRAPH.LEFT,
                    space_before_pt=0, space_after_pt=4)
            else:
                apply_clean_justify(para)
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=12, bold=False, color=black,
                    align=para.alignment,
                    space_before_pt=0, space_after_pt=6)
