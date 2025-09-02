const express = require('express');
const fs = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');

const router = express.Router();

// Protect PDF with password
router.post('/protect', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { password = 'password123' } = req.body;
    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/\.pdf$/, '_protected.pdf');

    // Use qpdf to add password protection
    const cmd = `qpdf --encrypt "${password}" "${password}" 256 -- "${inputPath}" "${outputPath}"`;

    exec(cmd, async (err) => {
      if (err) {
        await fs.remove(inputPath);
        return res.status(500).json({ error: 'Failed to protect PDF' });
      }
      const protectedPdf = await fs.readFile(outputPath);
      await fs.remove(inputPath);
      await fs.remove(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="protected.pdf"');
      res.send(protectedPdf);
    });
  } catch (error) {
    console.error('PDF protection error:', error);
    res.status(500).json({ error: 'Failed to protect PDF' });
  }
});

// Unlock/Remove password from PDF
router.post('/unlock', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { password } = req.body;
    if (!password) {
      await fs.remove(req.file.path);
      return res.status(400).json({ error: 'Password is required to unlock PDF' });
    }

    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/\.pdf$/, '_unlocked.pdf');

    // Use qpdf to remove password protection
    const cmd = `qpdf --password="${password}" --decrypt "${inputPath}" "${outputPath}"`;

    exec(cmd, async (err) => {
      if (err) {
        await fs.remove(inputPath);
        return res.status(400).json({ error: 'Unable to unlock PDF. Please check the password.' });
      }
      const unlockedPdf = await fs.readFile(outputPath);
      await fs.remove(inputPath);
      await fs.remove(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="unlocked.pdf"');
      res.send(unlockedPdf);
    });
  } catch (error) {
    console.error('PDF unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock PDF' });
  }
});

module.exports = router;