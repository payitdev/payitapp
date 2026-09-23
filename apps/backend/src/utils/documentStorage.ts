import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Converts a base64 encoded document image or PDF into a publicly accessible URL for partner APIs (Brails).
 */
export async function uploadDocumentToCdn(base64Data: string, prefix = 'doc'): Promise<string | undefined> {
  if (!base64Data || typeof base64Data !== 'string') {
    return undefined;
  }

  // If already a valid http/https URL, return directly
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }

  try {
    // Extract format extension from base64 header or default to jpg
    let ext = 'jpg';
    let rawBase64 = base64Data;

    if (base64Data.includes(';base64,')) {
      const parts = base64Data.split(';base64,');
      const header = parts[0];
      rawBase64 = parts[1];

      if (header.includes('pdf')) ext = 'pdf';
      else if (header.includes('png')) ext = 'png';
      else if (header.includes('webp')) ext = 'webp';
      else if (header.includes('jpeg') || header.includes('jpg')) ext = 'jpg';
    }

    const fileHash = crypto.createHash('sha256').update(rawBase64).digest('hex').slice(0, 16);
    const fileName = `${prefix}_${Date.now()}_${fileHash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    const buffer = Buffer.from(rawBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const appBaseUrl = process.env.BACKEND_PUBLIC_URL || process.env.APP_BASE_URL || 'https://api.payit.app';
    const publicUrl = `${appBaseUrl.replace(/\/$/, '')}/uploads/${fileName}`;

    console.log(`📄 Document uploaded to CDN: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('❌ Failed to convert document base64 to CDN link:', err.message);
    return undefined;
  }
}
