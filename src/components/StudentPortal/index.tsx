import React, { useState } from 'react';
import { LogoMark } from '../Logo';
import { UserCircle, Dumbbell, BookOpen, BookMarked, Activity, LogOut, ShieldCheck, Trophy } from 'lucide-react';
import { ExamList } from './ExamList';
import { ProfileView } from '../ProfileView';
import { PracticeView } from './PracticeView';
import { GlobalLeaderboard } from '../GlobalLeaderboard';

interface StudentPortalProps {
  currentUser: any;
  profile?: any;
  onProfileUpdated?: (p: any) => void;
  onReviewExam?: (examId: string, studentName: string, className: string, school: string, submissionId?: string) => void;
  onStartExam: (examId: string, studentName: string, className: string, school: string) => void;
  onLogout: () => void;
  onSwitchToTeacher?: () => void;
}

type TabType = 'exams' | 'profile' | 'practice' | 'notebook' | 'radar' | 'leaderboard';

export const StudentPortal: React.FC<StudentPortalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('exams');

  const renderContent = () => {
    switch (activeTab) {
      case 'exams':
        return <ExamList {...props} />;
      case 'profile':
        return <ProfileView profile={props.profile} onUpdated={p => props.onProfileUpdated?.(p)} />;
      case 'practice':
        return <PracticeView />;
      case 'leaderboard':
        return (
          <div className="p-4 md:p-8">
            <GlobalLeaderboard defaultRole="student" bare />
          </div>
        );
      case 'notebook':
        return (
          <div className="p-8 flex flex-col items-center justify-center h-full text-center">
            <BookMarked className="w-16 h-16 text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Sổ Tay Câu Sai SM-2</h2>
            <p className="text-slate-500 max-w-md">
              Tính năng đang được phát triển. Thuật toán SuperMemo-2 sẽ nhắc bạn ôn tập các câu sai vào thời điểm phù hợp.
            </p>
          </div>
        );
      case 'radar':
        return (
          <div className="p-8 flex flex-col items-center justify-center h-full text-center">
            <Activity className="w-16 h-16 text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Phân Tích Lỗ Hổng</h2>
            <p className="text-slate-500 max-w-md">
              Bản đồ Radar & Heatmap sẽ hiển thị chính xác các chuyên đề kiến thức mà bạn cần cải thiện.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      
      {/* ── MOBILE HEADER (CHỐNG LẤN CHIẾM DIỆN TÍCH TRÊN MÀN HÌNH NHỎ) ── */}
      <header className="md:hidden h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-2.5">
          <LogoMark className="w-7 h-7" />
          <div className="leading-tight">
            <span className="font-heading font-extrabold text-base tracking-tight text-slate-800">
              YuhQuiz
            </span>
            <span className="text-[10px] text-emerald-600 font-bold ml-1.5 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
              Học sinh
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {props.onSwitchToTeacher && (
            <button
              onClick={props.onSwitchToTeacher}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              title="Đổi sang Giáo Viên"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}
          {props.onLogout && (
            <button
              onClick={props.onLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* ── DESKTOP SIDEBAR (CHỈ HIỂN THỊ TỪ MÀN HÌNH MD TRỞ LÊN) ── */}
      <aside className="glass-panel !rounded-none !border-y-0 !border-l-0 hidden md:flex md:w-64 flex-col transition-all shrink-0 z-40">
        
        {/* LOGO */}
        <div className="h-16 flex items-center justify-start px-6 border-b border-slate-100">
          <LogoMark className="w-8 h-8" />
          <div className="ml-3 leading-tight">
            <span className="font-heading font-extrabold text-lg tracking-tight text-slate-800 block leading-tight">
              YuhQuiz
            </span>
            <span className="text-[11px] text-emerald-600 font-bold">Học sinh</span>
          </div>
        </div>

        {/* MENU ITEMS */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('exams')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'exams'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <BookOpen className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Danh sách thi</span>
          </button>

          <button
            onClick={() => setActiveTab('practice')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'practice'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <Dumbbell className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Luyện tập</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <Trophy className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Xếp Hạng</span>
          </button>

          <button
            onClick={() => setActiveTab('notebook')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'notebook'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <BookMarked className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Sổ tay SM-2</span>
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'radar'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <Activity className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Phân tích Lỗ hổng</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <UserCircle className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3">Hồ sơ cá nhân</span>
          </button>
        </nav>

        {/* FOOTER ACTIONS */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {props.onSwitchToTeacher && (
            <button
              onClick={props.onSwitchToTeacher}
              className="w-full flex items-center p-3 rounded-xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-medium group"
              title="Quản trị Giáo Viên"
            >
              <ShieldCheck className="w-5 h-5 flex-shrink-0 group-hover:text-emerald-700" />
              <span className="ml-3">Đổi sang Giáo Viên</span>
            </button>
          )}

          {props.onLogout && (
            <button
              onClick={props.onLogout}
              className="w-full flex items-center p-3 rounded-xl text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium group"
            >
              <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-rose-600" />
              <span className="ml-3">Đăng xuất</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT (TỰ DO 100% CHIỀU RỘNG TRÊN MOBILE, KHÔNG BỊ ÉP 80PX) ── */}
      <main className="flex-1 overflow-y-auto relative pb-20 md:pb-0">
        {renderContent()}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION (CHUẨN UX THIẾT BỊ DI ĐỘNG) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 flex items-center justify-around px-1 shadow-lg">
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'exams' ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Đề thi</span>
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'practice' ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <Dumbbell className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Luyện tập</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'leaderboard' ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Xếp hạng</span>
        </button>

        <button
          onClick={() => setActiveTab('notebook')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'notebook' ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Sổ tay</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'profile' ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <UserCircle className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cá nhân</span>
        </button>
      </nav>

    </div>
  );
};
