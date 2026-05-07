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
# DRAWING / IMAGE DETECTION
# ═══════════════════════════

WP_NS  = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
MC_NS  = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
W_NS   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

def has_drawing(para):
    """Return True if paragraph contains any image/chart/drawing/object element.
    These paragraphs must NEVER be touched by formatting logic."""
    p = para._p

    # Search all descendants for drawing/image/object tags
    for tag in [qn('w:drawing'), qn('w:pict'), qn('w:object')]:
        if p.find('.//' + tag) is not None:
            return True

    # AlternateContent (charts, SmartArt, etc.)
    if p.find(f'{{{MC_NS}}}AlternateContent') is not None:
        return True

    return False


# ═══════════════════════════
# PRE-CLEANING
# ═══════════════════════════

def clean_runs_in_para(para):
    for run in para.runs:
        cleaned = run.text.replace('\t', '').replace('\n', ' ')
        cleaned = re.sub(r' {2,}', ' ', cleaned)
        run.text = cleaned


def remove_proof_errors(para):
    """Remove <w:proofErr> elements that cause word splits during run iteration."""
    p = para._p
    for proof_err in p.findall(qn('w:proofErr')):
        p.remove(proof_err)


def run_has_drawing(run):
    """Return True if this run contains any drawing/image element."""
    r = run._r
    if r.find(qn('w:drawing')) is not None:
        return True
    if r.find(qn('w:pict')) is not None:
        return True
    if r.find(qn('w:object')) is not None:
        return True
    return False


def merge_runs_in_para(para):
    """Merge adjacent runs with identical formatting to prevent mid-word splits.
    NEVER merges runs that contain drawings/images."""
    if len(para.runs) <= 1:
        return

    i = 0
    while i < len(para.runs) - 1:
        r1 = para.runs[i]
        r2 = para.runs[i + 1]

        # Never touch runs that contain drawings
        if run_has_drawing(r1) or run_has_drawing(r2):
            i += 1
            continue

        def fmt_sig(run):
            rPr = run._element.find(qn('w:rPr'))
            if rPr is None:
                return ('', None, None, None, None)
            bold   = rPr.find(qn('w:b'))
            italic = rPr.find(qn('w:i'))
            sz     = rPr.find(qn('w:sz'))
            color  = rPr.find(qn('w:color'))
            rFonts = rPr.find(qn('w:rFonts'))
            b_val     = None if bold   is None else bold.get(qn('w:val'), 'true')
            i_val     = None if italic is None else italic.get(qn('w:val'), 'true')
            sz_val    = None if sz     is None else sz.get(qn('w:val'))
            color_val = None if color  is None else color.get(qn('w:val'))
            font_val  = None if rFonts is None else rFonts.get(qn('w:ascii'))
            return (b_val, i_val, sz_val, color_val, font_val)

        if fmt_sig(r1) == fmt_sig(r2):
            r1.text = (r1.text or '') + (r2.text or '')
            r2._r.getparent().remove(r2._r)
        else:
            i += 1


def is_all_bold(para):
    runs = [r for r in para.runs if r.text.strip()]
    return bool(runs) and all(r.bold for r in runs)


def is_bullet_para(para):
    """True if paragraph has a numbering/bullet list marker in XML."""
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return False
    return pPr.find(qn('w:numPr')) is not None


def apply_bold_before_colon(para, font_name, krutidev_mode):
    """If para has 'Label: rest' pattern, make text before ':' bold."""
    text = para.text
    colon_idx = text.find(':')
    if colon_idx <= 0 or colon_idx > 80:
        return

    label = text[:colon_idx + 1]
    rest  = text[colon_idx + 1:]

    first_run = para.runs[0] if para.runs else None
    size_pt = None
    if first_run:
        size_pt = first_run.font.size

    for run in list(para.runs):
        run._r.getparent().remove(run._r)

    r_bold = para.add_run(label)
    r_bold.bold = True
    if not krutidev_mode:
        set_font_properly(r_bold, font_name)
        if size_pt:
            r_bold.font.size = size_pt
        r_bold.font.color.rgb = RGBColor(0, 0, 0)

    if rest:
        r_rest = para.add_run(rest)
        r_rest.bold = False
        if not krutidev_mode:
            set_font_properly(r_rest, font_name)
            if size_pt:
                r_rest.font.size = size_pt
            r_rest.font.color.rgb = RGBColor(0, 0, 0)


def merge_split_paragraphs(doc):
    pass  # Disabled — causes duplicate rendering with mixed fonts


def clear_pPr_sz(para):
    """Remove font size override from paragraph-level rPr."""
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
    """Set font size at paragraph-level rPr."""
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


def clear_para_indent(para):
    """Remove all left/first-line indent from paragraph XML — prevents inherited indent."""
    pPr = para._p.get_or_add_pPr()
    ind = pPr.find(qn('w:ind'))
    if ind is not None:
        pPr.remove(ind)
    para.paragraph_format.left_indent        = None
    para.paragraph_format.first_line_indent  = None


def preprocess_document(doc):
    for para in doc.paragraphs:
        if has_drawing(para):
            continue  # never touch image paragraphs
        remove_proof_errors(para)
        clean_runs_in_para(para)
        merge_runs_in_para(para)
    merge_split_paragraphs(doc)


# ═══════════════════════════
# HELPERS
# ═══════════════════════════

KRUTIDEV_FONTS = {'Kruti Dev 010', 'Kruti Dev 011', 'Krutidev010', 'Krutidev011',
                  'KrutiDev010', 'KrutiDev011', 'Kruti Dev010', 'Kruti Dev011'}

FONT_NAME_MAP = {
    'Krutidev010': 'Kruti Dev 010',
    'Krutidev011': 'Kruti Dev 011',
    'Mangal':      'Mangal',
    'Kokila':      'Kokila',
    'Utsaah':      'Utsaah',
    'Aparajita':   'Aparajita',
    'Nirmala UI':  'Nirmala UI',
}


# ═══════════════════════════
# HINDI CONVERSION (UNICODE TO KRUTIDEV)
# ═══════════════════════════

def unicode_to_krutidev(text):
    """Convert Unicode Devanagari text to Kruti Dev 010 ASCII encoding."""
    if not text:
        return ""
    if not re.search(r'[\u0900-\u097F]', text):
        return text

    HALANT = '\u094D'

    CONJUNCTS = [
        ('\u0915\u094D\u0937', '{k'),
        ('\u0924\u094D\u0930', '\u00d8'),
        ('\u091C\u094D\u091E', 'K'),
        ('\u0936\u094D\u0930', 'J'),
        ('\u092A\u094D\u0930', 'iz'),
        ('\u0917\u094D\u0930', 'xz'),
        ('\u0915\u094D\u0930', 'dz'),
        ('\u092C\u094D\u0930', 'cz'),
        ('\u092E\u094D\u0930', 'ez'),
        ('\u091F\u094D\u0930', 'Vz'),
        ('\u0921\u094D\u0930', 'Mz'),
        ('\u0927\u094D\u0930', '/z'),
        ('\u0939\u094D\u0930', 'gz'),
        ('\u092D\u094D\u0930', 'Hkz'),
        ('\u0926\u094D\u092F', '|'),
        ('\u0926\u094D\u0927', '/~/k'),
        ('\u0926\u094D\u0935', 'n~o'),
        ('\u0924\u094D\u0924', '\u00d9k'),
        ('\u0924\u094D\u0915', 'Rd'),
        ('\u0924\u094D\u092A', 'Ri'),
        ('\u0924\u094D\u0938', 'Rl'),
        ('\u0938\u094D\u0924', 'Lr'),
        ('\u0938\u094D\u0925', 'LFk'),
        ('\u0938\u094D\u0928', 'Lu'),
        ('\u0928\u094D\u0924', 'Ur'),
        ('\u0928\u094D\u0926', 'Un'),
        ('\u0928\u094D\u0928', 'Uu'),
        ('\u0937\u094D\u091F', '"V'),
        ('\u0937\u094D\u0920', '"B'),
        ('\u0936\u094D\u0935', "'o"),
        ('\u0936\u094D\u0928', "'u"),
        ('\u0932\u094D\u0932', 'Yy'),
    ]
    for uni, kd in CONJUNCTS:
        text = text.replace(uni, kd)

    C = {
        'अ': 'v',  'आ': 'vk', 'इ': 'b',  'ई': 'bZ',
        'उ': 'm',  'ऊ': 'Å',  'ए': ',',  'ऐ': ',s',
        'ओ': 'vks','औ': 'vkS',
        'ा': 'k',  'ि': 'f',  'ी': 'h',  'ु': 'q',
        'ू': 'w',  'ृ': '`',  'े': 's',  'ै': 'S',
        'ो': 'ks', 'ौ': 'kS', 'ं': 'a',  'ः': '%',  'ँ': '\u00a1',
        'क': 'd',  'ख': '[k', 'ग': 'x',  'घ': '?k', 'ङ': 'M~',
        'च': 'p',  'छ': 'N',  'ज': 't',  'झ': '>k', 'ञ': '\u00a5',
        'ट': 'V',  'ठ': 'B',  'ड': 'M',  'ढ': '<',  'ण': '.k',
        'त': 'r',  'थ': 'Fk', 'द': 'n',  'ध': '/k', 'न': 'u',
        'प': 'i',  'फ': 'Q',  'ब': 'c',  'भ': 'Hk', 'म': 'e',
        'य': ';',  'र': 'j',  'ल': 'y',  'व': 'o',
        'श': "'k", 'ष': '"k', 'स': 'l',  'ह': 'g',
        'क़': 'd+','ख़': '[k+','ग़': 'x+','ज़': 't+',
        'ड़': 'M+','ढ़': '<+','फ़': 'Q+',
        '।': 'A',  '॥': 'AA',
        '०': ')',  '१': '!',  '२': '@',  '३': '#',  '४': '$',
        '५': '%',  '६': '^',  '७': '&',  '८': '*',  '९': '(',
    }

    HALF = {
        'क': 'D',  'ख': '[',  'ग': 'X',  'घ': '?',
        'च': 'P',  'ज': 'T',  'झ': '>',
        'ट': 'V~', 'ड': 'M~', 'ण': '.k~',
        'त': 'R',  'थ': 'F',  'द': 'n~', 'ध': '/',
        'न': 'U',  'प': 'I',  'ब': 'C',  'भ': 'H',
        'म': 'E',  'य': 'Y',  'र': 'z',
        'ल': 'y~', 'व': 'O',
        'श': "'",  'ष': '"',  'स': 'L',  'ह': 'g~',
        'ञ': '\u00a5~',
    }

    VOWELS = set('अआइईउऊएऐओऔ')
    MATRAS = set('ािीुूृेैोौंःँ')

    result = []
    chars  = list(text)
    n      = len(chars)
    i      = 0

    while i < n:
        c = chars[i]

        if ord(c) < 0x900 or ord(c) > 0x97F:
            result.append(c)
            i += 1
            continue

        if c == 'र' and i + 1 < n and chars[i + 1] == HALANT:
            if i + 2 < n and chars[i + 2] in C and chars[i + 2] not in VOWELS:
                i += 2
                syl = []
                nc  = chars[i]
                if i + 1 < n and chars[i + 1] == HALANT and nc in HALF:
                    syl.append(HALF[nc])
                    i += 2
                elif i + 1 < n and chars[i + 1] == 'ि':
                    syl.append('f')
                    syl.append(C.get(nc, nc))
                    i += 2
                else:
                    syl.append(C.get(nc, nc))
                    i += 1
                while i < n and chars[i] in MATRAS:
                    syl.append(C.get(chars[i], chars[i]))
                    i += 1
                syl.append('Z')
                result.extend(syl)
                continue

        if c in HALF and i + 1 < n and chars[i + 1] == HALANT:
            result.append(HALF[c])
            i += 2
            continue

        if c in C and c not in VOWELS and c not in MATRAS:
            if i + 1 < n and chars[i + 1] == 'ि':
                result.append('f')
                result.append(C.get(c, c))
                i += 2
                continue

        result.append(C.get(c, c))
        i += 1

    return ''.join(result)


def is_krutidev(font_name):
    return font_name and any(k.lower() in font_name.lower() for k in ['kruti', 'krutidev'])


def has_unicode_hindi(text):
    return bool(re.search(r'[\u0900-\u097F]', text))


def set_font_properly(run, font_name, size_pt=None):
    formal_name = FONT_NAME_MAP.get(font_name, font_name)
    run.font.name = formal_name

    r    = run._element
    rPr  = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()

    if is_krutidev(formal_name):
        rFonts.set(qn('w:hint'), 'default')
    else:
        rFonts.set(qn('w:hint'), 'complex')

    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        rFonts.set(qn(f'w:{attr}'), formal_name)

    lang = rPr.find(qn('w:lang'))
    if lang is None:
        lang = OxmlElement('w:lang')
        rPr.append(lang)

    if is_krutidev(formal_name):
        lang.set(qn('w:val'),   'en-US')
        lang.set(qn('w:ascii'), 'en-US')
        lang.set(qn('w:hAnsi'), 'en-US')
        lang.set(qn('w:bidi'),  'hi-IN')
    else:
        lang.set(qn('w:val'), 'hi-IN')
        lang.set(qn('w:cs'),  'hi-IN')

    if size_pt:
        run.font.size = Pt(size_pt)
        sz_cs = rPr.find(qn('w:szCs'))
        if sz_cs is None:
            sz_cs = OxmlElement('w:szCs')
            rPr.append(sz_cs)
        sz_cs.set(qn('w:val'), str(int(size_pt * 2)))


def set_para_font(para, font_name):
    """Set font at paragraph-level rPr."""
    formal_name = FONT_NAME_MAP.get(font_name, font_name)
    pPr  = para._p.get_or_add_pPr()
    rPr  = pPr.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        pPr.append(rPr)

    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.insert(0, rFonts)

    if is_krutidev(formal_name):
        rFonts.set(qn('w:hint'), 'default')

    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        rFonts.set(qn(f'w:{attr}'), formal_name)

    lang = rPr.find(qn('w:lang'))
    if lang is None:
        lang = OxmlElement('w:lang')
        rPr.append(lang)
    if is_krutidev(formal_name):
        lang.set(qn('w:val'), 'en-US')
    else:
        lang.set(qn('w:val'), 'hi-IN')


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
# JUSTIFY HELPER
# ═══════════════════════════

def apply_clean_justify(para):
    """Justify only long paragraphs. Short lines stay LEFT to avoid ugly word gaps."""
    text  = para.text.strip()
    words = text.split()
    # Must have 12+ words AND 100+ chars AND not end with a break punctuation
    if len(words) < 12 or len(text) < 100 or text.endswith(('?', ':', '!', ';')):
        para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        return
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pPr = para._p.get_or_add_pPr()
    for jc in pPr.findall(qn('w:jc')):
        pPr.remove(jc)
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'both')
    pPr.append(jc)


def get_original_alignment(para):
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return None
    jc = pPr.find(qn('w:jc'))
    if jc is None:
        return None
    val = jc.get(qn('w:val'))
    mapping = {
        'center': WD_ALIGN_PARAGRAPH.CENTER,
        'right':  WD_ALIGN_PARAGRAPH.RIGHT,
        'both':   WD_ALIGN_PARAGRAPH.JUSTIFY,
        'left':   WD_ALIGN_PARAGRAPH.LEFT,
    }
    return mapping.get(val)


# ═══════════════════════════
# CORE FORMATTING ENGINE
# ═══════════════════════════

def apply_para_formatting(para, etype, font_name, font_size_pt, bold, color, align,
                           space_before_pt, space_after_pt,
                           first_indent=None, left_indent=None,
                           line_spacing=1.15):
    """Apply all formatting to a paragraph — run-level and pPr-level.
    For chapter_heading / chapter_title etypes, font_name is NOT applied to runs
    (those headings keep original font or document default)."""
    # Chapter/title headings: skip font override so user font change doesn't affect them
    skip_font = etype in ('chapter_heading', 'chapter_title', 'book_title')

    if not skip_font:
        set_para_font(para, font_name)
    clear_pPr_sz(para)
    set_pPr_sz(para, int(font_size_pt * 2))

    # Spacing
    para.paragraph_format.space_before = Pt(space_before_pt)
    para.paragraph_format.space_after  = Pt(space_after_pt)
    pPr = para._p.get_or_add_pPr()
    spacing = pPr.find(qn('w:spacing'))
    if spacing is None:
        spacing = OxmlElement('w:spacing')
        pPr.append(spacing)
    spacing.set(qn('w:before'),            str(int(space_before_pt * 20)))
    spacing.set(qn('w:after'),             str(int(space_after_pt  * 20)))
    spacing.set(qn('w:beforeAutospacing'), '0')
    spacing.set(qn('w:afterAutospacing'),  '0')

    # Line spacing
    try:
        ls = float(line_spacing)
    except Exception:
        ls = 1.15

    if ls == 1.0:
        para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    elif ls == 2.0:
        para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
    else:
        para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        para.paragraph_format.line_spacing = ls

    # Indent — always set explicitly to avoid inherited garbage
    ind = pPr.find(qn('w:ind'))
    if ind is not None:
        pPr.remove(ind)

    if first_indent is not None or left_indent is not None:
        ind = OxmlElement('w:ind')
        if left_indent is not None:
            ind.set(qn('w:left'), str(int(left_indent * 1440)))
        if first_indent is not None:
            # Inches → twips (1440 twips = 1 inch)
            twips = int(first_indent * 1440) if isinstance(first_indent, float) else int(first_indent.inches * 1440)
            ind.set(qn('w:firstLine'), str(twips))
        pPr.append(ind)
    else:
        # Explicit zero — kills any inherited indent
        para.paragraph_format.first_line_indent = None
        para.paragraph_format.left_indent       = None

    # Alignment
    para.alignment = align

    # Run-level
    for run in para.runs:
        if run_has_drawing(run):
            continue  # never reformat drawing/image runs
        run.bold = bold
        if not skip_font:
            set_font_properly(run, font_name, font_size_pt)
        else:
            # Still set size even for chapter headings
            run.font.size = Pt(font_size_pt)
        run.font.color.rgb = color


# ═══════════════════════════
# TITLE PAGE — BOOK
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
    br  = OxmlElement('w:br')
    br.set(qn('w:type'), 'page')
    run._r.append(br)
    insert_paras.append(pb_para)

    body = doc.element.body
    for p in reversed(insert_paras):
        body.remove(p._element)
        body.insert(0, p._element)


# ═══════════════════════════
# TITLE PAGE — THESIS
# ═══════════════════════════

def insert_thesis_title_page(doc, opts, font_name):
    black = RGBColor(0, 0, 0)
    title      = opts.get('title', '').strip()
    author     = opts.get('author', '').strip()
    university = opts.get('university', '').strip()
    department = opts.get('department', '').strip()
    supervisor = opts.get('supervisor', '').strip()
    year       = opts.get('year', '').strip()

    if not title and not author:
        return

    insert_paras = []

    def make_para(text, align, size, bold=False, italic=False,
                  space_before=0, space_after=10, color=None):
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

    def add_horizontal_rule(thick=False):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after  = Pt(6)
        pPr   = p._p.get_or_add_pPr()
        pBdr  = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'),   'single')
        bottom.set(qn('w:sz'),    '12' if thick else '6')
        bottom.set(qn('w:space'), '1')
        bottom.set(qn('w:color'), '000000')
        pBdr.append(bottom)
        pPr.append(pBdr)
        return p

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(36)
    spacer.paragraph_format.space_after  = Pt(0)
    insert_paras.append(spacer)

    if university:
        insert_paras.append(make_para(university, WD_ALIGN_PARAGRAPH.CENTER, 16, bold=True, space_after=4))
    if department:
        insert_paras.append(make_para(department, WD_ALIGN_PARAGRAPH.CENTER, 12, space_after=20))

    insert_paras.append(add_horizontal_rule(thick=True))

    sp2 = doc.add_paragraph()
    sp2.paragraph_format.space_before = Pt(24)
    sp2.paragraph_format.space_after  = Pt(0)
    insert_paras.append(sp2)

    insert_paras.append(make_para('A Thesis Submitted in Partial Fulfillment of the',
                                   WD_ALIGN_PARAGRAPH.CENTER, 11, italic=True, space_after=2))
    insert_paras.append(make_para('Requirements for the Degree',
                                   WD_ALIGN_PARAGRAPH.CENTER, 11, italic=True, space_after=24))

    if title:
        insert_paras.append(make_para(title, WD_ALIGN_PARAGRAPH.CENTER, 22, bold=True,
                                       space_before=8, space_after=28))

    insert_paras.append(add_horizontal_rule(thick=False))

    insert_paras.append(make_para('Submitted by', WD_ALIGN_PARAGRAPH.CENTER, 10, italic=True,
                                   space_before=20, space_after=4))
    if author:
        insert_paras.append(make_para(author, WD_ALIGN_PARAGRAPH.CENTER, 15, bold=True, space_after=4))

    if supervisor:
        insert_paras.append(make_para('Under the Supervision of', WD_ALIGN_PARAGRAPH.CENTER,
                                       10, italic=True, space_before=16, space_after=4))
        insert_paras.append(make_para(supervisor, WD_ALIGN_PARAGRAPH.CENTER, 13, bold=True, space_after=4))

    if year:
        insert_paras.append(make_para(year, WD_ALIGN_PARAGRAPH.CENTER, 12, space_before=20, space_after=0))

    pb_para = doc.add_paragraph()
    pb_para.paragraph_format.space_before = Pt(0)
    pb_para.paragraph_format.space_after  = Pt(0)
    run = pb_para.add_run()
    br  = OxmlElement('w:br')
    br.set(qn('w:type'), 'page')
    run._r.append(br)
    insert_paras.append(pb_para)

    body = doc.element.body
    for p in reversed(insert_paras):
        body.remove(p._element)
        body.insert(0, p._element)


# ═══════════════════════════
# TITLE PAGE — LETTER
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
# THESIS BODY FORMATTING
# ═══════════════════════════

def detect_thesis_structure(para, index, doc):
    """Thesis-aware structure detection — FIX: numeric chapter pattern only."""
    text  = para.text.strip()
    words = text.split()
    wc    = len(words)

    if wc == 0:
        return 'empty'

    # Images/drawings → skip entirely
    if has_drawing(para):
        return 'drawing'

    if is_bullet_para(para):
        return 'bullet'

    is_bold = is_all_bold(para)

    # Table/Figure captions — center-aligned titles above/below visuals
    # Pattern: "Table 1: ...", "Figure 2.", "Fig. 3 -", "तालिका 1", "चित्र 2"
    if re.match(r'^(table|figure|fig|chart|graph|diagram|image|photo|plate|'
                r'तालिका|चित्र|आकृति|ग्राफ)\s*[\.\-–—:1-9]', text, re.IGNORECASE):
        return 'figure_caption'

    # Check if NEXT paragraph has a drawing — this paragraph is a pre-visual title/caption
    if index + 1 < len(doc.paragraphs):
        nxt = doc.paragraphs[index + 1]
        if has_drawing(nxt):
            return 'figure_caption'

    # Check if PREVIOUS paragraph has a drawing — this is a post-visual caption
    if index > 0:
        prev = doc.paragraphs[index - 1]
        if has_drawing(prev):
            return 'figure_caption'

    # FIX: Increase word count to handle long chapter titles like "CHAPTER 12: ..."
    if re.match(r'^chapter\s+(\d+|[ivxlcdmIVXLCDM]+)\b', text, re.IGNORECASE) and wc <= 15:
        return 'chapter_heading'

    # Standalone chapter/unit number line (e.g. "CHAPTER I" or "Unit 3")
    if re.match(r'^(unit|part|lesson)\s+(\d+|[ivxlcdmIVXLCDM]+)\b', text, re.IGNORECASE) and wc <= 6:
        return 'chapter_heading'

    # Detect Chapter titles (e.g., "Introduction", "Motivation") that appear after a Chapter number
    if index > 0:
        prev_text = doc.paragraphs[index - 1].text.strip()
        if re.match(r'^(chapter|unit|part|lesson)\s+(\d+|[ivxlcdmIVXLCDM]+)\b', prev_text, re.IGNORECASE) and wc <= 15:
            return 'chapter_heading'

    # Special standalone section names (e.g., abstract, references)
    special_sections = {
        'abstract', 'introduction', 'references', 'bibliography',
        'acknowledgement', 'acknowledgements', 'appendix', 'keywords',
        'methodology', 'discussion', 'results', 'preface', 'index',
        'conclusion', 'conclusions', 'summary', 'recommendations',
        'निष्कर्ष', 'सारांश', 'अनुशंसाएँ', 'संदर्भ', 'ग्रंथसूची',
    }
    if text.lower().strip('.').strip() in special_sections and wc <= 3:
        return 'section_heading'

    # ── Numbered heading detection — ORDER MATTERS: deepest level first ──

    # Subsection: "1.1.1 ..." or deeper (12pt)
    if re.match(r'^\d+\.\d+\.\d+', text) and (is_bold or text == text.upper()):
        return 'subheading'

    # Section: "1.1 ..." (14pt) — checked AFTER subsection to avoid false match
    if re.match(r'^\d+\.\d+\.?\s', text) and (is_bold or text == text.upper()):
        return 'section_heading'

    # Main numbered heading: "1. Title" or "2 Title" → section_heading
    if re.match(r'^\d+\.?\s+\S', text) and is_bold:
        return 'section_heading'

    # Alphabetical section: "A. Title", "B. Title"
    if re.match(r'^[A-Z]\.\s', text) and is_bold:
        return 'section_heading'

    # Lines ending with a colon — bold subheading
    if text.endswith(':') and is_bold and wc <= 20:
        return 'subheading_colon'

    # ALL CAPS line (any length) that is bold → section_heading
    if text.isupper() and is_bold:
        return 'section_heading'

    # ALL CAPS short line (not bold) → section_heading
    if text.isupper() and 2 <= wc <= 6:
        return 'section_heading'

    # Bold short line → subheading fallback
    if is_bold and wc <= 15:
        return 'subheading'

    return 'body'


def format_table_cells(doc, font_name, base_size, line_spacing, black):
    """Apply font/size to all table cell content."""
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if not para.text.strip() and not has_drawing(para):
                        continue
                    if has_drawing(para):
                        continue  # preserve images in table cells
                    # Apply para-level font
                    set_para_font(para, font_name)
                    clear_pPr_sz(para)
                    set_pPr_sz(para, int(base_size * 2))
                    # Apply run-level font/size (preserve bold/italic)
                    for run in para.runs:
                        if run_has_drawing(run):
                            continue
                        was_bold   = run.bold
                        was_italic = run.italic
                        set_font_properly(run, font_name, base_size)
                        run.bold   = was_bold
                        run.italic = was_italic
                        run.font.color.rgb = black


def apply_caps_upper(para, krutidev_mode=False):
    if krutidev_mode:
        return
    for run in para.runs:
        if run.text:
            run.text = run.text.upper()


def format_thesis_body(doc, opts, font_name):
    """
    Apply MKU Thesis Formatting Rules:
    - English: Times New Roman 12pt body; headings 16pt (Chapter), 14pt (Section), 12pt (Subsection) - CAPS
    - Hindi (Kriti-10): 15pt body; headings 18pt (Chapter), 17pt (Section), 15pt (Subsection)
    - Line spacing: 1.5 throughout (Fixed for thesis)
    - Page Numbers: Arabic numerals, bottom center
    - Widow/Orphan control enabled
    """
    black        = RGBColor(0, 0, 0)
    krutidev_mode = is_krutidev(font_name)

    # User-specified heading sizes for thesis chapters
    if krutidev_mode:
        base_size        = 15.0
        ch_heading_size  = 24.0   # CHAPTER label: 24pt (UI spec)
        ch_title_size    = 18.0   # CHAPTER NAME/TITLE: 18pt (UI spec)
        sec_heading_size = 17.0   # Section heading (Hindi guidelines)
        sub_heading_size = 15.0   # Subsection heading (Hindi guidelines)
    else:
        base_size        = 12.0
        ch_heading_size  = 24.0   # CHAPTER label: 24pt (UI spec)
        ch_title_size    = 18.0   # CHAPTER NAME/TITLE: 18pt (UI spec)
        sec_heading_size = 14.0   # Section heading: 14pt (English guidelines)
        sub_heading_size = 12.0   # Subsection heading: 12pt (English guidelines)

    line_spacing = 1.5 # Fixed at 1.5 for thesis per proforma guidelines

    if opts.get('font_size'):
        base_size = float(opts['font_size'])

    # Thesis Mandated Heading Fonts (Override user choice for headings ONLY)
    if krutidev_mode:
        heading_font = 'Kruti Dev 010'
    else:
        heading_font = 'Times New Roman'

    def apply_caps_upper(para):
        if krutidev_mode:
            return
        for run in para.runs:
            if run.text:
                run.text = run.text.upper()

    def set_widow_orphan(para):
        pPr = para._p.get_or_add_pPr()
        wc  = pPr.find(qn('w:widowControl'))
        if wc is None:
            wc = OxmlElement('w:widowControl')
            pPr.append(wc)
        wc.set(qn('w:val'), '1')

    def set_keep_next(para):
        pPr = para._p.get_or_add_pPr()
        kn  = pPr.find(qn('w:keepNext'))
        if kn is None:
            kn = OxmlElement('w:keepNext')
            pPr.append(kn)
        kn.set(qn('w:val'), '1')

    i         = 0
    prev_etype = None

    while i < len(doc.paragraphs):
        para = doc.paragraphs[i]
        text = para.text.strip()

        # FIX 2: Skip image/drawing paragraphs entirely
        if has_drawing(para):
            i += 1
            continue

        if not text:
            i += 1
            continue

        etype = detect_thesis_structure(para, i, doc)

        if etype in ('empty', 'drawing'):
            i += 1
            continue

        # ── Figure / Table caption: center, smaller font, preserve visuals ──
        if etype == 'figure_caption':
            apply_para_formatting(para, etype, font_name,
                font_size_pt=max(base_size - 2, 10.0 if not krutidev_mode else 13.0),
                bold=False, color=black,
                align=WD_ALIGN_PARAGRAPH.CENTER,
                space_before_pt=4, space_after_pt=4,
                line_spacing=1.0)
            set_widow_orphan(para)
            prev_etype = etype
            i += 1
            continue

        # Spacing defaults
        space_after  = 4.0
        space_before = 8.0

        # Look ahead
        next_etype = None
        if i < len(doc.paragraphs) - 1:
            next_para = doc.paragraphs[i + 1]
            if next_para.text.strip() and not has_drawing(next_para):
                next_etype = detect_thesis_structure(next_para, i + 1, doc)

        if etype in ['section_heading', 'subheading']:
            space_after = 1.0
        if etype in ['body', 'bullet'] and next_etype in ['section_heading', 'subheading', 'chapter_heading']:
            space_after = 1.0
        if etype in ['section_heading', 'subheading'] and prev_etype in ['chapter_heading', 'section_heading', 'subheading']:
            space_before = 2.0

        if etype == 'chapter_heading':
            if ':' in text and re.match(r'^chapter\s+\S+', text, re.IGNORECASE):
                parts         = text.split(':', 1)
                chapter_label = parts[0].strip()
                chapter_title = parts[1].strip()

                para.text = chapter_label.upper() if not krutidev_mode else chapter_label
                apply_para_formatting(para, etype, heading_font,
                    font_size_pt=ch_heading_size, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=15, space_after_pt=0,
                    line_spacing=line_spacing)
                set_widow_orphan(para)

                title_para = doc.add_paragraph(
                    chapter_title.upper() if not krutidev_mode else chapter_title)
                para._p.addnext(title_para._p)

                apply_para_formatting(title_para, 'chapter_title', heading_font,
                    font_size_pt=ch_title_size, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=0, space_after_pt=10,
                    line_spacing=line_spacing)
                set_widow_orphan(title_para)
                i += 2
                prev_etype = 'chapter_heading'
                continue
            else:
                # Check if next para is chapter title
                next_is_title = False
                if i + 1 < len(doc.paragraphs):
                    nxt = doc.paragraphs[i + 1]
                    nxt_text = nxt.text.strip()
                    if nxt_text and not has_drawing(nxt):
                        nxt_etype = detect_thesis_structure(nxt, i + 1, doc)
                        if nxt_etype == 'chapter_heading' and not re.match(
                                r'^(chapter|unit|part|lesson)\s*[-–—]?\s*\S+',
                                nxt_text, re.IGNORECASE):
                            next_is_title = True

                if not krutidev_mode:
                    apply_caps_upper(para)
                apply_para_formatting(para, etype, heading_font,
                    font_size_pt=ch_heading_size, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=15, space_after_pt=0 if next_is_title else 10,
                    line_spacing=line_spacing)
                set_widow_orphan(para)
                set_keep_next(para)

                if next_is_title and i + 1 < len(doc.paragraphs):
                    title_para = doc.paragraphs[i + 1]
                    title_text = title_para.text.strip()
                    if not krutidev_mode:
                        for run in title_para.runs:
                            if run.text:
                                run.text = run.text.upper()
                    apply_para_formatting(title_para, 'chapter_title', heading_font,
                        font_size_pt=ch_title_size, bold=True, color=black,
                        align=WD_ALIGN_PARAGRAPH.CENTER,
                        space_before_pt=0, space_after_pt=10,
                        line_spacing=line_spacing)
                    set_widow_orphan(title_para)
                    prev_etype = 'chapter_title'
                    i += 2
                    continue

        elif etype == 'section_heading':
            if not krutidev_mode:
                apply_caps_upper(para)
            apply_para_formatting(para, etype, heading_font, # Mandatory Thesis Heading Font
                font_size_pt=sec_heading_size, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=space_before, space_after_pt=3.0,
                left_indent=0.0, first_indent=0.0, # Explicitly flush left
                line_spacing=line_spacing)
            set_widow_orphan(para)
            set_keep_next(para)

        elif etype == 'subheading':
            if not krutidev_mode:
                apply_caps_upper(para)
            apply_para_formatting(para, etype, heading_font, # Mandatory Thesis Heading Font
                font_size_pt=sub_heading_size, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=space_before, space_after_pt=3.0,
                left_indent=0.0, first_indent=0.0, # Explicitly flush left
                line_spacing=line_spacing)
            set_widow_orphan(para)
            set_keep_next(para)

        elif etype == 'subheading_colon':
            # Bold only, NO uppercase conversion
            apply_para_formatting(para, 'subheading', heading_font,
                font_size_pt=sub_heading_size, bold=True, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=space_before, space_after_pt=3.0,
                left_indent=0.0, first_indent=0.0,
                line_spacing=line_spacing)
            set_widow_orphan(para)

        elif etype == 'bullet':
            is_bold_para = is_all_bold(para)
            apply_para_formatting(para, etype, font_name, # User-selected Font for bullets
                font_size_pt=base_size, bold=is_bold_para, color=black,
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before_pt=0, space_after_pt=space_after,
                left_indent=0.25, first_indent=-0.25, # Hanging indent for tight bullet spacing
                line_spacing=line_spacing)
            set_widow_orphan(para)

        else:  # body
            # Always justify body paragraphs in thesis (per guidelines)
            apply_para_formatting(para, etype, font_name, # User-selected Font for body
                font_size_pt=base_size, bold=False, color=black,
                align=WD_ALIGN_PARAGRAPH.JUSTIFY,
                space_before_pt=0, space_after_pt=5.0,
                left_indent=0.0, first_indent=0.0,
                line_spacing=line_spacing)
            # Force justify at XML level
            pPr = para._p.get_or_add_pPr()
            for jc in pPr.findall(qn('w:jc')):
                pPr.remove(jc)
            jc_el = OxmlElement('w:jc')
            jc_el.set(qn('w:val'), 'both')
            pPr.append(jc_el)
            set_widow_orphan(para)

        prev_etype = etype
        i += 1

    # FIX 3: Apply font/size to ALL table cells
    format_table_cells(doc, font_name, base_size, line_spacing, black)


# ═══════════════════════════
# LETTER BODY FORMATTING
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
    import copy
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


def format_letter_body(doc, opts, font_name):
    black        = RGBColor(0, 0, 0)
    dark         = RGBColor(20, 20, 80)
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


# ═══════════════════════════
# STRUCTURE DETECTION — BOOK / RESEARCH
# ═══════════════════════════

def _is_conclusion_heading(text):
    """Return True if text looks like a chapter conclusion/summary section."""
    CONCLUSION_WORDS = {
        'conclusion', 'conclusions', 'summary', 'chapter summary',
        'concluding remarks', 'unit summary', 'let us sum up',
        'let us sumup', 'key points', 'review questions',
        # Hindi equivalents (Unicode)
        'निष्कर्ष', 'सारांश', 'समापन', 'अध्याय सारांश',
    }
    t = text.lower().strip().rstrip(':').strip()
    return t in CONCLUSION_WORDS or t.startswith('conclusion') or t.startswith('निष्कर्ष')


def detect_structure(para, index, doc=None):
    """Book-aware structure detection."""
    text  = para.text.strip()
    words = text.split()
    wc    = len(words)

    if wc == 0:
        return 'empty'
    if has_drawing(para):
        return 'drawing'

    is_bold = is_all_bold(para)

    if is_bullet_para(para):
        # Bold short bullet items are heading-style, treat as sub_heading
        if is_bold and wc <= 15:
            return 'sub_heading'
        return 'bullet'

    # ── Book Title ──
    if index < 5 and text.isupper() and wc <= 15 and is_bold:
        return 'book_title'

    # ── Chapter / Unit / Part / Lesson heading ──
    if re.match(
        r'^(chapter|unit|part|lesson)\s*[-–—]?\s*(\d+|[ivxlcdmIVXLCDM]+)\b',
        text, re.IGNORECASE
    ) and wc <= 20:
        return 'chapter_heading'

    # Chapter title on line immediately AFTER chapter-number line
    if doc and index > 0:
        prev_text = doc.paragraphs[index - 1].text.strip()
        if re.match(
            r'^(chapter|unit|part|lesson)\s*[-–—]?\s*(\d+|[ivxlcdmIVXLCDM]+)\b',
            prev_text, re.IGNORECASE
        ) and wc <= 20:
            return 'chapter_heading'

    # ── Table / Figure caption — check BEFORE numbered heading rules ──
    TABLE_PAT  = r'(table|तालिका|सारणी)'
    FIGURE_PAT = r'(figure|fig\.?|चित्र|आकृति)'

    if re.match(TABLE_PAT, text, re.IGNORECASE) and wc <= 25:
        return 'table_caption'
    if re.match(FIGURE_PAT, text, re.IGNORECASE) and wc <= 25:
        return 'figure_caption'

    # Numbered caption: "1.1 Table: ..." or "1. Figure ..."
    if re.match(r'^\d+(\.\d+)?\s+' + TABLE_PAT, text, re.IGNORECASE) and wc <= 25:
        return 'table_caption'
    if re.match(r'^\d+(\.\d+)?\s+' + FIGURE_PAT, text, re.IGNORECASE) and wc <= 25:
        return 'figure_caption'

    # ── Content-section words — NOT structural headings ──
    # These appear in book content (examples, exercises, activities, etc.)
    # and must stay as body even when bold or numbered.
    CONTENT_SECTION_WORDS = {
        # English
        'example', 'examples', 'exercise', 'exercises', 'activity', 'activities',
        'practice', 'practices', 'problem', 'problems', 'question', 'questions',
        'solution', 'solutions', 'answer', 'answers', 'task', 'tasks',
        'assignment', 'assignments', 'note', 'notes', 'tip', 'tips',
        'hint', 'hints', 'remark', 'remarks', 'illustration', 'illustrations',
        'case study', 'case studies', 'sample', 'samples',
        # Hindi
        'उदाहरण', 'अभ्यास', 'प्रश्न', 'उत्तर', 'समाधान', 'कार्य', 'टिप्पणी',
    }

    # Strip leading number prefix to get the bare word(s): "2.14 Examples" → "examples"
    bare = re.sub(r'^\d+(\.\d+)*\.?\s+', '', text).strip().rstrip(':').lower()
    if bare in CONTENT_SECTION_WORDS:
        return 'body'

    # ── Sub Heading: X.Y numbering (must check BEFORE main_heading) ──
    if re.match(r'^\d+\.\d+\.?\s+\S', text) and is_bold and wc <= 20:
        return 'sub_heading'

    # ── Main Heading: plain number (e.g. "1. Introduction", "2 Methods") ──
    if re.match(r'^[1-9]\d*\.?\s+\S', text) and is_bold and wc <= 20:
        return 'main_heading'

    # ── Bold short line = sub_heading fallback ──
    if is_bold and wc <= 15:
        return 'sub_heading'

    return 'body'


# ═══════════════════════════
# TABLE HELPERS
# ═══════════════════════════

def center_all_tables(doc):
    for table in doc.tables:
        tbl   = table._tbl
        tblPr = tbl.find(qn('w:tblPr'))
        if tblPr is None:
            tblPr = OxmlElement('w:tblPr')
            tbl.insert(0, tblPr)
        jc = tblPr.find(qn('w:jc'))
        if jc is None:
            jc = OxmlElement('w:jc')
            tblPr.append(jc)
        jc.set(qn('w:val'), 'center')


def set_para_text_formatted(para, new_text, font_size_pt, bold, color, font_name=None):
    """Set paragraph text while preserving run-level formatting.
    Replaces all runs with a single formatted run — use AFTER apply_para_formatting."""
    # Clear all existing runs
    p = para._p
    for r in p.findall(qn('w:r')):
        p.remove(r)
    # Add single new run
    run = para.add_run(new_text)
    run.bold = True if bold else False
    run.font.size = Pt(font_size_pt)
    run.font.color.rgb = color
    if font_name:
        set_font_properly(run, font_name, font_size_pt)


def strip_list_numbering(para):
    """Remove w:numPr from paragraph so Word doesn't render list number prefix."""
    pPr = para._p.find(qn('w:pPr'))
    if pPr is None:
        return
    numPr = pPr.find(qn('w:numPr'))
    if numPr is not None:
        pPr.remove(numPr)


# ═══════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════

def format_document(input_file, output_file, opts, doc_type='book'):
    doc       = Document(input_file)
    font_name = opts.get('font_style') or 'Garamond'
    black     = RGBColor(0, 0, 0)
    gray      = RGBColor(100, 100, 100)

    # 1. Pre-clean (skips drawing paragraphs internally)
    preprocess_document(doc)

    # 1b. Hindi Unicode → Kruti Dev conversion
    if is_krutidev(font_name):
        def convert_mixed_run(run):
            text = run.text
            if not text or not has_unicode_hindi(text):
                return
            segments      = []
            current_hindi = None
            current_chunk = []
            for ch in text:
                ch_is_hindi = '\u0900' <= ch <= '\u097F'
                if current_hindi is None:
                    current_hindi = ch_is_hindi
                if ch_is_hindi == current_hindi:
                    current_chunk.append(ch)
                else:
                    segments.append((current_hindi, ''.join(current_chunk)))
                    current_hindi = ch_is_hindi
                    current_chunk = [ch]
            if current_chunk:
                segments.append((current_hindi, ''.join(current_chunk)))

            converted = ''.join(
                unicode_to_krutidev(seg) if is_h else seg
                for is_h, seg in segments
            )
            run.text = converted

        def convert_para_runs(para):
            for run in para.runs:
                convert_mixed_run(run)

        for para in doc.paragraphs:
            if not has_drawing(para):
                convert_para_runs(para)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        convert_para_runs(para)

    # 2. Page Size & Margins
    page_size_key = opts.get('page_size', 'A4')
    page_w, page_h = PAGE_SIZE_MAP.get(page_size_key, PAGE_SIZE_MAP['A4'])
    for section in doc.sections:
        section.page_width  = page_w
        section.page_height = page_h
        if doc_type == 'thesis':
            section.top_margin    = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin   = Inches(1.5)
            section.right_margin  = Inches(1.0)
        elif doc_type == 'letter':
            if opts.get('page_size') and opts.get('page_size') != 'A4':
                section.top_margin    = Inches(0.8)
                section.bottom_margin = Inches(0.8)
                section.left_margin   = Inches(1.2)
                section.right_margin  = Inches(1.0)
        else:
            section.top_margin    = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin   = Inches(1.0)
            section.right_margin  = Inches(1.0)

    # 2b. Center all tables
    center_all_tables(doc)

    # 3. Title page — by doc_type
    if doc_type == 'thesis':
        insert_thesis_title_page(doc, opts, font_name)
    elif doc_type == 'letter':
        has_user_header = opts.get('org_name') or opts.get('subject')
        if has_user_header and not has_existing_letter_header(doc):
            insert_letter_header(doc, opts, font_name)
    else:
        insert_title_page(doc, opts, font_name)

    # 4. Body formatting — by doc_type
    if doc_type == 'thesis':
        format_thesis_body(doc, opts, font_name)

    elif doc_type == 'letter':
        format_letter_body(doc, opts, font_name)

    else:
        # ── BOOK / RESEARCH ──
        krutidev_mode = is_krutidev(font_name)
        base_size     = float(opts.get('font_size', 12))
        line_spacing  = float(opts.get('line_spacing', 1.5)) # Default 1.5 for book

        # Heading numbering counters
        heading_counters = [0, 0]  # [main_heading, sub_heading]

        i          = 0
        prev_etype = None

        while i < len(doc.paragraphs):
            para = doc.paragraphs[i]

            # Skip drawing paragraphs — preserve images entirely
            if has_drawing(para):
                i += 1
                continue

            text = para.text.strip()
            if not text:
                i += 1
                continue

            etype = detect_structure(para, i, doc)
            if etype in ('empty', 'drawing'):
                i += 1
                continue

            # Spacing logic
            space_after  = 5.0  # Para end spacing
            space_before = 0.0

            if etype == 'book_title':
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=24, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=72, space_after_pt=36,
                    line_spacing=line_spacing)
                set_para_text_formatted(para, text.upper(), 24, True, black)

            elif etype == 'chapter_heading':
                # Reset heading counters for each new chapter
                heading_counters[0] = 0
                heading_counters[1] = 0
                # CHAPTER label: 24pt, bold, ALL CAPS, center, 15pt above, 10pt below

                if ':' in text and re.match(r'^(chapter|unit|part|lesson)\s*[-–—]?\s*\S+', text, re.IGNORECASE):
                    parts         = text.split(':', 1)
                    chapter_label = parts[0].strip()
                    chapter_title = parts[1].strip()

                    apply_para_formatting(para, etype, font_name,
                        font_size_pt=24, bold=True, color=black,
                        align=WD_ALIGN_PARAGRAPH.CENTER,
                        space_before_pt=15, space_after_pt=0,
                        line_spacing=line_spacing)
                    set_para_text_formatted(para,
                        chapter_label.upper() if not krutidev_mode else chapter_label,
                        24, True, black)

                    title_para = doc.add_paragraph()
                    para._p.addnext(title_para._p)
                    apply_para_formatting(title_para, 'chapter_title', font_name,
                        font_size_pt=18, bold=True, color=black,
                        align=WD_ALIGN_PARAGRAPH.CENTER,
                        space_before_pt=0, space_after_pt=10,
                        line_spacing=line_spacing)
                    set_para_text_formatted(title_para,
                        chapter_title.upper() if not krutidev_mode else chapter_title,
                        18, True, black)
                    i += 2
                    prev_etype = 'chapter_heading'
                    continue
                else:
                    # Check if next paragraph is the chapter name/title
                    next_is_title = False
                    if i + 1 < len(doc.paragraphs):
                        nxt      = doc.paragraphs[i + 1]
                        nxt_text = nxt.text.strip()
                        nxt_etype = detect_structure(nxt, i + 1, doc) if nxt_text else 'empty'
                        if nxt_etype == 'chapter_heading' and not re.match(
                                r'^(chapter|unit|part|lesson)\s*[-–—]?\s*\S+',
                                nxt_text, re.IGNORECASE):
                            next_is_title = True

                    apply_para_formatting(para, etype, font_name,
                        font_size_pt=24, bold=True, color=black,
                        align=WD_ALIGN_PARAGRAPH.CENTER,
                        space_before_pt=15, space_after_pt=0 if next_is_title else 10,
                        line_spacing=line_spacing)
                    set_para_text_formatted(para,
                        text.upper() if not krutidev_mode else text,
                        24, True, black)
                    prev_etype = etype
                    i += 1

                    if next_is_title and i < len(doc.paragraphs):
                        title_para  = doc.paragraphs[i]
                        title_text  = title_para.text.strip()
                        apply_para_formatting(title_para, 'chapter_title', font_name,
                            font_size_pt=18, bold=True, color=black,
                            align=WD_ALIGN_PARAGRAPH.CENTER,
                            space_before_pt=0, space_after_pt=10,
                            line_spacing=line_spacing)
                        set_para_text_formatted(title_para,
                            title_text.upper() if not krutidev_mode else title_text,
                            18, True, black)
                        prev_etype = 'chapter_title'
                        i += 1
                    continue

            elif etype == 'main_heading':
                # Strip list numbering
                strip_list_numbering(para)
                # 16pt, bold, numbered (1, 2, 3...)
                heading_counters[0] += 1
                heading_counters[1]  = 0  # reset sub counter
                # Add numbering if not already present
                if not re.match(r'^\d+\.?\s+', text):
                    # prepend to first non-empty run
                    num_prefix = f"{heading_counters[0]}. "
                    for run in para.runs:
                        if run.text.strip():
                            run.text = num_prefix + run.text
                            break
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=16, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.LEFT,
                    space_before_pt=4, space_after_pt=4,
                    left_indent=0.0, first_indent=0.0,
                    line_spacing=line_spacing)

            elif etype == 'sub_heading':
                # Strip list numbering — prevents Word from prepending "1." to the heading
                strip_list_numbering(para)

                # 14pt, bold, numbered (1.1, 1.2...)
                heading_counters[1] += 1
                # If text already has X.Y numbering, sync counters from it
                m = re.match(r'^(\d+)\.(\d+)\.?\s+', text)
                if m:
                    heading_counters[0] = int(m.group(1))
                    heading_counters[1] = int(m.group(2))
                else:
                    # Add numbering prefix if missing
                    num_prefix = f"{heading_counters[0]}.{heading_counters[1]} "
                    for run in para.runs:
                        if run.text.strip():
                            run.text = num_prefix + run.text
                            break

                apply_para_formatting(para, etype, font_name,
                    font_size_pt=14, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.LEFT,
                    space_before_pt=4, space_after_pt=4,
                    left_indent=0.0, first_indent=0.0,
                    line_spacing=line_spacing)

            elif etype == 'table_caption':
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=12, bold=True, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=6, space_after_pt=4,
                    line_spacing=1.0)

            elif etype == 'figure_caption':
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=12, bold=False, color=black,
                    align=WD_ALIGN_PARAGRAPH.CENTER,
                    space_before_pt=4, space_after_pt=6,
                    line_spacing=1.0)
                for run in para.runs:
                    if not run_has_drawing(run):
                        run.italic = True

            elif etype == 'bullet':
                is_bold_para = is_all_bold(para)
                apply_para_formatting(para, etype, font_name,
                    font_size_pt=base_size, bold=is_bold_para, color=black,
                    align=WD_ALIGN_PARAGRAPH.LEFT,
                    space_before_pt=0, space_after_pt=space_after,
                    left_indent=0.25, first_indent=-0.25,
                    line_spacing=line_spacing)

            else:  # body
                apply_clean_justify(para)
                final_align = para.alignment if para.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY else WD_ALIGN_PARAGRAPH.JUSTIFY

                apply_para_formatting(para, etype, font_name,
                    font_size_pt=base_size, bold=False, color=black,
                    align=final_align,
                    space_before_pt=0, space_after_pt=space_after,
                    left_indent=0.0, first_indent=0.0,
                    line_spacing=line_spacing)

            prev_etype = etype
            i += 1

        # Apply font/size to book/research tables once (OUTSIDE while loop)
        format_table_cells(doc, font_name, base_size, line_spacing, black)

    # 5. Headers & Footers
    header_text  = opts.get('header', '').strip()
    footer_text  = opts.get('footer', '').strip()
    page_numbers = opts.get('page_numbers', False)
    page_num_pos = opts.get('page_number_position', 'center')
    start_page   = opts.get('start_page_number', 1)
    try:
        start_page = int(start_page)
    except (ValueError, TypeError):
        start_page = 1

    ALIGN_MAP = {
        'left':   WD_ALIGN_PARAGRAPH.LEFT,
        'center': WD_ALIGN_PARAGRAPH.CENTER,
        'right':  WD_ALIGN_PARAGRAPH.RIGHT,
    }
    num_align = ALIGN_MAP.get(page_num_pos, WD_ALIGN_PARAGRAPH.CENTER)

    if doc_type == 'thesis':
        page_numbers = True
        num_align    = WD_ALIGN_PARAGRAPH.CENTER

    for section in doc.sections:
        section.footer_distance = Inches(1.0) # Ensure footer 1 inch from bottom
        if page_numbers and start_page != 1:
            sectPr    = section._sectPr
            pgNumType = sectPr.find(qn('w:pgNumType'))
            if pgNumType is None:
                pgNumType = OxmlElement('w:pgNumType')
                sectPr.append(pgNumType)
            pgNumType.set(qn('w:start'), str(start_page))

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
            r1.font.size = Pt(10 if doc_type == 'thesis' else 9)
            r1.font.color.rgb = RGBColor(0, 0, 0) if doc_type == 'thesis' else gray
            add_fld_char(r1, 'begin')
            add_instr_text(r1, ' PAGE \\* ARABIC ')
            add_fld_char(r1, 'end')

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

    format_document(in_p, out_p, options, doc_type=type_d)
    print(f'Success: {out_p}')