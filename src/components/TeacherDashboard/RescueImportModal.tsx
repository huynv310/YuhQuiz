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
  file?: unknown;
  studentNameInFile?: string;
  classNameInFile?: string;
  studentId: string;
  result?: string;
  fraud?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const RescueImportModal: React.FC<Props> = ({ exam, onClose, onDone }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const loadStudents = async () => {
    // Danh sách phải là THÍ SINH ĐÃ THAM GIA THI đề này (có phiên start_attempt trong
    // submissions, ở mọi trạng thái), KHÔNG phải học sinh trong lớp giáo viên quản lý — đề
    // công khai thì học sinh ngoài lớp vẫn làm được, và họ mới là người cần cứu hộ khi mất mạng.
    const { data: subs } = await supabase
      .from('submissions')
      .select('student_id, student_name, class_name')
      .eq('exam_id', exam.id)
      .in('status', ['in_progress', 'submitted']);
    const seen = new Map<string, Student>();
    (subs || []).forEach((s: any) => {
      if (s.student_id && !seen.has(s.student_id)) {
        seen.set(s.student_id, { id: s.student_id, name: s.student_name || '(không tên)', className: s.class_name || '' });
      }
    });
    setStudents(Array.from(seen.values()));
  };

  useEffect(() => { loadStudents(); }, [exam.id]);

  // Học sinh mất mạng NGAY TỪ ĐẦU thì start_attempt() chưa từng tới được máy chủ — không để
  // lại dấu vết nào trong submissions nên không có trong danh sách trên. Cho giáo viên tra
  // đúng học sinh bằng mã số (hiện trong hồ sơ cá nhân của học sinh) để vẫn chọn được.
  const lookupByCode = async () => {
    if (!lookupCode.trim()) return;
    setLookupBusy(true);
    setLookupError('');
    const { data, error } = await supabase.rpc('teacher_lookup_student_by_code', { p_code: lookupCode.trim() });
    setLookupBusy(false);
    if (error || !data || data.length === 0) {
      setLookupError('Không tìm thấy học sinh với mã này');
      return;
    }
    const found = data[0];
    setStudents(prev => prev.some(s => s.id === found.id) ? prev : [...prev, { id: found.id, name: found.full_name, className: found.school || '' }]);
    setLookupCode('');
  };

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
        if (j.v !== 2) throw new Error('File không đúng định dạng mã hóa mới — hãy nhờ học sinh xuất lại file');
        if (j.examId && j.examId !== exam.id && j.examId !== (exam as any).short_id) throw new Error('File thuộc đề khác');
        if (typeof j.sessionToken !== 'string' || !UUID_RE.test(j.sessionToken)) throw new Error('Thiếu sessionToken hợp lệ');
        if (!j.iv || !j.ct || !j.mac) throw new Error('File thiếu dữ liệu mã hóa/chữ ký');
        next.push({
          fileName: f.name, file: j, studentNameInFile: j.studentName, classNameInFile: j.className,
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
      if (r.error || !r.studentId || r.result?.startsWith('✓') || r.fraud) { out.push(r); continue; }
      const classNameFromRoster = students.find(s => s.id === r.studentId)?.className;
      // Server tự giải mã + xác minh chữ ký bằng rescue_secret lưu ở submissions — trình duyệt
      // giáo viên không đọc được nội dung thật của file, chỉ chuyển tiếp nguyên vẹn.
      const { data, error } = await supabase.rpc('teacher_import_rescue', {
        p_exam_id: exam.id, p_student_id: r.studentId, p_file: r.file,
        p_class_name: r.classNameInFile || classNameFromRoster || null,
      });
      if (error) { out.push({ ...r, result: `✗ ${error.message}` }); continue; }
      if (data?.status === 'fraud_detected') {
        out.push({ ...r, result: '⚠ Nghi vấn gian lận — 0 điểm (file bị sửa đổi)', fraud: true });
      } else {
        out.push({ ...r, result: `✓ ${data?.score} điểm` });
      }
    }
    setRows(out);
    setBusy(false);
    if (out.some(r => r.result?.startsWith('✓') || r.fraud)) onDone();
  };

  const ready = rows.filter(r => !r.error && r.studentId && !r.result).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center yq-overlay p-4">
      <div className="glass-panel rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><LifeBuoy className="w-5 h-5" /> Nhập file cứu hộ — {exam.title}</h3>
          <button onClick={onClose} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Chọn các file <b>.yuhquiz</b> học sinh gửi khi mất mạng. Hệ thống chấm lại bằng đáp án trên máy chủ; chỉ nhập được cho thí sinh đã thật sự bắt đầu làm đề này.
        </p>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm font-semibold hover:bg-gray-50">
          <Upload className="w-4 h-4" /> Chọn file…
          <input type="file" multiple accept=".yuhquiz,application/json" className="hidden"
                 onChange={e => handleFiles(e.target.files)} />
        </label>

        <div className="mt-3 flex items-center gap-2">
          <input value={lookupCode} onChange={e => { setLookupCode(e.target.value); setLookupError(''); }}
                 onKeyDown={e => e.key === 'Enter' && lookupByCode()}
                 placeholder="Không thấy học sinh? Nhập mã số HS (VD: HS3F7K2A)…"
                 className="flex-1 border rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={lookupByCode} disabled={lookupBusy || !lookupCode.trim()}
                  className="px-3 py-1.5 rounded-lg border text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
            {lookupBusy ? 'Đang tìm…' : 'Tìm'}
          </button>
        </div>
        {lookupError && <p className="text-xs text-red-600 mt-1">{lookupError}</p>}

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
                  <td className={r.result?.startsWith('✓') ? 'text-emerald-600' : r.fraud ? 'text-amber-600 font-bold' : 'text-red-600'}>{r.result}</td>
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
