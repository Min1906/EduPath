'use client';
import React, { useEffect, useRef, useState } from 'react';
import { download, upload } from '@/lib/api';
import { Button, Modal } from '@/components/ui';

export interface FileImportDropzoneProps {
  title: string;
  description?: string;
  templateUrl?: string;
  templateFileName?: string;
  uploadEndpoint: string;
  accept?: string;
  buttonLabel?: string;
  themeColor?: 'blue' | 'purple' | 'emerald' | 'indigo';
  disabled?: boolean;
  disabledMessage?: string;
  onSuccess?: (result: any) => void;
  icon?: string;
}

// Progress stage labels
const STAGE_LABELS = [
  'Membaca file...',
  'Memvalidasi data...',
  'Memproses baris data...',
  'Menyimpan ke database...',
  'Menyelesaikan import...',
];

export function FileImportDropzone({
  title,
  description,
  templateUrl,
  templateFileName = 'template.xlsx',
  uploadEndpoint,
  accept = '.xlsx, .xls, .csv',
  buttonLabel = 'Import Data ke Database',
  themeColor = 'blue',
  disabled = false,
  disabledMessage,
  onSuccess,
  icon = '📊',
}: FileImportDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    total?: number;
    successCount?: number;
    failedCount?: number;
    errors?: { row: number; message: string }[];
  } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const colorThemes = {
    blue: {
      border: 'border-blue-300 hover:border-blue-500 bg-blue-50/20',
      activeBorder: 'border-blue-600 bg-blue-50/60 ring-4 ring-blue-500/10',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      btn: 'bg-[#2457d6] hover:bg-[#1a45b0] text-white',
      accentText: 'text-blue-700',
      fileCard: 'border-blue-200 bg-blue-50/40',
      progressBar: 'from-blue-500 to-blue-600',
      progressBg: 'bg-blue-100',
      progressText: 'text-blue-700',
      progressBorder: 'border-blue-200 bg-blue-50',
    },
    purple: {
      border: 'border-purple-300 hover:border-purple-500 bg-purple-50/20',
      activeBorder: 'border-purple-600 bg-purple-50/60 ring-4 ring-purple-500/10',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      btn: 'bg-purple-700 hover:bg-purple-800 text-white',
      accentText: 'text-purple-700',
      fileCard: 'border-purple-200 bg-purple-50/40',
      progressBar: 'from-purple-500 to-purple-600',
      progressBg: 'bg-purple-100',
      progressText: 'text-purple-700',
      progressBorder: 'border-purple-200 bg-purple-50',
    },
    emerald: {
      border: 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/20',
      activeBorder: 'border-emerald-600 bg-emerald-50/60 ring-4 ring-emerald-500/10',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      accentText: 'text-emerald-700',
      fileCard: 'border-emerald-200 bg-emerald-50/40',
      progressBar: 'from-emerald-500 to-emerald-600',
      progressBg: 'bg-emerald-100',
      progressText: 'text-emerald-700',
      progressBorder: 'border-emerald-200 bg-emerald-50',
    },
    indigo: {
      border: 'border-indigo-300 hover:border-indigo-500 bg-indigo-50/20',
      activeBorder: 'border-indigo-600 bg-indigo-50/60 ring-4 ring-indigo-500/10',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      accentText: 'text-indigo-700',
      fileCard: 'border-indigo-200 bg-indigo-50/40',
      progressBar: 'from-indigo-500 to-indigo-600',
      progressBg: 'bg-indigo-100',
      progressText: 'text-indigo-700',
      progressBorder: 'border-indigo-200 bg-indigo-50',
    },
  };

  const theme = colorThemes[themeColor] || colorThemes.blue;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  function startFakeProgress() {
    setProgress(0);
    setStageIndex(0);

    // Stage checkpoints: progress % where each stage ends
    const stageCheckpoints = [15, 35, 60, 85, 93];

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // Find current stage from checkpoints
        const newStage = stageCheckpoints.findIndex((cp) => prev < cp);
        setStageIndex(newStage >= 0 ? newStage : STAGE_LABELS.length - 1);

        // Cap at 93% until actual response comes
        const target = 93;
        if (prev >= target) return prev;

        // Increment speed varies by stage
        let increment = 0;
        if (prev < 15) increment = Math.random() * 3 + 2;        // fast: 2-5%
        else if (prev < 35) increment = Math.random() * 2 + 1.5; // medium: 1.5-3.5%
        else if (prev < 60) increment = Math.random() * 1.5 + 1; // medium: 1-2.5%
        else if (prev < 85) increment = Math.random() * 0.8 + 0.4; // slow: 0.4-1.2%
        else increment = Math.random() * 0.3 + 0.1;               // very slow near 93%

        return Math.min(prev + increment, target);
      });
    }, 120);
  }

  function stopFakeProgress(success: boolean) {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Jump to 100%
    setStageIndex(success ? STAGE_LABELS.length - 1 : STAGE_LABELS.length - 1);
    setProgress(100);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  }

  function validateAndSetFile(f: File) {
    const ext = f.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      alert('Format file tidak didukung. Harap pilih file .xlsx, .xls, atau .csv');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimum ukuran file adalah 10 MB.');
      return;
    }
    setFile(f);
    setResult(null);
    setProgress(0);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function handleUpload() {
    if (!file || disabled || isUploading) return;
    setIsUploading(true);
    setResult(null);
    startFakeProgress();

    try {
      const res: any = await upload(uploadEndpoint, file);
      stopFakeProgress(true);

      // Small delay so user sees 100% before result appears
      await new Promise((r) => setTimeout(r, 400));

      const isOk = (res.success ?? 0) > 0 || (res.failed ?? 0) === 0;
      setResult({
        success: isOk,
        message: res.message || `${res.success ?? 0} data berhasil dibaca dan ditambahkan ke database.`,
        total: res.total,
        successCount: res.success ?? 0,
        failedCount: res.failed ?? 0,
        errors: res.errors || [],
      });
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: any) {
      stopFakeProgress(false);
      await new Promise((r) => setTimeout(r, 200));
      setResult({
        success: false,
        message: err.message || 'Gagal mengimpor file ke database.',
      });
    } finally {
      setIsUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setProgress(0);
    setStageIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="card p-5 border border-[#d7deea] shadow-sm rounded-2xl bg-white flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl p-1.5 rounded-xl bg-gray-100 shadow-2xs">{icon}</span>
            <div>
              <h3 className="font-bold text-sm text-gray-900 leading-tight">{title}</h3>
              {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
            </div>
          </div>
          {templateUrl && (
            <Button
              variant="secondary"
              className="text-xs h-7.5 px-2.5 shrink-0"
              onClick={() => download(templateUrl, templateFileName)}
              title="Unduh contoh template Excel"
            >
              📥 Template
            </Button>
          )}
        </div>

        {/* Disabled Banner if frozen */}
        {disabled && (
          <div className="my-3 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center gap-2">
            <span>🔒</span>
            <span>{disabledMessage || 'Area import sedang dinonaktifkan / data dikunci.'}</span>
          </div>
        )}

        {/* Dropzone Area */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={`mt-3 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition cursor-pointer select-none ${
              disabled
                ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                : isDragging
                ? theme.activeBorder
                : theme.border
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              disabled={disabled}
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-2xl mb-2">
              📂
            </div>
            <p className="text-xs font-bold text-gray-800">
              {isDragging ? 'Lepaskan file di sini...' : 'Tarik & lepas file di sini, atau klik untuk memilih'}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
              <span className={`rounded-md px-2 py-0.5 font-semibold border ${theme.badge}`}>
                Format: .XLSX, .XLS, .CSV
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">Maks. 10 MB</span>
            </div>
          </div>
        ) : (
          /* File Selected Preview Card */
          <div className={`mt-3 rounded-xl border p-3.5 transition animate-fadeIn ${theme.fileCard}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white font-black text-sm shadow-xs">
                  📊
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-gray-900 truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="font-semibold text-green-700 flex items-center gap-1">
                      <span>✓</span> File siap diimpor
                    </span>
                  </div>
                </div>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 transition"
                  title="Hapus / Ganti file"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── LOADING PROGRESS BAR ─── */}
        {isUploading && (
          <div className={`mt-3 rounded-xl border p-3.5 ${theme.progressBorder}`}>
            {/* Stage label */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                <span className={`text-[11px] font-semibold ${theme.progressText}`}>
                  {STAGE_LABELS[Math.min(stageIndex, STAGE_LABELS.length - 1)]}
                </span>
              </div>
              <span className={`text-[11px] font-black tabular-nums ${theme.progressText}`}>
                {Math.round(progress)}%
              </span>
            </div>

            {/* Progress bar track */}
            <div className={`relative h-2.5 w-full rounded-full overflow-hidden ${theme.progressBg}`}>
              {/* Animated shimmer overlay */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s infinite linear',
                }}
              />
              {/* Actual filled bar */}
              <div
                className={`h-full rounded-full bg-gradient-to-r ${theme.progressBar} transition-all duration-200 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step dots */}
            <div className="mt-2.5 flex items-center justify-between gap-1">
              {STAGE_LABELS.map((label, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                  <div
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      i <= stageIndex
                        ? `bg-gradient-to-r ${theme.progressBar} scale-125`
                        : 'bg-gray-200'
                    }`}
                  />
                </div>
              ))}
            </div>

            <p className={`mt-2 text-[10px] ${theme.progressText} opacity-70 text-center`}>
              Mohon tunggu — data sedang divalidasi &amp; disimpan ke database
            </p>
          </div>
        )}

        {/* Shimmer keyframe injected via style tag */}
        {isUploading && (
          <style>{`
            @keyframes shimmer {
              0%   { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
          `}</style>
        )}

        {/* Result Notification Banner */}
        {result && !isUploading && (
          <div
            className={`mt-3 rounded-xl border p-3 text-xs animate-fadeIn ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span>{result.success ? '✅ Berhasil!' : '⚠️ Perhatian:'}</span>
                  <span>{result.message}</span>
                </div>
                {result.total !== undefined && (
                  <div className="flex items-center gap-3 text-[11px] mt-1">
                    <span className="font-semibold text-green-700">
                      ✓ {result.successCount ?? 0} data tersimpan ke DB
                    </span>
                    {(result.failedCount ?? 0) > 0 && (
                      <span className="font-semibold text-red-600">
                        ✕ {result.failedCount} baris gagal/dilewati
                      </span>
                    )}
                  </div>
                )}
                {/* Mini recap progress bar in result */}
                {result.total !== undefined && result.total > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
                        style={{
                          width: `${Math.round(((result.successCount ?? 0) / result.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-right">
                      {Math.round(((result.successCount ?? 0) / result.total) * 100)}% berhasil dari {result.total} baris
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-gray-400 hover:text-gray-700 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Detail error link */}
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-100 flex items-center justify-between">
                <span className="text-[11px] text-red-700 font-medium">
                  {result.errors.length} baris membutuhkan perhatian
                </span>
                <button
                  type="button"
                  onClick={() => setShowErrorModal(true)}
                  className="font-bold underline text-[11px] text-red-800 hover:text-red-950 cursor-pointer"
                >
                  Lihat Rincian Baris Gagal ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-2">
        <button
          type="button"
          disabled={disabled || !file || isUploading}
          onClick={handleUpload}
          className={`w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl px-4 text-xs font-bold transition select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs ${theme.btn}`}
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Mengimpor... {Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <span>📥</span>
              <span>{buttonLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* Error Details Modal */}
      {result?.errors && result.errors.length > 0 && (
        <Modal
          open={showErrorModal}
          title={`Rincian Baris Gagal · ${title}`}
          onClose={() => setShowErrorModal(false)}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end">
              <Button onClick={() => setShowErrorModal(false)}>Tutup</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Baris berikut pada file Excel/CSV tidak dapat diimpor karena format atau data yang belum sesuai:
            </p>
            <div className="table-wrap max-h-60 overflow-y-auto border rounded-xl">
              <table>
                <thead>
                  <tr>
                    <th className="w-20 text-center">Baris Excel</th>
                    <th>Pesan Masalah</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, idx) => (
                    <tr key={idx}>
                      <td className="text-center font-mono font-bold text-red-700">Baris {err.row}</td>
                      <td className="text-xs text-gray-700">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-[11px] text-blue-900">
              💡 <b>Tips:</b> Pastikan NIS dan data sesuai dengan template. Anda dapat mengunduh format template resmi dengan menekan tombol &quot;Template&quot; di pojok kanan atas kartu.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
