import React, { useState } from 'react';
import { UserCircle, BookOpen, Database, BarChart3, Settings, LogOut, ArrowLeft, Trophy } from 'lucide-react';
import { ExamManager } from './ExamManager';
import { ProfileView } from '../ProfileView';
import { QuestionBank } from './QuestionBank';
import { LogoMark } from '../Logo';
import { RankBadge } from '../RankBadge';
import { GlobalLeaderboard } from '../GlobalLeaderboard';
import { useMyRank } from '../../hooks/useMyRank';

interface TeacherDashboardProps {
  currentUser?: any;
  profile?: any;
  onProfileUpdated?: (p: any) => void;
  onLogout?: () => void;
  onBackToHome: () => void;
  onPreviewExam: (examId: string) => void;
  onSwitchToStudentView?: () => void;
}

type TabType = 'exams' | 'profile' | 'question_bank' | 'stats' | 'settings' | 'leaderboard';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('exams');
  // State quản lý mở rộng khi hover trên máy tính (In-flow Push)
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const { rank } = useMyRank(props.currentUser?.id);

  const renderContent = () => {
    switch (activeTab) {
      case 'exams':
        return <ExamManager {...props} />;
      case 'question_bank':
        return <QuestionBank currentUser={props.currentUser} />;
      case 'leaderboard':
        return (
          <div className="p-4 md:p-8">
            <GlobalLeaderboard defaultRole="teacher" bare />
          </div>
        );
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

  const navItems = [
    { id: 'exams', label: 'Quản lý Đề Thi', icon: BookOpen },
    { id: 'question_bank', label: 'Kho Bài Tập', icon: Database },
    { id: 'leaderboard', label: 'Xếp Hạng', icon: Trophy },
    { id: 'stats', label: 'Thống Kê', icon: BarChart3 },
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: UserCircle },
  ];

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      
      {/* ── SIDEBAR: TỰ ĐỘNG THU GỌN VÀ MỞ RỘNG KHI HOVER (IN-FLOW PUSH) ── */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`glass-panel !rounded-none !border-y-0 !border-l-0 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 z-40 overflow-hidden ${
          isSidebarHovered ? 'w-64' : 'w-16'
        }`}
      >
        
        {/* LOGO */}
        <div
          className="h-16 flex items-center px-4 border-b border-slate-100 cursor-pointer overflow-hidden shrink-0"
          onClick={props.onBackToHome}
          title={!isSidebarHovered ? 'Về trang chủ' : undefined}
        >
          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
            <LogoMark className="w-8 h-8" />
          </div>
          <div
            className={`ml-3 leading-tight overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isSidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
            }`}
          >
            <span className="block font-heading font-extrabold text-lg text-slate-800 tracking-tight">Teacher</span>
            {props.profile?.user_code && (
              <span className="block text-[11px] text-slate-500">Mã: <b className="font-mono">{props.profile.user_code}</b></span>
            )}
          </div>
        </div>

        {/* Ô NHỎ HIỂN THỊ RANK ĐÓNG GÓP */}
        {rank && (
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full py-2.5 border-b border-slate-100 flex items-center hover:bg-white/60 transition-all ${
              isSidebarHovered ? 'px-3.5 justify-start' : 'px-2 justify-center'
            }`}
            title={!isSidebarHovered ? `Xếp hạng: ${rank.rank_tier} (${rank.exams_count ?? 0} đề đã đóng góp)` : 'Xem bảng xếp hạng toàn hệ thống'}
          >
            <div className="shrink-0 flex items-center justify-center">
              <RankBadge tier={rank.rank_tier} size={28} showLabel={false} />
            </div>
            <div
              className={`ml-3 min-w-0 text-left overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isSidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
              }`}
            >
              <p className="text-xs font-bold text-slate-700 truncate">{rank.rank_tier}</p>
              <p className="text-[11px] text-slate-400">{rank.exams_count ?? 0} đề đã đóng góp</p>
            </div>
          </button>
        )}

        {/* MENU ITEMS */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              title={!isSidebarHovered ? label : undefined}
              className={`w-full flex items-center p-2.5 rounded-xl transition-all ${
                isSidebarHovered ? 'px-3 justify-start' : 'justify-center'
              } ${
                activeTab === id
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-600 hover:bg-white/60 font-medium'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={`ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isSidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </nav>

        {/* FOOTER ACTIONS */}
        <div className="p-2.5 border-t border-slate-100 space-y-2 shrink-0 overflow-hidden">
          {props.onSwitchToStudentView && (
            <button
              onClick={props.onSwitchToStudentView}
              title={!isSidebarHovered ? 'Đổi sang Học Sinh' : undefined}
              className={`w-full flex items-center p-2.5 rounded-xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-medium group ${
                isSidebarHovered ? 'px-3 justify-start' : 'justify-center'
              }`}
            >
              <ArrowLeft className="w-5 h-5 flex-shrink-0 group-hover:text-emerald-700" />
              <span
                className={`ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isSidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                }`}
              >
                Đổi sang Học Sinh
              </span>
            </button>
          )}

          {props.onLogout && (
            <button
              onClick={props.onLogout}
              title={!isSidebarHovered ? 'Đăng xuất' : undefined}
              className={`w-full flex items-center p-2.5 rounded-xl text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium group ${
                isSidebarHovered ? 'px-3 justify-start' : 'justify-center'
              }`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-rose-600" />
              <span
                className={`ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isSidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                }`}
              >
                Đăng xuất
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT (TỰ ĐỘNG DỊCH CHUYỂN KHI THANH BÊN MỞ RỘNG) ── */}
      <main className="flex-1 overflow-y-auto relative">
         {renderContent()}
      </main>

    </div>
  );
};
