import React from 'react';
import { FileText } from 'lucide-react';
import { getQuestionImageUrl, SolutionFile } from '../lib/imageUpload';

export interface SolutionData { text?: string; files?: SolutionFile[] }

/** Chuẩn hóa: dữ liệu cũ là chuỗi, dữ liệu mới là { text, files }. */
export function normalizeSolution(v: unknown): SolutionData {
  if (!v) return {};
  if (typeof v === 'string') return { text: v };
  const o = v as SolutionData;
  return { text: o.text || '', files: Array.isArray(o.files) ? o.files : [] };
}

export const hasSolution = (v: unknown) => {
  const s = normalizeSolution(v);
  return !!(s.text?.trim() || s.files?.length);
};

export const SolutionView: React.FC<{ solution: unknown; label?: string; defaultOpen?: boolean }> = ({ solution, label = 'Lời giải', defaultOpen }) => {
  const s = normalizeSolution(solution);
  if (!hasSolution(s)) return null;
  return (
    <details open={defaultOpen} className="text-sm">
      <summary className="cursor-pointer font-semibold text-primary-dark select-none">{label}</summary>
      {s.text && <p className="mt-1.5 whitespace-pre-wrap text-slate-700">{s.text}</p>}
      {!!s.files?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {s.files.map(f => f.type === 'image'
            ? <a key={f.path} href={getQuestionImageUrl(f.path)} target="_blank" rel="noreferrer">
                <img src={getQuestionImageUrl(f.path)} alt={f.name} loading="lazy" className="max-h-56 rounded-lg border" />
              </a>
            : <a key={f.path} href={getQuestionImageUrl(f.path)} target="_blank" rel="noreferrer" className="chip chip-muted">
                <FileText className="w-3.5 h-3.5" /> PDF · {f.name}
              </a>)}
        </div>
      )}
    </details>
  );
};
