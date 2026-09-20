import React, { useState } from 'react';
import { X, Paperclip, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getQuestionImageUrl, uploadSolutionFile, MAX_SOLUTION_FILES, SolutionFile } from '../../lib/imageUpload';
import { SUBJECT_PRESETS, GRADES } from '../../constants/subjectPresets';
import { DIFFICULTY_LABELS } from '../../constants/chapters';
import { parseHashtags } from '../../utils/hashtags';

interface Props {
  question: any;
  userId: string;
  tagHints: string[];
  onClose: () => void;
  onSaved: () => void;
}

export const EditQuestionModal: React.FC<Props> = ({ question: q, userId, tagHints, onClose, onSaved }) => {
  const [subject, setSubject] = useState<string>(q.subject || 'Toán');
  const [grade, setGrade] = useState<number>(q.grade || 12);
  const [tags, setTags] = useState((q.topic_tags || []).map((t: string) => `#${t}`).join(' '));
  const [part, setPart] = useState<number>(q.part ?? 1);
  const [difficulty, setDifficulty] = useState<number>(q.difficulty || 1);
  const [key, setKey] = useState<string>(q.correct_key || '');
  const [solution, setSolution] = useState<string>(q.solution_text || '');
  const [files, setFiles] = useState<SolutionFile[]>(Array.isArray(q.solution_files) ? q.solution_files : []);
  const [practice, setPractice] = useState<boolean>(q.practice_enabled !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePart = (p: number) => { setPart(p); setKey(p === 1 ? 'A' : p === 2 ? 'TTTT' : ''); };
  const parsed = parseHashtags(tags);

  const addFiles = async (list: File[]) => {
    if (!list.length) return;
    setError(null);
    if (files.length + list.length > MAX_SOLUTION_FILES) return setError(`Tối đa ${MAX_SOLUTION_FILES} tệp lời giải.`);
    setBusy(true);
    try {
      const up: SolutionFile[] = [];
      for (const f of list) up.push(await uploadSolutionFile(userId, f));
      setFiles(prev => [...prev, ...up.filter(u => !prev.some(p => p.path === u.path))]);
    } catch (e: any) { setError(e?.message || 'Không tải được tệp'); }
    setBusy(false);
  };

  const save = async () => {
    setError(null);
    const k = part === 1 ? key.toUpperCase() : part === 2 ? key.toUpperCase() : key.trim().replace(',', '.');
    if (part === 1 && !/^[ABCD]$/.test(k)) return setError('Đáp án phần I phải là A, B, C hoặc D.');
    if (part === 2 && !/^[TF]{4}$/.test(k)) return setError('Phần II cần đủ 4 ý Đúng/Sai.');
    if (part === 3 && !k) return setError('Nhập đáp số cho phần III.');
    setBusy(true);
    const { error: err } = await supabase.from('question_bank').update({
      subject, grade, topic_tags: parsed, part, difficulty, correct_key: k,
      solution_text: solution.trim() || null, solution_files: files, practice_enabled: practice,
    }).eq('id', q.id);
    setBusy(false);
    if (err) return setError('Không lưu được: ' + err.message);
    onSaved();
    onClose();
  };

  const p2 = (key.toUpperCase() + 'TTTT').slice(0, 4).split('');

  return (
    <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-3">
      <div className="glass-panel rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg">Sửa câu hỏi</h3>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <img src={getQuestionImageUrl(q.content_image_url)} alt="" className="w-full max-h-56 object-contain rounded-xl border bg-white" />
        <p className="text-xs text-slate-500">Ảnh đề không đổi được (hãy xóa và cắt lại nếu cần). Đề đã tạo từ câu này giữ nguyên đáp án cũ.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label>Môn
            <select className="field mt-1" value={subject} onChange={e => setSubject(e.target.value)}>
              {Object.keys(SUBJECT_PRESETS).map(s => <option key={s}>{s}</option>)}
            </select></label>
          <label>Khối
            <select className="field mt-1" value={grade} onChange={e => setGrade(Number(e.target.value))}>
              {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
            </select></label>
          <label>Dạng câu
            <select className="field mt-1" value={part} onChange={e => changePart(Number(e.target.value))}>
              <option value={1}>Phần I</option><option value={2}>Phần II</option><option value={3}>Phần III</option>
            </select></label>
          <label>Mức độ
            <select className="field mt-1" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}>
              {[1, 2, 3, 4].map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
            </select></label>
        </div>

        <div>
          <label htmlFor="eq-tags">Hashtag chủ đề</label>
          <input id="eq-tags" className="field mt-1" value={tags} onChange={e => setTags(e.target.value)} placeholder="#đạo-hàm #cực-trị" />
          <div className="mt-1.5 flex flex-wrap gap-1 items-center text-xs">
            {parsed.map(t => <span key={t} className="chip chip-primary">#{t}</span>)}
            {tagHints.filter(t => !parsed.includes(t)).slice(0, 10).map(t =>
              <button type="button" key={t} onClick={() => setTags((p: string) => `${p.trim()} #${t}`)} className="chip chip-muted">+#{t}</button>)}
          </div>
        </div>

        <div>
          <span className="font-semibold">Đáp án đúng</span>
          <div className="mt-1">
            {part === 1 && (
              <div className="flex gap-2">{['A', 'B', 'C', 'D'].map(o =>
                <button type="button" key={o} onClick={() => setKey(o)} className={`w-10 h-10 rounded-full border font-bold ${key.toUpperCase() === o ? 'bg-primary text-white border-primary' : 'bg-white/70'}`}>{o}</button>)}</div>
            )}
            {part === 2 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{['a', 'b', 'c', 'd'].map((s, i) => (
                <label key={s} className="flex items-center gap-2">{s})
                  <select className="field" value={p2[i]} onChange={e => { const n = [...p2]; n[i] = e.target.value; setKey(n.join('')); }}>
                    <option value="T">Đúng</option><option value="F">Sai</option>
                  </select></label>))}</div>
            )}
            {part === 3 && <input className="field max-w-[220px] font-mono" value={key} onChange={e => setKey(e.target.value)} placeholder="vd: -1.5" />}
          </div>
        </div>

        <div>
          <label htmlFor="eq-sol">Lời giải chi tiết</label>
          <textarea id="eq-sol" rows={4} className="field mt-1" value={solution} onChange={e => setSolution(e.target.value)} />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <label className={`btn btn-secondary !py-1.5 ${busy || files.length >= MAX_SOLUTION_FILES ? 'opacity-50 pointer-events-none' : ''}`}>
              <Paperclip className="w-4 h-4" /> Đính kèm ảnh / PDF
              <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            </label>
            {files.map(f => (
              <span key={f.path} className="chip chip-muted">
                {f.type === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : null}{f.name}
                <button type="button" aria-label="Bỏ tệp" onClick={() => setFiles(p => p.filter(x => x.path !== f.path))}><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} /> Cho phép học sinh luyện tập câu này
        </label>

        {error && <div role="alert" className="text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? 'Đang xử lý…' : 'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  );
};
