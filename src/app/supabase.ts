import { createClient } from '@supabase/supabase-js';

// supabase.ts — v3 compatible
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.trim() || '';
const SUPABASE_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const DEFAULT_BUCKET = (import.meta as any).env?.VITE_SUPABASE_BUCKET?.trim() || 'agrifarm-images';

export function getSupabaseConfigError(): string | null {
  if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-id')) {
    return 'VITE_SUPABASE_URL is not set in your .env file.';
  }
  if (!SUPABASE_PUBLISHABLE_KEY) {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY is not set in your .env file.';
  }
  // v3 accepts sb_publishable_ keys — no JWT check needed
  if (!SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') && 
      !SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    return 'Key format not recognised. Expected sb_publishable_... or eyJ...';
  }
  return null;
}

export const isSupabaseConfigured = (): boolean => getSupabaseConfigError() === null;

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_placeholder',
);

// ─── SVG placeholder ─────────────────────────────────────────────────────────
const RAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100" style="background-color:#0d1510"><circle cx="50" cy="50" r="30" fill="none" stroke="#10B981" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.3"/><path d="M20 50h60M50 20v60" stroke="#10B981" stroke-width="0.5" opacity="0.2"/><path d="M50 35c3-5 7-5 10 0s3 10 0 15c-3 5-7 5-10 0s-3-10 0-15z" fill="#10B981" opacity="0.2"/><path d="M50 35c-3-5-7-5-10 0s-3 10 0 15c3 5 7 5 10 0s3-10 0-15z" fill="#10B981" opacity="0.2"/><rect x="5" y="5" width="90" height="90" rx="10" fill="none" stroke="#10B981" stroke-width="0.5" opacity="0.1"/></svg>`;

export const SVG_PLACEHOLDER =
  typeof window !== 'undefined'
    ? `data:image/svg+xml;base64,${window.btoa(RAW_SVG)}`
    : `data:image/svg+xml;utf8,${encodeURIComponent(RAW_SVG)}`;

// ─── Image helpers ────────────────────────────────────────────────────────────
/**
 * Returns a safe image URL, falling back to the SVG placeholder for
 * missing, placeholder, or empty URLs.
 */
export function getSafeImageUrl(url: string | undefined | null): string {
  if (!url || url.trim() === '') return SVG_PLACEHOLDER;
  const lower = url.toLowerCase();
  if (
    lower.includes('your_') ||
    lower.includes('your-') ||
    lower.includes('your-project-id') ||
    lower.includes('placeholder')
  ) {
    return SVG_PLACEHOLDER;
  }
  return url;
}

/**
 * Compresses an image file using canvas before upload.
 */
export async function compressImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
        } else {
          if (height > maxHeight) { width = Math.round(width * maxHeight / height); height = maxHeight; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Failed to get canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
          'image/jpeg',
          quality,
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

/**
 * Uploads an image to Supabase Storage.
 *
 * If Supabase is not configured, or the upload fails, falls back gracefully
 * to a local Object URL so image previews always work in development.
 *
 * Bucket structure: agrifarm-images/
 *   products/{timestamp}_{filename}   ← product listings
 *   profiles/{timestamp}_{filename}   ← profile photos
 */
export async function uploadImageToSupabase(
  file: File,
  bucketName: string = DEFAULT_BUCKET,
  folder: 'products' | 'profiles' | 'uploads' = 'products',
): Promise<string> {
  // ── Preflight: skip real upload if not configured ──────────────────────────
  const configError = getSupabaseConfigError();
  if (configError) {
    console.warn('[Supabase] Not configured — using local blob preview:', configError);
    return URL.createObjectURL(file);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${Date.now()}_${safeName}`;

  try {
    // Compress images before upload to save storage
    let uploadData: Blob | File = file;
    if (file.type.startsWith('image/')) {
      try {
        uploadData = await compressImage(file);
      } catch (compressionErr) {
        console.warn('[Supabase] Compression failed, uploading original:', compressionErr);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, uploadData, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      // Surface the exact Supabase error — the most common ones are:
      // - "Invalid Compact JWS" → wrong key type (sb_publishable_ instead of eyJ…)
      // - "Bucket not found"    → bucket name mismatch or bucket not created yet
      // - "row-level security"  → storage policies not configured
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err: any) {
    console.error('[Supabase] Upload failed — falling back to local blob:', err?.message || err);
    // Always return a usable URL so the UI doesn't break
    return URL.createObjectURL(file);
  }
}
