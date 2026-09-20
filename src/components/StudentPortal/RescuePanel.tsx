import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Download, Upload, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RescueRecord, listRescue, removeRescue, saveRescue, downloadRescue, parseRescueFile } from '../../lib/rescue';

interface Props {
  currentUser: any;
  submittedTokens: Set<string>;
  examTitleOf: (examId: string) => string | undefined;
  onSubmitted: () => void;
}

/** Bài làm còn nằm trong máy (mất mạng / chưa nộp): nộp lại, xuất file .yuhquiz, nhập file của chính mình. */
export const RescuePanel: React.FC<Props> = ({ currentUser, submittedTokens, examTitleOf, onSubmitted }) => {
  const [items, setItems] = useState<RescueRecord[]>([]);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listRescue().forEach(r => { if (submittedTokens.has(r.sessionToken)) removeRescue(r.sessionToken); });
    setItems(listRescue().filter(r => !submittedTokens.has(r.sessionToken)));
  }, [submittedTokens]);
  useEffect(refresh, [refresh]);

  const resubmit = async (r: RescueRecord) => {
    setBusy(r.sessionToken);
    const { error } = await supabase.rpc('submit_and_grade_exam', {
      p_exam_id: r.examId, p_session_token: r.sessionToken, p_student_name: r.studentName || currentUser?.email || 'Học sinh',
      p_class_name: r.className || '', p_answers: r.answers, p_cheat_count: r.cheatCount, p_total_away_seconds: r.totalAwaySecs,
      p_student_id: currentUser?.id || null, p_school: currentUser?.school || 'THPT', p_telemetry: [],
    });
    setBusy(null);
    if (error) {
      setMsg(m => ({ ...m, [r.sessionToken]: 'Máy chủ từ chối (có thể đã hết giờ). Hãy xuất file .yuhquiz và gửi giáo viên.' }));
      return;
    }
    removeRescue(r.sessionToken);
    refresh();
    onSubmitted();
  };

  const importFile = async (files: FileList | null) => {
    setNote(null);
    if (!files?.length) return;
    let n = 0;
    for (const f of Array.from(files)) {
      try { saveRescue(await parseRescueFile(f)); n++; }
      catch (e: any) { setNote(`${f.name}: ${e?.message || 'không hợp lệ'}`); }
    }
    if (n) setNote(`Đã nạp ${n} bài. Bấm "Nộp lại" để gửi lên hệ thống.`);
    refresh();
  };

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-amber-500" /> Bài làm chưa nộp được ({items.length})
        </span>
      </div>
      {note && <p className="text-xs text-slate-600">{note}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Không có bài nào bị kẹt. Nếu mất mạng lúc thi, bài làm sẽ được giữ tại đây.</p>
      ) : items.map(r => (
        <div key={r.sessionToken} className="rounded-2xl bg-white/60 border border-white/70 p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[180px]">
            <div className="font-bold text-sm text-slate-900">{r.examTitle || examTitleOf(r.examId) || `Đề ${r.examId.slice(0, 8)}`}</div>
            <div className="text-[11px] text-slate-500">Lưu lúc {new Date(r.timestamp).toLocaleString('vi-VN')}</div>
            {msg[r.sessionToken] && <div className="text-[11px] text-rose-600 mt-1">{msg[r.sessionToken]}</div>}
          </div>
          <button onClick={() => resubmit(r)} disabled={busy === r.sessionToken} className="btn btn-primary !py-1.5">
            <Send className="w-4 h-4" /> {busy === r.sessionToken ? 'Đang nộp…' : 'Nộp lại'}
          </button>
          <button onClick={() => downloadRescue(r)} className="btn btn-secondary !py-1.5"><Download className="w-4 h-4" /> Xuất file</button>
          <button aria-label="Xóa bản lưu" onClick={() => { if (confirm('Xóa bản lưu trong máy? Không thể khôi phục.')) { removeRescue(r.sessionToken); refresh(); } }} className="btn btn-ghost !py-1.5"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
};
