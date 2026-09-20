import React, { useState } from 'react';
import { UserCircle, BookOpen, Database, BarChart3, Settings, LogOut, ArrowLeft } from 'lucide-react';
import { ExamManager } from './ExamManager';
import { ProfileView } from '../ProfileView';
import { QuestionBank } from './QuestionBank';

interface TeacherDashboardProps {
  currentUser?: any;
  profile?: any;
  onProfileUpdated?: (p: any) => void;
  onLogout?: () => void;
  onBackToHome: () => void;
  onPreviewExam: (examId: string) => void;
  onSwitchToStudentView?: () => void;
}

type TabType = 'exams' | 'profile' | 'question_bank' | 'stats' | 'settings';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('exams');

  const renderContent = () => {
    switch (activeTab) {
      case 'exams':
        return <ExamManager {...props} />;
      case 'question_bank':
        return <QuestionBank currentUser={props.currentUser} />;
      case 'profile':
        return <ProfileView profile={props.profile} onUpdated={p => props.onProfileUpdated?.(p)} />;
      case 'stats':
        return (
          <div className="p-8 flex flex-col items-center justify-center h-full text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Thống Kê Tổng Quan</h2>
            <p className="text-slate-500 max-w-md">
              Báo cáo tổng hợp từ tất cả các kỳ thi và học sinh.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  // We are integrating a side bar, but wait, ExamManager currently has a Top Header 
  // with background bg-[#FAFAFA] and its own padding.
  // To keep it simple, we wrap it in a flex container.

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      
      {/* ── SIDEBAR ── */}
      <aside className="glass-panel !rounded-none !border-y-0 !border-l-0 w-20 md:w-64 flex flex-col transition-all shrink-0 z-40">
        
        {/* LOGO */}
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-100 cursor-pointer" onClick={props.onBackToHome}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-black text-xs shadow-sm">
            YQ
          </div>
          <div className="hidden md:block ml-3 leading-tight">
            <span className="block font-heading font-extrabold text-lg text-slate-800 tracking-tight">Teacher</span>
            {props.profile?.user_code && <span className="block text-[11px] text-slate-500">Mã: <b className="font-mono">{props.profile.user_code}</b></span>}
          </div>
        </div>

        {/* MENU ITEMS */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab('exams')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'exams' 
                ? 'bg-blue-50 text-blue-700 font-bold' 
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <BookOpen className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block ml-3">Quản lý Đề Thi</span>
          </button>

          <button
            onClick={() => setActiveTab('question_bank')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'question_bank' 
                ? 'bg-blue-50 text-blue-700 font-bold' 
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <Database className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block ml-3">Kho Bài Tập</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'stats' 
                ? 'bg-blue-50 text-blue-700 font-bold' 
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block ml-3">Thống Kê</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-white/60 font-medium'
            }`}
          >
            <UserCircle className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block ml-3">Hồ sơ cá nhân</span>
          </button>

        </nav>

        {/* FOOTER ACTIONS */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {props.onLogout && (
            <button
              onClick={props.onLogout}
              className="w-full flex items-center p-3 rounded-xl text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium group"
            >
              <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-rose-600" />
              <span className="hidden md:block ml-3">Đăng xuất</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto relative">
         {renderContent()}
      </main>

    </div>
  );
};
