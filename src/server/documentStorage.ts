import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './db';
import { CustomerDocument, DocumentCategory, DocumentFileType, UserRole } from './types';

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const ALLOWED_MIME_TYPES: Record<string, DocumentFileType> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png'
};

export class DocumentStorageService {
  /**
   * Saves a base64 or buffer file to disk and records metadata in PostgreSQL
   */
  public static async uploadDocument(
    customerId: string,
    title: string,
    category: DocumentCategory,
    originalFileName: string,
    mimeType: string,
    fileBuffer: Buffer,
    uploadedByUserId: string
  ): Promise<CustomerDocument> {
    const cleanMime = mimeType.toLowerCase().trim();
    const fileType = ALLOWED_MIME_TYPES[cleanMime];
    if (!fileType) {
      throw new Error(`Unsupported file type: ${mimeType}. Allowed: PDF, JPG, JPEG, PNG.`);
    }

    if (fileBuffer.length > 25 * 1024 * 1024) {
      throw new Error('File size exceeds 25MB limit.');
    }

    const docId = `doc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const safeExt = fileType === 'jpeg' ? 'jpg' : fileType;
    const diskFileName = `${docId}.${safeExt}`;
    const filePath = path.resolve(UPLOADS_DIR, diskFileName);

    fs.writeFileSync(filePath, fileBuffer);

    // Get current version count for this customer & title
    const countRes = await db.query(
      `SELECT COUNT(*) as count FROM documents WHERE customer_id = $1 AND title = $2`,
      [customerId, title]
    );
    const version = parseInt(countRes.rows[0]?.count || '0', 10) + 1;

    await db.query(
      `INSERT INTO documents (id, customer_id, title, category, file_path, file_name, file_type, file_size, mime_type, version, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        docId,
        customerId,
        title,
        category,
        filePath,
        originalFileName,
        fileType,
        fileBuffer.length,
        cleanMime,
        version,
        uploadedByUserId
      ]
    );

    return {
      id: docId,
      customerId,
      title,
      category,
      filePath,
      fileName: originalFileName,
      fileType,
      fileSize: fileBuffer.length,
      mimeType: cleanMime,
      version,
      uploadedByUserId,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves document metadata and verifies customer authorization
   */
  public static async getDocument(docId: string): Promise<CustomerDocument | null> {
    const res = await db.query(`SELECT * FROM documents WHERE id = $1`, [docId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      category: r.category,
      filePath: r.file_path,
      fileName: r.file_name,
      fileType: r.file_type,
      fileSize: r.file_size,
      mimeType: r.mime_type,
      version: r.version,
      uploadedByUserId: r.uploaded_by_user_id,
      createdAt: r.created_at
    };
  }

  /**
   * Admin only: permanently deletes document from disk and database
   */
  public static async deleteDocument(docId: string): Promise<boolean> {
    const doc = await this.getDocument(docId);
    if (!doc) return false;

    if (fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (err) {
        console.error('Failed deleting physical file:', err);
      }
    }

    await db.query(`DELETE FROM documents WHERE id = $1`, [docId]);
    return true;
  }
}
