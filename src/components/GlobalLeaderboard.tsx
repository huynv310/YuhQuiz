import React, { useEffect, useState } from 'react';
import { Trophy, Loader2, GraduationCap, Users, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RankIcon, rankColor } from './RankBadge';
import { useSeasonCountdown } from '../hooks/useSeasonCountdown';

interface TeacherRow {
  full_name: string;
  school: string | null;
  exams_count: number;
  rank_tier: string;
}

interface StudentRow {
  full_name: string;
  school: string | null;
  exams_completed: number;
  avg_score: number;
  rank_score: number;
  rank_tier: string;
}

interface GlobalLeaderboardProps {
  /** Vai trò người xem — quyết định bảng nào mở mặc định. */
  defaultRole: 'teacher' | 'student';
  /** Bỏ khung max-width/padding ngoài — dùng khi nơi gọi đã tự bọc container (VD: tab trong ExamList/dashboard). */
  bare?: boolean;
}

const PAGE_SIZE = 30;

const MEDAL_ROW = [
  '',
  'bg-gradient-to-r from-amber-50 via-amber-50/40 to-transparent border-l-4 border-amber-400',
  'bg-gradient-to-r from-slate-100 via-slate-50/40 to-transparent border-l-4 border-slate-300',
  'bg-gradient-to-r from-orange-50 via-orange-50/30 to-transparent border-l-4 border-orange-300',
];

const PositionCell: React.FC<{ pos: number }> = ({ pos }) => (
  <span className={`font-mono font-extrabold ${pos <= 3 ? 'text-base' : 'text-sm text-slate-500'}`}>
    {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`}
  </span>
);

/**
 * Bảng xếp hạng toàn hệ thống — 2 BXH riêng biệt (giáo viên theo số đề đóng góp, học sinh theo
 * điểm xếp hạng có trọng số ưu tiên số lượng đề đã làm), chuyển qua lại bằng tab, không trộn vai
 * trò. Dữ liệu lấy qua RPC get_teacher_leaderboard/get_student_leaderboard (chỉ lộ tên + trường,
 * không có SĐT/email — đã kiểm soát ở tầng DB), tải 1 lần (tối đa 200 dòng theo giới hạn RPC) rồi
 * phân trang phía client — không tốn thêm round-trip khi lật trang.
 *
 * Giao diện giống hệt nhau ở cả Teacher dashboard và Student portal theo yêu cầu.
 */
export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({ defaultRole, bare = false }) => {
  const [tab, setTab] = useState<'teacher' | 'student'>(defaultRole);
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const { label: countdownLabel, resetDate } = useSeasonCountdown();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (tab === 'teacher' && teachers !== null) return;
      if (tab === 'student' && students !== null) return;
      setLoading(true);
      if (tab === 'teacher') {
        const { data } = await supabase.rpc('get_teacher_leaderboard', { p_limit: 200 });
        if (alive) setTeachers(data || []);
      } else {
        const { data } = await supabase.rpc('get_student_leaderboard', { p_limit: 200 });
        if (alive) setStudents(data || []);
      }
      if (alive) setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = (t: 'teacher' | 'student') => {
    setTab(t);
    setPage(0);
  };

  const headPad = 'px-3 py-2';
  const cellPad = 'px-3 py-2.5';
  const iconSize = 30;

  const allRows = tab === 'teacher' ? teachers : students;
  const totalPages = allRows ? Math.max(1, Math.ceil(allRows.length / PAGE_SIZE)) : 1;
  const pageRows = allRows ? allRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : null;
  const pageStart = page * PAGE_SIZE;

  return (
    <div className={bare ? '' : 'max-w-5xl mx-auto w-full px-4 md:px-8'}>
      <div className={bare ? '' : 'py-6'}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="font-extrabold text-lg text-slate-900">Bảng Xếp Hạng Toàn Hệ Thống</h2>
          </div>
          <div
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1"
            title={`Mùa xếp hạng hiện tại kết thúc vào ${resetDate.toLocaleDateString('vi-VN')} — bảng xếp hạng sẽ làm mới, dữ liệu mùa này vẫn được lưu lại.`}
          >
            <Timer className="w-3.5 h-3.5 text-slate-400" />
            Mùa mới sau: <span className="text-primary font-mono">{countdownLabel}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {tab === 'teacher'
            ? 'Xếp theo số đề thi chính thức đã đóng góp và có học sinh nộp bài trong năm học hiện tại.'
            : 'Xếp theo điểm ưu tiên số lượng đề đã làm trong năm học hiện tại — làm càng nhiều đề, điểm xếp hạng càng sát điểm trung bình thật.'}
        </p>

        {/* CHUYỂN ĐỔI BXH GIÁO VIÊN / HỌC SINH — to, rõ, dễ bấm */}
        <div className="grid grid-cols-2 gap-2 mb-5 max-w-md">
          <button
            onClick={() => switchTab('teacher')}
            className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-extrabold transition-all border-2 ${
              tab === 'teacher'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary'
            }`}
          >
            <GraduationCap className="w-5 h-5" /> Giáo viên
          </button>
          <button
            onClick={() => switchTab('student')}
            className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-extrabold transition-all border-2 ${
              tab === 'student'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary'
            }`}
          >
            <Users className="w-5 h-5" /> Học sinh
          </button>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-100">
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bảng xếp hạng...
            </div>
          ) : tab === 'teacher' ? (
            pageRows && pageRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className={`${headPad} w-16`}>Hạng</th>
                      <th className={headPad}>Mức rank</th>
                      <th className={headPad}>Tên</th>
                      <th className={headPad}>Trường công tác</th>
                      <th className={`${headPad} text-right`}>Số đề đóng góp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pageRows as TeacherRow[]).map((t, i) => (
                      <tr key={i} className={`border-b border-slate-50 last:border-0 ${MEDAL_ROW[pageStart + i < 3 ? pageStart + i + 1 : 0]}`}>
                        <td className={cellPad}><PositionCell pos={pageStart + i + 1} /></td>
                        <td className={cellPad}>
                          <span className="inline-flex items-center gap-2">
                            <RankIcon tier={t.rank_tier} size={iconSize} />
                            <span className="font-bold text-xs" style={{ color: rankColor(t.rank_tier) }}>{t.rank_tier}</span>
                          </span>
                        </td>
                        <td className={`${cellPad} font-bold text-sm text-slate-800`}>{t.full_name || '—'}</td>
                        <td className={`${cellPad} text-xs text-slate-500`}>{t.school || '—'}</td>
                        <td className={`${cellPad} text-right font-extrabold text-primary`}>{t.exams_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-10 text-center text-slate-400 text-sm">Chưa có giáo viên nào đủ điều kiện xếp hạng.</p>
            )
          ) : pageRows && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className={`${headPad} w-16`}>Hạng</th>
                    <th className={headPad}>Mức rank</th>
                    <th className={headPad}>Tên</th>
                    <th className={headPad}>Trường</th>
                    <th className={`${headPad} text-right`}>Số đề đã làm</th>
                    <th className={`${headPad} text-right`}>Điểm TB</th>
                    <th className={`${headPad} text-right`}>Điểm xếp hạng</th>
                  </tr>
                </thead>
                <tbody>
                  {(pageRows as StudentRow[]).map((s, i) => (
                    <tr key={i} className={`border-b border-slate-50 last:border-0 ${MEDAL_ROW[pageStart + i < 3 ? pageStart + i + 1 : 0]}`}>
                      <td className={cellPad}><PositionCell pos={pageStart + i + 1} /></td>
                      <td className={cellPad}>
                        <span className="inline-flex items-center gap-2">
                          <RankIcon tier={s.rank_tier} size={iconSize} />
                          <span className="font-bold text-xs" style={{ color: rankColor(s.rank_tier) }}>{s.rank_tier}</span>
                        </span>
                      </td>
                      <td className={`${cellPad} font-bold text-sm text-slate-800`}>{s.full_name || '—'}</td>
                      <td className={`${cellPad} text-xs text-slate-500`}>{s.school || '—'}</td>
                      <td className={`${cellPad} text-right font-bold text-slate-700`}>{s.exams_completed}</td>
                      <td className={`${cellPad} text-right font-bold text-slate-700`}>{Number(s.avg_score).toFixed(1)}</td>
                      <td className={`${cellPad} text-right font-extrabold text-primary`}>{Number(s.rank_score).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-10 text-center text-slate-400 text-sm">Chưa có học sinh nào đủ điều kiện xếp hạng.</p>
          )}
        </div>

        {/* PHÂN TRANG — 30 hạng/trang */}
        {allRows && allRows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-slate-400 font-semibold">
              Hạng {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, allRows.length)} / {allRows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <span className="font-bold text-slate-500 px-1">Trang {page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Sau <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
