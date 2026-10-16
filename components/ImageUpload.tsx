'use client';

import imageCompression from 'browser-image-compression';
import {ImagePlus} from 'lucide-react';
import {ChangeEvent, useRef, useState} from 'react';

interface ImageUploadProps {
  onUpload: (file: File) => Promise<void> | void;
  disabled?: boolean;
  buttonText?: string;
  processingText?: string;
  className?: string;
  onProcessingChange?: (processing: boolean) => void;
}

export default function ImageUpload({
  onUpload,
  disabled = false,
  buttonText = '上传图片',
  processingText = '处理中...',
  className = '',
  onProcessingChange
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFile = () => {
    if (disabled || isProcessing) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    onProcessingChange?.(true);

    try {
      const compressedFile = await imageCompression(selectedFile, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8
      });

      await onUpload(compressedFile);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片处理失败，请换一张图片重试');
    } finally {
      setIsProcessing(false);
      onProcessingChange?.(false);
      event.target.value = '';
    }
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      <button
        type="button"
        onClick={handlePickFile}
        disabled={disabled || isProcessing}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <ImagePlus className="h-4 w-4" />
        {isProcessing ? processingText : buttonText}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
