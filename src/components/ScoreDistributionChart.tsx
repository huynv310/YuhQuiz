import React from 'react';
import { BarChart3, TrendingUp, Award, Users, AlertCircle } from 'lucide-react';
import { Submission } from '../types/exam';

interface ScoreDistributionChartProps {
  submissions: Submission[];
}

export const ScoreDistributionChart: React.FC<ScoreDistributionChartProps> = ({ submissions }) => {
  const validScores = submissions
    .map(s => s.score)
    .filter((sc): sc is number => sc !== null && sc !== undefined);

  if (validScores.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-xs">
        <BarChart3 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        <p>Chưa có bài thi nào được chấm để vẽ phổ điểm.</p>
      </div>
    );
  }

  // 1. Phân chia 10 dải điểm: [0-1), [1-2), ... [9-10]
  const bins = Array(10).fill(0);
  validScores.forEach(score => {
    let idx = Math.floor(score);
    if (idx >= 10) idx = 9;
    if (idx < 0) idx = 0;
    bins[idx]++;
  });

  const maxBinCount = Math.max(...bins, 1);

  // 2. Tính các chỉ số thống kê
  const sum = validScores.reduce((a, b) => a + b, 0);
  const mean = (sum / validScores.length).toFixed(2);
  
  const sorted = [...validScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);

  const maxScore = Math.max(...validScores).toFixed(2);
  const minScore = Math.min(...validScores).toFixed(2);

  // Độ lệch chuẩn
  const variance = validScores.reduce((a, b) => a + Math.pow(b - parseFloat(mean), 2), 0) / validScores.length;
  const stdDev = Math.sqrt(variance).toFixed(2);

  // Tỷ lệ phân loại
  const excellentCount = validScores.filter(s => s >= 8.0).length;
  const passedCount = validScores.filter(s => s >= 5.0).length;
  const failedCount = validScores.filter(s => s < 5.0).length;

  const width = 500;
  const height = 180;
  const paddingX = 35;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;
  const barW = chartW / 10;

  // Tính tọa độ đường cong phân chuẩn (Bell Curve Overlay)
  const bellPoints: string[] = [];
  const mu = parseFloat(mean);
  const sigma = Math.max(parseFloat(stdDev), 0.5);

  for (let i = 0; i <= 20; i++) {
    const xVal = (i / 20) * 10;
    // Công thức mật độ phân phối chuẩn Gauss
    const gauss = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((xVal - mu) / sigma, 2));
    // Chuẩn hóa tỷ lệ chiều cao đường cong
    const scaledH = Math.min(chartH, gauss * 2.5 * chartH);
    const px = paddingX + (xVal / 10) * chartW;
    const py = height - paddingY - scaledH;
    bellPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  return (
    <div className="glass-panel rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-gray-900">Phổ Điểm & Đường Cong Phân Phối Chuẩn</h3>
            <p className="text-[11px] text-gray-400">Đánh giá độ phân hóa và độ khó của đề thi</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-bold">
          <span className="bg-emerald-50 text-primary-dark px-2.5 py-1 rounded-full border border-emerald-200">
            Sĩ số: {validScores.length} bài thi
          </span>
        </div>
      </div>

      {/* THẺ CHỈ SỐ THỐNG KÊ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Điểm Trung Bình</span>
          <span className="text-base font-extrabold text-primary">{mean}</span>
        </div>

        <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Điểm Trung Vị</span>
          <span className="text-base font-extrabold text-gray-800">{median}</span>
        </div>

        <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Cao nhất / Thấp nhất</span>
          <span className="text-base font-extrabold text-gray-800">{maxScore} / {minScore}</span>
        </div>

        <div className="bg-[#FAFAFA] p-2.5 rounded-2xl border border-gray-100 text-center">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Độ Lệch Chuẩn (σ)</span>
          <span className="text-base font-extrabold text-purple-600">{stdDev}</span>
        </div>
      </div>

      {/* ĐỒ THỊ HISTOGRAM + ĐƯỜNG CONG HÌNH CHUÔNG (NATIVE SVG) */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl mx-auto block h-44">
          {/* Trục hoành */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" strokeWidth="1.5" />

          {/* Các cột điểm */}
          {bins.map((count, i) => {
            const barHeight = (count / maxBinCount) * chartH;
            const x = paddingX + i * barW + barW * 0.15;
            const y = height - paddingY - barHeight;
            const w = barW * 0.7;

            return (
              <g key={i} className="group">
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={barHeight}
                  rx="4"
                  fill="#2563EB"
                  className="transition-all hover:fill-[#1D4ED8] cursor-pointer opacity-90"
                />
                {/* Số lượng bài thi trên đầu cột */}
                {count > 0 && (
                  <text
                    x={x + w / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#374151"
                    fontWeight="bold"
                  >
                    {count}
                  </text>
                )}
                {/* Nhãn điểm dưới trục */}
                <text
                  x={x + w / 2}
                  y={height - paddingY + 14}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#6B7280"
                  fontWeight="bold"
                >
                  {i}-{i + 1}
                </text>
              </g>
            );
          })}

          {/* Đường cong hình chuông Gauss (Bell curve overlay) */}
          <polyline
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeDasharray="4 2"
            points={bellPoints.join(' ')}
          />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-primary inline-block" />
            <span>Phổ điểm thực tế</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 border-t-2 border-dashed border-purple-500 inline-block" />
            <span>Đường cong chuẩn Gauss</span>
          </span>
        </div>

        <div>
          <span>Đạt (≥5đ): <b className="text-emerald-700">{((passedCount / validScores.length) * 100).toFixed(0)}%</b></span>
          <span className="mx-2">•</span>
          <span>Giỏi (≥8đ): <b className="text-primary">{((excellentCount / validScores.length) * 100).toFixed(0)}%</b></span>
        </div>
      </div>
    </div>
  );
};
