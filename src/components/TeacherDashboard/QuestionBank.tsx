import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Database, Plus, Shuffle, Trash2, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getQuestionImageUrl } from '../../lib/imageUpload';
import { DIFFICULTY_LABELS } from '../../constants/chapters';
import { SUBJECT_PRESETS, GRADES } from '../../constants/subjectPresets';
import { SolutionView } from '../SolutionView';
import { EditQuestionModal } from './EditQuestionModal';
import { AutoGenExamModal } from './AutoGenExamModal';

const SnipperModal = lazy(() => import('../SnipperModal').then(m => ({ default: m.SnipperModal })));

interface Props {
  currentUser?: any;
}

const formatKey = (q: any) =>
  (q.part ?? 1) === 2
    ? ['a', 'b', 'c', 'd'].map((s, i) => `${s}-${q.correct_key[i] === 'T' ? 'Đ' : 'S'}`).join(' ')
    : q.correct_key;

export const QuestionBank: React.FC<Props> = ({ currentUser }) => {
  const userId: string | undefined = currentUser?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState(0);
  const [diffFilter, setDiffFilter] = useState(0);
  const [partFilter, setPartFilter] = useState(0);
  const [showSnipper, setShowSnipper] = useState(false);
  const [showAutoGen, setShowAutoGen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('question_bank')
      .select('id, author_id, subject, grade, topic_tags, part, difficulty, content_image_url, correct_key, solution_text, solution_files, practice_enabled')
      .order('created_at', { ascending: false })
      .limit(1000);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tags = useMemo(() => Array.from(new Set(rows.flatMap(r => r.topic_tags || []))).sort(), [rows]);
  const visible = rows.filter(r =>
    (!tagFilter || (r.topic_tags || []).includes(tagFilter)) && (!subjectFilter || r.subject === subjectFilter) && (!gradeFilter || r.grade === gradeFilter) && (!diffFilter || r.difficulty === diffFilter) && (!partFilter || (r.part ?? 1) === partFilter));

  const order = Object.keys(SUBJECT_PRESETS);
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    visible.forEach(q => { const k = q.subject || 'Khác'; m.set(k, [...(m.get(k) || []), q]); });
    return Array.from(m.entries()).sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  }, [visible]);

  const remove = async (id: string) => {
    if (!confirm('Xóa câu hỏi này khỏi Kho bài tập?')) return;
    const { error } = await supabase.from('question_bank').delete().eq('id', id);
    if (error) return alert('Không xóa được: ' + error.message);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-auto">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 mr-auto">
          <Database className="w-5 h-5" /> Kho Bài Tập <span className="text-sm font-normal text-slate-400">({rows.length} câu)</span>
        </h2>
        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="field !w-auto !py-1.5">
          <option value="">Mọi môn</option>
          {Object.keys(SUBJECT_PRESETS).map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={gradeFilter} onChange={e => setGradeFilter(Number(e.target.value))} className="field !w-auto !py-1.5">
          <option value={0}>Mọi khối</option>
          {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
        </select>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="field !w-auto !py-1.5">
          <option value="">Mọi #tag</option>
          {tags.map(c => <option key={c} value={c}>#{c}</option>)}
        </select>
        <select value={diffFilter} onChange={e => setDiffFilter(Number(e.target.value))} className="field !w-auto !py-1.5">
          <option value={0}>Mọi mức độ</option>
          {[1, 2, 3, 4].map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
        <select value={partFilter} onChange={e => setPartFilter(Number(e.target.value))} className="field !w-auto !py-1.5">
          <option value={0}>Mọi phần</option>
          <option value={1}>Phần I</option>
          <option value={2}>Phần II</option>
          <option value={3}>Phần III</option>
        </select>
        <button onClick={() => setShowAutoGen(true)} disabled={rows.length === 0} className="btn btn-secondary disabled:opacity-40">
          <Shuffle className="w-4 h-4" /> Tạo đề ngẫu nhiên
        </button>
        <button onClick={() => setShowSnipper(true)} disabled={!userId} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Cắt câu hỏi từ PDF
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Đang tải…</p>
      ) : visible.length === 0 ? (
        <p className="text-slate-400 text-sm">Chưa có câu hỏi nào. Bấm "Cắt câu hỏi từ PDF" để bắt đầu.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([sub, list]) => (
            <section key={sub}>
              <h3 className="flex items-center gap-2 mb-2 font-extrabold text-slate-800">
                {sub} <span className="chip chip-muted">{list.length} câu</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map(q => (
                <div key={q.id} className="glass-panel rounded-xl p-3 space-y-2">
              <img src={getQuestionImageUrl(q.content_image_url)} alt="" loading="lazy" className="w-full rounded border" />
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{q.subject} · Khối {q.grade}</span>
                {(q.topic_tags || []).map((t: string) => <span key={t} className="px-2 py-0.5 rounded-full bg-primary-light text-primary-dark">#{t}</span>)}
                <span className="px-2 py-0.5 rounded-full bg-slate-100">{DIFFICULTY_LABELS[q.difficulty]}</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Phần {['I', 'II', 'III'][(q.part ?? 1) - 1]}</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Đáp án {formatKey(q)}</span>
                {q.author_id === userId && (
                  <span className="ml-auto flex items-center gap-2">
                    <button onClick={() => setEditing(q)} aria-label="Sửa" title="Sửa câu hỏi" className="text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(q.id)} aria-label="Xóa" title="Xóa" className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </span>
                )}
              </div>
              <SolutionView solution={{ text: q.solution_text, files: q.solution_files }} />
            </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showSnipper && userId && (
        <Suspense fallback={null}>
          <SnipperModal userId={userId} tagHints={tags} onClose={() => setShowSnipper(false)} onSaved={load} />
        </Suspense>
      )}
      {editing && userId && (
        <EditQuestionModal question={editing} userId={userId} tagHints={tags} onClose={() => setEditing(null)} onSaved={load} />
      )}
      {showAutoGen && (
        <AutoGenExamModal questions={rows} currentUser={currentUser} onClose={() => setShowAutoGen(false)} />
      )}
    </div>
  );
};
