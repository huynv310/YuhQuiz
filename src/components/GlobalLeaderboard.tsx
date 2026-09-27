import React, { useEffect, useState } from 'react';
import { Trophy, Loader2, GraduationCap, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RankIcon, rankColor } from './RankBadge';

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
  /** Bố cục gọn hơn — dùng khi nhúng trong dashboard giáo viên (ít khoảng trống dọc hơn). */
  dense?: boolean;
  /** Bỏ khung max-width/padding ngoài — dùng khi nơi gọi đã tự bọc container (VD: tab trong ExamList). */
  bare?: boolean;
}

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
 * không có SĐT/email — đã kiểm soát ở tầng DB).
 */
export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({ defaultRole, dense = false, bare = false }) => {
  const [tab, setTab] = useState<'teacher' | 'student'>(defaultRole);
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (tab === 'teacher' && teachers !== null) return;
      if (tab === 'student' && students !== null) return;
      setLoading(true);
      if (tab === 'teacher') {
        const { data } = await supabase.rpc('get_teacher_leaderboard', { p_limit: 100 });
        if (alive) setTeachers(data || []);
      } else {
        const { data } = await supabase.rpc('get_student_leaderboard', { p_limit: 100 });
        if (alive) setStudents(data || []);
      }
      if (alive) setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const headPad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const cellPad = dense ? 'px-3 py-2.5' : 'px-4 py-3.5';
  const iconSize = dense ? 30 : 38;

  return (
    <div className={dense || bare ? '' : 'max-w-5xl mx-auto w-full px-4 md:px-8'}>
      <div className={dense ? 'p-4 md:p-6' : bare ? '' : 'py-6'}>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-extrabold text-lg text-slate-900">Bảng Xếp Hạng Toàn Hệ Thống</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {tab === 'teacher'
            ? 'Xếp theo số đề thi chính thức đã đóng góp và có học sinh nộp bài.'
            : 'Xếp theo điểm ưu tiên số lượng đề đã làm — làm càng nhiều đề, điểm xếp hạng càng sát điểm trung bình thật.'}
        </p>

        <div className="inline-flex bg-slate-100 rounded-xl p-1 mb-4 gap-1">
          <button
            onClick={() => setTab('teacher')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'teacher' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" /> Giáo viên
          </button>
          <button
            onClick={() => setTab('student')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'student' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Học sinh
          </button>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-100">
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bảng xếp hạng...
            </div>
          ) : tab === 'teacher' ? (
            teachers && teachers.length > 0 ? (
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
                    {teachers.map((t, i) => (
                      <tr key={i} className={`border-b border-slate-50 last:border-0 ${MEDAL_ROW[i < 3 ? i + 1 : 0]}`}>
                        <td className={cellPad}><PositionCell pos={i + 1} /></td>
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
          ) : students && students.length > 0 ? (
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
                  {students.map((s, i) => (
                    <tr key={i} className={`border-b border-slate-50 last:border-0 ${MEDAL_ROW[i < 3 ? i + 1 : 0]}`}>
                      <td className={cellPad}><PositionCell pos={i + 1} /></td>
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
      </div>
    </div>
  );
};
