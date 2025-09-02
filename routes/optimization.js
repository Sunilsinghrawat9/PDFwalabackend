const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const sharp = require('sharp');

const router = express.Router();

// Optimize PDF - Reduce file size
router.post('/optimize', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { quality = 0.7 } = req.body;
    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Basic optimization by re-saving with compression
    // Note: This is a basic implementation. Advanced optimization would require
    // image compression, font subsetting, and other techniques
    
    const optimizedPdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      objectsPerTick: 50,
    });

    // Calculate compression ratio
    const originalSize = pdfBytes.length;
    const optimizedSize = optimizedPdfBytes.length;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

    console.log(`PDF optimized: ${originalSize} bytes -> ${optimizedSize} bytes (${compressionRatio}% reduction)`);

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="optimized.pdf"');
    res.setHeader('X-Compression-Ratio', compressionRatio);
    res.send(Buffer.from(optimizedPdfBytes));

  } catch (error) {
    console.error('PDF optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize PDF' });
  }
});

// Compress PDF with quality settings
router.post('/compress', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { quality = 0.7 } = req.body;
    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Advanced compression settings
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false,
    });

    // Calculate compression statistics
    const originalSize = pdfBytes.length;
    const compressedSize = compressedPdfBytes.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.setHeader('X-Original-Size', originalSize.toString());
    res.setHeader('X-Compressed-Size', compressedSize.toString());
    res.setHeader('X-Compression-Ratio', compressionRatio);
    res.send(Buffer.from(compressedPdfBytes));

  } catch (error) {
    console.error('PDF compression error:', error);
    res.status(500).json({ error: 'Failed to compress PDF' });
  }
});

// Get PDF metadata and statistics
router.post('/analyze', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pageCount = pdfDoc.getPageCount();
    const fileSize = pdfBytes.length;
    
    // Get document info
    const title = pdfDoc.getTitle() || 'Untitled';
    const author = pdfDoc.getAuthor() || 'Unknown';
    const subject = pdfDoc.getSubject() || 'No subject';
    const creator = pdfDoc.getCreator() || 'Unknown';
    const producer = pdfDoc.getProducer() || 'Unknown';
    const creationDate = pdfDoc.getCreationDate();
    const modificationDate = pdfDoc.getModificationDate();

    // Calculate page dimensions (first page)
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage ? firstPage.getSize() : { width: 0, height: 0 };

    const metadata = {
      filename: req.file.originalname,
      fileSize: fileSize,
      fileSizeFormatted: formatBytes(fileSize),
      pageCount: pageCount,
      title: title,
      author: author,
      subject: subject,
      creator: creator,
      producer: producer,
      creationDate: creationDate ? creationDate.toISOString() : null,
      modificationDate: modificationDate ? modificationDate.toISOString() : null,
      pageSize: {
        width: Math.round(width),
        height: Math.round(height),
        unit: 'points'
      },
      estimatedOptimization: calculateOptimizationPotential(fileSize, pageCount)
    };

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json(metadata);

  } catch (error) {
    console.error('PDF analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze PDF' });
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to estimate optimization potential
function calculateOptimizationPotential(fileSize, pageCount) {
  const avgSizePerPage = fileSize / pageCount;
  let potentialReduction = 0;

  if (avgSizePerPage > 500000) { // > 500KB per page
    potentialReduction = 30; // High optimization potential
  } else if (avgSizePerPage > 200000) { // > 200KB per page
    potentialReduction = 20; // Medium optimization potential
  } else if (avgSizePerPage > 100000) { // > 100KB per page
    potentialReduction = 10; // Low optimization potential
  } else {
    potentialReduction = 5; // Minimal optimization potential
  }

  return {
    estimatedReduction: `${potentialReduction}%`,
    recommendation: potentialReduction > 20 ? 'High optimization recommended' : 
                   potentialReduction > 10 ? 'Moderate optimization possible' : 
                   'File is already well optimized'
  };
}

module.exports = router;