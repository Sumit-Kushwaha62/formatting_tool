import PyPDF2
import json

def read_pdf(file_path):
    text = ""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        text = f"Error: {e}"
    return text

book_text = read_pdf("book_formatting_structure.pdf")

with open("book_analysis.txt", "w", encoding='utf-8') as f:
    f.write(book_text)

print("Book analysis text saved.")
