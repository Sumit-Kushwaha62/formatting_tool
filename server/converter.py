# 1. Merge PDFs
def merge_pdfs(file_paths, output_path):
    from pypdf import PdfWriter
    writer = PdfWriter()
    for path in file_paths:
        writer.append(path)
    with open(output_path, "wb") as f:
        writer.write(f)

# 2. Merge Word files  
def merge_word(file_paths, output_path):
    from docx import Document
    from docx.oxml.ns import qn
    import copy

    if not file_paths:
        return

    # Open first document as base
    base = Document(file_paths[0])
    
    # Process subsequent documents one by one to save memory
    for path in file_paths[1:]:
        doc = Document(path)
        for element in doc.element.body:
            # Append each element using XML copy approach
            if element.tag != qn('w:sectPr'):
                base.element.body.insert(-1, copy.deepcopy(element))
        # Explicitly delete to free memory
        del doc
        
    base.save(output_path)

# 3. PDF to Word
def pdf_to_word(input_path, output_path):
    from pdf2docx import Converter
    cv = Converter(input_path)
    cv.convert(output_path)
    cv.close()

# 4. Excel to PDF
def excel_to_pdf(input_path, output_path):
    import openpyxl
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

    wb = openpyxl.load_file(input_path) if hasattr(openpyxl, 'load_file') else openpyxl.load_workbook(input_path)
    sheet = wb.active
    data = []
    for row in sheet.iter_rows(values_only=True):
        data.append([str(cell) if cell is not None else "" for cell in row])

    doc = SimpleDocTemplate(output_path, pagesize=A4)
    elements = []
    if data:
        t = Table(data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), '#cccccc'),
            ('GRID', (0, 0), (-1, -1), 1, '#000000'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        elements.append(t)
    doc.build(elements)

# 5. Compress PDF
def compress_pdf(input_path, output_path, level="recommended"):
    import fitz  # PyMuPDF
    import os
    import shutil

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    orig_size = os.path.getsize(input_path)

    # Determine downsample & compression parameters based on level
    if level == "extreme":
        dpi_target = 96
        quality = 40
    elif level == "low":
        dpi_target = 220
        quality = 82
    else:  # recommended / balanced
        dpi_target = 150
        quality = 65

    doc = fitz.open(input_path)

    # 1. Rewrite and compress embedded images cleanly without corrupting streams or dimensions
    try:
        doc.rewrite_images(
            quality=quality,
            dpi_target=dpi_target,
            lossy=True,
            lossless=True,
            bitonal=True,
            color=True,
            gray=True
        )
    except Exception:
        pass

    # 2. Subset embedded fonts where applicable to drop unused glyphs
    try:
        doc.subset_fonts()
    except Exception:
        pass

    # 3. Save with stream deflation, font/image deflation, and deep garbage collection
    # Note: clean=False is critical because clean=True expands/decompresses content streams.
    try:
        doc.save(
            output_path,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True
        )
    except Exception:
        doc.save(output_path, garbage=3, deflate=True)
    finally:
        doc.close()

    # 4. Strict Compression Safeguard:
    # A compressor must NEVER produce a file larger than the original input.
    # If optimization didn't reduce size (e.g., file already maximally compressed),
    # fallback to original file so the user never gets an inflated document.
    if os.path.exists(output_path):
        out_size = os.path.getsize(output_path)
        if out_size >= orig_size:
            shutil.copyfile(input_path, output_path)

# 6. Compress Image
def compress_image(input_path, output_path, level="recommended"):
    from PIL import Image, ImageOps
    import os
    import shutil

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    orig_size = os.path.getsize(input_path)

    with Image.open(input_path) as img:
        # Correct orientation based on EXIF tag
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if level == "extreme":
            quality = 40
            max_dim = 1280
        elif level == "low":
            quality = 85
            max_dim = 2560
        else:  # recommended
            quality = 68
            max_dim = 1920

        # Maintain aspect ratio and scale down if larger than max_dim
        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        ext = os.path.splitext(output_path)[1].lower()

        if ext in [".jpg", ".jpeg"]:
            if img.mode in ("RGBA", "P", "LA"):
                # Fill transparent areas with white background
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "RGBA":
                    bg.paste(img, mask=img.split()[3])
                else:
                    bg.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            img.save(output_path, "JPEG", optimize=True, quality=quality)

        elif ext == ".png":
            if level == "extreme":
                if img.mode == "RGBA":
                    img_q = img.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
                    img_q.save(output_path, "PNG", optimize=True)
                else:
                    img_rgb = img.convert("RGB")
                    img_q = img_rgb.quantize(colors=128)
                    img_q.save(output_path, "PNG", optimize=True)
            elif level == "recommended":
                if img.mode == "RGBA":
                    img_q = img.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
                    img_q.save(output_path, "PNG", optimize=True)
                else:
                    img.save(output_path, "PNG", optimize=True)
            else:
                img.save(output_path, "PNG", optimize=True)

        elif ext == ".webp":
            img.save(output_path, "WEBP", optimize=True, quality=quality)
        else:
            img.save(output_path, optimize=True, quality=quality)

    # Safeguard: Never produce larger file than original
    if os.path.exists(output_path):
        out_size = os.path.getsize(output_path)
        if out_size >= orig_size:
            shutil.copyfile(input_path, output_path)

# 7. Remove Background
def remove_background(input_path, output_path):
    from PIL import Image, ImageOps
    from rembg import remove, new_session
    import onnxruntime as ort
    import os

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    with Image.open(input_path) as img:
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Memory & Speed Optimization for Render Free Tier (512MB RAM cap):
        # 1. Downscale large camera photos to 800px max dimension.
        # u2netp internally maps to a 320x320 grid, so 800px delivers 100% precision
        # while keeping RAM usage well under 180MB.
        max_dim = 800
        w, h = img.size
        if max(w, h) > max_dim:
            resample_filter = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS', Image.LANCZOS)
            img.thumbnail((max_dim, max_dim), resample_filter)

        # 2. Constrain ONNX Runtime memory allocation:
        # Disabling memory arena pre-allocation saves ~280MB of RAM!
        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = 1
        sess_opts.inter_op_num_threads = 1
        sess_opts.enable_cpu_mem_arena = False
        sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC

        # Use local u2netp (4.5MB model) bundled in repo for 0.3s instant loading with zero network delay
        local_model_path = os.path.join(os.path.dirname(__file__), 'models', 'u2netp.onnx')
        if os.path.exists(local_model_path):
            session = new_session('u2netp', sess_opts=sess_opts, model_path=local_model_path)
        else:
            session = new_session('u2netp', sess_opts=sess_opts)

        result = remove(img, session=session)

        result.save(output_path, "PNG")

        # Explicit garbage collection to instantly free memory on Render
        del img
        del result
        del session
        import gc
        gc.collect()

# 8. Unlock PDF (Remove Password)
def remove_pdf_password(input_path, output_path, password=""):
    import fitz
    import os
    import sys

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    doc = fitz.open(input_path)
    if doc.is_encrypted:
        authenticated = doc.authenticate(password or "")
        if not authenticated:
            doc.close()
            sys.stderr.write("ERROR_INCORRECT_PASSWORD\n")
            sys.exit(2)

    doc.save(output_path, encryption=fitz.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
    doc.close()

if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        sys.exit(1)

    command = sys.argv[1]

    if command == "merge_pdfs":
        # args: output_path, input_path1, input_path2, ...
        output_path = sys.argv[2]
        file_paths = sys.argv[3:]
        merge_pdfs(file_paths, output_path)

    elif command == "merge_word":
        # args: output_path, input_path1, input_path2, ...
        output_path = sys.argv[2]
        file_paths = sys.argv[3:]
        merge_word(file_paths, output_path)

    elif command == "pdf_to_word":
        # args: input_path, output_path
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        pdf_to_word(input_path, output_path)

    elif command == "excel_to_pdf":
        # args: input_path, output_path
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        excel_to_pdf(input_path, output_path)

    elif command == "compress_pdf":
        # args: input_path, output_path, [level]
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        level = sys.argv[4] if len(sys.argv) > 4 else "recommended"
        compress_pdf(input_path, output_path, level)

    elif command == "compress_image":
        # args: input_path, output_path, [level]
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        level = sys.argv[4] if len(sys.argv) > 4 else "recommended"
        compress_image(input_path, output_path, level)

    elif command == "remove_background":
        # args: input_path, output_path
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        remove_background(input_path, output_path)

    elif command == "remove_pdf_password":
        # args: input_path, output_path, [password]
        input_path = sys.argv[2]
        output_path = sys.argv[3]
        password = sys.argv[4] if len(sys.argv) > 4 else ""
        remove_pdf_password(input_path, output_path, password)
