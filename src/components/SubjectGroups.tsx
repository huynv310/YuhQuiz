import React from 'react';
import { Search, Hash } from 'lucide-react';
import { SUBJECT_PRESETS, GRADES } from '../constants/subjectPresets';

interface ExamLike { subject: string; grade?: number | null; title: string; short_id?: string | null; id: string }

/** Tìm theo tên (không phân biệt dấu/hoa thường) hoặc mã đề; lọc theo khối. */
export function filterExams<T extends ExamLike>(items: T[], query: string, grade: number | 'all', subject: string = 'all'): T[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const q = fold(query.trim());
  return items.filter(e =>
    (grade === 'all' || e.grade === grade) && (subject === 'all' || e.subject === subject) &&
    (!q || fold(e.title).includes(q) || (e.short_id || '').toLowerCase().includes(q) || e.id.toLowerCase() === q));
}

export const ExamSearchBar: React.FC<{
  query: string; onQuery: (v: string) => void;
  grade: number | 'all'; onGrade: (v: number | 'all') => void;
  subject: string; onSubject: (v: string) => void;
}> = ({ query, onQuery, grade, onGrade, subject, onSubject }) => (
  <div className="flex flex-wrap gap-2">
    <label className="relative flex-1 min-w-[160px]">
      <span className="sr-only">Tìm đề theo tên hoặc mã</span>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mutedForeground" />
      <input value={query} onChange={e => onQuery(e.target.value)} placeholder="Tìm theo tên hoặc mã đề…" className="field pl-9" />
    </label>
    <select aria-label="Lọc theo môn" value={subject} onChange={e => onSubject(e.target.value)} className="field w-auto">
      <option value="all">Mọi môn</option>
      {Object.keys(SUBJECT_PRESETS).map(s => <option key={s} value={s}>{s}</option>)}
    </select>
    <select aria-label="Lọc theo khối" value={grade} onChange={e => onGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="field w-auto">
      <option value="all">Mọi khối</option>
      {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
    </select>
  </div>
);

/** Chip mã đề + khối, dùng chung cho mọi thẻ đề. */
export const ExamIdChips: React.FC<{ exam: { short_id?: string | null; grade?: number | null } }> = ({ exam }) => (
  <>
    {exam.grade ? <span className="chip chip-muted">Khối {exam.grade}</span> : null}
    {exam.short_id ? <span className="chip chip-muted font-mono"><Hash className="w-3 h-3" />{exam.short_id}</span> : null}
  </>
);

/** Nhóm đề theo môn — mỗi môn một vùng riêng, không trộn lẫn. */
export function SubjectGroups<T extends ExamLike>({ items, renderItem, empty = 'Không có đề phù hợp.' }: {
  items: T[]; renderItem: (item: T) => React.ReactNode; empty?: string;
}) {
  if (items.length === 0) return <div className="card border-dashed p-8 text-center text-sm text-mutedForeground">{empty}</div>;
  const order = Object.keys(SUBJECT_PRESETS);
  const groups = new Map<string, T[]>();
  items.forEach(e => groups.set(e.subject, [...(groups.get(e.subject) || []), e]));
  const subjects = Array.from(groups.keys()).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'vi');
  });
  return (
    <div className="space-y-6">
      {subjects.map(sub => (
        <section key={sub} aria-labelledby={`subj-${sub}`} className="space-y-3">
          <h3 id={`subj-${sub}`} className="flex items-center gap-2 text-sm font-bold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: SUBJECT_PRESETS[sub]?.color || '#64748B' }} />
            {sub}
            <span className="chip chip-muted">{groups.get(sub)!.length}</span>
          </h3>
          <div className="space-y-3">{groups.get(sub)!.map(it => <React.Fragment key={it.id}>{renderItem(it)}</React.Fragment>)}</div>
        </section>
      ))}
    </div>
  );
}
