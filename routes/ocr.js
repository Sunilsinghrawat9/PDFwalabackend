const express = require('express');
const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const sharp = require('sharp');
const pdf2pic = require('pdf2pic');
const multer = require('multer'); // <-- Add this line

const upload = multer({ dest: 'uploads/' }); // <-- Add this line

const router = express.Router();

// OCR - Extract text from PDF using Tesseract
router.post('/extract', upload.single('file'), async (req, res) => { // <-- Add upload middleware
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const pdfPath = req.file.path;
    let extractedText = '';

    // Convert PDF pages to images
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 100,
      saveFilename: "page",
      savePath: "./temp_images/",
      format: "png",
      width: 600,
      height: 600
    });

    // Ensure temp directory exists
    await fs.ensureDir('./temp_images');

    try {
      // Get PDF page count
      const pdfBytes = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      // Process each page
      for (let i = 1; i <= Math.min(pageCount, 10); i++) { // Limit to 10 pages for performance
        try {
          const result = await convert(i, { responseType: "image" });
          
          if (result.base64) {
            // Perform OCR on the image
            const ocrResult = await Tesseract.recognize(
              `data:image/png;base64,${result.base64}`,
              'eng',
              {
                logger: m => console.log(m)
              }
            );
            
            extractedText += `\n--- Page ${i} ---\n${ocrResult.data.text}\n`;
          }
        } catch (pageError) {
          console.error(`Error processing page ${i}:`, pageError);
          extractedText += `\n--- Page ${i} ---\n[Error processing this page]\n`;
        }
      }

    } catch (conversionError) {
      console.error('PDF conversion error:', conversionError);
      // Fallback: try to process as single image if it's a simple PDF
      extractedText = 'OCR processing failed. Please try with a different PDF or image file.';
    }

    // Clean up temp files
    await fs.remove('./temp_images');
    await fs.remove(req.file.path);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="ocr_extracted_text.txt"');
    res.send(extractedText);

  } catch (error) {
    console.error('OCR error:', error);
    
    // Clean up files
    try {
      await fs.remove('./temp_images');
      if (req.file) await fs.remove(req.file.path);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    res.status(500).json({ error: 'Failed to perform OCR on PDF' });
  }
});

// OCR for images
router.post('/image', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Perform OCR directly on the image
    const ocrResult = await Tesseract.recognize(
      req.file.path,
      'eng',
      {
        logger: m => console.log(m)
      }
    );

    const extractedText = ocrResult.data.text;

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="ocr_text.txt"');
    res.send(extractedText);

  } catch (error) {
    console.error('Image OCR error:', error);
    
    // Clean up file
    if (req.file) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Failed to perform OCR on image' });
  }
});

module.exports = router;