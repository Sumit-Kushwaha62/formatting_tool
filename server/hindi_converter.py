"""
hindi_converter.py
──────────────────
Standalone Hindi Unicode → KrutiDev 010 converter.

Does ONE thing: takes a .docx with Unicode Devanagari text and outputs
a .docx where every Hindi run is converted to KrutiDev 010 ASCII encoding,
with correct font assignments at run, paragraph, Normal-style, and
docDefaults levels so Word does not fall back to Mangal.

Intentionally separate from formatter.py so users can:
  1. Convert first → verify output → then format
  2. Use conversion without any formatting changes
  3. Debug conversion issues independently of formatting issues

Reuses all logic from utils.py — no duplication.
"""

import sys
import os
import re
import traceback
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt

# All heavy lifting is already in utils.py — import, don't duplicate
from utils import (
    is_krutidev,
    has_unicode_hindi,
    convert_doc_runs,
    merge_runs_in_para,
    FONT_NAME_MAP,
)

DEFAULT_KRUTIDEV_FONT = 'Krutidev010'


def _fix_normal_style(doc, formal_name):
    try:
        normal_style = doc.styles['Normal']
        normal_style.font.name = formal_name
        rPr = normal_style.element.get_or_add_rPr()
        rFonts = rPr.find(qn('w:rFonts'))
        if rFonts is None:
            rFonts = OxmlElement('w:rFonts')
            rPr.insert(0, rFonts)
        hint_a = qn('w:hint')
        if rFonts.get(hint_a): del rFonts.attrib[hint_a]
        rFonts.set(qn('w:ascii'), formal_name)
        rFonts.set(qn('w:hAnsi'), formal_name)
        rFonts.set(qn('w:cs'), formal_name)
        ea_a = qn('w:eastAsia')
        if rFonts.get(ea_a): del rFonts.attrib[ea_a]
        for ta in ['w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme']:
            t = qn(ta)
            if rFonts.get(t): del rFonts.attrib[t]
        lang = rPr.find(qn('w:lang'))
        if lang is None:
            lang = OxmlElement('w:lang')
            rPr.append(lang)
        lang.set(qn('w:val'), 'x-none')
        lang.set(qn('w:ascii'), 'x-none')
        lang.set(qn('w:hAnsi'), 'x-none')
        bidi_l = qn('w:bidi')
        if lang.get(bidi_l): del lang.attrib[bidi_l]
    except Exception as e:
        print(f'[WARN] Normal style fix failed: {e}', flush=True)


def _fix_doc_defaults(doc, formal_name):
    try:
        doc_elm = doc.element
        styles_elm = doc_elm.find(qn('w:styles'))
        if styles_elm is None: return
        docDefaults = styles_elm.find(qn('w:docDefaults'))
        if docDefaults is None: return
        rPrDefault = docDefaults.find(qn('w:rPrDefault'))
        if rPrDefault is None:
            rPrDefault = OxmlElement('w:rPrDefault')
            docDefaults.append(rPrDefault)
        rPr = rPrDefault.find(qn('w:rPr'))
        if rPr is None:
            rPr = OxmlElement('w:rPr')
            rPrDefault.append(rPr)
        rFonts = rPr.find(qn('w:rFonts'))
        if rFonts is None:
            rFonts = OxmlElement('w:rFonts')
            rPr.insert(0, rFonts)
        hint_a = qn('w:hint')
        if rFonts.get(hint_a): del rFonts.attrib[hint_a]
        rFonts.set(qn('w:ascii'), formal_name)
        rFonts.set(qn('w:hAnsi'), formal_name)
        rFonts.set(qn('w:cs'), formal_name)
        ea_a = qn('w:eastAsia')
        if rFonts.get(ea_a): del rFonts.attrib[ea_a]
        for ta in ['w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme']:
            t = qn(ta)
            if rFonts.get(t): del rFonts.attrib[t]
        lang = rPr.find(qn('w:lang'))
        if lang is None:
            lang = OxmlElement('w:lang')
            rPr.append(lang)
        lang.set(qn('w:val'), 'x-none')
        lang.set(qn('w:ascii'), 'x-none')
        lang.set(qn('w:hAnsi'), 'x-none')
        bidi_l = qn('w:bidi')
        if lang.get(bidi_l): del lang.attrib[bidi_l]
    except Exception as e:
        print(f'[WARN] docDefaults fix failed: {e}', flush=True)


def _fix_theme_fonts(doc, formal_name):
    try:
        theme_part = None
        for rel in doc.part.rels.values():
            if 'theme' in rel.reltype.lower():
                theme_part = rel.target_part
                break
        if theme_part is None: return
        blob = theme_part.blob
        if b'Deva' not in blob and b'Sinh' not in blob: return
        theme_xml = blob.decode('utf-8', errors='replace')
        theme_xml = re.sub(
            r'<a:font script="Deva"[^/]*/?>',
            f'<a:font script="Deva" typeface="{formal_name}"/>',
            theme_xml,
        )
        theme_xml = re.sub(
            r'<a:font script="Sinh"[^/]*/?>',
            f'<a:font script="Sinh" typeface="{formal_name}"/>',
            theme_xml,
        )
        if 'script="Deva"' not in theme_xml:
            theme_xml = theme_xml.replace(
                '</a:majorFont>',
                f'<a:font script="Deva" typeface="{formal_name}"/></a:majorFont>',
            )
            theme_xml = theme_xml.replace(
                '</a:minorFont>',
                f'<a:font script="Deva" typeface="{formal_name}"/></a:minorFont>',
            )
        theme_part._blob = theme_xml.encode('utf-8')
    except Exception as e:
        print(f'[WARN] Theme font fix failed: {e}', flush=True)


def _doc_has_unicode_hindi(doc):
    for para in doc.paragraphs:
        if has_unicode_hindi(para.text): return True
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if has_unicode_hindi(para.text): return True
    return False


def convert_to_krutidev(input_path, output_path, font_name=DEFAULT_KRUTIDEV_FONT):
    print(f'[hindi_converter] Loading: {input_path}', flush=True)
    doc = Document(input_path)
    formal_name = FONT_NAME_MAP.get(font_name, font_name)
    print(f'[hindi_converter] Target font: {formal_name}', flush=True)

    had_hindi = _doc_has_unicode_hindi(doc)
    if not had_hindi:
        print('[hindi_converter] WARNING: no Unicode Hindi found in document', flush=True)

    print('[hindi_converter] Step 1: Merging split runs...', flush=True)
    for para in doc.paragraphs:
        merge_runs_in_para(para)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    merge_runs_in_para(para)

    print('[hindi_converter] Step 2: Fixing document-level font defaults...', flush=True)
    _fix_normal_style(doc, formal_name)
    _fix_doc_defaults(doc, formal_name)
    _fix_theme_fonts(doc, formal_name)

    print('[hindi_converter] Step 3: Converting Unicode runs to KrutiDev...', flush=True)
    convert_doc_runs(doc, font_name)

    print(f'[hindi_converter] Step 4: Saving to: {output_path}', flush=True)
    doc.save(output_path)
    print('[hindi_converter] Conversion complete.', flush=True)

    return {
        'success': True,
        'had_hindi': had_hindi,
        'message': 'Conversion successful' if had_hindi else 'Saved (no Unicode Hindi found in document)',
    }


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python hindi_converter.py <input.docx> <output.docx> [font_name]', file=sys.stderr)
        sys.exit(1)
    in_path  = sys.argv[1]
    out_path = sys.argv[2]
    font     = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_KRUTIDEV_FONT
    try:
        result = convert_to_krutidev(in_path, out_path, font)
        print(f'[hindi_converter] Result: {result}', flush=True)
        sys.exit(0)
    except Exception as e:
        print(f'[hindi_converter] FATAL: {type(e).__name__}: {e}', file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        sys.exit(1)