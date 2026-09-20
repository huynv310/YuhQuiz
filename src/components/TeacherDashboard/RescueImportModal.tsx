import React, { useEffect, useState } from 'react';
import { X, Upload, LifeBuoy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exam } from '../../types/exam';

interface Props {
  exam: Exam;
  onClose: () => void;
  onDone: () => void;
}

interface Student { id: string; name: string; className: string }
interface Row {
  fileName: string;
  error?: string;
  sessionToken?: string;
  studentNameInFile?: string;
  answers?: unknown;
  cheatCount?: number;
  totalAwaySecs?: number;
  studentId: string;
  result?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const RescueImportModal: React.FC<Props> = ({ exam, onClose, onDone }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: mem } = await supabase
        .from('class_memberships')
        .select('student_id, classrooms(name)');
      const ids = Array.from(new Set((mem || []).map((m: any) => m.student_id)));
      if (!ids.length) return;
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameOf = new Map((profs || []).map((p: any) => [p.id, p.full_name as string]));
      setStudents((mem || []).map((m: any) => ({
        id: m.student_id,
        name: nameOf.get(m.student_id) || '(không tên)',
        className: m.classrooms?.name || '',
      })));
    })();
  }, []);

  const matchStudent = (name?: string): string => {
    if (!name) return '';
    const hits = students.filter(s => norm(s.name) === norm(name));
    return hits.length === 1 ? hits[0].id : '';
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Row[] = [];
    for (const f of Array.from(files)) {
      try {
        const j = JSON.parse(await f.text());
        if (j.examId !== exam.id && j.examId !== (exam as any).short_id) throw new Error('File thuộc đề khác');
        if (typeof j.sessionToken !== 'string' || !UUID_RE.test(j.sessionToken)) throw new Error('Thiếu sessionToken hợp lệ');
        if (!j.answers || typeof j.answers !== 'object') throw new Error('Thiếu câu trả lời');
        next.push({
          fileName: f.name, sessionToken: j.sessionToken, studentNameInFile: j.studentName,
          answers: j.answers, cheatCount: Number(j.cheatCount) || 0, totalAwaySecs: Number(j.totalAwaySecs) || 0,
          studentId: matchStudent(j.studentName),
        });
      } catch (e: any) {
        next.push({ fileName: f.name, error: e?.message || 'File không hợp lệ', studentId: '' });
      }
    }
    setRows(next);
  };

  const setStudent = (i: number, id: string) =>
    setRows(rs => rs.map((r, k) => (k === i ? { ...r, studentId: id } : r)));

  const importAll = async () => {
    setBusy(true);
    const out: Row[] = [];
    for (const r of rows) {
      if (r.error || !r.studentId || r.result?.startsWith('✓')) { out.push(r); continue; }
      const { data, error } = await supabase.rpc('teacher_import_rescue', {
        p_exam_id: exam.id, p_student_id: r.studentId, p_session_token: r.sessionToken,
        p_answers: r.answers, p_cheat_count: r.cheatCount, p_total_away_seconds: r.totalAwaySecs,
      });
      out.push({ ...r, result: error ? `✗ ${error.message}` : `✓ ${data?.score} điểm` });
    }
    setRows(out);
    setBusy(false);
    if (out.some(r => r.result?.startsWith('✓'))) onDone();
  };

  const ready = rows.filter(r => !r.error && r.studentId && !r.result?.startsWith('✓')).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center yq-overlay p-4">
      <div className="glass-panel rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><LifeBuoy className="w-5 h-5" /> Nhập file cứu hộ — {exam.title}</h3>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Chọn các file <b>.yuhquiz</b> học sinh gửi khi mất mạng. Hệ thống chấm lại bằng đáp án trên máy chủ; chỉ nhập được cho học sinh thuộc lớp của bạn.
        </p>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm font-semibold hover:bg-gray-50">
          <Upload className="w-4 h-4" /> Chọn file…
          <input type="file" multiple accept=".yuhquiz,application/json" className="hidden"
                 onChange={e => handleFiles(e.target.files)} />
        </label>

        {rows.length > 0 && (
          <table className="w-full text-sm mt-4">
            <thead><tr className="text-left text-gray-500">
              <th className="py-1">File</th><th>Học sinh</th><th>Kết quả</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-2 break-all">{r.fileName}<div className="text-xs text-gray-400">{r.studentNameInFile}</div></td>
                  <td className="pr-2">
                    {r.error ? <span className="text-red-600">{r.error}</span> : (
                      <select value={r.studentId} onChange={e => setStudent(i, e.target.value)}
                              className="border rounded px-2 py-1 max-w-[220px]">
                        <option value="">— chọn học sinh —</option>
                        {students.map(s => <option key={s.id + s.className} value={s.id}>{s.name} ({s.className})</option>)}
                      </select>
                    )}
                  </td>
                  <td className={r.result?.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}>{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border text-sm">Đóng</button>
          <button onClick={importAll} disabled={busy || ready === 0}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
            {busy ? 'Đang nhập…' : `Nhập ${ready} bài`}
          </button>
        </div>
      </div>
    </div>
  );
};
