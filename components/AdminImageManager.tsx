'use client';

import Image from 'next/image';
import {Trash2, X} from 'lucide-react';
import {useMemo, useState} from 'react';
import ImageUpload from '@/components/ImageUpload';
import {supabase} from '@/lib/supabase';

interface AdminImageManagerProps {
  open: boolean;
  shopId: string;
  shopName: string;
  imageUrls: string[];
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

const MAX_IMAGES = 5;

export default function AdminImageManager({
  open,
  shopId,
  shopName,
  imageUrls,
  onClose,
  onUpdated
}: AdminImageManagerProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUploadMore = useMemo(() => imageUrls.length < MAX_IMAGES, [imageUrls.length]);

  if (!open) {
    return null;
  }

  const updateImageUrls = async (nextUrls: string[]) => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const {error: updateError} = await supabase.from('shops').update({image_urls: nextUrls}).eq('id', shopId);

      if (updateError) {
        throw updateError;
      }

      setMessage('图片更新成功');
      await onUpdated();
    } catch (updateErr) {
      setError(updateErr instanceof Error ? updateErr.message : '图片更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (targetIndex: number) => {
    if (saving) return;
    const nextUrls = imageUrls.filter((_, index) => index !== targetIndex);
    await updateImageUrls(nextUrls);
  };

  const handleUpload = async (file: File) => {
    if (!canUploadMore) {
      setError(`最多只能上传 ${MAX_IMAGES} 张图片`);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `shops/${shopId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const {error: uploadError} = await supabase.storage.from('shop-images').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

      if (uploadError) {
        throw uploadError;
      }

      const {data} = supabase.storage.from('shop-images').getPublicUrl(filePath);
      const nextUrls = [...imageUrls, data.publicUrl].slice(0, MAX_IMAGES);

      const {error: updateError} = await supabase.from('shops').update({image_urls: nextUrls}).eq('id', shopId);

      if (updateError) {
        throw updateError;
      }

      setMessage('图片上传成功');
      await onUpdated();
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : '图片上传失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="管理店铺图片"
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">管理图片 · {shopName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-500">当前 {imageUrls.length}/{MAX_IMAGES} 张</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {imageUrls.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              暂无图片
            </div>
          ) : (
            imageUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                <Image src={url} alt={`shop-image-${index + 1}`} width={320} height={240} className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    void handleDelete(index);
                  }}
                  disabled={saving}
                  className="absolute right-1.5 top-1.5 rounded-full bg-rose-600 p-1 text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="删除图片"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ImageUpload
            onUpload={handleUpload}
            disabled={saving || !canUploadMore}
            buttonText={canUploadMore ? '上传新图片' : '已达上限'}
          />
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
