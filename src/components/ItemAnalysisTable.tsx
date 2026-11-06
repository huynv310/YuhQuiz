import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown, HelpCircle, Sparkles } from 'lucide-react';
import { Exam, Submission } from '../types/exam';

interface ItemAnalysisTableProps {
  exam: Exam;
  submissions: Submission[];
}

export const ItemAnalysisTable: React.FC<ItemAnalysisTableProps> = ({ exam, submissions }) => {
  const submittedSubs = submissions.filter(s => s.status === 'submitted');
  const totalSubs = submittedSubs.length;

  if (totalSubs === 0) {
    return null;
  }

  // Phân nhóm 27% điểm cao nhất (Upper) và 27% điểm thấp nhất (Lower) theo Lý thuyết Khảo thí Cổ điển (CTT) để tính D_i
  const sortedByScore = [...submittedSubs].sort((a, b) => (b.score || 0) - (a.score || 0));
  const groupSize = Math.max(1, Math.round(totalSubs * 0.27));
  const upperGroup = sortedByScore.slice(0, groupSize);
  const lowerGroup = sortedByScore.slice(totalSubs - groupSize);

  // Thuật toán phân tích tỷ lệ làm đúng P_i & Độ phân biệt D_i
  const p1Stats: { q: number; correct: number; rate: number; di: number; choices: Record<string, number> }[] = [];
  const p2Stats: { q: number; avgCorrectItems: number; fullRate: number }[] = [];
  const p3Stats: { q: number; correct: number; rate: number; di: number }[] = [];

  const p1Count = exam.config?.sections?.find(s => s.id === 'part_1')?.question_count ?? 0;
  const p2Count = exam.config?.sections?.find(s => s.id === 'part_2')?.question_count ?? 0;
  const p3Count = exam.config?.sections?.find(s => s.id === 'part_3')?.question_count ?? 0;

  // 1. Phân tích Phần I & Phân tích phương án nhiễu (Distractor Analysis)
  for (let q = 1; q <= p1Count; q++) {
    let correct = 0;
    const choices: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, other: 0 };
    submittedSubs.forEach(sub => {
      if (sub.score_details?.part_1?.[q]?.is_correct) {
        correct++;
      }
      const rawAns = String((sub.answers as any)?.part_1?.[q] || (sub as any)?.student_answers?.part_1?.[q] || '').toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(rawAns)) {
        choices[rawAns]++;
      } else {
        choices.other++;
      }
    });
    const upperCorrect = upperGroup.filter(s => s.score_details?.part_1?.[q]?.is_correct).length / groupSize;
    const lowerCorrect = lowerGroup.filter(s => s.score_details?.part_1?.[q]?.is_correct).length / groupSize;
    p1Stats.push({
      q,
      correct,
      rate: Math.round((correct / totalSubs) * 100),
      di: parseFloat((upperCorrect - lowerCorrect).toFixed(2)),
      choices,
    });
  }

  // 2. Phân tích Phần II
  for (let q = 1; q <= p2Count; q++) {
    let fullCorrect = 0;
    let totalItems = 0;
    submittedSubs.forEach(sub => {
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
    submittedSubs.forEach(sub => {
      if (sub.score_details?.part_3?.[q]?.is_correct) {
        correct++;
      }
    });
    const upperCorrect = upperGroup.filter(s => s.score_details?.part_3?.[q]?.is_correct).length / groupSize;
    const lowerCorrect = lowerGroup.filter(s => s.score_details?.part_3?.[q]?.is_correct).length / groupSize;
    p3Stats.push({
      q,
      correct,
      rate: Math.round((correct / totalSubs) * 100),
      di: parseFloat((upperCorrect - lowerCorrect).toFixed(2)),
    });
  }

  // Tìm các câu có tỷ lệ sai cao nhất (P_i < 30%) và câu có độ phân biệt âm (D_i < 0)
  const hardQuestions: string[] = [];
  p1Stats.filter(s => s.rate < 30).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần I - Đúng ${s.rate}%)`));
  p2Stats.filter(s => s.fullRate < 25).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần II - Đúng 4 ý ${s.fullRate}%)`));
  p3Stats.filter(s => s.rate < 25).forEach(s => hardQuestions.push(`Câu ${s.q} (Phần III - Đúng ${s.rate}%)`));

  const negativeDiQuestions: string[] = [];
  p1Stats.filter(s => s.di < 0).forEach(s => negativeDiQuestions.push(`Câu ${s.q} (Dᵢ = ${s.di})`));
  p3Stats.filter(s => s.di < 0).forEach(s => negativeDiQuestions.push(`Câu ${s.q} Phần III (Dᵢ = ${s.di})`));

  return (
    <div className="glass-panel rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center space-x-1.5">
            <span>Ma Trận Độ Khó (Pᵢ) & Phân Biệt (Dᵢ)</span>
          </h3>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-bold flex-wrap gap-1">
          <span className="flex items-center space-x-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Pᵢ &lt; 25%: Khó / Sai nhiều</span>
          </span>
          <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Dᵢ ≥ +0.30: Phân loại tốt</span>
          </span>
        </div>
      </div>

      {/* CẢNH BÁO PHÂN BIỆT ÂM CHO GIÁO VIÊN */}
      {negativeDiQuestions.length > 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold text-rose-900 block">Cảnh báo độ phân biệt âm (Dᵢ &lt; 0):</span>
            <p className="text-rose-800 text-[11px] mt-0.5">
              Các câu: <b className="text-rose-900">{negativeDiQuestions.join(', ')}</b> có nhóm học sinh điểm cao làm sai nhiều hơn nhóm điểm thấp. Thầy/Cô nên kiểm tra lại đề xem có sai sót đáp án hoặc câu hỏi gây hiểu nhầm không!
            </p>
          </div>
        </div>
      )}

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
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[11px] text-gray-700">Phần I: Trắc nghiệm 4 lựa chọn (Kèm phân tích phương án nhiễu)</span>
              <span className="text-[10px] text-gray-400">Rê chuột xem tỷ lệ A/B/C/D</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-1.5">
              {p1Stats.map(s => {
                let badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (s.rate < 25) badge = 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold';
                else if (s.rate < 60) badge = 'bg-amber-50 text-amber-900 border-amber-200';

                const distractorTitle = `A: ${s.choices.A} | B: ${s.choices.B} | C: ${s.choices.C} | D: ${s.choices.D}`;

                return (
                  <div key={s.q} title={distractorTitle} className={`p-1.5 rounded-xl border text-center ${badge} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                      <span className="font-bold">C{s.q}</span>
                      <span className={`text-[9px] font-mono px-1 rounded ${s.di < 0 ? 'bg-rose-200 text-rose-900 font-extrabold' : s.di >= 0.3 ? 'bg-emerald-200 text-emerald-900 font-bold' : 'text-gray-500'}`}>
                        {s.di > 0 ? `+${s.di}` : s.di}
                      </span>
                    </div>
                    <span className="text-xs font-bold my-0.5">{s.rate}%</span>
                    {/* Thanh phân bố phương án nhiễu A (xanh dương), B (xanh lá), C (vàng cam), D (tím) */}
                    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-gray-200 mt-1">
                      {(['A', 'B', 'C', 'D'] as const).map(opt => {
                        const count = s.choices[opt] || 0;
                        const pct = totalSubs > 0 ? (count / totalSubs) * 100 : 0;
                        const colors: Record<string, string> = { A: 'bg-blue-400', B: 'bg-emerald-400', C: 'bg-amber-400', D: 'bg-purple-400' };
                        return pct > 0 ? <div key={opt} style={{ width: `${pct}%` }} className={colors[opt]} /> : null;
                      })}
                    </div>
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
                let badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (s.rate < 25) badge = 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold';
                else if (s.rate < 60) badge = 'bg-amber-50 text-amber-900 border-amber-200';

                return (
                  <div key={s.q} className={`p-1.5 rounded-xl border text-center ${badge}`}>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                      <span className="font-bold">C{s.q}</span>
                      <span className={`text-[9px] font-mono px-1 rounded ${s.di < 0 ? 'bg-rose-200 text-rose-900 font-extrabold' : s.di >= 0.3 ? 'bg-emerald-200 text-emerald-900 font-bold' : 'text-gray-500'}`}>
                        {s.di > 0 ? `+${s.di}` : s.di}
                      </span>
                    </div>
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
