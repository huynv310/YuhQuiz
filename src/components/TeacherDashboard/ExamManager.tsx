import React, { useState, useEffect } from 'react';
import { ExamSearchBar, ExamIdChips, SubjectGroups, filterExams } from '../SubjectGroups';
import { 
  Plus, Users, FileText, AlertTriangle, CheckCircle, 
  Clock, Award, Search, ArrowLeft, RefreshCw, Eye, CheckCircle2, XCircle, 
  Timer, Zap, Brain, Trash2, BarChart3, Code, LogOut, ShieldCheck, User, 
  Layers, ChevronRight, Edit, FileSpreadsheet, Trophy, Sparkles, Filter, 
  RotateCcw, StopCircle, Share2, Copy, Link, QrCode, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exam, Submission } from '../../types/exam';
import { CreateExamModal } from '../CreateExamModal';
import { ClassroomModal } from '../ClassroomModal';
import { ScoreDistributionChart } from '../ScoreDistributionChart';
import { ItemAnalysisTable } from '../ItemAnalysisTable';
import { QrImage } from '../QrImage';
import { RescueImportModal } from './RescueImportModal';
import { LeaderboardModal } from '../LeaderboardModal';
import { exportGradebookToExcel } from '../../utils/excelExporter';
import { SUBJECT_PRESETS } from '../../constants/subjectPresets';

interface TeacherDashboardProps {
  currentUser?: any;
  onLogout?: () => void;
  onBackToHome: () => void;
  onPreviewExam: (examId: string) => void;
  onSwitchToStudentView?: () => void;
}

export const ExamManager: React.FC<TeacherDashboardProps> = ({
  currentUser,
  onLogout,
  onBackToHome,
  onPreviewExam,
  onSwitchToStudentView,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegradingAll, setIsRegradingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [examQuery, setExamQuery] = useState('');
  const [examGrade, setExamGrade] = useState<number | 'all'>('all');
  const [examSubject, setExamSubject] = useState('all');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isRescueOpen, setIsRescueOpen] = useState(false);
  const [inspectSubmission, setInspectSubmission] = useState<Submission | null>(null);
  const [inspectTab, setInspectTab] = useState<'visual' | 'raw'>('visual');
  const [inspectPane, setInspectPane] = useState<'exam' | 'answers'>('answers');
  const [examToPreview, setExamToPreview] = useState<Exam | null>(null);
  const [examToShare, setExamToShare] = useState<Exam | null>(null);

  // Lọc theo lớp học
  const [classFilter, setClassFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'table' | 'distribution' | 'item_analysis'>('table');

  // Mobile navigation
  const [mobileView, setMobileView] = useState<'exams' | 'submissions'>('exams');

  const loadExams = async () => {
    setIsLoading(true);
    const { data: examRows } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    // Đáp án nằm ở bảng riêng exam_answer_keys (chỉ tác giả đọc được) → gộp lại theo shape cũ
    let data = examRows;
    if (examRows && examRows.length > 0) {
      const { data: keyRows } = await supabase
        .from('exam_answer_keys')
        .select('exam_id, part_1_keys, part_2_keys, part_3_keys')
        .in('exam_id', examRows.map((e: any) => e.id));
      const keyMap = new Map<string, any>((keyRows || []).map((k: any) => [k.exam_id, k]));
      data = examRows.map((e: any) => {
        const k = keyMap.get(e.id);
        return {
          ...e,
          answer_keys: {
            part_1: k?.part_1_keys || {},
            part_2: k?.part_2_keys || {},
            part_3: k?.part_3_keys || {},
          },
        };
      });
    }

    if (data) {
      setExams(data);
      if (!selectedExam && data.length > 0) {
        setSelectedExam(data[0]);
      } else if (selectedExam) {
        const stillExists = data.find(e => e.id === selectedExam.id);
        setSelectedExam(stillExists || (data.length > 0 ? data[0] : null));
      }
    } else {
      setExams([]);
      setSelectedExam(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadExams();
  }, []);

  const fetchSubmissions = async () => {
    if (!selectedExam) {
      setSubmissions([]);
      return;
    }
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('exam_id', selectedExam.id)
      .order('score', { ascending: false, nullsFirst: false });

    if (data) setSubmissions(data);
  };

  useEffect(() => {
    fetchSubmissions();
    
    // YuhQuiz v2 Blueprint: Tuyệt đối không dùng Supabase Realtime (WebSocket) 
    // để tránh quá tải (200 connect limit). Thay bằng Hậu Kiểm.
  }, [selectedExam]);

  // TÍNH NĂNG 1: CHẤM LẠI BÀI CỦA 1 HỌC SINH CỤ THỂ
  const handleRegradeSingle = async (sub: Submission) => {
    if (!selectedExam) return;
    try {
      // Chấm trên máy chủ bằng đáp án hiện hành (client không còn quyền UPDATE bảng submissions)
      const { data, error } = await supabase.rpc('teacher_regrade', { p_exam_id: selectedExam.id, p_submission_id: sub.id });
      if (error) throw error;
      const totalScore = data?.score;
      alert(`Đã chấm lại thành công cho thí sinh ${sub.student_name}: ${totalScore} điểm!`);
      fetchSubmissions();
    } catch (err: any) {
      alert('Lỗi chấm lại bài: ' + err.message);
    }
  };

  // TÍNH NĂNG 2: CHẤM LẠI TOÀN BỘ HỌC SINH ĐỂ ĐỒNG NHẤT DỮ LIỆU SAU KHI SỬA ĐỀ
  const handleRegradeAll = async () => {
    if (!selectedExam || submissions.length === 0) {
      alert('Chưa có bài thi nào để chấm lại.');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn chấm lại toàn bộ ${submissions.length} bài thi theo đáp án và thang điểm mới của đề "${selectedExam.title}"?`)) {
      return;
    }

    setIsRegradingAll(true);
    try {
      const { data, error } = await supabase.rpc('teacher_regrade', { p_exam_id: selectedExam.id });
      if (error) throw error;
      const successCount = data?.count ?? 0;
      alert(`Đã chấm lại thành công cho toàn bộ ${successCount} thí sinh! Toàn bộ điểm số và phổ điểm đã được đồng bộ hóa.`);
      fetchSubmissions();
    } catch (err: any) {
      alert('Lỗi khi chấm lại toàn bộ: ' + err.message);
    } finally {
      setIsRegradingAll(false);
    }
  };

  // TÍNH NĂNG 3: BUỘC NỘP BÀI VÀ CHẤM ĐIỂM NGAY CHO HỌC SINH ĐANG LÀM
  const handleForceSubmit = async (sub: Submission) => {
    if (!selectedExam) return;
    if (!confirm(`Bạn có chắc muốn THU BÀI và CHẤM ĐIỂM NGAY cho thí sinh ${sub.student_name}? Thí sinh này sẽ bị dừng bài làm.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('teacher_regrade', { p_exam_id: selectedExam.id, p_submission_id: sub.id, p_force_submit: true });
      if (error) throw error;
      const totalScore = data?.score;
      alert(`Đã thu bài thành công cho thí sinh ${sub.student_name}: ${totalScore} điểm!`);
      fetchSubmissions();
    } catch (err: any) {
      alert('Lỗi khi thu bài: ' + err.message);
    }
  };

  const handleDeleteExam = async (examId: string, examTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa kỳ thi "${examTitle}" không?\nToàn bộ kết quả và bài nộp của học sinh sẽ bị xóa vĩnh viễn.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      if (error) throw error;
      alert('Đã xóa kỳ thi thành công!');
      if (selectedExam?.id === examId) {
        setSelectedExam(null);
        setSubmissions([]);
      }
      loadExams();
    } catch (err: any) {
      alert('Không thể xóa kỳ thi: ' + err.message);
    }
  };

  const filteredSubs = submissions.filter(s => {
    const matchSearch = 
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.class_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchClass = classFilter === 'all' || s.class_name.toLowerCase() === classFilter.toLowerCase();

    return matchSearch && matchClass;
  });

  const uniqueClasses = Array.from(new Set(submissions.map(s => s.class_name).filter(Boolean)));

  const formatSeconds = (sec: number | undefined) => {
    if (sec === undefined || sec === null) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSpeedEvaluation = (sec: number | undefined) => {
    if (sec === undefined || sec === null) {
      return { label: 'Chưa có dữ liệu', color: 'text-gray-400 bg-gray-50 border-gray-100', icon: null };
    }
    if (sec < 6) {
      return { 
        label: 'Nghi vấn khoanh bừa (< 6s)', 
        color: 'text-amber-800 bg-amber-50 border-amber-200', 
        icon: <Zap className="w-3 h-3 text-amber-600" /> 
      };
    }
    if (sec < 30) {
      return { 
        label: 'Tốc độ nhanh', 
        color: 'text-blue-700 bg-blue-50 border-blue-100', 
        icon: <Clock className="w-3 h-3 text-blue-500" /> 
      };
    }
    if (sec < 120) {
      return { 
        label: 'Bình thường', 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-100', 
        icon: <CheckCircle className="w-3 h-3 text-emerald-500" /> 
      };
    }
    return { 
      label: 'Suy nghĩ kỹ (> 2p)', 
      color: 'text-purple-700 bg-purple-50 border-purple-100', 
      icon: <Brain className="w-3 h-3 text-purple-500" /> 
    };
  };

  const getSubmissionAnalytics = (sub: Submission) => {
    const timestamps = (sub.answers as any)?.timestamps || {};
    let totalQuestionsAnswered = 0;
    let fastAnswersCount = 0;

    Object.values(timestamps.part_1 || {}).forEach((t: any) => {
      totalQuestionsAnswered++;
      if (typeof t === 'number' && t < 6) fastAnswersCount++;
    });
    Object.values(timestamps.part_3 || {}).forEach((t: any) => {
      totalQuestionsAnswered++;
      if (typeof t === 'number' && t < 6) fastAnswersCount++;
    });

    const isRushing = totalQuestionsAnswered > 0 && (fastAnswersCount / totalQuestionsAnswered) > 0.35;
    return { totalQuestionsAnswered, fastAnswersCount, isRushing };
  };

  const cleanStr = (s: any) => String(s || '').trim().replace(/\s+/g, '').replace(',', '.').replace(/^\+/, '');

  return (
    <div className="flex-1 bg-transparent text-slate-900 font-sans antialiased pb-12 min-h-screen">
      
      {/* 1. TOP ACTIONS BAR */}
      <header className="glass-panel border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <h2 className="font-heading font-extrabold text-lg text-slate-800">Kho Đề Thi</h2>

        <div className="flex items-center space-x-2">
          {/* Quản lý Lớp học */}
          <button
            onClick={() => setIsClassroomModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 md:py-2 rounded-full font-bold text-xs transition-all shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Quản lý Lớp</span>
          </button>

          {/* Tạo đề mới */}
          <button
            onClick={() => {
              setExamToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-xs shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo đề mới</span>
          </button>

          {onSwitchToStudentView && (
            <button
              onClick={onSwitchToStudentView}
              className="hidden lg:flex items-center space-x-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-full font-bold text-xs transition-all shadow-xs"
              title="Xem trước với tư cách học sinh"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Giao diện HS</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. THANH CHUYỂN TAB MOBILE */}
      <div className="md:hidden glass-panel border-b border-gray-200 px-4 py-2 flex justify-around sticky top-[57px] z-20 shadow-xs">
        <button
          onClick={() => setMobileView('exams')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center transition-all ${
            mobileView === 'exams' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 bg-gray-50'
          }`}
        >
          Kỳ thi ({exams.length})
        </button>
        <div className="w-2" />
        <button
          onClick={() => setMobileView('submissions')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center transition-all ${
            mobileView === 'submissions' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 bg-gray-50'
          }`}
        >
          Bảng điểm ({submissions.length})
        </button>
      </div>

      {/* 3. NỘI DUNG CHÍNH */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          
          {/* CỘT TRÁI: DANH SÁCH KỲ THI */}
          <div className={`col-span-1 md:col-span-4 space-y-3 ${mobileView === 'exams' ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-xs text-gray-400 uppercase tracking-wider">Kỳ thi của bạn ({exams.length})</span>
              <button onClick={loadExams} className="p-1 hover:bg-gray-100 rounded text-gray-400" title="Làm mới">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <ExamSearchBar query={examQuery} onQuery={setExamQuery} grade={examGrade} onGrade={setExamGrade} subject={examSubject} onSubject={setExamSubject} />

            <div className="max-h-[75vh] overflow-y-auto pr-1">
              <SubjectGroups items={filterExams(exams as any[], examQuery, examGrade, examSubject) as Exam[]} empty="Không tìm thấy đề nào." renderItem={(exam) => {
                const isSelected = selectedExam?.id === exam.id;
                const preset = SUBJECT_PRESETS[exam.subject];
                const badgeClass = preset?.badge || 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={exam.id}
                    onClick={() => {
                      setSelectedExam(exam);
                      if (window.innerWidth < 768) setMobileView('submissions');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected 
                        ? 'bg-white/70 border-primary shadow-md ring-2 ring-primary/50' 
                        : 'bg-white/60 border-white/70 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${badgeClass}`}>
                          {exam.subject}
                        </span>
                        <ExamIdChips exam={exam as any} />
                        {exam.is_private && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap flex-shrink-0">
                            Lớp riêng
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-mono whitespace-nowrap flex-shrink-0">{exam.duration_minutes} phút</span>
                    </div>

                    <h3 className="font-bold text-sm text-gray-900 mt-2 pr-4 leading-snug">{exam.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-1">Người tạo: {exam.teacher_name || 'Giáo viên'}</p>
                    
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExamToPreview(exam);
                          }}
                          className="text-primary font-semibold hover:underline flex items-center space-x-1"
                          title="Xem trước đề thi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem đề</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExamToShare(exam);
                          }}
                          className="text-blue-600 font-semibold hover:underline flex items-center space-x-1"
                          title="Chia sẻ đường dẫn & QR"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Chia sẻ</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExamToEdit(exam);
                            setIsCreateModalOpen(true);
                          }}
                          className="text-blue-600 font-semibold hover:underline flex items-center space-x-1"
                          title="Sửa kỳ thi này"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => handleDeleteExam(exam.id, exam.title, e)}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors flex items-center space-x-1"
                        title="Xóa kỳ thi này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                );
              }} />
            </div>
          </div>

          {/* CỘT PHẢI: BẢNG GIÁM SÁT REALTIME & PHÂN TÍCH */}
          <div className={`col-span-1 md:col-span-8 glass-panel rounded-3xl p-4 md:p-6 shadow-sm flex flex-col min-h-[550px] ${
            mobileView === 'submissions' ? 'block' : 'hidden md:block'
          }`}>
            {selectedExam ? (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-gray-100 gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base md:text-lg font-extrabold text-gray-900 leading-snug">{selectedExam.title}</h2>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {selectedExam.subject}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Đồng bộ bài nộp thời gian thực • Tổng số bài thi: <b>{submissions.length}</b>
                    </p>
                  </div>

                  {/* CÁC NÚT TÍNH NĂNG ĐỒNG BỘ: XUẤT EXCEL, LEADERBOARD, CHẤM LẠI TOÀN BỘ */}
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    {/* NÚT CHẤM LẠI TOÀN BỘ */}
                    <button
                      onClick={handleRegradeAll}
                      disabled={isRegradingAll}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 transition-all shadow-xs"
                      title="Chấm lại toàn bộ bài thi theo đáp án mới nhất"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRegradingAll ? 'animate-spin' : ''}`} />
                      <span>{isRegradingAll ? 'Đang chấm...' : 'Chấm lại tất cả'}</span>
                    </button>

                    <button
                      onClick={() => setIsRescueOpen(true)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full font-bold text-xs transition-all shadow-xs"
                      title="Nhập file .yuhquiz của học sinh mất mạng"
                    >
                      <span>Nhập file cứu hộ</span>
                    </button>

                    <button
                      onClick={() => exportGradebookToExcel(selectedExam.title, filteredSubs, classFilter)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-primary-dark border border-emerald-200 px-3 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 transition-all shadow-xs"
                      title="Tải bảng điểm Excel (.xls tự co giãn cột)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Xuất Excel</span>
                    </button>

                    <button
                      onClick={() => setIsLeaderboardOpen(true)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full font-bold text-xs flex items-center space-x-1 transition-all shadow-xs"
                      title="Xem Top 20% vinh danh"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Leaderboard</span>
                    </button>
                  </div>
                </div>

                {/* THANH TAB: DANH SÁCH / PHỔ ĐIỂM / ITEM ANALYSIS */}
                <div className="flex items-center justify-between pt-3 pb-2 flex-wrap gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveTab('table')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        activeTab === 'table' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      Danh sách bài nộp ({filteredSubs.length})
                    </button>

                    <button
                      onClick={() => setActiveTab('distribution')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        activeTab === 'distribution' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      Phổ điểm hình chuông
                    </button>

                    <button
                      onClick={() => setActiveTab('item_analysis')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        activeTab === 'item_analysis' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      Phân tích câu hỏi (Pᵢ)
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {uniqueClasses.length > 0 && (
                      <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 font-bold text-gray-700 focus:outline-none focus:border-primary"
                      >
                        <option value="all">Tất cả các lớp</option>
                        {uniqueClasses.map(cls => (
                          <option key={cls} value={cls}>Lớp {cls}</option>
                        ))}
                      </select>
                    )}

                    <div className="relative w-36 sm:w-44">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2" />
                      <input
                        type="text"
                        placeholder="Tìm học sinh..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex-1 overflow-y-auto">
                  {activeTab === 'distribution' ? (
                    <ScoreDistributionChart submissions={filteredSubs} />
                  ) : activeTab === 'item_analysis' ? (
                    <ItemAnalysisTable exam={selectedExam} submissions={filteredSubs} />
                  ) : (
                    <>
                      {filteredSubs.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-gray-400 space-y-2">
                          <Users className="w-7 h-7 text-gray-300" />
                          <p className="text-xs">Chưa có bài nộp nào phù hợp với bộ lọc</p>
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase font-semibold">
                              <th className="py-3 px-3">Thí sinh</th>
                              <th className="py-3 px-3">Lớp</th>
                              <th className="py-3 px-3">Trạng thái</th>
                              <th className="py-3 px-3">Gian lận</th>
                              <th className="py-3 px-3 text-right">Điểm</th>
                              <th className="py-3 px-3 text-center">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredSubs.map((sub) => {
                              const analytics = getSubmissionAnalytics(sub);
                              const isSubSubmitted = sub.status === 'submitted';

                              return (
                                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-3 px-3">
                                    <span className="font-bold text-gray-900 block">{sub.student_name}</span>
                                    {analytics.isRushing && (
                                      <span className="inline-flex items-center space-x-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium mt-0.5">
                                        <Zap className="w-2.5 h-2.5 text-amber-500" />
                                        <span>Nghi vấn ({analytics.fastAnswersCount} câu &lt; 6s)</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 font-medium text-gray-600">{sub.class_name}</td>
                                  <td className="py-3 px-3">
                                    {isSubSubmitted ? (
                                      <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Đã nộp
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
                                        <Clock className="w-3 h-3 mr-1 animate-spin" /> Đang làm
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    {sub.cheat_count > 0 ? (
                                      <span className="inline-flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-semibold border border-rose-100">
                                        <AlertTriangle className="w-3 h-3 mr-1" /> {sub.cheat_count} lần ({sub.total_away_seconds}s)
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 font-medium">0 lần</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right font-extrabold text-sm text-primary">
                                    {sub.score !== null ? `${sub.score} đ` : '--'}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center space-x-1.5">
                                      {/* Nút Xem Soát bài */}
                                      <button
                                        onClick={() => setInspectSubmission(sub)}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-bold text-xs transition-all flex items-center space-x-1"
                                        title="Soát chi tiết bài thi"
                                      >
                                        <Eye className="w-3 h-3 text-primary" />
                                        <span>Soát bài</span>
                                      </button>

                                      {/* Nút Chấm lại bài của riêng học sinh này */}
                                      <button
                                        onClick={() => handleRegradeSingle(sub)}
                                        className="p-1 hover:bg-blue-50 text-blue-600 rounded-full transition-colors"
                                        title="Chấm lại bài của học sinh này"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Nút Thu bài / Buộc nộp nếu đang làm */}
                                      {!isSubSubmitted && (
                                        <button
                                          onClick={() => handleForceSubmit(sub)}
                                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-full transition-colors"
                                          title="Buộc nộp bài và khóa thi ngay"
                                        >
                                          <StopCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                Vui lòng chọn kỳ thi để bắt đầu theo dõi
              </div>
            )}
          </div>

        </div>
      </div>

      {isCreateModalOpen && (
        <CreateExamModal
          currentUser={currentUser}
          examToEdit={examToEdit}
          onClose={() => {
            setIsCreateModalOpen(false);
            setExamToEdit(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setExamToEdit(null);
            loadExams();
          }}
        />
      )}

      {isClassroomModalOpen && (
        <ClassroomModal
          currentUser={currentUser}
          onClose={() => setIsClassroomModalOpen(false)}
        />
      )}

      {isRescueOpen && selectedExam && (
        <RescueImportModal exam={selectedExam} onClose={() => setIsRescueOpen(false)} onDone={fetchSubmissions} />
      )}

      {isLeaderboardOpen && selectedExam && (
        <LeaderboardModal
          exam={selectedExam}
          submissions={filteredSubs}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      )}

      {/* MODAL SOI BÀI TRỰC QUAN v11 */}
      {inspectSubmission && selectedExam && (
        <div className="fixed inset-0 yq-overlay z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-[96vw] max-w-[1600px] h-[92vh] p-5 flex flex-col shadow-2xl">
            
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="font-extrabold text-xl text-gray-900">{inspectSubmission.student_name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-bold">
                    Lớp: {inspectSubmission.class_name}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Kỳ thi: <span className="font-semibold text-gray-700">{selectedExam.title}</span> ({selectedExam.subject})
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Tổng điểm</span>
                  <span className="text-xl font-extrabold text-primary">{inspectSubmission.score ?? '--'}</span>
                  <span className="text-xs text-gray-500"> / 10.0</span>
                </div>
                <button 
                  onClick={() => setInspectSubmission(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-sm transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* CHIA ĐÔI: TRÁI = ĐỀ THI, PHẢI = BÀI LÀM CỦA HỌC SINH */}
            <div className="lg:hidden flex gap-2 mt-3">
              <button onClick={() => setInspectPane('exam')} className={`btn flex-1 ${inspectPane === 'exam' ? 'btn-primary' : 'btn-secondary'}`}>Đề thi</button>
              <button onClick={() => setInspectPane('answers')} className={`btn flex-1 ${inspectPane === 'answers' ? 'btn-primary' : 'btn-secondary'}`}>Bài làm</button>
            </div>
            <div className="flex-1 min-h-0 flex gap-4 mt-3">
              <section aria-label="Đề thi" className={`${inspectPane === 'exam' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden border border-gray-200 bg-[#525659]`}>
                <div className="px-3 py-2 bg-gray-100 text-xs font-bold text-gray-600 border-b border-gray-200">Đề thi · {selectedExam.title}</div>
                {(selectedExam as any).config?.question_images?.length ? (
                  <div className="flex-1 overflow-auto p-2 space-y-2">
                    {(selectedExam as any).config.question_images.map((url: string, i: number) => (
                      <div key={url + i} className="bg-white rounded-lg p-2">
                        <p className="text-xs font-bold text-slate-500 mb-1">Câu {i + 1}</p>
                        <img src={url} alt={`Câu ${i + 1}`} loading="lazy" className="w-full h-auto" />
                      </div>
                    ))}
                  </div>
                ) : selectedExam.pdf_url ? (
                  <iframe title="Đề thi PDF" className="flex-1 w-full border-0 bg-white"
                          src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedExam.pdf_url)}&embedded=true`} />
                ) : (
                  <div className="flex-1 grid place-items-center text-sm text-white/80 p-6 text-center">Đề này chưa có file PDF hoặc ảnh câu hỏi.</div>
                )}
              </section>

              <div className={`${inspectPane === 'answers' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-w-0 min-h-0`}>
            {/* THANH ĐÁNH GIÁ NĂNG LỰC */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-[#FAFAFA] border border-gray-200 p-3 rounded-2xl flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 block">Rời màn hình / Tab</span>
                  <span className="text-xs font-bold text-gray-900">
                    {inspectSubmission.cheat_count} lần ({inspectSubmission.total_away_seconds} giây)
                  </span>
                </div>
              </div>

              {(() => {
                const analytics = getSubmissionAnalytics(inspectSubmission);
                return (
                  <div className="bg-[#FAFAFA] border border-gray-200 p-3 rounded-2xl flex items-center space-x-3 col-span-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 block">Đánh giá độ tin cậy thời gian</span>
                      <span className="text-xs font-bold text-gray-900">
                        {analytics.isRushing ? (
                          <span className="text-amber-700 font-extrabold">⚠️ Nghi vấn chọn bừa ({analytics.fastAnswersCount} câu dưới 6s)</span>
                        ) : (
                          <span className="text-emerald-700 font-bold">🟢 Tốc độ bình thường, có tư duy suy nghĩ</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex border-b border-gray-100 pb-2 space-x-4 text-xs font-bold">
              <button
                onClick={() => setInspectTab('visual')}
                className={`pb-2 border-b-2 flex items-center space-x-1.5 transition-all ${
                  inspectTab === 'visual' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Đối soát từng câu (Đúng / Sai & Thời gian)</span>
              </button>
              <button
                onClick={() => setInspectTab('raw')}
                className={`pb-2 border-b-2 flex items-center space-x-1.5 transition-all ${
                  inspectTab === 'raw' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Code className="w-4 h-4" />
                <span>Xem Dữ liệu thô (JSON)</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6 text-xs pr-1">
              {inspectTab === 'raw' ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-bold text-gray-700 mb-2">Đáp án học sinh gửi lên:</p>
                    <pre className="bg-gray-900 text-emerald-400 p-4 rounded-2xl overflow-x-auto text-[11px] font-mono">
                      {JSON.stringify(inspectSubmission.answers, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 mb-2">Chi tiết điểm từ server (score_details):</p>
                    <pre className="bg-gray-900 text-blue-300 p-4 rounded-2xl overflow-x-auto text-[11px] font-mono">
                      {JSON.stringify(inspectSubmission.score_details, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* PHẦN I */}
                  {Object.keys(selectedExam.answer_keys?.part_1 || {}).length > 0 && (
                    <div className="bg-[#FAFAFA] p-4 rounded-2xl border border-gray-200">
                      <h4 className="font-bold text-sm text-gray-900 mb-3">PHẦN I: Trắc nghiệm 4 lựa chọn</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(selectedExam.answer_keys.part_1).map((qStr) => {
                          const qIdx = Number(qStr);
                          const studentAns = (inspectSubmission.answers as any)?.part_1?.[qIdx];
                          const key = (selectedExam.answer_keys as any)?.part_1?.[qIdx];
                          const isCorrect = (inspectSubmission.score_details as any)?.part_1?.[qIdx]?.is_correct ?? (studentAns && key && studentAns.toUpperCase() === key.toUpperCase());
                          const timeSec = (inspectSubmission.answers as any)?.timestamps?.part_1?.[qIdx];
                          const speed = getSpeedEvaluation(timeSec);

                          return (
                            <div key={qIdx} className="glass-panel p-3 rounded-xl flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-gray-800">Câu {qIdx}:</span>
                                  {studentAns ? (
                                    <span className={`px-2 py-0.5 rounded font-extrabold text-xs flex items-center space-x-1 ${
                                      isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      <span>Chọn {studentAns}</span>
                                      {isCorrect ? <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" /> : <XCircle className="w-3 h-3 text-rose-600 inline" />}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic">Bỏ trắng</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Đáp án đúng: <span className="font-bold text-gray-800">{key || '--'}</span>
                                </div>
                              </div>

                              <div className="text-right space-y-1">
                                <div className="text-[11px] font-mono text-gray-600 flex items-center justify-end space-x-1">
                                  <Timer className="w-3 h-3 text-gray-400" />
                                  <span>{formatSeconds(timeSec)}</span>
                                </div>
                                <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${speed.color}`}>
                                  {speed.icon}
                                  <span>{speed.label}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHẦN II */}
                  {Object.keys(selectedExam.answer_keys?.part_2 || {}).length > 0 && (
                    <div className="bg-[#FAFAFA] p-4 rounded-2xl border border-gray-200">
                      <h4 className="font-bold text-sm text-gray-900 mb-3">PHẦN II: Trắc nghiệm Đúng / Sai</h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.keys(selectedExam.answer_keys.part_2).map((qStr) => {
                          const qIdx = Number(qStr);
                          const studentGroup = (inspectSubmission.answers as any)?.part_2?.[qIdx] || {};
                          const keyGroup = (selectedExam.answer_keys as any)?.part_2?.[qIdx] || {};
                          const qScore = (inspectSubmission.score_details as any)?.part_2?.[qIdx]?.score || 0;
                          const correctCount = (inspectSubmission.score_details as any)?.part_2?.[qIdx]?.correct_count || 0;

                          return (
                            <div key={qIdx} className="glass-panel p-4 rounded-2xl">
                              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                                <span className="font-bold text-sm text-gray-800">Câu {qIdx}</span>
                                <span className="text-xs font-bold text-primary">
                                  Đạt: {qScore}đ ({correctCount}/4 ý đúng)
                                </span>
                              </div>

                              <div className="space-y-2">
                                {['a', 'b', 'c', 'd'].map((sub) => {
                                  const val = studentGroup[sub];
                                  const key = keyGroup[sub];
                                  const isCorrect = (inspectSubmission.score_details as any)?.part_2?.[qIdx]?.details?.[sub] ?? (val !== undefined && Boolean(val) === Boolean(key));
                                  const timeSec = (inspectSubmission.answers as any)?.timestamps?.part_2?.[qIdx]?.[sub];

                                  return (
                                    <div key={sub} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-bold text-xs text-gray-700">Ý {sub})</span>
                                        {isCorrect ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                        )}
                                        <span className="text-xs">
                                          HS: <b className={val === true ? 'text-emerald-700' : val === false ? 'text-rose-700' : 'text-gray-400'}>
                                            {val === true ? 'Đúng' : val === false ? 'Sai' : '--'}
                                          </b>
                                        </span>
                                      </div>

                                      <div className="flex items-center space-x-3 text-right">
                                        <span className="text-[11px] text-gray-700">
                                          ĐS: <b className="text-primary">{key === true ? 'Đúng' : key === false ? 'Sai' : '--'}</b>
                                        </span>
                                        {timeSec && (
                                          <span className="text-[10px] font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border">
                                            ⏱️ {formatSeconds(timeSec)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHẦN III */}
                  {Object.keys(selectedExam.answer_keys?.part_3 || {}).length > 0 && (
                    <div className="bg-[#FAFAFA] p-4 rounded-2xl border border-gray-200">
                      <h4 className="font-bold text-sm text-gray-900 mb-3">PHẦN III: Trắc nghiệm trả lời ngắn</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(selectedExam.answer_keys.part_3).map((qStr) => {
                          const qIdx = Number(qStr);
                          const studentAns = (inspectSubmission.answers as any)?.part_3?.[qIdx];
                          const key = (selectedExam.answer_keys as any)?.part_3?.[qIdx];
                          
                          const isCorrect = (inspectSubmission.score_details as any)?.part_3?.[qIdx]?.is_correct ?? (
                            cleanStr(studentAns) !== '' && (cleanStr(studentAns) === cleanStr(key) || Number(cleanStr(studentAns)) === Number(cleanStr(key)))
                          );
                          const timeSec = (inspectSubmission.answers as any)?.timestamps?.part_3?.[qIdx];
                          const speed = getSpeedEvaluation(timeSec);

                          return (
                            <div key={qIdx} className="glass-panel p-3 rounded-xl flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-gray-800">Câu {qIdx}:</span>
                                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs flex items-center space-x-1 ${
                                    isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    <span>{studentAns || 'Bỏ trắng'}</span>
                                    {isCorrect ? <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" /> : <XCircle className="w-3 h-3 text-rose-600 inline" />}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Đáp số đúng: <span className="font-bold font-mono text-primary">{key || '--'}</span>
                                </div>
                              </div>

                              <div className="text-right space-y-1">
                                <div className="text-[11px] font-mono text-gray-600 flex items-center justify-end space-x-1">
                                  <Timer className="w-3 h-3 text-gray-400" />
                                  <span>{formatSeconds(timeSec)}</span>
                                </div>
                                <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${speed.color}`}>
                                  {speed.icon}
                                  <span>{speed.label}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* EXAM PREVIEW MODAL */}
      {examToPreview && (
        <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/60 flex items-center justify-between bg-white/40">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900 leading-tight">Xem trước đề: {examToPreview.title}</h3>
                <p className="text-xs text-gray-500 mt-1">Giao diện xem trước nội dung đề thi dành cho giáo viên.</p>
              </div>
              <button
                onClick={() => setExamToPreview(null)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden bg-[#525659] relative">
              {examToPreview.pdf_url ? (
                <object
                  data={`${examToPreview.pdf_url}#view=FitH&toolbar=0`}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <div className="flex flex-col items-center justify-center h-full text-white">
                    <p>Trình duyệt không hỗ trợ xem PDF trực tiếp.</p>
                    <a href={examToPreview.pdf_url} target="_blank" rel="noreferrer" className="mt-4 px-4 py-2 bg-primary text-white rounded-full font-bold">
                      Tải PDF xuống
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white">
                  Không tìm thấy tệp PDF của kỳ thi này.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {examToShare && (
        <div className="fixed inset-0 z-50 yq-overlay flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center">
            <h3 className="font-extrabold text-xl text-gray-900 mb-1">Chia sẻ Kỳ thi</h3>
            <p className="text-sm text-gray-500 mb-6">Mời học sinh tham gia làm bài thi <b>{examToShare.title}</b></p>
            {(examToShare as any).short_id && (
              <p className="text-center mb-4 text-xs text-gray-500">Mã đề: <b className="font-mono text-lg tracking-widest text-gray-900 select-all">{(examToShare as any).short_id}</b></p>
            )}
            
            <div className="flex justify-center mb-6">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                <QrImage
                  text={`${window.location.origin}/?examId=${(examToShare as any).short_id || examToShare.id}`}
                  className="w-40 h-40 object-contain"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between border border-gray-200 mb-6">
              <span className="text-xs font-mono text-gray-600 truncate mr-2 select-all">
                {`${window.location.origin}/?examId=${(examToShare as any).short_id || examToShare.id}`}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?examId=${(examToShare as any).short_id || examToShare.id}`);
                  alert('Đã copy đường dẫn!');
                }}
                className="p-2 rounded-xl bg-white hover:bg-gray-100 text-primary shadow-sm border border-gray-200 transition-all"
                title="Copy đường dẫn"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setExamToShare(null)}
              className="w-full py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
