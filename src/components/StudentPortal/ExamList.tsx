import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Clock, Award, Trophy, TrendingUp, 
  Calendar, CheckCircle2, ArrowRight, Plus, RefreshCw, LogOut, 
  GraduationCap, School, ShieldCheck, Eye, Sparkles, Filter, 
  Layers, CheckCircle, Download, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exam, Submission } from '../../types/exam';
import { JoinClassModal } from '../JoinClassModal';
import { LeaderboardModal } from '../LeaderboardModal';
import { SUBJECT_PRESETS } from '../../constants/subjectPresets';
import { RescuePanel } from './RescuePanel';
import { downloadRescue } from '../../lib/rescue';
import { ExamSearchBar, ExamIdChips, SubjectGroups, filterExams } from '../SubjectGroups';

interface StudentPortalProps {
  currentUser: any;
  profile?: any;
  onReviewExam?: (examId: string, studentName: string, className: string, school: string, submissionId?: string) => void;
  onStartExam: (examId: string, studentName: string, className: string, school: string) => void;
  onLogout: () => void;
  onSwitchToTeacher?: () => void;
}

export const ExamList: React.FC<StudentPortalProps> = ({
  currentUser,
  profile,
  onStartExam,
  onReviewExam,
  onLogout,
  onSwitchToTeacher,
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'classes' | 'history'>('exams');
  const [exams, setExams] = useState<any[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab lọc theo từng lớp học (YÊU CẦU: PHÂN LOẠI RIÊNG THEO LỚP)
  const [selectedClassTab, setSelectedClassTab] = useState<string>('all');
  const [examQuery, setExamQuery] = useState('');
  const [examGrade, setExamGrade] = useState<number | 'all'>('all');
  const [examSubject, setExamSubject] = useState('all');

  // Modals
  const [isJoinClassOpen, setIsJoinClassOpen] = useState(false);
  const [selectedLeaderboardExam, setSelectedLeaderboardExam] = useState<Exam | null>(null);

  const loadStudentData = async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);

    try {
      // 1. Tải danh sách lớp học học sinh đã tham gia
      const { data: mems } = await supabase
        .from('class_memberships')
        .select('*')
        .eq('student_id', currentUser.id);

      let classes: any[] = [];
      const classIds = (mems || []).map((m: any) => m.class_id).filter(Boolean);

      if (classIds.length > 0) {
        const { data: classList } = await supabase
          .from('classrooms')
          .select('*')
          .in('id', classIds);
        classes = classList || [];
      }
      setJoinedClasses(classes);

      // Tạo bản đồ tra cứu tên lớp
      const classNameMap = new Map<string, string>();
      classes.forEach(c => classNameMap.set(c.id, c.name));

      // 2. Tải danh sách đề thi công khai
      const { data: pubExams } = await supabase
        .from('public_exams')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Lấy đề giao theo lớp kèm tên lớp cụ thể
      let assignedExams: any[] = [];
      if (classIds.length > 0) {
        const { data: assigns } = await supabase
          .from('exam_assignments')
          .select('exam_id, class_id, start_at, end_at')
          .in('class_id', classIds);

        if (assigns && assigns.length > 0) {
          const assignedExamIds = Array.from(new Set(assigns.map((a: any) => a.exam_id)));
          const { data: assignedExList } = await supabase
            .from('public_exams')
            .select('*')
            .in('id', assignedExamIds);

          if (assignedExList) {
            assignedExams = assignedExList.map((ex: any) => {
              const myAssigns = assigns.filter((a: any) => a.exam_id === ex.id);
              const classNames = myAssigns.map((a: any) => classNameMap.get(a.class_id) || 'Lớp học');
              const cIds = myAssigns.map((a: any) => a.class_id);

              return {
                ...ex,
                isAssigned: true,
                assignedClassIds: cIds,
                assignedClassNames: classNames,
              };
            });
          }
        }
      }

      // Gộp và loại bỏ trùng lặp
      const examMap = new Map<string, any>();
      (pubExams || []).forEach(e => {
        if (!e.is_private) {
          examMap.set(e.id, { ...e, isAssigned: false });
        }
      });
      assignedExams.forEach(e => examMap.set(e.id, { ...e, isAssigned: true }));

      setExams(Array.from(examMap.values()));

      // 3. TẢI LỊCH SỬ THI (ĐỒNG BỘ CẢ THEO ID VÀ TÊN THÍ SINH ĐỂ KHÔNG BỊ RỖNG)
      let subsQuery = supabase.from('submissions').select('*');
      const studentFullName = currentUser?.full_name || currentUser?.user_metadata?.full_name || '';
      
      if (currentUser?.id && studentFullName) {
        subsQuery = subsQuery.or(`student_id.eq.${currentUser.id},student_name.eq."${studentFullName}"`);
      } else if (currentUser?.id) {
        subsQuery = subsQuery.eq('student_id', currentUser.id);
      }
      
      const { data: subs } = await subsQuery.order('submitted_at', { ascending: false });

      if (subs) {
        setSubmissions(subs);
      }
    } catch (err) {
      console.warn('Lỗi nạp dữ liệu học sinh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [currentUser]);

  /** Xem lại: chỉ đọc bài đã nộp, không tạo lượt làm mới. */
  const handleReviewOne = (ex: any, sub: any) => {
    const sName = currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Học sinh';
    const cName = ex.assignedClassNames?.[0] || joinedClasses[0]?.name || '12A';
    const school = currentUser?.school || currentUser?.user_metadata?.school || 'THPT';
    onReviewExam?.(ex.id, sub?.student_name || sName, sub?.class_name || cName, school, sub?.id);
  };

  const handleLaunchExam = (ex: any) => {
    const sName = currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Học sinh';
    
    // Nếu đề thi thuộc lớp cụ thể thì gán tên lớp đó
    let cName = '12A';
    if (ex.assignedClassNames && ex.assignedClassNames.length > 0) {
      cName = ex.assignedClassNames[0];
    } else if (joinedClasses.length > 0) {
      cName = joinedClasses[0].name;
    }

    const school = currentUser?.school || currentUser?.user_metadata?.school || 'THPT';
    onStartExam(ex.id, sName, cName, school);
  };

  // Lọc theo Tab lớp đang chọn
  const selectedClassObj = joinedClasses.find(c => c.id === selectedClassTab);
  const selectedClassName = selectedClassObj ? selectedClassObj.name : null;

  // Lọc danh sách đề thi theo Tab lớp
  const classExams = exams.filter(e => {
    if (selectedClassTab === 'all') return true;
    return e.assignedClassIds?.includes(selectedClassTab);
  });
  const currentExams = filterExams(classExams, examQuery, examGrade, examSubject);
  const looksLikeCode = /^[0-9A-Za-z]{6}$/.test(examQuery.trim());

  // Lọc danh sách bài làm và tính điểm trung bình riêng của lớp đó
  const classSubs = submissions.filter(s => {
    if (selectedClassTab === 'all') return true;
    return s.class_name?.toLowerCase() === selectedClassName?.toLowerCase();
  });

  const completedSubs = classSubs.filter(s => s.status === 'submitted' && s.score !== null);
  const classAvgScore = completedSubs.length > 0 
    ? (completedSubs.reduce((a, b) => a + (b.score || 0), 0) / completedSubs.length).toFixed(1)
    : '--';

  return (
    <div className="flex-1 bg-transparent text-slate-900 font-sans antialiased pb-12 flex flex-col min-h-screen">

      {/* 2. PROFILE HERO BANNER & THỐNG KÊ RIÊNG THEO LỚP */}
      <div className="glass-panel border-b border-gray-100 py-6 px-4 md:px-8 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* User Info */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'H'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-2xl text-gray-900 leading-tight">
                  {profile?.full_name || currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Học sinh'}
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  Học sinh
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <span>{profile?.school || currentUser?.school || 'Trường THPT'}</span>
                <span>•</span>
                <span>Mã: <b className="font-mono text-gray-700">{profile?.user_code || '—'}</b></span>
              </div>
            </div>
          </div>

          {/* Stats and Action */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white/50 p-3 px-5 rounded-2xl border border-white/70 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {selectedClassName ? `Điểm TB Lớp ${selectedClassName}` : 'Điểm TB Tích Lũy'}
                </span>
                <span className="text-xl font-extrabold text-emerald-600">{classAvgScore}</span>
              </div>
              <div className="bg-white/50 p-3 px-5 rounded-2xl border border-white/70 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {selectedClassName ? `Đã làm ở ${selectedClassName}` : 'Tổng bài đã nộp'}
                </span>
                <span className="text-xl font-extrabold text-slate-800">{completedSubs.length} đề</span>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-200 hidden md:block"></div>

            <button
              onClick={() => setIsJoinClassOpen(true)}
              className="flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-primary-dark border border-blue-200 px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Vào lớp mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. TABS ĐIỀU HƯỚNG CHÍNH */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-8 mt-6">
        <div className="flex space-x-2 border-b border-gray-200 pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'exams' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Đề thi & Bài tập ({classExams.length})
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'classes' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Lớp học của tôi ({joinedClasses.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'history' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tiến độ & Lịch sử thi ({completedSubs.length})
          </button>
        </div>

        {/* PHÂN LOẠI TAB THEO TỪNG LỚP HỌC (YÊU CẦU: CHỌN LỚP ĐỂ XEM ĐỀ & ĐIỂM RIÊNG) */}
        {joinedClasses.length > 0 && activeTab !== 'classes' && (
          <div className="mt-4 flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wider text-[11px] flex-shrink-0">
              Lọc theo lớp:
            </span>
            <button
              onClick={() => setSelectedClassTab('all')}
              className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                selectedClassTab === 'all' 
                  ? 'bg-gray-900 text-white shadow-xs' 
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tất cả các lớp ({exams.length})
            </button>
            {joinedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassTab(cls.id)}
                className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                  selectedClassTab === cls.id 
                    ? 'bg-primary text-white shadow-xs' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Lớp {cls.name} ({cls.subject})
              </button>
            ))}
          </div>
        )}

        {/* NỘI DUNG TỪNG TAB */}
        <div className="mt-5">
          
          {/* TAB 1: DANH SÁCH ĐỀ THI */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">
                  {selectedClassName ? `Bài tập giao cho Lớp ${selectedClassName}` : 'Danh sách đề thi sẵn sàng'}
                </span>
              </div>

              <ExamSearchBar query={examQuery} onQuery={setExamQuery} grade={examGrade} onGrade={setExamGrade} subject={examSubject} onSubject={setExamSubject} />
              {looksLikeCode && currentExams.length === 0 && (
                <button onClick={() => onStartExam(examQuery.trim().toUpperCase(), '', '', '')} className="btn btn-primary">
                  Mở đề có mã {examQuery.trim().toUpperCase()}
                </button>
              )}

              <SubjectGroups items={currentExams} empty="Không có đề nào phù hợp." renderItem={(ex) => {
                    const preset = SUBJECT_PRESETS[ex.subject];
                    const badgeColor = preset?.badge || 'bg-gray-100 text-gray-700';
                    const subRecord = submissions.find(s => s.exam_id === ex.id && s.status === 'submitted');

                    return (
                      <div
                        key={ex.id}
                        className="glass-panel p-5 rounded-3xl shadow-xs hover:border-gray-300 transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${badgeColor}`}>
                                {ex.subject}
                              </span>

                              {/* GHI RÕ THÔNG TIN LỚP ĐƯỢC GIAO HOẶC CÔNG KHAI (CHỐNG CHÈN CHỮ) */}
                              {ex.is_private ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap flex-shrink-0">
                                  🔒 Lớp: {ex.assignedClassNames?.join(', ') || 'Riêng theo lớp'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-primary-dark border border-emerald-200 whitespace-nowrap flex-shrink-0">
                                  🌐 Kỳ thi Công khai
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-gray-500 font-bold whitespace-nowrap flex-shrink-0">{ex.duration_minutes} phút</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5"><ExamIdChips exam={ex} /></div>
                          <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                            {ex.title}
                          </h3>
                          <p className="text-xs text-gray-400">Giao bởi: <b className="text-gray-700">{ex.teacher_name || 'Giáo viên'}</b></p>
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedLeaderboardExam(ex)}
                            className="text-xs text-amber-700 font-bold hover:underline flex items-center space-x-1"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>Top 20% vinh danh</span>
                          </button>

                          {subRecord ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-extrabold text-primary bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                Điểm: {subRecord.score}đ
                              </span>
                              {onReviewExam && (
                                <button
                                  onClick={() => handleReviewOne(ex, subRecord)}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1"
                                  title="Chỉ xem bài đã nộp và đáp án, không làm lại"
                                >
                                  <Eye className="w-3.5 h-3.5" /><span>Xem lại</span>
                                </button>
                              )}
                              {ex.allow_multiple_attempts === false ? (
                                <span className="text-xs font-bold text-slate-400 px-1">Chỉ làm 1 lần</span>
                              ) : (
                                <button
                                  onClick={() => handleLaunchExam(ex)}
                                  className="bg-primary hover:bg-primary-dark text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1"
                                  title="Làm lại bài từ đầu (tính thêm một lượt làm mới)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /><span>Làm lại</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleLaunchExam(ex)}
                              className="bg-primary hover:bg-primary-dark active:scale-95 text-white px-5 py-2 rounded-full text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition-all"
                            >
                              <span>Làm bài thi</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }} />
            </div>
          )}

          {/* TAB 2: LỚP HỌC CỦA TÔI */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-gray-400 uppercase tracking-wider">Danh sách lớp học đã tham gia</span>
                <button
                  onClick={() => setIsJoinClassOpen(true)}
                  className="bg-primary text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nhập mã vào lớp</span>
                </button>
              </div>

              {joinedClasses.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center space-y-3">
                  <Users className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-bold text-gray-700">Bạn chưa tham gia lớp học nào</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Hãy hỏi thầy/cô giáo của bạn mã lớp 6 ký tự hoặc quét mã QR trên lớp để nhận các bài thi được giao.
                  </p>
                  <button
                    onClick={() => setIsJoinClassOpen(true)}
                    className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-bold"
                  >
                    Nhập mã tham gia lớp
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {joinedClasses.map((cls) => (
                    <div 
                      key={cls.id} 
                      onClick={() => {
                        setSelectedClassTab(cls.id);
                        setActiveTab('exams');
                      }}
                      className="glass-panel p-5 rounded-3xl space-y-3 shadow-xs hover:border-primary transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-base text-gray-900">{cls.name}</span>
                        <span className="text-xs bg-emerald-50 text-primary-dark px-2 py-0.5 rounded-full font-bold">
                          {cls.subject}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Môn học: <b className="text-gray-800">{cls.subject}</b></p>
                      <p className="text-[11px] text-gray-400">{cls.school || 'Trường THPT'}</p>
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-400">
                        <span>Mã lớp: <b className="text-gray-700">{cls.class_code}</b></span>
                        <span className="text-primary font-sans font-bold flex items-center">
                          Xem bài tập →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TIẾN ĐỘ & LỊCH SỬ THI RIÊNG CỦA LỚP ĐANG CHỌN */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <RescuePanel currentUser={{ ...currentUser, school: profile?.school }} submittedTokens={new Set(submissions.filter(s => s.status === 'submitted').map(s => s.session_token))}
                           examTitleOf={id => exams.find(e => e.id === id)?.title} onSubmitted={loadStudentData} />
              <div className="glass-panel rounded-3xl border border-gray-200 p-5 shadow-xs">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">
                    {selectedClassName ? `Lịch sử bài làm Lớp ${selectedClassName}` : 'Toàn bộ lịch sử làm bài'}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Đã hoàn thành: {completedSubs.length} bài
                  </span>
                </div>

                {completedSubs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {selectedClassName ? `Bạn chưa có bài nộp nào thuộc Lớp ${selectedClassName}.` : 'Bạn chưa nộp bài thi nào.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {completedSubs.map((sub) => (
                      <div key={sub.id} className="bg-white/50 p-3.5 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-extrabold text-sm text-gray-900 block">{sub.student_name}</span>
                          <span className="text-[11px] text-gray-500">
                            Lớp: <b className="text-gray-800">{sub.class_name}</b> • Ngày nộp: {new Date(sub.submitted_at || sub.started_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="text-right">
                          {onReviewExam && (
                            <button onClick={() => onReviewExam(sub.exam_id, sub.student_name, sub.class_name || '', profile?.school || 'THPT', sub.id)}
                                    className="btn btn-secondary !py-1 !px-2.5 !text-xs mb-1"><Eye className="w-3.5 h-3.5" /> Xem lại bài & đáp án</button>
                          )}
                          {sub.answers && sub.session_token && (
                            <button onClick={() => downloadRescue({ examId: sub.exam_id, examTitle: exams.find(e => e.id === sub.exam_id)?.title, studentName: sub.student_name, className: sub.class_name || '', sessionToken: sub.session_token, answers: sub.answers, cheatCount: sub.cheat_count || 0, totalAwaySecs: sub.total_away_seconds || 0, timestamp: Date.now() })}
                                    className="btn btn-secondary !py-1 !px-2.5 !text-xs mb-1 ml-1"><Download className="w-3.5 h-3.5" /> Xuất .yuhquiz</button>
                          )}
                          <span className="text-base font-extrabold text-primary block">
                            {sub.score !== null ? `${sub.score} đ` : '--'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {sub.cheat_count === 0 ? 'Tập trung 100%' : `Rời tab: ${sub.cheat_count} lần`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL THAM GIA LỚP */}
      {isJoinClassOpen && (
        <JoinClassModal
          currentUser={currentUser}
          onClose={() => setIsJoinClassOpen(false)}
          onSuccess={() => {
            setIsJoinClassOpen(false);
            loadStudentData();
          }}
        />
      )}

      {/* MODAL LEADERBOARD VINH DANH TOP 20% */}
      {selectedLeaderboardExam && (
        <LeaderboardModal
          exam={selectedLeaderboardExam}
          submissions={[]}
          onClose={() => setSelectedLeaderboardExam(null)}
        />
      )}

    </div>
  );
};
