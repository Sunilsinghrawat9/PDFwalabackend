const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
const PDFKit = require('pdfkit');
const pdf2pic = require('pdf2pic');
const archiver = require('archiver');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph } = require('docx');

const router = express.Router();

// Images to PDF
router.post('/images-to-pdf', async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image file is required' });
    }

    const pdfDoc = await PDFDocument.create();

    for (const file of req.files) {
      // Convert image to PNG buffer using sharp
      const imageBuffer = await sharp(file.path)
        .png()
        .toBuffer();

      const image = await pdfDoc.embedPng(imageBuffer);
      const page = pdfDoc.addPage();
      
      const { width, height } = page.getSize();
      const imageAspectRatio = image.width / image.height;
      const pageAspectRatio = width / height;

      let imageWidth, imageHeight;
      if (imageAspectRatio > pageAspectRatio) {
        imageWidth = width - 40; // 20px margin on each side
        imageHeight = imageWidth / imageAspectRatio;
      } else {
        imageHeight = height - 40; // 20px margin on top and bottom
        imageWidth = imageHeight * imageAspectRatio;
      }

      const x = (width - imageWidth) / 2;
      const y = (height - imageHeight) / 2;

      page.drawImage(image, {
        x,
        y,
        width: imageWidth,
        height: imageHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();

    // Clean up uploaded files
    for (const file of req.files) {
      await fs.remove(file.path);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="images_to_pdf.pdf"');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Images to PDF error:', error);
    res.status(500).json({ error: 'Failed to convert images to PDF' });
  }
});

// HTML to PDF
router.post('/html-to-pdf', async (req, res) => {
  let browser;
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one HTML file is required' });
    }

    const file = req.files[0];
    const htmlContent = await fs.readFile(file.path, 'utf8');

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    await browser.close();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="html_to_pdf.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('HTML to PDF error:', error);
    res.status(500).json({ error: 'Failed to convert HTML to PDF' });
  }
});

// Word to PDF
router.post('/word-to-pdf', async (req, res) => {
  let browser;
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one Word file is required' });
    }

    const file = req.files[0];
    const docxBuffer = await fs.readFile(file.path);
    
    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
          h1, h2, h3 { color: #333; }
          p { margin-bottom: 1em; }
        </style>
      </head>
      <body>
        ${result.value}
      </body>
      </html>
    `;

    // Convert HTML to PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      }
    });

    await browser.close();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="word_to_pdf.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Word to PDF error:', error);
    res.status(500).json({ error: 'Failed to convert Word to PDF' });
  }
});

// Excel to PDF
router.post('/excel-to-pdf', async (req, res) => {
  let browser;
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one Excel file is required' });
    }

    const file = req.files[0];
    const workbook = XLSX.readFile(file.path);
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h2 { color: #333; margin-top: 30px; }
        </style>
      </head>
      <body>
    `;

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const htmlTable = XLSX.utils.sheet_to_html(worksheet);
      htmlContent += `<h2>Sheet: ${sheetName}</h2>${htmlTable}`;
    });

    htmlContent += '</body></html>';

    // Convert HTML to PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      landscape: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    await browser.close();

    // Clean up uploaded file
    await fs.remove(file.path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="excel_to_pdf.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Excel to PDF error:', error);
    res.status(500).json({ error: 'Failed to convert Excel to PDF' });
  }
});

// Text to PDF
router.post('/text-to-pdf', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one text file is required' });
    }

    const file = req.files[0];
    const textContent = await fs.readFile(file.path, 'utf8');

    // Create PDF using PDFKit
    const doc = new PDFKit();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="text_to_pdf.pdf"');
      res.send(pdfBuffer);
    });

    // Add content to PDF
    doc.fontSize(12);
    doc.text(textContent, {
      width: 410,
      align: 'left'
    });

    doc.end();

    // Clean up uploaded file
    await fs.remove(file.path);

  } catch (error) {
    console.error('Text to PDF error:', error);
    res.status(500).json({ error: 'Failed to convert text to PDF' });
  }
});

// PDF to Images
router.post('/pdf-to-images', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }
    const file = req.files[0];
    const outputDir = './temp_images';
    await fs.ensureDir(outputDir);

    const convert = pdf2pic.fromPath(file.path, {
      density: 150,
      saveFilename: "page",
      savePath: outputDir,
      format: "png",
      width: 1200,
      height: 1600
    });

    // Get page count
    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    const imageFiles = [];
    for (let i = 1; i <= pageCount; i++) {
      const result = await convert(i);
      imageFiles.push(result.path);
    }

    // Zip images
    const zipPath = './pdf_images.zip';
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    imageFiles.forEach(imgPath => archive.file(imgPath, { name: path.basename(imgPath) }));
    await archive.finalize();

    output.on('close', async () => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="pdf_images.zip"');
      res.sendFile(path.resolve(zipPath), async () => {
        await fs.remove(zipPath);
        await fs.remove(outputDir);
        await fs.remove(file.path);
      });
    });
  } catch (error) {
    console.error('PDF to Images error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to images' });
  }
});

// PDF to Text
router.post('/pdf-to-text', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }
    const file = req.files[0];
    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParse(dataBuffer);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="pdf_text.txt"');
    res.send(data.text);

    await fs.remove(file.path);
  } catch (error) {
    console.error('PDF to Text error:', error);
    res.status(500).json({ error: 'Failed to extract text from PDF' });
  }
});

// PDF to Word (basic: extracts text and puts in DOCX)
router.post('/pdf-to-word', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }
    const file = req.files[0];
    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParse(dataBuffer);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [new Paragraph(data.text)]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="pdf_to_word.docx"');
    res.send(buffer);

    await fs.remove(file.path);
  } catch (error) {
    console.error('PDF to Word error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to Word' });
  }
});

// PDF to Excel (basic: extracts text and puts each line in a row)
router.post('/pdf-to-excel', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }
    const file = req.files[0];
    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParse(dataBuffer);

    // Split text into rows (very basic)
    const rows = data.text.split('\n').map(line => [line]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="pdf_to_excel.xlsx"');
    res.send(excelBuffer);

    await fs.remove(file.path);
  } catch (error) {
    console.error('PDF to Excel error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to Excel' });
  }
});

// PDF to HTML
router.post('/pdf-to-html', async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1) {
      return res.status(400).json({ error: 'Exactly one PDF file is required' });
    }
    const file = req.files[0];
    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParse(dataBuffer);

    // Very basic: wrap extracted text in <pre> for HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PDF to HTML</title>
      </head>
      <body>
        <pre>${data.text}</pre>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="pdf_to_html.html"');
    res.send(htmlContent);

    await fs.remove(file.path);
  } catch (error) {
    console.error('PDF to HTML error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to HTML' });
  }
});

module.exports = router;