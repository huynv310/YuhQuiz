import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarClock, Clock, GraduationCap, Hash, ListChecks, Play, ShieldAlert, User, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UUID_RE } from '../../lib/examId';
import { useReveal } from '../../lib/motion';

interface Props {
  examKey: string;                       // UUID hoặc mã 6 ký tự
  currentUser: any;
  profile: any;
  onBack: () => void;
  onStart: (examId: string, className: string) => void;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : null);

export const ExamPrepScreen: React.FC<Props> = ({ examKey, currentUser, profile, onBack, onStart }) => {
  const [exam, setExam] = useState<any>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [window_, setWindow_] = useState<{ start?: string | null; end?: string | null }>({});
  const [done, setDone] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef, [state]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const col = UUID_RE.test(examKey) ? 'id' : 'short_id';
      const val = col === 'short_id' ? examKey.trim().toUpperCase() : examKey;
      const { data: ex } = await supabase.from('public_exams').select('*').eq(col, val).maybeSingle();
      if (!alive) return;
      if (!ex) { setState('missing'); return; }

      const [{ data: mems }, { data: subs }] = await Promise.all([
        supabase.from('class_memberships').select('class_id').eq('student_id', currentUser.id),
        supabase.from('submissions').select('id, score, total_score, status').eq('exam_id', ex.id).eq('student_id', currentUser.id),
      ]);
      const ids = (mems || []).map((m: any) => m.class_id);
      let names: string[] = [];
      let win: { start?: string | null; end?: string | null } = { start: ex.start_at, end: ex.end_at };
      if (ids.length) {
        const { data: as } = await supabase.from('exam_assignments').select('class_id, start_at, end_at').eq('exam_id', ex.id).in('class_id', ids);
        if (as?.length) {
          const { data: cls } = await supabase.from('classrooms').select('id, name').in('id', as.map((a: any) => a.class_id));
          names = (cls || []).map((c: any) => c.name);
          win = { start: as[0].start_at || ex.start_at, end: as[0].end_at || ex.end_at };
        }
      }
      if (!alive) return;
      setExam(ex); setClassNames(names); setWindow_(win);
      setDone((subs || []).find((s: any) => s.status === 'submitted') || null);
      setState('ready');
    })();
    return () => { alive = false; };
  }, [examKey, currentUser?.id]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const counts = useMemo(() => {
    const s = exam?.config?.sections || [];
    return [0, 1, 2].map(i => Number(s[i]?.question_count) || 0);
  }, [exam]);
  const totalQ = counts.reduce((a, b) => a + b, 0);

  const startMs = window_.start ? new Date(window_.start).getTime() : null;
  const endMs = window_.end ? new Date(window_.end).getTime() : null;
  const notYet = startMs !== null && now < startMs;
  const expired = endMs !== null && now > endMs;
  const blockedAgain = !!done && exam?.allow_multiple_attempts === false;
  const canStart = !notYet && !expired && !blockedAgain;

  const wait = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d ? d + ' ngày ' : ''}${h ? h + ' giờ ' : ''}${m} phút ${s % 60} giây`;
  };

  if (state === 'loading') {
    return <div className="min-h-screen grid place-items-center text-mutedForeground text-sm">Đang tải thông tin kỳ thi…</div>;
  }
  if (state === 'missing') {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Không tìm thấy kỳ thi</h1>
          <p className="text-sm text-mutedForeground">Mã <b className="font-mono">{examKey}</b> không tồn tại, đã đóng hoặc bạn chưa được giao đề này.</p>
          <button onClick={onBack} className="btn btn-primary">Về trang chính</button>
        </div>
      </div>
    );
  }

  const rows: [React.ReactNode, string, React.ReactNode][] = [
    [<BookOpen className="w-4 h-4" />, 'Môn học', exam.subject],
    [<GraduationCap className="w-4 h-4" />, 'Khối lớp', `Lớp ${exam.grade}`],
    [<Users className="w-4 h-4" />, 'Lớp được giao', classNames.length ? classNames.join(', ') : 'Đề mở cho mọi học sinh'],
    [<User className="w-4 h-4" />, 'Giáo viên giao đề', exam.teacher_name || 'Giáo viên'],
    [<Clock className="w-4 h-4" />, 'Thời gian làm bài', `${exam.duration_minutes} phút`],
    [<CalendarClock className="w-4 h-4" />, 'Thời hạn', window_.start || window_.end
      ? `${fmt(window_.start) || 'Ngay bây giờ'} → ${fmt(window_.end) || 'Không giới hạn'}` : 'Không giới hạn'],
    [<ListChecks className="w-4 h-4" />, 'Cấu trúc', totalQ
      ? `${totalQ} câu (I: ${counts[0]} · II: ${counts[1]} · III: ${counts[2]})` : 'Xem trong phòng thi'],
  ];

  return (
    <div ref={rootRef} className="min-h-screen">
      <header className="glass-bar">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <button onClick={onBack} className="btn btn-ghost -ml-2"><ArrowLeft className="w-4 h-4" /> Quay lại</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div data-reveal className="space-y-2">
          <span className="chip chip-primary"><Hash className="w-3 h-3" /> Mã đề {exam.short_id}</span>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{exam.title}</h1>
          <p className="text-sm text-mutedForeground">Thí sinh: <b className="text-foreground">{profile?.full_name || currentUser?.email}</b></p>
        </div>

        <dl data-reveal className="card divide-y divide-border">
          {rows.map(([icon, label, val], i) => (
            <div key={i} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">
              <span className="mt-0.5 text-primary">{icon}</span>
              <dt className="w-36 shrink-0 text-sm text-mutedForeground">{label}</dt>
              <dd className="text-sm font-semibold break-words min-w-0">{val}</dd>
            </div>
          ))}
        </dl>

        <ul data-reveal className="text-sm text-mutedForeground space-y-1.5 list-disc pl-5">
          <li>Đồng hồ bắt đầu chạy ngay khi bạn bấm “Bắt đầu làm bài”, không thể tạm dừng.</li>
          <li>Rời khỏi tab hoặc thoát toàn màn hình sẽ được ghi nhận và giáo viên có thể xem.</li>
          <li>Bài làm được lưu nháp tự động; nếu mất mạng khi nộp, hãy tải “File cứu hộ” và gửi cho giáo viên.</li>
        </ul>

        <div data-reveal className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="text-sm">
            {done && <p className="font-semibold">Bạn đã nộp bài: <span className="text-success">{done.score}/{done.total_score ?? 10} điểm</span></p>}
            {blockedAgain && <p className="text-destructive">Đề này chỉ cho làm một lần.</p>}
            {notYet && <p className="text-mutedForeground">Kỳ thi mở sau <b className="text-foreground tabular-nums">{wait(startMs! - now)}</b></p>}
            {expired && <p className="text-destructive">Kỳ thi đã kết thúc lúc {fmt(window_.end)}.</p>}
            {canStart && !done && <p className="text-mutedForeground">Hãy chuẩn bị giấy nháp, máy tính và kết nối ổn định.</p>}
          </div>
          <button
            disabled={!canStart}
            onClick={() => onStart(exam.id, classNames[0] || 'Lớp chung')}
            className="btn btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" /> {done ? 'Làm lại' : 'Bắt đầu làm bài'}
          </button>
        </div>
      </main>
    </div>
  );
};
