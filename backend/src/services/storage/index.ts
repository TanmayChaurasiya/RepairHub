import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';

export interface StorageProvider {
  uploadFile(file: Express.Multer.File): Promise<string>;
  getFileUrl(filePath: string): string;
  deleteFile(filePath: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${uniqueSuffix}-${sanitizedFilename}`;
    const destinationPath = path.join(this.uploadDir, filename);

    // Write buffer to file
    await fs.promises.writeFile(destinationPath, file.buffer);
    return `/uploads/${filename}`;
  }

  getFileUrl(filePath: string): string {
    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const fullPath = path.join(this.uploadDir, filename);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

// Singleton storage provider (swap with S3StorageProvider when configuring AWS S3)
export const storageProvider: StorageProvider = new LocalStorageProvider();
