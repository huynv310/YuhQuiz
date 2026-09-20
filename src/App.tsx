import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { bootSession, signOutEverywhere } from './lib/session';

// === CORE COMPONENTS (Logic thực) ===
import { AuthModal } from './components/AuthModal';
import { CompleteProfileModal } from './components/CompleteProfileModal';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentPortal } from './components/StudentPortal';
import { StudentExamRoom } from './components/StudentExamRoom';
import { ExamPrepScreen } from './components/StudentPortal/ExamPrepScreen';
import { readPendingExam, clearPendingExam } from './lib/examId';

// === LANDING PAGE (UI/UX Pro Max + GSAP + Three.js) ===
import LandingPage from './pages/LandingPage';
import { LogoMark } from './components/Logo';

// === TYPES ===
import { Exam } from './types/exam';

// =========================================================
// APP STATE MACHINE
// Luồng phân nhánh theo đúng Kiến trúc Báo cáo Kỹ thuật:
//
//  'landing'       → Chưa đăng nhập → Hiển thị Landing Page + Form thi nhanh
//  'auth'          → Modal Đăng nhập / Đăng ký
//  'complete_profile' → Hoàn thiện Profile sau Google OAuth
//  'teacher'       → Dashboard Giáo viên (Quản lý đề, lớp, chấm bài)
//  'student_portal' → Cổng Học sinh (Danh sách đề, lớp, lịch sử)
//  'exam_room'     → Phòng thi (StudentExamRoom với IndexedDB + Jitter)
// =========================================================
type AppMode = 'landing' | 'auth' | 'complete_profile' | 'teacher' | 'student_portal' | 'exam_prep' | 'exam_room';

interface ActiveExamSession {
  examId: string;
  studentName: string;
  className: string;
  school: string;
  reviewSubmissionId?: string;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('landing');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [authRole, setAuthRole] = useState<'teacher' | 'student'>('student');
  const [activeExam, setActiveExam] = useState<ActiveExamSession | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [prepKey, setPrepKey] = useState<string | null>(null);
  useEffect(() => { document.documentElement.dataset.mode = mode; }, [mode]);

  // ─────────────────────────────────────────────────────────
  // AUTH LISTENER: Theo dõi session Supabase
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Lấy session hiện tại
    bootSession().catch(() => undefined).then(() => supabase.auth.getSession()).then(async ({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        await loadProfile(session.user);
      } else {
        // Chưa đăng nhập, kiểm tra xem có link chia sẻ không
        if (readPendingExam()) {
          setAuthRole('student');
          setIsAuthModalOpen(true);
        }
      }
      setIsLoadingAuth(false);
    });

    // Lắng nghe thay đổi Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUser(session.user);
        await loadProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserProfile(null);
        setMode('landing');
      } else if (event === 'USER_UPDATED' && session?.user) {
        setCurrentUser(session.user);
        await loadProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────
  // LOAD PROFILE & AUTO-ROUTE theo role
  // ─────────────────────────────────────────────────────────
  const loadProfile = async (user: any) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      // Google OAuth user chưa có profile → cần hoàn thiện
      setShowCompleteProfile(true);
      return;
    }

    setUserProfile(profile);

    routeAfterLogin(profile, user);
  };

  // Điều hướng sau đăng nhập: có link đề (QR) → màn hình chuẩn bị; không thì về dashboard theo vai trò
  const routeAfterLogin = (profile: any, user?: any) => {
    const pending = readPendingExam();
    if (pending && profile.role !== 'teacher') {
      setPrepKey(pending);
      setMode('exam_prep');
      return;
    }
    if (pending) clearPendingExam();
    setMode(profile.role === 'teacher' ? 'teacher' : 'student_portal');
  };

  // ─────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOutEverywhere();
    setCurrentUser(null);
    setUserProfile(null);
    setActiveExam(null);
    setMode('landing');
  };

  // ─────────────────────────────────────────────────────────
  // VÀO PHÒNG THI (từ StudentPortal hoặc Landing Page)
  // ─────────────────────────────────────────────────────────
  const openPrep = (examId: string) => {
    setPrepKey(examId);
    setMode('exam_prep');
  };

  const handleStartExam = (examId: string, studentName: string, className: string, school: string, fresh = false) => {
    if (fresh) {
      // Làm lại từ đầu: bỏ phiên + bản nháp cũ để phòng thi cấp phiên mới (khóa trùng với StudentExamRoom)
      try {
        const key = `session_${String(examId).trim()}_${String(studentName || 'HocSinh').trim()}_${String(className || '12A').trim()}`;
        const old = localStorage.getItem(key);
        if (old) {
          localStorage.removeItem(`draft_${examId}_${old}`);
          localStorage.removeItem(`start_time_${examId}_${old}`);
        }
        localStorage.removeItem(key);
      } catch { /* noop */ }
    }
    setActiveExam({ examId, studentName, className, school });
    setMode('exam_room');
  };

  const handleReviewExam = (examId: string, studentName: string, className: string, school: string, submissionId?: string) => {
    setActiveExam({ examId, studentName, className, school, reviewSubmissionId: submissionId || 'latest' });
    setMode('exam_room');
  };

  // ─────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <LogoMark className="w-12 h-12 animate-pulse" />
          <p className="text-mutedForeground text-sm font-medium">Đang khởi động...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER THEO MODE
  // ─────────────────────────────────────────────────────────

  // 1. PHÒNG THI
  if (mode === 'exam_room' && activeExam) {
    return (
      <StudentExamRoom
        examId={activeExam.examId}
        studentName={activeExam.studentName}
        className={activeExam.className}
        reviewSubmissionId={activeExam.reviewSubmissionId}
        currentUser={currentUser}
        onExit={() => {
          setActiveExam(null);
          setMode(currentUser ? 'student_portal' : 'landing');
        }}
      />
    );
  }

  // 1b. MÀN HÌNH CHUẨN BỊ VÀO THI
  if (mode === 'exam_prep' && prepKey && currentUser) {
    return (
      <ExamPrepScreen
        examKey={prepKey}
        currentUser={currentUser}
        profile={userProfile}
        onBack={() => { clearPendingExam(); setPrepKey(null); setMode('student_portal'); }}
        onStart={(examId, className, fresh) => {
          clearPendingExam();
          handleStartExam(examId, userProfile?.full_name || currentUser.email?.split('@')[0] || 'Học sinh', className, userProfile?.school || 'THPT', fresh);
        }}
      />
    );
  }

  // 2. TEACHER DASHBOARD
  if (mode === 'teacher' && userProfile?.role === 'teacher') {
    return (
      <TeacherDashboard
        currentUser={currentUser}
        profile={userProfile}
        onProfileUpdated={setUserProfile}
        onLogout={handleLogout}
        onBackToHome={() => setMode('landing')}
        onPreviewExam={(examId: string) => {
          // Xem thử đề với tên giáo viên
          handleStartExam(examId, userProfile.full_name || 'Preview', 'GV', userProfile.school || '');
        }}
        onSwitchToStudentView={() => setMode('student_portal')}
      />
    );
  }

  // 3. STUDENT PORTAL
  if (mode === 'student_portal' && currentUser) {
    return (
      <StudentPortal
        currentUser={currentUser}
        profile={userProfile}
        onProfileUpdated={setUserProfile}
        onStartExam={(examId) => openPrep(examId)}
        onReviewExam={handleReviewExam}
        onLogout={handleLogout}
        onSwitchToTeacher={userProfile?.role === 'teacher' ? () => setMode('teacher') : undefined}
      />
    );
  }

  // 4. LANDING PAGE + MODAL AUTH + COMPLETE PROFILE
  return (
    <div className="relative">
      {/* Landing Page luôn render dưới cùng */}
      <LandingPage
        onTeacherLogin={() => {
          setAuthRole('teacher');
          setIsAuthModalOpen(true);
        }}
        onStudentLogin={() => {
          setAuthRole('student');
          setIsAuthModalOpen(true);
        }}
        onGuestExam={(examId) => {
          // Vào thi không cần đăng nhập → yêu cầu nhập tên
          setMode('student_portal');
        }}
        currentUser={currentUser}
        userProfile={userProfile}
        onEnterDashboard={() => {
          if (userProfile?.role === 'teacher') setMode('teacher');
          else setMode('student_portal');
        }}
      />

      {/* Modal Đăng nhập / Đăng ký */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          initialRole={authRole}
          onSuccess={(profile) => {
            setUserProfile(profile);
            setIsAuthModalOpen(false);
            routeAfterLogin(profile);
          }}
        />
      )}

      {/* Modal hoàn thiện hồ sơ sau Google OAuth */}
      {showCompleteProfile && currentUser && (
        <CompleteProfileModal
          user={currentUser}
          onSuccess={(profile) => {
            setUserProfile(profile);
            setShowCompleteProfile(false);
            routeAfterLogin(profile);
          }}
        />
      )}
    </div>
  );
}
