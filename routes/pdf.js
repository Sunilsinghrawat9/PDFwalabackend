const express = require('express');
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');

const router = express.Router();

// Merge PDFs
router.post('/merge', async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'At least 2 PDF files are required for merging' });
    }

    const mergedPdf = await PDFDocument.create();
    
    for (const file of req.files) {
      const pdfBytes = await fs.readFile(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    
    // Clean up uploaded files
    for (const file of req.files) {
      await fs.remove(file.path);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('PDF merge error:', error);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

// Split PDF
router.post('/split', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required for splitting' });
    }

    const file = req.files[0];
    const pdfBytes = await fs.readFile(file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pageCount = pdf.getPageCount();

    const zip = new JSZip();

    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(copiedPage);
      
      const newPdfBytes = await newPdf.save();
      zip.file(`page_${i + 1}.pdf`, newPdfBytes);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="split_pages.zip"');
    res.send(zipBuffer);

  } catch (error) {
    console.error('PDF split error:', error);
    res.status(500).json({ error: 'Failed to split PDF' });
  }
});

// Add watermark
router.post('/watermark', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }

    const { text = 'CONFIDENTIAL', opacity = 0.3, position = 'center' } = req.body;
    const file = req.files[0];
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    pages.forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 10;
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      let x, y;
      switch (position) {
        case 'topLeft':
          x = 50;
          y = height - 50;
          break;
        case 'topRight':
          x = width - textWidth - 50;
          y = height - 50;
          break;
        case 'bottomLeft':
          x = 50;
          y = 50;
          break;
        case 'bottomRight':
          x = width - textWidth - 50;
          y = 50;
          break;
        default: // center
          x = (width - textWidth) / 2;
          y = height / 2;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        opacity: parseFloat(opacity),
        rotate: degrees(45)
      });
    });

    const modifiedPdfBytes = await pdfDoc.save();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="watermarked.pdf"');
    res.send(Buffer.from(modifiedPdfBytes));

  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: 'Failed to add watermark' });
  }
});

// Add page numbers
router.post('/page-numbers', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }

    const { position = 'bottom', alignment = 'center', startPage = 1 } = req.body;
    const file = req.files[0];
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont('Helvetica');

    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      const pageNumber = (index + parseInt(startPage)).toString();
      const textWidth = font.widthOfTextAtSize(pageNumber, 12);
      
      let x, y;
      
      // Determine Y position
      y = position === 'top' ? height - 30 : 30;
      
      // Determine X position
      switch (alignment) {
        case 'left':
          x = 30;
          break;
        case 'right':
          x = width - textWidth - 30;
          break;
        default: // center
          x = (width - textWidth) / 2;
      }

      page.drawText(pageNumber, {
        x,
        y,
        size: 12,
        font,
        opacity: 0.8
      });
    });

    const modifiedPdfBytes = await pdfDoc.save();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="numbered.pdf"');
    res.send(Buffer.from(modifiedPdfBytes));

  } catch (error) {
    console.error('Page numbers error:', error);
    res.status(500).json({ error: 'Failed to add page numbers' });
  }
});

// Extract text from PDF
router.post('/extract-text', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }

    const file = req.files[0];
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    let extractedText = '';
    const pages = pdfDoc.getPages();

    // Note: pdf-lib doesn't have built-in text extraction
    // This is a placeholder - in production, you'd use pdf-parse or similar
    extractedText = `Text extraction from ${file.originalname}\n\nPages: ${pages.length}\n\nNote: Full text extraction requires additional libraries like pdf-parse.`;

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="extracted_text.txt"');
    res.send(extractedText);

  } catch (error) {
    console.error('Text extraction error:', error);
    res.status(500).json({ error: 'Failed to extract text' });
  }
});

// Organize Pages (reorder, delete, rotate)
router.post('/organize', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }

    let { order, rotate } = req.body;
    if (typeof order === 'string') order = JSON.parse(order);
    if (typeof rotate === 'string') rotate = JSON.parse(rotate);

    const file = req.files[0];
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    let pages = pdfDoc.getPages();

    // Reorder or delete pages
    let newOrder = Array.isArray(order) ? order : pages.map((_, i) => i);
    const newPdf = await PDFDocument.create();

    for (let i = 0; i < newOrder.length; i++) {
      const idx = newOrder[i];
      if (idx < 0 || idx >= pages.length) continue; // skip invalid indices
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [idx]);
      // Rotate if specified
      if (rotate && rotate[idx]) {
        copiedPage.setRotation(degrees(rotate[idx]));
      }
      newPdf.addPage(copiedPage);
    }

    const newPdfBytes = await newPdf.save();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="organized.pdf"');
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error('Organize pages error:', error);
    res.status(500).json({ error: 'Failed to organize PDF pages' });
  }
});

module.exports = router;