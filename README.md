# DocFlow Backend API

A comprehensive backend service for PDF processing operations including conversion, security, OCR, and optimization.

## Features

- **PDF Operations**: Merge, split, compress, watermark, page numbering
- **File Conversions**: Images↔PDF, HTML→PDF, Word↔PDF, Excel↔PDF, Text↔PDF
- **Security**: Password protection and removal (basic implementation)
- **OCR**: Text extraction from PDFs and images using Tesseract
- **Optimization**: PDF compression and file size reduction
- **Rate Limiting**: Configurable request limits
- **File Management**: Automatic cleanup of temporary files

## API Endpoints

### PDF Operations (`/api/pdf`)
- `POST /merge` - Merge multiple PDFs
- `POST /split` - Split PDF into individual pages
- `POST /watermark` - Add watermark to PDF
- `POST /page-numbers` - Add page numbers to PDF
- `POST /extract-text` - Extract text from PDF

### File Conversion (`/api/conversion`)
- `POST /images-to-pdf` - Convert images to PDF
- `POST /html-to-pdf` - Convert HTML to PDF
- `POST /word-to-pdf` - Convert Word documents to PDF
- `POST /excel-to-pdf` - Convert Excel files to PDF
- `POST /text-to-pdf` - Convert text files to PDF

### Security (`/api/security`)
- `POST /protect` - Add password protection to PDF
- `POST /unlock` - Remove password from PDF

### OCR (`/api/ocr`)
- `POST /extract` - Extract text from PDF using OCR
- `POST /image` - Extract text from image files

### Optimization (`/api/optimization`)
- `POST /optimize` - Optimize PDF file size
- `POST /compress` - Compress PDF with quality settings
- `POST /analyze` - Analyze PDF metadata and statistics

### Health Check
- `GET /health` - Server health status

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`

5. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |
| `RATE_LIMIT` | Requests per day per IP | 50 |
| `MAX_FILE_SIZE` | Max upload size in bytes | 104857600 (100MB) |

## Deployment on Render

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Configure build and start commands**:
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Set environment variables**:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   RATE_LIMIT=100
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```

5. **Add build dependencies** (in Render dashboard):
   - Go to Environment tab
   - Add: `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false`

## Frontend Integration

Update your frontend to use the backend API:

```typescript
// In your frontend, update API calls to use your backend URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-service.onrender.com/api'
  : 'http://localhost:3001/api';

// Example API call
const response = await fetch(`${API_BASE_URL}/pdf/merge`, {
  method: 'POST',
  body: formData
});
```

## File Upload Limits

- Maximum file size: 100MB per file
- Maximum files per request: 10 files
- Supported formats: PDF, Images (JPG, PNG), HTML, Word (DOCX), Excel (XLSX), Text

## Rate Limiting

- Default: 50 requests per 24 hours per IP
- Configurable via `RATE_LIMIT` environment variable
- Returns 429 status when limit exceeded

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message (development only)"
}
```

## File Cleanup

- Uploaded files are automatically deleted after processing
- Temporary files are cleaned up every hour
- Files older than 1 hour are automatically removed

## Dependencies

### Core Dependencies
- **express**: Web framework
- **multer**: File upload handling
- **pdf-lib**: PDF manipulation
- **puppeteer**: HTML to PDF conversion
- **tesseract.js**: OCR functionality
- **sharp**: Image processing
- **mammoth**: Word document processing
- **xlsx**: Excel file processing

### Security & Performance
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **compression**: Response compression
- **express-rate-limit**: Rate limiting

## Troubleshooting

### Common Issues

1. **Puppeteer fails on Render**:
   - Ensure `PUPPETEER_EXECUTABLE_PATH` is set correctly
   - Add Chrome dependencies in Render environment

2. **File upload errors**:
   - Check file size limits
   - Verify file types are supported

3. **OCR processing slow**:
   - OCR is limited to 10 pages for performance
   - Consider implementing background job processing for large files

4. **Memory issues**:
   - Large files can cause memory issues
   - Consider implementing file streaming for very large files

## License

MIT License - see LICENSE file for details.