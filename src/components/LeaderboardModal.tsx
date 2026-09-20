import React, { useState, useEffect } from 'react';
import { X, Trophy, Medal, Award, Users, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Submission, Exam } from '../types/exam';

interface LeaderboardModalProps {
  exam: Exam;
  submissions?: Submission[];
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ exam, submissions = [], onClose }) => {
  const [subList, setSubList] = useState<Submission[]>(submissions);
  const [isLoading, setIsLoading] = useState(submissions.length === 0);

  // Tự động tải danh sách bài nộp từ CSDL nếu danh sách truyền vào rỗng
  useEffect(() => {
    if (exam?.id && submissions.length === 0) {
      setIsLoading(true);
      supabase
        .from('public_leaderboard')
        .select('*')
        .eq('exam_id', exam.id)
        .order('score', { ascending: false })
        .then(({ data }) => {
          if (data) setSubList(data);
          setIsLoading(false);
        });
    } else {
      setSubList(submissions);
      setIsLoading(false);
    }
  }, [exam, submissions]);

  // Sắp xếp theo: Điểm cao nhất -> Ít rời tab nhất -> Nộp sớm nhất
  const sorted = subList
    .filter(s => s.status === 'submitted' && s.score !== null)
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }
      if ((a.cheat_count || 0) !== (b.cheat_count || 0)) {
        return (a.cheat_count || 0) - (b.cheat_count || 0);
      }
      return new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime();
    });

  const total = sorted.length;

  // Thuật toán: Top 20% thí sinh, tối thiểu 10 người, tối đa 100 người
  let topCount = Math.min(100, Math.max(10, Math.ceil(total * 0.2)));
  if (total < 10) topCount = total;

  const topStudents = sorted.slice(0, topCount);

  return (
    <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4 font-sans text-[#121212]">
      <div className="glass-panel rounded-3xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* HEADER */}
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-base md:text-lg text-gray-900 leading-tight">
                Bảng Vinh Danh (Leaderboard)
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Top 20% Xuất Sắc
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {exam.title} • {topStudents.length}/{total} thí sinh vinh danh
            </p>
          </div>
        </div>

        {/* DANH SÁCH BẢNG XẾP HẠNG */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p>Đang tải bảng xếp hạng...</p>
            </div>
          ) : topStudents.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-xs space-y-2">
              <Users className="w-8 h-8 text-gray-300" />
              <p>Chưa có thí sinh nào nộp bài thi này để lập bảng xếp hạng.</p>
            </div>
          ) : (
            topStudents.map((sub, idx) => {
              const rank = idx + 1;
              let rankBadge = (
                <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-extrabold text-xs flex items-center justify-center font-mono">
                  {rank}
                </span>
              );

              let itemBg = 'bg-white/60 border-white/70';
              if (rank === 1) {
                rankBadge = <span className="text-xl">🥇</span>;
                itemBg = 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-300';
              } else if (rank === 2) {
                rankBadge = <span className="text-xl">🥈</span>;
                itemBg = 'bg-slate-50/70 border-slate-200';
              } else if (rank === 3) {
                rankBadge = <span className="text-xl">🥉</span>;
                itemBg = 'bg-orange-50/50 border-orange-200';
              }

              return (
                <div
                  key={sub.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${itemBg}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 flex justify-center">{rankBadge}</div>
                    <div>
                      <span className="font-extrabold text-sm text-gray-900 block">{sub.student_name}</span>
                      <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                        <span>Lớp: <b className="text-gray-700">{sub.class_name}</b></span>
                        {sub.school && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{sub.school}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="text-base font-extrabold text-primary">
                      {sub.score} <span className="text-xs font-normal text-gray-400">/ 10đ</span>
                    </div>
                    {sub.cheat_count === 0 ? (
                      <span className="text-[10px] text-emerald-700 font-semibold">Tập trung 100%</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Rời tab: {sub.cheat_count} lần</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-gray-100 text-center text-[11px] text-gray-400">
          Chỉ tôn vinh top 20% thí sinh có kết quả cao nhất để khích lệ tinh thần học tập tích cực.
        </div>
      </div>
    </div>
  );
};
