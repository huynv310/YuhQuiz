import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  BookOpen, User, ShieldCheck, ArrowRight, Sparkles, GraduationCap, 
  LogIn, Users, Plus, LogOut, Award, CheckCircle2, LayoutDashboard, 
  ChevronRight, ArrowUpRight 
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { StudentExamRoom } from './components/StudentExamRoom';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentPortal } from './components/StudentPortal';
import { ExamCardSelector } from './components/ExamCardSelector';
import { AuthModal } from './components/AuthModal';
import { CompleteProfileModal } from './components/CompleteProfileModal';
import { Exam } from './types/exam';
import { FloatingBubbles } from './components/FloatingBubbles';

export function App() {
  const [mode, setMode] = useState<'home' | 'student_exam' | 'teacher' | 'student_portal'>('home');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  
  // Thông tin thí sinh vào thi (BẮT ĐẦU TRỐNG 100%, HỌC SINH TỰ GÕ TÊN)
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');

  // Phiên thi đang hoạt động (Đảm bảo không bao giờ bị lệch dữ liệu)
  const [activeExamSession, setActiveExamSession] = useState<{
    examId: string;
    studentName: string;
    className: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('active_exam_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.examId && parsed.studentName && parsed.className) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  // Trạng thái tài khoản người dùng
  // Thu phóng cỡ chữ toàn trang web (85% - 120%)
  const [fontZoom, setFontZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('web_font_zoom');
      if (saved) return parseInt(saved, 10);
    } catch (e) {}
    return 100;
  });

  const handleFontZoom = (delta: number) => {
    setFontZoom((prev) => {
      const next = Math.max(85, Math.min(120, prev + delta));
      localStorage.setItem('web_font_zoom', next.toString());
      document.documentElement.style.fontSize = `${(next / 100) * 16}px`;
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.style.fontSize = `${(fontZoom / 100) * 16}px`;
  }, [fontZoom]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Tải danh sách đề thi công khai (CHỈ ĐỀ CÔNG KHAI MỚI HIỆN CHO KHÁCH)
  const loadExams = async () => {
    try {
      const { data, error } = await supabase
        .from('public_exams')
        .select('*')
        .eq('is_active', true)
        .eq('is_private', false)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setExams(data);
        if (!selectedExamId) {
          setSelectedExamId(data[0].id);
        }
      } else {
        setExams([]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách đề thi:', err);
    }
  };

  // Tải profile người dùng từ database
  const loadProfile = async (user: any) => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (prof && prof.role) {
        setUserProfile(prof);
      } else {
        setShowCompleteProfile(true);
      }
    } catch (err) {
      console.warn('Lỗi tải hồ sơ:', err);
    }
  };

  useEffect(() => {
    if (activeExamSession) {
      setSelectedExamId(activeExamSession.examId);
      setStudentName(activeExamSession.studentName);
      setClassName(activeExamSession.className);
      setMode('student_exam');
    }

    loadExams();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) loadProfile(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) loadProfile(user);
      else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // BẮT ĐẦU THI AN TOÀN TUYỆT ĐỐI (KIỂM SOÁT BÀI THI RIÊNG TƯ THEO LỚP)
  const handleStartExam = async (
    e?: React.FormEvent,
    customExamId?: string,
    customName?: string,
    customClass?: string
  ) => {
    if (e) e.preventDefault();

    const targetExamId = String(customExamId || selectedExamId || '').trim();
    const targetName = String(customName || studentName || '').trim();
    const targetClass = String(customClass || className || '').trim();

    if (!targetName || !targetClass || !targetExamId) {
      alert('Vui lòng nhập đầy đủ Họ tên, Lớp và chọn Đề thi!');
      return;
    }

    // Kiểm tra tính riêng tư của đề thi
    const { data: checkExam } = await supabase
      .from('public_exams')
      .select('*')
      .eq('id', targetExamId)
      .maybeSingle();

    if (checkExam?.is_private) {
      // 1. Khách vãng lai chưa đăng nhập -> Chặn tuyệt đối
      if (!currentUser) {
        alert('Kỳ thi này là bài tập riêng theo lớp! Thí sinh vãng lai không được phép tham gia.\nVui lòng Đăng nhập tài khoản Học sinh thuộc lớp hoặc Giáo viên để làm bài.');
        setIsAuthModalOpen(true);
        return;
      }
    }

    const sessionData = {
      examId: targetExamId,
      studentName: targetName,
      className: targetClass,
    };

    localStorage.setItem('active_exam_session', JSON.stringify(sessionData));
    setActiveExamSession(sessionData);
    setSelectedExamId(targetExamId);
    setStudentName(targetName);
    setClassName(targetClass);
    setMode('student_exam');
  };

  const handleExitExam = () => {
    localStorage.removeItem('active_exam_session');
    setActiveExamSession(null);

    if (currentUser) {
      if (userProfile?.role === 'teacher') {
        setMode('teacher');
      } else {
        setMode('student_portal');
      }
    } else {
      setMode('home');
    }
    loadExams();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    setMode('home');
    alert('Đã đăng xuất tài khoản.');
  };

  // 1. CHẾ ĐỘ PHÒNG THI HỌC SINH (CORE NGUYÊN BẢN v11)
  if (mode === 'student_exam' && activeExamSession) {
    return (
      <StudentExamRoom
        examId={activeExamSession.examId}
        studentName={activeExamSession.studentName}
        className={activeExamSession.className}
        currentUser={currentUser}
        onExit={handleExitExam}
      />
    );
  }

  // 2. CHẾ ĐỘ QUẢN TRỊ GIÁO VIÊN
  if (mode === 'teacher') {
    return (
      <TeacherDashboard
        currentUser={userProfile || currentUser}
        onLogout={handleLogout}
        onBackToHome={() => setMode('home')}
        onPreviewExam={(examId) => {
          handleStartExam(
            undefined, 
            examId, 
            userProfile?.full_name ? `GV: ${userProfile.full_name}` : 'Thầy Nguyễn Văn A', 
            '12 Demo'
          );
        }}
        onSwitchToStudentView={() => setMode('student_portal')}
      />
    );
  }

  // 3. CHẾ ĐỘ DASHBOARD HỌC SINH (LỚP HỌC & LỊCH SỬ THI)
  if (mode === 'student_portal' && currentUser) {
    return (
      <StudentPortal
        currentUser={userProfile || currentUser}
        onStartExam={(examId, sName, cName) => {
          handleStartExam(undefined, examId, sName, cName);
        }}
        onLogout={handleLogout}
        onSwitchToTeacher={userProfile?.role === 'teacher' ? () => setMode('teacher') : undefined}
      />
    );
  }

  // 4. TRANG CHỦ LỰA CHỌN (GIAO DIỆN CHUẨN THƯƠNG HIỆU YUHQUIZ VỚI NÚT ACTION RÕ RÀNG THEO CHUẨN UX/UI)
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#121212] flex flex-col justify-between font-sans overflow-x-hidden w-full max-w-full">
      
      {/* NAVBAR */}
      {/* NAVBAR VỚI HAMBURGER MENU DROPDOWN CHUẨN UX/UI MOBILE */}
      <nav className="h-20 max-w-7xl mx-auto w-full px-4 md:px-8 flex items-center justify-between relative">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1DB954] flex items-center justify-center text-white font-extrabold shadow-sm flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight leading-tight block">
              Yuh<span className="text-[#1DB954]">Quiz</span>
            </span>
            <span className="text-[10px] block font-semibold text-gray-400 -mt-1 uppercase tracking-wider">
              Thi thử TN THPT
            </span>
          </div>
        </div>

        {/* CỤM ĐIỀU KHIỂN ĐỒNG NHẤT: MENU BAR THẢ XUỐNG DẠNG NÚT = / ☰ CHO CẢ PC VÀ ĐIỆN THOẠI */}
        <div className="flex items-center space-x-3 relative">
          
          {/* PHÍM CỠ CHỮ NHANH TRÊN DESKTOP */}
          <div className="hidden lg:flex items-center space-x-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200 text-xs shadow-2xs" title="Cỡ chữ trang web">
            <button
              type="button"
              onClick={() => handleFontZoom(-5)}
              disabled={fontZoom <= 85}
              className="w-6 h-6 rounded-lg hover:bg-white flex items-center justify-center font-bold text-gray-700 disabled:opacity-30 transition-all cursor-pointer"
              title="Giảm cỡ chữ (Tối thiểu 85%)"
            >
              A-
            </button>
            <span className="font-mono text-[11px] font-bold text-gray-800 min-w-[34px] text-center select-none">
              {fontZoom}%
            </span>
            <button
              type="button"
              onClick={() => handleFontZoom(5)}
              disabled={fontZoom >= 120}
              className="w-6 h-6 rounded-lg hover:bg-white flex items-center justify-center font-bold text-gray-700 disabled:opacity-30 transition-all cursor-pointer"
              title="Tăng cỡ chữ (Tối đa 120%)"
            >
              A+
            </button>
          </div>

          {/* TRÊN DESKTOP: VẪN HIỆN SẴN NÚT VÀO QUẢN TRỊ / GÓC HỌC TẬP TRỰC TIẾP */}
          {currentUser && (
            <div className="hidden md:flex items-center space-x-2">
              {userProfile?.role === 'teacher' ? (
                <button
                  type="button"
                  onClick={() => setMode('teacher')}
                  className="flex items-center space-x-1.5 bg-[#1DB954] hover:bg-[#169C46] text-white px-4 py-2 rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>VÀO QUẢN TRỊ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('student_portal')}
                  className="flex items-center space-x-1.5 bg-[#1DB954] hover:bg-[#169C46] text-white px-4 py-2 rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>VÀO GÓC HỌC TẬP</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {/* NÚT MENU BAR DẠNG NÚT = / ☰ (HIỆN DIỆN 100% TRÊN MỌI MÀN HÌNH) */}
          <div className="relative">
            {currentUser ? (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex items-center space-x-2 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 p-1.5 sm:px-3 sm:py-2 rounded-2xl transition-all shadow-xs cursor-pointer select-none"
                title="Bấm để mở Menu chức năng"
              >
                <div className="w-8 h-8 rounded-xl bg-[#1DB954] text-white flex items-center justify-center font-extrabold text-xs shadow-xs flex-shrink-0">
                  {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden sm:block max-w-[140px] truncate">
                  <span className="font-extrabold text-xs text-gray-900 block truncate leading-tight">
                    {userProfile?.full_name || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold block truncate">
                    {userProfile?.role === 'teacher' ? '👨‍🏫 Giáo viên' : '🎓 Học sinh'}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 ml-1 flex-shrink-0">
                  <Menu className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex items-center space-x-2 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-2xl transition-all shadow-xs cursor-pointer select-none font-bold text-xs text-gray-800"
                title="Menu"
              >
                <Menu className="w-4 h-4 text-gray-700" />
                <span>Menu</span>
              </button>
            )}

            {/* DROPDOWN MENU THẢ XUỐNG CHUẨN XÁC KHI CLICK (HIỂN THỊ TRÊN CẢ PC VÀ MOBILE) */}
            {isMobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black/15"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="absolute top-14 right-0 w-72 sm:w-80 bg-white border border-gray-200 rounded-3xl shadow-2xl p-4 z-50 space-y-3">
                {currentUser ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                      <div className="w-10 h-10 rounded-xl bg-[#1DB954] text-white font-extrabold text-base flex items-center justify-center shadow-xs">
                        {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <span className="font-extrabold text-sm text-gray-900 truncate block">
                          {userProfile?.full_name || currentUser.email}
                        </span>
                        <span className="text-[10px] font-bold text-[#15803D] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {userProfile?.role === 'teacher' ? '👨‍🏫 Giáo viên' : '🎓 Học sinh'}
                        </span>
                      </div>
                    </div>

                    {userProfile?.role === 'teacher' ? (
                      <button
                        onClick={() => {
                          setMode('teacher');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#169C46] text-white font-extrabold text-xs flex items-center justify-between shadow-sm transition-all"
                      >
                        <span className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4" />
                          <span>TRUNG TÂM QUẢN TRỊ GV</span>
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setMode('student_portal');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#169C46] text-white font-extrabold text-xs flex items-center justify-between shadow-sm transition-all"
                      >
                        <span className="flex items-center space-x-2">
                          <GraduationCap className="w-4 h-4" />
                          <span>GÓC HỌC TẬP CỦA BẠN</span>
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                      <span className="text-gray-600 font-bold">Cỡ chữ trang:</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleFontZoom(-5)}
                          disabled={fontZoom <= 85}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 font-bold hover:bg-gray-100"
                        >
                          A-
                        </button>
                        <span className="font-mono text-xs font-bold px-1.5">{fontZoom}%</span>
                        <button
                          onClick={() => handleFontZoom(5)}
                          disabled={fontZoom >= 120}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 font-bold hover:bg-gray-100"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full py-2.5 text-center text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => {
                        setIsAuthModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#169C46] text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Đăng nhập / Đăng ký</span>
                    </button>

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                      <span className="text-gray-600 font-bold">Cỡ chữ trang:</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleFontZoom(-5)}
                          disabled={fontZoom <= 85}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 font-bold hover:bg-gray-100"
                        >
                          A-
                        </button>
                        <span className="font-mono text-xs font-bold px-1.5">{fontZoom}%</span>
                        <button
                          onClick={() => handleFontZoom(5)}
                          disabled={fontZoom >= 120}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 font-bold hover:bg-gray-100"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          </div>

        </div>

      </nav>

      {/* HERO & VÀO PHÒNG THI (TỰ ĐỘNG THÍCH ỨNG & BIẾN THIÊN THEO MỌI TỶ LỆ MÀN HÌNH) */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center w-full overflow-hidden">
        
        {/* HUY HIỆU CHÀO MỪNG BIẾN THIÊN TỰ ĐỘNG THEO CHIỀU RỘNG MÀN HÌNH */}
        <div className="inline-flex items-center space-x-1.5 sm:space-x-2 bg-emerald-50 text-[#15803D] border border-emerald-200 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold mb-4 sm:mb-6 shadow-2xs max-w-full text-center">
          <Sparkles className="w-3.5 h-3.5 text-[#1DB954] flex-shrink-0" />
          <span className="leading-snug break-words">
            Chào mừng đến với YuhQuiz – Nền tảng khảo thí trực tuyến dành cho học sinh THPT
          </span>
        </div>

        {/* TIÊU ĐỀ CHÍNH BIẾN THIÊN MƯỢT MÀ */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-gray-950 tracking-tight max-w-2xl leading-tight break-words px-1">
          Nền tảng khảo thí trực tuyến nhanh gọn và tiện ích dành cho học sinh THPT
        </h1>
        
        {/* MÔ TẢ PHỤ */}
        <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-2.5 sm:mt-3 max-w-xl leading-relaxed px-2 break-words">
          Cung cấp giải pháp tổ chức thi và thi thử toàn diện, đáp ứng linh hoạt nhu cầu đánh giá năng lực.
        </p>

        {/* 1. THẺ HỌC SINH ĐÃ ĐĂNG NHẬP */}
        {currentUser && userProfile?.role === 'student' && (
          <div className="w-full max-w-lg mt-6 bg-gradient-to-r from-emerald-50/90 via-green-50/80 to-teal-50/90 border-2 border-[#1DB954] rounded-3xl p-4 sm:p-5 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row items-center sm:justify-between gap-3.5 text-center sm:text-left animate-in fade-in duration-300">
            <div className="flex items-center space-x-3 text-left w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#1DB954] text-white flex items-center justify-center shadow-md flex-shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-extrabold text-[#15803D] uppercase tracking-wider block">
                  Không Gian Thí Sinh
                </span>
                <h3 className="font-extrabold text-base text-gray-900 leading-tight truncate">
                  Chào mừng, {userProfile?.full_name || 'Học sinh'}!
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Lớp học, bài tập được giao & biểu đồ tiến độ điểm số cá nhân
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto flex justify-center sm:justify-end flex-shrink-0 pt-1 sm:pt-0">
              <button
                onClick={() => setMode('student_portal')}
                className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#169C46] active:scale-95 text-white px-5 py-2.5 rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all whitespace-nowrap"
              >
                <span>VÀO GÓC HỌC TẬP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. THẺ GIÁO VIÊN ĐÃ ĐĂNG NHẬP (KHÔNG GIAN RỘNG RÃI, KHÔNG TRÀN VIỀN) */}
        {currentUser && userProfile?.role === 'teacher' && (
          <div className="w-full max-w-xl md:max-w-2xl mt-6 bg-gradient-to-r from-emerald-50/90 via-green-50/80 to-teal-50/90 border-2 border-[#1DB954] rounded-3xl p-5 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-left animate-in fade-in duration-300">
            <div className="flex items-center space-x-3.5 flex-1 min-w-0 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#1DB954] text-white flex items-center justify-center shadow-md flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-extrabold text-[#15803D] uppercase tracking-wider block">
                  Không Gian Giảng Dạy
                </span>
                <h3 className="font-extrabold text-base text-gray-900 leading-tight truncate">
                  Kính chào, {userProfile?.full_name || 'Thầy/Cô'}!
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Quản lý lớp, tạo đề thi, chấm lại bài & phân tích phổ điểm
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto flex justify-center sm:justify-end flex-shrink-0">
              <button
                onClick={() => setMode('teacher')}
                className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#169C46] active:scale-95 text-white px-5 py-3 rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all whitespace-nowrap"
              >
                <span>VÀO TRUNG TÂM QUẢN TRỊ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. THẺ CHƯA ĐĂNG NHẬP */}
        {!currentUser && (
          <div className="w-full max-w-xl md:max-w-2xl mt-6 bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-left">
            <div className="flex items-center space-x-3.5 flex-1 min-w-0 w-full sm:w-auto">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-gray-900 leading-snug">
                  Bạn là Học sinh hoặc Giáo viên?
                </h4>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Đăng nhập để nhận đề theo lớp và lưu bảng điểm lịch sử
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto flex justify-center sm:justify-end flex-shrink-0">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#169C46] active:scale-95 text-white px-6 py-3 rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-500/20 transition-all text-center whitespace-nowrap"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        )}

        {/* FORM THÍ SINH VÀO THI NHANH (CÂN XỨNG VỚI THẺ TRÊN) */}
        <div className="w-full max-w-xl md:max-w-2xl bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 mt-6 shadow-xl shadow-gray-100/50 text-left">
          <form onSubmit={handleStartExam} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">Họ và tên thí sinh *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs md:text-sm bg-[#FAFAFA] border border-gray-200 rounded-xl focus:border-[#1DB954] focus:bg-white focus:outline-none transition-all font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">Lớp *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 12A1"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs md:text-sm bg-[#FAFAFA] border border-gray-200 rounded-xl focus:border-[#1DB954] focus:bg-white focus:outline-none transition-all font-bold"
                />
              </div>
            </div>

            {/* DANH SÁCH THẺ KỲ THI CÔNG KHAI */}
            <div>
              <label className="font-bold text-gray-700 block mb-2">
                Chọn kỳ thi muốn tham gia *
              </label>
              <ExamCardSelector
                exams={exams}
                selectedId={selectedExamId}
                onSelect={setSelectedExamId}
              />
            </div>

            <button
              type="submit"
              disabled={exams.length === 0 || !selectedExamId}
              className="w-full mt-3 bg-[#1DB954] hover:bg-[#169C46] active:scale-[0.98] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Bắt đầu làm bài thi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="h-16 border-t border-gray-100 flex items-center justify-center text-xs text-gray-400">
        Phát triển theo quy chuẩn đề thi khảo sát và tốt nghiệp THPT.
      </footer>

      {/* MODAL ĐĂNG NHẬP / ĐĂNG KÝ HỢP NHẤT */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(profile) => {
            setUserProfile(profile);
            setIsAuthModalOpen(false);
            if (profile.role === 'teacher') {
              setMode('teacher');
            } else {
              setMode('student_portal');
            }
          }}
        />
      )}

      {/* MODAL HOÀN TẤT THÔNG TIN CHO GOOGLE LOGIN */}
      {showCompleteProfile && currentUser && (
        <CompleteProfileModal
          user={currentUser}
          onSuccess={(profile) => {
            setUserProfile(profile);
            setShowCompleteProfile(false);
            if (profile.role === 'teacher') {
              setMode('teacher');
            } else {
              setMode('student_portal');
            }
          }}
        />
      )}

    </div>
  );
}
export default App;
