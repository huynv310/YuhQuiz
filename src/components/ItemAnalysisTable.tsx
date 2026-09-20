import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown, HelpCircle, Sparkles } from 'lucide-react';
import { Exam, Submission } from '../types/exam';

interface ItemAnalysisTableProps {
  exam: Exam;
  submissions: Submission[];
}

export const ItemAnalysisTable: React.FC<ItemAnalysisTableProps> = ({ exam, submissions }) => {
  const totalSubs = submissions.filter(s => s.status === 'submitted').length;

  if (totalSubs === 0) {
    return null;
  }

  // Thuật toán phân tích tỷ lệ làm đúng P_i
  const p1Stats: { q: number; correct: number; rate: number }[] = [];
  const p2Stats: { q: number; avgCorrectItems: number; fullRate: number }[] = [];
  const p3Stats: { q: number; correct: number; rate: number }[] = [];

  const p1Count = exam.config?.sections?.find(s => s.id === 'part_1')?.question_count ?? 0;
  const p2Count = exam.config?.sections?.find(s => s.id === 'part_2')?.question_count ?? 0;
  const p3Count = exam.config?.sections?.find(s => s.id === 'part_3')?.question_count ?? 0;

  // 1. Phân tích Phần I
  for (let q = 1; q <= p1Count; q++) {
    let correct = 0;
    submissions.forEach(sub => {
      if (sub.score_details?.part_1?.[q]?.is_correct) {
        correct++;
      }
    });
    p1Stats.push({ q, correct, rate: Math.round((correct / totalSubs) * 100) });
  }

  // 2. Phân tích Phần II
  for (let q = 1; q <= p2Count; q++) {
    let fullCorrect = 0;
    let totalItems = 0;
    submissions.forEach(sub => {
      const cCount = sub.score_details?.part_2?.[q]?.correct_count || 0;
      totalItems += cCount;
      if (cCount === 4) fullCorrect++;
    });
    p2Stats.push({
      q,
      avgCorrectItems: parseFloat((totalItems / totalSubs).toFixed(1)),
      fullRate: Math.round((fullCorrect / totalSubs) * 100)
    });
  }

  // 3. Phân tích Phần III
  for (let q = 1; q <= p3Count; q++) {
    let correct = 0;
    submissions.forEach(sub => {
      if (sub.score_details?.part_3?.[q]?.is_correct) {
        correct++;
      }
    });
    p3Stats.push({ q, correct, rate: Math.round((correct / totalSubs) * 100) });
  }

  // Tìm các câu có tỷ lệ sai cao nhất (P_i < 30%)
  const hardQuestions: string[] = [];
  p1Stats.filter(s => s.rate < 30).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần I - Đúng ${s.rate}%)`));
  p2Stats.filter(s => s.fullRate < 25).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần II - Đúng 4 ý ${s.fullRate}%)`));
  p3Stats.filter(s => s.rate < 25).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần III - Đúng ${s.rate}%)`));

  return (
    <div className="glass-panel rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center space-x-1.5">
            <span>Ma Trận Độ Khó & Tỷ Lệ Làm Đúng (Pᵢ)</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Xác định câu hỏi phân hóa và các câu học sinh thường xuyên làm sai
          </p>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-bold">
          <span className="flex items-center space-x-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Pᵢ &lt; 25%: Câu bẫy / Sai nhiều</span>
          </span>
          <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Pᵢ ≥ 60%: Cơ bản</span>
          </span>
        </div>
      </div>

      {/* GỢI Ý SƯ PHẠM CHO GIÁO VIÊN */}
      {hardQuestions.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs">
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold text-amber-900 block">Gợi ý ôn tập trên lớp:</span>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Học sinh gặp khó khăn nhiều nhất ở các câu: <b className="text-rose-700">{hardQuestions.join(', ')}</b>. Thầy/Cô nên ưu tiên giải chi tiết dạng toán này trong tiết sửa bài.
            </p>
          </div>
        </div>
      )}

      {/* BẢNG TỶ LỆ THEO TỪNG PHẦN */}
      <div className="space-y-3 text-xs">
        {p1Stats.length > 0 && (
          <div>
            <span className="font-bold text-[11px] text-gray-700 block mb-1.5">Phần I: Trắc nghiệm 4 lựa chọn</span>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-1.5">
              {p1Stats.map(s => {
                let badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (s.rate < 25) badge = 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold';
                else if (s.rate < 60) badge = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div key={s.q} className={`p-1.5 rounded-xl border text-center ${badge}`}>
                    <span className="text-[10px] text-gray-500 block">C{s.q}</span>
                    <span className="text-xs font-bold">{s.rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {p2Stats.length > 0 && (
          <div>
            <span className="font-bold text-[11px] text-gray-700 block mb-1.5">Phần II: Đúng / Sai</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {p2Stats.map(s => (
                <div key={s.q} className="bg-gray-50 p-2 rounded-xl border border-gray-200 text-center">
                  <span className="text-[10px] text-gray-500 block font-bold">Câu {s.q}</span>
                  <span className="text-xs font-bold text-gray-900 block">Đúng TB: {s.avgCorrectItems}/4 ý</span>
                  <span className="text-[10px] text-gray-500">Đạt 100%: <b className={s.fullRate < 25 ? 'text-rose-600' : 'text-emerald-700'}>{s.fullRate}%</b></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {p3Stats.length > 0 && (
          <div>
            <span className="font-bold text-[11px] text-gray-700 block mb-1.5">Phần III: Trả lời ngắn</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {p3Stats.map(s => {
                let badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (s.rate < 25) badge = 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold';
                else if (s.rate < 60) badge = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div key={s.q} className={`p-1.5 rounded-xl border text-center ${badge}`}>
                    <span className="text-[10px] text-gray-500 block">C{s.q}</span>
                    <span className="text-xs font-bold">{s.rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
