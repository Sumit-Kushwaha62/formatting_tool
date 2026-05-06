import PyPDF2
from docx import Document
import json
import os

def read_pdf(file_path):
    text = ""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        text = f"Error reading PDF: {e}"
    return text

def read_docx_structure(file_path):
    structure = []
    try:
        doc = Document(file_path)
        # Read first 50 paragraphs to understand structure
        for i, para in enumerate(doc.paragraphs[:50]):
            if para.text.strip():
                p_info = {
                    "text": para.text[:100],
                    "alignment": str(para.alignment),
                    "style": para.style.name,
                    "runs": []
                }
                for run in para.runs[:3]: # Check first few runs for font/size
                    p_info["runs"].append({
                        "font_name": run.font.name,
                        "font_size": run.font.size.pt if run.font.size else None,
                        "bold": run.bold,
                        "italic": run.italic
                    })
                structure.append(p_info)
    except Exception as e:
        structure.append(f"Error reading DOCX: {e}")
    return structure

# Analyze files
pdf_text = read_pdf("Final Proforma for Thesis Submission.pdf")
# Find the relevant section in PDF
start_idx = pdf_text.find("Page Dimensions")
if start_idx == -1: start_idx = 0
pdf_relevant = pdf_text[start_idx:start_idx+3000]

docx_struct = read_docx_structure("exprected_output_thesis.docx")

analysis = {
    "pdf_instructions": pdf_relevant,
    "docx_expected_structure": docx_struct
}

with open("analysis_result.json", "w", encoding='utf-8') as f:
    json.dump(analysis, f, indent=2)

print("Analysis complete. Result saved to analysis_result.json")
