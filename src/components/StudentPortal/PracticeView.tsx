import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Dumbbell, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getQuestionImageUrl } from '../../lib/imageUpload';
import { SUBJECT_PRESETS, GRADES } from '../../constants/subjectPresets';
import { DIFFICULTY_LABELS } from '../../constants/chapters';
import { parsePart2Key, normalizePart3Key } from '../../utils/autoGen';
import { SolutionView } from '../SolutionView';
import { useReveal } from '../../lib/motion';

interface PQuestion { id: string; subject: string; grade: number; topic_tags: string[]; part: number; difficulty: number; content_image_url: string }
interface PKey { id: string; part: number; correct_key: string; solution_text: string | null; solution_files: any[] }
type Ans = string | Record<string, boolean>;

const isCorrect = (q: PQuestion, key: PKey, a: Ans | undefined): boolean => {
  if (a === undefined) return false;
  if (q.part === 1) return a === key.correct_key.toUpperCase();
  if (q.part === 2) {
    const k = parsePart2Key(key.correct_key);
    const m = a as Record<string, boolean>;
    return ['a', 'b', 'c', 'd'].every(s => m[s] === k[s]);
  }
  const x = normalizePart3Key(String(a)), y = normalizePart3Key(key.correct_key);
  return x === y || (x !== '' && !isNaN(Number(x)) && Number(x) === Number(y));
};

export const PracticeView: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState(0);
  const [tag, setTag] = useState('');
  const [part, setPart] = useState(0);
  const [count, setCount] = useState(10);
  const [tags, setTags] = useState<string[]>([]);
  const [qs, setQs] = useState<PQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [keys, setKeys] = useState<Record<string, PKey> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('practice_tags', { p_subject: subject || null, p_grade: grade || null })
      .then(({ data }) => { setTags((data as string[]) || []); setTag(''); });
  }, [subject, grade]);

  const start = async () => {
    setBusy(true); setError(null); setKeys(null); setAnswers({});
    const { data, error } = await supabase.rpc('practice_list', {
      p_subject: subject || null, p_grade: grade || null, p_tag: tag || null, p_part: part || null, p_limit: count,
    });
    setBusy(false);
    if (error) return setError('Không tải được câu hỏi. Vui lòng thử lại.');
    const list = (data as PQuestion[]) || [];
    if (!list.length) setError('Chưa có câu hỏi phù hợp. Hãy thử bỏ bớt bộ lọc.');
    setQs(list.length ? list : null);
  };

  const check = async () => {
    if (!qs) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc('practice_check', { p_ids: qs.map(q => q.id) });
    setBusy(false);
    if (error) return setError('Không lấy được đáp án. Vui lòng thử lại.');
    setKeys(Object.fromEntries(((data as PKey[]) || []).map(k => [k.id, k])));
  };

  const setAns = (id: string, v: Ans) => !keys && setAnswers(p => ({ ...p, [id]: v }));
  const correctCount = keys && qs ? qs.filter(q => keys[q.id] && isCorrect(q, keys[q.id], answers[q.id])).length : 0;

  return (
    <div ref={rootRef} className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div data-reveal className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary text-white grid place-items-center"><Dumbbell className="w-6 h-6" /></div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Luyện tập</h1>
          <p className="text-sm text-slate-500">Làm tự do các câu trong kho bài tập của giáo viên, bấm “Kiểm tra” để xem đáp án.</p>
        </div>
      </div>

      <div data-reveal className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
        <select className="field" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Môn">
          <option value="">Mọi môn</option>
          {Object.keys(SUBJECT_PRESETS).map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="field" value={grade} onChange={e => setGrade(Number(e.target.value))} aria-label="Khối">
          <option value={0}>Mọi khối</option>
          {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
        </select>
        <select className="field" value={tag} onChange={e => setTag(e.target.value)} aria-label="Chủ đề">
          <option value="">Mọi #tag</option>
          {tags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
        <select className="field" value={part} onChange={e => setPart(Number(e.target.value))} aria-label="Dạng câu">
          <option value={0}>Mọi dạng</option>
          <option value={1}>Phần I · Trắc nghiệm</option>
          <option value={2}>Phần II · Đúng/Sai</option>
          <option value={3}>Phần III · Trả lời ngắn</option>
        </select>
        <select className="field" value={count} onChange={e => setCount(Number(e.target.value))} aria-label="Số câu">
          {[5, 10, 20, 30].map(n => <option key={n} value={n}>{n} câu</option>)}
        </select>
        <button onClick={start} disabled={busy} className="btn btn-primary col-span-2 md:col-span-5">
          {qs ? <><RefreshCw className="w-4 h-4" /> Bộ câu hỏi mới</> : 'Bắt đầu luyện tập'}
        </button>
      </div>

      {error && <div role="alert" className="card p-3 text-sm text-rose-600">{error}</div>}

      {qs && (
        <>
          {keys && (
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-primary">{correctCount}/{qs.length}</div>
              <div className="text-sm text-slate-500">câu đúng</div>
            </div>
          )}
          <ol className="space-y-4">
            {qs.map((q, i) => {
              const k = keys?.[q.id];
              const ok = k ? isCorrect(q, k, answers[q.id]) : null;
              const a = answers[q.id];
              return (
                <li key={q.id} className="card p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-extrabold text-sm text-slate-800">Câu {i + 1}</span>
                    <span className="chip chip-muted">{q.subject} · Khối {q.grade}</span>
                    <span className="chip chip-muted">{DIFFICULTY_LABELS[q.difficulty] || `Mức ${q.difficulty}`}</span>
                    {(q.topic_tags || []).map(t => <span key={t} className="chip chip-primary">#{t}</span>)}
                    {ok === true && <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 className="w-4 h-4" /> Đúng</span>}
                    {ok === false && <span className="ml-auto inline-flex items-center gap-1 text-rose-500 font-bold"><XCircle className="w-4 h-4" /> Sai</span>}
                  </div>
                  <img src={getQuestionImageUrl(q.content_image_url)} alt={`Đề câu ${i + 1}`} loading="lazy" className="w-full rounded-xl border bg-white" />

                  {q.part === 1 && (
                    <div className="flex gap-2">
                      {['A', 'B', 'C', 'D'].map(o => {
                        const picked = a === o, isKey = k && k.correct_key.toUpperCase() === o;
                        const cls = k ? (isKey ? 'bg-emerald-500 text-white border-emerald-500' : picked ? 'bg-rose-500 text-white border-rose-500' : 'opacity-40')
                                      : picked ? 'bg-primary text-white border-primary' : 'bg-white hover:border-primary';
                        return <button key={o} onClick={() => setAns(q.id, o)} className={`w-10 h-10 rounded-full border font-bold ${cls}`}>{o}</button>;
                      })}
                    </div>
                  )}

                  {q.part === 2 && (
                    <div className="grid grid-cols-2 gap-2">
                      {['a', 'b', 'c', 'd'].map(s => {
                        const m = (a as Record<string, boolean>) || {};
                        const kk = k ? parsePart2Key(k.correct_key)[s] : undefined;
                        return (
                          <div key={s} className="flex items-center gap-2 text-sm">
                            <span className="font-bold w-5">{s})</span>
                            {[true, false].map(v => {
                              const picked = m[s] === v;
                              const cls = k ? (kk === v ? 'bg-emerald-500 text-white border-emerald-500' : picked ? 'bg-rose-500 text-white border-rose-500' : 'opacity-40')
                                            : picked ? 'bg-primary text-white border-primary' : 'bg-white hover:border-primary';
                              return <button key={String(v)} onClick={() => setAns(q.id, { ...m, [s]: v })} className={`px-3 py-1 rounded-lg border text-xs font-bold ${cls}`}>{v ? 'Đúng' : 'Sai'}</button>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.part === 3 && (
                    <div className="flex items-center gap-2">
                      <input className="field max-w-[220px] font-mono text-center" disabled={!!k} placeholder="Điền đáp số…"
                             value={(a as string) || ''} onChange={e => setAns(q.id, e.target.value)} />
                      {k && <span className="chip chip-muted font-mono">ĐS: {k.correct_key}</span>}
                    </div>
                  )}

                  {k && q.part !== 3 && ok === false && q.part === 1 && <p className="text-sm text-slate-600">Đáp án đúng: <b>{k.correct_key}</b></p>}
                  {k && <SolutionView solution={{ text: k.solution_text || '', files: k.solution_files }} defaultOpen />}
                </li>
              );
            })}
          </ol>
          {!keys && (
            <button onClick={check} disabled={busy} className="btn btn-primary btn-lg w-full">
              {busy ? 'Đang kiểm tra…' : 'Kiểm tra đáp án'}
            </button>
          )}
        </>
      )}
    </div>
  );
};
