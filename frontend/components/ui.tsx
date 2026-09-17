'use client';
import React from 'react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const s = {
    primary: 'bg-[#2457d6] text-white hover:bg-[#1a45b0] active:scale-[0.98] transition',
    secondary: 'border border-[#d7deea] bg-white text-[#344054] hover:bg-gray-50 active:scale-[0.98] transition',
    danger: 'bg-[#c7352a] text-white hover:bg-[#a5281e] active:scale-[0.98] transition',
    ghost: 'text-[#2457d6] hover:bg-[#edf3ff] active:scale-[0.98] transition',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 h-10 rounded-xl px-4 text-sm font-bold disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${s[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div {...props} className={`card p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`h-10 w-full rounded-xl border border-[#d7deea] bg-white px-3 text-sm outline-none transition focus:border-[#2457d6] focus:ring-2 focus:ring-[#2457d6]/20 ${p.className ?? ''}`}
    />
  );
}

export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={`h-10 w-full rounded-xl border border-[#d7deea] bg-white px-3 text-sm outline-none transition focus:border-[#2457d6] focus:ring-2 focus:ring-[#2457d6]/20 cursor-pointer ${p.className ?? ''}`}
    />
  );
}

export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      className={`min-h-24 w-full rounded-xl border border-[#d7deea] bg-white p-3 text-sm outline-none transition focus:border-[#2457d6] focus:ring-2 focus:ring-[#2457d6]/20 ${p.className ?? ''}`}
    />
  );
}

export function Label({
  children,
  className = '',
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-xs font-bold text-[#475467] ${className}`}>
      {children}
    </label>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-3xl',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`max-h-[92vh] w-full ${maxWidth} overflow-auto rounded-2xl bg-white shadow-2xl`}>
        <div className="flex justify-between items-center border-b p-5 sticky top-0 bg-white z-10">
          <h2 className="font-black text-lg text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t p-4 bg-gray-50 sticky bottom-0 z-10">{footer}</div>}
      </div>
    </div>
  );
}

export interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showPageSizeSelect?: boolean;
  label?: string;
}

export function Pagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  showPageSizeSelect = true,
  label = 'data',
}: PaginationProps) {
  const isAll = pageSize <= 0 || pageSize >= totalItems;
  const effectivePageSize = isAll ? (totalItems || 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : isAll ? 1 : (validPage - 1) * pageSize + 1;
  const endItem = isAll ? totalItems : Math.min(validPage * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (validPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages];
  };

  return (
    <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600 select-none ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Menampilkan <b>{startItem}</b>–<b>{endItem}</b> dari <b>{totalItems}</b> {label}
        </span>
        {showPageSizeSelect && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">Batas:</span>
            <select
              className="h-8 rounded-lg border border-[#d7deea] bg-white px-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer hover:border-gray-400 focus:border-[#2457d6]"
              value={pageSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                onPageSizeChange(val);
                onPageChange(1);
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
              <option value={999999}>Semua ({totalItems})</option>
            </select>
          </div>
        )}
      </div>

      {!isAll && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 items-center justify-center rounded-lg border border-[#d7deea] bg-white px-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            disabled={validPage <= 1}
            onClick={() => onPageChange(validPage - 1)}
          >
            ‹ Sebelumnya
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-1 text-gray-400">
                    …
                  </span>
                );
              }
              const num = p as number;
              const active = num === validPage;
              return (
                <button
                  key={num}
                  type="button"
                  className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-[#10285f] text-white shadow-xs'
                      : 'border border-[#d7deea] bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => onPageChange(num)}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="flex h-8 items-center justify-center rounded-lg border border-[#d7deea] bg-white px-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            disabled={validPage >= totalPages}
            onClick={() => onPageChange(validPage + 1)}
          >
            Berikutnya ›
          </button>
        </div>
      )}
    </div>
  );
}

