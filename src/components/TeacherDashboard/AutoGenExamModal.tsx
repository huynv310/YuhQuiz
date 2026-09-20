import React, { useState } from 'react';
import { X, Plus, Trash2, Shuffle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getQuestionImageUrl } from '../../lib/imageUpload';
import { DIFFICULTY_LABELS } from '../../constants/chapters';
import { SUBJECT_PRESETS, GRADES } from '../../constants/subjectPresets';
import { pickRandomByMatrix, assembleExam, MatrixRow, Part } from '../../utils/autoGen';

interface Props {
  questions: any[];
  currentUser?: any;
  onClose: () => void;
}

export const AutoGenExamModal: React.FC<Props> = ({ questions, currentUser, onClose }) => {
  const [title, setTitle] = useState('Đề ngẫu nhiên từ Kho bài tập');
  const [duration, setDuration] = useState(50);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState<number | ''>('');
  const pool = questions.filter(q => (q.subject || 'Toán') === subject && (grade === '' || q.grade === grade));
  const tags = Array.from(new Set(pool.flatMap(q => q.topic_tags || []))).sort();
  const [rows, setRows] = useState<MatrixRow[]>([{ part: 1, tag: '', difficulty: 1, count: 5 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const available = (r: MatrixRow) =>
    pool.filter(q => (q.part ?? 1) === r.part && (!r.tag || (q.topic_tags || []).includes(r.tag)) && q.difficulty === r.difficulty).length;

  const update = (i: number, patch: Partial<MatrixRow>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const generate = async () => {
    setError(null);
    const picked = pickRandomByMatrix(pool, rows);
    if ('error' in picked) return setError(picked.error);
    if (picked.questions.length === 0) return setError('Ma trận chưa chọn câu nào.');
    if (grade === '') return setError('Vui lòng chọn khối lớp (1 – 12).');
    for (const part of [1, 2, 3]) {
      if (picked.questions.filter(q => (q.part ?? 1) === part).length > 100) return setError('Mỗi phần tối đa 100 câu.');
    }
    const asm = assembleExam(picked.questions);
    const qs = asm.ordered;

    setBusy(true);
    try {
      const config = {
        sections: asm.sections,
        question_images: qs.map(q => getQuestionImageUrl(q.content_image_url)),
        source: 'question_bank',
      };
      const { data: exam, error: e1 } = await supabase.from('exams').insert({
        title: title.trim() || 'Đề ngẫu nhiên',
        subject,
        grade,
        teacher_name: currentUser?.full_name || currentUser?.user_metadata?.full_name || '',
        duration_minutes: duration,
        config,
        is_private: false,
      }).select().single();
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('exam_answer_keys').upsert({
        exam_id: exam.id,
        ...asm.keys,
        solutions: asm.solutions,
      });
      if (e2) throw e2;
      setDoneId(exam.short_id || exam.id);
    } catch (e: any) {
      setError(e?.message || 'Không tạo được đề');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2"><Shuffle className="w-4 h-4" /> Tạo đề ngẫu nhiên theo ma trận</h2>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>

        {doneId ? (
          <div className="space-y-3">
            <p className="text-emerald-700 font-semibold">Đã tạo đề (mã: {doneId}). Vào tab "Kho đề thi" để giao cho lớp.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Đóng</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-[1fr_140px_120px_100px] gap-2">
              <label className="col-span-2 sm:col-span-1">Tên đề<input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label>Môn
                <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-2">
                  {Object.keys(SUBJECT_PRESETS).map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>Khối *
                <select value={grade} onChange={e => setGrade(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border rounded-lg px-2 py-2">
                  <option value="">— Chọn —</option>
                  {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>
              </label>
              <label>Phút<input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value) || 1)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_130px_80px_auto] gap-2 items-center">
                  <select value={r.part} onChange={e => update(i, { part: Number(e.target.value) as Part })} className="border rounded-lg px-2 py-2">
                    <option value={1}>Phần I</option><option value={2}>Phần II</option><option value={3}>Phần III</option>
                  </select>
                  <select value={r.tag} onChange={e => update(i, { tag: e.target.value })} className="border rounded-lg px-2 py-2">
                    <option value="">Mọi #tag</option>
                    {tags.map(c => <option key={c} value={c}>#{c}</option>)}
                  </select>
                  <select value={r.difficulty} onChange={e => update(i, { difficulty: Number(e.target.value) })} className="border rounded-lg px-2 py-2">
                    {[1, 2, 3, 4].map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                  </select>
                  <input type="number" min={1} max={100} value={r.count} onChange={e => update(i, { count: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} className="border rounded-lg px-2 py-2" />
                  <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} disabled={rows.length === 1} aria-label="Xóa dòng" className="text-rose-500 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  <p className="col-span-5 -mt-1 text-xs text-slate-400">Kho có {available(r)} câu phù hợp</p>
                </div>
              ))}
              <button onClick={() => setRows(prev => [...prev, { part: 1 as Part, tag: '', difficulty: 1, count: 5 }])} className="px-3 py-1.5 border rounded-lg flex items-center gap-1"><Plus className="w-4 h-4" /> Thêm dòng ma trận</button>
            </div>

            {error && <p className="text-rose-600">{error}</p>}
            <p className="text-xs text-slate-400">Đề tự sắp xếp theo Phần I → II → III, thang 10 điểm chia 3:4:3 cho các phần có câu hỏi (phần vắng thì dồn điểm cho phần còn lại). Thứ tự câu trong mỗi phần giữ theo ma trận.</p>
            <button onClick={generate} disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
              {busy ? 'Đang tạo…' : 'Tạo đề'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
