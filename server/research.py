import re
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from utils import (
    has_drawing, run_has_drawing, is_all_bold, is_bullet_para,
    apply_para_formatting, set_para_text_formatted, set_font_properly,
    format_table_cells, add_run_with_font, is_krutidev
)

# ═══════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════

RESEARCH_FONT     = 'Times New Roman'
BLACK             = RGBColor(0, 0, 0)
BASE_SIZE         = 12.0
TITLE_SIZE        = 14.0
LINE_SPACING      = 1.5

INTRO_TRIGGER_WORDS = {'introduction', 'background', 'overview', 'motivation'}
PRE_INTRO_SECTIONS  = {'abstract', 'keywords', 'keyword', 'key words'}
COMMON_HEADINGS     = {
    'discussion', 'conclusion', 'methodology', 'methods', 'results',
    'findings', 'analysis', 'recommendations', 'limitations',
    'future work', 'acknowledgements', 'acknowledgment',
    'research objectives', 'research methodology', 'questionnaire',
    'case study', 'data analysis', 'literature review',
    'hypothesis', 'scope', 'significance', 'problem statement',
    'research design', 'sampling', 'data collection', 'ethical considerations',
    'appendix', 'appendices',
}
REFERENCE_TRIGGERS  = {'references', 'bibliography', 'works cited', 'संदर्भ', 'ग्रंथसूची'}

QUESTIONNAIRE_TRIGGERS = {
    'questionnaire', 'survey', 'survey questions',
    'section a', 'section b', 'section c', 'section d',
    'part a', 'part b', 'part c', 'part d',
}

# ═══════════════════════════════════════════════
# TITLE PAGE / HEADER
# ═══════════════════════════════════════════════

def insert_research_title_page(doc, opts, font_name):
    """Insert title page when user provides explicit metadata"""
    font = RESEARCH_FONT
    title = opts.get('title', '').strip()
    if not title:
        return

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(title)
    r.bold = True
    set_font_properly(r, font)
    r.font.size = Pt(TITLE_SIZE)
    r.font.color.rgb = BLACK

    for key in ['author', 'institution']:
        val = opts.get(key, '').strip()
        if val:
            ap = doc.add_paragraph()
            ap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            ar = ap.add_run(val)
            ar.bold = True
            set_font_properly(ar, font)
            ar.font.size = Pt(12)

    body = doc.element.body
    for p in reversed(doc.paragraphs[-3:]):
        if p.text.strip() == title:
            body.remove(p._element)
            body.insert(0, p._element)

# ═══════════════════════════════════════════════
# DETECTION LOGIC
# ═══════════════════════════════════════════════

def _normalize(text):
    return text.lower().strip().rstrip(':').strip()

def _get_existing_number(text):
    """Extract existing section number from text like '2. Discussion' -> 2"""
    m = re.match(r'^(\d+)\.?\s+', text)
    if m:
        return int(m.group(1))
    return None

def _is_abstract_heading(text):
    """Check if text is the Abstract heading"""
    return _normalize(text) == 'abstract'

def _is_introduction_heading(text):
    """Check if text is the Introduction heading (numbering starts here)"""
    return _normalize(text) in INTRO_TRIGGER_WORDS

def _is_reference_heading_text(text):
    """Check if text is a reference heading (including variations like 'References (APA)')"""
    clean = _normalize(text)
    base = re.sub(r'\s*\(.*?\)\s*', '', clean).strip()
    return base in REFERENCE_TRIGGERS

def _split_reference_blob(text):
    """Split a reference blob into individual reference entries."""
    if not text.strip():
        return []

    apa_start = r'(?:[A-Z][a-zà-ü]+(?:-[A-Z][a-zà-ü]+)?,\s+[A-Z]\.(?:\s*[A-Z]\.)*(?:\s*&?\s*[A-Z][a-zà-ü]+,\s+[A-Z]\.(?:\s*[A-Z]\.)*)?\s*\(\d{4}[a-z]?\))'
    org_start = r'(?:[A-Z][a-zà-ü]+(?:\s+[A-Z][a-zà-ü]+){2,}(?:\s+\([^)]+\))?\s*\(\d{4}[a-z]?\))'
    combined = f'({apa_start}|{org_start})'

    matches = list(re.finditer(combined, text))

    if len(matches) <= 1:
        return [text.strip()]

    entries = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        entry = text[start:end].strip()
        if len(entry) > 20:
            entries.append(entry)
        elif entries:
            entries[-1] = entries[-1] + ' ' + entry

    return entries


def detect_research_structure(para, in_numbered_zone, in_reference_zone, in_questionnaire_zone=False, past_abstract=False):
    text = para.text.strip()
    words = text.split()
    wc = len(words)

    if wc == 0:
        return 'empty'
    if has_drawing(para):
        return 'drawing'

    style_name = para.style.name if para.style else ''
    is_bold = is_all_bold(para)
    is_heading_style = style_name in ('Heading 1', 'Heading 2', 'Heading 3')

    # Reference Heading
    if _is_reference_heading_text(text):
        return 'reference_heading'
    if in_reference_zone:
        return 'reference_entry'

    # Questionnaire section headers (Section A:, Section B:, etc.)
    if re.match(r'^Section\s+[A-Z]\s*:', text, re.IGNORECASE) and wc <= 5:
        return 'questionnaire_section_header'

    # Questionnaire parent heading
    if _normalize(text) in QUESTIONNAIRE_TRIGGERS and wc <= 5:
        return 'numbered_section_heading'

    # Numbered List / Questionnaire items (any length)
    if re.match(r'^\d+[\.\)]\s+', text):
        if in_questionnaire_zone:
            return 'questionnaire_item'
        return 'numbered_list_item'

    # Heading 2 + "Table" → table heading (no numbering)
    if style_name == 'Heading 2' and re.match(r'^Table\s*\d*:?', text, re.IGNORECASE):
        return 'section_heading'

    # Keywords line (already merged by pre-pass)
    if re.match(r'^keywords?\s*:', text, re.IGNORECASE):
        return 'keywords_line'

    # Abstract heading → section_heading (NO numbering ever)
    if _is_abstract_heading(text) and wc <= 3:
        return 'section_heading'

    # Introduction heading → always numbered_section_heading (even if not past_abstract yet)
    if _is_introduction_heading(text) and wc <= 5:
        return 'numbered_section_heading'

    # Heading 2/3 styles → numbered section heading (only if past Abstract)
    if is_heading_style and style_name != 'Heading 1' and wc <= 15:
        if past_abstract:
            return 'numbered_section_heading'
        else:
            return 'section_heading'

    # Section Headings (by content)
    if _normalize(text) in COMMON_HEADINGS and wc <= 10:
        if past_abstract:
            return 'numbered_section_heading'
        else:
            return 'section_heading'

    if _normalize(text) in PRE_INTRO_SECTIONS and wc <= 4:
        return 'section_heading'

    # Existing numbered heading (1.1, 2.0 etc)
    if re.match(r'^\d+(\.\d+)+\s+', text):
        return 'numbered_subsection_heading'
    if re.match(r'^\d+\.?\s+', text) and wc <= 10:
        return 'numbered_section_heading'

    # Short bold line as heading
    if is_bold and wc <= 12 and not text.endswith('.'):
        if in_numbered_zone:
            return 'numbered_subsection_heading'
        return 'section_heading'

    return 'body'

# ═══════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════

def _clear_all_indents(para):
    pPr = para._p.get_or_add_pPr()
    ind = pPr.find(qn('w:ind'))
    if ind is not None:
        pPr.remove(ind)
    para.paragraph_format.first_line_indent = None
    para.paragraph_format.left_indent = None

def _set_hanging_indent(para, indent=0.25):
    _clear_all_indents(para)
    pPr = para._p.get_or_add_pPr()
    ind = OxmlElement('w:ind')
    twips = int(indent * 1440)
    ind.set(qn('w:left'), str(twips))
    ind.set(qn('w:hanging'), str(twips))
    pPr.append(ind)

def _set_first_line_indent(para, indent=0.25):
    _clear_all_indents(para)
    pPr = para._p.get_or_add_pPr()
    ind = OxmlElement('w:ind')
    twips = int(indent * 1440)
    ind.set(qn('w:firstLine'), str(twips))
    pPr.append(ind)

def _inject_number(para, sec, sub=None):
    text = para.text.strip()
    if re.match(r'^\d+', text):
        return
    prefix = f"{sec}. " if sub is None else f"{sec}.{sub} "
    if para.runs:
        para.runs[0].text = prefix + para.runs[0].text.lstrip()
    else:
        para.add_run(prefix)


def _split_merged_numbered_items(doc):
    """
    Pre-pass: Split paragraphs where numbered items or section headers
    are merged into a single paragraph.
    """
    paragraphs = list(doc.paragraphs)
    i = 0

    while i < len(paragraphs):
        para = paragraphs[i]
        text = para.text.strip()

        if not text or has_drawing(para):
            i += 1
            continue

        style_name = para.style.name if para.style else ''

        # Skip headings
        if style_name in ('Heading 1', 'Heading 2', 'Heading 3'):
            i += 1
            continue

        # Pattern: "Section X: something 1. first item 2. second item..."
        section_with_items = re.match(
            r'^(Section\s+[A-Z]\s*:.*?)\s+(\d+\.\s+.+)$',
            text, re.IGNORECASE
        )

        # Pattern: multiple numbered items "1. ... 2. ... 3. ..."
        has_multiple_items = len(re.findall(r'\d+\.\s+', text)) >= 2

        # Pattern: "5 To provide..." (missing dot after number)
        has_numbered_with_missing_dot = re.search(r'[.;]\s+(\d+)\s+(To\s+|to\s+|[A-Z])', text)

        if section_with_items:
            section_header = section_with_items.group(1).strip()
            items_text = section_with_items.group(2).strip()

            para.clear()
            para.add_run(section_header)

            _insert_split_items(doc, para, items_text)
            paragraphs = list(doc.paragraphs)
            i += 1
            continue

        elif has_multiple_items:
            items_text = text
            _insert_split_items(doc, para, items_text, replace_original=True)
            paragraphs = list(doc.paragraphs)
            i += 1
            continue

        elif has_numbered_with_missing_dot:
            fixed_text = re.sub(
                r'([.;])\s+(\d+)\s+(To\s+|to\s+|[A-Z])',
                r'\1\n\2. \3', text
            )
            parts = fixed_text.split('\n')

            parent = para._element.getparent()
            ref_index = list(parent).index(para._element)

            para.clear()
            para.add_run(parts[0].strip())

            for part in parts[1:]:
                part = part.strip()
                if part:
                    new_p = doc.add_paragraph(part)
                    if para.style:
                        new_p.style = para.style
                    ref_index += 1
                    parent.insert(ref_index, new_p._element)

            paragraphs = list(doc.paragraphs)
            i += 1
            continue

        i += 1


def _insert_split_items(doc, current_para, items_text, replace_original=False):
    """Split items_text into individual paragraphs and insert after current_para."""
    parts = re.split(r'(\d+\.\s+)', items_text)

    items = []
    current_num = None
    for part in parts:
        if re.match(r'^\d+\.\s+$', part):
            current_num = part
        elif part.strip() and current_num is not None:
            items.append(current_num + part.strip())
            current_num = None

    if not items:
        return

    parent = current_para._element.getparent()
    ref_index = list(parent).index(current_para._element)

    if replace_original:
        current_para.clear()
        current_para.add_run(items[0])
        ref_index += 1
        for item in items[1:]:
            new_p = doc.add_paragraph(item)
            if current_para.style:
                new_p.style = current_para.style
            parent.insert(ref_index, new_p._element)
            ref_index += 1
    else:
        ref_index += 1
        for item in items:
            new_p = doc.add_paragraph(item)
            if current_para.style:
                new_p.style = current_para.style
            parent.insert(ref_index, new_p._element)
            ref_index += 1

# ═══════════════════════════════════════════════
# PRE-PASS: Fix Keywords + References Structure
# ═══════════════════════════════════════════════

def _handle_keywords_and_refs_prepass(doc, font_name):
    """
    Pre-process document to:
    0. Split merged numbered items and section headers
    1. Merge "Keywords" Heading 2 + next Normal para into "Keywords: content"
    2. Split reference blob into individual paragraphs
    Returns: (title_para_element, table_heading_elements, heading1_elements, 
              abstract_para_element, intro_para_element)
    """
    font = font_name if font_name else RESEARCH_FONT

    # === STEP 0: Split merged numbered items ===
    _split_merged_numbered_items(doc)

    paragraphs = list(doc.paragraphs)

    heading1_elements = set()
    table_heading_elements = set()
    title_para_element = None
    abstract_para_element = None
    intro_para_element = None
    found_title = False
    found_abstract = False
    found_intro = False

    i = 0
    while i < len(paragraphs):
        para = paragraphs[i]
        text = para.text.strip()
        style_name = para.style.name if para.style else ''

        # Track Heading 1 (title)
        if style_name == 'Heading 1' and not found_title:
            heading1_elements.add(para._p)
            if text:
                title_para_element = para._p
                found_title = True

        # Track Abstract paragraph
        if _is_abstract_heading(text) and not found_abstract:
            abstract_para_element = para._p
            found_abstract = True

        # Track Introduction paragraph
        if _is_introduction_heading(text) and len(text.split()) <= 5 and not found_intro:
            intro_para_element = para._p
            found_intro = True

        # Track Table headings
        if style_name == 'Heading 2' and re.match(r'^Table\s*\d*:?', text, re.IGNORECASE):
            table_heading_elements.add(para._p)

        # Merge Keywords: if Heading 2 "Keywords" + next paragraph
        if style_name == 'Heading 2' and _normalize(text) in ('keywords', 'keyword', 'key words'):
            keyword_para = para
            next_idx = i + 1
            while next_idx < len(paragraphs) and not paragraphs[next_idx].text.strip():
                next_idx += 1

            if next_idx < len(paragraphs):
                next_para = paragraphs[next_idx]
                if next_para.style.name == 'Normal' or next_para.style.name == 'List Paragraph':
                    kw_text = next_para.text.strip()
                    keyword_para.clear()
                    r1 = keyword_para.add_run('Keywords: ')
                    r1.bold = True
                    set_font_properly(r1, font)
                    r2 = keyword_para.add_run(kw_text)
                    set_font_properly(r2, font)
                    keyword_para.style = doc.styles['Normal']

                    next_para._element.getparent().remove(next_para._element)
                    paragraphs = list(doc.paragraphs)
                    continue

        i += 1

    # Split reference blob
    paragraphs = list(doc.paragraphs)
    ref_start_idx = None

    for i, para in enumerate(paragraphs):
        text = para.text.strip()
        if not text:
            continue
        if _is_reference_heading_text(text) and len(text.split()) <= 6:
            for j in range(i + 1, len(paragraphs)):
                if paragraphs[j].text.strip():
                    ref_start_idx = j
                    break
            if ref_start_idx is not None:
                break

    if ref_start_idx is not None and ref_start_idx < len(paragraphs):
        ref_blob = paragraphs[ref_start_idx]
        blob_text = ref_blob.text.strip()

        year_matches = re.findall(r'\(\d{4}[a-z]?\)', blob_text)
        if len(year_matches) >= 2:
            entries = _split_reference_blob(blob_text)
            if len(entries) > 1:
                parent = ref_blob._element.getparent()
                ref_index = list(parent).index(ref_blob._element)

                for entry in entries:
                    new_p = doc.add_paragraph(entry)
                    if ref_blob.style:
                        new_p.style = ref_blob.style
                    parent.insert(ref_index + 1, new_p._element)
                    ref_index += 1

                parent.remove(ref_blob._element)

    return title_para_element, table_heading_elements, heading1_elements, abstract_para_element, intro_para_element

# ═══════════════════════════════════════════════
# MAIN FORMATTER
# ═══════════════════════════════════════════════

def format_research_body(doc, opts, font_name):
    font = font_name if font_name else RESEARCH_FONT
    base_size = float(opts.get('font_size', BASE_SIZE))

    # === PRE-PASS ===
    title_elem, table_heading_elems, heading1_elems, abstract_elem, intro_elem = _handle_keywords_and_refs_prepass(doc, font)

    in_numbered_zone = False
    in_reference_zone = False
    in_questionnaire_zone = False
    past_abstract = False
    numbering_started = False
    sec_counter = 0
    sub_counter = 0
    ref_counter = 0
    q_counter = 0

    paragraphs = list(doc.paragraphs)

    # 1. Find first paragraph (title)
    first_p = None
    for p in paragraphs:
        text = p.text.strip()
        if not text or has_drawing(p):
            continue
        style_name = p.style.name if p.style else ''
        if style_name == 'Heading 1' or (first_p is None and text):
            first_p = p
            if style_name == 'Heading 1':
                break

    # 2. CENTER everything BEFORE Abstract (FIX: use element index comparison)
    if abstract_elem is not None:
        # Get index of abstract in the body's children
        body = doc.element.body
        body_children = list(body)
        abstract_idx = None
        for idx, child in enumerate(body_children):
            if child == abstract_elem:
                abstract_idx = idx
                break
        
        if abstract_idx is not None:
            for child in body_children[:abstract_idx]:
                # Check if this is a paragraph element
                if child.tag == qn('w:p'):
                    # Find corresponding paragraph object
                    for p in paragraphs:
                        if p._p == child:
                            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            for r in p.runs:
                                set_font_properly(r, font)
                                r.font.size = Pt(base_size)
                                r.font.color.rgb = BLACK
                            break

    # 3. Format title
    if first_p:
        first_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _clear_all_indents(first_p)
        for r in first_p.runs:
            set_font_properly(r, font)
            r.bold = True
            r.font.size = Pt(TITLE_SIZE)
            r.font.color.rgb = BLACK

        txt = first_p.text.strip()
        if re.match(r'^\d+\.?\s+', txt):
            new_txt = re.sub(r'^\d+\.?\s+', '', txt)
            if first_p.runs:
                first_p.runs[0].text = new_txt

    # 4. Sync counter with already-numbered headings (only after Introduction)
    for para in paragraphs:
        text = para.text.strip()
        if not text or para == first_p:
            continue
        if intro_elem is not None and para._p == intro_elem:
            numbering_started = True
            sec_counter = 0  # Reset — Introduction will set to 1
        if not numbering_started:
            continue
        existing = _get_existing_number(text)
        if existing is not None:
            etype = detect_research_structure(para, True, False, False, True)
            if etype in ('numbered_section_heading', 'numbered_subsection_heading'):
                if existing > sec_counter:
                    sec_counter = existing

    # 5. Body Processing
    prev_body_para = None
    numbering_started = False

    for i, para in enumerate(paragraphs):
        text = para.text.strip()
        if not text or has_drawing(para):
            if text:
                prev_body_para = None
            continue
        if para == first_p:
            prev_body_para = None
            continue

        para_elem = para._p
        style_name = para.style.name if para.style else ''

        # Check if we've crossed Abstract
        if abstract_elem is not None and para_elem == abstract_elem:
            past_abstract = True

        # Check if we've hit Introduction (FIX: numbering starts at 1)
        if intro_elem is not None and para_elem == intro_elem:
            numbering_started = True
            sec_counter = 0  # Reset to 0 so next increment gives 1

        etype = detect_research_structure(para, in_numbered_zone, in_reference_zone, in_questionnaire_zone, past_abstract)

        # --- REFERENCE ZONE ENTRY/EXIT ---
        if etype == 'reference_heading':
            in_reference_zone = True
            in_numbered_zone = False
            in_questionnaire_zone = False
            ref_counter = 0

        if in_reference_zone and etype not in ('reference_heading', 'reference_entry', 'empty'):
            in_reference_zone = False

        if etype == 'numbered_section_heading':
            in_numbered_zone = True
            if _normalize(text) in QUESTIONNAIRE_TRIGGERS:
                in_questionnaire_zone = True
                q_counter = 0

        # --- QUESTIONNAIRE SECTION HEADER ---
        if etype == 'questionnaire_section_header':
            _clear_all_indents(para)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.space_before = Pt(10)
            para.paragraph_format.space_after = Pt(4)
            para.paragraph_format.line_spacing = 1.5
            for r in para.runs:
                set_font_properly(r, font)
                r.bold = True
                r.font.size = Pt(base_size)
                r.font.color.rgb = BLACK
            prev_body_para = None
            continue

        # --- QUESTIONNAIRE ITEMS ---
        if etype == 'questionnaire_item':
            q_counter += 1
            _set_hanging_indent(para, 0.35)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.line_spacing = 1.5
            para.paragraph_format.space_after = Pt(3)
            para.paragraph_format.space_before = Pt(0)

            for r in para.runs:
                set_font_properly(r, font)
                r.bold = False
                r.font.size = Pt(base_size)
                r.font.color.rgb = BLACK
            prev_body_para = None
            continue

        # --- HEADINGS ---
        if etype in ('section_heading', 'numbered_section_heading', 'numbered_subsection_heading', 'reference_heading'):
            is_title = (style_name == 'Heading 1' or para_elem in heading1_elems)
            is_table = (style_name == 'Heading 2' and re.match(r'^Table\s*\d*:?', text, re.IGNORECASE)) or (para_elem in table_heading_elems)
            is_abstract = (abstract_elem is not None and para_elem == abstract_elem)
            is_intro = (intro_elem is not None and para_elem == intro_elem)
            already_numbered = _get_existing_number(text) is not None
            is_ref = (etype == 'reference_heading')

            if is_ref or is_title or is_table or is_abstract:
                # No numbering for these
                pass
            elif is_intro:
                # Introduction always gets number 1
                if not already_numbered:
                    sec_counter = 1
                    sub_counter = 0
                    _inject_number(para, sec_counter)
            elif etype == 'numbered_section_heading' and numbering_started:
                if not already_numbered:
                    sec_counter += 1
                    sub_counter = 0
                    _inject_number(para, sec_counter)
                else:
                    existing = _get_existing_number(text)
                    if existing is not None:
                        sec_counter = existing
                        sub_counter = 0
            elif etype == 'numbered_subsection_heading' and numbering_started:
                if not already_numbered:
                    sub_counter += 1
                    _inject_number(para, sec_counter, sub_counter)
                else:
                    existing = _get_existing_number(text)
                    if existing is not None:
                        sub_counter = existing

            _clear_all_indents(para)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.space_before = Pt(12)
            para.paragraph_format.space_after = Pt(6)
            para.paragraph_format.line_spacing = 1.5
            for r in para.runs:
                set_font_properly(r, font)
                r.bold = True
                r.font.size = Pt(base_size)
                r.font.color.rgb = BLACK
            prev_body_para = None
            continue

        # --- KEYWORDS ---
        if etype == 'keywords_line':
            _clear_all_indents(para)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.space_before = Pt(4)
            para.paragraph_format.space_after = Pt(4)
            para.paragraph_format.line_spacing = 1.5
            full_txt = para.text
            para.clear()
            m = re.match(r'^(keywords?\s*:)(.*)', full_txt, re.IGNORECASE)
            if m:
                r1 = para.add_run(m.group(1))
                r1.bold = True
                set_font_properly(r1, font)
                r1.font.size = Pt(base_size)
                r2 = para.add_run(m.group(2))
                set_font_properly(r2, font)
                r2.font.size = Pt(base_size)
            prev_body_para = None
            continue

        # --- LIST ITEMS / BULLETS ---
        if etype == 'numbered_list_item' or is_bullet_para(para):
            _set_hanging_indent(para, 0.25)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.space_after = Pt(2)
            para.paragraph_format.line_spacing = 1.5
            for r in para.runs:
                set_font_properly(r, font)
                r.font.size = Pt(base_size)
                r.font.color.rgb = BLACK
            prev_body_para = None
            continue

        # --- REFERENCE ENTRIES ---
        if etype == 'reference_entry':
            ref_counter += 1
            _set_hanging_indent(para, 0.3)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.line_spacing = 1.15
            para.paragraph_format.space_after = Pt(2)

            current_text = para.text.strip()
            current_text = re.sub(r'^[•\-\*]\s*', '', current_text)
            current_text = re.sub(r'^\[\d+\]\s*', '', current_text)

            para.clear()
            r_num = para.add_run(f'[{ref_counter}] ')
            set_font_properly(r_num, font)
            r_num.font.size = Pt(11)
            r_num.font.color.rgb = BLACK

            r_text = para.add_run(current_text)
            set_font_properly(r_text, font)
            r_text.font.size = Pt(11)
            r_text.font.color.rgb = BLACK

            prev_body_para = None
            continue

        # --- BODY TEXT ---
        _clear_all_indents(para)

        prev_body = None
        for j in range(i - 1, -1, -1):
            prev_para = paragraphs[j]
            prev_text = prev_para.text.strip()
            if not prev_text or has_drawing(prev_para):
                continue
            prev_past_abstract = past_abstract
            if abstract_elem is not None:
                for k in range(j, -1, -1):
                    if paragraphs[k]._p == abstract_elem:
                        prev_past_abstract = True
                        break
            prev_estyle = detect_research_structure(prev_para, in_numbered_zone, in_reference_zone, in_questionnaire_zone, prev_past_abstract)
            if prev_estyle == 'body':
                prev_body = prev_para
            break

        if prev_body is not None:
            _set_first_line_indent(para, 0.25)
            prev_body_para = para
        else:
            prev_body_para = para

        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        para.paragraph_format.line_spacing = 1.5
        para.paragraph_format.space_after = Pt(0)
        for r in para.runs:
            set_font_properly(r, font)
            r.bold = False
            r.font.size = Pt(base_size)
            r.font.color.rgb = BLACK

    format_table_cells(doc, font, base_size, 1.5, BLACK)