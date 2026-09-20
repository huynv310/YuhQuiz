import React from 'react';
import { Clock, Check, Hash, Users, Search } from 'lucide-react';

// Khung trình duyệt giả để trình diễn giao diện
export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-blue-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex-1 max-w-xs text-[11px] text-slate-500 bg-white rounded-md px-3 py-1 truncate">{url}</span>
      </div>
      {children}
    </div>
  );
}

const Bubble = ({ on, label }: { on?: boolean; label: string }) => (
  <span className={`mk-bubble w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-500'}`}>{label}</span>
);

// 1) Phòng thi: đề bên trái, phiếu trả lời bên phải
export function ExamRoomMock() {
  return (
    <BrowserFrame url="yuhquiz.id.vn/exam/T1A2B3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 text-xs">
        <b className="text-slate-800 font-heading">Đề thi thử Toán 12 · Mã T1A2B3</b>
        <span className="flex items-center gap-1 font-mono font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md"><Clock className="w-3.5 h-3.5" />38:12</span>
      </div>
      <div className="grid grid-cols-5 min-h-[300px]">
        <div className="col-span-3 p-4 bg-slate-50 border-r border-slate-100 space-y-3">
          <div className="h-3 w-2/3 bg-slate-300 rounded" />
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-5/6 bg-slate-200 rounded" />
          <div className="h-28 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
            <svg viewBox="0 0 160 80" className="w-40 h-20"><path d="M5 70 C40 70 40 10 80 10 S120 70 155 70" fill="none" stroke="#2563EB" strokeWidth="3" /><line x1="5" y1="70" x2="155" y2="70" stroke="#94a3b8" /></svg>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-3/4 bg-slate-200 rounded" />
        </div>
        <div className="col-span-2 p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Phần I · Câu 1</p>
            <div className="flex gap-2"><Bubble label="A" /><Bubble label="B" on /><Bubble label="C" /><Bubble label="D" /></div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Phần II · Câu 1</p>
            {['a', 'b', 'c', 'd'].map((k, i) => (
              <div key={k} className="flex items-center justify-between mb-1.5 text-xs text-slate-600">
                <span className="font-bold w-4">{k}</span>
                <span className="flex gap-1.5">
                  <span className={`px-2.5 py-1 rounded-md border text-[11px] font-bold ${i % 2 === 0 ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>Đúng</span>
                  <span className={`px-2.5 py-1 rounded-md border text-[11px] font-bold ${i % 2 === 1 ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300'}`}>Sai</span>
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Phần III · Câu 1</p>
            <div className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700">-1.5</div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

// 2) Giáo viên: phổ điểm và phân tích
export function AnalyticsMock() {
  const bars = [62, 38, 81, 24, 55];
  return (
    <BrowserFrame url="yuhquiz.id.vn/teacher/exams/T1A2B3">
      <div className="p-5 min-h-[340px]">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[['Điểm trung bình', '7.42'], ['Trung vị', '7.60'], ['Đã nộp', '42/45']].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">{l}</p>
              <p className="font-heading font-extrabold text-2xl text-slate-900">{v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 rounded-xl border border-slate-100 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Phổ điểm</p>
            <svg viewBox="0 0 300 120" className="w-full">
              <path className="mk-curve" d="M5 110 C60 108 80 95 120 60 S160 8 180 8 S240 100 295 110" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
              <path d="M5 110 C60 108 80 95 120 60 S160 8 180 8 S240 100 295 110 V115 H5Z" fill="#2563EB" opacity="0.08" />
            </svg>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-100 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">Tỉ lệ đúng từng câu</p>
            {bars.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="w-4">C{i + 1}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="mk-bar h-full rounded-full bg-emerald-500" style={{ width: `${b}%` }} /></div>
                <span className="w-7 text-right">{b}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Users className="w-4 h-4 text-blue-600" />Chấm lại toàn bộ bài khi sửa đáp án, xuất bảng điểm Excel</div>
      </div>
    </BrowserFrame>
  );
}

// 3) Luyện tập: lọc theo môn, khối, hashtag
export function PracticeMock() {
  return (
    <BrowserFrame url="yuhquiz.id.vn/practice">
      <div className="p-5 min-h-[340px] space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-400"><Search className="w-4 h-4" />Tìm câu hỏi...</div>
          {['Toán', 'Lớp 12'].map((c) => <span key={c} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">{c}</span>)}
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          {['#hàm-số', '#tích-phân', '#xác-suất'].map((t) => <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"><Hash className="w-3 h-3" />{t.slice(1)}</span>)}
        </div>
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="h-3 w-3/4 bg-slate-200 rounded" />
          <div className="h-3 w-1/2 bg-slate-200 rounded" />
          <div className="flex gap-2 pt-1"><Bubble label="A" /><Bubble label="B" /><Bubble label="C" on /><Bubble label="D" /></div>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><Check className="w-4 h-4" /></span>
          <div className="space-y-2 flex-1"><p className="text-xs font-bold text-emerald-800">Chính xác · Đáp án C</p><div className="h-2.5 w-full bg-emerald-200/70 rounded" /><div className="h-2.5 w-2/3 bg-emerald-200/70 rounded" /></div>
        </div>
      </div>
    </BrowserFrame>
  );
}
